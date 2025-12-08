// fazenda-script.js - Lógica do Dimensionador de Fazenda Auto-Sustentável

// ============================================
// FUNÇÕES DE FORMATAÇÃO
// ============================================

// Função formatarNumeroDecimal agora está em assets/js/site-config.js

// ============================================
// ÍCONES DOS PRODUTOS
// ============================================

const ICONES_PRODUTOS = {
    // Frutas
    'banana': '🍌',
    'manga': '🥭',
    'laranja': '🍊',
    'limao': '🍋',
    'abacate': '🥑',
    'mamao': '🍈',
    'goiaba': '🍈',
    'maracuja': '🟣',
    'uva': '🍇',
    'acai': '🫐',
    // Verduras
    'alface': '🥬',
    'couve': '🥬',
    'espinafre': '🥬',
    'rucula': '🥬',
    'agriao': '🥬',
    'repolho': '🥬',
    'brocolis': '🥦',
    'couve-flor': '🥦',
    'acelga': '🥬',
    'salsinha': '🌿',
    // Legumes
    'tomate': '🍅',
    'cenoura': '🥕',
    'beterraba': '🟣',
    'abobora': '🎃',
    'abobrinha': '🥒',
    'pepino': '🥒',
    'pimentao': '🫑',
    'berinjela': '🍆',
    'feijao': '🫘',
    'milho': '🌽',
    'batata': '🥔',
    'cebola': '🧅',
    'alho': '🧄',
    // Animais
    'galinha': '🐔',
    'porco': '🐷',
    'vaca': '🐄',
    'cabrito': '🐐',
    'coelho': '🐰',
    'peixe': '🐟'
};

// ============================================
// DADOS DE PRODUÇÃO
// ============================================

const DADOS_PLANTAS = {
    // Frutas (kg/m²/ano, ciclo em dias, época de plantio)
    frutas: {
        'banana': { producao: 15, ciclo: 365, plantio: 'Ano todo', colheita: 'Contínua', areaMin: 4 },
        'manga': { producao: 8, ciclo: 730, plantio: 'Verão', colheita: 'Verão', areaMin: 16 },
        'laranja': { producao: 12, ciclo: 1095, plantio: 'Outono', colheita: 'Inverno', areaMin: 12 },
        'limao': { producao: 10, ciclo: 730, plantio: 'Primavera', colheita: 'Ano todo', areaMin: 9 },
        'abacate': { producao: 6, ciclo: 1095, plantio: 'Primavera', colheita: 'Verão/Outono', areaMin: 20 },
        'mamao': { producao: 20, ciclo: 365, plantio: 'Ano todo', colheita: 'Ano todo', areaMin: 4 },
        'goiaba': { producao: 12, ciclo: 730, plantio: 'Primavera', colheita: 'Verão/Outono', areaMin: 9 },
        'maracuja': { producao: 8, ciclo: 365, plantio: 'Primavera', colheita: 'Verão/Outono', areaMin: 2 },
        'uva': { producao: 10, ciclo: 365, plantio: 'Inverno', colheita: 'Verão', areaMin: 3 },
        'acai': { producao: 5, ciclo: 1095, plantio: 'Ano todo', colheita: 'Ano todo', areaMin: 25 }
    },
    // Verduras (kg/m²/ano, ciclo em dias)
    verduras: {
        'alface': { producao: 12, ciclo: 45, plantio: 'Ano todo', colheita: 'Ano todo', areaMin: 0.1 },
        'couve': { producao: 8, ciclo: 60, plantio: 'Ano todo', colheita: 'Ano todo', areaMin: 0.2 },
        'espinafre': { producao: 10, ciclo: 50, plantio: 'Outono/Inverno', colheita: 'Inverno/Primavera', areaMin: 0.1 },
        'rucula': { producao: 15, ciclo: 40, plantio: 'Ano todo', colheita: 'Ano todo', areaMin: 0.1 },
        'agriao': { producao: 12, ciclo: 50, plantio: 'Ano todo', colheita: 'Ano todo', areaMin: 0.1 },
        'repolho': { producao: 6, ciclo: 90, plantio: 'Outono/Inverno', colheita: 'Inverno/Primavera', areaMin: 0.3 },
        'brocolis': { producao: 5, ciclo: 100, plantio: 'Outono', colheita: 'Inverno', areaMin: 0.3 },
        'couve-flor': { producao: 5, ciclo: 100, plantio: 'Outono', colheita: 'Inverno', areaMin: 0.3 },
        'acelga': { producao: 8, ciclo: 60, plantio: 'Ano todo', colheita: 'Ano todo', areaMin: 0.2 },
        'salsinha': { producao: 6, ciclo: 70, plantio: 'Ano todo', colheita: 'Ano todo', areaMin: 0.1 }
    },
    // Legumes (kg/m²/ano, ciclo em dias)
    legumes: {
        'tomate': { producao: 8, ciclo: 120, plantio: 'Primavera/Verão', colheita: 'Verão/Outono', areaMin: 0.3 },
        'cenoura': { producao: 6, ciclo: 90, plantio: 'Ano todo', colheita: 'Ano todo', areaMin: 0.1 },
        'beterraba': { producao: 5, ciclo: 80, plantio: 'Ano todo', colheita: 'Ano todo', areaMin: 0.1 },
        'abobora': { producao: 4, ciclo: 100, plantio: 'Primavera', colheita: 'Verão/Outono', areaMin: 1 },
        'abobrinha': { producao: 10, ciclo: 60, plantio: 'Primavera/Verão', colheita: 'Verão/Outono', areaMin: 0.5 },
        'pepino': { producao: 12, ciclo: 70, plantio: 'Primavera/Verão', colheita: 'Verão/Outono', areaMin: 0.3 },
        'pimentao': { producao: 6, ciclo: 120, plantio: 'Primavera', colheita: 'Verão/Outono', areaMin: 0.3 },
        'berinjela': { producao: 5, ciclo: 120, plantio: 'Primavera', colheita: 'Verão/Outono', areaMin: 0.3 },
        'feijao': { producao: 2, ciclo: 80, plantio: 'Ano todo', colheita: 'Ano todo', areaMin: 0.2 },
        'milho': { producao: 1.5, ciclo: 100, plantio: 'Primavera/Verão', colheita: 'Verão/Outono', areaMin: 0.2 },
        'batata': { producao: 4, ciclo: 100, plantio: 'Inverno/Primavera', colheita: 'Primavera/Verão', areaMin: 0.2 },
        'cebola': { producao: 5, ciclo: 120, plantio: 'Outono/Inverno', colheita: 'Primavera/Verão', areaMin: 0.1 },
        'alho': { producao: 3, ciclo: 150, plantio: 'Outono', colheita: 'Primavera', areaMin: 0.1 }
    }
};

