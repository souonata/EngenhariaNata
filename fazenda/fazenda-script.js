// DIMENSIONADOR DE FAZENDA AUTO-SUSTENTÁVEL
//
// Comentários didáticos em Português - Visão geral do algoritmo
// -------------------------------------------------------------
// Objetivo: planejar uma fazenda auto-sustentável que produza todos os
// alimentos necessários para uma família, incluindo:
//  - Cálculo de espaço necessário (área total em m²)
//  - Quantidade de plantas (frutas, verduras, legumes) necessárias
//  - Quantidade de animais necessários
//  - Calendário de plantio e colheita
//  - Frequência de reprodução animal
//  - Consumo diário por pessoa
//
// Características Principais:
//  - Seleção de múltiplos tipos de plantas e animais
//  - Cálculo de produção mínima por pessoa/dia (configurável via sliders)
//  - Distribuição proporcional da produção entre itens selecionados
//  - Cálculo de ciclos de plantio para manter produção contínua
//  - Consideração de épocas de plantio e colheita
//  - Cálculo de espaço necessário por tipo de planta/animal
//  - Consumo fixo para alguns itens
//  - Consumo proporcional para outros itens
//
// Fórmulas Principais:
//  - Produção Mínima Total = Produção por Pessoa/Dia × Número de Pessoas
//  - Produção por Item = Produção Mínima Total ÷ Número de Itens Selecionados
//  - Quantidade de Plantas = Produção por Item ÷ (Produção por m²/ano ÷ 365)
//  - Área Necessária = Quantidade de Plantas × Espaço por Planta
//  - Frequência de Plantio = Ciclo de Plantio ÷ 2 (para sobreposição)
//
//  - Alguns itens têm consumo fixo garantido
//  - Outros itens recebem produção restante distribuída proporcionalmente
//  - O calendário considera épocas de plantio e colheita de cada cultura
//  - A reprodução animal é calculada para manter produção contínua
// FUNÇÕES DE FORMATAÇÃO
// Função formatarNumeroDecimal agora está em assets/js/site-config.js
// ÍCONES DOS PRODUTOS

const ICONES_PRODUTOS = {
    // Frutas - Brasil
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
    'jabuticaba': '🫐',
    'pitanga': '🍒',
    'caju': '🥭',
    'acerola': '🍒',
    'coco': '🥥',
    // Frutas - Itália
    'oliva': '🫒',
    'figo': '🫒',
    'pesca': '🍑',
    'albicocca': '🍑',
    'prugna': '🟣',
    'pera': '🍐',
    'mela': '🍎',
    'kiwi': '🥝',
    'castagna': '🌰',
    // Verduras - Brasil
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
    'coentro': '🌿',
    'manjericao': '🌿',
    // Verduras - Itália
    'lattuga': '🥬',
    'spinaci': '🥬',
    'cavolo': '🥬',
    'broccoli': '🥦',
    'cavolfiore': '🥦',
    'bietola': '🥬',
    'prezzemolo': '🌿',
    'basilico': '🌿',
    'rosmarino': '🌿',
    'origano': '🌿',
    // Legumes - Brasil
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
    'quiabo': '🥒',
    'maxixe': '🥒',
    // Legumes - Itália
    'pomodoro': '🍅',
    'carota': '🥕',
    'barbabietola': '🟣',
    'zucchina': '🥒',
    'peperone': '🫑',
    'melanzana': '🍆',
    'fagioli': '🫘',
    'ceci': '🫘',
    'lenticchie': '🫘',
    'cipolla': '🧅',
    'fagiolini': '🫘',
    // Animais - Brasil
    'galinha-ovos': '🥚',
    'frango-corte': '🍗',
    'porco': '🐷',
    'vaca-leite': '🥛',
    'vaca-corte': '🥩',
    'cabrito': '🐐',
    'coelho': '🐰',
    'peixe': '🐟',
    'patos': '🦆',
    // Animais - Itália
    'gallina-ovos': '🥚',
    'pollo-corte': '🍗',
    'maiale': '🐷',
    'mucca-latte': '🥛',
    'mucca-carne': '🥩',
    'capra': '🐐',
    'coniglio': '🐰',
    'pecora': '🐑',
    'anatra-ovos': '🥚',
    'anatra-corte': '🍗'
};
// DADOS DE PRODUÇÃO
// Os dados vêm EXCLUSIVAMENTE do banco de dados regional (fazenda-database.js)
// Estas variáveis serão preenchidas dinamicamente baseadas no idioma selecionado
// NÃO há dados hardcoded aqui - tudo vem do banco de dados

let DADOS_PLANTAS = {
    frutas: {},
    verduras: {},
    legumes: {}
};

