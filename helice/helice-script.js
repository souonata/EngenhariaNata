// ============================================
// CALCULADORA DE PASSO DE HÉLICE PARA BARCOS
// ============================================

/**
 * Idioma atual - carrega do localStorage ou usa português como padrão
 */
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido', SOLAR_CONFIG_KEY: 'configSolar' };
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) ? SiteConfig.SELECTORS : { HOME_BUTTON: '.home-button-fixed', LANG_BTN: '.lang-btn', APP_ICON: '.app-icon', ARROW_BTN: '.arrow-btn', BUTTON_ACTION: '.btn-acao' };
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || (typeof SiteConfig !== 'undefined' ? SiteConfig.DEFAULTS.language : 'pt-BR');

/**
 * Constantes e explicação do método
 * ---------------------------------
 * A constante 1056 é usada para converter velocidade em nós e rotações
 * por minuto em uma unidade compatível com o passo (polegadas/minuto).
 *
 * Fórmula utilizada (no código):
 *  Passo (em polegadas) = (Velocidade_nós × 1056 × Redução) / (RPM_motor × (1 - Slip))
 *
 * Onde:
 *  - Velocidade_nós: velocidade desejada da embarcação em nós
 *  - Redução: relação de redução externo (ex: 2.0 representa 2:1)
 *  - RPM_motor: rotação máxima do motor (por minuto)
 *  - Slip: percentual de deslizamento (0.10 = 10%) que reduz
 *    a velocidade teórica conseguida pela hélice.
 *
 * Interpretação intuitiva:
 *  - Se não houvesse slip, a hélice avançaria exatamente `passo` polegadas
 *    por rotação. Na prática, o slip diminui essa eficiência, usando (1 - slip)
 *    como divisor para compensar a perda.
 */
const CONSTANTE_CONVERSAO = 1056; // Conversão de nós para polegadas/minuto

// Fatores de conversão de velocidade
const CONVERSAO_VELOCIDADE = {
    knots: 1,           // Nós (unidade base)
    mph: 0.868976,      // Milhas por hora para nós
    kmh: 0.539957       // Quilômetros por hora para nós
};

// Fatores de conversão de passo
const CONVERSAO_PASSO = {
    inches: 1,          // Polegadas (unidade base)
    mm: 25.4            // Milímetros por polegada
};

/**
 * Converte velocidade para nós (unidade base para cálculos)
 */
function converterVelocidadeParaKnots(valor, unidade) {
    return valor * CONVERSAO_VELOCIDADE[unidade];
}

/**
 * Converte nós para a unidade desejada
 */
function converterKnotsParaUnidade(valor, unidade) {
    return valor / CONVERSAO_VELOCIDADE[unidade];
}

/**
 * Converte passo de polegadas para a unidade desejada
 */
function converterPassoParaUnidade(valor, unidade) {
    if (unidade === 'inches') return valor;
    return valor * CONVERSAO_PASSO.mm; // Converte para mm
}

/**
 * Variáveis globais para gráfico
 */
let graficoHelice = null;

/**
 * Dicionário de traduções PT-BR ↔ IT-IT
 */
