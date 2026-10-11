/* Demo adapter: same functions as api-remote.js, but everything is kept in this browser's
   localStorage. Used only for the standalone demo page. Nothing is sent anywhere. */
window.BOI_API = (function () {
  "use strict";
  const KEY = "boi_demo_v2";
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120));
  const fail = (m) => { throw new Error(m); };
  const norm = (s) => String(s || "").trim();
  const normBmdc = (s) => norm(s).toUpperCase().replace(/\s+/g, "").replace(/^([A-Z]+)-?(\d+)$/, "$1-$2");
  const normPhone = (s) => norm(s).replace(/[\s-]/g, "").replace(/^\+?88/, "");

  function seed() {
    const questions = (window.BOI_SEED_QUESTIONS || []).map((q, i) => ({ id: "q" + (i + 1), text: q.text, options: q.options, correct: q.correct, explanation: q.explanation, active: true }));
    const db = {
      settings: { campaignName: "Battle of Interns", sponsor: "Moxaclav", durationSec: 600, questionCount: 30, shuffle: true, leaderboardPublic: true, manualClosed: false, openAt: null, closeAt: null },
      adminPassword: "admin123", questions, participants: [], attempts: [],
    };
    // A few sample finishers so the ranking board is not empty in the demo. Admin > Settings > Clear all participants removes them.
    const samples = [["Dr. Tanvir Ahmed", "Dhaka Medical College Hospital", 27, 412], ["Dr. Nusrat Jahan", "Sir Salimullah Medical College", 26, 388], ["Dr. Rafiul Islam", "Chittagong Medical College", 26, 455], ["Dr. Farhana Haque", "Mymensingh Medical College", 24, 501], ["Dr. Sabbir Hossain", "Rajshahi Medical College", 22, 530], ["Dr. Mehzabin Chowdhury", "Sylhet MAG Osmani Medical College", 19, 572]];
    samples.forEach(([name, inst, score, secs], i) => {
      const pid = "sample" + i, now = Date.now() - (i + 1) * 3600 * 1000;
      db.participants.push({ id: pid, token: "t_" + pid, name, email: "sample" + (i + 1) + "@example.com", bmdc: "A-" + (100001 + i), phone: "017000000" + (10 + i), institution: inst + " (sample)", registeredAt: now });
      const order = questions.map((q) => q.id);
      const answers = {}; let wrongLeft = order.length - score;
      order.forEach((qid) => { const q = questions.find((x) => x.id === qid); if (wrongLeft > 0 && Math.random() < 0.35) { answers[qid] = ["A", "B", "C", "D"].find((k) => k !== q.correct); wrongLeft--; } else answers[qid] = q.correct; });
      // adjust if randomness left too few wrongs
      for (const qid of order) { if (wrongLeft <= 0) break; const q = questions.find((x) => x.id === qid); if (answers[qid] === q.correct) { answers[qid] = ["A", "B", "C", "D"].find((k) => k !== q.correct); wrongLeft--; } }
      const a = { id: "a_" + pid, participantId: pid, startedAt: now, endsAt: now + 600000, order, answers, tabSwitches: i === 4 ? 5 : 0, status: "completed", submittedAt: now + secs * 1000 };
      Object.assign(a, scoreAttempt(db, a));
      db.attempts.push(a);
    });
    return db;
  }
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.questions) return s; } catch (e) {} const db = seed(); save(db); return db; }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

  function status(s) {
    const now = Date.now();
    if (s.manualClosed) return "closed";
    if (s.openAt && now < s.openAt) return "not_started";
    if (s.closeAt && now >= s.closeAt) return "closed";
    return "open";
  }
  function publicSettings(db) { const s = db.settings; return { campaignName: s.campaignName, sponsor: s.sponsor, durationSec: s.durationSec, questionCount: Math.min(s.questionCount, db.questions.filter((q) => q.active).length) || s.questionCount, leaderboardPublic: s.leaderboardPublic, status: status(s), demo: true }; }
  function scoreAttempt(db, a) {
    let correct = 0, wrong = 0, skipped = 0;
    for (const qid of a.order) { const q = db.questions.find((x) => x.id === qid); const ans = a.answers[qid]; if (!ans) skipped++; else if (q && ans === q.correct) correct++; else wrong++; }
    const timeTakenSec = Math.min(Math.round((a.submittedAt - a.startedAt) / 1000), Math.round((a.endsAt - a.startedAt) / 1000));
    return { score: correct, correct, wrong, skipped, total: a.order.length, timeTakenSec };
  }
  function ranked(db) {
    return db.attempts.filter((a) => a.status === "completed").sort((x, y) => y.score - x.score || x.timeTakenSec - y.timeTakenSec || x.submittedAt - y.submittedAt)
      .map((a, i) => ({ a, p: db.participants.find((p) => p.id === a.participantId), rank: i + 1 }));
  }
  function result(db, a, p) {
    const r = ranked(db).find((x) => x.a.id === a.id);
    const review = a.order.map((qid, i) => { const q = db.questions.find((x) => x.id === qid) || { text: "(question removed)", options: {}, correct: "", explanation: "" }; const ya = a.answers[qid] || null; return { number: i + 1, id: qid, text: q.text, options: ["A", "B", "C", "D"].filter((k) => q.options[k]).map((k) => ({ key: k, text: q.options[k] })), correct: q.correct, yourAnswer: ya, isCorrect: ya === q.correct, explanation: q.explanation }; });
    return { completed: true, name: p.name, score: a.score, total: a.total, correct: a.correct, wrong: a.wrong, skipped: a.skipped, timeTakenSec: a.timeTakenSec, rank: r ? r.rank : null, totalParticipants: db.attempts.filter((x) => x.status === "completed").length, review };
  }
  function pByToken(db, token) { const p = db.participants.find((x) => x.token === token); if (!p) fail("Registration not found. Please register again."); return p; }
  function adminCheck(db, token) { if (!token || token !== db._adminToken) fail("Unauthorised. Please sign in."); }
  const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

  return {
    async getSettings() { return delay(publicSettings(load())); },

    async register(d) {
      const db = load();
      if (status(db.settings) !== "open") fail("Registration is closed.");
      const bmdc = normBmdc(d.bmdc), phone = normPhone(d.phone), email = norm(d.email).toLowerCase();
      const existing = db.participants.find((p) => p.bmdc === bmdc || p.email === email || p.phone === phone);
      if (existing) {
        const a = db.attempts.find((x) => x.participantId === existing.id);
        if (a && a.status === "completed") fail("This BMDC number, phone or email has already completed the quiz. Only one attempt is allowed.");
        if (existing.bmdc === bmdc && existing.phone === phone) return delay({ token: existing.token, resumed: true });
        fail("These details are already registered. Use the same device you started on, or contact the organisers.");
      }
      const p = { id: uid(), token: "t_" + uid(), name: norm(d.name), email, bmdc, phone, institution: norm(d.institution), registeredAt: Date.now() };
      db.participants.push(p); save(db);
      return delay({ token: p.token, resumed: false });
    },

    async startAttempt(token) {
      const db = load(); const p = pByToken(db, token);
      let a = db.attempts.find((x) => x.participantId === p.id);
      if (a && a.status === "completed") fail("You have already completed the quiz.");
      if (!a) {
        const active = db.questions.filter((q) => q.active);
        if (!active.length) fail("No questions are available yet.");
        let order = active.map((q) => q.id);
        if (db.settings.shuffle) order.sort(() => Math.random() - 0.5);
        order = order.slice(0, db.settings.questionCount);
        const now = Date.now();
        a = { id: uid(), participantId: p.id, startedAt: now, endsAt: now + db.settings.durationSec * 1000, order, answers: {}, tabSwitches: 0, status: "in_progress" };
        db.attempts.push(a); save(db);
      }
      const questions = a.order.map((qid) => { const q = db.questions.find((x) => x.id === qid); return { id: qid, text: q ? q.text : "(removed)", options: q ? ["A", "B", "C", "D"].filter((k) => q.options[k]).map((k) => ({ key: k, text: q.options[k] })) : [] }; });
      return delay({ attemptId: a.id, startedAt: a.startedAt, endsAt: a.endsAt, durationSec: db.settings.durationSec, questions, answers: a.answers, tabSwitches: a.tabSwitches, serverNow: Date.now() });
    },

    async saveProgress(token, { answers, tabSwitches }) {
      const db = load(); const p = pByToken(db, token); const a = db.attempts.find((x) => x.participantId === p.id && x.status === "in_progress");
      if (!a) return { ok: true };
      a.answers = Object.assign({}, a.answers, answers || {}); a.tabSwitches = Math.max(a.tabSwitches, tabSwitches || 0); save(db); return { ok: true };
    },

    async submitAttempt(token, { answers, tabSwitches }) {
      const db = load(); const p = pByToken(db, token); const a = db.attempts.find((x) => x.participantId === p.id);
      if (!a) fail("No attempt found.");
      if (a.status !== "completed") {
        a.answers = Object.assign({}, a.answers, answers || {}); a.tabSwitches = Math.max(a.tabSwitches, tabSwitches || 0);
        a.submittedAt = Date.now(); a.status = "completed"; Object.assign(a, scoreAttempt(db, a)); save(db);
      }
      return delay(result(db, a, p));
    },

    async getResult(token) {
      const db = load(); const p = pByToken(db, token); const a = db.attempts.find((x) => x.participantId === p.id);
      if (!a || a.status !== "completed") return { completed: false };
      return delay(result(db, a, p));
    },

    async getLeaderboard(token) {
      const db = load();
      if (!db.settings.leaderboardPublic && !db._adminToken) fail("The ranking board is not public.");
      const me = token ? db.participants.find((p) => p.token === token) : null;
      const all = ranked(db);
      const rows = all.slice(0, 50).map((x) => ({ rank: x.rank, name: x.p.name, institution: x.p.institution, score: x.a.score, total: x.a.total, timeTakenSec: x.a.timeTakenSec, isMe: !!me && x.p.id === me.id }));
      const mine = me ? all.find((x) => x.p.id === me.id) : null;
      return delay({ rows, totalParticipants: all.length, me: mine ? { rank: mine.rank, name: me.name, score: mine.a.score, total: mine.a.total, timeTakenSec: mine.a.timeTakenSec } : null });
    },

    /* ---- admin ---- */
    async adminLogin(password) { const db = load(); if (password !== db.adminPassword) fail("Wrong password."); db._adminToken = "adm_" + uid(); save(db); return delay({ adminToken: db._adminToken }); },
    async adminLogout() { const db = load(); delete db._adminToken; save(db); },
    async adminStats(t) {
      const db = load(); adminCheck(db, t);
      const done = db.attempts.filter((a) => a.status === "completed");
      const qs = db.questions.map((q) => { let attempts = 0, correct = 0; done.forEach((a) => { if (a.order.includes(q.id)) { attempts++; if (a.answers[q.id] === q.correct) correct++; } }); return { id: q.id, text: q.text, attempts, correct }; });
      return delay({ participants: db.participants.length, completed: done.length, inProgress: db.attempts.length - done.length, total: Math.min(db.settings.questionCount, db.questions.filter((q) => q.active).length), avgScore: done.length ? done.reduce((s, a) => s + a.score, 0) / done.length : 0, avgTimeSec: done.length ? done.reduce((s, a) => s + a.timeTakenSec, 0) / done.length : 0, questionStats: qs });
    },
    async adminQuestions(t) { const db = load(); adminCheck(db, t); return delay(db.questions.map((q) => ({ ...q }))); },
    async adminSaveQuestion(t, q) {
      const db = load(); adminCheck(db, t);
      if (!q.text || !["A", "B", "C", "D"].every((k) => q.options[k]) || !/^[ABCD]$/.test(q.correct)) fail("Fill in the question, all four options and the correct option.");
      if (q.id) { const i = db.questions.findIndex((x) => x.id === q.id); if (i < 0) fail("Question not found."); db.questions[i] = { ...db.questions[i], text: q.text, options: q.options, correct: q.correct, explanation: q.explanation || "", active: !!q.active }; }
      else db.questions.push({ id: "q_" + uid(), text: q.text, options: q.options, correct: q.correct, explanation: q.explanation || "", active: q.active !== false });
      save(db); return { ok: true };
    },
    async adminDeleteQuestion(t, id) { const db = load(); adminCheck(db, t); db.questions = db.questions.filter((q) => q.id !== id); save(db); return { ok: true }; },
    async adminImportQuestions(t, list, replace) {
      const db = load(); adminCheck(db, t);
      if (replace) db.questions = [];
      list.forEach((q) => db.questions.push({ id: "q_" + uid(), text: q.text, options: q.options, correct: q.correct, explanation: q.explanation || "", active: true }));
      save(db); return { count: list.length };
    },
    async adminParticipants(t, { q } = {}) {
      const db = load(); adminCheck(db, t); const s = (q || "").toLowerCase();
      return delay(db.participants.filter((p) => !s || [p.name, p.bmdc, p.phone, p.email, p.institution].some((v) => String(v || "").toLowerCase().includes(s)))
        .sort((a, b) => b.registeredAt - a.registeredAt)
        .map((p) => { const a = db.attempts.find((x) => x.participantId === p.id); return { id: p.id, name: p.name, email: p.email, bmdc: p.bmdc, phone: p.phone, institution: p.institution, registeredAt: p.registeredAt, status: a ? a.status : "registered", score: a && a.score, total: a && a.total, timeTakenSec: a && a.timeTakenSec, tabSwitches: a ? a.tabSwitches : 0, submittedAt: a && a.submittedAt }; }));
    },
    async adminParticipantAnswers(t, id) {
      const db = load(); adminCheck(db, t); const a = db.attempts.find((x) => x.participantId === id); if (!a) fail("No attempt.");
      return delay(a.order.map((qid) => { const q = db.questions.find((x) => x.id === qid) || { text: "(removed)", correct: "" }; return { text: q.text, answer: a.answers[qid] || null, correct: q.correct, isCorrect: a.answers[qid] === q.correct }; }));
    },
    async adminDeleteParticipant(t, id) { const db = load(); adminCheck(db, t); db.participants = db.participants.filter((p) => p.id !== id); db.attempts = db.attempts.filter((a) => a.participantId !== id); save(db); return { ok: true }; },
    async adminExport(t, kind) {
      const db = load(); adminCheck(db, t); const stamp = new Date().toISOString().slice(0, 10);
      if (kind === "answers") {
        const rows = [["name", "bmdc", "question_no", "question", "answer", "correct_option", "is_correct"]];
        db.attempts.filter((a) => a.status === "completed").forEach((a) => { const p = db.participants.find((x) => x.id === a.participantId); a.order.forEach((qid, i) => { const q = db.questions.find((x) => x.id === qid) || { text: "", correct: "" }; rows.push([p.name, p.bmdc, i + 1, q.text, a.answers[qid] || "", q.correct, a.answers[qid] === q.correct ? 1 : 0]); }); });
        return { filename: `battle-of-interns-answers-${stamp}.csv`, csv: csv(rows) };
      }
      const rows = [["rank", "name", "bmdc", "phone", "email", "institution", "registered_at", "status", "score", "total", "time_taken_sec", "tab_switches", "submitted_at"]];
      const rk = ranked(db);
      db.participants.forEach((p) => { const a = db.attempts.find((x) => x.participantId === p.id); const r = rk.find((x) => x.p.id === p.id); rows.push([r ? r.rank : "", p.name, p.bmdc, p.phone, p.email, p.institution, new Date(p.registeredAt).toISOString(), a ? a.status : "registered", a && a.score != null ? a.score : "", a && a.total ? a.total : "", a && a.timeTakenSec != null ? a.timeTakenSec : "", a ? a.tabSwitches : 0, a && a.submittedAt ? new Date(a.submittedAt).toISOString() : ""]); });
      return { filename: `battle-of-interns-participants-${stamp}.csv`, csv: csv(rows) };
    },
    async adminSettings(t) { const db = load(); adminCheck(db, t); return delay({ ...db.settings }); },
    async adminSaveSettings(t, s) { const db = load(); adminCheck(db, t); db.settings = { ...db.settings, ...s }; save(db); return { ok: true }; },
    async adminChangePassword(t, oldPw, newPw) { const db = load(); adminCheck(db, t); if (oldPw !== db.adminPassword) fail("Current password is wrong."); if ((newPw || "").length < 8) fail("New password must be at least 8 characters."); db.adminPassword = newPw; save(db); return { ok: true }; },
    async adminReset(t) { const db = load(); adminCheck(db, t); db.participants = []; db.attempts = []; save(db); return { ok: true }; },
  };
})();
