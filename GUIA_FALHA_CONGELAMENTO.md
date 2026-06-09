# GUIA: Site / apps "congelados" (tela viva, nada responde)

> **Para humanos e para IA.** Leia isto **antes** de mexer em qualquer módulo
> compartilhado (`src/core/*`, `src/utils/*`, `src/components/*`), em qualquer
> `<script type="module">`, nos JSON de `src/i18n/`, ou na CSP (`<meta>` /
> `.htaccess`). É a falha recorrente nº 1 deste projeto.

---

## 1. A assinatura da falha

Acontece **em todas as páginas ao mesmo tempo** (home + os 15 apps):

- A página **abre e desenha normalmente** (cards, cores, layout, botões) — *parece* ok.
- Mas **nada funciona**:
  - não dá para **trocar de idioma** (PT/IT);
  - na home **não aparece relógio nem data**;
  - **inputs não respondem** (digitar não faz nada);
  - **cálculos e gráficos nunca aparecem**;
  - botões/`...`/menus não abrem. "Tudo congelado."

Se você vê **esse conjunto exato**, **não é** um bug de um app específico:
é **um único erro fatal de JavaScript no carregamento**.

## 2. Por que um erro derruba o site inteiro

Este site é **100% ESM (ES Modules)**. Cada página tem:

```html
<script type="module" src="...-script.js"></script>
```

e todo script faz `import` da mesma cadeia compartilhada:

```
*-script.js
  └─ src/core/app.js
       ├─ src/core/i18n.js
       ├─ src/core/theme.js  ─ src/utils/storage.js
       └─ src/components/loading.js ─ src/utils/dom.js
```

Regra do navegador: **num módulo ES, se QUALQUER passo do carregamento falha
(import 404, MIME errado, erro de sintaxe, exceção no topo), o módulo inteiro é
descartado e NADA dele executa.** O `try/catch` dentro de `App.inicializar()`
**não salva** nesses casos, porque o erro acontece **antes** de a função chegar a
rodar.

Como a cadeia quebrada é **compartilhada por todas as páginas**, quebrar um
arquivo dela = **derrubar o site inteiro de uma vez**.

## 3. Diagnóstico em 10 segundos (faça SEMPRE primeiro)

1. Abra a página congelada.
2. Aperte **F12** → aba **Console**.
3. Vai haver **uma linha vermelha** apontando **o arquivo e a linha** que
   quebrou. **Esse é o culpado.** Tire um print dela.

> O Console **sempre** mostra a causa. Não adivinhe — leia o erro. A mensagem já
> diz se foi 404 de import, JSON inválido, CSP bloqueando, ou erro de sintaxe.

## 4. Causas, em ordem de probabilidade

### C1 — Abriu via `file://` (sem servidor) — **a mais comum**

Sintoma no Console:
`Access to script ... has been blocked by CORS policy` / `Failed to load module script`.

**Módulos ES e `fetch()` NÃO funcionam em `file://`.** Se você deu duplo-clique no
`index.html` (ou abriu de `C:\...\index.html`), **toda** página vai congelar
exatamente assim — e some que você fecha e reabre, parece "crônico".

**Correção:** sirva por **HTTP**, sempre **a partir da raiz do repo**
(`D:\EngenhariaNata`), porque os imports são relativos a ela:

```powershell
# opção A (Node, já tem no projeto):
npx serve .            # depois abra http://localhost:3000
# opção B (Python):
python -m http.server 8080   # depois abra http://localhost:8080
```

Verifique na barra: tem que ser `http://localhost...`, **nunca** `file:///`.
Em produção (engnata.eu / GitHub Pages) isso já é HTTP, então C1 só pega no local.

### C2 — Import quebrado / arquivo renomeado num módulo compartilhado

Sintoma no Console:
`Failed to resolve module specifier` ou `404 (Not Found)` apontando um `src/...js`.

Causa típica: alguém **renomeou/moveu/apagou** um arquivo (ex.: a pasta
`hp12c/`→`br12c/`, a remoção do `site-config.js`, a migração de helpers para
`src/utils/ui-controls.js`) **sem atualizar todos os `import`** que apontavam pra
ele. Um caminho errado em `app.js`/`i18n.js`/`theme.js`/`loading.js` derruba tudo.

**Correção:** conserte o caminho do `import`. E **antes de commitar**, rode o
`npm run build` (ver §5) — ele resolve os imports e **acusa** o que está quebrado.

### C3 — JSON de idioma faltando ou inválido

Sintoma no Console:
`Erro ao carregar traduções de <app>` + `404` ou `Unexpected token ... in JSON`.

