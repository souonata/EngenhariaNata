// Troca de separador decimal . <-> , (ON + . na 12C real), feita pelo modo
// Segurar: 🔒 ativa, toca ON (trava), toca "." (alterna o separador).
import { describe, it, expect } from "vitest";
import { criarCalculadora } from "./harness.js";

describe("Separador decimal — ON + . via Segurar", () => {
  it("alterna entre pt-BR (1.234,5) e US (1,234.5)", async () => {
    const calc = await criarCalculadora();
    const doc = calc.window.document;
    const click = (sel) =>
      doc.querySelector(sel).dispatchEvent(new calc.window.MouseEvent("click", { bubbles: true }));

    calc.pressGuia(["1234.5"]);
    expect(calc.display()).toBe("1.234,5"); // padrão pt-BR

    click("#holdModeBtn"); // ativa o modo Segurar
    click('[data-action="power"]'); // trava ON
    click('[data-action="decimal"]'); // toca "." -> troca o separador
    expect(calc.display()).toBe("1,234.5"); // formato US

    click('[data-action="power"]'); // trava ON de novo (Segurar ainda ativo)
    click('[data-action="decimal"]'); // alterna de volta
    expect(calc.display()).toBe("1.234,5"); // pt-BR novamente
  });
});
