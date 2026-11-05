/**
 * Referral System
 * Agent 1: Core referral engine for Clipboard History Pro
 * Prompt 14: Growth & Viral Engine
 */

class ReferralSystem {
    constructor() {
        this.REFERRAL_PREFIX = 'CHP_';
        this.COOKIE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    /**
     * Generate unique referral code for user
     */
    async generateReferralCode() {
        // Check if user already has a code
        const { referralCode } = await chrome.storage.local.get('referralCode');
        if (referralCode) return referralCode;

        // Generate new code
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        const instanceId = await this.getInstanceId();
        const code = `${this.REFERRAL_PREFIX}${instanceId.slice(0, 6)}_${timestamp}${random}`;

        // Store code
        await chrome.storage.local.set({ referralCode: code });
        return code;
    }

    /**
     * Get or create instance ID
     */
    async getInstanceId() {
        const { instanceId } = await chrome.storage.local.get('instanceId');
        if (instanceId) return instanceId;

        const newId = crypto.randomUUID();
        await chrome.storage.local.set({ instanceId: newId });
        return newId;
    }

    /**
     * Generate shareable referral links for different channels
     */
    getReferralLinks(referralCode) {
        const baseUrl = 'https://zovo.one/clipboard-history-pro';
        const storeUrl = 'https://chrome.google.com/webstore/detail/clipboard-history-pro';

        return {
            standard: `${baseUrl}?ref=${referralCode}`,
            chromeStore: `${storeUrl}?ref=${referralCode}`,
            twitter: `${baseUrl}?ref=${referralCode}&utm_source=twitter&utm_medium=social`,
            linkedin: `${baseUrl}?ref=${referralCode}&utm_source=linkedin&utm_medium=social`,
            email: `${baseUrl}?ref=${referralCode}&utm_source=email&utm_medium=share`,
            reddit: `${baseUrl}?ref=${referralCode}&utm_source=reddit&utm_medium=social`,
        };
    }

    /**
     * Track referral installation
     */
    async trackReferralInstall(referralCode) {
        if (!referralCode || !referralCode.startsWith(this.REFERRAL_PREFIX)) {
            return { success: false, error: 'Invalid referral code' };
        }

        // Store that this user was referred
        await chrome.storage.local.set({
            referredBy: referralCode,
            referralTimestamp: Date.now(),
        });

        return { success: true };
    }

    /**
     * Get referral stats for current user
     */
    async getReferralStats() {
        const { referralStats } = await chrome.storage.local.get('referralStats');

        return referralStats || {
            totalReferred: 0,
            qualifiedReferrals: 0,
            proDaysEarned: 0,
            tier: 'starter',
        };
    }

    /**
     * Get reward tier based on referral count
     */
    getRewardTier(referralCount) {
        if (referralCount >= 50) {
            return { referrer: 14, referred: 7, tier: 'platinum', badge: '💎' };
        } else if (referralCount >= 20) {
            return { referrer: 10, referred: 5, tier: 'gold', badge: '🥇' };
        } else if (referralCount >= 5) {
            return { referrer: 7, referred: 3, tier: 'silver', badge: '🥈' };
        } else {
            return { referrer: 7, referred: 3, tier: 'bronze', badge: '🥉' };
        }
    }

    /**
     * Get milestone bonuses
     */
    getMilestone(referralCount) {
        const milestones = [
            { count: 10, reward: 30, label: '1 month Pro' },
            { count: 25, reward: 90, label: '3 months Pro' },
            { count: 50, reward: 180, label: '6 months Pro' },
            { count: 100, reward: 'lifetime', label: 'Lifetime Pro' },
        ];

        return milestones.find(m => referralCount >= m.count) || null;
    }

    /**
     * Generate share content for different platforms
     */
    getShareContent(referralLink, platform) {
        const templates = {
            twitter: `I use Clipboard History Pro so I never lose copied text again. It's saved me hours of hunting around. Try it free: ${referralLink}`,

            linkedin: `Clipboard History Pro has changed how I work. I can search my whole clipboard history, pin the things I reuse, and paste them back in one click. Big time saver if you copy a lot of text. ${referralLink}`,

            email: {
                subject: 'Check out this clipboard manager',
                body: `Hey,\n\nI've been using Clipboard History Pro and thought you might find it handy. It saves everything you copy, so you never lose important text again.\n\nYou can try it here: ${referralLink}\n\nLet me know what you think.`,
            },

            reddit: `Clipboard History Pro, so you never lose copied text again. Search your history, pin favorites, paste it straight back. Free tier available. ${referralLink}`,
        };

        return templates[platform] || templates.twitter;
    }

    /**
     * Open share dialog for platform
     */
    shareOnPlatform(platform, referralLink) {
        const content = this.getShareContent(referralLink, platform);

        const shareUrls = {
            twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(content)}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`,
            reddit: `https://reddit.com/submit?url=${encodeURIComponent(referralLink)}&title=${encodeURIComponent('Clipboard History Pro, never lose copied text again')}`,
        };

        if (platform === 'email') {
            window.location.href = `mailto:?subject=${encodeURIComponent(content.subject)}&body=${encodeURIComponent(content.body)}`;
        } else if (shareUrls[platform]) {
            chrome.tabs.create({ url: shareUrls[platform] });
        }
    }

    /**
     * Copy referral link to clipboard
     */
    async copyReferralLink(referralLink) {
        await navigator.clipboard.writeText(referralLink);
        return true;
    }
}

// Create singleton
const referralSystem = new ReferralSystem();

// ES6 Export
export { ReferralSystem, referralSystem };
