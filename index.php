<?php
require_once __DIR__ . '/db.php';
require_auth();
?><!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vistara</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<header>
  <h1>Vistara</h1>
  <div class="who">Hi, <?= htmlspecialchars($_SESSION['owner']) ?> · <a href="logout.php">Sign out</a></div>
</header>

<nav class="tabs">
  <button class="tab active" data-tab="scan">Scan</button>
  <button class="tab" data-tab="list">Contacts</button>
</nav>

<section id="tab-scan" class="tab-pane active">
  <label class="capture-btn">
    <input type="file" id="photo" accept="image/*" capture="environment" hidden>
    <span>📷 Take badge photo</span>
  </label>
  <img id="preview" hidden>
  <div id="status" class="status"></div>

  <form id="entry" hidden>
    <label>Name<input name="name"></label>
    <label>Company<input name="company"></label>
    <label>Title<input name="title"></label>
    <label>Email<input name="email" type="email"></label>
    <label>Phone<input name="phone"></label>
    <label>What this company does (AI guess — edit as needed)
      <textarea name="company_guess" rows="3"></textarea>
    </label>
    <label>Your notes
      <textarea name="notes" rows="5" placeholder="Why this is interesting, follow-up needed, where you met, etc."></textarea>
    </label>
    <input type="hidden" name="photo">
    <button type="submit">Save contact</button>
  </form>
</section>

<section id="tab-list" class="tab-pane">
  <div class="list-actions">
    <a href="api.php?action=export" class="btn-secondary">Export CSV</a>
  </div>
  <div id="contacts"></div>
</section>

<script src="app.js"></script>
</body></html>
