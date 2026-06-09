// Continuous Memory (#2): o estado da calculadora sobrevive a um "reload".
// Faz DOIS boots do app.js compartilhando o MESMO window+localStorage e confere
// que pilha, FIX e registradores são restaurados.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { traduzir } from "./keystrokes.js";
import { conferir } from "./comparar.js";

const INDEX_HTML = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const BODY = (INDEX_HTML.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? "").replace(/<script[\s\S]*?<\/script>/gi, "");
const GLOBAIS = ["window", "document", "getComputedStyle", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "MouseEvent", "KeyboardEvent", "PointerEvent", "DOMParser"];

function prepararGlobais(win) {
  if (!win.matchMedia) {
    win.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; }, onchange: null });
  }
  if (!win.ResizeObserver) win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  if (!win.requestAnimationFrame) {
    win.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    win.cancelAnimationFrame = (id) => clearTimeout(id);
  }
  if (!win.CSS || !win.CSS.escape) {
    win.CSS = win.CSS || {};
    win.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
  }
  for (const n of GLOBAIS) if (n in win) try { globalThis[n] = win[n]; } catch { /* ignora */ }
  try { globalThis.localStorage = win.localStorage; } catch { /* ignora */ }
  globalThis.matchMedia = win.matchMedia;
  globalThis.requestAnimationFrame = win.requestAnimationFrame;
  globalThis.cancelAnimationFrame = win.cancelAnimationFrame;
  globalThis.ResizeObserver = win.ResizeObserver;
  globalThis.CSS = win.CSS;
}

describe("Continuous Memory — persistência (#2)", () => {
  it("pilha, FIX e registrador sobrevivem ao reload (mesmo localStorage)", async () => {
    const dom = new JSDOM(`<!doctype html><html><body>${BODY}</body></html>`, { url: "http://localhost/", pretendToBeVisual: true });
    const win = dom.window;
    win.localStorage.clear();
    prepararGlobais(win);

    const press = (toks) => {
      for (const a of traduzir(toks, globalThis.__BR12C_KEYS__)) {
        const b = win.document.querySelector(`#keyboard [data-action="${a}"]`);
        if (b) b.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
      }
    };
    const display = () => win.document.querySelector("#display").textContent;
    const status = (campo) => win.document.querySelector(`[data-status="${campo}"]`).textContent.trim();

    // Boot 1: define estado (X=1234,5 ; FIX 4 ; R0=1234,5).
    vi.resetModules();
    await import("../app.js");
    press(["1234.5", "f", "4"]);
    press(["STO", "0"]);
    expect(status("fixed")).toBe("4");
    expect(conferir(display(), "1,234.5000").ok).toBe(true);

    // Reload: novo módulo, MESMO window + localStorage -> deve hidratar.
    vi.resetModules();
    await import("../app.js");
    expect(status("fixed")).toBe("4"); // FIX 4 restaurado
    expect(conferir(display(), "1,234.5000").ok).toBe(true); // X restaurado
    press(["RCL", "0"]);
    expect(conferir(display(), "1,234.5000").ok).toBe(true); // R0 restaurado

    try { delete globalThis.localStorage; } catch { /* ignora */ }
  });
});
