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
