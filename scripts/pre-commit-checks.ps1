# Script de Verificacoes Pre-Commit
# Executa verificacoes automaticas antes de fazer commit
# Uso: powershell -ExecutionPolicy Bypass -File scripts\pre-commit-checks.ps1

Write-Host "=========================================="
Write-Host "VERIFICACOES PRE-COMMIT"
Write-Host "=========================================="
Write-Host ""

$erros = @()
$avisos = @()

# 1. Verificar console.log
Write-Host "1. Verificando console.log..." -ForegroundColor Cyan
$consoleLogs = Get-ChildItem -Recurse -Include *.js | Select-String "console\.log" | Where-Object { 
    $_.Path -notmatch "node_modules" -and 
    $_.Path -notmatch "\.git" 
}
if ($consoleLogs) {
    $erros += "console.log encontrado em:"
    foreach ($log in $consoleLogs) {
        $erros += "  - $($log.Path):$($log.LineNumber)"
    }
    Write-Host "  [ERRO] console.log encontrado!" -ForegroundColor Red
} else {
    Write-Host "  [OK] Nenhum console.log encontrado" -ForegroundColor Green
}

# 2. Verificar codigo comentado (dead code)
Write-Host "`n2. Verificando codigo comentado..." -ForegroundColor Cyan
$deadCode = Get-ChildItem -Recurse -Include *.js | Select-String "^\s*//\s*(function|const|let|var|class|if|for|while)" | Where-Object {
    $_.Path -notmatch "node_modules" -and 
    $_.Path -notmatch "\.git"
}
if ($deadCode) {
    $avisos += "Possivel codigo morto encontrado:"
    foreach ($code in $deadCode) {
        $avisos += "  - $($code.Path):$($code.LineNumber)"
    }
    Write-Host "  [AVISO] Possivel codigo morto encontrado (verificar manualmente)" -ForegroundColor Yellow
} else {
    Write-Host "  [OK] Nenhum codigo morto obvio encontrado" -ForegroundColor Green
}

# 3. Verificar cache-busting em HTML
Write-Host "`n3. Verificando cache-busting em arquivos HTML..." -ForegroundColor Cyan
$htmlFiles = Get-ChildItem -Recurse -Include *.html | Where-Object {
    $_.FullName -notmatch "node_modules" -and 
    $_.FullName -notmatch "\.git"
}
$semCacheBusting = @()
foreach ($html in $htmlFiles) {
    $content = Get-Content $html.FullName -Raw
    # Verifica se ha links CSS ou JS sem ?v=
    if ($content -match '(href|src)=["''][^"'']*\.(css|js)["'']' -and $content -notmatch '\?v=\d+\.\d+\.\d+') {
        $semCacheBusting += $html.FullName
    }
}
if ($semCacheBusting) {
    $avisos += "Arquivos HTML sem cache-busting:"
    foreach ($file in $semCacheBusting) {
        $avisos += "  - $file"
    }
    Write-Host "  [AVISO] Alguns arquivos podem nao ter cache-busting" -ForegroundColor Yellow
} else {
    Write-Host "  [OK] Cache-busting verificado (verificacao basica)" -ForegroundColor Green
}

# 4. Verificar estrutura de arquivos dos apps
Write-Host "`n4. Verificando estrutura dos apps..." -ForegroundColor Cyan
$apps = @("mutuo", "helice", "solar", "bitola", "arcondicionado", "aquecimento", "fazenda", "bugs")
$appsIncompletos = @()
foreach ($app in $apps) {
    $html = "$app\$app.html"
    $js = "$app\$app-script.js"
    $css = "$app\$app-styles.css"
    
    $faltando = @()
    if (-not (Test-Path $html)) { $faltando += "HTML" }
    if (-not (Test-Path $js)) { $faltando += "JavaScript" }
    if (-not (Test-Path $css)) { $faltando += "CSS" }
    
    if ($faltando) {
        $appsIncompletos += "$app (faltando: $($faltando -join ', '))"
    }
}
if ($appsIncompletos) {
    $erros += "Apps com estrutura incompleta:"
    foreach ($app in $appsIncompletos) {
        $erros += "  - $app"
    }
    Write-Host "  [ERRO] Estrutura incompleta encontrada!" -ForegroundColor Red
} else {
    Write-Host "  [OK] Estrutura dos apps esta completa" -ForegroundColor Green
}

# 5. Verificar se ha arquivos modificados nao commitados
Write-Host "`n5. Verificando status do Git..." -ForegroundColor Cyan
try {
    $gitStatus = git status --porcelain 2>&1
    if ($LASTEXITCODE -eq 0) {
        $modified = ($gitStatus | Where-Object { $_ -match '^[ M]' }).Count
        $untracked = ($gitStatus | Where-Object { $_ -match '^\?\?' }).Count
        if ($modified -gt 0 -or $untracked -gt 0) {
            Write-Host "  [INFO] $modified arquivo(s) modificado(s), $untracked arquivo(s) nao rastreado(s)" -ForegroundColor Cyan
        } else {
            Write-Host "  [OK] Nenhuma mudanca pendente" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "  [AVISO] Git nao disponivel ou nao e um repositorio Git" -ForegroundColor Yellow
}

# 6. Verificar se o script count-lines.ps1 existe
Write-Host "`n6. Verificando scripts utilitarios..." -ForegroundColor Cyan
if (Test-Path "scripts\count-lines.ps1") {
    Write-Host "  [OK] Script count-lines.ps1 encontrado" -ForegroundColor Green
} else {
    $avisos += "Script count-lines.ps1 nao encontrado"
    Write-Host "  [AVISO] Script count-lines.ps1 nao encontrado" -ForegroundColor Yellow
}

# Resumo
Write-Host "`n=========================================="
Write-Host "RESUMO DAS VERIFICACOES"
Write-Host "=========================================="

if ($erros.Count -eq 0 -and $avisos.Count -eq 0) {
    Write-Host "[OK] Todas as verificacoes passaram!" -ForegroundColor Green
    Write-Host "`nO codigo esta pronto para commit." -ForegroundColor Green
    exit 0
} else {
    if ($erros.Count -gt 0) {
        Write-Host "`n[ERRO] ERROS ENCONTRADOS:" -ForegroundColor Red
        foreach ($erro in $erros) {
            Write-Host "  $erro" -ForegroundColor Red
        }
    }
    
    if ($avisos.Count -gt 0) {
        Write-Host "`n[AVISO] AVISOS:" -ForegroundColor Yellow
        foreach ($aviso in $avisos) {
            Write-Host "  $aviso" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`n[AVISO] Revise os erros e avisos antes de fazer commit." -ForegroundColor Yellow
    exit 1
}
