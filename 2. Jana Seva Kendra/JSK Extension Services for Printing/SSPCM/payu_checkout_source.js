/* =========================================================
   SSPCM - PROTECTED CODE | © JSK QUICK LINKS
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
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const amount = urlParams.get('amount') || '100';
    const name = urlParams.get('name') || 'Agent';
    const mobile = urlParams.get('mobile') || '9999999999';
    const email = 'agent@karnataka.gov.in'; // Dummy email required by PayU
    
    // User Provided Credentials
    const key = 'FeB6HB';
    const salt = 'bX8eWBUjT18v8JbGWoK8rObVVfsKJqKx';
    const txnid = 'JSK_' + Date.now() + Math.floor(Math.random() * 1000);
    const productinfo = 'WalletRecharge';
    
    // Use jskquicklinks.vercel.app as dummy domain because it's reliable and matched in manifest.json
    // The content.js intercepts URL containing 'payu-success' and 'payu-fail'
    const surl = 'https://jskquicklinks.vercel.app/payu-success';
    const furl = 'https://jskquicklinks.vercel.app/payu-fail';
    
    // Hash format: key|txnid|amount|productinfo|firstname|email|||||||||||salt
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${name}|${email}|||||||||||${salt}`;
    
    // Calculate SHA-512
    const encoder = new TextEncoder();
    const data = encoder.encode(hashString);
    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const form = document.getElementById('payuForm');
    
    const fields = {
        key: key,
        txnid: txnid,
        amount: amount,
        productinfo: productinfo,
        firstname: name,
        email: email,
        phone: mobile,
        surl: surl,
        furl: furl,
        hash: hashHex
    };
    
    for (const [k, v] of Object.entries(fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = v;
        form.appendChild(input);
    }
    
    chrome.storage.local.set({ 
        pending_payu_txnid: txnid,
        pending_payu_amount: amount
    }, () => {
        form.submit();
    });
});
