/**
 * Clipboard History Pro - Payment Integration Index
 * Agent 5: Main exports for easy integration
 */

// Re-export all payment functions
export {
    verifyLicense,
    hasFeature,
    isPro,
    getTier,
    logPaywallHit,
    trackEvent,
    openUpgradePage,
    clearLicenseCache
} from './payments.js';

// Re-export paywall UI
export { showPaywall, showLicenseInput } from './paywall.js';

// Re-export features registry
export {
    CLIPBOARD_PRO_FEATURES,
    FEATURE_LABELS,
    FREE_LIMITS,
    PRO_LIMITS
} from './features.js';

// Re-export gating utilities
export {
    getLimits,
    canPerformAction,
    requireFeature,
    canExport,
    withProFeature
} from './gating.js';

/**
 * Initialize payment system on extension load
 * Call this from background.js on install
 */
export async function initPaymentSystem() {
    // Check for stored license key
    const stored = await chrome.storage.sync.get('licenseKey');
    if (stored.licenseKey) {
        const { verifyLicense } = await import('./payments.js');
        await verifyLicense(stored.licenseKey);
    }

    // Set uninstall URL for feedback
    chrome.runtime.setUninstallURL('https://zovo.one/feedback/uninstall/clipboard_history_pro');

    console.log('[Zovo] Payment system initialized');
}

/**
 * Quick Pro check for popup/UI
 */
export async function getProStatus() {
    const { isPro, getTier } = await import('./payments.js');
    return {
        isPro: await isPro(),
        tier: await getTier()
    };
}
