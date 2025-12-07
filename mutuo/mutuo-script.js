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
 * Converte um texto formatado em número puro
 * Exemplo: "100.000" vira 100000, "1.500" vira 1500
 * Remove pontos e vírgulas para fazer cálculos
 */
function obterValorNumericoFormatado(valorFormatado) {
    if (!valorFormatado) return 0; // Se está vazio, retorna zero

    // Normaliza entradas como:
    //  - "100.000" -> 100000
    //  - "10,5"    -> 10.5
    //  - "1.234,56"-> 1234.56
    //  - "1234.56" -> 1234.56
    let v = String(valorFormatado).trim();

    // Caso tenha ambos '.' e ',' assumimos que '.' é separador de milhares e ',' decimal
    if (v.indexOf('.') !== -1 && v.indexOf(',') !== -1) {
        v = v.replace(/\./g, '');      // remove separador de milhares
        v = v.replace(',', '.');        // converte decimal para ponto
    } else {
        // Caso apenas ',' exista (ex: 10,5) -> converte para ponto: 10.5
        // Caso apenas '.' exista (formato PT/IT como 100.000) -> trata como separador
        // de milhares e remove todos os pontos para produzir 100000.
        if (v.indexOf(',') !== -1) {
            // Has comma -> treat comma as decimal separator
            v = v.replace(/\./g, ''); // remove any stray thousands separators
            v = v.replace(',', '.');
        } else {
            // Only dots present: treat them as thousands separators and remove them
            v = v.replace(/\./g, '');
        }
    }

    // Remove qualquer caractere que não seja dígito, ponto ou sinal de menos
    v = v.replace(/[^0-9.\-]/g, '');

    return parseFloat(v) || 0;
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

// Função para converter taxa de juros para mensal
// ---------------------------------------------
// Recebe uma taxa numérica e o período em que ela é informada ('ano'|'mes'|'dia')
// e retorna a taxa equivalente por mês (em decimal, ex: 0.01 = 1%).
// Explicação:
// - Se a taxa é anual (ex: 12% a.a.), convertemos para mensal usando juros compostos:
//     taxa_mensal = (1 + taxa_anual)^(1/12) - 1
//   Isso respeita capitalização composta (não é simplesmente taxa / 12).
// - Se a taxa é mensal, dividimos por 100 (para transformar em decimal).
// - Se a taxa é diária assumimos 30 dias por mês e aplicamos composição:
//     taxa_mensal = (1 + taxa_diaria)^(30) - 1
function converterTaxaParaMensal(taxa, periodo) {
    switch(periodo) {
        case 'ano':
            // Juros compostos: (1 + taxa_anual)^(1/12) - 1
            return Math.pow(1 + taxa / 100, 1/12) - 1;
        case 'mes':
            return taxa / 100;
        case 'dia':
            // Assumindo 30 dias por mês
            return Math.pow(1 + taxa / 100, 30) - 1;
        default:
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

// Sistema Price / Tabela Price (Parcelas fixas - Anuidade)
// -------------------------------------------------------
// Neste sistema a parcela (PMT) é constante durante todo o prazo.
// A fórmula do PMT garante que o valor presente (PV) das parcelas
// descontadas pela taxa i resulte no valor emprestado. O algoritmo
// calcula a parcela fixa (usando a fórmula de anuidade) e depois,
// para cada período, separa a parcela em juros (saldo × i) e amortização
// (PMT - juros). O saldo diminui pela amortização até zerar no fim.
// Fórmula: PMT = PV × [i × (1+i)^n] / [(1+i)^n - 1]
function calcularPrice(valorEmprestimo, taxaMensal, numeroParcelas) {
    const tabela = [];
    let saldoDevedor = valorEmprestimo;
    
    // Cálculo da parcela fixa (PMT)
    const fator = Math.pow(1 + taxaMensal, numeroParcelas);
    const parcelaFixa = valorEmprestimo * (taxaMensal * fator) / (fator - 1);
    
    for (let i = 1; i <= numeroParcelas; i++) {
        // Juros sobre o saldo devedor atual
        const juros = saldoDevedor * taxaMensal;
        // Amortização é a diferença entre parcela e juros
        const amortizacao = parcelaFixa - juros;
        // Atualiza saldo devedor
        saldoDevedor -= amortizacao;
        
        // Corrigir arredondamento na última parcela
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

// Sistema SAC / Ammortamento all'Italiana (Amortização Constante)
// Usado: Brasil (financiamento imobiliário Caixa) e Itália
// Amortização = Valor / n
// Juros = Saldo Devedor × taxa
// Parcela = Amortização + Juros
function calcularSAC(valorEmprestimo, taxaMensal, numeroParcelas) {
    const tabela = [];
    let saldoDevedor = valorEmprestimo;
    const amortizacaoConstante = valorEmprestimo / numeroParcelas;
    
    for (let i = 1; i <= numeroParcelas; i++) {
        // Juros sobre o saldo devedor atual
        const juros = saldoDevedor * taxaMensal;
        // Parcela = amortização constante + juros
        const valorParcela = amortizacaoConstante + juros;
        // Atualiza saldo devedor
        saldoDevedor -= amortizacaoConstante;
        
        // Corrigir arredondamento na última parcela
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

// Sistema Americano (Juros periódicos + principal no final)
// --------------------------------------------------------
// Também conhecido por "sistema americano" ou "Alemão" no repositório.
// Neste sistema pagam-se juros (constantes) durante os períodos 1..n-1
// e na última parcela paga-se o principal + juros finais. Útil para
// investidores ou operações em que o principal é devolvido no final.
function calcularAlemao(valorEmprestimo, taxaMensal, numeroParcelas) {
    const tabela = [];
    const jurosMensal = valorEmprestimo * taxaMensal;
    
    for (let i = 1; i <= numeroParcelas; i++) {
        if (i === numeroParcelas) {
            // Última parcela: principal + juros
            tabela.push({
                parcela: i,
                valorParcela: valorEmprestimo + jurosMensal,
                amortizacao: valorEmprestimo,
                juros: jurosMensal,
                saldoDevedor: 0
            });
        } else {
            // Parcelas intermediárias: apenas juros
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

// Função principal de cálculo
function calcularEmprestimo() {
    // Obter valores dos sliders e inputs
    // Para valor emprestado, verificar se há valor no input acima do limite do slider
    let valorEmprestimo = parseFloat(sliderValor.value) || 0;
    
    // Se houver input manual com valor acima do máximo do slider, usar esse valor
    const inputValor = document.getElementById('inputValor');
    if (inputValor) {
        const valorInputTexto = inputValor.value.replace(/\./g, '').replace(',', '.');
        const valorInput = parseFloat(valorInputTexto) || 0;
        const maxSlider = obterMaxValorSlider();
        if (valorInput > maxSlider && valorInput <= 10000000) {
            valorEmprestimo = valorInput;
        }
    }
    
    const periodoJuros = document.querySelector('input[name="periodoRapido"]:checked').value;
    const taxaJuros = parseFloat(sliderTaxa.value) || 0;
    const prazoAnos = parseInt(sliderPrazo.value) || 0;
    const tipoCalculo = document.querySelector('input[name="sistemaRapido"]:checked').value;
    
    // Validações
    // Se o valor informado é menor que 1.000, forçamos 1.000 (não abortamos)
    if (!valorEmprestimo || valorEmprestimo < 1000) {
        // Atualiza o slider para o mínimo aceitável para manter consistência
        if (sliderValor) {
            sliderValor.value = 1000;
            atualizarDisplayValor();
        }
        // Use o valor mínimo para os cálculos
        valorEmprestimo = 1000;
    }
    
    if (taxaJuros < 0) {
        return;
    }
    
    if (!prazoAnos || prazoAnos <= 0) {
        return;
    }
    
    // Converter taxa para mensal
    const taxaMensal = converterTaxaParaMensal(taxaJuros, periodoJuros);
    const numeroParcelas = prazoAnos * 12;
    
    // Calcular de acordo com o sistema escolhido
    switch(tipoCalculo) {
        case 'price':
            tabelaAmortizacaoAtual = calcularPrice(valorEmprestimo, taxaMensal, numeroParcelas);
            break;
        case 'sac':
            tabelaAmortizacaoAtual = calcularSAC(valorEmprestimo, taxaMensal, numeroParcelas);
            break;
        case 'alemao':
            tabelaAmortizacaoAtual = calcularAlemao(valorEmprestimo, taxaMensal, numeroParcelas);
            break;
        default:
            alert('Sistema de amortização inválido.');
            return;
    }
    
    // Armazenar dados para uso posterior
    dadosEmprestimo = {
        valorEmprestimo,
        periodoJuros,
        taxaJuros,
        taxaMensal,
        prazoAnos,
        numeroParcelas,
        tipoCalculo
    };
    
    // Calcular totais
    const totalJuros = tabelaAmortizacaoAtual.reduce((sum, item) => sum + item.juros, 0);
    const totalPagar = valorEmprestimo + totalJuros;
    const porcentagemJuros = (totalJuros / valorEmprestimo) * 100;
    
    // Exibir resultados
    exibirResultados(valorEmprestimo, totalJuros, totalPagar, porcentagemJuros);
    
    // Configurar slider
    sliderParcelas.max = numeroParcelas;
    sliderParcelas.value = 1;
    document.getElementById('totalParcelas').textContent = numeroParcelas;
    
    // Atualizar primeira parcela
    atualizarParcelaExibida();
    
    // Preencher tabela
    preencherTabelaAmortizacao();
    
    // Atualizar gráficos
    atualizarGraficos();
    
    // Atualizar exemplos com valores atuais (para quando o usuário abrir "Saiba Mais")
    atualizarExemplosComValores();
    
    // Mostrar seção de resultados (sem scroll automático)
    resultados.style.display = 'block';
    // resultados.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

// Formatar número sem símbolo de moeda
function formatarNumero(valor) {
    return new Intl.NumberFormat(idiomaAtual, {
        useGrouping: true,           // Usa agrupamento (separa os milhares)
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(valor);
}

// Formatar números de forma compacta para gráficos (300k ao invés de 300.000)
function formatarNumeroCompacto(valor) {
    if (valor >= 1000000) {
        return (valor / 1000000).toFixed(1).replace('.', ',') + 'M';
    } else if (valor >= 1000) {
        return (valor / 1000).toFixed(0) + 'k';
    }
    return valor.toString();
}

// Formatar valores monetários
function formatarMoeda(valor) {
    return new Intl.NumberFormat(idiomaAtual, {
        style: 'currency',
        currency: moedaAtual,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor);
}

// Formatar valores monetários sem decimais
function formatarMoedaSemDecimal(valor) {
    return new Intl.NumberFormat(idiomaAtual, {
        style: 'currency',
        currency: moedaAtual,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
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
