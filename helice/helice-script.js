// ============================================
// CALCULADORA DE PASSO DE HÉLICE PARA BARCOS
// ============================================

/**
 * Idioma atual - carrega do localStorage ou usa português como padrão
 */
let idiomaAtual = localStorage.getItem('idiomaPreferido') || 'pt-BR';

/**
 * Constantes para cálculo de hélice
 */
const CONSTANTE_CONVERSAO = 1056; // Conversão de nós para polegadas/minuto

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
        'label-velocidade': 'Velocidade Desejada (nós)',
        'label-reducao': 'Redução da Rabeta',
        'label-rpm': 'RPM Máximo do Motor',
        'label-slip': 'Slip Estimado',
        'info-slip': 'Valor típico para barcos de lazer: 10-20%. Representa a perda de eficiência da hélice.',
        'resultado-titulo': '📐 Passo Recomendado',
        'unidade-polegadas': 'polegadas',
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
    },
    'it-IT': {
        'app-title': '🚤 Calcolatore Passo Elica',
        'app-subtitle': 'Per barche da diporto',
        'label-velocidade': 'Velocità Desiderata (nodi)',
        'label-reducao': 'Riduzione Piede Poppiero',
        'label-rpm': 'RPM Massimo Motore',
        'label-slip': 'Slip Stimato',
        'info-slip': 'Valore tipico per barche da diporto: 10-20%. Rappresenta la perdita di efficienza dell\'elica.',
        'resultado-titulo': '📐 Passo Consigliato',
        'unidade-polegadas': 'pollici',
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
    }
};

/**
 * Troca o idioma da interface
 * @param {string} novoIdioma - Código do idioma ('pt-BR' ou 'it-IT')
 */
function trocarIdioma(novoIdioma) {
    idiomaAtual = novoIdioma;
    
    // Salva no localStorage para manter entre páginas
    localStorage.setItem('idiomaPreferido', novoIdioma);
    
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
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.getAttribute('data-lang') === novoIdioma) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Atualiza gráfico com labels traduzidas
    atualizarGrafico();
}

/**
 * Calcula o passo da hélice baseado nos parâmetros
 * @param {number} velocidade - Velocidade desejada em nós
 * @param {number} reducao - Redução da rabeta (ex: 2.0 para 2:1)
 * @param {number} rpmMotor - RPM máximo do motor
 * @param {number} slip - Percentual de slip (0.15 = 15%)
 * @returns {object} - Objeto com passo, rpmHelice e velocidadeTeorica
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
 * Atualiza a interface com os resultados calculados
 */
function atualizarResultado() {
    // Pega valores dos sliders
    const velocidade = parseFloat(document.getElementById('sliderVelocidade').value);
    const reducao = parseFloat(document.getElementById('sliderReducao').value);
    const rpmMotor = parseFloat(document.getElementById('sliderRPM').value);
    const slipPercent = parseFloat(document.getElementById('sliderSlip').value);
    
    // Atualiza displays dos sliders
    document.getElementById('valorVelocidade').textContent = velocidade;
    document.getElementById('valorReducao').textContent = reducao.toFixed(2);
    document.getElementById('valorRPM').textContent = rpmMotor;
    document.getElementById('valorSlip').textContent = slipPercent;
    
    // Calcula resultado (convertendo slip de % para decimal)
    const resultado = calcularPasso(velocidade, reducao, rpmMotor, slipPercent / 100);
    
    // Atualiza resultado principal
    document.getElementById('resultadoPasso').textContent = resultado.passo;
    document.getElementById('rpmHelice').textContent = resultado.rpmHelice;
    document.getElementById('velocidadeTeorica').textContent = resultado.velocidadeTeorica;
    
    // Atualiza gráfico
    atualizarGrafico();
}

/**
 * Cria/atualiza o gráfico de relação Passo × Velocidade
 */
function atualizarGrafico() {
    const velocidade = parseFloat(document.getElementById('sliderVelocidade').value);
    const reducao = parseFloat(document.getElementById('sliderReducao').value);
    const rpmMotor = parseFloat(document.getElementById('sliderRPM').value);
    const slipPercent = parseFloat(document.getElementById('sliderSlip').value);
    
    // Gera dados para o gráfico (velocidades de 5 a 60 nós)
    const velocidades = [];
    const passos = [];
    
    for (let v = 5; v <= 60; v += 5) {
        velocidades.push(v);
        const resultado = calcularPasso(v, reducao, rpmMotor, slipPercent / 100);
        passos.push(resultado.passo);
    }
    
    const ctx = document.getElementById('graficoHelice').getContext('2d');
    
    // Destrói gráfico anterior se existir
    if (graficoHelice) {
        graficoHelice.destroy();
    }
    
    // Cria novo gráfico
    graficoHelice = new Chart(ctx, {
        type: 'line',
        data: {
            labels: velocidades,
            datasets: [{
                label: traducoes[idiomaAtual]['grafico-label'],
                data: passos,
                borderColor: '#4A90E2',
                backgroundColor: 'rgba(74, 144, 226, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#4A90E2',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
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
                            return `${context.parsed.y} ${traducoes[idiomaAtual]['unidade-polegadas']}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: traducoes[idiomaAtual]['grafico-eixo-x'],
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
                        text: traducoes[idiomaAtual]['grafico-eixo-y'],
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

/**
 * Inicialização quando a página carrega
 */
document.addEventListener('DOMContentLoaded', function() {
    // Verifica se todos os elementos existem
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
    
    // Inicializa com o idioma salvo
    trocarIdioma(idiomaAtual);
    
    // Event listeners para botões de idioma
    document.getElementById('btnPortugues').addEventListener('click', () => trocarIdioma('pt-BR'));
    document.getElementById('btnItaliano').addEventListener('click', () => trocarIdioma('it-IT'));
    
    // Event listeners para os sliders
    document.getElementById('sliderVelocidade').addEventListener('input', atualizarResultado);
    document.getElementById('sliderReducao').addEventListener('input', atualizarResultado);
    document.getElementById('sliderRPM').addEventListener('input', atualizarResultado);
    document.getElementById('sliderSlip').addEventListener('input', atualizarResultado);
    
    // Calcula resultado inicial
    atualizarResultado();
});
