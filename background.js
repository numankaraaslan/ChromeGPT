chrome.action.onClicked.addListener((tab) => {
  const PANEL_WIDTH = 450;

  chrome.windows.getCurrent({}, (currentWindow) => {
    chrome.windows.create({
      url: chrome.runtime.getURL(
        "sidepanel.html?tabId=" + tab.id
      ),
      type: "popup",
      width: PANEL_WIDTH,
      height: currentWindow.height,
      left: currentWindow.left + currentWindow.width - PANEL_WIDTH,
      top: currentWindow.top
    });
  });
});
