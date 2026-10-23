# Runs an ExtendScript file in Photoshop over COM and prints its result and duration.
param([string]$Jsx)
$sw = [Diagnostics.Stopwatch]::StartNew()
$ps = New-Object -ComObject Photoshop.Application
$launch = $sw.ElapsedMilliseconds
$result = $ps.DoJavaScriptFile((Resolve-Path $Jsx).Path)
"launch_ms=$launch total_ms=$($sw.ElapsedMilliseconds)"
$result
