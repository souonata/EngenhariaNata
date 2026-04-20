/**
 * iluminacao-script.js
 * Calculadora de Iluminação Residencial (multiambiente)
 */

import { App } from "../src/core/app.js";
import { i18n } from "../src/core/i18n.js";
import { formatarNumero, formatarMoeda } from "../src/utils/formatters.js";
import { ExplicacaoResultado } from "../src/components/resultado-explicado.js";

const LUX_RECOMENDADO = {
  sala: 150,
  quarto: 100,
  cozinha: 300,
  banheiro: 200,
  escritorio: 300,
  corredor: 100,
};

const FATORES_LUZ_NATURAL = {
  muita: 0.5,
  media: 0.65,
  pouca: 0.85,
  nenhuma: 1.0,
};

const FATORES_REFLEXAO = {
  clara: 0.8,
  media: 0.5,
  escura: 0.3,
};

const TIPOS_LAMPADAS = [6, 9, 12, 15];
const LUMENS_POR_WATT = 100;
const HORAS_FUNCIONAMENTO_DIA = 5;

const TARIFA_CONFIG = {
  "pt-BR": { min: 0.5, max: 3.0, step: 0.01, defaultValue: 1.2, decimals: 2 },
  "it-IT": { min: 0.1, max: 0.8, step: 0.01, defaultValue: 0.3, decimals: 2 },
};

const SLIDER_TO_INPUT = {
  sliderArea: "inputArea",
  sliderPeDireito: "inputPeDireito",
  sliderTarifa: "inputTarifa",
};

const SLIDER_TO_FIELD = {
  sliderArea: "area",
  sliderPeDireito: "peDireito",
};

const TEMP_COR_LED = {
  6: { pt: "LED 2700K — Branco Quente", it: "LED 2700K — Bianco Caldo" },
  9: { pt: "LED 3000K — Branco Quente", it: "LED 3000K — Bianco Caldo" },
  12: { pt: "LED 4000K — Branco Neutro", it: "LED 4000K — Bianco Neutro" },
  15: { pt: "LED 6500K — Branco Frio", it: "LED 6500K — Bianco Freddo" },
};

const ICONE_AMBIENTE = {
  sala: "🛋️",
  quarto: "🛏️",
  cozinha: "🍳",
  banheiro: "🚿",
  escritorio: "💻",
  corredor: "🚪",
};

