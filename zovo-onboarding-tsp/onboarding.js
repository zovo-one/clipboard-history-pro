/* ============================================================
   Clipboard History Pro. Onboarding controller (Zovo serif design)
   7-step flow. Runs in the extension (chrome.*) and standalone
   (graceful fallback for manual preview). NASA-clean: bounded
   loops, every getElementById guarded, no throwing at top level,
   no globals leaked. Every ID/selector here exists in onboarding.html.
   ============================================================ */
(function () {
  'use strict';

  const TOTAL = 4;
  const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage;

  let current = 1;

  const $ = (id) => document.getElementById(id);
  const steps = Array.from(document.querySelectorAll('.step'));
  const dots = Array.from(document.querySelectorAll('.dot'));
  const nextBtn = $('nextBtn'), backBtn = $('backBtn'), nextLabel = $('nextLabel');
  const counter = $('counter'), fill = $('progressFill');

  /* ---------- next-button labels ---------- */
  const GENERIC = { 1: 'Show me', 2: 'Set it up', 3: 'Save and continue', 4: 'Start clipping' };
  function nextLabelFor(n) {
    const s = steps.find((x) => +x.dataset.step === n);
    if (s && s.dataset.next) return s.dataset.next;
    return GENERIC[n] || 'Next';
  }

  /* ---------- render ---------- */
  function render() {
    steps.forEach((s) => s.classList.toggle('active', +s.dataset.step === current));
    dots.forEach((d) => {
      const n = +d.dataset.step;
      d.classList.toggle('active', n === current);
      d.classList.toggle('done', n < current);
    });
    if (counter) counter.textContent = String(current).padStart(2, '0') + ' / ' + String(TOTAL).padStart(2, '0');
    if (fill) fill.style.width = (current / TOTAL) * 100 + '%';
    if (backBtn) backBtn.hidden = current === 1;
    if (nextLabel) nextLabel.textContent = nextLabelFor(current);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function go(n) { current = Math.max(1, Math.min(TOTAL, n)); render(); }

  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (current === 3) { persistSetup(); }
    if (current === TOTAL) { finish(); return; }
    go(current + 1);
  });
  if (backBtn) backBtn.addEventListener('click', () => go(current - 1));
  dots.forEach((d) => d.addEventListener('click', () => go(+d.dataset.step)));
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' && current < TOTAL) go(current + 1);
    if (e.key === 'ArrowLeft' && current > 1) go(current - 1);
  });

  /* ---------- clipboard write (real) with a safe fallback ---------- */
  async function writeClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) { /* fall through to legacy path */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (_) { return false; }
  }

  /* ---------- Step 2: real interactive first-value demo ----------
     Copy a sample snippet -> it writes to the real clipboard AND stacks
     into a live history list. Click any saved clip -> it copies back.  */
  const MAX_CLIPS = 20;
  const srcRow = $('srcRow'), histList = $('histList'), histEmpty = $('histEmpty');
  const clipCount = $('clipCount'), clipCap = $('clipCap');
  let captured = 0;

  function kindBadgeClass(kind) { return kind === 'Code' ? 'badge suspended' : 'badge active'; }

  function flash(el, msg, revert) {
    if (!el) return;
    el.classList.add('flash');
    el.textContent = msg;
    setTimeout(() => { el.classList.remove('flash'); el.textContent = revert; }, 1300);
  }

  function addToHistory(text, kind) {
    if (!histList || captured >= MAX_CLIPS) return;
    if (histEmpty) histEmpty.style.display = 'none';

    // The demo is real: clips copied here land in the actual history, so the
    // popup opens with value already in it (the onboarding page has no content
    // script, so without this the "watch it stick" promise captures nothing).
    if (hasChrome && chrome.runtime && chrome.runtime.sendMessage) {
      try { chrome.runtime.sendMessage({ action: 'ADD_CLIP', content: text, type: 'text' }); } catch (_) {}
    }

    const item = document.createElement('div');
    item.className = 'dtab';
    item.dataset.clip = text;

    const fav = document.createElement('span'); fav.className = 'fav';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = text;
    const badge = document.createElement('span'); badge.className = kindBadgeClass(kind); badge.textContent = kind;
    const cb = document.createElement('span'); cb.className = 'copyback'; cb.textContent = 'Copy back';

    item.appendChild(fav); item.appendChild(nm); item.appendChild(badge); item.appendChild(cb);

    item.addEventListener('click', async () => {
      const ok = await writeClipboard(item.dataset.clip);
      flash(item.querySelector('.copyback'), ok ? 'Copied back' : 'Press Ctrl+C', 'Copy back');
    });

    histList.insertBefore(item, histList.firstChild);
    captured += 1;
    if (clipCount) clipCount.innerHTML = String(captured) + '<small> clips</small>';
    if (clipCap) clipCap.textContent = captured === 1
      ? 'Saved. Click it to copy it back to your clipboard'
      : 'All still here. Click any clip to copy it back';
  }

  if (srcRow) srcRow.addEventListener('click', async (e) => {
    const chip = e.target.closest('.src-chip');
    if (!chip || chip.classList.contains('copied')) return;
    const text = chip.dataset.clip || '';
    const kind = chip.dataset.kind || 'Text';
    const ok = await writeClipboard(text);
    chip.classList.add('copied');
    const act = chip.querySelector('.sc-act');
    if (act) act.textContent = ok ? 'Copied' : 'Selected';
    addToHistory(text, kind);
  });

  /* ---------- Step 3: setup, persist directly to chrome.storage.local ---------- */
  function persistSetup() {
    const form = $('setupForm');
    if (!form) return;
    const inputs = Array.from(form.querySelectorAll('input[data-setting]'));
    if (!inputs.length) return;
    const settings = {};
    inputs.forEach((el) => { settings[el.dataset.setting] = !!el.checked; });
    if (!hasChrome) return;
    try { chrome.storage.local.set({ clipboardSettings: settings, clipboardSettingsAt: Date.now() }); }
    catch (e) { /* never throw during onboarding */ }
  }

  /* ---------- Final step: finish ---------- */
  function finish() {
    if (!hasChrome) { if (nextLabel) nextLabel.textContent = 'Done'; return; }
    try {
      chrome.storage.local.set({ onboardingComplete: true, onboardingAt: Date.now() });
      window.close();
    } catch (_) { /* leave the tab open if close is blocked */ }
  }

  /* ---------- deep-link a step (preview/screenshots): ?step=4 ---------- */
  try {
    const q = +new URLSearchParams(location.search).get('step');
    if (q >= 1 && q <= TOTAL) current = q;
  } catch (_) {}

  render();
})();
