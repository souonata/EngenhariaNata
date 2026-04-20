# Guia Pré-Commit — Engenharia NATA

Checklist enxuta para manter o projeto consistente antes de cada `git commit`.

> Regra prática: se a mudança mexe em app, rode a checklist inteira. Se mexe só em docs/config/tooling local, foque nas seções `0`, `5`, `6` e `7`.

---

## 0. Diagnóstico rápido

Rodar sempre no início:

- [ ] `git status --short`
- [ ] `git diff --stat`
- [ ] `cd local && npm run validate`
- [ ] `cd local && npm run checkup`

Quando houver mudança estrutural relevante:

- [ ] `cd local && npm run build`

Notas:

- [ ] Se `npm run validate` falhar, rode `lint:check`, `format:check` e `style:check` separadamente para isolar a causa.
- [ ] `npm test` ainda não cobre o projeto; não use isso como sinal de qualidade.
- [ ] `local/server-control.js` é exceção intencional para logs de ambiente local.

## 1. Consistência do app alterado

Para cada app tocado:

- [ ] Todo texto visível está em `data-i18n`, `data-i18n-title` ou `data-i18n-aria`.
- [ ] Idioma PT/IT troca labels, unidades, memorial e moedas quando aplicável.
- [ ] O app reutiliza `src/core/`, `src/utils/`, `src/components/` e CSS compartilhado antes de duplicar código.
- [ ] O HTML mantém cabeçalho, seletor de idioma, área de resultados e navegação de volta para `../index.html`.
- [ ] Se houver sliders com botões `+/-`, o comportamento continua coerente com o padrão existente do projeto.

## 2. Memorial e explicação de cálculo

Se o app tem botão `SAIBA MAIS` ou memorial:

- [ ] `#btnMemorial`, `#btnFecharMemorial` e botão de voltar funcionam.
- [ ] O memorial atualiza quando os inputs mudam.
- [ ] Fórmulas e exemplos dinâmicos permanecem sincronizados com o resultado principal.
- [ ] As chaves de memorial existem em `pt-BR` e `it-IT`.

## 3. Resultado, moeda e normas

Quando o app trabalha com dinheiro, energia ou cálculo normativo:

- [ ] Valores monetários usam utilitário de formatação, sem concatenar moeda manualmente.
- [ ] Configurações regionais mudam junto com o idioma.
- [ ] Referências técnicas ou normativas citadas continuam corretas no texto exibido.

## 4. Revisão manual mínima

Antes de commitar mudanças em app:

- [ ] Abrir os apps alterados localmente.
- [ ] Confirmar carregamento sem erro visível.
- [ ] Testar troca de idioma.
- [ ] Testar ação principal de cálculo.
- [ ] Testar memorial/modal quando existir.
- [ ] Conferir layout em largura estreita, por exemplo `400px`.

## 5. Documentação e catálogo

Se entrou app novo, saiu app, mudou escopo de app ou houve refactor relevante:

- [ ] `README.md` reflete o catálogo real.
- [ ] `ROADMAP.md` continua coerente com o que já foi entregue e com o próximo bloco de trabalho.
- [ ] `PRE_COMMIT.md` ainda faz sentido para o fluxo atual.
- [ ] `src/i18n/index.json`, `src/i18n/sobre.json`, `index.html` e `sobre/sobre.html` continuam sincronizados.
- [ ] `config/versions.json` e `sitemap.xml` foram revisados quando necessário.

Observação:

- [ ] Os números exibidos em `sobre/sobre.html` são mantidos manualmente. Se o objetivo do commit for atualizar métricas da página institucional, revise os valores com cuidado.

## 6. Higiene de código

- [ ] Sem `console.log` ou `debugger` esquecidos no código de app.
- [ ] Sem `TODO` ou `FIXME` novos sem contexto rastreável.
- [ ] Sem arquivos temporários, credenciais, `.bak` ou artefatos indevidos no stage.
- [ ] `git diff --stat` e `git diff --cached --stat` contêm apenas mudanças intencionais.

Comando útil:

- [ ] `rg -n "TODO|FIXME" .`

## 7. Fechamento do commit

- [ ] `git status` está limpo fora das mudanças esperadas.
- [ ] A mensagem de commit explica o motivo da mudança, não só a lista de arquivos.
- [ ] O commit está focado e revisável isoladamente.
- [ ] Só fazer `push` depois de validar que docs, catálogo e app alterado contam a mesma história.

---

Quando a mudança ficar grande demais para essa lista continuar clara, vale quebrar em dois commits: um funcional e outro documental.
