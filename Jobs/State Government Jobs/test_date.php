<?php
$html = file_get_contents('https://cetonline.karnataka.gov.in/kea/apcrpc', false, stream_context_create(['ssl'=>['verify_peer'=>false,'verify_peer_name'=>false]])); 
$dom = new DOMDocument();
@$dom->loadHTML($html);
$xpath = new DOMXPath($dom);
$links = $xpath->query('//a');
foreach($links as $link) {
    $text = trim($link->textContent);
    if (strpos($text, '2026') !== false) {
        echo $text . "\n";
    }
}