const DADOS_ANIMAIS = {
    // Animais (produção diária, espaço m²/animal, ciclo reprodutivo em dias, produção por ciclo)
    'galinha': {
        producaoDiaria: 0.7, // ovos/dia (média de 250-300 ovos/ano)
        producaoUnidade: 'ovos/dia',
        producaoPorUnidade: 0.06, // kg por ovo (peso médio de um ovo)
        espaco: 2, // m² por animal
        cicloReprodutivo: 365, // dias
        producaoCiclo: 250, // ovos/ano
        tempoCrescimento: 180, // dias até começar a produzir
        consumoRacao: 0.12 // kg/dia
    },
    'porco': {
        producaoDiaria: 0, // não produz diariamente
        producaoUnidade: 'kg/ciclo',
        producaoPorUnidade: 80, // kg de carne por animal
        espaco: 10, // m² por animal
        cicloReprodutivo: 365, // dias (1 cria/ano)
        producaoCiclo: 80, // kg de carne
        tempoCrescimento: 180, // dias até abate
        consumoRacao: 2.5 // kg/dia
    },
    'vaca': {
        producaoDiaria: 15, // litros de leite/dia
        producaoUnidade: 'L/dia',
        producaoPorUnidade: 1, // 1 litro = 1 kg
        espaco: 50, // m² por animal
        cicloReprodutivo: 365, // dias (1 cria/ano)
        producaoCiclo: 0, // leite é diário
        tempoCrescimento: 730, // dias até começar a produzir
        consumoRacao: 25 // kg/dia
    },
    'cabrito': {
        producaoDiaria: 2, // litros de leite/dia
        producaoUnidade: 'L/dia',
        producaoPorUnidade: 1,
        espaco: 8, // m² por animal
        cicloReprodutivo: 365,
        producaoCiclo: 0,
        tempoCrescimento: 180,
        consumoRacao: 2 // kg/dia
    },
    'coelho': {
        producaoDiaria: 0,
        producaoUnidade: 'kg/ciclo',
        producaoPorUnidade: 2, // kg de carne por animal
        espaco: 1, // m² por animal
        cicloReprodutivo: 90, // 4 crias/ano
        producaoCiclo: 2,
        tempoCrescimento: 90,
        consumoRacao: 0.15 // kg/dia
    },
    'peixe': {
        producaoDiaria: 0,
        producaoUnidade: 'kg/ciclo',
        producaoPorUnidade: 1, // kg por peixe
        espaco: 0.5, // m² por peixe (tanque)
        cicloReprodutivo: 180, // 2 ciclos/ano
        producaoCiclo: 1,
        tempoCrescimento: 180,
        consumoRacao: 0.02 // kg/dia
    }
};

// Consumo médio por pessoa (kg/ano)
const CONSUMO_POR_PESSOA = {
    frutas: 100, // kg/ano
    verduras: 60, // kg/ano
    legumes: 80, // kg/ano
    ovos: 15, // kg/ano (aproximadamente 250 ovos)
    leite: 50, // L/ano
    carne: 40, // kg/ano
    peixe: 10 // kg/ano
};

// ============================================
// TRADUÇÕES
// ============================================

