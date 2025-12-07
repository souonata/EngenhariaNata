// fazenda-script.js - Lógica do Dimensionador de Fazenda Auto-Sustentável

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
        'footer-text': 'Engenharia NATA © 2024 - Apps Educativos de Engenharia',
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
        'vezes-ano': 'vezes/ano'
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
        'footer-text': 'Engenharia NATA © 2024 - App Educativi di Ingegneria',
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
        'vezes-ano': 'volte/anno'
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
    document.getElementById('areaTotal').textContent = areaTotal.toFixed(1) + ' m²';
    document.getElementById('areaPlantas').textContent = areaTotalPlantas.toFixed(1) + ' m²';
    document.getElementById('areaAnimais').textContent = areaTotalAnimais.toFixed(1) + ' m²';
    
    // Atualizar detalhes de plantas
    if (detalhesPlantas.length > 0) {
        document.getElementById('grupoPlantas').style.display = 'block';
        const div = document.getElementById('detalhesPlantas');
        div.innerHTML = detalhesPlantas.map(p => {
            const icone = ICONES_PRODUTOS[p.nome] || '🌱';
            return `
            <div class="detalhe-item">
                <h4>${icone} ${traduzir(p.nome)}</h4>
                <p><span data-i18n="area-necessaria">Área Necessária:</span> <span class="valor-destaque">${p.area.toFixed(1)} m²</span></p>
                <p><span data-i18n="quantidade-plantas">Quantidade de Plantas:</span> <span class="valor-destaque">${p.quantidade} ${traduzir('unidades')}</span></p>
                <p><span data-i18n="producao-anual">Produção Anual:</span> <span class="valor-destaque">${p.producaoAnual.toFixed(1)} kg</span></p>
                <p><span data-i18n="consumo-diario-pessoa">Consumo por Pessoa/Dia:</span> <span class="valor-destaque">${p.consumoDiarioPorPessoa.toFixed(3)} kg</span></p>
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
                    <p><span data-i18n="area-necessaria">Área Necessária:</span> <span class="valor-destaque">${a.area.toFixed(1)} m²</span></p>
                    ${producaoTexto}
                    <p><span data-i18n="consumo-diario-pessoa">Consumo por Pessoa/Dia:</span> <span class="valor-destaque">${a.consumoDiarioPorPessoa.toFixed(3)} kg</span></p>
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
        atualizarResultados();
    });
    
    inputPessoas.addEventListener('input', () => {
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
        inputConsumoPlantas.value = parseFloat(sliderConsumoPlantas.value).toFixed(1);
        atualizarResultados();
    });
    
    inputConsumoPlantas.addEventListener('input', () => {
        let valor = parseFloat(inputConsumoPlantas.value) || 0.1;
        valor = Math.max(0.1, Math.min(2.0, valor));
        inputConsumoPlantas.value = valor.toFixed(1);
        sliderConsumoPlantas.value = valor;
        atualizarResultados();
    });
    
    // Event listeners para consumo de proteínas
    const sliderConsumoProteinas = document.getElementById('sliderConsumoProteinas');
    const inputConsumoProteinas = document.getElementById('inputConsumoProteinas');
    
    sliderConsumoProteinas.addEventListener('input', () => {
        inputConsumoProteinas.value = parseFloat(sliderConsumoProteinas.value).toFixed(1);
        atualizarResultados();
    });
    
    inputConsumoProteinas.addEventListener('input', () => {
        let valor = parseFloat(inputConsumoProteinas.value) || 0.1;
        valor = Math.max(0.1, Math.min(2.0, valor));
        inputConsumoProteinas.value = valor.toFixed(1);
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
            } else if (target.id === 'sliderConsumoPlantas') {
                inputConsumoPlantas.value = valorLimitado.toFixed(1);
            } else if (target.id === 'sliderConsumoProteinas') {
                inputConsumoProteinas.value = valorLimitado.toFixed(1);
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
    
    // Aplicar traduções iniciais
    aplicarTraducoes();
    document.getElementById('btnPortugues').classList.add('active');
});

