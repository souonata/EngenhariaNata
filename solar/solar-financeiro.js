/**
 * solar-financeiro.js
 * Gráfico de retorno do investimento e análise financeira do sistema solar
 */

export const PRECO_KWH = {
    'pt-BR': 0.75,
    'it-IT': 0.30
};

export const AUMENTO_ANUAL_ENERGIA = {
    'pt-BR': 8.0,
    'it-IT': 6.0
};

function formatarMoedaComVirgula(valor, moeda, casas = 2) {
    if (isNaN(valor) || valor == null) return `${moeda} 0,00`;
    return `${moeda} ${Math.abs(valor).toLocaleString('pt-BR', {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas
    })}`;
}

function lerInputOuSlider(idInput, idSlider, padrao) {
    const inp = document.getElementById(idInput);
    const sld = document.getElementById(idSlider);
    const v = parseFloat((inp?.value || '').replace(',', '.'));
    if (!isNaN(v) && v > 0) return v;
    if (sld) return parseFloat(sld.value) || padrao;
    return padrao;
}

export function criarGraficoAmortizacao(dados, idiomaAtual) {
    const ctx = document.getElementById('graficoAmortizacao');
    if (!ctx || !dados?.custoTotal || !dados?.consumoMensal) return null;

    const {
        custoTotal,
        consumoMensal,
        custoBaterias = 0,
        vidaUtil = 20
    } = dados;

    const pt = idiomaAtual === 'pt-BR';
    const moeda = pt ? 'R$' : '€';

    // Período de análise
    const inputPA = document.getElementById('inputPeriodoAnalise');
    const sliderPA = document.getElementById('sliderPeriodoAnalise');
    const valorPA = parseInt(inputPA?.value) || parseInt(sliderPA?.value) || 25;
    const anosAnalise = Math.max(5, Math.min(200, valorPA));
    const mesesAnalise = anosAnalise * 12;

    // Parâmetros financeiros
    const precoKWh = lerInputOuSlider('inputPrecoKWh', 'sliderPrecoKWh', PRECO_KWH[idiomaAtual]);
    const aumentoAnual = lerInputOuSlider('inputAumentoAnualEnergia', 'sliderAumentoAnualEnergia', AUMENTO_ANUAL_ENERGIA[idiomaAtual]);
    const fator = 1 + aumentoAnual / 100;
    const economiaMensal = consumoMensal * precoKWh;

    // Eventos de custo (substituição de baterias e renovação do sistema)
    const eventos = [];
    if (vidaUtil > 0 && custoBaterias > 0) {
        let a = vidaUtil;
        while (a < anosAnalise) {
            if (a % 25 !== 0) {
                eventos.push({ mes: Math.round(a * 12), ano: a, tipo: 'bateria', valor: custoBaterias });
            }
            a += vidaUtil;
        }
    }
    let aRenov = 25;
    while (aRenov <= anosAnalise) {
        eventos.push({ mes: Math.round(aRenov * 12), ano: aRenov, tipo: 'sistema', valor: custoTotal });
        aRenov += 25;
    }
    eventos.sort((a, b) => a.mes - b.mes);

    // Custos acumulados até o mês M (O(|eventos|) por chamada)
    function custosAcumAteMes(m) {
        let c = custoTotal;
        for (const ev of eventos) {
            if (m >= ev.mes) c += ev.valor;
        }
        return c;
    }

    // Calcular saldos em O(mesesAnalise) passagem única
    // saldo[m] = economia_acumulada_ate_m - custos_acumulados_ate_m
    let economiaAcum = 0;
    const saldosPorMes = [0 - custoTotal]; // m=0: saldo = -investimento
    for (let m = 1; m <= mesesAnalise; m++) {
        economiaAcum += economiaMensal * Math.pow(fator, Math.floor((m - 1) / 12));
        saldosPorMes.push(economiaAcum - custosAcumAteMes(m));
    }

    // Payback: primeiro mês onde saldo >= 0
    let paybackMeses = null;
    for (let m = 1; m <= mesesAnalise; m++) {
        if (saldosPorMes[m] >= 0) { paybackMeses = m; break; }
    }

    // Construir set de meses de dados: intervalo base + pontos extras nos eventos
    const intervalo = anosAnalise <= 30 ? 6 : 12;
    const mesesDados = new Set();
    for (let m = 0; m <= mesesAnalise; m += intervalo) mesesDados.add(m);
    for (const ev of eventos) {
        if (ev.mes > 0 && ev.mes <= mesesAnalise) {
            mesesDados.add(ev.mes - 1);
            mesesDados.add(ev.mes);
        }
    }
    if (paybackMeses !== null) mesesDados.add(paybackMeses);

    const mesOrdenados = [...mesesDados].sort((a, b) => a - b);

    // Labels (ano, apenas em múltiplos de 5 ou no fim)
    const labels = mesOrdenados.map(m => {
        const a = m / 12;
        if (a === 0 || (Number.isInteger(a) && a % 5 === 0) || a === anosAnalise) {
            return `${a}${pt ? 'a' : 'a'}`;
        }
        return '';
    });

    const saldos = mesOrdenados.map(m => saldosPorMes[m]);

    const paybackIdx = paybackMeses !== null
        ? mesOrdenados.findIndex(m => m >= paybackMeses)
        : -1;

    // Mapear quais índices são pontos de evento
    const eventosPorMes = {};
    for (const ev of eventos) {
        eventosPorMes[ev.mes] = eventosPorMes[ev.mes] || [];
        eventosPorMes[ev.mes].push(ev);
    }

    // Cores CSS computadas
    const style = getComputedStyle(document.documentElement);
    const corTexto = style.getPropertyValue('--text-primary').trim() || '#333';
    const corGrid = style.getPropertyValue('--chart-grid').trim() || 'rgba(0,0,0,0.08)';

    const datasets = [
        {
            label: pt ? 'Investimento a Recuperar' : 'Investimento da Recuperare',
            data: saldos.map(v => v < 0 ? v : null),
            borderColor: 'rgba(244, 67, 54, 0.9)',
            backgroundColor: 'rgba(244, 67, 54, 0.12)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.25,
            pointRadius: 0,
            spanGaps: false
        },
        {
            label: pt ? 'Lucro Acumulado' : 'Profitto Accumulato',
            data: saldos.map(v => v >= 0 ? v : null),
            borderColor: 'rgba(25, 118, 210, 0.9)',
            backgroundColor: 'rgba(25, 118, 210, 0.12)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.25,
            pointRadius: 0,
            spanGaps: false
        },
        {
            // Linha de equilíbrio Y=0 — com ponto destacado no break-even
            label: pt ? 'Equilíbrio' : 'Equilibrio',
            data: saldos.map(() => 0),
            borderColor: 'rgba(128,128,128,0.35)',
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [5, 5],
            fill: false,
            tension: 0,
            pointRadius: saldos.map((_, i) => i === paybackIdx ? 10 : 0),
            pointBackgroundColor: saldos.map((_, i) => i === paybackIdx ? '#4CAF50' : 'transparent'),
            pointBorderColor: saldos.map((_, i) => i === paybackIdx ? '#fff' : 'transparent'),
            pointBorderWidth: saldos.map((_, i) => i === paybackIdx ? 2 : 0),
            pointHoverRadius: saldos.map((_, i) => i === paybackIdx ? 12 : 0)
        }
    ];

    const grafico = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { size: 12, weight: 'bold' },
                        color: corTexto,
                        padding: 14,
                        filter: item => item.text !== (pt ? 'Equilíbrio' : 'Equilibrio')
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const v = ctx.parsed.y;
                            if (v === null || v === undefined) return null;
                            const label = ctx.dataset.label;
                            if (label === (pt ? 'Equilíbrio' : 'Equilibrio')) return null;
                            const prefix = v < 0 ? '-' : '';
                            return `${label}: ${prefix}${formatarMoedaComVirgula(Math.abs(v), moeda, 0)}`;
                        },
                        filter: item => {
                            const label = item.dataset.label;
                            if (label === (pt ? 'Equilíbrio' : 'Equilibrio')) return false;
                            return item.parsed.y !== null && item.parsed.y !== undefined;
                        },
                        footer: tooltipItems => {
                            const dataIdx = tooltipItems[0]?.dataIndex;
                            if (dataIdx == null) return '';
                            const mesAtual = mesOrdenados[dataIdx];
                            const linhas = [];

                            // Mostrar eventos de custo que aconteceram neste ponto
                            if (eventosPorMes[mesAtual]) {
                                for (const ev of eventosPorMes[mesAtual]) {
                                    const nome = ev.tipo === 'bateria'
                                        ? (pt ? '🔋 Subst. baterias' : '🔋 Sost. batterie')
                                        : (pt ? '⚙️ Renovação do sistema' : '⚙️ Rinnovo del sistema');
                                    linhas.push(`${nome}: -${formatarMoedaComVirgula(ev.valor, moeda, 0)}`);
                                }
                            }

                            // Destacar o ponto de equilíbrio
                            if (dataIdx === paybackIdx) {
                                const anos = Math.floor(paybackMeses / 12);
                                const meses = paybackMeses % 12;
                                let texto = '';
                                if (pt) {
                                    if (anos > 0 && meses > 0) texto = `${anos}a e ${meses}m`;
                                    else if (anos > 0) texto = `${anos} ano${anos > 1 ? 's' : ''}`;
                                    else texto = `${meses} mês${meses !== 1 ? 'es' : ''}`;
                                    linhas.push(`⚖️ Ponto de equilíbrio: ${texto}`);
                                } else {
                                    if (anos > 0 && meses > 0) texto = `${anos}a e ${meses}m`;
                                    else if (anos > 0) texto = `${anos} anno${anos > 1 ? 'i' : ''}`;
                                    else texto = `${meses} mese${meses !== 1 ? 'i' : ''}`;
                                    linhas.push(`⚖️ Punto di equilibrio: ${texto}`);
                                }
                            }
                            return linhas;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: pt ? 'Tempo (anos)' : 'Tempo (anni)',
                        font: { size: 12, weight: 'bold' },
                        color: corTexto
                    },
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false,
                        color: corTexto
                    },
                    grid: { color: corGrid }
                },
                y: {
                    title: {
                        display: true,
                        text: pt ? `Saldo Financeiro (${moeda})` : `Saldo Finanziario (${moeda})`,
                        font: { size: 12, weight: 'bold' },
                        color: corTexto
                    },
                    ticks: {
                        color: corTexto,
                        callback: v => {
                            const abs = Math.abs(v);
                            const k = abs >= 1000 ? `${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k` : abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
                            return v < 0 ? `-${moeda} ${k}` : `${moeda} ${k}`;
                        }
                    },
                    grid: { color: corGrid }
                }
            }
        }
    });

    atualizarPainelFinanceiro(dados, paybackMeses, anosAnalise, eventos, economiaMensal, aumentoAnual, fator, precoKWh, moeda, idiomaAtual);

    return grafico;
}

