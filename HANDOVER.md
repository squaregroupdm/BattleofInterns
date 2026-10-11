# Handover: Battle of Interns

Everything a developer needs to take this project live and maintain it is in this repository. There are no hidden dependencies: no framework, no package manager, no build step for the live site, no external database server.

## What you are receiving

| Part | Where | Technology |
|---|---|---|
| Quiz page and admin panel | `public/index.html`, `public/assets/` | Plain HTML, CSS and JavaScript (no framework) |
| Backend API | `public/api/index.php` | One PHP 8 file, SQLite via PDO |
| Server settings | `public/api/config.php` | Edit before deployment |
| Question bank | `seed/questions.json`, `seed/questions.csv` | Loaded on first run; editable later from the admin panel |
| Standalone demo | `demo/`, `index.html` (root) | Same front end with a browser-storage backend; served on GitHub Pages |
| Documentation | `README.md` | Features, deployment, question management, API reference |

## Go-live checklist

1. Clone the repo. Open `public/api/config.php` and set `initial_admin_password` and `secret`.
2. Upload `public/` to the web root of a PHP 8 host (HTTPS required). Place `seed/` and `data/` one level above `public/`, exactly as in the repo. Make `data/` writable by PHP.
3. Open the site once. The database and tables are created automatically and the 30 seed questions load.
4. Open `/#admin`, sign in, change the password (Settings tab).
5. Import the final approved question set (Questions > Import, CSV or JSON). Tick "Replace all existing questions" to drop the placeholders.
6. Set the open and close date-times, confirm duration (10 min) and questions per attempt (30).
7. Run two or three test attempts from phones. Check the ranking board and the CSV exports.
8. Settings > Clear all participants. The quiz is live.

## Day-to-day operations (no developer needed)

- Add, edit or hide questions: Admin > Questions.
- Watch participation and per-question accuracy: Admin > Overview.
- Look up a doctor, view their answer sheet, remove a duplicate: Admin > Participants.
- Download results: Admin > Participants > Export (participants CSV with rank, score, time; answers CSV with every response).
- Pause or close: Admin > Settings.

## Where to change things in code

| Change | File |
|---|---|
| Colours, fonts, spacing, background pattern opacity | `public/assets/app.css` (tokens at the top) |
| Wording on any screen, validation rules (BMDC format, phone format) | `public/assets/app.js` (search for the text) and the same rules in `public/api/index.php` under `register` |
| Scoring or ranking rule | `score_attempt()` and `rank_of()` in `public/api/index.php` |
| Grace period after the timer, admin session length | `public/api/config.php` |
| Hero illustration and background motifs | `HERO_ART`, `MOTIFS` and `BG_ART` constants in `public/assets/app.js` |
| Demo page after any front-end change | run `python3 demo/build_demo.py` |

## Data and privacy

- Participant data (name, BMDC, phone, email) is stored only in `data/quiz.sqlite` on your server. It is excluded from git by `.gitignore`.
- Back up `data/quiz.sqlite` before and after the campaign.
- Delete the database or use Admin > Clear all participants when the data is no longer needed.

## Known limits and suggested next steps

- No SMS or email verification of the number; duplicates are prevented by BMDC/phone/email uniqueness only.
- No rate limiting on the API. Add host-level rate limiting if the quiz is promoted widely.
- Single admin account. Add more if several people will manage the campaign.
- Optional features listed in README section 7 (OTP, certificates, negative marking).
