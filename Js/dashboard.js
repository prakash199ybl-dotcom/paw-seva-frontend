// ============================================================
//   PAW SEVA — dashboard.js  (Updated v3.0)
//   CHANGES:
//   - User ka actual naam dikhta hai (User nahi)
//   - Role ke hisaab se dashboard content alag
//   - API production URL
//   - City save hoti hai profile mein
// ============================================================

// CHANGE: production API URL
const API = 'https://paw-seva-backend.onrender.com/api';

// ── Token / User helpers ──────────────────────────────────────────────────────
function getToken()          { return localStorage.getItem('ps_token'); }
function removeToken()       { localStorage.removeItem('ps_token'); }
function getCurrentUser()    { const u = localStorage.getItem('ps_current'); return u ? JSON.parse(u) : null; }
function setCurrentUser(u)   { localStorage.setItem('ps_current', JSON.stringify(u)); }
function removeCurrentUser() { localStorage.removeItem('ps_current'); }

// ── Generic fetch wrapper ─────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res  = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ── Auth guard ─────────────────────────────────────────────────────────────────
// CHANGE: token nahi hai toh bhi cached user se kaam chalao (demo mode)
async function authGuard() {
  const token = getToken();

  // Koi token nahi — check karo cached user hai kya
  if (!token) {
    const cached = getCurrentUser();
    if (cached) return cached;      // demo mode mein kaam chalao
    window.location.href = 'index.html';
    return null;
  }

  try {
    const { ok, data } = await apiFetch('/auth/me');
    if (ok && data.user) {
      setCurrentUser(data.user);
      return data.user;
    }
    throw new Error('Auth failed');
  } catch {
    // Backend offline — use cached user
    const cached = getCurrentUser();
    if (cached) return cached;
    window.location.href = 'index.html';
    return null;
  }
}

// ── Role content ──────────────────────────────────────────────────────────────
// CHANGE: har role ke liye alag quote, list title, stats
const roleContent = {
  Donor: {
    listTitle: '🐕 Active Campaigns',
    quote: '"Every rupee you give gives a paw a second chance at life."',
    btnLabel: 'Donate',
    welcomeMsg: 'Thank you for being a Donor! Your support saves lives. 🐾',
  },
  Volunteer: {
    listTitle: '🚨 Nearby Rescue Requests',
    quote: '"Volunteers are not paid because they are worthless, but because they are priceless."',
    btnLabel: 'Accept',
    welcomeMsg: 'Ready to help? Rescue requests are waiting for a hero like you! 🦸',
  },
  Feeder: {
    listTitle: '📍 My Feeding Logs',
    quote: '"Feeding a hungry animal is the simplest act with the deepest impact."',
    btnLabel: 'Mark Fed',
    welcomeMsg: 'Keep feeding! Every meal you give matters. 🍲',
  },
  NGO: {
    listTitle: '🆘 Support Requests',
    quote: '"An NGO\'s strength is measured by the paws it heals and hearts it changes."',
    btnLabel: 'Handle Case',
    welcomeMsg: 'Your NGO work is changing lives every day. 🏥',
  },
};

