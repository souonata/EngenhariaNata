// ============================================
// AQUECIMENTO - DIMENSIONADOR DE AQUECEDOR SOLAR TÉRMICO
// Versão ES6 Modular - v1.0.0
// ============================================

// ============================================
// IMPORTS
// ============================================
import { App } from '../src/core/app.js';
import { i18n } from '../src/core/i18n.js';
import { formatarNumero, formatarMoeda } from '../src/utils/formatters.js';
import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';
import {
    PRODUCAO_SOLFANGARE_SE,
    AREA_SOLFANGARE_SE,
    ACUMULADOR_SE_LITROS,
    AGUA_QUENTE_SE,
    SOLFRAKTION_TETO_SE
} from '../src/data/parametros-suecia.js';

// ============================================
// SUÉCIA — solar térmica como complemento
// ============================================

/**
 * Dimensionar pelo inverno não funciona na Suécia: de novembro a fevereiro a
 * produção é quase nula em qualquer área de coletor. O limite real é o
 * excedente de verão — passado certo ponto, mais área não vira água quente,
 * vira estagnação. Por isso a fração solar tem TETO, e o app avisa quando a
 * área escolhida já passou dele.
 *
 * Função pura: números entram, números saem. Sem DOM.
 */
function calcularSolarTermicaSuecia(v) {
    const demanda = v.pessoas * AGUA_QUENTE_SE.kwhPorPessoaAno + AGUA_QUENTE_SE.perdasFixasKwhAno;
    const producaoBruta = v.area * PRODUCAO_SOLFANGARE_SE;

    // O calendário, não o equipamento, é quem limita.
    const tetoUtil = demanda * SOLFRAKTION_TETO_SE;
    const producaoUtil = Math.min(producaoBruta, tetoUtil);
    const solfraktion = demanda > 0 ? producaoUtil / demanda : 0;
    const excedente = producaoBruta - producaoUtil;

    const faixaArea = AREA_SOLFANGARE_SE[v.uso] || AREA_SOLFANGARE_SE.aguaQuente;
    const faixaTanque = ACUMULADOR_SE_LITROS[v.uso] || ACUMULADOR_SE_LITROS.aguaQuente;

    // O aviso só faz sentido quando o excedente é material. Na área
    // recomendada sobra um punhado de kWh — alertar sobre isso seria ruído.
    const fracaoDesperdicada = producaoBruta > 0 ? excedente / producaoBruta : 0;

    return {
        demanda, producaoBruta, producaoUtil, solfraktion, excedente,
        faixaArea, faixaTanque, fracaoDesperdicada,
        areaExcessiva: fracaoDesperdicada > 0.1
    };
}

/** Número no formato sueco (espaço como separador de milhar). */
function numSE(valor, casas = 0) {
    return valor.toLocaleString('sv-SE', {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas
    });
}

// ============================================
// CLASSE PRINCIPAL
// ============================================
class AquecimentoApp extends App {
    constructor() {
        super({
            appName: 'aquecimento',
            callbacks: {
                aoInicializar: () => this.inicializarAquecimento(),
                aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
            }
        });
        
        // Estado dos botões de incremento
        this.estadoBotoes = {
            estaSegurando: false,
            animationId: null,
            targetId: null,
            step: 0,
            tempoInicio: 0,
            valorInicial: 0,
            delayTimeout: null
        };
        
        // Constantes físicas (movidas para dentro da classe)
        this.CONSTANTS = {
            densidade_agua: 1.0,                    // kg/L
            calor_especifico_agua: 1.163,           // Wh/(kg·°C)
            densidade_ar: 1.225,                    // kg/m³ ao nível do mar a 15°C
            calor_especifico_ar: 0.278,             // Wh/(kg·°C)
            gradiente_adiabatico_seco: 0.0098,      // °C/m
            energia_perdida_paredes_por_m2: 0.5     // kWh/(m²·dia) - estimativa simplificada
        };
        
        // Matrizes de clima (Brasil e Itália)
        this.MATRIZ_CLIMA_BRASIL = {
            // Latitude (°S) → HSP (horas de sol pico por dia), Temp. média inverno (°C), Temp. água fria inverno (°C)
            "-5": { HSP: 5.0, T_ambiente_inverno: 24, T_agua_fria: 22 },
            "-10": { HSP: 4.8, T_ambiente_inverno: 22, T_agua_fria: 20 },
            "-15": { HSP: 4.5, T_ambiente_inverno: 18, T_agua_fria: 17 },
            "-20": { HSP: 4.2, T_ambiente_inverno: 16, T_agua_fria: 15 },
            "-23.5": { HSP: 4.0, T_ambiente_inverno: 15, T_agua_fria: 14 },  // São Paulo (referência)
            "-25": { HSP: 3.8, T_ambiente_inverno: 14, T_agua_fria: 13 },
            "-30": { HSP: 3.5, T_ambiente_inverno: 12, T_agua_fria: 11 },
            "-35": { HSP: 3.2, T_ambiente_inverno: 10, T_agua_fria: 9 }
        };
        
        this.MATRIZ_CLIMA_ITALIA = {
            // Latitude (°N) → HSP (horas de sol pico por dia), Temp. média inverno (°C), Temp. água fria inverno (°C)
            "36": { HSP: 3.5, T_ambiente_inverno: 11, T_agua_fria: 10 },     // Sicília sul
            "38": { HSP: 3.6, T_ambiente_inverno: 10, T_agua_fria: 9 },      // Sicília
            "40": { HSP: 3.4, T_ambiente_inverno: 9, T_agua_fria: 8 },       // Napoli
            "41.9": { HSP: 3.2, T_ambiente_inverno: 8, T_agua_fria: 7 },     // Roma (referência)
            "43": { HSP: 3.0, T_ambiente_inverno: 7, T_agua_fria: 6 },       // Firenze
            "45": { HSP: 2.8, T_ambiente_inverno: 5, T_agua_fria: 5 },       // Milano
            "47": { HSP: 2.7, T_ambiente_inverno: 4, T_agua_fria: 4 }        // Alpes italianos
        };
        
        // Perfis de consumo de água
        this.MATRIZ_CONSUMO = {
            "Economico": { consumo_por_pessoa: 30, T_desejada: 50 },
            "Padrao": { consumo_por_pessoa: 40, T_desejada: 55 },
            "Alto": { consumo_por_pessoa: 60, T_desejada: 60 }
        };
        
        // Modelos de referência por idioma
        this.MODELO_REFERENCIA = {
            'pt-BR': {
                nome: "Coletor Solar Térmico com Tubos a Vácuo - 15 Tubos",
                especificacoes: {
                    numero_tubos: 15,
                    area_m2: 1.5,
                    eficiencia_optica: 0.70,
                    coef_perda_linear: 2.5,
                    potencia_termica_kW: 1.05
                },
                link: {
                    url: "https://www.enertech.com.br/aquecimento-banho/placas-e-coletores/tubos-a-vacuo",
                    texto: "especificações"
                }
            },
            'it-IT': {
                nome: "Collettore Solare Termico Pressurizzato - 15 Tubi",
                especificacoes: {
                    numero_tubos: 15,
                    area_m2: 1.8,
                    eficiencia_optica: 0.68,
                    coef_perda_linear: 2.3,
                    potencia_termica_kW: 1.22
                },
                link: {
                    url: "https://www.pss-italy.com/categoria-prodotto/pannello-solare-termico-circolazione-naturale/",
                    texto: "specifiche"
                }
            },
            // Na Suécia o padrão de mercado é o coletor plano com boa isolação,
            // e não o tubo a vácuo: ele rende melhor no frio e sob neve.
            'sv-SE': {
                nome: "Plan solfångare med selektiv absorbator",
                especificacoes: {
                    numero_tubos: 0,
                    area_m2: 2.0,
                    eficiencia_optica: 0.78,
                    coef_perda_linear: 3.5,
                    potencia_termica_kW: 1.40
                },
                link: {
                    url: "https://www.energimyndigheten.se/",
                    texto: "specifikationer"
                }
            }
        };
        
        // Consumo específico por classe energética (kWh/m²·ano)
        this.CONSUMO_ESPECIFICO_CLASSE = {
            "A4": 0.40, "A3": 0.50, "A2": 0.70, "A1": 0.90,
            "B": 1.10, "C": 1.35, "D": 1.75,
            "E": 2.30, "F": 3.05, "G": 4.00
        };
        
        // Parâmetros do sistema de aquecimento
        this.HORAS_AQUECIMENTO_POR_DIA = 16;
        this.DIAS_PERIODO_AQUECIMENTO = 150;
        this.TEMPERATURA_ARMAZENAMENTO_INICIAL = 80;
        this.TEMPERATURA_MINIMA_TERMOSSIFAO = 50;
        this.FATOR_ESTRATIFICACAO = 0.75;
        
        // Matriz de termossifões por idioma
        this.MATRIZ_TERMOSSIFOES = {
            'pt-BR': [
                { tamanho: "P", potencia_W: 1200, descricao: "Termossifão 1200W (Pequeno)", preco: 1800 },
                { tamanho: "M", potencia_W: 1800, descricao: "Termossifão 1800W (Médio)", preco: 2400 },
                { tamanho: "G", potencia_W: 2400, descricao: "Termossifão 2400W (Grande)", preco: 3200 }
            ],
            'it-IT': [
                { tamanho: "P", potencia_W: 1200, descricao: "Termosifone 1200W (Piccolo)", preco: 420 },
                { tamanho: "M", potencia_W: 1800, descricao: "Termosifone 1800W (Medio)", preco: 560 },
                { tamanho: "G", potencia_W: 2400, descricao: "Termosifone 2400W (Grande)", preco: 750 }
            ],
            'sv-SE': [
                { tamanho: "P", potencia_W: 1200, descricao: "Radiator 1200 W (liten)", preco: 4600 },
                { tamanho: "M", potencia_W: 1800, descricao: "Radiator 1800 W (mellan)", preco: 6200 },
                { tamanho: "G", potencia_W: 2400, descricao: "Radiator 2400 W (stor)", preco: 8300 }
            ]
        };
        
        // Gráficos
        this.graficoDistribuicao = null;
        this.graficoComparacao = null;
        this.graficoEficiencia = null;
        this.explicacao = new ExplicacaoResultado('v2-explicacao', i18n);
    }
    
