// ============================================
// BANCO DE DADOS DE FAZENDA AUTO-SUSTENTÁVEL
// Produtos típicos e técnicas de cultivo por região
// ============================================

const FAZENDA_DATABASE = {
    'pt-BR': {
        // ============================================
        // PRODUTOS TÍPICOS DO BRASIL
        // ============================================
        plantas: {
            frutas: {
                // Frutas tropicais nativas e adaptadas
                'banana': {
                    producao: 18, // kg/m²/ano (clima tropical favorece)
                    ciclo: 365,
                    plantio: 'Ano todo',
                    colheita: 'Contínua',
                    areaMin: 4,
                    tecnica: 'Plantar em covas de 40x40x40cm com adubação orgânica. Requer solo úmido e bem drenado. Usar sistema de irrigação por gotejamento.',
                    clima: 'Tropical e subtropical',
                    solo: 'Rico em matéria orgânica, pH 5.5-7.0'
                },
                'manga': {
                    producao: 10, // kg/m²/ano
                    ciclo: 730,
                    plantio: 'Verão (dezembro a fevereiro)',
                    colheita: 'Verão (dezembro a março)',
                    areaMin: 16,
                    tecnica: 'Plantar mudas enxertadas. Espaçamento de 8x8m. Podas de formação nos primeiros 3 anos. Adubação com esterco curtido.',
                    clima: 'Tropical e subtropical',
                    solo: 'Profundo, bem drenado, pH 5.5-7.5'
                },
                'laranja': {
                    producao: 15, // kg/m²/ano
                    ciclo: 1095,
                    plantio: 'Outono (março a maio)',
                    colheita: 'Inverno/Primavera (junho a outubro)',
                    areaMin: 12,
                    tecnica: 'Plantar mudas enxertadas em espaçamento de 6x6m. Irrigação por gotejamento. Controle de pragas com calda sulfocálcica.',
                    clima: 'Subtropical',
                    solo: 'Bem drenado, pH 6.0-7.0'
                },
                'limao': {
                    producao: 12, // kg/m²/ano
                    ciclo: 730,
                    plantio: 'Primavera (setembro a novembro)',
                    colheita: 'Ano todo',
                    areaMin: 9,
                    tecnica: 'Plantar mudas enxertadas. Espaçamento de 5x5m. Podas anuais após colheita. Adubação com NPK 20-5-20.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, pH 5.5-7.0'
                },
                'abacate': {
                    producao: 8, // kg/m²/ano
                    ciclo: 1095,
                    plantio: 'Primavera (setembro a novembro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 20,
                    tecnica: 'Plantar mudas enxertadas em espaçamento de 8x8m. Requer polinização cruzada. Adubação orgânica rica em potássio.',
                    clima: 'Subtropical',
                    solo: 'Profundo, bem drenado, pH 6.0-7.0'
                },
                'mamao': {
                    producao: 25, // kg/m²/ano (produção muito alta no Brasil)
                    ciclo: 365,
                    plantio: 'Ano todo',
                    colheita: 'Ano todo',
                    areaMin: 4,
                    tecnica: 'Plantar sementes ou mudas. Espaçamento de 2x2m. Requer solo rico em matéria orgânica. Irrigação constante.',
                    clima: 'Tropical',
                    solo: 'Rico em matéria orgânica, pH 6.0-7.0'
                },
                'goiaba': {
                    producao: 15, // kg/m²/ano
                    ciclo: 730,
                    plantio: 'Primavera (setembro a novembro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 9,
                    tecnica: 'Plantar mudas ou estacas. Espaçamento de 5x5m. Podas de formação e produção. Adubação com esterco de curral.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, pH 5.5-7.0'
                },
                'maracuja': {
                    producao: 10, // kg/m²/ano
                    ciclo: 365,
                    plantio: 'Primavera (setembro a novembro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 2,
                    tecnica: 'Plantar sementes ou mudas. Requer suporte (espaldeira). Espaçamento de 3x3m. Polinização manual aumenta produção.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, pH 6.0-7.0'
                },
                'uva': {
                    producao: 12, // kg/m²/ano
                    ciclo: 365,
                    plantio: 'Inverno (junho a agosto)',
                    colheita: 'Verão (dezembro a fevereiro)',
                    areaMin: 3,
                    tecnica: 'Plantar mudas enxertadas em espaldeira. Espaçamento de 2x3m. Podas de inverno e verão. Controle de doenças fúngicas.',
                    clima: 'Subtropical (regiões mais frias)',
                    solo: 'Bem drenado, pH 6.0-7.0'
                },
                'acai': {
                    producao: 6, // kg/m²/ano
                    ciclo: 1095,
                    plantio: 'Ano todo',
                    colheita: 'Ano todo',
                    areaMin: 25,
                    tecnica: 'Plantar mudas em áreas alagadas ou próximas a rios. Espaçamento de 5x5m. Requer muita água. Adubação orgânica.',
                    clima: 'Tropical úmido (Amazônia)',
                    solo: 'Úmido, rico em matéria orgânica'
                },
                // Frutas nativas brasileiras
                'jabuticaba': {
                    producao: 8, // kg/m²/ano
                    ciclo: 1095,
                    plantio: 'Primavera (setembro a novembro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 12,
                    tecnica: 'Plantar mudas ou sementes. Espaçamento de 6x6m. Árvore nativa, muito adaptada ao clima brasileiro. Adubação orgânica.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, pH 5.5-7.0'
                },
                'pitanga': {
                    producao: 7, // kg/m²/ano
                    ciclo: 730,
                    plantio: 'Primavera (setembro a novembro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 9,
                    tecnica: 'Plantar mudas ou sementes. Espaçamento de 4x4m. Árvore nativa, resistente a pragas. Pode ser cultivada em vasos grandes.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, pH 5.5-7.0'
                },
                'caju': {
                    producao: 9, // kg/m²/ano
                    ciclo: 1095,
                    plantio: 'Verão (dezembro a fevereiro)',
                    colheita: 'Verão (dezembro a março)',
                    areaMin: 20,
                    tecnica: 'Plantar mudas enxertadas. Espaçamento de 8x8m. Árvore nativa do Nordeste. Muito resistente à seca após estabelecida.',
                    clima: 'Tropical (especialmente Nordeste)',
                    solo: 'Bem drenado, arenoso, pH 5.5-7.0'
                },
                'acerola': {
                    producao: 14, // kg/m²/ano
                    ciclo: 365,
                    plantio: 'Primavera (setembro a novembro)',
                    colheita: 'Ano todo (picos no verão)',
                    areaMin: 6,
                    tecnica: 'Plantar mudas ou estacas. Espaçamento de 3x3m. Muito rica em vitamina C. Podas de formação e produção.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, pH 5.5-7.0'
                },
                'coco': {
                    producao: 5, // kg/m²/ano
                    ciclo: 1095,
                    plantio: 'Verão (dezembro a fevereiro)',
                    colheita: 'Ano todo',
                    areaMin: 30,
                    tecnica: 'Plantar cocos maduros diretamente no solo. Espaçamento de 7x7m. Requer muito sol e água. Adubação com matéria orgânica.',
                    clima: 'Tropical (litoral)',
                    solo: 'Arenoso, bem drenado, pH 5.5-7.0'
                }
            },
            verduras: {
                'alface': {
                    producao: 15, // kg/m²/ano (clima brasileiro favorece)
                    ciclo: 45,
                    plantio: 'Ano todo',
                    colheita: 'Ano todo',
                    areaMin: 0.1,
                    tecnica: 'Plantar sementes em canteiros ou vasos. Espaçamento de 25x25cm. Requer solo rico em matéria orgânica. Irrigação diária.',
                    clima: 'Temperado a tropical',
                    solo: 'Rico em matéria orgânica, pH 6.0-7.0'
                },
                'couve': {
                    producao: 10, // kg/m²/ano
                    ciclo: 60,
                    plantio: 'Ano todo',
                    colheita: 'Ano todo',
                    areaMin: 0.2,
                    tecnica: 'Plantar mudas ou sementes. Espaçamento de 40x40cm. Colheita contínua das folhas. Muito resistente a pragas.',
                    clima: 'Temperado a tropical',
                    solo: 'Bem drenado, pH 6.0-7.0'
                },
                'espinafre': {
                    producao: 12, // kg/m²/ano
                    ciclo: 50,
                    plantio: 'Outono/Inverno (março a agosto)',
                    colheita: 'Inverno/Primavera (junho a outubro)',
                    areaMin: 0.1,
                    tecnica: 'Plantar sementes diretamente no solo. Espaçamento de 20x20cm. Prefere clima mais ameno. Adubação com nitrogênio.',
                    clima: 'Temperado (regiões mais frias)',
                    solo: 'Rico em matéria orgânica, pH 6.0-7.5'
                },
                'rucula': {
                    producao: 18, // kg/m²/ano
                    ciclo: 40,
                    plantio: 'Ano todo',
                    colheita: 'Ano todo',
                    areaMin: 0.1,
                    tecnica: 'Plantar sementes diretamente no solo. Espaçamento de 15x15cm. Colheita contínua das folhas. Cresce rápido.',
                    clima: 'Temperado a tropical',
                    solo: 'Bem drenado, pH 6.0-7.0'
                },
                'agriao': {
                    producao: 14, // kg/m²/ano
                    ciclo: 50,
                    plantio: 'Ano todo',
                    colheita: 'Ano todo',
                    areaMin: 0.1,
                    tecnica: 'Plantar sementes em solo úmido ou próximo a água. Espaçamento de 20x20cm. Requer muita água. Muito nutritivo.',
                    clima: 'Temperado a tropical',
                    solo: 'Úmido, rico em matéria orgânica'
                },
                'repolho': {
                    producao: 8, // kg/m²/ano
                    ciclo: 90,
                    plantio: 'Outono/Inverno (março a agosto)',
                    colheita: 'Inverno/Primavera (junho a outubro)',
                    areaMin: 0.3,
                    tecnica: 'Plantar mudas. Espaçamento de 50x50cm. Requer solo rico em matéria orgânica. Controle de lagartas.',
                    clima: 'Temperado (regiões mais frias)',
                    solo: 'Rico em matéria orgânica, pH 6.0-7.5'
                },
                'brocolis': {
                    producao: 6, // kg/m²/ano
                    ciclo: 100,
                    plantio: 'Outono (março a maio)',
                    colheita: 'Inverno (junho a agosto)',
                    areaMin: 0.3,
                    tecnica: 'Plantar mudas. Espaçamento de 50x50cm. Requer clima ameno. Adubação rica em boro. Colheita antes de florescer.',
                    clima: 'Temperado (regiões mais frias)',
                    solo: 'Rico em matéria orgânica, pH 6.0-7.5'
                },
                'couve-flor': {
                    producao: 6, // kg/m²/ano
                    ciclo: 100,
                    plantio: 'Outono (março a maio)',
                    colheita: 'Inverno (junho a agosto)',
                    areaMin: 0.3,
                    tecnica: 'Plantar mudas. Espaçamento de 50x50cm. Requer clima ameno. Amarrar folhas para proteger a cabeça. Controle de pragas.',
                    clima: 'Temperado (regiões mais frias)',
                    solo: 'Rico em matéria orgânica, pH 6.0-7.5'
                },
                'acelga': {
                    producao: 10, // kg/m²/ano
                    ciclo: 60,
                    plantio: 'Ano todo',
                    colheita: 'Ano todo',
                    areaMin: 0.2,
                    tecnica: 'Plantar sementes ou mudas. Espaçamento de 30x30cm. Colheita contínua das folhas. Muito resistente.',
                    clima: 'Temperado a tropical',
                    solo: 'Bem drenado, pH 6.0-7.0'
                },
                'salsinha': {
                    producao: 8, // kg/m²/ano
                    ciclo: 70,
                    plantio: 'Ano todo',
                    colheita: 'Ano todo',
                    areaMin: 0.1,
                    tecnica: 'Plantar sementes (germinação lenta). Espaçamento de 20x20cm. Colheita contínua das folhas. Prefere meia-sombra.',
                    clima: 'Temperado a tropical',
                    solo: 'Bem drenado, rico em matéria orgânica'
                },
                'coentro': {
                    producao: 6, // kg/m²/ano
                    ciclo: 50,
                    plantio: 'Ano todo',
                    colheita: 'Ano todo',
                    areaMin: 0.1,
                    tecnica: 'Plantar sementes diretamente no solo. Espaçamento de 15x15cm. Colheita antes de florescer. Muito usado na culinária brasileira.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, pH 6.0-7.0'
                },
                'manjericao': {
                    producao: 5, // kg/m²/ano
                    ciclo: 60,
                    plantio: 'Primavera/Verão (setembro a fevereiro)',
                    colheita: 'Ano todo',
                    areaMin: 0.1,
                    tecnica: 'Plantar sementes ou mudas. Espaçamento de 25x25cm. Colheita contínua das folhas. Prefere sol pleno.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, pH 6.0-7.0'
                }
            },
            legumes: {
                'tomate': {
                    producao: 10, // kg/m²/ano
                    ciclo: 120,
                    plantio: 'Primavera/Verão (setembro a fevereiro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 0.3,
                    tecnica: 'Plantar mudas. Espaçamento de 50x50cm. Requer tutoramento. Controle de doenças fúngicas. Adubação rica em potássio.',
                    clima: 'Temperado a tropical',
                    solo: 'Bem drenado, rico em matéria orgânica, pH 6.0-7.0'
                },
                'cenoura': {
                    producao: 8, // kg/m²/ano
                    ciclo: 90,
                    plantio: 'Ano todo',
                    colheita: 'Ano todo',
                    areaMin: 0.1,
                    tecnica: 'Plantar sementes diretamente no solo. Espaçamento de 5x20cm. Solo solto e profundo. Desbaste quando necessário.',
                    clima: 'Temperado a tropical',
                    solo: 'Solo solto, arenoso, pH 6.0-7.5'
                },
                'beterraba': {
                    producao: 7, // kg/m²/ano
                    ciclo: 80,
                    plantio: 'Ano todo',
                    colheita: 'Ano todo',
                    areaMin: 0.1,
                    tecnica: 'Plantar sementes diretamente no solo. Espaçamento de 10x20cm. Solo rico em matéria orgânica. Desbaste quando necessário.',
                    clima: 'Temperado a tropical',
                    solo: 'Bem drenado, rico em matéria orgânica, pH 6.0-7.5'
                },
                'abobora': {
                    producao: 5, // kg/m²/ano
                    ciclo: 100,
                    plantio: 'Primavera (setembro a novembro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 1,
                    tecnica: 'Plantar sementes diretamente no solo. Espaçamento de 2x2m. Requer muito espaço. Adubação orgânica. Controle de pragas.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, rico em matéria orgânica'
                },
                'abobrinha': {
                    producao: 12, // kg/m²/ano
                    ciclo: 60,
                    plantio: 'Primavera/Verão (setembro a fevereiro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 0.5,
                    tecnica: 'Plantar sementes ou mudas. Espaçamento de 80x80cm. Colheita quando ainda pequenas. Muito produtiva.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, rico em matéria orgânica'
                },
                'pepino': {
                    producao: 15, // kg/m²/ano
                    ciclo: 70,
                    plantio: 'Primavera/Verão (setembro a fevereiro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 0.3,
                    tecnica: 'Plantar sementes ou mudas. Espaçamento de 50x50cm. Requer tutoramento. Irrigação constante. Colheita frequente.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, rico em matéria orgânica'
                },
                'pimentao': {
                    producao: 8, // kg/m²/ano
                    ciclo: 120,
                    plantio: 'Primavera (setembro a novembro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 0.3,
                    tecnica: 'Plantar mudas. Espaçamento de 50x50cm. Requer tutoramento. Controle de pragas. Adubação rica em potássio.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, rico em matéria orgânica'
                },
                'berinjela': {
                    producao: 7, // kg/m²/ano
                    ciclo: 120,
                    plantio: 'Primavera (setembro a novembro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 0.3,
                    tecnica: 'Plantar mudas. Espaçamento de 60x60cm. Requer tutoramento. Controle de pragas. Colheita quando brilhante.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, rico em matéria orgânica'
                },
                'feijao': {
                    producao: 3, // kg/m²/ano
                    ciclo: 80,
                    plantio: 'Ano todo',
                    colheita: 'Ano todo',
                    areaMin: 0.2,
                    tecnica: 'Plantar sementes diretamente no solo. Espaçamento de 30x30cm. Fixa nitrogênio no solo. Colheita quando vagens secas.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, pH 6.0-7.0'
                },
                'milho': {
                    producao: 2, // kg/m²/ano
                    ciclo: 100,
                    plantio: 'Primavera/Verão (setembro a fevereiro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 0.2,
                    tecnica: 'Plantar sementes diretamente no solo. Espaçamento de 30x80cm. Plantio em fileiras para polinização. Colheita quando espigas maduras.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, rico em matéria orgânica'
                },
                'batata': {
                    producao: 5, // kg/m²/ano
                    ciclo: 100,
                    plantio: 'Inverno/Primavera (junho a setembro)',
                    colheita: 'Primavera/Verão (setembro a dezembro)',
                    areaMin: 0.2,
                    tecnica: 'Plantar batatas-semente. Espaçamento de 30x80cm. Amontoa quando plantas têm 20cm. Colheita quando folhas secam.',
                    clima: 'Temperado (regiões mais frias)',
                    solo: 'Solo solto, bem drenado, pH 5.0-6.5'
                },
                'cebola': {
                    producao: 7, // kg/m²/ano
                    ciclo: 120,
                    plantio: 'Outono/Inverno (março a agosto)',
                    colheita: 'Primavera/Verão (setembro a dezembro)',
                    areaMin: 0.1,
                    tecnica: 'Plantar mudas ou bulbos. Espaçamento de 10x30cm. Solo bem drenado. Colheita quando folhas secam. Secagem ao sol.',
                    clima: 'Temperado a subtropical',
                    solo: 'Bem drenado, pH 6.0-7.0'
                },
                'alho': {
                    producao: 4, // kg/m²/ano
                    ciclo: 150,
                    plantio: 'Outono (março a maio)',
                    colheita: 'Primavera (setembro a novembro)',
                    areaMin: 0.1,
                    tecnica: 'Plantar dentes de alho. Espaçamento de 10x25cm. Solo bem drenado. Colheita quando folhas secam. Secagem ao sol.',
                    clima: 'Temperado (regiões mais frias)',
                    solo: 'Bem drenado, pH 6.0-7.0'
                },
                'quiabo': {
                    producao: 9, // kg/m²/ano
                    ciclo: 90,
                    plantio: 'Primavera/Verão (setembro a fevereiro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 0.3,
                    tecnica: 'Plantar sementes diretamente no solo. Espaçamento de 50x50cm. Colheita quando ainda pequeno. Muito usado na culinária brasileira.',
                    clima: 'Tropical e subtropical',
                    solo: 'Bem drenado, rico em matéria orgânica'
                },
                'maxixe': {
                    producao: 8, // kg/m²/ano
                    ciclo: 70,
                    plantio: 'Primavera/Verão (setembro a fevereiro)',
                    colheita: 'Verão/Outono (dezembro a maio)',
                    areaMin: 0.3,
                    tecnica: 'Plantar sementes diretamente no solo. Espaçamento de 50x50cm. Requer tutoramento. Colheita frequente. Típico do Nordeste.',
                    clima: 'Tropical',
                    solo: 'Bem drenado, rico em matéria orgânica'
                }
            }
        },
        animais: {
            'galinha-ovos': {
                producaoDiaria: 0.7, // ovos/dia por animal (média de 5 ovos/semana por galinha)
                producaoUnidade: 'ovos/dia',
                producaoPorUnidade: 0.06, // kg por ovo
                espaco: 2, // m² por animal
                cicloReprodutivo: 365,
                producaoCiclo: 250, // ovos/ano
                tempoCrescimento: 180,
                consumoRacao: 0.12, // kg/dia
                tecnica: 'Criar em galinheiro com área de pastejo. Fornecer ração balanceada, água limpa e suplementação com milho. Coleta diária de ovos. Controle de predadores. Raças recomendadas: Isa Brown, Lohmann Brown, Rhode Island Red.',
                clima: 'Tropical e subtropical',
                alimentacao: 'Ração, milho, restos de comida, insetos, verduras'
            },
            'frango-corte': {
                producaoDiaria: 0, // não produz diariamente
                producaoUnidade: 'kg/ciclo',
                producaoPorUnidade: 2.5, // kg de carne por frango (peso médio de abate)
                espaco: 1.5, // m² por animal (menor que galinha poedeira)
                cicloReprodutivo: 60, // 6 ciclos/ano (abate aos 60 dias)
                producaoCiclo: 2.5, // kg de carne por frango
                tempoCrescimento: 60, // dias até abate
                consumoRacao: 0.15, // kg/dia
                tecnica: 'Criar em galinheiro ou sistema de confinamento. Alimentação com ração de crescimento. Abate aos 60 dias (peso médio 2.5kg). Controle de temperatura e ventilação. Raças recomendadas: Cobb, Ross, Hubbard.',
                clima: 'Tropical e subtropical',
                alimentacao: 'Ração para frangos de corte, milho, suplementos'
            },
            'porco': {
                producaoDiaria: 0,
                producaoUnidade: 'kg/ciclo',
                producaoPorUnidade: 90, // kg de carne por animal (raças brasileiras)
                espaco: 12, // m² por animal
                cicloReprodutivo: 365,
                producaoCiclo: 90,
                tempoCrescimento: 180,
                consumoRacao: 3, // kg/dia
                tecnica: 'Criar em chiqueiro com área de exercício. Alimentação com ração, restos de comida e milho. Controle de parasitas. Vacinação obrigatória.',
                clima: 'Tropical e subtropical',
                alimentacao: 'Ração, milho, restos de comida, frutas, verduras'
            },
            'vaca-leite': {
                producaoDiaria: 18, // litros de leite/dia (raças adaptadas ao Brasil)
                producaoUnidade: 'L/dia',
                producaoPorUnidade: 1,
                espaco: 60, // m² por animal
                cicloReprodutivo: 365,
                producaoCiclo: 0,
                tempoCrescimento: 730,
                consumoRacao: 30, // kg/dia
                tecnica: 'Criar em pasto com suplementação. Ordenha duas vezes ao dia. Controle veterinário. Vacinação. Raças adaptadas: Gir, Girolando, Nelore.',
                clima: 'Tropical e subtropical',
                alimentacao: 'Pasto, feno, ração, sal mineral'
            },
            'vaca-corte': {
                producaoDiaria: 0, // não produz diariamente
                producaoUnidade: 'kg/ciclo',
                producaoPorUnidade: 350, // kg de carne por animal (peso médio de abate)
                espaco: 60, // m² por animal
                cicloReprodutivo: 1095, // 3 anos (tempo para abate)
                producaoCiclo: 350, // kg de carne por ciclo
                tempoCrescimento: 1095, // dias até abate (3 anos)
                consumoRacao: 25, // kg/dia
                tecnica: 'Criar em pasto extensivo com suplementação. Controle veterinário. Vacinação. Raças de corte: Nelore, Angus, Brahman. Abate aos 3 anos.',
                clima: 'Tropical e subtropical',
                alimentacao: 'Pasto, feno, ração, sal mineral'
            },
            'cabrito': {
                producaoDiaria: 2.5, // litros de leite/dia
                producaoUnidade: 'L/dia',
                producaoPorUnidade: 1,
                espaco: 8, // m² por animal
                cicloReprodutivo: 365,
                producaoCiclo: 0,
                tempoCrescimento: 180,
                consumoRacao: 2.5, // kg/dia
                tecnica: 'Criar em área cercada com abrigo. Alimentação com pasto, feno e ração. Ordenha diária. Muito adaptado ao clima brasileiro.',
                clima: 'Tropical e subtropical',
                alimentacao: 'Pasto, feno, ração, sal mineral'
            },
            'coelho': {
                producaoDiaria: 0,
                producaoUnidade: 'kg/ciclo',
                producaoPorUnidade: 2.5, // kg de carne por animal
                espaco: 1, // m² por animal
                cicloReprodutivo: 90, // 4 crias/ano
                producaoCiclo: 2.5,
                tempoCrescimento: 90,
                consumoRacao: 0.15, // kg/dia
                tecnica: 'Criar em gaiolas ou viveiros. Alimentação com ração, feno e verduras. Controle de temperatura. Reprodução controlada.',
                clima: 'Temperado a tropical',
                alimentacao: 'Ração, feno, verduras, frutas'
            },
            'peixe': {
                producaoDiaria: 0,
                producaoUnidade: 'kg/ciclo',
                producaoPorUnidade: 1.2, // kg por peixe (tilápia)
                espaco: 0.5, // m² por peixe (tanque)
                cicloReprodutivo: 180, // 2 ciclos/ano
                producaoCiclo: 1.2,
                tempoCrescimento: 180,
                consumoRacao: 0.02, // kg/dia
                tecnica: 'Criar em tanques ou viveiros. Espécies recomendadas: tilápia, tambaqui, pacu. Alimentação com ração. Controle de qualidade da água. Oxigenação.',
                clima: 'Tropical e subtropical',
                alimentacao: 'Ração para peixes, algas, insetos'
            },
            'patos': {
                producaoDiaria: 0.5, // ovos/dia
                producaoUnidade: 'ovos/dia',
                producaoPorUnidade: 0.08, // kg por ovo
                espaco: 3, // m² por animal
                cicloReprodutivo: 365,
                producaoCiclo: 180, // ovos/ano
                tempoCrescimento: 180,
                consumoRacao: 0.15, // kg/dia
                tecnica: 'Criar em área com acesso à água. Alimentação com ração, milho e verduras. Muito resistente a doenças. Controle de predadores.',
                clima: 'Tropical e subtropical',
                alimentacao: 'Ração, milho, verduras, insetos, algas'
            }
        }
    },
    'it-IT': {
        // ============================================
        // PRODOTTI TIPICI DELL'ITALIA
        // ============================================
        plantas: {
            frutas: {
                // Frutti tipici italiani
                'uva': {
                    producao: 14, // kg/m²/ano (clima mediterrâneo favorece)
                    ciclo: 365,
                    plantio: 'Inverno (dicembre a febbraio)',
                    colheita: 'Estate/Autunno (agosto a ottobre)',
                    areaMin: 3,
                    tecnica: 'Piantare viti innestate su filari. Spaziatura di 2x3m. Potatura invernale e estiva. Controllo malattie fungine. Varietà: Sangiovese, Nebbiolo, Trebbiano.',
                    clima: 'Mediterraneo e temperato',
                    solo: 'Ben drenato, pH 6.0-7.5'
                },
                'oliva': {
                    producao: 6, // kg/m²/ano (azeitona)
                    ciclo: 1095,
                    plantio: 'Autunno/Primavera (ottobre a marzo)',
                    colheita: 'Autunno (ottobre a dicembre)',
                    areaMin: 16,
                    tecnica: 'Piantare olivi innestati. Spaziatura di 6x6m. Potatura annuale. Molto resistente alla siccità. Varietà: Frantoio, Leccino, Coratina.',
                    clima: 'Mediterraneo',
                    solo: 'Ben drenato, calcareo, pH 6.0-8.0'
                },
                'figo': {
                    producao: 12, // kg/m²/ano
                    ciclo: 730,
                    plantio: 'Autunno/Primavera (ottobre a marzo)',
                    colheita: 'Estate/Autunno (luglio a settembre)',
                    areaMin: 9,
                    tecnica: 'Piantare talee o piante innestate. Spaziatura di 5x5m. Molto resistente. Potatura leggera. Varietà: Dottato, Brogiotto.',
                    clima: 'Mediterraneo e temperato',
                    solo: 'Ben drenato, pH 6.0-7.5'
                },
                'pesca': {
                    producao: 11, // kg/m²/ano
                    ciclo: 730,
                    plantio: 'Autunno/Primavera (ottobre a marzo)',
                    colheita: 'Estate (giugno a settembre)',
                    areaMin: 12,
                    tecnica: 'Piantare piante innestate. Spaziatura di 5x5m. Potatura annuale. Controllo afidi. Varietà: Pesca gialla, Pesca bianca, Nettarina.',
                    clima: 'Temperato',
                    solo: 'Ben drenato, pH 6.0-7.0'
                },
                'albicocca': {
                    producao: 10, // kg/m²/ano
                    ciclo: 730,
                    plantio: 'Autunno/Primavera (ottobre a marzo)',
                    colheita: 'Estate (giugno a luglio)',
                    areaMin: 10,
                    tecnica: 'Piantare piante innestate. Spaziatura di 5x5m. Potatura annuale. Fioritura precoce. Varietà: Reale d\'Imola, Val Venosta.',
                    clima: 'Temperato',
                    solo: 'Ben drenato, pH 6.0-7.0'
                },
                'prugna': {
                    producao: 9, // kg/m²/ano
                    ciclo: 730,
                    plantio: 'Autunno/Primavera (ottobre a marzo)',
                    colheita: 'Estate/Autunno (luglio a settembre)',
                    areaMin: 10,
                    tecnica: 'Piantare piante innestate. Spaziatura di 5x5m. Potatura annuale. Varietà: Susina gialla, Susina nera, Regina Claudia.',
                    clima: 'Temperato',
                    solo: 'Ben drenato, pH 6.0-7.0'
                },
                'pera': {
                    producao: 13, // kg/m²/ano
                    ciclo: 1095,
                    plantio: 'Autunno/Primavera (ottobre a marzo)',
                    colheita: 'Estate/Autunno (agosto a ottobre)',
                    areaMin: 12,
                    tecnica: 'Piantare piante innestate. Spaziatura di 5x5m. Potatura annuale. Richiede impollinazione incrociata. Varietà: Abate Fetel, Williams, Conference.',
                    clima: 'Temperato',
                    solo: 'Ben drenato, pH 6.0-7.0'
                },
                'mela': {
                    producao: 15, // kg/m²/ano
                    ciclo: 1095,
                    plantio: 'Autunno/Primavera (ottobre a marzo)',
                    colheita: 'Autunno (settembre a novembre)',
                    areaMin: 12,
                    tecnica: 'Piantare piante innestate. Spaziatura di 5x5m. Potatura annuale. Controllo malattie. Varietà: Golden Delicious, Granny Smith, Fuji, Gala.',
                    clima: 'Temperato (regioni più fredde)',
                    solo: 'Ben drenato, pH 6.0-7.0'
                },
                'limone': {
                    producao: 13, // kg/m²/ano
                    ciclo: 730,
                    plantio: 'Primavera (marzo a maggio)',
                    colheita: 'Anno intero (picchi in inverno)',
                    areaMin: 9,
                    tecnica: 'Piantare piante innestate. Spaziatura di 5x5m. Potatura annuale. Protezione dal freddo in inverno. Varietà: Femminello, Monachello.',
                    clima: 'Mediterraneo (specialmente Sud)',
                    solo: 'Ben drenato, pH 5.5-7.0'
                },
                'arancia': {
                    producao: 16, // kg/m²/ano
                    ciclo: 1095,
                    plantio: 'Autunno (ottobre a dicembre)',
                    colheita: 'Inverno/Primavera (dicembre a maggio)',
                    areaMin: 12,
                    tecnica: 'Piantare piante innestate. Spaziatura di 6x6m. Irrigazione a goccia. Controllo parassiti. Varietà: Tarocco, Moro, Navel, Sanguinello.',
                    clima: 'Mediterraneo (specialmente Sicilia)',
                    solo: 'Ben drenato, pH 6.0-7.0'
                },
                'kiwi': {
                    producao: 8, // kg/m²/ano
                    ciclo: 1095,
                    plantio: 'Autunno/Primavera (ottobre a marzo)',
                    colheita: 'Autunno (ottobre a novembre)',
                    areaMin: 6,
                    tecnica: 'Piantare piante maschili e femminili. Spaziatura di 4x4m. Richiede pergolato. Potatura annuale. Varietà: Hayward, Bruno.',
                    clima: 'Temperato (regioni settentrionali)',
                    solo: 'Ben drenato, ricco di materia organica, pH 6.0-7.0'
                },
                'castagna': {
                    producao: 5, // kg/m²/ano
                    ciclo: 1095,
                    plantio: 'Autunno/Primavera (ottobre a marzo)',
                    colheita: 'Autunno (settembre a novembre)',
                    areaMin: 25,
                    tecnica: 'Piantare castagni innestati. Spaziatura di 8x8m. Potatura annuale. Molto resistente. Varietà: Marrone, Castagna comune.',
                    clima: 'Temperato (regioni montane)',
                    solo: 'Ben drenato, acido, pH 5.0-6.5'
                }
            },
            verduras: {
                'lattuga': {
                    producao: 14, // kg/m²/ano
                    ciclo: 45,
                    plantio: 'Anno intero',
                    colheita: 'Anno intero',
                    areaMin: 0.1,
                    tecnica: 'Piantare semi in aiuole o vasi. Spaziatura di 25x25cm. Richiede terreno ricco di materia organica. Irrigazione quotidiana.',
                    clima: 'Temperato',
                    solo: 'Ricco di materia organica, pH 6.0-7.0'
                },
                'spinaci': {
                    producao: 11, // kg/m²/ano
                    ciclo: 50,
                    plantio: 'Autunno/Inverno (settembre a febbraio)',
                    colheita: 'Inverno/Primavera (novembre a maggio)',
                    areaMin: 0.1,
                    tecnica: 'Piantare semi direttamente nel terreno. Spaziatura di 20x20cm. Preferisce clima più fresco. Concimazione con azoto.',
                    clima: 'Temperato',
                    solo: 'Ricco di materia organica, pH 6.0-7.5'
                },
                'rucola': {
                    producao: 17, // kg/m²/ano
                    ciclo: 40,
                    plantio: 'Anno intero',
                    colheita: 'Anno intero',
                    areaMin: 0.1,
                    tecnica: 'Piantare semi direttamente nel terreno. Spaziatura di 15x15cm. Raccolta continua delle foglie. Cresce rapidamente.',
                    clima: 'Temperato',
                    solo: 'Ben drenato, pH 6.0-7.0'
                },
                'cavolo': {
                    producao: 9, // kg/m²/ano
                    ciclo: 90,
                    plantio: 'Autunno/Inverno (settembre a febbraio)',
                    colheita: 'Inverno/Primavera (novembre a maggio)',
                    areaMin: 0.3,
                    tecnica: 'Piantare piantine. Spaziatura di 50x50cm. Richiede terreno ricco di materia organica. Controllo bruchi.',
                    clima: 'Temperato',
                    solo: 'Ricco di materia organica, pH 6.0-7.5'
                },
                'broccoli': {
                    producao: 7, // kg/m²/ano
                    ciclo: 100,
                    plantio: 'Autunno (settembre a novembre)',
                    colheita: 'Inverno (dicembre a febbraio)',
                    areaMin: 0.3,
                    tecnica: 'Piantare piantine. Spaziatura di 50x50cm. Richiede clima fresco. Concimazione ricca di boro. Raccolta prima della fioritura.',
                    clima: 'Temperato',
                    solo: 'Ricco di materia organica, pH 6.0-7.5'
                },
                'cavolfiore': {
                    producao: 7, // kg/m²/ano
                    ciclo: 100,
                    plantio: 'Autunno (settembre a novembre)',
                    colheita: 'Inverno (dicembre a febbraio)',
                    areaMin: 0.3,
                    tecnica: 'Piantare piantine. Spaziatura di 50x50cm. Richiede clima fresco. Legare foglie per proteggere la testa. Controllo parassiti.',
                    clima: 'Temperato',
                    solo: 'Ricco di materia organica, pH 6.0-7.5'
                },
                'bietola': {
                    producao: 11, // kg/m²/ano
                    ciclo: 60,
                    plantio: 'Anno intero',
                    colheita: 'Anno intero',
                    areaMin: 0.2,
                    tecnica: 'Piantare semi o piantine. Spaziatura di 30x30cm. Raccolta continua delle foglie. Molto resistente.',
                    clima: 'Temperato',
                    solo: 'Ben drenato, pH 6.0-7.0'
                },
                'prezzemolo': {
                    producao: 7, // kg/m²/ano
                    ciclo: 70,
                    plantio: 'Anno intero',
                    colheita: 'Anno intero',
                    areaMin: 0.1,
                    tecnica: 'Piantare semi (germinazione lenta). Spaziatura di 20x20cm. Raccolta continua delle foglie. Preferisce mezz\'ombra.',
                    clima: 'Temperato',
                    solo: 'Ben drenato, ricco di materia organica'
                },
                'basilico': {
                    producao: 6, // kg/m²/ano
                    ciclo: 60,
                    plantio: 'Primavera/Estate (marzo a luglio)',
                    colheita: 'Estate/Autunno (giugno a ottobre)',
                    areaMin: 0.1,
                    tecnica: 'Piantare semi o piantine. Spaziatura di 25x25cm. Raccolta continua delle foglie. Preferisce sole pieno. Tipico della cucina italiana.',
                    clima: 'Mediterraneo e temperato',
                    solo: 'Ben drenato, pH 6.0-7.0'
                },
                'rosmarino': {
                    producao: 4, // kg/m²/ano
                    ciclo: 365,
                    plantio: 'Primavera (marzo a maggio)',
                    colheita: 'Anno intero',
                    areaMin: 0.5,
                    tecnica: 'Piantare talee o piantine. Spaziatura di 50x50cm. Arbusto perenne. Molto resistente alla siccità. Tipico della cucina italiana.',
                    clima: 'Mediterraneo',
                    solo: 'Ben drenato, calcareo, pH 6.0-8.0'
                },
                'origano': {
                    producao: 3, // kg/m²/ano
                    ciclo: 365,
                    plantio: 'Primavera (marzo a maggio)',
                    colheita: 'Anno intero',
                    areaMin: 0.3,
                    tecnica: 'Piantare talee o piantine. Spaziatura di 30x30cm. Pianta perenne. Molto resistente. Tipico della cucina italiana.',
                    clima: 'Mediterraneo',
                    solo: 'Ben drenato, pH 6.0-7.5'
                }
            },
            legumes: {
                'pomodoro': {
                    producao: 11, // kg/m²/ano
                    ciclo: 120,
                    plantio: 'Primavera (marzo a maggio)',
                    colheita: 'Estate/Autunno (giugno a ottobre)',
                    areaMin: 0.3,
                    tecnica: 'Piantare piantine. Spaziatura di 50x50cm. Richiede tutoraggio. Controllo malattie fungine. Concimazione ricca di potassio. Varietà: San Marzano, Pomodoro da insalata.',
                    clima: 'Temperato e mediterraneo',
                    solo: 'Ben drenato, ricco di materia organica, pH 6.0-7.0'
                },
                'carota': {
                    producao: 9, // kg/m²/ano
                    ciclo: 90,
                    plantio: 'Anno intero',
                    colheita: 'Anno intero',
                    areaMin: 0.1,
                    tecnica: 'Piantare semi direttamente nel terreno. Spaziatura di 5x20cm. Terreno sciolto e profondo. Diradamento quando necessario.',
                    clima: 'Temperato',
                    solo: 'Terreno sciolto, sabbioso, pH 6.0-7.5'
                },
                'barbabietola': {
                    producao: 8, // kg/m²/ano
                    ciclo: 80,
                    plantio: 'Anno intero',
                    colheita: 'Anno intero',
                    areaMin: 0.1,
                    tecnica: 'Piantare semi direttamente nel terreno. Spaziatura di 10x20cm. Terreno ricco di materia organica. Diradamento quando necessario.',
                    clima: 'Temperato',
                    solo: 'Ben drenato, ricco di materia organica, pH 6.0-7.5'
                },
                'zucchina': {
                    producao: 13, // kg/m²/ano
                    ciclo: 60,
                    plantio: 'Primavera/Estate (marzo a luglio)',
                    colheita: 'Estate/Autunno (giugno a ottobre)',
                    areaMin: 0.5,
                    tecnica: 'Piantare semi o piantine. Spaziatura di 80x80cm. Raccolta quando ancora piccole. Molto produttiva. Tipica della cucina italiana.',
                    clima: 'Temperato e mediterraneo',
                    solo: 'Ben drenato, ricco di materia organica'
                },
                'peperone': {
                    producao: 9, // kg/m²/ano
                    ciclo: 120,
                    plantio: 'Primavera (marzo a maggio)',
                    colheita: 'Estate/Autunno (giugno a ottobre)',
                    areaMin: 0.3,
                    tecnica: 'Piantare piantine. Spaziatura di 50x50cm. Richiede tutoraggio. Controllo parassiti. Concimazione ricca di potassio.',
                    clima: 'Temperato e mediterraneo',
                    solo: 'Ben drenato, ricco di materia organica'
                },
                'melanzana': {
                    producao: 8, // kg/m²/ano
                    ciclo: 120,
                    plantio: 'Primavera (marzo a maggio)',
                    colheita: 'Estate/Autunno (giugno a ottobre)',
                    areaMin: 0.3,
                    tecnica: 'Piantare piantine. Spaziatura di 60x60cm. Richiede tutoraggio. Controllo parassiti. Raccolta quando lucida. Tipica della cucina italiana.',
                    clima: 'Temperato e mediterraneo',
                    solo: 'Ben drenato, ricco di materia organica'
                },
                'fagioli': {
                    producao: 3.5, // kg/m²/ano
                    ciclo: 80,
                    plantio: 'Primavera/Estate (marzo a luglio)',
                    colheita: 'Estate/Autunno (giugno a ottobre)',
                    areaMin: 0.2,
                    tecnica: 'Piantare semi direttamente nel terreno. Spaziatura di 30x30cm. Fissa azoto nel terreno. Raccolta quando baccelli secchi. Varietà: Borlotti, Cannellini.',
                    clima: 'Temperato',
                    solo: 'Ben drenato, pH 6.0-7.0'
                },
                'ceci': {
                    producao: 2.5, // kg/m²/ano
                    ciclo: 120,
                    plantio: 'Primavera (marzo a maggio)',
                    colheita: 'Estate (luglio a settembre)',
                    areaMin: 0.2,
                    tecnica: 'Piantare semi direttamente nel terreno. Spaziatura di 30x30cm. Molto resistente alla siccità. Tipico della cucina italiana.',
                    clima: 'Mediterraneo',
                    solo: 'Ben drenato, pH 6.0-7.5'
                },
                'lenticchie': {
                    producao: 2, // kg/m²/ano
                    ciclo: 100,
                    plantio: 'Autunno/Primavera (ottobre a marzo)',
                    colheita: 'Estate (luglio a agosto)',
                    areaMin: 0.2,
                    tecnica: 'Piantare semi direttamente nel terreno. Spaziatura di 20x20cm. Molto resistente. Tipico della cucina italiana.',
                    clima: 'Temperato',
                    solo: 'Ben drenato, pH 6.0-7.5'
                },
                'cipolla': {
                    producao: 8, // kg/m²/ano
                    ciclo: 120,
                    plantio: 'Autunno/Inverno (settembre a febbraio)',
                    colheita: 'Primavera/Estate (maggio a luglio)',
                    areaMin: 0.1,
                    tecnica: 'Piantare piantine o bulbi. Spaziatura di 10x30cm. Terreno ben drenato. Raccolta quando foglie secche. Essiccazione al sole.',
                    clima: 'Temperato',
                    solo: 'Ben drenato, pH 6.0-7.0'
                },
                'aglio': {
                    producao: 5, // kg/m²/ano
                    ciclo: 150,
                    plantio: 'Autunno (ottobre a dicembre)',
                    colheita: 'Primavera/Estate (maggio a luglio)',
                    areaMin: 0.1,
                    tecnica: 'Piantare spicchi d\'aglio. Spaziatura di 10x25cm. Terreno ben drenato. Raccolta quando foglie secche. Essiccazione al sole. Tipico della cucina italiana.',
                    clima: 'Temperato',
                    solo: 'Ben drenato, pH 6.0-7.0'
                },
                'patata': {
                    producao: 6, // kg/m²/ano
                    ciclo: 100,
                    plantio: 'Primavera (marzo a maggio)',
                    colheita: 'Estate/Autunno (luglio a settembre)',
                    areaMin: 0.2,
                    tecnica: 'Piantare patate da semina. Spaziatura di 30x80cm. Rincalzatura quando piante hanno 20cm. Raccolta quando foglie secche.',
                    clima: 'Temperato',
                    solo: 'Terreno sciolto, ben drenato, pH 5.0-6.5'
                },
                'fagiolini': {
                    producao: 7, // kg/m²/ano
                    ciclo: 70,
                    plantio: 'Primavera/Estate (marzo a luglio)',
                    colheita: 'Estate/Autunno (giugno a ottobre)',
                    areaMin: 0.2,
                    tecnica: 'Piantare semi direttamente nel terreno. Spaziatura di 30x30cm. Richiede tutoraggio. Raccolta frequente quando ancora teneri.',
                    clima: 'Temperato',
                    solo: 'Ben drenato, ricco di materia organica'
                }
            }
        },
        animais: {
            'gallina-ovos': {
                producaoDiaria: 0.65, // ovos/dia por animale (media di 4-5 uova/settimana per gallina)
                producaoUnidade: 'ovos/dia',
                producaoPorUnidade: 0.06, // kg por ovo
                espaco: 2, // m² por animal
                cicloReprodutivo: 365,
                producaoCiclo: 240, // ovos/ano
                tempoCrescimento: 180,
                consumoRacao: 0.12, // kg/dia
                tecnica: 'Allevare in pollaio con area di pascolo. Fornire mangime bilanciato, acqua pulita e integrazione con mais. Raccolta quotidiana delle uova. Controllo predatori. Razze: Livorno, Padovana.',
                clima: 'Temperato e mediterraneo',
                alimentacao: 'Mangime, mais, avanzi di cibo, insetti, verdure'
            },
            'pollo-corte': {
                producaoDiaria: 0, // non produce quotidianamente
                producaoUnidade: 'kg/ciclo',
                producaoPorUnidade: 2.5, // kg di carne per pollo (peso medio di macellazione)
                espaco: 1.5, // m² per animale (minore della gallina ovaiola)
                cicloReprodutivo: 60, // giorni (tempo per macellazione)
                producaoCiclo: 2.5, // kg di carne per ciclo
                tempoCrescimento: 60, // giorni fino alla macellazione
                consumoRacao: 0.15, // kg/dia
                tecnica: 'Allevare in sistema semi-intensivo o intensivo. Fornire mangime di ingrasso, acqua pulita. Controllo temperatura e ventilazione. Macellazione a 60 giorni.',
                clima: 'Controllato (capannone)',
                alimentacao: 'Mangime di ingrasso'
            },
            'maiale': {
                producaoDiaria: 0,
                producaoUnidade: 'kg/ciclo',
                producaoPorUnidade: 85, // kg de carne por animal
                espaco: 10, // m² por animal
                cicloReprodutivo: 365,
                producaoCiclo: 85,
                tempoCrescimento: 180,
                consumoRacao: 2.8, // kg/dia
                tecnica: 'Allevare in porcile con area di esercizio. Alimentazione con mangime, avanzi di cibo e mais. Controllo parassiti. Vaccinazione obbligatoria. Razze: Cinta Senese, Large White.',
                clima: 'Temperato',
                alimentacao: 'Mangime, mais, avanzi di cibo, frutta, verdure'
            },
            'mucca-latte': {
                producaoDiaria: 20, // litri di latte/giorno (razze italiane)
                producaoUnidade: 'L/dia',
                producaoPorUnidade: 1,
                espaco: 55, // m² per animale
                cicloReprodutivo: 365,
                producaoCiclo: 0,
                tempoCrescimento: 730,
                consumoRacao: 28, // kg/giorno
                tecnica: 'Allevare al pascolo con integrazione. Mungitura due volte al giorno. Controllo veterinario. Vaccinazione. Razze: Frisona, Bruna Alpina, Pezzata Rossa.',
                clima: 'Temperato',
                alimentacao: 'Pascolo, fieno, mangime, sale minerale'
            },
            'mucca-carne': {
                producaoDiaria: 0, // non produce quotidianamente
                producaoUnidade: 'kg/ciclo',
                producaoPorUnidade: 400, // kg di carne per animale (peso medio di macellazione)
                espaco: 55, // m² per animale
                cicloReprodutivo: 1095, // 3 anni (tempo per macellazione)
                producaoCiclo: 400, // kg di carne per ciclo
                tempoCrescimento: 1095, // giorni fino alla macellazione (3 anni)
                consumoRacao: 22, // kg/giorno
                tecnica: 'Allevare al pascolo estensivo con integrazione. Controllo veterinario. Vaccinazione. Razze da carne: Chianina, Marchigiana, Romagnola. Macellazione a 3 anni.',
                clima: 'Temperato',
                alimentacao: 'Pascolo, fieno, mangime, sale minerale'
            },
            'capra': {
                producaoDiaria: 3, // litros de leite/dia
                producaoUnidade: 'L/dia',
                producaoPorUnidade: 1,
                espaco: 8, // m² por animal
                cicloReprodutivo: 365,
                producaoCiclo: 0,
                tempoCrescimento: 180,
                consumoRacao: 2.5, // kg/dia
                tecnica: 'Allevare in area recintata con riparo. Alimentazione con pascolo, fieno e mangime. Mungitura quotidiana. Molto adattata al clima italiano. Razze: Saanen, Camosciata delle Alpi.',
                clima: 'Temperato e mediterraneo',
                alimentacao: 'Pascolo, fieno, mangime, sale minerale'
            },
            'coniglio': {
                producaoDiaria: 0,
                producaoUnidade: 'kg/ciclo',
                producaoPorUnidade: 2.3, // kg de carne por animal
                espaco: 1, // m² por animal
                cicloReprodutivo: 90, // 4 crias/ano
                producaoCiclo: 2.3,
                tempoCrescimento: 90,
                consumoRacao: 0.15, // kg/dia
                tecnica: 'Allevare in gabbie o recinti. Alimentazione con mangime, fieno e verdure. Controllo temperatura. Riproduzione controllata. Razze: Gigante Fiammingo, Bianco di Nuova Zelanda.',
                clima: 'Temperato',
                alimentacao: 'Mangime, fieno, verdure, frutta'
            },
            'pecora': {
                producaoDiaria: 1.5, // litros de leite/dia
                producaoUnidade: 'L/dia',
                producaoPorUnidade: 1,
                espaco: 6, // m² por animal
                cicloReprodutivo: 365,
                producaoCiclo: 0,
                tempoCrescimento: 180,
                consumoRacao: 2, // kg/dia
                tecnica: 'Allevare al pascolo con integrazione. Mungitura quotidiana. Produzione di lana. Molto adattata al clima italiano. Razze: Sarda, Comisana, Massese.',
                clima: 'Temperato e mediterraneo',
                alimentacao: 'Pascolo, fieno, mangime, sale minerale'
            },
            'anatra-ovos': {
                producaoDiaria: 0.4, // ovos/dia
                producaoUnidade: 'ovos/dia',
                producaoPorUnidade: 0.08, // kg por ovo
                espaco: 3, // m² por animal
                cicloReprodutivo: 365,
                producaoCiclo: 150, // ovos/ano
                tempoCrescimento: 180,
                consumoRacao: 0.15, // kg/dia
                tecnica: 'Allevare in area con accesso all\'acqua. Alimentazione con mangime, mais e verdure. Molto resistente alle malattie. Controllo predatori. Produzione di uova.',
                clima: 'Temperato',
                alimentacao: 'Mangime, mais, verdure, insetti, alghe'
            },
            'anatra-corte': {
                producaoDiaria: 0, // non produce quotidianamente
                producaoUnidade: 'kg/ciclo',
                producaoPorUnidade: 2.2, // kg di carne per anatra (peso medio di macellazione)
                espaco: 3, // m² per animale
                cicloReprodutivo: 90, // 4 cicli/anno (macellazione a 90 giorni)
                producaoCiclo: 2.2, // kg di carne per anatra
                tempoCrescimento: 90, // giorni fino alla macellazione
                consumoRacao: 0.18, // kg/dia
                tecnica: 'Allevare in area con accesso all\'acqua. Alimentazione con mangime per anatre da carne. Macellazione a 90 giorni (peso medio 2.2kg). Molto resistente alle malattie. Controllo predatori.',
                clima: 'Temperato',
                alimentacao: 'Mangime per anatre da carne, mais, verdure, insetti'
            }
        }
    }
};

