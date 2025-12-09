// ============================================
// CALCULADORA SOLAR
// Dimensionamento de Sistema Fotovoltaico Off-Grid
// ============================================
//
// Objetivo: dado um consumo médio mensal (kWh), dias de autonomia e
// uma escolha de tecnologia de bateria (AGM ou LiFePO4), calcular um
// sistema fotovoltaico off-grid recomendado contendo:
//  - número de baterias (e sua capacidade total instalada, em kWh),
//  - número de painéis solares (quantidade × potência por painel),
//  - potência do inversor (kW),
//  - corrente do MPPT (A),
//  - estimativa de custo baseada em preços unitários.
//
// Valores Iniciais Padrão:
//  - Consumo médio mensal: 200 kWh
//  - Dias de autonomia: 1 dia
//  - Tipo de bateria: Lítio (LiFePO4)
//  - Vida útil desejada: 20 anos
//
// Entrada (UI):
//  - consumo médio mensal (kWh) - padrão: 200 kWh
//  - dias de autonomia (quantos dias o sistema deve suprir sem sol) - padrão: 1 dia
//  - vida útil desejada (anos) → traduzido em ciclos por ano → usado
//    para calcular um DoD (Depth of Discharge) alvo aceitável para
//    proteger a bateria e alcançar a vida útil desejada
//    - Lítio: 5 a 25 anos (padrão: 20 anos)
//    - Chumbo-ácido (AGM): 1 a 5 anos
//  - escolha do tipo de bateria (AGM / Litio) - padrão: Lítio
//  - configuração do fabricante (potência do painel, capacidade/peso/valor das baterias)
//    - Configurável via página config.html
//    - Salvo em localStorage na chave 'configSolar'
//
// Passo-a-passo do cálculo:
// 1) Determinar energia diária média = consumo mensal / 30 (kWh/dia).
// 2) A partir da vida útil desejada (anos) determinamos ciclos aproximados
//    = anos × 365. A partir de tabelas de ciclos vs DoD escolhemos um DoD
//    diário alvo (ex: 50%). DoD menor → mais capacidade nominal necessária.
// 3) Capacidade nominal necessária (kWh): calcula-se tanto pelo critério
//    "vida útil" (energia diária ÷ DoD) quanto pelo critério "autonomia"
//    (energia diária × dias de autonomia ÷ DoD). O requisito final é o
//    máximo desses dois (para atender ambos os critérios).
// 4) Determina-se energia entregue por uma unidade de bateria (kWh).
//    Se a bateria estiver configurada em Ah, converte via tensão (V × Ah / 1000 → kWh).
//    Em seguida: número de módulos = ceil(capacidadeNecessária / kWhPorBateria).
//    Para tensões 24/48 preferimos números pares (paridade) — incrementamos se necessário.
// 5) Capacidade real instalada = qtdBaterias × energiaPorBateria.
// 6) Energia utilizável do banco = capacidadeReal × DoD (kWh).
// 7) Necessidade de geração diária dos painéis = energiaUtilizavelBanco / eficiênciaSistema
//    (considerando perdas). Com Horas de Sol Pleno (HSP) conhecidas, calcula-se
//    a potência requerida em Watts e o número de painéis (ceil(potenciaNecessaria / W_por_painel)).
// 8) Inversor: dimensionado com base no consumo de pico residencial
//    (consumo médio horário × fator de pico 5x, mínimo 1 kW).
// 9) MPPT: dimensionado com base na corrente máxima dos painéis
//    (potência total dos painéis ÷ tensão do banco de baterias).
// 10) Custos: soma dos painéis (quantidade × preço por painel), baterias
//     (qtd × preço unitário), inversor e MPPT. Para visualização, converte-se para
//     a moeda do idioma (BRL/€) usando TAXA_BRL_EUR quando necessário.
//
// Observações de design:
// - O código aceita capacidade em kWh ou Ah; quando em Ah, converte para kWh
//   usando a tensão informada.
// - O algoritmo é conservador: arredonda para cima (ceil) e garante paridade
//   física (pareamento para tensões mais altas) para facilitar montagem prática
//   do banco de baterias.
// - As tabelas CICLOS_AGM e CICLOS_LITIO mapeiam cycles → DoD com interpolação
//   linear quando necessário (veja obterDoDPorCiclos / obterCiclosPorDoD).

// Variável que guarda o idioma atual (Português ou Italiano)
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido', SOLAR_CONFIG_KEY: 'configSolar' };
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) ? SiteConfig.SELECTORS : { HOME_BUTTON: '.home-button-fixed', LANG_BTN: '.lang-btn', APP_ICON: '.app-icon', ARROW_BTN: '.arrow-btn', BUTTON_ACTION: '.btn-acao' };
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || (typeof SiteConfig !== 'undefined' ? SiteConfig.DEFAULTS.language : 'pt-BR');

// Função formatarNumeroDecimal agora está em assets/js/site-config.js

// ============================================
// CONSTANTES DO SISTEMA (Valores Fixos)
// ============================================

/**
 * ============================================
 * CONSTANTES DO SISTEMA FOTOVOLTAICO
 * ============================================
 */

/**
 * HSP - Horas de Sol Pleno (Horas de Sol Pico)
 * 
 * Representa o número médio de horas por dia em que a radiação solar
 * atinge 1000 W/m² (condições de teste padrão dos painéis).
 * 
 * Este valor varia conforme:
 * - Localização geográfica (latitude)
 * - Estação do ano
 * - Condições climáticas locais
 * 
 * Valores típicos:
 * - Regiões tropicais (Brasil): 4-6 horas/dia
 * - Regiões temperadas (Itália): 3-5 horas/dia
 * - Regiões desérticas: 6-8 horas/dia
 * 
 * O valor de 5.0 é uma média conservadora para a maioria das regiões.
 * Para cálculos mais precisos, deve-se usar valores específicos da localização.
 * 
 * FONTE: Dados de irradiação solar global (GHI - Global Horizontal Irradiance)
 */
const HSP = 5.0; // Horas de Sol Pleno (média conservadora)

/**
 * EFICIENCIA_SISTEMA - Eficiência Global do Sistema
 * 
 * Representa a eficiência total do sistema fotovoltaico, considerando
 * todas as perdas que ocorrem desde a geração até o consumo:
 * 
 * Perdas consideradas:
 * - Perdas em cabos DC (2-3%)
 * - Perdas no controlador MPPT (2-5%)
 * - Perdas no inversor (5-10%)
 * - Perdas no banco de baterias (carga/descarga) (5-10%)
 * - Perdas por temperatura dos painéis (5-10%)
 * - Perdas por sujeira/poeira nos painéis (2-5%)
 * - Perdas por sombreamento parcial (variável)
 * 
 * Total estimado: ~20% de perdas → eficiência de 80% (0.80)
 * 
 * Este valor é usado para dimensionar os painéis, garantindo que
 * gerem energia suficiente para compensar as perdas do sistema.
 * 
 * FÓRMULA: EnergiaGerada = EnergiaNecessaria / EFICIENCIA_SISTEMA
 * 
 * FONTE: Normas técnicas e práticas da indústria fotovoltaica
 */
const EFICIENCIA_SISTEMA = 0.80; // Eficiência global (80% = perdas de 20%)

/**
 * FATOR_PICO_CONSUMO - Fator de Pico para Dimensionamento do Inversor
 * 
 * Representa a relação entre o consumo médio horário e o consumo de pico
 * em uma residência típica.
 * 
 * O consumo de energia em uma residência não é constante:
 * - Durante a noite: consumo baixo (iluminação, geladeira)
 * - Durante o dia: consumo médio (eletrodomésticos esporádicos)
 * - Picos: consumo alto (chuveiro elétrico, forno, ar condicionado)
 * 
 * O fator de 5.0 significa que o consumo de pico é aproximadamente
 * 5 vezes maior que o consumo médio horário.
 * 
 * Exemplo:
 * - Consumo médio diário: 10 kWh
 * - Consumo médio horário: 10 / 24 = 0.417 kW
 * - Consumo de pico estimado: 0.417 × 5 = 2.085 kW
 * - Inversor dimensionado: mínimo 2 kW (arredondado para cima)
 * 
 * Este fator é usado para dimensionar o inversor, garantindo que
 * ele tenha capacidade suficiente para atender os picos de consumo
 * sem sobrecarga.
 * 
 * FONTE: Práticas da indústria e normas técnicas para dimensionamento de inversores
 */
const FATOR_PICO_CONSUMO = 5.0; // Fator de pico (5x o consumo médio horário)

// Taxa de conversão BRL → EUR
const TAXA_BRL_EUR = (typeof SiteConfig !== 'undefined' && SiteConfig.DEFAULTS && SiteConfig.DEFAULTS.TAXA_BRL_EUR) ? SiteConfig.DEFAULTS.TAXA_BRL_EUR : 6.19;

// ============================================
// VALORES PADRÃO DOS COMPONENTES (em BRL)
// ============================================
// Valores padrão baseados em módulos comuns para sistemas off-grid.
// Módulos LiFePO4 típicos: 48V x 100Ah ≈ 4.8 kWh.
// Módulos AGM típicos: 12V x 100Ah ≈ 1.2 kWh.
// Preços são valores aproximados de mercado (BRL) para módulos típicos.
const VALORES_PADRAO = {
    potenciaPainel: 400,
    precoPainel: 1200,
    // AGM defaults (12 V, capacity in kWh)
    tensaoAGM: 12,
        capacidadeAGM: (typeof SiteConfig !== 'undefined' && SiteConfig.DEFAULTS && SiteConfig.DEFAULTS.BATTERY && typeof SiteConfig.DEFAULTS.BATTERY.DEFAULT_AGM_KWH === 'number')
            ? SiteConfig.DEFAULTS.BATTERY.DEFAULT_AGM_KWH
            : 1.2,   // kWh (12 V × 100 Ah ≈ 1.2 kWh)
    precoAGM: 420,
    pesoAGM: 30,
    // Lithium defaults (48 V, capacity in kWh)
    tensaoLitio: 48,
        capacidadeLitio: (typeof SiteConfig !== 'undefined' && SiteConfig.DEFAULTS && SiteConfig.DEFAULTS.BATTERY && typeof SiteConfig.DEFAULTS.BATTERY.DEFAULT_LFP_KWH === 'number')
            ? SiteConfig.DEFAULTS.BATTERY.DEFAULT_LFP_KWH
            : 4.8, // kWh (48 V × 100 Ah ≈ 4.8 kWh) — common modular pack
    precoLitio: 12000,     // approximate BRL price for a 48V 100Ah LiFePO4 module
    pesoLitio: 60
};

// Função para obter configuração atual (customizada ou padrão)
function obterConfig() {
    const configSalva = localStorage.getItem(SITE_LS.SOLAR_CONFIG_KEY);
    return configSalva ? JSON.parse(configSalva) : VALORES_PADRAO;
}

// ============================================
// TABELAS DE VIDA ÚTIL (Ciclos vs Descarga)
// DoD mínimo = 25%, máximo = 95%
// ============================================

const CICLOS_AGM = [
    {dod: 25, c: 1500}, {dod: 30, c: 1310}, {dod: 35, c: 1001}, {dod: 40, c: 785},
    {dod: 45, c: 645}, {dod: 50, c: 698}, {dod: 55, c: 614}, {dod: 60, c: 545},
    {dod: 65, c: 486}, {dod: 70, c: 437}, {dod: 75, c: 395}, {dod: 80, c: 358},
    {dod: 85, c: 340}, {dod: 90, c: 315}, {dod: 95, c: 293}
];

const CICLOS_LITIO = [
    {dod: 25, c: 10000}, {dod: 30, c: 9581}, {dod: 35, c: 7664}, {dod: 40, c: 6233},
    {dod: 45, c: 5090}, {dod: 50, c: 5090}, {dod: 55, c: 4505}, {dod: 60, c: 4005},
    {dod: 65, c: 3606}, {dod: 70, c: 3277}, {dod: 75, c: 3000}, {dod: 80, c: 2758},
    {dod: 85, c: 2581}, {dod: 90, c: 2399}, {dod: 95, c: 2239}
];

