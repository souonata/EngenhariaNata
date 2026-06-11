// Integração do br12c ao portfólio: idioma (PT/IT), tema (claro/escuro) e home.
//
// IMPORTANTE — por que AUTOCONTIDO (sem import de ../src/core):
// No deploy, o br12c é STANDALONE: é copiado como está (cp -r br12c dist/),
// enquanto os módulos compartilhados src/core/*.js são bundlados nos OUTROS apps
// pelo Vite e NÃO existem como arquivos crus em produção (dão 404). Um import de
// ../src/core/i18n.js aqui quebra só na produção (localmente o servidor cru tem
// os arquivos). Por isso replicamos a lógica usando as MESMAS chaves de
// armazenamento (sessionStorage engnata_idioma, localStorage engnata_theme_mode)
// e o MESMO atributo data-theme — então a preferência é compartilhada com a home
// e os demais apps do engnata.eu. As traduções (src/i18n/br12c.json) SÃO copiadas
// para o dist (passo "Copiar dados buscados em runtime"), então o fetch funciona.
// NÃO mexe na calculadora (app.js); só na "moldura", oculta no celular via CSS.

(function () {
  "use strict";

  // ===== Idioma (mesmo contrato do portfólio: sessionStorage "engnata_idioma") =====
  const IDIOMA_KEY = "engnata_idioma";
  let idiomaAtual = "it-IT";
  let traducoes = {};

  function obterTraducao(chave) {
    let valor = traducoes[idiomaAtual];
    for (const parte of chave.split(".")) {
      if (valor && typeof valor === "object") valor = valor[parte];
      else return null;
    }
    return typeof valor === "string" ? valor : null;
  }

  function aplicarTraducoes() {
    document.documentElement.lang = idiomaAtual;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const t = obterTraducao(el.getAttribute("data-i18n"));
      if (t != null) el.textContent = t;
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const t = obterTraducao(el.getAttribute("data-i18n-html"));
      if (t != null) el.innerHTML = t;
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const t = obterTraducao(el.getAttribute("data-i18n-title"));
      if (t != null) el.setAttribute("title", t);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const t = obterTraducao(el.getAttribute("data-i18n-aria"));
      if (t != null) el.setAttribute("aria-label", t);
    });
    const titulo = obterTraducao("page.title");
    if (titulo) document.title = titulo;
  }

  function atualizarBotoesIdioma() {
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      const ativo = btn.getAttribute("data-lang") === idiomaAtual;
      btn.classList.toggle("active", ativo);
      btn.setAttribute("aria-pressed", ativo ? "true" : "false");
    });
  }

  function trocarIdioma(novo) {
    if (!traducoes[novo]) return;
    idiomaAtual = novo;
    try { sessionStorage.setItem(IDIOMA_KEY, novo); } catch (e) { /* sessão indisponível */ }
    aplicarTraducoes();
    atualizarBotoesIdioma();
    atualizarTextoTema(); // o rótulo Dark/Light depende do idioma
  }

  function configurarBotoesIdioma() {
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => trocarIdioma(btn.getAttribute("data-lang")));
    });
  }

  // ===== Tema (mesmo contrato: localStorage "engnata_theme_mode", JSON, data-theme) =====
  // storage.js do portfólio salva com prefixo "engnata_" e JSON.stringify; aqui
  // replicamos o formato EXATO para a preferência valer entre as páginas.
  const TEMA_KEY = "engnata_theme_mode";
  const TOGGLE_ID = "themeToggleGlobal";

  function lerTema() {
    try {
      return JSON.parse(localStorage.getItem(TEMA_KEY)) === "dark" ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  }

  function salvarTema(t) {
    try { localStorage.setItem(TEMA_KEY, JSON.stringify(t)); } catch (e) { /* indisponível */ }
  }

  function textoTema(t) {
    const paraEscuro = t !== "dark";
    if ((idiomaAtual || "it-IT").startsWith("it")) {
      return paraEscuro ? "Attiva tema scuro" : "Attiva tema chiaro";
    }
    return paraEscuro ? "Ativar tema escuro" : "Ativar tema claro";
  }

  function atualizarTextoTema() {
    const btn = document.getElementById(TOGGLE_ID);
    if (!btn) return;
    const t = document.documentElement.getAttribute("data-theme") || "light";
    const isDark = t === "dark";
    btn.setAttribute("aria-pressed", isDark ? "true" : "false");
    btn.setAttribute("aria-label", textoTema(t));
    btn.title = textoTema(t);
    btn.textContent = isDark ? "Light" : "Dark";
  }

  function aplicarTema(t) {
    document.documentElement.setAttribute("data-theme", t);
    salvarTema(t);
    atualizarTextoTema();
  }

  function alternarTema() {
    const atual = document.documentElement.getAttribute("data-theme") || "light";
    aplicarTema(atual === "dark" ? "light" : "dark");
  }

  function inicializarTema() {
    document.documentElement.setAttribute("data-theme", lerTema());
    // Cria o botão de tema dentro do seletor de idioma (oculto no celular via CSS,
    // onde a calculadora só HERDA a preferência salva, sem botão).
    const host = document.querySelector(".language-selector") || document.body;
    let btn = document.getElementById(TOGGLE_ID);
    if (!btn) {
      btn = document.createElement("button");
      btn.id = TOGGLE_ID;
      btn.type = "button";
      btn.className = "theme-toggle-btn";
      btn.addEventListener("click", alternarTema);
      host.appendChild(btn);
    }
    atualizarTextoTema();
  }

  // ===== Botão home: aparece em degradê ao rolar até o rodapé (igual aos outros apps) =====
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
        op = Math.min(1, Math.max(0, 1 - (rolavel - window.scrollY) / FAIXA));
      }
      btn.style.opacity = op.toFixed(3);
      btn.style.pointerEvents = op > 0.05 ? "auto" : "none";
    };
    atualizar();
    window.addEventListener("scroll", atualizar, { passive: true });
    window.addEventListener("resize", atualizar);
  }

  // ===== Boot =====
  async function boot() {
    inicializarTema();
    configurarBotoesIdioma();
    configurarFadeHome();
    try {
      const res = await fetch("../src/i18n/br12c.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      traducoes = await res.json();
      let sessao = null;
      try { sessao = sessionStorage.getItem(IDIOMA_KEY); } catch (e) { /* sessão indisponível */ }
      const pref = sessao || "it-IT";
      idiomaAtual = traducoes[pref] ? pref : "it-IT";
      aplicarTraducoes();
      atualizarBotoesIdioma();
      atualizarTextoTema();
    } catch (erro) {
      // A calculadora funciona mesmo sem as traduções (rótulos no texto padrão).
      console.error("br12c: falha ao carregar traduções", erro);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
