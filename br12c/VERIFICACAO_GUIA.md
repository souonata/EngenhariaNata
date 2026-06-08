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
| 1 | Seção 1 — Getting Started + Apêndices A/B (aritmética RPN/ALG, pilha, registradores) | ⬜ a fazer | |
| 2 | Seção 2 — Percentage + Calendar | ⬜ a fazer | %CHG/%T e calendário a implementar |
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
