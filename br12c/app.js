// Metadados das teclas conforme a SKIN real (HP 12C Platinum): rótulo branco
// (primário), f (dourado, em cima) e g (azul, embaixo). As `action` batem com o
// teclado renderizado (buildSkinKeys). Fonte de verdade do tradutor de testes
// (exposto em globalThis.__BR12C_KEYS__) e de handleShiftedAction.
const KEY_ROWS = [
  [
    { main: "n", f: "AMORT", g: "12×", action: "tvm:n" },
    { main: "i", f: "INT", g: "12÷", action: "tvm:i" },
    { main: "PV", f: "NPV", g: "CFo", action: "tvm:PV" },
    { main: "PMT", f: "RND", g: "CFj", action: "tvm:PMT" },
    { main: "FV", f: "IRR", g: "Nj", action: "tvm:FV" },
    { main: "CHS", f: "RPN", g: "DATE", action: "chs" },
    { main: "7", f: "", g: "BEG", action: "digit:7", tone: "number" },
    { main: "8", f: "", g: "END", action: "digit:8", tone: "number" },
    { main: "9", f: "", g: "MEM", action: "digit:9", tone: "number" },
    { main: "÷", f: "", g: "", action: "op:/", tone: "operator" },
  ],
  [
    { main: "y^x", f: "PRICE", g: "√x", action: "pow" },
    { main: "1/x", f: "YTM", g: "e^x", action: "reciprocal" },
    { main: "%T", f: "SL", g: "LN", action: "percent-total" },
    { main: "Δ%", f: "SOYD", g: "FRAC", action: "delta-percent" },
    { main: "%", f: "DB", g: "INTG", action: "percent" },
    { main: "EEX", f: "ALG", g: "ΔDYS", action: "eex" },
    { main: "4", f: "", g: "D.MY", action: "digit:4", tone: "number" },
    { main: "5", f: "", g: "M.DY", action: "digit:5", tone: "number" },
    { main: "6", f: "", g: "x̄w", action: "digit:6", tone: "number" },
    { main: "×", f: "", g: "x²", action: "op:*", tone: "operator" },
  ],
  [
    { main: "R/S", f: "P/R", g: "PSE", action: "run-stop" },
    { main: "SST", f: "Σ", g: "BST", action: "sst" },
    { main: "R↓", f: "PRGM", g: "GTO", action: "roll" },
    { main: "x≷y", f: "FIN", g: "x≤y", action: "swap" },
    { main: "CLx", f: "REG", g: "x=0", action: "clear-entry" },
    { main: "ENTER", f: "PREFIX", g: "", action: "enter", tone: "operator" },
    { main: "1", f: "", g: "x̂,r", action: "digit:1", tone: "number" },
    { main: "2", f: "", g: "ŷ,r", action: "digit:2", tone: "number" },
    { main: "3", f: "", g: "n!", action: "digit:3", tone: "number" },
    { main: "-", f: "", g: "", action: "op:-", tone: "operator" },
  ],
  [
    { main: "ON", f: "OFF", g: "", action: "power", tone: "danger" },
    { main: "f", f: "", g: "", action: "shift:f", tone: "gold" },
    { main: "g", f: "", g: "", action: "shift:g", tone: "blue" },
    { main: "STO", f: "", g: "", action: "sto" },
    { main: "RCL", f: "", g: "", action: "rcl" },
    { main: "0", f: "", g: "x̄", action: "digit:0", tone: "number" },
    { main: ".", f: "", g: "s", action: "decimal", tone: "number" },
    { main: "Σ+", f: "", g: "Σ-", action: "sum-plus", tone: "number" },
    { main: "+", f: "", g: "LST x", action: "op:+", tone: "operator" },
  ],
];

// Hook de teste (inerte em produção): expõe a metadata das teclas para o robô
// de verificação do guia (br12c/tests/). Não afeta a calculadora em uso.
if (typeof globalThis !== "undefined") {
  globalThis.__BR12C_KEYS__ = KEY_ROWS;
}

const SKIN_KEYS = buildSkinKeys();

const DISPLAY_DIGIT_LIMIT = 12;
const DISPLAY_BASE_FONT_CQW = 4.85;
// Separador decimal/milhar mutável (ON + . alterna entre pt-BR e US, como na 12C).
let DECIMAL_SEPARATOR = ",";
let THOUSANDS_SEPARATOR = ".";
const LONG_PRESS_HOLD_MS = 520;
const SYNTHETIC_CLICK_SUPPRESSION_MS = 700;
// -Infinity (e não 0) para que cliques logo após o carregamento NÃO sejam
// suprimidos: com 0, performance.now() < 700 ms no boot deixava as teclas mortas
// nos primeiros ~0,7 s. Só um toque real (markTouchActivation) atualiza isto.
let lastTouchActivationAt = -Infinity;
const activePointerPresses = new Map();
const heldActionButtons = new Map();
let latchMode = false;

const state = {
  power: true,
  mode: "rpn",
  stack: { x: 0, y: 0, z: 0, t: 0 },
  entry: "",
  entryActive: false,
  liftStack: false,
  pendingOperator: null,
  pendingValue: null,
  pendingStore: false,
  pendingRecall: false,
  pendingStoreOp: null,
  pendingDot: false,
  registers: {},
  shift: null,
  fixed: 2,
  memory: 0,
  dateFormat: "mdy",
  lastX: 0,
  displayOverride: null,
  displayMode: "fix",
  radixComma: true, // true = vírgula decimal / ponto milhar (pt-BR); false = US
  flagC: false,
  freshValue: false,
  prgmMode: false,
  running: false,
  program: [],
  pointer: 0,
  resumeAt: -1,
  pendingGoto: null,
  prgmAcc: null,
  cf: [],
  cfN: [],
  stats: { n: 0, sx: 0, sx2: 0, sy: 0, sy2: 0, sxy: 0 },
  tvm: {
    n: 0,
    i: 0,
    PV: 0,
    PMT: 0,
    FV: 0,
    begin: false,
  },
  error: "",
  notice: "",
  noticeTimer: null,
};

// Continuous Memory: subconjunto serializável do estado que sobrevive ao
// desligar/recarregar (não inclui flags transitórias: shift, entry, erro,
// prgmMode, displayOverride, pendingStore/Recall). Declarado antes do boot
// para que hidratarEstado() o enxergue (evita temporal dead zone).
const PERSIST_KEYS = [
  "stack", "registers", "tvm", "fixed", "mode", "flagC", "dateFormat",
  "displayMode", "memory", "lastX", "program", "pointer", "stats", "cf", "cfN",
  "radixComma",
];

// Aplica o separador decimal/milhar conforme state.radixComma (chamado no boot e
// ao alternar). alternarSeparador é o "ON + ." da 12C real.
function aplicarSeparador() {
  DECIMAL_SEPARATOR = state.radixComma ? "," : ".";
  THOUSANDS_SEPARATOR = state.radixComma ? "." : ",";
}

function alternarSeparador() {
  state.radixComma = !state.radixComma;
  aplicarSeparador();
}
const PERSIST_CHAVE = "br12c.continuousMemory";

const display = document.querySelector("#display");
const keyboard = document.querySelector("#keyboard");
const shiftIndicator = document.querySelector("#shiftIndicator");
const modeIndicator = document.querySelector("#modeIndicator");
const angleIndicator = document.querySelector("#angleIndicator");
const prgmIndicator = document.querySelector("#prgmIndicator");
const dmyIndicator = document.querySelector("#dmyIndicator");
const cIndicator = document.querySelector("#cIndicator");
const pendingIndicator = document.querySelector("#pendingIndicator");

renderKeyboard();
attachEvents();
hidratarEstado();
updateViewportFit();
updateUI();

function renderKeyboard() {
  keyboard.innerHTML = SKIN_KEYS
    .map((key) => {
      const tone = key.tone || "function";
      return `
        <button
          class="key"
          type="button"
          data-action="${key.action}"
          data-tone="${tone}"
          aria-label="${key.label}"
          title="${key.label}"
          style="--x:${key.x}; --y:${key.y}; --w:${key.w}; --h:${key.h};"
        >
          <span class="shift-top"></span>
          <span class="main-label">${key.label}</span>
          <span class="shift-bottom"></span>
        </button>
      `;
    })
    .join("");
}

function buildSkinKeys() {
  const width = 1604;
  const height = 981;
  const keyWidth = 112;
  const keyHeight = 99;
  const columns = [104, 247, 390, 532, 674, 817, 960, 1102, 1244, 1385];
  const rows = [337, 495, 652, 813];

  const pct = (value, total) => Number(((value / total) * 100).toFixed(3));
  const box = (label, action, col, row, tone = "function", options = {}) => ({
    label,
    action,
    tone,
    x: pct(columns[col], width),
    y: pct(rows[row], height),
    w: pct(options.width || keyWidth, width),
    h: pct(options.height || keyHeight, height),
  });

  return [
    box("n", "tvm:n", 0, 0),
    box("i", "tvm:i", 1, 0),
    box("PV", "tvm:PV", 2, 0),
    box("PMT", "tvm:PMT", 3, 0),
    box("FV", "tvm:FV", 4, 0),
    box("CHS", "chs", 5, 0),
    box("7", "digit:7", 6, 0, "number"),
    box("8", "digit:8", 7, 0, "number"),
    box("9", "digit:9", 8, 0, "number"),
    box("/", "op:/", 9, 0, "operator"),
    box("y^x", "pow", 0, 1),
    box("1/x", "reciprocal", 1, 1),
    box("%T", "percent-total", 2, 1),
    box("Delta %", "delta-percent", 3, 1),
    box("%", "percent", 4, 1),
    box("EEX", "eex", 5, 1),
    box("4", "digit:4", 6, 1, "number"),
    box("5", "digit:5", 7, 1, "number"),
    box("6", "digit:6", 8, 1, "number"),
    box("x", "op:*", 9, 1, "operator"),
    box("R/S", "run-stop", 0, 2),
    box("SST", "sst", 1, 2),
    box("R down", "roll", 2, 2),
    box("x swap y", "swap", 3, 2),
    box("CLx", "clear-entry", 4, 2),
    box("ENTER", "enter", 5, 2, "operator", { height: 260 }),
    box("1", "digit:1", 6, 2, "number"),
    box("2", "digit:2", 7, 2, "number"),
    box("3", "digit:3", 8, 2, "number"),
    box("-", "op:-", 9, 2, "operator"),
    box("ON", "power", 0, 3, "danger"),
    box("f", "shift:f", 1, 3, "gold"),
    box("g", "shift:g", 2, 3, "blue"),
    box("STO", "sto", 3, 3),
    box("RCL", "rcl", 4, 3),
    box("0", "digit:0", 6, 3, "number"),
    box(",", "decimal", 7, 3, "number"),
    box("sum plus", "sum-plus", 8, 3),
    box("+", "op:+", 9, 3, "operator"),
  ];
}

