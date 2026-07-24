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
    
    // We use a dummy domain that doesn't exist. We intercept it in background.js
    const surl = 'https://ahara.karnataka.gov.in/payu-success-callback';
    const furl = 'https://ahara.karnataka.gov.in/payu-failure-callback';
    
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
