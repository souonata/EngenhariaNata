# HANDOFF — Calha 10844 (app de calhas da NBR 10844)

_Atualizado: 2026-09-14 (versão 3.9.1, local). Leia isto antes de mexer em qualquer arquivo desta pasta._

## O que é
App didático do portfólio Engenharia NATA para dimensionar calhas, condutores verticais e
coletores de águas pluviais pela **ABNT NBR 10844:1989**, na ordem da norma (5.1 → 5.7), com
cada conta à vista. URL: `https://engnata.eu/calha/` (depois do merge no `main`).
Também existe como artifact privado do usuário:
https://claude.ai/code/artifact/bd499e1b-7ee0-467e-8440-5fd11539542b

**Esta pasta (`calha/`) é a fonte única.** `../calha2/` é a bancada local NÃO versionada:
guarda os PDFs das normas (NBR 10844 sem marca d'água, BS EN 12056-3, HR Wallingford SR620 —
**não commitar**, direitos autorais) e as versões antigas (`v1/`, `v2/`, `v3/`).

## Regra de ouro (pedido do usuário)
- **O site é só a norma.** Toda regra de cálculo e todo texto explicativo aponta
  item/tabela/figura da NBR 10844. Nada de "explicações do professor" nem de complementos de
  fora da norma, nem rotulados (removidos: risco R, "C = 1", boa prática do coletor,
  extrapolação do ábaco).
- Vídeos e materiais externos são só referência.
- Exemplo padrão: **Curitiba/PR**. Interface só em pt-BR (a norma é brasileira).
- Em aberto com o usuário: dados de chapa (corte, espessura, kg/m) e lista de materiais não
  vêm da norma — perguntei se saem; ele respondeu "tá bem legal já" e seguiu, então ficaram.

## Arquivos (scripts clássicos UMD, nesta ordem no avancado.html)
| Arquivo | Papel |
|---|---|
| `nbr10844-dados.js` | Tabelas 1–5, materiais 4.1.1/4.1.2/4.1.3, chapas, tubos |
| `nbr10844-abacos.js` | Figura 3 digitalizada (ábacos a e b) |
| `nbr10844-calc.js` | núcleo puro da norma → `window.NBR10844` |
| `calha-util.js` | números pt-BR, escape, materiais, pedaços de HTML → `CalhaUtil` |
| `calha-estado.js` | estado versão 3, exemplos, migração 1/2 → 3 → `CalhaEstado` |
| `calha-projeto.js` | projeto (chuva, calhas, trechos), pendências, resposta, lista de materiais |
| `calha-desenhos.js` | SVG: Figura 2, seção, ábaco, esquema da fachada |
| `calha-memorial.js` | memorial por calha e em texto |
| `calha-relatorio.js` | relatório do projeto (HTML) para imprimir/salvar em PDF |
| `calha-assinatura.js` | página de assinatura acrescentada ao PDF salvo (pdf-lib sob demanda) → `CalhaAssinatura` |
| `calha-app.js` | interface: estado vivo, formulário, visibilidade, render, eventos |
| `calha-simples.js` | modo simples, parte pura: entradas → estado do avançado → resultado → `CalhaSimples` |
| `calha-simples-app.js` | modo simples, a tela (chave própria `calha10844:simples:v1`) |
| `index.html` | modo simples (entrada do app): dados, abacos, calc, util, estado, projeto, simples, simples-app |
| `avancado.html` | modo avançado, a ferramenta completa (antigo `index.html`) |
| `calha.css` | as duas páginas; tema claro/escuro (contraste WCAG AA) e layout móvel; bloco 3.8 = modo simples |
| `tests/*.test.js` | Vitest (63): núcleo, projeto, relatório, modo simples — `cd local && npm test` |

Em Node os módulos carregam com `require` (os testes usam `createRequire`).

## Integração ao portfólio (branch `feat/calha-nbr10844`)
- Fora do bundle: `'calha'` no `IGNORAR` do `local/vite.config.js`. O plugin
  `copiarStandalone('calha')` do mesmo arquivo copia `*.html/*.css/*.js` (sem testes nem este
  HANDOFF) para `dist/calha/` no fim do build. **Não precisa mexer no `deploy.yml`.**
