// Clipboard History Pro - Popup JavaScript
// Standalone version - no ES module dependencies for maximum compatibility

// State
const state = {
    clips: [],
    filteredClips: [],
    filter: 'all',
    searchQuery: '',
    tier: 'free',
    limits: null,
    stats: null
};

// DOM Elements
const $ = id => document.getElementById(id);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log('[Popup] Initializing...');
    try {
        await loadClips();
        await loadStats();
        initEventListeners();
        updateUI();
        showShortcutHint();
        await maybeShowCapHit();
        // Numbers for the kit v2 card and page (zovo-cards.js reads chrome.storage only).
        // zovoClipPeak never goes down, so deleting clips cannot bring the rating card back.
        chrome.storage.local.get('zovoClipPeak').then(({ zovoClipPeak }) => chrome.storage.local.set({
            zovoClipCount: state.clips.length,
            zovoClipPeak: Math.max(Number(zovoClipPeak) || 0, state.clips.length)
        })).catch(() => {});
        focusSearch();
        console.log('[Popup] Loaded', state.clips.length, 'clips');
    } catch (err) {
        console.error('[Popup] Init failed:', err);
        showError('Failed to load clipboard history');
    }
}

// Load clips from background
async function loadClips() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_CLIPS' });
        if (response && Array.isArray(response)) {
            state.clips = response;
            state.filteredClips = [...state.clips];
        } else if (response?.error) {
            throw new Error(response.error);
        } else {
            state.clips = [];
            state.filteredClips = [];
        }
    } catch (err) {
        console.error('[Popup] Failed to load clips:', err);
        state.clips = [];
        state.filteredClips = [];
    }
}

// Load stats and tier info
async function loadStats() {
    try {
        state.stats = await chrome.runtime.sendMessage({ action: 'GET_STATS' });
        if (state.stats) {
            state.tier = state.stats.tier || 'free';
        }
        state.limits = await chrome.runtime.sendMessage({ action: 'GET_LIMITS' });
    } catch (err) {
        console.error('[Popup] Failed to load stats:', err);
    }
}

