// Clipboard History Pro - Retention System
// Smart prompts to drive ratings, referrals, and upgrades

class RetentionManager {
    constructor() {
        this.prompts = [
            {
                id: 'first_value',
                trigger: { clipCount: 5 },
                shown: false,
                title: 'You have saved 5 clips',
                message: 'Everything you copy is now searchable.',
                cta: null,
                dismissable: true
            },
            {
                id: 'rate_extension',
                trigger: { clipCount: 25 },
                title: 'Enjoying Clipboard History Pro?',
                message: 'A quick rating helps others discover this tool.',
                cta: {
                    text: 'Rate on Chrome Store',
                    url: 'https://chromewebstore.google.com/detail/ddmidpneacclepjmdjibmcdijedgdidf/reviews'
                },
                dismissable: true
            },
            {
                id: 'power_user',
                trigger: { clipCount: 50 },
                title: 'You have hit 50 clips',
                message: "That's 50 clips saved. Pro holds up to 10,000, so nothing drops off.",
                cta: {
                    text: 'See Pro features',
                    action: 'showUpgradeModal'
                },
                dismissable: true
            },
            {
                id: 'approaching_limit',
                trigger: { usagePercent: 80 },
                title: 'Running low on space',
                message: "You've used 80% of your free tier. Once it fills up, the oldest clips start dropping off.",
                cta: {
                    text: 'Upgrade for unlimited',
                    action: 'showUpgradeModal'
                },
                dismissable: true,
                style: 'warning'
            },
            {
                id: 'share_extension',
                trigger: { daysActive: 7 },
                title: 'Know someone who would like this?',
                message: 'Share Clipboard History Pro with a friend.',
                cta: {
                    text: 'Copy share link',
                    action: 'copyShareLink'
                },
                dismissable: true
            }
        ];
    }

    // Check if any prompt should be shown
    async checkPrompts(stats) {
        const { dismissedPrompts = [] } = await chrome.storage.local.get('dismissedPrompts');
        const { lastPromptTime = 0 } = await chrome.storage.local.get('lastPromptTime');

        // Don't show prompts too frequently (min 1 hour between)
        if (Date.now() - lastPromptTime < 3600000) {
            return null;
        }

        for (const prompt of this.prompts) {
            // Skip if already dismissed
            if (dismissedPrompts.includes(prompt.id)) continue;

            // Check trigger conditions
            if (this.shouldTrigger(prompt, stats)) {
                return prompt;
            }
        }

        return null;
    }

    // Check if prompt should trigger based on stats
    shouldTrigger(prompt, stats) {
        const { trigger } = prompt;

        if (trigger.clipCount && stats.totalClips >= trigger.clipCount) {
            return true;
        }

        if (trigger.usagePercent) {
            const percent = (stats.totalClips / stats.maxClips) * 100;
            if (percent >= trigger.usagePercent) {
                return true;
            }
        }

        if (trigger.daysActive && stats.daysActive >= trigger.daysActive) {
            return true;
        }

        return false;
    }

    // Dismiss a prompt
    async dismissPrompt(promptId) {
        const { dismissedPrompts = [] } = await chrome.storage.local.get('dismissedPrompts');

        if (!dismissedPrompts.includes(promptId)) {
            dismissedPrompts.push(promptId);
            await chrome.storage.local.set({ dismissedPrompts });
        }

        await chrome.storage.local.set({ lastPromptTime: Date.now() });
    }

    // Handle prompt CTA
    async handlePromptAction(prompt) {
        if (!prompt.cta) return;

        if (prompt.cta.url) {
            chrome.tabs.create({ url: prompt.cta.url });
        } else if (prompt.cta.action === 'showUpgradeModal') {
            return 'showUpgradeModal';
        } else if (prompt.cta.action === 'copyShareLink') {
            await navigator.clipboard.writeText(
                'https://chromewebstore.google.com/detail/ddmidpneacclepjmdjibmcdijedgdidf'
            );
            return 'copied';
        }
    }

    // Get days since install
    async getDaysActive() {
        const { installedAt } = await chrome.storage.local.get('installedAt');
        if (!installedAt) return 0;
        return Math.floor((Date.now() - installedAt) / (24 * 60 * 60 * 1000));
    }
}

// Export
window.RetentionManager = new RetentionManager();
