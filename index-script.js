// ============================================
// RELÓGIO DA BARRA DE STATUS & SISTEMA DE I18N
// Atualiza o horário exibido em tempo real e fornece internacionalização
// ============================================
//
// Visão geral - internacionalização (i18n) e relógio
// -------------------------------------------------
// Esta página funciona como a 'launcher' do portfólio e fornece duas
// funcionalidades interligadas:
// 1) Sistema simples de i18n: elementos que precisam ser traduzidos usam
//    o atributo `data-i18n` com uma chave. O dicionário `traducoes` mapeia
//    cada idioma para o texto correspondente. A função trocarIdioma atualiza
//    todos os elementos com essa chave, salva a preferência em localStorage
//    e também atualiza atributos de acessibilidade (ex.: aria-labels).
// 2) Relógio: atualiza horas, minutos, segundos e uma data humanizada usando
//    as traduções para dias/meses. O relógio é atualizado a cada segundo via
//    setInterval, e usa padStart/formatting para manter a exibição estável.
//
// Observações:
// - A chave de idioma é padronizada via SiteConfig.LOCAL_STORAGE quando
//   disponível (garante consistência entre páginas do portfólio).
// - A função atualizarHorario usa arrays traduzidos de dias/meses para
//   apresentar uma data localizada (ex: 'segunda 7 dezembro').

// ============================================
// SISTEMA DE INTERNACIONALIZAÇÃO (i18n)
// Suporta Português do Brasil (pt-BR) e Italiano (it-IT)
// ============================================

// ============================================
// CONFIGURAÇÃO DE CHAVES E SELETORES
// ============================================
// Verifica se o arquivo site-config.js foi carregado
// Se sim, usa as configurações centralizadas
// Se não, usa valores padrão como fallback (compatibilidade)

// SITE_LS: Chaves usadas no localStorage (armazenamento do navegador)
// typeof SiteConfig !== 'undefined' = verifica se SiteConfig existe
// Se existe, usa SiteConfig.LOCAL_STORAGE
// Se não existe, cria um objeto com valores padrão
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) 
    ? SiteConfig.LOCAL_STORAGE  // Usa configuração centralizada
    : { 
        LANGUAGE_KEY: 'idiomaPreferido',      // Chave para guardar idioma
        SOLAR_CONFIG_KEY: 'configSolar'       // Chave para guardar config do Solar
      };

// SITE_SEL: Seletores CSS para encontrar elementos na página
// Mesma lógica: usa SiteConfig se disponível, senão usa valores padrão
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) 
    ? SiteConfig.SELECTORS  // Usa seletores centralizados
    : { 
        HOME_BUTTON: '.home-button-fixed',    // Botão para voltar ao início
        LANG_BTN: '.lang-btn',                // Botões de idioma
        APP_ICON: '.app-icon',                // Ícones dos apps
        ARROW_BTN: '.arrow-btn',              // Botões de seta
        BUTTON_ACTION: '.btn-acao'            // Botões de ação
      };

// Idioma ativo no momento
// Tenta carregar do localStorage, senão usa português como padrão
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) 
    || (typeof SiteConfig !== 'undefined' 
        ? SiteConfig.DEFAULTS.language
        : 'pt-BR');

/**
 * Dicionário de traduções
 * Estrutura: traducoes[idioma][chave] = texto traduzido
 */
