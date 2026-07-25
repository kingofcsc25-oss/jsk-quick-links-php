const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const sourceDir = path.join(__dirname, '2. Jana Seva Kendra', 'JSK Extension Services for Printing', 'DL Print', 'DL Print Extension code');
const distDir = path.join(__dirname, 'dist_dl_print');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Only exactly these files will be packaged to avoid junk files
const allowedFiles = [
    'background.js', 'content.js', 'dl_print.css', 'dl_print.html', 
    'dl_print.js', 'hide_site.js', 'html2canvas.min.js', 'jspdf.umd.min.js', 
    'manifest.json', 'payu_checkout.html', 'payu_checkout.js', 'popup.html', 'popup.js'
];

for (const file of allowedFiles) {
    const srcPath = path.join(sourceDir, file);
    const destPath = path.join(distDir, file);

    if (fs.existsSync(srcPath)) {
        if (file.endsWith('.js') && !file.endsWith('.min.js')) {
            // Obfuscate custom JS files
            const code = fs.readFileSync(srcPath, 'utf8');
            const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 0.75,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 0.4,
                debugProtection: false,
                disableConsoleOutput: false,
                identifierNamesGenerator: 'hexadecimal',
                log: false,
                renameGlobals: false,
                stringArray: true,
                stringArrayEncoding: ['base64'],
                stringArrayThreshold: 0.75
            });
            fs.writeFileSync(destPath, obfuscationResult.getObfuscatedCode(), 'utf8');
            console.log(`Obfuscated: ${file}`);
        } else {
            // Just copy HTML, CSS, JSON, and minified JS
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied: ${file}`);
        }
    } else {
        console.warn(`File not found: ${srcPath}`);
    }
}
console.log('Build completed successfully in dist_dl_print!');
