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
        'app-helice': 'Hélice',
        'app-mutuo': 'Financiamento',
        'app-solar': 'Energia Solar',
        'app-bitola': 'Bitola',
        'app-arcondicionado': 'Ar Condicionado',
        'app-aquecimento': 'Aquecedor Solar',
        'app-fazenda': 'Fazenda',
        'dev-badge': 'DEV',
        'apps-description-title': 'Aplicativos Disponíveis',
        'apps-description-subtitle': 'Ferramentas práticas para cálculos de engenharia e finanças',
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
        'app-fazenda-description': 'Planejador completo de fazenda auto-sustentável. Calcula espaço necessário, quantidade de plantas (frutas, verduras, legumes) e animais necessários para alimentar uma família. Inclui calendário de plantio/colheita e frequência de reprodução dos animais para manter produção contínua.',
        'app-link-use': 'Usar calculadora →',
        
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
        'footer': '💻 Portfólio Engenharia NATA @ 2025'
    },
    'it-IT': {
        // Nomes dos aplicativos em italiano
        'app-about': 'Su di me',
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
        'app-fazenda-description': 'Pianificatore completo di fattoria auto-sostenibile. Calcola lo spazio necessario, quantità di piante (frutta, verdura, legumi) e animali necessari per nutrire una famiglia. Include calendario di semina/raccolta e frequenza di riproduzione degli animali per mantenere produzione continua.',
        'app-link-use': 'Usa calcolatrice →',
        
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
function trocarIdioma(novoIdioma) {
    // Atualiza a variável global e salva a preferência
    idiomaAtual = novoIdioma;
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    
    // Atualiza o atributo lang do HTML (ajuda leitores de tela)
    document.documentElement.lang = novoIdioma;
    
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
    atualizarHorario();
    const homeLabel = traducoes[novoIdioma]?.['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(function(elemento) {
        elemento.setAttribute('aria-label', homeLabel);
    });
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
 */
function atualizarHorario() {
    // Obtém elementos HTML e data/hora atual
    const elementoHorario = document.getElementById('horario');
    const elementoData = document.getElementById('data');
    const agora = new Date();
    
    // Formata horas, minutos e segundos (adiciona zero à esquerda se necessário)
    const horas = String(agora.getHours()).padStart(2, '0');
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    const segundos = String(agora.getSeconds()).padStart(2, '0');
    
    // Array com nomes dos dias da semana traduzidos
    // getDay() retorna: 0=domingo, 1=segunda, 2=terça, etc.
    const diasSemana = [
        traducoes[idiomaAtual]?.['dia-dom'] || 'Dom',
        traducoes[idiomaAtual]?.['dia-seg'] || 'Seg',
        traducoes[idiomaAtual]?.['dia-ter'] || 'Ter',
        traducoes[idiomaAtual]?.['dia-qua'] || 'Qua',
        traducoes[idiomaAtual]?.['dia-qui'] || 'Qui',
        traducoes[idiomaAtual]?.['dia-sex'] || 'Sex',
        traducoes[idiomaAtual]?.['dia-sab'] || 'Sáb'
    ];
    const diaSemana = diasSemana[agora.getDay()];
    
    // Array com nomes dos meses traduzidos
    // getMonth() retorna: 0=janeiro, 1=fevereiro, 2=março, etc.
    const meses = [
        traducoes[idiomaAtual]?.['mes-jan'] || 'Jan',
        traducoes[idiomaAtual]?.['mes-fev'] || 'Fev',
        traducoes[idiomaAtual]?.['mes-mar'] || 'Mar',
        traducoes[idiomaAtual]?.['mes-abr'] || 'Abr',
        traducoes[idiomaAtual]?.['mes-mai'] || 'Mai',
        traducoes[idiomaAtual]?.['mes-jun'] || 'Jun',
        traducoes[idiomaAtual]?.['mes-jul'] || 'Jul',
        traducoes[idiomaAtual]?.['mes-ago'] || 'Ago',
        traducoes[idiomaAtual]?.['mes-set'] || 'Set',
        traducoes[idiomaAtual]?.['mes-out'] || 'Out',
        traducoes[idiomaAtual]?.['mes-nov'] || 'Nov',
        traducoes[idiomaAtual]?.['mes-dez'] || 'Dez'
    ];
    const mesAbreviado = meses[agora.getMonth()];
    const dia = agora.getDate();
    
    // Atualiza o conteúdo dos elementos HTML
    elementoHorario.textContent = `${horas}:${minutos}:${segundos}`;
    elementoData.textContent = `${diaSemana} ${dia} ${mesAbreviado}`;
}

// ============================================
// INICIALIZAÇÃO QUANDO A PÁGINA CARREGA
// ============================================
// DOMContentLoaded = evento que acontece quando o HTML foi completamente carregado
// Isso garante que todos os elementos existem antes de tentar usá-los
document.addEventListener('DOMContentLoaded', function() {
    // Inicializa a interface com o idioma salvo (ou português se não houver)
    trocarIdioma(idiomaAtual);
    
    // Adiciona event listeners nos botões de idioma
    document.getElementById('btnPortugues').addEventListener('click', function() {
        trocarIdioma('pt-BR');
    });
    
    document.getElementById('btnItaliano').addEventListener('click', function() {
        trocarIdioma('it-IT');
    });
    
    // Atualiza o horário imediatamente e configura atualização automática a cada segundo
    atualizarHorario();
    setInterval(atualizarHorario, 1000);
});

// ============================================
// EFEITO DE TOQUE NOS ÍCONES (Mobile)
// ============================================

