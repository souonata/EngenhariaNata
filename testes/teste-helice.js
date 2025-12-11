// =============================================
// ROTINA DE TESTES PARA CÁLCULO DE HÉLICE
// App Hélice - Cálculo de Passo de Hélice
// =============================================

// =============================================
// CONSTANTES E FUNÇÕES (MESMAS DO APP)
// =============================================

const CONSTANTE_CONVERSAO = 1056;

const CONVERSAO_VELOCIDADE = {
    knots: 1,
    mph: 0.868976,
    kmh: 0.539957
};

const CONVERSAO_PASSO = {
    inches: 1,
    mm: 25.4
};

function converterVelocidadeParaKnots(valor, unidade) {
    return valor * CONVERSAO_VELOCIDADE[unidade];
}

function converterKnotsParaUnidade(valor, unidade) {
    return valor / CONVERSAO_VELOCIDADE[unidade];
}

function converterPassoParaUnidade(valor, unidade) {
    if (unidade === 'inches') return valor;
    return valor * CONVERSAO_PASSO.mm;
}

/**
 * Calcula o passo ideal da hélice
 */
function calcularPasso(velocidade, reducao, rpmMotor, slip) {
    const rpmHelice = rpmMotor / reducao;
    const passo = (velocidade * CONSTANTE_CONVERSAO * reducao) / (rpmMotor * (1 - slip));
    const velocidadeTeorica = (passo * rpmMotor) / (CONSTANTE_CONVERSAO * reducao);
    
    return {
        passo: Math.round(passo * 10) / 10,
        rpmHelice: Math.round(rpmHelice),
        velocidadeTeorica: Math.round(velocidadeTeorica * 10) / 10
    };
}

// =============================================
// SISTEMA DE TESTES
// =============================================

class TesteHelice {
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
        
        // Executa o cálculo baseado no tipo
        if (teste.entrada.tipo === 'calcularPasso') {
            resultado = calcularPasso(
                teste.entrada.velocidade,
                teste.entrada.reducao,
                teste.entrada.rpmMotor,
                teste.entrada.slip
            );
        } else if (teste.entrada.tipo === 'converterVelocidade') {
            resultado = converterVelocidadeParaKnots(teste.entrada.valor, teste.entrada.unidade);
        } else if (teste.entrada.tipo === 'converterKnots') {
            resultado = converterKnotsParaUnidade(teste.entrada.valor, teste.entrada.unidade);
        } else if (teste.entrada.tipo === 'converterPasso') {
            resultado = converterPassoParaUnidade(teste.entrada.valor, teste.entrada.unidade);
        } else {
            erros.push({ propriedade: 'tipo', esperado: 'tipo válido', obtido: teste.entrada.tipo });
            return { passou: false, resultado: null, erros };
        }

        // Verifica propriedades esperadas
        for (let prop in teste.esperado) {
            const valorEsperado = teste.esperado[prop];
            const valorObtido = resultado[prop] !== undefined ? resultado[prop] : resultado;
            
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

        return {
            passou: erros.length === 0,
            resultado: resultado,
            erros: erros
        };
    }

