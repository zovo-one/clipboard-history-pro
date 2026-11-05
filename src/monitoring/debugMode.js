/**
 * Debug Mode System
 * Agent 4: Developer debugging tools
 * Prompt 11: Production-grade monitoring
 */

class DebugMode {
    constructor() {
        this.enabled = false;
        this.logLevel = 'warn'; // 'debug', 'info', 'warn', 'error'
        this.logHistory = [];
        this.maxLogHistory = 500;

        this.init();
    }

    async init() {
        // Check if debug mode is enabled
        try {
            const { debugMode, debugLogLevel } = await chrome.storage.local.get([
                'debugMode', 'debugLogLevel'
            ]);
            this.enabled = debugMode || false;
            this.logLevel = debugLogLevel || 'warn';
        } catch {
            // Use defaults
        }

        // Override console methods when debug mode is on
        if (this.enabled) {
            this.interceptConsole();
        }

        // Listen for debug mode toggle
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.debugMode) {
                this.enabled = changes.debugMode.newValue;
                if (this.enabled) {
                    this.interceptConsole();
                }
            }
            if (changes.debugLogLevel) {
                this.logLevel = changes.debugLogLevel.newValue;
            }
        });

        console.log('[DebugMode] Initialized, enabled:', this.enabled);
    }

    interceptConsole() {
        const levels = ['debug', 'info', 'warn', 'error'];
        const originalConsole = { ...console };

        levels.forEach(level => {
            console[level] = (...args) => {
                // Call original
                originalConsole[level].apply(console, args);

                // Store in history
                if (this.shouldLog(level)) {
                    this.logHistory.push({
                        level,
                        timestamp: Date.now(),
                        message: args.map(a => this.stringify(a)).join(' '),
                    });

                    if (this.logHistory.length > this.maxLogHistory) {
                        this.logHistory = this.logHistory.slice(-this.maxLogHistory);
                    }
                }
            };
        });
    }

    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentIndex = levels.indexOf(this.logLevel);
        const messageIndex = levels.indexOf(level);
        return messageIndex >= currentIndex;
    }

    stringify(value) {
        if (typeof value === 'string') return value;
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    }

    /**
     * Enable debug mode
     */
    async enable(logLevel = 'info') {
        this.enabled = true;
        this.logLevel = logLevel;
        await chrome.storage.local.set({
            debugMode: true,
            debugLogLevel: logLevel
        });
        this.interceptConsole();
        console.info('[DebugMode] Enabled with level:', logLevel);
    }

    /**
     * Disable debug mode
     */
    async disable() {
        this.enabled = false;
        await chrome.storage.local.set({ debugMode: false });
        console.info('[DebugMode] Disabled');
    }

    /**
     * Toggle debug mode
     */
    async toggle() {
        if (this.enabled) {
            await this.disable();
        } else {
            await this.enable();
        }
        return this.enabled;
    }

    /**
     * Log a debug message
     */
    log(category, message, data = {}) {
        if (!this.enabled) return;

        console.debug(`[${category}]`, message, data);
    }

    /**
     * Get all logs
     */
    getLogs(level = null) {
        if (level) {
            return this.logHistory.filter(l => l.level === level);
        }
        return [...this.logHistory];
    }

    /**
     * Get debug report
     */
    async getDebugReport() {
        const { crashLog } = await chrome.storage.local.get('crashLog');
        const { analyticsHistory } = await chrome.storage.local.get('analyticsHistory');
        const { performanceMetrics } = await chrome.storage.local.get('performanceMetrics');

        return {
            timestamp: Date.now(),
            version: chrome.runtime.getManifest().version,
            debugEnabled: this.enabled,
            logLevel: this.logLevel,
            logCount: this.logHistory.length,
            logs: this.logHistory.slice(-50),
            errors: (crashLog || []).slice(-20),
            recentEvents: (analyticsHistory || []).slice(-20),
            recentMetrics: (performanceMetrics || []).slice(-20),
        };
    }

    /**
     * Export debug report as JSON
     */
    async exportReport() {
        const report = await this.getDebugReport();
        const blob = new Blob([JSON.stringify(report, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const filename = `clipboard-pro-debug-${Date.now()}.json`;

        try {
            await chrome.downloads.download({
                url,
                filename,
                saveAs: true
            });
        } catch {
            // Fallback: open in new tab
            window.open(url);
        }

        return report;
    }

    /**
     * Clear all debug data
     */
    async clearAll() {
        this.logHistory = [];
        await chrome.storage.local.remove([
            'crashLog',
            'analyticsHistory',
            'performanceMetrics',
            'errorQueue',
            'analyticsQueue'
        ]);
        console.info('[DebugMode] Cleared all debug data');
    }

    /**
     * Get system info for debugging
     */
    getSystemInfo() {
        return {
            extensionId: chrome.runtime.id,
            version: chrome.runtime.getManifest().version,
            manifestVersion: chrome.runtime.getManifest().manifest_version,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenSize: typeof window !== 'undefined'
                ? `${window.innerWidth}x${window.innerHeight}`
                : 'N/A',
            timestamp: new Date().toISOString(),
        };
    }
}

// Create singleton
const debugMode = new DebugMode();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DebugMode, debugMode };
}
