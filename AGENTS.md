# AGENTS.md — Referência de agente e handoff (Engenharia NATA)

> Arquivo **canônico de contexto** para agentes de IA (Claude Code e Codex) trabalhando
> neste repositório, em **qualquer PC**. Codex lê `AGENTS.md` nativamente; o `CLAUDE.md`
> na raiz importa este arquivo para o Claude Code. Mantenha **um** arquivo (este) como
> fonte da verdade. Atualize a seção **Estado atual / handoff** ao terminar uma sessão.

---

## 1. O que é o projeto

Portfólio **estático** de apps web educativos (engenharia, energia, utilidades, finanças).

- **Stack:** HTML + CSS + JavaScript modular (ESM). Sem framework. `Chart.js` local em `assets/js/vendor/`.
- **Bilíngue:** `pt-BR` (padrão) e `it-IT`. Textos em `src/i18n/<app>.json`.
- **Build/dev:** Vite (config e toolchain ficam em `local/`).
- **Site no ar:** `https://engnata.eu/` (custom domain nativo do GitHub Pages; `www` e
  `https://souonata.github.io/EngenhariaNata/` redirecionam pra cá). Ver seção 4 (Deploy).
- **Domínios de app são subdomínios diretos**, ex.: o Assistente Volvo é `https://volvo.engnata.eu` (sem `www.`; `www.volvo...` **não resolve** no DNS).

## 2. Estrutura

```
EngenhariaNata/
├── index.html / index-script.js / index-styles.css   # landing + catálogo
├── assets/                 # CSS/JS compartilhado e vendor (Chart.js)
├── config/versions.json    # versão por app (buscado em runtime via fetch)
├── src/{core,components,utils,i18n}/   # base de app, i18n, tema
├── patentenautica/          # app ESM bilíngue IT/PT para patente náutica italiana
├── <app>/                  # cada app: <app>.html + <app>-script.js + <app>-styles.css
│   ├── <app>-calc.js       # núcleo numérico puro (apps migrados: salario, mutuo)
│   └── <app>-calc.test.js  # Vitest (apps migrados)
├── br12c/                  # app STANDALONE (HP-12C); excluído do bundle Vite
├── .github/workflows/      # deploy.yml (Pages) + test.yml (CI)
└── local/                  # toolchain: Vite, Vitest, ESLint, Prettier, Stylelint
```

Apps migrados (cálculo extraído + testes): **`salario`, `mutuo`**. Os demais ainda têm o
cálculo dentro da classe da app (migração em ondas — ver `ROADMAP.md`).

## 3. Comandos (sempre a partir de `local/`)

```bash
cd local
npm ci                 # instalar (use ci, não install, p/ reproduzir o lockfile)
npm run dev            # Vite na porta 5173
npm test               # suíte Vitest (1x)
npm run test:watch     # Vitest em watch
npm run validate       # lint + format + style + tests  ← rodar ANTES de commitar
npm run build          # build de produção (gera local/dist)
```

- ESLint/Prettier/Stylelint **só rodam de dentro de `local/`** (config lá).
- Checklist de release: `PRE_COMMIT.md`.

## 4. Deploy — COMO O SITE VAI PRO AR (crítico)

- Fonte do Pages = **GitHub Actions** (`.github/workflows/deploy.yml`).
- Dispara em **push no `main`** (ou `workflow_dispatch` manual).
- O workflow faz `npm run build` (Vite) e publica `local/dist`. **O site no ar é o BUILD, não os arquivos crus do repo.** O JS vai bundlado/hasheado (`assets/js/main-*.js`).
- ⇒ **Mudança em branch de feature NÃO aparece no site até ser mergeada no `main`.**
- Arquivos buscados em **runtime via `fetch()`** (i18n, `config/versions.json`) e scripts
  clássicos (não-module) **não entram no bundle automaticamente** — o `deploy.yml` os copia
  manualmente. **Se um app novo buscar um arquivo em runtime, adicione a cópia no `deploy.yml`**,
  senão a página dá 404 e **congela** (tela viva, JS morto). Ver `GUIA_FALHA_CONGELAMENTO.md`.
- **Domínio (custom domain nativo do GitHub Pages):** `engnata.eu` serve o site **direto**
  (URL limpa, sem redirect pro github.io). Na Cloudflare (que gere o DNS), o apex tem **4 A +
  4 AAAA** para os IPs do GitHub Pages (`185.199.108–111.153` / `2606:50c0:8000–8003::153`) e
  `www` é **CNAME → `souonata.github.io`**, **todos DNS only (cinza)** — proxied (laranja) trava
  a emissão do certificado do GitHub. `www` → 301 → apex (feito pelo próprio GitHub).
- **Base relativa + CNAME:** o build usa `base: './'` (`local/vite.config.js`) p/ os assets
  resolverem na raiz do domínio. O custom domain é fixado por **`public/CNAME`** (o Vite copia
  para `dist/`); **sem ele o deploy via Actions reseta o domínio** (e o token não tem escopo
  `workflow` p/ gravar o CNAME no `deploy.yml`). Se o domínio cair, cheque nesta ordem:
  (1) custom domain em Settings→Pages, (2) `public/CNAME`, (3) registros A/AAAA + `www` no DNS.

