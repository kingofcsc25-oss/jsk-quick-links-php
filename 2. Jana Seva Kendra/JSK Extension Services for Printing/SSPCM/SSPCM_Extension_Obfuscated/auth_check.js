// auth_check.js
// Handles Google Chrome Profile Login tracking on Popup Load

document.addEventListener('DOMContentLoaded', () => {
    const authStatusEl = document.getElementById('chromeAuthStatus');
    const lockScreen = document.getElementById('email-lock-screen');
    const mainUI = document.querySelector('.glass-panel');
    const regPanel = document.getElementById('registration-panel');

    if (!authStatusEl) return;

    // Check Chrome Identity
    if (chrome.identity && chrome.identity.getProfileUserInfo) {
        chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
            if (userInfo && userInfo.email) {
                // Success: Signed in
                authStatusEl.innerText = '✅ Authenticated: ' + userInfo.email;
                authStatusEl.style.color = '#00e090';
                authStatusEl.style.borderColor = 'rgba(0, 224, 144, 0.3)';
                authStatusEl.style.background = 'rgba(0, 224, 144, 0.1)';
                
                // Hide Lock Screen just in case
                if (lockScreen) lockScreen.style.display = 'none';

                // Save to local storage for the background worker to use
                chrome.storage.local.set({ ssp_google_profile: userInfo.email });
                
                // RESTORE MEMORY: Check if data is in sync but missing locally
                chrome.storage.local.get(['ssp_agent_name'], (localData) => {
                    if (!localData.ssp_agent_name) {
                        chrome.storage.sync.get(['ssp_agent_id', 'ssp_agent_rc_no', 'ssp_agent_name', 'ssp_agent_mob', 'ssp_agent_email', 'ssp_wallet_balance', 'ssp_payment_logs'], (syncData) => {
                            if (syncData.ssp_agent_name) {
                                // Data found in sync! Restore it locally.
                                chrome.storage.local.set(syncData, () => {
                                    alert("Welcome back Dear " + syncData.ssp_agent_name + "! Your memory has been successfully restored.");
                                    // Reload popup to apply restored data
                                    window.location.reload();
                                });
                            }
                        });
                    }
                });
                
            } else {
                // Fail: Not Signed In
                authStatusEl.innerText = '❌ Chrome Profile Not Found. Please Sign In.';
                authStatusEl.style.color = '#ff7070';
                authStatusEl.style.borderColor = 'rgba(255, 112, 112, 0.4)';
                authStatusEl.style.background = 'rgba(255, 112, 112, 0.1)';
                
                // Show Lock Screen Over Everything
                if (lockScreen) {
                    lockScreen.style.display = 'flex';
                }
            }
        });
    } else {
        authStatusEl.innerText = '❌ Chrome Identity API Not Available';
        if (lockScreen) {
            lockScreen.style.display = 'flex';
        }
    }

    const btnRetryAuth = document.getElementById('btnRetryAuth');
    if (btnRetryAuth) {
        btnRetryAuth.addEventListener('click', () => {
            window.location.reload();
        });
    }

    // Populate SSP ID in the top-left badge
    chrome.storage.local.get(['ssp_agent_id'], (data) => {
        const displaySspId = document.getElementById('displaySspId');
        if (displaySspId && data.ssp_agent_id) {
            displaySspId.innerText = 'SSP ID: ' + data.ssp_agent_id;
        }
    });

    // EDIT PROFILE HANDLER
    const agentNameBadge = document.getElementById('agentNameBadge');
    if (agentNameBadge) {
        agentNameBadge.addEventListener('click', () => {
            chrome.storage.local.get(['ssp_agent_name', 'ssp_agent_mob', 'ssp_agent_email', 'ssp_agent_id'], (data) => {
                const updateModal = document.getElementById('updateProfileModal');
                if (updateModal) {
                    updateModal.style.display = 'flex';
                    
                    if (document.getElementById('updAgentName')) document.getElementById('updAgentName').value = data.ssp_agent_name || '';
                    if (document.getElementById('updAgentMob')) document.getElementById('updAgentMob').value = data.ssp_agent_mob || '';
                    if (document.getElementById('updAgentEmail')) document.getElementById('updAgentEmail').value = data.ssp_agent_email || '';
                    if (document.getElementById('updAgentId')) document.getElementById('updAgentId').value = data.ssp_agent_id || '';
                }
            });
        });
    }

    const btnCancelUpdate = document.getElementById('btnCancelUpdate');
    if (btnCancelUpdate) {
        btnCancelUpdate.addEventListener('click', () => {
            const updateModal = document.getElementById('updateProfileModal');
            if (updateModal) updateModal.style.display = 'none';
        });
    }

    const btnUpdateData = document.getElementById('btnUpdateData');
    if (btnUpdateData) {
        btnUpdateData.addEventListener('click', () => {
            const agentName = document.getElementById('updAgentName') ? document.getElementById('updAgentName').value.trim() : '';
            const agentMob = document.getElementById('updAgentMob') ? document.getElementById('updAgentMob').value.trim() : '';
            const agentEmail = document.getElementById('updAgentEmail') ? document.getElementById('updAgentEmail').value.trim() : '';
            const agentIdInput = document.getElementById('updAgentId') ? document.getElementById('updAgentId').value.trim() : '';
            
            if (!agentName || !agentMob) {
                alert("Please fill in both Agent Name and Mobile Number!");
                return;
            }

            btnUpdateData.innerText = "Updating...";
            
            chrome.storage.local.get(['ssp_agent_rc_no', 'ssp_wallet_balance', 'ssp_payment_logs'], (existingData) => {
                const dataToSave = {
                    ssp_agent_id: agentIdInput || "SSP-" + Math.floor(1000 + Math.random() * 9000),
                    ssp_agent_rc_no: existingData.ssp_agent_rc_no || "SSP" + Date.now().toString().slice(-4),
                    ssp_agent_name: agentName,
                    ssp_agent_mob: agentMob,
                    ssp_agent_email: agentEmail,
                    ssp_wallet_balance: existingData.ssp_wallet_balance || 0,
                    ssp_payment_logs: existingData.ssp_payment_logs || []
                };

                chrome.storage.local.set(dataToSave, () => {
                    chrome.storage.sync.set(dataToSave, () => {
                        window.location.reload();
                    });
                });
            });
        });
    }

    // REGISTRATION SAVE HANDLER
    const btnSaveReg = document.getElementById('btnSaveRegistration');
    if (btnSaveReg) {
        btnSaveReg.addEventListener('click', () => {
            const agentName = document.getElementById('regAgentName') ? document.getElementById('regAgentName').value.trim() : '';
            const agentMob = document.getElementById('regAgentMob') ? document.getElementById('regAgentMob').value.trim() : '';
            const agentEmail = document.getElementById('regAgentEmail') ? document.getElementById('regAgentEmail').value.trim() : '';
            let agentIdInput = document.getElementById('regAgentId') ? document.getElementById('regAgentId').value.trim() : '';
            
            if (!agentName || !agentMob) {
                alert("Please fill in both Agent Name and Mobile Number!");
                return;
            }

            const btnOriginalText = btnSaveReg.innerText;
            btnSaveReg.innerText = "Saving...";
            
            if (!agentIdInput) {
                agentIdInput = "SSP-" + Math.floor(1000 + Math.random() * 9000);
            }

            const dataToSave = {
                ssp_agent_id: agentIdInput,
                ssp_agent_rc_no: "SSP" + Date.now().toString().slice(-4),
                ssp_agent_name: agentName,
                ssp_agent_mob: agentMob,
                ssp_agent_email: agentEmail,
                ssp_wallet_balance: 0,
                ssp_payment_logs: []
            };

            chrome.storage.local.set(dataToSave, () => {
                chrome.storage.sync.set(dataToSave, () => {
                    btnSaveReg.innerText = btnOriginalText;
                    const regPanel = document.getElementById('registration-panel');
                    if (regPanel) regPanel.style.display = 'none';
                    window.location.reload();
                });
            });
        });
    }
});
