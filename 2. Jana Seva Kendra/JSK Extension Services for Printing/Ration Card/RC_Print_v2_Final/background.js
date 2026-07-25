chrome.runtime.onInstalled.addListener(() => {
    console.log("RC Print Extension Installed");
    
    // Attempt to restore old data from sync storage
    chrome.storage.local.get(['agent_registered'], function(localRes) {
        if (!localRes.agent_registered) {
            chrome.storage.sync.get(null, function(syncRes) {
                if (syncRes && syncRes.agent_registered) {
                    console.log("Restored previous session data from sync storage.");
                    chrome.storage.local.set(syncRes);
                } else {
                    chrome.storage.local.set({ 'rc_automation_status': 'stopped', 'automation_tab_id': null });
                }
            });
        }
    });
});

// Suppress harmless "Frame removed" errors caused by rapid page navigation during executeScript calls
self.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.message && 
       (event.reason.message.includes('Frame with ID') || event.reason.message.includes('No frame with id'))) {
        event.preventDefault(); 
        console.warn('Suppressed navigation/frame error:', event.reason.message);
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: "https://ahara.karnataka.gov.in/?rc_ext=true" }, (newTab) => {
        chrome.storage.local.set({ 
            'active_ext_tab_id': newTab.id,
            'automation_tab_id': newTab.id 
        });
    });
});

// Listen for tab closures to stop automation and clear session data
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    chrome.storage.local.get(['automation_tab_id', 'rc_automation_status'], function(result) {
        if (result.automation_tab_id === tabId) {
            console.log("Automation tab closed. Stopping automation and clearing session data.");
            chrome.storage.local.set({ 
                'rc_automation_status': 'stopped', 
                'automation_tab_id': null,
                'rc_number': ''
            });
        }
    });
});

// Backup local storage changes to sync storage and Google Sheets automatically
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local') {
        let syncUpdate = {};
        for (let key in changes) {
            // Don't sync temporary tab states
            if (key !== 'automation_tab_id' && key !== 'rc_automation_status') {
                syncUpdate[key] = changes[key].newValue;
            }
        }
        if (Object.keys(syncUpdate).length > 0) {
            chrome.storage.sync.set(syncUpdate);
        }

        // Background sync points and package status to Google Sheets on changes
        const needsSync = changes.wallet_balance || changes.package_active || changes.package_expiry || changes.package_type || changes.package_print_counts || changes.agent_registered || changes.chrome_email;
        if (needsSync) {
            chrome.storage.local.get(['agent_registered', 'agent_name', 'agent_rc_number', 'agent_mob_no', 'agent_division', 'system_id', 'chrome_email', 'wallet_balance', 'package_active', 'package_expiry', 'package_type', 'package_print_counts'], function(res) {
                if (res.agent_registered && res.chrome_email) {
                    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxqfKn1jwBNUA9uoLjZl8pYRrNHajK0OSYaxCO2XoW2pYz3vQ4TjJFRqqr-77x5cc8ZsA/exec";
                    const data = {
                        type: "REGISTRATION",
                        name: res.agent_name || "",
                        rcNumber: res.agent_rc_number || "",
                        mobile: res.agent_mob_no || "",
                        division: res.agent_division || "",
                        systemId: res.system_id || "",
                        chromeEmail: res.chrome_email,
                        walletBalance: res.wallet_balance !== undefined ? res.wallet_balance : "",
                        packageExpiry: res.package_expiry !== undefined ? res.package_expiry : "",
                        packageType: res.package_type || "",
                        packagePrintCounts: res.package_print_counts ? JSON.stringify(res.package_print_counts) : ""
                    };
                    fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    }).catch(err => console.error("Error background-syncing status to Google Sheet:", err));
                }
            });
        }
    }
});

