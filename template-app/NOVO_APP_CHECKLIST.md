# Checklist — Novo App

## 1. Criar arquivos do app
- [ ] Copiar `template-app/` → `NOME-APP/`
- [ ] Renomear: `TEMPLATE_APP.html` → `NOME-APP.html`
- [ ] Renomear: `TEMPLATE_APP-script.js` → `NOME-APP-script.js`
- [ ] Renomear: `TEMPLATE_APP-styles.css` → `NOME-APP-styles.css`
- [ ] Substituir todas as ocorrências de `NOME-APP` nos arquivos

## 2. Tradução i18n
- [ ] Copiar `src/i18n/TEMPLATE_APP.json` → `src/i18n/NOME-APP.json`
- [ ] Preencher todas as chaves em `pt-BR` e `it-IT`
- [ ] Adicionar entrada em `src/i18n/index.json` (para o card na homepage)

## 3. Registrar nos arquivos globais
- [ ] `config/versions.json` — adicionar `"NOME-APP": "1.0.0"` e atualizar `lastUpdate`
- [ ] `sitemap.xml` — adicionar `<url>` da nova página
- [ ] `index.html` — adicionar card do app (ou atualizar via `index-script.js`)
- [ ] `local/vite.config.js` → `rollupOptions.input` — adicionar entrada

## 4. Validação
- [ ] Testar em PT-BR e IT-IT
- [ ] Testar em mobile (400px)
- [ ] Verificar botão home, seletor de idioma, footer
- [ ] `npm run checkup` — sem console.log
- [ ] `npm run lint:check` — sem erros de lint

## 5. Remover antes do commit
- [ ] Deletar `template-app/NOVO_APP_CHECKLIST.md` do app copiado
- [ ] Deletar `template-app/TEMPLATE_APP.*` do app copiado
