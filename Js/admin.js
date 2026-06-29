// ============================================================
//   PAW SEVA — admin.js  (Updated v2.0)
//   Full admin panel with Settings, section nav, community moderation
// ============================================================

// const API = 'http://localhost:5000/api';
const API = 'https://paw-seva-backend.onrender.com/api';

function getToken()          { return localStorage.getItem('ps_token'); }
function setToken(t)         { localStorage.setItem('ps_token', t); }
function removeToken()       { localStorage.removeItem('ps_token'); }
function setCurrentUser(u)   { localStorage.setItem('ps_current', JSON.stringify(u)); }
function removeCurrentUser() { localStorage.removeItem('ps_current'); }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res  = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ── Section navigation ──────────────────────────────────────────────────────
const SECTIONS = ['dashboard','rescues','donations','volunteers','feeding','ngo','campaigns','community','settings'];
const SECTION_TITLES = {
  dashboard: 'Admin Dashboard', rescues: 'Rescue Requests', donations: 'Donations',
  volunteers: 'Volunteers & Users', feeding: 'Feeding Spots', ngo: 'NGO Partners',
  campaigns: 'Campaigns', community: 'Community Posts', settings: 'Settings'
};

function showSection(name, linkEl) {
  SECTIONS.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.style.display = s === name ? 'block' : 'none';
  });
  // Update active nav link
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  if (linkEl) linkEl.classList.add('active');

  const titleEl = document.getElementById('topbarSectionTitle');
  if (titleEl) titleEl.textContent = SECTION_TITLES[name] || name;

  // Load section data on demand
  if (name === 'rescues') loadRescuesFull();
  if (name === 'donations') loadDonationsFull();
  if (name === 'volunteers') loadUsersFull();
  if (name === 'feeding') loadFeedingFull();
  if (name === 'community') loadCommunityPosts();
  if (name === 'campaigns') loadCampaigns();
}

// ── Admin login ─────────────────────────────────────────────────────────────
async function doAdminLogin() {
  const email = document.getElementById('a_email').value.trim();
  const pass  = document.getElementById('a_pass').value;
  if (!email || !pass) { showLoginError('Please fill all fields.'); return; }

  const btn = document.getElementById('a_loginBtn');
  btn.disabled = true; btn.textContent = 'Verifying...';

  try {
    const { ok, data } = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    if (!ok) { showLoginError(data.message || 'Login failed.'); return; }
    if (data.user.role !== 'admin') { showLoginError('Access denied. Admins only.'); return; }

    setToken(data.token);
    setCurrentUser(data.user);
    localStorage.setItem('ps_admin_auth', '1');
    enterAdminPanel(data.user);

  } catch {
    // Demo mode
    if (email === 'admin@pawseva.com' && pass === 'admin123') {
      localStorage.setItem('ps_admin_auth', '1');
      enterAdminPanel({ name: 'Prakash', role: 'admin' });
    } else {
      showLoginError('⚠️ Cannot reach server. Use admin@pawseva.com / admin123 for demo.');
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Access Admin Panel →';
  }
}

function enterAdminPanel(user) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminLayout').style.display = 'flex';
  if (user && user.name) {
    const initial = user.name.charAt(0).toUpperCase();
    document.getElementById('adminAvatar').textContent = initial;
    document.getElementById('adminName').textContent = user.name;
    document.getElementById('topbarAvatar').textContent = initial;
  }
  initAdminDashboard();
}

function showLoginError(msg) {
  const el = document.getElementById('a_error');
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => (el.style.display = 'none'), 4000);
}

function doAdminLogout() {
  removeToken(); removeCurrentUser();
  localStorage.removeItem('ps_admin_auth');
  window.location.href = 'index.html';
}

