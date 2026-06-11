// Motor do robô do guia — modelo dirigido por PASSOS (uma tecla por passo).
// Auto e Manual usam o MESMO caminho: auto chama proximaTecla() num laço com
// pausa; manual chama proximaTecla()/proximaLinha() a cada clique do usuário.
//
// Reusa traduzir() (notação do guia → ações) e conferir() (compara o display).

import { traduzir } from "./keystrokes.js";
import { conferir } from "./comparar.js";

// Compila o exemplo numa lista plana de passos. Cada passo é UMA ação de tecla,
// com a linha a que pertence e se é a última ação da linha (momento de conferir).
// As ações de modo (f RPN / f ALG) entram como linhaIdx = -1 (setup, sem conferir).
export function compilarPassos(ex, keyRows) {
  const passos = [];
  const modo = traduzir(["f", ex.modo === "alg" ? "ALG" : "RPN"], keyRows);
  modo.forEach((acao, i) =>
    passos.push({ acao, linhaIdx: -1, ultimaDaLinha: i === modo.length - 1 }),
  );
  ex.linhas.forEach((linha, li) => {
    const acoes = traduzir(linha.keys, keyRows);
    acoes.forEach((acao, i) =>
      passos.push({ acao, linhaIdx: li, ultimaDaLinha: i === acoes.length - 1 }),
    );
  });
  return passos;
}

export function criarEngine({ frame, vel, callbacks = {} }) {
  let parar = false;
  let runId = 0;
  let estado = null; // { ex, passos, ptr, ok, meu }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const doc = () => frame.contentDocument;
  const win = () => frame.contentWindow;
  const display = () => doc().querySelector("#display").textContent;
  const passoMs = () => Number(vel.value);

  const stale = () => !estado || estado.meu !== runId;
  const deveAbortar = () => stale() || parar;

  const cb = (nome, ...args) => {
    if (typeof callbacks[nome] === "function") callbacks[nome](...args);
  };

  async function resetCalc() {
    // Independência: zera a memória contínua para a calc nascer de fábrica.
    try {
      localStorage.removeItem("br12c.continuousMemory");
    } catch (e) {
      /* indisponível */
    }
    await new Promise((res) => {
      frame.onload = () => res();
      frame.src = "../index.html?t=" + Date.now();
    });
    for (let i = 0; i < 120; i += 1) {
      if (win().__BR12C_KEYS__ && doc().querySelector("#keyboard [data-action]")) break;
      await sleep(30);
    }
    // Realce da tecla pressionada, injetado dentro do iframe.
    try {
      const st = doc().createElement("style");
      st.textContent =
        "#keyboard [data-action].robo-press,#holdModeBtn.robo-press{outline:4px solid #f2c64d!important;outline-offset:1px;background:rgba(242,198,77,.30)!important;border-radius:8px;}";
      doc().head.appendChild(st);
    } catch (e) {
      /* ignora */
    }
  }

  function botaoDe(acao) {
    return acao === "hold-mode"
      ? doc().querySelector("#holdModeBtn")
      : doc().querySelector(`#keyboard [data-action="${acao}"]`);
  }

  function rotuloDe(acao) {
    const btn = botaoDe(acao);
    return (btn && btn.getAttribute("aria-label")) || acao;
  }

  // Pressiona UMA ação com realce + clique e a temporização da velocidade.
  async function pressUma(acao) {
    const ms = passoMs();
    const btn = botaoDe(acao);
    if (!btn) {
      await sleep(ms);
      return;
    }
    cb("onTecla", rotuloDe(acao));
    btn.classList.add("robo-press");
    await sleep(ms * 0.18);
    if (deveAbortar()) {
      btn.classList.remove("robo-press");
      return;
    }
    btn.dispatchEvent(new (win().MouseEvent)("click", { bubbles: true }));
    await sleep(ms * 0.62);
    btn.classList.remove("robo-press");
    await sleep(ms * 0.2);
  }

  // Info do próximo passo (para o indicador "próxima tecla").
  function proximaInfo() {
    if (!estado || estado.ptr >= estado.passos.length) return null;
    const p = estado.passos[estado.ptr];
    return { acao: p.acao, rotulo: rotuloDe(p.acao), linhaIdx: p.linhaIdx };
  }

  function emitirProgresso() {
    cb("onProgresso", {
      ptr: estado ? estado.ptr : 0,
      total: estado ? estado.passos.length : 0,
      info: proximaInfo(),
      fim: !estado || estado.ptr >= estado.passos.length,
    });
  }

  // Carrega um exemplo: reseta a calc e prepara no passo 0 (sem tocar).
  async function carregar(ex) {
    const meu = ++runId;
    parar = false;
    await resetCalc();
    if (meu !== runId) return; // outro carregar começou no meio
    const keyRows = win().__BR12C_KEYS__;
    estado = { ex, passos: compilarPassos(ex, keyRows), ptr: 0, ok: 0, meu };
    cb("onCarregado", ex);
    emitirProgresso();
  }

  // Avança UMA tecla. Ao fim de uma linha, confere e emite onLinha.
  async function proximaTecla() {
    parar = false; // ação explícita do usuário (ou do laço auto) limpa o stop
    if (stale() || estado.ptr >= estado.passos.length) return false;
    const passo = estado.passos[estado.ptr];
    await pressUma(passo.acao);
    if (stale()) return false;
    if (passo.ultimaDaLinha && passo.linhaIdx >= 0) {
      const linha = estado.ex.linhas[passo.linhaIdx];
      const r = conferir(display(), linha.display);
      if (r.ok) estado.ok += 1;
      cb("onLinha", passo.linhaIdx, linha, r);
    }
    estado.ptr += 1;
    const acabou = estado.ptr >= estado.passos.length;
    emitirProgresso();
    if (acabou) cb("onFim", estado.ok, estado.ex.linhas.length);
    return !acabou;
  }

  // Avança até terminar a linha atual (uma "jogada" do usuário no modo manual).
  async function proximaLinha() {
    parar = false;
    if (stale()) return;
    const linhaInicial = estado.passos[estado.ptr]
      ? estado.passos[estado.ptr].linhaIdx
      : null;
    let continuar = true;
    while (continuar && !stale()) {
      const passoAtual = estado.passos[estado.ptr];
      const eraUltima = passoAtual && passoAtual.ultimaDaLinha && passoAtual.linhaIdx === linhaInicial;
      continuar = await proximaTecla();
      if (eraUltima) break;
    }
  }

  // Toca o exemplo inteiro automaticamente a partir do passo atual.
  async function tocarAuto() {
    parar = false;
    if (stale()) return;
    cb("onStatus", "tocando");
    while (estado && estado.ptr < estado.passos.length && !parar && !stale()) {
      await proximaTecla();
      if (parar || stale()) break;
      await sleep(passoMs() * 0.15);
    }
    cb("onStatus", parar ? "parado" : "fim");
  }

  function pararTudo() {
    parar = true;
  }

  return {
    carregar,
    proximaTecla,
    proximaLinha,
    tocarAuto,
    pararTudo,
    exAtual: () => (estado ? estado.ex : null),
    noFim: () => !estado || estado.ptr >= estado.passos.length,
    proximaInfo,
    // snapshot do progresso (p/ re-pintar o indicador após trocar idioma)
    estadoPasso: () => ({
      ptr: estado ? estado.ptr : 0,
      total: estado ? estado.passos.length : 0,
      info: proximaInfo(),
      fim: !estado || estado.ptr >= estado.passos.length,
    }),
  };
}
