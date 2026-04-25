/**
 * Papel no projeto:
 * - Núcleo numérico do simulador de financiamento (mutuo / empréstimo).
 * - Funções puras para SAC, Price, Americano, com suporte a pagamentos extras
 *   recorrentes (semestrais/anuais) e extras pontuais em parcelas específicas.
 * - Sem DOM, sem i18n, sem dependência de classes.
 *
 * Pontos seguros para IA editar:
 * - novos sistemas de amortização;
 * - regras de pagamentos extras;
 * - conversões de periodicidade da taxa.
 *
 * Cuidados antes de mexer:
 * - alterações afetam tanto a UI quanto os testes;
 * - manter formato dos objetos de saída (tabela com {numero, parcela, amortizacao, juros, extraPagamento, saldo}).
 */

/**
 * Converte taxa de juros nominal para taxa mensal equivalente.
 * @param {number} taxaPct  Taxa em percentual (ex: 12 = 12%).
 * @param {'ano'|'mes'|'dia'} periodicidade
 * @returns {number} taxa mensal em fração decimal (ex: 0.00949)
 */
export function converterTaxaParaMensal(taxaPct, periodicidade) {
    if (periodicidade === 'mes') {
        return taxaPct / 100;
    }
    if (periodicidade === 'dia') {
        // Dia → mês via composição (30 dias).
        return Math.pow(1 + taxaPct / 100, 30) - 1;
    }
    // Padrão: anual → mensal equivalente.
    return Math.pow(1 + taxaPct / 100, 1 / 12) - 1;
}

/**
 * Parcela fixa do sistema Price (PMT — Present value of an annuity).
 * @param {number} valor       Principal.
 * @param {number} taxaMensal  Taxa em fração decimal.
 * @param {number} n           Número de parcelas.
 */
export function calcularPMT(valor, taxaMensal, n) {
    if (n <= 0) return 0;
    if (taxaMensal === 0) return valor / n;
    return valor * (taxaMensal * Math.pow(1 + taxaMensal, n))
        / (Math.pow(1 + taxaMensal, n) - 1);
}

/**
 * Decide se o número da parcela recebe pagamento extra recorrente.
 */
function deveAplicarExtra(numeroParcela, extraPagamento, periodicidadeExtra) {
    if (!extraPagamento || extraPagamento <= 0) return false;
    if (periodicidadeExtra === 'semestral') return numeroParcela % 6 === 0;
    if (periodicidadeExtra === 'anual') return numeroParcela % 12 === 0;
    return false;
}

/**
 * Constrói o Map de extras pontuais por parcela (somando duplicidades).
 */
function montarMapaExtrasEspecificos(pagamentosExtrasEspecificos = []) {
    return pagamentosExtrasEspecificos.reduce((acc, item) => {
        const parcela = parseInt(item.parcela, 10);
        const valorExtra = parseFloat(item.valor);
        if (!isNaN(parcela) && !isNaN(valorExtra) && valorExtra > 0) {
            acc.set(parcela, (acc.get(parcela) || 0) + valorExtra);
        }
        return acc;
    }, new Map());
}

/**
 * Calcula a tabela de amortização para SAC, Price ou Americano.
 *
 * @param {object} dados
 * @param {number} dados.valor                              Principal emprestado.
 * @param {number} dados.taxaMensal                         Taxa mensal em fração (0.01 = 1%).
 * @param {number} dados.numParcelas
 * @param {'sac'|'price'|'americano'} dados.sistema
 * @param {number} [dados.extraPagamento]                   Valor de extra recorrente.
 * @param {'semestral'|'anual'} [dados.periodicidadeExtra]
 * @param {Array<{parcela:number, valor:number}>} [dados.pagamentosExtrasEspecificos]
 * @returns {Array<{numero:number, parcela:number, amortizacao:number, juros:number, extraPagamento:number, saldo:number}>}
 */
