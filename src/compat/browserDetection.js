/**
 * Browser Detection & Feature Detection
 * Agent 1: Cross-browser compatibility utilities
 * Prompt 16: Cross-Browser Porter
 */

const BrowserDetection = {
    /**
     * Detect current browser
     */
    getBrowser() {
        const ua = navigator.userAgent;

        if (typeof browser !== 'undefined' && browser.runtime?.getBrowserInfo) {
            return 'firefox';
        }
        if (ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium')) {
            return 'safari';
        }
        if (ua.includes('Edg/')) {
            return 'edge';
        }
        if (ua.includes('Brave')) {
            return 'brave';
        }
        if (ua.includes('OPR/') || ua.includes('Opera')) {
            return 'opera';
        }
        if (ua.includes('Vivaldi')) {
            return 'vivaldi';
        }
        return 'chrome';
    },

    /**
     * Get browser info
     */
    async getBrowserInfo() {
        const browser = this.getBrowser();

        const info = {
            name: browser,
            isChromium: ['chrome', 'edge', 'brave', 'opera', 'vivaldi'].includes(browser),
            isFirefox: browser === 'firefox',
            isSafari: browser === 'safari',
            manifestVersion: this.getManifestVersion(),
            userAgent: navigator.userAgent,
        };

        // Get Firefox-specific info
        if (info.isFirefox && typeof globalThis.browser?.runtime?.getBrowserInfo === 'function') {
            try {
                const ffInfo = await globalThis.browser.runtime.getBrowserInfo();
                info.version = ffInfo.version;
                info.buildID = ffInfo.buildID;
            } catch (e) {
                // Fallback
            }
        }

        return info;
    },

    /**
     * Get manifest version
     */
    getManifestVersion() {
        try {
            const manifest = chrome.runtime.getManifest();
            return manifest.manifest_version;
        } catch (e) {
            return 3; // Default assumption
        }
    },

    /**
     * Check if API exists
     */
    hasAPI(apiPath) {
        const parts = apiPath.split('.');
        let current = typeof browser !== 'undefined' ? browser : chrome;

        for (const part of parts) {
            if (!current || typeof current[part] === 'undefined') {
                return false;
            }
            current = current[part];
        }
        return typeof current !== 'undefined';
    },

    /**
     * Feature detection
     */
    features: {
        get storage() { return BrowserDetection.hasAPI('storage.local'); },
        get storageSync() { return BrowserDetection.hasAPI('storage.sync'); },
        get storageSession() { return BrowserDetection.hasAPI('storage.session'); },

        get tabs() { return BrowserDetection.hasAPI('tabs.query'); },
        get tabGroups() { return BrowserDetection.hasAPI('tabGroups'); },

        get sidePanel() { return BrowserDetection.hasAPI('sidePanel'); },
        get sidebarAction() { return BrowserDetection.hasAPI('sidebarAction'); },

        get scripting() { return BrowserDetection.hasAPI('scripting.executeScript'); },
        get offscreen() { return BrowserDetection.hasAPI('offscreen'); },

        get declarativeNetRequest() { return BrowserDetection.hasAPI('declarativeNetRequest'); },
        get webRequest() { return BrowserDetection.hasAPI('webRequest'); },

        get contextMenus() { return BrowserDetection.hasAPI('contextMenus'); },
        get notifications() { return BrowserDetection.hasAPI('notifications'); },
        get alarms() { return BrowserDetection.hasAPI('alarms'); },

        // Firefox-specific
        get containers() { return BrowserDetection.hasAPI('contextualIdentities'); },
        get dns() { return BrowserDetection.hasAPI('dns'); },

        // Check MV3 vs MV2
        get isManifestV3() { return BrowserDetection.getManifestVersion() === 3; },
        get isManifestV2() { return BrowserDetection.getManifestVersion() === 2; },
    },

    /**
     * Get capabilities summary
     */
    getCapabilities() {
        return {
            browser: this.getBrowser(),
            manifestVersion: this.getManifestVersion(),
            features: {
                storage: this.features.storage,
                storageSync: this.features.storageSync,
                tabs: this.features.tabs,
                tabGroups: this.features.tabGroups,
                sidePanel: this.features.sidePanel,
                sidebarAction: this.features.sidebarAction,
                scripting: this.features.scripting,
                offscreen: this.features.offscreen,
                declarativeNetRequest: this.features.declarativeNetRequest,
                contextMenus: this.features.contextMenus,
                notifications: this.features.notifications,
                containers: this.features.containers,
            }
        };
    },

    /**
     * Log capabilities for debugging
     */
    logCapabilities() {
        const caps = this.getCapabilities();
        console.log('[BrowserDetection] Browser:', caps.browser);
        console.log('[BrowserDetection] Manifest Version:', caps.manifestVersion);
        console.table(caps.features);
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BrowserDetection };
}

if (typeof window !== 'undefined') {
    window.BrowserDetection = BrowserDetection;
}
