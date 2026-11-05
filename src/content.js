// Clipboard History Pro - Content Script
// Captures copy events and sends to background
//
// Idempotence guard: this file is injected both by the manifest (new page
// loads) and programmatically at install time (tabs already open), so a page
// can receive it twice. Bind once.
if (window.__zovoClipCS) {
    // Already bound in this document - nothing to do.
} else {
    window.__zovoClipCS = true;

// One user action saves at most one clip. Every copy a page fires with
// execCommand('copy') during a click is a TRUSTED event, and Chrome allows
// them for about 5 s after the click, so isTrusted alone lets one click on a
// hostile page plant dozens of clips (and trim real ones on the free plan).
// Count real clicks, taps and copy/cut key shortcuts; each one can be used by
// a single capture. Plain typing does not count, so a page cannot plant a
// clip per keystroke. If a page hides these events from us, fall back to at
// most one capture per 6 s (longer than the 5 s activation window).
let userActionSeq = 0;
let usedActionSeq = -1;
let lastCaptureAt = -Infinity;
const NO_ACTION_GAP_MS = 6000;
function noteUserAction(e) {
    if (!e || e.isTrusted !== true) return;
    if (e.type === 'keydown' && !(e.ctrlKey || e.metaKey || e.key === 'Insert' || e.key === 'ContextMenu'
            || (e.shiftKey && e.key === 'Delete'))) return;
    userActionSeq++;
}
for (const type of ['pointerdown', 'mousedown', 'touchstart', 'keydown']) {
    window.addEventListener(type, noteUserAction, { capture: true, passive: true });
}
function claimUserAction() {
    const now = performance.now();
    if (userActionSeq === usedActionSeq && now - lastCaptureAt < NO_ACTION_GAP_MS) return false;
    usedActionSeq = userActionSeq;
    lastCaptureAt = now;
    return true;
}

// Capture copied/cut text SYNCHRONOUSLY from the selection, inside the event.
//
// The previous implementation deferred navigator.clipboard.readText() in a
// setTimeout: in a content script that read is NOT covered by the extension's
// clipboardRead permission (it is gated by the page's Permissions-Policy and by
// transient user activation), so detaching it from the copy gesture made it
// reject with NotAllowedError on most sites - and on http:// pages
// navigator.clipboard is undefined and it threw TypeError. Every failure was
// swallowed, so the history stayed permanently empty ("does not work").
//
// Reading the selection inside the event needs no clipboard permission, no
// focus, and no async, so it works on secure and non-secure pages alike.
function captureSelection(event) {
    // Only a real user copy counts. A page can dispatch synthetic copy/cut
    // events (new Event('copy')) with no user gesture; those have
    // isTrusted === false and must never write into, or trim, the history.
    if (!event || event.isTrusted !== true) return;
    // Copies made in incognito windows (when the user allows the extension
    // there) are never recorded: the history lives in the regular profile.
    try {
        if (chrome.extension && chrome.extension.inIncognitoContext) return;
    } catch (err) {
        return;
    }
    let text = '';
    try {
        // Page text selection - covers the overwhelming majority of copies.
        const sel = document.getSelection();
        text = sel ? sel.toString() : '';

        // Selection inside <input>/<textarea> is not in document.getSelection().
        if (!text) {
            const el = document.activeElement;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
                   && typeof el.selectionStart === 'number') {
                text = String(el.value).slice(el.selectionStart, el.selectionEnd);
            }
        }
    } catch (err) {
        text = '';
    }

    if (text && text.trim()) {
        if (!claimUserAction()) return;   // one user action, at most one clip
        try {
            chrome.runtime.sendMessage({ action: 'ADD_CLIP', content: text, type: 'text' });
        } catch (err) {
            // Extension context invalidated (e.g. reload) - nothing to do.
        }
    }
}

document.addEventListener('copy', captureSelection);
document.addEventListener('cut', captureSelection);

// Listen for paste requests from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'PASTE_CLIP') {
        const activeElement = document.activeElement;

        if (activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        )) {
            // Insert text at cursor
            if (activeElement.isContentEditable) {
                document.execCommand('insertText', false, message.content);
            } else {
                const start = activeElement.selectionStart;
                const end = activeElement.selectionEnd;
                const value = activeElement.value;

                activeElement.value = value.slice(0, start) + message.content + value.slice(end);
                activeElement.selectionStart = activeElement.selectionEnd = start + message.content.length;

                // Trigger input event
                activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            }

            sendResponse({ success: true });
        } else {
            // Copy to clipboard if no editable element
            navigator.clipboard.writeText(message.content)
                .then(() => sendResponse({ success: true, copied: true }))
                .catch(() => sendResponse({ success: false }));
        }

        return true; // Async response
    }
});
}
