document.addEventListener('DOMContentLoaded', () => {
  const btnSubmitPayment = document.getElementById('btnSubmitPayment');
  const payUtrInput = document.getElementById('payUtr');
  const agentMobInput = document.getElementById('agentMobNo');
  const agentNameInput = document.getElementById('agentName');
  const agentIdInput = document.getElementById('agentId');
  const studentIdDispInput = document.getElementById('studentIdDisp');

  // Load configured Agent Details and Student ID
  chrome.storage.local.get(['ssp_agent_name', 'ssp_agent_mob', 'ssp_agent_id', 'ssp_student_id'], (data) => {
    if (agentNameInput && data.ssp_agent_name) agentNameInput.value = data.ssp_agent_name;
    if (agentMobInput && data.ssp_agent_mob) agentMobInput.value = data.ssp_agent_mob;
    if (agentIdInput && data.ssp_agent_id) agentIdInput.value = data.ssp_agent_id;
    if (studentIdDispInput && data.ssp_student_id) studentIdDispInput.value = data.ssp_student_id;
  });

  if (btnSubmitPayment) {
    btnSubmitPayment.addEventListener('click', () => {
      const agentMobInput = document.getElementById('agentMobNo');
      const agentIdInput = document.getElementById('agentId');
      
      const payMob = agentMobInput ? agentMobInput.value.trim() : "";
      const payAgentId = agentIdInput ? agentIdInput.value.trim() : "";

      chrome.windows.create({
        url: "https://rzp.io/rzp/VNb6ZlQ",
        type: "popup",
        width: 500,
        height: 750,
        focused: true
      }, (win) => {
        // Show loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#070913;z-index:99999999;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:"Plus Jakarta Sans", sans-serif;color:#fff;';
        loadingOverlay.innerHTML = `
          <div style="width:50px;height:50px;border:4px solid rgba(16,185,129,0.2);border-top-color:#10b981;border-radius:50%;animation:pay-spin 1s linear infinite;margin-bottom:20px;"></div>
          <h3 id="rzp-title" style="color:#10b981;margin:0 0 10px 0;font-size:20px;font-weight:700;letter-spacing:0.5px;">Awaiting Payment...</h3>
          <p id="rzp-desc" style="color:#94a3b8;font-size:14px;margin:0;font-weight:500;text-align:center;">Please complete the payment in the popup window.<br>We are verifying automatically...</p>
          <style>@keyframes pay-spin { 100% { transform: rotate(360deg); } }</style>
        `;
        document.body.appendChild(loadingOverlay);

        const startTime = Math.floor(Date.now() / 1000) - 5; // allow 5 seconds drift
        const authHeader = "Basic " + btoa("rzp_test_SxoDEkQfCzsKiA:q4WPt4FrVRFFMWSlXFJWygvM");
        let isSuccess = false;

        const pollInterval = setInterval(() => {
          if (isSuccess) return;

          fetch("https://api.razorpay.com/v1/payments?count=5", {
            headers: { "Authorization": authHeader }
          })
          .then(res => res.json())
          .then(data => {
            if (data && data.items && !isSuccess) {
              const recentPayment = data.items.find(p => 
                p.created_at >= startTime && 
                (p.status === 'captured' || p.status === 'authorized')
              );

              if (recentPayment) {
                isSuccess = true;
                clearInterval(pollInterval);
                
                if (win && win.id) {
                  chrome.windows.remove(win.id);
                }

                document.getElementById('rzp-title').innerText = "Payment Successful!";
                document.getElementById('rzp-desc').innerText = "Payment ID: " + recentPayment.id + "\\nStarting automation...";

                const utr = recentPayment.id;

                setTimeout(() => {
        // Fetch existing configs and logs from storage
        chrome.storage.local.get([
          'ssp_student_id',
          'ssp_new_password',
          'ssp_new_mobile',
          'ssp_payment_logs'
        ], (res) => {
          const sspId = res.ssp_student_id || "";
          const pwd = res.ssp_new_password || "";
          const newMobile = res.ssp_new_mobile || "";
          const logs = res.ssp_payment_logs || [];

          const newLog = {
            agentId: payAgentId,
            studentId: sspId,
            newMobile: newMobile,
            utr: utr,
            mobile: payMob,
            timestamp: new Date().toLocaleString()
          };
          logs.push(newLog);

          const performRedirect = () => {
            chrome.storage.local.set({
              sspcm_active: true,
              ssp_pwd_step: '1',
              ssp_mobile_step: '1',
              ssp_show_otp_modal: false,
              ssp_show_mobile_otp_modal: false,
              ssp_payment_utr: utr,
              ssp_payment_mobile: payMob,
              ssp_payment_logs: logs
            }, () => {
              // Immediately redirect this new full-screen tab directly to the SSP portal reset page!
              window.location.href = "https://ssp.postmatric.karnataka.gov.in/post_sa/ResetPassword.aspx";
            });
          };

          // Sync transaction details to Google Sheets Web App (Resilient GET query)
          const googleSheetAppScriptUrl = "https://script.google.com/macros/s/AKfycbyyIKQOt7qqdw-LbCiXr_9wet7YVa9P_8OfLybKZm1bQTP7gq8f9zUNByji7z5Csftk/exec";
          if (googleSheetAppScriptUrl) {
            const syncUrl = `${googleSheetAppScriptUrl}?timestamp=${encodeURIComponent(newLog.timestamp)}&agentId=${encodeURIComponent(newLog.agentId)}&studentId=${encodeURIComponent(newLog.studentId)}&newMobile=${encodeURIComponent(newLog.newMobile)}&utr=${encodeURIComponent(newLog.utr)}&mobile=${encodeURIComponent(newLog.mobile)}`;
            
            fetch(syncUrl, { method: 'GET', mode: 'no-cors' })
              .then(() => {
                console.log("Google Sheets sync successful.");
                performRedirect();
              })
              .catch(e => {
                console.log("Google Sheets Sync Error:", e);
                performRedirect(); // Proceed to automation even if sync has network issues
              });
          } else {
            performRedirect();
          }
        });
                }, 1500); // Wait 1.5 seconds after success to show UI
              }
            }
          }).catch(err => console.log("Razorpay Poll Error", err));
        }, 3000); // Poll every 3 seconds
      });
    });
  }

  // Hover animations via JS as alternative to remain perfectly compliant
  if (btnSubmitPayment) {
    btnSubmitPayment.addEventListener('mouseover', () => {
      btnSubmitPayment.style.transform = 'translateY(-1px)';
      btnSubmitPayment.style.filter = 'brightness(1.08)';
    });
    btnSubmitPayment.addEventListener('mouseout', () => {
      btnSubmitPayment.style.transform = 'translateY(0)';
      btnSubmitPayment.style.filter = 'brightness(1)';
    });
  }
});

