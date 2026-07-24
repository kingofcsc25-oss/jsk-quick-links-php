<?php
header('Content-Type: application/json');

$url = "https://ahara.karnataka.gov.in/NRC/app_offline_current.aspx";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0");
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
$html = @curl_exec($ch);
curl_close($ch);

if (!$html) {
    echo json_encode([
        'status_html' => "Unable to fetch current status. Please visit the official portal.",
        'is_suspended' => true
    ]);
    exit;
}

// Extract content from body
if (preg_match('/<body[^>]*>(.*?)<\/body>/is', $html, $matches)) {
    $html = $matches[1];
}

// Convert common block elements to newlines
$html = preg_replace('/<br\s*\/?>/i', "\n", $html);
$html = preg_replace('/<\/tr>/i', "\n", $html);
$html = preg_replace('/<\/p>/i', "\n", $html);
$html = preg_replace('/<\/div>/i', "\n", $html);

// Strip remaining tags
$text = strip_tags($html);

// Clean up whitespace
$text = html_entity_decode($text);
$text = preg_replace("/^[ \t]+/m", "", $text); // trim start of each line
$text = preg_replace("/[ \t]+$/m", "", $text); // trim end of each line
$text = preg_replace("/\n+/", "\n", $text); // collapse multiple newlines into a single newline
$text = trim($text);

$is_suspended = (stripos($text, 'suspended') !== false || stripos($text, 'ಸ್ಥಗಿತ') !== false);

// Convert back to HTML for nice rendering
$status_html = nl2br(htmlspecialchars($text));

echo json_encode([
    'status_html' => $status_html,
    'is_suspended' => $is_suspended
]);
?>
