# Relatório da Auditoria Mestra — Engenharia NATA (engnata.eu)

Data: 2026-06-07

Escopo: arquitetura front-end, performance e cache, segurança (CSP/XSS/dependências), acessibilidade, SEO e i18n, privacidade (LGPD/GDPR), build e deploy, qualidade de cálculo/testes e manutenção assistida por IA.

> Este relatório é o equivalente, para o portfólio **Engenharia NATA**, do que o `RELATORIO_AUDITORIA_MESTRA_DALIE.md` foi para a loja. O mundo aqui é diferente: **não há backend, banco, pagamento Pix nem dados de cliente**. É um site **estático, bilíngue (pt-BR/it-IT), multi-página**, servido como arquivos por GitHub Pages / hospedagem Apache, com toolchain local (Vite + Vitest + ESLint/Prettier/Stylelint). Portanto os riscos não são de "loja quebrada", e sim de **coerência de deploy, performance de carregamento, correção de cálculo, acessibilidade, SEO e manutenibilidade** — exatamente onde uma equipe experiente concentra esforço num portfólio de calculadoras técnicas.

---

## Rodada de Execução - 2026-06-07 - Build = produção, preparado (risco #2)

Escopo desta rodada: preparar o deploy do build do Vite no GitHub Pages. **Decisão do dono: preparar sem ativar** — toda a config pronta e verificada, mas a fonte do Pages continua "deploy from branch" (repo cru), então o site no ar **não muda** até a ativação.

Resultado geral: **Pipeline de deploy pronto e verificado de ponta a ponta; ativação é um passo manual reversível.**

Diagnóstico (por que publicar o `dist/` cru quebraria a produção):

- **Base path errado**: o Vite gerava assets em `/assets/...`, mas o site é servido em `/EngenhariaNata/` → todo CSS/JS daria 404.
- **hp12c fora do build**: não estava nos inputs → BR 12C Niobium sumiria.
- **Estáticos faltando**: `robots.txt`, `sitemap.xml`, `favicon.svg`, `.nojekyll`, verificação Google não iam para o `dist`.
- **Scripts clássicos não bundlados**: o Vite só empacota `type="module"`. Ficavam de fora `assets/js/vendor/chart.umd.js` (5 apps + helice via runtime), `fazenda/fazenda-database.js` e os scripts do hp12c.

Ações aplicadas:

