# Plano de Atualização Completa do Site - Engenharia NATA

Este documento descreve o processo completo e detalhado para atualizar todo o conteúdo do site, executar todos os scripts de validação e sincronização, e preparar o projeto para commit.

## 📋 Visão Geral

Este plano garante que todas as atualizações sejam feitas de forma segura, sistemática e verificável, mesmo quebrar em até 50 passos pequenos e gerenciáveis.

## 🎯 Objetivos

1. Executar todos os scripts de validação e sincronização
2. Atualizar todo o conteúdo do site (README, sobre, documentação)
3. Verificar consistência de versões
4. Validar traduções e dependências
5. Preparar para commit seguro

## 📁 Arquivos de Suporte Criados Durante o Processo

Durante a execução, serão criados arquivos temporários para rascunhos e anotações:

- `_temp_script_results.txt` - Resultados dos scripts executados
- `_temp_version_check.txt` - Verificação de versões
- `_temp_content_updates.txt` - Lista de atualizações de conteúdo
- `_temp_validation_results.txt` - Resultados de validações
- `_temp_final_checklist.txt` - Checklist final antes do commit

---

## 🔄 PROCESSO COMPLETO (50 Passos)

### FASE 1: Preparação e Análise Inicial (Passos 1-10)

#### Passo 1: Criar arquivo de rascunho para resultados dos scripts
**Ação:** Criar `_temp_script_results.txt` vazio para armazenar resultados
**Verificação:** Arquivo criado e acessível

#### Passo 2: Verificar estrutura de diretórios
**Ação:** Listar e verificar existência de:
- `scripts/` (todos os scripts PowerShell)
- `config/versions.json`
- `README.md`
- `sobre/sobre.html`
- Todos os diretórios de apps
**Verificação:** Todos os diretórios existem

#### Passo 3: Ler e documentar estado atual de `config/versions.json`
**Ação:** Ler `config/versions.json` e salvar estado inicial em `_temp_version_check.txt`
**Verificação:** Arquivo criado com versões atuais

#### Passo 4: Identificar todos os scripts disponíveis
**Ação:** Listar scripts em `scripts/`:
- `pre-commit-checks.ps1`
- `validate-translations.ps1`
- `validate-dependencies.ps1`
- `sync-versions.ps1`
- `update-cache-busting.ps1`
- `count-lines.ps1`
- `analyze-bundle-size.ps1`
- `optimize-svgs.ps1`
**Verificação:** Lista completa de scripts documentada

#### Passo 5: Verificar permissões de execução PowerShell
**Ação:** Verificar se PowerShell pode executar scripts (ExecutionPolicy)
**Verificação:** Scripts podem ser executados

#### Passo 6: Criar arquivo de anotações de conteúdo
**Ação:** Criar `_temp_content_updates.txt` para listar atualizações necessárias
**Verificação:** Arquivo criado

#### Passo 7: Ler README.md atual
**Ação:** Ler `README.md` completo para entender estado atual
**Verificação:** Conteúdo lido e compreendido

#### Passo 8: Ler sobre/sobre.html atual
**Ação:** Ler `sobre/sobre.html` para verificar estatísticas e informações
**Verificação:** Conteúdo lido

#### Passo 9: Verificar estado do Git
**Ação:** Executar `git status` e documentar arquivos modificados
**Verificação:** Estado do Git documentado

#### Passo 10: Criar checklist inicial
**Ação:** Criar `_temp_final_checklist.txt` com checklist vazio para preencher
**Verificação:** Arquivo criado

---

### FASE 2: Execução de Scripts de Validação (Passos 11-20)

#### Passo 11: Executar pre-commit-checks.ps1
**Ação:** 
```powershell
powershell -ExecutionPolicy Bypass -File scripts\pre-commit-checks.ps1
```
**Salvar resultado em:** `_temp_script_results.txt`
**Verificação:** Script executado, resultado salvo
**Se houver erros:** Documentar em `_temp_validation_results.txt` e pausar para correção

#### Passo 12: Analisar resultados do pre-commit-checks
**Ação:** Ler `_temp_script_results.txt` e identificar:
- console.log encontrados (se houver)
- Código morto (se houver)
- Problemas de cache-busting (se houver)
- Estrutura de apps incompleta (se houver)
**Verificação:** Análise completa documentada
**Se houver problemas:** Criar lista de correções necessárias

#### Passo 13: Executar validate-translations.ps1
**Ação:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\validate-translations.ps1
```
**Salvar resultado em:** `_temp_script_results.txt` (append)
**Verificação:** Script executado
**Se houver erros:** Documentar traduções faltando

#### Passo 14: Analisar resultados de traduções
**Ação:** Verificar se todas as traduções estão completas (PT-BR e IT-IT)
**Verificação:** Análise documentada
**Se houver problemas:** Listar chaves faltando

#### Passo 15: Executar validate-dependencies.ps1
**Ação:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\validate-dependencies.ps1
```
**Salvar resultado em:** `_temp_script_results.txt` (append)
**Verificação:** Script executado
**Se houver erros:** Documentar dependências faltando