- Vitest: `calha/tests/**/*.test.js` no `include`; `**/calha2/**` no `exclude`.
- Catálogo: ícone e card em `index.html`; chaves `app-calha`, `app-calha-title`,
  `app-calha-description` nos três idiomas de `src/i18n/index.json` (em it/sv o texto avisa
  que a interface é em português). `sobre`: `apps.calha` em `sobre.json` + item na lista de
  `sobre.html`. `config/versions.json` (`calha`), `sitemap.xml` (`/calha/`).
- Tema: sem escolha própria, segue `engnata_theme_mode` do portfólio; escolher claro/escuro no
  app grava nessa chave também. O link "← Engenharia Nata" só aparece em caminhos `/calha/`.
- Teste local no caminho real: `calha2/.claude/launch.json` tem o servidor `engnata-raiz`
  (porta 8745, serve a raiz) → `http://localhost:8745/calha/index.html`.

## Como publicar o artifact
Página gerada do `calha/avancado.html` (o artifact é a ferramenta completa) sem
`<html>/<head>/<body>`, sem as metas charset/viewport e sem os links `icon`/`canonical` (no
artifact eles quebram):
```python
import re
h=open("calha/avancado.html",encoding="utf-8").read()
head=re.search(r"<head>(.*?)</head>",h,re.S).group(1); body=re.search(r"<body>(.*?)</body>",h,re.S).group(1)
for p in [r'\s*<meta charset="utf-8" />',r'\s*<meta name="viewport"[^>]*/>',r'\s*<link rel="icon"[^>]*/>',r'\s*<link rel="canonical"[^>]*/>']:
    head=re.sub(p,"",head)
open("<scratchpad>/calha10844.html","w",encoding="utf-8").write(head.strip()+"\n"+body.strip()+"\n")
```
O Artifact só publica arquivos sob o diretório de trabalho ou o scratchpad: se a sessão não
estiver na raiz do repositório, copie `calha/*.css` e `calha/*.js` para o scratchpad e publique
com `root` apontando para lá. Leia o artifact antes (action `read`) em chat novo.

## Estado atual: versão 3.7.0
- 2.0: várias calhas em abas, coletores por trechos, esquema, quadro-resumo, memorial por
  calha, termos do item 3, três exemplos (residência Curitiba, galpão SP, sobrado POA).
- 3.0: Tabela 1 só em beiral/platibanda (5.5.6); material do condutor vertical (4.1.2); tubos
  editáveis (Dᵢ = DE − 2e); coletor aparente/enterrado (5.7.3/5.7.4); próximo passo guiado;
  resposta em uma frase; lista de materiais; guia de uso; módulos.
- Só a norma: H < 50 mm ou L < 0,3 m no ábaco = sem leitura (5.6.4.1 só interpola);
  H > 100 mm lê a curva de 100 (a favor da segurança); IDF conferida contra a faixa da
  Tabela 5 (96 a 347 mm/h).
