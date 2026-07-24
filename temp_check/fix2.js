const fs = require('fs');
let file = 'f:\\Google\\Completed Extension work\\RC Print_Backup_Source_Code\\content.js';
let content = fs.readFileSync(file, 'utf8');

// The user wants to revert to the exact state before we started "Long with PVC Card" work.
// This means removing showExtraPvcBoxes and reverting to exactly 4 boxes.

let hideLines = `        let hideLongBoxes = cardFormat === "PVC Card" || cardFormat === "Normal with PVC";
        let showExtraPvcBoxes = cardFormat === "Long With PVC";
        let hidePvcBoxes = cardFormat === "Long Card";`;

let originalHideLines = `        let hideLongBoxes = cardFormat === "PVC Card" || cardFormat === "Normal with PVC";
        let hidePvcBoxes = false;`;

content = content.replace(hideLines, originalHideLines);

let startIndex = content.indexOf('wrapper.innerHTML = `');
let endIndex = content.indexOf('`;\n\n\n\n        // Hide original and inject');
if (startIndex !== -1 && endIndex !== -1) {
    let before = content.substring(0, startIndex);
    let after = content.substring(endIndex);
    
    let newHTML = `wrapper.innerHTML = \`
        <style>
            .lc-card { \${(cardFormat === "PVC Card" || cardFormat === "Normal with PVC") ? '' : 'border: 1px solid #000 !important;'} }
            @media print {
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
        </style>
        <div class="lc-page">
            <!-- LEFT COLUMN -->
            <div class="lc-col lc-left">
                
                \${hideLongBoxes ? '' : \`
                <!-- TOP FRONT CARD -->
                <div id="lc-box-1" class="lc-card" style="height: auto; min-height: 0; flex-grow: 1; flex-shrink: 0; flex-direction: column;">
                    <div class="lc-header">
                        \${headerHtml}
                    </div>
                    <div class="lc-rc-bar" style="padding:3px;">
                        <b style="font-size:14px; display:block; line-height:1.2;">ಪಡಿತರ ಚೀಟಿಯ ಸಂಖ್ಯೆ / Ration Card No. :<br>\${rcNumber}</b>
                        <div style="font-size:9px; font-weight:bold; color:#222; margin-top:4px; display:flex; justify-content:space-between; padding:0 4px;">
                            <span>ಜಿಲ್ಲೆ:</span>
                            <span>ತಾಲ್ಲೂಕು:</span>
                        </div>
                    </div>

                    <div class="lc-front-content" style="position:relative; display:flex; flex-direction:column; padding: 15px 10px; gap: 8px; flex-grow: 1;">
                        
                        <!-- Top Row: Photo and Name -->
                        <div style="display:flex;">
                            <!-- Left Column -->
                            <div style="width:90px; text-align:center; z-index:2; flex-shrink:0;">
                                \${isNoPhoto ? \`
                                    <div style="width:70px; height:90px; border:1px solid #ccc; background:#eee; margin:0 auto;"></div>
                                    <div style="font-size:8px; font-weight:bold; color:#666; margin-top:4px;">NO PHOTO</div>
                                \` : \`
                                    <div style="width:70px; height:90px; border:1px solid #ccc; background:#eee; margin:0 auto; overflow:hidden;">
                                        <img src="\${headPhotoSrc}" style="width:100%; height:100%; object-fit:cover; display:block; border:none;" onerror="this.style.opacity='0'; this.parentNode.nextElementSibling.style.display='block';">
                                    </div>
                                    <div style="font-size:8px; font-weight:bold; color:#666; margin-top:4px; display:none;">NO PHOTO</div>
                                \`}
                            </div>
                            
                            <!-- Right Column for Name -->
                            <div style="padding-left:15px; padding-top:25px; line-height:1.8; z-index:2; text-align:left; flex-grow:1; padding-right:40px;">
                                <b style="font-size:9px;">\${cleanHeadNameKn || 'Name Kannada'}</b><br>
                                <b style="font-size:9px;">\${headNameEn || 'Name English'}</b><br>
                                <b style="font-size:9px;">ವಯಸ್ಸು Age: \${headAgeKn.match(/\\d+/) ? headAgeKn.match(/\\d+/)[0] : ""}</b>
                            </div>
                        </div>

                        <!-- Middle Row: Address + QR -->
                        <div style="display:flex; justify-content: space-between; align-items: flex-start; z-index:2; padding-right: 45px; margin-top: 5px;">
                            <!-- Address Block -->
                            <div class="lc-address-block" style="text-align:left; flex-grow:1; word-wrap: break-word; padding-right:15px;">
                                <b style="font-size:9px;">To : \${headNameEn ? headNameEn : ''} \${headAgeKn ? '/ ' + headAgeKn : ''}</b><br>
                                \${addressKn ? \`<div style="font-size:8px; margin-top:4px; font-weight:bold;">\${addressKn}</div>\` : ''}
                                <div style="font-size:8px; margin-top:4px; font-weight:bold;">\${addressEn}</div>
                            </div>
                            
                            <!-- QR Code -->
                            <div style="width:75px; flex-shrink:0; display:flex; flex-direction:column; align-items:center;">
                                <img src="\${qrUrl}" style="width:75px; height:75px; border:1px solid #ddd; padding:2px; box-sizing:border-box;">
                                <div style="margin-top:4px; font-size:7px; font-weight:bold; color:#111; text-align:center; line-height:1.2; width:100%;">Issue Date<br>\${issueDateStr}</div>
                            </div>
                        </div>
                        
                        <!-- Bottom Row: Fair Price Shop Block -->
                        <div class="lc-info-block" style="text-align:left; z-index:2; margin-top: auto; padding-right: 45px; word-wrap: break-word;">
                            <b style="font-size:7.5px; white-space:nowrap;">ನ್ಯಾಯಬೆಲೆ ಅಂಗಡಿಯ ಸಂಖ್ಯೆ ಮತ್ತು ಹೆಸರು</b><br>
                            <span style="font-size:7.5px; white-space:nowrap;">Fair Price Shop No.& Name</span><br>
                            <div style="font-size:7.5px; margin-top:3px; font-weight:bold; line-height:1.2;">\${fpsKn || 'Shop No in Kannada'}</div>
                            <div style="font-size:7.5px; font-weight:bold; line-height:1.2;">\${fpsEn || 'Shop No in English'}</div>
                        </div>
                        
                        <!-- Vertical Text Banner -->
                        <div class="vertical-banner" style="position:absolute; right: 0.3cm; top: 15px; height: calc(100% - 30px);">
                            <span style="font-size:11px;">\${verticalText}</span>
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
                \`}
                \${hidePvcBoxes ? '' : \`
                <!-- BOTTOM FRONT CARD -->
                <div id="lc-box-3" class="lc-card" style="height: 55mm; overflow: hidden; max-height: 55mm; flex-shrink: 0; flex-direction:column;">
                    <div class="lc-header" style="padding:6px; flex-shrink:0;">
                        \${headerHtmlSmall}
                    </div>
                    <div class="lc-rc-bar" style="padding:2px; flex-shrink:0; text-align:center; line-height:1.1;">
                        <b style="font-size:9px; white-space:nowrap; display:block;">ಪಡಿತರ ಚೀಟಿಯ ಸಂಖ್ಯೆ / Ration Card No. : \${rcNumber}</b>
                        \${authAadhar ? \`<b style="font-size:8px; white-space:nowrap; display:block; margin-top:0.1cm;">ಆಧಾರ್ ಸಂಖ್ಯೆ / Aadhar No : \${authAadhar}</b>\` : ''}
                    </div>
                    <div class="lc-front-content" style="flex-grow:1; padding:2px 2px 2px 2px; display:flex; flex-direction:column; justify-content:flex-start; gap: 1px; box-sizing:border-box; position:relative;">
                        <div style="display:flex;">
                            <div style="width:50px; text-align:center;">
                                \${isNoPhoto ? \`
                                    <div style="width:45px; height:55px; border:1px solid #ccc; background:#eee; margin:0 auto;"></div>
                                    <div style="font-size:5px; font-weight:bold; color:#666; margin-top:2px;">NO PHOTO</div>
                                \` : \`
                                    <div style="width:45px; height:55px; border:1px solid #ccc; background:#eee; margin:0 auto; overflow:hidden;">
                                        <img src="\${headPhotoSrc}" style="width:100%; height:100%; object-fit:cover; display:block; border:none;" onerror="this.style.opacity='0'; this.parentNode.nextElementSibling.style.display='block';">
                                    </div>
                                    <div style="font-size:5px; font-weight:bold; color:#666; margin-top:2px; display:none;">NO PHOTO</div>
                                \`}
                            </div>
                            <div style="padding-left:10px; padding-top:5px; line-height:1.2; text-align:left; flex-grow:1; padding-right:85px;">
                                <b style="font-size:7.5px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">\${cleanHeadNameKn || 'Name Kannada'}</b>
                                <b style="font-size:7.5px; display:block; margin-top:0.1cm; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">\${headNameEn || 'Name English'}</b>
                                <span style="font-size:7px; display:block; margin-top:0.1cm;">ವಯಸ್ಸು Age: \${headAgeKn.match(/\\d+/) ? headAgeKn.match(/\\d+/)[0] : ""}</span>
                            </div>
                        </div>
                        <div style="text-align:left; font-size:\${cardTypeEnText.length > 35 ? '5.2px' : '6.5px'}; font-weight:bold; line-height:1.3; margin-top:0.1cm; flex-grow:1; padding-right:85px; word-wrap:break-word;">
                            \${cardTypeKnText}<br>
                            \${cardTypeEnText}<br>
                            <span style="background-color:\${addressBg}; border:1px solid \${addressBorder}; padding:1px 3px; border-radius:2px; display:inline-block; margin: 1px 0;">ಸದಸ್ಯರ ಸಂಖ್ಯೆ / Family Members : \${displayMemberCount}</span><br>
                            <span style="font-size:5.5px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">\${fpsKn || 'Shop No in Kannada'}</span>
                            <span style="font-size:5.5px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">\${fpsEn || 'Shop No in English'}</span>
                        </div>
                        <div style="position:absolute; right:10px; top:15px; width:75px; display:flex; flex-direction:column; align-items:center;">
                            <img src="\${qrUrl}" style="width:75px; height:75px; border:1px solid #ddd; padding:2px; box-sizing:border-box;">
                            \${isPvc ? \`<div style="margin-top:4px; font-size:5.5px; font-weight:bold; color:#111; text-align:center; line-height:1.2; width:100%;">Issue Date<br>\${issueDateStr}</div>\` : ''}
                        </div>
                        \${isPvc ? \`<div style="position:absolute; bottom:5px; right:10px; font-weight:bold; font-size:6px; color:red; border:1px solid red; padding:1px 3px; border-radius:2px; z-index:2; text-align:center;">\${displayCardType}</div>\` : ''}
                    </div>
                </div>
                \`}
            </div>

            <!-- RIGHT COLUMN -->
            <div class="lc-col lc-right">
                
                \${hideLongBoxes ? '' : \`
                <!-- TOP BACK CARD -->
                <div id="lc-box-2" class="lc-card" style="height: auto; min-height: 0; flex-grow: 1; flex-shrink: 0; flex-direction: column;">
                    <div class="lc-header" style="padding:6px;">
                        \${headerHtmlSmall}
                    </div>
                    <div style="padding:2px 10px 10px 10px; flex-grow: 1; display:flex; flex-direction:column; justify-content:flex-start; box-sizing:border-box; position:relative;">
                        <div style="display:flex; align-items:flex-start;">
                            <table style="width:100%; border-collapse:collapse; margin-top:0px; table-layout:fixed; word-wrap:break-word;">
                                <thead>
                                    <tr>
                                        <th style="width:6%;"></th>
                                        <th style="width:12%;"></th>
                                        <th style="width:30%; font-size:6px; padding:4px; border-bottom:1px solid #000; text-align:left; white-space:nowrap;">ಹೆಸರು<br>Name</th>
                                        <th style="width:14%; font-size:6px; padding:4px; border-bottom:1px solid #000; text-align:center; white-space:nowrap;">ಸಂಬಂಧ<br>Relationship</th>
                                        <th style="width:10%; font-size:6px; padding:4px; border-bottom:1px solid #000; text-align:center; white-space:nowrap;">ವಯಸ್ಸು<br>Age</th>
                                        <th style="width:28%; font-size:6px; padding:4px; border-bottom:1px solid #000; text-align:center; white-space:nowrap;">ಆಧಾರ್ ಸಂಖ್ಯೆ<br>Aadhaar No.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    \${membersRows.join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div style="flex-shrink:0; margin-top:auto; margin-bottom:5px; padding-right:15px; font-size:4px; text-align:justify; color:#333; font-weight:bold; line-height:1.4;">
                            ಸೂಚನೆ: "ಖಾಯಂ ಸರ್ಕಾರಿ ನೌಕರರು ಅಥವಾ ಯಾವುದೇ ತೆರಿಗೆ ಪಾವತಿಸುವ, ಮೋಟು ಚಕ್ರವುಳ್ಳ ವಾಹನ ಹೊಂದಿರುವ ಕುಟುಂಬಗಳು ಈ ಕಾರ್ಡ್ ಪಡೆಯಲು ಅರ್ಹರಲ್ಲ. 1,000 ಚ.ಅಡಿಗಿಂತ ಹೆಚ್ಚಿನ ಮನೆಯನ್ನು ಹೊಂದಿರುವ, ಒಂದು ಟ್ರ್ಯಾಕ್ಟರ್ / ಮ್ಯಾಕ್ಸಿಕ್ಯಾಬ್ / ಟ್ಯಾಕ್ಸಿಯನ್ನು ಬಿಟ್ಟು 4 ಚಕ್ರದ ವಾಹನಗಳನ್ನು ಹೊಂದಿರುವ, ಮಾಸಿಕ 150 ಯೂನಿಟ್‌ಗಿಂತ ಹೆಚ್ಚಿನ ವಿದ್ಯುತ್ ಬಳಕೆ." ನಿಮ್ಮ ಕುಟುಂಬಕ್ಕೆ ಅಥವಾ ಯಾವುದೇ ಸದಸ್ಯರಿಗೆ ಈ ಅಂಶಗಳು ಅನ್ವಯಿಸುವುದಿಲ್ಲ ಎಂಬ ನಿಮ್ಮ ಸ್ವಯಂ-ಘೋಷಣೆ ಪತ್ರದ ಸಾಲಿಕೆಯಲ್ಲಿ ಬಿ.ಪಿ.ಎಲ್. ರದ್ದುಪಡಿಸುವುದರ ಜೊತೆಗೆ ಕ್ರಿಮಿನಲ್ ಮೊಕದ್ದಮೆಗೆ ಅರ್ಹರಾಗುತ್ತೀರಿ.
                        </div>
                        <div style="position:absolute; bottom:5px; right:10px; font-weight:bold; font-size:6px; color:red; border:1px solid red; padding:1px 3px; border-radius:2px;">\${displayCardType}</div>
                    </div>
                </div>
                
                <!-- CUT LINE -->
                <div class="lc-cut-line" style="width: 100%; border-top: 1px dashed #666; margin: 2.5mm 0; position: relative;">
                    <span style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #444; background: white; padding: 0 4px;">&#x2702;</span>
                </div>
                \`}
                \${hidePvcBoxes ? '' : \`
                <!-- BOTTOM BACK CARD -->
                <div id="lc-box-4" class="lc-card" style="height: 55mm; overflow: hidden; max-height: 55mm; flex-shrink: 0;">
                    <div style="height:100%; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box;">
                        <div style="flex-grow:1; display:flex; align-items:flex-start; overflow:hidden; padding:1px 10px 1px 10px;">
                            <table style="width:100%; border-collapse:collapse; margin-top:0px; table-layout:fixed; word-wrap:break-word;">
                                <thead>
                                    <tr>
                                        \${(cardFormat === "PVC Card" || cardFormat === "Normal with PVC") ? finalHeaders : pvcHeaders}
                                    </tr>
                                </thead>
                                <tbody>
                                    \${(cardFormat === "PVC Card" || cardFormat === "Normal with PVC") ? finalMembersRows.join('') : membersRowsNoPhoto.join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="lc-address-block" style="flex-shrink:0; background:\${addressBg}; border-top:1px solid \${addressBorder}; padding:3px 10px; font-size:5.5px; font-weight:bold; text-align:left; margin-top:0; display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="flex-grow:1;">
                                <div style="margin-bottom:1px;">ವಿಳಾಸ:</div>
                                <div style="margin-bottom:2px;">\${addressKn}</div>
                                <div style="margin-bottom:1px;">Address:</div>
                                <div>\${addressEn}</div>
                            </div>
                            <div style="flex-shrink:0; text-align:right; padding-left:6px; white-space:nowrap; align-self:flex-start;">
                                <span>ಜಿಲ್ಲೆ:</span>&nbsp;&nbsp;&nbsp;<span>ತಾಲ್ಲೂಕು:</span>
                            </div>
                        </div>
                    </div>
                </div>
                \`}
            </div>
        </div>`;
    
    fs.writeFileSync(file, before + newHTML + after);
    console.log("Fixed cleanly back to 4 boxes!");
} else {
    console.log("Could not find start/end bounds.");
}
