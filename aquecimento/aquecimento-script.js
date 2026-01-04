// ajustarValorPadrao é carregado via script tag no HTML
// DIMENSIONADOR DE AQUECEDOR SOLAR TÉRMICO
// Sistema Termossifão com Tubos a Vácuo
//
// Comentários didáticos em Português - Visão geral do algoritmo
// -------------------------------------------------------------
// Objetivo: dimensionar um sistema completo de aquecimento solar térmico
// para água de consumo e/ou aquecimento ambiente, incluindo:
//  - Área de coletores solares (m²)
//  - Número de painéis necessários
//  - Volume do boiler (litros)
//  - Potência necessária para aquecimento
//  - Número de termossifões (radiadores) para aquecimento ambiente
//  - Custo estimado do sistema
//
// Sistemas Suportados:
//  - Água de Consumo: aquecimento de água para uso doméstico
//  - Aquecimento da Casa: aquecimento ambiente via termossifões
//  - Sistema Combinado: ambos os sistemas simultaneamente
//
// Características Principais:
//  - Cálculo baseado em área (m²) e classe energética (A4 a G)
//  - Considera temperatura mínima para termossifões (48°C)
//  - Considera estratificação térmica do boiler (65% do volume útil)
//  - Calcula HSP (Horas de Sol Pleno) baseado em latitude
//  - Ajusta temperaturas base conforme altitude (gradiente adiabático)
//  - Dimensiona para garantir energia em 1 dia para autonomia total
//
// Fórmulas Principais:
//  - Perda de Calor = Área × Consumo Específico (kWh/m²·ano) × Fator Altura
//  - Demanda Diária = Perda de Calor × (16 horas/dia) / 365 dias
//  - Volume Boiler = Consumo Diário × Dias de Autonomia
//  - Área Coletores = (Energia Aquecimento Boiler + Energia Autonomia) / Energia Capturada por m²
//
// Valores de Referência:
//  - Consumo Específico por Classe: A4 (0.35) a G (4.0) kWh/m²·ano
//  - Temperatura Mínima Termossifão: 48°C
//  - Temperatura Armazenamento: 65°C
//  - Fator Estratificação: 0.65 (65% do volume útil)
//  - Horas de Aquecimento por Dia: 16 horas
//  - Calor Específico da Água: 1.163 Wh/kg°C
// CONFIGURAÇÃO DE CHAVES E SELETORES
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido' };
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) ? SiteConfig.SELECTORS : { HOME_BUTTON: '.home-button-fixed', LANG_BTN: '.lang-btn', ARROW_BTN: '.arrow-btn' };
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || (typeof SiteConfig !== 'undefined' ? SiteConfig.DEFAULTS.language : 'pt-BR');
// CONSTANTES FÍSICAS FIXAS
const CONSTANTS = {
    densidade_agua: 1.0,              // kg/L
    calor_especifico_agua: 1.163,     // Wh/kg°C (Para cálculo direto em kWh)
    irradiacao_horaria_pico_media: 800.0, // W/m²
    altura_minima_boiler: 0.20        // metros
};
// MATRIZES DE DADOS
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
// Modelo de Referência do Coletor Solar Térmico
// Baseado em produtos reais disponíveis nos fornecedores indicados
const MODELO_REFERENCIA = {
    'pt-BR': {
        nome: 'Módulo Aquecimento Solar a Vácuo 15 Tubos Inox 316 BP',
        especificacoes: {
            area_m2: 1.8,           // Área útil aproximada do coletor (15 tubos de 58mm)
            numero_tubos: 15,       // Número de tubos a vácuo
            eficiencia_optica: 0.72, // Eficiência óptica típica para tubos a vácuo (72%)
            coef_perda_linear: 1.6,  // Coeficiente de perda linear (W/m²K)
            potencia_termica_kW: 1.3, // Potência térmica nominal (~1.3 kW sob irradiação de 1000 W/m²)
            preco: 2298.51,         // Preço em R$ (Enertech)
            dimensoes: '~2000 x 1800 x 120 mm (L x A x P)'
        },
        link: {
            url: 'https://www.enertech.com.br/aquecimento-banho/placas-e-coletores/tubos-a-vacuo',
            texto: 'Enertech Brasil'
        }
    },
    'it-IT': {
        nome: 'Collettore Solare Termico Pressurizzato con 15 Tubi HP con Riflettori',
        especificacoes: {
            area_m2: 1.8,           // Área útil aproximada do coletor (15 tubi Heat Pipe)
            numero_tubos: 15,       // Número de tubi Heat Pipe
            eficiencia_optica: 0.75, // Eficiência óptica para Heat Pipe com riflettori (75%)
            coef_perda_linear: 1.4,  // Coeficiente de perda linear (W/m²K)
            potencia_termica_kW: 1.35, // Potência térmica nominal (~1.35 kW sob irradiação de 1000 W/m²)
            preco: 685.0,           // Preço em € (estimado para 15 tubi, baseado em 10 tubi = €457)
            dimensoes: '~2000 x 1800 x 120 mm (L x A x P)'
        },
        link: {
            url: 'https://www.pss-italy.com/categoria-prodotto/pannello-solare-termico-circolazione-naturale/',
            texto: 'PSS-Italy'
        }
    }
};
// Função para obter o modelo de referência baseado no idioma
function obterModeloReferencia() {
    return MODELO_REFERENCIA[idiomaAtual] || MODELO_REFERENCIA['pt-BR'];
}
// Constantes para cálculo de aquecimento da casa
// Potência necessária por metro cúbico (W/m³) - base para cálculo de volume
const POTENCIA_POR_M3 = 30; // W/m³ (aproximadamente 100 BTU/m³ convertido)
// Consumo específico por classe energética (kWh/m²·ano)
// Valores baseados nas normas europeias e italianas de eficiência energética
// Referência: Diretiva EPBD 2002/91/CE, Dlgs 192/2005 (Itália), DPR 59/2009
// Fonte: https://www.la-certificazione-energetica.net/normative_certificazione_energetica_italia.html
// O APE (Attestato di Prestazione Energetica) italiano utiliza classes de A4 a G
// Usando valores médios de cada faixa conforme normativa italiana
const CONSUMO_ESPECIFICO_CLASSE = {
    "A4": 0.35,  // ≤ 0,40 kWh/m²·ano (média: 0,35) - Classe mais eficiente
    "A3": 0.50,  // 0,40 < Consumo ≤ 0,60 kWh/m²·ano (média: 0,50)
    "A2": 0.70,  // 0,60 < Consumo ≤ 0,80 kWh/m²·ano (média: 0,70)
    "A1": 0.90,  // 0,80 < Consumo ≤ 1,00 kWh/m²·ano (média: 0,90)
    "B": 1.10,   // 1,00 < Consumo ≤ 1,20 kWh/m²·ano (média: 1,10)
    "C": 1.35,   // 1,20 < Consumo ≤ 1,50 kWh/m²·ano (média: 1,35)
    "D": 1.75,   // 1,50 < Consumo ≤ 2,00 kWh/m²·ano (média: 1,75) - Padrão típico
    "E": 2.30,   // 2,00 < Consumo ≤ 2,60 kWh/m²·ano (média: 2,30)
    "F": 3.05,   // 2,60 < Consumo ≤ 3,50 kWh/m²·ano (média: 3,05)
    "G": 4.0     // > 3,50 kWh/m²·ano (usando 4,0 como referência) - Classe menos eficiente
};
// Temperatura desejada para aquecimento da casa (conforto térmico)
const TEMPERATURA_CONFORTO_CASA = 22.0; // °C
// Temperatura mínima de operação dos termossifões (radiadores)
// Termossifões com termostato precisam de uma temperatura mínima para funcionar adequadamente
// Abaixo desta temperatura, o termossifão não consegue transferir calor suficiente para o ambiente
const TEMPERATURA_MINIMA_TERMOSSIFAO = 48.0; // °C
// Temperatura de armazenamento inicial no boiler (após carregamento solar)
// Esta é a temperatura máxima que a água atinge quando o sistema solar carrega o boiler
const TEMPERATURA_ARMAZENAMENTO_INICIAL = 65.0; // °C
// Fator de estratificação térmica no boiler
// Devido à estratificação térmica, apenas parte do volume do boiler (parte superior) 
// mantém água quente suficiente para os termossifões funcionarem
// Este fator representa a fração do volume do boiler que estará acima da temperatura mínima
// Valores típicos: 0.6 a 0.7 (60-70% da parte superior do boiler)
const FATOR_ESTRATIFICACAO = 0.65; // 65% do volume superior do boiler mantém temperatura adequada
// Horas de aquecimento ativo por dia
// O aquecimento residencial geralmente é necessário durante as horas mais frias (noite e manhã)
// Durante o dia (8 horas), o sol pode ajudar a aquecer naturalmente, reduzindo a necessidade de aquecimento ativo
// Valor conservador: 16 horas de aquecimento ativo por dia (período noturno + manhã)
const HORAS_AQUECIMENTO_POR_DIA = 16.0; // horas de aquecimento ativo por dia
// FUNÇÕES AUXILIARES
// Converte string numérica para número, aceitando tanto ponto quanto vírgula como decimal
// Funções de formatação agora estão em assets/js/site-config.js
// converterParaNumero -> converterValorFormatadoParaNumero (global)
// formatarNumero -> formatarNumero (global)
// formatarDecimal -> formatarNumeroDecimal (global)
// Alias para compatibilidade com código existente
function converterParaNumero(valorTexto) {
    const resultado = converterValorFormatadoParaNumero(valorTexto);
    return isNaN(resultado) ? NaN : resultado;
}

