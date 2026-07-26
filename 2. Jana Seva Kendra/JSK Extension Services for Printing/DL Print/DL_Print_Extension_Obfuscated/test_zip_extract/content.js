// Check if this is the authorized extension tab
if (window.location.search.includes('dl_ext=true')) {
    sessionStorage.setItem('dl_print_active', 'true');
    window.history.replaceState({}, document.title, window.location.pathname);
}

// PayU Callbacks intercepted directly in the active tab!
(function handlePayUCallbacks() {
    if (window.location.href.includes('dl-payu-success')) {
        chrome.storage.local.get(['pending_payu_amount', 'wallet_balance', 'agent_name', 'agent_mob_no', 'agent_dist', 'pending_payu_txnid'], (res) => {
            const amount = parseFloat(res.pending_payu_amount) || 0;
            let points = amount;
            if (amount >= 499) { points = amount * 100; } 
            else if (amount >= 99) { points = amount * 10; }
            
            const currentBal = res.wallet_balance || 0;
            const newBal = currentBal + points;
            
            const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHePxZX-N9zhInQVQQWStSfYEv3tg9ptR4UORWGrIjZfbzL2AMw2kcgSDRK3pexCNS/exec";
            fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'PAYMENT',
                    name: res.agent_name || "Unknown",
                    mobile: res.agent_mob_no || "Unknown",
                    district: res.agent_dist || "Unknown",
                    utr: res.pending_payu_txnid || "PAYU_UNKNOWN",
                    amount: amount,
                    welcomeCode: "PAYU_INSTANT",
                    systemId: "PAYU_AUTO"
                })
            }).catch(err => console.log(err));
            
            chrome.storage.local.set({ 
                'payment_verified': true, 
                'wallet_balance': newBal,
                'pending_payu_amount': 0
            }, () => {
                window.location.href = "https://sarathi.parivahan.gov.in/sarathiservice/stateSelection.do?dl_ext=true";
            });
        });
        return true; // Stop execution flag
    }

    if (window.location.href.includes('dl-payu-failure')) {
        window.location.href = "https://sarathi.parivahan.gov.in/sarathiservice/stateSelection.do?dl_ext=true";
        return true; // Stop execution flag
    }
    return false;
})();

