/**
 * Extension Analytics - Custom Event Tracking
 * Agent 2: Privacy-respecting analytics system
 * Prompt 11: Production-grade monitoring
 */

class ExtensionAnalytics {
    constructor(config = {}) {
        this.endpoint = config.endpoint || null;
        this.batchSize = config.batchSize || 20;
        this.queue = [];
        this.sessionId = this.generateSessionId();
        this.instanceId = null;
        this.version = this.getVersion();

        this.init();
    }

    getVersion() {
        try {
            return chrome.runtime.getManifest().version;
        } catch {
            return '1.0.0';
        }
    }

    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    async init() {
        // Get or create persistent instance ID
        try {
            const { analyticsInstanceId } = await chrome.storage.local.get('analyticsInstanceId');
            if (analyticsInstanceId) {
                this.instanceId = analyticsInstanceId;
            } else {
                this.instanceId = crypto.randomUUID();
                await chrome.storage.local.set({ analyticsInstanceId: this.instanceId });
            }
        } catch {
            this.instanceId = crypto.randomUUID();
        }

        // Set up periodic flush
        this.setupFlushAlarm();

        // Track session start
        this.track('session_start', {
            version: this.version,
            firstSession: !this.instanceId
        });

        console.log('[Analytics] Initialized, instance:', this.instanceId?.slice(0, 8));
    }

    setupFlushAlarm() {
        try {
            chrome.alarms.create('analytics-flush', { periodInMinutes: 1 });
            chrome.alarms.onAlarm.addListener((alarm) => {
                if (alarm.name === 'analytics-flush') {
                    this.flush();
                }
            });
        } catch {
            setInterval(() => this.flush(), 60000);
        }
    }

    /**
     * Track an event with properties
     * @param {string} eventName - Name of the event
     * @param {object} properties - Event properties (no PII)
     */
    track(eventName, properties = {}) {
        const event = {
            event: eventName,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            instanceId: this.instanceId,
            properties: this.sanitizeProperties(properties),
            context: {
                version: this.version,
                platform: navigator.platform,
                language: navigator.language,
            }
        };

        this.queue.push(event);
        this.persistQueue();

        if (this.queue.length >= this.batchSize) {
            this.flush();
        }
    }

    /**
     * Track feature usage
     */
    trackFeature(featureName, metadata = {}) {
        this.track('feature_used', {
            feature: featureName,
            ...metadata
        });
    }

    /**
     * Track Pro tier conversion funnel
     */
    trackConversion(step, metadata = {}) {
        this.track('conversion_funnel', {
            step,
            ...metadata
        });
    }

    /**
     * Track paywall hit
     */
    trackPaywallHit(feature) {
        this.track('paywall_hit', {
            feature,
            tier: 'free'
        });
    }

    /**
     * Track performance metric
     */
    trackPerformance(metric, value, unit = 'ms') {
        this.track('performance', {
            metric,
            value,
            unit
        });
    }

    /**
     * Remove sensitive data from properties
     */
    sanitizeProperties(props) {
        const sanitized = {};
        const sensitiveKeys = ['password', 'token', 'secret', 'email', 'api_key', 'license'];

        for (const [key, value] of Object.entries(props)) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                continue;
            }

            if (typeof value === 'string') {
                sanitized[key] = this.truncate(value, 100);
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                sanitized[key] = value;
            } else if (Array.isArray(value)) {
                sanitized[key] = value.length; // Just store count
            }
        }

        return sanitized;
    }

    truncate(str, maxLength) {
        if (str.length <= maxLength) return str;
        return str.slice(0, maxLength) + '...';
    }

    async persistQueue() {
        try {
            await chrome.storage.local.set({ analyticsQueue: this.queue.slice(-100) });
        } catch {
            // Silent fail
        }
    }

    async flush() {
        if (this.queue.length === 0) return;

        const events = [...this.queue];
        this.queue = [];

        // Store locally for analytics dashboard
        try {
            const { analyticsHistory } = await chrome.storage.local.get('analyticsHistory');
            const history = analyticsHistory || [];

            await chrome.storage.local.set({
                analyticsHistory: [...history.slice(-200), ...events],
                analyticsLastFlush: Date.now()
            });
        } catch {
            // Silent fail
        }

        // If endpoint configured, send to server
        if (this.endpoint) {
            try {
                await fetch(this.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        events,
                        batchId: crypto.randomUUID(),
                        sentAt: Date.now()
                    })
                });
            } catch {
                // Re-queue on failure
                this.queue = [...events.slice(-10), ...this.queue];
            }
        }
    }

    /**
     * Get analytics summary for debugging
     */
    async getAnalyticsSummary() {
        const { analyticsHistory, analyticsLastFlush } = await chrome.storage.local.get([
            'analyticsHistory', 'analyticsLastFlush'
        ]);

        const history = analyticsHistory || [];

        // Aggregate events by name
        const eventCounts = {};
        history.forEach(e => {
            eventCounts[e.event] = (eventCounts[e.event] || 0) + 1;
        });

        return {
            totalEvents: history.length,
            eventCounts,
            lastFlush: analyticsLastFlush,
            sessionId: this.sessionId,
            instanceId: this.instanceId,
            queueLength: this.queue.length,
        };
    }

    /**
     * Clear analytics history
     */
    async clearHistory() {
        this.queue = [];
        await chrome.storage.local.remove([
            'analyticsHistory',
            'analyticsQueue',
            'analyticsLastFlush'
        ]);
    }
}

// Create singleton
const analytics = new ExtensionAnalytics({
    endpoint: null,
    batchSize: 20
});

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExtensionAnalytics, analytics };
}
