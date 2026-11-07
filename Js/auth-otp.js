// ============================================================
//   PAW SEVA — auth-otp.js (v5.2)
//   index.html mein main.js ke BAAD load karna hai.
//
//   v5.1: Login ka OTP backend se bheja/verify hota hai (real token).
//   v5.2: OTP SMS ya WhatsApp se (channel). WhatsApp button
//         social-login.js se PawOtp.sendVia('whatsapp') call karta hai.
//
//   main.js ka handleLoginOTP yahan override hota hai.
// ============================================================
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const NET_MSG = 'Server se connect nahi ho pa raha. 1 minute ruk kar dubara try karein (server sleep se jag raha ho sakta hai).';
  let nextChannel = 'sms';          // sirf agle OTP request ke liye

  // Testing mode mein OTP screen par dikhao (real SMS lagne par ye nahi aata)
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
      const channel = nextChannel;
      nextChannel = 'sms';
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
          body: JSON.stringify({ phone, channel }),
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
        showToast(data.dev_otp
          ? 'Demo OTP: ' + data.dev_otp
          : (channel === 'whatsapp' ? 'OTP aapke WhatsApp par bheja gaya 💬' : 'OTP aapke mobile par bheja gaya 📱'));
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
  // social-login.js ka WhatsApp button isse OTP mangwata hai
  window.PawOtp = {
    sendVia: function (channel) {
      nextChannel = channel === 'whatsapp' ? 'whatsapp' : 'sms';
      resetOTPState('li');             // purana OTP step hatao, naya bhejo
      return handleLoginOTP();
    },
  };
})();