let DADOS_ANIMAIS = {};
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
// TRADUÇÕES

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
        // Nomes de plantas e animais - Brasil
        'banana': 'Banana', 'manga': 'Manga', 'laranja': 'Laranja', 'limao': 'Limão',
        'abacate': 'Abacate', 'mamao': 'Mamão', 'goiaba': 'Goiaba', 'maracuja': 'Maracujá',
        'uva': 'Uva', 'acai': 'Açaí', 'jabuticaba': 'Jabuticaba', 'pitanga': 'Pitanga',
        'caju': 'Caju', 'acerola': 'Acerola', 'coco': 'Coco',
        'alface': 'Alface', 'couve': 'Couve', 'espinafre': 'Espinafre', 'rucula': 'Rúcula',
        'agriao': 'Agrião', 'repolho': 'Repolho', 'brocolis': 'Brócolis', 'couve-flor': 'Couve-flor',
        'acelga': 'Acelga', 'salsinha': 'Salsinha', 'coentro': 'Coentro', 'manjericao': 'Manjericão',
        'tomate': 'Tomate', 'cenoura': 'Cenoura', 'beterraba': 'Beterraba', 'abobora': 'Abóbora',
        'abobrinha': 'Abobrinha', 'pepino': 'Pepino', 'pimentao': 'Pimentão', 'berinjela': 'Berinjela',
        'feijao': 'Feijão', 'milho': 'Milho', 'batata': 'Batata', 'cebola': 'Cebola', 'alho': 'Alho',
        'quiabo': 'Quiabo', 'maxixe': 'Maxixe',
        'galinha-ovos': 'Galinha (Ovos)', 'frango-corte': 'Frango de Corte',
        'porco': 'Porco', 'vaca-leite': 'Vaca (Leite)', 'vaca-corte': 'Vaca (Carne)', 'cabrito': 'Cabrito',
        'coelho': 'Coelho', 'peixe': 'Peixe', 'patos': 'Patos',
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
        'back-to-calculator': 'Voltar para a Calculadora',
        'ver-info-tecnica': 'Ver Informações Técnicas',
        'tecnica-cultivo': 'Técnica de Cultivo',
        'tecnica-criacao': 'Técnica de Criação',
        'clima': 'Clima Ideal',
        'solo': 'Tipo de Solo',
        'alimentacao': 'Alimentação',
        'tempo-crescimento': 'Tempo até Produção',
        'consumo-racao': 'Consumo de Ração',
        'ocultar-info-tecnica': 'Ocultar Informações Técnicas',
        // Placeholders para chaves presentes em IT-IT mas faltando em PT-BR
        'oliva': 'Azeitona', 'figo': 'Figo', 'pesca': 'Pêssego', 'albicocca': 'Damasco',
        'prugna': 'Ameixa', 'pera': 'Pera', 'mela': 'Maçã', 'limone': 'Limão',
        'arancia': 'Laranja', 'kiwi': 'Kiwi', 'castagna': 'Castanha',
        'lattuga': 'Alface', 'spinaci': 'Espinafre', 'rucola': 'Rúcula', 'cavolo': 'Couve',
        'broccoli': 'Brócolis', 'cavolfiore': 'Couve-flor', 'bietola': 'Acelga',
        'prezzemolo': 'Salsinha', 'basilico': 'Manjericão', 'rosmarino': 'Alecrim',
        'origano': 'Orégano', 'pomodoro': 'Tomate', 'carota': 'Cenoura',
        'barbabietola': 'Beterraba', 'zucchina': 'Abobrinha', 'peperone': 'Pimentão',
        'melanzana': 'Berinjela', 'fagioli': 'Feijão', 'ceci': 'Grão-de-bico',
        'lenticchie': 'Lentilhas', 'cipolla': 'Cebola', 'aglio': 'Alho', 'patata': 'Batata',
        'fagiolini': 'Vagem',
        'gallina-ovos': 'Galinha (Ovos)', 'pollo-corte': 'Frango de Corte', 'maiale': 'Porco',
        'mucca-latte': 'Vaca (Leite)', 'mucca-carne': 'Vaca (Carne)', 'capra': 'Cabra',
        'coniglio': 'Coelho', 'pecora': 'Ovelha', 'anatra-ovos': 'Pato (Ovos)', 'anatra-corte': 'Pato (Carne)'
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
        // Nomes de plantas e animais - Itália
        'uva': 'Uva', 'oliva': 'Oliva', 'figo': 'Fico', 'pesca': 'Pesca',
        'albicocca': 'Albicocca', 'prugna': 'Prugna', 'pera': 'Pera', 'mela': 'Mela',
        'limone': 'Limone', 'arancia': 'Arancia', 'kiwi': 'Kiwi', 'castagna': 'Castagna',
        'lattuga': 'Lattuga', 'spinaci': 'Spinaci', 'rucola': 'Rucola', 'cavolo': 'Cavolo',
        'rucula': 'Rucola',
        'broccoli': 'Broccoli', 'cavolfiore': 'Cavolfiore', 'bietola': 'Bietola',
        'prezzemolo': 'Prezzemolo', 'basilico': 'Basilico', 'rosmarino': 'Rosmarino', 'origano': 'Origano',
        'pomodoro': 'Pomodoro', 'carota': 'Carota', 'barbabietola': 'Barbabietola', 'zucchina': 'Zucchina',
        'peperone': 'Peperone', 'melanzana': 'Melanzana', 'fagioli': 'Fagioli', 'ceci': 'Ceci',
        'lenticchie': 'Lenticchie', 'cipolla': 'Cipolla', 'aglio': 'Aglio', 'patata': 'Patata',
        'fagiolini': 'Fagiolini',
        'gallina-ovos': 'Gallina (Uova)', 'pollo-corte': 'Pollo da Carne',
        'maiale': 'Maiale', 'mucca-latte': 'Mucca (Latte)', 'mucca-carne': 'Mucca (Carne)', 'capra': 'Capra',
        'coniglio': 'Coniglio', 'pecora': 'Pecora (Latte)', 'anatra-ovos': 'Anatra (Uova)', 'anatra-corte': 'Anatra (Carne)',
        // Traduções para produtos brasileiros quando em italiano
        'banana': 'Banana', 'manga': 'Mango', 'laranja': 'Arancia', 'limao': 'Limone',
        'abacate': 'Avocado', 'mamao': 'Papaya', 'goiaba': 'Guava', 'maracuja': 'Maracuja',
        'acai': 'Açaí', 'jabuticaba': 'Jabuticaba', 'pitanga': 'Pitanga', 'caju': 'Anacardo',
        'acerola': 'Acerola', 'coco': 'Cocco',
        'alface': 'Lattuga', 'couve': 'Cavolo', 'espinafre': 'Spinaci', 'agriao': 'Crescione',
        'repolho': 'Cavolo Cappuccio', 'brocolis': 'Broccoli', 'couve-flor': 'Cavolfiore',
        'acelga': 'Bietola', 'salsinha': 'Prezzemolo', 'coentro': 'Coriandolo', 'manjericao': 'Basilico',
        'tomate': 'Pomodoro', 'cenoura': 'Carota', 'beterraba': 'Barbabietola', 'abobora': 'Zucca',
        'abobrinha': 'Zucchina', 'pepino': 'Cetriolo', 'pimentao': 'Peperone', 'berinjela': 'Melanzana',
        'feijao': 'Fagioli', 'milho': 'Mais', 'batata': 'Patata', 'cebola': 'Cipolla', 'alho': 'Aglio',
        'quiabo': 'Gombo', 'maxixe': 'Cetriolo Africano',
        'galinha-ovos': 'Gallina (Uova)', 'frango-corte': 'Pollo da Carne',
        'porco': 'Maiale', 'vaca-leite': 'Mucca (Latte)', 'vaca-corte': 'Mucca (Carne)', 'cabrito': 'Capretto',
        'coelho': 'Coniglio', 'peixe': 'Pesce', 'patos': 'Anatre',
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
        'back-to-calculator': 'Torna al Calcolatore',
        'ver-info-tecnica': 'Vedi Informazioni Tecniche',
        'tecnica-cultivo': 'Tecnica di Coltivazione',
        'tecnica-criacao': 'Tecnica di Allevamento',
        'clima': 'Clima Ideale',
        'solo': 'Tipo di Terreno',
        'alimentacao': 'Alimentazione',
        'tempo-crescimento': 'Tempo fino alla Produzione',
        'consumo-racao': 'Consumo di Mangime',
        'ocultar-info-tecnica': 'Nascondi Informazioni Tecniche'
    }
};
// FUNÇÕES DE CÁLCULO

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
    
    if (tipoAnimal === 'galinha-ovos' || tipoAnimal === 'gallina-ovos' || tipoAnimal === 'anatra-ovos') {
        // Para galinhas e patos poedeiros, garantir 2 ovos/dia por pessoa (independente do consumo proporcional)
        const ovosPorDiaPorPessoa = 2; // ovos/dia/pessoa
        const ovosPorDiaTotal = ovosPorDiaPorPessoa * quantidadePessoas;
        const ovosPorDiaPorAnimal = dados.producaoDiaria; // ovos/dia por animal
        quantidade = Math.ceil(ovosPorDiaTotal / ovosPorDiaPorAnimal);
    } else if (tipoAnimal === 'frango-corte' || tipoAnimal === 'pollo-corte') {
        // Para frangos de corte, calcular baseado no consumo de carne
        const consumoAnualPorPessoa = consumoDiarioPorPessoa * 365;
        const consumoAnualTotal = consumoAnualPorPessoa * quantidadePessoas;
        const producaoAnual = dados.producaoCiclo * (365 / dados.cicloReprodutivo); // kg/ano por frango
        quantidade = Math.ceil(consumoAnualTotal / producaoAnual);
    } else if (tipoAnimal === 'vaca-leite' || tipoAnimal === 'mucca-latte' || tipoAnimal === 'cabrito' || tipoAnimal === 'capra' || tipoAnimal === 'pecora') {
        // Animais que produzem leite diariamente
        // consumoDiarioPorPessoa já está em kg/dia/pessoa (proporcional)
        const consumoDiarioTotal = consumoDiarioPorPessoa * quantidadePessoas; // kg/dia total
        const producaoDiariaPorAnimal = dados.producaoDiaria * dados.producaoPorUnidade; // kg/dia por animal
        quantidade = Math.ceil(consumoDiarioTotal / producaoDiariaPorAnimal);
    } else if (tipoAnimal === 'vaca-corte' || tipoAnimal === 'mucca-carne') {
        // Vacas de corte - produção por ciclo
        const consumoAnualPorPessoa = consumoDiarioPorPessoa * 365;
        const consumoAnualTotal = consumoAnualPorPessoa * quantidadePessoas;
        const producaoAnual = dados.producaoCiclo * (365 / dados.cicloReprodutivo); // kg/ano por animal
        quantidade = Math.ceil(consumoAnualTotal / producaoAnual);
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
// FUNÇÕES DE INTERFACE

function criarCheckboxPlantas(tipo, nome) {
    const div = document.createElement('button');
    div.className = 'opcao-checkbox';
    div.type = 'button';
    div.setAttribute('data-tipo', tipo);
    div.setAttribute('data-nome', nome);
    const icone = ICONES_PRODUTOS[nome] || '🌱';
    div.innerHTML = `
        <div class="cartao-checkbox">
            <span class="icone-produto">${icone}</span>
            <span class="rotulo-checkbox" data-i18n="${nome}">${nome}</span>
        </div>
    `;
    
    // Adicionar event listener para toggle de seleção
    div.addEventListener('click', function() {
        this.classList.toggle('selected');
        atualizarResultados();
    });
    
    return div;
}

function criarCheckboxAnimais(nome) {
    const div = document.createElement('button');
    div.className = 'opcao-checkbox';
    div.type = 'button';
    div.setAttribute('data-nome', nome);
    const icone = ICONES_PRODUTOS[nome] || '🐾';
    div.innerHTML = `
        <div class="cartao-checkbox">
            <span class="icone-produto">${icone}</span>
            <span class="rotulo-checkbox" data-i18n="${nome}">${nome}</span>
        </div>
    `;
    
    // Adicionar event listener para toggle de seleção
    div.addEventListener('click', function() {
        this.classList.toggle('selected');
        atualizarResultados();
    });
    
    return div;
}

function atualizarResultados() {
    // Verificar se os dados foram carregados
    if (!DADOS_PLANTAS || Object.keys(DADOS_PLANTAS.frutas).length === 0) {
        console.warn('[Fazenda] Dados ainda não foram carregados. Aguardando...');
        return;
    }
    
    const quantidadePessoas = parseInt(document.getElementById('inputPessoas').value) || 4;
    
    // Ler valores dos sliders de consumo (remover formatação se houver)
    const inputConsumoPlantas = document.getElementById('inputConsumoPlantas');
    const inputConsumoProteinas = document.getElementById('inputConsumoProteinas');
    const consumoPlantasDiario = parseFloat(inputConsumoPlantas.value.toString().replace(/\./g, '').replace(',', '.')) || 0.5;
    const consumoProteinasDiario = parseFloat(inputConsumoProteinas.value.toString().replace(/\./g, '').replace(',', '.')) || 0.5;
    
    // Coletar plantas selecionadas
    const plantasSelecionadas = {
        frutas: [],
        verduras: [],
        legumes: []
    };
    
    document.querySelectorAll('.opcao-checkbox.selected[data-tipo]').forEach(btn => {
        const tipo = btn.dataset.tipo;
        const nome = btn.dataset.nome;
        plantasSelecionadas[tipo].push(nome);
    });
    
    // Coletar animais selecionados (botões sem data-tipo são animais)
    const animaisSelecionados = [];
    document.querySelectorAll('.opcao-checkbox.selected').forEach(btn => {
        // Se tem data-nome mas não tem data-tipo, é um animal
        if (btn.dataset.nome && !btn.dataset.tipo) {
            animaisSelecionados.push(btn.dataset.nome);
        }
    });
    
    // Verificar se há seleções
    const temPlantas = plantasSelecionadas.frutas.length > 0 || 
                       plantasSelecionadas.verduras.length > 0 || 
                       plantasSelecionadas.legumes.length > 0;
    const temAnimais = animaisSelecionados.length > 0;
    
    if (!temPlantas && !temAnimais) {
        const secaoResultados = document.getElementById('secaoResultados');
        if (secaoResultados) secaoResultados.style.display = 'none';
        return;
    }
    
    const secaoResultados = document.getElementById('secaoResultados');
    if (secaoResultados) secaoResultados.style.display = 'block';
    
    // Calcular áreas
    let areaTotalPlantas = 0;
    let areaTotalAnimais = 0;
    
    // Contar total de itens selecionados para distribuição proporcional
    const totalItensPlantas = plantasSelecionadas.frutas.length + 
                              plantasSelecionadas.verduras.length + 
                              plantasSelecionadas.legumes.length;
    
    // Separar galinhas e patos poedeiros dos outros animais (têm consumo fixo de 2 ovos/dia)
    const temGalinhasOvos = animaisSelecionados.includes('galinha-ovos') || animaisSelecionados.includes('gallina-ovos') || animaisSelecionados.includes('anatra-ovos');
    const temFrangoCorte = animaisSelecionados.includes('frango-corte') || animaisSelecionados.includes('pollo-corte') || animaisSelecionados.includes('anatra-corte');
    const outrosAnimais = animaisSelecionados.filter(a => 
        a !== 'galinha-ovos' && a !== 'gallina-ovos' && a !== 'anatra-ovos' && 
        a !== 'frango-corte' && a !== 'pollo-corte' && a !== 'anatra-corte'
    );
    const totalOutrosAnimais = outrosAnimais.length;
    
    // Usar valores dos sliders para consumo diário
    const CONSUMO_PLANTAS_DIARIO = consumoPlantasDiario; // kg/dia/pessoa (total de frutas+verduras+legumes)
    const CONSUMO_PROTEINA_DIARIO = consumoProteinasDiario; // kg/dia/pessoa (total de proteínas)
    
    // Calcular consumo proporcional por item
    const consumoDiarioPorItemPlanta = totalItensPlantas > 0 ? CONSUMO_PLANTAS_DIARIO / totalItensPlantas : 0;
    
    // Para proteínas: galinhas e patos poedeiros garantem 2 ovos/dia (0.12 kg/dia)
    // Frangos e patos de corte recebem parte proporcional do restante
    const dadosGalinhaOvos = temGalinhasOvos ? (DADOS_ANIMAIS['galinha-ovos'] || DADOS_ANIMAIS['gallina-ovos'] || DADOS_ANIMAIS['anatra-ovos']) : null;
    const consumoGalinhaOvosPorPessoa = temGalinhasOvos ? 2 * dadosGalinhaOvos.producaoPorUnidade : 0; // 2 ovos × 0.06 kg = 0.12 kg/dia
    
    // Calcular quantos animais de corte e outros animais temos
    const animaisCarne = (temFrangoCorte ? 1 : 0);
    const totalAnimaisCarne = animaisCarne + totalOutrosAnimais;
    const consumoRestanteProteina = Math.max(0, CONSUMO_PROTEINA_DIARIO - consumoGalinhaOvosPorPessoa);
    const consumoDiarioPorItemAnimal = totalAnimaisCarne > 0 ? consumoRestanteProteina / totalAnimaisCarne : 0;
    
    // Calcular plantas
    const detalhesPlantas = [];
    let somaConsumoPlantas = 0; // Para normalização
    
    Object.keys(plantasSelecionadas).forEach(tipo => {
        plantasSelecionadas[tipo].forEach(nome => {
            // Verificar se o tipo e nome existem nos dados
            if (!DADOS_PLANTAS[tipo] || !DADOS_PLANTAS[tipo][nome]) {
                console.warn(`[Fazenda] Planta ${tipo}/${nome} não encontrada nos dados`);
                return;
            }
            const area = calcularAreaNecessaria(tipo, nome, quantidadePessoas, consumoDiarioPorItemPlanta);
            areaTotalPlantas += area;
            const quantidade = calcularQuantidadePlantas(tipo, nome, area);
            const dados = DADOS_PLANTAS[tipo]?.[nome];
            if (!dados) {
                console.warn(`[Fazenda] Dados não encontrados para ${tipo}/${nome}`);
                return;
            }
            const producaoAnual = area * dados.producao;
            const freq = calcularFrequenciaPlantio(dados.ciclo);
            
            // O consumo diário por pessoa já é o valor proporcional
            const consumoDiarioPorPessoa = consumoDiarioPorItemPlanta;
            somaConsumoPlantas += consumoDiarioPorPessoa;
            
            // Buscar dados completos do banco de dados
            const dadosCompletos = DADOS_COMPLETOS.plantas[tipo]?.[nome] || {};
            
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
                frequencia: freq,
                tecnica: dadosCompletos.tecnica || '',
                clima: dadosCompletos.clima || '',
                solo: dadosCompletos.solo || ''
            });
        });
    });
    
    // Normalizar consumos de plantas para que a soma seja exatamente igual ao input
    if (totalItensPlantas > 0 && somaConsumoPlantas > 0) {
        const fatorNormalizacao = CONSUMO_PLANTAS_DIARIO / somaConsumoPlantas;
        detalhesPlantas.forEach(p => {
            p.consumoDiarioPorPessoa = p.consumoDiarioPorPessoa * fatorNormalizacao;
        });
    }
    
    // Calcular animais
    const detalhesAnimais = [];
    let somaConsumoAnimais = 0; // Para normalização (excluindo galinha de ovos que tem consumo fixo)
    
    animaisSelecionados.forEach(nome => {
        // Verificar se o animal existe nos dados
        if (!DADOS_ANIMAIS[nome]) {
            console.warn(`[Fazenda] Animal ${nome} não encontrado nos dados`);
            return;
        }
        
        let consumoDiarioPorPessoa;
        let quantidade;
        const isGalinhaOvos = (nome === 'galinha-ovos' || nome === 'gallina-ovos' || nome === 'anatra-ovos');
        
        if (isGalinhaOvos) {
            // Galinhas e patos poedeiros sempre garantem 2 ovos/dia por pessoa
            consumoDiarioPorPessoa = consumoGalinhaOvosPorPessoa; // 0.12 kg/dia (2 ovos)
            quantidade = calcularAnimaisNecessarios(nome, quantidadePessoas, consumoDiarioPorPessoa);
            somaConsumoAnimais += consumoDiarioPorPessoa; // Incluir na soma total
        } else if (nome === 'frango-corte' || nome === 'pollo-corte' || nome === 'vaca-corte' || nome === 'mucca-carne' || nome === 'anatra-corte') {
            // Animais de corte (frango, vaca e pato) recebem consumo proporcional
            consumoDiarioPorPessoa = consumoDiarioPorItemAnimal;
            quantidade = calcularAnimaisNecessarios(nome, quantidadePessoas, consumoDiarioPorPessoa);
            somaConsumoAnimais += consumoDiarioPorPessoa;
        } else {
            // Outros animais (leite, etc.) recebem o consumo proporcional do restante
            consumoDiarioPorPessoa = consumoDiarioPorItemAnimal;
            quantidade = calcularAnimaisNecessarios(nome, quantidadePessoas, consumoDiarioPorPessoa);
            somaConsumoAnimais += consumoDiarioPorPessoa;
        }
        
        const area = calcularAreaAnimais(nome, quantidade);
        areaTotalAnimais += area;
        const dados = DADOS_ANIMAIS[nome];
        if (!dados) {
            console.warn(`[Fazenda] Dados não encontrados para animal ${nome}`);
            return;
        }
        const freqReprod = Math.floor(365 / dados.cicloReprodutivo);
        
        // Buscar dados completos do banco de dados
        const dadosCompletosAnimal = DADOS_COMPLETOS.animais[nome] || {};
        
        detalhesAnimais.push({
            nome,
            quantidade,
            area,
            dados,
            freqReprod,
            consumoDiarioPorPessoa,
            isGalinhaOvos, // Flag para não normalizar galinha de ovos
            tecnica: dadosCompletosAnimal.tecnica || '',
            clima: dadosCompletosAnimal.clima || '',
            alimentacao: dadosCompletosAnimal.alimentacao || ''
        });
    });
    
    // Normalizar consumos de animais para que a soma seja exatamente igual ao input
    // (exceto galinha de ovos que tem consumo fixo)
    if (totalAnimaisCarne > 0 && somaConsumoAnimais > 0) {
        const consumoRestanteEsperado = CONSUMO_PROTEINA_DIARIO - consumoGalinhaOvosPorPessoa;
        const somaConsumoRestante = somaConsumoAnimais - consumoGalinhaOvosPorPessoa;
        
        if (somaConsumoRestante > 0) {
            const fatorNormalizacao = consumoRestanteEsperado / somaConsumoRestante;
            detalhesAnimais.forEach(a => {
                if (!a.isGalinhaOvos) {
                    a.consumoDiarioPorPessoa = a.consumoDiarioPorPessoa * fatorNormalizacao;
                }
            });
        }
    }
    
    // Atualizar resumo
    const areaTotal = areaTotalPlantas + areaTotalAnimais;
    const areaTotalEl = document.getElementById('areaTotal');
    if (areaTotalEl) areaTotalEl.textContent = formatarNumeroComSufixo(areaTotal, 1) + ' m²';
    const areaPlantasEl = document.getElementById('areaPlantas');
    if (areaPlantasEl) areaPlantasEl.textContent = formatarNumeroComSufixo(areaTotalPlantas, 1) + ' m²';
    const areaAnimaisEl = document.getElementById('areaAnimais');
    if (areaAnimaisEl) areaAnimaisEl.textContent = formatarNumeroComSufixo(areaTotalAnimais, 1) + ' m²';
    
    // Atualizar detalhes de plantas
    if (detalhesPlantas.length > 0) {
        document.getElementById('grupoPlantas').style.display = 'block';
        const div = document.getElementById('detalhesPlantas');
        div.innerHTML = detalhesPlantas.map((p, index) => {
            const icone = ICONES_PRODUTOS[p.nome] || '🌱';
            const idDetalhes = `detalhes-planta-${index}`;
            const idBtn = `btn-detalhes-planta-${index}`;
            const temInfoTecnica = p.tecnica || p.clima || p.solo;
            
            return `
            <div class="detalhe-item">
                <h4>${icone} ${traduzir(p.nome)}</h4>
                <div class="info-basica">
                    <p><span data-i18n="area-necessaria">Área Necessária:</span> <span class="valor-destaque">${formatarNumeroDecimal(p.area, 1)} m²</span></p>
                    <p><span data-i18n="quantidade-plantas">Quantidade de Plantas:</span> <span class="valor-destaque">${p.quantidade} ${traduzir('unidades')}</span></p>
                    <p><span data-i18n="producao-anual">Produção Anual:</span> <span class="valor-destaque">${formatarNumeroDecimal(p.producaoAnual, 1)} kg</span></p>
                    <p><span data-i18n="consumo-diario-pessoa">Consumo por Pessoa/Dia:</span> <span class="valor-destaque">${formatarNumeroDecimal(p.consumoDiarioPorPessoa, 3)} kg</span></p>
                    <p><span data-i18n="ciclo-dias">Ciclo (dias):</span> ${p.ciclo} ${traduzir('dias')}</p>
                    <p><span data-i18n="plantio">Época de Plantio:</span> ${p.plantio}</p>
                    <p><span data-i18n="colheita">Época de Colheita:</span> ${p.colheita}</p>
                    <p><span data-i18n="frequencia-plantio">Frequência de Plantio:</span> <span class="valor-destaque">A cada ${p.frequencia.frequencia} ${traduzir('dias')} (${p.frequencia.vezesAno} ${traduzir('vezes-ano')})</span></p>
                </div>
                ${temInfoTecnica ? `
                <button class="btn-info-tecnica" onclick="toggleInfoTecnica('${idDetalhes}', '${idBtn}')" id="${idBtn}">
                    <span>📖 ${traduzir('ver-info-tecnica')}</span>
                </button>
                <div class="info-tecnica" id="${idDetalhes}" style="display: none;">
                    ${p.tecnica ? `<div class="info-tecnica-item"><strong>🌱 ${traduzir('tecnica-cultivo')}:</strong><p>${p.tecnica}</p></div>` : ''}
                    ${p.clima ? `<div class="info-tecnica-item"><strong>🌡️ ${traduzir('clima')}:</strong><p>${p.clima}</p></div>` : ''}
                    ${p.solo ? `<div class="info-tecnica-item"><strong>🌍 ${traduzir('solo')}:</strong><p>${p.solo}</p></div>` : ''}
                </div>
                ` : ''}
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
        div.innerHTML = detalhesAnimais.map((a, index) => {
            let producaoTexto = '';
            if (a.dados.producaoDiaria > 0) {
                producaoTexto = `<p><span data-i18n="producao-diaria">Produção Diária:</span> <span class="valor-destaque">${a.dados.producaoDiaria} ${a.dados.producaoUnidade}</span></p>`;
            } else {
                producaoTexto = `<p><span data-i18n="producao-diaria">Produção por Ciclo:</span> <span class="valor-destaque">${a.dados.producaoCiclo} ${a.dados.producaoUnidade}</span></p>`;
            }
            
            const icone = ICONES_PRODUTOS[a.nome] || '🐾';
            const idDetalhes = `detalhes-animal-${index}`;
            const idBtn = `btn-detalhes-animal-${index}`;
            const temInfoTecnica = a.tecnica || a.clima || a.alimentacao;
            
            return `
                <div class="detalhe-item">
                    <h4>${icone} ${traduzir(a.nome)}</h4>
                    <div class="info-basica">
                        <p><span data-i18n="quantidade-animais">Quantidade de Animais:</span> <span class="valor-destaque">${a.quantidade} ${traduzir('unidades')}</span></p>
                        <p><span data-i18n="area-necessaria">Área Necessária:</span> <span class="valor-destaque">${formatarNumeroDecimal(a.area, 1)} m²</span></p>
                        ${producaoTexto}
                        <p><span data-i18n="consumo-diario-pessoa">Consumo por Pessoa/Dia:</span> <span class="valor-destaque">${formatarNumeroDecimal(a.consumoDiarioPorPessoa, 3)} kg</span></p>
                        <p><span data-i18n="espaco-animal">Espaço por Animal:</span> ${a.dados.espaco} m²</p>
                        <p><span data-i18n="ciclo-reprodutivo">Ciclo Reprodutivo:</span> ${a.dados.cicloReprodutivo} ${traduzir('dias')}</p>
                        <p><span data-i18n="frequencia-reproducao">Frequência de Reprodução:</span> <span class="valor-destaque">${a.freqReprod} ${traduzir('vezes-ano')}</span></p>
                        ${a.dados.tempoCrescimento ? `<p><span data-i18n="tempo-crescimento">Tempo até Produção:</span> ${a.dados.tempoCrescimento} ${traduzir('dias')}</p>` : ''}
                        ${a.dados.consumoRacao ? `<p><span data-i18n="consumo-racao">Consumo de Ração:</span> ${a.dados.consumoRacao} kg/dia/animal</p>` : ''}
                    </div>
                    ${temInfoTecnica ? `
                    <button class="btn-info-tecnica" onclick="toggleInfoTecnica('${idDetalhes}', '${idBtn}')" id="${idBtn}">
                        <span>📖 ${traduzir('ver-info-tecnica')}</span>
                    </button>
                    <div class="info-tecnica" id="${idDetalhes}" style="display: none;">
                        ${a.tecnica ? `<div class="info-tecnica-item"><strong>🐾 ${traduzir('tecnica-criacao')}:</strong><p>${a.tecnica}</p></div>` : ''}
                        ${a.clima ? `<div class="info-tecnica-item"><strong>🌡️ ${traduzir('clima')}:</strong><p>${a.clima}</p></div>` : ''}
                        ${a.alimentacao ? `<div class="info-tecnica-item"><strong>🌾 ${traduzir('alimentacao')}:</strong><p>${a.alimentacao}</p></div>` : ''}
                    </div>
                    ` : ''}
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
// FUNÇÃO PARA TOGGLE DE INFORMAÇÕES TÉCNICAS

function toggleInfoTecnica(idDetalhes, idBtn) {
    const detalhes = document.getElementById(idDetalhes);
    const btn = document.getElementById(idBtn);
    
    if (detalhes && btn) {
        if (detalhes.style.display === 'none' || detalhes.style.display === '') {
            detalhes.style.display = 'block';
            btn.innerHTML = `<span>📖 ${traduzir('ocultar-info-tecnica')}</span>`;
        } else {
            detalhes.style.display = 'none';
            btn.innerHTML = `<span>📖 ${traduzir('ver-info-tecnica')}</span>`;
        }
    }
}
// Tornar função global para uso em onclick
window.toggleInfoTecnica = toggleInfoTecnica;
// MEMORIAL DE CÁLCULO

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
    
    document.querySelectorAll('.opcao-checkbox.selected[data-tipo]').forEach(btn => {
        const tipo = btn.dataset.tipo;
        const nome = btn.dataset.nome;
        plantasSelecionadas[tipo].push(nome);
    });
    
    // Coletar animais selecionados (botões sem data-tipo são animais)
    const animaisSelecionados = [];
    document.querySelectorAll('.opcao-checkbox.selected').forEach(btn => {
        // Se tem data-nome mas não tem data-tipo, é um animal
        if (btn.dataset.nome && !btn.dataset.tipo) {
            animaisSelecionados.push(btn.dataset.nome);
        }
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
    
    const temGalinhasOvos = animaisSelecionados.includes('galinha-ovos') || animaisSelecionados.includes('gallina-ovos') || animaisSelecionados.includes('anatra-ovos');
    const temFrangoCorte = animaisSelecionados.includes('frango-corte') || animaisSelecionados.includes('pollo-corte') || animaisSelecionados.includes('anatra-corte');
    const temVacaCorte = animaisSelecionados.includes('vaca-corte') || animaisSelecionados.includes('mucca-carne');
    const outrosAnimais = animaisSelecionados.filter(a => 
        a !== 'galinha-ovos' && a !== 'gallina-ovos' && a !== 'anatra-ovos' && 
        a !== 'frango-corte' && a !== 'pollo-corte' && a !== 'anatra-corte' &&
        a !== 'vaca-corte' && a !== 'mucca-carne'
    );
    const totalOutrosAnimais = outrosAnimais.length;
    
    const consumoDiarioPorItemPlanta = totalItensPlantas > 0 ? consumoPlantasDiario / totalItensPlantas : 0;
    
    const dadosGalinhaOvos = temGalinhasOvos ? (DADOS_ANIMAIS['galinha-ovos'] || DADOS_ANIMAIS['gallina-ovos'] || DADOS_ANIMAIS['anatra-ovos']) : null;
    const consumoGalinhaOvosPorPessoa = temGalinhasOvos ? 2 * dadosGalinhaOvos.producaoPorUnidade : 0;
    
    // Animais de corte (frango, pato e vaca) recebem consumo proporcional
    const animaisCarne = (temFrangoCorte ? 1 : 0) + (temVacaCorte ? 1 : 0);
    const totalAnimaisCarne = animaisCarne + totalOutrosAnimais;
    const consumoRestanteProteina = Math.max(0, consumoProteinasDiario - consumoGalinhaOvosPorPessoa);
    const consumoDiarioPorItemAnimal = totalAnimaisCarne > 0 ? consumoRestanteProteina / totalAnimaisCarne : 0;
    
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
        
        if (nome === 'galinha-ovos' || nome === 'gallina-ovos' || nome === 'anatra-ovos') {
            consumoDiarioPorPessoa = consumoGalinhaOvosPorPessoa;
        } else if (nome === 'frango-corte' || nome === 'pollo-corte' || nome === 'vaca-corte' || nome === 'mucca-carne' || nome === 'anatra-corte') {
            consumoDiarioPorPessoa = consumoDiarioPorItemAnimal;
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
    if (temGalinhasOvos) {
        const ovosPorDiaTotal = 2 * quantidadePessoas;
        const ovosPorDiaPorGalinha = dadosGalinhaOvos.producaoDiaria;
        const quantidadeGalinhas = Math.ceil(ovosPorDiaTotal / ovosPorDiaPorGalinha);
        exemploAnimais = `Para ${2} ovos/dia/pessoa: ${ovosPorDiaTotal} ovos/dia ÷ ${formatarNumeroDecimal(ovosPorDiaPorGalinha, 1)} ovos/dia/galinha = ${quantidadeGalinhas} galinhas poedeiras`;
    } else if (temFrangoCorte) {
        const primeiroAnimal = 'frango-corte';
        const dados = DADOS_ANIMAIS[primeiroAnimal] || DADOS_ANIMAIS['pollo-corte'];
        const consumoAnualItem = consumoDiarioPorItemAnimal * quantidadePessoas * 365;
        const producaoAnual = dados.producaoCiclo * (365 / dados.cicloReprodutivo);
        const quantidade = Math.ceil(consumoAnualItem / producaoAnual);
        exemploAnimais = `Para consumo de ${formatarNumeroDecimal(consumoDiarioPorItemAnimal * quantidadePessoas, 2)} kg/dia: ${formatarNumeroDecimal(consumoAnualItem, 0)} kg/ano ÷ ${formatarNumeroDecimal(producaoAnual, 0)} kg/ano/frango = ${quantidade} frangos de corte`;
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
    document.getElementById('resumo-area-plantas').textContent = formatarNumeroComSufixo(areaTotalPlantas, 1) + ' m²';
    document.getElementById('resumo-area-animais').textContent = formatarNumeroComSufixo(areaTotalAnimais, 1) + ' m²';
    document.getElementById('resumo-area-total').textContent = formatarNumeroComSufixo(areaTotal, 1) + ' m²';
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
// CARREGAR DADOS DO BANCO DE DADOS
// Armazenar dados completos do banco de dados (incluindo informações técnicas)
let DADOS_COMPLETOS = {
    plantas: {
        frutas: {},
        verduras: {},
        legumes: {}
    },
    animais: {}
};

function carregarDadosBanco(idioma) {
    // Verificar se o banco de dados está disponível
    if (typeof FAZENDA_DATABASE === 'undefined') {
        console.error('ERRO: FAZENDA_DATABASE não está definido! Certifique-se de que fazenda-database.js está carregado antes de fazenda-script.js');
        return;
    }
    
    if (!FAZENDA_DATABASE[idioma]) {
        console.warn(`Banco de dados não encontrado para idioma ${idioma}, usando pt-BR`);
        idioma = 'pt-BR';
    }
    
    const dados = FAZENDA_DATABASE[idioma];
    
    if (!dados) {
        console.error('ERRO: Dados do banco de dados não encontrados!');
        return;
    }
    
    // Limpar dados anteriores
    DADOS_PLANTAS = {
        frutas: {},
        verduras: {},
        legumes: {}
    };
    
    DADOS_COMPLETOS.plantas = {
        frutas: {},
        verduras: {},
        legumes: {}
    };
    
    // Carregar dados de plantas (com informações técnicas)
    if (dados.plantas) {
        if (dados.plantas.frutas) {
            Object.keys(dados.plantas.frutas).forEach(key => {
                const item = dados.plantas.frutas[key];
                DADOS_PLANTAS.frutas[key] = {
                    producao: item.producao,
                    ciclo: item.ciclo,
                    plantio: item.plantio,
                    colheita: item.colheita,
                    areaMin: item.areaMin
                };
                // Armazenar dados completos com informações técnicas
                DADOS_COMPLETOS.plantas.frutas[key] = item;
            });
            console.log(`[Fazenda] Carregadas ${Object.keys(DADOS_PLANTAS.frutas).length} frutas do banco de dados (${idioma})`);
        }
        if (dados.plantas.verduras) {
            Object.keys(dados.plantas.verduras).forEach(key => {
                const item = dados.plantas.verduras[key];
                DADOS_PLANTAS.verduras[key] = {
                    producao: item.producao,
                    ciclo: item.ciclo,
                    plantio: item.plantio,
                    colheita: item.colheita,
                    areaMin: item.areaMin
                };
                DADOS_COMPLETOS.plantas.verduras[key] = item;
            });
            console.log(`[Fazenda] Carregadas ${Object.keys(DADOS_PLANTAS.verduras).length} verduras do banco de dados (${idioma})`);
        }
        if (dados.plantas.legumes) {
            Object.keys(dados.plantas.legumes).forEach(key => {
                const item = dados.plantas.legumes[key];
                DADOS_PLANTAS.legumes[key] = {
                    producao: item.producao,
                    ciclo: item.ciclo,
                    plantio: item.plantio,
                    colheita: item.colheita,
                    areaMin: item.areaMin
                };
                DADOS_COMPLETOS.plantas.legumes[key] = item;
            });
            console.log(`[Fazenda] Carregados ${Object.keys(DADOS_PLANTAS.legumes).length} legumes do banco de dados (${idioma})`);
        }
    }
    
    // Carregar dados de animais (com informações técnicas)
    DADOS_ANIMAIS = {};
    DADOS_COMPLETOS.animais = {};
    
    if (dados.animais) {
        Object.keys(dados.animais).forEach(key => {
            const item = dados.animais[key];
            DADOS_ANIMAIS[key] = {
                producaoDiaria: item.producaoDiaria,
                producaoUnidade: item.producaoUnidade,
                producaoPorUnidade: item.producaoPorUnidade,
                espaco: item.espaco,
                cicloReprodutivo: item.cicloReprodutivo,
                producaoCiclo: item.producaoCiclo,
                tempoCrescimento: item.tempoCrescimento,
                consumoRacao: item.consumoRacao
            };
            // Armazenar dados completos com informações técnicas
            DADOS_COMPLETOS.animais[key] = item;
        });
        console.log(`[Fazenda] Carregados ${Object.keys(DADOS_ANIMAIS).length} animais do banco de dados (${idioma})`);
    }
    
    console.log(`[Fazenda] Banco de dados carregado com sucesso para ${idioma}`);
}
// TRADUÇÃO

let idiomaAtual = 'pt-BR';

function traduzir(chave) {
    return traducoes[idiomaAtual]?.[chave] || chave;
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
    if (!novoIdioma || (novoIdioma !== 'pt-BR' && novoIdioma !== 'it-IT')) {
        console.warn(`[Fazenda] Idioma inválido: ${novoIdioma}, usando pt-BR`);
        novoIdioma = 'pt-BR';
    }
    
    console.log(`[Fazenda] Trocando idioma para: ${novoIdioma}`);
    idiomaAtual = novoIdioma;
    
    const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido' };
    const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) ? SiteConfig.SELECTORS : { LANG_BTN: '.lang-btn', HOME_BUTTON: '.home-button-fixed' };
    
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    document.documentElement.lang = novoIdioma;
    
    // Carregar dados do banco de dados para o novo idioma
    carregarDadosBanco(novoIdioma);
    
    // Recriar checkboxes com os novos produtos
    recriarCheckboxes();
    
    aplicarTraducoes();
    
    // Atualizar botões de idioma (ativação visual)
    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(btn => {
        if (btn.getAttribute('data-lang') === novoIdioma) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Atualiza aria-label do botão home
    const homeLabel = traducoes[novoIdioma]?.['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
    
    // Limpar resultados ao trocar idioma (já que os produtos mudaram)
    const secaoResultados = document.getElementById('secaoResultados');
    if (secaoResultados) {
        secaoResultados.style.display = 'none';
    }
}
// Função para recriar checkboxes quando o idioma muda
function recriarCheckboxes() {
    // Verificar se os elementos existem
    const grupoFrutas = document.getElementById('grupoFrutas');
    const grupoVerduras = document.getElementById('grupoVerduras');
    const grupoLegumes = document.getElementById('grupoLegumes');
    const grupoAnimais = document.getElementById('grupoAnimais');
    
    if (!grupoFrutas || !grupoVerduras || !grupoLegumes || !grupoAnimais) {
        console.error('[Fazenda] Elementos DOM não encontrados ao recriar checkboxes');
        return;
    }
    
    // Salvar seleções atuais antes de recriar
    const selecoesPlantas = {
        frutas: [],
        verduras: [],
        legumes: []
    };
    document.querySelectorAll('.opcao-checkbox.selected[data-tipo]').forEach(btn => {
        const tipo = btn.dataset.tipo;
        const nome = btn.dataset.nome;
        if (selecoesPlantas[tipo]) {
            selecoesPlantas[tipo].push(nome);
        }
    });
    
    const selecoesAnimais = [];
    document.querySelectorAll('.opcao-checkbox.selected').forEach(btn => {
        // Se tem data-nome mas não tem data-tipo, é um animal
        if (btn.dataset.nome && !btn.dataset.tipo) {
            selecoesAnimais.push(btn.dataset.nome);
        }
    });
    
    // Limpar checkboxes existentes
    grupoFrutas.innerHTML = '';
    grupoVerduras.innerHTML = '';
    grupoLegumes.innerHTML = '';
    grupoAnimais.innerHTML = '';
    
    // Verificar se os dados foram carregados
    if (!DADOS_PLANTAS || !DADOS_ANIMAIS) {
        console.error('[Fazenda] Dados não carregados ao recriar checkboxes');
        return;
    }
    
    // Criar checkboxes de plantas (ordenados alfabeticamente)
    Object.keys(DADOS_PLANTAS.frutas || {}).sort((a, b) => {
        const nomeA = traduzir(a).toLowerCase();
        const nomeB = traduzir(b).toLowerCase();
        return nomeA.localeCompare(nomeB, idiomaAtual);
    }).forEach(nome => {
        const btn = criarCheckboxPlantas('frutas', nome);
        // Restaurar seleção se estava selecionado
        if (selecoesPlantas.frutas.indexOf(nome) !== -1) {
            btn.classList.add('selected');
        }
        grupoFrutas.appendChild(btn);
    });
    Object.keys(DADOS_PLANTAS.verduras || {}).sort((a, b) => {
        const nomeA = traduzir(a).toLowerCase();
        const nomeB = traduzir(b).toLowerCase();
        return nomeA.localeCompare(nomeB, idiomaAtual);
    }).forEach(nome => {
        const btn = criarCheckboxPlantas('verduras', nome);
        // Restaurar seleção se estava selecionado
        if (selecoesPlantas.verduras.indexOf(nome) !== -1) {
            btn.classList.add('selected');
        }
        grupoVerduras.appendChild(btn);
    });
    Object.keys(DADOS_PLANTAS.legumes || {}).sort((a, b) => {
        const nomeA = traduzir(a).toLowerCase();
        const nomeB = traduzir(b).toLowerCase();
        return nomeA.localeCompare(nomeB, idiomaAtual);
    }).forEach(nome => {
        const btn = criarCheckboxPlantas('legumes', nome);
        // Restaurar seleção se estava selecionado
        if (selecoesPlantas.legumes.indexOf(nome) !== -1) {
            btn.classList.add('selected');
        }
        grupoLegumes.appendChild(btn);
    });
    
    // Criar checkboxes de animais (ordenados alfabeticamente)
    Object.keys(DADOS_ANIMAIS || {}).sort((a, b) => {
        const nomeA = traduzir(a).toLowerCase();
        const nomeB = traduzir(b).toLowerCase();
        return nomeA.localeCompare(nomeB, idiomaAtual);
    }).forEach(nome => {
        const btn = criarCheckboxAnimais(nome);
        // Restaurar seleção se estava selecionado
        if (selecoesAnimais.indexOf(nome) !== -1) {
            btn.classList.add('selected');
        }
        grupoAnimais.appendChild(btn);
    });
    
    // Os event listeners já estão configurados globalmente no DOMContentLoaded
    // Não é necessário reaplicá-los aqui
}
// INICIALIZAÇÃO
// Função de inicialização que aguarda o carregamento completo
function inicializarApp() {
    // Verificar se o banco de dados está disponível
    if (typeof FAZENDA_DATABASE === 'undefined') {
        console.error('ERRO CRÍTICO: FAZENDA_DATABASE não está disponível!');
        // Tentar novamente após um pequeno delay
        setTimeout(inicializarApp, 100);
        return;
    }
    
    // Carregar dados iniciais do banco de dados
    const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido' };
    const idiomaSalvo = localStorage.getItem(SITE_LS.LANGUAGE_KEY);
    const idiomaInicial = (idiomaSalvo && (idiomaSalvo === 'pt-BR' || idiomaSalvo === 'it-IT')) ? idiomaSalvo : 'pt-BR';
    idiomaAtual = idiomaInicial;
    
    // Carregar dados do banco de dados PRIMEIRO
    carregarDadosBanco(idiomaInicial);
    
    // Verificar se os dados foram carregados
    const totalFrutas = Object.keys(DADOS_PLANTAS.frutas || {}).length;
    const totalVerduras = Object.keys(DADOS_PLANTAS.verduras || {}).length;
    const totalLegumes = Object.keys(DADOS_PLANTAS.legumes || {}).length;
    const totalAnimais = Object.keys(DADOS_ANIMAIS || {}).length;
    
    if (totalFrutas === 0 && totalVerduras === 0 && totalLegumes === 0 && totalAnimais === 0) {
        console.error('ERRO: Nenhum dado foi carregado do banco de dados!');
        console.error('FAZENDA_DATABASE:', typeof FAZENDA_DATABASE);
        console.error('DADOS_PLANTAS:', DADOS_PLANTAS);
        console.error('DADOS_ANIMAIS:', DADOS_ANIMAIS);
        alert('Erro: Nenhum produto foi carregado do banco de dados. Verifique o console para mais detalhes.');
        return;
    }
    
    console.log(`[Fazenda] Inicializando com ${totalFrutas} frutas, ${totalVerduras} verduras, ${totalLegumes} legumes e ${totalAnimais} animais`);
    
    // Verificar se os elementos DOM existem
    const grupoFrutas = document.getElementById('grupoFrutas');
    const grupoVerduras = document.getElementById('grupoVerduras');
    const grupoLegumes = document.getElementById('grupoLegumes');
    const grupoAnimais = document.getElementById('grupoAnimais');
    
    if (!grupoFrutas || !grupoVerduras || !grupoLegumes || !grupoAnimais) {
        console.error('ERRO: Elementos DOM não encontrados!');
        return;
    }
    
    // Limpar checkboxes existentes
    grupoFrutas.innerHTML = '';
    grupoVerduras.innerHTML = '';
    grupoLegumes.innerHTML = '';
    grupoAnimais.innerHTML = '';
    
    // Criar checkboxes de plantas (ordenados alfabeticamente)
    console.log('[Fazenda] Criando checkboxes de frutas...');
    const frutasKeys = Object.keys(DADOS_PLANTAS.frutas).sort((a, b) => {
        // Ordenar por nome traduzido
        const nomeA = traduzir(a).toLowerCase();
        const nomeB = traduzir(b).toLowerCase();
        return nomeA.localeCompare(nomeB, idiomaAtual);
    });
    console.log(`[Fazenda] ${frutasKeys.length} frutas encontradas (ordenadas):`, frutasKeys);
    frutasKeys.forEach(nome => {
        const btn = criarCheckboxPlantas('frutas', nome);
        grupoFrutas.appendChild(btn);
    });
    
    console.log('[Fazenda] Criando checkboxes de verduras...');
    const verdurasKeys = Object.keys(DADOS_PLANTAS.verduras).sort((a, b) => {
        // Ordenar por nome traduzido
        const nomeA = traduzir(a).toLowerCase();
        const nomeB = traduzir(b).toLowerCase();
        return nomeA.localeCompare(nomeB, idiomaAtual);
    });
    console.log(`[Fazenda] ${verdurasKeys.length} verduras encontradas (ordenadas):`, verdurasKeys);
    verdurasKeys.forEach(nome => {
        const btn = criarCheckboxPlantas('verduras', nome);
        grupoVerduras.appendChild(btn);
    });
    
    console.log('[Fazenda] Criando checkboxes de legumes...');
    const legumesKeys = Object.keys(DADOS_PLANTAS.legumes).sort((a, b) => {
        // Ordenar por nome traduzido
        const nomeA = traduzir(a).toLowerCase();
        const nomeB = traduzir(b).toLowerCase();
        return nomeA.localeCompare(nomeB, idiomaAtual);
    });
    console.log(`[Fazenda] ${legumesKeys.length} legumes encontrados (ordenados):`, legumesKeys);
    legumesKeys.forEach(nome => {
        const btn = criarCheckboxPlantas('legumes', nome);
        grupoLegumes.appendChild(btn);
    });
    
    // Criar checkboxes de animais (ordenados alfabeticamente)
    const animaisKeys = Object.keys(DADOS_ANIMAIS).sort((a, b) => {
        // Ordenar por nome traduzido
        const nomeA = traduzir(a).toLowerCase();
        const nomeB = traduzir(b).toLowerCase();
        return nomeA.localeCompare(nomeB, idiomaAtual);
    });
    animaisKeys.forEach(nome => {
        const btn = criarCheckboxAnimais(nome);
        grupoAnimais.appendChild(btn);
    });
    
    
    // Aplicar traduções (incluindo os checkboxes que acabamos de criar)
    aplicarTraducoes();
    
    // Atualizar botões de idioma (ativação visual)
    const btnPortugues = document.getElementById('btnPortugues');
    const btnItaliano = document.getElementById('btnItaliano');
    if (btnPortugues && idiomaInicial === 'pt-BR') {
        btnPortugues.classList.add('active');
        btnItaliano?.classList.remove('active');
    } else if (btnItaliano && idiomaInicial === 'it-IT') {
        btnItaliano.classList.add('active');
        btnPortugues?.classList.remove('active');
    }
    
    // Configurar event listeners
    configurarEventListeners();
    
}
// Função separada para configurar event listeners
function configurarEventListeners() {
    
    // Event listeners para pessoas
    const sliderPessoas = document.getElementById('sliderPessoas');
    const inputPessoas = document.getElementById('inputPessoas');
    
    if (sliderPessoas && inputPessoas) {
        // Aplica throttle nos sliders e debounce nos inputs para melhorar performance
        const throttleFn = typeof throttle === 'function' ? throttle : (fn, delay) => fn;
        const debounceFn = typeof debounce === 'function' ? debounce : (fn, delay) => fn;
        
        sliderPessoas.addEventListener('input', throttleFn(() => {
            inputPessoas.value = sliderPessoas.value;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPessoas);
            atualizarResultados();
        }, 50)); // Reduzido para 50ms para melhor responsividade
        
        inputPessoas.addEventListener('input', debounceFn(() => {
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPessoas);
            let valor = parseInt(inputPessoas.value) || 1;
            valor = Math.max(1, Math.min(20, valor));
            inputPessoas.value = valor;
            sliderPessoas.value = valor;
            atualizarResultados();
        }, 300));
    }
    
    // Event listeners para consumo de plantas
    const sliderConsumoPlantas = document.getElementById('sliderConsumoPlantas');
    const inputConsumoPlantas = document.getElementById('inputConsumoPlantas');
    
    if (sliderConsumoPlantas && inputConsumoPlantas) {
        const throttleFn = typeof throttle === 'function' ? throttle : (fn, delay) => fn;
        const debounceFn = typeof debounce === 'function' ? debounce : (fn, delay) => fn;
        
        // Usar throttle mais curto para reduzir lag
        sliderConsumoPlantas.addEventListener('input', throttleFn(() => {
            inputConsumoPlantas.value = formatarNumeroDecimal(parseFloat(sliderConsumoPlantas.value), 1);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumoPlantas);
            atualizarResultados();
        }, 50)); // Reduzido para 50ms para melhor responsividade
        
        inputConsumoPlantas.addEventListener('input', debounceFn(() => {
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumoPlantas);
            let valor = parseFloat(inputConsumoPlantas.value.replace(',', '.')) || 0.1;
            valor = Math.max(0.1, Math.min(2.0, valor));
            inputConsumoPlantas.value = formatarNumeroDecimal(valor, 1);
            sliderConsumoPlantas.value = valor;
            atualizarResultados();
        }, 300));
    }
    
    // Event listeners para consumo de proteínas
    const sliderConsumoProteinas = document.getElementById('sliderConsumoProteinas');
    const inputConsumoProteinas = document.getElementById('inputConsumoProteinas');
    
    if (sliderConsumoProteinas && inputConsumoProteinas) {
        const throttleFn = typeof throttle === 'function' ? throttle : (fn, delay) => fn;
        const debounceFn = typeof debounce === 'function' ? debounce : (fn, delay) => fn;
        
        // Usar throttle mais curto para reduzir lag
        sliderConsumoProteinas.addEventListener('input', throttleFn(() => {
            inputConsumoProteinas.value = formatarNumeroDecimal(parseFloat(sliderConsumoProteinas.value), 1);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumoProteinas);
            atualizarResultados();
        }, 50)); // Reduzido para 50ms para melhor responsividade
        
        inputConsumoProteinas.addEventListener('input', debounceFn(() => {
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumoProteinas);
            let valor = parseFloat(inputConsumoProteinas.value.replace(',', '.')) || 0.1;
            valor = Math.max(0.1, Math.min(2.0, valor));
            inputConsumoProteinas.value = formatarNumeroDecimal(valor, 1);
            sliderConsumoProteinas.value = valor;
            atualizarResultados();
        }, 300));
    }
    
    // Função customizada de ajuste que atualiza inputs correspondentes
    function ajustarValorFazenda(targetId, step) {
        const slider = document.getElementById(targetId);
        if (!slider) return;
        
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const stepAttr = parseFloat(slider.step) || 1;
        
        let valorAtual = parseFloat(slider.value) || min;
        let novoValor = valorAtual + step;
        
        // Arredonda para o múltiplo mais próximo do step
        novoValor = Math.round(novoValor / stepAttr) * stepAttr;
        
        // Força valores min/max quando próximo do fim do curso (dentro de 2 steps)
        const tolerancia = stepAttr * 2;
        if (novoValor <= min + tolerancia) {
            novoValor = min;
        } else if (novoValor >= max - tolerancia) {
            novoValor = max;
        } else {
            novoValor = Math.max(min, Math.min(max, novoValor));
        }
        
        slider.value = novoValor;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Atualizar o input correspondente
        if (targetId === 'sliderPessoas' && inputPessoas) {
            inputPessoas.value = novoValor;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPessoas);
        } else if (targetId === 'sliderConsumoPlantas' && inputConsumoPlantas) {
            inputConsumoPlantas.value = formatarNumeroDecimal(novoValor, 1);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumoPlantas);
        } else if (targetId === 'sliderConsumoProteinas' && inputConsumoProteinas) {
            inputConsumoProteinas.value = formatarNumeroDecimal(novoValor, 1);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumoProteinas);
        }
    }
    
    // Configura botões de seta com aceleração variável
    if (typeof configurarBotoesSliderComAceleracao === 'function') {
        configurarBotoesSliderComAceleracao('.arrow-btn', ajustarValorFazenda);
    } else {
        // Fallback para código antigo se a função global não estiver disponível
        document.querySelectorAll('.arrow-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const step = parseFloat(btn.getAttribute('data-step'));
                ajustarValorFazenda(targetId, step);
            });
        });
    }
    
    // Botões de plantas e animais já têm event listeners individuais
    // Não precisa de listener global aqui
    
    // Botões de idioma
    const btnPortugues = document.getElementById('btnPortugues');
    const btnItaliano = document.getElementById('btnItaliano');
    if (btnPortugues) btnPortugues.addEventListener('click', () => trocarIdioma('pt-BR'));
    if (btnItaliano) btnItaliano.addEventListener('click', () => trocarIdioma('it-IT'));
    
    // Event listeners para o memorial de cálculo
    const btnMemorial = document.getElementById('btnMemorial');
    const btnFecharMemorial = document.getElementById('btnFecharMemorial');
    if (btnMemorial) btnMemorial.addEventListener('click', toggleMemorial);
    if (btnFecharMemorial) btnFecharMemorial.addEventListener('click', toggleMemorial);
    document.querySelectorAll('.btn-voltar-memorial').forEach(btn => {
        btn.addEventListener('click', toggleMemorial);
    });
    
    // Aplicar traduções iniciais
    aplicarTraducoes();
    if (btnPortugues) btnPortugues.classList.add('active');
    
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
    
    console.log('[Fazenda] App inicializado com sucesso!');
}
// Aguardar carregamento completo do DOM e do banco de dados
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Fazenda] DOM carregado, verificando dependências...');
    
    // Verificar se as funções necessárias estão disponíveis
    if (typeof formatarNumeroDecimal === 'undefined') {
        console.error('[Fazenda] ERRO: formatarNumeroDecimal não está disponível!');
    }
    if (typeof throttle === 'undefined') {
        console.warn('[Fazenda] AVISO: throttle não está disponível, usando função padrão');
    }
    if (typeof debounce === 'undefined') {
        console.warn('[Fazenda] AVISO: debounce não está disponível, usando função padrão');
    }
    
    // Função para tentar inicializar
    function tentarInicializar(tentativa = 0) {
        console.log(`[Fazenda] Tentativa ${tentativa + 1} de inicialização...`);
        
        if (typeof FAZENDA_DATABASE !== 'undefined') {
            console.log('[Fazenda] Banco de dados encontrado, inicializando app...');
            try {
                inicializarApp();
                console.log('[Fazenda] App inicializado com sucesso!');
            } catch (error) {
                console.error('[Fazenda] Erro ao inicializar app:', error);
                console.error('[Fazenda] Stack trace:', error.stack);
                alert('Erro ao inicializar o aplicativo. Verifique o console para mais detalhes.\n\nErro: ' + error.message);
            }
        } else {
            console.warn(`[Fazenda] Banco de dados ainda não disponível (tentativa ${tentativa + 1})`);
            if (tentativa < 10) {
                // Tentar novamente após um pequeno delay (máximo 10 tentativas = 1 segundo)
                setTimeout(() => tentarInicializar(tentativa + 1), 100);
            } else {
                console.error('[Fazenda] ERRO CRÍTICO: FAZENDA_DATABASE não foi carregado após 1 segundo!');
                console.error('[Fazenda] Verifique se fazenda-database.js está sendo carregado antes de fazenda-script.js');
                alert('Erro: O banco de dados não foi carregado. Verifique se fazenda-database.js está sendo carregado corretamente.');
            }
        }
    }
    
    // Iniciar tentativas
    tentarInicializar();
});

