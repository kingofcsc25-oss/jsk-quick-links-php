const fs = require('fs');
let file = 'f:\\Google\\Completed Extension work\\RC Print_Backup_Source_Code\\content.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the Large Box duplication (from my previous patch)
// The previous patch added <!-- AGENT COPY CUT LINE --> and id="lc-box-1-copy" / id="lc-box-2-copy"
// I will just find the blocks starting from <!-- AGENT COPY CUT LINE --> to the end of lc-box-1-copy/lc-box-2-copy and remove them.

let leftAgentStart = content.indexOf('<!-- AGENT COPY CUT LINE -->');
if (leftAgentStart !== -1) {
    let nextCutLine = content.indexOf('<!-- CUT LINE -->', leftAgentStart + 1);
    if (nextCutLine !== -1) {
        content = content.substring(0, leftAgentStart) + content.substring(nextCutLine);
    }
}

let rightAgentStart = content.indexOf('<!-- AGENT COPY CUT LINE -->');
if (rightAgentStart !== -1) {
    let nextCutLine = content.indexOf('<!-- CUT LINE -->', rightAgentStart + 1);
    if (nextCutLine !== -1) {
        content = content.substring(0, rightAgentStart) + content.substring(nextCutLine);
    } else {
        // For the right column, the next thing might be ${hidePvcBoxes ? '' : `
        let hidePvcStart = content.indexOf('${hidePvcBoxes', rightAgentStart);
        if (hidePvcStart !== -1) {
             content = content.substring(0, rightAgentStart) + content.substring(hidePvcStart);
        }
    }
}

// 2. Now duplicate the PVC boxes (lc-box-3 and lc-box-4)
let pvcFrontStart = content.indexOf('<!-- BOTTOM FRONT CARD -->');
let pvcFrontEnd = content.indexOf('</div>\n                `}', pvcFrontStart);
if (pvcFrontEnd !== -1) {
    pvcFrontEnd += 6; // include the </div>
    let pvcFrontBlock = content.substring(pvcFrontStart, pvcFrontEnd);
    
    let cutLineHtml = `
                <!-- CUT LINE -->
                <div class="lc-cut-line" style="width: 100%; border-top: 1px dashed #666; margin: 2.5mm 0; position: relative;">
                    <span style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #444; background: white; padding: 0 4px;">&#x2702;</span>
                </div>
`;
    // Only duplicate if it's the Long with PVC format, but wait, they might want this for all formats that use PVC?
    // Actually, I can just render it conditionally based on cardFormat.
    // Let's add a new variable `showExtraPvcBoxes = cardFormat === "Long With PVC";`
    
    let pvcFrontCopy = cutLineHtml + pvcFrontBlock.replace('id="lc-box-3"', 'id="lc-box-5"');
    // Wrap the extra box in the condition
    let replacementFront = pvcFrontBlock + `\n                \`}\n                \${showExtraPvcBoxes ? \`\n` + pvcFrontCopy;
    content = content.replace(pvcFrontBlock, replacementFront);
}

let pvcBackStart = content.indexOf('<!-- BOTTOM BACK CARD -->');
let pvcBackEnd = content.indexOf('</div>\n                `}', pvcBackStart);
if (pvcBackEnd !== -1) {
    pvcBackEnd += 6;
    let pvcBackBlock = content.substring(pvcBackStart, pvcBackEnd);
    
    let cutLineHtml = `
                <!-- CUT LINE -->
                <div class="lc-cut-line" style="width: 100%; border-top: 1px dashed #666; margin: 2.5mm 0; position: relative;">
                    <span style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #444; background: white; padding: 0 4px;">&#x2702;</span>
                </div>
`;
    let pvcBackCopy = cutLineHtml + pvcBackBlock.replace('id="lc-box-4"', 'id="lc-box-6"');
    let replacementBack = pvcBackBlock + `\n                \`}\n                \${showExtraPvcBoxes ? \`\n` + pvcBackCopy;
    content = content.replace(pvcBackBlock, replacementBack);
}

// 3. Define showExtraPvcBoxes at the top
let hideLongBoxesLine = 'let hideLongBoxes = cardFormat === "PVC Card" || cardFormat === "Normal with PVC";';
content = content.replace(hideLongBoxesLine, hideLongBoxesLine + '\n        let showExtraPvcBoxes = cardFormat === "Long With PVC";');

fs.writeFileSync(file, content);
console.log("Patched successfully to 2 Large, 4 Small PVC");
