/**
 * Error Tracker - Crash Analytics & Monitoring
 * Agent 1: Core error tracking infrastructure
 * Prompt 11: Production-grade error tracking for Chrome Extensions
 */

class ErrorTracker {
    constructor(options = {}) {
        this.queue = [];
        this.maxQueueSize = options.maxQueueSize || 50;
        this.endpoint = options.endpoint || null;
        this.extensionId = chrome?.runtime?.id || 'unknown';
        this.version = this.getVersion();
        this.sessionId = this.generateSessionId();

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

    init() {
        // Global error handler for service worker
        if (typeof self !== 'undefined' && self.addEventListener) {
            self.addEventListener('error', (event) => {
                this.captureError({
                    type: 'uncaught_error',
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    stack: event.error?.stack,
                });
            });

            self.addEventListener('unhandledrejection', (event) => {
                this.captureError({
                    type: 'unhandled_rejection',
                    message: event.reason?.message || String(event.reason),
                    stack: event.reason?.stack,
                });
            });
        }

        // Window error handler for popup/options
        if (typeof window !== 'undefined') {
            window.onerror = (message, source, lineno, colno, error) => {
                this.captureError({
                    type: 'ui_error',
                    message,
                    source,
                    lineno,
                    colno,
                    stack: error?.stack,
                });
                return false;
            };

            window.onunhandledrejection = (event) => {
                this.captureError({
                    type: 'ui_promise_rejection',
                    message: event.reason?.message || String(event.reason),
                    stack: event.reason?.stack,
                });
            };
        }

        // Set up periodic flush with alarms
        this.setupFlushAlarm();

        console.log('[ErrorTracker] Initialized for', this.extensionId, 'v' + this.version);
    }

    setupFlushAlarm() {
        try {
            chrome.alarms.create('error-flush', { periodInMinutes: 0.5 });
            chrome.alarms.onAlarm.addListener((alarm) => {
                if (alarm.name === 'error-flush') {
                    this.flush();
                }
            });
        } catch (e) {
            // Fallback: use setInterval
            setInterval(() => this.flush(), 30000);
        }
    }

    captureError(errorData) {
        const enrichedError = {
            ...errorData,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            context: {
                extensionId: this.extensionId,
                version: this.version,
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
            }
        };

        this.queue.push(enrichedError);

        // Store in local storage for persistence
        this.persistQueue();

        if (this.queue.length >= this.maxQueueSize) {
            this.flush();
        }

        // Log in debug mode
        if (this.debugMode) {
            console.error('[ErrorTracker] Captured:', enrichedError);
        }
    }

    async persistQueue() {
        try {
            await chrome.storage.local.set({ errorQueue: this.queue.slice(-100) });
        } catch (e) {
            // Silent fail
        }
    }

    async loadPersistedQueue() {
        try {
            const { errorQueue } = await chrome.storage.local.get('errorQueue');
            if (errorQueue && errorQueue.length > 0) {
                this.queue = [...errorQueue, ...this.queue];
            }
        } catch (e) {
            // Silent fail
        }
    }

    async flush() {
        if (this.queue.length === 0) return;

        const errors = [...this.queue];
        this.queue = [];

        // Store locally
        await chrome.storage.local.set({
            crashLog: errors,
            crashLogTimestamp: Date.now()
        });

        // If endpoint configured, send to server
        if (this.endpoint) {
            try {
                await fetch(this.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        errors,
                        batchId: crypto.randomUUID(),
                        sentAt: Date.now()
                    })
                });
            } catch (e) {
                // Re-queue on failure
                this.queue = [...errors.slice(-25), ...this.queue].slice(0, this.maxQueueSize);
            }
        }
    }

    // Manual error capture with context
    captureException(error, context = {}) {
        this.captureError({
            type: 'handled_exception',
            message: error.message,
            name: error.name,
            stack: error.stack,
            ...context,
        });
    }

    // Add breadcrumb for debugging
    addBreadcrumb(category, message, data = {}) {
        this.captureError({
            type: 'breadcrumb',
            category,
            message,
            data,
            level: 'info',
        });
    }

    // Get error report for debugging
    async getErrorReport() {
        const { crashLog, crashLogTimestamp } = await chrome.storage.local.get([
            'crashLog', 'crashLogTimestamp'
        ]);

        return {
            errors: crashLog || [],
            timestamp: crashLogTimestamp,
            sessionId: this.sessionId,
            version: this.version,
            queueLength: this.queue.length,
        };
    }

    // Clear error log
    async clearErrorLog() {
        this.queue = [];
        await chrome.storage.local.remove(['crashLog', 'crashLogTimestamp', 'errorQueue']);
    }
}

// Create singleton instance
const errorTracker = new ErrorTracker({
    endpoint: null, // Set to analytics endpoint if using remote tracking
    maxQueueSize: 50
});

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ErrorTracker, errorTracker };
}
