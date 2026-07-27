// popup.js - State and Automation Controller for SSPCM Control Panel

document.addEventListener('DOMContentLoaded', () => {
  // Input fields
  const studentIdInput = document.getElementById('studentId');
  const mobileNumInput = document.getElementById('mobileNum');
  const newPasswordInput = document.getElementById('newPassword');
  
  // Icon and control buttons
  const btnGeneratePass = document.getElementById('btnGeneratePass');
  const btnResetPass = document.getElementById('btnResetPass');
  const btnLoginPortal = document.getElementById('btnLoginPortal');
  const btnUpdateMobile = document.getElementById('btnUpdateMobile');
  const btnResetEngine = document.getElementById('btnResetEngine');
  
  // Cards for visual step indicators
  const step1Card = document.getElementById('step1Card');
  const step2Card = document.getElementById('step2Card');
  const step3Card = document.getElementById('step3Card');
  
  // Status indicator
  const statusBox = document.querySelector('.status-box');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  if (statusBox) {
    statusBox.style.cursor = 'pointer';
    statusBox.title = 'Click to toggle Engine RUNNING / STOP state';
    statusBox.addEventListener('click', () => {
      chrome.storage.local.get(['sspcm_active'], (d) => {
        const newState = !d.sspcm_active;
        chrome.storage.local.set({ sspcm_active: newState }, () => {
          loadState();
        });
      });
    });
  }

  // Load configuration from local storage
  const loadState = () => {
    chrome.storage.local.get([
      'ssp_student_id',
      'ssp_new_mobile',
      'ssp_new_password',
      'ssp_pwd_step',
      'ssp_mobile_step',
      'sspcm_active',
      'ssp_agent_id',
      'ssp_agent_name',
      'ssp_agent_mob',
      'ssp_wallet_balance'
    ], (data) => {
      // Check for One-Time Agent Registration
      if (!data.ssp_agent_id || !data.ssp_agent_name || !data.ssp_agent_mob) {
        document.querySelector('.glass-panel').style.display = 'none';
        document.getElementById('registration-panel').style.display = 'flex';
        document.getElementById('sidebarAgentName').textContent = 'Not Registered';
      } else {
        document.querySelector('.glass-panel').style.display = 'flex';
        document.getElementById('registration-panel').style.display = 'none';
        document.getElementById('sidebarAgentName').textContent = data.ssp_agent_name;
      }

      const walletPoints = document.getElementById('walletPoints');
      if (walletPoints) {
         walletPoints.innerText = data.ssp_wallet_balance || 0;
      }
      
      const lowBalanceWarning = document.getElementById('lowBalanceWarning');
      if (lowBalanceWarning) {
         if ((data.ssp_wallet_balance || 0) < 20) {
            lowBalanceWarning.style.display = 'block';
         } else {
            lowBalanceWarning.style.display = 'none';
         }
      }

      // Pre-fill inputs with stored values or defaults
      studentIdInput.value = data.ssp_student_id || '';
      mobileNumInput.value = data.ssp_new_mobile || '';
      
      if (data.ssp_new_password) {
        newPasswordInput.value = data.ssp_new_password;
      } else {
        generateAndSavePassword();
      }

      // Determine and paint active UI state
      const isPwdDone = data.ssp_pwd_step === 'done';
      const isMobileDone = data.ssp_mobile_step === 'done';
      const isActive = !!data.sspcm_active;

      // Update Engine Status Bar
      if (isPwdDone && isMobileDone) {
        statusText.textContent = "STOP";
        statusIndicator.className = "status-indicator inactive";
      } else if (isActive) {
        statusText.textContent = "RUNNING";
        statusIndicator.className = "status-indicator active";
      } else {
        statusText.textContent = "STOP";
        statusIndicator.className = "status-indicator inactive";
      }

      // Reset card visual classes
      step1Card.className = "step-card";
      step2Card.className = "step-card";
      step3Card.className = "step-card";

      // Always keep all buttons fully enabled so the user can skip or trigger any step manually!
      btnLoginPortal.disabled = false;

      // Lock input fields if the engine is running
      studentIdInput.disabled = isActive;
      mobileNumInput.disabled = isActive;
      newPasswordInput.disabled = isActive;
      btnGeneratePass.disabled = isActive;

      if (isActive) {
        studentIdInput.style.opacity = '0.6';
        mobileNumInput.style.opacity = '0.6';
        newPasswordInput.style.opacity = '0.6';
      } else {
        studentIdInput.style.opacity = '1';
        mobileNumInput.style.opacity = '1';
        newPasswordInput.style.opacity = '1';
      }

      // Determine active visual cards based on step progression
      if (!isPwdDone) {
        step1Card.classList.add('active');
      } else if (!isMobileDone) {
        step1Card.classList.add('completed');
        
        if (data.ssp_mobile_step === '2') {
          step2Card.classList.add('completed');
          step3Card.classList.add('active');
        } else {
          step2Card.classList.add('active');
        }
      } else {
        step1Card.classList.add('completed');
        step2Card.classList.add('completed');
        step3Card.classList.add('completed');
      }

      if (isMobileDone) {
        step3Card.innerHTML = `
          <div class="step-num" style="background: var(--success); border-color: transparent; color: #fff;">✓</div>
          <div class="step-content">
            <h3 style="color: var(--success); text-decoration: line-through;">Update Mobile Number</h3>
            <p style="color: #10b981; font-weight: 600; margin-bottom: 8px;">✅ Mobile successfully linked!</p>
            <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px; font-size: 11px; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-secondary); font-weight: 500;">SSP ID:</span><strong style="color: #fff; font-family: monospace;">${data.ssp_student_id || 'N/A'}</strong></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-secondary); font-weight: 500;">Mobile No:</span><strong style="color: #fff; font-family: monospace;">${data.ssp_new_mobile || 'N/A'}</strong></div>
            </div>
          </div>
        `;
      } else {
        step3Card.innerHTML = `
          <div class="step-num">3</div>
          <div class="step-content">
            <h3>Update Mobile Number</h3>
            <p>Enter new number, request and verify OTP</p>
            <button id="btnUpdateMobile" class="btn btn-emerald">Go to Mobile Update</button>
          </div>
        `;
        
        // Re-attach listener since innerHTML wipes it
        const newBtn = document.getElementById('btnUpdateMobile');
        if (newBtn) {
          newBtn.addEventListener('click', () => {
            const mobile = mobileNumInput.value.trim();
            if (!mobile || mobile.length < 10) {
              alert("Please enter a valid 10-digit mobile number first.");
              mobileNumInput.focus();
              return;
            }

            chrome.storage.local.set({
              sspcm_active: true,
              ssp_mobile_step: '1',
              ssp_new_mobile: mobile
            }, () => {
              loadState();
              chrome.tabs.create({ url: "https://ssp.postmatric.karnataka.gov.in/post_sa/Student_Update_MobileNo.aspx" }, (t) => {
                if (t && t.id) chrome.storage.local.set({ ssp_active_tab_id: t.id });
              });
            });
          });
        }
      }
    });
  };

  // Generate secure password
  const generateAndSavePassword = () => {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const pass = "Karnatak@" + randomDigits;
    newPasswordInput.value = pass;
    saveField('ssp_new_password', pass);
  };

  // Helper to save a single field to local storage
  const saveField = (key, val) => {
    const obj = {};
    obj[key] = val;
    chrome.storage.local.set(obj);
  };

  // Event Listeners for inputs
  studentIdInput.addEventListener('input', () => {
    saveField('ssp_student_id', studentIdInput.value.trim());
  });

  mobileNumInput.addEventListener('input', () => {
    saveField('ssp_new_mobile', mobileNumInput.value.trim());
  });

  newPasswordInput.addEventListener('input', () => {
    saveField('ssp_new_password', newPasswordInput.value.trim());
  });

  // Action Buttons
  btnGeneratePass.addEventListener('click', () => {
    generateAndSavePassword();
  });

  btnResetPass.addEventListener('click', () => {
    const sspId = studentIdInput.value.trim();
    if (!sspId) {
      alert("Please enter a valid Student ID first.");
      studentIdInput.focus();
      return;
    }
    
    const pwd = newPasswordInput.value.trim();
    if (!pwd) {
      alert("Please provide a new password.");
      newPasswordInput.focus();
      return;
    }

    const newMobile = mobileNumInput.value.trim();

    chrome.storage.local.get(['ssp_wallet_balance'], (wData) => {
      let currentBal = wData.ssp_wallet_balance || 0;
      let needsPayment = currentBal < 20;

      // Prepare temp parameters in storage
      chrome.storage.local.set({
        ssp_student_id: sspId,
        ssp_new_password: pwd,
        ssp_new_mobile: newMobile,
        sspcm_active: true,
        ssp_pending_payment: needsPayment
      }, () => {
        // Open the SSP portal directly, where content.js will show the payment modal!
        chrome.tabs.create({ url: "https://ssp.postmatric.karnataka.gov.in/post_sa/ResetPassword.aspx" }, (t) => {
          if (t && t.id) chrome.storage.local.set({ ssp_active_tab_id: t.id });
        });
      });
    });
  });

  btnLoginPortal.addEventListener('click', () => {
    chrome.storage.local.set({
      sspcm_active: true
    }, () => {
      loadState();
      chrome.tabs.create({ url: "https://ssp.postmatric.karnataka.gov.in/post_sa/signin.aspx" }, (t) => {
        if (t && t.id) chrome.storage.local.set({ ssp_active_tab_id: t.id });
      });
    });
  });

  btnUpdateMobile.addEventListener('click', () => {
    const mobile = mobileNumInput.value.trim();
    if (!mobile || mobile.length < 10) {
      alert("Please enter a valid 10-digit mobile number first.");
      mobileNumInput.focus();
      return;
    }

    chrome.storage.local.get(['ssp_wallet_balance'], (wData) => {
      let currentBal = wData.ssp_wallet_balance || 0;
      let needsPayment = currentBal < 20;

      chrome.storage.local.set({
        sspcm_active: true,
        ssp_mobile_step: '1',
        ssp_new_mobile: mobile,
        ssp_show_otp_modal: false,
        ssp_show_mobile_otp_modal: false,
        ssp_pending_payment: needsPayment
      }, () => {
        loadState();
        chrome.tabs.create({ url: "https://ssp.postmatric.karnataka.gov.in/post_sa/Student_Update_MobileNo.aspx" }, (t) => {
          if (t && t.id) chrome.storage.local.set({ ssp_active_tab_id: t.id });
        });
      });
    });
  });

  btnResetEngine.addEventListener('click', () => {
    chrome.storage.local.set({
      sspcm_active: false,
      ssp_student_id: '',
      ssp_new_mobile: '',
      ssp_student_name: '',
      ssp_pwd_step: '1',
      ssp_mobile_step: '1',
      ssp_new_password: '',
      ssp_show_otp_modal: false,
      ssp_show_mobile_otp_modal: false
    }, () => {
      generateAndSavePassword();
      loadState();
    });
  });



  // Export Logs to Excel (CSV) handler
  const btnExportExcel = document.getElementById('btnExportExcel');
  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', () => {
      chrome.storage.local.get(['ssp_payment_logs'], (res) => {
        const logs = res.ssp_payment_logs || [];
        if (logs.length === 0) {
          alert("No payment logs found to export yet.");
          return;
        }

        // Generate Excel-compatible CSV content
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // \uFEFF ensures proper UTF-8 handling in Excel
        csvContent += "Date & Time,SSP Student ID,New Mobile,UTR / Transaction ID,UPI Mobile Number\n";

        logs.forEach(l => {
          const row = [
            `"${l.timestamp || ''}"`,
            `"${l.studentId || ''}"`,
            `"${l.newMobile || ''}"`,
            `"${l.utr || ''}"`,
            `"${l.mobile || ''}"`
          ].join(",");
          csvContent += row + "\n";
        });

        // Trigger file download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `SSP_Payment_Logs_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    });
  }

  // Handle Registration Save
  const btnSaveRegistration = document.getElementById('btnSaveRegistration');
  if (btnSaveRegistration) {
    btnSaveRegistration.addEventListener('click', () => {
      const name = document.getElementById('regAgentName').value.trim();
      const mob = document.getElementById('regAgentMob').value.trim();
      const id = document.getElementById('regAgentId').value.trim();

      if (!name || !mob || !id) {
        alert('Please fill out all 3 fields to configure this computer.');
        return;
      }
      
      if (mob.length !== 10) {
        alert('Please enter a valid 10-digit mobile number.');
        return;
      }

      chrome.storage.local.set({
        ssp_agent_name: name,
        ssp_agent_mob: mob,
        ssp_agent_id: id,
        ssp_wallet_balance: 40
      }, () => {
        document.getElementById('registration-panel').style.display = 'none';
        document.getElementById('reg-success-modal').style.display = 'flex';
        document.getElementById('sidebarAgentName').textContent = name;
      });
    });
  }

  const btnContinueToDashboard = document.getElementById('btnContinueToDashboard');
  if (btnContinueToDashboard) {
    btnContinueToDashboard.addEventListener('click', () => {
      document.getElementById('reg-success-modal').style.display = 'none';
      loadState();
    });
  }

  // Periodically reload the state to reflect background changes in real-time
  setInterval(loadState, 1500);

  // Initial load
  loadState();
});