## 5. Convenções ao mexer num app

1. Atualize `index.html` (catálogo) se o conjunto de apps mudar.
2. Sincronize `src/i18n/index.json`, `src/i18n/sobre.json` e `sobre/sobre.html`.
3. Registre versão/mudança em `config/versions.json`.
4. Para apps migrados (`salario`, `mutuo`): mexeu no cálculo → atualize/adicione testes em `<app>-calc.test.js` **antes** do commit.
5. Texto sempre nos dois idiomas (`pt-BR` e `it-IT`).
6. Rode `npm run validate` antes de commitar.

## 6. Gotchas (já mordidos)

- **Service worker (`sw.js`) é um kill-switch:** apaga caches e se desregistra, não intercepta fetch. Não é cache de JS antigo — se algo "não atualiza", suspeite de **deploy/branch**, não do SW.
- **Site no ar ≠ repo cru:** é build Vite. Para validar o que o usuário realmente vê, cheque o bundle publicado, não só os arquivos locais.
- **DNS:** subdomínios de app (`volvo.engnata.eu`) não têm `www.`. `www.` é só para o apex (`www.engnata.eu`).
- **br12c** é standalone — copiado inteiro no deploy, fora do bundle.
- **br12c tem service worker PRÓPRIO e versionado** (`br12c/sw.js`, cache `br12c-guide-vN`) —
  **NÃO** é o kill-switch do site principal. Ele cacheia de verdade: HTML/JS/CSS = network-first
  (atualizam online), mas estáticos (pdf/fontes/imagens) = cache-first. Ao mexer em **qualquer
  asset do br12c**, **bumpe a versão** do `CACHE` (`-vN` → `-vN+1`): o `activate` apaga os caches
  antigos e força o re-precache. Sem isso, dá o clássico "mudei mas não atualizou" pros usuários
  que já visitaram (especialmente em estáticos cache-first).

## 7. Apps secretos (easter egg) e o app "Bonsai Lichia"

- **Gesto:** 9 toques (`pointerdown`/Enter/Espaço) em até **6 s** no logo do dock
  (`#dockEasterEggTrigger`, "ENGENHARIA NATA"). Lógica em `index-script.js`
  (`registrarToqueEasterEgg` → `desbloquearEasterEggVisitantes` → `revelarAppSecreto`).
- **Mecanismo (genérico):** todo `.app-icon` com **`data-app-secreto`** começa `display:none`
  inline + `aria-hidden`; ao desbloquear, `revelarAppSecreto()` revela **todos** (limpa o display,
  adiciona `.is-unlocked`) e `sortAppsForLocale()` os mantém sempre por ÚLTIMO no grid. **Não
  persiste** entre reloads (proposital). O `display:none` inline é necessário porque `.app-icon`
  é `display:flex` (venceria `[hidden]`). **Para adicionar um app secreto:** marque o
  `<a class="app-icon" data-app-secreto ...>` no `index.html` + nome i18n (`app-<x>`) em
  `src/i18n/index.json`. Mexeu no `index-script.js`? **bumpe o `?v=`** do `<script>` (cache-bust
  do dev; em produção o Vite re-hasheia o bundle).
- Secretos atuais: **Assistente Volvo** (link externo `https://volvo.engnata.eu`, standalone —
  NÃO criar página interna) e **Bonsai Lichia** (app interno, abaixo).

### 7.1 App "Bonsai Lichia" (`lichiabonsai/`)
- **Guia interativo + diário** de cultivo (germinação de uma lichia → bonsai, Turate/Lombardia). App
  **discreto**: fora do catálogo e do sitemap, `noindex`; só pelo easter egg ou link direto
  **`engnata.eu/lichiabonsai/`** (o HTML é `index.html`, p/ URL limpa, como o `br12c`).
- **Bilíngue** pt-BR/it-IT (abre em pt, respeita a sessão). Estende o `App` base; design editorial
  próprio (`lichiabonsai-styles.css`, paleta verde/vermelho-lichia, light/dark). Re-renderiza tudo
  ao trocar idioma; estado de UI (fases/técnicas abertas, mês do calendário) preservado na instância.
- **Dois tipos de dado** (ambos ESM bundlados pelo Vite, sem fetch em runtime):
  1. **DIÁRIO — você edita `lichiabonsai/lichiabonsai-data.js`**: linha do tempo, medições, checklist,
     metas, status, plano, `ESTACAO_CULTIVO` (infra) e **`FASE_REGISTROS`** (suas fotos/notas reais por
     fase do guia — o *loop de feedback*; chaves `f0`…`f5` batem com as fases). Tudo bilíngue `{pt,it}`.
  2. **GUIA (referência, raramente muda)** em módulos separados: `guia-fases.js` (`GUIA_INTRO` +
     `GUIA_FASES`, roteiro 0–25 anos), `guia-tecnicas.js` (`TECNICAS`, passo a passo ilustrado),
     `guia-calendario.js` (`CALENDARIO` 12 meses + `PRAGAS` + `MATERIAIS`), `guia-diagramas.js`
     (`DIAGRAMAS` = SVGs inline, theme-aware via `var(--…)`/`currentColor`; chave em `diagrama` liga
     fase/técnica ao desenho).
