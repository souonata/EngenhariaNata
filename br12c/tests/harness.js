// Harness do robô: carrega o app.js REAL num DOM (jsdom instanciado à mão),
// monta o teclado e permite "apertar" as teclas reais e ler o display —
// testando o motor + a fiação de verdade, sem janela.
//
// Por que jsdom manual (e não `// @vitest-environment jsdom`): a raiz do projeto
// não tem node_modules próprio (deps ficam em local/), e o `root` do Vitest
// aponta pra raiz — então o ambiente jsdom embutido não é resolvido. Importar
// JSDOM direto (de local/node_modules) e expor os globais resolve isso e mantém
// o env `node`, igual ao resto da suíte.
//
// Uso:
//   const calc = await criarCalculadora();
//   calc.pressGuia(["2","ENTER","3","+"]);
//   calc.display();  // "5,00"

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";
import { JSDOM } from "jsdom";
import { traduzir } from "./keystrokes.js";

// Corpo estático de br12c/index.html (sem os <script>, que carregamos à parte).
const INDEX_HTML = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const BODY_INNER = (INDEX_HTML.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? "").replace(
  /<script[\s\S]*?<\/script>/gi,
  "",
);

// Globais do navegador que o app.js usa e que precisam apontar para o jsdom.
const GLOBAIS_DOM = [
  "window",
  "document",
  "getComputedStyle",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "PointerEvent",
  "DOMParser",
];

// Atribui um global de forma resiliente (alguns globais do Node, como navigator,
// são getters somente-leitura).
function definirGlobal(nome, valor) {
  try {
    globalThis[nome] = valor;
  } catch {
    try {
      Object.defineProperty(globalThis, nome, { value: valor, configurable: true, writable: true });
    } catch {
      /* ignora: app.js não depende deste global */
    }
  }
}

function aplicarShims(win) {
  if (!win.matchMedia) {
    win.matchMedia = (q) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    });
  }
  if (!win.ResizeObserver) {
    win.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!win.requestAnimationFrame) {
    win.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    win.cancelAnimationFrame = (id) => clearTimeout(id);
  }
  if (!win.CSS || !win.CSS.escape) {
    win.CSS = win.CSS || {};
    win.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
  }
}

// Cria uma calculadora nova e isolada (DOM + app.js recarregados do zero).
export async function criarCalculadora() {
  const dom = new JSDOM(`<!doctype html><html><body>${BODY_INNER}</body></html>`, {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const win = dom.window;
  aplicarShims(win);

  // Expõe os globais do jsdom para o app.js (que referencia document/window globais).
  for (const nome of GLOBAIS_DOM) {
    if (nome in win) definirGlobal(nome, win[nome]);
  }
  definirGlobal("matchMedia", win.matchMedia);
  definirGlobal("requestAnimationFrame", win.requestAnimationFrame);
  definirGlobal("cancelAnimationFrame", win.cancelAnimationFrame);
  definirGlobal("ResizeObserver", win.ResizeObserver);
  definirGlobal("CSS", win.CSS);

  vi.resetModules();
  await import("../app.js");

  const keys = globalThis.__BR12C_KEYS__;
  if (!keys) {
    throw new Error("globalThis.__BR12C_KEYS__ ausente — o hook de teste do app.js não rodou.");
  }

  const display = () => win.document.querySelector("#display").textContent;

  const press = (acoes) => {
    for (const acao of acoes) {
      // "hold-mode" é o botão Segurar (🔒), fora do #keyboard.
      const botao =
        acao === "hold-mode"
          ? win.document.querySelector("#holdModeBtn")
          : win.document.querySelector(`#keyboard [data-action="${acao}"]`);
      if (!botao) throw new Error(`Tecla não encontrada para ação: ${acao}`);
      botao.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    }
  };

  const pressGuia = (tokens) => press(traduzir(tokens, keys));

  return { display, press, pressGuia, keys, window: win };
}
