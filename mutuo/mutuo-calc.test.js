import { describe, it, expect } from 'vitest';
import {
    converterTaxaParaMensal,
    calcularPMT,
    calcularAmortizacao,
    totalizarTabela
} from './mutuo-calc.js';

const aprox = (n, casas = 2) => Number(n.toFixed(casas));

// ============================================
// Conversão de taxa
// ============================================

describe('converterTaxaParaMensal', () => {
    it('mes: passa direto (em fração)', () => {
        expect(aprox(converterTaxaParaMensal(1, 'mes'), 6)).toBe(0.01);
        expect(aprox(converterTaxaParaMensal(2.5, 'mes'), 6)).toBe(0.025);
    });

    it('ano: 12% a.a. ≈ 0,9489% a.m. (juros equivalentes, NÃO 1%)', () => {
        const tx = converterTaxaParaMensal(12, 'ano');
        expect(aprox(tx * 100, 4)).toBe(0.9489);
    });

    it('dia: 0,01% a.d. → composto 30 dias', () => {
        const tx = converterTaxaParaMensal(0.01, 'dia');
        const esperado = Math.pow(1.0001, 30) - 1;
        expect(aprox(tx, 8)).toBe(aprox(esperado, 8));
    });

    it('default desconhecido cai em "ano"', () => {
        expect(converterTaxaParaMensal(12, 'qualquer')).toBe(converterTaxaParaMensal(12, 'ano'));
    });
});

// ============================================
// PMT (Price)
// ============================================

describe('calcularPMT', () => {
    it('taxa zero → parcela = principal/n', () => {
        expect(calcularPMT(12000, 0, 12)).toBe(1000);
    });

    it('R$ 100.000, 1% a.m., 360 meses → ≈ R$ 1.028,61', () => {
        // Valor de referência verificável em qualquer calculadora financeira.
        expect(aprox(calcularPMT(100000, 0.01, 360))).toBe(1028.61);
    });

    it('n=1 → parcela ≈ principal × (1+i)', () => {
        expect(aprox(calcularPMT(1000, 0.05, 1))).toBe(1050);
    });

    it('n=0 retorna 0 (degenerado)', () => {
        expect(calcularPMT(1000, 0.01, 0)).toBe(0);
    });
});

// ============================================
// SAC — amortização constante
// ============================================

describe('calcularAmortizacao SAC', () => {
    const tab = calcularAmortizacao({
        valor: 12000, taxaMensal: 0.01, numParcelas: 12, sistema: 'sac'
    });

    it('gera 12 parcelas', () => {
        expect(tab.length).toBe(12);
    });

    it('amortização constante = principal/n', () => {
        for (const linha of tab) {
            expect(aprox(linha.amortizacao, 4)).toBe(1000);
        }
    });

    it('juros decrescentes ao longo do tempo', () => {
        for (let i = 1; i < tab.length; i++) {
            expect(tab[i].juros).toBeLessThan(tab[i - 1].juros);
        }
    });

    it('parcela 1 > parcela final (decrescente)', () => {
        expect(tab[0].parcela).toBeGreaterThan(tab[tab.length - 1].parcela);
    });

    it('saldo zera na última parcela', () => {
        expect(aprox(tab[tab.length - 1].saldo, 4)).toBe(0);
    });

    it('soma das amortizações = principal', () => {
        const totais = totalizarTabela(tab);
        expect(aprox(totais.totalAmortizado, 4)).toBe(12000);
    });
});

// ============================================
// Price — parcela fixa
// ============================================

describe('calcularAmortizacao Price', () => {
    const tab = calcularAmortizacao({
        valor: 100000, taxaMensal: 0.01, numParcelas: 360, sistema: 'price'
    });

    it('gera 360 parcelas', () => {
        expect(tab.length).toBe(360);
    });

    it('parcela aproximadamente constante (variação ≤ 0.05% entre máx e mín)', () => {
        const parcelas = tab.map((l) => l.parcela);
        const max = Math.max(...parcelas);
        const min = Math.min(...parcelas);
        // Pode haver leves desvios na última devido a ajuste de saldo.
        expect((max - min) / max).toBeLessThan(0.0005);
    });

    it('soma das amortizações = principal (precisão R$ 0,01)', () => {
        const totais = totalizarTabela(tab);
        expect(aprox(totais.totalAmortizado, 2)).toBe(100000);
    });

    it('saldo final = 0', () => {
        expect(aprox(tab[tab.length - 1].saldo, 2)).toBe(0);
    });
});

// ============================================
// Americano — só juros + principal no fim
// ============================================

describe('calcularAmortizacao Americano', () => {
    const tab = calcularAmortizacao({
        valor: 50000, taxaMensal: 0.02, numParcelas: 24, sistema: 'americano'
    });

    it('gera 24 parcelas', () => {
        expect(tab.length).toBe(24);
    });

    it('parcelas 1..23 amortizam zero (só juros)', () => {
        for (let i = 0; i < 23; i++) {
            expect(tab[i].amortizacao).toBe(0);
        }
    });

    it('última parcela quita o principal', () => {
        expect(aprox(tab[23].amortizacao)).toBe(50000);
    });

    it('juros constantes (saldo nunca muda até a quitação)', () => {
        for (let i = 0; i < 23; i++) {
            expect(aprox(tab[i].juros)).toBe(aprox(50000 * 0.02));
        }
    });

    it('saldo final = 0', () => {
        expect(aprox(tab[23].saldo, 2)).toBe(0);
    });
});

// ============================================
// Invariantes universais (todos os sistemas)
// ============================================

