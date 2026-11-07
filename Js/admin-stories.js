// ============================================================
//   PAW SEVA — admin-stories.js (v5.0)
//   admin.html mein admin.js ke BAAD load karna hai.
//   Community Posts section mein Stories moderation add karta hai:
//   Pending (Approve/Reject) + Live (Pin/Delete).
//   Aur wall post "Remove" ab sach mein database se delete karta hai.
// ============================================================
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function thumb(s) {
    const u = s.mediaUrl || '';
    if (u.indexOf('https://res.cloudinary.com/') !== 0) return '';
    return s.mediaType === 'video'
      ? u.replace('/video/upload/', '/video/upload/so_0,w_300,c_limit/').replace(/\.[a-z0-9]+$/i, '.jpg')
      : u.replace('/image/upload/', '/image/upload/w_300,c_limit,q_auto/');
  }

  function card(s, live) {
    const id = esc(s._id);
    return '<div class="admin-post-card">' +
      '<img src="' + esc(thumb(s)) + '" style="width:100%;height:130px;object-fit:cover;border-radius:10px;margin-bottom:8px" onerror="this.style.display=\'none\'" />' +
      '<div style="font-size:11px;font-weight:700;color:#2faa70;text-transform:uppercase;margin-bottom:4px">' +
        (s.mediaType === 'video' ? '🎬 Video' : '🖼️ Photo') + (s.pinned ? ' · 📌 Pinned' : '') + '</div>' +
      '<div style="font-size:13px;color:#e6edf3;margin-bottom:6px">' + esc(s.caption) + '</div>' +
      '<div style="font-size:11px;color:#7d8590;margin-bottom:8px">👤 ' + esc(s.userName) + ' · 📍 ' + esc(s.location || '—') + ' · ⏰ ' + esc(timeAgo(s.createdAt)) + '</div>' +
      '<a href="' + esc(s.mediaUrl) + '" target="_blank" rel="noopener" style="font-size:12px;color:#58a6ff">▶ Open / Preview</a>' +
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
        (live
          ? '<button class="btn-sm view" onclick="PawAdminStories.pin(\'' + id + '\')">' + (s.pinned ? 'Unpin' : '📌 Pin') + '</button>' +
            '<button class="btn-sm dismiss" onclick="PawAdminStories.remove(\'' + id + '\')">🗑️ Delete</button>'
          : '<button class="btn-sm approve" onclick="PawAdminStories.approve(\'' + id + '\')">✓ Approve</button>' +
            '<button class="btn-sm dismiss" onclick="PawAdminStories.reject(\'' + id + '\')">✕ Reject</button>') +
      '</div></div>';
  }

  async function load() {
    const grid = $('communityPostsAdmin');
    if (!grid) return;
    let box = $('storiesAdminBox');
    if (!box) {   // grid ke upar apna box bana do (admin.html edit nahi chahiye)
      box = document.createElement('div');
      box.id = 'storiesAdminBox';
      box.style.cssText = 'padding:16px;border-bottom:1px solid rgba(255,255,255,0.08)';
      grid.parentElement.insertBefore(box, grid);
    }
    box.innerHTML = '<p style="color:#7d8590">⏳ Loading stories...</p>';
    try {
      const [p, l] = await Promise.all([apiFetch('/stories/manage?status=pending'), apiFetch('/stories/manage?status=approved')]);
      const pending = (p.ok && p.data.stories) || [], live = (l.ok && l.data.stories) || [];
      const gridCss = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin-bottom:18px';
      box.innerHTML =
        '<h4 style="color:#e6edf3;margin-bottom:10px">⏳ Stories — Approval pending (' + pending.length + ')</h4>' +
        '<div style="' + gridCss + '">' + (pending.map((s) => card(s, false)).join('') || '<span style="color:#7d8590;font-size:13px">Koi pending story nahi.</span>') + '</div>' +
        '<h4 style="color:#e6edf3;margin-bottom:10px">🟢 Live stories (' + live.length + ')</h4>' +
        '<div style="' + gridCss + '">' + (live.map((s) => card(s, true)).join('') || '<span style="color:#7d8590;font-size:13px">Abhi koi live story nahi.</span>') + '</div>' +
        '<h4 style="color:#e6edf3;margin:6px 0 0">🧱 Community Wall posts</h4>';
    } catch (e) {
      box.innerHTML = '<p style="color:#e05454">Stories load nahi hui: ' + esc(e.message) + '</p>';
    }
  }

  async function act(method, path, okMsg) {
    try {
      const r = await apiFetch(path, { method: method });
      if (!r.ok) throw new Error(r.data.message || 'Failed');
      showToast(okMsg);
      await load();
    } catch (e) { showToast(e.message || 'Failed'); }
  }

  window.PawAdminStories = {
    approve: (id) => act('PATCH', '/stories/' + id + '/approve', 'Story approved ✓'),
    reject:  (id) => { if (confirm('Reject karke delete karein?')) act('DELETE', '/stories/' + id, 'Story rejected'); },
    pin:     (id) => act('PATCH', '/stories/' + id + '/pin', 'Pin update ho gaya 📌'),
    remove:  (id) => { if (confirm('Live story delete karein?')) act('DELETE', '/stories/' + id, 'Story deleted'); },
  };

  // Wall post "Remove" — pehle sirf screen se hatata tha, ab database se bhi
  window.removePost = async function (id) {
    if (!confirm('Is post ko permanently delete karein?')) return;
    try {
      const r = await apiFetch('/activities/' + id, { method: 'DELETE' });
      if (!r.ok) throw new Error(r.data.message || 'Delete failed');
      const c = $('apost-' + id);
      if (c) { c.style.transition = '.3s'; c.style.opacity = '0'; setTimeout(() => c.remove(), 300); }
      showToast('Post delete ho gayi 🗑️');
    } catch (e) { showToast(e.message || 'Delete failed'); }
  };

  // Community Posts section khulne par stories bhi load karo
  const origShow = window.showSection;
  if (typeof origShow === 'function') {
    window.showSection = function (name, link) {
      origShow(name, link);
      if (name === 'community') load();
    };
  }
})();

// v5.2 — OTP se login kiye hue admin ko bhi panel mein aane do
document.addEventListener('DOMContentLoaded', async function () {
  try {
    const ls = document.getElementById('loginScreen');
    if (!ls || ls.style.display === 'none') return;     // pehle se andar hai
    if (!getToken()) return;
    const { ok, data } = await apiFetch('/auth/me');
    if (ok && data.user && data.user.role === 'admin') {
      localStorage.setItem('ps_admin_auth', '1');
      enterAdminPanel(data.user);
    }
  } catch (e) { /* login screen hi rahe */ }
});