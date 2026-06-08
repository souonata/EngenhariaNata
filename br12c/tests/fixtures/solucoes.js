// Parte III — Soluções aplicadas (Seções 12–16). Exemplos que exercitam funções
// já implementadas (TVM, NPV/fluxos, %, e^x, Δ%) sem exigir programação.

export const solucoes = [
  {
    nome: "p159 — APR com pontos (hipoteca $160k/30a/5.5% + 2 pts) = 5.68%",
    modo: "rpn",
    linhas: [
      { keys: ["f", "FIN"], display: "0.00" },
      { keys: ["360", "n"], display: "360.00" },
      { keys: ["5.5", "g", "12÷"], display: "0.46" },
      { keys: ["160000", "PV"], display: "160,000.00" },
      { keys: ["PMT"], display: "-908.46" },
      { keys: ["RCL", "PV", "2", "%", "-"], display: "156,800.00" },
      { keys: ["PV"], display: "156,800.00" },
      { keys: ["i"], display: "0.47" },
      { keys: ["12", "×"], display: "5.68" },
    ],
  },
  {
    nome: "p162 — Preço de hipoteca p/ render 12% (saldo $249.350, 6.5%, 26a) = -158.361,78",
    modo: "rpn",
    linhas: [
      { keys: ["g", "END"], display: "0.00" },
      { keys: ["f", "FIN"], display: "0.00" },
      { keys: ["312", "n"], display: "312.00" },
      { keys: ["6.5", "g", "12÷"], display: "0.54" },
      { keys: ["249350", "CHS", "PV"], display: "-249,350.00" },
      { keys: ["PMT"], display: "1,657.97" },
      { keys: ["12", "g", "12÷"], display: "1.00" },
      { keys: ["PV"], display: "-158,361.78" },
    ],
  },
  {
    nome: "p172-173 — Lease step-up via NPV (500/600/750, 13.5%/a) = 12.831,75",
    modo: "rpn",
    linhas: [
      { keys: ["f", "REG"], display: "0.00" },
      { keys: ["500", "g", "CFo"], display: "500.00" },
      { keys: ["500", "g", "CFj"], display: "500.00" },
      { keys: ["5", "g", "Nj"], display: "5.00" },
      { keys: ["600", "g", "CFj"], display: "600.00" },
      { keys: ["12", "g", "Nj"], display: "12.00" },
      { keys: ["750", "g", "CFj"], display: "750.00" },
      { keys: ["6", "g", "Nj"], display: "6.00" },
      { keys: ["13.5", "g", "12÷"], display: "1.13" },
      { keys: ["f", "NPV"], display: "12,831.75" },
    ],
  },
  {
    nome: "p220 — Taxa contínua -> efetiva (5.25% cap. contínua) = 5.39%",
    modo: "rpn",
    linhas: [
      { keys: ["1", "ENTER", "5.25", "%"], display: "0.05" },
      { keys: ["g", "e^x"], display: "1.05" },
      { keys: ["Δ%"], display: "5.39" },
    ],
  },
];
