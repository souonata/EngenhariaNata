// =============================================
// ROTINA DE TESTES PARA CÁLCULO DE BITOLA DE FIOS
// App Bitola - Dimensionamento de Condutores Elétricos
// =============================================

// =============================================
// CONSTANTES E FUNÇÕES (MESMAS DO APP)
// =============================================

const RESISTIVIDADE_COBRE = 0.0175; // Ω·mm²/m (cobre a 20°C)
const FATOR_SEGURANCA = 1.25; // 25% de margem de segurança

const BITOLAS_COMERCIAIS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
const DISJUNTORES_COMERCIAIS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630];

/**
 * Calcula a corrente do circuito
 * I = P / V
 */
function calcularCorrente(potencia, tensao) {
    if (tensao === 0) return 0;
    return potencia / tensao;
}

/**
 * Calcula a área de seção mínima
 * S = (2 × ρ × L × I) / ΔV
 * onde ΔV = (queda% / 100) × V
 */
function calcularAreaMinima(comprimento, corrente, tensao, quedaPercentual) {
    const quedaVolts = (quedaPercentual / 100) * tensao;
    if (quedaVolts === 0) return Infinity;
    const areaMinima = (2 * RESISTIVIDADE_COBRE * comprimento * corrente) / quedaVolts;
    return areaMinima;
}

/**
 * Seleciona a bitola comercial com fator de segurança
 */
function selecionarBitolaComercial(areaMinima) {
    const areaComSeguranca = areaMinima * FATOR_SEGURANCA;
    
    for (let i = 0; i < BITOLAS_COMERCIAIS.length; i++) {
        if (BITOLAS_COMERCIAIS[i] >= areaComSeguranca) {
            return BITOLAS_COMERCIAIS[i];
        }
    }
    
    return BITOLAS_COMERCIAIS[BITOLAS_COMERCIAIS.length - 1];
}

/**
 * Seleciona o disjuntor comercial com fator de segurança
 */
function selecionarDisjuntorComercial(corrente) {
    const correnteComSeguranca = corrente * FATOR_SEGURANCA;
    
    for (let i = 0; i < DISJUNTORES_COMERCIAIS.length; i++) {
        if (DISJUNTORES_COMERCIAIS[i] >= correnteComSeguranca) {
            return DISJUNTORES_COMERCIAIS[i];
        }
    }
    
    return DISJUNTORES_COMERCIAIS[DISJUNTORES_COMERCIAIS.length - 1];
}

/**
 * Calcula a queda de tensão real
 * ΔV% = ((2 × ρ × L × I) / S) / V × 100
 */
function calcularQuedaReal(comprimento, corrente, tensao, bitola) {
    if (tensao === 0 || bitola === 0) return 0;
    
    const quedaVolts = (2 * RESISTIVIDADE_COBRE * comprimento * corrente) / bitola;
    const quedaPercentual = (quedaVolts / tensao) * 100;
    
    return quedaPercentual;
}

// =============================================
// SISTEMA DE TESTES
// =============================================

class TesteBitola {
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
        
