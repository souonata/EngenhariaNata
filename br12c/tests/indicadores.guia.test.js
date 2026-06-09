// Anunciadores de status do LCD (fidelidade HP 12C Platinum): C, PRGM, D.MY.
// A 12C real acende esses indicadores enquanto o estado correspondente está ativo.
import { describe, it, expect } from "vitest";
import { criarCalculadora } from "./harness.js";

const txt = (calc, sel) => calc.window.document.querySelector(sel).textContent.trim();

describe("Indicadores do LCD (auditoria #7/#8)", () => {
  it("C acende e apaga com STO EEX (juros compostos no período odd)", async () => {
    const calc = await criarCalculadora();
    expect(txt(calc, "#cIndicator")).toBe("");
    calc.pressGuia(["STO", "EEX"]);
    expect(txt(calc, "#cIndicator")).toBe("C");
    calc.pressGuia(["STO", "EEX"]);
    expect(txt(calc, "#cIndicator")).toBe("");
  });

  it("PRGM acende no modo programa (f P/R)", async () => {
    const calc = await criarCalculadora();
    expect(txt(calc, "#prgmIndicator")).toBe("");
    calc.pressGuia(["f", "P/R"]);
    expect(txt(calc, "#prgmIndicator")).toBe("PRGM");
    calc.pressGuia(["f", "P/R"]);
    expect(txt(calc, "#prgmIndicator")).toBe("");
  });

  it("D.MY acende no formato dia-mês-ano (g D.MY) e apaga em g M.DY", async () => {
    const calc = await criarCalculadora();
    expect(txt(calc, "#dmyIndicator")).toBe("");
    calc.pressGuia(["g", "D.MY"]);
    expect(txt(calc, "#dmyIndicator")).toBe("D.MY");
    calc.pressGuia(["g", "M.DY"]);
    expect(txt(calc, "#dmyIndicator")).toBe("");
  });
});
