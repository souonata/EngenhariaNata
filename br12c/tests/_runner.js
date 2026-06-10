// Runner compartilhado das suítes do guia. Cada exemplo roda numa calc nova;
// linhas são sequenciais. Troca para ALG quando ex.modo === "alg" (RPN é padrão).
import { describe, it, expect } from "vitest";
import { criarCalculadora } from "./harness.js";
import { conferir } from "./comparar.js";

export function rodarSecao(titulo, exemplos) {
  describe(titulo, () => {
    for (const ex of exemplos) {
      it(ex.nome, async () => {
        const calc = await criarCalculadora();
        // Modo explícito SEMPRE (independência: nenhum teste herda o modo anterior).
        calc.pressGuia(["f", ex.modo === "alg" ? "ALG" : "RPN"]);
        if (ex.preparar) ex.preparar(calc);
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
}
