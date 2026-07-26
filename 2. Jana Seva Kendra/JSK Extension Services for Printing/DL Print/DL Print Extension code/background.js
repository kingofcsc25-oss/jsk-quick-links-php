/* =========================================================
   DL PRINT - BACKGROUND SERVICE WORKER | © JSK QUICK LINKS
   ========================================================= */

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHePxZX-N9zhInQVQQWStSfYEv3tg9ptR4UORWGrIjZfbzL2AMw2kcgSDRK3pexCNS/exec";

// ─── AUTO-RESTORE ON INSTALL / REINSTALL ─────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
    console.log("DL Print Only Extension Installed/Updated:", details.reason);

    // Always reset automation state cleanly
    chrome.storage.local.set({ automation_status: 'stopped' });

    // On fresh install or reinstall, try to restore agent data from backend
    if (details.reason === 'install' || details.reason === 'update') {
        _restoreAgentDataFromServer();
    }
});

// ─── AUTO-RESTORE FUNCTION ───────────────────────────────────────────────────
function _restoreAgentDataFromServer() {
    // Step 1: Get Google Profile email
    chrome.identity.getProfileUserInfo((userInfo) => {
        if (chrome.runtime.lastError) {
            console.log("Identity error:", chrome.runtime.lastError.message);
            _tryRestoreFromSync();
            return;
        }
        const email = (userInfo && userInfo.email) ? userInfo.email.trim() : '';
        if (!email) {
            console.log("No Google account found. Trying sync storage fallback.");
            _tryRestoreFromSync();
            return;
        }

        console.log("DL Print: Checking server for agent data for email:", email);

        // Step 2: Query backend for this email
        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'GET_AGENT', email: email })
        })
        .then(r => r.json())
        .then(apiRes => {
            if (apiRes && apiRes.success && apiRes.data && apiRes.data.agentName) {
                // ✅ Found existing agent data - restore it!
                const data = {
                    agent_name:       apiRes.data.agentName,
                    agent_mob_no:     apiRes.data.mobile,
                    agent_dist:       apiRes.data.district,
                    wallet_balance:   apiRes.data.balance || 0,
                    agent_registered: true,
                    payment_verified: true,
                    welcome_code_used: apiRes.data.welcomeClaimed || false,
                    automation_status: 'stopped'
                };
                chrome.storage.local.set(data, () => {
                    console.log("✅ DL Print: Agent data restored from server!", apiRes.data.agentName);
                });
                // Also back up to sync storage
                chrome.storage.sync.set(data, () => {
                    console.log("✅ DL Print: Agent data backed up to sync storage.");
                });
            } else {
                console.log("No server data found. Trying sync storage fallback.");
                _tryRestoreFromSync();
            }
        })
        .catch(err => {
            console.log("Server fetch failed, trying sync storage:", err);
            _tryRestoreFromSync();
        });
    });
}

// ─── SYNC STORAGE FALLBACK ───────────────────────────────────────────────────
function _tryRestoreFromSync() {
    chrome.storage.sync.get(
        ['agent_name', 'agent_mob_no', 'agent_dist', 'agent_registered',
         'payment_verified', 'wallet_balance', 'welcome_code_used'],
        (syncRes) => {
            if (syncRes && syncRes.agent_registered) {
                chrome.storage.local.set(syncRes, () => {
                    console.log("✅ DL Print: Agent data restored from sync storage!", syncRes.agent_name);
                });
            } else {
                console.log("No sync data found. User will need to register.");
            }
        }
    );
}

// ─── EXTENSION ICON CLICK ────────────────────────────────────────────────────
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: "https://sarathi.parivahan.gov.in/sarathiservice/stateSelection.do?dl_ext=true" }, (newTab) => {
        chrome.storage.local.set({ active_ext_tab_id: newTab.id });
    });
});

// ─── MESSAGE HANDLERS ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action === 'setActiveTabId') {
        if (sender.tab) {
            chrome.storage.local.set({ active_ext_tab_id: sender.tab.id });
        }
        sendResponse(true);
        return true;
    }

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
    }

    if (request.action === 'openPayUTab') {
        chrome.tabs.create({ url: request.url, active: true });
    }

    if (request.action === 'getUserEmail') {
        chrome.identity.getProfileUserInfo((userInfo) => {
            sendResponse({ email: (userInfo && userInfo.email) ? userInfo.email : '' });
        });
        return true;
    }

    if (request.action === 'apiCall') {
        fetch(request.url, request.options)
            .then(r => r.json())
            .then(data => sendResponse(data))
            .catch(err => sendResponse(null));
        return true;
    }

    if (request.action === 'restoreAgentData') {
        // Allow content.js to manually trigger a restore
        _restoreAgentDataFromServer();
        sendResponse({ started: true });
        return true;
    }
});

