const originalOpen = window.open;
let jskLastOpenTime = 0;
window.open = function(url, name, specs) {
    let now = Date.now();
    if (now - jskLastOpenTime < 1000) return null; // Prevent multiple popups within 1 second
    jskLastOpenTime = now;
    window.postMessage({ type: 'JSK_OPEN_POPUP', url: url }, '*');
    return null; // Return null to pretend it opened, avoiding standard tabs
};
