# check-site-config.ps1 — PowerShell smoke check for site-wide shared config
Set-StrictMode -Off
Write-Host "Running PowerShell site-config checks..."

$root = Resolve-Path "$(Split-Path -Parent $MyInvocation.MyCommand.Path)/.."

$siteConfig = Join-Path $root 'assets\js\site-config.js'
if (-not (Test-Path $siteConfig)) { Write-Error "site-config.js not found at assets/js/site-config.js"; exit 2 }

$content = Get-Content $siteConfig -Raw
if ($content -notmatch 'LOCAL_STORAGE' -or $content -notmatch 'DEFAULTS') { Write-Error "site-config.js missing expected keys (LOCAL_STORAGE, DEFAULTS)"; exit 3 }

$main = @('index.html','mutuo/mutuo.html','helice/helice.html','solar/solar.html','solar/config.html','sobre/sobre.html')
$missing = @()
foreach ($f in $main) {
    $p = Join-Path $root $f
    if (-not (Test-Path $p)) { $missing += $f; continue }
    $txt = Get-Content $p -Raw
    if ($txt -notmatch 'assets/css/shared-styles.css') { $missing += "$f (missing shared-styles)"; continue }
    if ($txt -notmatch 'assets/js/site-config.js') { $missing += "$f (missing site-config.js)" }
}

if ($missing) { Write-Error "Some files missing shared assets:`n" + ($missing -join "`n"); exit 4 }

Write-Host "✔ site-config checks passed."
exit 0
