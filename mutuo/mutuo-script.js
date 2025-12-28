// ============================================
// VARIÁVEIS GLOBAIS (acessíveis em todo o código)
// ============================================
//
// Comentários didáticos - Visão geral do algoritmo de amortização
// ---------------------------------------------------------------
// Objetivo: calcular parcelas, gerar uma tabela de amortização e
// produzir gráficos que mostrem a evolução de juros e amortização
// ao longo do tempo para diferentes sistemas de amortização:
//   1) SAC (Sistema de Amortização Constante) - amortização fixa
//      todo mês; juros decrescentes → parcelas que começam maiores e
//      diminuem com o tempo.
//      - Português: "SAC" ou "Sistema de Amortização Constante"
//      - Italiano: "Ammortamento all'Italiana" ou "Italiana"
//   2) Tabela Price (Sistema Francês) - parcela fixa (PMT)
//      calculada com a fórmula de anuidades; no começo paga-se mais
//      juros e pouca amortização, com inversão ao longo do prazo.
//      - Português: "Tabela Price" ou "Sistema Francês"
//      - Italiano: "Ammortamento alla Francese" ou "Francese"
//   3) Sistema Americano (Alemão/Tedesco) - paga-se apenas juros
//      durante todo o período e o principal é pago integralmente na última parcela.
//      - Português: "Sistema Americano"
//      - Italiano: "Sistema Tedesco"
//
// Processo principal (função calcularEmprestimo):
// - Ler valores de entrada (valor, taxa, prazo, periodicidade)
// - Converter taxas para base mensal quando necessário
// - Calcular o fluxo de caixa conforme o sistema escolhido
// - Popular a tabela de amortização (parcelas, amortização, juros,
//   saldo devedor) e os indicadores (total pago, juros totais)
// - Atualizar UI e gráficos
//
// O código contém funções utilitárias para tratar entradas formatadas,
// manipular eventos da UI (botões +/- com repetição) e gerar a tabela
// passo a passo. Os trechos matemáticos importantes (PMT / SAC / Americano)
// estão comentados onde são calculados.

// Armazena os valores originais dos inputs quando o usuário começa a editar
// Útil para restaurar o valor se o usuário apertar ESC
let valoresOriginais = {};

// Armazena a tabela completa de amortização (todas as parcelas calculadas)
// Cada item tem: parcela, valorParcela, amortizacao, juros, saldoDevedor
let tabelaAmortizacaoAtual = [];

// Armazena os dados do empréstimo atual (valor, taxa, prazo, etc)
let dadosEmprestimo = {};

// Armazena a última posição do slider de parcelas selecionada pelo usuário
// Isso permite manter a posição quando outros valores são alterados
let ultimaParcelaSelecionada = 1;

// Idioma atual da aplicação - prefer using site-wide keys when available
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido', SOLAR_CONFIG_KEY: 'configSolar' };
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) ? SiteConfig.SELECTORS : { HOME_BUTTON: '.home-button-fixed', LANG_BTN: '.lang-btn', APP_ICON: '.app-icon', ARROW_BTN: '.arrow-btn', BUTTON_ACTION: '.btn-acao' };
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || (typeof SiteConfig !== 'undefined' ? SiteConfig.DEFAULTS.language : 'pt-BR');

// Moeda atual (BRL para português, EUR para italiano)
let moedaAtual = idiomaAtual === 'pt-BR' ? 'BRL' : 'EUR';

// Elementos HTML que serão usados frequentemente no código
// Declarados aqui mas inicializados DEPOIS que o HTML carregar (no DOMContentLoaded)
let btnExemplos, exemplosSection, resultados, sliderParcelas;
let btnPortugues, btnItaliano;
let sliderValor, sliderTaxa, sliderPrazo; // Sliders substituindo os inputs de texto

// Controle para os botões de seta (aumentar/diminuir valores)
// intervalId - controla a repetição contínua quando segura o botão
// timeoutId - controla o atraso inicial antes de começar a repetir
let intervalId = null;
let timeoutId = null;

// ============================================
// FUNÇÕES DE AJUSTE DE VALORES (Botões de Seta)
// ============================================

/**
 * Aumenta ou diminui o valor de um campo de input
 * @param {string} targetId - ID do campo HTML a ser ajustado ('valorRapido', 'taxaRapida', 'prazoRapido')
 * @param {number} step - Quanto adicionar ou subtrair (pode ser negativo)
 * 
 * Exemplo: ajustarValor('valorRapido', 10000) adiciona 10.000 ao valor
 *          ajustarValor('taxaRapida', -0.1) subtrai 0,1% da taxa
 */
// Função para obter o máximo do slider baseado no idioma
function obterMaxValorSlider() {
    return idiomaAtual === 'it-IT' ? 500000 : 1000000; // 500 mil euros para italiano, 1 milhão para português
}

function ajustarValor(targetId, step) {
    // Pega o elemento HTML pelo ID (agora é um slider)
    const slider = document.getElementById(targetId);
    if (!slider) return;
    
    // Limites máximos de segurança
    const MAX_VALOR_SLIDER = obterMaxValorSlider(); // Máximo do slider baseado no idioma
    const MAX_VALOR_INPUT = 10000000; // 10 milhões - máximo para inputs manuais
    const MAX_TAXA_ANO = 20; // 20% ao ano - taxa máxima permitida
    
    // Verifica qual campo está sendo ajustado e aplica regras específicas
    if (targetId === 'sliderValor') {
        // CAMPO DE VALOR EMPRESTADO
        // Steps dinâmicos baseados no valor atual:
        // - Entre 1.000 e 10.000: step de 1.000
        // - Entre 10.000 e 1.000.000: step de 10.000

        // Obtém o valor atual do slider (já é um número)
        let valor = parseFloat(slider.value) || 0;
        
        // Calcula o passo efetivo baseado no valor atual
        const stepSign = (typeof step === 'number' && !isNaN(step) && step !== 0) ? Math.sign(step) : 1;
        let baseStep;
        
        const maxSlider = obterMaxValorSlider();
        
        // Determina o step baseado no valor atual
        // IMPORTANTE: Se está no máximo do slider, sempre usar step de 10.000 ao diminuir
        // O step de 100.000 só é usado para valores MANUAIS acima do máximo do slider
        if (valor < 10000) {
            // Entre 1.000 e 10.000: step de 1.000
            baseStep = 1000;
        } else if (valor <= maxSlider) {
            // Entre 10.000 e o máximo do slider (inclusive): step de 10.000
            // Mesmo quando está exatamente no máximo, usar step de 10.000
            baseStep = 10000;
        } else {
            // Acima do máximo do slider: step de 100.000 (apenas para valores manuais acima do limite)
            // Isso só acontece quando o usuário digitou manualmente um valor acima do máximo
            baseStep = 100000;
        }
        
        const stepVal = stepSign * baseStep;
        
        // Adiciona o step e garante que fica entre 1000 e MAX_VALOR_SLIDER (limite do slider)
        valor = Math.max(1000, Math.min(MAX_VALOR_SLIDER, valor + stepVal));
        valor = Math.round(valor);
        
        // Atualiza o slider
        slider.value = valor;
        
        // Atualiza display e recalcula
        if (window.atualizarDisplayValor) window.atualizarDisplayValor();
        calcularEmprestimo();
        
    } else if (targetId === 'sliderTaxa') {
        // CAMPO DE TAXA DE JUROS (slider)
        let taxa = parseFloat(slider.value) || 0;
        
        // Determina o step size dinamicamente baseado no período atual
        const periodoAtual = (document.querySelector('input[name="periodoRapido"]:checked') || {}).value || 'ano';
        let stepEffective;
        
        // Step baseado no período: 0.1 para ano, 0.01 para mês, 0.001 para dia
        if (periodoAtual === 'dia') {
            stepEffective = Math.sign(step) * 0.001;
        } else if (periodoAtual === 'mes') {
            stepEffective = Math.sign(step) * 0.01;
        } else {
            // ano
            stepEffective = Math.sign(step) * 0.1;
        }
        
        // Obter limite máximo baseado no período
        const maxTaxa = obterLimiteMaximoTaxa(periodoAtual);
        
        // Adiciona o step e limita entre 0 e o máximo do período
        taxa = Math.max(0, Math.min(maxTaxa, taxa + stepEffective));
        
        // Arredonda para o step apropriado para evitar erros de precisão
        if (periodoAtual === 'dia') {
            taxa = Math.round(taxa * 1000) / 1000; // 3 casas decimais
        } else if (periodoAtual === 'mes') {
            taxa = Math.round(taxa * 100) / 100; // 2 casas decimais
        } else {
            taxa = Math.round(taxa * 10) / 10; // 1 casa decimal
        }
        
        // Atualiza o slider
        slider.value = taxa;
        
        // Atualiza display e recalcula
        if (window.atualizarDisplayTaxa) window.atualizarDisplayTaxa();
        calcularEmprestimo();
        
    } else if (targetId === 'sliderPrazo') {
        // CAMPO DE PRAZO EM ANOS (slider)
        let prazo = parseInt(slider.value) || 0;
        
        // Adiciona o step e limita entre 1 e 50 anos
        prazo = Math.max(1, Math.min(50, prazo + step));
        
        // Atualiza o slider
        slider.value = prazo;
        
        // Atualiza display e recalcula
        if (window.atualizarDisplayPrazo) window.atualizarDisplayPrazo();
        calcularEmprestimo();
        
    } else if (targetId === 'sliderParcelas') {
        // CAMPO DE PARCELA SELECIONADA (slider)
        let parcela = parseInt(slider.value) || 1;
        const maxParcelas = parseInt(slider.max) || 120;
        
        // Adiciona o step e limita entre 1 e o máximo de parcelas
        parcela = Math.max(1, Math.min(maxParcelas, parcela + step));
        
        // Atualiza o slider
        slider.value = parcela;
        
        // Salva a posição atual para manter quando outros valores mudarem
        ultimaParcelaSelecionada = parcela;
        
        // Atualiza exibição da parcela
        if (window.atualizarParcelaExibida) window.atualizarParcelaExibida();
    }
    
}

// ============================================
// FUNÇÕES DE FORMATAÇÃO DE INPUTS
// ============================================

/**
 * Seleciona todo o texto do campo quando o usuário clica nele
 * Facilita a edição - o usuário pode começar a digitar direto
 */
function selecionarConteudo(e) {
    e.target.select(); // select() é uma função nativa que seleciona todo o texto
}

/**
 * Formata o valor emprestado quando o usuário termina de editar (blur/Enter/Tab)
 * Adiciona pontos como separador de milhares (ex: 100.000)
 * Durante a digitação, não formata para permitir inserção completa do valor
 */
function formatarValorInput(e) {
    const MAX_VALOR = 10000000; // 10 milhões
    
    // Converte valor com sufixos (k/M/m) ou número puro para número
    // Aceita: "7,5k", "7.5k", "7500", "10000", "1.5M", etc.
    let numero = obterValorNumericoComSufixo(e.target.value);
    
    // Se o campo ficou vazio, não faz nada (mas no blur vamos forçar o mínimo)
    if (isNaN(numero) || numero === 0) {
        if (e.type === 'blur') {
            numero = 1000;
            e.target.value = formatarNumeroComSufixo(numero, 1);
            const slider = document.getElementById('sliderValor');
            if (slider) {
                slider.value = 1000;
                calcularEmprestimo();
            }
        } else {
            e.target.value = '';
        }
        return;
    }
    
    // Se passar do limite, corta no máximo
    if (numero > MAX_VALOR) {
        numero = MAX_VALOR;
    }

    // Durante a digitação (input), não formata - apenas atualiza slider se necessário
    // Permite digitar: números puros, números com ponto/vírgula, números com sufixos k/M/m
    if (e.type !== 'blur') {
        // Atualiza o slider apenas se estiver dentro dos limites
        const slider = document.getElementById('sliderValor');
        if (slider && numero > 0) {
            const maxSlider = obterMaxValorSlider();
            if (numero >= 1000 && numero <= maxSlider) {
                slider.value = numero;
            }
        }
        // Mantém o valor digitado sem formatação (mas permite sufixos k/M/m)
        // Não formata durante a digitação para permitir inserção completa
        // Exemplos permitidos: "7500", "7,5k", "7.5k", "10000", "1.5M"
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(e.target);
        // Recalcula durante a digitação para feedback em tempo real
        calcularEmprestimo();
        return;
    }
    
    // Se chamado por 'blur' (o usuário terminou de editar) aplicamos regras:
    // - mínimo absoluto = 1.000
    // - Arredonda para múltiplos do step apropriado baseado no valor
    if (numero < 1000) numero = 1000;
    
    // Determina o step baseado no valor
    let step;
    const maxSlider = obterMaxValorSlider();
    if (numero < 10000) {
        step = 1000; // Entre 1.000 e 10.000: step de 1.000
    } else if (numero < maxSlider) {
        step = 10000; // Entre 10.000 e o máximo do slider: step de 10.000
    } else {
        step = 100000; // Acima do máximo do slider: step de 100.000
    }
    
    // Arredonda para o múltiplo mais próximo do step
    numero = Math.round(numero / step) * step;
    
    // Garanta que o arredondamento não quebre o limite máximo
    if (numero > MAX_VALOR) numero = MAX_VALOR;
    
    // No blur, formata e recalcula usando sufixos k/M
    // Números puros como 10000 serão formatados como 10k
    e.target.value = formatarNumeroComSufixo(numero, 1);
    if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(e.target);
    
    // Sincronizar slider
    const slider = document.getElementById('sliderValor');
    if (slider) {
        // Permitir valores acima do máximo do slider para inputs manuais
        // O slider será limitado ao máximo baseado no idioma, mas o input pode ir até 10 milhões
        slider.value = Math.min(maxSlider, numero); // Limita slider ao máximo do idioma
    }
    
    // Recalcula automaticamente quando o usuário muda o valor
    calcularEmprestimo();
}

/**
 * Formata a taxa de juros enquanto o usuário digita
 * Garante que usa vírgula como separador decimal (ex: 10,5)
 */
function formatarTaxaInput(e) {
    let valor = e.target.value;
    
    // Remove tudo EXCETO números e vírgula
    // [^\d,] significa "qualquer coisa que não seja dígito ou vírgula"
    valor = valor.replace(/[^\d,]/g, '');
    
    // Se o usuário digitou ponto, troca por vírgula
    valor = valor.replace('.', ',');
    
    // Garante que só tem UMA vírgula no texto
    // Split quebra o texto nas vírgulas
    const partes = valor.split(',');
    if (partes.length > 2) {
        // Se tem mais de uma vírgula, junta tudo depois da primeira
        valor = partes[0] + ',' + partes.slice(1).join('');
    }
    
    // Obter limite máximo baseado no período atual
    const periodoAtual = (document.querySelector('input[name="periodoRapido"]:checked') || {}).value || 'ano';
    const MAX_TAXA = obterLimiteMaximoTaxa(periodoAtual);
    
    // Valida o limite máximo
    const taxaNum = parseFloat(valor.replace(',', '.')); // Converte para número
    if (!isNaN(taxaNum) && taxaNum > MAX_TAXA) {
        // Se passou do limite, força o valor máximo
        const decimalsToShow = periodoAtual === 'dia' ? 3 : periodoAtual === 'mes' ? 2 : 1;
        valor = formatarNumeroDecimal(MAX_TAXA, decimalsToShow);
    }
    
    e.target.value = valor;
    if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(e.target);
    
    // Se não for blur, apenas atualiza enquanto digita (sem recalcular)
    if (e.type !== 'blur') {
        return;
    }
    
    // No blur, sincroniza slider e recalcula
    const slider = document.getElementById('sliderTaxa');
    if (slider) {
        const taxaNum = parseFloat(valor.replace(',', '.')) || 0;
        slider.value = Math.max(0, Math.min(MAX_TAXA, taxaNum));
    }
    
    calcularEmprestimo();
}

/**
 * Formata o prazo em anos - aceita apenas números inteiros
 * Limita entre 1 e 50 anos
 */
