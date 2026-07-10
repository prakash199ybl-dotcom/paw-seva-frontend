// ============================================================
//   PAW SEVA — main.js 
//   1. Story submit → community wall turant update hoti hai
//   2. Login ke baad "Join Paw Seva" hide, Logout show
//   3. GPS location — city auto-detect
//   4. timeAgo function added
//   5. Duplicate email field removed
//   6. Signup mein city save hoti hai
// ============================================================

const API = 'https://paw-seva-backend.onrender.com/api';

// ── Token helpers ─────────────────────────────────────────────────────────────
function getToken()          { return localStorage.getItem('ps_token'); }
function setToken(t)         { localStorage.setItem('ps_token', t); }
function removeToken()       { localStorage.removeItem('ps_token'); }
function getCurrentUser()    { const u = localStorage.getItem('ps_current'); return u ? JSON.parse(u) : null; }
function setCurrentUser(u)   { localStorage.setItem('ps_current', JSON.stringify(u)); }
function removeCurrentUser() { localStorage.removeItem('ps_current'); }

// ── Generic fetch wrapper ──────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res  = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ── Modal control ─────────────────────────────────────────────────────────────
const modal = document.getElementById('authModal');

function openModal(tab = 'signup') {
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  tab === 'login' ? showLogin() : showSignup();
}
function closeModal() {
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
  clearErrors();
  clearFormFields();
  resetOTPState('su');
  resetOTPState('li');
}

if (modal) {
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); closeUploadModal(); }
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
function showSignup() {
  document.getElementById('signupForm').classList.remove('hidden');
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('tabSignup').classList.add('active');
  document.getElementById('tabLogin').classList.remove('active');
  clearErrors();
}
function showLogin() {
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('signupForm').classList.add('hidden');
  document.getElementById('tabLogin').classList.add('active');
  document.getElementById('tabSignup').classList.remove('active');
  clearErrors();
}

// ── OTP State ─────────────────────────────────────────────────────────────────
let otpState = { su: { sent: false, otp: '', phone: '' }, li: { sent: false, otp: '', phone: '' } };

function resetOTPState(prefix) {
  otpState[prefix] = { sent: false, otp: '', phone: '' };
  const otpGroup = document.getElementById(`${prefix}_otp_group`);
  if (otpGroup) otpGroup.style.display = 'none';
  const btn = document.getElementById(`${prefix}_btn`);
  if (btn) btn.textContent = 'Get OTP 📲';
  document.querySelectorAll(`#${prefix}_otp_group .otp-box`).forEach(b => b.value = '');
}

function getOTPValue(prefix) {
  return Array.from(document.querySelectorAll(`#${prefix}_otp_group .otp-box`)).map(b => b.value).join('');
}

function setupOTPBoxes(prefix) {
  const boxes = document.querySelectorAll(`#${prefix}_otp_group .otp-box`);
  boxes.forEach((box, index) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      box.value = val;
      if (val && index < boxes.length - 1) boxes[index + 1].focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && index > 0) boxes[index - 1].focus();
    });
  });
}

