# Verificação da BR 12C Niobium contra o guia oficial

Robô headless que executa os exemplos **Keystrokes | Display** do guia oficial
(`assets/hp12cplatinum-ug-en.pdf`) na calculadora **real** (`app.js`) e compara o
resultado. Onde falha, corrigimos ou implementamos a lógica até casar com o guia.

## Como rodar
```bash
npm --prefix local test -- guia      # só as suítes do guia (br12c/tests/*.guia.test.js)
npm --prefix local test              # tudo (apps + guia)
```

## Runner VISUAL (assistir o robô)
`br12c/tests/visual.html` — carrega a calc real num iframe e o robô **clica as teclas
com destaque/pausa** mostrando display vs esperado (✓/✗). Sobe um servidor e abra
`http://localhost:PORT/br12c/tests/visual.html` (ou no ar: `/EngenhariaNata/br12c/tests/visual.html`).
Reusa os mesmos fixtures + tradutor + comparador dos testes headless.

## Arquitetura (Capítulo 0 — pronto)
- `tests/harness.js` — `criarCalculadora()`: instancia jsdom à mão (importado de
  `local/node_modules` via alias no `vitest.config.js`), injeta o corpo de
  `index.html`, expõe `document`/`window` como globais e carrega o `app.js` real;
  helpers `press`, `display`, `pressGuia`.
- `tests/keystrokes.js` — tradutor: token do guia → ação(ões), via mapa construído
  de `KEY_ROWS` (exposto pelo `app.js` em `globalThis.__BR12C_KEYS__`) + `ALIASES`
  (cresce por capítulo).
- `tests/comparar.js` — comparador locale-aware (calc pt-BR `-21.396,61` vs guia US
  `-21,396.61`): compara por valor numérico arredondado às casas do guia.
- `tests/fixtures/*.js` — exemplos do guia como dados.
- `tests/*.guia.test.js` — runners.

## Convenção de fixtures
```js
export const secaoN = [
  { nome, pagina, linhas: [ { keys: ["f","CLEAR","REG","f","2"], display: "0.00" }, ... ] },
];
```
`keys` na notação do guia (números, teclas primárias, `f`/`g`, nomes de função).
`display` copiado do guia (formato US). Linhas são sequenciais na mesma calc;
cada exemplo começa “limpo”.

## Status por capítulo
| Cap | Seção do guia | Status | Notas |
|-----|---------------|--------|-------|
| 0 | Harness/infra | ✅ feito | jsdom + tradutor + comparador; smoke verde (RPN, FIX). 111 testes no total. |
| 1 | Seção 1 — Getting Started (aritmética RPN/ALG, cadeia, STO/RCL) | ✅ feito | 9/9 exemplos. Implementados R0–R9 + aritmética de registrador. |
| 2 | Seção 2 — Percentage + Calendar | ✅ feito | Percentual 10/10; calendário: ΔDYS, formatos D.MY/M.DY, **DATE (data futura + dia da semana)**. |
| 3 | Seção 3 — Basic Financial (juros, TVM, amortização) | ✅ feito | TVM (Ex.1-3, BEG/END), amortização (AMORT), juros simples (INT), **odd-period (n fracionário) + flag C (STO EEX, simples/composto)**. |
| 4 | Seção 4 — NPV, IRR, bonds, depreciação | ✅ feito | NPV (agrupado/não), IRR, fluxo de caixa, depreciação (SL/SOYD/DB) e **títulos (PRICE/YTM, SIA actual/actual)**. |
| 5 | Seção 5 — Operating Features (DISP/SCI, x<>y, LST x, constantes) | ✅ feito | x≷y, LST x (g++), aritmética com constante, **notação científica (f .)** e **mantissa (f CLEAR PREFIX)**. |
| 6 | Seção 6 — Statistics | ✅ feito | Σ+/Σ-, média, desvio, média ponderada, **regressão linear (ŷ,r=g+2, x̂,r=g+1, r)** e CLEAR Σ. |
| 7 | Seção 7 — Math/Number-Alteration | ✅ feito | 10/10: y^x, 1/x, √x, e^x, LN, FRAC, INTG, RND, x², n!. (O 12C Platinum não tem tecla LOG separada — só LN/e^x.) |
| 8 | Apêndice D — Error Conditions | ✅ feito | Calc sinaliza "Error" em ÷0, √(−), ln(0), n! inválido; limpa ao pressionar tecla. (Sem tabelas no guia; códigos Error 0–9 não diferenciados.) |

**Parte I do guia + Apêndices A/D/E: COMPLETA.**

