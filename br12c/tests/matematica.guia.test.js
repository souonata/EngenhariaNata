// Seção 7 — funções matemáticas (valores conhecidos = comportamento do guia).
import { describe, it, expect } from "vitest";
import { criarCalculadora } from "./harness.js";
import { conferir } from "./comparar.js";

const ok = (calc, esp) => conferir(calc.display(), esp).ok;

describe("Seção 7 — Funções matemáticas", () => {
  it("y^x: 2 ENTER 3 = 8", async () => {
    const c = await criarCalculadora();
    c.pressGuia(["2", "ENTER", "3", "y^x"]);
    expect(ok(c, "8.00")).toBe(true);
  });
  it("1/x: 4 = 0.25", async () => {
    const c = await criarCalculadora();
    c.pressGuia(["4", "1/x"]);
    expect(ok(c, "0.25")).toBe(true);
  });
  it("√x: 81 = 9", async () => {
    const c = await criarCalculadora();
    c.pressGuia(["81", "g", "√x"]);
    expect(ok(c, "9.00")).toBe(true);
  });
  it("e^x: 1 = 2.72", async () => {
    const c = await criarCalculadora();
    c.pressGuia(["1", "g", "e^x"]);
    expect(ok(c, "2.72")).toBe(true);
  });
  it("LN: e^1 depois LN = 1", async () => {
    const c = await criarCalculadora();
    c.pressGuia(["1", "g", "e^x", "g", "LN"]);
    expect(ok(c, "1.00")).toBe(true);
  });
  it("FRAC: 12.34 = 0.34", async () => {
    const c = await criarCalculadora();
    c.pressGuia(["12.34", "g", "FRAC"]);
    expect(ok(c, "0.34")).toBe(true);
  });
  it("INTG: 12.34 = 12", async () => {
    const c = await criarCalculadora();
    c.pressGuia(["12.34", "g", "INTG"]);
    expect(ok(c, "12.00")).toBe(true);
  });
  it("RND: 3.14159 = 3.14 (FIX 2)", async () => {
    const c = await criarCalculadora();
    c.pressGuia(["3.14159", "f", "RND"]);
    expect(ok(c, "3.14")).toBe(true);
  });
  it("x²: 7 = 49", async () => {
    const c = await criarCalculadora();
    c.pressGuia(["7", "g", "x²"]);
    expect(ok(c, "49.00")).toBe(true);
  });
  it("n!: 5 = 120", async () => {
    const c = await criarCalculadora();
    c.pressGuia(["5", "g", "n!"]);
    expect(ok(c, "120.00")).toBe(true);
  });
});
