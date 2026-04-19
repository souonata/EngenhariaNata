# Guia Pré-Commit — Engenharia NATA

Checklist rápido para rodar antes de cada `git commit`. O objetivo é manter o projeto consistente, simples e modular, e garantir que `README.md` e `ROADMAP.md` reflitam o estado real.

> Dica: abra este arquivo ao lado do seu editor e marque mentalmente cada item. Se algo falhar, conserte antes de commitar.

---

## 0. Escopo e comandos rápidos

Antes de tudo, defina o escopo do commit:

- [ ] **Mudança só em docs/config/local**: rode as seções `6`, `7` e `9`; pule `1` a `4` e `8` se nenhum app foi tocado.
- [ ] **Mudança em app** (`*.html`, `*.js`, `*.css`, `src/i18n/*.json`): rode a checklist completa, mas concentre a inspeção manual **apenas nos apps alterados**.
- [ ] Se o commit for uma refatoração em app legado, use esta lista como **alvo de convergência**. Nem todos os apps antigos seguem 100% do padrão ainda.

Comandos mínimos recomendados:

- [ ] `git status --short`
- [ ] `git diff --stat`
- [ ] `cd local && npm run lint:check`
- [ ] `cd local && npm run format:check`
- [ ] `cd local && npm run style:check`

Notas:

- [ ] `npm run validate` é útil, mas prefira rodar `lint:check`, `format:check` e `style:check` separadamente quando algo falhar; assim o diagnóstico fica mais claro.
- [ ] Os scripts em `local/package.json` validam o ambiente local, mas **não substituem** a revisão estrutural dos apps.
- [ ] Se `style:check` acusar `No files matching "**/*.css"` ou `format:check` incluir `.vite/`, trate isso como problema do script/configuração e não como falha funcional do app.
- [ ] O exemplo `ls -d */` abaixo funciona em shell Unix. No PowerShell, prefira `Get-ChildItem -Directory`.

## 1. Consistência entre apps

Para cada app tocado entre `chuva/`, `iluminacao/`, `ventilacao/`, `bombaagua/`, `salario/`, `mutuo/` e `solar/`, confirme o padrão abaixo:

- [ ] **Controles** usam a estrutura `controles-rapidos > controles-grid-vertical > grupo-entrada` (padrão `mutuo`).
- [ ] **Botões +/−** (`.arrow-btn`) com `HOLD_DELAY_MS = 180`: clique rápido aplica um step; segurar inicia animação contínua.
- [ ] Cada slider tem `data-step` no `.arrow-btn` (um valor por parâmetro, respeitando decimais).
- [ ] **Bilíngue**: todo texto visível usa `data-i18n`, `data-i18n-aria` ou `data-i18n-title` — nada hard-coded.
- [ ] **Troca de idioma** atualiza unidades, limites de slider monetário (BR vs IT) e o memorial.
- [ ] **Cabeçalho**: `<h1>` + `.subtitulo`, seletor de idioma `.language-selector`.
- [ ] **Resultados** têm `id="resultadosSection"` e o cabeçalho `.resultados-header-com-ajuda` com botão `#btnMemorial` (SAIBA MAIS).

## 2. Memorial (SAIBA MAIS)

- [ ] Existe `#memorialSection` com `.memorial-header`, itens `.memorial-item`, `.formula-box` e `.resumo-calculado`.
- [ ] Botão de abrir (`#btnMemorial`), fechar (`#btnFecharMemorial`) e `.btn-voltar-memorial` funcionam.
- [ ] Existe uma função dedicada para atualizar o memorial (`atualizarMemorial()` ou equivalente claramente nomeada) e ela atualiza os exemplos dinâmicos (`#memorial-exemplo-*`) a cada mudança de entrada.
- [ ] Fórmulas são apresentadas passo-a-passo, com referência à norma (`NBR xxxx`, `ASHRAE`, etc.).
- [ ] Todas as chaves `memorial.*` existem em **ambos** `pt-BR` e `it-IT` no `src/i18n/<app>.json`.

## 3. Rodapé e navegação

- [ ] `<footer>` contém `<p data-i18n="footer">` + `.footer-meta` com `.footer-github-link` apontando para `https://github.com/souonata/EngenhariaNata`.
- [ ] Apps que usam Chart.js incluem `.footer-oss` (crédito do Chart.js).
- [ ] `a.home-button-fixed` presente fora do `.container`, linkando para `../index.html`.

