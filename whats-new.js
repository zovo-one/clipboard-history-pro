/* Clipboard History Pro - What's new page logic.
 * Loaded after src/membership-state.js. The page makes no network calls:
 * numbers come from the service worker (GET_STATS, GET_CLIPS read this
 * browser's IndexedDB) and membership from chrome.storage. */
(() => {
  'use strict';

  const RELEASE = '2.2.7';
  const CAMPAIGN = 'whats-new-2-2-7';

  const hasChrome = typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id && chrome.storage);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const nf = new Intl.NumberFormat(undefined);
  let changesAutoOpened = false;

  /* ---------------- data sources ---------------- */

  const DAY = 864e5;
  const PREVIEW_STATES = {
    free: { kind: 'free', stats: { totalClips: 63, maxClips: 100, starredCount: 4, pinnedCount: 2 }, reuse: 41, kept: 5, unprotected: 58, installedAt: Date.now() - 121 * DAY, intent: false },
    full: { kind: 'free', stats: { totalClips: 108, maxClips: 100, starredCount: 7, pinnedCount: 2 }, reuse: 188, kept: 8, unprotected: 100, installedAt: Date.now() - 233 * DAY, intent: false },
    pro: { kind: 'protected', stats: { totalClips: 3482, maxClips: 10000, starredCount: 61, pinnedCount: 9 }, reuse: 912, kept: 66, unprotected: 3416, installedAt: Date.now() - 300 * DAY, intent: false },
    fresh: { kind: 'free', stats: { totalClips: 0, maxClips: 100, starredCount: 0, pinnedCount: 0 }, reuse: 0, kept: 0, unprotected: 0, installedAt: null, intent: false },
    lapsed: { kind: 'lapsed', stats: { totalClips: 140, maxClips: 100, starredCount: 12, pinnedCount: 3 }, reuse: 260, kept: 13, unprotected: 127, installedAt: Date.now() - 280 * DAY, intent: false }
  };

  function previewState() {
    const p = new URLSearchParams(location.search).get('state');
    return PREVIEW_STATES[p] ? p : 'free';
  }

  const withTimeout = (p, ms = 4000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  function send(action) {
    return withTimeout(chrome.runtime.sendMessage({ action })).then((res) => {
      if (res && res.error) throw new Error(res.error);
      return res;
    });
  }

  async function readKind() {
    const M = globalThis.ZovoMembershipState;
    if (!M) return 'unknown';
    const { status } = await withTimeout(M.read());
    if (status === 'free') return 'free';
    const sync = await chrome.storage.sync.get(['tier', 'licenseKey']);
    if (sync.tier === 'pro') return 'protected';
    // A saved key on the free tier is a plan that lapsed or a key that stopped working.
    if (typeof sync.licenseKey === 'string' && sync.licenseKey.trim() && (sync.tier === 'free' || sync.tier === undefined)) return 'lapsed';
    return 'unknown';
  }

  async function readState() {
    if (!hasChrome) return { preview: previewState(), ...PREVIEW_STATES[previewState()] };
    const out = { kind: 'unknown', stats: null, reuse: null, kept: null, unprotected: null, installedAt: null, intent: false };
    try { out.kind = await readKind(); } catch { out.kind = 'unknown'; }
    try { out.stats = await send('GET_STATS'); } catch { out.stats = null; }
    const st = out.stats || {};
    // Starred and pinned clips are never trimmed and don't count toward the limit.
    if (Number.isFinite(st.removableClips) && Number.isFinite(st.totalClips)) {
      out.unprotected = st.removableClips;
      out.kept = Math.max(0, st.totalClips - st.removableClips);
    }
    try {
      // Optional: the full clip list only feeds the copied-back total. A huge
      // history can time out here, and the page simply drops that card.
      const clips = await send('GET_CLIPS');
      if (Array.isArray(clips)) {
        out.reuse = clips.reduce((sum, c) => sum + (Number.isFinite(c && c.usageCount) && c.usageCount > 0 ? c.usageCount : 0), 0);
        if (!Number.isFinite(out.kept)) {
          out.kept = clips.filter(c => c && (c.starred || c.pinned)).length;
          out.unprotected = clips.length - out.kept;
        }
      }
    } catch { out.reuse = null; }
    try {
      const local = await chrome.storage.local.get(['installedAt', 'upgradeIntentAt']);
      const d = Number(local.installedAt);
      if (Number.isFinite(d) && d > Date.UTC(2024, 0, 1) && d <= Date.now()) out.installedAt = d;
      out.intent = Number(local.upgradeIntentAt) > 0;
    } catch { /* keep defaults */ }
    return out;
  }

  /* ---------------- rendering ---------------- */

  function setText(sel, text) { const el = $(sel); if (el) el.textContent = text; }
  const valid = (n) => Number.isFinite(n) && n >= 0;

  function renderVersion() {
    let v = RELEASE;
    try { if (hasChrome) v = chrome.runtime.getManifest().version || RELEASE; } catch { /* keep RELEASE */ }
    $$('[data-version]').forEach(el => {
      if (el.dataset.version === 'release') el.textContent = RELEASE;
      else el.textContent = el.dataset.version === 'v' ? 'v' + v : v;
    });
  }

  function renderHero(state) {
    const n = state.stats && Number(state.stats.totalClips);
    if (!valid(n) || n === 0) {
      $('#heroLine2Count').hidden = true;
      $('#heroLine2Plain').hidden = false;
      return;
    }
    setText('#heroClips', nf.format(n));
    setText('#heroClipsNoun', n === 1 ? 'clip' : 'clips');
    $('#heroLine2Count').hidden = false;
    $('#heroLine2Plain').hidden = true;
  }

  function renderStats(state) {
    ['#cardClips', '#cardReuse', '#cardKeep'].forEach(sel => { $(sel).hidden = true; });
    $('#stats').hidden = true;

    const s = state.stats || {};
    const cards = [];
    const total = Number(s.totalClips);
    const max = Number(s.maxClips);
    if (valid(total) && total > 0) {
      setText('#statClips', nf.format(total));
      setText('#statClipsLabel', total === 1 ? 'Clip saved right now' : 'Clips saved right now');
      const counted = valid(state.unprotected) ? state.unprotected : total;
      if (state.kind === 'free' && valid(max) && max > 0) setText('#statClipsNote', counted >= max ? 'your free history is full' : 'free keeps the latest ' + nf.format(max));
      else if (state.kind === 'protected') setText('#statClipsNote', 'room for 10,000 with Pro');
      else if (state.kind === 'lapsed' && counted > 100) setText('#statClipsNote', 'over the free limit, so each copy replaces one old clip');
      else setText('#statClipsNote', '');
      cards.push('#cardClips');
    }
    if (valid(state.reuse) && state.reuse > 0) {
      setText('#statReuse', nf.format(state.reuse));
      setText('#statReuseLabel', state.reuse === 1 ? 'Time pasted back from history' : 'Times pasted back from history');
      cards.push('#cardReuse');
    }
    const pinned = Number(s.pinnedCount), starred = Number(s.starredCount);
    const kept = valid(state.kept) ? state.kept : (valid(pinned) && valid(starred) ? Math.max(pinned, starred) : NaN);
    if (valid(kept) && valid(total) && total > 0) {
      setText('#statKeep', nf.format(kept));
      setText('#statKeepLabel', kept === 1 ? 'Clip pinned or starred' : 'Clips pinned or starred');
      setText('#statKeepNote', kept === 0 ? 'pin a favorite and it will never be trimmed' : 'never trimmed when history fills up');
      cards.push('#cardKeep');
    }
    if (cards.includes('#cardClips')) {
      cards.forEach(sel => { $(sel).hidden = false; });
      $('#stats').hidden = false;
      if (changesAutoOpened) { $('#changes').open = false; changesAutoOpened = false; }
    } else if (!$('#changes').open) {
      // Nothing to count yet, so the release notes are the main content.
      $('#changes').open = true;
      changesAutoOpened = true;
    }
    const full = state.kind === 'free' && valid(max) && max > 0 && valid(state.unprotected) && state.unprotected >= max;
    if (full) setText('#pivotSub', 'Your history is full, so each new copy now replaces an older clip.');
  }

  async function renderShortcuts() {
    if (!hasChrome || !chrome.commands || !chrome.commands.getAll) return;
    try {
      const cmds = await chrome.commands.getAll();
      cmds.forEach(c => {
        $$('[data-cmd="' + c.name + '"]').forEach(el => { el.textContent = c.shortcut || 'Not set'; });
      });
    } catch { /* keep the markup */ }
  }

  function applyKind(kind) {
    document.documentElement.dataset.member = kind;
    $$('[data-for]').forEach(el => {
      el.hidden = !el.dataset.for.split(/\s+/).includes(kind);
    });
  }

  /* ---------------- links and actions ---------------- */

  function decorateLinks() {
    $$('a[data-cta]').forEach(a => {
      try {
        const u = new URL(a.getAttribute('href'));
        u.searchParams.set('utm_source', 'clipboard-history-pro');
        u.searchParams.set('utm_medium', 'extension');
        u.searchParams.set('utm_campaign', CAMPAIGN);
        u.searchParams.set('utm_content', a.dataset.cta);
        if (!u.searchParams.has('ref')) u.searchParams.set('ref', 'clipboard-history-pro');
        a.href = u.toString();
      } catch { /* leave the authored href */ }
      a.addEventListener('click', () => {
        if (!hasChrome || !/^plan-/.test(a.dataset.cta)) return;
        chrome.storage.local.set({ upgradeIntentAt: Date.now(), upgradeSource: CAMPAIGN + ':' + a.dataset.cta }).catch(() => {});
      });
    });
  }

  function markNewTabLinks() {
    $$('a[target="_blank"]').forEach(a => {
      const hint = document.createElement('span');
      hint.className = 'sr-only';
      hint.textContent = ' (opens in a new tab)';
      a.append(hint);
    });
  }

  function bindActions() {
    $$('[data-open]').forEach(btn => btn.addEventListener('click', () => {
      if (btn.dataset.open !== 'shortcuts') return;
      if (hasChrome) chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      else toast('In the extension this opens chrome://extensions/shortcuts.');
    }));

    const optout = $('#optout');
    if (optout) {
      if (hasChrome) {
        chrome.storage.sync.get('whatsNewOptOut').then(r => { optout.checked = r.whatsNewOptOut === true; }).catch(() => {});
      }
      optout.addEventListener('change', () => {
        const value = optout.checked;
        if (hasChrome) chrome.storage.sync.set({ whatsNewOptOut: value }).catch(() => {});
        toast(value ? 'Got it. Update pages stay closed from now on.' : 'Update pages are back on.');
      });
    }
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { t.textContent = ''; }, 250);
    }, 2600);
  }

  function renderPreviewBar(current) {
    const bar = $('#previewBar');
    if (!bar) return;
    bar.hidden = false;
    $$('a[data-preview]', bar).forEach(a => {
      if (a.dataset.preview === current) a.setAttribute('aria-current', 'true');
    });
    const theme = new URLSearchParams(location.search).get('theme');
    if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
  }

  /* ---------------- boot ---------------- */

  async function boot() {
    renderVersion();
    decorateLinks();
    markNewTabLinks();
    bindActions();
    renderShortcuts();
    const state = await readState();
    applyKind(state.kind);
    renderHero(state);
    renderStats(state);
    if (state.kind === 'free' && state.intent) $('#paidNote').hidden = false;
    if (state.preview) renderPreviewBar(state.preview);
    if (hasChrome) chrome.storage.local.set({ whatsNewSeen: RELEASE, whatsNewSeenAt: Date.now() }).catch(() => {});

    // The update tab opens in the background; refresh the numbers the first
    // time someone actually looks at it.
    if (hasChrome && document.visibilityState !== 'visible') {
      document.addEventListener('visibilitychange', async function onShow() {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', onShow);
        const fresh = await readState();
        applyKind(fresh.kind);
        renderHero(fresh);
        renderStats(fresh);
      });
    }

    // This update's first license re-check can change the tier while the
    // tab is open; follow it so a revoked key never reads "Your Pro is active".
    if (hasChrome) {
      chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area !== 'sync' || !('tier' in changes || 'licenseKey' in changes)) return;
        const fresh = await readState();
        applyKind(fresh.kind);
        renderStats(fresh);
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
