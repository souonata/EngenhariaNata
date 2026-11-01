# Engenharia NATA

Portfólio de apps web educativos para engenharia, energia, utilidades residenciais e finanças. O projeto é estático, trilíngue (`pt-BR` / `it-IT` / `sv-SE`) e prioriza cálculo prático com explicação passo a passo no navegador.

- Site: `https://engnata.eu/`
- Stack principal: HTML, CSS e JavaScript modular (ESM)
- Status atual: 12 calculadoras ativas + previsão do tempo + app de patente náutica + página do plugin AudioLab + 2 páginas de suporte (`sobre/` e `bugs/`)
- Cobertura de testes: **362 testes automatizados** (Vitest) em 41 arquivos — `br12c` (31,
  o handbook do HP-12C), `pintor` (3), `src/utils` (2), `patentenautica` (2), `src/core` (1),
  `salario` (1) e `mutuo` (1)
- Backlog e prioridades: [ROADMAP.md](./ROADMAP.md)
- Checklist de release/commit: [PRE_COMMIT.md](./PRE_COMMIT.md)

## Apps do portfólio

| Pasta             | Tipo                    | Resumo                                                         | Calc. extraído |
| ----------------- | ----------------------- | -------------------------------------------------------------- | :------------: |
| `bombaagua/`      | Engenharia hidráulica   | Calcula potência, perdas e consumo horário de bomba d'água     |                |
| `iluminacao/`     | Engenharia elétrica     | Dimensiona lux, lâmpadas e custo de energia residencial        |                |
| `ventilacao/`     | Conforto ambiental      | Calcula ACH, qualidade do ar e área mínima de ventilação       |                |
| `chuva/`          | Água / sustentabilidade | Dimensiona captação de chuva, cisterna e economia mensal       |                |
| `mutuo/`          | Finanças                | Compara SAC, Price e Americano com memorial e gráficos         |       ✅       |
| `helice/`         | Náutica                 | Apoia escolha de passo de hélice para embarcações de lazer     |                |
| `patentenautica/` | Educação náutica        | Banco filtrável, conta opcional, fontes oficiais e Carta 5/D   |       ✅       |
| `solar/`          | Energia                 | Dimensiona sistema fotovoltaico off-grid e configurações       |                |
| `bitola/`         | Instalações elétricas   | Define bitola de cabos considerando corrente e queda de tensão |                |
| `arcondicionado/` | Climatização            | Dimensiona BTU e cenários multi-split                          |                |
| `aquecimento/`    | Energia térmica         | Dimensiona aquecimento solar de água e ambiente                |                |
| `salario/`        | Finanças                | Calcula salário líquido Brasil/Itália com memorial e gráficos  |       ✅       |
| `fazenda/`        | Planejamento rural      | Planeja produção auto-sustentável com base regional            |                |
| `previsao/`       | Meteorologia            | Previsão de 7 dias (Open-Meteo): temperatura horária e chuva   |      n/a       |
| `audiolab/`       | Áudio / software livre  | Apresenta o plugin AudioLab para Jellyfin e ensina a instalar  |      n/a       |
| `bugs/`           | Suporte                 | Canal de reporte de problemas e sugestões                      |      n/a       |
| `sobre/`          | Institucional           | Página de visão geral do projeto e apps ativos                 |      n/a       |

A coluna **Calc. extraído** sinaliza apps cuja lógica numérica foi separada num módulo `*-calc.js` (ESM puro, sem DOM) e está coberta por testes automatizados. Hoje são três: `mutuo/mutuo-calc.js`, `salario/salario-calc.js` e `patentenautica/exercise-answers-calc.js` — este último não segue o padrão `<app>/<app>-calc.js` porque cobre a correção de exercícios, não um cálculo do app inteiro. Os demais seguem o padrão original (cálculo dentro da classe da app); a migração será feita em ondas — ver [ROADMAP.md](./ROADMAP.md).

O catálogo também tem o **Sites Vendas**, o construtor de lojas online em `https://sites.engnata.eu`. Ele não tem pasta aqui: é um site standalone, só em `pt-BR`, com código no repo `SiteVendaTemplate`. Neste repositório ficam apenas o ícone e o card.

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
├── patentenautica/             # banco filtrável, conta/progresso, quiz IT/PT, Carta 5/D e PDFs
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

Cobertura atual dos núcleos `salario-calc.js` e `mutuo-calc.js` (medida em 2026-08-29):