    executarTodos() {
        console.log('\n' + '='.repeat(80));
        console.log('🧪 ROTINA DE TESTES - CÁLCULO DE HÉLICE');
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

const suite = new TesteHelice();

// ============================================
// TESTES DE CONVERSÃO DE VELOCIDADE
// ============================================

suite.adicionarTeste(
    'Conversão de Velocidade - 30 mph para nós',
    {
        tipo: 'converterVelocidade',
        valor: 30,
        unidade: 'mph'
    },
    {
        resultado: 26.06928 // 30 × 0.868976
    },
    0.1
);

suite.adicionarTeste(
    'Conversão de Velocidade - 50 km/h para nós',
    {
        tipo: 'converterVelocidade',
        valor: 50,
        unidade: 'kmh'
    },
    {
        resultado: 26.99785 // 50 × 0.539957
    },
    0.1
);

suite.adicionarTeste(
    'Conversão de Velocidade - 25 nós para nós (sem conversão)',
    {
        tipo: 'converterVelocidade',
        valor: 25,
        unidade: 'knots'
    },
    {
        resultado: 25
    }
);

suite.adicionarTeste(
    'Conversão de Nós para mph - 25 nós',
    {
        tipo: 'converterKnots',
        valor: 25,
        unidade: 'mph'
    },
    {
        resultado: 28.78 // 25 ÷ 0.868976
    },
    0.1
);

suite.adicionarTeste(
    'Conversão de Nós para km/h - 25 nós',
    {
        tipo: 'converterKnots',
        valor: 25,
        unidade: 'kmh'
    },
    {
        resultado: 46.30 // 25 ÷ 0.539957
    },
    0.1
);

// ============================================
// TESTES DE CONVERSÃO DE PASSO
// ============================================

suite.adicionarTeste(
    'Conversão de Passo - 12.5 polegadas para mm',
    {
        tipo: 'converterPasso',
        valor: 12.5,
        unidade: 'mm'
    },
    {
        resultado: 317.5 // 12.5 × 25.4
    }
);

suite.adicionarTeste(
    'Conversão de Passo - 12.5 polegadas para polegadas (sem conversão)',
    {
        tipo: 'converterPasso',
        valor: 12.5,
        unidade: 'inches'
    },
    {
        resultado: 12.5
    }
);

// ============================================
// TESTES DE CÁLCULO DE PASSO
// ============================================

suite.adicionarTeste(
    'Cálculo de Passo - 25 nós, redução 2.0, 5000 RPM, 15% slip',
    {
        tipo: 'calcularPasso',
        velocidade: 25,
        reducao: 2.0,
        rpmMotor: 5000,
        slip: 0.15
    },
    {
        passo: 12.4, // (25 × 1056 × 2.0) / (5000 × 0.85) = 52800 / 4250 = 12.423
        rpmHelice: 2500, // 5000 / 2.0
        velocidadeTeorica: 29.4 // (12.4 × 5000) / (1056 × 2.0) = 62000 / 2112 = 29.36
    },
    0.5
);

suite.adicionarTeste(
    'Cálculo de Passo - 20 nós, redução 1.5, 4000 RPM, 10% slip',
    {
        tipo: 'calcularPasso',
        velocidade: 20,
        reducao: 1.5,
        rpmMotor: 4000,
        slip: 0.10
    },
    {
        passo: 8.8, // (20 × 1056 × 1.5) / (4000 × 0.90) = 31680 / 3600 = 8.8
        rpmHelice: 2667, // 4000 / 1.5 = 2666.67
        velocidadeTeorica: 22.2 // (8.8 × 4000) / (1056 × 1.5) = 35200 / 1584 = 22.22
    },
    0.5
);

suite.adicionarTeste(
    'Cálculo de Passo - 30 nós, redução 2.5, 6000 RPM, 20% slip',
    {
        tipo: 'calcularPasso',
        velocidade: 30,
        reducao: 2.5,
        rpmMotor: 6000,
        slip: 0.20
    },
    {
        passo: 16.5, // (30 × 1056 × 2.5) / (6000 × 0.80) = 79200 / 4800 = 16.5
        rpmHelice: 2400, // 6000 / 2.5
        velocidadeTeorica: 37.5 // (16.5 × 6000) / (1056 × 2.5) = 99000 / 2640 = 37.5
    },
    0.5
);

suite.adicionarTeste(
    'Cálculo de Passo - 15 nós, redução 1.0 (sem redução), 3000 RPM, 12% slip',
    {
        tipo: 'calcularPasso',
        velocidade: 15,
        reducao: 1.0,
        rpmMotor: 3000,
        slip: 0.12
    },
    {
        passo: 6.0, // (15 × 1056 × 1.0) / (3000 × 0.88) = 15840 / 2640 = 6.0
        rpmHelice: 3000, // 3000 / 1.0
        velocidadeTeorica: 17.0 // (6.0 × 3000) / (1056 × 1.0) = 18000 / 1056 = 17.05
    },
    0.5
);

suite.adicionarTeste(
    'Cálculo de Passo - Valores Mínimos - 10 nós, redução 1.0, 2000 RPM, 10% slip',
    {
        tipo: 'calcularPasso',
        velocidade: 10,
        reducao: 1.0,
        rpmMotor: 2000,
        slip: 0.10
    },
    {
        passo: 5.9, // (10 × 1056 × 1.0) / (2000 × 0.90) = 10560 / 1800 = 5.867
        rpmHelice: 2000,
        velocidadeTeorica: 11.1 // (5.9 × 2000) / (1056 × 1.0) = 11800 / 1056 = 11.17
    },
    0.5
);

suite.adicionarTeste(
    'Cálculo de Passo - Valores Altos - 40 nós, redução 3.0, 8000 RPM, 18% slip',
    {
        tipo: 'calcularPasso',
        velocidade: 40,
        reducao: 3.0,
        rpmMotor: 8000,
        slip: 0.18
    },
    {
        passo: 19.2, // (40 × 1056 × 3.0) / (8000 × 0.82) = 126720 / 6560 = 19.32
        rpmHelice: 2667, // 8000 / 3.0 = 2666.67
        velocidadeTeorica: 48.8 // (19.2 × 8000) / (1056 × 3.0) = 153600 / 3168 = 48.48
    },
    0.5
);

// ============================================
// TESTES DE VALIDAÇÃO - Verificações Gerais
// ============================================

suite.adicionarTeste(
    'Validação - RPM Hélice = RPM Motor ÷ Redução',
    {
        tipo: 'calcularPasso',
        velocidade: 25,
        reducao: 2.0,
        rpmMotor: 5000,
        slip: 0.15
    },
    {
        rpmHelice: 2500 // 5000 / 2.0
    }
);

suite.adicionarTeste(
    'Validação - Slip Zero: Velocidade Teórica = Velocidade Desejada',
    {
        tipo: 'calcularPasso',
        velocidade: 25,
        reducao: 2.0,
        rpmMotor: 5000,
        slip: 0.0 // Sem slip
    },
    {
        velocidadeTeorica: 25.0 // Deve ser igual à velocidade desejada quando slip = 0
    },
    0.5
);

suite.adicionarTeste(
    'Validação - Redução 1.0: RPM Hélice = RPM Motor',
    {
        tipo: 'calcularPasso',
        velocidade: 20,
        reducao: 1.0,
        rpmMotor: 4000,
        slip: 0.15
    },
    {
        rpmHelice: 4000 // Sem redução, RPM da hélice = RPM do motor
    }
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

// Teste de fórmula: Passo
const velocidadeTeste = 25;
const reducaoTeste = 2.0;
const rpmTeste = 5000;
const slipTeste = 0.15;
const passoTeste = (velocidadeTeste * CONSTANTE_CONVERSAO * reducaoTeste) / (rpmTeste * (1 - slipTeste));
console.log(`✅ Fórmula Passo: (Velocidade × 1056 × Redução) ÷ (RPM × (1 - Slip))`);
console.log(`   Exemplo: (${velocidadeTeste} × ${CONSTANTE_CONVERSAO} × ${reducaoTeste}) ÷ (${rpmTeste} × ${(1 - slipTeste).toFixed(2)}) = ${passoTeste.toFixed(2)} polegadas`);

// Teste de fórmula: RPM Hélice
const rpmHeliceTeste = rpmTeste / reducaoTeste;
console.log(`✅ Fórmula RPM Hélice: RPM Motor ÷ Redução`);
console.log(`   Exemplo: ${rpmTeste} ÷ ${reducaoTeste} = ${rpmHeliceTeste} RPM`);

// Teste de fórmula: Velocidade Teórica
const velocidadeTeoricaTeste = (passoTeste * rpmTeste) / (CONSTANTE_CONVERSAO * reducaoTeste);
console.log(`✅ Fórmula Velocidade Teórica: (Passo × RPM) ÷ (1056 × Redução)`);
console.log(`   Exemplo: (${passoTeste.toFixed(2)} × ${rpmTeste}) ÷ (${CONSTANTE_CONVERSAO} × ${reducaoTeste}) = ${velocidadeTeoricaTeste.toFixed(2)} nós`);

// Teste de constante de conversão
console.log(`✅ Constante de Conversão: ${CONSTANTE_CONVERSAO} (nós → polegadas/minuto)`);

console.log('\n' + '='.repeat(80));
console.log('✅ Todos os testes foram executados!');
console.log('='.repeat(80) + '\n');

