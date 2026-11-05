/**
 * Compatibility Index
 * Agent 5: Unified exports for cross-browser compatibility
 * Prompt 16: Cross-Browser Porter
 */

// Re-export all compatibility modules
// In browser context, these are loaded as separate scripts

const Compat = {
    // Will be populated when modules load
    detection: null,
    api: null,

    /**
     * Initialize compatibility layer
     */
    init() {
        // Browser detection
        if (typeof BrowserDetection !== 'undefined') {
            this.detection = BrowserDetection;
        }

        // Cross-browser API
        if (typeof CrossBrowserAPI !== 'undefined') {
            this.api = CrossBrowserAPI;
        }

        console.log('[Compat] Initialized');
        this.logInfo();
    },

    /**
     * Log browser info
     */
    logInfo() {
        if (this.detection) {
            const browser = this.detection.getBrowser();
            const mv = this.detection.getManifestVersion();
            console.log(`[Compat] Browser: ${browser}, Manifest: V${mv}`);
        }
    },

    /**
     * Get current browser name
     */
    getBrowser() {
        return this.detection?.getBrowser() || 'unknown';
    },

    /**
     * Check if feature is available
     */
    hasFeature(feature) {
        return this.detection?.features?.[feature] || false;
    },

    /**
     * Get unified storage API
     */
    get storage() {
        return this.api?.storage || {
            get: (keys) => chrome.storage.local.get(keys),
            set: (items) => chrome.storage.local.set(items)
        };
    },

    /**
     * Get unified tabs API
     */
    get tabs() {
        return this.api?.tabs || chrome.tabs;
    },

    /**
     * Get unified runtime API
     */
    get runtime() {
        return this.api?.runtime || chrome.runtime;
    },

    /**
     * Send notification (cross-browser)
     */
    async notify(id, options) {
        if (this.api?.notify) {
            return this.api.notify(id, options);
        }
        return chrome.notifications.create(id, {
            type: 'basic',
            title: options.title,
            message: options.message,
            iconUrl: options.iconUrl || chrome.runtime.getURL('icons/icon-48.png')
        });
    },

    /**
     * Execute script (MV2/MV3 compatible)
     */
    async executeScript(tabId, options) {
        if (this.api?.executeScript) {
            return this.api.executeScript(tabId, options);
        }
        if (chrome.scripting) {
            return chrome.scripting.executeScript({ target: { tabId }, ...options });
        }
        return chrome.tabs.executeScript(tabId, options);
    }
};

// Auto-initialize
if (typeof chrome !== 'undefined' && chrome.runtime) {
    Compat.init();
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Compat };
}

if (typeof window !== 'undefined') {
    window.Compat = Compat;
}
