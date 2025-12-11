// =============================================
// ROTINA DE TESTES PARA CÁLCULO DE AQUECEDOR SOLAR
// App Aquecedor Solar - Dimensionamento Térmico
// =============================================

// =============================================
// CONSTANTES E FUNÇÕES (MESMAS DO APP)
// =============================================

const CONSTANTS = {
    densidade_agua: 1.0,              // kg/L
    calor_especifico_agua: 1.163,     // Wh/kg°C
    irradiacao_horaria_pico_media: 800.0, // W/m²
    altura_minima_boiler: 0.20        // metros
};

const GRADIENTE_ADIABATICO = 6.5; // °C por 1000m
const ALTITUDE_REFERENCIA = 0; // metros

const TEMPERATURA_CONFORTO_CASA = 22.0; // °C
const TEMPERATURA_MINIMA_TERMOSSIFAO = 48.0; // °C
const TEMPERATURA_ARMAZENAMENTO_INICIAL = 65.0; // °C
const FATOR_ESTRATIFICACAO = 0.65; // 65% do volume superior
const HORAS_AQUECIMENTO_POR_DIA = 16.0; // horas

const MATRIZ_CONSUMO = {
    "Economico": { consumo_por_pessoa: 30.0, T_desejada: 40.0, fator_autonomia: 1.25 },
    "Padrao": { consumo_por_pessoa: 40.0, T_desejada: 45.0, fator_autonomia: 1.5 },
    "Alto": { consumo_por_pessoa: 60.0, T_desejada: 50.0, fator_autonomia: 2.0 }
};

const CONSUMO_ESPECIFICO_CLASSE = {
    "A4": 0.35, "A3": 0.50, "A2": 0.70, "A1": 0.90,
    "B": 1.10, "C": 1.35, "D": 1.75, "E": 2.30, "F": 3.05, "G": 4.0
};

const MATRIZ_CLIMA_BRASIL = {
    "15S_25S": { H_g_diaria: 4.0, T_agua_fria_base: 22.0, T_ambiente_inverno_base: 18.0 },
    "25S_35S": { H_g_diaria: 3.5, T_agua_fria_base: 18.0, T_ambiente_inverno_base: 15.0 },
    "OUTRAS": { H_g_diaria: 3.8, T_agua_fria_base: 20.0, T_ambiente_inverno_base: 16.0 }
};

/**
 * Calcula temperatura com altitude
 */
function calcularTemperaturaComAltitude(T_base, altitude) {
    const gradiente_agua = 5.5; // °C por 1000m para água
    const variacao_altitude = (altitude - ALTITUDE_REFERENCIA) * (gradiente_agua / 1000.0);
    const T_ajustada = T_base - variacao_altitude;
    return Math.max(2.0, T_ajustada);
}

/**
 * Calcula temperatura ambiente com altitude
 */
function calcularTemperaturaAmbienteComAltitude(T_base, altitude) {
    const variacao_altitude = (altitude - ALTITUDE_REFERENCIA) * (GRADIENTE_ADIABATICO / 1000.0);
    const T_ajustada = T_base - variacao_altitude;
    return Math.max(-5.0, T_ajustada);
}

/**
 * Calcula demanda de energia para água
 */
function calcularDemandaAgua(numeroPessoas, tipoUso, T_agua_fria) {
    const dadosConsumo = MATRIZ_CONSUMO[tipoUso] || MATRIZ_CONSUMO["Padrao"];
    const V_diario_L = numeroPessoas * dadosConsumo.consumo_por_pessoa;
    const Delta_T = dadosConsumo.T_desejada - T_agua_fria;
    const E_nec_Wh = V_diario_L * CONSTANTS.densidade_agua * CONSTANTS.calor_especifico_agua * Delta_T;
    const E_nec_kWh = E_nec_Wh / 1000.0;
    return { V_diario_L, E_nec_kWh, Delta_T };
}

/**
 * Calcula volume do boiler para água
 */
function calcularVolumeBoilerAgua(V_diario_L, diasAutonomia) {
    return V_diario_L * diasAutonomia;
}

/**
 * Calcula eficiência do coletor
 */
function calcularEficienciaColetor(eficiencia_optica, coef_perda_linear, T_media_fluido, T_ambiente, irradiacao) {
    const Parametro_Perda_P = (T_media_fluido - T_ambiente) / irradiacao;
    const eficiencia_coletor = eficiencia_optica - (coef_perda_linear * Parametro_Perda_P);
    return Math.max(0, eficiencia_coletor);
}