## 4. Moeda e limites regionais

- [ ] Resultados monetários usam `formatarMoeda(valor, moeda)` — nunca concatenam `R$` ou `€` manualmente.
- [ ] `moeda` é derivada de `i18n.obterMoeda()` ou `idioma === 'it-IT' ? 'EUR' : 'BRL'`.
- [ ] Sliders com unidade monetária (tarifa, salário bruto) têm `CONFIG` separado por idioma e reagem a `aoTrocarIdioma`.
- [ ] Intervalos realistas para IT:
  - Tarifa elétrica: `0.10 – 0.80 €/kWh` (padrão `0.30`)
  - Salário bruto anual (RAL): `12.000 – 250.000 €` (padrão `35.000`)

## 5. Simplicidade e modularidade

- [ ] Nenhum app duplica código que já está em `src/core/`, `src/utils/` ou `src/components/` (i18n, formatters, ExplicacaoResultado, App base).
- [ ] CSS compartilhado (`shared-styles.css`, `v2-components.css`, `controls-styles.css`) é reutilizado; o `*-styles.css` do app contém apenas o específico.
- [ ] Sem dependências novas no `package.json` ou scripts inline novos sem justificativa.
- [ ] Funções de cálculo são puras (recebem entrada, retornam objeto) e separadas da manipulação do DOM.
- [ ] Constantes (tabelas, fatores, faixas) ficam no topo do arquivo do app, não espalhadas.

## 6. Qualidade do código

- [ ] Sem `console.log` / `debugger` esquecidos.
- [ ] Sem `TODO` ou `FIXME` sem issue associada.
- [ ] Sem comentários explicando o que o código já diz — comentários só para o **porquê** não óbvio.
- [ ] Nenhum arquivo `.env`, credencial, ou `.bak` foi incluído no stage.
- [ ] `git diff --stat` revisado: todos os arquivos listados fazem parte da mudança intencional.

Comandos úteis:

- [ ] `rg -n "console\\.log|debugger|TODO|FIXME" .`
- [ ] `git diff --stat`
- [ ] `git diff --cached --stat`

## 7. README e ROADMAP

Abra `README.md` e `ROADMAP.md` e verifique:

- [ ] Todos os apps existentes aparecem no README.
- [ ] Para listar pastas no PowerShell: `Get-ChildItem -Directory | Select-Object -ExpandProperty Name`
- [ ] Ao conferir a lista, exclua pastas técnicas como `assets`, `src`, `config`, `local`, `.git`, `.claude` e `.vite`.
- [ ] O contador de apps (se houver) está correto.
- [ ] Screenshots, badges ou links mortos? Remova ou atualize.
- [ ] ROADMAP reflete:
  - [ ] Itens concluídos marcados como `[x]`.
  - [ ] Bugs conhecidos atualizados (remover os resolvidos).
  - [ ] Próximos passos ainda fazem sentido.
- [ ] `src/i18n/sobre.json` e `sobre/sobre.html` listam todos os apps.

## 8. Teste manual mínimo

Antes do commit, abrir cada app tocado em um browser:

- [ ] Página carrega sem erros no console.
- [ ] Troca de idioma PT ↔ IT funciona e traduz **tudo** (inclusive memorial e unidades).
- [ ] Sliders e botões +/− respondem corretamente (clique rápido = 1 step; segurar = animação).
- [ ] SAIBA MAIS abre, mostra fórmulas + exemplos dinâmicos e fecha de volta.
- [ ] Botão home (canto inferior) volta para `index.html`.
- [ ] Layout em 400 px (DevTools > responsive) não quebra.

## 9. Git

- [ ] `git status` limpo exceto pelas mudanças pretendidas.
- [ ] Mensagem de commit é concisa e explica o **porquê**, não apenas o **quê**.
- [ ] Sem `--no-verify`, sem `--amend` em commits já publicados.
- [ ] Só dar `git push` quando a lista acima estiver OK.

---

**Em caso de dúvida**: prefira um commit menor e mais focado a um que mistura várias mudanças. Cada commit deve ser revisável isoladamente.
