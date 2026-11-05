/* What's new tab (2.2.7). Imported first by background.js (ES module service
 * worker), so these listeners register at the top level of the worker.
 * Opens whats-new.html once per release with notes, after a real update only,
 * in a background tab. */

const RELEASE = "2.2.10";
const QUIET_DAYS = 2;        // skip people who installed moments ago
const MIN_GAP_DAYS = 30;     // never more than one update tab a month
const DAY = 864e5;

let running = null;
let rerun = false;

function compareVersions(a, b) {
  const pa = String(a || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "0").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

async function openTab() {
  const wins = await chrome.windows.getAll({ windowTypes: ["normal"] }).catch(() => []);
  if (!wins.length) {
    await chrome.storage.local.set({ whatsNewPending: RELEASE });
    return;
  }
  // Clear the pending flag first so a second window event can't open a copy.
  await chrome.storage.local.remove("whatsNewPending");
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL("zovo-whats-new/index.html"), active: false });
  } catch (err) {
    console.warn("[WhatsNew] Deferred:", err && err.message);
    await chrome.storage.local.set({ whatsNewPending: RELEASE });
  }
}

// 2.2.10 replaces the old popup rate bar (key ratePromptDone) with the kit card (key
// zovo_rate_card). A user who already clicked or closed the old bar never sees the new card.
async function carryRateBarState() {
  try {
    const { ratePromptDone, zovo_rate_card: cur } = await chrome.storage.local.get(["ratePromptDone", "zovo_rate_card"]);
    if (ratePromptDone !== true || cur) return;
    await chrome.storage.local.set({ zovo_rate_card: { v: 1, shows: 10, lastShownAt: Date.now() } });
  } catch (err) {
    console.warn("[RateCard] Carry-over skipped:", err && err.message);
  }
}

async function maybeOpen(previousVersion) {
  try {
    if (!previousVersion || compareVersions(previousVersion, RELEASE) >= 0) return;
    if (compareVersions(chrome.runtime.getManifest().version, RELEASE) < 0) return;
    // Copies force-installed by an employer get no update tabs.
    const me = chrome.management && chrome.management.getSelf
      ? await chrome.management.getSelf().catch(() => null) : null;
    if (me && me.installType === "admin") return;

    const [sync, local] = await Promise.all([
      chrome.storage.sync.get("whatsNewOptOut"),
      chrome.storage.local.get(["whatsNewShown", "whatsNewShownAt", "monetizationNoticeAt", "installedAt", "zovoLastUpdateTabAt", "zovoWhatsNewOptOut"])
    ]);
    if (sync.whatsNewOptOut === true || local.zovoWhatsNewOptOut === true) return;
    if (local.whatsNewShown === RELEASE) return;
    // Sprint 1030 rule. One Zovo update tab per 30 days at most. With no stored time we cannot prove that 30 days passed, so we store the time now and open nothing.
    const lastTab = Number(local.zovoLastUpdateTabAt);
    if (!Number.isFinite(lastTab) || lastTab <= 0) {
      await chrome.storage.local.set({ zovoLastUpdateTabAt: Date.now() });
      return;
    }
    if (Date.now() - lastTab < MIN_GAP_DAYS * DAY) return;
    // Older builds opened a promo tab on update and stamped monetizationNoticeAt.
    const last = Math.max(Number(local.whatsNewShownAt) || 0, Number(local.monetizationNoticeAt) || 0);
    if (last > 0 && Date.now() - last < MIN_GAP_DAYS * DAY) return;
    const inst = Number(local.installedAt);
    if (Number.isFinite(inst) && inst > 0 && Date.now() - inst < QUIET_DAYS * DAY) return;

    // Written before the tab opens so a crash can never cause a second tab.
    await chrome.storage.local.set({ whatsNewShown: RELEASE, whatsNewShownAt: Date.now(), zovoLastUpdateTabAt: Date.now() });
    await openTab();
  } catch (err) {
    console.warn("[WhatsNew] Skipped:", err && err.message);
  }
}

// Several windows can open at once after a restart; one attempt at a time,
// plus one more pass if a window arrived while an attempt was running.
function openPending() {
  if (running) { rerun = true; return running; }
  rerun = false;
  running = (async () => {
    try {
      const { whatsNewPending } = await chrome.storage.local.get("whatsNewPending");
      if (whatsNewPending !== RELEASE) return;
      const { whatsNewOptOut } = await chrome.storage.sync.get("whatsNewOptOut");
      if (whatsNewOptOut === true) {
        await chrome.storage.local.remove("whatsNewPending");
        return;
      }
      await openTab();
    } catch (err) {
      console.warn("[WhatsNew] Pending open failed:", err && err.message);
    }
  })().then(() => {
    running = null;
    if (rerun) return openPending();
  });
  return running;
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "update") {
    carryRateBarState();
    maybeOpen(details.previousVersion);
  }
});
chrome.runtime.onStartup.addListener(() => { openPending(); });
chrome.windows.onCreated.addListener((win) => {
  if (win && win.type === "normal") openPending();
});

self.WhatsNewTrigger = { maybeOpen, openPending, RELEASE };
