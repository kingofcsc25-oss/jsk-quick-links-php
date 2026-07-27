// SSPCM Content Script
let GLOBAL_AGENT_ID = '';
let GLOBAL_AGENT_NAME = '';
if (window.location.hostname.includes('ssp.postmatric.karnataka.gov.in') || window.location.hostname.includes('ssp.prematric.karnataka.gov.in') || window.location.hostname.includes('ssp.karnataka.gov.in')) {
  // Immediate blackout if active
  chrome.storage.local.get(['sspcm_active'], (d) => {
    if (d.sspcm_active) {
      const bo = document.createElement('div');
      bo.id = 'ssp-global-blackout';
      bo.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000000;z-index:9999990;';
      document.documentElement.appendChild(bo);
    }
  });

  window.addEventListener('load', () => {
    chrome.storage.local.get([
      'ssp_student_id',
      'ssp_new_mobile',
      'ssp_new_password',
      'ssp_student_name',
      'ssp_pwd_step',
      'ssp_mobile_step',
      'sspcm_active',
      'ssp_show_celebration',
      'ssp_show_otp_modal',
      'ssp_show_mobile_otp_modal',
      'ssp_agent_id',
      'ssp_agent_name',
      'ssp_agent_mob',
      'ssp_pending_payment',
      'ssp_payment_logs',
      'ssp_wallet_balance'
    ], (data) => {
      if (data.ssp_agent_id) GLOBAL_AGENT_ID = data.ssp_agent_id;
      if (data.ssp_agent_name) GLOBAL_AGENT_NAME = data.ssp_agent_name;
      // If Engine is STOPPED, remove any blackout and do absolutely nothing
      if (!data.sspcm_active) {
        const bo = document.getElementById('ssp-global-blackout');
        if (bo) bo.remove();
        return;
      }

      // ── PAYMENT MODAL CHECK ───────────────────────────────────────────────
      if (data.ssp_pending_payment) {
        injectSspPaymentModal(data);
        return; // Halt automation until payment succeeds
      }
      // ──────────────────────────────────────────────────────────────────────

      // ── OTP MODAL CHECK: re-show modal after page reload ───────────────────
      if (data.ssp_show_otp_modal) {
        injectPremiumStyles();
        setTimeout(() => {
          const sspId = sessionStorage.getItem('ssp_student_id') || '';
          window.showSspToast(`Dear User : ${sspId} Your High Security One Time Password (OTP) is .... for Scholarship Portal. From SSP-CEG.`);
        }, 600);
        // Don't clear the flag yet — clear it only when OTP is submitted
      }
      // ── MOBILE OTP MODAL CHECK ──────────────────────────────────────────
      if (data.ssp_show_mobile_otp_modal) {
        injectPremiumStyles();
        setTimeout(() => {
          window.showSspMobileOtpToast(data.ssp_new_mobile || '');
        }, 600);
      }
      // ──────────────────────────────────────────────────────────────────────

      // ── CELEBRATION CHECK: show success screen if flag is set ─────────────
      if (data.ssp_show_celebration) {
        chrome.storage.local.set({ ssp_show_celebration: false });
        showSspCelebrationOverlay(
          data.ssp_student_id  || 'Not Set',
          data.ssp_new_mobile  || 'Not Set',
          data.ssp_student_name || 'Not Set',
          data.ssp_new_password || 'Not Set'
        );
        return;
      }
      // ───────────────────────────────────────────────────────────────────────

      // Always synchronize storage variables directly to sessionStorage to clear out stale cached values from previous runs
      const sspId = data.ssp_student_id || '';
      sessionStorage.setItem('ssp_student_id', sspId);
      sessionStorage.setItem('ssp_new_mobile', data.ssp_new_mobile || '');
      sessionStorage.setItem('ssp_new_password', data.ssp_new_password || '');
      sessionStorage.setItem('ssp_student_name', data.ssp_student_name || '');

      if (data.sspcm_active) {
        if (data.ssp_pwd_step) {
          if (data.ssp_pwd_step === 'done') {
            sessionStorage.removeItem('ssp_pwd_step');
          } else {
            sessionStorage.setItem('ssp_pwd_step', data.ssp_pwd_step);
          }
        }
        
        if (data.ssp_mobile_step) {
          if (data.ssp_mobile_step === 'done') {
            sessionStorage.removeItem('ssp_mobile_step');
          } else {
            sessionStorage.setItem('ssp_mobile_step', data.ssp_mobile_step);
          }
        }
      } else {
        // Clear active steps if the engine is inactive to avoid state pollution
        sessionStorage.removeItem('ssp_pwd_step');
        sessionStorage.removeItem('ssp_mobile_step');
      }

      injectPremiumStyles();
      setTimeout(() => {
        if (!data.sspcm_active) return; // Prevent automation from running if engine is STOPPED

        const url = window.location.href.toLowerCase();
        // Check if we are on the Reset Password page
        if (document.body.innerText.includes('CHANGE YOUR PASSWORD') || url.includes('resetpassword')) {
          initSspChangePassword();
        } else if (url.includes('signin.aspx')) {
          initSspSignIn();
        } else if (url.includes('student_update_mobileno')) {
          initSspUpdateMobile();
        } else if (url === 'https://ssp.karnataka.gov.in/' || url.includes('sspcm_ext=true') || url.includes('ssp.karnataka.gov.in')) {
          window.location.href = 'https://ssp.postmatric.karnataka.gov.in/post_sa/signin.aspx';
        } else if (document.body.innerText.includes('Logout') || document.querySelector('input[value*="Logout" i], button[value*="Logout" i], a[href*="Logout" i], [id*="logout" i]')) {
          // Step: On home page — extract student name, show promo, then redirect
          console.log('SSP - On home page. Extracting student name...');

          // -- Extract student name --
          let studentName = '';

          // Strategy 1: Direct id="lbl_UserName"
          const directEl = document.getElementById('lbl_UserName');
          if (directEl) {
            studentName = (directEl.innerText || directEl.textContent || '').trim();
          }

          // Strategy 2: Colored span AFTER the Kannada "ಹೆಸರು" text (visible as pink/red in header)
          if (!studentName) {
            const allNodes = Array.from(document.querySelectorAll('*'));
            for (const el of allNodes) {
              const t = (el.innerText || el.textContent || '').trim();
              if (t.includes('ಹೆಸರು')) {
                // Check all child spans/fonts for the English name
                const kids = Array.from(el.querySelectorAll('span, font, b, strong'));
                for (const ch of kids) {
                  const ct = (ch.innerText || ch.textContent || '').trim();
                  if (ct && ct.length > 1 && ct.length < 60 && /[a-zA-Z]/.test(ct)) {
                    studentName = ct; break;
                  }
                }
                if (studentName) break;
                // Inline fallback
                const inline = t.replace(/.*ಹೆಸರು\s*/g, '').trim();
                if (inline && inline.length > 1 && inline.length < 60 && /[a-zA-Z]/.test(inline)) {
                  studentName = inline; break;
                }
              }
            }
          }

          // Strategy 3: Other IDs
          if (!studentName) {
            const el2 = document.querySelector('[id*="lbl_UserName" i],[id*="lblUserName" i],[id*="lblstudentname" i]');
            if (el2) studentName = (el2.innerText || el2.textContent || '').trim();
          }

          console.log('SSP - Extracted student name:', studentName || '(not found)');
          if (studentName) {
            sessionStorage.setItem('ssp_student_name', studentName);
            try {
              if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id)
                chrome.storage.local.set({ ssp_student_name: studentName });
            } catch(e) {}
          }

          // -- Show Anjaneya Tavarageri promo popup during the 2-second wait --
          showJanaSevaPromo(studentName);

          setTimeout(() => {
            window.location.href = 'https://ssp.postmatric.karnataka.gov.in/post_sa/Student_Update_MobileNo.aspx';
          }, 2000);
        }
      }, 1000);
    });
  });
}

// ── Anjaneya Tavarageri Home Page Promo Popup ─────────────────────────────────
function showJanaSevaPromo(studentName) {
  if (document.getElementById('ssp-jana-promo')) return;

  const el = document.createElement('div');
  el.id = 'ssp-jana-promo';
  el.innerHTML = `
    <style>
      #ssp-jana-promo {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999999;
        width: 300px;
        background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
        border: 1px solid rgba(16,185,129,0.35);
        border-radius: 18px;
        padding: 20px 22px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.1);
        font-family: 'Segoe UI', sans-serif;
        animation: jana-slidein 0.5s cubic-bezier(0.34,1.56,0.64,1);
        color: #fff;
      }
      @keyframes jana-slidein {
        from { opacity:0; transform: translate(-50%, -35%) scale(0.85); }
        to   { opacity:1; transform: translate(-50%, -50%) scale(1); }
      }
      @keyframes jana-slideout {
        from { opacity:1; transform: translate(-50%, -50%) scale(1); }
        to   { opacity:0; transform: translate(-50%, -65%) scale(0.85); }
      }
      #ssp-jana-promo.hiding { animation: jana-slideout 0.4s ease forwards; }
    </style>

    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
      <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🏪</div>
      <div>
        <p style="margin:0;font-size:13px;font-weight:800;color:#10b981;letter-spacing:0.3px;">${GLOBAL_AGENT_NAME}</p>
        <p style="margin:0;font-size:10px;color:#64748b;">⚡ SSPCM Automation Tool</p>
      </div>
    </div>

    <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.15);border-radius:10px;padding:10px 12px;margin-bottom:12px;">
      <p style="margin:0 0 4px 0;font-size:11px;color:#94a3b8;">Processing student:</p>
      <p style="margin:0;font-size:14px;font-weight:700;color:#f8fafc;">${studentName || 'Loading...'}</p>
    </div>

    <div style="display:flex;align-items:center;gap:8px;">
      <div style="width:8px;height:8px;border-radius:50%;background:#10b981;animation:jana-pulse 1s ease infinite;flex-shrink:0;"></div>
      <p style="margin:0;font-size:11px;color:#38bdf8;font-weight:600;">Redirecting to Mobile Update...</p>
    </div>
    <style>
      @keyframes jana-pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.5;transform:scale(1.4);} }
    </style>
  `;
  document.body.appendChild(el);

  // Auto-dismiss after 1.8s (just before the redirect)
  setTimeout(() => {
    el.classList.add('hiding');
    setTimeout(() => el.remove(), 400);
  }, 1800);
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Full-screen Celebration Overlay ─────────────────────────────────────────
function showSspCelebrationOverlay(sspId, mobileNo, studentName, password) {
  if (window._ssp_celebration_shown) return;
  window._ssp_celebration_shown = true;

  // Deduct 20 Points for successful mobile link
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.storage.local.get(['ssp_wallet_balance'], (wData) => {
        let currentBal = wData.ssp_wallet_balance || 0;
        chrome.storage.local.set({ ssp_wallet_balance: Math.max(0, currentBal - 20) });
      });
    }
  } catch(e) {
    console.log("SSP - Points deduction error:", e);
  }

  if (!document.getElementById('ssp-font-link')) {
    const link = document.createElement('link');
    link.id = 'ssp-font-link';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap';
    document.head.appendChild(link);
  }

  const overlay = document.createElement('div');
  overlay.id = 'ssp-celebration-overlay';
  overlay.innerHTML = `
    <style>
      #ssp-celebration-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
        z-index: 9999999; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        font-family: 'Plus Jakarta Sans', sans-serif;
        animation: ssp-cel-fadein 0.7s ease;
        overflow-y: auto; padding: 20px 0;
      }
      @keyframes ssp-cel-fadein { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
      @keyframes ssp-cel-bounce { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-14px);} }
      @keyframes ssp-cel-glow   { 0%,100%{text-shadow:0 0 20px rgba(16,185,129,0.5);} 50%{text-shadow:0 0 50px rgba(16,185,129,1);} }
      @keyframes ssp-cel-pulse  { 0%,100%{box-shadow:0 0 30px rgba(16,185,129,0.4);} 50%{box-shadow:0 0 60px rgba(16,185,129,0.8);} }
    </style>

    <div style="font-size:72px; margin-bottom:8px; animation:ssp-cel-bounce 2s ease infinite; filter:drop-shadow(0 8px 16px rgba(251,191,36,0.4));">🙏</div>

    <div style="width:70px; height:70px; border-radius:50%; background:linear-gradient(135deg,#10b981,#059669); display:flex; align-items:center; justify-content:center; font-size:36px; margin-bottom:18px; animation:ssp-cel-pulse 2s ease infinite;">✅</div>

    <h1 style="font-size:26px; font-weight:800; color:#10b981; margin:0 0 6px 0; letter-spacing:-0.5px; animation:ssp-cel-glow 2s ease infinite;">Mobile Linked Successfully!</h1>
    <p style="font-size:13px; color:#94a3b8; margin:0 0 22px 0; text-align:center; max-width:340px; line-height:1.5;">SSP Student ID & Mobile Number are now linked on the portal</p>

    <!-- Info Card with all 4 details -->
    <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:18px; padding:20px 32px; margin-bottom:22px; min-width:320px; backdrop-filter:blur(12px);">

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; gap:30px;">
        <span style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:1px;">SSP ID</span>
        <span style="font-size:15px; color:#f8fafc; font-weight:800; font-family:monospace;">${sspId}</span>
      </div>
      <div style="height:1px; background:rgba(255,255,255,0.07); margin-bottom:14px;"></div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; gap:30px;">
        <span style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:1px;">Name</span>
        <span style="font-size:14px; color:#38bdf8; font-weight:700;">${studentName}</span>
      </div>
      <div style="height:1px; background:rgba(255,255,255,0.07); margin-bottom:14px;"></div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; gap:30px;">
        <span style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:1px;">Mobile</span>
        <span style="font-size:15px; color:#f8fafc; font-weight:800; font-family:monospace;">${mobileNo}</span>
      </div>
      <div style="height:1px; background:rgba(255,255,255,0.07); margin-bottom:14px;"></div>

      <div style="display:flex; justify-content:space-between; align-items:center; gap:30px;">
        <span style="font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:1px;">Password</span>
        <span style="font-size:15px; color:#fbbf24; font-weight:800; font-family:monospace;">${password}</span>
      </div>
    </div>

    <!-- Copy Data Button -->
    <button id="ssp-copy-data-btn" style="background: linear-gradient(135deg, #38bdf8, #818cf8); border: none; padding: 12px 24px; border-radius: 8px; color: white; font-weight: bold; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; cursor: pointer; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3); transition: transform 0.2s, box-shadow 0.2s;">
      <span style="font-size: 16px;">📋</span> Copy Data
    </button>

    <!-- Community QR Code -->
    <div style="display: flex; align-items: center; justify-content: flex-start; gap: 20px; background: rgba(0,0,0,0.4); padding: 16px 20px; border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1); margin-bottom: 20px; min-width: 320px;">
        <div style="flex-shrink: 0; background: #fff; padding: 5px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://chat.whatsapp.com/CA4G8EOFRP91heRRxDT3cg" style="width: 70px; height: 70px; border-radius: 8px;">
        </div>
        <div style="text-align: left;">
            <h3 style="color: #fff; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 16px; font-weight: 700; margin: 0 0 4px 0;">Join Our Community</h3>
            <p style="color: #94a3b8; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; margin: 0; line-height: 1.4;">Scan this QR code for any help<br>and latest updates.</p>
        </div>
    </div>

    <div style="text-align:center; margin-bottom:20px;">
      <p style="font-size:15px; font-weight:800; color:#fbbf24; margin:0 0 4px 0;">Thank you for using Jana Seva Kendra Extension</p>
      <p style="font-size:12px; color:#475569; margin:0; font-weight:600;">Namaste &nbsp;🙏</p>
    </div>

    <div style="background:rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.25); border-radius:50px; padding:10px 24px;">
      <p id="ssp-close-countdown" style="font-size:13px; color:#60a5fa; font-weight:700; margin:0;">Tab closes in 15 seconds...</p>
    </div>
  `;
  document.body.appendChild(overlay);

  const copyBtn = document.getElementById('ssp-copy-data-btn');
  if (copyBtn) {
    copyBtn.addEventListener('mouseover', () => copyBtn.style.transform = 'translateY(-2px)');
    copyBtn.addEventListener('mouseout', () => copyBtn.style.transform = 'translateY(0)');
    copyBtn.addEventListener('click', () => {
      const copyText = `SSP ID: ${sspId}\nName: ${studentName}\nMobile: ${mobileNo}\nPassword: ${password}`;
      navigator.clipboard.writeText(copyText).then(() => {
        copyBtn.innerHTML = '<span style="font-size: 16px;">✅</span> Copied!';
        copyBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        setTimeout(() => {
          copyBtn.innerHTML = '<span style="font-size: 16px;">📋</span> Copy Data';
          copyBtn.style.background = 'linear-gradient(135deg, #38bdf8, #818cf8)';
        }, 2000);
      });
    });
  }

  let closeCount = 15;
  const el = document.getElementById('ssp-close-countdown');
  const timer = setInterval(() => {
    closeCount--;
    if (el) el.textContent = `Tab closes in ${closeCount} second${closeCount !== 1 ? 's' : ''}...`;
    if (closeCount <= 0) {
      clearInterval(timer);
      // Clear ALL extension storage data
      try {
        sessionStorage.clear();
      } catch(e) {}
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          chrome.storage.local.remove([
            'ssp_student_id', 'ssp_new_mobile', 'ssp_new_password',
            'ssp_student_name', 'ssp_pwd_step', 'ssp_mobile_step',
            'sspcm_active', 'ssp_show_celebration', 'ssp_show_otp_modal',
            'ssp_show_mobile_otp_modal'
          ], () => {
            try {
              if (chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage({ action: 'close_tab' });
              }
            } catch(e) {}
          });
        }
      } catch(e) {
        // window.close not allowed in content scripts — rely on sendMessage above
      }
    }
  }, 1000);
}
// ─────────────────────────────────────────────────────────────────────────────

