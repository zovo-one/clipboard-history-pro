// Clipboard History Pro - Tier Manager
// Manages Pro tier logic based on feature value analysis
// Scoring: Acquisition(25%) + Habit(20%) + Upgrade(25%) + Differentiation(15%) + Cost(15%)

/**
 * PROMPT 03: Feature Value Scoring (5 Dimensions)
 * Rule: 35+=FREE, 25-34=LIMITED, 15-24=PRO, <15=cut
 */
const FEATURE_SCORES = {
    // Feature: [Acquisition, Habit, Upgrade, Differentiation, Cost] => Total
    clipHistory: [10, 10, 8, 6, 10],  // 44 → FREE (core)
    search: [8, 9, 3, 5, 10],    // 35 → FREE 
    typeDetection: [6, 7, 2, 9, 10],    // 34 → FREE (differentiator)
    keyboardShortcuts: [5, 9, 3, 5, 10],    // 32 → FREE (habit)
    starred: [4, 7, 8, 4, 10],    // 33 → LIMITED (10)
    pinned: [3, 6, 7, 4, 10],    // 30 → LIMITED (5)
    textExpander: [5, 8, 9, 7, 10],    // 39 → LIMITED (3 free) - high upgrade
    floatingWidget: [4, 6, 9, 8, 10],    // 37 → PRO (high upgrade trigger)
    passwordLock: [3, 4, 8, 7, 10],    // 32 → PRO (security premium)
    mobileSync: [6, 5, 10, 6, 3],    // 30 → PRO (#1 upgrade driver)
    export: [2, 3, 9, 4, 10],    // 28 → PRO
    bulkOperations: [2, 4, 7, 5, 10],    // 28 → PRO
};

// Calculate weighted score
function getFeatureScore(scores) {
    const weights = [0.25, 0.20, 0.25, 0.15, 0.15];
    return scores.reduce((sum, s, i) => sum + (s * weights[i] * 10), 0);
}

const TIER_CONFIG = {
    free: {
        name: 'Free',
        limits: {
            maxClips: 100,           // Competitor uses 100 limit
            maxStarred: 10,          // Limited to drive upgrade
            maxPinned: 5,            // Limited to drive upgrade  
            maxSnippets: 3,          // Text expander: 3 free (competitor pattern)
            exportFormats: [],       // Export is Pro only
            syncEnabled: false       // Sync is #1 upgrade driver (LastPass pattern)
        },
        features: {
            search: true,            // Must be free (table stakes)
            typeDetection: true,     // Must be free (differentiator)
            keyboardShortcuts: true, // Must be free (habit forming)
            darkTheme: true,         // Must be free (expected)
            contextMenu: true,       // Must be free (convenience)
            // Visible but locked (Grammarly pattern)
            floatingWidget: 'preview',    // Show but lock
            passwordProtection: 'preview', // Show but lock
            textExpander: 'limited',       // 3 snippets free
            mobileSync: false              // Completely locked
        }
    },

    pro: {
        name: 'Pro',
        price: {
            monthly: 4.99,           // Matches live zovo.one checkout
            lifetime: 99.00          // One payment, all Zovo extensions
        },
        limits: {
            maxClips: 10000,         // Unlimited practical
            maxStarred: Infinity,
            maxPinned: Infinity,
            maxSnippets: Infinity,   // Unlimited text expander
            exportFormats: ['csv', 'json', 'txt'],
            syncEnabled: true
        },
        features: {
            search: true,
            typeDetection: true,
            keyboardShortcuts: true,
            darkTheme: true,
            contextMenu: true,
            // Pro-exclusive (research-validated)
            advancedSearch: true,      // Regex search
            bulkOperations: true,      // Delete all, export all
            customShortcuts: true,     // User-defined shortcuts
            floatingWidget: true,      // Always-on-top (competitor has this)
            passwordProtection: true,  // Lock clips (competitor has this)
            textExpander: true,        // Full text expander (competitor has this)
            mobileSync: true,          // Cross-device (competitor has this)
            clipboardWidget: true,     // Drag-drop widget (competitor has this)
            favSort: true,             // Reorder favorites (competitor has this)
            quickPaste: true           // Keyboard shortcuts for paste
        }
    }
};