// ── Signup OTP handler ─────────────────────────────────────────────────────────
async function handleSignupOTP() {
  if (!otpState.su.sent) {
    const phone = document.getElementById('su_phone').value.trim();
    if (!phone || phone.length !== 10 || !/^\d+$/.test(phone)) {
      showError('su_error', 'Please enter a valid 10-digit mobile number.'); return;
    }
    const name = document.getElementById('su_name').value.trim();
    if (!name) { showError('su_error', 'Please enter your full name.'); return; }
    const roleEl = document.querySelector('input[name="su_role"]:checked');
    if (!roleEl) { showError('su_error', 'Please select your role.'); return; }

    setBtnLoading('su_btn', true, 'Get OTP 📲');
    const demoOTP = Math.floor(100000 + Math.random() * 900000).toString();
    otpState.su = { sent: true, otp: demoOTP, phone };
    document.getElementById('su_phone_display').textContent = phone;
    document.getElementById('su_otp_group').style.display = 'block';
    setupOTPBoxes('su');
    setBtnLoading('su_btn', false, 'Verify OTP ✓');
    document.getElementById('su_btn').textContent = 'Verify OTP ✓';
    showToast(`OTP sent to +91 ${phone} · Demo OTP: ${demoOTP}`);
    document.querySelector('#su_otp_group .otp-box').focus();
  } else {
    const enteredOTP = getOTPValue('su');
    if (enteredOTP.length !== 6) { showError('su_error', 'Please enter the complete 6-digit OTP.'); return; }
    if (enteredOTP !== otpState.su.otp) { showError('su_error', 'Incorrect OTP. Please try again.'); return; }

    const name     = document.getElementById('su_name').value.trim();
    const email    = document.getElementById('su_email').value.trim() || `user${otpState.su.phone}@pawseva.app`;
    const phone    = otpState.su.phone;
    const roleEl   = document.querySelector('input[name="su_role"]:checked');
    const city     = document.getElementById('su_city')?.value?.trim() || '';
    const password = `OTP_${Date.now()}`;

    setBtnLoading('su_btn', true, 'Verify OTP ✓');
    try {
      const { ok, data } = await apiFetch('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role: roleEl.value, phone, city }),
      });
      if (!ok) { showError('su_error', data.message || 'Signup failed. Try again.'); return; }
      setToken(data.token);
      setCurrentUser(data.user);
      closeModal();
      updateNavForUser(data.user);
      showToast(`Welcome to Paw Seva, ${data.user.name.split(' ')[0]}! 🐾`);
    } catch {
      // Demo mode
      const demoUser = { id: Date.now(), name, email, phone, role: roleEl.value, city };
      setCurrentUser(demoUser);
      setToken('demo_token_' + Date.now());
      closeModal();
      updateNavForUser(demoUser);
      showToast(`Welcome to Paw Seva, ${name.split(' ')[0]}! 🐾`);
    } finally {
      setBtnLoading('su_btn', false, 'Verify OTP ✓');
    }
  }
}

// ── Login OTP handler ──────────────────────────────────────────────────────────
async function handleLoginOTP() {
  if (!otpState.li.sent) {
    const phone = document.getElementById('li_phone').value.trim();
    if (!phone || phone.length !== 10 || !/^\d+$/.test(phone)) {
      showError('li_error', 'Please enter a valid 10-digit mobile number.'); return;
    }
    setBtnLoading('li_btn', true, 'Get OTP 📲');
    const demoOTP = Math.floor(100000 + Math.random() * 900000).toString();
    otpState.li = { sent: true, otp: demoOTP, phone };
    document.getElementById('li_phone_display').textContent = phone;
    document.getElementById('li_otp_group').style.display = 'block';
    setupOTPBoxes('li');
    setBtnLoading('li_btn', false, 'Verify OTP ✓');
    document.getElementById('li_btn').textContent = 'Verify OTP ✓';
    showToast(`OTP sent to +91 ${phone} · Demo OTP: ${demoOTP}`);
    document.querySelector('#li_otp_group .otp-box').focus();
  } else {
    const enteredOTP = getOTPValue('li');
    if (enteredOTP.length !== 6) { showError('li_error', 'Please enter the complete 6-digit OTP.'); return; }
    if (enteredOTP !== otpState.li.otp) { showError('li_error', 'Incorrect OTP. Please try again.'); return; }

    const phone = otpState.li.phone;
    setBtnLoading('li_btn', true, 'Verify OTP ✓');
    try {
      const { ok, data } = await apiFetch('/auth/login-phone', {
        method: 'POST',
        body: JSON.stringify({ phone, otp: enteredOTP }),
      });
      if (ok) {
        setToken(data.token);
        setCurrentUser(data.user);
        closeModal();
        updateNavForUser(data.user);
        showToast(data.user.role === 'admin' ? 'Welcome back, Admin! 🛡️' : `Welcome back, ${data.user.name.split(' ')[0]}! 🐾`);
      } else {
        throw new Error('Backend OTP not configured');
      }
    } catch {
      // Demo mode — existing user ka naam use karo
      const existingUser = getCurrentUser();
      const demoUser = {
        id:    Date.now(),
        name:  existingUser?.name || `User ${phone.slice(-4)}`,
        phone: phone,
        role:  existingUser?.role || 'Donor',
        city:  existingUser?.city || '',
      };
      setCurrentUser(demoUser);
      closeModal();
      updateNavForUser(demoUser);
      showToast(`Welcome back, ${demoUser.name.split(' ')[0]}! 🐾`);
    } finally {
      setBtnLoading('li_btn', false, 'Verify OTP ✓');
    }
  }
}

