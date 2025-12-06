// ============================================
// VARIÁVEIS GLOBAIS (acessíveis em todo o código)
// ============================================

// Armazena os valores originais dos inputs quando o usuário começa a editar
// Útil para restaurar o valor se o usuário apertar ESC
let valoresOriginais = {};

// Armazena a tabela completa de amortização (todas as parcelas calculadas)
// Cada item tem: parcela, valorParcela, amortizacao, juros, saldoDevedor
let tabelaAmortizacaoAtual = [];

// Armazena os dados do empréstimo atual (valor, taxa, prazo, etc)
let dadosEmprestimo = {};

// Idioma atual da aplicação - carrega do localStorage ou usa português como padrão
let idiomaAtual = localStorage.getItem('idiomaPreferido') || 'pt-BR';

// Moeda atual (BRL para português, EUR para italiano)
let moedaAtual = idiomaAtual === 'pt-BR' ? 'BRL' : 'EUR';

// Elementos HTML que serão usados frequentemente no código
// Declarados aqui mas inicializados DEPOIS que o HTML carregar (no DOMContentLoaded)
let btnExemplos, exemplosSection, resultados, sliderParcelas;
let btnPortugues, btnItaliano;
let valorRapido, taxaRapida, prazoRapido;

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
function ajustarValor(targetId, step) {
    // Pega o elemento HTML pelo ID
    const input = document.getElementById(targetId);
    
    // Limites máximos de segurança
    const MAX_VALOR = 100000000; // 100 milhões - não deixa passar disso
    const MAX_TAXA = 100; // 100% - taxa máxima permitida
    
    // Verifica qual campo está sendo ajustado e aplica regras específicas
    if (targetId === 'valorRapido') {
        // CAMPO DE VALOR EMPRESTADO
        
        // Converte o texto formatado (ex: "100.000") para número (100000)
        let valor = obterValorNumericoFormatado(input.value);
        
        // Adiciona o step e garante que fica entre 0 e MAX_VALOR
        // Math.max(0, ...) garante que não fica negativo
        // Math.min(MAX_VALOR, ...) garante que não passa do máximo
        valor = Math.max(0, Math.min(MAX_VALOR, valor + step));
        
        // Formata de volta para o padrão brasileiro (ex: 100000 vira "100.000")
        input.value = valor.toLocaleString(idiomaAtual);
        
    } else if (targetId === 'taxaRapida') {
        // CAMPO DE TAXA DE JUROS
        
        // Converte texto com vírgula (ex: "10,5") para número JavaScript (10.5)
        let taxa = parseFloat(input.value.replace(',', '.')) || 0;
        
        // Adiciona o step e limita entre 0 e 100%
        taxa = Math.max(0, Math.min(MAX_TAXA, taxa + step));
        
        // Formata com 1 casa decimal e troca ponto por vírgula
        // toFixed(1) garante uma casa decimal: 10.5
        // replace('.', ',') converte para padrão brasileiro: 10,5
        input.value = taxa.toFixed(1).replace('.', ',');
        
    } else if (targetId === 'prazoRapido') {
        // CAMPO DE PRAZO EM ANOS
        
        // Converte para número inteiro (sem decimais)
        let prazo = parseInt(input.value) || 0;
        
        // Adiciona o step e limita entre 1 e 50 anos
        prazo = Math.max(1, Math.min(50, prazo + step));
        
        // Prazo não precisa formatação, é só o número
        input.value = prazo;
    }
    
    // Recalcula o empréstimo automaticamente após ajustar o valor
    // Mas só se a página já terminou de carregar (valorRapido existe)
    if (valorRapido) {
        calcularEmprestimo();
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
    const MAX_VALOR = 100000000; // 100 milhões
    
    // Remove TUDO que não é número (letras, pontos, vírgulas, etc)
    // \D significa "qualquer coisa que não seja dígito"
    valor = valor.replace(/\D/g, '');
    
    // Se o campo ficou vazio, não faz nada
    if (valor === '') {
        e.target.value = '';
        return;
    }
    
    // Converte o texto para número inteiro
    let numero = parseInt(valor);
    
    // Se passar do limite, corta no máximo
    if (numero > MAX_VALOR) {
        numero = MAX_VALOR;
    }
    
    // Formata com separador de milhares no padrão do idioma atual
    // Ex: 100000 vira "100.000" em PT ou "100,000" em EN
    e.target.value = numero.toLocaleString(idiomaAtual, {
        useGrouping: true,           // Usa agrupamento (separa os milhares)
        minimumFractionDigits: 0,    // Não mostra decimais
        maximumFractionDigits: 0     // Não permite decimais
    });
    
    // Recalcula automaticamente quando o usuário muda o valor
    calcularEmprestimo();
}

/**
 * Formata a taxa de juros enquanto o usuário digita
 * Garante que usa vírgula como separador decimal (ex: 10,5)
 */
function formatarTaxaInput(e) {
    let valor = e.target.value;
    const MAX_TAXA = 100; // 100%
    
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
    
    // Valida o limite máximo de 100%
    const taxaNum = parseFloat(valor.replace(',', '.')); // Converte para número
    if (!isNaN(taxaNum) && taxaNum > MAX_TAXA) {
        // Se passou de 100%, força o valor máximo
        valor = MAX_TAXA.toFixed(1).replace('.', ',');
    }
    
    e.target.value = valor;
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
    e.target.value = Math.max(1, Math.min(50, numero));
    
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
    
    // Remove todos os pontos (separador de milhares)
    // Remove todas as vírgulas (separador decimal)
    const valor = valorFormatado.replace(/\./g, '').replace(/,/g, '');
    
    // Converte para número. Se falhar, retorna 0
    return parseFloat(valor) || 0;
}

/**
 * Nome alternativo para a mesma função acima
 * Mantido para compatibilidade com código antigo
 */
function obterValorNumerico(valorFormatado) {
    return obterValorNumericoFormatado(valorFormatado);
}

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
        'interest-rate': 'Taxa de Juros (% ao)',
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
        'interest-rate': 'Tasso di Interesse (% al)',
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
        'footer': 'Calcolatrice di Mutui - Brasile & Italia © 2025',
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
    localStorage.setItem('idiomaPreferido', idioma);
    
    // Atualizar botões ativos usando data-lang (mais confiável)
    document.querySelectorAll('.lang-btn').forEach(btn => {
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
}

// Função para converter taxa de juros para mensal
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

// Sistema Price / Ammortamento alla Francese (Juros Compostos - Parcelas Fixas)
// Usado: Brasil (empréstimos pessoais, consignados) e Itália (mutui)
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

// Sistema Alemão/Tedesco (Pagamento de Juros + Principal no Final)
// Usado: Raro no Brasil, ocasional na Itália
// Parcelas 1 a n-1: Apenas juros = PV × taxa
// Última parcela: PV + juros
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
    // Obter valores dos controles rápidos
    const valorEmprestimo = obterValorNumericoFormatado(valorRapido.value);
    const periodoJuros = document.querySelector('input[name="periodoRapido"]:checked').value;
    const taxaJuros = parseFloat(taxaRapida.value.replace(',', '.')) || 0;
    const prazoAnos = parseInt(prazoRapido.value) || 0;
    const tipoCalculo = document.querySelector('input[name="sistemaRapido"]:checked').value;
    
    // Validações
    if (!valorEmprestimo || valorEmprestimo <= 0) {
        return;
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
function atualizarParcelaExibida() {
    const indiceParcela = parseInt(sliderParcelas.value) - 1;
    const parcela = tabelaAmortizacaoAtual[indiceParcela];
    
    if (!parcela) return;
    
    console.log('Parcela:', parcela.parcela, 'Dados:', parcela);
    
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

// Atualizar exemplos com valores dos inputs
function atualizarExemplosComValores() {
    // Usar valores dos controles rápidos
    const valorEmprestimoInput = valorRapido.value;
    const valorEmprestimo = obterValorNumerico(valorEmprestimoInput);
    const taxaJuros = parseFloat(taxaRapida.value.replace(',', '.'));
    const prazoAnos = parseInt(prazoRapido.value);
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
    
    // Tabela comparativa
    document.getElementById('comparison-subtitle').textContent = 
        `Para ${simboloMoeda} ${formatarNumero(valorEmprestimo)} a ${taxaTexto} por ${numeroParcelas} meses:`;
    
    // Atualizar valores da tabela
    const tabelaLinhas = document.querySelectorAll('.comparacao tbody tr');
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
    
    // Criar gráfico unificado
    const ctx = document.getElementById('graficoEvolutivo').getContext('2d');
    
    graficoEvolutivo = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: idiomaAtual === 'pt-BR' ? 'Amortização Acumulada' : 'Ammortamento Accumulato',
                    data: dadosAmortizacao,
                    borderColor: '#66bb6a',
                    backgroundColor: 'rgba(102, 187, 106, 0.1)',
                    fill: false,
                    tension: 0.4,
                    borderWidth: 2
                },
                {
                    label: idiomaAtual === 'pt-BR' ? 'Juros Acumulados' : 'Interessi Accumulati',
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
                    position: 'top',
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
    valorRapido = document.getElementById('valorRapido');
    taxaRapida = document.getElementById('taxaRapida');
    prazoRapido = document.getElementById('prazoRapido');
    
    // Event Listeners para botões de seta
    document.querySelectorAll('.arrow-btn').forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        const step = parseFloat(btn.getAttribute('data-step'));
        
        // Função para executar um step imediatamente
        const executarStep = function() {
            ajustarValor(targetId, step);
        };
        
        // Função para iniciar repetição (após delay)
        const startRepeat = function() {
            // Executa IMEDIATAMENTE no primeiro toque/clique
            executarStep();
            
            // Depois de 500ms, começa a repetir
            timeoutId = setTimeout(() => {
                intervalId = setInterval(() => {
                    ajustarValor(targetId, step);
                }, 100);
            }, 500);
        };
        
        // Função para parar repetição
        const stopRepeat = function() {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
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
    
    // Event Listeners para inputs
    sliderParcelas.addEventListener('input', atualizarParcelaExibida);
    valorRapido.addEventListener('input', formatarValorInput);
    valorRapido.addEventListener('blur', formatarValorInput);
    valorRapido.addEventListener('change', calcularEmprestimo);
    valorRapido.addEventListener('focus', iniciarEdicao);
    valorRapido.addEventListener('keydown', tratarTeclasRapido);
    
    taxaRapida.addEventListener('input', formatarTaxaInput);
    taxaRapida.addEventListener('change', calcularEmprestimo);
    taxaRapida.addEventListener('focus', iniciarEdicao);
    taxaRapida.addEventListener('keydown', tratarTeclasRapido);
    
    prazoRapido.addEventListener('input', formatarPrazoInput);
    prazoRapido.addEventListener('change', calcularEmprestimo);
    prazoRapido.addEventListener('focus', iniciarEdicao);
    prazoRapido.addEventListener('keydown', tratarTeclasRapido);
    
    // Radio buttons dos controles rápidos
    document.querySelectorAll('input[name="periodoRapido"]').forEach(radio => {
        radio.addEventListener('change', calcularEmprestimo);
    });
    
    document.querySelectorAll('input[name="sistemaRapido"]').forEach(radio => {
        radio.addEventListener('change', calcularEmprestimo);
    });
    
    // Botões de idioma
    btnPortugues.addEventListener('click', () => trocarIdioma('pt-BR'));
    btnItaliano.addEventListener('click', () => trocarIdioma('it-IT'));
    
    // Inicializa com o idioma salvo no localStorage
    trocarIdioma(idiomaAtual);
    
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
    
    // Não calcular automaticamente no carregamento - deixa usuário inserir valores
    // calcularEmprestimo();
});
