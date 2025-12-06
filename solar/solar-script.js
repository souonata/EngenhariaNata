// ============================================
// CALCULADORA SOLAR
// ============================================

// Variável que guarda o idioma atual (Português ou Italiano)
let idiomaAtual = localStorage.getItem('idiomaSolar') || 'pt-BR';

// ============================================
// CONSTANTES DO SISTEMA (Valores Fixos)
// ============================================

const HSP = 5.0; // Horas de Sol Pleno
const EFICIENCIA_SISTEMA = 0.80; // Eficiência global (perdas de 20%)

// Taxa de conversão BRL → EUR (aproximada, baseada em preços de referência 2024)
const TAXA_BRL_EUR = 6.19;

// ============================================
// VALORES PADRÃO DOS COMPONENTES (em BRL)
// ============================================
const VALORES_PADRAO = {
    potenciaPainel: 400,
    precoPainel: 1200,
    tensaoAGM: 12,
    capacidadeAGM: 100,
    precoAGM: 420,
    pesoAGM: 30,
    tensaoLitio: 12,
    capacidadeLitio: 100,
    precoLitio: 3500,
    pesoLitio: 12
};

// Função para obter configuração atual (customizada ou padrão)
function obterConfig() {
    const configSalva = localStorage.getItem('configSolar');
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
    localStorage.setItem('idiomaSolar', novoIdioma);
    document.documentElement.lang = novoIdioma;
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (traducoes[novoIdioma][key]) {
            el.textContent = traducoes[novoIdioma][key];
        }
    });

    document.querySelectorAll('.btn-idioma').forEach(btn => {
        if (btn.getAttribute('data-lang') === novoIdioma) {
            btn.classList.add('ativo');
        } else {
            btn.classList.remove('ativo');
        }
    });

    atualizarInterface();
}

// ============================================
// FUNÇÃO: CALCULAR DESCARGA PERMITIDA (DoD)
// ============================================
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
function calcularSistema(dodAlvo) {
    const consumoMensal = parseFloat(document.getElementById('sliderConsumo').value) || 0;
    const autonomia = parseInt(document.getElementById('sliderAutonomia').value);
    const tipoBateria = document.querySelector('input[name="tipoBateria"]:checked').value;

    // Obter configuração customizada ou padrão
    const config = obterConfig();
    
    // Montar especificações das baterias baseado na config
    const batSpec = tipoBateria === 'litio' 
        ? { v: config.tensaoLitio, ah: config.capacidadeLitio, price_brl: config.precoLitio, weight: config.pesoLitio }
        : { v: config.tensaoAGM, ah: config.capacidadeAGM, price_brl: config.precoAGM, weight: config.pesoAGM };
    
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
    const energiaPorBateria = (batSpec.v * batSpec.ah) / 1000; // kWh
    
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
    document.getElementById('resQtdBaterias').textContent = `${qtdBaterias} x ${batSpec.ah}Ah (${batSpec.v}V)`;
    document.getElementById('resPotenciaInversor').textContent = `${potenciaInversor} kW`;
    document.getElementById('resPesoBaterias').textContent = `${pesoTotal} kg`;
    
    const moeda = traducoes[idiomaAtual]['moeda'];
    const formatarPreco = (valor) => `${moeda} ${valor.toLocaleString(idiomaAtual, {minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true})}`;
    
    // Exibir custos detalhados
    document.getElementById('resPrecoEstimado').textContent = formatarPreco(custoTotal);
    document.getElementById('custoPaineis').textContent = formatarPreco(custoPaineis);
    document.getElementById('custoBaterias').textContent = formatarPreco(custoBaterias);
    document.getElementById('custoInversor').textContent = formatarPreco(custoInversor);
    
    // Motivo do dimensionamento das BATERIAS
    // Com a nova lógica, autonomia sempre é o fator quando > 1 dia
    // pois capAutonomia = capVidaUtil * autonomia
    let motivoBaterias = '';
    if (autonomia > 1) {
        motivoBaterias = idiomaAtual === 'pt-BR' ? '(gargalo: autonomia)' : '(limite: autonomia)';
    } else {
        motivoBaterias = idiomaAtual === 'pt-BR' ? '(gargalo: vida útil)' : '(limite: vita utile)';
    }
    document.getElementById('resMotivoBaterias').textContent = motivoBaterias;
    
    // Motivo do dimensionamento dos PAINÉIS
    // Painéis são dimensionados para recarregar o banco em 1 dia
    // O gargalo é sempre o tamanho do banco (que depende de autonomia ou vida útil)
    let motivoPaineis = idiomaAtual === 'pt-BR' ? '(recarga do banco)' : '(ricarica banco)';
    document.getElementById('resMotivoPaineis').textContent = motivoPaineis;
    
    // Motivo do dimensionamento do INVERSOR
    // Inversor precisa atender: potência dos painéis OU mínimo 1kW
    const potenciaPaineisKw = (qtdPaineis * POTENCIA_PAINEL) / 1000;
    const potenciaMinimaKw = 1;
    let motivoInversor = '';
    if (potenciaInversor === potenciaMinimaKw && potenciaPaineisKw < potenciaMinimaKw) {
        motivoInversor = idiomaAtual === 'pt-BR' ? '(gargalo: mínimo 1kW)' : '(limite: minimo 1kW)';
    } else {
        motivoInversor = idiomaAtual === 'pt-BR' ? '(gargalo: potência painéis)' : '(limite: potenza pannelli)';
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
    document.querySelectorAll('.arrow-btn').forEach(btn => {
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
});