// ============================================
// PREÇOS DE INVERSORES (Tabela fixa)
// ============================================

const PRECOS_INVERSOR_BRL = [
    { kw: 1, preco: 1100 },
    { kw: 2, preco: 1550 },
    { kw: 5, preco: 2500 }
];
const PRECOS_INVERSOR_EUR = [
    { kw: 1, preco: 178 },
    { kw: 2, preco: 250 },
    { kw: 5, preco: 404 }
];

// ============================================
// PREÇOS DE MPPT (Controlador de Carga)
// ============================================
// Preços baseados na corrente máxima (A) que o MPPT pode suportar

const PRECOS_MPPT_BRL = [
    { a: 20, preco: 800 },
    { a: 40, preco: 1200 },
    { a: 60, preco: 1800 },
    { a: 100, preco: 2800 }
];
const PRECOS_MPPT_EUR = [
    { a: 20, preco: 129 },
    { a: 40, preco: 194 },
    { a: 60, preco: 291 },
    { a: 100, preco: 452 }
];

/**
 * Calcula o preço estimado de um MPPT (controlador de carga) baseado na corrente máxima
 * 
 * O MPPT precisa suportar a corrente máxima dos painéis. A corrente é calculada como:
 * Corrente (A) = Potência Total dos Painéis (W) / Tensão do Banco de Baterias (V)
 * 
 * @param {number} correnteA - Corrente máxima em ampères (A)
 * @param {string} moeda - Moeda desejada ('BRL' para Real ou 'EUR' para Euro)
 * @returns {number} Preço estimado do MPPT na moeda especificada
 */
function calcularPrecoMPPT(correnteA, moeda) {
    const tabela = moeda === 'BRL' ? PRECOS_MPPT_BRL : PRECOS_MPPT_EUR;
    
    if (correnteA <= tabela[0].a) {
        return tabela[0].preco;
    }
    
    if (correnteA >= tabela[tabela.length - 1].a) {
        const ultimo = tabela[tabela.length - 1];
        const penultimo = tabela[tabela.length - 2];
        const precoPorA = (ultimo.preco - penultimo.preco) / (ultimo.a - penultimo.a);
        return ultimo.preco + (correnteA - ultimo.a) * precoPorA;
    }
    
    for (let i = 0; i < tabela.length - 1; i++) {
        const p1 = tabela[i];
        const p2 = tabela[i + 1];
        
        if (correnteA >= p1.a && correnteA <= p2.a) {
            const razao = (correnteA - p1.a) / (p2.a - p1.a);
            return p1.preco + razao * (p2.preco - p1.preco);
        }
    }
    
    return tabela[tabela.length - 1].preco;
}

/**
 * Calcula o preço estimado de um inversor baseado na potência desejada
 * 
 * Esta função usa interpolação linear para estimar o preço de inversores
 * com potências que não estão diretamente na tabela de preços. Isso evita
 * a necessidade de ter uma entrada na tabela para cada possível potência.
 * 
 * @param {number} potenciaKw - Potência do inversor em quilowatts (kW)
 * @param {string} moeda - Moeda desejada ('BRL' para Real ou 'EUR' para Euro)
 * @returns {number} Preço estimado do inversor na moeda especificada
 * 
 * Explicação do algoritmo:
 * 1. Se a potência for menor ou igual ao menor valor da tabela, retorna o preço mínimo
 * 2. Se a potência for maior que o maior valor da tabela, faz extrapolação linear
 *    (estende a linha formada pelos dois últimos pontos da tabela)
 * 3. Se a potência estiver entre dois pontos da tabela, faz interpolação linear
 *    (calcula um valor proporcional entre os dois pontos)
 * 
 * Exemplo de interpolação:
 * - Tabela: 1kW = R$ 1100, 2kW = R$ 1550
 * - Potência desejada: 1.5kW
 * - Razão: (1.5 - 1) / (2 - 1) = 0.5 (meio caminho)
 * - Preço: 1100 + 0.5 × (1550 - 1100) = 1100 + 225 = R$ 1325
 */
function calcularPrecoInversor(potenciaKw, moeda) {
    // PASSO 1: Seleciona a tabela de preços baseada na moeda
    // Se a moeda for BRL (Real), usa a tabela em reais; caso contrário, usa a tabela em euros
    const tabela = moeda === 'BRL' ? PRECOS_INVERSOR_BRL : PRECOS_INVERSOR_EUR;
    
    // PASSO 2: Verifica se a potência é menor ou igual ao menor valor da tabela
    // Se for, retorna o preço do menor inversor da tabela (sem extrapolação para baixo)
    if (potenciaKw <= tabela[0].kw) {
        return tabela[0].preco;
    }
    
    // PASSO 3: Verifica se a potência é maior ou igual ao maior valor da tabela
    // Se for, faz extrapolação linear para cima usando os dois últimos pontos
    if (potenciaKw >= tabela[tabela.length - 1].kw) {
        const ultimo = tabela[tabela.length - 1];      // Último ponto da tabela (maior potência)
        const penultimo = tabela[tabela.length - 2];   // Penúltimo ponto da tabela
        
        // Calcula a taxa de variação de preço por kW (inclinação da reta)
        // Exemplo: se 2kW = R$ 1550 e 5kW = R$ 2500, então:
        // precoPorKw = (2500 - 1550) / (5 - 2) = 950 / 3 ≈ R$ 316,67 por kW
        const precoPorKw = (ultimo.preco - penultimo.preco) / (ultimo.kw - penultimo.kw);
        
        // Extrapola o preço: preço do último ponto + (diferença de potência × taxa por kW)
        // Exemplo: para 7kW, preço = 2500 + (7 - 5) × 316,67 = 2500 + 633,34 = R$ 3133,34
        return ultimo.preco + (potenciaKw - ultimo.kw) * precoPorKw;
    }
    
    // PASSO 4: Interpola entre dois pontos da tabela
    // Procura o intervalo na tabela onde a potência desejada se encaixa
    for (let i = 0; i < tabela.length - 1; i++) {
        const p1 = tabela[i];     // Ponto inferior do intervalo
        const p2 = tabela[i + 1]; // Ponto superior do intervalo
        
        // Verifica se a potência está dentro deste intervalo
        if (potenciaKw >= p1.kw && potenciaKw <= p2.kw) {
            // Calcula a razão (0 a 1) de onde a potência está no intervalo
            // Exemplo: se p1 = 1kW, p2 = 2kW e potenciaKw = 1.5kW:
            // razao = (1.5 - 1) / (2 - 1) = 0.5 (meio caminho)
            const razao = (potenciaKw - p1.kw) / (p2.kw - p1.kw);
            
            // Interpola o preço proporcionalmente
            // Exemplo: se p1.preco = 1100, p2.preco = 1550 e razao = 0.5:
            // preco = 1100 + 0.5 × (1550 - 1100) = 1100 + 225 = 1325
            return p1.preco + razao * (p2.preco - p1.preco);
        }
    }
    
    // PASSO 5: Fallback (não deveria chegar aqui, mas retorna o preço máximo como segurança)
    return tabela[tabela.length - 1].preco;
}