- **Fase atual** é detectada por `META.dataInicial` + data de hoje (anos decorridos → índice em
  `GUIA_FASES`); o **mês atual** destaca-se no calendário. (Substituiu o antigo bloco `ESTACOES` de
  4 cards — o calendário de 12 meses é mais rico.)
- **Fotos:** ponha o `.webp` em `lichiabonsai/fotos/` e referencie o nome do arquivo no data; o
  Vite as inclui no build via `import.meta.glob` (não precisa tocar no `deploy.yml`). Rótulos de UI
  em `src/i18n/lichiabonsai.json` (copiado pelo deploy.yml junto com os outros i18n).

### 7.2 App "Rotta 12 — Patente Náutica" (`patentenautica/`)

- App de estudo para a patente náutica italiana entro 12 miglia, a motore, publicado na rota limpa
  `/patentenautica/`. O italiano ministerial é a camada canônica; português é tradução auxiliar.
- Modos persistentes e instantâneos: **IT**, **PT** e **IT + PT**. Busca, banco de 1.472 questões,
  50 exercícios de carteggio, soluções, fontes e glossário funcionam nos dois idiomas.
- O banco disponibiliza todos os resultados filtrados por texto, matéria, assunto e progresso,
  renderizando 40 por vez com ações para mostrar mais ou todos. O perfil local em `localStorage`
  continua disponível offline e pode ser exportado/importado. Uma conta opcional sincroniza o
  mesmo progresso entre dispositivos pelo backend autohospedado.
- A Carta 5/D usa o PDF monocromático completo com borda graduada e exibe o JPEG original
  `carta nautica 5D originale.jpg` (7501 × 4844, 4,66 MB) sobre um plano lógico 4612 × 2978.
  O raster só é baixado quando o usuário abre **Carteggio**.
  `Carta 5D 340dpi migliorata.pdf` oferece o mesmo conteúdo em 15002 × 9688/340 DPI, sem
  transformação generativa. `data/chart-points.json` relaciona partida/chegada dos 50 exercícios
  e interpola os 28 pontos diretamente entre 24 referências medidas nas quatro bordas graduadas.
  A homografia verificada em 3.382 correspondências permanece como controle do alinhamento dos
  rasters. Cada alvo mostra a área semitransparente definida pelos limites de latitude/longitude
  (±0,3′) e guias tracejadas da régua mais próxima até o valor médio.
  O validador bloqueia rotas incompletas, pontos ou limites fora da imagem, guias que não alcancem
  a borda, dimensões divergentes e qualquer rótulo que intercepte a rota.
- `data/question-authority.json` mantém internamente a conferência das 1.472 questões contra a
  página da banca MIT e regras institucionais. `data/authoritative-sources.json` cataloga URL oficial
  e, para os atos públicos arquivados, tamanho e SHA-256. A interface apresenta essas referências
  uma única vez em **Fonti e criteri**, sem painel repetido em cada questão; materiais didáticos
  privados não fazem parte do app.
- Dados oficiais ficam em `data/quiz-base.js`, `data/content.js` e `data/carteggio.js`. Traduções
  paralelas ficam nos JSON `*-pt.json` e nunca contêm o campo `correct`.
- `scripts/build_translations.py` regenera saídas a partir do cache estático e aplica overrides
  náuticos; `scripts/validate_integrity.mjs` bloqueia mudança de id/code/figura/gabarito, números,
  negações e traduções terminológicas proibidas.
- O app importa JSON, PDFs e figuras como módulos/URLs Vite. A única dependência remota opcional é
  a API de conta `accounts.engnata.eu`; falhas nela não impedem o estudo local. O cliente usa o SDK
  PocketBase e o backend versionado fica em `patentenautica/backend/`. As 103 figuras são incluídas
  via `import.meta.glob` e os quatro PDFs saem hasheados em `local/dist/assets/pdf/`.

## 8. Modelo de branches

- `main` = o que está/vai pro ar (deploy automático).
- Trabalho em `feat/*` e `chore/*`; merge no `main` só quando pronto p/ publicar.
- A branch tem que estar **mergeada no `main` para a mudança existir no site**.

---

## 9. Estado atual / handoff  ⟵ ATUALIZE AO FIM DE CADA SESSÃO

_Última atualização: 2026-08-20_