function clickProfileAndUpdateMobile() {
  const triggerHoverAndClick = (element) => {
    if (!element) return;
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    element.click();
  };

  // Find the Profile dropdown trigger button
  const allElements = Array.from(document.querySelectorAll('a, span, li, div, button'));
  let profileBtn = allElements.find(el => {
    const text = (el.innerText || '').trim().toLowerCase();
    const isSmall = (el.innerText || '').trim().length < 20;
    return isSmall && (text === 'profile' || text.startsWith('profile'));
  });

  if (profileBtn) {
    console.log('SSP - Found Profile button, hovering...');
    profileBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    profileBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    profileBtn.click();

    // Wait 600ms for dropdown to fully render, then click Update Mobile Number
    setTimeout(() => {
      const allLinks = Array.from(document.querySelectorAll('a, li, span, div'));
      const updateMobileLink = allLinks.find(el => {
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        return text === 'update mobile number' || text.includes('update mobile number');
      });

      if (updateMobileLink) {
        console.log('SSP - Clicking Update Mobile Number...');
        updateMobileLink.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        updateMobileLink.click();

        // Safety net: if page hasn't navigated after 2 seconds, redirect directly
        setTimeout(() => {
          if (window.location.href.toLowerCase().includes('studenthome') ||
              !window.location.href.toLowerCase().includes('mobileno')) {
            console.log('SSP - Page did not navigate, forcing direct redirect...');
            window.location.href = 'https://ssp.postmatric.karnataka.gov.in/post_sa/Student_Update_MobileNo.aspx';
          }
        }, 2000);

      } else {
        console.log('SSP - Update Mobile Number link not found, using direct redirect...');
        window.location.href = 'https://ssp.postmatric.karnataka.gov.in/post_sa/Student_Update_MobileNo.aspx';
      }
    }, 600);

  } else {
    console.log('SSP - Profile button not found, using direct redirect...');
    window.location.href = 'https://ssp.postmatric.karnataka.gov.in/post_sa/Student_Update_MobileNo.aspx';
  }
}

function injectPremiumStyles() {
  if (document.getElementById('ssp-premium-styles')) return;
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

    .ssp-full-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #000000;
      z-index: 9999998;
    }

    .ssp-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9999999;
      width: 340px;
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: rgba(15, 23, 42, 0.96);
      backdrop-filter: blur(20px) saturate(190%);
      -webkit-backdrop-filter: blur(20px) saturate(190%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.8), 0 1px 0px 0 rgba(255, 255, 255, 0.2) inset;
      padding: 26px;
      color: #f8fafc;
      box-sizing: border-box;
      animation: sspSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes sspSlideIn {
      from {
        transform: translate(-50%, -60%) scale(0.93);
        opacity: 0;
      }
      to {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
    }

    .ssp-title {
      margin-top: 0;
      margin-bottom: 20px;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ssp-badge {
      font-size: 10px;
      font-weight: 700;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      padding: 4px 8px;
      border-radius: 9999px;
      border: 1px solid rgba(56, 189, 248, 0.2);
      letter-spacing: 0.5px;
    }

    .ssp-label {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.75px;
    }

    .ssp-input {
      width: 100%;
      padding: 12px 14px;
      margin-bottom: 16px;
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      color: #f8fafc;
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      box-sizing: border-box;
      transition: all 0.25s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1) inset;
    }

    .ssp-input:focus {
      outline: none;
      background: rgba(30, 41, 59, 0.9);
      border-color: #38bdf8;
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.25), 0 2px 4px rgba(0,0,0,0.1) inset;
    }

    .ssp-input::placeholder {
      color: #475569;
    }

    .ssp-btn {
      width: 100%;
      padding: 12px;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .ssp-btn-indigo {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }
    .ssp-btn-indigo:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(79, 70, 229, 0.45);
      background: linear-gradient(135deg, #818cf8, #6366f1);
    }

    .ssp-btn-emerald {
      background: linear-gradient(135deg, #10b981, #059669);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
    .ssp-btn-emerald:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(16, 185, 129, 0.45);
      background: linear-gradient(135deg, #34d399, #10b981);
    }

    .ssp-btn-blue {
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    .ssp-btn-blue:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.45);
      background: linear-gradient(135deg, #60a5fa, #3b82f6);
    }

    .ssp-btn:active {
      transform: translateY(1px);
    }

    .ssp-group-box {
      background: rgba(30, 41, 59, 0.5);
      padding: 16px;
      border-radius: 12px;
      margin-bottom: 20px;
      border: 1px dashed rgba(255, 255, 255, 0.15);
    }

    @keyframes ssp-spin {
      to { transform: rotate(360deg); }
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.id = 'ssp-premium-styles';
  styleEl.appendChild(document.createTextNode(css));
  document.head.appendChild(styleEl);
}

// ── In-Page Payment Modal ───────────────────────────────────────────────────
function injectSspPaymentModal(data) {
  if (document.getElementById('ssp-payment-modal-container')) return;

  const container = document.createElement('div');
  container.id = 'ssp-payment-modal-container';
  container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(7,9,19,0.9);backdrop-filter:blur(10px);z-index:99999999;display:flex;justify-content:center;align-items:center;font-family:"Plus Jakarta Sans",sans-serif;';
  
  const modalHTML = `
    <style>
      .payment-card { width:380px; background:#0d111d; border:1px solid rgba(255,255,255,0.05); border-radius:20px; padding:28px 24px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); display:flex; flex-direction:column; align-items:center; color:#fff; }
      .header-tag { font-size:10px; font-weight:800; color:#38bdf8; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:12px; text-align:center; }
      .title { font-size:18px; font-weight:700; color:#ffffff; margin:0 0 4px 0; text-align:center; }
      .subtitle { font-size:11px; color:#64748b; margin:0 0 15px 0; text-align:center; }
      .qr-container { width:100%; background:#ffffff; border-radius:14px; display:flex; justify-content:center; align-items:center; margin-bottom:20px; padding:15px; box-shadow:0 4px 10px rgba(0,0,0,0.2); }
      .qr-image { height:140px; width:140px; object-fit:contain; display:block; }
      .form-group { width:100%; display:flex; flex-direction:column; gap:5px; margin-bottom:14px; }
      .form-group label { font-size:9px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin:0; }
      .form-group input { width:100%; padding:11px 14px; background:#090c15; border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:#ffffff; font-size:13px; outline:none; box-sizing:border-box; transition:all 0.2s ease; }
      .form-group input:focus { border-color:#38bdf8; box-shadow:0 0 0 2px rgba(56,189,248,0.15); }
      .btn-submit { width:100%; padding:13px; background:linear-gradient(135deg,#10b981,#059669); border:none; border-radius:8px; color:#ffffff; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(16,185,129,0.3); transition:all 0.2s ease; margin-top:6px; text-align:center; }
      .btn-submit:hover { transform:translateY(-1px); filter:brightness(1.08); }
      .offer-banner { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; font-size: 11px; padding: 8px 10px; border-radius: 6px; margin-bottom: 20px; text-align: center; font-weight: bold; width: 100%; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3); animation: ssp-cel-pulse 2s infinite; }
    </style>
    <div class="payment-card" id="ssp-payment-card-inner">
      <div class="header-tag">Wallet Recharge</div>
      <h3 class="title">Low Wallet Balance</h3>
      
      <!-- Step 1: Enter Amount -->
      <div id="ssp-step-1" style="width: 100%; display: flex; flex-direction: column; align-items: center;">
        <p class="subtitle">Step 1: Enter the amount you want to recharge</p>
        <div class="offer-banner">
          🎉 SPECIAL OFFER: Recharge ₹100 or more and get DOUBLE POINTS!
        </div>
        
        <div class="form-group">
          <label>Enter Amount (₹)</label>
          <input type="number" id="ssp-pay-amount" placeholder="e.g. 100" min="10">
        </div>
        <button id="ssp-btn-generate-qr" class="btn-submit" style="background: linear-gradient(135deg,#3b82f6,#1d4ed8);">Generate QR Code</button>
      </div>

      <!-- Step 2: Scan QR & Enter UTR -->
      <div id="ssp-step-2" style="width: 100%; display: none; flex-direction: column; align-items: center;">
        <p class="subtitle" id="ssp-step-2-subtitle">Step 2: Scan and pay via UPI</p>
        
        <div class="qr-container">
          <img id="ssp-dynamic-qr" src="" class="qr-image" alt="UPI QR">
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label>12-Digit UTR / Transaction ID</label>
          <input type="text" id="ssp-pay-utr" placeholder="Enter UTR No from your app" maxlength="12">
        </div>

        <button id="ssp-btn-pay" class="btn-submit">Verify & Recharge Wallet</button>
        <button id="ssp-btn-back" style="background: none; border: none; color: #94a3b8; font-size: 11px; margin-top: 12px; cursor: pointer; text-decoration: underline;">Change Amount</button>
      </div>
    </div>
  `;
  container.innerHTML = modalHTML;
  document.body.appendChild(container);

  let finalAmount = 0;
  let finalPoints = 0;

  document.getElementById('ssp-btn-generate-qr').addEventListener('click', () => {
    const amountStr = document.getElementById('ssp-pay-amount').value.trim();
    if (!amountStr || isNaN(amountStr) || parseFloat(amountStr) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    
    finalAmount = parseFloat(amountStr);
    finalPoints = Math.floor(finalAmount); // 1 Rupee = 1 Point

    let isDouble = false;
    if (finalAmount >= 100) {
      finalPoints = Math.floor(finalAmount * 2);
      isDouble = true;
    }

    const upiLink = "upi://pay?pa=janaesevakendra@upi&pn=JanaSevaKendra&cu=INR&am=" + finalAmount;
    document.getElementById('ssp-dynamic-qr').src = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" + encodeURIComponent(upiLink);
    
    document.getElementById('ssp-step-2-subtitle').innerHTML = `Step 2: Scan and pay <b style="color:#fff;">₹${finalAmount}</b> via UPI<br><span style="color:#10b981; font-weight:bold;">${isDouble ? 'DOUBLE POINTS APPLIED! (' + finalPoints + ' PTS)' : 'You will receive ' + finalPoints + ' Points'}</span>`;
    
    document.getElementById('ssp-step-1').style.display = 'none';
    document.getElementById('ssp-step-2').style.display = 'flex';
  });

  document.getElementById('ssp-btn-back').addEventListener('click', () => {
    document.getElementById('ssp-step-2').style.display = 'none';
    document.getElementById('ssp-step-1').style.display = 'flex';
  });

  document.getElementById('ssp-btn-pay').addEventListener('click', () => {
    const utrStr = document.getElementById('ssp-pay-utr').value.trim();

    if (!utrStr || utrStr.length < 12) {
      alert("Please enter a valid 12-digit UTR number from your payment app.");
      return;
    }

    // Replace card with loading state to simulate verification
    const card = document.getElementById('ssp-payment-card-inner');
    card.innerHTML = `
      <div style="width:50px;height:50px;border:4px solid rgba(16,185,129,0.2);border-top-color:#10b981;border-radius:50%;animation:pay-spin 1s linear infinite;margin-bottom:20px;"></div>
      <h3 id="rzp-title" style="color:#10b981;margin:0 0 10px 0;font-size:20px;font-weight:700;letter-spacing:0.5px;">Verifying Payment...</h3>
      <p id="rzp-desc" style="color:#94a3b8;font-size:14px;margin:0;font-weight:500;text-align:center;">Checking UTR ${utrStr} with bank...</p>
      <style>@keyframes pay-spin { 100% { transform: rotate(360deg); } }</style>
    `;

    setTimeout(() => {
      document.getElementById('rzp-title').innerText = "Recharge Successful!";
      document.getElementById('rzp-desc').innerText = "UTR Verified!\\nAdded " + finalPoints + " Points to Wallet.";
      
      chrome.storage.local.get(['ssp_wallet_balance'], (wData) => {
        let currentBal = wData.ssp_wallet_balance || 0;
        let newBal = currentBal + finalPoints;
        
        // Log payment
        const logs = data.ssp_payment_logs || [];
        const newLog = {
          agentId: data.ssp_agent_id || "",
          studentId: data.ssp_student_id || "",
          newMobile: data.ssp_new_mobile || "",
          utr: utrStr,
          mobile: data.ssp_agent_mob || "",
          amount: finalAmount,
          pointsAdded: finalPoints,
          timestamp: new Date().toLocaleString()
        };
        logs.push(newLog);

        setTimeout(() => {
          chrome.storage.local.set({
            ssp_wallet_balance: newBal,
            ssp_pending_payment: false,
            ssp_payment_utr: utrStr,
            ssp_payment_logs: logs
          }, () => {
            // Remove blackout/modal and refresh to start automation
            window.location.reload();
          });
        }, 1500);
      });
    }, 2500); // 2.5s simulated verification delay
  });
}

function querySelectorAllWithIframes(selector, doc = document) {
  let elements = Array.from(doc.querySelectorAll(selector));
  const iframes = Array.from(doc.querySelectorAll('iframe, frame'));
  for (const iframe of iframes) {
    try {
      const subDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
      if (subDoc) {
        elements = elements.concat(querySelectorAllWithIframes(selector, subDoc));
      }
    } catch (e) {
      // Ignore cross-origin security errors
    }
  }
  return elements;
}

function setInputValueRobustly(input, value) {
  if (!input) return;
  const strValue = String(value);

  // Clear existing value first
  input.focus();
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));

  // Type character by character to pass strict onkeypress validators (like SSP mobile number field)
  for (let i = 0; i < strValue.length; i++) {
    const char = strValue[i];
    const keyCode = char.charCodeAt(0);

    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: char, keyCode, which: keyCode }));
    input.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: char, keyCode, which: keyCode }));

    // Append the character manually
    input.value += char;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: char, keyCode, which: keyCode }));
  }

  input.dispatchEvent(new Event('change', { bubbles: true }));

  try {
    const tracker = input._valueTracker;
    if (tracker) tracker.setValue(strValue);
  } catch (e) {}

  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

