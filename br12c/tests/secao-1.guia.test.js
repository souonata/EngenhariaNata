import { describe, it, expect } from "vitest";
import { criarCalculadora } from "./harness.js";
import { conferir } from "./comparar.js";
import { secao1 } from "./fixtures/secao-1.js";

describe("Capítulo 1 — Seção 1 (Getting Started)", () => {
  for (const ex of secao1) {
    it(ex.nome, async () => {
      const calc = await criarCalculadora();
      // RPN é o padrão; só troca para ALG quando o exemplo pede.
      if (ex.modo === "alg") calc.pressGuia(["g", "ALG"]);

      for (const linha of ex.linhas) {
        calc.pressGuia(linha.keys);
        const r = conferir(calc.display(), linha.display);
        expect(
          r.ok,
          `[${ex.nome}] keys=[${linha.keys.join(" ")}] esperado=${r.esperado} obtido=${r.atual}`,
        ).toBe(true);
      }
    });
  }
});