const AMBIENTE_PADRAO = {
  tipo: "sala",
  nomePersonalizado: "",
  area: 20,
  corParedes: "clara",
  peDireito: 2.7,
  luzNatural: "muita",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

class IluminacaoApp extends App {
  constructor() {
    super({
      appName: "iluminacao",
      callbacks: {
        aoInicializar: () => this.inicializarIluminacao(),
        aoTrocarIdioma: () => {
          if (!this.dom) {
            return;
          }

          this.aplicarLimitesTarifaPorIdioma();
          this.sincronizarFormularioAmbienteAtivo();
          this.atualizarResultado();
        },
      },
    });

    this.ambientes = [];
    this.ambienteAtivoId = null;
    this.proximoAmbienteId = 1;
    this.explicacao = new ExplicacaoResultado("v2-explicacao", i18n);
  }

  get traducoes() {
    const idiomaAtual = i18n.obterIdiomaAtual();
    return (
      this.config.traducoes[idiomaAtual] || this.config.traducoes["pt-BR"] || {}
    );
  }

  inicializarIluminacao() {
    this.cacheDOM();
    this.configurarEventos();
    this.aplicarLimitesTarifaPorIdioma();
    this.adicionarAmbiente("sala");
    document.addEventListener("engnata:themechange", () =>
      this.atualizarResultado(),
    );
  }

  cacheDOM() {
    this.dom = {
      inputNomeAmbienteAtual: document.getElementById("inputNomeAmbienteAtual"),
      nomeAmbienteAtivo: document.getElementById("nomeAmbienteAtivo"),
      resultadoNomeAmbiente: document.getElementById("resultadoNomeAmbiente"),
      contadorAmbientes: document.getElementById("contadorAmbientes"),
      listaAmbientesSelecionados: document.getElementById(
        "listaAmbientesSelecionados",
      ),
      listaResultadosAmbientes: document.getElementById(
        "listaResultadosAmbientes",
      ),
      btnAdicionarAmbiente: document.getElementById("btnAdicionarAmbiente"),
      sliderTarifa: document.getElementById("sliderTarifa"),
      inputTarifa: document.getElementById("inputTarifa"),
      memorialSection: document.getElementById("memorialSection"),
      resultadosSection: document.getElementById("resultadosSection"),
    };
  }

  configurarEventos() {
    this.configurarIconesInfo();
    this.configurarBotoesIncremento();
    this.configurarSlidersEInputs();

    this.dom.btnAdicionarAmbiente?.addEventListener("click", () => {
      const tipo =
        document.querySelector('input[name="novoAmbienteTipo"]:checked')
          ?.value || "sala";
      this.adicionarAmbiente(tipo);
    });

    this.dom.inputNomeAmbienteAtual?.addEventListener("input", () => {
      const ambiente = this.obterAmbienteAtivo();
      if (!ambiente) {
        return;
      }

      ambiente.nomePersonalizado = this.dom.inputNomeAmbienteAtual.value.trim();
      this.atualizarResultado();
    });

    this.dom.listaAmbientesSelecionados?.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-ambiente-acao]");
      if (!trigger) {
        return;
      }

      const ambienteId = trigger.getAttribute("data-ambiente-id");
      const acao = trigger.getAttribute("data-ambiente-acao");

      if (acao === "ativar") {
        this.selecionarAmbiente(ambienteId);
      }

      if (acao === "remover") {
        this.removerAmbiente(ambienteId);
      }
    });

    this.dom.listaResultadosAmbientes?.addEventListener("click", (event) => {
      const trigger = event.target.closest('[data-resultado-acao="editar"]');
      if (!trigger) {
        return;
      }

      const ambienteId = trigger.getAttribute("data-ambiente-id");
      this.selecionarAmbiente(ambienteId);
      this.dom.resultadosSection?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    document
      .querySelectorAll('input[name="atividade"]')
      .forEach((radio) =>
        radio.addEventListener("change", () =>
          this.atualizarCampoAmbiente("tipo", radio.value),
        ),
      );
    document
      .querySelectorAll('input[name="corParedes"]')
      .forEach((radio) =>
        radio.addEventListener("change", () =>
          this.atualizarCampoAmbiente("corParedes", radio.value),
        ),
      );
    document
      .querySelectorAll('input[name="luzNatural"]')
      .forEach((radio) =>
        radio.addEventListener("change", () =>
          this.atualizarCampoAmbiente("luzNatural", radio.value),
        ),
      );

    document
      .getElementById("btnMemorial")
      ?.addEventListener("click", () => this.toggleMemorial());
    document
      .getElementById("btnFecharMemorial")
      ?.addEventListener("click", () => this.toggleMemorial());
    document
      .querySelectorAll(".btn-voltar-memorial")
      .forEach((btn) =>
        btn.addEventListener("click", () => this.toggleMemorial()),
      );
  }

  aplicarLimitesTarifaPorIdioma() {
    if (!this.dom) {
      return;
    }

    const idioma = i18n.obterIdiomaAtual();
    const config = TARIFA_CONFIG[idioma] || TARIFA_CONFIG["pt-BR"];
    const slider = this.dom.sliderTarifa;
    const input = this.dom.inputTarifa;

    if (!slider || !input) {
      return;
    }

    const valorAtual = parseFloat(input.value.replace(",", "."));
    slider.min = String(config.min);
    slider.max = String(config.max);
    slider.step = String(config.step);

    const foraDaFaixa =
      Number.isNaN(valorAtual) ||
      valorAtual < config.min ||
      valorAtual > config.max;
    const novoValor = foraDaFaixa ? config.defaultValue : valorAtual;

    slider.value = String(novoValor);
    input.value = novoValor.toFixed(config.decimals);
  }

  configurarIconesInfo() {
    [
      { iconId: "infoIconArea", descricaoId: "descricaoArea" },
      { iconId: "infoIconPeDireito", descricaoId: "descricaoPeDireito" },
      { iconId: "infoIconTarifa", descricaoId: "descricaoTarifa" },
    ].forEach(({ iconId, descricaoId }) => {
      const icon = document.getElementById(iconId);
      const desc = document.getElementById(descricaoId);

      if (!icon || !desc) {
        return;
      }

      const toggle = () => {
        desc.style.display = desc.style.display === "none" ? "block" : "none";
      };

      icon.addEventListener("click", toggle);
      icon.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      });
    });
  }

  configurarBotoesIncremento() {
    document.querySelectorAll(".arrow-btn").forEach((btn) => {
      const HOLD_DELAY_MS = 180;
      let animationFrame = null;
      let timeoutSegurar = null;
      let tempoInicio = 0;
      let estaSegurando = false;
      let iniciouAnimacaoContinua = false;
      let direcao = 1;

      const animar = (timestamp) => {
        if (!estaSegurando) {
          return;
        }

        const sliderId = btn.getAttribute("data-target");
        const slider = document.getElementById(sliderId);
        const inputId = SLIDER_TO_INPUT[sliderId];
        const inputEl = inputId ? document.getElementById(inputId) : null;

        if (!slider) {
          return;
        }

        const tempoDecorrido = timestamp - tempoInicio;
        const sliderMin = parseFloat(slider.min);
        const sliderMax = parseFloat(slider.max);
        const velocidade = (sliderMax - sliderMin) / 3000;
        const valorInicial = parseFloat(btn.dataset.valorInicial);
        let novoValor = valorInicial + velocidade * tempoDecorrido * direcao;
        novoValor = Math.max(sliderMin * 0.5, novoValor);

        slider.value = String(novoValor);
        if (inputEl) {
          inputEl.value = parseFloat(slider.value).toFixed(
            this.decimaisPorSlider(slider),
          );
        }

        this.aplicarValorPorSlider(sliderId, parseFloat(slider.value));
        animationFrame = requestAnimationFrame(animar);
      };

      const iniciarAnimacao = () => {
        if (animationFrame) {
          return;
        }

        const sliderId = btn.getAttribute("data-target");
        const slider = document.getElementById(sliderId);

        if (!slider) {
          return;
        }

        const stepRaw = parseFloat(btn.getAttribute("data-step")) || 1;
        direcao = stepRaw > 0 ? 1 : -1;
        btn.dataset.valorInicial = String(parseFloat(slider.value));
        tempoInicio = performance.now();
        animationFrame = requestAnimationFrame(animar);
      };

      const aplicarIncrementoUnico = () => {
        const sliderId = btn.getAttribute("data-target");
        const slider = document.getElementById(sliderId);
        const inputId = SLIDER_TO_INPUT[sliderId];
        const inputEl = inputId ? document.getElementById(inputId) : null;

        if (!slider) {
          return;
        }

        const passo = parseFloat(btn.getAttribute("data-step") || "0");
        if (!passo) {
          return;
        }

        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const casasDecimais = (String(Math.abs(passo)).split(".")[1] || "")
          .length;
        let novoValor = parseFloat(slider.value) + passo;
        novoValor = Math.max(min, Math.min(max, novoValor));
        novoValor = Number(novoValor.toFixed(Math.max(casasDecimais, 3)));

        slider.value = String(novoValor);
        if (inputEl) {
          inputEl.value = parseFloat(slider.value).toFixed(
            this.decimaisPorSlider(slider),
          );
        }

        this.aplicarValorPorSlider(sliderId, novoValor);
      };

      const pararPressao = () => {
        estaSegurando = false;
        iniciouAnimacaoContinua = false;
        if (timeoutSegurar) {
          clearTimeout(timeoutSegurar);
          timeoutSegurar = null;
        }
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
      };

      const aoPressionar = (event) => {
        event.preventDefault();
        estaSegurando = true;
        iniciouAnimacaoContinua = false;
        timeoutSegurar = setTimeout(() => {
          if (!estaSegurando) {
            return;
          }
          iniciouAnimacaoContinua = true;
          iniciarAnimacao();
        }, HOLD_DELAY_MS);
      };

      const aoSoltar = (event) => {
        if (event) {
          event.preventDefault();
        }
        const foiToqueRapido = estaSegurando && !iniciouAnimacaoContinua;
        pararPressao();
        if (foiToqueRapido) {
          aplicarIncrementoUnico();
        }
      };

      btn.addEventListener("mousedown", aoPressionar);
      btn.addEventListener("touchstart", aoPressionar, { passive: false });
      btn.addEventListener("mouseup", aoSoltar);
      btn.addEventListener("mouseleave", pararPressao);
      btn.addEventListener("touchend", aoSoltar);
      btn.addEventListener("touchcancel", pararPressao);
    });
  }

  configurarSlidersEInputs() {
    Object.entries(SLIDER_TO_INPUT).forEach(([sliderId, inputId]) => {
      const slider = document.getElementById(sliderId);
      const input = document.getElementById(inputId);

      if (!slider || !input) {
        return;
      }

      slider.addEventListener("input", () => {
        input.value = parseFloat(slider.value).toFixed(
          this.decimaisPorSlider(slider),
        );
        this.aplicarValorPorSlider(sliderId, parseFloat(slider.value));
      });

      input.addEventListener("change", () => {
        const valor = this.normalizarValorNumerico(input.value);
        if (Number.isNaN(valor)) {
          this.sincronizarCampoTextoComSlider(sliderId);
          return;
        }

        const valorNormalizado = this.normalizarValorSlider(slider, valor);
        slider.value = String(valorNormalizado);
        input.value = valorNormalizado.toFixed(this.decimaisPorSlider(slider));
        this.aplicarValorPorSlider(sliderId, valorNormalizado);
      });
    });
  }

  normalizarValorSlider(slider, valor) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const step = parseFloat(slider.step) || 1;
    const base = Number.isFinite(min) ? min : 0;
    const clamped = Math.max(min, Math.min(max, valor));
    const ajustado = Math.round((clamped - base) / step) * step + base;
    return Number(
      ajustado.toFixed(Math.max(this.decimaisPorSlider(slider), 3)),
    );
  }

  normalizarValorNumerico(valor) {
    return parseFloat(String(valor).replace(",", "."));
  }

  sincronizarCampoTextoComSlider(sliderId) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(SLIDER_TO_INPUT[sliderId]);

    if (!slider || !input) {
      return;
    }

    input.value = parseFloat(slider.value).toFixed(
      this.decimaisPorSlider(slider),
    );
  }

  aplicarValorPorSlider(sliderId, valor) {
    if (sliderId === "sliderTarifa") {
      this.atualizarResultado();
      return;
    }

    const campo = SLIDER_TO_FIELD[sliderId];
    if (!campo) {
      return;
    }

    this.atualizarCampoAmbiente(campo, valor);
  }

  decimaisPorSlider(slider) {
    const step = parseFloat(slider.step) || 1;
    if (step < 1) {
      const parts = String(step).split(".");
      return parts[1]?.length || 1;
    }
    return 0;
  }

  criarAmbiente(tipo = "sala") {
    return {
      id: `ambiente-${this.proximoAmbienteId++}`,
      ...AMBIENTE_PADRAO,
      tipo,
    };
  }

  adicionarAmbiente(tipo = "sala") {
    const ambiente = this.criarAmbiente(tipo);
    this.ambientes.push(ambiente);
    this.ambienteAtivoId = ambiente.id;
    this.sincronizarFormularioAmbienteAtivo();
    this.atualizarResultado();
  }

  removerAmbiente(ambienteId) {
    if (this.ambientes.length <= 1) {
      return;
    }

    this.ambientes = this.ambientes.filter(
      (ambiente) => ambiente.id !== ambienteId,
    );
    if (this.ambienteAtivoId === ambienteId) {
      this.ambienteAtivoId = this.ambientes[0]?.id || null;
      this.sincronizarFormularioAmbienteAtivo();
    }

    this.atualizarResultado();
  }

  selecionarAmbiente(ambienteId) {
    const ambiente = this.ambientes.find((item) => item.id === ambienteId);
    if (!ambiente) {
      return;
    }

    this.ambienteAtivoId = ambienteId;
    this.sincronizarFormularioAmbienteAtivo();
    this.atualizarResultado();
  }

  obterAmbienteAtivo() {
    return (
      this.ambientes.find((ambiente) => ambiente.id === this.ambienteAtivoId) ||
      this.ambientes[0] ||
      null
    );
  }

  atualizarCampoAmbiente(campo, valor) {
    const ambiente = this.obterAmbienteAtivo();
    if (!ambiente) {
      return;
    }

    ambiente[campo] = valor;
    this.atualizarResultado();
  }

  obterNomeAmbiente(ambiente) {
    if (!ambiente) {
      return "-";
    }

    if (ambiente.nomePersonalizado) {
      return ambiente.nomePersonalizado;
    }

    const nomeBase = this.traducoes?.opcoes?.[ambiente.tipo] || ambiente.tipo;
    const ambientesMesmoTipo = this.ambientes.filter(
      (item) => item.tipo === ambiente.tipo,
    );

    if (ambientesMesmoTipo.length <= 1) {
      return nomeBase;
    }

    const indice =
      ambientesMesmoTipo.findIndex((item) => item.id === ambiente.id) + 1;
    return i18n.t("ambientes.nomePadrao", { tipo: nomeBase, numero: indice });
  }

  sincronizarFormularioAmbienteAtivo() {
    const ambiente = this.obterAmbienteAtivo();
    if (!ambiente) {
      return;
    }

    if (this.dom.inputNomeAmbienteAtual) {
      this.dom.inputNomeAmbienteAtual.value = ambiente.nomePersonalizado || "";
    }

    const definirValorNumerico = (sliderId, valor) => {
      const slider = document.getElementById(sliderId);
      const input = document.getElementById(SLIDER_TO_INPUT[sliderId]);
      if (!slider || !input) {
        return;
      }

      slider.value = String(valor);
      input.value = parseFloat(slider.value).toFixed(
        this.decimaisPorSlider(slider),
      );
    };

    definirValorNumerico("sliderArea", ambiente.area);
    definirValorNumerico("sliderPeDireito", ambiente.peDireito);

    const marcarRadio = (name, value) => {
      document.querySelectorAll(`input[name="${name}"]`).forEach((radio) => {
        radio.checked = radio.value === value;
      });
    };

    marcarRadio("atividade", ambiente.tipo);
    marcarRadio("corParedes", ambiente.corParedes);
    marcarRadio("luzNatural", ambiente.luzNatural);

    const nomeAmbiente = this.obterNomeAmbiente(ambiente);
    if (this.dom.nomeAmbienteAtivo) {
      this.dom.nomeAmbienteAtivo.textContent = nomeAmbiente;
    }
    if (this.dom.resultadoNomeAmbiente) {
      this.dom.resultadoNomeAmbiente.textContent = nomeAmbiente;
    }
  }

  toggleMemorial() {
    if (!this.dom.memorialSection || !this.dom.resultadosSection) {
      return;
    }

    const mostrar = this.dom.memorialSection.style.display === "none";
    this.dom.memorialSection.style.display = mostrar ? "block" : "none";
    this.dom.resultadosSection.style.display = mostrar ? "none" : "block";

    if (mostrar) {
      this.dom.memorialSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  obterTarifaResidencia() {
    return (
      this.normalizarValorNumerico(this.dom?.inputTarifa?.value) ||
      TARIFA_CONFIG[i18n.obterIdiomaAtual()]?.defaultValue ||
      1.2
    );
  }

  calcularLuxRecomendado(tipo, luzNatural) {
    const luxBase = LUX_RECOMENDADO[tipo] || 150;
    const fatorLuz = FATORES_LUZ_NATURAL[luzNatural] || 1.0;
    return Math.round(luxBase * fatorLuz);
  }

  calcularLumensNecessarios(area, luxRecomendado, corParedes, peDireito) {
    const fatorReflexao = FATORES_REFLEXAO[corParedes] || 0.5;
    const fatorPeDireito = peDireito / 2.7;
    const lumens =
      (area * luxRecomendado) /
      (fatorReflexao * (1 - 0.1 * (fatorPeDireito - 1)));
    return Math.round(lumens);
  }

  definirConfiguracaoLuminarias(lumensNecessarios) {
    let melhorConfig = null;
    let menorPotencia = Infinity;

    for (const watt of TIPOS_LAMPADAS) {
      const lumensPorLampada = watt * LUMENS_POR_WATT;
      const quantidade = Math.ceil(lumensNecessarios / lumensPorLampada);

      if (quantidade > 0 && quantidade <= 10) {
        const potenciaTotal = watt * quantidade;
        if (potenciaTotal < menorPotencia) {
          menorPotencia = potenciaTotal;
          melhorConfig = {
            quantidade,
            wattagem: watt,
            potenciaTotal,
            lumensUnitario: lumensPorLampada,
            lumensReais: lumensPorLampada * quantidade,
          };
        }
      }
    }

    return (
      melhorConfig || {
        quantidade: 2,
        wattagem: 9,
        potenciaTotal: 18,
        lumensUnitario: 900,
        lumensReais: 1800,
      }
    );
  }

  calcularConsumoECusto(potenciaTotal, tarifa) {
    const consumoDiario = (potenciaTotal * HORAS_FUNCIONAMENTO_DIA) / 1000;
    const consumoMensal = consumoDiario * 30;
    const custoMensal = consumoMensal * tarifa;
    const custoAnual = custoMensal * 12;
    return { consumoDiario, consumoMensal, custoMensal, custoAnual };
  }

  calcularAmbiente(ambiente, tarifa) {
    const luxRecomendado = this.calcularLuxRecomendado(
      ambiente.tipo,
      ambiente.luzNatural,
    );
    const lumensNecessarios = this.calcularLumensNecessarios(
      ambiente.area,
      luxRecomendado,
      ambiente.corParedes,
      ambiente.peDireito,
    );
    const configLuminarias =
      this.definirConfiguracaoLuminarias(lumensNecessarios);
    const consumoECusto = this.calcularConsumoECusto(
      configLuminarias.potenciaTotal,
      tarifa,
    );

    return {
      luxRecomendado,
      lumensNecessarios,
      configLuminarias,
      consumoECusto,
    };
  }

  calcularTotais(resultados) {
    return resultados.reduce(
      (acc, item) => {
        acc.totalAmbientes += 1;
        acc.areaTotal += item.ambiente.area;
        acc.potenciaTotal += item.calculo.configLuminarias.potenciaTotal;
        acc.quantidadeLuminarias += item.calculo.configLuminarias.quantidade;
        acc.consumoMensal += item.calculo.consumoECusto.consumoMensal;
        acc.custoMensal += item.calculo.consumoECusto.custoMensal;
        acc.custoAnual += item.calculo.consumoECusto.custoAnual;
        return acc;
      },
      {
        totalAmbientes: 0,
        areaTotal: 0,
        potenciaTotal: 0,
        quantidadeLuminarias: 0,
        consumoMensal: 0,
        custoMensal: 0,
        custoAnual: 0,
      },
    );
  }

  atualizarResultado() {
    const tarifa = this.obterTarifaResidencia();
    const resultados = this.ambientes.map((ambiente) => ({
      id: ambiente.id,
      ambiente,
      nome: this.obterNomeAmbiente(ambiente),
      calculo: this.calcularAmbiente(ambiente, tarifa),
    }));

    const ambienteAtivo =
      resultados.find((item) => item.id === this.ambienteAtivoId) ||
      resultados[0];
    if (!ambienteAtivo) {
      this.explicacao.limpar();
      return;
    }

    const totais = this.calcularTotais(resultados);

    this.renderizarListaAmbientes(resultados);
    this.renderizarTotaisResidencia(totais);
    this.renderizarResultadosParciais(resultados);
    this.atualizarMemorial(
      ambienteAtivo.nome,
      ambienteAtivo.ambiente,
      ambienteAtivo.calculo.luxRecomendado,
      ambienteAtivo.calculo.lumensNecessarios,
      ambienteAtivo.calculo.configLuminarias,
      ambienteAtivo.calculo.consumoECusto,
    );
    this.explicacao.renderizar(
      this.gerarExplicacaoCasa(totais, resultados),
    );
  }

  renderizarListaAmbientes(resultados) {
    if (!this.dom.listaAmbientesSelecionados) {
      return;
    }

    const totalAmbientes = resultados.length;
    if (this.dom.contadorAmbientes) {
      this.dom.contadorAmbientes.textContent = String(totalAmbientes);
    }

    this.dom.listaAmbientesSelecionados.innerHTML = resultados
      .map((item) => {
        const ativo = item.id === this.ambienteAtivoId;
        const icone = ICONE_AMBIENTE[item.ambiente.tipo] || "💡";
        const textoRemover = i18n.t("aria.removerAmbiente", {
          ambiente: item.nome,
        });
        const custo = formatarMoeda(
          item.calculo.consumoECusto.custoMensal,
          i18n.obterMoeda(),
        );
        const disableRemocao = totalAmbientes <= 1;

        return `
                    <div class="ambiente-pill ${ativo ? "is-active" : ""}">
                        <button type="button" class="ambiente-pill-main" data-ambiente-acao="ativar" data-ambiente-id="${item.id}">
                            <span class="ambiente-pill-icon" aria-hidden="true">${icone}</span>
                            <span class="ambiente-pill-texto">
                                <strong>${escapeHtml(item.nome)}</strong>
                                <small>${formatarNumero(item.ambiente.area, 1)} m² • ${custo}</small>
                            </span>
                        </button>
                        <button type="button" class="ambiente-pill-remove" data-ambiente-acao="remover" data-ambiente-id="${item.id}" aria-label="${escapeHtml(textoRemover)}" ${disableRemocao ? "disabled" : ""}>×</button>
                    </div>
                `;
      })
      .join("");
  }

  renderizarResultadosParciais(resultados) {
    if (!this.dom.listaResultadosAmbientes) {
      return;
    }

    this.dom.listaResultadosAmbientes.innerHTML = resultados
      .map((item) => {
        const moeda = i18n.obterMoeda();
        return `
                    <article class="card-resultado-ambiente ${item.id === this.ambienteAtivoId ? "is-active" : ""}">
                        <div class="card-resultado-ambiente-header">
                            <div>
                                <h4>${escapeHtml(item.nome)}</h4>
                                <p>${formatarNumero(item.ambiente.area, 1)} m² • ${formatarNumero(item.calculo.luxRecomendado, 0)} lux</p>
                            </div>
                            <button type="button" class="btn-resultado-editar" data-resultado-acao="editar" data-ambiente-id="${item.id}">${escapeHtml(i18n.t("botoes.editarAmbiente"))}</button>
                        </div>
                        <div class="card-resultado-ambiente-grid">
                            <div>
                                <span>${escapeHtml(i18n.t("resultado.numLuminariasCard"))}</span>
                                <strong>${item.calculo.configLuminarias.quantidade}× ${item.calculo.configLuminarias.wattagem}W</strong>
                            </div>
                            <div>
                                <span>${escapeHtml(i18n.t("resultado.potenciaCard"))}</span>
                                <strong>${formatarNumero(item.calculo.configLuminarias.potenciaTotal, 0)} W</strong>
                            </div>
                            <div>
                                <span>${escapeHtml(i18n.t("resultado.consumoCard"))}</span>
                                <strong>${formatarNumero(item.calculo.consumoECusto.consumoMensal, 1)} kWh</strong>
                            </div>
                            <div>
                                <span>${escapeHtml(i18n.t("resultado.custoCard"))}</span>
                                <strong>${formatarMoeda(item.calculo.consumoECusto.custoMensal, moeda)}</strong>
                            </div>
                        </div>
                    </article>
                `;
      })
      .join("");
  }


  renderizarTotaisResidencia(totais) {
    const moeda = i18n.obterMoeda();

    document.getElementById("resultadoTotalAmbientes").textContent = String(
      totais.totalAmbientes,
    );
    document.getElementById("resultadoAreaTotal").textContent = formatarNumero(
      totais.areaTotal,
      1,
    );
    document.getElementById("resultadoPotenciaTotalResidencia").textContent =
      formatarNumero(totais.potenciaTotal, 0);
    document.getElementById("resultadoLuminariasTotalResidencia").textContent =
      String(totais.quantidadeLuminarias);
    document.getElementById("resultadoConsumoTotalResidencia").textContent =
      formatarNumero(totais.consumoMensal, 1);
    document.getElementById("resultadoCustoTotalResidencia").textContent =
      formatarMoeda(totais.custoMensal, moeda);
    document.getElementById("resultadoCustoAnualTotalResidencia").textContent =
      formatarMoeda(totais.custoAnual, moeda);
  }


  atualizarMemorial(nomeAmbiente, valores, luxRec, lumens, config, consumo) {
    const t = this.traducoes;
    const moeda = i18n.obterMoeda();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = val;
      }
    };

    const luxBase = LUX_RECOMENDADO[valores.tipo] || 150;
    const fatorLuz = FATORES_LUZ_NATURAL[valores.luzNatural] || 1.0;
    const fatorReflexao = FATORES_REFLEXAO[valores.corParedes] || 0.5;
    const fatorPD = valores.peDireito / 2.7;

    set(
      "memorial-exemplo-lux",
      `${luxBase} × ${fatorLuz.toFixed(2)} = ${luxRec} lux`,
    );
    set(
      "memorial-exemplo-lumens",
      `(${valores.area} × ${luxRec}) ÷ (${fatorReflexao.toFixed(2)} × ${(1 - 0.1 * (fatorPD - 1)).toFixed(3)}) = ${formatarNumero(lumens, 0)} lm`,
    );
    set(
      "memorial-exemplo-luminarias",
      `⌈${formatarNumero(lumens, 0)} ÷ (${config.wattagem} × 100)⌉ = ${config.quantidade} × ${config.wattagem}W = ${config.potenciaTotal}W`,
    );
    set(
      "memorial-exemplo-custo",
      `${config.potenciaTotal}W × 5h × 30 ÷ 1000 = ${formatarNumero(consumo.consumoMensal, 2)} kWh → ${formatarMoeda(consumo.custoMensal, moeda)}`,
    );

    set("resumo-ambiente", nomeAmbiente);
    set("resumo-area", `${formatarNumero(valores.area, 1)} m²`);
    set("resumo-atividade", t?.opcoes?.[valores.tipo] ?? valores.tipo);
    set("resumo-cor", t?.opcoes?.[valores.corParedes] ?? valores.corParedes);
    set("resumo-pd", `${formatarNumero(valores.peDireito, 1)} m`);
    set("resumo-luz", t?.opcoes?.[valores.luzNatural] ?? valores.luzNatural);
    set("resumo-lux", `${luxRec} lux`);
    set("resumo-lumens", `${formatarNumero(lumens, 0)} lm`);
    set(
      "resumo-luminarias",
      `${config.quantidade} × ${config.wattagem}W (${config.potenciaTotal}W)`,
    );
    set("resumo-consumo", `${formatarNumero(consumo.consumoMensal, 1)} kWh`);
    set("resumo-custo", formatarMoeda(consumo.custoMensal, moeda));
  }

  gerarExplicacaoCasa(totais, resultados) {
    const idioma = i18n.obterIdiomaAtual();
    const isIt = idioma === "it-IT";
    const moeda = i18n.obterMoeda();
    const tarifa = this.obterTarifaResidencia();

    return {
      linhas: [
        {
          icone: "🏠",
          titulo: isIt ? "Residenza completa" : "Residência completa",
          valor: isIt
            ? `${totais.totalAmbientes} ambienti — ${formatarNumero(totais.areaTotal, 1)} m²`
            : `${totais.totalAmbientes} ambientes — ${formatarNumero(totais.areaTotal, 1)} m²`,
          descricao: isIt
            ? `Dimensionamento conforme NBR 5413 per ${totais.totalAmbientes} ambienti residenziali.`
            : `Dimensionamento conforme NBR 5413 para ${totais.totalAmbientes} ambientes residenciais.`,
        },
        {
          icone: "💡",
          titulo: isIt ? "Lampade LED totali" : "Luminárias LED totais",
          valor: `${totais.quantidadeLuminarias} un.`,
          descricao: isIt
            ? `Potenza installata totale: ${formatarNumero(totais.potenciaTotal, 0)} W.`
            : `Potência instalada total: ${formatarNumero(totais.potenciaTotal, 0)} W.`,
        },
        {
          icone: "⚡",
          titulo: isIt ? "Consumo mensile" : "Consumo mensal",
          valor: `${formatarNumero(totais.consumoMensal, 1)} kWh`,
          descricao: isIt
            ? `${formatarNumero(totais.potenciaTotal, 0)} W × ${HORAS_FUNCIONAMENTO_DIA}h/giorno × 30 giorni ÷ 1000.`
            : `${formatarNumero(totais.potenciaTotal, 0)} W × ${HORAS_FUNCIONAMENTO_DIA}h/dia × 30 dias ÷ 1000.`,
        },
        {
          icone: "💰",
          titulo: isIt ? "Costo mensile stimato" : "Custo mensal estimado",
          valor: formatarMoeda(totais.custoMensal, moeda),
          descricao: isIt
            ? `${formatarNumero(totais.consumoMensal, 1)} kWh/mese × ${formatarMoeda(tarifa, moeda)}/kWh. Annuale: ${formatarMoeda(totais.custoAnual, moeda)}.`
            : `${formatarNumero(totais.consumoMensal, 1)} kWh/mês × ${formatarMoeda(tarifa, moeda)}/kWh. Anual: ${formatarMoeda(totais.custoAnual, moeda)}.`,
        },
      ],
      destaque: isIt
        ? `${totais.totalAmbientes} ambienti: ${totais.quantidadeLuminarias} lampade LED, ${formatarMoeda(totais.custoMensal, moeda)}/mese`
        : `${totais.totalAmbientes} ambientes: ${totais.quantidadeLuminarias} luminárias LED, ${formatarMoeda(totais.custoMensal, moeda)}/mês`,
      dica: isIt
        ? "Confronta i parziali per capire quali ambienti concentrano la maggior parte del consumo di illuminazione della casa."
        : "Compare os parciais para identificar quais ambientes concentram a maior parte do consumo de iluminação da casa.",
      norma: "NBR 5413",
    };
  }
}

const app = new IluminacaoApp();
app.inicializar();
