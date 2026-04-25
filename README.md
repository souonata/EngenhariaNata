# Engenharia NATA

Portfólio de apps web educativos para engenharia, energia, utilidades residenciais e finanças. O projeto é estático, bilíngue (`pt-BR` / `it-IT`) e prioriza cálculo prático com explicação passo a passo no navegador.

- Site: `https://souonata.github.io/EngenhariaNata/`
- Stack principal: HTML, CSS e JavaScript modular (ESM)
- Status atual: 12 calculadoras ativas + 2 páginas de suporte (`sobre/` e `bugs/`)
- Cobertura de testes: **109 testes automatizados** (Vitest) cobrindo `salario` e `mutuo`
- Backlog e prioridades: [ROADMAP.md](./ROADMAP.md)
- Checklist de release/commit: [PRE_COMMIT.md](./PRE_COMMIT.md)

## Apps do portfólio

| Pasta             | Tipo                    | Resumo                                                         | Calc. extraído |
| ----------------- | ----------------------- | -------------------------------------------------------------- | :------------: |
| `bombaagua/`      | Engenharia hidráulica   | Calcula potência, perdas e consumo horário de bomba d'água     |                |
| `iluminacao/`     | Engenharia elétrica     | Dimensiona lux, lâmpadas e custo de energia residencial        |                |
| `ventilacao/`     | Conforto ambiental      | Calcula ACH, qualidade do ar e área mínima de ventilação       |                |
| `chuva/`          | Água / sustentabilidade | Dimensiona captação de chuva, cisterna e economia mensal       |                |
| `mutuo/`          | Finanças                | Compara SAC, Price e Americano com memorial e gráficos         |        ✅       |
| `helice/`         | Náutica                 | Apoia escolha de passo de hélice para embarcações de lazer     |                |
| `solar/`          | Energia                 | Dimensiona sistema fotovoltaico off-grid e configurações       |                |
| `bitola/`         | Instalações elétricas   | Define bitola de cabos considerando corrente e queda de tensão |                |
| `arcondicionado/` | Climatização            | Dimensiona BTU e cenários multi-split                          |                |
| `aquecimento/`    | Energia térmica         | Dimensiona aquecimento solar de água e ambiente                |                |
| `salario/`        | Finanças                | Calcula salário líquido Brasil/Itália com memorial e gráficos  |        ✅       |
| `fazenda/`        | Planejamento rural      | Planeja produção auto-sustentável com base regional            |                |
| `bugs/`           | Suporte                 | Canal de reporte de problemas e sugestões                      |       n/a      |
| `sobre/`          | Institucional           | Página de visão geral do projeto e apps ativos                 |       n/a      |

A coluna **Calc. extraído** sinaliza apps cuja lógica numérica foi separada em `<app>/<app>-calc.js` (ESM puro, sem DOM) e está coberta por testes automatizados. Os demais seguem o padrão original (cálculo dentro da classe da app); a migração será feita em ondas — ver [ROADMAP.md](./ROADMAP.md).

## Arquitetura resumida

```text
EngenhariaNata/
├── index.html                  # landing e catálogo de apps
├── assets/                     # CSS compartilhado, utilitários e vendor
├── config/versions.json        # versões por app e data de atualização
├── src/
│   ├── core/                   # base de app, i18n e tema
│   ├── components/             # componentes reutilizáveis
│   ├── utils/                  # formatadores, validação, storage e DOM
│   └── i18n/                   # textos por app e por idioma
├── <app>/                      # cada app tem html + script + styles próprios
│   ├── <app>-script.js         # eventos, render, DOM (camada de UI)
│   ├── <app>-calc.js           # núcleo numérico puro (apps já migrados)
│   └── <app>-calc.test.js      # suíte Vitest (apps já migrados)
├── sobre/                      # página institucional
├── bugs/                       # formulário de reporte
├── sw.js                       # service worker
├── .github/workflows/          # GitHub Actions (testes + build)
└── local/                      # toolchain de desenvolvimento e validação
```

## Testes automatizados

A suíte de testes é executada por **Vitest** sobre os arquivos `<app>/<app>-calc.test.js`. Cobre fórmulas, invariantes, casos extremos e regressão de bugs já corrigidos.

```bash
cd local
npm test                # roda todos os testes
npm run test:watch      # modo watch durante desenvolvimento
npm run test:coverage   # gera relatório de cobertura
```

Cobertura atual nos apps já migrados (`salario`, `mutuo`):

