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
            ]
        };
    }
    
    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    inicializarAquecimento() {
        console.log('✅ Inicializando Aquecimento...');
        
        // Configurar todos os eventos e elementos
        this.configurarSliders();
        this.configurarBotoesIncremento();
        this.configurarInputsTexto();
        this.configurarCheckboxes();
        this.configurarRadios();
        this.configurarMemorial();
        this.configurarInfoIcons();
        
        // Atualizar limites de latitude baseado no idioma
        this.atualizarLimitesLatitude();
        
        // Configurar visibilidade inicial
        this.atualizarVisibilidadeCampos();
        
        // Calcular resultados iniciais
        setTimeout(() => {
            this.atualizarVisibilidadeCampos();
            this.atualizarResultados();
        }, 100);
        
        console.log('✅ Aquecimento inicializado com sucesso!');
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
    
    // ============================================
    // CONFIGURAÇÃO DE BOTÕES DE INCREMENTO
    // ============================================
    configurarBotoesIncremento() {
        const botoes = document.querySelectorAll('.arrow-btn');
        
        botoes.forEach(botao => {
            const targetId = botao.getAttribute('data-target');
            const step = parseFloat(botao.getAttribute('data-step'));
            
            // Evento de mousedown/touchstart - inicia incremento
            botao.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.iniciarIncremento(targetId, step);
            });
            
            botao.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.iniciarIncremento(targetId, step);
            });
            
            // Evento de mouseup/touchend - para incremento
            botao.addEventListener('mouseup', () => this.pararIncremento());
            botao.addEventListener('touchend', () => this.pararIncremento());
            botao.addEventListener('mouseleave', () => this.pararIncremento());
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
            this.atualizarMemorialComValores();
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
        console.log('🌐 Atualizando após troca de idioma...');
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
        const idioma = i18n.getIdioma();
        return this.MODELO_REFERENCIA[idioma] || this.MODELO_REFERENCIA['pt-BR'];
    }
    
    atualizarLimitesLatitude() {
        const sliderLatitude = document.getElementById('sliderLatitude');
        const inputLatitude = document.getElementById('inputLatitude');
        
        if (!sliderLatitude) return;
        
        const valorAtual = parseFloat(sliderLatitude.value);
        const idioma = i18n.getIdioma();
        
        if (idioma === 'it-IT') {
            sliderLatitude.min = '36';
            sliderLatitude.max = '47';
            sliderLatitude.step = '0.5';
            
            if (valorAtual < 36 || valorAtual > 47 || valorAtual < 0) {
                sliderLatitude.value = '41.9';
                if (inputLatitude) inputLatitude.value = this.formatarDecimal(41.9, 1);
            }
        } else {
            sliderLatitude.min = '-35';
            sliderLatitude.max = '-5';
            sliderLatitude.step = '0.5';
            
            if (valorAtual > -5 || valorAtual < -35 || valorAtual > 0) {
                sliderLatitude.value = '-23.5';
                if (inputLatitude) inputLatitude.value = this.formatarDecimal(-23.5, 1);
            }
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
        const idioma = i18n.getIdioma();
        
        // Definir tipos de ambiente por idioma
        const tiposAmbiente = idioma === 'it-IT' ? {
            sala: 'Soggiorno',
            quarto: 'Camera',
            cozinha: 'Cucina',
            banheiro: 'Bagno',
            corredor: 'Corridoio'
        } : {
            sala: 'Sala de Estar',
            quarto: 'Quarto',
            cozinha: 'Cozinha',
            banheiro: 'Banheiro',
            corredor: 'Corredor'
        };
        
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
        
        const idioma = i18n.getIdioma();
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
    // CONTINUA NO PRÓXIMO BLOCO...
    // ============================================
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