function attachEvents() {
  keyboard.addEventListener("click", (event) => {
    if (shouldSuppressSyntheticClick()) {
      event.preventDefault();
      return;
    }

    const key = event.target.closest("[data-action]");
    if (!key) return;

    activateActionButton(key);
  });

  if (window.PointerEvent) {
    keyboard.addEventListener("pointerdown", handleActionPointerDown);
    keyboard.addEventListener("pointerup", handleActionPointerUp);
    keyboard.addEventListener("pointercancel", handleActionPointerCancel);
    keyboard.addEventListener("lostpointercapture", handleActionPointerCancel);
  } else {
    keyboard.addEventListener("touchend", handleTouchActivation, { passive: false });
  }
  keyboard.addEventListener("dblclick", preventDoubleTapZoom);

  const stageControls = document.querySelector(".stage-controls");
  stageControls.addEventListener("touchend", handleTouchActivation, { passive: false });
  stageControls.addEventListener("dblclick", preventDoubleTapZoom);

  // O botão ON do topo foi removido (a tecla ON da calculadora faz isso).
  // Mantém o handler guardado caso o botão exista em alguma variação.
  const stagePowerBtn = document.querySelector(".stage-controls [data-action='power']");
  if (stagePowerBtn) {
    stagePowerBtn.addEventListener("click", (event) => {
      if (shouldSuppressSyntheticClick()) {
        event.preventDefault();
        return;
      }

      activateActionButton(event.currentTarget);
    });
  }

  // Botão "Segurar": liga/desliga o modo de travar teclas (sticky).
  const holdBtn = document.getElementById("holdModeBtn");
  if (holdBtn) {
    holdBtn.addEventListener("click", (event) => {
      if (shouldSuppressSyntheticClick()) {
        event.preventDefault();
        return;
      }
      setLatchMode(!latchMode);
    });
  }

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (shouldSuppressSyntheticClick()) {
        event.preventDefault();
        return;
      }

      setMode(button.dataset.mode);
    });
  });

  window.addEventListener("keydown", (event) => {
    const action = actionFromKeyboard(event);
    if (!action) return;
    event.preventDefault();
    const key = keyboard.querySelector(`[data-action="${CSS.escape(action)}"]`);
    if (key) animateKey(key);
    handleAction(action);
  });

  window.addEventListener("resize", updateViewportFit);
  window.addEventListener("orientationchange", updateViewportFit);
}

function handleTouchActivation(event) {
  const actionButton = event.target.closest("[data-action]");
  const modeButton = event.target.closest("[data-mode]");

  if (!actionButton && !modeButton) return;

  event.preventDefault();
  markTouchActivation();

  if (actionButton) {
    activateActionButton(actionButton);
    return;
  }

  setMode(modeButton.dataset.mode);
}

function handleActionPointerDown(event) {
  if (event.pointerType === "mouse") return;

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  event.preventDefault();
  markTouchActivation();

  const action = actionButton.dataset.action;
  const releaseHeld = heldActionButtons.has(action);
  if (!releaseHeld) pressActionButton(actionButton);

  const press = {
    button: actionButton,
    action,
    longPressed: false,
    releaseHeld,
    timer: releaseHeld
      ? null
      : window.setTimeout(() => {
          const currentPress = activePointerPresses.get(event.pointerId);
          if (!currentPress) return;
          currentPress.longPressed = true;
          holdActionButton(actionButton);
        }, LONG_PRESS_HOLD_MS),
  };

  activePointerPresses.set(event.pointerId, press);

  if (actionButton.setPointerCapture) {
    actionButton.setPointerCapture(event.pointerId);
  }
}

function handleActionPointerUp(event) {
  const press = activePointerPresses.get(event.pointerId);
  if (!press) return;

  event.preventDefault();
  markTouchActivation();
  activePointerPresses.delete(event.pointerId);
  if (press.timer) window.clearTimeout(press.timer);

  if (press.releaseHeld) {
    releaseHeldAction(press.action);
    return;
  }

  if (press.longPressed) return;

  releasePressedButton(press.button);
  activateActionButton(press.button);
}

function handleActionPointerCancel(event) {
  const press = activePointerPresses.get(event.pointerId);
  if (!press) return;

  activePointerPresses.delete(event.pointerId);
  if (press.timer) window.clearTimeout(press.timer);
  if (!press.longPressed && !press.releaseHeld) releasePressedButton(press.button);
}

function activateActionButton(button) {
  const action = button.dataset.action;
  const key = button.closest(".key");

  // O modo Segurar só vale para teclas da calculadora (ex.: o ícone do guia não).
  if (key) {
    // Modo Segurar: tocar trava/solta a tecla (não executa).
    if (latchMode) {
      // Combo "ON + ." (troca o separador decimal . <-> ,): com ON travado, tocar
      // a tecla "." alterna entre pt-BR (1.234,56) e US (1,234.56), como na 12C real.
      if (action === "decimal" && heldActionButtons.has("power")) {
        releaseHeldAction("power");
        alternarSeparador();
        updateUI();
        return;
      }
      if (heldActionButtons.has(action)) releaseHeldAction(action);
      else holdActionButton(button);
      return;
    }
    // Fora do modo: tocar numa tecla já travada solta ela.
    if (heldActionButtons.has(action)) {
      releaseHeldAction(action);
      return;
    }
    animateKey(key);
  }

  handleAction(action);
}

function pressActionButton(button) {
  const key = button.closest(".key");
  if (key) key.classList.add("is-pressed");
}

function releasePressedButton(button) {
  const key = button.closest(".key");
  if (!key || heldActionButtons.has(button.dataset.action)) return;
  key.classList.remove("is-pressed");
}

function holdActionButton(button) {
  const key = button.closest(".key");
  if (!key) return;
  heldActionButtons.set(button.dataset.action, button);
  key.classList.add("is-held", "is-pressed");
  button.setAttribute("aria-pressed", "true");
  updateUI();
}

function releaseHeldAction(action) {
  const button = heldActionButtons.get(action);
  if (!button) return;
  const key = button.closest(".key");
  if (key) key.classList.remove("is-held", "is-pressed");
  button.removeAttribute("aria-pressed");
  heldActionButtons.delete(action);
  updateUI();
}

// f/g TRAVADO (modo segurar) = shift sustentado, aplicado a cada tecla seguinte.
function getHeldShift() {
  if (heldActionButtons.has("shift:f")) return "f";
  if (heldActionButtons.has("shift:g")) return "g";
  return null;
}

function setLatchMode(on) {
  latchMode = on;
  document.body.classList.toggle("latch-mode", on);
  const btn = document.getElementById("holdModeBtn");
  if (btn) btn.setAttribute("aria-pressed", on ? "true" : "false");
}

function preventDoubleTapZoom(event) {
  event.preventDefault();
}

function markTouchActivation() {
  lastTouchActivationAt = performance.now();
}

function shouldSuppressSyntheticClick() {
  return performance.now() - lastTouchActivationAt < SYNTHETIC_CLICK_SUPPRESSION_MS;
}

function updateViewportFit() {
  const isPhoneLandscape = window.matchMedia(
    "(orientation: landscape) and (max-height: 540px) and (max-width: 980px)",
  ).matches;

  if (!isPhoneLandscape) {
    document.documentElement.style.removeProperty("--phone-landscape-calc-width");
    return;
  }

  const ratio = 1604 / 981;
  const padding = 16;
  const availableWidth = Math.max(320, window.innerWidth - padding);
  const availableHeight = Math.max(220, window.innerHeight - padding);
  const width = Math.min(availableWidth, availableHeight * ratio);

  document.documentElement.style.setProperty("--phone-landscape-calc-width", `${Math.floor(width)}px`);
}

function animateKey(key) {
  if (key.classList.contains("is-held")) return;
  key.classList.add("is-pressed");
  window.setTimeout(() => {
    if (!key.classList.contains("is-held")) key.classList.remove("is-pressed");
  }, 120);
}

function actionFromKeyboard(event) {
  const key = event.key;
  if (/^\d$/.test(key)) return `digit:${key}`;
  if (key === "." || key === ",") return "decimal";
  if (key === "+") return "op:+";
  if (key === "-") return "op:-";
  if (key === "*" || key.toLowerCase() === "x") return "op:*";
  if (key === "/") return "op:/";
  if (key === "Enter") return "enter";
  if (key === "=") return "enter";
  if (key === "Backspace") return "backspace";
  if (key === "Delete") return "clear-entry";
  if (key === "Escape") return "power";
  if (key === "%") return "percent";
  if (key.toLowerCase() === "n") return "tvm:n";
  if (key.toLowerCase() === "i") return "tvm:i";
  if (key.toLowerCase() === "p") return "tvm:PV";
  if (key.toLowerCase() === "m") return "tvm:PMT";
  if (key.toLowerCase() === "f") return "tvm:FV";
  return null;
}

