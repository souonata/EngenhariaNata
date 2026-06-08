import { describe, it, expect } from "vitest";
import { criarCalculadora } from "./harness.js";
import { conferir } from "./comparar.js";
import { smoke } from "./fixtures/smoke.js";

describe("Capítulo 0 — smoke do robô (pipeline)", () => {
  for (const exemplo of smoke) {
    it(exemplo.nome, async () => {
      const calc = await criarCalculadora();
      for (const linha of exemplo.linhas) {
        calc.pressGuia(linha.keys);
        const r = conferir(calc.display(), linha.display);
        expect(
          r.ok,
          `keys=[${linha.keys.join(" ")}] esperado=${r.esperado} obtido=${r.atual}`,
        ).toBe(true);
      }
    });
  }
});