const traducoes = {
    'pt-BR': {
        'app-title': '🚤 Calculadora de Passo de Hélice',
        'app-subtitle': 'Para barcos de lazer',
        'label-unidade-velocidade': 'Unidade de Velocidade',
        'label-velocidade': 'Velocidade Desejada',
        'label-reducao': 'Redução da Rabeta',
        'label-rpm': 'RPM Máximo do Motor',
        'label-slip': 'Slip Estimado',
        'unidade-mph': 'mph',
        'unidade-kmh': 'km/h',
        'unidade-mm': 'mm',
        'info-slip': 'Valor típico para barcos de lazer: 10-20%. Representa a perda de eficiência da hélice.',
        'resultado-titulo': 'Resultados',
        'unidade-polegadas': 'polegadas',
        'unidade-polegadas-compacto': 'pol',
        'unidade-nos': 'nós',
        'rpm-helice': 'RPM na Hélice:',
        'velocidade-teorica': 'Velocidade Teórica:',
        'grafico-titulo': '📊 Relação Passo × Velocidade',
        'info-titulo': 'ℹ️ Como Funciona',
        'info-passo-titulo': 'O que é Passo?',
        'info-passo-texto': 'O passo é a distância teórica (em polegadas) que a hélice avançaria em uma rotação completa, sem considerar o deslizamento (slip).',
        'info-reducao-titulo': 'Redução da Rabeta',
        'info-reducao-texto': 'Relação entre a rotação do motor e a rotação da hélice. Ex: 2:1 significa que o motor gira 2 vezes para a hélice girar 1 vez.',
        'info-slip-titulo': 'O que é Slip?',
        'info-slip-texto': 'Deslizamento entre a hélice e a água. Barcos de lazer típicos têm 10-20% de slip. Quanto menor o slip, mais eficiente a hélice.',
        'formula-titulo': '📐 Fórmula Utilizada',
        'formula-explicacao': 'Onde 1056 é a constante de conversão de nós para polegadas/minuto',
        'footer': 'Calculadora de Hélice - Engenharia Nata © 2025',
        'grafico-label': 'Passo (polegadas)',
        'grafico-eixo-x': 'Velocidade (nós)',
        'grafico-eixo-y': 'Passo Recomendado (pol)'
        , 'aria-home': 'Voltar para a tela inicial'
    },
    'it-IT': {
        'app-title': '🚤 Calcolatore Passo Elica',
        'app-subtitle': 'Per barche da diporto',
        'label-unidade-velocidade': 'Unità di Velocità',
        'label-velocidade': 'Velocità Desiderata',
        'label-reducao': 'Riduzione Piede Poppiero',
        'label-rpm': 'RPM Massimo Motore',
        'label-slip': 'Slip Stimato',
        'unidade-mph': 'mph',
        'unidade-kmh': 'km/h',
        'unidade-mm': 'mm',
        'info-slip': 'Valore tipico per barche da diporto: 10-20%. Rappresenta la perdita di efficienza dell\'elica.',
        'resultado-titulo': 'Risultati',
        'unidade-polegadas': 'pollici',
        'unidade-polegadas-compacto': 'pol',
        'unidade-nos': 'nodi',
        'rpm-helice': 'RPM Elica:',
        'velocidade-teorica': 'Velocità Teorica:',
        'grafico-titulo': '📊 Relazione Passo × Velocità',
        'info-titulo': 'ℹ️ Come Funziona',
        'info-passo-titulo': "Cos'è il Passo?",
        'info-passo-texto': "Il passo è la distanza teorica (in pollici) che l'elica avanzerebbe in una rotazione completa, senza considerare lo scivolamento (slip).",
        'info-reducao-titulo': 'Riduzione Piede Poppiero',
        'info-reducao-texto': "Rapporto tra la rotazione del motore e la rotazione dell'elica. Es: 2:1 significa che il motore gira 2 volte per 1 giro dell'elica.",
        'info-slip-titulo': "Cos'è lo Slip?",
        'info-slip-texto': "Scivolamento tra l'elica e l'acqua. Barche da diporto tipiche hanno 10-20% di slip. Minore è lo slip, più efficiente è l'elica.",
        'formula-titulo': '📐 Formula Utilizzata',
        'formula-explicacao': 'Dove 1056 è la costante di conversione da nodi a pollici/minuto',
        'footer': 'Calcolatore Elica - Engenharia Nata © 2025',
        'grafico-label': 'Passo (pollici)',
        'grafico-eixo-x': 'Velocità (nodi)',
        'grafico-eixo-y': 'Passo Consigliato (pol)'
        , 'aria-home': 'Torna alla schermata iniziale'
    }
};

/**
 * Troca o idioma da interface
 * @param {string} novoIdioma - Código do idioma ('pt-BR' ou 'it-IT')
 */