- 3.5: **relatório em PDF** (botões "PDF do projeto" no topo e no memorial, e "Gerar PDF do
  projeto" no fim): capa com a chuva, quadro-resumo, uma seção por calha com memorial,
  esquema, seção desenhada e leitura do ábaco, coletores, lista de materiais e
  campos de assinatura; pré-visualização em tela cheia e `window.print()` com o título da
  página virando o nome do PDF. **Celular/tablet:** até 820 px a barra de resultados e o
  próximo passo ficam presos embaixo; toques ≥ 44 px; campos com fonte ≥ 16 px (sem zoom no
  iOS); área segura; abas e tabelas rolam no próprio quadro. Conferido em 390 × 844 e
  820 × 1180 sem rolagem lateral.

- 3.5.1 (2026-09-12, a pedido do usuário): volta a seção "O que a conta não verifica"
  (15 itens dos itens 4 e 5 para marcar, marcas em `localStorage` `calha10844:verificacoes`)
  e o bloco correspondente no relatório, com ☑/☐ e contagem de conferidos. No esquema, nenhum
  texto cruza traço: rótulo do coletor abaixo da linha do coletor e rótulo de condutor só no
  lado sem outro condutor a menos de 110 px. Relatório sem rolagem lateral: as tabelas cabem
  na largura da folha e o texto das células quebra em mais linhas. Tema e idioma no padrão do
  Engenharia Nata: barra no topo e centro (`.engnata-dock`, CSS copiado de
  `assets/css/dock-global.css` porque o calha é standalone), bandeiras BR/IT/SV + sol/lua.
  Só o português funciona; IT e SV ficam desabilitadas de propósito — serão outro app, com a
  EN 12056-3 (4.0), não uma tradução. Não trabalhar nelas até a versão BR estar redonda.

- 3.5.2 (2026-09-12, a pedido do usuário): cabeçalho mais direto, com o título reduzido a
  "Calha" e sem a frase promocional; removida também a observação final do quadro "Como usar,
  em quatro passos". `npm run validate`: 43 arquivos e 390 testes aprovados; o Vite gerou o
  build, e o `postbuild` parou apenas nos dois artefatos privados conhecidos do Pintor.

- 3.5.3 (2026-09-12, a pedido do usuário): a Figura 2(e) passou a usar um recorte direto da
  própria NBR 10844 (`figura-2e-nbr10844-sem-formula.png`), em vez de uma reconstrução
  vetorial. Foram removidas mecanicamente apenas as duas fórmulas impressas, preservando todos
  os traços, hachuras, cotas e projeções do desenho original. A fórmula escrita pelo app permanece
  `A = |a·b − c·d| / 2`, sem área negativa. O fundo transparente permite usar o recorte nos temas
  claro e escuro sem um retângulo destoante. O plugin `copiarStandalone('calha')` também passou
  a copiar PNGs para que a imagem chegue ao build publicado.
  `npm run validate`: 43 arquivos e 390 testes aprovados. O build gerou `dist/calha/` e o
  `postbuild` parou somente nos mesmos dois artefatos privados conhecidos do Pintor.

## Ábacos (Figura 3)
Retas H: Q = a + b·D. Curva L = ∞ bate com Q = (π/4)·D²·√(2gD/f), f = 0,04 (bom teste).
L = 0,3 e 0,6 m foram ajustadas ancorando na curva L = 1 m. Scripts de digitalização perdidos.

## Depois: versão 4.0
Italiano e sueco com a norma europeia (EN 12056-3; PDFs em `../calha2/`). Até lá, ignorar a
norma europeia. Os módulos puros ajudam: trocar o núcleo `nbr10844-*.js` por um núcleo EN.

## Cuidados
- Editar JS por script pode quebrar sintaxe: `node --check` em cada arquivo e `npm test`.
- `scroll-behavior: smooth`: em testes com screenshot, `scrollIntoView({behavior:'instant'})`;
  com viewport emulado a captura às vezes sai em branco — confira por medição.
- Grid com filho largo (SVG com `min-width`, select de opções longas) precisa de
  `minmax(0, 1fr)`/`min-width: 0`, senão a página rola para o lado (mordido 3×).
- Cache do navegador segura os scripts clássicos: ao conferir, force `fetch(src, {cache:'reload'})`.
- `npm run build` local pode falhar no `postbuild` por artefatos privados do Pintor em
  `pintor/output/` (só existem neste PC, ignorados no git); não é do calha.

- 3.5.4 (2026-09-12, a pedido do usuário): a Figura 2(e) voltou a ser vetorial, no mesmo
  estilo das demais, e foi corrigida: duas paredes opostas e paralelas com a mesma parte comum
  (branca); a da esquerda excede em cima (hachura a × b) e a da direita excede para o lado
  (hachura c × d), coerente com `A = |a·b − c·d| / 2`. O recorte PNG da norma da 3.5.3 saiu do
  repositório (era trecho da NBR, protegida por direitos) junto com o CSS `.fig-norma`.

- 3.5.5 (2026-09-12, a pedido do usuário): "Posição da calha" virou oito situações
  (`POSICOES` em `calha-app.js`, rádio `posicao`): beiral, platibanda, água-furtada e cinco
  casos com as superfícies (d) a (h) — entre paredes com uma mais alta, entre paredes
  desiguais, canto de paredes, pátio em U e quatro paredes. Cada uma define o `tipoCalha` usado
  no cálculo (as cinco novas contam como platibanda, Tabela 1) e as superfícies da Figura 2;
  escolher a posição já troca a lista, aproveitando valores digitados das que continuam, com
  "Desfazer" no aviso. Estados antigos e exemplos só têm `tipoCalha`: a posição sai dele.
  Campos pendentes à vista (`marcarPendencias` em `calha-app.js`, chamada em `atualizar`):
  os alvos das pendências da calha ativa e do projeto e toda medida de superfície vazia ficam
  em âmbar com "· preencher" no rótulo; número digitado que não se lê fica em vermelho com
  "· valor inválido"; grupo de opções ganha contorno e o botão de dimensionar, destaque.

- 3.5.6 (2026-09-13, a pedido do usuário): "Como usar, em quatro passos" com os nomes da
  norma e letras: A) Intensidade pluviométrica (5.1); B) Calhas, com B.1) Áreas de
  contribuição (5.2), B.2) Vazão de projeto (5.3) e B.3) Calha (5.5); C) Condutores verticais
  (5.6); D) Coletores horizontais (5.7). Rótulos no HTML (`.passo`), sem contador CSS.
  Pedido recusado com o usuário de acordo: DN 50 na lista padrão de tubos do condutor
  vertical — o 5.6.3 exige diâmetro interno mínimo de 70 mm, então nunca seria adotado.
  Lista de materiais do projeto inteiro (`listaMateriais` em `calha-projeto.js`): três
  grupos — Calhas, Condutores verticais, Coletores horizontais — com a mesma peça de calhas
  ou trechos diferentes somada numa linha; com mais de uma origem, a base mostra cada
  parcela ("Água leste 30 + Água oeste 30"); medida faltando vira "+ ?" e "sem medida: …".
  Vale para a tela, o texto copiado e o relatório em PDF.
  Barra da calha em edição (`#barra-calha`, `montarBarraCalha`/`posicionarBarraCalha` em
  `calha-app.js`): aparece presa no topo enquanto se rolam os itens 5.2 a 5.6 — logo abaixo do
  resumo no computador, no topo no celular (o resumo vai para baixo) — com seletor da calha
  ("1 de 3: nome") e Nova / Duplicar / Remover (reaproveitam os botões do painel; Nova pela
  barra leva ao 5.2). Enquanto visível, o `scroll-padding-top` inclui a altura dela.