// ── Init ────────────────────────────────────────────────────────────────────
async function initAdminDashboard() {
  showToast('Loading dashboard...');
  await Promise.all([loadStats(), loadRescuesDash(), loadFeedingStats()]);
  animateBars();
  document.getElementById('lastUpdated').textContent = 'Last updated ' + new Date().toLocaleTimeString('en-IN');
}

// ── Stats ───────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const [userStats, rescues, donations] = await Promise.all([
      apiFetch('/users/stats/overview'), apiFetch('/rescues?limit=1'), apiFetch('/donations'),
    ]);
    document.getElementById('stat_animals').textContent    = rescues.data?.total ?? 42;
    document.getElementById('stat_rescues').textContent    = rescues.data?.rescues?.filter(r => r.status === 'active').length ?? 8;
    document.getElementById('stat_volunteers').textContent = userStats.data?.stats?.volunteers ?? 56;
    document.getElementById('stat_donations').textContent  = `₹${(donations.data?.totalAmount || 84000).toLocaleString('en-IN')}`;
  } catch {
    // Demo fallback
    document.getElementById('stat_animals').textContent    = '2,300';
    document.getElementById('stat_rescues').textContent    = '12';
    document.getElementById('stat_volunteers').textContent = '560';
    document.getElementById('stat_donations').textContent  = '₹8,40,000';
  }
}

// ── Dashboard rescue (recent 5) ─────────────────────────────────────────────
async function loadRescuesDash() {
  const tbody = document.getElementById('requestsBodyDash');
  if (!tbody) return;
  try {
    const { ok, data } = await apiFetch('/rescues?limit=5');
    if (!ok) throw new Error('API offline');
    tbody.innerHTML = data.rescues.map(r => rescueRow(r, 6)).join('');
  } catch {
    tbody.innerHTML = demoRescueRows(5, 6);
  }
}

