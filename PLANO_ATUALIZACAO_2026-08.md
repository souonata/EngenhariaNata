# Plano de atualização — agosto/2026

Consolida **todas** as solicitações desta sessão, com estado de cada uma. Ordem de
execução pensada para não quebrar nada: primeiro o que já está em voo, depois o que
é transversal ao site, e por último o que exige pesquisa externa.

Convenção de estado: ✅ feito · 🔄 em andamento · ⏳ pendente

---

## Fase 1 — App `mutuo`: bolån como 4º sistema

**Pedido:** separar bem o cálculo sueco; criar um gráfico com valores úteis (equivalente
ao de tipos de financiamento em pt/it); depois, transformar o bolån em **mais uma opção
de sistema** — ao lado de SAC, Price e Americano — visível também em português e
italiano, apenas indicando que é o modelo usado na Suécia. E, no site em sueco, os
sistemas de BR/IT continuam visíveis e traduzidos.

| # | Item | Estado |
|---|------|--------|
| 1.1 | `projetarBolan()` no núcleo numérico — projeção ano a ano, degraus do amorteringskrav, omvärdering a cada 5 anos | ✅ |
| 1.2 | 8 testes novos da projeção (total do arquivo: 59) | ✅ |
| 1.3 | Gráfico `graficoBolan`: barras empilhadas (amortização + juros líquidos) + linha de belåningsgrad com as fronteiras de 70 % e 50 % | ✅ |
| 1.4 | Resumo em texto sob o gráfico (juros pagos, total amortizado, dívida restante, e a frase de que o mínimo legal nunca quita) | ✅ |
| 1.5 | Entradas novas: horizonte da projeção e amortização voluntária anual | ✅ |
| 1.6 | Seção **SAIBA MAIS / LÄS MER** do bolån: 7 blocos de fórmulas e premissas + fontes + ressalva didática | ✅ |
| 1.7 | Bolån vira o **4º rádio** do seletor de sistema, com marca 🇸🇪 do país | ✅ |
| 1.8 | A tela passa a ser decidida pelo **sistema escolhido**, não pelo idioma (`body.sistema-bolan`); o seletor volta a aparecer em sueco | ✅ |
| 1.9 | Padrão por idioma: sueco abre no bolån, pt/it abrem no Price; escolha manual do usuário passa a mandar | ✅ |
| 1.10 | i18n completo nos três idiomas (43 chaves novas) + apóstrofos que faltavam no italiano | ✅ |
| 1.11 | Verificação no Vite: 4 sistemas em pt/it/sv, seletor sempre visível, gráfico e Läs mer conferidos | ✅ |
| 1.12 | **Bug corrigido:** o seletor de sistema ficava dentro do bloco escondido pelo bolån — sem caminho de volta para SAC/Price. Agora vive no próprio card, acima das duas telas | ✅ |
| 1.13 | Os 15 ternários pt/it do app viraram chaves i18n: o sueco via a explicação e o comparativo em italiano assim que passou a ter acesso aos sistemas clássicos | ✅ |

**Ponto pedagógico que o gráfico entrega:** com 4 M kr de imóvel, 600 mil de entrada e
4 % ao ano, cumprindo só o mínimo legal, em 30 anos paga-se **mais juros do que se
amortiza** e a dívida ainda é de ~2 M kr. A curva de dívida achata em 50 % de
belåningsgrad — porque ali a exigência de amortizar simplesmente acaba.

---

## Fase 2 — App `sobre`: conteúdo desatualizado

**Pedido:** o "Sobre o projeto" está desatualizado; em sueco não menciona as adaptações
feitas nos apps em que o cálculo e o layout mudam por país.

| # | Item | Estado |
|---|------|--------|
| 2.1 | Novo cartão **"Adaptação por país"** nos três idiomas: explica que 7 apps mudam de método, não só de idioma, e lista quais e por quê | ✅ |
| 2.2 | Corrigir descrições suecas defasadas (ver tabela abaixo) | ✅ |
| 2.3 | `salario`: "bilíngue BR/IT" → trilíngue, com o modelo sueco (nos três idiomas) | ✅ |
| 2.4 | `mutuo`: parar de descrever escolha de sistema como se valesse na Suécia; citar o bolån | ✅ |
| 2.5 | Registrar a versão nova em `config/versions.json` (mutuo e sobre → 2.1.0) | ✅ |

### Conteúdo sueco defasado já localizado

