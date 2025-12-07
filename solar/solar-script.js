// ============================================
// CALCULADORA SOLAR
// ============================================
//
// Comentários didáticos em Português - Visão geral do algoritmo
// -------------------------------------------------------------
// Objetivo: dado um consumo médio mensal (kWh), dias de autonomia e
// uma escolha de tecnologia de bateria (AGM ou LiFePO4), calcular um
// sistema fotovoltaico off-grid recomendado contendo:
//  - número de baterias (e sua capacidade total instalada, em kWh),
//  - número de painéis solares (quantidade × potência por painel),
//  - potência do inversor (kW),
//  - estimativa de custo baseada em preços unitários.
//
// Entrada (UI):
//  - consumo médio mensal (kWh)
//  - dias de autonomia (quantos dias o sistema deve suprir sem sol)
//  - vida útil desejada (anos) → traduzido em ciclos por ano → usado
//    para calcular um DoD (Depth of Discharge) alvo aceitável para
//    proteger a bateria e alcançar a vida útil desejada.
//  - escolha do tipo de bateria (AGM / Litio)
//  - configuração do fabricante (potência do painel, capacidade/peso/valor das baterias)
//
// Passo-a-passo do cálculo (resumido):
// 1) Determinar energia diária média = consumo mensal / 30 (kWh/dia).
// 2) A partir da vida útil desejada (anos) determinamos ciclos aproximados
//    = anos × 365. A partir de tabelas de ciclos vs DoD escolhemos um DoD
//    diário alvo (ex: 50%). DoD menor → mais capacidade nominal necessária.
// 3) Capacidade nominal necessária (kWh): calcula-se tanto pelo critério
//    "vida útil" (energia diária ÷ DoD) quanto pelo critério "autonomia"
//    (energia diária × dias de autonomia ÷ DoD). O requisito final é o
//    máximo desses dois (para atender ambos os critérios).
// 4) Determina-se energia entregue por uma unidade de bateria (kWh). Se
//    a bateria estiver configurada em Ah (retrocompatibilidade), convertendo
//    via tensão (V × Ah / 1000 → kWh). Em seguida: número de módulos =
//    ceil(capacidadeNecessária / kWhPorBateria). Para tensões 24/48 preferimos
//    números pares (paridade) — por isso incrementamos se necessário.
// 5) Capacidade real instalada = qtdBaterias × energiaPorBateria.
// 6) Energia utilizável do banco = capacidadeReal × DoD (kWh).
// 7) Necessidade de geração diária dos painéis = energiaUtilizavelBanco / eficiênciaSistema
//    (considerando perdas). Com Horas de Sol Pleno (HSP) conhecidas, calcula-se
//    a potência requerida em Watts e o número de painéis (ceil(potenciaNecessaria / W_por_painel)).
// 8) Inversor: dimensionamos com base na potência necessária dos painéis em kW
//    (mínimo 1 kW), e usamos uma tabela com preços por faixa para estimativa
//    do custo do inversor (interpolando quando necessário).
// 9) Custos: soma dos painéis (quantidade × preço por painel), baterias
//    (qtd × preço unitário), e inversor. Para visualização, convertemos para
//    a moeda do idioma (BRL/€) usando TAXA_BRL_EUR quando necessário.
//
// Observações de design e compatibilidade:
// - Mantemos compatibilidade com configurações antigas que guardavam
//   capacidade em Ah (por exemplo 100 Ah); nestes casos o código converte
//   Ah → kWh usando a tensão informada.
// - O algoritmo tenta ser conservador: arredonda para cima (ceil) e
//   garante paridade física (pareamento para tensões mais altas) para facilitar
//   montagem prática do banco de baterias.
// - As tabelas CICLOS_AGM e CICLOS_LITIO mapeiam cycles → DoD com interpolação
//   linear quando necessário (veja obterDoDPorCiclos / obterCiclosPorDoD).
//
// O arquivo preserva a lógica existente mas adiciona documentação para facilitar
// entendimento por estudantes e colaboradores.

