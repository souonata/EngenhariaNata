// Manual do proprietário — Parte III (Soluções aplicadas, Seções 12-16,
// p.122-164): imóveis/hipotecas, análise de investimento, leasing, poupança
// e títulos. Como a maioria dos exemplos desta parte assume a digitação de um
// PROGRAMA dedicado inteiro antes do cálculo (depreciação por saldo
// decrescente, títulos 30/360 etc.), escolhemos aqui os exemplos de cada
// seção que são cálculos diretos (sem programa) — mais fiéis a testar via
// teclas soltas e de baixo risco de erro de transcrição. A Seção 16 (Bonds)
// fica de fora: seu conteúdo é só o programa 30/360 (a função PRICE/YTM
// embutida já foi testada com números reais do próprio manual na Seção 4).
//
// Achado à parte (não é bug corrigido, é limitação anotada): na 12C real,
// ENTER seguido de PV/PMT/FV/n/i sempre GRAVA o valor mostrado (só CALCULA se
// a tecla anterior também foi uma dessas). Aqui o app só grava com dígito
// "fresco" (entryActive) ou logo após uma conta aritmética (+-×÷); ENTER
// sozinho não deixa esse estado, então "100 ENTER PV" calcula em vez de
// gravar. Evitamos esse combo específico nos exemplos abaixo (uso direto tipo
// "100 CHS PV") em vez de arriscar uma mudança mais ampla nessa heurística.
// Campos didáticos (titulo/objetivo/tags/nota) bilíngues {pt,it}.

