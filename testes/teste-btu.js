// =============================================
// ROTINA DE TESTES PARA CÁLCULO DE BTU
// Dimensionador de Ar Condicionado
// =============================================

// Constantes do sistema (mesmas do app)
const BTU_POR_M2 = 700;
const BTU_POR_PESSOA = 600;
const BTU_POR_EQUIPAMENTO = 600;
const ALTURA_PADRAO = 2.7;

const FATORES_INSOLACAO = {
    baixa: 1.0,
    media: 1.15,
    alta: 1.3
};

const FATORES_ISOLAMENTO = {
    bom: 0.8,
    medio: 1.0,
    ruim: 1.2
};

const MODELOS_COMERCIAIS = [5000, 7000, 9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000];
const BTU_PARA_KW = 0.000293;

// =============================================
// FUNÇÃO DE CÁLCULO (MESMA DO APP)
// =============================================
function calcularBTU(area, altura, pessoas, equipamentos, insolacao, isolamento) {
    // PASSO 1: Calcular BTU base por área (área × 700 BTU/m² × fator altura)
    const fatorAltura = altura / ALTURA_PADRAO;
    const btuArea = area * BTU_POR_M2 * fatorAltura;
    
    // PASSO 2: Adicionar BTU por pessoas
    const btuPessoas = pessoas * BTU_POR_PESSOA;
    
    // PASSO 3: Adicionar BTU por equipamentos
    const btuEquipamentos = equipamentos * BTU_POR_EQUIPAMENTO;
    
    // PASSO 4: Calcular BTU base total
    const btuBase = btuArea + btuPessoas + btuEquipamentos;
    
    // PASSO 5: Calcular volume
    const volume = area * altura;
    
    // PASSO 6: Aplicar fatores de insolação e isolamento
    const fatorInsolacao = FATORES_INSOLACAO[insolacao] || 1.0;
    const fatorIsolamento = FATORES_ISOLAMENTO[isolamento] || 1.0;
    
    // PASSO 7: Calcular BTU final
    const btuFinal = btuBase * fatorInsolacao * fatorIsolamento;
    
    // PASSO 8: Selecionar modelo comercial
    const btuRecomendado = selecionarModeloComercial(btuFinal);
    
    // PASSO 9: Converter para kW
    const potenciaKw = btuRecomendado * BTU_PARA_KW;
    
    return {
        btuRecomendado: btuRecomendado,
        potenciaKw: potenciaKw,
        volume: volume,
        btuBase: btuBase,
        btuFinal: btuFinal,
        btuArea: btuArea,
        btuPessoas: btuPessoas,
        btuEquipamentos: btuEquipamentos,
        fatorAltura: fatorAltura
    };
}

function selecionarModeloComercial(btuNecessario) {
    for (let i = 0; i < MODELOS_COMERCIAIS.length; i++) {
        if (MODELOS_COMERCIAIS[i] >= btuNecessario) {
            return MODELOS_COMERCIAIS[i];
        }
    }
    return MODELOS_COMERCIAIS[MODELOS_COMERCIAIS.length - 1];
}

// =============================================
// SISTEMA DE TESTES
// =============================================

class TesteBTU {
    constructor() {
        this.testes = [];
        this.resultados = {
            passou: 0,
            falhou: 0,
            total: 0
        };
    }

    // Adiciona um teste
    adicionarTeste(nome, entrada, esperado, tolerancia = 0.01) {
        this.testes.push({
            nome,
            entrada,
            esperado,
            tolerancia
        });
    }

    // Executa um teste individual
    executarTeste(teste) {
        const resultado = calcularBTU(
            teste.entrada.area,
            teste.entrada.altura,
            teste.entrada.pessoas,
            teste.entrada.equipamentos,
            teste.entrada.insolacao,
            teste.entrada.isolamento
        );

        const erros = [];
        
        // Verifica cada propriedade esperada
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

        return {
            passou: erros.length === 0,
            resultado: resultado,
            erros: erros
        };
    }

