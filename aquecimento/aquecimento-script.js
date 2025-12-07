// ============================================
// DIMENSIONADOR DE AQUECEDOR SOLAR TÉRMICO
// Sistema Termossifão com Tubos a Vácuo
// ============================================

// ============================================
// CONFIGURAÇÃO DE CHAVES E SELETORES
// ============================================
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido' };
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) ? SiteConfig.SELECTORS : { HOME_BUTTON: '.home-button-fixed', LANG_BTN: '.lang-btn', ARROW_BTN: '.arrow-btn' };
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || (typeof SiteConfig !== 'undefined' ? SiteConfig.DEFAULTS.language : 'pt-BR');

// ============================================
// CONSTANTES FÍSICAS FIXAS
// ============================================
const CONSTANTS = {
    densidade_agua: 1.0,              // kg/L
    calor_especifico_agua: 1.163,     // Wh/kg°C (Para cálculo direto em kWh)
    irradiacao_horaria_pico_media: 800.0, // W/m²
    altura_minima_boiler: 0.20        // metros
};

// ============================================
// MATRIZES DE DADOS
// ============================================

// Matriz de Irradiação Solar e Clima (Por Faixa de Latitude)
// Valores base ao nível do mar (altitude = 0m)
// Brasil (latitudes negativas - Sul)
const MATRIZ_CLIMA_BRASIL = {
    "15S_25S": { 
        H_g_diaria: 4.0, 
        T_agua_fria_base: 22.0,      // Temperatura base ao nível do mar
        T_ambiente_inverno_base: 18.0 // Temperatura ambiente base ao nível do mar
    },  // Sudeste do Brasil
    "25S_35S": { 
        H_g_diaria: 3.5, 
        T_agua_fria_base: 18.0, 
        T_ambiente_inverno_base: 15.0 
    },  // Sul do Brasil
    "OUTRAS": { 
        H_g_diaria: 3.8, 
        T_agua_fria_base: 20.0, 
        T_ambiente_inverno_base: 16.0 
    }    // Valor padrão
};

// Itália (latitudes positivas - Norte)
const MATRIZ_CLIMA_ITALIA = {
    "36N_40N": { 
        H_g_diaria: 3.8, 
        T_agua_fria_base: 15.0,      // Temperatura base ao nível do mar (Sul da Itália)
        T_ambiente_inverno_base: 10.0 
    },   // Sul da Itália
    "40N_44N": { 
        H_g_diaria: 3.2, 
        T_agua_fria_base: 12.0, 
        T_ambiente_inverno_base: 7.0 
    },   // Centro da Itália
    "44N_47N": { 
        H_g_diaria: 2.8, 
        T_agua_fria_base: 9.0, 
        T_ambiente_inverno_base: 4.0 
    },    // Norte da Itália
    "OUTRAS": { 
        H_g_diaria: 3.3, 
        T_agua_fria_base: 13.0, 
        T_ambiente_inverno_base: 8.0 
    }     // Valor padrão
};

// Constantes para cálculo de temperatura com altitude
// Gradiente adiabático: temperatura diminui ~6.5°C por 1000m de altitude
const GRADIENTE_ADIABATICO = 6.5; // °C por 1000m
// Altitude de referência (nível do mar)
const ALTITUDE_REFERENCIA = 0; // metros

// Matriz de Consumo e Temperatura Desejada
// [U_tipo] : [Consumo_por_pessoa (L/dia), T_desejada (°C), Fator_autonomia]
const MATRIZ_CONSUMO = {
    "Economico": { consumo_por_pessoa: 30.0, T_desejada: 40.0, fator_autonomia: 1.25 },
    "Padrao": { consumo_por_pessoa: 40.0, T_desejada: 45.0, fator_autonomia: 1.5 },
    "Alto": { consumo_por_pessoa: 60.0, T_desejada: 50.0, fator_autonomia: 2.0 }
};

// Matriz de Especificações do Coletor (Tubos a Vácuo)
// [M_coletor] : [Eficiencia_Otica (η0), Coef_Perda_Linear (a1 - W/m²K), Area_Painel (A_painel - m²)]
const MATRIZ_COLETOR = {
    "Modelo_A": { eficiencia_optica: 0.75, coef_perda_linear: 1.5, area_painel: 1.8 },  // 20 tubos
    "Modelo_B": { eficiencia_optica: 0.70, coef_perda_linear: 1.8, area_painel: 1.5 },  // 15 tubos
    "Modelo_C": { eficiencia_optica: 0.78, coef_perda_linear: 1.2, area_painel: 2.2 }   // 25 tubos
};

// Constantes para cálculo de aquecimento da casa
// Potência necessária por metro cúbico (W/m³) - base para cálculo de volume
const POTENCIA_POR_M3 = 30; // W/m³ (aproximadamente 100 BTU/m³ convertido)

// Fatores de classe energética (A a G)
// Valores menores = melhor isolamento = menos energia necessária
const FATORES_CLASSE_ENERGETICA = {
    "A": 0.5,   // Excelente isolamento - 50% da necessidade base
    "B": 0.6,   // Muito bom isolamento - 60%
    "C": 0.7,   // Bom isolamento - 70%
    "D": 1.0,   // Isolamento padrão - 100% (referência)
    "E": 1.3,   // Isolamento abaixo do padrão - 130%
    "F": 1.6,   // Isolamento ruim - 160%
    "G": 2.0    // Isolamento muito ruim - 200%
};

