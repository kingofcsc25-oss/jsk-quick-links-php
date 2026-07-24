<?php
$html = file_get_contents('https://karnemakaone.kar.nic.in/abcd/ApplicationForm_JA_org.aspx', false, stream_context_create(['ssl'=>['verify_peer'=>false,'verify_peer_name'=>false]]));
file_put_contents('anga.html', $html);
