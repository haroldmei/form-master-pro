// Handle left-click on the browser action icon
chrome.action.onClicked.addListener((tab) => {
  // Print content to console (left-click functionality)
  chrome.storage.local.get(['jsonData'], function(result) {
    if (result.jsonData) {
      console.log('Stored JSON Data:', result.jsonData);
      chrome.action.setBadgeText({ text: "✓" });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: "" });
      }, 2000);
    } else {
      chrome.action.setBadgeText({ text: "!" });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: "" });
      }, 2000);
      console.log('No data loaded yet. Right-click to load a file.');
    }
  });
});

// Create context menu for file upload (right-click functionality)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "loadJsonFile",
    title: "Load JSON File",
    contexts: ["action"]
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "loadJsonFile") {
    // We need to open a small popup to select a file since file selection can't be done directly
    chrome.windows.create({
      url: "file-selector.html",
      type: "popup",
      width: 400,
      height: 200
    });
  }
});