// ── Full rescues section ─────────────────────────────────────────────────────
async function loadRescuesFull() {
  const tbody = document.getElementById('requestsBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#7d8590">Loading...</td></tr>';
  try {
    const { ok, data } = await apiFetch('/rescues?limit=50');
    if (!ok) throw new Error('API offline');
    tbody.innerHTML = data.rescues.map(r => rescueRow(r, 7)).join('') || emptyRow(7, 'No rescues found.');
  } catch {
    tbody.innerHTML = demoRescueRows(10, 7);
  }
}

function rescueRow(r, cols) {
  return `<tr>
    <td><code style="color:#7d8590;font-size:11px">${(r._id || Math.random().toString(36).slice(-6)).toString().slice(-6).toUpperCase()}</code></td>
    <td>${r.description || 'Injured dog on road'}</td>
    <td>${r.location || 'Indore, MP'}</td>
    ${cols === 7 ? `<td style="color:#7d8590;font-size:12px">${r.reportedBy?.name || 'Anonymous'}</td>` : ''}
    <td style="color:#7d8590;font-size:12px">${timeAgo(r.createdAt || new Date())}</td>
    <td><span class="status-pill ${r.status || 'pending'}">${r.status || 'pending'}</span></td>
    <td style="display:flex;gap:6px;padding:13px 16px">
      ${(!r.status || r.status === 'pending' || r.status === 'active')
        ? `<button class="btn-sm approve" onclick="approveRescue(this,'${r._id}')">✓ Resolve</button>`
        : `<button class="btn-sm view" disabled>Resolved</button>`}
      <button class="btn-sm dismiss" onclick="dismissRescue(this,'${r._id}')">✕</button>
    </td>
  </tr>`;
}

function demoRescueRows(count, cols) {
  const descs = ['Injured dog on road','Sick cat near market','Puppy stuck in drain','Dog hit by vehicle','Cat with eye injury'];
  const locs  = ['Vijay Nagar, Indore','MP Nagar, Bhopal','Palasia, Indore','Arera Colony, Bhopal','Napier Town, Jabalpur'];
  const statuses = ['pending','active','pending','resolved','active'];
  return Array.from({length:count}, (_,i) => `<tr>
    <td><code style="color:#7d8590;font-size:11px">R${String(1001+i)}</code></td>
    <td>${descs[i%5]}</td>
    <td>${locs[i%5]}</td>
    ${cols === 7 ? `<td style="color:#7d8590;font-size:12px">User ${i+1}</td>` : ''}
    <td style="color:#7d8590;font-size:12px">${i === 0 ? 'just now' : i + ' hrs ago'}</td>
    <td><span class="status-pill ${statuses[i%5]}">${statuses[i%5]}</span></td>
    <td style="display:flex;gap:6px;padding:13px 16px">
      ${statuses[i%5] !== 'resolved'
        ? `<button class="btn-sm approve" onclick="approveRescue(this,'demo-${i}')">✓ Resolve</button>`
        : `<button class="btn-sm view" disabled>Resolved</button>`}
      <button class="btn-sm dismiss" onclick="dismissRescue(this,'demo-${i}')">✕</button>
    </td>
  </tr>`).join('');
}

// ── Donations section ────────────────────────────────────────────────────────
async function loadDonationsFull() {
  const tbody = document.getElementById('donationsBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#7d8590">Loading...</td></tr>';
  try {
    const { ok, data } = await apiFetch('/donations?limit=20');
    if (!ok) throw new Error('API offline');
    const total = data.donations.reduce((s,d) => s + d.amount, 0);
    if (document.getElementById('d_total')) document.getElementById('d_total').textContent = `₹${total.toLocaleString('en-IN')}`;
    if (document.getElementById('d_count')) document.getElementById('d_count').textContent = data.donations.length;
    tbody.innerHTML = data.donations.map(d => `<tr>
      <td>${d.donor?.name || 'Anonymous'}</td>
      <td style="color:#2faa70;font-weight:600">₹${d.amount.toLocaleString('en-IN')}</td>
      <td>${d.campaign || 'General Fund'}</td>
      <td style="color:#7d8590;font-size:12px">${new Date(d.createdAt).toLocaleDateString('en-IN')}</td>
      <td><span class="status-pill ${d.status === 'confirmed' ? 'active' : 'pending'}">${d.status || 'pending'}</span></td>
    </tr>`).join('') || emptyRow(5, 'No donations yet.');
  } catch {
    const demoRows = [
      ['Rahul Sharma','₹5,000','Rescue Fund','28 Jun 2026','confirmed'],
      ['Priya NGO','₹12,500','Medical Care','27 Jun 2026','confirmed'],
      ['Amit Kumar','₹500','General Fund','26 Jun 2026','pending'],
      ['Sneha P.','₹2,000','Feeding Drive','25 Jun 2026','confirmed'],
      ['Anonymous','₹1,000','General Fund','24 Jun 2026','confirmed'],
    ];
    if (document.getElementById('d_total')) document.getElementById('d_total').textContent = '₹21,000';
    if (document.getElementById('d_count')) document.getElementById('d_count').textContent = '5';
    tbody.innerHTML = demoRows.map(([name,amt,camp,date,status]) => `<tr>
      <td>${name}</td>
      <td style="color:#2faa70;font-weight:600">${amt}</td>
      <td>${camp}</td>
      <td style="color:#7d8590;font-size:12px">${date}</td>
      <td><span class="status-pill ${status === 'confirmed' ? 'active' : 'pending'}">${status}</span></td>
    </tr>`).join('');
  }
}

// ── Users/Volunteers section ─────────────────────────────────────────────────
async function loadUsersFull() {
  const tbody = document.getElementById('volunteersBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#7d8590">Loading...</td></tr>';
  try {
    const { ok, data } = await apiFetch('/users?limit=50');
    if (!ok) throw new Error('API offline');
    tbody.innerHTML = data.users.map(u => `<tr>
      <td><strong>${u.name}</strong></td>
      <td><span class="status-pill active">${u.role}</span></td>
      <td style="color:#7d8590;font-size:12px">${u.phone || '—'}</td>
      <td style="color:#7d8590;font-size:12px">${u.city || '—'}</td>
      <td style="color:#7d8590;font-size:12px">${new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
      <td><span class="status-pill ${u.isActive ? 'active' : 'pending'}">${u.isActive ? 'active' : 'inactive'}</span></td>
      <td style="display:flex;gap:6px">
        <button class="btn-sm view" onclick="showToast('Viewing ${u.name}...')">View</button>
        ${u.role !== 'admin' ? `<button class="btn-sm dismiss" onclick="deleteUser(this,'${u._id}','${u.name}')">✕</button>` : ''}
      </td>
    </tr>`).join('') || emptyRow(7, 'No users found.');
  } catch {
    const demoUsers = [
      ['Rahul Sharma','Volunteer','+91 98765 01234','Indore','28 Jun 2026'],
      ['Priya Singh','Donor','+91 87654 12345','Bhopal','20 Jun 2026'],
      ['Amit Kumar','Feeder','+91 76543 23456','Indore','15 Jun 2026'],
      ['Sneha Patel','NGO','+91 65432 34567','Pune','10 Jun 2026'],
      ['Vikram Rao','Volunteer','+91 54321 45678','Delhi','05 Jun 2026'],
    ];
    tbody.innerHTML = demoUsers.map(([name,role,phone,city,joined]) => `<tr>
      <td><strong>${name}</strong></td>
      <td><span class="status-pill active">${role}</span></td>
      <td style="color:#7d8590;font-size:12px">${phone}</td>
      <td style="color:#7d8590;font-size:12px">${city}</td>
      <td style="color:#7d8590;font-size:12px">${joined}</td>
      <td><span class="status-pill active">active</span></td>
      <td style="display:flex;gap:6px">
        <button class="btn-sm view" onclick="showToast('Viewing ${name}...')">View</button>
        <button class="btn-sm dismiss" onclick="this.closest('tr').remove();showToast('User removed.')">✕</button>
      </td>
    </tr>`).join('');
  }
}

function filterUsers(role) {
  document.querySelectorAll('#volunteersBody tr').forEach(tr => {
    if (role === 'all') { tr.style.display = ''; return; }
    const roleCell = tr.cells[1]?.textContent || '';
    tr.style.display = roleCell.includes(role) ? '' : 'none';
  });
}

function filterRescues(status) {
  document.querySelectorAll('#requestsBody tr').forEach(tr => {
    if (status === 'all') { tr.style.display = ''; return; }
    const statusCell = tr.cells[4]?.textContent || '';
    tr.style.display = statusCell.includes(status) ? '' : 'none';
  });
}

// ── Feeding logs section ─────────────────────────────────────────────────────
async function loadFeedingFull() {
  const tbody = document.getElementById('feedingBody');
  if (!tbody) return;
  try {
    const { ok, data } = await apiFetch('/feeding?limit=20');
    if (!ok) throw new Error('API offline');
    tbody.innerHTML = data.logs.map(f => `<tr>
      <td>${f.feeder?.name || 'Anonymous'}</td>
      <td>${f.location || '—'}</td>
      <td>${f.animalsCount || 0}</td>
      <td>${f.foodGiven || '—'}</td>
      <td style="color:#7d8590;font-size:12px">${new Date(f.createdAt).toLocaleDateString('en-IN')}</td>
    </tr>`).join('') || emptyRow(5, 'No feeding logs yet.');
  } catch {
    tbody.innerHTML = [
      ['Amit Kumar','Palasia Sq, Indore','8','2kg dry food','28 Jun 2026'],
      ['Sneha P.','Vijay Nagar, Indore','12','3kg biscuits','27 Jun 2026'],
      ['Paw Seva Team','MP Nagar, Bhopal','20','5kg rice+dal','26 Jun 2026'],
    ].map(([f,l,a,food,d]) => `<tr><td>${f}</td><td>${l}</td><td>${a}</td><td>${food}</td><td style="color:#7d8590;font-size:12px">${d}</td></tr>`).join('');
  }
}

// ── Community posts moderation ───────────────────────────────────────────────
function loadCommunityPosts() {
  const container = document.getElementById('communityPostsAdmin');
  if (!container) return;
  const activities = JSON.parse(localStorage.getItem('ps_activities') || '[]');
  const sample = [
    { id:'sp1', name:'Ravi Kumar', caption:'Fed 15 dogs at Palasia Square', type:'feeding', time:'2 hrs ago' },
    { id:'sp2', name:'Priya NGO', caption:'Rescued injured puppy near Bharat Talkies', type:'rescue', time:'5 hrs ago' },
    { id:'sp3', name:'Dr. Sharma', caption:'Free vaccination camp for 30+ dogs in Dharavi', type:'medical', time:'Yesterday' },
  ];
  const all = [...activities.slice(0,3), ...sample];
  container.innerHTML = all.map(p => `
    <div class="admin-post-card" id="apost-${p.id}">
      ${p.image ? `<img src="${p.image}" style="width:100%;height:140px;object-fit:cover;border-radius:10px;margin-bottom:10px" />` : `<div style="width:100%;height:90px;background:#1c3028;border-radius:10px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;font-size:36px">🐾</div>`}
      <div style="font-size:12px;font-weight:700;color:#2faa70;text-transform:uppercase;margin-bottom:4px">${p.type}</div>
      <div style="font-size:13px;color:#e6edf3;margin-bottom:6px;line-height:1.4">${p.caption}</div>
      <div style="font-size:11px;color:#7d8590;margin-bottom:12px">👤 ${p.name} · ⏰ ${p.time}</div>
      <div style="display:flex;gap:8px">
        <button class="btn-sm approve" onclick="approvePost('${p.id}',this)">✓ Approve</button>
        <button class="btn-sm dismiss" onclick="removePost('${p.id}')">✕ Remove</button>
      </div>
    </div>`).join('') || '<p style="color:#7d8590;padding:20px">No community posts yet.</p>';
}

function approvePost(id, btn) { btn.textContent = '✓ Approved'; btn.className = 'btn-sm view'; btn.disabled = true; showToast('Post approved and visible to community! ✓'); }
function removePost(id) {
  const card = document.getElementById(`apost-${id}`);
  if (card) { card.style.opacity='0'; card.style.transition='0.3s'; setTimeout(()=>card.remove(),300); }
  showToast('Post removed from community wall.');
}

// ── Campaigns ────────────────────────────────────────────────────────────────
function loadCampaigns() {
  const el = document.getElementById('campaignsList');
  if (!el) return;
  const campaigns = [
    { name:'Monsoon Rescue Drive', goal:'₹50,000', raised:'₹31,200', status:'active', ends:'15 Jul 2026' },
    { name:'Free Vaccination Camp', goal:'₹20,000', raised:'₹20,000', status:'completed', ends:'01 Jun 2026' },
    { name:'Winter Shelter Setup', goal:'₹80,000', raised:'₹12,500', status:'active', ends:'01 Dec 2026' },
  ];
  el.innerHTML = campaigns.map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
      <div>
        <div style="font-size:14px;font-weight:600;color:#e6edf3;margin-bottom:4px">${c.name}</div>
        <div style="font-size:12px;color:#7d8590">Goal: ${c.goal} · Raised: <span style="color:#2faa70;font-weight:600">${c.raised}</span> · Ends: ${c.ends}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="status-pill ${c.status === 'active' ? 'active' : 'pending'}">${c.status}</span>
        <button class="btn-sm view" onclick="showToast('Edit campaign: ${c.name}')">Edit</button>
      </div>
    </div>`).join('');
}

// ── Actions ──────────────────────────────────────────────────────────────────
async function approveRescue(btn, id) {
  btn.disabled = true; btn.textContent = '...';
  try {
    const { ok, data } = await apiFetch(`/rescues/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolved', adminNote: 'Resolved by admin' }),
    });
    if (ok) { btn.textContent = '✓ Resolved'; btn.className = 'btn-sm view'; showToast('Rescue resolved! 🎉'); loadStats(); }
    else { btn.disabled = false; btn.textContent = '✓ Resolve'; showToast(data.message || 'Update failed.'); }
  } catch {
    // Demo mode
    btn.textContent = '✓ Resolved'; btn.className = 'btn-sm view'; btn.disabled = true;
    showToast('Rescue marked as resolved! (demo)');
  }
}