function trocarIdioma(novoIdioma) {
    idiomaAtual = novoIdioma;
    
    // Salva no localStorage para manter entre páginas
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    
    // Atualiza o atributo lang do HTML
    document.documentElement.lang = novoIdioma;
    
    // Atualiza todos os elementos com data-i18n
    document.querySelectorAll('[data-i18n]').forEach(elemento => {
        const chave = elemento.getAttribute('data-i18n');
        if (traducoes[novoIdioma][chave]) {
            elemento.textContent = traducoes[novoIdioma][chave];
        }
    });
    
    // Atualiza botões ativos/inativos
    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(btn => {
        if (btn.getAttribute('data-lang') === novoIdioma) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Atualiza gráfico com labels traduzidas
    atualizarGrafico();

    // Atualiza aria-label do botão home
    const homeLabel = traducoes[novoIdioma]['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
}

/**
 * Ajusta o valor de um slider usando botões de seta
 * @param {string} targetId - ID do slider a ser ajustado
 * @param {number} step - Valor do incremento/decremento
 */
function ajustarValor(targetId, step) {
    const slider = document.getElementById(targetId);
    if (!slider) return;
    
    const valorAtual = parseFloat(slider.value) || 0;
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const stepAttr = parseFloat(slider.step) || 1;
    
    let novoValor = valorAtual + step;
    novoValor = Math.round(novoValor / stepAttr) * stepAttr;
    novoValor = Math.max(min, Math.min(max, novoValor));
    
    slider.value = novoValor;
    slider.dispatchEvent(new Event('input'));
}

// Controle para os botões de seta
let intervalId = null;
let timeoutId = null;

/**
 * Calcula o passo da hélice baseado nos parâmetros
 * @param {number} velocidade - Velocidade desejada em nós
 * @param {number} reducao - Redução da rabeta (ex: 2.0 para 2:1)
 * @param {number} rpmMotor - RPM máximo do motor
 * @param {number} slip - Percentual de slip (0.15 = 15%)
 * @returns {object} - Objeto com passo, rpmHelice e velocidadeTeorica
 */
/**
 * calcularPasso
 * -------------
 * Função que aplica a fórmula acima e retorna:
 *  - passo recomendado (em polegadas)
 *  - rpm efetivo da hélice
 *  - velocidade teórica (sem slip)
 *
 * Explicação didática:
 * 1) Calculamos a rotação da hélice dividindo o RPM do motor pela redução.
 * 2) Aplicamos a fórmula do passo compensando o slip (dividindo por (1 - slip)).
 * 3) Calculamos a velocidade teórica que seria obtida com o passo escolhido
 *    se não existisse slip, para referência e comparação.
 */
function calcularPasso(velocidade, reducao, rpmMotor, slip) {
    // RPM na hélice = RPM do motor / Redução
    const rpmHelice = rpmMotor / reducao;
    
    // Fórmula: Passo = (Velocidade × 1056 × Redução) / (RPM × (1 - Slip))
    const passo = (velocidade * CONSTANTE_CONVERSAO * reducao) / (rpmMotor * (1 - slip));
    
    // Velocidade teórica (sem slip) = (Passo × RPM) / (1056 × Redução)
    const velocidadeTeorica = (passo * rpmMotor) / (CONSTANTE_CONVERSAO * reducao);
    
    return {
        passo: Math.round(passo * 10) / 10, // Arredonda para 1 decimal
        rpmHelice: Math.round(rpmHelice),
        velocidadeTeorica: Math.round(velocidadeTeorica * 10) / 10
    };
}

/**
 * Atualiza os limites do slider de velocidade baseado na unidade selecionada
 * @param {string} unidadeAnterior - Unidade anterior (para conversão correta do valor)
 */
function atualizarLimitesVelocidade(unidadeAnterior = null) {
    const unidadeVelocidade = document.querySelector('input[name="unidadeVelocidade"]:checked').value;
    const slider = document.getElementById('sliderVelocidade');
    const valorAtual = parseFloat(slider.value);
    
    let valorEmKnots;
    if (unidadeAnterior) {
        valorEmKnots = converterVelocidadeParaKnots(valorAtual, unidadeAnterior);
    } else {
        valorEmKnots = converterVelocidadeParaKnots(valorAtual, unidadeVelocidade);
    }
    
    let min, max;
    if (unidadeVelocidade === 'knots') {
        min = 5;
        max = 60;
    } else if (unidadeVelocidade === 'mph') {
        min = 6;  // ~5.8 nós
        max = 70; // ~60.5 nós
    } else { // kmh
        min = 9;  // ~5.4 nós
        max = 112; // ~60.5 nós
    }
    
    slider.min = min;
    slider.max = max;
    // Atualiza labels de range se existirem
    const rangeMin = document.getElementById('rangeMinVelocidade');
    const rangeMax = document.getElementById('rangeMaxVelocidade');
    if (rangeMin) rangeMin.textContent = min;
    if (rangeMax) rangeMax.textContent = max;
    
    // Converte valor em nós para a nova unidade e atualiza
    const novoValor = converterKnotsParaUnidade(valorEmKnots, unidadeVelocidade);
    const valorFormatado = novoValor.toFixed(unidadeVelocidade === 'knots' ? 0 : 1);
    slider.value = parseFloat(valorFormatado);
    
    document.getElementById('valorVelocidade').textContent = valorFormatado;
}

/**
 * Atualiza a interface com os resultados calculados
 */
function atualizarResultado() {
    const unidadeVelocidade = document.querySelector('input[name="unidadeVelocidade"]:checked').value;
    const unidadePasso = document.querySelector('input[name="unidadePasso"]:checked').value;
    
    const velocidadeInput = parseFloat(document.getElementById('sliderVelocidade').value);
    const reducao = parseFloat(document.getElementById('sliderReducao').value);
    const rpmMotor = parseFloat(document.getElementById('sliderRPM').value);
    const slipPercent = parseFloat(document.getElementById('sliderSlip').value);
    
    const velocidadeKnots = converterVelocidadeParaKnots(velocidadeInput, unidadeVelocidade);
    
    document.getElementById('valorVelocidade').textContent = velocidadeInput.toFixed(unidadeVelocidade === 'knots' ? 0 : 1);
    document.getElementById('valorReducao').textContent = reducao.toFixed(2);
    document.getElementById('valorRPM').textContent = rpmMotor;
    document.getElementById('valorSlip').textContent = slipPercent;
    
    const resultado = calcularPasso(velocidadeKnots, reducao, rpmMotor, slipPercent / 100);
    
    const passoConvertido = converterPassoParaUnidade(resultado.passo, unidadePasso);
    document.getElementById('resultadoPasso').textContent = passoConvertido.toFixed(unidadePasso === 'mm' ? 0 : 1);
    document.getElementById('rpmHelice').textContent = resultado.rpmHelice;
    
    const velocidadeTeoricaConvertida = converterKnotsParaUnidade(resultado.velocidadeTeorica, unidadeVelocidade);
    document.getElementById('velocidadeTeorica').textContent = velocidadeTeoricaConvertida.toFixed(1);
    
    const unidadeVelocidadeText = {
        'knots': traducoes[idiomaAtual]['unidade-nos'],
        'mph': traducoes[idiomaAtual]['unidade-mph'],
        'kmh': traducoes[idiomaAtual]['unidade-kmh']
    }[unidadeVelocidade];
    document.getElementById('unidadeVelocidadeTeorica').textContent = unidadeVelocidadeText;
    
    atualizarGrafico();
}

/**
 * Cria/atualiza o gráfico de relação Passo × Velocidade
 */
function atualizarGrafico() {
    const unidadeVelocidade = document.querySelector('input[name="unidadeVelocidade"]:checked').value;
    const unidadePasso = document.querySelector('input[name="unidadePasso"]:checked').value;
    const reducao = parseFloat(document.getElementById('sliderReducao').value);
    const rpmMotor = parseFloat(document.getElementById('sliderRPM').value);
    const slipPercent = parseFloat(document.getElementById('sliderSlip').value);
    
    // Gera dados para o gráfico (velocidades de 5 a 60 nós, depois converte)
    const velocidades = [];
    const passos = [];
    
    for (let vKnots = 5; vKnots <= 60; vKnots += 5) {
        const vConvertida = converterKnotsParaUnidade(vKnots, unidadeVelocidade);
        velocidades.push(Math.round(vConvertida));
        
        const resultado = calcularPasso(vKnots, reducao, rpmMotor, slipPercent / 100);
        const passoConvertido = converterPassoParaUnidade(resultado.passo, unidadePasso);
        passos.push(passoConvertido);
    }
    
    const ctx = document.getElementById('graficoHelice').getContext('2d');
    
    if (graficoHelice) {
        graficoHelice.destroy();
    }
    
    graficoHelice = new Chart(ctx, {
        type: 'line',
        data: {
            labels: velocidades,
            datasets: [{
                label: (() => {
                    const unidadePasso = document.querySelector('input[name="unidadePasso"]:checked').value;
                    const unidadeText = unidadePasso === 'inches' 
                        ? traducoes[idiomaAtual]['unidade-polegadas'] 
                        : traducoes[idiomaAtual]['unidade-mm'];
                    return `${idiomaAtual === 'pt-BR' ? 'Passo' : 'Passo'} (${unidadeText})`;
                })(),
                data: passos,
                borderColor: '#2d9fa3ff',
                backgroundColor: 'rgba(45, 159, 163, 0.1)',
                borderWidth: 3,
                fill: false,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#2d9fa3ff',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const unidadePasso = document.querySelector('input[name="unidadePasso"]:checked').value;
                            const unidadeText = unidadePasso === 'inches' 
                                ? traducoes[idiomaAtual]['unidade-polegadas'] 
                                : traducoes[idiomaAtual]['unidade-mm'];
                            const valor = unidadePasso === 'mm' 
                                ? Math.round(context.parsed.y) 
                                : context.parsed.y.toFixed(1);
                            return `${valor} ${unidadeText}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: (() => {
                            const unidadeVelocidade = document.querySelector('input[name="unidadeVelocidade"]:checked').value;
                            const unidadeText = {
                                'knots': traducoes[idiomaAtual]['unidade-nos'],
                                'mph': traducoes[idiomaAtual]['unidade-mph'],
                                'kmh': traducoes[idiomaAtual]['unidade-kmh']
                            }[unidadeVelocidade];
                            return `${idiomaAtual === 'pt-BR' ? 'Velocidade' : 'Velocità'} (${unidadeText})`;
                        })(),
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: (() => {
                            const unidadePasso = document.querySelector('input[name="unidadePasso"]:checked').value;
                            const unidadeText = unidadePasso === 'inches' 
                                ? traducoes[idiomaAtual]['unidade-polegadas'] 
                                : traducoes[idiomaAtual]['unidade-mm'];
                            return `${idiomaAtual === 'pt-BR' ? 'Passo' : 'Passo'} (${unidadeText})`;
                        })(),
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const elementos = {
        sliderVelocidade: document.getElementById('sliderVelocidade'),
        sliderReducao: document.getElementById('sliderReducao'),
        sliderRPM: document.getElementById('sliderRPM'),
        sliderSlip: document.getElementById('sliderSlip'),
        valorVelocidade: document.getElementById('valorVelocidade'),
        valorReducao: document.getElementById('valorReducao'),
        valorRPM: document.getElementById('valorRPM'),
        valorSlip: document.getElementById('valorSlip')
    };
    
    trocarIdioma(idiomaAtual);
    
    document.getElementById('btnPortugues').addEventListener('click', () => trocarIdioma('pt-BR'));
    document.getElementById('btnItaliano').addEventListener('click', () => trocarIdioma('it-IT'));
    
    document.getElementById('sliderVelocidade').addEventListener('input', atualizarResultado);
    document.getElementById('sliderReducao').addEventListener('input', atualizarResultado);
    document.getElementById('sliderRPM').addEventListener('input', atualizarResultado);
    document.getElementById('sliderSlip').addEventListener('input', atualizarResultado);
    
    document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        const step = parseFloat(btn.getAttribute('data-step'));
        
        const startRepeating = () => {
            ajustarValor(targetId, step);
            
            timeoutId = setTimeout(() => {
                intervalId = setInterval(() => {
                    ajustarValor(targetId, step);
                }, 100);
            }, 500);
        };
        
        const stopRepeating = () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
        };
        
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startRepeating();
        });
        btn.addEventListener('mouseup', stopRepeating);
        btn.addEventListener('mouseleave', stopRepeating);
        
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startRepeating();
        });
        btn.addEventListener('touchend', stopRepeating);
        btn.addEventListener('touchcancel', stopRepeating);
    });
    
    let unidadeVelocidadeAnterior = 'knots';
    
    document.querySelectorAll('input[name="unidadeVelocidade"]').forEach(radio => {
        if (radio.checked) {
            unidadeVelocidadeAnterior = radio.value;
        }
    });
    
    document.querySelectorAll('input[name="unidadeVelocidade"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const unidadeAnterior = unidadeVelocidadeAnterior;
            unidadeVelocidadeAnterior = radio.value;
            atualizarLimitesVelocidade(unidadeAnterior);
            atualizarResultado();
        });
    });
    
    document.querySelectorAll('input[name="unidadePasso"]').forEach(radio => {
        radio.addEventListener('change', () => {
            atualizarResultado();
        });
    });
    
    atualizarLimitesVelocidade();
    atualizarResultado();
});
