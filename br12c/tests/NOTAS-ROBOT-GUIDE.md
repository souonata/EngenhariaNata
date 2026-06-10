# Robot Guide — log técnico (índice EN + independência dos testes)

Decisões (2026-06-10):
- Índice do runner (`visual.html`) renomeado em EN seguindo o índice do User Guide:
  Part I (S1–7) · Part II (S8–11, fixtures `programa`) · Part III (S12–16, `solucoes`)
  · Appendices A–E. **F (Battery/Service) e G (regulatório) não têm keystrokes
  testáveis no guia — fora do dropdown (limitação documentada).**
- `matematica`/`pilha` headless têm casos inline (não-fixture); para não refatorar,
  S7 e Appendix A/B/C do runner usam o fixture novo `fixtures/extras.js`
  (exemplos já validados pelo motor; Appendix C reusa o IRR p.76-78 com setup completo).
- Independência: a Continuous Memory (localStorage) fazia o iframe do runner HERDAR
  estado entre testes → `resetCalc` agora remove `br12c.continuousMemory` antes de
  recarregar (boot limpo = RPN, FIX 2, tudo zerado).
- Modo explícito: runner e `_runner.js` pressionam `f RPN`/`f ALG` no início de TODO
  exemplo (não só ALG). Headless não tem localStorage (persistência é no-op).
- Estado prévio: exemplos que dependem de valores anteriores já os inicializam nas
  próprias linhas (ex.: IRR re-lança fluxos; fatura faz STO 0 + CLEAR Σ).

Atualização (2026-06-10, nomes EN + exemplos novos):
- Todos os `nome` dos fixtures renomeados para EN (script em lote; nomes viram os
  títulos do dropdown e dos testes headless).
- Novos exemplos: **Digit separators** (Section 1 p.17; combo via Segurar:
  HOLD → ON → "."; comparação textual exata via prefixo `=` no display esperado) e
  **Appendix F self-test** (p.266; HOLD → ÷ → ON, 40 teclas em ordem, termina em 12).
- Robô ganhou o token `HOLD` (ALIASES → ação "hold-mode" = clique no #holdModeBtn,
  fora do #keyboard) no harness headless e no pressActions do runner.
- `tocar` ganhou geração de run (`runId`): um play novo invalida runs órfãos
  suspensos (nunca dois robôs no mesmo iframe).
- ARMADILHA de verificação: com a aba do runner em BACKGROUND o Chrome trotela
  setTimeout (intensive throttling) e o robô anda ~1 passo/min — parece travado,
  não é. Validar ao vivo com a aba visível; a verdade funcional é o headless.
