const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { execSync } = require('child_process');

const sourceDir = path.join(__dirname, '2. Jana Seva Kendra', 'JSK Extension Services for Printing', 'Ration Card', 'RC_Print_v2_Final');
const distDir = path.join('D:', 'Extention Working COmply work', 'RC Print Extension code');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const files = fs.readdirSync(sourceDir);

for (const file of files) {
    const srcPath = path.join(sourceDir, file);
    const destPath = path.join(distDir, file);

    if (fs.statSync(srcPath).isFile()) {
        if (file === 'Code.gs' || file === 'logos.txt' || file === 'RC_Print_Extension_v2.zip' || file === 'RC_Print_Extension.zip') {
            continue; // skip junk files
        }

        if (file.endsWith('.js') && !file.endsWith('.min.js')) {
            const code = fs.readFileSync(srcPath, 'utf8');
            const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 0.75,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 0.4,
                stringArray: true,
                stringArrayEncoding: ['base64']
            });
            fs.writeFileSync(destPath, obfuscationResult.getObfuscatedCode(), 'utf8');
        } else if (file.endsWith('.html')) {
            let html = fs.readFileSync(srcPath, 'utf8');
            html = html.replace('<body', '<body oncontextmenu="return false;" onselectstart="return false;" ondragstart="return false;"');
            fs.writeFileSync(destPath, html, 'utf8');
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('Build completed successfully in D: drive!');

// Now zip it
try {
    execSync(`powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath 'D:\\Extention Working COmply work\\RC_Print_Extension.zip' -Force"`);
    execSync(`powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${path.join(__dirname, 'rc_print_extension.zip')}' -Force"`);
    console.log('Zipped successfully!');
} catch (e) {
    console.error('Error zipping:', e);
}
