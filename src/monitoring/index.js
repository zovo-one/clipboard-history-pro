/**
 * Monitoring Index - Unified Export
 * Agent 5: Central monitoring module
 * Prompt 11: Production-grade monitoring
 */

// Import all monitoring modules
// Note: In Chrome extension context, these are loaded as separate scripts

/**
 * Monitoring facade for easy access
 */
const Monitoring = {
    // Will be populated when individual modules are loaded
    errorTracker: null,
    analytics: null,
    performance: null,
    debug: null,

    /**
     * Initialize all monitoring systems
     */
    async init(config = {}) {
        console.log('[Monitoring] Initializing all systems...');

        // Error tracking
        if (typeof ErrorTracker !== 'undefined') {
            this.errorTracker = new ErrorTracker(config.errorTracker || {});
        }

        // Analytics
        if (typeof ExtensionAnalytics !== 'undefined') {
            this.analytics = new ExtensionAnalytics(config.analytics || {});
        }

        // Performance
        if (typeof PerformanceMonitor !== 'undefined') {
            this.performance = new PerformanceMonitor();
        }

        // Debug mode
        if (typeof DebugMode !== 'undefined') {
            this.debug = new DebugMode();
        }

        console.log('[Monitoring] All systems initialized');
    },

    /**
     * Track an event
     */
    track(eventName, properties = {}) {
        if (this.analytics) {
            this.analytics.track(eventName, properties);
        }
    },

    /**
     * Capture an error
     */
    captureError(error, context = {}) {
        if (this.errorTracker) {
            this.errorTracker.captureException(error, context);
        }
    },

    /**
     * Start a performance timer
     */
    startTimer(operationName) {
        if (this.performance) {
            return this.performance.startTimer(operationName);
        }
        return () => 0;
    },

    /**
     * Get full monitoring report
     */
    async getFullReport() {
        const report = {
            timestamp: Date.now(),
            version: chrome?.runtime?.getManifest()?.version || '1.0.0',
        };

        if (this.errorTracker) {
            report.errors = await this.errorTracker.getErrorReport();
        }

        if (this.analytics) {
            report.analytics = await this.analytics.getAnalyticsSummary();
        }

        if (this.performance) {
            report.performance = await this.performance.getReport();
            report.health = await this.performance.getHealthStatus();
        }

        if (this.debug) {
            report.debug = await this.debug.getDebugReport();
        }

        return report;
    },

    /**
     * Clear all monitoring data
     */
    async clearAll() {
        if (this.errorTracker) await this.errorTracker.clearErrorLog();
        if (this.analytics) await this.analytics.clearHistory();
        if (this.performance) await this.performance.clearMetrics();
        if (this.debug) await this.debug.clearAll();

        console.log('[Monitoring] All data cleared');
    },

    /**
     * Export monitoring data
     */
    async export() {
        const report = await this.getFullReport();
        const blob = new Blob([JSON.stringify(report, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const filename = `monitoring-report-${Date.now()}.json`;

        try {
            if (chrome.downloads) {
                await chrome.downloads.download({
                    url,
                    filename,
                    saveAs: true
                });
            } else {
                window.open(url);
            }
        } catch {
            window.open(url);
        }

        return report;
    }
};

// Export for both module and global contexts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Monitoring };
}

if (typeof window !== 'undefined') {
    window.Monitoring = Monitoring;
}
