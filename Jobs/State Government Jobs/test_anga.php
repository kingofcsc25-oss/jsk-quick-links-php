<?php
$cookie_file = 'cookies.txt';
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://karnemakaone.kar.nic.in/abcd/home.aspx');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_COOKIEJAR, $cookie_file);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
$res = curl_exec($ch);

curl_setopt($ch, CURLOPT_URL, 'https://karnemakaone.kar.nic.in/abcd/ApplicationForm_JA_org.aspx');
curl_setopt($ch, CURLOPT_COOKIEFILE, $cookie_file);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_REFERER, 'https://karnemakaone.kar.nic.in/abcd/home.aspx');
$res2 = curl_exec($ch);
curl_close($ch);

$dom = new DOMDocument();
@$dom->loadHTML($res2);
$xpath = new DOMXPath($dom);
$selects = $xpath->query('//select');
if ($selects->length > 0) {
    foreach($selects as $sel) {
        echo "Select ID: " . $sel->getAttribute('id') . "\n";
        $opts = $xpath->query('./option', $sel);
        foreach($opts as $opt) {
            echo "  " . trim($opt->textContent) . " (" . $opt->getAttribute('value') . ")\n";
        }
    }
} else {
    echo "Still no select.\n";
}
