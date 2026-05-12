<?php
require_once __DIR__ . '/config.php';

function db() {
    static $pdo = null;
    if ($pdo) return $pdo;
    if (!is_dir(dirname(DB_PATH))) mkdir(dirname(DB_PATH), 0775, true);
    if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0775, true);
    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        name TEXT,
        company TEXT,
        title TEXT,
        email TEXT,
        phone TEXT,
        company_guess TEXT,
        notes TEXT,
        photo TEXT,
        owner TEXT
    )");
    return $pdo;
}

function require_auth() {
    session_start();
    if (empty($_SESSION['auth'])) {
        header('Location: login.php');
        exit;
    }
}
