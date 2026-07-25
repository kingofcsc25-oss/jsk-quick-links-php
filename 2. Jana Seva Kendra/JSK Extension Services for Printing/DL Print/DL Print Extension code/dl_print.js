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
document.addEventListener('DOMContentLoaded', () => {
    // Print button listener (opens default system printing options)
    document.getElementById('printBtn').addEventListener('click', () => {
        window.print();
    });

    // Go back to Sarathi portal after print/cancel dialog is closed
    window.addEventListener('afterprint', () => {
        setTimeout(() => {
            window.location.href = "https://sarathi.parivahan.gov.in/sarathiservice/stateSelection.do";
        }, 1000);
    });

    // Retrieve the extracted data from storage
    chrome.storage.local.get(['print_dl_data'], (res) => {
        if (res.print_dl_data) {
            const data = res.print_dl_data;
            
            // Populate basic fields
            document.getElementById('p-dl').innerText = data.dlNumber || 'NA';
            document.getElementById('p-doi').innerText = data.doi || 'NA';
            document.getElementById('p-name').innerText = data.name || 'NA';
            document.getElementById('p-dob').innerText = data.dob || 'NA';
            // B.G. â€” show row only if real data found (not NA, not empty)
            const bgVal = (data.bg || '').trim();
            const bgRow = document.getElementById('bg-row');
            const bgEl = document.getElementById('p-bg');
            if (bgVal && bgVal.toUpperCase() !== 'NA' && bgVal !== '-') {
                if (bgEl) bgEl.innerText = bgVal;
                if (bgRow) bgRow.style.display = 'table-row';
            } else {
                if (bgRow) bgRow.style.display = 'none';
            }

            
            let vtNt = data.validTillNt || 'NA';
            let vtTr = data.validTillTr || 'NA';
            
            let leftValid = '';
            let rightValid = '';
            
            if (vtNt !== 'NA' && vtNt !== 'NA(NT)') {
                leftValid = vtNt;
                if (vtTr !== 'NA' && vtTr !== 'NA(TR)') {
                    rightValid = vtTr;
                }
            } else if (vtTr !== 'NA' && vtTr !== 'NA(TR)') {
                leftValid = vtTr;
            } else {
                leftValid = 'NA';
            }
            
            document.getElementById('p-valid-till-nt').innerText = leftValid;
            
            let trRow = document.getElementById('valid-till-tr-row');
            if (rightValid !== '') {
                document.getElementById('p-valid-till-tr').innerText = rightValid;
                if(trRow) trRow.style.display = 'table-row';
            } else {
                if(trRow) trRow.style.display = 'none';
            }

            // Set document title to DL Number so that "Save as PDF" uses it as default filename
            if (data.dlNumber) {
                document.title = data.dlNumber;
            }
            
            document.getElementById('p-co').innerText = data.co || 'NA';
            document.getElementById('p-address').innerText = data.address || 'NA';
            
            // Set Images
            if (data.photoUrl) document.getElementById('p-photo').src = data.photoUrl;
            if (data.signUrl) document.getElementById('p-sign').src = data.signUrl;
            
            // RTO parsing (extract from DL Number like KA37)
            let rtoCode = data.dlNumber ? data.dlNumber.substring(0, 4) : 'RTO';
            const rtoMap = {
                'KA01': 'Koramangala', 'KA02': 'Rajajinagar', 'KA03': 'Indiranagar', 'KA04': 'Yeshwanthpur', 
                'KA05': 'Jayanagar', 'KA06': 'Tumkur', 'KA07': 'Kolar', 'KA08': 'K.G.F', 'KA09': 'Mysuru', 
                'KA10': 'Chamarajanagar', 'KA11': 'Mandya', 'KA12': 'Madikeri', 'KA13': 'Shivamogga', 
                'KA14': 'Chitradurga', 'KA15': 'Udupi', 'KA16': 'Mangaluru', 'KA17': 'Davangere', 
                'KA18': 'Chikkamagaluru', 'KA19': 'Mangaluru', 'KA20': 'Udupi', 'KA21': 'Puttur', 
                'KA22': 'Belagavi', 'KA23': 'Chikkodi', 'KA24': 'Bailhongal', 'KA25': 'Dharwad', 
                'KA26': 'Gadag', 'KA27': 'Haveri', 'KA28': 'Vijayapura', 'KA29': 'Bagalkot', 
                'KA30': 'Karwar', 'KA31': 'Sirsi', 'KA32': 'Kalaburagi', 'KA33': 'Yadgir', 'KA34': 'Ballari', 
                'KA35': 'Hosapete', 'KA36': 'Raichur', 'KA37': 'Koppal', 'KA38': 'Bidar', 'KA39': 'Bhalki', 
                'KA40': 'Chikkaballapura', 'KA41': 'Ramanagara', 'KA42': 'Kanakapura', 'KA43': 'Devanahalli', 
                'KA44': 'Tiptur', 'KA45': 'Hunsur', 'KA46': 'Sakleshpur', 'KA47': 'Honnavar', 'KA48': 'Jamkhandi', 
                'KA49': 'Gokak', 'KA50': 'Yelahanka', 'KA51': 'Electronic City', 'KA52': 'Nelamangala', 
                'KA53': 'K.R.Puram', 'KA54': 'Nagamangala', 'KA55': 'Mysuru', 'KA56': 'Basavakalyan', 
                'KA57': 'Shantinagar', 'KA58': 'Banthwal', 'KA59': 'Chamrajpet', 'KA60': 'R.T.Nagar', 
                'KA61': 'Marathahalli', 'KA62': 'Surathkal', 'KA63': 'Hubballi', 'KA64': 'Madhugiri', 
                'KA65': 'Dandeli', 'KA66': 'Tarikere', 'KA67': 'Chintamani', 'KA68': 'Ranebennur', 
                'KA69': 'Ramdurg', 'KA70': 'Bantwal', 'KA71': 'Athani'
            };
            let rtoName = rtoMap[rtoCode] ? ` ${rtoMap[rtoCode].toUpperCase()}` : '';
            document.getElementById('p-rto').innerText = rtoCode + rtoName;
            
            let frontRtoEl = document.getElementById('front-rto-name');
            if (frontRtoEl) frontRtoEl.innerText = rtoCode + rtoName;
            
            // CDOI usually matches DOI but formatted with month in words
            let cdoiStr = data.doi || 'NA';
            if (cdoiStr !== 'NA') {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                let parts = cdoiStr.split('-');
                if (parts.length === 3) {
                    let m = parseInt(parts[1], 10);
                    if (m >= 1 && m <= 12) {
                        cdoiStr = `${parts[0]}-${months[m-1]}-${parts[2]}`;
                    }
                }
            }
            document.getElementById('p-cdoi').innerText = cdoiStr;
            
            // Populate COV
            let covList = document.getElementById('p-cov-list');
            covList.innerHTML = '';
            
            // Extract the Transport Start Date (from the TR range) if it exists
            let trStartDate = '';
            if (data.validTillTr && data.validTillTr !== 'NA') {
                trStartDate = data.trStartDate || data.doi;
            }

            let hasTrans = false;

            if (data.covs && data.covs.length > 0) {
                // Sort COVs so that TRANS / TRG is always first in the list
                let sortedCovs = [...data.covs].sort((a, b) => {
                    let aIsTrans = a.cov && (a.cov.toUpperCase().includes('TRANS') || a.cov.toUpperCase() === 'TRG');
                    let bIsTrans = b.cov && (b.cov.toUpperCase().includes('TRANS') || b.cov.toUpperCase() === 'TRG');
                    if (aIsTrans && !bIsTrans) return -1;
                    if (!aIsTrans && bIsTrans) return 1;
                    return 0;
                });

                let tableHtml = '<table style="margin: 0 auto; border-collapse: collapse; text-align: left;">';
                sortedCovs.forEach((cov, index) => {
                    let prefix = index === 0 ? 'COV :' : ':';
                    let isTransClass = cov.cov && (cov.cov.toUpperCase().includes('TRANS') || cov.cov.toUpperCase() === 'TRG');
                    if (isTransClass) {
                        hasTrans = true;
                    }
                    
                    let issueDate = cov.issueDate;
                    if (isTransClass && trStartDate) {
                        // Use the extracted Transport Start Date for TRANS COV
                        issueDate = trStartDate;
                    } else if (issueDate.includes('RTO') || issueDate.trim() === '') {
                        issueDate = data.doi;
                    }
                    
                    tableHtml += `<tr>
                                    <td style="text-align: right; padding-right: 3px;">${prefix}</td>
                                    <td style="padding-right: 5px;">${cov.cov}</td>
                                    <td>${issueDate}</td>
                                  </tr>`;
                });
                tableHtml += '</table>';
                covList.innerHTML = tableHtml;
            } else {
                covList.innerHTML = '<div>COV : NA</div>';
            }

            // BADGE NO â€” show row if real badge number found OR if TRANS class exists (even if empty, show NA)
            const badgeVal = (data.badge || '').trim();
            const badgeRow = document.getElementById('badge-row');
            const badgeEl = document.getElementById('p-badge');
            const trRowBottom = document.getElementById('valid-till-tr-row');
            
            if ((badgeVal && badgeVal.toUpperCase() !== 'NA' && badgeVal !== '-') || hasTrans) {
                if (badgeEl) badgeEl.innerText = (badgeVal && badgeVal.toUpperCase() !== 'NA' && badgeVal !== '-') ? badgeVal : 'NA';
                if (badgeRow) badgeRow.style.display = 'table-row';
                if (trRowBottom) trRowBottom.style.display = 'table-row';
            } else {
                if (badgeRow) badgeRow.style.display = 'none';
                if (trRowBottom) trRowBottom.style.display = 'none';
            }
        }
    });
});