        if (teste.entrada.tipo === 'calcularCorrente') {
            resultado = calcularCorrente(teste.entrada.potencia, teste.entrada.tensao);
        } else if (teste.entrada.tipo === 'calcularAreaMinima') {
            resultado = calcularAreaMinima(
                teste.entrada.comprimento,
                teste.entrada.corrente,
                teste.entrada.tensao,
                teste.entrada.quedaPercentual
            );
        } else if (teste.entrada.tipo === 'selecionarBitolaComercial') {
            resultado = selecionarBitolaComercial(teste.entrada.areaMinima);
        } else if (teste.entrada.tipo === 'selecionarDisjuntorComercial') {
            resultado = selecionarDisjuntorComercial(teste.entrada.corrente);
        } else if (teste.entrada.tipo === 'calcularQuedaReal') {
            resultado = calcularQuedaReal(
                teste.entrada.comprimento,
                teste.entrada.corrente,
                teste.entrada.tensao,
                teste.entrada.bitola
            );
        } else if (teste.entrada.tipo === 'calculoCompleto') {
            const corrente = calcularCorrente(teste.entrada.potencia, teste.entrada.tensao);
            const areaMin = calcularAreaMinima(
                teste.entrada.comprimento,
                corrente,
                teste.entrada.tensao,
                teste.entrada.quedaPercentual
            );
            const bitola = selecionarBitolaComercial(areaMin);
            const quedaReal = calcularQuedaReal(
                teste.entrada.comprimento,
                corrente,
                teste.entrada.tensao,
                bitola
            );
            const disjuntor = selecionarDisjuntorComercial(corrente);
            resultado = {
                corrente,
                areaMinima: areaMin,
                bitola,
                quedaReal,
                disjuntor
            };
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
        console.log('🧪 ROTINA DE TESTES - CÁLCULO DE BITOLA DE FIOS');
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

const suite = new TesteBitola();

// ============================================
// TESTES DE CORRENTE (I = P / V)
// ============================================

suite.adicionarTeste(
    'Corrente - 2200W, 220V',
    {
        tipo: 'calcularCorrente',
        potencia: 2200,
        tensao: 220
    },
    10.0 // 2200 / 220 = 10 A
);

suite.adicionarTeste(
    'Corrente - 1100W, 110V',
    {
        tipo: 'calcularCorrente',
        potencia: 1100,
        tensao: 110
    },
    10.0 // 1100 / 110 = 10 A
);

suite.adicionarTeste(
    'Corrente - 5000W, 220V',
    {
        tipo: 'calcularCorrente',
        potencia: 5000,
        tensao: 220
    },
    22.73 // 5000 / 220 ≈ 22.73 A
);

suite.adicionarTeste(
    'Corrente - 100W, 12V (CC)',
    {
        tipo: 'calcularCorrente',
        potencia: 100,
        tensao: 12
    },
    8.33 // 100 / 12 ≈ 8.33 A
);

suite.adicionarTeste(
    'Corrente - Divisão por zero (tensão = 0)',
    {
        tipo: 'calcularCorrente',
        potencia: 1000,
        tensao: 0
    },
    0 // Deve retornar 0 para evitar divisão por zero
);

// ============================================
// TESTES DE ÁREA MÍNIMA
// ============================================

suite.adicionarTeste(
    'Área Mínima - Exemplo do código: 2200W, 220V, 30m, 4%',
    {
        tipo: 'calcularAreaMinima',
        comprimento: 30,
        corrente: 10, // 2200W / 220V = 10A
        tensao: 220,
        quedaPercentual: 4
    },
    1.19 // (2 × 0.0175 × 30 × 10) / 8.8 = 10.5 / 8.8 ≈ 1.19 mm²
);

suite.adicionarTeste(
    'Área Mínima - 5000W, 220V, 50m, 4%',
    {
        tipo: 'calcularAreaMinima',
        comprimento: 50,
        corrente: 22.73, // 5000W / 220V ≈ 22.73A
        tensao: 220,
        quedaPercentual: 4
    },
    4.52 // (2 × 0.0175 × 50 × 22.73) / 8.8 ≈ 4.52 mm²
);

suite.adicionarTeste(
    'Área Mínima - 100W, 12V, 10m, 3% (CC)',
    {
        tipo: 'calcularAreaMinima',
        comprimento: 10,
        corrente: 8.33, // 100W / 12V ≈ 8.33A
        tensao: 12,
        quedaPercentual: 3
    },
    8.10 // (2 × 0.0175 × 10 × 8.33) / 0.36 ≈ 8.10 mm²
);

// ============================================
// TESTES DE SELEÇÃO DE BITOLA COMERCIAL
// ============================================

suite.adicionarTeste(
    'Bitola Comercial - Área mínima 1.19 mm² (com fator segurança 1.25 = 1.49 mm²)',
    {
        tipo: 'selecionarBitolaComercial',
        areaMinima: 1.19
    },
    1.5 // 1.19 × 1.25 = 1.49 → próxima bitola comercial: 1.5 mm²
);

suite.adicionarTeste(
    'Bitola Comercial - Área mínima 2.26 mm² (com fator segurança 1.25 = 2.83 mm²)',
    {
        tipo: 'selecionarBitolaComercial',
        areaMinima: 2.26
    },
    4.0 // 2.26 × 1.25 = 2.83 → próxima bitola comercial: 4.0 mm²
);

suite.adicionarTeste(
    'Bitola Comercial - Área mínima 0.81 mm² (com fator segurança 1.25 = 1.01 mm²)',
    {
        tipo: 'selecionarBitolaComercial',
        areaMinima: 0.81
    },
    1.5 // 0.81 × 1.25 = 1.01 → próxima bitola comercial: 1.5 mm²
);

suite.adicionarTeste(
    'Bitola Comercial - Área mínima 8.0 mm² (com fator segurança 1.25 = 10.0 mm²)',
    {
        tipo: 'selecionarBitolaComercial',
        areaMinima: 8.0
    },
    10.0 // 8.0 × 1.25 = 10.0 → bitola comercial exata: 10.0 mm²
);

// ============================================
// TESTES DE QUEDA DE TENSÃO REAL
// ============================================

suite.adicionarTeste(
    'Queda Real - Exemplo do código: 10A, 220V, 30m, 2.5 mm²',
    {
        tipo: 'calcularQuedaReal',
        comprimento: 30,
        corrente: 10,
        tensao: 220,
        bitola: 2.5
    },
    1.91 // (2 × 0.0175 × 30 × 10) / 2.5 = 4.2V → (4.2 / 220) × 100 ≈ 1.91%
);

suite.adicionarTeste(
    'Queda Real - 22.73A, 220V, 50m, 4.0 mm²',
    {
        tipo: 'calcularQuedaReal',
        comprimento: 50,
        corrente: 22.73,
        tensao: 220,
        bitola: 4.0
    },
    4.52 // (2 × 0.0175 × 50 × 22.73) / 4.0 = 9.945V → (9.945 / 220) × 100 ≈ 4.52%
);

suite.adicionarTeste(
    'Queda Real - 8.33A, 12V, 10m, 1.5 mm² (CC)',
    {
        tipo: 'calcularQuedaReal',
        comprimento: 10,
        corrente: 8.33,
        tensao: 12,
        bitola: 1.5
    },
    16.20 // (2 × 0.0175 × 10 × 8.33) / 1.5 = 1.94V → (1.94 / 12) × 100 ≈ 16.20%
);

// ============================================
// TESTES DE SELEÇÃO DE DISJUNTOR
// ============================================

suite.adicionarTeste(
    'Disjuntor - Corrente 10A (com fator segurança 1.25 = 12.5A)',
    {
        tipo: 'selecionarDisjuntorComercial',
        corrente: 10
    },
    13 // 10 × 1.25 = 12.5 → próximo disjuntor: 13A
);

suite.adicionarTeste(
    'Disjuntor - Corrente 20A (com fator segurança 1.25 = 25A)',
    {
        tipo: 'selecionarDisjuntorComercial',
        corrente: 20
    },
    25 // 20 × 1.25 = 25 → disjuntor exato: 25A
);

suite.adicionarTeste(
    'Disjuntor - Corrente 15A (com fator segurança 1.25 = 18.75A)',
    {
        tipo: 'selecionarDisjuntorComercial',
        corrente: 15
    },
    20 // 15 × 1.25 = 18.75 → próximo disjuntor: 20A
);

// ============================================
// TESTES DE CÁLCULO COMPLETO
// ============================================

suite.adicionarTeste(
    'Cálculo Completo - 2200W, 220V, 30m, 4%',
    {
        tipo: 'calculoCompleto',
        potencia: 2200,
        tensao: 220,
        comprimento: 30,
        quedaPercentual: 4
    },
    {
        corrente: 10.0,
        areaMinima: 1.19,
        bitola: 1.5, // 1.19 × 1.25 = 1.49 → bitola 1.5 mm²
        quedaReal: 3.18, // Queda real com bitola 1.5 mm²
        disjuntor: 13
    },
    0.1
);

suite.adicionarTeste(
    'Cálculo Completo - 5000W, 220V, 50m, 4%',
    {
        tipo: 'calculoCompleto',
        potencia: 5000,
        tensao: 220,
        comprimento: 50,
        quedaPercentual: 4
    },
    {
        corrente: 22.73,
        areaMinima: 4.52, // Valor correto
        bitola: 6.0, // 4.52 × 1.25 = 5.65 → bitola 6.0 mm²
        disjuntor: 32 // 22.73 × 1.25 = 28.41 → disjuntor 32A
    },
    0.1
);

suite.adicionarTeste(
    'Cálculo Completo - 100W, 12V, 10m, 3% (CC)',
    {
        tipo: 'calculoCompleto',
        potencia: 100,
        tensao: 12,
        comprimento: 10,
        quedaPercentual: 3
    },
    {
        corrente: 8.33,
        areaMinima: 8.10, // Valor correto
        bitola: 16.0, // 8.10 × 1.25 = 10.125 → bitola 16.0 mm² (10.0 < 10.125, então próxima é 16.0)
        disjuntor: 13 // 8.33 × 1.25 = 10.41 → disjuntor 13A
    },
    0.1
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

// Teste de fórmula: Corrente
const potenciaTeste = 2200;
const tensaoTeste = 220;
const correnteTeste = potenciaTeste / tensaoTeste;
console.log(`✅ Fórmula Corrente: I = P / V`);
console.log(`   Exemplo: ${potenciaTeste} W ÷ ${tensaoTeste} V = ${correnteTeste.toFixed(2)} A`);

// Teste de fórmula: Área Mínima
const comprimentoTeste = 30;
const quedaPercentualTeste = 4;
const quedaVoltsTeste = (quedaPercentualTeste / 100) * tensaoTeste;
const areaMinimaTeste = (2 * RESISTIVIDADE_COBRE * comprimentoTeste * correnteTeste) / quedaVoltsTeste;
console.log(`✅ Fórmula Área Mínima: S = (2 × ρ × L × I) / ΔV`);
console.log(`   Onde ΔV = (queda% / 100) × V`);
console.log(`   Exemplo: (2 × ${RESISTIVIDADE_COBRE} × ${comprimentoTeste} × ${correnteTeste.toFixed(2)}) / ${quedaVoltsTeste.toFixed(2)} = ${areaMinimaTeste.toFixed(2)} mm²`);

// Teste de fórmula: Queda Real
const bitolaTeste = 2.5;
const quedaVoltsRealTeste = (2 * RESISTIVIDADE_COBRE * comprimentoTeste * correnteTeste) / bitolaTeste;
const quedaPercentualRealTeste = (quedaVoltsRealTeste / tensaoTeste) * 100;
console.log(`✅ Fórmula Queda Real: ΔV% = ((2 × ρ × L × I) / S) / V × 100`);
console.log(`   Exemplo: ((2 × ${RESISTIVIDADE_COBRE} × ${comprimentoTeste} × ${correnteTeste.toFixed(2)}) / ${bitolaTeste}) / ${tensaoTeste} × 100 = ${quedaPercentualRealTeste.toFixed(2)}%`);

// Teste de fórmula: Fator de Segurança
console.log(`✅ Fator de Segurança: ${FATOR_SEGURANCA} (${(FATOR_SEGURANCA - 1) * 100}% de margem)`);
console.log(`   Bitola com segurança: ${areaMinimaTeste.toFixed(2)} × ${FATOR_SEGURANCA} = ${(areaMinimaTeste * FATOR_SEGURANCA).toFixed(2)} mm²`);

console.log(`✅ Resistividade do Cobre: ${RESISTIVIDADE_COBRE} Ω·mm²/m (a 20°C)`);
console.log(`✅ Bitolas Comerciais: ${BITOLAS_COMERCIAIS.join(', ')} mm²`);

console.log('\n' + '='.repeat(80));
console.log('✅ Todos os testes foram executados!');
console.log('='.repeat(80) + '\n');

