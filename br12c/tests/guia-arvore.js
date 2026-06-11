// Árvore de conteúdo do robô do guia: hierarquia Parte → Seção → exemplos, com
// títulos bilíngues. Detém os imports das fixtures (única fonte de verdade dos
// exemplos, compartilhada com a suíte Vitest). Tudo sob br12c/tests/ é copiado
// verbatim no deploy, então estes imports relativos funcionam em produção.

import { secao1 } from "./fixtures/secao-1.js";
import { secao2Percentual, secao2Calendario } from "./fixtures/secao-2.js";
import { secao3 } from "./fixtures/secao-3.js";
import { secao4 } from "./fixtures/secao-4.js";
import { secao5 } from "./fixtures/secao-5.js";
import { secao6 } from "./fixtures/secao-6.js";
import { secao7, apendiceA, apendiceB, apendiceC, apendiceF } from "./fixtures/extras.js";
import { programa } from "./fixtures/programa.js";
import { solucoes } from "./fixtures/solucoes.js";
import { erros } from "./fixtures/erros.js";

// Estrutura espelhando o índice do User Guide (HP 12C Platinum).
// titulo: bilíngue {pt,it}. As folhas vêm de cada array de fixture.
export const arvore = [
  {
    titulo: { pt: "Parte I — Resolução de problemas", it: "Parte I — Risoluzione di problemi" },
    secoes: [
      { titulo: { pt: "Seção 1 · Primeiros passos", it: "Sezione 1 · Per iniziare" }, exemplos: secao1 },
      { titulo: { pt: "Seção 2 · Porcentagem", it: "Sezione 2 · Percentuale" }, exemplos: secao2Percentual },
      { titulo: { pt: "Seção 2 · Calendário", it: "Sezione 2 · Calendario" }, exemplos: secao2Calendario },
      { titulo: { pt: "Seção 3 · Funções financeiras básicas", it: "Sezione 3 · Funzioni finanziarie di base" }, exemplos: secao3 },
      { titulo: { pt: "Seção 4 · Funções financeiras avançadas", it: "Sezione 4 · Funzioni finanziarie avanzate" }, exemplos: secao4 },
      { titulo: { pt: "Seção 5 · Recursos operacionais", it: "Sezione 5 · Funzioni operative" }, exemplos: secao5 },
      { titulo: { pt: "Seção 6 · Estatística", it: "Sezione 6 · Statistica" }, exemplos: secao6 },
      { titulo: { pt: "Seção 7 · Matemática", it: "Sezione 7 · Matematica" }, exemplos: secao7 },
    ],
  },
  {
    titulo: { pt: "Parte II — Programação", it: "Parte II — Programmazione" },
    secoes: [
      { titulo: { pt: "Seções 8–11 · Programas", it: "Sezioni 8–11 · Programmi" }, exemplos: programa },
    ],
  },
  {
    titulo: { pt: "Parte III — Soluções", it: "Parte III — Soluzioni" },
    secoes: [
      { titulo: { pt: "Seções 12–16 · Aplicações reais", it: "Sezioni 12–16 · Applicazioni reali" }, exemplos: solucoes },
    ],
  },
  {
    titulo: { pt: "Apêndices", it: "Appendici" },
    secoes: [
      { titulo: { pt: "A · RPN e a pilha", it: "A · RPN e lo stack" }, exemplos: apendiceA },
      { titulo: { pt: "B · Modo algébrico (ALG)", it: "B · Modalità algebrica (ALG)" }, exemplos: apendiceB },
      { titulo: { pt: "C · Mais sobre IRR", it: "C · Altro sull'IRR" }, exemplos: apendiceC },
      { titulo: { pt: "D · Condições de erro", it: "D · Condizioni di errore" }, exemplos: erros },
      { titulo: { pt: "F · Autoteste do teclado", it: "F · Autotest della tastiera" }, exemplos: apendiceF },
    ],
  },
];

// Lista plana na MESMA ordem de varredura usada na renderização da árvore, com
// índices estáveis. Cada item ganha refs _parte/_sec para destaque/contexto.
export function achatar() {
  const out = [];
  for (const parte of arvore) {
    for (const sec of parte.secoes) {
      for (const ex of sec.exemplos) {
        out.push(Object.assign({}, ex, { _parte: parte, _sec: sec }));
      }
    }
  }
  return out;
}

// minúsculas + sem acento (NFD) para busca tolerante.
export function normaliza(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Filtro AND por termo, sobre nome + titulo(pt/it) + objetivo(pt/it) + tags,
// nos DOIS idiomas (um termo em PT acha mesmo com a UI em IT e vice-versa).
export function casa(ex, filtro) {
  const alvo = normaliza(filtro).trim();
  if (!alvo) return true;
  const campos = [
    ex.nome,
    ex.titulo && ex.titulo.pt,
    ex.titulo && ex.titulo.it,
    ex.objetivo && ex.objetivo.pt,
    ex.objetivo && ex.objetivo.it,
    ...(ex.tags || []),
  ];
  const palheiro = normaliza(campos.filter(Boolean).join(" "));
  return alvo.split(/\s+/).every((termo) => palheiro.includes(termo));
}