function resendOTP(prefix) {
  resetOTPState(prefix);
  showToast('Please request a new OTP.');
}

// ── Social login ───────────────────────────────────────────────────────────────
function loginWithGoogle()    { showToast('Google OAuth: Configure in backend 📧'); }
function loginWithInstagram() { showToast('Instagram OAuth: Configure in backend 📸'); }
function loginWithWhatsApp()  { showToast('WhatsApp OTP: Configure Business API 💬'); }

// ── Logout ────────────────────────────────────────────────────────────────────
function doLogout() {
  removeToken();
  removeCurrentUser();
  updateNavForUser(null);
  showToast('Logged out successfully.');
}

// ── FIX 2: Navbar update — login hone pe Join Paw Seva HIDE, Logout SHOW ──────
function updateNavForUser(user) {
  const authBtns      = document.getElementById('authBtns');
  const userNav       = document.getElementById('userNav');
  const userNavName   = document.getElementById('userNavName');
  const userNavAvatar = document.getElementById('userNavAvatar');
  const adminNavLink  = document.getElementById('adminNavLink');
  const dashLink      = document.getElementById('dashLink');

  if (user) {
    // Logged in — Join Paw Seva HIDE karo, user info SHOW karo
    if (authBtns)      authBtns.classList.add('hidden');
    if (userNav)       userNav.classList.add('visible');
    if (userNavName)   userNavName.textContent   = user.name ? user.name.split(' ')[0] : 'User';
    if (userNavAvatar) userNavAvatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    if (dashLink)      dashLink.style.display    = 'block';
    if (adminNavLink)  adminNavLink.style.display = user.role === 'admin' ? 'block' : 'none';
  } else {
    // Logged out — Join Paw Seva SHOW karo
    if (authBtns)     authBtns.classList.remove('hidden');
    if (userNav)      userNav.classList.remove('visible');
    if (dashLink)     dashLink.style.display     = 'none';
    if (adminNavLink) adminNavLink.style.display = 'none';
  }
}