- **PINTOR — RASTER/OCR NA BETA PROTEGIDA:** o app secreto `/pintor/` e a API dedicada
  `pintor-api.engnata.eu` agora aceitam tanto páginas vetoriais quanto páginas formadas somente por
  imagem. A rota raster usa RapidOCR/ONNX Runtime pinados, skeletonização e as mesmas regras
  elétricas/gates V2/V7; emendas não propagam cor, convenção automática exige duas leituras OCR
  fortes e trechos incertos permanecem pretos. Um PDF sintético realmente image-only (zero texto e
  zero desenho vetorial) completou OCR, pintura removível e preservação. Limites: uma página por
  job, 25 MB/50 páginas, análise 75 Mpx, overlay 60 Mpx, retenção 24 h. O frontend continua
  `noindex`, fora do sitemap e visível apenas no easter egg; autenticação beta, owner isolation,
  rate limits, worker isolado, container non-root/read-only sem egress e firewall do tunnel
  permanecem. A imagem Linux `0.2.1` limita cada chamada ONNX a 1600², mantém A0 em grayscale,
  restringe pools nativos e libera/trimma o runtime OCR antes da topologia. A reprodução real que
  falhava (`9362 × 6623`, A0 image-only, PDF de 44 páginas) chegou a `ready` no host protegido em
  279,3 s: convenção Volvo `high`, 80 labels, 3.107 runs/464 pintados, V2/V7 e preservação aprovados,
  PDF final reaberto com 44 páginas, acesso anônimo `401` e exclusão `204`. Durante OCR foram
  observados ~826 MB RSS/~1,45 GB VSZ, caindo depois para ~533 MB/~1,06 GB; o container continua
  limitado a 3 GB, 2 CPUs, um job e sem egress. Isso qualifica a reprodução de capacidade, não
  universaliza precisão para fabricantes/layouts ainda sem corpus. Detalhes em `pintor/HANDOFF.md`.
  **TÚNEL AUTO-RECUPERÁVEL (0.2.2):** em 20/08 o origin/API continuava saudável, mas as quatro
  conexões do `cloudflared` caíram e o hostname público respondeu `530/1033`; por isso o browser
  mostrava o inglês nativo `Failed to fetch` antes de validar o código. O conector `.10` foi
  reiniciado, voltou com quatro conexões HTTP/2 e CORS correto, e recebeu
  `pintor-tunnel-watchdog.timer`: health público a cada minuto, restart somente após três falhas
  consecutivas. O frontend 0.2.2 traduz falhas de transporte em PT/IT/SV. Script e units ficam em
  `pintor/deploy/`; o timer está enabled/active no host.