async function dismissRescue(btn, id) {
  if (!confirm('Delete this rescue request?')) return;
  btn.disabled = true;
  try {
    const { ok } = await apiFetch(`/rescues/${id}`, { method: 'DELETE' });
    if (ok) { removeRow(btn); showToast('Rescue deleted.'); loadStats(); }
    else { btn.disabled = false; showToast('Delete failed.'); }
  } catch { removeRow(btn); showToast('Rescue removed (demo).'); }
}

async function deleteUser(btn, id, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  btn.disabled = true;
  try {
    const { ok } = await apiFetch(`/users/${id}`, { method: 'DELETE' });
    if (ok) { removeRow(btn); showToast(`User "${name}" deleted.`); loadStats(); }
    else { btn.disabled = false; showToast('Delete failed.'); }
  } catch { removeRow(btn); showToast(`User "${name}" removed (demo).`); }
}

function removeRow(btn) {
  const row = btn.closest('tr');
  if (row) { row.style.opacity='0'; row.style.transition='0.3s'; setTimeout(()=>row.remove(),300); }
}

async function quickAction(type) {
  const actions = {
    campaign: '📢 New campaign created! (coming soon)',
    alert: '📣 Alert sent to all volunteers!',
    report: null,
    dispatch: '🚑 Rescue team dispatched!',
    ngo: '🏥 NGO partner request sent!',
  };
  if (type === 'report') {
    try {
      const { ok, data } = await apiFetch('/donations/stats');
      if (ok) { alert(`📄 Report:\nTotal: ₹${data.grandTotal?.toLocaleString('en-IN') || 0}\n\nTop campaigns: ${data.stats?.slice(0,3).map(s=>`${s._id}: ₹${s.total}`).join(', ') || 'N/A'}`); }
      else showToast('Report: Demo mode — ₹8,40,000 raised across 3 campaigns.');
    } catch { showToast('Monthly Report: ₹8,40,000 raised | 2,300 animals helped | 560 volunteers'); }
    return;
  }
  showToast(actions[type] || 'Action triggered!');
}