function formatarPrazoInput(e) {
    let valor = e.target.value;
    
    // Remove tudo que não é número (letras, pontos, vírgulas)
    valor = valor.replace(/\D/g, '');
    
    // Se ficou vazio, sai da função
    if (valor === '') {
        e.target.value = '';
        return;
    }
    
    // Converte para número inteiro
    const numero = parseInt(valor);
    
    // Limita entre 1 (mínimo) e 50 (máximo) anos
    const prazoFinal = Math.max(1, Math.min(50, numero));
    e.target.value = prazoFinal;
    if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(e.target);
    
    // Se não for blur, apenas atualiza enquanto digita (sem recalcular)
    if (e.type !== 'blur') {
        return;
    }
    
    // No blur, sincroniza slider e recalcula
    const slider = document.getElementById('sliderPrazo');
    if (slider) {
        slider.value = prazoFinal;
    }
    
    calcularEmprestimo();
}

// ============================================
// FUNÇÕES AUXILIARES DE CONVERSÃO
// ============================================

/**
 * Converte um texto formatado de volta para número puro
 * 
 * Esta função é essencial porque o usuário pode digitar valores formatados
 * (com pontos e vírgulas), mas para fazer cálculos precisamos de números puros.
 * 
 * Exemplos de conversão:
 * - "100.000" → 100000 (remove pontos de milhares)
 * - "1.500" → 1500 (remove pontos de milhares)
 * - "10,5" → 10.5 (troca vírgula por ponto)
 * - "1.234,56" → 1234.56 (remove pontos, troca vírgula por ponto)
 * - "1234.56" → 1234.56 (mantém como está)
 * 
 * @param {string|number} valorFormatado - Valor formatado (texto ou número)
 * @returns {number} Número puro para cálculos
 */
// Função obterValorNumericoFormatado - alias para converterValorFormatadoParaNumero de site-config.js
// Mantida para compatibilidade com código existente
function obterValorNumericoFormatado(valorFormatado) {
    // Usa função global de site-config.js se disponível
    if (typeof converterValorFormatadoParaNumero === 'function') {
        return converterValorFormatadoParaNumero(valorFormatado);
    }
    // Fallback se site-config.js não estiver carregado
    if (!valorFormatado) return 0;
    let valorTexto = String(valorFormatado).trim();
    if (valorTexto.indexOf('.') !== -1 && valorTexto.indexOf(',') !== -1) {
        valorTexto = valorTexto.replace(/\./g, '').replace(',', '.');
    } else if (valorTexto.indexOf(',') !== -1) {
        valorTexto = valorTexto.replace(/\./g, '').replace(',', '.');
    } else {
        valorTexto = valorTexto.replace(/\./g, '');
    }
    valorTexto = valorTexto.replace(/[^0-9.\-]/g, '');
    return parseFloat(valorTexto) || 0;
}

/**
 * Nome alternativo para a mesma função acima
 * Mantido para compatibilidade com código antigo
 */
/* Removido: function obterValorNumerico(valorFormatado) era redundante */

/**
 * Guarda o valor original do campo quando o usuário começa a editar
 * Permite cancelar a edição com ESC e voltar ao valor anterior
 */
function iniciarEdicao(e) {
    // Guarda o valor atual usando o ID do campo como chave
    valoresOriginais[e.target.id] = e.target.value;
    
    // Seleciona todo o texto para facilitar a edição
    selecionarConteudo(e);
}

/**
 * Trata teclas especiais enquanto o usuário edita um campo
 * ESC = cancela e restaura valor anterior
 * Enter = confirma e sai do campo
 */
function tratarTeclasRapido(e) {
    // ESC - Cancelar edição e restaurar valor original
    if (e.key === 'Escape') {
        // Busca o valor original que foi guardado
        e.target.value = valoresOriginais[e.target.id];
        
        // Tira o foco do campo (fecha o teclado virtual no celular)
        e.target.blur();
        
        // Remove o valor guardado da memória
        delete valoresOriginais[e.target.id];
        
        // Impede comportamento padrão do navegador
        e.preventDefault();
    }
    // Enter - Aplicar mudança e sair do campo
    else if (e.key === 'Enter') {
        // Apenas tira o foco (a mudança já foi aplicada)
        e.target.blur();
        e.preventDefault();
    }
    // Tab e Shift+Tab - Deixa o navegador tratar normalmente (navegação entre campos)
}