// Initialize event listeners
function initEventListeners() {
    // Search
    const searchInput = $('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 200));
    }

    // Filters
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => handleFilter(tab.dataset.filter));
    });

    // Settings
    const settingsBtn = $('settingsBtn');
    const closeSettings = $('closeSettings');
    if (settingsBtn) settingsBtn.addEventListener('click', () => toggleSettings(true));
    if (closeSettings) closeSettings.addEventListener('click', () => toggleSettings(false));

    // Upgrade modal
    const upgradeBannerBtn = $('upgradeBannerBtn');
    const closeModal = $('closeModal');
    const maybeLaterBtn = $('maybeLaterBtn');
    if (upgradeBannerBtn) upgradeBannerBtn.addEventListener('click', showUpgradeModal);
    if (closeModal) closeModal.addEventListener('click', hideUpgradeModal);
    if (maybeLaterBtn) maybeLaterBtn.addEventListener('click', hideUpgradeModal);

    // License key entry
    const licenseBtn = $('licenseBtn');
    const haveLicenseBtn = $('haveLicenseBtn');
    const closeLicenseModal = $('closeLicenseModal');
    const licenseCancelBtn = $('licenseCancelBtn');
    const activateLicenseBtn = $('activateLicenseBtn');
    if (licenseBtn) licenseBtn.addEventListener('click', showLicenseModal);
    if (haveLicenseBtn) haveLicenseBtn.addEventListener('click', () => { hideUpgradeModal(); showLicenseModal(); });
    if (closeLicenseModal) closeLicenseModal.addEventListener('click', hideLicenseModal);
    if (licenseCancelBtn) licenseCancelBtn.addEventListener('click', hideLicenseModal);
    if (activateLicenseBtn) activateLicenseBtn.addEventListener('click', handleActivateLicense);

    // Export
    const exportBtn = $('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', handleExport);

    // Clear all
    const clearBtn = $('clearBtn');
    const clearAllBtn = $('clearAllBtn');
    if (clearBtn) clearBtn.addEventListener('click', handleClearAll);
    if (clearAllBtn) clearAllBtn.addEventListener('click', handleClearAll);

    // Empty-state CTA: this was an inert button (no handler). The empty state
    // asks the user to go copy something, so close the popup to get out of the
    // way - an observable, sensible action.
    const emptyStateCta = $('emptyStateCta');
    if (emptyStateCta) emptyStateCta.addEventListener('click', () => window.close());

    // Peak-intent upgrade: the SW broadcasts LIMIT_REACHED when the free cap is
    // hit and it starts deleting the user's oldest clips. That is the single
    // highest-intent upgrade moment; previously nothing listened to it. Show the
    // value-stack modal (free tier only).
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.action === 'LIMIT_REACHED' && state.tier === 'free') {
            showUpgradeModal('capHit');
        }
    });

    // Settings > Export All: the same export path as the footer button (the
    // format menu for Pro, the existing paywall for free).
    const exportAllBtn = $('exportAllBtn');
    if (exportAllBtn) exportAllBtn.addEventListener('click', handleExport);

    // Settings > skip a copy that matches the last one. background.js addClip()
    // reads chrome.storage.local.clipboardSettings.skipDuplicates (default on);
    // onboarding step 3 writes the same key.
    const skipDup = $('autoDeleteDuplicates');
    if (skipDup) {
        chrome.storage.local.get('clipboardSettings').then(({ clipboardSettings }) => {
            skipDup.checked = !(clipboardSettings && clipboardSettings.skipDuplicates === false);
        }).catch(() => {});
        skipDup.addEventListener('change', async () => {
            try {
                const { clipboardSettings } = await chrome.storage.local.get('clipboardSettings');
                await chrome.storage.local.set({
                    clipboardSettings: { ...(clipboardSettings || {}), skipDuplicates: skipDup.checked },
                    clipboardSettingsAt: Date.now()
                });
            } catch (err) { /* storage unavailable: the toggle stays as shown */ }
        });
    }
}

// Empty-state hint: show the shortcut Chrome actually assigned (Ctrl+Shift+V on
// Windows and Linux, Shift+Cmd+V on Mac, or whatever the user picked), and hide
// the hint when no shortcut is set.
async function showShortcutHint() {
    const key = $('shortcutKey');
    const hint = $('shortcutHint');
    if (!key || !hint) return;
    try {
        const commands = await chrome.commands.getAll();
        const open = commands.find(c => c.name === '_execute_action');
        if (open && open.shortcut) key.textContent = open.shortcut;
        else hint.hidden = true;
    } catch (err) {
        key.textContent = /Mac/i.test(navigator.platform || '') ? '\u2318\u21e7V' : 'Ctrl+Shift+V';
    }
}

// Consume the cap-hit signal the SW left while the popup was closed. Clears the
// badge and, for free users, shows the value-stack modal at most once per 24h so
// it lands on the "your clips are being deleted" moment without ever nagging.
async function maybeShowCapHit() {
    try {
        const { capHitPending, capHitShownAt } = await chrome.storage.local.get(['capHitPending', 'capHitShownAt']);
        if (!capHitPending) return;
        try { chrome.action.setBadgeText({ text: '' }); } catch (e) { /* best-effort */ }
        await chrome.storage.local.set({ capHitPending: false });
        const DAY_MS = 24 * 60 * 60 * 1000;
        if (state.tier === 'free' && (!capHitShownAt || Date.now() - capHitShownAt > DAY_MS)) {
            await chrome.storage.local.set({ capHitShownAt: Date.now() });
            showUpgradeModal('capHit');
        }
    } catch (err) {
        // storage/badge unavailable - never block the popup.
    }
}

// Search handler
function handleSearch() {
    const searchInput = $('searchInput');
    state.searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
    applyFilters();
}

// Filter handler
function handleFilter(filter) {
    state.filter = filter;
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    applyFilters();
}