## Auditoria técnica de 2026-09-13 (site 3.5.5) — pendências
Parecer completo: https://claude.ai/code/artifact/76fd5513-21c6-44d3-9860-c1a39d5eeeca
(banco de testes em Node usado na auditoria: refazer a partir dos casos TC1–TC10 do parecer).
A aritmética do núcleo bateu com referência independente em todos os casos; o que falha:
- C1 coletor horizontal escolhido pelo D teórico da Tabela 4, não pelo Di do tubo comercial
  (Q 280 L/min a 1%: "Di 100" leva 287; o DN 100 com Di 97 leva 265).
- C2 chuva de período menor que o pedido (Congonhas T=25) sai "atende" no quadro e no PDF.
- C3 São Carlos: T=25 dá 161 mm/h < 178 de T=5; adotar intensidade monotônica em T.
- C4 H digitado sem limite (pode passar da altura da calha e reduzir o DN).
- C5 negativos e superfícies incompletas zerados em silêncio, com "tudo atende".
- A1 altura mínima da calha ignora H >= 50 mm do ábaco (TC6 propõe 300 x 40).
- A2 lâmina padrão 2/3 contra a base da Tabela 3 (semicircular 100 reprovada numa garagem).
- A3 coletor menor que o condutor vertical; A4 rede de coletores montada à mão;
  A5 "D 220" fora do ábaco mostrado como leitura; A6 5.1.4 com projeção digitada; A7 I sem faixa.

## 3.6.0 — Onda 1 do plano de 13/09/2026 (nenhum falso "atende")
Plano: `calha/referencias/plano-implementacao-auditoria.md` (decisões D1: período do dado menor e
coerente = ressalva, sem dado ou inconsistente = sem suporte; D5: lâmina padrão continua 2/3).
- Uma avaliação só (`calcularProjeto` põe `estado`/`status` em calha, trecho e projeto, mais
  `P.diagnosticos`): quadro, coach, resumo, resposta, memorial, lista de materiais e PDF leem a
  mesma situação. Precedência: inválida > incompleta > sem suporte > fora do domínio > não atende >
  ressalva > atende (`N.ESTADOS`, `N.piorEstado`, `N.situacao`). Rótulos em `ROTULO_STATUS`.