- **SITE TRILÍNGUE — SUECO (`sv-SE`) + DOCK GLOBAL (branch `feat/i18n-sueco`):** iniciativa em
  andamento; plano completo e fases na seção própria do `ROADMAP.md`. **Decisões travadas:** idioma
  acoplado ao país (`sv-SE` ⇒ Suécia); Salário/Mutuo terão o **modelo sueco completo**; `br12c` e
  `lichiabonsai` entram; **`patentenautica` fica FORA e não exibe a bandeira sueca** (o exame é
  italiano e o app usa `data-study-mode`, não seletor de idioma). **Vento do app meteo em m/s em
  TODOS os idiomas.**
  - **FEITO (Fases 0, 1 e 3):** núcleo i18n com 3 idiomas, moeda por mapa (BRL/EUR/SEK), cadeia de
    fallback `sv-SE → it-IT → pt-BR` e helpers `porIdioma()`/`formatarMoeda()` (substitutos dos ~90
    ternários de jurisdição, ainda a converter). **Dock global flutuante** (`src/components/dock-global.js`
    + `assets/css/dock-global.css`): bandeiras BR/IT/SV + sol/lua, **só ícones**, fixo no topo-direito,
    criado por `App.inicializar()` — vale para todos os apps que estendem o core. Exibe **apenas as
    bandeiras dos idiomas que o app tem**, então a sueca aparece sozinha conforme cada app é traduzido;
    `data-dock="off"` e `data-dock-idiomas` dão opt-out por página. **App meteo migrado** para a
    estrutura padrão (era 1518 linhas inline; agora HTML 73 linhas + `previsao-styles.css` +
    `previsao-script.js` ESM + `src/i18n/previsao.json`), com vento em m/s via `wind_speed_unit=ms`
    e sueco completo. **Catálogo (`index.json`) em sueco** e **validador de paridade**
    (`scripts/validate_i18n_parity.mjs`, no `npm run validate`).
  - **FEITO (Fase 2, parcial):** sueco + normas suecas + ternários convertidos em `bugs`, `helice`,
    `bombaagua`, `bitola` (SS 436 40 00), `ventilacao` (BBR), `chuva` (SMHI) e `iluminacao`
    (SS-EN 12464-1). Publicado e conferido no ar.
  - **FEITO (Fase 5, parcial + institucional):** `sobre` (243 chaves, normas suecas) e `br12c`
    (33 chaves, bandeira sueca no seletor próprio, `chrome-boot.js` de 3 vias, **SW bumpado para
    `br12c-guide-v6`**). Publicado e conferido no ar.
  - **FEITO (base da Fase 4):** `src/data/parametros-suecia.js` com os parâmetros fiscais e de
    bolån de 2026 **pesquisados na fonte, com URL e data em cada constante**. ⚠️ **Duas regras
    mudaram em 1/4/2026:** o `skärpt amorteringskrav` foi revogado e o `bolånetak` subiu de 85%
    para 90%. Não atualize esses números de memória.
  - **FEITO (Fase 2 completa):** `solar`, `arcondicionado` e `aquecimento`, com adaptação de modelo
    e não só de texto — latitude 55–69° e coletor plano no aquecimento; BTU/m² de 250–340 no
    arcondicionado; e no solar o **HSP por país** (5,0 BR / 4,0 IT / **2,8 SV**), que muda o
    resultado: o mesmo consumo sai de 5 painéis no Brasil para 8 na Suécia.
  - **FEITO (Fase 4 — núcleo numérico):** `calcularSE()` em `salario-calc.js` e `calcularBolan()`
    em `mutuo-calc.js`, com **26 testes**. As fórmulas do `grundavdrag` e do `jobbskatteavdrag`
    foram pesquisadas na fonte e conferidas contra valores oficiais independentes (ver
    `src/data/parametros-suecia.js`). ⚠️ Não atualize esses números de memória: **duas regras
    mudaram em 1/4/2026** (skärpt amorteringskrav revogado, bolånetak 85%→90%) e a **avtrappning do
    jobbskatteavdrag foi eliminada** em 2026.
  - **FEITO (Fase 4 na tela + solar):** `salario`, `mutuo` e `solar` ganharam **tela própria** no
    modo sueco, a pedido explícito do usuário — *"não quero simples tradução onde a forma de
    calcular muda"*. Padrão usado: classes `.se-only` (mostra só em sueco) e `.se-hide` (esconde
    em sueco), com `body.lang-se` aplicado pelo app.
    - `salario`: campo de kommunalskatt ajustável; linhas próprias; 13ª/FGTS/rescisão OCULTAS.
    - `mutuo`: visão **bolån** — sem SAC/Price/tabela de parcelas; amortização vem da
      belåningsgrad; aviso quando a entrada não atinge o bolånetak de 90%.
    - `solar`: visão **conectada à rede** — era o único app dando conselho ATIVAMENTE ERRADO
      (off-grid dimensionado pelo inverno sueco pedia banco de baterias irreal).
  - **AUDITORIA (2026-08-18) — quais apps mudam de MÉTODO:** grupo A (só parâmetros, tradução
    basta): `helice`, `bombaagua`, `bitola`, `iluminacao`, `previsao`, `bugs`. Grupo B (tela
    própria): `salario`, `mutuo`, `solar`. Grupo C (enquadramento errado): `ventilacao`,
    `aquecimento`, `chuva`, `arcondicionado`. **Grupos B e C, AMBOS FEITOS e no ar.**
  - **FEITO (Grupo C — 2026-08-18):** os quatro apps cuja PERGUNTA a Suécia não formula assim
    ganharam tela própria. Padrão idêntico ao grupo B (`.se-only`/`.se-hide` + `body.lang-se`),
    com prefixo de chave i18n por app (`vense`, `acse`, `aqse`, `chse`) presente nos TRÊS idiomas
    (o validador de paridade exige, mesmo que a seção só apareça em sueco).
    - `ventilacao`: a exigência é **vazão** — 0,35 l/s·m² e 4,0 l/s/pessoa. ⚠️ Não é mais o BBR:
      é o **BFS 2024:8, 3 kap. Luft, 5 §**. O BBR foi substituído e o período de transição
      terminou em **1/7/2026**; o piso de 0,35 sobreviveu como *föreskrift* vinculante. A tela
      calcula perda de calor por graus-dia SMHI e recuperação por sistema (självdrag/F/FVP/FTX).
      Cross-check que valida o modelo: 120 m² dá **0,50 oms/h**, a regra prática sueca.
    - `arcondicionado`: lá é **luftvärmepump comprada para aquecer**. Poupança = aquecimento ×
      cobertura × (1 − 1/SCOP). ROT-avdrag de 2026: 30% da mão de obra, e o schablon do
      Skatteverket põe a mão de obra em 30% do preço → **9% do total**, teto 50.000 kr/pessoa/ano.
    - `aquecimento`: solar térmica é **complemento**. O teto da fração solar (65%) é do
      CALENDÁRIO, não do equipamento — de 5 para 14 m² a fração não sobe, só cresce a
      estagnação. É esse o ponto que a tela ensina. Glicol em circuito fechado é obrigatório.
    - `chuva`: o limite é o **congelamento**, não a chuva. Temporada = `vegetationsperiod` do
      SMHI (média diária > +5 °C). Perde-se **48% no centro e 58% no norte**. A entrada de
      precipitação MENSAL some em sueco: o que decide é o anual × duração da temporada.
  - **FALTA (geral):** integrar o dock ao `patentenautica` (só BR/IT), que não passa pelo
    `src/core/app.js`.
  - **Gotcha de formatação:** o `format:check` roda de dentro de `local/`, então o glob NÃO alcança
    os apps da raiz — eles nunca passaram pelo Prettier e usam 4 espaços. Não rode
    `prettier --write` neles: reformata tudo para 2 espaços e infla o diff (aconteceu: 1.788
    inserções onde o real eram 451).
  - **Fora do sueco por decisão:** `fazenda` (base agronômica regional) e `lichiabonsai`
    (333 campos `{pt, it}` de conteúdo nos módulos de dados) — ver ROADMAP.
  - **Line endings resolvido:** `.gitattributes` agora tem `* text=auto eol=lf`. Os 275 arquivos já
    estavam em LF no index, então não houve mudança de conteúdo — só parou de quebrar o
    `format:check` depois de cada merge no Windows.
  - **Gotcha novo:** `querySelector('.a, .b')` devolve o primeiro nó em ordem de **documento**, não
    na ordem dos seletores — o dock é anexado ao fim do `body`, então consultas de host precisam ser
    separadas e em ordem de prioridade explícita (mordido em `theme.js`).