// Variável que guarda o idioma atual (Português ou Italiano)
// Padroniza a chave localStorage para o mesmo usado pelo restante do projeto
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido', SOLAR_CONFIG_KEY: 'configSolar' };
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) ? SiteConfig.SELECTORS : { HOME_BUTTON: '.home-button-fixed', LANG_BTN: '.lang-btn', APP_ICON: '.app-icon', ARROW_BTN: '.arrow-btn', BUTTON_ACTION: '.btn-acao' };
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || (typeof SiteConfig !== 'undefined' ? SiteConfig.DEFAULTS.language : 'pt-BR');

// ============================================
// CONSTANTES DO SISTEMA (Valores Fixos)
// ============================================

const HSP = 5.0; // Horas de Sol Pleno
const EFICIENCIA_SISTEMA = 0.80; // Eficiência global (perdas de 20%)

// Taxa de conversão BRL → EUR (aproximada, can be centralized in SiteConfig)
const TAXA_BRL_EUR = (typeof SiteConfig !== 'undefined' && SiteConfig.DEFAULTS && SiteConfig.DEFAULTS.TAXA_BRL_EUR) ? SiteConfig.DEFAULTS.TAXA_BRL_EUR : 6.19;

// ============================================
// VALORES PADRÃO DOS COMPONENTES (em BRL)
// ============================================
// Defaults updated to use battery capacity in kWh (common off-grid modules)
// Choice rationale: common modular LiFePO4 packs for off-grid use are
// frequently 48V x 100Ah ≈ 4.8 kWh. AGM typical small deep-cycle 12V 100Ah ≈ 1.2 kWh.
// Prices are approximate market values (BRL) for typical modules.
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

// Função para calcular preço do inversor por interpolação
// ------------------------------------------------------
// Explicação deste algoritmo:
// Recebe uma potência em kW e retorna um preço estimado consultando
// uma tabela de pontos (kw, preco). Se a potência estiver fora dos
// limites da tabela, fazemos extrapolação linear na extremidade.
// Se estiver entre dois pontos, interpolamos linearmente. Isso fornece
// um valor razoável para potências intermediárias sem precisar de uma
// tabela completa para cada possível kW.
function calcularPrecoInversor(potenciaKw, moeda) {
    const tabela = moeda === 'BRL' ? PRECOS_INVERSOR_BRL : PRECOS_INVERSOR_EUR;
    
    // Se menor ou igual ao menor da tabela
    if (potenciaKw <= tabela[0].kw) {
        return tabela[0].preco;
    }
    
    // Se maior que o maior da tabela, extrapola linearmente
    if (potenciaKw >= tabela[tabela.length - 1].kw) {
        const ultimo = tabela[tabela.length - 1];
        const penultimo = tabela[tabela.length - 2];
        const precoPorKw = (ultimo.preco - penultimo.preco) / (ultimo.kw - penultimo.kw);
        return ultimo.preco + (potenciaKw - ultimo.kw) * precoPorKw;
    }
    
    // Interpola entre os pontos da tabela
    for (let i = 0; i < tabela.length - 1; i++) {
        const p1 = tabela[i];
        const p2 = tabela[i + 1];
        
        if (potenciaKw >= p1.kw && potenciaKw <= p2.kw) {
            const razao = (potenciaKw - p1.kw) / (p2.kw - p1.kw);
            return p1.preco + razao * (p2.preco - p1.preco);
        }
    }
    
    return tabela[tabela.length - 1].preco;
}