    // Getter para traduções
    get traducoes() {
        const idiomaAtual = i18n.obterIdiomaAtual();
        return this.config.traducoes[idiomaAtual];
    }

    obterCoresGrafico() {
        const css = getComputedStyle(document.documentElement);
        return {
            blue: css.getPropertyValue('--chart-blue').trim() || '#2196f3',
            red: css.getPropertyValue('--chart-red').trim() || '#f44336',
            yellow: css.getPropertyValue('--chart-yellow').trim() || '#ffc107',
            green: css.getPropertyValue('--chart-green').trim() || '#4caf50',
            orange: css.getPropertyValue('--chart-orange').trim() || '#ff9800',
            text: css.getPropertyValue('--chart-text').trim() || '#3a3a3a',
            grid: css.getPropertyValue('--chart-grid').trim() || 'rgba(0, 0, 0, 0.08)'
        };
    }
    
    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    inicializarAquecimento() {
        document.addEventListener('engnata:themechange', () => {
            this.atualizarResultados();
        });
        
        // Configurar todos os eventos e elementos
        this.configurarSliders();
        this.configurarInputsTexto();
        this.configurarCheckboxes();
        this.configurarRadios();
        this.configurarMemorial();
        this.configurarInfoIcons();
        this.configurarEventosSE();
        
        // Atualizar limites de latitude baseado no idioma
        this.atualizarLimitesLatitude();
        
        // Configurar visibilidade inicial
        this.atualizarVisibilidadeCampos();
        
        // Calcular resultados iniciais
        setTimeout(() => {
            this.atualizarVisibilidadeCampos();
            this.atualizarResultados();
        }, 100);
    }
    