const traducoes = {
    'pt-BR': {
        'app-title': '🌾 Dimensionador de Fazenda Auto-Sustentável',
        'app-subtitle': 'Planejamento completo de produção de alimentos',
        'label-pessoas': 'Número de Pessoas',
        'unit-people': 'pessoas',
        'label-consumo-plantas': 'Produção Mínima de Plantas (Frutas/Verduras/Legumes)',
        'label-consumo-proteinas': 'Produção Mínima de Proteínas (Animais)',
        'unit-kg-dia-pessoa': 'kg/dia/pessoa',
        'dica-consumo-plantas': '💡 Total de plantas (frutas + verduras + legumes) por pessoa por dia',
        'dica-consumo-proteinas': '💡 Total de proteínas (ovos, leite, carne, peixe) por pessoa por dia',
        'label-frutas': '🍎 Frutas',
        'label-verduras': '🥬 Verduras',
        'label-legumes': '🥕 Legumes',
        'label-animais': '🐔 Animais',
        'dica-selecao': '💡 Selecione os tipos que deseja cultivar',
        'dica-animais': '💡 Selecione os tipos que deseja criar',
        'titulo-resultados': '📊 Resultados do Dimensionamento',
        'titulo-resumo': 'Resumo Geral',
        'titulo-plantas': '🌱 Plantas Selecionadas',
        'titulo-animais-resultado': '🐾 Animais Selecionados',
        'titulo-calendario': '📅 Calendário de Plantio e Colheita',
        'label-area-total': 'Área Total Necessária:',
        'label-area-plantas': 'Área para Plantas:',
        'label-area-animais': 'Área para Animais:',
        'footer-text': 'Engenharia NATA @ 2025 - Apps Educativos de Engenharia',
        'watermark-dev': '🚧 EM DESENVOLVIMENTO',
        'dev-badge-header': '🚧 EM DESENVOLVIMENTO',
        // Nomes de plantas e animais
        'banana': 'Banana', 'manga': 'Manga', 'laranja': 'Laranja', 'limao': 'Limão',
        'abacate': 'Abacate', 'mamao': 'Mamão', 'goiaba': 'Goiaba', 'maracuja': 'Maracujá',
        'uva': 'Uva', 'acai': 'Açaí',
        'alface': 'Alface', 'couve': 'Couve', 'espinafre': 'Espinafre', 'rucula': 'Rúcula',
        'agriao': 'Agrião', 'repolho': 'Repolho', 'brocolis': 'Brócolis', 'couve-flor': 'Couve-flor',
        'acelga': 'Acelga', 'salsinha': 'Salsinha',
        'tomate': 'Tomate', 'cenoura': 'Cenoura', 'beterraba': 'Beterraba', 'abobora': 'Abóbora',
        'abobrinha': 'Abobrinha', 'pepino': 'Pepino', 'pimentao': 'Pimentão', 'berinjela': 'Berinjela',
        'feijao': 'Feijão', 'milho': 'Milho', 'batata': 'Batata', 'cebola': 'Cebola', 'alho': 'Alho',
        'galinha': 'Galinha', 'porco': 'Porco', 'vaca': 'Vaca', 'cabrito': 'Cabrito',
        'coelho': 'Coelho', 'peixe': 'Peixe',
        // Textos de resultado
        'area-necessaria': 'Área Necessária:',
        'quantidade-plantas': 'Quantidade de Plantas:',
        'producao-anual': 'Produção Anual:',
        'consumo-diario-pessoa': 'Produção Mínima por Pessoa/Dia:',
        'ciclo-dias': 'Ciclo (dias):',
        'plantio': 'Época de Plantio:',
        'colheita': 'Época de Colheita:',
        'quantidade-animais': 'Quantidade de Animais:',
        'producao-diaria': 'Produção Diária:',
        'espaco-animal': 'Espaço por Animal:',
        'ciclo-reprodutivo': 'Ciclo Reprodutivo:',
        'frequencia-plantio': 'Frequência de Plantio:',
        'frequencia-colheita': 'Frequência de Colheita:',
        'frequencia-reproducao': 'Frequência de Reprodução:',
        'm2': 'm²',
        'kg': 'kg',
        'unidades': 'unidades',
        'dias': 'dias',
        'vezes-ano': 'vezes/ano',
        // Memorial
        'memorial-title': '📚 Memorial de Cálculo - Fazenda Auto-Sustentável',
        'btn-memorial': 'Ver Memorial de Cálculo',
        'memorial-intro-title': '🎯 Objetivo do Dimensionamento',
        'memorial-intro-text': 'Este memorial explica passo a passo como é calculado o dimensionamento de uma fazenda auto-sustentável, incluindo área necessária, quantidade de plantas e animais, frequência de plantio/colheita e reprodução para alimentar uma família.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcular Consumo Total',
        'memorial-formula': 'Fórmula:',
        'memorial-passo1-explicacao': 'O consumo total é calculado multiplicando o consumo diário por pessoa pelo número de pessoas e pelos dias do ano.',
        'memorial-example': 'Exemplo:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcular Área Necessária para Plantas',
        'memorial-passo2-explicacao': 'A área necessária é calculada dividindo o consumo anual total pela produção anual por metro quadrado de cada tipo de planta.',
        'memorial-passo3-title': '3️⃣ Passo 3: Calcular Quantidade de Plantas',
        'memorial-passo3-explicacao': 'A quantidade de plantas é calculada multiplicando a área necessária pela densidade de plantio específica de cada tipo de planta.',
        'memorial-passo4-title': '4️⃣ Passo 4: Calcular Quantidade de Animais',
        'memorial-passo4-explicacao': 'A quantidade de animais é calculada baseada no tipo de produção: diária (ovos, leite) ou por ciclo (carne).',
        'memorial-passo5-title': '5️⃣ Passo 5: Calcular Frequência de Plantio',
        'memorial-passo5-explicacao': 'A frequência de plantio é determinada pelo ciclo de crescimento de cada tipo de planta para manter produção contínua.',
        'memorial-resumo-title': '📊 Resumo Calculado',
        'memorial-resumo-area-plantas': 'Área Total Plantas:',
        'memorial-resumo-area-animais': 'Área Total Animais:',
        'memorial-resumo-area-total': 'Área Total:',
        'learn-more': 'SAIBA MAIS!',
        'back': '← Voltar',
        'back-to-calculator': 'Voltar para a Calculadora'
    },
    'it-IT': {
        'app-title': '🌾 Dimensionatore di Fattoria Auto-Sostenibile',
        'app-subtitle': 'Pianificazione completa della produzione alimentare',
        'label-pessoas': 'Numero di Persone',
        'unit-people': 'persone',
        'label-consumo-plantas': 'Produzione Minima di Piante (Frutta/Verdura/Legumi)',
        'label-consumo-proteinas': 'Produzione Minima di Proteine (Animali)',
        'unit-kg-dia-pessoa': 'kg/giorno/persona',
        'dica-consumo-plantas': '💡 Totale di piante (frutta + verdura + legumi) per persona al giorno',
        'dica-consumo-proteinas': '💡 Totale di proteine (uova, latte, carne, pesce) per persona al giorno',
        'label-frutas': '🍎 Frutta',
        'label-verduras': '🥬 Verdura',
        'label-legumes': '🥕 Legumi',
        'label-animais': '🐔 Animali',
        'dica-selecao': '💡 Seleziona i tipi che vuoi coltivare',
        'dica-animais': '💡 Seleziona i tipi che vuoi allevare',
        'titulo-resultados': '📊 Risultati del Dimensionamento',
        'titulo-resumo': 'Riepilogo Generale',
        'titulo-plantas': '🌱 Piante Selezionate',
        'titulo-animais-resultado': '🐾 Animali Selezionati',
        'titulo-calendario': '📅 Calendario di Semina e Raccolta',
        'label-area-total': 'Area Totale Necessaria:',
        'label-area-plantas': 'Area per Piante:',
        'label-area-animais': 'Area per Animali:',
        'footer-text': 'Engenharia NATA @ 2025 - App Educativi di Ingegneria',
        'watermark-dev': '🚧 IN SVILUPPO',
        'dev-badge-header': '🚧 IN SVILUPPO',
        // Nomes de plantas e animais (italiano)
        'banana': 'Banana', 'manga': 'Mango', 'laranja': 'Arancia', 'limao': 'Limone',
        'abacate': 'Avocado', 'mamao': 'Papaya', 'goiaba': 'Guava', 'maracuja': 'Maracuja',
        'uva': 'Uva', 'acai': 'Açaí',
        'alface': 'Lattuga', 'couve': 'Cavolo', 'espinafre': 'Spinaci', 'rucula': 'Rucola',
        'agriao': 'Crescione', 'repolho': 'Cavolo Cappuccio', 'brocolis': 'Broccoli', 'couve-flor': 'Cavolfiore',
        'acelga': 'Bietola', 'salsinha': 'Prezzemolo',
        'tomate': 'Pomodoro', 'cenoura': 'Carota', 'beterraba': 'Barbabietola', 'abobora': 'Zucca',
        'abobrinha': 'Zucchina', 'pepino': 'Cetriolo', 'pimentao': 'Peperone', 'berinjela': 'Melanzana',
        'feijao': 'Fagioli', 'milho': 'Mais', 'batata': 'Patata', 'cebola': 'Cipolla', 'alho': 'Aglio',
        'galinha': 'Gallina', 'porco': 'Maiale', 'vaca': 'Mucca', 'cabrito': 'Capretto',
        'coelho': 'Coniglio', 'peixe': 'Pesce',
        // Textos de resultado
        'area-necessaria': 'Area Necessaria:',
        'quantidade-plantas': 'Quantità di Piante:',
        'producao-anual': 'Produzione Annuale:',
        'consumo-diario-pessoa': 'Produzione Minima per Persona/Giorno:',
        'ciclo-dias': 'Ciclo (giorni):',
        'plantio': 'Epoca di Semina:',
        'colheita': 'Epoca di Raccolta:',
        'quantidade-animais': 'Quantità di Animali:',
        'producao-diaria': 'Produzione Giornaliera:',
        'espaco-animal': 'Spazio per Animale:',
        'ciclo-reprodutivo': 'Ciclo Riproduttivo:',
        'frequencia-plantio': 'Frequenza di Semina:',
        'frequencia-colheita': 'Frequenza di Raccolta:',
        'frequencia-reproducao': 'Frequenza di Riproduzione:',
        'm2': 'm²',
        'kg': 'kg',
        'unidades': 'unità',
        'dias': 'giorni',
        'vezes-ano': 'volte/anno',
        // Memorial
        'memorial-title': '📚 Memoriale di Calcolo - Fattoria Auto-Sostenibile',
        'btn-memorial': 'Vedi Memoriale di Calcolo',
        'memorial-intro-title': '🎯 Obiettivo del Dimensionamento',
        'memorial-intro-text': 'Questo memoriale spiega passo dopo passo come viene calcolato il dimensionamento di una fattoria auto-sostenibile, inclusa l\'area necessaria, la quantità di piante e animali, la frequenza di semina/raccolta e riproduzione per nutrire una famiglia.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcolare Consumo Totale',
        'memorial-formula': 'Formula:',
        'memorial-passo1-explicacao': 'Il consumo totale viene calcolato moltiplicando il consumo giornaliero per persona per il numero di persone e per i giorni dell\'anno.',
        'memorial-example': 'Esempio:',
        'memorial-passo2-title': '2️⃣ Passo 2: Calcolare Area Necessaria per Piante',
        'memorial-passo2-explicacao': 'L\'area necessaria viene calcolata dividendo il consumo annuale totale per la produzione annuale per metro quadrato di ogni tipo di pianta.',
        'memorial-passo3-title': '3️⃣ Passo 3: Calcolare Quantità di Piante',
        'memorial-passo3-explicacao': 'La quantità di piante viene calcolata moltiplicando l\'area necessaria per la densità di semina specifica di ogni tipo di pianta.',
        'memorial-passo4-title': '4️⃣ Passo 4: Calcolare Quantità di Animali',
        'memorial-passo4-explicacao': 'La quantità di animali viene calcolata in base al tipo di produzione: giornaliera (uova, latte) o per ciclo (carne).',
        'memorial-passo5-title': '5️⃣ Passo 5: Calcolare Frequenza di Semina',
        'memorial-passo5-explicacao': 'La frequenza di semina è determinata dal ciclo di crescita di ogni tipo di pianta per mantenere una produzione continua.',
        'memorial-resumo-title': '📊 Riepilogo Calcolato',
        'memorial-resumo-area-plantas': 'Area Totale Piante:',
        'memorial-resumo-area-animais': 'Area Totale Animali:',
        'memorial-resumo-area-total': 'Area Totale:',
        'learn-more': 'SAIBA MAIS!',
        'back': '← Indietro',
        'back-to-calculator': 'Torna al Calcolatore'
    }
};