- **ROTTA 12 / PATENTE NÁUTICA (branch `feat/patente-nautica`):** app integrado em
  `patentenautica/`, registrado no catálogo, home/sobre bilíngues, README, ROADMAP, versões,
  sitemap e workflow. Tradução estática IT→PT-BR com modos IT/PT/IT+PT, busca bilíngue e glossário
  sempre acessível. Versão 3.2 removeu a antiga guia por capítulos e os vínculos quiz→teoria. O
  carteggio agora integra a Carta 5/D em alta resolução, com zoom/rolagem, partida, chegada,
  coordenadas e rota para os 50 exercícios, cobrindo 28 pontos georreferenciados. QA de integridade:
  1.472 questões, 50/50 exercícios localizados, Carta 4454 × 3045, 103 figuras e gabarito só na camada
  italiana. `npm run validate` passou com 284 testes e a validação náutica; `npm run build` e o
  smoke HTTP passaram com página, JS, CSS e Carta 5/D retornando 200. Repetir esses checks após
  alterações futuras na carta ou na navegação.
  Origem `C:\projetos\patenteNautica` removida após verificação de 116/116 arquivos e SHA-256 dos
  103 PNGs, quatro PDFs e dados canônicos. A publicação é feita pelo workflow do GitHub Pages
  após integração em `main`; arquivos locais de `.claude` e `lichiabonsai` permanecem fora do escopo.

- **REFERÊNCIAS OFICIAIS E CONTAS (base integrada):** o vínculo histórico à Dispensa foi substituído
  por resposta ministerial, explicação original, página exata da banca MIT e fontes públicas ou
  institucionais para as 1.472 questões, com gerador reproduzível e validação de cobertura. Inclui
  banco completo com filtros combináveis, quiz aleatório/selecionado, perfil local exportável e
  conta opcional para sincronizar progresso, inclusive simulado só de inéditas. O backend PocketBase
  0.39.8 está ativo na VM Proxmox 205 `engnata-backend` (192.168.1.13), publicado somente por
  Cloudflare Tunnel em `accounts.engnata.eu`; porta LAN restrita, painel público bloqueado, rate
  limiting e backups diário interno + VM configurados. O teste público confirmou criação/login por
  usuário ou e-mail, isolamento, sincronização, troca de e-mail/senha e exclusão em cascata. Versão
  3.5.0 foi integrado pelo PR #7 e publicado em 2026-07-21; `npm run validate` passou com 284
  testes, 1.472/1.472 referências e contrato de conta. SMTP permanece pendente apenas para
  verificação de e-mail e recuperação de senha.

- **CARTA 5/D E REFERÊNCIAS (versão 3.6.2):** as versões 3.5.1–3.6.0 publicadas pelo PR #8
  entregaram zoom/pan/pinch, respostas estruturadas, fontes oficiais, alvos precisos e cobertura
  de 1.472/1.472 páginas MIT. A 3.6.1 impede que o tracejado cubra os centros e troca o raster
  colorido pela Carta 5/D monocromática completa com bordo graduado, mantendo os 28 pontos
  recalibrados. A 3.6.2 eleva o raster web à resolução nativa 7501 × 4844 e acrescenta um PDF
  340 DPI/15002 × 9688, criado por ampliação Lanczos e nitidez controlada. Original e derivado
  mantêm a mesma página e geometria; similaridade medida em 0,9995 e erro mediano de projeção
  de 0,88 px. `npm run validate` passou com 35 arquivos/288 testes, a integridade confirmou os
  50 exercícios e `npm run build` incluiu corretamente o JPEG e o PDF hasheados.
  A versão 3.6.3 reduz a rota e os aros sobrepostos e aplica 50% de opacidade à rota, aos
  marcadores e aos rótulos, preservando a leitura dos topônimos e símbolos impressos na carta.
  A versão 3.7.0 torna o login exclusivamente por e-mail, aceita qualquer senha não vazia e
  acrescenta a página `Il mio account`: progresso dos 1.472 quesitos, histórico das provas,
  acompanhamento dos 50 exercícios/soluções de carteggio e reset individual, por seção ou total.
  A migração `1721600300_email_and_activity_progress.js` cria `study_exercises` e
  `quiz_attempts`; ela foi aplicada numa cópia isolada do banco e o smoke da API confirmou senha
  de um caractere, rejeição de login por username, gravação dos três tipos e exclusão total.
  `npm run validate` passou com 288 testes e `npm run build` concluiu. O backend público foi
  migrado após backup frio e validado externamente; frontend e backend 3.7.0 foram integrados
  pelo PR #10 (`6834135`) e publicados com sucesso em 2026-07-25.
  A versão 3.7.1 remove da banca e dos resultados o antigo botão/modal de referência por questão,
  mantendo as fontes oficiais concentradas na seção geral. Na Carta 5/D, cada alvo passa a ser
  verificado como interseção das guias de latitude/longitude vindas da borda mais próxima; essas
  guias são apenas geométricas e não aparecem. Os rótulos grandes com nomes foram substituídos por
  **Partenza/Arrivo**, e o topônimo já impresso na carta recebe realce amarelo translúcido. O
  validador cobre os 28 realces, os 50 pares de rótulos e a passagem das guias pelo centro.