function formatarDecimal(valor, decimais = 1) {
    return formatarNumeroDecimal(valor, decimais);
}
// Determina a faixa de latitude baseada na latitude fornecida e idioma
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
} // matriz de clima baseada no idioma
function obterMatrizClima(idioma) {
    return idioma === 'it-IT' ? MATRIZ_CLIMA_ITALIA : MATRIZ_CLIMA_BRASIL;
} // Horas de Sol Pico (HSP) no inverno baseado na latitude
function calcularHorasSolPicoInverno(latitude) {
    // Converter latitude para valor absoluto para cálculos
    const latAbs = Math.abs(latitude);
    
    // Valores de referência de HSP no inverno baseados em dados climáticos
    // Hemisfério Sul: inverno em junho/julho
    // Hemisfério Norte: inverno em dezembro/janeiro
    // Interpolação linear entre pontos conhecidos:
    // Latitude 0°: ~5.5 HSP (equador, menor variação sazonal)
    // Latitude 15°: ~4.5 HSP
    // Latitude 30°: ~3.5 HSP
    // Latitude 45°: ~2.5 HSP
    // Latitude 60°: ~1.5 HSP
    
    let hsp;
    if (latAbs <= 15) {
        // Interpolação linear entre 0° e 15°
        hsp = 5.5 - (latAbs / 15) * 1.0; // De 5.5 a 4.5
    } else if (latAbs <= 30) {
        // Interpolação linear entre 15° e 30°
        hsp = 4.5 - ((latAbs - 15) / 15) * 1.0; // De 4.5 a 3.5
    } else if (latAbs <= 45) {
        // Interpolação linear entre 30° e 45°
        hsp = 3.5 - ((latAbs - 30) / 15) * 1.0; // De 3.5 a 2.5
    } else if (latAbs <= 60) {
        // Interpolação linear entre 45° e 60°
        hsp = 2.5 - ((latAbs - 45) / 15) * 1.0; // De 2.5 a 1.5
    } else {
        // Para latitudes acima de 60°, usar valor mínimo
        hsp = Math.max(1.0, 1.5 - ((latAbs - 60) / 15) * 0.5);
    }
    
    // Garantir valores mínimos e máximos razoáveis
    return Math.max(1.0, Math.min(6.0, hsp));
} // temperatura da água fria ajustada pela altitude
function calcularTemperaturaComAltitude(T_base, altitude) {
    // Gradiente adiabático: ~6.5°C por 1000m
    // Para água, o efeito é um pouco menor, usamos ~5.5°C por 1000m
    const gradiente_agua = 5.5; // °C por 1000m para água
    const variacao_altitude = (altitude - ALTITUDE_REFERENCIA) * (gradiente_agua / 1000.0);
    const T_ajustada = T_base - variacao_altitude;
    
    // Limitar temperatura mínima (água não congela facilmente em sistemas, mas limitamos a 2°C)
    return Math.max(2.0, T_ajustada);
} // temperatura ambiente de inverno ajustada pela altitude
function calcularTemperaturaAmbienteComAltitude(T_base, altitude) {
    // Variação linear: -13°C a 2000m = -6.5°C por 1000m = -0.0065°C por metro
    // Aplicar variação linear de 0 até 2000m
    const altitudeLimitada = Math.max(0, Math.min(altitude, 2000));
    const variacao_altitude = altitudeLimitada * (-13.0 / 2000.0);
    const T_ajustada = T_base + variacao_altitude; // variacao_altitude já é negativa
    
    // Limitar temperatura mínima a -5°C (condições extremas de inverno)
    return Math.max(-5.0, T_ajustada);
}
// FUNÇÕES DE CÁLCULO // demanda de energia térmica para aquecimento da casa
function calcularAquecimentoCasa(areaCasa, alturaCasa, classeEnergetica, T_ambiente_inverno) {
    // Volume da casa
    const volumeCasa = areaCasa * alturaCasa; // m³
    
    // Diferença de temperatura (conforto - ambiente inverno)
    const Delta_T_casa = TEMPERATURA_CONFORTO_CASA - T_ambiente_inverno;
    
    // Obter consumo específico da classe energética (kWh/m²·ano)
            // Para aquecimento, assumimos que representa aproximadamente 60-70% do consumo total em climas frios
    const consumoEspecifico = CONSUMO_ESPECIFICO_CLASSE[classeEnergetica] || CONSUMO_ESPECIFICO_CLASSE["D"];
    
    // Fator de ajuste para altura do pé direito
    // Altura padrão de referência: 2,7m // 0,1m acima de 2,7m, aumenta 10% no consumo
    const alturaPadrao = 2.7; // metros
    let fatorAltura = 1.0;
    if (alturaCasa > alturaPadrao) {
        const diferencaAltura = alturaCasa - alturaPadrao;
        // Aumento de 10% para cada 0,1m acima do padrão
        fatorAltura = 1.0 + (diferencaAltura / 0.1) * 0.1;
    }
    
    // Calcular demanda diária de energia baseada em consumo específico por área
        // O consumo específico representa a perda de calor anual por m²
    // 
    // Para calcular a demanda diária de energia:
    // 1. Calcular consumo anual total = Consumo específico × Área × Fator altura
    // 2. Calcular consumo anual de aquecimento (60-70% do total, dependendo do clima)
    // 3. Calcular demanda diária = Consumo anual aquecimento / Dias de aquecimento
    //
    // Para calcular a potência necessária (para dimensionamento de termossifões):
    // Potência = Demanda diária (kWh/dia) / Horas de aquecimento por dia × 1000 (para converter para W)
    const diasPeriodoAquecimento = 150; // dias de aquecimento por ano (aproximadamente 5 meses)
    const fracaoAquecimento = T_ambiente_inverno < 10 ? 0.70 : 0.60; // 70% se muito frio, 60% caso contrário
    
    // Calcular consumo anual total e de aquecimento
    const consumoAnualTotal_kWh = consumoEspecifico * areaCasa * fatorAltura;
    const consumoAnualAquecimento_kWh = consumoAnualTotal_kWh * fracaoAquecimento;
    
    // Calcular demanda diária de energia (kWh/dia)
    const demandaCasa_kWh = consumoAnualAquecimento_kWh / diasPeriodoAquecimento;
    
    // Calcular potência necessária (W) para dimensionamento de termossifões
    // Potência = Demanda diária (kWh/dia) / Horas de aquecimento por dia × 1000 // Adiciona 15% de margem para perdas adicionais (portas, janelas, infiltrações, etc.)
    const potenciaBase_W = (demandaCasa_kWh / HORAS_AQUECIMENTO_POR_DIA) * 1000.0;
    const potenciaNecessaria_W = potenciaBase_W * 1.15;
    
    // A demanda diária já foi calculada acima a partir do consumo específico por área
    // Não precisa recalcular aqui
    
    // Calcular demanda noturna (aproximadamente 60% da demanda diária ocorre à noite)
    // Durante a noite, não há sol, então toda a energia precisa vir do armazenamento
    const fracaoNoite = 0.6; // 60% da demanda ocorre durante a noite (16 horas)
    const demandaCasa_noite_kWh = demandaCasa_kWh * fracaoNoite;
    
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
        fracaoAquecimento: fracaoAquecimento,
        T_ambiente_inverno: T_ambiente_inverno // Adicionar temperatura ambiente para uso posterior
    };
} // dimensionamento completo do sistema de aquecimento solar térmico
function calcularDimensionamento(numeroPessoas, tipoUso, latitude, altitude, modeloColetor, areaCasa, alturaCasa, classeEnergetica, diasAutonomia, incluirAgua, incluirCasa) {
    // Obter dados das matrizes
    const dadosConsumo = MATRIZ_CONSUMO[tipoUso] || MATRIZ_CONSUMO["Padrao"];
    const matrizClima = obterMatrizClima(idiomaAtual);
    const faixaLatitude = obterFaixaLatitude(latitude, idiomaAtual);
    const dadosClimaBase = matrizClima[faixaLatitude] || matrizClima["OUTRAS"];
    // Usar modelo de referência baseado no idioma
    const modeloRef = obterModeloReferencia();
    const dadosColetor = {
        eficiencia_optica: modeloRef.especificacoes.eficiencia_optica,
        coef_perda_linear: modeloRef.especificacoes.coef_perda_linear,
        area_painel: modeloRef.especificacoes.area_m2
    };

    // Calcular temperaturas ajustadas pela altitude
    const T_agua_fria = calcularTemperaturaComAltitude(
        dadosClimaBase.T_agua_fria_base, 
        altitude
    );
    const T_ambiente_inverno = calcularTemperaturaAmbienteComAltitude(
        dadosClimaBase.T_ambiente_inverno_base, 
        altitude
    );
    
    // Calcular Horas de Sol Pico (HSP) no inverno baseado na latitude
    // Isso substitui o valor fixo da matriz por um cálculo dinâmico
    let horasSolPicoInverno;
    try {
        horasSolPicoInverno = calcularHorasSolPicoInverno(latitude);
        // Verificar se o valor é válido
        if (!isFinite(horasSolPicoInverno) || horasSolPicoInverno <= 0) {
            // HSP calculado inválido, usando valor da matriz
            horasSolPicoInverno = dadosClimaBase.H_g_diaria; // Fallback para valor da matriz
        }
    } catch (error) {
        console.error('Erro ao calcular HSP:', error);
        horasSolPicoInverno = dadosClimaBase.H_g_diaria; // Fallback para valor da matriz
    }
    
    // Criar objeto dadosClima com valores ajustados
    const dadosClima = {
        H_g_diaria: horasSolPicoInverno, // Usar HSP calculado baseado na latitude
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
        // HSP = H_g_diaria (já está em kWh/m²/dia, equivalente a horas de sol pico)
    // Energia capturada por m² de painel = HSP × Potência térmica do painel (kW/m²) × Eficiência
    // Potência térmica do painel em condições de pico (1000 W/m²) = eficiência_óptica × 1 kW/m²
    
    const fatorSeguranca = 1.3; // Fator de segurança para dias nublados e perdas
    const horasSolPico = dadosClima.H_g_diaria; // Horas de Sol Pico (HSP) - já em kWh/m²/dia
    
    // Potência térmica do painel em condições de pico (1000 W/m² = 1 kW/m²)
    // Energia capturada por m² de painel em 1 hora de sol pico = eficiência × 1 kWh/m²
    // Energia capturada por m² de painel por dia = HSP × eficiência × 1 kWh/m²
    let energiaCapturadaPorM2_kWh = horasSolPico * eficiencia_coletor_final;
    
    // Verificar se a energia capturada é válida (evitar divisão por zero)
    if (!isFinite(energiaCapturadaPorM2_kWh) || energiaCapturadaPorM2_kWh <= 0) {
        console.error('Erro: energiaCapturadaPorM2_kWh inválida:', energiaCapturadaPorM2_kWh, 'horasSolPico:', horasSolPico, 'eficiencia_coletor_final:', eficiencia_coletor_final);
        // Usar valor padrão mínimo para evitar erro
        energiaCapturadaPorM2_kWh = 0.1; // Valor mínimo de segurança
    }
    
    // Calcular área necessária para cada sistema separadamente
    let areaAgua_m2 = 0;
    let areaCasa_m2 = 0;
    
    // ÁREA PARA ÁGUA: Usa energia capturada considerando horas de sol pico
    if (incluirAgua && E_nec_kWh > 0 && energiaCapturadaPorM2_kWh > 0) {
        // Área = Demanda / (Energia capturada por m²)
        areaAgua_m2 = (E_nec_kWh * fatorSeguranca) / energiaCapturadaPorM2_kWh;
    }
    
    // 4.7. DIMENSIONAMENTO DO VOLUME DO BOILER PARA AQUECIMENTO DA CASA
    // Se incluir aquecimento da casa, calcular volume adicional necessário
    // para armazenar energia térmica para uso durante períodos sem sol (autonomia)
    let V_boiler_casa_L = 0;
    let volumeUtilBoiler_L = 0; // Volume do boiler que estará acima da temperatura mínima (apenas para casa)
    let energiaAquecimentoBoiler_kWh = 0; // Energia necessária para aquecer TODO o boiler até 65°C
    
    if (incluirCasa && resultadoCasa.demandaCasa_kWh > 0) {
        // PASSO 1: Calcular energia total necessária para os dias de autonomia
        // Considera a demanda diária total multiplicada pelos dias de autonomia
        const demandaTotalAutonomia_kWh = resultadoCasa.demandaCasa_kWh * diasAutonomia;
        
        // PASSO 2: Calcular volume de água necessário para armazenar essa energia
                // até o último dia de autonomia. Consideramos:
        // - Temperatura inicial de armazenamento: TEMPERATURA_ARMAZENAMENTO_INICIAL (65°C)
        // - Temperatura mínima de operação dos termossifões: TEMPERATURA_MINIMA_TERMOSSIFAO (48°C)
        // - Delta_T_armazenamento: diferença entre temperatura inicial e temperatura mínima (17°C)
        //   Esta é a faixa de temperatura utilizável para os termossifões funcionarem
        const Delta_T_armazenamento = TEMPERATURA_ARMAZENAMENTO_INICIAL - TEMPERATURA_MINIMA_TERMOSSIFAO; // 65°C - 48°C = 17°C
        
        // Fórmula: E = m × c × ΔT → m = E / (c × ΔT) → V = m / ρ
        // Onde: E = energia (Wh), m = massa (kg), c = calor específico (Wh/kg·°C), ΔT = diferença de temperatura (°C), ρ = densidade (kg/L)
        const E_autonomia_Wh = demandaTotalAutonomia_kWh * 1000.0;
        const massa_kg = E_autonomia_Wh / (CONSTANTS.calor_especifico_agua * Delta_T_armazenamento);
        const V_teorico_L = massa_kg / CONSTANTS.densidade_agua; // L
        
        // PASSO 3: Ajustar volume considerando estratificação térmica
                // (parte superior) mantém água quente suficiente para os termossifões funcionarem.
        // A água quente fica em cima e a fria embaixo. Portanto, precisamos de um volume maior
        // para garantir que a parte superior (que será usada pelos termossifões) tenha água
        // quente suficiente até o último dia de autonomia.
        // Volume necessário = Volume teórico / Fator de estratificação
        V_boiler_casa_L = V_teorico_L / FATOR_ESTRATIFICACAO;
        
        // Volume útil (parte superior do boiler que estará acima da temperatura mínima)
        // Este é o volume que realmente pode ser usado pelos termossifões
        volumeUtilBoiler_L = V_boiler_casa_L * FATOR_ESTRATIFICACAO;
        
        // PASSO 4: Adicionar fator de segurança de 20% para o volume de armazenamento
        V_boiler_casa_L = V_boiler_casa_L * 1.2;
        volumeUtilBoiler_L = volumeUtilBoiler_L * 1.2;
    }
    
    // PASSO 5: Calcular volume total do boiler (água + casa)
    const V_boiler_total_L = V_boiler_agua_L + V_boiler_casa_L;
    
    // PASSO 6: Calcular energia necessária para aquecer TODO o volume do boiler
        // pois o sistema precisa aquecer todo o volume em apenas 1 dia de sol.
    // Esta energia é necessária apenas se houver sistema de casa, pois para água
    // o boiler já é dimensionado para armazenar água quente pronta para uso.
    if ((incluirCasa && V_boiler_total_L > 0) || (incluirAgua && incluirCasa && V_boiler_total_L > 0)) {
        const T_ambiente_para_calculo = resultadoCasa.T_ambiente_inverno !== undefined 
            ? resultadoCasa.T_ambiente_inverno 
            : dadosClima.T_ambiente_inverno;
        const Delta_T_aquecimento = TEMPERATURA_ARMAZENAMENTO_INICIAL - T_ambiente_para_calculo;
        
        // Fórmula: E = m × c × ΔT
        // Onde: m = massa total do boiler (kg), c = calor específico (Wh/kg·°C), ΔT = diferença de temperatura (°C)
        const massa_boiler_total_kg = V_boiler_total_L * CONSTANTS.densidade_agua; // kg
        const E_aquecimento_boiler_Wh = massa_boiler_total_kg * CONSTANTS.calor_especifico_agua * Delta_T_aquecimento;
        energiaAquecimentoBoiler_kWh = E_aquecimento_boiler_Wh / 1000.0;
    }
    
    // ÁREA PARA CASA: Usa energia capturada considerando horas de sol pico
    // LÓGICA COMPLETA DO CÁLCULO:
    // O sistema precisa captar em 1 dia de sol energia suficiente para:
    // 1. Aquecer TODO o volume do boiler (água + casa) até 65°C (energiaAquecimentoBoiler_kWh)
    //    - Esta energia é necessária apenas uma vez, quando o sistema é carregado
    // 2. Fornecer energia para os dias de autonomia (demandaCasa_kWh × diasAutonomia)
    //    - Esta energia é necessária para manter a casa aquecida durante os dias sem sol
    // 
    // EXEMPLO: Se autonomia = 5 dias:
    // - Energia para aquecer boiler: 10 kWh (uma vez)
    // - Energia para 5 dias de autonomia: 3.7 kWh/dia × 5 dias = 18.5 kWh
    // - Energia total necessária em 1 dia: 10 + 18.5 = 28.5 kWh
    // - Área necessária: 28.5 kWh ÷ (energia capturada por m²) = X m²
    if (incluirCasa && resultadoCasa.demandaCasa_kWh > 0 && energiaCapturadaPorM2_kWh > 0) {
        // Calcular demanda total considerando:
        // - Energia para aquecer TODO o boiler até 65°C (em 1 dia) - apenas se houver sistema de casa
        // - Energia para os dias de autonomia (demanda diária × dias de autonomia)
        const demandaCasaComAutonomia_kWh = resultadoCasa.demandaCasa_kWh * diasAutonomia;
        
                // Para sistema apenas de água, o boiler já armazena água quente pronta para uso
        const demandaTotalCasa_kWh = energiaAquecimentoBoiler_kWh + demandaCasaComAutonomia_kWh;
        
        // Área = (Energia para aquecer boiler + Demanda × Dias de Autonomia) × Fator Segurança / (Energia capturada por m²) // que em 1 dia de sol, o sistema:
        // - Aqueça todo o volume do boiler até 65°C
        // - Capte energia suficiente para N dias de autonomia
        areaCasa_m2 = (demandaTotalCasa_kWh * fatorSeguranca) / energiaCapturadaPorM2_kWh;
    }
    
    // ÁREA TOTAL NECESSÁRIA: Soma das áreas para água e casa
    // Se ambos os sistemas estiverem selecionados, a área total é a soma das duas
    // Se apenas um estiver selecionado, a área total é apenas a área desse sistema
    const A_col_m2 = areaAgua_m2 + areaCasa_m2;
    
    // Garantir área mínima para evitar divisão por zero
    const areaMinima = 0.1; // m² mínimo
    const A_col_final = Math.max(A_col_m2, areaMinima);
    
    // NÚMERO DE PAINÉIS: Área total necessária dividida pela área de cada painel
    // Arredonda para cima para garantir que a área seja suficiente
    const N_paineis = A_col_final / dadosColetor.area_painel;
    const N_paineis_final = Math.max(1, Math.ceil(N_paineis)); // Mínimo de 1 painel
    
    // Volume total do boiler já foi calculado anteriormente (V_boiler_total_L)
    const V_boiler_L = V_boiler_total_L;

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
        horasSolEfetivo: horasSolPico, // Usar horasSolPico (HSP) como horas sol efetivo
        fatorSeguranca: fatorSeguranca,
        areaPainel_m2: dadosColetor.area_painel, // Área do painel de referência
        T_agua_fria: T_agua_fria, // Temperatura da água fria calculada
        T_ambiente_inverno: T_ambiente_inverno, // Temperatura ambiente de inverno calculada
        volumeCasa_m3: resultadoCasa.volumeCasa_m3,
        potenciaCasa_W: resultadoCasa.potenciaNecessaria_W,
        volumeBoilerAgua_L: V_boiler_agua_L,
        volumeBoilerCasa_L: V_boiler_casa_L, // Volume do boiler para aquecimento da casa (considera dias de autonomia)
        volumeUtilBoiler_L: volumeUtilBoiler_L, // Volume útil do boiler (parte superior acima da temperatura mínima)
        energiaAquecimentoBoiler_kWh: energiaAquecimentoBoiler_kWh, // Energia necessária para aquecer o boiler até 65°C
        temperaturaMinimaTermossifao: TEMPERATURA_MINIMA_TERMOSSIFAO, // Temperatura mínima de operação dos termossifões
        temperaturaArmazenamentoInicial: TEMPERATURA_ARMAZENAMENTO_INICIAL // Temperatura inicial de armazenamento
    };
}
// Matriz de Termossifões (Radiadores) para Aquecimento de Ambientes
// Valores baseados em preços médios do mercado (Brasil em R$ e Itália em €) - 2024/2025
// Matriz de Termossifões (Radiadores) para Aquecimento de Ambientes
// Valores baseados em especificações técnicas reais de radiadores termossifões
// Potências indicadas para Delta T = 50°C (temperatura água entrada - temperatura ambiente = 50°C)
// Exemplo: água a 60°C em ambiente a 10°C = Delta T de 50°C
// Temperatura mínima de água para funcionamento adequado: 45-50°C (dependendo do modelo)
// Valores baseados em catálogos de fabricantes e normas técnicas
const MATRIZ_TERMOSSIFOES = {
    'pt-BR': [
        { tamanho: 'Muito Pequeno', potencia_W: 300, comprimento_cm: 50, altura_cm: 30, preco: 380.0, descricao: '50x30cm - 300W', tempMinimaAgua: 45.0 },
        { tamanho: 'Pequeno', potencia_W: 500, comprimento_cm: 60, altura_cm: 40, preco: 480.0, descricao: '60x40cm - 500W', tempMinimaAgua: 48.0 },
        { tamanho: 'Médio', potencia_W: 800, comprimento_cm: 80, altura_cm: 50, preco: 680.0, descricao: '80x50cm - 800W', tempMinimaAgua: 50.0 },
        { tamanho: 'Grande', potencia_W: 1200, comprimento_cm: 100, altura_cm: 60, preco: 920.0, descricao: '100x60cm - 1200W', tempMinimaAgua: 50.0 },
        { tamanho: 'Extra Grande', potencia_W: 1800, comprimento_cm: 120, altura_cm: 60, preco: 1300.0, descricao: '120x60cm - 1800W', tempMinimaAgua: 50.0 },
        { tamanho: 'Duplo', potencia_W: 2400, comprimento_cm: 150, altura_cm: 60, preco: 1650.0, descricao: '150x60cm - 2400W', tempMinimaAgua: 50.0 }
    ],
    'it-IT': [
        { tamanho: 'Molto Piccolo', potencia_W: 300, comprimento_cm: 50, altura_cm: 30, preco: 65.0, descricao: '50x30cm - 300W', tempMinimaAgua: 45.0 },
        { tamanho: 'Piccolo', potencia_W: 500, comprimento_cm: 60, altura_cm: 40, preco: 80.0, descricao: '60x40cm - 500W', tempMinimaAgua: 48.0 },
        { tamanho: 'Medio', potencia_W: 800, comprimento_cm: 80, altura_cm: 50, preco: 120.0, descricao: '80x50cm - 800W', tempMinimaAgua: 50.0 },
        { tamanho: 'Grande', potencia_W: 1200, comprimento_cm: 100, altura_cm: 60, preco: 160.0, descricao: '100x60cm - 1200W', tempMinimaAgua: 50.0 },
        { tamanho: 'Extra Grande', potencia_W: 1800, comprimento_cm: 120, altura_cm: 60, preco: 220.0, descricao: '120x60cm - 1800W', tempMinimaAgua: 50.0 },
        { tamanho: 'Doppio', potencia_W: 2400, comprimento_cm: 150, altura_cm: 60, preco: 280.0, descricao: '150x60cm - 2400W', tempMinimaAgua: 50.0 }
    ]
};
// Estima o número e tipos de ambientes de uma casa baseado na área
function estimarAmbientes(areaCasa) {
    const ambientes = [];
    
    // Estimativa baseada em padrões arquitetônicos típicos
    // Sala de estar: ~20-30 m²
    // Quartos: ~12-18 m² cada
    // Cozinha: ~10-15 m²
    // Banheiros: ~4-6 m² cada
    
    if (areaCasa < 50) {
        // Casa pequena: 1-2 ambientes
        ambientes.push({ tipo: 'Sala/Quarto', area_m2: areaCasa * 0.6 });
        ambientes.push({ tipo: 'Cozinha/Banheiro', area_m2: areaCasa * 0.4 });
    } else if (areaCasa < 80) {
        // Casa pequena-média: 2-3 ambientes
        ambientes.push({ tipo: 'Sala', area_m2: Math.min(25, areaCasa * 0.35) });
        ambientes.push({ tipo: 'Quarto', area_m2: Math.min(15, areaCasa * 0.35) });
        ambientes.push({ tipo: 'Cozinha/Banheiro', area_m2: areaCasa * 0.3 });
    } else if (areaCasa < 120) {
        // Casa média: 3-4 ambientes
        ambientes.push({ tipo: 'Sala', area_m2: Math.min(30, areaCasa * 0.25) });
        ambientes.push({ tipo: 'Quarto 1', area_m2: Math.min(15, areaCasa * 0.2) });
        ambientes.push({ tipo: 'Quarto 2', area_m2: Math.min(15, areaCasa * 0.2) });
        ambientes.push({ tipo: 'Cozinha/Banheiro', area_m2: areaCasa * 0.35 });
    } else if (areaCasa < 200) {
        // Casa média-grande: 4-6 ambientes
        ambientes.push({ tipo: 'Sala', area_m2: Math.min(35, areaCasa * 0.18) });
        ambientes.push({ tipo: 'Quarto 1', area_m2: Math.min(18, areaCasa * 0.15) });
        ambientes.push({ tipo: 'Quarto 2', area_m2: Math.min(18, areaCasa * 0.15) });
        ambientes.push({ tipo: 'Quarto 3', area_m2: Math.min(15, areaCasa * 0.12) });
        ambientes.push({ tipo: 'Cozinha', area_m2: Math.min(15, areaCasa * 0.12) });
        ambientes.push({ tipo: 'Banheiros', area_m2: areaCasa * 0.28 });
    } else {
        // Casa grande: 6+ ambientes
        ambientes.push({ tipo: 'Sala', area_m2: Math.min(40, areaCasa * 0.15) });
        ambientes.push({ tipo: 'Quarto 1', area_m2: Math.min(20, areaCasa * 0.12) });
        ambientes.push({ tipo: 'Quarto 2', area_m2: Math.min(20, areaCasa * 0.12) });
        ambientes.push({ tipo: 'Quarto 3', area_m2: Math.min(18, areaCasa * 0.1) });
        ambientes.push({ tipo: 'Quarto 4', area_m2: Math.min(15, areaCasa * 0.08) });
        ambientes.push({ tipo: 'Cozinha', area_m2: Math.min(18, areaCasa * 0.1) });
        ambientes.push({ tipo: 'Banheiros', area_m2: areaCasa * 0.33 });
    }
    
    return ambientes;
} // potência necessária para aquecer um ambiente
function calcularPotenciaAmbiente(areaAmbiente, alturaCasa, T_externa, classeEnergetica) {
    // Obter consumo específico da classe energética (kWh/m²·ano)
    const consumoEspecifico = CONSUMO_ESPECIFICO_CLASSE[classeEnergetica] || CONSUMO_ESPECIFICO_CLASSE["D"];
    
    // Fator de ajuste para altura do pé direito
    const alturaPadrao = 2.7; // metros
    let fatorAltura = 1.0;
    if (alturaCasa > alturaPadrao) {
        const diferencaAltura = alturaCasa - alturaPadrao;
        fatorAltura = 1.0 + (diferencaAltura / 0.1) * 0.1;
    }
    
    // Calcular demanda diária usando a mesma lógica de calcularAquecimentoCasa
    const diasPeriodoAquecimento = 150; // dias de aquecimento por ano
    const fracaoAquecimento = T_externa < 10 ? 0.70 : 0.60; // 70% se muito frio, 60% caso contrário
    
    // Calcular consumo anual total e de aquecimento
    const consumoAnualTotal_kWh = consumoEspecifico * areaAmbiente * fatorAltura;
    const consumoAnualAquecimento_kWh = consumoAnualTotal_kWh * fracaoAquecimento;
    
    // Calcular demanda diária de energia (kWh/dia)
    const demandaDiaria_kWh = consumoAnualAquecimento_kWh / diasPeriodoAquecimento;
    
    // Calcular potência necessária (W) para dimensionamento de termossifões
    // Potência = Demanda diária (kWh/dia) / Horas de aquecimento por dia × 1000 // Adiciona 15% de margem para perdas adicionais (portas, janelas, etc.)
    const potenciaBase_W = (demandaDiaria_kWh / HORAS_AQUECIMENTO_POR_DIA) * 1000.0;
    const potenciaNecessaria_W = potenciaBase_W * 1.15;
    
    return Math.max(0, potenciaNecessaria_W);
}
// Seleciona o termossifão mais adequado para uma potência necessária
function selecionarTermossifao(potenciaNecessaria_W, matrizTermossifoes) {
    // Ordenar por potência (menor para maior)
    const termossifoesOrdenados = [...matrizTermossifoes].sort((a, b) => a.potencia_W - b.potencia_W); // Se potência necessária é muito pequena (menor que 50% do menor termossifão disponível),
    // usar o menor termossifão disponível (melhor ter capacidade extra do que insuficiente)
    if (potenciaNecessaria_W < termossifoesOrdenados[0].potencia_W * 0.5) {
        return termossifoesOrdenados[0];
    }
    
    // Encontrar o termossifão com potência igual ou superior à necessária
    // Com margem de 20% para garantir capacidade adequada
    const potenciaComMargem = potenciaNecessaria_W * 1.2;
    
    for (const termossifao of termossifoesOrdenados) {
        // Aceitar termossifão se sua potência for >= potência com margem
        // Ou se estiver dentro de 30% da potência necessária (para evitar superdimensionamento excessivo)
        if (termossifao.potencia_W >= potenciaComMargem || 
            (termossifao.potencia_W >= potenciaNecessaria_W && termossifao.potencia_W <= potenciaNecessaria_W * 1.3)) {
            return termossifao;
        }
    }
    
    // Se nenhum termossifão individual atende, usar o maior disponível
    // Pode ser necessário mais de um em ambientes muito grandes
    return termossifoesOrdenados[termossifoesOrdenados.length - 1];
} // quantidade e custo de termossifões necessários para aquecer a casa
function calcularTermossifoes(areaCasa, alturaCasa, T_ambiente_inverno, classeEnergetica) {
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
    
    // Obter matriz de termossifões baseada no idioma atual
    const matrizTermossifoes = MATRIZ_TERMOSSIFOES[idiomaAtual] || MATRIZ_TERMOSSIFOES['pt-BR'];
    
    // Estimar ambientes da casa
    const ambientes = estimarAmbientes(areaCasa);
    
    // Calcular termossifões para cada ambiente
    const termossifoesPorAmbiente = [];
    const termossifoesSelecionados = [];
    const detalhes = [];
    
    for (const ambiente of ambientes) {
        // Calcular potência necessária para este ambiente
        const potenciaAmbiente_W = calcularPotenciaAmbiente(
            ambiente.area_m2,
            alturaCasa,
            T_ambiente_inverno,
            classeEnergetica
        );
        
        if (potenciaAmbiente_W > 0) {
            // Selecionar termossifão adequado
            const termossifaoSelecionado = selecionarTermossifao(potenciaAmbiente_W, matrizTermossifoes);
            
            // Verificar se precisa de mais de um termossifão
            const potenciaComMargem = potenciaAmbiente_W * 1.2;
            const quantidadeNecessaria = Math.ceil(potenciaComMargem / termossifaoSelecionado.potencia_W);
            const quantidadeFinal = Math.min(quantidadeNecessaria, 2); // Máximo 2 por ambiente
            
            // Adicionar ao array de termossifões
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
            
            // Adicionar detalhes
            const textoAmbiente = idiomaAtual === 'it-IT' 
                ? `${quantidadeFinal}x ${termossifaoSelecionado.descricao} (${ambiente.tipo})`
                : `${quantidadeFinal}x ${termossifaoSelecionado.descricao} (${ambiente.tipo})`;
            detalhes.push(textoAmbiente);
            
            termossifoesPorAmbiente.push({
                ambiente: ambiente.tipo,
                area_m2: ambiente.area_m2,
                potenciaNecessaria_W: potenciaAmbiente_W,
                termossifao: termossifaoSelecionado,
                quantidade: quantidadeFinal
            });
        }
    }
    
    // Calcular custo total
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
} // custos estimados do sistema de aquecimento solar
function calcularCustos(numeroPaineis, areaColetor_m2, volumeBoiler_L, areaCasa = 0, alturaCasa = 2.7, T_ambiente_inverno = 10, classeEnergetica = 'D', incluirCasa = false) {
    // Preços médios do mercado baseados em pesquisas 2024/2025
    // Valores em R$ para Brasil (pt-BR) e € para Itália (it-IT)
    const PRECOS = {
        'pt-BR': {
            // Custo por painel (inclui tubos a vácuo, estrutura, etc.)
            // Baseado em: Módulo Aquecimento Solar a Vácuo 15 Tubos Inox 316 BP - Enertech
            // Fonte: https://www.enertech.com.br/aquecimento-banho/placas-e-coletores/tubos-a-vacuo
            painel_por_unidade: 2298.51, // R$ por painel (Modelo B - 1,5 m², 15 tubos)
            painel_por_m2: 1532.34, // R$ por m² de área de coletor (R$ 2298,51 / 1,5 m²)
            
            // Custo do boiler/acumulador por litro
            // Baseado em boilers de aço inox para sistemas solares (estimativa média de mercado)
            boiler_por_litro: 15.0, // R$ por litro de capacidade
            
            // Custo de tubulações e conexões por metro
            // Considera tubo de cobre 25mm (1"), conexões, válvulas, etc.
            tubulacao_por_metro: 60.0, // R$ por metro de tubulação completa
            comprimento_tubulacao_medio: 10.0, // metros (estimativa média)
            
            // Custo de isolante térmico por metro
            // Isolante de espuma ou lã de rocha para tubulações
            isolante_por_metro: 18.0 // R$ por metro de isolante térmico
        },
        'it-IT': {
            // Custo por painel (inclui tubos a vácuo, estrutura, etc.)
            // Baseado em: Collettore solare termico pressurizzato c/10 tubi HP = €457
            // Estimativa para 15 tubi: ~€685 (proporcional)
            // Fonte: https://www.pss-italy.com/categoria-prodotto/pannello-solare-termico-circolazione-naturale/
            painel_por_unidade: 685.0, // € por painel (15 tubi, ~1,8 m²)
            painel_por_m2: 380.56, // € por m² de área de coletor (€ 685 / 1,8 m²)
            
            // Custo do boiler/acumulador por litro
            // Baseado em: Pannello 200 litri 15 tubi = €1.425,99
            // Estimativa: (€1.425,99 - €685 coletor) / 200L = ~€3,70/L
            boiler_por_litro: 3.7, // € por litro de capacidade
            
            // Custo de tubulações e conexões por metro
            // Considera tubo de cobre 25mm (1"), conexões, válvulas, etc.
            tubulacao_por_metro: 12.0, // € por metro de tubulação completa
            comprimento_tubulacao_medio: 10.0, // metros (estimativa média)
            
            // Custo de isolante térmico por metro
            // Isolante de espuma ou lã de rocha para tubulações
            isolante_por_metro: 3.0 // € por metro de isolante térmico
        }
    };
    
    // Selecionar preços baseado no idioma atual
    const precos = PRECOS[idiomaAtual] || PRECOS['pt-BR'];
    
    // Calcular custos
    const custoPaineis = numeroPaineis * precos.painel_por_unidade;
    
    // Custo do boiler (acumulador)
    const custoAcumuladores = volumeBoiler_L * precos.boiler_por_litro;
    
    // Custo de tubulações e conexões
    // Estimativa baseada em comprimento médio + 20% de margem para conexões
    const comprimentoTubulacao = precos.comprimento_tubulacao_medio;
    const custoTubulacoes = comprimentoTubulacao * precos.tubulacao_por_metro * 1.2; // +20% para conexões
    
    // Custo de isolantes térmicos
    // Mesmo comprimento das tubulações
    const custoIsolantes = comprimentoTubulacao * precos.isolante_por_metro;
    
    // Custo de termossifões (apenas para aquecimento da casa)
    let custoTermossifoes = 0;
    let detalhesTermossifoes = '';
    let quantidadeTermossifoes = 0;
    
    if (incluirCasa && areaCasa > 0) {
        const calculoTermossifoes = calcularTermossifoes(areaCasa, alturaCasa, T_ambiente_inverno, classeEnergetica);
        custoTermossifoes = calculoTermossifoes.custoTotal;
        detalhesTermossifoes = calculoTermossifoes.detalhes;
        quantidadeTermossifoes = calculoTermossifoes.quantidade;
    }
    
    // Custo total
    const custoTotal = custoPaineis + custoAcumuladores + custoTubulacoes + custoIsolantes + custoTermossifoes;
    
    return {
        custoPaineis: custoPaineis,
        custoAcumuladores: custoAcumuladores,
        custoTubulacoes: custoTubulacoes,
        custoIsolantes: custoIsolantes,
        custoTermossifoes: custoTermossifoes,
        quantidadeTermossifoes: quantidadeTermossifoes,
        detalhesTermossifoes: detalhesTermossifoes,
        custoTotal: custoTotal
    };
}
// Atualiza os limites do slider de latitude baseado no idioma
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
// Atualiza os resultados na interface
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
    const sliderDiasAutonomia = document.getElementById('sliderDiasAutonomia');
    
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
        const valorConvertido = converterParaNumero(inputAltitude.value);
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
        const valorConvertido = converterParaNumero(inputAreaCasa.value);
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
    // Usar modelo de referência baseado no idioma (não há mais Modelo_B)
    const modeloRef = obterModeloReferencia();
    
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
        const secaoResultados = document.querySelector('.resultados') || document.getElementById('resultadosSection');
        if (secaoResultados) {
            secaoResultados.style.display = 'none';
        }
        return;
    } else {
        // Mostrar seção de resultados se pelo menos um estiver selecionado
        const secaoResultados = document.querySelector('.resultados') || document.getElementById('resultadosSection');
        if (secaoResultados) {
            secaoResultados.style.display = 'block';
        }
    } // dimensionamento (modeloColetor não é mais usado, usa modelo de referência baseado no idioma)
    let resultado;
    try {
        resultado = calcularDimensionamento(numeroPessoas, tipoUso, latitude, altitude, null, areaCasa, alturaCasa, classeEnergetica, diasAutonomia, incluirAgua, incluirCasa);
        
        // Verificar se o resultado é válido
        if (!resultado || typeof resultado !== 'object') {
            console.error('Erro: resultado do cálculo é inválido:', resultado);
            return;
        }
    } catch (error) {
        console.error('Erro ao calcular dimensionamento:', error);
        console.error('Stack trace:', error.stack);
        // Mostrar mensagem de erro ou valores padrão
        const secaoResultados = document.querySelector('.resultados') || document.getElementById('resultadosSection');
        if (secaoResultados) {
            secaoResultados.style.display = 'block';
        }
        // Exibir mensagem de erro na interface
        const elementoAreaColetor = document.getElementById('areaColetor');
        if (elementoAreaColetor) {
            elementoAreaColetor.textContent = 'Erro no cálculo';
        }
        return; // Sair da função se houver erro
    }
    
    // Atualiza os displays
    const textos = traducoes[idiomaAtual] || traducoes['pt-BR'];
    const textoPainel = resultado.numeroPaineis === 1 ? (textos['unit-painel-singular'] || 'painel') : (textos['unit-painel-plural'] || 'paineis');
    
    // Verificar se os elementos existem antes de atualizar
    const elementoAreaColetor = document.getElementById('areaColetor');
    if (elementoAreaColetor) {
        elementoAreaColetor.textContent = formatarNumeroComSufixo(resultado.areaColetor_m2 || 0, 2) + ' m²';
    }
    
    // Exibir número de painéis (apenas o número, sem informações extras)
    const elementoNumeroPaineis = document.getElementById('numeroPaineis');
    if (elementoNumeroPaineis) {
        elementoNumeroPaineis.textContent = (resultado.numeroPaineis || 0) + ' ' + textoPainel;
    }
    
    // Mostrar/ocultar resultados baseado no tipo de sistema selecionado
    const elementoDemandaEnergia = document.getElementById('demandaEnergia');
    const elementoDemandaCasa = document.getElementById('demandaCasa');
    const elementoVolumeBoiler = document.getElementById('volumeBoiler');
    const elementoPotenciaCasa = document.getElementById('potenciaCasa');
    const elementoTermossifoes = document.getElementById('resultadoTermossifoes');
    const elementoTermossifoesDetalhes = document.getElementById('termossifoesDetalhes');
    
    const resultadoAgua = elementoDemandaEnergia ? elementoDemandaEnergia.closest('.resultado-item') : null;
    const resultadoCasa = elementoDemandaCasa ? elementoDemandaCasa.closest('.resultado-item') : null;
    const resultadoVolumeBoiler = elementoVolumeBoiler ? elementoVolumeBoiler.closest('.resultado-item') : null;
    const resultadoPotenciaCasa = elementoPotenciaCasa ? elementoPotenciaCasa.closest('.resultado-item') : null;
    
    if (resultadoAgua) resultadoAgua.style.display = incluirAgua ? 'flex' : 'none';
    if (resultadoCasa) resultadoCasa.style.display = incluirCasa ? 'flex' : 'none';
    if (resultadoVolumeBoiler) resultadoVolumeBoiler.style.display = (incluirAgua || incluirCasa) ? 'flex' : 'none';
    if (resultadoPotenciaCasa) resultadoPotenciaCasa.style.display = incluirCasa ? 'flex' : 'none';
    
    // Atualizar valores dos elementos (verificando se existem)
    if (elementoDemandaEnergia) elementoDemandaEnergia.textContent = formatarDecimal(resultado.demandaEnergia_kWh || 0, 2) + ' kWh/dia';
    if (elementoDemandaCasa) elementoDemandaCasa.textContent = formatarDecimal(resultado.demandaCasa_kWh || 0, 2) + ' kWh/dia';
    
    if (elementoVolumeBoiler) elementoVolumeBoiler.textContent = formatarNumeroComSufixo(Math.round(resultado.volumeBoiler_L || 0), 0) + ' L';
    
    if (elementoPotenciaCasa) {
        elementoPotenciaCasa.textContent = formatarNumeroComSufixo(resultado.potenciaCasa_W || 0, 0) + ' W';
    }
    
    // Atualizar termossifões se casa estiver selecionada
    if (incluirCasa && areaCasa > 0 && elementoTermossifoes && elementoTermossifoesDetalhes) {
        try {
            const calculoTermossifoes = calcularTermossifoes(areaCasa, alturaCasa, resultado.T_ambiente_inverno, classeEnergetica);
            if (calculoTermossifoes.ambientes && calculoTermossifoes.ambientes.length > 0) {
                elementoTermossifoes.style.display = 'flex';
                // Criar lista HTML ao invés de texto corrido
                const listaHTML = calculoTermossifoes.ambientes.map(a => {
                    const textoAmbiente = idiomaAtual === 'it-IT' ? a.ambiente : a.ambiente;
                    return `<li style="margin-bottom: 4px;">${a.quantidade}x ${a.termossifao.descricao} (${textoAmbiente})</li>`;
                }).join('');
                elementoTermossifoesDetalhes.innerHTML = `<ul style="margin: 0; padding-left: 24px; list-style-type: disc; line-height: 1.6;">${listaHTML}</ul>`;
            } else {
                elementoTermossifoes.style.display = 'none';
            }
        } catch (error) {
            console.error('Erro ao calcular termossifões:', error);
            elementoTermossifoes.style.display = 'none';
        }
    } else if (elementoTermossifoes) {
        elementoTermossifoes.style.display = 'none';
    }
    
    // Atualizar nota de referência do painel com formatação limpa
    const notaPainelReferencia = document.getElementById('notaPainelReferencia');
    if (notaPainelReferencia) {
        const modeloRef = obterModeloReferencia();
        const linkRef = modeloRef.link;
        const nomeModelo = modeloRef.nome;
        const especs = modeloRef.especificacoes;
        const textoBase = idiomaAtual === 'it-IT' 
            ? 'Modello di riferimento: ' 
            : 'Modelo de referência: ';
        const textoLink = idiomaAtual === 'it-IT' ? 'Vedi ' : 'Ver ';
        const textoEficiencia = idiomaAtual === 'it-IT' ? 'efficienza' : 'eficiência';
        const textoEspecificacoes = `${formatarDecimal(especs.area_m2, 2)} m² • ${especs.numero_tubos} ${idiomaAtual === 'it-IT' ? 'tubi' : 'tubos'} • ${(especs.eficiencia_optica * 100)}% ${textoEficiencia} • ~${formatarDecimal(especs.potencia_termica_kW, 2)} kW`;
        
        notaPainelReferencia.innerHTML = 
            '<span style="font-weight: 600; color: #2d9fa3ff;">' + textoBase + '</span>' +
            '<span style="color: #555;">' + nomeModelo + '</span>' +
            '<span style="color: #888; margin: 0 8px;">•</span>' +
            '<span style="color: #666; font-size: 0.9em;">' + textoEspecificacoes + '</span>' +
            '<span style="margin-left: 12px;">' +
            '<a href="' + linkRef.url + '" target="_blank" rel="noopener noreferrer" style="color: #2d9fa3ff; text-decoration: none; font-weight: 500; border-bottom: 1px solid #2d9fa3ff; transition: all 0.2s;">' +
            textoLink + linkRef.texto + '</a></span>';
    }
    
    // Calcular e exibir custos
    let custos;
    try {
        custos = calcularCustos(
            resultado.numeroPaineis, 
            resultado.areaColetor_m2, 
            resultado.volumeBoiler_L,
            areaCasa,
            alturaCasa,
            resultado.T_ambiente_inverno,
            classeEnergetica,
            incluirCasa
        );
        
        // Verificar se custos é válido
        if (!custos || typeof custos !== 'object') {
            console.error('Erro: custos calculados são inválidos:', custos);
            custos = {
                custoPaineis: 0,
                custoAcumuladores: 0,
                custoTubulacoes: 0,
                custoIsolantes: 0,
                custoTermossifoes: 0,
                custoTotal: 0,
                quantidadeTermossifoes: 0
            };
        }
    } catch (error) {
        console.error('Erro ao calcular custos:', error);
        custos = {
            custoPaineis: 0,
            custoAcumuladores: 0,
            custoTubulacoes: 0,
            custoIsolantes: 0,
            custoTermossifoes: 0,
            custoTotal: 0,
            quantidadeTermossifoes: 0
        };
    }
    
    // Obter símbolo de moeda baseado no idioma
    const simboloMoeda = idiomaAtual === 'it-IT' ? '€' : 'R$';
    const textoNaoNecessario = idiomaAtual === 'it-IT' ? ' (non necessario)' : ' (não necessário)';
    const textoUnidade = idiomaAtual === 'it-IT' ? 'unità' : 'unidade';
    const textoUnidades = idiomaAtual === 'it-IT' ? 'unità' : 'unidades';
    
    // Atualizar elementos de custo com verificações de segurança
    const elementoCustoPaineis = document.getElementById('custoPaineis');
    if (elementoCustoPaineis) elementoCustoPaineis.textContent = simboloMoeda + ' ' + formatarNumero(Math.round(custos.custoPaineis || 0));
    
    const elementoCustoAcumuladores = document.getElementById('custoAcumuladores');
    if (elementoCustoAcumuladores) elementoCustoAcumuladores.textContent = simboloMoeda + ' ' + formatarNumero(Math.round(custos.custoAcumuladores || 0));
    
    const elementoCustoTubulacoes = document.getElementById('custoTubulacoes');
    if (elementoCustoTubulacoes) elementoCustoTubulacoes.textContent = simboloMoeda + ' ' + formatarNumero(Math.round(custos.custoTubulacoes || 0));
    
    const elementoCustoIsolantes = document.getElementById('custoIsolantes');
    if (elementoCustoIsolantes) elementoCustoIsolantes.textContent = simboloMoeda + ' ' + formatarNumero(Math.round(custos.custoIsolantes || 0));
    
    // Exibir termossifões com detalhes se houver (na seção de custos)
    const elementoCustoTermossifoes = document.getElementById('custoTermossifoes');
    if (elementoCustoTermossifoes) {
        if (incluirCasa && custos.quantidadeTermossifoes > 0) {
            const textoUnidadeFinal = custos.quantidadeTermossifoes > 1 ? textoUnidades : textoUnidade;
            elementoCustoTermossifoes.textContent = `${simboloMoeda} ${formatarNumero(Math.round(custos.custoTermossifoes))} (${custos.quantidadeTermossifoes} ${textoUnidadeFinal})`;
            // Adicionar tooltip ou detalhes se necessário
            elementoCustoTermossifoes.title = custos.detalhesTermossifoes || '';
        } else {
            elementoCustoTermossifoes.textContent = simboloMoeda + ' 0' + textoNaoNecessario;
            elementoCustoTermossifoes.title = '';
        }
    }
    
    const elementoCustoTotal = document.getElementById('custoTotal');
    if (elementoCustoTotal) elementoCustoTotal.textContent = simboloMoeda + ' ' + formatarNumero(Math.round(custos.custoTotal || 0));
    
    // Atualizar memorial de cálculo
    if (typeof atualizarMemorialComValores === 'function') {
        atualizarMemorialComValores();
    }
}
// FUNÇÕES DO MEMORIAL DE CÁLCULO
// Alterna a exibição do memorial de cálculo
function toggleMemorial() {
    const memorialSection = document.getElementById('memorialSection');
    const resultadosSection = document.getElementById('resultadosSection');
    
    if (!memorialSection) {
        console.error('memorialSection não encontrado');
        return;
    }
    
    if (memorialSection.style.display === 'none' || memorialSection.style.display === '') {
        // Atualizar memorial com valores atuais
        atualizarMemorialComValores();
        memorialSection.style.display = 'block';
        if (resultadosSection) resultadosSection.style.display = 'none';
        // Não rolar - manter posição atual
    } else {
        memorialSection.style.display = 'none';
        if (resultadosSection) resultadosSection.style.display = 'block';
    }
}
// Atualiza o memorial de cálculo com os valores atuais dos cálculos
function atualizarMemorialComValores() {
    // Obter valores atuais
    const inputPessoas = document.getElementById('inputPessoas');
    const inputLatitude = document.getElementById('inputLatitude');
    const inputAltitude = document.getElementById('inputAltitude');
    const inputAreaCasa = document.getElementById('inputAreaCasa');
    const inputAlturaCasa = document.getElementById('inputAlturaCasa');
    const inputDiasAutonomia = document.getElementById('inputDiasAutonomia');
    
    const sliderPessoas = document.getElementById('sliderPessoas');
    const sliderLatitude = document.getElementById('sliderLatitude');
    const sliderAltitude = document.getElementById('sliderAltitude');
    const sliderAreaCasa = document.getElementById('sliderAreaCasa');
    const sliderAlturaCasa = document.getElementById('sliderAlturaCasa');
    const sliderDiasAutonomia = document.getElementById('sliderDiasAutonomia');
    
    // Lê valores dos inputs ou sliders
    let numeroPessoas = sliderPessoas ? parseInt(sliderPessoas.value) || 4 : 4;
    if (inputPessoas && inputPessoas.value && !isNaN(parseInt(inputPessoas.value))) {
        numeroPessoas = parseInt(inputPessoas.value);
    }
    
    let latitude = sliderLatitude ? parseFloat(sliderLatitude.value) || -23.5 : -23.5;
    if (inputLatitude && inputLatitude.value) {
        const valorConvertido = converterParaNumero(inputLatitude.value);
        if (!isNaN(valorConvertido)) {
            latitude = valorConvertido;
        }
    }
    
    let altitude = sliderAltitude ? parseFloat(sliderAltitude.value) || 0 : 0;
    if (inputAltitude && inputAltitude.value) {
        const valorConvertido = converterParaNumero(inputAltitude.value);
        if (!isNaN(valorConvertido)) {
            altitude = valorConvertido;
        }
    }
    
    let areaCasa = sliderAreaCasa ? parseFloat(sliderAreaCasa.value) || 100 : 100;
    if (inputAreaCasa && inputAreaCasa.value) {
        const valorConvertido = converterParaNumero(inputAreaCasa.value);
        if (!isNaN(valorConvertido) && valorConvertido > 0) {
            areaCasa = valorConvertido;
        }
    }
    
    let alturaCasa = parseFloat(sliderAlturaCasa.value) || 2.7;
    if (inputAlturaCasa && inputAlturaCasa.value) {
        const valorConvertido = converterParaNumero(inputAlturaCasa.value);
        if (!isNaN(valorConvertido) && valorConvertido > 0) {
            alturaCasa = valorConvertido;
        }
    }
    
    let diasAutonomia = parseInt(sliderDiasAutonomia.value) || 3;
    if (inputDiasAutonomia && inputDiasAutonomia.value && !isNaN(parseInt(inputDiasAutonomia.value))) {
        diasAutonomia = parseInt(inputDiasAutonomia.value);
    }
    
    // Obtém valores dos radio buttons e checkboxes
    const tipoUso = document.querySelector('input[name="tipoUso"]:checked')?.value || 'Padrao';
    // Usar modelo de referência baseado no idioma (não há mais seleção de modelo)
    const modeloRef = obterModeloReferencia();
    const classeEnergetica = document.querySelector('input[name="classeEnergetica"]:checked')?.value || 'D';
    const incluirAgua = document.getElementById('checkboxAgua')?.checked || false;
    const incluirCasa = document.getElementById('checkboxCasa')?.checked || false; // valores (modeloColetor não é mais usado, usa modelo de referência baseado no idioma)
    const resultado = calcularDimensionamento(numeroPessoas, tipoUso, latitude, altitude, null, areaCasa, alturaCasa, classeEnergetica, diasAutonomia, incluirAgua, incluirCasa);
    const textos = traducoes[idiomaAtual] || traducoes['pt-BR'];
    
    // Atualiza exemplos no memorial
    if (incluirAgua) {
        const dadosConsumo = MATRIZ_CONSUMO[tipoUso] || MATRIZ_CONSUMO["Padrao"];
        const consumoPorPessoa = dadosConsumo.consumo_por_pessoa;
        const T_desejada = dadosConsumo.T_desejada;
        const V_diario = numeroPessoas * consumoPorPessoa;
        const Delta_T_agua = T_desejada - resultado.T_agua_fria;
        const E_nec_Wh = V_diario * CONSTANTS.densidade_agua * CONSTANTS.calor_especifico_agua * Delta_T_agua;
        const E_nec_kWh_calc = E_nec_Wh / 1000.0;
        
        const exemploAgua = document.getElementById('memorial-exemplo-agua');
        if (exemploAgua) {
            exemploAgua.textContent = `${numeroPessoas} pessoas × ${formatarDecimal(consumoPorPessoa, 0)} L/pessoa = ${formatarDecimal(V_diario, 0)} L/dia, ΔT = ${formatarDecimal(Delta_T_agua, 1)}°C → ${formatarDecimal(V_diario, 0)} × 1.0 × 1.163 × ${formatarDecimal(Delta_T_agua, 1)} ÷ 1000 = ${formatarDecimal(E_nec_kWh_calc, 2)} kWh/dia`;
        }
        
        const exemploBoiler = document.getElementById('memorial-exemplo-boiler');
        if (exemploBoiler) {
            exemploBoiler.textContent = `${formatarDecimal(V_diario, 0)} L/dia × ${diasAutonomia} dias = ${formatarDecimal(resultado.volumeBoilerAgua_L, 0)} L`;
        }
    }
    
    // Atualizar exemplo do boiler para casa (se houver)
    const exemploBoilerCasa = document.getElementById('memorial-exemplo-boiler-casa');
    if (exemploBoilerCasa && incluirCasa && resultado.volumeBoilerCasa_L > 0) {
        const demandaTotalAutonomia = resultado.demandaCasa_kWh * diasAutonomia;
        const Delta_T_utilizavel = TEMPERATURA_ARMAZENAMENTO_INICIAL - TEMPERATURA_MINIMA_TERMOSSIFAO;
        const volumeTeorico = (demandaTotalAutonomia * 1000) / (CONSTANTS.calor_especifico_agua * Delta_T_utilizavel);
        const volumeUtil = resultado.volumeUtilBoiler_L || (resultado.volumeBoilerCasa_L * FATOR_ESTRATIFICACAO);
        
        exemploBoilerCasa.textContent = `${formatarDecimal(resultado.demandaCasa_kWh, 2)} kWh/dia × ${diasAutonomia} dias = ${formatarDecimal(demandaTotalAutonomia, 2)} kWh total → Volume teórico: ${formatarDecimal(volumeTeorico, 0)} L → Volume boiler: ${formatarDecimal(resultado.volumeBoilerCasa_L, 0)} L (volume útil: ${formatarDecimal(volumeUtil, 0)} L acima de ${TEMPERATURA_MINIMA_TERMOSSIFAO}°C)`;
    } else if (exemploBoilerCasa && (!incluirCasa || resultado.volumeBoilerCasa_L === 0)) {
        exemploBoilerCasa.textContent = '-';
    }
    
    if (incluirCasa) {
        // Calcular valores para o exemplo do memorial
        const consumoEspecifico = CONSUMO_ESPECIFICO_CLASSE[classeEnergetica] || CONSUMO_ESPECIFICO_CLASSE["D"];
        const alturaPadrao = 2.7;
        let fatorAltura = 1.0;
        if (alturaCasa > alturaPadrao) {
            const diferencaAltura = alturaCasa - alturaPadrao;
            fatorAltura = 1.0 + (diferencaAltura / 0.1) * 0.1;
        }
        const fracaoAquecimento = resultado.T_ambiente_inverno < 10 ? 0.70 : 0.60;
        const diasAquecimento = 150;
        
        // Calcular consumo anual e demanda diária
        const consumoAnualTotal = consumoEspecifico * areaCasa * fatorAltura;
        const consumoAnualAquecimento = consumoAnualTotal * fracaoAquecimento;
        const demandaDiaria_kWh = consumoAnualAquecimento / diasAquecimento;
        
        // Calcular potência necessária
        const potenciaTotal = resultado.potenciaCasa_W || 0;
        
        const exemploCasa = document.getElementById('memorial-exemplo-casa');
        if (exemploCasa) {
            const textoPotencia = idiomaAtual === 'it-IT' ? 'Potenza' : 'Potência';
            const textoDemanda = idiomaAtual === 'it-IT' ? 'Domanda' : 'Demanda';
            // Formatar potência: usar kW se >= 1000W
            const potenciaFormatada = formatarPotenciaWkW(potenciaTotal);
            exemploCasa.textContent = `Área: ${formatarDecimal(areaCasa, 0)} m², classe ${classeEnergetica} (${formatarDecimal(consumoEspecifico, 2)} kWh/m²·ano), fator altura: ${formatarDecimal(fatorAltura, 2)} → Consumo anual aquecimento: ${formatarDecimal(consumoAnualAquecimento, 2)} kWh/ano → ${textoDemanda} Diária: ${formatarDecimal(consumoAnualAquecimento, 2)} ÷ ${diasAquecimento} dias = ${formatarDecimal(demandaDiaria_kWh, 2)} kWh/dia → ${textoPotencia}: ${formatarDecimal(demandaDiaria_kWh, 2)} kWh/dia ÷ ${formatarDecimal(HORAS_AQUECIMENTO_POR_DIA, 0)}h × 1000 × 1.15 = ${potenciaFormatada}`;
        }
        
        // Atualizar exemplo de termossifões se disponível
        const exemploTermossifoes = document.getElementById('memorial-exemplo-termossifoes');
        const itemTermossifoes = document.getElementById('memorial-item-termossifoes');
        if (exemploTermossifoes && itemTermossifoes) {
            const calculoTermossifoes = calcularTermossifoes(areaCasa, alturaCasa, resultado.T_ambiente_inverno, classeEnergetica);
            if (calculoTermossifoes.ambientes && calculoTermossifoes.ambientes.length > 0) {
                itemTermossifoes.style.display = 'block';
                const detalhesAmbientes = calculoTermossifoes.ambientes.map(a => {
                    return `${a.quantidade}x ${a.termossifao.descricao} (${a.ambiente})`;
                }).join('; ');
                exemploTermossifoes.textContent = detalhesAmbientes;
            } else {
                itemTermossifoes.style.display = 'none';
            }
        }
    }
    
    const exemploEficiencia = document.getElementById('memorial-exemplo-eficiencia');
    if (exemploEficiencia) {
        const T_media_fluido = incluirAgua ? (resultado.T_agua_fria + 20) : resultado.T_ambiente_inverno;
        exemploEficiencia.textContent = `Temperatura média ${formatarDecimal(T_media_fluido, 1)}°C, ambiente ${formatarDecimal(resultado.T_ambiente_inverno, 1)}°C, irradiação 800 W/m² → eficiência ≈ ${formatarDecimal(resultado.eficienciaColetor, 0)}%`;
    }
    
    const exemploArea = document.getElementById('memorial-exemplo-area');
    if (exemploArea) {
        const energiaCapturadaPorM2 = resultado.H_g_diaria * (resultado.eficienciaColetor/100);
        let textoExemplo = '';
        
        // Obter dias de autonomia para o exemplo
        const sliderDiasAutonomia = document.getElementById('sliderDiasAutonomia');
        const diasAutonomia = sliderDiasAutonomia ? parseInt(sliderDiasAutonomia.value) || 3 : 3;
        
        if (incluirAgua && incluirCasa) {
            // Ambos selecionados: mostrar cálculo separado
            const demandaAgua = resultado.demandaEnergia_kWh || 0;
            const demandaCasaDiaria = resultado.demandaCasa_kWh || 0;
            const energiaAquecerBoiler = resultado.energiaAquecimentoBoiler_kWh || 0;
            const demandaCasaComAutonomia = demandaCasaDiaria * diasAutonomia;
            const energiaTotalCasa = energiaAquecerBoiler + demandaCasaComAutonomia;
            const areaAgua = resultado.areaAgua_m2 || 0;
            const areaCasa = resultado.areaCasa_m2 || 0;
            const fatorSeg = resultado.fatorSeguranca || 1.3;
            const eficienciaDecimal = resultado.eficienciaColetor / 100;
            
            textoExemplo = `Água: (${formatarDecimal(demandaAgua, 2)} kWh/dia × ${formatarDecimal(fatorSeg, 1)}) ÷ (${formatarDecimal(resultado.H_g_diaria, 1)} HSP × ${formatarDecimal(eficienciaDecimal, 2)}) = ${formatarDecimal(areaAgua, 2)} m²; `;
            textoExemplo += `Casa: (${formatarDecimal(energiaAquecerBoiler, 2)} kWh + ${formatarDecimal(demandaCasaDiaria, 2)} kWh/dia × ${diasAutonomia} dias) × ${formatarDecimal(fatorSeg, 1)} ÷ (${formatarDecimal(resultado.H_g_diaria, 1)} HSP × ${formatarDecimal(eficienciaDecimal, 2)}) = ${formatarDecimal(areaCasa, 2)} m²; `;
            textoExemplo += `Total: ${formatarDecimal(resultado.areaColetor_m2, 2)} m²`;
        } else if (incluirCasa) {
            // Apenas casa: mostrar cálculo com autonomia e energia para aquecer boiler
            const demandaCasaDiaria = resultado.demandaCasa_kWh || 0;
            const energiaAquecerBoiler = resultado.energiaAquecimentoBoiler_kWh || 0;
            const demandaCasaComAutonomia = demandaCasaDiaria * diasAutonomia;
            const energiaTotalCasa = energiaAquecerBoiler + demandaCasaComAutonomia;
            const fatorSeg = resultado.fatorSeguranca || 1.3;
            const eficienciaDecimal = resultado.eficienciaColetor / 100;
            
            textoExemplo = `(${formatarDecimal(energiaAquecerBoiler, 2)} kWh + ${formatarDecimal(demandaCasaDiaria, 2)} kWh/dia × ${diasAutonomia} dias) × ${formatarDecimal(fatorSeg, 1)} ÷ (${formatarDecimal(resultado.H_g_diaria, 1)} HSP × ${formatarDecimal(eficienciaDecimal, 2)}) = ${formatarDecimal(resultado.areaColetor_m2, 2)} m²`;
        } else {
            // Apenas água: cálculo normal
            const fatorSeg = resultado.fatorSeguranca || 1.3;
            const eficienciaDecimal = resultado.eficienciaColetor / 100;
            textoExemplo = `(${formatarDecimal(resultado.demandaTotal_kWh, 2)} kWh/dia × ${formatarDecimal(fatorSeg, 1)}) ÷ (${formatarDecimal(resultado.H_g_diaria, 1)} HSP × ${formatarDecimal(eficienciaDecimal, 2)}) = ${formatarDecimal(resultado.areaColetor_m2, 2)} m²`;
        }
        
        exemploArea.textContent = textoExemplo;
    }
    
    const exemploPaineis = document.getElementById('memorial-exemplo-paineis');
    if (exemploPaineis) {
        exemploPaineis.textContent = `${formatarDecimal(resultado.areaColetor_m2, 2)} m² ÷ ${formatarDecimal(resultado.areaPainel_m2, 2)} m²/painel = ${formatarDecimal(resultado.areaColetor_m2 / resultado.areaPainel_m2, 1)} → ${resultado.numeroPaineis} painéis`;
    }
    
    // Atualiza resumo calculado
    const resumoDemandaAgua = document.getElementById('resumo-demanda-agua');
    if (resumoDemandaAgua) resumoDemandaAgua.textContent = incluirAgua ? `${formatarDecimal(resultado.demandaEnergia_kWh, 2)} kWh/dia` : '-';
    
    const resumoDemandaCasa = document.getElementById('resumo-demanda-casa');
    if (resumoDemandaCasa) resumoDemandaCasa.textContent = incluirCasa ? `${formatarDecimal(resultado.demandaCasa_kWh, 2)} kWh/dia` : '-';
    
    const resumoAreaColetor = document.getElementById('resumo-area-coletor');
    if (resumoAreaColetor) resumoAreaColetor.textContent = formatarNumeroComSufixo(resultado.areaColetor_m2, 2) + ' m²';
    
    const resumoPaineis = document.getElementById('resumo-paineis');
    if (resumoPaineis) {
        const textoPainel = resultado.numeroPaineis === 1 ? (textos['unit-painel-singular'] || 'painel') : (textos['unit-painel-plural'] || 'paineis');
        resumoPaineis.textContent = `${resultado.numeroPaineis} ${textoPainel}`;
    }
    
    // Atualizar nota de referência do painel com formatação limpa
    const notaPainelReferencia = document.getElementById('notaPainelReferencia');
    if (notaPainelReferencia) {
        const modeloRef = obterModeloReferencia();
        const linkRef = modeloRef.link;
        const nomeModelo = modeloRef.nome;
        const especs = modeloRef.especificacoes;
        const textoBase = idiomaAtual === 'it-IT' 
            ? 'Modello di riferimento: ' 
            : 'Modelo de referência: ';
        const textoLink = idiomaAtual === 'it-IT' ? 'Vedi ' : 'Ver ';
        const textoEficiencia = idiomaAtual === 'it-IT' ? 'efficienza' : 'eficiência';
        const textoEspecificacoes = `${formatarDecimal(especs.area_m2, 2)} m² • ${especs.numero_tubos} ${idiomaAtual === 'it-IT' ? 'tubi' : 'tubos'} • ${(especs.eficiencia_optica * 100)}% ${textoEficiencia} • ~${formatarDecimal(especs.potencia_termica_kW, 2)} kW`;
        
        notaPainelReferencia.innerHTML = 
            '<span style="font-weight: 600; color: #2d9fa3ff;">' + textoBase + '</span>' +
            '<span style="color: #555;">' + nomeModelo + '</span>' +
            '<span style="color: #888; margin: 0 8px;">•</span>' +
            '<span style="color: #666; font-size: 0.9em;">' + textoEspecificacoes + '</span>' +
            '<span style="margin-left: 12px;">' +
            '<a href="' + linkRef.url + '" target="_blank" rel="noopener noreferrer" style="color: #2d9fa3ff; text-decoration: none; font-weight: 500; border-bottom: 1px solid #2d9fa3ff; transition: all 0.2s;">' +
            textoLink + linkRef.texto + '</a></span>';
    }
    
    const resumoVolumeBoiler = document.getElementById('resumo-volume-boiler');
    if (resumoVolumeBoiler) resumoVolumeBoiler.textContent = formatarNumeroComSufixo(Math.round(resultado.volumeBoiler_L), 0) + ' L';
}
// DICIONÁRIO DE TRADUÇÕES
const traducoes = {
    'pt-BR': {
        'dev-badge-header': '🚧 EM DESENVOLVIMENTO',
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
        'label-dias-autonomia': 'Dias de Autonomia',
        'dica-dias-autonomia': '💡 Número de dias sem sol que o sistema deve manter a casa aquecida',
        'unit-dias': 'dias',
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
        'nota-painel-referencia': '* Baseado no painel de referência: Coletor Solar Térmico com Tubos a Vácuo - 15 Tubos (1,5 m², eficiência 70%, ~1,05 kW)',
        'memorial-titulo': 'Memorial de Cálculo',
        'memorial-title': '📚 Memorial de Cálculo - Aquecedor Solar Térmico',
        'memorial-intro-title': '🎯 Objetivo do Dimensionamento',
        'memorial-intro-text': 'Este memorial explica passo a passo como é calculado o dimensionamento de um sistema de aquecimento solar térmico, incluindo área de coletores, volume do boiler, número de painéis e potência necessária para água de consumo e/ou aquecimento ambiente. As fórmulas e a lógica de cálculo foram validadas por testes automatizados.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcular Demanda de Energia para Água',
        'memorial-formula': 'Fórmula:',
        'memorial-passo1-explicacao': 'A energia necessária para aquecer a água é calculada usando a fórmula E = (V × ρ × c × ΔT) / 1000, onde V é o volume diário (L), ρ é a densidade da água (1 kg/L), c é o calor específico (1.163 Wh/kg°C) e ΔT é a diferença entre a temperatura desejada e a temperatura da água fria.',
        'memorial-example': 'Exemplo:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcular Potência e Demanda para Aquecimento da Casa',
        'memorial-passo2-explicacao': 'A potência necessária (em Watts) é calculada usando o método de dimensionamento de radiadores, considerando volume, classe energética e diferença de temperatura. Esta é a potência INSTANTÂNEA contínua necessária para manter a casa aquecida (compensar as perdas térmicas). A demanda diária (em kWh/dia) é usada para dimensionar os coletores solares e representa a energia total necessária por dia.',
        'memorial-passo3-title': '3️⃣ Passo 3: Dimensionar Volume do Boiler',
        'memorial-passo3-explicacao': 'O volume do boiler deve ser suficiente para armazenar água quente para os dias sem sol (autonomia).',
        'memorial-passo4-title': '4️⃣ Passo 4: Calcular Eficiência do Coletor',
        'memorial-passo4-explicacao': 'A eficiência do coletor é calculada usando a fórmula η = η₀ - (U × (T_media - T_ambiente) / I), onde η₀ é a eficiência óptica, U é o coeficiente de perda linear, T_media é a temperatura média do fluido, T_ambiente é a temperatura ambiente e I é a irradiação solar. Quanto maior a diferença de temperatura, menor a eficiência.',
        'memorial-passo5-title': '5️⃣ Passo 5: Calcular Área de Coletores',
        'memorial-passo5-explicacao': 'A área de coletores necessária depende da demanda total de energia, das horas de sol pico (HSP) disponíveis e da eficiência do coletor. Para aquecimento da casa, o sistema precisa captar em 1 dia energia suficiente para os dias de autonomia. A energia capturada por m² de painel é calculada considerando 1 hora de sol pico (1000 W/m²) multiplicada pelo número de horas de sol pico do dia.',
        'memorial-passo6-title': '6️⃣ Passo 6: Calcular Número de Painéis',
        'memorial-passo6-explicacao': 'O número de painéis é calculado dividindo a área total necessária pela área de cada painel, arredondando para cima.',
        'memorial-passo7-title': '7️⃣ Passo 7: Dimensionar Termossifões por Ambiente',
        'memorial-passo7-explicacao': 'Os termossifões são dimensionados individualmente para cada ambiente da casa, garantindo aquecimento adequado em todos os cômodos.',
        'memorial-resumo-title': '📊 Resumo Calculado',
        'memorial-resumo-demanda-agua': 'Demanda Água:',
        'memorial-resumo-demanda-casa': 'Demanda Casa:',
        'memorial-resumo-area-coletor': 'Área Coletor:',
        'memorial-resumo-paineis': 'Número de Painéis:',
        'memorial-resumo-volume-boiler': 'Volume Boiler:',
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
        'resultado-demanda-agua': 'Demanda Aquecimento Água:',
        'resultado-demanda-casa': 'Demanda Aquecimento Casa:',
        'resultado-volume-boiler': 'Volume do Boiler:',
        'resultado-potencia-casa': 'Potência Necessária para Aquecimento:',
        'dica-potencia-casa': '💡 Potência INSTANTÂNEA contínua necessária para compensar as perdas térmicas da casa toda durante as horas de aquecimento (16h/dia). Esta é a potência total que os termossifões devem fornecer em conjunto.',
        'resultado-termossifoes': 'Termossifões Necessários:',
        'info-recomendacoes': '💡 Recomendações de Instalação:',
        'rec-altura': 'O fundo do boiler deve estar a pelo menos 0,20 m acima do topo dos coletores',
        'rec-orientacao': 'Orientar coletores para o Norte geográfico (azimute 0°)',
        'rec-orientacao-italia': 'Orientare i collettori verso il Sud geografico (azimut 180°)',
        'rec-inclinacao': 'Inclinação recomendada: Latitude + 10° a 15°',
        'rec-inclinacao-italia': 'Inclinazione raccomandata: |Latitude| + 10° a 15°',
        'rec-tubulacao': 'Usar tubulação curta (máx. 8-10 m) e diâmetro de 25mm (1")',
        'memorial-titulo': 'Memorial de Cálculo',
        'footer': 'Dimensionador de Aquecedor Solar - Engenharia Nata @ 2025',
        'aria-home': 'Voltar para a tela inicial',
        'custos-title': '💰 Estimativa de Custos',
        'custo-paineis': 'Custo dos Painéis:',
        'custo-acumuladores': 'Custo dos Acumuladores (Boiler):',
        'custo-tubulacoes': 'Tubulações e Conexões:',
        'custo-isolantes': 'Isolantes Térmicos:',
        'custo-termossifoes': 'Termossifões:',
        'custo-total': 'Custo Total Estimado:',
        'custos-detalhamento': 'Detalhamento:',
        'nota-custos': '* Valores aproximados baseados em preços médios do mercado. Podem variar conforme região e fornecedor.',
        'watermark-dev': '🚧 EM DESENVOLVIMENTO',
        'learn-more': 'SAIBA MAIS!',
        'back': '← Voltar',
        'btn-memorial': 'Ver Memorial de Cálculo',
        'tooltip-pessoas-texto': 'O número de pessoas determina o consumo diário de água quente. O consumo por pessoa varia conforme o padrão selecionado (Econômico: 30L/dia, Padrão: 40L/dia, Alto: 60L/dia). Este valor é usado para calcular o volume necessário do boiler e a área de coletores solares.',
        'tooltip-consumo-texto': 'O padrão de consumo define quantos litros de água quente cada pessoa utiliza por dia. Econômico (30L/pessoa/dia): uso moderado, ideal para quem economiza água. Padrão (40L/pessoa/dia): uso médio residencial. Alto (60L/pessoa/dia): uso intensivo, para residências com banhos longos ou múltiplos banhos por dia.',
        'tooltip-latitude-texto': 'A latitude é a coordenada geográfica que indica a distância do local em relação ao Equador, medida em graus. Valores negativos indicam hemisfério sul (Brasil: -35° a -5°), valores positivos indicam hemisfério norte (Itália: 36° a 47°). A latitude afeta a intensidade e duração da radiação solar, influenciando diretamente o dimensionamento dos coletores solares.',
        'tooltip-altitude-texto': 'A altitude é a elevação do local de instalação em relação ao nível do mar, medida em metros. Locais em maior altitude têm menor pressão atmosférica e menor temperatura média, o que pode reduzir ligeiramente a eficiência dos coletores solares. A altitude também afeta o ponto de ebulição da água, importante para sistemas de aquecimento.',
        'tooltip-area-casa-texto': 'A área da casa é a área total construída em metros quadrados (m²) que será aquecida pelo sistema solar térmico. Este valor é usado para calcular a demanda de energia térmica necessária para aquecer o ambiente, considerando a classe energética da construção e as perdas térmicas através de paredes, teto e janelas.',
        'tooltip-altura-casa-texto': 'A altura do pé direito é a distância do piso ao teto, medida em metros. Ambientes mais altos têm maior volume de ar para aquecer, aumentando a demanda de energia térmica. O cálculo considera o volume total (área × altura) para determinar a potência necessária do sistema de aquecimento ambiente. Altura padrão residencial: 2,7m.',
        'tooltip-autonomia-texto': 'Os dias de autonomia representam quantos dias consecutivos sem sol o sistema deve ser capaz de manter a casa aquecida usando apenas a energia armazenada no boiler. Valores maiores aumentam o volume necessário do boiler e a área de coletores, garantindo maior segurança em períodos de baixa insolação, mas também aumentam o custo do sistema.'
    },
    'it-IT': {
        'dev-badge-header': '🚧 IN SVILUPPO',
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
        'nota-painel-referencia': '* Basato sul pannello di riferimento: Collettore Solare Termico con Tubi Sotto Vuoto - 15 Tubi (1,5 m², efficienza 70%, ~1,05 kW)',
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
        'resultado-demanda-agua': 'Domanda Riscaldamento Acqua:',
        'resultado-demanda-casa': 'Domanda Riscaldamento Casa:',
        'resultado-volume-boiler': 'Volume Boiler:',
        'resultado-potencia-casa': 'Potenza Necessaria per Riscaldamento:',
        'dica-potencia-casa': '💡 Potenza ISTANTANEA continua necessaria per compensare le perdite termiche dell\'intera casa durante le ore di riscaldamento (16h/giorno). Questa è la potenza totale che i termosifoni devono fornire insieme.',
        'resultado-termossifoes': 'Termosifoni Necessari:',
        'info-recomendacoes': '💡 Raccomandazioni di Installazione:',
        'rec-altura': 'Il fondo del boiler deve essere almeno 0,20 m sopra la parte superiore dei collettori',
        'rec-orientacao': 'Orientare i collettori verso il Nord geografico (azimut 0°)',
        'rec-orientacao-italia': 'Orientare i collettori verso il Sud geografico (azimut 180°)',
        'rec-inclinacao': 'Inclinazione raccomandata: Latitudine + 10° a 15°',
        'rec-inclinacao-italia': 'Inclinazione raccomandata: |Latitudine| + 10° a 15°',
        'rec-tubulacao': 'Usare tubazione corta (max. 8-10 m) e diametro di 25mm (1")',
        'memorial-titulo': 'Memoriale di Calcolo',
        'footer': 'Dimensionatore Riscaldatore Solare - Engenharia Nata @ 2025',
        'aria-home': 'Torna alla schermata iniziale',
        'watermark-dev': '🚧 IN SVILUPPO',
        'learn-more': 'SCOPRI DI PIÙ!',
        'back': '← Indietro',
        'btn-memorial': 'Vedi Memoriale di Calcolo',
        'memorial-title': '📚 Memoriale di Calcolo - Riscaldatore Solare Termico',
        'memorial-intro-title': '🎯 Obiettivo del Dimensionamento',
        'memorial-intro-text': 'Questo memoriale spiega passo dopo passo come viene calcolato il dimensionamento di un sistema di riscaldamento solare termico, inclusa l\'area dei collettori, il volume del boiler, il numero di pannelli e la potenza necessaria per acqua di consumo e/o riscaldamento ambiente. Le formule e la logica di calcolo sono state validate da test automatizzati.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcolare Domanda di Energia per Acqua',
        'memorial-formula': 'Formula:',
        'memorial-passo1-explicacao': 'L\'energia necessaria per riscaldare l\'acqua viene calcolata utilizzando la formula E = (V × ρ × c × ΔT) / 1000, dove V è il volume giornaliero (L), ρ è la densità dell\'acqua (1 kg/L), c è il calore specifico (1.163 Wh/kg°C) e ΔT è la differenza tra la temperatura desiderata e la temperatura dell\'acqua fredda.',
        'memorial-example': 'Esempio:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcolare Potenza e Domanda per Riscaldamento Casa',
        'memorial-passo2-explicacao': 'La potenza necessaria (in Watt) è calcolata usando il metodo di dimensionamento dei radiatori, considerando volume, classe energetica e differenza di temperatura. Questa è la potenza ISTANTANEA continua necessaria per mantenere la casa riscaldata (compensare le perdite termiche). La domanda giornaliera (in kWh/giorno) è usata per dimensionare i collettori solari e rappresenta l\'energia totale necessaria per giorno.',
        'memorial-passo3-title': '3️⃣ Passo 3: Dimensionare Volume Boiler',
        'memorial-passo3-explicacao': 'Il volume del boiler deve essere sufficiente per immagazzinare acqua calda per i giorni senza sole (autonomia).',
        'memorial-passo4-title': '4️⃣ Passo 4: Calcolare Efficienza Collettore',
        'memorial-passo4-explicacao': 'L\'efficienza del collettore viene calcolata utilizzando la formula η = η₀ - (U × (T_media - T_ambiente) / I), dove η₀ è l\'efficienza ottica, U è il coefficiente di perdita lineare, T_media è la temperatura media del fluido, T_ambiente è la temperatura ambiente e I è l\'irradiazione solare. Maggiore è la differenza di temperatura, minore è l\'efficienza.',
        'memorial-passo5-title': '5️⃣ Passo 5: Calcolare Area Collettori',
        'memorial-passo5-explicacao': 'L\'area dei collettori necessaria dipende dalla domanda totale di energia, dalle ore di sole di picco (HSP) disponibili e dall\'efficienza del collettore. Per il riscaldamento della casa, il sistema deve catturare in 1 giorno energia sufficiente per i giorni di autonomia (es: se autonomia = 5 giorni, deve catturare in 1 giorno energia per 5 giorni e notti). L\'energia catturata per m² di pannello è calcolata considerando 1 ora di sole di picco (1000 W/m²) moltiplicata per il numero di ore di sole di picco del giorno.',
        'memorial-passo6-title': '6️⃣ Passo 6: Calcolare Numero Pannelli',
        'memorial-passo6-explicacao': 'Il numero di pannelli viene calcolato dividendo l\'area totale necessaria per l\'area di ciascun pannello, arrotondando per eccesso.',
        'memorial-passo7-title': '7️⃣ Passo 7: Dimensionare Termosifoni per Ambiente',
        'memorial-passo7-explicacao': 'I termosifoni vengono dimensionati individualmente per ogni ambiente della casa, garantendo un riscaldamento adeguato in tutte le stanze.',
        'memorial-resumo-title': '📊 Riepilogo Calcolato',
        'memorial-resumo-demanda-agua': 'Domanda Acqua:',
        'memorial-resumo-demanda-casa': 'Domanda Casa:',
        'memorial-resumo-area-coletor': 'Area Collettore:',
        'memorial-resumo-paineis': 'Numero Pannelli:',
        'memorial-resumo-volume-boiler': 'Volume Boiler:',
        'custos-title': '💰 Stima dei Costi',
        'custo-paineis': 'Costo Pannelli:',
        'custo-acumuladores': 'Costo Accumulatori (Boiler):',
        'custo-tubulacoes': 'Tubazioni e Connessioni:',
        'custo-isolantes': 'Isolanti Termici:',
        'custo-termossifoes': 'Termosifoni:',
        'custo-total': 'Costo Totale Stimato:',
        'custos-detalhamento': 'Dettaglio:',
        'nota-custos': '* Valori approssimativi basati su prezzi medi di mercato. Possono variare in base alla regione e al fornitore.',
        'tooltip-pessoas-texto': 'Il numero di persone determina il consumo giornaliero di acqua calda. Il consumo per persona varia in base allo standard selezionato (Economico: 30L/giorno, Standard: 40L/giorno, Alto: 60L/giorno). Questo valore viene utilizzato per calcolare il volume necessario del boiler e l\'area dei collettori solari.',
        'tooltip-consumo-texto': 'Lo standard di consumo definisce quanti litri di acqua calda ogni persona utilizza al giorno. Economico (30L/persona/giorno): uso moderato, ideale per chi risparmia acqua. Standard (40L/persona/giorno): uso medio residenziale. Alto (60L/persona/giorno): uso intensivo, per residenze con bagni lunghi o più bagni al giorno.',
        'tooltip-latitude-texto': 'La latitudine è la coordinata geografica che indica la distanza del luogo rispetto all\'Equatore, misurata in gradi. Valori negativi indicano emisfero sud (Brasile: -35° a -5°), valori positivi indicano emisfero nord (Italia: 36° a 47°). La latitudine influisce sull\'intensità e durata della radiazione solare, influenzando direttamente il dimensionamento dei collettori solari.',
        'tooltip-altitude-texto': 'L\'altitudine è l\'elevazione del luogo di installazione rispetto al livello del mare, misurata in metri. Luoghi a maggiore altitudine hanno minore pressione atmosferica e temperatura media più bassa, il che può ridurre leggermente l\'efficienza dei collettori solari. L\'altitudine influisce anche sul punto di ebollizione dell\'acqua, importante per i sistemi di riscaldamento.',
        'tooltip-area-casa-texto': 'L\'area della casa è l\'area totale costruita in metri quadrati (m²) che sarà riscaldata dal sistema solare termico. Questo valore viene utilizzato per calcolare la domanda di energia termica necessaria per riscaldare l\'ambiente, considerando la classe energetica della costruzione e le perdite termiche attraverso pareti, tetto e finestre.',
        'tooltip-altura-casa-texto': 'L\'altezza del soffitto è la distanza dal pavimento al soffitto, misurata in metri. Ambienti più alti hanno un volume d\'aria maggiore da riscaldare, aumentando la domanda di energia termica. Il calcolo considera il volume totale (area × altezza) per determinare la potenza necessaria del sistema di riscaldamento ambiente. Altezza standard residenziale: 2,7m.',
        'tooltip-autonomia-texto': 'I giorni di autonomia rappresentano quanti giorni consecutivi senza sole il sistema deve essere in grado di mantenere la casa riscaldata utilizzando solo l\'energia immagazzinata nel boiler. Valori maggiori aumentano il volume necessario del boiler e l\'area dei collettori, garantendo maggiore sicurezza in periodi di bassa insolazione, ma aumentano anche il costo del sistema.'
    }
};
// FUNÇÃO DE TRADUÇÃO
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
// FUNÇÃO: TROCAR IDIOMA
function trocarIdioma(novoIdioma) {
    idiomaAtual = novoIdioma;
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    document.documentElement.lang = novoIdioma;
    
    // Atualizar botões de idioma (ativação visual)
    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(btn => {
        if (btn.getAttribute('data-lang') === novoIdioma) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    atualizarLimitesLatitude();
    traduzir();
    atualizarResultados();
    
    // Atualiza aria-label do botão home
    const homeLabel = traducoes[novoIdioma]?.['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
}
// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    // Configurar seletor de idioma
    document.getElementById('btnPortugues')?.addEventListener('click', () => trocarIdioma('pt-BR'));
    document.getElementById('btnItaliano')?.addEventListener('click', () => trocarIdioma('it-IT'));
    
    // Inicializar idioma
    trocarIdioma(idiomaAtual);
    
    // Inicializar ícones de informação
    if (typeof inicializarIconeInfo === 'function') {
        inicializarIconeInfo('infoIconPessoas', 'descricaoPessoas');
        inicializarIconeInfo('infoIconConsumo', 'descricaoConsumo');
        inicializarIconeInfo('infoIconLatitude', 'descricaoLatitude');
        inicializarIconeInfo('infoIconAltitude', 'descricaoAltitude');
        inicializarIconeInfo('infoIconAreaCasa', 'descricaoAreaCasa');
        inicializarIconeInfo('infoIconAlturaCasa', 'descricaoAlturaCasa');
        inicializarIconeInfo('infoIconAutonomia', 'descricaoAutonomia');
    }

    // Configurar sliders e inputs
    const sliderPessoas = document.getElementById('sliderPessoas');
    const sliderLatitude = document.getElementById('sliderLatitude');
    const sliderAltitude = document.getElementById('sliderAltitude');
    const sliderAreaCasa = document.getElementById('sliderAreaCasa');
    const sliderAlturaCasa = document.getElementById('sliderAlturaCasa');
    
    // Aplica throttle reduzido nos sliders para melhor responsividade (50ms)
    if (sliderPessoas) {
    sliderPessoas.addEventListener('input', throttle(() => {
        const valor = parseInt(sliderPessoas.value);
        const inputPessoas = document.getElementById('inputPessoas');
        if (inputPessoas) {
            inputPessoas.value = valor;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPessoas);
        }
        atualizarResultados();
    }, 50)); // Reduzido de 100ms para 50ms
    }
    
    if (sliderLatitude) {
    sliderLatitude.addEventListener('input', throttle(() => {
        const valor = parseFloat(sliderLatitude.value);
        const inputLatitude = document.getElementById('inputLatitude');
        if (inputLatitude) {
            // Formata com vírgula usando formatarDecimal
            inputLatitude.value = formatarDecimal(valor, 1);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputLatitude);
        }
        atualizarResultados();
    }, 50)); // Reduzido de 100ms para 50ms
    }
    
    if (sliderAltitude) {
    sliderAltitude.addEventListener('input', throttle(() => {
        const valor = parseFloat(sliderAltitude.value);
        const inputAltitude = document.getElementById('inputAltitude');
        if (inputAltitude) {
            inputAltitude.value = Math.round(valor);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAltitude);
        }
        atualizarResultados();
    }, 50)); // Reduzido de 100ms para 50ms
    }
    
    if (sliderAreaCasa) {
    sliderAreaCasa.addEventListener('input', throttle(() => {
        const valor = parseFloat(sliderAreaCasa.value);
        const inputAreaCasa = document.getElementById('inputAreaCasa');
        if (inputAreaCasa) {
            inputAreaCasa.value = Math.round(valor);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAreaCasa);
        }
        atualizarResultados();
    }, 50)); // Reduzido de 100ms para 50ms
    }
    
    if (sliderAlturaCasa) {
    sliderAlturaCasa.addEventListener('input', throttle(() => {
        const valor = parseFloat(sliderAlturaCasa.value);
        const inputAlturaCasa = document.getElementById('inputAlturaCasa');
        if (inputAlturaCasa) {
            // Formata com vírgula usando formatarDecimal
            inputAlturaCasa.value = formatarDecimal(valor, 1);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAlturaCasa);
        }
        atualizarResultados();
    }, 100));
    }
    
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
            const valor = converterParaNumero(inputAreaCasa.value);
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
    
    // Função para mostrar/ocultar campos de entrada baseado nos sistemas selecionados
    function atualizarVisibilidadeCamposCasa() {
        const checkboxAgua = document.getElementById('checkboxAgua');
        const checkboxCasa = document.getElementById('checkboxCasa');
        const incluirAgua = checkboxAgua ? checkboxAgua.checked : false;
        const incluirCasa = checkboxCasa ? checkboxCasa.checked : false;
        
        // Encontrar todos os grupos de entrada
        const grupoPessoas = document.getElementById('sliderPessoas')?.closest('.grupo-entrada');
        const grupoTipoUso = document.querySelector('.grupo-entrada:has(input[name="tipoUso"])');
        const secaoTituloCasa = document.querySelector('.grupo-entrada:has([data-i18n="secao-aquecimento-casa"])');
        const grupoAreaCasa = document.getElementById('sliderAreaCasa')?.closest('.grupo-entrada');
        const grupoAlturaCasa = document.getElementById('sliderAlturaCasa')?.closest('.grupo-entrada');
        const grupoDiasAutonomia = document.getElementById('sliderDiasAutonomia')?.closest('.grupo-entrada');
        const grupoClasseEnergetica = document.querySelector('.grupo-entrada:has(input[name="classeEnergetica"])');
        const grupoLatitude = document.getElementById('sliderLatitude')?.closest('.grupo-entrada');
        const grupoAltitude = document.getElementById('sliderAltitude')?.closest('.grupo-entrada');
        
        // Se nenhum sistema estiver selecionado, ocultar todos os campos
        if (!incluirAgua && !incluirCasa) {
            // Ocultar campos relacionados à água
            if (grupoPessoas) grupoPessoas.style.display = 'none';
            if (grupoTipoUso) grupoTipoUso.style.display = 'none';
            
            // Ocultar campos relacionados à casa
            if (secaoTituloCasa) secaoTituloCasa.style.display = 'none';
            if (grupoAreaCasa) grupoAreaCasa.style.display = 'none';
            if (grupoAlturaCasa) grupoAlturaCasa.style.display = 'none';
            if (grupoDiasAutonomia) grupoDiasAutonomia.style.display = 'none';
            if (grupoClasseEnergetica) grupoClasseEnergetica.style.display = 'none';
            
            // Ocultar campos comuns (latitude, altitude)
            if (grupoLatitude) grupoLatitude.style.display = 'none';
            if (grupoAltitude) grupoAltitude.style.display = 'none';
            
            return; // Sair da função, não mostrar nada
        }
        
        // Mostrar campos comuns sempre que pelo menos um sistema estiver selecionado
        if (grupoLatitude) grupoLatitude.style.display = 'block';
        if (grupoAltitude) grupoAltitude.style.display = 'block';
        
        // Mostrar/ocultar campos relacionados à ÁGUA (apenas se checkboxAgua estiver marcado)
        if (grupoPessoas) grupoPessoas.style.display = incluirAgua ? 'block' : 'none';
        if (grupoTipoUso) grupoTipoUso.style.display = incluirAgua ? 'block' : 'none';
        
        // Mostrar/ocultar campos relacionados à CASA (apenas se checkboxCasa estiver marcado)
        if (secaoTituloCasa) secaoTituloCasa.style.display = incluirCasa ? 'block' : 'none';
        if (grupoAreaCasa) grupoAreaCasa.style.display = incluirCasa ? 'block' : 'none';
        if (grupoAlturaCasa) grupoAlturaCasa.style.display = incluirCasa ? 'block' : 'none';
        if (grupoDiasAutonomia) grupoDiasAutonomia.style.display = incluirCasa ? 'block' : 'none';
        if (grupoClasseEnergetica) grupoClasseEnergetica.style.display = incluirCasa ? 'block' : 'none';
    }
    
    // Chamar na inicialização
    atualizarVisibilidadeCamposCasa();
    
    // Modelo B é fixo (único modelo de referência), não precisa de listener
    
    // Configurar botões de seta - usa função global com aceleração exponencial
    if (typeof configurarBotoesSliderComAceleracao === 'function') {
        // Usa função de ajuste local que atualiza inputs correspondentes
        function ajustarValorAquecimento(targetId, step) {
            ajustarValor(targetId, step);
        }
        configurarBotoesSliderComAceleracao(SITE_SEL.ARROW_BTN, ajustarValorAquecimento);
    } else {
        // Fallback para código antigo se a função global não estiver disponível
        document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
            const targetId = btn.getAttribute('data-target');
            const step = parseFloat(btn.getAttribute('data-step'));
            btn.addEventListener('click', () => ajustarValor(targetId, step));
        });
    }
    
    // Função auxiliar para ajustar valor do slider
    function ajustarValor(targetId, step) {
    ajustarValorPadrao(targetId, step);
    }
    
    // Formatar valor inicial da latitude com vírgula
    const inputLatitudeInicial = document.getElementById('inputLatitude');
    if (inputLatitudeInicial) {
        const valorInicial = converterParaNumero(inputLatitudeInicial.value);
        if (!isNaN(valorInicial)) {
            inputLatitudeInicial.value = formatarDecimal(valorInicial, 1);
        }
    }
    
    // Configurar memorial de cálculo
    const btnMemorial = document.getElementById('btnMemorial');
    const btnFecharMemorial = document.getElementById('btnFecharMemorial');
    const btnVoltarMemorial = document.querySelectorAll('.btn-voltar-memorial');
    
    if (btnMemorial) {
        btnMemorial.addEventListener('click', toggleMemorial);
    }
    
    if (btnFecharMemorial) {
        btnFecharMemorial.addEventListener('click', toggleMemorial);
    }
    
    btnVoltarMemorial.forEach(btn => {
        btn.addEventListener('click', toggleMemorial);
    });
    
    // Ajustar tamanho inicial de todos os inputs
    if (typeof ajustarTamanhoInput === 'function') {
        const inputPessoas = document.getElementById('inputPessoas');
        const inputLatitude = document.getElementById('inputLatitude');
        const inputAltitude = document.getElementById('inputAltitude');
        const inputAreaCasa = document.getElementById('inputAreaCasa');
        const inputAlturaCasa = document.getElementById('inputAlturaCasa');
        const inputDiasAutonomia = document.getElementById('inputDiasAutonomia');
        if (inputPessoas) ajustarTamanhoInput(inputPessoas);
        if (inputLatitude) ajustarTamanhoInput(inputLatitude);
        if (inputAltitude) ajustarTamanhoInput(inputAltitude);
        if (inputAreaCasa) ajustarTamanhoInput(inputAreaCasa);
        if (inputAlturaCasa) ajustarTamanhoInput(inputAlturaCasa);
        if (inputDiasAutonomia) ajustarTamanhoInput(inputDiasAutonomia);
    }
    
    // Calcular resultados iniciais
    // Aguardar um pouco para garantir que todos os elementos estão carregados
    setTimeout(() => {
        // Garantir que a visibilidade dos campos está correta
        atualizarVisibilidadeCamposCasa();
        atualizarResultados();
    }, 100);
});

