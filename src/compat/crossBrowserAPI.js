/**
 * Cross-Browser API Abstraction
 * Agent 2: Unified API layer for all browsers
 * Prompt 16: Cross-Browser Porter
 */

const CrossBrowserAPI = {
    /**
     * Get the browser API object (normalized)
     */
    get api() {
        return typeof browser !== 'undefined' && browser.runtime ? browser : chrome;
    },

    /**
     * Get current browser type
     */
    get browserType() {
        if (typeof BrowserDetection !== 'undefined') {
            return BrowserDetection.getBrowser();
        }
        const ua = navigator.userAgent;
        if (ua.includes('Firefox')) return 'firefox';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'safari';
        if (ua.includes('Edg/')) return 'edge';
        return 'chrome';
    },

    /**
     * Storage API (with Safari sync fallback)
     */
    storage: {
        async get(keys) {
            return new Promise((resolve) => {
                chrome.storage.local.get(keys, resolve);
            });
        },

        async set(items) {
            return new Promise((resolve) => {
                chrome.storage.local.set(items, resolve);
            });
        },

        async remove(keys) {
            return new Promise((resolve) => {
                chrome.storage.local.remove(keys, resolve);
            });
        },

        // Sync storage with Safari fallback
        sync: {
            async get(keys) {
                const browserType = CrossBrowserAPI.browserType;
                if (browserType === 'safari') {
                    // Safari doesn't support sync, fallback to local
                    return CrossBrowserAPI.storage.get(keys);
                }
                return new Promise((resolve) => {
                    chrome.storage.sync.get(keys, resolve);
                });
            },

            async set(items) {
                const browserType = CrossBrowserAPI.browserType;
                if (browserType === 'safari') {
                    return CrossBrowserAPI.storage.set(items);
                }
                return new Promise((resolve) => {
                    chrome.storage.sync.set(items, resolve);
                });
            }
        }
    },

    /**
     * Tabs API
     */
    tabs: {
        async query(queryInfo) {
            return new Promise((resolve) => {
                chrome.tabs.query(queryInfo, resolve);
            });
        },

        async getCurrent() {
            return this.query({ active: true, currentWindow: true })
                .then(tabs => tabs[0]);
        },

        async create(createProperties) {
            return new Promise((resolve) => {
                chrome.tabs.create(createProperties, resolve);
            });
        },

        async update(tabId, updateProperties) {
            return new Promise((resolve) => {
                chrome.tabs.update(tabId, updateProperties, resolve);
            });
        },

        async sendMessage(tabId, message) {
            return new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, message, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                });
            });
        }
    },

    /**
     * Runtime API
     */
    runtime: {
        async sendMessage(message) {
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                });
            });
        },

        getURL(path) {
            return chrome.runtime.getURL(path);
        },

        getManifest() {
            return chrome.runtime.getManifest();
        },

        onMessage: chrome.runtime.onMessage,
        onInstalled: chrome.runtime.onInstalled
    },

    /**
     * Action API (browserAction in MV2 / action in MV3)
     */
    get action() {
        return chrome.action || chrome.browserAction;
    },

    /**
     * Notifications (with Safari fallback)
     */
    async notify(id, options) {
        const browserType = this.browserType;

        // Safari has limited notification support
        if (browserType === 'safari' && 'Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                return new Notification(options.title, {
                    body: options.message,
                    icon: options.iconUrl || this.runtime.getURL('icons/icon-48.png')
                });
            }
            return null;
        }

        return new Promise((resolve) => {
            chrome.notifications.create(id, {
                type: options.type || 'basic',
                title: options.title,
                message: options.message,
                iconUrl: options.iconUrl || this.runtime.getURL('icons/icon-48.png')
            }, resolve);
        });
    },

    /**
     * Scripting API (MV3) with MV2 fallback
     */
    async executeScript(tabId, options) {
        if (chrome.scripting) {
            // MV3
            return chrome.scripting.executeScript({
                target: { tabId },
                ...options
            });
        } else {
            // MV2 fallback
            return new Promise((resolve) => {
                if (options.func) {
                    chrome.tabs.executeScript(tabId, {
                        code: `(${options.func.toString()})()`
                    }, resolve);
                } else if (options.files) {
                    chrome.tabs.executeScript(tabId, {
                        file: options.files[0]
                    }, resolve);
                }
            });
        }
    },

    /**
     * Side panel (Chrome) / Sidebar (Firefox)
     */
    async openSidePanel(tabId) {
        if (chrome.sidePanel) {
            return chrome.sidePanel.open({ tabId });
        } else if (typeof browser !== 'undefined' && browser.sidebarAction) {
            return browser.sidebarAction.open();
        }
        console.warn('[CrossBrowserAPI] Side panel not supported');
        return null;
    },

    /**
     * Alarms API
     */
    alarms: {
        async create(name, alarmInfo) {
            return new Promise((resolve) => {
                chrome.alarms.create(name, alarmInfo);
                resolve();
            });
        },

        async get(name) {
            return new Promise((resolve) => {
                chrome.alarms.get(name, resolve);
            });
        },

        async clear(name) {
            return new Promise((resolve) => {
                chrome.alarms.clear(name, resolve);
            });
        },

        onAlarm: chrome.alarms?.onAlarm
    },

    /**
     * Context menus
     */
    contextMenus: {
        create(createProperties, callback) {
            return chrome.contextMenus.create(createProperties, callback);
        },

        remove(menuItemId, callback) {
            return chrome.contextMenus.remove(menuItemId, callback);
        },

        removeAll(callback) {
            return chrome.contextMenus.removeAll(callback);
        },

        onClicked: chrome.contextMenus?.onClicked
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CrossBrowserAPI };
}

if (typeof window !== 'undefined') {
    window.CrossBrowserAPI = CrossBrowserAPI;
}
