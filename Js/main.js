// ============================================================
//   PAW SEVA — main.js  (Updated v2.0)
//   OTP login, Social auth, Community wall, Animated counters
// ============================================================

// const API = 'http://localhost:5000/api';
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
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  tab === 'login' ? showLogin() : showSignup();
}
function closeModal() {
  modal.classList.remove('open');
  document.body.style.overflow = '';
  clearErrors();
  clearFormFields();
  // Reset OTP states
  resetOTPState('su');
  resetOTPState('li');
}
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeUploadModal(); } });

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

// ── OTP State management ───────────────────────────────────────────────────────
let otpState = { su: { sent: false, otp: '', phone: '' }, li: { sent: false, otp: '', phone: '' } };

function resetOTPState(prefix) {
  otpState[prefix] = { sent: false, otp: '', phone: '' };
  const otpGroup = document.getElementById(`${prefix}_otp_group`);
  if (otpGroup) otpGroup.style.display = 'none';
  const btn = document.getElementById(`${prefix}_btn`);
  if (btn) btn.textContent = 'Get OTP 📲';
  // Clear OTP boxes
  const otpBoxes = document.querySelectorAll(`#${prefix}_otp_group .otp-box`);
  otpBoxes.forEach(b => b.value = '');
}

function getOTPValue(prefix) {
  const boxes = document.querySelectorAll(`#${prefix}_otp_group .otp-box`);
  return Array.from(boxes).map(b => b.value).join('');
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
    // Step 1: Send OTP
    const phone = document.getElementById('su_phone').value.trim();
    if (!phone || phone.length !== 10 || !/^\d+$/.test(phone)) {
      showError('su_error', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    const name = document.getElementById('su_name').value.trim();
    if (!name) { showError('su_error', 'Please enter your full name.'); return; }
    const roleEl = document.querySelector('input[name="su_role"]:checked');
    if (!roleEl) { showError('su_error', 'Please select your role.'); return; }

    setBtnLoading('su_btn', true, 'Get OTP 📲');
    // Simulate OTP (in production, call backend /api/auth/send-otp)
    const demoOTP = Math.floor(100000 + Math.random() * 900000).toString();
    otpState.su = { sent: true, otp: demoOTP, phone };
    document.getElementById('su_phone_display').textContent = phone;
    document.getElementById('su_otp_group').style.display = 'block';
    setupOTPBoxes('su');
    setBtnLoading('su_btn', false, 'Verify OTP ✓');
    document.getElementById('su_btn').textContent = 'Verify OTP ✓';
    showToast(`OTP sent to +91 ${phone} (Demo OTP: ${demoOTP})`);
    document.querySelector('#su_otp_group .otp-box').focus();
  } else {
    // Step 2: Verify OTP & create account
    const enteredOTP = getOTPValue('su');
    if (enteredOTP.length !== 6) { showError('su_error', 'Please enter the complete 6-digit OTP.'); return; }
    if (enteredOTP !== otpState.su.otp) { showError('su_error', 'Incorrect OTP. Please try again.'); return; }

    const name    = document.getElementById('su_name').value.trim();
    const email   = document.getElementById('su_email').value.trim() || `user${otpState.su.phone}@pawseva.app`;
    const phone   = otpState.su.phone;
    const roleEl  = document.querySelector('input[name="su_role"]:checked');
    const password = `OTP_${Date.now()}`;

    setBtnLoading('su_btn', true, 'Verify OTP ✓');
    try {
      const { ok, data } = await apiFetch('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role: roleEl.value, phone }),
      });
      if (!ok) { showError('su_error', data.message || 'Signup failed. Try again.'); return; }
      setToken(data.token);
      setCurrentUser(data.user);
      closeModal();
      updateNavForUser(data.user);
      showToast(`Welcome to Paw Seva, ${data.user.name.split(' ')[0]}! 🐾`);
    } catch {
      // Demo mode when backend not available
      const demoUser = { id: Date.now(), name, email, phone, role: roleEl.value };
      setCurrentUser(demoUser);
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
      showError('li_error', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setBtnLoading('li_btn', true, 'Get OTP 📲');
    const demoOTP = Math.floor(100000 + Math.random() * 900000).toString();
    otpState.li = { sent: true, otp: demoOTP, phone };
    document.getElementById('li_phone_display').textContent = phone;
    document.getElementById('li_otp_group').style.display = 'block';
    setupOTPBoxes('li');
    setBtnLoading('li_btn', false, 'Verify OTP ✓');
    document.getElementById('li_btn').textContent = 'Verify OTP ✓';
    showToast(`OTP sent to +91 ${phone} (Demo OTP: ${demoOTP})`);
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
        const msg = data.user.role === 'admin' ? 'Welcome back, Admin! 🛡️' : `Welcome back, ${data.user.name.split(' ')[0]}! 🐾`;
        showToast(msg);
      } else {
        throw new Error('Backend OTP login not configured');
      }
    } catch {
      // Demo mode
      const demoUser = { id: Date.now(), name: `User ${phone.slice(-4)}`, phone, role: 'Donor' };
      setCurrentUser(demoUser);
      closeModal();
      updateNavForUser(demoUser);
      showToast(`Welcome back! 🐾`);
    } finally {
      setBtnLoading('li_btn', false, 'Verify OTP ✓');
    }
  }
}