const traducoes = {
    'pt-BR': {
        // Nomes dos aplicativos
        'app-about': 'Sobre mim',
        'app-bugs': 'Reportar Bug',
        'app-helice': 'Hélice',
        'app-mutuo': 'Mutuo',
        'app-solar': 'Energia Solar',
        'app-bitola': 'Bitola',
        'app-arcondicionado': 'Ar Condicionado',
        'app-aquecimento': 'Aquecedor Solar',
        'app-fazenda': 'Fazenda',
        'apps-description-title': 'Aplicativos Disponíveis',
        'apps-description-subtitle': 'Ferramentas práticas para cálculos de engenharia e finanças',
        'app-about-title': 'Sobre mim',
        'app-about-description': 'Informações sobre o projeto Engenharia NATA, tecnologias utilizadas, estatísticas do código e objetivos educacionais. Conheça mais sobre os apps e o desenvolvimento deste portfólio.',
        'app-mutuo-title': 'Mutuo - Calculadora de Empréstimos',
        'app-mutuo-description': 'Calculadora bilíngue (PT/IT) de sistemas de amortização: SAC, Price e Americano. Inclui gráficos interativos, tabela de amortização completa e comparação de juros totais. Ideal para planejamento financeiro e análise de empréstimos.',
        'app-helice-title': 'Hélice - Calculadora de Passo',
        'app-helice-description': 'Calculadora de passo de hélice para barcos de lazer. Determina o passo ideal baseado em RPM máximo, velocidade desejada e análise de slip. Inclui gráficos de relação velocidade × passo para otimização de performance náutica.',
        'app-solar-title': 'Energia Solar - Dimensionamento Fotovoltaico',
        'app-solar-description': 'Dimensionamento completo de sistemas fotovoltaicos off-grid. Calcula número de painéis solares, capacidade de baterias (AGM e LiFePO4), inversor necessário e autonomia do sistema. Inclui página de configuração personalizável para ajustar preços e especificações técnicas.',
        'app-bitola-title': 'Bitola - Calculadora de Fios Elétricos',
        'app-bitola-description': 'Calculadora de bitola de fios elétricos para circuitos CC e CA. Considera queda de tensão, corrente e distância. Seleciona automaticamente a bitola comercial padrão brasileiro (NBR 5410) que atende aos requisitos de segurança e eficiência.',
        'app-arcondicionado-title': 'Ar Condicionado - Dimensionamento',
        'app-arcondicionado-description': 'Dimensionador de sistema multi-split para ar condicionado. Calcula BTU baseado em área total (10-300 m²), número de ambientes (1-8), altura, pessoas, equipamentos e condições ambientais. Dimensiona unidades internas (até 60k BTU cada) e externas (até 180k BTU cada) com cálculo de custo estimado.',
        'app-aquecimento-title': 'Aquecedor Solar - Dimensionamento Térmico',
        'app-aquecimento-description': 'Dimensionador completo de sistemas de aquecimento solar térmico. Calcula área de coletores, volume do boiler, número de painéis e potência necessária baseado em área (m²) e classe energética. Suporta aquecimento de água de consumo e aquecimento ambiente separadamente ou combinados, considerando temperatura mínima para termossifões (48°C) e estratificação térmica.',
        'app-fazenda-title': 'Fazenda - Dimensionamento Auto-Sustentável',
        'app-fazenda-description': 'Planejador completo de fazenda auto-sustentável com banco de dados regional (Brasil e Itália). Calcula espaço necessário, quantidade de plantas (frutas, verduras, legumes) e animais necessários para alimentar uma família. Inclui separação de animais por produção: galinha (ovos), frango de corte, vaca (leite), vaca (carne), além de calendário de plantio/colheita, frequência de reprodução e informações técnicas detalhadas (clima, solo, técnicas de cultivo/criação).',
        'app-bugs-title': 'Reportar Bug',
        'app-bugs-description': 'Formulário para reportar bugs e problemas encontrados nos aplicativos. Ajude-nos a melhorar reportando erros, sugestões ou problemas de usabilidade. Informações de contato opcional para resposta.',
        'app-link-use': 'Usar calculadora →',
        'app-link-use-form': 'Usar formulário →',
        'app-link-view': 'Ver página →',
        
        // Dias da semana por extenso (minúscula)
        'dia-dom': 'domingo',
        'dia-seg': 'segunda',
        'dia-ter': 'terça',
        'dia-qua': 'quarta',
        'dia-qui': 'quinta',
        'dia-sex': 'sexta',
        'dia-sab': 'sábado',
        
        // Meses por extenso (minúscula)
        'mes-jan': 'janeiro',
        'mes-fev': 'fevereiro',
        'mes-mar': 'março',
        'mes-abr': 'abril',
        'mes-mai': 'maio',
        'mes-jun': 'junho',
        'mes-jul': 'julho',
        'mes-ago': 'agosto',
        'mes-set': 'setembro',
        'mes-out': 'outubro',
        'mes-nov': 'novembro',
        'mes-dez': 'dezembro'
        ,
        // Aria label for the home button
        'aria-home': 'Voltar para a tela inicial',
        // Footer
        'footer': '💻 Portfólio Engenharia NATA @ 2025',
        'dev-badge': 'DEV'
    },
    'it-IT': {
        // Nomes dos aplicativos em italiano
        'app-about': 'Su di me',
        'app-bugs': 'Segnala Bug',
        'app-helice': 'Elica',
        'app-mutuo': 'Mutuo',
        'app-solar': 'Energia Solare',
        'app-bitola': 'Sezione Cavi',
        'app-arcondicionado': 'Climatizzatore',
        'app-aquecimento': 'Riscaldatore Solare',
        'app-fazenda': 'Fattoria',
        'dev-badge': 'DEV',
        'apps-description-title': 'Applicazioni Disponibili',
        'apps-description-subtitle': 'Strumenti pratici per calcoli di ingegneria e finanza',
        'app-about-title': 'Su di me',
        'app-about-description': 'Informazioni sul progetto Engenharia NATA, tecnologie utilizzate, statistiche del codice e obiettivi educativi. Scopri di più sulle app e lo sviluppo di questo portafoglio.',
        'app-mutuo-title': 'Mutuo - Calcolatrice di Prestiti',
        'app-mutuo-description': 'Calcolatrice bilingue (PT/IT) di sistemi di ammortamento: SAC, Francese e Americano. Include grafici interattivi, tabella di ammortamento completa e confronto degli interessi totali. Ideale per pianificazione finanziaria e analisi di prestiti.',
        'app-helice-title': 'Elica - Calcolatrice del Passo',
        'app-helice-description': 'Calcolatrice del passo dell\'elica per barche da diporto. Determina il passo ideale basato su RPM massimo, velocità desiderata e analisi dello slittamento. Include grafici di relazione velocità × passo per ottimizzazione delle prestazioni nautiche.',
        'app-solar-title': 'Energia Solare - Dimensionamento Fotovoltaico',
        'app-solar-description': 'Dimensionamento completo di sistemi fotovoltaici off-grid. Calcola il numero di pannelli solari, capacità delle batterie (AGM e LiFePO4), inverter necessario e autonomia del sistema. Include pagina di configurazione personalizzabile per regolare prezzi e specifiche tecniche.',
        'app-bitola-title': 'Sezione Cavi - Calcolatrice di Fili Elettrici',
        'app-bitola-description': 'Calcolatrice della sezione dei fili elettrici per circuiti CC e CA. Considera caduta di tensione, corrente e distanza. Seleziona automaticamente la sezione commerciale standard che soddisfa i requisiti di sicurezza ed efficienza.',
        'app-arcondicionado-title': 'Climatizzatore - Dimensionamento',
        'app-arcondicionado-description': 'Dimensionatore di sistema multi-split per climatizzatore. Calcola BTU basato su area totale (10-300 m²), numero di ambienti (1-8), altezza, persone, apparecchiature e condizioni ambientali. Dimensiona unità interne (fino a 60k BTU ciascuna) ed esterne (fino a 180k BTU ciascuna) con calcolo del costo stimato.',
        'app-aquecimento-title': 'Riscaldatore Solare - Dimensionamento Termico',
        'app-aquecimento-description': 'Dimensionatore completo di sistemi di riscaldamento solare termico. Calcola l\'area dei collettori, volume del boiler, numero di pannelli e potenza necessaria basato su area (m²) e classe energetica. Supporta riscaldamento dell\'acqua sanitaria e riscaldamento ambiente separatamente o combinati, considerando temperatura minima per termosifoni (48°C) e stratificazione termica.',
        'app-fazenda-title': 'Fattoria - Dimensionamento Auto-Sostenibile',
        'app-fazenda-description': 'Pianificatore completo di fattoria auto-sostenibile con database regionale (Brasile e Italia). Calcola lo spazio necessario, quantità di piante (frutta, verdura, legumi) e animali necessari per nutrire una famiglia. Include separazione degli animali per produzione: gallina (uova), pollo da carne, mucca (latte), mucca (carne), oltre a calendario di semina/raccolta, frequenza di riproduzione e informazioni tecniche dettagliate (clima, suolo, tecniche di coltivazione/allevamento).',
        'app-bugs-title': 'Segnala Bug',
        'app-bugs-description': 'Modulo per segnalare bug e problemi riscontrati nelle applicazioni. Aiutaci a migliorare segnalando errori, suggerimenti o problemi di usabilità. Informazioni di contatto opzionali per risposta.',
        'app-link-use': 'Usa calcolatrice →',
        'app-link-use-form': 'Usa modulo →',
        'app-link-view': 'Vedi pagina →',
        
        // Dias da semana por extenso em italiano (minúscula)
        'dia-dom': 'domenica',
        'dia-seg': 'lunedì',
        'dia-ter': 'martedì',
        'dia-qua': 'mercoledì',
        'dia-qui': 'giovedì',
        'dia-sex': 'venerdì',
        'dia-sab': 'sabato',
        
        // Meses por extenso em italiano (minúscula)
        'mes-jan': 'gennaio',
        'mes-fev': 'febbraio',
        'mes-mar': 'marzo',
        'mes-abr': 'aprile',
        'mes-mai': 'maggio',
        'mes-jun': 'giugno',
        'mes-jul': 'luglio',
        'mes-ago': 'agosto',
        'mes-set': 'settembre',
        'mes-out': 'ottobre',
        'mes-nov': 'novembre',
        'mes-dez': 'dicembre'
        ,
        // Aria label for the home button
        'aria-home': 'Torna alla schermata iniziale',
        // Footer
        'footer': '💻 Portafoglio Ingegneria NATA @ 2025'
    }
};

