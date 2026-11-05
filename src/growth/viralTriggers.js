/**
 * Viral Triggers System
 * Agent 2: Natural share triggers throughout user journey
 * Prompt 14: Growth & Viral Engine
 */

class ViralTriggers {
    constructor() {
        this.triggers = new Map();
        this.cooldowns = new Map();
        this.registerTriggers();
    }

    /**
     * Register all viral trigger conditions
     */
    registerTriggers() {
        // First clip trigger
        this.triggers.set('first_clip', {
            condition: (state) => state.clipCount === 1,
            message: () => ({
                title: 'Your first clip saved!',
                body: 'Never lose copied text again. Know someone who could use this?',
                cta: 'Share with a Friend',
                type: 'toast',
            }),
            cooldown: null, // One-time
        });

        // 10 clips milestone
        this.triggers.set('milestone_10', {
            condition: (state) => state.clipCount === 10,
            message: () => ({
                title: '10 Clips Saved!',
                body: 'You\'re getting value! Help others save time too.',
                cta: 'Invite Friends',
                type: 'modal',
                reward: 'Get 7 days of Pro for each friend who joins',
            }),
            cooldown: null, // One-time
        });

        // 100 clips milestone
        this.triggers.set('milestone_100', {
            condition: (state) => state.clipCount === 100,
            message: (state) => ({
                title: 'Power User Status!',
                body: `100 clips saved! You've likely saved ${Math.round(state.clipCount * 0.5)} minutes.`,
                cta: 'Share Your Achievement',
                type: 'celebration',
                shareable: {
                    text: `I just saved my 100th clip with Clipboard History Pro! 🎉 Never lose copied text again.`,
                },
            }),
            cooldown: null, // One-time
        });

        // Weekly usage trigger
        this.triggers.set('weekly_power_user', {
            condition: (state) => state.weeklyClips >= 20 && state.consecutiveWeeks >= 2,
            message: () => ({
                title: 'You\'re a Power User!',
                body: 'You use Clipboard History Pro every week. Your team might benefit too.',
                cta: 'Invite Your Team',
                type: 'subtle',
            }),
            cooldown: 14 * 24 * 60 * 60 * 1000, // 2 weeks
        });

        // Search success trigger
        this.triggers.set('search_found', {
            condition: (state) => state.searchJustFound && state.searchCount >= 5,
            message: () => ({
                title: 'Found it!',
                body: 'Search just saved you time. Know others who lose clipboard content?',
                cta: 'Share the Solution',
                type: 'inline',
            }),
            cooldown: 7 * 24 * 60 * 60 * 1000, // Weekly
        });

        // Pro trial ending
        this.triggers.set('trial_ending', {
            condition: (state) => state.trialDaysLeft <= 2 && state.trialDaysLeft > 0,
            message: () => ({
                title: 'Extend Your Pro Trial',
                body: 'Invite a friend and get 7 more days of Pro features free!',
                cta: 'Invite to Extend',
                type: 'modal',
                urgent: true,
            }),
            cooldown: 24 * 60 * 60 * 1000, // Daily
        });

        // After upgrade
        this.triggers.set('just_upgraded', {
            condition: (state) => state.justUpgraded,
            message: () => ({
                title: 'Welcome to Pro!',
                body: 'Thanks for upgrading! Share the love and give friends 7 days free.',
                cta: 'Share Pro Trial',
                type: 'modal',
                reward: 'You\'ll earn 7 days extra for each friend',
            }),
            cooldown: null, // One-time
        });
    }

    /**
     * Check all triggers against current state
     */
    async checkTriggers(userState) {
        const firedTriggers = [];

        for (const [triggerId, trigger] of this.triggers) {
            if (this.shouldFire(triggerId, trigger, userState)) {
                const message = trigger.message(userState);
                firedTriggers.push({ triggerId, message });

                // Set cooldown
                if (trigger.cooldown !== null) {
                    this.cooldowns.set(triggerId, Date.now());
                } else {
                    // One-time trigger - mark as fired
                    await this.markFired(triggerId);
                }
            }
        }

        return firedTriggers;
    }

    /**
     * Check if trigger should fire
     */
    shouldFire(triggerId, trigger, userState) {
        // Check condition
        if (!trigger.condition(userState)) return false;

        // Check if already fired (one-time triggers)
        if (trigger.cooldown === null && this.hasFired(triggerId)) return false;

        // Check cooldown
        if (trigger.cooldown) {
            const lastFired = this.cooldowns.get(triggerId);
            if (lastFired && Date.now() - lastFired < trigger.cooldown) return false;
        }

        return true;
    }

    /**
     * Check if one-time trigger has fired
     */
    async hasFired(triggerId) {
        const { firedTriggers } = await chrome.storage.local.get('firedTriggers');
        return (firedTriggers || []).includes(triggerId);
    }

    /**
     * Mark trigger as fired
     */
    async markFired(triggerId) {
        const { firedTriggers } = await chrome.storage.local.get('firedTriggers');
        const fired = firedTriggers || [];
        fired.push(triggerId);
        await chrome.storage.local.set({ firedTriggers: fired });
    }

    /**
     * Get current user state for trigger checking
     */
    async getCurrentState() {
        const { clips, settings, license } = await chrome.storage.local.get([
            'clips', 'settings', 'license'
        ]);

        const clipCount = (clips || []).length;

        return {
            clipCount,
            weeklyClips: await this.getWeeklyClipCount(),
            consecutiveWeeks: await this.getConsecutiveWeeks(),
            searchCount: await this.getSearchCount(),
            searchJustFound: false, // Set by search action
            trialDaysLeft: this.getTrialDaysLeft(license),
            justUpgraded: false, // Set by upgrade action
        };
    }

    /**
     * Display trigger message
     */
    displayTrigger(trigger) {
        const { triggerId, message } = trigger;

        switch (message.type) {
            case 'toast':
                this.showToast(message);
                break;
            case 'modal':
                this.showModal(message);
                break;
            case 'celebration':
                this.showCelebration(message);
                break;
            case 'subtle':
                this.showSubtle(message);
                break;
            case 'inline':
                this.showInline(message);
                break;
        }
    }

    showToast(message) {
        // Implement toast notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-128.png',
            title: message.title,
            message: message.body,
        });
    }

    showModal(message) {
        // Implementation would integrate with popup UI
        console.log('[ViralTrigger] Modal:', message);
    }

    showCelebration(message) {
        // Implementation with confetti/animation
        console.log('[ViralTrigger] Celebration:', message);
    }

    showSubtle(message) {
        // Implementation as subtle badge in UI
        console.log('[ViralTrigger] Subtle:', message);
    }

    showInline(message) {
        // Implementation as inline prompt
        console.log('[ViralTrigger] Inline:', message);
    }

    // Helper methods
    async getWeeklyClipCount() {
        const { clips } = await chrome.storage.local.get('clips');
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return (clips || []).filter(c => c.timestamp > weekAgo).length;
    }

    async getConsecutiveWeeks() {
        const { usageWeeks } = await chrome.storage.local.get('usageWeeks');
        return usageWeeks || 0;
    }

    async getSearchCount() {
        const { searchCount } = await chrome.storage.local.get('searchCount');
        return searchCount || 0;
    }

    getTrialDaysLeft(license) {
        if (!license?.trialEnd) return 0;
        const daysLeft = Math.ceil((license.trialEnd - Date.now()) / (24 * 60 * 60 * 1000));
        return Math.max(0, daysLeft);
    }
}

// Create singleton
const viralTriggers = new ViralTriggers();

// ES6 Export
export { ViralTriggers, viralTriggers };
