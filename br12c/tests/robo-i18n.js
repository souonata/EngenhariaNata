// i18n da UI do robô do guia — AUTOCONTIDO (não importa ../../src/core, que dá
// 404 em produção; ver chrome-boot.js). Só as strings da "moldura"; o conteúdo
// didático (objetivo/notas/títulos) vem das fixtures, também bilíngue.
//
// Idioma segue a preferência do portfólio: sessionStorage "engnata_idioma"
// ("pt-BR"/"it-IT"), padrão "it-IT" — igual aos demais apps.

const KEY = "engnata_idioma";

const DIC = {
  "pt-BR": {
    titulo: "🤖 Robô do guia",
    voltar: "← Calculadora",
    velocidade: "Velocidade",
    modoLabel: "Modo",
    auto: "Automático",
    manual: "Manual",
    tocar: "▶ Tocar",
    tocarTudo: "▶▶ Tocar tudo",
    parar: "⏹ Parar",
    reiniciar: "↻ Reiniciar",
    proximaTecla: "Próxima tecla →",
    proximaLinha: "Próxima linha ⤵",
    busca: "Buscar exemplo, tópico, tecla…",
    objetivoLabel: "🎯 Objetivo",
    semObjetivo: "Selecione um exemplo na árvore ao lado.",
    selecioneTitulo: "Robô do guia HP 12C",
    selecioneTexto: "Escolha um exemplo na árvore à esquerda e toque automaticamente ou avance tecla a tecla. O painel mostra o objetivo do cálculo e o que cada linha faz.",
    proxima: "próxima",
    pressionar: "pressionar",
    fim: "fim do exemplo",
    tudoCerto: "✓ tudo certo",
    comFalhas: "✗ com falhas",
    esperado: "esp.",
    tocando: "tocando…",
    parado: "parado",
    pronto: "pronto",
    semResultados: "Nenhum exemplo encontrado.",
    passo: "Passo",
    de: "de",
    dica: "Dica: use a busca para achar pela aplicação (ex.: “hipoteca”, “depreciação”, “juros”).",
  },
  "it-IT": {
    titulo: "🤖 Robot della guida",
    voltar: "← Calcolatrice",
    velocidade: "Velocità",
    modoLabel: "Modalità",
    auto: "Automatico",
    manual: "Manuale",
    tocar: "▶ Riproduci",
    tocarTudo: "▶▶ Riproduci tutto",
    parar: "⏹ Ferma",
    reiniciar: "↻ Riavvia",
    proximaTecla: "Tasto successivo →",
    proximaLinha: "Riga successiva ⤵",
    busca: "Cerca esempio, argomento, tasto…",
    objetivoLabel: "🎯 Obiettivo",
    semObjetivo: "Seleziona un esempio nell'albero a lato.",
    selecioneTitulo: "Robot della guida HP 12C",
    selecioneTexto: "Scegli un esempio nell'albero a sinistra e riproduci in automatico o avanza tasto per tasto. Il pannello mostra l'obiettivo del calcolo e cosa fa ogni riga.",
    proxima: "prossimo",
    pressionar: "premere",
    fim: "fine dell'esempio",
    tudoCerto: "✓ tutto ok",
    comFalhas: "✗ con errori",
    esperado: "atteso",
    tocando: "in riproduzione…",
    parado: "fermato",
    pronto: "pronto",
    semResultados: "Nessun esempio trovato.",
    passo: "Passo",
    de: "di",
    dica: "Suggerimento: usa la ricerca per trovare per applicazione (es.: “mutuo”, “ammortamento”, “interessi”).",
  },
};

export function lerIdioma() {
  try {
    const s = sessionStorage.getItem(KEY);
    if (DIC[s]) return s;
  } catch (e) {
    /* sessão indisponível */
  }
  return "it-IT";
}

export function salvarIdioma(id) {
  try {
    sessionStorage.setItem(KEY, id);
  } catch (e) {
    /* sessão indisponível */
  }
}

// t(idioma, chave) com fallback para it-IT (e para a própria chave se faltar).
export function t(idioma, chave) {
  return (DIC[idioma] && DIC[idioma][chave]) || DIC["it-IT"][chave] || chave;
}

// Resolve um campo bilíngue {pt,it} do conteúdo (objetivo/nota/titulo), com
// degradação: idioma pedido → o outro idioma → fallback informado → "".
export function bi(campo, idioma, fallback = "") {
  if (!campo) return fallback;
  if (typeof campo === "string") return campo;
  const outro = idioma === "it-IT" ? "pt-BR" : "it-IT";
  const cur = idioma === "it-IT" ? "it" : "pt";
  const alt = idioma === "it-IT" ? "pt" : "it";
  return campo[cur] || campo[alt] || campo[outro] || fallback;
}