if (window.location.href.includes('dl-payu-success') || window.location.href.includes('dl-payu-failure')) {
    // If we are on a callback page, do not run the rest of the extension logic.
} else {

(function() {
    if (sessionStorage.getItem('dl_print_active') !== 'true') return;

let isAuthorizedTab = false;
let authCheckInterval;

function safePing() {
    if (sessionStorage.getItem('dl_print_active') !== 'true') {
        isAuthorizedTab = false;
        return;
    }
    if (!chrome.runtime || !chrome.runtime.id) {
        if (authCheckInterval) clearInterval(authCheckInterval);
        return;
    }
    try {
        chrome.runtime.sendMessage({ action: 'checkActiveTab' }, (isActiveTab) => {
            if (chrome.runtime.lastError) {
                if (authCheckInterval) clearInterval(authCheckInterval);
                return;
            }
            isAuthorizedTab = isActiveTab;
        });
    } catch (e) {
        if (authCheckInterval) clearInterval(authCheckInterval);
    }
}

safePing();
authCheckInterval = setInterval(safePing, 500);

function showExtensionUIIframe(force = false) {
    if (!isAuthorizedTab) return;
    if (window !== window.top) return;

    // --- System ID & Welcome Code Persistence Logic ---
    let jskSysId = localStorage.getItem('jsk_dl_system_id');
    if (!jskSysId) {
        jskSysId = 'SYS-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        localStorage.setItem('jsk_dl_system_id', jskSysId);
    }
    window.currentSystemId = jskSysId;
    window.welcomeCodeAlreadyUsed = localStorage.getItem('jsk_dl_welcome_used_' + jskSysId) === 'true';

    chrome.storage.local.get(['welcome_code_used'], (res) => {
        if (res.welcome_code_used) {
            window.welcomeCodeAlreadyUsed = true;
            localStorage.setItem('jsk_dl_welcome_used_' + jskSysId, 'true');
        }
    });

    if (sessionStorage.getItem('dl_print_active') === 'true') {
        if (window.location.href.includes('sarathiservice') && !window.location.href.includes('stateSelection.do') && !window.location.href.includes('envaction.do')) {
            window.location.href = "https://sarathi.parivahan.gov.in/sarathiservice/envaction.do";
            return;
        }
    }
    
    let isTargetPage = window.location.href.includes('envaction.do') || window.location.href.includes('stateSelection.do');
    
    if (isTargetPage) {
        sessionStorage.removeItem('hide_dl_popup');
    }

    if (!window.location.href.includes('parivahan.gov.in')) return;
    if (document.getElementById('dl-extension-ui-iframe')) return;

    fetch(chrome.runtime.getURL('popup.html'))
        .then(response => response.text())
        .then(html => {
            let bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/i);
            let bodyContent = bodyMatch ? bodyMatch[1] : html;
            
            let styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
            let styleContent = styleMatch ? styleMatch[1] : '';
            
            let displayStyle = sessionStorage.getItem('hide_dl_popup') === 'true' ? 'none' : 'flex';
            let container = document.createElement('div');
            container.id = 'dl-extension-ui-iframe'; // keep ID same for removal logic
            container.style.cssText = `display: ${displayStyle} !important; width: 100vw !important; height: 100vh !important; border: none !important; background: rgba(15, 23, 42, 0.9) !important; backdrop-filter: blur(8px) !important; position: fixed !important; top: 0 !important; left: 0 !important; z-index: 2147483647 !important; align-items: center !important; justify-content: center !important; animation: fadeIn 0.3s ease-out !important;`;
            
            let shadow = container.attachShadow({ mode: 'open' });
            shadow.innerHTML = `
                <style>
                    ${styleContent}
                    .center-wrapper { width: 380px !important; height: auto !important; min-height: 380px !important; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border-radius: 16px; margin: 0 auto; display: flex; flex-direction: column; background: radial-gradient(circle at top right, #1a202c, #111827); border: 1px solid rgba(139, 92, 246, 0.2); padding: 24px 20px; box-sizing: border-box; }
                </style>
                ${bodyContent}
            `;
            
            document.body.appendChild(container);
            
            // Re-bind JS logic for Shadow DOM elements
            let docTypeSelect = shadow.getElementById('docType');
            let docNumberLabel = shadow.getElementById('docNumberLabel');
            let docNumberInput = shadow.getElementById('docNumber');
            let startBtn = shadow.getElementById('startBtn');
            let numberInputGroup = shadow.getElementById('numberInputGroup');
            let stateInputGroup = shadow.getElementById('stateInputGroup');
            let stateSearch = shadow.getElementById('stateSearch');
            let stateOptions = shadow.getElementById('stateOptions');
            let dobInputGroup = shadow.getElementById('dobInputGroup');
            let dobInput = shadow.getElementById('dobInput');
            let captchaInputGroup = shadow.getElementById('captchaInputGroup');
            let captchaInput = shadow.getElementById('captchaInput');
            let captchaImage = shadow.getElementById('captchaImage');
            let refreshCaptchaBtn = shadow.getElementById('refreshCaptchaBtn');

            // --- Authentication and Wallet Engine ---
            let registrationView = shadow.getElementById('registrationView');
            let paymentView = shadow.getElementById('paymentView');
            let dlMainView = shadow.getElementById('dlMainView');
            let walletBadge = shadow.getElementById('walletBadge');
            let walletPoints = shadow.getElementById('walletPoints');
            let registerBtn = shadow.getElementById('registerBtn');
            let confirmPaymentBtn = shadow.getElementById('confirmPaymentBtn');

            // --- Edit Profile Modal Elements ---
            let agentNameBadge = shadow.getElementById('agentNameBadge');
            let agentNameDisplay = shadow.getElementById('agentNameDisplay');
            let updateProfileModal = shadow.getElementById('updateProfileModal');
            let updAgentName = shadow.getElementById('updAgentName');
            let updAgentMob = shadow.getElementById('updAgentMob');
            let btnCancelUpdate = shadow.getElementById('btnCancelUpdate');
            let btnUpdateData = shadow.getElementById('btnUpdateData');

            // --- Edit Profile Handlers ---
            if (agentNameBadge) {
                agentNameBadge.addEventListener('click', () => {
                    chrome.storage.local.get(['agent_name', 'agent_mob_no'], (res) => {
                        if (updAgentName) updAgentName.value = res.agent_name || '';
                        if (updAgentMob) updAgentMob.value = res.agent_mob_no || '';
                        if (updateProfileModal) updateProfileModal.style.display = 'flex';
                    });
                });
            }
            if (btnCancelUpdate) {
                btnCancelUpdate.addEventListener('click', () => {
                    if (updateProfileModal) updateProfileModal.style.display = 'none';
                });
            }
            if (btnUpdateData) {
                btnUpdateData.addEventListener('click', () => {
                    const newName = updAgentName ? updAgentName.value.trim() : '';
                    const newMob = updAgentMob ? updAgentMob.value.replace(/[^0-9]/g, '') : '';
                    if (!newName || newMob.length !== 10) {
                        btnUpdateData.innerText = "Invalid Details";
                        btnUpdateData.style.background = "#ef4444";
                        setTimeout(() => {
                            btnUpdateData.innerText = "Update Data";
                            btnUpdateData.style.background = "linear-gradient(90deg, #10b981, #059669)";
                        }, 2000);
                        return;
                    }
                    btnUpdateData.innerText = "Updating...";
                    chrome.storage.local.set({ agent_name: newName, agent_mob_no: newMob }, () => {
                        chrome.storage.sync.set({ sync_agent_name: newName, sync_agent_mob_no: newMob }, () => {
                            if (agentNameDisplay) agentNameDisplay.innerText = newName;
                            setTimeout(() => {
                                btnUpdateData.innerText = "Update Data";
                                if (updateProfileModal) updateProfileModal.style.display = 'none';
                            }, 500);
                        });
                    });
                });
            }

            // --- QR Code Modal Logic ---
            let qrImg = shadow.getElementById('communityQrImg');
            let qrModalOverlay = shadow.getElementById('qrModalOverlay');
            if (qrImg && qrModalOverlay) {
                qrImg.addEventListener('click', () => {
                    qrModalOverlay.style.display = 'flex';
                });
                qrModalOverlay.addEventListener('click', () => {
                    qrModalOverlay.style.display = 'none';
                });
            }

            chrome.storage.local.get(['agent_registered', 'payment_verified', 'wallet_balance', 'welcome_code_used', 'agent_name'], function(result) {
                // --- System ID from localStorage (survives extension reinstall) ---
                let sysId = localStorage.getItem('jsk_dl_system_id');
                if (!sysId) {
                    sysId = 'JSK-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
                    localStorage.setItem('jsk_dl_system_id', sysId);
                }
                window.currentSystemId = sysId;

                // Display System ID in footer
                let sysIdEl = shadow.getElementById('systemIdDisplay');
                if (sysIdEl) sysIdEl.innerText = sysId;

                // --- Welcome Code lock from localStorage (survives reinstall) ---
                const welcomeUsedInLocalStorage = localStorage.getItem('jsk_dl_welcome_used_' + sysId) === 'true';
                const welcomeUsedInChromeStorage = result.welcome_code_used === true;
                window.welcomeCodeAlreadyUsed = welcomeUsedInLocalStorage || welcomeUsedInChromeStorage;

                // Sync: if chrome storage has it, save to localStorage too
                if (welcomeUsedInChromeStorage && !welcomeUsedInLocalStorage) {
                    localStorage.setItem('jsk_dl_welcome_used_' + sysId, 'true');
                }

                let welcomeCodeContainer = shadow.getElementById('welcomeCodeContainer');
                if (window.welcomeCodeAlreadyUsed && welcomeCodeContainer) {
                    welcomeCodeContainer.style.display = 'none';
                }

                let currentPoints = result.wallet_balance !== undefined ? result.wallet_balance : 0;
                if (walletPoints) walletPoints.innerText = currentPoints;
                
                if (agentNameDisplay && result.agent_name) {
                    agentNameDisplay.innerText = result.agent_name;
                }

                if (!result.agent_registered) {
                    chrome.storage.sync.get(['sync_agent_name', 'sync_agent_mob_no', 'sync_agent_dist', 'sync_agent_registered'], function(syncRes) {
                        if (syncRes.sync_agent_registered) {
                            chrome.storage.local.set({
                                'agent_name': syncRes.sync_agent_name,
                                'agent_mob_no': syncRes.sync_agent_mob_no,
                                'agent_dist': syncRes.sync_agent_dist,
                                'agent_registered': true
                            }, function() {
                                alert('Welcome back Dear ' + syncRes.sync_agent_name + '!');
                                window.location.reload();
                            });
                        } else {
                            if (registrationView) registrationView.style.display = 'block';
                            if (paymentView) paymentView.style.display = 'none';
                            if (dlMainView) dlMainView.style.display = 'none';
                            if (agentNameBadge) agentNameBadge.style.display = 'none';
                        }
                    });
                } else if (!result.payment_verified) {
                    if (registrationView) registrationView.style.display = 'none';
                    if (paymentView) paymentView.style.display = 'block';
                    if (dlMainView) dlMainView.style.display = 'none';
                    if (agentNameBadge) agentNameBadge.style.display = 'flex';
                } else {
                    if (registrationView) registrationView.style.display = 'none';
                    if (paymentView) paymentView.style.display = 'none';
                    if (dlMainView) dlMainView.style.display = 'block';
                    if (walletBadge) walletBadge.style.display = 'flex';
                    if (agentNameBadge) agentNameBadge.style.display = 'flex';
                }
            });

            chrome.storage.onChanged.addListener(function(changes, namespace) {
                if (namespace === 'local') {
                    if (changes.wallet_balance) {
                        if (walletPoints) walletPoints.innerText = changes.wallet_balance.newValue;
                    }
                    if (changes.payment_verified && changes.payment_verified.newValue === true) {
                        if (registrationView) registrationView.style.display = 'none';
                        if (paymentView) paymentView.style.display = 'none';
                        if (dlMainView) dlMainView.style.display = 'block';
                        if (walletBadge) walletBadge.style.display = 'flex';
                    }
                }
            });

            if (registerBtn) {
                registerBtn.addEventListener('click', function() {
                    if (!chrome.runtime || !chrome.runtime.id) { window.location.reload(); return; }

                    const name = shadow.getElementById('agentName').value.trim();
                    const mob = shadow.getElementById('agentMobNo').value.replace(/[^0-9]/g, '');
                    const dist = shadow.getElementById('agentDist').value.trim();

                    if (!name || mob.length !== 10 || !dist) {
                        const oldText = registerBtn.innerText;
                        registerBtn.innerText = "Fill all fields correctly!";
                        registerBtn.style.background = "linear-gradient(90deg, #ef4444, #dc2626)";
                        setTimeout(() => {
                            registerBtn.innerText = oldText;
                            registerBtn.style.background = "linear-gradient(90deg, #10b981, #059669)";
                        }, 2000);
                        return;
                    }

                    registerBtn.innerText = "Saving to Server...";
                    
                    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHePxZX-N9zhInQVQQWStSfYEv3tg9ptR4UORWGrIjZfbzL2AMw2kcgSDRK3pexCNS/exec";
                    const data = {
                        type: 'REGISTRATION',
                        name: name,
                        mobile: mob,
                        district: dist,
                        systemId: window.currentSystemId || "Unknown"
                    };

                    fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    }).then(() => {
                        if (!chrome.runtime || !chrome.runtime.id) return;
                        try {
                            chrome.storage.local.set({ 
                                'agent_name': name, 'agent_mob_no': mob, 'agent_dist': dist, 'agent_registered': true
                            }, function() {
                                chrome.storage.sync.set({ 
                                    'sync_agent_name': name, 'sync_agent_mob_no': mob, 'sync_agent_dist': dist, 'sync_agent_registered': true
                                }, function() {
                                    setTimeout(() => {
                                        if (registrationView) registrationView.style.display = 'none';
                                        if (paymentView) paymentView.style.display = 'block';
                                        if (agentNameBadge) agentNameBadge.style.display = 'flex';
                                        if (agentNameDisplay) agentNameDisplay.innerText = name;
                                    }, 500);
                                });
                            });
                        } catch(e) {}
                    }).catch(err => {
                        if (!chrome.runtime || !chrome.runtime.id) return;
                        try {
                            chrome.storage.local.set({ 
                                'agent_name': name, 'agent_mob_no': mob, 'agent_dist': dist, 'agent_registered': true
                            }, function() {
                                chrome.storage.sync.set({ 
                                    'sync_agent_name': name, 'sync_agent_mob_no': mob, 'sync_agent_dist': dist, 'sync_agent_registered': true
                                }, function() {
                                    if (registrationView) registrationView.style.display = 'none';
                                    if (paymentView) paymentView.style.display = 'block';
                                    if (agentNameBadge) agentNameBadge.style.display = 'flex';
                                    if (agentNameDisplay) agentNameDisplay.innerText = name;
                                });
                            });
                        } catch(e) {}
                    });
                });
            }

            const extWalletAmountInput = shadow.getElementById('extWalletAmount');
            const extCalcPointsText = shadow.getElementById('extCalcPointsText');
            const dynamicQRCode = shadow.getElementById('dynamicQRCode');

            function updateExtPointsText() {
                if (extWalletAmountInput && extCalcPointsText) {
                    const amount = parseFloat(extWalletAmountInput.value) || 0;
                    let points = amount >= 1000 ? amount * 10 : (amount >= 500 ? amount * 5 : amount);
                    extCalcPointsText.innerText = `You will get: ${points} Points`;
                    if (dynamicQRCode && amount > 0) {
                        const upiString = `upi://pay?pa=janaesevakendra@upi&pn=Jana%20Seva%20Kendra&am=${amount}&cu=INR`;
                        dynamicQRCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiString)}`;
                    }
                }
            }
            if (extWalletAmountInput) {
                extWalletAmountInput.addEventListener('input', updateExtPointsText);
                updateExtPointsText();
            }

            let payuPaymentBtn = shadow.getElementById('payuPaymentBtn');
            if (payuPaymentBtn) {
                payuPaymentBtn.addEventListener('click', function() {
                    const amount = parseFloat(extWalletAmountInput ? extWalletAmountInput.value : 100) || 0;
                    
                    if (amount <= 0) {
                        payuPaymentBtn.innerHTML = "Invalid Amount";
                        payuPaymentBtn.style.background = "linear-gradient(90deg, #ef4444, #dc2626)";
                        setTimeout(() => { 
                            payuPaymentBtn.innerHTML = "Pay Instantly<br>(PayU)"; 
                            payuPaymentBtn.style.background = "linear-gradient(90deg, #3b82f6, #60a5fa)";
                        }, 2000);
                        return;
                    }
                    
                    payuPaymentBtn.innerHTML = "Connecting...";
                    
                    chrome.storage.local.get(['agent_name', 'agent_mob_no'], function(res) {
                        const name = encodeURIComponent(res.agent_name || "Agent");
                        const mobile = encodeURIComponent(res.agent_mob_no || "9999999999");
                        const checkoutUrl = chrome.runtime.getURL(`payu_checkout.html?amount=${amount}&name=${name}&mobile=${mobile}`);
                        
                        // User wants it strictly in the SAME page. We will navigate the current tab to PayU.
                        window.top.location.href = checkoutUrl;
                        
                        setTimeout(() => { 
                            payuPaymentBtn.innerHTML = "Pay Instantly<br>(PayU)"; 
                        }, 1000);
                    });
                });
            }

            if (confirmPaymentBtn) {
                confirmPaymentBtn.addEventListener('click', function() {
                    if (!chrome.runtime || !chrome.runtime.id) { window.location.reload(); return; }

                    const utrInput = shadow.getElementById('utrNumber');
                    const welcomeInput = shadow.getElementById('welcomeCode');
                    const utr = utrInput ? utrInput.value.replace(/[^0-9A-Za-z]/g, '') : '';
                    const wCode = welcomeInput ? welcomeInput.value.trim() : "";
                    
                    if (wCode.length > 0 && window.welcomeCodeAlreadyUsed) {
                        const oldText = confirmPaymentBtn.innerText;
                        confirmPaymentBtn.innerText = "Welcome Code Already Used!";
                        confirmPaymentBtn.style.background = "linear-gradient(90deg, #ef4444, #dc2626)";
                        setTimeout(() => { 
                            confirmPaymentBtn.innerText = oldText; 
                            confirmPaymentBtn.style.background = "linear-gradient(90deg, #8b5cf6, #a855f7)";
                        }, 2000);
                        return;
                    }

                    if (wCode.length > 0 && wCode.toLowerCase() !== "WelcometoJSKFamily".toLowerCase()) {
                        const oldText = confirmPaymentBtn.innerText;
                        confirmPaymentBtn.innerText = "Invalid Welcome Code!";
                        confirmPaymentBtn.style.background = "linear-gradient(90deg, #ef4444, #dc2626)";
                        setTimeout(() => { 
                            confirmPaymentBtn.innerText = oldText; 
                            confirmPaymentBtn.style.background = "linear-gradient(90deg, #8b5cf6, #a855f7)";
                        }, 2000);
                        return;
                    }

                    if (utr.length !== 12 && utr.length !== 14 && wCode.length === 0) {
                        const oldText = confirmPaymentBtn.innerText;
                        confirmPaymentBtn.innerText = "Enter UTR or Code";
                        confirmPaymentBtn.style.background = "linear-gradient(90deg, #ef4444, #dc2626)";
                        setTimeout(() => { 
                            confirmPaymentBtn.innerText = oldText; 
                            confirmPaymentBtn.style.background = "linear-gradient(90deg, #8b5cf6, #a855f7)";
                        }, 2000);
                        return;
                    }

                    confirmPaymentBtn.innerText = "Processing...";
                    const amount = parseFloat(extWalletAmountInput ? extWalletAmountInput.value : 100) || 0;
                    let points = wCode.toLowerCase() === "WelcometoJSKFamily".toLowerCase() ? 25 : (amount >= 1000 ? amount * 10 : (amount >= 500 ? amount * 5 : amount));

                    chrome.storage.local.get(['agent_name', 'agent_mob_no', 'agent_dist', 'wallet_balance'], function(res) {
                        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHePxZX-N9zhInQVQQWStSfYEv3tg9ptR4UORWGrIjZfbzL2AMw2kcgSDRK3pexCNS/exec";
                        const data = {
                            type: 'PAYMENT',
                            name: res.agent_name || "Unknown",
                            mobile: res.agent_mob_no || "Unknown",
                            district: res.agent_dist || "Unknown",
                            utr: utr,
                            amount: amount,
                            welcomeCode: wCode,
                            systemId: window.currentSystemId || "Unknown"
                        };

                        fetch(GOOGLE_SCRIPT_URL, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        }).then(() => {
                            finalizePayment(res.wallet_balance || 0);
                        }).catch(err => {
                            console.error("Error submitting UTR: ", err);
                            finalizePayment(res.wallet_balance || 0);
                        });

                        function finalizePayment(currentBal) {
                            let newBal = currentBal + points;
                            let storageData = { 'payment_verified': true, 'wallet_balance': newBal };
                            if (wCode.toLowerCase() === "WelcometoJSKFamily".toLowerCase()) {
                                storageData['welcome_code_used'] = true;
                                window.welcomeCodeAlreadyUsed = true;
                                localStorage.setItem('jsk_dl_welcome_used_' + window.currentSystemId, 'true');
                            }

                            chrome.storage.local.set(storageData, function() {
                                setTimeout(() => {
                                    if (walletPoints) walletPoints.innerText = newBal;
                                    if (paymentView) paymentView.style.display = 'none';
                                    if (dlMainView) dlMainView.style.display = 'block';
                                    if (walletBadge) walletBadge.style.display = 'flex';
                                }, 500);
                            });
                        }
                    });
                });
            }

            let hardResetBtn = shadow.getElementById('hardResetBtn');
            if (hardResetBtn) {
                hardResetBtn.addEventListener('click', function() {
                    const confirmReset = confirm("Are you sure you want to RESET the extension? This will delete all your local data and fix any glitches.");
                    if (confirmReset) {
                        hardResetBtn.innerText = "RESETTING...";
                        if (!chrome.runtime || !chrome.runtime.id) {
                            window.location.reload();
                            return;
                        }
                        try {
                            chrome.storage.local.remove([
                                'print_dl_data', 
                                'automation_status', 
                                'target_type', 
                                'target_number'
                            ], function() {
                                window.location.reload();
                            });
                        } catch (err) {
                            window.location.reload();
                        }
                    }
                });
            }

            if (walletBadge) {
                walletBadge.addEventListener('click', function() {
                    if (dlMainView && paymentView) {
                        dlMainView.style.display = 'none';
                        paymentView.style.display = 'block';
                    }
                });
            }

            // --- Global Input Formatting ---
            if (docNumberInput) {
                docNumberInput.addEventListener('input', (e) => {
                    let val = e.target.value.replace(/\s+/g, '').toUpperCase();
                    if (val.length > 4) {
                        val = val.substring(0, 4) + ' ' + val.substring(4);
                    }
                    e.target.value = val;
                });
            }
            if (dobInput) {
                dobInput.addEventListener('input', (e) => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length > 2 && val.length <= 4) {
                        val = val.substring(0, 2) + '-' + val.substring(2);
                    } else if (val.length > 4) {
                        val = val.substring(0, 2) + '-' + val.substring(2, 4) + '-' + val.substring(4, 8);
                    }
                    e.target.value = val;
                });
            }

            // --- State Selection Logic ---
            if (window.location.href.includes('stateSelection.do')) {
                let headerTitle = shadow.querySelector('.header h1');
                if (headerTitle) headerTitle.innerText = 'DL State & Details';

                if (stateInputGroup) stateInputGroup.style.display = 'flex';
                if (numberInputGroup) numberInputGroup.style.display = 'flex';
                if (dobInputGroup) dobInputGroup.style.display = 'flex';
                if (captchaInputGroup) captchaInputGroup.style.display = 'none';
                if (docTypeSelect) docTypeSelect.parentElement.parentElement.style.display = 'none';
                if (startBtn) {
                    startBtn.style.display = 'block';
                    startBtn.innerText = 'Process';
                }
                
                let siteSelect = document.querySelector('select');
                if (siteSelect && stateSearch && stateOptions) {
                    Array.from(siteSelect.options).forEach(opt => {
                        if (opt.value && opt.value.trim() !== "") {
                            let optionElement = document.createElement('option');
                            optionElement.value = opt.innerText.trim();
                            optionElement.dataset.realValue = opt.value;
                            stateOptions.appendChild(optionElement);
                        }
                    });
                }

                if (startBtn) {
                    startBtn.addEventListener('click', () => {
                        let stateName = stateSearch ? stateSearch.value : '';
                        let dlNum = docNumberInput ? docNumberInput.value.trim() : '';
                        let dob = dobInput ? dobInput.value.trim() : '';
                        let selectedOpt = Array.from(stateOptions.options).find(o => o.value === stateName);
                        
                        if (!selectedOpt || !dlNum || !dob) {
                            startBtn.innerText = 'Fill all fields';
                            startBtn.style.background = '#ef4444';
                            setTimeout(() => {
                                startBtn.innerText = 'Process';
                                startBtn.style.background = 'linear-gradient(90deg, #3b82f6, #8b5cf6)';
                            }, 2000);
                            return;
                        }

                        startBtn.innerText = 'Processing...';
                        sessionStorage.setItem('dl_print_active', 'true');
                        sessionStorage.setItem('dl_print_dlno', dlNum);
                        sessionStorage.setItem('dl_print_dob', dob);
                        
                        if (siteSelect) {
                            siteSelect.value = selectedOpt.dataset.realValue;
                            siteSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });
                }
            } else if (window.location.href.includes('envaction.do')) {
                let currentUiState = 'input';

                const revertToInputUI = () => {
                    let storedDl = sessionStorage.getItem('dl_print_dlno');
                    let storedDob = sessionStorage.getItem('dl_print_dob');

                    if (stateInputGroup) stateInputGroup.style.display = 'none';
                    if (numberInputGroup) {
                        numberInputGroup.style.display = 'flex';
                        if (docNumberInput) { docNumberInput.value = storedDl || ''; docNumberInput.readOnly = false; docNumberInput.style.opacity = '1'; }
                    }
                    if (dobInputGroup) {
                        dobInputGroup.style.display = 'flex';
                        if (dobInput) { dobInput.value = storedDob || ''; dobInput.readOnly = false; dobInput.style.opacity = '1'; }
                    }
                    if (captchaInputGroup) captchaInputGroup.style.display = 'flex';
                    if (docTypeSelect) docTypeSelect.parentElement.parentElement.style.display = 'none';
                    
                    let headerTitle = shadow.querySelector('.header h1');
                    if (headerTitle) headerTitle.innerText = 'Enter Captcha';

                    let subtitle = shadow.querySelector('.header p');
                    if (subtitle) subtitle.innerText = 'Almost done';

                    let startBtn = shadow.getElementById('startBtn');
                    if (startBtn) {
                        startBtn.style.display = 'block';
                        startBtn.innerText = 'Get PDF';
                    }

                    let previewContainer = shadow.getElementById('dl-preview-container');
                    if (previewContainer) previewContainer.remove();
                };

                // Function to automatically extract and show the verification popup
                const showVerificationPopup = () => {
                    // Force the UI back to visible since data has loaded
                    sessionStorage.removeItem('hide_dl_popup');
                    let uiIframe = document.getElementById('dl-extension-ui-iframe');
                    if (uiIframe) uiIframe.style.setProperty('display', 'flex', 'important');
                    
                    if (docTypeSelect) docTypeSelect.parentElement.parentElement.style.display = 'none';
                    if (numberInputGroup) numberInputGroup.style.display = 'none';
                    if (dobInputGroup) dobInputGroup.style.display = 'none';
                    if (captchaInputGroup) captchaInputGroup.style.display = 'none';
                    
                    let headerTitle = shadow.querySelector('.header h1');
                    if (headerTitle) headerTitle.innerText = 'DL Data';

                    let subtitle = shadow.querySelector('.header p');
                    if (subtitle) subtitle.innerText = 'Please verify the DL Holder before printing.';

                    let startBtn = shadow.getElementById('startBtn');
                    if (startBtn) startBtn.style.display = 'none';

                    // --- ROBUST EXTRACTION ENGINE ---
                    let dlData = {};
                    
                    function getNextTdText(label) {
                        let xpath = `//td[contains(normalize-space(), "${label}")]/following-sibling::td`;
                        let node = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                        return node ? node.innerText.trim() : '';
                    }

                    let dlInput = document.querySelector('input[type="text"][name*="dlno"], input[type="text"][id*="dlno"]');
                    dlData.dlNumber = dlInput ? dlInput.value : (getNextTdText('Licence Number') || getNextTdText('DL Number'));
                    
                    dlData.name = getNextTdText('Name :') || getNextTdText('Name');
                    dlData.co = getNextTdText("Father's Name") || getNextTdText("Husband's Name");
                    dlData.dob = getNextTdText('Date of Birth');
                    dlData.bg = getNextTdText('Blood Group');
                    dlData.badge = getNextTdText('Badge Number') || getNextTdText('Badge No') || getNextTdText('Badge No.') || getNextTdText('Badge');
                    
                    let addressParts = [];
                    let addressRow = document.evaluate("//tr[td[contains(normalize-space(), 'Present Address')]]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (addressRow) {
                        let tds = addressRow.querySelectorAll('td');
                        if (tds.length >= 2) addressParts.push(tds[1].innerText.trim());
                        
                        let nextRow = addressRow.nextElementSibling;
                        while (nextRow) {
                            let nextTds = nextRow.querySelectorAll('td');
                            if (nextTds.length >= 2 && nextTds[0].innerText.trim() !== '') break;
                            if (nextTds.length >= 2 && nextTds[1].innerText.trim() !== '') {
                                addressParts.push(nextTds[1].innerText.trim());
                            }
                            nextRow = nextRow.nextElementSibling;
                        }
                    }
                    dlData.address = addressParts.join(', ').replace(/\s+/g, ' ').trim();
                    dlData.validTillNt = 'NA';
                    dlData.validTillTr = 'NA';
                    dlData.doi = 'NA';
                    
                    let allDivs = Array.from(document.querySelectorAll('div, td'));
                    
                    let ntIndex = allDivs.findIndex(d => d.innerText && (d.innerText.trim() === 'Non-Transport:' || d.innerText.trim() === 'Non - Transport :'));
                    if(ntIndex === -1) ntIndex = allDivs.findIndex(d => d.innerText && (d.innerText.trim() === 'Non-Transport' || d.innerText.trim() === 'Non - Transport'));
                    if (ntIndex !== -1) {
                        let dateDiv = allDivs.slice(ntIndex + 1).find(d => d.innerText && d.innerText.includes(' to '));
                        if (dateDiv) {
                            let parts = dateDiv.innerText.split(' to ');
                            dlData.doi = parts[0].trim();
                            dlData.validTillNt = parts[1].trim() + '(NT)';
                        }
                    }

                    let trIndex = allDivs.findIndex(d => d.innerText && (d.innerText.trim() === 'Transport:' || d.innerText.trim() === 'Transport :'));
                    if(trIndex === -1) trIndex = allDivs.findIndex(d => d.innerText && d.innerText.trim() === 'Transport');
                    if (trIndex !== -1) {
                        let dateDiv = allDivs.slice(trIndex + 1).find(d => d.innerText && d.innerText.includes(' to '));
                        if (dateDiv) {
                            let parts = dateDiv.innerText.split(' to ');
                            if(dlData.doi === 'NA') dlData.doi = parts[0].trim();
                            dlData.validTillTr = parts[1].trim() + '(TR)';
                        }
                    }
                    dlData.covs = [];
                    let covTable = document.evaluate("//table[contains(., 'COV Category') or contains(., 'COV Abbr.')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (covTable) {
                        let isNewLayout = covTable.innerText.includes('COV Abbr.');
                        let covRows = covTable.querySelectorAll('tr');
                        for (let i = 1; i < covRows.length; i++) { // Skip header row
                            let tds = covRows[i].querySelectorAll('td');
                            if (isNewLayout) {
                                if (tds.length >= 2) {
                                    dlData.covs.push({
                                        category: '',
                                        cov: tds[0].innerText.trim(),
                                        issueDate: tds[1].innerText.trim()
                                    });
                                }
                            } else {
                                if (tds.length >= 3) {
                                    dlData.covs.push({
                                        category: tds[0].innerText.trim(),
                                        cov: tds[1].innerText.trim(),
                                        issueDate: tds[2].innerText.trim()
                                    });
                                }
                            }
                        }
                    }

                    // Extract image from specific id="imgDiv" or fallback
                    let imgNode = document.querySelector('#imgDiv img') || document.querySelector('img[src*="showimage"], img[src*="Photo"]');
                    dlData.photoUrl = imgNode ? imgNode.src : '';
                    let signNode = document.querySelector('#signDiv img') || document.querySelector('#sigDiv img') || document.querySelector('img[src*="Signature"], img[src*="sign"]');
                    dlData.signUrl = signNode ? signNode.src : '';
                    
                    let previewContainer = shadow.getElementById('dl-preview-container');
                    if (!previewContainer) {
                        previewContainer = document.createElement('div');
                        previewContainer.id = 'dl-preview-container';
                        previewContainer.style.cssText = 'text-align: center; margin-top: 15px; width: 100%;';
                        
                        let photoHtml = dlData.photoUrl 
                            ? `<img src="${dlData.photoUrl}" style="width: 80px; height: 100px; object-fit: cover; border-radius: 8px; border: 2px solid #3b82f6; margin-bottom: 10px; background: #fff;">` 
                            : `<div style="width: 80px; height: 100px; border: 2px dashed #94a3b8; border-radius: 8px; margin: 0 auto 10px auto; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #64748b; background: #f1f5f9;">No Photo</div>`;
                        
                        previewContainer.innerHTML = `
                            ${photoHtml}
                            <h3 style="margin: 0 0 5px 0; color: #f8fafc; font-size: 16px; font-weight: 700;">${dlData.name || 'Unknown Name'}</h3>
                            <p style="margin: 0 0 20px 0; color: #94a3b8; font-size: 13px;">DL: ${dlData.dlNumber}</p>
                            
                            <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 10px;">
                                <button id="btnNo" style="background: #334155; color: #f8fafc; border: 1px solid #475569; padding: 10px 15px; border-radius: 8px; font-weight: 600; cursor: pointer; flex: 1; transition: all 0.2s;">Wrong</button>
                                <button id="btnYes" style="background: linear-gradient(90deg, #10b981, #059669); color: white; border: none; padding: 10px 15px; border-radius: 8px; font-weight: 600; cursor: pointer; flex: 1; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3); transition: all 0.2s;">Right</button>
                            </div>
                        `;
                        
                        subtitle.parentNode.insertBefore(previewContainer, subtitle.nextSibling);

                        shadow.getElementById('btnNo').addEventListener('click', () => {
                            currentUiState = 'input';
                            revertToInputUI();
                            let resetBtn = document.evaluate("//button[contains(normalize-space(), 'Reset')] | //input[@value='Reset'] | //input[@type='reset'] | //a[contains(normalize-space(), 'Reset')]", document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                            if (resetBtn.snapshotLength > 0) {
                                resetBtn.snapshotItem(0).click();
                            } else {
                                window.location.reload();
                            }
                        });

                        shadow.getElementById('btnYes').addEventListener('click', () => {
                            shadow.getElementById('btnYes').innerText = 'Generating...';
                            
                            if (!chrome.runtime || !chrome.runtime.id) {
                                alert("The extension was reloaded! Please refresh this page (press F5) and try again.");
                                shadow.getElementById('btnYes').innerText = 'Right';
                                return;
                            }

                            chrome.storage.local.get(['wallet_balance'], function(res) {
                                let currentBal = res.wallet_balance || 0;
                                if (currentBal < 25) {
                                    shadow.getElementById('btnYes').innerText = 'Low Balance! Recharge Needed.';
                                    shadow.getElementById('btnYes').style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
                                    setTimeout(() => {
                                        shadow.getElementById('btnYes').innerText = 'Right';
                                        shadow.getElementById('btnYes').style.background = 'linear-gradient(90deg, #10b981, #059669)';
                                        
                                        // Show Payment View
                                        let pView = shadow.getElementById('paymentView');
                                        let dView = shadow.getElementById('dlMainView');
                                        if (pView) pView.style.display = 'block';
                                        if (dView) dView.style.display = 'none';
                                    }, 1500);
                                    return;
                                }

                                try {
                                    chrome.storage.local.set({ 
                                        print_dl_data: dlData,
                                        wallet_balance: currentBal - 25
                                    }, () => {
                                        if (chrome.runtime.lastError) {
                                            alert("Extension was updated. Please refresh the page (F5).");
                                            return;
                                        }
                                        console.log("DL Data Extracted & 25 PTS Deducted!");
                                        window.location.href = chrome.runtime.getURL('dl_print.html');
                                        shadow.getElementById('btnYes').innerText = 'Right';
                                    });
                                } catch (e) {
                                    console.error(e);
                                    alert("An error occurred. Please refresh the page (press F5).");
                                    shadow.getElementById('btnYes').innerText = 'Right';
                                }
                            });
                        });
                    }
                };

                // Helper to accurately check if data is visible on screen
                const isDataActuallyLoaded = () => {
                    let photoDiv = document.getElementById('imgDiv');
                    let nameTd = document.evaluate("//td[contains(normalize-space(), 'Name :')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    return (photoDiv !== null && photoDiv.offsetWidth > 0) || (nameTd !== null && nameTd.offsetWidth > 0);
                };

                // Continuous state monitor
                setInterval(() => {
                    let isLoaded = isDataActuallyLoaded();
                    if (isLoaded && currentUiState === 'input') {
                        currentUiState = 'extract';
                        showVerificationPopup();
                    } else if (!isLoaded && currentUiState === 'extract') {
                        currentUiState = 'input';
                        revertToInputUI();
                    }
                }, 500);

                // --- Extract Details Logic ---
                
                let storedDl = sessionStorage.getItem('dl_print_dlno');
                let storedDob = sessionStorage.getItem('dl_print_dob');
                
                if (storedDl && storedDob) {
                    setTimeout(() => {
                        let siteDlInput = document.querySelector('input[type="text"][name*="dlno"], input[type="text"][id*="dlno"]');
                        let siteDobInput = document.querySelector('input[type="text"][name*="dob"], input[type="text"][id*="dob"], input[type="text"][placeholder*="DD-MM-YYYY"]');
                        if (siteDlInput && !siteDlInput.value) { siteDlInput.value = storedDl; siteDlInput.dispatchEvent(new Event('input', {bubbles: true})); }
                        if (siteDobInput && !siteDobInput.value) { siteDobInput.value = storedDob; siteDobInput.dispatchEvent(new Event('input', {bubbles: true})); }
                    }, 500);
                }

                // Change header to DL Print Captcha specifically for this step
                let headerTitle = shadow.querySelector('.header h1');
                if (headerTitle) headerTitle.innerText = 'Enter Captcha';

                if (docTypeSelect) docTypeSelect.parentElement.parentElement.style.display = 'none';
                if (stateInputGroup) stateInputGroup.style.display = 'none';
                if (numberInputGroup) {
                    numberInputGroup.style.display = 'flex';
                    if (docNumberInput) { docNumberInput.value = storedDl || ''; docNumberInput.readOnly = false; docNumberInput.style.opacity = '1'; }
                }
                if (dobInputGroup) {
                    dobInputGroup.style.display = 'flex';
                    if (dobInput) { dobInput.value = storedDob || ''; dobInput.readOnly = false; dobInput.style.opacity = '1'; }
                }
                if (captchaInputGroup) captchaInputGroup.style.display = 'flex';
                
                // Live mirror Captcha
                if (captchaInput) {
                    captchaInput.addEventListener('input', (e) => {
                        let siteCapInput = document.querySelector('input[type="text"][name*="captcha"], input[type="text"][id*="captcha"], input[type="text"][placeholder*="Captcha"], input[type="text"][name="captchastring"]');
                        if (siteCapInput) { siteCapInput.value = e.target.value; siteCapInput.dispatchEvent(new Event('input', {bubbles: true})); }
                    });
                }
                if (startBtn) {
                    startBtn.innerText = 'Get PDF';
                    startBtn.style.display = 'block';
                }

                // tick checkbox in background
                let agreeCheckbox = document.querySelector('input[type="checkbox"]');
                if (agreeCheckbox && !agreeCheckbox.checked) agreeCheckbox.click();

                // Load Captcha
                let siteCaptchaImg = document.querySelector('img[src*="captcha"], img[id*="captcha"]');
                if (siteCaptchaImg && captchaImage) captchaImage.src = siteCaptchaImg.src;

                if (refreshCaptchaBtn) {
                    refreshCaptchaBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        let siteRefresh = document.querySelector('img[src*="refresh"], a[id*="refresh"]');
                        if (siteRefresh) siteRefresh.click();
                        setTimeout(() => {
                            let updatedCaptcha = document.querySelector('img[src*="captcha"], img[id*="captcha"]');
                            if (updatedCaptcha) captchaImage.src = updatedCaptcha.src;
                        }, 600);
                    });
                }

                if (startBtn) {
                    startBtn.addEventListener('click', (e) => {
                        let dlNum = sessionStorage.getItem('dl_print_dlno') || (docNumberInput ? docNumberInput.value.trim() : '');
                        let dob = sessionStorage.getItem('dl_print_dob') || (dobInput ? dobInput.value.trim() : '');
                        let cap = captchaInput ? captchaInput.value.trim() : '';

                        if (!dlNum || !dob || !cap) {
                            startBtn.innerText = 'Fill all fields';
                            startBtn.style.background = '#ef4444';
                            setTimeout(() => {
                                startBtn.innerText = 'Get PDF';
                                startBtn.style.background = 'linear-gradient(90deg, #3b82f6, #8b5cf6)';
                            }, 2000);
                            return;
                        }

                        startBtn.innerText = 'Processing...';

                        // Instantly hide popup entirely to see website working
                        sessionStorage.setItem('hide_dl_popup', 'true');
                        let uiIframe = document.getElementById('dl-extension-ui-iframe');
                        if (uiIframe) uiIframe.style.setProperty('display', 'none', 'important');

                        // Input to background fields (also targeting type=text only)
                        let siteDlInput = document.querySelector('input[type="text"][name*="dlno"], input[type="text"][id*="dlno"], input[type="text"][placeholder*="DL"]');
                        let siteDobInput = document.querySelector('input[type="text"][name*="dob"], input[type="text"][id*="dob"], input[type="text"][placeholder*="DD-MM-YYYY"]');
                        let siteCapInput = document.querySelector('input[type="text"][name*="captcha"], input[type="text"][id*="captcha"], input[type="text"][placeholder*="Captcha"], input[type="text"][name="captchastring"]');

                        if (siteDlInput) { siteDlInput.value = dlNum; siteDlInput.dispatchEvent(new Event('input', {bubbles: true})); siteDlInput.dispatchEvent(new Event('change', {bubbles: true})); siteDlInput.dispatchEvent(new Event('blur', {bubbles: true})); }
                        if (siteDobInput) { siteDobInput.value = dob; siteDobInput.dispatchEvent(new Event('input', {bubbles: true})); siteDobInput.dispatchEvent(new Event('change', {bubbles: true})); siteDobInput.dispatchEvent(new Event('blur', {bubbles: true})); }
                        if (siteCapInput) { siteCapInput.value = cap; siteCapInput.dispatchEvent(new Event('input', {bubbles: true})); siteCapInput.dispatchEvent(new Event('change', {bubbles: true})); siteCapInput.dispatchEvent(new Event('blur', {bubbles: true})); }

                        if (agreeCheckbox && !agreeCheckbox.checked) agreeCheckbox.click();

                        setTimeout(() => {
                            let getDetailsBtns = document.evaluate("//button[contains(normalize-space(), 'Get DL Details')] | //input[@value='Get DL Details'] | //input[contains(@value, 'Get DL Details')]", document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                            if (getDetailsBtns.snapshotLength > 0) {
                                getDetailsBtns.snapshotItem(0).click();
                            } else {
                                let btn = document.querySelector('button.btn-primary, input[type="submit"]');
                                if (btn) btn.click();
                            }
                        }, 500);
                    });
                }
            } else {
                // --- Initial Load Logic ---
                if (docTypeSelect) {
                    if (numberInputGroup) numberInputGroup.style.display = 'none';
                    docTypeSelect.addEventListener('change', () => {
                        if (docTypeSelect.value === 'dl') {
                            if (numberInputGroup) numberInputGroup.style.display = 'none';
                        } else {
                            if (numberInputGroup) numberInputGroup.style.display = 'flex';
                            if (docNumberLabel) docNumberLabel.innerText = 'Vehicle RC Number';
                            if (docNumberInput) docNumberInput.placeholder = 'Enter RC Number';
                        }
                    });
                }

                if (startBtn) {
                    startBtn.addEventListener('click', () => {
                        const docType = docTypeSelect ? docTypeSelect.value : 'dl';
                        const docNumber = docNumberInput ? docNumberInput.value.trim() : '';

                        if (docType !== 'dl' && !docNumber) {
                            const originalText = startBtn.innerText;
                            startBtn.innerText = 'Please Enter Number';
                            startBtn.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
                            setTimeout(() => {
                                startBtn.innerText = originalText;
                                startBtn.style.background = 'linear-gradient(90deg, #3b82f6, #8b5cf6)';
                            }, 2000);
                            return;
                        }

                        startBtn.innerText = 'Starting...';
                        chrome.storage.local.set({
                            automation_status: 'running',
                            target_type: docType,
                            target_number: docNumber
                        }, () => {
                            chrome.runtime.sendMessage({ action: 'startAutomation' });
                            setTimeout(() => { startBtn.innerText = 'Automation Running'; }, 1000);
                        });
                    });
                }
            }

            document.body.appendChild(container);
        });
}