// Temperatura desejada para aquecimento da casa (conforto térmico)
const TEMPERATURA_CONFORTO_CASA = 22.0; // °C

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Converte string numérica para número, aceitando tanto ponto quanto vírgula como decimal
 * @param {string} valorTexto - Valor como string (pode ter ponto ou vírgula)
 * @returns {number} Valor numérico
 */
function converterParaNumero(valorTexto) {
    if (!valorTexto) return NaN;
    // Substitui vírgula por ponto para parseFloat funcionar
    const valorLimpo = valorTexto.toString().replace(',', '.');
    return parseFloat(valorLimpo);
}

/**
 * Formata número com separador de milhares
 * @param {number} valor - Valor numérico
 * @returns {string} Valor formatado
 */
function formatarNumero(valor) {
    if (isNaN(valor) || valor === null || valor === undefined) return '-';
    // Usa 'pt-BR' para garantir vírgula como separador decimal
    return valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

/**
 * Formata número com casas decimais
 * Sempre usa vírgula como separador decimal (padrão brasileiro)
 * @param {number} valor - Valor numérico
 * @param {number} decimais - Número de casas decimais
 * @returns {string} Valor formatado com vírgula
 */
function formatarDecimal(valor, decimais = 1) {
    if (isNaN(valor) || valor === null || valor === undefined) return '-';
    // Usa 'pt-BR' para garantir vírgula como separador decimal
    const formatado = valor.toLocaleString('pt-BR', {
        minimumFractionDigits: decimais,
        maximumFractionDigits: decimais
    });
    return formatado;
}

/**
 * Determina a faixa de latitude baseada na latitude fornecida e idioma
 * @param {number} latitude - Latitude em graus
 * @param {string} idioma - Idioma atual ('pt-BR' ou 'it-IT')
 * @returns {string} Chave da faixa de latitude
 */
function obterFaixaLatitude(latitude, idioma) {
    if (idioma === 'it-IT') {
        // Itália: latitudes positivas (Norte)
        if (latitude >= 36 && latitude <= 40) {
            return "36N_40N";
        } else if (latitude > 40 && latitude <= 44) {
            return "40N_44N";
        } else if (latitude > 44 && latitude <= 47) {
            return "44N_47N";
        } else {
            return "OUTRAS";
        }
    } else {
        // Brasil: latitudes negativas (Sul)
        if (latitude >= -25 && latitude <= -15) {
            return "15S_25S";
        } else if (latitude < -25 && latitude >= -35) {
            return "25S_35S";
        } else {
            return "OUTRAS";
        }
    }
}

/**
 * Obtém a matriz de clima baseada no idioma
 * @param {string} idioma - Idioma atual ('pt-BR' ou 'it-IT')
 * @returns {Object} Matriz de clima correspondente
 */
function obterMatrizClima(idioma) {
    return idioma === 'it-IT' ? MATRIZ_CLIMA_ITALIA : MATRIZ_CLIMA_BRASIL;
}

/**
 * Calcula a temperatura da água fria ajustada pela altitude
 * Baseado em dados geográficos: temperatura diminui com altitude
 * @param {number} T_base - Temperatura base ao nível do mar (°C)
 * @param {number} altitude - Altitude em metros
 * @returns {number} Temperatura ajustada pela altitude (°C)
 */
function calcularTemperaturaComAltitude(T_base, altitude) {
    // Gradiente adiabático: ~6.5°C por 1000m
    // Para água, o efeito é um pouco menor, usamos ~5.5°C por 1000m
    const gradiente_agua = 5.5; // °C por 1000m para água
    const variacao_altitude = (altitude - ALTITUDE_REFERENCIA) * (gradiente_agua / 1000.0);
    const T_ajustada = T_base - variacao_altitude;
    
    // Limitar temperatura mínima (água não congela facilmente em sistemas, mas limitamos a 2°C)
    return Math.max(2.0, T_ajustada);
}

/**
 * Calcula a temperatura ambiente de inverno ajustada pela altitude
 * @param {number} T_base - Temperatura ambiente base ao nível do mar (°C)
 * @param {number} altitude - Altitude em metros
 * @returns {number} Temperatura ambiente ajustada pela altitude (°C)
 */
function calcularTemperaturaAmbienteComAltitude(T_base, altitude) {
    // Gradiente adiabático padrão: ~6.5°C por 1000m
    const variacao_altitude = (altitude - ALTITUDE_REFERENCIA) * (GRADIENTE_ADIABATICO / 1000.0);
    const T_ajustada = T_base - variacao_altitude;
    
    // Limitar temperatura mínima a -5°C (condições extremas de inverno)
    return Math.max(-5.0, T_ajustada);
}

// ============================================
// FUNÇÕES DE CÁLCULO
// ============================================

/**
 * Calcula a demanda de energia térmica para aquecimento da casa
 * @param {number} areaCasa - Área da casa em m²
 * @param {number} alturaCasa - Altura do pé direito em m
 * @param {string} classeEnergetica - Classe energética (A a G)
 * @param {number} T_ambiente_inverno - Temperatura ambiente de inverno em °C
 * @returns {Object} Objeto com valores calculados para aquecimento da casa
 */
function calcularAquecimentoCasa(areaCasa, alturaCasa, classeEnergetica, T_ambiente_inverno) {
    // Volume da casa
    const volumeCasa = areaCasa * alturaCasa; // m³
    
    // Diferença de temperatura (conforto - ambiente inverno)
    const Delta_T_casa = TEMPERATURA_CONFORTO_CASA - T_ambiente_inverno;
    
    // Potência necessária base (W)
    const potenciaBase_W = volumeCasa * POTENCIA_POR_M3 * Delta_T_casa;
    
    // Aplicar fator de classe energética
    const fatorClasse = FATORES_CLASSE_ENERGETICA[classeEnergetica] || FATORES_CLASSE_ENERGETICA["D"];
    const potenciaAjustada_W = potenciaBase_W * fatorClasse;
    
    // Converter para kWh/dia (assumindo 12 horas de funcionamento por dia no inverno)
    const horasFuncionamento = 12; // horas/dia
    const demandaCasa_kWh = (potenciaAjustada_W * horasFuncionamento) / 1000.0;
    
    return {
        volumeCasa_m3: volumeCasa,
        potenciaNecessaria_W: potenciaAjustada_W,
        demandaCasa_kWh: demandaCasa_kWh,
        Delta_T_casa: Delta_T_casa
    };
}

/**
 * Calcula a demanda de energia térmica necessária
 * @param {number} numeroPessoas - Número de pessoas
 * @param {string} tipoUso - Tipo de uso (Economico, Padrao, Alto)
 * @param {number} latitude - Latitude do local
 * @param {number} altitude - Altitude do local
 * @param {string} modeloColetor - Modelo do coletor
 * @param {number} areaCasa - Área da casa em m²
 * @param {number} alturaCasa - Altura do pé direito em m
 * @param {string} classeEnergetica - Classe energética (A a G)
 * @returns {Object} Objeto com todos os valores calculados
 */
function calcularDimensionamento(numeroPessoas, tipoUso, latitude, altitude, modeloColetor, areaCasa, alturaCasa, classeEnergetica) {
    // Obter dados das matrizes
    const dadosConsumo = MATRIZ_CONSUMO[tipoUso] || MATRIZ_CONSUMO["Padrao"];
    const matrizClima = obterMatrizClima(idiomaAtual);
    const faixaLatitude = obterFaixaLatitude(latitude, idiomaAtual);
    const dadosClimaBase = matrizClima[faixaLatitude] || matrizClima["OUTRAS"];
    const dadosColetor = MATRIZ_COLETOR[modeloColetor] || MATRIZ_COLETOR["Modelo_B"];

    // Calcular temperaturas ajustadas pela altitude
    const T_agua_fria = calcularTemperaturaComAltitude(
        dadosClimaBase.T_agua_fria_base, 
        altitude
    );
    const T_ambiente_inverno = calcularTemperaturaAmbienteComAltitude(
        dadosClimaBase.T_ambiente_inverno_base, 
        altitude
    );
    
    // Criar objeto dadosClima com valores ajustados
    const dadosClima = {
        H_g_diaria: dadosClimaBase.H_g_diaria,
        T_agua_fria: T_agua_fria,
        T_ambiente_inverno: T_ambiente_inverno
    };

    // 4.1. CÁLCULO DA DEMANDA DE ENERGIA TÉRMICA (E_nec)
    const V_diario_L = numeroPessoas * dadosConsumo.consumo_por_pessoa;
    const Delta_T = dadosConsumo.T_desejada - dadosClima.T_agua_fria;
    const E_nec_Wh = V_diario_L * CONSTANTS.densidade_agua * CONSTANTS.calor_especifico_agua * Delta_T;
    const E_nec_kWh = E_nec_Wh / 1000.0;

    // 4.2. DIMENSIONAMENTO DO ACUMULADOR (BOILER)
    const V_boiler_L = V_diario_L * dadosConsumo.fator_autonomia;

    // 4.3. CÁLCULO DA EFICIÊNCIA DO COLETOR (η_col)
    const T_media_fluido = dadosClima.T_agua_fria + (Delta_T / 2.0);
    const Parametro_Perda_P = (T_media_fluido - dadosClima.T_ambiente_inverno) / CONSTANTS.irradiacao_horaria_pico_media;
    const eficiencia_coletor = dadosColetor.eficiencia_optica - (dadosColetor.coef_perda_linear * Parametro_Perda_P);
    // Garantir que a eficiência não seja negativa
    const eficiencia_coletor_final = Math.max(0, eficiencia_coletor);

    // 4.4. CÁLCULO DE AQUECIMENTO DA CASA
    const resultadoCasa = calcularAquecimentoCasa(areaCasa, alturaCasa, classeEnergetica, T_ambiente_inverno);
    
    // 4.5. DEMANDA TOTAL (ÁGUA + CASA)
    const demandaTotal_kWh = E_nec_kWh + resultadoCasa.demandaCasa_kWh;
    
    // 4.6. DIMENSIONAMENTO DA ÁREA DO COLETOR (A_col) - baseado na demanda total
    const A_col_m2 = demandaTotal_kWh / (dadosClima.H_g_diaria * eficiencia_coletor_final);
    const N_paineis = A_col_m2 / dadosColetor.area_painel;
    const N_paineis_final = Math.ceil(N_paineis); // Arredondar para cima

    return {
        demandaEnergia_kWh: E_nec_kWh, // Demanda apenas para água
        demandaCasa_kWh: resultadoCasa.demandaCasa_kWh, // Demanda apenas para casa
        demandaTotal_kWh: demandaTotal_kWh, // Demanda total (água + casa)
        volumeBoiler_L: V_boiler_L,
        consumoDiario_L: V_diario_L,
        eficienciaColetor: eficiencia_coletor_final * 100, // Em percentual
        areaColetor_m2: A_col_m2,
        numeroPaineis: N_paineis_final,
        areaPainel_m2: dadosColetor.area_painel,
        T_agua_fria: T_agua_fria, // Temperatura da água fria calculada
        T_ambiente_inverno: T_ambiente_inverno, // Temperatura ambiente de inverno calculada
        volumeCasa_m3: resultadoCasa.volumeCasa_m3,
        potenciaCasa_W: resultadoCasa.potenciaNecessaria_W
    };
}

/**
 * Atualiza os limites do slider de latitude baseado no idioma
 */
function atualizarLimitesLatitude() {
    const sliderLatitude = document.getElementById('sliderLatitude');
    const inputLatitude = document.getElementById('inputLatitude');
    
    if (!sliderLatitude) return;
    
    const valorAtual = parseFloat(sliderLatitude.value);
    
    if (idiomaAtual === 'it-IT') {
        // Itália: latitudes de 36°N a 47°N
        sliderLatitude.min = '36';
        sliderLatitude.max = '47';
        sliderLatitude.step = '0.5';
        // Valor padrão para Itália (Roma ≈ 41.9°N)
        if (valorAtual < 36 || valorAtual > 47 || valorAtual < 0) {
            sliderLatitude.value = '41.9';
            if (inputLatitude) inputLatitude.value = formatarDecimal(41.9, 1);
        }
    } else {
        // Brasil: latitudes de -35°S a -5°S
        sliderLatitude.min = '-35';
        sliderLatitude.max = '-5';
        sliderLatitude.step = '0.5';
        // Valor padrão para Brasil (São Paulo ≈ -23.5°S)
        if (valorAtual > -5 || valorAtual < -35 || valorAtual > 0) {
            sliderLatitude.value = '-23.5';
            if (inputLatitude) inputLatitude.value = formatarDecimal(-23.5, 1);
        }
    }
}

/**
 * Atualiza os resultados na interface
 */
function atualizarResultados() {
    // Obtém valores dos inputs ou sliders
    const inputPessoas = document.getElementById('inputPessoas');
    const inputLatitude = document.getElementById('inputLatitude');
    const inputAltitude = document.getElementById('inputAltitude');
    
    const sliderPessoas = document.getElementById('sliderPessoas');
    const sliderLatitude = document.getElementById('sliderLatitude');
    const sliderAltitude = document.getElementById('sliderAltitude');
    
    // Lê valores dos inputs ou sliders (inputs têm prioridade se válidos)
    let numeroPessoas = parseInt(sliderPessoas.value);
    if (inputPessoas && inputPessoas.value) {
        const valorConvertido = parseInt(inputPessoas.value);
        if (!isNaN(valorConvertido) && valorConvertido > 0) {
            numeroPessoas = valorConvertido;
        }
    }
    
    let latitude = parseFloat(sliderLatitude.value);
    if (inputLatitude && inputLatitude.value) {
        const valorConvertido = converterParaNumero(inputLatitude.value);
        if (!isNaN(valorConvertido)) {
            latitude = valorConvertido;
        }
    }
    
    let altitude = parseFloat(sliderAltitude.value);
    if (inputAltitude && inputAltitude.value) {
        const valorConvertido = parseFloat(inputAltitude.value);
        if (!isNaN(valorConvertido) && valorConvertido >= 0) {
            altitude = valorConvertido;
        }
    }
    
    let areaCasa = 100; // Valor padrão
    if (sliderAreaCasa) {
        areaCasa = parseFloat(sliderAreaCasa.value);
    }
    if (inputAreaCasa && inputAreaCasa.value) {
        const valorConvertido = parseFloat(inputAreaCasa.value);
        if (!isNaN(valorConvertido) && valorConvertido > 0) {
            areaCasa = valorConvertido;
        }
    }
    
    let alturaCasa = 2.7; // Valor padrão
    if (sliderAlturaCasa) {
        alturaCasa = parseFloat(sliderAlturaCasa.value);
    }
    if (inputAlturaCasa && inputAlturaCasa.value) {
        const valorConvertido = converterParaNumero(inputAlturaCasa.value);
        if (!isNaN(valorConvertido) && valorConvertido > 0) {
            alturaCasa = valorConvertido;
        }
    }
    
    // Obtém valores dos radio buttons
    const tipoUso = document.querySelector('input[name="tipoUso"]:checked')?.value || 'Padrao';
    const classeEnergetica = document.querySelector('input[name="classeEnergetica"]:checked')?.value || 'D';
    // Modelo B é sempre usado (único modelo de referência)
    const modeloColetor = 'Modelo_B';
    
    // Calcula o dimensionamento
    const resultado = calcularDimensionamento(numeroPessoas, tipoUso, latitude, altitude, modeloColetor, areaCasa, alturaCasa, classeEnergetica);
    
    // Atualiza os displays
    const textos = traducoes[idiomaAtual] || traducoes['pt-BR'];
    const textoPainel = resultado.numeroPaineis === 1 ? (textos['unit-painel-singular'] || 'painel') : (textos['unit-painel-plural'] || 'paineis');
    
    document.getElementById('areaColetor').textContent = formatarDecimal(resultado.areaColetor_m2, 2) + ' m²';
    document.getElementById('numeroPaineis').textContent = resultado.numeroPaineis + ' ' + textoPainel;
    document.getElementById('demandaEnergia').textContent = formatarDecimal(resultado.demandaEnergia_kWh, 2) + ' kWh/dia';
    document.getElementById('demandaCasa').textContent = formatarDecimal(resultado.demandaCasa_kWh, 2) + ' kWh/dia';
    document.getElementById('demandaTotal').textContent = formatarDecimal(resultado.demandaTotal_kWh, 2) + ' kWh/dia';
    document.getElementById('volumeBoiler').textContent = formatarNumero(Math.round(resultado.volumeBoiler_L)) + ' L';
    document.getElementById('eficienciaColetor').textContent = formatarDecimal(resultado.eficienciaColetor, 1) + '%';
    document.getElementById('consumoDiario').textContent = formatarNumero(Math.round(resultado.consumoDiario_L)) + ' L/dia';
    document.getElementById('tempAguaFria').textContent = formatarDecimal(resultado.T_agua_fria, 1) + ' °C';
    document.getElementById('volumeCasa').textContent = formatarDecimal(resultado.volumeCasa_m3, 1) + ' m³';
    document.getElementById('potenciaCasa').textContent = formatarNumero(Math.round(resultado.potenciaCasa_W)) + ' W';
}

// ============================================
// DICIONÁRIO DE TRADUÇÕES
// ============================================
const traducoes = {
    'pt-BR': {
        'app-title': '☀️ Dimensionador de Aquecedor Solar Térmico',
        'app-subtitle': 'Cálculo para Sistema Termossifão com Tubos a Vácuo',
        'label-pessoas': 'Número de Pessoas',
        'label-tipo-uso': 'Padrão de Consumo',
        'label-latitude': 'Latitude',
        'label-altitude': 'Altitude',
        'label-modelo-coletor': 'Modelo de Coletor',
        'secao-aquecimento-casa': '🏠 Aquecimento da Casa',
        'label-area-casa': 'Área da Casa',
        'label-altura-casa': 'Altura do Pé Direito',
        'label-classe-energetica': 'Classe Energética',
        'dica-altura-casa': '💡 Altura padrão residencial: 2,7m',
        'dica-classe-energetica': '💡 A = melhor isolamento | G = pior isolamento',
        'unit-people': 'pessoas',
        'unit-degrees': '°',
        'unit-meter': 'm',
        'unit-painel-singular': 'painel',
        'unit-painel-plural': 'paineis',
        'opt-economico': 'Econômico',
        'opt-padrao': 'Padrão',
        'opt-alto': 'Alto',
        'opt-modelo-a': 'Modelo A',
        'opt-modelo-b': 'Modelo B',
        'opt-modelo-c': 'Modelo C',
        'detalhe-modelo-a': '20 tubos, 1,8 m²',
        'detalhe-modelo-b': '15 tubos, 1,5 m²',
        'detalhe-modelo-c': '25 tubos, 2,2 m²',
        'detalhe-tubos': 'Tubos:',
        'detalhe-area': 'Área:',
        'detalhe-eficiencia': 'Eficiência:',
        'detalhe-perda': 'Perda Linear:',
        'dica-tipo-uso': '💡 Econômico: 30L/pessoa/dia | Padrão: 40L/pessoa/dia | Alto: 60L/pessoa/dia',
        'dica-latitude': '💡 Exemplo: São Paulo ≈ -23,5° | Rio de Janeiro ≈ -22,9° | Porto Alegre ≈ -30,0°',
        'dica-latitude-italia': '💡 Esempio: Roma ≈ 41,9° | Milano ≈ 45,5° | Napoli ≈ 40,8°',
        'dica-altitude': '💡 Altitude do local de instalação em metros acima do nível do mar',
        'resultados-title': '📊 Resultados do Dimensionamento',
        'resultado-area-coletor': 'Área de Coletores:',
        'resultado-paineis': 'Número de Painéis:',
        'resultado-demanda': 'Demanda de Energia:',
        'resultado-demanda-total': 'Demanda Total (Água + Casa):',
        'resultado-demanda-agua': 'Demanda Água (Banho/Pias):',
        'resultado-demanda-casa': 'Demanda Aquecimento Casa:',
        'resultado-volume-boiler': 'Volume do Boiler:',
        'resultado-volume-casa': 'Volume da Casa:',
        'resultado-potencia-casa': 'Potência Necessária Casa:',
        'resultado-eficiencia': 'Eficiência do Coletor:',
        'resultado-consumo-diario': 'Consumo Diário:',
        'resultado-temp-agua-fria': 'Temp. Água Fria (ajustada):',
        'info-recomendacoes': '💡 Recomendações de Instalação:',
        'rec-altura': 'O fundo do boiler deve estar a pelo menos 0,20 m acima do topo dos coletores',
        'rec-orientacao': 'Orientar coletores para o Norte geográfico (azimute 0°)',
        'rec-orientacao-italia': 'Orientare i collettori verso il Sud geografico (azimut 180°)',
        'rec-inclinacao': 'Inclinação recomendada: Latitude + 10° a 15°',
        'rec-inclinacao-italia': 'Inclinazione raccomandata: |Latitude| + 10° a 15°',
        'rec-tubulacao': 'Usar tubulação curta (máx. 8-10 m) e diâmetro de 25mm (1")',
        'footer': 'Dimensionador de Aquecedor Solar - Engenharia Nata © 2025',
        'aria-home': 'Voltar para a tela inicial'
    },
    'it-IT': {
        'app-title': '☀️ Dimensionatore Riscaldatore Solare Termico',
        'app-subtitle': 'Calcolo per Sistema Termosifone con Tubi Sottovuoto',
        'label-pessoas': 'Numero di Persone',
        'label-tipo-uso': 'Standard di Consumo',
        'label-latitude': 'Latitudine',
        'label-altitude': 'Altitudine',
        'label-modelo-coletor': 'Modello Collettore',
        'secao-aquecimento-casa': '🏠 Riscaldamento Casa',
        'label-area-casa': 'Area Casa',
        'label-altura-casa': 'Altezza Soffitto',
        'label-classe-energetica': 'Classe Energetica',
        'dica-altura-casa': '💡 Altezza standard residenziale: 2,7m',
        'dica-classe-energetica': '💡 A = migliore isolamento | G = peggiore isolamento',
        'unit-people': 'persone',
        'unit-degrees': '°',
        'unit-meter': 'm',
        'unit-painel-singular': 'pannello',
        'unit-painel-plural': 'pannelli',
        'opt-economico': 'Economico',
        'opt-padrao': 'Standard',
        'opt-alto': 'Alto',
        'opt-modelo-a': 'Modello A',
        'opt-modelo-b': 'Modello B',
        'opt-modelo-c': 'Modello C',
        'detalhe-modelo-a': '20 tubi, 1,8 m²',
        'detalhe-modelo-b': '15 tubi, 1,5 m²',
        'detalhe-modelo-c': '25 tubi, 2,2 m²',
        'detalhe-tubos': 'Tubi:',
        'detalhe-area': 'Area:',
        'detalhe-eficiencia': 'Efficienza:',
        'detalhe-perda': 'Perdita Lineare:',
        'dica-tipo-uso': '💡 Economico: 30L/persona/giorno | Standard: 40L/persona/giorno | Alto: 60L/persona/giorno',
        'dica-latitude': '💡 Esempio: San Paolo ≈ -23,5° | Rio de Janeiro ≈ -22,9° | Porto Alegre ≈ -30,0°',
        'dica-latitude-italia': '💡 Esempio: Roma ≈ 41,9° | Milano ≈ 45,5° | Napoli ≈ 40,8°',
        'dica-altitude': '💡 Altitudine del luogo di installazione in metri sopra il livello del mare',
        'resultados-title': '📊 Risultati del Dimensionamento',
        'resultado-area-coletor': 'Area Collettori:',
        'resultado-paineis': 'Numero Pannelli:',
        'resultado-demanda': 'Domanda di Energia:',
        'resultado-demanda-total': 'Domanda Totale (Acqua + Casa):',
        'resultado-demanda-agua': 'Domanda Acqua (Bagno/Lavandini):',
        'resultado-demanda-casa': 'Domanda Riscaldamento Casa:',
        'resultado-volume-boiler': 'Volume Boiler:',
        'resultado-volume-casa': 'Volume Casa:',
        'resultado-potencia-casa': 'Potenza Necessaria Casa:',
        'resultado-eficiencia': 'Efficienza Collettore:',
        'resultado-consumo-diario': 'Consumo Giornaliero:',
        'resultado-temp-agua-fria': 'Temp. Acqua Fredda (regolata):',
        'info-recomendacoes': '💡 Raccomandazioni di Installazione:',
        'rec-altura': 'Il fondo del boiler deve essere almeno 0,20 m sopra la parte superiore dei collettori',
        'rec-orientacao': 'Orientare i collettori verso il Nord geografico (azimut 0°)',
        'rec-orientacao-italia': 'Orientare i collettori verso il Sud geografico (azimut 180°)',
        'rec-inclinacao': 'Inclinazione raccomandata: Latitudine + 10° a 15°',
        'rec-inclinacao-italia': 'Inclinazione raccomandata: |Latitudine| + 10° a 15°',
        'rec-tubulacao': 'Usare tubazione corta (max. 8-10 m) e diametro di 25mm (1")',
        'footer': 'Dimensionatore Riscaldatore Solare - Engenharia Nata © 2025',
        'aria-home': 'Torna alla schermata iniziale'
    }
};

// ============================================
// FUNÇÃO DE TRADUÇÃO
// ============================================
function traduzir() {
    const textos = traducoes[idiomaAtual] || traducoes['pt-BR'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const chave = el.getAttribute('data-i18n');
        if (textos[chave]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                // Não traduzir valores de inputs
            } else {
                el.textContent = textos[chave];
            }
        }
    });
    
    // Atualizar dica de latitude baseado no idioma
    const dicaLatitude = document.querySelector('[data-i18n="dica-latitude"]');
    if (dicaLatitude) {
        if (idiomaAtual === 'it-IT') {
            dicaLatitude.textContent = textos['dica-latitude-italia'] || textos['dica-latitude'];
        } else {
            dicaLatitude.textContent = textos['dica-latitude'];
        }
    }
    
    // Atualizar recomendações de orientação e inclinação baseado no idioma
    const recOrientacao = document.querySelector('[data-i18n="rec-orientacao"]');
    if (recOrientacao) {
        if (idiomaAtual === 'it-IT') {
            recOrientacao.textContent = textos['rec-orientacao-italia'] || textos['rec-orientacao'];
        } else {
            recOrientacao.textContent = textos['rec-orientacao'];
        }
    }
    
    const recInclinacao = document.querySelector('[data-i18n="rec-inclinacao"]');
    if (recInclinacao) {
        if (idiomaAtual === 'it-IT') {
            recInclinacao.textContent = textos['rec-inclinacao-italia'] || textos['rec-inclinacao'];
        } else {
            recInclinacao.textContent = textos['rec-inclinacao'];
        }
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Configurar seletor de idioma
    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(btn => {
        btn.addEventListener('click', () => {
            const novoIdioma = btn.getAttribute('data-lang');
            idiomaAtual = novoIdioma;
            localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
            atualizarLimitesLatitude();
            traduzir();
            atualizarResultados();
        });
    });

    // Aplicar idioma salvo e atualizar limites
    atualizarLimitesLatitude();
    traduzir();

    // Configurar sliders e inputs
    const sliderPessoas = document.getElementById('sliderPessoas');
    const sliderLatitude = document.getElementById('sliderLatitude');
    const sliderAltitude = document.getElementById('sliderAltitude');
    const sliderAreaCasa = document.getElementById('sliderAreaCasa');
    const sliderAlturaCasa = document.getElementById('sliderAlturaCasa');
    
    sliderPessoas.addEventListener('input', () => {
        const valor = parseInt(sliderPessoas.value);
        const inputPessoas = document.getElementById('inputPessoas');
        if (inputPessoas) inputPessoas.value = valor;
        atualizarResultados();
    });
    
    sliderLatitude.addEventListener('input', () => {
        const valor = parseFloat(sliderLatitude.value);
        const inputLatitude = document.getElementById('inputLatitude');
        if (inputLatitude) {
            // Formata com vírgula usando formatarDecimal
            inputLatitude.value = formatarDecimal(valor, 1);
        }
        atualizarResultados();
    });
    
    sliderAltitude.addEventListener('input', () => {
        const valor = parseFloat(sliderAltitude.value);
        const inputAltitude = document.getElementById('inputAltitude');
        if (inputAltitude) inputAltitude.value = Math.round(valor);
        atualizarResultados();
    });
    
    sliderAreaCasa.addEventListener('input', () => {
        const valor = parseFloat(sliderAreaCasa.value);
        const inputAreaCasa = document.getElementById('inputAreaCasa');
        if (inputAreaCasa) inputAreaCasa.value = Math.round(valor);
        atualizarResultados();
    });
    
    sliderAlturaCasa.addEventListener('input', () => {
        const valor = parseFloat(sliderAlturaCasa.value);
        const inputAlturaCasa = document.getElementById('inputAlturaCasa');
        if (inputAlturaCasa) {
            // Formata com vírgula usando formatarDecimal
            inputAlturaCasa.value = formatarDecimal(valor, 1);
        }
        atualizarResultados();
    });
    
    // Configurar inputs editáveis
    const inputPessoas = document.getElementById('inputPessoas');
    const inputLatitude = document.getElementById('inputLatitude');
    const inputAltitude = document.getElementById('inputAltitude');
    const inputAreaCasa = document.getElementById('inputAreaCasa');
    const inputAlturaCasa = document.getElementById('inputAlturaCasa');
    
    if (inputPessoas) {
        inputPessoas.addEventListener('focus', (e) => e.target.select());
        inputPessoas.addEventListener('input', () => {
            const valor = parseInt(inputPessoas.value);
            if (!isNaN(valor) && valor > 0) {
                const slider = document.getElementById('sliderPessoas');
                if (valor >= parseInt(slider.min) && valor <= parseInt(slider.max)) {
                    slider.value = valor;
                }
                atualizarResultados();
            }
        });
    }
    
    if (inputLatitude) {
        inputLatitude.addEventListener('focus', (e) => e.target.select());
        inputLatitude.addEventListener('input', () => {
            // Aceita tanto ponto quanto vírgula
            const valor = converterParaNumero(inputLatitude.value);
            if (!isNaN(valor)) {
                const slider = document.getElementById('sliderLatitude');
                if (valor >= parseFloat(slider.min) && valor <= parseFloat(slider.max)) {
                    slider.value = valor;
                }
                // Sempre exibe com vírgula
                inputLatitude.value = formatarDecimal(valor, 1);
                atualizarResultados();
            }
        });
        // Ao perder o foco, garante formatação correta
        inputLatitude.addEventListener('blur', () => {
            const valor = converterParaNumero(inputLatitude.value);
            if (!isNaN(valor)) {
                inputLatitude.value = formatarDecimal(valor, 1);
            }
        });
    }
    
    if (inputAltitude) {
        inputAltitude.addEventListener('focus', (e) => e.target.select());
        inputAltitude.addEventListener('input', () => {
            const valor = parseInt(inputAltitude.value);
            if (!isNaN(valor) && valor >= 0) {
                const slider = document.getElementById('sliderAltitude');
                if (valor >= parseInt(slider.min) && valor <= parseInt(slider.max)) {
                    slider.value = valor;
                }
                atualizarResultados();
            }
        });
    }
    
    if (inputAreaCasa) {
        inputAreaCasa.addEventListener('focus', (e) => e.target.select());
        inputAreaCasa.addEventListener('input', () => {
            const valor = parseFloat(inputAreaCasa.value);
            if (!isNaN(valor) && valor > 0) {
                const slider = document.getElementById('sliderAreaCasa');
                if (valor >= parseFloat(slider.min) && valor <= parseFloat(slider.max)) {
                    slider.value = valor;
                }
                atualizarResultados();
            }
        });
    }
    
    if (inputAlturaCasa) {
        inputAlturaCasa.addEventListener('focus', (e) => e.target.select());
        inputAlturaCasa.addEventListener('input', () => {
            // Aceita tanto ponto quanto vírgula
            const valor = converterParaNumero(inputAlturaCasa.value);
            if (!isNaN(valor) && valor > 0) {
                const slider = document.getElementById('sliderAlturaCasa');
                if (valor >= parseFloat(slider.min) && valor <= parseFloat(slider.max)) {
                    slider.value = valor;
                }
                // Sempre exibe com vírgula
                inputAlturaCasa.value = formatarDecimal(valor, 1);
                atualizarResultados();
            }
        });
        // Ao perder o foco, garante formatação correta
        inputAlturaCasa.addEventListener('blur', () => {
            const valor = converterParaNumero(inputAlturaCasa.value);
            if (!isNaN(valor) && valor > 0) {
                inputAlturaCasa.value = formatarDecimal(valor, 1);
            }
        });
    }
    
    // Configurar radio buttons
    document.querySelectorAll('input[name="tipoUso"]').forEach(radio => {
        radio.addEventListener('change', atualizarResultados);
    });
    
    document.querySelectorAll('input[name="classeEnergetica"]').forEach(radio => {
        radio.addEventListener('change', atualizarResultados);
    });
    
    // Modelo B é fixo (único modelo de referência), não precisa de listener
    
    // Configurar botões de seta
    document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        const step = parseFloat(btn.getAttribute('data-step'));
        
        const startRepeating = () => {
            ajustarValor(targetId, step);
            const intervalId = setInterval(() => {
                ajustarValor(targetId, step);
            }, 100);
            btn.dataset.intervalId = intervalId;
        };
        
        const stopRepeating = () => {
            if (btn.dataset.intervalId) {
                clearInterval(btn.dataset.intervalId);
                delete btn.dataset.intervalId;
            }
        };
        
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startRepeating();
        });
        btn.addEventListener('mouseup', stopRepeating);
        btn.addEventListener('mouseleave', stopRepeating);
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startRepeating();
        });
        btn.addEventListener('touchend', stopRepeating);
        btn.addEventListener('touchcancel', stopRepeating);
    });
    
    // Função auxiliar para ajustar valor do slider
    function ajustarValor(targetId, step) {
        const slider = document.getElementById(targetId);
        if (!slider) return;
        
        const currentValue = parseFloat(slider.value);
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const newValue = Math.max(min, Math.min(max, currentValue + step));
        
        slider.value = newValue;
        slider.dispatchEvent(new Event('input'));
    }
    
    // Formatar valor inicial da latitude com vírgula
    const inputLatitudeInicial = document.getElementById('inputLatitude');
    if (inputLatitudeInicial) {
        const valorInicial = converterParaNumero(inputLatitudeInicial.value);
        if (!isNaN(valorInicial)) {
            inputLatitudeInicial.value = formatarDecimal(valorInicial, 1);
        }
    }
    
    // Calcular resultados iniciais
    atualizarResultados();
});

