# Roadmap do Projeto

Panorama do estado atual do portfólio Engenharia NATA, com foco no que já está publicado, no próximo bloco de apps e nas melhorias técnicas que ajudam a manter o projeto consistente.

## Snapshot atual

- Portfólio estático com 16 páginas/apps públicas, além dos apps discretos do easter egg
  (`br12c`, `lichiabonsai` e `pintor`): estão no HTML, mas fora do `sitemap.xml` e só
  alcançáveis pelo dock que o easter egg de toques libera.
- Núcleo atual cobre engenharia residencial, energia, água, finanças, planejamento rural e educação náutica.
- Idiomas suportados: `pt-BR`, `it-IT` e `sv-SE`. O sueco **está no ar**: 18 dos 21 arquivos
  de i18n de app já têm a seção `sv-SE`, e os grupos B e C da auditoria (apps que mudam de
  método, não só de idioma) foram entregues — ver `AGENTS.md`. Faltam `fazenda.json` e
  `lichiabonsai.json` (o `TEMPLATE_APP.json` é modelo, não conta).
- Qualidade local hoje depende principalmente de `npm run validate`, revisão manual dos apps alterados e sincronização de documentação.

## Entregues

- [x] `sobre/` - página institucional do projeto
- [x] `bugs/` - formulário de reporte de problemas e sugestões
- [x] `previsao/` - previsão de 7 dias (Open-Meteo) em até 4 cidades configuráveis
- [x] `mutuo/` - calculadora de empréstimos com SAC, Price e Americano
- [x] `salario/` - salário líquido Brasil/Itália com memorial e gráficos
- [x] `solar/` - dimensionamento fotovoltaico off-grid com configuração local
- [x] `aquecimento/` - aquecimento solar térmico
- [x] `arcondicionado/` - dimensionamento de BTU e multi-split
- [x] `bitola/` - calculadora de bitola de cabos elétricos
- [x] `iluminacao/` - calculadora de iluminação residencial
- [x] `ventilacao/` - ventilação natural residencial
- [x] `chuva/` - captação de água da chuva e cisterna
- [x] `bombaagua/` - bomba d'água, perdas e consumo
- [x] `helice/` - calculadora de passo de hélice
- [x] `patentenautica/` - app IT/PT para patente italiana entro 12M, com 1.472 questões filtráveis, conta cloud por e-mail, página de progresso, histórico de provas e carteggio, resets granulares, treinos de inéditas, seção geral de fontes oficiais, 103 figuras, Carta 5/D interativa e glossário
- [x] `fazenda/` - planejador de fazenda auto-sustentável

## Iniciativa — Site trilíngue (`sv-SE`) + dock global flutuante

Objetivo: adicionar **sueco** ao portfólio, adaptando em cada app os parâmetros, normas,
constantes, recomendações e sistemas de financiamento ao país correspondente — e não apenas
traduzir texto. Inclui uma feature global de UI: seletor de idioma e tema **flutuante, só ícones,
sempre visível** em todos os apps.

### Decisões travadas

| Tema | Decisão |
|---|---|
| Idioma × país | **Acoplado**: `sv-SE` ⇒ Suécia, como `it-IT` ⇒ Itália e `pt-BR` ⇒ Brasil hoje. |
| Salário / Mutuo | **Modelo sueco completo** (impostos e crédito reais), em fase própria. |
| `br12c` | **Entra** no sueco. |
| `lichiabonsai` | **Entra** no sueco. |
| `patentenautica` | **Fica fora.** A bandeira sueca **não deve aparecer** neste app. |
| Vento no app meteo | **m/s em todos os idiomas** (pt-BR, it-IT, sv-SE), não só no sueco. |
| App meteo | **Não pode ficar standalone**: deve migrar para a estrutura padrão dos demais apps. |

### Levantamento do código (verificado, não estimado)

