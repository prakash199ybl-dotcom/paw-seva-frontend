// ============================================================
//   PAW SEVA — social-login.js (v5.2)
//   index.html mein main.js aur auth-otp.js ke BAAD load karna hai.
//
//   - Google: "Continue with Google" (Google ka official button)
//   - WhatsApp: WhatsApp par OTP (pehle mobile number daalna padta hai)
//   - Instagram: personal accounts ke liye login available nahi (neeche note)
//   - Jo option backend par configure nahi, uska button chhup jata hai
//
//   main.js ke loginWithGoogle / loginWithInstagram / loginWithWhatsApp
//   yahan override hote hain.
// ============================================================
(function () {
  'use strict';

  // Instagram: Meta ne Basic Display API (Dec 2024) band kar di; naya Instagram Login
  // Business/Creator accounts ke liye hai. Aam users ke liye login nahi ban sakta,
  // isliye button chhupa rahe hain. Wapas dikhana ho to false kar do.
  const HIDE_INSTAGRAM_LOGIN = true;

  const $ = (id) => document.getElementById(id);
  let cfg = { googleClientId: null, instagramUrl: null, whatsappOtp: false };

  async function loadConfig() {
    try {
      const { ok, data } = await apiFetch('/auth/public-config');
      if (ok && data.success) cfg = data;
    } catch (e) { /* config na mile to koi social button nahi dikhega */ }
  }

  // ── Google ────────────────────────────────────────────────
  function loadGoogleScript() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      const t = setTimeout(() => reject(new Error('Google script timeout')), 8000);   // atak jaye to baaki page na ruke
      s.onload  = () => { clearTimeout(t); resolve(); };
      s.onerror = () => { clearTimeout(t); reject(new Error('Google script load nahi hui')); };
      document.head.appendChild(s);
    });
  }

  async function onGoogleCredential(resp) {
    if (!resp || !resp.credential) return;
    const onSignup = !$('signupForm').classList.contains('hidden');
    const errId = onSignup ? 'su_error' : 'li_error';
    const body = { credential: resp.credential };
    if (onSignup) {                                   // signup form mein role/city bhari ho to bhejo
      const roleEl = document.querySelector('input[name="su_role"]:checked');
      if (roleEl) body.role = roleEl.value;
      const city = $('su_city') ? $('su_city').value.trim() : '';
      if (city) body.city = city;
    }
    try {
      const { ok, data } = await apiFetch('/auth/google', { method: 'POST', body: JSON.stringify(body) });
      if (!ok) { showError(errId, data.message || 'Google login fail ho gaya.'); return; }
      setToken(data.token);                           // REAL token
      setCurrentUser(data.user);
      closeModal();
      updateNavForUser(data.user);
      showToast('Welcome, ' + String(data.user.name || '').split(' ')[0] + '! 🐾');
    } catch (e) {
      showError(errId, 'Server se connect nahi ho pa raha. 1 minute ruk kar dubara try karein.');
    }
  }

  async function setupGoogle() {
    const customBtns = document.querySelectorAll('.google-btn');
    if (!cfg.googleClientId) { customBtns.forEach((b) => { b.style.display = 'none'; }); return; }
    try {
      await loadGoogleScript();
      window.google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: onGoogleCredential });
      document.querySelectorAll('.social-login-row').forEach((row) => {
        const old = row.querySelector('.google-btn');
        if (!old) return;
        const wrap = document.createElement('div');
        wrap.className = 'g-btn-wrap';
        wrap.style.cssText = 'flex:1 1 100%;display:flex;justify-content:center;min-height:44px';
        old.replaceWith(wrap);
        row.style.flexWrap = 'wrap';
        window.google.accounts.id.renderButton(wrap, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 300 });
      });
    } catch (e) {
      window.loginWithGoogle = () => showToast('Google login abhi load nahi hua. Page refresh karke try karein.');
    }
  }

  // ── WhatsApp (OTP) ────────────────────────────────────────
  function setupWhatsapp() {
    document.querySelectorAll('.wa-btn').forEach((b) => { b.style.display = cfg.whatsappOtp ? '' : 'none'; });
    window.loginWithWhatsApp = function () {
      if (!cfg.whatsappOtp) { showToast('WhatsApp OTP abhi available nahi hai.'); return; }
      const su = $('su_phone') ? $('su_phone').value.trim() : '';
      if ($('li_phone') && !$('li_phone').value.trim() && /^\d{10}$/.test(su)) $('li_phone').value = su;
      showLogin();                                    // WhatsApp OTP sirf registered number ke liye
      if (!/^\d{10}$/.test($('li_phone').value.trim())) {
        showError('li_error', 'Pehle apna 10-digit mobile number daalein, phir WhatsApp dabayein.');
        $('li_phone').focus();
        return;
      }
      window.PawOtp.sendVia('whatsapp');
    };
  }

  // ── Instagram ─────────────────────────────────────────────
  function setupInstagram() {
    if (HIDE_INSTAGRAM_LOGIN) document.querySelectorAll('.insta-btn').forEach((b) => { b.style.display = 'none'; });
    window.loginWithInstagram = function () {
      if (cfg.instagramUrl) window.open(cfg.instagramUrl, '_blank', 'noopener');
      else showToast('Instagram login available nahi hai.');
    };
    if (cfg.instagramUrl) {                           // footer ka Instagram icon apne page par le jaye
      document.querySelectorAll('.social-links a').forEach((a) => {
        if (a.querySelector('.fa-instagram')) { a.href = cfg.instagramUrl; a.target = '_blank'; a.rel = 'noopener'; }
      });
    }
  }

  // Koi button visible nahi to "or sign up with" wali line bhi hata do
  function tidyRows() {
    document.querySelectorAll('.social-login-row').forEach((row) => {
      const visible = Array.from(row.children).some((c) => c.style.display !== 'none');
      row.style.display = visible ? 'flex' : 'none';
      const prev = row.previousElementSibling;
      if (prev && prev.classList.contains('divider-or')) prev.style.display = visible ? '' : 'none';
    });
  }

  async function init() {
    await loadConfig();
    setupInstagram();
    setupWhatsapp();
    await setupGoogle();
    tidyRows();
  }

  window.loginWithGoogle = () => showToast('Google login abhi available nahi hai.');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();