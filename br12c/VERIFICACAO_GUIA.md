# Verificação da BR 12C Niobium contra o guia oficial

Robô headless que executa os exemplos **Keystrokes | Display** do guia oficial
(`assets/hp12cplatinum-ug-en.pdf`) na calculadora **real** (`app.js`) e compara o
resultado. Onde falha, corrigimos ou implementamos a lógica até casar com o guia.

## Como rodar
```bash
npm --prefix local test -- guia      # só as suítes do guia (br12c/tests/*.guia.test.js)
npm --prefix local test              # tudo (apps + guia)
```

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
| 2 | Seção 2 — Percentage + Calendar | 🟡 parcial | Percentual 10/10 (corrigidos `%` e `%T` em ALG). Calendário pendente. |
| 3 | Seção 3 — Basic Financial (juros, TVM, amortização) | ⬜ a fazer | AMORT/INT a implementar; TVM existe (verificar) |
| 4 | Seção 4 — NPV, IRR, bonds, depreciação | ⬜ a fazer | tudo a implementar |
| 5 | Seção 5 — Operating Features (DISP/SCI, x<>y, LST x, constantes) | ⬜ a fazer | |
| 6 | Seção 6 — Statistics | ⬜ a fazer | a implementar |
| 7 | Seção 7 — Math/Number-Alteration | ⬜ a fazer | sqrt/ln existem; resto a implementar |
| 8 | Apêndice D — Error Conditions | ⬜ a fazer | |

Programação (Parte II) e Soluções (Parte III): fora do escopo atual.

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
