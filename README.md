# Engenharia NATA

Portfólio de apps web educativos para engenharia, energia, utilidades residenciais e finanças. O projeto é estático, bilíngue (`pt-BR` / `it-IT`) e prioriza cálculo prático com explicação passo a passo no navegador.

- Site: `https://engnata.eu`
- Stack principal: HTML, CSS e JavaScript modular
- Status atual: 12 calculadoras ativas + 2 páginas de suporte (`sobre/` e `bugs/`)
- Backlog e prioridades: [ROADMAP.md](./ROADMAP.md)
- Checklist de release/commit: [PRE_COMMIT.md](./PRE_COMMIT.md)

## Apps do portfólio

| Pasta             | Tipo                    | Resumo                                                         |
| ----------------- | ----------------------- | -------------------------------------------------------------- |
| `bombaagua/`      | Engenharia hidráulica   | Calcula potência, perdas e consumo horário de bomba d'água     |
| `iluminacao/`     | Engenharia elétrica     | Dimensiona lux, lâmpadas e custo de energia residencial        |
| `ventilacao/`     | Conforto ambiental      | Calcula ACH, qualidade do ar e área mínima de ventilação       |
| `chuva/`          | Água / sustentabilidade | Dimensiona captação de chuva, cisterna e economia mensal       |
| `mutuo/`          | Finanças                | Compara SAC, Price e Americano com memorial e gráficos         |
| `helice/`         | Náutica                 | Apoia escolha de passo de hélice para embarcações de lazer     |
| `solar/`          | Energia                 | Dimensiona sistema fotovoltaico off-grid e configurações       |
| `bitola/`         | Instalações elétricas   | Define bitola de cabos considerando corrente e queda de tensão |
| `arcondicionado/` | Climatização            | Dimensiona BTU e cenários multi-split                          |
| `aquecimento/`    | Energia térmica         | Dimensiona aquecimento solar de água e ambiente                |
| `salario/`        | Finanças                | Calcula salário líquido Brasil/Itália com memorial e gráficos  |
| `fazenda/`        | Planejamento rural      | Planeja produção auto-sustentável com base regional            |
| `bugs/`           | Suporte                 | Canal de reporte de problemas e sugestões                      |
| `sobre/`          | Institucional           | Página de visão geral do projeto e apps ativos                 |

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
├── sobre/                      # página institucional
├── bugs/                       # formulário de reporte
├── sw.js                       # service worker
└── local/                      # toolchain de desenvolvimento e validação
```

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
npm run build          # build de produção
npm run validate       # eslint + prettier + stylelint
npm run checkup        # varredura rápida de console.log/debugger
npm run version:patch  # atualiza versão do local/package.json
```

Observações:

- `npm test` ainda não executa suíte automatizada real; hoje serve apenas como placeholder.
- `npm run validate` é a principal verificação rápida antes de commit.
- O projeto usa `Chart.js` local em `assets/js/vendor/`, `localStorage` para preferências/configurações e GoatCounter para analytics.

## Fluxo de manutenção

Ao mexer em um app existente ou adicionar um novo:

1. Atualize `index.html` para refletir o catálogo principal.
2. Sincronize `src/i18n/index.json`, `src/i18n/sobre.json` e `sobre/sobre.html`.
3. Registre a versão inicial ou mudança relevante em `config/versions.json`.
4. Revise `README.md`, `ROADMAP.md`, `PRE_COMMIT.md` e `sitemap.xml` quando a mudança afetar o portfólio.

## Adicionando um novo app

1. Crie uma pasta própria, por exemplo `meuapp/`, com `meuapp.html`, `meuapp-script.js` e `meuapp-styles.css`.
2. Reaproveite a base em `src/core/app.js` para herdar idioma, tema e inicialização padrão.
3. Crie `src/i18n/meuapp.json` com as chaves de `pt-BR` e `it-IT`.
4. Importe os CSS compartilhados (`assets/css/shared-styles.css`, `assets/css/v2-components.css` e `assets/css/controls-styles.css`).
5. Registre o app no catálogo principal, na página `sobre/` e nos arquivos de documentação.
