# check-ripple.ps1 — PowerShell smoke check for ripple consolidation
Set-StrictMode -Off
Write-Host "Running PowerShell ripple checks..."

$root = Resolve-Path "$(Split-Path -Parent $MyInvocation.MyCommand.Path)/.."

Write-Host "Repository root:" $root

# Search for .ripple or @keyframes ripple in css files

# Collect all files that contain either .ripple { or @keyframes ripple
$allMatches = Get-ChildItem -Path $root -Recurse -Include *.css | Select-String -Pattern '\.ripple\s*\{|@keyframes\s+ripple' -List | Select-Object -ExpandProperty Path -Unique


if (-not $allMatches) {
    Write-Error "No .ripple/@keyframes matches found in any CSS file — expected assets/css/ripple-styles.css"
    exit 2
}

$expected = Join-Path $root 'assets\css\ripple-styles.css'
$fullExpected = [IO.Path]::GetFullPath($expected)

$allNormalized = $allMatches | ForEach-Object { [IO.Path]::GetFullPath($_) }

$others = $allNormalized | Where-Object { $_ -ne $fullExpected }
if ($others) {
    Write-Error ("Found duplicate ripple rules outside of assets/css/ripple-styles.css:`n" + ($others -join "`n"))
    exit 3
}

Write-Host '✔ All ripple rules found only in assets/css/ripple-styles.css'

# Check main HTML pages include the expected CSS
$expectedHref = 'assets/css/ripple-styles.css'
$mainFiles = @('index.html','mutuo/mutuo.html','helice/helice.html','solar/solar.html','solar/config.html','sobre/sobre.html')
$missing = @()
foreach ($f in $mainFiles) {
    $p = Join-Path $root $f
    if (-not (Test-Path $p)) { $missing += $f; continue }
    $txt = Get-Content $p -Raw
    if (-not ($txt -like "*${expectedHref}*")) { $missing += $f }
}

if ($missing) {
    Write-Error ("The following main pages do not include " + $expectedHref + "`n" + ($missing -join "`n"))
    exit 4
} else {
    Write-Host "✔ All main pages reference $expectedHref"
}

Write-Host "All PowerShell ripple checks passed."
exit 0