// ============================================
// FUNÇÕES DE CÁLCULO
// ============================================

function calcularAreaNecessaria(tipo, nome, quantidadePessoas, consumoDiarioPorPessoa) {
    const dados = DADOS_PLANTAS[tipo][nome];
    // consumoDiarioPorPessoa já está em kg/dia/pessoa, converter para kg/ano
    const consumoAnualPorPessoa = consumoDiarioPorPessoa * 365;
    const consumoTotal = consumoAnualPorPessoa * quantidadePessoas;
    const areaNecessaria = consumoTotal / dados.producao;
    return Math.max(areaNecessaria, dados.areaMin);
}

function calcularQuantidadePlantas(tipo, nome, area) {
    const dados = DADOS_PLANTAS[tipo][nome];
    // Estimativa: 1 planta por m² para árvores, mais denso para hortaliças
    if (tipo === 'frutas') {
        return Math.ceil(area / dados.areaMin);
    } else {
        return Math.ceil(area * 4); // 4 plantas/m² para hortaliças
    }
}

function calcularFrequenciaPlantio(ciclo) {
    // Para manter produção contínua, plantar a cada ciclo/2
    const frequencia = Math.ceil(ciclo / 2);
    const vezesAno = Math.floor(365 / frequencia);
    return { frequencia, vezesAno };
}

function calcularAnimaisNecessarios(tipoAnimal, quantidadePessoas, consumoDiarioPorPessoa) {
    const dados = DADOS_ANIMAIS[tipoAnimal];
    let quantidade = 0;
    
    if (tipoAnimal === 'galinha') {
        // Para galinhas, garantir 2 ovos/dia por pessoa (independente do consumo proporcional)
        const ovosPorDiaPorPessoa = 2; // ovos/dia/pessoa
        const ovosPorDiaTotal = ovosPorDiaPorPessoa * quantidadePessoas;
        const ovosPorDiaPorGalinha = dados.producaoDiaria; // ovos/dia por galinha (0.7 ovos/dia)
        quantidade = Math.ceil(ovosPorDiaTotal / ovosPorDiaPorGalinha);
    } else if (tipoAnimal === 'vaca' || tipoAnimal === 'cabrito') {
        // consumoDiarioPorPessoa já está em kg/dia/pessoa (proporcional)
        const consumoDiarioTotal = consumoDiarioPorPessoa * quantidadePessoas; // kg/dia total
        const producaoDiariaPorAnimal = dados.producaoDiaria * dados.producaoPorUnidade; // kg/dia por animal
        quantidade = Math.ceil(consumoDiarioTotal / producaoDiariaPorAnimal);
    } else if (tipoAnimal === 'porco' || tipoAnimal === 'coelho') {
        // consumoDiarioPorPessoa já está em kg/dia/pessoa (proporcional)
        const consumoAnualPorPessoa = consumoDiarioPorPessoa * 365;
        const consumoAnualTotal = consumoAnualPorPessoa * quantidadePessoas;
        const producaoAnual = dados.producaoCiclo * (365 / dados.cicloReprodutivo); // kg/ano por animal
        quantidade = Math.ceil(consumoAnualTotal / producaoAnual);
    } else if (tipoAnimal === 'peixe') {
        // consumoDiarioPorPessoa já está em kg/dia/pessoa (proporcional)
        const consumoAnualPorPessoa = consumoDiarioPorPessoa * 365;
        const consumoAnualTotal = consumoAnualPorPessoa * quantidadePessoas;
        const producaoAnual = dados.producaoCiclo * (365 / dados.cicloReprodutivo); // kg/ano por peixe
        quantidade = Math.ceil(consumoAnualTotal / producaoAnual);
    }
    
    return Math.max(quantidade, 1); // Mínimo 1 animal
}

function calcularAreaAnimais(tipoAnimal, quantidade) {
    const dados = DADOS_ANIMAIS[tipoAnimal];
    return dados.espaco * quantidade;
}

// ============================================
// FUNÇÕES DE INTERFACE
// ============================================

function criarCheckboxPlantas(tipo, nome) {
    const div = document.createElement('label');
    div.className = 'opcao-checkbox';
    const icone = ICONES_PRODUTOS[nome] || '🌱';
    div.innerHTML = `
        <input type="checkbox" class="checkbox-planta" data-tipo="${tipo}" data-nome="${nome}">
        <div class="cartao-checkbox">
            <span class="icone-produto">${icone}</span>
            <span class="rotulo-checkbox" data-i18n="${nome}">${nome}</span>
        </div>
    `;
    return div;
}

function criarCheckboxAnimais(nome) {
    const div = document.createElement('label');
    div.className = 'opcao-checkbox';
    const icone = ICONES_PRODUTOS[nome] || '🐾';
    div.innerHTML = `
        <input type="checkbox" class="checkbox-animal" data-nome="${nome}">
        <div class="cartao-checkbox">
            <span class="icone-produto">${icone}</span>
            <span class="rotulo-checkbox" data-i18n="${nome}">${nome}</span>
        </div>
    `;
    return div;
}

