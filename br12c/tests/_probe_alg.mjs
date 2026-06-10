import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const INDEX_HTML = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const BODY_INNER = (INDEX_HTML.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? "").replace(
  /<script[\s\S]*?<\/script>/gi,
  "",
);

const GLOBAIS_DOM = ["window","document","getComputedStyle","HTMLElement","Element","Node","Event","CustomEvent","MouseEvent","KeyboardEvent","PointerEvent","DOMParser"];

function definirGlobal(nome, valor){ try{ globalThis[nome]=valor; }catch{ try{ Object.defineProperty(globalThis,nome,{value:valor,configurable:true,writable:true}); }catch{} } }
function aplicarShims(win){
  if(!win.matchMedia) win.matchMedia=(q)=>({matches:false,media:q,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false;}});
  if(!win.ResizeObserver) win.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
  if(!win.requestAnimationFrame){ win.requestAnimationFrame=(cb)=>setTimeout(()=>cb(Date.now()),0); win.cancelAnimationFrame=(id)=>clearTimeout(id); }
  if(!win.CSS||!win.CSS.escape){ win.CSS=win.CSS||{}; win.CSS.escape=(s)=>String(s).replace(/[^a-zA-Z0-9_-]/g,(c)=>"\\"+c); }
}

const ALIASES = { "÷":"op:/", "×":"op:*", X:"op:*", "=":"enter" };

function construirMapa(keyRows){ const mapa={}; for(const row of keyRows) for(const k of row) for(const r of [k.main,k.f,k.g]) if(r&&!(r in mapa)) mapa[r]=k.action; return mapa; }
const NUMERO=/^[0-9]+([.,][0-9]+)?$/;
function traduzir(tokens,keyRows){ const mapa=construirMapa(keyRows); const acoes=[]; for(const tb of tokens){ const token=String(tb).trim(); if(token==="")continue; if(NUMERO.test(token)){ for(const ch of token) acoes.push(ch==="."||ch===","?"decimal":"digit:"+ch); continue;} const acao = token in ALIASES?ALIASES[token]:mapa[token]; if(!acao) throw new Error("nao mapeada: "+token); acoes.push(acao);} return acoes; }

async function criar(){
  const dom=new JSDOM(`<!doctype html><html><body>${BODY_INNER}</body></html>`,{url:"http://localhost/",pretendToBeVisual:true});
  const win=dom.window; aplicarShims(win);
  for(const nome of GLOBAIS_DOM) if(nome in win) definirGlobal(nome,win[nome]);
  definirGlobal("matchMedia",win.matchMedia); definirGlobal("requestAnimationFrame",win.requestAnimationFrame); definirGlobal("cancelAnimationFrame",win.cancelAnimationFrame); definirGlobal("ResizeObserver",win.ResizeObserver); definirGlobal("CSS",win.CSS);
  await import("../app.js?cache="+Math.random());
  const keys=globalThis.__BR12C_KEYS__;
  const display=()=>win.document.querySelector("#display").textContent;
  const press=(acoes)=>{ for(const a of acoes){ const b=win.document.querySelector(`#keyboard [data-action="${a}"]`); if(!b)throw new Error("tecla nao achada: "+a); b.dispatchEvent(new win.MouseEvent("click",{bubbles:true})); } };
  const pressGuia=(tokens)=>press(traduzir(tokens,keys));
  return { display, pressGuia };
}

async function run(label, mode, tokens){
  const c=await criar();
  // switch to ALG: f EEX ; RPN: f CHS
  if(mode==="alg") c.pressGuia(["f","ALG"]);
  c.pressGuia(tokens);
  console.log(label.padEnd(55), "=>", c.display());
}

// ---- Probes ----
// 1. % as standalone in ALG with no pending op (should divide by 100? real 12CP: 25 % with no op...)
await run("ALG: 25 % (no pending op)", "alg", ["25","%"]);
// 2. % after × then = : 200 × 25 % =
await run("ALG: 200 x 25 % =", "alg", ["200","×","25","%","="]);
// 3. % after + : 1250 + 7 % (should show 87.50 per guide), then = 1337.50
await run("ALG: 1250 + 7 % (expect 87.50)", "alg", ["1250","+","7","%"]);
await run("ALG: 1250 + 7 % = (expect 1337.50)", "alg", ["1250","+","7","%","="]);
// 4. % after + then = then continue: does pendingValue update for chain markup?
await run("ALG: 1250 + 7 % then + 100 =", "alg", ["1250","+","7","%","+","100","="]);
// 5. Net: 23250 - 8 % + 6 % = (guide 22673.40)
await run("ALG: 23250 - 8 % + 6 % = (22673.40)", "alg", ["23250","-","8","%","+","6","%","="]);
// 6. % after = (result fresh), then % alone: e.g. 200 x 4 = (800), then 10 %
await run("ALG: 200 x 4 = then 10 % (expect 0.10?)", "alg", ["200","×","4","=","10","%"]);
// 7. %T in ALG: 3.92 + 2.36 + 1.67 = (7.95), 2.36 %T (expect 29.69)
await run("ALG: %T after chain (expect 29.69)", "alg", ["3.92","+","2.36","+","1.67","=","2.36","%T"]);
// 8. Delta% in ALG: 58.5 then 53.25 then Δ% -- needs y=58.5
await run("ALG: 58.5 [enter?] 53.25 Δ% ", "alg", ["58.5","ENTER","53.25","Δ%"]);
// 9. %T in ALG without chain: just 200 then %T (no y)
await run("ALG: 200 %T (no base)", "alg", ["200","%T"]);
// 10. % with pending × (not +/-): 300 × 14 % = (guide: 0.14 then 42.00)
await run("ALG: 300 x 14 % (expect 0.14)", "alg", ["300","×","14","%"]);
await run("ALG: 300 x 14 % = (expect 42.00)", "alg", ["300","×","14","%","="]);
// 11. RPN delta% sanity
await run("RPN: 58.5 ENTER 53.25 Δ% (expect -8.97)", "rpn", ["58.5","ENTER","53.25","Δ%"]);
// 12. ALG: chain after % then operator continues base? 100 + 10 % + (now base should be 110?)
await run("ALG: 100 + 10 % + 5 % = ", "alg", ["100","+","10","%","+","5","%","="]);
// 13. ALG % alone after entering number then pressing % twice
await run("ALG: 50 % %", "alg", ["50","%","%"]);
// 14. ALG: does % alter pendingValue when + pending? 1250 + 7 % then next number replaces?
await run("ALG: 1250 + 7 % 200 = ", "alg", ["1250","+","7","%","200","="]);