- **`src/i18n/schema.json`**: declarava `"required": ["pt-BR","it-IT"]` **com
  `"additionalProperties": false`**, o que marcava `sv-SE` como chave inválida. Vale notar que
  **nenhum script do `npm run validate` aplica esse schema** — ele age no editor/IDE, não no build.
  Corrigido na Fase 0: `sv-SE` entra como propriedade permitida, mas **não obrigatória**, para que
  arquivos ainda não traduzidos sigam válidos durante a migração; a cobertura completa fica a cargo
  do validador de paridade.
- **Núcleo é binário por design**: `i18n.js` resolve moeda como `it-IT ? EUR : BRL`; `theme.js`
  decide idioma com `startsWith('it') ? it : pt`.
- **~90 ternários de jurisdição** embutidos nos scripts (preços, insolação, isolamento, rótulos de
  gráfico) no formato `idioma === 'it-IT' ? valorIT : valorBR`, que não comportam um 3º locale:
  `solar` 30 · `arcondicionado` 20 · `aquecimento` 18 · `fazenda` 7 · `mutuo` 4 · `bombaagua` 4 ·
  `chuva` 3 · `bitola` 2 · `iluminacao` 1 · `helice` 1.
- **18 arquivos** em `src/i18n/*.json` precisam da chave `sv-SE` (o app meteo ainda não tem JSON).
- **Seletor de idioma está hardcoded em ~17 HTMLs** (bloco `.language-selector` com bandeira SVG +
  texto "PT"/"IT"); o botão de tema é injetado por `theme.js` e hoje mostra **texto** "Light"/"Dark".
- **App meteo (`previsao/previsao.html`)**: *entra* no build do Vite (a descoberta de páginas é
  automática; só `br12c`, `template-app` e `dalie` são ignorados), mas **não importa nada de
  `src/core/`** — tem tradução e handlers `T()` inline. Vento hoje em **km/h** (Open-Meteo
  `wind_speed_10m`, limiar `WIND_MAX = 35`). Migrar é refatorar o HTML; **não** exige mexer no `deploy.yml`.
- **`patentenautica` não tem seletor de idioma**: usa `data-study-mode` (IT / PT / IT+PT), que é
  *modo de apresentação* de um exame italiano cuja camada canônica é o italiano ministerial. O dock
  global precisa de opt-out por página — e o sueco ali seria outro exame (Förarintyg), não tradução.
- **`br12c` tem boot próprio** (`chrome-boot.js`, `idiomaAtual` + `startsWith("it")`) e **service
  worker versionado** — exige tratamento à parte e bump de cache.
- **Colisão de camadas do dock**: `shared-styles.css` já usa `z-index: 1400`; `patentenautica`
  mantém vários `position: fixed` com z-index ≥ 1000, incluindo a navegação inferior de ≤ 820 px (3.8.0).

### Fases

**Fase 0 — Fundação (habilita tudo o mais; sem ela nada compila)**
1. `schema.json`: aceitar `sv-SE` (bloqueador).
2. `i18n.js`: 3 idiomas, moeda por mapa (`BRL`/`EUR`/`SEK`), locale numérico sueco (milhar com
   espaço, decimal com vírgula) e **fallback explícito** `sv-SE → it-IT → pt-BR`.
3. `theme.js`: idioma ternário em vez de binário.
4. Padrão para substituir os ~90 ternários: extrair constantes de país para **módulos de parâmetros
   por app** (`<app>-params.js`, no mesmo espírito dos `<app>-calc.js` já migrados), testáveis, em vez
   de espalhar condicionais.
5. **Dock global flutuante**: componente único e compartilhado, `position: fixed`, camada acima de
   tudo, **apenas ícones** — 3 bandeiras (🇧🇷 🇮🇹 🇸🇪) + **sol/lua** no lugar do texto "Light/Dark";
   `aria-label` traduzido; respeita safe-area; **opt-out por página** (usado pelo `patentenautica`,
   que também não exibe a bandeira sueca). Remover os blocos hardcoded dos HTMLs.
