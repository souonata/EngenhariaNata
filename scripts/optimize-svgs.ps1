# ============================================
# Script para Otimizar SVGs Inline
# ============================================
# Este script otimiza SVGs inline nos arquivos HTML removendo
# espaços desnecessários e atributos redundantes.
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts\optimize-svgs.ps1
# ============================================

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "OTIMIZACAO DE SVGs INLINE" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

$htmlFiles = Get-ChildItem -Recurse -Filter "*.html" | Where-Object { 
    $_.FullName -notmatch "node_modules" 
}

$totalOptimized = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    $fileOptimized = $false
    
    # Remove espaços múltiplos dentro de tags SVG
    $content = [regex]::Replace($content, '<svg([^>]+)>', {
        param($match)
        $attrs = $match.Groups[1].Value
        # Remove espaços múltiplos
        $attrs = [regex]::Replace($attrs, '\s+', ' ')
        $attrs = $attrs.Trim()
        $fileOptimized = $true
        return "<svg$attrs>"
    })
    
    # Remove quebras de linha desnecessárias dentro de SVGs
    $content = [regex]::Replace($content, '(?s)<svg[^>]*>.*?</svg>', {
        param($match)
        $svg = $match.Value
        # Remove quebras de linha e espaços múltiplos, mas mantém estrutura
        $svg = [regex]::Replace($svg, '\s+', ' ')
        $svg = [regex]::Replace($svg, '>\s+<', '><')
        $fileOptimized = $true
        return $svg
    })
    
    if ($fileOptimized -and $content -ne $originalContent) {
        # Verifica se o arquivo ainda é válido (contém tags básicas)
        if ($content -match '<html' -and $content -match '</html>') {
            Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
            Write-Host "[OK] Otimizado: $($file.Name)" -ForegroundColor Green
            $totalOptimized++
        } else {
            Write-Host "[AVISO] Arquivo $($file.Name) pode ter sido corrompido, pulando..." -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "RESUMO" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Arquivos otimizados: $totalOptimized" -ForegroundColor Yellow
Write-Host ""
Write-Host "NOTA: Este script faz otimizações básicas." -ForegroundColor Gray
Write-Host "Para otimizações mais avançadas, considere usar ferramentas" -ForegroundColor Gray
Write-Host "especializadas como SVGO (https://github.com/svg/svgo)" -ForegroundColor Gray
Write-Host ""