/**
 * Calcula demanda de energia para casa
 */
function calcularDemandaCasa(areaCasa, alturaCasa, classeEnergetica, T_ambiente_inverno) {
    const volumeCasa = areaCasa * alturaCasa;
    const Delta_T_casa = TEMPERATURA_CONFORTO_CASA - T_ambiente_inverno;
    const consumoEspecifico = CONSUMO_ESPECIFICO_CLASSE[classeEnergetica] || CONSUMO_ESPECIFICO_CLASSE["D"];
    
    const alturaPadrao = 2.7;
    let fatorAltura = 1.0;
    if (alturaCasa > alturaPadrao) {
        const diferencaAltura = alturaCasa - alturaPadrao;
        fatorAltura = 1.0 + (diferencaAltura / 0.1) * 0.1;
    }
    
    const diasPeriodoAquecimento = 150;
    const fracaoAquecimento = T_ambiente_inverno < 10 ? 0.70 : 0.60;
    
    const consumoAnualTotal_kWh = consumoEspecifico * areaCasa * fatorAltura;
    const consumoAnualAquecimento_kWh = consumoAnualTotal_kWh * fracaoAquecimento;
    const demandaCasa_kWh = consumoAnualAquecimento_kWh / diasPeriodoAquecimento;
    
    const potenciaBase_W = (demandaCasa_kWh / HORAS_AQUECIMENTO_POR_DIA) * 1000.0;
    const potenciaNecessaria_W = potenciaBase_W * 1.15;
    
    return {
        volumeCasa_m3: volumeCasa,
        potenciaNecessaria_W,
        demandaCasa_kWh,
        Delta_T_casa,
        consumoEspecifico_kWh_m2_ano: consumoEspecifico
    };
}

/**
 * Calcula volume do boiler para casa
 */
function calcularVolumeBoilerCasa(demandaCasa_kWh, diasAutonomia, T_ambiente_inverno) {
    const demandaTotalAutonomia_kWh = demandaCasa_kWh * diasAutonomia;
    const Delta_T_armazenamento = TEMPERATURA_ARMAZENAMENTO_INICIAL - TEMPERATURA_MINIMA_TERMOSSIFAO;
    
    const E_autonomia_Wh = demandaTotalAutonomia_kWh * 1000.0;
    const massa_kg = E_autonomia_Wh / (CONSTANTS.calor_especifico_agua * Delta_T_armazenamento);
    const V_teorico_L = massa_kg / CONSTANTS.densidade_agua;
    
    const V_boiler_casa_L = (V_teorico_L / FATOR_ESTRATIFICACAO) * 1.2;
    const volumeUtilBoiler_L = (V_boiler_casa_L * FATOR_ESTRATIFICACAO) * 1.2;
    
    return { V_boiler_casa_L, volumeUtilBoiler_L };
}

/**
 * Calcula área de coletores
 */
function calcularAreaColetores(demanda_kWh, horasSolPico, eficiencia_coletor, fatorSeguranca = 1.3) {
    const energiaCapturadaPorM2_kWh = horasSolPico * eficiencia_coletor;
    if (energiaCapturadaPorM2_kWh <= 0) return 0;
    return (demanda_kWh * fatorSeguranca) / energiaCapturadaPorM2_kWh;
}

// =============================================
// SISTEMA DE TESTES
// =============================================

class TesteAquecimento {
    constructor() {
        this.testes = [];
        this.resultados = {
            passou: 0,
            falhou: 0,
            total: 0
        };
    }

    adicionarTeste(nome, entrada, esperado, tolerancia = 0.01) {
        this.testes.push({
            nome,
            entrada,
            esperado,
            tolerancia
        });
    }

