// Capítulo 6 — Seção 6 (Statistics). Média, desvio-padrão e média ponderada.
// Campos didáticos (titulo/objetivo/tags/nota) bilíngues {pt,it}.

export const secao6 = [
  {
    nome: "p95-96 — Mean and standard deviation (7 salespersons)",
    modo: "rpn",
    titulo: { pt: "Média e desvio-padrão", it: "Media e deviazione standard" },
    objetivo: {
      pt: "Resumir os dados de 7 vendedores (idade e vendas): a média e o desvio-padrão de cada variável.",
      it: "Riassumere i dati di 7 venditori (età e vendite): la media e la deviazione standard di ogni variabile.",
    },
    tags: ["estatística", "statistica", "média", "media", "desvio-padrão", "deviazione standard", "Σ+", "dados", "dati"],
    linhas: [
      { keys: ["f", "Σ"], display: "0.00", nota: { pt: "Zera os registradores de estatística.", it: "Azzera i registri statistici." } },
      { keys: ["32", "ENTER", "17000", "Σ+"], display: "1.00", nota: { pt: "1º par (idade 32, venda 17.000): n = 1.", it: "1ª coppia (età 32, vendita 17.000): n = 1." } },
      { keys: ["40", "ENTER", "25000", "Σ+"], display: "2.00", nota: { pt: "2º par: n = 2.", it: "2ª coppia: n = 2." } },
      { keys: ["45", "ENTER", "26000", "Σ+"], display: "3.00", nota: { pt: "3º par: n = 3.", it: "3ª coppia: n = 3." } },
      { keys: ["40", "ENTER", "20000", "Σ+"], display: "4.00", nota: { pt: "4º par: n = 4.", it: "4ª coppia: n = 4." } },
      { keys: ["38", "ENTER", "21000", "Σ+"], display: "5.00", nota: { pt: "5º par: n = 5.", it: "5ª coppia: n = 5." } },
      { keys: ["50", "ENTER", "28000", "Σ+"], display: "6.00", nota: { pt: "6º par: n = 6.", it: "6ª coppia: n = 6." } },
      { keys: ["35", "ENTER", "15000", "Σ+"], display: "7.00", nota: { pt: "7º par: n = 7.", it: "7ª coppia: n = 7." } },
      { keys: ["g", "x̄"], display: "21,714.29", nota: { pt: "Média das vendas: 21.714,29.", it: "Media delle vendite: 21.714,29." } },
      { keys: ["x≷y"], display: "40.00", nota: { pt: "Média das idades: 40.", it: "Media delle età: 40." } },
      { keys: ["g", "s"], display: "4,820.59", nota: { pt: "Desvio-padrão das vendas: 4.820,59.", it: "Deviazione standard delle vendite: 4.820,59." } },
      { keys: ["x≷y"], display: "6.03", nota: { pt: "Desvio-padrão das idades: 6,03.", it: "Deviazione standard delle età: 6,03." } },
    ],
  },
  {
    nome: "p99 — Weighted mean (gasoline) = 1.19",
    modo: "rpn",
    titulo: { pt: "Média ponderada (gasolina)", it: "Media ponderata (benzina)" },
    objetivo: {
      pt: "O preço médio do litro quando se compra em quantidades diferentes a preços diferentes (média ponderada).",
      it: "Il prezzo medio al litro comprando quantità diverse a prezzi diversi (media ponderata).",
    },
    tags: ["estatística", "statistica", "média ponderada", "media ponderata", "x̄w", "peso", "preço", "prezzo"],
    linhas: [
      { keys: ["f", "Σ"], display: "0.00", nota: { pt: "Zera os registradores de estatística.", it: "Azzera i registri statistici." } },
      { keys: ["1.16", "ENTER", "15", "Σ+"], display: "1.00", nota: { pt: "Preço 1,16 com peso 15 litros.", it: "Prezzo 1,16 con peso 15 litri." } },
      { keys: ["1.24", "ENTER", "7", "Σ+"], display: "2.00", nota: { pt: "Preço 1,24 com peso 7 litros.", it: "Prezzo 1,24 con peso 7 litri." } },
      { keys: ["1.2", "ENTER", "10", "Σ+"], display: "3.00", nota: { pt: "Preço 1,20 com peso 10 litros.", it: "Prezzo 1,20 con peso 10 litri." } },
      { keys: ["1.18", "ENTER", "17", "Σ+"], display: "4.00", nota: { pt: "Preço 1,18 com peso 17 litros.", it: "Prezzo 1,18 con peso 17 litri." } },
      { keys: ["g", "x̄w"], display: "1.19", nota: { pt: "Preço médio ponderado: 1,19.", it: "Prezzo medio ponderato: 1,19." } },
    ],
  },
  {
    nome: "p97-98 — Linear estimation: x̂, correlation r and intercept",
    modo: "rpn",
    titulo: { pt: "Estimativa linear e correlação", it: "Stima lineare e correlazione" },
    objetivo: {
      pt: "Prever um valor por regressão linear (x̂) e medir o quanto as variáveis se relacionam (correlação r).",
      it: "Prevedere un valore con la regressione lineare (x̂) e misurare quanto le variabili sono correlate (correlazione r).",
    },
    tags: ["estatística", "statistica", "regressão", "regressione", "correlação", "correlazione", "estimativa", "stima", "x̂", "r"],
    linhas: [
      { keys: ["f", "Σ"], display: "0.00", nota: { pt: "Zera os registradores de estatística.", it: "Azzera i registri statistici." } },
      { keys: ["32", "ENTER", "17000", "Σ+"], display: "1.00", nota: { pt: "Insere os 7 pares (idade, venda): par 1.", it: "Inserisce le 7 coppie (età, vendita): coppia 1." } },
      { keys: ["40", "ENTER", "25000", "Σ+"], display: "2.00", nota: { pt: "Par 2.", it: "Coppia 2." } },
      { keys: ["45", "ENTER", "26000", "Σ+"], display: "3.00", nota: { pt: "Par 3.", it: "Coppia 3." } },
      { keys: ["40", "ENTER", "20000", "Σ+"], display: "4.00", nota: { pt: "Par 4.", it: "Coppia 4." } },
      { keys: ["38", "ENTER", "21000", "Σ+"], display: "5.00", nota: { pt: "Par 5.", it: "Coppia 5." } },
      { keys: ["50", "ENTER", "28000", "Σ+"], display: "6.00", nota: { pt: "Par 6.", it: "Coppia 6." } },
      { keys: ["35", "ENTER", "15000", "Σ+"], display: "7.00", nota: { pt: "Par 7 (todos inseridos).", it: "Coppia 7 (tutte inserite)." } },
      { keys: ["48", "g", "x̂,r"], display: "28,818.93", nota: { pt: "Estima a venda para idade 48: 28.818,93.", it: "Stima la vendita per età 48: 28.818,93." } },
      { keys: ["x≷y"], display: "0.90", nota: { pt: "Correlação r = 0,90 (forte).", it: "Correlazione r = 0,90 (forte)." } },
      { keys: ["0", "g", "ŷ,r"], display: "15.55", nota: { pt: "Estima a idade para venda 0 (intercepto): 15,55.", it: "Stima l'età per vendita 0 (intercetta): 15,55." } },
    ],
  },
];
