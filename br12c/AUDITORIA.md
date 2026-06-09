# Auditoria de fidelidade — BR 12C Niobium vs HP 12C Platinum

Auditoria técnica multi-especialista do simulador, comparando-o ao comportamento
real da **HP 12C Platinum**. Objetivo: comportamento matemático e de uso o mais
fiel possível à máquina original.

## Metodologia

- **8 especialistas em paralelo** (engenheiro de firmware, RPN/ALG, matemático
  financeiro, precisão numérica, QA, UX de calculadora física, display/indicadores,
  modo programa) examinaram o código (`app.js`, `index.html`, `styles.css`) contra
  o comportamento conhecido da 12C Platinum.
- **Verificação adversarial**: cada achado passou por um QA cético que conferiu
  (a) se o app realmente diverge (lendo o código + reproduzindo no motor real via
  jsdom) e (b) se o "esperado" reflete a 12C Platinum real (manual oficial / fontes).
- Resultado: **56 achados brutos → 11 confirmados**. Regra inviolável: **não
  inventar comportamento**; dúvida vira "a confirmar em manual/calculadora real".
- Cada correção foi feita preservando o app existente, com **teste de regressão**
  (pressionamento real de teclas, headless via jsdom) e a suíte rodando após cada
  uma. **Total: 195 testes verdes, CI verde.**

## Bugs corrigidos (9 de 11)

| # | Sev | Problema | Causa | Correção | Teste |
|---|-----|----------|-------|----------|-------|
| 1 | Alto | `n` calculado vinha fracionário (a 12C arredonda ao inteiro) | `solveN` retornava o valor cru | `arredondarN`: frac<0,005 → piso, senão teto, só no solve de `n` | `fidelidade #1` |
| 2 | Alto | Continuous Memory perdida no reload | estado só em memória; sem `localStorage` | `persistir/hidratarEstado` (subconjunto serializável) no boot/updateUI; guarda `typeof localStorage`+try/catch | `persistencia` |
| 3 | Médio | Erro genérico "Error" sem código | `setError` hardcodava "Error" | `setError(codigo)` → "Error N" (Math=0, Estatística=2, IRR=3) | `fidelidade #3`, `erros` |
| 4 | Médio | SST não fazia single-step em Run mode | sem handler de `sst` em run | `executarInstrucao(pc)` + `passoSST` (preserva entrada de dígitos) | `fidelidade #4` |
| 5 | Baixo | `f RND` não reabilitava o stack lift | faltava `liftStack=true` | RND habilita lift + salva LAST X (operação de 1 nº) | `fidelidade #5` |
| 6 | Baixo | `STO ÷ 0` deixava o registrador mudo | `aplicarOperacao` mascarava /0 | propaga NaN; call-site checa `isFinite` → Error 0 | `fidelidade #6` |
| 7 | Baixo | Flag **C** sem anunciador persistente | `updateUI` não lia `flagC` | anunciador `C` no LCD enquanto `flagC` ativo | `indicadores` |
| 8 | Baixo | **END** sempre aceso (a 12C só acende BEGIN) | `angleIndicator` nunca vazio | `"BEGIN"` só no begin; nome cheio | `teclado` |
| 9 | Baixo | Sem limite de 400 linhas / Error 4 | gravação sem checagem | `memoriaCheia()` → "Error 4" na 401ª linha | `memoria` |