// Dicionário de traduções
const traducoes = {
    'pt-BR': {
        'app-title': '📊 Calculadora de Financiamentos',
        'loan-data': 'Dados do Empréstimo',
        'loan-amount': 'Valor Empréstimo (R$)',
        'interest-period': 'Período dos Juros',
        'interest-rate': 'Juros (% ao)',
        'loan-term': 'Prazo (anos)',
        'amortization-system': 'Sistema de Amortização',
        'period-year': 'Ao Ano (%)',
        'period-month': 'Ao Mês (%)',
        'period-day': 'Ao Dia (%)',
        'period-year-short': 'Ano',
        'period-month-short': 'Mês',
        'period-day-short': 'Dia',
        'at': '% ao',
        'system-sac': 'SAC - Sistema de Amortização Constante (Brasil/Itália)',
        'system-price': 'Tabela Price - Sistema Francês (Brasil/Itália)',
        'system-german': 'Sistema Americano - Juros Periódicos + Principal no Final',
        'system-sac-short': 'SAC',
        'system-price-short': 'Tabela Price',
        'system-german-short': 'Americano',
        'btn-calculate': 'Calcular',
        'btn-examples': 'Ver Exemplos',
        'learn-more': 'SAIBA MAIS!',
        'btn-hide-examples': 'Ocultar Exemplos',
        'back': '← Voltar',
        'back-to-calculator': 'Voltar para a Calculadora',
        'results': 'Resultados',
        'loan-amount-result': 'Valor Empréstimo',
        'total-payment': 'Total a Pagar',
        'total-interest-pct': '% Total de Juros',
        'total-interest': 'Total de Juros',
        'selected-installment': 'Parcela Selecionada',
        'of': 'de',
        'installment-value': 'Valor da Parcela',
        'amortization': 'Amortização',
        'interest': 'Juros',
        'outstanding-balance': 'Saldo Devedor',
        'amortization-table': 'Tabela de Amortização Completa',
        'installment': 'Parcela',
        'value': 'Valor',
        'footer': 'Calculadora de Empréstimos - Engenharia Nata @ 2025',
        'aria-home': 'Voltar para a tela inicial',
        'quick-controls': 'Controles Rápidos',
        'quick-controls-desc': 'Ajuste os parâmetros e recalcule instantaneamente',
        'evolution-charts': '📊 Evolução ao Longo do Tempo',
        'accumulated-interest': 'Juros Acumulados',
        'accumulated-amortization': 'Amortização Acumulada',
        'examples-title': '📚 Entenda os Sistemas de Amortização',
        'example-sac-title': '1. Sistema SAC - Amortização Constante',
        'used-in': 'Usado em:',
        'example-sac-usage': 'Brasil (financiamento imobiliário Caixa) e Itália (Ammortamento all\'Italiana)',
        'how-it-works': 'Como funciona:',
        'example-sac-description': 'Você paga sempre a mesma parte do valor emprestado (amortização constante). Os juros caem todo mês porque são calculados sobre o saldo devedor. As parcelas começam mais altas e diminuem com o tempo.',
        'formulas': 'Fórmulas:',
        'formula-sac-1': 'Amortização = Valor Emprestado ÷ Número de Parcelas',
        'formula-sac-2': 'Juros = Saldo Devedor × Taxa Mensal',
        'formula-sac-3': 'Parcela = Amortização + Juros',
        'example-label': 'Exemplo:',
        'example-sac-calc': 'R$ 100.000 a 1% ao mês por 120 meses',
        'example-sac-result-1': 'Amortização fixa: R$ 833,33',
        'example-sac-result-2': 'Mês 1: R$ 833,33 + R$ 1.000 juros = R$ 1.833,33',
        'example-sac-result-3': 'Mês 60: R$ 833,33 + R$ 508 juros = R$ 1.341,33',
        'example-sac-result-4': 'Mês 120: R$ 833,33 + R$ 8 juros = R$ 841,33',
        'example-sac-result-5': 'Total de juros: R$ 60.500',
        'example-sac-advantage': '✅ Melhor para: Quem pode pagar mais no início e quer pagar menos juros no total',
        'example-price-title': '2. Tabela Price (Sistema Francês)',
        'example-price-usage': 'Brasil (empréstimos pessoais, consignados) e Itália (Ammortamento alla Francese - mais comum)',
        'example-price-description': 'Parcelas iguais do início ao fim. No começo, você paga mais juros e menos amortização. Com o tempo, inverte: paga menos juros e mais amortização.',
        'formula-payment': 'Fórmula da Parcela (PMT):',
        'formula-price-1': 'PMT = PV × [i × (1+i)^n] ÷ [(1+i)^n - 1]',
        'formula-price-2': 'Juros = Saldo Devedor × Taxa Mensal',
        'formula-price-3': 'Amortização = PMT - Juros',
        'example-price-calc': 'R$ 100.000 a 1% ao mês por 120 meses',
        'example-price-result-1': 'Parcela fixa: R$ 1.435,14',
        'example-price-result-2': 'Mês 1: R$ 1.000 juros + R$ 435,14 amortização',
        'example-price-result-3': 'Mês 60: R$ 628 juros + R$ 807,14 amortização',
        'example-price-result-4': 'Mês 120: R$ 14 juros + R$ 1.421,14 amortização',
        'example-price-result-5': 'Total de juros: R$ 72.217',
        'example-price-advantage': '✅ Melhor para: Orçamento previsível com parcelas iguais',
        'example-american-title': '3. Sistema Americano',
        'example-american-usage': 'Raro no Brasil, ocasional na Itália para investidores',
        'example-american-description': 'Durante todo o período, você paga apenas os juros. No final, paga o valor total emprestado de uma só vez.',
        'formula-american-1': 'Parcelas 1 a n-1: Valor Emprestado × Taxa Mensal',
        'formula-american-2': 'Última Parcela: Valor Emprestado + Juros',
        'example-american-calc': 'R$ 100.000 a 1% ao mês por 120 meses',
        'example-american-result-1': 'Parcelas 1 a 119: R$ 1.000 (só juros)',
        'example-american-result-2': 'Parcela 120: R$ 101.000 (principal + juros)',
        'example-american-result-3': 'Total de juros: R$ 120.000',
        'example-american-advantage': '✅ Melhor para: Investidores que esperam receber grande valor no futuro',
        'comparison-title': '🔍 Comparação dos Sistemas',
        'comparison-subtitle': 'Para R$ 100.000 a 1% a.m. por 120 meses:',
        'table-system': 'Sistema',
        'table-total-interest': 'Total de Juros',
        'table-first-installment': '1ª Parcela',
        'table-last-installment': 'Última Parcela',
        'table-most-used': 'Mais Usado',
        'table-sac-usage': '🇧🇷 Imóveis',
        'table-price-usage': '🇮🇹 Mutui / 🇧🇷 Consignado',
        'table-american-name': 'Americano',
        'table-american-usage': 'Raro',
        'table-interest': 'Juros',
        'table-interest-balance': 'saldo devedor',
        'table-interest-fixed': 'Fixos',
        'table-installment': 'Parcela',
        'table-installment-variable': 'Variável',
        'table-installment-fixed': 'Fixa',
        'table-amortization': 'Amortização',
        'table-amortization-fixed': 'Fixa',
        'table-amortization-variable': 'Variável',
        'table-amortization-last': 'última parcela',
        'memorial-title': '📚 Memorial de Cálculo - Sistemas de Amortização',
        'memorial-intro-title': '🎯 Objetivo do Cálculo',
        'memorial-intro-text': 'Este memorial explica passo a passo como são calculados os sistemas de amortização (SAC, Tabela Price e Sistema Americano), incluindo as fórmulas matemáticas utilizadas e exemplos práticos com os valores atuais. Todas as fórmulas foram validadas através de testes automatizados.',
        'memorial-formula': 'Fórmula:',
        'memorial-example': 'Exemplo:',
        'memorial-resumo-title': '📊 Resumo Calculado',
        'memorial-resumo-valor': 'Valor Emprestado:',
        'memorial-resumo-taxa': 'Taxa de Juros:',
        'memorial-resumo-prazo': 'Prazo:',
        'memorial-resumo-sistema': 'Sistema:',
        'memorial-resumo-parcela': 'Valor da Parcela:',
        'memorial-resumo-total-juros': 'Total de Juros:',
        'memorial-resumo-total-pago': 'Total Pago:',
        'memorial-exemplos-link': '💡 Quer entender melhor os sistemas?',
        'memorial-exemplos-text': 'Veja exemplos educacionais detalhados de cada sistema de amortização clicando no botão abaixo.',
        'btn-ver-exemplos': 'Ver Exemplos Educacionais',
        'memorial-passo1-title': '1️⃣ Passo 1: Converter Taxa para Mensal',
        'memorial-passo1-explicacao': 'Todos os cálculos são feitos com taxa mensal. Se a taxa for anual ou diária, ela precisa ser convertida para mensal usando juros compostos. Taxa anual: (1 + taxa_anual)^(1/12) - 1. Taxa diária: (1 + taxa_diaria)^30 - 1 (assumindo 30 dias por mês).',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcular Número de Parcelas',
        'memorial-passo2-explicacao': 'O número de parcelas é calculado multiplicando o prazo em anos por 12 (meses por ano).',
        'memorial-passo3-title': '3️⃣ Passo 3: Calcular Tabela de Amortização',
        'memorial-passo3-explicacao': 'A tabela é calculada de acordo com o sistema selecionado, usando as fórmulas específicas de cada método.',
        'memorial-sac-passo1-title': 'SAC - Passo 1: Calcular Amortização Constante',
        'memorial-sac-passo1-formula': 'Amortização = Valor Emprestado ÷ Número de Parcelas',
        'memorial-sac-passo1-explicacao': 'A amortização é sempre a mesma em todas as parcelas.',
        'memorial-sac-passo2-title': 'SAC - Passo 2: Calcular Juros e Parcela',
        'memorial-sac-passo2-formula': 'Juros = Saldo Devedor × Taxa Mensal\nParcela = Amortização + Juros',
        'memorial-sac-passo2-explicacao': 'Os juros são calculados sobre o saldo devedor, que diminui a cada parcela. Por isso, os juros e as parcelas diminuem com o tempo.',
        'memorial-price-passo1-title': 'Tabela Price - Passo 1: Calcular Parcela Fixa (PMT)',
        'memorial-price-passo1-formula': 'PMT = PV × [i × (1+i)^n] ÷ [(1+i)^n - 1]',
        'memorial-price-passo1-explicacao': 'Esta fórmula calcula o valor da parcela fixa que será paga em todas as parcelas. Onde: PV = valor presente (emprestado), i = taxa mensal em decimal, n = número de parcelas. Esta é a fórmula padrão de anuidades (PMT) amplamente utilizada em matemática financeira.',
        'memorial-price-passo2-title': 'Tabela Price - Passo 2: Calcular Juros e Amortização',
        'memorial-price-passo2-formula': 'Juros = Saldo Devedor × Taxa Mensal\nAmortização = PMT - Juros',
        'memorial-price-passo2-explicacao': 'A parcela é fixa, mas a composição muda: no início, mais juros e menos amortização; no final, menos juros e mais amortização.',
        'memorial-americano-passo1-title': 'Sistema Americano - Passo 1: Calcular Juros Mensais',
        'memorial-americano-passo1-formula': 'Juros = Valor Emprestado × Taxa Mensal',
        'memorial-americano-passo1-explicacao': 'Os juros são sempre calculados sobre o valor total emprestado, pois não há amortização intermediária.',
        'memorial-americano-passo2-title': 'Sistema Americano - Passo 2: Calcular Parcelas',
        'memorial-americano-passo2-formula': 'Parcelas 1 a n-1: Apenas Juros\nÚltima Parcela: Juros + Valor Emprestado',
        'memorial-americano-passo2-explicacao': 'Durante todo o período, paga-se apenas os juros. O valor principal é pago integralmente na última parcela.',
        'tooltip-valor-texto': 'O valor emprestado é o montante total que você está solicitando ao banco ou instituição financeira. Este valor será usado para calcular as parcelas, juros e amortização. Valores maiores resultam em parcelas maiores e mais juros totais.',
        'tooltip-prazo-texto': 'O prazo é o tempo total em anos para quitar o empréstimo. Este valor é convertido automaticamente para meses (anos × 12) para os cálculos. Prazos maiores resultam em parcelas menores, mas mais juros totais ao longo do tempo.',
        'tooltip-taxa-texto': 'A taxa de juros é o percentual cobrado sobre o valor emprestado. Você pode informar a taxa em diferentes períodos (ano, mês ou dia). O sistema converte automaticamente para taxa mensal usando juros compostos. Taxas maiores resultam em parcelas maiores e mais juros totais.'
    },
    'it-IT': {
        'app-title': '📊 Calcolatrice di Mutui',
        'loan-data': 'Dati del Mutuo',
        'loan-amount': 'Valore Mutuo (€)',
        'interest-period': 'Periodo degli Interessi',
        'interest-rate': 'Interesse (% al)',
        'loan-term': 'Durata (anni)',
        'amortization-system': 'Sistema di Ammortamento',
        'period-year': 'Annuo (%)',
        'period-month': 'Mensile (%)',
        'period-day': 'Giornaliero (%)',
        'period-year-short': 'Anno',
        'period-month-short': 'Mese',
        'period-day-short': 'Giorno',
        'at': '% al',
        'system-sac': 'Ammortamento all\'Italiana - Ammortamento Costante (Brasile/Italia)',
        'system-price': 'Ammortamento alla Francese - Tabella Price / Francese (Brasile/Italia)',
        'system-german': 'Tedesco - Interessi Periodici + Capitale alla Fine',
        'system-sac-short': 'Italiana',
        'system-price-short': 'Francese',
        'system-german-short': 'Tedesco',
        'btn-calculate': 'Calcola',
        'btn-examples': 'Vedi Esempi',
        'learn-more': 'SCOPRI DI PIÙ!',
        'btn-hide-examples': 'Nascondi Esempi',
        'back': '← Indietro',
        'back-to-calculator': 'Torna alla Calcolatrice',
        'results': 'Risultati',
        'loan-amount-result': 'Valore Mutuo',
        'total-payment': 'Totale da Pagare',
        'total-interest-pct': '% Totale di Interessi',
        'total-interest': 'Totale Interessi',
        'selected-installment': 'Rata Selezionata',
        'of': 'di',
        'installment-value': 'Valore della Rata',
        'amortization': 'Ammortamento',
        'interest': 'Interessi',
        'outstanding-balance': 'Debito Residuo',
        'amortization-table': 'Tabella di Ammortamento Completa',
        'installment': 'Rata',
        'value': 'Valore',
        'footer': 'Calcolatrice di Mutui - Engenharia Nata @ 2025',
        'aria-home': 'Torna alla schermata iniziale',
        'quick-controls': 'Controlli Rapidi',
        'quick-controls-desc': 'Regola i parametri e ricalcola istantaneamente',
        'evolution-charts': '📊 Evoluzione nel Tempo',
        'accumulated-interest': 'Interessi Accumulati',
        'accumulated-amortization': 'Ammortamento Accumulato',
        'examples-title': '📚 Capire i Sistemi di Ammortamento',
        'example-sac-title': '1. Ammortamento all\'Italiana - Ammortamento Costante',
        'used-in': 'Usato in:',
        'example-sac-usage': 'Brasile (mutuo ipotecario) e Italia (Ammortamento all\'Italiana)',
        'how-it-works': 'Come funziona:',
        'example-sac-description': 'Paghi sempre la stessa parte dell\'importo finanziato (ammortamento costante). Gli interessi diminuiscono ogni mese perché sono calcolati sul debito residuo. Le rate iniziano più alte e diminuiscono nel tempo.',
        'formulas': 'Formule:',
        'formula-sac-1': 'Ammortamento = Importo Finanziato ÷ Numero di Rate',
        'formula-sac-2': 'Interessi = Debito Residuo × Tasso Mensile',
        'formula-sac-3': 'Rata = Ammortamento + Interessi',
        'example-label': 'Esempio:',
        'example-sac-calc': '€ 100.000 all\'1% mensile per 120 mesi',
        'example-sac-result-1': 'Ammortamento fisso: € 833,33',
        'example-sac-result-2': 'Mese 1: € 833,33 + € 1.000 interessi = € 1.833,33',
        'example-sac-result-3': 'Mese 60: € 833,33 + € 508 interessi = € 1.341,33',
        'example-sac-result-4': 'Mese 120: € 833,33 + € 8 interessi = € 841,33',
        'example-sac-result-5': 'Totale interessi: € 60.500',
        'example-sac-advantage': '✅ Migliore per: Chi può pagare di più all\'inizio e vuole pagare meno interessi totali',
        'example-price-title': '2. Ammortamento alla Francese (Sistema Francese)',
        'example-price-usage': 'Brasile (prestiti personali, prestiti garantiti) e Italia (Ammortamento alla Francese - più comune)',
        'example-price-description': 'Rate uguali dall\'inizio alla fine. All\'inizio, paghi più interessi e meno ammortamento. Col tempo, si inverte: paghi meno interessi e più ammortamento.',
        'formula-payment': 'Formula della Rata (PMT):',
        'formula-price-1': 'PMT = PV × [i × (1+i)^n] ÷ [(1+i)^n - 1]',
        'formula-price-2': 'Interessi = Debito Residuo × Tasso Mensile',
        'formula-price-3': 'Ammortamento = PMT - Interessi',
        'example-price-calc': '€ 100.000 all\'1% mensile per 120 mesi',
        'example-price-result-1': 'Rata fissa: € 1.435,14',
        'example-price-result-2': 'Mese 1: € 1.000 interessi + € 435,14 ammortamento',
        'example-price-result-3': 'Mese 60: € 628 interessi + € 807,14 ammortamento',
        'example-price-result-4': 'Mese 120: € 14 interessi + € 1.421,14 ammortamento',
        'example-price-result-5': 'Totale interessi: € 72.217',
        'example-price-advantage': '✅ Migliore per: Budget prevedibile con rate uguali',
        'example-american-title': '3. Sistema Tedesco',
        'example-american-usage': 'Raro in Brasile, occasionale in Italia per investitori',
        'example-american-description': 'Durante tutto il periodo, paghi solo gli interessi. Alla fine, paghi l\'importo totale finanziato in una sola volta.',
        'formula-american-1': 'Rate 1 a n-1: Importo Finanziato × Tasso Mensile',
        'formula-american-2': 'Ultima Rata: Importo Finanziato + Interessi',
        'example-american-calc': '€ 100.000 all\'1% mensile per 120 mesi',
        'example-american-result-1': 'Rate 1 a 119: € 1.000 (solo interessi)',
        'example-american-result-2': 'Rata 120: € 101.000 (capitale + interessi)',
        'example-american-result-3': 'Totale interessi: € 120.000',
        'example-american-advantage': '✅ Migliore per: Investitori che si aspettano di ricevere un grande importo in futuro',
        'comparison-title': '🔍 Confronto dei Sistemi',
        'comparison-subtitle': 'Per € 100.000 all\'1% mensile per 120 mesi:',
        'table-system': 'Sistema',
        'table-total-interest': 'Totale Interessi',
        'table-first-installment': '1ª Rata',
        'table-last-installment': 'Ultima Rata',
        'table-most-used': 'Più Usato',
        'table-sac-usage': '🇧🇷 Immobili',
        'table-price-usage': '🇮🇹 Mutui / 🇧🇷 Consignado',
        'table-american-name': 'Tedesco',
        'table-american-usage': 'Raro',
        'table-interest': 'Interessi',
        'table-interest-balance': 'debito residuo',
        'table-interest-fixed': 'Fissi',
        'table-installment': 'Rata',
        'table-installment-variable': 'Variabile',
        'table-installment-fixed': 'Fissa',
        'table-amortization': 'Ammortamento',
        'table-amortization-fixed': 'Fisso',
        'table-amortization-variable': 'Variabile',
        'table-amortization-last': 'ultima rata',
        'memorial-title': '📚 Memoriale di Calcolo - Sistemi di Ammortamento',
        'memorial-intro-title': '🎯 Obiettivo del Calcolo',
        'memorial-intro-text': 'Questo memoriale spiega passo dopo passo come vengono calcolati i sistemi di ammortamento (Ammortamento all\'Italiana, Ammortamento alla Francese e Tedesco), incluse le formule matematiche utilizzate ed esempi pratici con i valori attuali. Tutte le formule sono state validate attraverso test automatizzati.',
        'memorial-formula': 'Formula:',
        'memorial-example': 'Esempio:',
        'memorial-resumo-title': '📊 Riepilogo Calcolato',
        'memorial-resumo-valor': 'Valore Finanziato:',
        'memorial-resumo-taxa': 'Tasso di Interesse:',
        'memorial-resumo-prazo': 'Durata:',
        'memorial-resumo-sistema': 'Sistema:',
        'memorial-resumo-parcela': 'Valore della Rata:',
        'memorial-resumo-total-juros': 'Totale Interessi:',
        'memorial-resumo-total-pago': 'Totale Pagato:',
        'memorial-exemplos-link': '💡 Vuoi capire meglio i sistemi?',
        'memorial-exemplos-text': 'Vedi esempi educativi dettagliati di ogni sistema di ammortamento cliccando sul pulsante qui sotto.',
        'btn-ver-exemplos': 'Vedi Esempi Educativi',
        'memorial-passo1-title': '1️⃣ Passo 1: Convertire il Tasso in Mensile',
        'memorial-passo1-explicacao': 'Tutti i calcoli vengono effettuati con tasso mensile. Se il tasso è annuale o giornaliero, deve essere convertito in mensile usando interessi composti. Tasso annuale: (1 + tasso_annuale)^(1/12) - 1. Tasso giornaliero: (1 + tasso_giornaliero)^30 - 1 (assumendo 30 giorni per mese).',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcolare il Numero di Rate',
        'memorial-passo2-explicacao': 'Il numero di rate viene calcolato moltiplicando la durata in anni per 12 (mesi per anno).',
        'memorial-passo3-title': '3️⃣ Passo 3: Calcolare la Tabella di Ammortamento',
        'memorial-passo3-explicacao': 'La tabella viene calcolata secondo il sistema selezionato, utilizzando le formule specifiche di ogni metodo.',
        'memorial-sac-passo1-title': 'Ammortamento all\'Italiana - Passo 1: Calcolare Ammortamento Costante',
        'memorial-sac-passo1-formula': 'Ammortamento = Valore Finanziato ÷ Numero di Rate',
        'memorial-sac-passo1-explicacao': 'L\'ammortamento è sempre lo stesso in tutte le rate.',
        'memorial-sac-passo2-title': 'Ammortamento all\'Italiana - Passo 2: Calcolare Interessi e Rata',
        'memorial-sac-passo2-formula': 'Interessi = Debito Residuo × Tasso Mensile\nRata = Ammortamento + Interessi',
        'memorial-sac-passo2-explicacao': 'Gli interessi vengono calcolati sul debito residuo, che diminuisce ad ogni rata. Per questo, gli interessi e le rate diminuiscono nel tempo.',
        'memorial-price-passo1-title': 'Ammortamento alla Francese - Passo 1: Calcolare Rata Fissa (PMT)',
        'memorial-price-passo1-formula': 'PMT = PV × [i × (1+i)^n] ÷ [(1+i)^n - 1]',
        'memorial-price-passo1-explicacao': 'Questa formula calcola il valore della rata fissa che verrà pagata in tutte le rate. Dove: PV = valore presente (finanziato), i = tasso mensile in decimale, n = numero di rate. Questa è la formula standard delle rendite (PMT) ampiamente utilizzata in matematica finanziaria.',
        'memorial-price-passo2-title': 'Ammortamento alla Francese - Passo 2: Calcolare Interessi e Ammortamento',
        'memorial-price-passo2-formula': 'Interessi = Debito Residuo × Tasso Mensile\nAmmortamento = PMT - Interessi',
        'memorial-price-passo2-explicacao': 'La rata è fissa, ma la composizione cambia: all\'inizio, più interessi e meno ammortamento; alla fine, meno interessi e più ammortamento.',
        'memorial-americano-passo1-title': 'Tedesco - Passo 1: Calcolare Interessi Mensili',
        'memorial-americano-passo1-formula': 'Interessi = Valore Finanziato × Tasso Mensile',
        'memorial-americano-passo1-explicacao': 'Gli interessi vengono sempre calcolati sul valore totale finanziato, poiché non c\'è ammortamento intermedio.',
        'memorial-americano-passo2-title': 'Tedesco - Passo 2: Calcolare le Rate',
        'memorial-americano-passo2-formula': 'Rate 1 a n-1: Solo Interessi\nUltima Rata: Interessi + Valore Finanziato',
        'memorial-americano-passo2-explicacao': 'Durante tutto il periodo, si pagano solo gli interessi. Il valore principale viene pagato integralmente nell\'ultima rata.',
        'tooltip-valor-texto': 'Il valore del mutuo è l\'importo totale che stai richiedendo alla banca o all\'istituto finanziario. Questo valore verrà utilizzato per calcolare le rate, gli interessi e l\'ammortamento. Valori maggiori comportano rate maggiori e più interessi totali.',
        'tooltip-prazo-texto': 'La durata è il tempo totale in anni per estinguere il mutuo. Questo valore viene convertito automaticamente in mesi (anni × 12) per i calcoli. Durate maggiori comportano rate minori, ma più interessi totali nel tempo.',
        'tooltip-taxa-texto': 'Il tasso di interesse è la percentuale applicata sul valore del mutuo. Puoi inserire il tasso in diversi periodi (anno, mese o giorno). Il sistema converte automaticamente in tasso mensile utilizzando interessi composti. Tassi maggiori comportano rate maggiori e più interessi totali.'
    }
};

// Função para trocar idioma
/**
 * Valida e ajusta valores dos sliders para garantir que estejam dentro dos limites
 * após mudança de idioma ou outras alterações de configuração
 */
function validarEAjustarValoresSliders() {
    // Validar slider de valor
    if (sliderValor) {
        // Garantir que o max está atualizado com o valor correto do idioma atual
        const maxSlider = obterMaxValorSlider();
        sliderValor.max = maxSlider;
        
        const min = parseFloat(sliderValor.min) || 1000;
        const max = maxSlider;
        let valorAtual = parseFloat(sliderValor.value);
        
        if (isNaN(valorAtual)) {
            valorAtual = min;
        } else if (valorAtual < min) {
            valorAtual = min;
        } else if (valorAtual > max) {
            // Se o valor está acima do máximo, ajustar para o máximo
            valorAtual = max;
        }
        
        sliderValor.value = valorAtual;
        
        // Sincronizar input de valor se existir - FORÇAR atualização mesmo se estiver em foco
        // pois estamos ajustando o valor programaticamente após mudança de idioma
        const inputValor = document.getElementById('inputValor');
        if (inputValor) {
            // Atualizar diretamente usando a mesma formatação que a função atualizarDisplayValor
            // mas sem verificar o foco, já que estamos ajustando programaticamente
            if (typeof formatarNumeroComSufixo === 'function') {
                inputValor.value = formatarNumeroComSufixo(valorAtual, 1);
            } else if (typeof formatarNumeroCompacto === 'function') {
                inputValor.value = formatarNumeroCompacto(valorAtual);
            } else {
                // Formatação simples como fallback
                inputValor.value = valorAtual.toLocaleString(idiomaAtual, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                });
            }
            // Ajustar tamanho do input se a função estiver disponível
            if (typeof ajustarTamanhoInput === 'function') {
                ajustarTamanhoInput(inputValor);
            }
        }
    }
    
    // Validar slider de taxa
    if (sliderTaxa) {
        const min = parseFloat(sliderTaxa.min) || 0;
        const max = parseFloat(sliderTaxa.max) || 20;
        let valorAtual = parseFloat(sliderTaxa.value);
        
        if (isNaN(valorAtual)) {
            valorAtual = min;
        } else if (valorAtual < min) {
            valorAtual = min;
        } else if (valorAtual > max) {
            valorAtual = max;
        }
        
        sliderTaxa.value = valorAtual;
        
        // Sincronizar input de taxa se existir
        const inputTaxa = document.getElementById('inputTaxa');
        if (inputTaxa && document.activeElement !== inputTaxa) {
            if (typeof atualizarDisplayTaxa === 'function') {
                atualizarDisplayTaxa();
            }
        }
    }
    
    // Validar slider de prazo
    if (sliderPrazo) {
        const min = parseFloat(sliderPrazo.min) || 1;
        const max = parseFloat(sliderPrazo.max) || 50;
        let valorAtual = parseFloat(sliderPrazo.value);
        
        if (isNaN(valorAtual)) {
            valorAtual = min;
        } else if (valorAtual < min) {
            valorAtual = min;
        } else if (valorAtual > max) {
            valorAtual = max;
        }
        
        sliderPrazo.value = valorAtual;
        
        // Sincronizar input de prazo se existir
        const inputPrazo = document.getElementById('inputPrazo');
        if (inputPrazo && document.activeElement !== inputPrazo) {
            if (typeof atualizarDisplayPrazo === 'function') {
                atualizarDisplayPrazo();
            }
        }
    }
}