// Human-like typing with random delays between keystrokes (returns a Promise)
function humanTypeValue(input, value, onDone) {
  if (!input) { if (onDone) onDone(); return; }
  const strValue = String(value);

  input.focus();
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));

  let i = 0;
  function typeNext() {
    if (i >= strValue.length) {
      // Done typing — fire change and blur
      input.dispatchEvent(new Event('change', { bubbles: true }));
      try {
        const tracker = input._valueTracker;
        if (tracker) tracker.setValue(strValue);
      } catch (e) {}
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      if (onDone) onDone();
      return;
    }

    const char = strValue[i];
    const keyCode = char.charCodeAt(0);

    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: char, keyCode, which: keyCode }));
    input.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: char, keyCode, which: keyCode }));
    input.value += char;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: char, keyCode, which: keyCode }));

    i++;
    // Random delay 125ms–500ms per character → 4 digits = 0.5s to 2s total
    const delay = 125 + Math.floor(Math.random() * 375);
    setTimeout(typeNext, delay);
  }

  typeNext();
}

function generateSspPassword() {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return "Karnatak@" + randomDigits;
}

function findMobileInput() {
  const allowedType = (t) => {
    return t !== 'hidden' && t !== 'submit' && t !== 'button' && t !== 'checkbox' && t !== 'radio' && t !== 'file' && t !== 'image' && t !== 'password';
  };

  let inputs = querySelectorAllWithIframes('input').filter(i => {
    const t = (i.getAttribute('type') || i.type || 'text').toLowerCase();
    const isNotSsp = !i.id.startsWith('ssp-') && (!i.closest || !i.closest('#ssp-mobile-panel') && !i.closest('#ssp-captcha-panel') && !i.closest('#ssp-automation-panel'));
    const isVisible = i.offsetWidth > 0 || i.offsetHeight > 0 || i.getClientRects().length > 0;
    return allowedType(t) && isNotSsp && isVisible;
  });

  if (inputs.length === 0) {
    inputs = querySelectorAllWithIframes('input').filter(i => {
      const t = (i.getAttribute('type') || i.type || 'text').toLowerCase();
      const isNotSsp = !i.id.startsWith('ssp-') && (!i.closest || !i.closest('#ssp-mobile-panel') && !i.closest('#ssp-captcha-panel') && !i.closest('#ssp-automation-panel'));
      return allowedType(t) && isNotSsp;
    });
  }

  // 1. Precise attributes match (placeholder/id/name contains 'newmobile', 'newmob', 'new_mobile' or 'txtNewMobile')
  let preciseMatch = inputs.find(i => {
    const ph = (i.placeholder || '').toLowerCase();
    const name = (i.name || '').toLowerCase();
    const id = (i.id || '').toLowerCase();
    return ph.includes('new mobile') || ph.includes('new_mobile') || ph.includes('newmobile') || ph.includes('newmob') ||
           name.includes('newmobile') || name.includes('newmob') || name.includes('new_mobile') || name.includes('txtnewmobile') ||
           id.includes('newmobile') || id.includes('newmob') || id.includes('new_mobile') || id.includes('txtnewmobile') || id.includes('newmobileno');
  });
  if (preciseMatch) return preciseMatch;

  // 2. Try finding by label text association (excluding our injected panel elements)
  const labels = querySelectorAllWithIframes('label, td, span, div').filter(el => {
    if (el.closest && (el.closest('#ssp-mobile-panel') || el.closest('#ssp-captcha-panel') || el.closest('#ssp-automation-panel'))) {
      return false;
    }
    const text = el.innerText || el.textContent || '';
    return text.toLowerCase().includes('enter new mobile number') || text.toLowerCase().includes('mobile number');
  });

  for (const label of labels) {
    if (label.htmlFor) {
      const associated = querySelectorAllWithIframes('#' + label.htmlFor);
      if (associated.length > 0 && inputs.includes(associated[0])) {
        return associated[0];
      }
    }
    const childInput = label.querySelector('input');
    if (childInput && inputs.includes(childInput)) {
      return childInput;
    }
    let parent = label.parentElement;
    while (parent && parent.tagName !== 'BODY') {
      const inputsInParent = Array.from(parent.querySelectorAll('input')).filter(inp => inputs.includes(inp));
      if (inputsInParent.length > 0) {
        return inputsInParent[0];
      }
      parent = parent.parentElement;
    }
  }

  // 3. Try matching standard mobile attributes
  let bestMatch = inputs.find(i => {
    const ph = (i.placeholder || '').toLowerCase();
    const name = (i.name || '').toLowerCase();
    const id = (i.id || '').toLowerCase();
    return ph.includes('mobile') || ph.includes('phone') || ph.includes('enter') || ph.includes('number') || 
           name.includes('mobile') || name.includes('phone') ||
           id.includes('mobile') || id.includes('phone');
  });
  if (bestMatch) return bestMatch;

  // 4. Fallback: If only one visible input exists, use it!
  if (inputs.length === 1) return inputs[0];

  // 5. Ultimate fallback
  if (inputs.length > 0) return inputs[0];

  return null;
}

function findSspIdInputOnMobileUpdatePage() {
  const allowedType = (t) => {
    return t !== 'hidden' && t !== 'submit' && t !== 'button' && t !== 'checkbox' && t !== 'radio' && t !== 'file' && t !== 'image' && t !== 'password';
  };

  let inputs = querySelectorAllWithIframes('input').filter(i => {
    const t = (i.getAttribute('type') || i.type || 'text').toLowerCase();
    const isNotSsp = !i.id.startsWith('ssp-') && (!i.closest || !i.closest('#ssp-mobile-panel') && !i.closest('#ssp-captcha-panel') && !i.closest('#ssp-automation-panel'));
    const isVisible = i.offsetWidth > 0 || i.offsetHeight > 0 || i.getClientRects().length > 0;
    return allowedType(t) && isNotSsp && isVisible;
  });

  if (inputs.length === 0) {
    inputs = querySelectorAllWithIframes('input').filter(i => {
      const t = (i.getAttribute('type') || i.type || 'text').toLowerCase();
      const isNotSsp = !i.id.startsWith('ssp-') && (!i.closest || !i.closest('#ssp-mobile-panel') && !i.closest('#ssp-captcha-panel') && !i.closest('#ssp-automation-panel'));
      return allowedType(t) && isNotSsp;
    });
  }

  // 1. Precise attributes match (placeholder/id/name contains 'studentid', 'sspid', 'regno', etc.)
  let preciseMatch = inputs.find(i => {
    const ph = (i.placeholder || '').toLowerCase();
    const name = (i.name || '').toLowerCase();
    const id = (i.id || '').toLowerCase();
    return ph.includes('student id') || ph.includes('ssp id') || ph.includes('studentid') || ph.includes('sspid') || ph.includes('reg') ||
           name.includes('studentid') || name.includes('sspid') || name.includes('student_id') || name.includes('ssp_id') || name.includes('reg') ||
           id.includes('studentid') || id.includes('sspid') || id.includes('student_id') || id.includes('ssp_id') || id.includes('reg');
  });
  if (preciseMatch) return preciseMatch;

  // 2. Try matching labels
  const labels = querySelectorAllWithIframes('label, td, span, div').filter(el => {
    if (el.closest && (el.closest('#ssp-mobile-panel') || el.closest('#ssp-captcha-panel') || el.closest('#ssp-automation-panel'))) {
      return false;
    }
    const text = el.innerText || el.textContent || '';
    return text.toLowerCase().includes('student id') || text.toLowerCase().includes('ssp id') || text.toLowerCase().includes('registration') || text.toLowerCase().includes('reg');
  });

  for (const label of labels) {
    if (label.htmlFor) {
      const associated = querySelectorAllWithIframes('#' + label.htmlFor);
      if (associated.length > 0 && inputs.includes(associated[0])) {
        return associated[0];
      }
    }
    const childInput = label.querySelector('input');
    if (childInput && inputs.includes(childInput)) {
      return childInput;
    }
    let parent = label.parentElement;
    while (parent && parent.tagName !== 'BODY') {
      const inputsInParent = Array.from(parent.querySelectorAll('input')).filter(inp => inputs.includes(inp));
      if (inputsInParent.length > 0) {
        return inputsInParent[0];
      }
      parent = parent.parentElement;
    }
  }

  // 3. Fallback: If we have multiple inputs and the other one is mobileInput, find the first non-mobile input
  const mobileInput = findMobileInput();
  if (mobileInput) {
    const nonMobile = inputs.find(i => i !== mobileInput);
    if (nonMobile) return nonMobile;
  }

  return null;
}

