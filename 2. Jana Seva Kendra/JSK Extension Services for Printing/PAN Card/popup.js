document.addEventListener('DOMContentLoaded', () => {
    // Check if agent is registered
    chrome.storage.local.get(['pan_agent_name', 'pan_agent_id', 'pan_wallet_points'], (data) => {
        if (data.pan_agent_name) {
            // Agent IS registered
            document.getElementById('displayAgentName').innerText = "Agent Name: " + data.pan_agent_name;
            document.getElementById('displayPanAgentId').innerText = "PAN ID: " + data.pan_agent_id;
            document.getElementById('walletPoints').innerText = data.pan_wallet_points || 0;
        } else {
            // Agent IS NOT registered -> Show Registration Modal, hide Dashboard
            document.getElementById('mainTitle').style.display = 'none';
            document.getElementById('mainDashboard').style.display = 'none';
            document.getElementById('statusContainer').style.display = 'none';
            document.getElementById('registration-panel').style.display = 'flex';
        }
    });

    // --- EVENT LISTENERS ---
    
    // Submenus and Modals Toggles
    const btnToggleNewPan = document.getElementById('btnToggleNewPan');
    if(btnToggleNewPan) btnToggleNewPan.addEventListener('click', (e) => { e.preventDefault(); toggleSubMenu('newPanSub'); });

    const btnToggleCorrectionPan = document.getElementById('btnToggleCorrectionPan');
    if(btnToggleCorrectionPan) btnToggleCorrectionPan.addEventListener('click', (e) => { e.preventDefault(); toggleSubMenu('correctionPanSub'); });

    const btnOpenManualPrint = document.getElementById('btnOpenManualPrint');
    if(btnOpenManualPrint) btnOpenManualPrint.addEventListener('click', (e) => { e.preventDefault(); openPANManualPrintModal(); });

    const btnToggleStatusPan = document.getElementById('btnToggleStatusPan');
    if(btnToggleStatusPan) btnToggleStatusPan.addEventListener('click', (e) => { e.preventDefault(); toggleSubMenu('statusPanSub'); });

    const btnCloseManualPrint = document.getElementById('btnCloseManualPrint');
    if(btnCloseManualPrint) btnCloseManualPrint.addEventListener('click', closePANManualPrintModal);

    const panManualPrintForm = document.getElementById('panManualPrintForm');
    if(panManualPrintForm) panManualPrintForm.addEventListener('submit', (e) => { e.preventDefault(); generateManualPANPDF(); });

    const btnClosePdfPreview1 = document.getElementById('btnClosePdfPreview1');
    if(btnClosePdfPreview1) btnClosePdfPreview1.addEventListener('click', closePdfPreviewModal);

    const btnClosePdfPreview2 = document.getElementById('btnClosePdfPreview2');
    if(btnClosePdfPreview2) btnClosePdfPreview2.addEventListener('click', closePdfPreviewModal);

    // Registration Buttons
    const btnSaveReg = document.getElementById('btnSaveRegistration');
    if(btnSaveReg) btnSaveReg.addEventListener('click', saveAgentRegistration);

    const btnContinue = document.getElementById('btnContinueToDashboard');
    if(btnContinue) btnContinue.addEventListener('click', finishRegistration);
    
    // Hover effect for gift box icon
    const giftBox = document.getElementById('giftBoxIcon');
    if(giftBox) {
        giftBox.addEventListener('mouseenter', () => giftBox.style.transform = 'scale(1.1)');
        giftBox.addEventListener('mouseleave', () => giftBox.style.transform = 'scale(1)');
    }
});

function toggleSubMenu(id) {
    const el = document.getElementById(id);
    if (el.style.display === 'flex') {
        el.style.display = 'none';
    } else {
        const subs = document.querySelectorAll('.sub-menu');
        subs.forEach(s => s.style.display = 'none');
        el.style.display = 'flex';
    }
}

function openPANManualPrintModal() {
    document.getElementById('panManualPrintModal').style.display = 'flex';
}

function closePANManualPrintModal() {
    document.getElementById('panManualPrintModal').style.display = 'none';
}