function trocarIdioma(idioma) {
    idiomaAtual = idioma;
    moedaAtual = idioma === 'pt-BR' ? 'BRL' : 'EUR';
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, idioma);
    document.documentElement.lang = idioma;
    
    // Atualizar máximo do slider de valor baseado no idioma
    if (sliderValor) {
        const maxSlider = obterMaxValorSlider();
        sliderValor.max = maxSlider;
    }
    
    // Validar e ajustar todos os valores dos sliders para garantir que estejam dentro dos limites
    validarEAjustarValoresSliders();
    
    // Atualizar botões ativos usando data-lang (mais confiável)
    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(btn => {
        if (btn.getAttribute('data-lang') === idioma) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Atualizar textos com data-i18n
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const chave = element.getAttribute('data-i18n');
        if (traducoes[idioma] && traducoes[idioma][chave]) {
            element.textContent = traducoes[idioma][chave];
        }
    });
    
    // Recalcular após validar valores
    calcularEmprestimo();

    // Atualiza o aria-label do botão home (acessibilidade)
    const homeLabel = traducoes[idioma]?.['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
}

/**
 * Converte uma taxa de juros para o equivalente mensal
 * 
 * Esta função é essencial para os cálculos de empréstimo, pois todos os
 * sistemas de amortização trabalham com taxas mensais, mas o usuário pode
 * informar a taxa em diferentes períodos (ano, mês ou dia).
 * 
 * @param {number} taxa - Taxa de juros em percentual (ex: 12 = 12%)
 * @param {string} periodo - Período da taxa: 'ano', 'mes' ou 'dia'
 * @returns {number} Taxa mensal equivalente em decimal (ex: 0.01 = 1%)
 * 
 * IMPORTANTE: Usa juros compostos, não simples!
 * 
 * Exemplos:
 * - 12% ao ano → ~0.95% ao mês (não é 12/12 = 1%!)
 * - 1% ao mês → 0.01 (decimal)
 * - 0.03% ao dia → ~0.94% ao mês (assumindo 30 dias)
 */
function converterTaxaParaMensal(taxa, periodo) {
    // switch = estrutura que escolhe uma ação baseada no valor da variável
    switch(periodo) {
        case 'ano':
            // CASO 1: Taxa anual → mensal
            // Fórmula de juros compostos: taxa_mensal = (1 + taxa_anual)^(1/12) - 1
            // 
            // Por que não simplesmente dividir por 12?
            // Porque juros compostos não são lineares!
            // Exemplo: 12% ao ano não é 1% ao mês
            // Com juros compostos: (1.12)^(1/12) - 1 ≈ 0.0095 = 0.95% ao mês
            //
            // Math.pow(base, expoente) = eleva a base ao expoente
            // taxa / 100 = converte percentual para decimal (12% → 0.12)
            // 1/12 = divide o ano em 12 meses
            return Math.pow(1 + taxa / 100, 1/12) - 1;
            
        case 'mes':
            // CASO 2: Taxa mensal → mensal (já está no período correto)
            // Apenas converte de percentual para decimal
            // Exemplo: 1% → 0.01
            return taxa / 100;
            
        case 'dia':
            // CASO 3: Taxa diária → mensal
            // Assumimos que 1 mês = 30 dias
            // Fórmula: taxa_mensal = (1 + taxa_diaria)^30 - 1
            //
            // Exemplo: 0.03% ao dia
            // (1.0003)^30 - 1 ≈ 0.0094 = 0.94% ao mês
            return Math.pow(1 + taxa / 100, 30) - 1;
            
        default:
            // CASO PADRÃO: Se o período não for reconhecido, trata como mensal
            // Isso evita erros se alguém passar um valor inválido
            return taxa / 100;
    }
}

    /**
     * Converte uma taxa percentual de um período para outro preservando equivalência
     * Ex: converterTaxaBetweenPeriods(12, 'ano', 'mes') -> ~0.95 (12% a.a. => ~0.95% a.m.)
     * @param {number} taxaPercent - taxa no período 'from' como percentual (ex: 12 -> 12%)
     * @param {'ano'|'mes'|'dia'} from - período de origem
     * @param {'ano'|'mes'|'dia'} to - período destino
     * @returns {number} taxa no período destino como percentual (ex: 0.95 => 0.95%)
     */
    function converterTaxaBetweenPeriods(taxaPercent, from, to) {
        // Converte o valor informado para taxa mensal (decimal) e depois converte
        // para o período destino. Trabalhamos em decimais nas operações e devolvemos
        // como percentual (multiplicamos por 100 no final).
        const mensalDecimal = converterTaxaParaMensal(taxaPercent, from); // decimal

        let targetDecimal;
        if (to === 'mes') {
            targetDecimal = mensalDecimal;
        } else if (to === 'ano') {
            // (1 + r_ano)^(1/12) - 1 = r_mes  => r_ano = (1 + r_mes)^12 - 1
            targetDecimal = Math.pow(1 + mensalDecimal, 12) - 1;
        } else if (to === 'dia') {
            // (1 + r_mes) = (1 + r_dia)^30  => r_dia = (1 + r_mes)^(1/30) - 1
            targetDecimal = Math.pow(1 + mensalDecimal, 1 / 30) - 1;
        } else {
            // fallback: return same as input
            targetDecimal = mensalDecimal;
        }

        return targetDecimal * 100; // percentual
    }

/**
 * Obtém o limite máximo da taxa de juros baseado no período
 * Limite base: 20% ao ano
 * @param {'ano'|'mes'|'dia'} periodo - Período da taxa
 * @returns {number} Limite máximo em percentual
 */
function obterLimiteMaximoTaxa(periodo) {
    const MAX_TAXA_ANO = 20; // 20% ao ano
    
    switch(periodo) {
        case 'ano':
            return MAX_TAXA_ANO;
        case 'mes':
            // Converte 20% ao ano para mensal equivalente
            // (1.20^(1/12) - 1) * 100
            return (Math.pow(1 + MAX_TAXA_ANO / 100, 1/12) - 1) * 100;
        case 'dia':
            // Converte 20% ao ano para diária equivalente
            // (1.20^(1/365) - 1) * 100
            return (Math.pow(1 + MAX_TAXA_ANO / 100, 1/365) - 1) * 100;
        default:
            return MAX_TAXA_ANO;
    }
}

/**
 * Calcula a tabela de amortização usando o Sistema Price (Tabela Price)
 * 
 * Este é o sistema mais comum no Brasil para empréstimos pessoais e consignados.
 * Também é conhecido como "Sistema Francês" na Itália.
 * 
 * Características:
 * - Parcelas FIXAS durante todo o prazo
 * - No início: paga mais juros, menos amortização
 * - No final: paga menos juros, mais amortização
 * - Total de juros: maior que no SAC
 * 
 * @param {number} valorEmprestimo - Valor total emprestado (ex: 100000)
 * @param {number} taxaMensal - Taxa de juros mensal em decimal (ex: 0.01 = 1%)
 * @param {number} numeroParcelas - Número total de parcelas (ex: 120)
 * @returns {Array} Array com objetos contendo dados de cada parcela
 * 
 * Fórmula da parcela fixa (PMT):
 * PMT = PV × [i × (1+i)^n] / [(1+i)^n - 1]
 * 
 * Onde:
 * - PV = Valor Presente (valor emprestado)
 * - i = taxa de juros mensal
 * - n = número de parcelas
 */
function calcularPrice(valorEmprestimo, taxaMensal, numeroParcelas) {
    // Array que vai guardar os dados de cada parcela
    const tabela = [];
    
    // Saldo devedor começa sendo o valor total emprestado
    // Vai diminuindo conforme as parcelas são pagas
    let saldoDevedor = valorEmprestimo;
    
    // PASSO 1: Calcula o valor da parcela fixa (PMT)
    // Esta parcela será a mesma em todos os meses
    
    // Calcula (1 + taxa)^número_de_parcelas
    // Este é um fator usado na fórmula
    const fator = Math.pow(1 + taxaMensal, numeroParcelas);
    
    // Aplica a fórmula completa da parcela fixa
    // PMT = PV × [i × (1+i)^n] / [(1+i)^n - 1]
    // 
    // Explicação da fórmula:
    // - (taxaMensal * fator) = numerador da fração
    // - (fator - 1) = denominador da fração
    // - Multiplica pelo valor emprestado para obter a parcela
    const parcelaFixa = valorEmprestimo * (taxaMensal * fator) / (fator - 1);
    
    // PASSO 2: Para cada parcela, calcula juros, amortização e saldo
    // Loop que repete uma vez para cada parcela (de 1 até numeroParcelas)
    for (let i = 1; i <= numeroParcelas; i++) {
        // Calcula os juros da parcela atual
        // Juros = Saldo Devedor × Taxa Mensal
        // No início, o saldo é maior, então os juros são maiores
        // No final, o saldo é menor, então os juros são menores
        const juros = saldoDevedor * taxaMensal;
        
        // Calcula a amortização (quanto do empréstimo está sendo pago)
        // Amortização = Parcela Fixa - Juros
        // No início: parcela grande, juros grandes → amortização pequena
        // No final: parcela grande, juros pequenos → amortização grande
        const amortizacao = parcelaFixa - juros;
        
        // Reduz o saldo devedor pela amortização paga
        // saldoDevedor -= amortizacao é o mesmo que:
        // saldoDevedor = saldoDevedor - amortizacao
        saldoDevedor -= amortizacao;
        
        // CORREÇÃO: Na última parcela, força o saldo a ser zero
        // Isso corrige pequenos erros de arredondamento que podem acumular
        // Exemplo: pode sobrar R$ 0.01 devido a arredondamentos
        if (i === numeroParcelas) {
            saldoDevedor = 0;
        }
        
        // Adiciona os dados desta parcela ao array da tabela
        tabela.push({
            parcela: i,                    // Número da parcela (1, 2, 3, ...)
            valorParcela: parcelaFixa,     // Valor total da parcela (sempre igual)
            amortizacao: amortizacao,      // Quanto foi amortizado nesta parcela
            juros: juros,                  // Quanto foi pago de juros nesta parcela
            saldoDevedor: Math.max(0, saldoDevedor)  // Saldo restante (nunca negativo)
        });
    }
    
    // Retorna a tabela completa com todas as parcelas
    return tabela;
}

/**
 * ============================================
 * FUNÇÃO: CALCULAR SISTEMA SAC
 * ============================================
 * 
 * Calcula a tabela de amortização usando o Sistema de Amortização Constante (SAC).
 * Neste sistema, a amortização é sempre a mesma em todas as parcelas, mas o valor
 * total da parcela diminui com o tempo porque os juros são calculados sobre o
 * saldo devedor, que diminui a cada pagamento.
 * 
 * CARACTERÍSTICAS DO SISTEMA SAC:
 * - Amortização constante (sempre igual)
 * - Juros decrescentes (diminuem a cada parcela)
 * - Parcelas decrescentes (começam maiores e diminuem)
 * - Total de juros: menor que no Price para o mesmo empréstimo
 * 
 * @param {number} valorEmprestimo - Valor total emprestado
 * @param {number} taxaMensal - Taxa de juros mensal em decimal (ex: 0.01 = 1% ao mês)
 * @param {number} numeroParcelas - Número total de parcelas
 * @returns {Array} Array de objetos, cada um representando uma parcela com:
 *   - parcela: número da parcela (1, 2, 3, ...)
 *   - valorParcela: valor total da parcela (amortização + juros) - diminui com o tempo
 *   - amortizacao: valor amortizado (sempre igual)
 *   - juros: valor de juros (diminui com o tempo)
 *   - saldoDevedor: saldo restante após pagar esta parcela
 * 
 * FÓRMULAS DO SISTEMA SAC:
 * 
 * 1. Amortização constante:
 *    Amortização = Valor Emprestado / Número de Parcelas
 * 
 * 2. Juros de cada parcela:
 *    Juros = Saldo Devedor × Taxa Mensal
 *    (O saldo devedor diminui a cada parcela, então os juros também diminuem)
 * 
 * 3. Valor da parcela:
 *    Parcela = Amortização + Juros
 *    (Como a amortização é constante e os juros diminuem, a parcela diminui)
 * 
 * 4. Novo saldo após cada parcela:
 *    Saldo Devedor = Saldo Devedor - Amortização
 * 
 * EXEMPLO PRÁTICO:
 *   Valor: R$ 100.000
 *   Taxa: 1% ao mês (0.01)
 *   Prazo: 120 meses
 *   
 *   Amortização constante = 100.000 / 120 = R$ 833,33
 *   
 *   Mês 1:
 *     Juros = 100.000 × 0.01 = R$ 1.000,00
 *     Parcela = 833,33 + 1.000,00 = R$ 1.833,33
 *     Saldo = 100.000 - 833,33 = R$ 99.166,67
 *   
 *   Mês 60:
 *     Saldo inicial ≈ R$ 50.000 (aproximadamente metade)
 *     Juros = 50.000 × 0.01 = R$ 500,00
 *     Parcela = 833,33 + 500,00 = R$ 1.333,33
 *   
 *   Mês 120:
 *     Saldo inicial ≈ R$ 833,33 (última amortização)
 *     Juros = 833,33 × 0.01 = R$ 8,33
 *     Parcela = 833,33 + 8,33 = R$ 841,66
 *     Saldo = 0
 * 
 * VANTAGENS:
 * - Menor total de juros pagos comparado ao Price
 * - Amortização mais rápida no início
 * - Melhor para quem pode pagar mais no início
 * 
 * DESVANTAGENS:
 * - Parcelas iniciais maiores
 * - Pode ser difícil para orçamentos apertados no início
 * 
 * USO:
 * - Brasil: Financiamento imobiliário da Caixa Econômica Federal
 * - Itália: Ammortamento all'Italiana
 */
function calcularSAC(valorEmprestimo, taxaMensal, numeroParcelas) {
    // Array que armazena os dados de cada parcela calculada
    const tabela = [];
    
    // Saldo devedor inicial = valor total emprestado
    // Vai diminuindo a cada parcela conforme a amortização é paga
    let saldoDevedor = valorEmprestimo;
    
    // ============================================
    // PASSO 1: CALCULAR AMORTIZAÇÃO CONSTANTE
    // ============================================
    // A amortização é sempre a mesma em todas as parcelas.
    // Fórmula: Amortização = Valor Emprestado / Número de Parcelas
    // 
    // Exemplo: R$ 100.000 em 120 parcelas = R$ 833,33 por parcela
    const amortizacaoConstante = valorEmprestimo / numeroParcelas;
    
    // Para cada parcela, calcula juros, parcela e saldo
    // Loop que repete uma vez para cada parcela (de 1 até numeroParcelas)
    for (let i = 1; i <= numeroParcelas; i++) {
        // PASSO 1: Calcula os juros da parcela atual
        // Juros = Saldo Devedor × Taxa Mensal
        // 
        // Como o saldo diminui a cada mês, os juros também diminuem
        // Exemplo:
        // - Mês 1: saldo = R$ 100.000 → juros = R$ 1.000
        // - Mês 60: saldo = R$ 50.000 → juros = R$ 500
        // - Mês 120: saldo = R$ 833 → juros = R$ 8,33
        const juros = saldoDevedor * taxaMensal;
        
        // PASSO 2: Calcula o valor total da parcela
        // Parcela = Amortização Constante + Juros
        // 
        // Como a amortização é fixa e os juros diminuem,
        // a parcela também diminui com o tempo
        // Exemplo:
        // - Mês 1: R$ 833,33 + R$ 1.000 = R$ 1.833,33
        // - Mês 60: R$ 833,33 + R$ 500 = R$ 1.333,33
        // - Mês 120: R$ 833,33 + R$ 8,33 = R$ 841,66
        const valorParcela = amortizacaoConstante + juros;
        
        // PASSO 3: Reduz o saldo devedor pela amortização paga
        // Como a amortização é constante, o saldo diminui sempre o mesmo valor
        saldoDevedor -= amortizacaoConstante;
        
        // CORREÇÃO: Na última parcela, força o saldo a ser zero
        // Isso corrige pequenos erros de arredondamento
        if (i === numeroParcelas) {
            saldoDevedor = 0;
        }
        
        // Adiciona os dados desta parcela ao array da tabela
        tabela.push({
            parcela: i,                        // Número da parcela (1, 2, 3, ...)
            valorParcela: valorParcela,        // Valor total da parcela (diminui com o tempo)
            amortizacao: amortizacaoConstante, // Amortização (sempre igual)
            juros: juros,                      // Juros (diminuem com o tempo)
            saldoDevedor: Math.max(0, saldoDevedor)  // Saldo restante (nunca negativo)
        });
    }
    
    // Retorna a tabela completa com todas as parcelas
    return tabela;
}