// ============================================
// DICIONÁRIO DE TRADUÇÃO
// ============================================
const traducoes = {
    'pt-BR': {
        'app-title': '🔋 Energia Solar',
        'app-subtitle': 'Dimensionamento de Sistema Fotovoltaico',
        'label-consumo': 'Consumo Médio Mensal',
        'label-autonomia': 'Dias de Autonomia',
        'label-tipo-bateria': 'Tipo de Bateria',
        'opt-chumbo': 'Chumbo-Ácido',
        'opt-litio': 'Lítio',
        'label-vida-util': 'Vida Útil Desejada',
        'results-title': 'Sistema Recomendado',
        'res-placas': 'Placas Solares',
        'res-baterias': 'Baterias',
        'res-inversor': 'Inversor',
        'res-mppt': 'MPPT',
        'res-onda-pura': 'Onda Senoidal Pura',
        'res-peso': 'Peso das Baterias',
        'res-estimativa': 'Estimativa de Custo',
        'custos-titulo': 'Detalhamento de Custos',
        'custo-total': 'Total',
        'footer': 'Solar - Engenharia NATA @ 2025',
        'dias': 'dias',
        'dia': 'dia',
        'anos': 'anos',
        'ano': 'ano',
        'moeda': 'R$',
        'aria-home': 'Voltar para a tela inicial',
        'learn-more': 'SAIBA MAIS!',
        'back': '← Voltar',
        'back-to-calculator': 'Voltar para a Calculadora',
        'btn-memorial': 'Ver Memorial de Cálculo',
        'memorial-title': '📚 Memorial de Cálculo - Energia Solar',
        'memorial-intro-title': '🎯 Objetivo do Dimensionamento',
        'memorial-intro-text': 'Este memorial explica passo a passo como são calculados os componentes de um sistema fotovoltaico off-grid: número de painéis solares, capacidade de baterias, potência do inversor, corrente do MPPT e estimativa de custos.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcular Energia Diária Necessária',
        'memorial-passo2-title': '2️⃣ Passo 2: Determinar DoD (Profundidade de Descarga) pela Vida Útil',
        'memorial-passo3-title': '3️⃣ Passo 3: Calcular Capacidade Necessária de Baterias',
        'memorial-passo4-title': '4️⃣ Passo 4: Calcular Número de Baterias',
        'memorial-passo5-title': '5️⃣ Passo 5: Calcular Número de Painéis Solares',
        'memorial-passo6-title': '6️⃣ Passo 6: Dimensionar o Inversor',
        'memorial-passo7-title': '7️⃣ Passo 7: Dimensionar o MPPT (Controlador de Carga)',
        'memorial-passo8-title': '8️⃣ Passo 8: Calcular Custo Total Estimado',
        'memorial-resumo-title': '📊 Resumo dos Cálculos Atuais',
        'memorial-formula': 'Fórmula:',
        'memorial-example': 'Exemplo:',
        'memorial-tip': '💡 Dica:',
        'memorial-constants': 'Constantes usadas:',
        'memorial-hsp': 'HSP (Horas de Sol Pleno) = 5 horas/dia (padrão para Brasil)',
        'memorial-eficiencia': 'Eficiência do Sistema = 80% (considera perdas de 20% em cabos, MPPT e inversor)',
        'memorial-passo1-explicacao': 'Esta é a quantidade de energia que o sistema precisa fornecer todos os dias para atender ao consumo médio.',
        'memorial-passo2-explicacao': 'O DoD (Depth of Discharge) determina quanto da capacidade da bateria pode ser usada diariamente. Quanto maior a vida útil desejada, menor deve ser o DoD para preservar a bateria.',
        'memorial-dod-tip': 'Baterias LiFePO4 permitem DoD maiores (50-80%) que baterias AGM (30-50%) para a mesma vida útil.',
        'memorial-passo3-explicacao': 'Calculamos a capacidade necessária por dois critérios e escolhemos o maior: um para garantir a vida útil desejada e outro para garantir os dias de autonomia sem sol.',
        'memorial-passo4-explicacao': 'Arredondamos para cima para garantir que temos capacidade suficiente. Para tensões 24V e 48V, garantimos número par de baterias para facilitar a montagem em série/paralelo.',
        'memorial-passo5-explicacao': 'Os painéis precisam gerar energia suficiente para recarregar as baterias, considerando perdas do sistema (cabo, MPPT, inversor). Usamos HSP (Horas de Sol Pleno) para estimar a geração diária.',
        'memorial-passo6-explicacao': 'O inversor converte DC das baterias para AC da casa. Deve ter capacidade para o consumo de pico típico de uma residência, não precisa ter a capacidade total dos painéis. O fator de pico de 5x considera que o consumo não é constante ao longo do dia.',
        'memorial-passo7-explicacao': 'O MPPT (Maximum Power Point Tracking) controla o carregamento das baterias pelos painéis. Precisa suportar a corrente máxima de todos os painéis operando no pico. Valores comerciais comuns: 20A, 40A, 60A, 100A.',
        'memorial-passo8-explicacao': 'Os preços podem ser personalizados na página de configurações. Os valores são convertidos automaticamente para a moeda do idioma selecionado (R$ para português, € para italiano).',
        'memorial-resumo-energia-diaria': 'Energia Diária:',
        'memorial-resumo-dod': 'DoD Alvo:',
        'memorial-resumo-capacidade': 'Capacidade Necessária:',
        'memorial-resumo-baterias': 'Baterias Instaladas:',
        'memorial-resumo-paineis': 'Painéis Solares:',
        'memorial-resumo-inversor': 'Inversor:',
        'memorial-resumo-mppt': 'MPPT:',
        'memorial-formula-passo1': 'Energia Diária (kWh/dia) = Consumo Mensal (kWh) ÷ 30 dias',
        'memorial-formula-passo2-1': 'Ciclos Totais = Vida Útil (anos) × 365 dias/ano',
        'memorial-formula-passo2-2': 'DoD Alvo = f(Ciclos Totais, Tipo de Bateria)',
        'memorial-formula-passo3-1': 'Capacidade por Vida Útil = Energia Diária ÷ DoD',
        'memorial-formula-passo3-2': 'Capacidade por Autonomia = Energia Diária × Dias de Autonomia ÷ DoD',
        'memorial-formula-passo3-3': 'Capacidade Necessária = Máximo(por Vida Útil, por Autonomia)',
        'memorial-formula-passo4-1': 'Número de Baterias = Arredondar para Cima(Capacidade Necessária ÷ Capacidade por Bateria)',
        'memorial-formula-passo4-2': 'Capacidade Real Instalada = Número de Baterias × Capacidade por Bateria',
        'memorial-formula-passo4-3': 'Energia Utilizável = Capacidade Real × DoD',
        'memorial-formula-passo5-1': 'Energia a Gerar = Energia Utilizável do Banco ÷ Eficiência do Sistema',
        'memorial-formula-passo5-2': 'Potência Necessária (W) = Energia a Gerar (kWh/dia) × 1000 ÷ HSP (horas de sol pleno)',
        'memorial-formula-passo5-3': 'Número de Painéis = Arredondar para Cima(Potência Necessária ÷ Potência por Painel)',
        'memorial-formula-passo6-1': 'Consumo Médio Horário = Energia Diária (kWh) ÷ 24 horas',
        'memorial-formula-passo6-2': 'Consumo de Pico = Consumo Médio Horário × Fator de Pico (5x)',
        'memorial-formula-passo6-3': 'Potência do Inversor (kW) = Máximo(Consumo de Pico, 1 kW mínimo)',
        'memorial-formula-passo7-1': 'Potência Total dos Painéis = Número de Painéis × Potência por Painel (W)',
        'memorial-formula-passo7-2': 'Corrente Máxima = Potência Total dos Painéis ÷ Tensão do Banco (V)',
        'memorial-formula-passo7-3': 'Corrente do MPPT = Arredondar para Cima(Corrente Máxima) para valor comercial',
        'memorial-formula-passo8-1': 'Custo Painéis = Número de Painéis × Preço por Painel',
        'memorial-formula-passo8-2': 'Custo Baterias = Número de Baterias × Preço por Bateria',
        'memorial-formula-passo8-3': 'Custo Inversor = Preço do Inversor (da tabela de preços)',
        'memorial-formula-passo8-4': 'Custo MPPT = Preço do MPPT (da tabela de preços)',
        'memorial-formula-passo8-5': 'Custo Total = Custo Painéis + Custo Baterias + Custo Inversor + Custo MPPT'
    },
    'it-IT': {
        'app-title': '🔋 Energia Solare',
        'app-subtitle': 'Dimensionamento Impianto Fotovoltaico',
        'label-consumo': 'Consumo Medio Mensile',
        'label-autonomia': 'Giorni di Autonomia',
        'label-tipo-bateria': 'Tipo di Batteria',
        'opt-chumbo': 'Piombo-Acido',
        'opt-litio': 'Litio',
        'label-vida-util': 'Vita Utile Desiderata',
        'results-title': 'Sistema Consigliato',
        'res-placas': 'Pannelli Solari',
        'res-baterias': 'Batterie',
        'res-inversor': 'Inverter',
        'res-mppt': 'MPPT',
        'res-onda-pura': 'Onda Sinusoidale Pura',
        'res-peso': 'Peso Batterie',
        'res-estimativa': 'Costo Stimato',
        'custos-titulo': 'Dettaglio Costi',
        'custo-total': 'Totale',
        'footer': 'Solare - Engenharia NATA @ 2025',
        'dias': 'giorni',
        'dia': 'giorno',
        'anos': 'anni',
        'ano': 'anno',
        'moeda': '€',
        'aria-home': 'Torna alla schermata iniziale',
        'watermark-dev': '🚧 IN SVILUPPO',
        'learn-more': 'SCOPRI DI PIÙ!',
        'back': '← Indietro',
        'back-to-calculator': 'Torna alla Calcolatrice',
        'btn-memorial': 'Vedi Memoriale di Calcolo',
        'memorial-title': '📚 Memoriale di Calcolo - Energia Solare',
        'memorial-intro-title': '🎯 Obiettivo del Dimensionamento',
        'memorial-intro-text': 'Questo memoriale spiega passo dopo passo come vengono calcolati i componenti di un sistema fotovoltaico off-grid: numero di pannelli solari, capacità delle batterie, potenza dell\'inverter, corrente del MPPT e stima dei costi.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcolare Energia Giornaliera Necessaria',
        'memorial-passo2-title': '2️⃣ Passo 2: Determinare DoD (Profondità di Scarica) dalla Vita Utile',
        'memorial-passo3-title': '3️⃣ Passo 3: Calcolare Capacità Necessaria delle Batterie',
        'memorial-passo4-title': '4️⃣ Passo 4: Calcolare Numero di Batterie',
        'memorial-passo5-title': '5️⃣ Passo 5: Calcolare Numero di Pannelli Solari',
        'memorial-passo6-title': '6️⃣ Passo 6: Dimensionare l\'Inverter',
        'memorial-passo7-title': '7️⃣ Passo 7: Dimensionare il MPPT (Controller di Carica)',
        'memorial-passo8-title': '8️⃣ Passo 8: Calcolare Costo Totale Stimato',
        'memorial-resumo-title': '📊 Riepilogo dei Calcoli Attuali',
        'memorial-formula': 'Formula:',
        'memorial-example': 'Esempio:',
        'memorial-tip': '💡 Suggerimento:',
        'memorial-constants': 'Costanti utilizzate:',
        'memorial-hsp': 'HSP (Ore di Sole Pieno) = 5 ore/giorno (standard per il Brasile)',
        'memorial-eficiencia': 'Efficienza del Sistema = 80% (considera perdite del 20% in cavi, MPPT e inverter)',
        'memorial-passo1-explicacao': 'Questa è la quantità di energia che il sistema deve fornire ogni giorno per soddisfare il consumo medio.',
        'memorial-passo2-explicacao': 'Il DoD (Depth of Discharge) determina quanto della capacità della batteria può essere utilizzato quotidianamente. Maggiore è la vita utile desiderata, minore deve essere il DoD per preservare la batteria.',
        'memorial-dod-tip': 'Le batterie LiFePO4 consentono DoD maggiori (50-80%) rispetto alle batterie AGM (30-50%) per la stessa vita utile.',
        'memorial-passo3-explicacao': 'Calcoliamo la capacità necessaria con due criteri e scegliamo il maggiore: uno per garantire la vita utile desiderata e l\'altro per garantire i giorni di autonomia senza sole.',
        'memorial-passo4-explicacao': 'Arrotondiamo per eccesso per garantire di avere capacità sufficiente. Per tensioni 24V e 48V, garantiamo un numero pari di batterie per facilitare il montaggio in serie/parallelo.',
        'memorial-passo5-explicacao': 'I pannelli devono generare energia sufficiente per ricaricare le batterie, considerando le perdite del sistema (cavo, MPPT, inverter). Usiamo HSP (Ore di Sole Pieno) per stimare la generazione giornaliera.',
        'memorial-passo6-explicacao': 'L\'inverter converte DC delle batterie in AC della casa. Deve avere capacità per il consumo di picco tipico di una residenza, non deve avere la capacità totale dei pannelli. Il fattore di picco di 5x considera che il consumo non è costante durante il giorno.',
        'memorial-passo7-explicacao': 'Il MPPT (Maximum Power Point Tracking) controlla la ricarica delle batterie da parte dei pannelli. Deve supportare la corrente massima di tutti i pannelli operanti al picco. Valori commerciali comuni: 20A, 40A, 60A, 100A.',
        'memorial-passo8-explicacao': 'I prezzi possono essere personalizzati nella pagina delle impostazioni. I valori vengono convertiti automaticamente nella valuta della lingua selezionata (R$ per portoghese, € per italiano).',
        'memorial-resumo-energia-diaria': 'Energia Giornaliera:',
        'memorial-resumo-dod': 'DoD Obiettivo:',
        'memorial-resumo-capacidade': 'Capacità Necessaria:',
        'memorial-resumo-baterias': 'Batterie Installate:',
        'memorial-resumo-paineis': 'Pannelli Solari:',
        'memorial-resumo-inversor': 'Inverter:',
        'memorial-resumo-mppt': 'MPPT:',
        'memorial-formula-passo1': 'Energia Giornaliera (kWh/giorno) = Consumo Mensile (kWh) ÷ 30 giorni',
        'memorial-formula-passo2-1': 'Cicli Totali = Vita Utile (anni) × 365 giorni/anno',
        'memorial-formula-passo2-2': 'DoD Obiettivo = f(Cicli Totali, Tipo di Batteria)',
        'memorial-formula-passo3-1': 'Capacità per Vita Utile = Energia Giornaliera ÷ DoD',
        'memorial-formula-passo3-2': 'Capacità per Autonomia = Energia Giornaliera × Giorni di Autonomia ÷ DoD',
        'memorial-formula-passo3-3': 'Capacità Necessaria = Massimo(per Vita Utile, per Autonomia)',
        'memorial-formula-passo4-1': 'Numero di Batterie = Arrotondare per Eccesso(Capacità Necessaria ÷ Capacità per Batteria)',
        'memorial-formula-passo4-2': 'Capacità Reale Installata = Numero di Batterie × Capacità per Batteria',
        'memorial-formula-passo4-3': 'Energia Utilizzabile = Capacità Reale × DoD',
        'memorial-formula-passo5-1': 'Energia da Generare = Energia Utilizzabile del Banco ÷ Efficienza del Sistema',
        'memorial-formula-passo5-2': 'Potenza Necessaria (W) = Energia da Generare (kWh/giorno) × 1000 ÷ HSP (ore di sole pieno)',
        'memorial-formula-passo5-3': 'Numero di Pannelli = Arrotondare per Eccesso(Potenza Necessaria ÷ Potenza per Pannello)',
        'memorial-formula-passo6-1': 'Consumo Medio Orario = Energia Giornaliera (kWh) ÷ 24 ore',
        'memorial-formula-passo6-2': 'Consumo di Picco = Consumo Medio Orario × Fattore di Picco (5x)',
        'memorial-formula-passo6-3': 'Potenza dell\'Inverter (kW) = Massimo(Consumo di Picco, 1 kW minimo)',
        'memorial-formula-passo7-1': 'Potenza Totale dei Pannelli = Numero di Pannelli × Potenza per Pannello (W)',
        'memorial-formula-passo7-2': 'Corrente Massima = Potenza Totale dei Pannelli ÷ Tensione del Banco (V)',
        'memorial-formula-passo7-3': 'Corrente del MPPT = Arrotondare per Eccesso(Corrente Massima) per valore commerciale',
        'memorial-formula-passo8-1': 'Costo Pannelli = Numero di Pannelli × Prezzo per Pannello',
        'memorial-formula-passo8-2': 'Costo Batterie = Numero di Batterie × Prezzo per Batteria',
        'memorial-formula-passo8-3': 'Costo Inverter = Prezzo dell\'Inverter (dalla tabella dei prezzi)',
        'memorial-formula-passo8-4': 'Costo MPPT = Prezzo del MPPT (dalla tabella dei prezzi)',
        'memorial-formula-passo8-5': 'Costo Totale = Costo Pannelli + Costo Batterie + Costo Inverter + Costo MPPT'
    }
};