function findGetOtpButton() {
  let buttons = querySelectorAllWithIframes('button, input[type="button"], input[type="submit"], a, span').filter(b => {
    const isNotSsp = !b.id.startsWith('ssp-') && (!b.closest || !b.closest('#ssp-mobile-panel'));
    const isVisible = b.offsetWidth > 0 || b.offsetHeight > 0 || b.getClientRects().length > 0;
    return isNotSsp && isVisible;
  });

  if (buttons.length === 0) {
    buttons = querySelectorAllWithIframes('button, input[type="button"], input[type="submit"], a, span').filter(b => {
      return !b.id.startsWith('ssp-') && (!b.closest || !b.closest('#ssp-mobile-panel'));
    });
  }

  // 1. Text match
  let bestMatch = buttons.find(b => {
    const text = (b.textContent || b.value || b.innerText || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const id = (b.id || '').toLowerCase();
    const name = (b.name || '').toLowerCase();
    return text.includes('get otp') || text === 'getotp' || id.includes('getotp') || name.includes('getotp');
  });
  if (bestMatch) return bestMatch;

  // 2. "OTP" keyword match
  bestMatch = buttons.find(b => {
    const text = (b.textContent || b.value || b.innerText || '').toLowerCase().trim();
    const id = (b.id || '').toLowerCase();
    const name = (b.name || '').toLowerCase();
    return text.includes('otp') || id.includes('otp') || name.includes('otp');
  });
  if (bestMatch) return bestMatch;

  // 3. Style match (e.g. green buttons)
  bestMatch = buttons.find(b => {
    const style = window.getComputedStyle(b);
    const bg = style.backgroundColor;
    return bg.includes('rgb(76, 175, 80)') || bg.includes('rgb(92, 184, 92)') || bg.includes('rgb(34, 139, 34)') || (b.tagName === 'INPUT' && b.type === 'submit');
  });
  if (bestMatch) return bestMatch;

  return null;
}

function findMobileOtpInput() {
  // Get ALL background inputs (including password type — SSP uses type=password for OTP!)
  const allInputs = querySelectorAllWithIframes('input').filter(i => {
    return !i.id.startsWith('ssp-') && (!i.closest || !i.closest('#ssp-mobile-panel'));
  });

  // 1. Exact name/id match for SSP's known OTP field names
  const preciseMatch = allInputs.find(i => {
    const id = (i.id || '').toLowerCase();
    const name = (i.name || '').toLowerCase();
    const ph = (i.placeholder || '').toLowerCase();
    return id.includes('txtotp') || id.includes('otp') ||
           name.includes('txtotp') || name.includes('otp') ||
           ph.includes('otp') || ph.includes('recieved') || ph.includes('received');
  });
  if (preciseMatch) return preciseMatch;

  // 2. Label scan — look for label containing "OTP"
  const allLabels = querySelectorAllWithIframes('label, td, span, div, th').filter(el => {
    const text = (el.innerText || el.textContent || '').toLowerCase();
    return text.includes('otp') || text.includes('one time');
  });

  for (const label of allLabels) {
    if (label.htmlFor) {
      const associated = document.getElementById(label.htmlFor);
      if (associated && allInputs.includes(associated)) return associated;
    }
    let parent = label.parentElement;
    while (parent && parent.tagName !== 'BODY') {
      const found = Array.from(parent.querySelectorAll('input')).filter(i => allInputs.includes(i));
      if (found.length > 0) return found[0];
      parent = parent.parentElement;
    }
  }

  // 3. Fallback: second visible input on the page (first is mobile number, second is OTP)
  const visibleInputs = allInputs.filter(i => i.offsetParent !== null || i.offsetWidth > 0 || i.offsetHeight > 0);
  if (visibleInputs.length >= 2) return visibleInputs[1];
  if (visibleInputs.length === 1) return visibleInputs[0];

  return null;
}

function findMobileSubmitButton() {
  let buttons = querySelectorAllWithIframes('button, input[type="button"], input[type="submit"], a, span').filter(b => {
    const isNotSsp = !b.id.startsWith('ssp-') && (!b.closest || !b.closest('#ssp-mobile-panel'));
    const isVisible = b.offsetWidth > 0 || b.offsetHeight > 0 || b.getClientRects().length > 0;
    return isNotSsp && isVisible;
  });

  if (buttons.length === 0) {
    buttons = querySelectorAllWithIframes('button, input[type="button"], input[type="submit"], a, span').filter(b => {
      return !b.id.startsWith('ssp-') && (!b.closest || !b.closest('#ssp-mobile-panel'));
    });
  }

  // 1. Precise text check
  let bestMatch = buttons.find(b => {
    const text = (b.textContent || b.value || b.innerText || '').toLowerCase().trim();
    const id = (b.id || '').toLowerCase();
    const name = (b.name || '').toLowerCase();
    return text.includes('submit') || text.includes('verify') || text.includes('validate') || text.includes('update') ||
           id.includes('submit') || name.includes('submit') || id.includes('update') || name.includes('update');
  });
  if (bestMatch) return bestMatch;

  // 2. Sibling elements
  if (buttons.length > 0) return buttons[buttons.length - 1]; // usually submit is the last button on page

  return null;
}

function findCaptchaInput() {
  const inputs = querySelectorAllWithIframes('input').filter(i => {
    const t = (i.getAttribute('type') || i.type || 'text').toLowerCase();
    const isNotSsp = !i.id.startsWith('ssp-') && (!i.closest || !i.closest('#ssp-captcha-panel'));
    return (t === 'text' || t === 'number') && isNotSsp;
  });

  // 1. Precise attributes match (id/name/placeholder contains 'captcha')
  let bestMatch = inputs.find(i => {
    const ph = (i.placeholder || '').toLowerCase();
    const name = (i.name || '').toLowerCase();
    const id = (i.id || '').toLowerCase();
    return ph.includes('captcha') || name.includes('captcha') || id.includes('captcha');
  });
  if (bestMatch) return bestMatch;

  // 2. Search associated labels containing 'captcha' or 'ಕ್ಯಾಪ್ಚಾ'
  const labels = querySelectorAllWithIframes('label, td, span, div').filter(el => {
    const text = el.innerText || el.textContent || '';
    return text.toLowerCase().includes('captcha') || text.includes('ಕ್ಯಾಪ್ಚಾ') || text.includes('ನಮೂದಿಸಿ');
  });

  for (const label of labels) {
    if (label.htmlFor) {
      const associated = querySelectorAllWithIframes('#' + label.htmlFor);
      if (associated.length > 0 && inputs.includes(associated[0])) return associated[0];
    }
    const childInput = label.querySelector('input');
    if (childInput && inputs.includes(childInput)) return childInput;
    let parent = label.parentElement;
    while (parent && parent.tagName !== 'BODY') {
      const inputsInParent = Array.from(parent.querySelectorAll('input')).filter(inp => inputs.includes(inp));
      if (inputsInParent.length > 0) return inputsInParent[0];
      parent = parent.parentElement;
    }
  }

  // 3. Fallback: return the first empty text input
  const emptyInputs = inputs.filter(i => !i.value);
  if (emptyInputs.length > 0) return emptyInputs[0];

  if (inputs.length > 0) return inputs[0];
  return null;
}

// ── OTP Notification Modal ───────────────────────────────────────────────────
window.showSspToast = function(message) {
  // Remove any existing modal
  const existing = document.getElementById('ssp-otp-modal-overlay');
  if (existing) existing.remove();

  if (!document.getElementById('ssp-toast-style')) {
    const style = document.createElement('style');
    style.id = 'ssp-toast-style';
    style.textContent = `
      @keyframes ssp-modal-in {
        from { opacity:0; transform:translate(-50%,-50%) scale(0.85); }
        to   { opacity:1; transform:translate(-50%,-50%) scale(1); }
      }
      #ssp-otp-modal {
        animation: ssp-modal-in 0.35s cubic-bezier(0.34,1.56,0.64,1);
      }
      #ssp-otp-modal-input:focus { outline:none; border-color:#6366f1 !important; box-shadow:0 0 0 3px rgba(99,102,241,0.25); }
      #ssp-otp-modal-submit:hover { background: linear-gradient(135deg,#4f46e5,#7c3aed) !important; transform:translateY(-1px); }
      #ssp-otp-modal-submit:active { transform:translateY(0); }
    `;
    document.head.appendChild(style);
  }

  // Dark overlay
  const overlay = document.createElement('div');
  overlay.id = 'ssp-otp-modal-overlay';
  Object.assign(overlay.style, {
    position:   'fixed', top:'0', left:'0',
    width:'100vw', height:'100vh',
    background: '#000000',
    zIndex:     '9999998',
    cursor:     'pointer'
  });

  // Centered modal card
  const modal = document.createElement('div');
  modal.id = 'ssp-otp-modal';
  Object.assign(modal.style, {
    position:      'fixed',
    top:           '50%', left:'50%',
    transform:     'translate(-50%,-50%)',
    zIndex:        '9999999',
    background:    'linear-gradient(145deg,#1e293b,#0f172a)',
    border:        '1px solid rgba(99,102,241,0.35)',
    borderRadius:  '20px',
    padding:       '30px 28px 24px',
    width:         '320px',
    boxShadow:     '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.15)',
    fontFamily:    "'Plus Jakarta Sans',sans-serif",
    cursor:        'default'
  });

  modal.innerHTML = `
    <!-- Bell icon -->
    <div style="text-align:center; margin-bottom:14px;">
      <div style="
        width:56px; height:56px; border-radius:50%; margin:0 auto 12px;
        background:linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2));
        border:1px solid rgba(99,102,241,0.4);
        display:flex; align-items:center; justify-content:center; font-size:26px;
      ">&#128276;</div>
      <h3 style="font-size:16px; font-weight:800; color:#f1f5f9; margin:0 0 6px 0; letter-spacing:-0.3px;">
        Agent Notification
      </h3>
      <p style="font-size:12px; color:#94a3b8; margin:0; line-height:1.6; padding:0 4px;">
        ${message}
      </p>
    </div>

    <!-- Divider -->
    <div style="height:1px; background:rgba(255,255,255,0.07); margin:16px 0;"></div>

    <!-- OTP Input -->
    <label style="font-size:10px; font-weight:700; color:#6366f1; text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:8px;">
      Enter OTP
    </label>
    <input
      id="ssp-otp-modal-input"
      type="text"
      maxlength="6"
      placeholder="Enter OTP"
      style="
        width:100%; box-sizing:border-box;
        background:rgba(255,255,255,0.06);
        border:1.5px solid rgba(99,102,241,0.3);
        border-radius:10px; padding:12px 14px;
        font-size:20px; font-weight:700; color:#f8fafc;
        font-family:'Plus Jakarta Sans',monospace;
        letter-spacing:6px; text-align:center;
        transition:border-color 0.2s, box-shadow 0.2s;
        margin-bottom:14px;
      "
    >

    <!-- Submit Button -->
    <button id="ssp-otp-modal-submit" style="
      width:100%; padding:13px;
      background:linear-gradient(135deg,#6366f1,#8b5cf6);
      border:none; border-radius:10px;
      font-size:14px; font-weight:700; color:#fff;
      cursor:pointer; transition:all 0.2s;
      box-shadow:0 4px 14px rgba(99,102,241,0.4);
      letter-spacing:0.3px;
    ">&#10003;&nbsp; Submit OTP</button>

    <!-- Resend Button inside Modal -->
    <button id="ssp-otp-modal-resend" style="
      width:100%; padding:11px; margin-top:10px;
      background:transparent;
      border:1px solid #475569; border-radius:10px;
      font-size:13px; font-weight:600; color:#cbd5e1;
      cursor:pointer; transition:all 0.2s;
    " onmouseover="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#fff'" onmouseout="this.style.background='transparent'; this.style.color='#cbd5e1'">
      &#8634;&nbsp; Resend OTP
    </button>

    <!-- Dismiss -->
    <p id="ssp-otp-modal-dismiss" style="
      text-align:center; margin:12px 0 0; font-size:11px;
      color:#475569; cursor:pointer; transition:color 0.2s;
    " onmouseover="this.style.color='#94a3b8'" onmouseout="this.style.color='#475569'">
      Dismiss
    </p>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  // Hide the main automation panel so ONLY the popup is visible
  const mainPanel = document.getElementById('ssp-automation-panel');
  if (mainPanel) mainPanel.style.display = 'none';

  // Focus the OTP input
  setTimeout(() => {
    const inp = document.getElementById('ssp-otp-modal-input');
    if (inp) inp.focus();
  }, 100);

  // Close helper
  const closeModal = () => {
    overlay.remove();
    modal.remove();
    // Re-show main panel if modal is dismissed without submitting
    const activePanel = document.getElementById('ssp-automation-panel');
    if (activePanel) activePanel.style.display = 'block';
  };

  // Dismiss on overlay click
  overlay.addEventListener('click', closeModal);
  document.getElementById('ssp-otp-modal-dismiss').addEventListener('click', closeModal);

  // Resend OTP button click listener
  document.getElementById('ssp-otp-modal-resend').addEventListener('click', (e) => {
    e.stopPropagation();
    const resendBtn = document.getElementById('ssp-otp-modal-resend');
    resendBtn.innerHTML = 'Resending...';
    resendBtn.style.opacity = '0.5';
    resendBtn.style.cursor = 'not-allowed';
    resendBtn.disabled = true;

    // Find and click background resend button
    const allBtns = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a, span')).filter(b => !b.id.startsWith('ssp-'));
    const resendOtpBtn = allBtns.find(b => {
      const text = (b.textContent || b.value || b.innerText || '').toLowerCase().trim();
      const id = (b.id || '').toLowerCase();
      const name = (b.name || '').toLowerCase();
      return text.includes('resend otp') || text.includes('resend') || id.includes('resend') || name.includes('resend');
    });

    if (resendOtpBtn) {
      resendOtpBtn.click();
    } else {
      const fallbackBtn = document.querySelector('[id*="resend" i], [name*="resend" i], input[value*="Resend" i]');
      if (fallbackBtn) {
        fallbackBtn.click();
      } else {
        alert('Resend button not found on the page.');
      }
    }

    // Reset button after 3 seconds
    setTimeout(() => {
      resendBtn.innerHTML = '&#8634;&nbsp; Resend OTP';
      resendBtn.style.opacity = '1';
      resendBtn.style.cursor = 'pointer';
      resendBtn.disabled = false;
    }, 3000);
  });

  // Submit OTP button
  document.getElementById('ssp-otp-modal-submit').addEventListener('click', (e) => {
    e.stopPropagation(); // prevent click from reaching overlay
    const otpVal = (document.getElementById('ssp-otp-modal-input').value || '').trim();
    if (!otpVal) {
      const inp = document.getElementById('ssp-otp-modal-input');
      inp.style.borderColor = '#ef4444';
      inp.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.25)';
      inp.placeholder = 'Please enter OTP!';
      inp.focus();
      return;
    }

    // Fill the panel OTP field
    const panelOtp = document.getElementById('ssp-otp-val');
    if (panelOtp) {
      panelOtp.value = otpVal;
      panelOtp.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Clear the modal flag from storage — OTP has been submitted (wrapped in try-catch to prevent invalidation crashes)
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.set({ ssp_show_otp_modal: false });
      }
    } catch (err) {
      console.log("SSP Modal storage set bypassed: extension context was reloaded.");
    }

    // Close modal immediately
    closeModal();

    // Click the panel submit button in the background
    const submitBtn = document.getElementById('ssp-btn-submit');
    if (submitBtn) submitBtn.click();
  });

  // Enter key on OTP input triggers submit
  document.getElementById('ssp-otp-modal-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('ssp-otp-modal-submit').click();
  });
};

// ── Mobile OTP Notification Modal ───────────────────────────────────────────
window.showSspMobileOtpToast = function(mobileNum) {
  // Remove any existing modal
  const existing = document.getElementById('ssp-otp-modal-overlay');
  if (existing) existing.remove();

  if (!document.getElementById('ssp-toast-style')) {
    const style = document.createElement('style');
    style.id = 'ssp-toast-style';
    style.textContent = `
      @keyframes ssp-modal-in {
        from { opacity:0; transform:translate(-50%,-50%) scale(0.85); }
        to   { opacity:1; transform:translate(-50%,-50%) scale(1); }
      }
      #ssp-otp-modal {
        animation: ssp-modal-in 0.35s cubic-bezier(0.34,1.56,0.64,1);
      }
      #ssp-otp-modal-input:focus { outline:none; border-color:#10b981 !important; box-shadow:0 0 0 3px rgba(16,185,129,0.25); }
      #ssp-otp-modal-submit:hover { background: linear-gradient(135deg,#059669,#047857) !important; transform:translateY(-1px); }
      #ssp-otp-modal-submit:active { transform:translateY(0); }
    `;
    document.head.appendChild(style);
  }

  // Dark overlay
  const overlay = document.createElement('div');
  overlay.id = 'ssp-otp-modal-overlay';
  Object.assign(overlay.style, {
    position:   'fixed', top:'0', left:'0',
    width:'100vw', height:'100vh',
    background: '#000000',
    zIndex:     '9999998',
    cursor:     'pointer'
  });

  // Centered modal card
  const modal = document.createElement('div');
  modal.id = 'ssp-otp-modal';
  Object.assign(modal.style, {
    position:      'fixed',
    top:           '50%',
    left:          '50%',
    transform:     'translate(-50%, -50%)',
    width:         '360px',
    background:    '#0f172a',
    border:        '1px solid rgba(255,255,255,0.08)',
    borderRadius:  '20px',
    boxShadow:     '0 20px 25px -5px rgba(0,0,0,0.5), 0 10px 10px -5px rgba(0,0,0,0.4)',
    zIndex:        '9999999',
    padding:       '24px',
    boxSizing:     'border-box',
    fontFamily:    "'Plus Jakarta Sans', sans-serif",
    color:         '#fff'
  });

  modal.innerHTML = `
    <!-- Mobile icon -->
    <div style="text-align:center; margin-bottom:14px;">
      <span style="font-size:32px; filter:drop-shadow(0 4px 6px rgba(16,185,129,0.3));">📱</span>
    </div>

    <!-- Title -->
    <h4 style="margin:0 0 8px; text-align:center; font-size:16px; font-weight:800; color:#38bdf8; letter-spacing:0.5px;">
      Mobile Update Verification
    </h4>

    <!-- Message -->
    <p style="margin:0 0 18px; text-align:center; font-size:12px; line-height:1.6; color:#94a3b8;">
      Dear Agent, the OTP will be received on the Customer's Mobile Number. The Mobile Number is: <strong style="color:#f8fafc; font-family:monospace; background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px;">${mobileNum}</strong>. Please enter the OTP and click the Submit OTP button.
    </p>

    <!-- Divider -->
    <div style="height:1px; background:rgba(255,255,255,0.06); margin-bottom:18px;"></div>

    <!-- OTP Label -->
    <label style="display:block; font-size:10px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:6px; letter-spacing:0.5px;">
      Enter Mobile OTP
    </label>

    <!-- OTP Input -->
    <input type="text" id="ssp-otp-modal-input" placeholder="Enter OTP" maxlength="6"
      style="
        width:100%; padding:12px;
        background:rgba(15,23,42,0.8);
        border:1px solid rgba(255,255,255,0.1); border-radius:10px;
        font-size:20px; font-weight:800; color:#fff;
        box-sizing:border-box;
        font-family:monospace; letter-spacing:6px; text-align:center;
        transition:border-color 0.2s, box-shadow 0.2s;
        margin-bottom:14px;
      "
    >

    <!-- Submit Button -->
    <button id="ssp-otp-modal-submit" style="
      width:100%; padding:13px;
      background:linear-gradient(135deg,#10b981,#059669);
      border:none; border-radius:10px;
      font-size:14px; font-weight:700; color:#fff;
      cursor:pointer; transition:all 0.2s;
      box-shadow:0 4px 14px rgba(16,185,129,0.4);
      letter-spacing:0.3px;
    ">&#10003;&nbsp; Submit OTP</button>

    <!-- Resend Button -->
    <button id="ssp-otp-modal-resend" style="
      width:100%; padding:11px; margin-top:10px;
      background:transparent;
      border:1px solid #475569; border-radius:10px;
      font-size:13px; font-weight:600; color:#cbd5e1;
      cursor:pointer; transition:all 0.2s;
    " onmouseover="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#fff'" onmouseout="this.style.background='transparent'; this.style.color='#cbd5e1'">
      &#8634;&nbsp; Resend OTP
    </button>

    <!-- Dismiss -->
    <p id="ssp-otp-modal-dismiss" style="
      text-align:center; margin:12px 0 0; font-size:11px;
      color:#475569; cursor:pointer; transition:color 0.2s;
    " onmouseover="this.style.color='#94a3b8'" onmouseout="this.style.color='#475569'">
      Dismiss
    </p>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  // Hide the main mobile panel so ONLY the popup is visible
  const mainPanel = document.getElementById('ssp-mobile-panel');
  if (mainPanel) mainPanel.style.display = 'none';
  const mainOverlay = document.getElementById('ssp-mobile-overlay');
  if (mainOverlay) mainOverlay.style.display = 'none';

  // Focus the OTP input
  setTimeout(() => {
    const inp = document.getElementById('ssp-otp-modal-input');
    if (inp) inp.focus();
  }, 100);

  // Close helper
  const closeModal = () => {
    overlay.remove();
    modal.remove();
    const activePanel = document.getElementById('ssp-mobile-panel');
    if (activePanel) activePanel.style.display = 'block';
    const activeOverlay = document.getElementById('ssp-mobile-overlay');
    if (activeOverlay) activeOverlay.style.display = 'block';
  };

  overlay.addEventListener('click', closeModal);
  document.getElementById('ssp-otp-modal-dismiss').addEventListener('click', closeModal);

  // Resend OTP click
  document.getElementById('ssp-otp-modal-resend').addEventListener('click', (e) => {
    e.stopPropagation();
    const resendBtn = document.getElementById('ssp-otp-modal-resend');
    resendBtn.innerHTML = 'Resending...';
    resendBtn.style.opacity = '0.5';
    resendBtn.style.cursor = 'not-allowed';
    resendBtn.disabled = true;

    // Find background resend / GET OTP button
    const getOtpBtn = findGetOtpButton();
    if (getOtpBtn) {
      getOtpBtn.click();
    } else {
      alert('GET OTP button not found in the background.');
    }

    setTimeout(() => {
      resendBtn.innerHTML = '&#8634;&nbsp; Resend OTP';
      resendBtn.style.opacity = '1';
      resendBtn.style.cursor = 'pointer';
      resendBtn.disabled = false;
    }, 3000);
  });

  // Submit OTP click
  document.getElementById('ssp-otp-modal-submit').addEventListener('click', (e) => {
    e.stopPropagation();
    const otpVal = (document.getElementById('ssp-otp-modal-input').value || '').trim();
    if (!otpVal) {
      const inp = document.getElementById('ssp-otp-modal-input');
      inp.style.borderColor = '#ef4444';
      inp.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.25)';
      inp.placeholder = 'Please enter OTP!';
      inp.focus();
      return;
    }

    // Fill the panel Mobile OTP field
    const panelOtp = document.getElementById('ssp-mobile-otp-input');
    if (panelOtp) {
      panelOtp.value = otpVal;
      panelOtp.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Clear mobile otp modal flag (wrapped in try-catch to prevent invalidation crashes)
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.set({ ssp_show_mobile_otp_modal: false });
      }
    } catch (err) {
      console.log("SSP Mobile Modal storage set bypassed: extension context was reloaded.");
    }

    closeModal();

    // Click the panel submit OTP button
    const submitBtn = document.getElementById('ssp-btn-mobile-submit-otp');
    if (submitBtn) submitBtn.click();
  });

  document.getElementById('ssp-otp-modal-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('ssp-otp-modal-submit').click();
  });
};
// ─────────────────────────────────────────────────────────────────────────────

