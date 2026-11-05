import "./whats-new-trigger.js";
// Clipboard History Pro - Background Service Worker
// Captures clipboard content and stores in IndexedDB

// Static import. import() is disallowed in a service worker, so the old
// dynamic import always threw and Pro was never re-verified.
import { verifyLicense, processPaywallQueue } from "./shared/payments.js";

const DB_NAME = 'ClipboardHistoryPro';
const DB_VERSION = 1;
const STORE_NAME = 'clips';

// Tier limits based on competitive research
const LIMITS = {
    free: {
        maxClips: 100,
        maxStarred: 10,
        maxPinned: 5,
        exportEnabled: false,
        syncEnabled: false
    },
    pro: {
        maxClips: 10000,
        // Number.MAX_SAFE_INTEGER, not Infinity: Infinity serializes to null over
        // chrome.runtime.sendMessage (GET_LIMITS), which made the popup's
        // "count >= maxStarred" checks compare against null and silently misbehave.
        maxStarred: Number.MAX_SAFE_INTEGER,
        maxPinned: Number.MAX_SAFE_INTEGER,
        exportEnabled: true,
        syncEnabled: true
    }
};

let db = null;
// Trims run one at a time, one per added clip (see enforceClipLimit).
let trimQueue = Promise.resolve();

// Initialize database
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('starred', 'starred', { unique: false });
                store.createIndex('pinned', 'pinned', { unique: false });
                store.createIndex('type', 'type', { unique: false });
            }
        };
    });
}

// Get current tier
async function getCurrentTier() {
    const { tier } = await chrome.storage.sync.get({ tier: 'free' });
    return tier;
}

// Get limits for current tier
async function getTierLimits() {
    const tier = await getCurrentTier();
    return LIMITS[tier] || LIMITS.free;
}

// "Skip a copy that matches the last one" setting (popup Settings and
// onboarding step 3 write it). Defaults to on, which was the old behaviour.
async function skipDuplicatesEnabled() {
    try {
        const { clipboardSettings } = await chrome.storage.local.get('clipboardSettings');
        return !(clipboardSettings && clipboardSettings.skipDuplicates === false);
    } catch (e) {
        return true;
    }
}

// Add new clip
async function addClip(content, type = 'text') {
    if (!db) await initDB();

    const limits = await getTierLimits();

    // Skip a copy identical to the most recent clip, unless the user turned
    // that off (clipboardSettings.skipDuplicates === false). Compare the stored
    // (truncated) form so copies over 50,000 characters dedupe too.
    if (await skipDuplicatesEnabled()) {
        const recentClip = await getMostRecentClip();
        if (recentClip && recentClip.content === content.substring(0, 50000)) {
            return null; // Skip duplicate
        }
    }

    const clip = {
        id: crypto.randomUUID(),
        content: content.substring(0, 50000), // Max 50KB per clip
        type: detectType(content),
        timestamp: Date.now(),
        starred: false,
        pinned: false,
        usageCount: 0
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const request = store.add(clip);
        request.onsuccess = () => {
            trimQueue = trimQueue.then(() => enforceClipLimit(limits.maxClips)).catch(() => {});
            resolve(clip);
        };
        request.onerror = () => reject(request.error);
    });
}

// Detect content type
function detectType(content) {
    const trimmed = content.trim();

    // URL
    if (/^https?:\/\//.test(trimmed)) return 'url';

    // Email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'email';

    // Code (heuristic)
    if (/[{}\[\]();]/.test(trimmed) && /\n/.test(trimmed)) return 'code';

    // JSON
    try {
        JSON.parse(trimmed);
        return 'json';
    } catch { }

    // Number
    if (/^\d+([.,]\d+)?$/.test(trimmed)) return 'number';

    return 'text';
}

// Get most recent clip
async function getMostRecentClip() {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');

        const request = index.openCursor(null, 'prev');
        request.onsuccess = () => {
            const cursor = request.result;
            resolve(cursor ? cursor.value : null);
        };
        request.onerror = () => reject(request.error);
    });
}

// Get all clips
async function getAllClips() {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        const request = store.getAll();
        request.onsuccess = () => {
            const clips = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(clips);
        };
        request.onerror = () => reject(request.error);
    });
}

// Update clip (star, pin, etc.)
async function updateClip(id, updates) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
            const clip = getRequest.result;
            if (!clip) {
                reject(new Error('Clip not found'));
                return;
            }

            const updated = { ...clip, ...updates };
            const putRequest = store.put(updated);
            putRequest.onsuccess = () => resolve(updated);
            putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// Delete clip
