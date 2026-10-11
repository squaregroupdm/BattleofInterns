# Battle of Interns

Online MCQ quiz for intern doctors, run by Moxaclav (Square Pharmaceuticals PLC) for World AMR Awareness Week.

Two ways to run it:

1. **Demo (no server)**: open `demo/battle-of-interns-demo.html` in any browser, or visit the GitHub Pages copy at https://squaregroupdm.github.io/BattleofInterns/ . Everything is stored in that browser only. Use it for management approval.
2. **Live site (PHP + SQLite)**: upload the `public` folder to any web host that runs PHP 8. Shared across all participants, with a real ranking board and admin panel.

---

## 1. What the quiz does

**Participant side (`index.html`)**

| Feature | Detail |
|---|---|
| Registration | Name, BMDC registration number, mobile number, email, medical college (optional), consent tick box. Validated on the page and again on the server. |
| One attempt per doctor | BMDC number, phone and email are each unique. A second registration with the same details is refused. If a doctor refreshes or loses connection mid-quiz, the same device resumes the same attempt with the clock still running. |
| Timed | 10 minutes by default (admin can change). The end time is fixed by the server when the quiz starts, so closing the tab does not pause it. The page auto-submits at 00:00. Timer turns amber at 2 minutes and red at 30 seconds. |
| 30 questions, one at a time | Shuffled per participant (admin can switch off). Pick an option, press Next. No going back. |
| Skip and return | "Skip for now" moves the question to the end of the queue. After the last question, skipped ones come back in order, marked "back for a second look". The dot strip under the question shows answered (teal), skipped (amber) and current. |
| Finish early | Available at any time, with a confirmation that shows how many questions are still unanswered. |
| Results and learning | Score, correct/wrong/unanswered, time taken, current rank. The "Learn from mistakes" tab shows every wrong or unanswered question with the correct option highlighted and the explanation. "All 30 questions" shows the full review. |
| Ranking board | Score first, then faster time, then earlier finish. Top 50 shown, the participant's own row highlighted. Admin can hide the board from participants. |
| Resume safety | Progress is saved to the server after every answer. Refreshing the page continues where the doctor left off. |
| Anti-cheat signals | Correct answers never leave the server during the quiz (scoring is done server-side). Tab switches and app switches are counted and shown to admin. Submissions that arrive more than 20 seconds after the deadline are scored from the last saved progress and flagged "late". |
| Quiz window | Admin can set open/close date-times, or pause registration with one tick box. Outside the window the page explains and still offers the ranking board. |
| Mobile first | Designed for phones; also works on desktop. Light and dark mode follow the device setting. |

**Admin panel (`index.html#admin`)**

| Tab | What you can do |
|---|---|
| Overview | Registered, completed, average score, average time. Per-question accuracy bars (find the hardest questions). |
| Questions | Add, edit, hide or delete questions. Import from `.json` or `.csv` (append or replace all). Export all questions as JSON. |
| Participants | Search by name, BMDC, phone, email or institution. View a participant's full answer sheet. Remove a participant (frees their BMDC number to retake). Export participants CSV (with rank, score, time, tab switches, late flag) and a full answers CSV (one row per question per participant). |
| Settings | Campaign name and brand line, duration, questions per attempt, open/close times, shuffle on/off, ranking board visible on/off, pause registration. Change admin password. "Clear all participants" to wipe test data before launch. |

---

## 2. Folder map

```
battle-of-interns/
  README.md                       this file
  public/                         upload THIS folder to the web host (it becomes the website)
    index.html                    the quiz page (and admin panel at #admin)
    assets/app.css                styles
    assets/app.js                 all screens: register, quiz, result, ranking, admin
    assets/api-remote.js          how the page talks to the PHP API
    api/index.php                 the whole backend (routes, scoring, timer, admin)
    api/config.php                settings to edit before going live
  data/                           the SQLite database is created here automatically (keep it out of git)
  seed/questions.json             the 30 starting questions, loaded on first run
  seed/questions.csv              same questions as a CSV template for admin import
  demo/battle-of-interns-demo.html  standalone demo, no server needed
  demo/api-local.js               demo version of the API (browser storage)
  demo/build_demo.py              rebuilds the demo file after editing app.js or app.css
```

