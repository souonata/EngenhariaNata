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
//   2) Price (Tabela Price / Sistema Francês) - parcela fixa (PMT)
//      calculada com a fórmula de anuidades; no começo paga-se mais
//      juros e pouca amortização, com inversão ao longo do prazo.
//   3) Americano - paga-se apenas juros durante todo o período e o
//      principal é pago integralmente na última parcela.
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
        if (valor < 10000) {
            // Entre 1.000 e 10.000: step de 1.000
            baseStep = 1000;
        } else if (valor < maxSlider) {
            // Entre 10.000 e o máximo do slider: step de 10.000
            baseStep = 10000;
        } else {
            // Acima do máximo do slider: step de 100.000 (para valores manuais)
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
 * Formata o valor emprestado enquanto o usuário digita
 * Adiciona pontos como separador de milhares (ex: 100.000)
 */
function formatarValorInput(e) {
    let valor = e.target.value;
    const MAX_VALOR = 10000000; // 10 milhões
    
    // Remove TUDO que não é número (letras, pontos, vírgulas, etc)
    // \D significa "qualquer coisa que não seja dígito"
    valor = valor.replace(/\D/g, '');
    
    // Se o campo ficou vazio, não faz nada (mas no blur vamos forçar o mínimo)
    if (valor === '') {
        e.target.value = '';
        return;
    }
    
    // Converte o texto para número inteiro (sem centavos)
    let numero = parseInt(valor);
    
    // Se passar do limite, corta no máximo
    if (numero > MAX_VALOR) {
        numero = MAX_VALOR;
    }

    // Se chamado por 'blur' (o usuário terminou de editar) aplicamos regras:
    // - mínimo absoluto = 1.000
    // - Arredonda para múltiplos do step apropriado baseado no valor
    if (e.type === 'blur') {
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
    }
    
    // Se não for blur, apenas atualiza o valor enquanto digita (sem recalcular)
    if (e.type !== 'blur') {
        // Formata com separador de milhares enquanto digita
        const valorFormatado = numero.toLocaleString(idiomaAtual, {
            useGrouping: true,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        e.target.value = valorFormatado;
        return;
    }
    
    // No blur, formata e recalcula
    const valorFormatado = numero.toLocaleString(idiomaAtual, {
        useGrouping: true,           // Usa agrupamento (separa os milhares)
        minimumFractionDigits: 0,    // Não mostra decimais
        maximumFractionDigits: 0     // Não permite decimais
    });
    e.target.value = valorFormatado;
    
    // Sincronizar slider
    const slider = document.getElementById('sliderValor');
    if (slider) {
        // Permitir valores acima do máximo do slider para inputs manuais
        // O slider será limitado ao máximo baseado no idioma, mas o input pode ir até 10 milhões
        const maxSlider = obterMaxValorSlider();
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
        valor = MAX_TAXA.toFixed(decimalsToShow).replace('.', ',');
    }
    
    e.target.value = valor;
    
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
function obterValorNumericoFormatado(valorFormatado) {
    // Se o valor está vazio, nulo ou undefined, retorna zero
    if (!valorFormatado) return 0;

    // Converte para texto e remove espaços no início e fim
    // String() = converte para texto (caso seja número)
    // .trim() = remove espaços no início e fim
    let valorTexto = String(valorFormatado).trim();

    // ============================================
    // CASO 1: Tem AMBOS ponto e vírgula
    // ============================================
    // Exemplo: "1.234,56"
    // Neste caso, ponto = separador de milhares, vírgula = decimal
    if (valorTexto.indexOf('.') !== -1 && valorTexto.indexOf(',') !== -1) {
        // Remove todos os pontos (separadores de milhares)
        // /\./g = regex que encontra todos os pontos (g = global, todos)
        valorTexto = valorTexto.replace(/\./g, '');
        // Troca a vírgula por ponto (padrão JavaScript para decimais)
        valorTexto = valorTexto.replace(',', '.');
    } 
    // ============================================
    // CASO 2: Tem APENAS vírgula
    // ============================================
    // Exemplo: "10,5"
    // Neste caso, vírgula = separador decimal
    else if (valorTexto.indexOf(',') !== -1) {
        // Remove qualquer ponto que possa existir (por segurança)
        valorTexto = valorTexto.replace(/\./g, '');
        // Troca vírgula por ponto
        valorTexto = valorTexto.replace(',', '.');
    } 
    // ============================================
    // CASO 3: Tem APENAS pontos (ou nenhum)
    // ============================================
    // Exemplo: "100.000" ou "100000"
    // Neste caso, pontos = separadores de milhares
    else {
        // Remove todos os pontos
        valorTexto = valorTexto.replace(/\./g, '');
    }

    // Remove qualquer caractere que não seja número, ponto ou sinal de menos
    // [^0-9.\-] = regex que encontra qualquer coisa que NÃO seja:
    // - 0-9 = dígitos
    // - . = ponto
    // - \- = sinal de menos (escapado)
    valorTexto = valorTexto.replace(/[^0-9.\-]/g, '');

    // Converte o texto limpo para número decimal
    // parseFloat() = converte texto para número (permite decimais)
    // || 0 = se não conseguir converter (NaN), usa zero
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
        'system-price': 'Price - Tabela Price / Francese (Brasil/Itália)',
        'system-german': 'Americano - Juros Periódicos + Principal no Final',
        'system-sac-short': 'SAC',
        'system-price-short': 'Price',
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
        'footer': 'Calculadora de Empréstimos - Engenharia Nata © 2025',
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
        'table-amortization-last': 'última parcela'
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
        'system-sac': 'SAC - Ammortamento Costante (Brasile/Italia)',
        'system-price': 'Price - Tabella Price / Francese (Brasile/Italia)',
        'system-german': 'Tedesco - Interessi Periodici + Capitale alla Fine',
        'system-sac-short': 'SAC',
        'system-price-short': 'Price',
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
        'footer': 'Calcolatrice di Mutui - Engenharia Nata © 2025',
        'aria-home': 'Torna alla schermata iniziale',
        'quick-controls': 'Controlli Rapidi',
        'quick-controls-desc': 'Regola i parametri e ricalcola istantaneamente',
        'evolution-charts': '📊 Evoluzione nel Tempo',
        'accumulated-interest': 'Interessi Accumulati',
        'accumulated-amortization': 'Ammortamento Accumulato',
        'examples-title': '📚 Capire i Sistemi di Ammortamento',
        'example-sac-title': '1. Sistema SAC - Ammortamento Costante',
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
        'example-price-title': '2. Tabella Price (Sistema Francese)',
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
        'table-amortization-last': 'ultima rata'
    }
};

// Função para trocar idioma
function trocarIdioma(idioma) {
    idiomaAtual = idioma;
    moedaAtual = idioma === 'pt-BR' ? 'BRL' : 'EUR';
    
    // Salva no localStorage para manter entre páginas
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, idioma);
    
    // Atualizar máximo do slider de valor baseado no idioma
    if (sliderValor) {
        const maxSlider = obterMaxValorSlider();
        const valorAtual = parseFloat(sliderValor.value) || 100000;
        sliderValor.max = maxSlider;
        // Se o valor atual for maior que o novo máximo, ajustar para o máximo
        if (valorAtual > maxSlider) {
            sliderValor.value = maxSlider;
        }
    }
    
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
        if (traducoes[idioma][chave]) {
            element.textContent = traducoes[idioma][chave];
        }
    });
    
    // Recalcular se houver dados
    if (tabelaAmortizacaoAtual.length > 0) {
        const valorEmprestimo = dadosEmprestimo.valorEmprestimo;
        const totalJuros = tabelaAmortizacaoAtual.reduce((sum, item) => sum + item.juros, 0);
        const totalPagar = valorEmprestimo + totalJuros;
        const porcentagemJuros = (totalJuros / valorEmprestimo) * 100;
        
        exibirResultados(valorEmprestimo, totalJuros, totalPagar, porcentagemJuros);
        atualizarParcelaExibida();
        preencherTabelaAmortizacao();
        atualizarGraficos();
    }

    // Atualiza o aria-label do botão home (acessibilidade)
    const homeLabel = traducoes[idioma]['aria-home'] || 'Home';
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
 * Calcula a tabela de amortização usando o Sistema SAC
 * 
 * SAC = Sistema de Amortização Constante
 * Também conhecido como "Ammortamento all'Italiana" na Itália.
 * 
 * Este sistema é muito usado no Brasil para financiamento imobiliário (Caixa).
 * 
 * Características:
 * - Amortização FIXA (sempre a mesma)
 * - Parcelas VARIÁVEIS (diminuem com o tempo)
 * - No início: parcelas maiores (muita amortização + muitos juros)
 * - No final: parcelas menores (muita amortização + poucos juros)
 * - Total de juros: menor que no Price
 * 
 * @param {number} valorEmprestimo - Valor total emprestado (ex: 100000)
 * @param {number} taxaMensal - Taxa de juros mensal em decimal (ex: 0.01 = 1%)
 * @param {number} numeroParcelas - Número total de parcelas (ex: 120)
 * @returns {Array} Array com objetos contendo dados de cada parcela
 * 
 * Fórmulas:
 * - Amortização = Valor Emprestado ÷ Número de Parcelas (sempre igual)
 * - Juros = Saldo Devedor × Taxa Mensal (diminui a cada mês)
 * - Parcela = Amortização + Juros (diminui a cada mês)
 */
function calcularSAC(valorEmprestimo, taxaMensal, numeroParcelas) {
    // Array que vai guardar os dados de cada parcela
    const tabela = [];
    
    // Saldo devedor começa sendo o valor total emprestado
    let saldoDevedor = valorEmprestimo;
    
    // Calcula a amortização constante (sempre a mesma em todas as parcelas)
    // Exemplo: R$ 100.000 ÷ 120 parcelas = R$ 833,33 por mês
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
 * Calcula a tabela de amortização usando o Sistema Americano
 * 
 * Também conhecido como "Sistema Alemão" ou "Sistema de Juros Periódicos".
 * 
 * Este sistema é raro no Brasil, mas pode ser usado em situações específicas,
 * como investimentos onde o principal é devolvido no final.
 * 
 * Características:
 * - Parcelas 1 a (n-1): pagam APENAS juros (valor constante)
 * - Última parcela (n): paga juros + todo o principal de uma vez
 * - Saldo devedor: permanece igual até a última parcela
 * - Total de juros: maior que nos outros sistemas
 * 
 * @param {number} valorEmprestimo - Valor total emprestado (ex: 100000)
 * @param {number} taxaMensal - Taxa de juros mensal em decimal (ex: 0.01 = 1%)
 * @param {number} numeroParcelas - Número total de parcelas (ex: 120)
 * @returns {Array} Array com objetos contendo dados de cada parcela
 * 
 * Exemplo prático:
 * - Empréstimo: R$ 100.000 a 1% ao mês por 120 meses
 * - Parcelas 1 a 119: R$ 1.000 (só juros)
 * - Parcela 120: R$ 101.000 (R$ 1.000 juros + R$ 100.000 principal)
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
        // Remove pontos (separadores de milhares) e troca vírgula por ponto
        // Exemplo: "100.000" → "100000", "1.500,50" → "1500.50"
        const valorInputTexto = inputValor.value.replace(/\./g, '').replace(',', '.');
        // Converte para número
        const valorInput = parseFloat(valorInputTexto) || 0;
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
    sliderParcelas.value = 1;                 // Volta para a primeira parcela
    document.getElementById('totalParcelas').textContent = numeroParcelas;  // Mostra o total
    
    // Atualiza a exibição da parcela selecionada (mostra dados da parcela 1)
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
    document.getElementById('resValorEmprestado').textContent = formatarMoedaSemDecimal(valorEmprestimo);
    document.getElementById('resTotalJuros').textContent = formatarMoedaSemDecimal(totalJuros);
    document.getElementById('resTotalPagar').textContent = formatarMoedaSemDecimal(totalPagar);
    document.getElementById('resPorcentagemJuros').textContent = porcentagemJuros.toFixed(1) + '%';
}

// Atualizar exibição da parcela selecionada no slider
window.atualizarParcelaExibida = function() {
    const indiceParcela = parseInt(sliderParcelas.value) - 1;
    const parcela = tabelaAmortizacaoAtual[indiceParcela];
    
    if (!parcela) return;
    
    // Atualiza os valores na tela
    document.getElementById('numeroParcela').textContent = parcela.parcela;
    document.getElementById('valorParcela').textContent = formatarMoeda(parcela.valorParcela);
    document.getElementById('valorAmortizacao').textContent = formatarMoeda(parcela.amortizacao);
    document.getElementById('valorJurosParcela').textContent = formatarMoeda(parcela.juros);
    document.getElementById('saldoDevedor').textContent = formatarMoeda(parcela.saldoDevedor);
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

// Toggle exemplos
function toggleExemplos() {
    if (!exemplosSection) {
        console.error('exemplosSection não encontrado');
        return;
    }
    
    if (exemplosSection.style.display === 'none' || exemplosSection.style.display === '') {
        // Atualizar exemplos com valores atuais dos inputs
        atualizarExemplosComValores();
        exemplosSection.style.display = 'block';
        resultados.style.display = 'none';
        // Rolar para o topo da página
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        exemplosSection.style.display = 'none';
        resultados.style.display = 'block';
    }
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
    const taxaTexto = `${taxaJuros.toFixed(2)}% ${obterTextoPeriodicidade(periodoJuros)}`;
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
function formatarNumero(valor) {
    // Intl.NumberFormat = API do JavaScript para formatar números
    // idiomaAtual = 'pt-BR' ou 'it-IT' (define o formato regional)
    return new Intl.NumberFormat(idiomaAtual, {
        useGrouping: true,           // Ativa separador de milhares (pontos ou espaços)
        minimumFractionDigits: 0,    // Mínimo de casas decimais: 0 (não mostra decimais)
        maximumFractionDigits: 0     // Máximo de casas decimais: 0 (não permite decimais)
    }).format(valor);                // .format() aplica a formatação ao número
}

/**
 * Formata números de forma compacta para gráficos
 * 
 * Usa abreviações para números grandes:
 * - 1.500.000 → "1,5M" (milhões)
 * - 150.000 → "150k" (milhares)
 * - 500 → "500" (sem abreviação)
 * 
 * Isso deixa os gráficos mais legíveis quando os valores são muito grandes.
 * 
 * @param {number} valor - Número a ser formatado
 * @returns {string} Número formatado de forma compacta
 */
function formatarNumeroCompacto(valor) {
    // Se o valor é maior ou igual a 1 milhão
    if (valor >= 1000000) {
        // Divide por 1 milhão, arredonda para 1 casa decimal
        // Exemplo: 1.500.000 / 1.000.000 = 1.5
        const valorEmMilhoes = (valor / 1000000).toFixed(1);
        // Troca ponto por vírgula (formato brasileiro/italiano)
        // Exemplo: "1.5" → "1,5"
        // Adiciona "M" no final
        return valorEmMilhoes.replace('.', ',') + 'M';
    } 
    // Se o valor é maior ou igual a 1 mil (mas menor que 1 milhão)
    else if (valor >= 1000) {
        // Divide por 1 mil, arredonda para número inteiro
        // Exemplo: 150.000 / 1.000 = 150
        const valorEmMilhares = (valor / 1000).toFixed(0);
        // Adiciona "k" no final
        return valorEmMilhares + 'k';
    }
    // Se o valor é menor que 1 mil, retorna como está (sem abreviação)
    return valor.toString();
}

/**
 * Formata valores monetários com 2 casas decimais
 * 
 * Formata números como moeda (R$ ou €) com centavos.
 * Exemplo: 1234.56 → "R$ 1.234,56" (pt-BR) ou "€ 1.234,56" (it-IT)
 * 
 * @param {number} valor - Valor a ser formatado
 * @returns {string} Valor formatado como moeda
 */
function formatarMoeda(valor) {
    // Intl.NumberFormat com style: 'currency' formata como moeda
    return new Intl.NumberFormat(idiomaAtual, {
        style: 'currency',           // Formata como moeda (adiciona R$ ou €)
        currency: moedaAtual,        // moedaAtual = 'BRL' ou 'EUR'
        minimumFractionDigits: 2,    // Sempre mostra 2 casas decimais (centavos)
        maximumFractionDigits: 2     // Máximo de 2 casas decimais
    }).format(valor);
}

/**
 * Formata valores monetários sem casas decimais
 * 
 * Formata números como moeda (R$ ou €) sem centavos.
 * Exemplo: 1234.56 → "R$ 1.235" (arredondado, pt-BR)
 * 
 * Usado para valores grandes onde centavos não são relevantes.
 * 
 * @param {number} valor - Valor a ser formatado
 * @returns {string} Valor formatado como moeda sem decimais
 */
function formatarMoedaSemDecimal(valor) {
    // Intl.NumberFormat com style: 'currency' formata como moeda
    return new Intl.NumberFormat(idiomaAtual, {
        style: 'currency',           // Formata como moeda (adiciona R$ ou €)
        currency: moedaAtual,        // moedaAtual = 'BRL' ou 'EUR'
        minimumFractionDigits: 0,    // Não mostra decimais
        maximumFractionDigits: 0     // Não permite decimais
    }).format(valor);
}

// Inicialização
// Variáveis globais para os gráficos
let graficoEvolutivo = null;

// Criar ou atualizar gráficos
function atualizarGraficos() {
    if (tabelaAmortizacaoAtual.length === 0) return;
    
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
            const valorInput = parseFloat(inputValor.value.replace(/\./g, '').replace(',', '.')) || 0;
            const valorSlider = parseFloat(sliderValor.value) || 0;
            
            // Se o input tem valor válido e está acima do limite do slider, usa o input
            // Caso contrário, sincroniza com o slider
            const maxSlider = obterMaxValorSlider();
        if (valorInput > maxSlider && valorInput <= 10000000) {
                // Mantém o valor do input (já está formatado)
                return;
            } else {
                // Sincroniza com o slider
                inputValor.value = valorSlider.toLocaleString(idiomaAtual, {
                    useGrouping: true,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                });
            }
        }
    };
    
    window.atualizarDisplayTaxa = function() {
        if (inputTaxa && sliderTaxa && document.activeElement !== inputTaxa) {
            const taxa = parseFloat(sliderTaxa.value) || 0;
            const periodoAtual = (document.querySelector('input[name="periodoRapido"]:checked') || {}).value || 'ano';
            const decimalsToShow = periodoAtual === 'dia' ? 3 : periodoAtual === 'mes' ? 2 : 1;
            inputTaxa.value = taxa.toFixed(decimalsToShow).replace('.', ',');
        }
    };
    
    window.atualizarDisplayPrazo = function() {
        if (inputPrazo && sliderPrazo && document.activeElement !== inputPrazo) {
            inputPrazo.value = sliderPrazo.value;
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
    
    // Event Listeners para botões de seta
    document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        const step = parseFloat(btn.getAttribute('data-step'));
        // Temporizadores locais para este botão — evita colisão entre botões
        let btnTimeoutId = null;
        let btnIntervalId = null;
        
        // Função para executar um step imediatamente
        const executarStep = function() {
            ajustarValor(targetId, step);
        };
        
        // Função para iniciar repetição (após delay)
        const startRepeat = function() {
            // Executa IMEDIATAMENTE no primeiro toque/clique
            executarStep();
            
            // Depois de 500ms, começa a repetir (guardado em variáveis locais)
            btnTimeoutId = setTimeout(() => {
                btnIntervalId = setInterval(() => {
                    ajustarValor(targetId, step);
                }, 100);
            }, 500);
        };
        
        // Função para parar repetição
        const stopRepeat = function() {
            if (btnTimeoutId) {
                clearTimeout(btnTimeoutId);
                btnTimeoutId = null;
            }
            if (btnIntervalId) {
                clearInterval(btnIntervalId);
                btnIntervalId = null;
            }
        };
        
        // Eventos MOUSE (para desktop)
        btn.addEventListener('mousedown', function(e) {
            e.preventDefault();
            startRepeat();
        });
        btn.addEventListener('mouseup', stopRepeat);
        btn.addEventListener('mouseleave', stopRepeat);
        
        // Eventos TOUCH (para mobile)
        btn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            startRepeat();
        });
        btn.addEventListener('touchend', function(e) {
            e.preventDefault();
            stopRepeat();
        });
        btn.addEventListener('touchcancel', function(e) {
            e.preventDefault();
            stopRepeat();
        });
    });
    
    // Event Listeners para sliders
    sliderParcelas.addEventListener('input', atualizarParcelaExibida);
    
    if (sliderValor) {
        sliderValor.addEventListener('input', function() {
            atualizarDisplayValor();
            calcularEmprestimo();
        });
    }
    
    if (sliderTaxa) {
        sliderTaxa.addEventListener('input', function() {
            atualizarDisplayTaxa();
            calcularEmprestimo();
        });
    }
    
    if (sliderPrazo) {
        sliderPrazo.addEventListener('input', function() {
            atualizarDisplayPrazo();
            calcularEmprestimo();
        });
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

    // Ripple helper is provided by /ripple.js (global attachRippleTo)
    // ripple attachments centralized in ripple-init.js
    
    // Event listener para o botão de exemplos
    if (btnExemplos) {
        btnExemplos.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleExemplos();
        });
        btnExemplos.style.cursor = 'pointer';
    } else {
        console.error('Botão btnExemplos não encontrado no DOM');
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
