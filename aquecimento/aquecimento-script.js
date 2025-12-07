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

// Consumo específico por classe energética (kWh/m²·ano)
// Valores baseados nas normas europeias de eficiência energética
// Usando valores médios de cada faixa
const CONSUMO_ESPECIFICO_CLASSE = {
    "A4": 0.35,  // ≤ 0,40 kWh/m²·ano (média: 0,35)
    "A3": 0.50,  // 0,40 < Consumo ≤ 0,60 kWh/m²·ano (média: 0,50)
    "A2": 0.70,  // 0,60 < Consumo ≤ 0,80 kWh/m²·ano (média: 0,70)
    "A1": 0.90,  // 0,80 < Consumo ≤ 1,00 kWh/m²·ano (média: 0,90)
    "B": 1.10,   // 1,00 < Consumo ≤ 1,20 kWh/m²·ano (média: 1,10)
    "C": 1.35,   // 1,20 < Consumo ≤ 1,50 kWh/m²·ano (média: 1,35)
    "D": 1.75,   // 1,50 < Consumo ≤ 2,00 kWh/m²·ano (média: 1,75)
    "E": 2.30,   // 2,00 < Consumo ≤ 2,60 kWh/m²·ano (média: 2,30)
    "F": 3.05,   // 2,60 < Consumo ≤ 3,50 kWh/m²·ano (média: 3,05)
    "G": 4.0     // > 3,50 kWh/m²·ano (usando 4,0 como referência)
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
    
    // Obter consumo específico da classe energética (kWh/m²·ano)
    // Nota: Os valores de consumo específico são baseados em altura padrão de ~2,7m
    // IMPORTANTE: Este valor representa o consumo TOTAL de energia da casa (aquecimento + outros usos)
    // Para aquecimento, assumimos que representa aproximadamente 60-70% do consumo total em climas frios
    const consumoEspecifico = CONSUMO_ESPECIFICO_CLASSE[classeEnergetica] || CONSUMO_ESPECIFICO_CLASSE["D"];
    
    // Fator de ajuste para altura do pé direito
    // Altura padrão de referência: 2,7m
    // Para cada 0,1m acima de 2,7m, aumenta 10% no consumo
    const alturaPadrao = 2.7; // metros
    let fatorAltura = 1.0;
    if (alturaCasa > alturaPadrao) {
        const diferencaAltura = alturaCasa - alturaPadrao;
        // Aumento de 10% para cada 0,1m acima do padrão
        fatorAltura = 1.0 + (diferencaAltura / 0.1) * 0.1;
    }
    
    // Calcular consumo anual TOTAL baseado na área, ajustado pela altura (kWh/ano)
    const consumoAnualTotal_kWh = consumoEspecifico * areaCasa * fatorAltura;
    
    // Fator de fração para aquecimento (60-70% do consumo total em climas frios)
    // Em climas mais frios, a fração de aquecimento é maior
    const fracaoAquecimento = T_ambiente_inverno < 10 ? 0.70 : 0.60; // 70% se muito frio, 60% caso contrário
    const consumoAnualAquecimento_kWh = consumoAnualTotal_kWh * fracaoAquecimento;
    
    // O consumo anual de aquecimento é concentrado principalmente nos meses de inverno
    // Assumindo que o aquecimento é necessário por aproximadamente 5 meses (150 dias)
    const diasPeriodoAquecimento = 150; // dias de aquecimento por ano (aproximadamente 5 meses)
    
    // Calcular demanda diária média no período de aquecimento
    const demandaCasa_kWh = consumoAnualAquecimento_kWh / diasPeriodoAquecimento;
    
    // Calcular demanda noturna (aproximadamente 60% da demanda diária ocorre à noite)
    // Durante a noite, não há sol, então toda a energia precisa vir do armazenamento
    const fracaoNoite = 0.6; // 60% da demanda ocorre durante a noite (16 horas)
    const demandaCasa_noite_kWh = demandaCasa_kWh * fracaoNoite;
    
    // Calcular potência necessária baseada na demanda diária
    // A potência necessária deve considerar que o sistema precisa fornecer energia suficiente
    // para manter a temperatura durante o período de maior demanda (noite)
    // Usamos a demanda noturna dividida pelas horas noturnas (16 horas) como referência
    const horasNoite = 16; // horas noturnas (sem sol)
    const potenciaNecessaria_W = (demandaCasa_noite_kWh * 1000) / horasNoite;
    
    return {
        volumeCasa_m3: volumeCasa,
        potenciaNecessaria_W: potenciaNecessaria_W,
        demandaCasa_kWh: demandaCasa_kWh,
        demandaCasa_noite_kWh: demandaCasa_noite_kWh,
        Delta_T_casa: Delta_T_casa,
        consumoEspecifico_kWh_m2_ano: consumoEspecifico,
        consumoAnualTotal_kWh: consumoAnualTotal_kWh,
        consumoAnualAquecimento_kWh: consumoAnualAquecimento_kWh,
        fatorAltura: fatorAltura,
        fracaoAquecimento: fracaoAquecimento
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
 * @param {number} diasAutonomia - Dias de autonomia para aquecimento da casa
 * @param {boolean} incluirAgua - Se deve incluir sistema de água
 * @param {boolean} incluirCasa - Se deve incluir sistema de aquecimento da casa
 * @returns {Object} Objeto com todos os valores calculados
 */
function calcularDimensionamento(numeroPessoas, tipoUso, latitude, altitude, modeloColetor, areaCasa, alturaCasa, classeEnergetica, diasAutonomia, incluirAgua, incluirCasa) {
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

    // 4.1. CÁLCULO DA DEMANDA DE ENERGIA TÉRMICA PARA ÁGUA (E_nec)
    let E_nec_kWh = 0;
    let V_diario_L = 0;
    let V_boiler_agua_L = 0;
    let T_media_fluido = dadosClima.T_agua_fria;
    
    if (incluirAgua) {
        V_diario_L = numeroPessoas * dadosConsumo.consumo_por_pessoa;
        const Delta_T = dadosConsumo.T_desejada - dadosClima.T_agua_fria;
        const E_nec_Wh = V_diario_L * CONSTANTS.densidade_agua * CONSTANTS.calor_especifico_agua * Delta_T;
        E_nec_kWh = E_nec_Wh / 1000.0;

        // 4.2. DIMENSIONAMENTO DO ACUMULADOR PARA ÁGUA (BOILER)
        // Volume do boiler considera os dias de autonomia (dias sem sol)
        // Multiplica o consumo diário pelos dias de autonomia
        V_boiler_agua_L = V_diario_L * diasAutonomia;
        
        // Calcular temperatura média do fluido para eficiência
        T_media_fluido = dadosClima.T_agua_fria + (Delta_T / 2.0);
    }

    // 4.3. CÁLCULO DA EFICIÊNCIA DO COLETOR (η_col)
    // Se não há água, usar temperatura ambiente como referência
    const Parametro_Perda_P = (T_media_fluido - dadosClima.T_ambiente_inverno) / CONSTANTS.irradiacao_horaria_pico_media;
    const eficiencia_coletor = dadosColetor.eficiencia_optica - (dadosColetor.coef_perda_linear * Parametro_Perda_P);
    // Garantir que a eficiência não seja negativa
    const eficiencia_coletor_final = Math.max(0, eficiencia_coletor);

    // 4.4. CÁLCULO DE AQUECIMENTO DA CASA
    let resultadoCasa = {
        volumeCasa_m3: 0,
        potenciaNecessaria_W: 0,
        demandaCasa_kWh: 0,
        demandaCasa_noite_kWh: 0, // Energia necessária durante a noite
        Delta_T_casa: 0
    };
    
    if (incluirCasa) {
        resultadoCasa = calcularAquecimentoCasa(areaCasa, alturaCasa, classeEnergetica, T_ambiente_inverno);
    }
    
    // 4.5. DEMANDA TOTAL (ÁGUA + CASA, conforme selecionado)
    const demandaTotal_kWh = E_nec_kWh + resultadoCasa.demandaCasa_kWh;
    
    // 4.6. DIMENSIONAMENTO DA ÁREA DO COLETOR (A_col)
    // IMPORTANTE: A lógica é diferente para água e casa:
    // - ÁGUA: Pode ser aquecida ao longo do dia, não precisa de fator temporal restritivo
    // - CASA: Precisa captar toda a energia durante o dia para usar à noite (fator temporal crítico)
    
    const horasSolEfetivo = 6.5; // horas de sol efetivo por dia no inverno
    const fatorSeguranca = 1.3; // Fator de segurança para dias nublados e perdas
    
    // Calcular área necessária para cada sistema separadamente
    let areaAgua_m2 = 0;
    let areaCasa_m2 = 0;
    
    // ÁREA PARA ÁGUA: Usa irradiação diária total (água pode ser aquecida ao longo do dia)
    if (incluirAgua && E_nec_kWh > 0) {
        // Para água, consideramos que pode ser aquecida ao longo do dia
        // Aplicamos apenas fator de segurança
        areaAgua_m2 = (E_nec_kWh * fatorSeguranca) / (dadosClima.H_g_diaria * eficiencia_coletor_final);
    }
    
    // ÁREA PARA CASA: Precisa captar toda energia durante o dia (fator temporal crítico)
    if (incluirCasa && resultadoCasa.demandaCasa_kWh > 0) {
        // Para casa, toda energia precisa ser captada durante as horas de sol
        // Fator temporal = horas_sol / 24
        const fatorTemporal = horasSolEfetivo / 24.0;
        areaCasa_m2 = (resultadoCasa.demandaCasa_kWh * fatorSeguranca) / (dadosClima.H_g_diaria * eficiencia_coletor_final * fatorTemporal);
    }
    
    // Área total necessária
    const A_col_m2 = areaAgua_m2 + areaCasa_m2;
    
    // Garantir área mínima para evitar divisão por zero
    const areaMinima = 0.1; // m² mínimo
    const A_col_final = Math.max(A_col_m2, areaMinima);
    
    const N_paineis = A_col_final / dadosColetor.area_painel;
    const N_paineis_final = Math.max(1, Math.ceil(N_paineis)); // Mínimo de 1 painel
    
    // 4.7. DIMENSIONAMENTO DO VOLUME DO BOILER PARA AQUECIMENTO DA CASA
    // Se incluir aquecimento da casa, calcular volume adicional necessário
    // para armazenar energia térmica para uso durante períodos sem sol (autonomia)
    let V_boiler_casa_L = 0;
    if (incluirCasa && resultadoCasa.demandaCasa_kWh > 0) {
        // Calcular energia total necessária para os dias de autonomia
        // Considera a demanda diária total (não apenas noturna) multiplicada pelos dias de autonomia
        const demandaTotalAutonomia_kWh = resultadoCasa.demandaCasa_kWh * diasAutonomia;
        
        // Calcular volume de água necessário para armazenar essa energia
        // E = m × c × ΔT
        // m = E / (c × ΔT)
        // V = m / ρ (onde ρ = 1 kg/L para água)
        // Delta_T_armazenamento: diferença entre temperatura de armazenamento e temperatura mínima útil
        // Exemplo: armazenar a 60°C e usar até 20°C = 40°C de diferença
        const Delta_T_armazenamento = 40.0; // °C
        const E_autonomia_Wh = demandaTotalAutonomia_kWh * 1000.0;
        const massa_kg = E_autonomia_Wh / (CONSTANTS.calor_especifico_agua * Delta_T_armazenamento);
        V_boiler_casa_L = massa_kg / CONSTANTS.densidade_agua; // L
        
        // Adicionar fator de segurança de 20% para o volume de armazenamento
        V_boiler_casa_L = V_boiler_casa_L * 1.2;
    }
    
    // Volume total do boiler (água + casa)
    const V_boiler_L = V_boiler_agua_L + V_boiler_casa_L;

    return {
        demandaEnergia_kWh: E_nec_kWh, // Demanda apenas para água
        demandaCasa_kWh: resultadoCasa.demandaCasa_kWh, // Demanda apenas para casa
        demandaTotal_kWh: demandaTotal_kWh, // Demanda total (água + casa)
        volumeBoiler_L: V_boiler_L,
        consumoDiario_L: V_diario_L,
        eficienciaColetor: eficiencia_coletor_final * 100, // Em percentual
        areaColetor_m2: A_col_final,
        areaAgua_m2: areaAgua_m2,
        areaCasa_m2: areaCasa_m2,
        numeroPaineis: N_paineis_final,
        H_g_diaria: dadosClima.H_g_diaria,
        horasSolEfetivo: horasSolEfetivo,
        fatorSeguranca: fatorSeguranca,
        areaPainel_m2: dadosColetor.area_painel,
        T_agua_fria: T_agua_fria, // Temperatura da água fria calculada
        T_ambiente_inverno: T_ambiente_inverno, // Temperatura ambiente de inverno calculada
        volumeCasa_m3: resultadoCasa.volumeCasa_m3,
        potenciaCasa_W: resultadoCasa.potenciaNecessaria_W,
        volumeBoilerAgua_L: V_boiler_agua_L
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
    const inputAreaCasa = document.getElementById('inputAreaCasa');
    const inputAlturaCasa = document.getElementById('inputAlturaCasa');
    
    const sliderPessoas = document.getElementById('sliderPessoas');
    const sliderLatitude = document.getElementById('sliderLatitude');
    const sliderAltitude = document.getElementById('sliderAltitude');
    const sliderAreaCasa = document.getElementById('sliderAreaCasa');
    const sliderAlturaCasa = document.getElementById('sliderAlturaCasa');
    
    // Lê valores dos inputs ou sliders (inputs têm prioridade se válidos)
    let numeroPessoas = sliderPessoas ? parseInt(sliderPessoas.value) : 4;
    if (inputPessoas && inputPessoas.value) {
        const valorConvertido = parseInt(inputPessoas.value);
        if (!isNaN(valorConvertido) && valorConvertido > 0) {
            numeroPessoas = valorConvertido;
        }
    }
    
    let latitude = sliderLatitude ? parseFloat(sliderLatitude.value) : -23.5;
    if (inputLatitude && inputLatitude.value) {
        const valorConvertido = converterParaNumero(inputLatitude.value);
        if (!isNaN(valorConvertido)) {
            latitude = valorConvertido;
        }
    }
    
    let altitude = sliderAltitude ? parseFloat(sliderAltitude.value) : 800;
    if (inputAltitude && inputAltitude.value) {
        const valorConvertido = parseFloat(inputAltitude.value);
        if (!isNaN(valorConvertido) && valorConvertido >= 0) {
            altitude = valorConvertido;
        }
    }
    
    let areaCasa = 100; // Valor padrão
    if (sliderAreaCasa) {
        const valorSlider = parseFloat(sliderAreaCasa.value);
        if (!isNaN(valorSlider) && valorSlider > 0) {
            areaCasa = valorSlider;
        }
    }
    if (inputAreaCasa && inputAreaCasa.value) {
        const valorConvertido = parseFloat(inputAreaCasa.value);
        if (!isNaN(valorConvertido) && valorConvertido > 0) {
            areaCasa = valorConvertido;
        }
    }
    
    let alturaCasa = 2.7; // Valor padrão
    if (sliderAlturaCasa) {
        const valorSlider = parseFloat(sliderAlturaCasa.value);
        if (!isNaN(valorSlider) && valorSlider > 0) {
            alturaCasa = valorSlider;
        }
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
    
    // Obtém valores dos checkboxes de tipo de sistema
    const checkboxAgua = document.getElementById('checkboxAgua');
    const checkboxCasa = document.getElementById('checkboxCasa');
    const incluirAgua = checkboxAgua ? checkboxAgua.checked : false;
    const incluirCasa = checkboxCasa ? checkboxCasa.checked : false;
    
    // Obtém valor dos dias de autonomia
    let diasAutonomia = 3; // valor padrão
    if (sliderDiasAutonomia) {
        diasAutonomia = parseInt(sliderDiasAutonomia.value) || 3;
    }
    
    // Se nenhum estiver selecionado, não mostrar resultados
    if (!incluirAgua && !incluirCasa) {
        // Ocultar todos os resultados
        const secaoResultados = document.querySelector('.resultados');
        if (secaoResultados) {
            secaoResultados.style.display = 'none';
        }
        return;
    } else {
        // Mostrar seção de resultados se pelo menos um estiver selecionado
        const secaoResultados = document.querySelector('.resultados');
        if (secaoResultados) {
            secaoResultados.style.display = 'block';
        }
    }
    
    // Calcula o dimensionamento
    const resultado = calcularDimensionamento(numeroPessoas, tipoUso, latitude, altitude, modeloColetor, areaCasa, alturaCasa, classeEnergetica, diasAutonomia, incluirAgua, incluirCasa);
    
    // Atualiza os displays
    const textos = traducoes[idiomaAtual] || traducoes['pt-BR'];
    const textoPainel = resultado.numeroPaineis === 1 ? (textos['unit-painel-singular'] || 'painel') : (textos['unit-painel-plural'] || 'paineis');
    
    document.getElementById('areaColetor').textContent = formatarDecimal(resultado.areaColetor_m2, 2) + ' m²';
    document.getElementById('numeroPaineis').textContent = resultado.numeroPaineis + ' ' + textoPainel;
    
    // Mostrar/ocultar resultados baseado no tipo de sistema selecionado
    const resultadoAgua = document.getElementById('demandaEnergia').closest('.resultado-item');
    const resultadoCasa = document.getElementById('demandaCasa').closest('.resultado-item');
    const resultadoVolumeBoiler = document.getElementById('volumeBoiler').closest('.resultado-item');
    const resultadoConsumoDiario = document.getElementById('consumoDiario').closest('.resultado-item');
    const resultadoTempAgua = document.getElementById('tempAguaFria').closest('.resultado-item');
    const resultadoVolumeCasa = document.getElementById('volumeCasa').closest('.resultado-item');
    const resultadoPotenciaCasa = document.getElementById('potenciaCasa').closest('.resultado-item');
    
    if (resultadoAgua) resultadoAgua.style.display = incluirAgua ? 'flex' : 'none';
    if (resultadoCasa) resultadoCasa.style.display = incluirCasa ? 'flex' : 'none';
    if (resultadoVolumeBoiler) resultadoVolumeBoiler.style.display = incluirAgua ? 'flex' : 'none';
    if (resultadoConsumoDiario) resultadoConsumoDiario.style.display = incluirAgua ? 'flex' : 'none';
    if (resultadoTempAgua) resultadoTempAgua.style.display = incluirAgua ? 'flex' : 'none';
    if (resultadoVolumeCasa) resultadoVolumeCasa.style.display = incluirCasa ? 'flex' : 'none';
    if (resultadoPotenciaCasa) resultadoPotenciaCasa.style.display = incluirCasa ? 'flex' : 'none';
    
    document.getElementById('demandaEnergia').textContent = formatarDecimal(resultado.demandaEnergia_kWh, 2) + ' kWh/dia';
    document.getElementById('demandaCasa').textContent = formatarDecimal(resultado.demandaCasa_kWh, 2) + ' kWh/dia';
    document.getElementById('demandaTotal').textContent = formatarDecimal(resultado.demandaTotal_kWh, 2) + ' kWh/dia';
    document.getElementById('volumeBoiler').textContent = formatarNumero(Math.round(resultado.volumeBoiler_L)) + ' L';
    document.getElementById('eficienciaColetor').textContent = formatarDecimal(resultado.eficienciaColetor, 1) + '%';
    document.getElementById('consumoDiario').textContent = formatarNumero(Math.round(resultado.consumoDiario_L)) + ' L/dia';
    document.getElementById('tempAguaFria').textContent = formatarDecimal(resultado.T_agua_fria, 1) + ' °C';
    document.getElementById('volumeCasa').textContent = formatarDecimal(resultado.volumeCasa_m3, 1) + ' m³';
    document.getElementById('potenciaCasa').textContent = formatarNumero(Math.round(resultado.potenciaCasa_W)) + ' W';
    
    // Atualizar memorial de cálculo
    atualizarMemorial(resultado, numeroPessoas, tipoUso, latitude, altitude, areaCasa, alturaCasa, classeEnergetica, incluirAgua, incluirCasa);
}

// ============================================
// MEMORIAL DE CÁLCULO
// ============================================
function toggleMemorial() {
    const memorial = document.getElementById('memorial-calculo');
    const toggle = document.getElementById('memorial-toggle');
    if (memorial.style.display === 'none') {
        memorial.style.display = 'block';
        toggle.textContent = '▲';
    } else {
        memorial.style.display = 'none';
        toggle.textContent = '▼';
    }
}

function atualizarMemorial(resultado, numeroPessoas, tipoUso, latitude, altitude, areaCasa, alturaCasa, classeEnergetica, incluirAgua, incluirCasa) {
    const textos = traducoes[idiomaAtual] || traducoes['pt-BR'];
    const memorialDiv = document.getElementById('memorial-conteudo');
    
    if (!memorialDiv) return;
    
    let html = '<div style="font-size: 0.85rem; line-height: 1.6;">';
    
    // Dados de entrada
    html += '<h3 style="color: #2d9fa3ff; margin-top: 0; font-size: 1rem;">📥 Dados de Entrada</h3>';
    html += '<ul style="margin: 8px 0; padding-left: 20px;">';
    if (incluirAgua) {
        html += `<li>Número de pessoas: ${numeroPessoas}</li>`;
        html += `<li>Tipo de uso: ${tipoUso}</li>`;
    }
    html += `<li>Latitude: ${formatarDecimal(latitude, 1)}°</li>`;
    html += `<li>Altitude: ${formatarNumero(Math.round(altitude))} m</li>`;
    if (incluirCasa) {
        html += `<li>Área da casa: ${formatarDecimal(areaCasa, 1)} m²</li>`;
        html += `<li>Altura do pé direito: ${formatarDecimal(alturaCasa, 1)} m</li>`;
        html += `<li>Classe energética: ${classeEnergetica}</li>`;
    }
    if (incluirAgua || incluirCasa) {
        html += `<li>Dias de autonomia: ${diasAutonomia} dias</li>`;
    }
    html += '</ul>';
    
    // Constantes físicas
    html += '<h3 style="color: #2d9fa3ff; margin-top: 16px; font-size: 1rem;">⚙️ Constantes Físicas</h3>';
    html += '<ul style="margin: 8px 0; padding-left: 20px;">';
    html += `<li>Densidade da água: ${CONSTANTS.densidade_agua} kg/L</li>`;
    html += `<li>Calor específico da água: ${CONSTANTS.calor_especifico_agua} Wh/kg°C</li>`;
    html += `<li>Irradiação horária pico média: ${CONSTANTS.irradiacao_horaria_pico_media} W/m²</li>`;
    html += `<li>Irradiação solar diária (H_g): ${formatarDecimal(resultado.H_g_diaria, 2)} kWh/m²/dia</li>`;
    html += `<li>Horas de sol efetivo: ${resultado.horasSolEfetivo} h/dia</li>`;
    html += `<li>Fator de segurança: ${resultado.fatorSeguranca}</li>`;
    html += '</ul>';
    
    // Cálculo para água
    if (incluirAgua) {
        html += '<h3 style="color: #2d9fa3ff; margin-top: 16px; font-size: 1rem;">💧 Cálculo - Água de Consumo</h3>';
        const dadosConsumo = MATRIZ_CONSUMO[tipoUso] || MATRIZ_CONSUMO["Padrao"];
        const consumoPorPessoa = dadosConsumo.consumo_por_pessoa;
        const T_desejada = dadosConsumo.T_desejada;
        const V_diario = numeroPessoas * consumoPorPessoa;
        const Delta_T_agua = T_desejada - resultado.T_agua_fria;
        const E_nec_Wh = V_diario * CONSTANTS.densidade_agua * CONSTANTS.calor_especifico_agua * Delta_T_agua;
        const E_nec_kWh_calc = E_nec_Wh / 1000.0;
        
        html += '<ul style="margin: 8px 0; padding-left: 20px;">';
        html += `<li>Consumo diário: ${numeroPessoas} × ${consumoPorPessoa} L/pessoa = ${formatarDecimal(V_diario, 1)} L/dia</li>`;
        html += `<li>ΔT água: ${formatarDecimal(T_desejada, 1)}°C - ${formatarDecimal(resultado.T_agua_fria, 1)}°C = ${formatarDecimal(Delta_T_agua, 1)}°C</li>`;
        html += `<li>E_nec = ${formatarDecimal(V_diario, 1)} × ${CONSTANTS.densidade_agua} × ${CONSTANTS.calor_especifico_agua} × ${formatarDecimal(Delta_T_agua, 1)} = ${formatarDecimal(E_nec_kWh_calc, 2)} kWh/dia</li>`;
        html += `<li>Área coletor (água): A = (${formatarDecimal(E_nec_kWh_calc, 2)} × ${resultado.fatorSeguranca}) / (${formatarDecimal(resultado.H_g_diaria, 2)} × ${formatarDecimal(resultado.eficienciaColetor/100, 2)}) = ${formatarDecimal(resultado.areaAgua_m2, 2)} m²</li>`;
        html += `<li>Volume boiler (água): ${formatarDecimal(V_diario, 1)} L/dia × ${diasAutonomia} dias = ${formatarDecimal(resultado.volumeBoilerAgua_L, 1)} L</li>`;
        html += '</ul>';
    }
    
    // Cálculo para casa
    if (incluirCasa) {
        html += '<h3 style="color: #2d9fa3ff; margin-top: 16px; font-size: 1rem;">🏠 Cálculo - Aquecimento da Casa</h3>';
        const consumoEspecifico = CONSUMO_ESPECIFICO_CLASSE[classeEnergetica] || CONSUMO_ESPECIFICO_CLASSE["D"];
        const alturaPadrao = 2.7;
        let fatorAltura = 1.0;
        if (alturaCasa > alturaPadrao) {
            const diferencaAltura = alturaCasa - alturaPadrao;
            fatorAltura = 1.0 + (diferencaAltura / 0.1) * 0.1;
        }
        const consumoAnualTotal = consumoEspecifico * areaCasa * fatorAltura;
        const fracaoAquecimento = resultado.T_ambiente_inverno < 10 ? 0.70 : 0.60;
        const consumoAnualAquecimento = consumoAnualTotal * fracaoAquecimento;
        const diasAquecimento = 150;
        const demandaCasa = consumoAnualAquecimento / diasAquecimento;
        const fatorTemporal = resultado.horasSolEfetivo / 24.0;
        
        html += '<ul style="margin: 8px 0; padding-left: 20px;">';
        const labelClasseMemorial = classeEnergetica.startsWith('A') ? `A${classeEnergetica.slice(1)}` : classeEnergetica;
        html += `<li>Consumo específico (classe ${labelClasseMemorial}): ${formatarDecimal(consumoEspecifico, 2)} kWh/m²·ano</li>`;
        if (fatorAltura > 1.0) {
            html += `<li>Fator altura (${formatarDecimal(alturaCasa, 1)}m > ${alturaPadrao}m): ${formatarDecimal(fatorAltura, 2)}</li>`;
        }
        html += `<li>Consumo anual total: ${formatarDecimal(consumoEspecifico, 2)} × ${formatarDecimal(areaCasa, 1)} × ${formatarDecimal(fatorAltura, 2)} = ${formatarDecimal(consumoAnualTotal, 2)} kWh/ano</li>`;
        html += `<li>Fração para aquecimento (${(fracaoAquecimento * 100).toFixed(0)}%): ${formatarDecimal(consumoAnualTotal, 2)} × ${formatarDecimal(fracaoAquecimento, 2)} = ${formatarDecimal(consumoAnualAquecimento, 2)} kWh/ano</li>`;
        html += `<li>Demanda diária: ${formatarDecimal(consumoAnualAquecimento, 2)} / ${diasAquecimento} dias = ${formatarDecimal(demandaCasa, 2)} kWh/dia</li>`;
        html += `<li>Fator temporal (${resultado.horasSolEfetivo}h/24h): ${formatarDecimal(fatorTemporal, 3)}</li>`;
        html += `<li>Área coletor (casa): A = (${formatarDecimal(demandaCasa, 2)} × ${resultado.fatorSeguranca}) / (${formatarDecimal(resultado.H_g_diaria, 2)} × ${formatarDecimal(resultado.eficienciaColetor/100, 2)} × ${formatarDecimal(fatorTemporal, 3)}) = ${formatarDecimal(resultado.areaCasa_m2, 2)} m²</li>`;
        html += '</ul>';
    }
    
    // Resultado final
    html += '<h3 style="color: #2d9fa3ff; margin-top: 16px; font-size: 1rem;">📊 Resultado Final</h3>';
    html += '<ul style="margin: 8px 0; padding-left: 20px;">';
    if (incluirAgua && incluirCasa) {
        html += `<li>Área total: ${formatarDecimal(resultado.areaAgua_m2, 2)} m² (água) + ${formatarDecimal(resultado.areaCasa_m2, 2)} m² (casa) = ${formatarDecimal(resultado.areaColetor_m2, 2)} m²</li>`;
    } else if (incluirAgua) {
        html += `<li>Área total: ${formatarDecimal(resultado.areaAgua_m2, 2)} m²</li>`;
    } else {
        html += `<li>Área total: ${formatarDecimal(resultado.areaCasa_m2, 2)} m²</li>`;
    }
    html += `<li>Número de painéis: ${formatarDecimal(resultado.areaColetor_m2, 2)} / ${formatarDecimal(resultado.areaPainel_m2, 2)} = ${formatarDecimal(resultado.areaColetor_m2 / resultado.areaPainel_m2, 2)} → ${resultado.numeroPaineis} painéis</li>`;
    html += `<li>Eficiência do coletor: ${formatarDecimal(resultado.eficienciaColetor, 1)}%</li>`;
    html += '</ul>';
    
    html += '</div>';
    memorialDiv.innerHTML = html;
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
        'label-tipo-sistema': 'Tipo de Sistema',
        'opt-agua-consumo': '💧 Água de Consumo',
        'desc-agua-consumo': 'Banho, pias, etc.',
        'opt-aquecimento-casa': '🏠 Aquecimento da Casa',
        'desc-aquecimento-casa': 'Aquecimento ambiente',
        'dica-tipo-sistema': '💡 Selecione um ou ambos os tipos de sistema',
        'label-area-casa': 'Área da Casa',
        'label-altura-casa': 'Altura do Pé Direito',
        'label-classe-energetica': 'Classe Energética',
        'dica-altura-casa': '💡 Altura padrão residencial: 2,7m',
        'dica-classe-energetica': '<span style="font-size: 0.85em; color: #666;">* Valores em kWh/m²·ano</span>',
        'consumo-classe-a4': '≤0,40',
        'consumo-classe-a3': '0,40-0,60',
        'consumo-classe-a2': '0,60-0,80',
        'consumo-classe-a1': '0,80-1,00',
        'consumo-classe-b': '1,00-1,20',
        'consumo-classe-c': '1,20-1,50',
        'consumo-classe-d': '1,50-2,00',
        'consumo-classe-e': '2,00-2,60',
        'consumo-classe-f': '2,60-3,50',
        'consumo-classe-g': '>3,50',
        'nota-painel-referencia': '* Baseado no painel de referência Modelo B (1,5 m², 15 tubos, eficiência 70%)',
        'memorial-titulo': 'Memorial de Cálculo',
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
        'dica-tipo-uso': '💡 <strong>Econômico:</strong> 30L/pessoa/dia<br>💡 <strong>Padrão:</strong> 40L/pessoa/dia<br>💡 <strong>Alto:</strong> 60L/pessoa/dia',
        'dica-latitude': '💡 <strong>São Paulo:</strong> ≈ -23,5°<br>💡 <strong>Rio de Janeiro:</strong> ≈ -22,9°<br>💡 <strong>Porto Alegre:</strong> ≈ -30,0°',
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
        'memorial-titulo': 'Memorial de Cálculo',
        'footer': 'Dimensionador de Aquecedor Solar - Engenharia Nata © 2025',
        'aria-home': 'Voltar para a tela inicial',
        'dev-badge-header': '🚧 EM DESENVOLVIMENTO',
        'watermark-dev': '🚧 EM DESENVOLVIMENTO'
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
        'label-tipo-sistema': 'Tipo di Sistema',
        'opt-agua-consumo': '💧 Acqua Consumo',
        'desc-agua-consumo': 'Bagno, lavandini, ecc.',
        'opt-aquecimento-casa': '🏠 Riscaldamento Casa',
        'desc-aquecimento-casa': 'Riscaldamento ambiente',
        'dica-tipo-sistema': '💡 Seleziona uno o entrambi i tipi di sistema',
        'label-area-casa': 'Area Casa',
        'label-altura-casa': 'Altezza Soffitto',
        'label-dias-autonomia': 'Giorni di Autonomia',
        'dica-altura-casa': '💡 Altezza standard residenziale: 2,7m',
        'dica-dias-autonomia': '💡 Numero di giorni senza sole che il sistema deve mantenere la casa riscaldata',
        'unit-dias': 'giorni',
        'label-classe-energetica': 'Classe Energetica',
        'dica-classe-energetica': '<span style="font-size: 0.85em; color: #666;">* Valori in kWh/m²·anno</span>',
        'consumo-classe-a4': '≤0,40',
        'consumo-classe-a3': '0,40-0,60',
        'consumo-classe-a2': '0,60-0,80',
        'consumo-classe-a1': '0,80-1,00',
        'consumo-classe-b': '1,00-1,20',
        'consumo-classe-c': '1,20-1,50',
        'consumo-classe-d': '1,50-2,00',
        'consumo-classe-e': '2,00-2,60',
        'consumo-classe-f': '2,60-3,50',
        'consumo-classe-g': '>3,50',
        'nota-painel-referencia': '* Basato sul pannello di riferimento Modello B (1,5 m², 15 tubi, efficienza 70%)',
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
        'dica-tipo-uso': '💡 <strong>Economico:</strong> 30L/persona/giorno<br>💡 <strong>Standard:</strong> 40L/persona/giorno<br>💡 <strong>Alto:</strong> 60L/persona/giorno',
        'dica-latitude': '💡 <strong>San Paolo:</strong> ≈ -23,5°<br>💡 <strong>Rio de Janeiro:</strong> ≈ -22,9°<br>💡 <strong>Porto Alegre:</strong> ≈ -30,0°',
        'dica-latitude-italia': '💡 <strong>Roma:</strong> ≈ 41,9°<br>💡 <strong>Milano:</strong> ≈ 45,5°<br>💡 <strong>Napoli:</strong> ≈ 40,8°',
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
        'memorial-titulo': 'Memoriale di Calcolo',
        'footer': 'Dimensionatore Riscaldatore Solare - Engenharia Nata © 2025',
        'aria-home': 'Torna alla schermata iniziale',
        'dev-badge-header': '🚧 IN SVILUPPO',
        'watermark-dev': '🚧 IN SVILUPPO'
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
            } else if (el.classList.contains('dica-multilinha')) {
                // Usar innerHTML para dicas multilinha que contêm HTML
                el.innerHTML = textos[chave];
            } else {
                el.textContent = textos[chave];
            }
        }
    });
    
    // Atualizar dica de latitude baseado no idioma
    const dicaLatitude = document.querySelector('[data-i18n="dica-latitude"]');
    if (dicaLatitude) {
        if (idiomaAtual === 'it-IT') {
            dicaLatitude.innerHTML = textos['dica-latitude-italia'] || textos['dica-latitude'];
        } else {
            dicaLatitude.innerHTML = textos['dica-latitude'];
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
            
            // Atualizar classe active nos botões de idioma
            document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(b => {
                if (b.getAttribute('data-lang') === novoIdioma) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            
            atualizarLimitesLatitude();
            traduzir();
            atualizarResultados();
        });
    });
    
    // Inicializar classe active no botão de idioma atual
    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(btn => {
        if (btn.getAttribute('data-lang') === idiomaAtual) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
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
    
    // Event listener para slider de dias de autonomia
    const sliderDiasAutonomia = document.getElementById('sliderDiasAutonomia');
    if (sliderDiasAutonomia) {
        sliderDiasAutonomia.addEventListener('input', () => {
            const valor = parseInt(sliderDiasAutonomia.value);
            const inputDiasAutonomia = document.getElementById('inputDiasAutonomia');
            if (inputDiasAutonomia) {
                inputDiasAutonomia.value = valor.toString();
            }
            atualizarResultados();
        });
    }
    
    // Event listener para input de dias de autonomia
    const inputDiasAutonomia = document.getElementById('inputDiasAutonomia');
    if (inputDiasAutonomia) {
        inputDiasAutonomia.addEventListener('focus', (e) => e.target.select());
        inputDiasAutonomia.addEventListener('input', () => {
            let valor = parseInt(inputDiasAutonomia.value.replace(',', '.')) || 3;
            // Limitar entre 1 e 7
            valor = Math.max(1, Math.min(7, valor));
            if (sliderDiasAutonomia) {
                sliderDiasAutonomia.value = valor;
            }
            inputDiasAutonomia.value = valor.toString();
            atualizarResultados();
        });
        inputDiasAutonomia.addEventListener('blur', () => {
            let valor = parseInt(inputDiasAutonomia.value.replace(',', '.')) || 3;
            valor = Math.max(1, Math.min(7, valor));
            if (sliderDiasAutonomia) {
                sliderDiasAutonomia.value = valor;
            }
            inputDiasAutonomia.value = valor.toString();
            atualizarResultados();
        });
    }
    
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
    
    // Configurar checkboxes de tipo de sistema
    document.querySelectorAll('input[name="tipoSistema"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // Mostrar/ocultar campos de entrada do aquecimento da casa
            atualizarVisibilidadeCamposCasa();
            atualizarResultados();
        });
    });
    
    // Função para mostrar/ocultar campos de entrada do aquecimento da casa
    function atualizarVisibilidadeCamposCasa() {
        const checkboxCasa = document.getElementById('checkboxCasa');
        const incluirCasa = checkboxCasa ? checkboxCasa.checked : false;
        
        // Encontrar os grupos de entrada relacionados ao aquecimento da casa
        const secaoTituloCasa = document.querySelector('.grupo-entrada:has([data-i18n="secao-aquecimento-casa"])');
        const grupoAreaCasa = document.getElementById('sliderAreaCasa')?.closest('.grupo-entrada');
        const grupoAlturaCasa = document.getElementById('sliderAlturaCasa')?.closest('.grupo-entrada');
        const grupoDiasAutonomia = document.getElementById('sliderDiasAutonomia')?.closest('.grupo-entrada');
        const grupoClasseEnergetica = document.querySelector('.grupo-entrada:has(input[name="classeEnergetica"])');
        
        // Mostrar/ocultar os grupos de entrada
        if (secaoTituloCasa) secaoTituloCasa.style.display = incluirCasa ? 'block' : 'none';
        if (grupoAreaCasa) grupoAreaCasa.style.display = incluirCasa ? 'block' : 'none';
        if (grupoAlturaCasa) grupoAlturaCasa.style.display = incluirCasa ? 'block' : 'none';
        if (grupoDiasAutonomia) grupoDiasAutonomia.style.display = incluirCasa ? 'block' : 'none';
        if (grupoClasseEnergetica) grupoClasseEnergetica.style.display = incluirCasa ? 'block' : 'none';
    }
    
    // Chamar na inicialização
    atualizarVisibilidadeCamposCasa();
    
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