| Chave | Está | Deveria |
|-------|------|---------|
| `apps.ventilacao.desc`, `ventilacao.description`, `features.nbr15575` | "Boverkets byggregler" (BBR) | **BFS 2024:8, 3 kap. 5 §** — o BBR foi substituído e a transição acabou em 1/7/2026 |
| `apps.solar.desc` | "fristående" (off-grid) | Na Suécia o padrão é **nätansluten** (conectado à rede) |
| `apps.arcondicionado.desc` | dimensiona carga térmica de verão | Lá é **luftvärmepump comprada para aquecer** |
| `apps.aquecimento.desc` | dimensiona aquecimento solar | Lá é **complemento**; o teto da fração solar é do calendário |
| `chuva.description`, `features.economia-chuva` | "månadsbesparing" | O que decide é a **temporada** (vegetationsperiod), não o mês |
| `apps.salario.desc`, `salario.description` | "Brasilien/Italien" | Inclui a Suécia (kommunalskatt, grundavdrag, jobbskatteavdrag) |
| `apps.mutuo.desc`, `mutuo.description` | "jämför amorteringsformer" | Citar o **bolån** e o amorteringskrav |
| `features.battery`, `features.inverter-mppt`, `features.autonomia` | linguagem de sistema isolado | Ressalva de que valem no modo BR/IT |

---

## Fase 3 — Padrão de entrada: slider sob o valor, sem botões +/−

**Pedido:** usar em todo o site o padrão que ficou bom no bolån — rótulo, campo de texto,
slider por baixo — **removendo os botões de mais e menos**, mantendo: seleção automática
do texto ao clicar (para o teclado abrir no celular já pronto para digitar) e commit do
valor digitado ao **sair do campo, Tab, Enter, toque fora ou scroll no celular**.

| # | Item | Estado |
|---|------|--------|
| 3.1 | Seleção ao focar já existia no núcleo (`configurarInputsNumericosMoveis`) e vale para todo `input.valor-input` | ✅ |
| 3.2 | Novo `src/utils/confirmar-ao-sair.js`: confirma em toque fora, Enter e rolagem — rolagem só em tela de toque | ✅ |
| 3.3 | **134 botões `.arrow-btn`** removidos de 14 páginas | ✅ |
| 3.4 | `configurarBotoesIncremento()` removido de 10 apps; CSS e variáveis `--arrow-*` limpos; grade mobile de 3 colunas virou faixa inteira | ✅ |
| 3.5 | 13 páginas conferidas: 200, zero setas, sliders inteiros; commit por blur e Enter validado no `bitola` | ✅ |
| 3.6 | 11 testes em jsdom (`confirmar-ao-sair.test.js`), incluindo o caso do Enter cíclico do mutuo | ✅ |

**Como ficou:** cada app manteve o seu `configurarInputsTexto` — todos já confirmavam em
`blur` e `Enter`, então bastou garantir que o `blur` acontece também em toque fora e
rolagem. O `configurarInputsNumericosMoveis` do núcleo já dava a seleção automática do
texto e o `inputmode` correto para o teclado do celular.

**Gotcha registrado:** apps da raiz não passam pelo Prettier (usam 4 espaços) — não rodar
`prettier --write` neles, infla o diff.

---

## Fase 4 — App `fazenda`: base de dados sueca

**Pedido:** pesquisa bibliográfica profunda sobre cultivo de frutas e verduras na Suécia,
proteínas animais e demais vegetais cultiváveis, incluindo formas de captura como
**armadilhas de lagostim (kräftor) de água doce e salgada**, para montar a base e as
opções suecas.

> ⚠️ Isto **reverte uma decisão registrada** no `AGENTS.md`: o `fazenda` estava
> explicitamente fora do sueco, por depender de base agronômica regional. É exatamente
> essa base que esta fase constrói.

Base criada em **`src/data/parametros-suecia-fazenda.js`**, no mesmo padrão do
`parametros-suecia.js`: cada constante com fonte e data de consulta (2026-08-19).

| # | Item | Estado |
|---|------|--------|
| 4.1 | Zonas de rusticidade I–VIII (Riksförbundet Svensk Trädgård) + a armadilha de leitura: a carta vale para lenhosas, e zona alta ≠ norte (mar e lagos amenizam, altitude agrava) | ✅ |
| 4.2 | Rendimento-âncora de batata (Jordbruksverket 2025: 43 580 kg/ha → 4,36 kg/m²) e temporada por região via `vegetationsperiod` do SMHI | 🔄 falta cultura a cultura |
| 4.3 | Bagas com zona máxima e armadilhas de manejo: havtorn é dioico (sem macho não há fruto), groselha-preta e havtorn frutificam no ramo do ano anterior, hallon tem ciclo de dois anos | 🔄 falta fruteira de árvore |
| 4.4 | Galinha (150–200 ovos/ano no quintal, com queda no inverno sem luz artificial), abelhas (30 kg de mel/colmeia, faixa 20–50) e ovelha (15–25 kg de carne por cordeiro) | 🔄 falta coelho e forragem de inverno |
| 4.5 | **Kräftfiske levantado por inteiro** — ver quadro abaixo | ✅ |
| 4.6 | Allemansrätten: cobre bagas e cogumelos (até para venda), **não** cobre nozes nem kräftfiske; cinco cogumelos protegidos listados | ✅ |
| 4.7 | Modelar os dados no formato do app e escrever a camada `sv-SE` | ⏳ |
| 4.8 | Calendário de plantio/colheita/reprodução por zona | ⏳ |
| 4.9 | Testes do núcleo de dimensionamento sueco | ⏳ |
| 4.10 | Cada constante com fonte e data — inclusive uma lista `PENDENTE_PESQUISA_SE` no próprio arquivo, com o que **não** pode ser preenchido de memória | ✅ |

