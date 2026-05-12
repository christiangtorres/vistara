# Vistara — Conference Badge Scanner

## Deploy to Bluehost (bluehostaitesting.com/vistara)

1. Upload all files in this folder to `public_html/vistara/` via cPanel File Manager or FTP.
2. In cPanel → Files → File Manager, create folder `vistara/data/` and set permissions to `755` (PHP needs to write the SQLite db + uploaded photos there).
3. Set your Claude API key. Easiest: edit `config.php` and paste your key into `ANTHROPIC_API_KEY`. (Better: set `ANTHROPIC_API_KEY` env var in cPanel.)
4. Visit `https://bluehostaitesting.com/vistara/` → log in.

## Credentials

- **Password:** `vistara2026`
- Each user types their own name on login so the contact records show who scanned what.

Change the password by editing `APP_PASSWORD` in `config.php`.

## How it works

- Tap **Take badge photo** → phone camera opens.
- Photo uploads → Claude vision reads the badge (name, company, title, email, phone) and writes a 1–2 sentence guess at what the company does.
- You review/edit the fields, add your own notes, hit **Save**.
- **Contacts** tab lists everything. Export to CSV anytime.

## Files

- `index.php` — main app (scan + list)
- `login.php` / `logout.php` — auth
- `api.php` — scan / save / list / delete / export endpoints
- `db.php` / `config.php` — SQLite + config
- `app.js` / `style.css` — frontend
- `data/` — SQLite db + uploaded photos (auto-created, not web-accessible)

## Requirements

Bluehost shared hosting with PHP 8+, PDO SQLite, and cURL — all standard.
