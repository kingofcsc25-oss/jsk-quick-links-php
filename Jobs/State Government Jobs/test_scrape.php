<?php
$urls = [
    "KPSC" => "https://kpsc.kar.nic.in/",
    "KPTCL" => "https://kptcl.karnataka.gov.in/english",
    "Anganawadi" => "https://karnemakaone.kar.nic.in/abcd/"
];

foreach ($urls as $name => $url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0");
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $html = @curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    echo "$name ($url) - HTTP $status - " . strlen($html) . " bytes\n";
    
    // Quick parse for 2026 links
    $dom = new DOMDocument();
    @$dom->loadHTML($html);
    $xpath = new DOMXPath($dom);
    $links = $xpath->query('//a[contains(text(), "2026")]');
    echo "  -> Found " . $links->length . " links with 2026\n";
}
?>
