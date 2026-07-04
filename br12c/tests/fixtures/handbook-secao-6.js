// Manual do proprietário — Seção 6 (Statistics Functions, p.76-81).
// Média, desvio-padrão (amostra e população), estimativa linear + reta de
// regressão (intercepto e inclinação) e média ponderada.
// Campos didáticos bilíngues {pt,it}.

export const handbookSecao6 = [
  {
    nome: "p76-78 — Mean and sample standard deviation: 7 salespersons (hours worked vs monthly sales)",
    modo: "rpn",
    titulo: { pt: "Média e desvio-padrão (amostra)", it: "Media e deviazione standard (campione)" },
    objetivo: {
      pt: "Resumir os dados de 7 vendedores (horas trabalhadas por semana e vendas mensais): a média e o desvio-padrão de cada variável.",
      it: "Riassumere i dati di 7 venditori (ore lavorate a settimana e vendite mensili): la media e la deviazione standard di ogni variabile.",
    },
    tags: ["estatística", "statistica", "média", "media", "desvio-padrão", "deviazione standard", "Σ+", "dados", "dati", "vendedores", "venditori"],
    linhas: [
      { keys: ["f", "Σ"], display: "0.00", nota: { pt: "Zera os registradores de estatística.", it: "Azzera i registri statistici." } },
      { keys: ["32", "ENTER", "17000", "Σ+"], display: "1.00", nota: { pt: "1º vendedor: 32h/semana, 17.000 em vendas.", it: "1° venditore: 32h/settimana, 17.000 di vendite." } },
      { keys: ["40", "ENTER", "25000", "Σ+"], display: "2.00", nota: { pt: "2º vendedor: 40h, 25.000.", it: "2° venditore: 40h, 25.000." } },
      { keys: ["45", "ENTER", "26000", "Σ+"], display: "3.00", nota: { pt: "3º vendedor: 45h, 26.000.", it: "3° venditore: 45h, 26.000." } },
      { keys: ["40", "ENTER", "20000", "Σ+"], display: "4.00", nota: { pt: "4º vendedor: 40h, 20.000.", it: "4° venditore: 40h, 20.000." } },
      { keys: ["38", "ENTER", "21000", "Σ+"], display: "5.00", nota: { pt: "5º vendedor: 38h, 21.000.", it: "5° venditore: 38h, 21.000." } },
      { keys: ["50", "ENTER", "28000", "Σ+"], display: "6.00", nota: { pt: "6º vendedor: 50h, 28.000.", it: "6° venditore: 50h, 28.000." } },
      { keys: ["35", "ENTER", "15000", "Σ+"], display: "7.00", nota: { pt: "7º vendedor: 35h, 15.000 (últimos dados).", it: "7° venditore: 35h, 15.000 (ultimi dati)." } },
      { keys: ["g", "x̄"], display: "21,714.29", nota: { pt: "Média das vendas mensais: 21.714,29.", it: "Media delle vendite mensili: 21.714,29." } },
      { keys: ["x≷y"], display: "40.00", nota: { pt: "Média das horas trabalhadas: 40.", it: "Media delle ore lavorate: 40." } },
      { keys: ["g", "s"], display: "4,820.59", nota: { pt: "Desvio-padrão (amostra) das vendas: 4.820,59.", it: "Deviazione standard (campione) delle vendite: 4.820,59." } },
      { keys: ["x≷y"], display: "6.03", nota: { pt: "Desvio-padrão (amostra) das horas: 6,03.", it: "Deviazione standard (campione) delle ore: 6,03." } },
    ],
  },
  {
    nome: "p77 — Population standard deviation (σ): fold the mean back in as an 8th point",
    modo: "rpn",
    titulo: { pt: "Desvio-padrão populacional (σ)", it: "Deviazione standard della popolazione (σ)" },
    objetivo: {
      pt: "Se os 7 vendedores fossem TODA a população (não uma amostra), um truque com a própria média dá o desvio-padrão populacional exato.",
      it: "Se i 7 venditori fossero TUTTA la popolazione (non un campione), un trucco con la media stessa dà la deviazione standard della popolazione esatta.",
    },
    tags: ["estatística", "statistica", "desvio-padrão", "deviazione standard", "população", "popolazione", "sigma", "σ"],
    linhas: [
      { keys: ["f", "Σ"], display: "0.00", nota: { pt: "Zera os registradores de estatística.", it: "Azzera i registri statistici." } },
      { keys: ["32", "ENTER", "17000", "Σ+"], display: "1.00", nota: { pt: "Insere os 7 pares de novo (1º).", it: "Inserisce di nuovo le 7 coppie (1ª)." } },
      { keys: ["40", "ENTER", "25000", "Σ+"], display: "2.00", nota: { pt: "2º par.", it: "2ª coppia." } },
      { keys: ["45", "ENTER", "26000", "Σ+"], display: "3.00", nota: { pt: "3º par.", it: "3ª coppia." } },
      { keys: ["40", "ENTER", "20000", "Σ+"], display: "4.00", nota: { pt: "4º par.", it: "4ª coppia." } },
      { keys: ["38", "ENTER", "21000", "Σ+"], display: "5.00", nota: { pt: "5º par.", it: "5ª coppia." } },
      { keys: ["50", "ENTER", "28000", "Σ+"], display: "6.00", nota: { pt: "6º par.", it: "6ª coppia." } },
      { keys: ["35", "ENTER", "15000", "Σ+"], display: "7.00", nota: { pt: "7º par (todos inseridos).", it: "7ª coppia (tutte inserite)." } },
      { keys: ["g", "x̄"], display: "21,714.29", nota: { pt: "Calcula a média das vendas — e deixa a média das horas pronta em Y.", it: "Calcola la media delle vendite — e lascia la media delle ore pronta in Y." } },
      { keys: ["Σ+"], display: "8.00", nota: { pt: "Soma a própria média como se fosse um 8º ponto (o truque).", it: "Aggiunge la media stessa come se fosse un 8° punto (il trucco)." } },
      { keys: ["g", "s"], display: "4,463.00", nota: { pt: "Agora o resultado É o desvio-padrão populacional das vendas: σ = 4.463.", it: "Ora il risultato È la deviazione standard della popolazione delle vendite: σ = 4.463." } },
      { keys: ["x≷y"], display: "5.58", nota: { pt: "σ das horas trabalhadas: 5,58.", it: "σ delle ore lavorate: 5,58." } },
    ],
  },
  {
    nome: "p78 — Linear estimation (ŷ) and correlation r: 48-hour salesperson → $28,818.93, r=0.90",
    modo: "rpn",
    titulo: { pt: "Estimativa linear e correlação", it: "Stima lineare e correlazione" },
    objetivo: {
      pt: "Prever a venda de um vendedor de 48h/semana por regressão linear (ŷ), e medir a confiabilidade da estimativa (correlação r).",
      it: "Prevedere la vendita di un venditore di 48h/settimana con la regressione lineare (ŷ), e misurare l'affidabilità della stima (correlazione r).",
    },
    tags: ["estatística", "statistica", "regressão", "regressione", "correlação", "correlazione", "estimativa", "stima", "ŷ", "r"],
    linhas: [
      { keys: ["f", "Σ"], display: "0.00", nota: { pt: "Zera os registradores de estatística.", it: "Azzera i registri statistici." } },
      { keys: ["32", "ENTER", "17000", "Σ+"], display: "1.00", nota: { pt: "Insere os 7 pares (horas, venda): par 1.", it: "Inserisce le 7 coppie (ore, vendita): coppia 1." } },
      { keys: ["40", "ENTER", "25000", "Σ+"], display: "2.00", nota: { pt: "Par 2.", it: "Coppia 2." } },
      { keys: ["45", "ENTER", "26000", "Σ+"], display: "3.00", nota: { pt: "Par 3.", it: "Coppia 3." } },
      { keys: ["40", "ENTER", "20000", "Σ+"], display: "4.00", nota: { pt: "Par 4.", it: "Coppia 4." } },
      { keys: ["38", "ENTER", "21000", "Σ+"], display: "5.00", nota: { pt: "Par 5.", it: "Coppia 5." } },
      { keys: ["50", "ENTER", "28000", "Σ+"], display: "6.00", nota: { pt: "Par 6.", it: "Coppia 6." } },
      { keys: ["35", "ENTER", "15000", "Σ+"], display: "7.00", nota: { pt: "Par 7 (todos inseridos).", it: "Coppia 7 (tutte inserite)." } },
      { keys: ["48", "g", "x̂,r"], display: "28,818.93", nota: { pt: "Estima a venda de quem trabalha 48h: 28.818,93.", it: "Stima la vendita di chi lavora 48h: 28.818,93." } },
      { keys: ["x≷y"], display: "0.90", nota: { pt: "Correlação r = 0,90 (perto de 1 → estimativa confiável).", it: "Correlazione r = 0,90 (vicino a 1 → stima affidabile)." } },
    ],
  },
  {
    nome: "p78-80 — Regression line intercept (A) and slope (B): y = 15.55 + 0.001x",
    modo: "rpn",
    titulo: { pt: "Reta de regressão: intercepto e inclinação", it: "Retta di regressione: intercetta e pendenza" },
    objetivo: {
      pt: "Montar a equação da reta de regressão (y = A + Bx) a partir dos mesmos dados: o intercepto (venda esperada com 0h) e a inclinação (efeito de 1h extra).",
      it: "Costruire l'equazione della retta di regressione (y = A + Bx) dagli stessi dati: l'intercetta (vendita attesa con 0h) e la pendenza (effetto di 1h in più).",
    },
    tags: ["estatística", "statistica", "regressão", "regressione", "reta", "retta", "intercepto", "intercetta", "inclinação", "pendenza"],
    linhas: [
      { keys: ["f", "Σ"], display: "0.00", nota: { pt: "Zera os registradores de estatística.", it: "Azzera i registri statistici." } },
      { keys: ["32", "ENTER", "17000", "Σ+"], display: "1.00", nota: { pt: "Insere os 7 pares de novo: par 1.", it: "Inserisce di nuovo le 7 coppie: coppia 1." } },
      { keys: ["40", "ENTER", "25000", "Σ+"], display: "2.00", nota: { pt: "Par 2.", it: "Coppia 2." } },
      { keys: ["45", "ENTER", "26000", "Σ+"], display: "3.00", nota: { pt: "Par 3.", it: "Coppia 3." } },
      { keys: ["40", "ENTER", "20000", "Σ+"], display: "4.00", nota: { pt: "Par 4.", it: "Coppia 4." } },
      { keys: ["38", "ENTER", "21000", "Σ+"], display: "5.00", nota: { pt: "Par 5.", it: "Coppia 5." } },
      { keys: ["50", "ENTER", "28000", "Σ+"], display: "6.00", nota: { pt: "Par 6.", it: "Coppia 6." } },
      { keys: ["35", "ENTER", "15000", "Σ+"], display: "7.00", nota: { pt: "Par 7 (todos inseridos).", it: "Coppia 7 (tutte inserite)." } },
      { keys: ["0", "g", "ŷ,r"], display: "15.55", nota: { pt: "Intercepto (A): venda projetada para 0 horas.", it: "Intercetta (A): vendita prevista per 0 ore." } },
      // FIX 3 antes da subtração final: em FIX 2 (padrão) 0,001 arredondaria
      // para 0,00 — precisa de mais casas pra ver a inclinação, bem pequena.
      { keys: ["1", "g", "ŷ,r", "x≷y", "R↓", "x≷y", "f", "3", "-"], display: "0.001", nota: { pt: "Inclinação (B): quanto a venda muda por hora extra (ŷ(1) − ŷ(0)). Precisa de FIX 3 pra ver esse valor tão pequeno.", it: "Pendenza (B): quanto varia la vendita per un'ora in più (ŷ(1) − ŷ(0)). Serve FIX 3 per vedere un valore così piccolo." } },
    ],
  },
  {
    nome: "p81 — Weighted mean (gasoline, 4 stations) = 1.19",
    modo: "rpn",
    titulo: { pt: "Média ponderada (gasolina)", it: "Media ponderata (benzina)" },
    objetivo: {
      pt: "O preço médio do litro quando se compra em quantidades diferentes a preços diferentes, em 4 postos.",
      it: "Il prezzo medio al litro comprando quantità diverse a prezzi diversi, in 4 stazioni.",
    },
    tags: ["estatística", "statistica", "média ponderada", "media ponderata", "peso", "preço", "prezzo", "gasolina", "benzina"],
    linhas: [
      { keys: ["f", "Σ"], display: "0.00", nota: { pt: "Zera os registradores de estatística.", it: "Azzera i registri statistici." } },
      { keys: ["1.16", "ENTER", "15", "Σ+"], display: "1.00", nota: { pt: "Posto 1: preço 1,16, 15 litros.", it: "Stazione 1: prezzo 1,16, 15 litri." } },
      { keys: ["1.24", "ENTER", "7", "Σ+"], display: "2.00", nota: { pt: "Posto 2: preço 1,24, 7 litros.", it: "Stazione 2: prezzo 1,24, 7 litri." } },
      { keys: ["1.2", "ENTER", "10", "Σ+"], display: "3.00", nota: { pt: "Posto 3: preço 1,20, 10 litros.", it: "Stazione 3: prezzo 1,20, 10 litri." } },
      { keys: ["1.18", "ENTER", "17", "Σ+"], display: "4.00", nota: { pt: "Posto 4: preço 1,18, 17 litros.", it: "Stazione 4: prezzo 1,18, 17 litri." } },
      { keys: ["g", "x̄w"], display: "1.19", nota: { pt: "Preço médio ponderado por litro: 1,19.", it: "Prezzo medio ponderato al litro: 1,19." } },
    ],
  },
];
