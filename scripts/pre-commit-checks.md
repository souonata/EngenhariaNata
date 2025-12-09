# Rotina de Verificações Pré-Commit

Este documento descreve a rotina completa de verificações que deve ser executada antes de cada commit para garantir que o projeto esteja atualizado, consistente e livre de erros.

## 📋 Checklist de Verificações

### 1. **Verificação de Código Limpo**
- [ ] Verificar se há `console.log` no código (remover todos)
- [ ] Verificar se há código morto/comentado (remover)
- [ ] Verificar se há funções não utilizadas (remover)
- [ ] Verificar se há variáveis não utilizadas (remover)

### 2. **Verificação de Traduções (i18n)**
- [ ] Verificar se todas as strings têm tradução PT-BR e IT-IT
- [ ] Verificar se os objetos `traducoes` estão completos em todos os apps
- [ ] Verificar se as fórmulas dos memoriais estão traduzidas
- [ ] Verificar se os exemplos dinâmicos estão formatados corretamente para ambos idiomas
- [ ] Verificar se a moeda está correta (R$ para PT-BR, € para IT-IT)

### 3. **Verificação de Comentários**
- [ ] Verificar se os comentários iniciais dos arquivos de script estão atualizados
- [ ] Verificar se os comentários refletem o estado atual do código
- [ ] Verificar se há comentários explicativos nas funções complexas
- [ ] Verificar se os comentários estão em português (padrão do projeto)

### 4. **Verificação de Memoriais de Cálculo**
- [ ] Verificar se todas as fórmulas estão corretas
- [ ] Verificar se os valores de referência estão atualizados
- [ ] Verificar se os exemplos estão funcionando corretamente
- [ ] Verificar se as traduções das fórmulas estão completas
- [ ] Verificar se os memoriais estão acessíveis e funcionais

### 5. **Verificação de Valores e Constantes**
- [ ] Verificar se os valores de referência estão corretos (BTU/m², temperatura termossifão, etc.)
- [ ] Verificar se os limites estão corretos (máximo de ambientes, área total, etc.)
- [ ] Verificar se as constantes físicas estão corretas (HSP, eficiência, etc.)
- [ ] Verificar se os valores padrão estão corretos

### 6. **Verificação de Documentação**
- [ ] Verificar se o README.md está atualizado com informações atuais
- [ ] Verificar se o GLOSSARIO.md está atualizado com termos e valores corretos
- [ ] Verificar se o .github/copilot-instructions.md está atualizado
- [ ] Verificar se a página sobre/sobre.html está atualizada
- [ ] Verificar se as estatísticas de linhas de código estão atualizadas

### 7. **Verificação de Estrutura e Padrões**
- [ ] Verificar se os arquivos seguem a estrutura padrão (app.html, app-script.js, app-styles.css)
- [ ] Verificar se os cache-busting (`?v=X.Y.Z`) estão atualizados nos links CSS/JS
- [ ] Verificar se os caminhos relativos estão corretos
- [ ] Verificar se os ícones SVG estão consistentes entre páginas

### 8. **Verificação de Lint e Erros**
- [ ] Executar verificação de lint em todos os arquivos modificados
- [ ] Verificar se não há erros de sintaxe JavaScript
- [ ] Verificar se não há erros de HTML
- [ ] Verificar se não há erros de CSS

### 9. **Verificação de Funcionalidade**
- [ ] Verificar se todos os apps estão funcionando corretamente
- [ ] Verificar se a troca de idioma funciona em todos os apps
- [ ] Verificar se os cálculos estão corretos
- [ ] Verificar se os gráficos estão funcionando (quando aplicável)

### 10. **Verificação de Consistência Visual**
- [ ] Verificar se os ícones estão consistentes (SVG com gradientes)
- [ ] Verificar se as cores e gradientes estão padronizados
- [ ] Verificar se o design responsivo está funcionando
- [ ] Verificar se não há elementos visuais "estranhos" ou inconsistentes

## 🔍 Comandos Úteis

### Verificar console.log
```powershell
Get-ChildItem -Recurse -Include *.js | Select-String "console\.log" | Where-Object { $_.Path -notmatch "node_modules" }
```

### Verificar traduções faltando
```powershell
# Verificar se todas as chaves PT-BR têm correspondente IT-IT
# (verificação manual necessária nos arquivos de script)
```

### Verificar cache-busting
```powershell
Get-ChildItem -Recurse -Include *.html | Select-String "\?v="
```

### Contar linhas de código (excluindo comentários)
```powershell
powershell -ExecutionPolicy Bypass -File scripts\count-lines.ps1
```

### Verificar lint
```powershell
# Verificar erros de lint nos arquivos modificados
# (depende da ferramenta de lint configurada)
```

## 📝 Notas Importantes

- **Sempre** execute a rotina completa antes de commits importantes
- **Sempre** atualize as estatísticas de linhas após modificações significativas
- **Sempre** verifique se as traduções estão completas ao adicionar novo conteúdo
- **Sempre** remova console.log antes de commitar
- **Sempre** atualize a documentação quando houver mudanças significativas

## 🚀 Uso

Para executar esta rotina, simplesmente peça ao assistente:
- "Execute a rotina de verificações pré-commit"
- "Faça as verificações antes do commit"
- "Verifique tudo antes de commitar"

O assistente executará todas as verificações listadas acima e reportará os resultados.