// ── Fetch stats from backend ──────────────────────────────────────────────────
async function fetchStats(user, role) {
  try {
    if (role === 'Donor') {
      const { ok, data } = await apiFetch('/donations');
      if (ok) {
        const thisMonth = data.donations
          .filter(d => new Date(d.createdAt).getMonth() === new Date().getMonth())
          .reduce((s, d) => s + d.amount, 0);
        return [
          { icon: '💰', val: `₹${(data.totalAmount || 0).toLocaleString('en-IN')}`, label: 'Total Donated' },
          { icon: '📅', val: `₹${thisMonth.toLocaleString('en-IN')}`, label: 'This Month' },
          { icon: '🐾', val: data.total || 0, label: 'Donations Made' },
          { icon: '🏅', val: (data.totalAmount || 0) >= 10000 ? 'Gold 🥇' : (data.totalAmount || 0) >= 5000 ? 'Silver 🥈' : 'Bronze 🥉', label: 'Donor Badge' },
        ];
      }
    }
    if (role === 'Volunteer') {
      const { ok, data } = await apiFetch('/rescues?status=pending&limit=50');
      if (ok) {
        return [
          { icon: '🦸', val: user.rescuesDone || 0, label: 'Rescues Done' },
          { icon: '📍', val: data.total || 0, label: 'Open Requests' },
          { icon: '⭐', val: (user.rescuesDone || 0) >= 20 ? 'Gold 🥇' : (user.rescuesDone || 0) >= 10 ? 'Silver 🥈' : 'Bronze 🥉', label: 'Rank' },
          { icon: '⏱️', val: `${(user.rescuesDone || 0) * 2}h`, label: 'Hours Served' },
        ];
      }
    }
    if (role === 'Feeder') {
      const { ok, data } = await apiFetch('/feeding');
      if (ok) {
        const totalAnimals = data.logs.reduce((s, l) => s + (l.animalCount || 0), 0);
        return [
          { icon: '🍲', val: user.feedingsDone || 0, label: 'Feedings Done' },
          { icon: '🐶', val: totalAnimals, label: 'Animals Fed' },
          { icon: '📌', val: [...new Set(data.logs.map(l => l.location))].length, label: 'Locations' },
          { icon: '🔥', val: data.total || 0, label: 'Total Logs' },
        ];
      }
    }
    if (role === 'NGO') {
      const [rescues, feedStats] = await Promise.all([apiFetch('/rescues?limit=5'), apiFetch('/feeding/stats')]);
      return [
        { icon: '🏥', val: rescues.data?.total || 0, label: 'Total Rescues' },
        { icon: '📋', val: rescues.data?.rescues?.filter(r => r.status === 'active').length || 0, label: 'Active Cases' },
        { icon: '🤝', val: feedStats.data?.overall?.totalFeedings || 0, label: 'Feedings Logged' },
        { icon: '💊', val: '94%', label: 'Recovery Rate' },
      ];
    }
  } catch { /* fallthrough */ }

  // CHANGE: demo stats agar API fail ho
  const demoStats = {
    Donor:     [{ icon:'💰', val:'₹500',   label:'Total Donated'  }, { icon:'📅', val:'₹500',  label:'This Month'   }, { icon:'🐾', val:'1',   label:'Donations'   }, { icon:'🏅', val:'Bronze 🥉', label:'Badge' }],
    Volunteer: [{ icon:'🦸', val:'0',      label:'Rescues Done'   }, { icon:'📍', val:'—',     label:'Open Requests'}, { icon:'⭐', val:'Bronze 🥉', label:'Rank' }, { icon:'⏱️', val:'0h', label:'Hours Served'}],
    Feeder:    [{ icon:'🍲', val:'0',      label:'Feedings Done'  }, { icon:'🐶', val:'0',     label:'Animals Fed'  }, { icon:'📌', val:'0',   label:'Locations'   }, { icon:'🔥', val:'0',  label:'Total Logs'  }],
    NGO:       [{ icon:'🏥', val:'0',      label:'Total Rescues'  }, { icon:'📋', val:'0',     label:'Active Cases' }, { icon:'🤝', val:'0',   label:'Feedings'    }, { icon:'💊', val:'94%',label:'Recovery'    }],
  };
  return demoStats[role] || demoStats['Donor'];
}