function handleAction(action) {
  // Calculadora desligada: só a tecla ON (power) responde.
  if (!state.power && action !== "power") {
    return;
  }

  state.displayOverride = null;

  if (state.error && !["power", "clear-entry", "backspace"].includes(action)) {
    clearError();
  }

  if (action.startsWith("shift:")) {
    state.shift = state.shift === action.slice(6) ? null : action.slice(6);
    updateUI();
    return;
  }

  // Shift sustentado: f/g TRAVADO (modo segurar) aplica-se a cada tecla e NÃO é
  // consumido; senão, usa o shift de uma vez só (state.shift).
  const shiftTravado = getHeldShift();
  const shiftEfetivo = shiftTravado || state.shift;

  // P/R (f + R/S): alterna modo Programa <-> Run (vale nos dois modos).
  if (shiftEfetivo === "f" && action === "run-stop") {
    if (!shiftTravado) state.shift = null;
    togglePrgm();
    updateUI();
    return;
  }

  // Modo Programa: teclas são gravadas (ou editam/navegam), não executadas.
  if (state.prgmMode) {
    if (!shiftTravado) state.shift = null;
    handleProgramMode(action, shiftEfetivo);
    updateUI();
    return;
  }

  // Run mode: g GTO nnn posiciona o ponteiro (p/ rodar um programa específico).
  if (state.pendingGoto) {
    runGoto(action);
    updateUI();
    return;
  }
  if (shiftEfetivo === "g" && action === "roll") {
    state.pendingGoto = { digits: "" };
    if (!shiftTravado) state.shift = null;
    updateUI();
    return;
  }

  // Run mode: R/S inicia a execução do programa a partir da linha atual.
  if (!shiftEfetivo && action === "run-stop") {
    runProgram();
    updateUI();
    return;
  }

  // Run mode: SST executa uma única instrução (single-step de depuração).
  if (!shiftEfetivo && action === "sst" && state.program.length > 0) {
    passoSST();
    updateUI();
    return;
  }

  if (shiftEfetivo) {
    const handled = handleShiftedAction(shiftEfetivo, action);
    if (!shiftTravado) state.shift = null;
    if (handled) {
      updateUI();
      return;
    }
  }

  if (state.pendingStore || state.pendingRecall) {
    if (handleRegisterTarget(action)) {
      updateUI();
      return;
    }
    state.pendingStore = false;
    state.pendingRecall = false;
    state.pendingStoreOp = null;
    state.pendingDot = false;
  }

  if (action.startsWith("digit:")) {
    inputDigit(action.slice(6));
  } else if (action.startsWith("op:")) {
    applyOperator(action.slice(3));
  } else if (action.startsWith("tvm:")) {
    handleTvm(action.slice(4));
  } else {
    const handlers = {
      decimal: inputDecimal,
      enter,
      "clear-entry": clearEntry,
      backspace,
      chs: changeSign,
      eex: inputExponent,
      reciprocal: () => unary((x) => 1 / x),
      sqrt: () => unary((x) => (x < 0 ? NaN : Math.sqrt(x))),
      ln: () => unary((x) => (x <= 0 ? NaN : Math.log(x))),
      pow: () => applyOperator("pow"),
      percent,
      "delta-percent": deltaPercent,
      "percent-total": percentTotal,
      swap,
      roll,
      rcl: beginRecall,
      sto: beginStore,
      power: togglePower,
      guide: () => document.dispatchEvent(new CustomEvent("br12c:guide")),
      "sum-plus": acumularEstatistica,
    };

    if (handlers[action]) handlers[action]();
  }

  updateUI();
}

function handleShiftedAction(shift, action) {
  if (shift === "f") {
    // Modos: RPN = f+CHS, ALG = f+EEX (skin).
    if (action === "chs") {
      setMode("rpn");
      return true;
    }
    if (action === "eex") {
      setMode("alg");
      return true;
    }
    // CLEAR: FIN = f+x≷y, REG = f+CLx, PREFIX = f+ENTER.
    if (action === "swap") {
      resetFinancial();
      flash("FIN");
      return true;
    }
    if (action === "clear-entry") {
      clearRegisters();
      flash("REG");
      return true;
    }
    // CLEAR Σ = f+SST: zera os registradores estatísticos, a pilha e o display.
    if (action === "sst") {
      state.stats = { n: 0, sx: 0, sx2: 0, sy: 0, sy2: 0, sxy: 0 };
      state.stack = { x: 0, y: 0, z: 0, t: 0 };
      flash("Σ");
      return true;
    }
    // Mantissa = f CLEAR PREFIX (f+ENTER): mostra os 10 dígitos do número (momentâneo).
    if (action === "enter") {
      commitEntry();
      state.displayOverride = formatMantissa(state.stack.x);
      flash("PREFIX");
      return true;
    }
    // Notação científica = f + "." (ponto). Persiste até um FIX (f dígito).
    if (action === "decimal") {
      commitEntry();
      state.displayMode = "sci";
      flash("SCI");
      return true;
    }
    // FIX n = f + dígito (0–9). Volta ao formato fixo.
    if (action.startsWith("digit:")) {
      state.fixed = Number(action.slice(6));
      state.displayMode = "fix";
      flash(`FIX ${state.fixed}`);
      return true;
    }
    // RND = f+PMT (arredonda X às casas do display).
    if (action === "tvm:PMT") {
      commitEntry();
      state.lastX = state.stack.x; // RND é operação de 1 número: salva LAST X (pré-arred.)
      const fator = Math.pow(10, state.fixed);
      setX(Math.round(state.stack.x * fator) / fator);
      state.liftStack = true; // e habilita o lift (próximo número levanta a pilha).
      flash("RND");
      return true;
    }
    // AMORT = f+n: amortiza os próximos N pagamentos (N vem do display).
    if (action === "tvm:n") {
      amortize();
      return true;
    }
    // INT = f+i: juros simples. Juros 360 dias em X, 365 dias em Z, e -PV
    // (principal) em Y para somar (+) e obter o montante. Guia, p.42–43.
    if (action === "tvm:i") {
      commitEntry();
      const pv = state.tvm.PV;
      const taxaDia = (state.tvm.i / 100) * state.tvm.n;
      state.stack.z = (-pv * taxaDia) / 365;
      state.stack.y = -pv;
      setX((-pv * taxaDia) / 360);
      state.liftStack = true;
      flash("INT");
      return true;
    }
    // NPV = f+PV: VPL do fluxo de caixa à taxa i.
    if (action === "tvm:PV") {
      commitEntry();
      const npv = valorPresenteLiquido(state.tvm.i);
      state.tvm.PV = npv;
      setX(npv);
      state.liftStack = true;
      flash("NPV");
      return true;
    }
    // IRR = f+FV: taxa periódica (%) que zera o VPL.
    if (action === "tvm:FV") {
      commitEntry();
      const irr = solveRoot((taxa) => valorPresenteLiquido(taxa), 0, 1000);
      if (Number.isFinite(irr)) {
        state.tvm.i = irr;
        setX(irr);
      } else {
        setError("3"); // IRR não convergiu
      }
      state.liftStack = true;
      flash("IRR");
      return true;
    }
    // Bond Price = f+y^x: liquidação (Y) + vencimento (X) -> preço limpo em X,
    // juro acumulado em Y (somar com + dá o preço total). Yield em i, cupom em PMT.
    if (action === "pow") {
      commitEntry();
      const r = precoLimpoTitulo(
        state.tvm.i,
        parseDate(state.stack.y, state.dateFormat),
        parseDate(state.stack.x, state.dateFormat),
        state.tvm.PMT,
      );
      state.stack.y = r.accrued;
      setX(r.clean);
      state.liftStack = true;
      flash("PRICE");
      return true;
    }
    // Bond Yield = f+1/x: yield (% a.a.) dado o preço cotado (limpo) em PV.
    if (action === "reciprocal") {
      commitEntry();
      const liq = parseDate(state.stack.y, state.dateFormat);
      const venc = parseDate(state.stack.x, state.dateFormat);
      const cotado = state.tvm.PV;
      const cpn = state.tvm.PMT;
      const ytm = solveRoot((yy) => precoLimpoTitulo(yy, liq, venc, cpn).clean - cotado, 0, 100);
      state.tvm.i = ytm;
      setX(ytm);
      state.liftStack = true;
      flash("YTM");
      return true;
    }
    // Depreciação: SL = f+%T, SOYD = f+Δ%, DB = f+% (ano vem do display).
    if (action === "percent-total") {
      depreciacao("SL");
      return true;
    }
    if (action === "delta-percent") {
      depreciacao("SOYD");
      return true;
    }
    if (action === "percent") {
      depreciacao("DB");
      return true;
    }
    // Demais funções f (PRICE, YTM — títulos) chegam depois; por ora consome o
    // prefixo (não dispara a função primária da tecla por engano).
    return true;
  }

  if (shift === "g") {
    // BEG/END (modo de pagamento) = g+7 / g+8.
    if (action === "digit:7") {
      state.tvm.begin = true;
      flash("BEG");
      return true;
    }
    if (action === "digit:8") {
      state.tvm.begin = false;
      flash("END");
      return true;
    }
    // 12× = g+n: multiplica X por 12 E armazena em n (anos -> meses).
    if (action === "tvm:n") {
      commitEntry();
      setX(state.stack.x * 12);
      state.tvm.n = state.stack.x;
      state.liftStack = true;
      flash("12×");
      return true;
    }
    // 12÷ = g+i: divide X por 12 E armazena em i (taxa anual -> mensal).
    if (action === "tvm:i") {
      commitEntry();
      setX(state.stack.x / 12);
      state.tvm.i = state.stack.x;
      state.liftStack = true;
      flash("12÷");
      return true;
    }
    // Fluxo de caixa: CFo = g+PV, CFj = g+PMT, Nj = g+FV.
    if (action === "tvm:PV") {
      commitEntry();
      state.cf = [state.stack.x];
      state.cfN = [1];
      state.tvm.n = 0;
      state.liftStack = true;
      flash("CFo");
      return true;
    }
    if (action === "tvm:PMT") {
      commitEntry();
      state.cf.push(state.stack.x);
      state.cfN.push(1);
      state.tvm.n = (state.tvm.n || 0) + 1;
      state.liftStack = true;
      flash("CFj");
      return true;
    }
    if (action === "tvm:FV") {
      commitEntry();
      if (state.cfN.length > 1) state.cfN[state.cfN.length - 1] = Math.round(state.stack.x);
      state.liftStack = true;
      flash("Nj");
      return true;
    }
    // Matemática (g na linha do y^x): √x, e^x, LN, FRAC, INTG.
    if (action === "pow") {
      unary((x) => (x < 0 ? NaN : Math.sqrt(x)));
      return true;
    }
    if (action === "reciprocal") {
      unary((x) => Math.exp(x));
      return true;
    }
    if (action === "percent-total") {
      unary((x) => (x <= 0 ? NaN : Math.log(x)));
      return true;
    }
    if (action === "delta-percent") {
      unary((x) => x - Math.trunc(x));
      return true;
    }
    if (action === "percent") {
      unary((x) => Math.trunc(x));
      return true;
    }
    // x² = g+× ; n! = g+3.
    if (action === "op:*") {
      unary((x) => x * x);
      return true;
    }
    if (action === "digit:3") {
      commitEntry();
      const x = state.stack.x;
      if (x < 0 || !Number.isInteger(x) || x > 170) {
        setError();
      } else {
        let resultado = 1;
        for (let k = 2; k <= x; k += 1) resultado *= k;
        setX(resultado);
      }
      state.liftStack = true;
      flash("n!");
      return true;
    }
    // Formato de data: D.MY = g+4, M.DY = g+5.
    if (action === "digit:4") {
      state.dateFormat = "dmy";
      flash("D.MY");
      return true;
    }
    if (action === "digit:5") {
      state.dateFormat = "mdy";
      flash("M.DY");
      return true;
    }
    // ΔDYS = g+EEX: dias entre duas datas (reais em X, base 30/360 em Y).
    if (action === "eex") {
      commitEntry();
      const d1 = parseDate(state.stack.y, state.dateFormat);
      const d2 = parseDate(state.stack.x, state.dateFormat);
      state.stack.y = dias360(d1, d2);
      setX(diasJulianos(d2) - diasJulianos(d1));
      state.liftStack = true;
      flash("ΔDYS");
      return true;
    }
    // DATE = g+CHS: data-base (Y) + N dias (X) -> nova data + dia da semana.
    if (action === "chs") {
      commitEntry();
      const base = parseDate(state.stack.y, state.dateFormat);
      const novoJdn = diasJulianos(base) + Math.round(state.stack.x);
      const nd = dataDeJulianos(novoJdn);
      const dow = (novoJdn % 7) + 1; // 1=segunda .. 7=domingo
      const mm = String(nd.m).padStart(2, "0");
      const dd = String(nd.d).padStart(2, "0");
      if (state.dateFormat === "dmy") {
        state.stack.x = Number(`${nd.d}.${mm}${nd.y}`);
        state.displayOverride = `${dd},${mm},${nd.y} ${dow}`;
      } else {
        state.stack.x = Number(`${nd.m}.${dd}${nd.y}`);
        state.displayOverride = `${mm},${dd},${nd.y} ${dow}`;
      }
      state.liftStack = true;
      flash("DATE");
      return true;
    }
    // LST x = g++: recupera o último X (antes da última operação), levantando a pilha.
    if (action === "op:+") {
      const levanta = state.liftStack || state.entryActive;
      if (state.entryActive) commitEntry();
      if (state.mode === "rpn" && levanta) liftStack();
      state.stack.x = state.lastX;
      state.entryActive = false;
      state.liftStack = true;
      flash("LST x");
      return true;
    }
    // Regressão linear: x̂,r = g+1, ŷ,r = g+2 (estimativa em X, correlação r em Y).
    if (action === "digit:1") {
      commitEntry();
      const reg = regressao();
      state.stack.y = reg.r;
      setX(reg.B === 0 ? NaN : (state.stack.x - reg.A) / reg.B);
      state.liftStack = true;
      flash("x̂,r");
      return true;
    }
    if (action === "digit:2") {
      commitEntry();
      const reg = regressao();
      state.stack.y = reg.r;
      setX(reg.A + reg.B * state.stack.x);
      state.liftStack = true;
      flash("ŷ,r");
      return true;
    }
    // Estatística: Σ- = g+Σ+, x̄ = g+0, s = g+. , x̄w = g+6.
    if (action === "sum-plus") {
      commitEntry();
      const s = state.stats;
      s.n -= 1;
      s.sx -= state.stack.x;
      s.sx2 -= state.stack.x * state.stack.x;
      s.sy -= state.stack.y;
      s.sy2 -= state.stack.y * state.stack.y;
      s.sxy -= state.stack.x * state.stack.y;
      setX(s.n);
      state.liftStack = false;
      flash("Σ-");
      return true;
    }
    if (action === "digit:0") {
      const s = state.stats;
      if (s.n === 0) {
        setError("2"); // estatística: sem dados
      } else {
        state.stack.y = s.sy / s.n;
        setX(s.sx / s.n);
      }
      state.liftStack = true;
      flash("x̄");
      return true;
    }
    if (action === "decimal") {
      const s = state.stats;
      if (s.n < 2) {
        setError("2"); // estatística: dados insuficientes
      } else {
        state.stack.y = Math.sqrt(Math.max(0, (s.sy2 - (s.sy * s.sy) / s.n) / (s.n - 1)));
        setX(Math.sqrt(Math.max(0, (s.sx2 - (s.sx * s.sx) / s.n) / (s.n - 1))));
      }
      state.liftStack = true;
      flash("s");
      return true;
    }
    if (action === "digit:6") {
      const s = state.stats;
      setX(s.sx === 0 ? NaN : s.sxy / s.sx);
      state.liftStack = true;
      flash("x̄w");
      return true;
    }
    // Demais funções g (DATE, estimativa linear, programa) — capítulos seguintes.
    return true;
  }

  flash(shift.toUpperCase());
  return false;
}