#### Passo 16: Analisar resultados de dependências
**Ação:** Verificar se todos os arquivos CSS/JS referenciados existem
**Verificação:** Análise completa
**Se houver problemas:** Listar arquivos faltando

#### Passo 17: Executar sync-versions.ps1 -Mode ReadHTML
**Ação:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\sync-versions.ps1 -Mode ReadHTML
```
**Salvar resultado em:** `_temp_script_results.txt` (append)
**Verificação:** Versões sincronizadas do HTML para JSON

#### Passo 18: Verificar sincronização de versões
**Ação:** Comparar versões em `config/versions.json` com versões nos HTMLs
**Verificação:** Versões consistentes
**Se houver inconsistências:** Documentar e corrigir

#### Passo 19: Executar count-lines.ps1
**Ação:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\count-lines.ps1
```
**Salvar resultado em:** `_temp_script_results.txt` (append)
**Verificação:** Estatísticas de linhas atualizadas

#### Passo 20: Analisar estatísticas de linhas
**Ação:** Ler resultados e verificar se precisam ser atualizados em `sobre/sobre.html`
**Verificação:** Decisão tomada sobre atualização

---

### FASE 3: Execução de Scripts de Análise (Passos 21-25)

#### Passo 21: Executar analyze-bundle-size.ps1
**Ação:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\analyze-bundle-size.ps1
```
**Salvar resultado em:** `_temp_script_results.txt` (append)
**Verificação:** Análise de tamanhos executada

#### Passo 22: Analisar resultados de bundle size
**Ação:** Identificar arquivos grandes que podem ser otimizados
**Verificação:** Análise documentada

#### Passo 23: Executar optimize-svgs.ps1 (opcional)
**Ação:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\optimize-svgs.ps1
```
**Salvar resultado em:** `_temp_script_results.txt` (append)
**Verificação:** SVGs otimizados (se aplicável)

#### Passo 24: Verificar se há necessidade de update-cache-busting
**Ação:** Decidir se precisa incrementar versões automaticamente
**Verificação:** Decisão documentada
**Nota:** Geralmente NÃO executar automaticamente, apenas se explicitamente necessário

#### Passo 25: Consolidar resultados dos scripts
**Ação:** Criar resumo em `_temp_validation_results.txt` com:
- Scripts executados com sucesso
- Problemas encontrados
- Ações necessárias
**Verificação:** Resumo completo criado

---

### FASE 4: Atualização de Conteúdo (Passos 26-35)

#### Passo 26: Atualizar README.md com informações atuais
**Ação:** Verificar e atualizar:
- Versões dos apps (especialmente apps DEV com 0.X.X)
- Lista de scripts disponíveis
- Informações sobre versões nos ícones
- Links e referências
**Verificação:** README atualizado e consistente

#### Passo 27: Atualizar sobre/sobre.html com estatísticas
**Ação:** Se `count-lines.ps1` foi executado, atualizar estatísticas de linhas
**Verificação:** Estatísticas atualizadas

#### Passo 28: Verificar e atualizar DEPLOY.md
**Ação:** Garantir que DEPLOY.md reflete processos atuais
**Verificação:** Documentação atualizada

#### Passo 29: Verificar e atualizar .github/copilot-instructions.md
**Ação:** Garantir que instruções estão atualizadas
**Verificação:** Instruções revisadas

#### Passo 30: Verificar versões nos ícones (index.html)
**Ação:** Confirmar que versões nos ícones estão corretas (0.X.X para DEV, 1.X.X para lançados)
**Verificação:** Versões corretas

#### Passo 31: Atualizar index-script.js se necessário
**Ação:** Verificar se objeto `versoesApps` está atualizado
**Verificação:** Versões corretas no JavaScript

#### Passo 32: Verificar consistência de versões em todos os HTMLs
**Ação:** Verificar se versões nos HTMLs correspondem a `config/versions.json`
**Verificação:** Consistência verificada

#### Passo 33: Atualizar documentação de scripts
**Ação:** Garantir que README.md documenta todos os scripts corretamente
**Verificação:** Documentação completa

#### Passo 34: Verificar links e referências
**Ação:** Verificar se todos os links internos funcionam
**Verificação:** Links verificados

#### Passo 35: Consolidar atualizações de conteúdo
**Ação:** Criar lista final em `_temp_content_updates.txt` com todas as atualizações feitas
**Verificação:** Lista completa criada

---

### FASE 5: Verificações Finais (Passos 36-45)

#### Passo 36: Re-executar pre-commit-checks.ps1
**Ação:** Executar novamente após todas as atualizações
**Salvar resultado em:** `_temp_script_results.txt` (append)
**Verificação:** Nenhum erro encontrado

#### Passo 37: Re-executar validate-translations.ps1
**Ação:** Verificar traduções novamente
**Verificação:** Todas as traduções completas

#### Passo 38: Re-executar validate-dependencies.ps1
**Ação:** Verificar dependências novamente
**Verificação:** Todas as dependências encontradas

#### Passo 39: Verificar sincronização final de versões
**Ação:** Executar `sync-versions.ps1 -Mode ReadHTML` novamente
**Verificação:** Versões sincronizadas