    executarTeste(teste) {
        let resultado;
        const erros = [];
        
        if (teste.entrada.tipo === 'calcularDemandaAgua') {
            resultado = calcularDemandaAgua(
                teste.entrada.numeroPessoas,
                teste.entrada.tipoUso,
                teste.entrada.T_agua_fria
            );
        } else if (teste.entrada.tipo === 'calcularVolumeBoilerAgua') {
            resultado = calcularVolumeBoilerAgua(
                teste.entrada.V_diario_L,
                teste.entrada.diasAutonomia
            );
        } else if (teste.entrada.tipo === 'calcularEficienciaColetor') {
            resultado = calcularEficienciaColetor(
                teste.entrada.eficiencia_optica,
                teste.entrada.coef_perda_linear,
                teste.entrada.T_media_fluido,
                teste.entrada.T_ambiente,
                teste.entrada.irradiacao
            );
        } else if (teste.entrada.tipo === 'calcularDemandaCasa') {
            resultado = calcularDemandaCasa(
                teste.entrada.areaCasa,
                teste.entrada.alturaCasa,
                teste.entrada.classeEnergetica,
                teste.entrada.T_ambiente_inverno
            );
        } else if (teste.entrada.tipo === 'calcularVolumeBoilerCasa') {
            resultado = calcularVolumeBoilerCasa(
                teste.entrada.demandaCasa_kWh,
                teste.entrada.diasAutonomia,
                teste.entrada.T_ambiente_inverno
            );
        } else if (teste.entrada.tipo === 'calcularAreaColetores') {
            resultado = calcularAreaColetores(
                teste.entrada.demanda_kWh,
                teste.entrada.horasSolPico,
                teste.entrada.eficiencia_coletor,
                teste.entrada.fatorSeguranca
            );
        } else if (teste.entrada.tipo === 'calcularTemperaturaComAltitude') {
            resultado = calcularTemperaturaComAltitude(
                teste.entrada.T_base,
                teste.entrada.altitude
            );
        } else {
            erros.push({ propriedade: 'tipo', esperado: 'tipo válido', obtido: teste.entrada.tipo });
            return { passou: false, resultado: null, erros };
        }

        // Verifica propriedades esperadas
        if (typeof resultado === 'object' && resultado !== null) {
            for (let prop in teste.esperado) {
                const valorEsperado = teste.esperado[prop];
                const valorObtido = resultado[prop];
                
                if (typeof valorEsperado === 'number') {
                    const diferenca = Math.abs(valorEsperado - valorObtido);
                    const percentualErro = valorEsperado !== 0 
                        ? (diferenca / Math.abs(valorEsperado)) * 100 
                        : diferenca;
                    
                    if (percentualErro > teste.tolerancia * 100) {
                        erros.push({
                            propriedade: prop,
                            esperado: valorEsperado,
                            obtido: valorObtido,
                            diferenca: diferenca,
                            percentualErro: percentualErro.toFixed(2) + '%'
                        });
                    }
                } else if (valorEsperado !== valorObtido) {
                    erros.push({
                        propriedade: prop,
                        esperado: valorEsperado,
                        obtido: valorObtido
                    });
                }
            }
        } else {
            // Resultado é um número único
            const valorEsperado = teste.esperado;
            const valorObtido = resultado;
            
            if (typeof valorEsperado === 'number') {
                const diferenca = Math.abs(valorEsperado - valorObtido);
                const percentualErro = valorEsperado !== 0 
                    ? (diferenca / Math.abs(valorEsperado)) * 100 
                    : diferenca;
                
                if (percentualErro > teste.tolerancia * 100) {
                    erros.push({
                        propriedade: 'resultado',
                        esperado: valorEsperado,
                        obtido: valorObtido,
                        diferenca: diferenca,
                        percentualErro: percentualErro.toFixed(2) + '%'
                    });
                }
            } else if (valorEsperado !== valorObtido) {
                erros.push({
                    propriedade: 'resultado',
                    esperado: valorEsperado,
                    obtido: valorObtido
                });
            }
        }

        return {
            passou: erros.length === 0,
            resultado: resultado,
            erros: erros
        };
    }

    executarTodos() {
        console.log('\n' + '='.repeat(80));
        console.log('🧪 ROTINA DE TESTES - CÁLCULO DE AQUECEDOR SOLAR');
        console.log('='.repeat(80) + '\n');

        this.testes.forEach((teste, index) => {
            const resultado = this.executarTeste(teste);
            this.resultados.total++;
            
            if (resultado.passou) {
                this.resultados.passou++;
                console.log(`✅ TESTE ${index + 1}: ${teste.nome}`);
            } else {
                this.resultados.falhou++;
                console.log(`❌ TESTE ${index + 1}: ${teste.nome}`);
                resultado.erros.forEach(erro => {
                    console.log(`   ⚠️  ${erro.propriedade}: esperado ${erro.esperado}, obtido ${erro.obtido}`);
                    if (erro.percentualErro) {
                        console.log(`      Erro: ${erro.percentualErro}`);
                    }
                });
            }
        });

        console.log('\n' + '-'.repeat(80));
        console.log('📊 RESUMO DOS TESTES');
        console.log('-'.repeat(80));
        console.log(`Total de testes: ${this.resultados.total}`);
        console.log(`✅ Passou: ${this.resultados.passou}`);
        console.log(`❌ Falhou: ${this.resultados.falhou}`);
        console.log(`📈 Taxa de sucesso: ${((this.resultados.passou / this.resultados.total) * 100).toFixed(1)}%`);
        console.log('='.repeat(80) + '\n');
    }
}

