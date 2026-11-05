/**
 * Internationalization Manager
 * Agent 4: i18n utility for DOM translation and locale handling
 * Prompt 15: Internationalization System
 */

class I18nManager {
    constructor() {
        this.locale = chrome.i18n.getUILanguage();
        this.direction = chrome.i18n.getMessage('@@bidi_dir') || 'ltr';
        this.isRTL = this.direction === 'rtl';

        this.init();
    }

    init() {
        // Set document direction and language
        document.documentElement.dir = this.direction;
        document.documentElement.lang = this.locale;
        document.body.classList.toggle('rtl', this.isRTL);

        // Translate page on load
        this.translatePage();

        // Watch for dynamic content
        this.observeDOM();

        console.log('[i18n] Initialized, locale:', this.locale, 'dir:', this.direction);
    }

    /**
     * Get translated message
     */
    getMessage(key, substitutions = []) {
        const message = chrome.i18n.getMessage(key, substitutions);
        if (!message) {
            console.warn(`[i18n] Missing translation for key: ${key}`);
            return key;
        }
        return message;
    }

    /**
     * Shorthand for getMessage
     */
    t(key, substitutions = []) {
        return this.getMessage(key, substitutions);
    }

    /**
     * Translate all elements with data-i18n attributes
     */
    translatePage() {
        // Text content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const message = this.getMessage(key);
            if (message !== key) {
                el.textContent = message;
            }
        });

        // Placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const message = this.getMessage(key);
            if (message !== key) {
                el.placeholder = message;
            }
        });

        // Titles/Tooltips
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const message = this.getMessage(key);
            if (message !== key) {
                el.title = message;
            }
        });

        // Aria labels
        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria');
            const message = this.getMessage(key);
            if (message !== key) {
                el.setAttribute('aria-label', message);
            }
        });
    }

    /**
     * Watch for dynamically added elements
     */
    observeDOM() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        this.translateElement(node);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Translate a single element and its children
     */
    translateElement(el) {
        if (el.hasAttribute && el.hasAttribute('data-i18n')) {
            const key = el.getAttribute('data-i18n');
            const message = this.getMessage(key);
            if (message !== key) {
                el.textContent = message;
            }
        }

        if (el.querySelectorAll) {
            el.querySelectorAll('[data-i18n]').forEach(child => {
                const key = child.getAttribute('data-i18n');
                const message = this.getMessage(key);
                if (message !== key) {
                    child.textContent = message;
                }
            });
        }
    }

    /**
     * Format date for current locale
     */
    formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return new Intl.DateTimeFormat(
            this.locale,
            { ...defaultOptions, ...options }
        ).format(date);
    }

    /**
     * Format relative time
     */
    formatRelativeTime(date) {
        const rtf = new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' });
        const diff = date - new Date();
        const seconds = Math.round(diff / 1000);
        const minutes = Math.round(diff / 60000);
        const hours = Math.round(diff / 3600000);
        const days = Math.round(diff / 86400000);

        if (Math.abs(seconds) < 60) {
            return this.t('timeJustNow');
        } else if (Math.abs(minutes) < 60) {
            return this.t('timeMinutesAgo', [Math.abs(minutes).toString()]);
        } else if (Math.abs(hours) < 24) {
            return this.t('timeHoursAgo', [Math.abs(hours).toString()]);
        } else {
            return this.t('timeDaysAgo', [Math.abs(days).toString()]);
        }
    }

    /**
     * Format number for current locale
     */
    formatNumber(number, options = {}) {
        return new Intl.NumberFormat(this.locale, options).format(number);
    }

    /**
     * Format currency for current locale
     */
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat(this.locale, {
            style: 'currency',
            currency
        }).format(amount);
    }

    /**
     * Get supported locales
     */
    getSupportedLocales() {
        return ['en', 'es', 'ja', 'de', 'fr', 'pt_BR', 'zh_CN', 'ar'];
    }

    /**
     * Check if current locale is RTL
     */
    isRightToLeft() {
        return this.isRTL;
    }

    /**
     * Get alignment based on direction
     */
    getStartEdge() {
        return this.isRTL ? 'right' : 'left';
    }

    getEndEdge() {
        return this.isRTL ? 'left' : 'right';
    }
}

// Create singleton
const i18n = new I18nManager();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { I18nManager, i18n };
}

// Global shorthand
window.t = (key, subs) => i18n.t(key, subs);