- Chuva: Congonhas e os outros 7 postos sem T=25 → "sem dado válido"; São Carlos T=25 (161 < 178)
  → sem suporte; coluna com período entre parênteses e coerente (Cruz Alta, Porto Alegre, Rio
  Branco T5…) → "atende com ressalva". O memorial e o PDF escrevem período pedido e período do
  dado. Dado local/IDF sem fonte (`#fonteChuva`) → ressalva; fora de 96–347 mm/h só é anotado.
  5.1.4 exige a projeção e confere a soma das coberturas (a) e (b).
- Superfície com medida vazia, zero (exceto h) ou negativa não soma área (`areaSuperficie` sem
  clamp); o trecho que recebe uma calha incompleta fica incompleto.
- H digitado acima da altura da calha → inválido; acima da lâmina limite → não atende.
- Ábaco: acima de Qmax ou de D 150 → "sem leitura" (sem os números de busca 20/220), com a
  sugestão de saídas. Saídas, z, declividade, L, Qextra e comprimentos negativos ou quebrados →
  inválidos (nada ajustado em silêncio); declividade de calha > 5% só é anotada.
- PDF com faixa de situação no topo. Scripts e CSS com `?v=3.6.0` (cache dos clássicos).
- Testes: `tests/onda1-estados.test.js` + referência independente `tests/referencia/nbr10844-ref.js`;
  `npm run validate` 44 arquivos/401 testes. Build gera `dist/calha/`; o `postbuild` para só nos
  artefatos privados do Pintor (ignorados no git). Próximo: Onda 2 (catálogo de tubos, C1).

## 3.7.0 — Onda 2 (catálogo de tubos) e passos A–C
Decisão D4 (13/09/2026): fabricantes Tigre e Amanco Wavin. Levantamento completo, com as URLs e
revisões das fichas, em `calha/referencias/catalogo-tubos-tigre-amanco.md` (local).
- **Catálogo** (`nbr10844-dados.js`: `LINHAS_TUBO`, `CATALOGO_TUBOS`): Di = DE − 2e impressos
  pelo fabricante; onde as marcas diferem (Série Normal DN 150: e 2,5 × 2,6) fica o menor Di.
  Linhas: PVC Série Normal e Reforçada (NBR 5688), condutor Aquapluv 88 (Di 84,6), condutor da
  Calha Pluvial Amanco DN 100 (Di 98,0) e coletor PVC NBR 7362 (DN 100–400). Condutor retangular
  e quadrado ficam fora (o ábaco é de seção circular). Vazões anunciadas pelos fabricantes não
  são usadas.
- **Vertical**: `estado.linhaV` (padrão `pvc-sn`) só com PVC; outros materiais ou "Meus tubos"
  usam `estado.tubos` (DN + Di informados). Sem nenhum tubo o app não inventa Di: a calha fica
  incompleta e o passo B.4 pede os tubos. Di < 70 mm fica fora (5.6.3), com aviso.
- **Coletor** (`trecho.linha`, padrão `auto`): enterrado → coletor NBR 7362; aparente → Série
  Normal; material sem catálogo → D da Tabela 4 como Di, com **ressalva** `TUBO_DI_TABELA4`;
  "Meus tubos" → `trecho.tubosH` (Di separados por ;). Seleção pelo menor tubo com Manning a
  2/3 do **Di real** (C1). Política da Tabela 4 (M1): com Di = D da tabela (±0,05 mm) e n e i de
  uma coluna, vale o valor impresso (`fonteQ: 'Tabela 4'`).
- **Margens** (B3): `T.uso`, `T.margem` (coletor), `R.vert.folga` (vertical); legenda no quadro.
- DN, Di, linha e fonte no memorial, na lista de materiais, no quadro, no esquema e no PDF
  (nova seção "Tubos adotados: origem do diâmetro interno").
