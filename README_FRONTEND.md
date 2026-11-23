# 🐾 Paw Seva — Frontend (Website)

The frontend is everything the user sees and clicks: the home page, login box, stories banner, community wall,
user dashboard and admin panel. It is plain **HTML + CSS + JavaScript** (no React, no build step).

- **Live website:** https://paw-seva.netlify.app
- **Admin panel:** https://paw-seva.netlify.app/HTML/admin.html
- **Talks to:** the backend at https://paw-seva-backend.onrender.com/api
- **Hosted on:** Netlify (auto deploy from GitHub)

For the server side read `README_BACKEND.md`. For file-by-file flow read `FRONTEND_FILES_WORKFLOW.md`.
For the admin panel read `ADMIN_PANEL_GUIDE.md`.

---

## 1. Pages and features

**Home page (`index.html`)**
- Top strip with a "Share your story" button.
- Navbar: Home, Community, Services, Gallery, Contact. After login it shows the first name, **Logout** and **My Dashboard** (and **Admin** for the admin). **Join Paw Seva** is hidden after login.
- **Stories banner** like Instagram: photo and video stories play one after another. Tap right or left, hold to pause, mute button, progress bars.
- Hero section, animated counters, Ratan Tata tribute section, role cards, city strip, rotating quotes, gallery, footer.
- **Community wall:** real posts from the database with photo or video, likes, share, and delete (owner or admin only).
- **Join Paw Seva box:** Sign Up and Login tabs, mobile OTP, Google button, WhatsApp button. A button hides itself when that option is not set up.
- **GPS button 📍:** fills the city automatically (free OpenStreetMap service).

**User dashboard (`dashboard.html`)**
- Shows data by role: Donor, Volunteer, Feeder, NGO (stats, list, quote, welcome message).
- Settings panel: profile, notifications, dark mode, GPS city. "Share Activity" and "Back to Home" buttons.

**Admin panel (`admin.html`)**
- Dark dashboard with 9 sections: Dashboard, Rescue Requests, Donations, Volunteers, Feeding Spots, NGO Partners, Campaigns, Community Posts, Settings. Details are in `ADMIN_PANEL_GUIDE.md`.

---

## 2. Files and what each one does

**HTML (the pages)**
- `HTML/index.html` — the public home page, the login box and the upload box.
- `HTML/dashboard.html` — the private user dashboard with a settings panel.
- `HTML/admin.html` — the admin login and the 9-section control panel.

**CSS (the look)**
- `CSS/style.css` — home page: colours, navbar, hero, cards, wall, modals, forms, footer, phone layout.
- `CSS/stories.css` — stories banner: player, progress bars, caption area, round buttons.
- `CSS/dashboard.css` — dashboard: sidebar, top bar, stat cards, lists, dark mode.
- `CSS/admin.css` — admin panel: dark theme, tables, status labels, small buttons, settings cards.

**JavaScript (the behaviour)**
- `Js/main.js` — the base: saves the login in the browser, calls the backend, opens the login box, signs up, shows the user's name, quotes, counters, GPS city, wall helpers.
- `Js/stories.js` — stories banner player, photo and video upload to Cloudinary, new wall cards with video, and delete.
- `Js/auth-otp.js` — login with OTP through the backend (SMS or WhatsApp).
- `Js/social-login.js` — Google button, WhatsApp button, Instagram footer link, hides buttons that are not ready.
- `Js/dashboard.js` — fills the dashboard according to the user's role.
- `Js/admin.js` — all admin panel logic: login, sections, tables, actions.
- `Js/admin-stories.js` — admin: approve, reject, pin and delete stories.

**Other**
- `netlify.toml` — Netlify settings: publish folder, redirect to the home page, security headers.
- `.gitignore` — files Git should not upload.

**Script order (very important):** `index.html` loads `main.js` first, then `stories.js`, then `auth-otp.js`, then `social-login.js`.
`admin.html` loads `admin.js` first, then `admin-stories.js`. `dashboard.html` loads `dashboard.js`.
The later files replace some functions of `main.js`, so they must come after it.

---

## 3. Run on your computer

1. Open the `Frontend` folder in VS Code.
2. Install the **Live Server** extension.
3. Right click `HTML/index.html` and choose **Open with Live Server**.
4. The website calls the live backend. To use a local backend, change the address at the top of `main.js`, `dashboard.js` and `admin.js` to `http://localhost:5000/api`.

---

## 4. Settings you may change

