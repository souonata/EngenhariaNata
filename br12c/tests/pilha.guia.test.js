// Apêndice A — operações de pilha (RPN).
import { describe, it, expect } from "vitest";
import { criarCalculadora } from "./harness.js";
import { conferir } from "./comparar.js";

const ok = (c, e) => conferir(c.display(), e).ok;

describe("Apêndice A — Pilha (RPN)", () => {
  it("x≷y troca X e Y: 3 ENTER 5 x≷y = 3", async () => {
    const c = await criarCalculadora();
    c.pressGuia(["3", "ENTER", "5", "x≷y"]);
    expect(ok(c, "3.00")).toBe(true);
  });
  it("R↓ rola a pilha: 1 ENTER 2 ENTER 3 ENTER 4 R↓ = 3", async () => {
    const c = await criarCalculadora();
    c.pressGuia(["1", "ENTER", "2", "ENTER", "3", "ENTER", "4", "R↓"]);
    expect(ok(c, "3.00")).toBe(true);
  });
});
