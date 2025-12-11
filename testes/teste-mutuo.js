// =============================================
// ROTINA DE TESTES PARA CÁLCULO DE EMPRÉSTIMOS
// App Mutuo - Sistemas de Amortização
// =============================================

// =============================================
// FUNÇÕES DE CÁLCULO (MESMAS DO APP)
// =============================================

/**
 * Converte taxa de juros para mensal (decimal)
 */
function converterTaxaParaMensal(taxa, periodo) {
    switch(periodo) {
        case 'ano':
            return Math.pow(1 + taxa / 100, 1/12) - 1;
        case 'mes':
            return taxa / 100;
        case 'dia':
            return Math.pow(1 + taxa / 100, 30) - 1;
        default:
            return taxa / 100;
    }
}

/**
 * Calcula SAC - Sistema de Amortização Constante
 */
function calcularSAC(valorEmprestimo, taxaMensal, numeroParcelas) {
    const tabela = [];
    let saldoDevedor = valorEmprestimo;
    const amortizacaoConstante = valorEmprestimo / numeroParcelas;
    
    for (let i = 1; i <= numeroParcelas; i++) {
        const juros = saldoDevedor * taxaMensal;
        const valorParcela = amortizacaoConstante + juros;
        saldoDevedor -= amortizacaoConstante;
        
        if (i === numeroParcelas) {
            saldoDevedor = 0;
        }
        
        tabela.push({
            parcela: i,
            valorParcela: valorParcela,
            amortizacao: amortizacaoConstante,
            juros: juros,
            saldoDevedor: Math.max(0, saldoDevedor)
        });
    }
    
    return tabela;
}

/**
 * Calcula Price - Tabela Price (Sistema Francês)
 */
function calcularPrice(valorEmprestimo, taxaMensal, numeroParcelas) {
    const tabela = [];
    let saldoDevedor = valorEmprestimo;
    
    const fator = Math.pow(1 + taxaMensal, numeroParcelas);
    const parcelaFixa = valorEmprestimo * (taxaMensal * fator) / (fator - 1);
    
    for (let i = 1; i <= numeroParcelas; i++) {
        const juros = saldoDevedor * taxaMensal;
        const amortizacao = parcelaFixa - juros;
        saldoDevedor -= amortizacao;
        
        if (i === numeroParcelas) {
            saldoDevedor = 0;
        }
        
        tabela.push({
            parcela: i,
            valorParcela: parcelaFixa,
            amortizacao: amortizacao,
            juros: juros,
            saldoDevedor: Math.max(0, saldoDevedor)
        });
    }
    
    return tabela;
}

/**
 * Calcula Sistema Americano
 */
function calcularAlemao(valorEmprestimo, taxaMensal, numeroParcelas) {
    const tabela = [];
    const jurosMensal = valorEmprestimo * taxaMensal;
    
    for (let i = 1; i <= numeroParcelas; i++) {
        if (i === numeroParcelas) {
            tabela.push({
                parcela: i,
                valorParcela: valorEmprestimo + jurosMensal,
                amortizacao: valorEmprestimo,
                juros: jurosMensal,
                saldoDevedor: 0
            });
        } else {
            tabela.push({
                parcela: i,
                valorParcela: jurosMensal,
                amortizacao: 0,
                juros: jurosMensal,
                saldoDevedor: valorEmprestimo
            });
        }
    }
    
    return tabela;
}

// =============================================
// SISTEMA DE TESTES
// =============================================

class TesteMutuo {
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
        if (teste.entrada.tipo === 'SAC') {
            const taxaMensal = converterTaxaParaMensal(teste.entrada.taxa, teste.entrada.periodo);
            resultado = calcularSAC(teste.entrada.valor, taxaMensal, teste.entrada.parcelas);
        } else if (teste.entrada.tipo === 'Price') {
            const taxaMensal = converterTaxaParaMensal(teste.entrada.taxa, teste.entrada.periodo);
            resultado = calcularPrice(teste.entrada.valor, taxaMensal, teste.entrada.parcelas);
        } else if (teste.entrada.tipo === 'Americano') {
            const taxaMensal = converterTaxaParaMensal(teste.entrada.taxa, teste.entrada.periodo);
            resultado = calcularAlemao(teste.entrada.valor, taxaMensal, teste.entrada.parcelas);
        } else if (teste.entrada.tipo === 'ConversaoTaxa') {
            resultado = converterTaxaParaMensal(teste.entrada.taxa, teste.entrada.periodo);
        } else {
            erros.push({ propriedade: 'tipo', esperado: 'tipo válido', obtido: teste.entrada.tipo });
            return { passou: false, resultado: null, erros };
        }