// CLEAR REG (f+CLx): zera registradores de dados, financeiros, pilha e display.
function clearRegisters() {
  state.registers = {};
  resetFinancial();
  state.cf = [];
  state.cfN = [];
  state.stats = { n: 0, sx: 0, sx2: 0, sy: 0, sy2: 0, sxy: 0 };
  state.stack = { x: 0, y: 0, z: 0, t: 0 };
  state.entry = "";
  state.entryActive = false;
  state.pendingOperator = null;
  state.pendingValue = null;
  state.pendingStore = false;
  state.pendingRecall = false;
  state.pendingStoreOp = null;
  state.pendingDot = false;
  state.liftStack = false;
  clearError();
}

function setMode(mode) {
  state.mode = mode;
  state.pendingOperator = null;
  state.pendingValue = null;
  state.entryActive = false;
  state.liftStack = false;
  flash(mode.toUpperCase());
  updateUI();
}

function inputDigit(digit) {
  if (!state.entryActive) {
    beginNumericEntry();
    state.entry = digit;
  } else if (state.entry === "0") {
    state.entry = digit;
  } else if (state.entry === "-0") {
    state.entry = `-${digit}`;
  } else {
    state.entry += digit;
  }
  limitEntry();
}

function inputDecimal() {
  if (!state.entryActive) {
    beginNumericEntry();
    state.entry = "0.";
  } else if (!mantissa(state.entry).includes(".")) {
    state.entry += ".";
  }
}

function inputExponent() {
  if (!state.entryActive) {
    state.entry = formatRaw(state.stack.x);
    state.entryActive = true;
  }
  if (!/[eE]/.test(state.entry)) {
    state.entry += "e";
  }
}

function beginNumericEntry() {
  clearError();
  // Lift ao iniciar um novo número quando pendente (RPN sempre; ALG após um
  // resultado, para %T/Δ% poderem usar o total em Y). applyOperator zera
  // liftStack durante a cadeia, então isto não afeta cálculos encadeados.
  if (state.liftStack) {
    liftStack();
  }
  state.entry = "";
  state.entryActive = true;
  state.liftStack = false;
}

function limitEntry() {
  const bare = state.entry.replace(/[-.eE+]/g, "");
  if (bare.length > DISPLAY_DIGIT_LIMIT) {
    state.entry = state.entry.slice(0, -1);
  }
}

function mantissa(value) {
  return value.split(/[eE]/)[0];
}

function commitEntry() {
  if (!state.entryActive) return state.stack.x;
  const value = parseEntry(state.entry);
  if (Number.isFinite(value)) {
    state.stack.x = value;
  } else {
    setError();
  }
  state.entry = "";
  state.entryActive = false;
  return state.stack.x;
}

function parseEntry(entry) {
  if (!entry || entry === "-" || entry === "." || entry === "-." || /[eE][-+]?$/u.test(entry)) {
    return 0;
  }
  return Number(entry);
}

function enter() {
  if (state.mode === "alg" && state.pendingOperator) {
    equals();
    return;
  }
  commitEntry();
  liftStack();
  state.liftStack = false;
}

function equals() {
  if (state.mode !== "alg" || !state.pendingOperator) {
    commitEntry();
    return;
  }
  commitEntry();
  const result = calculate(state.pendingValue, state.stack.x, state.pendingOperator);
  setX(result);
  state.pendingOperator = null;
  state.pendingValue = null;
  state.liftStack = true;
}

function applyOperator(operator) {
  commitEntry();
  state.lastX = state.stack.x;
  if (state.mode === "alg") {
    if (state.pendingOperator !== null) {
      const result = calculate(state.pendingValue, state.stack.x, state.pendingOperator);
      setX(result);
      state.pendingValue = state.stack.x;
    } else {
      state.pendingValue = state.stack.x;
    }
    state.pendingOperator = operator;
    state.entryActive = false;
    state.liftStack = false;
    return;
  }

  const result = arredondar10(calculate(state.stack.y, state.stack.x, operator));
  state.stack.x = result;
  state.stack.y = state.stack.z;
  state.stack.z = state.stack.t;
  state.liftStack = true;
  state.freshValue = true; // resultado fresco: próxima tecla n/i/PV/PMT/FV armazena
  if (!Number.isFinite(result)) setError();
}

function calculate(left, right, operator) {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return right === 0 ? NaN : left / right;
    case "pow":
      return Math.pow(left, right);
    default:
      return right;
  }
}

function unary(fn) {
  commitEntry();
  state.lastX = state.stack.x;
  setX(fn(state.stack.x));
  state.liftStack = true;
}

function setX(value) {
  if (!Number.isFinite(value)) {
    setError();
    return;
  }
  state.stack.x = normalizeZero(arredondar10(value));
}

function percent() {
  commitEntry();
  state.lastX = state.stack.x;
  if (state.mode === "alg") {
    // ALG: % divide por 100; exceto após + ou - (calcula a % da base pendente).
    if (state.pendingOperator === "+" || state.pendingOperator === "-") {
      setX((state.pendingValue * state.stack.x) / 100);
    } else {
      setX(state.stack.x / 100);
    }
  } else {
    setX((state.stack.y * state.stack.x) / 100);
  }
  state.liftStack = true;
}

function deltaPercent() {
  commitEntry();
  state.lastX = state.stack.x;
  const base = state.stack.y;
  setX(base === 0 ? NaN : ((state.stack.x - base) / base) * 100);
  state.liftStack = true;
}

function percentTotal() {
  commitEntry();
  state.lastX = state.stack.x;
  const base = state.stack.y;
  setX(base === 0 ? NaN : (state.stack.x / base) * 100);
  state.liftStack = true;
}

function swap() {
  commitEntry();
  [state.stack.x, state.stack.y] = [state.stack.y, state.stack.x];
  state.liftStack = true;
}

function roll() {
  commitEntry();
  const x = state.stack.x;
  state.stack.x = state.stack.y;
  state.stack.y = state.stack.z;
  state.stack.z = state.stack.t;
  state.stack.t = x;
  state.liftStack = true;
}

