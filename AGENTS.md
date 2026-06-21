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

## 7. Easter egg "Assistente Volvo" (app secreto)

- O ícone é **apenas um link externo** para `https://volvo.engnata.eu` (`target="_blank"`).
  O assistente Volvo é **standalone** — **não** existe página dele dentro deste projeto, e **não** se deve criar uma.
- **Gesto:** 9 toques (`pointerdown`/Enter/Espaço) em até **6 s** no logo do dock
  (`#dockEasterEggTrigger`, "ENGENHARIA NATA"). Lógica em `index-script.js`
  (`registrarToqueEasterEgg` → `desbloquearEasterEggVisitantes` → `revelarAppSecreto`).
- Ao desbloquear: roda a animação do marquee de visitantes e revela o ícone (limpa o
  `display:none` inline, adiciona `.is-unlocked`). **Não persiste** entre reloads (proposital).
- Oculto via `style="display:none"` inline (necessário porque `.app-icon` é `display:flex`,
  que venceria `[hidden]`).

## 8. Modelo de branches

- `main` = o que está/vai pro ar (deploy automático).
- Trabalho em `feat/*` e `chore/*`; merge no `main` só quando pronto p/ publicar.
- A branch tem que estar **mergeada no `main` para a mudança existir no site**.

---

## 9. Estado atual / handoff  ⟵ ATUALIZE AO FIM DE CADA SESSÃO

_Última atualização: 2026-06-18_

- **`main` em dia e deployado.** A feature do app secreto Assistente Volvo (ícone + reveal, em
  `index.html` / `index-script.js` / `index-styles.css` / `src/i18n/index.json`) foi **mergeada
  no `main` (fast-forward) e publicada** — verificado no ar: o HTML em produção contém
  `appAssistenteVolvo`, o link `https://volvo.engnata.eu`, e o bundle novo (`main-BgEh7Kgu.js`)
  traz a lógica de reveal (`is-unlocked`, `easterState`). O site no ar agora mostra o ícone após
  o easter egg (9 toques rápidos em < 6 s no logo do dock).
- **Histórico do sintoma (resolvido):** o ícone "não aparecia no ar" porque o site é o build do
  `main`, e a feature vivia só na branch `feat/auditoria-padronizacao-apps` — o `main` era um build
  anterior, sem o `appAssistenteVolvo`. Resolvido pelo merge+deploy acima. Lição: feature em branch
  não existe no site até ser mergeada no `main`.
- **Branch `feat/auditoria-padronizacao-apps` == `main`** (após o FF merge); ambas sincronizadas no remoto.
- **Link do ícone:** confirmado `https://volvo.engnata.eu` (DNS resolve; `www.volvo...` é NXDOMAIN).
- **Sincronização entre PCs:** o sintoma "funciona num PC, noutro não" costuma ser **branch
  diferente** entre máquinas. Antes de começar: `git fetch && git status` e confirme em qual
  branch está. Ao trocar de máquina, faça `git pull` da branch correta e `cd local && npm ci`.

### Protocolo de handoff (multi-PC, Claude Code ⇄ Codex)
1. Ao **começar:** `git fetch`, confirme branch (seção acima), `cd local && npm ci` se o lockfile mudou.
2. Ao **terminar:** rode `npm run validate`, commite, faça `push`, e **atualize a seção 9** com o que mudou e o que ficou pendente.
3. Não confie só nos arquivos locais para "o que está no ar" — o site é o build do `main`.
