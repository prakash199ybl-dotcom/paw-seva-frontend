// ============================================================
//   PAW SEVA — dashboard.js
//   User dashboard wired to real backend API
// ============================================================

// const API = 'http://localhost:5000/api';
const API = 'https://paw-seva-backend.onrender.com/api';

// ── Token / User helpers (same as main.js) ────────────────────────────────────
function getToken()          { return localStorage.getItem('ps_token'); }
function removeToken()       { localStorage.removeItem('ps_token'); }
function getCurrentUser()    {
  const u = localStorage.getItem('ps_current');
  return u ? JSON.parse(u) : null;
}
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

// ── Auth guard: redirect to home if not logged in ─────────────────────────────
async function authGuard() {
  const token = getToken();
  if (!token) { window.location.href = 'index.html'; return null; }

  try {
    const { ok, data } = await apiFetch('/auth/me');
    if (!ok) { doLogout(); return null; }
    setCurrentUser(data.user);   // keep local cache fresh
    return data.user;
  } catch {
    // Backend offline — use cached user
    const cached = getCurrentUser();
    if (!cached) { window.location.href = 'index.html'; return null; }
    return cached;
  }
}

// ── Static role content (UI labels / quotes — not from DB) ───────────────────
const roleContent = {
  Donor: {
    listTitle: '🐕 Active Campaigns',
    quote: '"Every rupee you give gives a paw a second chance at life."',
    btnLabel: 'Donate',
  },
  Volunteer: {
    listTitle: '🚨 Nearby Rescue Requests',
    quote: '"Volunteers don\'t get paid, not because they\'re worthless, but because they\'re priceless."',
    btnLabel: 'Accept',
  },
  Feeder: {
    listTitle: '📍 Feeding Logs',
    quote: '"Feeding a hungry animal is the simplest act of humanity with the deepest impact."',
    btnLabel: 'Mark Fed',
  },
  NGO: {
    listTitle: '🆘 Support Requests',
    quote: '"An NGO\'s strength is measured by the paws it heals and the hearts it changes."',
    btnLabel: 'Handle Case',
  },
};

// ── Fetch real stats from backend ─────────────────────────────────────────────
async function fetchStats(user, role) {
  // For each role, pull real numbers from corresponding API endpoints
  try {
    if (role === 'Donor') {
      const { ok, data } = await apiFetch('/donations');
      if (ok) {
        const thisMonth = data.donations
          .filter(d => new Date(d.createdAt).getMonth() === new Date().getMonth())
          .reduce((s, d) => s + d.amount, 0);

        return [
          { icon: '💰', val: `₹${data.totalAmount.toLocaleString('en-IN')}`, label: 'Total Donated' },
          { icon: '📅', val: `₹${thisMonth.toLocaleString('en-IN')}`,        label: 'This Month' },
          { icon: '🐾', val: data.total,                                       label: 'Donations Made' },
          { icon: '🏅', val: data.totalAmount >= 10000 ? 'Gold' : data.totalAmount >= 5000 ? 'Silver' : 'Bronze', label: 'Donor Badge' },
        ];
      }
    }

    if (role === 'Volunteer') {
      const { ok, data } = await apiFetch('/rescues?status=pending&limit=50');
      if (ok) {
        return [
          { icon: '🦸', val: user.rescuesDone || 0,   label: 'Rescues Done' },
          { icon: '📍', val: data.total,               label: 'Open Requests' },
          { icon: '⭐', val: user.rescuesDone >= 20 ? 'Gold' : user.rescuesDone >= 10 ? 'Silver' : 'Bronze', label: 'Volunteer Rank' },
          { icon: '⏱️', val: `${(user.rescuesDone || 0) * 2}h`, label: 'Est. Hours Served' },
        ];
      }
    }

    if (role === 'Feeder') {
      const { ok, data } = await apiFetch('/feeding');
      if (ok) {
        const totalAnimals = data.logs.reduce((s, l) => s + l.animalCount, 0);
        const locations    = [...new Set(data.logs.map(l => l.location))].length;
        return [
          { icon: '🍲', val: user.feedingsDone || 0, label: 'Feedings Done' },
          { icon: '🐶', val: totalAnimals,            label: 'Animals Fed' },
          { icon: '📌', val: locations,               label: 'Locations' },
          { icon: '🔥', val: data.total,              label: 'Total Logs' },
        ];
      }
    }

    if (role === 'NGO') {
      const [rescues, feedStats] = await Promise.all([
        apiFetch('/rescues?limit=5'),
        apiFetch('/feeding/stats'),
      ]);
      return [
        { icon: '🏥', val: rescues.data?.total || 0,              label: 'Total Rescues' },
        { icon: '📋', val: rescues.data?.rescues?.filter(r => r.status === 'active').length || 0, label: 'Active Cases' },
        { icon: '🤝', val: feedStats.data?.overall?.totalFeedings || 0, label: 'Feedings Logged' },
        { icon: '💊', val: '94%',                                 label: 'Recovery Rate' },
      ];
    }
  } catch { /* fall through to defaults */ }

  // Fallback stats if API fails
  return [
    { icon: '📊', val: '—', label: 'Loading...' },
    { icon: '📊', val: '—', label: 'Loading...' },
    { icon: '📊', val: '—', label: 'Loading...' },
    { icon: '📊', val: '—', label: 'Loading...' },
  ];
}