chrome.runtime.sendMessage({ action: 'checkActiveTab' }, (isActive) => {
    if (!isActive) return;

    let uiShown = false;

    function triggerUI() {
        if (uiShown) return;

        if (window.location.href.includes('envaction.do')) {
            let captchaImg = document.querySelector('img[src*="captcha"], img[id*="captcha"]');
            if (captchaImg && captchaImg.complete && captchaImg.naturalHeight > 0) {
                uiShown = true;
                showExtensionUIIframe();
            } else {
                setTimeout(triggerUI, 300); // Keep checking until captcha loads
            }
        } else {
            uiShown = true;
            showExtensionUIIframe();
        }
    }

    triggerUI();

    // Hard fallback after 8 seconds just in case
    setTimeout(() => {
        if (!uiShown) {
            uiShown = true;
            showExtensionUIIframe();
        }
    }, 8000);

    // Automatically close annoying Parivahan Popups
    setInterval(() => {
        let popupTexts = [
            "Update Your Mobile Number",
            "Contactless Licence Services"
        ];
        
        let xpathQueries = popupTexts.map(text => `contains(., '${text}')`).join(" or ");
        let textNodes = document.evaluate(
            `//text()[${xpathQueries}]`, 
            document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
        );
        
        for (let i = 0; i < textNodes.snapshotLength; i++) {
            let textNode = textNodes.snapshotItem(i);
            let container = textNode.parentElement.closest('.modal-content, .modal-dialog, div[role="dialog"]') || textNode.parentElement.parentElement.parentElement;
            
            let closed = false;
            if (container) {
                let closeBtn = container.querySelector('.close, .btn-close, button[data-dismiss="modal"], button[aria-label="Close"], [class*="close"]');
                if (closeBtn) {
                    closeBtn.click();
                    closed = true;
                } else {
                    // Fallback: look for a button containing the '×' character
                    let xBtns = document.evaluate(".//button[contains(., '×') or contains(., 'X')]", container, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    if (xBtns.snapshotLength > 0) {
                        xBtns.snapshotItem(0).click();
                        closed = true;
                    }
                }
                
                // If we successfully clicked to close it, trigger the UI right away
                if (closed) {
                    setTimeout(triggerUI, 300);
                }
            }
        }
    }, 300);

    let isRunning = false;
    let targetType = "";
    let targetNumber = "";

    chrome.storage.local.get(['automation_status', 'target_type', 'target_number'], (res) => {
        chrome.runtime.sendMessage({ action: 'checkActiveTab' }, (isActiveTab) => {
            if (!isActiveTab) return;
            
            if (res.automation_status === 'running') {
                isRunning = true;
                targetType = res.target_type;
                targetNumber = res.target_number;
                console.log("DL Print Only Automation Running...");
                
                // Show UI on stateSelection.do or envaction.do to ask for input, even if automation is running
                if (window.location.href.includes('stateSelection.do') || window.location.href.includes('envaction.do')) {
                    showExtensionUIIframe(true);
                }
            } else {
                showExtensionUIIframe();
            }
        });
    });

    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'local') {
            if (changes.automation_status) {
                chrome.runtime.sendMessage({ action: 'checkActiveTab' }, (isActiveTab) => {
                    if (!isActiveTab) return;
                    
                    if (changes.automation_status.newValue === 'stopped') {
                        isRunning = false;
                        showExtensionUIIframe();
                    } else if (changes.automation_status.newValue === 'running') {
                        isRunning = true;
                        let uiIframe = document.getElementById('dl-extension-ui-iframe');
                        if (uiIframe) uiIframe.remove();
                        let uiStyle = document.getElementById('dl-extension-ui-style');
                        if (uiStyle) uiStyle.remove();
                    }
                });
            }
            if (changes.target_type) targetType = changes.target_type.newValue;
            if (changes.target_number) targetNumber = changes.target_number.newValue;
        }
    });

    // Main Automation Loop
    let automationInterval = setInterval(() => {
        if (!isRunning) return;

        chrome.runtime.sendMessage({ action: 'checkActiveTab' }, (isActiveTab) => {
            if (!isActiveTab) {
                if (isRunning) {
                    console.log("This tab is no longer active. Stopping DL Print automation.");
                    isRunning = false;
                    let uiIframe = document.getElementById('dl-extension-ui-iframe');
                    if (uiIframe) uiIframe.remove();
                    let uiStyle = document.getElementById('dl-extension-ui-style');
                    if (uiStyle) uiStyle.remove();
                }
                return;
            }

            // STEP 1: Wait for user input on stateSelection
            if (window.location.href.includes('stateSelection.do')) {
                return;
            }

        // STEP 2: Click "DL Extract" on the State Dashboard (stateSelectBean.do)
        if (window.location.href.includes('stateSelectBean.do') && !sessionStorage.getItem('clicked_dl_extract')) {
            // Find the specific <p> containing 'DL Extract' to avoid clicking top menus
            let pNodes = document.evaluate("//p[contains(normalize-space(), 'DL Extract')]", document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            
            if (pNodes.snapshotLength > 0) {
                let pNode = pNodes.snapshotItem(0);
                let dlLink = pNode.closest('a[href*="dlServicesDet.do"]') || pNode.closest('a');
                
                if (dlLink) {
                    // Click the div.zoomin inside if possible to trigger any visual listeners, otherwise click the link
                    let zoominBox = dlLink.querySelector('.zoomin');
                    if (zoominBox) zoominBox.click();
                    else dlLink.click();
                    
                    // Fallback direct navigation if click doesn't trigger
                    setTimeout(() => {
                        if (window.location.href.includes('stateSelectBean.do')) {
                            window.location.href = dlLink.href;
                        }
                    }, 1000);
                    
                    sessionStorage.setItem('clicked_dl_extract', 'true');
                    console.log("Clicked specific DL Extract Box");
                }
            }
        }

        // STEP 3: Click "Continue" on the Instructions page (dlServicesDet.do)
        if (window.location.href.includes('dlServicesDet.do') && !sessionStorage.getItem('clicked_dl_continue')) {
            let continueBtns = document.evaluate(
                "//input[@value='Continue'] | //button[contains(normalize-space(), 'Continue')] | //a[contains(normalize-space(), 'Continue')]", 
                document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
            );
            
            if (continueBtns.snapshotLength > 0) {
                continueBtns.snapshotItem(0).click();
                sessionStorage.setItem('clicked_dl_continue', 'true');
                console.log("Clicked Continue Button");
            } else {
                // Fallback for tricky buttons
                let inputs = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"]'));
                let btn = inputs.find(i => i.value && i.value.trim().toLowerCase() === 'continue');
                if (btn) {
                    btn.click();
                    sessionStorage.setItem('clicked_dl_continue', 'true');
                    console.log("Clicked Continue Button (Fallback)");
                }
            }
        }

        // Future steps will go here
        });
    }, 1000);
});