6. Bandeira sueca em SVG inline (cruz escandinava), no padrão dos SVGs BR/IT existentes.

**Fase 1 — App meteo**: migrar para a estrutura padrão (i18n compartilhado + `src/i18n/previsao.json`),
**vento em m/s nos três idiomas** (ajustar leitura da Open-Meteo, rótulos, tooltips, cards e o limiar
`WIND_MAX` de 35 km/h para ~10 m/s) e coluna `sv-SE`.

**Fase 2 — Apps de engenharia** (traduzir + adaptar normas + converter ternários):
- **Feito:** `bugs`, `helice`, `bombaagua`, `bitola` (NBR 5410 → **SS 436 40 00** / IEC 60364),
  `ventilacao` (NBR 15575 → **Boverkets byggregler**, 0,35 l/s·m²), `chuva` (NBR 15527 → **SMHI**,
  tarifa 45 kr/m³) e `iluminacao` (NBR 5413 → **SS-EN 12464-1**, tarifa 0,5–6,0 kr/kWh). Todos com
  os ternários de jurisdição convertidos para `i18n.porIdioma()`.
- **Falta:** `solar` (30 ternários; irradiância de alta latitude e incentivos suecos),
  `arcondicionado` (20; AC é marginal na Suécia — rever recomendações) e `aquecimento`
  (18; graus-dia SE).
- **`fazenda` fica FORA do sueco por ora (decisão deliberada).** O app não é só texto: o
  `fazenda-database.js` é uma base **agronômica regional** (culturas, produtividade por m²,
  calendário de plantio, clima) com ~560 linhas por país. Traduzir apenas a interface faria o app
  recomendar, em sueco, culturas e calendários mediterrâneos para clima boreal — conselho errado,
  não tradução incompleta. Só faz sentido com uma base nórdica própria (zonas de cultivo suecas),
  que é trabalho de dados, não de tradução. O `fazenda-script.js` ainda tem guardas que rejeitam
  qualquer idioma fora de pt/it (`trocarIdioma`, `aplicarIdiomaFazenda`, boot) — precisarão ser
  abertos junto com a base. Enquanto isso o dock esconde a bandeira sueca lá, automaticamente.

**Fase 3 — Catálogo e institucional**: `index.json`, `sobre.json` + `sobre/sobre.html`, `sitemap`,
`config/versions.json`, e um **validador de paridade de chaves** entre os três locales.

**Fase 4 — Finanças, modelo sueco completo**:
`salario` (Skatteverket: kommunalskatt, statlig skatt/brytpunkt, grundavdrag, jobbskatteavdrag,
arbetsgivaravgift, semesterlön — **sem 13º/14º**) e `mutuo` (bolån: **amorteringskrav** da
Finansinspektionen por LTV/renda, ränteavdrag). Testes em `<app>-calc.test.js` antes do commit.

**Fase 5 — Apps especiais**
- **Feito:** `br12c` — 33 chaves, bandeira sueca no seu seletor próprio, textos de tema do
  `chrome-boot.js` convertidos de binário it/pt para mapa por idioma e **cache do service worker
  bumpado para `br12c-guide-v6`**. Os PDFs do manual seguem em inglês, como no original.
- **`lichiabonsai` fica FORA do sueco por ora (decisão deliberada).** A interface são só 66 chaves,
  mas o conteúdo — diário, guia de 25 anos, calendário de 12 meses, 12 técnicas e pragas — vive nos
  módulos `lichiabonsai-data.js` e `guia-*.js` como **333 campos `{pt, it}`**, e o acessador cai em
  `pt` para qualquer outro idioma. Traduzir só a casca entregaria interface sueca com diário em
  português. Enquanto isso o dock esconde a bandeira sueca lá, automaticamente.

### Riscos

- **Fallback silencioso**: chave sueca faltante renderiza italiano e *parece* traduzida — mitigado
  pelo validador de paridade da Fase 3, que idealmente sobe antes das ondas de tradução.