- **UX MOBILE/TABLET (versão 3.8.0, branch `feat/rotta12-mobile-ux`):** navegação inferior
  persistente nas cinco áreas principais e no glossário para larguras até 820 px, cabeçalho móvel
  reorganizado, alvos de toque de pelo menos 44 px e respeito à safe area. A banca passa a
  renderizar 40 questões por vez, com “mostrar mais” e “mostrar todas”, preservando filtros,
  seleção e os 1.472 resultados acessíveis; isso reduz a rolagem inicial do quiz móvel de cerca de
  235 mil para 9 mil px. Durante prova/treino, banca, glossário e navegação inferior ficam ocultos
  para evitar sobreposição e distração. Interface validada em 390 × 844 e 820 × 1180, nos modos
  IT/PT, tema claro/escuro e sem overflow horizontal. `npm run validate` passou com 288 testes,
  a integridade náutica confirmou as 1.472 questões e `npm run build` concluiu.

- **CARTA ORIGINAL MAIS LEVE (versão 3.8.1, branch `feat/rotta12-mobile-ux`):** o visualizador
  passa a usar o JPEG original extraído sem recompressão de
  `Carta 5D_5_Immagine unica Adobe alleggerita.pdf`. Mantém 7501 × 4844 e geometria idêntica,
  mas reduz o download da carta de 6,86 para 4,66 MB (-32,1%). A carta agora só é solicitada ao
  abrir **Carteggio**; o PDF opcional de 340 DPI permanece disponível. `npm run validate` passou
  com 288 testes, a integridade confirmou os 28 pontos/50 rotas e `npm run build` incluiu o JPEG
  original hasheado. O build foi verificado em 390 × 844: sem download na home, carga ao abrir a
  carta, zoom 24% → 32% e sobreposições alinhadas.

- **LEITURA REAL PELA BORDA (versão 3.9.0, branch `feat/rotta12-chart-reading-guides`):** cada
  Partenza/Arrivo passa a mostrar um quadrilátero semitransparente calculado pelos quatro limites
  aceitos de latitude e longitude (centro ±0,3′). Duas guias tracejadas saem das escalas graduadas
  mais próximas e terminam exatamente no valor médio; pequenos pontos marcam a origem na régua.
  A legenda e os cartões exibem a área aceita e os intervalos completos. `npm run validate` passou
  com 36 arquivos/292 testes e a integridade confirmou 28 áreas, 50/50 rotas e todas as guias; o
  build de produção concluiu. A interface foi verificada em 390 × 844 e 820 × 1180, inclusive com
  uma segunda rota em outra região da carta, sem overflow horizontal.

- **ALVOS LIMPOS (versão 3.9.1, branch `codex/rotta12-clean-tolerance`):** remove o aro amarelo,
  o contorno escuro da área de tolerância, o ponto colorido central e os pontos nas origens das
  guias. Permanecem apenas o preenchimento semitransparente, a cruz magenta de 1 px no centro e
  as linhas tracejadas vindas das bordas graduadas. `npm run validate` passou com 36 arquivos/292
  testes, a integridade confirmou os 28 pontos e 50/50 rotas, e o build concluiu. Verificação visual
  em 390 × 844 e 820 × 1180 confirmou a carta legível, a legenda sem contorno e ausência de overflow.

- **ESCALA REAL DAS BORDAS (versão 3.9.2, branch
  `codex/rotta12-border-scale-calibration`):** substitui a projeção ativa baseada na transformação
  histórica pela interpolação por trechos entre 24 referências medidas nas escalas superior,
  inferior, esquerda e direita. Assim, por exemplo, 11° 9,2′ E fica exatamente 20% depois da marca
  de 9′. A homografia permanece apenas como registro e controle de alinhamento dos rasters.
  `npm run validate` passou com 36 arquivos/295 testes, 28 pontos, 50/50 rotas e erro máximo
  desprezível nas 24 marcas; build e checkup passaram. A inspeção visual a 97% confirmou 11° 9,2′
  entre 9′ e 10′, e os layouts 390 × 844 e 820 × 1180 permaneceram sem overflow horizontal.

- **ATUALIZAÇÃO DO DIÁRIO (12/07):** novo post bilíngue registrando o primeiro fluxo com duas
  folhas novas; muda medida em 8 cm e quatro folhas totais. Três fotos da nova leva foram
  selecionadas, tratadas e convertidas para WebP (régua, vista geral e detalhe das folhas
  acobreadas). Cache-bust do script atualizado para 1.1.4. Suíte: 284 testes OK. Publicação:
  commit/push no main; pendente apenas confirmar o deploy automático no ar.
- **PUBLICADO:** rebuild do Bonsai Lichia mergeado no `main` e pushado em 2026-06-26 (branch
  `feat/lichiabonsai-guia-interativo`; build + 223 testes OK, verificado no preview Vite
  light/dark/mobile/pt/it). Deploy automático via Actions → confirmar no ar em `engnata.eu/lichiabonsai/`.
