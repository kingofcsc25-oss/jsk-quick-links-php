document.addEventListener('DOMContentLoaded', function() {
    const mainToggleBtn = document.getElementById('mainToggleBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const ackNumberInput = document.getElementById('ackNumber');
    const serviceTypeSelect = document.getElementById('serviceType');
    const agentNameInput = document.getElementById('agentName');
    const agentMobNoInput = document.getElementById('agentMobNo');
    const rtcUserIdInput = document.getElementById('rtcUserId');
    const rtcPasswordInput = document.getElementById('rtcPassword');

    const registrationView = document.getElementById('registrationView');
    const paymentView = document.getElementById('paymentView');
    const mainEngineView = document.getElementById('mainEngineView');
    const registerBtn = document.getElementById('registerBtn');
    const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
    const utrNumberInput = document.getElementById('utrNumber');

    // Action Card Elements
    const actionCard = document.getElementById('actionCard');
    const stepCircle = document.getElementById('stepCircle');
    const actionTitle = document.getElementById('actionTitle');
    const actionSubtitle = document.getElementById('actionSubtitle');

    // Load saved data and check registration/payment status
    chrome.storage.local.get(['nada_automation_status', 'ack_number', 'service_type', 'agent_email_id', 'agent_registered', 'payment_verified', 'wallet_balance', 'agent_address', 'has_activated_once'], function(result) {
        // ALWAYS set the top UI wallet balance
        let currentPoints = result.wallet_balance !== undefined ? result.wallet_balance : 0;
        document.getElementById('walletPoints').innerText = currentPoints;

        if (!result.agent_registered) {
            registrationView.style.display = 'block';
            paymentView.style.display = 'none';
            mainEngineView.style.display = 'none';
        } else if (!result.payment_verified) {
            registrationView.style.display = 'none';
            paymentView.style.display = 'block';
            mainEngineView.style.display = 'none';
        } else {
            registrationView.style.display = 'none';
            paymentView.style.display = 'none';
            mainEngineView.style.display = 'block';
            
            if (result.wallet_balance === undefined) {
                chrome.storage.local.set({'wallet_balance': 1000});
                document.getElementById('walletPoints').innerText = 1000;
            }
        }

        if (result.ack_number) ackNumberInput.value = result.ack_number;
        
        if (result.has_activated_once) {
            const welcomeCodeBlock = document.getElementById('welcomeCodeBlock');
            if (welcomeCodeBlock) welcomeCodeBlock.style.display = 'none';
        }
        if (result.service_type) {
            serviceTypeSelect.value = result.service_type;
        }
        
        updateCostDisplay(serviceTypeSelect.value);
        updateStatusUI(result.nada_automation_status === 'running');
    });

    function updateCostDisplay(serviceType) {
        const costDisplay = document.getElementById('verificationCostDisplay');
        if (costDisplay) {
            if (serviceType === 'Check Application Status') {
                costDisplay.innerText = "-2 PTS";
            } else {
                costDisplay.innerText = "-10 PTS";
            }
        }
    }

    // Sync UI with background state changes (like auto-stop on completion)
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'local') {
            if (changes.nada_automation_status) {
                updateStatusUI(changes.nada_automation_status.newValue === 'running');
            }
            if (changes.wallet_balance) {
                document.getElementById('walletPoints').innerText = changes.wallet_balance.newValue;
            }
        }
    });

    const welcomeCodeInput = document.getElementById('welcomeCode');

    // Payment Logic
    confirmPaymentBtn.addEventListener('click', function() {
        const utr = utrNumberInput.value.replace(/[^0-9A-Za-z]/g, '');
        const wCode = welcomeCodeInput ? welcomeCodeInput.value.trim() : "";
        
        if (wCode.length > 0 && wCode.toLowerCase() !== "WelcometoJSKFamily".toLowerCase()) {
            const oldText = confirmPaymentBtn.innerText;
            confirmPaymentBtn.innerText = "Invalid Welcome Code!";
            confirmPaymentBtn.style.background = "linear-gradient(90deg, #ff5a5a, #ff7070)";
            confirmPaymentBtn.style.color = "#ffffff";
            setTimeout(() => { 
                confirmPaymentBtn.innerText = oldText; 
                confirmPaymentBtn.style.background = "linear-gradient(90deg, #ffa000, #ffc107)";
                confirmPaymentBtn.style.color = "#15151e";
            }, 2000);
            return;
        }

        if (utr.length !== 12 && utr.length !== 14 && wCode.length === 0) {
            const oldText = confirmPaymentBtn.innerText;
            confirmPaymentBtn.innerText = "Please Enter UTR or Welcome Code";
            confirmPaymentBtn.style.background = "linear-gradient(90deg, #ff5a5a, #ff7070)";
            confirmPaymentBtn.style.color = "#ffffff";
            setTimeout(() => { 
                confirmPaymentBtn.innerText = oldText; 
                confirmPaymentBtn.style.background = "linear-gradient(90deg, #ffa000, #ffc107)";
                confirmPaymentBtn.style.color = "#15151e";
            }, 2000);
            return;
        }
        
        confirmPaymentBtn.innerText = wCode.length > 0 ? "Applying Welcome Code..." : "Saving UTR to Server...";
        confirmPaymentBtn.style.color = "#15151e";
        
        chrome.storage.local.get(['agent_name', 'agent_email_id', 'agent_mob_no', 'agent_address'], function(res) {
            const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxfCloaJADV-Q_GwhhF2M7Sq3QUSyPqymDxQCdx9vVjgKXpqcXxpVTYziVZm55bHMqX1Q/exec";
            
            const data = {
                type: wCode.length > 0 ? "WELCOME_CODE_ACTIVATION" : "PAYMENT_RECHARGE",
                utrNumber: utr || wCode,
                name: res.agent_name || "Unknown",
                email: res.agent_email_id || "Unknown",
                mobile: res.agent_mob_no || "Unknown",
                address: res.agent_address || "Unknown",
                timestamp: new Date().toISOString()
            };

            fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(() => {
                finalizePayment();
            }).catch(err => {
                console.error("Error submitting UTR: ", err);
                finalizePayment(); // Proceed even if server fails to prevent hard-locking
            });
            
            function finalizePayment() {
                const extWalletAmountInput = document.getElementById('extWalletAmount');
                const amount = parseFloat(extWalletAmountInput ? extWalletAmountInput.value : 100) || 0;
                let points = amount;
                
                if (wCode.toLowerCase() === "WelcometoJSKFamily".toLowerCase()) {
                    points = 10;
                } else if (amount >= 500) {
                    points = amount * 1.5;
                } else {
                    points = amount;
                }

                chrome.storage.local.get(['wallet_balance'], function(balanceRes) {
                    let currentBal = balanceRes.wallet_balance || 0;
                    let newBal = currentBal + points;

                    chrome.storage.local.set({ 
                        'payment_verified': true, 
                        'wallet_balance': newBal,
                        'has_activated_once': true
                    }, function() {
                        document.getElementById('walletPoints').innerText = newBal;
                        paymentView.style.display = 'none';
                        mainEngineView.style.display = 'block';
                        mainEngineView.style.animation = 'scaleIn 0.3s ease-out';
                        utrNumberInput.value = ""; // clear for next time
                        confirmPaymentBtn.innerText = "Activate / Confirm Payment";
                    });
                });
            }
        });
    });

    const extWalletAmountInput = document.getElementById('extWalletAmount');
    const extCalcPointsText = document.getElementById('extCalcPointsText');
    const dynamicQRCode = document.getElementById('dynamicQRCode');
    const upiId = "janaesevakendra@upi";

    function updateExtPointsText() {
        if (extWalletAmountInput && extCalcPointsText) {
            const amount = parseFloat(extWalletAmountInput.value) || 0;
            let points = amount;
            if (amount >= 500) {
                points = amount * 1.5;
            } else {
                points = amount;
            }
            extCalcPointsText.innerText = `You will get: ${points} Points`;

            if (dynamicQRCode && amount > 0) {
                const upiString = `upi://pay?pa=${upiId}&pn=Jana%20Seva%20Kendra&am=${amount}&cu=INR`;
                dynamicQRCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiString)}`;
            }
        }
    }

    if (extWalletAmountInput) {
        extWalletAmountInput.addEventListener('input', updateExtPointsText);
        updateExtPointsText();
    }

    // Registration Logic
    registerBtn.addEventListener('click', function() {
        const name = agentNameInput.value.trim();
        const rtcUser = rtcUserIdInput.value.trim();
        const mob = agentMobNoInput.value.replace(/[^0-9]/g, '');
        const rtcPass = rtcPasswordInput.value.trim();

        if (!name || !rtcUser || mob.length !== 10 || !rtcPass) {
            const oldText = registerBtn.innerText;
            registerBtn.innerText = "Please fill all fields correctly";
            registerBtn.style.background = "linear-gradient(90deg, #ff5a5a, #ff7070)";
            registerBtn.style.color = "#ffffff";
            setTimeout(() => {
                registerBtn.innerText = oldText;
                registerBtn.style.background = "linear-gradient(90deg, #ffa000, #ffc107)";
                registerBtn.style.color = "#15151e";
            }, 2000);
            return;
        }

        registerBtn.innerText = "Saving to Server...";
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxYbEmZY-cxQWp4fqkD1uWTwj6riZ0AHvk4qJC9a9fFzLcfRgCyS7bgOm3kT-0CpAOoyg/exec";

        const data = {
            type: "REGISTRATION",
            name: name,
            rtc_user: rtcUser,
            mobile: mob,
            rtc_pass: rtcPass,
            timestamp: new Date().toISOString()
        };

        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(() => {
            chrome.storage.local.set({ 
                'agent_name': name,
                'rtc_user_id': rtcUser,
                'agent_mob_no': mob,
                'rtc_password': rtcPass,
                'agent_registered': true
            }, function() {
                registrationView.style.display = 'none';
                paymentView.style.display = 'block';
                paymentView.style.animation = 'scaleIn 0.3s ease-out';
            });
        }).catch(err => {
            console.error("Error submitting to sheet: ", err);
            registerBtn.innerText = "Error! Proceeding anyway...";
            setTimeout(() => {
                chrome.storage.local.set({ 
                    'agent_name': name,
                    'rtc_user_id': rtcUser,
                    'agent_mob_no': mob,
                    'rtc_password': rtcPass,
                    'agent_registered': true
                }, function() {
                    registrationView.style.display = 'none';
                    paymentView.style.display = 'block';
                    paymentView.style.animation = 'scaleIn 0.3s ease-out';
                });
            }, 1000);
        });
    });

    // Auto-save and sanitize inputs for the main engine view
    ackNumberInput.addEventListener('input', function() {
        ackNumberInput.value = ackNumberInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        chrome.storage.local.set({ 'ack_number': ackNumberInput.value });
    });

    serviceTypeSelect.addEventListener('change', function() {
        chrome.storage.local.set({ 'service_type': serviceTypeSelect.value });
        updateCostDisplay(serviceTypeSelect.value);
    });

    // Main action button (Start/Stop)
    mainToggleBtn.addEventListener('click', function() {
        chrome.storage.local.get(['nada_automation_status', 'wallet_balance'], function(result) {
            const isRunning = result.nada_automation_status === 'running';
            let currentWallet = result.wallet_balance !== undefined ? result.wallet_balance : 1000;

            // Validate inputs before starting
            if (!isRunning) {
                const requiredPoints = serviceTypeSelect.value === 'Check Application Status' ? 2 : 10;
                
                if (currentWallet < requiredPoints) {
                    mainToggleBtn.innerText = `Need ${requiredPoints} Pts! Recharging...`;
                    mainToggleBtn.style.background = "linear-gradient(90deg, #ff5a5a, #ff7070)";
                    mainToggleBtn.style.color = "#ffffff";
                    setTimeout(() => { 
                        // Redirect to payment view for recharge
                        chrome.storage.local.set({'payment_verified': false});
                        document.getElementById('mainEngineView').style.display = 'none';
                        document.getElementById('paymentView').style.display = 'block';
                        document.getElementById('paymentView').style.animation = 'scaleIn 0.3s ease-out';
                        
                        // Reset button UI
                        mainToggleBtn.innerText = "Start Automation";
                        mainToggleBtn.style.background = "linear-gradient(90deg, #ffa000, #ffc107)";
                        mainToggleBtn.style.color = "#15151e";
                    }, 1500);
                    return;
                }
                
                if (!ackNumberInput.value || ackNumberInput.value.length < 5) {
                    mainToggleBtn.innerText = "Please Enter Valid RD No";
                    mainToggleBtn.style.background = "linear-gradient(90deg, #ff5a5a, #ff7070)";
                    mainToggleBtn.style.color = "#ffffff";
                    setTimeout(() => { 
                        mainToggleBtn.innerText = "Start Automation";
                        mainToggleBtn.style.background = "linear-gradient(90deg, #ffa000, #ffc107)";
                        mainToggleBtn.style.color = "#15151e";
                    }, 2000);
                    return;
                }
            }

            const newState = isRunning ? 'stopped' : 'running';
            
            chrome.storage.local.set({ 
                'nada_automation_status': newState,
                'ack_number': ackNumberInput.value,
                'service_type': serviceTypeSelect.value
            }, function() {
                updateStatusUI(newState === 'running');
            });
        });
    });

    // Reset button
    resetBtn.addEventListener('click', function() {
        chrome.storage.local.set({ 'nada_automation_status': 'stopped' }, function() {
            updateStatusUI(false);
            const originalText = resetBtn.innerText;
            resetBtn.innerText = "State Reset Successfully";
            resetBtn.style.borderColor = "#ffa000";
            resetBtn.style.color = "#ffa000";
            
            setTimeout(() => { 
                resetBtn.innerText = originalText; 
                resetBtn.style.borderColor = "#333344";
                resetBtn.style.color = "#a0a0b0";
            }, 1500);
        });
    });

    function updateStatusUI(isRunning) {
        if (isRunning) {
            statusBadge.classList.remove('stopped');
            statusBadge.classList.add('running');
            statusText.innerText = 'RUNNING';
            
            mainToggleBtn.innerText = 'Stop Automation';
            mainToggleBtn.style.background = 'linear-gradient(90deg, #ff5a5a, #ff7070)';
            mainToggleBtn.style.color = '#ffffff';
            mainToggleBtn.style.boxShadow = '0 4px 15px rgba(255, 90, 90, 0.2)';
            
            actionTitle.innerText = 'Automation Running';
            actionTitle.style.color = '#ff7070';
            actionSubtitle.innerText = 'Bot is currently searching / filling details on the portal...';
            
            actionCard.style.borderColor = 'rgba(255, 90, 90, 0.3)';
            stepCircle.style.backgroundColor = '#ff7070';
            stepCircle.style.color = '#ffffff';
            stepCircle.innerText = '⚙️';
        } else {
            statusBadge.classList.remove('running');
            statusBadge.classList.add('stopped');
            statusText.innerText = 'STOPPED';
            
            mainToggleBtn.innerText = 'Start Automation';
            mainToggleBtn.style.background = 'linear-gradient(90deg, #ffa000, #ffc107)';
            mainToggleBtn.style.color = '#15151e';
            mainToggleBtn.style.boxShadow = '0 4px 15px rgba(255, 160, 0, 0.2)';
            
            actionTitle.innerText = 'Start Automation';
            actionTitle.style.color = '#ffa000';
            actionSubtitle.innerText = 'Initiate certificate reprint or status search on the Nada Kacheri Portal';
            
            actionCard.style.borderColor = 'rgba(255, 160, 0, 0.2)';
            stepCircle.style.backgroundColor = '#ffa000';
            stepCircle.style.color = '#15151e';
            stepCircle.innerText = '1';
        }
    }
});