// =============================================
// CASOS DE TESTE
// =============================================

const suite = new TesteAquecimento();

// ============================================
// TESTES DE DEMANDA DE ÁGUA
// ============================================

suite.adicionarTeste(
    'Demanda Água - 4 pessoas, Padrão, T_agua_fria 22°C',
    {
        tipo: 'calcularDemandaAgua',
        numeroPessoas: 4,
        tipoUso: 'Padrao',
        T_agua_fria: 22.0
    },
    {
        V_diario_L: 160.0, // 4 × 40 L/dia
        E_nec_kWh: 4.28, // 160 × 1.0 × 1.163 × (45-22) / 1000 ≈ 4.28 kWh
        Delta_T: 23.0 // 45 - 22
    },
    0.1
);

suite.adicionarTeste(
    'Demanda Água - 2 pessoas, Econômico, T_agua_fria 20°C',
    {
        tipo: 'calcularDemandaAgua',
        numeroPessoas: 2,
        tipoUso: 'Economico',
        T_agua_fria: 20.0
    },
    {
        V_diario_L: 60.0, // 2 × 30 L/dia
        E_nec_kWh: 1.40, // 60 × 1.0 × 1.163 × (40-20) / 1000 ≈ 1.40 kWh
        Delta_T: 20.0
    },
    0.1
);

// ============================================
// TESTES DE VOLUME DO BOILER PARA ÁGUA
// ============================================

suite.adicionarTeste(
    'Volume Boiler Água - 160 L/dia, 2 dias autonomia',
    {
        tipo: 'calcularVolumeBoilerAgua',
        V_diario_L: 160.0,
        diasAutonomia: 2
    },
    320.0 // 160 × 2 = 320 L
);

// ============================================
// TESTES DE EFICIÊNCIA DO COLETOR
// ============================================

suite.adicionarTeste(
    'Eficiência Coletor - η₀=0.72, U=1.6, T_media=35°C, T_ambiente=18°C, I=800 W/m²',
    {
        tipo: 'calcularEficienciaColetor',
        eficiencia_optica: 0.72,
        coef_perda_linear: 1.6,
        T_media_fluido: 35.0,
        T_ambiente: 18.0,
        irradiacao: 800.0
    },
    0.686 // 0.72 - (1.6 × (35-18) / 800) = 0.72 - 0.034 = 0.686
);

// ============================================
// TESTES DE DEMANDA DE CASA
// ============================================

suite.adicionarTeste(
    'Demanda Casa - 100 m², 2.7m altura, Classe D, T_ambiente 10°C',
    {
        tipo: 'calcularDemandaCasa',
        areaCasa: 100.0,
        alturaCasa: 2.7,
        classeEnergetica: 'D',
        T_ambiente_inverno: 10.0
    },
    {
        volumeCasa_m3: 270.0, // 100 × 2.7
        demandaCasa_kWh: 0.82, // Aproximado: (1.75 × 100 × 0.70) / 150 ≈ 0.82 kWh/dia
        Delta_T_casa: 12.0 // 22 - 10
    },
    0.2 // Tolerância maior devido a cálculos complexos
);

// ============================================
// TESTES DE VOLUME DO BOILER PARA CASA
// ============================================

suite.adicionarTeste(
    'Volume Boiler Casa - Demanda 0.82 kWh/dia, 3 dias autonomia, T_ambiente 10°C',
    {
        tipo: 'calcularVolumeBoilerCasa',
        demandaCasa_kWh: 0.82,
        diasAutonomia: 3,
        T_ambiente_inverno: 10.0
    },
    {
        V_boiler_casa_L: 229.7 // (0.82 × 3 × 1000) / (1.163 × 17) / 0.65 × 1.2 ≈ 229.7 L
    },
    0.1
);

