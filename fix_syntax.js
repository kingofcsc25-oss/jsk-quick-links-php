const fs = require('fs');

const paths = [
    "F:/Google/jskquicklinks/2. Jana Seva Kendra/JSK Extension Services for Printing/DL Print/DL Print Extension code/content.js",
    "F:/Google/jskquicklinks/2. Jana Seva Kendra/JSK Extension Services for Printing/SSPCM/SSPCM_Extension_Obfuscated/content.js",
    "F:/Google/jskquicklinks/2. Jana Seva Kendra/JSK Extension Services for Printing/Ration Card/RC_Print_v2_Obfuscated/content.js"
];

for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    let c = fs.readFileSync(p, 'utf8');
    
    // Use regex to strip out everything from "const isFail" to "if (document.readyState" 
    const regex = /const isFail[\s\S]*?(if \(document\.readyState === 'loading'\))/;
    
    const replacement = `const isFail = window.location.href.toLowerCase().includes('fail');
    function overrideUI() {
        document.documentElement.innerHTML = \`
            <head><title>Payment \${isFail ? 'Failed' : 'Successful'}</title></head>
            <body style="background:#1e1e28; color:white; font-family:sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; overflow:hidden;">
                <div style="text-align:center; padding: 40px; background: rgba(30,30,40,0.8); border-radius: 16px; border: 1px solid \${isFail ? '#ff4d4d' : '#b070ff'}; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                    <div style="width: 60px; height: 60px; background: \${isFail ? '#ff4d4d' : '#b070ff'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto;">
                        \${isFail 
                            ? '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
                            : '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                        }
                    </div>
                    <h2 style="color:\${isFail ? '#ff4d4d' : '#b070ff'}; margin-top:0;">Payment \${isFail ? 'Failed!' : 'Successful!'}</h2>
                    <p style="color:#8c8c9e; font-size: 16px;">
                        \${isFail 
                            ? 'Unfortunately, your payment could not be completed.'
                            : 'Thank you for your payment.<br>Your points are being added to your wallet.'
                        }
                    </p>
                    <button onclick="window.close()" style="margin-top: 20px; padding: 10px 24px; background: \${isFail ? '#ff4d4d' : '#b070ff'}; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold;">Close Window</button>
                </div>
            </body>
        \`;
    }
    $1`;

    const fixed = c.replace(regex, replacement);
    fs.writeFileSync(p, fixed);
    console.log("Fixed " + p);
}
