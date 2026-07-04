// Manual do proprietário — Seção 4 (Additional Financial Functions, p.58-69).
// NPV/IRR (fluxos avulsos e agrupados, revisão e alteração de fluxos), bonds
// (preço e rendimento) e depreciação. Campos didáticos bilíngues {pt,it}.

export const handbookSecao4 = [
  {
    nome: "p58-59 — NPV (ungrouped cash flows): duplex $80,000/13% = 212.18",
    modo: "rpn",
    titulo: { pt: "VPL (NPV) — fluxos avulsos", it: "VAN (NPV) — flussi singoli" },
    objetivo: {
      pt: "Vale a pena comprar um duplex para alugar? O VPL traz os fluxos futuros a valor de hoje a 13% e compara com o investimento de 80.000.",
      it: "Conviene comprare un duplex da affittare? Il VAN attualizza i flussi futuri al 13% e li confronta con l'investimento di 80.000.",
    },
    tags: ["financeiro", "finanziario", "npv", "vpl", "van", "fluxo de caixa", "flusso di cassa", "investimento", "duplex"],
    linhas: [
      { keys: ["f", "REG"], display: "0.00", nota: { pt: "Zera os registradores financeiros e de armazenamento.", it: "Azzera i registri finanziari e di memoria." } },
      { keys: ["80000", "CHS", "g", "CFo"], display: "-80,000.00", nota: { pt: "Investimento inicial: −80.000 (CF0, saída).", it: "Investimento iniziale: −80.000 (CF0, uscita)." } },
      { keys: ["500", "CHS", "g", "CFj"], display: "-500.00", nota: { pt: "Ano 1: −500 (despesa).", it: "Anno 1: −500 (spesa)." } },
      { keys: ["4500", "g", "CFj"], display: "4,500.00", nota: { pt: "Ano 2: +4.500.", it: "Anno 2: +4.500." } },
      { keys: ["5500", "g", "CFj"], display: "5,500.00", nota: { pt: "Ano 3: +5.500.", it: "Anno 3: +5.500." } },
      { keys: ["4500", "g", "CFj"], display: "4,500.00", nota: { pt: "Ano 4: +4.500.", it: "Anno 4: +4.500." } },
      { keys: ["130000", "g", "CFj"], display: "130,000.00", nota: { pt: "Ano 5: +130.000 (aluguel + venda).", it: "Anno 5: +130.000 (affitto + vendita)." } },
      { keys: ["RCL", "n"], display: "5.00", nota: { pt: "Confere: 5 fluxos cadastrados (fora o CF0).", it: "Verifica: 5 flussi inseriti (oltre a CF0)." } },
      { keys: ["13", "i"], display: "13.00", nota: { pt: "Retorno desejado: 13% ao ano (i).", it: "Rendimento desiderato: 13% annuo (i)." } },
      { keys: ["f", "NPV"], display: "212.18", nota: { pt: "VPL = +212,18 → o negócio rende acima de 13%.", it: "VAN = +212,18 → l'affare rende oltre il 13%." } },
    ],
  },
  {
    nome: "p60-66 — NPV+IRR (grouped): $79,000/13.5%=907.77/13.72%; review CF5 + change CF2",
    modo: "rpn",
    titulo: { pt: "VPL, TIR, revisão e alteração de fluxos", it: "VAN, TIR, revisione e modifica dei flussi" },
    objetivo: {
      pt: "Um investimento com fluxos repetidos (Nj agrupa anos iguais): VPL, TIR, como revisar cada fluxo guardado e como alterar um deles depois.",
      it: "Un investimento con flussi ripetuti (Nj raggruppa anni uguali): VAN, TIR, come rivedere ogni flusso memorizzato e come modificarne uno in seguito.",
    },
    tags: ["financeiro", "finanziario", "npv", "vpl", "van", "irr", "tir", "nj", "fluxo de caixa", "flusso di cassa", "revisão", "revisione", "alterar", "modificare"],
    linhas: [
      { keys: ["f", "REG"], display: "0.00", nota: { pt: "Zera os registradores financeiros e de armazenamento.", it: "Azzera i registri finanziari e di memoria." } },
      { keys: ["79000", "CHS", "g", "CFo"], display: "-79,000.00", nota: { pt: "Investimento inicial: −79.000 (CF0).", it: "Investimento iniziale: −79.000 (CF0)." } },
      { keys: ["14000", "g", "CFj"], display: "14,000.00", nota: { pt: "Ano 1: +14.000.", it: "Anno 1: +14.000." } },
      { keys: ["11000", "g", "CFj"], display: "11,000.00", nota: { pt: "Ano 2: +11.000.", it: "Anno 2: +11.000." } },
      { keys: ["10000", "g", "CFj"], display: "10,000.00", nota: { pt: "Próximo fluxo: +10.000…", it: "Flusso seguente: +10.000…" } },
      { keys: ["3", "g", "Nj"], display: "3.00", nota: { pt: "…que se repete por 3 anos (Nj = 3): anos 3, 4 e 5.", it: "…che si ripete per 3 anni (Nj = 3): anni 3, 4 e 5." } },
      { keys: ["9100", "g", "CFj"], display: "9,100.00", nota: { pt: "Ano 6: +9.100.", it: "Anno 6: +9.100." } },
      { keys: ["9000", "g", "CFj"], display: "9,000.00", nota: { pt: "Próximo fluxo: +9.000…", it: "Flusso seguente: +9.000…" } },
      { keys: ["2", "g", "Nj"], display: "2.00", nota: { pt: "…repetido por 2 anos (Nj = 2): anos 7 e 8.", it: "…ripetuto per 2 anni (Nj = 2): anni 7 e 8." } },
      { keys: ["4500", "g", "CFj"], display: "4,500.00", nota: { pt: "Ano 9: +4.500.", it: "Anno 9: +4.500." } },
      { keys: ["100000", "g", "CFj"], display: "100,000.00", nota: { pt: "Ano 10 (último): +100.000.", it: "Anno 10 (ultimo): +100.000." } },
      { keys: ["RCL", "n"], display: "7.00", nota: { pt: "Confere: 7 grupos de fluxo cadastrados.", it: "Verifica: 7 gruppi di flusso inseriti." } },
      { keys: ["13.5", "i"], display: "13.50", nota: { pt: "Retorno desejado: 13,5% ao ano (i).", it: "Rendimento desiderato: 13,5% annuo (i)." } },
      { keys: ["f", "NPV"], display: "907.77", nota: { pt: "VPL = 907,77 (positivo, bom negócio).", it: "VAN = 907,77 (positivo, buon affare)." } },
      { keys: ["f", "IRR"], display: "13.72", nota: { pt: "TIR = 13,72% → rentabilidade real do projeto.", it: "TIR = 13,72% → redditività reale del progetto." } },
      { keys: ["RCL", "5"], display: "9,000.00", nota: { pt: "Revisão: RCL 5 mostra direto o CF5 guardado (9.000) — os fluxos ocupam os mesmos registradores R0-R9 de STO/RCL.", it: "Revisione: RCL 5 mostra direttamente il CF5 memorizzato (9.000) — i flussi occupano gli stessi registri R0-R9 di STO/RCL." } },
      // (O manual também documenta "guardar j em n, depois RCL g Nj" para
      // revisar quantas vezes o grupo j se repete — combo STO/RCL + shift
      // pendente que este emulador ainda não implementa; ficou fora daqui.)
      { keys: ["9000", "STO", "2"], display: "9,000.00", nota: { pt: "Altera o CF2 (registrador R2) de 11.000 para 9.000.", it: "Modifica il CF2 (registro R2) da 11.000 a 9.000." } },
      { keys: ["13.5", "i"], display: "13.50", nota: { pt: "Re-digita i (a TIR calculada acima o tinha sobrescrito).", it: "Ridigita i (la TIR calcolata sopra lo aveva sovrascritto)." } },
      { keys: ["f", "NPV"], display: "-644.75", nota: { pt: "Novo VPL, agora negativo: o negócio piorou.", it: "Nuovo VAN, ora negativo: l'affare è peggiorato." } },
      // (O manual segue com "Exemplo 2: mudar N5 de 2 para 4" — guardar 5 em n,
      // digitar 4, então g Nj. No calculador real isso mira o grupo indicado
      // por n; aqui g+Nj sempre edita o ÚLTIMO grupo cadastrado, então esse
      // passo específico ficou fora — é a mesma limitação do RCL g Nj acima.)
    ],
  },
  {
    nome: "p67 — Bond price: T-bond 6.75% coupon, yield 8.25%, 4/28/2004→6/4/2018 = 87.62 clean / 90.31 total",
    modo: "rpn",
    titulo: { pt: "Preço de título (bond) — rendimento 8,25%", it: "Prezzo di un'obbligazione (bond) — rendimento 8,25%" },
    objetivo: {
      pt: "Quanto pagar por um título do tesouro americano de cupom 6,75% para render 8,25% até o vencimento.",
      it: "Quanto pagare un titolo del tesoro USA con cedola 6,75% per rendere l'8,25% a scadenza.",
    },
    tags: ["financeiro", "finanziario", "bond", "título", "obbligazione", "price", "preço", "prezzo", "yield", "rendimento", "tesouro"],
    linhas: [
      { keys: ["8.25", "i"], display: "8.25", nota: { pt: "Rendimento desejado: 8,25% (i).", it: "Rendimento desiderato: 8,25% (i)." } },
      { keys: ["6.75", "PMT"], display: "6.75", nota: { pt: "Cupom anual do título: 6,75% (PMT).", it: "Cedola annua del titolo: 6,75% (PMT)." } },
      { keys: ["g", "M.DY"], display: "6.75", nota: { pt: "Formato de data mês.dia.ano.", it: "Formato data mese.giorno.anno." } },
      { keys: ["4.282004", "ENTER"], display: "4.28", nota: { pt: "Data de liquidação: 28 abr 2004.", it: "Data di regolamento: 28 apr 2004." } },
      { keys: ["6.042018"], display: "6.042018", nota: { pt: "Data de vencimento: 4 jun 2018.", it: "Data di scadenza: 4 giu 2018." } },
      { keys: ["f", "PRICE"], display: "87.62", nota: { pt: "Preço limpo: 87,62 (% do valor de face).", it: "Prezzo pulito: 87,62 (% del valore nominale)." } },
      { keys: ["+"], display: "90.31", nota: { pt: "Soma os juros acruados → preço total 90,31.", it: "Aggiunge il rateo → prezzo totale 90,31." } },
    ],
  },
  {
    nome: "p68 — Bond yield: quoted price 88 3/8%, coupon 6.75%, 4/28/2003→6/4/2017 = 8.15",
    modo: "rpn",
    titulo: { pt: "Rendimento de título (YTM) — cotação 88 3/8%", it: "Rendimento di un'obbligazione (YTM) — quotazione 88 3/8%" },
    objetivo: {
      pt: "Qual o rendimento até o vencimento de um título de cupom 6,75% cotado a 88 3/8% do valor de face.",
      it: "Qual è il rendimento a scadenza di un titolo con cedola 6,75% quotato al 88 3/8% del valore nominale.",
    },
    tags: ["financeiro", "finanziario", "bond", "título", "obbligazione", "ytm", "yield", "rendimento", "fração", "frazione"],
    linhas: [
      { keys: ["3", "ENTER", "8", "÷"], display: "0.38", nota: { pt: "Calcula a fração 3/8 = 0,375 (arredondado para 0,38 no display).", it: "Calcola la frazione 3/8 = 0,375 (arrotondato a 0,38 nel display)." } },
      { keys: ["88", "+", "PV"], display: "88.38", nota: { pt: "88 + 3/8 = 88,375% → cotação (PV).", it: "88 + 3/8 = 88,375% → quotazione (PV)." } },
      { keys: ["6.75", "PMT"], display: "6.75", nota: { pt: "Cupom anual: 6,75% (PMT).", it: "Cedola annua: 6,75% (PMT)." } },
      { keys: ["4.282003", "ENTER"], display: "4.28", nota: { pt: "Data de liquidação: 28 abr 2003.", it: "Data di regolamento: 28 apr 2003." } },
      { keys: ["6.042017"], display: "6.042017", nota: { pt: "Data de vencimento: 4 jun 2017.", it: "Data di scadenza: 4 giu 2017." } },
      { keys: ["f", "YTM"], display: "8.15", nota: { pt: "Rendimento até o vencimento: 8,15%.", it: "Rendimento a scadenza: 8,15%." } },
    ],
  },
  {
    nome: "p69 — Depreciation (200% declining-balance, $10k machine, 3 years)",
    modo: "rpn",
    titulo: { pt: "Depreciação (saldo decrescente 200%)", it: "Ammortamento (saldo decrescente 200%)" },
    objetivo: {
      pt: "Depreciar uma máquina de 10.000 (valor residual 500, vida 5 anos) pelo método do saldo decrescente em dobro (DB 200%), ano a ano.",
      it: "Ammortizzare un macchinario di 10.000 (valore residuo 500, vita 5 anni) col metodo del saldo decrescente doppio (DB 200%), anno per anno.",
    },
    tags: ["financeiro", "finanziario", "depreciação", "ammortamento", "db", "saldo decrescente", "máquina", "macchinario"],
    linhas: [
      { keys: ["10000", "PV"], display: "10,000.00", nota: { pt: "Valor de compra: 10.000 (PV).", it: "Valore d'acquisto: 10.000 (PV)." } },
      { keys: ["500", "FV"], display: "500.00", nota: { pt: "Valor residual: 500 (FV).", it: "Valore residuo: 500 (FV)." } },
      { keys: ["5", "n"], display: "5.00", nota: { pt: "Vida útil: 5 anos (n).", it: "Vita utile: 5 anni (n)." } },
      { keys: ["200", "i"], display: "200.00", nota: { pt: "Fator do método: 200% (saldo decrescente em dobro).", it: "Fattore del metodo: 200% (saldo decrescente doppio)." } },
      { keys: ["1", "f", "DB"], display: "4,000.00", nota: { pt: "Ano 1: depreciação de 4.000.", it: "Anno 1: ammortamento di 4.000." } },
      { keys: ["x≷y"], display: "5,500.00", nota: { pt: "Valor contábil restante: 5.500.", it: "Valore contabile residuo: 5.500." } },
      { keys: ["2", "f", "DB"], display: "2,400.00", nota: { pt: "Ano 2: depreciação de 2.400.", it: "Anno 2: ammortamento di 2.400." } },
      { keys: ["x≷y"], display: "3,100.00", nota: { pt: "Restante: 3.100.", it: "Residuo: 3.100." } },
      { keys: ["3", "f", "DB"], display: "1,440.00", nota: { pt: "Ano 3: depreciação de 1.440.", it: "Anno 3: ammortamento di 1.440." } },
      { keys: ["x≷y"], display: "1,660.00", nota: { pt: "Restante: 1.660.", it: "Residuo: 1.660." } },
    ],
  },
];