// Controle para os botões de seta
let intervalId = null;
let timeoutId = null;

// ============================================
// FUNÇÃO: TROCAR IDIOMA
// ============================================
function trocarIdioma(novoIdioma) {
    idiomaAtual = novoIdioma;
    // Persiste a preferência de idioma usando a chave padronizada do projeto
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    document.documentElement.lang = novoIdioma;
    
    // Atualiza todos os elementos com data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (traducoes[novoIdioma] && traducoes[novoIdioma][key]) {
            el.textContent = traducoes[novoIdioma][key];
        }
    });

    // Atualiza botões de idioma (ativação visual)
    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(btn => {
        if (btn.getAttribute('data-lang') === novoIdioma) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    atualizarInterface();

    // Atualiza fórmulas do memorial
    atualizarFormulasMemorial(novoIdioma);

    // Atualiza aria-label do botão home
    const homeLabel = traducoes[novoIdioma]?.['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
}

/**
 * Calcula o DoD (Depth of Discharge - Profundidade de Descarga) permitido
 * baseado no número de ciclos desejados da bateria
 * 
 * Esta função é fundamental para o dimensionamento do sistema. Ela determina
 * qual percentual da capacidade da bateria pode ser usado diariamente para
 * garantir que a bateria dure o número de anos desejado.
 * 
 * A relação é inversa: quanto mais ciclos você quer (mais anos de vida útil),
 * menor deve ser o DoD diário (menos você pode descarregar a bateria por dia).
 * 
 * @param {number} ciclos - Número total de ciclos desejados (ex: 1825 para 5 anos × 365 dias)
 * @param {string} tipo - Tipo de bateria ('litio' para LiFePO4 ou 'chumbo' para AGM/Gel)
 * @returns {number} DoD em percentual (ex: 50 para 50%)
 * 
 * Explicação:
 * - As tabelas CICLOS_AGM e CICLOS_LITIO relacionam ciclos de vida com DoD
 * - Exemplo: bateria LiFePO4 com DoD de 50% pode fazer ~5090 ciclos
 * - Se você quer 1825 ciclos (5 anos), precisa usar um DoD menor (ex: ~60%)
 * - A função interpola linearmente entre os pontos da tabela para valores intermediários
 */
function obterDoDPorCiclos(ciclos, tipo) {
    // PASSO 1: Seleciona a tabela de ciclos baseada no tipo de bateria
    // Baterias de lítio têm muito mais ciclos que baterias de chumbo-ácido
    const dados = tipo === 'litio' ? CICLOS_LITIO : CICLOS_AGM;
    
    // PASSO 2: Verifica se o número de ciclos é maior ou igual ao máximo da tabela
    // Se for, retorna o DoD mínimo (25%) - isso significa que você quer muitos ciclos,
    // então precisa usar a bateria de forma muito conservadora
    if (ciclos >= dados[0].c) return dados[0].dod; // Mínimo DoD = 25%
    
    // PASSO 3: Verifica se o número de ciclos é menor ou igual ao mínimo da tabela
    // Se for, retorna o DoD máximo (95%) - isso significa que você quer poucos ciclos,
    // então pode usar a bateria de forma mais agressiva
    if (ciclos <= dados[dados.length - 1].c) return dados[dados.length - 1].dod; // Máximo DoD = 95%

    // PASSO 4: Interpola entre dois pontos da tabela
    // Procura o intervalo na tabela onde o número de ciclos se encaixa
    // Nota: a tabela está ordenada do maior número de ciclos (menor DoD) para o menor
    for (let i = 0; i < dados.length - 1; i++) {
        const p1 = dados[i];     // Ponto com mais ciclos (menor DoD)
        const p2 = dados[i+1];   // Ponto com menos ciclos (maior DoD)
        
        // Verifica se o número de ciclos está dentro deste intervalo
        // Nota: p1.c > p2.c porque a tabela está em ordem decrescente
        if (ciclos <= p1.c && ciclos >= p2.c) {
            // Calcula a razão (0 a 1) de onde o número de ciclos está no intervalo
            // Exemplo: se p1.c = 5090, p2.c = 4005 e ciclos = 4500:
            // razao = (4500 - 4005) / (5090 - 4005) = 495 / 1085 ≈ 0.456
            const razao = (ciclos - p2.c) / (p1.c - p2.c);
            
            // Interpola o DoD proporcionalmente
            // Como p1.dod < p2.dod (menos ciclos = maior DoD), somamos a diferença
            // Exemplo: se p1.dod = 50%, p2.dod = 60% e razao = 0.456:
            // dod = 60 + 0.456 × (50 - 60) = 60 - 4.56 = 55.44%
            return p2.dod + razao * (p1.dod - p2.dod);
        }
    }
    
    // PASSO 5: Fallback (não deveria chegar aqui, mas retorna 50% como valor padrão)
    return 50;
}

// ============================================
// FUNÇÃO: CALCULAR CICLOS POR DoD (inversa)
// ============================================
// Esta função recebe um DoD (%) e retorna o número aproximado de ciclos esperados.
// Usa interpolação linear entre pontos da tabela. É útil para mostrar como alterar o
// DoD afeta a vida útil (ciclos) estimada.
function obterCiclosPorDoD(dod, tipo) {
    const dados = tipo === 'litio' ? CICLOS_LITIO : CICLOS_AGM;
    
    // Se DoD menor que o mínimo da tabela, retorna ciclos máximos
    if (dod <= dados[0].dod) return dados[0].c;
    // Se DoD maior que o máximo da tabela, retorna ciclos mínimos
    if (dod >= dados[dados.length - 1].dod) return dados[dados.length - 1].c;

    // Interpola entre os pontos da tabela
    for (let i = 0; i < dados.length - 1; i++) {
        const p1 = dados[i];
        const p2 = dados[i+1];
        
        if (dod >= p1.dod && dod <= p2.dod) {
            const razao = (dod - p1.dod) / (p2.dod - p1.dod);
            return p1.c + razao * (p2.c - p1.c);
        }
    }
    return 1000; // Valor padrão de segurança
}

// ============================================
// FUNÇÃO: AJUSTAR VALORES (Botões de Seta)
// ============================================
// Os botões +/- da interface chamam esta função para aumentar ou diminuir
// um valor ligado a um ID de slider/text input. Aqui aplicamos limites,
// arredondamento e atualizamos a interface para refletir a mudança.
function ajustarValor(targetId, step) {
    const slider = document.getElementById(targetId);
    if (!slider) {
        console.error(`Slider não encontrado: ${targetId}`);
        return;
    }
    
    let valor = parseFloat(slider.value) || 0;
    valor += step;
    
    // Respeita os limites do slider
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    
    if (valor < min) valor = min;
    if (valor > max) valor = max;
    
    // Arredonda baseado no tipo de slider
    // Consumo e Autonomia: valores inteiros
    // Vida Útil: pode ter decimais (arredondamos para uma casa decimal)
    if (targetId === 'sliderConsumo' || targetId === 'sliderAutonomia') {
        valor = Math.round(valor);
    } else if (targetId === 'sliderVidaUtil') {
        // Para vida útil, arredonda para inteiro se o step for inteiro
        valor = Math.round(valor);
    } else {
        // Para outros sliders, uma casa decimal
        valor = Math.round(valor * 10) / 10;
    }
    
    // Atualiza o slider
    slider.value = valor;
    
    // Atualiza o input correspondente se existir
    let inputId = '';
    if (targetId === 'sliderConsumo') {
        inputId = 'inputConsumo';
    } else if (targetId === 'sliderAutonomia') {
        inputId = 'inputAutonomia';
    } else if (targetId === 'sliderVidaUtil') {
        inputId = 'inputVidaUtil';
    }
    
    if (inputId) {
        const input = document.getElementById(inputId);
        if (input) {
            input.value = valor;
        }
    }
    
    // Dispara o evento 'input' no slider para acionar os event listeners
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Atualiza a interface
    atualizarInterface();
}

// ============================================
// FUNÇÃO: ATUALIZAR INTERFACE (UI)
// ============================================
// Coleta estado atual dos controles (sliders e rádios) e atualiza todos
// os textos da tela. Calcula o DoD alvo com base na vida útil pedida e
// invoca a função principal de cálculo (calcularSistema) passando o
// DoD convertido para fração (ex: 50% → 0.5).
// Além disso, garante limites corretos para sliders e corrige valores
// fora dos limites (por exemplo, vida útil máx/mín).
function atualizarInterface() {
    // 1. Ler valores dos inputs editáveis ou sliders (inputs têm prioridade)
    const sliderConsumo = document.getElementById('sliderConsumo');
    const sliderAutonomia = document.getElementById('sliderAutonomia');
    const sliderVidaUtil = document.getElementById('sliderVidaUtil');
    const inputConsumo = document.getElementById('inputConsumo');
    const inputAutonomia = document.getElementById('inputAutonomia');
    const inputVidaUtil = document.getElementById('inputVidaUtil');
    const tipoBateria = document.querySelector('input[name="tipoBateria"]:checked').value;
    
    // Obtém valores dos inputs ou sliders (inputs têm prioridade se existirem)
    const consumo = inputConsumo ? parseInt(inputConsumo.value) || parseInt(sliderConsumo.value) : parseInt(sliderConsumo.value);
    const autonomia = inputAutonomia ? parseInt(inputAutonomia.value) || parseInt(sliderAutonomia.value) : parseInt(sliderAutonomia.value);
    
    // 2. Ajustar limites do slider de Vida Útil baseado no tipo de bateria
    if (tipoBateria === 'litio') {
        sliderVidaUtil.min = "5";
        sliderVidaUtil.max = "25";
    } else {
        sliderVidaUtil.min = "1";
        sliderVidaUtil.max = "5";
    }
    
    // 3. Corrigir valor se estiver fora dos limites (apenas para o slider, não para o input)
    let vidaUtil = inputVidaUtil ? parseFloat(inputVidaUtil.value) || parseFloat(sliderVidaUtil.value) : parseFloat(sliderVidaUtil.value);
    const minVida = parseFloat(sliderVidaUtil.min);
    const maxVida = parseFloat(sliderVidaUtil.max);
    
    // Ajusta o slider apenas se o valor estiver dentro dos limites
    if (vidaUtil >= minVida && vidaUtil <= maxVida) {
        sliderVidaUtil.value = vidaUtil;
    }

    // 4. Atualizar displays de valor (inputs editáveis)
    if (inputConsumo) {
        inputConsumo.value = consumo;
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumo);
    }
    if (inputAutonomia) {
        inputAutonomia.value = autonomia;
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAutonomia);
    }
    if (inputVidaUtil) {
        inputVidaUtil.value = Math.round(vidaUtil);
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputVidaUtil);
    }

    // 5. Calcular DoD Alvo
    const ciclos = vidaUtil * 365;
    let dodAlvo = obterDoDPorCiclos(ciclos, tipoBateria);

    // Mostra a porcentagem de descarga diária calculada
    const dodExibicao = Math.round(dodAlvo);
    const textoNota = idiomaAtual === 'pt-BR' ? 'DoD Diário' : 'DoD Giornaliero';
    document.getElementById('descVidaUtil').textContent = `${textoNota}: ${dodExibicao}%`;

    // Chama a função principal de cálculo
    calcularSistema(dodAlvo / 100);
}

