# ============================================
# Script para Sincronizar Versões
# ============================================
# Este script sincroniza as versões entre config/versions.json e os arquivos HTML
# Pode ser usado em dois modos:
# 1. Ler versões dos HTMLs e atualizar versions.json
# 2. Ler versions.json e atualizar os HTMLs
#
# Uso: 
#   powershell -ExecutionPolicy Bypass -File scripts\sync-versions.ps1 -Mode ReadHTML
#   powershell -ExecutionPolicy Bypass -File scripts\sync-versions.ps1 -Mode ReadJSON
# ============================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("ReadHTML", "ReadJSON", "Both")]
    [string]$Mode = "ReadHTML"
)

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "SINCRONIZACAO DE VERSOES" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Modo: $Mode" -ForegroundColor Yellow
Write-Host ""

$versionsJsonPath = "config\versions.json"
$versionsJson = Get-Content $versionsJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json

# Mapeamento de arquivos HTML para apps
$appMapping = @{
    "index.html" = "index"
    "solar\solar.html" = "solar"
    "solar\config.html" = "solar-config"
    "bitola\bitola.html" = "bitola"
    "helice\helice.html" = "helice"
    "mutuo\mutuo.html" = "mutuo"
    "arcondicionado\arcondicionado.html" = "arcondicionado"
    "aquecimento\aquecimento.html" = "aquecimento"
    "fazenda\fazenda.html" = "fazenda"
    "bugs\bugs.html" = "bugs"
    "sobre\sobre.html" = "sobre"
}

# Mapeamento de arquivos compartilhados
$sharedMapping = @{
    "shared-styles.css" = "shared-styles"
    "controls-styles.css" = "controls-styles"
    "site-config.js" = "site-config"
    "ajustarValorUtil.js" = "ajustarValorUtil"
}

function Extract-Version {
    param([string]$content, [string]$filePath)
    
    $versions = @{}
    
    # Padrão para encontrar versões: ?v=X.Y.Z
    $pattern = '(href|src)=["'']([^"'']+?)(\?v=(\d+)\.(\d+)\.(\d+))?["'']'
    
    $matches = [regex]::Matches($content, $pattern)
    
    foreach ($match in $matches) {
        $fullPath = $match.Groups[2].Value
        $version = $match.Groups[4].Value + "." + $match.Groups[5].Value + "." + $match.Groups[6].Value
        
        if ($version -match "^\d+\.\d+\.\d+$") {
            $fileName = Split-Path -Leaf $fullPath
            
            # Remove ../ se houver
            $fileName = $fileName -replace '^\.\.\/', ''
            
            # Determina o tipo de arquivo
            if ($fileName -match '\.css$') {
                if ($fileName -match 'shared-styles|controls-styles') {
                    $key = $sharedMapping[$fileName]
                    if ($key) {
                        $versions[$key] = $version
                    }
                } else {
                    # CSS específico do app
                    $appName = $appMapping[$filePath]
                    if ($appName) {
                        # Caso especial: index-styles.css
                        if ($fileName -eq "index-styles.css") {
                            $versions["index-css"] = $version
                        } elseif ($fileName -match 'solar-styles\.css' -and $filePath -match 'config\.html') {
                            $versions["solar-config-css"] = $version
                        } elseif ($fileName -match '(.+)-styles\.css') {
                            $matchedApp = $matches[1]
                            if ($appMapping.Values -contains $matchedApp) {
                                $versions["$matchedApp-css"] = $version
                            }
                        }
                    }
                }
            } elseif ($fileName -match '\.js$') {
                if ($fileName -match 'site-config|ajustarValorUtil') {
                    $key = $sharedMapping[$fileName]
                    if ($key) {
                        $versions[$key] = $version
                    }
                } else {
                    # JS específico do app
                    $appName = $appMapping[$filePath]
                    if ($appName) {
                        if ($fileName -match 'database') {
                            $versions["$appName-database"] = $version
                        } elseif ($fileName -eq "index-script.js") {
                            $versions["index-js"] = $version
                        } elseif ($fileName -eq "config-script.js") {
                            $versions["solar-config-js"] = $version
                        } elseif ($fileName -match '(.+)-script\.js') {
                            $matchedApp = $matches[1]
                            if ($appMapping.Values -contains $matchedApp) {
                                $versions["$matchedApp-js"] = $version
                            }
                        }
                    }
                }
            }
        }
    }
    
    return $versions
}

