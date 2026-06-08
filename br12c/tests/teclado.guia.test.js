// Trava o mapeamento f/g conforme a skin real (HP 12C Platinum).
import { describe, it, expect } from "vitest";
import { criarCalculadora } from "./harness.js";
import { conferir } from "./comparar.js";

const txt = (calc, sel) => calc.window.document.querySelector(sel).textContent.trim();
const ok = (calc, esperado) => conferir(calc.display(), esperado).ok;

describe("Teclado — funções f (dourado) / g (azul) conforme a skin", () => {
  it("RPN = f+CHS, ALG = f+EEX", async () => {
    const calc = await criarCalculadora();
    expect(txt(calc, "#modeIndicator")).toBe("RPN");
    calc.pressGuia(["f", "ALG"]);
    expect(txt(calc, "#modeIndicator")).toBe("ALG");
    calc.pressGuia(["f", "RPN"]);
    expect(txt(calc, "#modeIndicator")).toBe("RPN");
  });

  it("BEG = g+7, END = g+8", async () => {
    const calc = await criarCalculadora();
    calc.pressGuia(["g", "BEG"]);
    expect(txt(calc, "#angleIndicator")).toBe("BEG");
    calc.pressGuia(["g", "END"]);
    expect(txt(calc, "#angleIndicator")).toBe("END");
  });

  it("FIX n = f + dígito (FIX 7 antes inacessível)", async () => {
    const calc = await criarCalculadora();
    calc.pressGuia(["f", "7"]);
    calc.pressGuia(["1", "ENTER"]);
    expect(ok(calc, "1.0000000")).toBe(true);
  });

  it("12× = g+n, 12÷ = g+i", async () => {
    const calc = await criarCalculadora();
    calc.pressGuia(["4", "g", "12x"]);
    expect(ok(calc, "48.00")).toBe(true);
    calc.pressGuia(["6", "g", "12÷"]);
    expect(ok(calc, "0.50")).toBe(true);
  });

  it("√x = g+y^x", async () => {
    const calc = await criarCalculadora();
    calc.pressGuia(["9", "g", "√x"]);
    expect(ok(calc, "3.00")).toBe(true);
  });

  it("CLEAR REG = f+CLx zera o display", async () => {
    const calc = await criarCalculadora();
    calc.pressGuia(["1", "2", "3", "ENTER"]);
    calc.pressGuia(["f", "REG"]);
    expect(ok(calc, "0.00")).toBe(true);
  });
});