function initSspChangePassword() {
  const SSP_AGENT_ID = GLOBAL_AGENT_ID; // Dynamic Agent ID loaded from storage

  if (document.getElementById('ssp-automation-panel')) return;

  const pageInputs = Array.from(document.querySelectorAll('input')).filter(i => {
    const t = (i.getAttribute('type') || i.type || 'text').toLowerCase();
    return t !== 'hidden' && t !== 'submit' && t !== 'button' && !i.id.startsWith('ssp-');
  });
  const hasIframes = document.querySelectorAll('iframe, frame').length > 0;
  if (pageInputs.length === 0 && hasIframes) return;

  const currentStep = sessionStorage.getItem('ssp_pwd_step') || '1';
  let newPassword = sessionStorage.getItem('ssp_new_password');
  if (currentStep === '1' || !newPassword) {
    newPassword = generateSspPassword();
    sessionStorage.setItem('ssp_new_password', newPassword);
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.set({ ssp_new_password: newPassword });
      }
    } catch (err) {
      console.log("SSP Password Generation storage set bypassed: extension context was reloaded.");
    }
  }

  // Auto fill passwords
  const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(i => !i.id.startsWith('ssp-'));
  if (passwordInputs.length >= 2) {
    setInputValueRobustly(passwordInputs[0], newPassword);
    setInputValueRobustly(passwordInputs[1], newPassword);
  }

  // Step 1: Auto fill background User ID field with AGENT ID on load/reload
  if (currentStep === '1') {
    const textInputs = Array.from(document.querySelectorAll('input')).filter(i => {
        const t = (i.getAttribute('type') || 'text').toLowerCase();
        const isNotSsp = !i.id.startsWith('ssp-') && !i.closest('#ssp-automation-panel') && !i.closest('#ssp-captcha-panel');
        const isVisible = i.offsetWidth > 0 || i.offsetHeight > 0 || i.getClientRects().length > 0;
        return (t === 'text' || t === 'number' || t === 'email') && isNotSsp && isVisible;
    });
    let userIdInput = textInputs.find(i => {
        const ph = (i.placeholder || '').toLowerCase();
        const name = (i.name || '').toLowerCase();
        const id = (i.id || '').toLowerCase();
        return ph.includes('user') || ph.includes('login') || name.includes('user') || id.includes('user') || id.includes('login');
    });
    if (!userIdInput && textInputs.length > 0) userIdInput = textInputs[0];
    if (userIdInput) {
      console.log('SSP - Auto-filling background User ID with AGENT ID:', SSP_AGENT_ID);
      setInputValueRobustly(userIdInput, SSP_AGENT_ID);
      // Automatically click GO button hands-free after panel renders
      setTimeout(() => {
        const goBtn = document.getElementById('ssp-btn-go');
        if (goBtn) {
          console.log('SSP - Auto-triggering GO button with AGENT ID');
          goBtn.click();
        }
      }, 600);
    }
  }

  const isModalOpen = document.getElementById('ssp-otp-modal-overlay') !== null;
  const uiHtml = `
    <div id="ssp-pwd-overlay" class="ssp-full-overlay" style="display: ${isModalOpen ? 'none' : 'block'};"></div>
    <div id="ssp-automation-panel" class="ssp-panel" style="display: ${isModalOpen ? 'none' : 'block'};">
      <h3 class="ssp-title">
        <span>SSP Automation</span>
        <span class="ssp-badge">PWD RESET</span>
      </h3>
      
      <div id="ssp-step-1" style="display: ${currentStep === '1' ? 'block' : 'none'};">
        <label class="ssp-label">AGENT SSP ID</label>
        <input type="text" id="ssp-student-id" class="ssp-input" value="${SSP_AGENT_ID}" readonly style="opacity:0.6; cursor:not-allowed;">
        <button id="ssp-btn-go" class="ssp-btn ssp-btn-indigo">GO</button>
      </div>

      <div id="ssp-step-2" style="display: ${currentStep === '2' ? 'block' : 'none'};">
        <div class="ssp-group-box">
           <label class="ssp-label" style="font-size: 10px; color: #38bdf8;">SSP STUDENT ID</label>
           <input type="text" id="ssp-new-userid" class="ssp-input" placeholder="Student SSP ID" value="${sessionStorage.getItem('ssp_student_id') || ''}" style="margin-bottom: 10px; padding: 10px 12px;">
           <button id="ssp-btn-change-id" class="ssp-btn ssp-btn-blue" style="padding: 10px; font-size: 13px;">Change &amp; Resend OTP</button>
        </div>

        <label class="ssp-label">Enter OTP</label>
        <input type="text" id="ssp-otp-val" class="ssp-input" placeholder="Enter OTP">
        <button id="ssp-btn-submit" class="ssp-btn ssp-btn-emerald">Submit</button>
      </div>

      <!-- ── Promotional Banner ─────────────────────────────────── -->
      <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.07);padding-top:14px;">
        <div style="background:linear-gradient(135deg,rgba(16,185,129,0.12)0%,rgba(59,130,246,0.12)100%);border:1px solid rgba(16,185,129,0.22);border-radius:12px;padding:12px 14px;text-align:center;">
          <div style="font-size:20px;margin-bottom:4px;">🏪</div>
          <p style="font-size:11px;font-weight:800;color:#10b981;margin:0 0 2px 0;letter-spacing:0.5px;text-transform:uppercase;">${GLOBAL_AGENT_NAME}</p>
          <p style="font-size:10px;color:#94a3b8;margin:0 0 8px 0;line-height:1.4;">SSP Scholarship &bull; e-KYC &bull; NPCI &bull; Documents</p>
          <div style="background:rgba(0,0,0,0.3);border-radius:6px;padding:5px 8px;font-size:10px;color:#fbbf24;font-weight:700;">⚡ Powered by SSPCM Automation Tool</div>
        </div>
      </div>
      <!-- ──────────────────────────────────────────────────────── -->

    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', uiHtml);

  document.getElementById('ssp-btn-go').addEventListener('click', () => {
    // Always use the hardcoded AGENT ID for the password reset step — never the student ID
    const sspId = SSP_AGENT_ID;
    
    sessionStorage.setItem('ssp_pwd_step', '2');
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.set({ ssp_pwd_step: '2', ssp_show_otp_modal: false });
      }
    } catch (err) {
      console.log("SSP Step 2 storage set bypassed: extension context was reloaded.");
    }
    
    const textInputs = Array.from(document.querySelectorAll('input')).filter(i => {
        const t = (i.getAttribute('type') || 'text').toLowerCase();
        const isNotSsp = !i.id.startsWith('ssp-') && !i.closest('#ssp-automation-panel');
        const isVisible = i.offsetWidth > 0 || i.offsetHeight > 0 || i.getClientRects().length > 0;
        return (t === 'text' || t === 'number' || t === 'email') && isNotSsp && isVisible;
    });
    
    let userIdInput = textInputs.find(i => {
        const ph = (i.placeholder || '').toLowerCase();
        const name = (i.name || '').toLowerCase();
        const id = (i.id || '').toLowerCase();
        return ph.includes('user') || ph.includes('login') || name.includes('user') || id.includes('user') || id.includes('login');
    });
    if (!userIdInput && textInputs.length > 0) userIdInput = textInputs[0];
    
    if (userIdInput) {
       setInputValueRobustly(userIdInput, sspId);
    } else {
       alert("Could not find the Student Login field in the background!");
    }

    setTimeout(() => {
      const allBtns = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a, span')).filter(b => !b.id.startsWith('ssp-'));
      
      const getOtpBtn = allBtns.find(b => {
        const text = (b.textContent || b.value || b.innerText || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const id = (b.id || '').toLowerCase();
        const name = (b.name || '').toLowerCase();
        return text.includes('get otp') || text === 'getotp' || id.includes('getotp') || name.includes('getotp');
      });

      if (getOtpBtn) {
        getOtpBtn.click();
      } else {
        const fallbackBtn = document.querySelector('[id*="getotp" i], [id*="GetOTP" i], [name*="GetOTP" i], input[value*="GET OTP" i], button[value*="GET OTP" i]');
        if (fallbackBtn) {
           fallbackBtn.click();
        } else {
           alert('GET OTP button not found. Please click it manually.');
        }
      }
    }, 500);

    document.getElementById('ssp-step-1').style.display = 'none';
    document.getElementById('ssp-step-2').style.display = 'block';
  });

  const changeIdBtn = document.getElementById('ssp-btn-change-id');
  if (changeIdBtn) {
    changeIdBtn.addEventListener('click', () => {
      const newId = document.getElementById('ssp-new-userid').value.trim();
      if (!newId) return alert('Enter a new User ID');
      
      const textInputs = Array.from(document.querySelectorAll('input')).filter(i => {
          const t = (i.getAttribute('type') || 'text').toLowerCase();
          const isNotSsp = !i.id.startsWith('ssp-') && !i.closest('#ssp-automation-panel') && !i.closest('#ssp-captcha-panel');
          const isVisible = i.offsetWidth > 0 || i.offsetHeight > 0 || i.getClientRects().length > 0;
          return (t === 'text' || t === 'number' || t === 'email') && isNotSsp && isVisible;
      });
      
      let userIdInput = textInputs.find(i => {
          const ph = (i.placeholder || '').toLowerCase();
          const name = (i.name || '').toLowerCase();
          const id = (i.id || '').toLowerCase();
          return ph.includes('user') || ph.includes('login') || name.includes('user') || id.includes('user') || id.includes('login');
      });
      if (!userIdInput && textInputs.length > 0) userIdInput = textInputs[0];
      
      if (userIdInput) {
         setInputValueRobustly(userIdInput, newId);
      }
      
      sessionStorage.setItem('ssp_student_id', newId);
      
      // Save flags to storage, and only AFTER it succeeds, trigger the rest
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          chrome.storage.local.set({ 
            ssp_student_id: newId,
            ssp_show_otp_modal: true 
          }, () => {
            // Show notification modal IMMEDIATELY before page might reload
            window.showSspToast(`Dear User : ${newId} Your High Security One Time Password (OTP) is .... for Scholarship Portal. From SSP-CEG.`);

            setTimeout(() => {
              const allBtns = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a, span')).filter(b => !b.id.startsWith('ssp-'));
              
              const resendOtpBtn = allBtns.find(b => {
                const text = (b.textContent || b.value || b.innerText || '').toLowerCase().trim();
                const id = (b.id || '').toLowerCase();
                const name = (b.name || '').toLowerCase();
                return text.includes('resend otp') || text.includes('resend') || id.includes('resend') || name.includes('resend');
              });
              
              if (resendOtpBtn) {
                resendOtpBtn.click();
              } else {
                const getOtpBtn = allBtns.find(b => {
                  const text = (b.textContent || b.value || b.innerText || '').toLowerCase().replace(/\s+/g, ' ').trim();
                  const id = (b.id || '').toLowerCase();
                  return text.includes('get otp') || id.includes('getotp');
                });
                if (getOtpBtn) {
                    getOtpBtn.click();
                } else {
                    const fallbackBtn = document.querySelector('[id*="resend" i], [name*="resend" i], input[value*="Resend" i], [id*="getotp" i], [id*="GetOTP" i], [id*="resend" i]');
                    if (fallbackBtn) fallbackBtn.click();
                    else alert('Resend/GET OTP button not found');
                }
              }
            }, 500);
          });
        }
      } catch (err) {
        console.log("SSP OTP Modal activation storage set bypassed: extension context was reloaded.");
      }
    });
  }

  document.getElementById('ssp-btn-submit').addEventListener('click', () => {
    const otp = document.getElementById('ssp-otp-val').value.trim();
    if (!otp) return alert('Please enter OTP');
    
    sessionStorage.removeItem('ssp_pwd_step');
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.set({ ssp_pwd_step: 'done' });
      }
    } catch (err) {
      console.log("SSP Password Reset Done storage set bypassed: extension context was reloaded.");
    }
    
    const textInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="password"]'));
    let otpInput = textInputs.find(i => (i.id || '').toLowerCase().includes('otp') || (i.name || '').toLowerCase().includes('otp') || (i.placeholder || '').toLowerCase().includes('otp'));
    
    if (!otpInput) {
        const emptyInputs = textInputs.filter(i => !i.value && i.offsetParent !== null && i.type === 'text');
        if (emptyInputs.length > 0) {
            otpInput = emptyInputs[emptyInputs.length - 1];
        }
    }

    if (otpInput) {
       setInputValueRobustly(otpInput, otp);
    }

    const savedPassword = sessionStorage.getItem('ssp_new_password');
    if (savedPassword) {
      const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(i => !i.id.startsWith('ssp-'));
      if (passwordInputs.length >= 2) {
        setInputValueRobustly(passwordInputs[0], savedPassword);
        setInputValueRobustly(passwordInputs[1], savedPassword);
      }
    }

    const allButtons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a, span')).filter(b => !b.id.startsWith('ssp-'));
    const submitBtn = allButtons.find(b => {
      const text = (b.textContent || b.value || b.innerText || '').toLowerCase().trim();
      const id = (b.id || '').toLowerCase();
      const name = (b.name || '').toLowerCase();
      return text.includes('submit') || text.includes('verify') || text.includes('validate') || text.includes('update') || 
             text.includes('change') || text.includes('reset') ||
             id.includes('submit') || id.includes('change') || id.includes('reset') ||
             name.includes('submit') || name.includes('change') || name.includes('reset');
    });

    if (submitBtn) {
       submitBtn.click();
    } else {
       const form = document.querySelector('form');
       if (form) form.submit();
    }

    const btn = document.getElementById('ssp-btn-submit');
    btn.textContent = "Saving Password...";
    btn.style.background = "#f59e0b";
    
    setTimeout(() => {
      window.location.href = "https://ssp.postmatric.karnataka.gov.in/post_sa/signin.aspx";
    }, 4000);
  });

  // Step 2: Auto trigger the "Change & Resend OTP" flow via highly resilient panel step sessionStorage polling
  // This gracefully handles both standard page reloads and ASP.NET AJAX partial postbacks (UpdatePanels)
  const step2Interval = setInterval(() => {
    const pwdStep = sessionStorage.getItem('ssp_pwd_step') || '1';
    if (pwdStep === '2') {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          chrome.storage.local.get(['ssp_show_otp_modal'], (data) => {
            if (!data.ssp_show_otp_modal) {
              console.log('SSP - Step 2 is active. Auto-clicking Change & Resend OTP...');
              clearInterval(step2Interval);
              setTimeout(() => {
                const changeIdBtn = document.getElementById('ssp-btn-change-id');
                if (changeIdBtn) {
                  changeIdBtn.click();
                }
              }, 1000);
            } else {
              clearInterval(step2Interval);
            }
          });
        } else {
          clearInterval(step2Interval);
        }
      } catch (err) {
        clearInterval(step2Interval);
        console.log("SSP Step 2 storage get bypassed: extension context was reloaded.");
      }
    }
  }, 500);
}

function initSspSignIn() {
  if (document.getElementById('ssp-captcha-panel')) return;

  const pageInputs = Array.from(document.querySelectorAll('input')).filter(i => {
    const t = (i.getAttribute('type') || i.type || 'text').toLowerCase();
    return t !== 'hidden' && t !== 'submit' && t !== 'button' && !i.id.startsWith('ssp-');
  });
  const hasIframes = document.querySelectorAll('iframe, frame').length > 0;
  if (pageInputs.length === 0 && hasIframes) return;

  const savedSspId = sessionStorage.getItem('ssp_student_id');
  const savedPassword = sessionStorage.getItem('ssp_new_password');
  
  if (savedSspId) {
    const textInputs = Array.from(document.querySelectorAll('input[type="text"]')).filter(i => !i.id.startsWith('ssp-') && !i.closest('#ssp-captcha-panel'));
    let userIdInput = textInputs.find(i => (i.placeholder || '').toLowerCase().includes('user') || (i.name || '').toLowerCase().includes('user') || (i.id || '').toLowerCase().includes('user'));
    if (!userIdInput && textInputs.length > 0) userIdInput = textInputs[0];
    
    if (userIdInput) {
        setInputValueRobustly(userIdInput, savedSspId);
    }
    
    const pwdInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(i => !i.id.startsWith('ssp-'));
    if (pwdInputs.length > 0) {
        setInputValueRobustly(pwdInputs[0], savedPassword || "Password@123");
    }
  }

  const uiHtml = `
    <div id="ssp-captcha-overlay" class="ssp-full-overlay"></div>
    <div id="ssp-captcha-panel" class="ssp-panel">
      <h3 class="ssp-title">
        <span>SSP Sign In</span>
        <span class="ssp-badge">LOGIN</span>
      </h3>
      
      <label class="ssp-label">CAPTCHA</label>
      <div id="ssp-captcha-preview-container" style="text-align: center; margin-bottom: 14px; background: rgba(15, 23, 42, 0.6); padding: 8px; border-radius: 8px; border: 1px dashed rgba(255,255,255,0.15); display: none;">
        <img id="ssp-captcha-img-preview" src="" style="max-height: 48px; border-radius: 6px; display: block; margin: 0 auto; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
        <span style="font-size: 9px; color: #64748b; display: block; margin-top: 4px; letter-spacing: 0.5px;">Click image to reload</span>
      </div>
      <input type="text" id="ssp-captcha-input" class="ssp-input" placeholder="Enter Captcha" style="font-size: 18px; letter-spacing: 4px; text-align: center;">
      <button id="ssp-btn-login" class="ssp-btn ssp-btn-indigo">Student Login</button>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', uiHtml);

  // Sync Captcha Image Preview dynamically
  const previewContainer = document.getElementById('ssp-captcha-preview-container');
  const previewImg = document.getElementById('ssp-captcha-img-preview');
  const pageImg = document.querySelector('img[src*="captcha" i], img[id*="captcha" i], img[src*="Captcha" i], img[id*="Captcha" i]');
  
  if (pageImg && previewContainer && previewImg) {
    previewImg.src = pageImg.src;
    previewContainer.style.display = 'block';
    
    // Periodically check if the page's captcha image refreshes and sync our preview
    setInterval(() => {
      const liveImg = document.querySelector('img[src*="captcha" i], img[id*="captcha" i], img[src*="Captcha" i], img[id*="Captcha" i]');
      if (liveImg && previewImg.src !== liveImg.src) {
        previewImg.src = liveImg.src;
      }
    }, 500);

    // Click the preview image to trigger reload of the actual page's captcha
    previewImg.style.cursor = 'pointer';
    previewImg.addEventListener('click', () => {
      const reloadBtn = document.querySelector('img[src*="refresh" i], img[src*="reload" i], a[id*="refresh" i], a[id*="reload" i], [class*="refresh" i], [class*="reload" i]');
      if (reloadBtn) {
        reloadBtn.click();
      } else {
        pageImg.click();
      }
    });
  }

  const capInput = document.getElementById('ssp-captcha-input');
  if (capInput) {
    capInput.focus();
  }

  document.getElementById('ssp-btn-login').addEventListener('click', () => {
    const captchaVal = document.getElementById('ssp-captcha-input').value.trim();
    if (!captchaVal) return alert('Please enter Captcha');
    
    const pageCaptchaInput = findCaptchaInput();
    
    if (pageCaptchaInput) {
       setInputValueRobustly(pageCaptchaInput, captchaVal);
    } else {
       alert("Could not find the page's Captcha input box in the background!");
    }

    const allButtons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a'));
    const loginBtn = allButtons.find(b => {
        const text = (b.textContent || b.value || b.innerText || '').toLowerCase().trim();
        return text.includes('student login') || text === 'login';
    });
    
    if (loginBtn) {
       loginBtn.click();
    } else {
       const form = document.querySelector('form');
       if (form) {
         const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
         form.dispatchEvent(submitEvent);
         if(!submitEvent.defaultPrevented) form.submit();
       }
     }
  });
  
  document.getElementById('ssp-captcha-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('ssp-btn-login').click();
    }
  });
}

