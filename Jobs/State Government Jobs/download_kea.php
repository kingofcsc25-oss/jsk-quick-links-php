<?php
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://cetonline.karnataka.gov.in/kea/");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0");
$html = curl_exec($ch);
curl_close($ch);
file_put_contents('kea.html', $html);
?>
