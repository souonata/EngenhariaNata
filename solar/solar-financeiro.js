/**
 * solar-financeiro.js
 * Módulo com funções de cálculos financeiros e gráfico de amortização
 * Para integrar no solar-script-new.js
 */

// Preços médios de energia elétrica (2024-2025)
export const PRECO_KWH = {
    'pt-BR': 0.75,  // R$/kWh
    'it-IT': 0.30   // €/kWh
};

// Aumento anual do custo da energia (%)
export const AUMENTO_ANUAL_ENERGIA = {
    'pt-BR': 8.0,   // % ao ano (Brasil)
    'it-IT': 6.0    // % ao ano (Itália)
};

/**
 * Formata moeda com vírgula como separador decimal
 */
export function formatarMoedaComVirgula(valor, moeda, casasDecimais = 2) {
    if (isNaN(valor) || valor === null || valor === undefined) return `${moeda} 0,00`;
    return `${moeda} ${valor.toLocaleString('pt-BR', {
        minimumFractionDigits: casasDecimais,
        maximumFractionDigits: casasDecimais
    })}`;
}

/**
 * Cria e atualiza o gráfico de amortização financeira
 */
export function criarGraficoAmortizacao(dados, idiomaAtual) {
    const ctx = document.getElementById('graficoAmortizacao');
    if (!ctx) {
        console.warn('[Solar] Canvas graficoAmortizacao não encontrado');
        return null;
    }
    
    // Validar dados necessários
    if (!dados || !dados.custoTotal || !dados.consumoMensal) {
        console.warn('[Solar] Dados insuficientes para o gráfico');
        return null;
    }
    
    const {
        custoTotal,
        consumoMensal,
        custoBaterias,
        vidaUtil = 20,
        tipoBateria = 'litio'
    } = dados;
    
    // Determinar vida útil máxima baseada no tipo de bateria
    const vidaUtilMaxima = tipoBateria === 'litio' ? 25 : 5;
    
    // Obter período de análise (padrão: 25 anos para lítio, 5 para AGM)
    const sliderPeriodoAnalise = document.getElementById('sliderPeriodoAnalise');
    let anosAnalise = vidaUtilMaxima;
    
    if (sliderPeriodoAnalise) {
        sliderPeriodoAnalise.min = vidaUtilMaxima.toString();
        sliderPeriodoAnalise.max = (vidaUtilMaxima * 4).toString();
        anosAnalise = parseInt(sliderPeriodoAnalise.value) || vidaUtilMaxima;
        anosAnalise = Math.max(vidaUtilMaxima, Math.min(vidaUtilMaxima * 4, anosAnalise));
    }
    
    const mesesAnalise = anosAnalise * 12;
    
    // Obter preço do kWh
    const sliderPrecoKWh = document.getElementById('sliderPrecoKWh');
    const precoKWh = sliderPrecoKWh ? parseFloat(sliderPrecoKWh.value) : PRECO_KWH[idiomaAtual];
    
    // Obter aumento anual
    const sliderAumentoAnual = document.getElementById('sliderAumentoAnualEnergia');
    const aumentoAnualPercentual = sliderAumentoAnual 
        ? parseFloat(sliderAumentoAnual.value) 
        : AUMENTO_ANUAL_ENERGIA[idiomaAtual];
    const fatorAumentoAnual = 1 + (aumentoAnualPercentual / 100);
    
    // Calcular economia mensal
    const economiaMensal = consumoMensal * precoKWh;
    const moeda = idiomaAtual === 'it-IT' ? '€' : 'R$';
    
    // Calcular substituições de baterias
    const substituicoesBaterias = [];
    if (vidaUtil > 0 && vidaUtil < anosAnalise && custoBaterias > 0) {
        let anoSubstituicao = vidaUtil;
        while (anoSubstituicao < anosAnalise) {
            if (anoSubstituicao % 25 !== 0) {
                substituicoesBaterias.push({
                    ano: anoSubstituicao,
                    mes: Math.round(anoSubstituicao * 12)
                });
            }
            anoSubstituicao += vidaUtil;
        }
    }
    
    // Calcular substituições completas do sistema (a cada 25 anos)
    const substituicoesSistemaCompleto = [];
    let anoSubstituicaoCompleta = 25;
    while (anoSubstituicaoCompleta <= anosAnalise) {
        substituicoesSistemaCompleto.push({
            ano: anoSubstituicaoCompleta,
            mes: Math.round(anoSubstituicaoCompleta * 12)
        });
        anoSubstituicaoCompleta += 25;
    }
    
    // Calcular payback inicial
    let paybackMeses = null;
    let economiaAcumuladaPayback = 0;
    for (let mes = 0; mes <= mesesAnalise; mes++) {
        const anoAtual = Math.floor(mes / 12);
        const economiaMensalAtual = economiaMensal * Math.pow(fatorAumentoAnual, anoAtual);
        economiaAcumuladaPayback += economiaMensalAtual;
        if (economiaAcumuladaPayback >= custoTotal && paybackMeses === null) {
            paybackMeses = mes;
            break;
        }
    }
    
    if (paybackMeses === null) {
        paybackMeses = Math.ceil(custoTotal / economiaMensal);
    }
    
    // Criar arrays de dados
    const labels = [];
    const investimentoInicial = [];
    const economiaAcumulada = [];
    const custoSubstituicoesBaterias = [];
    const custoSubstituicoesSistemaCompleto = [];
    const lucroPrejuizoLiquido = [];
    
    const intervaloMeses = 6;
    
    // Definir anos para mostrar no eixo X
    const anosParaMostrar = [];
    for (let ano = 0; ano <= anosAnalise; ano += 5) {
        anosParaMostrar.push(ano);
    }
    if (!anosParaMostrar.includes(anosAnalise)) {
        anosParaMostrar.push(anosAnalise);
        anosParaMostrar.sort((a, b) => a - b);
    }
    
    for (let mes = 0; mes <= mesesAnalise; mes += intervaloMeses) {
        const ano = Math.floor(mes / 12);
        const mesNoAno = mes % 12;
        
        // Criar labels
        if (anosParaMostrar.includes(ano) && mesNoAno < intervaloMeses) {
            labels.push(ano === 0 ? '0' : `${ano}${idiomaAtual === 'pt-BR' ? 'a' : 'a'}`);
        } else {
            labels.push('');
        }
        
        // Calcular custos acumulados
        let custoTotalSubstituicoesBateriasAteMes = 0;
        for (const subst of substituicoesBaterias) {
            if (mes >= subst.mes) {
                custoTotalSubstituicoesBateriasAteMes += custoBaterias;
            }
        }
        
        let custoTotalSubstituicoesSistemaAteMes = 0;
        for (const subst of substituicoesSistemaCompleto) {
            if (mes >= subst.mes) {
                custoTotalSubstituicoesSistemaAteMes += custoTotal;
            }
        }
        
        investimentoInicial.push(-custoTotal);
        
        // Calcular economia acumulada
        let economiaAcumuladaTotal = 0;
        for (let m = 0; m < mes; m++) {
            const anoAtual = Math.floor(m / 12);
            const economiaMensalAtual = economiaMensal * Math.pow(fatorAumentoAnual, anoAtual);
            economiaAcumuladaTotal += economiaMensalAtual;
        }
        economiaAcumulada.push(economiaAcumuladaTotal);
        
        custoSubstituicoesBaterias.push(-custoTotalSubstituicoesBateriasAteMes);
        custoSubstituicoesSistemaCompleto.push(-custoTotalSubstituicoesSistemaAteMes);
        
        // Lucro/Prejuízo líquido
        const custoTotalSubstituicoesAteMes = custoTotalSubstituicoesBateriasAteMes + custoTotalSubstituicoesSistemaAteMes;
        const lucroPrejuizo = economiaAcumuladaTotal - custoTotal - custoTotalSubstituicoesAteMes;
        lucroPrejuizoLiquido.push(lucroPrejuizo);
    }
    
    // Encontrar índice do payback
    const paybackIndex = lucroPrejuizoLiquido.findIndex(lucro => lucro >= 0);
    
    // Criar gráfico
    const grafico = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: idiomaAtual === 'pt-BR' ? 'Investimento Inicial' : 'Investimento Iniziale',
                    data: investimentoInicial,
                    borderColor: 'rgba(244, 67, 54, 1)',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: idiomaAtual === 'pt-BR' ? 'Economia Acumulada' : 'Risparmio Accumulato',
                    data: economiaAcumulada,
                    borderColor: 'rgba(76, 175, 80, 1)',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 4
                },
                {
                    label: idiomaAtual === 'pt-BR' ? 'Custo Substituições Baterias' : 'Costo Sostituzioni Batterie',
                    data: custoSubstituicoesBaterias,
                    borderColor: 'rgba(255, 152, 0, 1)',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    borderWidth: 2,
                    borderDash: [3, 3],
                    fill: false,
                    pointRadius: 0,
                    hidden: substituicoesBaterias.length === 0
                },
                {
                    label: idiomaAtual === 'pt-BR' ? 'Custo Substituições Sistema Completo' : 'Costo Sostituzioni Sistema Completo',
                    data: custoSubstituicoesSistemaCompleto,
                    borderColor: 'rgba(156, 39, 176, 1)',
                    backgroundColor: 'rgba(156, 39, 176, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    hidden: substituicoesSistemaCompleto.length === 0
                },
                {
                    label: idiomaAtual === 'pt-BR' ? 'Prejuízo Líquido' : 'Perdita Netta',
                    data: lucroPrejuizoLiquido.map(v => v < 0 ? v : null),
                    borderColor: 'rgba(244, 67, 54, 1)',
                    backgroundColor: 'rgba(244, 67, 54, 0.2)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    spanGaps: false
                },
                {
                    label: idiomaAtual === 'pt-BR' ? 'Lucro Líquido' : 'Profitto Netto',
                    data: lucroPrejuizoLiquido.map(v => v >= 0 ? v : null),
                    borderColor: 'rgba(25, 118, 210, 1)',
                    backgroundColor: 'rgba(25, 118, 210, 0.2)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    spanGaps: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { size: 12, weight: 'bold' },
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const valor = context.parsed.y;
                            if (valor === null) return null;
                            const prefixo = valor < 0 ? '-' : '';
                            const valorFormatado = Math.abs(valor).toLocaleString(idiomaAtual, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                            });
                            return `${context.dataset.label}: ${prefixo}${moeda} ${valorFormatado}`;
                        },
                        filter: function(tooltipItem) {
                            return tooltipItem.parsed.y !== null;
                        },
                        footer: function(tooltipItems) {
                            if (paybackIndex >= 0 && tooltipItems[0].dataIndex === paybackIndex) {
                                const anosPayback = Math.floor(paybackMeses / 12);
                                const mesesPayback = paybackMeses % 12;
                                
                                if (idiomaAtual === 'pt-BR') {
                                    if (anosPayback > 0 && mesesPayback > 0) {
                                        return `✓ Payback: ${anosPayback} ano${anosPayback > 1 ? 's' : ''} e ${mesesPayback} mês${mesesPayback > 1 ? 'es' : ''}`;
                                    } else if (anosPayback > 0) {
                                        return `✓ Payback: ${anosPayback} ano${anosPayback > 1 ? 's' : ''}`;
                                    } else {
                                        return `✓ Payback: ${mesesPayback} mês${mesesPayback > 1 ? 'es' : ''}`;
                                    }
                                } else {
                                    if (anosPayback > 0 && mesesPayback > 0) {
                                        return `✓ Payback: ${anosPayback} anno${anosPayback > 1 ? 'i' : ''} e ${mesesPayback} mese${mesesPayback > 1 ? 'i' : ''}`;
                                    } else if (anosPayback > 0) {
                                        return `✓ Payback: ${anosPayback} anno${anosPayback > 1 ? 'i' : ''}`;
                                    } else {
                                        return `✓ Payback: ${mesesPayback} mese${mesesPayback > 1 ? 'i' : ''}`;
                                    }
                                }
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: idiomaAtual === 'pt-BR' ? 'Tempo (anos)' : 'Tempo (anni)',
                        font: { size: 12, weight: 'bold' }
                    },
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        maxTicksLimit: anosParaMostrar.length,
                        autoSkip: false,
                        includeBounds: true
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: idiomaAtual === 'pt-BR' ? `Valor (${moeda})` : `Valore (${moeda})`,
                        font: { size: 12, weight: 'bold' }
                    },
                    ticks: {
                        callback: function(value) {
                            return `${moeda} ${value.toLocaleString(idiomaAtual, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                            })}`;
                        }
                    }
                }
            }
        }
    });
    
    // Atualizar informações de payback
    atualizarInfoPayback(dados, paybackMeses, anosAnalise, substituicoesBaterias, substituicoesSistemaCompleto, idiomaAtual);
    
    return grafico;
}

