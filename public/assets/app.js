/* Battle of Interns. Single-page app: quiz flow + admin panel.
   Talks to window.BOI_API (api-remote.js for the hosted site, api-local.js for the demo). */
(function () {
  "use strict";
  const API = window.BOI_API;
  const $app = document.getElementById("app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const mmss = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
  const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };


  /* ---------------- Background and hero art (original line-art) ---------------- */
  const MOTIFS = `
    <g transform="rotate(-18 46 48)"><rect x="18" y="38" width="56" height="20" rx="10"/><path d="M74 48c6-6 10 6 16 0M74 48c8 4 12-2 18 2"/></g>
    <g><circle cx="150" cy="38" r="7"/><circle cx="164" cy="32" r="7"/><circle cx="158" cy="48" r="7"/><circle cx="172" cy="46" r="7"/></g>
    <g transform="rotate(34 214 118)"><rect x="190" y="109" width="48" height="18" rx="9"/><path d="M214 109v18"/><circle cx="226" cy="118" r="1.6"/><circle cx="232" cy="114" r="1.2"/><circle cx="231" cy="122" r="1.2"/></g>
    <g><path d="M70 136l17 10v20l-17 10-17-10v-20z"/><circle cx="70" cy="136" r="3"/><circle cx="87" cy="166" r="3"/><circle cx="53" cy="166" r="3"/></g>
    <path d="M118 206c6-14 14-14 20 0s14 14 20 0 14-14 20 0 14 14 20 0"/>
    <g><path d="M200 238c0-30 12-42 40-40-2 28-14 40-40 40z"/><path d="M200 238c12-12 22-22 34-34"/></g>
    <g><circle cx="42" cy="232" r="10"/><path d="M42 218v-6M42 246v6M28 232h-6M56 232h6M32 222l-4-4M52 242l4 4M52 222l4-4M32 242l-4 4"/></g>
    <path d="M118 96h10M123 91v10"/><circle cx="236" cy="22" r="2"/><circle cx="110" cy="248" r="2"/><circle cx="12" cy="120" r="2"/>
    <g transform="rotate(20 150 130)"><rect x="128" y="123" width="44" height="14" rx="7"/></g>`;
  const BG_ART = `
    <div class="bgart" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <defs>
        <pattern id="boiPat" width="260" height="260" patternUnits="userSpaceOnUse">${MOTIFS}</pattern>
        <pattern id="boiPat2" width="260" height="260" patternUnits="userSpaceOnUse" patternTransform="scale(1.7)">${MOTIFS}</pattern>
      </defs>
      <g class="drift2" opacity="0.22"><rect x="-1200" y="-1200" width="400%" height="400%" fill="url(#boiPat2)" stroke="none"/></g>
      <g class="drift1" opacity="0.42"><rect x="0" y="0" width="300%" height="300%" fill="url(#boiPat)" stroke="none"/></g>
    </svg>
    <svg class="floater f1" viewBox="-30 -30 60 60" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="0" cy="0" r="10"/><path d="M0-14v-6M0 14v6M-14 0h-6M14 0h6M-10-10l-4-4M10 10l4 4M10-10l4-4M-10 10l-4 4"/></svg>
    <svg class="floater f2" viewBox="-34 -22 68 44" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><g transform="rotate(-20)"><rect x="-26" y="-9" width="52" height="18" rx="9"/><path d="M0-9v18"/><circle cx="12" cy="0" r="1.6"/><circle cx="18" cy="-4" r="1.2"/><circle cx="17" cy="4" r="1.2"/></g></svg>
    <svg class="floater f3" viewBox="-12 -16 44 36" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="0" cy="0" r="7"/><circle cx="14" cy="-6" r="7"/><circle cx="8" cy="10" r="7"/><circle cx="22" cy="8" r="7"/></svg>
    </div>`;
  const HERO_ART = `
    <svg class="hero-art" viewBox="0 0 150 190" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <g transform="rotate(-28 75 95)">
        <rect x="42" y="16" width="66" height="158" rx="33"/>
        <path d="M42 95h66"/>
        <g class="acc"><circle cx="64" cy="46" r="6"/><circle cx="78" cy="40" r="6"/><circle cx="72" cy="56" r="6"/><circle cx="86" cy="54" r="6"/>
          <g transform="rotate(-20 75 78)"><rect x="56" y="72" width="38" height="12" rx="6"/></g>
          <path d="M60 30c4-4 8 2 12-2"/></g>
        <path d="M75 112l12 7v14l-12 7-12-7v-14z"/><circle cx="75" cy="112" r="2"/><circle cx="87" cy="133" r="2"/><circle cx="63" cy="133" r="2"/>
        <path d="M58 160c0-16 7-23 22-22-1 15-8 22-22 22z"/><path d="M58 160l16-16"/>
        <path d="M94 150c4-6 10-6 14 0"/>
      </g>
      <g class="acc" transform="translate(118 150)"><circle cx="0" cy="0" r="12"/><path d="M0-16v-5M0 16v5M-16 0h-5M16 0h5M-11-11l-4-4M11 11l4 4M11-11l4-4M-11 11l-4 4"/></g>
    </svg>`;

  let settings = { campaignName: "Battle of Interns", sponsor: "Moxaclav", durationSec: 600, questionCount: 30, leaderboardPublic: true, status: "open" };
  let toastTimer = null;

  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function confirmBox({ title, body, okText = "Confirm", danger = false }) {
    return new Promise((resolve) => {
      const bg = document.createElement("div"); bg.className = "modal-bg";
      bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p class="muted">${esc(body)}</p>
        <div class="row end"><button class="btn" data-x="no">Cancel</button><button class="btn ${danger ? "danger" : "primary"}" data-x="yes">${esc(okText)}</button></div></div>`;
      bg.addEventListener("click", (e) => { const x = e.target.getAttribute("data-x"); if (x) { bg.remove(); resolve(x === "yes"); } });
      document.body.appendChild(bg);
    });
  }
  function shell(inner, { wide = false, right = "" } = {}) {
    if (!document.querySelector(".bgart")) document.body.insertAdjacentHTML("afterbegin", BG_ART);
    $app.innerHTML = `
      <header class="topbar"><div class="topbar-in">
        <div class="brand"><span class="brand-name">${esc(settings.campaignName)}</span><span class="brand-sub">${esc(settings.sponsor)} &middot; World AMR Awareness Week</span></div>
        ${right}
      </div></header>
      <main class="wrap ${wide ? "wide" : ""}">${inner}</main>
      <div class="footer">Square Pharmaceuticals PLC ${settings.demo ? '&middot; <span class="demo-badge">DEMO</span>' : ""}</div>`;
  }

  /* ---------------- Routing ---------------- */
  async function route() {
    try { settings = await API.getSettings(); } catch (e) { /* keep defaults */ }
    const h = location.hash.replace("#", "");
    document.body.classList.toggle("admin", h === "admin");
    if (h === "admin") return Admin.mount();
    if (h === "board") return Board.mount();
    return Quiz.boot();
  }
  window.addEventListener("hashchange", route);

  /* ---------------- Participant flow ---------------- */
  const Quiz = {
    token: null, attempt: null, answers: {}, queue: [], seen: new Set(), tabSwitches: 0, timerId: null, saveTimer: null, submitting: false,

    async boot() {
      Quiz.stopTimer();
      Quiz.token = store.get("boi_token");
      if (Quiz.token) {
        try {
          const r = await API.getResult(Quiz.token);
          if (r && r.completed) return Quiz.showResult(r);
          return Quiz.start(true);
        } catch (e) { store.del("boi_token"); Quiz.token = null; }
      }
      Quiz.welcome();
    },

    welcome(err) {
      const closed = settings.status !== "open";
      shell(`
        <div class="stack">
          <div class="hero">
            <div class="hero-text">
              <span class="eyebrow">Online quiz for intern doctors</span>
              <h1>${esc(settings.campaignName)}</h1>
              <p class="muted">Test your antimicrobial judgement. ${settings.questionCount} questions, ${Math.round(settings.durationSec / 60)} minutes, one attempt per doctor.</p>
            </div>
            ${HERO_ART}
          </div>
          <div class="card stack">
            <div class="rules">
              <div class="rule"><div class="rule-ic">${settings.questionCount}</div><div><b>MCQ, one at a time</b><br><span class="muted small">Pick one option and press Next. You cannot go back.</span></div></div>
              <div class="rule"><div class="rule-ic">${Math.round(settings.durationSec / 60)}m</div><div><b>Timed</b><br><span class="muted small">The clock starts when you press Start and runs even if you leave the page.</span></div></div>
              <div class="rule"><div class="rule-ic">&#8631;</div><div><b>Skip and return</b><br><span class="muted small">Skipped questions come back after you reach the end.</span></div></div>
              <div class="rule"><div class="rule-ic">&#10003;</div><div><b>Learn after</b><br><span class="muted small">Explanations for every wrong answer appear when you finish, with your rank.</span></div></div>
            </div>
          </div>
          ${closed ? `<div class="alert warn">${settings.status === "not_started" ? "The quiz has not opened yet." : "Registration for this quiz is closed."} ${settings.leaderboardPublic ? '<a href="#board">See the ranking board</a>.' : ""}</div>` : `
          <form class="card stack" id="regForm" novalidate>
            <h2>Register to start</h2>
            ${err ? `<div class="alert bad">${esc(err)}</div>` : ""}
            <div class="field"><label for="f_name">Full name</label><input class="input" id="f_name" name="name" autocomplete="name" placeholder="Dr. Full Name" required></div>
            <div class="field"><label for="f_bmdc">BMDC registration number</label><input class="input" id="f_bmdc" name="bmdc" placeholder="A-123456" autocomplete="off" required><span class="hint">As printed on your BMDC certificate. One attempt per registration number.</span></div>
            <div class="grid-2">
              <div class="field"><label for="f_phone">Mobile number</label><input class="input" id="f_phone" name="phone" inputmode="tel" placeholder="01XXXXXXXXX" required></div>
              <div class="field"><label for="f_email">Email</label><input class="input" id="f_email" name="email" type="email" inputmode="email" placeholder="you@example.com" required></div>
            </div>
            <div class="field"><label for="f_inst">Medical college</label>
              <select class="input" id="f_inst" name="institution" required><option value="">Select your medical college</option>${(settings.institutions || []).map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}<option value="__other">Other (not in the list)</option></select></div>
            <div class="field" id="instOtherWrap" hidden><label for="f_inst_other">Name of your medical college</label><input class="input" id="f_inst_other" name="institutionOther" placeholder="Type the full name"></div>
            <label class="check"><input type="checkbox" id="f_consent" name="consent" required><span>I confirm I am an intern doctor and agree that my name and score may appear on the ranking board and that Square Pharmaceuticals may contact me about this campaign.</span></label>
            <button class="btn primary block" type="submit" id="btnStart">Start the quiz</button>
            ${settings.leaderboardPublic ? `<a class="btn ghost block" href="#board">View ranking board</a>` : ""}
          </form>`}
        </div>`);
      const form = document.getElementById("regForm");
      if (!form) return;
      const instSel = document.getElementById("f_inst"), instOther = document.getElementById("instOtherWrap");
      instSel.addEventListener("change", () => { instOther.hidden = instSel.value !== "__other"; if (!instOther.hidden) document.getElementById("f_inst_other").focus(); });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(form).entries());
        d.consent = form.consent.checked;
        if (d.institution === "__other") d.institution = (d.institutionOther || "").trim();
        delete d.institutionOther;
        const problems = Quiz.validate(d);
        form.querySelectorAll(".field").forEach((f) => { f.classList.remove("invalid"); const er = f.querySelector(".err"); if (er) er.remove(); });
        if (Object.keys(problems).length) {
          for (const [k, msg] of Object.entries(problems)) {
            const inp = form.querySelector(`[name="${k}"]`); const f = inp && inp.closest(".field");
            if (f) { f.classList.add("invalid"); f.insertAdjacentHTML("beforeend", `<span class="err">${esc(msg)}</span>`); }
            else toast(msg);
          }
          return;
        }
        const btn = document.getElementById("btnStart"); btn.disabled = true; btn.textContent = "Registering...";
        try {
          const r = await API.register(d);
          Quiz.token = r.token; store.set("boi_token", r.token);
          Quiz.start(false);
        } catch (ex) { Quiz.welcome(ex.message || "Could not register."); }
      });
    },

    validate(d) {
      const p = {};
      if (!d.name || d.name.trim().length < 3) p.name = "Enter your full name.";
      if (!/^[A-Z]{1,2}\d{3,7}$/.test((d.bmdc || "").toUpperCase().replace(/[\s-]/g, ""))) p.bmdc = "Enter a valid BMDC number, e.g. A-123456.";
      if (!/^(\+?88)?01[3-9]\d{8}$/.test((d.phone || "").replace(/[\s-]/g, ""))) p.phone = "Enter an 11-digit Bangladeshi mobile number.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((d.email || "").trim())) p.email = "Enter a valid email address.";
      if (!d.institution || d.institution.trim().length < 3) p.institution = "Select your medical college, or choose Other and type it.";
      if (!d.consent) p.consent = "Please tick the consent box to continue.";
      return p;
    },

    async start(resuming) {
      try {
        const a = await API.startAttempt(Quiz.token);
        Quiz.attempt = a;
        Quiz.answers = a.answers || {};
        Quiz.tabSwitches = a.tabSwitches || 0;
        const ids = a.questions.map((q) => q.id);
        Quiz.queue = ids.filter((id) => !(id in Quiz.answers));
        Quiz.seen = new Set();
        if (Quiz.queue.length === 0 || Date.now() >= a.endsAt) return Quiz.submit(true);
        if (!resuming) toast("Your clock has started.");
        Quiz.renderQuestion();
        Quiz.startTimer();
        document.addEventListener("visibilitychange", Quiz.onVis);
      } catch (e) {
        store.del("boi_token"); Quiz.token = null; Quiz.welcome(e.message);
      }
    },
    onVis() { if (document.hidden && Quiz.attempt) { Quiz.tabSwitches++; Quiz.queueSave(); } },
    startTimer() {
      Quiz.stopTimer();
      Quiz.timerId = setInterval(Quiz.tick, 250);
      Quiz.tick();
    },
    stopTimer() { clearInterval(Quiz.timerId); Quiz.timerId = null; document.removeEventListener("visibilitychange", Quiz.onVis); },
    tick() {
      if (!Quiz.attempt) return;
      const left = Math.max(0, Math.ceil((Quiz.attempt.endsAt - Date.now()) / 1000));
      const el = document.getElementById("timer");
      if (el) {
        const t = document.getElementById("timeText"); if (t) t.textContent = mmss(left);
        el.classList.toggle("warn", left <= 120 && left > 30);
        el.classList.toggle("bad", left <= 30);
      }
      if (left <= 0 && !Quiz.submitting) Quiz.submit(true);
    },
    queueSave() {
      clearTimeout(Quiz.saveTimer);
      Quiz.saveTimer = setTimeout(() => { API.saveProgress(Quiz.token, { answers: Quiz.answers, tabSwitches: Quiz.tabSwitches }).catch(() => {}); }, 600);
    },

    renderQuestion() {
      const a = Quiz.attempt; const qs = a.questions; const total = qs.length;
      const qid = Quiz.queue[0]; const q = qs.find((x) => x.id === qid); const idx = qs.indexOf(q);
      const answered = Object.keys(Quiz.answers).length;
      const revisit = Quiz.seen.has(qid);
      Quiz.seen.add(qid);
      const skippedCount = Quiz.queue.filter((id) => Quiz.seen.has(id) && id !== qid).length;
      shell(`
        <div class="stack">
          <div class="quiz-head">
            <div><span class="eyebrow">Question ${idx + 1} of ${total}</span><br><span class="small muted num">${answered} answered &middot; ${skippedCount} skipped</span></div>
            <div class="timer num" id="timer" aria-live="off"><span class="timer-dot"></span><span id="timeText">${mmss(Math.max(0, Math.ceil((a.endsAt - Date.now()) / 1000)))}</span></div>
          </div>
          <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${answered}"><i style="width:${(answered / total) * 100}%"></i><i class="skip" style="width:${(skippedCount / total) * 100}%"></i></div>
          ${revisit ? `<div class="alert info">You skipped this one earlier. It is back for a second look.</div>` : ""}
          <div class="card stack">
            <p class="qtext">${esc(q.text)}</p>
            <div class="options" role="radiogroup" aria-label="Options">
              ${q.options.map((o) => `<button type="button" class="opt" role="radio" aria-checked="false" data-key="${esc(o.key)}"><span class="key">${esc(o.key)}</span><span>${esc(o.text)}</span></button>`).join("")}
            </div>
            <div class="qnav">
              <button class="btn" id="btnSkip" type="button">Skip for now</button>
              <button class="btn primary" id="btnNext" type="button" disabled>Next</button>
            </div>
          </div>
          <div class="row between"><span class="small muted">Answers lock when you press Next.</span><button class="btn ghost sm" id="btnFinish" type="button">Finish early</button></div>
        </div>`, { right: `<span class="pill accent num">${answered}/${total}</span>` });

      let picked = null;
      const next = document.getElementById("btnNext");
      document.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
        picked = b.dataset.key;
        document.querySelectorAll(".opt").forEach((x) => { x.classList.toggle("selected", x === b); x.setAttribute("aria-checked", x === b ? "true" : "false"); });
        next.disabled = false;
      }));
      next.addEventListener("click", () => {
        if (!picked) return;
        Quiz.answers[qid] = picked; Quiz.queue.shift(); Quiz.queueSave(); Quiz.advance();
      });
      document.getElementById("btnSkip").addEventListener("click", () => {
        if (Quiz.queue.length === 1) { toast("This is the last unanswered question."); return; }
        Quiz.queue.push(Quiz.queue.shift());
        Quiz.advance();
      });
      document.getElementById("btnFinish").addEventListener("click", async () => {
        const left = Quiz.queue.length;
        const ok = await confirmBox({ title: "Finish the quiz now?", body: left ? `${left} question${left > 1 ? "s are" : " is"} still unanswered and will count as wrong.` : "All questions answered. Submit your answers?", okText: "Submit", danger: !!left });
        if (ok) Quiz.submit(false);
      });
    },
    advance() {
      if (Quiz.queue.length === 0) return Quiz.submit(false);
      Quiz.renderQuestion();
    },

    async submit(auto) {
      if (Quiz.submitting) return;
      Quiz.submitting = true; Quiz.stopTimer();
      shell(`<div class="card stack"><h2>${auto ? "Time is up." : "Submitting..."}</h2><p class="muted">Scoring your answers.</p></div>`);
      try {
        const r = await API.submitAttempt(Quiz.token, { answers: Quiz.answers, tabSwitches: Quiz.tabSwitches });
        Quiz.attempt = null; Quiz.submitting = false;
        Quiz.showResult(r, auto);
      } catch (e) { Quiz.submitting = false; shell(`<div class="card stack"><div class="alert bad">${esc(e.message)}</div><button class="btn" onclick="location.reload()">Try again</button></div>`); }
    },

    showResult(r, timedOut) {
      Quiz.stopTimer();
      const wrong = r.review.filter((x) => !x.isCorrect);
      const pct = Math.round((r.correct / r.total) * 100);
      const render = (tab) => {
        shell(`
          <div class="stack">
            ${timedOut ? `<div class="alert warn">Time ran out, so your answers were submitted automatically.</div>` : ""}
            <div class="card stack">
              <span class="eyebrow">Your result</span>
              <div class="score-tile">
                <div class="score-big num">${r.score}<small>/${r.total}</small></div>
                <div><h2>${esc(r.name)}</h2><p class="muted small">${r.rank ? `Rank <b class="num">#${r.rank}</b> of ${r.totalParticipants} so far` : ""} ${pct >= 80 ? '<span class="pill good">Top form</span>' : pct >= 50 ? '<span class="pill accent">Solid</span>' : '<span class="pill warn">Keep reading</span>'}</p></div>
              </div>
              <div class="stat-row num">
                <div class="stat"><b>${r.correct}</b><span>Correct</span></div>
                <div class="stat"><b>${r.wrong}</b><span>Wrong</span></div>
                <div class="stat"><b>${r.skipped}</b><span>Unanswered</span></div>
                <div class="stat"><b>${mmss(r.timeTakenSec)}</b><span>Time</span></div>
              </div>
            </div>
            <div class="tabs" role="tablist">
              <button class="tab ${tab === "wrong" ? "active" : ""}" data-t="wrong">Learn from mistakes (${wrong.length})</button>
              <button class="tab ${tab === "all" ? "active" : ""}" data-t="all">All ${r.total} questions</button>
              ${settings.leaderboardPublic ? `<button class="tab ${tab === "board" ? "active" : ""}" data-t="board">Ranking</button>` : ""}
            </div>
            <div id="tabBody">${tab === "board" ? `<div class="muted small">Loading ranking...</div>` : Quiz.reviewList(tab === "wrong" ? wrong : r.review)}</div>
          </div>`);
        document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => render(b.dataset.t)));
        if (tab === "board") Board.fill(document.getElementById("tabBody"));
      };
      render("wrong");
    },
    reviewList(items) {
      if (!items.length) return `<div class="card tint"><b>Perfect score.</b> Nothing to review.</div>`;
      return `<div class="review">${items.map((x, i) => `
        <div class="card flat review-item ${x.isCorrect ? "ok" : ""}">
          <div class="row between"><span class="eyebrow">Q${x.number}</span>${x.isCorrect ? '<span class="pill good">Correct</span>' : x.yourAnswer ? '<span class="pill bad">Wrong</span>' : '<span class="pill warn">Unanswered</span>'}</div>
          <p class="qtext" style="font-size:1rem">${esc(x.text)}</p>
          <div class="options">${x.options.map((o) => `<div class="opt ${o.key === x.correct ? "correct" : (o.key === x.yourAnswer ? "wrong" : "")}" style="cursor:default"><span class="key">${esc(o.key)}</span><span>${esc(o.text)}</span></div>`).join("")}</div>
          <div class="explain"><b>Why:</b> ${esc(x.explanation)}</div>
        </div>`).join("")}</div>`;
    },
  };

  /* ---------------- Ranking board ---------------- */
  const Board = {
    async mount() {
      shell(`<div class="stack"><div class="hero"><span class="eyebrow">Live ranking</span><h1>Ranking board</h1><p class="muted">Score first, then faster time. Updates as doctors finish.</p></div><div id="boardBody" class="stack"><div class="muted small">Loading...</div></div><a class="btn block" href="#">Back</a></div>`);
      Board.fill(document.getElementById("boardBody"));
    },
    async fill(el) {
      try {
        const b = await API.getLeaderboard(store.get("boi_token"));
        if (!b.rows.length) { el.innerHTML = `<div class="card tint">No one has finished yet. Be the first name on the board.</div>`; return; }
        el.innerHTML = `<div class="row between"><span class="small muted num">${b.totalParticipants} participant${b.totalParticipants === 1 ? "" : "s"} &middot; top ${b.rows.length}</span><button class="btn sm" id="btnRefresh">Refresh</button></div>
          <div class="board">${b.rows.map((r) => `<div class="board-row ${r.isMe ? "me" : ""} ${r.rank <= 3 ? "top" : ""}"><span class="rank num">${r.rank <= 3 ? ["&#129351;", "&#129352;", "&#129353;"][r.rank - 1] : "#" + r.rank}</span><div class="who"><b>${esc(r.name)}${r.isMe ? " (you)" : ""}</b><span>${esc(r.institution || "")}</span></div><div class="sc num"><b>${r.score}/${r.total}</b><span>${mmss(r.timeTakenSec)}</span></div></div>`).join("")}</div>
          ${b.me && !b.rows.some((r) => r.isMe) ? `<div class="board-row me"><span class="rank num">#${b.me.rank}</span><div class="who"><b>${esc(b.me.name)} (you)</b></div><div class="sc num"><b>${b.me.score}/${b.me.total}</b><span>${mmss(b.me.timeTakenSec)}</span></div></div>` : ""}`;
        document.getElementById("btnRefresh").addEventListener("click", () => Board.fill(el));
      } catch (e) { el.innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
    },
  };

  /* ---------------- Admin ---------------- */
  const Admin = {
    tab: "overview", token: null,
    async mount() {
      Admin.token = (() => { try { return sessionStorage.getItem("boi_admin"); } catch (e) { return null; } })();
      if (!Admin.token) return Admin.login();
      Admin.render();
    },
    login(err) {
      shell(`<div class="card stack" style="max-width:420px;margin:0 auto"><h2>Admin sign in</h2>${err ? `<div class="alert bad">${esc(err)}</div>` : ""}
        <form id="loginForm" class="stack"><div class="field"><label for="a_pw">Password</label><input class="input" type="password" id="a_pw" autocomplete="current-password" required>${settings.demo ? '<span class="hint">Demo password: <b>admin123</b></span>' : ""}</div>
        <button class="btn primary block" type="submit">Sign in</button><a class="btn ghost block" href="#">Back to quiz</a></form></div>`);
      document.getElementById("loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        try { const r = await API.adminLogin(document.getElementById("a_pw").value); Admin.token = r.adminToken; try { sessionStorage.setItem("boi_admin", r.adminToken); } catch (x) {} Admin.render(); }
        catch (ex) { Admin.login(ex.message); }
      });
    },
    logout() { try { sessionStorage.removeItem("boi_admin"); } catch (e) {} Admin.token = null; API.adminLogout && API.adminLogout(); location.hash = ""; },
    async guard(fn) {
      try { return await fn(); } catch (e) { if (/unauthori[sz]ed|sign in/i.test(e.message)) { Admin.token = null; try { sessionStorage.removeItem("boi_admin"); } catch (x) {} Admin.login("Session expired. Sign in again."); } else toast(e.message); throw e; }
    },
    render() {
      const tabs = [["overview", "Overview"], ["questions", "Questions"], ["participants", "Participants"], ["colleges", "Medical colleges"], ["settings", "Settings"]];
      shell(`<div class="stack">
        <div class="row between"><div><span class="eyebrow">Admin panel</span><h1>Campaign control</h1></div><div class="row"><a class="btn sm" href="#">View quiz</a><button class="btn sm ghost" id="btnLogout">Sign out</button></div></div>
        <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${Admin.tab === k ? "active" : ""}" data-t="${k}">${l}</button>`).join("")}</div>
        <div id="adminBody"><div class="muted small">Loading...</div></div></div>`, { wide: true });
      document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => { Admin.tab = b.dataset.t; Admin.render(); }));
      document.getElementById("btnLogout").addEventListener("click", Admin.logout);
      Admin[Admin.tab](document.getElementById("adminBody"));
    },

    async overview(el) {
      const s = await Admin.guard(() => API.adminStats(Admin.token));
      el.innerHTML = `<div class="stack">
        <div class="grid-4">
          <div class="kpi"><b class="num">${s.participants}</b><span>Registered</span></div>
          <div class="kpi"><b class="num">${s.completed}</b><span>Completed</span></div>
          <div class="kpi"><b class="num">${s.completed ? s.avgScore.toFixed(1) : "0"}</b><span>Average score / ${s.total}</span></div>
          <div class="kpi"><b class="num">${s.completed ? mmss(Math.round(s.avgTimeSec)) : "00:00"}</b><span>Average time</span></div>
        </div>
        <div class="row between"><h2>Question difficulty</h2><span class="small muted">Share of participants who answered correctly</span></div>
        <div class="table-wrap"><table><thead><tr><th>#</th><th>Question</th><th>Answered</th><th>Correct</th><th style="width:140px">Accuracy</th></tr></thead><tbody>
          ${s.questionStats.map((q, i) => { const p = q.attempts ? Math.round((q.correct / q.attempts) * 100) : 0; return `<tr><td class="num">${i + 1}</td><td>${esc(q.text)}</td><td class="num">${q.attempts}</td><td class="num">${q.correct}</td><td><div class="row" style="gap:8px"><div class="bar grow ${p < 40 ? "low" : p < 70 ? "mid" : ""}"><i style="width:${p}%"></i></div><span class="num small">${q.attempts ? p + "%" : "n/a"}</span></div></td></tr>`; }).join("")}
        </tbody></table></div></div>`;
    },

    async questions(el) {
      const list = await Admin.guard(() => API.adminQuestions(Admin.token));
      el.innerHTML = `<div class="stack">
        <div class="row between"><div><h2>${list.length} questions</h2><span class="small muted">${list.filter((q) => q.active).length} active. Each participant gets ${settings.questionCount} of the active ones, shuffled.</span></div>
          <div class="row"><button class="btn sm" id="btnImport">Import</button><button class="btn sm" id="btnExportQ">Export JSON</button><button class="btn sm primary" id="btnAdd">Add question</button></div></div>
        <div class="table-wrap"><table><thead><tr><th>#</th><th>Question</th><th>Answer</th><th>Status</th><th></th></tr></thead><tbody>
          ${list.map((q, i) => `<tr><td class="num">${i + 1}</td><td>${esc(q.text)}<br><span class="small muted">${["A", "B", "C", "D"].map((k) => `${k}. ${esc(q.options[k])}`).join(" &nbsp; ")}</span></td><td><span class="pill good">${esc(q.correct)}</span></td><td><span class="pill ${q.active ? "accent" : ""}">${q.active ? "Active" : "Hidden"}</span></td><td class="actions"><button class="btn sm" data-edit="${q.id}">Edit</button> <button class="btn sm danger" data-del="${q.id}">Delete</button></td></tr>`).join("")}
        </tbody></table></div></div>`;
      el.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => Admin.editQuestion(list.find((q) => q.id === b.dataset.edit))));
      el.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
        if (await confirmBox({ title: "Delete this question?", body: "Existing answers to it stay in the export, but it will no longer be served.", okText: "Delete", danger: true })) { await Admin.guard(() => API.adminDeleteQuestion(Admin.token, b.dataset.del)); toast("Deleted"); Admin.render(); }
      }));
      document.getElementById("btnAdd").addEventListener("click", () => Admin.editQuestion(null));
      document.getElementById("btnExportQ").addEventListener("click", () => Admin.download("questions.json", JSON.stringify(list.map(({ text, options, correct, explanation }) => ({ text, options, correct, explanation })), null, 2), "application/json"));
      document.getElementById("btnImport").addEventListener("click", () => Admin.importDialog());
    },
    editQuestion(q) {
      const bg = document.createElement("div"); bg.className = "modal-bg";
      const v = (k) => esc(q ? q.options[k] : "");
      bg.innerHTML = `<form class="modal" style="max-width:640px" id="qForm"><h2>${q ? "Edit question" : "New question"}</h2>
        <div class="field"><label for="q_text">Question</label><textarea class="input" id="q_text" required>${esc(q ? q.text : "")}</textarea></div>
        <div class="grid-2">${["A", "B", "C", "D"].map((k) => `<div class="field"><label for="q_${k}">Option ${k}</label><input class="input" id="q_${k}" value="${v(k)}" required></div>`).join("")}</div>
        <div class="grid-2"><div class="field"><label for="q_correct">Correct option</label><select class="input" id="q_correct">${["A", "B", "C", "D"].map((k) => `<option ${q && q.correct === k ? "selected" : ""}>${k}</option>`).join("")}</select></div>
        <div class="field"><label for="q_active">Status</label><select class="input" id="q_active"><option value="1" ${!q || q.active ? "selected" : ""}>Active</option><option value="0" ${q && !q.active ? "selected" : ""}>Hidden</option></select></div></div>
        <div class="field"><label for="q_expl">Explanation (shown after the quiz)</label><textarea class="input" id="q_expl">${esc(q ? q.explanation : "")}</textarea></div>
        <div class="row end"><button class="btn" type="button" data-x="no">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`;
      bg.querySelector("[data-x=no]").addEventListener("click", () => bg.remove());
      bg.querySelector("#qForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const g = (id) => bg.querySelector("#" + id).value;
        const payload = { id: q ? q.id : null, text: g("q_text").trim(), options: { A: g("q_A").trim(), B: g("q_B").trim(), C: g("q_C").trim(), D: g("q_D").trim() }, correct: g("q_correct"), explanation: g("q_expl").trim(), active: g("q_active") === "1" };
        await Admin.guard(() => API.adminSaveQuestion(Admin.token, payload));
        bg.remove(); toast("Saved"); Admin.render();
      });
      document.body.appendChild(bg);
    },
    importDialog() {
      const bg = document.createElement("div"); bg.className = "modal-bg";
      bg.innerHTML = `<div class="modal" style="max-width:640px"><h2>Import questions</h2>
        <p class="muted small">Upload a <b>.json</b> file (same format as Export) or a <b>.csv</b> with columns: <code>question, option_a, option_b, option_c, option_d, correct, explanation</code>. The seed file in the repo is a ready template.</p>
        <input type="file" id="impFile" accept=".json,.csv,text/csv,application/json" class="input">
        <label class="check"><input type="checkbox" id="impReplace"><span>Replace all existing questions (otherwise append)</span></label>
        <div id="impStatus" class="small muted"></div>
        <div class="row end"><button class="btn" data-x="no">Cancel</button><button class="btn primary" id="impGo" disabled>Import</button></div></div>`;
      let parsed = null;
      bg.querySelector("[data-x=no]").addEventListener("click", () => bg.remove());
      bg.querySelector("#impFile").addEventListener("change", (e) => {
        const f = e.target.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          try { parsed = f.name.toLowerCase().endsWith(".json") ? JSON.parse(rd.result) : Admin.parseCsv(rd.result); }
          catch (ex) { parsed = null; bg.querySelector("#impStatus").textContent = "Could not read file: " + ex.message; return; }
          const bad = parsed.filter((q) => !q.text || !q.options || !["A", "B", "C", "D"].every((k) => q.options[k]) || !/^[ABCD]$/.test(q.correct));
          bg.querySelector("#impStatus").textContent = `${parsed.length} questions found${bad.length ? `, ${bad.length} invalid rows will be skipped` : ""}.`;
          parsed = parsed.filter((q) => !bad.includes(q));
          bg.querySelector("#impGo").disabled = !parsed.length;
        };
        rd.readAsText(f);
      });
      bg.querySelector("#impGo").addEventListener("click", async () => {
        const r = await Admin.guard(() => API.adminImportQuestions(Admin.token, parsed, bg.querySelector("#impReplace").checked));
        bg.remove(); toast(`${r.count} questions imported`); Admin.render();
      });
      document.body.appendChild(bg);
    },
    parseCsv(text) {
      const rows = []; let row = [], cell = "", inQ = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += c; }
        else if (c === '"') inQ = true;
        else if (c === ",") { row.push(cell); cell = ""; }
        else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
        else cell += c;
      }
      if (cell || row.length) { row.push(cell); rows.push(row); }
      const head = rows.shift().map((h) => h.trim().toLowerCase());
      const col = (r, name) => r[head.indexOf(name)] ?? "";
      return rows.filter((r) => r.some((x) => x.trim())).map((r) => ({ text: col(r, "question").trim(), options: { A: col(r, "option_a").trim(), B: col(r, "option_b").trim(), C: col(r, "option_c").trim(), D: col(r, "option_d").trim() }, correct: col(r, "correct").trim().toUpperCase(), explanation: col(r, "explanation").trim() }));
    },

    async participants(el, q = "") {
      const list = await Admin.guard(() => API.adminParticipants(Admin.token, { q }));
      el.innerHTML = `<div class="stack">
        <div class="row between"><h2>${list.length} participant${list.length === 1 ? "" : "s"}</h2>
          <div class="row"><input class="input" id="pSearch" placeholder="Search name, BMDC, phone, email" value="${esc(q)}" style="min-width:240px"><button class="btn sm" id="btnCsv1">Export participants CSV</button><button class="btn sm" id="btnCsv2">Export all answers CSV</button></div></div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>BMDC</th><th>Contact</th><th>Institution</th><th>Status</th><th>Score</th><th>Time</th><th>Tab switches</th><th>Registered</th><th></th></tr></thead><tbody>
          ${list.length ? list.map((p) => `<tr><td><b>${esc(p.name)}</b></td><td class="num">${esc(p.bmdc)}</td><td class="small">${esc(p.phone)}<br>${esc(p.email)}</td><td class="small">${esc(p.institution || "")}</td>
            <td><span class="pill ${p.status === "completed" ? "good" : p.status === "in_progress" ? "warn" : ""}">${esc(p.status.replace("_", " "))}</span></td>
            <td class="num">${p.status === "completed" ? `${p.score}/${p.total}` : ""}</td><td class="num">${p.status === "completed" ? mmss(p.timeTakenSec) : ""}</td><td class="num">${p.tabSwitches > 0 ? `<span class="pill ${p.tabSwitches > 3 ? "bad" : "warn"}">${p.tabSwitches}</span>` : "0"}</td><td class="small num">${fmtDate(p.registeredAt)}</td>
            <td class="actions"><button class="btn sm" data-view="${p.id}" ${p.status === "completed" ? "" : "disabled"}>Answers</button> <button class="btn sm danger" data-del="${p.id}">Remove</button></td></tr>`).join("") : `<tr><td colspan="10" class="muted">No participants yet.</td></tr>`}
        </tbody></table></div>
        <p class="small muted">Removing a participant deletes their registration and answers and frees their BMDC number to take the quiz again. Tab switches count how many times the quiz page was hidden during the attempt; a high number may indicate looking up answers.</p></div>`;
      let st; document.getElementById("pSearch").addEventListener("input", (e) => { clearTimeout(st); st = setTimeout(() => Admin.participants(el, e.target.value), 300); });
      el.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
        if (await confirmBox({ title: "Remove participant?", body: "Their registration, answers and ranking entry will be deleted.", okText: "Remove", danger: true })) { await Admin.guard(() => API.adminDeleteParticipant(Admin.token, b.dataset.del)); toast("Removed"); Admin.participants(el, q); }
      }));
      el.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", async () => {
        const ans = await Admin.guard(() => API.adminParticipantAnswers(Admin.token, b.dataset.view));
        const p = list.find((x) => x.id === b.dataset.view);
        const bg = document.createElement("div"); bg.className = "modal-bg";
        bg.innerHTML = `<div class="modal" style="max-width:720px;max-height:90vh;overflow:auto"><div class="row between"><h2>${esc(p.name)}</h2><button class="btn sm" data-x="no">Close</button></div>
          <div class="table-wrap"><table><thead><tr><th>#</th><th>Question</th><th>Answer</th><th>Correct</th><th></th></tr></thead><tbody>${ans.map((a, i) => `<tr><td class="num">${i + 1}</td><td>${esc(a.text)}</td><td>${esc(a.answer || "skipped")}</td><td>${esc(a.correct)}</td><td>${a.isCorrect ? '<span class="pill good">&#10003;</span>' : '<span class="pill bad">&#10007;</span>'}</td></tr>`).join("")}</tbody></table></div></div>`;
        bg.querySelector("[data-x=no]").addEventListener("click", () => bg.remove());
        document.body.appendChild(bg);
      }));
      document.getElementById("btnCsv1").addEventListener("click", async () => { const r = await Admin.guard(() => API.adminExport(Admin.token, "participants")); Admin.download(r.filename, r.csv, "text/csv"); });
      document.getElementById("btnCsv2").addEventListener("click", async () => { const r = await Admin.guard(() => API.adminExport(Admin.token, "answers")); Admin.download(r.filename, r.csv, "text/csv"); });
    },

    async colleges(el, q = "") {
      const list = await Admin.guard(() => API.adminInstitutions(Admin.token));
      const shown = list.filter((n) => !q || n.toLowerCase().includes(q.toLowerCase()));
      el.innerHTML = `<div class="stack">
        <div class="row between"><div><h2>${list.length} medical colleges</h2><span class="small muted">These appear in the registration drop-down, alphabetically. Doctors can also choose "Other" and type a name.</span></div>
          <form class="row" id="addInst"><input class="input" id="instNew" placeholder="Add a college, e.g. Thakurgaon Medical College, Thakurgaon" style="min-width:300px" required><button class="btn sm primary" type="submit">Add</button></form></div>
        <div class="row between"><input class="input" id="instSearch" placeholder="Filter list" value="${esc(q)}" style="max-width:280px"><button class="btn sm" id="instReset">Restore default list</button></div>
        <div class="table-wrap"><table><thead><tr><th>#</th><th>Medical college</th><th></th></tr></thead><tbody>
          ${shown.map((n, i) => `<tr><td class="num">${i + 1}</td><td>${esc(n)}</td><td class="actions"><button class="btn sm danger" data-rm="${esc(n)}">Remove</button></td></tr>`).join("") || `<tr><td colspan="3" class="muted">No match.</td></tr>`}
        </tbody></table></div></div>`;
      const save = async (next) => { await Admin.guard(() => API.adminSaveInstitutions(Admin.token, next)); settings = await API.getSettings(); Admin.colleges(el, document.getElementById("instSearch").value); };
      document.getElementById("addInst").addEventListener("submit", async (e) => { e.preventDefault(); const v = document.getElementById("instNew").value.trim(); if (!v) return; if (list.some((n) => n.toLowerCase() === v.toLowerCase())) { toast("Already in the list"); return; } await save([...list, v]); toast("Added"); });
      let st; document.getElementById("instSearch").addEventListener("input", (e) => { clearTimeout(st); st = setTimeout(() => Admin.colleges(el, e.target.value), 250); });
      el.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", async () => { if (await confirmBox({ title: "Remove this college?", body: b.dataset.rm + " will no longer appear in the drop-down. Existing registrations keep their value.", okText: "Remove", danger: true })) { await save(list.filter((n) => n !== b.dataset.rm)); toast("Removed"); } }));
      document.getElementById("instReset").addEventListener("click", async () => { if (await confirmBox({ title: "Restore the default list?", body: "Your additions and removals will be replaced by the built-in list of 112 colleges.", okText: "Restore" })) { await save(null); toast("Default list restored"); } });
    },

    async settings(el) {
      const s = await Admin.guard(() => API.adminSettings(Admin.token));
      const toLocal = (ms) => { if (!ms) return ""; const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
      el.innerHTML = `<div class="stack">
        <form class="card stack" id="setForm"><h2>Quiz settings</h2>
          <div class="grid-2">
            <div class="field"><label for="s_name">Campaign name</label><input class="input" id="s_name" value="${esc(s.campaignName)}"></div>
            <div class="field"><label for="s_sponsor">Brand line</label><input class="input" id="s_sponsor" value="${esc(s.sponsor)}"></div>
            <div class="field"><label for="s_dur">Duration (minutes)</label><input class="input" id="s_dur" type="number" min="1" max="120" value="${Math.round(s.durationSec / 60)}"></div>
            <div class="field"><label for="s_count">Questions per attempt</label><input class="input" id="s_count" type="number" min="1" max="200" value="${s.questionCount}"><span class="hint">If fewer active questions exist, all of them are used.</span></div>
            <div class="field"><label for="s_open">Opens at</label><input class="input" id="s_open" type="datetime-local" value="${toLocal(s.openAt)}"><span class="hint">Leave blank to open immediately.</span></div>
            <div class="field"><label for="s_close">Closes at</label><input class="input" id="s_close" type="datetime-local" value="${toLocal(s.closeAt)}"><span class="hint">Leave blank for no end date.</span></div>
          </div>
          <label class="check"><input type="checkbox" id="s_shuffle" ${s.shuffle ? "checked" : ""}><span>Shuffle question order for every participant</span></label>
          <label class="check"><input type="checkbox" id="s_board" ${s.leaderboardPublic ? "checked" : ""}><span>Ranking board visible to participants</span></label>
          <label class="check"><input type="checkbox" id="s_closed" ${s.manualClosed ? "checked" : ""}><span>Pause registration now (overrides the dates)</span></label>
          <div class="row end"><button class="btn primary" type="submit">Save settings</button></div>
        </form>
        <form class="card stack" id="pwForm"><h2>Admin password</h2>
          <div class="grid-2"><div class="field"><label for="pw_old">Current password</label><input class="input" type="password" id="pw_old" required></div><div class="field"><label for="pw_new">New password</label><input class="input" type="password" id="pw_new" minlength="8" required></div></div>
          <div class="row end"><button class="btn" type="submit">Change password</button></div></form>
        <div class="card stack"><h2>Danger zone</h2><p class="muted small">Deletes every participant and their answers. Questions and settings stay. Use before going live to clear test entries.</p><div><button class="btn danger" id="btnReset">Clear all participants</button></div></div>
      </div>`;
      document.getElementById("setForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const g = (id) => document.getElementById(id);
        const payload = { campaignName: g("s_name").value.trim() || "Battle of Interns", sponsor: g("s_sponsor").value.trim(), durationSec: Math.max(60, Number(g("s_dur").value) * 60), questionCount: Math.max(1, Number(g("s_count").value)), openAt: g("s_open").value ? new Date(g("s_open").value).getTime() : null, closeAt: g("s_close").value ? new Date(g("s_close").value).getTime() : null, shuffle: g("s_shuffle").checked, leaderboardPublic: g("s_board").checked, manualClosed: g("s_closed").checked };
        await Admin.guard(() => API.adminSaveSettings(Admin.token, payload)); toast("Settings saved"); settings = await API.getSettings(); Admin.render();
      });
      document.getElementById("pwForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        await Admin.guard(() => API.adminChangePassword(Admin.token, document.getElementById("pw_old").value, document.getElementById("pw_new").value)); toast("Password changed"); e.target.reset();
      });
      document.getElementById("btnReset").addEventListener("click", async () => {
        if (await confirmBox({ title: "Clear all participants?", body: "This cannot be undone. Export the data first if you need it.", okText: "Clear everything", danger: true })) { await Admin.guard(() => API.adminReset(Admin.token)); store.del("boi_token"); toast("Participants cleared"); Admin.tab = "overview"; Admin.render(); }
      });
    },

    async download(filename, text, type) {
      try {
        if (window.claude && window.claude.use) {
          const dl = await window.claude.use("downloads");
          if (dl) { await dl.save({ filename, data: new Blob([text], { type }) }); return; }
        }
      } catch (e) { /* viewer declined; fall through */ }
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
  };

  route();
})();
