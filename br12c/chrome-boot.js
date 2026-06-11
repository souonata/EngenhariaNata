// Integração do br12c ao portfólio Engenharia NATA: idioma (PT/IT), tema
// (claro/escuro) e botão home. Reaproveita os MÓDULOS compartilhados do site
// (i18n.js, theme.js) para manter as MESMAS chaves de armazenamento e o mesmo
// atributo data-theme do resto do portfólio. NÃO toca na calculadora (app.js):
// só na "moldura" (idioma/tema/rodapé), que no celular fica oculta via CSS.

import { i18n, configurarBotoesIdioma } from "../src/core/i18n.js";
import { inicializarTema } from "../src/core/theme.js";

async function boot() {
  // Tema primeiro (cria o botão Dark/Light dentro de .language-selector).
  inicializarTema();

  try {
    const res = await fetch("../src/i18n/br12c.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const traducoes = await res.json();
    // idiomaInicial = null: respeita a escolha de sessão do portfólio
    // (sessionStorage engnata_idioma) ou cai no padrão it-IT, como os demais apps.
    i18n.inicializar(traducoes, null);
    configurarBotoesIdioma();
    i18n.registrarCallback(() => {
      document.title = i18n.t("page.title");
    });
    document.title = i18n.t("page.title");
  } catch (erro) {
    // A calculadora funciona mesmo sem as traduções (rótulos ficam no texto
    // padrão do HTML). Apenas registra o problema.
    console.error("br12c: falha ao carregar traduções", erro);
  }

  configurarFadeHome();
}

// Botão home aparece em degradê ao rolar até perto do rodapé; se a página não
// rola (cabe inteira), fica sempre visível. Mesmo comportamento dos outros apps.
function configurarFadeHome() {
  const btn = document.querySelector(".home-button-fixed");
  if (!btn) return;
  const FAIXA = 150;
  const atualizar = () => {
    const doc = document.documentElement;
    const rolavel = doc.scrollHeight - window.innerHeight;
    let op;
    if (rolavel <= 4) {
      op = 1;
    } else {
      const distFundo = rolavel - window.scrollY;
      op = Math.min(1, Math.max(0, 1 - distFundo / FAIXA));
    }
    btn.style.opacity = op.toFixed(3);
    btn.style.pointerEvents = op > 0.05 ? "auto" : "none";
  };
  atualizar();
  window.addEventListener("scroll", atualizar, { passive: true });
  window.addEventListener("resize", atualizar);
}

boot();