    // ============================================
    // CONFIGURAÇÃO DE SLIDERS
    // ============================================
    configurarSliders() {
        const sliders = document.querySelectorAll('input[type="range"]');
        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                const sliderId = e.target.id;
                const inputId = sliderId.replace('slider', 'input');
                const inputElement = document.getElementById(inputId);
                
                if (inputElement) {
                    let valor = parseFloat(e.target.value);
                    
                    // Formatar com vírgula para latitude
                    if (sliderId === 'sliderLatitude') {
                        inputElement.value = this.formatarDecimal(valor, 1);
                    } else {
                        inputElement.value = valor;
                    }
                }
                
                this.atualizarResultados();
            });
        });
    }
    
    
    iniciarIncremento(targetId, step) {
        // Prevenir múltiplas ativações
        if (this.estadoBotoes.estaSegurando) return;
        
        this.estadoBotoes.estaSegurando = true;
        this.estadoBotoes.targetId = targetId;
        this.estadoBotoes.step = step;
        
        const slider = document.getElementById(targetId);
        if (!slider) return;
        
        // Primeiro incremento imediato
        this.ajustarValor(targetId, step);
        
        // Aguardar 300ms antes de iniciar incremento contínuo
        this.estadoBotoes.delayTimeout = setTimeout(() => {
            // Capturar valor inicial APÓS o primeiro incremento
            this.estadoBotoes.valorInicial = parseFloat(slider.value);
            this.estadoBotoes.tempoInicio = performance.now();
            this.animarIncremento();
        }, 300);
    }
    
    animarIncremento() {
        if (!this.estadoBotoes.estaSegurando) return;
        
        const slider = document.getElementById(this.estadoBotoes.targetId);
        if (!slider) return;
        
        const tempoDecorrido = performance.now() - this.estadoBotoes.tempoInicio;
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const range = max - min;
        
        // Velocidade linear: percorrer todo o range em ~3 segundos (3000ms)
        const velocidade = (range / 3000) * this.estadoBotoes.step / Math.abs(this.estadoBotoes.step);
        
        // Calcular novo valor baseado no tempo e velocidade
        let novoValor = this.estadoBotoes.valorInicial + (velocidade * tempoDecorrido);
        
        // Limitar ao range
        novoValor = Math.max(min, Math.min(max, novoValor));
        
        // Arredondar ao step
        const step = parseFloat(slider.step) || 1;
        novoValor = Math.round(novoValor / step) * step;
        
        // Atualizar slider
        slider.value = novoValor;
        
        // Atualizar input correspondente
        const inputId = this.estadoBotoes.targetId.replace('slider', 'input');
        const inputElement = document.getElementById(inputId);
        if (inputElement) {
            if (this.estadoBotoes.targetId === 'sliderLatitude') {
                inputElement.value = this.formatarDecimal(novoValor, 1);
            } else {
                inputElement.value = novoValor;
            }
        }
        
        // Atualizar resultados
        this.atualizarResultados();
        
        // Se não atingiu os limites, continuar animação
        if ((this.estadoBotoes.step > 0 && novoValor < max) || 
            (this.estadoBotoes.step < 0 && novoValor > min)) {
            this.estadoBotoes.animationId = requestAnimationFrame(() => this.animarIncremento());
        } else {
            this.pararIncremento();
        }
    }
    
    pararIncremento() {
        this.estadoBotoes.estaSegurando = false;
        
        if (this.estadoBotoes.delayTimeout) {
            clearTimeout(this.estadoBotoes.delayTimeout);
            this.estadoBotoes.delayTimeout = null;
        }
        
        if (this.estadoBotoes.animationId) {
            cancelAnimationFrame(this.estadoBotoes.animationId);
            this.estadoBotoes.animationId = null;
        }
    }
    
    ajustarValor(targetId, step) {
        const slider = document.getElementById(targetId);
        if (!slider) return;
        
        let novoValor = parseFloat(slider.value) + step;
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        
        novoValor = Math.max(min, Math.min(max, novoValor));
        slider.value = novoValor;
        
        // Atualizar input correspondente
        const inputId = targetId.replace('slider', 'input');
        const inputElement = document.getElementById(inputId);
        if (inputElement) {
            if (targetId === 'sliderLatitude') {
                inputElement.value = this.formatarDecimal(novoValor, 1);
            } else {
                inputElement.value = novoValor;
            }
        }
        
        this.atualizarResultados();
    }
    
    // ============================================
    // CONFIGURAÇÃO DE INPUTS DE TEXTO
    // ============================================
    configurarInputsTexto() {
        const inputs = document.querySelectorAll('.valor-input');
        
        inputs.forEach(input => {
            // Evento de blur (quando sai do campo)
            input.addEventListener('blur', (e) => {
                const inputId = e.target.id;
                const sliderId = inputId.replace('input', 'slider');
                const slider = document.getElementById(sliderId);
                
                if (!slider) return;
                
                let valor = this.converterParaNumero(e.target.value);
                
                if (!isNaN(valor)) {
                    const min = parseFloat(slider.min);
                    const max = parseFloat(slider.max);
                    valor = Math.max(min, Math.min(max, valor));
                    
                    slider.value = valor;
                    
                    // Formatar com vírgula para latitude
                    if (inputId === 'inputLatitude') {
                        e.target.value = this.formatarDecimal(valor, 1);
                    } else {
                        e.target.value = valor;
                    }
                    
                    this.atualizarResultados();
                }
            });
            
            // Evento de Enter
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            });
        });
    }
    
    // ============================================
    // CONFIGURAÇÃO DE CHECKBOXES E RADIOS
    // ============================================
    configurarCheckboxes() {
        const checkboxAgua = document.getElementById('checkboxAgua');
        const checkboxCasa = document.getElementById('checkboxCasa');
        
        if (checkboxAgua) {
            checkboxAgua.addEventListener('change', () => {
                this.atualizarVisibilidadeCampos();
                this.atualizarResultados();
            });
        }
        
        if (checkboxCasa) {
            checkboxCasa.addEventListener('change', () => {
                this.atualizarVisibilidadeCampos();
                this.atualizarResultados();
            });
        }
    }
    
    configurarRadios() {
        const radiosTipoUso = document.querySelectorAll('input[name="tipoUso"]');
        radiosTipoUso.forEach(radio => {
            radio.addEventListener('change', () => this.atualizarResultados());
        });
        
        const radiosClasseEnergetica = document.querySelectorAll('input[name="classeEnergetica"]');
        radiosClasseEnergetica.forEach(radio => {
            radio.addEventListener('change', () => this.atualizarResultados());
        });
    }
    
    // ============================================
    // CONFIGURAÇÃO DE INFO ICONS
    // ============================================
    configurarInfoIcons() {
        const infoIcons = document.querySelectorAll('.info-icon');
        
        infoIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                const grupoEntrada = icon.closest('.grupo-entrada');
                if (!grupoEntrada) return;
                
                const descricaoInfo = grupoEntrada.querySelector('.descricao-info');
                if (!descricaoInfo) return;
                
                // Toggle display
                if (descricaoInfo.style.display === 'none' || descricaoInfo.style.display === '') {
                    descricaoInfo.style.display = 'block';
                } else {
                    descricaoInfo.style.display = 'none';
                }
            });
        });
    }
    
    // ============================================
    // CONFIGURAÇÃO DO MEMORIAL
    // ============================================
    configurarMemorial() {
        const btnMemorial = document.getElementById('btnMemorial');
        const btnFecharMemorial = document.getElementById('btnFecharMemorial');
        const btnsVoltarMemorial = document.querySelectorAll('.btn-voltar-memorial');
        
        if (btnMemorial) {
            btnMemorial.addEventListener('click', () => this.toggleMemorial());
        }
        
        if (btnFecharMemorial) {
            btnFecharMemorial.addEventListener('click', () => this.toggleMemorial());
        }
        
        btnsVoltarMemorial.forEach(btn => {
            btn.addEventListener('click', () => this.toggleMemorial());
        });
    }
    
    toggleMemorial() {
        const memorialSection = document.getElementById('memorialSection');
        const resultadosSection = document.getElementById('resultadosSection');
        
        if (!memorialSection) {
            console.error('memorialSection não encontrado');
            return;
        }
        
        if (memorialSection.style.display === 'none' || memorialSection.style.display === '') {
            memorialSection.style.display = 'block';
            if (resultadosSection) resultadosSection.style.display = 'none';
        } else {
            memorialSection.style.display = 'none';
            if (resultadosSection) resultadosSection.style.display = 'block';
        }
    }
    
    // ============================================
    // ATUALIZAÇÃO APÓS TROCA DE IDIOMA
    // ============================================
    atualizarAposTrocaIdioma() {
        this.atualizarLimitesLatitude();
        this.atualizarResultados();
    }
    
    // ============================================
    // FUNÇÕES AUXILIARES DE FORMATAÇÃO
    // ============================================
    converterParaNumero(str) {
        if (typeof str === 'number') return str;
        return parseFloat(str.toString().replace(',', '.'));
    }
    
    formatarDecimal(numero, casasDecimais) {
        return numero.toFixed(casasDecimais).replace('.', ',');
    }
    
    // Junta valor e símbolo na ordem do idioma: em sueco a coroa vem depois.
    comMoeda(simbolo, textoNumero) {
        return i18n.obterIdiomaAtual() === 'sv-SE'
            ? `${textoNumero} ${simbolo}`
            : `${simbolo} ${textoNumero}`;
    }

    formatarNumeroComSufixo(numero, casasDecimais) {
        if (numero >= 1000000) {
            return this.formatarDecimal(numero / 1000000, casasDecimais) + 'M';
        } else if (numero >= 1000) {
            return this.formatarDecimal(numero / 1000, casasDecimais) + 'k';
        }
        return this.formatarDecimal(numero, casasDecimais);
    }
    
    formatarPotenciaWkW(potencia_W) {
        if (potencia_W >= 1000) {
            return this.formatarDecimal(potencia_W / 1000, 2) + ' kW';
        }
        return this.formatarDecimal(potencia_W, 0) + ' W';
    }
    
    // ============================================
    // FUNÇÕES DE CÁLCULO - PRINCIPAL
    // ============================================
    
    obterModeloReferencia() {
        const idioma = i18n.obterIdiomaAtual();
        return this.MODELO_REFERENCIA[idioma] || this.MODELO_REFERENCIA['pt-BR'];
    }
    
    atualizarLimitesLatitude() {
        const sliderLatitude = document.getElementById('sliderLatitude');
        const inputLatitude = document.getElementById('inputLatitude');
        
        if (!sliderLatitude) return;
        
        const valorAtual = parseFloat(sliderLatitude.value);
        const idioma = i18n.obterIdiomaAtual();
        
        // Faixa de latitude do país do idioma. A Suécia é o caso extremo:
        // de ~55,3°N (Smygehuk) a ~69,1°N (Treriksröset), bem acima da
        // Itália — o que derruba o ganho solar no inverno.
        const FAIXAS_LATITUDE = {
            'pt-BR': { min: -35, max: -5, padrao: -23.5 },
            'it-IT': { min: 36, max: 47, padrao: 41.9 },
            'sv-SE': { min: 55, max: 69, padrao: 59.3 }
        };
        const faixa = FAIXAS_LATITUDE[idioma] || FAIXAS_LATITUDE['it-IT'];

        sliderLatitude.min = String(faixa.min);
        sliderLatitude.max = String(faixa.max);
        sliderLatitude.step = '0.5';

        if (valorAtual < faixa.min || valorAtual > faixa.max) {
            sliderLatitude.value = String(faixa.padrao);
            if (inputLatitude) inputLatitude.value = this.formatarDecimal(faixa.padrao, 1);
        }
    }
    
    calcularHorasSolPicoInverno(latitude) {
        const latAbs = Math.abs(latitude);
        let hsp;
        
        if (latAbs <= 15) {
            hsp = 5.5 - (latAbs / 15) * 1.0;
        } else if (latAbs <= 30) {
            hsp = 4.5 - ((latAbs - 15) / 15) * 1.0;
        } else if (latAbs <= 45) {
            hsp = 3.5 - ((latAbs - 30) / 15) * 1.0;
        } else if (latAbs <= 60) {
            hsp = 2.5 - ((latAbs - 45) / 15) * 1.0;
        } else {
            hsp = Math.max(1.0, 1.5 - ((latAbs - 60) / 15) * 0.5);
        }
        
        return Math.max(1.0, Math.min(6.0, hsp));
    }
    
    calcularTemperaturaAgua(latitude, altitude) {
        const latAbs = Math.abs(latitude);
        let T_base = 15;
        
        if (latAbs <= 10) {
            T_base = 20;
        } else if (latAbs <= 20) {
            T_base = 17;
        } else if (latAbs <= 30) {
            T_base = 14;
        } else {
            T_base = 11;
        }
        
        const gradiente = 5.5;
        const variacaoAltitude = (altitude / 1000.0) * gradiente;
        return Math.max(2.0, T_base - variacaoAltitude);
    }
    
    calcularTemperaturaAmbiente(latitude, altitude) {
        const latAbs = Math.abs(latitude);
        let T_base = 15;
        
        if (latAbs <= 10) {
            T_base = 24;
        } else if (latAbs <= 20) {
            T_base = 18;
        } else if (latAbs <= 30) {
            T_base = 14;
        } else if (latAbs <= 40) {
            T_base = 10;
        } else {
            T_base = 6;
        }
        
        const altitudeLimitada = Math.max(0, Math.min(altitude, 2000));
        const variacaoAltitude = altitudeLimitada * (-13.0 / 2000.0);
        return Math.max(-5.0, T_base + variacaoAltitude);
    }
    
    estimarAmbientes(areaCasa) {
        const ambientes = [];
        let areaRestante = areaCasa;
        const idioma = i18n.obterIdiomaAtual();
        
        // Definir tipos de ambiente por idioma
        const TIPOS_AMBIENTE = {
            'pt-BR': { sala: 'Sala de Estar', quarto: 'Quarto', cozinha: 'Cozinha', banheiro: 'Banheiro', corredor: 'Corredor' },
            'it-IT': { sala: 'Soggiorno', quarto: 'Camera', cozinha: 'Cucina', banheiro: 'Bagno', corredor: 'Corridoio' },
            'sv-SE': { sala: 'Vardagsrum', quarto: 'Sovrum', cozinha: 'Kök', banheiro: 'Badrum', corredor: 'Hall' }
        };
        const tiposAmbiente = TIPOS_AMBIENTE[idioma] || TIPOS_AMBIENTE['it-IT'];
        
        // Estimativa baseada em área total
        if (areaCasa >= 25) {
            const areaSala = Math.min(areaRestante * 0.30, 30);
            ambientes.push({ tipo: tiposAmbiente.sala, area_m2: areaSala });
            areaRestante -= areaSala;
        }
        
        if (areaCasa >= 50) {
            const areaQuarto1 = Math.min(areaRestante * 0.25, 15);
            ambientes.push({ tipo: `${tiposAmbiente.quarto} 1`, area_m2: areaQuarto1 });
            areaRestante -= areaQuarto1;
        }
        
        if (areaCasa >= 80) {
            const areaQuarto2 = Math.min(areaRestante * 0.25, 12);
            ambientes.push({ tipo: `${tiposAmbiente.quarto} 2`, area_m2: areaQuarto2 });
            areaRestante -= areaQuarto2;
        }
        
        if (areaCasa >= 30) {
            const areaCozinha = Math.min(areaRestante * 0.20, 12);
            ambientes.push({ tipo: tiposAmbiente.cozinha, area_m2: areaCozinha });
            areaRestante -= areaCozinha;
        }
        
        if (areaRestante > 0) {
            ambientes.push({ tipo: tiposAmbiente.corredor, area_m2: areaRestante });
        }
        
        return ambientes;
    }
    
    calcularPotenciaAmbiente(areaAmbiente, alturaCasa, T_ambiente_inverno, classeEnergetica) {
        if (areaAmbiente <= 0 || alturaCasa <= 0) return 0;
        
        const consumoEspecifico = this.CONSUMO_ESPECIFICO_CLASSE[classeEnergetica] || this.CONSUMO_ESPECIFICO_CLASSE["D"];
        
        const alturaPadrao = 2.7;
        let fatorAltura = 1.0;
        if (alturaCasa > alturaPadrao) {
            const diferencaAltura = alturaCasa - alturaPadrao;
            fatorAltura = 1.0 + (diferencaAltura / 0.1) * 0.1;
        }
        
        const fracaoAquecimento = T_ambiente_inverno < 10 ? 0.70 : 0.60;
        const consumoAnualTotal_kWh = consumoEspecifico * areaAmbiente * fatorAltura;
        const consumoAnualAquecimento_kWh = consumoAnualTotal_kWh * fracaoAquecimento;
        const demandaDiaria_kWh = consumoAnualAquecimento_kWh / this.DIAS_PERIODO_AQUECIMENTO;
        const potenciaBase_W = (demandaDiaria_kWh / this.HORAS_AQUECIMENTO_POR_DIA) * 1000.0;
        const potenciaNecessaria_W = potenciaBase_W * 1.15;
        
        return Math.max(0, potenciaNecessaria_W);
    }
    
    selecionarTermossifao(potenciaNecessaria_W, matrizTermossifoes) {
        const termossifoesOrdenados = [...matrizTermossifoes].sort((a, b) => a.potencia_W - b.potencia_W);
        
        if (potenciaNecessaria_W < termossifoesOrdenados[0].potencia_W * 0.5) {
            return termossifoesOrdenados[0];
        }
        
        const potenciaComMargem = potenciaNecessaria_W * 1.2;
        
        for (const termossifao of termossifoesOrdenados) {
            if (termossifao.potencia_W >= potenciaComMargem || 
                (termossifao.potencia_W >= potenciaNecessaria_W && termossifao.potencia_W <= potenciaNecessaria_W * 1.3)) {
                return termossifao;
            }
        }
        
        return termossifoesOrdenados[termossifoesOrdenados.length - 1];
    }
    
    calcularTermossifoes(areaCasa, alturaCasa, T_ambiente_inverno, classeEnergetica) {
        if (areaCasa <= 0 || alturaCasa <= 0) {
            return {
                quantidade: 0,
                termossifoes: [],
                custoTotal: 0,
                potenciaTotal: 0,
                detalhes: '',
                ambientes: []
            };
        }
        
        const idioma = i18n.obterIdiomaAtual();
        const matrizTermossifoes = this.MATRIZ_TERMOSSIFOES[idioma] || this.MATRIZ_TERMOSSIFOES['pt-BR'];
        const ambientes = this.estimarAmbientes(areaCasa);
        
        const termossifoesSelecionados = [];
        const termossifoesPorAmbiente = [];
        const detalhes = [];
        
        for (const ambiente of ambientes) {
            const potenciaAmbiente_W = this.calcularPotenciaAmbiente(
                ambiente.area_m2,
                alturaCasa,
                T_ambiente_inverno,
                classeEnergetica
            );
            
            if (potenciaAmbiente_W > 0) {
                const termossifaoSelecionado = this.selecionarTermossifao(potenciaAmbiente_W, matrizTermossifoes);
                const potenciaComMargem = potenciaAmbiente_W * 1.2;
                const quantidadeNecessaria = Math.ceil(potenciaComMargem / termossifaoSelecionado.potencia_W);
                const quantidadeFinal = Math.min(quantidadeNecessaria, 2);
                
                const jaExiste = termossifoesSelecionados.find(t => 
                    t.tamanho === termossifaoSelecionado.tamanho
                );
                
                if (jaExiste) {
                    jaExiste.quantidade += quantidadeFinal;
                } else {
                    termossifoesSelecionados.push({
                        ...termossifaoSelecionado,
                        quantidade: quantidadeFinal
                    });
                }
                
                detalhes.push(`${quantidadeFinal}x ${termossifaoSelecionado.descricao} (${ambiente.tipo})`);
                
                termossifoesPorAmbiente.push({
                    ambiente: ambiente.tipo,
                    area_m2: ambiente.area_m2,
                    potenciaNecessaria_W: potenciaAmbiente_W,
                    termossifao: termossifaoSelecionado,
                    quantidade: quantidadeFinal
                });
            }
        }
        
        const custoTotal = termossifoesSelecionados.reduce((total, t) => total + (t.preco * t.quantidade), 0);
        const potenciaTotal = termossifoesSelecionados.reduce((total, t) => total + (t.potencia_W * t.quantidade), 0);
        const quantidadeTotal = termossifoesSelecionados.reduce((total, t) => total + t.quantidade, 0);
        
        return {
            quantidade: quantidadeTotal,
            termossifoes: termossifoesSelecionados,
            custoTotal: custoTotal,
            potenciaTotal: potenciaTotal,
            detalhes: detalhes.join('; '),
            ambientes: termossifoesPorAmbiente
        };
    }
    
    // ============================================
    // ATUALIZAÇÃO DE VISIBILIDADE DE CAMPOS
    // ============================================
    atualizarVisibilidadeCampos() {
        const checkboxAgua = document.getElementById('checkboxAgua');
        const checkboxCasa = document.getElementById('checkboxCasa');
        
        // IDs dos campos relacionados a água
        const camposAgua = [
            // Tipo de Uso (padrão de consumo) - sempre visível pois é útil para ambos
        ];
        
        // IDs dos campos relacionados a casa
        const camposCasa = [
            'grupoAreaCasa',
            'grupoAlturaCasa',
            'grupoClasseEnergetica'
        ];
        
        // Função auxiliar para encontrar o grupo pai de um slider
        const encontrarGrupoPai = (elementId) => {
            const elemento = document.getElementById(elementId);
            if (!elemento) return null;
            return elemento.closest('.grupo-entrada');
        };
        
        // Se nenhum checkbox estiver marcado, reativar ao menos água
        if (checkboxAgua && checkboxCasa && !checkboxAgua.checked && !checkboxCasa.checked) {
            checkboxAgua.checked = true;
        }

        // Ocultar/mostrar campos conforme o tipo de sistema
        const mostrarAgua = checkboxAgua && checkboxAgua.checked;
        const mostrarCasa = checkboxCasa && checkboxCasa.checked;
        const mostrarAutonomia = mostrarAgua || mostrarCasa;
        
        // Encontrar os grupos de entrada relacionados à casa
        const grupoAreaCasa = encontrarGrupoPai('sliderAreaCasa');
        const grupoAlturaCasa = encontrarGrupoPai('sliderAlturaCasa');
        const grupoAutonomia = encontrarGrupoPai('sliderDiasAutonomia');
        
        // Encontrar a seção de título "Aquecimento da Casa"
        const secaoAquecimentoCasa = document.querySelector('[data-i18n="secao-aquecimento-casa"]');
        const grupoSecaoCasa = secaoAquecimentoCasa ? secaoAquecimentoCasa.closest('.grupo-entrada') : null;
        
        // Encontrar o grupo da classe energética
        const grupoClasseEnergetica = Array.from(document.querySelectorAll('.grupo-entrada')).find(grupo => {
            const label = grupo.querySelector('label');
            return label && label.getAttribute('data-i18n') === 'label-classe-energetica';
        });
        
        // Aplicar visibilidade
        if (grupoSecaoCasa) {
            grupoSecaoCasa.style.display = mostrarCasa ? 'block' : 'none';
        }
        if (grupoAreaCasa) {
            grupoAreaCasa.style.display = mostrarCasa ? 'block' : 'none';
        }
        if (grupoAlturaCasa) {
            grupoAlturaCasa.style.display = mostrarCasa ? 'block' : 'none';
        }
        if (grupoAutonomia) {
            grupoAutonomia.style.display = mostrarAutonomia ? 'block' : 'none';
        }
        if (grupoClasseEnergetica) {
            grupoClasseEnergetica.style.display = mostrarCasa ? 'block' : 'none';
        }
        
    }
    
    // ============================================
    // ATUALIZAÇÃO DE RESULTADOS
    // ============================================
    // ============================================
    // SUÉCIA
    // ============================================

    obterValoresSE() {
        const ler = (id, padrao) => {
            const bruto = document.getElementById(id)?.value;
            if (bruto === undefined || bruto === null) return padrao;
            const n = parseFloat(String(bruto).replace(/\s/g, '').replace(',', '.'));
            return Number.isFinite(n) ? n : padrao;
        };

        return {
            uso:     document.getElementById('selectSeAnvandning')?.value || 'aguaQuente',
            pessoas: ler('inputSePersoner', 4),
            area:    ler('inputSeArea', 5)
        };
    }

    atualizarSuecia() {
        if (!document.getElementById('seSolfraktion')) return;

        const v = this.obterValoresSE();
        const r = calcularSolarTermicaSuecia(v);
        const t = this.traducoes || {};
        const def = (id, texto) => {
            const el = document.getElementById(id);
            if (el) el.textContent = texto;
        };

        def('seSolfraktion', `${numSE(r.solfraktion * 100, 0)} %`);
        def('seAreaRekommenderad', `${numSE(r.faixaArea.minimo, 0)}–${numSE(r.faixaArea.maximo, 0)} m²`);
        def('seBehov', `${numSE(r.demanda, 0)} kWh/år`);
        def('seProduktion', `${numSE(r.producaoBruta, 0)} kWh/år`);
        def('seNyttiggjord', `${numSE(r.producaoUtil, 0)} kWh/år`);
        def('seTank', `${numSE(r.faixaTanque.minimo, 0)}–${numSE(r.faixaTanque.maximo, 0)} liter`);

        // O aviso é o ponto pedagógico: área a mais não vira água quente.
        const status = document.getElementById('seStatus');
        if (status) {
            if (r.areaExcessiva) {
                status.className = 'aqse-status is-excedente';
                status.textContent = (t.aqse?.statusExcedente || 'Överskott: {kwh} kWh/år kan inte användas. Mer area höjer inte solfraktionen — den ökar bara tiden i stagnation.')
                    .replace('{kwh}', numSE(r.excedente, 0));
            } else {
                status.className = 'aqse-status is-ok';
                status.textContent = t.aqse?.statusOk || 'Arean är i nivå med vad hushållet kan använda under året.';
            }
        }

        return r;
    }

    configurarEventosSE() {
        const recalc = () => this.atualizarSuecia();

        document.getElementById('selectSeAnvandning')?.addEventListener('change', recalc);

        [['inputSePersoner', 'sliderSePersoner', 0], ['inputSeArea', 'sliderSeArea', 1]]
            .forEach(([idInput, idSlider, casas]) => {
                const input  = document.getElementById(idInput);
                const slider = document.getElementById(idSlider);

                slider?.addEventListener('input', () => {
                    if (input) input.value = numSE(parseFloat(slider.value), casas);
                    recalc();
                });

                input?.addEventListener('input', () => {
                    const n = parseFloat(String(input.value).replace(/\s/g, '').replace(',', '.'));
                    if (slider && Number.isFinite(n)) slider.value = String(n);
                    recalc();
                });
            });
    }

    atualizarResultados() {
        // `body.lang-se` comanda as regras .se-only / .se-hide do CSS.
        const idiomaAgora = i18n.obterIdiomaAtual();
        document.body.classList.toggle('lang-se', idiomaAgora === 'sv-SE');
        document.body.classList.toggle('lang-br', idiomaAgora === 'pt-BR');
        document.body.classList.toggle('lang-it', idiomaAgora === 'it-IT');
        this.atualizarSuecia();

        // Obter valores dos inputs
        const latitude = parseFloat(document.getElementById('sliderLatitude')?.value || 0);
        const altitude = parseFloat(document.getElementById('sliderAltitude')?.value || 0);
        const numPessoas = parseFloat(document.getElementById('sliderPessoas')?.value || 1);
        const areaCasa = parseFloat(document.getElementById('sliderAreaCasa')?.value || 0);
        const alturaCasa = parseFloat(document.getElementById('sliderAlturaCasa')?.value || 2.7);
        const diasAutonomia = parseFloat(document.getElementById('sliderDiasAutonomia')?.value || 1);
        
        // Obter checkboxes
        const calcularAgua = document.getElementById('checkboxAgua')?.checked || false;
        const calcularCasa = document.getElementById('checkboxCasa')?.checked || false;
        
        // Obter tipo de uso (radio button)
        const tipoUsoSelecionado = document.querySelector('input[name="tipoUso"]:checked')?.value || 'Padrao';
        
        // Obter classe energética (radio button)
        const classeEnergetica = document.querySelector('input[name="classeEnergetica"]:checked')?.value || 'D';
        
        // Calcular temperaturas
        const T_agua_fria = this.calcularTemperaturaAgua(latitude, altitude);
        const T_ambiente_inverno = this.calcularTemperaturaAmbiente(latitude, altitude);
        const HSP = this.calcularHorasSolPicoInverno(latitude);
        
        // Obter perfil de consumo
        const perfilConsumo = this.MATRIZ_CONSUMO[tipoUsoSelecionado] || this.MATRIZ_CONSUMO['Padrao'];
        const consumoPorPessoa = perfilConsumo.consumo_por_pessoa;
        const T_desejada = perfilConsumo.T_desejada;
        
        // Calcular demanda de aquecimento de água
        let demandaAgua_kWh_dia = 0;
        if (calcularAgua) {
            const volumeDiario = numPessoas * consumoPorPessoa;
            const deltaT_agua = T_desejada - T_agua_fria;
            demandaAgua_kWh_dia = (volumeDiario * this.CONSTANTS.densidade_agua * deltaT_agua * this.CONSTANTS.calor_especifico_agua) / 1000.0;
        }
        
        // Calcular demanda de aquecimento da casa
        let demandaCasa_kWh_dia = 0;
        let potenciaCasa_W = 0;
        let resultadoTermossifoes = null;
        if (calcularCasa && areaCasa > 0) {
            resultadoTermossifoes = this.calcularTermossifoes(areaCasa, alturaCasa, T_ambiente_inverno, classeEnergetica);
            potenciaCasa_W = resultadoTermossifoes.potenciaTotal;
            demandaCasa_kWh_dia = (potenciaCasa_W * this.HORAS_AQUECIMENTO_POR_DIA) / 1000.0;
        }
        
        // Demanda total
        const demandaTotal_kWh_dia = demandaAgua_kWh_dia + demandaCasa_kWh_dia;
        
        // Obter modelo de referência
        const modelo = this.obterModeloReferencia();
        const areaUnitaria = modelo.especificacoes.area_m2;
        const eficiencia = modelo.especificacoes.eficiencia_optica;
        const coefPerda = modelo.especificacoes.coef_perda_linear;
        
        // Calcular área de coletores necessária
        const irradiacaoMedia_kWh_m2_dia = HSP;
        const fatorSeguranca = 1.25;
        const denominadorArea = irradiacaoMedia_kWh_m2_dia * eficiencia;
        const areaNecessaria = denominadorArea > 0
            ? (demandaTotal_kWh_dia * fatorSeguranca) / denominadorArea
            : 0;
        
        // Calcular número de painéis
        const numeroPaineis = Math.ceil(areaNecessaria / areaUnitaria);
        const areaTotal = numeroPaineis * areaUnitaria;
        
        // Calcular volume do boiler (se calculando água)
        const volumeBoiler = calcularAgua ? numPessoas * consumoPorPessoa * diasAutonomia : 0;
        
        // Calcular custos
        const idioma = i18n.obterIdiomaAtual();
        // Preços de mercado por país, na moeda local. Os valores suecos são
        // estimativa de ordem de grandeza (conversão do italiano com ajuste
        // para o custo de instalação mais alto na Suécia), no mesmo espírito
        // aproximado dos já existentes.
        const PRECOS = {
            'pt-BR': { moeda: 'R$', painel: 1200, litroBoiler: 8, tubulacoes: 200, isolantes: 80 },
            'it-IT': { moeda: '€', painel: 450, litroBoiler: 2.5, tubulacoes: 80, isolantes: 30 },
            'sv-SE': { moeda: 'kr', painel: 6000, litroBoiler: 30, tubulacoes: 1000, isolantes: 400 }
        };
        const precos = PRECOS[idioma] || PRECOS['it-IT'];

        const moedaSimbolo = precos.moeda;
        const precoPorPainel = precos.painel;
        const precoPorLitroBoiler = precos.litroBoiler;
        const custoTubulacoesPorPainel = precos.tubulacoes;
        const custoIsolantesPorPainel = precos.isolantes;
        
        const custoPaineis = numeroPaineis * precoPorPainel;
        const custoBoiler = volumeBoiler * precoPorLitroBoiler;
        const custoTubulacoes = numeroPaineis * custoTubulacoesPorPainel;
        const custoIsolantes = numeroPaineis * custoIsolantesPorPainel;
        const custoTermossifoes = resultadoTermossifoes ? resultadoTermossifoes.custoTotal : 0;
        
        const custoTotal = custoPaineis + custoBoiler + custoTubulacoes + custoIsolantes + custoTermossifoes;
        
        // Atualizar elementos HTML
        document.getElementById('areaColetor').textContent = `${this.formatarDecimal(areaTotal, 2)} m²`;
        document.getElementById('numeroPaineis').textContent = numeroPaineis;
        document.getElementById('demandaEnergia').textContent = `${this.formatarDecimal(demandaAgua_kWh_dia, 2)} kWh/dia`;
        document.getElementById('demandaCasa').textContent = calcularCasa ? `${this.formatarDecimal(demandaCasa_kWh_dia, 2)} kWh/dia` : '-';
        document.getElementById('volumeBoiler').textContent = calcularAgua ? `${this.formatarDecimal(volumeBoiler, 0)} L` : '-';
        document.getElementById('potenciaCasa').textContent = calcularCasa ? this.formatarPotenciaWkW(potenciaCasa_W) : '-';
        
        // Atualizar custos
        document.getElementById('custoTotal').textContent = this.comMoeda(moedaSimbolo, this.formatarNumeroComSufixo(custoTotal, 2));
        document.getElementById('custoPaineis').textContent = this.comMoeda(moedaSimbolo, this.formatarNumeroComSufixo(custoPaineis, 2));
        document.getElementById('custoAcumuladores').textContent = calcularAgua ? this.comMoeda(moedaSimbolo, this.formatarNumeroComSufixo(custoBoiler, 2)) : '-';
        document.getElementById('custoTubulacoes').textContent = this.comMoeda(moedaSimbolo, this.formatarNumeroComSufixo(custoTubulacoes, 2));
        document.getElementById('custoIsolantes').textContent = this.comMoeda(moedaSimbolo, this.formatarNumeroComSufixo(custoIsolantes, 2));
        
        // Atualizar termossifões
        const resultadoTermossifoesDiv = document.getElementById('resultadoTermossifoes');
        const termossifoesDetalhes = document.getElementById('termossifoesDetalhes');
        const custoTermossifoesSpan = document.getElementById('custoTermossifoes');
        
        if (calcularCasa && resultadoTermossifoes && resultadoTermossifoes.quantidade > 0) {
            resultadoTermossifoesDiv.style.display = 'flex';
            termossifoesDetalhes.textContent = resultadoTermossifoes.detalhes;
            custoTermossifoesSpan.textContent = this.comMoeda(moedaSimbolo, this.formatarNumeroComSufixo(custoTermossifoes, 2));
            custoTermossifoesSpan.title = resultadoTermossifoes.detalhes;
        } else {
            resultadoTermossifoesDiv.style.display = 'none';
            custoTermossifoesSpan.textContent = '-';
            custoTermossifoesSpan.title = '';
        }
        
        // Atualizar nota de referência do painel
        const notaPainelReferencia = document.getElementById('notaPainelReferencia');
        if (notaPainelReferencia) {
            const textoModelo = this.traducoes['modelo-referencia'] || 'Modelo de referência';
            const textoLink = modelo.link.texto;
            notaPainelReferencia.innerHTML = `<em>${textoModelo}: <a href="${modelo.link.url}" target="_blank">${modelo.nome}</a> (${textoLink})</em>`;
        }
        
        // Atualizar gráficos
        const energiaSolar_kWh_dia = areaTotal * irradiacaoMedia_kWh_m2_dia * eficiencia;
        this.atualizarGraficos(demandaAgua_kWh_dia, demandaCasa_kWh_dia, energiaSolar_kWh_dia, calcularAgua, calcularCasa);

        this.renderizarExplicacao({
            numeroPaineis,
            areaTotal,
            demandaAgua_kWh_dia,
            demandaCasa_kWh_dia,
            volumeBoiler,
            diasAutonomia,
            potenciaCasa_W,
            custoTotal,
            calcularAgua,
            calcularCasa,
            moedaSimbolo
        });
    }
    
    // ============================================
    // ATUALIZAÇÃO DOS GRÁFICOS
    // ============================================
    atualizarGraficos(demandaAgua_kWh_dia, demandaCasa_kWh_dia, energiaSolar_kWh_dia, calcularAgua, calcularCasa) {
        const idioma = i18n.obterIdiomaAtual();
        
        // Gráfico de Distribuição de Demanda
        this.atualizarGraficoDistribuicao(demandaAgua_kWh_dia, demandaCasa_kWh_dia, calcularAgua, calcularCasa, idioma);
        
        // Gráfico de Comparação Solar vs Demanda
        this.atualizarGraficoComparacao(energiaSolar_kWh_dia, demandaAgua_kWh_dia + demandaCasa_kWh_dia, idioma);
        
        // Gráfico de Eficiência do Sistema
        this.atualizarGraficoEficiencia(energiaSolar_kWh_dia, demandaAgua_kWh_dia, demandaCasa_kWh_dia, calcularAgua, calcularCasa, idioma);
    }

    renderizarExplicacao({ numeroPaineis, areaTotal, demandaAgua_kWh_dia, demandaCasa_kWh_dia, volumeBoiler, diasAutonomia, potenciaCasa_W, custoTotal, calcularAgua, calcularCasa, moedaSimbolo }) {
        const ta = mapa => i18n.porIdioma(mapa);
        const demandaTotal = demandaAgua_kWh_dia + demandaCasa_kWh_dia;

        this.explicacao.renderizar({
            destaque: ta({
                'pt-BR': `Dimensionamento recomendado com ${numeroPaineis} painéis e área coletora de ${this.formatarDecimal(areaTotal, 2)} m².`,
                'it-IT': `Dimensionamento consigliato con ${numeroPaineis} pannelli e area collettori di ${this.formatarDecimal(areaTotal, 2)} m².`,
                'sv-SE': `Rekommenderad dimensionering med ${numeroPaineis} solfångare och en yta på ${this.formatarDecimal(areaTotal, 2)} m².`
            }),
            linhas: [
                {
                    icone: '🔥',
                    titulo: ta({ 'pt-BR': 'Demanda Térmica Total', 'it-IT': 'Domanda Termica Totale', 'sv-SE': 'Totalt värmebehov' }),
                    valor: `${this.formatarDecimal(demandaTotal, 2)} kWh/dia`,
                    descricao: ta({
                        'pt-BR': `Água: ${this.formatarDecimal(demandaAgua_kWh_dia, 2)} | Casa: ${this.formatarDecimal(demandaCasa_kWh_dia, 2)}.`,
                        'it-IT': `Acqua: ${this.formatarDecimal(demandaAgua_kWh_dia, 2)} | Casa: ${this.formatarDecimal(demandaCasa_kWh_dia, 2)}.`,
                        'sv-SE': `Vatten: ${this.formatarDecimal(demandaAgua_kWh_dia, 2)} | Hus: ${this.formatarDecimal(demandaCasa_kWh_dia, 2)}.`
                    })
                },
                {
                    icone: '🛢️',
                    titulo: ta({ 'pt-BR': 'Boiler e Potência', 'it-IT': 'Boiler e Potenza', 'sv-SE': 'Ackumulatortank och effekt' }),
                    valor: calcularAgua
                        ? `${this.formatarDecimal(volumeBoiler, 0)} L`
                        : ta({ 'pt-BR': 'Boiler desativado', 'it-IT': 'Boiler disattivato', 'sv-SE': 'Tanken avstängd' }),
                    descricao: calcularCasa
                        ? ta({
                            'pt-BR': `Autonomia: ${this.formatarDecimal(diasAutonomia, 0)} dia(s). Potência para ambiente: ${this.formatarPotenciaWkW(potenciaCasa_W)}.`,
                            'it-IT': `Autonomia: ${this.formatarDecimal(diasAutonomia, 0)} giorno/i. Potenza ambiente: ${this.formatarPotenciaWkW(potenciaCasa_W)}.`,
                            'sv-SE': `Autonomi: ${this.formatarDecimal(diasAutonomia, 0)} dygn. Effekt för rumsvärme: ${this.formatarPotenciaWkW(potenciaCasa_W)}.`
                        })
                        : ta({
                            'pt-BR': `Volume para ${this.formatarDecimal(diasAutonomia, 0)} dia(s) de água quente.`,
                            'it-IT': `Volume per ${this.formatarDecimal(diasAutonomia, 0)} giorno/i di acqua calda.`,
                            'sv-SE': `Volym för ${this.formatarDecimal(diasAutonomia, 0)} dygn med varmvatten.`
                        })
                },
                {
                    icone: '💰',
                    titulo: ta({ 'pt-BR': 'Custo Estimado', 'it-IT': 'Costo Stimato', 'sv-SE': 'Uppskattad kostnad' }),
                    valor: this.comMoeda(moedaSimbolo, this.formatarNumeroComSufixo(custoTotal, 2)),
                    descricao: ta({
                        'pt-BR': 'Inclui coletores, boiler, tubulação, isolantes e termossifões.',
                        'it-IT': 'Include collettori, boiler, tubazioni, isolanti e termosifoni.',
                        'sv-SE': 'Omfattar solfångare, ackumulatortank, rör, isolering och radiatorer.'
                    })
                }
            ],
            dica: ta({
                'pt-BR': 'Se aumentar pessoas, área da casa ou altitude, a demanda de calor tende a subir.',
                'it-IT': 'Se aumenti persone, area casa o altitudine, la domanda di calore tende a salire.',
                'sv-SE': 'Fler personer, större bostadsyta eller högre höjd över havet drar upp värmebehovet. På svenska breddgrader räcker solvärmen sällan ensam på vintern — räkna med ett kompletterande värmesystem.'
            }),
            norma: ta({
                'pt-BR': 'Boas práticas ABNT NBR 15569 para aquecimento solar térmico',
                'it-IT': 'Buone pratiche ABNT NBR 15569 per riscaldamento solare termico',
                'sv-SE': 'God praxis enligt SS-EN 12976 för solvärmesystem och Boverkets byggregler (BBR)'
            })
        });
    }
    
    atualizarGraficoDistribuicao(demandaAgua, demandaCasa, calcularAgua, calcularCasa, idioma) {
        const ctx = document.getElementById('graficoDistribuicao');
        if (!ctx) return;
        
        // Destruir gráfico anterior
        if (this.graficoDistribuicao) {
            this.graficoDistribuicao.destroy();
        }
        
        const labels = [];
        const data = [];
        const colors = [];
        const cores = this.obterCoresGrafico();
        
        if (calcularAgua && demandaAgua > 0) {
            labels.push(i18n.porIdioma({ 'pt-BR': '💧 Água', 'it-IT': '💧 Acqua', 'sv-SE': '💧 Vatten' }));
            data.push(demandaAgua);
            colors.push(cores.blue);
        }
        
        if (calcularCasa && demandaCasa > 0) {
            labels.push(i18n.porIdioma({ 'pt-BR': '🏠 Casa', 'it-IT': '🏠 Casa', 'sv-SE': '🏠 Hus' }));
            data.push(demandaCasa);
            colors.push(cores.red);
        }
        
        if (data.length === 0) return;
        
        this.graficoDistribuicao = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: cores.text }
                    },
                    title: {
                        display: true,
                        text: i18n.porIdioma({ 'pt-BR': 'Distribuição de Demanda (kWh/dia)', 'it-IT': 'Distribuzione della Domanda (kWh/giorno)', 'sv-SE': 'Fördelning av behovet (kWh/dygn)' }),
                        color: cores.text
                    }
                }
            }
        });
    }
    
    atualizarGraficoComparacao(energiaSolar, demandaTotal, idioma) {
        const ctx = document.getElementById('graficoComparacao');
        if (!ctx) return;
        
        // Destruir gráfico anterior
        if (this.graficoComparacao) {
            this.graficoComparacao.destroy();
        }
        
        const labelSolar = i18n.porIdioma({ 'pt-BR': 'Energia Solar', 'it-IT': 'Energia Solare', 'sv-SE': 'Solenergi' });
        const labelDemanda = i18n.porIdioma({ 'pt-BR': 'Demanda Total', 'it-IT': 'Domanda Totale', 'sv-SE': 'Totalt behov' });
        const cores = this.obterCoresGrafico();
        
        this.graficoComparacao = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [labelSolar, labelDemanda],
                datasets: [{
                    label: 'kWh/dia',
                    data: [energiaSolar, demandaTotal],
                    backgroundColor: [cores.yellow, cores.red]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: cores.text },
                        grid: { color: cores.grid },
                        title: {
                            display: true,
                            text: 'kWh/dia',
                            color: cores.text
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: i18n.porIdioma({ 'pt-BR': 'Solar vs Demanda', 'it-IT': 'Solare vs Domanda', 'sv-SE': 'Sol jämfört med behov' }),
                        color: cores.text
                    }
                }
            }
        });
    }
    
    atualizarGraficoEficiencia(energiaSolar, demandaAgua, demandaCasa, calcularAgua, calcularCasa, idioma) {
        const ctx = document.getElementById('graficoEficiencia');
        if (!ctx) return;
        
        // Destruir gráfico anterior
        if (this.graficoEficiencia) {
            this.graficoEficiencia.destroy();
        }
        
        const demandaTotal = (calcularAgua ? demandaAgua : 0) + (calcularCasa ? demandaCasa : 0);
        const coberturaSolar = demandaTotal > 0 ? Math.min((energiaSolar / demandaTotal) * 100, 100) : 0;
        const deficitEletrico = Math.max(100 - coberturaSolar, 0);
        
        const labelSolar = i18n.porIdioma({ 'pt-BR': 'Cobertura Solar', 'it-IT': 'Copertura Solare', 'sv-SE': 'Soltäckning' });
        const labelEletrico = i18n.porIdioma({ 'pt-BR': 'Energia Elétrica Necessária', 'it-IT': 'Energia Elettrica Necessaria', 'sv-SE': 'Nödvändig eltillskott' });
        const cores = this.obterCoresGrafico();
        
        this.graficoEficiencia = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [i18n.porIdioma({ 'pt-BR': 'Sistema', 'it-IT': 'Sistema', 'sv-SE': 'System' })],
                datasets: [
                    {
                        label: labelSolar,
                        data: [coberturaSolar],
                        backgroundColor: cores.green,
                        stack: 'Stack 0'
                    },
                    {
                        label: labelEletrico,
                        data: [deficitEletrico],
                        backgroundColor: cores.orange,
                        stack: 'Stack 0'
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    x: {
                        stacked: true,
                        max: 100,
                        ticks: { color: cores.text },
                        grid: { color: cores.grid },
                        title: {
                            display: true,
                            text: '%',
                            color: cores.text
                        }
                    },
                    y: {
                        stacked: true,
                        ticks: { color: cores.text },
                        grid: { color: cores.grid }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: cores.text }
                    },
                    title: {
                        display: true,
                        text: i18n.porIdioma({ 'pt-BR': 'Eficiência do Sistema (%)', 'it-IT': 'Efficienza del Sistema (%)', 'sv-SE': 'Systemets verkningsgrad (%)' }),
                        color: cores.text
                    }
                }
            }
        });
    }
}

// ============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ============================================
const app = new AquecimentoApp();

// Aguardar carregamento do DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app.inicializar();
    });
} else {
    app.inicializar();
}