describe('Invariantes globais', () => {
    const cenarios = [
        { sistema: 'sac', valor: 80000, taxaMensal: 0.015, n: 60 },
        { sistema: 'price', valor: 80000, taxaMensal: 0.015, n: 60 },
        { sistema: 'americano', valor: 80000, taxaMensal: 0.015, n: 60 }
    ];

    cenarios.forEach(({ sistema, valor, taxaMensal, n }) => {
        it(`[${sistema}] Σ amortizações = principal`, () => {
            const tab = calcularAmortizacao({ valor, taxaMensal, numParcelas: n, sistema });
            const totais = totalizarTabela(tab);
            expect(aprox(totais.totalAmortizado, 2)).toBe(valor);
        });

        it(`[${sistema}] Σ amortizações + Σ juros = totalPago`, () => {
            const tab = calcularAmortizacao({ valor, taxaMensal, numParcelas: n, sistema });
            const totais = totalizarTabela(tab);
            expect(aprox(totais.totalAmortizado + totais.totalJuros + totais.totalExtras, 2))
                .toBe(aprox(totais.totalPago, 2));
        });
    });
});

// ============================================
// Pagamentos extras
// ============================================

describe('Pagamento extra recorrente', () => {
    it('extra anual reduz prazo efetivo e juros totais (Price)', () => {
        const semExtra = calcularAmortizacao({
            valor: 100000, taxaMensal: 0.01, numParcelas: 360, sistema: 'price'
        });
        const comExtra = calcularAmortizacao({
            valor: 100000, taxaMensal: 0.01, numParcelas: 360, sistema: 'price',
            extraPagamento: 5000, periodicidadeExtra: 'anual'
        });

        const tSemExtra = totalizarTabela(semExtra);
        const tComExtra = totalizarTabela(comExtra);

        expect(tComExtra.prazoEfetivo).toBeLessThan(tSemExtra.prazoEfetivo);
        expect(tComExtra.totalJuros).toBeLessThan(tSemExtra.totalJuros);
    });

    it('extra semestral aplica nas parcelas múltiplas de 6', () => {
        const tab = calcularAmortizacao({
            valor: 60000, taxaMensal: 0.01, numParcelas: 60, sistema: 'sac',
            extraPagamento: 1000, periodicidadeExtra: 'semestral'
        });
        // Parcelas com extra = múltiplos de 6 que ainda têm saldo
        const parcelasComExtra = tab.filter((l) => l.extraPagamento > 0);
        for (const p of parcelasComExtra) {
            expect(p.numero % 6).toBe(0);
        }
        expect(parcelasComExtra.length).toBeGreaterThan(0);
    });
});

describe('Pagamento extra específico (parcela X)', () => {
    it('extra na parcela 12 aparece naquela linha', () => {
        const tab = calcularAmortizacao({
            valor: 60000, taxaMensal: 0.01, numParcelas: 60, sistema: 'price',
            pagamentosExtrasEspecificos: [{ parcela: 12, valor: 5000 }]
        });
        expect(aprox(tab[11].extraPagamento)).toBe(5000);
    });

    it('extras duplicados na mesma parcela são somados', () => {
        const tab = calcularAmortizacao({
            valor: 60000, taxaMensal: 0.01, numParcelas: 60, sistema: 'sac',
            pagamentosExtrasEspecificos: [
                { parcela: 5, valor: 2000 },
                { parcela: 5, valor: 1500 }
            ]
        });
        expect(aprox(tab[4].extraPagamento)).toBe(3500);
    });

    it('extra específico maior que saldo é capado ao saldo', () => {
        const tab = calcularAmortizacao({
            valor: 10000, taxaMensal: 0.01, numParcelas: 24, sistema: 'sac',
            pagamentosExtrasEspecificos: [{ parcela: 1, valor: 999999 }]
        });
        // Saldo após primeira amortização normal é ~9583. Extra deveria zerar isso.
        expect(aprox(tab[0].saldo, 2)).toBe(0);
        expect(tab.length).toBe(1);
    });
});

// ============================================
// Edge cases
// ============================================

describe('Edge cases', () => {
    it('valor=0 retorna tabela vazia', () => {
        expect(calcularAmortizacao({ valor: 0, taxaMensal: 0.01, numParcelas: 12, sistema: 'price' }))
            .toEqual([]);
    });

    it('numParcelas=0 retorna tabela vazia', () => {
        expect(calcularAmortizacao({ valor: 1000, taxaMensal: 0.01, numParcelas: 0, sistema: 'sac' }))
            .toEqual([]);
    });

    it('numParcelas=1 (Price) → parcela única ≈ valor × (1+i)', () => {
        const tab = calcularAmortizacao({ valor: 1000, taxaMensal: 0.05, numParcelas: 1, sistema: 'price' });
        expect(tab.length).toBe(1);
        expect(aprox(tab[0].parcela)).toBe(1050);
        expect(aprox(tab[0].saldo, 2)).toBe(0);
    });

    it('taxa zero (Price) → parcela = valor/n e zero juros', () => {
        const tab = calcularAmortizacao({ valor: 1200, taxaMensal: 0, numParcelas: 12, sistema: 'price' });
        const totais = totalizarTabela(tab);
        expect(totais.totalJuros).toBe(0);
        expect(aprox(totais.totalAmortizado)).toBe(1200);
    });

    it('sistema desconhecido retorna tabela vazia (defesa)', () => {
        const tab = calcularAmortizacao({ valor: 1000, taxaMensal: 0.01, numParcelas: 12, sistema: 'inexistente' });
        expect(tab).toEqual([]);
    });
});
