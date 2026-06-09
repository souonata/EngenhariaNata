// Autoteste de teclado/display da HP 12C ("segurar ÷, ON"). Aqui o combo é feito
// pelo modo Segurar: 🔒 -> trava ÷ -> ON. Depois pressiona-se cada tecla na ordem
// física (linha 1->4, esquerda->direita), com ENTER duas vezes (linhas 3 e 4).
import { describe, it, expect } from "vitest";
import { criarCalculadora } from "./harness.js";

const SEQ = [
  "tvm:n", "tvm:i", "tvm:PV", "tvm:PMT", "tvm:FV", "chs", "digit:7", "digit:8", "digit:9", "op:/",
  "pow", "reciprocal", "percent-total", "delta-percent", "percent", "eex", "digit:4", "digit:5", "digit:6", "op:*",
  "run-stop", "sst", "roll", "swap", "clear-entry", "enter", "digit:1", "digit:2", "digit:3", "op:-",
  "power", "shift:f", "shift:g", "sto", "rcl", "enter", "digit:0", "decimal", "sum-plus", "op:+",
];

async function entrarNoTeste() {
  const calc = await criarCalculadora();
  const doc = calc.window.document;
  const clickSel = (sel) => doc.querySelector(sel)?.dispatchEvent(new calc.window.MouseEvent("click", { bubbles: true }));
  const tecla = (a) => clickSel(`#keyboard [data-action="${a}"]`);
  clickSel("#holdModeBtn"); // ativa Segurar
  tecla("op:/"); // trava ÷
  tecla("power"); // ON -> entra no autoteste
  return { calc, tecla };
}

describe("Autoteste de teclado/display (segurar ÷, ON)", () => {
  it("entra no teste com todos os segmentos acesos", async () => {
    const { calc } = await entrarNoTeste();
    expect(calc.display()).toBe("8888888888");
  });

  it("sequência completa (40 teclas, ENTER 2×) termina em 12", async () => {
    const { calc, tecla } = await entrarNoTeste();
    for (const a of SEQ) tecla(a);
    expect(calc.display()).toBe("12");
  });

  it("ordem errada gera Error 9", async () => {
    const { calc, tecla } = await entrarNoTeste();
    tecla("tvm:i"); // esperado tvm:n -> sequência errada
    expect(calc.display()).toBe("Error 9");
  });
});
