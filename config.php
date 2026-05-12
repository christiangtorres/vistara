<?php
// Shared password for you + coworker
define('APP_PASSWORD', 'vistara2026');

define('CLAUDE_MODEL', 'claude-opus-4-7');
define('DB_PATH', __DIR__ . '/data/vistara.sqlite');
define('UPLOAD_DIR', __DIR__ . '/data/uploads');

// Secrets live in config.local.php (gitignored). Falls back to env var.
$localConfig = __DIR__ . '/config.local.php';
if (file_exists($localConfig)) {
    require_once $localConfig;
}
if (!defined('ANTHROPIC_API_KEY')) {
    define('ANTHROPIC_API_KEY', getenv('ANTHROPIC_API_KEY') ?: '');
}
