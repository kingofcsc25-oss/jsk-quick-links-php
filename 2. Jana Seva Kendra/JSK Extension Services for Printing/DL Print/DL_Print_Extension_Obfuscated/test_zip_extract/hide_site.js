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