| III | Parte III — Soluções aplicadas (Seções 12–16) | 🟡 amostra | 4 exemplos não-programáveis verdes (APR+pontos, preço de hipoteca, lease via NPV, taxa contínua→efetiva) — validam TVM/NPV/%/e^x/Δ% contra problemas reais. Demais soluções exigem modo programa (Parte II). |
| II | Parte II — Programação (Seções 8–9) | ✅ feito | **Modo programa**: P/R (f+R/S), gravação com keycodes (incl. multi-tecla STO+1=`44 40 1`), SST/BST, g GTO . nnn, f CLEAR PRGM, R/S roda, PSE; **branching/looping (Seção 9): x≤y/x=0 (DO-if-TRUE) + GTO nnn como desvio/loop**. Ex.: desconto+frete (625→473,75), fatura+acumuladores (→950,61) e **imposto 20%/25% com condicional** (15k→3.000, 20k→4.000, 25k→6.250). |

## Histórico
- **Ch0 (2026-06-08):** harness criado e validado (smoke RPN `2 ENTER 3 +`=5 e FIX).
  `jsdom` adicionado como devDependency; alias no `vitest.config.js`; hook
  `globalThis.__BR12C_KEYS__` no `app.js`. Suíte: 111 testes verdes.
- **Ch1 (2026-06-08):** Seção 1 — **9/9 exemplos verdes** (aritmética RPN/ALG, cadeia,
  fatura STO/RCL, aritmética de registrador). **Correção real:** implementados os
  registradores numéricos **R0–R9** e a **aritmética de registrador** (`STO ± N`, guia p.29)
  — não existiam (o dígito do registrador era anexado ao número, ex.: `1250 STO 0`→`12500`).
  O atalho "M" via `STO 9`/`STO +` foi removido (colidia com R9 e com `STO + N`); o display
  "M" ficou vestigial.
  **Achados p/ tratar depois:** (a) troca RPN/ALG — a calc usa `g+7`(ALG)/`g+8`(RPN), mas o
  guia diz `f ALG`/`f RPN` (os testes usam a tecla da calc; alinhar a tecla correta depois);
  (b) não há tecla on-screen de **backspace**; (c) **parênteses** (ALG), **EEX/científico**
  → Seção 5; (d) `√x` na cadeia → Seção 7. Suíte: **120 testes verdes**.
- **Ch2-percentual (2026-06-08):** Seção 2 (parte %) — **10/10 verde**. **Correções reais:**
  (a) `%` em **ALG** retornava 0 (usava `stack.y`, lógica RPN) — agora divide por 100, exceto
  após `+`/`−`, quando calcula a % da base pendente (guia p.32); (b) `%T` em ALG dava Erro —
  agora `beginNumericEntry` faz *lift* também em ALG após um resultado (total fica em Y); o
  `applyOperator` zera `liftStack`, sem afetar cadeias. Runner compartilhado `tests/_runner.js`.
  Calendário (DATE/ΔDYS/formatos) ainda **pendente**. Suíte: **130 testes verdes**.
- **Remapeamento do teclado (2026-06-08):** `KEY_ROWS` e `handleShiftedAction` estavam
  embaralhados vs a SKIN real. Corrigido conforme a foto: **RPN = f+CHS, ALG = f+EEX**
  (eram g+8/g+7); **BEG = g+7, END = g+8** (eram f+7/f+8); **FIX n = f+dígito** (FIX 7/8
  voltaram a ser acessíveis); 12×=g+n, 12÷=g+i; **CLEAR FIN = f+x≷y, CLEAR REG = f+CLx,
  PREFIX = f+ENTER**; RND = f+PMT; math g na linha do y^x: **√x, e^x, LN, FRAC, INTG**.
  Removidos M+/M- (não existem na skin) e o atalho de backspace. Funções f/g ainda não
  implementadas (AMORT/INT/NPV/IRR/PRICE/YTM/SL/SOYD/DB e calendário/estatística) consomem
  o prefixo sem disparar a função primária. Novo teste `teclado.guia.test.js` (6) trava o
  mapeamento. Resolve o achado "f-vs-g" do Ch1. Suíte: **136 testes verdes**.
- **Ch3-TVM (2026-06-08):** Seção 3 — exemplos canônicos 1–3 (p.12–14, depósito/FV/PMT com
  BEG e END) **verdes**. **Correções reais:** (a) registradores financeiros iniciavam `null`
  e o solve exigia todos não-null → no HP12C valem **0** (init + `resetFinancial` → 0), senão
  `PV` não resolvia; (b) **`12×`/`12÷` (g+n / g+i) agora ARMAZENAM** o resultado em n/i (antes
  só multiplicavam X) — por isso o solve dava 0. AMORT/INT/odd-period e o Exemplo 4
  (anualização) ainda pendentes. Suíte: **137 testes verdes**.
- **Ch7-math (2026-06-08):** Seção 7 — funções matemáticas **10/10** (y^x, 1/x, √x, e^x, LN,
  FRAC, INTG, RND, x², n!). Implementados **x² (g+×)** e **n! (g+3)** que faltavam; os demais
  já vieram corretos do remapeamento. Suíte: **147 testes verdes**.
