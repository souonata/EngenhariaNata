# ============================================
# Script de Validação Automática de Traduções
# ============================================
# Este script verifica se todas as chaves de tradução
# têm tradução em PT-BR e IT-IT em todos os arquivos JS.
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts\validate-translations.ps1
# ============================================

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "VALIDACAO DE TRADUCOES" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

$jsFiles = Get-ChildItem -Recurse -Filter "*-script.js" | Where-Object { 
    $_.FullName -notmatch "node_modules" -and 
    $_.FullName -notmatch "site-config.js" 
}

$errors = @()
$warnings = @()

foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # Verifica se o arquivo tem objeto traducoes
    if ($content -match "const traducoes\s*=\s*\{") {
        Write-Host "Verificando: $($file.Name)" -ForegroundColor Yellow
        
        # Extrai chaves de tradução usando regex simples
        # Procura por padrões como 'chave': 'valor'
        $ptKeys = [regex]::Matches($content, "'pt-BR':\s*\{([^}]+)\}") | ForEach-Object {
            [regex]::Matches($_.Groups[1].Value, "'([^']+)':") | ForEach-Object { $_.Groups[1].Value }
        }
        
        $itKeys = [regex]::Matches($content, "'it-IT':\s*\{([^}]+)\}") | ForEach-Object {
            [regex]::Matches($_.Groups[1].Value, "'([^']+)':") | ForEach-Object { $_.Groups[1].Value }
        }
        
        # Remove duplicatas
        $ptKeys = $ptKeys | Select-Object -Unique
        $itKeys = $itKeys | Select-Object -Unique
        
        # Verifica chaves faltando em IT
        $missingInIT = $ptKeys | Where-Object { $itKeys -notcontains $_ }
        if ($missingInIT) {
            foreach ($key in $missingInIT) {
                $errors += "$($file.Name): Chave '$key' falta tradução IT-IT"
            }
        }
        
        # Verifica chaves faltando em PT
        $missingInPT = $itKeys | Where-Object { $ptKeys -notcontains $_ }
        if ($missingInPT) {
            foreach ($key in $missingInPT) {
                $warnings += "$($file.Name): Chave '$key' falta tradução PT-BR (mas existe em IT-IT)"
            }
        }
        
        if (-not $missingInIT -and -not $missingInPT) {
            Write-Host "  [OK] Todas as traduções estão completas" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "RESUMO" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "[OK] Todas as traduções estão completas!" -ForegroundColor Green
} else {
    if ($errors.Count -gt 0) {
        Write-Host "[ERRO] Erros encontrados:" -ForegroundColor Red
        foreach ($err in $errors) {
            Write-Host "  - $err" -ForegroundColor Red
        }
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host "[AVISO] Avisos:" -ForegroundColor Yellow
        foreach ($warning in $warnings) {
            Write-Host "  - $warning" -ForegroundColor Yellow
        }
    }
}

Write-Host ""