// ============================================
// FUNÇÃO PRINCIPAL: CALCULAR O SISTEMA
// ============================================
// Esta é a função central do algoritmo que, dado um DoD alvo (fração),
// monta toda a configuração do sistema. As etapas implementadas são:
// 1) Ler valores da UI (consumo, autonomia, tipo de bateria).
// 2) Ler config customizada (ou defaults), convertendo capacidade de Ah
//    para kWh quando necessário.
// 3) Calcular capacidade necessária por dois critérios: vida útil e
//    autonomia; escolher o máximo dos dois.
// 4) Calcular número de baterias (ceil) e ajustar paridade prática.
// 5) Calcular painéis necessários considerando eficiência do sistema
//    e horas de sol pleno (HSP).
// 6) Dimensionar inversor baseado no consumo de pico.
// 7) Dimensionar MPPT baseado na corrente máxima dos painéis.
// 8) Calcular custos e preencher o DOM com os resultados formatados
//    para o idioma atual.
//
// A função gera frases explicativas (motivos) para cada dimensão
// (baterias, painéis, inversor, MPPT), que são mostradas na UI para
// educar o usuário sobre o porquê dos números.
/**
 * Função principal que calcula todo o dimensionamento do sistema solar
 * 
 * Esta é a função central do algoritmo. Ela recebe o DoD alvo (em fração decimal,
 * ex: 0.5 para 50%) e calcula:
 * - Quantidade de baterias necessárias
 * - Quantidade de painéis solares necessários
 * - Potência do inversor
 * - Corrente do MPPT
 * - Peso total das baterias
 * - Custo estimado do sistema
 * 
 * @param {number} dodAlvo - DoD (Depth of Discharge) alvo em fração decimal (ex: 0.5 para 50%)
 * 
 * Algoritmo resumido:
 * 1. Calcula energia diária necessária (consumo mensal ÷ 30 dias)
 * 2. Calcula capacidade de baterias necessária por dois critérios:
 *    - Critério A: Vida útil (energia diária ÷ DoD)
 *    - Critério B: Autonomia (energia diária × dias de autonomia ÷ DoD)
 *    - Escolhe o maior dos dois (gargalo)
 * 3. Calcula quantidade de baterias (arredonda para cima e garante paridade)
 * 4. Calcula quantidade de painéis (baseado na energia necessária para recarregar o banco)
 * 5. Dimensiona o inversor (mínimo 1kW ou potência dos painéis)
 * 6. Calcula custos e exibe resultados na interface
 */