/**
 * ============================================
 * FUNÇÃO: CALCULAR SISTEMA AMERICANO
 * ============================================
 * 
 * Calcula a tabela de amortização usando o Sistema Americano.
 * Neste sistema, durante todo o período são pagos apenas os juros,
 * e o valor principal (valor emprestado) é pago integralmente na última parcela.
 * 
 * CARACTERÍSTICAS DO SISTEMA AMERICANO:
 * - Parcelas intermediárias: pagam apenas juros (valor fixo)
 * - Última parcela: paga juros + valor principal completo
 * - Saldo devedor: permanece constante até a última parcela
 * - Total de juros: maior que nos outros sistemas (juros sobre valor total durante todo o período)
 * 
 * @param {number} valorEmprestimo - Valor total emprestado
 * @param {number} taxaMensal - Taxa de juros mensal em decimal (ex: 0.01 = 1% ao mês)
 * @param {number} numeroParcelas - Número total de parcelas
 * @returns {Array} Array de objetos, cada um representando uma parcela com:
 *   - parcela: número da parcela (1, 2, 3, ...)
 *   - valorParcela: valor da parcela
 *     * Parcelas 1 a n-1: apenas juros (valor fixo)
 *     * Última parcela: juros + valor principal
 *   - amortizacao: valor amortizado
 *     * Parcelas 1 a n-1: zero (não amortiza nada)
 *     * Última parcela: valor principal completo
 *   - juros: valor de juros (sempre igual, calculado sobre o valor total)
 *   - saldoDevedor: saldo restante
 *     * Parcelas 1 a n-1: permanece igual ao valor emprestado
 *     * Última parcela: zera
 * 
 * FÓRMULAS DO SISTEMA AMERICANO:
 * 
 * 1. Juros mensais (constantes):
 *    Juros = Valor Emprestado × Taxa Mensal
 *    (Sempre calculado sobre o valor total, pois não há amortização intermediária)
 * 
 * 2. Parcelas intermediárias (1 a n-1):
 *    Parcela = Juros
 *    Amortização = 0
 *    Saldo Devedor = Valor Emprestado (não muda)
 * 
 * 3. Última parcela (n):
 *    Parcela = Juros + Valor Emprestado
 *    Amortização = Valor Emprestado
 *    Saldo Devedor = 0
 * 
 * EXEMPLO PRÁTICO:
 *   Valor: R$ 100.000
 *   Taxa: 1% ao mês (0.01)
 *   Prazo: 120 meses
 *   
 *   Juros mensais = 100.000 × 0.01 = R$ 1.000,00
 *   
 *   Parcelas 1 a 119:
 *     Parcela = R$ 1.000,00 (apenas juros)
 *     Amortização = R$ 0,00
 *     Saldo = R$ 100.000,00 (permanece constante)
 *   
 *   Parcela 120 (última):
 *     Parcela = 1.000,00 + 100.000,00 = R$ 101.000,00
 *     Amortização = R$ 100.000,00
 *     Saldo = R$ 0,00
 *   
 *   Total de juros = 1.000,00 × 120 = R$ 120.000,00
 * 
 * VANTAGENS:
 * - Parcelas menores durante o período (apenas juros)
 * - Útil para investidores que esperam valorização do capital
 * - Permite manter o capital disponível por mais tempo
 * 
 * DESVANTAGENS:
 * - Última parcela muito grande (pode ser difícil de pagar)
 * - Maior total de juros pagos
 * - Risco de não conseguir pagar a última parcela
 * 
 * USO:
 * - Raro no Brasil
 * - Ocasional na Itália para investidores
 * - Mais comum em empréstimos de curto prazo ou para investimentos
 */
function calcularAlemao(valorEmprestimo, taxaMensal, numeroParcelas) {
    // Array que vai guardar os dados de cada parcela
    const tabela = [];
    
    // Calcula o valor dos juros mensais (sempre o mesmo)
    // Juros = Valor Emprestado × Taxa Mensal
    // Exemplo: R$ 100.000 × 0.01 = R$ 1.000 por mês
    const jurosMensal = valorEmprestimo * taxaMensal;
    
    // Para cada parcela, calcula os valores
    // Loop que repete uma vez para cada parcela (de 1 até numeroParcelas)
    for (let i = 1; i <= numeroParcelas; i++) {
        // Verifica se é a última parcela
        if (i === numeroParcelas) {
            // ÚLTIMA PARCELA: paga juros + todo o principal
            tabela.push({
                parcela: i,                                    // Número da parcela
                valorParcela: valorEmprestimo + jurosMensal,  // Total: principal + juros
                amortizacao: valorEmprestimo,                 // Amortiza tudo de uma vez
                juros: jurosMensal,                           // Juros da última parcela
                saldoDevedor: 0                               // Saldo zera após pagar
            });
        } else {
            // PARCELAS INTERMEDIÁRIAS (1 até n-1): pagam apenas juros
            // Não há amortização, então o saldo permanece igual
            tabela.push({
                parcela: i,                    // Número da parcela
                valorParcela: jurosMensal,     // Valor da parcela = apenas juros
                amortizacao: 0,                // Não amortiza nada (zero)
                juros: jurosMensal,            // Juros pagos
                saldoDevedor: valorEmprestimo  // Saldo continua igual (não diminui)
            });
        }
    }
    
    // Retorna a tabela completa com todas as parcelas
    return tabela;
}

/**
 * Função principal que calcula o empréstimo completo
 * 
 * Esta é a função mais importante do arquivo. Ela:
 * 1. Lê os valores informados pelo usuário (valor, taxa, prazo, sistema)
 * 2. Valida os dados
 * 3. Converte a taxa para mensal
 * 4. Calcula a tabela de amortização usando o sistema escolhido
 * 5. Calcula totais (juros, valor total a pagar)
 * 6. Atualiza toda a interface (tabela, gráficos, resumos)
 * 
 * Esta função é chamada sempre que o usuário muda qualquer valor
 * (slider, input, sistema de amortização, etc.)
 */
function calcularEmprestimo() {
    // ============================================
    // PASSO 1: LER VALORES DOS CONTROLES
    // ============================================
    
    // Lê o valor do slider de valor emprestado
    // parseFloat() = converte texto para número decimal
    // || 0 = se não conseguir converter, usa zero
    let valorEmprestimo = parseFloat(sliderValor.value) || 0;
    
    // Verifica se o usuário digitou um valor manual maior que o máximo do slider
    // Isso permite valores acima do limite do slider (até 10 milhões)
    const inputValor = document.getElementById('inputValor');
    if (inputValor) {
        // Converte valor com sufixos (k/M/m) para número
        const valorInput = obterValorNumericoComSufixo(inputValor.value);
        // Pega o máximo permitido pelo slider (depende do idioma)
        const maxSlider = obterMaxValorSlider();
        // Se o valor digitado está acima do slider mas dentro do limite (10 milhões)
        if (valorInput > maxSlider && valorInput <= 10000000) {
            // Usa o valor digitado manualmente
            valorEmprestimo = valorInput;
        }
    }
    
    // Lê o período da taxa de juros (ano, mês ou dia)
    // querySelector com :checked = pega o radio button selecionado
    const periodoJuros = document.querySelector('input[name="periodoRapido"]:checked').value;
    
    // Lê a taxa de juros do slider
    const taxaJuros = parseFloat(sliderTaxa.value) || 0;
    
    // Lê o prazo em anos do slider
    // parseInt() = converte para número inteiro (sem decimais)
    const prazoAnos = parseInt(sliderPrazo.value) || 0;
    
    // Lê o sistema de amortização escolhido (SAC, Price ou Americano)
    const tipoCalculo = document.querySelector('input[name="sistemaRapido"]:checked').value;
    
    // ============================================
    // PASSO 2: VALIDAR OS DADOS
    // ============================================
    
    // Validação 1: Valor emprestado deve ser pelo menos R$ 1.000
    if (!valorEmprestimo || valorEmprestimo < 1000) {
        // Se for menor, ajusta o slider para o mínimo
        if (sliderValor) {
            sliderValor.value = 1000;
            atualizarDisplayValor();  // Atualiza o display do valor
        }
        // Usa o valor mínimo para os cálculos
        valorEmprestimo = 1000;
    }
    
    // Validação 2: Taxa não pode ser negativa
    if (taxaJuros < 0) {
        return;  // Para a execução se a taxa for inválida
    }
    
    // Validação 3: Prazo deve ser pelo menos 1 ano
    if (!prazoAnos || prazoAnos <= 0) {
        return;  // Para a execução se o prazo for inválido
    }
    
    // ============================================
    // PASSO 3: CONVERTER E PREPARAR DADOS
    // ============================================
    
    // Converte a taxa para mensal (todos os cálculos usam taxa mensal)
    // Exemplo: 12% ao ano → ~0.95% ao mês
    const taxaMensal = converterTaxaParaMensal(taxaJuros, periodoJuros);
    
    // Converte prazo de anos para número de parcelas
    // Exemplo: 10 anos → 120 parcelas (10 × 12 meses)
    const numeroParcelas = prazoAnos * 12;
    
    // ============================================
    // PASSO 4: CALCULAR A TABELA DE AMORTIZAÇÃO
    // ============================================
    
    // Escolhe qual função usar baseado no sistema selecionado
    switch(tipoCalculo) {
        case 'price':
            // Sistema Price: parcelas fixas
            tabelaAmortizacaoAtual = calcularPrice(valorEmprestimo, taxaMensal, numeroParcelas);
            break;
            
        case 'sac':
            // Sistema SAC: amortização constante, parcelas decrescentes
            tabelaAmortizacaoAtual = calcularSAC(valorEmprestimo, taxaMensal, numeroParcelas);
            break;
            
        case 'alemao':
            // Sistema Americano: só juros + principal no final
            tabelaAmortizacaoAtual = calcularAlemao(valorEmprestimo, taxaMensal, numeroParcelas);
            break;
            
        default:
            // Se o sistema não for reconhecido, mostra erro e para
            alert('Sistema de amortização inválido.');
            return;
    }
    
    // ============================================
    // PASSO 5: GUARDAR DADOS PARA USO POSTERIOR
    // ============================================
    
    // Salva todos os dados em uma variável global
    // Isso permite que outras funções acessem esses dados depois
    dadosEmprestimo = {
        valorEmprestimo: valorEmprestimo,    // Valor emprestado
        periodoJuros: periodoJuros,          // Período da taxa (ano/mês/dia)
        taxaJuros: taxaJuros,                // Taxa no período original
        taxaMensal: taxaMensal,              // Taxa convertida para mensal
        prazoAnos: prazoAnos,                // Prazo em anos
        numeroParcelas: numeroParcelas,      // Número de parcelas
        tipoCalculo: tipoCalculo             // Sistema usado (price/sac/alemao)
    };
    
    // ============================================
    // PASSO 6: CALCULAR TOTAIS E ESTATÍSTICAS
    // ============================================
    
    // Calcula o total de juros pagos
    // reduce() = percorre o array somando os juros de cada parcela
    // (sum, item) => sum + item.juros = para cada item, adiciona os juros ao total
    const totalJuros = tabelaAmortizacaoAtual.reduce(function(soma, parcela) {
        return soma + parcela.juros;
    }, 0);
    
    // Calcula o valor total a pagar
    // Total = Valor emprestado + Total de juros
    const totalPagar = valorEmprestimo + totalJuros;
    
    // Calcula a porcentagem de juros sobre o valor emprestado
    // Exemplo: R$ 60.000 de juros em R$ 100.000 = 60%
    const porcentagemJuros = (totalJuros / valorEmprestimo) * 100;
    
    // ============================================
    // PASSO 7: ATUALIZAR A INTERFACE
    // ============================================
    
    // Mostra os resultados principais (valor, juros, total, porcentagem)
    exibirResultados(valorEmprestimo, totalJuros, totalPagar, porcentagemJuros);
    
    // Configura o slider de seleção de parcela
    sliderParcelas.max = numeroParcelas;      // Define o máximo como número de parcelas
    
    // Restaura a última posição selecionada, ou o máximo se for maior que o novo máximo
    // Isso mantém a parcela que o usuário estava visualizando quando outros valores mudam
    if (ultimaParcelaSelecionada > numeroParcelas) {
        // Se a última posição for maior que o novo máximo, usa o máximo
        ultimaParcelaSelecionada = numeroParcelas;
    }
    sliderParcelas.value = ultimaParcelaSelecionada;
    const totalParcelas = document.getElementById('totalParcelas');
    if (totalParcelas) totalParcelas.textContent = numeroParcelas;  // Mostra o total
    
    // Atualiza a exibição da parcela selecionada
    atualizarParcelaExibida();
    
    // Preenche a tabela completa de amortização (todas as parcelas)
    preencherTabelaAmortizacao();
    
    // Atualiza os gráficos com os novos dados
    atualizarGraficos();
    
    // Atualiza os exemplos educativos com os valores atuais
    // Isso faz com que quando o usuário clicar em "Saiba Mais",
    // os exemplos usem os mesmos valores que ele está calculando
    atualizarExemplosComValores();
    
    // Mostra a seção de resultados (caso esteja escondida)
    resultados.style.display = 'block';
}

// Exibir resumo dos resultados
function exibirResultados(valorEmprestimo, totalJuros, totalPagar, porcentagemJuros) {
    const resValorEmprestado = document.getElementById('resValorEmprestado');
    if (resValorEmprestado) resValorEmprestado.textContent = formatarMoedaSemDecimal(valorEmprestimo);
    const resTotalJuros = document.getElementById('resTotalJuros');
    if (resTotalJuros) resTotalJuros.textContent = formatarMoedaSemDecimal(totalJuros);
    const resTotalPagar = document.getElementById('resTotalPagar');
    if (resTotalPagar) resTotalPagar.textContent = formatarMoedaSemDecimal(totalPagar);
    const resPorcentagemJuros = document.getElementById('resPorcentagemJuros');
    if (resPorcentagemJuros) resPorcentagemJuros.textContent = formatarNumeroDecimal(porcentagemJuros, 1) + '%';
}

// Atualizar exibição da parcela selecionada no slider
window.atualizarParcelaExibida = function() {
    const indiceParcela = parseInt(sliderParcelas.value) - 1;
    const parcela = tabelaAmortizacaoAtual[indiceParcela];
    
    if (!parcela) return;
    
    // Atualiza os valores na tela
    const numeroParcela = document.getElementById('numeroParcela');
    if (numeroParcela) numeroParcela.textContent = parcela.parcela;
    const valorParcela = document.getElementById('valorParcela');
    if (valorParcela) valorParcela.textContent = formatarMoeda(parcela.valorParcela);
    const valorAmortizacao = document.getElementById('valorAmortizacao');
    if (valorAmortizacao) valorAmortizacao.textContent = formatarMoeda(parcela.amortizacao);
    const valorJurosParcela = document.getElementById('valorJurosParcela');
    if (valorJurosParcela) valorJurosParcela.textContent = formatarMoeda(parcela.juros);
    const saldoDevedor = document.getElementById('saldoDevedor');
    if (saldoDevedor) saldoDevedor.textContent = formatarMoeda(parcela.saldoDevedor);
}

