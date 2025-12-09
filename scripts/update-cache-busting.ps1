# ============================================
# Script para Atualizar Cache-Busting Automaticamente
# ============================================
# Este script incrementa automaticamente as versões (?v=X.Y.Z) 
# nos links CSS/JS de todos os arquivos HTML do projeto.
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts\update-cache-busting.ps1
# ============================================

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "ATUALIZACAO DE CACHE-BUSTING" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

$htmlFiles = Get-ChildItem -Recurse -Filter "*.html" | Where-Object { $_.FullName -notmatch "node_modules" }

$totalUpdated = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    $fileUpdated = $false
    
    # Padrão para encontrar versões: ?v=X.Y.Z ou ?v=X.Y
    $pattern = '\?v=(\d+)\.(\d+)\.(\d+)'
    $pattern2 = '\?v=(\d+)\.(\d+)'
    
    # Função para incrementar versão
    $content = [regex]::Replace($content, $pattern, {
        param($match)
        $major = [int]$match.Groups[1].Value
        $minor = [int]$match.Groups[2].Value
        $patch = [int]$match.Groups[3].Value
        $newPatch = $patch + 1
        $fileUpdated = $true
        return "?v=$major.$minor.$newPatch"
    })
    
    # Se não encontrou padrão com 3 números, tenta com 2
    if (-not $fileUpdated) {
        $content = [regex]::Replace($content, $pattern2, {
            param($match)
            $major = [int]$match.Groups[1].Value
            $minor = [int]$match.Groups[2].Value
            $newMinor = $minor + 1
            $fileUpdated = $true
            return "?v=$major.$newMinor.0"
        })
    }
    
    if ($fileUpdated) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "[OK] Atualizado: $($file.Name)" -ForegroundColor Green
        $totalUpdated++
    }
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "RESUMO" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Arquivos atualizados: $totalUpdated" -ForegroundColor Yellow
Write-Host ""