export function calcularAmortizacao(dados) {
    const {
        valor,
        taxaMensal,
        numParcelas,
        sistema,
        extraPagamento = 0,
        periodicidadeExtra,
        pagamentosExtrasEspecificos = []
    } = dados;

    const tabela = [];
    if (valor <= 0 || numParcelas <= 0) return tabela;

    const mapaExtras = montarMapaExtrasEspecificos(pagamentosExtrasEspecificos);
    const aplicarExtra = (n) => deveAplicarExtra(n, extraPagamento, periodicidadeExtra);

    if (sistema === 'sac') {
        const amortizacaoFixa = valor / numParcelas;
        let saldo = valor;

        for (let i = 1; i <= numParcelas; i++) {
            if (saldo <= 0) break;

            const juros = saldo * taxaMensal;
            const amortizacao = Math.min(amortizacaoFixa, saldo);
            const saldoAposBase = saldo - amortizacao;
            const extraSolicitado = (aplicarExtra(i) ? extraPagamento : 0)
                + (mapaExtras.get(i) || 0);
            const extraAplicado = Math.min(extraSolicitado, saldoAposBase);
            const parcela = amortizacao + juros + extraAplicado;
            saldo = saldoAposBase - extraAplicado;

            tabela.push({
                numero: i,
                parcela,
                amortizacao,
                juros,
                extraPagamento: extraAplicado,
                saldo: Math.max(0, saldo)
            });
        }
    } else if (sistema === 'price') {
        const pmt = calcularPMT(valor, taxaMensal, numParcelas);
        let saldo = valor;

        for (let i = 1; i <= numParcelas; i++) {
            if (saldo <= 0) break;

            const juros = saldo * taxaMensal;
            const amortizacaoBase = Math.max(0, pmt - juros);
            const amortizacao = Math.min(amortizacaoBase, saldo);
            const saldoAposBase = saldo - amortizacao;
            const extraSolicitado = (aplicarExtra(i) ? extraPagamento : 0)
                + (mapaExtras.get(i) || 0);
            const extraAplicado = Math.min(extraSolicitado, saldoAposBase);
            const parcela = amortizacao + juros + extraAplicado;
            saldo = saldoAposBase - extraAplicado;

            tabela.push({
                numero: i,
                parcela,
                amortizacao,
                juros,
                extraPagamento: extraAplicado,
                saldo: Math.max(0, saldo)
            });
        }
    } else if (sistema === 'americano') {
        let saldo = valor;

        for (let i = 1; i <= numParcelas; i++) {
            if (saldo <= 0) break;

            const juros = saldo * taxaMensal;
            // Última parcela quita o principal; antes só paga juros.
            const amortizacao = i === numParcelas ? saldo : 0;
            const saldoAposBase = saldo - amortizacao;
            // Extras só nas parcelas intermediárias (não na quitação final).
            const extraRecorrente = (i < numParcelas && aplicarExtra(i)) ? extraPagamento : 0;
            const extraEspecifico = i < numParcelas ? (mapaExtras.get(i) || 0) : 0;
            const extraAplicado = Math.min(extraRecorrente + extraEspecifico, saldoAposBase);
            const parcela = amortizacao + juros + extraAplicado;
            saldo = saldoAposBase - extraAplicado;

            tabela.push({
                numero: i,
                parcela,
                amortizacao,
                juros,
                extraPagamento: extraAplicado,
                saldo: Math.max(0, saldo)
            });
        }
    }

    return tabela;
}

/**
 * Totalizadores para uma tabela de amortização.
 * @returns {{ totalPago:number, totalJuros:number, totalAmortizado:number, totalExtras:number, prazoEfetivo:number }}
 */
export function totalizarTabela(tabela) {
    let totalPago = 0;
    let totalJuros = 0;
    let totalAmortizado = 0;
    let totalExtras = 0;
    for (const linha of tabela) {
        totalPago += linha.parcela;
        totalJuros += linha.juros;
        totalAmortizado += linha.amortizacao;
        totalExtras += linha.extraPagamento || 0;
    }
    return {
        totalPago,
        totalJuros,
        totalAmortizado,
        totalExtras,
        prazoEfetivo: tabela.length
    };
}