function Update-HTMLFromJSON {
    Write-Host "Atualizando arquivos HTML a partir de versions.json..." -ForegroundColor Cyan
    
    $totalUpdated = 0
    
    foreach ($htmlFile in $appMapping.Keys) {
        if (-not (Test-Path $htmlFile)) {
            continue
        }
        
        $appName = $appMapping[$htmlFile]
        $appVersions = $versionsJson.apps.$appName
        
        if (-not $appVersions) {
            continue
        }
        
        $content = Get-Content $htmlFile -Raw -Encoding UTF8
        $originalContent = $content
        $fileUpdated = $false
        
        # Atualiza CSS do app (caso especial para index)
        if ($appVersions.css) {
            if ($appName -eq "index") {
                $cssPattern = "(index-styles\.css\?v=)(\d+\.\d+\.\d+)"
            } else {
                $cssPattern = "($appName-styles\.css\?v=)(\d+\.\d+\.\d+)"
            }
            if ($content -match $cssPattern) {
                $content = $content -replace $cssPattern, "`$1$($appVersions.css)"
                $fileUpdated = $true
            }
        }
        
        # Atualiza JS do app (caso especial para index e solar-config)
        if ($appVersions.js) {
            if ($appName -eq "index") {
                $jsPattern = "(index-script\.js\?v=)(\d+\.\d+\.\d+)"
            } elseif ($appName -eq "solar-config") {
                $jsPattern = "(config-script\.js\?v=)(\d+\.\d+\.\d+)"
            } else {
                $jsPattern = "($appName-script\.js\?v=)(\d+\.\d+\.\d+)"
            }
            if ($content -match $jsPattern) {
                $content = $content -replace $jsPattern, "`$1$($appVersions.js)"
                $fileUpdated = $true
            }
        }
        
        # Atualiza database se existir
        if ($appVersions.database) {
            $dbPattern = "($appName-database\.js\?v=)(\d+\.\d+\.\d+)"
            if ($content -match $dbPattern) {
                $content = $content -replace $dbPattern, "`$1$($appVersions.database)"
                $fileUpdated = $true
            }
        }
        
        # Atualiza shared-styles.css
        if ($versionsJson.shared.'shared-styles') {
            $sharedPattern = "(shared-styles\.css\?v=)(\d+\.\d+\.\d+)"
            if ($content -match $sharedPattern) {
                $content = $content -replace $sharedPattern, "`$1$($versionsJson.shared.'shared-styles')"
                $fileUpdated = $true
            }
        }
        
        # Atualiza controls-styles.css
        if ($versionsJson.shared.'controls-styles') {
            $controlsPattern = "(controls-styles\.css\?v=)(\d+\.\d+\.\d+)"
            if ($content -match $controlsPattern) {
                $content = $content -replace $controlsPattern, "`$1$($versionsJson.shared.'controls-styles')"
                $fileUpdated = $true
            }
        }
        
        # Atualiza site-config.js
        if ($versionsJson.shared.'site-config') {
            $siteConfigPattern = "(site-config\.js\?v=)(\d+\.\d+\.\d+)"
            if ($content -match $siteConfigPattern) {
                $content = $content -replace $siteConfigPattern, "`$1$($versionsJson.shared.'site-config')"
                $fileUpdated = $true
            }
        }
        
        # Atualiza ajustarValorUtil.js
        if ($versionsJson.shared.ajustarValorUtil) {
            $ajustarPattern = "(ajustarValorUtil\.js\?v=)(\d+\.\d+\.\d+)"
            if ($content -match $ajustarPattern) {
                $content = $content -replace $ajustarPattern, "`$1$($versionsJson.shared.ajustarValorUtil)"
                $fileUpdated = $true
            }
        }
        
        if ($fileUpdated) {
            Set-Content -Path $htmlFile -Value $content -Encoding UTF8 -NoNewline
            Write-Host "[OK] Atualizado: $htmlFile" -ForegroundColor Green
            $totalUpdated++
        }
    }
    
    Write-Host ""
    Write-Host "Arquivos atualizados: $totalUpdated" -ForegroundColor Yellow
}

