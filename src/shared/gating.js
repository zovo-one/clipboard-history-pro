/**
 * Clipboard History Pro - Feature Gating Utilities
 * Agent 4: Helper functions for Pro feature checks
 */

import { isPro, hasFeature, getTier } from './payments.js';
import { showPaywall } from './paywall.js';
import { FREE_LIMITS, PRO_LIMITS, FEATURE_LABELS } from './features.js';

/**
 * Get current tier limits
 * @returns {Promise<object>} Limits object
 */
export async function getLimits() {
    const tier = await getTier();
    return tier === 'free' ? FREE_LIMITS : PRO_LIMITS;
}

/**
 * Check if a clip action is allowed (within limits)
 * @param {string} action - 'clip', 'star', 'pin', 'snippet'
 * @param {number} currentCount - Current count of items
 * @returns {Promise<boolean>}
 */
export async function canPerformAction(action, currentCount) {
    const limits = await getLimits();

    switch (action) {
        case 'clip':
            return currentCount < limits.maxClips;
        case 'star':
            return currentCount < limits.maxStarred;
        case 'pin':
            return currentCount < limits.maxPinned;
        case 'snippet':
            return currentCount < limits.maxSnippets;
        default:
            return true;
    }
}

/**
 * Check Pro feature and show paywall if not available
 * @param {string} featureName - Feature to check (e.g., 'floating_widget')
 * @param {string} userEmail - Optional email for paywall logging
 * @returns {Promise<boolean>} - True if feature is available
 */
export async function requireFeature(featureName, userEmail = null) {
    // First check local Pro status
    if (await isPro()) {
        return true;
    }

    // Check specific feature
    if (await hasFeature(featureName)) {
        return true;
    }

    // Show paywall with feature label
    const label = FEATURE_LABELS[featureName] || featureName;
    showPaywall(label, userEmail);
    return false;
}

/**
 * Check if export format is allowed
 * @param {string} format - 'csv', 'json', or 'txt'
 * @returns {Promise<boolean>}
 */
export async function canExport(format) {
    const limits = await getLimits();
    return limits.exportFormats.includes(format);
}

/**
 * Wrapper for Pro-only actions
 * @param {string} featureName - Feature required
 * @param {Function} callback - Function to execute if allowed
 * @param {string} userEmail - Optional email
 */
export async function withProFeature(featureName, callback, userEmail = null) {
    if (await requireFeature(featureName, userEmail)) {
        return callback();
    }
    return null;
}

export default {
    getLimits,
    canPerformAction,
    requireFeature,
    canExport,
    withProFeature
};