// ── Session verify ─────────────────────────────────────────────────────────────
async function verifySession() {
  const token = getToken();
  if (!token) { updateNavForUser(null); return; }
  try {
    const { ok, data } = await apiFetch('/auth/me');
    if (ok && data.user) { setCurrentUser(data.user); updateNavForUser(data.user); }
    else {
      removeToken(); removeCurrentUser(); updateNavForUser(null);
    }
  } catch {
    const cached = getCurrentUser();
    if (cached) updateNavForUser(cached);
    else updateNavForUser(null);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function setBtnLoading(id, isLoading, label) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled    = isLoading;
  btn.textContent = isLoading ? 'Please wait...' : label;
}
function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function clearErrors() {
  ['su_error','li_error','upload_error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  });
}
function clearFormFields() {
  ['su_name','su_phone','su_email','su_city','li_phone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const checked = document.querySelector('input[name="su_role"]:checked');
  if (checked) checked.checked = false;
}
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── timeAgo helper ─────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return 'Just now';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (hrs < 24)  return `${hrs} hr ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

// ── Quotes rotator ────────────────────────────────────────────────────────────
const quotes = [
  { text: "The greatness of a nation can be judged by the way its animals are treated.", cite: "— Mahatma Gandhi" },
  { text: "I may have lived a life less ordinary, but the dogs who came into my life made it extraordinary.", cite: "— Ratan Tata" },
  { text: "Until one has loved an animal, a part of one's soul remains unawakened.", cite: "— Anatole France" },
  { text: "Be the voice for those who cannot speak.", cite: "— Paw Seva" },
  { text: "Every street dog deserves a full belly and a warm place to sleep.", cite: "— Anonymous" },
];
let currentQuote = 0;
function rotateQuote(index) {
  currentQuote = (index !== undefined) ? index : (currentQuote + 1) % quotes.length;
  const el     = document.getElementById('quoteText');
  const citeEl = document.getElementById('quoteCite');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent     = `"${quotes[currentQuote].text}"`;
    citeEl.textContent = quotes[currentQuote].cite;
    el.style.opacity   = '1';
    updateDots();
  }, 300);
}
function updateDots() {
  document.querySelectorAll('.q-dot').forEach((dot, i) => dot.classList.toggle('active', i === currentQuote));
}

// ── Animated counters ─────────────────────────────────────────────────────────
function animateCounters() {
  document.querySelectorAll('.counter').forEach(counter => {
    const target = parseInt(counter.getAttribute('data-target'));
    const suffix = counter.getAttribute('data-suffix') || '+';
    let count = 0;
    const step  = Math.ceil(target / 80);
    const timer = setInterval(() => {
      count += step;
      if (count >= target) { count = target; clearInterval(timer); }
      counter.textContent = count.toLocaleString('en-IN') + suffix;
    }, 20);
  });
}

// ── Activity Wall ─────────────────────────────────────────────────────────────
const ACTIVITY_ICONS     = { feeding:'🍲', rescue:'🚨', medical:'🏥', adoption:'🏠', shelter:'🏕️' };
const ACTIVITY_TAG_CLASS = { feeding:'tag-feeding', rescue:'tag-rescue', medical:'tag-medical', adoption:'tag-adoption', shelter:'tag-shelter' };

const sampleActivities = [
  { id:'s1', type:'feeding',  name:'Ravi Kumar',          location:'Indore, MP',  caption:'Fed 15 stray dogs at Palasia Square today! 🐕',                  image:'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&q=80', time:'2 hours ago', likes:24 },
  { id:'s2', type:'rescue',   name:'Priya NGO',            location:'Bhopal, MP',  caption:'Rescued an injured puppy near Bharat Talkies, took to the vet.', image:'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&q=80', time:'5 hours ago', likes:41 },
  { id:'s3', type:'medical',  name:'Dr. Sharma',           location:'Mumbai',      caption:'Free vaccination camp for 30+ street dogs in Dharavi.',            image:'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=400&q=80', time:'Yesterday',   likes:88 },
  { id:'s4', type:'adoption', name:'Sneha P.',             location:'Pune',        caption:'Bruno found his forever home today! 3 months on street 💛',       image:'https://images.unsplash.com/photo-1544568100-847a948585b9?w=400&q=80', time:'2 days ago',  likes:112 },
  { id:'s5', type:'shelter',  name:'Paw Seva Volunteers',  location:'Delhi',       caption:'Set up temporary shelter for 8 strays near Lajpat Nagar.',        image:'https://images.unsplash.com/photo-1615751072497-5f5169febe17?w=400&q=80', time:'3 days ago',  likes:67 },
  { id:'s6', type:'feeding',  name:'Amit & Family',        location:'Indore, MP',  caption:'Sunday feeding drive at Vijay Nagar. Kids loved it! 🙏',         image:'https://images.unsplash.com/photo-1582456891705-0e225ff48ddd?w=400&q=80', time:'4 days ago',  likes:53 },
];

// ── createActivityCard ─────────────────────────────────────────────────────────
function createActivityCard(activity) {
  const typeLabel = activity.type ? activity.type.charAt(0).toUpperCase() + activity.type.slice(1) : 'Activity';
  const isLiked   = (JSON.parse(localStorage.getItem('ps_liked') || '[]')).includes(String(activity.id));

  // Image validation — base64 ya valid URL
  const hasImage = activity.image &&
    typeof activity.image === 'string' &&
    activity.image.length > 10 &&
    activity.image !== window.location.href &&
    activity.image !== 'undefined' &&
    activity.image !== 'null';

  // Caption mein quotes escape karo
  const safeCaption = (activity.caption || '').replace(/`/g, "'").replace(/"/g, '&quot;');
  const safeName    = (activity.name    || 'Anonymous').replace(/'/g, '&#39;');

  return `
    <div class="activity-card" id="card-${activity.id}">
      ${hasImage
        ? `<img class="activity-card-img" src="${activity.image}" alt="Activity" loading="lazy"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
           <div class="activity-card-img-placeholder" style="display:none">${ACTIVITY_ICONS[activity.type] || '🐾'}</div>`
        : `<div class="activity-card-img-placeholder">${ACTIVITY_ICONS[activity.type] || '🐾'}</div>`
      }
      <div class="activity-card-body">
        <span class="activity-tag ${ACTIVITY_TAG_CLASS[activity.type] || 'tag-feeding'}">
          ${ACTIVITY_ICONS[activity.type] || '🐾'} ${typeLabel}
        </span>
        <p class="activity-card-caption">${activity.caption || ''}</p>
        <div class="activity-card-meta">
          <span>👤 ${activity.name || 'Anonymous'}</span>
          <span>📍 ${activity.location || '—'}</span>
          <span>⏰ ${activity.time || 'Just now'}</span>
        </div>
        <div class="activity-card-likes">
          <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${activity.id}', this)">
            ❤️ ${activity.likes || 0} Likes
          </button>
          <button class="like-btn" onclick="shareActivity('${safeName}', '${safeCaption}')">
            🔗 Share
          </button>
        </div>
      </div>
    </div>`;
}

// ── FIX 1: renderActivityWall — backend se fresh data, turant update ──────────
async function renderActivityWall() {
  const wall = document.getElementById('activityWall');
  if (!wall) return;

  wall.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#4f8c74;font-family:DM Sans,sans-serif">🐾 Loading stories...</div>';

  try {
    const response = await fetch(`${API}/activities?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Server error');
    const data = await response.json();

    if (data.success && data.activities && data.activities.length > 0) {
      wall.innerHTML = data.activities.map(a => createActivityCard({
        id:       a._id,
        type:     a.type     || 'feeding',
        name:     a.name     || 'Anonymous',
        location: a.location || '—',
        caption:  a.caption  || '',
        image:    a.image    || null,
        time:     timeAgo(a.createdAt),
        likes:    a.likes    || 0,
      })).join('');
      return;
    }
    throw new Error('No activities from server');
  } catch {
    // Fallback — localStorage + sample data
    const stored = JSON.parse(localStorage.getItem('ps_activities') || '[]');
    const all    = [...stored, ...sampleActivities];
    wall.innerHTML = all.slice(0, 6).map(createActivityCard).join('');
  }
}

// ── toggleLike ─────────────────────────────────────────────────────────────────
async function toggleLike(id, btn) {
  const user   = getCurrentUser();
  const userId = user?.id || localStorage.getItem('ps_device_id') || (() => {
    const d = 'device_' + Date.now();
    localStorage.setItem('ps_device_id', d);
    return d;
  })();

  try {
    const res  = await fetch(`${API}/activities/${id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (data.success) {
      btn.textContent = `❤️ ${data.likes} Likes`;
      data.liked ? btn.classList.add('liked') : btn.classList.remove('liked');
    }
  } catch {
    const liked   = JSON.parse(localStorage.getItem('ps_liked') || '[]');
    const isLiked = liked.includes(id);
    if (isLiked) { liked.splice(liked.indexOf(id), 1); btn.classList.remove('liked'); }
    else         { liked.push(id);                     btn.classList.add('liked'); }
    localStorage.setItem('ps_liked', JSON.stringify(liked));
    const count = parseInt(btn.textContent.match(/\d+/)?.[0] || 0);
    btn.textContent = `❤️ ${isLiked ? count - 1 : count + 1} Likes`;
  }
}

function shareActivity(name, caption) {
  if (navigator.share) {
    navigator.share({ title: 'Paw Seva Activity', text: `${name}: ${caption}`, url: window.location.href });
  } else {
    navigator.clipboard?.writeText(`${name}: ${caption} — Paw Seva`);
    showToast('Copied to clipboard! 🔗');
  }
}

// ── Upload Modal ───────────────────────────────────────────────────────────────
function openUploadModal() {
  const u = getCurrentUser();
  if (!u) { openModal('signup'); showToast('Please join Paw Seva first! 🐾'); return; }

  // Auto-fill name + city from logged-in user
  const nameField = document.getElementById('uploaderName');
  const cityField = document.getElementById('activityLocation');
  if (nameField && u.name) nameField.value = u.name;
  if (cityField && u.city) cityField.value = u.city;

  document.getElementById('uploadModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeUploadModal() {
  const modal = document.getElementById('uploadModal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
  clearErrors();

  // Reset upload form
  document.getElementById('photoPreviewArea').style.display  = 'none';
  document.getElementById('photoPreview').src                = '';
  document.getElementById('activityCaption').value           = '';
  document.getElementById('activityLocation').value          = '';
  document.getElementById('uploaderName').value              = '';

  // Reset drop zone
  const dz = document.getElementById('uploadDropZone');
  if (dz) dz.style.display = 'block';

  // Reset GPS status
  const gs = document.getElementById('gpsStatus');
  if (gs) { gs.textContent = 'Click 📍 to auto-detect your location'; gs.style.color = ''; }
}

function handlePhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('photoPreview').src = e.target.result;
    document.getElementById('photoPreviewArea').style.display  = 'block';
    document.getElementById('uploadDropZone').style.display    = 'none';
  };
  reader.readAsDataURL(file);
}

// Drag and drop
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('uploadDropZone');
  if (!dropZone) return;
  dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.style.borderColor = '#2f6b57'; });
  dropZone.addEventListener('dragleave', ()  => { dropZone.style.borderColor = '#c8dfd3'; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById('photoPreview').src = ev.target.result;
        document.getElementById('photoPreviewArea').style.display = 'block';
        dropZone.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
  });
});

// ── FIX 1: submitActivity — backend mein save + wall turant reload ─────────────
async function submitActivity() {
  const caption  = document.getElementById('activityCaption').value.trim();
  const location = document.getElementById('activityLocation').value.trim();
  const type     = document.getElementById('activityType').value;
  const nameVal  = document.getElementById('uploaderName').value.trim();
  const preview  = document.getElementById('photoPreview').src;

  if (!caption)  { showError('upload_error', 'Please add a caption.'); return; }
  if (!location) { showError('upload_error', 'Please add your location.'); return; }
  if (!nameVal)  { showError('upload_error', 'Please add your name.'); return; }

  const submitBtn = document.querySelector('#uploadModal .btn-form');
  if (submitBtn) { submitBtn.textContent = '⏳ Sharing...'; submitBtn.disabled = true; }

  try {
    let imageData = null;
    if (preview && preview.startsWith('data:image')) {
      imageData = preview.length > 500000 ? await compressImage(preview, 0.5) : preview;
    }

    const response = await fetch(`${API}/activities`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: nameVal, type, caption, location, image: imageData }),
    });

    const data = await response.json();

    if (data.success) {
      closeUploadModal();
      showToast('Story shared with the community! 🐾');
      // Wall turant reload karo — naya story dikhega
      await renderActivityWall();
      document.getElementById('community')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      showError('upload_error', data.message || 'Upload failed. Try again.');
    }
  } catch {
    // Offline fallback — localStorage mein save karo
    const newActivity = {
      id:       Date.now(),
      type, name: nameVal, location, caption,
      image:    preview && preview.startsWith('data:') ? preview : null,
      time:     'Just now',
      likes:    0,
    };
    const stored = JSON.parse(localStorage.getItem('ps_activities') || '[]');
    stored.unshift(newActivity);
    localStorage.setItem('ps_activities', JSON.stringify(stored));
    closeUploadModal();
    await renderActivityWall();
    showToast('Story saved locally! (Backend offline) 🐾');
    document.getElementById('community')?.scrollIntoView({ behavior: 'smooth' });
  } finally {
    if (submitBtn) { submitBtn.textContent = 'Share with Community 🐾'; submitBtn.disabled = false; }
  }
}

