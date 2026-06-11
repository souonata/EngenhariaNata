// Parte III — Soluções aplicadas (Seções 12–16). Exemplos que exercitam funções
// já implementadas (TVM, NPV/fluxos, %, e^x, Δ%) sem exigir programação.
// Campos didáticos (titulo/objetivo/tags/nota) bilíngues {pt,it}.

export const solucoes = [
  {
    nome: "p159 — APR with points ($160k/30yr/5.5% mortgage + 2 pts) = 5.68%",
    modo: "rpn",
    titulo: { pt: "APR de hipoteca com pontos", it: "APR di un mutuo con punti" },
    objetivo: {
      pt: "A taxa anual efetiva (APR) de um financiamento imobiliário quando há pontos (taxas iniciais que reduzem o valor líquido recebido).",
      it: "Il tasso annuo effettivo (APR) di un mutuo quando ci sono punti (commissioni iniziali che riducono l'importo netto ricevuto).",
    },
    tags: ["financeiro", "finanziario", "apr", "hipoteca", "mutuo", "financiamento", "finanziamento", "pontos", "punti", "taxa", "tasso"],
    linhas: [
      { keys: ["f", "FIN"], display: "0.00", nota: { pt: "Limpa os registradores financeiros.", it: "Pulisce i registri finanziari." } },
      { keys: ["360", "n"], display: "360.00", nota: { pt: "30 anos × 12 = 360 meses (n).", it: "30 anni × 12 = 360 mesi (n)." } },
      { keys: ["5.5", "g", "12÷"], display: "0.46", nota: { pt: "5,5% ÷ 12 = 0,46% ao mês (i).", it: "5,5% ÷ 12 = 0,46% al mese (i)." } },
      { keys: ["160000", "PV"], display: "160,000.00", nota: { pt: "Valor do financiamento: 160.000 (PV).", it: "Importo del mutuo: 160.000 (PV)." } },
      { keys: ["PMT"], display: "-908.46", nota: { pt: "Parcela mensal: −908,46.", it: "Rata mensile: −908,46." } },
      { keys: ["RCL", "PV", "2", "%", "-"], display: "156,800.00", nota: { pt: "Tira 2 pontos (2% de 160.000 = 3.200) → 156.800 líquido.", it: "Toglie 2 punti (2% di 160.000 = 3.200) → 156.800 netto." } },
      { keys: ["PV"], display: "156,800.00", nota: { pt: "Valor líquido recebido: 156.800 (novo PV).", it: "Importo netto ricevuto: 156.800 (nuovo PV)." } },
      { keys: ["i"], display: "0.47", nota: { pt: "Recalcula a taxa mensal real: 0,47%.", it: "Ricalcola il tasso mensile reale: 0,47%." } },
      { keys: ["12", "×"], display: "5.68", nota: { pt: "×12 → APR (taxa anual efetiva) 5,68%.", it: "×12 → APR (tasso annuo effettivo) 5,68%." } },
    ],
  },
  {
    nome: "p162 — Mortgage price for a 12% yield ($249,350 balance, 6.5%, 26yr) = -158,361.78",
    modo: "rpn",
    titulo: { pt: "Preço de uma hipoteca para render 12%", it: "Prezzo di un mutuo per rendere il 12%" },
    objetivo: {
      pt: "Por quanto comprar uma hipoteca já existente (saldo 249.350, 6,5%, 26 anos) para obter um rendimento de 12% ao ano.",
      it: "A quanto comprare un mutuo esistente (saldo 249.350, 6,5%, 26 anni) per ottenere un rendimento del 12% annuo.",
    },
    tags: ["financeiro", "finanziario", "hipoteca", "mutuo", "preço", "prezzo", "rendimento", "yield", "desconto", "sconto"],
    linhas: [
      { keys: ["g", "END"], display: "0.00", nota: { pt: "Pagamentos no fim do período.", it: "Pagamenti a fine periodo." } },
      { keys: ["f", "FIN"], display: "0.00", nota: { pt: "Limpa os registradores financeiros.", it: "Pulisce i registri finanziari." } },
      { keys: ["312", "n"], display: "312.00", nota: { pt: "26 anos × 12 = 312 meses (n).", it: "26 anni × 12 = 312 mesi (n)." } },
      { keys: ["6.5", "g", "12÷"], display: "0.54", nota: { pt: "6,5% ÷ 12 = 0,54% ao mês (taxa do contrato).", it: "6,5% ÷ 12 = 0,54% al mese (tasso del contratto)." } },
      { keys: ["249350", "CHS", "PV"], display: "-249,350.00", nota: { pt: "Saldo devedor atual: 249.350.", it: "Debito residuo attuale: 249.350." } },
      { keys: ["PMT"], display: "1,657.97", nota: { pt: "Parcela mensal do contrato: 1.657,97.", it: "Rata mensile del contratto: 1.657,97." } },
      { keys: ["12", "g", "12÷"], display: "1.00", nota: { pt: "Agora o rendimento desejado: 12% ÷ 12 = 1% ao mês (i).", it: "Ora il rendimento desiderato: 12% ÷ 12 = 1% al mese (i)." } },
      { keys: ["PV"], display: "-158,361.78", nota: { pt: "Preço a pagar: 158.361,78 (comprada com desconto).", it: "Prezzo da pagare: 158.361,78 (comprato a sconto)." } },
    ],
  },
  {
    nome: "p172-173 — Step-up lease via NPV (500/600/750, 13.5%/yr) = 12,831.75",
    modo: "rpn",
    titulo: { pt: "Leasing com parcelas crescentes (NPV)", it: "Leasing con rate crescenti (NPV)" },
    objetivo: {
      pt: "O valor presente de um leasing com pagamentos que sobem em etapas (500 → 600 → 750), descontado a 13,5% ao ano.",
      it: "Il valore attuale di un leasing con pagamenti che salgono a scaglioni (500 → 600 → 750), scontato al 13,5% annuo.",
    },
    tags: ["financeiro", "finanziario", "leasing", "npv", "vpl", "van", "parcelas", "rate", "fluxo de caixa", "flusso di cassa"],
    linhas: [
      { keys: ["f", "REG"], display: "0.00", nota: { pt: "Zera os registradores.", it: "Azzera i registri." } },
      { keys: ["500", "g", "CFo"], display: "500.00", nota: { pt: "Pagamento inicial (mês 0): 500.", it: "Pagamento iniziale (mese 0): 500." } },
      { keys: ["500", "g", "CFj"], display: "500.00", nota: { pt: "Parcela de 500…", it: "Rata di 500…" } },
      { keys: ["5", "g", "Nj"], display: "5.00", nota: { pt: "…por 5 meses (Nj = 5).", it: "…per 5 mesi (Nj = 5)." } },
      { keys: ["600", "g", "CFj"], display: "600.00", nota: { pt: "Parcela de 600…", it: "Rata di 600…" } },
      { keys: ["12", "g", "Nj"], display: "12.00", nota: { pt: "…por 12 meses (Nj = 12).", it: "…per 12 mesi (Nj = 12)." } },
      { keys: ["750", "g", "CFj"], display: "750.00", nota: { pt: "Parcela de 750…", it: "Rata di 750…" } },
      { keys: ["6", "g", "Nj"], display: "6.00", nota: { pt: "…por 6 meses (Nj = 6).", it: "…per 6 mesi (Nj = 6)." } },
      { keys: ["13.5", "g", "12÷"], display: "1.13", nota: { pt: "13,5% ÷ 12 = 1,13% ao mês (i).", it: "13,5% ÷ 12 = 1,13% al mese (i)." } },
      { keys: ["f", "NPV"], display: "12,831.75", nota: { pt: "Valor presente do leasing: 12.831,75.", it: "Valore attuale del leasing: 12.831,75." } },
    ],
  },
  {
    nome: "p220 — Continuous → effective rate (5.25% continuous compounding) = 5.39%",
    modo: "rpn",
    titulo: { pt: "Taxa contínua → taxa efetiva", it: "Tasso continuo → tasso effettivo" },
    objetivo: {
      pt: "Converter uma taxa de capitalização contínua (5,25%) na taxa efetiva anual equivalente, usando e^x.",
      it: "Convertire un tasso di capitalizzazione continua (5,25%) nel tasso effettivo annuo equivalente, usando e^x.",
    },
    tags: ["financeiro", "finanziario", "taxa", "tasso", "contínua", "continuo", "efetiva", "effettivo", "e^x", "conversão", "conversione"],
    linhas: [
      { keys: ["1", "ENTER", "5.25", "%"], display: "0.05", nota: { pt: "5,25% de 1 = 0,0525 (a taxa contínua em decimal).", it: "5,25% di 1 = 0,0525 (il tasso continuo in decimale)." } },
      { keys: ["g", "e^x"], display: "1.05", nota: { pt: "e^0,0525 = 1,0539 (fator de crescimento em 1 ano).", it: "e^0,0525 = 1,0539 (fattore di crescita in 1 anno)." } },
      { keys: ["Δ%"], display: "5.39", nota: { pt: "Δ% de 1 para 1,0539 → taxa efetiva 5,39%.", it: "Δ% da 1 a 1,0539 → tasso effettivo 5,39%." } },
    ],
  },
];