// Apply all filters
function applyFilters() {
    let filtered = [...state.clips];

    // Type filter
    if (state.filter === 'starred') {
        filtered = filtered.filter(c => c.starred);
    } else if (state.filter === 'pinned') {
        filtered = filtered.filter(c => c.pinned);
    } else if (state.filter !== 'all') {
        filtered = filtered.filter(c => c.type === state.filter);
    }

    // Search filter
    if (state.searchQuery) {
        filtered = filtered.filter(c =>
            c.content.toLowerCase().includes(state.searchQuery)
        );
    }

    state.filteredClips = filtered;
    renderClips();
}

// Update UI
function updateUI() {
    // Pro badge
    const proBadge = $('proBadge');
    if (proBadge) proBadge.hidden = state.tier !== 'pro';

    // Clip count
    const clipCount = $('clipCount');
    if (clipCount) clipCount.textContent = state.clips.length;

    // Show limit banner if near limit. Starred and pinned clips don't count
    // toward the limit (background.js enforceClipLimit), so not here either.
    if (state.stats && state.limits) {
        const used = state.stats.removableClips ?? state.stats.totalClips;
        const usage = used / state.limits.maxClips;
        const limitBanner = $('limitBanner');
        const usageText = $('usageText');
        if (limitBanner && usage > 0.8 && state.tier === 'free') {
            limitBanner.hidden = false;
            if (usageText) usageText.textContent = `${used}/${state.limits.maxClips} clips`;
        }
    }

    renderClips();
}

// Render clips
function renderClips() {
    const clipsList = $('clipsList');
    const emptyState = $('emptyState');
    const noResultsState = $('noResultsState');

    if (!clipsList) return;

    // Clear
    clipsList.innerHTML = '';

    // Empty states
    if (state.clips.length === 0) {
        if (emptyState) emptyState.hidden = false;
        if (noResultsState) noResultsState.hidden = true;
        return;
    }

    if (emptyState) emptyState.hidden = true;

    if (state.filteredClips.length === 0) {
        if (noResultsState) noResultsState.hidden = false;
        return;
    }

    if (noResultsState) noResultsState.hidden = true;

    // Render clips
    state.filteredClips.forEach(clip => {
        const clipEl = createClipElement(clip);
        clipsList.appendChild(clipEl);
    });
}

// Create clip element
function createClipElement(clip) {
    const div = document.createElement('div');
    div.className = 'clip-item';
    div.dataset.id = clip.id;

    const typeIcon = getTypeIcon(clip.type);
    const timeAgo = formatTimeAgo(clip.timestamp);
    const preview = escapeHtml(clip.content.substring(0, 100));

    div.innerHTML = `
        <div class="clip-main">
            <span class="clip-type-icon">${typeIcon}</span>
            <div class="clip-content">
                <div class="clip-preview">${preview}${clip.content.length > 100 ? '...' : ''}</div>
                <div class="clip-meta">${timeAgo}</div>
            </div>
        </div>
        <div class="clip-actions">
            <button class="btn-icon btn-star ${clip.starred ? 'active' : ''}" title="Star" aria-label="Star">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="${clip.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M8 2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.3 4.4 13.1l.7-4L2.2 6.3l4-.6L8 2z"/></svg>
            </button>
            <button class="btn-icon btn-pin ${clip.pinned ? 'active' : ''}" title="Pin" aria-label="Pin">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="${clip.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M6 2h4l-.7 1.4v3l2 2v1.2H4.7V8.4l2-2v-3L6 2z"/><path d="M8 9.6V14" stroke-linecap="round"/></svg>
            </button>
            <button class="btn-icon btn-copy" title="Copy" aria-label="Copy">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V4a1.5 1.5 0 00-1.5-1.5H4A1.5 1.5 0 002.5 4v5A1.5 1.5 0 004 10.5h1.5"/></svg>
            </button>
            <button class="btn-icon btn-delete" title="Delete" aria-label="Delete">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.5 8h5l.5-8"/></svg>
            </button>
        </div>
    `;

    // Event listeners
    div.querySelector('.btn-copy').addEventListener('click', (e) => {
        e.stopPropagation();
        copyClip(clip);
    });

    div.querySelector('.btn-star').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStar(clip);
    });

    div.querySelector('.btn-pin').addEventListener('click', (e) => {
        e.stopPropagation();
        togglePin(clip);
    });

    div.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteClip(clip);
    });

    // Click to copy
    div.addEventListener('click', () => copyClip(clip));

    return div;
}

