<?php
/* Battle of Interns. Server settings. Edit these before going live. */

return [
    // Where the SQLite database file lives. Keep it OUTSIDE the public web folder if your host allows it.
    // Default: ../../data/quiz.sqlite  (the "data" folder next to "public"). The folder must be writable by PHP.
    'db_path' => __DIR__ . '/../../data/quiz.sqlite',

    // First admin password. Used only when the database is created for the first time.
    // Change it afterwards from Admin > Settings > Admin password.
    'initial_admin_password' => 'ChangeMe-2026',

    // Any long random text. Used to sign admin sessions. Change it once, then leave it alone.
    'secret' => 'replace-this-with-a-long-random-string-9f3b1c7e2a',

    // How long an admin stays signed in without activity (seconds).
    'admin_session_seconds' => 8 * 3600,

    // Seconds of grace after the timer ends in which a late auto-submit is still accepted.
    'grace_seconds' => 20,

    // Seed questions loaded on first run (relative to this file).
    'seed_file' => __DIR__ . '/../../seed/questions.json',

    // Allowed origins for cross-site calls. Leave empty when the quiz page and the API are on the same domain.
    'cors_origins' => [],
];