// Check for Service Unavailable / 503 error on Parivahan
let maintenanceInterval = setInterval(() => {
    try {
        if (!isAuthorizedTab) return;
        if (!chrome.runtime || !chrome.runtime.id) {
            clearInterval(maintenanceInterval);
            return;
        }

        let bodyText = document.body ? document.body.innerText : '';
        if (bodyText.includes('Service Unavailable') || bodyText.includes('HTTP Error 503')) {
            if (!document.getElementById('dl-maintenance-overlay')) {
                let overlay = document.createElement('div');
                overlay.id = 'dl-maintenance-overlay';
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background-color:#0f172a;z-index:9999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:"Inter",sans-serif;text-align:center;padding:20px;';
                overlay.innerHTML = `
                    <div style="background: linear-gradient(145deg, #1e293b, #0f172a); border: 1px solid rgba(255, 90, 90, 0.3); border-radius: 20px; padding: 40px; text-align: center; width: 500px; max-width: 90vw; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                        <h1 style="color: #ff7070; font-size: 24px; font-weight: 800; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1.5px;">⚠️ SITE UNDER MAINTENANCE</h1>
                        <p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">The main site has a problem or is under maintenance. You will get updates on the community when the site is live.</p>
                        
                        <div style="display: flex; align-items: center; justify-content: center; gap: 20px; background: rgba(0,0,0,0.4); padding: 20px; border-radius: 16px; border: 1px dashed rgba(139, 92, 246, 0.3); margin: 0 auto;">
                            <div style="flex-shrink: 0; background: #fff; padding: 5px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://chat.whatsapp.com/CA4G8EOFRP91heRRxDT3cg" style="width: 100px; height: 100px; border-radius: 8px;">
                            </div>
                            <div style="text-align: left;">
                                <h3 style="color: #fff; font-size: 16px; font-weight: 700; margin: 0 0 6px 0;">Join Our Community</h3>
                                <p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.4;">Scan this QR code to join<br>and stay updated.</p>
                            </div>
                        </div>
                    </div>
                `;
                if (document.body) {
                    document.body.appendChild(overlay);
                } else if (document.documentElement) {
                    document.documentElement.appendChild(overlay);
                }
                
                // Stop automation if running to prevent endless loops
                chrome.storage.local.set({ 
                    'automation_status': 'stopped',
                    'site_under_maintenance': true 
                });
            }
        } else {
            chrome.storage.local.set({ 'site_under_maintenance': false });
        }
} catch(e) {
        clearInterval(maintenanceInterval);
    }
}, 1000);

})();

}
