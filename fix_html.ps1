$file = 'F:\Google\jskquicklinks\2. Jana Seva Kendra\JSK Extension Services for Printing\SSPCM\SSPCM Extension COde\popup.html'
$lines = Get-Content $file
$start = -1
$end = -1
for ($i = 360; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "<script>") { $start = $i; break }
}
for ($i = $start; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "</script>") { $end = $i; break }
}
$lines[$start] = "<script src=`"live_sync.js`"></script>"
for ($i = $start + 1; $i -le $end; $i++) {
    $lines[$i] = ""
}
Set-Content $file -Value $lines -Encoding UTF8
