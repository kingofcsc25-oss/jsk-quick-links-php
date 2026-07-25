const originalAlert = window.alert;
window.alert = function(msg) {
  if (msg && typeof msg === 'string' && msg.toLowerCase().includes('successfully')) {
    console.log('SSP Auto-dismissed native alert:', msg);
    return;
  }
  return originalAlert.call(window, msg);
};