function liftStack() {
  state.stack.t = state.stack.z;
  state.stack.z = state.stack.y;
  state.stack.y = state.stack.x;
}

function clearEntry() {
  state.entry = "";
  state.entryActive = false;
  state.stack.x = 0;
  state.pendingOperator = null;
  state.pendingValue = null;
  clearError();
  state.liftStack = false;
}

function backspace() {
  if (state.entryActive && state.entry.length > 0) {
    state.entry = state.entry.slice(0, -1);
    if (!state.entry) {
      state.entryActive = false;
      state.stack.x = 0;
    }
  } else {
    state.stack.x = 0;
  }
  clearError();
}

function changeSign() {
  if (state.entryActive) {
    if (/[eE]/.test(state.entry)) {
      state.entry = toggleExponentSign(state.entry);
    } else {
      state.entry = state.entry.startsWith("-") ? state.entry.slice(1) : `-${state.entry || "0"}`;
    }
    return;
  }
  state.stack.x = normalizeZero(-state.stack.x);
}

function toggleExponentSign(entry) {
  const parts = entry.split(/[eE]/);
  const exponent = parts[1] || "";
  if (exponent.startsWith("-")) return `${parts[0]}e${exponent.slice(1)}`;
  if (exponent.startsWith("+")) return `${parts[0]}e-${exponent.slice(1)}`;
  return `${parts[0]}e-${exponent}`;
}

function beginStore() {
  state.pendingStore = true;
  state.pendingRecall = false;
  state.pendingDot = false;
  flash("STO");
}

function beginRecall() {
  state.pendingRecall = true;
  state.pendingStore = false;
  state.pendingDot = false;
  flash("RCL");
}

function handleRegisterTarget(action) {
  // Prefixo de ponto: STO/RCL . endereça os registradores R.0–R.9 (Guia p.27,
  // "Key in ... .0 through .9"). O ponto entra num sub-estado que aguarda o
  // próximo dígito; só então grava/recupera de R.<n> (chave ".n" no map, distinta
  // de "n" para não colidir com R0–R9).
  if (state.pendingDot) {
    if (action.startsWith("digit:")) {
      const n = action.slice(6);
      const reg = `.${n}`;
      if (state.pendingStore) {
        // Sem aritmética de registrador com ponto: o Guia (p.29) restringe
        // STO +/-/×/÷ a R0–R4, então STO op . n grava o valor direto (ignora o op).
        commitEntry();
        state.registers[reg] = state.stack.x;
        flash(`STO . ${n}`);
      } else {
        recallValue(Number(state.registers[reg] || 0));
        flash(`RCL . ${n}`);
      }
      state.pendingStore = false;
      state.pendingRecall = false;
      state.pendingStoreOp = null;
      state.pendingDot = false;
      return true;
    }
    // Qualquer não-dígito após o ponto cancela o endereçamento (volta ao fluxo normal).
    state.pendingDot = false;
    return false;
  }

  if (action === "decimal") {
    state.pendingDot = true;
    return true;
  }

  // STO EEX: liga/desliga o indicador C (juros compostos no período odd). Toggle.
  if (state.pendingStore && action === "eex") {
    state.flagC = !state.flagC;
    state.pendingStore = false;
    state.pendingRecall = false;
    state.pendingStoreOp = null;
    flash(state.flagC ? "C" : "C ·");
    return true;
  }

  // Registradores financeiros (STO/RCL n, i, PV, PMT, FV).
  if (action.startsWith("tvm:")) {
    const field = action.slice(4);
    if (state.pendingStore) {
      commitEntry();
      state.tvm[field] = state.stack.x;
      flash(`STO ${field}`);
    } else {
      recallValue(state.tvm[field]);
      flash(`RCL ${field}`);
    }
    state.pendingStore = false;
    state.pendingRecall = false;
    state.pendingStoreOp = null;
    return true;
  }

  // Aritmética de registrador: STO seguido de + - × ÷ fica pendente até o dígito
  // (ex.: STO - 0  ->  R0 = R0 - x). Guia, p.29.
  if (state.pendingStore && action.startsWith("op:")) {
    state.pendingStoreOp = action.slice(3);
    return true;
  }

  // Registradores numéricos de dados R0–R9.
  if (action.startsWith("digit:")) {
    const reg = action.slice(6);
    if (state.pendingStore) {
      commitEntry();
      if (state.pendingStoreOp) {
        const atual = Number(state.registers[reg] || 0);
        const resultado = aplicarOperacao(state.pendingStoreOp, atual, state.stack.x);
        if (Number.isFinite(resultado)) {
          state.registers[reg] = resultado;
          flash(`STO ${state.pendingStoreOp} ${reg}`);
        } else {
          setError();
        }
      } else {
        state.registers[reg] = state.stack.x;
        flash(`STO ${reg}`);
      }
    } else {
      recallValue(Number(state.registers[reg] || 0));
      flash(`RCL ${reg}`);
    }
    state.pendingStore = false;
    state.pendingRecall = false;
    state.pendingStoreOp = null;
    return true;
  }

  return false;
}

function aplicarOperacao(op, a, b) {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return b === 0 ? NaN : a / b; // divisão por zero -> Error (não silencioso)
    default:
      return b;
  }
}

function recallValue(value) {
  if (value === null || value === undefined) {
    flash("--");
    return;
  }
  if (state.mode === "rpn" && state.liftStack) liftStack();
  state.stack.x = value;
  state.entryActive = false;
  state.liftStack = true;
}

function handleTvm(field) {
  // Armazena quando há valor digitado (entryActive) OU recém-calculado por
  // aritmética (ex.: "36 + n" no odd-period); senão resolve o campo.
  if (state.entryActive || state.freshValue) {
    commitEntry();
    state.tvm[field] = state.stack.x;
    state.freshValue = false;
    flash(field);
    state.liftStack = true;
    return;
  }

  const solved = solveTvm(field);
  if (solved.ok) {
    state.tvm[field] = solved.value;
    state.stack.x = solved.value;
    state.liftStack = true;
    flash(field);
    return;
  }

  if (state.tvm[field] !== null) {
    recallValue(state.tvm[field]);
    return;
  }

  flash("TVM?");
}

function solveTvm(target) {
  const tvm = state.tvm;
  const required = ["n", "i", "PV", "PMT", "FV"].filter((field) => field !== target);
  if (required.some((field) => tvm[field] === null || !Number.isFinite(tvm[field]))) {
    return { ok: false };
  }

  const n = tvm.n;
  const r = tvm.i / 100;
  const pv = tvm.PV;
  const pmt = tvm.PMT;
  const fv = tvm.FV;
  const begin = tvm.begin;

  // Modo Odd-Period: n não-inteiro -> juros simples (C off) ou composto (C on) no
  // fragmento. Calcular n sai do modo (usa a equação padrão).
  const odd = !Number.isInteger(n) && target !== "n";

  try {
    let value;
    if (odd) {
      value = solveTvmOdd(target, n, r, pv, pmt, fv, begin);
    } else {
      if (target === "FV") value = solveFV(n, r, pv, pmt, begin);
      if (target === "PV") value = solvePV(n, r, pmt, fv, begin);
      if (target === "PMT") value = solvePMT(n, r, pv, fv, begin);
      if (target === "n") value = arredondarN(solveN(r, pv, pmt, fv, begin));
      if (target === "i") value = solveRate(n, pv, pmt, fv, begin) * 100;
    }

    if (!Number.isFinite(value)) return { ok: false };
    return { ok: true, value: normalizeZero(value) };
  } catch {
    return { ok: false };
  }
}

// Equação TVM no modo Odd-Period: parte inteira (k) descontada normalmente; o
// fragmento f cresce o PV por juros simples (1+r·f) ou compostos (1+r)^f.
function tvmEquationOdd(r, n, pv, pmt, fv, begin) {
  const k = Math.floor(n);
  const f = n - k;
  const S = begin ? 1 : 0;
  if (Math.abs(r) < 1e-12) return pv + pmt * k + fv;
  const pvFactor = state.flagC ? Math.pow(1 + r, f) : 1 + r * f;
  const disc = Math.pow(1 + r, -k);
  const annuity = (1 - disc) / r;
  return pv * pvFactor + pmt * (1 + r * S) * annuity + fv * disc;
}

function solveTvmOdd(target, n, r, pv, pmt, fv, begin) {
  if (target === "i") {
    return solveRateWith((rate) => tvmEquationOdd(rate, n, pv, pmt, fv, begin)) * 100;
  }
  const k = Math.floor(n);
  const f = n - k;
  const S = begin ? 1 : 0;
  const pvFactor = state.flagC ? Math.pow(1 + r, f) : 1 + r * f;
  const disc = Math.pow(1 + r, -k);
  const annuity = Math.abs(r) < 1e-12 ? k : (1 - disc) / r;
  const pmtCoef = (1 + r * S) * annuity;
  if (target === "FV") return disc === 0 ? NaN : -(pv * pvFactor + pmt * pmtCoef) / disc;
  if (target === "PV") return pvFactor === 0 ? NaN : -(pmt * pmtCoef + fv * disc) / pvFactor;
  if (target === "PMT") return pmtCoef === 0 ? NaN : -(pv * pvFactor + fv * disc) / pmtCoef;
  return NaN;
}

function annuityFactor(n, r) {
  if (Math.abs(r) < 1e-12) return n;
  return (Math.pow(1 + r, n) - 1) / r;
}

function paymentFactor(n, r, begin) {
  return annuityFactor(n, r) * (1 + r * (begin ? 1 : 0));
}

function solveFV(n, r, pv, pmt, begin) {
  const q = Math.pow(1 + r, n);
  return -(pv * q + pmt * paymentFactor(n, r, begin));
}

function solvePV(n, r, pmt, fv, begin) {
  const q = Math.pow(1 + r, n);
  return -(fv + pmt * paymentFactor(n, r, begin)) / q;
}

function solvePMT(n, r, pv, fv, begin) {
  const q = Math.pow(1 + r, n);
  const factor = paymentFactor(n, r, begin);
  return factor === 0 ? NaN : -(pv * q + fv) / factor;
}

// A HP 12C arredonda o n CALCULADO para inteiro: se a parte fracionária for menor
// que 0,005 arredonda para baixo; caso contrário para cima (quirk documentado).
function arredondarN(n) {
  if (!Number.isFinite(n)) return n;
  const piso = Math.floor(n);
  return n - piso < 0.005 ? piso : Math.ceil(n);
}

