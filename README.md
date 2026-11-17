# Engenharia NATA

Apps web educativos de engenharia, energia, utilidades residenciais e finanças. Cada app faz o cálculo no navegador e explica o passo a passo.

- Site: [engnata.eu](https://engnata.eu/)
- Idiomas: português (`pt-BR`), italiano (`it-IT`) e sueco (`sv-SE`)
- Stack: HTML, CSS e JavaScript modular (ESM), sem framework; build com Vite

## Apps

| App               | Área                    | O que faz                                                  |
| ----------------- | ----------------------- | ---------------------------------------------------------- |
| `aquecimento/`    | Energia térmica         | Dimensiona aquecimento solar de água e ambiente            |
| `arcondicionado/` | Climatização            | Dimensiona BTU e cenários multi-split                      |
| `bitola/`         | Instalações elétricas   | Define a bitola do cabo pela corrente e queda de tensão    |
| `bombaagua/`      | Hidráulica              | Calcula potência, perdas e consumo de bomba d'água         |
| `br12c/`          | Finanças                | Calculadora financeira no estilo HP-12C, com guia          |
| `calha/`          | Hidráulica predial      | Dimensiona calhas e condutores pela NBR 10844              |
| `chuva/`          | Água                    | Dimensiona captação de chuva, cisterna e economia          |
| `fazenda/`        | Planejamento rural      | Planeja produção autossustentável                          |
| `helice/`         | Náutica                 | Ajuda a escolher o passo da hélice                         |
| `iluminacao/`     | Elétrica                | Calcula lux, lâmpadas e custo de energia                   |
| `mutuo/`          | Finanças                | Compara sistemas de financiamento, com memorial e gráficos |
| `patentenautica/` | Educação náutica        | Estudo para a patente náutica italiana (quiz e carteggio)  |
| `previsao/`       | Meteorologia            | Previsão de 7 dias com temperatura e chuva                 |
| `salario/`        | Finanças                | Calcula o salário líquido (Brasil, Itália e Suécia)        |
| `solar/`          | Energia                 | Dimensiona sistema fotovoltaico                            |
| `ventilacao/`     | Conforto ambiental      | Calcula renovação de ar e ventilação mínima                |
| `audiolab/`       | Software livre          | Apresenta o plugin AudioLab para Jellyfin                  |
| `sobre/`, `bugs/` | Institucional / suporte | Visão geral do projeto e canal de reporte de problemas     |

O catálogo também leva ao [Sites Vendas](https://sites.engnata.eu), um construtor de lojas online mantido em outro repositório.

## Estrutura

```text
EngenhariaNata/
├── index.html            # página inicial e catálogo
├── assets/               # CSS e JS compartilhados (inclui Chart.js local)
├── config/versions.json  # versão de cada app
├── src/                  # base dos apps: core, componentes, utilitários e textos (i18n)
├── <app>/                # cada app na sua pasta: html + script + styles
└── local/                # ferramentas de desenvolvimento (Vite, Vitest, ESLint, Prettier, Stylelint)
```

## Rodando localmente

Requer Node 20 ou superior.

```bash
cd local
npm ci
npm run dev        # http://localhost:5173
```

Outros comandos (sempre a partir de `local/`):

```bash
npm test           # testes (Vitest)
npm run validate   # lint + formatação + estilos + testes: rode antes de commitar
npm run build      # build de produção em local/dist
```

## Publicação

Todo push no `main` dispara o GitHub Actions, que faz o build e publica no GitHub Pages. O que está no ar é o build do `main`; mudanças em outras branches só aparecem depois do merge.

## Adicionando um app

1. Crie uma pasta, por exemplo `meuapp/`, com `meuapp.html`, `meuapp-script.js` e `meuapp-styles.css`.
2. Estenda a base em `src/core/app.js` para herdar idioma, tema e inicialização.
3. Coloque os textos em `src/i18n/meuapp.json`, nos três idiomas.
4. Separe as fórmulas em `meuapp-calc.js` (sem DOM) e cubra com testes em `meuapp-calc.test.js`.
5. Registre o app no catálogo (`index.html`), na página `sobre/` e em `config/versions.json`.
6. Rode `npm run validate`.

Mais detalhes: [ROADMAP.md](./ROADMAP.md) e [PRE_COMMIT.md](./PRE_COMMIT.md).
