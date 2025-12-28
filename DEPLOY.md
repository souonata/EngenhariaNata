# Processo de Deploy - Engenharia NATA

Este documento descreve o processo completo de deploy do projeto Engenharia NATA.

## 📋 Pré-requisitos

- Git instalado e configurado
- Acesso ao repositório remoto
- PowerShell (Windows) ou terminal compatível

## 🚀 Processo de Deploy

### 1. Verificações Pré-Deploy

Antes de fazer deploy, execute as verificações:

```powershell
# Executa todas as verificações pré-commit
powershell -ExecutionPolicy Bypass -File scripts\pre-commit-checks.ps1

# Valida traduções
powershell -ExecutionPolicy Bypass -File scripts\validate-translations.ps1

# Valida dependências
powershell -ExecutionPolicy Bypass -File scripts\validate-dependencies.ps1
```

**Verificações obrigatórias:**
- ✅ Nenhum `console.log` no código
- ✅ Todas as traduções completas (PT-BR e IT-IT)
- ✅ Todas as dependências encontradas
- ✅ Cache-busting em todos os arquivos HTML
- ✅ Estrutura completa dos apps

### 2. Sincronização de Versões

Sincronize as versões entre `config/versions.json` e os arquivos HTML:

```powershell
# Opção 1: Ler versões dos HTMLs e atualizar versions.json (recomendado)
powershell -ExecutionPolicy Bypass -File scripts\sync-versions.ps1 -Mode ReadHTML

# Opção 2: Ler versions.json e atualizar HTMLs
powershell -ExecutionPolicy Bypass -File scripts\sync-versions.ps1 -Mode ReadJSON

# Opção 3: Ambos (sincronização bidirecional)
powershell -ExecutionPolicy Bypass -File scripts\sync-versions.ps1 -Mode Both
```

### 3. Atualização de Cache-Busting (Opcional)

Se necessário, incremente versões para forçar atualização de cache:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\update-cache-busting.ps1
```

**Nota:** Use com cuidado - isso incrementa TODAS as versões automaticamente.

### 4. Atualização de Estatísticas (Opcional)

Se o código foi modificado significativamente, atualize as estatísticas:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\count-lines.ps1
```

### 5. Commit e Push

```powershell
# Verifica status do Git
git status

# Adiciona todos os arquivos modificados
git add .

# Cria commit com mensagem descritiva
git commit -m "Descrição das alterações realizadas"

# Faz push para o repositório remoto
git push origin main
```

### 6. Verificação Pós-Deploy

Após o deploy, verifique:

- ✅ Site carrega corretamente
- ✅ Todos os apps funcionam
- ✅ Tradução PT-BR e IT-IT funcionam
- ✅ Service Worker atualizado (se necessário)
- ✅ Cache do navegador atualizado

## 📝 Checklist de Deploy

Use esta checklist antes de cada deploy:

- [ ] Executou `pre-commit-checks.ps1` sem erros
- [ ] Executou `validate-translations.ps1` sem erros
- [ ] Executou `validate-dependencies.ps1` sem erros
- [ ] Sincronizou versões (`sync-versions.ps1`)
- [ ] Atualizou `config/versions.json` se necessário
- [ ] Atualizou Service Worker se necessário (`sw.js`)
- [ ] Testou localmente todos os apps principais
- [ ] Verificou traduções em ambos os idiomas
- [ ] Commit com mensagem descritiva
- [ ] Push realizado com sucesso

## 🔄 Atualização do Service Worker

Se recursos estáticos foram adicionados ou modificados:

1. Edite `sw.js`
2. Incremente `CACHE_VERSION` (ex: `v1.1.0` → `v1.2.0`)
3. Atualize `CACHE_NAME` correspondente
4. Atualize `config/versions.json` → `serviceWorker.version`
5. Adicione novos recursos em `STATIC_ASSETS` se necessário

## 🌐 Hosting

O site está hospedado em:
- **URL Principal**: https://engnata.infinityfree.me
- **Domínio Alternativo**: https://engnata.eu (redireciona para URL principal)

### Configuração do Servidor

- **Tipo**: InfinityFree (Free Hosting)
- **Protocolo**: HTTP/HTTPS
- **Service Worker**: Suportado (requer HTTPS ou localhost)

## 📦 Estrutura de Arquivos no Deploy

```
/
├── index.html (página inicial)
├── favicon.svg
├── robots.txt
├── sitemap.xml
├── sw.js (Service Worker)
├── assets/
│   ├── css/
│   │   ├── shared-styles.css
│   │   └── controls-styles.css
│   └── js/
│       ├── site-config.js
│       └── ajustarValorUtil.js
├── [app]/
│   ├── [app].html
│   ├── [app]-script.js
│   └── [app]-styles.css
└── config/
    └── versions.json
```

## ⚠️ Problemas Comuns

### Cache do Navegador

Se alterações não aparecem após deploy:
1. Verifique se as versões foram incrementadas (`?v=X.Y.Z`)
2. Limpe o cache do navegador (Ctrl+F5)
3. Verifique se o Service Worker não está bloqueando atualizações

### Service Worker Desatualizado

Se o Service Worker está servindo versões antigas:
1. Incremente `CACHE_VERSION` em `sw.js`
2. Atualize `config/versions.json`
3. Faça deploy
4. Limpe cache do navegador ou use modo anônimo

### Dependências Não Encontradas

Se houver erros de dependências:
1. Execute `validate-dependencies.ps1`
2. Verifique caminhos relativos nos HTMLs
3. Confirme que todos os arquivos foram commitados

## 📚 Scripts Disponíveis

- `scripts/pre-commit-checks.ps1` - Verificações antes do commit
- `scripts/validate-translations.ps1` - Validação de traduções
- `scripts/validate-dependencies.ps1` - Validação de dependências
- `scripts/sync-versions.ps1` - Sincronização de versões
- `scripts/update-cache-busting.ps1` - Incremento de versões
- `scripts/count-lines.ps1` - Contagem de linhas de código

## 🔗 Referências

- [README.md](README.md) - Documentação geral do projeto
- [scripts/pre-commit-checks.md](scripts/pre-commit-checks.md) - Checklist manual completa
- [config/versions.json](config/versions.json) - Controle centralizado de versões