function resendOTP(prefix) {
  resetOTPState(prefix);
  showToast('OTP state reset. Please request a new OTP.');
}

// ── Social login handlers ──────────────────────────────────────────────────────
function loginWithGoogle() {
  showToast('Google OAuth: Configure in backend with passport-google-oauth20 📧');
  // In production: window.location.href = `${API}/auth/google`;
}
function loginWithInstagram() {
  showToast('Instagram OAuth: Configure in backend with passport-instagram 📸');
  // In production: window.location.href = `${API}/auth/instagram`;
}
function loginWithWhatsApp() {
  showToast('WhatsApp OTP: Configure WhatsApp Business API 💬');
  // In production: open WhatsApp OTP flow
}

// ── LOGOUT ────────────────────────────────────────────────────────────────────
function doLogout() {
  removeToken(); removeCurrentUser();
  updateNavForUser(null);
  showToast('Logged out successfully.');
}

// ── Update navbar UI ──────────────────────────────────────────────────────────
function updateNavForUser(user) {
  const authBtns      = document.getElementById('authBtns');
  const userNav       = document.getElementById('userNav');
  const userNavName   = document.getElementById('userNavName');
  const userNavAvatar = document.getElementById('userNavAvatar');
  const adminNavLink  = document.getElementById('adminNavLink');
  const dashLink      = document.getElementById('dashLink');

  if (user) {
    authBtns.classList.add('hidden');
    userNav.classList.add('visible');
    userNavName.textContent   = user.name ? user.name.split(' ')[0] : 'User';
    userNavAvatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    if (dashLink)     dashLink.style.display = 'block';
    if (adminNavLink) adminNavLink.style.display = user.role === 'admin' ? 'block' : 'none';
  } else {
    authBtns.classList.remove('hidden');
    userNav.classList.remove('visible');
    if (dashLink)     dashLink.style.display = 'none';
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
    else { removeToken(); removeCurrentUser(); updateNavForUser(null); }
  } catch {
    const cached = getCurrentUser();
    if (cached) updateNavForUser(cached);
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
  ['su_name','su_phone','su_email','li_phone'].forEach(id => {
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
  const el = document.getElementById('quoteText');
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
  const counters = document.querySelectorAll('.counter');
  counters.forEach(counter => {
    const target = parseInt(counter.getAttribute('data-target'));
    const suffix = counter.getAttribute('data-suffix') || '+';
    let count = 0;
    const step = Math.ceil(target / 80);
    const timer = setInterval(() => {
      count += step;
      if (count >= target) { count = target; clearInterval(timer); }
      counter.textContent = count.toLocaleString('en-IN') + suffix;
    }, 20);
  });
}

// ── Community Activity Wall ────────────────────────────────────────────────────
const ACTIVITY_ICONS = { feeding:'🍲', rescue:'🚨', medical:'🏥', adoption:'🏠', shelter:'🏕️' };
const ACTIVITY_TAG_CLASS = { feeding:'tag-feeding', rescue:'tag-rescue', medical:'tag-medical', adoption:'tag-adoption', shelter:'tag-shelter' };

const sampleActivities = [
  { id:1, type:'feeding', name:'Ravi Kumar', location:'Indore, MP', caption:'Fed 15 stray dogs at Palasia Square today. They were so hungry! 🐕', image:'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&q=80', time:'2 hours ago', likes:24 },
  { id:2, type:'rescue', name:'Priya NGO', location:'Bhopal, MP', caption:'Successfully rescued an injured puppy near Bharat Talkies and took it to the vet.', image:'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&q=80', time:'5 hours ago', likes:41 },
  { id:3, type:'medical', name:'Dr. Sharma', location:'Mumbai', caption:'Free vaccination camp for 30+ street dogs conducted today in Dharavi.', image:'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=400&q=80', time:'Yesterday', likes:88 },
  { id:4, type:'adoption', name:'Sneha P.', location:'Pune', caption:'Bruno found his forever home today! 3 months on the street and now loved forever 💛', image:'https://images.unsplash.com/photo-1544568100-847a948585b9?w=400&q=80', time:'2 days ago', likes:112 },
  { id:5, type:'shelter', name:'Paw Seva Volunteers', location:'Delhi', caption:'Set up a temporary shelter for 8 strays near Lajpat Nagar before the rains.', image:'https://images.unsplash.com/photo-1615751072497-5f5169febe17?w=400&q=80', time:'3 days ago', likes:67 },
  { id:6, type:'feeding', name:'Amit & Family', location:'Indore, MP', caption:'Sunday feeding drive at Vijay Nagar. Kids loved it too! Teaching compassion early 🙏', image:'https://images.unsplash.com/photo-1582456891705-0e225ff48ddd?w=400&q=80', time:'4 days ago', likes:53 },
];

let userActivities = JSON.parse(localStorage.getItem('ps_activities') || '[]');
let displayedCount = 0;

function createActivityCard(activity) {
  const typeLabel = activity.type.charAt(0).toUpperCase() + activity.type.slice(1);
  const isLiked = (JSON.parse(localStorage.getItem('ps_liked') || '[]')).includes(activity.id);
  return `
    <div class="activity-card" id="card-${activity.id}">
      ${activity.image
        ? `<img class="activity-card-img" src="${activity.image}" alt="Activity" loading="lazy" />`
        : `<div class="activity-card-img-placeholder">${ACTIVITY_ICONS[activity.type] || '🐾'}</div>`
      }
      <div class="activity-card-body">
        <span class="activity-tag ${ACTIVITY_TAG_CLASS[activity.type]}">${ACTIVITY_ICONS[activity.type]} ${typeLabel}</span>
        <p class="activity-card-caption">${activity.caption}</p>
        <div class="activity-card-meta">
          <span>👤 ${activity.name}</span>
          <span>📍 ${activity.location}</span>
          <span>⏰ ${activity.time}</span>
        </div>
        <div class="activity-card-likes">
          <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike(${activity.id}, this)">
            ❤️ ${activity.likes} Likes
          </button>
          <button class="like-btn" onclick="shareActivity('${activity.name}', '${activity.caption}')">
            🔗 Share
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderActivityWall() {
  const wall = document.getElementById('activityWall');
  if (!wall) return;
  const all = [...userActivities, ...sampleActivities];
  const toShow = all.slice(0, displayedCount + 6);
  wall.innerHTML = toShow.map(createActivityCard).join('');
  displayedCount = toShow.length;
}

function loadMorePosts() {
  displayedCount += 3;
  renderActivityWall();
}

function toggleLike(id, btn) {
  const liked = JSON.parse(localStorage.getItem('ps_liked') || '[]');
  const all = [...userActivities, ...sampleActivities];
  const activity = all.find(a => a.id === id);
  if (!activity) return;
  if (liked.includes(id)) {
    liked.splice(liked.indexOf(id), 1);
    activity.likes--;
    btn.classList.remove('liked');
  } else {
    liked.push(id);
    activity.likes++;
    btn.classList.add('liked');
  }
  btn.textContent = `❤️ ${activity.likes} Likes`;
  localStorage.setItem('ps_liked', JSON.stringify(liked));
}

function shareActivity(name, caption) {
  if (navigator.share) {
    navigator.share({ title: 'Paw Seva Activity', text: `${name}: ${caption}`, url: window.location.href });
  } else {
    navigator.clipboard?.writeText(`${name}: ${caption} — Paw Seva`);
    showToast('Activity link copied to clipboard! 🔗');
  }
}

// ── Upload Modal ───────────────────────────────────────────────────────────────
function openUploadModal() {
  const u = getCurrentUser();
  if (!u) { openModal('signup'); showToast('Please join Paw Seva first to share your story!'); return; }
  document.getElementById('uploadModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('open');
  document.body.style.overflow = '';
  clearErrors();
  document.getElementById('photoPreviewArea').style.display = 'none';
  document.getElementById('photoPreview').src = '';
  document.getElementById('activityCaption').value = '';
  document.getElementById('activityLocation').value = '';
  document.getElementById('uploaderName').value = '';
}

function handlePhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('photoPreview').src = e.target.result;
    document.getElementById('photoPreviewArea').style.display = 'block';
    document.getElementById('uploadDropZone').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// Drag and drop
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('uploadDropZone');
  if (!dropZone) return;
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#2f6b57'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#c8dfd3'; });
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

function submitActivity() {
  const caption  = document.getElementById('activityCaption').value.trim();
  const location = document.getElementById('activityLocation').value.trim();
  const type     = document.getElementById('activityType').value;
  const nameVal  = document.getElementById('uploaderName').value.trim();
  const preview  = document.getElementById('photoPreview').src;

  if (!caption)  { showError('upload_error', 'Please add a caption for your story.'); return; }
  if (!location) { showError('upload_error', 'Please add your city/location.'); return; }
  if (!nameVal)  { showError('upload_error', 'Please add your name.'); return; }

  const u = getCurrentUser();
  const newActivity = {
    id: Date.now(),
    type,
    name: nameVal || (u ? u.name : 'Anonymous'),
    location,
    caption,
    image: preview && preview !== window.location.href ? preview : null,
    time: 'Just now',
    likes: 0,
  };
  userActivities.unshift(newActivity);
  localStorage.setItem('ps_activities', JSON.stringify(userActivities));
  displayedCount = 0;
  renderActivityWall();
  closeUploadModal();
  showToast('Your story has been shared with the community! 🐾');
  document.getElementById('community').scrollIntoView({ behavior: 'smooth' });
}

// ── Intersection observer for counter animation ────────────────────────────────
function setupCounterObserver() {
  const statsStrip = document.querySelector('.stats-strip');
  if (!statsStrip) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounters();
        observer.disconnect();
      }
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

  // Join btn
  document.querySelector('.join-btn')?.addEventListener('click', () => {
    getCurrentUser() ? (window.location.href = 'dashboard.html') : openModal('signup');
  });
});
