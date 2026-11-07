// ============================================================
//   PAW SEVA — auth-otp.js (v5.1)
//   index.html mein main.js ke BAAD load karna hai.
//
//   FIX: Login ka OTP ab backend se bheja aur verify kiya jata hai,
//   isliye user ko REAL token milta hai (story upload/delete chalta hai).
//   Pehle: backend fail -> fake "demo" session -> upload par
//   "login session purana hai" error.
//
//   main.js ka handleLoginOTP yahan override hota hai.
//   main.js ko edit karne ki zaroorat nahi.
// ============================================================
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const NET_MSG = 'Server se connect nahi ho pa raha. 1 minute ruk kar dubara try karein (server sleep se jag raha ho sakta hai).';

  // OTP screen par dikhana ho (testing mode) to hint ke neeche dikhao
  function showDevOtp(otp) {
    const hint = document.querySelector('#li_otp_group .otp-hint');
    if (!hint) return;
    const old = hint.querySelector('.dev-otp');
    if (old) old.remove();
    if (!otp) return;
    const span = document.createElement('span');
    span.className = 'dev-otp';
    span.style.cssText = 'display:block;margin-top:6px;font-weight:700;color:#2f6b57';
    span.textContent = 'Demo OTP: ' + otp;
    hint.appendChild(span);
  }

  async function handleLoginOTP() {
    // ── Step 1: OTP mangwao ─────────────────────────────────
    if (!otpState.li.sent) {
      const phone = $('li_phone').value.trim();
      if (!/^\d{10}$/.test(phone)) {
        showError('li_error', 'Please enter a valid 10-digit mobile number.');
        return;
      }
      clearErrors();
      setBtnLoading('li_btn', true, 'Get OTP 📲');
      try {
        const { ok, data } = await apiFetch('/auth/send-otp', {
          method: 'POST',
          body: JSON.stringify({ phone }),
        });
        if (!ok) {
          showError('li_error', data.message || 'OTP nahi bheja ja saka.');
          setBtnLoading('li_btn', false, 'Get OTP 📲');
          return;
        }
        otpState.li = { sent: true, otp: '', phone };        // OTP ab server ke paas hai
        $('li_phone_display').textContent = phone;
        $('li_otp_group').style.display = 'block';
        setupOTPBoxes('li');
        showDevOtp(data.dev_otp);
        setBtnLoading('li_btn', false, 'Verify OTP ✓');
        showToast(data.dev_otp ? 'Demo OTP: ' + data.dev_otp : 'OTP aapke mobile par bheja gaya 📱');
        const first = document.querySelector('#li_otp_group .otp-box');
        if (first) first.focus();
      } catch (e) {
        showError('li_error', NET_MSG);
        setBtnLoading('li_btn', false, 'Get OTP 📲');
      }
      return;
    }

    // ── Step 2: OTP verify (server karta hai) ───────────────
    const entered = getOTPValue('li');
    if (entered.length !== 6) {
      showError('li_error', 'Please enter the complete 6-digit OTP.');
      return;
    }
    clearErrors();
    setBtnLoading('li_btn', true, 'Verify OTP ✓');
    try {
      const { ok, data } = await apiFetch('/auth/login-phone', {
        method: 'POST',
        body: JSON.stringify({ phone: otpState.li.phone, otp: entered }),
      });
      if (!ok) {
        showError('li_error', data.message || 'OTP galat hai.');
        setBtnLoading('li_btn', false, 'Verify OTP ✓');
        return;
      }
      setToken(data.token);                // REAL token
      setCurrentUser(data.user);
      closeModal();                        // form reset karta hai
      setBtnLoading('li_btn', false, 'Get OTP 📲');
      updateNavForUser(data.user);
      showToast('Welcome back, ' + String(data.user.name || '').split(' ')[0] + '! 🐾');
    } catch (e) {
      showError('li_error', NET_MSG);
      setBtnLoading('li_btn', false, 'Verify OTP ✓');
    }
  }

  window.handleLoginOTP = handleLoginOTP;
})();