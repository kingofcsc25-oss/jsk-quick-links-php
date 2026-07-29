// popup.js - State and Automation Controller for SSPCM Control Panel

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
      query: () => {},
      getCurrent: (cb) => { cb({ id: 1 }); }
    }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  // Input fields
  const studentIdInput = document.getElementById('studentId');
  const mobileNumInput = document.getElementById('mobileNum');
  const newPasswordInput = document.getElementById('newPassword');
  
  // Icon and control buttons
  const btnGeneratePass = document.getElementById('btnGeneratePass');
  const btnResetPass = document.getElementById('btnResetPass');
  const btnResetEngine = document.getElementById('btnResetEngine');

  // Helper function to reuse or open tab
  function openOrUpdateTab(url, callback) {
    chrome.storage.local.get(['ssp_active_tab_id'], (data) => {
      const tabId = data.ssp_active_tab_id;
      if (tabId) {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError || !tab) {
            // Tab does not exist, create new one
            chrome.tabs.create({ url: url }, (newTab) => {
              chrome.storage.local.set({ ssp_active_tab_id: newTab.id }, () => {
                if (callback) callback(newTab);
              });
            });
          } else if (tab.url && tab.url.includes("popup.html")) {
            // SAFEGUARD: The stored tab ID points to the dashboard itself!
            // Do NOT overwrite the dashboard tab. Create a new one.
            chrome.tabs.create({ url: url }, (newTab) => {
              chrome.storage.local.set({ ssp_active_tab_id: newTab.id }, () => {
                if (callback) callback(newTab);
              });
            });
          } else {
            // Tab exists, update it
            chrome.tabs.update(tabId, { url: url, active: true }, (updatedTab) => {
              if (callback) callback(updatedTab);
            });
          }
        });
      } else {
        // No tab ID saved, create new one
        chrome.tabs.create({ url: url }, (newTab) => {
          chrome.storage.local.set({ ssp_active_tab_id: newTab.id }, () => {
            if (callback) callback(newTab);
          });
        });
      }
    });
  }


  
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

  // QR Modal Logic
  const companyHeader = document.getElementById('companyHeader');
  const communityQrImg = document.getElementById('communityQrImg');
  const qrModalOverlay = document.getElementById('qrModalOverlay');
  const closeQrModal = document.getElementById('closeQrModal');
  const qrJoinPrompt = document.getElementById('qrJoinPrompt');
  const btnQrJoinYes = document.getElementById('btnQrJoinYes');
  const btnQrJoinNo = document.getElementById('btnQrJoinNo');
  
  let qrPromptTimer = null;

  // Check if already joined
  chrome.storage.local.get(['sspcm_joined_community'], (res) => {
      if (res.sspcm_joined_community) {
          if (companyHeader) companyHeader.remove();
          if (qrModalOverlay) qrModalOverlay.remove();
      }
  });

  if (communityQrImg && qrModalOverlay && closeQrModal) {
    const qrPromptQuestion = document.getElementById('qrPromptQuestion');
    const qrPromptNoResponse = document.getElementById('qrPromptNoResponse');
    const qrPromptYesResponse = document.getElementById('qrPromptYesResponse');
    const btnNoClose = document.getElementById('btnNoClose');
    const qrTimerDisplay = document.getElementById('qrTimerDisplay');
    let qrTimerInterval = null;

    communityQrImg.addEventListener('click', () => {
      qrModalOverlay.style.display = 'flex';
      if (qrJoinPrompt) {
          qrJoinPrompt.style.display = 'none';
          if (qrPromptQuestion) qrPromptQuestion.style.display = 'flex';
          if (qrPromptNoResponse) qrPromptNoResponse.style.display = 'none';
          if (qrPromptYesResponse) qrPromptYesResponse.style.display = 'none';
      }
      
      // Timer logic
      if (qrTimerDisplay) {
          qrTimerDisplay.style.display = 'block';
          qrTimerDisplay.innerText = '01:00';
          let timeLeft = 60;
          qrTimerInterval = setInterval(() => {
              timeLeft--;
              if (timeLeft <= 0) {
                  clearInterval(qrTimerInterval);
                  qrTimerDisplay.style.display = 'none';
              } else {
                  let seconds = timeLeft < 10 ? '0' + timeLeft : timeLeft;
                  qrTimerDisplay.innerText = '00:' + seconds;
              }
          }, 1000);
      }

      qrPromptTimer = setTimeout(() => {
          if (qrJoinPrompt) qrJoinPrompt.style.display = 'flex';
          if (qrTimerDisplay) qrTimerDisplay.style.display = 'none';
      }, 60000);
    });
    
    const closeQr = () => {
      qrModalOverlay.style.display = 'none';
      if (qrPromptTimer) clearTimeout(qrPromptTimer);
      if (qrTimerInterval) clearInterval(qrTimerInterval);
    };

    closeQrModal.addEventListener('click', closeQr);
    
    qrModalOverlay.addEventListener('click', (e) => {
      if (e.target === qrModalOverlay) closeQr();
    });

    if (btnQrJoinYes) {
        btnQrJoinYes.addEventListener('click', () => {
            if (qrPromptQuestion) qrPromptQuestion.style.display = 'none';
            if (qrPromptYesResponse) qrPromptYesResponse.style.display = 'flex';
            
            setTimeout(() => {
                chrome.storage.local.set({ sspcm_joined_community: true }, () => {
                    closeQr();
                    if (companyHeader) companyHeader.remove();
                    if (qrModalOverlay) qrModalOverlay.remove();
                });
            }, 3000); // 3 seconds delay to show thank you message
        });
    }

    if (btnQrJoinNo) {
        btnQrJoinNo.addEventListener('click', () => {
            if (qrPromptQuestion) qrPromptQuestion.style.display = 'none';
            if (qrPromptNoResponse) qrPromptNoResponse.style.display = 'flex';
        });
    }

    if (btnNoClose) {
        btnNoClose.addEventListener('click', () => {
            closeQr();
        });
    }
  }

  // Helper to show lock screens
  const showEmailLockScreen = (title, message) => {
    document.getElementById('lockTitle').innerText = title;
    document.getElementById('lockMessage').innerHTML = message;
    document.getElementById('email-lock-screen').style.display = 'flex';
    document.querySelector('.glass-panel').style.display = 'none';
    document.getElementById('registration-panel').style.display = 'none';
    const walletBox = document.getElementById('walletBox');
    if (walletBox) walletBox.style.display = 'none';
  };

  const hideEmailLockScreen = () => {
    document.getElementById('email-lock-screen').style.display = 'none';
    const walletBox = document.getElementById('walletBox');
    if (walletBox) walletBox.style.display = 'flex';
  };

  const btnRetryAuth = document.getElementById('btnRetryAuth');
  if (btnRetryAuth) {
    btnRetryAuth.addEventListener('click', () => {
      loadState();
    });
  }

  // Load configuration from local storage
  const loadState = () => {
    try {
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
      'ssp_agent_email',
      'ssp_wallet_balance'
    ], (data) => {
      // Get logged in Chrome email info
      chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
        const loginEmail = (userInfo && userInfo.email) ? userInfo.email.trim() : '';

        // Check for One-Time Agent Registration
        if (!data.ssp_agent_id || !data.ssp_agent_name || !data.ssp_agent_mob || !data.ssp_agent_email) {
          // Fill registration email field and disable editing
          const emailField = document.getElementById('regAgentEmail');
          if (emailField) {
            if (loginEmail) {
              emailField.value = loginEmail;
              emailField.disabled = true;
              emailField.style.opacity = '0.7';
              emailField.title = "Tied to your Google Chrome profile email.";
            } else {
              emailField.value = "";
              emailField.placeholder = "Please sign in to Chrome first";
              emailField.disabled = true;
              emailField.style.opacity = '0.7';
            }
          }

          document.querySelector('.glass-panel').style.display = 'none';
          document.getElementById('registration-panel').style.display = 'flex';
          hideEmailLockScreen();
          return; // Stop loading main UI
        }

        // If registered, verify that logged-in email matches the registered email
        if (!loginEmail) {
          showEmailLockScreen("Not Signed In", "You must sign into a Google Account on Chrome to use this extension.");
          return;
        }

        if (loginEmail.toLowerCase() !== data.ssp_agent_email.toLowerCase()) {
          showEmailLockScreen("Access Denied", `This extension is locked to the registered email:<br><b>${data.ssp_agent_email}</b>.<br><br>Your current Chrome email is:<br><b>${loginEmail}</b>.<br><br>Please log in to Chrome with the correct Google Account to continue.`);
          return;
        }

        // Email verification passed! Show normal UI
        hideEmailLockScreen();
        document.querySelector('.glass-panel').style.display = 'flex';
        document.getElementById('registration-panel').style.display = 'none';

        const walletPoints = document.getElementById('walletPoints');
        if (walletPoints) {
           walletPoints.innerText = data.ssp_wallet_balance || 0;
        }

        const agentNameBadge = document.getElementById('displayAgentName');
        if (agentNameBadge && data.ssp_agent_name) {
           agentNameBadge.innerText = "Agent Name: " + data.ssp_agent_name.toUpperCase();
        }
      
      const lowBalanceWarning = document.getElementById('lowBalanceWarning');
      if (lowBalanceWarning) {
         if ((data.ssp_wallet_balance || 0) < 10) {
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

      // Lock input fields if the engine is running

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

    });
  });
  } catch(e) {
    console.warn("Context invalidated, skipping state load.");
  }
};

  // Generate secure password
  function generateAndSavePassword() {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const pass = "Karnatak@" + randomDigits;
    newPasswordInput.value = pass;
    saveField('ssp_new_password', pass);
  }

  // Helper to save a single field to local storage
  function saveField(key, val) {
    const obj = {};
    obj[key] = val;
    chrome.storage.local.set(obj);
  }

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
      if (currentBal < 10) {
        alert("Insufficient balance! You need at least 10 points to start. Please click the Wallet badge at the top-right to recharge.");
        return;
      }

      // Prepare temp parameters in storage
      chrome.storage.local.set({
        ssp_student_id: sspId,
        ssp_new_password: pwd,
        ssp_new_mobile: newMobile,
        sspcm_active: true,
        ssp_pending_payment: false,
        ssp_task_type: 'password_reset',
        ssp_points_debited: false
      }, () => {
        // Open/Update the SSP portal directly
        openOrUpdateTab("https://ssp.postmatric.karnataka.gov.in/post_sa/ResetPassword.aspx");
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
      const email = document.getElementById('regAgentEmail').value.trim();

      if (!name || !mob || !email) {
        alert('Please fill out all fields to configure this computer.');
        return;
      }
      
      if (mob.length !== 10) {
        alert('Please enter a valid 10-digit mobile number.');
        return;
      }

      if (!email.includes('@') || !email.includes('.')) {
        alert('Please enter a valid email address.');
        return;
      }

      // Show Inquiry Modal
      document.getElementById('sspIdModalOverlay').style.display = 'flex';
      document.getElementById('modalInquiry').style.display = 'flex';
      document.getElementById('modalEntry').style.display = 'none';
    });
  }

  // Handle Inquiry Modal Buttons
  const btnNoSspId = document.getElementById('btnNoSspId');
  if (btnNoSspId) {
    btnNoSspId.addEventListener('click', () => {
      document.getElementById('modalInquiry').style.display = 'none';
      document.getElementById('modalAadhaarEntry').style.display = 'flex';
      const aadhaarInput = document.getElementById('regAadhaarInput');
      if (aadhaarInput) aadhaarInput.focus();
    });
  }

  const btnYesSspId = document.getElementById('btnYesSspId');
  if (btnYesSspId) {
    btnYesSspId.addEventListener('click', () => {
      document.getElementById('modalInquiry').style.display = 'none';
      document.getElementById('modalEntry').style.display = 'flex';
      const inputField = document.getElementById('regSspIdInput');
      if (inputField) inputField.focus();
    });
  }

  // Handle Entry Modal Buttons
  const btnBackToInquiry = document.getElementById('btnBackToInquiry');
  if (btnBackToInquiry) {
    btnBackToInquiry.addEventListener('click', () => {
      document.getElementById('modalEntry').style.display = 'none';
      document.getElementById('modalInquiry').style.display = 'flex';
    });
  }

  const btnBackToInquiryFromAadhaar = document.getElementById('btnBackToInquiryFromAadhaar');
  if (btnBackToInquiryFromAadhaar) {
    btnBackToInquiryFromAadhaar.addEventListener('click', () => {
      document.getElementById('modalAadhaarEntry').style.display = 'none';
      document.getElementById('modalInquiry').style.display = 'flex';
    });
  }

  const btnRunRegAutomation = document.getElementById('btnRunRegAutomation');
  if (btnRunRegAutomation) {
    btnRunRegAutomation.addEventListener('click', () => {
      const name = document.getElementById('regAgentName').value.trim();
      const mob = document.getElementById('regAgentMob').value.trim();
      const email = document.getElementById('regAgentEmail').value.trim();
      const aadhaar = document.getElementById('regAadhaarInput').value.trim();

      if (aadhaar.length !== 12) {
        alert('Please enter a valid 12-digit Aadhaar number.');
        return;
      }

      const saveBtnOriginalText = btnRunRegAutomation.innerText;
      btnRunRegAutomation.innerText = "Running Automation...";
      btnRunRegAutomation.disabled = true;

      // Save details to local storage to be picked up by the automation script
      chrome.storage.local.set({
        ssp_aadhaar_lookup: true,
        ssp_aadhaar_num: aadhaar,
        ssp_aadhaar_name: name,
        ssp_aadhaar_mobile: mob,
        ssp_agent_email_temp: email // Save email temporarily to sync later if ID is found
      }, () => {
        // Open the Know Your Student ID page in a background tab
        chrome.tabs.create({ 
          url: 'https://ssp.postmatric.karnataka.gov.in/post_sa/Know_Your_Student_ID.aspx', 
          active: false 
        });
        
        setTimeout(() => { 
          btnRunRegAutomation.innerText = saveBtnOriginalText; 
          btnRunRegAutomation.disabled = false;
        }, 5000);
      });
    });
  }

  const btnConfirmSspId = document.getElementById('btnConfirmSspId');
  if (btnConfirmSspId) {
    btnConfirmSspId.addEventListener('click', () => {
      const name = document.getElementById('regAgentName').value.trim();
      const mob = document.getElementById('regAgentMob').value.trim();
      const email = document.getElementById('regAgentEmail').value.trim();
      const sspId = document.getElementById('regSspIdInput').value.trim();

      if (!sspId) {
        alert('Please enter your SSP Student ID.');
        return;
      }

      chrome.storage.local.set({
        ssp_agent_name: name,
        ssp_agent_mob: mob,
        ssp_agent_email: email,
        ssp_agent_id: sspId,
        ssp_wallet_balance: 40
      }, () => {
        document.getElementById('sspIdModalOverlay').style.display = 'none';
        document.getElementById('registration-panel').style.display = 'none';
        document.getElementById('reg-success-modal').style.display = 'flex';
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

  // Open secure payment page when walletBox is clicked in the same tab
  const walletBox = document.getElementById('walletBox');
  if (walletBox) {
    walletBox.addEventListener('click', () => {
      window.location.href = "payment.html";
    });
  }

  // Periodically reload the state to reflect background changes in real-time
  setInterval(loadState, 1500);

  // Initial load
  loadState();

  // --- Native Animation Logic ---
  function playAnimation() {
      const cursor = document.getElementById('animCursor');
      const scene1 = document.getElementById('animScene1');
      const scene2 = document.getElementById('animScene2');
      const cameraBtn = document.getElementById('animCameraBtn');
      const scannedQr = document.getElementById('animScannedQr');
      const scanLine = document.getElementById('animScanLine');
      const scanText = document.getElementById('animScanText');
      const bottomSheet = document.getElementById('animBottomSheet');
      const joinBtn = document.getElementById('animJoinBtn');
      
      if(!cursor) return; // If elements don't exist

      // Reset states for looping
      cursor.style.top = '600px'; cursor.style.left = '150px'; cursor.style.animation = 'none';
      scene1.style.opacity = '1'; scene2.style.opacity = '0';
      cameraBtn.style.background = 'transparent';
      scanLine.style.animationPlayState = 'paused'; scanLine.style.top = '0'; scanLine.style.boxShadow = '0 0 10px #00a884, 0 0 20px #00a884'; scanLine.style.background = '#00a884';
      scannedQr.style.animation = 'none'; scannedQr.style.filter = 'blur(3px)'; scannedQr.style.transform = 'scale(1)';
      scanText.innerText = 'Scan QR code'; scanText.style.color = 'white';
      bottomSheet.style.bottom = '-250px';
      joinBtn.style.transform = 'scale(1)'; joinBtn.style.background = '#00a884'; joinBtn.style.color = '#111b21'; joinBtn.innerText = 'Join community';

      // TIMELINE
      setTimeout(() => { cursor.style.top = '15px'; cursor.style.left = '200px'; }, 500);
      setTimeout(() => { cursor.style.animation = 'animPulse 0.5s'; cameraBtn.style.background = 'rgba(255,255,255,0.2)'; }, 1500);
      setTimeout(() => {
          cameraBtn.style.background = 'transparent';
          scene1.style.opacity = '0'; scene2.style.opacity = '1';
          scanLine.style.animationPlayState = 'running';
          scannedQr.style.animation = 'animFocus 1.5s forwards';
          scanText.innerText = 'Scanning...';
          cursor.style.top = '500px'; cursor.style.left = '150px';
      }, 1800);
      setTimeout(() => {
          scanLine.style.animation = 'none'; scanLine.style.top = '110px';
          scanLine.style.boxShadow = '0 0 20px #00a884, 0 0 40px #00a884';
          scanText.innerText = 'QR Code Found'; scanText.style.color = '#00a884';
      }, 3500);
      setTimeout(() => { bottomSheet.style.bottom = '0'; }, 4000);
      setTimeout(() => { cursor.style.animation = 'none'; cursor.style.top = '540px'; cursor.style.left = '150px'; }, 4500);
      setTimeout(() => { cursor.style.animation = 'animPulse 0.5s'; joinBtn.style.transform = 'scale(0.95)'; joinBtn.style.background = '#018f6f'; }, 5500);
      setTimeout(() => {
          joinBtn.style.transform = 'scale(1)'; joinBtn.style.background = '#202c33'; joinBtn.style.color = '#00a884'; joinBtn.innerText = 'View community';
          cursor.style.top = '700px'; cursor.style.left = '200px';
      }, 5800);
      
      setTimeout(playAnimation, 8000);
  }
  
  // Start the infinite animation loop
  playAnimation();
});
chrome.storage.onChanged.addListener((changes, namespace) => { 
  if (namespace === 'local' && changes.ssp_agent_id && changes.ssp_agent_id.newValue) { 
    document.getElementById('sspIdModalOverlay').style.display = 'none'; 
    document.getElementById('registration-panel').style.display = 'none'; 
    document.getElementById('reg-success-modal').style.display = 'flex'; 
  } 

  if (namespace === 'local' && changes.ssp_prompt_create_id && changes.ssp_prompt_create_id.newValue) {
    chrome.storage.local.remove('ssp_prompt_create_id');
    document.getElementById('modalCreateIDPrompt').style.display = 'flex';
  }
});

document.getElementById('btnPromptCreateNo').addEventListener('click', () => {
  document.getElementById('modalCreateIDPrompt').style.display = 'none';
  chrome.storage.local.set({ ssp_cancel_create_id: true });
});

document.getElementById('btnPromptCreateYes').addEventListener('click', () => {
  document.getElementById('modalCreateIDPrompt').style.display = 'none';
  chrome.storage.local.set({ ssp_proceed_create_id: true });
});
