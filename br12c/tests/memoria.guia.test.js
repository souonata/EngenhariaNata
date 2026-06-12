// Memória de programa (#9): a 12C Platinum tem até 400 linhas; ao esgotar,
// gravar gera Error 4 (memória cheia).
import { describe, it, expect } from "vitest";
import { criarCalculadora } from "./harness.js";

describe("Memória de programa — limite e Error 4 (#9)", () => {
  it("grava 400 linhas; a 401ª gera Error 4", async () => {
    const calc = await criarCalculadora();
    calc.pressGuia(["f", "P/R"]); // entra em modo programa
    for (let i = 0; i < 400; i += 1) calc.pressGuia(["ENTER"]);
    expect(calc.display().replace(/\s/g, "")).toContain("400,"); // linha 400 gravada
    calc.pressGuia(["ENTER"]); // 401ª instrução -> memória cheia
    expect(calc.display().trim()).toBe("Error 4");
    // Teste pesado: 400 toques no jsdom. Normalmente leva ~2-5s, perto do timeout
    // padrão (5s) do Vitest, então estourava às vezes em CI lento (flaky). Folga
    // generosa para nunca mais falhar por tempo.
  }, 30000);
});