// ── Fetch list items ──────────────────────────────────────────────────────────
async function fetchListItems(role) {
  try {
    if (role === 'Donor') {
      const { ok, data } = await apiFetch('/donations?limit=5');
      if (ok && data.donations?.length > 0) {
        return data.donations.map(d => ({
          id: d._id, text: d.campaign || 'General Fund',
          sub: `₹${d.amount.toLocaleString('en-IN')} · ${new Date(d.createdAt).toLocaleDateString('en-IN')} · ${d.status}`,
          btn: 'View', type: 'donation',
        }));
      }
      return [
        { id: null, text: 'Injured Dog Treatment',    sub: 'Urgent · ₹5,000 needed', btn: 'Donate', type: 'campaign' },
        { id: null, text: 'Puppy Shelter Food Drive', sub: 'Ongoing · 42 supporters', btn: 'Donate', type: 'campaign' },
        { id: null, text: 'Stray Cat Medical Care',   sub: 'New · ₹3,200 needed',    btn: 'Donate', type: 'campaign' },
      ];
    }
    if (role === 'Volunteer' || role === 'NGO') {
      const { ok, data } = await apiFetch('/rescues?status=pending&limit=5');
      if (ok && data.rescues?.length > 0) {
        return data.rescues.map(r => ({
          id: r._id, text: r.description,
          sub: `${r.location} · ${r.severity || 'medium'} · ${r.status}`,
          btn: role === 'Volunteer' ? 'Accept' : 'Handle Case', type: 'rescue',
        }));
      }
      return [{ id: null, text: 'No rescue requests right now', sub: 'Check back soon!', btn: '—', type: 'info' }];
    }
    if (role === 'Feeder') {
      const { ok, data } = await apiFetch('/feeding?limit=5');
      if (ok && data.logs?.length > 0) {
        return data.logs.map(l => ({
          id: l._id, text: l.location,
          sub: `${l.animalCount} animals · ${new Date(l.fedAt || l.createdAt).toLocaleDateString('en-IN')}`,
          btn: 'View', type: 'feeding',
        }));
      }
      return [{ id: null, text: 'Log your first feeding!', sub: 'Help street animals near you', btn: 'Log Feeding', type: 'feeding_new' }];
    }
  } catch { /* fallthrough */ }
  return [{ id: null, text: 'Could not load data', sub: 'Check server connection', btn: '—', type: 'error' }];
}

// ── Action handler ────────────────────────────────────────────────────────────
async function handleAction(btn, id, type, role) {
  if (!id || type === 'error' || type === 'info') return;
  btn.disabled = true; btn.textContent = '...';
  try {
    if (type === 'rescue' && role === 'Volunteer') {
      const { ok, data } = await apiFetch(`/rescues/${id}/accept`, { method: 'PATCH' });
      btn.textContent = ok ? '✓ Accepted' : data.message || 'Failed';
      if (ok) { showToast('Rescue accepted! Thank you 🦸'); }
      else btn.disabled = false;
      return;
    }
    if (type === 'campaign') {
      const amount = prompt('Enter donation amount (₹):');
      if (!amount || isNaN(amount) || Number(amount) < 1) { btn.textContent = 'Donate'; btn.disabled = false; return; }
      const { ok, data } = await apiFetch('/donations', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), campaign: btn.closest('.list-item').querySelector('.item-text').textContent }),
      });
      if (ok) { btn.textContent = '✓ Donated!'; showToast(`₹${Number(amount).toLocaleString('en-IN')} donated! ❤️`); setTimeout(() => renderDashboard(role), 2000); }
      else { btn.textContent = data.message || 'Failed'; btn.disabled = false; }
      return;
    }
    if (type === 'feeding_new') { openFeedingModal(); btn.textContent = 'Log Feeding'; btn.disabled = false; return; }
    btn.textContent = '✓ Done'; setTimeout(() => { btn.textContent = btn.dataset.orig || 'View'; btn.disabled = false; }, 2000);
  } catch { btn.textContent = 'Error'; btn.disabled = false; }
}

// ── Feeding log modal ─────────────────────────────────────────────────────────
function openFeedingModal() {
  const location    = prompt('Location (e.g. Sector 10 Street):');
  if (!location) return;
  const animalCount = prompt('How many animals did you feed?');
  if (!animalCount || isNaN(animalCount)) return;
  apiFetch('/feeding', { method: 'POST', body: JSON.stringify({ location, animalCount: Number(animalCount), animalType: 'Dogs' }) })
    .then(({ ok, data }) => {
      if (ok) { showToast('Feeding logged! 🍲'); setTimeout(() => renderDashboard('Feeder'), 1000); }
      else showToast(data.message || 'Failed to log feeding.');
    });
}

