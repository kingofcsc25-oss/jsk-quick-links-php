// Inject a div so the localhost dashboard knows the extension is installed
const extensionDetector = document.createElement('div');
extensionDetector.id = 'pan-extension-active';
extensionDetector.style.display = 'none';

if (document.documentElement) {
    document.documentElement.appendChild(extensionDetector);
} else {
    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(extensionDetector);
    });
}

// If we are on the Income Tax portal, inject the floating dashboard
if (window.location.hostname.includes('incometax.gov.in')) {
    window.addEventListener('load', () => {
        const iframe = document.createElement('iframe');
        iframe.src = chrome.runtime.getURL('popup.html');
        iframe.style.position = 'fixed';
        iframe.style.top = '5vh';
        iframe.style.right = '20px';
        iframe.style.width = '450px';
        iframe.style.height = '85vh';
        iframe.style.border = '1px solid #d1d5db';
        iframe.style.borderRadius = '12px';
        iframe.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
        iframe.style.zIndex = '999999';
        iframe.style.background = 'white';
        
        document.body.appendChild(iframe);
    });
}