// Handle MAIN world click injections to bypass CSP
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "authorizeThisTab") {
        if (sender.tab) {
            chrome.storage.local.set({ 
                'active_ext_tab_id': sender.tab.id,
                'automation_tab_id': sender.tab.id 
            }, () => {
                sendResponse({ success: true });
            });
        }
        return true;
    }

    if (request.action === 'checkActiveTab') {
        chrome.storage.local.get(['active_ext_tab_id'], (res) => {
            sendResponse(sender.tab && sender.tab.id === res.active_ext_tab_id);
        });
        return true;
    }

    if (request.action === "silenceAlertsMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: () => {
                    let originalAlert = window.alert;
                    window.alert = function(msg) {
                        if (msg && typeof msg === 'string') {
                            let lower = msg.toLowerCase();
                            if (lower.includes('duplicate transaction')) {
                                window.postMessage({ type: 'RC_RESTART_FROM_START' }, '*');
                                return;
                            }
                            if (lower.includes('invalid') && lower.includes('rc no')) {
                                window.postMessage({ type: 'RC_STOP_AUTOMATION', saveError: true }, '*');
                                return;
                            }
                            if (lower.includes('otp') || lower.includes('invalid') || lower.includes('wrong')) {
                                if (document.getElementById('rc-premium-otp-overlay')) {
                                    return; // Let local overlay alert handler handle it
                                }
                                window.location.reload();
                                return;
                            }
                            originalAlert(msg);
                            window.postMessage({ type: 'RC_STOP_AUTOMATION' }, '*');
                        } else {
                            originalAlert(msg);
                            window.postMessage({ type: 'RC_STOP_AUTOMATION' }, '*');
                        }
                    };
                    window.confirm = function() { return true; };
                    window.prompt = function() { return null; };
                }
            });
            return true;
        }
    }
    if (request.action === "replaceAgentRcMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: (agent, target) => {
                    function checkAndReplace(doc) {
                        let inputs = doc.querySelectorAll("input");
                        let replaced = false;
                        for (let input of inputs) {
                            if (input.value && input.value.trim() === agent) {
                                input.disabled = false;
                                input.removeAttribute('disabled');
                                input.readOnly = false;
                                input.removeAttribute('readonly');
                                
                                input.focus();
                                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                if (nativeInputValueSetter) {
                                    nativeInputValueSetter.call(input, target);
                                } else {
                                    input.value = target;
                                }
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                input.dispatchEvent(new Event('blur', { bubbles: true }));
                                
                                // Auto click GO if there is a GO button in the same row/container
                                let container = input.parentElement;
                                while(container && container.tagName !== 'TR' && container.tagName !== 'DIV' && container.tagName !== 'TD') {
                                    container = container.parentElement;
                                }
                                if (container) {
                                    let nextCell = container.nextElementSibling;
                                    let goBtn = container.querySelector('input[value="GO"], input[type="submit"], button');
                                    if (!goBtn && nextCell) {
                                        goBtn = nextCell.querySelector('input[value="GO"], input[type="submit"], button');
                                    }
                                    if (goBtn) {
                                        goBtn.disabled = false;
                                        goBtn.removeAttribute('disabled');
                                        goBtn.click();
                                    }
                                }
                                replaced = true;
                            }
                        }
                        return replaced;
                    }
                    let res = checkAndReplace(document);
                    if (res) return res;
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc && checkAndReplace(frameDoc)) return true;
                        } catch(e) {}
                    }
                    return false;
                },
                args: [request.agent, request.target]
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                sendResponse({ status: results && results[0] && results[0].result ? "REPLACED" : "NOT_FOUND" });
            });
            return true;
        }
    }

    if (request.action === "swapRcOnlyMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: (agent, target) => {
                    function swapRc(doc) {
                        let inputs = doc.querySelectorAll("input");
                        let replaced = false;
                        for (let input of inputs) {
                            if (input.value && input.value.trim() === agent) {
                                input.disabled = false;
                                input.removeAttribute('disabled');
                                input.readOnly = false;
                                input.removeAttribute('readonly');
                                
                                input.focus();
                                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                if (nativeInputValueSetter) {
                                    nativeInputValueSetter.call(input, target);
                                } else {
                                    input.value = target;
                                }
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                input.dispatchEvent(new Event('blur', { bubbles: true }));
                                replaced = true;
                            }
                        }
                        return replaced;
                    }
                    let res = swapRc(document);
                    if (res) return res;
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc && swapRc(frameDoc)) return true;
                        } catch(e) {}
                    }
                    return false;
                },
                args: [request.agent, request.target]
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                sendResponse({ status: results && results[0] && results[0].result ? "REPLACED" : "NOT_FOUND" });
            });
            return true;
        }
    }

    if (request.action === "captureUidsFromTableMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: () => {
                    function extractFromTable(doc) {
                        let captured = false;
                        let uidMap = JSON.parse(sessionStorage.getItem('rcPrintUidMap') || '{}');
                        let tables = doc.querySelectorAll('table');
                        for (let t of tables) {
                            let nameIdx = -1;
                            let aadharIdx = -1;
                            let rows = t.querySelectorAll('tr');
                            if (rows.length < 2) continue; // Need at least header + 1 data row
                            
                            // Find header row (usually first or second row)
                            let headerRowIdx = 0;
                            for (let r = 0; r < Math.min(3, rows.length); r++) {
                                let ths = rows[r].querySelectorAll('th, td');
                                let tempNameIdx = -1;
                                let tempAadharIdx = -1;
                                for (let j = 0; j < ths.length; j++) {
                                    let txt = ths[j].innerText.toLowerCase();
                                    if (txt.includes('name')) tempNameIdx = j;
                                    if (txt.includes('aadhar') || txt.includes('aadahr') || txt.includes('uid')) tempAadharIdx = j;
                                }
                                if (tempNameIdx !== -1 && tempAadharIdx !== -1) {
                                    nameIdx = tempNameIdx;
                                    aadharIdx = tempAadharIdx;
                                    headerRowIdx = r;
                                    break;
                                }
                            }
                            
                            if (nameIdx !== -1 && aadharIdx !== -1) {
                                for (let i = headerRowIdx + 1; i < rows.length; i++) {
                                    let cells = rows[i].querySelectorAll('td');
                                    if (cells.length > Math.max(nameIdx, aadharIdx)) {
                                        let nameRaw = cells[nameIdx].innerText.trim();
                                        let name = nameRaw.split('/')[0].trim().toUpperCase();
                                        if (!name) name = nameRaw.toUpperCase();
                                        
                                        let aadharRaw = cells[aadharIdx].innerText.trim();
                                        let allDigits = aadharRaw.replace(/\D/g, '');
                                        if (allDigits.length >= 4 && name) {
                                            uidMap[name] = allDigits.slice(-4);
                                            captured = true;
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (captured) {
                            sessionStorage.setItem('rcPrintUidMap', JSON.stringify(uidMap));
                        }
                        return captured ? "CAPTURED" : "NOT_FOUND";
                    }
                    
                    let res = extractFromTable(document);
                    if (res !== "NOT_FOUND") return res;
                    
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc) {
                                let fr = extractFromTable(frameDoc);
                                if (fr !== "NOT_FOUND") return fr;
                            }
                        } catch(e) {}
                    }
                    return "NOT_FOUND";
                }
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                sendResponse({ status: results && results[0] ? results[0].result : "NOT_FOUND" });
            });
            return true;
        }
    }

    if (request.action === "captureUidsMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: () => {
                    function processDoc(doc) {
                        // Find Member dropdown and extract UIDs
                        let selects = doc.querySelectorAll('select');
                        let captured = false;
                        let uidMap = JSON.parse(sessionStorage.getItem('rcPrintUidMap') || '{}');
                        for (let select of selects) {
                            if (select.options.length > 1) {
                                for (let opt of select.options) {
                                    // Match pattern like: Name [UID:1234] or extract last 4 digits
                                    let uidMatch = opt.text.match(/\[UID[:\s]*(\d+)\]/i);
                                    let nameMatch = opt.text.replace(/\[UID[:\s]*\d+\]/i, '').replace(/\s+/g, ' ').trim();
                                    if (!uidMatch) {
                                        // Try to extract Aadhaar last 4 from option value or text
                                        let digits = opt.text.match(/\b(\d{4})\b/);
                                        if (digits && nameMatch) {
                                            uidMap[nameMatch.toUpperCase()] = digits[1];
                                            captured = true;
                                        }
                                    } else {
                                        if (nameMatch) {
                                            uidMap[nameMatch.toUpperCase()] = uidMatch[1];
                                            captured = true;
                                        }
                                    }
                                }
                            }
                        }
                        if (captured) {
                            sessionStorage.setItem('rcPrintUidMap', JSON.stringify(uidMap));
                        }
                        return captured ? "CAPTURED" : "NOT_READY";
                    }
                    
                    let res = processDoc(document);
                    if (res !== "NOT_FOUND") return res;
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc) {
                                let fr = processDoc(frameDoc);
                                if (fr !== "NOT_FOUND") return fr;
                            }
                        } catch(e) {}
                    }
                    return "NOT_READY";
                }
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                sendResponse({ status: results && results[0] ? results[0].result : "NOT_READY" });
            });
            return true;
        }
    }

    if (request.action === "clickElementMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: (searchText) => {
                    function searchAndClick(doc) {
                        const xpaths = [
                            `//input[@value='${searchText}']`,
                            `//input[contains(@value, '${searchText}')]`,
                            `//button[contains(., '${searchText}')]`,
                            `//a[contains(., '${searchText}')]`,
                            `//div[contains(., '${searchText}')]`,
                            `//td[contains(., '${searchText}')]`,
                            `//*[contains(text(), '${searchText}')]`
                        ];
                        for (let xpath of xpaths) {
                            const elements = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                            if (elements.snapshotLength > 0) {
                                let el = elements.snapshotItem(0);
                                let clickable = el.closest('a, button, [onclick], [href]') || el;
                                clickable.click();
                                return true;
                            }
                        }
                        return false;
                    }
                    
                    if (searchAndClick(document)) return true;
                    
                    // Search in frames
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc && searchAndClick(frameDoc)) return true;
                        } catch(e) {}
                    }
                    return false;
                },
                args: [request.text]
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                if (results && results[0]) {
                    sendResponse({ clicked: results[0].result });
                } else {
                    sendResponse({ clicked: false });
                }
            });
            return true; // Keep message channel open for async response
        }
    }

    if (request.action === "clickRadioButtonMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: (labelText) => {
                    function searchAndClick(doc) {
                        const xpaths = [
                            `//label[normalize-space(.)='${labelText}']//input[@type='radio']`,
                            `//input[@type='radio' and following-sibling::text()[normalize-space(.)='${labelText}']]`,
                            `//input[@type='radio' and preceding-sibling::text()[normalize-space(.)='${labelText}']]`,
                            `//*[normalize-space(text())='${labelText}']/preceding-sibling::input[@type='radio']`,
                            `//*[normalize-space(text())='${labelText}']/following-sibling::input[@type='radio']`,
                            `//label[contains(., '${labelText}')]//input[@type='radio']`,
                            `//input[@type='radio' and following-sibling::text()[contains(., '${labelText}')]]`,
                            `//input[@type='radio' and preceding-sibling::text()[contains(., '${labelText}')]]`,
                            `//*[contains(text(), '${labelText}')]/preceding-sibling::input[@type='radio']`,
                            `//*[contains(text(), '${labelText}')]/following-sibling::input[@type='radio']`
                        ];
                        for (let xpath of xpaths) {
                            const elements = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                            if (elements.snapshotLength > 0) {
                                let radio = elements.snapshotItem(0);
                                if (!radio.checked) {
                                    radio.click();
                                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                                return true;
                            }
                        }
                        return false;
                    }
                    if (searchAndClick(document)) return true;
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc && searchAndClick(frameDoc)) return true;
                        } catch(e) {}
                    }
                    return false;
                },
                args: [request.text]
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                if (results && results[0]) {
                    sendResponse({ clicked: results[0].result });
                } else {
                    sendResponse({ clicked: false });
                }
            });
            return true;
        }
    }

    if (request.action === "enterTextMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: (labelText, inputText) => {
                    function searchAndEnter(doc) {
                        const xpaths = [
                            `//td[contains(., '${labelText}')]/following-sibling::td//input[not(@type='hidden') and not(@type='submit') and not(@type='button') and not(@type='radio') and not(@type='checkbox')]`,
                            `//*[contains(., '${labelText}')]/following::input[not(@type='hidden') and not(@type='submit') and not(@type='button') and not(@type='radio') and not(@type='checkbox')]`,
                            `//*[contains(., '${labelText}')]/following-sibling::*//input[not(@type='hidden') and not(@type='submit') and not(@type='button') and not(@type='radio') and not(@type='checkbox')]`,
                            `//input[not(@type='hidden') and not(@type='submit') and not(@type='button') and not(@type='radio') and not(@type='checkbox')]`
                        ];
                        for (let xpath of xpaths) {
                            const elements = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                            if (elements.snapshotLength > 0) {
                                // Find the first visible input field
                                for (let i = 0; i < elements.snapshotLength; i++) {
                                    let input = elements.snapshotItem(i);
                                    if (input.type !== 'hidden' && input.style.display !== 'none') {
                                        input.focus();
                                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                        if (nativeInputValueSetter) {
                                            nativeInputValueSetter.call(input, inputText);
                                        } else {
                                            input.value = inputText;
                                        }
                                        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'End', keyCode: 35 }));
                                        input.dispatchEvent(new Event('input', { bubbles: true }));
                                        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'End', keyCode: 35 }));
                                        input.dispatchEvent(new Event('change', { bubbles: true }));
                                        input.dispatchEvent(new Event('blur', { bubbles: true }));
                                        return true;
                                    }
                                }
                            }
                        }
                        return false;
                    }
                    if (searchAndEnter(document)) return true;
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc && searchAndEnter(frameDoc)) return true;
                        } catch(e) {}
                    }
                    return false;
                },
                args: [request.text, request.value]
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                if (results && results[0]) {
                    sendResponse({ success: results[0].result });
                } else {
                    sendResponse({ success: false });
                }
            });
            return true;
        }
    }

    if (request.action === "selectDropdownOptionMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: (labelText, optionText) => {
                    function searchAndSelect(doc) {
                        const xpaths = [
                            `//td[contains(., '${labelText}')]/following-sibling::td`,
                            `//*[contains(., '${labelText}')]/following-sibling::*`
                        ];
                        for (let xpath of xpaths) {
                            const containers = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                            if (containers.snapshotLength > 0) {
                                let container = containers.snapshotItem(0);
                                let select = container.querySelector('select');
                                if (!select) {
                                    let nextContainer = container.nextElementSibling;
                                    if (nextContainer) select = nextContainer.querySelector('select');
                                }
                                
                                if (select) {
                                    // Make sure we wait for options to load
                                    if (select.options.length <= 1) return false;
                                    
                                    for (let i = 0; i < select.options.length; i++) {
                                        if (select.options[i].text.toLowerCase().includes(optionText.toLowerCase())) {
                                            // Check if already selected
                                            if (select.selectedIndex === i) return true;
                                            
                                            select.selectedIndex = i;
                                            select.dispatchEvent(new Event('change', { bubbles: true }));
                                            
                                            setTimeout(() => {
                                                let btnXPath = `.//input[@value='GO'] | .//button[contains(., 'GO')]`;
                                                let btnElements = doc.evaluate(btnXPath, container, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                                                if (btnElements.snapshotLength > 0) {
                                                    btnElements.snapshotItem(0).click();
                                                } else {
                                                    let nextContainer = container.nextElementSibling;
                                                    if (nextContainer) {
                                                        let nextBtnElements = doc.evaluate(btnXPath, nextContainer, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                                                        if (nextBtnElements.snapshotLength > 0) {
                                                            nextBtnElements.snapshotItem(0).click();
                                                            return;
                                                        }
                                                    }
                                                    let allGoBtns = doc.evaluate(`//input[@value='GO']`, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                                                    if (allGoBtns.snapshotLength > 1) {
                                                        allGoBtns.snapshotItem(allGoBtns.snapshotLength - 1).click();
                                                    }
                                                }
                                            }, 300);
                                            
                                            return true;
                                        }
                                    }
                                }
                            }
                        }
                        return false;
                    }
                    if (searchAndSelect(document)) return true;
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc && searchAndSelect(frameDoc)) return true;
                        } catch(e) {}
                    }
                    return false;
                },
                args: [request.labelText, request.optionText]
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                sendResponse({ selected: results && results[0] ? results[0].result : false });
            });
            return true;
        }
    }

    if (request.action === "checkElementExistsMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: (searchText) => {
                    function searchExists(doc) {
                        if (!doc.body || !doc.body.innerText) return false;
                        // Replace multiple spaces/newlines with single space for reliable matching
                        let textContent = doc.body.innerText.replace(/\s+/g, ' ');
                        return textContent.includes(searchText);
                    }
                    if (searchExists(document)) return true;
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc && searchExists(frameDoc)) return true;
                        } catch(e) {}
                    }
                    return false;
                },
                args: [request.text]
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                sendResponse({ exists: results && results[0] ? results[0].result : false });
            });
            return true;
        }
    }

    if (request.action === "clickIfDropdownSelectedMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: (labelText, buttonText) => {
                    function checkAndClick(doc) {
                        const xpaths = [
                            `//td[contains(., '${labelText}')]/following-sibling::td`,
                            `//*[contains(., '${labelText}')]/following-sibling::*`
                        ];
                        for (let xpath of xpaths) {
                            const containers = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                            if (containers.snapshotLength > 0) {
                                let container = containers.snapshotItem(0);
                                let select = container.querySelector('select');
                                if (!select) {
                                    // Maybe select is in the next sibling?
                                    let nextContainer = container.nextElementSibling;
                                    if (nextContainer) select = nextContainer.querySelector('select');
                                }
                                
                                if (select) {
                                    let selectedOption = select.options[select.selectedIndex];
                                    if (selectedOption && selectedOption.value !== '' && !selectedOption.text.includes('--Select--') && !selectedOption.text.includes('Select')) {
                                        // Valid option selected! Now find GO button in this container or next sibling
                                        let btnXPath = `.//input[@value='${buttonText}'] | .//button[contains(., '${buttonText}')]`;
                                        let btnElements = doc.evaluate(btnXPath, container, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                                        if (btnElements.snapshotLength > 0) {
                                            btnElements.snapshotItem(0).click();
                                            return "CLICKED";
                                        }
                                        let nextContainer = container.nextElementSibling;
                                        if (nextContainer) {
                                            let nextBtnElements = doc.evaluate(btnXPath, nextContainer, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                                            if (nextBtnElements.snapshotLength > 0) {
                                                nextBtnElements.snapshotItem(0).click();
                                                return "CLICKED";
                                            }
                                        }
                                        
                                        // Ultimate fallback for the second GO button
                                        let allGoBtns = doc.evaluate(`//input[@value='${buttonText}']`, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                                        if (allGoBtns.snapshotLength > 1) {
                                            allGoBtns.snapshotItem(1).click(); // Click the second one
                                            return "CLICKED";
                                        }
                                    }
                                    return "WAITING";
                                }
                            }
                        }
                        return "NOT_FOUND";
                    }
                    
                    let res = checkAndClick(document);
                    if (res !== "NOT_FOUND") return res;
                    
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc) {
                                let frameRes = checkAndClick(frameDoc);
                                if (frameRes !== "NOT_FOUND") return frameRes;
                            }
                        } catch(e) {}
                    }
                    return "NOT_FOUND";
                },
                args: [request.labelText, request.buttonText]
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                sendResponse({ status: results && results[0] ? results[0].result : "NOT_FOUND" });
            });
            return true;
        }
    }

    if (request.action === "extractOptionsAndShowOverlayMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: (labelText, buttonText, agentName, walletPoints, status) => {
                    if (document.getElementById('rc-premium-overlay')) return "ALREADY_EXISTS";
                    
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
                    
                    function checkAndShow(doc) {
                        const xpaths = [
                            `//td[contains(., '${labelText}')]/following-sibling::td`,
                            `//*[contains(., '${labelText}')]/following-sibling::*`
                        ];
                        for (let xpath of xpaths) {
                            const containers = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                            if (containers.snapshotLength > 0) {
                                let container = containers.snapshotItem(0);
                                let select = container.querySelector('select');
                                if (!select) {
                                    let nextContainer = container.nextElementSibling;
                                    if (nextContainer) select = nextContainer.querySelector('select');
                                }
                                
                                if (select) {
                                    let currentSelected = select.options[select.selectedIndex];
                                    if (currentSelected && currentSelected.value !== '' && currentSelected.value !== '-2' && !currentSelected.text.includes('--Select--') && !currentSelected.text.includes('Select')) {
                                        return "ALREADY_SELECTED";
                                    }
                                    
                                    let optionsData = [];
                                    for (let opt of select.options) {
                                        if (opt.value !== '' && opt.value !== '-2' && !opt.text.includes('--Select--') && !opt.text.includes('Select')) {
                                            optionsData.push({ text: opt.text.trim(), value: opt.value });
                                        }
                                    }
                                    
                                    if (optionsData.length === 0) return "WAITING";
                                    
                                    let overlay = doc.createElement('div');
                                    overlay.id = 'rc-premium-overlay';
                                    overlay.style.position = 'fixed';
                                    overlay.style.top = '0';
                                    overlay.style.left = '0';
                                    overlay.style.width = '100vw';
                                    overlay.style.height = '100vh';
                                    overlay.style.zIndex = '999999';
                                    overlay.style.fontFamily = "'Inter', sans-serif, Arial";
                                    overlay.style.display = 'flex';
                                    overlay.style.alignItems = 'center';
                                    overlay.style.justifyContent = 'center';
                                    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
                                    
                                    let modal = doc.createElement('div');
                                    modal.style.background = 'linear-gradient(145deg, #242436, #1a1a24)';
                                    modal.style.border = '1px solid rgba(144, 112, 255, 0.3)';
                                    modal.style.borderRadius = '16px';
                                    modal.style.padding = '20px';
                                    modal.style.width = '380px';
                                    modal.style.boxSizing = 'border-box';
                                    modal.style.boxShadow = '0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(144,112,255,0.18)';
                                    modal.style.textAlign = 'center';
                                    modal.style.animation = 'scaleIn 0.3s ease-out';
                                    
                                    let style = doc.createElement('style');
                                    style.textContent = `
                                        @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                                        #rc-premium-overlay ::-webkit-scrollbar { width: 6px; }
                                        #rc-premium-overlay ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
                                        #rc-premium-overlay ::-webkit-scrollbar-thumb { background: rgba(144, 112, 255, 0.5); border-radius: 4px; }
                                    `;
                                    doc.head.appendChild(style);
                                    
                                    let title = doc.createElement('h2');
                                    title.innerText = 'Select Family Member';
                                    title.style.color = '#fff';
                                    title.style.margin = '0 0 10px 0';
                                    title.style.fontSize = '22px';
                                    title.style.fontWeight = '700';
                                    title.style.background = 'linear-gradient(90deg, #b070ff, #7070ff)';
                                    title.style.webkitBackgroundClip = 'text';
                                    title.style.webkitTextFillColor = 'transparent';
                                    modal.appendChild(title);
                                    
                                    let statusPanel = createStatusPanel(doc, agentName, walletPoints, status, true);
                                    statusPanel.style.marginBottom = '15px';
                                    modal.appendChild(statusPanel);
                                    
                                    let list = doc.createElement('div');
                                    list.style.display = 'flex';
                                    list.style.flexDirection = 'column';
                                    list.style.gap = '12px';
                                    list.style.maxHeight = '60vh';
                                    list.style.overflowY = 'auto';
                                    list.style.paddingRight = '8px';
                                    
                                    optionsData.forEach(opt => {
                                        let btn = doc.createElement('button');
                                        btn.innerText = opt.text;
                                        btn.style.width = '100%';
                                        btn.style.padding = '16px';
                                        btn.style.background = 'rgba(255, 255, 255, 0.05)';
                                        btn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                                        btn.style.borderRadius = '10px';
                                        btn.style.color = '#fff';
                                        btn.style.fontSize = '15px';
                                        btn.style.fontWeight = '600';
                                        btn.style.cursor = 'pointer';
                                        btn.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                                        
                                        btn.onmouseover = () => {
                                            btn.style.background = 'rgba(144, 112, 255, 0.15)';
                                            btn.style.borderColor = 'rgba(144, 112, 255, 0.5)';
                                            btn.style.transform = 'translateY(-2px)';
                                            btn.style.boxShadow = '0 6px 15px rgba(144, 112, 255, 0.1)';
                                        };
                                        btn.onmouseout = () => {
                                            btn.style.background = 'rgba(255, 255, 255, 0.05)';
                                            btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                            btn.style.transform = 'translateY(0)';
                                            btn.style.boxShadow = 'none';
                                        };
                                        
                                        btn.onclick = () => {
                                            window.postMessage({ type: "MEMBER_SELECTED", memberName: opt.text }, "*");
                                            overlay.style.opacity = '0';
                                            overlay.style.transition = 'opacity 0.2s';
                                            setTimeout(() => {
                                                select.value = opt.value;
                                                select.dispatchEvent(new Event('change', { bubbles: true }));
                                                let btnXPath = `.//input[@value='${buttonText}'] | .//button[contains(., '${buttonText}')]`;
                                                let btnElements = doc.evaluate(btnXPath, container, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                                                if (btnElements.snapshotLength > 0) {
                                                    btnElements.snapshotItem(0).click();
                                                } else {
                                                    let nextContainer = container.nextElementSibling;
                                                    if (nextContainer) {
                                                        let nextBtnElements = doc.evaluate(btnXPath, nextContainer, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                                                        if (nextBtnElements.snapshotLength > 0) {
                                                            nextBtnElements.snapshotItem(0).click();
                                                        }
                                                    }
                                                    let allGoBtns = doc.evaluate(`//input[@value='${buttonText}']`, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                                                    if (allGoBtns.snapshotLength > 1) {
                                                        allGoBtns.snapshotItem(1).click();
                                                    }
                                                }
                                                overlay.remove();
                                            }, 200);
                                        };
                                        list.appendChild(btn);
                                    });
                                    
                                    modal.appendChild(list);
                                    overlay.appendChild(modal);
                                    doc.documentElement.appendChild(overlay);
                                    
                                    return "SHOWN";
                                }
                            }
                        }
                        return "NOT_FOUND";
                    }
                    
                    let res = checkAndShow(document);
                    if (res !== "NOT_FOUND") return res;
                    
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc) {
                                let frameRes = checkAndShow(frameDoc);
                                if (frameRes !== "NOT_FOUND") return frameRes;
                            }
                        } catch(e) {}
                    }
                    return "NOT_FOUND";
                },
                args: [request.labelText, request.buttonText, request.agentName, request.walletPoints, request.status]
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                sendResponse({ status: results && results[0] ? results[0].result : "NOT_FOUND" });
            });
            return true;
        }
    }

    if (request.action === "extractCaptchaAndShowOverlayMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: (agentName, walletPoints, status) => {
                    if (document.getElementById('rc-premium-captcha-overlay')) return "ALREADY_EXISTS";
                    
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
                    
                    function checkAndShow(doc) {
                        let enterCaptchaNodes = doc.evaluate(`//*[contains(text(), 'Enter Captcha')]`, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                        if (enterCaptchaNodes.snapshotLength === 0) return "NOT_FOUND";
                        
                        let enterCaptchaEl = enterCaptchaNodes.snapshotItem(0);
                        
                        // Check if it's already filled (in case of page reload with state)
                        let containerTd = enterCaptchaEl.closest('td');
                        let inputContainer = containerTd.nextElementSibling;
                        if (!inputContainer) {
                            let tr = enterCaptchaEl.closest('tr');
                            if (tr) inputContainer = tr.querySelectorAll('td')[1];
                        }
                        
                        let realInput = null;
                        let goBtn = null;
                        
                        if (inputContainer) {
                            realInput = inputContainer.querySelector('input[type="text"]');
                            goBtn = inputContainer.querySelector('input[value="GO"], input[type="submit"], button');
                            if (!goBtn && inputContainer.nextElementSibling) {
                                goBtn = inputContainer.nextElementSibling.querySelector('input[value="GO"], input[type="submit"], button');
                            }
                        }
                        
                        if (!realInput) {
                            realInput = doc.evaluate(`//input[not(@type='hidden')]`, enterCaptchaEl.closest('tr'), null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                        }
                        
                        let table = enterCaptchaEl.closest('table');
                        let images = table ? Array.from(table.querySelectorAll('img')) : [];
                        let captchaImg = images.find(img => img.clientWidth > 40 && img.clientHeight > 20) || images[0];
                        
                        if (!captchaImg) {
                            let prevTr = enterCaptchaEl.closest('tr').previousElementSibling;
                            if (prevTr) captchaImg = prevTr.querySelector('img');
                        }
                        
                        if (!captchaImg) return "WAITING"; // image not loaded yet
                        
                        let overlay = doc.createElement('div');
                        overlay.id = 'rc-premium-captcha-overlay';
                        overlay.style.position = 'fixed';
                        overlay.style.top = '0';
                        overlay.style.left = '0';
                        overlay.style.width = '100vw';
                        overlay.style.height = '100vh';
                        overlay.style.zIndex = '999999';
                        overlay.style.fontFamily = "'Inter', sans-serif, Arial";
                        overlay.style.display = 'flex';
                        overlay.style.alignItems = 'center';
                        overlay.style.justifyContent = 'center';
                        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
                        
                        let modal = doc.createElement('div');
                        modal.style.background = 'linear-gradient(145deg, #242436, #1a1a24)';
                        modal.style.border = '1px solid rgba(0, 200, 128, 0.3)';
                        modal.style.borderRadius = '16px';
                        modal.style.padding = '20px';
                        modal.style.width = '380px';
                        modal.style.boxSizing = 'border-box';
                        modal.style.boxShadow = '0 8px 40px rgba(0,0,0,0.55)';
                        modal.style.textAlign = 'center';
                        modal.style.animation = 'scaleIn 0.3s ease-out';
                        
                        let title = doc.createElement('h2');
                        title.innerText = 'Security Verification';
                        title.style.color = '#fff';
                        title.style.margin = '0 0 8px 0';
                        title.style.fontSize = '22px';
                        title.style.fontWeight = '700';
                        title.style.background = 'linear-gradient(90deg, #00e090, #00c880)';
                        title.style.webkitBackgroundClip = 'text';
                        title.style.webkitTextFillColor = 'transparent';
                        modal.appendChild(title);
                        
                        let subtitle = doc.createElement('p');
                        subtitle.innerText = 'Please enter the 6-digit Captcha';
                        subtitle.style.color = '#8c8c9e';
                        subtitle.style.fontSize = '12px';
                        subtitle.style.margin = '0 0 10px 0';
                        modal.appendChild(subtitle);
                        
                        let statusPanel = createStatusPanel(doc, agentName, walletPoints, status, true);
                        statusPanel.style.marginBottom = '15px';
                        modal.appendChild(statusPanel);
                        
                        let imgWrapper = doc.createElement('div');
                        imgWrapper.style.background = '#fff';
                        imgWrapper.style.padding = '10px';
                        imgWrapper.style.borderRadius = '8px';
                        imgWrapper.style.display = 'inline-block';
                        imgWrapper.style.marginBottom = '24px';
                        
                        let imgClone = doc.createElement('img');
                        imgClone.src = captchaImg.src;
                        imgClone.style.maxWidth = '100%';
                        imgClone.style.height = 'auto';
                        imgWrapper.appendChild(imgClone);
                        modal.appendChild(imgWrapper);
                        
                        let inputWrapper = doc.createElement('div');
                        inputWrapper.style.position = 'relative';
                        
                        let input = doc.createElement('input');
                        input.type = 'text';
                        input.maxLength = 6;
                        input.placeholder = '\u2022\u2022\u2022\u2022\u2022\u2022';
                        input.style.width = '100%';
                        input.style.boxSizing = 'border-box';
                        input.style.background = 'rgba(0, 0, 0, 0.3)';
                        input.style.border = '2px solid rgba(0, 200, 128, 0.3)';
                        input.style.borderRadius = '10px';
                        input.style.color = '#00e090';
                        input.style.fontSize = '28px';
                        input.style.fontWeight = '700';
                        input.style.letterSpacing = '8px';
                        input.style.textAlign = 'center';
                        input.style.padding = '16px';
                        input.style.outline = 'none';
                        input.style.transition = 'border-color 0.2s';
                        
                        input.onfocus = () => { input.style.borderColor = '#00e090'; };
                        input.onblur = () => { input.style.borderColor = 'rgba(0, 200, 128, 0.3)'; };
                        
                        input.oninput = (e) => {
                            input.value = input.value.replace(/[^0-9]/g, '');
                            if (input.value.length === 6) {
                                input.style.background = 'rgba(0, 200, 128, 0.1)';
                                overlay.style.opacity = '0';
                                overlay.style.transition = 'opacity 0.2s';
                                
                                setTimeout(() => {
                                    if (realInput) {
                                        realInput.focus();
                                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                        if (nativeInputValueSetter) nativeInputValueSetter.call(realInput, input.value);
                                        else realInput.value = input.value;
                                        
                                        realInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'End', keyCode: 35 }));
                                        realInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        realInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'End', keyCode: 35 }));
                                        realInput.dispatchEvent(new Event('change', { bubbles: true }));
                                        realInput.dispatchEvent(new Event('blur', { bubbles: true }));
                                        
                                        if (goBtn) {
                                            goBtn.click();
                                        } else {
                                            let allGoBtns = doc.evaluate(`//input[@value='GO']`, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                                            if (allGoBtns.snapshotLength > 0) {
                                                allGoBtns.snapshotItem(allGoBtns.snapshotLength - 1).click();
                                            }
                                        }
                                    }
                                    overlay.remove();
                                }, 200);
                            }
                        };
                        
                        inputWrapper.appendChild(input);
                        modal.appendChild(inputWrapper);

                        // --- Reset Engine Button ---
                        let resetEngineBtn = doc.createElement('button');
                        resetEngineBtn.innerText = '[STOP] Cancel & Return Home';
                        resetEngineBtn.style.cssText = 'width:100%;margin-top:16px;padding:10px;background:rgba(255,60,60,0.08);border:1px solid rgba(255,60,60,0.25);border-radius:8px;color:#a07070;font-size:11px;font-weight:700;letter-spacing:0.5px;cursor:pointer;font-family:Inter,sans-serif;transition:all 0.2s;';
                        resetEngineBtn.onmouseover = () => { resetEngineBtn.style.background='rgba(255,60,60,0.2)'; resetEngineBtn.style.color='#ff6060'; resetEngineBtn.style.borderColor='rgba(255,60,60,0.6)'; };
                        resetEngineBtn.onmouseout  = () => { resetEngineBtn.style.background='rgba(255,60,60,0.08)'; resetEngineBtn.style.color='#a07070'; resetEngineBtn.style.borderColor='rgba(255,60,60,0.25)'; };
                        resetEngineBtn.onclick = () => {
                            resetEngineBtn.innerText = '[OK] Stopping...';
                            window.postMessage({ type: 'RC_STOP_AUTOMATION' }, '*');
                        };
                        modal.appendChild(resetEngineBtn);
                        // --- End Reset Engine Button ---

                        overlay.appendChild(modal);
                        doc.documentElement.appendChild(overlay);
                        
                        setTimeout(() => input.focus(), 100);
                        
                        return "SHOWN";
                    }
                    
                    let res = checkAndShow(document);
                    if (res !== "NOT_FOUND") return res;
                    
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc) {
                                let frameRes = checkAndShow(frameDoc);
                                if (frameRes !== "NOT_FOUND") return frameRes;
                            }
                        } catch(e) {}
                    }
                    return "NOT_FOUND";
                },
                args: [request.agentName, request.walletPoints, request.status]
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                sendResponse({ status: results && results[0] ? results[0].result : "NOT_FOUND" });
            });
            return true;
        }
    }

    if (request.action === "extractOtpAndShowOverlayMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: (agentName, selectedMemberName, isRetry, verificationType, walletPoints, status) => {
                    if (document.getElementById('rc-premium-otp-overlay')) return "ALREADY_EXISTS";
                    
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
                    
                    function checkAndShowOtp(doc) {
                        let enterOtpNodes = doc.evaluate(`//*[contains(text(), 'Enter OTP')]`, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                        if (enterOtpNodes.snapshotLength === 0) return "NOT_FOUND";
                        
                        let enterOtpEl = enterOtpNodes.snapshotItem(0);
                        
                        // Check if it's already filled
                        let containerTd = enterOtpEl.closest('td');
                        let inputContainer = containerTd.nextElementSibling;
                        if (!inputContainer) {
                            let tr = enterOtpEl.closest('tr');
                            if (tr) inputContainer = tr.querySelectorAll('td')[1];
                        }
                        
                        let realInput = null;
                        let goBtn = null;
                        
                        if (inputContainer) {
                            realInput = inputContainer.querySelector('input[type="text"], input[type="password"]');
                            goBtn = inputContainer.querySelector('input[value="GO"], input[type="submit"], button');
                            if (!goBtn && inputContainer.nextElementSibling) {
                                goBtn = inputContainer.nextElementSibling.querySelector('input[value="GO"], input[type="submit"], button');
                            }
                        }
                        
                        if (!realInput) {
                            realInput = doc.evaluate(`//input[not(@type='hidden')]`, enterOtpEl.closest('tr'), null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                        }
                        
                        let overlay = doc.createElement('div');
                        overlay.id = 'rc-premium-otp-overlay';
                        overlay.style.position = 'fixed';
                        overlay.style.top = '0';
                        overlay.style.left = '0';
                        overlay.style.width = '100vw';
                        overlay.style.height = '100vh';
                        overlay.style.zIndex = '999999';
                        overlay.style.fontFamily = "'Inter', sans-serif, Arial";
                        overlay.style.display = 'flex';
                        overlay.style.alignItems = 'center';
                        overlay.style.justifyContent = 'center';
                        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
                        
                        let modal = doc.createElement('div');
                        modal.style.background = 'linear-gradient(145deg, #1a2436, #0f1624)';
                        modal.style.border = '1px solid rgba(0, 150, 255, 0.3)';
                        modal.style.borderRadius = '16px';
                        modal.style.padding = '20px';
                        modal.style.width = '380px';
                        modal.style.boxSizing = 'border-box';
                        modal.style.boxShadow = '0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,150,255,0.18)';
                        modal.style.textAlign = 'center';
                        modal.style.animation = 'scaleIn 0.3s ease-out';
                        
                        let iconWrapper = doc.createElement('div');
                        iconWrapper.innerHTML = '\uD83D\uDD12';
                        iconWrapper.style.fontSize = '40px';
                        iconWrapper.style.marginBottom = '15px';
                        modal.appendChild(iconWrapper);
                        
                        let title = doc.createElement('h2');
                        title.innerText = 'Aadhaar OTP';
                        title.style.color = '#fff';
                        title.style.margin = '0 0 8px 0';
                        title.style.fontSize = '22px';
                        title.style.fontWeight = '700';
                        title.style.background = 'linear-gradient(90deg, #00c8ff, #0080ff)';
                        title.style.webkitBackgroundClip = 'text';
                        title.style.webkitTextFillColor = 'transparent';
                        modal.appendChild(title);
                        
                        let statusPanel = createStatusPanel(doc, agentName, walletPoints, status, true);
                        statusPanel.style.marginBottom = '15px';
                        modal.appendChild(statusPanel);
                        
                        let subtitle = doc.createElement('p');
                        let targetMember = selectedMemberName || agentName || "Family Member";
                        if (verificationType === "Without OTP" || verificationType === "with Out OTP") {
                            // Without OTP mode = Agent gets OTP
                            targetMember = agentName || "Agent";
                            if (isRetry) {
                                subtitle.innerHTML = `Dear Agent (<strong style="color:#fff;">${targetMember}</strong>) You entered wrong OTP please.. Enter the Right OTP on Below Box`;
                                subtitle.style.color = '#ff4081'; // Pink/Red warning color
                            } else {
                                subtitle.innerHTML = `Dear Agent (<strong style="color:#fff;">${targetMember}</strong>) You will receive OTP please.. Enter the OTP on Below Box`;
                                subtitle.style.color = '#8c9ea0';
                            }
                        } else {
                            // With OTP mode = Member gets OTP
                            if (isRetry) {
                                subtitle.innerHTML = `Dear Agent . the Member (<strong style="color:#fff;">${targetMember}</strong>) entered wrong OTP Please .. Enter the Right OTP on Below Box .`;
                                subtitle.style.color = '#ff4081'; // Pink/Red warning color
                            } else {
                                subtitle.innerHTML = `Dear Agent . the Member (<strong style="color:#fff;">${targetMember}</strong>) will Receive OTP Please .. Enter to OTP on Below Box .`;
                                subtitle.style.color = '#8c9ea0';
                            }
                        }
                        subtitle.style.fontSize = '12px';
                        subtitle.style.lineHeight = '1.5';
                        subtitle.style.margin = '0 0 24px 0';
                        modal.appendChild(subtitle);
                        
                        let inputWrapper = doc.createElement('div');
                        inputWrapper.style.position = 'relative';
                        
                        let input = doc.createElement('input');
                        input.type = 'text';
                        input.maxLength = 6;
                        input.placeholder = '\u2022\u2022\u2022\u2022\u2022\u2022';
                        input.style.width = '100%';
                        input.style.boxSizing = 'border-box';
                        input.style.background = 'rgba(0, 0, 0, 0.3)';
                        input.style.border = '2px solid rgba(0, 150, 255, 0.3)';
                        input.style.borderRadius = '10px';
                        input.style.color = '#00c8ff';
                        input.style.fontSize = '28px';
                        input.style.fontWeight = '700';
                        input.style.letterSpacing = '8px';
                        input.style.textAlign = 'center';
                        input.style.padding = '16px';
                        input.style.outline = 'none';
                        input.style.transition = 'border-color 0.2s';
                        
                        input.onfocus = () => { input.style.borderColor = '#00c8ff'; };
                        input.onblur = () => { input.style.borderColor = 'rgba(0, 150, 255, 0.3)'; };
                        
                        // Intercept alerts to handle AJAX errors
                        if (!window.rcAlertOverridden) {
                            window.rcAlertOverridden = true;
                            window.otpAttemptCount = 0;
                            let originalAlert = window.alert;
                            window.alert = function(msg) {
                                if (msg && typeof msg === 'string') {
                                    let lower = msg.toLowerCase();
                                    if (lower.includes('duplicate transaction')) {
                                        window.postMessage({ type: 'RC_RESTART_FROM_START' }, '*');
                                        return;
                                    }
                                    if (lower.includes('invalid') && lower.includes('rc no')) {
                                        window.postMessage({ type: 'RC_STOP_AUTOMATION', saveError: true }, '*');
                                        return;
                                    }
                                    if (lower.includes('otp') || lower.includes('invalid') || lower.includes('wrong')) {
                                        window.otpAttemptCount = (window.otpAttemptCount || 0) + 1;
                                        
                                        if (window.otpAttemptCount >= 2) {
                                            // 2 failed attempts: stop automation and return to popup
                                            let currentOverlay = document.getElementById('rc-premium-otp-overlay');
                                            if (currentOverlay) {
                                                currentOverlay.remove();
                                            }
                                            window.postMessage({ type: 'RC_STOP_AUTOMATION' }, '*');
                                            return;
                                        }
                                        
                                        // Re-enable the overlay for the second attempt
                                        let currentOverlay = document.getElementById('rc-premium-otp-overlay');
                                        if (currentOverlay) {
                                            let currentInput = currentOverlay.querySelector('input');
                                            let currentSubtitle = currentOverlay.querySelector('p');
                                            if (currentInput) {
                                                currentInput.disabled = false;
                                                currentInput.value = '';
                                                currentInput.focus();
                                                currentInput.style.background = 'rgba(0, 0, 0, 0.3)';
                                            }
                                            if (currentSubtitle) {
                                                currentSubtitle.innerText = `Dear Agent ${agentName}, you entered the wrong OTP (Attempt ${window.otpAttemptCount}/2), please enter the Right OTP`;
                                                currentSubtitle.style.color = '#ff4081';
                                            }
                                        }
                                    } else {
                                        originalAlert(msg);
                                        window.postMessage({ type: 'RC_STOP_AUTOMATION' }, '*');
                                    }
                                } else {
                                    originalAlert(msg);
                                    window.postMessage({ type: 'RC_STOP_AUTOMATION' }, '*');
                                }
                            };
                        }
                        
                        input.oninput = (e) => {
                            input.value = input.value.replace(/[^0-9]/g, '');
                        };
                        
                        inputWrapper.appendChild(input);
                        modal.appendChild(inputWrapper);

                        let submitBtn = doc.createElement('button');
                        submitBtn.innerText = 'SUBMIT OTP';
                        submitBtn.style.cssText = 'width:100%;margin-top:16px;padding:14px;background:linear-gradient(90deg, #00c8ff, #0080ff);border:none;border-radius:10px;color:#fff;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 15px rgba(0, 150, 255, 0.3);transition:opacity 0.2s;';
                        submitBtn.onmouseover = () => { submitBtn.style.opacity = '0.9'; };
                        submitBtn.onmouseout = () => { submitBtn.style.opacity = '1'; };
                        submitBtn.onclick = () => {
                            if (input.value.length === 6) {
                                input.style.background = 'rgba(0, 150, 255, 0.1)';
                                input.disabled = true;
                                submitBtn.disabled = true;
                                submitBtn.innerText = 'VERIFYING...';
                                submitBtn.style.opacity = '0.7';
                                subtitle.innerText = "Verifying OTP... Please wait...";
                                subtitle.style.color = "#00c8ff";
                                
                                setTimeout(() => {
                                    if (realInput) {
                                        realInput.focus();
                                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                        if (nativeInputValueSetter) nativeInputValueSetter.call(realInput, input.value);
                                        else realInput.value = input.value;
                                        
                                        realInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'End', keyCode: 35 }));
                                        realInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        realInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'End', keyCode: 35 }));
                                        realInput.dispatchEvent(new Event('change', { bubbles: true }));
                                        realInput.dispatchEvent(new Event('blur', { bubbles: true }));
                                        
                                        if (goBtn) {
                                            goBtn.click();
                                        } else {
                                            let allGoBtns = doc.evaluate(`//input[@value='GO']`, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                                            if (allGoBtns.snapshotLength > 0) {
                                                allGoBtns.snapshotItem(allGoBtns.snapshotLength - 1).click();
                                            }
                                        }
                                    }
                                    window.postMessage({ type: "OTP_SUBMITTED" }, "*");
                                    
                                    setTimeout(() => {
                                        let currentOverlay = document.getElementById('rc-premium-otp-overlay');
                                        if (currentOverlay && input.disabled) {
                                            window.location.reload();
                                        }
                                    }, 3000);
                                }, 200);
                            } else {
                                subtitle.innerText = "Please enter a valid 6-digit OTP first.";
                                subtitle.style.color = "#ff4081";
                                input.focus();
                            }
                        };
                        modal.appendChild(submitBtn);

                        // --- Reset Engine Button ---
                        let resetEngineBtn = doc.createElement('button');
                        resetEngineBtn.innerText = '[STOP] Cancel & Return Home';
                        resetEngineBtn.style.cssText = 'width:100%;margin-top:16px;padding:10px;background:rgba(255,60,60,0.08);border:1px solid rgba(255,60,60,0.25);border-radius:8px;color:#a07070;font-size:11px;font-weight:700;letter-spacing:0.5px;cursor:pointer;font-family:Inter,sans-serif;transition:all 0.2s;';
                        resetEngineBtn.onmouseover = () => { resetEngineBtn.style.background='rgba(255,60,60,0.2)'; resetEngineBtn.style.color='#ff6060'; resetEngineBtn.style.borderColor='rgba(255,60,60,0.6)'; };
                        resetEngineBtn.onmouseout  = () => { resetEngineBtn.style.background='rgba(255,60,60,0.08)'; resetEngineBtn.style.color='#a07070'; resetEngineBtn.style.borderColor='rgba(255,60,60,0.25)'; };
                        resetEngineBtn.onclick = () => {
                            resetEngineBtn.innerText = '[OK] Stopping...';
                            window.postMessage({ type: 'RC_STOP_AUTOMATION' }, '*');
                        };
                        modal.appendChild(resetEngineBtn);
                        // --- End Reset Engine Button ---

                        overlay.appendChild(modal);
                        doc.documentElement.appendChild(overlay);
                        
                        setTimeout(() => input.focus(), 100);
                        
                        return "SHOWN";
                    }
                    
                    let res = checkAndShowOtp(document);
                    if (res !== "NOT_FOUND") return res;
                    
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc) {
                                let frameRes = checkAndShowOtp(frameDoc);
                                if (frameRes !== "NOT_FOUND") return frameRes;
                            }
                        } catch(e) {}
                    }
                    return "NOT_FOUND";
                },
                args: [request.agentName, request.selectedMemberName, request.isRetry, request.verificationType, request.walletPoints, request.status]
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                sendResponse({ status: results && results[0] ? results[0].result : "NOT_FOUND" });
            });
            return true;
        }
    }

    if (request.action === "extractRcTypeAndClickViewMainWorld") {
        if (sender.tab) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
                world: "MAIN",
                func: () => {
                    function extractAndClick(doc) {
                        let rcTypeNodes = doc.evaluate(`//td[contains(text(), 'RC Type')]`, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                        let finalRcType = "";
                        
                        if (rcTypeNodes.snapshotLength > 0) {
                            let labelTd = rcTypeNodes.snapshotItem(0);
                            let valueTd = labelTd.nextElementSibling;
                            if (valueTd) {
                                let text = valueTd.innerText.toUpperCase();
                                if (text.includes("NPHH") || text.includes("NON-PRIORITY")) finalRcType = "NPHH";
                                else if (text.includes("PRIORITY") || text.includes("PHH")) finalRcType = "PHH";
                                else if (text.includes("ANTYODAYA") || text.includes("AAY")) finalRcType = "AAY";
                                
                                if (finalRcType) {
                                    // Save it to local storage from within the page context by sending a message if needed
                                    // But we can just return it and let background handle storage
                                }
                            }
                        }
                        
                        let viewLinkNodes = doc.evaluate(`//a[contains(text(), 'View Ration Card Details')] | //a[contains(text(), 'View RC Details')]`, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                        if (viewLinkNodes.snapshotLength > 0) {
                            viewLinkNodes.snapshotItem(0).click();
                            return { status: "CLICKED", type: finalRcType };
                        }
                        
                        return null;
                    }
                    
                    let res = extractAndClick(document);
                    if (res) return res;
                    
                    let frames = document.querySelectorAll('frame, iframe');
                    for (let frame of frames) {
                        try {
                            let frameDoc = frame.contentDocument || frame.contentWindow.document;
                            if (frameDoc) {
                                let frameRes = extractAndClick(frameDoc);
                                if (frameRes) return frameRes;
                            }
                        } catch(e) {}
                    }
                    return null;
                }
            }, (results) => {
                if (chrome.runtime.lastError) { console.warn("executeScript error:", chrome.runtime.lastError.message); }
                if (results && results[0] && results[0].result) {
                    let data = results[0].result;
                    if (data.type) {
                        chrome.storage.local.set({ 'fetched_rc_type': data.type });
                    }
                    sendResponse(data);
                } else {
                    sendResponse({ status: "NOT_FOUND" });
                }
            });
        }
    }
});

