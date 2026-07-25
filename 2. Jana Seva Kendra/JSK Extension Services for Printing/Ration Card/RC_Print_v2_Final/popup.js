window.addEventListener('error', function(e) {
    if (e.message && e.message.includes('Extension context invalidated')) {
        e.preventDefault();
        return true;
    }
});
window.addEventListener('unhandledrejection', function(e) {
    if (e.reason && e.reason.message && e.reason.message.includes('Extension context invalidated')) {
        e.preventDefault();
    }
});

document.addEventListener('DOMContentLoaded', function () {
    // Configure your Google Apps Script Web App URL here
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxqfKn1jwBNUA9uoLjZl8pYRrNHajK0OSYaxCO2XoW2pYz3vQ4TjJFRqqr-77x5cc8ZsA/exec";

    function showWelcomeToast(agentName, isReturning) {
        // Remove any existing toast
        const existingToast = document.getElementById('welcome-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'welcome-toast';

        const welcomeText = isReturning
            ? `Welcome back Dear Agent <strong>${agentName.toUpperCase()}</strong>... we will start agent over Journey.`
            : `Welcome Dear Agent <strong>${agentName.toUpperCase()}</strong>... we will start agent over Journey.`;

        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">🌟</span>
                <span style="flex-grow: 1;">${welcomeText}</span>
            </div>
        `;

        Object.assign(toast.style, {
            position: 'fixed',
            top: '-80px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '300px',
            background: 'linear-gradient(135deg, rgba(20, 20, 35, 0.95), rgba(40, 30, 80, 0.95))',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(144, 112, 255, 0.4)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '11px',
            lineHeight: '1.4',
            zIndex: '999999',
            transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            backdropFilter: 'blur(10px)',
            opacity: '0'
        });

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.top = '15px';
            toast.style.opacity = '1';
        }, 100);

        setTimeout(() => {
            toast.style.top = '-80px';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 4500);
    }

    const mainToggleBtn = document.getElementById('mainToggleBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const rcNumberInput = document.getElementById('rcNumber');
    const rcDivisionSelect = document.getElementById('rcDivision');
    const verificationTypeSelect = document.getElementById('verificationType');
    const rcCardTypeSelect = document.getElementById('rcCardType');
    const agentRcNumberInput = document.getElementById('agentRcNumber');
    const agentNameInput = document.getElementById('agentName');
    const agentMobNoInput = document.getElementById('agentMobNo');
    const agentDivisionInput = document.getElementById('agentDivision');

    const withoutOtpMethodGroup = document.getElementById('withoutOtpMethodGroup');
    const withoutOtpMethodSelect = document.getElementById('withoutOtpMethod');
    const rcNumberGroup = document.getElementById('rcNumberGroup');
    const otherRcNumberGroup = document.getElementById('otherRcNumberGroup');
    const otherRcNumberInput = document.getElementById('otherRcNumber');
    const otherNameGroup = document.getElementById('otherNameGroup');
    const otherNameInput = document.getElementById('otherName');

    function updateVisibility() {
        if (verificationTypeSelect && withoutOtpMethodGroup && otherRcNumberGroup && withoutOtpMethodSelect) {
            if (verificationTypeSelect.value === "with Out OTP") {
                withoutOtpMethodGroup.style.display = "flex";
                if (withoutOtpMethodSelect.value === "Other") {
                    otherRcNumberGroup.style.display = "flex";
                    if (otherNameGroup) otherNameGroup.style.display = "flex";
                } else {
                    otherRcNumberGroup.style.display = "none";
                    if (otherNameGroup) otherNameGroup.style.display = "none";
                }
            } else {
                withoutOtpMethodGroup.style.display = "none";
                otherRcNumberGroup.style.display = "none";
                if (otherNameGroup) otherNameGroup.style.display = "none";
            }
        }
    }

    const registrationView = document.getElementById('registrationView');
    const paymentView = document.getElementById('paymentView');
    const mainEngineView = document.getElementById('mainEngineView');
    const registerBtn = document.getElementById('registerBtn');
    const walletBalanceBadge = document.getElementById('walletBalanceBadge');
    const agentNameBadge = document.getElementById('agentNameBadge');

    if (agentNameBadge) {
        agentNameBadge.addEventListener('click', function () {
            chrome.storage.local.get(['agent_name', 'agent_rc_number', 'agent_mob_no', 'agent_division'], function(res) {
                if (agentNameInput) agentNameInput.value = res.agent_name || "";
                if (agentRcNumberInput) agentRcNumberInput.value = res.agent_rc_number || "";
                if (agentMobNoInput) agentMobNoInput.value = res.agent_mob_no || "";
                if (agentDivisionInput) agentDivisionInput.value = res.agent_division || "";
                
                const regHeading = document.getElementById('registrationHeading');
                const regSubtext = document.getElementById('registrationSubtext');
                if (regHeading) regHeading.innerText = "UPDATE YOUR PROFILE NOW";
                if (regSubtext) regSubtext.innerText = "Please update your details. Your changes will be saved to your profile.";

                if (registrationView) registrationView.style.display = 'block';
                if (paymentView) paymentView.style.display = 'none';
                if (mainEngineView) mainEngineView.style.display = 'none';
                
                if (registerBtn) {
                    registerBtn.innerText = "Update & Save";
                }
            });
        });
    }

    if (walletBalanceBadge) {
        walletBalanceBadge.style.cursor = 'pointer';
        walletBalanceBadge.addEventListener('click', function () {
            if (registrationView) registrationView.style.display = 'none';
            if (mainEngineView) mainEngineView.style.display = 'none';
            if (paymentView) {
                paymentView.style.display = 'block';
                chrome.storage.local.get(['wallet_balance', 'welcome_code_used'], function (res) {
                    updatePaymentViewState(res.wallet_balance, res.welcome_code_used);
                });
                const rechargeTypeSelect = document.getElementById('rechargeType');
                if (rechargeTypeSelect) {
                    rechargeTypeSelect.dispatchEvent(new Event('change'));
                }
            }
        });
    }

    const goBackBtn = document.getElementById('goBackBtn');
    if (goBackBtn) {
        goBackBtn.addEventListener('click', function () {
            if (paymentView) paymentView.style.display = 'none';
            if (mainEngineView) mainEngineView.style.display = 'block';
        });
    }

    const backToJskBtn = document.getElementById('backToJskBtn');
    if (backToJskBtn) {
        backToJskBtn.addEventListener('click', function () {
            window.parent.postMessage({ action: "CLOSE_JSK_TAB" }, "*");
        });
    }

    // Action Card Elements
    const actionCard = document.getElementById('actionCard');
    const stepCircle = document.getElementById('stepCircle');
    const actionTitle = document.getElementById('actionTitle');
    const actionSubtitle = document.getElementById('actionSubtitle');

    // QR Code Modal Logic
    const qrImg = document.getElementById('communityQrImg');
    const qrModal = document.getElementById('qrModalOverlay');
    const qrWrapper = document.querySelector('.community-qr-wrapper');
    const joinedBtn = document.getElementById('joinedCommunityBtn');
    const closeQrModalBtn = document.getElementById('closeQrModal');

    // Check if user already joined and hide if true
    chrome.storage.local.get(['community_joined'], function(res) {
        if (res.community_joined && qrWrapper) {
            qrWrapper.style.display = 'none';
        }
    });

    if (qrImg && qrModal) {
        qrImg.addEventListener('click', () => {
            qrModal.style.display = 'flex';
        });
        
        if (joinedBtn) {
            joinedBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                chrome.storage.local.set({'community_joined': true}, function() {
                    qrModal.style.display = 'none';
                    if (qrWrapper) {
                        qrWrapper.style.display = 'none';
                    }
                });
            });
        }
        
        if (closeQrModalBtn) {
            closeQrModalBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                qrModal.style.display = 'none';
            });
        }
        
        qrModal.addEventListener('click', (e) => {
            if (e.target === qrModal) {
                qrModal.style.display = 'none';
            }
        });
    }

    // Get Chrome Profile Email and initialize safely
    try {
        if (chrome.identity && chrome.identity.getProfileUserInfo) {
            // First try with accountStatus: 'ANY' (Manifest V3 recommended)
            chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, function (userInfo) {
                const err = chrome.runtime.lastError;
                if (err) {
                    // Fallback to standard getProfileUserInfo (useful for older versions or alternative browsers)
                    chrome.identity.getProfileUserInfo(function (userInfoFallback) {
                        const errFallback = chrome.runtime.lastError;
                        if (errFallback) {
                            console.warn("Chrome Identity fallback warning:", errFallback.message);
                        }
                        const chromeEmail = (userInfoFallback && !errFallback) ? userInfoFallback.email || "" : "";
                        initializeExtension(chromeEmail);
                    });
                } else {
                    const chromeEmail = userInfo ? userInfo.email || "" : "";
                    initializeExtension(chromeEmail);
                }
            });
        } else {
            initializeExtension("");
        }
    } catch (e) {
        console.warn("Identity API exception caught:", e);
        initializeExtension("");
    }

    function initializeExtension(chromeEmail) {
        // Update Chrome Profile Authentication Status UI
        const authStatusEl = document.getElementById('chromeAuthStatus');
        if (authStatusEl) {
            if (chromeEmail) {
                authStatusEl.style.background = 'rgba(0, 200, 128, 0.1)';
                authStatusEl.style.borderColor = 'rgba(0, 200, 128, 0.3)';
                authStatusEl.style.color = '#00e090';
                authStatusEl.innerHTML = `✅ Chrome Profile: <strong>${chromeEmail}</strong>`;
                if (registerBtn) {
                    registerBtn.disabled = false;
                    registerBtn.innerText = "Register & Save";
                    registerBtn.style.background = "linear-gradient(90deg, #00e090, #00c880)";
                    registerBtn.style.cursor = "pointer";
                }
            } else {
                authStatusEl.style.background = 'rgba(255, 90, 90, 0.1)';
                authStatusEl.style.borderColor = 'rgba(255, 90, 90, 0.3)';
                authStatusEl.style.color = '#ff7070';
                authStatusEl.innerHTML = `⚠️ Sign-In Required! Please log into Chrome to activate extension.`;
                if (registerBtn) {
                    registerBtn.disabled = true;
                    registerBtn.innerText = "Log In to Chrome Profile First";
                    registerBtn.style.background = "linear-gradient(90deg, #555, #666)";
                    registerBtn.style.cursor = "not-allowed";
                }
            }
        }

        chrome.storage.local.get(['rc_automation_status', 'rc_number', 'rc_division', 'rc_verification_type', 'rc_card_type', 'agent_rc_number', 'real_agent_rc_number', 'agent_name', 'real_agent_name', 'agent_registered', 'payment_verified', 'wallet_balance', 'agent_division', 'welcome_code_used', 'system_id', 'site_under_maintenance', 'without_otp_method', 'other_rc_number', 'other_name', 'package_active', 'package_expiry', 'package_print_counts', 'chrome_email', 'rc_pending_error_alert'], function (result) {

            if (result.site_under_maintenance) {
                document.body.innerHTML = `
                    <div style="background-color: #12121a; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; font-family: 'Inter', sans-serif; text-align: center; padding: 20px;">
                        <h1 style="color: #ff7070; font-size: 20px; font-weight: 800; margin: 0 0 10px 0; text-transform: uppercase;">⚠️ Maintenance</h1>
                        <p style="color: #b0b0c0; font-size: 13px; line-height: 1.5; margin: 0 0 20px 0;">The main portal is currently down or under maintenance.</p>
                        <div style="background: rgba(0,0,0,0.4); padding: 15px; border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://chat.whatsapp.com/CA4G8EOFRP91heRRxDT3cg" style="width: 80px; height: 80px; border-radius: 8px; margin-bottom: 10px; background: #fff; padding: 5px;">
                            <h3 style="color: #fff; font-size: 14px; font-weight: 700; margin: 0 0 4px 0;">Join Community</h3>
                            <p style="color: #8c8c9e; font-size: 11px; margin: 0;">Scan for updates.</p>
                        </div>
                    </div>
                `;
                return;
            }

            let sysId = result.system_id;
            if (!sysId) {
                sysId = 'SYS-' + Math.random().toString(36).substr(2, 9).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
                chrome.storage.local.set({ 'system_id': sysId });
            }
            window.currentSystemId = sysId; // Store globally for fetch calls

            if (chromeEmail) {
                window.currentChromeEmail = chromeEmail;

                // If registered locally but Chrome email in sheet is not synced yet, sync it
                if (result.agent_registered && result.chrome_email !== chromeEmail) {
                    const syncData = {
                        type: "REGISTRATION",
                        name: result.agent_name || "",
                        rcNumber: result.agent_rc_number || "",
                        mobile: result.agent_mob_no || "",
                        division: result.agent_division || "",
                        systemId: sysId,
                        chromeEmail: chromeEmail
                    };
                    fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(syncData)
                    }).then(() => {
                        chrome.storage.local.set({ 'chrome_email': chromeEmail });
                    }).catch(err => console.error("Error syncing email to server:", err));
                } else {
                    chrome.storage.local.set({ 'chrome_email': chromeEmail });
                }
            }

            function proceedWithSavedData(dataObj) {
                const welcomeCodeContainer = document.getElementById('welcomeCodeContainer');
                if (dataObj.welcome_code_used && welcomeCodeContainer) {
                    welcomeCodeContainer.style.display = 'none';
                }

                if (dataObj.rc_pending_error_alert) {
                    const actionTitle = document.getElementById('actionTitle');
                    const actionSubtitle = document.getElementById('actionSubtitle');
                    const mainToggleBtn = document.getElementById('mainToggleBtn');
                    
                    if (actionTitle) {
                        actionTitle.innerText = "Invalid RC Number";
                        actionTitle.style.color = "#ff7070";
                    }
                    if (actionSubtitle) {
                        actionSubtitle.innerText = dataObj.rc_pending_error_alert;
                        actionSubtitle.style.color = "#ff9090";
                    }
                    if (mainToggleBtn) {
                        mainToggleBtn.innerText = "Start Again";
                        mainToggleBtn.style.background = "linear-gradient(90deg, #ff5a5a, #ff7070)";
                    }
                    chrome.storage.local.remove('rc_pending_error_alert');
                }

                // Initialize/update wallet and package display
                updateWalletAndPackageUI();
                updatePaymentViewState(dataObj.wallet_balance, dataObj.welcome_code_used);

                if (dataObj.agent_name) {
                    const displayAgentNameEl = document.getElementById('displayAgentName');
                    if (displayAgentNameEl) displayAgentNameEl.innerText = "Agent Name: " + dataObj.agent_name.toUpperCase();
                }

                if (!dataObj.agent_registered) {
                    registrationView.style.display = 'block';
                    paymentView.style.display = 'none';
                    mainEngineView.style.display = 'none';
                } else if (!dataObj.payment_verified) {
                    registrationView.style.display = 'none';
                    paymentView.style.display = 'block';
                    mainEngineView.style.display = 'none';
                    updatePaymentViewState(dataObj.wallet_balance, dataObj.welcome_code_used);
                    const rechargeTypeSelect = document.getElementById('rechargeType');
                    if (rechargeTypeSelect) {
                        rechargeTypeSelect.dispatchEvent(new Event('change'));
                    }
                } else {
                    registrationView.style.display = 'none';
                    paymentView.style.display = 'none';
                    mainEngineView.style.display = 'block';

                    if (dataObj.wallet_balance === undefined) {
                        chrome.storage.local.set({ 'wallet_balance': 0 });
                        document.getElementById('walletPoints').innerText = 0;
                    }
                }

                if (dataObj.rc_number) rcNumberInput.value = dataObj.rc_number;

                if (dataObj.rc_division) {
                    rcDivisionSelect.value = dataObj.rc_division;
                } else if (dataObj.agent_division) {
                    let defaultUrl = "";
                    if (dataObj.agent_division.includes("Division 1")) defaultUrl = "https://ahara.karnataka.gov.in/FCS_VERIFY_BSER/";
                    else if (dataObj.agent_division.includes("Division 2")) defaultUrl = "https://ahara.karnataka.gov.in/FCS_VERIFY_KSER/";
                    else if (dataObj.agent_division.includes("Division 3")) defaultUrl = "https://ahara.karnataka.gov.in/FCS_VERIFY_MSER/";

                    if (defaultUrl) {
                        rcDivisionSelect.value = defaultUrl;
                        chrome.storage.local.set({ 'rc_division': defaultUrl });
                    }
                }

                if (dataObj.rc_verification_type) {
                    verificationTypeSelect.value = dataObj.rc_verification_type;
                }

                if (dataObj.rc_card_type && rcCardTypeSelect) {
                    rcCardTypeSelect.value = dataObj.rc_card_type;
                }
                
                if (typeof updateVerificationCostDisplay === "function") {
                    updateVerificationCostDisplay(verificationTypeSelect.value);
                }

                if (dataObj.without_otp_method && withoutOtpMethodSelect) {
                    withoutOtpMethodSelect.value = dataObj.without_otp_method;
                }

                if (dataObj.other_rc_number && otherRcNumberInput) {
                    otherRcNumberInput.value = dataObj.other_rc_number;
                }

                if (dataObj.other_name && otherNameInput) {
                    otherNameInput.value = dataObj.other_name;
                }

                // Backup the real agent RC if not already backed up
                if (dataObj.agent_rc_number && !dataObj.real_agent_rc_number) {
                    chrome.storage.local.set({ 'real_agent_rc_number': dataObj.agent_rc_number });
                }

                if (dataObj.agent_name && !dataObj.real_agent_name) {
                    chrome.storage.local.set({ 'real_agent_name': dataObj.agent_name });
                }

                updateVisibility();
                updateStatusUI(dataObj.rc_automation_status === 'running');
            }

            // If not registered locally, but Chrome email is logged in, check server
            if (!result.agent_registered && chromeEmail) {
                fetch(GOOGLE_SCRIPT_URL + "?action=checkUser&email=" + encodeURIComponent(chromeEmail))
                    .then(res => res.text())
                    .then(text => {
                        try {
                            return JSON.parse(text);
                        } catch (e) {
                            if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
                                throw new Error("Google Apps Script returned an HTML page instead of JSON. This happens if the Web App is not authorized or not deployed with 'Who has access: Anyone'.");
                            }
                            throw e;
                        }
                    })
                    .then(data => {
                        if (data.status === "success" && data.registered) {
                            const details = data.agentDetails || {};
                            const newState = {
                                'agent_registered': true,
                                'payment_verified': true,
                                'agent_name': details.name || "Agent",
                                'real_agent_name': details.name || "Agent",
                                'agent_rc_number': details.rcNumber || "",
                                'real_agent_rc_number': details.rcNumber || "",
                                'agent_mob_no': details.mobile || "",
                                'agent_division': details.division || "",
                                'welcome_code_used': data.welcomeCodeUsed || false,
                                'chrome_email': chromeEmail
                            };

                            // Restore points and packages from spreadsheet data!
                            if (details.walletBalance !== undefined && details.walletBalance !== null) {
                                newState['wallet_balance'] = details.walletBalance;
                            } else if (result.wallet_balance === undefined || result.wallet_balance === null) {
                                newState['wallet_balance'] = 0;
                            }

                            if (details.packageExpiry !== undefined && details.packageExpiry !== null) {
                                newState['package_active'] = details.packageExpiry > Date.now();
                                newState['package_expiry'] = details.packageExpiry;
                                newState['package_type'] = details.packageType || "";
                                try {
                                    newState['package_print_counts'] = details.packagePrintCounts ? JSON.parse(details.packagePrintCounts) : {};
                                } catch (e) {
                                    newState['package_print_counts'] = {};
                                }
                            }

                            chrome.storage.local.set(newState, function () {
                                Object.assign(result, newState);
                                showWelcomeToast(details.name || "Agent", true);
                                sessionStorage.setItem('welcome_back_shown', 'true');
                                proceedWithSavedData(result);
                            });
                        } else {
                            proceedWithSavedData(result);
                        }
                    })
                    .catch(err => {
                        console.error("Error querying user from server:", err.message || err);
                        proceedWithSavedData(result);
                    });
            } else {
                // Already registered locally or no chrome email ID
                // Check welcome code usage from sheet to ensure we hide the option if used on another device/clear
                if (result.agent_registered && chromeEmail && !result.welcome_code_used) {
                    fetch(GOOGLE_SCRIPT_URL + "?action=checkUser&email=" + encodeURIComponent(chromeEmail))
                        .then(res => res.text())
                        .then(text => {
                            try {
                                return JSON.parse(text);
                            } catch (e) {
                                if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
                                    throw new Error("Google Apps Script returned an HTML page instead of JSON. This happens if the Web App is not authorized or not deployed with 'Who has access: Anyone'.");
                                }
                                throw e;
                            }
                        })
                        .then(data => {
                            if (data.status === "success" && data.welcomeCodeUsed) {
                                chrome.storage.local.set({ 'welcome_code_used': true }, function () {
                                    result.welcome_code_used = true;
                                    proceedWithSavedData(result);
                                });
                            } else {
                                proceedWithSavedData(result);
                            }
                        })
                        .catch(err => {
                            console.error("Error syncing welcome code status:", err.message || err);
                            proceedWithSavedData(result);
                        });
                } else {
                    if (result.agent_registered && result.agent_name && !sessionStorage.getItem('welcome_back_shown')) {
                        showWelcomeToast(result.agent_name, true);
                        sessionStorage.setItem('welcome_back_shown', 'true');
                    }
                    proceedWithSavedData(result);
                }
            }
        });
    }

    // Sync UI with background state changes (like auto-stop on completion)
    chrome.storage.onChanged.addListener(function (changes, namespace) {
        if (namespace === 'local') {
            if (changes.rc_automation_status) {
                updateStatusUI(changes.rc_automation_status.newValue === 'running');
            }
            if (changes.wallet_balance || changes.package_active || changes.package_expiry || changes.package_print_counts) {
                updateWalletAndPackageUI();
                chrome.storage.local.get(['welcome_code_used', 'wallet_balance'], function (res) {
                    updatePaymentViewState(res.wallet_balance, res.welcome_code_used);
                });
            }
        }
    });

    // Unified function to render Wallet Points or Package Remaining Days and Print Counts
    function updateWalletAndPackageUI() {
        chrome.storage.local.get(['wallet_balance', 'package_active', 'package_expiry', 'package_print_counts', 'package_type'], function (res) {
            const walletBadgeEl = document.getElementById('walletBalanceBadge');
            const packageDaysBadge = document.getElementById('packageDaysBadge');
            const packageDaysText = document.getElementById('packageDaysText');
            const packageStatusContainer = document.getElementById('packageStatusContainer');

            let isPackageActive = false;
            let daysRemaining = 0;
            if (res.package_active && res.package_expiry && res.package_expiry > Date.now()) {
                isPackageActive = true;
                daysRemaining = Math.max(0, Math.ceil((res.package_expiry - Date.now()) / (1000 * 60 * 60 * 24)));
            }

            // Always update wallet points display
            if (walletBadgeEl) {
                walletBadgeEl.style.background = 'rgba(0, 200, 128, 0.1)';
                walletBadgeEl.style.borderColor = 'rgba(0, 200, 128, 0.3)';
                walletBadgeEl.style.color = '#00e090';
                let currentPoints = res.wallet_balance !== undefined ? res.wallet_balance : 0;
                walletBadgeEl.innerHTML = `<span style="font-size: 13px;">🪙</span> <span id="walletPoints">${currentPoints}</span> PTS`;
            }

            if (isPackageActive) {
                if (walletBadgeEl) {
                    walletBadgeEl.style.display = 'none';
                }
                if (packageDaysBadge && packageDaysText) {
                    packageDaysBadge.style.display = 'flex';
                    packageDaysText.innerText = `${daysRemaining} Days`;
                }

                if (packageStatusContainer) {
                    packageStatusContainer.style.display = 'block';

                    const counts = res.package_print_counts || {};
                    const normal = counts['Normal Card'] || 0;
                    const long = counts['Long Card'] || 0;
                    const pvc = counts['PVC Card'] || 0;
                    const normalPvc = counts['Normal with PVC'] || 0;
                    const longPvc = counts['Long With PVC'] || counts['Long with PVC'] || 0;
                    const total = normal + long + pvc + normalPvc + longPvc;

                    let pkgType = res.package_type;
                    if (!pkgType && isPackageActive) {
                        if (daysRemaining > 270) pkgType = "12 Month";
                        else if (daysRemaining > 180) pkgType = "9 Month";
                        else if (daysRemaining > 90) pkgType = "6 Month";
                        else if (daysRemaining > 30) pkgType = "3 Month";
                        else pkgType = "1 Month";

                        chrome.storage.local.set({ 'package_type': pkgType });
                    }
                    if (!pkgType) pkgType = "1 Month";

                    const limits = {
                        "1 Month": { "PVC Card": 99, "Normal with PVC": 49, "Long With PVC": 49 },
                        "3 Month": { "PVC Card": 249, "Normal with PVC": 249, "Long With PVC": 249 },
                        "6 Month": { "Long With PVC": 499 }
                    };
                    const pkgLimits = limits[pkgType] || {};

                    function formatCount(cardName, usedCount) {
                        let limit = undefined;
                        if (cardName === "PVC Card") {
                            limit = pkgLimits["PVC Card"];
                        } else if (cardName === "Normal with PVC") {
                            limit = pkgLimits["Normal with PVC"];
                        } else if (cardName === "Long With PVC") {
                            limit = pkgLimits["Long With PVC"] || pkgLimits["Long with PVC"];
                        }

                        if (limit === undefined) {
                            return `${usedCount} <span style="font-weight: normal; color: #8c8c9e; font-size: 9px;">(Unlimited)</span>`;
                        } else {
                            const remaining = Math.max(0, limit - usedCount);
                            return `${usedCount} <span style="font-weight: normal; color: #8c8c9e; font-size: 9px;">(${remaining} Left)</span>`;
                        }
                    }

                    document.getElementById('countNormal').innerHTML = formatCount('Normal Card', normal);
                    document.getElementById('countLong').innerHTML = formatCount('Long Card', long);
                    document.getElementById('countPVC').innerHTML = formatCount('PVC Card', pvc);
                    document.getElementById('countNormalPVC').innerHTML = formatCount('Normal with PVC', normalPvc);
                    document.getElementById('countLongPVC').innerHTML = formatCount('Long With PVC', longPvc);
                    document.getElementById('countTotal').innerText = total;
                }
            } else {
                if (walletBadgeEl) {
                    walletBadgeEl.style.display = 'flex';
                }
                if (packageDaysBadge) {
                    packageDaysBadge.style.display = 'none';
                }
                if (packageStatusContainer) {
                    packageStatusContainer.style.display = 'none';
                }
            }
        });
    }

    function updatePaymentViewState(walletBalance, welcomeCodeUsed) {
        const rechargeOptionsContainer = document.getElementById('rechargeOptionsContainer');
        const goBackBtn = document.getElementById('goBackBtn');

        if (rechargeOptionsContainer) rechargeOptionsContainer.style.display = 'block';

        if (goBackBtn) {
            chrome.storage.local.get(['payment_verified'], function (res) {
                if (res.payment_verified) {
                    goBackBtn.style.display = 'block';
                } else {
                    goBackBtn.style.display = 'none';
                }
            });
        }
    }



    const payuPaymentBtn = document.getElementById('payuPaymentBtn');
    if (payuPaymentBtn) {
        payuPaymentBtn.addEventListener('click', function () {
            const isPackageMode = (rechargeTypeSelect && rechargeTypeSelect.value === 'Package');
            let amount = 100;
            let pkgName = "";

            if (isPackageMode) {
                const pkg = packageSelect ? packageSelect.value : "1 Month";
                pkgName = pkg;
                if (pkg === "1 Month") amount = 149;
                else if (pkg === "3 Month") amount = 249;
                else if (pkg === "6 Month") amount = 499;
                else if (pkg === "9 Month") amount = 749;
                else if (pkg === "12 Month") amount = 999;
            } else {
                const extWalletAmountInput = document.getElementById('extWalletAmount');
                amount = parseFloat(extWalletAmountInput ? extWalletAmountInput.value : 100) || 0;
            }

            if (amount <= 0) {
                payuPaymentBtn.innerHTML = "Invalid Amount";
                payuPaymentBtn.style.background = "linear-gradient(90deg, #ff5a5a, #ff7070)";
                setTimeout(() => {
                    payuPaymentBtn.innerHTML = isPackageMode ? `Pay Instantly<br>(₹${amount})` : "Pay Instantly<br>(PayU)";
                    payuPaymentBtn.style.background = "linear-gradient(90deg, #00c880, #00e090)";
                }, 2000);
                return;
            }

            payuPaymentBtn.innerHTML = "Connecting...";

            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs && tabs.length > 0) {
                    const activeTab = tabs[0];
                    const originalUrl = activeTab.url;

                    let storeObj = {
                        'pending_payu_type': isPackageMode ? 'Package' : 'Points',
                        'payment_original_url': originalUrl
                    };
                    if (isPackageMode) {
                        storeObj['pending_payu_package_name'] = pkgName;
                    }

                    chrome.storage.local.set(storeObj, function () {
                        chrome.storage.local.get(['agent_name', 'agent_mob_no'], function (res) {
                            const name = encodeURIComponent(res.agent_name || "Agent");
                            const mobile = encodeURIComponent(res.agent_mob_no || "9999999999");
                            const checkoutUrl = chrome.runtime.getURL(`payu_checkout.html?amount=${amount}&name=${name}&mobile=${mobile}`);
                            chrome.tabs.update(activeTab.id, { url: checkoutUrl }, () => {
                                setTimeout(() => {
                                    payuPaymentBtn.innerHTML = isPackageMode ? `Pay Instantly<br>(₹${amount})` : "Pay Instantly<br>(PayU)";
                                    // Close popup so navigation can proceed in page
                                    window.close();
                                }, 500);
                            });
                        });
                    });
                }
            });
        });
    }

    const manualPaymentBtn = document.getElementById('manualPaymentBtn');
    const manualPaymentSection = document.getElementById('manualPaymentSection');
    const dynamicQRCode = document.getElementById('dynamicQRCode');
    const utrNumberInput = document.getElementById('utrNumber');
    const confirmManualPaymentBtn = document.getElementById('confirmManualPaymentBtn');

    window.updateManualQR = function() {
        if (!dynamicQRCode) return;
        const isPackageMode = (rechargeTypeSelect && rechargeTypeSelect.value === 'Package');
        let amount = 100;
        if (isPackageMode) {
            const pkg = packageSelect ? packageSelect.value : "1 Month";
            if (pkg === "1 Month") amount = 149;
            else if (pkg === "3 Month") amount = 249;
            else if (pkg === "6 Month") amount = 499;
            else if (pkg === "9 Month") amount = 749;
            else if (pkg === "12 Month") amount = 999;
        } else {
            const extWalletAmountInput = document.getElementById('extWalletAmount');
            amount = parseFloat(extWalletAmountInput ? extWalletAmountInput.value : 100) || 0;
        }
        
        if (amount > 0) {
            const upiId = "janaesevakendra@upi";
            const upiString = `upi://pay?pa=${upiId}&pn=Jana%20Seva%20Kendra&am=${amount}&cu=INR`;
            dynamicQRCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiString)}`;
        }
    };

    if (manualPaymentBtn && manualPaymentSection) {
        manualPaymentBtn.addEventListener('click', function() {
            if (manualPaymentSection.style.display === 'none') {
                manualPaymentSection.style.display = 'block';
                window.updateManualQR();
            } else {
                manualPaymentSection.style.display = 'none';
            }
        });
    }

    if (confirmManualPaymentBtn) {
        confirmManualPaymentBtn.addEventListener('click', function() {
            const utr = utrNumberInput.value.replace(/[^0-9A-Za-z]/g, '');
            if (utr.length !== 12 && utr.length !== 14) {
                const oldText = confirmManualPaymentBtn.innerText;
                confirmManualPaymentBtn.innerText = "Please Enter Valid UTR";
                confirmManualPaymentBtn.style.background = "linear-gradient(90deg, #ff5a5a, #ff7070)";
                setTimeout(() => { 
                    confirmManualPaymentBtn.innerText = oldText; 
                    confirmManualPaymentBtn.style.background = "linear-gradient(90deg, #ffa000, #ffc107)";
                }, 2000);
                return;
            }
            
            confirmManualPaymentBtn.innerText = "Saving UTR to Server...";
            
            const isPackageMode = (rechargeTypeSelect && rechargeTypeSelect.value === 'Package');
            let amount = 100;
            let pkgName = "";
            let pointsToAdd = 0;
            
            if (isPackageMode) {
                const pkg = packageSelect ? packageSelect.value : "1 Month";
                pkgName = pkg;
                if (pkg === "1 Month") amount = 149;
                else if (pkg === "3 Month") amount = 249;
                else if (pkg === "6 Month") amount = 499;
                else if (pkg === "9 Month") amount = 749;
                else if (pkg === "12 Month") amount = 999;
            } else {
                const extWalletAmountInput = document.getElementById('extWalletAmount');
                amount = parseFloat(extWalletAmountInput ? extWalletAmountInput.value : 100) || 0;
            }
            
            chrome.storage.local.get(['agent_name', 'agent_mob_no', 'agent_division', 'chrome_email', 'points_offer_used'], function(res) {
                if (!isPackageMode) {
                    if (res.points_offer_used) {
                        pointsToAdd = amount;
                    } else {
                        if (amount >= 999) pointsToAdd = amount * 5;
                        else if (amount >= 499) pointsToAdd = amount * 2;
                        else pointsToAdd = amount;
                    }
                }
                
                const data = {
                    type: "MANUAL_PAYMENT",
                    utrNumber: utr,
                    amount: amount,
                    packageType: isPackageMode ? pkgName : "Points",
                    name: res.agent_name || "Unknown",
                    mobile: res.agent_mob_no || "Unknown",
                    division: res.agent_division || "Unknown",
                    chromeEmail: res.chrome_email || window.currentChromeEmail || "",
                    systemId: window.currentSystemId || "Unknown",
                    timestamp: new Date().toISOString()
                };

                fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                }).then(() => finalizeManualPayment(res, isPackageMode, pkgName, pointsToAdd, amount))
                  .catch(err => finalizeManualPayment(res, isPackageMode, pkgName, pointsToAdd, amount));
            });
            
            function finalizeManualPayment(res, isPackageMode, pkgName, pointsToAdd, amount) {
                chrome.storage.local.get(['wallet_balance'], function(balanceRes) {
                    let currentBal = balanceRes.wallet_balance || 0;
                    let obj = {
                        'payment_verified': true,
                        'manual_payment_pending': true // flag for manual review
                    };
                    
                    if (isPackageMode) {
                        let months = 1;
                        if (pkgName === "3 Month") months = 3;
                        else if (pkgName === "6 Month") months = 6;
                        else if (pkgName === "9 Month") months = 9;
                        else if (pkgName === "12 Month") months = 12;
                        
                        obj['package_active'] = true;
                        obj['package_expiry'] = Date.now() + (months * 30 * 24 * 60 * 60 * 1000);
                        obj['package_type'] = pkgName;
                    } else {
                        obj['wallet_balance'] = currentBal + pointsToAdd;
                        if (amount >= 499 && !res.points_offer_used) {
                            obj['points_offer_used'] = true;
                        }
                    }

                    chrome.storage.local.set(obj, function() {
                        if (typeof updateWalletAndPackageUI === 'function') updateWalletAndPackageUI();
                        const paymentView = document.getElementById('paymentView');
                        const mainEngineView = document.getElementById('mainEngineView');
                        if (paymentView) paymentView.style.display = 'none';
                        if (mainEngineView) {
                            mainEngineView.style.display = 'block';
                            mainEngineView.style.animation = 'scaleIn 0.3s ease-out';
                        }
                        utrNumberInput.value = "";
                        confirmManualPaymentBtn.innerText = "Verify & Activate";
                        if (manualPaymentSection) manualPaymentSection.style.display = 'none';
                        
                        alert("Manual payment submitted successfully! Points/Package added.");
                    });
                });
            }
        });
    }

    // Toggle Point vs Package view section
    const rechargeTypeSelect = document.getElementById('rechargeType');
    const pointsRechargeSection = document.getElementById('pointsRechargeSection');
    const packageRechargeSection = document.getElementById('packageRechargeSection');

    if (rechargeTypeSelect && pointsRechargeSection && packageRechargeSection) {
        rechargeTypeSelect.addEventListener('change', function () {
            if (typeof window.updateManualQR === 'function') window.updateManualQR();
            if (rechargeTypeSelect.value === 'Points') {
                pointsRechargeSection.style.display = 'block';
                packageRechargeSection.style.display = 'none';
                if (payuPaymentBtn) {
                    payuPaymentBtn.innerHTML = "Pay Instantly<br>(PayU)";
                }
            } else {
                pointsRechargeSection.style.display = 'none';
                packageRechargeSection.style.display = 'block';
                updatePackageDetails();
            }
        });
    }

    // Handle package select changes and update Details and PayU buttons
    const packageSelect = document.getElementById('packageSelect');
    const packageDetailsContainer = document.getElementById('packageDetailsContainer');

    function updatePackageDetails() {
        if (!packageSelect || !packageDetailsContainer) return;
        const val = packageSelect.value;
        let detailsHtml = "";
        let amount = 149;

        if (val === "1 Month") {
            amount = 149;
            detailsHtml = `
                <div style="color: #b070ff; font-weight: 800; font-size: 13px; margin-bottom: 6px; text-align: center;">1 Month Package - ₹149</div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Normal Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Long Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>⚠️</span> <span>Limited PVC card (99 card)</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>⚠️</span> <span>Limited Normal with PVC Card (49 Card)</span></div>
                <div style="display: flex; align-items: center; gap: 6px;"><span>⚠️</span> <span>Limited Long With PVC Card (49 Card)</span></div>
            `;
        } else if (val === "3 Month") {
            amount = 249;
            detailsHtml = `
                <div style="color: #b070ff; font-weight: 800; font-size: 13px; margin-bottom: 6px; text-align: center;">3 Month Package - ₹249</div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Normal Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Long Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>⚠️</span> <span>Limited PVC card (249 card)</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>⚠️</span> <span>Limited Normal with PVC Card (249 Card)</span></div>
                <div style="display: flex; align-items: center; gap: 6px;"><span>⚠️</span> <span>Limited Long with PVC Card (249 Card)</span></div>
            `;
        } else if (val === "6 Month") {
            amount = 499;
            detailsHtml = `
                <div style="color: #b070ff; font-weight: 800; font-size: 13px; margin-bottom: 6px; text-align: center;">6 Month Package - ₹499</div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Normal Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Long Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited PVC card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Normal with PVC Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>⚠️</span> <span>Limited Long with PVC Card (499 Card)</span></div>
                <div style="display: flex; align-items: center; gap: 6px; color: #00e090;"><span>🔄</span> <span>Updates & support included.</span></div>
            `;
        } else if (val === "9 Month") {
            amount = 749;
            detailsHtml = `
                <div style="color: #b070ff; font-weight: 800; font-size: 13px; margin-bottom: 6px; text-align: center;">9 Month Package - ₹749</div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Normal Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Long Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited PVC card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Normal with PVC Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Long with PVC Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; color: #00e090;"><span>🔄</span> <span>Updates & support included.</span></div>
            `;
        } else if (val === "12 Month") {
            amount = 999;
            detailsHtml = `
                <div style="color: #b070ff; font-weight: 800; font-size: 13px; margin-bottom: 6px; text-align: center;">12 Month Package - ₹999</div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Normal Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Long Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited PVC card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Normal with PVC Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;"><span>✅</span> <span>Unlimited Long with PVC Card</span></div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px; color: #00e090;"><span>🔄</span> <span>Updates & support included</span></div>
                <div style="display: flex; align-items: center; gap: 6px; color: #ffeb3b;"><span>🏷️</span> <span>Next extension gets 15% discount</span></div>
            `;
        }

        packageDetailsContainer.innerHTML = detailsHtml;
        if (payuPaymentBtn) {
            payuPaymentBtn.innerHTML = `Pay Instantly (₹${amount})`;
        }
        if (typeof window.updateManualQR === 'function') window.updateManualQR();

        // Dynamic Buy with Points display logic
        chrome.storage.local.get(['wallet_balance'], function (res) {
            const currentBal = res.wallet_balance || 0;
            const buyWithPointsBtn = document.getElementById('buyWithPointsBtn');
            if (buyWithPointsBtn) {
                if (currentBal >= amount) {
                    buyWithPointsBtn.style.display = 'block';
                    buyWithPointsBtn.innerText = `Buy with ${amount} Wallet Points`;
                } else {
                    buyWithPointsBtn.style.display = 'none';
                }
            }
        });
    }

    if (packageSelect) {
        packageSelect.addEventListener('change', updatePackageDetails);
    }

    // Points to Package conversion listener
    const buyWithPointsBtn = document.getElementById('buyWithPointsBtn');
    if (buyWithPointsBtn) {
        buyWithPointsBtn.addEventListener('click', function () {
            const pkg = packageSelect ? packageSelect.value : "1 Month";
            let amount = 149;
            if (pkg === "3 Month") amount = 249;
            else if (pkg === "6 Month") amount = 499;
            else if (pkg === "9 Month") amount = 749;
            else if (pkg === "12 Month") amount = 999;

            chrome.storage.local.get(['wallet_balance', 'agent_name', 'agent_rc_number', 'agent_mob_no', 'agent_division', 'chrome_email'], function (res) {
                let currentBal = res.wallet_balance || 0;
                if (currentBal < amount) {
                    alert("Insufficient Wallet Points!");
                    return;
                }

                if (confirm(`Are you sure you want to purchase the ${pkg} package for ${amount} points?`)) {
                    let months = 1;
                    if (pkg === "3 Month") months = 3;
                    else if (pkg === "6 Month") months = 6;
                    else if (pkg === "9 Month") months = 9;
                    else if (pkg === "12 Month") months = 12;

                    let expiryTime = Date.now() + (months * 30 * 24 * 60 * 60 * 1000);
                    let newBal = currentBal - amount;

                    // Post the log to Google Sheet
                    const data = {
                        type: "POINTS_TO_PACKAGE_CONVERSION",
                        packageName: pkg,
                        amount: amount,
                        name: res.agent_name || "Unknown",
                        rcNumber: res.agent_rc_number || "Unknown",
                        mobile: res.agent_mob_no || "Unknown",
                        division: res.agent_division || "Unknown",
                        systemId: window.currentSystemId || "Unknown",
                        chromeEmail: res.chrome_email || window.currentChromeEmail || "",
                        timestamp: new Date().toISOString()
                    };

                    fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    }).catch(err => console.error("Error logging conversion: ", err));

                    chrome.storage.local.set({
                        'package_active': true,
                        'package_expiry': expiryTime,
                        'package_type': pkg,
                        'package_print_counts': {},
                        'wallet_balance': newBal,
                        'payment_verified': true
                    }, function () {
                        updateWalletAndPackageUI();
                        paymentView.style.display = 'none';
                        mainEngineView.style.display = 'block';
                        mainEngineView.style.animation = 'scaleIn 0.3s ease-out';
                    });
                }
            });
        });
    }

    // Package to Points conversion listener
    const convertToPointsBtn = document.getElementById('convertToPointsBtn');
    if (convertToPointsBtn) {
        convertToPointsBtn.addEventListener('click', function () {
            chrome.storage.local.get(['package_active', 'package_expiry', 'package_type', 'wallet_balance', 'agent_name', 'agent_rc_number', 'agent_mob_no', 'agent_division', 'chrome_email'], function (res) {
                if (!res.package_active || !res.package_expiry || res.package_expiry <= Date.now()) {
                    alert("No active package to convert!");
                    return;
                }

                const daysRemaining = Math.max(0, Math.ceil((res.package_expiry - Date.now()) / (1000 * 60 * 60 * 24)));
                if (daysRemaining <= 0) {
                    alert("No package days remaining to convert!");
                    return;
                }

                const pkg = res.package_type || "1 Month";
                let totalDays = 30;
                let packagePrice = 149;

                if (pkg === "3 Month") { totalDays = 90; packagePrice = 249; }
                else if (pkg === "6 Month") { totalDays = 180; packagePrice = 499; }
                else if (pkg === "9 Month") { totalDays = 270; packagePrice = 749; }
                else if (pkg === "12 Month") { totalDays = 365; packagePrice = 999; }

                // Ensure we don't refund more than the total package price if daysRemaining > totalDays (due to manual edits/leap days)
                const safeDays = Math.min(daysRemaining, totalDays);
                const pointsToRefund = Math.round((safeDays / totalDays) * packagePrice);

                if (confirm(`Convert remaining ${safeDays} days of your ${pkg} package into ${pointsToRefund} wallet points? Your package will be deactivated immediately.`)) {
                    const currentBal = res.wallet_balance || 0;
                    const newBal = currentBal + pointsToRefund;

                    // Post the log to Google Sheet
                    const data = {
                        type: "PACKAGE_TO_POINTS_CONVERSION",
                        packageName: pkg,
                        amount: pointsToRefund,
                        name: res.agent_name || "Unknown",
                        rcNumber: res.agent_rc_number || "Unknown",
                        mobile: res.agent_mob_no || "Unknown",
                        division: res.agent_division || "Unknown",
                        systemId: window.currentSystemId || "Unknown",
                        chromeEmail: res.chrome_email || window.currentChromeEmail || "",
                        timestamp: new Date().toISOString()
                    };

                    fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    }).catch(err => console.error("Error logging conversion: ", err));

                    chrome.storage.local.set({
                        'package_active': false,
                        'package_expiry': 0,
                        'package_type': '',
                        'package_print_counts': {},
                        'wallet_balance': newBal
                    }, function () {
                        updateWalletAndPackageUI();
                        alert(`Successfully converted package! ${pointsToRefund} points added to your wallet.`);
                    });
                }
            });
        });
    }

    const extWalletAmountInput = document.getElementById('extWalletAmount');
    const extCalcPointsText = document.getElementById('extCalcPointsText');
    const extOfferText = document.getElementById('extOfferText');
    function updateExtPointsText() {
        if (extWalletAmountInput && extCalcPointsText) {
            chrome.storage.local.get(['points_offer_used'], function(res) {
                const amount = parseFloat(extWalletAmountInput.value) || 0;
                let points = amount;
                
                if (res.points_offer_used) {
                    if (extOfferText) extOfferText.style.display = 'none';
                } else {
                    if (extOfferText) extOfferText.style.display = 'block';
                    if (amount >= 999) {
                        points = amount * 5;
                    } else if (amount >= 499) {
                        points = amount * 2;
                    }
                }
                
                extCalcPointsText.innerText = `You will get: ${points} Points`;
                if (typeof window.updateManualQR === 'function') window.updateManualQR();
            });
        }
    }

    if (extWalletAmountInput) {
        extWalletAmountInput.addEventListener('input', updateExtPointsText);
        updateExtPointsText();
    }

    // Registration Logic
    registerBtn.addEventListener('click', function () {
        const name = agentNameInput.value.trim();
        const rc = agentRcNumberInput.value.replace(/[^0-9]/g, '');
        const mob = agentMobNoInput.value.replace(/[^0-9]/g, '');
        const div = agentDivisionInput.value.trim();

        if (!name || rc.length !== 12 || mob.length !== 10 || !div) {
            const oldText = registerBtn.innerText;
            registerBtn.innerText = "Please fill all fields correctly";
            registerBtn.style.background = "linear-gradient(90deg, #ff5a5a, #ff7070)";
            setTimeout(() => {
                registerBtn.innerText = oldText;
                registerBtn.style.background = "linear-gradient(90deg, #00e090, #00c880)";
            }, 2000);
            return;
        }

        registerBtn.innerText = "Saving to Server...";

        const data = {
            name: name,
            rcNumber: rc,
            mobile: mob,
            division: div,
            systemId: window.currentSystemId || "Unknown",
            chromeEmail: window.currentChromeEmail || "",
            timestamp: new Date().toISOString()
        };

        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(() => {
            try {
                if (!chrome.runtime || !chrome.runtime.id) return;
                chrome.storage.local.get(['agent_registered', 'wallet_balance', 'payment_verified'], function(preRes) {
                    let isNew = !preRes.agent_registered;
                    let nBal = preRes.wallet_balance || 0;
                    let pVer = preRes.payment_verified || false;
                    
                    if (isNew) {
                        nBal += 50;
                        pVer = true;
                    }
                    
                    chrome.storage.local.set({
                        'agent_name': name,
                        'real_agent_name': name,
                        'agent_rc_number': rc,
                        'real_agent_rc_number': rc,
                        'agent_mob_no': mob,
                        'agent_division': div,
                        'agent_registered': true,
                        'chrome_email': window.currentChromeEmail || "",
                        'wallet_balance': nBal,
                        'payment_verified': pVer,
                        'welcome_code_used': true
                    }, function () {
                        if (chrome.runtime.lastError) return;
                        const displayAgentNameEl = document.getElementById('displayAgentName');
                        if (displayAgentNameEl) displayAgentNameEl.innerText = "Agent Name: " + name.toUpperCase();
                        
                        document.getElementById('walletPoints').innerText = nBal;
                        updateWalletAndPackageUI();

                        showWelcomeToast(name, false);
                        sessionStorage.setItem('welcome_back_shown', 'true');

                        registrationView.style.display = 'none';
                        if (pVer) {
                            if (mainEngineView) mainEngineView.style.display = 'block';
                        } else if (paymentView) {
                            paymentView.style.display = 'block';
                            const rechargeTypeSelect = document.getElementById('rechargeType');
                            if (rechargeTypeSelect) rechargeTypeSelect.dispatchEvent(new Event('change'));
                            paymentView.style.animation = 'scaleIn 0.3s ease-out';
                        }
                    });
                });
            } catch (e) { console.warn("Context invalidated", e); }
        }).catch(err => {
            console.error("Error submitting to sheet: ", err);
            registerBtn.innerText = "Error! Proceeding anyway...";
            setTimeout(() => {
                try {
                    if (!chrome.runtime || !chrome.runtime.id) return;
                    chrome.storage.local.get(['agent_registered', 'wallet_balance', 'payment_verified'], function(preRes) {
                        let isNew = !preRes.agent_registered;
                        let nBal = preRes.wallet_balance || 0;
                        let pVer = preRes.payment_verified || false;
                        
                        if (isNew) {
                            nBal += 50;
                            pVer = true;
                        }
                        
                        chrome.storage.local.set({
                            'agent_name': name,
                            'real_agent_name': name,
                            'agent_rc_number': rc,
                            'real_agent_rc_number': rc,
                            'agent_mob_no': mob,
                            'agent_division': div,
                            'agent_registered': true,
                            'chrome_email': window.currentChromeEmail || "",
                            'wallet_balance': nBal,
                            'payment_verified': pVer,
                            'welcome_code_used': true
                        }, function () {
                            if (chrome.runtime.lastError) return;
                            const displayAgentNameEl = document.getElementById('displayAgentName');
                            if (displayAgentNameEl) displayAgentNameEl.innerText = "Agent Name: " + name.toUpperCase();
                            
                            const wPoints = document.getElementById('walletPoints');
                            if (wPoints) wPoints.innerText = nBal;
                            updateWalletAndPackageUI();
    
                            showWelcomeToast(name, false);
                            sessionStorage.setItem('welcome_back_shown', 'true');
    
                            registrationView.style.display = 'none';
                            if (pVer) {
                                if (mainEngineView) mainEngineView.style.display = 'block';
                            } else if (paymentView) {
                                paymentView.style.display = 'block';
                                const rechargeTypeSelect = document.getElementById('rechargeType');
                                if (rechargeTypeSelect) rechargeTypeSelect.dispatchEvent(new Event('change'));
                                paymentView.style.animation = 'scaleIn 0.3s ease-out';
                            }
                        });
                    });
                } catch (e) { console.warn("Context invalidated", e); }
            }, 1000);
        });
    });

    // Auto-save and sanitize inputs for the main engine view
    rcNumberInput.addEventListener('input', function () {
        rcNumberInput.value = rcNumberInput.value.replace(/[^0-9]/g, '');
        try {
            chrome.storage.local.set({ 'rc_number': rcNumberInput.value });
        } catch (e) { }
    });

    if (otherRcNumberInput) {
        otherRcNumberInput.addEventListener('input', function () {
            otherRcNumberInput.value = otherRcNumberInput.value.replace(/[^0-9]/g, '');
            try {
                chrome.storage.local.set({ 'other_rc_number': otherRcNumberInput.value });
            } catch (e) { }
        });
    }

    if (otherNameInput) {
        otherNameInput.addEventListener('input', function () {
            try {
                chrome.storage.local.set({ 'other_name': otherNameInput.value });
            } catch (e) { }
        });
    }

    rcDivisionSelect.addEventListener('change', function () {
        chrome.storage.local.set({ 'rc_division': rcDivisionSelect.value });
    });

    const verificationCostDisplay = document.getElementById('verificationCostDisplay');

    function updateVerificationCostDisplay(type) {
        if (verificationCostDisplay && rcCardTypeSelect && verificationTypeSelect) {
            let cardType = rcCardTypeSelect.value;
            let withOtpCost = 2;
            let withoutOtpCost = 5;

            if (cardType === "Normal Card" || cardType === "Long Card") {
                withOtpCost = 2;
                withoutOtpCost = 5;
            } else {
                withOtpCost = 4;
                withoutOtpCost = 5;
            }

            verificationTypeSelect.options[0].text = `With OTP (${withOtpCost} Points)`;
            verificationTypeSelect.options[1].text = `Without OTP (${withoutOtpCost} Points)`;

            if (type === "with Out OTP") {
                verificationCostDisplay.innerText = `-${withoutOtpCost} PTS`;
            } else {
                verificationCostDisplay.innerText = `-${withOtpCost} PTS`;
            }
        }
    }

    verificationTypeSelect.addEventListener('change', function () {
        chrome.storage.local.set({ 'rc_verification_type': verificationTypeSelect.value });
        updateVerificationCostDisplay(verificationTypeSelect.value);
        updateVisibility();
    });

    if (withoutOtpMethodSelect) {
        withoutOtpMethodSelect.addEventListener('change', function () {
            chrome.storage.local.set({ 'without_otp_method': withoutOtpMethodSelect.value });
            updateVisibility();
        });
    }

    if (rcCardTypeSelect) {
        rcCardTypeSelect.addEventListener('change', function () {
            chrome.storage.local.set({ 'rc_card_type': rcCardTypeSelect.value });
            updateVerificationCostDisplay(verificationTypeSelect.value);
        });
    }

    // Main action button (Start/Stop)
    mainToggleBtn.addEventListener('click', function () {
        // Reset colors in case it was red from an error
        if (actionTitle) {
            actionTitle.innerText = "Start Automation";
            actionTitle.style.color = "#00c880";
        }
        if (actionSubtitle) {
            actionSubtitle.innerText = "Initiate fetching and printing sequence on the RC Portal";
            actionSubtitle.style.color = "#8c8c9e";
        }
        mainToggleBtn.innerText = "Start Automation";
        mainToggleBtn.style.background = "linear-gradient(90deg, #9070ff, #b070ff)";
        
        try {
            chrome.storage.local.get(['rc_automation_status', 'agent_rc_number', 'wallet_balance', 'package_active', 'package_expiry'], function (result) {
                if (chrome.runtime.lastError) {
                    window.location.reload();
                    return;
                }
                const isRunning = result.rc_automation_status === 'running';
                const savedAgentRc = result.agent_rc_number;
                let currentWallet = result.wallet_balance !== undefined ? result.wallet_balance : 0;
                let isPackageActive = false;
                if (result.package_active && result.package_expiry && result.package_expiry > Date.now()) {
                    isPackageActive = true;
                }

                // Validate inputs before starting
                if (!isRunning) {
                    let cardType = rcCardTypeSelect ? rcCardTypeSelect.value : "Normal Card";
                    let isWithoutOtp = verificationTypeSelect.value === "with Out OTP";
                    let requiredPoints = 2;

                    if (isWithoutOtp) {
                        requiredPoints = 5;
                    } else {
                        if (cardType === "Normal Card" || cardType === "Long Card") {
                            requiredPoints = 2;
                        } else {
                            requiredPoints = 4;
                        }
                    }

                    if (!isPackageActive && currentWallet < requiredPoints) {
                        mainToggleBtn.innerText = `Need ${requiredPoints} Pts! Recharging...`;
                        mainToggleBtn.style.background = "linear-gradient(90deg, #ff5a5a, #ff7070)";
                        setTimeout(() => {
                            // Redirect to payment view for recharge
                            chrome.storage.local.set({ 'payment_verified': false });
                            document.getElementById('mainEngineView').style.display = 'none';
                            document.getElementById('paymentView').style.display = 'block';
                            document.getElementById('paymentView').style.animation = 'scaleIn 0.3s ease-out';
                            chrome.storage.local.get(['wallet_balance', 'welcome_code_used'], function (res) {
                                updatePaymentViewState(res.wallet_balance, res.welcome_code_used);
                            });
                            const rechargeTypeSelect = document.getElementById('rechargeType');
                            if (rechargeTypeSelect) rechargeTypeSelect.dispatchEvent(new Event('change'));

                            // Reset button UI
                            mainToggleBtn.innerText = "Start Automation";
                            mainToggleBtn.style.background = "linear-gradient(90deg, #9070ff, #b070ff)";
                        }, 1500);
                        return;
                    }

                    if (!rcDivisionSelect.value || !verificationTypeSelect.value) {
                        mainToggleBtn.innerText = "Please Fill All Fields";
                        setTimeout(() => { mainToggleBtn.innerText = "Start Automation"; }, 2000);
                        return;
                    }

                    if (!rcNumberInput.value || rcNumberInput.value.length !== 12) {
                        mainToggleBtn.innerText = "RC No Must Be 12 Digits";
                        setTimeout(() => { mainToggleBtn.innerText = "Start Automation"; }, 2000);
                        return;
                    }

                    if (verificationTypeSelect.value === "with Out OTP") {
                        if (withoutOtpMethodSelect && withoutOtpMethodSelect.value === "Other") {
                            if (!otherRcNumberInput.value || otherRcNumberInput.value.length !== 12) {
                                mainToggleBtn.innerText = "Other RC Must Be 12 Digits";
                                setTimeout(() => { mainToggleBtn.innerText = "Start Automation"; }, 2000);
                                return;
                            }
                            if (!otherNameInput.value || otherNameInput.value.trim() === "") {
                                mainToggleBtn.innerText = "Please enter Other Name";
                                setTimeout(() => { mainToggleBtn.innerText = "Start Automation"; }, 2000);
                                return;
                            }
                        } else {
                            if (!savedAgentRc || savedAgentRc.length !== 12) {
                                mainToggleBtn.innerText = "Agent RC Must Be 12 Digits";
                                setTimeout(() => { mainToggleBtn.innerText = "Start Automation"; }, 2000);
                                return;
                            }
                        }
                    }
                }

                const newState = isRunning ? 'stopped' : 'running';

                if (newState === 'running') {
                    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                        if (tabs && tabs.length > 0) {
                            const currentTabId = tabs[0].id;

                            // Proxy logic swap for the backend
                            if (verificationTypeSelect.value === "with Out OTP") {
                                chrome.storage.local.get(['real_agent_rc_number', 'real_agent_name'], function (res) {
                                    let proxyRc = (withoutOtpMethodSelect && withoutOtpMethodSelect.value === "Other")
                                        ? otherRcNumberInput.value
                                        : res.real_agent_rc_number;
                                    let proxyName = (withoutOtpMethodSelect && withoutOtpMethodSelect.value === "Other")
                                        ? otherNameInput.value
                                        : res.real_agent_name;
                                    chrome.storage.local.set({
                                        'agent_rc_number': proxyRc,
                                        'agent_name': proxyName
                                    });
                                });
                            }

                            chrome.storage.local.set({
                                'rc_automation_status': newState,
                                'rc_number': rcNumberInput.value,
                                'rc_division': rcDivisionSelect.value,
                                'rc_verification_type': verificationTypeSelect.value,
                                'rc_card_type': rcCardTypeSelect ? rcCardTypeSelect.value : 'Normal Card',
                                'without_otp_method': withoutOtpMethodSelect ? withoutOtpMethodSelect.value : 'Agent',
                                'other_rc_number': otherRcNumberInput ? otherRcNumberInput.value : '',
                                'wallet_balance': currentWallet,
                                'otp_attempted': false,
                                'print_deducted_for_current': false,
                                'automation_tab_id': currentTabId
                            }, function () {
                                updateStatusUI(true);
                                chrome.tabs.update(currentTabId, { url: rcDivisionSelect.value });
                            });
                        }
                    });
                } else {
                    chrome.storage.local.set({
                        'rc_automation_status': newState,
                        'rc_number': rcNumberInput.value,
                        'rc_division': rcDivisionSelect.value,
                        'rc_verification_type': verificationTypeSelect.value,
                        'rc_card_type': rcCardTypeSelect ? rcCardTypeSelect.value : 'Normal Card',
                        'without_otp_method': withoutOtpMethodSelect ? withoutOtpMethodSelect.value : 'Agent',
                        'other_rc_number': otherRcNumberInput ? otherRcNumberInput.value : '',
                        'wallet_balance': currentWallet,
                        'otp_attempted': false,
                        'print_deducted_for_current': false
                    }, function () {
                        updateStatusUI(false);
                    });
                }
            });
        } catch (e) {
            window.location.reload();
        }
    });

    // Reset button
    resetBtn.addEventListener('click', function () {
        chrome.storage.local.set({
            'rc_automation_status': 'stopped',
            'print_deducted_for_current': false,
            'rc_number': '',
            'other_rc_number': '',
            'other_name': ''
        }, function () {
            chrome.storage.local.remove([
                'rc_verification_type',
                'rc_card_type',
                'without_otp_method',
                'rc_division'
            ], function() {
                updateStatusUI(false);
                resetBtn.innerText = "State Cleared. Refreshing...";
                resetBtn.style.borderColor = "#00c880";
                resetBtn.style.color = "#00c880";

                setTimeout(() => {
                    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                        if (tabs && tabs.length > 0) {
                            try {
                                chrome.scripting.executeScript({
                                    target: { tabId: tabs[0].id },
                                    func: () => { window.location.reload(); }
                                }).catch(e => {});
                            } catch(e) {}
                        }
                        window.location.reload();
                    });
                }, 800);
            });
        });
    });

    function updateStatusUI(isRunning) {
        if (isRunning) {
            if (statusBadge) {
                statusBadge.style.display = 'flex';
                statusBadge.classList.remove('stopped');
                statusBadge.classList.add('running');
                statusText.innerText = 'RUNNING';
            }

            mainToggleBtn.innerText = 'Stop Automation';
            mainToggleBtn.style.background = 'linear-gradient(90deg, #ff5a5a, #ff7070)';
            mainToggleBtn.style.boxShadow = '0 4px 15px rgba(255, 90, 90, 0.2)';

            actionTitle.innerText = 'Automation Running';
            actionTitle.style.color = '#ff7070';
            actionSubtitle.innerText = 'Bot is currently fetching details and printing...';

            actionCard.style.borderColor = 'rgba(255, 90, 90, 0.3)';
            stepCircle.style.backgroundColor = '#ff7070';
            stepCircle.innerText = '⚙️';
        } else {
            if (statusBadge) {
                statusBadge.style.display = 'none';
                statusBadge.classList.remove('running');
                statusBadge.classList.add('stopped');
                statusText.innerText = 'STOPPED';
            }

            mainToggleBtn.innerText = 'Start Automation';
            mainToggleBtn.style.background = 'linear-gradient(90deg, #9070ff, #b070ff)';
            mainToggleBtn.style.boxShadow = '0 4px 15px rgba(144, 112, 255, 0.2)';

            actionTitle.innerText = 'Start Automation';
            actionTitle.style.color = '#00c880';
            actionSubtitle.innerText = 'Initiate fetching and printing sequence on the RC Portal';

            actionCard.style.borderColor = 'rgba(0, 200, 100, 0.2)';
            stepCircle.style.backgroundColor = '#00c880';
            stepCircle.innerText = '1';
        }
    }
});
