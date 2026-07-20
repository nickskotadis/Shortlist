document.getElementById("open-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://shortlist-amber.vercel.app/generate" });
});