- `local/vite.config.js`: `base` condicional (`/EngenhariaNata/` no build, `/` em dev/preview para não quebrar o fluxo local); **inputs descobertos por glob** (inclui o hp12c... na verdade o exclui — veja abaixo — e qualquer app novo automaticamente, eliminando o risco #25 de esquecer páginas); exclui `template-app` (scaffold) e `hp12c` (standalone).
- `.github/workflows/deploy.yml` (**só `workflow_dispatch`, não dispara em push ainda**): `npm install` + `npm run build`, depois copia para o artefato os scripts clássicos (`vendor/chart.umd.js`, `fazenda-database.js`), o `hp12c/` verbatim e os estáticos de passagem; então `upload-pages-artifact` + `deploy-pages`.
- **Não alterado**: a fonte do Pages segue `legacy` (branch `main`). O site no ar continua sendo o repo cru.

Validações desta rodada:

| Validação | Resultado |
|---|---|
| `npm run lint:check` | **passou** |
| `npm run build` | **passou** (~0,95 s; avisos esperados dos scripts clássicos + 1 css pré-existente) |
| `dist` montado (build + cópias) | completo: todos os apps, hp12c (app.js/guide.js/imagem), chart.umd.js, fazenda-database.js e estáticos presentes |
| `vite preview` em `/EngenhariaNata/` | **200** em home, hp12c, hp12c/app.js, hp12c/guide.js, vendor/chart.umd.js, fazenda-database.js, robots.txt e no asset hasheado |

Como **ativar** (quando quiser servir o build minificado):

1. Trocar a fonte do Pages para Actions: *Settings → Pages → Source: GitHub Actions* (ou `gh api -X PUT repos/souonata/EngenhariaNata/pages -f build_type=workflow`).
2. Descomentar o gatilho `push: { branches: [main] }` em `deploy.yml` (deploy contínuo) ou rodar o workflow manualmente.
3. Reversível: basta voltar a fonte do Pages para "branch".

Riscos restantes / follow-ups:

1. **Fragilidade**: novos scripts clássicos (não-module) precisam ser adicionados à lista de cópia do `deploy.yml`. Refatorá-los para módulos (ou auto-hospedar Chart.js como import) eliminaria isso.
2. **#9**: `package-lock.json` versionado + `npm ci` para deploy reprodutível (hoje usa `npm install`).
3. Após ativar e validar, dá para aposentar o versionamento manual `?v=` (o hash dos assets passa a cuidar do cache).

## Rodada de Execução - 2026-06-07 - Endurecimento de CSP (risco #4, parte do #6)

Escopo desta rodada: estreitar a Content-Security-Policy sem quebrar funcionalidade — remover o que é perigoso (`'unsafe-eval'`) e o que é morto (CDN/domínios não usados).

Resultado geral: **CSP endurecida e verificada no navegador (home + página com gráfico).**

Diagnóstico (verificado):

- **Sem `eval`/`new Function`** em todo o código → `'unsafe-eval'` é desnecessário.
- **Chart.js é 100% local** (`assets/js/vendor/chart.umd.js`) em todos os apps com gráfico (aquecimento, arcondicionado, mutuo, salario, solar via `<script>`; helice via loader próprio apontando ao vendor). Ninguém usa `cdn.jsdelivr.net` (o loader de CDN vivia no `site-config.js`, removido na 2A).
- `worldtimeapi.org` e `*.googleapis.com` **não são usados em produção** (worldtime: nenhum uso; googleapis: só no dashboard local de dev).
- CSP `<meta>` existe só em **3 páginas** (index, solar, sobre); as demais não têm CSP no Pages (o `.htaccess` é inerte lá).

Ações aplicadas — uma **CSP única e endurecida** em `index.html`, `solar/solar.html`, `sobre/sobre.html` e `.htaccess`:

- Removidos: `'unsafe-eval'`, `https://cdn.jsdelivr.net` (script-src e style-src), `https://worldtimeapi.org`, `https://*.googleapis.com`.
- `font-src` estreitado para `'self' data:` (fontes são locais).
- Mantidos os deps reais: `https://gc.zgo.at` (script GoatCounter), `connect-src` para GoatCounter + `*.open-meteo.com` (previsão) + Google Forms (bugs).
- `'unsafe-inline'` **mantido** (há estilos/scripts/SVG inline em todo o site; removê-lo exige hashes/nonces — esforço à parte).
- `solar-script.js`: removida a referência morta ao `carregarChartJS` (ramo inalcançável após a 2A; o Chart.js já vem do `<script>` do vendor).

Validações desta rodada:

| Validação | Resultado |
|---|---|
| `npm run build` | **passou** (~0,98 s; só o aviso de CSS pré-existente) |
| `npm test` | **passou**: 109 testes |
| Preview `index.html` | CSP sem `unsafe-eval`/`jsdelivr`/`worldtimeapi`; GoatCounter carrega; **0 violações de CSP** |
| Preview `solar/solar.html` | `typeof Chart === 'function'` (vendor local) com a CSP nova; **0 violações de CSP** |

Isto também fecha as partes do **risco #6** sobre Chart.js em fonte única (local) e remoção do `worldtimeapi`.

**Correção pós-verificação (preview):** ao estreitar `font-src` para `'self' data:`, descobri que `assets/css/shared-styles.css` carregava a fonte 7-segmentos `DSEG7Classic` do `cdn.jsdelivr.net` (usada no display LED de visitantes da home). Auto-hospedei a fonte em `assets/fonts/dseg7-classic-latin-700-normal.woff2`, atualizei o `@font-face` e subi `shared-styles.css` para `?v=2.0.1` em todas as páginas (invalida o cache e unifica o drift `1.0.4` vs `2.0.0`). Verificado no preview: CSS servido sem jsDelivr, fonte carrega local (`document.fonts.check` = true), 0 violações de CSP. Sem essa correção, a CSP nova teria quebrado a fonte do LED em visitantes com CSS cacheado.

Riscos restantes (próximas rodadas):

1. **Cobertura de CSP inconsistente**: só 3 páginas têm `<meta>` CSP. `bugs` (Google Forms) e `previsao` (Open-Meteo) não têm CSP no Pages. Aplicar a política unificada a todas as páginas é follow-up.
2. `'unsafe-inline'` ainda presente (precisa de hashes/nonces).
3. #2 build ≠ produção; #10 migrar helpers do ex-`site-config.js` para ESM.

## Rodada de Execução - 2026-06-07 - i18n unificado (risco #5)

Escopo desta rodada: eliminar a duplicação de i18n. **A investigação corrigiu a premissa do #5:** não havia dois sistemas vivos brigando — havia **um sistema vivo e correto + um arquivo morto divergente**.

Resultado geral: **Resolvido por remoção de código morto, verificado em runtime.**

Diagnóstico (verificado, não estático):

- O i18n **já é fonte única**: todos os apps e o home usam `src/core/i18n.js` (chave `engnata_idioma`, em `sessionStorage`) via `src/core/app.js`. Teste no preview: troquei para PT no home, naveguei para `salario.html` → persistiu (`engnata_idioma=pt-BR`, `lang=pt-BR`, botão PT ativo). **O idioma não "esquece" entre apps.**
- `assets/js/site-config.js` (a "segunda" i18n, com `idiomaPreferido`) está **morto**: em runtime `typeof SiteConfig`, `formatarMoeda` global e `ajustarTamanhoInput` são todos `undefined`; nenhum HTML o carrega e nenhum JS o importa. `idiomaPreferido` nunca é escrito (`null`).

Ações aplicadas:

- **Removido `assets/js/site-config.js`** (1.238 linhas, via `git rm`). Zero mudança de runtime — o arquivo já não era carregado; `solar`/`fazenda` referenciavam seus globais apenas via guarda `typeof` e já caíam no fallback.
- **`.cursorrules` corrigido**: deixou de mandar "SEMPRE use `site-config.js`" (linhas 26/39) e passou a apontar para `src/core/` e `src/utils/formatters.js`. Essa era a armadilha que poderia reintroduzir a divergência.

Validações desta rodada:

| Validação | Resultado |
|---|---|
| `npm run build` | **passou** (~0,96 s; só o aviso de CSS pré-existente) |
| `npm run lint:check` | **passou** |
| `npm test` | **passou**: 109 testes |
| Preview `fazenda.html` após remoção | carrega **sem erro de console**; `engnata_idioma=pt-BR` persistido |
| Preview `salario.html` (persistência) | idioma PT mantido na navegação entre apps |

Achados e follow-ups (escopo #10):

- `solar`/`fazenda` usavam helpers que só existiam no `site-config.js` (`ajustarTamanhoInput`, `configurarBotoesSliderComAceleracao`, constantes `SiteConfig.DEFAULTS`). Como o arquivo nunca era carregado, esses recursos **já estavam degradados** (ex.: botões `+/−` da fazenda, auto-largura de inputs). Migrar esses helpers para ESM (e reimportá-los) restaura a funcionalidade — fica para a rodada do #10.
- `.cursorrules` cita `.github/copilot-instructions.md` 3× como fonte de verdade, mas **esse arquivo não existe** — doc stale a resolver.

## Rodada de Execução - 2026-06-07 - Cache e origem canônica (riscos #1 e #3)

Escopo desta rodada: desarmar a guerra anti-cache e unificar a origem canônica, sem tocar em lógica de cálculo. Decisões do dono confirmadas antes de executar: **origem canônica = `https://souonata.github.io/EngenhariaNata/`** e **hospedagem = GitHub Pages**.

Resultado geral: **Aplicado e verificado por build.**

Correções aplicadas:

- **Anti-cache (#3):** removidas as metas `<meta http-equiv="Cache-Control|Pragma|Expires">` de **17 arquivos HTML** (todos os apps + `index.html` + `template-app/TEMPLATE_APP.html` + `solar/config.html`), com o comentário associado. Assim o GitHub Pages volta a permitir cache normal do navegador; a invalidação continua pelos `?v=` manuais (consistente com prod = repositório cru).
- **Service Worker (#3):** o bloco no fim de `index.html` foi reduzido a uma **limpeza mínima de legado** — apenas desregistra qualquer SW antigo de visitantes recorrentes, sem apagar todos os caches a cada carregamento e sem `console.log`. O arquivo `sw.js` (SW de autodestruição) ficou **inerte** (nada o registra) e está sinalizado para remoção numa próxima rodada.
- **Origem canônica (#1):** `index.html` JSON-LD `Organization.url` corrigido de `https://engnata.eu/` para a origem canônica; `robots.txt` `Sitemap:` corrigido de `https://engnata.infinityfree.me/sitemap.xml` para a origem canônica. `canonical`, `og:url`, `twitter:url`, JSON-LD `WebSite.url` e `sitemap.xml` já estavam consistentes. Mantidos de propósito: `alternateName: "engnata.eu"` (alias de marca) e a prosa de marketing em `src/i18n/sobre.json`.

Decorrência da decisão de host (GitHub Pages):

- O `.htaccess` permanece **inerte** (Pages não lê headers Apache); a única CSP ativa é a `<meta>`. Não foi criado `CNAME` (sem domínio próprio).
- O endurecimento de CSP (remover `'unsafe-eval'`, estreitar `connect-src`) fica para a rodada do **risco #4**.

Validações desta rodada:

| Validação | Resultado |
|---|---|
| `npm run build` (Vite, 17 HTML como entradas) | **passou** em ~1,0 s; sem erros (único aviso é um `css-syntax-error` pré-existente, não relacionado) |
| `npm test` | **passou**: 109 testes |
| Fim de linha dos 17 HTML | normalizados para CRLF (convenção do repo); diff limpo, só remoções |
| `grep engnata.eu\|infinityfree` | resta apenas o `alternateName` de marca, como planejado |

Observação: `lint:check`/`format:check` rodam com escopo `local/` e **não cobrem o HTML da raiz** — por isso o build é o sinal real desta rodada (achado adicional já anotado em Manutenibilidade).

Riscos restantes (próximas rodadas):

1. #2 build ≠ produção: o `dist/` ainda não é deployado; `?v=` manual segue como invalidação.
2. #4 CSP com `'unsafe-eval'` e `.htaccess` inerte.
3. #5 i18n duplicado (`engnata_idioma` vs `idiomaPreferido`).
4. `sw.js` é código morto a remover.

## 1. Estado Geral

Classificação geral: **Bom, com dívida arquitetural concentrada e incoerências de deploy/SEO a corrigir.**

O projeto é funcional, organizado e com boas intenções de qualidade: separação `src/core` + `src/utils` + `src/components`, i18n por chave, tema claro/escuro, analytics privacy-first (GoatCounter), CSP declarada, suíte Vitest verde e build Vite multi-página que funciona. Para um portfólio mantido por poucas pessoas, a base é sólida.

Os riscos reais se agrupam em quatro frentes:

1. **Deploy e SEO incoerentes** — o projeto referencia **três origens de produção diferentes** (GitHub Pages, `engnata.eu` e `engnata.infinityfree.me`), com `canonical`, `sitemap` e marca discordando entre si. E o **artefato servido em produção é o repositório cru**, não o `dist/` do Vite — ou seja, todo o pipeline de build (hash de assets, minificação, `drop_console`) **não chega ao usuário final**.
2. **Guerra anti-cache** — `<meta http-equiv>` de `no-store`, um Service Worker de autodestruição e um script que apaga todos os caches a cada carregamento, somados a versionamento manual `?v=` divergente. O resultado é zero benefício de cache num site cuja maior vantagem deveria ser carregar instantaneamente.
3. **Duplicação de núcleo** — coexistem **dois sistemas de i18n** (com chaves de armazenamento diferentes), **dois conjuntos de formatação numérica** e um monólito global de 1.238 linhas (`site-config.js`) que reimplementa scroll/clique/slider em touch. Manutenção frágil e bugs sutis em mobile.
4. **Cálculo sem rede de proteção** — o valor do portfólio é a **correção numérica**, mas apenas 2 de 15 apps têm a lógica extraída e coberta por testes. Os outros 13 têm o cálculo acoplado ao DOM, sem teste.

Nenhum desses pontos é "incêndio", mas todos são exatamente o que uma equipe técnica atualizada arrumaria antes de dizer que o site está "bem projetado".

---

## 2. Validações Executadas

Executadas nesta auditoria, com resultados reais:

| Validação | Comando | Resultado |
|---|---|---|
| Suíte de testes | `npm test` (em `local/`) | **109 testes passaram** — `mutuo` (39) + `salario` (70) |
| Lint | `npm run lint:check` | **passou**, sem erros |
| Build de produção (smoke) | `npm run build` | **passou** em ~1,2 s; 18 entradas HTML, assets com hash |
| Inventário de tamanho | `wc -l` em scripts/CSS | maiores: `solar-script.js` (2.536), `fazenda-script.js` (1.830), `mutuo-script.js` (1.817), `aquecimento-script.js` (1.267), `site-config.js` (1.238) |
| `console.*` em código de app | `grep` | **43 ocorrências em 7 scripts** que vão para produção (o `drop_console` do Terser só age no `dist/`, que não é deployado) |
| `innerHTML`/`data-i18n-html` | `grep` | **73 ocorrências em 18 arquivos** |
| Origens de produção declaradas | leitura | **3 divergentes**: `souonata.github.io`, `engnata.eu`, `engnata.infinityfree.me` |

Observação importante: o `npm run validate` local (lint + format + style + test) é uma boa porta de qualidade, mas o próprio `PRE_COMMIT.md` reconhece que "`npm test` ainda não cobre o projeto; não use isso como sinal de qualidade". A auditoria confirma: a suíte verde cobre só `mutuo` e `salario`.

---

## 3. Top 10 Riscos Priorizados

### 1. Três origens de produção e `canonical`/`sitemap` divergentes

- Severidade: **Alta** (SEO e identidade do site)
- Arquivos: `index.html:28` (`canonical` → `souonata.github.io`), `index.html:67` (JSON-LD Organization → `engnata.eu`), `robots.txt:8` (`Sitemap:` → `engnata.infinityfree.me/sitemap.xml`), `sitemap.xml` (URLs internas → `souonata.github.io`).
- Impacto: o Google recebe sinais conflitantes — a URL canônica aponta para o GitHub Pages, o `robots.txt` aponta o sitemap para o InfinityFree, e a marca é `engnata.eu`. Isso fragmenta autoridade de domínio, pode gerar conteúdo duplicado e indexação da origem errada.
- Correção recomendada: **escolher uma origem canônica única** (o natural é `https://engnata.eu/`), e alinhar `canonical`, `og:url`, `twitter:url`, JSON-LD, `robots.txt` e as URLs internas do `sitemap.xml` a ela. Configurar redirecionamento 301 das demais origens para a canônica. Adicionar `CNAME` (engnata.eu) no repositório se o Pages for a origem real, ou decidir formalmente que a hospedagem é Apache (InfinityFree/Hostinger) — não as duas ao mesmo tempo.
- Validação: `curl -I` de cada origem confirmando 301 → canônica; Search Console com uma única propriedade; `sitemap.xml` e `robots.txt` apontando para o mesmo host.

### 2. O que é servido em produção é o repositório cru, não o build do Vite

- Severidade: **Alta** (performance e a razão de existir do build)
- Arquivos: `.github/workflows/test.yml` (só roda teste + build como *smoke*, **não há job de deploy**), `.nojekyll`, `local/vite.config.js` (gera `dist/` com hash e `drop_console`).
- Impacto: existe um pipeline moderno (multi-página, Terser, `entryFileNames: [name]-[hash].js`, sourcemaps) que **nunca chega ao usuário**. Em produção entram os arquivos-fonte com `console.*`, sem minificação e sem hash de cache. O build serve apenas como verificação de fumaça no CI.
- Risco real: o site é mais pesado e mais lento do que precisa; o cache-busting confiável (hash) é trocado por `?v=` manual e propenso a erro; e ninguém percebe se a versão "real" diverge da que o build validaria.
- Correção recomendada: decidir o modelo e assumi-lo:
  - **(A) Servir o `dist/` do Vite** — adicionar um job no Actions que faz `npm run build` e publica `local/dist` no GitHub Pages (`actions/deploy-pages`). Ganha minificação, hash e `drop_console` de graça.
  - **(B) Assumir explicitamente o repo cru como produção** — então remover o build enganoso, parar de confiar em `drop_console` e tratar o versionamento manual como contrato.
  A opção (A) é a que "uma equipe experiente" escolheria.
- Validação: comparar `Network` do site publicado com o `dist/` (nomes com hash, `Content-Length` menor); confirmar ausência de `console.*` no bundle servido.

### 3. Guerra anti-cache anula toda a performance de um site estático

- Severidade: **Alta** (performance/UX percebida)
- Arquivos: `index.html:9-11` (`Cache-Control: no-store` em `<meta>`), `sw.js` (Service Worker que apaga caches e se desregistra), `index.html:808-831` (desregistra todo SW e apaga todos os caches a cada visita), `index.html:76-77` e `:805` (`?v=` manual).
- Impacto: um site estático de calculadoras deveria ser quase instantâneo em visitas repetidas. Hoje, três mecanismos brigam para **garantir que nada seja cacheado**: meta `no-store` (que, aliás, é amplamente ignorada por navegadores como diretiva HTTP e é anti-padrão), SW de autodestruição e limpeza forçada de cache no carregamento.
- Risco real: cada visita rebaixa CSS/JS/fontes; pior LCP/FCP, mais consumo de dados no mobile, pior nota de Lighthouse — sem nenhum ganho compensatório.
- Correção recomendada: parar de combater o cache e **versionar para invalidar** (hash de assets via build — ver risco #2). Remover as metas `Cache-Control/Pragma/Expires`, remover o `sw.js` de autodestruição e o bloco de limpeza do `index.html`. Definir headers de cache reais no host (longo para assets com hash, curto/`no-cache` só para os `.html`). Se quiser PWA/offline de verdade, escrever um SW com estratégia *stale-while-revalidate* — mas isso é opcional.
- Validação: Lighthouse antes/depois; segunda visita servindo assets do disk cache (200 from cache); `curl -I` mostrando `Cache-Control: immutable` nos assets com hash.

### 4. CSP com `'unsafe-inline'` + `'unsafe-eval'` e `.htaccess` inerte no Pages

> **Atualização (Rodada #4):** `'unsafe-eval'` removido (não há `eval` no código); `cdn.jsdelivr.net`, `worldtimeapi.org` e `*.googleapis.com` removidos; `font-src` estreitado. Política unificada aplicada a index/solar/sobre + `.htaccess`. Pendente: `'unsafe-inline'` e cobrir as páginas sem `<meta>` CSP.

- Severidade: **Média/Alta** (segurança)
- Arquivos: `index.html:14` (CSP via `<meta>`), `.htaccess` (CSP via header Apache).
- Impacto: a política permite `script-src 'unsafe-inline' 'unsafe-eval'`. `unsafe-eval` abre superfície de XSS desnecessária (Chart.js 4 UMD **não precisa de eval**). Há ainda inline `<script>`/`style=` por toda parte, o que obriga `'unsafe-inline'`. Além disso, **o `.htaccess` só vale em Apache** — se a produção for GitHub Pages, ele é ignorado e a única CSP ativa é a `<meta>`, que não consegue aplicar diretivas como `frame-ancestors`.
- Correção recomendada: remover `'unsafe-eval'` (testar os gráficos depois); migrar inline scripts/estilos para arquivos e adotar **hashes ou nonces** para eliminar `'unsafe-inline'` em `script-src`; reduzir `connect-src`/`script-src` ao mínimo realmente usado (ver risco #6 sobre `worldtimeapi`/`googleapis`). Definir a CSP no nível certo do host real (header HTTP no Apache; ou, no Pages, aceitar a limitação da `<meta>` e endurecê-la).
- Validação: console sem violações de CSP após remover `unsafe-eval`; teste manual dos apps com gráfico; `securityheaders.com` no domínio canônico.

### 5. Dois sistemas de i18n com chaves de armazenamento diferentes

> **Atualização (Rodada 2A):** verificado em runtime que só o caminho ESM (`engnata_idioma`) está vivo; `site-config.js` (`idiomaPreferido`) era código morto não carregado. Resolvido removendo o arquivo e corrigindo o `.cursorrules`. O diagnóstico abaixo é o original (leitura estática).

- Severidade: **Média/Alta** (correção funcional + manutenção)
- Arquivos: `src/core/i18n.js:3` (`engnata_idioma`, em `sessionStorage`), `assets/js/site-config.js:11` e `:84-89` (`idiomaPreferido`, em `sessionStorage`), `src/core/theme.js:14` (lê `engnata_idioma`).
- Impacto: existem **dois mecanismos de idioma vivos** — o moderno (`I18nManager` ESM) e o legado global (`trocarIdiomaGlobal`) — gravando o idioma em **chaves diferentes**. Apps/páginas que usam um caminho não enxergam a escolha feita pelo outro. O tema lê `engnata_idioma`; se um app só gravou `idiomaPreferido`, o botão de tema pode sair no idioma errado.
- Risco real: idioma "esquecido" ao navegar entre apps, textos misturados PT/IT, label de tema no idioma errado. É um bug de coerência difícil de reproduzir porque depende de qual app o usuário abriu primeiro.
- Correção recomendada: eleger o `src/core/i18n.js` como **fonte única**, padronizar a chave (`engnata_idioma`) e migrar quem usa `trocarIdiomaGlobal`/`idiomaPreferido` para ela; manter um *shim* de leitura da chave antiga por uma versão para não perder a preferência de quem já visitou. Decidir também `sessionStorage` vs `localStorage` (hoje o nome `idiomaPreferido` sugere persistência, mas está em `sessionStorage` e some ao fechar a aba).
- Validação: trocar idioma num app, navegar para outro e para a home, confirmar persistência; teste unitário do `I18nManager` cobrindo leitura da chave legada.

### 6. Dependências externas frágeis e amplas demais no `connect-src`

- Severidade: **Média**
- Arquivos: `index.html:14` e `.htaccess` (`connect-src ... https://worldtimeapi.org https://*.googleapis.com ...`), `assets/js/site-config.js:41` (Chart.js via `cdn.jsdelivr.net`).
- Impacto: `worldtimeapi.org` é um serviço gratuito com histórico de instabilidade; se a barra de status depende dele, ela quebra/atrasa quando o serviço cai. `*.googleapis.com` é um curinga largo. E o Chart.js é carregado de **duas formas distintas** (CDN em `site-config.js` vs arquivo local `assets/js/vendor/chart.umd.js` em `aquecimento.html:37`/`arcondicionado.html:570`).
- Correção recomendada: padronizar **uma** fonte de Chart.js — o `vendor/chart.umd.js` local (auto-hospedado, offline-friendly, sem custo de CSP de terceiros) — e remover o loader de CDN; ou o inverso, mas não os dois. Substituir `worldtimeapi` pelo relógio local do dispositivo (`Date`/`Intl`) ou tornar o uso resiliente a falha. Estreitar `connect-src`/`img-src` ao que de fato é chamado (Open-Meteo, GoatCounter, Google Forms se o `bugs/` usar).
- Validação: app de gráfico funcionando offline; barra de status funcionando com a rede do `worldtimeapi` bloqueada; CSP sem domínios mortos.

### 7. `setSafeHTML` não sanitiza, e há 73 usos de `innerHTML`

- Severidade: **Média** (defesa em profundidade)
- Arquivos: `src/utils/sanitize.js:25-28` (`setSafeHTML` apenas faz `element.innerHTML = html`), `src/core/i18n.js:55-61` (`data-i18n-html` → `innerHTML`), e 73 ocorrências de `innerHTML`/`data-i18n-html` em 18 arquivos.
- Impacto: o nome `setSafeHTML` sugere segurança que ele não entrega — é um *footgun*. Hoje o conteúdo é majoritariamente **first-party** (traduções e templates próprios), então a exploração real é baixa. Mas qualquer fluxo onde entre valor do usuário (ex.: eco de campo no `bugs/`, rótulo derivado de input) vira XSS latente.
- Correção recomendada: renomear para algo honesto (`setTrustedHTML`) **ou** torná-lo de fato seguro (sanitização ou *Trusted Types*); preferir `textContent`/`createSecureElement` (já existe) para qualquer string derivada de input; auditar os 73 usos separando "template estático" de "interpolação de dado".
- Validação: revisão dos pontos com interpolação; teste manual injetando `<img onerror>` em campos de formulário.

### 8. Cálculo acoplado ao DOM em 13 de 15 apps — sem rede de testes

- Severidade: **Média/Alta** (correção é o produto)
- Arquivos: `local/vitest.config.js:26` (`include: ['**/*-calc.test.js']`), e a ausência de `*-calc.js` em todos exceto `mutuo` e `salario`. Scripts grandes como `solar/solar-script.js` (2.536 linhas), `fazenda/fazenda-script.js` (1.830) e `aquecimento/aquecimento-script.js` (1.267) misturam fórmula, formatação e DOM.
- Impacto: o portfólio vende **cálculo de engenharia correto** (NBR 5410, NBR 15527, dimensionamento solar, BTU, INSS/IRPEF…). Hoje, só salário e empréstimo têm fórmulas isoladas e testadas. Um refactor ou ajuste de tabela em qualquer outro app pode introduzir erro numérico silencioso.
- Correção recomendada: aplicar o padrão já provado — extrair `*-calc.js` (ESM puro, sem DOM) + `*-calc.test.js` — em ondas, priorizando os de maior risco/uso (`solar`, `bitola`, `arcondicionado`, `chuva`, `aquecimento`). Cobrir invariantes e fronteiras como já é feito em `mutuo` (Σ amortizações = principal).
- Validação: cada extração mantém a UI idêntica e adiciona testes verdes antes do commit; meta de cobertura por onda no `vitest.config.js`.

### 9. Build não-reprodutível: lockfile fora do Git e `npm install` no CI

- Severidade: **Média** (supply chain / reprodutibilidade)
- Arquivos: `.github/workflows/test.yml:23-27` (comentário explícito: lockfile é gitignored, por isso `npm install`), `local/.gitignore`.
- Impacto: sem `package-lock.json` versionado, cada `npm install` (local e no CI) pode resolver versões transitivas diferentes. Um patch quebrado a montante pode falhar build/teste sem nenhuma mudança no código, e o CI deixa de ser determinístico.
- Correção recomendada: **commitar `local/package-lock.json`** e trocar o CI para `npm ci`. Isso também habilita auditoria de dependências confiável (`npm audit`) e Dependabot. Fixar versões maiores (hoje há um mix de `^` e versões exatas em `local/package.json`).
- Validação: dois `npm ci` em máquinas diferentes gerando a mesma árvore; CI verde com `npm ci`.

### 10. Monólito `site-config.js` reimplementa comportamento nativo de touch

- Severidade: **Média** (manutenção + bugs sutis em mobile)
- Arquivos: `assets/js/site-config.js` (1.238 linhas): config + formatação + parsing heurístico de número (`:116-198`) + cache de DOM + debounce/throttle + loader de Chart.js + **handler global de gestos touch (`:873-1088`)**.
- Impacto: o handler global intercepta `touchstart/move/end` no documento inteiro, sintetiza cliques com `setTimeout`, e reposiciona sliders manualmente — reimplementando o que o navegador já faz. É uma fonte clássica de bugs sutis (cliques duplos, "fantasma", scroll travado, slider pulando) e difícil de manter. O parsing heurístico decimal-vs-milhar (`obterValorNumericoFormatado`) tenta adivinhar se `1.234` é 1,234 ou 1234 — ambíguo por construção.
- Correção recomendada: quebrar `site-config.js` por responsabilidade (config, formatação, utils de UI), eliminar a duplicação com `src/utils/formatters.js`; substituir o handler global de touch por CSS (`touch-action`) e eventos nativos onde possível; substituir o parsing heurístico por `Intl.NumberFormat`/parser determinístico por locale (PT e IT compartilham `,` decimal e `.` milhar, o que simplifica).
- Validação: testar sliders e botões `+/-` em dispositivo touch real antes/depois; testes unitários do novo parser de número por locale.

---

## 4. Segurança

Não há superfície de servidor, banco ou pagamento — o vetor relevante é **front-end** (XSS, CSP, terceiros, supply chain).

| Item | Estado | Observação |
|---|---|---|
| CSP declarada | Parcial | Existe em `<meta>` e `.htaccess`, mas com `unsafe-inline` + `unsafe-eval` e `.htaccess` inerte fora de Apache (risco #4) |
| `unsafe-eval` | Ajustar | Chart.js 4 UMD não precisa; remover reduz superfície de XSS |
| Sanitização | Ajustar | `setSafeHTML` é no-op; 73 usos de `innerHTML` (risco #7) |
| Validação de URL | Ok | `validarURL` bloqueia `javascript:`/`data:` (typo cosmético em `protecolosSegulos`, sem efeito funcional) |
| Terceiros | Ajustar | Chart.js em CDN + vendor; `worldtimeapi`; `*.googleapis.com` curinga (risco #6) |
| Supply chain | Ajustar | Sem lockfile versionado, sem `npm audit` confiável, sem Dependabot (risco #9) |
| Subresource Integrity | Ausente | Scripts de CDN (`gc.zgo.at`, `cdn.jsdelivr.net`) sem `integrity`/`crossorigin` |
| Segredos | Ok | Nenhum segredo no front-end (correto para site estático) |

Prioridades de segurança:

| Prioridade | Pendência | Arquivos |
|---|---|---|
| P1 | Remover `unsafe-eval`; estreitar `script-src`/`connect-src` | `index.html:14`, `.htaccess` |
| P1 | Tornar `setSafeHTML` honesto/seguro e auditar `innerHTML` | `src/utils/sanitize.js`, apps |
| P2 | Versionar lockfile + `npm ci` + `npm audit`/Dependabot | `local/`, `.github/workflows/test.yml` |
| P2 | SRI nos scripts de CDN remanescentes (ou auto-hospedar tudo) | `index.html:85-86` |

---

## 5. Performance e Escala

A "escala" aqui é número de páginas e peso por página, não tráfego de API. Os ganhos vêm de **cache real, build servido e menos JS por página**.

### Fluxos quentes

| Fluxo | Frequência | Custo atual | Proposta |
|---|---:|---|---|
| Primeira visita à home | alta | HTML + CSS compartilhado (~37 kB) + `site-config.js` 1.238 linhas | Servir `dist/` minificado; dividir `site-config.js` |
| Visita repetida (qualquer página) | alta | **sem cache** (meta no-store + SW autodestrutivo) | Cache real com assets versionados por hash (riscos #2/#3) |
| Abrir app com gráfico | média | Chart.js (CDN ou vendor, ~200 kB) | Auto-hospedar único + `import()` sob demanda (já há `carregarChartJS`) |
| Troca de idioma | média | `fetch` de `src/i18n/<app>.json` com `cache: 'no-store'` | Permitir cache do JSON de tradução (não muda entre deploys) |
| Barra de status (relógio) | alta na home | depende de `worldtimeapi` | Relógio local do dispositivo |

### Front-end

- `index.html` tem **~830 linhas** com SVG e markup **duplicados** (grade de ícones + cards de descrição repetem cada app). Catálogo deveria ser **data-driven** (um array de apps renderizado), eliminando ~400 linhas e o risco de a grade e os cards divergirem.
- Scripts grandes (`solar` 2.536, `fazenda` 1.830, `mutuo` 1.817) carregam tudo de uma vez; extrair `*-calc.js` também ajuda a enxugar a camada de UI.
- `config/versions.json` (`lastUpdate: 2026-05-31`, `index: 2.0.0`) e os `?v=` no HTML (`1.0.4` no CSS, `1.0.2` no script) e o `local/package.json` (`1.0.2`) **divergem entre si** — o versionamento manual é fonte de erro; resolver com hash de build.

### Cache recomendado (após adotar hash de assets)

| Recurso | TTL sugerido | Observação |
|---|---:|---|
| `*.html` | `no-cache` (revalida) | precisa refletir o deploy |
| CSS/JS com hash (`[name]-[hash].js`) | 1 ano, `immutable` | nome muda quando o conteúdo muda |
| `src/i18n/*.json` | curto (1h) ou versionado | não muda entre deploys |
| `favicon.svg`, fontes (`DSEG7…woff2`) | 30 dias+ | estáveis |
| Imagens (`hp12c/*.png/.jpg`) | 30 dias+ | estáveis; converter para WebP |

---

## 6. Acessibilidade (a11y)

Pontos bons: uso de `aria-label`/`aria-pressed`/`aria-live` no seletor de idioma e no dock; `data-i18n-aria` para localizar rótulos; `role="img"`/`aria-hidden` em SVGs decorativos; `inputmode`/`pattern`/`enterkeyhint` configurados para teclado mobile (`src/core/app.js:110-152`).

A endereçar:

- **`<html lang>` inicial incoerente**: `index.html:2` declara `lang="it-IT"` enquanto o conteúdo de fallback é português e `og:locale` é `pt_BR`. O `lang` só é corrigido por JS depois (`i18n.js:36`). Para SEO e leitores de tela, defina o `lang` inicial coerente com o conteúdo entregue no HTML.
- **Sem `hreflang`**: site bilíngue sem `<link rel="alternate" hreflang>` perde sinal de internacionalização para o Google (ver SEO).
- **Contraste e foco**: revisar foco visível em `:focus-visible` e contraste dos LEDs/chips do dock no tema claro.
- **Handler global de touch** (`site-config.js`) pode interferir em tecnologias assistivas ao sintetizar cliques; preferir comportamento nativo.
- **Movimento**: o marquee do dock e animações devem respeitar `prefers-reduced-motion`.

Validação: auditoria axe/Lighthouse a11y por página; navegação só por teclado; teste com leitor de tela na troca de idioma.

---

## 7. SEO e i18n

Além das três origens divergentes (risco #1), pontos específicos:

- **`hreflang` ausente** — para um site pt-BR/it-IT, adicionar em cada página `<link rel="alternate" hreflang="pt-BR" ...>`, `hreflang="it-IT"` e `x-default`. Hoje a alternância é só client-side (sessionStorage), invisível para buscadores; cada idioma deveria ter URL indexável ou, no mínimo, marcação `hreflang`.
- **JSON-LD** bom (WebSite + Organization), mas com domínios inconsistentes; cada app de calculadora poderia ganhar `SoftwareApplication`/`WebApplication` schema.
- **`sitemap.xml`** lista `souonata.github.io`, mas `robots.txt` aponta o sitemap para `engnata.infinityfree.me` — alinhar à origem canônica única e manter datas `lastmod` reais.
- **Meta cache no-store** atrapalha também *crawl efficiency*; remover (risco #3).
- **`maximum-scale=5.0`**: aceitável (permite zoom), manter `user-scalable=yes`.

---

## 8. Privacidade (LGPD / GDPR)

Como o público é Brasil + Itália, vale considerar **as duas leis**. O cenário é favorável: o site é estático e coleta pouquíssimo.

| Item | Estado | Observação |
|---|---|---|
| Analytics | **Bom** | GoatCounter é privacy-first, sem cookies, sem PII — adequado a LGPD/GDPR |
| Dados pessoais | Mínimos | Não há login/cadastro; preferências (tema/idioma) ficam em `sessionStorage`/`localStorage` no próprio dispositivo |
| `localStorage` (`engnata_*`, `configSolar`) | Ok | dado técnico local, não pessoal; documentar na política |
| Formulário `bugs/` | Revisar | Se envia para Google Forms/Apps Script (CSP cita `docs.google.com`/`script.google.com`), há transferência a terceiro (Google) e possível dado pessoal opcional (contato) — exige aviso de privacidade e base legal |
| Política de privacidade / cookies | **Ausente/implícita** | Não há página de privacidade. Mesmo sem cookies, GDPR pede transparência sobre analytics e sobre o envio do formulário ao Google |
| `connect-src` a terceiros | Revisar | Cada terceiro (Google, Open-Meteo, worldtimeapi, jsdelivr) é um processamento a declarar |

Recomendações: criar uma página curta de **Privacidade** (PT/IT) explicando GoatCounter (sem cookies), o uso de `localStorage` para preferências e o envio do formulário de bugs ao Google; deixar o contato no formulário claramente **opcional** com finalidade declarada.

---

## 9. Manutenibilidade e Arquitetura

O maior risco de longo prazo (e o que mais afeta "manutenção assistida por IA") é a **duplicação de caminhos** e os **arquivos grandes**.

- **Dois i18n** (risco #5) e **duas formatações numéricas** (`site-config.js` global vs `src/utils/formatters.js` ESM) — uma IA ou dev novo não sabe qual usar, e corrigir num lado não corrige no outro.
- **Build ≠ produção** (risco #2) — qualquer pessoa que confie no `drop_console`/minificação está enganada sobre o que o usuário recebe.
- **`index.html` duplicado** — grade e cards repetem cada app; manutenção dobrada e propensa a divergir.
- **Métricas manuais** — `sobre/sobre.html` e `config/versions.json` são mantidos à mão (o `PRE_COMMIT.md` avisa). Geram drift (ex.: README diz "12 calculadoras", o catálogo tem mais; versões divergentes).
- **`hp12c` fora do build** — `local/vite.config.js` não inclui `hp12c/index.html` nas entradas; o smoke do CI não cobre essa página.
- **Scripts legados não-module** (`fazenda-database.js`, Chart.js UMD) geram avisos de build (citados na ROADMAP) e ficam fora do grafo de módulos.

Boas práticas a institucionalizar (nível "equipe experiente"):

1. Fonte única para i18n, formatação e Chart.js.
2. Catálogo de apps data-driven (um manifesto JSON renderiza home, `sobre/` e `sitemap.xml`) — elimina o trabalho manual e o drift.
3. Build = produção (deploy do `dist/`).
4. `*-calc.js` + testes para todo app com fórmula.
5. Lockfile versionado + `npm ci` + Dependabot.

---

## 10. Plano de Correção

### Bloqueantes / antes de dizer "bem projetado"

1. **Definir origem canônica única** e alinhar `canonical`, `og`, JSON-LD, `robots.txt`, `sitemap.xml` (risco #1).
2. **Decidir build = produção** e publicar o `dist/` (risco #2).
3. **Desarmar a guerra anti-cache** e adotar cache por hash (risco #3).
4. **Remover `unsafe-eval`** e definir a CSP no nível certo do host (risco #4).
5. **Unificar o i18n** numa fonte/chave única (risco #5).

### Curto prazo

1. Padronizar uma única fonte de Chart.js e remover `worldtimeapi`/curingas do `connect-src` (risco #6).
2. Tornar `setSafeHTML` honesto/seguro e auditar `innerHTML` (risco #7).
3. Versionar `package-lock.json` + `npm ci` + Dependabot (risco #9).
4. Incluir `hp12c/index.html` no build; resolver avisos de scripts não-module.
5. Adicionar `hreflang` + `<html lang>` inicial coerente.

### Médio prazo

1. Extrair `*-calc.js` + testes para `solar`, `bitola`, `arcondicionado`, `chuva`, `aquecimento` (risco #8).
2. Quebrar `site-config.js` por responsabilidade e remover o handler global de touch (risco #10).
3. Tornar o catálogo de apps data-driven (home + `sobre/` + `sitemap.xml` a partir de um manifesto).
4. Automatizar métricas de `sobre/` e versões (eliminar manutenção manual).
5. Página de Privacidade PT/IT.

### Futuro

1. PWA opcional com SW *stale-while-revalidate* (offline real, ao contrário do SW atual).
2. Lighthouse CI no pipeline (orçamento de performance/a11y por página).
3. Testes de fumaça de DOM (idioma, render inicial, memorial) nos apps críticos.
4. Converter imagens (`hp12c`) para WebP e adicionar `width/height` para evitar CLS.
5. Smoke test que detecte divergência entre catálogo, `versions.json` e `sobre/`.

---

## 11. Top 30 Melhorias

| # | Melhoria | Impacto | Esforço | Risco |
|---:|---|---|---|---|
| 1 | Origem canônica única (canonical/og/sitemap/robots/JSON-LD) | Alto | Baixo | Baixo |
| 2 | Deploy do `dist/` do Vite no Pages (build = produção) | Alto | Médio | Médio |
| 3 | Remover meta no-store + SW autodestrutivo + limpeza de cache | Alto | Baixo | Baixo |
| 4 | Cache por hash de assets + headers de cache no host | Alto | Médio | Baixo |
| 5 | Remover `'unsafe-eval'` da CSP | Médio | Baixo | Baixo |
| 6 | Unificar i18n numa fonte e chave única | Alto | Médio | Médio |
| 7 | Uma única fonte de Chart.js (auto-hospedado) | Médio | Baixo | Baixo |
| 8 | `setSafeHTML` seguro/honesto + auditoria de `innerHTML` | Médio | Médio | Baixo |
| 9 | Versionar lockfile + `npm ci` no CI | Médio | Baixo | Baixo |
| 10 | Dependabot + `npm audit` no pipeline | Médio | Baixo | Baixo |
| 11 | `hreflang` PT/IT + `x-default` em todas as páginas | Médio | Baixo | Baixo |
| 12 | `<html lang>` inicial coerente com o conteúdo | Baixo/Médio | Baixo | Baixo |
| 13 | Catálogo de apps data-driven (manifesto JSON) | Médio | Médio | Médio |
| 14 | Gerar `sitemap.xml` e métricas de `sobre/` do manifesto | Médio | Médio | Baixo |
| 15 | Extrair `solar-calc.js` + testes | Alto | Alto | Médio |
| 16 | Extrair `bitola-calc.js` + testes | Alto | Médio | Médio |
| 17 | Extrair `arcondicionado-calc.js` + testes | Médio | Médio | Médio |
| 18 | Extrair `chuva-calc.js` + testes | Médio | Médio | Médio |
| 19 | Extrair `aquecimento-calc.js` + testes | Médio | Alto | Médio |
| 20 | Quebrar `site-config.js` por responsabilidade | Médio | Alto | Médio |
| 21 | Remover handler global de touch (usar `touch-action`/nativo) | Médio | Médio | Médio |
| 22 | Parser de número determinístico por locale | Médio | Médio | Médio |
| 23 | Substituir `worldtimeapi` por relógio local | Baixo/Médio | Baixo | Baixo |
| 24 | Estreitar `connect-src`/`img-src` ao uso real | Médio | Baixo | Baixo |
| 25 | Incluir `hp12c/index.html` no build do Vite | Baixo | Baixo | Baixo |
| 26 | Resolver scripts não-module (fazenda-database, Chart UMD) | Baixo/Médio | Médio | Baixo |
| 27 | Página de Privacidade PT/IT | Médio | Baixo | Baixo |
| 28 | Lighthouse CI com orçamento por página | Médio | Médio | Baixo |
| 29 | Converter imagens para WebP + `width/height` (anti-CLS) | Médio | Baixo | Baixo |
| 30 | SRI nos scripts de CDN remanescentes | Baixo | Baixo | Baixo |

---

## 12. Patches Sugeridos

### CSP sem `unsafe-eval` (e mais estreita)

`index.html:14` / `.htaccess` — remover `'unsafe-eval'`, manter só os terceiros realmente usados:

```text
default-src 'self';
script-src 'self' 'unsafe-inline' https://gc.zgo.at;
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self' https://souonata.goatcounter.com https://*.open-meteo.com https://script.google.com;
object-src 'none'; base-uri 'self'; form-action 'self' https://docs.google.com;
upgrade-insecure-requests;
```

(Ajustar conforme a fonte final de Chart.js e do formulário; o objetivo é cair `unsafe-eval` e os curingas largos.)

### Job de deploy do build no GitHub Pages

`.github/workflows/` — publicar o `dist/` em vez do repo cru:

```yaml
deploy:
  needs: test
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  permissions: { pages: write, id-token: write }
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20' }
    - run: npm ci
      working-directory: local
    - run: npm run build
      working-directory: local
    - uses: actions/upload-pages-artifact@v3
      with: { path: local/dist }
    - uses: actions/deploy-pages@v4
```

### Service worker: remover a autodestruição

Apagar `sw.js` e o bloco `index.html:808-831`. Se quiser PWA depois, escrever um SW *cache-first para assets com hash, network-first para HTML* — não um que se desregistra.

### i18n: chave única + leitura do legado

`src/core/i18n.js` — ler a chave antiga uma vez para não perder a preferência:

```js
const IDIOMA_SESSION_KEY = 'engnata_idioma';
const LEGACY_KEY = 'idiomaPreferido';
// ...
const salvo = sessionStorage.getItem(IDIOMA_SESSION_KEY)
           ?? sessionStorage.getItem(LEGACY_KEY);
```

E migrar `assets/js/site-config.js` (`trocarIdiomaGlobal`) para delegar ao `I18nManager`, eliminando o segundo caminho.

### CI reprodutível

Versionar `local/package-lock.json` (remover do `.gitignore`) e trocar no workflow:

```yaml
- run: npm ci
  working-directory: local
```

---

## 13. Observações Finais

- A base é boa e o time já adota práticas certas (i18n por chave, `src/core`, suíte Vitest verde, `PRE_COMMIT.md`, build multi-página). O que falta para o site parecer feito por "uma equipe técnica experiente e atualizada" não é reescrever — é **resolver as incoerências de deploy/cache/SEO** e **eliminar a duplicação de núcleo**.
- A prioridade técnica mais alta é a **frente de deploy/SEO/cache** (riscos #1, #2, #3): são de baixo/médio esforço, alto impacto, e destravam tudo (Lighthouse, indexação, confiança no build).
- A prioridade de **produto** é a **correção de cálculo** (risco #8): extrair `*-calc.js` + testes app a app, no padrão já provado por `mutuo`/`salario`.
- Sugestão de método: como no relatório da Dalie, evoluir por **rodadas de execução** curtas e versionadas — cada rodada com escopo fechado, `npm run validate` antes/depois e uma entrada neste arquivo registrando o que mudou.

---

### Anexo — Referências verificadas nesta auditoria

- `index.html:2,9-11,14,28,67,76-77,805,808-831` — `lang`, metas de cache, CSP `<meta>`, canonical, JSON-LD, `?v=`, SW unregister.
- `sw.js` — service worker de autodestruição.
- `.htaccess` — CSP via header (Apache).
- `robots.txt:8` — `Sitemap:` para `engnata.infinityfree.me`.
- `sitemap.xml` — URLs internas em `souonata.github.io`.
- `src/core/i18n.js:3,36,55-61` / `src/core/theme.js:14` — chave `engnata_idioma`.
- `assets/js/site-config.js:11,41,84-89,116-198,873-1088` — chave `idiomaPreferido`, CDN Chart.js, parsing heurístico, handler global de touch.
- `src/utils/sanitize.js:25-28`, `src/utils/storage.js:3`, `src/utils/validators.js`.
- `local/package.json`, `local/vite.config.js`, `local/vitest.config.js:26`.
- `.github/workflows/test.yml:23-27` — `npm install` sem lockfile, sem job de deploy.
- `config/versions.json` — `lastUpdate 2026-05-31`, versões divergentes do `?v=`/`package.json`.
- `assets/js/vendor/chart.umd.js` (v4.4.1) e `aquecimento.html:37` / `arcondicionado.html:570`.
- Validações executadas: `npm test` (109 ✓), `npm run lint:check` (✓), `npm run build` (✓ ~1,2 s).