// Get type icon
// Inline SVG type glyphs (single-color, inherit currentColor) so the clip list
// uses one consistent icon set instead of mixing emoji with the popup's SVGs.
function getTypeIcon(type) {
    const s = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    const icons = {
        url: s + '<path d="M6.5 9.5l3-3M7 4.5l.8-.8a2.3 2.3 0 013.3 3.3l-.8.8M9 11.5l-.8.8a2.3 2.3 0 01-3.3-3.3l.8-.8"/></svg>',
        email: s + '<rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M2.5 5l5.5 4 5.5-4"/></svg>',
        code: s + '<path d="M5.5 5.5L3 8l2.5 2.5M10.5 5.5L13 8l-2.5 2.5"/></svg>',
        json: s + '<path d="M6 3.5c-1.5 0-1.5 1-1.5 2s0 2-1.5 2.5c1.5.5 1.5 1.5 1.5 2.5s0 2 1.5 2M10 3.5c1.5 0 1.5 1 1.5 2s0 2 1.5 2.5c-1.5.5-1.5 1.5-1.5 2.5s0 2-1.5 2"/></svg>',
        number: s + '<path d="M6 3l-1 10M11 3l-1 10M3.5 6.5h9M3 9.5h9"/></svg>',
        text: s + '<path d="M3 4h10M3 8h10M3 12h6"/></svg>'
    };
    return icons[type] || icons.text;
}

// Format time ago
function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// Copy clip
async function copyClip(clip) {
    try {
        await navigator.clipboard.writeText(clip.content);

        // Copy confirmation: flash the row itself (the CSS .copied state shows an
        // inline check), which is more contextual than a floating toast. Fall back
        // to the toast if the row isn't on screen.
        const row = [...document.querySelectorAll('.clip-item')]
            .find(el => el.dataset.id === String(clip.id));
        if (row) {
            row.classList.add('copied');
            setTimeout(() => row.classList.remove('copied'), 1000);
        } else {
            showToast('Copied');
        }

        // Update usage count
        await chrome.runtime.sendMessage({
            action: 'UPDATE_CLIP',
            id: clip.id,
            updates: { usageCount: (clip.usageCount || 0) + 1 }
        });
    } catch (err) {
        console.error('Copy failed:', err);
        showToast('Copy failed');
    }
}

// Toggle star
async function toggleStar(clip) {
    const newStarred = !clip.starred;

    // Check limit for free tier
    if (newStarred && state.tier === 'free' && state.limits) {
        const starredCount = state.clips.filter(c => c.starred).length;
        if (starredCount >= state.limits.maxStarred) {
            showUpgradeModal('starred');
            return;
        }
    }

    await chrome.runtime.sendMessage({
        action: 'UPDATE_CLIP',
        id: clip.id,
        updates: { starred: newStarred }
    });

    clip.starred = newStarred;
    renderClips();
}

// Toggle pin
async function togglePin(clip) {
    const newPinned = !clip.pinned;

    // Check limit for free tier
    if (newPinned && state.tier === 'free' && state.limits) {
        const pinnedCount = state.clips.filter(c => c.pinned).length;
        if (pinnedCount >= state.limits.maxPinned) {
            showUpgradeModal('pinned');
            return;
        }
    }

    await chrome.runtime.sendMessage({
        action: 'UPDATE_CLIP',
        id: clip.id,
        updates: { pinned: newPinned }
    });

    clip.pinned = newPinned;
    renderClips();
}