// Preencher tabela de amortização (todas as parcelas)
function preencherTabelaAmortizacao() {
    const tbody = document.querySelector('#tabelaAmortizacao tbody');
    tbody.innerHTML = '';
    
    const parcelasExibir = tabelaAmortizacaoAtual.length;
    
    for (let i = 0; i < parcelasExibir; i++) {
        const parcela = tabelaAmortizacaoAtual[i];
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${parcela.parcela}</td>
            <td>${formatarMoeda(parcela.valorParcela)}</td>
            <td>${formatarMoeda(parcela.amortizacao)}</td>
            <td>${formatarMoeda(parcela.juros)}</td>
            <td>${formatarMoeda(parcela.saldoDevedor)}</td>
        `;
        
        tbody.appendChild(tr);
    }
    
    // Garantir que o scroll da tabela inicie à esquerda (mostrando a primeira coluna)
    const tabelaScroll = document.querySelector('.tabela-scroll');
    if (tabelaScroll) {
        // Usar setTimeout para garantir que o DOM foi atualizado
        setTimeout(() => {
            tabelaScroll.scrollLeft = 0;
        }, 0);
    }
}

// Toggle memorial de cálculo
function toggleMemorial() {
    const memorialSection = document.getElementById('memorialSection');
    const resultadosSection = document.getElementById('resultadosSection');
    
    if (!memorialSection) {
        console.error('memorialSection não encontrado');
        return;
    }
    
    if (memorialSection.style.display === 'none' || memorialSection.style.display === '') {
        // Atualizar memorial com valores atuais
        if (typeof atualizarMemorialComValores === 'function') {
            atualizarMemorialComValores();
        }
        memorialSection.style.display = 'block';
        if (resultadosSection) resultadosSection.style.display = 'none';
        // Rolar para o topo da seção do memorial
        setTimeout(() => {
            memorialSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    } else {
        memorialSection.style.display = 'none';
        if (resultadosSection) resultadosSection.style.display = 'block';
    }
}

// Toggle exemplos (agora chamado a partir do memorial)
function toggleExemplos() {
    if (!exemplosSection) {
        console.error('exemplosSection não encontrado');
        return;
    }
    
    const memorialSection = document.getElementById('memorialSection');
    
    if (exemplosSection.style.display === 'none' || exemplosSection.style.display === '') {
        // Atualizar exemplos com valores atuais dos inputs
        atualizarExemplosComValores();
        exemplosSection.style.display = 'block';
        if (memorialSection) memorialSection.style.display = 'none';
        // Rolar para o topo da página
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        exemplosSection.style.display = 'none';
        if (memorialSection) memorialSection.style.display = 'block';
    }
}

/**
 * Atualiza o memorial de cálculo com os valores atuais dos cálculos
 */
function atualizarMemorialComValores() {
    // Obter valores atuais
    const valorEmprestimo = parseFloat(sliderValor.value) || 0;
    const taxaJuros = parseFloat(sliderTaxa.value) || 0;
    const prazoAnos = parseInt(sliderPrazo.value) || 0;
    const periodoJuros = document.querySelector('input[name="periodoRapido"]:checked')?.value || 'ano';
    const sistemaSelecionado = document.querySelector('input[name="sistemaRapido"]:checked')?.value || 'sac';
    
    // Validar valores
    if (!valorEmprestimo || valorEmprestimo <= 0 || !taxaJuros || taxaJuros < 0 || !prazoAnos || prazoAnos <= 0) {
        return;
    }
    
    // Converter taxa para mensal
    const taxaMensal = converterTaxaParaMensal(taxaJuros, periodoJuros);
    const numeroParcelas = prazoAnos * 12;
    
    // Calcular tabela de acordo com o sistema selecionado
    let tabela = [];
    if (sistemaSelecionado === 'sac') {
        tabela = calcularSAC(valorEmprestimo, taxaMensal, numeroParcelas);
    } else if (sistemaSelecionado === 'price') {
        tabela = calcularPrice(valorEmprestimo, taxaMensal, numeroParcelas);
    } else if (sistemaSelecionado === 'alemao') {
        tabela = calcularAlemao(valorEmprestimo, taxaMensal, numeroParcelas);
    }
    
    // Calcular totais
    const totalJuros = tabela.reduce((sum, item) => sum + item.juros, 0);
    const totalPago = valorEmprestimo + totalJuros;
    const primeiraParcela = tabela[0]?.valorParcela || 0;
    const ultimaParcela = tabela[tabela.length - 1]?.valorParcela || 0;
    
    // Obter textos de tradução
    const textos = traducoes[idiomaAtual] || traducoes['pt-BR'];
    const simboloMoeda = moedaAtual === 'BRL' ? 'R$' : '€';
    
    // Formatar valores
    const formatarValor = (valor) => {
        return simboloMoeda + ' ' + valor.toLocaleString(idiomaAtual, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };
    
    const formatarPercentual = (valor) => {
        return valor.toLocaleString(idiomaAtual, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + '%';
    };
    
    // Atualizar resumo
    document.getElementById('resumo-valor').textContent = formatarValor(valorEmprestimo);
    document.getElementById('resumo-taxa').textContent = formatarPercentual(taxaJuros) + ' ' + (periodoJuros === 'ano' ? (idiomaAtual === 'it-IT' ? 'all\'anno' : 'ao ano') : periodoJuros === 'mes' ? (idiomaAtual === 'it-IT' ? 'al mese' : 'ao mês') : (idiomaAtual === 'it-IT' ? 'al giorno' : 'ao dia'));
    document.getElementById('resumo-prazo').textContent = prazoAnos + ' ' + (idiomaAtual === 'it-IT' ? 'anni' : 'anos') + ' (' + numeroParcelas + ' ' + (idiomaAtual === 'it-IT' ? 'mesi' : 'meses') + ')';
    
    const nomeSistema = sistemaSelecionado === 'sac' ? textos['system-sac-short'] : 
                        sistemaSelecionado === 'price' ? textos['system-price-short'] : 
                        textos['system-german-short'];
    document.getElementById('resumo-sistema').textContent = nomeSistema;
    
    // Parcela pode variar (SAC) ou ser fixa (Price/Americano)
    if (sistemaSelecionado === 'sac') {
        document.getElementById('resumo-parcela').textContent = formatarValor(primeiraParcela) + ' → ' + formatarValor(ultimaParcela);
    } else {
        document.getElementById('resumo-parcela').textContent = formatarValor(primeiraParcela);
    }
    
    document.getElementById('resumo-total-juros').textContent = formatarValor(totalJuros);
    document.getElementById('resumo-total-pago').textContent = formatarValor(totalPago);
    
    // Gerar conteúdo dinâmico do memorial baseado no sistema
    const conteudoDinamico = document.getElementById('memorial-conteudo-dinamico');
    if (!conteudoDinamico) return;
    
    let htmlConteudo = '';
    
    // Adicionar indicação do sistema selecionado
    const textoSistemaSelecionado = idiomaAtual === 'it-IT' 
        ? 'Sistema selezionato:'
        : 'Sistema selecionado:';
    
    // Explicação do significado da sigla/nome do sistema
    let explicacaoSistema = '';
    if (sistemaSelecionado === 'sac') {
        explicacaoSistema = idiomaAtual === 'it-IT'
            ? ' (Sistema di Ammortamento Costante)'
            : ' (Sistema de Amortização Constante)';
    } else if (sistemaSelecionado === 'price') {
        explicacaoSistema = idiomaAtual === 'it-IT'
            ? ' (Sistema Francese)'
            : ' (Sistema Francês)';
    } else if (sistemaSelecionado === 'alemao') {
        explicacaoSistema = idiomaAtual === 'it-IT'
            ? ' (Sistema Tedesco)'
            : ' (Sistema Americano)';
    }
    
    htmlConteudo += `
        <div class="memorial-item" style="background: rgba(45, 159, 163, 0.1); padding: 15px; border-left: 4px solid #2d9fa3ff; border-radius: 4px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 1.1em;"><strong>${textoSistemaSelecionado}</strong> <span style="color: #2d9fa3ff; font-weight: bold;">${nomeSistema}${explicacaoSistema}</span></p>
        </div>
    `;
    
    // Passo 1: Converter Taxa
    const textoPeriodo = periodoJuros === 'ano' 
        ? (idiomaAtual === 'it-IT' ? 'Annuale' : 'Anual')
        : periodoJuros === 'mes'
        ? (idiomaAtual === 'it-IT' ? 'Mensile' : 'Mensal')
        : (idiomaAtual === 'it-IT' ? 'Giornaliera' : 'Diária');
    const textoPeriodoExemplo = periodoJuros === 'ano'
        ? (idiomaAtual === 'it-IT' ? 'all\'anno' : 'ao ano')
        : periodoJuros === 'mes'
        ? (idiomaAtual === 'it-IT' ? 'al mese' : 'ao mês')
        : (idiomaAtual === 'it-IT' ? 'al giorno' : 'ao dia');
    const textoMensal = idiomaAtual === 'it-IT' ? 'al mese' : 'ao mês';
    const textoAnos = idiomaAtual === 'it-IT' ? 'anni' : 'anos';
    const textoParcelas = idiomaAtual === 'it-IT' ? 'rate' : 'parcelas';
    
    htmlConteudo += `
        <div class="memorial-item">
            <h3 data-i18n="memorial-passo1-title">1️⃣ Passo 1: Converter Taxa para Mensal</h3>
            <p><strong data-i18n="memorial-formula">Fórmula:</strong></p>
            <div class="formula-box">
                <p><strong>${idiomaAtual === 'it-IT' ? 'Tasso Mensile' : 'Taxa Mensal'} = f(${idiomaAtual === 'it-IT' ? 'Tasso' : 'Taxa'} ${textoPeriodo}, ${idiomaAtual === 'it-IT' ? 'Periodo' : 'Período'})</strong></p>
            </div>
            <p data-i18n="memorial-passo1-explicacao">Todos os cálculos são feitos com taxa mensal. Se a taxa for anual ou diária, ela precisa ser convertida para mensal.</p>
            <p><strong data-i18n="memorial-example">Exemplo:</strong> <span id="memorial-exemplo-taxa">${idiomaAtual === 'it-IT' ? 'Tasso' : 'Taxa'} ${formatarPercentual(taxaJuros)} ${textoPeriodoExemplo} → ${idiomaAtual === 'it-IT' ? 'Tasso Mensile' : 'Taxa Mensal'} = ${formatarPercentual(taxaMensal * 100)} ${textoMensal}</span></p>
        </div>
    `;
    
    // Passo 2: Calcular Número de Parcelas
    htmlConteudo += `
        <div class="memorial-item">
            <h3 data-i18n="memorial-passo2-title">2️⃣ Passo 2: Calcular Número de Parcelas</h3>
            <p><strong data-i18n="memorial-formula">Fórmula:</strong></p>
            <div class="formula-box">
                <p><strong>${idiomaAtual === 'it-IT' ? 'Numero di Rate' : 'Número de Parcelas'} = ${idiomaAtual === 'it-IT' ? 'Durata' : 'Prazo'} (${textoAnos}) × 12 ${idiomaAtual === 'it-IT' ? 'mesi/anno' : 'meses/ano'}</strong></p>
            </div>
            <p data-i18n="memorial-passo2-explicacao">O número de parcelas é calculado multiplicando o prazo em anos por 12 (meses por ano).</p>
            <p><strong data-i18n="memorial-example">Exemplo:</strong> <span id="memorial-exemplo-parcelas">${prazoAnos} ${textoAnos} × 12 = ${numeroParcelas} ${textoParcelas}</span></p>
        </div>
    `;
    
    // Passo 3: Calcular Tabela (específico por sistema)
    if (sistemaSelecionado === 'sac') {
        const amortizacao = valorEmprestimo / numeroParcelas;
        const jurosPrimeira = valorEmprestimo * taxaMensal;
        const parcelaPrimeira = amortizacao + jurosPrimeira;
        const saldoMeio = valorEmprestimo - (amortizacao * 60);
        const jurosMeio = saldoMeio * taxaMensal;
        const parcelaMeio = amortizacao + jurosMeio;
        const jurosUltima = amortizacao * taxaMensal;
        const parcelaUltima = amortizacao + jurosUltima;
        
        const nomeSistemaSAC = idiomaAtual === 'it-IT' ? 'Ammortamento all\'Italiana' : 'SAC';
        htmlConteudo += `
            <div class="memorial-item">
                <h3 data-i18n="memorial-passo3-title">3️⃣ Passo 3: Calcular Tabela de Amortização (${nomeSistemaSAC})</h3>
                <div class="memorial-item">
                    <h4 data-i18n="memorial-sac-passo1-title">${nomeSistemaSAC} - Passo 1: Calcular Amortização Constante</h4>
                    <p><strong data-i18n="memorial-formula">Fórmula:</strong></p>
                    <div class="formula-box">
                        <p><strong data-i18n="memorial-sac-passo1-formula">Amortização = Valor Emprestado ÷ Número de Parcelas</strong></p>
                    </div>
                    <p data-i18n="memorial-sac-passo1-explicacao">A amortização é sempre a mesma em todas as parcelas.</p>
                    <p><strong data-i18n="memorial-example">Exemplo:</strong> <span id="memorial-exemplo-sac-amortizacao">${formatarValor(valorEmprestimo)} ÷ ${numeroParcelas} = ${formatarValor(amortizacao)}</span></p>
                </div>
                <div class="memorial-item">
                    <h4 data-i18n="memorial-sac-passo2-title">${nomeSistemaSAC} - Passo 2: Calcular Juros e Parcela</h4>
                    <p><strong data-i18n="memorial-formula">Fórmula:</strong></p>
                    <div class="formula-box">
                        <p><strong data-i18n="memorial-sac-passo2-formula">Juros = Saldo Devedor × Taxa Mensal<br>Parcela = Amortização + Juros</strong></p>
                    </div>
                    <p data-i18n="memorial-sac-passo2-explicacao">Os juros são calculados sobre o saldo devedor, que diminui a cada parcela. Por isso, os juros e as parcelas diminuem com o tempo.</p>
                    <p><strong data-i18n="memorial-example">Exemplo:</strong></p>
                    <ul>
                        <li id="memorial-exemplo-sac-primeira">${idiomaAtual === 'it-IT' ? 'Mese' : 'Mês'} 1: ${idiomaAtual === 'it-IT' ? 'Interessi' : 'Juros'} = ${formatarValor(valorEmprestimo)} × ${formatarPercentual(taxaMensal * 100)} = ${formatarValor(jurosPrimeira)} → ${idiomaAtual === 'it-IT' ? 'Rata' : 'Parcela'} = ${formatarValor(amortizacao)} + ${formatarValor(jurosPrimeira)} = ${formatarValor(parcelaPrimeira)}</li>
                        <li id="memorial-exemplo-sac-meio">${idiomaAtual === 'it-IT' ? 'Mese' : 'Mês'} ${Math.floor(numeroParcelas / 2)}: ${idiomaAtual === 'it-IT' ? 'Interessi' : 'Juros'} = ${formatarValor(saldoMeio)} × ${formatarPercentual(taxaMensal * 100)} = ${formatarValor(jurosMeio)} → ${idiomaAtual === 'it-IT' ? 'Rata' : 'Parcela'} = ${formatarValor(amortizacao)} + ${formatarValor(jurosMeio)} = ${formatarValor(parcelaMeio)}</li>
                        <li id="memorial-exemplo-sac-ultima">${idiomaAtual === 'it-IT' ? 'Mese' : 'Mês'} ${numeroParcelas}: ${idiomaAtual === 'it-IT' ? 'Interessi' : 'Juros'} = ${formatarValor(amortizacao)} × ${formatarPercentual(taxaMensal * 100)} = ${formatarValor(jurosUltima)} → ${idiomaAtual === 'it-IT' ? 'Rata' : 'Parcela'} = ${formatarValor(amortizacao)} + ${formatarValor(jurosUltima)} = ${formatarValor(parcelaUltima)}</li>
                    </ul>
                </div>
            </div>
        `;
    } else if (sistemaSelecionado === 'price') {
        const parcelaFixa = tabela[0]?.valorParcela || 0;
        const primeiraParcela = tabela[0];
        const jurosPrimeira = primeiraParcela.juros;
        const amortizacaoPrimeira = primeiraParcela.amortizacao;
        
        // Calcular valores no meio do período
        const parcelaMeio = Math.floor(numeroParcelas / 2);
        const parcelaMeioObj = tabela[parcelaMeio - 1] || tabela[0];
        const jurosMeio = parcelaMeioObj.juros;
        const amortizacaoMeio = parcelaMeioObj.amortizacao;
        const saldoMeio = parcelaMeioObj.saldoDevedor + parcelaMeioObj.amortizacao; // Saldo antes do pagamento
        
        // Calcular valores da última parcela
        const ultimaParcela = tabela[tabela.length - 1];
        const jurosUltima = ultimaParcela.juros;
        const amortizacaoUltima = ultimaParcela.amortizacao;
        const saldoUltima = ultimaParcela.saldoDevedor + ultimaParcela.amortizacao; // Saldo antes do pagamento
        
        const nomeSistemaPrice = idiomaAtual === 'it-IT' ? 'Ammortamento alla Francese' : 'Tabela Price';
        htmlConteudo += `
            <div class="memorial-item">
                <h3 data-i18n="memorial-passo3-title">3️⃣ Passo 3: Calcular Tabela de Amortização (${nomeSistemaPrice})</h3>
                <div class="memorial-item">
                    <h4 data-i18n="memorial-price-passo1-title">${nomeSistemaPrice} - Passo 1: Calcular Parcela Fixa (PMT)</h4>
                    <p><strong data-i18n="memorial-formula">Fórmula:</strong></p>
                    <div class="formula-box">
                        <p><strong data-i18n="memorial-price-passo1-formula">PMT = PV × [i × (1+i)^n] ÷ [(1+i)^n - 1]</strong></p>
                    </div>
                    <p data-i18n="memorial-price-passo1-explicacao">Esta fórmula calcula o valor da parcela fixa que será paga em todas as parcelas. Onde: PV = valor presente (emprestado), i = taxa mensal, n = número de parcelas.</p>
                    <p><strong data-i18n="memorial-example">Exemplo:</strong> <span id="memorial-exemplo-price-pmt">PMT = ${formatarValor(valorEmprestimo)} × [${formatarPercentual(taxaMensal * 100)} × (1+${formatarPercentual(taxaMensal * 100)})^${numeroParcelas}] ÷ [(1+${formatarPercentual(taxaMensal * 100)})^${numeroParcelas} - 1] = ${formatarValor(parcelaFixa)}</span></p>
                </div>
                <div class="memorial-item">
                    <h4 data-i18n="memorial-price-passo2-title">${nomeSistemaPrice} - Passo 2: Calcular Juros e Amortização</h4>
                    <p><strong data-i18n="memorial-formula">Fórmula:</strong></p>
                    <div class="formula-box">
                        <p><strong data-i18n="memorial-price-passo2-formula">Juros = Saldo Devedor × Taxa Mensal<br>Amortização = PMT - Juros</strong></p>
                    </div>
                    <p data-i18n="memorial-price-passo2-explicacao">A parcela é fixa, mas a composição muda: no início, mais juros e menos amortização; no final, menos juros e mais amortização.</p>
                    <p><strong data-i18n="memorial-example">Exemplo:</strong></p>
                    <ul>
                        <li id="memorial-exemplo-price-primeira">${idiomaAtual === 'it-IT' ? 'Mese' : 'Mês'} 1: ${idiomaAtual === 'it-IT' ? 'Interessi' : 'Juros'} = ${formatarValor(valorEmprestimo)} × ${formatarPercentual(taxaMensal * 100)} = ${formatarValor(jurosPrimeira)} → ${idiomaAtual === 'it-IT' ? 'Ammortamento' : 'Amortização'} = ${formatarValor(parcelaFixa)} - ${formatarValor(jurosPrimeira)} = ${formatarValor(amortizacaoPrimeira)}</li>
                        <li id="memorial-exemplo-price-meio">${idiomaAtual === 'it-IT' ? 'Mese' : 'Mês'} ${Math.floor(numeroParcelas / 2)}: ${idiomaAtual === 'it-IT' ? 'Interessi' : 'Juros'} = ${formatarValor(saldoMeio)} × ${formatarPercentual(taxaMensal * 100)} = ${formatarValor(jurosMeio)} → ${idiomaAtual === 'it-IT' ? 'Ammortamento' : 'Amortização'} = ${formatarValor(parcelaFixa)} - ${formatarValor(jurosMeio)} = ${formatarValor(amortizacaoMeio)}</li>
                        <li id="memorial-exemplo-price-ultima">${idiomaAtual === 'it-IT' ? 'Mese' : 'Mês'} ${numeroParcelas}: ${idiomaAtual === 'it-IT' ? 'Interessi' : 'Juros'} = ${formatarValor(saldoUltima + amortizacaoUltima)} × ${formatarPercentual(taxaMensal * 100)} = ${formatarValor(jurosUltima)} → ${idiomaAtual === 'it-IT' ? 'Ammortamento' : 'Amortização'} = ${formatarValor(parcelaFixa)} - ${formatarValor(jurosUltima)} = ${formatarValor(amortizacaoUltima)}</li>
                    </ul>
                </div>
            </div>
        `;
    } else if (sistemaSelecionado === 'alemao') {
        const jurosMensal = valorEmprestimo * taxaMensal;
        const ultimaParcela = valorEmprestimo + jurosMensal;
        const nomeSistemaAmericano = idiomaAtual === 'it-IT' ? 'Tedesco' : 'Sistema Americano';
        
        htmlConteudo += `
            <div class="memorial-item">
                <h3 data-i18n="memorial-passo3-title">3️⃣ Passo 3: Calcular Tabela de Amortização (${nomeSistemaAmericano})</h3>
                <div class="memorial-item">
                    <h4 data-i18n="memorial-americano-passo1-title">${nomeSistemaAmericano} - Passo 1: Calcular Juros Mensais</h4>
                    <p><strong data-i18n="memorial-formula">Fórmula:</strong></p>
                    <div class="formula-box">
                        <p><strong data-i18n="memorial-americano-passo1-formula">Juros = Valor Emprestado × Taxa Mensal</strong></p>
                    </div>
                    <p data-i18n="memorial-americano-passo1-explicacao">Os juros são sempre calculados sobre o valor total emprestado, pois não há amortização intermediária.</p>
                    <p><strong data-i18n="memorial-example">Exemplo:</strong> <span id="memorial-exemplo-americano-juros">${idiomaAtual === 'it-IT' ? 'Interessi' : 'Juros'} = ${formatarValor(valorEmprestimo)} × ${formatarPercentual(taxaMensal * 100)} = ${formatarValor(jurosMensal)} ${idiomaAtual === 'it-IT' ? 'al mese' : 'por mês'}</span></p>
                </div>
                <div class="memorial-item">
                    <h4 data-i18n="memorial-americano-passo2-title">${nomeSistemaAmericano} - Passo 2: Calcular Parcelas</h4>
                    <p><strong data-i18n="memorial-formula">Fórmula:</strong></p>
                    <div class="formula-box">
                        <p><strong data-i18n="memorial-americano-passo2-formula">Parcelas 1 a n-1: Apenas Juros<br>Última Parcela: Juros + Valor Emprestado</strong></p>
                    </div>
                    <p data-i18n="memorial-americano-passo2-explicacao">Durante todo o período, paga-se apenas os juros. O valor principal é pago integralmente na última parcela.</p>
                    <p><strong data-i18n="memorial-example">Exemplo:</strong></p>
                    <ul>
                        <li id="memorial-exemplo-americano-intermediarias">${idiomaAtual === 'it-IT' ? 'Rate' : 'Parcelas'} 1 a ${numeroParcelas - 1}: ${formatarValor(jurosMensal)} (${idiomaAtual === 'it-IT' ? 'solo interessi, senza ammortamento' : 'apenas juros, sem amortização'})</li>
                        <li id="memorial-exemplo-americano-ultima">${idiomaAtual === 'it-IT' ? 'Rata' : 'Parcela'} ${numeroParcelas}: ${formatarValor(jurosMensal)} + ${formatarValor(valorEmprestimo)} = ${formatarValor(ultimaParcela)} (${idiomaAtual === 'it-IT' ? 'interessi + capitale' : 'juros + principal'})</li>
                    </ul>
                </div>
            </div>
        `;
    }
    
    conteudoDinamico.innerHTML = htmlConteudo;
    
    // Aplicar traduções ao conteúdo dinâmico
    // A função trocarIdioma já aplica as traduções automaticamente
    // Mas precisamos aplicar manualmente aqui porque o conteúdo foi gerado dinamicamente
    const elementos = conteudoDinamico.querySelectorAll('[data-i18n]');
    elementos.forEach(element => {
        const chave = element.getAttribute('data-i18n');
        const texto = traducoes[idiomaAtual]?.[chave] || traducoes['pt-BR']?.[chave] || chave;
        if (element.tagName === 'STRONG') {
            element.textContent = texto;
        } else {
            element.textContent = texto;
        }
    });
}

// Atualizar exemplos com valores dos sliders
function atualizarExemplosComValores() {
    // Usar valores dos sliders
    const valorEmprestimo = parseFloat(sliderValor.value) || 0;
    const taxaJuros = parseFloat(sliderTaxa.value) || 0;
    const prazoAnos = parseInt(sliderPrazo.value) || 0;
    const periodoJuros = document.querySelector('input[name="periodoRapido"]:checked').value;
    
    // Validar valores
    if (!valorEmprestimo || valorEmprestimo <= 0 || !taxaJuros || taxaJuros < 0 || !prazoAnos || prazoAnos <= 0) {
        return;
    }
    
    // Converter taxa para mensal
    const taxaMensal = converterTaxaParaMensal(taxaJuros, periodoJuros);
    const numeroParcelas = prazoAnos * 12;
    
    // Calcular valores para cada sistema
    const tabelaSAC = calcularSAC(valorEmprestimo, taxaMensal, numeroParcelas);
    const tabelaPrice = calcularPrice(valorEmprestimo, taxaMensal, numeroParcelas);
    const tabelaAlemao = calcularAlemao(valorEmprestimo, taxaMensal, numeroParcelas);
    
    // Totais
    const totalJurosSAC = tabelaSAC.reduce((sum, item) => sum + item.juros, 0);
    const totalJurosPrice = tabelaPrice.reduce((sum, item) => sum + item.juros, 0);
    const totalJurosAlemao = tabelaAlemao.reduce((sum, item) => sum + item.juros, 0);
    
    // Atualizar textos dos exemplos
    const simboloMoeda = moedaAtual === 'BRL' ? 'R$' : '€';
    const taxaTexto = `${formatarNumeroDecimal(taxaJuros, 2)}% ${obterTextoPeriodicidade(periodoJuros)}`;
    const amortizacaoFixa = valorEmprestimo / numeroParcelas;
    
    // SAC
    document.getElementById('example-sac-calc').textContent = 
        `${simboloMoeda} ${formatarNumero(valorEmprestimo)} a ${taxaTexto} por ${numeroParcelas} meses`;
    document.getElementById('example-sac-result-1').textContent = 
        `Amortização fixa: ${formatarMoeda(amortizacaoFixa)}`;
    document.getElementById('example-sac-result-2').textContent = 
        `Mês 1: ${formatarMoeda(tabelaSAC[0].valorParcela)} (${formatarMoeda(tabelaSAC[0].amortizacao)} amort. + ${formatarMoeda(tabelaSAC[0].juros)} juros)`;
    const meioSAC = Math.floor(numeroParcelas / 2);
    document.getElementById('example-sac-result-3').textContent = 
        `Mês ${meioSAC}: ${formatarMoeda(tabelaSAC[meioSAC-1].valorParcela)} (${formatarMoeda(tabelaSAC[meioSAC-1].amortizacao)} amort. + ${formatarMoeda(tabelaSAC[meioSAC-1].juros)} juros)`;
    document.getElementById('example-sac-result-4').textContent = 
        `Mês ${numeroParcelas}: ${formatarMoeda(tabelaSAC[numeroParcelas-1].valorParcela)} (${formatarMoeda(tabelaSAC[numeroParcelas-1].amortizacao)} amort. + ${formatarMoeda(tabelaSAC[numeroParcelas-1].juros)} juros)`;
    document.getElementById('example-sac-result-5').textContent = 
        `Total de juros: ${formatarMoeda(totalJurosSAC)}`;
    
    // Price
    document.getElementById('example-price-calc').textContent = 
        `${simboloMoeda} ${formatarNumero(valorEmprestimo)} a ${taxaTexto} por ${numeroParcelas} meses`;
    document.getElementById('example-price-result-1').textContent = 
        `Parcela fixa: ${formatarMoeda(tabelaPrice[0].valorParcela)}`;
    document.getElementById('example-price-result-2').textContent = 
        `Mês 1: ${formatarMoeda(tabelaPrice[0].valorParcela)} (${formatarMoeda(tabelaPrice[0].juros)} juros + ${formatarMoeda(tabelaPrice[0].amortizacao)} amort.)`;
    const meioPrice = Math.floor(numeroParcelas / 2);
    document.getElementById('example-price-result-3').textContent = 
        `Mês ${meioPrice}: ${formatarMoeda(tabelaPrice[meioPrice-1].valorParcela)} (${formatarMoeda(tabelaPrice[meioPrice-1].juros)} juros + ${formatarMoeda(tabelaPrice[meioPrice-1].amortizacao)} amort.)`;
    document.getElementById('example-price-result-4').textContent = 
        `Mês ${numeroParcelas}: ${formatarMoeda(tabelaPrice[numeroParcelas-1].valorParcela)} (${formatarMoeda(tabelaPrice[numeroParcelas-1].juros)} juros + ${formatarMoeda(tabelaPrice[numeroParcelas-1].amortizacao)} amort.)`;
    document.getElementById('example-price-result-5').textContent = 
        `Total de juros: ${formatarMoeda(totalJurosPrice)}`;
    
    // Americano/Tedesco
    document.getElementById('example-american-calc').textContent = 
        `${simboloMoeda} ${formatarNumero(valorEmprestimo)} a ${taxaTexto} por ${numeroParcelas} meses`;
    document.getElementById('example-american-result-1').textContent = 
        `Parcelas 1 a ${numeroParcelas-1}: ${formatarMoeda(tabelaAlemao[0].valorParcela)} (só juros)`;
    document.getElementById('example-american-result-2').textContent = 
        `Parcela ${numeroParcelas}: ${formatarMoeda(tabelaAlemao[numeroParcelas-1].valorParcela)} (principal + juros)`;
    document.getElementById('example-american-result-3').textContent = 
        `Total de juros: ${formatarMoeda(totalJurosAlemao)}`;
    
    // Tabela comparativa com valores calculados
    document.getElementById('comparison-subtitle').textContent = 
        `Para ${simboloMoeda} ${formatarNumero(valorEmprestimo)} a ${taxaTexto} por ${numeroParcelas} meses:`;
    
    // Atualizar valores da tabela (apenas a tabela de comparação com valores)
    const tabelaComparacao = document.getElementById('tabelaComparacaoValores');
    if (tabelaComparacao) {
        const tabelaLinhas = tabelaComparacao.querySelectorAll('tbody tr');
        if (tabelaLinhas.length >= 3) {
            tabelaLinhas[0].children[1].textContent = formatarMoeda(totalJurosSAC);
            tabelaLinhas[0].children[2].textContent = formatarMoeda(tabelaSAC[0].valorParcela);
            tabelaLinhas[0].children[3].textContent = formatarMoeda(tabelaSAC[numeroParcelas-1].valorParcela);
            
            tabelaLinhas[1].children[1].textContent = formatarMoeda(totalJurosPrice);
            tabelaLinhas[1].children[2].textContent = formatarMoeda(tabelaPrice[0].valorParcela);
            tabelaLinhas[1].children[3].textContent = formatarMoeda(tabelaPrice[numeroParcelas-1].valorParcela);
            
            tabelaLinhas[2].children[1].textContent = formatarMoeda(totalJurosAlemao);
            tabelaLinhas[2].children[2].textContent = formatarMoeda(tabelaAlemao[0].valorParcela);
            tabelaLinhas[2].children[3].textContent = formatarMoeda(tabelaAlemao[numeroParcelas-1].valorParcela);
        }
    }
}

// Obter texto da periodicidade
function obterTextoPeriodicidade(periodo) {
    const textos = {
        'pt-BR': { ano: 'ao ano', mes: 'ao mês', dia: 'ao dia' },
        'it-IT': { ano: 'all\'anno', mes: 'al mese', dia: 'al giorno' }
    };
    return textos[idiomaAtual][periodo] || textos[idiomaAtual]['ano'];
}

/**
 * Formata um número sem símbolo de moeda
 * 
 * Adiciona separadores de milhares conforme o idioma.
 * Exemplo: 100000 → "100.000" (pt-BR) ou "100.000" (it-IT)
 * 
 * @param {number} valor - Número a ser formatado
 * @returns {string} Número formatado como texto
 */
// Funções de formatação agora estão em assets/js/site-config.js
// formatarNumero -> formatarNumero (global, usa 0 decimais por padrão)
// formatarNumeroDecimal -> formatarNumeroDecimal (global)
// formatarNumeroCompacto -> formatarNumeroCompacto (global)
// formatarMoeda -> formatarMoeda (global, recebe idioma como parâmetro)
// formatarMoedaSemDecimal -> formatarMoedaSemDecimal (global, recebe idioma como parâmetro)

// Inicialização
// Variáveis globais para os gráficos
let graficoEvolutivo = null;

// Criar ou atualizar gráficos
function atualizarGraficos() {
    if (tabelaAmortizacaoAtual.length === 0) return;
    
    // Carrega Chart.js dinamicamente se ainda não estiver carregado
    if (typeof Chart === 'undefined') {
        carregarChartJS(() => {
            atualizarGraficos();
        }, ['https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation']);
        return;
    }
    
    // Preparar dados acumulados
    let amortizacaoAcumulada = 0;
    let jurosAcumulados = 0;
    
    const labels = [];
    const dadosAmortizacao = [];
    const dadosJuros = [];
    
    tabelaAmortizacaoAtual.forEach((parcela, index) => {
        amortizacaoAcumulada += parcela.amortizacao;
        jurosAcumulados += parcela.juros;
        
        // Adicionar ponto a cada mês para menor quantidade de pontos, ou a cada parcela se forem poucas
        const intervalo = tabelaAmortizacaoAtual.length > 120 ? 12 : 1;
        
        if (index % intervalo === 0 || index === tabelaAmortizacaoAtual.length - 1) {
            labels.push((index + 1).toString());
            dadosAmortizacao.push(amortizacaoAcumulada);
            dadosJuros.push(jurosAcumulados);
        }
    });
    
    // Destruir gráfico anterior se existir
    if (graficoEvolutivo) {
        graficoEvolutivo.destroy();
    }
    
    // Criar gráfico unificado (atualização instantânea)
    const ctx = document.getElementById('graficoEvolutivo').getContext('2d');
    
    graficoEvolutivo = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: idiomaAtual === 'pt-BR' ? 'Amortização' : 'Ammortamento',
                    data: dadosAmortizacao,
                    borderColor: '#66bb6a',
                    backgroundColor: 'rgba(102, 187, 106, 0.1)',
                    fill: false,
                    tension: 0.4,
                    borderWidth: 2
                },
                {
                    label: idiomaAtual === 'pt-BR' ? 'Juros' : 'Interessi',
                    data: dadosJuros,
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    fill: false,
                    tension: 0.4,
                    borderWidth: 2
                }
            ]
        },
        options: {
            // Desabilitar animações padrão do Chart.js
            animation: false,
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.2,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 13
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += formatarMoedaSemDecimal(context.parsed.y);
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: idiomaAtual === 'pt-BR' ? 'Parcela' : 'Rata',
                        font: {
                            size: 13
                        }
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: false
                    },
                    ticks: {
                        callback: function(value) {
                            return formatarNumeroCompacto(value);
                        }
                    }
                }
            }
        }
    });
}

// Inicialização após carregamento do DOM
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar referências aos elementos do DOM
    btnExemplos = document.getElementById('btnExemplos');
    exemplosSection = document.getElementById('exemplosSection');
    resultados = document.getElementById('resultados');
    sliderParcelas = document.getElementById('sliderParcelas');
    btnPortugues = document.getElementById('btnPortugues');
    btnItaliano = document.getElementById('btnItaliano');
    
    // Garantir que o memorial está escondido inicialmente
    const memorialSection = document.getElementById('memorialSection');
    if (memorialSection) {
        memorialSection.style.display = 'none';
    }
    sliderValor = document.getElementById('sliderValor');
    sliderTaxa = document.getElementById('sliderTaxa');
    sliderPrazo = document.getElementById('sliderPrazo');
    
    // Inicializar máximo do slider de valor baseado no idioma
    if (sliderValor) {
        sliderValor.max = obterMaxValorSlider();
    }
    
    // Inicializar limites e step do slider de taxa baseado no período inicial
    if (sliderTaxa) {
        const periodoInicial = (document.querySelector('input[name="periodoRapido"]:checked') || {}).value || 'ano';
        const maxTaxa = obterLimiteMaximoTaxa(periodoInicial);
        sliderTaxa.max = maxTaxa;
        
        // Definir step inicial baseado no período
        if (periodoInicial === 'dia') {
            sliderTaxa.step = '0.001';
        } else if (periodoInicial === 'mes') {
            sliderTaxa.step = '0.01';
        } else {
            sliderTaxa.step = '0.1';
        }
    }
    
    // Referências aos inputs de texto editáveis
    const inputValor = document.getElementById('inputValor');
    const inputPrazo = document.getElementById('inputPrazo');
    const inputTaxa = document.getElementById('inputTaxa');
    
    // Funções para atualizar inputs de texto quando sliders mudam
    window.atualizarDisplayValor = function() {
        if (inputValor && sliderValor && document.activeElement !== inputValor) {
            // Se o input tem um valor acima do máximo do slider, usa o input
            // Caso contrário, usa o slider
            const valorInput = obterValorNumericoComSufixo(inputValor.value);
            const valorSlider = parseFloat(sliderValor.value) || 0;
            
            // Se o input tem valor válido e está acima do limite do slider, usa o input
            // Caso contrário, sincroniza com o slider
            const maxSlider = obterMaxValorSlider();
        if (valorInput > maxSlider && valorInput <= 10000000) {
                // Mantém o valor do input (já está formatado)
                return;
            } else {
                // Sincroniza com o slider usando formatação com sufixos
                inputValor.value = formatarNumeroComSufixo(valorSlider, 1);
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputValor);
            }
        }
    };
    
    window.atualizarDisplayTaxa = function() {
        if (inputTaxa && sliderTaxa && document.activeElement !== inputTaxa) {
            const taxa = parseFloat(sliderTaxa.value) || 0;
            const periodoAtual = (document.querySelector('input[name="periodoRapido"]:checked') || {}).value || 'ano';
            const decimalsToShow = periodoAtual === 'dia' ? 3 : periodoAtual === 'mes' ? 2 : 1;
            inputTaxa.value = formatarNumeroDecimal(taxa, decimalsToShow);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputTaxa);
        }
    };
    
    window.atualizarDisplayPrazo = function() {
        if (inputPrazo && sliderPrazo && document.activeElement !== inputPrazo) {
            inputPrazo.value = sliderPrazo.value;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPrazo);
        }
    };
    
    // Função para selecionar todo o texto quando o input recebe foco
    function selecionarTextoAoFocar(e) {
        e.target.select();
    }
    
    // Função para sincronizar input de texto com slider
    function sincronizarInputParaSlider(inputId, sliderId, formatarFuncao) {
        const input = document.getElementById(inputId);
        const slider = document.getElementById(sliderId);
        if (!input || !slider) return;
        
        input.addEventListener('focus', selecionarTextoAoFocar);
        input.addEventListener('blur', function(e) {
            formatarFuncao(e);
            // Sincronizar slider com o valor formatado
            if (inputId === 'inputValor') {
                const valor = obterValorNumericoFormatado(e.target.value);
                // Limitar slider ao máximo baseado no idioma, mas permitir input manual até 10 milhões
                const maxSlider = obterMaxValorSlider();
                slider.value = Math.max(1000, Math.min(maxSlider, valor)); // Slider limitado ao máximo do idioma
                calcularEmprestimo();
            } else if (inputId === 'inputPrazo') {
                const prazo = parseInt(e.target.value) || 1;
                slider.value = Math.max(1, Math.min(50, prazo));
                calcularEmprestimo();
            } else if (inputId === 'inputTaxa') {
                const taxa = parseFloat(e.target.value.replace(',', '.')) || 0;
                const periodoAtual = (document.querySelector('input[name="periodoRapido"]:checked') || {}).value || 'ano';
                const maxTaxa = obterLimiteMaximoTaxa(periodoAtual);
                slider.value = Math.max(0, Math.min(maxTaxa, taxa));
                calcularEmprestimo();
            }
        });
        // Para inputValor, adiciona suporte para Enter e Tab para formatar
        if (inputId === 'inputValor') {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === 'Tab') {
                    formatarFuncao(e);
                    // Sincronizar slider
                    const valor = obterValorNumericoFormatado(e.target.value);
                    const maxSlider = obterMaxValorSlider();
                    slider.value = Math.max(1000, Math.min(maxSlider, valor));
                    calcularEmprestimo();
                }
            });
        }
        input.addEventListener('input', formatarFuncao);
    }
    
    // Inicializar displays
    atualizarDisplayValor();
    atualizarDisplayTaxa();
    atualizarDisplayPrazo();
    
    // Sincronizar inputs de texto com sliders
    if (inputValor && sliderValor) {
        sincronizarInputParaSlider('inputValor', 'sliderValor', formatarValorInput);
    }
    if (inputPrazo && sliderPrazo) {
        sincronizarInputParaSlider('inputPrazo', 'sliderPrazo', formatarPrazoInput);
    }
    if (inputTaxa && sliderTaxa) {
        sincronizarInputParaSlider('inputTaxa', 'sliderTaxa', formatarTaxaInput);
    }
    
    // Event Listeners para botões de seta - usa função global com aceleração exponencial
    if (typeof configurarBotoesSliderComAceleracao === 'function') {
        // Usa função de ajuste local que atualiza inputs correspondentes
        function ajustarValorMutuo(targetId, step) {
            ajustarValor(targetId, step);
        }
        configurarBotoesSliderComAceleracao(SITE_SEL.ARROW_BTN, ajustarValorMutuo);
    } else {
        // Fallback para código antigo se a função global não estiver disponível
        document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
            const targetId = btn.getAttribute('data-target');
            const step = parseFloat(btn.getAttribute('data-step'));
            btn.addEventListener('click', () => ajustarValor(targetId, step));
        });
    }
    
    // Event Listeners para sliders
    sliderParcelas.addEventListener('input', function() {
        // Salva a posição atual do slider sempre que o usuário o move
        ultimaParcelaSelecionada = parseInt(sliderParcelas.value);
        atualizarParcelaExibida();
    });
    
    // Aplica throttle nos sliders para melhorar performance
    // Throttle limita a execução de calcularEmprestimo() durante o arraste do slider
    if (sliderValor) {
        sliderValor.addEventListener('input', throttle(function() {
            atualizarDisplayValor();
            calcularEmprestimo();
        }, 100));
    }
    
    if (sliderTaxa) {
        sliderTaxa.addEventListener('input', throttle(function() {
            atualizarDisplayTaxa();
            calcularEmprestimo();
        }, 100));
    }
    
    if (sliderPrazo) {
        sliderPrazo.addEventListener('input', throttle(function() {
            atualizarDisplayPrazo();
            calcularEmprestimo();
        }, 100));
    }
    
    // Radio buttons dos controles rápidos
    // Mantemos o período atual e quando o usuário mudar o período
    // convertemos a taxa mostrada para o novo período antes de recalcular
    let periodoRapidoAtual = (document.querySelector('input[name="periodoRapido"]:checked') || {}).value || 'ano';
    document.querySelectorAll('input[name="periodoRapido"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const novoPeriodo = e.target.value;
            if (novoPeriodo && novoPeriodo !== periodoRapidoAtual) {
                // Ler taxa atual do slider (já é número)
                const taxaAtual = parseFloat(sliderTaxa.value) || 0;

                // Converter de periodoRapidoAtual -> novoPeriodo
                const taxaConvertida = converterTaxaBetweenPeriods(taxaAtual, periodoRapidoAtual, novoPeriodo);

                // Atualizar limites do slider baseado no novo período
                const maxTaxa = obterLimiteMaximoTaxa(novoPeriodo);
                sliderTaxa.max = maxTaxa;
                
                // Atualizar o step do slider baseado no período
                // Valores diários são muito pequenos, precisam de step menor
                if (novoPeriodo === 'dia') {
                    sliderTaxa.step = '0.001'; // Step de 0.001% para valores diários
                } else if (novoPeriodo === 'mes') {
                    sliderTaxa.step = '0.01'; // Step de 0.01% para valores mensais
                } else {
                    sliderTaxa.step = '0.1'; // Step de 0.1% para valores anuais
                }
                
                // Garantir que o valor convertido não exceda o novo limite
                let taxaLimitada = Math.min(taxaConvertida, maxTaxa);
                
                // Garantir que valores muito pequenos não sejam zerados
                // Se a taxa original não era zero e a convertida é positiva, preservar
                if (taxaAtual > 0 && taxaConvertida > 0) {
                    // Para valores diários, garantir que valores muito pequenos sejam preservados
                    if (novoPeriodo === 'dia' && taxaLimitada < 0.001) {
                        // Se o valor convertido for menor que o step mínimo, usar o valor convertido original
                        // mas garantir que seja pelo menos 0.0001 para não zerar
                        taxaLimitada = Math.max(taxaConvertida, 0.0001);
                    }
                }
                
                // Validar e ajustar valor da taxa para garantir que está dentro dos limites
                const minTaxa = parseFloat(sliderTaxa.min) || 0;
                if (taxaLimitada < minTaxa) {
                    taxaLimitada = minTaxa;
                } else if (taxaLimitada > maxTaxa) {
                    taxaLimitada = maxTaxa;
                }
                
                // Atualiza o slider com o valor limitado
                // Para valores diários, usar mais precisão e garantir que não seja zero
                if (novoPeriodo === 'dia') {
                    // Arredondar para o step mais próximo (0.001), mas preservar valores menores
                    if (taxaLimitada >= 0.001) {
                        taxaLimitada = Math.round(taxaLimitada * 1000) / 1000;
                    } else {
                        // Para valores menores que 0.001, preservar com mais precisão
                        taxaLimitada = Math.round(taxaLimitada * 10000) / 10000;
                    }
                    // Garantir que não seja zero se havia um valor antes
                    if (taxaAtual > 0 && taxaLimitada === 0) {
                        taxaLimitada = taxaConvertida; // Usar o valor convertido original
                    }
                    sliderTaxa.value = taxaLimitada;
                } else {
                    sliderTaxa.value = taxaLimitada;
                }
                
                // Atualiza display
                atualizarDisplayTaxa();

                // Atualiza estado
                periodoRapidoAtual = novoPeriodo;
            }

            // Recalcula com o novo período
            calcularEmprestimo();
        });
    });
    
    document.querySelectorAll('input[name="sistemaRapido"]').forEach(radio => {
        radio.addEventListener('change', calcularEmprestimo);
    });
    
    // Botões de idioma
    btnPortugues.addEventListener('click', () => trocarIdioma('pt-BR'));
    btnItaliano.addEventListener('click', () => trocarIdioma('it-IT'));
    
    // Inicializa com o idioma salvo no localStorage
    trocarIdioma(idiomaAtual);
    
    // Inicializar ícones de informação
    if (typeof inicializarIconeInfo === 'function') {
        inicializarIconeInfo('infoIconValor', 'descricaoValor');
        inicializarIconeInfo('infoIconPrazo', 'descricaoPrazo');
        inicializarIconeInfo('infoIconTaxa', 'descricaoTaxa');
    }
    
    // Event listener para o botão de memorial (SAIBA MAIS)
    if (btnExemplos) {
        btnExemplos.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleMemorial();
        });
        btnExemplos.style.cursor = 'pointer';
    } else {
        console.error('Botão btnExemplos não encontrado no DOM');
    }
    
    // Event listener para o botão de fechar memorial
    const btnFecharMemorial = document.getElementById('btnFecharMemorial');
    if (btnFecharMemorial) {
        btnFecharMemorial.addEventListener('click', function(e) {
            e.preventDefault();
            toggleMemorial();
        });
    }
    
    // Event listener para botões de voltar no memorial
    document.querySelectorAll('.btn-voltar-memorial').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            toggleMemorial();
        });
    });
    
    // Event listener para o botão de ver exemplos (dentro do memorial)
    const btnVerExemplos = document.getElementById('btnVerExemplos');
    if (btnVerExemplos) {
        btnVerExemplos.addEventListener('click', function(e) {
            e.preventDefault();
            toggleExemplos();
        });
    }
    
    // Event listener para fechar exemplos
    const btnFecharExemplos = document.getElementById('btnFecharExemplos');
    if (btnFecharExemplos) {
        btnFecharExemplos.addEventListener('click', function(e) {
            e.preventDefault();
            toggleExemplos();
        });
    }
    
    // Event listeners para botões de voltar nos exemplos
    document.querySelectorAll('.btn-voltar-exemplo').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            toggleExemplos();
        });
    });
});