- **Migração**: a lista antiga de tubos intacta (72/97/146/194) vira `linhaV: 'pvc-sn'`; lista
  editada vira "Meus tubos"; material sem catálogo com a lista antiga fica sem tubos (pede).
- **Passos no lugar dos números da norma** (pedido do usuário): A) intensidade, B) calhas com
  B.1 áreas, B.2 saídas e vazão, B.3 seção, B.4 condutores verticais (o condutor é por calha,
  por isso saiu de "C"), C) coletores. "Como usar, em três passos" mostra a situação de cada
  passo (`P.passos` = `situacaoPassos`: pronto, falta, aguarda o anterior, ressalva…) e o
  clique leva ao campo da pendência; o chip do próximo passo mostra a letra. As referências à
  norma continuam dentro dos textos, do memorial e do PDF.
- **Como escolher** (`calha-guias.js`): em cada grupo de opções, a escolhida em destaque e as
  demais para comparar (de onde vem I, T, saídas, curva, material, forma, lâmina, saída, fonte
  de H, material e linha do vertical, instalação e linha do coletor). No período de retorno, o
  guia avisa quando há calha de platibanda ou água-furtada com T < 25 (5.1.2 c).
- Testes: `tests/onda2-catalogo.test.js` (T-C1-01/02/04, T-M1, B2, B3, migração, passos);
  `npm run validate` 45 arquivos/411 testes. Scripts com `?v=3.7.0`.

## 3.7.1 — H só pela lâmina máxima admitida
Pedido do usuário (13/09/2026): saíram as opções "Lâmina calculada" e "Digitar" do passo B.4.
A calculada (lâmina da vazão de projeto) quase sempre ficava abaixo de 50 mm, sem leitura no
ábaco, e o H digitado podia não corresponder à calha. Agora H = lâmina limite do passo B.3
(`R.H = yLim`); se ela ficar abaixo de 50 mm, a pendência leva à altura da seção (`#h`, `#Dcalha`
ou `#ht`). Projetos salvos com `fonteH` 'calculada' ou 'digitada' migram para 'limite' (`validar`);
`Hlam` fica ignorado. Saíram os códigos H_NEGATIVO, H_ACIMA_ALTURA e H_ACIMA_LIMITE (a C4 da
auditoria deixou de existir: não há H fora da calha). Scripts com `?v=3.7.1`.
- **Semicircular e Tabela 3** (pedido do usuário no mesmo dia): o botão "Escolher o menor
  diâmetro" usa só os diâmetros da Tabela 3 (100, 125, 150 e 200 mm); se nem o de 200 basta,
  não inventa medida (antes arredondava para qualquer D acima de 200) e sugere mais saídas ou
  outra forma. A conferência com a Tabela 3 (`N.qTabela3`, linear em D e em i) passou a valer
  também entre os nós, dentro de 100–200 mm e 0,5–2%; fora disso, nota `FORA_TABELA3` e vale
  só Manning.

## 3.7.2 — o botão de dimensionar respeita o ábaco
Pedido do usuário: a semicircular de 125 mm com lâmina de ⅔ dava H = 41,7 mm e o condutor ficava
"sem leitura". `dimensionarCalha` agora escolhe a menor medida comercial que escoa a vazão **e**
deixa a lâmina limite em pelo menos 50 mm (`H_MIN_ABACO`, a menor curva da Figura 3; 5.6.4.1 só
interpola): semicircular só da Tabela 3 (⅔ → D ≥ 150; ½ → D = 200; cheia → D ≥ 100); retangular
e trapezoidal com h em múltiplos de 5 mm (⅔ → h ≥ 75; ½ → h ≥ 100). `peloAbaco` indica quando foi
o ábaco que decidiu, e o aviso diz isso. Com H < 50 mm, o passo B.4 manda usar o botão do B.3.

## 3.8.0 — modo simples na entrada, modo avançado preservado
Pedido do usuário: quem só quer a calha da casa não deve ver artigo da norma, tabela ou fórmula.
- **Duas páginas.** `index.html` (engnata.eu/calha/) é o modo simples; a página completa foi
  para `avancado.html` com `git mv` e continua sendo a ferramenta mantida. Cada uma linka a outra
  ("← Modo simples" no carimbo do avançado; "Modo avançado" no rodapé do simples). Links antigos
  do cálculo (`calha/#s=…`) são redirecionados para `avancado.html` por um script no `<head>` do
  simples, antes de qualquer outra coisa.
