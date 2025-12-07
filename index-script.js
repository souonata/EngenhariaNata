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

/**
 * Idioma ativo no momento
 * Tenta carregar do localStorage, senão usa português como padrão
 */
// Support centralized keys if SiteConfig is present
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) ? SiteConfig.LOCAL_STORAGE : { LANGUAGE_KEY: 'idiomaPreferido', SOLAR_CONFIG_KEY: 'configSolar' };
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) ? SiteConfig.SELECTORS : { HOME_BUTTON: '.home-button-fixed', LANG_BTN: '.lang-btn', APP_ICON: '.app-icon', ARROW_BTN: '.arrow-btn', BUTTON_ACTION: '.btn-acao' };
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || (typeof SiteConfig !== 'undefined' ? SiteConfig.DEFAULTS.language : 'pt-BR');

/**
 * Dicionário de traduções
 * Estrutura: traducoes[idioma][chave] = texto traduzido
 */
const traducoes = {
    'pt-BR': {
        // Nomes dos aplicativos
        'app-about': 'Sobre mim',
        'app-helice': 'Hélice',
        'app-mutuo': 'Financiamento',
        'app-solar': 'Solar',
        
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
        'aria-home': 'Voltar para a tela inicial'
    },
    'it-IT': {
        // Nomes dos aplicativos em italiano
        'app-about': 'Su di me',
        'app-helice': 'Elica',
        'app-mutuo': 'Mutuo',
        'app-solar': 'Solare',
        
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
        'aria-home': 'Torna alla schermata iniziale'
    }
};

/**
 * Troca o idioma da interface
 * @param {string} novoIdioma - Código do idioma ('pt-BR' ou 'it-IT')
 */
function trocarIdioma(novoIdioma) {
    // Atualiza a variável global do idioma
    idiomaAtual = novoIdioma;
    
    // Salva no localStorage para manter entre páginas
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    
    // Atualiza o atributo lang do HTML (boas práticas de acessibilidade)
    document.documentElement.lang = novoIdioma;
    
    // Busca todos os elementos que têm o atributo data-i18n
    // (são os elementos que precisam ser traduzidos)
    const elementosTraduzir = document.querySelectorAll('[data-i18n]');
    
    // Para cada elemento que precisa tradução
    elementosTraduzir.forEach(elemento => {
        // Pega a chave de tradução (ex: "app-about", "app-mutuo")
        const chave = elemento.getAttribute('data-i18n');
        
        // Se existe tradução para essa chave no idioma atual
        if (traducoes[novoIdioma] && traducoes[novoIdioma][chave]) {
            // Substitui o texto do elemento pela tradução
            elemento.textContent = traducoes[novoIdioma][chave];
        }
    });
    
    // Atualiza os botões de idioma (destaca o ativo)
    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(botao => {
        if (botao.getAttribute('data-lang') === novoIdioma) {
            botao.classList.add('active');
        } else {
            botao.classList.remove('active');
        }
    });
    
    // Atualiza o relógio com os dias da semana no idioma correto
    atualizarHorario();

    // Update home button aria-labels (accessibility)
    const homeLabel = traducoes[novoIdioma]['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(el => el.setAttribute('aria-label', homeLabel));
}

/**
 * Atualiza o horário e data mostrados na barra de status do celular simulado
 * Mostra hora completa (HH:MM:SS) à esquerda e data (Dia DD/MM) à direita
 * Executa a cada 1 segundo para manter o relógio sincronizado
 */
function atualizarHorario() {
    // Pega os elementos HTML onde horário e data vão aparecer
    const elementoHorario = document.getElementById('horario');
    const elementoData = document.getElementById('data');
    
    // Cria um objeto Date com a hora atual do sistema
    const agora = new Date();
    
    // Pega as horas (0-23)
    // String() converte para texto
    // padStart(2, '0') adiciona zero à esquerda se necessário (ex: "9" vira "09")
    const horas = String(agora.getHours()).padStart(2, '0');
    
    // Pega os minutos (0-59) e formata igual às horas
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    
    // Pega os segundos (0-59)
    const segundos = String(agora.getSeconds()).padStart(2, '0');
    
    // Array com os dias da semana traduzidos
    const diasSemana = [
        traducoes[idiomaAtual]['dia-dom'],
        traducoes[idiomaAtual]['dia-seg'],
        traducoes[idiomaAtual]['dia-ter'],
        traducoes[idiomaAtual]['dia-qua'],
        traducoes[idiomaAtual]['dia-qui'],
        traducoes[idiomaAtual]['dia-sex'],
        traducoes[idiomaAtual]['dia-sab']
    ];
    const diaSemana = diasSemana[agora.getDay()];
    
    // Array com os meses traduzidos
    const meses = [
        traducoes[idiomaAtual]['mes-jan'],
        traducoes[idiomaAtual]['mes-fev'],
        traducoes[idiomaAtual]['mes-mar'],
        traducoes[idiomaAtual]['mes-abr'],
        traducoes[idiomaAtual]['mes-mai'],
        traducoes[idiomaAtual]['mes-jun'],
        traducoes[idiomaAtual]['mes-jul'],
        traducoes[idiomaAtual]['mes-ago'],
        traducoes[idiomaAtual]['mes-set'],
        traducoes[idiomaAtual]['mes-out'],
        traducoes[idiomaAtual]['mes-nov'],
        traducoes[idiomaAtual]['mes-dez']
    ];
    const mesAbreviado = meses[agora.getMonth()];
    
    // Pega o dia do mês (1-31) SEM zero à esquerda
    const dia = agora.getDate();
    
    // Atualiza horário (esquerda) e data (direita) separadamente
    elementoHorario.textContent = `${horas}:${minutos}:${segundos}`;
    elementoData.textContent = `${diaSemana} ${dia} ${mesAbreviado}`;
}

// ============================================
// INICIALIZAÇÃO QUANDO A PÁGINA CARREGA
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Inicializa com o idioma salvo ou português
    trocarIdioma(idiomaAtual);
    
    // Adiciona event listeners nos botões de idioma
    document.getElementById('btnPT').addEventListener('click', () => trocarIdioma('pt-BR'));
    document.getElementById('btnIT').addEventListener('click', () => trocarIdioma('it-IT'));
    
    // Atualiza o horário assim que a página carrega
    atualizarHorario();
    
    // Atualiza a cada 1 segundo (1000 milissegundos) para mostrar os segundos mudando
    // setInterval executa a função repetidamente no intervalo especificado
    setInterval(atualizarHorario, 1000);
});

// ============================================
// EFEITO DE TOQUE NOS ÍCONES (Mobile)
// ============================================

// Ripple helper is now shared in /ripple.js (attachRippleTo is global)
// Attach ripples to common interactive elements in the launcher
// ripple attachments are centralized in ripple-init.js; no per-page attach needed here
