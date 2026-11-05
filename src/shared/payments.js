import '../membership-state.js';
/**
 * Zovo Extension Payment Integration
 * Agent 2: License Verification Module with Retry Logic
 */

const ZOVO_API_BASE = 'https://zgubxqomnbmxgbdhvwja.supabase.co/functions/v1';
const EXTENSION_ID = 'clipboard_history_pro';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Retry configuration
const MAX_RETRIES = 3;
const FETCH_TIMEOUT_MS = 15000; // per attempt; a hung request becomes a network error
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

// License cache
let licenseCache = {
    data: null,
    timestamp: 0
};

// Bound every attempt. A timeout is treated like any network error (retried,
// then the cached license is used) and never changes the stored tier.
function withTimeout(options) {
    try {
        if (!(options && options.signal) && typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
            return { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) };
        }
    } catch (e) { /* no timeout support: plain fetch */ }
    return options;
}

/**
 * Fetch with automatic retry on failure
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, withTimeout(options));
            // Success or client error (don't retry 4xx)
            if (response.ok || response.status < 500) {
                return response;
            }
            // Server error - retry if attempts remaining
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, RETRY_DELAYS[i]));
                continue;
            }
            return response;
        } catch (error) {
            // Network error - retry if attempts remaining
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, RETRY_DELAYS[i]));
        }
    }
}

/**
 * Queue paywall event for offline retry
 * @param {string} email - User email
 * @param {string} feature - Feature that triggered paywall
 */
async function queuePaywallEvent(email, feature) {
    const { paywallQueue = [] } = await chrome.storage.local.get('paywallQueue');
    paywallQueue.push({ email, feature, timestamp: Date.now() });
    await chrome.storage.local.set({ paywallQueue });
}

/**
 * Process queued paywall events when online
 */
export async function processPaywallQueue() {
    const { paywallQueue = [] } = await chrome.storage.local.get('paywallQueue');
    if (!paywallQueue.length) return { processed: 0 };

    const remaining = [];
    let processed = 0;

    for (const event of paywallQueue) {
        // Skip events older than 7 days
        if (Date.now() - event.timestamp > 7 * 24 * 60 * 60 * 1000) continue;

        const result = await logPaywallHit(event.email, event.feature, true);
        if (result.success) {
            processed++;
        } else {
            remaining.push(event);
        }
    }

    await chrome.storage.local.set({ paywallQueue: remaining });
    return { processed, remaining: remaining.length };
}

/**
 * Verify license key with the Zovo API
 * @param {string} licenseKey - ZOVO-XXXX-XXXX-XXXX-XXXX format
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 * @returns {Promise<{valid: boolean, tier?: string, features?: string[], error?: string}>}
 */
export async function verifyLicense(licenseKey, forceRefresh = false) {
    // Snapshot prior-member evidence before the legacy tier refresh; notice failures never block verification.
    try { await globalThis.ZovoMembershipState.read(); } catch {}
    // Check cache first
    if (!forceRefresh && licenseCache.data && Date.now() - licenseCache.timestamp < CACHE_DURATION_MS) {
        return licenseCache.data;
    }

    try {
        const response = await fetchWithRetry(`${ZOVO_API_BASE}/verify-extension-license`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                license_key: licenseKey,
                extension: EXTENSION_ID
            })
        });

        const data = await response.json();

        // Bridge the server verdict to the tier flag the limit checks read.
        // background.js getCurrentTier() reads chrome.storage.sync 'tier' and
        // every limit (maxClips/maxStarred/maxPinned) derives from it, so a
        // valid license must set it or Pro never actually unlocks. On a
        // definitive server rejection of the ACTIVE stored key (not a typo of
        // a new key), revoke back to free. Network errors never reach here.
        try {
            if (data.valid === true) {
                await chrome.storage.sync.set({
                    tier: 'pro',
                    proExpiry: 0,
                    upgradedAt: Date.now()
                });
            } else if (data.valid === false && (response.status === 403 || response.status === 404)) {
                // Only a definitive server rejection revokes. A rate-limit
                // reply (429), auth hiccup (401) or garbage JSON must never
                // downgrade a paying user - the on-update re-verify in
                // background.js runs against an IP rate limiter.
                const { licenseKey: activeKey } = await chrome.storage.sync.get('licenseKey');
                if (activeKey && activeKey === licenseKey) {
                    await chrome.storage.sync.set({ tier: 'free', proExpiry: 0 });
                }
            }
        } catch (tierErr) {
            console.warn('[Zovo] Tier sync skipped:', tierErr.message);
        }

        // Cache successful responses
        if (data.valid) {
            licenseCache = {
                data: data,
                timestamp: Date.now()
            };
            // Store in chrome.storage for persistence
            await chrome.storage.local.set({
                zovoLicense: {
                    ...data,
                    cachedAt: Date.now()
                }
            });
        }

        return data;
    } catch (error) {
        console.error('[Zovo] License verification failed:', error);

        // Fall back to cached data if available
        const stored = await chrome.storage.local.get('zovoLicense');
        if (stored.zovoLicense && stored.zovoLicense.valid) {
            return stored.zovoLicense;
        }

        return { valid: false, error: 'Network error' };
    }
}