class TierManager {
    constructor() {
        this.currentTier = 'free';
        this.usageCache = null;
    }

    // Get current tier from storage
    async getCurrentTier() {
        const { tier = 'free', proExpiry = 0 } = await chrome.storage.sync.get(['tier', 'proExpiry']);

        // Check if Pro has expired
        if (tier === 'pro' && proExpiry > 0 && Date.now() > proExpiry) {
            await this.downgradeToFree();
            return 'free';
        }

        this.currentTier = tier;
        return tier;
    }

    // Get limits for current tier
    getTierLimits(tier = null) {
        const t = tier || this.currentTier;
        return TIER_CONFIG[t]?.limits || TIER_CONFIG.free.limits;
    }

    // Get features for current tier
    getTierFeatures(tier = null) {
        const t = tier || this.currentTier;
        return TIER_CONFIG[t]?.features || TIER_CONFIG.free.features;
    }

    // Check if feature is available
    async isFeatureAvailable(featureName) {
        const tier = await this.getCurrentTier();
        const features = this.getTierFeatures(tier);
        return features[featureName] === true;
    }

    // Get usage counts
    async getUsageCounts() {
        const clips = await this.getAllClips();

        this.usageCache = {
            totalClips: clips.length,
            starredCount: clips.filter(c => c.starred).length,
            pinnedCount: clips.filter(c => c.pinned).length
        };

        return this.usageCache;
    }

    // Helper: get all clips (calls background)
    async getAllClips() {
        try {
            return await chrome.runtime.sendMessage({ action: 'GET_CLIPS' });
        } catch {
            return [];
        }
    }

    // Check if limit reached for specific type
    async isLimitReached(limitType) {
        const tier = await this.getCurrentTier();
        if (tier === 'pro') return false;

        const limits = this.getTierLimits('free');
        const usage = await this.getUsageCounts();

        switch (limitType) {
            case 'clips':
                return usage.totalClips >= limits.maxClips;
            case 'starred':
                return usage.starredCount >= limits.maxStarred;
            case 'pinned':
                return usage.pinnedCount >= limits.maxPinned;
            default:
                return false;
        }
    }

    // Get usage percentage
    async getUsagePercentage(limitType = 'clips') {
        const tier = await this.getCurrentTier();
        if (tier === 'pro') return 0;

        const limits = this.getTierLimits('free');
        const usage = await this.getUsageCounts();

        switch (limitType) {
            case 'clips':
                return (usage.totalClips / limits.maxClips) * 100;
            case 'starred':
                return (usage.starredCount / limits.maxStarred) * 100;
            case 'pinned':
                return (usage.pinnedCount / limits.maxPinned) * 100;
            default:
                return 0;
        }
    }

    // Upgrade to Pro
    async upgradeToPro(expiryTimestamp = null) {
        const expiry = expiryTimestamp || (Date.now() + 365 * 24 * 60 * 60 * 1000); // Default 1 year

        await chrome.storage.sync.set({
            tier: 'pro',
            proExpiry: expiry,
            upgradedAt: Date.now()
        });

        this.currentTier = 'pro';

        // Track upgrade
        if (window.Analytics) {
            window.Analytics.track(window.EVENTS.UPGRADE_COMPLETED, {
                plan: 'pro',
                expiry: new Date(expiry).toISOString()
            });
        }

        return true;
    }

    // Downgrade to Free
    async downgradeToFree() {
        await chrome.storage.sync.set({
            tier: 'free',
            proExpiry: 0
        });

        this.currentTier = 'free';
        return true;
    }

    // Verify Pro license (stub for future API integration)
    async verifyLicense() {
        // Future: Call Zovo API to verify subscription
        // For now, just check local storage
        const tier = await this.getCurrentTier();
        return tier === 'pro';
    }

    // Get pricing info
    getPricing() {
        return TIER_CONFIG.pro.price;
    }

    // Get upgrade URL - canonical checkout is zovo.one/pricing
    getUpgradeUrl(source = 'popup') {
        return `https://zovo.one/pricing?ref=clipboard-history-pro&source=${source}`;
    }
}

// Export singleton
window.TierManager = new TierManager();
window.TIER_CONFIG = TIER_CONFIG;
