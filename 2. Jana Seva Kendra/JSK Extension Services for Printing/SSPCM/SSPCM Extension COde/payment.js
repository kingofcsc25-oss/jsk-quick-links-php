if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.storage) {
  window.chrome = {
    runtime: {
      lastError: null,
      getURL: (path) => path,
      sendMessage: () => {}
    },
    storage: {
      local: {
        get: (keys, cb) => {
          cb({
            ssp_agent_id: "SSP12345",
            ssp_agent_name: "John Doe",
            ssp_agent_mob: "9876543210",
            ssp_agent_email: "john.doe@gmail.com",
            ssp_wallet_balance: 150,
            ssp_student_id: "STU98765",
            ssp_new_mobile: "9998887776",
            ssp_new_password: "Karnatak@1234",
            sspcm_active: false
          });
        },
        set: (obj, cb) => { if (cb) cb(); },
        remove: (keys, cb) => { if (cb) cb(); }
      },
      sync: {
        get: (keys, cb) => { cb({}); },
        set: (obj, cb) => { if (cb) cb(); }
      }
    },
    identity: {
      getProfileUserInfo: (opts, cb) => {
        cb({ email: "john.doe@gmail.com", id: "12345" });
      }
    },
    tabs: {
      create: () => {},
      update: () => {},
      get: () => {},
      query: () => {}
    }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const btnSubmitPayment = document.getElementById('btnSubmitPayment');
  const btnConfirmManualPayment = document.getElementById('btnConfirmManualPayment');
  const rechargeAmountInput = document.getElementById('rechargeAmount');
  const pointsCalcText = document.getElementById('pointsCalcText');
  const utrNumberInput = document.getElementById('utrNumber');
  const qrImg = document.getElementById('dynamicQRCode');
  const agentMobInput = document.getElementById('agentMobNo');
  const agentNameInput = document.getElementById('agentName');
  const studentIdDispInput = document.getElementById('studentIdDisp');
  const agentEmailInput = document.getElementById('agentEmail');

  // Load configured Agent Details and Student ID
  chrome.storage.local.get(['ssp_agent_name', 'ssp_agent_mob', 'ssp_agent_id', 'ssp_student_id', 'ssp_agent_email'], (data) => {
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
      const loginEmail = (userInfo && userInfo.email) ? userInfo.email.trim() : '';
      if (data.ssp_agent_email) {
        if (!loginEmail || loginEmail.toLowerCase() !== data.ssp_agent_email.toLowerCase()) {
          window.location.href = "popup.html";
          return;
        }
      }

      if (agentNameInput && data.ssp_agent_name) agentNameInput.value = data.ssp_agent_name;
      if (agentMobInput && data.ssp_agent_mob) agentMobInput.value = data.ssp_agent_mob;
      if (studentIdDispInput && data.ssp_student_id) studentIdDispInput.value = data.ssp_student_id;
      if (agentEmailInput && data.ssp_agent_email) agentEmailInput.value = data.ssp_agent_email;
    });
  });

  function updateCalculatedPoints() {
    if (!rechargeAmountInput || !pointsCalcText) return;
    const amount = parseFloat(rechargeAmountInput.value) || 0;
    let points = amount;
    let text = `Points to get: ${points} PTS`;
    if (amount >= 200) {
      points = amount * 2;
      text = `Points to get: ${points} PTS (Double Offer!)`;
    }
    pointsCalcText.innerText = text;

    // Update dynamic QR code image URL in real-time
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=janaesevakendra@upi%26pn=Jana%20Seva%20Kendra%26am=${amount}%26cu=INR`;
    }
  }

  if (rechargeAmountInput) {
    rechargeAmountInput.addEventListener('input', updateCalculatedPoints);
    updateCalculatedPoints();
  }

  if (btnSubmitPayment) {
    btnSubmitPayment.addEventListener('click', () => {
      const amount = parseFloat(rechargeAmountInput ? rechargeAmountInput.value : "100") || 100;
      if (amount < 10) {
        alert("Minimum recharge amount is ₹10.");
        return;
      }

      const payMob = agentMobInput ? agentMobInput.value.trim() : "9999999999";
      const payName = agentNameInput ? agentNameInput.value.trim() : "Agent";

      chrome.storage.local.get(['ssp_agent_email'], (res) => {
        const payEmail = res.ssp_agent_email || "agent@karnataka.gov.in";
        // Redirect the current tab to payu_checkout.html
        const checkoutUrl = chrome.runtime.getURL(`payu_checkout.html?amount=${amount}&name=${encodeURIComponent(payName)}&mobile=${encodeURIComponent(payMob)}&email=${encodeURIComponent(payEmail)}`);
        window.location.href = checkoutUrl;
      });
    });
  }

  if (btnConfirmManualPayment) {
    btnConfirmManualPayment.addEventListener('click', () => {
      const amount = parseFloat(rechargeAmountInput ? rechargeAmountInput.value : "100") || 100;
      if (amount < 10) {
        alert("Minimum recharge amount is ₹10.");
        return;
      }

      const utr = utrNumberInput ? utrNumberInput.value.trim() : "";
      if (utr.length !== 12 || !/^\d+$/.test(utr)) {
        alert("Please enter a valid 12-digit UTR/Transaction number.");
        if (utrNumberInput) utrNumberInput.focus();
        return;
      }

      btnConfirmManualPayment.innerText = "Processing...";
      btnConfirmManualPayment.disabled = true;

      chrome.storage.local.get([
        'ssp_wallet_balance',
        'ssp_agent_name',
        'ssp_agent_mob',
        'ssp_agent_id',
        'ssp_student_id'
      ], (res) => {
        let pointsToAdd = amount;
        if (amount >= 200) {
          pointsToAdd = amount * 2;
        }

        const currentBal = res.ssp_wallet_balance || 0;
        const newBal = currentBal + pointsToAdd;

        const payMob = res.ssp_agent_mob || "9999999999";
        const payName = res.ssp_agent_name || "Agent";
        const agentId = res.ssp_agent_id || "";

        // Sync transaction details to Google Sheets Web App
        const googleSheetAppScriptUrl = "https://script.google.com/macros/s/AKfycbyyIKQOt7qqdw-LbCiXr_9wet7YVa9P_8OfLybKZm1bQTP7gq8f9zUNByji7z5Csftk/exec";
        const timestamp = new Date().toLocaleString();
        const syncUrl = `${googleSheetAppScriptUrl}?timestamp=${encodeURIComponent(timestamp)}&agentId=${encodeURIComponent(agentId)}&studentId=Recharge&newMobile=Recharge&utr=${encodeURIComponent(utr)}&mobile=${encodeURIComponent(payMob)}`;

        fetch(syncUrl, { method: 'GET', mode: 'no-cors' })
          .then(() => {
            console.log("Google Sheets sync successful.");
            chrome.storage.local.set({
              ssp_wallet_balance: newBal
            }, () => {
              alert(`Successfully submitted! ${pointsToAdd} points will be added to your wallet upon verification.`);
              window.location.href = "popup.html";
            });
          })
          .catch(e => {
            console.log("Google Sheets Sync Error:", e);
            chrome.storage.local.set({
              ssp_wallet_balance: newBal
            }, () => {
              alert(`Successfully submitted! ${pointsToAdd} points will be added to your wallet upon verification.`);
              window.location.href = "popup.html";
            });
          });
      });
    });
  }
});

// --- Developer Tools Security Anti-Debugging ---
let devToolsHandled = false;
function handleDevToolsOpen() {
  if (devToolsHandled) return;
  devToolsHandled = true;
  
  try { 
    chrome.storage.local.remove([
      'ssp_student_id', 'ssp_new_mobile', 'ssp_new_password', 
      'ssp_student_name', 'ssp_pwd_step', 'ssp_mobile_step', 
      'sspcm_active', 'ssp_show_celebration', 'ssp_show_otp_modal', 
      'ssp_show_mobile_otp_modal'
    ]); 
  } catch(e){}
  try { sessionStorage.clear(); } catch(e){}
  
  document.body.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0f172a;z-index:999999999;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#ef4444;font-size:22px;font-family:sans-serif;font-weight:bold;text-align:center;padding:30px;box-sizing:border-box;">
      <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
      <p style="margin-bottom: 10px;">Dear User you open the Developer tool</p>
      <p style="color: #94a3b8; font-size: 16px; margin-bottom: 20px;">this page will be full secrue thats why the Tab will close in 2 secend ...</p>
    </div>
  `;
  
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
