// ============================================================
//   PAW SEVA — stories.js (v5.0)
//   index.html mein main.js ke BAAD load karna hai.
//
//   Ye file karti hai:
//   1) Upar Stories banner (photo/video continuous queue)
//   2) Upload modal: photo + VIDEO, Cloudinary direct upload
//   3) Community wall cards: video support + safe delete
//
//   main.js ke ye functions yahan override hote hain
//   (main.js ko edit karne ki zaroorat nahi):
//   openUploadModal, closeUploadModal, handlePhotoSelect,
//   submitActivity, createActivityCard, renderActivityWall,
//   deleteActivity
// ============================================================
(function () {
  'use strict';

  // ── Settings ───────────────────────────────────────────────
  const PHOTO_MS   = 5000;            // photo kitni der dikhe
  const REFRESH_MS = 2 * 60 * 1000;   // queue itne baad refresh (loop poora hone par)
  const MAX_IMG_MB = 10, MAX_VID_MB = 40, MAX_VID_SEC = 30;

  const $ = (id) => document.getElementById(id);

  // ── Helpers ────────────────────────────────────────────────
  // XSS se bachne ke liye user ka text hamesha escape karo
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // /auth/me wala user object `_id` deta hai, login wala `id` — dono handle
  function myId(u) { return u ? String(u.id || u._id || '') : ''; }
  function authHeaders(json) {
    const h = json ? { 'Content-Type': 'application/json' } : {};
    const t = getToken();
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }
  function hasRealSession() {
    const t = getToken();
    return !!t && !String(t).startsWith('demo_token_');
  }
  async function postJson(path, body) {
    const res  = await fetch(API + path, { method: 'POST', headers: authHeaders(true), body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(res.status === 401 ? 'Session expire ho gaya. Logout karke dubara login karein.' : (data.message || 'Request fail ho gayi (' + res.status + ')'));
    }
    return data;
  }

  // Cloudinary URL transformations (chhoti image / mp4 / video poster)
  function isCld(u) { return typeof u === 'string' && u.indexOf('https://res.cloudinary.com/') === 0; }
  function cldImage(u, w) {
    return isCld(u) && u.indexOf('/image/upload/') > -1
      ? u.replace('/image/upload/', '/image/upload/w_' + (w || 1080) + ',c_limit,q_auto/') : u;
  }
  function cldVideo(u) {
    if (!isCld(u)) return u;
    return /\.mp4(\?.*)?$/i.test(u) ? u : u.replace(/\.[a-z0-9]+$/i, '.mp4'); // mov/webm -> mp4
  }
  function cldPoster(u) {
    return isCld(u)
      ? u.replace('/video/upload/', '/video/upload/so_0,w_600,c_limit,q_auto/').replace(/\.[a-z0-9]+$/i, '.jpg') : '';
  }

  // ============================================================
  //  PART 1 — UPLOAD (photo / video)
  // ============================================================
  let selectedFile = null;
  let selectedDuration = 0;
  let previewUrl = null;

  function getVideoDuration(file) {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      const url = URL.createObjectURL(file);
      v.preload = 'metadata';
      v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration || 0); };
      v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Video padhi nahi ja saki.')); };
      v.src = url;
    });
  }

  function showPreview(file) {
    const area = $('photoPreviewArea'), img = $('photoPreview');
    let vid = $('videoPreview');
    if (!vid) {   // video preview element pehli baar bana do
      vid = document.createElement('video');
      vid.id = 'videoPreview'; vid.controls = true; vid.muted = true; vid.playsInline = true;
      vid.style.cssText = 'max-width:100%;max-height:220px;border-radius:10px;display:none;margin:0 auto';
      img.parentNode.insertBefore(vid, img.nextSibling);
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    if (file.type.indexOf('video/') === 0) {
      vid.src = previewUrl; vid.style.display = 'block';
      img.style.display = 'none'; img.removeAttribute('src');
    } else {
      img.src = previewUrl; img.style.display = 'inline-block';
      vid.style.display = 'none'; vid.removeAttribute('src');
    }
    area.style.display = 'block';
    $('uploadDropZone').style.display = 'none';
  }

  async function setSelectedFile(file) {
    clearErrors();
    const isImg = file.type.indexOf('image/') === 0;
    const isVid = file.type.indexOf('video/') === 0;
    if (!isImg && !isVid) return showError('upload_error', 'Sirf photo ya video chunein.');
    if (isImg && file.size > MAX_IMG_MB * 1048576) return showError('upload_error', 'Photo ' + MAX_IMG_MB + 'MB se chhoti honi chahiye.');
    if (isVid && file.size > MAX_VID_MB * 1048576) return showError('upload_error', 'Video ' + MAX_VID_MB + 'MB se chhota hona chahiye.');
    let dur = 0;
    if (isVid) {
      try { dur = await getVideoDuration(file); } catch (e) { return showError('upload_error', e.message); }
      if (dur > MAX_VID_SEC + 0.5) {
        return showError('upload_error', 'Video ' + MAX_VID_SEC + ' second se chhota hona chahiye (aapki: ' + Math.round(dur) + 's).');
      }
    }
    selectedFile = file; selectedDuration = dur;
    showPreview(file);
  }

  function clearSelectedMedia() {
    selectedFile = null; selectedDuration = 0;
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    const area = $('photoPreviewArea'), img = $('photoPreview'), vid = $('videoPreview'), dz = $('uploadDropZone');
    if (img) img.removeAttribute('src');
    if (vid) { vid.pause(); vid.removeAttribute('src'); vid.style.display = 'none'; }
    if (area) area.style.display = 'none';
    if (dz) dz.style.display = 'block';
  }

  function handlePhotoSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (file) setSelectedFile(file);
    event.target.value = '';   // same file dobara chun sakein
  }

  function openUploadModal(preset) {
    const u = getCurrentUser();
    if (!u) { openModal('signup'); showToast('Please join Paw Seva first! 🐾'); return; }
    if ($('uploaderName') && u.name) $('uploaderName').value = u.name;
    if ($('activityLocation') && u.city) $('activityLocation').value = u.city;
    if ($('postTo')) $('postTo').value = (preset === 'story' || preset === 'wall') ? preset : 'both';
    $('uploadModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeUploadModal() {
    const m = $('uploadModal');
    if (!m) return;
    m.classList.remove('open');
    document.body.style.overflow = '';
    clearErrors();
    clearSelectedMedia();
    ['activityCaption', 'activityLocation', 'uploaderName'].forEach((id) => { if ($(id)) $(id).value = ''; });
    const gs = $('gpsStatus');
    if (gs) { gs.textContent = 'Click 📍 to auto-detect your location'; gs.style.color = ''; }
  }

  function setBusy(on, label) {
    const b = document.querySelector('#uploadModal .btn-form');
    if (!b) return;
    b.disabled = on;
    b.textContent = on ? label : 'Share with Community 🐾';
  }

  // File seedha Cloudinary par (signature backend se)
  async function uploadToCloudinary(file, onProgress) {
    const sigRes = await fetch(API + '/stories/upload-signature', { headers: authHeaders(false) });
    const sig = await sigRes.json().catch(() => ({}));
    if (!sigRes.ok || !sig.success) {
      throw new Error(sigRes.status === 401 ? 'Session expire ho gaya. Dubara login karein.' : (sig.message || 'Upload service available nahi hai.'));
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('api_key', sig.apiKey);
    fd.append('timestamp', sig.timestamp);
    fd.append('signature', sig.signature);
    fd.append('folder', sig.folder);
    fd.append('allowed_formats', sig.allowedFormats);
    const url = 'https://api.cloudinary.com/v1_1/' + sig.cloudName + '/auto/upload';

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        let r = {};
        try { r = JSON.parse(xhr.responseText); } catch (e) { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300 && r.secure_url) resolve(r);
        else reject(new Error((r.error && r.error.message) || 'Upload fail ho gaya.'));
      };
      xhr.onerror = () => reject(new Error('Network error. Internet check karein.'));
      xhr.send(fd);
    });
  }

  async function submitActivity() {
    clearErrors();
    const caption  = $('activityCaption').value.trim();
    const location = $('activityLocation').value.trim();
    const type     = $('activityType').value;
    const name     = $('uploaderName').value.trim();
    const postTo   = ($('postTo') && $('postTo').value) || 'wall';
    const wantStory = postTo !== 'wall';
    const wantWall  = postTo !== 'story';

    if (!caption)  return showError('upload_error', 'Please add a caption.');
    if (!location) return showError('upload_error', 'Please add your location.');
    if (!name)     return showError('upload_error', 'Please add your name.');
    if (wantStory && !selectedFile) return showError('upload_error', 'Story ke liye photo ya video chunna zaroori hai.');
    if (!hasRealSession()) return showError('upload_error', 'Aapka login session purana hai. Logout karke dubara login karein.');

    setBusy(true, '⏳ Uploading...');
    try {
      let media = null;
      if (selectedFile) media = await uploadToCloudinary(selectedFile, (p) => setBusy(true, '⏳ Uploading ' + p + '%'));
      setBusy(true, '⏳ Saving...');
      const mediaType = media && media.resource_type === 'video' ? 'video' : 'image';

      let msg = '';
      if (wantStory) {
        const r = await postJson('/stories', {
          mediaUrl: media.secure_url, publicId: media.public_id, mediaType,
          duration: media.duration || selectedDuration || 0,
          caption, location, userName: name,
        });
        msg = r.story.status === 'approved'
          ? 'Story live ho gayi! 🎉'
          : 'Story submit ho gayi — admin approval ke baad banner mein dikhegi ✅';
      }
      if (wantWall) {
        await postJson('/activities', {
          name, type, caption, location,
          image: media ? media.secure_url : null, mediaType,
        });
      }

      closeUploadModal();
      showToast(msg || 'Community wall par share ho gayi! 🐾');
      await renderActivityWall();
      if (wantStory && window.PawStories) window.PawStories.reload();
      const target = $(wantWall ? 'community' : 'home');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      showError('upload_error', e.message || 'Upload fail ho gaya.');
    } finally {
      setBusy(false);
    }
  }

  // ============================================================
  //  PART 2 — COMMUNITY WALL (video support + safe delete)
  // ============================================================
  function createActivityCard(a) {
    const type  = a.type || 'feeding';
    const icon  = ACTIVITY_ICONS[type] || '🐾';
    const id    = String(a.id);
    const user  = getCurrentUser();
    const isAdmin   = !!user && user.role === 'admin';
    const isOwner   = !!user && !!a.userId && myId(user) === String(a.userId);
    const isRealId  = /^[a-f0-9]{24}$/i.test(id);          // sample cards delete nahi hote
    const canDelete = isRealId && (isAdmin || isOwner);
    const liked = JSON.parse(localStorage.getItem('ps_liked') || '[]').indexOf(id) > -1;
    const likes = Math.max(0, Number(a.likes) || 0);

    const m = a.image;
    const hasMedia = typeof m === 'string' && m.length > 10 && m !== window.location.href && m !== 'undefined' && m !== 'null';
    let media;
    if (hasMedia && a.mediaType === 'video') {
      media = '<video class="activity-card-img" style="object-fit:contain;background:#000" src="' + esc(cldVideo(m)) +
              '" poster="' + esc(cldPoster(m)) + '" controls muted playsinline preload="none"></video>';
    } else if (hasMedia) {
      media = '<img class="activity-card-img" src="' + esc(cldImage(m, 800)) + '" alt="Activity" loading="lazy" ' +
              'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" />' +
              '<div class="activity-card-img-placeholder" style="display:none">' + icon + '</div>';
    } else {
      media = '<div class="activity-card-img-placeholder">' + icon + '</div>';
    }

    return '' +
      '<div class="activity-card" id="card-' + esc(id) + '">' + media +
      '<div class="activity-card-body">' +
        '<span class="activity-tag ' + (ACTIVITY_TAG_CLASS[type] || 'tag-feeding') + '">' + icon + ' ' + esc(type.charAt(0).toUpperCase() + type.slice(1)) + '</span>' +
        '<p class="activity-card-caption">' + esc(a.caption) + '</p>' +
        '<div class="activity-card-meta">' +
          '<span>👤 ' + esc(a.name || 'Anonymous') + '</span>' +
          '<span>📍 ' + esc(a.location || '—') + '</span>' +
          '<span>⏰ ' + esc(a.time || 'Just now') + '</span>' +
        '</div>' +
        '<div class="activity-card-likes">' +
          '<button class="like-btn ' + (liked ? 'liked' : '') + '" onclick="toggleLike(\'' + esc(id) + '\', this)">❤️ ' + likes + ' Likes</button>' +
          '<button class="like-btn" data-name="' + esc(a.name) + '" data-caption="' + esc(a.caption) + '" onclick="shareActivity(this.dataset.name, this.dataset.caption)">🔗 Share</button>' +
          (canDelete
            ? '<button class="like-btn" style="color:#e05454;border-color:rgba(224,84,84,.3)" onclick="deleteActivity(\'' + esc(id) + '\', this)">🗑️ Delete</button>'
            : '') +
        '</div>' +
      '</div></div>';
  }

  async function renderActivityWall() {
    const wall = $('activityWall');
    if (!wall) return;
    wall.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#4f8c74">🐾 Loading stories...</div>';
    try {
      const res = await fetch(API + '/activities?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      if (data.success && Array.isArray(data.activities) && data.activities.length) {
        wall.innerHTML = data.activities.map((a) => createActivityCard({
          id: a._id, type: a.type, name: a.name, location: a.location, caption: a.caption,
          image: a.image, mediaType: a.mediaType, userId: a.userId,
          time: timeAgo(a.createdAt), likes: a.likes,
        })).join('');
        return;
      }
      throw new Error('empty');
    } catch (e) {
      // Backend na mile ya wall khali ho → sample stories
      const stored = JSON.parse(localStorage.getItem('ps_activities') || '[]');
      wall.innerHTML = stored.concat(sampleActivities).slice(0, 6).map(createActivityCard).join('');
    }
  }

  async function deleteActivity(id, btn) {
    if (!confirm('Is story ko delete karein? Ye wapas nahi aayegi.')) return;
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳';
    try {
      const res  = await fetch(API + '/activities/' + id, { method: 'DELETE', headers: authHeaders(false) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(res.status === 401 ? 'Session expire ho gaya. Dubara login karein.' : (data.message || 'Delete fail ho gaya.'));
      }
      const card = $('card-' + id);
      if (card) { card.style.transition = 'all .3s'; card.style.opacity = '0'; card.style.transform = 'scale(.9)'; setTimeout(() => card.remove(), 300); }
      showToast('Story delete ho gayi 🗑️');
    } catch (e) {
      btn.disabled = false; btn.textContent = old;
      showToast(e.message);
    }
  }

  // ============================================================
  //  PART 3 — STORIES BANNER PLAYER
  // ============================================================
  let queue = [], idx = 0, lastFetch = 0;
  let raf = 0, lastTs = 0, elapsed = 0, stall = 0, lastTime = -1;
  let imageReady = false, locked = false, muted = true;
  let holdPaused = false, inView = true, pressStart = 0;
  const el = {};

  async function fetchQueue() {
    try {
      const res = await fetch(API + '/stories?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('bad');
      const data = await res.json();
      if (data.success && Array.isArray(data.stories)) { queue = data.stories; lastFetch = Date.now(); }
    } catch (e) { /* purani queue chalne do */ }
    el.banner.style.display = queue.length ? 'block' : 'none';
    if (!queue.length) el.wrap.innerHTML = '';
  }

  function buildBars() {
    el.progress.innerHTML = queue.map((_, i) => '<div class="seg"><i style="width:' + (i < idx ? 100 : 0) + '%"></i></div>').join('');
  }
  function setProgress(p) {
    const seg = el.progress.children[idx];
    if (seg && seg.firstChild) seg.firstChild.style.width = Math.max(0, Math.min(1, p)) * 100 + '%';
  }
  function updateMuteBtn() { el.mute.textContent = muted ? '🔇' : '🔊'; }

  function show(i) {
    if (!queue.length) return;
    idx = ((i % queue.length) + queue.length) % queue.length;
    const item = queue[idx];
    elapsed = 0; stall = 0; lastTime = -1; imageReady = false; locked = false;
    buildBars();

    const bgSrc = item.mediaType === 'video' ? cldPoster(item.mediaUrl) : cldImage(item.mediaUrl, 200);
    el.bg.style.backgroundImage = bgSrc ? 'url("' + String(bgSrc).replace(/"/g, '%22') + '")' : 'none';
    el.wrap.innerHTML = '';

    if (item.mediaType === 'video') {
      const v = document.createElement('video');
      v.id = 'storyVideo'; v.muted = muted; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('playsinline', '');
      v.addEventListener('ended', next);
      v.addEventListener('error', next);
      v.src = cldVideo(item.mediaUrl);
      el.wrap.appendChild(v);
      const p = v.play();
      if (p && p.catch) p.catch(() => { v.muted = true; muted = true; updateMuteBtn(); v.play().catch(() => {}); });
    } else {
      const img = document.createElement('img');
      img.id = 'storyImage'; img.alt = 'Story';
      img.addEventListener('load', () => { imageReady = true; });
      img.addEventListener('error', next);
      img.src = cldImage(item.mediaUrl, 1080);
      el.wrap.appendChild(img);
    }

    el.meta.innerHTML =
      '<span class="who">' + (item.pinned ? '📌 ' : '') + esc(item.userName) + '</span>' +
      (item.location ? '<span class="where">📍 ' + esc(item.location) + '</span>' : '') +
      '<span class="where">· ' + esc(timeAgo(item.createdAt)) + '</span>' +
      (item.caption ? '<div class="cap">' + esc(item.caption) + '</div>' : '');

    el.mute.style.display = item.mediaType === 'video' ? 'flex' : 'none';
    updateMuteBtn();
    const u = getCurrentUser();
    el.del.style.display = (u && (u.role === 'admin' || myId(u) === String(item.userId))) ? 'flex' : 'none';

    // Agli photo pehle se load kar lo (video nahi — data bachane ke liye)
    const n = queue[(idx + 1) % queue.length];
    if (n && n.mediaType === 'image') { const pre = new Image(); pre.src = cldImage(n.mediaUrl, 1080); }
  }

  function next() {
    if (locked || !queue.length) return;
    locked = true;                       // ek hi baar chale (double trigger se bachao)
    if (idx + 1 < queue.length) { show(idx + 1); return; }
    // Queue khatam → loop. Purani ho gayi to server se naya lo
    if (Date.now() - lastFetch > REFRESH_MS) {
      fetchQueue().then(() => { if (queue.length) show(0); });
    } else {
      show(0);
    }
  }
  function prev() { if (queue.length) show(idx - 1); }

  function loop(ts) {
    if (!queue.length) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    const dt = lastTs ? Math.min(ts - lastTs, 100) : 0;
    lastTs = ts;
    const item = queue[idx];
    if (!item) return;
    const pausedNow = holdPaused || !inView || document.hidden;

    if (item.mediaType === 'video') {
      const v = $('storyVideo');
      if (!v) return;
      if (pausedNow) { if (!v.paused) v.pause(); return; }
      if (v.paused && !v.ended && v.readyState >= 2) v.play().catch(() => {});
      if (v.duration) setProgress(v.currentTime / v.duration);
      // Video atak jaye (slow net) → 8 sec baad agli
      if (v.currentTime === lastTime) { stall += dt; if (stall > 8000) next(); }
      else { stall = 0; lastTime = v.currentTime; }
    } else {
      if (pausedNow) return;
      if (!imageReady) { stall += dt; if (stall > 10000) next(); return; }
      elapsed += dt;
      setProgress(elapsed / PHOTO_MS);
      if (elapsed >= PHOTO_MS) next();
    }
  }

  async function deleteCurrent() {
    const item = queue[idx];
    if (!item || !confirm('Is story ko delete karein?')) return;
    try {
      const res  = await fetch(API + '/stories/' + item._id, { method: 'DELETE', headers: authHeaders(false) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || 'Delete fail ho gaya.');
      queue.splice(idx, 1);
      showToast('Story delete ho gayi 🗑️');
      if (!queue.length) { el.banner.style.display = 'none'; el.wrap.innerHTML = ''; return; }
      show(idx % queue.length);
    } catch (e) { showToast(e.message); }
  }

  async function reload() {
    if (!el.banner) return;
    await fetchQueue();
    if (queue.length) { show(0); if (!raf) raf = requestAnimationFrame(loop); }
  }

  function initBanner() {
    el.banner = $('storiesBanner');
    if (!el.banner) return;           // HTML add nahi kiya to chup-chap skip
    el.player = $('storyPlayer'); el.bg = $('storyBg'); el.progress = $('storyProgress');
    el.wrap = $('storyMediaWrap'); el.meta = $('storyMeta');
    el.prev = $('storyPrev'); el.next = $('storyNext'); el.mute = $('storyMute'); el.del = $('storyDel');

    el.prev.addEventListener('click', prev);
    el.next.addEventListener('click', () => { locked = false; next(); });
    el.mute.addEventListener('click', () => {
      muted = !muted;
      const v = $('storyVideo'); if (v) v.muted = muted;
      updateMuteBtn();
    });
    el.del.addEventListener('click', deleteCurrent);

    // Hold = pause, chhota tap = left/right half se peeche/aage
    el.player.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      pressStart = Date.now(); holdPaused = true;
    });
    const release = (e) => {
      if (!pressStart) return;
      const held = Date.now() - pressStart;
      pressStart = 0; holdPaused = false;
      if (e.type === 'pointerup' && held < 300) {
        const r = el.player.getBoundingClientRect();
        if (e.clientX - r.left < r.width / 2) prev(); else { locked = false; next(); }
      }
    };
    el.player.addEventListener('pointerup', release);
    el.player.addEventListener('pointercancel', release);
    el.player.addEventListener('pointerleave', release);

    // Banner screen se bahar ho to pause
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; }, { threshold: 0.25 }).observe(el.banner);
    }

    fetchQueue().then(() => { if (queue.length) { show(0); raf = requestAnimationFrame(loop); } });
  }

  // ============================================================
  //  INIT + main.js ke functions override
  // ============================================================
  window.openUploadModal   = openUploadModal;
  window.closeUploadModal  = closeUploadModal;
  window.handlePhotoSelect = handlePhotoSelect;
  window.submitActivity    = submitActivity;
  window.createActivityCard = createActivityCard;
  window.renderActivityWall = renderActivityWall;
  window.deleteActivity    = deleteActivity;
  window.clearSelectedMedia = clearSelectedMedia;   // modal ke "Remove" button ke liye
  window.PawStories = { reload: reload };

  // Drop zone: main.js ke purane listener se PEHLE chalna chahiye (isliye turant register)
  const dz = $('uploadDropZone');
  if (dz) {
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.style.borderColor = '#2f6b57'; });
    dz.addEventListener('dragleave', () => { dz.style.borderColor = '#c8dfd3'; });
    dz.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopImmediatePropagation();
      dz.style.borderColor = '#c8dfd3';
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) setSelectedFile(f);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBanner);
  else initBanner();
})();