// ============================================
// DICIONÁRIO DE TRADUÇÃO
// ============================================
const traducoes = {
    'pt-BR': {
        'app-title': '☀️ Solar',
        'app-subtitle': 'Dimensionamento de Sistema Fotovoltaico',
        'label-consumo': 'Consumo Médio Mensal',
        'label-autonomia': 'Dias de Autonomia',
        'label-tipo-bateria': 'Tipo de Bateria',
        'opt-chumbo': 'Chumbo-Ácido (Gel/VRLA)',
        'opt-litio': 'Lítio (LiFePO4)',
        'label-vida-util': 'Vida Útil Desejada',
        'results-title': 'Sistema Recomendado',
        'res-placas': 'Placas Solares',
        'res-baterias': 'Baterias',
        'res-inversor': 'Inversor',
        'res-onda-pura': 'Onda Senoidal Pura',
        'res-peso': 'Peso das Baterias',
        'res-estimativa': 'Estimativa de Custo',
        'custos-titulo': 'Detalhamento de Custos',
        'custo-total': 'Total',
        'footer': 'Solar - Engenharia NATA © 2025',
        'dias': 'dias',
        'dia': 'dia',
        'anos': 'anos',
        'ano': 'ano',
        'moeda': 'R$'
        , 'aria-home': 'Voltar para a tela inicial'
    },
    'it-IT': {
        'app-title': '☀️ Solare',
        'app-subtitle': 'Dimensionamento Impianto Fotovoltaico',
        'label-consumo': 'Consumo Medio Mensile',
        'label-autonomia': 'Giorni di Autonomia',
        'label-tipo-bateria': 'Tipo di Batteria',
        'opt-chumbo': 'Piombo-Acido (Gel/AGM)',
        'opt-litio': 'Litio (LiFePO4)',
        'label-vida-util': 'Vita Utile Desiderata',
        'results-title': 'Sistema Consigliato',
        'res-placas': 'Pannelli Solari',
        'res-baterias': 'Batterie',
        'res-inversor': 'Inverter',
        'res-onda-pura': 'Onda Sinusoidale Pura',
        'res-peso': 'Peso Batterie',
        'res-estimativa': 'Costo Stimato',
        'custos-titulo': 'Dettaglio Costi',
        'custo-total': 'Totale',
        'footer': 'Solare - Engenharia NATA © 2025',
        'dias': 'giorni',
        'dia': 'giorno',
        'anos': 'anni',
        'ano': 'anno',
        'moeda': '€'
        , 'aria-home': 'Torna alla schermata iniziale'
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
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (traducoes[novoIdioma][key]) {
            el.textContent = traducoes[novoIdioma][key];
        }
    });

    document.querySelectorAll('.btn-idioma').forEach(btn => {
        if (btn.getAttribute('data-lang') === novoIdioma) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    atualizarInterface();

    // Atualiza aria-label do botão home
    const homeLabel = traducoes[novoIdioma]['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
}

// ============================================
// FUNÇÃO: CALCULAR DESCARGA PERMITIDA (DoD)
// ============================================
// O objetivo aqui é derivar um DoD diário aceitável a partir do número
// de ciclos que queremos obter da bateria. As tabelas (CICLOS_AGM,
// CICLOS_LITIO) ligam ciclo → DoD. A função faz interpolação linear
// entre pontos da tabela para um resultado suave.
function obterDoDPorCiclos(ciclos, tipo) {
    const dados = tipo === 'litio' ? CICLOS_LITIO : CICLOS_AGM;
    
    if (ciclos >= dados[0].c) return dados[0].dod; // Mínimo DoD = 25%
    if (ciclos <= dados[dados.length - 1].c) return dados[dados.length - 1].dod; // Máximo DoD = 95%

    for (let i = 0; i < dados.length - 1; i++) {
        const p1 = dados[i];
        const p2 = dados[i+1];
        
        if (ciclos <= p1.c && ciclos >= p2.c) {
            const razao = (ciclos - p2.c) / (p1.c - p2.c);
            return p2.dod + razao * (p1.dod - p2.dod);
        }
    }
    return 50;
}

// ============================================
// FUNÇÃO: CALCULAR CICLOS POR DoD (inversa)
// ============================================
// Esta função é a inversa da anterior: recebe um DoD (%) e retorna
// o número aproximado de ciclos esperados. Também usa interpolação
// linear entre pontos da tabela. É útil para mostrar como alterar o
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
// ============================================
// FUNÇÃO: AJUSTAR VALORES (Botões de Seta)
// ============================================
// Os botões +/- da interface chamam esta função para aumentar ou diminuir
// um valor ligado a um ID de slider/text input. Aqui aplicamos limites,
// arredondamento e atualizamos a interface para refletir a mudança.
function ajustarValor(targetId, step) {
    const slider = document.getElementById(targetId);
    let valor = parseFloat(slider.value) || 0;
    
    valor += step;
    
    // Respeita os limites do slider
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    
    if (valor < min) valor = min;
    if (valor > max) valor = max;
    
    // Arredonda para evitar problemas de ponto flutuante
    slider.value = Math.round(valor * 10) / 10;
    
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
    // 1. Ler valores dos sliders
    const sliderConsumo = document.getElementById('sliderConsumo');
    const sliderAutonomia = document.getElementById('sliderAutonomia');
    const sliderVidaUtil = document.getElementById('sliderVidaUtil');
    const tipoBateria = document.querySelector('input[name="tipoBateria"]:checked').value;
    
    const consumo = parseInt(sliderConsumo.value);
    const autonomia = parseInt(sliderAutonomia.value);
    
    // 2. Ajustar limites do slider de Vida Útil baseado no tipo de bateria
    if (tipoBateria === 'litio') {
        sliderVidaUtil.min = "5";
        sliderVidaUtil.max = "25";
    } else {
        sliderVidaUtil.min = "1";
        sliderVidaUtil.max = "5";
    }
    
    // 3. Corrigir valor se estiver fora dos limites
    let vidaUtil = parseFloat(sliderVidaUtil.value);
    const minVida = parseFloat(sliderVidaUtil.min);
    const maxVida = parseFloat(sliderVidaUtil.max);
    
    if (vidaUtil < minVida) {
        vidaUtil = minVida;
        sliderVidaUtil.value = vidaUtil;
    }
    if (vidaUtil > maxVida) {
        vidaUtil = maxVida;
        sliderVidaUtil.value = vidaUtil;
    }

    // 4. Atualizar displays de valor
    document.getElementById('valConsumo').textContent = `${consumo} kWh`;
    
    const textoDias = autonomia === 1 ? 
        (idiomaAtual === 'pt-BR' ? 'dia' : 'giorno') : 
        (idiomaAtual === 'pt-BR' ? 'dias' : 'giorni');
    document.getElementById('valAutonomia').textContent = `${autonomia} ${textoDias}`;

    const textoAnos = vidaUtil === 1 ?
        (idiomaAtual === 'pt-BR' ? 'ano' : 'anno') :
        (idiomaAtual === 'pt-BR' ? 'anos' : 'anni');
    document.getElementById('valVidaUtil').textContent = `${vidaUtil} ${textoAnos}`;

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
// 2) Ler config customizada (ou defaults) — suporta formatos antigos
//    (capacidade em Ah) convertendo para kWh quando necessário.
// 3) Calcular capacidade necessária por dois critérios: vida útil e
//    autonomia; escolher o máximo dos dois.
// 4) Calcular número de baterias (ceil) e ajustar paridade prática.
// 5) Calcular painéis necessários considerando eficiência do sistema
//    e horas de sol pleno (HSP).
// 6) Dimensionar inversor e estimar custos. Finalmente preenche o DOM
//    com os resultados formatados para o idioma atual.
//
// A função tenta ser transparente: também gera frases explicativas
// (motivos) para cada dimensão (baterias, painéis, inversor), que são
// mostradas na UI para educar o usuário sobre o porquê dos números.
function calcularSistema(dodAlvo) {
    const consumoMensal = parseFloat(document.getElementById('sliderConsumo').value) || 0;
    const autonomia = parseInt(document.getElementById('sliderAutonomia').value);
    const tipoBateria = document.querySelector('input[name="tipoBateria"]:checked').value;

    // Obter configuração customizada ou padrão
    const config = obterConfig();
    // Backwards compatibility: older configs stored capacity in Ah (e.g. 100)
    // If capacity seems too large (>20) interpret as Ah and convert to kWh using voltage
    if (config.capacidadeLitio && config.capacidadeLitio > 20 && config.tensaoLitio) {
        config.capacidadeLitioAh = config.capacidadeLitio; // preserve older value
        config.capacidadeLitio = (config.tensaoLitio * config.capacidadeLitio) / 1000; // convert to kWh
    }
    if (config.capacidadeAGM && config.capacidadeAGM > 20 && config.tensaoAGM) {
        config.capacidadeAGMAh = config.capacidadeAGM;
        config.capacidadeAGM = (config.tensaoAGM * config.capacidadeAGM) / 1000; // kWh
    }
    
    // Montar especificações das baterias baseado na config
    // Support capacity expressed as kWh (new default) but remain compatible
    // with older config that used Ah (capacidade in Ah). Prefer explicit kWh.
    const batSpec = (tipoBateria === 'litio')
        ? { v: config.tensaoLitio, kwh: config.capacidadeLitio, ah: config.capacidadeLitioAh || null, price_brl: config.precoLitio, weight: config.pesoLitio }
        : { v: config.tensaoAGM, kwh: config.capacidadeAGM, ah: config.capacidadeAGMAh || null, price_brl: config.precoAGM, weight: config.pesoAGM };
    
    const POTENCIA_PAINEL = config.potenciaPainel;
    const PRECO_PAINEL = config.precoPainel;

    if (consumoMensal <= 0) {
        // Zera resultados se consumo inválido
        ['resQtdPlacas', 'resQtdBaterias', 'resPotenciaInversor', 'resPesoBaterias'].forEach(id => {
            document.getElementById(id).textContent = '0';
        });
        document.getElementById('resPrecoEstimado').textContent = `${traducoes[idiomaAtual]['moeda']} 0`;
        return;
    }

    // 1. Energia Diária
    const energiaDiaria = consumoMensal / 30; // kWh
    
    // 2. Dimensionamento Baterias
    // O DoD escolhido (via slider de vida útil) afeta AMBOS os critérios:
    // - Quanto menor o DoD, mais baterias são necessárias para a mesma energia utilizável
    // - O DoD limita quanto da capacidade nominal pode ser usada
    
    // Critério A: Vida Útil (capacidade nominal para 1 dia de consumo com DoD alvo)
    // Se consumo diário = 10 kWh e DoD = 50%, preciso de 10/0.5 = 20 kWh nominais
    const capVidaUtil = energiaDiaria / dodAlvo;
    
    // Critério B: Autonomia (capacidade nominal para N dias com o MESMO DoD)
    // Se autonomia = 3 dias, consumo = 10 kWh/dia, DoD = 50%:
    // Energia total necessária = 10 * 3 = 30 kWh utilizáveis
    // Capacidade nominal = 30 / 0.5 = 60 kWh
    const energiaAutonomia = energiaDiaria * autonomia; // kWh utilizáveis necessários
    const capAutonomia = energiaAutonomia / dodAlvo;    // kWh nominais necessários
    
    // Escolhe o maior requisito (o gargalo)
    const capacidadeNecessariaKWh = Math.max(capVidaUtil, capAutonomia);
    
    // Calcula energia por bateria
    // energiaPorBateria: if kWh provided use it; else if Ah provided fallback to V*Ah/1000
    const energiaPorBateria = (typeof batSpec.kwh === 'number' && !isNaN(batSpec.kwh))
        ? batSpec.kwh
        : ((batSpec.v && batSpec.ah) ? (batSpec.v * batSpec.ah) / 1000 : 0);
    
    // Calcula quantidade (arredonda para cima e garante paridade para 24V/48V)
    let qtdBaterias = Math.ceil(capacidadeNecessariaKWh / energiaPorBateria);
    if (qtdBaterias % 2 !== 0 && qtdBaterias > 1) qtdBaterias++; // Preferência por pares
    
    // Capacidade real do banco de baterias instalado
    const capacidadeRealKWh = qtdBaterias * energiaPorBateria;
    
    // 3. Dimensionamento Painéis
    // Os painéis precisam gerar energia suficiente para:
    // - Recarregar o banco de baterias (o que foi consumido) em 1 dia de sol
    // 
    // A energia a recarregar é o que foi descarregado = capacidade * DoD
    // Isso já inclui o consumo diário, pois o banco foi dimensionado para isso
    const energiaUtilizavelBanco = capacidadeRealKWh * dodAlvo;
    
    // Energia que os painéis devem gerar por dia (considerando perdas do sistema)
    const energiaTotalGerar = energiaUtilizavelBanco / EFICIENCIA_SISTEMA;
    
    const potenciaSolarNecessaria = (energiaTotalGerar * 1000) / HSP; // Watts
    const qtdPaineis = Math.ceil(potenciaSolarNecessaria / POTENCIA_PAINEL);
    
    // 4. Inversor
    // Deve aguentar a potência dos painéis + margem para picos
    const potenciaInversor = Math.max(1, Math.ceil(potenciaSolarNecessaria / 1000)); // Mínimo 1kW
    
    // 5. Peso e Custo
    const pesoTotal = qtdBaterias * batSpec.weight;
    
    // Conversão de moeda: config salva em BRL, converter para EUR se italiano
    const moedaCalculo = idiomaAtual === 'pt-BR' ? 'BRL' : 'EUR';
    const fatorConversao = idiomaAtual === 'pt-BR' ? 1 : 1 / TAXA_BRL_EUR;
    
    // Preços convertidos para a moeda do idioma
    const precoPainelConvertido = PRECO_PAINEL * fatorConversao;
    const precoBateriaConvertido = batSpec.price_brl * fatorConversao;
    
    const custoPaineis = qtdPaineis * precoPainelConvertido;
    const custoBaterias = qtdBaterias * precoBateriaConvertido;
    const custoInversor = calcularPrecoInversor(potenciaInversor, moedaCalculo);
    const custoTotal = custoPaineis + custoBaterias + custoInversor;

    // 6. Exibir Resultados
    document.getElementById('resQtdPlacas').textContent = `${qtdPaineis} x ${POTENCIA_PAINEL}W`;
    // Exibe quantas unidades do módulo escolhido (kWh e tensão)
    const unidadeKWh = (typeof batSpec.kwh === 'number' ? batSpec.kwh.toFixed(1) : (batSpec.ah ? ((batSpec.v * batSpec.ah)/1000).toFixed(1) : '0.0'));
    document.getElementById('resQtdBaterias').textContent = `${qtdBaterias} x ${unidadeKWh} kWh (${batSpec.v}V)`;
    document.getElementById('resPotenciaInversor').textContent = `${potenciaInversor} kW`;
    document.getElementById('resPesoBaterias').textContent = `${pesoTotal} kg`;
    
    const moeda = traducoes[idiomaAtual]['moeda'];
    const formatarPreco = (valor) => `${moeda} ${valor.toLocaleString(idiomaAtual, {minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true})}`;
    
    // Exibir custos detalhados
    document.getElementById('resPrecoEstimado').textContent = formatarPreco(custoTotal);
    document.getElementById('custoPaineis').textContent = formatarPreco(custoPaineis);
    document.getElementById('custoBaterias').textContent = formatarPreco(custoBaterias);
    document.getElementById('custoInversor').textContent = formatarPreco(custoInversor);
    
    // Motivo do dimensionamento das BATERIAS — explicita parâmetros que geraram o gargalo
    // Ex: autonomia X dias × consumoDiario Y kWh → utilizável necessário Z kWh → DoD alvo W% → capacidade nominal necessária T kWh → módulos M × S kWh
    let motivoBaterias = '';
    const consumoDiario = energiaDiaria; // kWh/dia
    const capNecessariaRounded = Math.round(capacidadeNecessariaKWh * 100) / 100;
    const energiaPorBatRounded = Math.round(energiaPorBateria * 100) / 100;

    if (autonomia > 1) {
        if (idiomaAtual === 'pt-BR') {
            motivoBaterias = `(gargalo: autonomia) ${autonomia} dia(s) × ${consumoDiario.toFixed(3)} kWh/dia → utilizável necessário ${energiaAutonomia.toFixed(3)} kWh → DoD alvo ${Math.round(dodAlvo * 100)}% → capacidade nominal necessária ${capNecessariaRounded} kWh → ${qtdBaterias} × ${energiaPorBatRounded} kWh`;
        } else {
            motivoBaterias = `(limite: autonomia) ${autonomia} giorno(i) × ${consumoDiario.toFixed(3)} kWh/giorno → utilizzabile necessario ${energiaAutonomia.toFixed(3)} kWh → DoD target ${Math.round(dodAlvo * 100)}% → capacità nominale necessaria ${capNecessariaRounded} kWh → ${qtdBaterias} × ${energiaPorBatRounded} kWh`;
        }
    } else {
        // Quando autonomia === 1, o dimensionamento vem da vida útil / DoD desejado
        if (idiomaAtual === 'pt-BR') {
            motivoBaterias = `(gargalo: vida útil) DoD alvo ${Math.round(dodAlvo * 100)}% → energia diária ${consumoDiario.toFixed(3)} kWh → capacidade nominal necessária ${capNecessariaRounded} kWh → ${qtdBaterias} × ${energiaPorBatRounded} kWh`;
        } else {
            motivoBaterias = `(limite: vita utile) DoD target ${Math.round(dodAlvo * 100)}% → energia giornaliera ${consumoDiario.toFixed(3)} kWh → capacità nominale necessaria ${capNecessariaRounded} kWh → ${qtdBaterias} × ${energiaPorBatRounded} kWh`;
        }
    }
    document.getElementById('resMotivoBaterias').textContent = motivoBaterias;
    
    // Motivo do dimensionamento dos PAINÉIS — explicita porque exigem essa potência (recarga do banco)
    const energiaUtilBancoRounded = Math.round(energiaUtilizavelBanco * 100) / 100;
    const energiaTotalGerarRounded = Math.round(energiaTotalGerar * 100) / 100;
    const potenciaReqRounded = Math.round(potenciaSolarNecessaria);
    let motivoPaineis = '';
    if (idiomaAtual === 'pt-BR') {
        motivoPaineis = `(gargalo: recarga do banco) banco fornece ${energiaUtilBancoRounded} kWh utilizáveis → com perdas ${energiaTotalGerarRounded} kWh/dia → potência requerida ≈ ${potenciaReqRounded} W → ${qtdPaineis} × ${POTENCIA_PAINEL}W`;
    } else {
        motivoPaineis = `(limite: ricarica banco) banco fornisce ${energiaUtilBancoRounded} kWh utilizzabili → con perdite ${energiaTotalGerarRounded} kWh/giorno → potenza richiesta ≈ ${potenciaReqRounded} W → ${qtdPaineis} × ${POTENCIA_PAINEL}W`;
    }
    document.getElementById('resMotivoPaineis').textContent = motivoPaineis;
    
    // Motivo do dimensionamento do INVERSOR — mostra se é limite mínimo ou potência dos painéis
    const potenciaPaineisKw = (qtdPaineis * POTENCIA_PAINEL) / 1000;
    const potenciaMinimaKw = 1;
    let motivoInversor = '';
    if (potenciaInversor === potenciaMinimaKw && potenciaPaineisKw < potenciaMinimaKw) {
        if (idiomaAtual === 'pt-BR') {
            motivoInversor = `(gargalo: mínimo 1kW) potência dos painéis ${potenciaPaineisKw.toFixed(2)} kW < mínimo exigido ${potenciaMinimaKw} kW`;
        } else {
            motivoInversor = `(limite: minimo 1kW) potenza pannelli ${potenciaPaineisKw.toFixed(2)} kW < minimo richiesto ${potenciaMinimaKw} kW`;
        }
    } else {
        if (idiomaAtual === 'pt-BR') {
            motivoInversor = `(gargalo: potência painéis) painéis fornecem ${potenciaPaineisKw.toFixed(2)} kW → inversor dimensionado ${potenciaInversor} kW`;
        } else {
            motivoInversor = `(limite: potenza pannelli) pannelli forniscono ${potenciaPaineisKw.toFixed(2)} kW → inverter dimensionado ${potenciaInversor} kW`;
        }
    }
    document.getElementById('resMotivoInversor').textContent = motivoInversor;
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Configurar botões de idioma
    document.querySelectorAll('.btn-idioma').forEach(btn => {
        btn.addEventListener('click', () => {
            trocarIdioma(btn.getAttribute('data-lang'));
        });
    });

    // 2. Configurar botões de seta (Arrow Buttons)
    document.querySelectorAll(SITE_SEL.ARROW_BTN).forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        const step = parseFloat(btn.getAttribute('data-step'));

        // Função para iniciar a repetição
        const startRepeating = () => {
            ajustarValor(targetId, step); // Primeiro clique imediato
            
            timeoutId = setTimeout(() => {
                intervalId = setInterval(() => {
                    ajustarValor(targetId, step);
                }, 100); // Repete a cada 100ms
            }, 500); // Espera 500ms antes de começar a repetir
        };

        // Função para parar a repetição
        const stopRepeating = () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
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
    ['sliderConsumo', 'sliderAutonomia', 'sliderVidaUtil'].forEach(id => {
        document.getElementById(id).addEventListener('input', atualizarInterface);
    });

    // 4. Configurar Radio Buttons (Tipo de Bateria)
    document.querySelectorAll('input[name="tipoBateria"]').forEach(radio => {
        radio.addEventListener('change', atualizarInterface);
    });

    // 5. Inicializar
    trocarIdioma(idiomaAtual);

    // Ripple helper is provided by /ripple.js (global attachRippleTo)
    // ripple attachments centralized in ripple-init.js
});