- **Ch3-AMORT (2026-06-08):** Implementada **amortização (AMORT = f+n)** — guia p.69–70
  (hipoteca $250k/25 anos/5.25%): juros -13.006,53, principal -4.970,91 (x≷y), saldo
  245.029,09 (RCL PV), n=12; 2º ano também. Por parcela: juros = arred(saldo×i/100) ao FIX,
  principal = -PMT - juros, saldo -= principal; atualiza PV e n; sinal segue o PMT. Suíte:
  **150 testes verdes**. Criada **tarefa agendada** `br12c-guia-verificacao` (a cada 6h)
  que retoma esta verificação sozinha do estado commitado, até o guia passar inteiro.
- **Ch2-calendário (2026-06-08):** Implementados **ΔDYS (g+EEX)** = dias entre datas (reais
  em X via número-de-dia juliano + base **30/360** em Y) e os **formatos de data D.MY (g+4) /
  M.DY (g+5)**. Exemplo p.40 (3 jun 2004 → 14 out 2005): 498 reais, 491 (30/360). Helpers
  `diasJulianos`/`parseDate`/`dias360`. DATE (data futura, com display especial "DD,MM,YYYY W")
  ainda pendente. Suíte: **151 testes verdes**.
- **Ch4-NPV/IRR (2026-06-08):** Implementados **fluxo de caixa** (CFo=g+PV, CFj=g+PMT,
  Nj=g+FV), **NPV (f+PV)** e **IRR (f+FV)**. Exemplos: NPV não-agrupado p.74–75 = 212,18;
  NPV agrupado p.76–77 = 907,77; **IRR p.78 = 13,72%** (via `solveRoot` no VPL). `state.cf`/
  `state.cfN` guardam os fluxos; `f CLEAR REG` os zera. Títulos (PRICE/YTM) e depreciação
  (SL/SOYD/DB) pendentes. Suíte: **153 testes verdes**.
- **Juros simples (INT, f+i) (2026-06-08):** guia p.42–43 — juros 360 dias em X, 365 em Z,
  -PV em Y. Ex.: $450/7%/60d → 5,25 (total 455,25) e 5,18 (total 455,18). Seção 3 completa.
- **Runner VISUAL + bug do boot (2026-06-08):** criado `tests/visual.html` (assistir o robô
  clicando as teclas reais). Ele revelou um **bug real**: `lastTouchActivationAt` iniciava `0`,
  então `shouldSuppressSyntheticClick` suprimia TODO clique enquanto `performance.now() < 700ms`
  — as **teclas ficavam mortas nos primeiros ~0,7 s após abrir a calc** (no headless o timer do
  Node é grande, então não aparecia). Corrigido init para `-Infinity`. Suíte: **155 verdes**.
- **Ch6-Estatística (2026-06-08):** Dei ação própria ao **Σ+** (`sum-plus`, antes caía em
  percent-total) e ao **SST** (`sst`). Implementados Σ+/Σ- (acumular/remover em R1–R6), média
  **x̄/ȳ** (g+0), desvio-padrão amostral **s** (g+.), média ponderada **x̄w** (g+6, = ΣXY/ΣX),
  e **CLEAR Σ** (f+SST). Exemplos p.95–99: média 21.714,29/40,00; desvio 4.820,59/6,03;
  ponderada 1,19. Estimativa linear (ŷ,r/x̂,r — teclas incertas na skin) pendente. Suíte:
  **157 verdes**.
- **Rodada ultracode (2026-06-08):** workflow de 9 agentes em paralelo extraiu exemplos +
  fórmulas (Apêndice E) + mapeamento de teclas das áreas restantes; implementação sequencial:
  - **LST x (g++)**: rastreia lastX nas operações (Apêndice A) + handler que levanta a pilha —
    habilita aritmética com constante e recuperação de erro de digitação (Seção 5).
  - **Regressão linear**: x̂,r = g+1, ŷ,r = g+2 (estimativa em X, r em Y); p.97-98 x̂=28.818,93,
    r=0,90, intercepto 15,55. Seção 6 completa.
  - **DATE (g+CHS)**: data-base + N dias → nova data + dia da semana, display especial
    "11,09,2004 6" (via `dataDeJulianos` + `state.displayOverride`). Seção 2 completa.
  - **Títulos (PRICE=f+y^x, YTM=f+1/x)**: SIA semestral actual/actual; p.82-83 = 120,38 limpo /
    123,07 total; yield 4,60. Seção 4 completa.
  - **Erros (Apêndice D)**: "Error" em ÷0/√(−)/ln(0)/n! inválido + limpeza ao pressionar tecla.
  - **Display científico (f .) e mantissa (f CLEAR PREFIX)**: `displayMode` + `formatScientific`/
    `formatMantissa` + parser SCI no comparador; p.87-89 verde. Seção 5 completa.
  - Apêndice E confirmou TODAS as fórmulas implementadas (TVM, NPV, IRR, bonds, depreciação,
    %, estatística, regressão). **Parte I + Apêndices A/D/E completos. Suíte: 172 verdes, CI verde.**
