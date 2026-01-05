# Script de Migração Progressiva dos Apps
# Converte apps para a nova arquitetura modular

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('bugs', 'sobre', 'helice', 'bitola', 'mutuo', 'arcondicionado', 'aquecimento', 'solar', 'fazenda', 'index')]
    [string]$App = '',
    
    [Parameter(Mandatory=$false)]
    [switch]$VerificarApenas,
    
    [Parameter(Mandatory=$false)]
    [switch]$TodosApps
)

$rootDir = $PSScriptRoot | Split-Path -Parent

function Write-ColorOutput {
    param([string]$Message, [string]$Color = 'White')
    Write-Host $Message -ForegroundColor $Color
}

function Get-AppStatus {
    param([string]$AppName)
    
    $scriptPath = Join-Path $rootDir "$AppName\$AppName-script.js"
    $newScriptPath = Join-Path $rootDir "$AppName\$AppName-script-new.js"
    $i18nPath = Join-Path $rootDir "src\i18n\$AppName.json"
    
    $status = @{
        Nome = $AppName
        ScriptOriginal = Test-Path $scriptPath
        ScriptNovo = Test-Path $newScriptPath
        TraducoesJSON = Test-Path $i18nPath
        Status = 'Não iniciado'
    }
    
    if ($status.ScriptNovo -and $status.TraducoesJSON) {
        $status.Status = 'Migrado'
    } elseif ($status.ScriptNovo -or $status.TraducoesJSON) {
        $status.Status = 'Em progresso'
    }
    
    return $status
}

function Show-AppStatus {
    Write-ColorOutput "`n=== STATUS DE MIGRAÇÃO DOS APPS ===" Cyan
    Write-Host ""
    
    $apps = @('bugs', 'sobre', 'helice', 'bitola', 'mutuo', 'arcondicionado', 'aquecimento', 'solar', 'fazenda', 'index')
    
    $migrados = 0
    $emProgresso = 0
    $pendentes = 0
    
    foreach ($app in $apps) {
        $status = Get-AppStatus $app
        
        $cor = 'Gray'
        $icone = '⏳'
        
        switch ($status.Status) {
            'Migrado' { 
                $icone = '✅'
                $cor = 'Green'
                $migrados++
            }
            'Em progresso' { 
                $icone = '🔄'
                $cor = 'Yellow'
                $emProgresso++
            }
            default { 
                $icone = '⏳'
                $cor = 'Gray'
                $pendentes++
            }
        }
        
        $detalhes = @()
        if ($status.ScriptNovo) { $detalhes += 'Script' }
        if ($status.TraducoesJSON) { $detalhes += 'i18n' }
        
        $detalhesStr = if ($detalhes.Count -gt 0) { " (" + ($detalhes -join ', ') + ")" } else { "" }
        
        Write-Host ("  {0} {1,-20} {2}" -f $icone, $app, $status.Status) -ForegroundColor $cor
        if ($detalhesStr) {
            Write-Host ("     {0}" -f $detalhesStr) -ForegroundColor DarkGray
        }
    }
    
    Write-Host ""
    Write-ColorOutput "📊 RESUMO:" Cyan
    Write-ColorOutput "   ✅ Migrados: $migrados/$($apps.Count)" Green
    Write-ColorOutput "   🔄 Em progresso: $emProgresso/$($apps.Count)" Yellow
    Write-ColorOutput "   ⏳ Pendentes: $pendentes/$($apps.Count)" Gray
    Write-Host ""
    
    $percentual = [math]::Round(($migrados / $apps.Count) * 100, 1)
    Write-ColorOutput "   Progresso total: $percentual%" Magenta
    Write-Host ""
}

function Backup-OriginalScript {
    param([string]$AppName)
    
    $scriptPath = Join-Path $rootDir "$AppName\$AppName-script.js"
    $backupPath = Join-Path $rootDir "$AppName\$AppName-script-old.js"
    
    if ((Test-Path $scriptPath) -and !(Test-Path $backupPath)) {
        Copy-Item $scriptPath $backupPath -Force
        Write-ColorOutput "   📦 Backup criado: $AppName-script-old.js" DarkGray
        return $true
    }
    return $false
}