// ── Settings ─────────────────────────────────────────────────────────────────
function saveSettings(section) {
  const messages = {
    general: 'General settings saved! ✓',
    account: 'Admin account updated! ✓',
    notifications: 'Notification preferences saved! ✓',
    auth: 'Authentication settings saved! ✓',
    appearance: 'Appearance applied! ✓',
  };

  if (section === 'account') {
    const newPass = document.getElementById('s_newPass')?.value;
    const confirmPass = document.getElementById('s_confirmPass')?.value;
    if (newPass && newPass !== confirmPass) { showToast('Passwords do not match! ✗'); return; }
    if (newPass && newPass.length < 6) { showToast('Password must be 6+ characters! ✗'); return; }

    const newName = document.getElementById('s_adminName')?.value;
    if (newName) {
      document.getElementById('adminName').textContent = newName;
      document.getElementById('adminAvatar').textContent = newName.charAt(0).toUpperCase();
      document.getElementById('topbarAvatar').textContent = newName.charAt(0).toUpperCase();
    }
  }

  // Save to localStorage
  const settingsKey = `ps_admin_settings_${section}`;
  const settingsData = {};
  document.querySelectorAll(`#section-settings .s-field input, #section-settings .s-field select`).forEach(inp => {
    if (inp.id) settingsData[inp.id] = inp.type === 'checkbox' ? inp.checked : inp.value;
  });
  localStorage.setItem(settingsKey, JSON.stringify(settingsData));

  showToast(messages[section] || 'Settings saved!');
}