// ── Fetch real list items for each role ───────────────────────────────────────
async function fetchListItems(role) {
  try {
    if (role === 'Donor') {
      // Show donor's own donations
      const { ok, data } = await apiFetch('/donations?limit=5');
      if (ok && data.donations.length > 0) {
        return data.donations.map(d => ({
          id:   d._id,
          text: d.campaign,
          sub:  `₹${d.amount.toLocaleString('en-IN')} · ${new Date(d.createdAt).toLocaleDateString('en-IN')} · ${d.status}`,
          btn:  'View',
          type: 'donation',
        }));
      }
      // No donations yet — show campaigns
      return [
        { id: null, text: 'Injured Dog Treatment',   sub: 'Urgent · ₹5,000 needed',    btn: 'Donate', type: 'campaign' },
        { id: null, text: 'Puppy Shelter Food Drive', sub: 'Ongoing · 42 supporters',   btn: 'Donate', type: 'campaign' },
        { id: null, text: 'Stray Cat Medical Care',  sub: 'New · ₹3,200 needed',        btn: 'Donate', type: 'campaign' },
      ];
    }

    if (role === 'Volunteer' || role === 'NGO') {
      const statusFilter = role === 'NGO' ? '' : '?status=pending&limit=5';
      const { ok, data } = await apiFetch(`/rescues${statusFilter}`);
      if (ok) {
        return data.rescues.map(r => ({
          id:   r._id,
          text: r.description,
          sub:  `${r.location} · ${r.severity} · ${r.status}`,
          btn:  role === 'Volunteer' ? 'Accept' : 'Handle Case',
          type: 'rescue',
        }));
      }
    }

    if (role === 'Feeder') {
      const { ok, data } = await apiFetch('/feeding?limit=5');
      if (ok && data.logs.length > 0) {
        return data.logs.map(l => ({
          id:   l._id,
          text: l.location,
          sub:  `${l.animalCount} animals · ${l.animalType} · ${new Date(l.fedAt).toLocaleDateString('en-IN')}`,
          btn:  'View',
          type: 'feeding',
        }));
      }
      // No logs yet — show placeholder locations
      return [
        { id: null, text: 'Add your first feeding location', sub: 'Click to log a feeding', btn: 'Log Feeding', type: 'feeding_new' },
      ];
    }

  } catch { /* fall through */ }

  return [{ id: null, text: 'Could not load data', sub: 'Check server connection', btn: '—', type: 'error' }];
}

// ── Handle action button clicks ───────────────────────────────────────────────
async function handleAction(btn, id, type, role) {
  if (!id || type === 'error') return;

  btn.disabled    = true;
  btn.textContent = '...';

  try {
    // Volunteer accepts a rescue
    if (type === 'rescue' && role === 'Volunteer') {
      const { ok, data } = await apiFetch(`/rescues/${id}/accept`, { method: 'PATCH' });
      if (ok) {
        btn.textContent = '✓ Accepted';
        btn.style.background = '#2cb67a';
        showToast('Rescue accepted! Thank you 🦸');
        setTimeout(() => { btn.closest('.list-item').style.opacity = '0.5'; }, 500);
      } else {
        btn.textContent = data.message || 'Failed';
        btn.disabled    = false;
      }
      return;
    }

    // Donor makes a quick donation
    if (type === 'campaign') {
      const amount = prompt('Enter donation amount (₹):');
      if (!amount || isNaN(amount) || Number(amount) < 1) {
        btn.textContent = 'Donate';
        btn.disabled    = false;
        return;
      }
      const { ok, data } = await apiFetch('/donations', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), campaign: btn.closest('.list-item').querySelector('.item-text').textContent }),
      });
      if (ok) {
        btn.textContent = '✓ Donated!';
        btn.style.background = '#2cb67a';
        showToast(`₹${Number(amount).toLocaleString('en-IN')} donated! Thank you ❤️`);
        setTimeout(() => renderDashboard(role), 2000);
      } else {
        btn.textContent = data.message || 'Failed';
        btn.disabled    = false;
      }
      return;
    }

    // Feeder logs a feeding
    if (type === 'feeding_new') {
      openFeedingModal();
      btn.textContent = 'Log Feeding';
      btn.disabled    = false;
      return;
    }

    // Default: just show done feedback
    btn.textContent = '✓ Done';
    btn.style.background = '#2cb67a';
    setTimeout(() => {
      btn.textContent = btn.dataset.orig || 'View';
      btn.style.background = '';
      btn.disabled = false;
    }, 2000);

  } catch {
    btn.textContent = 'Error';
    btn.disabled    = false;
  }
}