/**
 * Troca o idioma da interface inteira
 * 
 * Esta função é chamada quando o usuário clica em um botão de idioma.
 * Ela atualiza todos os textos visíveis na página para o novo idioma.
 * 
 * @param {string} novoIdioma - Código do idioma ('pt-BR' para português ou 'it-IT' para italiano)
 * 
 * Como funciona:
 * 1. Atualiza a variável que guarda o idioma atual
 * 2. Salva a preferência no navegador (localStorage)
 * 3. Atualiza o atributo lang do HTML (ajuda leitores de tela)
 * 4. Busca todos os elementos com data-i18n e traduz seus textos
 * 5. Destaca o botão do idioma ativo
 * 6. Atualiza o relógio com dias/meses no idioma correto
 */
async function trocarIdioma(novoIdioma) {
    // Atualiza a variável global e salva a preferência
    idiomaAtual = novoIdioma;
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    
    // Atualiza o atributo lang do HTML (ajuda leitores de tela)
    document.documentElement.lang = novoIdioma;
    
    // Se o timezone mudou, limpa o cache para forçar nova consulta imediata
    const novoTimezone = TIMEZONES_POR_IDIOMA[novoIdioma];
    const timezoneMudou = horarioOficialCache.timezone !== novoTimezone;
    
    if (timezoneMudou) {
        horarioOficialCache = {
            timestampUTC: null,
            timestampLocal: null,
            timezone: null
        };
        ultimaConsultaAPI = 0;
    }
    
    // Busca e traduz todos os elementos com data-i18n
    const elementosTraduzir = document.querySelectorAll('[data-i18n]');
    elementosTraduzir.forEach(function(elemento) {
        const chave = elemento.getAttribute('data-i18n');
        if (traducoes[novoIdioma] && traducoes[novoIdioma][chave]) {
            elemento.textContent = traducoes[novoIdioma][chave];
        }
    });
    
    // Destaca o botão do idioma ativo
    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(function(botao) {
        if (botao.getAttribute('data-lang') === novoIdioma) {
            botao.classList.add('active');
        } else {
            botao.classList.remove('active');
        }
    });
    
    // Atualiza o relógio e rótulos de acessibilidade
    // Aguarda a atualização para garantir que o horário correto seja exibido
    await atualizarHorario();
    const homeLabel = traducoes[novoIdioma]?.['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(function(elemento) {
        elemento.setAttribute('aria-label', homeLabel);
    });
}