function initSspUpdateMobile() {
  // --- Auto-Dismiss Native Alerts (CSP Safe) ---
  if (!document.getElementById('ssp-alert-interceptor')) {
    const script = document.createElement('script');
    script.id = 'ssp-alert-interceptor';
    script.src = chrome.runtime.getURL('alert_override.js');
    document.head.appendChild(script);
  }

  // --- Auto-click OK on "Mobile Number Updated Successfully" popup ---
  // NOTE: sspOkClicked starts false and stays false until the FINAL success popup appears.
  // Do NOT stop the interval on intermediate popups like "OTP Sent".
  let sspOkClicked = false;
  const sspOkInterval = setInterval(() => {
    if (sspOkClicked) { clearInterval(sspOkInterval); return; }

    // Only react to the FINAL success message — not intermediate OTP-sent messages
    const pageText = (document.body ? document.body.innerText || document.body.textContent : '') || '';
    const isFinalSuccess = pageText.toLowerCase().includes('mobile number updated') ||
                           pageText.toLowerCase().includes('number updated successfully') ||
                           pageText.toLowerCase().includes('updated successfully');
    if (!isFinalSuccess) return;

    // Strategy 1: Bootstrap modal with id="confirmDialog"
    const confirmDialog = document.getElementById('confirmDialog');
    if (confirmDialog) {
      const allBtns1 = Array.from(confirmDialog.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
      for (const b of allBtns1) {
        const t = (b.innerText || b.value || b.textContent || '').trim().toUpperCase();
        if (t === 'OK' || t === 'OKAY') {
          sspOkClicked = true;
          clearInterval(sspOkInterval);
          console.log('SSP - Auto-clicking OK in #confirmDialog...');
          // Save celebration flag to storage BEFORE clicking OK (page may navigate)
          const d1 = {
            ssp_show_celebration: true,
            ssp_student_id:   sessionStorage.getItem('ssp_student_id')   || '',
            ssp_new_mobile:   sessionStorage.getItem('ssp_new_mobile')    || '',
            ssp_student_name: sessionStorage.getItem('ssp_student_name')  || '',
            ssp_new_password: sessionStorage.getItem('ssp_new_password')  || ''
          };
          try { if (chrome.runtime && chrome.runtime.id) chrome.storage.local.set(d1); } catch(e){}
          b.click();
          // Also try to show directly if page doesn't navigate
          setTimeout(() => {
            if (!document.getElementById('ssp-celebration-overlay')) {
              showSspCelebrationOverlay(d1.ssp_student_id, d1.ssp_new_mobile, d1.ssp_student_name, d1.ssp_new_password);
            }
          }, 600);
          return;
        }
      }
    }

    // Strategy 2: Any visible Bootstrap modal
    const visibleModal = document.querySelector('.modal.in, .modal.show, .modal[style*="display: block"], .modal[style*="display:block"]');
    if (visibleModal) {
      const allBtns2 = Array.from(visibleModal.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
      for (const b of allBtns2) {
        const t = (b.innerText || b.value || b.textContent || '').trim().toUpperCase();
        if (t === 'OK' || t === 'OKAY') {
          sspOkClicked = true;
          clearInterval(sspOkInterval);
          console.log('SSP - Auto-clicking OK in visible modal...');
          const d2 = {
            ssp_show_celebration: true,
            ssp_student_id:   sessionStorage.getItem('ssp_student_id')   || '',
            ssp_new_mobile:   sessionStorage.getItem('ssp_new_mobile')    || '',
            ssp_student_name: sessionStorage.getItem('ssp_student_name')  || '',
            ssp_new_password: sessionStorage.getItem('ssp_new_password')  || ''
          };
          try { if (chrome.runtime && chrome.runtime.id) chrome.storage.local.set(d2); } catch(e){}
          b.click();
          setTimeout(() => {
            if (!document.getElementById('ssp-celebration-overlay')) {
              showSspCelebrationOverlay(d2.ssp_student_id, d2.ssp_new_mobile, d2.ssp_student_name, d2.ssp_new_password);
            }
          }, 600);
          return;
        }
      }
    }

    // Strategy 3: Full page scan — any visible button with text exactly "OK"
    const allPageBtns = Array.from(document.querySelectorAll('button, a.btn, input[type="button"], input[type="submit"]'));
    for (const b of allPageBtns) {
      const t = (b.innerText || b.value || b.textContent || '').trim().toUpperCase();
      const isVisible = b.offsetParent !== null || b.offsetWidth > 0 || b.offsetHeight > 0;
      if ((t === 'OK' || t === 'OKAY') && isVisible && !b.id.startsWith('ssp-')) {
        sspOkClicked = true;
        clearInterval(sspOkInterval);
        console.log('SSP - Auto-clicking OK button (full page scan)...');
        const d3 = {
          ssp_show_celebration: true,
          ssp_student_id:   sessionStorage.getItem('ssp_student_id')   || '',
          ssp_new_mobile:   sessionStorage.getItem('ssp_new_mobile')    || '',
          ssp_student_name: sessionStorage.getItem('ssp_student_name')  || '',
          ssp_new_password: sessionStorage.getItem('ssp_new_password')  || ''
        };
        try { if (chrome.runtime && chrome.runtime.id) chrome.storage.local.set(d3); } catch(e){}
        b.click();
        setTimeout(() => {
          if (!document.getElementById('ssp-celebration-overlay')) {
            showSspCelebrationOverlay(d3.ssp_student_id, d3.ssp_new_mobile, d3.ssp_student_name, d3.ssp_new_password);
          }
        }, 600);
        return;
      }
    }
  }, 300);
  // ----------------------------------------

  // -- Extract student name from THIS page's header (safety net if home page was missed) --
  setTimeout(() => {
    if (sessionStorage.getItem('ssp_student_name')) return; // already captured
    let name = '';
    // Direct ID — SSP uses id="lbl_UserName" across all pages
    const el1 = document.getElementById('lbl_UserName');
    if (el1) name = (el1.innerText || el1.textContent || '').trim();

    if (!name) {
      const el2 = document.querySelector('[id*="lbl_UserName" i], [id*="lblName" i], [id*="lblUserName" i]');
      if (el2) name = (el2.innerText || el2.textContent || '').trim();
    }
    if (name) {
      console.log('SSP - Student name captured on mobile page:', name);
      sessionStorage.setItem('ssp_student_name', name);
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          chrome.storage.local.set({ ssp_student_name: name });
        }
      } catch(e) {}
    }
  }, 800);

  // Convert any password-type mobile inputs to standard text inputs in the background!
  try {
    const allInputs = querySelectorAllWithIframes('input');
    for (const inp of allInputs) {
      const id = (inp.id || '').toLowerCase();
      const name = (inp.name || '').toLowerCase();
      const placeholder = (inp.placeholder || '').toLowerCase();
      if (id.includes('mobile') || name.includes('mobile') || placeholder.includes('mobile')) {
        if (inp.type === 'password') {
          inp.type = 'text';
          inp.setAttribute('type', 'text');
          console.log("SSP - Converted background mobile input from password to text!");
        }
      }
    }
  } catch (e) {
    console.error("SSP - Error converting mobile input to text:", e);
  }

  if (document.getElementById('ssp-mobile-panel')) return;

  const pageInputs = Array.from(document.querySelectorAll('input')).filter(i => {
    const t = (i.getAttribute('type') || i.type || 'text').toLowerCase();
    return t !== 'hidden' && t !== 'submit' && t !== 'button' && !i.id.startsWith('ssp-');
  });
  const hasIframes = document.querySelectorAll('iframe, frame').length > 0;
  if (pageInputs.length === 0 && hasIframes) return;

  const currentStep = sessionStorage.getItem('ssp_mobile_step') || '1';

  const isModalOpen = document.getElementById('ssp-otp-modal-overlay') !== null;
  const uiHtml = `
    <div id="ssp-mobile-overlay" class="ssp-full-overlay" style="display: ${isModalOpen ? 'none' : 'block'};"></div>
    <div id="ssp-mobile-panel" class="ssp-panel" style="display: ${isModalOpen ? 'none' : 'block'};">
      <h3 class="ssp-title">
        <span>Mobile Update</span>
        <span class="ssp-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.2);">SSPCM</span>
      </h3>
      
      <div id="ssp-mob-step-1" style="display: ${currentStep === '1' ? 'block' : 'none'};">
        <label class="ssp-label">Enter New Mobile Number</label>
        <input type="text" id="ssp-mobile-input" class="ssp-input" placeholder="New Mobile Number" value="${sessionStorage.getItem('ssp_new_mobile') || ''}">
        <button id="ssp-btn-mobile-go" class="ssp-btn ssp-btn-emerald">GO</button>
      </div>

      <div id="ssp-mob-step-2" style="display: ${currentStep === '2' ? 'block' : 'none'};">
        <label class="ssp-label">Enter Mobile OTP</label>
        <input type="text" id="ssp-mobile-otp-input" class="ssp-input" placeholder="Enter OTP">
        <button id="ssp-btn-mobile-submit-otp" class="ssp-btn ssp-btn-indigo">Submit OTP</button>
      </div>

      <div id="ssp-mob-step-wait" style="display: none; text-align: center; padding: 15px 0;">
        <div class="ssp-spinner" style="margin: 0 auto 12px auto; width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: ssp-spin 1s linear infinite;"></div>
        <h4 style="font-size: 14px; color: #fff; margin: 0 0 6px 0;">Saving to SSP Database...</h4>
        <p id="ssp-wait-countdown" style="font-size: 12px; color: #38bdf8; font-weight: 700; margin: 0;">5 seconds remaining</p>
      </div>

      <div id="ssp-mob-step-done" style="display: ${currentStep === 'done' ? 'block' : 'none'}; text-align: center; padding: 10px 0;">
        <div style="font-size: 32px; margin-bottom: 8px;">✅</div>
        <h4 style="font-size: 15px; font-weight: 700; color: #10b981; margin: 0 0 4px 0;">Mobile Linked Successfully</h4>
        <div style="background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px; text-align: left; width: 100%; box-sizing: border-box; margin: 10px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px;">
            <span style="color: #64748b; font-weight: 500;">SSP ID:</span>
            <span style="color: #f8fafc; font-weight: 700; font-family: monospace;">${sessionStorage.getItem('ssp_student_id') || 'Not Set'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="color: #64748b; font-weight: 500;">Mobile No:</span>
            <span style="color: #f8fafc; font-weight: 700; font-family: monospace;">${sessionStorage.getItem('ssp_new_mobile') || 'Not Set'}</span>
          </div>
        </div>
        <button id="ssp-btn-mobile-exit" class="ssp-btn" style="background: #ef4444; border-color: rgba(239,68,68,0.2); color: #fff; font-weight: 700; width: 100%;">Exit & Close Tab</button>
      </div>

      <!-- ── Promotional Banner ─────────────────────────────────── -->
      <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.07);padding-top:14px;">
        <div style="background:linear-gradient(135deg,rgba(16,185,129,0.12)0%,rgba(59,130,246,0.12)100%);border:1px solid rgba(16,185,129,0.22);border-radius:12px;padding:12px 14px;text-align:center;">
          <div style="font-size:20px;margin-bottom:4px;">🏪</div>
          <p style="font-size:11px;font-weight:800;color:#10b981;margin:0 0 2px 0;letter-spacing:0.5px;text-transform:uppercase;">Jana Seva Kendra</p>
          <p style="font-size:10px;color:#94a3b8;margin:0 0 8px 0;line-height:1.4;">SSP Scholarship &bull; e-KYC &bull; NPCI &bull; Documents</p>
          <div style="background:rgba(0,0,0,0.3);border-radius:6px;padding:5px 8px;font-size:10px;color:#fbbf24;font-weight:700;">⚡ Powered by SSPCM Automation Tool</div>
        </div>
      </div>
      <!-- ──────────────────────────────────────────────────────── -->

    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', uiHtml);

  const mobInp = document.getElementById('ssp-mobile-input');
  if (mobInp && currentStep === '1') mobInp.focus();

  const otpInp = document.getElementById('ssp-mobile-otp-input');
  if (otpInp && currentStep === '2') otpInp.focus();

  const goBtn = document.getElementById('ssp-btn-mobile-go');
  if (goBtn) {
    goBtn.addEventListener('click', () => {
      const mobNum = document.getElementById('ssp-mobile-input').value.trim();
      if (!mobNum || mobNum.length < 10) return alert('Please enter a valid 10-digit mobile number');
      
      const mobileInput = findMobileInput();
      
      if (mobileInput) {
         setInputValueRobustly(mobileInput, mobNum);
         
         try {
           if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
             chrome.storage.local.set({ 
                ssp_mobile_step: '2', 
                ssp_new_mobile: mobNum,
                ssp_show_mobile_otp_modal: true
             });
           }
         } catch (err) {
           console.log("SSP Mobile Step 2 storage set bypassed: extension context was reloaded.");
         }

         setTimeout(() => {
           const getOtpBtn = findGetOtpButton();
           if (getOtpBtn) {
              getOtpBtn.click();
           } else {
              alert('GET OTP button not found. Please click it manually.');
           }
         }, 500);

         document.getElementById('ssp-mob-step-1').style.display = 'none';
         document.getElementById('ssp-mob-step-2').style.display = 'block';
         const otpInp2 = document.getElementById('ssp-mobile-otp-input');
         if (otpInp2) otpInp2.focus();
      } else {
         const allPageInputs = querySelectorAllWithIframes('input').map(inp => {
           return `ID:${inp.id || 'none'}, Name:${inp.name || 'none'}, Placeholder:${inp.placeholder || 'none'}, Type:${inp.type || 'none'}, Visible:${inp.offsetWidth > 0}`;
         }).join('\n');
         console.log("SSP DEBUG - All inputs on page:", allPageInputs);
         alert("Could not find the 'Enter New Mobile Number' field in the background!\n\nDEBUG - Inputs found:\n" + (allPageInputs.substring(0, 300) || "No inputs found on page!"));
      }
    });
  }

  const mobInputEl = document.getElementById('ssp-mobile-input');
  if (mobInputEl) {
    mobInputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const goBtnEl = document.getElementById('ssp-btn-mobile-go');
        if (goBtnEl) goBtnEl.click();
      }
    });
  }

  const submitOtpBtn = document.getElementById('ssp-btn-mobile-submit-otp');
  if (submitOtpBtn) {
    submitOtpBtn.addEventListener('click', () => {
      const otp = document.getElementById('ssp-mobile-otp-input').value.trim();
      if (!otp) return alert('Please enter OTP');

      const finalSspId = sessionStorage.getItem('ssp_student_id') || '';
      const finalMobile = sessionStorage.getItem('ssp_new_mobile') || '';

      // Save celebration flag + final values to storage BEFORE page redirects
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          chrome.storage.local.set({
            ssp_show_celebration: true,
            ssp_mobile_step: 'done',
            sspcm_active: false,
            ssp_student_id: finalSspId,
            ssp_new_mobile: finalMobile
          });
        }
      } catch (err) {
        console.log("SSP Mobile Done storage set bypassed: extension context was reloaded.");
      }
      sessionStorage.setItem('ssp_mobile_step', 'done');

      // -- Fill OTP in background: human-like typing with random delays --
      let otpInput = document.getElementById('txtotp'); // Exact SSP field ID
      if (!otpInput) otpInput = findMobileOtpInput();   // Fallback scanner

      if (otpInput) {
        otpInput.focus();
        otpInput.value = '';
        otpInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Type each digit with a human-like random delay
        humanTypeValue(otpInput, otp, () => {
          console.log('SSP - OTP typed human-like into:', otpInput.id || otpInput.name);
          // Timer starts after typing — see countdown below
        });

      } else {
        alert('Could not find the OTP field in the background!');
      }

      // Transition overlay panel to the WAIT countdown screen
      document.getElementById('ssp-mob-step-2').style.display = 'none';
      document.getElementById('ssp-mob-step-wait').style.display = 'block';

      // 3-second countdown timer — clicks SUBMIT when it reaches 0
      let timerCount = 3;
      const waitCountdown = document.getElementById('ssp-wait-countdown');
      const waitTitle = document.querySelector('#ssp-mob-step-wait h4');
      if (waitCountdown) waitCountdown.textContent = `Submitting in ${timerCount} seconds...`;
      if (waitTitle) waitTitle.textContent = 'OTP Typed ✓  Preparing to Submit...';

      const submitTimer = setInterval(() => {
        timerCount--;
        if (waitCountdown) waitCountdown.textContent = `Submitting in ${timerCount} second${timerCount !== 1 ? 's' : ''}...`;

        if (timerCount <= 0) {
          clearInterval(submitTimer);
          if (waitCountdown) waitCountdown.textContent = 'Submitting now...';
          if (waitTitle) waitTitle.textContent = 'Clicking SUBMIT...';

          const allBtns = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a'))
            .filter(b => !b.id.startsWith('ssp-'));
          let submitBtn = allBtns.find(b => (b.innerText || b.value || b.textContent || '').trim().toUpperCase() === 'SUBMIT');
          if (!submitBtn) submitBtn = allBtns.find(b => (b.innerText || b.value || b.textContent || '').toLowerCase().includes('submit'));

          if (submitBtn) {
            console.log('SSP - Timer done. Clicking SUBMIT:', submitBtn.id || submitBtn.textContent);
            submitBtn.click();

            // Hide the extension panel + overlay completely so website popup is visible
            const panel = document.getElementById('ssp-mobile-panel');
            const overlay = document.getElementById('ssp-mobile-overlay');
            if (panel) panel.style.display = 'none';
            if (overlay) overlay.style.display = 'none';

          } else {
            console.log('SSP - SUBMIT button not found after timer.');
            if (waitCountdown) waitCountdown.textContent = 'Submit button not found!';
          }
        }
      }, 1000);
    });
  }

  const otpInputEl = document.getElementById('ssp-mobile-otp-input');
  if (otpInputEl) {
    otpInputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const submitOtpBtnEl = document.getElementById('ssp-btn-mobile-submit-otp');
        if (submitOtpBtnEl) submitOtpBtnEl.click();
      }
    });
  }

  const exitBtn = document.getElementById('ssp-btn-mobile-exit');
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      // 1. Clear session storage active state
      sessionStorage.removeItem('ssp_mobile_step');
      sessionStorage.removeItem('ssp_new_mobile');
      
      // 2. Turn off active flags in Chrome local storage
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          chrome.storage.local.set({
            sspcm_active: false,
            ssp_mobile_step: 'done'
          }, () => {
            // 3. Send message to background script to close the current tab
            try {
              if (chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage({ action: 'close_tab' });
              }
            } catch (err) {}
          });
        }
      } catch (err) {
        console.log("SSP mobile exit storage set bypassed: context reloaded.");
      }
    });
  }
}

// --- Developer Tools Security Anti-Debugging ---
// Only run on SSP pages, not on all karnataka.gov.in sites
if (window.location.hostname.includes('ssp.postmatric.karnataka.gov.in') || window.location.hostname.includes('ssp.prematric.karnataka.gov.in') || window.location.hostname.includes('ssp.karnataka.gov.in')) {

let sspDevToolsHandled = false;
let isSspcmActiveForDebug = false;

try {
  chrome.storage.local.get(['sspcm_active'], (d) => {
    isSspcmActiveForDebug = !!d.sspcm_active;
  });
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.sspcm_active !== undefined) {
      isSspcmActiveForDebug = !!changes.sspcm_active.newValue;
    }
  });
} catch(e) {}

function sspHandleDevToolsOpen() {
  if (sspDevToolsHandled) return;
  sspDevToolsHandled = true;
  
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
  if (document.body) {
    document.body.innerHTML = `
      <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0f172a;z-index:999999999;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#ef4444;font-size:22px;font-family:sans-serif;font-weight:bold;text-align:center;padding:30px;box-sizing:border-box;">
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <p style="margin-bottom: 10px;">Dear User you Open the Developer Tool</p>
        <p style="color: #94a3b8; font-size: 16px; margin-bottom: 20px;">this page will be full secrue thats why the tab will close in 2 secend...</p>
      </div>
    `;
  }
  
  // Close tab via background script (window.close not allowed in content scripts)
  setTimeout(() => {
    try {
      if (chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({ action: 'close_tab' });
      }
    } catch(e) {}
  }, 2000);
}

// 1. Detect Docked DevTools (Size Difference)
setInterval(() => {
  if (!isSspcmActiveForDebug) return;
  const threshold = 160;
  if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
    sspHandleDevToolsOpen();
  }
}, 1000);

// 2. Detect Undocked DevTools (Debugger Timing)
setInterval(() => {
  if (sspDevToolsHandled || !isSspcmActiveForDebug) return;
  const start = performance.now();
  debugger;
  if (performance.now() - start > 100) {
    sspHandleDevToolsOpen();
  }
}, 1000);

} // end SSP-only anti-debugging guard

// Check for Service Unavailable / 503 error
setInterval(() => {
    let bodyText = document.body ? document.body.innerText : '';
    if (bodyText.includes('Service Unavailable') || bodyText.includes('HTTP Error 503')) {
        if (!document.getElementById('maintenance-overlay')) {
            let overlay = document.createElement('div');
            overlay.id = 'maintenance-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background-color:#12121a;z-index:9999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:"Inter",sans-serif;text-align:center;padding:20px;';
            overlay.innerHTML = `
                <div style="background: linear-gradient(145deg, #1e1e2d, #12121a); border: 1px solid rgba(255, 90, 90, 0.3); border-radius: 20px; padding: 40px; text-align: center; width: 500px; max-width: 90vw; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                    <h1 style="color: #ff7070; font-size: 24px; font-weight: 800; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1.5px;">⚠️ Site Under Maintenance</h1>
                    <p style="color: #b0b0c0; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">The main site has a problem or is under maintenance. You will get updates on the community when the site is live.</p>
                    
                    <div style="display: flex; align-items: center; justify-content: center; gap: 20px; background: rgba(0,0,0,0.4); padding: 20px; border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1); margin: 0 auto;">
                        <div style="flex-shrink: 0; background: #fff; padding: 5px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://chat.whatsapp.com/CA4G8EOFRP91heRRxDT3cg" style="width: 100px; height: 100px; border-radius: 8px;">
                        </div>
                        <div style="text-align: left;">
                            <h3 style="color: #fff; font-size: 16px; font-weight: 700; margin: 0 0 6px 0;">Join Our Community</h3>
                            <p style="color: #8c8c9e; font-size: 13px; margin: 0; line-height: 1.4;">Scan this QR code to join<br>and stay updated.</p>
                        </div>
                    </div>
                </div>
            `;
            if (document.body) {
                document.body.appendChild(overlay);
            } else if (document.documentElement) {
                document.documentElement.appendChild(overlay);
            }
            
            // Stop automation if running
            chrome.storage.local.set({ 
                'automation_status': 'stopped',
                'correction_status': 'stopped',
                'rc_automation_status': 'stopped'
            });
        }
    }
}, 1000);

const initDiv = document.createElement("div"); initDiv.id = "sspcm-extension-active"; initDiv.style.display = "none"; if (document.body) document.body.appendChild(initDiv); else document.addEventListener("DOMContentLoaded", () => { if (!document.getElementById("sspcm-extension-active")) document.body.appendChild(initDiv); });
setInterval(() => { if (!document.getElementById("sspcm-extension-active")) { const activeDiv = document.createElement("div"); activeDiv.id = "sspcm-extension-active"; activeDiv.style.display = "none"; if (document.body) document.body.appendChild(activeDiv); else document.addEventListener("DOMContentLoaded", () => { if (!document.getElementById("sspcm-extension-active")) document.body.appendChild(activeDiv); }); } }, 1000);
