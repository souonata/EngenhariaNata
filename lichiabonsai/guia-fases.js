/**
 * guia-fases.js — INTRODUÇÃO HONESTA + ROTEIRO EM FASES (0 a 25 anos).
 *
 * O "mapa grande" do projeto: o que esperar de verdade da lichia, a regra que
 * ordena todo o trabalho, e o que fazer em cada fase (do berçário ao bonsai
 * maduro). Texto bilíngue { pt, it } para leigo total. Cada fase liga a um
 * diagrama pela chave canônica em `diagrama`. Só constantes exportadas.
 */

export const GUIA_INTRO = {
  diagnostico: {
    pt: 'Sendo sincero: lichia não é material fácil de bonsai. As folhas são grandes, então o alvo realista não é uma miniatura — é um bonsai médio ou grande (60–100 cm), de tronco forte e copa larga. Na Lombardia, isso pede um ritmo claro: fora ao ar livre no calor, em sol pleno; e, no inverno, abrigo MUITO luminoso e SEM geada (a lichia é subtropical e morre no gelo).',
    it: 'Sarò sincero: il litchi non è un materiale facile da bonsai. Le foglie sono grandi, quindi l\'obiettivo realistico non è una miniatura — è un bonsai medio o grande (60–100 cm), dal tronco robusto e dalla chioma ampia. In Lombardia serve un ritmo chiaro: fuori all\'aperto col caldo, in pieno sole; e, d\'inverno, un riparo MOLTO luminoso e SENZA gelo (il litchi è subtropicale e muore col gelo).',
  },
  regraOuro: {
    pt: 'A ordem é sagrada: primeiro saúde, depois tronco, depois galhos, depois vaso bonito e, por último, frutos. Tronco grosso não nasce em vaso raso — precisa de anos crescendo forte. E uma regra que evita matar a planta: nunca duas agressões grandes no mesmo dia (poda forte, poda de raiz, aramação pesada e troca de substrato não andam juntas).',
    it: 'L\'ordine è sacro: prima la salute, poi il tronco, poi i rami, poi il vaso bello e, per ultimi, i frutti. Un tronco grosso non nasce in un vaso basso — servono anni di crescita vigorosa. E una regola che evita di uccidere la pianta: mai due aggressioni grandi nello stesso giorno (potatura forte, potatura delle radici, filo pesante e cambio di substrato non vanno insieme).',
  },
  marco: {
    pt: '2031 não é a linha de chegada: é o marco de PRÉ-BONSAI — planta viva e saudável, tronco com movimento, base de raízes abrindo em leque e o primeiro desenho da árvore já visível. A maturidade de verdade, com copa fina e presença, vem bem depois: por volta de 2041–2051.',
    it: '2031 non è il traguardo: è la tappa del PRE-BONSAI — pianta viva e sana, tronco con movimento, base radicale che si apre a raggiera e il primo disegno dell\'albero già visibile. La vera maturità, con chioma fine e presenza, arriva molto dopo: intorno al 2041–2051.',
  },
};

