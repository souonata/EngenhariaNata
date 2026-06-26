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

## 8. Modelo de branches

- `main` = o que está/vai pro ar (deploy automático).
- Trabalho em `feat/*` e `chore/*`; merge no `main` só quando pronto p/ publicar.
- A branch tem que estar **mergeada no `main` para a mudança existir no site**.

---

## 9. Estado atual / handoff  ⟵ ATUALIZE AO FIM DE CADA SESSÃO

_Última atualização: 2026-06-26_

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
