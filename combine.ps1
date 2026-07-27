$original = Get-Content -Path 'F:\Google\jskquicklinks\temp_ext_extract\content.js' -Raw
$mine = Get-Content -Path 'F:\Google\jskquicklinks\2. Jana Seva Kendra\JSK Extension Services for Printing\SSPCM\SSPCM Extension COde\content.js' -Raw
$combined = $mine + "`r`n`r`n/* --- ORIGINAL AUTOMATION CORE --- */`r`n" + $original
Set-Content -Path 'F:\Google\jskquicklinks\2. Jana Seva Kendra\JSK Extension Services for Printing\SSPCM\SSPCM Extension COde\content.js' -Value $combined -Encoding UTF8