export const handbookSolucoes = [
  {
    nome: "p123 — APR with 2 points ($60,000/30yr/11.5% mortgage) = 11.76%",
    modo: "rpn",
    titulo: { pt: "APR de hipoteca com 2 pontos", it: "APR di un mutuo con 2 punti" },
    objetivo: {
      pt: "A taxa anual efetiva (APR) de um financiamento de 60.000 a 11,5% quando o banco cobra 2 pontos (2% do valor) na largada.",
      it: "Il tasso annuo effettivo (APR) di un finanziamento di 60.000 all'11,5% quando la banca applica 2 punti (2% dell'importo) in partenza.",
    },
    tags: ["financeiro", "finanziario", "apr", "hipoteca", "mutuo", "financiamento", "finanziamento", "pontos", "punti", "taxa", "tasso"],
    linhas: [
      { keys: ["g", "END"], display: "0.00", nota: { pt: "Pagamentos no fim do mês.", it: "Pagamenti a fine mese." } },
      { keys: ["f", "FIN"], display: "0.00", nota: { pt: "Limpa os registradores financeiros.", it: "Pulisce i registri finanziari." } },
      { keys: ["30", "g", "12x"], display: "360.00", nota: { pt: "30 anos × 12 = 360 meses (n).", it: "30 anni × 12 = 360 mesi (n)." } },
      { keys: ["11.5", "g", "12÷"], display: "0.96", nota: { pt: "11,5% ÷ 12 = 0,96% ao mês (i).", it: "11,5% ÷ 12 = 0,96% al mese (i)." } },
      { keys: ["60000", "PV"], display: "60,000.00", nota: { pt: "Valor do financiamento: 60.000 (PV).", it: "Importo del finanziamento: 60.000 (PV)." } },
      { keys: ["PMT"], display: "-594.17", nota: { pt: "Parcela mensal: 594,17.", it: "Rata mensile: 594,17." } },
      { keys: ["RCL", "PV", "2", "%", "-", "PV"], display: "58,800.00", nota: { pt: "Tira 2 pontos (2% de 60.000 = 1.200) → 58.800 líquido recebido (novo PV).", it: "Toglie 2 punti (2% di 60.000 = 1.200) → 58.800 netto ricevuto (nuovo PV)." } },
      { keys: ["i"], display: "0.98", nota: { pt: "Recalcula a taxa mensal real: 0,98%.", it: "Ricalcola il tasso mensile reale: 0,98%." } },
      { keys: ["12", "×"], display: "11.76", nota: { pt: "×12 → APR (taxa anual efetiva) 11,76%.", it: "×12 → APR (tasso annuo effettivo) 11,76%." } },
    ],
  },
  {
    nome: "p143 — Excess depreciation over 6.5 years (accelerated $9,429.56 vs straight-line) = 898.31",
    modo: "rpn",
    titulo: { pt: "Depreciação excedente", it: "Ammortamento eccedente" },
    objetivo: {
      pt: "Quanto a mais um método acelerado depreciou em relação ao método linear, para um mesmo bem e período.",
      it: "Quanto in più un metodo accelerato ha ammortizzato rispetto al metodo lineare, per lo stesso bene e periodo.",
    },
    tags: ["financeiro", "finanziario", "depreciação", "ammortamento", "excedente", "eccedente", "linear"],
    linhas: [
      { keys: ["9429.56", "ENTER"], display: "9,429.56", nota: { pt: "Depreciação acelerada acumulada até o 7º ano (dado já calculado).", it: "Ammortamento accelerato accumulato fino al 7° anno (dato già calcolato)." } },
      { keys: ["10500", "ENTER"], display: "10,500.00", nota: { pt: "Valor depreciável do bem (custo − residual).", it: "Valore ammortizzabile del bene (costo − residuo)." } },
      { keys: ["8", "÷"], display: "1,312.50", nota: { pt: "Depreciação linear anual: 10.500 ÷ 8 anos de vida útil.", it: "Ammortamento lineare annuo: 10.500 ÷ 8 anni di vita utile." } },
      { keys: ["6.5", "×"], display: "8,531.25", nota: { pt: "×6,5 anos → depreciação linear total no mesmo período.", it: "×6,5 anni → ammortamento lineare totale nello stesso periodo." } },
      { keys: ["-"], display: "898.31", nota: { pt: "Diferença: 898,31 depreciados a mais pelo método acelerado.", it: "Differenza: 898,31 ammortizzati in più dal metodo accelerato." } },
    ],
  },
  {
    nome: "p146 — Lease advance payments: $750/12mo/3 in advance @10% yield → $64.45/mo",
    modo: "rpn",
    titulo: { pt: "Leasing com pagamentos antecipados", it: "Leasing con pagamenti anticipati" },
    objetivo: {
      pt: "A parcela mensal de um leasing de 750 por 12 meses, com 3 pagamentos feitos no fechamento do contrato, para render 10% ao ano ao arrendador.",
      it: "La rata mensile di un leasing di 750 per 12 mesi, con 3 pagamenti fatti alla chiusura del contratto, per rendere il 10% annuo al locatore.",
    },
    tags: ["financeiro", "finanziario", "leasing", "antecipado", "anticipato", "arrendador", "locatore", "parcela", "rata"],
    linhas: [
      { keys: ["g", "END"], display: "0.00", nota: { pt: "Pagamentos no fim do período (base do cálculo).", it: "Pagamenti a fine periodo (base del calcolo)." } },
      { keys: ["f", "FIN"], display: "0.00", nota: { pt: "Limpa os registradores financeiros.", it: "Pulisce i registri finanziari." } },
      { keys: ["12", "ENTER"], display: "12.00", nota: { pt: "Duração do contrato: 12 meses.", it: "Durata del contratto: 12 mesi." } },
      { keys: ["3", "STO", "0", "-", "n"], display: "9.00", nota: { pt: "12 − 3 pagamentos antecipados = 9 parcelas periódicas normais (n).", it: "12 − 3 pagamenti anticipati = 9 rate periodiche normali (n)." } },
      { keys: ["10", "g", "12÷"], display: "0.83", nota: { pt: "10% ÷ 12 = 0,83% ao mês (i).", it: "10% ÷ 12 = 0,83% al mese (i)." } },
      { keys: ["1", "CHS", "PMT"], display: "-1.00", nota: { pt: "Parcela unitária de −1 (para achar o fator do fluxo).", it: "Rata unitaria di −1 (per trovare il fattore del flusso)." } },
      { keys: ["PV", "RCL", "0", "+"], display: "11.64", nota: { pt: "Fator de valor presente da parcela unitária, + os 3 pagamentos antecipados.", it: "Fattore di valore attuale della rata unitaria, + i 3 pagamenti anticipati." } },
      { keys: ["750", "x≷y", "÷"], display: "64.45", nota: { pt: "750 ÷ o fator → parcela mensal necessária: 64,45.", it: "750 ÷ il fattore → rata mensile necessaria: 64,45." } },
    ],
  },
  {
    nome: "p157 — Nominal → effective rate (5.25% compounded quarterly) = 5.35%",
    modo: "rpn",
    titulo: { pt: "Taxa nominal → taxa efetiva (trimestral)", it: "Tasso nominale → tasso effettivo (trimestrale)" },
    objetivo: {
      pt: "Converter uma taxa nominal de 5,25% ao ano, capitalizada trimestralmente, na taxa efetiva anual equivalente.",
      it: "Convertire un tasso nominale del 5,25% annuo, capitalizzato trimestralmente, nel tasso effettivo annuo equivalente.",
    },
    tags: ["financeiro", "finanziario", "taxa", "tasso", "nominal", "nominale", "efetiva", "effettivo", "trimestral", "trimestrale"],
    linhas: [
      { keys: ["g", "END"], display: "0.00", nota: { pt: "Pagamentos no fim do período.", it: "Pagamenti a fine periodo." } },
      { keys: ["f", "FIN"], display: "0.00", nota: { pt: "Limpa os registradores financeiros.", it: "Pulisce i registri finanziari." } },
      { keys: ["5.25", "ENTER"], display: "5.25", nota: { pt: "Taxa nominal anual: 5,25%.", it: "Tasso nominale annuo: 5,25%." } },
      { keys: ["4", "n", "÷", "i"], display: "1.31", nota: { pt: "÷4 trimestres → 1,31% ao trimestre (i).", it: "÷4 trimestri → 1,31% al trimestre (i)." } },
      { keys: ["100", "CHS", "PV"], display: "-100.00", nota: { pt: "Base de cálculo: guarda −100 como valor presente (PV).", it: "Base di calcolo: memorizza −100 come valore attuale (PV)." } },
      { keys: ["FV"], display: "105.35", nota: { pt: "FV após 4 trimestres: 105,35 (100 investidos viraram 105,35).", it: "FV dopo 4 trimestri: 105,35 (100 investiti sono diventati 105,35)." } },
      { keys: ["100", "-"], display: "5.35", nota: { pt: "105,35 − 100 → taxa efetiva anual: 5,35%.", it: "105,35 − 100 → tasso effettivo annuo: 5,35%." } },
    ],
  },
  {
    nome: "p159 — Nominal → continuous effective rate (5.25% passbook) = 5.39%",
    modo: "rpn",
    titulo: { pt: "Taxa nominal → taxa efetiva contínua", it: "Tasso nominale → tasso effettivo continuo" },
    objetivo: {
      pt: "Converter uma taxa nominal de 5,25% na taxa efetiva anual equivalente, supondo capitalização CONTÍNUA (não discreta).",
      it: "Convertire un tasso nominale del 5,25% nel tasso effettivo annuo equivalente, supponendo capitalizzazione CONTINUA (non discreta).",
    },
    tags: ["financeiro", "finanziario", "taxa", "tasso", "contínua", "continuo", "efetiva", "effettivo", "e^x", "poupança", "risparmio"],
    linhas: [
      { keys: ["1", "ENTER", "5.25", "%"], display: "0.05", nota: { pt: "5,25% de 1 = 0,0525 (a taxa nominal em decimal).", it: "5,25% di 1 = 0,0525 (il tasso nominale in decimale)." } },
      { keys: ["g", "e^x"], display: "1.05", nota: { pt: "e^0,0525 = 1,0539 (fator de crescimento contínuo em 1 ano).", it: "e^0,0525 = 1,0539 (fattore di crescita continua in 1 anno)." } },
      { keys: ["Δ%"], display: "5.39", nota: { pt: "Δ% de 1 para 1,0539 → taxa efetiva contínua: 5,39%.", it: "Δ% da 1 a 1,0539 → tasso effettivo continuo: 5,39%." } },
    ],
  },
];
