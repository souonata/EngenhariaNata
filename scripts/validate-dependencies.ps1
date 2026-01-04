# ============================================
# Script para Validar Dependências
# ============================================
# Este script valida se todas as dependências (CSS/JS) referenciadas nos HTMLs
# realmente existem no sistema de arquivos.
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts\validate-dependencies.ps1
# ============================================

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "VALIDACAO DE DEPENDENCIAS" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

$erros = @()
$avisos = @()
$totalArquivos = 0
$arquivosComErros = 0

# Obtém todos os arquivos HTML
$htmlFiles = Get-ChildItem -Recurse -Filter "*.html" | Where-Object { 
    $_.FullName -notmatch "node_modules" -and 
    $_.FullName -notmatch "\.git"
}

foreach ($htmlFile in $htmlFiles) {
    $totalArquivos++
    $content = Get-Content $htmlFile.FullName -Raw -Encoding UTF8
    $htmlDir = Split-Path -Parent $htmlFile.FullName
    $relativePath = $htmlFile.FullName.Replace((Get-Location).Path + "\", "")
    
    # Padrão para encontrar links CSS e JS
    $pattern = '(href|src)=["'']([^"'']+?\.(css|js))'
    $matches = [regex]::Matches($content, $pattern)
    
    $arquivoTemErro = $false
    
    foreach ($match in $matches) {
        $filePath = $match.Groups[2].Value
        
        # Remove parâmetros de versão (?v=...)
        $filePath = $filePath -replace '\?v=.*$', ''
        
        # Resolve caminho relativo
        if ($filePath -match '^\.\.\/') {
            # Caminho relativo (../)
            $resolvedPath = Join-Path $htmlDir $filePath
        } elseif ($filePath -match '^\.\/') {
            # Caminho relativo (./)
            $resolvedPath = Join-Path $htmlDir $filePath.Substring(2)
        } else {
            # Caminho relativo ao HTML
            $resolvedPath = Join-Path $htmlDir $filePath
        }
        
        # Normaliza o caminho
        $resolvedPath = [System.IO.Path]::GetFullPath($resolvedPath)
        
        if (-not (Test-Path $resolvedPath)) {
            $erros += "$relativePath -> $filePath (não encontrado)"
            $arquivoTemErro = $true
            Write-Host "[ERRO] $relativePath" -ForegroundColor Red
            Write-Host "       Dependência não encontrada: $filePath" -ForegroundColor Red
            Write-Host "       Caminho resolvido: $resolvedPath" -ForegroundColor Gray
        }
    }
    
    if ($arquivoTemErro) {
        $arquivosComErros++
    }
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "RESUMO" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Arquivos HTML verificados: $totalArquivos" -ForegroundColor Yellow
Write-Host "Arquivos com erros: $arquivosComErros" -ForegroundColor $(if ($arquivosComErros -gt 0) { "Red" } else { "Green" })
Write-Host "Total de dependências não encontradas: $($erros.Count)" -ForegroundColor $(if ($erros.Count -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($erros.Count -gt 0) {
    Write-Host "ERROS ENCONTRADOS:" -ForegroundColor Red
    foreach ($erro in $erros) {
        Write-Host "  - $erro" -ForegroundColor Red
    }
    exit 1
} else {
    Write-Host "[OK] Todas as dependências foram encontradas!" -ForegroundColor Green
    exit 0
}