- **Bonsai Lichia virou GUIA INTERATIVO** (era só diário). Pedido: "guia interativo, temporal, com
  exemplos/imagens/esquemas, e atualizável com fotos reais da evolução". Novas seções data-driven:
  **Guia em fases** (roteiro 0–25 anos, fase atual auto-detectada e aberta, cada fase com objetivo /
  o-que-fazer / resultado / erro comum / **diagrama SVG** / bloco "Seu registro" p/ fotos reais —
  `FASE_REGISTROS`), **Calendário anual** (12 meses, mês atual destacado, clicável), **Técnicas
  ilustradas** (12 cards expansíveis com esquema), **Pragas e cuidados**, **Materiais por etapa**.
  Conteúdo destila/supera a conversa do ChatGPT (roteiro de 25 anos da lichia). Ver seção 7.1 p/ a
  arquitetura (módulos `guia-*.js`). `?v=` de CSS/JS bumpado p/ `1.1.0`. Removido o bloco `ESTACOES`
  (4 cards) — substituído pelo calendário.
- **`main` (antes desta branch):** em dia, deployado e verificado no ar. Branch `feat/auditoria-padronizacao-apps` == `main`, sincronizadas no remoto.
- **Domínio migrado para custom domain NATIVO** do GitHub Pages: `engnata.eu` serve **direto** (URL
  limpa, HTTPS forçado), fixado por `public/CNAME`; `www` → 301 → apex; DNS na Cloudflare (apex com
  A/AAAA → IPs do Pages, **DNS only**). Build com `base: './'` (relativo). Detalhes na seção 4.
  (Antes era forwarding GoDaddy/Redirect Rule; histórico na memória de roteamento.)
- **SEO unificado:** `canonical`/`og`/`twitter`/JSON-LD/`sitemap.xml`/`robots.txt` → `https://engnata.eu/...`.
- **App "Bonsai Lichia"** (`lichiabonsai/`, HTML = `index.html`) construído e no ar em
  `engnata.eu/lichiabonsai/`: diário editorial bilíngue, **data-driven**, discreto (noindex, fora do
  catálogo) e **2º app secreto** do easter egg (com o Volvo, via `data-app-secreto`). Ver seção 7/7.1.
  - **Seções (ordem na página):** hero, status, plano (próx. etapa), **guia em fases**, **calendário
    anual**, **técnicas ilustradas**, linha do tempo, medições (sparkline), metas, checklist, estação
    de cultivo (infra), **pragas e cuidados**, **materiais por etapa**. Diário em `lichiabonsai-data.js`
    (`TIMELINE`/`MEDICOES`/`FASE_REGISTROS`/`ESTACAO_CULTIVO`…); guia nos módulos `guia-*.js` (ver 7.1).
  - **Estado do diário (25/06):** transplante p/ PET 2 L registrado; fase → Enraizamento; próximo passo
    → 1º inverno (aceita **luz de cultivo**, pois a casa nova em Turate não tem face sul); medições 5→7 cm.
    Plano de infra ("Estação de cultivo") **definido mas a executar** — ver memória `bonsai-estacao-cultivo`.
    Atualizar = editar `lichiabonsai/lichiabonsai-data.js` (ver memória `bonsai-lichia-fotos`).
- **br12c:** máscaras das teclas no retrato realinhadas (`transform: scaleY` por tema no `@media`
  retrato); cache do SW bumpado p/ `br12c-guide-v3`.
- **Referência untracked (de propósito):** `lichia-bonsai-site-v2/` (+ `.zip`) e os originais das fotos
  do bonsai — são a FONTE das fotos tratadas em `lichiabonsai/fotos/`. Não commitar.
- **Gotcha do dev (cache de `?v=`):** ao mexer em script/CSS de um app (`index-script.js`,
  `lichiabonsai-script.js`, `*-styles.css`…), **bumpe o `?v=`** no HTML correspondente — o navegador
  segura módulos `?v=` antigos (em produção o Vite re-hasheia, então é só p/ o dev). No lichiabonsai,
  mudança **só de dados** (`lichiabonsai-data.js`) também pede bump do `?v` do **script** (cascateia o
  data module fresco no Vite dev). Apps com fotos (`import.meta.glob`) exigem preview via **Vite**
  (porta 5173); e `/lichiabonsai/` com query cai na raiz no Vite dev — navegue p/ `/lichiabonsai/index.html`.
- **Sincronização entre PCs:** o sintoma "funciona num PC, noutro não" costuma ser **branch
  diferente** entre máquinas. Antes de começar: `git fetch && git status` e confirme em qual
  branch está. Ao trocar de máquina, faça `git pull` da branch correta e `cd local && npm ci`.

### Protocolo de handoff (multi-PC, Claude Code ⇄ Codex)
1. Ao **começar:** `git fetch`, confirme branch (seção acima), `cd local && npm ci` se o lockfile mudou.
2. Ao **terminar:** rode `npm run validate`, commite, faça `push`, e **atualize a seção 9** com o que mudou e o que ficou pendente.
3. Não confie só nos arquivos locais para "o que está no ar" — o site é o build do `main`.