function atualizarResultados() {
    const quantidadePessoas = parseInt(document.getElementById('inputPessoas').value) || 4;
    
    // Ler valores dos sliders de consumo
    const consumoPlantasDiario = parseFloat(document.getElementById('inputConsumoPlantas').value) || 0.5;
    const consumoProteinasDiario = parseFloat(document.getElementById('inputConsumoProteinas').value) || 0.5;
    
    // Coletar plantas selecionadas
    const plantasSelecionadas = {
        frutas: [],
        verduras: [],
        legumes: []
    };
    
    document.querySelectorAll('.checkbox-planta:checked').forEach(cb => {
        const tipo = cb.dataset.tipo;
        const nome = cb.dataset.nome;
        plantasSelecionadas[tipo].push(nome);
    });
    
    // Coletar animais selecionados
    const animaisSelecionados = [];
    document.querySelectorAll('.checkbox-animal:checked').forEach(cb => {
        animaisSelecionados.push(cb.dataset.nome);
    });
    
    // Verificar se há seleções
    const temPlantas = plantasSelecionadas.frutas.length > 0 || 
                       plantasSelecionadas.verduras.length > 0 || 
                       plantasSelecionadas.legumes.length > 0;
    const temAnimais = animaisSelecionados.length > 0;
    
    if (!temPlantas && !temAnimais) {
        document.getElementById('secaoResultados').style.display = 'none';
        return;
    }
    
    document.getElementById('secaoResultados').style.display = 'block';
    
    // Calcular áreas
    let areaTotalPlantas = 0;
    let areaTotalAnimais = 0;
    
    // Contar total de itens selecionados para distribuição proporcional
    const totalItensPlantas = plantasSelecionadas.frutas.length + 
                              plantasSelecionadas.verduras.length + 
                              plantasSelecionadas.legumes.length;
    
    // Separar galinhas dos outros animais (galinhas têm consumo fixo de 2 ovos/dia)
    const temGalinhas = animaisSelecionados.includes('galinha');
    const outrosAnimais = animaisSelecionados.filter(a => a !== 'galinha');
    const totalOutrosAnimais = outrosAnimais.length;
    
    // Usar valores dos sliders para consumo diário
    const CONSUMO_PLANTAS_DIARIO = consumoPlantasDiario; // kg/dia/pessoa (total de frutas+verduras+legumes)
    const CONSUMO_PROTEINA_DIARIO = consumoProteinasDiario; // kg/dia/pessoa (total de proteínas)
    
    // Calcular consumo proporcional por item
    const consumoDiarioPorItemPlanta = totalItensPlantas > 0 ? CONSUMO_PLANTAS_DIARIO / totalItensPlantas : 0;
    
    // Para proteínas: galinhas garantem 2 ovos/dia (0.12 kg/dia), resto é distribuído
    const dadosGalinha = temGalinhas ? DADOS_ANIMAIS['galinha'] : null;
    const consumoGalinhaPorPessoa = temGalinhas ? 2 * dadosGalinha.producaoPorUnidade : 0; // 2 ovos × 0.06 kg = 0.12 kg/dia
    const consumoRestanteProteina = Math.max(0, CONSUMO_PROTEINA_DIARIO - consumoGalinhaPorPessoa);
    const consumoDiarioPorItemAnimal = totalOutrosAnimais > 0 ? consumoRestanteProteina / totalOutrosAnimais : 0;
    
    // Calcular plantas
    const detalhesPlantas = [];
    Object.keys(plantasSelecionadas).forEach(tipo => {
        plantasSelecionadas[tipo].forEach(nome => {
            const area = calcularAreaNecessaria(tipo, nome, quantidadePessoas, consumoDiarioPorItemPlanta);
            areaTotalPlantas += area;
            const quantidade = calcularQuantidadePlantas(tipo, nome, area);
            const dados = DADOS_PLANTAS[tipo][nome];
            const producaoAnual = area * dados.producao;
            const freq = calcularFrequenciaPlantio(dados.ciclo);
            
            // O consumo diário por pessoa já é o valor proporcional
            const consumoDiarioPorPessoa = consumoDiarioPorItemPlanta;
            
            detalhesPlantas.push({
                tipo,
                nome,
                area,
                quantidade,
                producaoAnual,
                consumoDiarioPorPessoa,
                ciclo: dados.ciclo,
                plantio: dados.plantio,
                colheita: dados.colheita,
                frequencia: freq
            });
        });
    });
    
    // Calcular animais
    const detalhesAnimais = [];
    animaisSelecionados.forEach(nome => {
        let consumoDiarioPorPessoa;
        let quantidade;
        
        if (nome === 'galinha') {
            // Galinhas sempre garantem 2 ovos/dia por pessoa
            consumoDiarioPorPessoa = consumoGalinhaPorPessoa; // 0.12 kg/dia (2 ovos)
            quantidade = calcularAnimaisNecessarios(nome, quantidadePessoas, consumoDiarioPorPessoa);
        } else {
            // Outros animais recebem o consumo proporcional do restante
            consumoDiarioPorPessoa = consumoDiarioPorItemAnimal;
            quantidade = calcularAnimaisNecessarios(nome, quantidadePessoas, consumoDiarioPorPessoa);
        }
        
        const area = calcularAreaAnimais(nome, quantidade);
        areaTotalAnimais += area;
        const dados = DADOS_ANIMAIS[nome];
        const freqReprod = Math.floor(365 / dados.cicloReprodutivo);
        
        detalhesAnimais.push({
            nome,
            quantidade,
            area,
            dados,
            freqReprod,
            consumoDiarioPorPessoa
        });
    });
    
    // Atualizar resumo
    const areaTotal = areaTotalPlantas + areaTotalAnimais;
    document.getElementById('areaTotal').textContent = formatarNumeroDecimal(areaTotal, 1) + ' m²';
    document.getElementById('areaPlantas').textContent = formatarNumeroDecimal(areaTotalPlantas, 1) + ' m²';
    document.getElementById('areaAnimais').textContent = formatarNumeroDecimal(areaTotalAnimais, 1) + ' m²';
    
    // Atualizar detalhes de plantas
    if (detalhesPlantas.length > 0) {
        document.getElementById('grupoPlantas').style.display = 'block';
        const div = document.getElementById('detalhesPlantas');
        div.innerHTML = detalhesPlantas.map(p => {
            const icone = ICONES_PRODUTOS[p.nome] || '🌱';
            return `
            <div class="detalhe-item">
                <h4>${icone} ${traduzir(p.nome)}</h4>
                <p><span data-i18n="area-necessaria">Área Necessária:</span> <span class="valor-destaque">${formatarNumeroDecimal(p.area, 1)} m²</span></p>
                <p><span data-i18n="quantidade-plantas">Quantidade de Plantas:</span> <span class="valor-destaque">${p.quantidade} ${traduzir('unidades')}</span></p>
                <p><span data-i18n="producao-anual">Produção Anual:</span> <span class="valor-destaque">${formatarNumeroDecimal(p.producaoAnual, 1)} kg</span></p>
                <p><span data-i18n="consumo-diario-pessoa">Consumo por Pessoa/Dia:</span> <span class="valor-destaque">${formatarNumeroDecimal(p.consumoDiarioPorPessoa, 3)} kg</span></p>
                <p><span data-i18n="ciclo-dias">Ciclo (dias):</span> ${p.ciclo} ${traduzir('dias')}</p>
                <p><span data-i18n="plantio">Época de Plantio:</span> ${p.plantio}</p>
                <p><span data-i18n="colheita">Época de Colheita:</span> ${p.colheita}</p>
                <p><span data-i18n="frequencia-plantio">Frequência de Plantio:</span> <span class="valor-destaque">A cada ${p.frequencia.frequencia} ${traduzir('dias')} (${p.frequencia.vezesAno} ${traduzir('vezes-ano')})</span></p>
            </div>
        `;
        }).join('');
    } else {
        document.getElementById('grupoPlantas').style.display = 'none';
    }
    
    // Atualizar detalhes de animais
    if (detalhesAnimais.length > 0) {
        document.getElementById('grupoAnimaisResultado').style.display = 'block';
        const div = document.getElementById('detalhesAnimais');
        div.innerHTML = detalhesAnimais.map(a => {
            let producaoTexto = '';
            if (a.dados.producaoDiaria > 0) {
                producaoTexto = `<p><span data-i18n="producao-diaria">Produção Diária:</span> <span class="valor-destaque">${a.dados.producaoDiaria} ${a.dados.producaoUnidade}</span></p>`;
            } else {
                producaoTexto = `<p><span data-i18n="producao-diaria">Produção por Ciclo:</span> <span class="valor-destaque">${a.dados.producaoCiclo} ${a.dados.producaoUnidade}</span></p>`;
            }
            
            const icone = ICONES_PRODUTOS[a.nome] || '🐾';
            return `
                <div class="detalhe-item">
                    <h4>${icone} ${traduzir(a.nome)}</h4>
                    <p><span data-i18n="quantidade-animais">Quantidade de Animais:</span> <span class="valor-destaque">${a.quantidade} ${traduzir('unidades')}</span></p>
                    <p><span data-i18n="area-necessaria">Área Necessária:</span> <span class="valor-destaque">${formatarNumeroDecimal(a.area, 1)} m²</span></p>
                    ${producaoTexto}
                    <p><span data-i18n="consumo-diario-pessoa">Consumo por Pessoa/Dia:</span> <span class="valor-destaque">${formatarNumeroDecimal(a.consumoDiarioPorPessoa, 3)} kg</span></p>
                    <p><span data-i18n="espaco-animal">Espaço por Animal:</span> ${a.dados.espaco} m²</p>
                    <p><span data-i18n="ciclo-reprodutivo">Ciclo Reprodutivo:</span> ${a.dados.cicloReprodutivo} ${traduzir('dias')}</p>
                    <p><span data-i18n="frequencia-reproducao">Frequência de Reprodução:</span> <span class="valor-destaque">${a.freqReprod} ${traduzir('vezes-ano')}</span></p>
                </div>
            `;
        }).join('');
    } else {
        document.getElementById('grupoAnimaisResultado').style.display = 'none';
    }
    
    // Atualizar calendário
    if (detalhesPlantas.length > 0) {
        document.getElementById('grupoCalendario').style.display = 'block';
        const div = document.getElementById('detalhesCalendario');
        div.innerHTML = detalhesPlantas.map(p => {
            const icone = ICONES_PRODUTOS[p.nome] || '🌱';
            return `
            <div class="calendario-item">
                <h4>${icone} ${traduzir(p.nome)}</h4>
                <p><strong>${traduzir('plantio')}</strong> ${p.plantio} - ${traduzir('frequencia-plantio')}: A cada ${p.frequencia.frequencia} ${traduzir('dias')}</p>
                <p><strong>${traduzir('colheita')}</strong> ${p.colheita} - ${traduzir('frequencia-colheita')}: A cada ${p.ciclo} ${traduzir('dias')}</p>
            </div>
        `;
        }).join('');
    } else {
        document.getElementById('grupoCalendario').style.display = 'none';
    }
    
    aplicarTraducoes();
}