// ============================================
// SISTEMA DE HORÁRIO OFICIAL POR PAÍS
// ============================================
// Mapeamento de idioma para timezone oficial do país
// America/Sao_Paulo = Horário de Brasília (BRT, UTC-3)
const TIMEZONES_POR_IDIOMA = {
    'pt-BR': 'America/Sao_Paulo',  // Brasil - Horário de Brasília (BRT)
    'it-IT': 'Europe/Rome'          // Itália - Horário de Roma (CET/CEST)
};

// Cache do horário oficial
let horarioOficialCache = {
    timestampUTC: null,   // Timestamp UTC retornado pela API
    timestampLocal: null,  // Timestamp local quando a API foi consultada
    timezone: null         // Timezone usado
};

// Última vez que a API foi consultada (em milissegundos)
let ultimaConsultaAPI = 0;
const INTERVALO_CONSULTA_API = 60000; // 1 minuto

/**
 * Busca o horário oficial do país via API WorldTimeAPI
 * @param {string} timezone - Timezone no formato IANA (ex: 'America/Sao_Paulo')
 * @returns {Promise<Date|null>} - Data/hora oficial ou null se falhar
 */
async function buscarHorarioOficial(timezone) {
    try {
        const url = `https://worldtimeapi.org/api/timezone/${timezone}`;
        
        // Cria um AbortController para timeout de 5 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // A API retorna unixtime (timestamp UTC em segundos)
        // Armazenamos o timestamp UTC puro para usar com Intl.DateTimeFormat
        const unixtime = data.unixtime; // Timestamp UTC em segundos
        const timestampUTC = unixtime * 1000; // Converte para milissegundos
        
        // Cria um objeto Date para referência (mas não usamos seus métodos get*)
        const horarioOficial = new Date(timestampUTC);
        
        // Armazena o timestamp UTC puro (sem offset) e o timestamp local atual
        // Intl.DateTimeFormat aplicará o offset automaticamente quando formatarmos
        horarioOficialCache = {
            timestampUTC: timestampUTC,  // Timestamp UTC puro (sem offset)
            timestampLocal: Date.now(),  // Timestamp local quando consultamos
            timezone: timezone
        };
        
        ultimaConsultaAPI = Date.now();
        
        return horarioOficial;
    } catch (error) {
        // Em caso de erro, retorna null para usar fallback
        if (error.name !== 'AbortError') {
            console.warn('Erro ao buscar horário oficial:', error.message);
        }
        return null;
    }
}