/**
 * Check if user has a specific feature enabled
 * @param {string} featureName - Feature to check
 * @returns {Promise<boolean>}
 */
export async function hasFeature(featureName) {
    const stored = await chrome.storage.local.get('zovoLicense');
    if (!stored.zovoLicense?.valid) return false;
    return stored.zovoLicense.features?.includes(featureName) ?? false;
}

/**
 * Check if user is Pro (has any valid license)
 * @returns {Promise<boolean>}
 */
export async function isPro() {
    const stored = await chrome.storage.local.get('zovoLicense');
    return stored.zovoLicense?.valid === true;
}

/**
 * Get the user's membership tier
 * @returns {Promise<string>} - 'free', 'pro', or 'lifetime'
 */
export async function getTier() {
    const stored = await chrome.storage.local.get('zovoLicense');
    return stored.zovoLicense?.tier || 'free';
}

/**
 * Log a paywall hit - triggers drip email sequence
 * @param {string} email - User's email address
 * @param {string} featureAttempted - Which feature triggered the paywall
 * @param {boolean} skipQueue - Skip offline queue (used for queue processing)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function logPaywallHit(email, featureAttempted, skipQueue = false) {
    if (!email || !isValidEmail(email)) {
        return { success: false, error: 'Invalid email' };
    }

    try {
        const response = await fetchWithRetry(`${ZOVO_API_BASE}/log-paywall-hit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                extension_id: EXTENSION_ID,
                feature_attempted: featureAttempted
            })
        });

        return await response.json();
    } catch (error) {
        console.error('[Zovo] Failed to log paywall hit:', error);

        // Queue for later if not already processing queue
        if (!skipQueue) {
            await queuePaywallEvent(email, featureAttempted);
            return { success: false, error: 'Queued for retry', queued: true };
        }

        return { success: false, error: 'Network error' };
    }
}

/**
 * Track analytics event
 * @param {string} eventName - Event name
 * @param {object} eventData - Additional event data
 */
export async function trackEvent(eventName, eventData = {}) {
    try {
        await fetch(`${ZOVO_API_BASE}/collect-analytics`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                extension_slug: EXTENSION_ID,
                event_name: eventName,
                event_data: eventData,
                session_id: await getSessionId()
            })
        });
    } catch (error) {
        // Silent fail for analytics
        console.debug('[Zovo] Analytics error:', error);
    }
}

/**
 * Get or create a session ID for analytics
 */
async function getSessionId() {
    const stored = await chrome.storage.session.get('sessionId');
    if (stored.sessionId) return stored.sessionId;

    const sessionId = crypto.randomUUID();
    await chrome.storage.session.set({ sessionId });
    return sessionId;
}

/**
 * Simple email validation
 */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Open the Zovo upgrade page
 */
export function openUpgradePage() {
    chrome.tabs.create({
        url: `https://zovo.one/pricing?ref=${EXTENSION_ID}`
    });
}

/**
 * Clear cached license data
 */
export async function clearLicenseCache() {
    licenseCache = { data: null, timestamp: 0 };
    await chrome.storage.local.remove('zovoLicense');
}

// Export for use in other modules
export default {
    verifyLicense,
    hasFeature,
    isPro,
    getTier,
    logPaywallHit,
    trackEvent,
    openUpgradePage,
    clearLicenseCache,
    processPaywallQueue
};