function Update-JSONFromHTML {
    Write-Host "Lendo versões dos arquivos HTML e atualizando versions.json..." -ForegroundColor Cyan
    
    $allVersions = @{}
    
    foreach ($htmlFile in $appMapping.Keys) {
        if (-not (Test-Path $htmlFile)) {
            continue
        }
        
        $content = Get-Content $htmlFile -Raw -Encoding UTF8
        $versions = Extract-Version -content $content -filePath $htmlFile
        
        foreach ($key in $versions.Keys) {
            $allVersions[$key] = $versions[$key]
        }
    }
    
    # Atualiza versions.json com as versões encontradas
    $updated = $false
    
    foreach ($appName in $appMapping.Values) {
        if ($allVersions["$appName-css"]) {
            if (-not $versionsJson.apps.$appName) {
                $versionsJson.apps | Add-Member -MemberType NoteProperty -Name $appName -Value @{}
            }
            if ($versionsJson.apps.$appName.css -ne $allVersions["$appName-css"]) {
                $versionsJson.apps.$appName.css = $allVersions["$appName-css"]
                $updated = $true
                Write-Host "[ATUALIZADO] $appName.css: $($allVersions["$appName-css"])" -ForegroundColor Green
            }
        }
        
        if ($allVersions["$appName-js"]) {
            if (-not $versionsJson.apps.$appName) {
                $versionsJson.apps | Add-Member -MemberType NoteProperty -Name $appName -Value @{}
            }
            if ($versionsJson.apps.$appName.js -ne $allVersions["$appName-js"]) {
                $versionsJson.apps.$appName.js = $allVersions["$appName-js"]
                $updated = $true
                Write-Host "[ATUALIZADO] $appName.js: $($allVersions["$appName-js"])" -ForegroundColor Green
            }
        }
        
        if ($allVersions["$appName-database"]) {
            if (-not $versionsJson.apps.$appName) {
                $versionsJson.apps | Add-Member -MemberType NoteProperty -Name $appName -Value @{}
            }
            if ($versionsJson.apps.$appName.database -ne $allVersions["$appName-database"]) {
                $versionsJson.apps.$appName.database = $allVersions["$appName-database"]
                $updated = $true
                Write-Host "[ATUALIZADO] $appName.database: $($allVersions["$appName-database"])" -ForegroundColor Green
            }
        }
    }
    
    # Atualiza shared
    foreach ($sharedKey in $sharedMapping.Values) {
        if ($allVersions[$sharedKey]) {
            if ($versionsJson.shared.$sharedKey -ne $allVersions[$sharedKey]) {
                $versionsJson.shared.$sharedKey = $allVersions[$sharedKey]
                $updated = $true
                Write-Host "[ATUALIZADO] shared.${sharedKey}: $($allVersions[$sharedKey])" -ForegroundColor Green
            }
        }
    }
    
    if ($updated) {
        # Atualiza data de última modificação
        $versionsJson.lastUpdated = Get-Date -Format "yyyy-MM-dd"
        
        # Salva o JSON
        $versionsJson | ConvertTo-Json -Depth 10 | Set-Content -Path $versionsJsonPath -Encoding UTF8
        Write-Host ""
        Write-Host "[OK] versions.json atualizado!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "[INFO] Nenhuma atualização necessária" -ForegroundColor Yellow
    }
}

# Executa conforme o modo selecionado
switch ($Mode) {
    "ReadHTML" {
        Update-JSONFromHTML
    }
    "ReadJSON" {
        Update-HTMLFromJSON
    }
    "Both" {
        Update-JSONFromHTML
        Write-Host ""
        Update-HTMLFromJSON
    }
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "CONCLUIDO" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
