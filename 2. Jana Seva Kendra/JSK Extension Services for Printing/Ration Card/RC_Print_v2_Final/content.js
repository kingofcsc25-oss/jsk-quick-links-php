// Check if this is the authorized extension tab
if (window.location.search.includes('rc_ext=true')) {
    sessionStorage.setItem('rc_ext_active', 'true');
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: "authorizeThisTab" }, () => {
            // Force a quick reload to ensure all checks pass perfectly after authorization
            window.location.href = window.location.pathname;
        });
    } else {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Inject detection flag so JSK portal knows the extension is installed
if (!document.getElementById("rc-print-extension-active")) {
    let extFlag = document.createElement("div");
    extFlag.id = "rc-print-extension-active";
    extFlag.style.display = "none";
    if (document.documentElement) {
        document.documentElement.appendChild(extFlag);
    }
}

(function () {
    if (sessionStorage.getItem('rc_ext_active') !== 'true') return;

    // Immediately watch for invalid RC error to prevent race conditions with inline scripts
    const errorObserver = new MutationObserver((mutations) => {
        let textContent = document.documentElement ? document.documentElement.innerHTML.toLowerCase() : "";
        if (textContent.includes("invalid") && (textContent.includes("rc no") || textContent.includes("ration card"))) {
            errorObserver.disconnect();
            window.postMessage({ type: 'RC_STOP_AUTOMATION', saveError: true }, '*');
        }
    });
    errorObserver.observe(document, { childList: true, subtree: true });

    // Check for pending error alert from a previous redirected run
    chrome.storage.local.get(['rc_pending_error_alert'], function (res) {
        if (res.rc_pending_error_alert) {
            // We do NOT remove it here, we let popup.js remove it so it can display it nicely in the UI.
            // Just force the UI to inject immediately!
            if (sessionStorage.getItem('rc_ext_active') === 'true') {
                isAuthorizedTab = true;
                setTimeout(() => { showExtensionUIIframe(true); }, 500); // Small delay to ensure body exists
            }
        }
    });

    // Immediately hide the website to prevent flashing upon reload if extension is active (except on the print page)
    if (sessionStorage.getItem('rc_ext_active') === 'true' && !window.location.href.toLowerCase().includes('dup_rc_view.aspx')) {
        let earlyStyle = document.createElement('style');
        earlyStyle.id = 'rc-print-hider-style';
        earlyStyle.textContent = `
            html {
                background-color: #12121a !important;
                background-image: none !important;
            }
            body, frameset {
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
            }
        `;
        if (document.documentElement) {
            document.documentElement.appendChild(earlyStyle);
        }
    }

    let isAuthorizedTab = false;
    const globalStyle = document.createElement('style');
    globalStyle.innerHTML = `
    /* Remove background image from body or any element that might be the watermark */
    body { background-image: none !important; }
    .watermark, #watermark, #Img1 { display: none !important; opacity: 0 !important; visibility: hidden !important; }
    img[src*="specimen" i], img[src*="Specimen"] { display: none !important; opacity: 0 !important; visibility: hidden !important; }
`;

    if (sessionStorage.getItem('rc_ext_active') === 'true') {
        // Perform an immediate initial check safely
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: 'checkActiveTab' }, (isActiveTab) => {
                isAuthorizedTab = isActiveTab;
                if (isActiveTab) {
                    if (document.head) {
                        document.head.appendChild(globalStyle);
                    } else {
                        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(globalStyle));
                    }
                }
            });
        }
    }

    // Continuously verify authorization with background script
    const authInterval = setInterval(() => {
        if (sessionStorage.getItem('rc_ext_active') !== 'true') {
            isAuthorizedTab = false;
            if (globalStyle.parentNode) globalStyle.remove();
            return;
        }
        if (!chrome.runtime || !chrome.runtime.id) {
            clearInterval(authInterval);
            return;
        }
        try {
            chrome.runtime.sendMessage({ action: 'checkActiveTab' }, (isActiveTab) => {
                if (chrome.runtime.lastError) return;
                isAuthorizedTab = isActiveTab;
                if (!isActiveTab && globalStyle.parentNode) {
                    globalStyle.remove();
                }
                
                // Force UI to stay injected if stopped
                if (isActiveTab && globalAutomationStatus !== 'running') {
                    showExtensionUIIframe();
                }
            });
        } catch (e) {
            if (e.message.includes("Extension context invalidated")) {
                clearInterval(authInterval);
            }
        }
    }, 500);

    // Intercept Aadhaar numbers from the "Select Family Member" modal
    const uidMap = JSON.parse(sessionStorage.getItem('rcPrintUidMap') || '{}');
    setInterval(() => {
        if (!isAuthorizedTab) return;
        if (document.body && document.body.innerText && document.body.innerText.includes('[UID:....')) {
            let regex = /([A-Za-z\s\.]+)\([^\)]+\)\[UID:\.\.\.\.(\d{4})\]/g;
            let match;
            let changed = false;
            let htmlContent = document.body.innerText;
            while ((match = regex.exec(htmlContent)) !== null) {
                let nameEn = match[1].trim().toUpperCase();
                let last4 = match[2];
                if (uidMap[nameEn] !== last4) {
                    uidMap[nameEn] = last4;
                    changed = true;
                }
            }
            if (changed) {
                sessionStorage.setItem('rcPrintUidMap', JSON.stringify(uidMap));
            }
        }
    }, 1000);

    // Continuous check for watermarks and website text
    let watermarkInterval = setInterval(() => {
        if (!isAuthorizedTab) return;
        // Specifically target Img1
        let img1 = document.getElementById('Img1');
        if (img1 && (img1.src.toLowerCase().includes('specimen') || img1.src.toLowerCase().includes('watermark'))) {
            let parent = img1.parentElement;
            img1.remove();
            if (parent && parent.tagName === 'DIV' && parent.children.length === 0 && !parent.innerText.trim()) {
                parent.remove();
            }
        }

        // Find text nodes or divs containing 'specimen'
        const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, null, false);
        let node;
        let nodesToRemove = [];
        while ((node = walker.nextNode())) {
            let text = node.nodeValue.toLowerCase();
            if (text.includes('specimen')) {
                nodesToRemove.push(node);
            }
        }
        nodesToRemove.forEach(n => {
            let p = n.parentNode;
            if (p) {
                // Hide the parent if it's a typical text container
                if (p.tagName === 'DIV' || p.tagName === 'SPAN' || p.tagName === 'P' || p.tagName === 'FONT' || p.tagName === 'A' || p.tagName === 'TD') {
                    p.style.display = 'none';
                }
                n.nodeValue = "";
            }
        });

        // Hide absolute images or images with specimen in name
        document.querySelectorAll('img').forEach(img => {
            let src = img.src.toLowerCase();
            if (src.includes('specimen') || src.includes('watermark')) {
                let parent = img.parentElement;
                img.remove();
                if (parent && parent.tagName === 'DIV' && parent.children.length === 0 && !parent.innerText.trim()) {
                    parent.remove();
                }
            } else if ((img.style.position === 'absolute' || img.style.position === 'fixed') && img.clientWidth > 300) {
                img.style.setProperty('display', 'none', 'important');
            }
        });

        // Also hide any absolutely positioned elements with 'Specimen' text
        document.querySelectorAll('*').forEach(el => {
            if (el.innerText) {
                let text = el.innerText.toLowerCase();
                if (text.includes('specimen') &&
                    (el.style.position === 'absolute' || el.style.position === 'fixed')) {
                    el.style.setProperty('display', 'none', 'important');
                }
            }
            let bg = window.getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none' && (bg.toLowerCase().includes('specimen') || bg.toLowerCase().includes('watermark'))) {
                el.style.setProperty('background-image', 'none', 'important');
            }
        });
    }, 500);

    // Add background and card type label based on RC type from local storage on the RC view page
    let cssInjected = false;
    setInterval(() => {
        if (!isAuthorizedTab) return;
        if (!cssInjected && (window.location.href.toLowerCase().includes("dup_rc_view") || document.getElementById("tblRCard"))) {
            cssInjected = true;
            chrome.storage.local.set({ 'otp_attempted': false });
            console.log("RC Print Extension: Processing dup_rc_view / tblRCard");

            // Automatically stop the automation engine once the final page is reached
            chrome.storage.local.set({ 'rc_automation_status': 'stopped' });

            chrome.storage.local.get(['fetched_rc_type', 'rc_card_type'], function (result) {
                let type = result.fetched_rc_type;
                let cardFormat = result.rc_card_type || "Normal Card";

                // Always prioritize reading from the current DOM to prevent cached stale values from previous runs
                if (document.getElementById("tblRCard")) {
                    let textContent = document.getElementById("tblRCard").innerText.toUpperCase();
                    if (textContent.includes("NPHH") || textContent.includes("NON-PRIORITY") || textContent.includes("NON PRIORITY") || textContent.includes("APL")) type = "NPHH";
                    else if (textContent.includes("AAY") || textContent.includes("ANTYODAYA")) type = "AAY";
                    else type = "PHH"; // Default fallback
                }

                if (type) {
                    let cssFile = "";
                    let cardTypeLabel = "";

                    let typePrefix = "c";
                    if (type === "PHH") {
                        typePrefix = "c";
                        cardTypeLabel = "PHH / BPL";
                    } else if (type === "NPHH") {
                        typePrefix = "b";
                        cardTypeLabel = "NPHH / APL";
                    } else if (type === "AAY") {
                        typePrefix = "a";
                        cardTypeLabel = "AAY / AAY";
                    } else {
                        typePrefix = "c";
                        cardTypeLabel = "PHH / BPL";
                    }

                    let formatSuffix = "1";
                    if (cardFormat === "Long Card") {
                        formatSuffix = "2";
                    } else if (cardFormat === "PVC Card") {
                        formatSuffix = "3";
                    } else if (cardFormat === "Normal with PVC") {
                        formatSuffix = "4";
                    } else if (cardFormat === "Long With PVC") {
                        formatSuffix = "5";
                    }

                    cssFile = chrome.runtime.getURL(typePrefix + formatSuffix + ".css");

                    if (cssFile) {
                        let link = document.createElement("link");
                        link.href = cssFile;
                        link.type = "text/css";
                        link.rel = "stylesheet";
                        if (document.head) document.head.appendChild(link);
                        console.log("Injected CSS:", cssFile);
                    }

                    // Inject the RC Type label above #lblAckNo
                    let lblAckNo = document.getElementById('lblAckNo');
                    if (lblAckNo && !document.getElementById('rc_type_label_injected')) {
                        let typeLabel = document.createElement('span');
                        typeLabel.id = 'rc_type_label_injected';
                        typeLabel.innerText = cardTypeLabel;
                        typeLabel.style.color = 'white';
                        typeLabel.style.fontWeight = 'bold';
                        typeLabel.style.fontSize = '12px';
                        typeLabel.style.display = 'block';
                        typeLabel.style.marginBottom = '6px';
                        typeLabel.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
                        lblAckNo.parentNode.insertBefore(typeLabel, lblAckNo);
                    }

                    if (cardFormat === "Long Card" || cardFormat.includes("PVC")) {
                        setTimeout(() => convertDOMToLongCard(cardFormat), 500);
                    }

                    // Add Print Button and Celebration Message
                    let exitBtn = Array.from(document.querySelectorAll('input, button')).find(el =>
                        (el.value && el.value.trim().toLowerCase() === 'exit') ||
                        (el.innerText && el.innerText.trim().toLowerCase() === 'exit')
                    );

                    if (exitBtn && exitBtn.parentNode && !document.getElementById('custom_print_btn')) {
                        let printBtn = document.createElement('button');
                        printBtn.id = 'custom_print_btn';
                        printBtn.innerText = 'Print';
                        printBtn.style.padding = '2px 15px';
                        printBtn.style.marginLeft = '10px';
                        printBtn.style.cursor = 'pointer';
                        printBtn.style.backgroundColor = '#00c880';
                        printBtn.style.color = 'white';
                        printBtn.style.border = '1px solid #00a060';
                        printBtn.style.fontWeight = 'bold';
                        printBtn.style.fontSize = '13px';

                        let celebMsg = document.createElement('div');
                        celebMsg.id = 'jana-celebration-msg';
                        celebMsg.innerHTML = '🎉 Thank you for using Jana e Seva Kendra website Extension! 🎉';
                        celebMsg.style.marginTop = '15px';
                        celebMsg.style.color = '#ff007f';
                        celebMsg.style.fontWeight = 'bold';
                        celebMsg.style.fontSize = '16px';
                        celebMsg.style.textAlign = 'center';

                        // Style to hide elements during actual print via Ctrl+P too
                        let printStyle = document.createElement('style');
                        printStyle.innerHTML = `@media print { #jana-celebration-msg, #custom_print_btn, input[value="Exit"], button, #card-switcher-sidebar, #card-switcher-icon { display: none !important; } }`;
                        document.head.appendChild(printStyle);

                        let hasDeductedForPrint = false;

                        function performPrintDeduction(callback) {
                            if (hasDeductedForPrint) {
                                if (callback) callback();
                                return;
                            }
                            try {
                                chrome.storage.local.get(['wallet_balance', 'rc_verification_type', 'rc_card_type', 'print_deducted_for_current', 'package_active', 'package_expiry', 'package_print_counts'], function (res) {
                                    if (chrome.runtime.lastError) {
                                        if (callback) callback();
                                        return;
                                    }
                                    let isPackageActive = false;
                                    if (res.package_active && res.package_expiry && res.package_expiry > Date.now()) {
                                        isPackageActive = true;
                                    }

                                    if (isPackageActive) {
                                        if (res.print_deducted_for_current) {
                                            hasDeductedForPrint = true;
                                            if (callback) callback();
                                            return;
                                        }
                                        hasDeductedForPrint = true;
                                        let counts = res.package_print_counts || { "Normal Card": 0, "Long Card": 0, "PVC Card": 0, "Normal with PVC": 0, "Long With PVC": 0 };
                                        let cardType = res.rc_card_type || "Normal Card";
                                        counts[cardType] = (counts[cardType] || 0) + 1;

                                        try {
                                            chrome.storage.local.set({
                                                'package_print_counts': counts,
                                                'print_deducted_for_current': true
                                            }, function () {
                                                if (callback) callback();
                                            });
                                        } catch (e) { if (callback) callback(); }
                                        return;
                                    }

                                    if (res.print_deducted_for_current) {
                                        hasDeductedForPrint = true;
                                        if (callback) callback();
                                        return;
                                    }
                                    let currentBal = res.wallet_balance || 0;
                                    let requiredPoints = 2;
                                    let isWithoutOtp = res.rc_verification_type === "with Out OTP";

                                    if (isWithoutOtp) {
                                        requiredPoints = 5;
                                    } else {
                                        if (res.rc_card_type === "Normal Card" || res.rc_card_type === "Long Card") {
                                            requiredPoints = 2;
                                        } else {
                                            requiredPoints = 4;
                                        }
                                    }
                                    if (currentBal >= requiredPoints) {
                                        hasDeductedForPrint = true;
                                        try {
                                            chrome.storage.local.set({
                                                'wallet_balance': currentBal - requiredPoints,
                                                'print_deducted_for_current': true
                                            }, function () {
                                                if (callback) callback();
                                            });
                                        } catch (e) { if (callback) callback(); }
                                    } else {
                                        alert("Insufficient Wallet Balance to Print! Please recharge from the extension.");
                                    }
                                });
                            } catch (err) {
                                if (callback) callback();
                            }
                        }

                        // Immediately deduct when the background applies (page loads successfully)
                        performPrintDeduction();

                        printBtn.onclick = function (e) {
                            e.preventDefault();
                            celebMsg.style.display = 'none'; // Hide completely on click as requested
                            performPrintDeduction(() => {
                                window.print();
                            });
                        };

                        window.addEventListener('beforeprint', () => {
                            celebMsg.style.display = 'none';
                            performPrintDeduction();
                        });

                        exitBtn.onclick = function (e) {
                            e.preventDefault();
                            chrome.storage.local.get(['rc_division'], function (res) {
                                if (res.rc_division) {
                                    window.location.href = res.rc_division;
                                } else {
                                    window.history.back();
                                }
                            });
                        };

                        exitBtn.parentNode.insertBefore(printBtn, exitBtn.nextSibling);

                        // Create a container for the message below the buttons
                        let msgContainer = document.createElement('div');
                        msgContainer.style.width = '100%';
                        msgContainer.style.display = 'flex';
                        msgContainer.style.justifyContent = 'center';
                        msgContainer.appendChild(celebMsg);
                        exitBtn.parentNode.appendChild(msgContainer);

                        // Render card switcher sidebar on the left
                        setTimeout(() => renderSwitcherSidebar(cardFormat), 500);
                    }
                }
            });
        }
    }, 1000);

    let isRunning = false;
    let rcNumber = "";
    let verificationType = "With OTP";
    let agentRcNumber = "";
    let cardFormat = "Normal Card";
    let stepExecuted = {
        // Pre-fetch phase (Without OTP only)
        prefetchStatusClicked: false,
        prefetchRcEntered: false,
        prefetchGoClicked: false,
        prefetchUidsCaptured: false,
        // Main phase
        statusOfRationCardClicked: false,
        withOTPClicked: false,
        rcNumberEntered: false,
        goButtonClicked: false
    };

    // Apply or remove hider overlay based on whether extension is active on this tab
    setInterval(() => {
        if (!isAuthorizedTab) return;
        if (sessionStorage.getItem('rc_ext_active') !== 'true') return;

        let hasUI = document.getElementById('rc-extension-ui-overlay');
        if (!window.location.href.toLowerCase().includes('dup_rc_view.aspx') && (isRunning || hasUI)) {
            applyHiderOverlay();
        } else {
            removeHiderOverlay();
        }
    }, 500);

    // Initial state loading is now handled in the aggressive hider block below

    let globalAgentName = "";
    let globalWalletPoints = "0";
    let globalAutomationStatus = "stopped";

    function createStatusPanel(doc, agentName, walletPoints, statusText, alignCenter = false) {
        let container = doc.createElement('div');
        container.style.cssText = `display:flex;flex-direction:column;align-items:${alignCenter ? 'center' : 'flex-end'};gap:6px;padding:8px;box-sizing:border-box;font-family:Inter,sans-serif,Arial;width:100%;`;

        let agentBadge = doc.createElement('div');
        agentBadge.style.cssText = 'background:rgba(144, 112, 255, 0.15);border:1px solid rgba(144, 112, 255, 0.3);color:#b070ff;padding:4px 8px;border-radius:20px;font-size:10px;font-weight:700;display:flex;align-items:center;gap:4px;margin-bottom:2px;box-sizing:border-box;white-space:nowrap;';
        agentBadge.innerHTML = `<span>🧑‍💼</span> <span>Agent Name: ${agentName || 'N/A'}</span>`;
        container.appendChild(agentBadge);

        let row = doc.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;align-items:center;box-sizing:border-box;';

        let walletBadge = doc.createElement('div');
        walletBadge.style.cssText = 'background:rgba(0, 200, 128, 0.1);border:1px solid rgba(0, 200, 128, 0.3);color:#00e090;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:4px;box-sizing:border-box;white-space:nowrap;';
        walletBadge.innerHTML = `<span>🪙</span> <span>${walletPoints || '0'} PTS</span>`;
        row.appendChild(walletBadge);

        let isRunning = (statusText && statusText.toLowerCase() === 'running');
        let statusBadge = doc.createElement('div');
        statusBadge.style.cssText = `background:${isRunning ? 'rgba(0, 200, 128, 0.1)' : 'rgba(255, 60, 60, 0.1)'};border:1px solid ${isRunning ? 'rgba(0, 200, 128, 0.3)' : 'rgba(255, 60, 60, 0.3)'};color:${isRunning ? '#00e090' : '#ff6060'};padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:6px;box-sizing:border-box;white-space:nowrap;`;

        let dot = doc.createElement('div');
        dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${isRunning ? '#00e090' : '#ff6060'};box-shadow:0 0 8px ${isRunning ? '#00e090' : '#ff6060'};`;
        statusBadge.appendChild(dot);

        let txt = doc.createElement('span');
        txt.innerText = (statusText || 'STOPPED').toUpperCase();
        statusBadge.appendChild(txt);

        row.appendChild(statusBadge);
        container.appendChild(row);

        return container;
    }

    function injectFloatingStatusPanel(agentName, walletPoints, statusText) {
        if (window.location.href.toLowerCase().includes('dup_rc_view.aspx')) return;
        if (sessionStorage.getItem('rc_ext_active') !== 'true') return;

        let widget = document.getElementById('rc-floating-status-widget');
        if (!widget) {
            widget = document.createElement('div');
            widget.id = 'rc-floating-status-widget';
            widget.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999999;background:rgba(26, 36, 54, 0.95);border:1px solid rgba(144, 112, 255, 0.35);border-radius:12px;padding:8px;box-shadow:0 8px 32px rgba(0, 0, 0, 0.5);display:flex;flex-direction:column;align-items:flex-end;gap:4px;box-sizing:border-box;pointer-events:auto;';
            document.documentElement.appendChild(widget);
        }

        widget.innerHTML = '';
        let panel = createStatusPanel(document, agentName, walletPoints, statusText, false);
        widget.appendChild(panel);
    }

    function showDuplicateTransactionModal() {
        if (document.getElementById('rc-duplicate-warning-overlay')) return;

        let overlay = document.createElement('div');
        overlay.id = 'rc-duplicate-warning-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:100000000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);font-family:Inter,sans-serif,Arial;';

        let modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(145deg, #1e1e2f, #151522);border:1px solid rgba(255, 60, 60, 0.3);border-radius:16px;padding:24px;width:400px;box-sizing:border-box;box-shadow:0 10px 45px rgba(0,0,0,0.6);text-align:center;animation:scaleInWarning 0.3s ease-out;';

        let style = document.createElement('style');
        style.textContent = `
        @keyframes scaleInWarning { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `;
        document.head.appendChild(style);

        let icon = document.createElement('div');
        icon.innerHTML = '⚠️';
        icon.style.cssText = 'font-size:48px;margin-bottom:16px;';
        modal.appendChild(icon);

        let title = document.createElement('h2');
        title.innerText = 'Duplicate Transaction / Wrong OTP';
        title.style.cssText = 'color:#ff6060;font-size:20px;font-weight:800;margin:0 0 12px 0;text-transform:uppercase;letter-spacing:0.5px;';
        modal.appendChild(title);

        let desc = document.createElement('p');
        desc.innerText = "You enter the Wrong OTP's plz ,Work with Agent or Select other Members name.";
        desc.style.cssText = 'color:#b0b0c5;font-size:14px;line-height:1.5;margin:0 0 24px 0;font-weight:500;';
        modal.appendChild(desc);

        let btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

        let agentBtn = document.createElement('button');
        agentBtn.innerText = 'Work with Agent';
        agentBtn.style.cssText = 'width:100%;padding:12px;background:linear-gradient(90deg, #b070ff, #7070ff);border:none;border-radius:8px;color:#fff;font-weight:700;font-size:14px;cursor:pointer;transition:transform 0.2s, box-shadow 0.2s;';
        agentBtn.onmouseover = () => { agentBtn.style.transform = 'scale(1.02)'; agentBtn.style.boxShadow = '0 0 15px rgba(176, 112, 255, 0.4)'; };
        agentBtn.onmouseout = () => { agentBtn.style.transform = 'none'; agentBtn.style.boxShadow = 'none'; };
        agentBtn.onclick = () => {
            agentBtn.innerText = 'Setting up Agent mode...';
            chrome.storage.local.set({
                'rc_verification_type': 'Without OTP',
                'otp_attempted': false,
                'print_deducted_for_current': false
            }, () => {
                sessionStorage.removeItem('rc_agent_rc_swapped');
                sessionStorage.removeItem('rc_aadhar_prefetched');
                chrome.storage.local.get(['rc_division'], function (result) {
                    let startUrl = result.rc_division || "https://ahara.karnataka.gov.in/";
                    let separator = startUrl.includes('?') ? '&' : '?';
                    window.location.href = startUrl + separator + 'rc_ext=true';
                });
            });
        };
        btnContainer.appendChild(agentBtn);

        let memberBtn = document.createElement('button');
        memberBtn.innerText = 'Select Other Member';
        memberBtn.style.cssText = 'width:100%;padding:12px;background:rgba(255, 255, 255, 0.08);border:1px solid rgba(255, 255, 255, 0.15);border-radius:8px;color:#fff;font-weight:700;font-size:14px;cursor:pointer;transition:transform 0.2s, background 0.2s;';
        memberBtn.onmouseover = () => { memberBtn.style.transform = 'scale(1.02)'; memberBtn.style.background = 'rgba(255, 255, 255, 0.15)'; };
        memberBtn.onmouseout = () => { memberBtn.style.transform = 'none'; memberBtn.style.background = 'rgba(255, 255, 255, 0.08)'; };
        memberBtn.onclick = () => {
            memberBtn.innerText = 'Resetting Member...';
            chrome.storage.local.set({
                'rc_verification_type': 'With OTP',
                'selected_member_name': '',
                'otp_attempted': false,
                'print_deducted_for_current': false
            }, () => {
                sessionStorage.removeItem('rc_agent_rc_swapped');
                sessionStorage.removeItem('rc_aadhar_prefetched');
                chrome.storage.local.get(['rc_division'], function (result) {
                    let startUrl = result.rc_division || "https://ahara.karnataka.gov.in/";
                    let separator = startUrl.includes('?') ? '&' : '?';
                    window.location.href = startUrl + separator + 'rc_ext=true';
                });
            });
        };
        btnContainer.appendChild(memberBtn);

        modal.appendChild(btnContainer);
        overlay.appendChild(modal);
        document.documentElement.appendChild(overlay);
    }

    // Listen for status changes from popup
    chrome.storage.onChanged.addListener(function (changes, namespace) {
        if (namespace === 'local') {
            if (changes.rc_number) {
                rcNumber = changes.rc_number.newValue;
            }
            if (changes.rc_verification_type) {
                verificationType = changes.rc_verification_type.newValue;
            }
            if (changes.agent_rc_number) {
                agentRcNumber = changes.agent_rc_number.newValue;
            }
            if (changes.agent_name) {
                agentName = changes.agent_name.newValue;
                globalAgentName = agentName;
            }
            if (changes.otp_attempted) {
                otpAttempted = changes.otp_attempted.newValue;
            }
            if (changes.rc_card_type) {
                cardFormat = changes.rc_card_type.newValue;
            }
            if (changes.wallet_balance) {
                globalWalletPoints = changes.wallet_balance.newValue || "0";
            }
            if (changes.rc_automation_status) {
                globalAutomationStatus = changes.rc_automation_status.newValue || "stopped";
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({ action: 'checkActiveTab' }, (isActiveTab) => {
                        if (!isActiveTab) return;
                        isAuthorizedTab = true;
                        
                        isRunning = (changes.rc_automation_status.newValue === 'running');
                    if (isRunning) {
                        if (sessionStorage.getItem('rc_ext_active') !== 'true') return;
                        console.log("RC Print Automation Started");
                        sessionStorage.setItem('rc_isRunning', 'true');
                        sessionStorage.removeItem('rc_agent_rc_swapped');
                        let uiOverlay = document.getElementById('rc-extension-ui-overlay');
                        if (uiOverlay) uiOverlay.remove();
                        let uiStyle = document.getElementById('rc-extension-ui-style');
                        if (uiStyle) uiStyle.remove();
                        if (typeof startAutomation === "function") startAutomation();
                    } else {
                        if (sessionStorage.getItem('rc_ext_active') !== 'true') return;
                        console.log("RC Print Automation Stopped");
                        sessionStorage.removeItem('rc_isRunning');
                        sessionStorage.removeItem('rc_agent_rc_swapped');
                        if (typeof stopAutomation === "function") stopAutomation();
                        showExtensionUIIframe();
                    }
                });
            }
        }

        if (sessionStorage.getItem('rc_ext_active') === 'true') {
                injectFloatingStatusPanel(globalAgentName, globalWalletPoints, globalAutomationStatus);
            }
        }
    });

    function showExtensionUIIframe(forceOpen = false) {
        if (!forceOpen) {
            if (!isAuthorizedTab) return;
            if (window !== window.top) return;
            if (sessionStorage.getItem('rc_ext_active') !== 'true') return;
            const url = window.location.href.toLowerCase();
            const isAhara = url.includes('ahara.karnataka.gov.in');
            const isJSK = url.includes('localhost') || url.includes('doulf.in') || url.includes('jsk-quick-links-php.vercel.app');
            if (!isAhara && !isJSK) return;
            if (url.includes('dup_rc_view.aspx')) return;
        }
        if (document.getElementById('rc-extension-ui-overlay')) return;

        // Center it on the display with a semi-transparent dark backdrop overlay
        let overlay = document.createElement('div');
        overlay.id = 'rc-extension-ui-overlay';
        overlay.style.cssText = [
            'position:fixed',
            'top:0',
            'left:0',
            'width:100vw',
            'height:100vh',
            'z-index:2147483647',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'background-color:rgba(0, 0, 0, 0.75)'
        ].join(';');

        let iframe = document.createElement('iframe');
        iframe.src = chrome.runtime.getURL('popup.html');
        iframe.style.cssText = 'width:100%;height:100%;border:none;background:transparent;display:block;';

        overlay.appendChild(iframe);

        let injectOverlay = () => {
            if (!document.getElementById('rc-extension-ui-overlay')) {
                document.documentElement.appendChild(overlay);
            }
        };

        injectOverlay();
    }

    // Hider overlay logic removed per user request



    window.addEventListener("message", (event) => {
        // Allow messages from the popup iframe
        if (event.source !== window && event.source !== window.parent && (!event.data || !event.data.action)) {
            // Keep existing logic but relax source check slightly for action messages
        }
        
        if (event.data && event.data.action === "CLOSE_JSK_TAB") {
            window.close();
            return;
        }

        if (event.source !== window) return;
        if (event.data && event.data.type === "OTP_SUBMITTED") {
            console.log("OTP was submitted. Marking attempt.");
            try { chrome.storage.local.set({ 'otp_attempted': true }); } catch (e) { }
            otpAttempted = true;
        }
        if (event.data && event.data.type === "MEMBER_SELECTED") {
            console.log("Member selected:", event.data.memberName);
            selectedMemberName = event.data.memberName;
            try { chrome.storage.local.set({ 'selected_member_name': event.data.memberName }); } catch (e) { }
        }
        if (event.data && event.data.type === "RC_STOP_AUTOMATION") {
            console.log("Stopping automation requested from page context.");
            try {
                let updates = { 'rc_automation_status': 'stopped' };
                if (event.data.saveError) {
                    updates['rc_pending_error_alert'] = "You Enter RC No is invalid and is not existing in the Ration Card database. in AHARA DEPARMENT . Chick the Division OR RC no onlys agen.";
                }
                chrome.storage.local.set(updates, () => {
                    let otpOverlay = document.getElementById('rc-premium-otp-overlay');
                    if (otpOverlay) otpOverlay.remove();
                    let captchaOverlay = document.getElementById('rc-premium-captcha-overlay');
                    if (captchaOverlay) captchaOverlay.remove();

                    if (event.data.saveError) {
                        window.top.location.href = 'https://ahara.karnataka.gov.in/';
                    } else {
                        chrome.storage.local.get(['rc_division'], function (res) {
                            if (res.rc_division) {
                                window.top.location.href = res.rc_division;
                            } else {
                                window.top.location.reload();
                            }
                        });
                    }
                });
            } catch (e) { }
        }
        if (event.data && event.data.type === "RC_INVALID_NUMBER") {
            console.log("Invalid RC Number or Division. Switching Division...");
            chrome.storage.local.get(['rc_division', 'rc_automation_status'], function (res) {
                if (res.rc_automation_status !== 'running') return;

                let currentDiv = res.rc_division || "";
                let divisions = [
                    "https://ahara.karnataka.gov.in/FCS_VERIFY_BSER/",
                    "https://ahara.karnataka.gov.in/FCS_VERIFY_KSER/",
                    "https://ahara.karnataka.gov.in/FCS_VERIFY_MSER/"
                ];
                let idx = divisions.indexOf(currentDiv);
                if (idx === -1) idx = 0;

                let nextDiv = divisions[(idx + 1) % divisions.length];
                chrome.storage.local.set({ 'rc_division': nextDiv }, function () {
                    window.location.href = nextDiv;
                });
            });
        }
        if (event.data && event.data.type === "RC_RESTART_FROM_START") {
            console.log("Restarting automation requested from page context. Showing duplicate transaction modal...");
            if (typeof showDuplicateTransactionModal === "function") {
                showDuplicateTransactionModal();
            }
        }
        if (event.data && event.data.action === "START_RC_EXTENSION") {
            console.log("Received trigger from JSK Portal to start RC Extension.");
            isAuthorizedTab = true;
            sessionStorage.setItem('rc_ext_active', 'true');
            showExtensionUIIframe(true);
        }
    });

    // Initial aggressive hiding and state loading to prevent flash and race conditions
    let agentName = "";
    let selectedMemberName = "";
    let otpAttempted = false;
    chrome.storage.local.get(['rc_automation_status', 'rc_number', 'rc_verification_type', 'agent_rc_number', 'agent_name', 'otp_attempted', 'selected_member_name', 'rc_card_type', 'wallet_balance'], function (result) {
        rcNumber = result.rc_number || "";
        verificationType = result.rc_verification_type || "With OTP";
        agentRcNumber = result.agent_rc_number || "";
        agentName = result.agent_name || "";
        selectedMemberName = result.selected_member_name || "";
        otpAttempted = result.otp_attempted || false;
        cardFormat = result.rc_card_type || "Normal Card";

        globalAgentName = agentName;
        globalWalletPoints = result.wallet_balance || "0";
        globalAutomationStatus = result.rc_automation_status || "stopped";

        if (sessionStorage.getItem('rc_ext_active') !== 'true') return;

        injectFloatingStatusPanel(globalAgentName, globalWalletPoints, globalAutomationStatus);

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: 'checkActiveTab' }, (isActiveTab) => {
                if (!isActiveTab) {
                    removeHiderOverlay();
                    return;
                }
                isAuthorizedTab = true;

            if (result.rc_automation_status === 'running') {
                isRunning = true;
                sessionStorage.setItem('rc_isRunning', 'true');

                // Auto-trigger Cancel & Go Home if page contains invalid RC error
                let pageHTML = document.documentElement.innerHTML.toLowerCase();
                if ((pageHTML.includes('invalid') && pageHTML.includes('rc no')) ||
                    (pageHTML.includes('invalid') && pageHTML.includes('ration card'))) {
                    window.postMessage({ type: 'RC_STOP_AUTOMATION', saveError: true }, '*');
                    return;
                }

                sessionStorage.removeItem('rc_agent_rc_swapped');

                // Silence annoying browser popups by asking background.js to inject into MAIN world (Bypasses CSP)
                chrome.runtime.sendMessage({ action: "silenceAlertsMainWorld" });

                if (typeof startAutomation === "function") startAutomation();
            } else {
                sessionStorage.removeItem('rc_agent_rc_swapped');
                showExtensionUIIframe();
            }
        });
        }
    });

    // Main automation loop
    let automationInterval = setInterval(() => {
        if (!isRunning) return;
        if (sessionStorage.getItem('rc_ext_active') !== 'true') return;

        try {
            // Enforce active tab restriction during the loop
            chrome.runtime.sendMessage({ action: 'checkActiveTab' }, (isActiveTab) => {
                if (!isActiveTab) {
                    if (isRunning) {
                        console.log("This tab is no longer the active extension tab. Stopping automation.");
                        isRunning = false;
                        sessionStorage.removeItem('rc_isRunning');
                        stopAutomation();
                        let uiOverlay = document.getElementById('rc-extension-ui-overlay');
                        if (uiOverlay) uiOverlay.remove();
                        let uiStyle = document.getElementById('rc-extension-ui-style');
                        if (uiStyle) uiStyle.remove();
                    }
                    return;
                }

                // Check for "Duplicate Transaction" error in visible page content
                if (document.body && document.body.innerText && (
                    document.body.innerText.toLowerCase().includes("duplicate transaction")
                )) {
                    console.log("Duplicate Transaction error detected on page text. Showing warning modal...");
                    if (typeof showDuplicateTransactionModal === "function") {
                        showDuplicateTransactionModal();
                    }
                    return;
                }

                // Determine if Without OTP is selected
                let isWithoutOtp = (verificationType === "Without OTP" || verificationType === "with Out OTP");
                let agentRcSwapped = sessionStorage.getItem('rc_agent_rc_swapped') === 'true';
                chrome.runtime.sendMessage({ action: "checkElementExistsMainWorld", text: "View Ration Card Details" }, (finalRes) => {
                    if (chrome.runtime.lastError) return;

                    if (finalRes && finalRes.exists) {
                        // Step 11: Final Page Logic - Swap RC and Extract UIDs from table if Without OTP
                        if (isWithoutOtp && agentRcNumber && rcNumber) {
                            if (!stepExecuted.finalRcSwapped) {
                                chrome.runtime.sendMessage({ action: "replaceAgentRcMainWorld", agent: agentRcNumber, target: rcNumber }, (repRes) => {
                                    if (chrome.runtime.lastError) return;
                                    if (repRes && repRes.status === "REPLACED") {
                                        console.log("Final page reached. Swapped Agent RC to Customer RC and clicked GO.");
                                        stepExecuted.finalRcSwapped = true;
                                    } else {
                                        // Agent RC not found, means Customer RC is already present!
                                        if (!stepExecuted.finalUidsCaptured) {
                                            chrome.runtime.sendMessage({ action: "captureUidsFromTableMainWorld" }, (capRes) => {
                                                if (chrome.runtime.lastError) return;
                                                if (capRes && capRes.status === "CAPTURED") {
                                                    console.log("Captured UIDs from final table.");
                                                    stepExecuted.finalUidsCaptured = true;
                                                }
                                                if (!stepExecuted.finalViewClicked) {
                                                    chrome.runtime.sendMessage({ action: "extractRcTypeAndClickViewMainWorld" }, (res) => {
                                                        if (res && res.status === "CLICKED") {
                                                            console.log("Successfully extracted RC Type and clicked View Details.");
                                                            stepExecuted.finalViewClicked = true;
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    }
                                });
                            }
                        } else {
                            if (!stepExecuted.finalUidsCaptured) {
                                chrome.runtime.sendMessage({ action: "captureUidsFromTableMainWorld" }, (capRes) => {
                                    if (chrome.runtime.lastError) return;
                                    if (capRes && capRes.status === "CAPTURED") {
                                        console.log("Captured UIDs from final table (With OTP).");
                                        stepExecuted.finalUidsCaptured = true;
                                    }
                                    if (!stepExecuted.finalViewClicked) {
                                        chrome.runtime.sendMessage({ action: "extractRcTypeAndClickViewMainWorld" }, (res) => {
                                            if (chrome.runtime.lastError) return;
                                            if (res && res.status === "CLICKED") {
                                                console.log("Successfully extracted RC Type and clicked View Details.");
                                                stepExecuted.finalViewClicked = true;
                                            }
                                        });
                                    }
                                });
                            }
                        }
                    } else {
                        chrome.runtime.sendMessage({ action: "checkElementExistsMainWorld", text: "Enter OTP" }, (otpRes) => {
                            if (chrome.runtime.lastError) return;

                            if (otpRes && otpRes.exists) {
                                // Step 10: Show Premium OTP UI and Swap RC
                                if (isWithoutOtp && agentRcNumber && rcNumber && !stepExecuted.otpPageRcSwapped) {
                                    console.log("OTP field detected. Swapping Agent RC to Customer RC silently before OTP submission.");
                                    chrome.runtime.sendMessage({ action: "swapRcOnlyMainWorld", agent: agentRcNumber, target: rcNumber }, (res) => {
                                        stepExecuted.otpPageRcSwapped = true;
                                    });
                                }

                                chrome.runtime.sendMessage({
                                    action: "extractOtpAndShowOverlayMainWorld",
                                    agentName: agentName,
                                    selectedMemberName: selectedMemberName,
                                    isRetry: otpAttempted,
                                    verificationType: verificationType,
                                    walletPoints: globalWalletPoints,
                                    status: globalAutomationStatus
                                }, (res) => {
                                    if (chrome.runtime.lastError) return;
                                    if (res && res.status === "SHOWN") {
                                        console.log("Successfully displayed custom premium OTP overlay.");
                                        stepExecuted.otpOverlayShown = true;
                                    }
                                });
                            } else {
                                chrome.runtime.sendMessage({ action: "checkElementExistsMainWorld", text: "Select Type of Authentication" }, (authTypeRes) => {
                                    if (chrome.runtime.lastError) return;

                                    if (authTypeRes && authTypeRes.exists) {
                                        // Step 9: Select OTP Radio Button
                                        if (!stepExecuted.authTypeSelected) {
                                            console.log("OTP section detected. Selecting OTP radio button...");
                                            clickRadioButtonByLabel("OTP", "authTypeSelected");
                                        }
                                    } else {
                                        chrome.runtime.sendMessage({ action: "checkElementExistsMainWorld", text: "I hereby state" }, (consentRes) => {
                                            if (chrome.runtime.lastError) return;

                                            if (consentRes && consentRes.exists) {
                                                // Step 8: Aadhaar Consent
                                                if (!stepExecuted.consentSelected) {
                                                    console.log("Aadhaar consent detected. Selecting Yes...");
                                                    clickRadioButtonByLabel("Yes", "consentSelected");
                                                }
                                            } else {
                                                chrome.runtime.sendMessage({ action: "checkElementExistsMainWorld", text: "Enter Captcha" }, (capRes) => {
                                                    if (chrome.runtime.lastError) return;

                                                    if (capRes && capRes.exists) {
                                                        // Fallback swap to ensure RC is swapped before OTP
                                                        if (isWithoutOtp && agentRcNumber && rcNumber && !stepExecuted.captchaPageRcSwapped) {
                                                            console.log("Captcha field detected. Ensuring Agent RC is swapped to Customer RC.");
                                                            chrome.runtime.sendMessage({ action: "swapRcOnlyMainWorld", agent: agentRcNumber, target: rcNumber }, () => {
                                                                stepExecuted.captchaPageRcSwapped = true;
                                                            });
                                                        }

                                                        // Step 8: Show Premium Captcha UI
                                                        chrome.runtime.sendMessage({
                                                            action: "extractCaptchaAndShowOverlayMainWorld",
                                                            agentName: globalAgentName,
                                                            walletPoints: globalWalletPoints,
                                                            status: globalAutomationStatus
                                                        }, (res) => {
                                                            if (chrome.runtime.lastError) return;
                                                            if (res && res.status === "SHOWN") {
                                                                console.log("Successfully displayed custom premium captcha overlay.");
                                                                stepExecuted.captchaOverlayShown = true;
                                                            }
                                                        });
                                                    } else {
                                                        chrome.runtime.sendMessage({ action: "checkElementExistsMainWorld", text: "Choose Language" }, (langRes) => {
                                                            if (chrome.runtime.lastError) return;

                                                            let languageRowExists = langRes && langRes.exists;

                                                            if (languageRowExists) {
                                                                // Step 6: Select English Language
                                                                if (!stepExecuted.languageSelected) {
                                                                    console.log("Language selection detected. Selecting English...");
                                                                    clickRadioButtonByLabel("English", "languageSelected");
                                                                }
                                                            } else {
                                                                chrome.runtime.sendMessage({ action: "checkElementExistsMainWorld", text: "Member" }, (response) => {
                                                                    if (chrome.runtime.lastError) return;

                                                                    let memberRowExists = response && response.exists;

                                                                    if (memberRowExists) {
                                                                        // Step 5: Handle Member Selection
                                                                        if (!stepExecuted.overlayShown) {
                                                                            if (isWithoutOtp && agentName) {
                                                                                console.log("Without OTP mode detected. Auto-selecting Agent Name:", agentName);
                                                                                chrome.runtime.sendMessage({ action: "selectDropdownOptionMainWorld", labelText: "Member", optionText: agentName }, (res) => {
                                                                                    if (chrome.runtime.lastError) return;
                                                                                    if (res && res.selected) {
                                                                                        console.log("Successfully selected agent name from dropdown and auto-clicked GO.");
                                                                                        stepExecuted.overlayShown = true;

                                                                                        // Swap the RC immediately after clicking GO for Member selection
                                                                                        if (agentRcNumber && rcNumber) {
                                                                                            console.log("Swapping Agent RC to Customer RC silently right after Member selection.");
                                                                                            chrome.runtime.sendMessage({ action: "swapRcOnlyMainWorld", agent: agentRcNumber, target: rcNumber });
                                                                                        }

                                                                                    } else {
                                                                                        console.log("Agent Name not found in dropdown. Falling back to manual selection overlay.");
                                                                                        chrome.runtime.sendMessage({
                                                                                            action: "extractOptionsAndShowOverlayMainWorld",
                                                                                            labelText: "Member",
                                                                                            buttonText: "GO",
                                                                                            agentName: globalAgentName,
                                                                                            walletPoints: globalWalletPoints,
                                                                                            status: globalAutomationStatus
                                                                                        }, (fallbackRes) => {
                                                                                            if (chrome.runtime.lastError) return;
                                                                                            if (fallbackRes && fallbackRes.status === "SHOWN") {
                                                                                                console.log("Displayed custom premium overlay as fallback.");
                                                                                                stepExecuted.overlayShown = true;
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                });
                                                                            } else {
                                                                                // Standard With OTP mode: Show premium overlay for user to select a member
                                                                                chrome.runtime.sendMessage({
                                                                                    action: "extractOptionsAndShowOverlayMainWorld",
                                                                                    labelText: "Member",
                                                                                    buttonText: "GO",
                                                                                    agentName: globalAgentName,
                                                                                    walletPoints: globalWalletPoints,
                                                                                    status: globalAutomationStatus
                                                                                }, (res) => {
                                                                                    if (chrome.runtime.lastError) return;
                                                                                    if (res && res.status === "SHOWN") {
                                                                                        console.log("Successfully extracted members and displayed custom premium overlay.");
                                                                                        stepExecuted.overlayShown = true;
                                                                                    }
                                                                                });
                                                                            }
                                                                        }
                                                                    } else {
                                                                        // =============================================
                                                                        // MAIN PHASE: Normal automation flow
                                                                        // =============================================
                                                                        // Step 1: Click "Status of Ration Card"
                                                                        if (!stepExecuted.statusOfRationCardClicked) {
                                                                            clickElementByText("Status of Ration Card", "statusOfRationCardClicked");
                                                                        }

                                                                        // Step 2: Click "With OTP"
                                                                        if (!stepExecuted.withOTPClicked) {
                                                                            // Even if "Without OTP" is selected, we must click "With OTP" on the website 
                                                                            // so it proceeds to ask for the RC number
                                                                            clickRadioButtonByLabel("With OTP", "withOTPClicked");
                                                                        }

                                                                        // Step 3: Enter RC Number
                                                                        if (stepExecuted.withOTPClicked && !stepExecuted.rcNumberEntered) {
                                                                            let targetRc = (isWithoutOtp && agentRcNumber) ? agentRcNumber : rcNumber;
                                                                            if (targetRc) {
                                                                                console.log("Attempting to enter RC Number:", targetRc);
                                                                                enterTextByLabel("Enter RC Number", targetRc, "rcNumberEntered");
                                                                            }
                                                                        }

                                                                        // Step 4: Click GO
                                                                        if (stepExecuted.rcNumberEntered && !stepExecuted.goButtonClicked) {
                                                                            clickElementByText("GO", "goButtonClicked");
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            });
        } catch (error) {
            if (error.message.includes("Extension context invalidated")) {
                clearInterval(automationInterval);
            }
        }
    }, 1000);

    function applyHiderOverlay() {
        function injectStyleRecursive(win) {
            try {
                let doc = win.document;
                if (doc && !doc.getElementById('rc-print-hider-style')) {
                    let style = doc.createElement('style');
                    style.id = 'rc-print-hider-style';
                    style.textContent = `
                    html {
                        background-color: #12121a !important;
                        background-image: none !important;
                    }
                    body, frameset {
                        display: none !important;
                        opacity: 0 !important;
                        visibility: hidden !important;
                        pointer-events: none !important;
                    }
                `;
                    if (doc.documentElement) {
                        doc.documentElement.appendChild(style);
                    }
                }

                // Add a loader if we are in a reasonably sized window
                let hasPopup = doc && (doc.getElementById('rc-premium-overlay') || doc.getElementById('rc-premium-captcha-overlay') || doc.getElementById('rc-premium-otp-overlay') || doc.getElementById('rc-extension-ui-overlay'));
                let loaderEl = doc ? doc.getElementById('rc-print-hider-loader') : null;

                if (hasPopup && loaderEl) {
                    loaderEl.remove();
                } else if (!hasPopup && doc && doc.body && doc.body.tagName && doc.body.tagName.toLowerCase() !== 'frameset' && !loaderEl) {
                    if (win.innerWidth > 300 && win.innerHeight > 200) {
                        let loader = doc.createElement('div');
                        loader.id = 'rc-print-hider-loader';
                        loader.style.position = 'fixed';
                        loader.style.top = '50%';
                        loader.style.left = '50%';
                        loader.style.transform = 'translate(-50%, -50%)';
                        loader.style.zIndex = '999997'; // Below our popups (999999)
                        loader.innerHTML = `
                        <div style="background: linear-gradient(145deg, #1e1e2d, #12121a); border: 1px solid rgba(144, 112, 255, 0.2); border-radius: 20px; padding: 40px; text-align: center; width: 450px; max-width: 90vw; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                            <h1 style="color: #00e090; font-family: 'Inter', sans-serif; font-size: 26px; font-weight: 800; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1.5px; text-shadow: 0 2px 10px rgba(0, 224, 144, 0.3);">Jana E Seva Kendra</h1>
                            <p style="color: #b070ff; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700; margin: 0 0 35px 0; letter-spacing: 3px; text-transform: uppercase;">Work Smart • Earn More</p>
                            
                            <div style="width: 70px; height: 70px; border: 4px solid rgba(144, 112, 255, 0.1); border-top: 4px solid #b070ff; border-left: 4px solid #00e090; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 25px auto; box-shadow: 0 0 20px rgba(144, 112, 255, 0.2);"></div>
                            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
                            
                            <h2 style="color: #fff; font-family: 'Inter', sans-serif; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">Automation Running...</h2>
                            
                            <button id="rc-hider-cancel-btn" style="background: rgba(255, 60, 60, 0.1); border: 1px solid rgba(255, 60, 60, 0.3); color: #ff6060; padding: 10px 24px; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 30px; transition: all 0.2s;">
                                Cancel & Go Home
                            </button>
                            
                            <div style="display: flex; align-items: center; justify-content: flex-start; gap: 20px; background: rgba(0,0,0,0.4); padding: 20px; border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1);">
                                <div style="flex-shrink: 0; background: #fff; padding: 5px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://chat.whatsapp.com/CA4G8EOFRP91heRRxDT3cg" style="width: 80px; height: 80px; border-radius: 8px;">
                                </div>
                                <div style="text-align: left;">
                                    <h3 style="color: #fff; font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 700; margin: 0 0 6px 0;">Join Our Community</h3>
                                    <p style="color: #8c8c9e; font-family: 'Inter', sans-serif; font-size: 12px; margin: 0; line-height: 1.4;">Scan this QR code for any help and latest updates.</p>
                                </div>
                            </div>
                        </div>
                    `;
                        doc.documentElement.appendChild(loader);
                        let cancelBtn = doc.getElementById('rc-hider-cancel-btn');
                        if (cancelBtn) {
                            cancelBtn.addEventListener('click', function () {
                                chrome.storage.local.set({ 'rc_automation_status': 'stopped' }, () => {
                                    chrome.storage.local.get(['rc_division'], function (res) {
                                        if (res.rc_division) {
                                            window.top.location.href = res.rc_division;
                                        } else {
                                            window.top.location.reload();
                                        }
                                    });
                                });
                            });
                            cancelBtn.addEventListener('mouseover', function () {
                                this.style.background = 'rgba(255, 60, 60, 0.2)';
                            });
                            cancelBtn.addEventListener('mouseout', function () {
                                this.style.background = 'rgba(255, 60, 60, 0.1)';
                            });
                        }
                    }
                }

                for (let i = 0; i < win.frames.length; i++) {
                    injectStyleRecursive(win.frames[i]);
                }
            } catch (e) { }
        }
        injectStyleRecursive(window);
    }

    function removeHiderOverlay() {
        function removeStyleRecursive(win) {
            try {
                if (win.document) {
                    let style = win.document.getElementById('rc-print-hider-style');
                    if (style) style.remove();

                    let loader = win.document.getElementById('rc-print-hider-loader');
                    if (loader) loader.remove();
                }
                for (let i = 0; i < win.frames.length; i++) {
                    removeStyleRecursive(win.frames[i]);
                }
            } catch (e) { }
        }
        removeStyleRecursive(window);
    }

    function startAutomation() {
        if (!isRunning) return;
        console.log("Executing RC Print automation sequence...");
        // Pre-fetch phase flags
        stepExecuted.prefetchStatusClicked = false;
        stepExecuted.prefetchRcEntered = false;
        stepExecuted.prefetchGoClicked = false;
        stepExecuted.prefetchUidsCaptured = false;
        // Main phase flags
        stepExecuted.statusOfRationCardClicked = false;
        stepExecuted.withOTPClicked = false;
        stepExecuted.rcNumberEntered = false;
        stepExecuted.goButtonClicked = false;
        stepExecuted.overlayShown = false;
        stepExecuted.languageSelected = false;
        stepExecuted.captchaOverlayShown = false;
        stepExecuted.consentSelected = false;
        stepExecuted.authTypeSelected = false;
        stepExecuted.otpOverlayShown = false;
    }

    function stopAutomation() {
        console.log("Halted RC Print automation sequence.");
        removeHiderOverlay();
        // Pre-fetch phase flags
        stepExecuted.prefetchStatusClicked = false;
        stepExecuted.prefetchRcEntered = false;
        stepExecuted.prefetchGoClicked = false;
        stepExecuted.prefetchUidsCaptured = false;
        // Main phase flags
        stepExecuted.statusOfRationCardClicked = false;
        stepExecuted.withOTPClicked = false;
        stepExecuted.rcNumberEntered = false;
        stepExecuted.goButtonClicked = false;
        stepExecuted.overlayShown = false;
        stepExecuted.languageSelected = false;
        stepExecuted.captchaOverlayShown = false;
        stepExecuted.consentSelected = false;
        stepExecuted.authTypeSelected = false;
        stepExecuted.otpOverlayShown = false;
        sessionStorage.removeItem('rc_aadhar_prefetched');
    }

    // Delegate click to Background script to run in MAIN world and avoid CSP errors
    function clickElementByText(searchText, stepName) {
        try {
            chrome.runtime.sendMessage({ action: "clickElementMainWorld", text: searchText }, (response) => {
                if (chrome.runtime.lastError) return;
                if (response && response.clicked) {
                    console.log(`Successfully clicked element containing text: ${searchText} via MAIN world`);
                    if (stepName) stepExecuted[stepName] = true;
                }
            });
        } catch (error) {
            if (error.message.includes("Extension context invalidated")) {
                clearInterval(automationInterval);
            }
        }
    }

    function clickRadioButtonByLabel(labelText, stepName) {
        try {
            chrome.runtime.sendMessage({ action: "clickRadioButtonMainWorld", text: labelText }, (response) => {
                if (chrome.runtime.lastError) return;
                if (response && response.clicked) {
                    console.log(`Successfully clicked radio button for: ${labelText} via MAIN world`);
                    if (stepName) stepExecuted[stepName] = true;
                }
            });
        } catch (error) {
            if (error.message.includes("Extension context invalidated")) {
                clearInterval(automationInterval);
            }
        }
    }

    function enterTextByLabel(labelText, inputText, stepName) {
        try {
            chrome.runtime.sendMessage({ action: "enterTextMainWorld", text: labelText, value: inputText }, (response) => {
                if (chrome.runtime.lastError) return;
                if (response && response.success) {
                    console.log(`Successfully entered text for: ${labelText} via MAIN world`);
                    if (stepName) stepExecuted[stepName] = true;
                }
            });
        } catch (error) {
            if (error.message.includes("Extension context invalidated")) {
                clearInterval(automationInterval);
            }
        }
    }

    // Check for Service Unavailable / 503 error
    let maintenanceInterval = setInterval(() => {
        try {
            if (!isAuthorizedTab) return;
            if (!chrome.runtime || !chrome.runtime.id) {
                clearInterval(maintenanceInterval);
                return;
            }

            let bodyText = document.body ? document.body.innerText : '';
            if (bodyText.includes('Service Unavailable') || bodyText.includes('HTTP Error 503')) {
                if (!document.getElementById('rc-maintenance-overlay')) {
                    let overlay = document.createElement('div');
                    overlay.id = 'rc-maintenance-overlay';
                    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background-color:#12121a;z-index:9999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:"Inter",sans-serif;text-align:center;padding:20px;';
                    overlay.innerHTML = `
                    <div style="background: linear-gradient(145deg, #1e1e2d, #12121a); border: 1px solid rgba(255, 90, 90, 0.3); border-radius: 20px; padding: 40px; text-align: center; width: 500px; max-width: 90vw; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                        <h1 style="color: #ff7070; font-size: 24px; font-weight: 800; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1.5px;">⚠️ Site Under Maintenance</h1>
                        <p style="color: #b0b0c0; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">The main site has a problem or is under maintenance. You will get updates on the community when the site is live.</p>
                        
                        <div style="display: flex; align-items: center; justify-content: center; gap: 20px; background: rgba(0,0,0,0.4); padding: 20px; border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1); margin: 0 auto;">
                            <div style="flex-shrink: 0; background: #fff; padding: 5px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://chat.whatsapp.com/CA4G8EOFRP91heRRxDT3cg" style="width: 100px; height: 100px; border-radius: 8px;">
                            </div>
                            <div style="text-align: left;">
                                <h3 style="color: #fff; font-size: 16px; font-weight: 700; margin: 0 0 6px 0;">Join Our Community</h3>
                                <p style="color: #8c8c9e; font-size: 13px; margin: 0; line-height: 1.4;">Scan this QR code to join<br>and stay updated.</p>
                            </div>
                        </div>
                    </div>
                `;
                    if (document.documentElement) {
                        document.documentElement.appendChild(overlay);
                    }

                    // Stop automation if running
                    chrome.storage.local.set({
                        'rc_automation_status': 'stopped',
                        'site_under_maintenance': true
                    });
                }
            } else {
                // If site is back up, reset the flag
                chrome.storage.local.set({ 'site_under_maintenance': false });
            }
        } catch (e) {
            clearInterval(maintenanceInterval);
        }
    }, 1000);

    function convertDOMToLongCard(cardFormat = "Long Card") {
        let isPvc = cardFormat.includes("PVC");
        let hideLongBoxes = cardFormat === "PVC Card" || cardFormat === "Normal with PVC";
        let hidePvcBoxes = false;
        let showExtraPvcBoxes = cardFormat === "Long With PVC";
        let existingWrapper = document.getElementById('long-card-wrapper') || document.getElementById('pvc-card-wrapper');
        if (existingWrapper) {
            existingWrapper.remove();
        }

        let originalTable = document.getElementById('tblRCard');
        if (!originalTable) return;

        // --- 1. DATA EXTRACTION ---
        let rcNumber = document.getElementById('lblRCNoPRC') ? document.getElementById('lblRCNoPRC').innerText.trim() : "N/A";
        let cardType = document.getElementById('rc_type_label_injected') ? document.getElementById('rc_type_label_injected').innerText : "";

        let mainTr = originalTable.querySelector('tbody > tr > td > table > tbody > tr');
        let backTd = mainTr ? mainTr.children[0] : null; // Family section
        let frontTd = mainTr ? mainTr.children[2] : null; // Front details

        // Extract Front Details using text analysis
        let frontText = frontTd ? frontTd.innerText.split('\n').map(s => s.trim()).filter(s => s.length > 0) : [];

        let cardTypeShort = "";
        let tblRCardText = document.getElementById("tblRCard") ? document.getElementById("tblRCard").innerText.toUpperCase() : "";

        if (tblRCardText.includes('NPHH') || tblRCardText.includes('NON-PRIORITY') || tblRCardText.includes('NON PRIORITY') || tblRCardText.includes('APL')) {
            cardTypeShort = 'NPHH';
        } else if (tblRCardText.includes('ANTYODAYA') || tblRCardText.includes('AAY')) {
            cardTypeShort = 'AAY';
        } else if (cardType) {
            cardTypeShort = cardType.split('/')[0].trim();
        } else {
            let fullText = frontText.join(' ').toUpperCase();
            if (fullText.includes('NPHH') || fullText.includes('NON-PRIORITY') || fullText.includes('APL')) cardTypeShort = 'NPHH';
            else if (fullText.includes('ANTYODAYA') || fullText.includes('AAY')) cardTypeShort = 'AAY';
            else cardTypeShort = 'PHH';
        }

        let displayCardType = cardTypeShort;
        if (cardTypeShort.includes('NPHH')) displayCardType = 'APL';
        else if (cardTypeShort.includes('PHH')) displayCardType = 'BPL';
        else if (cardTypeShort.includes('AAY')) displayCardType = 'AAY';
        let headNameEn = "", headNameKn = "", headAgeKn = "", addressEn = "", addressKn = "", fpsKn = "", fpsEn = "";

        let authAadhar = "XXXXXXXX0000";
        let addressMarkerIndex = -1;

        let headPhotoSrc = "";
        let imgHeadEl = document.getElementById('imgHead');
        if (imgHeadEl && imgHeadEl.src) {
            headPhotoSrc = imgHeadEl.src;
        } else if (frontTd) {
            let imgs = frontTd.querySelectorAll('img');
            if (imgs.length > 0 && !imgs[0].src.includes('anna_bhagya') && !imgs[0].src.includes('gok_logo')) {
                headPhotoSrc = imgs[0].src;
            }
        }
        let isNoPhoto = !headPhotoSrc || headPhotoSrc.toLowerCase().includes('nophoto') || headPhotoSrc.toLowerCase().includes('no-photo') || headPhotoSrc.toLowerCase().includes('blank');

        for (let i = 0; i < frontText.length; i++) {
            let txt = frontText[i];
            if (txt.includes('Ration Card No')) {
                let possibleNum = frontText[i + 1];
                if (possibleNum && possibleNum.match(/^\d+$/)) rcNumber = possibleNum;
            }
            if (txt.includes('Aadhar No') || txt.includes('Aadhaar No') || txt.includes('ಆಧಾರ್')) {
                let possibleAadhar = frontText[i + 1];
                if (possibleAadhar && possibleAadhar.includes('X')) authAadhar = possibleAadhar;
                else if (txt.includes('XXXX')) {
                    let parts = txt.split(':');
                    if (parts.length > 1 && parts[1].trim().length > 3) authAadhar = parts[1].trim();
                }
            }
            if (txt.includes('S/O') || txt.includes('D/O') || txt.includes('W/O') || txt.includes('C/O') || txt.includes('R/O') || txt.includes('H/O') || txt.includes('M/O') || txt.includes('F/O')) {
                if (addressMarkerIndex === -1) {
                    if (txt.match(/[\u0C80-\u0CFF]/)) {
                        addressMarkerIndex = i + 1;
                        addressEn = frontText[i + 1] || "";
                    } else {
                        addressMarkerIndex = i;
                        if (txt.match(/[a-zA-Z]/) && txt.length > 10) {
                            addressEn = txt;
                        } else if (frontText[i + 1]) {
                            addressEn = frontText[i + 1];
                        }
                    }
                }
            }
            if (txt.includes('Fair Price Shop No. & Name') || txt.includes('Fair Price Shop')) {
                fpsKn = frontText[i + 1] || "";
                fpsEn = frontText[i + 2] || "";
                if (fpsKn.includes('Office') || fpsKn.includes('ದೂರವಾಣಿ')) fpsKn = "";
                if (fpsEn.includes('Office') || fpsEn.includes('ದೂರವಾಣಿ')) fpsEn = "";
            }
        }

        // Override with strict DOM extraction if available
        let fpsKnEl = document.getElementById('lblFPDNameKan');
        let fpsEnEl = document.getElementById('lblFPDNameEng');
        if (fpsKnEl && fpsKnEl.innerText.trim()) {
            fpsKn = fpsKnEl.innerText.replace(/\n/g, ' ').trim();
        }
        if (fpsEnEl && fpsEnEl.innerText.trim()) {
            fpsEn = fpsEnEl.innerText.replace(/\n/g, ' ').trim();
        }

        if (addressMarkerIndex > 0) {
            let validLines = [];

            for (let i = addressMarkerIndex - 1; i >= Math.max(0, addressMarkerIndex - 5); i--) {
                let txt = frontText[i].trim();
                if (txt.length < 3) continue;
                if (txt.includes('Ration Card') || txt.includes('ಪಡಿತರ') || txt.includes('Aadhar') || txt.includes('ಆಧಾರ್') || txt.includes('XXXX') || txt.match(/^\d+$/)) continue;
                if (txt.includes('GOVERNMENT') || txt.includes('ಸರ್ಕಾರ') || txt.includes('Department') || txt.includes('Food') || txt.includes('PHH') || txt.includes('BPL') || txt.includes('ಆದ್ಯತಾ') || txt.includes('KARNATAKA')) continue;

                validLines.unshift(txt);
            }

            let knAddrArray = [];

            for (let i = 0; i < validLines.length; i++) {
                let line = validLines[i];
                if (!headNameEn && line.match(/^[a-zA-Z\s\.]+$/)) {
                    headNameEn = line;
                } else if (!headAgeKn && (line.includes('(') || line.match(/\d+$/)) && line.length < 35 && !line.includes('C/O') && !line.includes('W/O') && !line.includes('S/O') && !line.includes('D/O')) {
                    headAgeKn = line;
                } else {
                    knAddrArray.push(line);
                }
            }

            if (!headAgeKn) {
                for (let i = 0; i < knAddrArray.length; i++) {
                    let match = knAddrArray[i].match(/^([^\(]+\(\d+\))\s*(.*)/);
                    if (match) {
                        headAgeKn = match[1].trim();
                        if (match[2].trim().length > 0) {
                            knAddrArray[i] = match[2].trim();
                        } else {
                            knAddrArray.splice(i, 1);
                        }
                        break;
                    }
                }
            }

            addressKn = knAddrArray.join(" ").trim();
        }

        if (!headNameEn && !headAgeKn) {
            let possibleNames = frontText.filter(t => t.match(/^[A-Z\s\.]+$/) && t.length > 3 && !t.includes('SHOP') && !t.includes('GOVERNMENT') && !t.includes('KARNATAKA') && !t.includes('DEPARTMENT') && !t.includes('ADDRESS'));
            if (possibleNames.length > 0) {
                headNameEn = possibleNames[0];
                let nameIndex = frontText.indexOf(headNameEn);
                if (nameIndex !== -1) {
                    let prev = nameIndex > 0 ? frontText[nameIndex - 1] : null;
                    let next = nameIndex < frontText.length - 1 ? frontText[nameIndex + 1] : null;

                    let isValidKnAge = (text) => text && !text.includes('Ration') && !text.includes('ಪಡಿತರ') && !text.includes('Aadhar') && !text.includes('ಆಧಾರ್') && !text.match(/^\d+$/) && text.match(/[\u0C80-\u0CFF]/);

                    if (isValidKnAge(prev) && prev.includes('(')) {
                        headAgeKn = prev;
                    } else if (isValidKnAge(next) && next.includes('(')) {
                        headAgeKn = next;
                    } else if (isValidKnAge(prev)) {
                        headAgeKn = prev;
                    } else if (isValidKnAge(next)) {
                        headAgeKn = next;
                    } else if (prev && !prev.includes('Ration') && !prev.includes('ಪಡಿತರ') && !prev.includes('Aadhar') && !prev.includes('ಆಧಾರ್') && !prev.match(/^\d+$/)) {
                        headAgeKn = prev;
                    } else if (next && !next.includes('Ration') && !next.includes('ಪಡಿತರ') && !next.includes('Aadhar') && !next.includes('ಆಧಾರ್') && !next.match(/^\d+$/)) {
                        headAgeKn = next;
                    }
                }
            } else {
                let possibleKnNames = frontText.filter(t => t.includes('(') && t.includes(')') && t.match(/\(\d+\)/) && t.length < 40);
                if (possibleKnNames.length > 0) headAgeKn = possibleKnNames[0];
            }
        }

        // OVERRIDE with strict portal DOM IDs to prevent any bleeding of random text (like "ಜಿಲ್ಲೆ : ಕೊಪ್ಪಳ") into the address
        let lblAddressKan = document.getElementById('lblAddressKan');
        if (lblAddressKan) {
            let lines = lblAddressKan.innerText.split('\n').map(s => s.trim()).filter(s => s.length > 0 && !s.includes('RR No') && !s.includes('ಆರ್.'));
            addressKn = lines.join(' ');
        }

        let lblAddressEng = document.getElementById('lblAddressEng');
        if (lblAddressEng) {
            let lines = lblAddressEng.innerText.split('\n').map(s => s.trim()).filter(s => s.length > 0 && !s.includes('RR No') && !s.includes('ಆರ್.'));
            addressEn = lines.join(' ');
        }

        let districtVal = "";
        let talukVal = "";
        
        let lblDistEl = document.getElementById('lblDist') || document.getElementById('lblDistrict');
        let lblTalukEl = document.getElementById('lblTaluk');

        if (lblDistEl && lblDistEl.innerText) districtVal = lblDistEl.innerText.trim();
        else {
            let distMatch = addressKn.match(/([^\s,]+)\s*ಜಿಲ್ಲೆ/);
            if(distMatch) districtVal = distMatch[1];
        }

        if (lblTalukEl && lblTalukEl.innerText) talukVal = lblTalukEl.innerText.trim();
        else {
            let tkMatch = addressKn.match(/([^\s,]+)\s*ತಾಲ್ಲೂಕು/);
            if(tkMatch) talukVal = tkMatch[1];
        }

        districtVal = districtVal.replace(/ಜಿಲ್ಲೆ\s*[:\-]?\s*/g, '').trim();
        talukVal = talukVal.replace(/ತಾಲ್ಲೂಕು\s*[:\-]?\s*/g, '').trim();

        if (!districtVal && document.body) {
            let m = document.body.innerText.match(/ಜಿಲ್ಲೆ\s*[:\-]?\s*([^\n\s]+)/);
            if(m && m[1] !== ':' && m[1] !== '-') districtVal = m[1].trim();
        }
        if (!talukVal && document.body) {
            let m = document.body.innerText.match(/ತಾಲ್ಲೂಕು\s*[:\-]?\s*([^\n\s]+)/);
            if(m && m[1] !== ':' && m[1] !== '-') talukVal = m[1].trim();
        }


        let members = [];
        if (backTd) {
            let innerTables = backTd.querySelectorAll('table table table');
            innerTables.forEach(t => {
                if (t.querySelector('table')) return; // Skip wrapper tables
                let text = t.innerText.trim();
                if (text && !text.includes('ಸಹಾಯವಾಣಿ') && !text.includes('ಮಾಹಿತಿಗಾಗಿ') && !text.includes('1967') && !text.includes('ಸೂಚನೆ') && !text.includes('ನೌಕರರು') && !text.includes('ಸಂಬಂಧ') && !text.includes('Family') && !text.includes('ಕುಟುಂಬದ')) {
                    let imgEl = t.querySelector('img');
                    let photoSrc = imgEl ? imgEl.src : '';
                    let lines = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                    if (lines.length >= 2) {
                        members.push({
                            photoSrc: photoSrc,
                            knName: lines[0],
                            relAge: lines[1] + (lines.length > 3 && lines[2].match(/\d+/) ? " (" + lines[2] + ")" : ""),
                            enName: lines[lines.length > 3 ? 3 : 2] || ''
                        });
                    }
                }
            });
        }

        let actualMembersCount = members.length;
        let isPvcTooMany = false;

        if (isPvc && actualMembersCount > 7 && !window.hasConfirmedPvcSize) {
            // Create custom modal overlay
            let modal = document.createElement('div');
            modal.id = 'rc-pvc-warning-modal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:999999; display:flex; justify-content:center; align-items:center;';
            modal.innerHTML = `
            <div style="background:#fff; padding:30px; border-radius:10px; width:450px; text-align:center; font-family:sans-serif; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                <h2 style="color:#e74c3c; margin-top:0;">⚠️ Large Family Notice</h2>
                <p style="font-size:16px; color:#333; line-height:1.5;">This Ration Card has <b>${actualMembersCount}</b> members. The photos will not fit properly on a PVC Card.</p>
                <p style="font-size:14px; color:#666; margin-bottom:25px;">Please choose how to proceed:</p>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button id="btnPvcRemove" style="padding:12px; background:#3498db; color:white; border:none; border-radius:5px; font-size:14px; cursor:pointer; font-weight:bold;">Remove Photos (Continue PVC)</button>
                    <button id="btnSwitchLong" style="padding:12px; background:#2ecc71; color:white; border:none; border-radius:5px; font-size:14px; cursor:pointer; font-weight:bold;">Switch to Long Card (Keep Photos)</button>
                    <button id="btnPvcKeep" style="padding:10px; background:#95a5a6; color:white; border:none; border-radius:5px; font-size:12px; cursor:pointer;">Keep Photos (May Overflow PVC)</button>
                </div>
            </div>
        `;
            document.body.appendChild(modal);

            document.getElementById('btnPvcRemove').onclick = () => {
                window.hasConfirmedPvcSize = 'remove';
                modal.remove();
                convertDOMToLongCard(cardFormat); // Rerun
            };

            document.getElementById('btnSwitchLong').onclick = () => {
                window.hasConfirmedPvcSize = 'long';
                modal.remove();

                let links = document.querySelectorAll('link[rel="stylesheet"]');
                links.forEach(link => {
                    if (link.href && link.href.includes('-PVC.css')) {
                        link.href = link.href.replace('-PVC.css', '-Long.css');
                    }
                });

                let typeLabel = document.getElementById('rc_type_label_injected');
                if (typeLabel && !typeLabel.innerText.includes('Long Card')) {
                    typeLabel.innerText = typeLabel.innerText + " (Switched to Long Card)";
                }

                // Update storage so points deduct correctly for Long Card instead of PVC
                chrome.storage.local.set({ 'rc_card_type': 'Long Card' }, () => {
                    convertDOMToLongCard("Long Card");
                });
            };

            document.getElementById('btnPvcKeep').onclick = () => {
                window.hasConfirmedPvcSize = 'keep';
                modal.remove();
                convertDOMToLongCard(cardFormat); // Rerun
            };

            return; // Stop execution here and wait for modal choice
        }

        if (isPvc && window.hasConfirmedPvcSize === 'remove') {
            isPvcTooMany = true;
        }

        let globalUidMap = JSON.parse(sessionStorage.getItem('rcPrintUidMap') || '{}');
        if (headNameEn && globalUidMap[headNameEn.toUpperCase()]) {
            authAadhar = "XXXXXXXX" + globalUidMap[headNameEn.toUpperCase()];
        }



        // --- 2. BUILD CUSTOM HTML TEMPLATE ---
        let wrapper = document.createElement('div');
        wrapper.id = cardFormat === "Normal with PVC" ? 'pvc-card-wrapper' : 'long-card-wrapper';

        let addressBg = '#e8f0e8';
        let addressBorder = '#5a8a5a';

        let themeHeaderBg = '#5a8a5a'; // Default BPL (Green)
        let themeBarBg = '#e8f0e8';
        let themeBorder = '#5a8a5a';

        if (cardTypeShort.includes('AAY')) {
            addressBg = '#fff5cc';
            addressBorder = '#d4b300';
            themeHeaderBg = '#fa5758';
            themeBarBg = '#fce8e8';
            themeBorder = '#fa5758';
        } else if (cardTypeShort.includes('NPHH')) {
            addressBg = '#f0f0f0';
            addressBorder = '#888';
            themeHeaderBg = '#6d87d2';
            themeBarBg = '#e8ebf5';
            themeBorder = '#6d87d2';
        } else if (cardTypeShort.includes('PHH')) {
            themeHeaderBg = '#5a8a5a';
            themeBarBg = '#e8f0e8';
            themeBorder = '#5a8a5a';
        }

        let tpPad = members.length > 15 ? "0px 1px" : (members.length > 10 ? "1px 2px" : "3px 4px");
        let tpSize = members.length > 15 ? "5.5px" : (members.length > 10 ? "7px" : "9.5px");
        let tpImgHeight = members.length > 15 ? "12px" : (members.length > 10 ? "16px" : "26px");

        let membersRows = members.map((m, i) => {
            let rel = (m.relAge || '').split(' ')[0] || '&nbsp;';
            let ageMatch = m.relAge ? m.relAge.match(/\d+/) : null;
            let age = ageMatch ? ageMatch[0] : '&nbsp;';

            let aadharStr = m.isDummy ? "&nbsp;" : "XXXXXXXX0000";
            if (m.enName && !m.isDummy && globalUidMap[m.enName.toUpperCase()]) {
                aadharStr = "XXXXXXXX" + globalUidMap[m.enName.toUpperCase()];
            }

            let photoHtml = m.photoSrc && !m.photoSrc.includes('nophoto') && !m.photoSrc.includes('no-photo') ?
                `<img src="${m.photoSrc}" style="width:22px; height:${tpImgHeight}; object-fit:contain; background:#fff; border:1px solid #ddd; display:block; margin:0 auto;">` :
                `<div style="width:22px; height:${tpImgHeight}; border:1px solid #ddd; background:#f9f9f9; margin:0 auto;"></div>`;

            let rowBg = i % 2 !== 0 ? "background-color:#f2f2f2;" : "";

            let tpSizeNum = parseFloat(tpSize);
            let maxNameLen = Math.max((m.knName || '').length, (m.enName || '').length);
            let dynamicNameSize = tpSizeNum;
            if (maxNameLen > 22) dynamicNameSize = Math.min(tpSizeNum, 5.5);
            else if (maxNameLen > 18) dynamicNameSize = Math.min(tpSizeNum, 6.5);
            else if (maxNameLen > 14) dynamicNameSize = Math.min(tpSizeNum, 7.5);
            else if (maxNameLen > 11) dynamicNameSize = Math.min(tpSizeNum, 8.5);
            let nameFontSize = dynamicNameSize + "px";

            return `
        <tr style="${rowBg}">
            <td style="padding:${tpPad}; border:none; text-align:center; vertical-align:middle; white-space:nowrap; font-size:${tpSize};">${i + 1}.</td>
            <td style="padding:${tpPad}; border:none; text-align:center; vertical-align:middle;">${photoHtml}</td>
            <td style="padding:${tpPad}; border:none; vertical-align:middle; font-size:${nameFontSize}; line-height:1.2;">
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:85px; font-weight:bold;">${m.knName}</div>
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:85px; font-size:calc(${nameFontSize} - 1px);">${m.enName}</div>
            </td>
            <td style="padding:${tpPad}; border:none; text-align:center; vertical-align:middle; font-size:${tpSize};">${rel}</td>
            <td style="padding:${tpPad}; border:none; text-align:center; vertical-align:middle; font-size:${tpSize};">${age}</td>
            <td style="padding:${tpPad}; padding-right:0.2cm; border:none; text-align:center; vertical-align:middle; font-size:${tpSize}; white-space:nowrap; letter-spacing:-0px;">${aadharStr}</td>
        </tr>
    `});

        let bpPad = members.length > 8 ? "1px 2px" : (members.length > 5 ? "3px 2px" : (members.length > 3 ? "5px 4px" : "7px 4px"));
        let bpSize = members.length > 8 ? "4.5px" : (members.length > 5 ? "6px" : (members.length > 3 ? "7px" : "8px"));

        let membersRowsNoPhoto = members.map((m, i) => {
            let rel = (m.relAge || '').split(' ')[0] || '&nbsp;';
            let ageMatch = m.relAge ? m.relAge.match(/\d+/) : null;
            let age = ageMatch ? ageMatch[0] : '&nbsp;';

            let aadharStr = m.isDummy ? "&nbsp;" : "XXXXXXXX0000";
            if (m.enName && !m.isDummy && globalUidMap[m.enName.toUpperCase()]) {
                aadharStr = "XXXXXXXX" + globalUidMap[m.enName.toUpperCase()];
            }
            let bpSizeNum = parseFloat(bpSize);
            let maxNameLen = (m.knName || '').length;
            let dynamicNameSize = bpSizeNum;
            if (maxNameLen > 22) dynamicNameSize = Math.min(bpSizeNum, 4.5);
            else if (maxNameLen > 18) dynamicNameSize = Math.min(bpSizeNum, 5.5);
            else if (maxNameLen > 14) dynamicNameSize = Math.min(bpSizeNum, 6.5);
            else if (maxNameLen > 11) dynamicNameSize = Math.min(bpSizeNum, 7.5);
            let nameFontSize = dynamicNameSize + "px";

            let rowBg = i % 2 !== 0 ? "background-color:#f2f2f2;" : "";
            return `
        <tr style="${rowBg}">
            <td style="padding:${bpPad}; border:none; text-align:center; vertical-align:middle; white-space:nowrap; font-size:${bpSize};">${i + 1}.</td>
            <td style="padding:${bpPad}; border:none; vertical-align:middle; font-size:${nameFontSize}; line-height:1.2;">
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:90px; font-weight:bold;">${m.knName}</div>
            </td>
            <td style="padding:${bpPad}; border:none; text-align:center; vertical-align:middle; font-size:${bpSize};">${rel}</td>
            <td style="padding:${bpPad}; border:none; text-align:center; vertical-align:middle; font-size:${bpSize};">${age}</td>
            <td style="padding:${bpPad}; padding-right:0.2cm; border:none; text-align:center; vertical-align:middle; font-size:${bpSize}; white-space:nowrap; letter-spacing:-0px;">${aadharStr}</td>
        </tr>
    `});

        let _today = new Date();
        let printDateStr = String(_today.getDate()).padStart(2, '0') + '/' + String(_today.getMonth() + 1).padStart(2, '0') + '/' + _today.getFullYear();

        let finalMembersRows = isPvcTooMany ? membersRowsNoPhoto : membersRows;

        // --- NEW: PVC SPECIFIC SIZING FOR BOXES 4 & 6 ---
        let pvcPad = members.length >= 8 ? "0px 1px" : (members.length >= 7 ? "0px 1px" : (members.length >= 6 ? "0px 2px" : (members.length > 3 ? "2px 4px" : "4px 4px")));
        let pvcSize = members.length >= 8 ? "4.5px" : (members.length >= 7 ? "5.5px" : (members.length >= 6 ? "6.5px" : (members.length > 3 ? "7.5px" : "8.5px")));
        let pvcImgHeight = members.length >= 8 ? "10px" : (members.length >= 7 ? "12px" : (members.length >= 6 ? "15px" : (members.length > 3 ? "18px" : "24px")));

        let pvcMembersRowsWithPhoto = members.map((m, i) => {
            let rel = (m.relAge || '').split(' ')[0] || '&nbsp;';
            let ageMatch = m.relAge ? m.relAge.match(/\d+/) : null;
            let age = ageMatch ? ageMatch[0] : '&nbsp;';

            let aadharStr = m.isDummy ? "&nbsp;" : "XXXXXXXX0000";
            if (m.enName && !m.isDummy && globalUidMap[m.enName.toUpperCase()]) {
                aadharStr = "XXXXXXXX" + globalUidMap[m.enName.toUpperCase()];
            }

            let photoHtml = m.photoSrc && !m.photoSrc.includes('nophoto') && !m.photoSrc.includes('no-photo') ?
                `<img src="${m.photoSrc}" style="width:20px; height:${pvcImgHeight}; object-fit:contain; background:#fff; border:none; display:block; margin:0 auto;">` :
                `<div style="width:20px; height:${pvcImgHeight}; border:none; background:#f9f9f9; margin:0 auto;"></div>`;

            let rowBg = i % 2 !== 0 ? "background-color:#f2f2f2;" : "";

            let pvcSizeNum = parseFloat(pvcSize);
            let maxNameLen = Math.max((m.knName || '').length, (m.enName || '').length);
            let dynamicNameSize = pvcSizeNum;
            if (maxNameLen > 22) dynamicNameSize = Math.min(pvcSizeNum, 4.5);
            else if (maxNameLen > 18) dynamicNameSize = Math.min(pvcSizeNum, 5.5);
            else if (maxNameLen > 14) dynamicNameSize = Math.min(pvcSizeNum, 6.5);
            else if (maxNameLen > 11) dynamicNameSize = Math.min(pvcSizeNum, 7.5);
            let nameFontSize = dynamicNameSize + "px";

            return `
        <tr style="${rowBg}">
            <td style="padding:${pvcPad}; border:none; text-align:center; vertical-align:middle; white-space:nowrap; font-size:${pvcSize};">${i + 1}.</td>
            <td style="padding:${pvcPad}; border:none; text-align:center; vertical-align:middle;">${photoHtml}</td>
            <td style="padding:${pvcPad}; border:none; vertical-align:middle; font-size:${nameFontSize}; line-height:1.2;">
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:85px; font-weight:bold;">${m.knName}</div>
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:85px; font-size:calc(${nameFontSize} - 1px);">${m.enName}</div>
            </td>
            <td style="padding:${pvcPad}; border:none; text-align:center; vertical-align:middle; font-size:${pvcSize};">${rel}</td>
            <td style="padding:${pvcPad}; border:none; text-align:center; vertical-align:middle; font-size:${pvcSize};">${age}</td>
            <td style="padding:${pvcPad}; padding-right:0.2cm; border:none; text-align:center; vertical-align:middle; font-size:${pvcSize}; white-space:nowrap; letter-spacing:-0px;">${aadharStr}</td>
        </tr>
    `});

        let finalPvcMembersRows = (isPvcTooMany || cardFormat === "Long Card") ? membersRowsNoPhoto : pvcMembersRowsWithPhoto;
        let finalHeaders = (isPvcTooMany || cardFormat === "Long Card") ? `
                                    <th style="width:6%; position:relative;">
                                        ${cardFormat === "Long Card" ? '' : `<div style="position:absolute; top:-2px; left:2px; font-size:7px; font-weight:bold; text-align:left; line-height:1.1; letter-spacing:0.2px; color:#111;">Print Date<br>${printDateStr}</div>`}
                                    </th>
                                    <th style="width:40%; font-size:${bpSize}; padding:${bpPad}; border-bottom:1px solid #000; text-align:left;">ಹೆಸರು</th>
                                    <th style="width:15%; font-size:${bpSize}; padding:${bpPad}; border-bottom:1px solid #000; text-align:center;">ಸಂಬಂಧ</th>
                                    <th style="width:11%; font-size:${bpSize}; padding:${bpPad}; border-bottom:1px solid #000; text-align:center;">ವಯಸ್ಸು</th>
                                    <th style="width:28%; font-size:${bpSize}; padding:${bpPad}; border-bottom:1px solid #000; text-align:center;">ಆಧಾರ್ ಸಂಖ್ಯೆ</th>
    ` : `
                                    <th style="width:6%; position:relative;">
                                        ${cardFormat === "Long Card" ? '' : `<div style="position:absolute; top:1px; left:2px; font-size:7px; font-weight:bold; text-align:left; line-height:1.1; letter-spacing:0.2px; color:#111;">Print Date<br>${printDateStr}</div>`}
                                    </th>
                                    <th style="width:12%;"></th>
                                    <th style="width:30%; font-size:6px; padding:4px; border-bottom:1px solid #000; text-align:left; white-space:nowrap;">ಹೆಸರು<br>Name</th>
                                    <th style="width:14%; font-size:6px; padding:4px; border-bottom:1px solid #000; text-align:center; white-space:nowrap;">ಸಂಬಂಧ<br>Relationship</th>
                                    <th style="width:10%; font-size:6px; padding:4px; border-bottom:1px solid #000; text-align:center; white-space:nowrap;">ವಯಸ್ಸು<br>Age</th>
                                    <th style="width:28%; font-size:6px; padding:4px; border-bottom:1px solid #000; text-align:center; white-space:nowrap;">ಆಧಾರ್ ಸಂಖ್ಯೆ<br>Aadhaar No.</th>
    `;

        let pvcHeaders = `
                                    <th style="width:6%;"></th>
                                    <th style="width:40%; font-size:${bpSize}; padding:${bpPad}; border-bottom:1px solid #000; text-align:left;">ಹೆಸರು</th>
                                    <th style="width:15%; font-size:${bpSize}; padding:${bpPad}; border-bottom:1px solid #000; text-align:center;">ಸಂಬಂಧ</th>
                                    <th style="width:11%; font-size:${bpSize}; padding:${bpPad}; border-bottom:1px solid #000; text-align:center;">ವಯಸ್ಸು</th>
                                    <th style="width:28%; font-size:${bpSize}; padding:${bpPad}; border-bottom:1px solid #000; text-align:center;">ಆಧಾರ್ ಸಂಖ್ಯೆ</th>
    `;

        let agentBackHeaders = `
                                    <th style="width:6%; position:relative;">
                                        <div style="position:absolute; top:-2px; left:2px; font-size:6.5px; font-weight:bold; text-align:left; line-height:1.1; color:#111; white-space:nowrap;">Print Date : ${printDateStr}</div>
                                    </th>
                                    <th style="width:40%; font-size:${bpSize}; padding:${bpPad}; border-bottom:1px solid #000; text-align:left; vertical-align:bottom;">ಹೆಸರು</th>
                                    <th style="width:15%; font-size:${bpSize}; padding:${bpPad}; border-bottom:1px solid #000; text-align:center; vertical-align:bottom;">ಸಂಬಂಧ</th>
                                    <th style="width:11%; font-size:${bpSize}; padding:${bpPad}; border-bottom:1px solid #000; text-align:center; vertical-align:bottom;">ವಯಸ್ಸು</th>
                                    <th style="width:28%; font-size:${bpSize}; padding:${bpPad}; border-bottom:1px solid #000; text-align:center; vertical-align:bottom;">ಆಧಾರ್ ಸಂಖ್ಯೆ</th>
    `;

        let lblMemberCount = document.getElementById('lblMemberCount');
        let displayMemberCount = lblMemberCount ? lblMemberCount.innerText.trim() : members.length;

        let cardTypeKnEl = document.getElementById('lblCardTypeKan');
        let cardTypeEnEl = document.getElementById('lblCardType1');

        let cardTypeKnText = cardTypeKnEl ? cardTypeKnEl.innerText.trim() : "ಆದ್ಯತಾ ಕುಟುಂಬ ಸೀಮೆಎಣ್ಣೆಗೆ ಅನರ್ಹ";
        let cardTypeEnText = cardTypeEnEl ? cardTypeEnEl.innerText.trim() : "Priority Household Not Eligible for Kerosene";

        let verticalText = `${cardTypeEnText}<br>${cardTypeKnText}<br>ಸದಸ್ಯರ ಸಂಖ್ಯೆ / Family Members : ${displayMemberCount}`;

        let headerHtml = `
        <div class="lc-header-text" style="display:flex; justify-content:space-between; align-items:center; padding: 2px 5px;">
            <img src="${chrome.runtime.getURL('anna_bhagya.png')}" style="height:30px;">
            <div style="text-align:center; flex-grow:1; white-space:nowrap; overflow:hidden; padding:0 2px;">
                <b style="font-size:8px;letter-spacing:0.5px;">ಕರ್ನಾಟಕ ಸರ್ಕಾರ</b><br>
                <b style="font-size:9px; letter-spacing:0.5px;">GOVERNMENT OF KARNATAKA</b><br>
                <span style="font-weight:900; font-size:7.5px; letter-spacing:0.1px;">ಆಹಾರ, ನಾಗರಿಕ ಸರಬರಾಜು ಮತ್ತು ಗ್ರಾಹಕರ ವ್ಯವಹಾರಗಳ ಇಲಾಖೆ</span><br>
                <b style="font-weight:900; font-size:7.5px; letter-spacing:-0.25px;">Food, Civil Supplies and Consumer Affairs Department</b>
            </div>
            <img src="${chrome.runtime.getURL('gok_logo.png')}" style="height:30px;">
        </div>
    `;

        let headerHtmlSmall = `
        <div class="lc-header-text" style="display:flex; justify-content:space-between; align-items:center; padding: 1px 1px;">
            <img src="${chrome.runtime.getURL('anna_bhagya.png')}" style="height:25px;">
            <div style="text-align:center; flex-grow:1; white-space:nowrap; overflow:hidden; padding:0 2px;">
                <b style="font-size:7.5px;letter-spacing:0.5px;">ಕರ್ನಾಟಕ ಸರ್ಕಾರ</b><br>
                <b style="font-size:8.5px; letter-spacing:0.5px;">GOVERNMENT OF KARNATAKA</b><br>
                <span style="font-weight:900; font-size:7.5px; letter-spacing:0.1px;">ಆಹಾರ, ನಾಗರಿಕ ಸರಬರಾಜು ಮತ್ತು ಗ್ರಾಹಕರ ವ್ಯವಹಾರಗಳ ಇಲಾಖೆ</span><br>
                <b style="font-weight:900; font-size:7.5px; letter-spacing:-0.25px;">Food, Civil Supplies and Consumer Affairs Department</b>
            </div>
            <img src="${chrome.runtime.getURL('gok_logo.png')}" style="height:25px;">
        </div>
    `;

        let cleanHeadNameKn = headAgeKn ? headAgeKn.replace(/\s*\(?\d+\)?\s*/g, '').trim() : "";

        let qrData = rcNumber !== "N/A" ? rcNumber : '1234567890';
        let qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

        let today = new Date();
        let domDate = "";

        // 1. Try to find date in the extracted text from the front card
        if (frontText) {
            for (let i = 0; i < frontText.length; i++) {
                let txt = frontText[i];
                if (txt.toLowerCase().includes('date') || txt.includes('ದಿನಾಂಕ') || txt.toLowerCase().includes('issue')) {
                    let match = txt.match(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/);
                    if (match) {
                        domDate = match[0];
                        break;
                    } else if (frontText[i + 1]) {
                        let nextMatch = frontText[i + 1].match(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/);
                        if (nextMatch) {
                            domDate = nextMatch[0];
                            break;
                        }
                    }
                }
            }
        }

        // 2. Try global regex on body if still not found
        if (!domDate && document.body) {
            let bodyText = document.body.innerText;
            let bodyMatch = bodyText.match(/(?:Date|ದಿನಾಂಕ|Issue)[^\d]*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
            if (bodyMatch) {
                domDate = bodyMatch[1];
            } else {
                // Just find ANY date on the page if all else fails
                let anyDateMatch = bodyText.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/);
                if (anyDateMatch) domDate = anyDateMatch[1];
            }
        }

        let issueDateStr = domDate ? domDate : "";



        wrapper.innerHTML = `
        <style>
            ${cardFormat === "Normal with PVC" ? `
            @media print {
                #tblRCard { zoom: 0.85 !important; margin: 0 auto !important; }
                body { padding: 0 !important; margin: 0 !important; }
            }
            ` : ''}
            .lc-card { ${(cardFormat === "PVC Card" || cardFormat === "Normal with PVC") ? '' : 'border: 1px solid #000 !important;'} }
            @media print {
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
        </style>
        <div class="lc-page">
            <!-- LEFT COLUMN -->
            <div class="lc-col lc-left">
                
                ${hideLongBoxes ? '' : `
                <!-- TOP FRONT CARD -->
                <div id="lc-box-1" class="lc-card" style="height: auto; min-height: 0; flex-grow: 1; flex-shrink: 0; display: flex; flex-direction: column;">
                    <div class="lc-header">
                        ${headerHtml}
                    </div>
                    <div class="lc-rc-bar" style="padding:4px; font-weight:bold; color:#222; text-align:center;">
                        <div style="font-size:10.5px; margin-bottom:2px;">ಪಡಿತರ ಚೀಟಿಯ ಸಂಖ್ಯೆ / Ration Card No. :</div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:10px; flex:1; text-align:left; word-wrap:break-word; padding-right:5px; line-height:1.2;">ತಾಲ್ಲೂಕು:<br>${talukVal}</span>
                            <span style="font-size:15px; flex:1; text-align:center; letter-spacing:1px; white-space:nowrap;">${rcNumber}</span>
                            <span style="font-size:10px; flex:1; text-align:right; word-wrap:break-word; padding-left:5px; line-height:1.2;">ಜಿಲ್ಲೆ:<br>${districtVal}</span>
                        </div>
                    </div>

                    <div class="lc-front-content" style="position:relative; display:flex; flex-direction:column; padding: 15px 10px; gap: 8px; flex-grow: 1;">
                        
                        <!-- Top Row: Photo and Name -->
                        <div style="display:flex;">
                            <!-- Left Column -->
                            <div style="width:90px; text-align:center; z-index:2; flex-shrink:0;">
                                ${isNoPhoto ? `
                                    <div style="width:70px; height:90px; border:1px solid #ccc; background:#eee; margin:0 auto;"></div>
                                    <div style="font-size:8px; font-weight:bold; color:#666; margin-top:4px;">NO PHOTO</div>
                                ` : `
                                    <div style="width:70px; height:90px; border:1px solid #ccc; background:#eee; margin:0 auto; overflow:hidden;">
                                        <img src="${headPhotoSrc}" style="width:100%; height:100%; object-fit:cover; display:block; border:none;" onerror="this.style.opacity='0'; this.parentNode.nextElementSibling.style.display='block';">
                                    </div>
                                    <div style="font-size:8px; font-weight:bold; color:#666; margin-top:4px; display:none;">NO PHOTO</div>
                                `}
                            </div>
                            
                            <!-- Right Column for Name -->
                            <div style="padding-left:15px; padding-top:25px; line-height:1.8; z-index:2; text-align:left; flex-grow:1; padding-right:40px;">
                                <b style="font-size:9px;">${cleanHeadNameKn || 'Name Kannada'}</b><br>
                                <b style="font-size:9px;">${headNameEn || 'Name English'}</b><br>
                                <b style="font-size:9px;">ವಯಸ್ಸು Age: ${headAgeKn.match(/\d+/) ? headAgeKn.match(/\d+/)[0] : ""}</b>
                            </div>
                        </div>

                        <!-- Middle Row: Address + QR -->
                        <div style="display:flex; justify-content: space-between; align-items: flex-start; z-index:2; padding-right: 45px; margin-top: 5px;">
                            <!-- Address Block -->
                            <div class="lc-address-block" style="text-align:left; flex-grow:1; word-wrap: break-word; padding-right:15px;">
                                <b style="font-size:9px;">To : ${headNameEn ? headNameEn : ''} ${headAgeKn ? '/ ' + headAgeKn : ''}</b><br>
                                ${addressKn ? `<div style="font-size:8px; margin-top:4px; font-weight:bold;">${addressKn}</div>` : ''}
                                <div style="font-size:8px; margin-top:4px; font-weight:bold;">${addressEn}</div>
                            </div>
                            
                            <!-- QR Code -->
                            <div style="width:75px; flex-shrink:0; display:flex; flex-direction:column; align-items:center;">
                                <img src="${qrUrl}" style="width:75px; height:75px; border:1px solid #ddd; padding:2px; box-sizing:border-box;">
                                <div style="margin-top:4px; font-size:7px; font-weight:bold; color:#111; text-align:center; line-height:1.2; width:100%;">Issue Date<br>${issueDateStr}</div>
                            </div>
                        </div>
                        
                        <!-- Bottom Row: Fair Price Shop Block -->
                        <div class="lc-info-block" style="text-align:left; z-index:2; margin-top: auto; padding-right: 45px; word-wrap: break-word;">
                            <b style="font-size:7.5px; white-space:nowrap;">ನ್ಯಾಯಬೆಲೆ ಅಂಗಡಿಯ ಸಂಖ್ಯೆ ಮತ್ತು ಹೆಸರು</b><br>
                            <span style="font-size:7.5px; white-space:nowrap;">Fair Price Shop No.& Name</span><br>
                            <div style="font-size:7.5px; margin-top:3px; font-weight:bold; line-height:1.2;">${fpsKn || 'Shop No in Kannada'}</div>
                            <div style="font-size:7.5px; font-weight:bold; line-height:1.2;">${fpsEn || 'Shop No in English'}</div>
                        </div>
                        
                        <!-- Vertical Text Banner -->
                        <div class="vertical-banner" style="position:absolute; right: 0.3cm; top: 15px; height: calc(100% - 30px);">
                            <span style="font-size:11px;">${verticalText}</span>
                        </div>
                    </div>
                </div>

                <!-- INSTRUCTIONS -->
                <div class="lc-instructions" style="text-align:left; flex-shrink:0; padding: 5px 15px; display: block !important;">
                    <b style="font-size:5.5px; color:#000;">Instructions :</b>
                    <ul style="margin: 3px 0 0 20px; padding: 0; font-size: 9px; line-height: 1.2; color:#000; text-align:justify;">
                        <li>Toll free helpline number:1967. Website; www.ahara.kar.nic.in<br>ಟೋಲ್ ಫ್ರೀ ಸಹಾಯವಾಣಿ ಸಂಖ್ಯೆ : 1967 ವೆಬ್‌ಸೈಟ್ : www.ahara.kar.nic.in</li>
                        <li>timing of ration shop: 8 a.m to 12 p.m and 4 p.m from 1st to 15 th of every month (except tuesdays and public holidays ಪಡಿತರ ಅಂಗಡಿಗಳ ಸಮಯ : (ಮಂಗಳವಾರ ಮತ್ತು ರಜಾದಿನಗಳನ್ನು ಹೊರತುಪಡಿಸಿ) ಬೆಳಗ್ಗೆ 8.00 ರಿಂದ 12.00 ಗಂಟೆವರೆಗೆ ಮತ್ತು ಸಂಜೆ 4.00 ರಿಂದ 8.00 ಗಂಟೆವರೆಗೆ ಪ್ರತಿ ತಿಂಗಳ 1ರಿಂದ 15 ರ ವರೆಗೆ ತೆರೆದಿರುತ್ತದೆ</li>
                    </ul>
                    <div style="border: 1.5px solid #d81b60; border-radius: 10px; padding: 6px 10px; margin-top: 8px; background: #fff;">
                        <div style="display:flex; text-align:left;">
                            <div style="margin-right:8px; color:#000; font-size:5px; line-height:1.2;">●</div>
                            <div style="color:#d81b60; font-size:4.5px; line-height:1.3;">
                                <span>Dial from aadhar registered Mobile:</span><br>
                                <div style="padding-left:10px;">
                                    &#x25B7; *161# for selected services of the department<br>
                                    &#x25B7; 161 for copen code
                                </div>
                                <span style="display:inline-block; margin-top:2px;">ಆಧಾರ್ ಕಾರ್ಡ್‌ ನಲ್ಲಿ ನೋಂದಾಯಿಸಿದ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯಿಂದ ಕರೆ ಮಾಡಿ :</span><br>
                                <div style="padding-left:10px;">
                                    &#x25B7; *161# ಇಲಾಖೆಯಿಂದ ಆಯ್ದ ಸೇವೆಗಳಿಗಾಗಿ<br>
                                    &#x25B7; 161 ಕೂಪನ್ ಕೋಡ್‌ಗಳಿಗಾಗಿ
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CUT LINE -->
                <div class="lc-cut-line" style="width: 100%; border-top: 1px dashed #666; margin: 2.5mm 0; position: relative;">
                    <span style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #444; background: white; padding: 0 4px;">&#x2702;</span>
                </div>
                `}
                ${hidePvcBoxes ? '' : `
                <!-- MIDDLE FRONT CARD (AGENT COPY PVC) -->
                <div id="lc-box-3" class="lc-card" style="height: 55mm; overflow: hidden; max-height: 55mm; flex-shrink: 0; display: flex; flex-direction:column;">
                    <div class="lc-header" style="padding:6px; flex-shrink:0;">
                        ${headerHtmlSmall}
                    </div>
                    <div class="lc-rc-bar" style="padding:2px; flex-shrink:0; text-align:center; line-height:1.1;">
                        <b style="font-size:9px; white-space:nowrap; display:block;">ಪಡಿತರ ಚೀಟಿಯ ಸಂಖ್ಯೆ / Ration Card No. : ${rcNumber}</b>
                        ${authAadhar ? `<b style="font-size:8px; white-space:nowrap; display:block; margin-top:0.1cm;">ಆಧಾರ್ ಸಂಖ್ಯೆ / Aadhar No : ${authAadhar}</b>` : ''}
                    </div>
                    <div class="lc-front-content" style="flex-grow:1; padding:2px 2px 2px 2px; display:flex; flex-direction:column; justify-content:flex-start; gap: 1px; box-sizing:border-box; position:relative;">
                        <div style="display:flex;">
                            <div style="width:${showExtraPvcBoxes ? '55' : '50'}px; text-align:center;">
                                ${isNoPhoto ? `
                                    <div style="width:45px; height:55px; border:1px solid #ccc; background:#eee; margin:0 auto;"></div>
                                    <div style="font-size:5px; font-weight:bold; color:#666; margin-top:2px;">NO PHOTO</div>
                                ` : `
                                    <div style="width:45px; height:55px; border:1px solid #ccc; background:#eee; margin:0 auto; overflow:hidden;">
                                        <img src="${headPhotoSrc}" style="width:100%; height:100%; object-fit:cover; display:block; border:none;" onerror="this.style.opacity='0'; this.parentNode.nextElementSibling.style.display='block';">
                                    </div>
                                    <div style="font-size:5px; font-weight:bold; color:#666; margin-top:2px; display:none;">NO PHOTO</div>
                                `}
                            </div>
                            <div style="padding-left:10px; padding-top:5px; line-height:1.2; text-align:left; flex-grow:1; padding-right:85px;">
                                <b style="font-size:7.5px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${cleanHeadNameKn || 'Name Kannada'}</b>
                                <b style="font-size:7.5px; display:block; margin-top:0.1cm; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${headNameEn || 'Name English'}</b>
                                <span style="font-size:7px; display:block; margin-top:0.1cm;">ವಯಸ್ಸು Age: ${headAgeKn.match(/\d+/) ? headAgeKn.match(/\d+/)[0] : ""}</span>
                            </div>
                        </div>
                        <div style="text-align:left; font-size:${cardTypeEnText.length > 35 ? '5.2px' : '6.5px'}; font-weight:bold; line-height:1.3; margin-top:0.1cm; flex-grow:1; padding-right:85px; word-wrap:break-word;">
                            ${showExtraPvcBoxes ? '' : `
                            ${cardTypeKnText}<br>
                            ${cardTypeEnText}<br>
                            <span style="background-color:${addressBg}; border:1px solid ${addressBorder}; padding:1px 3px; border-radius:2px; display:inline-block; margin: 1px 0;">ಸದಸ್ಯರ ಸಂಖ್ಯೆ / Family Members : ${displayMemberCount}</span><br>
                            <span style="font-size:5.5px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">${fpsKn || 'Shop No in Kannada'}</span>
                            <span style="font-size:5.5px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">${fpsEn || 'Shop No in English'}</span>
                            `}
                        </div>
                        <div style="position:absolute; right:10px; top:15px; width:75px; display:flex; flex-direction:column; align-items:center;">
                            <img src="${qrUrl}" style="width:75px; height:75px; border:1px solid #ddd; padding:2px; box-sizing:border-box;">
                            ${isPvc ? `<div style="margin-top:4px; font-size:5.5px; font-weight:bold; color:#111; text-align:center; line-height:1.2; width:100%;">Issue Date<br>${issueDateStr}</div>` : ''}
                        </div>
                        ${(isPvc && !showExtraPvcBoxes) ? `<div style="position:absolute; bottom:5px; right:10px; font-weight:bold; font-size:6px; color:red; border:1px solid red; padding:1px 3px; border-radius:2px; z-index:2; text-align:center;">${displayCardType}</div>` : ''}
                        ${showExtraPvcBoxes ? `<div style="position:absolute; bottom:5px; left:50%; transform:translateX(-50%); font-weight:bold; font-size:6.5px; background-color:${addressBg}; border:1px solid ${addressBorder}; padding:2px 4px; border-radius:2px; z-index:2; white-space:nowrap;">ಸದಸ್ಯರ ಸಂಖ್ಯೆ / Family Members : ${displayMemberCount}</div>` : ''}
                    </div>
                </div>
                `}
                ${showExtraPvcBoxes ? `
                <!-- CUT LINE -->
                <div class="lc-cut-line" style="width: 100%; border-top: 1px dashed #666; margin: 2.5mm 0; position: relative;">
                    <span style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #444; background: white; padding: 0 4px;">&#x2702;</span>
                </div>
                <!-- BOTTOM FRONT CARD (BOTTOM PVC) -->
                <div id="lc-box-5" class="lc-card" style="height: 55mm; overflow: hidden; max-height: 55mm; flex-shrink: 0; display: flex; flex-direction:column;">
                    <div class="lc-header" style="padding:6px; flex-shrink:0;">
                        ${headerHtmlSmall}
                    </div>
                    <div class="lc-rc-bar" style="padding:2px; flex-shrink:0; text-align:center; line-height:1.1;">
                        <b style="font-size:9px; white-space:nowrap; display:block;">ಪಡಿತರ ಚೀಟಿಯ ಸಂಖ್ಯೆ / Ration Card No. : ${rcNumber}</b>
                        ${authAadhar ? `<b style="font-size:8px; white-space:nowrap; display:block; margin-top:0.1cm;">ಆಧಾರ್ ಸಂಖ್ಯೆ / Aadhar No : ${authAadhar}</b>` : ''}
                    </div>
                    <div class="lc-front-content" style="flex-grow:1; padding:2px 2px 2px 2px; display:flex; flex-direction:column; justify-content:flex-start; gap: 1px; box-sizing:border-box; position:relative;">
                        <div style="display:flex;">
                            <div style="width:50px; text-align:center;">
                                ${isNoPhoto ? `
                                    <div style="width:45px; height:55px; border:1px solid #ccc; background:#eee; margin:0 auto;"></div>
                                    <div style="font-size:5px; font-weight:bold; color:#666; margin-top:2px;">NO PHOTO</div>
                                ` : `
                                    <div style="width:45px; height:55px; border:1px solid #ccc; background:#eee; margin:0 auto; overflow:hidden;">
                                        <img src="${headPhotoSrc}" style="width:100%; height:100%; object-fit:cover; display:block; border:none;" onerror="this.style.opacity='0'; this.parentNode.nextElementSibling.style.display='block';">
                                    </div>
                                    <div style="font-size:5px; font-weight:bold; color:#666; margin-top:2px; display:none;">NO PHOTO</div>
                                `}
                            </div>
                            <div style="padding-left:10px; padding-top:5px; line-height:1.2; text-align:left; flex-grow:1; padding-right:85px;">
                                <b style="font-size:7.5px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${cleanHeadNameKn || 'Name Kannada'}</b>
                                <b style="font-size:7.5px; display:block; margin-top:0.1cm; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${headNameEn || 'Name English'}</b>
                                <span style="font-size:7px; display:block; margin-top:0.1cm;">ವಯಸ್ಸು Age: ${headAgeKn.match(/\d+/) ? headAgeKn.match(/\d+/)[0] : ""}</span>
                            </div>
                        </div>
                        <div style="text-align:left; font-size:${cardTypeEnText.length > 35 ? '5.2px' : '6.5px'}; font-weight:bold; line-height:1.3; margin-top:0.1cm; flex-grow:1; padding-right:85px; word-wrap:break-word;">
                            ${cardTypeKnText}<br>
                            ${cardTypeEnText}<br>
                            <span style="background-color:${addressBg}; border:1px solid ${addressBorder}; padding:1px 3px; border-radius:2px; display:inline-block; margin: 1px 0;">ಸದಸ್ಯರ ಸಂಖ್ಯೆ / Family Members : ${displayMemberCount}</span><br>
                            <span style="font-size:5.5px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">${fpsKn || 'Shop No in Kannada'}</span>
                            <span style="font-size:5.5px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">${fpsEn || 'Shop No in English'}</span>
                        </div>
                        <div style="position:absolute; right:10px; top:15px; width:75px; display:flex; flex-direction:column; align-items:center;">
                            <img src="${qrUrl}" style="width:75px; height:75px; border:1px solid #ddd; padding:2px; box-sizing:border-box;">
                            ${isPvc ? `<div style="margin-top:4px; font-size:5.5px; font-weight:bold; color:#111; text-align:center; line-height:1.2; width:100%;">Issue Date<br>${issueDateStr}</div>` : ''}
                        </div>
                        ${isPvc ? `<div style="position:absolute; bottom:5px; right:10px; font-weight:bold; font-size:6px; color:red; border:1px solid red; padding:1px 3px; border-radius:2px; z-index:2; text-align:center;">${displayCardType}</div>` : ''}
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- RIGHT COLUMN -->
            <div class="lc-col lc-right">
                
                ${hideLongBoxes ? '' : `
                <!-- TOP BACK CARD -->
                <div id="lc-box-2" class="lc-card" style="height: auto; min-height: 0; flex-grow: 1; flex-shrink: 0; display: flex; flex-direction: column;">
                    <div class="lc-header" style="padding:6px;">
                        ${headerHtmlSmall}
                    </div>
                    <div style="padding:2px 10px 10px 10px; flex-grow: 1; display:flex; flex-direction:column; justify-content:flex-start; box-sizing:border-box; position:relative;">
                        <div style="display:flex; align-items:flex-start;">
                            <table style="width:100%; border-collapse:collapse; margin-top:0px; table-layout:fixed; word-wrap:break-word;">
                                <thead>
                                    <tr>
                                        <th style="width:6%; position:relative;">
                                            ${cardFormat === "Long Card" ? `<div style="position:absolute; top:1px; left:2px; font-size:7px; font-weight:bold; text-align:left; line-height:1.1; letter-spacing:0.2px; color:#111;">Print Date<br>${printDateStr}</div>` : ''}
                                        </th>
                                        <th style="width:12%;"></th>
                                        <th style="width:30%; font-size:6px; padding:4px; border-bottom:1px solid #000; text-align:left; white-space:nowrap;">ಹೆಸರು<br>Name</th>
                                        <th style="width:14%; font-size:6px; padding:4px; border-bottom:1px solid #000; text-align:center; white-space:nowrap;">ಸಂಬಂಧ<br>Relationship</th>
                                        <th style="width:10%; font-size:6px; padding:4px; border-bottom:1px solid #000; text-align:center; white-space:nowrap;">ವಯಸ್ಸು<br>Age</th>
                                        <th style="width:28%; font-size:6px; padding:4px; border-bottom:1px solid #000; text-align:center; white-space:nowrap;">ಆಧಾರ್ ಸಂಖ್ಯೆ<br>Aadhaar No.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${membersRows.join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div style="flex-shrink:0; margin-top:auto; margin-bottom:5px; padding-right:15px; font-size:4px; text-align:justify; color:#333; font-weight:bold; line-height:1.4;">
                            ಸೂಚನೆ: "ಖಾಯಂ ಸರ್ಕಾರಿ ನೌಕರರು ಅಥವಾ ಯಾವುದೇ ತೆರಿಗೆ ಪಾವತಿಸುವ, ಮೋಟು ಚಕ್ರವುಳ್ಳ ವಾಹನ ಹೊಂದಿರುವ ಕುಟುಂಬಗಳು ಈ ಕಾರ್ಡ್ ಪಡೆಯಲು ಅರ್ಹರಲ್ಲ. 1,000 ಚ.ಅಡಿಗಿಂತ ಹೆಚ್ಚಿನ ಮನೆಯನ್ನು ಹೊಂದಿರುವ, ಒಂದು ಟ್ರ್ಯಾಕ್ಟರ್ / ಮ್ಯಾಕ್ಸಿಕ್ಯಾಬ್ / ಟ್ಯಾಕ್ಸಿಯನ್ನು ಬಿಟ್ಟು 4 ಚಕ್ರದ ವಾಹನಗಳನ್ನು ಹೊಂದಿರುವ, ಮಾಸಿಕ 150 ಯೂನಿಟ್‌ಗಿಂತ ಹೆಚ್ಚಿನ ವಿದ್ಯುತ್ ಬಳಕೆ." ನಿಮ್ಮ ಕುಟುಂಬಕ್ಕೆ ಅಥವಾ ಯಾವುದೇ ಸದಸ್ಯರಿಗೆ ಈ ಅಂಶಗಳು ಅನ್ವಯಿಸುವುದಿಲ್ಲ ಎಂಬ ನಿಮ್ಮ ಸ್ವಯಂ-ಘೋಷಣೆ ಪತ್ರದ ಸಾಲಿಕೆಯಲ್ಲಿ ಬಿ.ಪಿ.ಎಲ್. ರದ್ದುಪಡಿಸುವುದರ ಜೊತೆಗೆ ಕ್ರಿಮಿನಲ್ ಮೊಕದ್ದಮೆಗೆ ಅರ್ಹರಾಗುತ್ತೀರಿ.
                        </div>
                        <div style="position:absolute; bottom:5px; right:10px; font-weight:bold; font-size:6px; color:red; border:1px solid red; padding:1px 3px; border-radius:2px;">${displayCardType}</div>
                    </div>
                </div>
                
                <!-- CUT LINE -->
                <div class="lc-cut-line" style="width: 100%; border-top: 1px dashed #666; margin: 2.5mm 0; position: relative;">
                    <span style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #444; background: white; padding: 0 4px;">&#x2702;</span>
                </div>
                `}
                ${hidePvcBoxes ? '' : `
                <!-- MIDDLE BACK CARD -->
                <div id="lc-box-4" class="lc-card" style="height: 55mm; overflow: hidden; max-height: 55mm; flex-shrink: 0;">
                    <div style="height:100%; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box;">
                        <div style="flex-grow:1; display:flex; align-items:flex-start; overflow:hidden; padding:1px 10px 1px 10px;">
                            <table style="width:100%; border-collapse:collapse; margin-top:0px; table-layout:fixed; word-wrap:break-word;">
                                <thead>
                                    <tr>
                                        ${showExtraPvcBoxes ? agentBackHeaders : finalHeaders}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${showExtraPvcBoxes ? membersRowsNoPhoto.join('') : finalPvcMembersRows.join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="lc-address-block" style="flex-shrink:0; background:${addressBg}; border-top:1px solid ${addressBorder}; padding:3px 10px; font-size:5.5px; font-weight:bold; text-align:left; margin-top:0; display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="flex-grow:1;">
                                <div style="margin-bottom:1px;">ವಿಳಾಸ:</div>
                                <div style="margin-bottom:2px;">${addressKn}</div>
                                <div style="margin-bottom:1px;">Address:</div>
                                <div>${addressEn}</div>
                            </div>
                            <div style="flex-shrink:0; text-align:right; padding-left:6px; white-space:nowrap; align-self:flex-start;">
                                <span>ಜಿಲ್ಲೆ: ${districtVal}</span>&nbsp;&nbsp;<span>ತಾಲ್ಲೂಕು: ${talukVal}</span>
                            </div>
                        </div>
                    </div>
                </div>
                `}
                ${showExtraPvcBoxes ? `
                <!-- CUT LINE -->
                <div class="lc-cut-line" style="width: 100%; border-top: 1px dashed #666; margin: 2.5mm 0; position: relative;">
                    <span style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #444; background: white; padding: 0 4px;">&#x2702;</span>
                </div>
                <!-- BOTTOM BACK CARD -->
                <div id="lc-box-6" class="lc-card" style="height: 55mm; overflow: hidden; max-height: 55mm; flex-shrink: 0;">
                    <div style="height:100%; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box;">
                        <div style="flex-grow:1; display:flex; align-items:flex-start; overflow:hidden; padding:1px 10px 1px 10px;">
                            <table style="width:100%; border-collapse:collapse; margin-top:0px; table-layout:fixed; word-wrap:break-word;">
                                <thead>
                                    <tr>
                                        ${finalHeaders}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${finalPvcMembersRows.join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="lc-address-block" style="flex-shrink:0; background:${addressBg}; border-top:1px solid ${addressBorder}; padding:3px 10px; font-size:5.5px; font-weight:bold; text-align:left; margin-top:0; display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="flex-grow:1;">
                                <div style="margin-bottom:1px;">ವಿಳಾಸ:</div>
                                <div style="margin-bottom:2px;">${addressKn}</div>
                                <div style="margin-bottom:1px;">Address:</div>
                                <div>${addressEn}</div>
                            </div>
                            <div style="flex-shrink:0; text-align:right; padding-left:6px; white-space:nowrap; align-self:flex-start;">
                                <span>ಜಿಲ್ಲೆ: ${districtVal}</span>&nbsp;&nbsp;<span>ತಾಲ್ಲೂಕು: ${talukVal}</span>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>`;



        // Hide original and inject
        if (cardFormat === "Normal with PVC") {
            originalTable.style.display = '';
            originalTable.after(wrapper);
        } else {
            originalTable.style.display = 'none';
            originalTable.parentNode.insertBefore(wrapper, originalTable);
        }

        // Ensure broken images are physically removed to bypass CSS !important overrides
        wrapper.querySelectorAll('img').forEach(img => {
            let handleBroken = () => {
                let parent = img.parentNode;
                let nextEl = parent ? parent.nextElementSibling : null;
                img.remove();
                if (nextEl && nextEl.innerText.includes('NO PHOTO')) {
                    nextEl.style.setProperty('display', 'block', 'important');
                }
            };
            img.addEventListener('error', handleBroken);
            if (img.complete && img.naturalHeight === 0) {
                handleBroken();
            }
        });

        // Inject Styles
        let style = document.createElement('style');
        style.innerHTML = `
        body { background: #e0e0e0; font-family: Arial, sans-serif; }
        #long-card-wrapper, #pvc-card-wrapper {
            background: ${isPvc && cardFormat !== "Long With PVC" ? 'transparent' : 'white'};
            width: 17.2cm;
            height: max-content !important;
            min-height: max-content !important;
            margin: 20px auto;
            ${isPvc && cardFormat !== "Long With PVC" ? 'border: none !important;' : 'border: 1.2px solid #000;'}
            ${isPvc && cardFormat !== "Long With PVC" ? 'box-shadow: none;' : 'box-shadow: 0 5px 15px rgba(0,0,0,0.2);'}
            box-sizing: border-box;
        }
        .lc-page {
            display: flex;
            width: 100%;
            padding: 0;
            box-sizing: border-box;
        }
        .lc-col {
            width: 50%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
        }
        .lc-left { ${isPvc ? 'border: none;' : 'border-right: 1px dashed #ccc;'} padding-right: 5px; }
        .lc-right { padding-left: 5px; }
        .lc-card {
            border: 2px solid ${themeBorder};
            border-radius: 5px;
            overflow: hidden;
            font-size: 12px;
            min-height: 0;
        }
        .lc-header {
            background: ${themeHeaderBg};
            color: white;
            text-align: center;
        }
        .lc-rc-bar {
            background: ${themeBarBg};
            padding: 5px 10px;
            text-align: center;
            border-bottom: 1px solid ${themeBorder};
        }
        .lc-front-content { padding: 15px; }
        .lc-info-block { font-size: 10px; line-height: 1.3; margin-top: 10px; }
        .lc-address-block { font-size: 11px; line-height: 1.4; margin-top: 20px; }
        .lc-instructions { padding: 10px 15px; }
        .lc-instructions ul { margin: 5px 0 0 20px; padding: 0; font-size: 10px; line-height: 1.4; font-weight:bold; }
        .lc-red-box {
            border: 1px solid red;
            border-radius: 5px;
            padding: 8px;
            margin-top: 10px;
            color: black;
            font-size: 10px;
        }
        .vertical-banner {
            position: absolute;
            right: 5px;
            top: 0;
            bottom: 0;
            width: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #000;
        }
        .vertical-banner span {
            transform: rotate(270deg);
            white-space: nowrap;
            font-size: 10px;
            font-weight: bold;
            text-align: center;
            line-height: 1.2;
        }
        
        @media print {
            @page { size: ${cardFormat === "PVC Card" ? 'auto' : 'A4 portrait'}; margin: 0; }
            body { background: white; margin: 0; padding: 0; }
            #long-card-wrapper { 
                margin: 0.5cm auto 0 auto !important;
                box-shadow: none; 
                width: 17.2cm !important; 
                height: auto !important; min-height: auto !important; 
            }
            #rc-extension-ui-overlay { display: none !important; }
        }
    `;
        document.head.appendChild(style);
    }

    function renderSwitcherSidebar(activeFormat) {
        let existingSidebar = document.getElementById('card-switcher-sidebar');
        if (existingSidebar) {
            existingSidebar.remove();
        }
        let existingIcon = document.getElementById('card-switcher-icon');
        if (existingIcon) {
            existingIcon.remove();
        }

        // Trigger icon centered vertically on the right
        let iconBtn = document.createElement('div');
        iconBtn.id = 'card-switcher-icon';
        iconBtn.style.cssText = `
        position: fixed;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        width: 52px;
        height: 52px;
        background: linear-gradient(135deg, #007bff, #0056b3);
        border-radius: 50%;
        box-shadow: 0 6px 20px rgba(0, 123, 255, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 999999;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    `;

        iconBtn.onmouseover = () => {
            iconBtn.style.transform = 'translateY(-50%) scale(1.1)';
            iconBtn.style.boxShadow = '0 8px 25px rgba(0, 123, 255, 0.5)';
        };
        iconBtn.onmouseout = () => {
            iconBtn.style.transform = 'translateY(-50%) scale(1)';
            iconBtn.style.boxShadow = '0 6px 20px rgba(0, 123, 255, 0.4)';
        };

        // Modern card layout SVG icon
        iconBtn.innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: #ffffff;">
            <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M19 19H5V5H19V19M7 7H17V9H7V7M7 11H17V13H7V11M7 15H14V17H7V15Z"/>
        </svg>
    `;

        // Sidebar on the right
        let sidebar = document.createElement('div');
        sidebar.id = 'card-switcher-sidebar';
        sidebar.style.cssText = `
        position: fixed;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        width: 220px;
        background: rgba(255, 255, 255, 0.98);
        border: 2px solid #007bff;
        border-radius: 16px;
        padding: 25px 15px 15px 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        display: none; /* Collapsed by default */
        flex-direction: column;
        gap: 10px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        backdrop-filter: blur(8px);
        box-sizing: border-box;
    `;

        // Cancel / Close button in top corner
        let closeBtn = document.createElement('span');
        closeBtn.id = 'card-switcher-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 12px;
        font-size: 24px;
        font-weight: bold;
        color: #aaa;
        cursor: pointer;
        transition: color 0.2s ease;
        line-height: 1;
    `;
        closeBtn.onmouseover = () => { closeBtn.style.color = '#ff5a5a'; };
        closeBtn.onmouseout = () => { closeBtn.style.color = '#aaa'; };
        closeBtn.onclick = () => {
            sidebar.style.display = 'none';
            iconBtn.style.display = 'flex';
        };
        sidebar.appendChild(closeBtn);

        let title = document.createElement('h3');
        title.innerText = 'Card Layout';
        title.style.cssText = `
        margin: 0 0 5px 0;
        font-size: 14px;
        font-weight: 700;
        color: #333;
        text-align: center;
        border-bottom: 1.5px solid #eee;
        padding-bottom: 8px;
        box-sizing: border-box;
    `;
        sidebar.appendChild(title);

        let formats = [
            "Normal Card",
            "Long Card",
            "PVC Card",
            "Normal with PVC",
            "Long With PVC"
        ];

        // Rearrange formats so that the activeFormat is first
        formats = [activeFormat].concat(formats.filter(f => f !== activeFormat));

        formats.forEach(fmt => {
            let btn = document.createElement('button');
            btn.innerText = fmt;
            let isActive = fmt === activeFormat;
            btn.style.cssText = `
            padding: 10px 12px;
            font-size: 13px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
            box-sizing: border-box;
            width: 100%;
        `;

            if (isActive) {
                btn.style.cssText += `
                background-color: #007bff !important;
                color: #ffffff !important;
                border: 1.5px solid #0056b3 !important;
                box-shadow: 0 2px 6px rgba(0,123,255,0.3);
            `;
            } else {
                btn.style.cssText += `
                background-color: #ffffff !important;
                color: #333333 !important;
                border: 1.5px solid #ccc !important;
            `;
                btn.onmouseover = () => {
                    btn.style.backgroundColor = '#f0f4f8';
                    btn.style.borderColor = '#007bff';
                };
                btn.onmouseout = () => {
                    btn.style.backgroundColor = '#ffffff';
                    btn.style.borderColor = '#ccc';
                };
                btn.onclick = () => {
                    handleCardSwitch(fmt, btn);
                };
            }
            sidebar.appendChild(btn);
        });

        // Add pricing and wallet info at the bottom
        chrome.storage.local.get(['wallet_balance', 'rc_verification_type', 'package_active', 'package_expiry'], function (res) {
            let currentBal = res.wallet_balance || 0;
            let isWithoutOtp = res.rc_verification_type === "with Out OTP";
            let isPackageActive = false;
            let daysRemaining = 0;
            if (res.package_active && res.package_expiry && res.package_expiry > Date.now()) {
                isPackageActive = true;
                daysRemaining = Math.max(0, Math.ceil((res.package_expiry - Date.now()) / (1000 * 60 * 60 * 24)));
            }

            let info = document.createElement('div');
            info.style.cssText = `
            margin-top: 10px;
            border-top: 1px dashed #e0e0e0;
            padding-top: 10px;
            font-size: 11px;
            color: #666;
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-weight: bold;
            box-sizing: border-box;
        `;

            let walletRow = document.createElement('div');
            walletRow.style.cssText = 'display: flex; justify-content: space-between;';
            if (isPackageActive) {
                walletRow.innerHTML = `<span>Package:</span><span style="color: #9070ff;">${daysRemaining} Days</span>`;
            } else {
                walletRow.innerHTML = `<span>Wallet:</span><span style="color: #28a745;">${currentBal} PTS</span>`;
            }
            info.appendChild(walletRow);

            let typeRow = document.createElement('div');
            typeRow.style.cssText = 'display: flex; justify-content: space-between;';
            typeRow.innerHTML = `<span>Method:</span><span>${isWithoutOtp ? "Without OTP" : "With OTP"}</span>`;
            info.appendChild(typeRow);

            sidebar.appendChild(info);
        });

        // Toggle interaction
        iconBtn.onclick = () => {
            iconBtn.style.display = 'none';
            sidebar.style.display = 'flex';
        };

        document.body.appendChild(iconBtn);
        document.body.appendChild(sidebar);
    }

    function handleCardSwitch(targetFormat, btnNode) {
        try {
            chrome.storage.local.get(['wallet_balance', 'rc_verification_type', 'rc_card_type', 'package_active', 'package_expiry'], function (res) {
                if (chrome.runtime.lastError) {
                    window.location.reload();
                    return;
                }

                let isPackageActive = false;
                if (res.package_active && res.package_expiry && res.package_expiry > Date.now()) {
                    isPackageActive = true;
                }

                let currentFormat = res.rc_card_type || "Normal Card";
                if (targetFormat === currentFormat) return;

                if (isPackageActive) {
                    if (btnNode.dataset.confirmed !== 'true') {
                        let originalText = btnNode.innerText;
                        btnNode.innerText = 'Click to Confirm';
                        btnNode.style.backgroundColor = '#ffc107';
                        btnNode.style.color = '#000';
                        btnNode.dataset.confirmed = 'true';
                        setTimeout(() => {
                            btnNode.innerText = originalText;
                            btnNode.style.backgroundColor = '#ffffff';
                            btnNode.style.color = '#333';
                            btnNode.dataset.confirmed = 'false';
                        }, 3000);
                        return;
                    }

                    try {
                        chrome.storage.local.set({
                            'rc_card_type': targetFormat,
                            'print_deducted_for_current': false
                        }, function () {
                            window.location.reload();
                        });
                    } catch (e) { window.location.reload(); }
                    return;
                }

                let currentBal = res.wallet_balance || 0;
                let isWithoutOtp = res.rc_verification_type === "with Out OTP";

                let requiredPoints = 2;
                if (isWithoutOtp) {
                    requiredPoints = 5;
                } else {
                    if (targetFormat === "Normal Card" || targetFormat === "Long Card") {
                        requiredPoints = 2;
                    } else {
                        requiredPoints = 4;
                    }
                }

                if (currentBal < requiredPoints) {
                    if (btnNode) {
                        let origText = btnNode.innerText;
                        btnNode.innerText = 'Insufficient PTS!';
                        btnNode.style.backgroundColor = '#ff5a5a';
                        btnNode.style.color = '#fff';
                        setTimeout(() => {
                            btnNode.innerText = origText;
                            btnNode.style.backgroundColor = '#ffffff';
                            btnNode.style.color = '#333';
                        }, 2000);
                    }
                    return;
                }

                if (btnNode.dataset.confirmed !== 'true') {
                    let originalText = btnNode.innerText;
                    btnNode.innerText = `Confirm (-${requiredPoints} PTS)`;
                    btnNode.style.backgroundColor = '#ffc107';
                    btnNode.style.color = '#000';
                    btnNode.dataset.confirmed = 'true';
                    setTimeout(() => {
                        btnNode.innerText = originalText;
                        btnNode.style.backgroundColor = '#ffffff';
                        btnNode.style.color = '#333';
                        btnNode.dataset.confirmed = 'false';
                    }, 3000);
                    return;
                }

                try {
                    chrome.storage.local.set({
                        'wallet_balance': currentBal - requiredPoints,
                        'rc_card_type': targetFormat,
                        'print_deducted_for_current': true
                    }, function () {
                        window.location.reload();
                    });
                } catch (e) { window.location.reload(); }
            });
        } catch (err) {
            window.location.reload();
        }
    }
})();