function calcularSistema(dodAlvo) {
    // ============================================
    // PASSO 1: OBTER VALORES DA INTERFACE
    // ============================================
    // Lê os valores dos inputs editáveis ou sliders (inputs têm prioridade)
    const inputConsumo = document.getElementById('inputConsumo');
    const inputAutonomia = document.getElementById('inputAutonomia');
    const sliderConsumo = document.getElementById('sliderConsumo');
    const sliderAutonomia = document.getElementById('sliderAutonomia');
    
    const consumoMensal = inputConsumo ? parseFloat(inputConsumo.value) || parseFloat(sliderConsumo.value) || 0 : parseFloat(sliderConsumo.value) || 0; // Consumo em kWh/mês
    const autonomia = inputAutonomia ? parseInt(inputAutonomia.value) || parseInt(sliderAutonomia.value) : parseInt(sliderAutonomia.value);           // Dias de autonomia
    const tipoBateria = document.querySelector('input[name="tipoBateria"]:checked').value;  // 'litio' ou 'chumbo'

    // ============================================
    // PASSO 2: OBTER CONFIGURAÇÃO DOS COMPONENTES
    // ============================================
    // Obtém a configuração customizada do usuário (salva no localStorage) ou usa os valores padrão
    const config = obterConfig();
    
    // Se a capacidade parecer muito grande (>20), interpreta como Ah e converte para kWh usando a tensão
    if (config.capacidadeLitio && config.capacidadeLitio > 20 && config.tensaoLitio) {
        config.capacidadeLitioAh = config.capacidadeLitio;
        // Converte Ah para kWh: kWh = (V × Ah) / 1000
        // Exemplo: 48V × 100Ah = 4800 Wh = 4.8 kWh
        config.capacidadeLitio = (config.tensaoLitio * config.capacidadeLitio) / 1000;
    }
    if (config.capacidadeAGM && config.capacidadeAGM > 20 && config.tensaoAGM) {
        config.capacidadeAGMAh = config.capacidadeAGM;
        // Converte Ah para kWh: kWh = (V × Ah) / 1000
        // Exemplo: 12V × 100Ah = 1200 Wh = 1.2 kWh
        config.capacidadeAGM = (config.tensaoAGM * config.capacidadeAGM) / 1000;
    }
    
    // ============================================
    // PASSO 3: MONTAR ESPECIFICAÇÕES DAS BATERIAS
    // ============================================
    // Cria um objeto com todas as especificações da bateria escolhida
    // Suporta capacidade expressa em kWh ou Ah
    const batSpec = (tipoBateria === 'litio')
        ? { 
            v: config.tensaoLitio,                    // Tensão em volts (ex: 48V)
            kwh: config.capacidadeLitio,              // Capacidade em kWh (ex: 4.8 kWh)
            ah: config.capacidadeLitioAh || null,     // Capacidade em Ah (se disponível, para referência)
            price_brl: config.precoLitio,             // Preço unitário em BRL
            weight: config.pesoLitio                  // Peso em kg
          }
        : { 
            v: config.tensaoAGM,                      // Tensão em volts (ex: 12V)
            kwh: config.capacidadeAGM,                // Capacidade em kWh (ex: 1.2 kWh)
            ah: config.capacidadeAGMAh || null,       // Capacidade em Ah (se disponível, para referência)
            price_brl: config.precoAGM,               // Preço unitário em BRL
            weight: config.pesoAGM                    // Peso em kg
          };
    
    // Obtém especificações dos painéis solares
    const POTENCIA_PAINEL = config.potenciaPainel; // Potência de cada painel em Watts (ex: 400W)
    const PRECO_PAINEL = config.precoPainel;       // Preço de cada painel em BRL

    // ============================================
    // PASSO 4: VALIDAÇÃO DE ENTRADA
    // ============================================
    // Se o consumo for inválido (zero ou negativo), zera todos os resultados
    if (consumoMensal <= 0) {
        // Zera todos os campos de resultado
        ['resQtdPlacas', 'resQtdBaterias', 'resPotenciaInversor', 'resCorrenteMPPT', 'resPesoBaterias'].forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.textContent = '0';
        });
        // Zera o preço
        const precoElemento = document.getElementById('resPrecoEstimado');
        if (precoElemento) precoElemento.textContent = `${traducoes[idiomaAtual]?.['moeda'] || 'R$'} 0`;
        return; // Interrompe a execução da função
    }

    // ============================================
    // PASSO 5: CALCULAR ENERGIA DIÁRIA NECESSÁRIA
    // ============================================
    // Converte o consumo mensal para consumo diário médio
    // Divide por 30 para obter a média diária (assumindo 30 dias por mês)
    const energiaDiaria = consumoMensal / 30; // kWh/dia
    
    // ============================================
    // PASSO 6: DIMENSIONAMENTO DAS BATERIAS
    // ============================================
    // O DoD escolhido (via slider de vida útil) afeta AMBOS os critérios:
    // - Quanto menor o DoD, mais baterias são necessárias para a mesma energia utilizável
    // - O DoD limita quanto da capacidade nominal pode ser usada diariamente
    
    // CRITÉRIO A: Vida Útil
    // Calcula a capacidade nominal necessária para 1 dia de consumo com o DoD alvo
    // Fórmula: capacidadeNominal = energiaDiaria / DoD
    // Exemplo: se consumo diário = 10 kWh e DoD = 50% (0.5):
    // capacidadeNominal = 10 / 0.5 = 20 kWh nominais
    // Isso garante que a bateria não seja descarregada além do DoD alvo em um dia normal
    const capVidaUtil = energiaDiaria / dodAlvo;
    
    // CRITÉRIO B: Autonomia
    // Calcula a capacidade nominal necessária para N dias de autonomia com o MESMO DoD
    // Fórmula: capacidadeNominal = (energiaDiaria × autonomia) / DoD
    // Exemplo: se autonomia = 3 dias, consumo = 10 kWh/dia, DoD = 50% (0.5):
    // energiaTotalNecessaria = 10 × 3 = 30 kWh utilizáveis
    // capacidadeNominal = 30 / 0.5 = 60 kWh nominais
    // Isso garante que o sistema funcione por N dias sem sol, respeitando o DoD alvo
    const energiaAutonomia = energiaDiaria * autonomia; // kWh utilizáveis necessários para a autonomia
    const capAutonomia = energiaAutonomia / dodAlvo;    // kWh nominais necessários
    
    // Escolhe o maior requisito (o gargalo)
    // O sistema precisa atender AMBOS os critérios, então escolhemos o maior valor
    // Exemplo: se capVidaUtil = 20 kWh e capAutonomia = 60 kWh, escolhemos 60 kWh
    const capacidadeNecessariaKWh = Math.max(capVidaUtil, capAutonomia);
    
    // ============================================
    // PASSO 7: CALCULAR QUANTIDADE DE BATERIAS
    // ============================================
    // Calcula a energia (capacidade) de uma única bateria
    // Prioriza kWh se disponível; caso contrário, calcula a partir de V × Ah / 1000
    const energiaPorBateria = (typeof batSpec.kwh === 'number' && !isNaN(batSpec.kwh))
        ? batSpec.kwh  // Usa kWh diretamente se disponível
        : ((batSpec.v && batSpec.ah) ? (batSpec.v * batSpec.ah) / 1000 : 0); // Calcula de Ah se necessário
    
    // Calcula a quantidade de baterias necessárias
    // Arredonda para cima (Math.ceil) para ter capacidade suficiente
    // Exemplo: se precisamos de 60 kWh e cada bateria tem 4.8 kWh:
    // qtdBaterias = ceil(60 / 4.8) = ceil(12.5) = 13 baterias
    let qtdBaterias = Math.ceil(capacidadeNecessariaKWh / energiaPorBateria);
    
    // Garante paridade (número par) para tensões mais altas (24V/48V)
    // Isso facilita a montagem prática do banco de baterias (conexão em série/paralelo)
    // Exemplo: se calculamos 13 baterias, incrementamos para 14 (par)
    if (qtdBaterias % 2 !== 0 && qtdBaterias > 1) qtdBaterias++; // Preferência por pares
    
    // Calcula a capacidade real do banco de baterias instalado
    // Isso pode ser maior que a capacidade necessária devido ao arredondamento e paridade
    // Exemplo: se precisamos de 60 kWh mas instalamos 14 baterias de 4.8 kWh:
    // capacidadeReal = 14 × 4.8 = 67.2 kWh
    const capacidadeRealKWh = qtdBaterias * energiaPorBateria;
    
    // ============================================
    // PASSO 8: DIMENSIONAMENTO DOS PAINÉIS SOLARES
    // ============================================
    // Os painéis precisam gerar energia suficiente para recarregar o banco de baterias
    // em 1 dia de sol. A energia a recarregar é o que foi descarregado = capacidade × DoD.
    // Isso inclui o consumo diário, pois o banco foi dimensionado para isso.
    
    // Calcula a energia utilizável do banco de baterias
    // Esta é a energia que pode ser extraída do banco respeitando o DoD alvo
    // Exemplo: se capacidadeReal = 67.2 kWh e DoD = 50% (0.5):
    // energiaUtilizavel = 67.2 × 0.5 = 33.6 kWh utilizáveis
    const energiaUtilizavelBanco = capacidadeRealKWh * dodAlvo;
    
    // Calcula a energia que os painéis devem gerar por dia
    // Considera as perdas do sistema (cabo, MPPT, inversor, etc.)
    // Fórmula: energiaGerar = energiaUtilizavel / eficienciaSistema
    // Exemplo: se energiaUtilizavel = 33.6 kWh e eficiencia = 80% (0.8):
    // energiaTotalGerar = 33.6 / 0.8 = 42 kWh/dia
    const energiaTotalGerar = energiaUtilizavelBanco / EFICIENCIA_SISTEMA;
    
    // Calcula a potência solar necessária em Watts
    // Fórmula: potencia = (energia × 1000) / HSP
    // Onde HSP (Horas de Sol Pleno) é o número médio de horas de sol por dia
    // Exemplo: se energiaTotalGerar = 42 kWh/dia e HSP = 5 horas:
    // potenciaSolar = (42 × 1000) / 5 = 8400 W = 8.4 kW
    const potenciaSolarNecessaria = (energiaTotalGerar * 1000) / HSP; // Watts
    
    // Calcula a quantidade de painéis necessários
    // Arredonda para cima para ter potência suficiente
    // Exemplo: se precisamos de 8400 W e cada painel tem 400 W:
    // qtdPaineis = ceil(8400 / 400) = ceil(21) = 21 painéis
    const qtdPaineis = Math.ceil(potenciaSolarNecessaria / POTENCIA_PAINEL);
    
    // ============================================
    // PASSO 9: DIMENSIONAMENTO DO INVERSOR
    // ============================================
    // O inversor converte DC das baterias para AC da casa
    // Deve ter capacidade para o consumo de pico típico de uma residência
    // Consumo de pico = consumo médio horário × fator de pico
    // Fórmula: consumoMedioHorario = energiaDiaria / 24 horas
    //          consumoPico = consumoMedioHorario × FATOR_PICO_CONSUMO
    //          potenciaInversor = max(1kW, consumoPico)
    // Exemplo: se energiaDiaria = 5 kWh/dia e FATOR_PICO = 5:
    //          consumoMedioHorario = 5 / 24 = 0.208 kW
    //          consumoPico = 0.208 × 5 = 1.04 kW
    //          potenciaInversor = max(1, 1.04) = 1.04 kW → arredonda para 2 kW
    const consumoMedioHorario = energiaDiaria / 24; // kW (consumo médio por hora)
    const consumoPico = consumoMedioHorario * FATOR_PICO_CONSUMO; // kW (pico de consumo)
    const potenciaInversor = Math.max(1, Math.ceil(consumoPico)); // Mínimo 1kW, arredonda para cima
    
    // ============================================
    // PASSO 10: DIMENSIONAMENTO DO MPPT
    // ============================================
    // O MPPT (controlador de carga) precisa suportar a corrente máxima dos painéis
    // Corrente = Potência Total dos Painéis / Tensão do Banco de Baterias
    // Fórmula: potenciaTotalPaineis = qtdPaineis × POTENCIA_PAINEL (W)
    //          correnteMaxima = potenciaTotalPaineis / tensaoBanco (V)
    //          correnteMPPT = ceil(correnteMaxima) (arredonda para cima)
    // Exemplo: se temos 11 painéis de 400W e banco de 48V:
    //          potenciaTotal = 11 × 400 = 4400 W
    //          correnteMaxima = 4400 / 48 = 91.67 A
    //          correnteMPPT = ceil(91.67) = 92 A → escolhe MPPT de 100A
    const potenciaTotalPaineis = qtdPaineis * POTENCIA_PAINEL; // Watts
    const tensaoBanco = batSpec.v; // Volts (tensão do banco de baterias)
    const correnteMaxima = potenciaTotalPaineis / tensaoBanco; // Ampères
    // Arredonda para cima e garante mínimo de 20A
    let correnteMPPT = Math.max(20, Math.ceil(correnteMaxima));
    // Arredonda para valores comerciais comuns (20, 40, 60, 100, 150, 200...)
    if (correnteMPPT > 100) {
        correnteMPPT = Math.ceil(correnteMPPT / 50) * 50; // Arredonda para múltiplos de 50 acima de 100A
    } else if (correnteMPPT > 60) {
        correnteMPPT = 100; // Próximo valor comercial
    } else if (correnteMPPT > 40) {
        correnteMPPT = 60; // Próximo valor comercial
    } else if (correnteMPPT > 20) {
        correnteMPPT = 40; // Próximo valor comercial
    } else {
        correnteMPPT = 20; // Mínimo
    }
    
    // ============================================
    // PASSO 11: CALCULAR PESO E CUSTOS
    // ============================================
    // Calcula o peso total das baterias
    // Exemplo: se temos 14 baterias de 60 kg cada:
    // pesoTotal = 14 × 60 = 840 kg
    const pesoTotal = qtdBaterias * batSpec.weight;
    
    // Conversão de moeda: a configuração salva os preços em BRL (Real)
    // Se o idioma for italiano, converte para EUR (Euro) usando a taxa de câmbio
    const moedaCalculo = idiomaAtual === 'pt-BR' ? 'BRL' : 'EUR';
    // Fator de conversão: 1 para BRL (sem conversão) ou 1/taxa para EUR
    // Exemplo: se TAXA_BRL_EUR = 6.19, então 1 BRL = 1/6.19 ≈ 0.1615 EUR
    const fatorConversao = idiomaAtual === 'pt-BR' ? 1 : 1 / TAXA_BRL_EUR;
    
    // Converte os preços unitários para a moeda do idioma
    // Exemplo: se PRECO_PAINEL = 1200 BRL e fatorConversao = 0.1615:
    // precoPainelConvertido = 1200 × 0.1615 ≈ 194 EUR
    const precoPainelConvertido = PRECO_PAINEL * fatorConversao;
    const precoBateriaConvertido = batSpec.price_brl * fatorConversao;
    
    // Calcula os custos totais de cada componente
    // Exemplo: se temos 21 painéis a 1200 BRL cada:
    // custoPaineis = 21 × 1200 = 25200 BRL
    const custoPaineis = qtdPaineis * precoPainelConvertido;
    const custoBaterias = qtdBaterias * precoBateriaConvertido;
    // O preço do inversor é calculado por interpolação baseado na potência
    const custoInversor = calcularPrecoInversor(potenciaInversor, moedaCalculo);
    // O preço do MPPT é calculado por interpolação baseado na corrente máxima
    const custoMPPT = calcularPrecoMPPT(correnteMPPT, moedaCalculo);
    
    // Calcula o custo total do sistema
    // Exemplo: custoTotal = 25200 + 168000 + 2500 + 1200 = 196900 BRL
    const custoTotal = custoPaineis + custoBaterias + custoInversor + custoMPPT;

    // 6. Exibir Resultados
    document.getElementById('resQtdPlacas').textContent = `${qtdPaineis} x ${formatarNumeroComSufixo(POTENCIA_PAINEL, 0)}W`;
    // Exibe quantas unidades do módulo escolhido (kWh e tensão)
    const unidadeKWh = (typeof batSpec.kwh === 'number' ? formatarNumeroDecimal(batSpec.kwh, 1) : (batSpec.ah ? formatarNumeroDecimal((batSpec.v * batSpec.ah)/1000, 1) : '0,0'));
    document.getElementById('resQtdBaterias').textContent = `${qtdBaterias} x ${unidadeKWh} kWh (${batSpec.v}V)`;
    document.getElementById('resPotenciaInversor').textContent = `${potenciaInversor} kW`;
    document.getElementById('resCorrenteMPPT').textContent = formatarNumeroComSufixo(correnteMPPT, 0) + ' A';
    document.getElementById('resPesoBaterias').textContent = formatarNumeroComSufixo(pesoTotal, 1) + ' kg';
    
    const moeda = traducoes[idiomaAtual]?.['moeda'] || 'R$';
    const formatarPreco = (valor) => `${moeda} ${valor.toLocaleString(idiomaAtual, {minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true})}`;
    
    // Exibir custos detalhados
    document.getElementById('resPrecoEstimado').textContent = formatarPreco(custoTotal);
    document.getElementById('custoPaineis').textContent = formatarPreco(custoPaineis);
    document.getElementById('custoBaterias').textContent = formatarPreco(custoBaterias);
    document.getElementById('custoInversor').textContent = formatarPreco(custoInversor);
    document.getElementById('custoMPPT').textContent = formatarPreco(custoMPPT);
    
    // Motivo do dimensionamento das BATERIAS — explica os parâmetros que geraram o dimensionamento
    // Ex: autonomia X dias × consumoDiario Y kWh → utilizável necessário Z kWh → DoD alvo W% → capacidade nominal necessária T kWh → módulos M × S kWh
    let motivoBateriasGargalo = '';
    let motivoBateriasDetalhes = '';
    const consumoDiario = energiaDiaria; // kWh/dia
    const capNecessariaRounded = Math.round(capacidadeNecessariaKWh * 100) / 100;
    const energiaPorBatRounded = Math.round(energiaPorBateria * 100) / 100;

    if (autonomia > 1) {
        if (idiomaAtual === 'pt-BR') {
            motivoBateriasGargalo = '(gargalo: autonomia)';
            motivoBateriasDetalhes = `${autonomia} dia(s) × ${formatarNumeroDecimal(consumoDiario, 3)} kWh/dia<br>→ utilizável necessário ${formatarNumeroDecimal(energiaAutonomia, 3)} kWh<br>→ DoD alvo ${Math.round(dodAlvo * 100)}%<br>→ capacidade nominal necessária ${formatarNumeroDecimal(capNecessariaRounded, 2)} kWh<br>→ ${qtdBaterias} × ${formatarNumeroDecimal(energiaPorBatRounded, 2)} kWh`;
        } else {
            motivoBateriasGargalo = '(limite: autonomia)';
            motivoBateriasDetalhes = `${autonomia} giorno(i) × ${formatarNumeroDecimal(consumoDiario, 3)} kWh/giorno<br>→ utilizzabile necessario ${formatarNumeroDecimal(energiaAutonomia, 3)} kWh<br>→ DoD target ${Math.round(dodAlvo * 100)}%<br>→ capacità nominale necessaria ${formatarNumeroDecimal(capNecessariaRounded, 2)} kWh<br>→ ${qtdBaterias} × ${formatarNumeroDecimal(energiaPorBatRounded, 2)} kWh`;
        }
    } else {
        // Quando autonomia === 1, o dimensionamento vem da vida útil / DoD desejado
        if (idiomaAtual === 'pt-BR') {
            motivoBateriasGargalo = '(gargalo: vida útil)';
            motivoBateriasDetalhes = `DoD alvo ${Math.round(dodAlvo * 100)}%<br>→ energia diária ${formatarNumeroDecimal(consumoDiario, 3)} kWh<br>→ capacidade nominal necessária ${formatarNumeroDecimal(capNecessariaRounded, 2)} kWh<br>→ ${qtdBaterias} × ${formatarNumeroDecimal(energiaPorBatRounded, 2)} kWh`;
        } else {
            motivoBateriasGargalo = '(limite: vita utile)';
            motivoBateriasDetalhes = `DoD target ${Math.round(dodAlvo * 100)}%<br>→ energia giornaliera ${formatarNumeroDecimal(consumoDiario, 3)} kWh<br>→ capacità nominale necessaria ${formatarNumeroDecimal(capNecessariaRounded, 2)} kWh<br>→ ${qtdBaterias} × ${formatarNumeroDecimal(energiaPorBatRounded, 2)} kWh`;
        }
    }
    document.getElementById('resMotivoBaterias').innerHTML = `${motivoBateriasGargalo}<br>${motivoBateriasDetalhes}`;
    
    // Motivo do dimensionamento dos PAINÉIS — explicita porque exigem essa potência (recarga do banco)
    const energiaUtilBancoRounded = Math.round(energiaUtilizavelBanco * 100) / 100;
    const energiaTotalGerarRounded = Math.round(energiaTotalGerar * 100) / 100;
    const potenciaReqRounded = Math.round(potenciaSolarNecessaria);
    let motivoPaineisGargalo = '';
    let motivoPaineisDetalhes = '';
    if (idiomaAtual === 'pt-BR') {
        motivoPaineisGargalo = '(gargalo: recarga do banco)';
        motivoPaineisDetalhes = `banco fornece ${energiaUtilBancoRounded} kWh utilizáveis<br>→ com perdas ${energiaTotalGerarRounded} kWh/dia<br>→ potência requerida ≈ ${potenciaReqRounded} W<br>→ ${qtdPaineis} × ${POTENCIA_PAINEL}W`;
    } else {
        motivoPaineisGargalo = '(limite: ricarica banco)';
        motivoPaineisDetalhes = `banco fornisce ${energiaUtilBancoRounded} kWh utilizzabili<br>→ con perdite ${energiaTotalGerarRounded} kWh/giorno<br>→ potenza richiesta ≈ ${potenciaReqRounded} W<br>→ ${qtdPaineis} × ${POTENCIA_PAINEL}W`;
    }
    document.getElementById('resMotivoPaineis').innerHTML = `${motivoPaineisGargalo}<br>${motivoPaineisDetalhes}`;
    
    // Motivo do dimensionamento do INVERSOR — baseado no consumo de pico
    let motivoInversorGargalo = '';
    let motivoInversorDetalhes = '';
    if (idiomaAtual === 'pt-BR') {
        motivoInversorGargalo = '(gargalo: consumo de pico)';
        motivoInversorDetalhes = `consumo médio ${formatarNumeroDecimal(consumoMedioHorario, 2)} kW/h × fator pico ${FATOR_PICO_CONSUMO}<br>→ ${formatarNumeroDecimal(consumoPico, 2)} kW<br>→ inversor ${potenciaInversor} kW`;
    } else {
        motivoInversorGargalo = '(limite: consumo di picco)';
        motivoInversorDetalhes = `consumo medio ${formatarNumeroDecimal(consumoMedioHorario, 2)} kW/h × fattore picco ${FATOR_PICO_CONSUMO}<br>→ ${formatarNumeroDecimal(consumoPico, 2)} kW<br>→ inverter ${potenciaInversor} kW`;
    }
    document.getElementById('resMotivoInversor').innerHTML = `${motivoInversorGargalo}<br>${motivoInversorDetalhes}`;
    
    // Motivo do dimensionamento do MPPT — baseado na corrente máxima dos painéis
    let motivoMPPTGargalo = '';
    let motivoMPPTDetalhes = '';
    if (idiomaAtual === 'pt-BR') {
        motivoMPPTGargalo = '(gargalo: corrente máxima)';
        motivoMPPTDetalhes = `${qtdPaineis} painéis × ${formatarNumeroComSufixo(POTENCIA_PAINEL, 0)}W<br>→ ${formatarNumeroComSufixo(potenciaTotalPaineis, 0)}W ÷ ${tensaoBanco}V<br>→ ${formatarNumeroComSufixo(correnteMaxima, 1)}A<br>→ MPPT ${formatarNumeroComSufixo(correnteMPPT, 0)}A`;
    } else {
        motivoMPPTGargalo = '(limite: corrente massima)';
        motivoMPPTDetalhes = `${qtdPaineis} pannelli × ${formatarNumeroComSufixo(POTENCIA_PAINEL, 0)}W<br>→ ${formatarNumeroComSufixo(potenciaTotalPaineis, 0)}W ÷ ${tensaoBanco}V<br>→ ${formatarNumeroComSufixo(correnteMaxima, 1)}A<br>→ MPPT ${formatarNumeroComSufixo(correnteMPPT, 0)}A`;
    }
    document.getElementById('resMotivoMPPT').innerHTML = `${motivoMPPTGargalo}<br>${motivoMPPTDetalhes}`;
    
    // Atualiza o memorial se estiver visível
    if (typeof atualizarMemorialComValores === 'function') {
        atualizarMemorialComValores();
    }
}

