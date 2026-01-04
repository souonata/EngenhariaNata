// Chaves do localStorage
const SITE_LS = (typeof SiteConfig !== 'undefined' && SiteConfig.LOCAL_STORAGE) 
    ? SiteConfig.LOCAL_STORAGE
    : { 
        LANGUAGE_KEY: 'idiomaPreferido',
        SOLAR_CONFIG_KEY: 'configSolar'
      };
// Seletores CSS
const SITE_SEL = (typeof SiteConfig !== 'undefined' && SiteConfig.SELECTORS) 
    ? SiteConfig.SELECTORS
    : { 
        HOME_BUTTON: '.home-button-fixed',
        LANG_BTN: '.lang-btn',
        APP_ICON: '.app-icon',
        ARROW_BTN: '.arrow-btn',
        BUTTON_ACTION: '.btn-acao'
      };
// Carrega idioma salvo ou usa 'pt-BR' como padrão
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) 
    || (typeof SiteConfig !== 'undefined' 
        ? SiteConfig.DEFAULTS.language
        : 'pt-BR');
// Dicionário de traduções para português e italiano
const traducoes = {
    'pt-BR': {
        // Nomes dos aplicativos
        'app-about': 'Sobre mim',
        'app-bugs': 'Reportar Bug',
        'app-helice': 'Hélice',
        'app-mutuo': 'Financiamento',
        'app-solar': 'Energia Solar',
        'app-bitola': 'Bitola',
        'app-arcondicionado': 'Ar Condicionado',
        'app-aquecimento': 'Aquecedor Solar',
        'app-fazenda': 'Fazenda',
        'apps-description-title': 'Aplicativos Disponíveis',
        'apps-description-subtitle': 'Ferramentas práticas para cálculos de engenharia e finanças',
        'app-about-title': 'Sobre mim',
        'app-about-description': 'Informações sobre o projeto Engenharia NATA, tecnologias utilizadas, estatísticas do código e objetivos educacionais. Conheça mais sobre os apps e o desenvolvimento deste portfólio.',
        'app-mutuo-title': 'Financiamento - Calculadora de Empréstimos',
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
// Troca o idioma da interface
function trocarIdioma(novoIdioma) {
    idiomaAtual = novoIdioma;
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    document.documentElement.lang = novoIdioma;
    
    // Traduz elementos com atributo data-i18n
    const elementosTraduzir = document.querySelectorAll('[data-i18n]');
    elementosTraduzir.forEach(function(elemento) {
        const chave = elemento.getAttribute('data-i18n');
        if (traducoes[novoIdioma] && traducoes[novoIdioma][chave]) {
            elemento.textContent = traducoes[novoIdioma][chave];
        }
    });
    
    // Marca botão do idioma ativo com classe 'active'
    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(function(botao) {
        if (botao.getAttribute('data-lang') === novoIdioma) {
            botao.classList.add('active');
        } else {
            botao.classList.remove('active');
        }
    });
    
    // Atualiza relógio e aria-labels
    atualizarHorario();
    const homeLabel = traducoes[novoIdioma]?.['aria-home'] || 'Home';
    document.querySelectorAll(SITE_SEL.HOME_BUTTON).forEach(function(elemento) {
        elemento.setAttribute('aria-label', homeLabel);
    });
}
// Atualiza horário e data na barra de status
function atualizarHorario() {
    const elementoHorario = document.getElementById('horario');
    const elementoData = document.getElementById('data');
    
    if (!elementoHorario || !elementoData) {
        return;
    }
    
    const agora = new Date();
    
    // Formata horário com zero à esquerda
    const horas = String(agora.getHours()).padStart(2, '0');
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    const segundos = String(agora.getSeconds()).padStart(2, '0');
    
    // Traduz dias da semana
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
    
    // Arrays de tradução para meses
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
    
    // Atualiza elementos na página
    elementoHorario.textContent = `${horas}:${minutos}:${segundos}`;
    elementoData.textContent = `${diaSemana} ${dia} ${mesAbreviado}`;
}
// Inicializa a página quando DOM estiver pronto
function inicializar() {
    const elementoHorario = document.getElementById('horario');
    const elementoData = document.getElementById('data');
    const btnPortugues = document.getElementById('btnPortugues');
    const btnItaliano = document.getElementById('btnItaliano');
    
    // Aguarda elementos estarem disponíveis
    if (!elementoHorario || !elementoData || !btnPortugues || !btnItaliano) {
        setTimeout(inicializar, 100);
        return;
    }
    
    trocarIdioma(idiomaAtual);
    atualizarHorario();
    
    // Botão de idioma português
    btnPortugues.addEventListener('click', function() {
        trocarIdioma('pt-BR');
    });
    
    // Botão de idioma italiano
    btnItaliano.addEventListener('click', function() {
        trocarIdioma('it-IT');
    });
    
    // Atualiza relógio a cada segundo
    setInterval(atualizarHorario, 1000);
    
    adicionarVersoesNosIcones();
}
// Inicia quando DOM estiver carregado
if (document.readyState === 'loading') {
    // DOM ainda não carregou completamente
    document.addEventListener('DOMContentLoaded', inicializar);
} else {
    // DOM já está pronto
    inicializar();
}
// Versões dos aplicativos
const versoesApps = {
    'sobre': '1.0.0',
    'bitola': '1.2.0',
    'helice': '1.6.0',
    'mutuo': '1.2.0',
    'bugs': '1.0.0',
    'arcondicionado': '0.2.0',
    'aquecimento': '0.2.0',
    'solar': '0.20.0',
    'fazenda': '0.1.0'
}; // Adiciona badges de versão nos ícones dos apps
function adicionarVersoesNosIcones() {
    const hrefParaApp = {
        'sobre/sobre.html': 'sobre',
        'bitola/bitola.html': 'bitola',
        'helice/helice.html': 'helice',
        'mutuo/mutuo.html': 'mutuo',
        'bugs/bugs.html': 'bugs',
        'arcondicionado/arcondicionado.html': 'arcondicionado',
        'aquecimento/aquecimento.html': 'aquecimento',
        'solar/solar.html': 'solar',
        'fazenda/fazenda.html': 'fazenda'
    };
    
    const appIcons = document.querySelectorAll('.app-icon');
    
    appIcons.forEach(function(appIcon) {
        const href = appIcon.getAttribute('href');
        if (!href) return;
        
        const appKey = hrefParaApp[href];
        if (!appKey || !versoesApps[appKey]) return;
        
        const iconDiv = appIcon.querySelector('.icon');
        if (!iconDiv) return;
        
        const svg = iconDiv.querySelector('svg');
        if (!svg) return;
        
        // Evita duplicação
        if (svg.querySelector('.version-text')) return;
        
        // Cria badge de versão no SVG
        const versionText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        versionText.setAttribute('class', 'version-text');
        versionText.setAttribute('x', '30');
        versionText.setAttribute('y', '56');
        versionText.setAttribute('text-anchor', 'middle');
        versionText.setAttribute('font-size', '8');
        versionText.setAttribute('font-weight', '500');
        versionText.setAttribute('fill', 'rgba(255, 255, 255, 0.85)');
        versionText.setAttribute('style', 'filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));');
        versionText.textContent = `V. ${versoesApps[appKey]}`;
        
        svg.appendChild(versionText);
    });
} // Adiciona efeitos visuais de toque para mobile