- **Fluxo.** 1) cidade (busca na Tabela 5) e posição da calha: beiral → T = 5; atrás de mureta
  (platibanda) → T = 25 (5.1.2). Cidade fora da tabela: construção até 100 m² → 150 mm/h (5.1.4)
  ou a chuva local com fonte; nunca se inventa a chuva. 2) comprimento da calha, largura da água
  (projeção), altura da cumeeira (Figura 2(b)), altura da mureta (Figura 2(c), só na platibanda),
  altura da calha até o chão (= L do ábaco), canos de descida (ponta, meio, duas pontas, vários) e
  formato (retangular com a largura liberada, seção econômica b = 2y, ou meia-cana da Tabela 3).
  3) resultado.
  Água-furtada e paredes mais altas: só no avançado (dito no passo 1).
- **Nenhuma conta nova.** `CalhaSimples.resolver` monta o estado do avançado, dimensiona pelo
  caminho do botão da 3.7.2 (`dimensionarCalha` com `H_MIN_ABACO`) e lê `calcularProjeto`. O
  resultado só aparece em `atende` ou `ressalva`; o título de sucesso só em `atende`. Os demais
  estados viram frase comum com a ação: "Falta preencher…" com foco no campo, "Usar N descidas"
  (sugestão do motor quando o ábaco estoura), "Usar a calha retangular" (meia-cana sem diâmetro na
  Tabela 3), chuva sem dado confiável (Ouro Preto e São Carlos em T = 25) sem números.
- **Padrões ditos no resultado**, em letra pequena: chapa galvanizada (mesmo n do PVC), caimento
  de 0,5% (mínimo da norma), lâmina de ⅔ e saída em aresta viva (critérios do app), PVC Série
  Normal com Di de catálogo (dado de fabricante).
- **Estado.** O simples guarda só as entradas, em `calha10844:simples:v1`. "Abrir no modo
  avançado com estes dados" gera `avancado.html#s=…` (o formato do "Copiar link do cálculo") e,
  se o avançado tiver projeto próprio salvo (não exemplo), pede confirmação antes de substituir.
- **Testes** em `tests/modo-simples.test.js`: resultado idêntico ao `calcularProjeto` e ao estado
  aberto no avançado (link → `migrar`), H ≥ 50 mm sempre que há resultado, nenhum sucesso fora de
  `atende`, 5.1.4 acima de 100 m² sem resultado, platibanda com T = 25 e a face da mureta,
  pendências em palavras comuns, ações de vazão grande, busca de cidades.
- Conferido no navegador em 390 × 844 e 820 × 1180 (sem rolagem lateral), tema escuro, passagem
  para o avançado, confirmação e redirecionamento de link antigo, console sem erros.

