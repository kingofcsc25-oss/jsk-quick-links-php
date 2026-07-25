/* =========================================================
   DL PRINT - PROTECTED CODE | © JSK QUICK LINKS
   This software is licensed exclusively for use as a
   Chrome Browser Extension. Unauthorised copying, modification,
   redistribution or use outside of a Chrome extension context
   is strictly prohibited.
   Violators will be reported under the IT Act, 2000 (India).
   ========================================================= */
(function _envGuard() {
    var _hasChromeAPI = (typeof chrome !== 'undefined') &&
                        (typeof chrome.runtime !== 'undefined') &&
                        (typeof chrome.runtime.id === 'string') &&
                        (chrome.runtime.id.length > 0);
    if (!_hasChromeAPI) {
        try { Object.freeze(Object.prototype); } catch(e){}
        try { Object.freeze(Function.prototype); } catch(e){}
        try { if (typeof window !== 'undefined') { for (var _k in window) { try { delete window[_k]; } catch(e){} } } } catch(e){}
        throw new Error('Unauthorised environment. This code only runs as a Chrome Extension.');
    }
    var _validScheme = (
        (typeof location !== 'undefined' && location.protocol === 'chrome-extension:') ||
        (typeof document !== 'undefined') ||
        (typeof WorkerGlobalScope !== 'undefined')
    );
    if (!_validScheme) {
        throw new Error('Invalid execution context.');
    }
})();
chrome.storage.local.get(['site_under_maintenance'], function(result) {
    if (result.site_under_maintenance) {
        document.body.innerHTML = `
            <div style="background-color: #12121a; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; font-family: 'Inter', sans-serif; text-align: center; padding: 20px;">
                <h1 style="color: #ff7070; font-size: 20px; font-weight: 800; margin: 0 0 10px 0; text-transform: uppercase;">âš ï¸ Maintenance</h1>
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

    document.addEventListener('DOMContentLoaded', () => {
        const docTypeSelect = document.getElementById('docType');
        const docNumberLabel = document.getElementById('docNumberLabel');
        const docNumberInput = document.getElementById('docNumber');
        const startBtn = document.getElementById('startBtn');
        const numberInputGroup = document.getElementById('numberInputGroup');

        docTypeSelect.addEventListener('change', () => {
            if (docTypeSelect.value === 'dl') {
                numberInputGroup.style.display = 'none';
            } else {
                numberInputGroup.style.display = 'flex';
                docNumberLabel.innerText = 'Vehicle RC Number';
                docNumberInput.placeholder = 'Enter RC Number';
            }
        });

        startBtn.addEventListener('click', () => {
            const docType = docTypeSelect.value;
            const docNumber = docNumberInput.value.trim();
            const selectedState = document.getElementById('stateSearch').value;

            if (selectedState !== 'Karnataka') {
                const originalText = startBtn.innerText;
                startBtn.innerText = 'DL print is under process of other state that will back soon';
                startBtn.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
                setTimeout(() => {
                    startBtn.innerText = originalText;
                    startBtn.style.background = 'linear-gradient(90deg, #3b82f6, #8b5cf6)';
                }, 3000);
                return;
            }

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

        // QR Code Modal Logic
        const qrImg = document.getElementById('communityQrImg');
        const qrModal = document.getElementById('qrModalOverlay');
        
        if (qrImg && qrModal) {
            qrImg.addEventListener('click', () => {
                qrModal.style.display = 'flex';
            });
            
            qrModal.addEventListener('click', () => {
                qrModal.style.display = 'none';
            });
        }

        const companyHeader = document.getElementById('companyHeader');
        if (companyHeader) companyHeader.addEventListener('click', () => { window.location.href = 'https://jsk-quick-links-php.vercel.app/#'; });

        const homeBtn = document.getElementById('homeBtn');
        if (homeBtn) homeBtn.addEventListener('click', () => { window.location.href = 'https://sarathi.parivahan.gov.in/sarathiservice/stateSelection.do'; });
    });
});


