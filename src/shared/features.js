/**
 * Clipboard History Pro - Pro Features Definition
 * Agent 3: Feature registry for backend sync
 */

// These features must match PRODUCT_FEATURES in stripe-webhook/index.ts
export const CLIPBOARD_PRO_FEATURES = [
    'unlimited_clips',        // 10,000+ clip history
    'unlimited_starred',      // Unlimited starred clips
    'unlimited_pinned',       // Unlimited pinned clips
    'export_all_formats',     // CSV, JSON, TXT export
    'floating_widget',        // Always-on-top quick paste
    'text_expander',          // Unlimited text snippets
    'password_protection',    // Lock sensitive clips
    'mobile_sync',            // Cross-device sync
    'advanced_search',        // Regex and filters
    'bulk_operations',        // Bulk delete, export
    'priority_support'        // Priority email support
];

// Feature display names for UI
export const FEATURE_LABELS = {
    unlimited_clips: '10,000+ Clip History',
    unlimited_starred: 'Unlimited Stars',
    unlimited_pinned: 'Unlimited Pins',
    export_all_formats: 'Export CSV/JSON/TXT',
    floating_widget: 'Floating Widget',
    text_expander: 'Text Expander',
    password_protection: 'Password Protection',
    mobile_sync: 'Mobile Sync',
    advanced_search: 'Advanced Search',
    bulk_operations: 'Bulk Operations',
    priority_support: 'Priority Support'
};

// Free tier limits
export const FREE_LIMITS = {
    maxClips: 100,
    maxStarred: 10,
    maxPinned: 5,
    maxSnippets: 3,
    exportFormats: []  // No export for free tier
};

// Pro tier limits. MAX_SAFE_INTEGER (not Infinity): Infinity serializes to null
// over chrome.runtime.sendMessage, which breaks popup-side "count >= max" checks.
export const PRO_LIMITS = {
    maxClips: 10000,
    maxStarred: Number.MAX_SAFE_INTEGER,
    maxPinned: Number.MAX_SAFE_INTEGER,
    maxSnippets: Number.MAX_SAFE_INTEGER,
    exportFormats: ['csv', 'json', 'txt']
};

export default {
    CLIPBOARD_PRO_FEATURES,
    FEATURE_LABELS,
    FREE_LIMITS,
    PRO_LIMITS
};
