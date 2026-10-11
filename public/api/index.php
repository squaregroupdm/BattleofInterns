<?php
/* Battle of Interns API. Single file, PHP 8+, SQLite (PDO). Called as api/index.php?r=<route> with a JSON body.
   Scoring, the timer and the one-attempt rule are all enforced here, never in the browser. */
declare(strict_types=1);

$CFG = require __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (!empty($CFG['cors_origins'])) {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, $CFG['cors_origins'], true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
    }
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }
}

function out(array $data, int $code = 200): never { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function fail(string $msg, int $code = 400): never { out(['error' => $msg], $code); }
function now_ms(): int { return (int) round(microtime(true) * 1000); }
function uid(): string { return bin2hex(random_bytes(8)); }
function s(mixed $v): string { return trim((string) ($v ?? '')); }

/* ---------- database ---------- */
function db(): PDO {
    static $pdo = null;
    global $CFG;
    if ($pdo) return $pdo;
    $dir = dirname($CFG['db_path']);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $fresh = !file_exists($CFG['db_path']);
    try { $pdo = new PDO('sqlite:' . $CFG['db_path']); }
    catch (Throwable $e) { fail('Database not writable. Check the data folder permissions.', 500); }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    $pdo->exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, text TEXT NOT NULL, opt_a TEXT, opt_b TEXT, opt_c TEXT, opt_d TEXT, correct TEXT NOT NULL, explanation TEXT, active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0, created_at INTEGER);
        CREATE TABLE IF NOT EXISTS participants (id TEXT PRIMARY KEY, token TEXT UNIQUE, name TEXT, email TEXT, bmdc TEXT, phone TEXT, institution TEXT, registered_at INTEGER);
        CREATE INDEX IF NOT EXISTS idx_p_bmdc ON participants(bmdc); CREATE INDEX IF NOT EXISTS idx_p_email ON participants(email); CREATE INDEX IF NOT EXISTS idx_p_phone ON participants(phone);
        CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, participant_id TEXT UNIQUE REFERENCES participants(id) ON DELETE CASCADE, started_at INTEGER, ends_at INTEGER, order_json TEXT, answers_json TEXT, tab_switches INTEGER DEFAULT 0, status TEXT, submitted_at INTEGER, score INTEGER, total INTEGER, correct INTEGER, wrong INTEGER, skipped INTEGER, time_taken_sec INTEGER, late INTEGER DEFAULT 0);
        CREATE INDEX IF NOT EXISTS idx_a_rank ON attempts(status, score, time_taken_sec, submitted_at);');
    if ($fresh || !setting('admin_hash')) { seed($pdo); }
    return $pdo;
}
function seed(PDO $pdo): void {
    global $CFG;
    $defaults = ['campaignName' => 'Battle of Interns', 'sponsor' => 'Moxaclav', 'durationSec' => 600, 'questionCount' => 30, 'shuffle' => true, 'leaderboardPublic' => true, 'manualClosed' => false, 'openAt' => null, 'closeAt' => null];
    foreach ($defaults as $k => $v) { set_setting($k, $v, $pdo); }
    set_setting('admin_hash', password_hash($CFG['initial_admin_password'], PASSWORD_DEFAULT), $pdo);
    if ((int) $pdo->query('SELECT COUNT(*) FROM questions')->fetchColumn() === 0 && is_file($CFG['seed_file'])) {
        $list = json_decode((string) file_get_contents($CFG['seed_file']), true) ?: [];
        $st = $pdo->prepare('INSERT INTO questions (id,text,opt_a,opt_b,opt_c,opt_d,correct,explanation,active,sort,created_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)');
        foreach ($list as $i => $q) {
            $st->execute([uid(), $q['text'], $q['options']['A'] ?? '', $q['options']['B'] ?? '', $q['options']['C'] ?? '', $q['options']['D'] ?? '', $q['correct'], $q['explanation'] ?? '', $i, now_ms()]);
        }
    }
}
$SETTINGS_CACHE = null;
function setting(string $k, mixed $default = null): mixed {
    global $SETTINGS_CACHE;
    if ($SETTINGS_CACHE === null) { $SETTINGS_CACHE = []; foreach (db()->query('SELECT key, value FROM settings') as $r) { $SETTINGS_CACHE[$r['key']] = json_decode((string) $r['value'], true); } }
    return array_key_exists($k, $SETTINGS_CACHE) ? $SETTINGS_CACHE[$k] : $default;
}
function set_setting(string $k, mixed $v, ?PDO $pdo = null): void {
    global $SETTINGS_CACHE;
    ($pdo ?? db())->prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')->execute([$k, json_encode($v)]);
    if (is_array($SETTINGS_CACHE)) $SETTINGS_CACHE[$k] = $v;
}
function all_settings(): array {
    $out = []; foreach (db()->query('SELECT key, value FROM settings') as $r) { if ($r['key'] !== 'admin_hash') $out[$r['key']] = json_decode((string) $r['value'], true); } return $out;
}
function quiz_status(): string {
    $now = now_ms();
    if (setting('manualClosed')) return 'closed';
    if (setting('openAt') && $now < (int) setting('openAt')) return 'not_started';
    if (setting('closeAt') && $now >= (int) setting('closeAt')) return 'closed';
    return 'open';
}
function active_count(): int { return (int) db()->query('SELECT COUNT(*) FROM questions WHERE active=1')->fetchColumn(); }
function public_settings(): array {
    $qc = (int) setting('questionCount', 30); $ac = active_count();
    return ['campaignName' => setting('campaignName'), 'sponsor' => setting('sponsor'), 'durationSec' => (int) setting('durationSec', 600), 'questionCount' => $ac ? min($qc, $ac) : $qc, 'leaderboardPublic' => (bool) setting('leaderboardPublic'), 'status' => quiz_status(), 'demo' => false];
}
function q_row_to_arr(array $r): array {
    return ['id' => $r['id'], 'text' => $r['text'], 'options' => ['A' => $r['opt_a'], 'B' => $r['opt_b'], 'C' => $r['opt_c'], 'D' => $r['opt_d']], 'correct' => $r['correct'], 'explanation' => $r['explanation'], 'active' => (bool) $r['active']];
}
function questions_by_id(array $ids): array {
    if (!$ids) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    $st = db()->prepare("SELECT * FROM questions WHERE id IN ($in)"); $st->execute($ids);
    $m = []; foreach ($st as $r) { $m[$r['id']] = q_row_to_arr($r); } return $m;
}
function norm_bmdc(string $v): string { $v = strtoupper(preg_replace('/\s+/', '', $v)); return preg_replace('/^([A-Z]+)-?(\d+)$/', '$1-$2', $v); }
function norm_phone(string $v): string { $v = preg_replace('/[\s\-]/', '', $v); return preg_replace('/^\+?88/', '', $v); }

