# Script para contar linhas de código excluindo comentários
# Uso: powershell -ExecutionPolicy Bypass -File scripts\count-lines.ps1
#
# Este script conta as linhas de código de cada app, excluindo:
# - Linhas vazias
# - Comentários HTML (<!-- -->)
# - Comentários JavaScript (// e /* */)
# - Comentários CSS (/* */)

function Count-Lines($filePath, $fileType) {
    if (-not (Test-Path $filePath)) {
        Write-Warning "Arquivo não encontrado: $filePath"
        return 0
    }
    
    $lines = Get-Content $filePath
    $count = 0
    
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        
        # Ignora linhas vazias
        if ($trimmed -eq '') { continue }
        
        if ($fileType -eq 'html') {
            # Ignora comentários HTML
            if ($trimmed -match '^\s*<!--' -or $trimmed -match '^\s*-->') { continue }
        }
        elseif ($fileType -eq 'js') {
            # Ignora comentários JavaScript
            if ($trimmed -match '^\s*//') { continue }
            if ($trimmed -match '^\s*/\*') { continue }
            if ($trimmed -match '^\s*\*/') { continue }
            if ($trimmed -match '^\s*\*') { continue }
        }
        elseif ($fileType -eq 'css') {
            # Ignora comentários CSS
            if ($trimmed -match '^\s*/\*') { continue }
            if ($trimmed -match '^\s*\*/') { continue }
            if ($trimmed -match '^\s*\*') { continue }
        }
        
        $count++
    }
    
    return $count
}

Write-Host "=========================================="
Write-Host "Contagem de Linhas de Código (sem comentários)"
Write-Host "=========================================="
Write-Host ""

# Mutuo
$mutuoHtml = Count-Lines 'mutuo\mutuo.html' 'html'
$mutuoJs = Count-Lines 'mutuo\mutuo-script.js' 'js'
$mutuoCss = Count-Lines 'mutuo\mutuo-styles.css' 'css'
Write-Host "Mutuo: HTML=$mutuoHtml JS=$mutuoJs CSS=$mutuoCss"

# Ar Condicionado
$arHtml = Count-Lines 'arcondicionado\arcondicionado.html' 'html'
$arJs = Count-Lines 'arcondicionado\arcondicionado-script.js' 'js'
$arCss = Count-Lines 'arcondicionado\arcondicionado-styles.css' 'css'
Write-Host "Ar Condicionado: HTML=$arHtml JS=$arJs CSS=$arCss"

# Aquecedor Solar
$aqHtml = Count-Lines 'aquecimento\aquecimento.html' 'html'
$aqJs = Count-Lines 'aquecimento\aquecimento-script.js' 'js'
$aqCss = Count-Lines 'aquecimento\aquecimento-styles.css' 'css'
Write-Host "Aquecedor Solar: HTML=$aqHtml JS=$aqJs CSS=$aqCss"

# Bitola
$bitHtml = Count-Lines 'bitola\bitola.html' 'html'
$bitJs = Count-Lines 'bitola\bitola-script.js' 'js'
$bitCss = Count-Lines 'bitola\bitola-styles.css' 'css'
Write-Host "Bitola: HTML=$bitHtml JS=$bitJs CSS=$bitCss"

# Hélice
$helHtml = Count-Lines 'helice\helice.html' 'html'
$helJs = Count-Lines 'helice\helice-script.js' 'js'
$helCss = Count-Lines 'helice\helice-styles.css' 'css'
Write-Host "Hélice: HTML=$helHtml JS=$helJs CSS=$helCss"

# Energia Solar
$solHtml = Count-Lines 'solar\solar.html' 'html'
$solJs = Count-Lines 'solar\solar-script.js' 'js'
$solCss = Count-Lines 'solar\solar-styles.css' 'css'
Write-Host "Energia Solar: HTML=$solHtml JS=$solJs CSS=$solCss"

# Fazenda
$fazHtml = Count-Lines 'fazenda\fazenda.html' 'html'
$fazJs = Count-Lines 'fazenda\fazenda-script.js' 'js'
$fazCss = Count-Lines 'fazenda\fazenda-styles.css' 'css'
Write-Host "Fazenda: HTML=$fazHtml JS=$fazJs CSS=$fazCss"

Write-Host ""
Write-Host "=========================================="
Write-Host "Total: HTML=$($mutuoHtml + $arHtml + $aqHtml + $bitHtml + $helHtml + $solHtml + $fazHtml) JS=$($mutuoJs + $arJs + $aqJs + $bitJs + $helJs + $solJs + $fazJs) CSS=$($mutuoCss + $arCss + $aqCss + $bitCss + $helCss + $solCss + $fazCss)"
Write-Host "=========================================="