// PayU Callback Interceptor
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        const url = changeInfo.url;
        if (url.includes('payu-success-callback')) {
            chrome.storage.local.get(['pending_payu_amount', 'wallet_balance', 'pending_payu_type', 'pending_payu_package_name', 'points_offer_used'], (res) => {
                const amount = parseFloat(res.pending_payu_amount) || 0;
                const payuType = res.pending_payu_type || 'Points';
                
                if (payuType === 'Package') {
                    const packageName = res.pending_payu_package_name || '1 Month';
                    
                    let days = 30;
                    if (packageName === "3 Month") days = 90;
                    else if (packageName === "6 Month") days = 180;
                    else if (packageName === "9 Month") days = 270;
                    else if (packageName === "12 Month") days = 365;
                    
                    const expiryTime = Date.now() + (days * 24 * 60 * 60 * 1000);
                    
                    chrome.storage.local.set({ 
                        'package_active': true, 
                        'package_expiry': expiryTime,
                        'package_type': packageName,
                        'package_print_counts': { "Normal Card": 0, "Long Card": 0, "PVC Card": 0, "Normal with PVC": 0, "Long With PVC": 0 },
                        'pending_payu_amount': 0,
                        'pending_payu_type': 'Points'
                    }, () => {
                        chrome.tabs.remove(tabId);
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'emblem.png',
                            title: 'Package Activated',
                            message: `Successfully activated ${packageName} package!`
                        });
                    });
                } else {
                    let points = amount;
                    let usedOffer = false;
                    
                    if (!res.points_offer_used) {
                        if (amount >= 999) {
                            points = amount * 5;
                            usedOffer = true;
                        } else if (amount >= 499) {
                            points = amount * 2;
                            usedOffer = true;
                        }
                    }
                    
                    const currentBal = res.wallet_balance || 0;
                    const newBal = currentBal + points;
                    
                    let newStore = { 
                        'payment_verified': true, 
                        'wallet_balance': newBal,
                        'pending_payu_amount': 0
                    };
                    if (usedOffer) {
                        newStore.points_offer_used = true;
                    }
                    
                    chrome.storage.local.set(newStore, () => {
                        chrome.tabs.remove(tabId);
                        // Notify user
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'emblem.png',
                            title: 'Payment Successful',
                            message: `Successfully added ${points} points to your wallet via PayU!`
                        });
                    });
                }
            });
        } else if (url.includes('payu-failure-callback')) {
            // Payment Failure
            chrome.tabs.remove(tabId);
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'emblem.png',
                title: 'Payment Failed',
                message: 'Your PayU transaction failed or was cancelled.'
            });
        }
    }
});