| Métrica       | Valor      |
| ------------- | :--------: |
| Statements    | **97,67%** |
| Branches      | **91,52%** |
| Functions     | **100%**   |
| Lines         | **97,92%** |
| Total casos   | **109**    |

A camada UI (`<app>-script.js`) ainda não é coberta automaticamente — testes de DOM ficam para fase futura.

## Auditoria fiscal e correções (2026)

A calculadora `salario` recebeu auditoria completa das fórmulas brasileiras e italianas, com correções aplicadas:

- **13º IRRF (Brasil)** — agora respeita escolha automática entre dedução tradicional e simplificada (mesma regra do mensal); antes usava só a tradicional, inflando o IRRF para quem ganhava alto.
- **Férias IRRF (Brasil)** — mesma correção do bug acima.
- **Aviso prévio (Brasil)** — fórmula atualizada para a interpretação do MTE/Lei 12.506/2011: 30 dias até o 1º ano completo, +3 dias por ano completo a partir do 2º (capado em 90 dias).
- **Trattamento integrativo (Itália)** — implementado o taper linear €15.000-€28.000 em vez do clip simplificado.
- **Tabelas tributárias atualizadas para 2026**:
  - INSS BR: novo teto **R$ 8.475,55** (faixas 1.621/2.902,84/4.354,27/8.475,55).
  - IRPEF IT: 2º scaglione passa de **35% → 33%** (Legge di Bilancio 2026).
  - INPS IT: soglia +1% a **€56.224** (Circolare INPS 6/2026).

O `mutuo-calc.js` extraiu PMT/SAC/Price/Americano em funções puras, com invariantes (Σ amortizações = principal, Σ juros + Σ amortizações = totalPago) cobertos por testes em todos os 3 sistemas.

## Ambiente local

O setup de desenvolvimento fica em `local/`.

```bash
cd local
npm install
npm run dev
```

Comandos úteis:

```bash
cd local
npm run control        # painel local para controlar o Vite
npm run dev            # servidor Vite (porta 5173)
npm run build          # build de produção
npm test               # suíte Vitest (roda 1x)
npm run test:watch     # Vitest em modo watch
npm run test:coverage  # cobertura com v8
npm run lint:check     # ESLint sem autofix
npm run format:check   # Prettier sem escrita
npm run style:check    # Stylelint sem autofix
npm run validate       # lint + format + style + tests
npm run checkup        # varredura rápida de console.log/debugger
npm run version:patch  # atualiza versão do local/package.json
```

Observações:

- `npm run validate` é a verificação completa antes de commit.
- O projeto usa `Chart.js` local em `assets/js/vendor/`, `localStorage` para preferências/configurações e GoatCounter para analytics.
- ESLint precisa ser executado a partir de `local/` (config em `local/.eslintrc.json`).

## CI

O workflow [`.github/workflows/test.yml`](./.github/workflows/test.yml) roda em todo `push` e `pull_request`:

1. Instala dependências (`npm ci` em `local/`).
2. Roda toda a suíte de testes (`npm test`).
3. Faz build de produção (`npm run build`) como smoke check.

O build falha bloqueia o merge.

## Fluxo de manutenção

Ao mexer em um app existente ou adicionar um novo:

1. Atualize `index.html` para refletir o catálogo principal.
2. Sincronize `src/i18n/index.json`, `src/i18n/sobre.json` e `sobre/sobre.html`.
3. Registre a versão inicial ou mudança relevante em `config/versions.json`.
4. Revise `README.md`, `ROADMAP.md`, `PRE_COMMIT.md` e `sitemap.xml` quando a mudança afetar o portfólio.
5. Para apps já migrados (`salario`, `mutuo`): se mexer no cálculo, atualize/adicione testes em `<app>-calc.test.js` antes do commit.

## Adicionando um novo app

1. Crie uma pasta própria, por exemplo `meuapp/`, com `meuapp.html`, `meuapp-script.js` e `meuapp-styles.css`.
2. Reaproveite a base em `src/core/app.js` para herdar idioma, tema e inicialização padrão.
3. Crie `src/i18n/meuapp.json` com as chaves de `pt-BR` e `it-IT`.
4. Importe os CSS compartilhados (`assets/css/shared-styles.css`, `assets/css/v2-components.css` e `assets/css/controls-styles.css`).
5. Para fórmulas numéricas, separe a lógica em `meuapp-calc.js` (ESM puro, sem DOM) e crie `meuapp-calc.test.js` com cobertura de fronteiras, invariantes e edge cases.
6. Registre o app no catálogo principal, na página `sobre/` e nos arquivos de documentação.