| What | File | Name |
|------|------|------|
| Backend address | `main.js`, `dashboard.js`, `admin.js` | `API` |
| Photo story time | `stories.js` | `PHOTO_MS` (5000 ms) |
| Max photo size, video size, video length | `stories.js` | `MAX_IMG_MB` 10, `MAX_VID_MB` 40, `MAX_VID_SEC` 30 |
| Show the Instagram login button again | `social-login.js` | `HIDE_INSTAGRAM_LOGIN` |
| Home page numbers (2,300+ etc.) | `index.html` | `data-target` (fixed demo numbers) |

---

## 5. How the website remembers a user

After login the browser saves these items:

| Key | Content |
|-----|---------|
| `ps_token` | The token from the backend |
| `ps_current` | User info (id, name, role, city, phone) |
| `ps_role` | Dashboard role view |
| `ps_liked` | Posts this browser liked |
| `ps_dark` | Dark mode on or off |
| `ps_admin_auth` | Flag that the admin logged in |

Logout removes the token and the user. A **real** token is needed to upload stories or delete posts.
An old "demo" session has no real token; the user must log out and log in again.

---

## 6. Deploy on Netlify

1. Push the `Frontend` folder to the GitHub repo `paw-seva-frontend`.
2. In Netlify: Add new site → Import from GitHub → choose the repo.
3. Leave the build command empty and set the publish folder to `.`.
4. Every push to `main` deploys automatically.
5. You can change the site name in Project configuration.
6. If you still see old code: Deploys → Trigger deploy → **Deploy project without cache**, then press `Ctrl + Shift + R`.

---

## 7. Test checklist

1. The home page opens and the counters move.
2. Join Paw Seva → Sign Up → OTP → your name shows in the navbar and **Join Paw Seva** disappears.
3. Log out and log in with OTP (the OTP appears on screen in test mode).
4. The Google button appears (only after `GOOGLE_CLIENT_ID` is set on the backend).
5. Upload a photo or short video → admin approves → it shows in the banner.
6. Like a post, share it, delete your own post.
7. The dashboard shows your role's data and Back to Home works.
8. Admin: log in → Volunteers → search a name or city → Disable and Enable a user.

## 8. Common problems

| Problem | Reason | Fix |
|---------|--------|-----|
| Join Paw Seva does nothing | A JavaScript error stops the page | Press F12 → Console and read the error |
| Old page after deploy | Browser or Netlify cache | Deploy without cache and press `Ctrl + Shift + R` |
| "Login session purana hai" when uploading | Fake demo session | Log out and log in again |
| Donor/Volunteer radio buttons look wrong | The form input style also hits radio buttons | Give radio buttons their own small style in `style.css` |
| "IN +91" instead of a flag | Windows has no flag emoji | Use plain "+91" text |
| No social buttons | Not set up on the backend | Add the settings (see `README_BACKEND.md`) |
| Google "origin_mismatch" | Wrong allowed origin in Google Cloud | Use exactly `https://paw-seva.netlify.app` |
| Google does not work in the WhatsApp or Instagram browser | In-app browsers block Google sign-in | Open the link in Chrome |
| First load is slow | The free backend was asleep | Wait a minute, or use UptimeRobot |

---

## 9. Known limits and pending (frontend)

- Admin Settings, CSV export, Campaigns, NGO Partners and Quick Actions are demo only.
- Admin → Community Posts still shows an old demo grid. Real wall posts are deleted with the 🗑️ button on the home page (admin sees it on every post).
- Admin Feeding table shows 0 and "—" for animals and food because it reads the wrong field names.
- Dashboard sidebar items are not linked. The role dropdown only changes the view.
- Dashboard profile settings are saved only in the browser.
- There is no "Report a rescue" form yet (the backend is ready).
- Home page numbers are fixed, not live.
- **Security fix needed:** the admin login page has the admin email and password `admin123` pre-filled, and `admin.js` has a demo login. Remove both before showing the site publicly.

## 10. Version history

| Version | What changed |
|---------|--------------|
| v1 | Landing page, dashboard, admin (base) |
| v2 | OTP login box, community upload, Ratan Tata section, admin settings |
| v3 / v4 | Wall from the database, GPS city, user search, disable button |
| v5 | Stories banner, video upload, delete button, admin story moderation |
| v5.1 | Login OTP through the backend (real token) |
| v5.2 | Google button, WhatsApp button, Instagram handling, CSS fix |