/**
 * Obtém o horário oficial atualizado, usando cache quando possível
 * @returns {Promise<Date>} - Data/hora oficial ou horário local como fallback
 */
async function obterHorarioOficial() {
    const timezone = TIMEZONES_POR_IDIOMA[idiomaAtual];
    
    if (!timezone) {
        // Se não houver timezone mapeado, retorna null para mostrar indicador
        return null;
    }
    
    const agoraLocal = Date.now();
    const tempoDesdeUltimaConsulta = agoraLocal - ultimaConsultaAPI;
    
    // Se já temos cache válido e recente para o timezone correto, retorna Date atualizado
    if (horarioOficialCache.timestampUTC !== null && 
        horarioOficialCache.timestampLocal !== null &&
        horarioOficialCache.timezone === timezone &&
        tempoDesdeUltimaConsulta < INTERVALO_CONSULTA_API) {
        // Calcula o tempo decorrido desde a última consulta e atualiza o timestamp UTC
        const tempoDecorrido = agoraLocal - horarioOficialCache.timestampLocal;
        const timestampAtualizado = horarioOficialCache.timestampUTC + tempoDecorrido;
        return new Date(timestampAtualizado);
    }
    
    // Se não temos cache válido ou está desatualizado, busca da API
    const horarioOficial = await buscarHorarioOficial(timezone);
    
    if (horarioOficial) {
        // Retorna diretamente o horário oficial (já está no cache)
        return horarioOficial;
    }
    
    // NÃO usa cache de outro timezone - sempre busca o correto
    // Se a API falhar, retorna null para indicar que precisa tentar novamente
    return null;
}

/**
 * Atualiza o horário e data mostrados na barra de status
 * 
 * Esta função é chamada a cada segundo para manter o relógio atualizado.
 * Ela mostra:
 * - Horário completo (HH:MM:SS) à esquerda
 * - Data formatada (Dia DD Mês) à direita
 * 
 * Tudo é traduzido para o idioma atual (português ou italiano).
 * Usa horário oficial do país via API, mostra "..." enquanto carrega.
 */
