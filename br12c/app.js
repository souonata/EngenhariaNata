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
    { main: "6", f: "", g: "Σw", action: "digit:6", tone: "number" },
    { main: "×", f: "", g: "x²", action: "op:*", tone: "operator" },
  ],
  [
    { main: "R/S", f: "P/R", g: "PSE", action: "noop" },
    { main: "SST", f: "Σ", g: "BST", action: "noop" },
    { main: "R↓", f: "PRGM", g: "GTO", action: "roll" },
    { main: "x≷y", f: "FIN", g: "x≤y", action: "swap" },
    { main: "CLx", f: "REG", g: "x=0", action: "clear-entry" },
    { main: "ENTER", f: "PREFIX", g: "", action: "enter", tone: "operator" },
    { main: "1", f: "", g: "", action: "digit:1", tone: "number" },
    { main: "2", f: "", g: "", action: "digit:2", tone: "number" },
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
    { main: "Σ+", f: "", g: "Σ-", action: "percent-total", tone: "number" },
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
const DECIMAL_SEPARATOR = ",";
const THOUSANDS_SEPARATOR = ".";
const LONG_PRESS_HOLD_MS = 520;
const SYNTHETIC_CLICK_SUPPRESSION_MS = 700;
let lastTouchActivationAt = 0;
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
  registers: {},
  shift: null,
  fixed: 2,
  memory: 0,
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

const display = document.querySelector("#display");
const keyboard = document.querySelector("#keyboard");
const shiftIndicator = document.querySelector("#shiftIndicator");
const modeIndicator = document.querySelector("#modeIndicator");
const angleIndicator = document.querySelector("#angleIndicator");
const pendingIndicator = document.querySelector("#pendingIndicator");

renderKeyboard();
attachEvents();
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
    box("R/S", "noop", 0, 2),
    box("SST", "noop", 1, 2),
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
    box("sum plus", "percent-total", 8, 3),
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
    if (action === "enter") {
      flash("PREFIX");
      return true;
    }
    // FIX n = f + dígito (0–9).
    if (action.startsWith("digit:")) {
      state.fixed = Number(action.slice(6));
      flash(`FIX ${state.fixed}`);
      return true;
    }
    // RND = f+PMT (arredonda X às casas do display).
    if (action === "tvm:PMT") {
      commitEntry();
      const fator = Math.pow(10, state.fixed);
      setX(Math.round(state.stack.x * fator) / fator);
      flash("RND");
      return true;
    }
    // Demais funções f (AMORT, INT, NPV, IRR, PRICE, YTM, SL, SOYD, DB, ...)
    // chegam nos capítulos seguintes; por ora consome o prefixo (não dispara a
    // função primária da tecla por engano).
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
    // Demais funções g (calendário, estatística, programa) — capítulos seguintes.
    return true;
  }

  flash(shift.toUpperCase());
  return false;
}

// CLEAR REG (f+CLx): zera registradores de dados, financeiros, pilha e display.
function clearRegisters() {
  state.registers = {};
  resetFinancial();
  state.stack = { x: 0, y: 0, z: 0, t: 0 };
  state.entry = "";
  state.entryActive = false;
  state.pendingOperator = null;
  state.pendingValue = null;
  state.pendingStore = false;
  state.pendingRecall = false;
  state.pendingStoreOp = null;
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

  const result = calculate(state.stack.y, state.stack.x, operator);
  state.stack.x = result;
  state.stack.y = state.stack.z;
  state.stack.z = state.stack.t;
  state.liftStack = true;
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
  setX(fn(state.stack.x));
  state.liftStack = true;
}

function setX(value) {
  if (!Number.isFinite(value)) {
    setError();
    return;
  }
  state.stack.x = normalizeZero(value);
}

function percent() {
  commitEntry();
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
  const base = state.stack.y;
  setX(base === 0 ? NaN : ((state.stack.x - base) / base) * 100);
  state.liftStack = true;
}

function percentTotal() {
  commitEntry();
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
  flash("STO");
}

function beginRecall() {
  state.pendingRecall = true;
  state.pendingStore = false;
  flash("RCL");
}

function handleRegisterTarget(action) {
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
        state.registers[reg] = aplicarOperacao(state.pendingStoreOp, atual, state.stack.x);
        flash(`STO ${state.pendingStoreOp} ${reg}`);
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
      return b === 0 ? a : a / b;
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
  if (state.entryActive) {
    commitEntry();
    state.tvm[field] = state.stack.x;
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

  try {
    let value;
    if (target === "FV") value = solveFV(n, r, pv, pmt, begin);
    if (target === "PV") value = solvePV(n, r, pmt, fv, begin);
    if (target === "PMT") value = solvePMT(n, r, pv, fv, begin);
    if (target === "n") value = solveN(r, pv, pmt, fv, begin);
    if (target === "i") value = solveRate(n, pv, pmt, fv, begin) * 100;

    if (!Number.isFinite(value)) return { ok: false };
    return { ok: true, value: normalizeZero(value) };
  } catch {
    return { ok: false };
  }
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

function solveN(r, pv, pmt, fv, begin) {
  if (Math.abs(r) < 1e-12) return pmt === 0 ? NaN : -(pv + fv) / pmt;
  const c = pmt * (1 + r * (begin ? 1 : 0));
  const ratio = (c / r - fv) / (pv + c / r);
  const n = Math.log(ratio) / Math.log(1 + r);
  if (Number.isFinite(n) && n >= 0) return n;
  return solveRoot((periods) => tvmEquation(r, periods, pv, pmt, fv, begin), 0, 1200);
}

function solveRate(n, pv, pmt, fv, begin) {
  const f = (rate) => tvmEquation(rate, n, pv, pmt, fv, begin);
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

function resetFinancial() {
  state.tvm.n = 0;
  state.tvm.i = 0;
  state.tvm.PV = 0;
  state.tvm.PMT = 0;
  state.tvm.FV = 0;
  state.memory = 0;
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

function setError() {
  state.error = "Error";
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

function currentDisplayText() {
  if (state.error) return state.error;
  if (state.entryActive) return formatEntryDisplay(state.entry);
  return formatDisplayValue(state.stack.x);
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
    pendingIndicator.textContent = "";
    return;
  }

  const screenText = toScreenText(currentDisplayText());
  display.textContent = screenText;
  fitDisplayText(screenText);

  const shiftVisivel = getHeldShift() || state.shift;
  shiftIndicator.textContent = shiftVisivel || "";
  shiftIndicator.className = shiftVisivel ? `shift-${shiftVisivel}` : "";
  modeIndicator.textContent = state.notice || state.mode.toUpperCase();
  angleIndicator.textContent = state.tvm.begin ? "BEG" : "END";
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
}

function fitDisplayText(text) {
  const scale = Math.min(1, DISPLAY_DIGIT_LIMIT / Math.max(text.length, 1));
  display.style.setProperty("--display-font-size", `${(DISPLAY_BASE_FONT_CQW * scale).toFixed(3)}cqw`);
}
