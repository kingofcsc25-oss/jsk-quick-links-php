/* =========================================================
   DL PRINT - PROTECTED CODE | © JSK QUICK LINKS
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
// Check URL first before checking sessionStorage to avoid racing
if (window.location.search.includes('dl_ext=true')) {
    sessionStorage.setItem('dl_print_active', 'true');
}

(function() {
    if (sessionStorage.getItem('dl_print_active') !== 'true') return;

    if (window.location.href.includes('parivahan.gov.in')) {
        let isTargetPage = window.location.href.includes('envaction.do') || window.location.href.includes('stateSelection.do');
        let isActive = sessionStorage.getItem('dl_print_active') === 'true';
        let isSarathi = window.location.href.includes('sarathiservice');
        
        // Check if we should hide the site during load
        if (isTargetPage || (isActive && isSarathi)) {
            let style = document.createElement('style');
            style.textContent = `
                html, body {
                    background: rgba(15, 23, 42, 1) !important;
                }
                body::before {
                    content: "";
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(15, 23, 42, 1);
                    z-index: 2147483646;
                    pointer-events: all;
                }
            `;
            document.documentElement.appendChild(style);
        }
    }
})();