// Delete clip
async function deleteClip(clip) {
    await chrome.runtime.sendMessage({
        action: 'DELETE_CLIP',
        id: clip.id
    });

    state.clips = state.clips.filter(c => c.id !== clip.id);
    applyFilters();
}

// Handle export. Pro sells "CSV, JSON & TXT", so all three must actually
// exist: a small format menu anchored to the export button.
function exportRows() {
    return state.clips.map(c => ({
        content: c.content,
        type: c.type,
        timestamp: new Date(c.timestamp).toISOString(),
        starred: !!c.starred,
        pinned: !!c.pinned
    }));
}

function serializeExport(format) {
    const rows = exportRows();
    if (format === 'json') {
        return { text: JSON.stringify(rows, null, 2), mime: 'application/json', ext: 'json' };
    }
    if (format === 'csv') {
        const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
        const lines = ['content,type,timestamp,starred,pinned'];
        rows.forEach(r => lines.push([esc(r.content), r.type, r.timestamp, r.starred, r.pinned].join(',')));
        return { text: lines.join('\r\n'), mime: 'text/csv', ext: 'csv' };
    }
    // txt: one clip per block, blank-line separated
    return {
        text: rows.map(r => r.content).join('\n\n----------\n\n'),
        mime: 'text/plain', ext: 'txt'
    };
}

function downloadExport(format) {
    const { text, mime, ext } = serializeExport(format);
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clipboard-history-${new Date().toISOString().split('T')[0]}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
}

function hideExportMenu() {
    const menu = document.getElementById('exportMenu');
    if (menu) menu.remove();
}

async function handleExport(event) {
    if (state.tier === 'free') {
        showUpgradeModal('export');
        return;
    }

    if (document.getElementById('exportMenu')) { hideExportMenu(); return; }

    // Anchor the menu to whichever button opened it (footer or Settings).
    const btn = (event && event.currentTarget instanceof Element) ? event.currentTarget : $('exportBtn');
    const menu = document.createElement('div');
    menu.id = 'exportMenu';
    menu.setAttribute('role', 'menu');
    menu.style.cssText = 'position:fixed;z-index:1000;background:var(--bg-primary,#fff);border:1px solid var(--border,#ddd);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.18);padding:4px;min-width:120px';
    [['csv', 'CSV'], ['json', 'JSON'], ['txt', 'TXT']].forEach(([fmt, label]) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.setAttribute('role', 'menuitem');
        item.textContent = 'Export ' + label;
        item.style.cssText = 'display:block;width:100%;text-align:left;padding:6px 10px;background:none;border:0;border-radius:4px;font:inherit;color:inherit;cursor:pointer';
        item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-tertiary,#f0f0f0)'; });
        item.addEventListener('mouseleave', () => { item.style.background = 'none'; });
        item.addEventListener('click', () => { hideExportMenu(); downloadExport(fmt); });
        menu.appendChild(item);
    });
    document.body.appendChild(menu);
    if (btn) {
        const r = btn.getBoundingClientRect();
        menu.style.left = Math.max(4, Math.min(r.left, window.innerWidth - menu.offsetWidth - 4)) + 'px';
        const above = r.top - menu.offsetHeight - 6;
        menu.style.top = (above >= 4 ? above : Math.max(4, Math.min(r.bottom + 6, window.innerHeight - menu.offsetHeight - 4))) + 'px';
    }
    setTimeout(() => document.addEventListener('click', function dismiss(e) {
        if (!menu.contains(e.target)) { hideExportMenu(); }
        document.removeEventListener('click', dismiss);
    }), 0);
}

// Handle clear all
async function handleClearAll() {
    if (confirm('Delete all clipboard history? This cannot be undone.')) {
        await chrome.runtime.sendMessage({ action: 'CLEAR_ALL' });
        state.clips = [];
        state.filteredClips = [];
        renderClips();
        showToast('All clips cleared');
    }
}

