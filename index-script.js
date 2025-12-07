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

// idiomaAtual: Idioma que está sendo usado agora
// localStorage.getItem() = tenta pegar o idioma salvo
// || = se não encontrar, usa o valor depois do ||
// Se SiteConfig existe, usa SiteConfig.DEFAULTS.language
// Se não existe, usa 'pt-BR' como padrão
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) 
    || (typeof SiteConfig !== 'undefined' 
        ? SiteConfig.DEFAULTS.language  // Usa padrão do SiteConfig
        : 'pt-BR');                     // Usa português como último recurso

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
        'app-solar-title': 'Solar - Dimensionamento Fotovoltaico',
        'app-solar-description': 'Dimensionamento completo de sistemas fotovoltaicos off-grid. Calcula número de painéis solares, capacidade de baterias (AGM e LiFePO4), inversor necessário e autonomia do sistema. Inclui página de configuração personalizável para ajustar preços e especificações técnicas.',
        'app-bitola-title': 'Bitola - Calculadora de Fios Elétricos',
        'app-bitola-description': 'Calculadora de bitola de fios elétricos para circuitos CC e CA. Considera queda de tensão, corrente e distância. Seleciona automaticamente a bitola comercial padrão brasileiro (NBR 5410) que atende aos requisitos de segurança e eficiência.',
        'app-arcondicionado-title': 'Ar Condicionado - Dimensionamento',
        'app-arcondicionado-description': 'Calculadora para dimensionamento de ar condicionado. Determina a capacidade necessária (BTU) baseada em área, altura, número de pessoas, equipamentos e condições ambientais. Ajuda a escolher o aparelho ideal para cada ambiente.',
        'app-aquecimento-title': 'Aquecedor Solar - Dimensionamento Térmico',
        'app-aquecimento-description': 'Dimensionador completo de sistemas de aquecimento solar térmico. Calcula área de coletores, volume do boiler, número de painéis e potência necessária. Suporta aquecimento de água de consumo e aquecimento ambiente, considerando classes energéticas e dias de autonomia.',
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
        'aria-home': 'Voltar para a tela inicial'
    },
    'it-IT': {
        // Nomes dos aplicativos em italiano
        'app-about': 'Su di me',
        'app-helice': 'Elica',
        'app-mutuo': 'Mutuo',
        'app-solar': 'Solare',
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
        'app-solar-title': 'Solare - Dimensionamento Fotovoltaico',
        'app-solar-description': 'Dimensionamento completo di sistemi fotovoltaici off-grid. Calcola il numero di pannelli solari, capacità delle batterie (AGM e LiFePO4), inverter necessario e autonomia del sistema. Include pagina di configurazione personalizzabile per regolare prezzi e specifiche tecniche.',
        'app-bitola-title': 'Sezione Cavi - Calcolatrice di Fili Elettrici',
        'app-bitola-description': 'Calcolatrice della sezione dei fili elettrici per circuiti CC e CA. Considera caduta di tensione, corrente e distanza. Seleziona automaticamente la sezione commerciale standard che soddisfa i requisiti di sicurezza ed efficienza.',
        'app-arcondicionado-title': 'Climatizzatore - Dimensionamento',
        'app-arcondicionado-description': 'Calcolatrice per il dimensionamento del climatizzatore. Determina la capacità necessaria (BTU) basata su area, altezza, numero di persone, apparecchiature e condizioni ambientali. Aiuta a scegliere l\'apparecchio ideale per ogni ambiente.',
        'app-aquecimento-title': 'Riscaldatore Solare - Dimensionamento Termico',
        'app-aquecimento-description': 'Dimensionatore completo di sistemi di riscaldamento solare termico. Calcola l\'area dei collettori, volume del boiler, numero di pannelli e potenza necessaria. Supporta riscaldamento dell\'acqua sanitaria e riscaldamento ambiente, considerando classi energetiche e giorni di autonomia.',
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
        'aria-home': 'Torna alla schermata iniziale'
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
    // PASSO 1: Atualiza a variável global que guarda o idioma atual
    // Isso permite que outras funções saibam qual idioma usar
    idiomaAtual = novoIdioma;
    
    // PASSO 2: Salva a preferência no localStorage (armazenamento do navegador)
    // Isso faz com que a escolha seja lembrada mesmo depois de fechar o navegador
    // SITE_LS.LANGUAGE_KEY = 'idiomaPreferido' (chave onde guardamos)
    localStorage.setItem(SITE_LS.LANGUAGE_KEY, novoIdioma);
    
    // PASSO 3: Atualiza o atributo lang do elemento <html>
    // Isso ajuda leitores de tela e ferramentas de acessibilidade
    // a saberem qual idioma está sendo usado
    document.documentElement.lang = novoIdioma;
    
    // PASSO 4: Busca todos os elementos que precisam ser traduzidos
    // [data-i18n] = seletor CSS que encontra elementos com o atributo data-i18n
    // Exemplo: <span data-i18n="app-about">Sobre mim</span>
    const elementosTraduzir = document.querySelectorAll('[data-i18n]');
    
    // PASSO 5: Para cada elemento encontrado, traduz o texto
    elementosTraduzir.forEach(function(elemento) {
        // Pega a chave de tradução do atributo data-i18n
        // Exemplo: se data-i18n="app-about", chave = "app-about"
        const chave = elemento.getAttribute('data-i18n');
        
        // Verifica se existe tradução para essa chave no idioma escolhido
        // traducoes[novoIdioma] = objeto com todas as traduções do idioma
        // traducoes[novoIdioma][chave] = tradução específica dessa chave
        if (traducoes[novoIdioma] && traducoes[novoIdioma][chave]) {
            // Substitui o texto do elemento pela tradução
            // textContent = conteúdo de texto do elemento (sem HTML)
            elemento.textContent = traducoes[novoIdioma][chave];
        }
    });
    
    // PASSO 6: Atualiza a aparência dos botões de idioma
    // Destaca o botão do idioma ativo (adiciona classe 'active')
    document.querySelectorAll(SITE_SEL.LANG_BTN).forEach(function(botao) {
        // Se este botão corresponde ao idioma escolhido
        if (botao.getAttribute('data-lang') === novoIdioma) {
            // Adiciona a classe 'active' para destacar visualmente
            botao.classList.add('active');
        } else {
            // Remove a classe 'active' dos outros botões
            botao.classList.remove('active');
        }
    });
    
    // PASSO 7: Atualiza o relógio com dias da semana e meses no idioma correto
    atualizarHorario();

    // PASSO 8: Atualiza os rótulos de acessibilidade (aria-label) do botão home
    // Isso ajuda leitores de tela a anunciarem o botão corretamente
    const homeLabel = traducoes[novoIdioma]['aria-home'] || 'Home';
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
    // PASSO 1: Pega os elementos HTML onde vamos mostrar o horário e a data
    // getElementById busca um elemento pelo seu ID
    const elementoHorario = document.getElementById('horario');  // Elemento para mostrar horas:minutos:segundos
    const elementoData = document.getElementById('data');        // Elemento para mostrar dia da semana + data
    
    // PASSO 2: Cria um objeto Date que contém a data e hora atual do sistema
    // new Date() = pega a data/hora do computador/navegador
    const agora = new Date();
    
    // PASSO 3: Formata as horas (0-23)
    // agora.getHours() = pega as horas (0 a 23)
    // String() = converte o número para texto
    // padStart(2, '0') = adiciona zero à esquerda se tiver só 1 dígito
    // Exemplo: 9 vira "09", 15 continua "15"
    const horas = String(agora.getHours()).padStart(2, '0');
    
    // PASSO 4: Formata os minutos (0-59) da mesma forma
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    
    // PASSO 5: Formata os segundos (0-59) da mesma forma
    const segundos = String(agora.getSeconds()).padStart(2, '0');
    
    // PASSO 6: Cria um array (lista) com os nomes dos dias da semana traduzidos
    // getDay() retorna: 0=domingo, 1=segunda, 2=terça, etc.
    // Usamos esse número como índice do array para pegar o nome correto
    const diasSemana = [
        traducoes[idiomaAtual]['dia-dom'],  // Índice 0: domingo
        traducoes[idiomaAtual]['dia-seg'],  // Índice 1: segunda
        traducoes[idiomaAtual]['dia-ter'],  // Índice 2: terça
        traducoes[idiomaAtual]['dia-qua'],  // Índice 3: quarta
        traducoes[idiomaAtual]['dia-qui'],  // Índice 4: quinta
        traducoes[idiomaAtual]['dia-sex'],  // Índice 5: sexta
        traducoes[idiomaAtual]['dia-sab']   // Índice 6: sábado
    ];
    // Pega o nome do dia da semana usando o número retornado por getDay()
    const diaSemana = diasSemana[agora.getDay()];
    
    // PASSO 7: Cria um array com os nomes dos meses traduzidos
    // getMonth() retorna: 0=janeiro, 1=fevereiro, 2=março, etc.
    const meses = [
        traducoes[idiomaAtual]['mes-jan'],  // Índice 0: janeiro
        traducoes[idiomaAtual]['mes-fev'],  // Índice 1: fevereiro
        traducoes[idiomaAtual]['mes-mar'],  // Índice 2: março
        traducoes[idiomaAtual]['mes-abr'],  // Índice 3: abril
        traducoes[idiomaAtual]['mes-mai'],  // Índice 4: maio
        traducoes[idiomaAtual]['mes-jun'],  // Índice 5: junho
        traducoes[idiomaAtual]['mes-jul'],  // Índice 6: julho
        traducoes[idiomaAtual]['mes-ago'],  // Índice 7: agosto
        traducoes[idiomaAtual]['mes-set'],  // Índice 8: setembro
        traducoes[idiomaAtual]['mes-out'],  // Índice 9: outubro
        traducoes[idiomaAtual]['mes-nov'],  // Índice 10: novembro
        traducoes[idiomaAtual]['mes-dez']   // Índice 11: dezembro
    ];
    // Pega o nome do mês usando o número retornado por getMonth()
    const mesAbreviado = meses[agora.getMonth()];
    
    // PASSO 8: Pega o dia do mês (1-31) sem formatação especial
    // getDate() retorna o dia do mês (1, 2, 3, ..., 31)
    const dia = agora.getDate();
    
    // PASSO 9: Atualiza o conteúdo dos elementos HTML na página
    // Template string (usando ${}) permite inserir variáveis dentro do texto
    // Horário: mostra "HH:MM:SS" (exemplo: "14:30:45")
    elementoHorario.textContent = `${horas}:${minutos}:${segundos}`;
    
    // Data: mostra "dia da semana dia mês" (exemplo: "segunda 15 janeiro")
    elementoData.textContent = `${diaSemana} ${dia} ${mesAbreviado}`;
}