async function deleteClip(id) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Clear all clips
async function clearAllClips() {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Enforce clip limit. Starred and pinned clips are never deleted and do not
// count toward the cap. This runs once per added clip and removes at most ONE
// clip, the oldest one that is neither starred nor pinned, so a history that
// is already over the cap (Pro lapsed to free, say) keeps its size instead of
// being cut down to the free cap on the next copy.
async function enforceClipLimit(maxClips) {
    const clips = await getAllClips();   // newest first
    const removable = clips.filter(c => !c.pinned && !c.starred);

    if (removable.length > maxClips) {
        await deleteClip(removable[removable.length - 1].id);

        // Peak-intent signal. The cap is usually hit while copying on a page with
        // the popup CLOSED, so a runtime message alone reaches no one. Persist a
        // flag the popup consumes on next open. No toolbar badge: setting one on
        // every copy at the cap was a nag. The open-popup case still gets the
        // live message below.
        const tier = await getCurrentTier();
        if (tier === 'free') {
            try {
                await chrome.storage.local.set({ capHitPending: true });
            } catch (e) { /* storage best-effort; never block clip capture */ }
            chrome.runtime.sendMessage({
                action: 'LIMIT_REACHED',
                type: 'clips',
                limit: maxClips
            }, () => { void chrome.runtime.lastError; });   // swallow "no receiver" when popup is closed
        }
    }
}

// Search clips
async function searchClips(query) {
    const clips = await getAllClips();
    const lowerQuery = query.toLowerCase();

    return clips.filter(clip =>
        clip.content.toLowerCase().includes(lowerQuery)
    );
}

// Get usage stats
async function getStats() {
    const clips = await getAllClips();
    const limits = await getTierLimits();

    return {
        totalClips: clips.length,
        // What the history limit counts: clips that are neither starred nor pinned.
        removableClips: clips.filter(c => !c.pinned && !c.starred).length,
        maxClips: limits.maxClips,
        starredCount: clips.filter(c => c.starred).length,
        maxStarred: limits.maxStarred,
        pinnedCount: clips.filter(c => c.pinned).length,
        maxPinned: limits.maxPinned,
        tier: await getCurrentTier()
    };
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handlers = {
        GET_CLIPS: async () => getAllClips(),
        // Copies from incognito tabs are never stored (content.js skips them too).
        ADD_CLIP: async () => (sender && sender.tab && sender.tab.incognito) ? null : addClip(message.content, message.type),
        UPDATE_CLIP: async () => updateClip(message.id, message.updates),
        DELETE_CLIP: async () => deleteClip(message.id),
        CLEAR_ALL: async () => clearAllClips(),
        SEARCH: async () => searchClips(message.query),
        GET_STATS: async () => getStats(),
        GET_LIMITS: async () => getTierLimits(),
        // Agent 3: Referral tracking handlers
        TRACK_REFERRAL: async () => {
            if (message.referralCode?.startsWith('CHP_')) {
                await chrome.storage.local.set({
                    referredBy: message.referralCode,
                    referralTimestamp: Date.now()
                });
                return { success: true };
            }
            return { success: false, error: 'Invalid referral code' };
        },
        CHECK_QUALIFIED_REFERRAL: async () => checkQualifiedReferral()
    };

    const handler = handlers[message.action];
    if (handler) {
        handler().then(sendResponse).catch(err => sendResponse({ error: err.message }));
        return true; // Async response
    }
});

// Uninstall feedback URL. v = the installed version, so survey answers can be
// tied to a release. No user or license identifiers are sent.
function setUninstallFeedbackURL() {
    try {
        const v = encodeURIComponent(chrome.runtime.getManifest().version);
        const p = chrome.runtime.setUninstallURL(
            'https://zovo.one/feedback/uninstall/clipboard-history-pro?v=' + v
        );
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { /* never block startup */ }
}
// Also on every worker start, so the stored URL always names this version.
setUninstallFeedbackURL();

// Context menu entry: opens the history popup (it does not paste)
chrome.runtime.onInstalled.addListener(async (details) => {
    // Set first, before any await, so a failing initDB() cannot skip it.
    setUninstallFeedbackURL();

    // Initialize database
    await initDB();

    // Create context menu. removeAll() first so re-running on 'update' does not
    // throw "Cannot create item with duplicate id 'paste-from-history'".
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'paste-from-history',
            title: 'Open Clipboard History',
            contexts: ['editable']
        });
    });

    // Show onboarding on first install.
    // The onboarding tab is opened by the Zovo-standard opener appended below
    // (zovo-onboarding-tsp/onboarding.html); opening onboarding/welcome.html here
    // too gave every new user TWO onboarding tabs at once. Tracking is preserved.
    if (details.reason === 'install') {
        // Track install
        chrome.storage.local.set({
            installedAt: Date.now(),
            onboardingComplete: false
        });

        // Check for referral code in install URL (Agent 3: Attribution)
        const referralCode = await captureReferralFromURL();
        if (referralCode) {
            await chrome.storage.local.set({
                referredBy: referralCode,
                referralTimestamp: Date.now()
            });
            console.log('[Zovo] Referral captured:', referralCode);
        }
    }

    // Add the capture script to tabs that were already open. On install they
    // have none, and after an update their old copy is cut off from the
    // extension ("Extension context invalidated"), so without this every open
    // tab silently stops saving copies until it is reloaded. Only http(s) tabs
    // match (no chrome:// pages); the Web Store refuses scripts and is skipped.
    if (details.reason === 'install' || details.reason === 'update') {
        try {
            const openTabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
            for (const tab of openTabs) {
                if (typeof tab.id !== 'number') continue;
                if (tab.url && /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/.test(tab.url)) continue;
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['src/content.js']
                }).catch(() => { /* restricted pages refuse; fine */ });
            }
        } catch (e) {
            console.debug('[Zovo] Open-tab injection skipped:', e.message);
        }
    }

    // Refresh license on install or update
    if (details.reason === 'install' || details.reason === 'update') {
        await recheckLicense(true, details.reason);
    }
});

