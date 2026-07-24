chrome.runtime.onInstalled.addListener(() => {
    console.log("Nada Kacheri Extension Installed");
});

chrome.action.onClicked.addListener((currentTab) => {
    const portalUrl = "http://localhost:8080";
    chrome.tabs.create({ url: portalUrl, active: true });
});