// ============================================
// ATUALIZAR ESPECIFICAÇÕES DAS BATERIAS NOS BOTÕES
// ============================================
function atualizarEspecsBaterias() {
    const config = obterConfig();
    
    // Calcula Ah a partir de kWh e tensão
    const ahAGM = Math.round((config.capacidadeAGM * 1000) / config.tensaoAGM);
    const ahLitio = Math.round((config.capacidadeLitio * 1000) / config.tensaoLitio);
    
    // Atualiza especificações AGM
    const specsAGM = document.getElementById('especsAGM');
    if (specsAGM) {
        specsAGM.innerHTML = `
            <span class="espec-item">${config.tensaoAGM}V & ${ahAGM}Ah</span>
            <span class="espec-item">${config.capacidadeAGM.toFixed(1)} kWh</span>
        `;
    }
    
    // Atualiza especificações LiFePO4
    const specsLitio = document.getElementById('especsLitio');
    if (specsLitio) {
        specsLitio.innerHTML = `
            <span class="espec-item">${config.tensaoLitio}V & ${ahLitio}Ah</span>
            <span class="espec-item">${config.capacidadeLitio.toFixed(1)} kWh</span>
        `;
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Configurar botões de idioma
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            trocarIdioma(btn.getAttribute('data-lang'));
        });
    });

    // 2. Configurar botões de seta (Arrow Buttons)
    document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        const step = parseFloat(btn.getAttribute('data-step'));
        
        // Cada botão tem seu próprio controle de intervalo/timeout
        let intervalId = null;
        let timeoutId = null;

        // Função para iniciar a repetição
        const startRepeating = () => {
            // Limpa qualquer intervalo/timeout anterior
            if (timeoutId) clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
            
            // Primeiro ajuste imediato
            ajustarValor(targetId, step);
            
            // Configura repetição após delay
            timeoutId = setTimeout(() => {
                intervalId = setInterval(() => {
                    ajustarValor(targetId, step);
                }, 100); // Repete a cada 100ms
            }, 500); // Delay de 500ms antes de começar a repetir
        };

        // Função para parar a repetição
        const stopRepeating = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        // Eventos de Mouse (PC)
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Evita seleção de texto
            startRepeating();
        });
        btn.addEventListener('mouseup', stopRepeating);
        btn.addEventListener('mouseleave', stopRepeating);

        // Eventos de Toque (Mobile)
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Evita scroll/zoom
            startRepeating();
        });
        btn.addEventListener('touchend', stopRepeating);
        btn.addEventListener('touchcancel', stopRepeating);
    });

    // 3. Configurar sliders (eventos de input)
    const sliderConsumo = document.getElementById('sliderConsumo');
    const sliderAutonomia = document.getElementById('sliderAutonomia');
    const sliderVidaUtil = document.getElementById('sliderVidaUtil');
    
    sliderConsumo.addEventListener('input', () => {
        const valor = parseInt(sliderConsumo.value);
        const inputConsumo = document.getElementById('inputConsumo');
        if (inputConsumo) {
            inputConsumo.value = valor;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputConsumo);
        }
        atualizarInterface();
    });
    
    sliderAutonomia.addEventListener('input', () => {
        const valor = parseInt(sliderAutonomia.value);
        const inputAutonomia = document.getElementById('inputAutonomia');
        if (inputAutonomia) {
            inputAutonomia.value = valor;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAutonomia);
        }
        atualizarInterface();
    });
    
    sliderVidaUtil.addEventListener('input', () => {
        const valor = parseFloat(sliderVidaUtil.value);
        const inputVidaUtil = document.getElementById('inputVidaUtil');
        if (inputVidaUtil) {
            inputVidaUtil.value = Math.round(valor);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputVidaUtil);
        }
        atualizarInterface();
    });
    
    // 3B. Configurar botão do memorial
    const btnMemorial = document.getElementById('btnMemorial');
    const memorialSection = document.getElementById('memorialSection');
    const resultadosSection = document.querySelector('.cartao:last-of-type');
    
    if (btnMemorial && memorialSection) {
        btnMemorial.addEventListener('click', () => {
            toggleMemorial();
        });
    }
    
    // Configurar botões de fechar o memorial
    const btnFecharMemorial = document.getElementById('btnFecharMemorial');
    const botoesVoltarMemorial = document.querySelectorAll('.btn-voltar-memorial');
    
    if (btnFecharMemorial) {
        btnFecharMemorial.addEventListener('click', () => {
            toggleMemorial();
        });
    }
    
    botoesVoltarMemorial.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleMemorial();
        });
    });
    
    // 3C. Configurar inputs editáveis (permitem valores fora dos limites do slider)
    const inputConsumo = document.getElementById('inputConsumo');
    const inputAutonomia = document.getElementById('inputAutonomia');
    const inputVidaUtil = document.getElementById('inputVidaUtil');
    
    if (inputConsumo) {
        inputConsumo.addEventListener('focus', (e) => e.target.select());
        inputConsumo.addEventListener('input', () => {
            const valor = parseInt(inputConsumo.value);
            if (!isNaN(valor) && valor > 0) {
                // Atualiza o slider apenas se estiver dentro dos limites
                if (valor >= parseInt(sliderConsumo.min) && valor <= parseInt(sliderConsumo.max)) {
                    sliderConsumo.value = valor;
                }
                // Sempre recalcula, mesmo se estiver fora dos limites
                atualizarInterface();
            }
        });
    }
    
    if (inputAutonomia) {
        inputAutonomia.addEventListener('focus', (e) => e.target.select());
        inputAutonomia.addEventListener('input', () => {
            const valor = parseInt(inputAutonomia.value);
            if (!isNaN(valor) && valor > 0) {
                if (valor >= parseInt(sliderAutonomia.min) && valor <= parseInt(sliderAutonomia.max)) {
                    sliderAutonomia.value = valor;
                }
                atualizarInterface();
            }
        });
    }
    
    if (inputVidaUtil) {
        inputVidaUtil.addEventListener('focus', (e) => e.target.select());
        inputVidaUtil.addEventListener('input', () => {
            const valor = parseFloat(inputVidaUtil.value);
            if (!isNaN(valor) && valor > 0) {
                const tipoBateria = document.querySelector('input[name="tipoBateria"]:checked')?.value || 'chumbo';
                const minVida = tipoBateria === 'litio' ? 5 : 1;
                const maxVida = tipoBateria === 'litio' ? 25 : 5;
                
                if (valor >= minVida && valor <= maxVida) {
                    sliderVidaUtil.value = valor;
                }
                atualizarInterface();
            }
        });
    }

    // 4. Configurar Radio Buttons (Tipo de Bateria)
    document.querySelectorAll('input[name="tipoBateria"]').forEach(radio => {
        radio.addEventListener('change', atualizarInterface);
    });

    // 5. Inicializar
    trocarIdioma(idiomaAtual);
    
    // 6. Atualizar especificações das baterias nos botões
    atualizarEspecsBaterias();
    
    // 7. Ajustar tamanho inicial de todos os inputs
    if (typeof ajustarTamanhoInput === 'function') {
        const inputConsumo = document.getElementById('inputConsumo');
        const inputAutonomia = document.getElementById('inputAutonomia');
        const inputVidaUtil = document.getElementById('inputVidaUtil');
        if (inputConsumo) ajustarTamanhoInput(inputConsumo);
        if (inputAutonomia) ajustarTamanhoInput(inputAutonomia);
        if (inputVidaUtil) ajustarTamanhoInput(inputVidaUtil);
    }
    
    // 8. Calcular valores iniciais
    atualizarInterface();
});

// ============================================
// FUNÇÕES DO MEMORIAL DE CÁLCULO
// ============================================

/**
 * Atualiza as fórmulas do memorial de cálculo conforme o idioma selecionado
 * @param {string} idioma - Idioma atual ('pt-BR' ou 'it-IT')
 */
function atualizarFormulasMemorial(idioma) {
    // Lista de todas as chaves de fórmulas
    const chavesFormulas = [
        'memorial-formula-passo1',
        'memorial-formula-passo2-1',
        'memorial-formula-passo2-2',
        'memorial-formula-passo3-1',
        'memorial-formula-passo3-2',
        'memorial-formula-passo3-3',
        'memorial-formula-passo4-1',
        'memorial-formula-passo4-2',
        'memorial-formula-passo4-3',
        'memorial-formula-passo5-1',
        'memorial-formula-passo5-2',
        'memorial-formula-passo5-3',
        'memorial-formula-passo6-1',
        'memorial-formula-passo6-2',
        'memorial-formula-passo6-3',
        'memorial-formula-passo7-1',
        'memorial-formula-passo7-2',
        'memorial-formula-passo7-3',
        'memorial-formula-passo8-1',
        'memorial-formula-passo8-2',
        'memorial-formula-passo8-3',
        'memorial-formula-passo8-4',
        'memorial-formula-passo8-5'
    ];
    
    // Atualiza cada fórmula
    chavesFormulas.forEach(chave => {
        const elemento = document.getElementById(chave);
        if (elemento && traducoes[idioma] && traducoes[idioma][chave]) {
            elemento.textContent = traducoes[idioma][chave];
        }
    });
}

/**
 * Alterna a exibição do memorial de cálculo
 * Esconde a seção de resultados e mostra o memorial, ou vice-versa
 */
