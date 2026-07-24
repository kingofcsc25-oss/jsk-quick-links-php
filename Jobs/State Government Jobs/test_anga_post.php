<?php
$cookie_file = 'cookies.txt';
$url = 'https://karnemakaone.kar.nic.in/abcd/ApplicationForm_JA_org.aspx';

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_COOKIEJAR, $cookie_file);
curl_setopt($ch, CURLOPT_COOKIEFILE, $cookie_file);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0");
curl_setopt($ch, CURLOPT_REFERER, 'https://karnemakaone.kar.nic.in/abcd/home.aspx');
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
$html = curl_exec($ch);

preg_match('/id="__VIEWSTATE" value="(.*?)"/', $html, $viewstate_match);
preg_match('/id="__VIEWSTATEGENERATOR" value="(.*?)"/', $html, $viewstategenerator_match);
preg_match('/id="__EVENTVALIDATION" value="(.*?)"/', $html, $eventvalidation_match);

$viewstate = $viewstate_match[1] ?? '';
$viewstategenerator = $viewstategenerator_match[1] ?? '';
$eventvalidation = $eventvalidation_match[1] ?? '';

$post_data = http_build_query([
    '__EVENTTARGET' => 'ctl00$ContentPlaceHolder1$ddldistrict',
    '__EVENTARGUMENT' => '',
    '__LASTFOCUS' => '',
    '__VIEWSTATE' => $viewstate,
    '__VIEWSTATEGENERATOR' => $viewstategenerator,
    '__EVENTVALIDATION' => $eventvalidation,
    'ctl00$ContentPlaceHolder1$ddldistrict' => '524'
]);

curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
$res2 = curl_exec($ch);
curl_close($ch);

$dom = new DOMDocument();
@$dom->loadHTML($res2);
$xpath = new DOMXPath($dom);
$selects = $xpath->query('//select[@id="ContentPlaceHolder1_DDL_NotificationNo"]/option');
if ($selects->length > 0) {
    foreach($selects as $opt) {
        echo "Notification: " . trim($opt->textContent) . "\n";
    }
} else {
    echo "No notification dropdown populated yet.\n";
}