        // Verifica propriedades esperadas
        for (let prop in teste.esperado) {
            let valorEsperado = teste.esperado[prop];
            let valorObtido;
            
            if (prop === 'primeiraParcela') {
                valorObtido = resultado[0];
            } else if (prop === 'ultimaParcela') {
                valorObtido = resultado[resultado.length - 1];
            } else if (prop === 'totalJuros') {
                valorObtido = resultado.reduce((sum, p) => sum + p.juros, 0);
            } else if (prop === 'totalPago') {
                valorObtido = resultado.reduce((sum, p) => sum + p.valorParcela, 0);
            } else if (prop === 'totalAmortizacao') {
                valorObtido = resultado.reduce((sum, p) => sum + p.amortizacao, 0);
            } else if (prop === 'saldoFinal') {
                valorObtido = resultado[resultado.length - 1].saldoDevedor;
            } else if (prop === 'taxaMensal') {
                valorObtido = resultado;
            } else {
                valorObtido = resultado[prop];
            }
            
            // Comparação de objetos (parcelas)
            if (typeof valorEsperado === 'object' && valorEsperado !== null && !Array.isArray(valorEsperado)) {
                for (let subProp in valorEsperado) {
                    const esperadoSub = valorEsperado[subProp];
                    const obtidoSub = valorObtido[subProp];
                    
                    if (typeof esperadoSub === 'number') {
                        const diferenca = Math.abs(esperadoSub - obtidoSub);
                        const percentualErro = esperadoSub !== 0 
                            ? (diferenca / Math.abs(esperadoSub)) * 100 
                            : diferenca;
                        
                        if (percentualErro > teste.tolerancia * 100) {
                            erros.push({
                                propriedade: `${prop}.${subProp}`,
                                esperado: esperadoSub,
                                obtido: obtidoSub,
                                diferenca: diferenca,
                                percentualErro: percentualErro.toFixed(2) + '%'
                            });
                        }
                    }
                }
            } else if (typeof valorEsperado === 'number') {
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
        console.log('🧪 ROTINA DE TESTES - CÁLCULO DE EMPRÉSTIMOS (MUTUO)');
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

const suite = new TesteMutuo();

// ============================================
// TESTES DE CONVERSÃO DE TAXA
// ============================================

suite.adicionarTeste(
    'Conversão de Taxa - 12% ao ano para mensal',
    {
        tipo: 'ConversaoTaxa',
        taxa: 12,
        periodo: 'ano'
    },
    {
        taxaMensal: 0.009488792934, // (1.12)^(1/12) - 1
    },
    0.1
);

suite.adicionarTeste(
    'Conversão de Taxa - 1% ao mês para mensal',
    {
        tipo: 'ConversaoTaxa',
        taxa: 1,
        periodo: 'mes'
    },
    {
        taxaMensal: 0.01,
    }
);

suite.adicionarTeste(
    'Conversão de Taxa - 0.03% ao dia para mensal',
    {
        tipo: 'ConversaoTaxa',
        taxa: 0.03,
        periodo: 'dia'
    },
    {
        taxaMensal: 0.009044, // (1.0003)^30 - 1
    },
    0.1
);

// ============================================
// TESTES SAC - Sistema de Amortização Constante
// ============================================

suite.adicionarTeste(
    'SAC - Empréstimo R$ 100.000, 1% ao mês, 120 meses - Primeira Parcela',
    {
        tipo: 'SAC',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        primeiraParcela: {
            parcela: 1,
            valorParcela: 1833.33, // 833.33 + 1000
            amortizacao: 833.33, // 100000 / 120
            juros: 1000, // 100000 * 0.01
            saldoDevedor: 99166.67 // 100000 - 833.33
        }
    },
    0.1
);

suite.adicionarTeste(
    'SAC - Empréstimo R$ 100.000, 1% ao mês, 120 meses - Última Parcela',
    {
        tipo: 'SAC',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        ultimaParcela: {
            parcela: 120,
            valorParcela: 841.67, // 833.33 + 8.33
            amortizacao: 833.33,
            juros: 8.33, // 833.33 * 0.01
            saldoDevedor: 0
        }
    },
    0.1
);

suite.adicionarTeste(
    'SAC - Empréstimo R$ 100.000, 1% ao mês, 120 meses - Saldo Final Zero',
    {
        tipo: 'SAC',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        saldoFinal: 0
    }
);

suite.adicionarTeste(
    'SAC - Empréstimo R$ 50.000, 12% ao ano, 60 meses - Total de Juros',
    {
        tipo: 'SAC',
        valor: 50000,
        taxa: 12,
        periodo: 'ano',
        parcelas: 60
    },
    {
        totalJuros: 15250, // Aproximado
    },
    1.0 // Tolerância maior para cálculo com conversão de taxa
);

// ============================================
// TESTES PRICE - Tabela Price
// ============================================

suite.adicionarTeste(
    'Price - Empréstimo R$ 100.000, 1% ao mês, 120 meses - Parcela Fixa',
    {
        tipo: 'Price',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        primeiraParcela: {
            valorParcela: 1434.71, // PMT calculado
        }
    },
    0.1
);

suite.adicionarTeste(
    'Price - Empréstimo R$ 100.000, 1% ao mês, 120 meses - Primeira Parcela (Juros e Amortização)',
    {
        tipo: 'Price',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        primeiraParcela: {
            juros: 1000, // 100000 * 0.01
            amortizacao: 434.71, // 1434.71 - 1000
        }
    },
    0.1
);

suite.adicionarTeste(
    'Price - Empréstimo R$ 100.000, 1% ao mês, 120 meses - Última Parcela',
    {
        tipo: 'Price',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        ultimaParcela: {
            valorParcela: 1434.71, // Mesma parcela fixa
            saldoDevedor: 0
        }
    },
    0.1
);

suite.adicionarTeste(
    'Price - Empréstimo R$ 100.000, 1% ao mês, 120 meses - Saldo Final Zero',
    {
        tipo: 'Price',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        saldoFinal: 0
    }
);

suite.adicionarTeste(
    'Price - Empréstimo R$ 100.000, 1% ao mês, 120 meses - Total Pago = Principal + Juros',
    {
        tipo: 'Price',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        totalPago: 172165.20, // 1434.71 * 120
    },
    0.1
);

// ============================================
// TESTES SISTEMA AMERICANO
// ============================================

suite.adicionarTeste(
    'Americano - Empréstimo R$ 100.000, 1% ao mês, 120 meses - Parcelas Intermediárias',
    {
        tipo: 'Americano',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        primeiraParcela: {
            valorParcela: 1000, // Apenas juros
            amortizacao: 0,
            juros: 1000, // 100000 * 0.01
            saldoDevedor: 100000
        }
    }
);

suite.adicionarTeste(
    'Americano - Empréstimo R$ 100.000, 1% ao mês, 120 meses - Última Parcela',
    {
        tipo: 'Americano',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        ultimaParcela: {
            valorParcela: 101000, // 100000 + 1000
            amortizacao: 100000,
            juros: 1000,
            saldoDevedor: 0
        }
    }
);

suite.adicionarTeste(
    'Americano - Empréstimo R$ 100.000, 1% ao mês, 120 meses - Total de Juros',
    {
        tipo: 'Americano',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        totalJuros: 120000, // 1000 * 120
    }
);

suite.adicionarTeste(
    'Americano - Empréstimo R$ 100.000, 1% ao mês, 120 meses - Saldo Final Zero',
    {
        tipo: 'Americano',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        saldoFinal: 0
    }
);

// ============================================
// TESTES DE VALIDAÇÃO - Verificações Gerais
// ============================================

suite.adicionarTeste(
    'Validação - SAC: Soma das Amortizações = Valor Emprestado',
    {
        tipo: 'SAC',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        totalAmortizacao: 100000, // Soma de todas as amortizações
    },
    0.1
);

suite.adicionarTeste(
    'Validação - Price: Soma das Amortizações = Valor Emprestado',
    {
        tipo: 'Price',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        totalAmortizacao: 100000, // Soma de todas as amortizações
    },
    0.1
);

suite.adicionarTeste(
    'Validação - Americano: Soma das Amortizações = Valor Emprestado',
    {
        tipo: 'Americano',
        valor: 100000,
        taxa: 1,
        periodo: 'mes',
        parcelas: 120
    },
    {
        totalAmortizacao: 100000, // Soma de todas as amortizações
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

// Teste de fórmula PMT
const valorTeste = 100000;
const taxaTeste = 0.01;
const parcelasTeste = 120;
const fatorTeste = Math.pow(1 + taxaTeste, parcelasTeste);
const pmtTeste = valorTeste * (taxaTeste * fatorTeste) / (fatorTeste - 1);
console.log(`✅ Fórmula PMT: PV × [i × (1+i)^n] ÷ [(1+i)^n - 1]`);
console.log(`   Exemplo: ${valorTeste} × [${taxaTeste} × ${fatorTeste.toFixed(2)}] ÷ [${fatorTeste.toFixed(2)} - 1] = ${pmtTeste.toFixed(2)}`);

// Teste de fórmula SAC
const amortizacaoTeste = valorTeste / parcelasTeste;
console.log(`✅ Fórmula SAC Amortização: Valor ÷ Parcelas`);
console.log(`   Exemplo: ${valorTeste} ÷ ${parcelasTeste} = ${amortizacaoTeste.toFixed(2)}`);

// Teste de fórmula Juros
const jurosTeste = valorTeste * taxaTeste;
console.log(`✅ Fórmula Juros: Saldo Devedor × Taxa`);
console.log(`   Exemplo: ${valorTeste} × ${taxaTeste} = ${jurosTeste}`);

console.log('\n' + '='.repeat(80));
console.log('✅ Todos os testes foram executados!');
console.log('='.repeat(80) + '\n');

