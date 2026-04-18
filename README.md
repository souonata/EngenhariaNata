# Engenharia NATA

Portfólio de apps web educativos de engenharia e finanças, com foco em cálculos práticos, explicações didáticas e interface bilíngue (pt-BR / it-IT).

## Acesse!
- Site: `https://engnata.eu`

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
- Chart.js local (vendor em `assets/js/vendor/`)
- localStorage
- Service Worker (`sw.js`)
- Analytics: [GoatCounter](https://www.goatcounter.com) (privacy-friendly, LGPD/GDPR-compliant)

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

### Adicionando um Novo App

1. Crie uma pasta para o app (ex: `meuapp/`) com os arquivos `meuapp.html`, `meuapp-script.js` e `meuapp-styles.css`.
2. No `meuapp-script.js`, estenda a classe `App` de `src/core/app.js` (veja `index-script.js` ou `mutuo/mutuo-script.js` como referência). Isso dá i18n, troca de idioma e tema de graça.
3. Crie o arquivo de traduções em `src/i18n/meuapp.json` com as chaves `pt-BR` e `it-IT`.
4. No `meuapp.html`, importe os CSS compartilhados (`assets/css/shared-styles.css`, `v2-components.css`, `controls-styles.css`) e adicione o snippet de analytics antes de `</head>`:

   ```html
   <!-- Analytics: GoatCounter (privacy-friendly, LGPD/GDPR-compliant) -->
   <script data-goatcounter="https://souonata.goatcounter.com/count"
           async src="//gc.zgo.at/count.js"></script>
   ```

5. Registre o app em `index.html` (card na grade de apps) e em `sobre/sobre.html`.
6. Adicione a entrada do app em `config/versions.json` com a versão inicial.