// --- Developer Tools Security Anti-Debugging ---
let devToolsHandled = false;
function handleDevToolsOpen() {
  if (devToolsHandled) return;
  devToolsHandled = true;
  
  // Clear session data but preserve Agent Registration
  try { 
    chrome.storage.local.remove([
      'ssp_student_id', 'ssp_new_mobile', 'ssp_new_password', 
      'ssp_student_name', 'ssp_pwd_step', 'ssp_mobile_step', 
      'sspcm_active', 'ssp_show_celebration', 'ssp_show_otp_modal', 
      'ssp_show_mobile_otp_modal'
    ]); 
  } catch(e){}
  try { sessionStorage.clear(); } catch(e){}
  
  // Give the message to user
  document.body.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0f172a;z-index:999999999;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#ef4444;font-size:22px;font-family:sans-serif;font-weight:bold;text-align:center;padding:30px;box-sizing:border-box;">
      <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
      <p style="margin-bottom: 10px;">Dear User you open the Developer tool</p>
      <p style="color: #94a3b8; font-size: 16px; margin-bottom: 20px;">this page will be full secrue thats why the Tab will close in 2 secend ...</p>
    </div>
  `;
  
  // Close tab in 2 seconds
  setTimeout(() => {
    try {
      if (chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({ action: 'close_tab' });
      }
    } catch(e) {}
    window.close();
  }, 2000);
}

// 1. Detect Docked DevTools (Size Difference)
setInterval(() => {
  const threshold = 160;
  if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
    handleDevToolsOpen();
  }
}, 1000);

// 2. Detect Undocked DevTools (Debugger Timing)
setInterval(() => {
  if (devToolsHandled) return;
  const start = performance.now();
  debugger;
  if (performance.now() - start > 100) {
    handleDevToolsOpen();
  }
}, 1000);
