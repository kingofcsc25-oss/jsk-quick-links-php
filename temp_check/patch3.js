const fs = require('fs');
let file = 'f:\\Google\\Completed Extension work\\RC Print_Backup_Source_Code\\content.js';
let content = fs.readFileSync(file, 'utf8');

// The issue is that I injected ${showExtraPvcBoxes ? ` ... but didn't close it with `} at the end of the new blocks.
// Let's find the unclosed blocks and close them.

// For the left column (Front):
// It ends around <!-- RIGHT COLUMN -->
let rightColStart = content.indexOf('<!-- RIGHT COLUMN -->');
if (rightColStart !== -1) {
    // Look backwards for the last </div> in the left column
    let lastDivBeforeRightCol = content.lastIndexOf('</div>', rightColStart);
    if (lastDivBeforeRightCol !== -1) {
        // Insert `} after it
        content = content.substring(0, lastDivBeforeRightCol + 6) + '\n                `}' + content.substring(lastDivBeforeRightCol + 6);
    }
}

// For the right column (Back):
// It ends just before </div>\n        </div>\n    `;\n\n\n\n        // Hide original and inject
let hideOriginalStart = content.indexOf('// Hide original and inject');
if (hideOriginalStart !== -1) {
    let lastDivBeforeHide = content.lastIndexOf('</div>', hideOriginalStart);
    // Actually, the structure at the end of wrapper is:
    //             </div>
    //         </div>
    //     `;
    let wrapperEnd = content.indexOf('    `;', hideOriginalStart - 100);
    if (wrapperEnd !== -1) {
        // find the closing </div> of lc-box-6
        let box6 = content.indexOf('id="lc-box-6"');
        if (box6 !== -1) {
             let endOfBox6 = content.indexOf('<!-- BOTTOM BACK CARD -->', box6); // doesn't exist
             // Let's just find the last </div> before `    </div>\n        </div>\n    `;`
             // Actually, a safer way is to just do a string replacement of the exact missing closure.
             
             // Wait, I can just find `id="lc-box-5"` block and append `}` at the end of it.
        }
    }
}
// This is getting complicated to patch automatically without breaking something else.