/**
 * Atualiza as informações de payback e análise financeira
 */
function atualizarInfoPayback(dados, paybackMeses, anosAnalise, substituicoesBaterias, substituicoesSistemaCompleto, idiomaAtual) {
    const infoPaybackEl = document.getElementById('infoPayback');
    if (!infoPaybackEl) return;
    
    const { custoTotal, consumoMensal, custoBaterias, vidaUtil } = dados;
    
    const sliderPrecoKWh = document.getElementById('sliderPrecoKWh');
    const precoKWh = sliderPrecoKWh ? parseFloat(sliderPrecoKWh.value) : PRECO_KWH[idiomaAtual];
    
    const sliderAumentoAnual = document.getElementById('sliderAumentoAnualEnergia');
    const aumentoAnualPercentual = sliderAumentoAnual 
        ? parseFloat(sliderAumentoAnual.value) 
        : AUMENTO_ANUAL_ENERGIA[idiomaAtual];
    const fatorAumentoAnual = 1 + (aumentoAnualPercentual / 100);
    
    const economiaMensal = consumoMensal * precoKWh;
    const economiaAnual = economiaMensal * 12;
    const moeda = idiomaAtual === 'it-IT' ? '€' : 'R$';
    
    // Calcular economia total no período
    let economiaTotalPeriodo = 0;
    if (Math.abs(fatorAumentoAnual - 1) < 0.0001) {
        economiaTotalPeriodo = economiaAnual * anosAnalise;
    } else {
        economiaTotalPeriodo = economiaAnual * (Math.pow(fatorAumentoAnual, anosAnalise) - 1) / (fatorAumentoAnual - 1);
    }
    
    const custoTotalSubstituicoesBaterias = substituicoesBaterias.length * custoBaterias;
    const custoTotalSubstituicoesSistema = substituicoesSistemaCompleto.length * custoTotal;
    const custoTotalSubstituicoes = custoTotalSubstituicoesBaterias + custoTotalSubstituicoesSistema;
    
    const lucroTotalPeriodo = economiaTotalPeriodo - custoTotal - custoTotalSubstituicoes;
    const isPrejuizo = lucroTotalPeriodo < 0;
    
    const anosPayback = Math.floor(paybackMeses / 12);
    const mesesPayback = paybackMeses % 12;
    
    // Montar HTML
    if (idiomaAtual === 'pt-BR') {
        let textoPayback = anosPayback > 0 && mesesPayback > 0
            ? `${anosPayback} ano${anosPayback > 1 ? 's' : ''} e ${mesesPayback} mês${mesesPayback > 1 ? 'es' : ''}`
            : anosPayback > 0
                ? `${anosPayback} ano${anosPayback > 1 ? 's' : ''}`
                : `${mesesPayback} mês${mesesPayback > 1 ? 'es' : ''}`;
        
        let infoSubstituicoes = '';
        if (substituicoesBaterias.length > 0 || substituicoesSistemaCompleto.length > 0) {
            const partesInfo = [];
            
            if (substituicoesBaterias.length > 0) {
                const anosSubstBaterias = substituicoesBaterias.map(s => s.ano).join(', ');
                partesInfo.push(`<span style="color: #FF9800;">🔋 Substituições de baterias (vida útil: ${vidaUtil} anos): <strong>${substituicoesBaterias.length} vez${substituicoesBaterias.length > 1 ? 'es' : ''}</strong> aos ${anosSubstBaterias} ano${substituicoesBaterias.length > 1 ? 's' : ''} | Custo total: <strong>${formatarMoedaComVirgula(custoTotalSubstituicoesBaterias, moeda, 2)}</strong></span>`);
            }
            
            if (substituicoesSistemaCompleto.length > 0) {
                const anosSubstSistema = substituicoesSistemaCompleto.map(s => s.ano).join(', ');
                partesInfo.push(`<span style="color: #9C27B0;">⚙️ Substituições completas do sistema (a cada 25 anos): <strong>${substituicoesSistemaCompleto.length} vez${substituicoesSistemaCompleto.length > 1 ? 'es' : ''}</strong> aos ${anosSubstSistema} ano${substituicoesSistemaCompleto.length > 1 ? 's' : ''} | Custo total: <strong>${formatarMoedaComVirgula(custoTotalSubstituicoesSistema, moeda, 2)}</strong></span>`);
            }
            
            if (partesInfo.length > 0) {
                infoSubstituicoes = '<br>' + partesInfo.join('<br>');
            }
        }
        
        infoPaybackEl.innerHTML = `
            <strong>💰 Análise Financeira:</strong><br>
            <div style="margin: 8px 0;">
                <strong style="font-size: 0.95em;">Economia com Energia da Concessionária:</strong>
                <table style="width: auto; border-collapse: collapse; margin: 4px 0; font-size: 0.9em; margin-left: auto; margin-right: auto;">
                    <tr>
                        <td style="padding: 2px 4px; text-align: left; white-space: nowrap;">Mensal:</td>
                        <td style="padding: 2px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatarMoedaComVirgula(economiaMensal, moeda, 2)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 4px; text-align: left; white-space: nowrap;">Anual:</td>
                        <td style="padding: 2px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatarMoedaComVirgula(economiaAnual, moeda, 2)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 4px; text-align: left; white-space: nowrap;">${anosAnalise} anos:</td>
                        <td style="padding: 2px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatarMoedaComVirgula(economiaTotalPeriodo, moeda, 2)}</td>
                    </tr>
                </table>
            </div>
            <span style="color: #1976D2;">⏱️ Payback inicial: <strong>${textoPayback}</strong></span>${infoSubstituicoes}<br>
            <span style="color: ${isPrejuizo ? '#F44336' : '#4CAF50'};">💵 ${isPrejuizo ? 'Prejuízo líquido' : 'Lucro líquido'} em ${anosAnalise} anos: <strong>${formatarMoedaComVirgula(Math.abs(lucroTotalPeriodo), moeda, 2)}</strong></span>
        `;
    } else {
        // Versão em italiano (similar)
        let textoPayback = anosPayback > 0 && mesesPayback > 0
            ? `${anosPayback} anno${anosPayback > 1 ? 'i' : ''} e ${mesesPayback} mese${mesesPayback > 1 ? 'i' : ''}`
            : anosPayback > 0
                ? `${anosPayback} anno${anosPayback > 1 ? 'i' : ''}`
                : `${mesesPayback} mese${mesesPayback > 1 ? 'i' : ''}`;
        
        infoPaybackEl.innerHTML = `
            <strong>💰 Analisi Finanziaria:</strong><br>
            <div style="margin: 8px 0;">
                <strong style="font-size: 0.95em;">Risparmio con Energia della Concessionaria:</strong>
                <table style="width: auto; border-collapse: collapse; margin: 4px 0; font-size: 0.9em; margin-left: auto; margin-right: auto;">
                    <tr>
                        <td style="padding: 2px 4px; text-align: left; white-space: nowrap;">Mensile:</td>
                        <td style="padding: 2px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatarMoedaComVirgula(economiaMensal, moeda, 2)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 4px; text-align: left; white-space: nowrap;">Annuale:</td>
                        <td style="padding: 2px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatarMoedaComVirgula(economiaAnual, moeda, 2)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 4px; text-align: left; white-space: nowrap;">${anosAnalise} anni:</td>
                        <td style="padding: 2px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatarMoedaComVirgula(economiaTotalPeriodo, moeda, 2)}</td>
                    </tr>
                </table>
            </div>
            <span style="color: #1976D2;">⏱️ Payback iniziale: <strong>${textoPayback}</strong></span><br>
            <span style="color: ${isPrejuizo ? '#F44336' : '#4CAF50'};">💵 ${isPrejuizo ? 'Perdita netta' : 'Profitto netto'} in ${anosAnalise} anni: <strong>${formatarMoedaComVirgula(Math.abs(lucroTotalPeriodo), moeda, 2)}</strong></span>
        `;
    }
}
