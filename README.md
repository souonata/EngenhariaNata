# Engenharia NATA

Portfólio de apps web educativos de engenharia e finanças, com foco em cálculos práticos, explicações didáticas e interface bilíngue (pt-BR / it-IT).

## Aplicativos

- `mutuo/` - Calculadora de empréstimos com SAC, Price e Americano
- `helice/` - Calculadora de hélice náutica
- `solar/` - Dimensionamento fotovoltaico off-grid
- `bitola/` - Calculadora de bitola de cabos elétricos
- `arcondicionado/` - Dimensionador de BTU e sistema multi-split
- `aquecimento/` - Dimensionador de aquecimento solar térmico
- `fazenda/` - Planejador de fazenda auto-sustentável
- `bugs/` - Formulário para reporte de problemas
- `sobre/` - Página institucional

## Tecnologias

- HTML5
- CSS3
- JavaScript ES modules
- Chart.js (CDN)
- localStorage
- Service Worker (`sw.js`)

## Executar localmente

O ambiente de desenvolvimento está em `local/`.

```bash
cd local
npm install
npm run dev
```

Opcionalmente, use o painel de controle local:

```bash
cd local
npm run control
```

## Estrutura principal

```text
EngenhariaNata/
├── index.html
├── assets/
├── src/
├── aquecimento/
├── arcondicionado/
├── bitola/
├── bugs/
├── fazenda/
├── helice/
├── mutuo/
├── sobre/
├── solar/
└── local/
```

## Produção

- Site: `https://engnata.infinityfree.me`
- SEO: `sitemap.xml` e `robots.txt`


### Adicionando um Novo App

1. Crie uma pasta para o app (ex: `meuapp/`)
2. Crie os arquivos: `meuapp.html`, `meuapp-script.js`, `meuapp-styles.css`
3. Inclua `assets/js/site-config.js` no HTML antes do script do app
4. Use as funções globais de formatação e configuração
5. Adicione o app ao `index.html` e `sobre/sobre.html`
6. Execute `scripts/count-lines.ps1` para atualizar as estatísticas
7. Execute `scripts/sync-versions.ps1 -Mode ReadHTML` para atualizar `config/versions.json`