function atualizarPainelFinanceiro(dados, paybackMeses, anosAnalise, eventos, economiaMensal, aumentoAnual, fator, precoKWh, moeda, idiomaAtual) {
    const el = document.getElementById('infoPayback');
    if (!el) return;

    const { custoTotal, consumoMensal, custoBaterias = 0, vidaUtil = 20 } = dados;
    const pt = idiomaAtual === 'pt-BR';

    // --- Seção 1: O que gera a economia ---
    const economiaAnual1 = economiaMensal * 12;
    const economiaAnual10 = economiaMensal * 12 * Math.pow(fator, 9);
    const economiaAnualN = economiaMensal * 12 * Math.pow(fator, anosAnalise - 1);

    // Economia total no período (série geométrica)
    let economiaTotalPeriodo;
    if (Math.abs(fator - 1) < 0.0001) {
        economiaTotalPeriodo = economiaAnual1 * anosAnalise;
    } else {
        economiaTotalPeriodo = economiaAnual1 * (Math.pow(fator, anosAnalise) - 1) / (fator - 1);
    }

    // --- Seção 2: Estrutura de custos ---
    const eventosBateria = eventos.filter(e => e.tipo === 'bateria');
    const eventosSistema = eventos.filter(e => e.tipo === 'sistema');
    const custoTotalBaterias = eventosBateria.reduce((s, e) => s + e.valor, 0);
    const custoTotalSistema = eventosSistema.reduce((s, e) => s + e.valor, 0);
    const custoTotalPeriodo = custoTotal + custoTotalBaterias + custoTotalSistema;

    // --- Seção 3: Resultado ---
    const saldoFinal = economiaTotalPeriodo - custoTotalPeriodo;
    const lucro = saldoFinal >= 0;

    const fmt = (v, c = 0) => formatarMoedaComVirgula(v, moeda, c);
    const pct = v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

    // Texto de payback
    let textoPayback;
    if (paybackMeses === null) {
        textoPayback = pt ? 'fora do período analisado' : 'fuori dal periodo analizzato';
    } else {
        const a = Math.floor(paybackMeses / 12);
        const m = paybackMeses % 12;
        if (pt) {
            textoPayback = a > 0 && m > 0 ? `${a} ano${a > 1 ? 's' : ''} e ${m} mês${m !== 1 ? 'es' : ''}`
                : a > 0 ? `${a} ano${a > 1 ? 's' : ''}`
                : `${m} mês${m !== 1 ? 'es' : ''}`;
        } else {
            textoPayback = a > 0 && m > 0 ? `${a} anno${a > 1 ? 'i' : ''} e ${m} mese${m !== 1 ? 'i' : ''}`
                : a > 0 ? `${a} anno${a > 1 ? 'i' : ''}`
                : `${m} mese${m !== 1 ? 'i' : ''}`;
        }
    }

    // Helper para linha de tabela
    const tr = (a, b, destaque = false) =>
        `<tr style="${destaque ? 'font-weight:700;border-top:1px solid var(--border-color)' : ''}">
            <td style="padding:3px 6px;text-align:left;white-space:nowrap;">${a}</td>
            <td style="padding:3px 6px;text-align:right;white-space:nowrap;">${b}</td>
        </tr>`;

    const secao = (titulo, conteudo) =>
        `<div style="margin:10px 0 4px;padding:10px 12px;background:var(--surface-muted);border-radius:8px;font-size:0.88em;">
            <div style="font-weight:700;font-size:0.93em;margin-bottom:6px;">${titulo}</div>
            ${conteudo}
        </div>`;

    let html = '';

    if (pt) {
        // SEÇÃO 1 — Economia
        let rowsEconomia = tr('Consumo protegido', `${consumoMensal.toLocaleString('pt-BR', {maximumFractionDigits: 1})} kWh/mês`)
            + tr('Tarifa atual (kWh)', `${moeda} ${precoKWh.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`)
            + tr('Economia no 1º ano', `${fmt(economiaAnual1)}`)
            + tr(`Aumento anual previsto`, `${pct(aumentoAnual)}/ano`);
        if (anosAnalise >= 10) rowsEconomia += tr(`Economia no 10º ano`, `${fmt(economiaAnual10)}`);
        if (anosAnalise > 10) rowsEconomia += tr(`Economia no ${anosAnalise}º ano`, `${fmt(economiaAnualN)}`);
        rowsEconomia += tr(`Economia total em ${anosAnalise} anos`, `${fmt(economiaTotalPeriodo)}`, true);

        html += secao('📈 O que gera sua economia com o solar',
            `<table style="width:100%;border-collapse:collapse;">${rowsEconomia}</table>`);

        // SEÇÃO 2 — Custos
        let rowsCustos = tr('Investimento inicial (hoje)', fmt(custoTotal));
        if (eventosBateria.length > 0) {
            const anosB = eventosBateria.map(e => `${e.ano}a`).join(', ');
            rowsCustos += tr(
                `Subst. baterias (a cada ${vidaUtil}a) × ${eventosBateria.length}`,
                `${fmt(custoBaterias)}/vez = ${fmt(custoTotalBaterias)}`
            );
            rowsCustos += `<tr><td colspan="2" style="padding:0 6px 3px;font-size:0.9em;color:var(--text-secondary);">
                → Prevista${eventosBateria.length > 1 ? 's' : ''} nos anos: ${anosB}</td></tr>`;
        }
        if (eventosSistema.length > 0) {
            const anosS = eventosSistema.map(e => `${e.ano}a`).join(', ');
            rowsCustos += tr(
                `Renovação completa (a cada 25a) × ${eventosSistema.length}`,
                `${fmt(custoTotal)}/vez = ${fmt(custoTotalSistema)}`
            );
            rowsCustos += `<tr><td colspan="2" style="padding:0 6px 3px;font-size:0.9em;color:var(--text-secondary);">
                → Prevista${eventosSistema.length > 1 ? 's' : ''} nos anos: ${anosS}</td></tr>`;
        }
        rowsCustos += tr(`Total de custos em ${anosAnalise} anos`, fmt(custoTotalPeriodo), true);

        html += secao('💸 Estrutura de custos do sistema',
            `<table style="width:100%;border-collapse:collapse;">${rowsCustos}</table>`);

        // SEÇÃO 3 — Resultado
        const corResultado = lucro ? '#1976D2' : '#F44336';
        html += `<div style="margin-top:10px;padding:10px 12px;background:${lucro ? 'rgba(25,118,210,0.08)' : 'rgba(244,67,54,0.08)'};border-radius:8px;border-left:4px solid ${corResultado};font-size:0.88em;">
            <div style="margin-bottom:4px;">⚖️ <strong>Ponto de equilíbrio:</strong> ${paybackMeses ? `<span style="color:${corResultado};font-weight:700;">${textoPayback}</span>` : textoPayback}</div>
            <div>💵 <strong>${lucro ? 'Lucro' : 'Prejuízo'} líquido em ${anosAnalise} anos:</strong>
                <span style="color:${corResultado};font-weight:700;"> ${fmt(Math.abs(saldoFinal))}</span>
            </div>
        </div>`;

    } else {
        // --- versão italiana ---
        let rowsEconomia = tr('Consumo protetto', `${consumoMensal.toLocaleString('it-IT', {maximumFractionDigits: 1})} kWh/mese`)
            + tr('Tariffa attuale (kWh)', `${moeda} ${precoKWh.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`)
            + tr('Risparmio nel 1° anno', `${fmt(economiaAnual1)}`)
            + tr('Aumento annuo previsto', `${pct(aumentoAnual)}/anno`);
        if (anosAnalise >= 10) rowsEconomia += tr('Risparmio nel 10° anno', `${fmt(economiaAnual10)}`);
        if (anosAnalise > 10) rowsEconomia += tr(`Risparmio nel ${anosAnalise}° anno`, `${fmt(economiaAnualN)}`);
        rowsEconomia += tr(`Risparmio totale in ${anosAnalise} anni`, `${fmt(economiaTotalPeriodo)}`, true);

        html += secao('📈 Cosa genera il tuo risparmio con il solare',
            `<table style="width:100%;border-collapse:collapse;">${rowsEconomia}</table>`);

        let rowsCustos = tr('Investimento iniziale (oggi)', fmt(custoTotal));
        if (eventosBateria.length > 0) {
            const anosB = eventosBateria.map(e => `${e.ano}a`).join(', ');
            rowsCustos += tr(
                `Sost. batterie (ogni ${vidaUtil}a) × ${eventosBateria.length}`,
                `${fmt(custoBaterias)}/volta = ${fmt(custoTotalBaterias)}`
            );
            rowsCustos += `<tr><td colspan="2" style="padding:0 6px 3px;font-size:0.9em;color:var(--text-secondary);">
                → Prevista${eventosBateria.length > 1 ? 'e' : ''} negli anni: ${anosB}</td></tr>`;
        }
        if (eventosSistema.length > 0) {
            const anosS = eventosSistema.map(e => `${e.ano}a`).join(', ');
            rowsCustos += tr(
                `Rinnovo completo (ogni 25a) × ${eventosSistema.length}`,
                `${fmt(custoTotal)}/volta = ${fmt(custoTotalSistema)}`
            );
            rowsCustos += `<tr><td colspan="2" style="padding:0 6px 3px;font-size:0.9em;color:var(--text-secondary);">
                → Previsto negli anni: ${anosS}</td></tr>`;
        }
        rowsCustos += tr(`Costo totale in ${anosAnalise} anni`, fmt(custoTotalPeriodo), true);

        html += secao('💸 Struttura dei costi del sistema',
            `<table style="width:100%;border-collapse:collapse;">${rowsCustos}</table>`);

        const corR = lucro ? '#1976D2' : '#F44336';
        html += `<div style="margin-top:10px;padding:10px 12px;background:${lucro ? 'rgba(25,118,210,0.08)' : 'rgba(244,67,54,0.08)'};border-radius:8px;border-left:4px solid ${corR};font-size:0.88em;">
            <div style="margin-bottom:4px;">⚖️ <strong>Punto di equilibrio:</strong> ${paybackMeses ? `<span style="color:${corR};font-weight:700;">${textoPayback}</span>` : textoPayback}</div>
            <div>💵 <strong>${lucro ? 'Profitto' : 'Perdita'} nett${lucro ? 'o' : 'a'} in ${anosAnalise} anni:</strong>
                <span style="color:${corR};font-weight:700;"> ${fmt(Math.abs(saldoFinal))}</span>
            </div>
        </div>`;
    }

    el.innerHTML = `<div style="margin-top:8px;">${html}</div>`;
}
