<?php
require_once __DIR__ . '/db.php';
require_auth();
header('Content-Type: application/json');

$action = $_GET['action'] ?? '';

function claude_extract($imagePath) {
    $key = ANTHROPIC_API_KEY;
    if (!$key) return ['error' => 'ANTHROPIC_API_KEY not set on server'];
    $mime = mime_content_type($imagePath) ?: 'image/jpeg';
    $b64 = base64_encode(file_get_contents($imagePath));
    $prompt = "You are reading a conference attendee badge from a photo. Extract these fields from the badge and return ONLY valid JSON (no prose, no markdown fences):\n"
        . "{\n"
        . "  \"name\": string,\n"
        . "  \"company\": string,\n"
        . "  \"title\": string,\n"
        . "  \"email\": string,\n"
        . "  \"phone\": string,\n"
        . "  \"company_guess\": string  // 1-2 sentence guess at what the company does, based on the company name\n"
        . "}\n"
        . "Use empty strings for fields you can't read. Do not invent contact info — only company_guess may be inferred.";

    $payload = json_encode([
        'model' => CLAUDE_MODEL,
        'max_tokens' => 600,
        'messages' => [[
            'role' => 'user',
            'content' => [
                ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mime, 'data' => $b64]],
                ['type' => 'text', 'text' => $prompt],
            ],
        ]],
    ]);

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'content-type: application/json',
            'x-api-key: ' . $key,
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_TIMEOUT => 60,
    ]);
    $resp = curl_exec($ch);
    if ($resp === false) return ['error' => 'curl: ' . curl_error($ch)];
    $data = json_decode($resp, true);
    $text = $data['content'][0]['text'] ?? '';
    $text = trim($text);
    if (str_starts_with($text, '```')) {
        $text = preg_replace('/^```(json)?|```$/m', '', $text);
        $text = trim($text);
    }
    $parsed = json_decode($text, true);
    if (!is_array($parsed)) return ['error' => 'Could not parse Claude response', 'raw' => $text];
    return $parsed;
}

try {
    if ($action === 'scan') {
        if (empty($_FILES['photo'])) throw new Exception('No photo uploaded');
        $ext = pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION) ?: 'jpg';
        $fn = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $dest = UPLOAD_DIR . '/' . $fn;
        if (!move_uploaded_file($_FILES['photo']['tmp_name'], $dest)) throw new Exception('Upload failed');
        $extracted = claude_extract($dest);
        echo json_encode(['photo' => $fn, 'extracted' => $extracted]);
        exit;
    }

    if ($action === 'save') {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $stmt = db()->prepare("INSERT INTO contacts
            (name, company, title, email, phone, company_guess, notes, photo, owner)
            VALUES (:name,:company,:title,:email,:phone,:company_guess,:notes,:photo,:owner)");
        $stmt->execute([
            ':name' => $body['name'] ?? '',
            ':company' => $body['company'] ?? '',
            ':title' => $body['title'] ?? '',
            ':email' => $body['email'] ?? '',
            ':phone' => $body['phone'] ?? '',
            ':company_guess' => $body['company_guess'] ?? '',
            ':notes' => $body['notes'] ?? '',
            ':photo' => $body['photo'] ?? '',
            ':owner' => $_SESSION['owner'] ?? '',
        ]);
        echo json_encode(['id' => db()->lastInsertId()]);
        exit;
    }

    if ($action === 'list') {
        $rows = db()->query("SELECT * FROM contacts ORDER BY id DESC")->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($rows);
        exit;
    }

    if ($action === 'delete') {
        $id = (int)($_GET['id'] ?? 0);
        db()->prepare("DELETE FROM contacts WHERE id=?")->execute([$id]);
        echo json_encode(['ok' => true]);
        exit;
    }

    if ($action === 'update') {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = (int)($body['id'] ?? 0);
        $stmt = db()->prepare("UPDATE contacts SET name=:name,company=:company,title=:title,email=:email,phone=:phone,company_guess=:company_guess,notes=:notes WHERE id=:id");
        $stmt->execute([
            ':name' => $body['name'] ?? '', ':company' => $body['company'] ?? '',
            ':title' => $body['title'] ?? '', ':email' => $body['email'] ?? '',
            ':phone' => $body['phone'] ?? '', ':company_guess' => $body['company_guess'] ?? '',
            ':notes' => $body['notes'] ?? '', ':id' => $id,
        ]);
        echo json_encode(['ok' => true]);
        exit;
    }

    if ($action === 'export') {
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="vistara_contacts.csv"');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['id','created_at','name','company','title','email','phone','company_guess','notes','owner']);
        foreach (db()->query("SELECT * FROM contacts ORDER BY id") as $r) {
            fputcsv($out, [$r['id'],$r['created_at'],$r['name'],$r['company'],$r['title'],$r['email'],$r['phone'],$r['company_guess'],$r['notes'],$r['owner']]);
        }
        exit;
    }

    throw new Exception('Unknown action');
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