// ── Counter observer ──────────────────────────────────────────────────────────
function setupCounterObserver() {
  const statsStrip = document.querySelector('.stats-strip');
  if (!statsStrip) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { animateCounters(); observer.disconnect(); }
    });
  }, { threshold: 0.3 });
  observer.observe(statsStrip);
}

// ── DOMContentLoaded ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await verifySession();
  setInterval(rotateQuote, 5000);
  updateDots();
  setupCounterObserver();
  renderActivityWall();

  // Join btn — logged in hone pe dashboard pe bhejo
  document.querySelector('.join-btn')?.addEventListener('click', () => {
    getCurrentUser() ? (window.location.href = 'dashboard.html') : openModal('signup');
  });
});

// ── Image compress ─────────────────────────────────────────────────────────────
function compressImage(base64, quality = 0.6) {
  return new Promise((resolve) => {
    const img  = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX) { h = h * MAX / w; w = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = base64;
  });
}

// ── FIX 3: GPS Location Helper ─────────────────────────────────────────────────
// OpenStreetMap Nominatim — completely free, no API key
function getLocationFromGPS(callback) {
  if (!navigator.geolocation) {
    showToast('GPS not supported on this device.');
    callback(null); return;
  }
  showToast('📍 Detecting your location...');
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || 'Unknown';
        const state    = addr.state    || '';
        const pincode  = addr.postcode || '';
        const street   = addr.road || addr.neighbourhood || '';
        const area     = addr.suburb || addr.locality || '';
        const fullAddress = [street, area, city, state, pincode].filter(Boolean).join(', ');
        callback({ city, state, pincode, fullAddress, lat: latitude, lon: longitude });
        showToast(`📍 ${city}, ${state}`);
      } catch {
        showToast('Could not get address. Enter manually.');
        callback(null);
      }
    },
    (error) => {
      const msgs = { 1: 'Location permission denied.', 2: 'Location unavailable.', 3: 'Request timed out.' };
      showToast(msgs[error.code] || 'GPS error.');
      callback(null);
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

// ── autoFillCity — GPS se city field fill karo ────────────────────────────────
function autoFillCity(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  const btn = field.parentElement?.querySelector('button');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  const statusId = fieldId === 'su_city' ? 'su_gps_status' : 'gpsStatus';
  const statusEl = document.getElementById(statusId);
  if (statusEl) { statusEl.textContent = '🔍 Detecting...'; statusEl.style.color = '#4f8c74'; }

  getLocationFromGPS((location) => {
    if (btn) { btn.textContent = '📍'; btn.disabled = false; }
    if (!location) {
      if (statusEl) { statusEl.textContent = '❌ Could not detect. Enter manually.'; statusEl.style.color = '#e05454'; }
      return;
    }
    field.value = `${location.city}, ${location.state}`;
    field.style.borderColor = '#4f8c74';
    if (statusEl) { statusEl.textContent = `✅ ${location.fullAddress}`; statusEl.style.color = '#2f6b57'; }

    // User ke localStorage mein bhi save karo
    const u = getCurrentUser();
    if (u) { u.city = `${location.city}, ${location.state}`; u.fullAddress = location.fullAddress; setCurrentUser(u); }
  });
}
