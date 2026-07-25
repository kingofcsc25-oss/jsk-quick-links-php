const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { execSync } = require('child_process');

const sourceDir = path.join('F:', 'Google', 'Extension Work', 'SSPCM');
const distDir = path.join('F:', 'Google', 'jskquicklinks', '2. Jana Seva Kendra', 'JSK Extension Services for Printing', 'SSPCM', 'SSPCM Extension COde');

const filesToObfuscate = ['payu_checkout.js', 'points_updater.js'];

for (const file of filesToObfuscate) {
    const srcPath = path.join(sourceDir, file);
    const destPath = path.join(distDir, file);

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
    console.log(`Obfuscated and copied ${file}`);
}

const zipPath = path.join('D:', 'Extention Working COmply work', 'SSPCM_Extension.zip');
const rootZipPath = path.join('F:', 'Google', 'jskquicklinks', 'sspcm_extension.zip');

try {
    execSync(`powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force"`);
    execSync(`powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${rootZipPath}' -Force"`);
    console.log('Zipped successfully!');
} catch (e) {
    console.error('Error zipping:', e);
}