// ── Main render ───────────────────────────────────────────────────────────────
// CHANGE: user naam hamesha sahi dikhega
async function renderDashboard(role) {
  const user = getCurrentUser();
  if (!user) return;

  // CHANGE: naam split karo — first name dikhao
  const firstName = user.name && user.name !== 'User' ? user.name.split(' ')[0] : user.name || 'User';

  document.getElementById('welcomeName').textContent     = firstName;
  document.getElementById('welcomeRole').textContent     = `${role} Dashboard — Here's what's happening today.`;
  document.getElementById('avatarTop').textContent       = firstName.charAt(0).toUpperCase();
  document.getElementById('sidebarUserName').textContent = user.name || 'User';
  document.getElementById('sidebarRole').textContent     = role;

  // Quote + list title
  const content = roleContent[role] || roleContent['Donor'];
  document.getElementById('roleQuote').textContent = content.quote;
  document.getElementById('listTitle').textContent = content.listTitle;

  // Loading state
  document.getElementById('statsGrid').innerHTML = Array(4).fill(`
    <div class="stat-card" style="opacity:0.5">
      <div class="stat-icon">⏳</div>
      <div class="stat-info"><h3>...</h3><p>Loading</p></div>
    </div>`).join('');
  document.getElementById('roleList').innerHTML = `<div style="padding:20px;text-align:center;color:#7d8590">Loading data...</div>`;

  // Fetch in parallel
  const [stats, items] = await Promise.all([fetchStats(user, role), fetchListItems(role)]);

  // Render stats
  document.getElementById('statsGrid').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-info"><h3>${s.val}</h3><p>${s.label}</p></div>
    </div>`).join('');

  // Render list
  document.getElementById('roleList').innerHTML = items.length
    ? items.map(item => `
        <div class="list-item">
          <div>
            <div class="item-text">${item.text}</div>
            <div class="item-sub">${item.sub}</div>
          </div>
          <button class="btn-action" data-orig="${item.btn}"
            onclick="handleAction(this,'${item.id||''}','${item.type}','${role}')"
          >${item.btn}</button>
        </div>`).join('')
    : `<div style="padding:20px;text-align:center;color:#7d8590">No data yet.</div>`;
}

// ── Role switcher ─────────────────────────────────────────────────────────────
function changeRole(val) { localStorage.setItem('ps_role', val); renderDashboard(val); showToast(`Switched to ${val} view`); }

// ── Dark mode ─────────────────────────────────────────────────────────────────
function toggleDark() {
  document.body.classList.toggle('dark');
  const icon = document.getElementById('darkBtn');
  if (icon) icon.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  localStorage.setItem('ps_dark', document.body.classList.contains('dark') ? '1' : '0');
}

// ── Logout ────────────────────────────────────────────────────────────────────
function doLogout() { removeToken(); removeCurrentUser(); window.location.href = 'index.html'; }

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── DOMContentLoaded ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Auth check
  const user = await authGuard();
  if (!user) return;

  // CHANGE: user ka actual role use karo
  const savedRole    = localStorage.getItem('ps_role') || user.role || 'Donor';
  const validRoles   = ['Donor', 'Volunteer', 'Feeder', 'NGO'];
  const resolvedRole = validRoles.includes(savedRole) ? savedRole
    : validRoles.includes(user.role) ? user.role : 'Donor';

  // Role selector update
  const sel = document.getElementById('roleSelect');
  if (sel) sel.value = resolvedRole;

  // Dashboard render
  await renderDashboard(resolvedRole);

  // Admin button
  const adminBtn = document.getElementById('adminBtn');
  if (adminBtn) adminBtn.style.display = user.role === 'admin' ? 'flex' : 'none';

  // Dark mode restore
  if (localStorage.getItem('ps_dark') === '1') {
    document.body.classList.add('dark');
    const icon = document.getElementById('darkBtn');
    if (icon) icon.textContent = '☀️';
  }
});