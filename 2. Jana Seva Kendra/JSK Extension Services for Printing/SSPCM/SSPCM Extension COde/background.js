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
  } else if (message.action === 'close_payment_window') {
    if (message.windowId) {
      chrome.windows.remove(message.windowId);
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
