# ============================================
# Script de Análise de Bundle Size
# ============================================
# Este script analisa o tamanho dos arquivos JS, CSS e HTML
# e gera um relatório de tamanhos.
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts\analyze-bundle-size.ps1
# ============================================

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "ANALISE DE BUNDLE SIZE" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

function Format-FileSize {
    param([long]$Size)
    if ($Size -lt 1KB) { return "$Size B" }
    elseif ($Size -lt 1MB) { return "{0:N2} KB" -f ($Size / 1KB) }
    else { return "{0:N2} MB" -f ($Size / 1MB) }
}

$jsFiles = Get-ChildItem -Recurse -Filter "*.js" | Where-Object { 
    $_.FullName -notmatch "node_modules" 
} | Sort-Object Length -Descending

$cssFiles = Get-ChildItem -Recurse -Filter "*.css" | Where-Object { 
    $_.FullName -notmatch "node_modules" 
} | Sort-Object Length -Descending

$htmlFiles = Get-ChildItem -Recurse -Filter "*.html" | Where-Object { 
    $_.FullName -notmatch "node_modules" 
} | Sort-Object Length -Descending

Write-Host "ARQUIVOS JAVASCRIPT (Top 10 maiores):" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
$jsTotal = 0
$jsFiles | Select-Object -First 10 | ForEach-Object {
    $size = Format-FileSize $_.Length
    $jsTotal += $_.Length
    Write-Host ("{0,-50} {1,10}" -f $_.Name, $size) -ForegroundColor White
}
Write-Host "Total JS: $(Format-FileSize ($jsFiles | Measure-Object -Property Length -Sum).Sum)" -ForegroundColor Cyan
Write-Host ""

Write-Host "ARQUIVOS CSS (Top 10 maiores):" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
$cssFiles | Select-Object -First 10 | ForEach-Object {
    $size = Format-FileSize $_.Length
    Write-Host ("{0,-50} {1,10}" -f $_.Name, $size) -ForegroundColor White
}
Write-Host "Total CSS: $(Format-FileSize ($cssFiles | Measure-Object -Property Length -Sum).Sum)" -ForegroundColor Cyan
Write-Host ""

Write-Host "ARQUIVOS HTML (Top 10 maiores):" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
$htmlFiles | Select-Object -First 10 | ForEach-Object {
    $size = Format-FileSize $_.Length
    Write-Host ("{0,-50} {1,10}" -f $_.Name, $size) -ForegroundColor White
}
Write-Host "Total HTML: $(Format-FileSize ($htmlFiles | Measure-Object -Property Length -Sum).Sum)" -ForegroundColor Cyan
Write-Host ""

$totalSize = ($jsFiles | Measure-Object -Property Length -Sum).Sum + 
             ($cssFiles | Measure-Object -Property Length -Sum).Sum + 
             ($htmlFiles | Measure-Object -Property Length -Sum).Sum

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "TAMANHO TOTAL DO PROJETO: $(Format-FileSize $totalSize)" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