// ============================================
// MEMORIAL DE CÁLCULO
// ============================================

function atualizarMemorialComValores() {
    const textos = traducoes[idiomaAtual] || traducoes['pt-BR'];
    
    const quantidadePessoas = parseInt(document.getElementById('inputPessoas').value) || 4;
    // Converter valores formatados para números (remove formatação brasileira)
    const inputConsumoPlantas = document.getElementById('inputConsumoPlantas');
    const inputConsumoProteinas = document.getElementById('inputConsumoProteinas');
    const consumoPlantasDiario = inputConsumoPlantas ? parseFloat(inputConsumoPlantas.value.replace(/\./g, '').replace(',', '.')) || 0.5 : 0.5;
    const consumoProteinasDiario = inputConsumoProteinas ? parseFloat(inputConsumoProteinas.value.replace(/\./g, '').replace(',', '.')) || 0.5 : 0.5;
    
    // Coletar plantas selecionadas
    const plantasSelecionadas = {
        frutas: [],
        verduras: [],
        legumes: []
    };
    
    document.querySelectorAll('.checkbox-planta:checked').forEach(cb => {
        const tipo = cb.dataset.tipo;
        const nome = cb.dataset.nome;
        plantasSelecionadas[tipo].push(nome);
    });
    
    // Coletar animais selecionados
    const animaisSelecionados = [];
    document.querySelectorAll('.checkbox-animal:checked').forEach(cb => {
        animaisSelecionados.push(cb.dataset.nome);
    });
    
    const temPlantas = plantasSelecionadas.frutas.length > 0 || 
                       plantasSelecionadas.verduras.length > 0 || 
                       plantasSelecionadas.legumes.length > 0;
    const temAnimais = animaisSelecionados.length > 0;
    
    if (!temPlantas && !temAnimais) {
        return;
    }
    
    // Calcular áreas
    let areaTotalPlantas = 0;
    let areaTotalAnimais = 0;
    
    const totalItensPlantas = plantasSelecionadas.frutas.length + 
                              plantasSelecionadas.verduras.length + 
                              plantasSelecionadas.legumes.length;
    
    const temGalinhas = animaisSelecionados.includes('galinha');
    const outrosAnimais = animaisSelecionados.filter(a => a !== 'galinha');
    const totalOutrosAnimais = outrosAnimais.length;
    
    const consumoDiarioPorItemPlanta = totalItensPlantas > 0 ? consumoPlantasDiario / totalItensPlantas : 0;
    
    const dadosGalinha = temGalinhas ? DADOS_ANIMAIS['galinha'] : null;
    const consumoGalinhaPorPessoa = temGalinhas ? 2 * dadosGalinha.producaoPorUnidade : 0;
    const consumoRestanteProteina = Math.max(0, consumoProteinasDiario - consumoGalinhaPorPessoa);
    const consumoDiarioPorItemAnimal = totalOutrosAnimais > 0 ? consumoRestanteProteina / totalOutrosAnimais : 0;
    
    // Calcular plantas
    Object.keys(plantasSelecionadas).forEach(tipo => {
        plantasSelecionadas[tipo].forEach(nome => {
            const area = calcularAreaNecessaria(tipo, nome, quantidadePessoas, consumoDiarioPorItemPlanta);
            areaTotalPlantas += area;
        });
    });
    
    // Calcular animais
    animaisSelecionados.forEach(nome => {
        let consumoDiarioPorPessoa;
        
        if (nome === 'galinha') {
            consumoDiarioPorPessoa = consumoGalinhaPorPessoa;
        } else {
            consumoDiarioPorPessoa = consumoDiarioPorItemAnimal;
        }
        
        const quantidade = calcularAnimaisNecessarios(nome, quantidadePessoas, consumoDiarioPorPessoa);
        const area = calcularAreaAnimais(nome, quantidade);
        areaTotalAnimais += area;
    });
    
    const areaTotal = areaTotalPlantas + areaTotalAnimais;
    
    // Calcular consumo anual total
    const consumoAnualPlantas = consumoPlantasDiario * quantidadePessoas * 365;
    const consumoAnualProteinas = consumoProteinasDiario * quantidadePessoas * 365;
    
    // Atualizar exemplos no memorial
    const exemploConsumo = `${formatarNumeroDecimal(consumoPlantasDiario, 1)} kg/dia/pessoa × ${quantidadePessoas} pessoas × 365 dias = ${formatarNumeroDecimal(consumoAnualPlantas, 0)} kg/ano`;
    
    // Exemplo de área (usar primeira planta selecionada se houver)
    let exemploArea = '-';
    if (totalItensPlantas > 0) {
        const primeiraPlanta = plantasSelecionadas.frutas[0] || plantasSelecionadas.verduras[0] || plantasSelecionadas.legumes[0];
        const tipoPrimeira = plantasSelecionadas.frutas[0] ? 'frutas' : (plantasSelecionadas.verduras[0] ? 'verduras' : 'legumes');
        const dados = DADOS_PLANTAS[tipoPrimeira][primeiraPlanta];
        const consumoAnualItem = consumoDiarioPorItemPlanta * quantidadePessoas * 365;
        const areaItem = consumoAnualItem / dados.producao;
        exemploArea = `${formatarNumeroDecimal(consumoAnualItem, 0)} kg/ano ÷ ${dados.producao} kg/m²·ano = ${formatarNumeroDecimal(areaItem, 1)} m²`;
    }
    
    // Exemplo de quantidade de plantas
    let exemploQuantidade = '-';
    if (totalItensPlantas > 0) {
        const primeiraPlanta = plantasSelecionadas.frutas[0] || plantasSelecionadas.verduras[0] || plantasSelecionadas.legumes[0];
        const tipoPrimeira = plantasSelecionadas.frutas[0] ? 'frutas' : (plantasSelecionadas.verduras[0] ? 'verduras' : 'legumes');
        const dados = DADOS_PLANTAS[tipoPrimeira][primeiraPlanta];
        const consumoAnualItem = consumoDiarioPorItemPlanta * quantidadePessoas * 365;
        const areaItem = Math.max(consumoAnualItem / dados.producao, dados.areaMin);
        const quantidadeItem = calcularQuantidadePlantas(tipoPrimeira, primeiraPlanta, areaItem);
        const densidade = tipoPrimeira === 'frutas' ? (1 / dados.areaMin) : 4;
        exemploQuantidade = `${formatarNumeroDecimal(areaItem, 1)} m² × ${densidade} plantas/m² = ${quantidadeItem} plantas`;
    }
    
    // Exemplo de animais
    let exemploAnimais = '-';
    if (temGalinhas) {
        const ovosPorDiaTotal = 2 * quantidadePessoas;
        const ovosPorDiaPorGalinha = dadosGalinha.producaoDiaria;
        const quantidadeGalinhas = Math.ceil(ovosPorDiaTotal / ovosPorDiaPorGalinha);
        exemploAnimais = `Para ${2} ovos/dia/pessoa: ${ovosPorDiaTotal} ovos/dia ÷ ${formatarNumeroDecimal(ovosPorDiaPorGalinha, 1)} ovos/dia/galinha = ${quantidadeGalinhas} galinhas`;
    } else if (totalOutrosAnimais > 0) {
        const primeiroAnimal = outrosAnimais[0];
        const dados = DADOS_ANIMAIS[primeiroAnimal];
        const consumoAnualItem = consumoDiarioPorItemAnimal * quantidadePessoas * 365;
        if (dados.producaoDiaria > 0) {
            const producaoDiariaPorAnimal = dados.producaoDiaria * dados.producaoPorUnidade;
            const quantidade = Math.ceil((consumoDiarioPorItemAnimal * quantidadePessoas) / producaoDiariaPorAnimal);
            exemploAnimais = `${formatarNumeroDecimal(consumoDiarioPorItemAnimal * quantidadePessoas, 2)} kg/dia ÷ ${formatarNumeroDecimal(producaoDiariaPorAnimal, 2)} kg/dia/animal = ${quantidade} ${primeiroAnimal}`;
        } else {
            const producaoAnual = dados.producaoCiclo * (365 / dados.cicloReprodutivo);
            const quantidade = Math.ceil(consumoAnualItem / producaoAnual);
            exemploAnimais = `${formatarNumeroDecimal(consumoAnualItem, 0)} kg/ano ÷ ${formatarNumeroDecimal(producaoAnual, 0)} kg/ano/animal = ${quantidade} ${primeiroAnimal}`;
        }
    }
    
    // Exemplo de frequência
    let exemploFrequencia = '-';
    if (totalItensPlantas > 0) {
        const primeiraPlanta = plantasSelecionadas.frutas[0] || plantasSelecionadas.verduras[0] || plantasSelecionadas.legumes[0];
        const tipoPrimeira = plantasSelecionadas.frutas[0] ? 'frutas' : (plantasSelecionadas.verduras[0] ? 'verduras' : 'legumes');
        const dados = DADOS_PLANTAS[tipoPrimeira][primeiraPlanta];
        const freq = calcularFrequenciaPlantio(dados.ciclo);
        exemploFrequencia = `Ciclo de ${dados.ciclo} dias → plantio a cada ${freq.frequencia} dias → ${freq.vezesAno} vezes por ano`;
    }
    
    // Atualizar HTML do memorial
    document.getElementById('memorial-exemplo-consumo').textContent = exemploConsumo;
    document.getElementById('memorial-exemplo-area-plantas').textContent = exemploArea;
    document.getElementById('memorial-exemplo-quantidade-plantas').textContent = exemploQuantidade;
    document.getElementById('memorial-exemplo-animais').textContent = exemploAnimais;
    document.getElementById('memorial-exemplo-frequencia').textContent = exemploFrequencia;
    
    // Atualizar resumo
    document.getElementById('resumo-area-plantas').textContent = formatarNumeroDecimal(areaTotalPlantas, 1) + ' m²';
    document.getElementById('resumo-area-animais').textContent = formatarNumeroDecimal(areaTotalAnimais, 1) + ' m²';
    document.getElementById('resumo-area-total').textContent = formatarNumeroDecimal(areaTotal, 1) + ' m²';
}