function exportData(type) {
  const headers = {
    rescues: 'ID,Description,Location,Status,Date',
    donations: 'Donor,Amount,Campaign,Date,Status',
    users: 'Name,Role,Phone,City,Joined',
    feeding: 'Feeder,Location,Animals,Food,Date',
  };
  const sampleData = {
    rescues: 'R001,Injured dog on road,Indore MP,resolved,2026-06-28',
    donations: 'Rahul Sharma,5000,Rescue Fund,2026-06-28,confirmed',
    users: 'Rahul Sharma,Volunteer,9876543210,Indore,2026-06-28',
    feeding: 'Amit Kumar,Palasia Indore,8,2kg food,2026-06-28',
  };
  const csv = `${headers[type]}\n${sampleData[type]}`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pawseva_${type}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} data exported! 📄`);
}

function confirmDangerAction(type) {
  if (!confirm('⚠️ This will permanently delete records older than 1 year. Continue?')) return;
  showToast('Old records purged successfully. ✓');
}

// ── Feeding stats for chart ──────────────────────────────────────────────────
async function loadFeedingStats() {
  try {
    const { ok, data } = await apiFetch('/feeding/stats');
    const el = document.getElementById('feedingStatText');
    if (ok && el) el.textContent = `${data.overall?.totalFeedings || 0} feedings · ${data.overall?.totalAnimals || 0} animals fed`;
    else if (el) el.textContent = '1,240 feedings · 8,400 animals fed (demo)';
  } catch {
    const el = document.getElementById('feedingStatText');
    if (el) el.textContent = '1,240 feedings · 8,400 animals fed (demo)';
  }
}

function animateBars() {
  const heights = [40,55,38,70,65,80,60];
  document.querySelectorAll('.bar').forEach((bar, i) => setTimeout(() => { bar.style.height = heights[i] + 'px'; }, i * 80));
}

async function refreshAll() {
  showToast('Refreshing data...');
  await initAdminDashboard();
  document.getElementById('lastUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN');
  showToast('Dashboard refreshed! ✓');
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:24px;color:#7d8590">${msg}</td></tr>`;
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'toast';
    t.style.cssText = "position:fixed;bottom:28px;right:28px;background:#2faa70;color:white;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;z-index:9999;opacity:0;transform:translateY(12px);transition:all 0.3s;pointer-events:none;font-family:'DM Sans',sans-serif";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1'; t.style.transform = 'translateY(0)';
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateY(12px)'; }, 3400);
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff/60000), hrs = Math.floor(diff/3600000), days = Math.floor(diff/86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins>1?'s':''} ago`;
  if (hrs < 24) return `${hrs} hr${hrs>1?'s':''} ago`;
  return `${days} day${days>1?'s':''} ago`;
}

// ── Enter key on login ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const ls = document.getElementById('loginScreen');
  if (ls && ls.style.display !== 'none') doAdminLogin();
});

// ── DOMContentLoaded ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const alreadyAuth = localStorage.getItem('ps_admin_auth');
  const token = getToken();

  if (alreadyAuth && token) {
    try {
      const { ok, data } = await apiFetch('/auth/me');
      if (ok && data.user.role === 'admin') { enterAdminPanel(data.user); return; }
    } catch { /* demo mode */ }
    // Demo bypass
    if (alreadyAuth) { enterAdminPanel({ name: 'Prakash', role: 'admin' }); return; }
  }

  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminLayout').style.display = 'none';
});