- **Dock cobrindo conteúdo** no mobile, sobretudo onde já há barra inferior fixa.
- **Migração do app meteo**: preservar as 4 cidades, o histórico de 365 dias e os tooltips ao sair do inline.
- **Formatação numérica sueca** e SEK em gráficos e memoriais.
- Cache de `?v=` por app e cache do service worker do `br12c`.
- ~~**Line endings no Windows quebram o `npm run validate`.**~~ **RESOLVIDO em 2026-08-18:**
  o `.gitattributes` passou a declarar `* text=auto eol=lf`, então o `core.autocrlf=true` do
  Windows não reescreve mais os arquivos em CRLF a cada checkout e o `format:check` do Prettier
  (`endOfLine: "lf"`) para de falhar em arquivos que ninguém editou.
  **Atenção ao trocar de máquina:** uma árvore de trabalho anterior à regra não é
  renormalizada sozinha. Se o `git status` acusar dezenas de arquivos "modificados" sem
  mudança de conteúdo, é isso — confirme com `git diff --ignore-cr-at-eol <arquivo>` (sai
  vazio) e resolva com um checkout limpo dos arquivos afetados, não editando um a um.
  Aconteceu nesta máquina em 2026-08-29: 78 dos 93 arquivos acusados eram só fim de linha.

## Próximo app sugerido

### `isolamento/`

Calculadora de isolamento térmico para paredes e cobertura.

- Entradas principais: área, material, clima e temperatura desejada.
- Saídas esperadas: perda/ganho de calor, espessura sugerida e impacto em aquecimento/resfriamento.
- Valor para o portfólio: conecta bem com `arcondicionado/`, `aquecimento/` e `ventilacao/`.

## Backlog prioritário de novos apps

1. `caixadagua/` - volume ideal da caixa d'água, demanda diária e dias de reserva.
2. `irrigacao/` - necessidade diária de água, agenda de irrigação e demanda de bomba.
3. `composteira/` - tamanho da composteira e produção estimada de composto.
4. `estufa/` - área de ventilação, aquecimento e produtividade sazonal.
5. `piscina/` - aquecimento de piscina com coletores ou resistência.
6. `filtroagua/` - filtragem básica, vazão e custo estimado.
7. `gerador/` - gerador ou backup por bateria para cargas essenciais.
8. `carregadorve/` - carregador veicular residencial e tempo de recarga.
9. `horta/` - horta urbana com área, insolação e produtividade.
10. `camarafria/` - refrigeração de pequena câmara fria.

## Melhorias técnicas prioritárias

1. Automatizar parte do smoke test dos apps mais críticos, especialmente idioma, memorial e renderização inicial.
2. Reduzir manutenção manual da página `sobre/`, hoje dependente de atualização explícita quando entram apps novos ou mudam métricas.
3. Consolidar convenções de estrutura entre apps legados e apps mais novos para diminuir divergência visual e de markup.
4. Tornar o fluxo de release mais previsível, sempre sincronizando `README.md`, `ROADMAP.md`, `PRE_COMMIT.md`, `src/i18n/sobre.json`, `sobre/sobre.html`, `config/versions.json` e `sitemap.xml`.
5. Eliminar warnings do build do Vite causados por scripts legados não-module, em especial `Chart.js` UMD e `fazenda-database.js`.
6. Evoluir a revisão terminológica do `patentenautica/` com novos overrides auditáveis sempre que surgirem amostras críticas do banco ministerial.
7. Configurar um provedor SMTP transacional para habilitar recuperação de senha e verificação de e-mail no backend do `patentenautica/`.

## Critérios para próximos apps

- Manter cálculo prático e explicação didática no navegador.
- Preservar i18n `pt-BR` / `it-IT` / `sv-SE`, adaptando parâmetros e normas ao país de cada idioma.
- Reutilizar `src/core/`, `src/utils/` e CSS compartilhado antes de criar código duplicado.
- Priorizar apps que se conectem com os já publicados, formando trilhas temáticas de energia, água, conforto e finanças.