/* ---------- participants ---------- */
function participant_by_token(string $token): array {
    $st = db()->prepare('SELECT * FROM participants WHERE token=?'); $st->execute([$token]);
    $p = $st->fetch(PDO::FETCH_ASSOC); if (!$p) fail('Registration not found. Please register again.', 404); return $p;
}
function attempt_of(string $pid): ?array {
    $st = db()->prepare('SELECT * FROM attempts WHERE participant_id=?'); $st->execute([$pid]); $a = $st->fetch(PDO::FETCH_ASSOC); return $a ?: null;
}
function score_attempt(array $a): array {
    $order = json_decode($a['order_json'], true) ?: []; $answers = json_decode($a['answers_json'] ?: '{}', true) ?: [];
    $qs = questions_by_id($order); $c = $w = $sk = 0;
    foreach ($order as $qid) { $ans = $answers[$qid] ?? null; if (!$ans) $sk++; elseif (isset($qs[$qid]) && $ans === $qs[$qid]['correct']) $c++; else $w++; }
    $dur = (int) round(($a['ends_at'] - $a['started_at']) / 1000);
    $tt = min((int) round(($a['submitted_at'] - $a['started_at']) / 1000), $dur);
    return ['score' => $c, 'correct' => $c, 'wrong' => $w, 'skipped' => $sk, 'total' => count($order), 'time_taken_sec' => max(0, $tt)];
}
function rank_of(string $attemptId): ?int {
    $st = db()->prepare("SELECT score, time_taken_sec, submitted_at FROM attempts WHERE id=? AND status='completed'"); $st->execute([$attemptId]); $a = $st->fetch(PDO::FETCH_ASSOC); if (!$a) return null;
    $st = db()->prepare("SELECT COUNT(*) FROM attempts WHERE status='completed' AND (score > ? OR (score = ? AND time_taken_sec < ?) OR (score = ? AND time_taken_sec = ? AND submitted_at < ?))");
    $st->execute([$a['score'], $a['score'], $a['time_taken_sec'], $a['score'], $a['time_taken_sec'], $a['submitted_at']]);
    return (int) $st->fetchColumn() + 1;
}
function result_payload(array $a, array $p): array {
    $order = json_decode($a['order_json'], true) ?: []; $answers = json_decode($a['answers_json'] ?: '{}', true) ?: []; $qs = questions_by_id($order);
    $review = []; $n = 0;
    foreach ($order as $qid) {
        $n++; $q = $qs[$qid] ?? ['text' => '(question removed)', 'options' => [], 'correct' => '', 'explanation' => '']; $ya = $answers[$qid] ?? null;
        $opts = []; foreach (['A', 'B', 'C', 'D'] as $k) { if (!empty($q['options'][$k])) $opts[] = ['key' => $k, 'text' => $q['options'][$k]]; }
        $review[] = ['number' => $n, 'id' => $qid, 'text' => $q['text'], 'options' => $opts, 'correct' => $q['correct'], 'yourAnswer' => $ya, 'isCorrect' => $ya !== null && $ya === $q['correct'], 'explanation' => $q['explanation']];
    }
    $total = (int) db()->query("SELECT COUNT(*) FROM attempts WHERE status='completed'")->fetchColumn();
    return ['completed' => true, 'name' => $p['name'], 'score' => (int) $a['score'], 'total' => (int) $a['total'], 'correct' => (int) $a['correct'], 'wrong' => (int) $a['wrong'], 'skipped' => (int) $a['skipped'], 'timeTakenSec' => (int) $a['time_taken_sec'], 'rank' => rank_of($a['id']), 'totalParticipants' => $total, 'review' => $review];
}