function solveN(r, pv, pmt, fv, begin) {
  if (Math.abs(r) < 1e-12) return pmt === 0 ? NaN : -(pv + fv) / pmt;
  const c = pmt * (1 + r * (begin ? 1 : 0));
  const ratio = (c / r - fv) / (pv + c / r);
  const n = Math.log(ratio) / Math.log(1 + r);
  if (Number.isFinite(n) && n >= 0) return n;
  return solveRoot((periods) => tvmEquation(r, periods, pv, pmt, fv, begin), 0, 1200);
}

function solveRate(n, pv, pmt, fv, begin) {
  return solveRateWith((rate) => tvmEquation(rate, n, pv, pmt, fv, begin));
}

function solveRateWith(f) {
  if (Math.abs(f(0)) < 1e-7) return 0;

  const newton = newtonRate(f, 0.01);
  if (Number.isFinite(newton) && newton > -1 && Math.abs(f(newton)) < 1e-6) {
    return newton;
  }

  const points = [];
  for (let rate = -0.99; rate <= 1.0001; rate += 0.01) points.push(rate);
  for (let rate = 1.08; rate <= 10; rate *= 1.25) points.push(rate);
  points.sort((a, b) => Math.abs(a) - Math.abs(b));

  const intervals = [];
  let previousRate = points[0];
  let previousValue = f(previousRate);
  for (let index = 1; index < points.length; index += 1) {
    const currentRate = points[index];
    const currentValue = f(currentRate);
    if (Number.isFinite(previousValue) && Number.isFinite(currentValue)) {
      if (previousValue === 0) return previousRate;
      if (Math.sign(previousValue) !== Math.sign(currentValue)) {
        intervals.push([previousRate, currentRate]);
      }
    }
    previousRate = currentRate;
    previousValue = currentValue;
  }

  intervals.sort((a, b) => Math.abs((a[0] + a[1]) / 2) - Math.abs((b[0] + b[1]) / 2));
  if (!intervals.length) return NaN;
  return bisect(f, intervals[0][0], intervals[0][1]);
}

function newtonRate(fn, guess) {
  let rate = guess;
  for (let i = 0; i < 40; i += 1) {
    const value = fn(rate);
    const h = Math.max(1e-6, Math.abs(rate) * 1e-5);
    const derivative = (fn(rate + h) - fn(rate - h)) / (2 * h);
    if (!Number.isFinite(value) || !Number.isFinite(derivative) || derivative === 0) return NaN;
    const next = rate - value / derivative;
    if (next <= -0.999999 || next > 10) return NaN;
    if (Math.abs(next - rate) < 1e-12) return next;
    rate = next;
  }
  return rate;
}

function tvmEquation(r, n, pv, pmt, fv, begin) {
  if (Math.abs(r) < 1e-12) return pv + pmt * n + fv;
  const q = Math.pow(1 + r, n);
  return pv * q + pmt * (1 + r * (begin ? 1 : 0)) * ((q - 1) / r) + fv;
}

function solveRoot(fn, min, max) {
  const steps = 300;
  let left = min;
  let leftValue = fn(left);
  for (let i = 1; i <= steps; i += 1) {
    const right = min + ((max - min) * i) / steps;
    const rightValue = fn(right);
    if (Number.isFinite(leftValue) && Number.isFinite(rightValue) && Math.sign(leftValue) !== Math.sign(rightValue)) {
      return bisect(fn, left, right);
    }
    left = right;
    leftValue = rightValue;
  }
  return NaN;
}

function bisect(fn, left, right) {
  let leftValue = fn(left);
  for (let i = 0; i < 100; i += 1) {
    const mid = (left + right) / 2;
    const midValue = fn(mid);
    if (Math.abs(midValue) < 1e-10 || Math.abs(right - left) < 1e-12) return mid;
    if (Math.sign(leftValue) === Math.sign(midValue)) {
      left = mid;
      leftValue = midValue;
    } else {
      right = mid;
    }
  }
  return (left + right) / 2;
}

// VPL (NPV) do fluxo de caixa armazenado (cf[0]=CF0 em t=0; cf[j] repetido cfN[j]
// vezes em períodos consecutivos), à taxa periódica taxaPct (%). Usado por NPV e IRR.
function valorPresenteLiquido(taxaPct) {
  const r = taxaPct / 100;
  let t = 0;
  let npv = state.cf.length ? state.cf[0] : 0;
  for (let j = 1; j < state.cf.length; j += 1) {
    const vezes = state.cfN[j] || 1;
    for (let k = 0; k < vezes; k += 1) {
      t += 1;
      npv += state.cf[j] / Math.pow(1 + r, t);
    }
  }
  return npv;
}

// --- Depreciação ---
// Depreciação do ano `ano` (vem do display); valor depreciável remanescente em Y.
// PV=custo, FV=salvado, n=vida; DB usa i (%) como fator. Guia, p.84–85.
function depreciacao(metodo) {
  commitEntry();
  const ano = Math.round(state.stack.x);
  const custo = state.tvm.PV;
  const salvado = state.tvm.FV;
  const vida = state.tvm.n;
  const base = custo - salvado;
  let dep = 0;
  let remanescente = 0;
  if (metodo === "SL") {
    dep = base / vida;
    remanescente = base - ano * dep;
  } else if (metodo === "SOYD") {
    const soma = (vida * (vida + 1)) / 2;
    dep = (base * (vida - ano + 1)) / soma;
    let acum = 0;
    for (let k = 1; k <= ano; k += 1) acum += (base * (vida - k + 1)) / soma;
    remanescente = base - acum;
  } else {
    const taxa = state.tvm.i / 100 / vida;
    let book = custo;
    for (let k = 1; k < ano; k += 1) book -= book * taxa;
    dep = book * taxa;
    remanescente = book - dep - salvado;
  }
  state.stack.y = remanescente;
  setX(dep);
  state.liftStack = true;
  flash(metodo);
}

// --- Estatística ---
// Σ+ acumula o par (x = display, y = registrador Y) nos registradores R1–R6.
function acumularEstatistica() {
  commitEntry();
  const x = state.stack.x;
  const y = state.stack.y;
  const s = state.stats;
  s.n += 1;
  s.sx += x;
  s.sx2 += x * x;
  s.sy += y;
  s.sy2 += y * y;
  s.sxy += x * y;
  setX(s.n);
  state.liftStack = false;
  flash("Σ+");
}

// Coeficientes da reta de regressão y = A + B·x e correlação r.
function regressao() {
  const s = state.stats;
  const Sxx = s.n * s.sx2 - s.sx * s.sx;
  const Syy = s.n * s.sy2 - s.sy * s.sy;
  const Sxy = s.n * s.sxy - s.sx * s.sy;
  const B = Sxx === 0 ? 0 : Sxy / Sxx;
  const A = s.n === 0 ? 0 : (s.sy - B * s.sx) / s.n;
  const r = Sxx * Syy <= 0 ? 0 : Sxy / Math.sqrt(Sxx * Syy);
  return { A, B, r };
}

// --- Calendário ---
// Número-de-dia (contínuo) de uma data gregoriana, p/ diferenças e dia-da-semana.
function diasJulianos({ y, m, d }) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  );
}

