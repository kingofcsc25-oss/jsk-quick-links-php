chrome.runtime.onInstalled.addListener(() => {
    console.log("DL Print Only Extension Installed");
    chrome.storage.local.set({ automation_status: 'stopped' });
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: "https://sarathi.parivahan.gov.in/sarathiservice/stateSelection.do?dl_ext=true" }, (newTab) => {
        chrome.storage.local.set({ active_ext_tab_id: newTab.id });
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkActiveTab') {
        chrome.storage.local.get(['active_ext_tab_id'], (res) => {
            sendResponse(sender.tab && sender.tab.id === res.active_ext_tab_id);
        });
        return true;
    }
    
    if (request.action === 'startAutomation') {
        chrome.storage.local.get(['target_type'], (res) => {
            let url = "";
            if (res.target_type === 'dl') {
                url = "https://sarathi.parivahan.gov.in/sarathiservice/stateSelection.do";
            } else {
                url = "https://vahan.parivahan.gov.in/vahanservice/vahan/ui/statevalidation/homepage.xhtml";
            }
            if (sender.tab) {
                chrome.tabs.update(sender.tab.id, { url: url });
            } else {
                chrome.tabs.create({ url: url });
            }
        });
    } else if (request.action === 'openPayUTab') {
        chrome.tabs.create({ url: request.url, active: true });
    }
});

// PayU callback logic has been securely migrated to content.js to prevent background worker suspension issues and duplicate processing.
