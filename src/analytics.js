// Clipboard History Pro - Analytics Module
// Local-only tracking for conversion optimization

const ANALYTICS_KEY = 'chp_analytics';
const MAX_EVENTS = 500;

class Analytics {
    constructor() {
        this.queue = [];
        this.sessionId = this.generateSessionId();
    }

    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Track event locally
    async track(eventName, properties = {}) {
        const event = {
            event: eventName,
            properties: {
                ...properties,
                session_id: this.sessionId,
                extension_version: chrome.runtime.getManifest().version
            },
            timestamp: Date.now()
        };

        // Get existing events
        const { [ANALYTICS_KEY]: events = [] } = await chrome.storage.local.get(ANALYTICS_KEY);

        // Add new event
        events.push(event);

        // Trim to max size
        if (events.length > MAX_EVENTS) {
            events.splice(0, events.length - MAX_EVENTS);
        }

        // Save
        await chrome.storage.local.set({ [ANALYTICS_KEY]: events });
    }

    // Get all events
    async getEvents() {
        const { [ANALYTICS_KEY]: events = [] } = await chrome.storage.local.get(ANALYTICS_KEY);
        return events;
    }

    // Get events by name
    async getEventsByName(eventName) {
        const events = await this.getEvents();
        return events.filter(e => e.event === eventName);
    }

    // Get funnel metrics
    async getFunnelMetrics() {
        const events = await this.getEvents();

        return {
            installs: events.filter(e => e.event === 'extension_installed').length,
            clipsSaved: events.filter(e => e.event === 'clip_saved').length,
            searchesPerformed: events.filter(e => e.event === 'search_performed').length,
            paywallsShown: events.filter(e => e.event === 'paywall_shown').length,
            upgradeClicks: events.filter(e => e.event === 'upgrade_clicked').length,
            upgradesCompleted: events.filter(e => e.event === 'upgrade_completed').length
        };
    }

    // Clear old events
    async clearOldEvents(daysToKeep = 30) {
        const events = await this.getEvents();
        const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        const filtered = events.filter(e => e.timestamp > cutoff);
        await chrome.storage.local.set({ [ANALYTICS_KEY]: filtered });
    }
}

// Event constants for consistency
const EVENTS = {
    // Install & activation
    EXTENSION_INSTALLED: 'extension_installed',
    ONBOARDING_COMPLETED: 'onboarding_completed',

    // Core usage
    CLIP_SAVED: 'clip_saved',
    CLIP_COPIED: 'clip_copied',
    CLIP_STARRED: 'clip_starred',
    CLIP_PINNED: 'clip_pinned',
    CLIP_DELETED: 'clip_deleted',
    SEARCH_PERFORMED: 'search_performed',
    FILTER_APPLIED: 'filter_applied',

    // Limits & paywall
    LIMIT_REACHED: 'limit_reached',
    PAYWALL_SHOWN: 'paywall_shown',
    PAYWALL_DISMISSED: 'paywall_dismissed',

    // Upgrade flow
    UPGRADE_CLICKED: 'upgrade_clicked',
    UPGRADE_STARTED: 'upgrade_started',
    UPGRADE_COMPLETED: 'upgrade_completed',

    // Retention
    RETENTION_PROMPT_SHOWN: 'retention_prompt_shown',
    RETENTION_PROMPT_CLICKED: 'retention_prompt_clicked',
    RATING_REQUESTED: 'rating_requested'
};

// Export for use in other modules
window.Analytics = new Analytics();
window.EVENTS = EVENTS;