function closePdfPreviewModal() {
    document.getElementById('pdfPreviewModal').style.display = 'none';
    document.getElementById('pdfPreviewIframe').src = '';
}

async function generateManualPANPDF() {
    const generateBtn = document.getElementById('generatePdfBtn');
    const originalText = generateBtn.innerHTML;
    generateBtn.innerHTML = '⏳ Generating...';
    generateBtn.disabled = true;

    try {
        const panNumber = document.getElementById('panNumber').value.toUpperCase();
        const fullName = document.getElementById('fullName').value.toUpperCase();
        const parentName = document.getElementById('parentName').value.toUpperCase();
        const dob = document.getElementById('panDOB').value; 
        const gender = document.getElementById('panGender').value;
        const photoFile = document.getElementById('panPhoto').files[0];
        const signFile = document.getElementById('panSign').files[0];

        if(!panNumber || !fullName || !parentName || !dob || !photoFile || !signFile) {
            alert('Please fill all fields and upload both Photo and Signature.');
            generateBtn.innerHTML = originalText;
            generateBtn.disabled = false;
            return;
        }

        const dobParts = dob.split('-');
        const formattedDOB = `${dobParts[2]}/${dobParts[1]}/${dobParts[0]}`;

        const url = 'Emty PDF.pdf';
        const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());

        const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];

        const photoBytes = await photoFile.arrayBuffer();
        let photoImage;
        if(photoFile.type === 'image/png') photoImage = await pdfDoc.embedPng(photoBytes);
        else photoImage = await pdfDoc.embedJpg(photoBytes);

        const signBytes = await signFile.arrayBuffer();
        let signImage;
        if(signFile.type === 'image/png') signImage = await pdfDoc.embedPng(signBytes);
        else signImage = await pdfDoc.embedJpg(signBytes);

        const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

        const qrDataString = `Name: ${fullName}\nFather Name: ${parentName}\nDOB: ${formattedDOB}\nPAN: ${panNumber}`;
        const qrDataUrl = await QRCode.toDataURL(qrDataString, { width: 400, margin: 0 });
        const qrImageBytes = await fetch(qrDataUrl).then(res => res.arrayBuffer());
        const qrImage = await pdfDoc.embedPng(qrImageBytes);

        const c = {
            fontTable: 11, fontCardBig: 7, fontCardSmall: 6,
            topPanX: 250, topPanY: 735,
            tableX: 175, 
            tableNameY: 638, tableParentY: 593, tableDobY: 548, tableGenderY: 498,
            midPhotoX: 50, midPhotoY: 300, midPhotoW: 75, midPhotoH: 95,
            midSignX: 160, midSignY: 280, midSignW: 80, midSignH: 25,
            bigQrX: 380, bigQrY: 300, bigQrW: 90, bigQrH: 90,
            checkTextX: 475, checkTextY: 380,
            cardPhotoX: 40, cardPhotoY: 60, cardPhotoW: 42, cardPhotoH: 52,
            cardNameX: 90, cardNameY: 85,
            cardParentX: 90, cardParentY: 75,
            cardDobX: 90, cardDobY: 65,
            cardSignX: 105, cardSignY: 35, cardSignW: 55, cardSignH: 15,
            cardPanX: 135, cardPanY: 150,
            smallQrX: 235, smallQrY: 85, smallQrW: 50, smallQrH: 50
        };

        firstPage.drawText(panNumber, { x: c.topPanX, y: c.topPanY, size: 14, font: font });

        firstPage.drawText(fullName, { x: c.tableX, y: c.tableNameY, size: c.fontTable, font: font });
        firstPage.drawText(parentName, { x: c.tableX, y: c.tableParentY, size: c.fontTable, font: font });
        firstPage.drawText(formattedDOB, { x: c.tableX, y: c.tableDobY, size: c.fontTable, font: font });
        firstPage.drawText(gender, { x: c.tableX, y: c.tableGenderY, size: c.fontTable, font: font });

        firstPage.drawImage(photoImage, { x: c.midPhotoX, y: c.midPhotoY, width: c.midPhotoW, height: c.midPhotoH });
        firstPage.drawImage(signImage, { x: c.midSignX, y: c.midSignY, width: c.midSignW, height: c.midSignH });
        firstPage.drawImage(qrImage, { x: c.bigQrX, y: c.bigQrY, width: c.bigQrW, height: c.bigQrH });

        firstPage.drawText("Signature valid", { x: c.checkTextX, y: c.checkTextY, size: 12, font: font });
        firstPage.drawText("Digitally signed by", { x: c.checkTextX, y: c.checkTextY - 15, size: 6, font: font });
        firstPage.drawText("Income Tax Dept.", { x: c.checkTextX, y: c.checkTextY - 22, size: 6, font: font });
        const today = new Date();
        const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')} 12:35 IST`;
        firstPage.drawText(`Date: ${dateStr}`, { x: c.checkTextX, y: c.checkTextY - 29, size: 6, font: font });
        const checkPath = 'M0,15 L5,20 L15,0 L18,2 L5,25 L-3,17 Z';
        firstPage.drawSvgPath(checkPath, { x: c.checkTextX + 20, y: c.checkTextY - 45, scale: 1.5, color: PDFLib.rgb(0, 0.7, 0) });

        firstPage.drawImage(photoImage, { x: c.cardPhotoX, y: c.cardPhotoY, width: c.cardPhotoW, height: c.cardPhotoH });
        firstPage.drawText(fullName, { x: c.cardNameX, y: c.cardNameY, size: c.fontCardBig, font: fontBold });
        firstPage.drawText(parentName, { x: c.cardParentX, y: c.cardParentY, size: c.fontCardSmall, font: font });
        firstPage.drawText(formattedDOB, { x: c.cardDobX, y: c.cardDobY, size: c.fontCardSmall, font: fontBold });
        firstPage.drawImage(signImage, { x: c.cardSignX, y: c.cardSignY, width: c.cardSignW, height: c.cardSignH });
        
        firstPage.drawText(panNumber, { x: c.cardPanX, y: c.cardPanY, size: 12, font: fontBold });
        firstPage.drawImage(qrImage, { x: c.smallQrX, y: c.smallQrY, width: c.smallQrW, height: c.smallQrH });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(blob);
        
        document.getElementById('pdfPreviewIframe').src = pdfUrl;
        
        document.getElementById('pdfDownloadBtn').onclick = () => {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = `PAN_${panNumber}.pdf`;
            link.click();
        };
        // wait, I still have an onclick here. Let's fix this too, it's safer.
        document.getElementById('pdfDownloadBtn').addEventListener('click', () => {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = `PAN_${panNumber}.pdf`;
            link.click();
        });
        
        closePANManualPrintModal();
        document.getElementById('panManualPrintForm').reset();
        generateBtn.innerHTML = originalText;
        generateBtn.disabled = false;
        
        document.getElementById('pdfPreviewModal').style.display = 'flex';

    } catch(err) {
        console.error(err);
        alert("Error generating PDF: " + err.message);
        generateBtn.innerHTML = originalText;
        generateBtn.disabled = false;
    }
}

function saveAgentRegistration() {
    const agentName = document.getElementById('regAgentName').value.trim();
    const agentMob = document.getElementById('regAgentMob').value.trim();
    let agentIdInput = document.getElementById('regAgentId').value.trim();

    if (!agentName || !agentMob) {
        alert("Please fill in both Agent Name and Mobile Number!");
        return;
    }

    const btnSaveReg = document.getElementById('btnSaveRegistration');
    btnSaveReg.innerText = "Saving...";

    if (!agentIdInput) {
        agentIdInput = "PAN-" + Math.floor(1000 + Math.random() * 9000);
    }

    const dataToSave = {
        pan_agent_id: agentIdInput,
        pan_agent_name: agentName,
        pan_agent_mob: agentMob,
        pan_wallet_points: 40
    };

    chrome.storage.local.set(dataToSave, () => {
        document.getElementById('registration-panel').style.display = 'none';
        document.getElementById('reg-success-modal').style.display = 'flex';
    });
}

function finishRegistration() {
    window.location.reload();
}
