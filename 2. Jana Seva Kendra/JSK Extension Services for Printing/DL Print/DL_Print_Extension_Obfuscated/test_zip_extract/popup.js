chrome.storage.local.get(['site_under_maintenance'], function(result) {
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
    });
});