| Métrica     |   Valor    |
| ----------- | :--------: |
| Statements  | **98,24%** |
| Branches    | **88,88%** |
| Functions   |  **100%**  |
| Lines       | **98,42%** |
| Total casos |  **143**   |

Os 143 casos são só destes dois núcleos (`salario` 84, `mutuo` 59). A suíte completa do
projeto tem 362 testes — o restante cobre `br12c`, `pintor`, `patentenautica` e o `src/`.

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
npm run validate:patentenautica # valida banco, conta/sync, referências PDF, Carta 5/D e 103 figuras
npm run checkup        # varredura rápida de console.log/debugger
npm run version:patch  # atualiza versão do local/package.json
```

Observações:

- `npm run validate` é a verificação completa antes de commit.
- A validação completa inclui a auditoria de integridade da camada oficial italiana e das traduções estáticas do `patentenautica/`.
- O `patentenautica/` continua utilizável sem conta; o login cloud aceita somente e-mail e sincroniza questões, histórico de quizzes e exercícios de carteggio. A página de conta permite acompanhar e redefinir esse progresso pelo backend PocketBase autohospedado descrito em `patentenautica/backend/`.
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

### Casa Suíça (acesso discreto)

O easter egg de nove toques revela o launcher `casasuica/`, disponível em PT/IT/SV.
A senha de conveniência abre o painel de busca de aluguel local, servido pelo GitHub Pages
em `engnata.eu/casasuica/`, sem ChatGPT Sites ou login. A seleção fica no navegador e pode
ser exportada/importada como JSON. O dashboard permanece em português; a tela de acesso é PT/IT/SV.
A senha estática não é autenticação de servidor. Nenhum dado pessoal é versionado no portfólio.

A pesquisa de 31/10/2026 está em `casasuica/research-data.json`, com todos os 54 registros da busca ampliada e sua situação. Jardim privativo e térreo são filtros opcionais, desligados por padrão. Preços, fontes, data e pendências aparecem na tabela. Consulta manual, sem feed ou cobertura exaustiva garantida.

### Pesquisa ampliada Casa Suíça — 31/10/2026

Arquivo local com 54 registros de pesquisa, inclusive descartados para consulta. Filtros por preço em EUR/CHF, câmbio, quartos, banheiros completos, tempo de transporte público e cidade; jardim privativo e somente térreo opcionais, desligados por padrão. Padrão €3.000 / 45 min até Kriens, Zentrum Pilatus. Horários consultados para 02/11/2026 até 08h; endereço da empresa ainda não informado. Todos os registros e filtros ficam no navegador, com export JSON e HTML independente. `npm run test:casasuica` em `local/` verifica classificação, limites, persistência e exportação.

A ampliação usa índices consultados uma vez para reduzir tráfego. Entradas de índices ficam com disponibilidade e total pendentes até confirmação individual. Os 54 anúncios têm tempos de transporte público e bicicleta: 45 origens resolvidas pelo endereço e 9 aproximações pelo centro/parada central. O filtro de tempo permite TP, bicicleta ou qualquer um. Bicicleta usa distância geográfica × 1,35 a 15 km/h + 3 min, sem relevo nem rota cicloviária real. Dados e respostas de pesquisa são reutilizados; nenhuma consulta de rede ao filtrar. `build-bike-estimates.mjs` recalcula apenas as estimativas locais.

Casa Suíça 1.4.0: clique/toque nos cabeçalhos para alternar crescente/decrescente; setas indicam a ordem ativa. Filtros de quantidade ficam acima das respectivas colunas (preço, área, quartos, banheiros, andar e minutos de TP/bicicleta). Campos vazios nos máximos opcionais removem o limite extra; valores não informados ficam no final e pendentes. Ordenação e filtros persistem e funcionam offline.

### Livecost Swiss (acesso discreto)

`livecostswiss/` segue a Casa Suíça: nove toques no logo revelam o app e a senha `swiss` abre o orçamento completo no Pages. Entrada e painel financeiro em PT/IT/SV, seguindo o idioma escolhido no site. O seletor no painel muda o idioma sem recarregar o orçamento. Valores, tema e despesas ficam apenas neste navegador, na chave independente `livecost-swiss-v1`. A senha é uma trava estática de conveniência, não autenticação de servidor. O painel inclui somente cenários ajustáveis e referências públicas; não inclui o histórico pessoal da Itália nem dados de sessão do navegador.
