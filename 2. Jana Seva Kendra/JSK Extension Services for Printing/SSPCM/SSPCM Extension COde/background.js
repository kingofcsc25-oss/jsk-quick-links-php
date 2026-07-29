// background.js - SSPCM Scholarship Mobile Update Automation Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("SSPCM Scholarship Mobile Update Automation Extension installed successfully!");

  // Restore Agent Data and Wallet from Cloud Sync if the user reinstalls
  chrome.storage.sync.get([
    'ssp_agent_id', 'ssp_agent_name', 'ssp_agent_mob', 'ssp_wallet_balance', 'ssp_payment_logs'
  ], (syncData) => {
    if (syncData.ssp_agent_id) {
      chrome.storage.local.set({
        ssp_agent_id: syncData.ssp_agent_id,
        ssp_agent_name: syncData.ssp_agent_name,
        ssp_agent_mob: syncData.ssp_agent_mob,
        ssp_wallet_balance: syncData.ssp_wallet_balance !== undefined ? syncData.ssp_wallet_balance : 0,
        ssp_payment_logs: syncData.ssp_payment_logs || []
      }, () => {
        console.log("SSP Automator: Restored Agent Data and Wallet from Cloud Backup!");
      });
    }
  });
});

// Auto-Backup local storage changes to Cloud Sync
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    let syncUpdates = {};
    let needsSync = false;
    
    ['ssp_agent_id', 'ssp_agent_name', 'ssp_agent_mob', 'ssp_wallet_balance', 'ssp_payment_logs'].forEach(key => {
      if (changes[key]) {
        syncUpdates[key] = changes[key].newValue;
        needsSync = true;
      }
    });
    
    if (needsSync) {
      chrome.storage.sync.set(syncUpdates);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'close_tab') {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id);
    }
  } else if (message.action === 'open_payment_window') {
    chrome.windows.create({
      url: message.url,
      type: "popup",
      width: 500,
      height: 750,
      focused: true
    }, (win) => {
      sendResponse({ windowId: win.id });
    });
    return true; // Keep channel open for async response
  } else if (message.action === 'bring_tab_to_front') {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.update(sender.tab.id, { active: true });
      if (sender.tab.windowId) {
        chrome.windows.update(sender.tab.windowId, { focused: true });
      }
    }
  } else if (message.action === 'close_payment_window') {
    if (message.windowId) {
      chrome.windows.remove(message.windowId);
    }
  } else if (message.action === 'open_dashboard') {
    const targetUrl = chrome.runtime.getURL("popup.html");
    if (sender.tab && sender.tab.id) {
      chrome.tabs.update(sender.tab.id, { url: targetUrl, active: true });
    }
  }
});

// Auto-stop automation when the specific tab opened by the extension is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  chrome.storage.local.get(['sspcm_active', 'ssp_active_tab_id'], (data) => {
    if (data.sspcm_active && data.ssp_active_tab_id === tabId) {
      chrome.storage.local.set({ sspcm_active: false, ssp_active_tab_id: null });
      console.log("SSP Automation stopped: the tab opened by the extension was closed.");
    }
  });
});

// Open or reuse the SSP portal when the extension icon is clicked and trigger the popup overlay
chrome.action.onClicked.addListener(() => {
  const portalUrl = "https://ssp.karnataka.gov.in/";

  chrome.tabs.query({}, (tabs) => {
    const existingPortal = tabs.find(tab => tab.url && tab.url.includes("ssp.karnataka.gov.in"));
    if (!existingPortal) {
      chrome.tabs.create({ url: portalUrl + "?sspcm_ext=true", active: true }, (newTab) => {
        chrome.storage.local.set({ ssp_active_tab_id: newTab.id });
      });
    } else {
      chrome.storage.local.set({ ssp_active_tab_id: existingPortal.id });
      let finalUrl = existingPortal.url;
      if (!finalUrl.includes('sspcm_ext=true')) {
          finalUrl = finalUrl.includes('?') ? finalUrl + '&sspcm_ext=true' : finalUrl + '?sspcm_ext=true';
      }
      chrome.tabs.update(existingPortal.id, { url: finalUrl, active: true });
      chrome.windows.update(existingPortal.windowId, { focused: true });
    }
  });
});
