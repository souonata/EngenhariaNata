// CALCULADORA SOLAR
// Dimensionamento de Sistema Fotovoltaico Off-Grid
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
//    diário alvo. DoD menor → mais capacidade nominal necessária.
// 3) Capacidade nominal necessária (kWh): calcula-se tanto pelo critério
//    "vida útil" (energia diária ÷ DoD) quanto pelo critério "autonomia"
//    (energia diária × dias de autonomia ÷ DoD). O requisito final é o
//    máximo desses dois (para atender ambos os critérios).
// 4) Determina-se energia entregue por uma unidade de bateria (kWh). // Se bateria estiver configurada em Ah, converte via tensão (V × Ah / 1000 → kWh).
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
// Formata número decimal sempre com vírgula como separador decimal
function formatarDecimalComVirgula(valor, casasDecimais = 2) {
    if (isNaN(valor) || valor === null || valor === undefined) return '0,00';
    return valor.toFixed(casasDecimais).replace('.', ',');
}
// Formata moeda sempre com vírgula como separador decimal
function formatarMoedaComVirgula(valor, moeda, casasDecimais = 2) {
    if (isNaN(valor) || valor === null || valor === undefined) return `${moeda} 0,00`;
    // Sempre usa pt-BR para garantir vírgula como separador decimal
    return `${moeda} ${valor.toLocaleString('pt-BR', {minimumFractionDigits: casasDecimais, maximumFractionDigits: casasDecimais})}`;
}
// Converte string formatada com vírgula para número
function converterVirgulaParaNumero(valorFormatado) {
    if (!valorFormatado || typeof valorFormatado !== 'string') return 0;
    // Substitui vírgula por ponto para parseFloat
    return parseFloat(valorFormatado.replace(',', '.')) || 0;
}
// CONSTANTES DO SISTEMA (Valores Fixos)
// ============================================
// HSP
const HSP = 5.0; // Horas de Sol Pleno (média conservadora)
// EFICIENCIA_SISTEMA
const EFICIENCIA_SISTEMA = 0.80; // Eficiência global (80% = perdas de 20%)
// FATOR_PICO_CONSUMO
const FATOR_PICO_CONSUMO = 5.0; // Fator de pico (5x o consumo médio horário)
// Taxa de conversão BRL → EUR
const TAXA_BRL_EUR = (typeof SiteConfig !== 'undefined' && SiteConfig.DEFAULTS && SiteConfig.DEFAULTS.TAXA_BRL_EUR) ? SiteConfig.DEFAULTS.TAXA_BRL_EUR : 6.19;
// VALORES PADRÃO DOS COMPONENTES (em BRL)
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
// TABELAS DE VIDA ÚTIL (Ciclos vs Descarga)
// DoD mínimo = 25%, máximo = 95%

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
// PREÇOS DE INVERSORES OFF-GRID COM MPPT INTEGRADO
// Em sistemas off-grid, todos os inversores modernos já vêm com MPPT integrado
// Valores baseados em pesquisa de mercado 2024-2025
// Cada inversor inclui capacidade MPPT proporcional à sua potência
const PRECOS_INVERSOR_BRL = [
    { kw: 1, preco: 1800, mpptA: 40 },   // Inversor 1kW com MPPT 40A integrado
    { kw: 2, preco: 2800, mpptA: 60 },   // Inversor 2kW com MPPT 60A integrado
    { kw: 3, preco: 3800, mpptA: 80 },   // Inversor 3kW com MPPT 80A integrado
    { kw: 5, preco: 5500, mpptA: 100 },  // Inversor 5kW com MPPT 100A integrado
    { kw: 6, preco: 6500, mpptA: 120 }   // Inversor 6kW com MPPT 120A integrado
];
const PRECOS_INVERSOR_EUR = [
    { kw: 1, preco: 291, mpptA: 40 },
    { kw: 2, preco: 452, mpptA: 60 },
    { kw: 3, preco: 614, mpptA: 80 },
    { kw: 5, preco: 889, mpptA: 100 },
    { kw: 6, preco: 1050, mpptA: 120 }
];
// PREÇOS DE MPPT (Controlador de Carga)
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
]; // capacidade MPPT integrada de um inversor baseado na sua potência
function obterCapacidadeMPPTIntegrado(potenciaKw) {
    const tabela = PRECOS_INVERSOR_BRL; // Usa qualquer tabela, ambas têm mpptA
    for (let i = 0; i < tabela.length; i++) {
        if (tabela[i].kw >= potenciaKw) {
            return tabela[i].mpptA;
        }
    }
    // Se não encontrou, retorna a maior capacidade disponível
    return tabela[tabela.length - 1].mpptA;
} // preço estimado de um inversor baseado na potência desejada
function calcularPrecoInversor(potenciaKw, moeda) {
    // PASSO 1: Seleciona a tabela de preços baseada na moeda // Se moeda for BRL (Real), usa a tabela em reais; caso contrário, usa a tabela em euros
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
        const penultimo = tabela[tabela.length - 2];   // Penúltimo ponto da tabela // taxa de variação de preço por kW (inclinação da reta)
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
        const p2 = tabela[i + 1]; // Ponto superior do intervalo // potência está dentro deste intervalo
        if (potenciaKw >= p1.kw && potenciaKw <= p2.kw) { // razão (0 a 1) de onde a potência está no intervalo
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
// DICIONÁRIO DE TRADUÇÃO
const traducoes = {
    'pt-BR': {
        'dev-badge-header': '🚧 EM DESENVOLVIMENTO',
        'app-title': '🔋 Energia Solar',
        'app-subtitle': 'Dimensionamento de Sistema Fotovoltaico',
        'label-consumo': 'Consumo Médio Mensal',
        'tooltip-consumo-texto': 'O consumo médio mensal representa a quantidade de energia elétrica que você utiliza por mês, medida em quilowatt-hora (kWh). Este valor é usado para calcular a energia diária necessária e dimensionar todo o sistema fotovoltaico. Você pode encontrar este valor na sua conta de luz.',
        'label-autonomia': 'Dias de Autonomia',
        'tooltip-autonomia-texto': 'Os dias de autonomia representam quantos dias consecutivos o sistema deve conseguir fornecer energia sem receber luz solar. Por exemplo, se você configurar 3 dias de autonomia, o sistema será dimensionado para armazenar energia suficiente para funcionar por 3 dias mesmo sem sol, garantindo funcionamento durante períodos nublados ou chuvosos.',
        'label-tipo-bateria': 'Tipo de Bateria',
        'opt-chumbo': 'Chumbo-Ácido',
        'opt-litio': 'Lítio',
        'res-mppt-integrado': 'MPPT (Integrado)',
        'label-vida-util': 'Vida Útil Desejada',
        'tooltip-vida-util-texto': 'A vida útil desejada é o número de anos que você espera que o sistema funcione antes de precisar substituir as baterias. Baterias LiFePO4 podem durar até 25 anos com uso adequado, enquanto baterias AGM (chumbo-ácido) geralmente duram de 1 a 5 anos. Quanto maior a vida útil desejada, menor será o DoD (profundidade de descarga) diário para preservar as baterias.',
        'label-preco-kwh': 'Custo da Energia (kWh)',
        'tooltip-preco-kwh-texto': 'O custo da energia elétrica por kWh é o preço que você paga pela energia da rede elétrica. Este valor é usado para calcular a economia financeira do sistema solar ao longo do tempo. Você pode ajustar este valor para simular diferentes cenários de tarifa ou projeções futuras.',
        'dica-preco-kwh': '💡 Ajuste para simular diferentes cenários de tarifa',
        'nota-preco-kwh-pt': 'Valor padrão: R$ 0,75/kWh (média ANEEL, dez/2024)',
        'nota-preco-kwh-it': 'Valor padrão: € 0,30/kWh (média ARERA, dez/2024)',
        'label-aumento-anual-energia': 'Aumento Anual do Custo da Energia',
        'tooltip-aumento-anual-energia-texto': 'O aumento anual do custo da energia representa a taxa percentual de crescimento do preço da energia elétrica ao longo dos anos. Este valor é usado para calcular a economia acumulada considerando que a energia fica mais cara com o tempo. O valor padrão é baseado no histórico dos últimos 50 anos no Brasil e na Itália.',
        'dica-aumento-anual-energia': '💡 Baseado no histórico dos últimos 50 anos',
        'nota-aumento-anual-energia-pt': 'Valor padrão: 8%/ano (histórico Brasil 2000-2024)',
        'nota-aumento-anual-energia-it': 'Valor padrão: 6%/ano (histórico Itália)',
        'label-periodo-analise': 'Período de Análise do Gráfico',
        'tooltip-periodo-analise-texto': 'O período de análise do gráfico define quantos anos serão considerados na análise financeira de amortização e lucro líquido. O período mínimo é 1x a vida útil máxima da bateria selecionada (25 anos para LiFePO4, 5 anos para AGM), e o máximo é 4x esse valor. Valores maiores permitem ver projeções de longo prazo.',
        'dica-periodo-analise': '💡 Ajuste o período de análise do gráfico (1x a 4x vida útil máxima)',
        'unidade-anos': 'anos',
        'label-preco-bateria-kwh': 'Preço da Bateria (por kWh)',
        'tooltip-preco-bateria-kwh-texto': 'O preço da bateria por kWh representa o custo unitário de capacidade de armazenamento de energia. Este valor varia conforme o tipo de bateria (LiFePO4 é mais caro que AGM) e o mercado. Você pode ajustar este valor para simular diferentes custos de baterias e ver como isso afeta o custo total do sistema.',
        'dica-preco-bateria-kwh': '💡 Ajuste para simular diferentes custos de baterias',
        'nota-preco-bateria-kwh-pt': 'Valor padrão: R$ 2.000/kWh (média mercado LiFePO4, dez/2024)',
        'nota-preco-bateria-kwh-it': 'Valor padrão: € 320/kWh (média mercado LiFePO4, dez/2024)',
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
        'memorial-intro-text': 'Este memorial explica passo a passo como são calculados os componentes de um sistema fotovoltaico off-grid: número de painéis solares, capacidade de baterias, potência do inversor, corrente do MPPT e estimativa de custos. As fórmulas e a lógica de cálculo foram validadas por testes automatizados.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcular Energia Diária Necessária',
        'memorial-passo2-title': '2️⃣ Passo 2: Determinar DoD (Profundidade de Descarga) pela Vida Útil',
        'memorial-passo3-title': '3️⃣ Passo 3: Calcular Capacidade Necessária de Baterias',
        'memorial-passo4-title': '4️⃣ Passo 4: Calcular Número de Baterias',
        'memorial-passo5-title': '5️⃣ Passo 5: Calcular Número de Painéis Solares',
        'memorial-passo6-title': '6️⃣ Passo 6: Dimensionar o Inversor com MPPT Integrado',
        'memorial-passo7-title': '7️⃣ Passo 7: Verificar Capacidade MPPT do Inversor',
        'memorial-passo8-title': '8️⃣ Passo 8: Calcular Custo Total Estimado',
        'memorial-resumo-title': '📊 Resumo dos Cálculos Atuais',
        'memorial-formula': 'Fórmula:',
        'memorial-example': 'Exemplo:',
        'memorial-tip': '💡 Dica:',
        'memorial-constants': 'Constantes usadas:',
        'memorial-hsp': 'HSP (Horas de Sol Pleno) = 5 horas/dia (padrão para Brasil)',
        'memorial-eficiencia': 'Eficiência do Sistema = 80% (considera perdas de 20% em cabos, MPPT e inversor)',
        'memorial-passo1-explicacao': 'Esta é a quantidade de energia que o sistema precisa fornecer todos os dias para atender ao consumo médio.',
        'memorial-passo2-explicacao': 'O DoD (Depth of Discharge) determina quanto da capacidade da bateria pode ser usada diariamente. Quanto maior a vida útil desejada, menor deve ser o DoD para preservar a bateria. O DoD é calculado usando tabelas de ciclos vs DoD baseadas em dados de fabricantes, com interpolação linear para valores intermediários.',
        'memorial-dod-tip': 'Baterias LiFePO4 permitem DoD maiores (50-80%) que baterias AGM (30-50%) para a mesma vida útil.',
        'memorial-passo3-explicacao': 'Calculamos a capacidade necessária por dois critérios e escolhemos o maior: um para garantir a vida útil desejada e outro para garantir os dias de autonomia sem sol.',
        'memorial-passo4-explicacao': 'Arredondamos para cima para garantir que temos capacidade suficiente. Para tensões 24V e 48V, garantimos número par de baterias para facilitar a montagem em série/paralelo.',
        'memorial-passo5-explicacao': 'Os painéis precisam gerar energia suficiente para recarregar as baterias, considerando perdas do sistema (cabo, MPPT, inversor). A eficiência do sistema de 80% considera todas as perdas. Usamos HSP (Horas de Sol Pleno) de 5 horas/dia para estimar a geração diária, que representa o número médio de horas em que a radiação solar atinge 1000 W/m².',
        'memorial-passo6-explicacao': 'Em sistemas off-grid, todos os inversores modernos já vêm com MPPT integrado. O inversor converte DC das baterias para AC da casa e deve ter capacidade para o consumo de pico típico de uma residência. O fator de pico de 5x considera que o consumo não é constante ao longo do dia. Além disso, o inversor escolhido deve ter capacidade MPPT suficiente para suportar a corrente máxima dos painéis.',
        'memorial-passo7-explicacao': 'Verifica-se se o inversor escolhido tem capacidade MPPT integrada suficiente para os painéis. A corrente necessária é calculada dividindo a potência total dos painéis pela tensão do banco de baterias. Se o inversor inicial não tiver MPPT suficiente, escolhe-se um inversor maior até encontrar um com capacidade adequada. Isso garante que o sistema funcione corretamente sem necessidade de MPPT separado.',
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
        'memorial-formula-passo6-3': 'Potência Mínima do Inversor (kW) = Máximo(Consumo de Pico, 1 kW mínimo)',
        'memorial-formula-passo7-1': 'Potência Total dos Painéis = Número de Painéis × Potência por Painel (W)',
        'memorial-formula-passo7-2': 'Corrente Máxima Necessária = Potência Total dos Painéis ÷ Tensão do Banco (V)',
        'memorial-formula-passo7-3': 'Se Capacidade MPPT do Inversor < Corrente Máxima Necessária, aumenta potência do inversor até encontrar um com MPPT adequado',
        'memorial-formula-passo8-1': 'Custo Painéis = Número de Painéis × Preço por Painel',
        'memorial-formula-passo8-2': 'Custo Baterias = Número de Baterias × Preço por Bateria',
        'memorial-formula-passo8-3': 'Custo Inversor = Preço do Inversor com MPPT Integrado (da tabela de preços)',
        'memorial-formula-passo8-4': 'Custo MPPT = 0 (já incluído no inversor)',
        'memorial-formula-passo8-5': 'Custo Total = Custo Painéis + Custo Baterias + Custo Inversor',
        'aria-home': 'Voltar para a tela inicial',
        'watermark-dev': '🚧 EM DESENVOLVIMENTO',
        'learn-more': 'SAIBA MAIS!',
        'back': '← Voltar',
        'btn-memorial': 'Ver Memorial de Cálculo',
        'graficos-title': '📊 Visualizações',
        'grafico-amortizacao-title': 'Análise de Amortização do Sistema',
        'grafico-sazonalidade-title': 'Sazonalidade de Geração Solar'
    },
    'it-IT': {
        'dev-badge-header': '🚧 IN SVILUPPO',
        'app-title': '🔋 Energia Solare',
        'app-subtitle': 'Dimensionamento Impianto Fotovoltaico',
        'label-consumo': 'Consumo Medio Mensile',
        'tooltip-consumo-texto': 'Il consumo medio mensile rappresenta la quantità di energia elettrica che utilizzi al mese, misurata in chilowattora (kWh). Questo valore viene utilizzato per calcolare l\'energia giornaliera necessaria e dimensionare l\'intero sistema fotovoltaico. Puoi trovare questo valore nella tua bolletta elettrica.',
        'label-autonomia': 'Giorni di Autonomia',
        'tooltip-autonomia-texto': 'I giorni di autonomia rappresentano quanti giorni consecutivi il sistema deve essere in grado di fornire energia senza ricevere luce solare. Ad esempio, se imposti 3 giorni di autonomia, il sistema sarà dimensionato per immagazzinare energia sufficiente per funzionare per 3 giorni anche senza sole, garantendo il funzionamento durante periodi nuvolosi o piovosi.',
        'label-tipo-bateria': 'Tipo di Batteria',
        'opt-chumbo': 'Piombo-Acido',
        'opt-litio': 'Litio',
        'res-mppt-integrado': 'MPPT (Integrato)',
        'label-vida-util': 'Vita Utile Desiderata',
        'tooltip-vida-util-texto': 'La vita utile desiderata è il numero di anni che ti aspetti che il sistema funzioni prima di dover sostituire le batterie. Le batterie LiFePO4 possono durare fino a 25 anni con un uso adeguato, mentre le batterie AGM (piombo-acido) generalmente durano da 1 a 5 anni. Maggiore è la vita utile desiderata, minore sarà il DoD (profondità di scarica) giornaliero per preservare le batterie.',
        'label-preco-kwh': 'Costo dell\'Energia (kWh)',
        'tooltip-preco-kwh-texto': 'Il costo dell\'energia elettrica per kWh è il prezzo che paghi per l\'energia della rete elettrica. Questo valore viene utilizzato per calcolare il risparmio finanziario del sistema solare nel tempo. Puoi regolare questo valore per simulare diversi scenari tariffari o proiezioni future.',
        'dica-preco-kwh': '💡 Regola per simulare diversi scenari tariffari',
        'nota-preco-kwh-pt': 'Valore predefinito: R$ 0,75/kWh (media ANEEL, dic/2024)',
        'nota-preco-kwh-it': 'Valore predefinito: € 0,30/kWh (media ARERA, dic/2024)',
        'label-aumento-anual-energia': 'Aumento Annuo del Costo dell\'Energia',
        'tooltip-aumento-anual-energia-texto': 'L\'aumento annuo del costo dell\'energia rappresenta il tasso percentuale di crescita del prezzo dell\'energia elettrica nel corso degli anni. Questo valore viene utilizzato per calcolare il risparmio accumulato considerando che l\'energia diventa più costosa nel tempo. Il valore predefinito è basato sulla storia degli ultimi 50 anni in Brasile e in Italia.',
        'dica-aumento-anual-energia': '💡 Basato sulla storia degli ultimi 50 anni',
        'nota-aumento-anual-energia-pt': 'Valore predefinito: 8%/anno (storia Brasile 2000-2024)',
        'nota-aumento-anual-energia-it': 'Valore predefinito: 6%/anno (storia Italia)',
        'label-periodo-analise': 'Periodo di Analisi del Grafico',
        'tooltip-periodo-analise-texto': 'Il periodo di analisi del grafico definisce quanti anni saranno considerati nell\'analisi finanziaria di ammortamento e profitto netto. Il periodo minimo è 1x la vita utile massima della batteria selezionata (25 anni per LiFePO4, 5 anni per AGM), e il massimo è 4x quel valore. Valori maggiori consentono di vedere proiezioni a lungo termine.',
        'dica-periodo-analise': '💡 Regola il periodo di analisi del grafico (1x a 4x vita utile massima)',
        'unidade-anos': 'anni',
        'label-preco-bateria-kwh': 'Prezzo Batteria (per kWh)',
        'tooltip-preco-bateria-kwh-texto': 'Il prezzo della batteria per kWh rappresenta il costo unitario di capacità di accumulo di energia. Questo valore varia in base al tipo di batteria (LiFePO4 è più costosa dell\'AGM) e al mercato. Puoi regolare questo valore per simulare diversi costi delle batterie e vedere come ciò influisce sul costo totale del sistema.',
        'dica-preco-bateria-kwh': '💡 Regola per simulare diversi costi delle batterie',
        'nota-preco-bateria-kwh-pt': 'Valore predefinito: R$ 2.000/kWh (media mercato LiFePO4, dic/2024)',
        'nota-preco-bateria-kwh-it': 'Valore predefinito: € 320/kWh (media mercato LiFePO4, dic/2024)',
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
        'aria-home': 'Voltar para a tela inicial',
        'watermark-dev': '🚧 EM DESENVOLVIMENTO',
        'learn-more': 'SAIBA MAIS!',
        'back': '← Voltar',
        'btn-memorial': 'Ver Memorial de Cálculo',
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
        'memorial-intro-text': 'Questo memoriale spiega passo dopo passo come vengono calcolati i componenti di un sistema fotovoltaico off-grid: numero di pannelli solari, capacità delle batterie, potenza dell\'inverter, corrente del MPPT e stima dei costi. Le formule e la logica di calcolo sono state validate da test automatizzati.',
        'memorial-passo1-title': '1️⃣ Passo 1: Calcolare Energia Giornaliera Necessaria',
        'memorial-passo2-title': '2️⃣ Passo 2: Determinare DoD (Profondità di Scarica) dalla Vita Utile',
        'memorial-passo3-title': '3️⃣ Passo 3: Calcolare Capacità Necessaria delle Batterie',
        'memorial-passo4-title': '4️⃣ Passo 4: Calcolare Numero di Batterie',
        'memorial-passo5-title': '5️⃣ Passo 5: Calcolare Numero di Pannelli Solari',
        'memorial-passo6-title': '6️⃣ Passo 6: Dimensionare l\'Inverter con MPPT Integrato',
        'memorial-passo7-title': '7️⃣ Passo 7: Verificare Capacità MPPT dell\'Inverter',
        'memorial-passo8-title': '8️⃣ Passo 8: Calcolare Costo Totale Stimato',
        'memorial-resumo-title': '📊 Riepilogo dei Calcoli Attuali',
        'memorial-formula': 'Formula:',
        'memorial-example': 'Esempio:',
        'memorial-tip': '💡 Suggerimento:',
        'memorial-constants': 'Costanti utilizzate:',
        'memorial-hsp': 'HSP (Ore di Sole Pieno) = 5 ore/giorno (standard per il Brasile)',
        'memorial-eficiencia': 'Efficienza del Sistema = 80% (considera perdite del 20% in cavi, MPPT e inverter)',
        'memorial-passo1-explicacao': 'Questa è la quantità di energia che il sistema deve fornire ogni giorno per soddisfare il consumo medio.',
        'memorial-passo2-explicacao': 'Il DoD (Depth of Discharge) determina quanto della capacità della batteria può essere utilizzato quotidianamente. Maggiore è la vita utile desiderata, minore deve essere il DoD per preservare la batteria. Il DoD viene calcolato utilizzando tabelle di cicli vs DoD basate su dati dei produttori, con interpolazione lineare per valori intermedi.',
        'memorial-dod-tip': 'Le batterie LiFePO4 consentono DoD maggiori (50-80%) rispetto alle batterie AGM (30-50%) per la stessa vita utile.',
        'memorial-passo3-explicacao': 'Calcoliamo la capacità necessaria con due criteri e scegliamo il maggiore: uno per garantire la vita utile desiderata e l\'altro per garantire i giorni di autonomia senza sole.',
        'memorial-passo4-explicacao': 'Arrotondiamo per eccesso per garantire di avere capacità sufficiente. Per tensioni 24V e 48V, garantiamo un numero pari di batterie per facilitare il montaggio in serie/parallelo.',
        'memorial-passo5-explicacao': 'I pannelli devono generare energia sufficiente per ricaricare le batterie, considerando le perdite del sistema (cavo, MPPT, inverter). L\'efficienza del sistema dell\'80% considera tutte le perdite. Usiamo HSP (Ore di Sole Pieno) di 5 ore/giorno per stimare la generazione giornaliera, che rappresenta il numero medio di ore in cui la radiazione solare raggiunge 1000 W/m².',
        'memorial-passo6-explicacao': 'Nei sistemi off-grid, tutti gli inverter moderni includono già MPPT integrato. L\'inverter converte DC delle batterie in AC della casa e deve avere capacità per il consumo di picco tipico di una residenza. Il fattore di picco di 5x considera che il consumo non è costante durante il giorno. Inoltre, l\'inverter scelto deve avere capacità MPPT sufficiente per supportare la corrente massima dei pannelli.',
        'memorial-passo7-explicacao': 'Si verifica se l\'inverter scelto ha capacità MPPT integrata sufficiente per i pannelli. La corrente necessaria viene calcolata dividendo la potenza totale dei pannelli per la tensione del banco di batterie. Se l\'inverter iniziale non ha MPPT sufficiente, si sceglie un inverter più grande fino a trovarne uno con capacità adeguata. Questo garantisce che il sistema funzioni correttamente senza necessità di MPPT separato.',
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
        'memorial-formula-passo6-3': 'Potenza Minima dell\'Inverter (kW) = Massimo(Consumo di Picco, 1 kW minimo)',
        'memorial-formula-passo7-1': 'Potenza Totale dei Pannelli = Numero di Pannelli × Potenza per Pannello (W)',
        'memorial-formula-passo7-2': 'Corrente Massima Necessaria = Potenza Totale dei Pannelli ÷ Tensione del Banco (V)',
        'memorial-formula-passo7-3': 'Se Capacità MPPT dell\'Inverter < Corrente Massima Necessaria, aumenta potenza dell\'inverter fino a trovarne uno con MPPT adeguato',
        'memorial-formula-passo8-1': 'Costo Pannelli = Numero di Pannelli × Prezzo per Pannello',
        'memorial-formula-passo8-2': 'Costo Batterie = Numero di Batterie × Prezzo per Batteria',
        'memorial-formula-passo8-3': 'Costo Inverter = Prezzo dell\'Inverter con MPPT Integrato (dalla tabella dei prezzi)',
        'memorial-formula-passo8-4': 'Costo MPPT = 0 (già incluso nell\'inverter)',
        'memorial-formula-passo8-5': 'Costo Totale = Costo Pannelli + Costo Batterie + Costo Inverter',
        'graficos-title': '📊 Visualizzazioni',
        'grafico-amortizacao-title': 'Analisi di Ammortamento del Sistema',
        'grafico-sazonalidade-title': 'Stagionalità della Generazione Solare'
    }
};
// Controle para os botões de seta
let intervalId = null;
let timeoutId = null;
// FUNÇÃO: ATUALIZAR NOTAS DE VALORES PADRÃO
// Atualiza as notas de valores padrão abaixo dos sliders e ajusta os limites dos sliders
function atualizarNotasValoresPadrao() {
    const notaPrecoKWh = document.getElementById('notaPrecoKWh');
    const notaPrecoBateriaKWh = document.getElementById('notaPrecoBateriaKWh');
    
    if (notaPrecoKWh) {
        const chaveNota = idiomaAtual === 'pt-BR' ? 'nota-preco-kwh-pt' : 'nota-preco-kwh-it';
        notaPrecoKWh.textContent = traducoes[idiomaAtual]?.[chaveNota] || '';
    }
    
    if (notaPrecoBateriaKWh) {
        const chaveNota = idiomaAtual === 'pt-BR' ? 'nota-preco-bateria-kwh-pt' : 'nota-preco-bateria-kwh-it';
        notaPrecoBateriaKWh.textContent = traducoes[idiomaAtual]?.[chaveNota] || '';
    }
    
    // Atualizar slider de aumento anual do custo da energia
    const sliderAumentoAnualEnergia = document.getElementById('sliderAumentoAnualEnergia');
    const inputAumentoAnualEnergia = document.getElementById('inputAumentoAnualEnergia');
    const notaAumentoAnualEnergia = document.getElementById('notaAumentoAnualEnergia');
    
    if (sliderAumentoAnualEnergia) {
        const valorPadrao = AUMENTO_ANUAL_ENERGIA[idiomaAtual] || AUMENTO_ANUAL_ENERGIA['pt-BR'];
        // Limites: 1/5 e 5x do valor padrão
        const minValor = valorPadrao / 5;
        const maxValor = valorPadrao * 5;
        // Arredondar para múltiplos de 0.1 para manter o step consistente
        sliderAumentoAnualEnergia.min = (Math.floor(minValor / 0.1) * 0.1).toFixed(1);
        sliderAumentoAnualEnergia.max = (Math.ceil(maxValor / 0.1) * 0.1).toFixed(1);
        
        // Atualizar valor atual para o padrão do idioma
        sliderAumentoAnualEnergia.value = valorPadrao.toFixed(1);
        if (inputAumentoAnualEnergia) {
            inputAumentoAnualEnergia.value = formatarDecimalComVirgula(valorPadrao, 1);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAumentoAnualEnergia);
        }
    }
    
    if (notaAumentoAnualEnergia) {
        const chaveNota = idiomaAtual === 'pt-BR' ? 'nota-aumento-anual-energia-pt' : 'nota-aumento-anual-energia-it';
        notaAumentoAnualEnergia.textContent = traducoes[idiomaAtual]?.[chaveNota] || '';
    }
    
    // Atualizar limites do slider de preço kWh (1/20 e 4x do valor padrão)
    const sliderPrecoKWh = document.getElementById('sliderPrecoKWh');
    if (sliderPrecoKWh) {
        const valorPadrao = PRECO_KWH[idiomaAtual] || PRECO_KWH['pt-BR'];
        const minValor = valorPadrao / 20;
        const maxValor = valorPadrao * 4;
        // Arredondar para múltiplos de 0.05 para manter o step consistente
        sliderPrecoKWh.min = (Math.floor(minValor / 0.05) * 0.05).toFixed(2);
        sliderPrecoKWh.max = (Math.ceil(maxValor / 0.05) * 0.05).toFixed(2);
        
        // Ajustar valor atual se estiver fora dos novos limites
        const valorAtual = parseFloat(sliderPrecoKWh.value);
        if (valorAtual < parseFloat(sliderPrecoKWh.min)) {
            sliderPrecoKWh.value = sliderPrecoKWh.min;
            const inputPrecoKWh = document.getElementById('inputPrecoKWh');
            if (inputPrecoKWh) inputPrecoKWh.value = formatarDecimalComVirgula(parseFloat(sliderPrecoKWh.min), 2);
        } else if (valorAtual > parseFloat(sliderPrecoKWh.max)) {
            sliderPrecoKWh.value = sliderPrecoKWh.max;
            const inputPrecoKWh = document.getElementById('inputPrecoKWh');
            if (inputPrecoKWh) inputPrecoKWh.value = formatarDecimalComVirgula(parseFloat(sliderPrecoKWh.max), 2);
        }
    }
    
    // Atualizar limites do slider de preço bateria baseado no tipo de bateria selecionado
    const sliderPrecoBateriaKWh = document.getElementById('sliderPrecoBateriaKWh');
    if (sliderPrecoBateriaKWh) {
        // Obter tipo de bateria selecionado
        const tipoBateriaEl = document.querySelector('input[name="tipoBateria"]:checked');
        const tipoBateria = tipoBateriaEl ? tipoBateriaEl.value : 'litio';
        
        // Selecionar preço baseado no tipo de bateria
        const precosBateria = tipoBateria === 'chumbo' ? PRECO_BATERIA_KWH_CHUMBO : PRECO_BATERIA_KWH_LITIO;
        const valorPadrao = precosBateria[idiomaAtual] || precosBateria['pt-BR'];
        
        // Atualizar constante global para compatibilidade
        PRECO_BATERIA_KWH[idiomaAtual] = valorPadrao;
        
        // Mínimo: 1/100 do valor padrão, máximo: 4x do valor padrão
        const minValor = Math.round(valorPadrao / 100);
        const maxValor = Math.round(valorPadrao * 4);
        // Arredondar mínimo para múltiplos de 10 para manter consistência com o step
        sliderPrecoBateriaKWh.min = Math.floor(minValor / 10) * 10;
        // Máximo arredondado para múltiplos de 100 para manter o step consistente
        sliderPrecoBateriaKWh.max = Math.ceil(maxValor / 100) * 100;
        
        // Atualizar valor atual para o novo padrão do tipo de bateria
        sliderPrecoBateriaKWh.value = Math.round(valorPadrao);
        const inputPrecoBateriaKWh = document.getElementById('inputPrecoBateriaKWh');
        if (inputPrecoBateriaKWh) {
            inputPrecoBateriaKWh.value = Math.round(valorPadrao).toString();
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPrecoBateriaKWh);
        }
        
        // Atualizar nota de valor padrão
        const notaPrecoBateriaKWh = document.getElementById('notaPrecoBateriaKWh');
        if (notaPrecoBateriaKWh) {
            const tipoTexto = tipoBateria === 'chumbo' 
                ? (idiomaAtual === 'pt-BR' ? 'AGM' : 'AGM')
                : (idiomaAtual === 'pt-BR' ? 'LiFePO4' : 'LiFePO4');
            const mesAno = idiomaAtual === 'pt-BR' ? 'dez/2024' : 'dic/2024';
            const moeda = idiomaAtual === 'it-IT' ? '€' : 'R$';
            // Formatar faixa de preços baseado no tipo
            let faixaPreco = '';
            if (tipoBateria === 'chumbo') {
                faixaPreco = idiomaAtual === 'pt-BR' 
                    ? 'R$ 1.200-2.000' 
                    : '€ 400-700';
            } else {
                faixaPreco = idiomaAtual === 'pt-BR' 
                    ? 'R$ 2.500-3.500' 
                    : '€ 500-1.000';
            }
            notaPrecoBateriaKWh.textContent = idiomaAtual === 'pt-BR'
                ? `Valor padrão: ${moeda} ${valorPadrao.toLocaleString('pt-BR')}/kWh (faixa mercado ${tipoTexto}: ${faixaPreco}, ${mesAno})`
                : `Valore predefinito: ${moeda} ${valorPadrao.toLocaleString('it-IT')}/kWh (fascia mercato ${tipoTexto}: ${faixaPreco}, ${mesAno})`;
        }
    }
}
// FUNÇÃO: TROCAR IDIOMA
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

    // Atualizar notas de valores padrão e limites dos sliders primeiro
    atualizarNotasValoresPadrao();
    
    // Atualiza valor padrão do preço kWh quando o idioma muda
    const sliderPrecoKWh = document.getElementById('sliderPrecoKWh');
    const inputPrecoKWh = document.getElementById('inputPrecoKWh');
    const unidadePrecoKWh = document.getElementById('unidadePrecoKWh');
    if (sliderPrecoKWh && inputPrecoKWh) {
        const valorPadrao = PRECO_KWH[novoIdioma] || PRECO_KWH['pt-BR'];
        sliderPrecoKWh.value = valorPadrao.toFixed(2);
        inputPrecoKWh.value = formatarDecimalComVirgula(valorPadrao, 2);
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPrecoKWh);
    }
    if (unidadePrecoKWh) {
        unidadePrecoKWh.textContent = novoIdioma === 'it-IT' ? '€' : 'R$';
    }
    
    // Atualiza valor padrão do preço da bateria quando o idioma muda
    const sliderPrecoBateriaKWh = document.getElementById('sliderPrecoBateriaKWh');
    const inputPrecoBateriaKWh = document.getElementById('inputPrecoBateriaKWh');
    const unidadePrecoBateriaKWh = document.getElementById('unidadePrecoBateriaKWh');
    if (sliderPrecoBateriaKWh && inputPrecoBateriaKWh) {
        // Obter tipo de bateria selecionado
        const tipoBateriaEl = document.querySelector('input[name="tipoBateria"]:checked');
        const tipoBateria = tipoBateriaEl ? tipoBateriaEl.value : 'litio';
        
        // Selecionar preço baseado no tipo de bateria
        const precosBateria = tipoBateria === 'chumbo' ? PRECO_BATERIA_KWH_CHUMBO : PRECO_BATERIA_KWH_LITIO;
        const valorPadraoBateria = precosBateria[novoIdioma] || precosBateria['pt-BR'];
        
        // Atualizar constante global para compatibilidade
        PRECO_BATERIA_KWH[novoIdioma] = valorPadraoBateria;
        
        sliderPrecoBateriaKWh.value = Math.round(valorPadraoBateria).toString();
        inputPrecoBateriaKWh.value = Math.round(valorPadraoBateria).toString();
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPrecoBateriaKWh);
    }
    if (unidadePrecoBateriaKWh) {
        unidadePrecoBateriaKWh.textContent = novoIdioma === 'it-IT' ? '€' : 'R$';
    }

    atualizarInterface();

    // Atualiza fórmulas do memorial
    atualizarFormulasMemorial(novoIdioma);

    // Atualiza aria-label do botão home
    const homeLabel = traducoes[novoIdioma]?.['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
} // DoD (Depth of Discharge
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
        for (let i = 0; i < dados.length - 1; i++) {
        const p1 = dados[i];     // Ponto com mais ciclos (menor DoD)
        const p2 = dados[i+1];   // Ponto com menos ciclos (maior DoD) // número de ciclos está dentro deste intervalo
                if (ciclos <= p1.c && ciclos >= p2.c) { // razão (0 a 1) de onde o número de ciclos está no intervalo
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
// FUNÇÃO: CALCULAR CICLOS POR DoD (inversa)
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
// FUNÇÃO: AJUSTAR VALORES (Botões de Seta)
// Os botões +/- da interface chamam esta função para aumentar ou diminuir
// um valor ligado a um ID de slider/text input. Aqui aplicamos limites,
// arredondamento e atualizamos a interface para refletir a mudança.
function ajustarValor(targetId, step) {
    const slider = document.getElementById(targetId);
    if (!slider) {
        console.error(`Slider não encontrado: ${targetId}`);
        return;
    }
    
    // Usa 0 como mínimo se slider.min for 0 (importante para sliders que começam em 0)
    const minRaw = parseFloat(slider.min);
    const min = isNaN(minRaw) ? 0 : minRaw; // Permite 0 como mínimo válido
    const max = parseFloat(slider.max) || 100;
    const stepAttr = parseFloat(slider.step) || 1;
    
    let valor = parseFloat(slider.value);
    if (isNaN(valor)) valor = min;
    
    valor += step;
    
    // Arredonda baseado no tipo de slider
    // Consumo e Autonomia: valores inteiros
    // Vida Útil: pode ter decimais (arredondamos para uma casa decimal)
    // Preço kWh: arredonda para múltiplos do step (0.05)
    if (targetId === 'sliderConsumo' || targetId === 'sliderAutonomia') {
        valor = Math.round(valor);
    } else if (targetId === 'sliderVidaUtil') {
        // Para vida útil, arredonda para inteiro se o step for inteiro
        valor = Math.round(valor);
    } else if (targetId === 'sliderPrecoKWh') {
        // Para preço kWh, arredonda para múltiplos do step (0.05)
        valor = Math.round(valor / stepAttr) * stepAttr;
        // Garante precisão de 2 casas decimais
        valor = Math.round(valor * 100) / 100;
    } else if (targetId === 'sliderPeriodoAnalise') {
        // Para período de análise, arredonda para inteiro
        valor = Math.round(valor);
    } else {
        // Para outros sliders, uma casa decimal
        valor = Math.round(valor * 10) / 10;
    }
    
    // Garante que o valor fique dentro dos limites
    valor = Math.max(min, Math.min(max, valor));
    
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
    } else if (targetId === 'sliderPrecoKWh') {
        // Para slider de preço kWh, atualiza o input correspondente
        const inputPrecoKWh = document.getElementById('inputPrecoKWh');
        if (inputPrecoKWh) {
            inputPrecoKWh.value = formatarDecimalComVirgula(valor, 2);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPrecoKWh);
        }
        // Dispara evento input para atualizar a interface
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (targetId === 'sliderAumentoAnualEnergia') {
        // Para slider de aumento anual, atualiza o input correspondente
        const inputAumentoAnualEnergia = document.getElementById('inputAumentoAnualEnergia');
        if (inputAumentoAnualEnergia) {
            inputAumentoAnualEnergia.value = formatarDecimalComVirgula(valor, 1);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAumentoAnualEnergia);
        }
        // Dispara evento input para atualizar a interface
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (targetId === 'sliderPeriodoAnalise') {
        // Para slider de período de análise, atualiza o input correspondente
        const inputPeriodoAnalise = document.getElementById('inputPeriodoAnalise');
        if (inputPeriodoAnalise) {
            inputPeriodoAnalise.value = Math.round(valor).toString();
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPeriodoAnalise);
        }
        // Dispara evento input para atualizar a interface
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Dispara o evento 'input' no slider para acionar os event listeners
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Atualiza a interface
    atualizarInterface();
}
// FUNÇÃO: ATUALIZAR INTERFACE (UI)
// Coleta estado atual dos controles (sliders e rádios) e atualiza todos
// os textos da tela. Calcula o DoD alvo com base na vida útil pedida e
// invoca a função principal de cálculo (calcularSistema) passando o
// DoD convertido para fração.
// Além disso, garante limites corretos para sliders e corrige valores
// fora dos limites (por exemplo, vida útil máx/mín).
function atualizarInterface() {
    try {
    // 1. Ler valores dos inputs editáveis ou sliders (inputs têm prioridade)
    const sliderConsumo = document.getElementById('sliderConsumo');
    const sliderAutonomia = document.getElementById('sliderAutonomia');
    const sliderVidaUtil = document.getElementById('sliderVidaUtil');
    const inputConsumo = document.getElementById('inputConsumo');
    const inputAutonomia = document.getElementById('inputAutonomia');
    const inputVidaUtil = document.getElementById('inputVidaUtil');
    const tipoBateriaEl = document.querySelector('input[name="tipoBateria"]:checked');
    const tipoBateria = tipoBateriaEl ? tipoBateriaEl.value : 'litio';
    
    // Validação: garante que os elementos existam
    if (!sliderConsumo || !sliderAutonomia || !sliderVidaUtil) {
        console.error('[Solar] Elementos de slider não encontrados');
        return;
    }
    
    // Obtém valores dos inputs ou sliders (inputs têm prioridade se existirem)
    // Usa valores padrão se não conseguir ler dos elementos
    let consumo = inputConsumo ? (parseInt(inputConsumo.value) || parseInt(sliderConsumo.value) || 200) : (parseInt(sliderConsumo.value) || 200);
    let autonomia = inputAutonomia ? (parseInt(inputAutonomia.value) || parseInt(sliderAutonomia.value) || 1) : (parseInt(sliderAutonomia.value) || 1);
    
    // Validação: garante que os valores sejam números válidos
    if (isNaN(consumo) || consumo <= 0) consumo = 200;
    if (isNaN(autonomia) || autonomia <= 0) autonomia = 1;
    
    // 2. Ajustar limites do slider de Vida Útil baseado no tipo de bateria
    if (tipoBateria === 'litio') {
        sliderVidaUtil.min = "5";
        sliderVidaUtil.max = "25";
    } else {
        sliderVidaUtil.min = "1";
        sliderVidaUtil.max = "5";
    }
    
    // 3. Corrigir valor se estiver fora dos limites (apenas para o slider, não para o input)
    let vidaUtil = inputVidaUtil ? (parseFloat(inputVidaUtil.value) || parseFloat(sliderVidaUtil.value) || 20) : (parseFloat(sliderVidaUtil.value) || 20);
    const minVida = parseFloat(sliderVidaUtil.min) || (tipoBateria === 'litio' ? 5 : 1);
    const maxVida = parseFloat(sliderVidaUtil.max) || (tipoBateria === 'litio' ? 25 : 5);
    
    // Validação: garante que vidaUtil seja um número válido
    if (isNaN(vidaUtil) || vidaUtil <= 0) {
        vidaUtil = tipoBateria === 'litio' ? 20 : 3;
    }
    
    // Limita vidaUtil aos limites do slider
    vidaUtil = Math.max(minVida, Math.min(maxVida, vidaUtil));
    
    // Ajusta o slider apenas se o valor estiver dentro dos limites
    if (vidaUtil >= minVida && vidaUtil <= maxVida) {
        sliderVidaUtil.value = vidaUtil;
    }

    // 4. Atualizar displays de valor (inputs editáveis)
    if (inputConsumo) {
        inputConsumo.value = consumo;
        if (typeof ajustarTamanhoInput === 'function') {
            // Usa mais folga para valores maiores (até 999)
            const folga = consumo >= 100 ? 4 : 3;
            ajustarTamanhoInput(inputConsumo, folga);
        }
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
    
    // Validação: garante que dodAlvo seja válido
    if (isNaN(dodAlvo) || dodAlvo <= 0) {
        dodAlvo = tipoBateria === 'litio' ? 50 : 30; // Valores padrão em percentual
    }

    // Mostra a porcentagem de descarga diária calculada
    const dodExibicao = Math.round(dodAlvo);
    const textoNota = idiomaAtual === 'pt-BR' ? 'DoD Diário' : 'DoD Giornaliero';
    const descVidaUtilEl = document.getElementById('descVidaUtil');
    if (descVidaUtilEl) {
        descVidaUtilEl.textContent = `${textoNota}: ${dodExibicao}%`;
    }

    // Chama a função principal de cálculo
    calcularSistema(dodAlvo / 100);
    } catch (error) {
        console.error('[Solar] Erro em atualizarInterface:', error);
        console.error('[Solar] Stack trace:', error.stack);
    }
}
// VARIÁVEIS GLOBAIS PARA OS GRÁFICOS
let graficoAmortizacao = null;
let graficoSazonalidade = null;
// PREÇOS MÉDIOS DE ENERGIA ELÉTRICA (2024-2025)
// Valores baseados em pesquisas de mercado atualizadas
const PRECO_KWH = {
    'pt-BR': 0.75,  // R$/kWh - Média Brasil (ANEEL 2024-2025)
    'it-IT': 0.30   // €/kWh - Média Itália (ARERA 2024-2025)
};
// AUMENTO ANUAL DO CUSTO DA ENERGIA (%)
// Valores baseados no histórico dos últimos 50 anos:
// Brasil: ~8% ao ano (média entre 2000-2024: aumento de 1.299% em 24 anos ≈ 11.3%/ano, 
//         2010-2024: aumento de 177% em 15 anos ≈ 7%/ano, média conservadora: 8%)
// Itália: ~6% ao ano (histórico similar, mas geralmente um pouco menor que Brasil)
const AUMENTO_ANUAL_ENERGIA = {
    'pt-BR': 8.0,   // % ao ano (Brasil)
    'it-IT': 6.0    // % ao ano (Itália)
};
// Valores padrão de preço da bateria por kWh
// Preços de baterias LiFePO4 (Lítio)
// Baseado em pesquisa de mercado: Brasil R$ 2.500-3.500, Itália € 500-1.000
const PRECO_BATERIA_KWH_LITIO = {
    'pt-BR': 3000,  // R$/kWh - Média mercado LiFePO4 (R$ 2.500-3.500, média R$ 3.000)
    'it-IT': 750    // €/kWh - Média mercado LiFePO4 (€ 500-1.000, média € 750)
};
// Preços de baterias de Chumbo-Ácido AGM
// Baseado em pesquisa de mercado: Brasil R$ 1.200-2.000, Itália € 400-700
const PRECO_BATERIA_KWH_CHUMBO = {
    'pt-BR': 1600,  // R$/kWh - Média mercado AGM (R$ 1.200-2.000, média R$ 1.600)
    'it-IT': 550    // €/kWh - Média mercado AGM (€ 400-700, média € 550)
};
// Mantido para compatibilidade - será atualizado dinamicamente baseado no tipo de bateria
const PRECO_BATERIA_KWH = {
    'pt-BR': 3000,  // R$/kWh - Média mercado LiFePO4 (dez/2024) - padrão inicial
    'it-IT': 750    // €/kWh - Média mercado LiFePO4 (dez/2024) - padrão inicial
};
// FUNÇÕES DE ATUALIZAÇÃO DOS GRÁFICOS
// Atualiza todos os gráficos do sistema solar
function atualizarGraficosSolar(dados) {
    if (!dados) {
        console.warn('[Solar] Dados não fornecidos para atualizar gráficos');
        return;
    }
    
    // Carrega Chart.js dinamicamente se ainda não estiver carregado
    if (typeof Chart === 'undefined') {
        if (typeof carregarChartJS === 'function') {
            carregarChartJS(() => {
                atualizarGraficosSolar(dados);
            }).catch(err => {
                console.error('[Solar] Erro ao carregar Chart.js:', err);
            });
        } else {
            console.warn('[Solar] Função carregarChartJS não disponível');
        }
        return;
    }
    
    // Atualiza cada gráfico com tratamento de erro individual
    try {
        atualizarGraficoAmortizacao(dados);
    } catch (error) {
        console.error('[Solar] Erro ao atualizar gráfico de amortização:', error);
    }
    
    try {
        atualizarGraficoSazonalidade(dados);
    } catch (error) {
        console.error('[Solar] Erro ao atualizar gráfico de sazonalidade:', error);
    }
}
// Gráfico de amortização: Análise de retorno do investimento ao longo do tempo
function atualizarGraficoAmortizacao(dados) {
    const ctx = document.getElementById('graficoAmortizacao');
    if (!ctx) {
        console.warn('[Solar] Canvas graficoAmortizacao não encontrado');
        return;
    }
    
    // Validar dados necessários
    if (!dados) {
        console.warn('[Solar] Dados não fornecidos para gráfico de amortização');
        return;
    }
    
    const { 
        custoTotal = 0, 
        consumoMensal = 0,
        custoBaterias = 0,
        vidaUtil = 20,
        tipoBateria = 'litio'
    } = dados;
    
    // Validar valores numéricos
    if (typeof custoTotal !== 'number' || typeof consumoMensal !== 'number' || custoTotal <= 0 || consumoMensal <= 0) {
        console.warn('[Solar] Valores inválidos para gráfico de amortização:', dados);
        return;
    }
    
    // Destruir gráfico anterior se existir
    if (graficoAmortizacao) {
        graficoAmortizacao.destroy();
    }
    
    // Obter preço do kWh do slider (ou valor padrão se não disponível)
    const sliderPrecoKWh = document.getElementById('sliderPrecoKWh');
    const inputPrecoKWh = document.getElementById('inputPrecoKWh');
    let precoKWh;
    if (sliderPrecoKWh && inputPrecoKWh) {
        // Usar valor do input se disponível ou usar do slider
        // Aceita tanto vírgula quanto ponto como separador decimal
        const valorInput = converterVirgulaParaNumero(inputPrecoKWh.value);
        const valorSlider = parseFloat(sliderPrecoKWh.value);
        precoKWh = !isNaN(valorInput) && valorInput > 0 ? valorInput : (!isNaN(valorSlider) && valorSlider > 0 ? valorSlider : (PRECO_KWH[idiomaAtual] || PRECO_KWH['pt-BR']));
    } else {
        // Fallback para valor padrão se elementos não existirem
        precoKWh = PRECO_KWH[idiomaAtual] || PRECO_KWH['pt-BR'];
    }
    const moeda = idiomaAtual === 'it-IT' ? '€' : 'R$';
    
    // Calcular economia mensal (assumindo que o sistema gera 100% do consumo)
    const economiaMensal = consumoMensal * precoKWh;
    
    // Obter aumento anual do custo da energia do slider ou usar valor padrão
    const sliderAumentoAnual = document.getElementById('sliderAumentoAnualEnergia');
    const aumentoAnualPercentual = sliderAumentoAnual ? (parseFloat(sliderAumentoAnual.value) || AUMENTO_ANUAL_ENERGIA[idiomaAtual] || AUMENTO_ANUAL_ENERGIA['pt-BR']) : (AUMENTO_ANUAL_ENERGIA[idiomaAtual] || AUMENTO_ANUAL_ENERGIA['pt-BR']);
    const fatorAumentoAnual = 1 + (aumentoAnualPercentual / 100);
    
    // Obter período de análise do slider ou usar valor padrão baseado na vida útil máxima da bateria
    const sliderPeriodoAnalise = document.getElementById('sliderPeriodoAnalise');
    const tipoBateriaEl = document.querySelector('input[name="tipoBateria"]:checked');
    const tipoBateriaAtual = tipoBateriaEl ? tipoBateriaEl.value : 'litio';
    const vidaUtilMaxima = tipoBateriaAtual === 'litio' ? 25 : 5;
    
    let anosAnalise = vidaUtilMaxima; // Valor padrão: 1x vida útil máxima
    
    if (sliderPeriodoAnalise) {
        // Atualizar limites do slider baseado no tipo de bateria
        // Min: 1x vida útil máxima, Max: 4x vida útil máxima
        sliderPeriodoAnalise.min = vidaUtilMaxima.toString();
        sliderPeriodoAnalise.max = (vidaUtilMaxima * 4).toString();
        
        // Obter valor do slider
        anosAnalise = parseInt(sliderPeriodoAnalise.value) || vidaUtilMaxima;
        
        // Garantir que o valor está dentro dos limites
        const minPeriodo = vidaUtilMaxima;
        const maxPeriodo = vidaUtilMaxima * 4;
        anosAnalise = Math.max(minPeriodo, Math.min(maxPeriodo, anosAnalise));
        
        // Atualizar slider e input se necessário
        sliderPeriodoAnalise.value = anosAnalise.toString();
        const inputPeriodoAnalise = document.getElementById('inputPeriodoAnalise');
        if (inputPeriodoAnalise) {
            inputPeriodoAnalise.value = anosAnalise.toString();
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPeriodoAnalise);
        }
    }
    
    const mesesAnalise = anosAnalise * 12;
    const substituicoesBaterias = [];
    
    if (vidaUtil > 0 && vidaUtil < anosAnalise && custoBaterias > 0) {
        // Calcular quantas vezes as baterias precisam ser substituídas no período de análise
        // Exemplo: vidaUtil = 5 anos, anosAnalise = 20 → substituições aos 5, 10, 15 anos (3 vezes)
        let anoSubstituicao = vidaUtil;
        while (anoSubstituicao < anosAnalise) {
            // Não substituir baterias nos anos de substituição completa do sistema (aos 25, 50, 75 anos)
            // pois já estão incluídas na substituição completa
            if (anoSubstituicao % 25 !== 0) {
            substituicoesBaterias.push({
                ano: anoSubstituicao,
                mes: Math.round(anoSubstituicao * 12)
            });
            }
            anoSubstituicao += vidaUtil;
        }
    }
    
    // Calcular substituições completas do sistema a cada 25 anos
    // Inclui: placas solares, inversor, baterias, cabos, etc. (custo total do sistema)
    const substituicoesSistemaCompleto = [];
    const intervaloSubstituicaoCompleta = 25; // Anos
    let anoSubstituicaoCompleta = intervaloSubstituicaoCompleta;
    while (anoSubstituicaoCompleta <= anosAnalise) {
        substituicoesSistemaCompleto.push({
            ano: anoSubstituicaoCompleta,
            mes: Math.round(anoSubstituicaoCompleta * 12)
        });
        anoSubstituicaoCompleta += intervaloSubstituicaoCompleta;
    }
    
    // Calcular período de payback inicial (sem considerar substituições)
    // Considera aumento anual do custo da energia
    // Usa aproximação: payback ocorre quando economia acumulada = custo total
    // Como a economia aumenta anualmente, precisamos calcular iterativamente
    let paybackMeses = null;
    let economiaAcumuladaPayback = 0;
    for (let mes = 0; mes <= mesesAnalise; mes++) {
        const anoAtual = Math.floor(mes / 12);
        const economiaMensalAtual = economiaMensal * Math.pow(fatorAumentoAnual, anoAtual);
        economiaAcumuladaPayback += economiaMensalAtual;
        if (economiaAcumuladaPayback >= custoTotal && paybackMeses === null) {
            paybackMeses = mes;
            break;
        }
    }
    // Fallback: se não encontrou payback em 25 anos, usa cálculo simples
    if (paybackMeses === null) {
        paybackMeses = Math.ceil(custoTotal / economiaMensal);
    }
    
    // Criar arrays de dados
    const labels = [];
    const investimentoInicial = [];
    const economiaAcumulada = [];
    const custoSubstituicoesBaterias = [];
    const custoSubstituicoesSistemaCompleto = [];
    const lucroPrejuizoLiquido = [];  // Uma única série que muda de cor dinamicamente
    
    // Criar pontos de dados a cada 6 meses para melhor legibilidade
    const intervaloMeses = 6;
    
    // Definir os anos que queremos mostrar no eixo X dinamicamente baseado no período de análise
    // Mostra marcas a cada 5 anos até o período máximo
    const anosParaMostrar = [];
    for (let ano = 0; ano <= anosAnalise; ano += 5) {
        anosParaMostrar.push(ano);
    }
    // Garantir que o último ano (período de análise) seja sempre mostrado
    if (!anosParaMostrar.includes(anosAnalise)) {
        anosParaMostrar.push(anosAnalise);
        anosParaMostrar.sort((a, b) => a - b);
    }
    
    for (let mes = 0; mes <= mesesAnalise; mes += intervaloMeses) {
        const ano = Math.floor(mes / 12);
        const mesNoAno = mes % 12;
        
        // Criar labels apenas para os anos especificados dinamicamente baseado no período de análise
        // Verificar se estamos em um dos anos desejados e no início do ano (mês 0 ou próximo)
        if (anosParaMostrar.includes(ano) && mesNoAno < intervaloMeses) {
            if (ano === 0) {
            labels.push('0');
            } else {
            labels.push(`${ano}${idiomaAtual === 'pt-BR' ? 'a' : 'a'}`);
            }
        } else {
            labels.push(''); // Label vazio para pontos intermediários
        }
        
        // Calcular custo acumulado de substituições de baterias até este mês
        let custoTotalSubstituicoesBateriasAteMes = 0;
        for (const subst of substituicoesBaterias) {
            if (mes >= subst.mes) {
                custoTotalSubstituicoesBateriasAteMes += custoBaterias;
            }
        }
        
        // Calcular custo acumulado de substituições completas do sistema até este mês
        let custoTotalSubstituicoesSistemaAteMes = 0;
        for (const subst of substituicoesSistemaCompleto) {
            if (mes >= subst.mes) {
                custoTotalSubstituicoesSistemaAteMes += custoTotal;
            }
        }
        
        investimentoInicial.push(-custoTotal); // Negativo para mostrar como investimento
        
        // Calcular economia acumulada considerando aumento anual do custo da energia
        // Usa o fatorAumentoAnual já calculado anteriormente (linha 1257)
        // Calcular economia acumulada considerando aumento anual
        let economiaAcumuladaTotal = 0;
        for (let m = 0; m < mes; m++) {
            const anoAtual = Math.floor(m / 12);
            // A economia mensal aumenta a cada ano conforme o aumento anual
            const economiaMensalAtual = economiaMensal * Math.pow(fatorAumentoAnual, anoAtual);
            economiaAcumuladaTotal += economiaMensalAtual;
        }
        economiaAcumulada.push(economiaAcumuladaTotal);
        custoSubstituicoesBaterias.push(-custoTotalSubstituicoesBateriasAteMes); // Negativo para mostrar como custo adicional
        custoSubstituicoesSistemaCompleto.push(-custoTotalSubstituicoesSistemaAteMes); // Negativo para mostrar como custo adicional
        
        // Lucro/Prejuízo = economia acumulada - investimento inicial - custo de substituições de baterias - custo de substituições completas do sistema
        const custoTotalSubstituicoesAteMes = custoTotalSubstituicoesBateriasAteMes + custoTotalSubstituicoesSistemaAteMes;
        const lucroPrejuizo = economiaAcumuladaTotal - custoTotal - custoTotalSubstituicoesAteMes;
        // Uma única série com todos os valores (positivos e negativos)
        lucroPrejuizoLiquido.push(lucroPrejuizo);
    }
    
    // Encontrar o ponto de payback (quando lucro líquido >= 0)
    const paybackIndex = lucroPrejuizoLiquido.findIndex(lucro => lucro >= 0);
    
    graficoAmortizacao = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: idiomaAtual === 'pt-BR' ? 'Investimento Inicial' : 'Investimento Iniziale',
                    data: investimentoInicial,
                    borderColor: 'rgba(244, 67, 54, 1)',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: idiomaAtual === 'pt-BR' ? 'Economia Acumulada' : 'Risparmio Accumulato',
                    data: economiaAcumulada,
                    borderColor: 'rgba(76, 175, 80, 1)',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 4
                },
                {
                    label: idiomaAtual === 'pt-BR' ? 'Custo Substituições Baterias' : 'Costo Sostituzioni Batterie',
                    data: custoSubstituicoesBaterias,
                    borderColor: 'rgba(255, 152, 0, 1)',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    borderWidth: 2,
                    borderDash: [3, 3],
                    fill: false,
                    pointRadius: 0,
                    hidden: substituicoesBaterias.length === 0 // Ocultar se não houver substituições
                },
                {
                    label: idiomaAtual === 'pt-BR' ? 'Custo Substituições Sistema Completo' : 'Costo Sostituzioni Sistema Completo',
                    data: custoSubstituicoesSistemaCompleto,
                    borderColor: 'rgba(156, 39, 176, 1)',
                    backgroundColor: 'rgba(156, 39, 176, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    hidden: substituicoesSistemaCompleto.length === 0 // Ocultar se não houver substituições
                },
                {
                    label: idiomaAtual === 'pt-BR' ? 'Prejuízo Líquido' : 'Perdita Netta',
                    data: lucroPrejuizoLiquido.map(v => v < 0 ? v : null),
                    borderColor: 'rgba(244, 67, 54, 1)',
                    backgroundColor: 'rgba(244, 67, 54, 0.2)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    spanGaps: false
                },
                {
                    label: idiomaAtual === 'pt-BR' ? 'Lucro Líquido' : 'Profitto Netto',
                    data: lucroPrejuizoLiquido.map(v => v >= 0 ? v : null),
                    borderColor: 'rgba(25, 118, 210, 1)',
                    backgroundColor: 'rgba(25, 118, 210, 0.2)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    spanGaps: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Desabilitar animações para atualização instantânea
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { size: 12, weight: 'bold' },
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const valor = context.parsed.y; // Se valor for null, não mostrar no tooltip
                            if (valor === null) return null;
                            const prefixo = valor < 0 ? '-' : '';
                            const valorFormatado = Math.abs(valor).toLocaleString(idiomaAtual, {minimumFractionDigits: 0, maximumFractionDigits: 0});
                            return `${context.dataset.label}: ${prefixo}${moeda} ${valorFormatado}`;
                        },
                        filter: function(tooltipItem) {
                            // Filtrar valores null do tooltip
                            return tooltipItem.parsed.y !== null;
                        },
                        footer: function(tooltipItems) {
                            if (paybackIndex >= 0 && tooltipItems[0].dataIndex === paybackIndex) {
                                const anosPaybackTooltip = Math.floor(paybackMeses / 12);
                                const mesesPaybackTooltip = paybackMeses % 12;
                                
                                // Formatar apenas em anos e meses (sem mostrar meses totais)
                                if (idiomaAtual === 'pt-BR') {
                                    if (anosPaybackTooltip > 0 && mesesPaybackTooltip > 0) {
                                        return `✓ Payback: ${anosPaybackTooltip} ano${anosPaybackTooltip > 1 ? 's' : ''} e ${mesesPaybackTooltip} mês${mesesPaybackTooltip > 1 ? 'es' : ''}`;
                                    } else if (anosPaybackTooltip > 0) {
                                        return `✓ Payback: ${anosPaybackTooltip} ano${anosPaybackTooltip > 1 ? 's' : ''}`;
                                    } else {
                                        return `✓ Payback: ${mesesPaybackTooltip} mês${mesesPaybackTooltip > 1 ? 'es' : ''}`;
                                    }
                                } else {
                                    if (anosPaybackTooltip > 0 && mesesPaybackTooltip > 0) {
                                        return `✓ Payback: ${anosPaybackTooltip} anno${anosPaybackTooltip > 1 ? 'i' : ''} e ${mesesPaybackTooltip} mese${mesesPaybackTooltip > 1 ? 'i' : ''}`;
                                    } else if (anosPaybackTooltip > 0) {
                                        return `✓ Payback: ${anosPaybackTooltip} anno${anosPaybackTooltip > 1 ? 'i' : ''}`;
                                    } else {
                                        return `✓ Payback: ${mesesPaybackTooltip} mese${mesesPaybackTooltip > 1 ? 'i' : ''}`;
                                    }
                                }
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: idiomaAtual === 'pt-BR' ? 'Tempo (anos)' : 'Tempo (anni)',
                        font: { size: 12, weight: 'bold' }
                    },
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        callback: function(value, index) {
                            // Usar diretamente o array de labels criado anteriormente
                            // Mostrar apenas labels não vazios (dinamicamente baseado no período de análise)
                            if (index >= 0 && index < labels.length) {
                                const label = labels[index];
                                if (label && label.trim() !== '') {
                                    return label;
                                }
                            }
                            return '';
                        },
                        maxTicksLimit: anosParaMostrar.length, // Labels dinâmicos baseados no período de análise
                        autoSkip: false, // Não pular labels automaticamente - queremos mostrar todos os labels não vazios
                        includeBounds: true // Incluir os limites (0 e período de análise)
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: idiomaAtual === 'pt-BR' ? `Valor (${moeda})` : `Valore (${moeda})`,
                        font: { size: 12, weight: 'bold' }
                    },
                    ticks: {
                        callback: function(value) {
                            return `${moeda} ${value.toLocaleString(idiomaAtual, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
                        }
                    }
                }
            }
        }
    });
    
    // Calcular custo total de substituições no período de análise
    const custoTotalSubstituicoesBateriasPeriodo = substituicoesBaterias.length * custoBaterias;
    const custoTotalSubstituicoesSistemaPeriodo = substituicoesSistemaCompleto.length * custoTotal;
    const custoTotalSubstituicoesPeriodo = custoTotalSubstituicoesBateriasPeriodo + custoTotalSubstituicoesSistemaPeriodo;
    
    // Recalcular payback considerando substituições (quando lucro líquido >= 0)
    // Considera aumento anual do custo da energia
    let paybackMesesComSubstituicoes = null;
    let economiaAcumuladaPaybackSubst = 0;
    for (let mes = 0; mes <= mesesAnalise; mes++) {
        const anoAtual = Math.floor(mes / 12);
        const economiaMensalAtual = economiaMensal * Math.pow(fatorAumentoAnual, anoAtual);
        economiaAcumuladaPaybackSubst += economiaMensalAtual;
        
        // Calcular custo de substituições de baterias até este mês
        let custoSubstBateriasAteMes = 0;
        for (const subst of substituicoesBaterias) {
            if (mes >= subst.mes) {
                custoSubstBateriasAteMes += custoBaterias;
            }
        }
        
        // Calcular custo de substituições completas do sistema até este mês
        let custoSubstSistemaAteMes = 0;
        for (const subst of substituicoesSistemaCompleto) {
            if (mes >= subst.mes) {
                custoSubstSistemaAteMes += custoTotal;
            }
        }
        
        const custoSubstAteMes = custoSubstBateriasAteMes + custoSubstSistemaAteMes;
        const lucroAteMes = economiaAcumuladaPaybackSubst - custoTotal - custoSubstAteMes;
        if (lucroAteMes >= 0 && paybackMesesComSubstituicoes === null) {
            paybackMesesComSubstituicoes = mes;
            break;
        }
    }
    
    // Atualizar informação de payback abaixo do gráfico
    const infoPaybackEl = document.getElementById('infoPayback');
    if (infoPaybackEl) {
        const anosPayback = Math.floor(paybackMeses / 12);
        const mesesPayback = paybackMeses % 12;
        
        // Calcular anos e meses para payback com substituições
        let anosPaybackComSubstituicoes = null;
        let mesesPaybackComSubstituicoes = null;
        if (paybackMesesComSubstituicoes && paybackMesesComSubstituicoes !== paybackMeses) {
            anosPaybackComSubstituicoes = Math.floor(paybackMesesComSubstituicoes / 12);
            mesesPaybackComSubstituicoes = paybackMesesComSubstituicoes % 12;
        }
        
        // Calcular economia anual e total no período de análise considerando aumento anual
        // Economia no primeiro ano (sem aumento ainda)
        const economiaAnual = economiaMensal * 12;
        // Economia total no período de análise com aumento anual: soma de série geométrica
        // Soma = a * (r^n - 1) / (r - 1), onde a = economiaAnual, r = fatorAumentoAnual, n = anosAnalise
        let economiaTotalPeriodo = 0;
        if (Math.abs(fatorAumentoAnual - 1) < 0.0001) {
            // Se aumento é zero (fator = 1), economia constante
            economiaTotalPeriodo = economiaAnual * anosAnalise;
        } else {
            // Série geométrica: economiaAnual * (fatorAumentoAnual^anosAnalise - 1) / (fatorAumentoAnual - 1)
            economiaTotalPeriodo = economiaAnual * (Math.pow(fatorAumentoAnual, anosAnalise) - 1) / (fatorAumentoAnual - 1);
        }
        const lucroTotalPeriodo = economiaTotalPeriodo - custoTotal - custoTotalSubstituicoesPeriodo;
        const isPrejuizo = lucroTotalPeriodo < 0;
        const labelLucroPrejuizo = isPrejuizo 
            ? (idiomaAtual === 'pt-BR' ? 'Prejuízo líquido' : 'Perdita netta')
            : (idiomaAtual === 'pt-BR' ? 'Lucro líquido' : 'Profitto netto');
        const corLucroPrejuizo = isPrejuizo ? '#F44336' : '#4CAF50';
        
        if (idiomaAtual === 'pt-BR') {
            let infoSubstituicoes = '';
            if (substituicoesBaterias.length > 0 || substituicoesSistemaCompleto.length > 0) {
                const partesInfo = [];
                
            if (substituicoesBaterias.length > 0) {
                    const anosSubstBaterias = substituicoesBaterias.map(s => s.ano).join(', ');
                    partesInfo.push(`<span style="color: #FF9800;">🔋 Substituições de baterias (vida útil: ${vidaUtil} anos): <strong>${substituicoesBaterias.length} vez${substituicoesBaterias.length > 1 ? 'es' : ''}</strong> aos ${anosSubstBaterias} ano${substituicoesBaterias.length > 1 ? 's' : ''} | Custo total: <strong>${formatarMoedaComVirgula(custoTotalSubstituicoesBateriasPeriodo, moeda, 2)}</strong></span>`);
                }
                
                if (substituicoesSistemaCompleto.length > 0) {
                    const anosSubstSistema = substituicoesSistemaCompleto.map(s => s.ano).join(', ');
                    partesInfo.push(`<span style="color: #9C27B0;">⚙️ Substituições completas do sistema (a cada 25 anos): <strong>${substituicoesSistemaCompleto.length} vez${substituicoesSistemaCompleto.length > 1 ? 'es' : ''}</strong> aos ${anosSubstSistema} ano${substituicoesSistemaCompleto.length > 1 ? 's' : ''} | Custo total: <strong>${formatarMoedaComVirgula(custoTotalSubstituicoesSistemaPeriodo, moeda, 2)}</strong></span>`);
                }
                
                if (partesInfo.length > 0) {
                    infoSubstituicoes = '<br>' + partesInfo.join('<br>');
                }
            }
            
            // Formatar texto de payback inicial
            let textoPaybackInicial = '';
            if (anosPayback > 0 && mesesPayback > 0) {
                textoPaybackInicial = `${anosPayback} ano${anosPayback > 1 ? 's' : ''} e ${mesesPayback} mês${mesesPayback > 1 ? 'es' : ''}`;
            } else if (anosPayback > 0) {
                textoPaybackInicial = `${anosPayback} ano${anosPayback > 1 ? 's' : ''}`;
            } else {
                textoPaybackInicial = `${mesesPayback} mês${mesesPayback > 1 ? 'es' : ''}`;
            }
            
            // Formatar texto de payback com substituições
            let textoPaybackComSubstituicoes = '';
            if (anosPaybackComSubstituicoes !== null && mesesPaybackComSubstituicoes !== null) {
                if (anosPaybackComSubstituicoes > 0 && mesesPaybackComSubstituicoes > 0) {
                    textoPaybackComSubstituicoes = ` | Payback com substituições: <strong>${anosPaybackComSubstituicoes} ano${anosPaybackComSubstituicoes > 1 ? 's' : ''} e ${mesesPaybackComSubstituicoes} mês${mesesPaybackComSubstituicoes > 1 ? 'es' : ''}</strong>`;
                } else if (anosPaybackComSubstituicoes > 0) {
                    textoPaybackComSubstituicoes = ` | Payback com substituições: <strong>${anosPaybackComSubstituicoes} ano${anosPaybackComSubstituicoes > 1 ? 's' : ''}</strong>`;
                } else {
                    textoPaybackComSubstituicoes = ` | Payback com substituições: <strong>${mesesPaybackComSubstituicoes} mês${mesesPaybackComSubstituicoes > 1 ? 'es' : ''}</strong>`;
                }
            }
            
            infoPaybackEl.innerHTML = `
                <strong>💰 Análise Financeira:</strong><br>
                <div style="margin: 8px 0;">
                    <strong style="font-size: 0.95em;">Economia com Energia da Concessionária:</strong>
                    <table style="width: auto; border-collapse: collapse; margin: 4px 0; font-size: 0.9em; margin-left: auto; margin-right: auto;">
                        <tr>
                            <td style="padding: 2px 4px; text-align: left; white-space: nowrap;">Mensal:</td>
                            <td style="padding: 2px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatarMoedaComVirgula(economiaMensal, moeda, 2)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 2px 4px; text-align: left; white-space: nowrap;">Anual:</td>
                            <td style="padding: 2px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatarMoedaComVirgula(economiaAnual, moeda, 2)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 2px 4px; text-align: left; white-space: nowrap;">${anosAnalise} anos:</td>
                            <td style="padding: 2px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatarMoedaComVirgula(economiaTotalPeriodo, moeda, 2)}</td>
                        </tr>
                    </table>
                </div>
                <span style="color: #1976D2;">⏱️ Payback inicial: <strong>${textoPaybackInicial}</strong>${textoPaybackComSubstituicoes}</span>${infoSubstituicoes}<br>
                <span style="color: ${corLucroPrejuizo};">💵 ${labelLucroPrejuizo} em ${anosAnalise} anos: <strong>${formatarMoedaComVirgula(Math.abs(lucroTotalPeriodo), moeda, 2)}</strong></span>
            `;
        } else {
            let infoSubstituicoes = '';
            if (substituicoesBaterias.length > 0 || substituicoesSistemaCompleto.length > 0) {
                const partiInfo = [];
                
            if (substituicoesBaterias.length > 0) {
                    const anniSubstBatterie = substituicoesBaterias.map(s => s.ano).join(', ');
                    partiInfo.push(`<span style="color: #FF9800;">🔋 Sostituzioni batterie (vita utile: ${vidaUtil} anni): <strong>${substituicoesBaterias.length} volt${substituicoesBaterias.length > 1 ? 'e' : 'a'}</strong> agli ${anniSubstBatterie} anno${substituicoesBaterias.length > 1 ? 'i' : ''} | Costo totale: <strong>${formatarMoedaComVirgula(custoTotalSubstituicoesBateriasPeriodo, moeda, 2)}</strong></span>`);
                }
                
                if (substituicoesSistemaCompleto.length > 0) {
                    const anniSubstSistema = substituicoesSistemaCompleto.map(s => s.ano).join(', ');
                    partiInfo.push(`<span style="color: #9C27B0;">⚙️ Sostituzioni complete del sistema (ogni 25 anni): <strong>${substituicoesSistemaCompleto.length} volt${substituicoesSistemaCompleto.length > 1 ? 'e' : 'a'}</strong> agli ${anniSubstSistema} anno${substituicoesSistemaCompleto.length > 1 ? 'i' : ''} | Costo totale: <strong>${formatarMoedaComVirgula(custoTotalSubstituicoesSistemaPeriodo, moeda, 2)}</strong></span>`);
                }
                
                if (partiInfo.length > 0) {
                    infoSubstituicoes = '<br>' + partiInfo.join('<br>');
                }
            }
            
            // Formatar texto de payback inicial (italiano)
            let testoPaybackIniziale = '';
            if (anosPayback > 0 && mesesPayback > 0) {
                testoPaybackIniziale = `${anosPayback} anno${anosPayback > 1 ? 'i' : ''} e ${mesesPayback} mese${mesesPayback > 1 ? 'i' : ''}`;
            } else if (anosPayback > 0) {
                testoPaybackIniziale = `${anosPayback} anno${anosPayback > 1 ? 'i' : ''}`;
            } else {
                testoPaybackIniziale = `${mesesPayback} mese${mesesPayback > 1 ? 'i' : ''}`;
            }
            
            // Formatar texto de payback com substituições (italiano)
            let testoPaybackConSostituzioni = '';
            if (anosPaybackComSubstituicoes !== null && mesesPaybackComSubstituicoes !== null) {
                if (anosPaybackComSubstituicoes > 0 && mesesPaybackComSubstituicoes > 0) {
                    testoPaybackConSostituzioni = ` | Payback con sostituzioni: <strong>${anosPaybackComSubstituicoes} anno${anosPaybackComSubstituicoes > 1 ? 'i' : ''} e ${mesesPaybackComSubstituicoes} mese${mesesPaybackComSubstituicoes > 1 ? 'i' : ''}</strong>`;
                } else if (anosPaybackComSubstituicoes > 0) {
                    testoPaybackConSostituzioni = ` | Payback con sostituzioni: <strong>${anosPaybackComSubstituicoes} anno${anosPaybackComSubstituicoes > 1 ? 'i' : ''}</strong>`;
                } else {
                    testoPaybackConSostituzioni = ` | Payback con sostituzioni: <strong>${mesesPaybackComSubstituicoes} mese${mesesPaybackComSubstituicoes > 1 ? 'i' : ''}</strong>`;
                }
            }
            
            infoPaybackEl.innerHTML = `
                <strong>💰 Analisi Finanziaria:</strong><br>
                <div style="margin: 8px 0;">
                    <strong style="font-size: 0.95em;">Risparmio con Energia della Concessionaria:</strong>
                    <table style="width: auto; border-collapse: collapse; margin: 4px 0; font-size: 0.9em; margin-left: auto; margin-right: auto;">
                        <tr>
                            <td style="padding: 2px 4px; text-align: left; white-space: nowrap;">Mensile:</td>
                            <td style="padding: 2px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatarMoedaComVirgula(economiaMensal, moeda, 2)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 2px 4px; text-align: left; white-space: nowrap;">Annuale:</td>
                            <td style="padding: 2px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatarMoedaComVirgula(economiaAnual, moeda, 2)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 2px 4px; text-align: left; white-space: nowrap;">${anosAnalise} anni:</td>
                            <td style="padding: 2px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatarMoedaComVirgula(economiaTotalPeriodo, moeda, 2)}</td>
                        </tr>
                    </table>
                </div>
                <span style="color: #1976D2;">⏱️ Payback iniziale: <strong>${testoPaybackIniziale}</strong>${testoPaybackConSostituzioni}</span>${infoSubstituicoes}<br>
                <span style="color: ${corLucroPrejuizo};">💵 ${labelLucroPrejuizo} in ${anosAnalise} anni: <strong>${formatarMoedaComVirgula(Math.abs(lucroTotalPeriodo), moeda, 2)}</strong></span>
            `;
        }
    }
}
// Gráfico de barras: Sazonalidade de geração solar ao longo do ano
function atualizarGraficoSazonalidade(dados) {
    const ctx = document.getElementById('graficoSazonalidade');
    if (!ctx) {
        console.warn('[Solar] Canvas graficoSazonalidade não encontrado');
        return;
    }
    
    // Validar dados necessários
    if (!dados) {
        console.warn('[Solar] Dados não fornecidos para gráfico de sazonalidade');
        return;
    }
    
    // Destruir gráfico anterior se existir
    if (graficoSazonalidade) {
        graficoSazonalidade.destroy();
    }
    
    const { qtdPaineis = 0, POTENCIA_PAINEL = 400 } = dados;
    
    // Validar valores numéricos
    if (typeof qtdPaineis !== 'number' || typeof POTENCIA_PAINEL !== 'number') {
        console.warn('[Solar] Valores inválidos para gráfico de sazonalidade:', dados);
        return;
    }
    
    // Fatores de sazonalidade baseados em dados médios para Brasil/Itália
    // Valores representam eficiência relativa (0 a 1) por mês
    const meses = idiomaAtual === 'pt-BR' 
        ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
        : ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    
    // Fatores de sazonalidade ajustados por hemisfério
    // Hemisfério Sul (Brasil): menor produção em Jun/Jul (inverno), maior em Dez/Jan (verão)
    // Hemisfério Norte (Itália): menor produção em Dez/Jan (inverno), maior em Jun/Jul (verão)
    let fatoresSazonalidade;
    
    if (idiomaAtual === 'pt-BR') {
        // Hemisfério Sul - Brasil
        // Baseado em dados de irradiação solar no Brasil: menor em jun/jul, maior em dez/jan
        fatoresSazonalidade = [
            1.00, // Jan - verão (pico de produção)
            0.95, // Fev - verão
            0.90, // Mar - fim do verão
            0.85, // Abr - outono
            0.80, // Mai - outono
            0.70, // Jun - inverno (menor produção)
            0.70, // Jul - inverno (menor produção)
            0.75, // Ago - fim do inverno
            0.85, // Set - primavera
            0.90, // Out - primavera
            0.95, // Nov - fim da primavera
            0.98  // Dez - início do verão
        ];
    } else {
        // Hemisfério Norte - Itália
        // Baseado em dados de irradiação solar na Itália: menor em dez/jan (~20% do máximo), maior em jul (~100%)
        fatoresSazonalidade = [
            0.25, // Gen - inverno (menor produção)
            0.30, // Feb - inverno
            0.50, // Mar - início da primavera
            0.70, // Apr - primavera
            0.85, // Mag - fim da primavera
            0.95, // Giu - início do verão
            1.00, // Lug - verão (pico de produção)
            0.95, // Ago - verão
            0.80, // Set - fim do verão
            0.60, // Ott - outono
            0.40, // Nov - outono
            0.28  // Dic - inverno (menor produção)
        ];
    }
    
    const potenciaTotal = qtdPaineis * POTENCIA_PAINEL; // W
    const producaoMensal = fatoresSazonalidade.map(fator => {
        // Produção mensal = potência × HSP × dias × fator sazonal
        // Assumindo HSP médio de 5h e 30 dias por mês
        return Math.round((potenciaTotal * HSP * 30 * fator) / 1000); // kWh/mês
    });
    
    // Cores baseadas na produção (verde para alta, amarelo para média, vermelho para baixa)
    const cores = producaoMensal.map(prod => {
        const maxProd = Math.max(...producaoMensal);
        const ratio = prod / maxProd;
        if (ratio >= 0.9) return 'rgba(76, 175, 80, 0.8)';      // Verde - alta produção
        if (ratio >= 0.7) return 'rgba(255, 193, 7, 0.8)';      // Amarelo - média produção
        return 'rgba(244, 67, 54, 0.8)';                        // Vermelho - baixa produção
    });
    
    graficoSazonalidade = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [{
                label: idiomaAtual === 'pt-BR' ? 'Produção Mensal (kWh)' : 'Produzione Mensile (kWh)',
                data: producaoMensal,
                backgroundColor: cores,
                borderColor: cores.map(c => c.replace('0.8', '1')),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Desabilitar animações para atualização instantânea
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${formatarNumero(context.parsed.y, 0)} kWh`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: idiomaAtual === 'pt-BR' ? 'Produção (kWh/mês)' : 'Produzione (kWh/mese)',
                        font: { size: 12, weight: 'bold' }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: idiomaAtual === 'pt-BR' ? 'Mês' : 'Mese',
                        font: { size: 12, weight: 'bold' }
                    }
                }
            }
        }
    });
}
// FUNÇÃO PRINCIPAL: CALCULAR O SISTEMA
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
// Função principal calcula todo o dimensionamento do sistema solar
function calcularSistema(dodAlvo) {
    // Validação do parâmetro dodAlvo
    if (typeof dodAlvo !== 'number' || isNaN(dodAlvo) || dodAlvo <= 0) {
        console.error('[Solar] DoD alvo inválido:', dodAlvo);
        return;
    }
    
        // PASSO 1: OBTER VALORES DA INTERFACE
        // Lê os valores dos inputs editáveis ou sliders (inputs têm prioridade)
    const inputConsumo = document.getElementById('inputConsumo');
    const inputAutonomia = document.getElementById('inputAutonomia');
    const sliderConsumo = document.getElementById('sliderConsumo');
    const sliderAutonomia = document.getElementById('sliderAutonomia'); // elementos existem antes de acessar
    if (!sliderConsumo) {
        console.error('[Solar] sliderConsumo não encontrado');
        return;
    }
    
    const consumoMensal = inputConsumo ? (parseFloat(inputConsumo.value) || parseFloat(sliderConsumo.value) || 200) : (parseFloat(sliderConsumo.value) || 200); // Consumo em kWh/mês
    const autonomia = inputAutonomia ? (parseInt(inputAutonomia.value) || parseInt(sliderAutonomia.value) || 1) : (parseInt(sliderAutonomia.value) || 1);           // Dias de autonomia
    const tipoBateriaEl = document.querySelector('input[name="tipoBateria"]:checked');
    const tipoBateria = tipoBateriaEl ? tipoBateriaEl.value : 'litio';  // 'litio' ou 'chumbo'
    
    // Validação dos valores lidos
    if (isNaN(consumoMensal) || consumoMensal <= 0) {
        console.warn('[Solar] Consumo mensal inválido:', consumoMensal);
        return;
    }
    if (isNaN(autonomia) || autonomia <= 0) {
        console.warn('[Solar] Autonomia inválida:', autonomia);
        return;
    }

        // PASSO 2: OBTER CONFIGURAÇÃO DOS COMPONENTES // configuração customizada do usuário (salva no localStorage) ou usa os valores padrão
    const config = obterConfig(); // Se capacidade parecer muito grande (>20), interpreta como Ah e converte para kWh usando a tensão
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
    
        // PASSO 3: MONTAR ESPECIFICAÇÕES DAS BATERIAS
        // Cria um objeto com todas as especificações da bateria escolhida
    // Suporta capacidade expressa em kWh ou Ah
    const batSpec = (tipoBateria === 'litio')
        ? { 
            v: config.tensaoLitio,                    // Tensão em volts
            kwh: config.capacidadeLitio,              // Capacidade em kWh
            ah: config.capacidadeLitioAh || null,     // Capacidade em Ah (se disponível, para referência)
            price_brl: config.precoLitio,             // Preço unitário em BRL
            weight: config.pesoLitio                  // Peso em kg
          }
        : { 
            v: config.tensaoAGM,                      // Tensão em volts
            kwh: config.capacidadeAGM,                // Capacidade em kWh
            ah: config.capacidadeAGMAh || null,       // Capacidade em Ah (se disponível, para referência)
            price_brl: config.precoAGM,               // Preço unitário em BRL
            weight: config.pesoAGM                    // Peso em kg
          };
    
    // Obtém especificações dos painéis solares
    const POTENCIA_PAINEL = config.potenciaPainel; // Potência de cada painel em Watts
    const PRECO_PAINEL = config.precoPainel;       // Preço de cada painel em BRL

        // PASSO 4: VALIDAÇÃO DE ENTRADA
    // ============================================ // Se consumo for inválido (zero ou negativo), zera todos os resultados
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

        // PASSO 5: CALCULAR ENERGIA DIÁRIA NECESSÁRIA
        // Converte o consumo mensal para consumo diário médio
    // Divide por 30 para obter a média diária (assumindo 30 dias por mês)
    const energiaDiaria = consumoMensal / 30; // kWh/dia
    
        // PASSO 6: DIMENSIONAMENTO DAS BATERIAS
        // O DoD escolhido (via slider de vida útil) afeta AMBOS os critérios:
    // - Quanto menor o DoD, mais baterias são necessárias para a mesma energia utilizável
    // - O DoD limita quanto da capacidade nominal pode ser usada diariamente
    
    // CRITÉRIO A: Vida Útil // capacidade nominal necessária para 1 dia de consumo com o DoD alvo
    // Fórmula: capacidadeNominal = energiaDiaria / DoD
    // Exemplo: se consumo diário = 10 kWh e DoD = 50% (0.5):
    // capacidadeNominal = 10 / 0.5 = 20 kWh nominais // que a bateria não seja descarregada além do DoD alvo em um dia normal
    const capVidaUtil = energiaDiaria / dodAlvo;
    
    // CRITÉRIO B: Autonomia // capacidade nominal necessária para N dias de autonomia com o MESMO DoD
    // Fórmula: capacidadeNominal = (energiaDiaria × autonomia) / DoD
    // Exemplo: se autonomia = 3 dias, consumo = 10 kWh/dia, DoD = 50% (0.5):
    // energiaTotalNecessaria = 10 × 3 = 30 kWh utilizáveis
    // capacidadeNominal = 30 / 0.5 = 60 kWh nominais // que o sistema funcione por N dias sem sol, respeitando o DoD alvo
    const energiaAutonomia = energiaDiaria * autonomia; // kWh utilizáveis necessários para a autonomia
    const capAutonomia = energiaAutonomia / dodAlvo;    // kWh nominais necessários
    
    // Escolhe o maior requisito (o gargalo)
    // O sistema precisa atender AMBOS os critérios, então escolhemos o maior valor
    // Exemplo: se capVidaUtil = 20 kWh e capAutonomia = 60 kWh, escolhemos 60 kWh
    const capacidadeNecessariaKWh = Math.max(capVidaUtil, capAutonomia);
    
        // PASSO 7: CALCULAR QUANTIDADE DE BATERIAS // energia (capacidade) de uma única bateria
    // Prioriza kWh se disponível; caso contrário, calcula a partir de V × Ah / 1000
    const energiaPorBateria = (typeof batSpec.kwh === 'number' && !isNaN(batSpec.kwh))
        ? batSpec.kwh  // Usa kWh diretamente se disponível
        : ((batSpec.v && batSpec.ah) ? (batSpec.v * batSpec.ah) / 1000 : 0); // Calcula de Ah se necessário // quantidade de baterias necessárias
    // Arredonda para cima (Math.ceil) para ter capacidade suficiente
    // Exemplo: se precisamos de 60 kWh e cada bateria tem 4.8 kWh:
    // qtdBaterias = ceil(60 / 4.8) = ceil(12.5) = 13 baterias
    let qtdBaterias = Math.ceil(capacidadeNecessariaKWh / energiaPorBateria);
    
    // Garante paridade (número par) para tensões mais altas (24V/48V)
    // Isso facilita a montagem prática do banco de baterias (conexão em série/paralelo)
    // Exemplo: se calculamos 13 baterias, incrementamos para 14 (par)
    if (qtdBaterias % 2 !== 0 && qtdBaterias > 1) qtdBaterias++; // Preferência por pares // capacidade real do banco de baterias instalado
    // Isso pode ser maior que a capacidade necessária devido ao arredondamento e paridade
    // Exemplo: se precisamos de 60 kWh mas instalamos 14 baterias de 4.8 kWh:
    // capacidadeReal = 14 × 4.8 = 67.2 kWh
    const capacidadeRealKWh = qtdBaterias * energiaPorBateria;
    
        // PASSO 8: DIMENSIONAMENTO DOS PAINÉIS SOLARES
        // Os painéis precisam gerar energia suficiente para recarregar o banco de baterias
    // em 1 dia de sol. A energia a recarregar é o que foi descarregado = capacidade × DoD.
    // Isso inclui o consumo diário, pois o banco foi dimensionado para isso. // energia utilizável do banco de baterias
    // Esta é a energia que pode ser extraída do banco respeitando o DoD alvo
    // Exemplo: se capacidadeReal = 67.2 kWh e DoD = 50% (0.5):
    // energiaUtilizavel = 67.2 × 0.5 = 33.6 kWh utilizáveis
    const energiaUtilizavelBanco = capacidadeRealKWh * dodAlvo; // energia que os painéis devem gerar por dia
    // Considera as perdas do sistema (cabo, MPPT, inversor, etc.)
    // Fórmula: energiaGerar = energiaUtilizavel / eficienciaSistema
    // Exemplo: se energiaUtilizavel = 33.6 kWh e eficiencia = 80% (0.8):
    // energiaTotalGerar = 33.6 / 0.8 = 42 kWh/dia
    const energiaTotalGerar = energiaUtilizavelBanco / EFICIENCIA_SISTEMA; // potência solar necessária em Watts
    // Fórmula: potencia = (energia × 1000) / HSP
    // Onde HSP (Horas de Sol Pleno) é o número médio de horas de sol por dia
    // Exemplo: se energiaTotalGerar = 42 kWh/dia e HSP = 5 horas:
    // potenciaSolar = (42 × 1000) / 5 = 8400 W = 8.4 kW
    const potenciaSolarNecessaria = (energiaTotalGerar * 1000) / HSP; // Watts // quantidade de painéis necessários
    // Arredonda para cima para ter potência suficiente
    // Exemplo: se precisamos de 8400 W e cada painel tem 400 W:
    // qtdPaineis = ceil(8400 / 400) = ceil(21) = 21 painéis
    const qtdPaineis = Math.ceil(potenciaSolarNecessaria / POTENCIA_PAINEL);
    
        // PASSO 9: DIMENSIONAMENTO DO INVERSOR COM MPPT INTEGRADO
        // Em sistemas off-grid, todos os inversores modernos já vêm com MPPT integrado
    // O inversor converte DC das baterias para AC da casa
    // Deve ter capacidade para o consumo de pico típico de uma residência
    // E também deve ter capacidade MPPT suficiente para os painéis
    // 
    // Fórmula: consumoMedioHorario = energiaDiaria / 24 horas
    //          consumoPico = consumoMedioHorario × FATOR_PICO_CONSUMO
    //          potenciaInversor = max(1kW, consumoPico)
    // Exemplo: se energiaDiaria = 5 kWh/dia e FATOR_PICO = 5:
    //          consumoMedioHorario = 5 / 24 = 0.208 kW
    //          consumoPico = 0.208 × 5 = 1.04 kW
    //          potenciaInversor = max(1, 1.04) = 1.04 kW → arredonda para 2 kW
    const consumoMedioHorario = energiaDiaria / 24; // kW (consumo médio por hora)
    const consumoPico = consumoMedioHorario * FATOR_PICO_CONSUMO; // kW (pico de consumo)
    let potenciaInversor = Math.max(1, Math.ceil(consumoPico)); // Mínimo 1kW, arredonda para cima // corrente máxima necessária para os painéis
    // Corrente = Potência Total dos Painéis / Tensão do Banco de Baterias
    const potenciaTotalPaineis = qtdPaineis * POTENCIA_PAINEL; // Watts
    const tensaoBanco = batSpec.v; // Volts (tensão do banco de baterias)
    const correnteMaximaNecessaria = potenciaTotalPaineis / tensaoBanco; // Ampères // inversor escolhido tem capacidade MPPT suficiente
    // Se não tiver, aumenta a potência do inversor até encontrar um com MPPT adequado
    let capacidadeMPPTIntegrado = obterCapacidadeMPPTIntegrado(potenciaInversor);
    while (capacidadeMPPTIntegrado < correnteMaximaNecessaria && potenciaInversor < 10) {
        potenciaInversor += 1; // Aumenta em 1kW
        capacidadeMPPTIntegrado = obterCapacidadeMPPTIntegrado(potenciaInversor);
    }
    
    // Se ainda não encontrou inversor adequado, usa o maior disponível
    if (capacidadeMPPTIntegrado < correnteMaximaNecessaria) {
        const maiorInversor = PRECOS_INVERSOR_BRL[PRECOS_INVERSOR_BRL.length - 1];
        potenciaInversor = maiorInversor.kw;
        capacidadeMPPTIntegrado = maiorInversor.mpptA;
    }
    
    // A corrente MPPT é a capacidade integrada do inversor escolhido
    const correnteMPPT = capacidadeMPPTIntegrado;
    
        // PASSO 11: CALCULAR PESO E CUSTOS // peso total das baterias
    // Exemplo: se temos 14 baterias de 60 kg cada:
    // pesoTotal = 14 × 60 = 840 kg
    const pesoTotal = qtdBaterias * batSpec.weight;
    
    // Conversão de moeda: a configuração salva os preços em BRL (Real) // Se idioma for italiano, converte para EUR (Euro) usando a taxa de câmbio
    const moedaCalculo = idiomaAtual === 'pt-BR' ? 'BRL' : 'EUR';
    // Fator de conversão: 1 para BRL (sem conversão) ou 1/taxa para EUR
    // Exemplo: se TAXA_BRL_EUR = 6.19, então 1 BRL = 1/6.19 ≈ 0.1615 EUR
    const fatorConversao = idiomaAtual === 'pt-BR' ? 1 : 1 / TAXA_BRL_EUR;
    
    // Converte os preços unitários para a moeda do idioma
    // Exemplo: se PRECO_PAINEL = 1200 BRL e fatorConversao = 0.1615:
    // precoPainelConvertido = 1200 × 0.1615 ≈ 194 EUR
    const precoPainelConvertido = PRECO_PAINEL * fatorConversao;
    
    // Obter preço ajustável da bateria por kWh do slider (ou usar preço padrão)
    const sliderPrecoBateriaKWh = document.getElementById('sliderPrecoBateriaKWh');
    const inputPrecoBateriaKWh = document.getElementById('inputPrecoBateriaKWh');
    // Obter tipo de bateria selecionado para determinar preço padrão
    const tipoBateriaRadio = document.querySelector('input[name="tipoBateria"]:checked');
    const tipoBateriaAtual = tipoBateriaRadio ? tipoBateriaRadio.value : 'litio';
    const precosBateriaAtual = tipoBateriaAtual === 'chumbo' ? PRECO_BATERIA_KWH_CHUMBO : PRECO_BATERIA_KWH_LITIO;
    const valorPadraoBateria = precosBateriaAtual[idiomaAtual] || precosBateriaAtual['pt-BR'];
    
    // Atualizar constante global para compatibilidade
    PRECO_BATERIA_KWH[idiomaAtual] = valorPadraoBateria;
    
    let precoBateriaPorKWh;
    if (sliderPrecoBateriaKWh && inputPrecoBateriaKWh) {
        const valorInput = parseFloat(inputPrecoBateriaKWh.value);
        const valorSlider = parseFloat(sliderPrecoBateriaKWh.value);
        precoBateriaPorKWh = !isNaN(valorInput) && valorInput > 0 ? valorInput : (!isNaN(valorSlider) && valorSlider > 0 ? valorSlider : valorPadraoBateria);
    } else {
        // Fallback: usar valor padrão baseado no idioma
        precoBateriaPorKWh = valorPadraoBateria;
    }
    
    // Calcular preço unitário da bateria: preço por kWh × capacidade da bateria
    // Exemplo: se preço por kWh = 2000 R$/kWh e bateria tem 4.8 kWh:
    // precoBateriaAjustado = 2000 × 4.8 = 9600 R$
    const precoBateriaAjustado = precoBateriaPorKWh * energiaPorBateria;
    const precoBateriaConvertido = precoBateriaAjustado * fatorConversao; // custos totais de cada componente
    // Exemplo: se temos 21 painéis a 1200 BRL cada:
    // custoPaineis = 21 × 1200 = 25200 BRL
    const custoPaineis = qtdPaineis * precoPainelConvertido;
    const custoBaterias = qtdBaterias * precoBateriaConvertido;
    // O preço do inversor (com MPPT integrado) é calculado por interpolação baseado na potência
    // Em sistemas off-grid, todos os inversores modernos já incluem MPPT integrado
    const custoInversor = calcularPrecoInversor(potenciaInversor, moedaCalculo); // custo total do sistema
    // O inversor já inclui o MPPT, então não há custo separado de MPPT
    // Exemplo: custoTotal = 25200 + 168000 + 5500 = 198700 BRL
    const custoTotal = custoPaineis + custoBaterias + custoInversor;

    // 6. Exibir Resultados (verificando se os elementos existem)
    const resQtdPlacas = document.getElementById('resQtdPlacas');
    if (resQtdPlacas) resQtdPlacas.textContent = `${qtdPaineis} x ${formatarNumeroComSufixo(POTENCIA_PAINEL, 0)}W`;
    // Exibe quantas unidades do módulo escolhido (kWh e tensão)
    const unidadeKWh = (typeof batSpec.kwh === 'number' ? formatarNumeroDecimal(batSpec.kwh, 1) : (batSpec.ah ? formatarNumeroDecimal((batSpec.v * batSpec.ah)/1000, 1) : '0,0'));
    const resQtdBaterias = document.getElementById('resQtdBaterias');
    if (resQtdBaterias) resQtdBaterias.textContent = `${qtdBaterias} x ${unidadeKWh} kWh (${batSpec.v}V)`;
    const resPotenciaInversor = document.getElementById('resPotenciaInversor');
    if (resPotenciaInversor) {
        // Mostra potência do inversor e capacidade MPPT integrada
        resPotenciaInversor.textContent = `${potenciaInversor} kW (MPPT ${formatarNumeroComSufixo(correnteMPPT, 0)}A)`;
    }
    const resCorrenteMPPT = document.getElementById('resCorrenteMPPT');
    if (resCorrenteMPPT) {
        // Mostra apenas como informação (já está no inversor)
        resCorrenteMPPT.textContent = formatarNumeroComSufixo(correnteMPPT, 0) + ' A';
    }
    const resPesoBaterias = document.getElementById('resPesoBaterias');
    if (resPesoBaterias) resPesoBaterias.textContent = formatarNumeroComSufixo(pesoTotal, 1) + ' kg';
    
    const moeda = traducoes[idiomaAtual]?.['moeda'] || 'R$';
    const formatarPreco = (valor) => `${moeda} ${valor.toLocaleString(idiomaAtual, {minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true})}`;
    
    // Exibir custos detalhados
    const resPrecoEstimado = document.getElementById('resPrecoEstimado');
    if (resPrecoEstimado) resPrecoEstimado.textContent = formatarPreco(custoTotal);
    const custoPaineisEl = document.getElementById('custoPaineis');
    if (custoPaineisEl) custoPaineisEl.textContent = formatarPreco(custoPaineis);
    const custoBateriasEl = document.getElementById('custoBaterias');
    if (custoBateriasEl) custoBateriasEl.textContent = formatarPreco(custoBaterias);
    const custoInversorEl = document.getElementById('custoInversor');
    if (custoInversorEl) {
        // O custo do inversor já inclui o MPPT integrado
        custoInversorEl.textContent = formatarPreco(custoInversor);
    }
    const custoMPPTEl = document.getElementById('custoMPPT');
    if (custoMPPTEl) {
        // MPPT está integrado no inversor, então não há custo separado
        custoMPPTEl.textContent = '-';
    }
    
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
    
    // Motivo do dimensionamento do INVERSOR COM MPPT INTEGRADO
    // Em sistemas off-grid, todos os inversores modernos já vêm com MPPT integrado
    let motivoInversorGargalo = '';
    let motivoInversorDetalhes = '';
    if (idiomaAtual === 'pt-BR') {
        motivoInversorGargalo = '(gargalo: consumo de pico + corrente MPPT)';
        motivoInversorDetalhes = `consumo médio ${formatarNumeroDecimal(consumoMedioHorario, 2)} kW/h × fator pico ${FATOR_PICO_CONSUMO}<br>→ ${formatarNumeroDecimal(consumoPico, 2)} kW<br>→ inversor ${potenciaInversor} kW<br>→ MPPT integrado ${formatarNumeroComSufixo(correnteMPPT, 0)}A (${qtdPaineis} painéis × ${formatarNumeroComSufixo(POTENCIA_PAINEL, 0)}W ÷ ${tensaoBanco}V = ${formatarNumeroComSufixo(correnteMaximaNecessaria, 1)}A)`;
    } else {
        motivoInversorGargalo = '(limite: consumo di picco + corrente MPPT)';
        motivoInversorDetalhes = `consumo medio ${formatarNumeroDecimal(consumoMedioHorario, 2)} kW/h × fattore picco ${FATOR_PICO_CONSUMO}<br>→ ${formatarNumeroDecimal(consumoPico, 2)} kW<br>→ inverter ${potenciaInversor} kW<br>→ MPPT integrato ${formatarNumeroComSufixo(correnteMPPT, 0)}A (${qtdPaineis} pannelli × ${formatarNumeroComSufixo(POTENCIA_PAINEL, 0)}W ÷ ${tensaoBanco}V = ${formatarNumeroComSufixo(correnteMaximaNecessaria, 1)}A)`;
    }
    document.getElementById('resMotivoInversor').innerHTML = `${motivoInversorGargalo}<br>${motivoInversorDetalhes}`;
    
    // MPPT está integrado no inversor, então não mostra motivo separado
    const resMotivoMPPT = document.getElementById('resMotivoMPPT');
    if (resMotivoMPPT) {
        resMotivoMPPT.innerHTML = '';
    }
    
    // Atualiza o memorial se estiver visível
    if (typeof atualizarMemorialComValores === 'function') {
        atualizarMemorialComValores();
    }
    
    // Atualiza os gráficos (com proteção contra erros)
    try {
        // Obter vida útil e tipo de bateria para cálculo de amortização
        const sliderVidaUtil = document.getElementById('sliderVidaUtil');
        const inputVidaUtil = document.getElementById('inputVidaUtil');
        const tipoBateriaEl = document.querySelector('input[name="tipoBateria"]:checked');
        const tipoBateria = tipoBateriaEl ? tipoBateriaEl.value : 'litio';
        const vidaUtil = inputVidaUtil ? (parseFloat(inputVidaUtil.value) || parseFloat(sliderVidaUtil.value) || 20) : (parseFloat(sliderVidaUtil.value) || 20);
        
        atualizarGraficosSolar({
            energiaDiaria,
            autonomia,
            capacidadeRealKWh,
            energiaUtilizavelBanco,
            dodAlvo,
            qtdPaineis,
            POTENCIA_PAINEL,
            energiaTotalGerar,
            qtdBaterias,
            custoTotal,        // Custo total inicial do sistema
            consumoMensal,      // Consumo mensal para cálculo de economia
            custoBaterias,      // Custo das baterias (para calcular substituições)
            vidaUtil,           // Vida útil das baterias em anos
            tipoBateria         // Tipo de bateria ('litio' ou 'chumbo')
        });
    } catch (error) {
        // Ignora erros nos gráficos para não quebrar o app
        console.error('Erro ao atualizar gráficos:', error);
    }
}
// ATUALIZAR ESPECIFICAÇÕES DAS BATERIAS NOS BOTÕES
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
// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    try {
    // 1. Configurar botões de idioma
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            trocarIdioma(btn.getAttribute('data-lang'));
        });
    });

    // 2. Configurar botões de seta - usa função global com aceleração exponencial
    if (typeof configurarBotoesSliderComAceleracao === 'function') {
        // Usa função de ajuste local que atualiza inputs correspondentes
        function ajustarValorSolar(targetId, step) {
            ajustarValor(targetId, step);
        }
        configurarBotoesSliderComAceleracao(SITE_SEL.ARROW_BTN, ajustarValorSolar);
    } else {
        // Fallback para código antigo se a função global não estiver disponível
        document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
            const targetId = btn.getAttribute('data-target');
            const step = parseFloat(btn.getAttribute('data-step'));
            btn.addEventListener('click', () => ajustarValor(targetId, step));
        });
    }
    
    // Código antigo removido - agora usa função global
    /*
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
    */

    // 3. Configurar sliders (eventos de input)
    const sliderConsumo = document.getElementById('sliderConsumo');
    const sliderAutonomia = document.getElementById('sliderAutonomia');
    const sliderVidaUtil = document.getElementById('sliderVidaUtil');
    
    // Função auxiliar para atualizar consumo
    const atualizarConsumo = () => {
        if (!sliderConsumo) return;
        const valor = parseInt(sliderConsumo.value) || 200;
        const inputConsumo = document.getElementById('inputConsumo');
        if (inputConsumo) {
            inputConsumo.value = valor;
            // Ajusta o tamanho do input dinamicamente com folga maior para valores maiores
            if (typeof ajustarTamanhoInput === 'function') {
                // Usa mais folga para valores maiores (até 999)
                const folga = valor >= 100 ? 4 : 3;
                ajustarTamanhoInput(inputConsumo, folga);
            }
        }
        atualizarInterface();
    };
    
    // Função auxiliar para atualizar autonomia
    const atualizarAutonomia = () => {
        if (!sliderAutonomia) return;
        const valor = parseInt(sliderAutonomia.value) || 1;
        const inputAutonomia = document.getElementById('inputAutonomia');
        if (inputAutonomia) {
            inputAutonomia.value = valor;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAutonomia);
        }
        atualizarInterface();
    };
    
    // Função auxiliar para atualizar vida útil
    const atualizarVidaUtil = () => {
        if (!sliderVidaUtil) return;
        const valor = parseFloat(sliderVidaUtil.value) || 20;
        const inputVidaUtil = document.getElementById('inputVidaUtil');
        if (inputVidaUtil) {
            inputVidaUtil.value = Math.round(valor);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputVidaUtil);
        }
        atualizarInterface();
    };
    
    // Aplica throttle nos sliders para melhorar performance durante o arraste // Adiciona também listener 'change' para garantir que o valor final seja sempre atualizado
    // Usa throttle se disponível, caso contrário usa a função diretamente
    const throttleFn = (typeof throttle === 'function') ? throttle : (fn, delay) => fn;
    
    if (sliderConsumo) {
        sliderConsumo.addEventListener('input', throttleFn(atualizarConsumo, 100));
        sliderConsumo.addEventListener('change', atualizarConsumo);
    }
    
    if (sliderAutonomia) {
        sliderAutonomia.addEventListener('input', throttleFn(atualizarAutonomia, 100));
        sliderAutonomia.addEventListener('change', atualizarAutonomia);
    }
    
    if (sliderVidaUtil) {
        sliderVidaUtil.addEventListener('input', throttleFn(atualizarVidaUtil, 100));
        sliderVidaUtil.addEventListener('change', atualizarVidaUtil);
    }
    
    // Função auxiliar para atualizar preço kWh
    const atualizarPrecoKWh = () => {
        const sliderPrecoKWhEl = document.getElementById('sliderPrecoKWh');
        if (!sliderPrecoKWhEl) return;
        
        // Usa os limites min/max do slider (que já foram calculados dinamicamente)
        const minVal = parseFloat(sliderPrecoKWhEl.min) || 0;
        const maxVal = parseFloat(sliderPrecoKWhEl.max) || 3;
        const stepVal = parseFloat(sliderPrecoKWhEl.step) || 0.05;
        
        let valor = parseFloat(sliderPrecoKWhEl.value);
        if (isNaN(valor)) {
        const valorPadrao = PRECO_KWH[idiomaAtual] || PRECO_KWH['pt-BR'];
            valor = valorPadrao;
        }
        
        // Garantir que o valor está dentro dos limites do slider
        valor = Math.max(minVal, Math.min(maxVal, valor));
        // Arredondar para múltiplos do step
        valor = Math.round(valor / stepVal) * stepVal;
        // Garantir precisão de 2 casas decimais
        valor = Math.round(valor * 100) / 100;
        
        sliderPrecoKWhEl.value = valor.toFixed(2);
        
        const inputPrecoKWhEl = document.getElementById('inputPrecoKWh');
        if (inputPrecoKWhEl) {
            inputPrecoKWhEl.value = formatarDecimalComVirgula(valor, 2);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPrecoKWhEl);
        }
        atualizarInterface();
    };
    
    const sliderPrecoKWhEl = document.getElementById('sliderPrecoKWh');
    if (sliderPrecoKWhEl) {
        sliderPrecoKWhEl.addEventListener('input', throttleFn(atualizarPrecoKWh, 100));
        sliderPrecoKWhEl.addEventListener('change', atualizarPrecoKWh);
    }
    
    // Função auxiliar para atualizar aumento anual do custo da energia
    const atualizarAumentoAnualEnergia = () => {
        const sliderAumentoAnualEnergiaEl = document.getElementById('sliderAumentoAnualEnergia');
        if (!sliderAumentoAnualEnergiaEl) return;
        const valorPadrao = AUMENTO_ANUAL_ENERGIA[idiomaAtual] || AUMENTO_ANUAL_ENERGIA['pt-BR'];
        const valor = parseFloat(sliderAumentoAnualEnergiaEl.value) || valorPadrao;
        // Garantir que o valor está dentro dos limites
        const minValor = valorPadrao / 5;
        const maxValor = valorPadrao * 5;
        const valorLimitado = Math.max(minValor, Math.min(maxValor, valor));
        // Arredondar para múltiplos de 0.1
        sliderAumentoAnualEnergiaEl.value = Math.round(valorLimitado * 10) / 10;
        
        const inputAumentoAnualEnergiaEl = document.getElementById('inputAumentoAnualEnergia');
        if (inputAumentoAnualEnergiaEl) {
            inputAumentoAnualEnergiaEl.value = formatarDecimalComVirgula(valorLimitado, 1);
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAumentoAnualEnergiaEl);
        }
        atualizarInterface();
    };
    
    const sliderAumentoAnualEnergiaEl = document.getElementById('sliderAumentoAnualEnergia');
    if (sliderAumentoAnualEnergiaEl) {
        sliderAumentoAnualEnergiaEl.addEventListener('input', throttleFn(atualizarAumentoAnualEnergia, 100));
        sliderAumentoAnualEnergiaEl.addEventListener('change', atualizarAumentoAnualEnergia);
    }
    
    // Função auxiliar para atualizar preço bateria por kWh
    const atualizarPrecoBateriaKWh = () => {
        const sliderPrecoBateriaKWhEl = document.getElementById('sliderPrecoBateriaKWh');
        if (!sliderPrecoBateriaKWhEl) return;
        // Obter tipo de bateria selecionado para determinar preço padrão
        const tipoBateriaEl = document.querySelector('input[name="tipoBateria"]:checked');
        const tipoBateria = tipoBateriaEl ? tipoBateriaEl.value : 'litio';
        const precosBateria = tipoBateria === 'chumbo' ? PRECO_BATERIA_KWH_CHUMBO : PRECO_BATERIA_KWH_LITIO;
        const valorPadrao = precosBateria[idiomaAtual] || precosBateria['pt-BR'];
        
        // Atualizar constante global para compatibilidade
        PRECO_BATERIA_KWH[idiomaAtual] = valorPadrao;
        const valor = parseFloat(sliderPrecoBateriaKWhEl.value) || valorPadrao;
        // Garantir que o valor está dentro dos limites
        // Mínimo: 1/100 do valor padrão, máximo: 4x do valor padrão
        const minValor = Math.round(valorPadrao / 100);
        const maxValor = Math.round(valorPadrao * 4);
        const valorLimitado = Math.max(minValor, Math.min(maxValor, valor));
        // Arredondar para múltiplos de 10 para manter consistência com o step
        sliderPrecoBateriaKWhEl.value = Math.round(valorLimitado / 10) * 10;
        
        const inputPrecoBateriaKWhEl = document.getElementById('inputPrecoBateriaKWh');
        if (inputPrecoBateriaKWhEl) {
            inputPrecoBateriaKWhEl.value = Math.round(valorLimitado / 10) * 10;
            if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPrecoBateriaKWhEl);
        }
        atualizarInterface();
    };
    
    const sliderPrecoBateriaKWhEl = document.getElementById('sliderPrecoBateriaKWh');
    if (sliderPrecoBateriaKWhEl) {
        sliderPrecoBateriaKWhEl.addEventListener('input', throttleFn(atualizarPrecoBateriaKWh, 100));
        sliderPrecoBateriaKWhEl.addEventListener('change', atualizarPrecoBateriaKWh);
    }
    
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
            // Ajusta o tamanho do input dinamicamente conforme o valor digitado
            if (typeof ajustarTamanhoInput === 'function') {
                // Usa mais folga para valores maiores (até 999)
                const folga = (!isNaN(valor) && valor >= 100) ? 4 : 3;
                ajustarTamanhoInput(inputConsumo, folga);
            }
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
    
    const inputPrecoKWhEl = document.getElementById('inputPrecoKWh');
    if (inputPrecoKWhEl) {
        inputPrecoKWhEl.addEventListener('focus', (e) => e.target.select());
        inputPrecoKWhEl.addEventListener('input', () => {
            const valor = converterVirgulaParaNumero(inputPrecoKWhEl.value);
            if (!isNaN(valor) && valor > 0) {
                const sliderPrecoKWhEl2 = document.getElementById('sliderPrecoKWh');
                if (sliderPrecoKWhEl2) {
                    // Limita o valor entre min e max do slider
                    const minVal = parseFloat(sliderPrecoKWhEl2.min) || 0.10;
                    const maxVal = parseFloat(sliderPrecoKWhEl2.max) || 2.00;
                    const valorLimitado = Math.max(minVal, Math.min(maxVal, valor));
                    
                    if (valorLimitado >= minVal && valorLimitado <= maxVal) {
                        sliderPrecoKWhEl2.value = valorLimitado.toFixed(2);
                        inputPrecoKWhEl.value = formatarDecimalComVirgula(valorLimitado, 2);
                    }
                }
                atualizarInterface();
            }
        });
    }
    
    const inputPrecoBateriaKWhEl = document.getElementById('inputPrecoBateriaKWh');
    if (inputPrecoBateriaKWhEl) {
        inputPrecoBateriaKWhEl.addEventListener('focus', (e) => e.target.select());
        inputPrecoBateriaKWhEl.addEventListener('input', () => {
            const valor = parseFloat(inputPrecoBateriaKWhEl.value);
            if (!isNaN(valor) && valor > 0) {
                const sliderPrecoBateriaKWhEl2 = document.getElementById('sliderPrecoBateriaKWh');
                if (sliderPrecoBateriaKWhEl2) {
                    // Limita o valor entre min e max do slider (que são calculados dinamicamente)
                    const minVal = parseFloat(sliderPrecoBateriaKWhEl2.min);
                    const maxVal = parseFloat(sliderPrecoBateriaKWhEl2.max);
                    const valorLimitado = Math.max(minVal, Math.min(maxVal, valor));
                    // Arredondar para múltiplos de 10 para manter consistência com o step
                    const valorArredondado = Math.round(valorLimitado / 10) * 10;
                    
                    if (valorArredondado >= minVal && valorArredondado <= maxVal) {
                        sliderPrecoBateriaKWhEl2.value = valorArredondado;
                    }
                }
                atualizarInterface();
            }
        });
    }

    // 4. Configurar Radio Buttons (Tipo de Bateria)
    document.querySelectorAll('input[name="tipoBateria"]').forEach(radio => {
        radio.addEventListener('change', () => {
            // Atualizar preço da bateria e limites do slider quando o tipo mudar
            atualizarNotasValoresPadrao();
            
            // Atualizar limites do slider de período de análise baseado no tipo de bateria
            const sliderPeriodoAnalise = document.getElementById('sliderPeriodoAnalise');
            const inputPeriodoAnalise = document.getElementById('inputPeriodoAnalise');
            if (sliderPeriodoAnalise) {
                const tipoBateriaEl = document.querySelector('input[name="tipoBateria"]:checked');
                const tipoBateriaAtual = tipoBateriaEl ? tipoBateriaEl.value : 'litio';
                const vidaUtilMaxima = tipoBateriaAtual === 'litio' ? 25 : 5;
                
                // Atualizar limites: min = 1x vida útil máxima, max = 4x vida útil máxima
                sliderPeriodoAnalise.min = vidaUtilMaxima.toString();
                sliderPeriodoAnalise.max = (vidaUtilMaxima * 4).toString();
                
                // Ajustar valor atual se estiver fora dos novos limites
                const valorAtual = parseInt(sliderPeriodoAnalise.value) || vidaUtilMaxima;
                const minPeriodo = vidaUtilMaxima;
                const maxPeriodo = vidaUtilMaxima * 4;
                const valorAjustado = Math.max(minPeriodo, Math.min(maxPeriodo, valorAtual));
                
                sliderPeriodoAnalise.value = valorAjustado.toString();
                if (inputPeriodoAnalise) {
                    inputPeriodoAnalise.value = valorAjustado.toString();
                    if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPeriodoAnalise);
                }
            }
            
            atualizarInterface();
        });
    });
    
    // 4.5. Configurar Slider e Input de Período de Análise do Gráfico
    const sliderPeriodoAnaliseEl = document.getElementById('sliderPeriodoAnalise');
    const inputPeriodoAnaliseEl = document.getElementById('inputPeriodoAnalise');
    
    if (sliderPeriodoAnaliseEl) {
        // Função auxiliar para atualizar período de análise
        const atualizarPeriodoAnalise = () => {
            // Obter limites baseados no tipo de bateria
            const tipoBateriaEl = document.querySelector('input[name="tipoBateria"]:checked');
            const tipoBateriaAtual = tipoBateriaEl ? tipoBateriaEl.value : 'litio';
            const vidaUtilMaxima = tipoBateriaAtual === 'litio' ? 25 : 5;
            const minPeriodo = vidaUtilMaxima;
            const maxPeriodo = vidaUtilMaxima * 4;
            
            // Atualizar limites do slider primeiro
            sliderPeriodoAnaliseEl.min = minPeriodo.toString();
            sliderPeriodoAnaliseEl.max = maxPeriodo.toString();
            
            // Obter valor atual do slider
            const valor = parseInt(sliderPeriodoAnaliseEl.value) || vidaUtilMaxima;
            
            // Garantir que o valor está dentro dos limites
            const valorLimitado = Math.max(minPeriodo, Math.min(maxPeriodo, valor));
            
            // Atualizar slider e input
            sliderPeriodoAnaliseEl.value = valorLimitado.toString();
            if (inputPeriodoAnaliseEl) {
                inputPeriodoAnaliseEl.value = valorLimitado.toString();
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPeriodoAnaliseEl);
            }
            
            // Atualizar gráfico
            atualizarInterface();
        };
        
        // Event listener para quando o slider é arrastado (input)
        sliderPeriodoAnaliseEl.addEventListener('input', throttleFn(atualizarPeriodoAnalise, 100));
        
        // Event listener para quando o slider é solto (change)
        sliderPeriodoAnaliseEl.addEventListener('change', atualizarPeriodoAnalise);
    }
    
    if (inputPeriodoAnaliseEl) {
        inputPeriodoAnaliseEl.addEventListener('focus', (e) => e.target.select());
        
        // Função auxiliar para processar valor do input manual
        const processarValorInputPeriodo = () => {
            const valor = parseInt(inputPeriodoAnaliseEl.value);
            if (!isNaN(valor) && valor > 0) {
                // Obter limites baseados no tipo de bateria
                const tipoBateriaEl = document.querySelector('input[name="tipoBateria"]:checked');
                const tipoBateriaAtual = tipoBateriaEl ? tipoBateriaEl.value : 'litio';
                const vidaUtilMaxima = tipoBateriaAtual === 'litio' ? 25 : 5;
                const minPeriodo = vidaUtilMaxima;
                const maxPeriodo = vidaUtilMaxima * 4;
                
                // Atualizar limites do slider primeiro
                if (sliderPeriodoAnaliseEl) {
                    sliderPeriodoAnaliseEl.min = minPeriodo.toString();
                    sliderPeriodoAnaliseEl.max = maxPeriodo.toString();
                }
                
                // Garantir que o valor está dentro dos limites
                const valorLimitado = Math.max(minPeriodo, Math.min(maxPeriodo, valor));
                
                // Atualizar slider e input
                if (sliderPeriodoAnaliseEl) {
                    sliderPeriodoAnaliseEl.value = valorLimitado.toString();
                }
                inputPeriodoAnaliseEl.value = valorLimitado.toString();
                if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPeriodoAnaliseEl);
                
                // Atualizar gráfico
                atualizarInterface();
            }
        };
        
        inputPeriodoAnaliseEl.addEventListener('input', throttleFn(processarValorInputPeriodo, 200));
        
        inputPeriodoAnaliseEl.addEventListener('blur', () => {
            const valor = parseInt(inputPeriodoAnaliseEl.value);
            if (isNaN(valor) || valor <= 0) {
                // Se valor inválido, restaurar valor do slider
                if (sliderPeriodoAnaliseEl) {
                    const valorSlider = parseInt(sliderPeriodoAnaliseEl.value) || 25;
                    inputPeriodoAnaliseEl.value = valorSlider.toString();
                    if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPeriodoAnaliseEl);
                }
            } else {
                processarValorInputPeriodo();
            }
        });
    }

    // 5. Sincronizar valores iniciais dos inputs com os sliders
    // Garante que os inputs exibam os valores corretos dos sliders ao carregar
    if (sliderConsumo && inputConsumo) {
        inputConsumo.value = sliderConsumo.value;
        if (typeof ajustarTamanhoInput === 'function') {
            const valorInicial = parseInt(sliderConsumo.value) || 200;
            const folga = valorInicial >= 100 ? 4 : 3;
            ajustarTamanhoInput(inputConsumo, folga);
        }
    }
    if (sliderAutonomia && inputAutonomia) {
        inputAutonomia.value = sliderAutonomia.value;
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAutonomia);
    }
    
    // Descrições de informação usando função padronizada
    if (typeof inicializarIconeInfo === 'function') {
        inicializarIconeInfo('infoIconConsumo', 'descricaoConsumo');
        inicializarIconeInfo('infoIconAutonomia', 'descricaoAutonomia');
        inicializarIconeInfo('infoIconVidaUtil', 'descricaoVidaUtil');
        inicializarIconeInfo('infoIconPrecoKWh', 'descricaoPrecoKWh');
        inicializarIconeInfo('infoIconAumentoAnualEnergia', 'descricaoAumentoAnualEnergia');
        inicializarIconeInfo('infoIconPrecoBateriaKWh', 'descricaoPrecoBateriaKWh');
        inicializarIconeInfo('infoIconPeriodoAnalise', 'descricaoPeriodoAnalise');
    }
    if (sliderVidaUtil && inputVidaUtil) {
        inputVidaUtil.value = Math.round(parseFloat(sliderVidaUtil.value));
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputVidaUtil);
    }
    // Sincronizar preço kWh com valor padrão baseado no idioma
    const sliderPrecoKWhInit = document.getElementById('sliderPrecoKWh');
    const inputPrecoKWhInit = document.getElementById('inputPrecoKWh');
    const unidadePrecoKWhInit = document.getElementById('unidadePrecoKWh');
    if (sliderPrecoKWhInit && inputPrecoKWhInit) {
        const valorPadrao = PRECO_KWH[idiomaAtual] || PRECO_KWH['pt-BR'];
        sliderPrecoKWhInit.value = valorPadrao.toFixed(2);
        inputPrecoKWhInit.value = formatarDecimalComVirgula(valorPadrao, 2);
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPrecoKWhInit);
    }
    if (unidadePrecoKWhInit) {
        unidadePrecoKWhInit.textContent = idiomaAtual === 'it-IT' ? '€' : 'R$';
    }
    
    // Sincronizar aumento anual do custo da energia
    const sliderAumentoAnualEnergiaInit = document.getElementById('sliderAumentoAnualEnergia');
    const inputAumentoAnualEnergiaInit = document.getElementById('inputAumentoAnualEnergia');
    const notaAumentoAnualEnergiaInit = document.getElementById('notaAumentoAnualEnergia');
    if (sliderAumentoAnualEnergiaInit && inputAumentoAnualEnergiaInit) {
        const valorPadraoAumento = AUMENTO_ANUAL_ENERGIA[idiomaAtual] || AUMENTO_ANUAL_ENERGIA['pt-BR'];
        // Limites: 1/5 e 5x do valor padrão
        const minValorAumento = valorPadraoAumento / 5;
        const maxValorAumento = valorPadraoAumento * 5;
        sliderAumentoAnualEnergiaInit.min = (Math.floor(minValorAumento / 0.1) * 0.1).toFixed(1);
        sliderAumentoAnualEnergiaInit.max = (Math.ceil(maxValorAumento / 0.1) * 0.1).toFixed(1);
        sliderAumentoAnualEnergiaInit.value = valorPadraoAumento.toFixed(1);
        inputAumentoAnualEnergiaInit.value = formatarDecimalComVirgula(valorPadraoAumento, 1);
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputAumentoAnualEnergiaInit);
    }
    if (notaAumentoAnualEnergiaInit) {
        const chaveNota = idiomaAtual === 'pt-BR' ? 'nota-aumento-anual-energia-pt' : 'nota-aumento-anual-energia-it';
        notaAumentoAnualEnergiaInit.textContent = traducoes[idiomaAtual]?.[chaveNota] || '';
    }
    
    // Sincronizar período de análise do gráfico com valor padrão baseado no tipo de bateria
    const sliderPeriodoAnaliseInit = document.getElementById('sliderPeriodoAnalise');
    const inputPeriodoAnaliseInit = document.getElementById('inputPeriodoAnalise');
    if (sliderPeriodoAnaliseInit && inputPeriodoAnaliseInit) {
        const tipoBateriaEl = document.querySelector('input[name="tipoBateria"]:checked');
        const tipoBateriaAtual = tipoBateriaEl ? tipoBateriaEl.value : 'litio';
        const vidaUtilMaxima = tipoBateriaAtual === 'litio' ? 25 : 5;
        
        // Limites: min = 1x vida útil máxima, max = 4x vida útil máxima
        sliderPeriodoAnaliseInit.min = vidaUtilMaxima.toString();
        sliderPeriodoAnaliseInit.max = (vidaUtilMaxima * 4).toString();
        
        // Valor padrão: 1x vida útil máxima
        sliderPeriodoAnaliseInit.value = vidaUtilMaxima.toString();
        inputPeriodoAnaliseInit.value = vidaUtilMaxima.toString();
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPeriodoAnaliseInit);
    }
    
    // Sincronizar preço bateria por kWh com valor padrão baseado no tipo de bateria e idioma
    const sliderPrecoBateriaKWhInit = document.getElementById('sliderPrecoBateriaKWh');
    const inputPrecoBateriaKWhInit = document.getElementById('inputPrecoBateriaKWh');
    const unidadePrecoBateriaKWhInit = document.getElementById('unidadePrecoBateriaKWh');
    if (sliderPrecoBateriaKWhInit && inputPrecoBateriaKWhInit) {
        // Obter tipo de bateria selecionado
        const tipoBateriaEl = document.querySelector('input[name="tipoBateria"]:checked');
        const tipoBateria = tipoBateriaEl ? tipoBateriaEl.value : 'litio';
        
        // Selecionar preço baseado no tipo de bateria
        const precosBateria = tipoBateria === 'chumbo' ? PRECO_BATERIA_KWH_CHUMBO : PRECO_BATERIA_KWH_LITIO;
        const valorPadraoBateria = precosBateria[idiomaAtual] || precosBateria['pt-BR'];
        
        // Atualizar constante global para compatibilidade
        PRECO_BATERIA_KWH[idiomaAtual] = valorPadraoBateria;
        
        sliderPrecoBateriaKWhInit.value = Math.round(valorPadraoBateria).toString();
        inputPrecoBateriaKWhInit.value = Math.round(valorPadraoBateria).toString();
        if (typeof ajustarTamanhoInput === 'function') ajustarTamanhoInput(inputPrecoBateriaKWhInit);
    }
    if (unidadePrecoBateriaKWhInit) {
        unidadePrecoBateriaKWhInit.textContent = idiomaAtual === 'it-IT' ? '€' : 'R$';
    }
    
    // Atualizar notas de valores padrão
    atualizarNotasValoresPadrao();
    
    // 6. Inicializar
    trocarIdioma(idiomaAtual);
    
    // 7. Atualizar especificações das baterias nos botões
    atualizarEspecsBaterias();
    
    // 8. Calcular valores iniciais
    // Usa setTimeout para garantir que todos os elementos estejam completamente carregados
    setTimeout(() => {
        atualizarInterface();
    }, 100);
    
    // 10. Garantir que os gráficos sejam atualizados após um pequeno delay // que o Chart.js seja carregado e os elementos estejam prontos
    setTimeout(() => {
        // Recalcula para garantir que os gráficos sejam atualizados
        atualizarInterface();
    }, 800);
    } catch (error) {
        console.error('Erro na inicialização do app Energia Solar:', error);
        alert('Erro ao inicializar o app. Por favor, recarregue a página.');
    }
});
// FUNÇÕES DO MEMORIAL DE CÁLCULO
// Atualiza as fórmulas do memorial de cálculo conforme o idioma selecionado
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
// Alterna a exibição do memorial de cálculo
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
// Atualiza o memorial de cálculo com os valores atuais dos cálculos
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
    
    // Calcular inversor com MPPT integrado
    // Primeiro calcula potência mínima baseada no consumo de pico
    const consumoMedioHorario = energiaDiaria / 24;
    const consumoPico = consumoMedioHorario * FATOR_PICO_CONSUMO;
    let potenciaInversor = Math.max(1, Math.ceil(consumoPico));
    
    // Calcula corrente máxima necessária para os painéis
    const potenciaTotalPaineis = qtdPaineis * config.potenciaPainel;
    const tensaoBanco = batSpec.v;
    const correnteMaximaNecessaria = potenciaTotalPaineis / tensaoBanco; // inversor escolhido tem capacidade MPPT suficiente
    // Se não tiver, aumenta a potência do inversor até encontrar um com MPPT adequado
    let capacidadeMPPTIntegrado = obterCapacidadeMPPTIntegrado(potenciaInversor);
    while (capacidadeMPPTIntegrado < correnteMaximaNecessaria && potenciaInversor < 10) {
        potenciaInversor += 1; // Aumenta em 1kW
        capacidadeMPPTIntegrado = obterCapacidadeMPPTIntegrado(potenciaInversor);
    }
    
    // Se ainda não encontrou inversor adequado, usa o maior disponível
    if (capacidadeMPPTIntegrado < correnteMaximaNecessaria) {
        const maiorInversor = PRECOS_INVERSOR_BRL[PRECOS_INVERSOR_BRL.length - 1];
        potenciaInversor = maiorInversor.kw;
        capacidadeMPPTIntegrado = maiorInversor.mpptA;
    }
    
    // A corrente MPPT é a capacidade integrada do inversor escolhido
    const correnteMPPT = capacidadeMPPTIntegrado;
    
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
        // Calcula corrente máxima necessária para o exemplo
        const potenciaTotalPaineisExemplo = qtdPaineis * config.potenciaPainel;
        const correnteMaximaNecessariaExemplo = potenciaTotalPaineisExemplo / tensaoBanco;
        exemploInversor.textContent = `Consumo diário ${formatarNumero(energiaDiaria)} kWh → ${formatarNumero(energiaDiaria)}÷24 = ${formatarNumero(consumoMedioHorario)} kW/h × ${FATOR_PICO_CONSUMO} = ${formatarNumero(consumoPico)} kW pico → Inversor de ${potenciaInversor} kW com MPPT ${formatarNumeroComSufixo(correnteMPPT, 0)}A integrado`;
    }
    
    const exemploMPPT = document.getElementById('memorial-exemplo-mppt');
    if (exemploMPPT) {
        const potenciaTotalPaineisExemplo = qtdPaineis * config.potenciaPainel;
        const correnteMaximaNecessariaExemplo = potenciaTotalPaineisExemplo / tensaoBanco;
        exemploMPPT.textContent = `${qtdPaineis} painéis × ${formatarNumeroComSufixo(config.potenciaPainel, 0)}W = ${formatarNumeroComSufixo(potenciaTotalPaineisExemplo, 0)}W ÷ ${tensaoBanco}V = ${formatarNumeroComSufixo(correnteMaximaNecessariaExemplo, 1)}A necessários → Inversor ${potenciaInversor}kW escolhido tem MPPT ${formatarNumeroComSufixo(correnteMPPT, 0)}A integrado (adequado)`;
    }
    
    const exemploCustos = document.getElementById('memorial-exemplo-custos');
    if (exemploCustos) {
        // Converter preços para a moeda do idioma
        const fatorConversao = idiomaAtual === 'pt-BR' ? 1 : 1 / TAXA_BRL_EUR;
        const precoPainelConvertido = config.precoPainel * fatorConversao;
        
        // Obter preço ajustável da bateria por kWh do slider
        const sliderPrecoBateriaKWh = document.getElementById('sliderPrecoBateriaKWh');
        const inputPrecoBateriaKWh = document.getElementById('inputPrecoBateriaKWh');
        // Obter tipo de bateria selecionado para determinar preço padrão
        const tipoBateriaRadioMemorial = document.querySelector('input[name="tipoBateria"]:checked');
        const tipoBateriaMemorial = tipoBateriaRadioMemorial ? tipoBateriaRadioMemorial.value : 'litio';
        const precosBateriaMemorial = tipoBateriaMemorial === 'chumbo' ? PRECO_BATERIA_KWH_CHUMBO : PRECO_BATERIA_KWH_LITIO;
        const valorPadraoBateria = precosBateriaMemorial[idiomaAtual] || precosBateriaMemorial['pt-BR'];
        
        // Atualizar constante global para compatibilidade
        PRECO_BATERIA_KWH[idiomaAtual] = valorPadraoBateria;
        
        let precoBateriaPorKWh;
        if (sliderPrecoBateriaKWh && inputPrecoBateriaKWh) {
            const valorInput = parseFloat(inputPrecoBateriaKWh.value);
            const valorSlider = parseFloat(sliderPrecoBateriaKWh.value);
            precoBateriaPorKWh = !isNaN(valorInput) && valorInput > 0 ? valorInput : (!isNaN(valorSlider) && valorSlider > 0 ? valorSlider : valorPadraoBateria);
        } else {
            precoBateriaPorKWh = valorPadraoBateria;
        }
        
        const precoBateriaAjustado = precoBateriaPorKWh * energiaPorBateria;
        const precoBateriaConvertido = precoBateriaAjustado * fatorConversao;
        const moedaCalculo = moeda === 'R$' ? 'BRL' : 'EUR';
        const custoPaineis = qtdPaineis * precoPainelConvertido;
        const custoBaterias = qtdBaterias * precoBateriaConvertido;
        const custoInversor = calcularPrecoInversor(potenciaInversor, moedaCalculo);
        // MPPT está integrado no inversor, então não há custo separado
        const custoTotal = custoPaineis + custoBaterias + custoInversor;
        exemploCustos.textContent = `${qtdPaineis} painéis × ${formatarMoeda(precoPainelConvertido)} + ${qtdBaterias} baterias × ${formatarMoeda(precoBateriaConvertido)} + inversor com MPPT integrado ${formatarMoeda(custoInversor)} = ${formatarMoeda(custoPaineis)} + ${formatarMoeda(custoBaterias)} + ${formatarMoeda(custoInversor)} = ${formatarMoeda(custoTotal)}`;
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
    if (resumoInversor) {
        // Mostra potência do inversor com MPPT integrado
        resumoInversor.textContent = `${potenciaInversor} kW (MPPT ${formatarNumeroComSufixo(correnteMPPT, 0)}A integrado)`;
    }
    
    const resumoMPPT = document.getElementById('resumo-mppt');
    if (resumoMPPT) {
        // MPPT está integrado no inversor
        resumoMPPT.textContent = formatarNumeroComSufixo(correnteMPPT, 0) + ' A (integrado)';
    }
}