// ============================================
// INICIALIZAÇÃO QUANDO A PÁGINA CARREGA
// ============================================
// DOMContentLoaded = evento que acontece quando o HTML foi completamente carregado
// Isso garante que todos os elementos existem antes de tentar usá-los
document.addEventListener('DOMContentLoaded', function() {
    // PASSO 1: Inicializa a interface com o idioma salvo (ou português se não houver)
    // idiomaAtual já foi definido no início do arquivo (carregado do localStorage ou padrão)
    trocarIdioma(idiomaAtual);
    
    // PASSO 2: Adiciona "ouvintes" de eventos nos botões de idioma
    // Quando o usuário clicar nesses botões, a função trocarIdioma será chamada
    
    // Botão de português: quando clicado, troca para pt-BR
    document.getElementById('btnPT').addEventListener('click', function() {
        trocarIdioma('pt-BR');
    });
    
    // Botão de italiano: quando clicado, troca para it-IT
    document.getElementById('btnIT').addEventListener('click', function() {
        trocarIdioma('it-IT');
    });
    
    // PASSO 3: Atualiza o horário imediatamente quando a página carrega
    // Isso evita mostrar "00:00:00" por um segundo
    atualizarHorario();
    
    // PASSO 4: Configura o relógio para atualizar automaticamente a cada segundo
    // setInterval(funcao, tempo) = executa a função repetidamente
    // atualizarHorario = função que atualiza o horário
    // 1000 = intervalo em milissegundos (1000ms = 1 segundo)
    setInterval(atualizarHorario, 1000);
});

// ============================================
// EFEITO DE TOQUE NOS ÍCONES (Mobile)
// ============================================