### O achado da fase: a armadilha do kräftfiske é jurídica, não física

| | Água doce (signalkräfta) | Água salgada (havskräfta) |
|---|---|---|
| Onde o público pode pescar | **Só o Vättern** — o allemansrätten **não** cobre kräftfiske; em qualquer outra água é preciso autorização do detentor do direito de pesca | Costa oeste |
| Temporada | Sexta 17h → domingo 17h, em **três fins de semana** a partir da quarta sexta-feira de agosto | **Ano inteiro** |
| Armadilhas por pessoa | 6 | 6 |
| Limite de captura | 60/dia, 120/fim de semana | — |
| Tamanho mínimo | 10 cm | 9 cm (órbita → borda posterior da carapaça) |
| Abertura de fuga | 2 × 28 mm quando a malha é menor que 50 mm | 75 mm abaixo de 30 m de profundidade; rymningshål obrigatório desde 1/1/2023 |

A `flodkräfta` nativa está ameaçada pela peste trazida pela signalkräfta e não é alvo de
pesca recreativa livre. A `hummer` usa a mesma armadilha, mas só da primeira segunda-feira
após 20 de setembro até o fim de novembro. Transporte de lagostim **vivo** é restrito à
área de manejo.

**Restrição inegociável desta fase:** nada de número de memória. Regra de captura e
temporada de pesca muda por ano e por água; o app cita fonte e data, e deixa claro que a
licença é responsabilidade do usuário.

---

## Fase 6 — Gráfico logo após os sliders

**Pedido:** pôr o gráfico logo depois dos sliders, para ver a variação de cada parâmetro
mais facilmente — em todos os apps que tenham gráfico que muda com os parâmetros.

| App | Situação | Estado |
|-----|----------|--------|
| `helice` | Já estava: controles → gráfico → resultados | ✅ nada a fazer |
| `mutuo` | Já estava, nos dois modos (clássico e bolån) | ✅ nada a fazer |
| `salario` | Donut e barras estavam **dentro** dos resultados, um no meio e outro no fim. Extraídos para um `#graficosSection` logo após o card de entradas | ✅ |
| `solar` | Amortização e sazonalidade estavam no fim dos resultados, junto com o slider de período de análise. O bloco inteiro subiu para depois das entradas | ✅ |
| `aquecimento` | Distribuição, comparação e eficiência estavam no fim dos resultados. Subiram, e a borda de separação que fazia sentido dentro do card saiu | ✅ |
| `patentenautica` | O canvas é a Carta 5/D, não um gráfico de parâmetro | — fora do escopo |
| `arcondicionado`, `bitola`, `bombaagua`, `chuva`, `fazenda`, `iluminacao`, `ventilacao` | Não têm gráfico | — |

Reatividade conferida em 375 × 812 depois da mudança: mexer no slider altera a série do
gráfico nos três apps movidos — inclusive o slider de período que vive **dentro** do
bloco de gráficos do `solar`.

**Ressalva de mobile:** em `salario` o card de entradas tem ~1 700 px em 375 px de
largura, então os primeiros sliders ainda ficam longe do gráfico. A ordem pedida está
correta; para ver a curva reagir enquanto se arrasta o primeiro slider seria preciso um
gráfico fixo (sticky) ou uma miniatura — mudança de layout que não foi pedida.

---

## Fase 5 — Revisão e teste de todo o conteúdo

| # | Item | Estado |
|---|------|--------|
| 5.1 | `npm run validate` — 37 arquivos, **340 testes**, paridade i18n e integridade náutica OK | ✅ |
| 5.2 | `npm run build` — concluído, sem erro | ✅ |
| 5.3 | Varredura de conteúdo defasado nos outros apps em sueco (mesma auditoria feita no `sobre`) | ⏳ |
| 5.4 | Verificação visual: 3 idiomas × tema claro/escuro × 390 px e desktop | ⏳ |
| 5.5 | Atualizar `AGENTS.md` §9, `ROADMAP.md` e `config/versions.json` | ⏳ |

---

## O que falta

1. **Fase 4.7–4.9** — a tela sueca do `fazenda` em si: modelar os dados no formato do app,
   escrever a camada `sv-SE`, montar o calendário por zona e testar o dimensionamento.
   Antes disso, fechar os itens de `PENDENTE_PESQUISA_SE` — rendimento por cultura, dias
   até a colheita, janela de semeadura por zona, produção por planta de cada baga.
2. **Fase 5.3** — repetir no resto dos apps a auditoria de conteúdo defasado que foi feita
   no `sobre`.
3. **Fase 5.4** — verificação visual em 390 px e no tema escuro (a Browser pane desta
   sessão não compõe quadros, então a conferência foi por DOM e não por captura de tela).
4. **Fase 5.5** — atualizar `AGENTS.md` §9 e `ROADMAP.md` com esta sessão.