## 3.8.1 — seção econômica proporcional também quando o ábaco decide
O exemplo do modo simples dava 90 × 75 mm: com a largura liberada (b = 2y), `dimensionarCalha`
subia só a altura até a lâmina limite de 50 mm pedida pelo ábaco, e a largura ficava na da vazão.
Uma largura fixa (120 mm, "medida de loja") chegou a ser feita e foi recusada pelo usuário: nada de
medida escolhida de fora do caso. Agora, quando o ábaco decide, a seção cresce inteira: h = altura
do ábaco e b = 2·lâmina limite (⅔ → 100 × 75 mm); quando a vazão decide, nada muda (b = 2y). Vale
para o botão "Calcular a seção econômica" do avançado e para o modo simples, que usa o mesmo
caminho. O padrão dito no resultado descreve só o método ("a largura é o dobro da altura que a
água pode ocupar").

**Desenho do passo 2 em perspectiva.** O corte 2D não mostrava o comprimento da calha. Agora
`desenhoTelhado()` (calha-simples-app.js) gera a cada digitação um corte na frente com a calha
correndo para o fundo, em projeção oblíqua a 30° (x + 0,52·z, −y − 0,3·z; proporções fixas, as
medidas vêm escritas). As cotas mostram os valores digitados (largura, altura, comprimento ao
longo da calha, até o chão e mureta), as descidas seguem a opção escolhida e clicar numa cota
leva ao campo. Na mureta, calha (as quatro bordas e o perfil do fundo fechado) e canos são desenhados
inteiros, a mureta os cobre e o trecho escondido volta tracejado dentro de um `clipPath` com a
silhueta da mureta: linha oculta só onde se esconde; o cano da frente, à vista, fica cheio (antes
só as bordas de baixo, tracejadas até fora da mureta). Foram comparadas cinco
projeções (para trás 30° com a cota do chão no fundo ou na frente, para trás 45°, para a frente,
para trás à esquerda) e duas posições da cota do comprimento: ficou para trás 30°, chão no fundo,
comprimento acima da calha (para a frente mostrava o telhado por baixo; à esquerda virava o texto).
Texto a 18–19 unidades do viewBox para ficar legível a 390 px (≈ 11 px na tela).

## 3.9.0 — PDF do relatório com campos de assinatura
Pedido do usuário: o PDF deve ter campos para a pessoa digitar o nome e assinar digitalmente.
O "Imprimir → Salvar como PDF" do navegador não gera campos de formulário, então há dois
passos (escolha do usuário, contra a alternativa de montar o PDF inteiro como imagem):
1. o relatório é salvo pelo "Imprimir ou salvar em PDF", como antes (vetorial, pesquisável);
2. em "Assinatura digital" (seção Projeto em PDF do avançado) ou no botão "Acrescentar
   assinatura digital" da barra do relatório, a pessoa escolhe esse PDF e `calha-assinatura.js`
   acrescenta uma página final "Assinatura do responsável técnico" e baixa
   `<nome> - para assinar.pdf`.

A página tem campos de texto `responsavel_nome`, `responsavel_registro` (CREA ou CAU) e
`responsavel_data`, e o campo de assinatura digital `responsavel_assinatura`: a pdf-lib não cria
`/FT /Sig` pela API de formulário, então o widget é montado no dicionário e posto em `/Annots`
e no `/AcroForm`, com um quadro desenhado por baixo para aparecer em qualquer leitor. Texto em
Helvetica (WinAnsi; o que não couber vira "?"), margens da folha do relatório. Um PDF que já tem
a página é recusado (`JA_TEM`). A pdf-lib 1.17.1 vem do cdnjs só ao usar a função, com
`integrity` SHA-384 (`PDFLIB_SRI`); o arquivo é lido e gravado no navegador. Conferido com um
relatório real impresso pelo Edge: 5 → 6 páginas, 3 campos de texto + 1 de assinatura.
Testes em `tests/assinatura.test.js` (posições, texto WinAnsi, quebra, nome do arquivo).

## 3.9.1 — legendas do ábaco fora da grade (local, ainda não publicado)
Pedido do usuário: impedir que os nomes das curvas e as leituras se sobreponham entre si ou
a linhas do gráfico. `svgAbaco()` reserva faixas no topo e à direita para os 15 nomes H/L,
distribuídos com espaçamento mínimo. Chamadas pontilhadas ligam cada nome à extremidade
realmente desenhada, inclusive H100 do tipo (b), que acaba na lateral, e L0,3/L0,6 junto ao topo.
As leituras H/L/D e o aviso de D < 50 mm ficam em quadro abaixo dos eixos, com linhas separadas.
Os estilos usam as cores dos temas claro/escuro; tela e relatório compartilham o mesmo SVG.

A grade mantém 466 × 384 unidades; a comparação independente de 256 cenários com a versão
anterior confirmou curvas idênticas (somente deslocamento vertical de 32 unidades). Os 68
testes existentes do Calha passaram. O navegador conferiu oito casos nos tipos (a)/(b),
incluindo leituras próximas, interpoladas, abaixo de 50 e na borda: sem colisões de texto,
legendas dentro da grade ou cortes, em desktop e 390 px. Cache-bust do CSS nas duas páginas
e de `calha-desenhos.js` no avançado atualizado para 3.9.1; branch `feat/calha-legendas-abaco`.
Validação final: `npm run validate` aprovado (47 arquivos/430 testes, paridade e demais
validadores OK). Página avançada e prévia do relatório conferidas no navegador, sem colisões
nem erros de console; contraste conferido também no tema escuro.