function toggleMemorial() {
    const memorialSection = document.getElementById('memorialSection');
    const entradasSection = document.getElementById('secaoEntradas');
    const resultadosSection = document.getElementById('secaoResultados');
    
    if (!memorialSection) {
        console.error('memorialSection não encontrado');
        return;
    }
    
    if (memorialSection.style.display === 'none' || memorialSection.style.display === '') {
        // Abrir memorial
        memorialSection.style.display = 'block';
        if (entradasSection) entradasSection.style.display = 'none';
        if (resultadosSection) resultadosSection.style.display = 'none';
        atualizarMemorialComValores();
        // Rolar para o topo da seção do memorial
        setTimeout(() => {
            memorialSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    } else {
        // Fechar memorial
        memorialSection.style.display = 'none';
        // Sempre mostrar a seção de entradas quando fechar o memorial
        if (entradasSection) {
            entradasSection.style.display = 'block';
        }
        // Mostrar resultados apenas se tiver conteúdo
        if (resultadosSection && resultadosSection.innerHTML.trim() !== '') {
            resultadosSection.style.display = 'block';
        }
    }
}

// ============================================
// TRADUÇÃO
// ============================================

let idiomaAtual = 'pt-BR';

function traduzir(chave) {
    return traducoes[idiomaAtual][chave] || chave;
}

function aplicarTraducoes() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const chave = el.getAttribute('data-i18n');
        const texto = traduzir(chave);
        if (el.tagName === 'INPUT' && el.type === 'text') {
            // Não traduzir valores de input
        } else {
            el.textContent = texto;
        }
    });
}

