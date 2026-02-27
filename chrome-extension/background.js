// background.js — service worker
// Handles extension icon click and context menu (minimal for now)

chrome.action.onClicked.addListener((tab) => {
  // If user clicks the toolbar icon directly (no popup), open popup
  // This is a fallback — normally handled by popup.html
  if (!tab.id) return;
});