Bônus de fidelidade visual (junto do #7/#8): adicionados os anunciadores **PRGM**
(modo programa) e **D.MY** (formato de data) que o LCD da 12C tem e faltavam.

## Pontos ainda incertos / não corrigidos (não inventar comportamento)

- **#10 — `g MEM` mostra `r-20` fixo** (Baixo). A divergência (valor fixo) é certa,
  mas a 12C Platinum compartilha memória entre linhas de programa e registradores,
  e **a fórmula exata de troca (bytes/linha → registradores) não foi confirmada**
  em texto do manual (aparece só como imagem). Não corrigido para não inventar a
  fórmula. **A confirmar em manual/calculadora real.**
- **#11 — linha vazia em PRGM mostra `43,33,000`** (Baixo). **Provável não-bug**: o
  próprio guia (Seção 8, p.113) afirma que após `f CLEAR PRGM` as linhas 001–008
  contêm `g GTO 000` por padrão — então exibir `43,33,000` em linha vazia é fiel.
  Mantido. **A confirmar** o comportamento exato em linhas acima da 008.
## Implementado após a auditoria

- **Precisão BCD de 10 dígitos** ✅ — `arredondar10(value)` arredonda cada resultado
  a 10 algarismos significativos (aplicado em `setX` e no resultado de
  `applyOperator`; os solvers iterativos usam precisão plena internamente). Reproduz
  o comportamento clássico: `√2` então `x²` = **1,999999999** (não 2); `1/3 ×3` =
  0,9999999999. Teste `fidelidade` (√2 x²). Sem regressão (afeta só o 11º+ dígito).
- **R/S resume** ✅ — um `R/S` no programa pára marcando a linha seguinte
  (`state.resumeAt`); pressionar `R/S` de novo retoma dali (`pararPrograma`). Teste
  `fidelidade` (programa ×5 ; R/S ; +2 → 15 → 17).
- **Vírgula decimal completa no display** ✅ — a fonte 7-seg (DSEG7) tem o rabinho
  da vírgula abaixo da baseline e era cortado pelo `overflow:hidden`; `line-height`
  + `padding-bottom` (em `#display`) dão folga vertical. Verificado no navegador.
- **Troca do separador `.`↔`,`** ✅ — como não dá para "segurar ON + tocar ." com o
  mouse, o combo é feito pelo **modo Segurar** (🔒): ativa Segurar, trava **ON**,
  toca **.** → alterna entre pt-BR (1.234,56) e US (1,234.56). Separador mutável
  ligado a `state.radixComma` (persistido na Continuous Memory). Teste `separador`.
- **Limite de 10 dígitos no display** ✅ — `DISPLAY_DIGIT_LIMIT` 12 → 10 (entrada de
  mantissa e exibição), como a 12C original; ajuste de fonte usa orçamento separado
  (`DISPLAY_FIT_CHARS`) para não encolher números longos. Verificado: 11 díg → 10.
- **Botão do sistema de testes no app final** ✅ — 🧪 na calc abre o runner ao vivo
  (`tests/visual.html`); "← Calculadora" no runner volta. Disponível no site
  publicado (o deploy copia `br12c/` inteiro, incluindo `tests/`).
- **Autoteste de teclado/display** ✅ — o diagnóstico da 12C ("segurar ÷, ON"), feito
  pelo modo Segurar (🔒 → trava ÷ → ON): acende todos os segmentos, depois pede as
  40 teclas na ordem física (ENTER 2×) varrendo 4 segmentos (linha 1) / 2 (linhas
  2-4); termina em **12**; ordem errada → **Error 9** (ENTER limpa e refaz). Teste
  `autoteste`.

## Testes criados (todos simulam pressionamento real de teclas)

| Arquivo | Cobre |
|---------|-------|
| `tests/fidelidade.guia.test.js` | #1 (n→14), #3 (Error 2), #4 (SST 625→473,75), #5 (RND lift), #6 (STO÷0), BCD (√2 x²=1,999999999), R/S resume (15→17) |
| `tests/indicadores.guia.test.js` | anunciadores C / PRGM / D.MY |
| `tests/persistencia.guia.test.js` | Continuous Memory sobrevive a reload (2 boots, mesmo localStorage) |
| `tests/memoria.guia.test.js` | 400 linhas → 401ª = Error 4 |
| `tests/teclado.guia.test.js` (ajustado) | BEGIN só no begin (LCD fiel) |
| `tests/erros.guia.test.js` (ajustado) | códigos Error 0 |

Formato dos casos (exemplo, #1): **teclas** `f REG │ 1.5 i │ 0 PV │ 25 CHS PMT │
365 FV │ n` · **display esperado** `14,00` · **memória afetada** registrador `n`
(=14) · **possível erro** n fracionário · **resultado atual** `14,00` · **PASSOU**.

## Sugestões futuras (sem reescrever o projeto)

1. **`g PSE` com pausa real** (~1 s) no runner ao vivo (hoje é no-op imediato).
2. **Modelo de memória compartilhada** linhas↔registradores (resolve #10) + `g MEM`
   dinâmico, após confirmar a fórmula da Platinum.
3. **Teclado físico / mobile**: confirmar mapeamento de `keydown` e ergonomia touch
   (a auditoria não confirmou bug, mas vale um passe de UX dedicado).
4. **Reset de Continuous Memory**: atalho para limpar o `localStorage` persistido
   (equivalente ao reset da memória contínua da 12C).

## Guia de validação manual contra uma HP 12C Platinum real

Pegue uma 12C Platinum física (ou o app oficial da HP) em **modo RPN, FIX 2** e
compare tecla a tecla:

1. **n arredondado** — `f CLEAR FIN` · `1.5 i` · `0 PV` · `25 CHS PMT` · `365 FV` ·
   `n` → deve mostrar **14** (não 13,30).
2. **RND + lift** — `f CLEAR REG` · `1.236` · `f RND` (→1,24) · `8` · `+` → **9,24**.
3. **STO ÷ 0** — `100 STO 5` · `0 STO ÷ 5` → **Error** (com dígito).
4. **Códigos de erro** — `0 ENTER 0 ÷` → **Error 0**; acumular 0 pares e `g x̄` →
   **Error 2**.
5. **Anunciador C** — `STO EEX` acende **C** no display e permanece; `STO EEX` de
   novo apaga.
6. **BEGIN** — `g BEG` acende **BEGIN**; `g END` apaga (não existe anunciador "END").
7. **PRGM / D.MY** — `f P/R` acende **PRGM**; `g D.MY` acende **D.MY**.
8. **Continuous Memory** — guarde `123 STO 0`, `f 4`; desligue/recarregue; confira
   que `RCL 0`=123,0000 e o FIX 4 permaneceram.
9. **SST passo a passo** — grave `ENTER 2 5 % - 5 +`; em Run, `625` e `SST` repetido
   deve revelar 625,00 → … → **473,75**.
10. **Memória cheia** — em PRGM, grave instruções até 400 linhas; a 401ª deve dar
    **Error 4**.

Onde o app divergir da máquina real, abra um issue citando a sequência exata de
teclas, o display da 12C real e o display do app.