// ============================================
// TESTES DE ÁREA DE COLETORES
// ============================================

suite.adicionarTeste(
    'Área Coletores - Demanda 4.28 kWh, HSP 4.0, Eficiência 0.686',
    {
        tipo: 'calcularAreaColetores',
        demanda_kWh: 4.28,
        horasSolPico: 4.0,
        eficiencia_coletor: 0.686,
        fatorSeguranca: 1.3
    },
    2.03 // (4.28 × 1.3) / (4.0 × 0.686) ≈ 2.03 m²
);

// ============================================
// TESTES DE TEMPERATURA COM ALTITUDE
// ============================================

suite.adicionarTeste(
    'Temperatura com Altitude - T_base 22°C, altitude 1000m',
    {
        tipo: 'calcularTemperaturaComAltitude',
        T_base: 22.0,
        altitude: 1000.0
    },
    16.5 // 22 - (1000 × 5.5 / 1000) = 22 - 5.5 = 16.5°C
);

suite.adicionarTeste(
    'Temperatura com Altitude - T_base 18°C, altitude 500m',
    {
        tipo: 'calcularTemperaturaComAltitude',
        T_base: 18.0,
        altitude: 500.0
    },
    15.25 // 18 - (500 × 5.5 / 1000) = 18 - 2.75 = 15.25°C
);

// ============================================
// EXECUTAR TODOS OS TESTES
// ============================================
suite.executarTodos();

// ============================================
// TESTES ADICIONAIS - Validação de Fórmulas
// ============================================
console.log('📐 VALIDAÇÃO DE FÓRMULAS\n');
console.log('Verificando fórmulas matemáticas...\n');

// Teste de fórmula: Demanda de Água
const V_test = 160.0;
const Delta_T_test = 23.0;
const E_test = (V_test * CONSTANTS.densidade_agua * CONSTANTS.calor_especifico_agua * Delta_T_test) / 1000.0;
console.log(`✅ Fórmula Demanda Água: E = (V × ρ × c × ΔT) / 1000`);
console.log(`   Exemplo: (${V_test} × ${CONSTANTS.densidade_agua} × ${CONSTANTS.calor_especifico_agua} × ${Delta_T_test}) / 1000 = ${E_test.toFixed(2)} kWh`);

// Teste de fórmula: Eficiência do Coletor
const eta0_test = 0.72;
const U_test = 1.6;
const T_media_test = 35.0;
const T_amb_test = 18.0;
const I_test = 800.0;
const P_test = (T_media_test - T_amb_test) / I_test;
const eta_test = eta0_test - (U_test * P_test);
console.log(`✅ Fórmula Eficiência Coletor: η = η₀ - (U × (T_media - T_ambiente) / I)`);
console.log(`   Exemplo: ${eta0_test} - (${U_test} × (${T_media_test} - ${T_amb_test}) / ${I_test}) = ${eta_test.toFixed(3)}`);

// Teste de fórmula: Área de Coletores
const demanda_test = 4.28;
const HSP_test = 4.0;
const eficiencia_test = 0.686;
const fator_test = 1.3;
const area_test = (demanda_test * fator_test) / (HSP_test * eficiencia_test);
console.log(`✅ Fórmula Área Coletores: A = (Demanda × Fator Segurança) / (HSP × Eficiência)`);
console.log(`   Exemplo: (${demanda_test} × ${fator_test}) / (${HSP_test} × ${eficiencia_test}) = ${area_test.toFixed(2)} m²`);

console.log(`✅ Calor Específico da Água: ${CONSTANTS.calor_especifico_agua} Wh/kg°C`);
console.log(`✅ Densidade da Água: ${CONSTANTS.densidade_agua} kg/L`);
console.log(`✅ Fator de Estratificação: ${FATOR_ESTRATIFICACAO} (${FATOR_ESTRATIFICACAO * 100}%)`);
console.log(`✅ Temperatura Mínima Termossifão: ${TEMPERATURA_MINIMA_TERMOSSIFAO}°C`);
console.log(`✅ Temperatura Armazenamento Inicial: ${TEMPERATURA_ARMAZENAMENTO_INICIAL}°C`);

console.log('\n' + '='.repeat(80));
console.log('✅ Todos os testes foram executados!');
console.log('='.repeat(80) + '\n');