// Agent 3: Capture referral code from extension install URL
async function captureReferralFromURL() {
    try {
        // Try to get referral from storage first (set by landing page)
        const { pendingReferral } = await chrome.storage.local.get('pendingReferral');
        if (pendingReferral?.code && pendingReferral.code.startsWith('CHP_')) {
            // Check if within 30-day window
            if (Date.now() - pendingReferral.timestamp < 30 * 24 * 60 * 60 * 1000) {
                return pendingReferral.code;
            }
        }
        return null;
    } catch (error) {
        console.debug('[Zovo] Referral capture failed:', error);
        return null;
    }
}

// Agent 3: Track qualified referral (user retained 7+ days)
async function checkQualifiedReferral() {
    const { referredBy, installedAt } = await chrome.storage.local.get(['referredBy', 'installedAt']);

    if (referredBy && installedAt) {
        const daysSinceInstall = (Date.now() - installedAt) / (24 * 60 * 60 * 1000);

        if (daysSinceInstall >= 7) {
            // Mark as qualified and notify (would send to server in production)
            await chrome.storage.local.set({ referralQualified: true });
            console.log('[Zovo] Referral qualified:', referredBy);
            return true;
        }
    }
    return false;
}

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'paste-from-history') {
        // Open popup for selection
        chrome.action.openPopup();
    }
});

// Pro re-check. Forced on install/update, otherwise at most once a day when
// the worker starts. verifyLicense() revokes Pro only on an explicit server
// verdict for the stored key (HTTP 403/404 with valid:false); network errors,
// timeouts, 5xx, 429 and replies without `valid` leave the tier unchanged.
const LICENSE_RECHECK_MS = 24 * 60 * 60 * 1000;
const LICENSE_FORCED_GAP_MS = 60 * 1000;   // install/update: skip only if one just ran
let licenseCheck = null;

function recheckLicense(force = false, reason = 'startup') {
    if (licenseCheck) {
        // One request at a time. A forced check that arrives while a throttled
        // one is running re-runs only if that one did not reach the server.
        return force
            ? licenseCheck.then(r => (r === 'checked' ? r : recheckLicense(true, reason)))
            : licenseCheck;
    }
    const run = (async () => {
        try {
            const { licenseKey } = await chrome.storage.sync.get('licenseKey');
            if (!licenseKey) return 'no-key';
            const { licenseCheckedAt = 0 } = await chrome.storage.local.get('licenseCheckedAt');
            const age = Date.now() - (Number(licenseCheckedAt) || 0);
            const minGap = force ? LICENSE_FORCED_GAP_MS : LICENSE_RECHECK_MS;
            if (age >= 0 && age < minGap) return 'fresh';
            await chrome.storage.local.set({ licenseCheckedAt: Date.now() });
            await verifyLicense(licenseKey, true);
            console.log('[Zovo] License re-checked on', reason);
            return 'checked';
        } catch (error) {
            console.debug('[Zovo] License re-check skipped:', error.message);
            return 'error';
        }
    })();
    licenseCheck = run;
    run.finally(() => { if (licenseCheck === run) licenseCheck = null; });
    return run;
}

// Initialize on startup
async function initializeExtension() {
    await initDB();

    // Process queued paywall events
    try {
        const result = await processPaywallQueue();
        if (result.processed > 0) {
            console.log(`[Zovo] Processed ${result.processed} queued paywall events`);
        }
    } catch (error) {
        console.debug('[Zovo] Queue processing skipped:', error.message);
    }

    // Periodic Pro re-check: runs on worker start, at most once a day.
    await recheckLicense(false, 'startup');
}

initializeExtension().catch(console.error);


/* Zovo onboarding opener (appended, safe) */
try{chrome.runtime.onInstalled.addListener(function(d){try{if(d&&d.reason==='install'){chrome.tabs.create({url:chrome.runtime.getURL('zovo-onboarding-tsp/onboarding.html')});}}catch(e){}});}catch(e){}

// Membership invitations now appear only during voluntary popup use.