// Show upgrade modal. `feature` selects a peak-intent message and tags the
// checkout link's source so conversions are attributable per trigger.
function showUpgradeModal(feature) {
    const upgradeModal = $('upgradeModal');
    const upgradeMessage = $('upgradeMessage');

    if (!upgradeModal) return;

    const messages = {
        capHit: "Your free history is full and your oldest clips are getting deleted to make room. Pro keeps up to 10,000, and starred or pinned clips are never removed to make room.",
        starred: "You've reached the free tier limit of 10 starred clips. Pro is unlimited.",
        pinned: "You've reached the free tier limit of 5 pinned clips. Pro is unlimited.",
        export: "Export to CSV, JSON and TXT is a Pro feature."
    };

    if (upgradeMessage) {
        upgradeMessage.textContent = messages[feature] || "Get everything Pro offers.";
    }

    // Attribute the click: tag the upgrade CTA with the trigger that opened it.
    const upgradeCta = document.querySelector('#upgradeModal .btn-upgrade');
    if (upgradeCta) {
        const src = 'popup_' + (feature || 'modal');
        upgradeCta.href = 'https://zovo.one/pricing?ref=clipboard-history-pro&src=' + encodeURIComponent(src);
    }

    upgradeModal.hidden = false;
}

// Hide upgrade modal
function hideUpgradeModal() {
    const upgradeModal = $('upgradeModal');
    if (upgradeModal) upgradeModal.hidden = true;
}

function showLicenseModal() {
    const licenseModal = $('licenseModal');
    const licenseError = $('licenseError');
    const licenseKeyInput = $('licenseKeyInput');
    if (licenseError) licenseError.hidden = true;
    if (licenseKeyInput) licenseKeyInput.value = '';
    if (licenseModal) licenseModal.hidden = false;
}

function hideLicenseModal() {
    const licenseModal = $('licenseModal');
    if (licenseModal) licenseModal.hidden = true;
}

async function handleActivateLicense() {
    const licenseKeyInput = $('licenseKeyInput');
    const licenseError = $('licenseError');
    const activateLicenseBtn = $('activateLicenseBtn');
    if (!licenseKeyInput) return;

    const licenseKey = licenseKeyInput.value.toUpperCase().trim();

    if (!/^ZOVO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licenseKey)) {
        if (licenseError) {
            licenseError.textContent = 'That doesn\'t look like a Zovo key. Format is ZOVO-XXXX-XXXX-XXXX-XXXX.';
            licenseError.hidden = false;
        }
        return;
    }

    if (activateLicenseBtn) {
        activateLicenseBtn.disabled = true;
        activateLicenseBtn.textContent = 'Activating...';
    }

    try {
        const { verifyLicense } = await import('./shared/payments.js');
        const result = await verifyLicense(licenseKey, true);

        if (result && result.valid) {
            await chrome.storage.sync.set({ licenseKey });
            hideLicenseModal();
            location.reload();
        } else if (licenseError) {
            licenseError.textContent = (result && result.error) || 'That key is not active. Check the email from your purchase and try again.';
            licenseError.hidden = false;
        }
    } catch (err) {
        console.error('[Popup] License activation failed:', err);
        if (licenseError) {
            licenseError.textContent = 'Could not reach the license server. Check your connection and try again.';
            licenseError.hidden = false;
        }
    } finally {
        if (activateLicenseBtn) {
            activateLicenseBtn.disabled = false;
            activateLicenseBtn.textContent = 'Activate License';
        }
    }
}

// Toggle settings panel
function toggleSettings(show) {
    const settingsPanel = $('settingsPanel');
    if (settingsPanel) settingsPanel.hidden = !show;
}

// The popup opens with the search box focused, so typing searches at once
// (onboarding says "Start typing to search your clips").
function focusSearch() {
    const input = $('searchInput');
    const active = document.activeElement;
    if (input && (!active || active === document.body)) input.focus();
}

// Show toast
function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// Show error
function showError(message) {
    const clipsList = $('clipsList');
    if (clipsList) {
        clipsList.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
    }
}

// Utility: Debounce
function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

// Utility: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