---

## 3. Deploying the live site (for the developer)

Requirements: PHP 8.0 or newer with `pdo_sqlite` (standard on almost every shared host, cPanel, Hostinger, etc.). No database server, no Composer, no build step.

1. **Edit `public/api/config.php`**
   - `initial_admin_password`: the first admin password (change it again from the admin panel after first login).
   - `secret`: paste any long random string.
   - `db_path`: leave as is (`data/quiz.sqlite`, outside `public`). If the host does not allow writing outside the web root, point it to a writable folder and protect it (see step 4).
2. **Upload** the contents of `public/` to the web root (e.g. `public_html/` or a sub-folder like `public_html/battle/`). Upload `seed/` and `data/` one level above, next to `public/`, matching the folder map. If you put the quiz in a sub-folder, keep the same relative layout.
3. **Make `data/` writable** by PHP (permissions 755 or 775 usually; 777 only if the host insists). The database and tables are created on the first request, and the seed questions are loaded automatically.
4. **Protect the database.** `data/.htaccess` already denies web access on Apache. On Nginx add:
   ```
   location ~ /data/ { deny all; }
   ```
5. **HTTPS** is required in practice (participants enter phone numbers). Use the host's free Let's Encrypt certificate.
6. Open `https://your-domain/battle/` and `https://your-domain/battle/#admin`. Sign in, go to Settings, change the password, set the open/close times, then "Clear all participants" before launch.

Optional: to serve the API from a different domain than the page, set `cors_origins` in `config.php` and `window.BOI_API_BASE = "https://api-domain/api/index.php"` in `index.html` before `api-remote.js`.

**Running locally for a quick check**

```
php -S localhost:8080 -t public
```
then open http://localhost:8080 . Delete `data/quiz.sqlite` to start fresh.

---

## 4. Managing questions

Three ways, all equivalent:

- **Admin panel** (recommended for marketing): Questions > Add question, or Import.
- **CSV import**: columns `question, option_a, option_b, option_c, option_d, correct, explanation`. `correct` is A, B, C or D. `seed/questions.csv` is a filled template; edit it in Excel, save as CSV (UTF-8), import.
- **Seed file**: replace `seed/questions.json` before first deployment. It is only read when the database is created.

Questions currently in the seed file are placeholders written for the demo. Have the brand/medical team review every question and explanation before launch.

---

## 5. API reference (for the developer)

All routes: `POST api/index.php?r=<route>` with a JSON body, JSON reply. Errors come back as `{"error": "message"}` with a 4xx status. Admin routes need the header `X-Admin-Token` from `admin/login`.

| Route | Body | Returns |
|---|---|---|
| `settings` | | public settings and quiz status |
| `register` | name, email, bmdc, phone, institution, consent | `{token}` |
| `start` | token | attempt with questions (no answer keys), endsAt, saved answers |
| `progress` | token, answers, tabSwitches | `{ok}` |
| `submit` | token, answers, tabSwitches | full result with review and rank |
| `result` | token | result if completed |
| `leaderboard` | token (optional) | top 50 + own row |
| `admin/login` | password | `{adminToken}` (valid 8 h) |
| `admin/stats`, `admin/questions`, `admin/question-save`, `admin/question-delete`, `admin/question-import`, `admin/participants`, `admin/participant-answers`, `admin/participant-delete`, `admin/export`, `admin/settings`, `admin/settings-save`, `admin/password`, `admin/reset` | see `assets/api-remote.js` | |

Database tables: `settings`, `questions`, `participants`, `attempts` (one per participant; answers stored as JSON). Created automatically in `api/index.php`.

---

## 6. Rebuilding the demo after changes

Edit `public/assets/app.js` or `app.css`, then run:

```
python3 demo/build_demo.py
```

This regenerates `demo/battle-of-interns-demo.html`. The demo admin password is `admin123` and is stored in the browser only.

---

## 7. Ideas not built yet (easy to add later)

- OTP verification of the mobile number by SMS before the quiz starts.
- Email the result and a certificate of participation (needs an SMTP account on the host).
- Negative marking or per-question time limits.
- Lock the quiz to a single device fingerprint per BMDC number.
- Pull BMDC numbers from an approved list so only invited interns can register.
