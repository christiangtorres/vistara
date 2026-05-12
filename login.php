<?php
require_once __DIR__ . '/config.php';
session_start();
$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (hash_equals(APP_PASSWORD, $_POST['password'] ?? '')) {
        $_SESSION['auth'] = true;
        $_SESSION['owner'] = trim($_POST['name'] ?? 'user');
        header('Location: index.php');
        exit;
    }
    $err = 'Wrong password';
}
?><!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vistara — Sign in</title>
<link rel="stylesheet" href="style.css"></head>
<body class="login">
<form method="post" class="card">
  <h1>Vistara</h1>
  <p class="sub">Conference badge scanner</p>
  <label>Your name<input name="name" required></label>
  <label>Password<input type="password" name="password" required></label>
  <?php if ($err): ?><p class="err"><?= htmlspecialchars($err) ?></p><?php endif; ?>
  <button>Enter</button>
</form>
</body></html>