Cada página faz `fetch('../src/i18n/<app>.json')`. Se o arquivo some ou tem
**vírgula a mais / aspas erradas**, `carregarTraducoes()` lança, a init aborta, e
**aquela** página congela (idioma, relógio, tudo). Costuma ser 1 página, não todas
— mas a sensação é idêntica.

**Correção:** confira que existe `src/i18n/<app>.json` e que é **JSON válido**
(cole em https://jsonlint.com ou rode o build).

### C4 — CSP bloqueando script ou conexão

Sintoma no Console:
`Refused to load/execute ... because it violates the Content-Security-Policy directive`.

A CSP vem do `<meta http-equiv="Content-Security-Policy">` (em ~18 HTML) e do
`.htaccess`. Endurecer demais (tirar uma origem de `script-src`/`connect-src` que
o app ainda usa, ou remover `'unsafe-inline'` sem pôr hashes/nonces) **bloqueia o
script** → página morta. Já é o **Risco #4** da auditoria mestra.

**Correção:** veja exatamente qual diretiva o Console reclamou e devolva a origem
necessária. Teste a página real, não só o build.

### C5 — Erro de sintaxe num módulo carregado

Sintoma no Console: `SyntaxError: ...` apontando arquivo e linha.

Um `}` a menos, `await` fora de `async`, etc. em **qualquer** módulo da cadeia
derruba a página.

**Correção:** o `npm run build` pega isso na hora. Conserte a linha apontada.

## 5. Prevenção — checklist antes de commitar/atualizar

A auditoria mestra registra: **`lint:check`/`format:check` rodam só com escopo
`local/` e NÃO cobrem os HTML/JS da raiz.** O sinal real é o **build**:

```powershell
cd D:\EngenhariaNata\local
npm ci        # 1ª vez
npm run build # <- ISTO acusa import quebrado, sintaxe, glob faltando
```

Checklist:

- [ ] **Servir por HTTP** (nunca testar abrindo `file://`).
- [ ] Rodei **`npm run build`** e passou (não confie só no `lint`/`format`).
- [ ] Renomeei/movi um arquivo? **Atualizei TODOS os `import`** que apontavam pra
      ele (`grep -rn "nome-antigo" --include=*.js .`).
- [ ] Editei um JSON de `src/i18n/`? **Validei o JSON.**
- [ ] Mexi na **CSP**? Abri **cada** página afetada e olhei o **Console** sem
      `Refused to ...`.
- [ ] Abri **a home + 1 app** com F12 aberto e **Console limpo** (zero vermelho).

## 6. Regras para IA (assistentes editando este repo)

1. **Nunca** renomeie/mova um módulo de `src/core|utils|components` sem rodar
   `grep -rn` pelos importadores e atualizar todos.
2. Depois de mexer em qualquer JS/HTML/CSP/JSON, **rode `npm run build`** e
   considere a tarefa incompleta se ele falhar.
3. Ao testar localmente, **sirva por HTTP a partir da raiz** — nunca `file://`.
4. Se o usuário relatar "tudo congelado / nada responde / sem relógio", **não saia
   trocando código**: peça/abra o **Console (F12)** primeiro. O erro vermelho
   nomeia o arquivo. Conserte **esse** arquivo, não os sintomas.
5. Mudança de CSP é alto risco (Risco #4): valide página por página no Console.

---

### Apêndice — o overlay global de erro (rede de segurança, JÁ ATIVO)

Antes, o projeto **não tinha nenhum tratador de erro global**, então a falha
**não dava aviso visível** — só congelava. Isso foi resolvido com
[`assets/js/error-overlay.js`](assets/js/error-overlay.js): um script **clássico
(não-module)** carregado no `<head>` de **todas as 16 páginas ESM**, que escuta
`error` (em fase de captura, pegando até falha de carregamento de `<script>`) e
`unhandledrejection`, e mostra uma **faixa vermelha no topo com arquivo+linha**.
Agora "tudo congelado, não sei por quê" vira **"o erro está em `src/core/x.js:42`"**.

> Ele **não substitui** o Console (F12) — alguns erros exóticos de resolução de
> módulo só aparecem lá. É uma rede de segurança que torna a falha *visível*; o
> Console continua sendo o diagnóstico definitivo (§3).

**⚠️ Regra de manutenção (build/deploy):** o Vite **só bundla** `type="module"`.
Scripts clássicos como o overlay ficam com a tag literal no HTML e **precisam ser
copiados manualmente** para o `dist` no `.github/workflows/deploy.yml` (passo
"Copiar scripts clássicos não-bundlados"). O overlay já está lá; **se adicionar
outro script clássico, inclua a cópia dele no mesmo passo** ou ele dará 404 em
produção (que serve o build do Vite, não o repo cru).
