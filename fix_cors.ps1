$file = 'F:\Google\jskquicklinks\2. Jana Seva Kendra\JSK Extension Services for Printing\SSPCM\SSPCM Extension COde\content.js'
$content = Get-Content $file -Raw
$content = $content.Replace('"application/json"', '"text/plain;charset=utf-8"').Replace("'application/json'", "'text/plain;charset=utf-8'")
Set-Content $file -Value $content -Encoding UTF8