function Extract-Traducoes {
    param([string]$AppName)
    
    Write-ColorOutput "`n🔍 Extraindo traduções de $AppName..." Yellow
    
    $scriptPath = Join-Path $rootDir "$AppName\$AppName-script.js"
    if (!(Test-Path $scriptPath)) {
        Write-ColorOutput "   ❌ Script não encontrado!" Red
        return $false
    }
    
    # Análise básica do arquivo para identificar padrões de tradução
    $content = Get-Content $scriptPath -Raw
    
    # Procurar por objetos 'traducoes' ou similares
    if ($content -match "traducoes\s*=\s*\{") {
        Write-ColorOutput "   ✓ Objeto de traduções encontrado" Green
    } else {
        Write-ColorOutput "   ⚠ Padrão de traduções não detectado automaticamente" Yellow
        Write-ColorOutput "     Será necessário extração manual" DarkGray
    }
    
    $i18nPath = Join-Path $rootDir "src\i18n\$AppName.json"
    if (!(Test-Path $i18nPath)) {
        Write-ColorOutput "   ⚠ Arquivo de tradução JSON não existe ainda" Yellow
        Write-ColorOutput "     Criar manualmente em: $i18nPath" DarkGray
        return $false
    }
    
    return $true
}

function Migrate-App {
    param([string]$AppName)
    
    Write-ColorOutput "`n🚀 MIGRANDO APP: $AppName" Cyan
    Write-ColorOutput "════════════════════════════════════════" Cyan
    
    # 1. Backup
    Write-ColorOutput "`n1. Criando backup..." White
    Backup-OriginalScript $AppName
    
    # 2. Extrair traduções
    Write-ColorOutput "`n2. Analisando traduções..." White
    Extract-Traducoes $AppName
    
    # 3. Verificar dependências
    Write-ColorOutput "`n3. Verificando dependências..." White
    $modulosNecessarios = @(
        'src/core/app.js',
        'src/core/i18n.js',
        'src/utils/formatters.js',
        'src/utils/storage.js',
        'src/utils/dom.js'
    )
    
    $todosPresentas = $true
    foreach ($modulo in $modulosNecessarios) {
        $moduloPath = Join-Path $rootDir $modulo
        if (Test-Path $moduloPath) {
            Write-ColorOutput "   ✓ $modulo" Green
        } else {
            Write-ColorOutput "   ✗ $modulo" Red
            $todosPresentas = $false
        }
    }
    
    if (!$todosPresentas) {
        Write-ColorOutput "`n❌ Dependências faltando! Execute primeiro a criação dos módulos core." Red
        return $false
    }
    
    Write-ColorOutput "`n✅ APP PRONTO PARA MIGRAÇÃO MANUAL" Green
    Write-ColorOutput "`n📝 PRÓXIMOS PASSOS:" Yellow
    Write-ColorOutput "   1. Criar src/i18n/$AppName.json com traduções" White
    Write-ColorOutput "   2. Criar $AppName/$AppName-script-new.js usando template" White
    Write-ColorOutput "   3. Importar módulos necessários:" White
    Write-ColorOutput "      import { App, i18n } from '../src/core/app.js';" DarkGray
    Write-ColorOutput "      import { formatarMoeda } from '../src/utils/formatters.js';" DarkGray
    Write-ColorOutput "   4. Testar com: npm run dev" White
    Write-ColorOutput "   5. Atualizar HTML para usar script novo" White
    Write-Host ""
    
    return $true
}

# Execução principal
if ($VerificarApenas -or !$App) {
    Show-AppStatus
    
    if (!$App) {
        Write-ColorOutput "💡 USO:" Cyan
        Write-ColorOutput "   .\scripts\migrate-apps.ps1 -App <nome>" White
        Write-ColorOutput "   .\scripts\migrate-apps.ps1 -VerificarApenas" White
        Write-Host ""
    }
} elseif ($TodosApps) {
    $apps = @('bugs', 'sobre', 'helice', 'bitola', 'mutuo', 'arcondicionado', 'aquecimento', 'solar', 'fazenda')
    foreach ($a in $apps) {
        $status = Get-AppStatus $a
        if ($status.Status -eq 'Não iniciado') {
            Migrate-App $a
        }
    }
} else {
    Migrate-App $App
}