// Inverso de diasJulianos: número-de-dia -> { y, m, d } (gregoriano).
function dataDeJulianos(jdn) {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    d: e - Math.floor((153 * m + 2) / 5) + 1,
    m: m + 3 - 12 * Math.floor(m / 10),
    y: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

function mais6meses({ y, m, d }) {
  let mm = m + 6;
  let yy = y;
  if (mm > 12) {
    mm -= 12;
    yy += 1;
  }
  return { y: yy, m: mm, d };
}

function menos6meses({ y, m, d }) {
  let mm = m - 6;
  let yy = y;
  if (mm < 1) {
    mm += 12;
    yy -= 1;
  }
  return { y: yy, m: mm, d };
}

// Preço de título (SIA, cupom semestral, base actual/actual, resgate=100).
// Y = yield anual %, CPN = cupom anual %. Retorna { clean, accrued }.
function precoLimpoTitulo(Y, liq, venc, CPN) {
  const jdnLiq = diasJulianos(liq);
  const jdnVenc = diasJulianos(venc);
  let prev = { y: venc.y, m: venc.m, d: venc.d };
  while (diasJulianos(prev) > jdnLiq) prev = menos6meses(prev);
  const next = mais6meses(prev);
  const E = diasJulianos(next) - diasJulianos(prev);
  const DSC = diasJulianos(next) - jdnLiq;
  const A = E - DSC;
  let N = 0;
  let c = { y: next.y, m: next.m, d: next.d };
  while (diasJulianos(c) <= jdnVenc) {
    N += 1;
    c = mais6meses(c);
  }
  const yld = Y / 200;
  let pv = 100 / Math.pow(1 + yld, N - 1 + DSC / E);
  for (let k = 1; k <= N; k += 1) {
    pv += CPN / 2 / Math.pow(1 + yld, k - 1 + DSC / E);
  }
  const accrued = (A / E) * (CPN / 2);
  return { clean: pv - accrued, accrued };
}

// Interpreta um número como data conforme o formato (mdy: M.DDYYYY; dmy: D.MMYYYY).
function parseDate(num, fmt) {
  const inteiro = Math.trunc(Math.abs(num));
  const frac = Math.abs(num).toFixed(6).split(".")[1] || "000000";
  const ddmm = parseInt(frac.slice(0, 2), 10);
  const ano = parseInt(frac.slice(2, 6), 10);
  if (fmt === "dmy") return { y: ano, m: ddmm, d: inteiro };
  return { y: ano, m: inteiro, d: ddmm };
}

// Dias entre datas pela base 30/360.
function dias360(d1, d2) {
  let a = d1.d;
  let b = d2.d;
  if (a === 31) a = 30;
  if (b === 31 && a === 30) b = 30;
  return (d2.y - d1.y) * 360 + (d2.m - d1.m) * 30 + (b - a);
}

function resetFinancial() {
  state.tvm.n = 0;
  state.tvm.i = 0;
  state.tvm.PV = 0;
  state.tvm.PMT = 0;
  state.tvm.FV = 0;
  state.memory = 0;
}

// AMORT (f+n): amortiza os próximos `count` pagamentos (count vem do display).
// Cada parcela: juros = arred(saldo × i/100) às casas do FIX; principal = -PMT -
// juros; saldo -= principal. Atualiza PV (saldo) e n (total amortizado). Deixa o
// total de juros em X e o total de principal em Y (x≷y mostra o principal). O
// sinal segue o do PMT (saída de caixa => negativo). Guia, p.69–71.
function amortize() {
  commitEntry();
  const count = Math.round(state.stack.x);
  const taxa = state.tvm.i / 100;
  const pmt = state.tvm.PMT;
  const fator = Math.pow(10, state.fixed);
  const arred = (v) => Math.round(v * fator) / fator;

  let totalJuros = 0;
  let totalPrincipal = 0;
  for (let j = 0; j < count; j += 1) {
    const semJuros = state.tvm.begin && (state.tvm.n || 0) === 0 && j === 0;
    const juros = semJuros ? 0 : arred(state.tvm.PV * taxa);
    const principal = -pmt - juros;
    state.tvm.PV -= principal;
    totalJuros += juros;
    totalPrincipal += principal;
  }
  state.tvm.n = (state.tvm.n || 0) + count;

  const sinal = pmt < 0 ? -1 : 1;
  state.stack.y = sinal * totalPrincipal;
  setX(sinal * totalJuros);
  state.liftStack = true;
  flash("AMORT");
}

function clearAll() {
  state.stack = { x: 0, y: 0, z: 0, t: 0 };
  state.entry = "";
  state.entryActive = false;
  state.pendingOperator = null;
  state.pendingValue = null;
  state.pendingStore = false;
  state.pendingRecall = false;
  state.pendingStoreOp = null;
  state.shift = null;
  state.liftStack = false;
  clearError();
  flash("ON");
}

// Liga/desliga a calculadora (tecla ON). Desligada, a tela apaga e só o ON
// volta a responder; o estado/memória são preservados ao religar.
function togglePower() {
  state.power = !state.power;
  state.shift = null;
  if (state.power) {
    clearError();
    flash("ON");
  } else {
    if (state.noticeTimer) {
      window.clearTimeout(state.noticeTimer);
      state.noticeTimer = null;
    }
    state.notice = "";
  }
}

// A HP 12C exibe "Error" seguido de um dígito (Apêndice D): 0 matemática,
// 2 estatística, 3 IRR, etc. Default 0 (operação matemática imprópria).
function setError(codigo = "0") {
  state.error = `Error ${codigo}`;
  state.entry = "";
  state.entryActive = false;
}

function clearError() {
  state.error = "";
}

function flash(message) {
  state.notice = message;
  if (state.noticeTimer) window.clearTimeout(state.noticeTimer);
  state.noticeTimer = window.setTimeout(() => {
    state.notice = "";
    updateUI();
  }, 900);
}

function normalizeZero(value) {
  return Object.is(value, -0) || Math.abs(value) < 1e-12 ? 0 : value;
}

// A HP 12C opera com 10 dígitos significativos (BCD): cada resultado é arredondado
// a 10 algarismos. Por isso √2 x² = 1,999999999 e 1/3 ×3 = 0,9999999999 na máquina
// real. Os solvers iterativos usam precisão plena internamente; só o resultado
// exibido/armazenado passa por aqui.
function arredondar10(value) {
  if (!Number.isFinite(value) || value === 0) return value;
  const exp = Math.floor(Math.log10(Math.abs(value)));
  if (exp > 99 || exp < -99) return value; // overflow/underflow tratados em outro lugar
  const fator = Math.pow(10, 9 - exp);
  return Math.round(value * fator) / fator;
}

function formatRaw(value) {
  if (!Number.isFinite(value)) return "0";
  return String(Number(value.toPrecision(12)));
}

function formatDisplayValue(value) {
  if (!Number.isFinite(value)) return "Error";
  const normalized = normalizeZero(value);
  const abs = Math.abs(normalized);
  if (abs !== 0 && integerDigitCount(abs) > DISPLAY_DIGIT_LIMIT) {
    return formatExponentialDisplay(normalized);
  }

  let decimals = state.fixed;
  let text = formatGroupedDecimal(normalized, decimals);
  while (countDigits(text) > DISPLAY_DIGIT_LIMIT && decimals > 0) {
    decimals -= 1;
    text = formatGroupedDecimal(normalized, decimals);
  }
  if (countDigits(text) > DISPLAY_DIGIT_LIMIT) {
    return formatExponentialDisplay(normalized);
  }
  return text;
}

function formatEntryDisplay(entry) {
  if (!entry) return "0";
  if (/[eE]/.test(entry)) return entry.replace("e", "E").replace(".", DECIMAL_SEPARATOR);

  const isNegative = entry.startsWith("-");
  const unsigned = isNegative ? entry.slice(1) : entry;
  const hasDecimal = unsigned.includes(".");
  const [integer = "0", fraction = ""] = unsigned.split(".");
  const groupedInteger = groupInteger(integer || "0");
  return `${isNegative ? "-" : ""}${groupedInteger}${hasDecimal ? `${DECIMAL_SEPARATOR}${fraction}` : ""}`;
}

function formatGroupedDecimal(value, decimals) {
  const isNegative = value < 0;
  const fixed = Math.abs(value).toFixed(decimals);
  const [integer, fraction = ""] = fixed.split(".");
  const groupedInteger = groupInteger(integer);
  return `${isNegative ? "-" : ""}${groupedInteger}${decimals > 0 ? `${DECIMAL_SEPARATOR}${fraction}` : ""}`;
}

function formatExponentialDisplay(value) {
  let decimals = Math.min(5, state.fixed + 2);
  while (decimals >= 0) {
    const text = value.toExponential(decimals).replace("+", "").replace(".", DECIMAL_SEPARATOR).toUpperCase();
    if (text.replace("-", "").length <= DISPLAY_DIGIT_LIMIT) return text;
    decimals -= 1;
  }
  return value.toExponential(0).replace("+", "").replace(".", DECIMAL_SEPARATOR).toUpperCase();
}

function groupInteger(integer) {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
}

function countDigits(text) {
  return (text.match(/\d/g) || []).length;
}

function integerDigitCount(value) {
  if (value < 1) return 1;
  return Math.floor(Math.log10(value)) + 1;
}

function formatRegister(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return formatDisplayValue(value);
}

// ===== Modo Programa (Parte II do guia) =====
// Keycode de cada tecla (linha-posição do teclado). Dígitos exibem o próprio dígito.
const KEYCODES = {
  "tvm:n": "11", "tvm:i": "12", "tvm:PV": "13", "tvm:PMT": "14", "tvm:FV": "15",
  chs: "16", "op:/": "10",
  pow: "21", reciprocal: "22", "percent-total": "23", "delta-percent": "24",
  percent: "25", eex: "26", "op:*": "20",
  "run-stop": "31", sst: "32", roll: "33", swap: "34", "clear-entry": "35",
  enter: "36", "op:-": "30",
  power: "41", "shift:f": "42", "shift:g": "43", sto: "44", rcl: "45",
  decimal: "48", "sum-plus": "49", "op:+": "40",
};

function keycodeFor(action) {
  if (action.startsWith("digit:")) return action.slice(6);
  return KEYCODES[action] || "??";
}

function togglePrgm() {
  state.prgmMode = !state.prgmMode;
  if (state.prgmMode) {
    state.shift = null;
    state.pendingGoto = null;
    mostrarLinhaPrograma();
  } else {
    state.pointer = 0;
    state.displayOverride = null;
  }
}

function mostrarLinhaPrograma() {
  const linha = String(state.pointer).padStart(3, "0");
  if (state.pointer === 0) {
    state.displayOverride = `${linha},`;
    return;
  }
  const instr = state.program[state.pointer - 1];
  state.displayOverride = instr ? `${linha}, ${instr.keycode}` : `${linha}, 43,33,000`;
}

function handleProgramMode(action, shift) {
  if (state.pendingGoto) {
    programGoto(action);
    return;
  }
  if (state.prgmAcc) {
    acumularInstrucao(action);
    return;
  }
  if (shift === "f" && action === "roll") return limparPrograma(); // CLEAR PRGM
  if (shift === "g" && action === "roll") {
    state.pendingGoto = { dot: false, digits: "" }; // GTO
    return;
  }
  if (shift === "g" && action === "sst") return passoPrograma(-1); // BST
  if (shift === "g" && action === "digit:9") return mostrarMem(); // MEM
  if (!shift && action === "sst") return passoPrograma(1); // SST
  // STO/RCL iniciam uma instrução multi-tecla (ex.: STO + 1, RCL 0) numa só linha.
  if (!shift && (action === "sto" || action === "rcl")) {
    state.prgmAcc = { actions: [action], keycodes: [keycodeFor(action)], expectOp: false };
    return;
  }
  gravarInstrucao(action, shift);
}

// A memória de programa da 12C Platinum vai até 400 linhas; ao esgotar, gravar
// gera Error 4 (memória cheia).
const LIMITE_LINHAS = 400;
function memoriaCheia() {
  if (state.pointer >= LIMITE_LINHAS) {
    state.displayOverride = "Error 4";
    return true;
  }
  return false;
}

function acumularInstrucao(action) {
  const acc = state.prgmAcc;
  acc.actions.push(action);
  acc.keycodes.push(keycodeFor(action));
  // STO/RCL seguido de operador (+ - × ÷) ainda espera o dígito do registrador.
  if (!acc.expectOp && action.startsWith("op:")) {
    acc.expectOp = true;
    return;
  }
  state.prgmAcc = null;
  if (memoriaCheia()) return;
  state.pointer += 1;
  state.program[state.pointer - 1] = { actions: acc.actions, keycode: acc.keycodes.join(" ") };
  mostrarLinhaPrograma();
}

function gravarInstrucao(action, shift) {
  if (memoriaCheia()) return;
  const actions = shift ? [`shift:${shift}`, action] : [action];
  const keycode = shift ? `${KEYCODES[`shift:${shift}`]} ${keycodeFor(action)}` : keycodeFor(action);
  const instr = { actions, keycode };
  // Testes condicionais (Seção 9): g x≤y (g+swap) e g x=0 (g+CLx).
  if (shift === "g" && action === "swap") {
    instr.isCond = true;
    instr.cond = "x<=y";
  }
  if (shift === "g" && action === "clear-entry") {
    instr.isCond = true;
    instr.cond = "x=0";
  }
  state.pointer += 1;
  state.program[state.pointer - 1] = instr;
  mostrarLinhaPrograma();
}

function passoPrograma(delta) {
  const max = Math.max(state.program.length, 8);
  state.pointer = Math.min(max, Math.max(0, state.pointer + delta));
  mostrarLinhaPrograma();
}

function programGoto(action) {
  const g = state.pendingGoto;
  if (action === "decimal") {
    g.dot = true; // g GTO . nnn = posiciona (edição); sem ponto = grava desvio
    return;
  }
  if (action.startsWith("digit:")) {
    g.digits += action.slice(6);
    if (g.digits.length >= 3) {
      const nnn = Number(g.digits);
      if (g.dot) {
        state.pointer = nnn; // posiciona o cursor de edição
      } else if (memoriaCheia()) {
        state.pendingGoto = null;
        return;
      } else {
        // grava uma instrução de desvio: g GTO nnn (keycode 43,33,nnn)
        state.pointer += 1;
        state.program[state.pointer - 1] = {
          actions: [],
          keycode: `43,33,${String(nnn).padStart(3, "0")}`,
          isGoto: true,
          target: nnn,
        };
      }
      state.pendingGoto = null;
      mostrarLinhaPrograma();
    }
    return;
  }
  state.pendingGoto = null;
}

// g GTO nnn em Run mode: só reposiciona o ponteiro (sem gravar; display inalterado).
function runGoto(action) {
  const g = state.pendingGoto;
  if (action === "decimal") return;
  if (action.startsWith("digit:")) {
    g.digits += action.slice(6);
    if (g.digits.length >= 3) {
      state.pointer = Number(g.digits);
      state.pendingGoto = null;
    }
    return;
  }
  state.pendingGoto = null;
}

// Avalia um teste condicional no estado atual da pilha (regra DO-if-TRUE).
function avaliarCondicao(cond) {
  if (cond === "x=0") return state.stack.x === 0;
  return state.stack.x <= state.stack.y; // x<=y
}

function limparPrograma() {
  state.program = [];
  state.pointer = 0;
  mostrarLinhaPrograma();
}

function mostrarMem() {
  const linhas = Math.max(state.program.length, 8);
  state.displayOverride = `P-${String(linhas).padStart(3, "0")}  r-20`;
}

// Executa a instrução na linha pc (índice 0-based) e devolve o próximo pc.
// Retorna -1 para haltar: GTO 000, instrução R/S, fim do programa ou Error.
function executarInstrucao(pc) {
  const instr = state.program[pc];
  if (!instr) return -1;
  if (instr.isGoto) return instr.target === 0 ? -1 : instr.target - 1; // desvio
  if (instr.isCond) return pc + (avaliarCondicao(instr.cond) ? 1 : 2); // DO-if-TRUE
  if (instr.actions.length === 1 && instr.actions[0] === "run-stop") {
    state.resumeAt = pc + 1; // R/S: pára e marca a linha seguinte para retomar
    return -1;
  }
  for (const a of instr.actions) handleAction(a);
  return state.error ? -1 : pc + 1;
}

// Define o ponteiro após uma parada: se foi um R/S no programa, retoma na linha
// seguinte ao pressionar R/S de novo; senão (GTO 000 / fim / erro) reinicia em 000.
function pararPrograma() {
  state.running = false;
  if (state.resumeAt >= 0 && state.resumeAt < state.program.length) {
    state.pointer = state.resumeAt + 1; // 1-based: próxima execução começa em resumeAt
  } else {
    state.pointer = 0;
  }
  state.resumeAt = -1;
}

function runProgram() {
  // R/S termina a entrada do dado e deixa a pilha pronta (o 1º RCL/número levanta).
  commitEntry();
  state.liftStack = true;
  state.running = true;
  state.resumeAt = -1;
  // ponteiro 0 = linha 000 (roda da linha 001); ponteiro nnn = roda da linha nnn.
  let pc = state.pointer === 0 ? 0 : state.pointer - 1;
  let guarda = 0;
  while (pc >= 0 && pc < state.program.length && guarda < 10000) {
    guarda += 1;
    pc = executarInstrucao(pc);
  }
  pararPrograma();
}

// SST em Run mode: executa UMA instrução (single-step de depuração). O 1º passo
// termina a entrada do dado; passos seguintes preservam a entrada (dígitos em
// linhas consecutivas acumulam, como na 12C real).
function passoSST() {
  if (state.pointer === 0) {
    commitEntry();
    state.liftStack = true;
  }
  state.resumeAt = -1;
  let pc = state.pointer === 0 ? 0 : state.pointer - 1;
  if (pc < 0 || pc >= state.program.length) {
    state.pointer = 0;
    return;
  }
  state.running = true;
  const prox = executarInstrucao(pc);
  state.running = false;
  if (state.resumeAt >= 0 && state.resumeAt < state.program.length) {
    state.pointer = state.resumeAt + 1; // passo sobre R/S: segue na linha seguinte
  } else {
    state.pointer = prox < 0 || prox >= state.program.length ? 0 : prox + 1;
  }
  state.resumeAt = -1;
}

function currentDisplayText() {
  if (state.error) return state.error;
  if (state.entryActive) return formatEntryDisplay(state.entry);
  if (state.displayMode === "sci") return formatScientific(state.stack.x);
  return formatDisplayValue(state.stack.x);
}

// Notação científica: mantissa (1 dígito + até 6 decimais) + 2 dígitos de expoente.
function formatScientific(value) {
  const v = normalizeZero(value);
  if (!Number.isFinite(v)) return "Error";
  if (v === 0) return `0${DECIMAL_SEPARATOR}000000 00`;
  const neg = v < 0;
  const abs = Math.abs(v);
  let exp = Math.floor(Math.log10(abs));
  let mant = Number((abs / Math.pow(10, exp)).toFixed(6));
  if (mant >= 10) {
    mant /= 10;
    exp += 1;
  }
  const mantStr = mant.toFixed(6).replace(".", DECIMAL_SEPARATOR);
  const expStr = String(Math.abs(exp)).padStart(2, "0");
  return `${neg ? "-" : ""}${mantStr}${exp < 0 ? "-" : " "}${expStr}`;
}

// Mantissa (f CLEAR PREFIX): os 10 dígitos significativos, sem separador decimal.
function formatMantissa(value) {
  const v = normalizeZero(value);
  if (!Number.isFinite(v)) return "Error";
  if (v === 0) return "0000000000";
  const abs = Math.abs(v);
  const exp = Math.floor(Math.log10(abs));
  const digitos = Math.round((abs / Math.pow(10, exp)) * 1e9)
    .toString()
    .padEnd(10, "0")
    .slice(0, 10);
  return `${v < 0 ? "-" : ""}${digitos}`;
}

function toScreenText(text) {
  return text;
}

function updateUI() {
  if (!state.power) {
    display.textContent = "";
    fitDisplayText("");
    shiftIndicator.textContent = "";
    shiftIndicator.className = "";
    modeIndicator.textContent = "";
    angleIndicator.textContent = "";
    prgmIndicator.textContent = "";
    dmyIndicator.textContent = "";
    cIndicator.textContent = "";
    pendingIndicator.textContent = "";
    return;
  }

  const screenText = toScreenText(currentDisplayText());
  display.textContent = screenText;
  fitDisplayText(screenText);
  if (state.displayOverride) display.textContent = state.displayOverride;

  const shiftVisivel = getHeldShift() || state.shift;
  shiftIndicator.textContent = shiftVisivel || "";
  shiftIndicator.className = shiftVisivel ? `shift-${shiftVisivel}` : "";
  modeIndicator.textContent = state.notice || state.mode.toUpperCase();
  // Anunciadores de status do LCD (fiel à 12C: só acendem quando ativos).
  angleIndicator.textContent = state.tvm.begin ? "BEGIN" : "";
  prgmIndicator.textContent = state.prgmMode ? "PRGM" : "";
  dmyIndicator.textContent = state.dateFormat === "dmy" ? "D.MY" : "";
  cIndicator.textContent = state.flagC ? "C" : "";
  pendingIndicator.textContent = state.pendingOperator ? state.pendingOperator.replace("pow", "y^x") : "";

  document.querySelectorAll("[data-mode]").forEach((button) => {
    const pressed = button.dataset.mode === state.mode;
    button.setAttribute("aria-pressed", String(pressed));
  });

  document.querySelectorAll(".key").forEach((button) => {
    const action = button.dataset.action;
    button.classList.toggle("is-armed", action === `shift:${state.shift}`);
  });

  Object.entries(state.stack).forEach(([register, value]) => {
    const element = document.querySelector(`[data-stack="${register}"]`);
    if (element) element.textContent = formatRegister(value);
  });

  ["n", "i", "PV", "PMT", "FV"].forEach((field) => {
    const element = document.querySelector(`[data-tvm="${field}"]`);
    if (element) element.textContent = formatRegister(state.tvm[field]);
  });

  document.querySelector("[data-memory]").textContent = formatRegister(state.memory);

  const pendingStatus = state.pendingStore
    ? "STO"
    : state.pendingRecall
      ? "RCL"
      : state.pendingOperator
        ? state.pendingOperator.replace("pow", "y^x")
        : "--";

  const statusValues = {
    mode: state.mode.toUpperCase(),
    shift: shiftVisivel ? shiftVisivel.toUpperCase() : "--",
    fixed: String(state.fixed),
    begin: state.tvm.begin ? "BEG" : "END",
    pending: pendingStatus,
  };

  Object.entries(statusValues).forEach(([field, value]) => {
    const element = document.querySelector(`[data-status="${field}"]`);
    if (element) element.textContent = value;
  });

  persistirEstado();
}

function persistirEstado() {
  if (typeof localStorage === "undefined") return;
  try {
    const dados = {};
    for (const k of PERSIST_KEYS) dados[k] = state[k];
    localStorage.setItem(PERSIST_CHAVE, JSON.stringify(dados));
  } catch {
    /* localStorage indisponível/cheio: ignora (não quebra a calculadora). */
  }
}

function hidratarEstado() {
  if (typeof localStorage === "undefined") return;
  try {
    const bruto = localStorage.getItem(PERSIST_CHAVE);
    if (!bruto) return;
    const dados = JSON.parse(bruto);
    for (const k of PERSIST_KEYS) {
      if (dados[k] !== undefined && dados[k] !== null) state[k] = dados[k];
    }
    aplicarSeparador(); // sincroniza o separador restaurado
  } catch {
    /* JSON corrompido/indisponível: começa do estado padrão. */
  }
}

function fitDisplayText(text) {
  const scale = Math.min(1, DISPLAY_DIGIT_LIMIT / Math.max(text.length, 1));
  display.style.setProperty("--display-font-size", `${(DISPLAY_BASE_FONT_CQW * scale).toFixed(3)}cqw`);
}