function trocarIdioma(novoIdioma) {
    idiomaAtual = novoIdioma;
    // Salvar preferência no localStorage
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    aplicarTraducoes();
    
    // Atualizar botões de idioma
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.lang === novoIdioma) {
            btn.classList.add('active');
        }
    });
    
    atualizarResultados();
}

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Carregar idioma salvo do localStorage
    const idiomaSalvo = localStorage.getItem(SITE_LS.LANGUAGE_KEY);
    if (idiomaSalvo && (idiomaSalvo === 'pt-BR' || idiomaSalvo === 'it-IT')) {
        idiomaAtual = idiomaSalvo;
        trocarIdioma(idiomaSalvo);
    }
    
    // Criar checkboxes de plantas
    Object.keys(DADOS_PLANTAS.frutas).forEach(nome => {
        document.getElementById('grupoFrutas').appendChild(criarCheckboxPlantas('frutas', nome));
    });
    Object.keys(DADOS_PLANTAS.verduras).forEach(nome => {
        document.getElementById('grupoVerduras').appendChild(criarCheckboxPlantas('verduras', nome));
    });
    Object.keys(DADOS_PLANTAS.legumes).forEach(nome => {
        document.getElementById('grupoLegumes').appendChild(criarCheckboxPlantas('legumes', nome));
    });
    
    // Criar checkboxes de animais
    Object.keys(DADOS_ANIMAIS).forEach(nome => {
        document.getElementById('grupoAnimais').appendChild(criarCheckboxAnimais(nome));
    });
    
    // Event listeners para pessoas
    const sliderPessoas = document.getElementById('sliderPessoas');
    const inputPessoas = document.getElementById('inputPessoas');
    
    sliderPessoas.addEventListener('input', () => {
        inputPessoas.value = sliderPessoas.value;
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPessoas);
        atualizarResultados();
    });
    
    inputPessoas.addEventListener('input', () => {
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPessoas);
        let valor = parseInt(inputPessoas.value) || 1;
        valor = Math.max(1, Math.min(20, valor));
        inputPessoas.value = valor;
        sliderPessoas.value = valor;
        atualizarResultados();
    });
    
    // Event listeners para consumo de plantas
    const sliderConsumoPlantas = document.getElementById('sliderConsumoPlantas');
    const inputConsumoPlantas = document.getElementById('inputConsumoPlantas');
    
    sliderConsumoPlantas.addEventListener('input', () => {
        inputConsumoPlantas.value = formatarNumeroDecimal(parseFloat(sliderConsumoPlantas.value), 1);
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumoPlantas);
        atualizarResultados();
    });
    
    inputConsumoPlantas.addEventListener('input', () => {
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumoPlantas);
        let valor = parseFloat(inputConsumoPlantas.value.replace(',', '.')) || 0.1;
        valor = Math.max(0.1, Math.min(2.0, valor));
        inputConsumoPlantas.value = formatarNumeroDecimal(valor, 1);
        sliderConsumoPlantas.value = valor;
        atualizarResultados();
    });
    
    // Event listeners para consumo de proteínas
    const sliderConsumoProteinas = document.getElementById('sliderConsumoProteinas');
    const inputConsumoProteinas = document.getElementById('inputConsumoProteinas');
    
    sliderConsumoProteinas.addEventListener('input', () => {
        inputConsumoProteinas.value = formatarNumeroDecimal(parseFloat(sliderConsumoProteinas.value), 1);
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumoProteinas);
        atualizarResultados();
    });
    
    inputConsumoProteinas.addEventListener('input', () => {
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumoProteinas);
        let valor = parseFloat(inputConsumoProteinas.value.replace(',', '.')) || 0.1;
        valor = Math.max(0.1, Math.min(2.0, valor));
        inputConsumoProteinas.value = formatarNumeroDecimal(valor, 1);
        sliderConsumoProteinas.value = valor;
        atualizarResultados();
    });
    
    // Botões de seta
    document.querySelectorAll('.arrow-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.target);
            const step = parseFloat(btn.dataset.step);
            const novoValor = parseFloat(target.value) + step;
            const min = parseFloat(target.min);
            const max = parseFloat(target.max);
            const valorLimitado = Math.max(min, Math.min(max, novoValor));
            target.value = valorLimitado;
            
            // Atualizar o input correspondente
            if (target.id === 'sliderPessoas') {
                inputPessoas.value = valorLimitado;
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPessoas);
            } else if (target.id === 'sliderConsumoPlantas') {
                inputConsumoPlantas.value = formatarNumeroDecimal(valorLimitado, 1);
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumoPlantas);
            } else if (target.id === 'sliderConsumoProteinas') {
                inputConsumoProteinas.value = formatarNumeroDecimal(valorLimitado, 1);
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumoProteinas);
            }
            
            atualizarResultados();
        });
    });
    
    // Checkboxes de plantas e animais
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('checkbox-planta') || e.target.classList.contains('checkbox-animal')) {
            atualizarResultados();
        }
    });
    
    // Botões de idioma
    document.getElementById('btnPortugues').addEventListener('click', () => trocarIdioma('pt-BR'));
    document.getElementById('btnItaliano').addEventListener('click', () => trocarIdioma('it-IT'));
    
    // Event listeners para o memorial de cálculo
    document.getElementById('btnMemorial')?.addEventListener('click', toggleMemorial);
    document.getElementById('btnFecharMemorial')?.addEventListener('click', toggleMemorial);
    document.querySelectorAll('.btn-voltar-memorial').forEach(btn => {
        btn.addEventListener('click', toggleMemorial);
    });
    
    // Aplicar traduções iniciais
    aplicarTraducoes();
    document.getElementById('btnPortugues').classList.add('active');
    
    // Garantir que a seção de entradas esteja visível no carregamento
    const entradasSection = document.getElementById('secaoEntradas');
    if (entradasSection) {
        entradasSection.style.display = 'block';
    }
    
    // Garantir que o memorial esteja escondido no carregamento
    const memorialSection = document.getElementById('memorialSection');
    if (memorialSection) {
        memorialSection.style.display = 'none';
    }
    
    // Ajustar tamanho inicial de todos os inputs
    if (typeof ajustarTamanhoInput === 'function') {
        const inputPessoas = document.getElementById('inputPessoas');
        const inputConsumoPlantas = document.getElementById('inputConsumoPlantas');
        const inputConsumoProteinas = document.getElementById('inputConsumoProteinas');
        if (inputPessoas) ajustarTamanhoInput(inputPessoas);
        if (inputConsumoPlantas) ajustarTamanhoInput(inputConsumoPlantas);
        if (inputConsumoProteinas) ajustarTamanhoInput(inputConsumoProteinas);
    }
});