// ── Simple feeding log modal ──────────────────────────────────────────────────
function openFeedingModal() {
  const location    = prompt('Location (e.g. Sector 10 Street):');
  if (!location) return;
  const animalCount = prompt('How many animals did you feed?');
  if (!animalCount || isNaN(animalCount)) return;

  apiFetch('/feeding', {
    method: 'POST',
    body: JSON.stringify({ location, animalCount: Number(animalCount), animalType: 'Dogs' }),
  }).then(({ ok, data }) => {
    if (ok) {
      showToast('Feeding logged! 🍲 Thank you for caring!');
      setTimeout(() => renderDashboard('Feeder'), 1000);
    } else {
      showToast(data.message || 'Failed to log feeding.');
    }
  });
}

// ── Main render function ──────────────────────────────────────────────────────
async function renderDashboard(role) {
  const user = getCurrentUser();
  if (!user) return;

  // Update sidebar / topbar labels
  document.getElementById('welcomeName').textContent    = user.name.split(' ')[0];
  document.getElementById('welcomeRole').textContent    = `${role} Dashboard`;
  document.getElementById('avatarTop').textContent      = user.name.charAt(0).toUpperCase();
  document.getElementById('sidebarUserName').textContent = user.name;
  document.getElementById('sidebarRole').textContent    = role;

  // Quote
  const content = roleContent[role] || roleContent['Donor'];
  document.getElementById('roleQuote').textContent  = content.quote;
  document.getElementById('listTitle').textContent  = content.listTitle;

  // Show loading skeletons while fetching
  document.getElementById('statsGrid').innerHTML = Array(4).fill(`
    <div class="stat-card" style="opacity:0.5;animation:pulse 1s infinite alternate">
      <div class="stat-icon">⏳</div>
      <div class="stat-info"><h3>...</h3><p>Loading</p></div>
    </div>`).join('');

  document.getElementById('roleList').innerHTML = `
    <div style="padding:20px;text-align:center;color:#7d8590;font-size:14px">Loading data...</div>`;

  // Fetch stats + list in parallel
  const [stats, items] = await Promise.all([
    fetchStats(user, role),
    fetchListItems(role),
  ]);

  // Render stats
  document.getElementById('statsGrid').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-info">
        <h3>${s.val}</h3>
        <p>${s.label}</p>
      </div>
    </div>`).join('');

  // Render list
  document.getElementById('roleList').innerHTML = items.length
    ? items.map(item => `
        <div class="list-item">
          <div>
            <div class="item-text">${item.text}</div>
            <div class="item-sub">${item.sub}</div>
          </div>
          <button
            class="btn-action"
            data-id="${item.id || ''}"
            data-type="${item.type}"
            data-orig="${item.btn}"
            onclick="handleAction(this, '${item.id || ''}', '${item.type}', '${role}')"
          >${item.btn}</button>
        </div>`).join('')
    : `<div style="padding:20px;text-align:center;color:#7d8590;font-size:14px">No data yet.</div>`;
}

// ── Role switcher ─────────────────────────────────────────────────────────────
function changeRole(val) {
  localStorage.setItem('ps_role', val);
  renderDashboard(val);
  showToast(`Switched to ${val} view`);
}

// ── Dark mode ─────────────────────────────────────────────────────────────────
function toggleDark() {
  document.body.classList.toggle('dark');
  const icon = document.getElementById('darkBtn');
  icon.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  localStorage.setItem('ps_dark', document.body.classList.contains('dark') ? '1' : '0');
}

// ── Logout: clear token + user + redirect ─────────────────────────────────────
function doLogout() {
  removeToken();
  removeCurrentUser();
  window.location.href = 'index.html';
}

// ── Toast helper ──────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── DOMContentLoaded ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Auth guard — redirects if no valid token
  const user = await authGuard();
  if (!user) return;

  // 2. Determine active role
  const savedRole    = localStorage.getItem('ps_role') || user.role || 'Donor';
  const validRoles   = ['Donor', 'Volunteer', 'Feeder', 'NGO'];
  const resolvedRole = validRoles.includes(savedRole)
    ? savedRole
    : (user.role === 'admin' ? 'NGO' : (user.role.charAt(0).toUpperCase() + user.role.slice(1)));

  // 3. Set selector to match
  const sel = document.getElementById('roleSelect');
  if (sel) sel.value = resolvedRole;

  // 4. Render dashboard with real API data
  await renderDashboard(resolvedRole);

  // 5. Show admin shortcut only for admin
  const adminBtn = document.getElementById('adminBtn');
  if (adminBtn) adminBtn.style.display = user.role === 'admin' ? 'flex' : 'none';

  // 6. Restore dark mode preference
  if (localStorage.getItem('ps_dark') === '1') {
    document.body.classList.add('dark');
    const icon = document.getElementById('darkBtn');
    if (icon) icon.textContent = '☀️';
  }
});
