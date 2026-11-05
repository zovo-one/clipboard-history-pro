/**
 * Growth Engine Index
 * Agent 5: Unified growth module exports
 * Prompt 14: Growth & Viral Engine
 */

// Import all growth modules
// Note: In Chrome extension context, these are loaded as separate scripts

/**
 * Growth Engine facade for easy access
 */
const GrowthEngine = {
    // Will be populated when modules load
    referral: null,
    triggers: null,
    content: null,
    dashboard: null,

    /**
     * Initialize growth engine
     */
    async init() {
        console.log('[GrowthEngine] Initializing...');

        // Initialize referral system
        if (typeof ReferralSystem !== 'undefined') {
            this.referral = new ReferralSystem();
        }

        // Initialize viral triggers
        if (typeof ViralTriggers !== 'undefined') {
            this.triggers = new ViralTriggers();
        }

        // Initialize share content
        if (typeof ShareContentGenerator !== 'undefined') {
            this.content = new ShareContentGenerator();
        }

        // Initialize dashboard
        if (typeof ReferralDashboard !== 'undefined' && this.referral) {
            this.dashboard = new ReferralDashboard(this.referral);
        }

        console.log('[GrowthEngine] Initialized');
    },

    /**
     * Get referral link for current user
     */
    async getReferralLink() {
        if (!this.referral) return null;
        const code = await this.referral.generateReferralCode();
        return this.referral.getReferralLinks(code).standard;
    },

    /**
     * Check and fire viral triggers
     */
    async checkTriggers() {
        if (!this.triggers) return [];
        const state = await this.triggers.getCurrentState();
        return this.triggers.checkTriggers(state);
    },

    /**
     * Generate share content for platform
     */
    getShareContent(platform, context = {}) {
        if (!this.content) return null;
        return this.content[platform]?.(context.referralLink, context);
    },

    /**
     * Render referral dashboard
     */
    async renderDashboard() {
        if (!this.dashboard) return '';
        return this.dashboard.render();
    },

    /**
     * Track user action for triggers
     */
    async trackAction(action, data = {}) {
        console.log('[GrowthEngine] Tracking:', action, data);

        // Store action for trigger state
        const { actionCounts } = await chrome.storage.local.get('actionCounts');
        const counts = actionCounts || {};
        counts[action] = (counts[action] || 0) + 1;
        await chrome.storage.local.set({ actionCounts: counts });

        // Check triggers after action
        const triggers = await this.checkTriggers();

        // Display any fired triggers
        for (const trigger of triggers) {
            this.triggers?.displayTrigger(trigger);
        }

        return triggers;
    },

    /**
     * Get growth stats
     */
    async getStats() {
        if (!this.referral) return null;
        return this.referral.getReferralStats();
    },

    /**
     * Share on platform
     */
    async shareOn(platform) {
        const referralLink = await this.getReferralLink();
        if (!referralLink) return;

        if (this.referral) {
            this.referral.shareOnPlatform(platform, referralLink);
        }
    },

    /**
     * Copy referral link
     */
    async copyReferralLink() {
        const link = await this.getReferralLink();
        if (link && this.referral) {
            await this.referral.copyReferralLink(link);
            return true;
        }
        return false;
    },
};

// Auto-initialize
if (typeof chrome !== 'undefined' && chrome.runtime) {
    GrowthEngine.init();
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GrowthEngine };
}

if (typeof window !== 'undefined') {
    window.GrowthEngine = GrowthEngine;
}