async function atualizarHorario() {
    // Obtém elementos HTML
    const elementoHorario = document.getElementById('horario');
    const elementoData = document.getElementById('data');
    
    // Se os elementos não existirem, não faz nada (evita erros)
    if (!elementoHorario || !elementoData) {
        return;
    }
    
    // Busca horário oficial (com cache)
    const agora = await obterHorarioOficial();
    
    // Se não conseguiu obter horário (API falhou), mostra indicador de carregamento
    if (!agora) {
        elementoHorario.textContent = '...';
        elementoData.textContent = '...';
        return;
    }
    
    // Obtém o timezone correto para formatação
    const timezone = TIMEZONES_POR_IDIOMA[idiomaAtual];
    
    if (!timezone) {
        elementoHorario.textContent = '...';
        elementoData.textContent = '...';
        return;
    }
    
    // Usa Intl.DateTimeFormat para formatar no timezone correto, independente do navegador
    // Calcula o timestamp UTC atualizado baseado no cache
    const timestampParaFormatar = horarioOficialCache.timestampUTC !== null && 
                                   horarioOficialCache.timestampLocal !== null
        ? horarioOficialCache.timestampUTC + (Date.now() - horarioOficialCache.timestampLocal)
        : agora.getTime();
    
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    const partesHorario = formatter.formatToParts(timestampParaFormatar);
    const horas = partesHorario.find(p => p.type === 'hour').value.padStart(2, '0');
    const minutos = partesHorario.find(p => p.type === 'minute').value.padStart(2, '0');
    const segundos = partesHorario.find(p => p.type === 'second').value.padStart(2, '0');
    
    // Formata data no timezone correto
    const formatterData = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });
    
    const partesData = formatterData.formatToParts(timestampParaFormatar);
    const dia = partesData.find(p => p.type === 'day').value;
    const mesEn = partesData.find(p => p.type === 'month').value.toLowerCase();
    
    // Mapeia meses em inglês para traduções
    const mesesMap = {
        'jan': 'mes-jan', 'feb': 'mes-fev', 'mar': 'mes-mar', 'apr': 'mes-abr',
        'may': 'mes-mai', 'jun': 'mes-jun', 'jul': 'mes-jul', 'aug': 'mes-ago',
        'sep': 'mes-set', 'oct': 'mes-out', 'nov': 'mes-nov', 'dec': 'mes-dez'
    };
    
    const diaSemanaEn = partesData.find(p => p.type === 'weekday').value.toLowerCase();
    const diasMap = {
        'sun': 'dia-dom', 'mon': 'dia-seg', 'tue': 'dia-ter', 'wed': 'dia-qua',
        'thu': 'dia-qui', 'fri': 'dia-sex', 'sat': 'dia-sab'
    };
    
    const diaSemana = traducoes[idiomaAtual]?.[diasMap[diaSemanaEn]] || diaSemanaEn;
    const mesAbreviado = traducoes[idiomaAtual]?.[mesesMap[mesEn]] || mesEn;
    
    // Atualiza o conteúdo dos elementos HTML
    elementoHorario.textContent = `${horas}:${minutos}:${segundos}`;
    elementoData.textContent = `${diaSemana} ${dia} ${mesAbreviado}`;
}

// ============================================
// INICIALIZAÇÃO QUANDO A PÁGINA CARREGA
// ============================================
// DOMContentLoaded = evento que acontece quando o HTML foi completamente carregado
// Isso garante que todos os elementos existem antes de tentar usá-los

// Função de inicialização que pode ser chamada quando o DOM estiver pronto
function inicializar() {
    // Verifica se os elementos necessários existem
    const elementoHorario = document.getElementById('horario');
    const elementoData = document.getElementById('data');
    const btnPortugues = document.getElementById('btnPortugues');
    const btnItaliano = document.getElementById('btnItaliano');
    
    // Se os elementos não existirem, tenta novamente após um pequeno delay
    if (!elementoHorario || !elementoData || !btnPortugues || !btnItaliano) {
        console.warn('Elementos não encontrados, tentando novamente...');
        setTimeout(inicializar, 100);
        return;
    }
    
    // Limpa cache na inicialização para garantir busca imediata
    horarioOficialCache = {
        timestampUTC: null,
        timestampLocal: null,
        timezone: null
    };
    ultimaConsultaAPI = 0;
    
    // Mostra indicador de carregamento enquanto busca o horário
    elementoHorario.textContent = '...';
    elementoData.textContent = '...';
    
    // Inicializa a interface com o idioma salvo (ou português se não houver)
    // Aguarda para garantir que o horário seja buscado antes de continuar
    trocarIdioma(idiomaAtual).catch(err => {
        console.warn('Erro ao inicializar idioma:', err);
    });
    
    // Adiciona event listeners nos botões de idioma
    btnPortugues.addEventListener('click', async function() {
        await trocarIdioma('pt-BR');
    });
    
    btnItaliano.addEventListener('click', async function() {
        await trocarIdioma('it-IT');
    });
    
    // Configura atualização automática a cada segundo
    // Usa setInterval e armazena o ID para possível limpeza futura
    // Nota: atualizarHorario é async, mas não precisamos await no setInterval
    setInterval(function() {
        atualizarHorario().catch(err => {
            // Silenciosamente ignora erros para não poluir o console
        });
    }, 1000);
}

// Tenta inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    // DOM ainda não carregou completamente
    document.addEventListener('DOMContentLoaded', inicializar);
} else {
    // DOM já está pronto
    inicializar();
}

// ============================================
// EFEITO DE TOQUE NOS ÍCONES (Mobile)
// ============================================

