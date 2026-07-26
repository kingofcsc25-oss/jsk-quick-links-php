document.addEventListener('DOMContentLoaded', () => {
    // Add print button listener (Manifest V3 CSP compliant)
    document.getElementById('printBtn').addEventListener('click', () => {
        window.print();
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
            document.getElementById('p-bg').innerText = data.bg || 'NA';
            
            let badgeEl = document.getElementById('p-badge');
            let badgeRow = document.getElementById('badge-row');
            if (data.badge && data.badge.trim() !== '' && data.badge.toUpperCase() !== 'NA') {
                if(badgeEl) badgeEl.innerText = data.badge;
                if(badgeRow) badgeRow.style.display = 'table-row';
            } else {
                if(badgeRow) badgeRow.style.display = 'none';
            }
            
            let vtNt = data.validTillNt || 'NA';
            let vtTr = data.validTillTr || 'NA';
            let vtArr = [];
            if (vtNt !== 'NA' && vtNt !== 'NA(NT)') vtArr.push(vtNt);
            if (vtTr !== 'NA' && vtTr !== 'NA(TR)') vtArr.push(vtTr);
            document.getElementById('p-valid-till').innerText = vtArr.length > 0 ? vtArr.join(', ') : 'NA';
            
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
            if (data.covs && data.covs.length > 0) {
                let tableHtml = '<table style="margin: 0 auto; border-collapse: collapse; text-align: left;">';
                data.covs.forEach((cov, index) => {
                    let prefix = index === 0 ? 'COV :' : ':';
                    
                    let issueDate = cov.issueDate;
                    if (issueDate.includes('RTO') || issueDate.trim() === '') {
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
        }
    });
});
