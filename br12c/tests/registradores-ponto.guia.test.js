// Registradores de dados com prefixo de ponto: R.0–R.9 (STO . n / RCL . n).
// O Guia HP 12C Platinum (p.27, "Storage Registers") descreve 20 registradores:
// R0–R9 e R.0–R.9, endereçados com o dígito 0–9 ou ".0"–".9". Antes da correção,
// STO . n descartava o pendingStore e o "." caía em inputDecimal (X = 77,5 em vez
// de gravar 77 em R.5). Aqui travamos esse comportamento.
import { describe, it, expect } from "vitest";
import { criarCalculadora } from "./harness.js";
import { conferir } from "./comparar.js";

const ok = (calc, esperado) => {
  const r = conferir(calc.display(), esperado);
  return { passou: r.ok, msg: `esperado=${r.esperado} obtido=${r.atual}` };
};

describe("Registradores com ponto R.0–R.9 (Guia p.27)", () => {
  it("77 STO . 5 grava em R.5 (não anexa ponto decimal a X) e RCL . 5 recupera 77,00", async () => {
    const calc = await criarCalculadora();

    // STO . 5: commita o 77 e grava em R.5. X permanece 77,00 — NÃO vira 77,50.
    calc.pressGuia(["77", "STO", ".", "5"]);
    const armazenou = ok(calc, "77.00");
    expect(armazenou.passou, `[STO . 5] ${armazenou.msg}`).toBe(true);

    // Sobrescreve X para garantir que o RCL realmente lê o registrador.
    calc.pressGuia(["0"]);
    expect(conferir(calc.display(), "0").ok || conferir(calc.display(), "0.00").ok).toBe(true);

    // RCL . 5: recupera o conteúdo de R.5.
    calc.pressGuia(["RCL", ".", "5"]);
    const recuperou = ok(calc, "77.00");
    expect(recuperou.passou, `[RCL . 5] ${recuperou.msg}`).toBe(true);
  });

  it("R5 e R.5 são registradores independentes (não colidem)", async () => {
    const calc = await criarCalculadora();

    calc.pressGuia(["10", "STO", "5"]); // R5  = 10
    calc.pressGuia(["20", "STO", ".", "5"]); // R.5 = 20

    calc.pressGuia(["RCL", "5"]);
    const r5 = ok(calc, "10.00");
    expect(r5.passou, `[RCL 5] ${r5.msg}`).toBe(true);

    calc.pressGuia(["RCL", ".", "5"]);
    const rDot5 = ok(calc, "20.00");
    expect(rDot5.passou, `[RCL . 5] ${rDot5.msg}`).toBe(true);
  });

  it("RCL . n respeita o lift de pilha igual ao RCL n", async () => {
    const calc = await criarCalculadora();

    // Mesmo padrão da fatura STO/RCL (Guia p.28), mas com registrador R.0:
    // RCL . 0 habilita o stack-lift, então o "6" seguinte empurra 1250 para Y.
    calc.pressGuia(["1250", "STO", ".", "0"]);
    const gravou = ok(calc, "1,250.00");
    expect(gravou.passou, `[STO . 0] ${gravou.msg}`).toBe(true);

    calc.pressGuia(["RCL", ".", "0"]);
    const recuperou = ok(calc, "1,250.00");
    expect(recuperou.passou, `[RCL . 0] ${recuperou.msg}`).toBe(true);

    calc.pressGuia(["6", "×"]);
    const multiplicou = ok(calc, "7,500.00"); // 1250 (liftado para X) × 6
    expect(multiplicou.passou, `[6 ×] ${multiplicou.msg}`).toBe(true);
  });
});