#### Passo 40: Verificar estado do Git final
**Ação:** Executar `git status` e documentar arquivos modificados
**Verificação:** Estado documentado

#### Passo 41: Criar checklist final
**Ação:** Preencher `_temp_final_checklist.txt` com:
- [ ] Todos os scripts executados sem erros críticos
- [ ] Versões sincronizadas
- [ ] Traduções completas
- [ ] Dependências validadas
- [ ] Conteúdo atualizado
- [ ] README atualizado
- [ ] Documentação atualizada
**Verificação:** Checklist completo

#### Passo 42: Verificar se há arquivos temporários para limpar
**Ação:** Listar arquivos `_temp_*.txt` criados
**Verificação:** Lista criada
**Nota:** Manter arquivos temporários até commit bem-sucedido

#### Passo 43: Verificar Service Worker (sw.js)
**Ação:** Verificar se `sw.js` está atualizado se necessário
**Verificação:** Service Worker verificado

#### Passo 44: Verificar sitemap.xml e robots.txt
**Ação:** Verificar se estão atualizados
**Verificação:** Arquivos verificados

#### Passo 45: Criar resumo executivo
**Ação:** Criar resumo final em `_temp_final_summary.txt` com:
- Scripts executados
- Atualizações realizadas
- Problemas encontrados e resolvidos
- Próximos passos recomendados
**Verificação:** Resumo criado

---

### FASE 6: Preparação para Commit (Passos 46-50)

#### Passo 46: Revisar todos os arquivos modificados
**Ação:** Listar todos os arquivos que serão commitados
**Verificação:** Lista completa

#### Passo 47: Verificar se há mudanças não intencionais
**Ação:** Revisar diff dos arquivos principais
**Verificação:** Apenas mudanças intencionais

#### Passo 48: Preparar mensagem de commit
**Ação:** Criar mensagem descritiva baseada em `_temp_content_updates.txt`
**Verificação:** Mensagem preparada

#### Passo 49: Verificar se está pronto para commit
**Ação:** Revisar checklist final e garantir que tudo está OK
**Verificação:** Pronto para commit

#### Passo 50: Documentar processo completo
**Ação:** Criar arquivo `_temp_process_log.txt` com log completo de todos os passos executados
**Verificação:** Log completo criado

---

## 📝 Checklist Final Antes do Commit

Antes de fazer commit, verificar:

- [ ] Todos os scripts executados sem erros críticos
- [ ] Versões sincronizadas (`config/versions.json` ↔ HTMLs)
- [ ] Traduções completas (PT-BR e IT-IT)
- [ ] Dependências validadas (todos os arquivos existem)
- [ ] README.md atualizado
- [ ] sobre/sobre.html atualizado (se necessário)
- [ ] Documentação atualizada
- [ ] Versões nos ícones corretas (0.X.X para DEV, 1.X.X para lançados)
- [ ] Nenhum console.log no código (exceto em bugs/ e fazenda/ se necessário)
- [ ] Cache-busting em todos os HTMLs
- [ ] Service Worker atualizado (se necessário)
- [ ] Git status verificado
- [ ] Mensagem de commit preparada

---

## 🚨 Tratamento de Erros

### Se um script falhar:
1. Documentar erro em `_temp_validation_results.txt`
2. Analisar causa raiz
3. Corrigir problema
4. Re-executar script
5. Continuar processo

### Se houver inconsistências de versão:
1. Documentar em `_temp_version_check.txt`
2. Decidir fonte de verdade (HTML ou JSON)
3. Executar `sync-versions.ps1` no modo apropriado
4. Verificar novamente

### Se houver traduções faltando:
1. Documentar em `_temp_validation_results.txt`
2. Adicionar traduções faltando
3. Re-executar `validate-translations.ps1`
4. Continuar processo

---

## 📊 Arquivos Temporários Criados

Durante a execução, os seguintes arquivos serão criados:

- `_temp_script_results.txt` - Resultados de todos os scripts
- `_temp_version_check.txt` - Verificação de versões
- `_temp_content_updates.txt` - Lista de atualizações
- `_temp_validation_results.txt` - Resultados de validações
- `_temp_final_checklist.txt` - Checklist final
- `_temp_final_summary.txt` - Resumo executivo
- `_temp_process_log.txt` - Log completo do processo

**Nota:** Esses arquivos podem ser mantidos para referência ou removidos após commit bem-sucedido.

---

## 🔄 Como Usar Este Plano

1. **Leia o plano completo** antes de começar
2. **Execute cada passo sequencialmente**
3. **Documente resultados** em arquivos temporários
4. **Pause se encontrar erros** e resolva antes de continuar
5. **Verifique checklist final** antes do commit
6. **Mantenha arquivos temporários** até commit bem-sucedido

---

## 📚 Referências

- [README.md](README.md) - Documentação geral
- [DEPLOY.md](DEPLOY.md) - Processo de deploy
- [scripts/pre-commit-checks.md](scripts/pre-commit-checks.md) - Checklist manual
- [config/versions.json](config/versions.json) - Versões centralizadas

---

**Última atualização:** 2025-01-15
**Versão do plano:** 1.0.0