function toggleMemorial() {
    const memorialSection = document.getElementById('memorialSection');
    const resultadosSection = document.querySelector('.cartao:last-of-type');
    
    if (!memorialSection) {
        console.error('memorialSection não encontrado');
        return;
    }
    
    if (memorialSection.style.display === 'none' || memorialSection.style.display === '') {
        // Atualizar memorial com valores atuais
        atualizarMemorialComValores();
        memorialSection.style.display = 'block';
        if (resultadosSection) resultadosSection.style.display = 'none';
        // Rolar para o topo da página
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        memorialSection.style.display = 'none';
        if (resultadosSection) resultadosSection.style.display = 'block';
    }
}

/**
 * Atualiza o memorial de cálculo com os valores atuais dos cálculos
 * Preenche os exemplos e o resumo com os valores reais calculados
 */
function atualizarMemorialComValores() {
    // Obter valores atuais
    const inputConsumo = document.getElementById('inputConsumo');
    const inputAutonomia = document.getElementById('inputAutonomia');
    const inputVidaUtil = document.getElementById('inputVidaUtil');
    const sliderConsumo = document.getElementById('sliderConsumo');
    const sliderAutonomia = document.getElementById('sliderAutonomia');
    const sliderVidaUtil = document.getElementById('sliderVidaUtil');
    const tipoBateria = document.querySelector('input[name="tipoBateria"]:checked')?.value || 'litio';
    
    const consumoMensal = inputConsumo ? parseFloat(inputConsumo.value) || parseFloat(sliderConsumo.value) || 0 : parseFloat(sliderConsumo.value) || 0;
    const autonomia = inputAutonomia ? parseInt(inputAutonomia.value) || parseInt(sliderAutonomia.value) : parseInt(sliderAutonomia.value);
    const vidaUtil = inputVidaUtil ? parseFloat(inputVidaUtil.value) || parseFloat(sliderVidaUtil.value) : parseFloat(sliderVidaUtil.value);
    
    if (consumoMensal <= 0) return;
    
    // Calcular valores
    const energiaDiaria = consumoMensal / 30;
    const ciclos = vidaUtil * 365;
    const dodAlvo = obterDoDPorCiclos(ciclos, tipoBateria);
    const dodDecimal = dodAlvo / 100;
    
    const config = obterConfig();
    const batSpec = (tipoBateria === 'litio')
        ? { v: config.tensaoLitio, kwh: config.capacidadeLitio, price_brl: config.precoLitio, weight: config.pesoLitio }
        : { v: config.tensaoAGM, kwh: config.capacidadeAGM, price_brl: config.precoAGM, weight: config.pesoAGM };
    
    const energiaPorBateria = batSpec.kwh || 0;
    const capVidaUtil = energiaDiaria / dodDecimal;
    const capAutonomia = (energiaDiaria * autonomia) / dodDecimal;
    const capacidadeNecessariaKWh = Math.max(capVidaUtil, capAutonomia);
    
    let qtdBaterias = Math.ceil(capacidadeNecessariaKWh / energiaPorBateria);
    if (qtdBaterias % 2 !== 0 && qtdBaterias > 1) qtdBaterias++;
    
    const capacidadeRealKWh = qtdBaterias * energiaPorBateria;
    const energiaUtilizavelBanco = capacidadeRealKWh * dodDecimal;
    const energiaGerar = energiaUtilizavelBanco / EFICIENCIA_SISTEMA;
    const potenciaNecessariaW = (energiaGerar * 1000) / HSP;
    const qtdPaineis = Math.ceil(potenciaNecessariaW / config.potenciaPainel);
    
    // Calcular inversor baseado no consumo de pico
    const consumoMedioHorario = energiaDiaria / 24;
    const consumoPico = consumoMedioHorario * FATOR_PICO_CONSUMO;
    const potenciaInversor = Math.max(1, Math.ceil(consumoPico));
    
    // Calcular MPPT baseado na corrente máxima dos painéis
    const potenciaTotalPaineis = qtdPaineis * config.potenciaPainel;
    const tensaoBanco = batSpec.v;
    const correnteMaxima = potenciaTotalPaineis / tensaoBanco;
    let correnteMPPT = Math.max(20, Math.ceil(correnteMaxima));
    // Arredonda para valores comerciais
    if (correnteMPPT > 100) {
        correnteMPPT = Math.ceil(correnteMPPT / 50) * 50;
    } else if (correnteMPPT > 60) {
        correnteMPPT = 100;
    } else if (correnteMPPT > 40) {
        correnteMPPT = 60;
    } else if (correnteMPPT > 20) {
        correnteMPPT = 40;
    } else {
        correnteMPPT = 20;
    }
    
    // Formatação
    const moeda = traducoes[idiomaAtual]?.['moeda'] || 'R$';
    const formatarNumero = (num) => num.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2, useGrouping: true });
    const formatarMoeda = (num) => num.toLocaleString(idiomaAtual, { style: 'currency', currency: moeda === 'R$' ? 'BRL' : 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
    
    // Atualizar exemplos
    const exemploEnergiaDiaria = document.getElementById('memorial-exemplo-energia-diaria');
    if (exemploEnergiaDiaria) {
        exemploEnergiaDiaria.textContent = `Consumo de ${consumoMensal} kWh/mês → ${consumoMensal} ÷ 30 = ${formatarNumero(energiaDiaria)} kWh/dia`;
    }
    
    const exemploDod = document.getElementById('memorial-exemplo-dod');
    if (exemploDod) {
        exemploDod.textContent = `Vida útil de ${vidaUtil} anos → ${vidaUtil} × 365 = ${ciclos} ciclos → DoD ≈ ${Math.round(dodAlvo)}% (${tipoBateria === 'litio' ? 'LiFePO4' : 'AGM'})`;
    }
    
    const exemploCapacidade = document.getElementById('memorial-exemplo-capacidade');
    if (exemploCapacidade) {
        exemploCapacidade.textContent = `${formatarNumero(energiaDiaria)} kWh/dia, DoD ${Math.round(dodAlvo)}%, ${autonomia} dias autonomia → Máximo(${formatarNumero(energiaDiaria)}÷${(dodDecimal).toFixed(2)}=${formatarNumero(capVidaUtil)} kWh, ${formatarNumero(energiaDiaria)}×${autonomia}÷${(dodDecimal).toFixed(2)}=${formatarNumero(capAutonomia)} kWh) = ${formatarNumero(capacidadeNecessariaKWh)} kWh`;
    }
    
    const exemploBaterias = document.getElementById('memorial-exemplo-baterias');
    if (exemploBaterias) {
        exemploBaterias.textContent = `${formatarNumero(capacidadeNecessariaKWh)} kWh necessários, baterias de ${formatarNumero(energiaPorBateria)} kWh → ${formatarNumero(capacidadeNecessariaKWh)}÷${formatarNumero(energiaPorBateria)} = ${formatarNumero(capacidadeNecessariaKWh / energiaPorBateria)} → ${qtdBaterias} baterias → ${qtdBaterias}×${formatarNumero(energiaPorBateria)} = ${formatarNumero(capacidadeRealKWh)} kWh instalados → ${formatarNumero(capacidadeRealKWh)}×${(dodDecimal).toFixed(2)} = ${formatarNumero(energiaUtilizavelBanco)} kWh utilizáveis`;
    }
    
    const exemploPaineis = document.getElementById('memorial-exemplo-paineis');
    if (exemploPaineis) {
        exemploPaineis.textContent = `${formatarNumero(energiaUtilizavelBanco)} kWh utilizáveis, eficiência 80%, HSP ${HSP}h → ${formatarNumero(energiaUtilizavelBanco)}÷0.8 = ${formatarNumero(energiaGerar)} kWh/dia → ${formatarNumero(energiaGerar)}×1000÷${HSP} = ${formatarNumeroComSufixo(potenciaNecessariaW, 0)}W → ${formatarNumeroComSufixo(potenciaNecessariaW, 0)}÷${formatarNumeroComSufixo(config.potenciaPainel, 0)}W = ${formatarNumeroComSufixo(potenciaNecessariaW / config.potenciaPainel, 1)} → ${qtdPaineis} painéis`;
    }
    
    const exemploInversor = document.getElementById('memorial-exemplo-inversor');
    if (exemploInversor) {
        exemploInversor.textContent = `Consumo diário ${formatarNumero(energiaDiaria)} kWh → ${formatarNumero(energiaDiaria)}÷24 = ${formatarNumero(consumoMedioHorario)} kW/h × ${FATOR_PICO_CONSUMO} = ${formatarNumero(consumoPico)} kW pico → Inversor de ${potenciaInversor} kW`;
    }
    
    const exemploMPPT = document.getElementById('memorial-exemplo-mppt');
    if (exemploMPPT) {
        exemploMPPT.textContent = `${qtdPaineis} painéis × ${formatarNumeroComSufixo(config.potenciaPainel, 0)}W = ${formatarNumeroComSufixo(potenciaTotalPaineis, 0)}W ÷ ${tensaoBanco}V = ${formatarNumeroComSufixo(correnteMaxima, 1)}A → MPPT de ${formatarNumeroComSufixo(correnteMPPT, 0)}A`;
    }
    
    const exemploCustos = document.getElementById('memorial-exemplo-custos');
    if (exemploCustos) {
        // Converter preços para a moeda do idioma
        const fatorConversao = idiomaAtual === 'pt-BR' ? 1 : 1 / TAXA_BRL_EUR;
        const precoPainelConvertido = config.precoPainel * fatorConversao;
        const precoBateriaConvertido = batSpec.price_brl * fatorConversao;
        const moedaCalculo = moeda === 'R$' ? 'BRL' : 'EUR';
        const custoPaineis = qtdPaineis * precoPainelConvertido;
        const custoBaterias = qtdBaterias * precoBateriaConvertido;
        const custoInversor = calcularPrecoInversor(potenciaInversor, moedaCalculo);
        const custoMPPT = calcularPrecoMPPT(correnteMPPT, moedaCalculo);
        const custoTotal = custoPaineis + custoBaterias + custoInversor + custoMPPT;
        exemploCustos.textContent = `${qtdPaineis} painéis × ${formatarMoeda(precoPainelConvertido)} + ${qtdBaterias} baterias × ${formatarMoeda(precoBateriaConvertido)} + inversor ${formatarMoeda(custoInversor)} + MPPT ${formatarMoeda(custoMPPT)} = ${formatarMoeda(custoPaineis)} + ${formatarMoeda(custoBaterias)} + ${formatarMoeda(custoInversor)} + ${formatarMoeda(custoMPPT)} = ${formatarMoeda(custoTotal)}`;
    }
    
    // Atualizar resumo
    const resumoEnergiaDiaria = document.getElementById('resumo-energia-diaria');
    if (resumoEnergiaDiaria) resumoEnergiaDiaria.textContent = `${formatarNumero(energiaDiaria)} kWh/dia`;
    
    const resumoDod = document.getElementById('resumo-dod');
    if (resumoDod) resumoDod.textContent = `${Math.round(dodAlvo)}%`;
    
    const resumoCapacidade = document.getElementById('resumo-capacidade');
    if (resumoCapacidade) resumoCapacidade.textContent = `${formatarNumero(capacidadeNecessariaKWh)} kWh`;
    
    const resumoBaterias = document.getElementById('resumo-baterias');
    if (resumoBaterias) resumoBaterias.textContent = `${qtdBaterias} × ${formatarNumero(energiaPorBateria)} kWh = ${formatarNumero(capacidadeRealKWh)} kWh`;
    
    const resumoPaineis = document.getElementById('resumo-paineis');
    if (resumoPaineis) resumoPaineis.textContent = `${qtdPaineis} × ${formatarNumeroComSufixo(config.potenciaPainel, 0)}W = ${formatarNumero((qtdPaineis * config.potenciaPainel) / 1000)} kW`;
    
    const resumoInversor = document.getElementById('resumo-inversor');
    if (resumoInversor) resumoInversor.textContent = `${potenciaInversor} kW`;
    
    const resumoMPPT = document.getElementById('resumo-mppt');
    if (resumoMPPT) resumoMPPT.textContent = formatarNumeroComSufixo(correnteMPPT, 0) + ' A';
}