export const GUIA_FASES = [
  {
    chave: 'f0',
    anoDe: 0,
    anoAte: 1,
    periodo: { pt: 'Ano 0–1', it: 'Anno 0–1' },
    titulo: { pt: 'Berçário: só sobreviver', it: 'Vivaio: solo sopravvivere' },
    objetivo: {
      pt: 'Manter a muda viva e vigorosa, e atravessar o primeiro inverno. Nesta fase não se desenha nada — observa-se e protege-se.',
      it: 'Tenere viva e vigorosa la piantina e superare il primo inverno. In questa fase non si disegna nulla — si osserva e si protegge.',
    },
    fazer: {
      pt: [
        'Não corte a raiz pivotante (a raiz central reta) — ela engrossa o futuro tronco.',
        'Mantenha a PET 2 L só como abrigo temporário; é berçário, não vaso de bonsai.',
        'Dê muita luz: a lichia adora sol, e luz fraca dá planta esticada e mole.',
        'Sombreie a garrafa transparente (não as folhas): raiz exposta à luz e ao calor sofre.',
        'Antes da 1ª geada (out/nov), traga para dentro, sob janela clara ou luz LED de cultivo.',
        'Regue mantendo úmido, nunca encharcado — raiz parada na água apodrece.',
      ],
      it: [
        'Non tagliare il fittone (la radice centrale dritta) — ispessisce il futuro tronco.',
        'Usa la PET da 2 L solo come riparo temporaneo; è un vivaio, non un vaso da bonsai.',
        'Dai tanta luce: il litchi ama il sole, e la luce scarsa dà una pianta filata e molle.',
        'Ombreggia la bottiglia trasparente (non le foglie): la radice esposta a luce e calore soffre.',
        'Prima della 1ª gelata (ott/nov), portala in casa, sotto finestra chiara o luce LED da coltivazione.',
        'Annaffia mantenendo umido, mai zuppo — la radice ferma nell\'acqua marcisce.',
      ],
    },
    resultado: {
      pt: 'Uma muda forte, com folhas firmes e verdes, que passou o inverno sem dano. Ainda parece só uma planta — e está tudo certo.',
      it: 'Una piantina robusta, con foglie sode e verdi, che ha passato l\'inverno senza danni. Sembra ancora solo una pianta — ed è tutto a posto.',
    },
    erroComum: {
      pt: 'Querer "podar para virar bonsai" no primeiro ano. Cedo demais: só enfraquece a planta e atrasa o tronco.',
      it: 'Voler "potare per farne un bonsai" il primo anno. Troppo presto: indebolisce solo la pianta e ritarda il tronco.',
    },
    diagrama: 'pet',
  },
  {
    chave: 'f1',
    anoDe: 1,
    anoAte: 3,
    periodo: { pt: 'Anos 1–3', it: 'Anni 1–3' },
    titulo: { pt: 'Fundação e vigor', it: 'Fondamenta e vigore' },
    objetivo: {
      pt: 'Dar à planta espaço e força para crescer muito, e aproveitar que o tronco ainda é flexível para dar-lhe movimento. É a base de tudo o que vem depois.',
      it: 'Dare alla pianta spazio e forza per crescere molto, e sfruttare il tronco ancora flessibile per dargli movimento. È la base di tutto ciò che segue.',
    },
    fazer: {
      pt: [
        'Passe para um vaso de treino GRANDE (fundo, não raso) — espaço = crescimento = tronco.',
        'Deixe crescer livre: mais folhas e ramos hoje significam tronco mais grosso amanhã.',
        'Dê movimento ao tronco com uma 1ª aramação leve, enquanto ele ainda dobra sem rachar.',
        'Proteja a casca do arame com fita/ráfia e revise a cada 2–3 semanas — arame marca rápido.',
        'Adube na primavera-verão para sustentar o vigor; suspenda no fim do verão.',
        'Não finalize a árvore agora — copa "bonitinha" cedo trava o engrossamento do tronco.',
      ],
      it: [
        'Passa a un vaso d\'allenamento GRANDE (profondo, non basso) — spazio = crescita = tronco.',
        'Lascia crescere libera: più foglie e rami oggi significano tronco più grosso domani.',
        'Dai movimento al tronco con una 1ª legatura leggera, finché si piega senza spezzarsi.',
        'Proteggi la corteccia dal filo con nastro/rafia e controlla ogni 2–3 settimane — il filo segna in fretta.',
        'Concima in primavera-estate per sostenere il vigore; sospendi a fine estate.',
        'Non finire l\'albero adesso — una chioma "carina" presto blocca l\'ispessimento del tronco.',
      ],
    },
    resultado: {
      pt: 'Planta vigorosa, em vaso amplo, com o tronco já mostrando uma direção e uma curva suave. O esqueleto do futuro começa a existir.',
      it: 'Pianta vigorosa, in vaso ampio, col tronco che mostra già una direzione e una curva morbida. Lo scheletro del futuro inizia a esistere.',
    },
    erroComum: {
      pt: 'Manter em vaso pequeno/raso "para parecer bonsai". O tronco fica fino para sempre — e fino não tem volta.',
      it: 'Tenerla in vaso piccolo/basso "perché sembri un bonsai". Il tronco resta sottile per sempre — e sottile non torna indietro.',
    },
    diagrama: 'conicidade',
  },
  {
    chave: 'f2',
    anoDe: 3,
    anoAte: 7,
    periodo: { pt: 'Anos 3–7', it: 'Anni 3–7' },
    titulo: { pt: 'Engrossar o tronco', it: 'Ispessire il tronco' },
    objetivo: {
      pt: 'Aumentar o calibre do tronco — o que mais dá idade aparente a um bonsai. Aqui a planta cresce quase à vontade, com cortes só para guiar. 2031 cai nesta fase: o marco do pré-bonsai.',
      it: 'Aumentare il calibro del tronco — ciò che dà più "età apparente" a un bonsai. Qui la pianta cresce quasi a piacere, con tagli solo per guidarla. Il 2031 cade in questa fase: la tappa del pre-bonsai.',
    },
    fazer: {
      pt: [
        'Use galhos de sacrifício: deixe um ramo crescer solto para engrossar o tronco, depois remova-o.',
        'Deixe crescer livre entre os cortes — é o crescimento que engorda a madeira.',
        'Pode só para direcionar: corte acima de uma gema voltada para o lado que você quer.',
        'Mire um tronco de ~2–5 cm na base; ainda mais alto que o desenho final, por causa do sacrifício.',
        'Respeite os "fluxos" da lichia: deixe o broto vermelho/bronze virar verde firme antes de cortar.',
        'Já comece a abrir as raízes da base em leque (nebari) no transplante de primavera.',
      ],
      it: [
        'Usa rami di sacrificio: lascia crescere libero un ramo per ispessire il tronco, poi rimuovilo.',
        'Lascia crescere libera tra un taglio e l\'altro — è la crescita che ingrossa il legno.',
        'Pota solo per direzionare: taglia sopra una gemma rivolta verso il lato voluto.',
        'Punta a un tronco di ~2–5 cm alla base; ancora più alto del disegno finale, per via del sacrificio.',
        'Rispetta i "flussi" del litchi: lascia che il germoglio rosso/bronzo diventi verde sodo prima di tagliare.',
        'Inizia già ad aprire a raggiera le radici della base (nebari) nel rinvaso di primavera.',
      ],
    },
    resultado: {
      pt: '2031, pré-bonsai: tronco com movimento e calibre visível, base de raízes começando a abrir, galhos ainda desorganizados mas com os principais já escolhidos.',
      it: '2031, pre-bonsai: tronco con movimento e calibro visibile, base radicale che inizia ad aprirsi, rami ancora disordinati ma con i principali già scelti.',
    },
    erroComum: {
      pt: 'Cortar o galho de sacrifício tarde demais: ele deixa uma cicatriz grossa e feia no tronco. Remova antes de engrossar de mais.',
      it: 'Tagliare il ramo di sacrificio troppo tardi: lascia una cicatrice grossa e brutta sul tronco. Rimuovilo prima che ingrossi troppo.',
    },
    diagrama: 'sacrificio',
  },
  {
    chave: 'f3',
    anoDe: 7,
    anoAte: 12,
    periodo: { pt: 'Anos 7–12', it: 'Anni 7–12' },
    titulo: { pt: 'Estrutura primária', it: 'Struttura primaria' },
    objetivo: {
      pt: 'Sair do "arbusto que cresce" para uma árvore com arquitetura: escolher os galhos que ficam, reduzir a altura e construir conicidade de baixo para cima.',
      it: 'Passare dal "cespuglio che cresce" a un albero con architettura: scegliere i rami che restano, ridurre l\'altezza e costruire la rastremazione dal basso verso l\'alto.',
    },
    fazer: {
      pt: [
        'Escolha 3–5 galhos principais: alternados, fora das curvas internas, em alturas diferentes.',
        'Use "clip and grow": deixe crescer, corte de volta para um novo líder, repita — cria movimento e afina o topo.',
        'Reduza a altura cortando o ápice alto que serviu só para engrossar.',
        'Tire os galhos errados: opostos no mesmo ponto ("roda de carroça"), grossos demais no topo.',
        'Corrija a base e o nebari no repote, espalhando as raízes em volta do tronco.',
        'Repote a cada 2–3 anos no fim da primavera; tire só 10–20% da raiz de cada vez.',
      ],
      it: [
        'Scegli 3–5 rami principali: alternati, fuori dalle curve interne, ad altezze diverse.',
        'Usa il "clip and grow": lascia crescere, taglia verso un nuovo apice, ripeti — crea movimento e affina la cima.',
        'Riduci l\'altezza tagliando l\'apice alto che serviva solo a ispessire.',
        'Togli i rami sbagliati: opposti nello stesso punto ("ruota di carro"), troppo grossi in cima.',
        'Correggi base e nebari nel rinvaso, distribuendo le radici intorno al tronco.',
        'Rinvasa ogni 2–3 anni a fine primavera; togli solo il 10–20% della radice per volta.',
      ],
    },
    resultado: {
      pt: 'Um pré-bonsai sério: tronco resolvido, galhos principais no lugar, base abrindo bem. A copa ainda é grosseira, mas o desenho já se lê.',
      it: 'Un pre-bonsai serio: tronco risolto, rami principali al loro posto, base che si apre bene. La chioma è ancora grezza, ma il disegno si legge già.',
    },
    erroComum: {
      pt: 'Manter galhos demais "por dó". O excesso confunde o desenho e rouba vigor dos ramos que importam.',
      it: 'Tenere troppi rami "per pena". L\'eccesso confonde il disegno e ruba vigore ai rami che contano.',
    },
    diagrama: 'clipgrow',
  },
  {
    chave: 'f4',
    anoDe: 12,
    anoAte: 18,
    periodo: { pt: 'Anos 12–18', it: 'Anni 12–18' },
    titulo: { pt: 'Refinamento', it: 'Affinamento' },
    objetivo: {
      pt: 'Transformar galhos grossos em copa com ramificação fina. O trabalho passa a ser de detalhe e repetição. Por volta de 2041, pode vir a primeira floração — controlada.',
      it: 'Trasformare i rami grossi in una chioma con ramificazione fine. Il lavoro diventa di dettaglio e ripetizione. Intorno al 2041 può arrivare la prima fioritura — controllata.',
    },
    fazer: {
      pt: [
        'Mude para um vaso de treino menor — menos espaço afina folhas e entrenós.',
        'Construa ramificação secundária: corte o ramo novo para 2–3 nós depois de amadurecer.',
        'Pode depois de cada fluxo maduro (folha já verde firme), não no broto mole.',
        'Reduza o nitrogênio: na fase fina, adubo de menos é melhor que de mais.',
        'Se aparecer flor, deixe poucas — frutificar cedo cansa a árvore e atrasa o desenho.',
        'Cuide das raízes finas no repote: são elas que sustentam a copa densa.',
      ],
      it: [
        'Passa a un vaso d\'allenamento più piccolo — meno spazio affina foglie e internodi.',
        'Costruisci la ramificazione secondaria: taglia il ramo nuovo a 2–3 nodi dopo che è maturato.',
        'Pota dopo ogni flusso maturo (foglia ormai verde soda), non sul germoglio molle.',
        'Riduci l\'azoto: in fase fine, poco concime è meglio di troppo.',
        'Se compaiono fiori, lasciane pochi — fruttificare presto stanca l\'albero e ritarda il disegno.',
        'Cura le radici fini nel rinvaso: sono loro a sostenere la chioma densa.',
      ],
    },
    resultado: {
      pt: 'Já tem cara de bonsai: nebari visível, copa equilibrada e ramificação que começa a dividir-se. Talvez as primeiras flores.',
      it: 'Ha già l\'aspetto di un bonsai: nebari visibile, chioma equilibrata e ramificazione che inizia a suddividersi. Forse i primi fiori.',
    },
    erroComum: {
      pt: 'Deixar muitos frutos na primeira floração. Um bonsai carregado de lichias se esgota e pode regredir anos.',
      it: 'Lasciare troppi frutti alla prima fioritura. Un bonsai carico di litchi si esaurisce e può regredire di anni.',
    },
    diagrama: 'podaRaiz',
  },
  {
    chave: 'f5',
    anoDe: 18,
    anoAte: 25,
    periodo: { pt: 'Anos 18–25', it: 'Anni 18–25' },
    titulo: { pt: 'Maturidade', it: 'Maturità' },
    objetivo: {
      pt: 'Vestir a árvore com o vaso definitivo e mantê-la: jovem por dentro, velha por fora. O foco vira equilíbrio, proporção e cuidado fino. Maturidade plena: ~2041–2051.',
      it: 'Vestire l\'albero col vaso definitivo e mantenerlo: giovane dentro, vecchio fuori. Il focus diventa equilibrio, proporzione e cura fine. Maturità piena: ~2041–2051.',
    },
    fazer: {
      pt: [
        'Passe ao vaso cerâmico final, escolhido para a árvore — proporcional ao tronco e à copa.',
        'Pense no estilo definitivo: para lichia, ereto informal frutífero ou multitronco caem bem.',
        'Faça manutenção fina: pinçamento, limpeza e equilíbrio de vigor entre topo e base.',
        'Espace os repotes: a cada 3–5 anos, sempre na primavera, com poda de raiz suave.',
        'Permita frutos ocasionais (poucos) como joia final — não como objetivo de cada ano.',
        'Registre tudo (fotos da mesma frente, medidas): a árvore evolui em escala de décadas.',
      ],
      it: [
        'Passa al vaso ceramico finale, scelto per l\'albero — proporzionato al tronco e alla chioma.',
        'Pensa allo stile definitivo: per il litchi, eretto informale fruttifero o multitronco stanno bene.',
        'Fai manutenzione fine: pinzatura, pulizia ed equilibrio di vigore tra cima e base.',
        'Dirada i rinvasi: ogni 3–5 anni, sempre in primavera, con potatura delle radici leggera.',
        'Permetti frutti occasionali (pochi) come gioiello finale — non come obiettivo di ogni anno.',
        'Registra tutto (foto dalla stessa fronte, misure): l\'albero evolve su scala di decenni.',
      ],
    },
    resultado: {
      pt: 'Um bonsai maduro: tronco, copa, casca e presença. Em anos bons, algumas lichias como recompensa. Mostrável, mas nunca "terminado".',
      it: 'Un bonsai maturo: tronco, chioma, corteccia e presenza. Negli anni buoni, qualche litchi come ricompensa. Mostrabile, ma mai "finito".',
    },
    erroComum: {
      pt: 'Tratá-lo como "pronto" e parar de cuidar. Bonsai maduro precisa de manutenção contínua, ou a copa se desorganiza.',
      it: 'Trattarlo come "finito" e smettere di curarlo. Un bonsai maturo richiede cura continua, o la chioma si disordina.',
    },
    diagrama: 'estilos',
  },
];
