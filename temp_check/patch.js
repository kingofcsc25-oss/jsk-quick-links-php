const fs = require('fs');
let file = 'f:\\Google\\Completed Extension work\\RC Print_Backup_Source_Code\\content.js';
let content = fs.readFileSync(file, 'utf8');

let frontStart = content.indexOf('<!-- TOP FRONT CARD -->');
let frontEnd = content.indexOf('<!-- CUT LINE -->', frontStart);
let longFrontBlock = content.substring(frontStart, frontEnd);

let backStart = content.indexOf('<!-- TOP BACK CARD -->');
let backEnd = content.indexOf('<!-- CUT LINE -->', backStart);
let longBackBlock = content.substring(backStart, backEnd);

let cutLineHtml = `
                <!-- AGENT COPY CUT LINE -->
                <div class="lc-cut-line" style="width: 100%; border-top: 1px dashed #666; margin: 2.5mm 0; position: relative;">
                    <span style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #444; background: white; padding: 0 4px;">&#x2702;</span>
                </div>
`;

let newFrontBlock = longFrontBlock + cutLineHtml + longFrontBlock.replace('id="lc-box-1"', 'id="lc-box-1-copy"');
let newBackBlock = longBackBlock + cutLineHtml + longBackBlock.replace('id="lc-box-2"', 'id="lc-box-2-copy"');

content = content.replace(longFrontBlock, newFrontBlock);
content = content.replace(longBackBlock, newBackBlock);

fs.writeFileSync(file, content);
console.log("Patched successfully");