/* ---------- admin auth ---------- */
function admin_token_make(): string {
    global $CFG; $exp = time() + (int) $CFG['admin_session_seconds'];
    $sig = hash_hmac('sha256', (string) $exp, $CFG['secret'] . setting('admin_hash'));
    return $exp . '.' . $sig;
}
function require_admin(): void {
    global $CFG; $t = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    $parts = explode('.', $t);
    if (count($parts) !== 2 || (int) $parts[0] < time()) fail('Unauthorised. Please sign in.', 401);
    $sig = hash_hmac('sha256', $parts[0], $CFG['secret'] . setting('admin_hash'));
    if (!hash_equals($sig, $parts[1])) fail('Unauthorised. Please sign in.', 401);
}
function csv_line(array $cells): string {
    return implode(',', array_map(fn($v) => preg_match('/[",\n]/', (string) $v) ? '"' . str_replace('"', '""', (string) $v) . '"' : (string) $v, $cells)) . "\r\n";
}

/* ---------- routing ---------- */
$route = $_GET['r'] ?? '';
$in = json_decode((string) file_get_contents('php://input'), true) ?: [];
db();

switch ($route) {
    case 'settings':
        out(public_settings());

    case 'register': {
        if (quiz_status() !== 'open') fail('Registration is closed.');
        $name = s($in['name'] ?? ''); $email = strtolower(s($in['email'] ?? '')); $bmdc = norm_bmdc(s($in['bmdc'] ?? '')); $phone = norm_phone(s($in['phone'] ?? '')); $inst = s($in['institution'] ?? '');
        if (mb_strlen($name) < 3) fail('Enter your full name.');
        if (!preg_match('/^[A-Z]{1,2}-\d{3,7}$/', $bmdc)) fail('Enter a valid BMDC number, e.g. A-123456.');
        if (!preg_match('/^01[3-9]\d{8}$/', $phone)) fail('Enter an 11-digit Bangladeshi mobile number.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address.');
        if (empty($in['consent'])) fail('Please tick the consent box to continue.');
        $st = db()->prepare('SELECT * FROM participants WHERE bmdc=? OR email=? OR phone=? LIMIT 1'); $st->execute([$bmdc, $email, $phone]);
        if ($ex = $st->fetch(PDO::FETCH_ASSOC)) {
            $a = attempt_of($ex['id']);
            if ($a && $a['status'] === 'completed') fail('This BMDC number, phone or email has already completed the quiz. Only one attempt is allowed.');
            if ($ex['bmdc'] === $bmdc && $ex['phone'] === $phone) out(['token' => $ex['token'], 'resumed' => true]);
            fail('These details are already registered. Use the same device you started on, or contact the organisers.');
        }
        $id = uid(); $token = 't_' . bin2hex(random_bytes(16));
        db()->prepare('INSERT INTO participants (id,token,name,email,bmdc,phone,institution,registered_at) VALUES (?,?,?,?,?,?,?,?)')->execute([$id, $token, mb_substr($name, 0, 80), $email, $bmdc, $phone, mb_substr($inst, 0, 120), now_ms()]);
        out(['token' => $token, 'resumed' => false]);
    }

    case 'start': {
        $p = participant_by_token(s($in['token'] ?? '')); $a = attempt_of($p['id']);
        if ($a && $a['status'] === 'completed') fail('You have already completed the quiz.');
        if (!$a) {
            $ids = db()->query('SELECT id FROM questions WHERE active=1 ORDER BY sort, created_at')->fetchAll(PDO::FETCH_COLUMN);
            if (!$ids) fail('No questions are available yet.');
            if (setting('shuffle', true)) shuffle($ids);
            $ids = array_slice($ids, 0, max(1, (int) setting('questionCount', 30)));
            $now = now_ms(); $dur = (int) setting('durationSec', 600);
            $a = ['id' => uid(), 'participant_id' => $p['id'], 'started_at' => $now, 'ends_at' => $now + $dur * 1000, 'order_json' => json_encode(array_values($ids)), 'answers_json' => '{}', 'tab_switches' => 0, 'status' => 'in_progress'];
            db()->prepare('INSERT INTO attempts (id,participant_id,started_at,ends_at,order_json,answers_json,tab_switches,status) VALUES (?,?,?,?,?,?,?,?)')->execute([$a['id'], $a['participant_id'], $a['started_at'], $a['ends_at'], $a['order_json'], $a['answers_json'], 0, 'in_progress']);
        }
        $order = json_decode($a['order_json'], true) ?: []; $qs = questions_by_id($order); $list = [];
        foreach ($order as $qid) {
            $q = $qs[$qid] ?? null; $opts = [];
            if ($q) foreach (['A', 'B', 'C', 'D'] as $k) { if (!empty($q['options'][$k])) $opts[] = ['key' => $k, 'text' => $q['options'][$k]]; }
            $list[] = ['id' => $qid, 'text' => $q ? $q['text'] : '(removed)', 'options' => $opts]; // correct answers never leave the server
        }
        out(['attemptId' => $a['id'], 'startedAt' => (int) $a['started_at'], 'endsAt' => (int) $a['ends_at'], 'durationSec' => (int) setting('durationSec', 600), 'questions' => $list, 'answers' => json_decode($a['answers_json'] ?: '{}', true) ?: new stdClass(), 'tabSwitches' => (int) $a['tab_switches'], 'serverNow' => now_ms()]);
    }

    case 'progress':
    case 'submit': {
        global $CFG;
        $p = participant_by_token(s($in['token'] ?? '')); $a = attempt_of($p['id']);
        if (!$a) fail('No attempt found. Please start the quiz first.');
        if ($a['status'] === 'completed') { if ($route === 'submit') out(result_payload($a, $p)); out(['ok' => true]); }
        $late = now_ms() > (int) $a['ends_at'] + (int) $CFG['grace_seconds'] * 1000;
        $answers = json_decode($a['answers_json'] ?: '{}', true) ?: [];
        if (!$late) { // answers that arrive after the grace period are ignored; the saved progress is scored instead
            $order = json_decode($a['order_json'], true) ?: [];
            foreach ((array) ($in['answers'] ?? []) as $qid => $k) { if (in_array($qid, $order, true) && preg_match('/^[ABCD]$/', (string) $k)) $answers[$qid] = (string) $k; }
        }
        $tabs = max((int) $a['tab_switches'], (int) ($in['tabSwitches'] ?? 0));
        if ($route === 'progress') { db()->prepare('UPDATE attempts SET answers_json=?, tab_switches=? WHERE id=?')->execute([json_encode($answers, JSON_FORCE_OBJECT), $tabs, $a['id']]); out(['ok' => true]); }
        $a['answers_json'] = json_encode($answers, JSON_FORCE_OBJECT); $a['submitted_at'] = now_ms();
        $sc = score_attempt($a);
        db()->prepare("UPDATE attempts SET answers_json=?, tab_switches=?, status='completed', submitted_at=?, score=?, total=?, correct=?, wrong=?, skipped=?, time_taken_sec=?, late=? WHERE id=?")
            ->execute([$a['answers_json'], $tabs, $a['submitted_at'], $sc['score'], $sc['total'], $sc['correct'], $sc['wrong'], $sc['skipped'], $sc['time_taken_sec'], $late ? 1 : 0, $a['id']]);
        out(result_payload(attempt_of($p['id']), $p));
    }

    case 'result': {
        $p = participant_by_token(s($in['token'] ?? '')); $a = attempt_of($p['id']);
        if (!$a || $a['status'] !== 'completed') out(['completed' => false]);
        out(result_payload($a, $p));
    }

    case 'leaderboard': {
        $isAdmin = false; if (!empty($_SERVER['HTTP_X_ADMIN_TOKEN'])) { $isAdmin = true; }
        if (!setting('leaderboardPublic') && !$isAdmin) fail('The ranking board is not public.', 403);
        $meId = null; if ($t = s($in['token'] ?? '')) { $st = db()->prepare('SELECT id, name FROM participants WHERE token=?'); $st->execute([$t]); if ($m = $st->fetch(PDO::FETCH_ASSOC)) $meId = $m['id']; }
        $rows = []; $i = 0;
        $q = db()->query("SELECT a.id, a.participant_id, a.score, a.total, a.time_taken_sec, p.name, p.institution FROM attempts a JOIN participants p ON p.id=a.participant_id WHERE a.status='completed' ORDER BY a.score DESC, a.time_taken_sec ASC, a.submitted_at ASC LIMIT 50");
        foreach ($q as $r) { $i++; $rows[] = ['rank' => $i, 'name' => $r['name'], 'institution' => $r['institution'], 'score' => (int) $r['score'], 'total' => (int) $r['total'], 'timeTakenSec' => (int) $r['time_taken_sec'], 'isMe' => $meId !== null && $r['participant_id'] === $meId]; }
        $total = (int) db()->query("SELECT COUNT(*) FROM attempts WHERE status='completed'")->fetchColumn();
        $me = null;
        if ($meId) { $a = attempt_of($meId); if ($a && $a['status'] === 'completed') { $me = ['rank' => rank_of($a['id']), 'name' => $m['name'], 'score' => (int) $a['score'], 'total' => (int) $a['total'], 'timeTakenSec' => (int) $a['time_taken_sec']]; } }
        out(['rows' => $rows, 'totalParticipants' => $total, 'me' => $me]);
    }

    /* ---------- admin ---------- */
    case 'admin/login': {
        usleep(300000); // slows down password guessing
        if (!password_verify((string) ($in['password'] ?? ''), (string) setting('admin_hash'))) fail('Wrong password.', 401);
        out(['adminToken' => admin_token_make()]);
    }
    case 'admin/stats': {
        require_admin();
        $done = (int) db()->query("SELECT COUNT(*) FROM attempts WHERE status='completed'")->fetchColumn();
        $agg = db()->query("SELECT AVG(score) s, AVG(time_taken_sec) t FROM attempts WHERE status='completed'")->fetch(PDO::FETCH_ASSOC);
        $stats = []; $qs = db()->query('SELECT * FROM questions ORDER BY sort, created_at')->fetchAll(PDO::FETCH_ASSOC);
        $attempts = db()->query("SELECT order_json, answers_json FROM attempts WHERE status='completed'")->fetchAll(PDO::FETCH_ASSOC);
        $decoded = array_map(fn($a) => [json_decode($a['order_json'], true) ?: [], json_decode($a['answers_json'] ?: '{}', true) ?: []], $attempts);
        foreach ($qs as $q) { $n = $c = 0; foreach ($decoded as [$o, $ans]) { if (in_array($q['id'], $o, true)) { $n++; if (($ans[$q['id']] ?? null) === $q['correct']) $c++; } } $stats[] = ['id' => $q['id'], 'text' => $q['text'], 'attempts' => $n, 'correct' => $c]; }
        $ac = active_count();
        out(['participants' => (int) db()->query('SELECT COUNT(*) FROM participants')->fetchColumn(), 'completed' => $done, 'inProgress' => (int) db()->query("SELECT COUNT(*) FROM attempts WHERE status='in_progress'")->fetchColumn(), 'total' => $ac ? min((int) setting('questionCount', 30), $ac) : (int) setting('questionCount', 30), 'avgScore' => (float) ($agg['s'] ?? 0), 'avgTimeSec' => (float) ($agg['t'] ?? 0), 'questionStats' => $stats]);
    }
    case 'admin/questions': {
        require_admin();
        out(array_map('q_row_to_arr', db()->query('SELECT * FROM questions ORDER BY sort, created_at')->fetchAll(PDO::FETCH_ASSOC)));
    }
    case 'admin/question-save': {
        require_admin();
        $o = (array) ($in['options'] ?? []); $text = s($in['text'] ?? ''); $correct = strtoupper(s($in['correct'] ?? ''));
        if ($text === '' || !preg_match('/^[ABCD]$/', $correct) || count(array_filter(['A', 'B', 'C', 'D'], fn($k) => s($o[$k] ?? '') === ''))) fail('Fill in the question, all four options and the correct option.');
        $vals = [$text, s($o['A']), s($o['B']), s($o['C']), s($o['D']), $correct, s($in['explanation'] ?? ''), empty($in['active']) ? 0 : 1];
        if (!empty($in['id'])) { $st = db()->prepare('UPDATE questions SET text=?, opt_a=?, opt_b=?, opt_c=?, opt_d=?, correct=?, explanation=?, active=? WHERE id=?'); $st->execute([...$vals, $in['id']]); if (!$st->rowCount()) fail('Question not found.', 404); }
        else { $sort = (int) db()->query('SELECT COALESCE(MAX(sort),0)+1 FROM questions')->fetchColumn(); db()->prepare('INSERT INTO questions (id,text,opt_a,opt_b,opt_c,opt_d,correct,explanation,active,sort,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')->execute([uid(), ...$vals, $sort, now_ms()]); }
        out(['ok' => true]);
    }
    case 'admin/question-delete': { require_admin(); db()->prepare('DELETE FROM questions WHERE id=?')->execute([s($in['id'] ?? '')]); out(['ok' => true]); }
    case 'admin/question-import': {
        require_admin(); $list = (array) ($in['questions'] ?? []); $n = 0;
        db()->beginTransaction();
        if (!empty($in['replace'])) db()->exec('DELETE FROM questions');
        $sort = (int) db()->query('SELECT COALESCE(MAX(sort),0) FROM questions')->fetchColumn();
        $st = db()->prepare('INSERT INTO questions (id,text,opt_a,opt_b,opt_c,opt_d,correct,explanation,active,sort,created_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)');
        foreach ($list as $q) {
            $o = (array) ($q['options'] ?? []); $c = strtoupper(s($q['correct'] ?? ''));
            if (s($q['text'] ?? '') === '' || !preg_match('/^[ABCD]$/', $c) || s($o['A'] ?? '') === '' || s($o['B'] ?? '') === '' || s($o['C'] ?? '') === '' || s($o['D'] ?? '') === '') continue;
            $st->execute([uid(), s($q['text']), s($o['A']), s($o['B']), s($o['C']), s($o['D']), $c, s($q['explanation'] ?? ''), ++$sort, now_ms()]); $n++;
        }
        db()->commit(); out(['count' => $n]);
    }
    case 'admin/participants': {
        require_admin(); $q = '%' . strtolower(s($in['q'] ?? '')) . '%';
        $st = db()->prepare("SELECT p.*, a.status, a.score, a.total, a.time_taken_sec, a.tab_switches, a.submitted_at, a.late FROM participants p LEFT JOIN attempts a ON a.participant_id=p.id WHERE lower(p.name) LIKE ? OR lower(p.bmdc) LIKE ? OR p.phone LIKE ? OR lower(p.email) LIKE ? OR lower(COALESCE(p.institution,'')) LIKE ? ORDER BY p.registered_at DESC");
        $st->execute([$q, $q, $q, $q, $q]); $rows = [];
        foreach ($st as $r) { $rows[] = ['id' => $r['id'], 'name' => $r['name'], 'email' => $r['email'], 'bmdc' => $r['bmdc'], 'phone' => $r['phone'], 'institution' => $r['institution'], 'registeredAt' => (int) $r['registered_at'], 'status' => $r['status'] ?: 'registered', 'score' => $r['score'] !== null ? (int) $r['score'] : null, 'total' => $r['total'] !== null ? (int) $r['total'] : null, 'timeTakenSec' => $r['time_taken_sec'] !== null ? (int) $r['time_taken_sec'] : null, 'tabSwitches' => (int) ($r['tab_switches'] ?? 0), 'submittedAt' => $r['submitted_at'] ? (int) $r['submitted_at'] : null, 'late' => (bool) ($r['late'] ?? false)]; }
        out($rows);
    }
    case 'admin/participant-answers': {
        require_admin(); $a = attempt_of(s($in['id'] ?? '')); if (!$a) fail('No attempt.', 404);
        $order = json_decode($a['order_json'], true) ?: []; $ans = json_decode($a['answers_json'] ?: '{}', true) ?: []; $qs = questions_by_id($order); $rows = [];
        foreach ($order as $qid) { $q = $qs[$qid] ?? ['text' => '(removed)', 'correct' => '']; $rows[] = ['text' => $q['text'], 'answer' => $ans[$qid] ?? null, 'correct' => $q['correct'], 'isCorrect' => ($ans[$qid] ?? null) === $q['correct']]; }
        out($rows);
    }
    case 'admin/participant-delete': { require_admin(); db()->prepare('DELETE FROM participants WHERE id=?')->execute([s($in['id'] ?? '')]); out(['ok' => true]); }
    case 'admin/export': {
        require_admin(); $stamp = date('Y-m-d'); $kind = s($in['kind'] ?? 'participants');
        if ($kind === 'answers') {
            $csv = csv_line(['name', 'bmdc', 'question_no', 'question', 'answer', 'correct_option', 'is_correct']);
            $q = db()->query("SELECT a.order_json, a.answers_json, p.name, p.bmdc FROM attempts a JOIN participants p ON p.id=a.participant_id WHERE a.status='completed' ORDER BY a.submitted_at");
            foreach ($q as $r) { $order = json_decode($r['order_json'], true) ?: []; $ans = json_decode($r['answers_json'] ?: '{}', true) ?: []; $qs = questions_by_id($order); $n = 0;
                foreach ($order as $qid) { $n++; $qq = $qs[$qid] ?? ['text' => '', 'correct' => '']; $csv .= csv_line([$r['name'], $r['bmdc'], $n, $qq['text'], $ans[$qid] ?? '', $qq['correct'], (($ans[$qid] ?? null) === $qq['correct']) ? 1 : 0]); } }
            out(['filename' => "battle-of-interns-answers-$stamp.csv", 'csv' => $csv]);
        }
        $csv = csv_line(['rank', 'name', 'bmdc', 'phone', 'email', 'institution', 'registered_at', 'status', 'score', 'total', 'time_taken_sec', 'tab_switches', 'late_submission', 'submitted_at']);
        $q = db()->query("SELECT p.*, a.id aid, a.status, a.score, a.total, a.time_taken_sec, a.tab_switches, a.late, a.submitted_at FROM participants p LEFT JOIN attempts a ON a.participant_id=p.id ORDER BY a.score DESC, a.time_taken_sec ASC, p.registered_at ASC");
        foreach ($q as $r) { $csv .= csv_line([$r['status'] === 'completed' ? rank_of($r['aid']) : '', $r['name'], $r['bmdc'], $r['phone'], $r['email'], $r['institution'], gmdate('c', (int) ($r['registered_at'] / 1000)), $r['status'] ?: 'registered', $r['score'] ?? '', $r['total'] ?? '', $r['time_taken_sec'] ?? '', $r['tab_switches'] ?? 0, !empty($r['late']) ? 'yes' : '', $r['submitted_at'] ? gmdate('c', (int) ($r['submitted_at'] / 1000)) : '']); }
        out(['filename' => "battle-of-interns-participants-$stamp.csv", 'csv' => $csv]);
    }
    case 'admin/settings': { require_admin(); out(all_settings()); }
    case 'admin/settings-save': {
        require_admin();
        $allowed = ['campaignName' => 'string', 'sponsor' => 'string', 'durationSec' => 'int', 'questionCount' => 'int', 'openAt' => 'int?', 'closeAt' => 'int?', 'shuffle' => 'bool', 'leaderboardPublic' => 'bool', 'manualClosed' => 'bool'];
        foreach ($allowed as $k => $type) {
            if (!array_key_exists($k, $in)) continue; $v = $in[$k];
            if ($type === 'string') $v = mb_substr(s($v), 0, 120); elseif ($type === 'int') $v = max(1, (int) $v); elseif ($type === 'int?') $v = $v === null || $v === '' ? null : (int) $v; else $v = (bool) $v;
            set_setting($k, $v);
        }
        out(['ok' => true]);
    }
    case 'admin/password': {
        require_admin();
        if (!password_verify((string) ($in['oldPassword'] ?? ''), (string) setting('admin_hash'))) fail('Current password is wrong.');
        if (strlen((string) ($in['newPassword'] ?? '')) < 8) fail('New password must be at least 8 characters.');
        set_setting('admin_hash', password_hash((string) $in['newPassword'], PASSWORD_DEFAULT)); out(['ok' => true]);
    }
    case 'admin/reset': { require_admin(); db()->exec('DELETE FROM attempts; DELETE FROM participants;'); out(['ok' => true]); }
    default:
        fail('Unknown route.', 404);
}
