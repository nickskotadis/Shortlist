document.getElementById("open-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://shortlist.sko.codes/generate" });
});