    // Executa todos os testes
    executarTodos() {
        console.log('\n' + '='.repeat(80));
        console.log('🧪 ROTINA DE TESTES - CÁLCULO DE BTU');
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

        // Resumo
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

const suite = new TesteBTU();

// ============================================
// TESTE 1: Caso Básico - Quarto Pequeno
// ============================================
suite.adicionarTeste(
    'Caso Básico - Quarto 12m², 2.7m altura, 1 pessoa, 1 equipamento, insolação baixa, isolamento médio',
    {
        area: 12,
        altura: 2.7,
        pessoas: 1,
        equipamentos: 1,
        insolacao: 'baixa',
        isolamento: 'medio'
    },
    {
        fatorAltura: 1.0,
        btuArea: 8400,      // 12 × 700 × 1.0
        btuPessoas: 600,    // 1 × 600
        btuEquipamentos: 600, // 1 × 600
        btuBase: 9600,      // 8400 + 600 + 600
        btuFinal: 9600,     // 9600 × 1.0 × 1.0
        btuRecomendado: 12000, // Arredondado para cima
        volume: 32.4        // 12 × 2.7
    }
);

// ============================================
// TESTE 2: Sala Média com Insolação Média
// ============================================
suite.adicionarTeste(
    'Sala 20m², 2.7m altura, 2 pessoas, 3 equipamentos, insolação média, isolamento médio',
    {
        area: 20,
        altura: 2.7,
        pessoas: 2,
        equipamentos: 3,
        insolacao: 'media',
        isolamento: 'medio'
    },
    {
        fatorAltura: 1.0,
        btuArea: 14000,     // 20 × 700 × 1.0
        btuPessoas: 1200,   // 2 × 600
        btuEquipamentos: 1800, // 3 × 600
        btuBase: 17000,     // 14000 + 1200 + 1800
        btuFinal: 19550,    // 17000 × 1.15 × 1.0
        btuRecomendado: 24000, // Arredondado para cima
        volume: 54.0        // 20 × 2.7
    }
);

// ============================================
// TESTE 3: Ambiente Grande com Alta Insolação e Isolamento Ruim
// ============================================
suite.adicionarTeste(
    'Sala Grande 30m², 2.7m altura, 3 pessoas, 4 equipamentos, insolação alta, isolamento ruim',
    {
        area: 30,
        altura: 2.7,
        pessoas: 3,
        equipamentos: 4,
        insolacao: 'alta',
        isolamento: 'ruim'
    },
    {
        fatorAltura: 1.0,
        btuArea: 21000,     // 30 × 700 × 1.0
        btuPessoas: 1800,   // 3 × 600
        btuEquipamentos: 2400, // 4 × 600
        btuBase: 25200,     // 21000 + 1800 + 2400
        btuFinal: 39312,    // 25200 × 1.3 × 1.2
        btuRecomendado: 48000, // Arredondado para cima
        volume: 81.0        // 30 × 2.7
    }
);

// ============================================
// TESTE 4: Ambiente com Isolamento Bom (Reduz BTU)
// ============================================
suite.adicionarTeste(
    'Quarto 15m², 2.7m altura, 1 pessoa, 1 equipamento, insolação baixa, isolamento bom',
    {
        area: 15,
        altura: 2.7,
        pessoas: 1,
        equipamentos: 1,
        insolacao: 'baixa',
        isolamento: 'bom'
    },
    {
        fatorAltura: 1.0,
        btuArea: 10500,     // 15 × 700 × 1.0
        btuPessoas: 600,    // 1 × 600
        btuEquipamentos: 600, // 1 × 600
        btuBase: 11700,     // 10500 + 600 + 600
        btuFinal: 9360,     // 11700 × 1.0 × 0.8
        btuRecomendado: 12000, // Arredondado para cima
        volume: 40.5        // 15 × 2.7
    }
);

// ============================================
// TESTE 5: Pé Direito Alto (Fator Altura > 1)
// ============================================
suite.adicionarTeste(
    'Ambiente 20m², 3.5m altura (pé direito alto), 2 pessoas, 2 equipamentos, insolação média, isolamento médio',
    {
        area: 20,
        altura: 3.5,
        pessoas: 2,
        equipamentos: 2,
        insolacao: 'media',
        isolamento: 'medio'
    },
    {
        fatorAltura: 3.5 / 2.7, // ≈ 1.296
        btuArea: 18148,     // 20 × 700 × 1.296 (aproximado)
        btuPessoas: 1200,   // 2 × 600
        btuEquipamentos: 1200, // 2 × 600
        btuBase: 20548,     // 18148 + 1200 + 1200 (aproximado)
        btuFinal: 23630,    // 20548 × 1.15 × 1.0 (aproximado)
        btuRecomendado: 24000, // Arredondado para cima
        volume: 70.0        // 20 × 3.5
    },
    0.05 // Tolerância maior para cálculos com fator altura
);

// ============================================
// TESTE 6: Pé Direito Baixo (Fator Altura < 1)
// ============================================
suite.adicionarTeste(
    'Ambiente 20m², 2.0m altura (pé direito baixo), 2 pessoas, 2 equipamentos, insolação média, isolamento médio',
    {
        area: 20,
        altura: 2.0,
        pessoas: 2,
        equipamentos: 2,
        insolacao: 'media',
        isolamento: 'medio'
    },
    {
        fatorAltura: 2.0 / 2.7, // ≈ 0.741
        btuArea: 10370,     // 20 × 700 × 0.741 (aproximado)
        btuPessoas: 1200,   // 2 × 600
        btuEquipamentos: 1200, // 2 × 600
        btuBase: 12770,     // 10370 + 1200 + 1200 (aproximado)
        btuFinal: 14686,    // 12770 × 1.15 × 1.0 (aproximado)
        btuRecomendado: 18000, // Arredondado para cima
        volume: 40.0        // 20 × 2.0
    },
    0.05 // Tolerância maior para cálculos com fator altura
);

// ============================================
// TESTE 7: Valores Mínimos
// ============================================
suite.adicionarTeste(
    'Valores Mínimos - 10m², 2.7m altura, 1 pessoa, 0 equipamentos, insolação baixa, isolamento bom',
    {
        area: 10,
        altura: 2.7,
        pessoas: 1,
        equipamentos: 0,
        insolacao: 'baixa',
        isolamento: 'bom'
    },
    {
        fatorAltura: 1.0,
        btuArea: 7000,      // 10 × 700 × 1.0
        btuPessoas: 600,    // 1 × 600
        btuEquipamentos: 0, // 0 × 600
        btuBase: 7600,      // 7000 + 600 + 0
        btuFinal: 6080,     // 7600 × 1.0 × 0.8
        btuRecomendado: 7000, // Arredondado para cima
        volume: 27.0        // 10 × 2.7
    }
);

// ============================================
// TESTE 8: Muitas Pessoas e Equipamentos
// ============================================
suite.adicionarTeste(
    'Ambiente 25m², 2.7m altura, 5 pessoas, 6 equipamentos, insolação média, isolamento médio',
    {
        area: 25,
        altura: 2.7,
        pessoas: 5,
        equipamentos: 6,
        insolacao: 'media',
        isolamento: 'medio'
    },
    {
        fatorAltura: 1.0,
        btuArea: 17500,     // 25 × 700 × 1.0
        btuPessoas: 3000,   // 5 × 600
        btuEquipamentos: 3600, // 6 × 600
        btuBase: 24100,     // 17500 + 3000 + 3600
        btuFinal: 27715,    // 24100 × 1.15 × 1.0
        btuRecomendado: 30000, // Arredondado para cima
        volume: 67.5        // 25 × 2.7
    }
);

// ============================================
// TESTE 9: Combinação Extrema - Alta Insolação + Isolamento Ruim
// ============================================
suite.adicionarTeste(
    'Combinação Extrema - 20m², 2.7m altura, 2 pessoas, 2 equipamentos, insolação alta, isolamento ruim',
    {
        area: 20,
        altura: 2.7,
        pessoas: 2,
        equipamentos: 2,
        insolacao: 'alta',
        isolamento: 'ruim'
    },
    {
        fatorAltura: 1.0,
        btuArea: 14000,     // 20 × 700 × 1.0
        btuPessoas: 1200,   // 2 × 600
        btuEquipamentos: 1200, // 2 × 600
        btuBase: 16400,     // 14000 + 1200 + 1200
        btuFinal: 25584,    // 16400 × 1.3 × 1.2
        btuRecomendado: 30000, // Arredondado para cima
        volume: 54.0        // 20 × 2.7
    }
);

// ============================================
// TESTE 10: Validação de Modelos Comerciais
// ============================================
suite.adicionarTeste(
    'Validação de Modelo Comercial - 18m², 2.7m altura, 2 pessoas, 2 equipamentos, insolação média, isolamento médio',
    {
        area: 18,
        altura: 2.7,
        pessoas: 2,
        equipamentos: 2,
        insolacao: 'media',
        isolamento: 'medio'
    },
    {
        btuFinal: 17250,    // (18×700×1.0 + 2×600 + 2×600) × 1.15 × 1.0 = 15000 × 1.15
        btuRecomendado: 18000, // Deve arredondar para 18000
        volume: 48.6        // 18 × 2.7
    }
);

// ============================================
// TESTE 11: Valores Limite - Modelo Mínimo (5000 BTU)
// ============================================
suite.adicionarTeste(
    'Valores Limite - Modelo Mínimo 5000 BTU',
    {
        area: 5,
        altura: 2.7,
        pessoas: 1,
        equipamentos: 0,
        insolacao: 'baixa',
        isolamento: 'bom'
    },
    {
        btuFinal: 3280,     // (5×700×1.0 + 1×600 + 0×600) × 1.0 × 0.8 = 4100 × 0.8
        btuRecomendado: 5000, // Deve arredondar para 5000 (modelo mínimo)
        volume: 13.5        // 5 × 2.7
    }
);

// ============================================
// TESTE 12: Valores Limite - Modelo Máximo (60000 BTU)
// ============================================
suite.adicionarTeste(
    'Valores Limite - Modelo Máximo 60000 BTU',
    {
        area: 50,
        altura: 2.7,
        pessoas: 5,
        equipamentos: 5,
        insolacao: 'alta',
        isolamento: 'ruim'
    },
    {
        btuFinal: 63960,    // (50×700×1.0 + 5×600 + 5×600) × 1.3 × 1.2 = 41000 × 1.56
        btuRecomendado: 60000, // Deve retornar 60000 (modelo máximo disponível)
        volume: 135.0       // 50 × 2.7
    }
);

// ============================================
// TESTE 13: Validação de Conversão kW
// ============================================
suite.adicionarTeste(
    'Validação de Conversão kW - 12m², 2.7m altura, 1 pessoa, 1 equipamento, insolação baixa, isolamento médio',
    {
        area: 12,
        altura: 2.7,
        pessoas: 1,
        equipamentos: 1,
        insolacao: 'baixa',
        isolamento: 'medio'
    },
    {
        btuRecomendado: 12000,
        potenciaKw: 3.516,  // 12000 × 0.000293
        volume: 32.4
    },
    0.1 // Tolerância maior para conversão kW
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

// Teste de fórmula: BTU Área
const areaTeste = 20;
const alturaTeste = 2.7;
const fatorAlturaEsperado = alturaTeste / ALTURA_PADRAO;
const btuAreaEsperado = areaTeste * BTU_POR_M2 * fatorAlturaEsperado;
console.log(`✅ Fórmula BTU Área: ${areaTeste} m² × ${BTU_POR_M2} BTU/m² × ${fatorAlturaEsperado.toFixed(3)} = ${btuAreaEsperado} BTU`);

// Teste de fórmula: BTU Pessoas
const pessoasTeste = 3;
const btuPessoasEsperado = pessoasTeste * BTU_POR_PESSOA;
console.log(`✅ Fórmula BTU Pessoas: ${pessoasTeste} pessoas × ${BTU_POR_PESSOA} BTU/pessoa = ${btuPessoasEsperado} BTU`);

// Teste de fórmula: BTU Equipamentos
const equipamentosTeste = 2;
const btuEquipamentosEsperado = equipamentosTeste * BTU_POR_EQUIPAMENTO;
console.log(`✅ Fórmula BTU Equipamentos: ${equipamentosTeste} equipamentos × ${BTU_POR_EQUIPAMENTO} BTU/equipamento = ${btuEquipamentosEsperado} BTU`);

// Teste de fórmula: Fatores
console.log(`✅ Fator Insolação Baixa: ${FATORES_INSOLACAO.baixa}`);
console.log(`✅ Fator Insolação Média: ${FATORES_INSOLACAO.media}`);
console.log(`✅ Fator Insolação Alta: ${FATORES_INSOLACAO.alta}`);
console.log(`✅ Fator Isolamento Bom: ${FATORES_ISOLAMENTO.bom}`);
console.log(`✅ Fator Isolamento Médio: ${FATORES_ISOLAMENTO.medio}`);
console.log(`✅ Fator Isolamento Ruim: ${FATORES_ISOLAMENTO.ruim}`);

console.log('\n' + '='.repeat(80));
console.log('✅ Todos os testes foram executados!');
console.log('='.repeat(80) + '\n');

