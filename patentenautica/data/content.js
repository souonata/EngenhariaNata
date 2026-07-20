window.PATENTE_CONTENT = {
  updated: "20 luglio 2026",
  scope: "Patente nautica entro 12 miglia — motore",
  exam: {
    chartQuestions: 5,
    chartMinutes: 20,
    chartPass: 4,
    baseQuestions: 20,
    baseMinutes: 30,
    basePass: 16
  },
  chapters: [
    {
      id: "scafo",
      order: 1,
      icon: "◒",
      title: "Teoria dello scafo",
      italian: "Teoria dello scafo",
      examQuestions: 1,
      bankCount: 125,
      color: "#3db6c6",
      description: "Nomenclatura, stabilità, strutture e organi che fanno galleggiare e governare l’unità.",
      topics: [
        {
          id: "scafo-nomenclatura",
          title: "Parti principali e dimensioni",
          summary: "Prua e poppa definiscono le estremità; dritta e sinistra si individuano guardando verso prua. Baglio massimo, lunghezza e pescaggio condizionano la manovra e l’accesso ai fondali.",
          points: [
            "Opera viva: parte immersa; opera morta: parte emersa.",
            "La linea di galleggiamento separa le due parti; il bordo libero è la distanza verticale fino al piano di coperta.",
            "Il pescaggio, o immersione, è la massima profondità sotto la linea di galleggiamento; non va confuso con l’altezza totale.",
            "Il dislocamento è il peso dell’acqua spostata e, in equilibrio, corrisponde al peso dell’unità."
          ],
          tags: ["prua", "poppa", "dritta", "sinistra", "pescaggio", "dislocamento"],
          sources: ["dispensa", "scribd3"]
        },
        {
          id: "scafo-struttura",
          title: "Struttura e tipi di scafo",
          summary: "Chiglia, madieri, ordinate, paratie e fasciame formano la struttura resistente. Gli scafi dislocanti e plananti reagiscono in modo diverso alla velocità e al mare.",
          points: [
            "La chiglia è l’elemento longitudinale principale; ordinate e madieri formano l’ossatura trasversale.",
            "Le paratie stagne limitano l’allagamento e non devono essere forate o lasciate aperte senza controllo.",
            "Lo scafo dislocante sposta acqua durante tutta la navigazione; quello planante si solleva sull’acqua acquistando velocità.",
            "Il catamarano ha due scafi e il trimarano tre. La maggiore larghezza aumenta la stabilità di forma, ma modifica la manovra."
          ],
          tags: ["chiglia", "ordinate", "paratie", "dislocante", "planante"],
          sources: ["dispensa", "scribd3"]
        },
        {
          id: "scafo-stabilita",
          title: "Stabilità, assetto e carichi",
          summary: "La stabilità dipende dalla posizione del baricentro e del metacentro. Carichi alti, liberi o mal distribuiti riducono il margine di sicurezza.",
          points: [
            "Il momento sbandante aumenta quando un peso viene spostato trasversalmente lontano dal centro.",
            "Le superfici libere nei serbatoi parzialmente pieni peggiorano la stabilità.",
            "Passeggeri e carichi vanno distribuiti mantenendo il baricentro basso e vicino all’asse longitudinale.",
            "L’assetto è l’inclinazione longitudinale; lo sbandamento è l’inclinazione trasversale."
          ],
          tags: ["stabilità", "baricentro", "metacentro", "assetto", "carico"],
          sources: ["dispensa", "scribd3"]
        },
        {
          id: "scafo-timone-elica",
          title: "Timone ed elica",
          summary: "Il timone devia il flusso d’acqua; l’elica trasforma la coppia in spinta. L’effetto evolutivo dell’elica è particolarmente evidente in retromarcia.",
          points: [
            "Il timone è più efficace quando riceve un flusso d’acqua; da fermi, ruotarlo da solo non governa l’unità.",
            "Il passo è l’avanzamento teorico compiuto dall’elica in un giro; la cavitazione riduce la spinta e può danneggiare le pale.",
            "Un’elica destrorsa, vista da poppa, gira in senso orario in marcia avanti; una sinistrorsa nel senso opposto.",
            "Nelle manovre lente combina brevi impulsi del motore, posizione del timone, vento ed effetto evolutivo."
          ],
          tags: ["timone", "elica", "passo", "cavitazione", "effetto evolutivo"],
          sources: ["dispensa", "scribd3"]
        }
      ]
    },
    {
      id: "motori",
      order: 2,
      icon: "⚙",
      title: "Motori",
      italian: "Motori",
      examQuestions: 1,
      bankCount: 104,
      color: "#5ec6a7",
      description: "Ciclo, alimentazione, lubrificazione, raffreddamento, trasmissione e diagnosi di base.",
      topics: [
        {
          id: "motori-cicli",
          title: "Benzina, diesel e cicli",
          summary: "Il motore a quattro tempi compie aspirazione, compressione, combustione/espansione e scarico. Nel diesel l’accensione avviene per compressione; nel ciclo Otto tramite candela.",
          points: [
            "Un ciclo a quattro tempi richiede due giri dell’albero motore.",
            "I vapori di benzina sono più pesanti dell’aria e possono accumularsi in sentina: ventilare prima dell’avviamento.",
            "Il diesel usa iniettori e pompa d’iniezione; l’aria nel circuito impedisce l’alimentazione e deve essere spurgata.",
            "Fumo nero indica spesso miscela ricca o carico; azzurro, olio; bianco persistente può indicare acqua o combustione incompleta."
          ],
          tags: ["diesel", "benzina", "quattro tempi", "iniettore", "fumo"],
          sources: ["dispensa", "scribd3"]
        },
        {
          id: "motori-impianti",
          title: "Lubrificazione e raffreddamento",
          summary: "L’olio riduce l’attrito e asporta calore; il raffreddamento marino scambia calore con l’acqua esterna. Allarmi di pressione o temperatura richiedono una riduzione immediata e controlli in sicurezza.",
          points: [
            "Bassa pressione dell’olio: arrestare il motore appena è sicuro e controllare livello, perdite e circuito.",
            "Surriscaldamento: controllare presa a mare, filtro, girante della pompa, cinghia e scarico dell’acqua.",
            "Non aprire mai il tappo di un circuito pressurizzato quando è caldo.",
            "La valvola di presa a mare deve essere conosciuta e accessibile per poterla chiudere in emergenza."
          ],
          tags: ["olio", "raffreddamento", "girante", "presa a mare", "temperatura"],
          sources: ["dispensa", "scribd3"]
        },
        {
          id: "motori-elettrico",
          title: "Impianto elettrico e avviamento",
          summary: "Batteria, motorino di avviamento e alternatore formano il nucleo dell’impianto elettrico. Collegamenti puliti e fusibili correttamente dimensionati prevengono guasti e incendi.",
          points: [
            "Tensione presente ma corrente insufficiente può indicare un morsetto ossidato: controlla serraggio e caduta di tensione.",
            "Le batterie liberano gas esplosivo durante la carica: ventilare ed evitare scintille.",
            "Disinserire il selettore batterie mentre l’alternatore carica può danneggiare il regolatore.",
            "I circuiti essenziali devono essere protetti e la pompa di sentina deve restare disponibile."
          ],
          tags: ["batteria", "alternatore", "avviamento", "fusibile", "impianto elettrico"],
          sources: ["dispensa"]
        },
        {
          id: "motori-propulsione",
          title: "Trasmissioni e controlli",
          summary: "Linea d’asse, stern drive, Sail Drive e pod trasmettono la potenza in modi diversi. Prima di partire controlla carburante, fluidi, raffreddamento e risposta dei comandi.",
          points: [
            "L’invertitore seleziona marcia avanti, folle e retromarcia; cambia senso con il motore al minimo.",
            "Lo stern drive orienta il gruppo propulsore esterno; la linea d’asse usa un timone separato.",
            "Una vibrazione nuova può indicare elica danneggiata, cima avvolta, disallineamento o cavitazione.",
            "Controlli: carburante e riserva, olio, acqua, cinghie, batteria, ventilazione, scarico e strumenti."
          ],
          tags: ["invertitore", "linea d’asse", "stern drive", "s-drive", "pod"],
          sources: ["dispensa", "scribd3"]
        }
      ]
    },
    {
      id: "sicurezza",
      order: 3,
      icon: "✚",
      title: "Sicurezza della navigazione",
      italian: "Sicurezza della navigazione",
      examQuestions: 3,
      bankCount: 215,
      color: "#f0a05a",
      description: "Dotazioni, emergenze, incendio, uomo a mare, radio e assistenza.",
      topics: [
        {
          id: "sicurezza-dotazioni",
          title: "Dotazioni e preparazione",
          summary: "Le dotazioni dipendono dalla distanza dalla costa e dall’unità. Validità, accessibilità e conoscenza dell’uso sono importanti quanto la loro presenza a bordo.",
          points: [
            "Prima della partenza: meteo, carburante con margine, documenti, persone a bordo e piano di navigazione.",
            "I giubbotti devono essere della misura corretta, identificati e rapidamente accessibili.",
            "Segnali pirotecnici, estintori e mezzi collettivi hanno scadenze e requisiti specifici: verifica la norma vigente.",
            "Briefing all’equipaggio: giubbotti, estintori, radio, valvole, pompa di sentina e procedura MOB."
          ],
          tags: ["dotazioni", "giubbotto", "zattera", "estintore", "checklist"],
          sources: ["dm323", "dispensa", "scribd3"]
        },
        {
          id: "sicurezza-incendio-falla",
          title: "Incendio, falla e incaglio",
          summary: "Priorità: proteggere le persone, fermare la causa, contenere il problema e chiedere aiuto per tempo. Per spegnere un incendio occorre eliminare combustibile, ossigeno o calore senza aprire incautamente i compartimenti.",
          points: [
            "Incendio nel vano motore: interrompere carburante ed elettricità; usare l’apertura prevista senza spalancare il cofano.",
            "Ingresso d’acqua: localizzare, tamponare, pompare e ridurre le sollecitazioni sullo scafo; preparare abbandono e assistenza.",
            "Incaglio: fermarsi, valutare fondale, marea e danni, evitare di accelerare senza diagnosi e considerare un alleggerimento controllato.",
            "Non usare mai acqua su combustibili liquidi o apparecchiature elettriche sotto tensione."
          ],
          tags: ["incendio", "falla", "incaglio", "pompa di sentina", "estintore"],
          sources: ["navico4", "dispensa", "scribd1"]
        },
        {
          id: "sicurezza-mob",
          title: "Uomo a mare e abbandono",
          summary: "Al grido di uomo a mare, mantieni il contatto visivo, lancia un galleggiante, marca la posizione e manovra senza esporre la persona all’elica.",
          points: [
            "Una persona indica continuamente il naufrago; un’altra attiva il MOB sul GPS e prepara il recupero.",
            "Avvicinamento finale a velocità minima e, in base a vento e mare, naufrago sottovento per proteggerlo.",
            "Motore in folle o spento durante il recupero vicino a poppa e all’elica.",
            "Abbandona l’unità solo quando restare a bordo è più pericoloso; se possibile porta radio o beacon, acqua e kit d’emergenza."
          ],
          tags: ["uomo a mare", "MOB", "abbandono", "recupero", "salvagente"],
          sources: ["dm323", "dispensa", "scribd1"]
        },
        {
          id: "sicurezza-radio",
          title: "VHF, chiamate e assistenza",
          summary: "Il canale 16 è destinato a chiamata e soccorso. MAYDAY indica pericolo grave e imminente; PAN PAN, urgenza; SÉCURITÉ, un avviso importante alla navigazione o meteorologico.",
          points: [
            "MAYDAY: nome o nominativo, posizione, natura del pericolo, assistenza necessaria, persone a bordo e informazioni utili.",
            "Dopo una chiamata ordinaria sul 16, passa al canale di lavoro indicato.",
            "Il soccorso digitale DSC usa il canale 70: non trasmettervi comunicazioni vocali.",
            "Non ritardare la richiesta di soccorso: posizione e tempo disponibile spesso determinano l’esito."
          ],
          tags: ["VHF", "canale 16", "MAYDAY", "PAN PAN", "SECURITE", "DSC"],
          sources: ["scribd1", "dispensa"]
        }
      ]
    },
    {
      id: "manovra",
      order: 4,
      icon: "↝",
      title: "Manovra e condotta",
      italian: "Manovra e condotta",
      examQuestions: 4,
      bankCount: 155,
      color: "#e27767",
      description: "Effetti di vento ed elica, ormeggio, ancoraggio, condotta e nodi della prova pratica.",
      topics: [
        {
          id: "manovra-forze",
          title: "Vento, corrente e abbrivio",
          summary: "A bassa velocità dominano vento e corrente. Valuta prima quale forza prevale, da dove proviene e dove sposterà prua e poppa.",
          points: [
            "L’abbrivio è il moto residuo: l’unità continua ad avanzare anche dopo aver messo in folle.",
            "L’opera morta risente maggiormente del vento; scafo e chiglia della corrente.",
            "Usa brevi impulsi decisi, evitando di mantenere i giri quando l’allineamento è ormai perso.",
            "Prepara parabordi e cime in anticipo; non tentare mai di arrestare un’unità con mani o piedi."
          ],
          tags: ["abbrivio", "vento", "corrente", "bassa velocità", "manovra"],
          sources: ["dispensa", "scribd3"]
        },
        {
          id: "manovra-ormeggio",
          title: "Ormeggio e disormeggio",
          summary: "L’avvicinamento deve essere lento, controllato e con una via d’uscita. Spring, cavi di prua e di poppa controllano i movimenti longitudinali e trasversali.",
          points: [
            "Avvicinarsi contro la forza predominante offre generalmente maggiore controllo.",
            "Lo spring di prua limita l’avanzamento; quello di poppa limita l’arretramento, in base alla disposizione in banchina.",
            "Una cima passata a doppino consente di mollare senza sbarcare, ma deve rimanere libera dall’elica.",
            "Comunicazione chiara: una persona comanda e l’equipaggio conferma ogni operazione."
          ],
          tags: ["ormeggio", "disormeggio", "spring", "cima", "parabordo"],
          sources: ["dm323", "scribd3"]
        },
        {
          id: "manovra-ancora",
          title: "Ancoraggio",
          summary: "Scegli fondale, profondità, ridosso e spazio di brandeggio. Il rapporto fra lunghezza di cima o catena e profondità determina l’angolo di tiro sull’ancora.",
          points: [
            "Controlla carta, cavi sottomarini, aree vietate, vento previsto, marea e altre imbarcazioni.",
            "Cala, non lanciare, l’ancora; arretra lentamente mentre fili la linea d’ormeggio.",
            "Verifica la tenuta con riferimenti o allarme GPS e prevedi cambi di vento o corrente.",
            "Per salpare, portati sulla verticale senza usare il salpa-ancora per rimorchiare l’imbarcazione."
          ],
          tags: ["ancora", "ancoraggio", "calumo", "fondo", "brandeggio"],
          sources: ["dm323", "scribd3"]
        },
        {
          id: "manovra-nodi",
          title: "Nodi della prova pratica",
          summary: "Il programma pratico comprende gassa d’amante, nodo parlato, nodo di bitta e nodo di bozza. Allenati nell’esecuzione, nell’impiego e nello scioglimento sotto carico.",
          points: [
            "Gassa d’amante: forma un’asola fissa che non scorre.",
            "Nodo parlato: fissaggio rapido a un palo; può richiedere sicurezza se il carico varia.",
            "Nodo di bitta: volte a otto e mezzo collo finale, senza sovrapporre le cime in modo da bloccarle.",
            "Nodo di bozza: collega una cima sottile a un’altra in tensione per trasferire o alleggerire il carico."
          ],
          tags: ["gassa d’amante", "nodo parlato", "nodo di bitta", "nodo di bozza"],
          sources: ["dm323", "navico-nodi"]
        }
      ]
    },
    {
      id: "colreg",
      order: 5,
      icon: "⌁",
      title: "COLREG e segnalamento",
      italian: "COLREG e segnalamento marittimo",
      examQuestions: 2,
      bankCount: 247,
      color: "#8f9de7",
      description: "Regole di rotta e governo, fanali, segnali diurni, segnali sonori e segnalamento marittimo.",
      topics: [
        {
          id: "colreg-rischio",
          title: "Vedetta e rischio di collisione",
          summary: "Ogni unità mantiene una vedetta visiva e uditiva, una velocità di sicurezza e una valutazione continua. Un rilevamento costante con distanza in diminuzione indica rischio di collisione.",
          points: [
            "Non affidarti a una sola osservazione o esclusivamente all’AIS: usa tutti i mezzi disponibili.",
            "La manovra deve essere decisa, ampia, tempestiva e controllata finché le unità non siano passate e libere.",
            "Con visibilità ridotta: macchine pronte, velocità adeguata e segnali regolamentari.",
            "L’unità con diritto di precedenza mantiene rotta e velocità, ma deve agire se l’altra non evita la collisione."
          ],
          tags: ["vedetta", "rischio di collisione", "rilevamento", "velocità di sicurezza", "AIS"],
          sources: ["dispensa", "scribd3"]
        },
        {
          id: "colreg-incrocio",
          title: "Rotte opposte, incrocio e sorpasso",
          summary: "Su rotte opposte entrambe le unità accostano a dritta. Nell’incrocio fra unità a motore, chi vede l’altra a dritta deve manovrare. Chi sorpassa deve tenersi discosto.",
          points: [
            "Rotte opposte: accosta a dritta e passa con il lato sinistro contro il lato sinistro dell’altra unità.",
            "Incrocio: evita di passare a prua dell’unità con diritto di precedenza.",
            "È sorpasso quando ci si avvicina da oltre 22,5° a poppavia del traverso; chi raggiunge resta responsabile finché non è libero.",
            "Canale stretto: mantieniti vicino al limite di dritta quando è sicuro e praticabile."
          ],
          tags: ["rotte opposte", "incrocio", "sorpasso", "canale stretto", "precedenza"],
          sources: ["dispensa", "scribd3"]
        },
        {
          id: "colreg-luci",
          title: "Luci e segnali diurni",
          summary: "Individua prima settore, colore e combinazione: fanali laterali, di poppa, di testa d’albero e visibili per tutto l’orizzonte. I segnali diurni comunicano lo stesso stato operativo.",
          points: [
            "Unità a motore in navigazione: fanali laterali, di poppa e uno o più fanali di testa d’albero in base alla lunghezza.",
            "All’ancora: luce bianca per tutto l’orizzonte e un pallone nero di giorno; incagliata aggiunge due luci rosse e tre palloni.",
            "Senza governo: due rosse verticali o due palloni; capacità di manovra limitata: rosso-bianco-rosso o pallone-rombo-pallone.",
            "Pesca a strascico: verde sopra bianco; altra pesca: rosso sopra bianco."
          ],
          tags: ["luci", "fanali", "segnali diurni", "alla fonda", "senza governo"],
          sources: ["dispensa", "scribd3"]
        },
        {
          id: "colreg-segnali",
          title: "Segnali sonori e IALA",
          summary: "I fischi indicano manovra, dubbio e condizione nella nebbia. Nel sistema IALA A, entrando dal mare le mede laterali rosse restano a sinistra e le verdi a dritta.",
          points: [
            "1 breve: accosto a dritta; 2 brevi: accosto a sinistra; 3 brevi: macchine indietro.",
            "5 o più fischi brevi e rapidi: dubbio o pericolo.",
            "Le cardinali indicano dove si trova l’acqua sicura rispetto alla meda; colori e ritmo luminoso codificano il quadrante.",
            "Acque sicure: strisce verticali rosse e bianche con luce bianca; pericolo isolato: nero e rosso con due sfere."
          ],
          tags: ["segnali sonori", "IALA A", "laterali", "cardinali", "acque sicure"],
          sources: ["dispensa", "scribd3"]
        }
      ]
    },
    {
      id: "meteo",
      order: 6,
      icon: "☼",
      title: "Meteorologia",
      italian: "Meteorologia",
      examQuestions: 2,
      bankCount: 120,
      color: "#69a8e8",
      description: "Pressione, vento, nubi, fronti, brezze, stato del mare e bollettini.",
      topics: [
        {
          id: "meteo-pressione",
          title: "Pressione e vento",
          summary: "Il vento nasce dal gradiente di pressione ed è deviato dalla rotazione terrestre. Isobare ravvicinate indicano un forte gradiente e, in genere, vento più intenso.",
          points: [
            "Nell’emisfero nord la circolazione è antioraria nelle basse pressioni e oraria nelle alte pressioni.",
            "Legge di Buys-Ballot: nell’emisfero nord, con le spalle al vento, la bassa pressione si trova approssimativamente a sinistra.",
            "Il vento prende il nome dalla direzione di provenienza; la corrente dalla direzione verso cui si muove.",
            "Raffiche e accelerazioni costiere possono superare il valore medio del bollettino."
          ],
          tags: ["pressione", "isobare", "gradiente", "vento", "Buys-Ballot"],
          sources: ["navico5", "navico6", "dispensa"]
        },
        {
          id: "meteo-brezze",
          title: "Brezze e venti mediterranei",
          summary: "Di giorno la terra si scalda più rapidamente e la brezza soffia dal mare verso terra; di notte il ciclo tende a invertirsi. Rilievi e orientamento della costa possono incanalare il flusso.",
          points: [
            "La brezza di mare inizia spesso in tarda mattinata e si rinforza nel pomeriggio con tempo stabile.",
            "La brezza di terra è generalmente più debole e si presenta fra notte e mattino.",
            "Tramontana N, Grecale NE, Levante E, Scirocco SE, Ostro S, Libeccio SW, Ponente W, Maestrale NW.",
            "Il nome locale non sostituisce direzione osservata, tendenza barometrica e previsione."
          ],
          tags: ["brezza", "tramontana", "scirocco", "libeccio", "maestrale", "rosa dei venti"],
          sources: ["navico6", "navico-rosa"]
        },
        {
          id: "meteo-fronti",
          title: "Nubi, fronti e temporali",
          summary: "Un fronte caldo tende a portare una sequenza estesa di nubi e precipitazioni graduali; un fronte freddo cambi rapidi, cumuli e rovesci. Il cumulonembo richiede ampia distanza.",
          points: [
            "Cirri e calo della pressione possono anticipare l’arrivo di un sistema frontale.",
            "Il cumulonembo può produrre raffiche violente, grandine, fulmini e mare corto.",
            "La nebbia si forma quando l’aria umida si raffredda fino al punto di rugiada: adegua velocità e segnali.",
            "Un rapido aumento della pressione dopo un fronte freddo può accompagnarsi a vento forte, non a calma immediata."
          ],
          tags: ["fronti", "nubi", "cumulonembo", "temporale", "nebbia"],
          sources: ["navico5", "navico6", "dispensa"]
        },
        {
          id: "meteo-bollettini",
          title: "Bollettini e stato del mare",
          summary: "Confronta fonti ufficiali, osservazioni locali e tendenza. Beaufort descrive la forza del vento; Douglas lo stato del mare: scale collegate, ma non equivalenti.",
          points: [
            "Meteomar fornisce avvisi, situazione, previsione e tendenza per le diverse aree marittime.",
            "L’altezza significativa è la media del terzo delle onde più alte; singole onde possono essere molto maggiori.",
            "Fetch, durata e intensità del vento determinano la crescita del mare.",
            "Definisci i tuoi limiti prima della partenza e mantieni una rotta alternativa verso un ridosso."
          ],
          tags: ["Meteomar", "Beaufort", "Douglas", "altezza significativa", "bollettino"],
          sources: ["navico6", "dispensa"]
        }
      ]
    },
    {
      id: "navigazione",
      order: 7,
      icon: "⌖",
      title: "Navigazione cartografica ed elettronica",
      italian: "Navigazione cartografica ed elettronica",
      examQuestions: 4,
      bankCount: 322,
      color: "#d4b44d",
      description: "Coordinate, carta di Mercatore, rotte, rilevamenti, navigazione stimata, vento, corrente e GPS.",
      topics: [
        {
          id: "navigazione-coordinate",
          title: "Coordinate e carta nautica",
          summary: "La latitudine misura l’arco nord o sud dell’equatore; la longitudine l’arco est o ovest di Greenwich. Nella carta di Mercatore le rotte lossodromiche sono rette e le distanze si misurano sulla scala delle latitudini.",
          points: [
            "1 minuto di latitudine = 1 miglio nautico; 1 nodo = 1 miglio nautico all’ora.",
            "Leggi la latitudine sui bordi laterali e la longitudine sui bordi superiore e inferiore.",
            "Usa la scala delle latitudini vicino alla rotta; non usare mai la scala delle longitudini per misurare una distanza.",
            "Scala 1:100.000 significa che 1 cm sulla carta corrisponde a 1 km reale."
          ],
          tags: ["latitudine", "longitudine", "Mercatore", "miglio nautico", "scala"],
          sources: ["navico1", "navico-cart1", "dispensa"]
        },
        {
          id: "navigazione-bussola",
          title: "Rotta, prora e bussola",
          summary: "La rotta è la traiettoria sul fondo; la prora è la direzione verso cui punta l’asse dell’unità. La declinazione collega nord vero e magnetico; la deviazione collega nord magnetico e bussola.",
          points: [
            "Conversione: dal vero alla bussola applica declinazione e deviazione con i segni convenzionali; la correzione percorre il cammino inverso.",
            "La declinazione si ricava dalla rosa della carta, aggiornata all’anno; la deviazione dalla tabella della bussola di bordo.",
            "Variazione totale = somma algebrica di declinazione e deviazione.",
            "Non memorizzare solo una formula: disegna i tre nord e controlla il segno."
          ],
          tags: ["rotta", "prora", "declinazione", "deviazione", "bussola"],
          sources: ["navico2", "navico-cart2", "dispensa"]
        },
        {
          id: "navigazione-rilevamenti",
          title: "Rilevamenti e punto nave",
          summary: "Un luogo di posizione limita la zona in cui ci troviamo; due linee indipendenti danno un punto, tre permettono un controllo. Il rilevamento deve essere corretto e riportato correttamente sulla carta.",
          points: [
            "Il rilevamento polare si misura dalla prua; quello vero dal nord vero.",
            "Scegli oggetti ben identificati e un angolo d’intersezione favorevole, vicino a 90°.",
            "L’allineamento di due oggetti è un luogo di posizione molto preciso.",
            "Fra osservazioni non simultanee, trasporta la prima linea usando rotta e distanza percorsa."
          ],
          tags: ["rilevamento", "rilevamento polare", "punto nave", "allineamento", "luogo di posizione"],
          sources: ["navico2", "navico-cart3", "navico-cart6", "dispensa"]
        },
        {
          id: "navigazione-stima",
          title: "Spazio, tempo, velocità e stima",
          summary: "Le tre relazioni fondamentali sono S = V × T, V = S ÷ T e T = S ÷ V. Il tempo deve essere espresso in ore decimali; il consumo include la riserva prevista dall’esercizio.",
          points: [
            "30 min = 0,5 h; 15 min = 0,25 h; in generale, minuti ÷ 60.",
            "ETA = ora di partenza + durata della navigazione.",
            "Nella navigazione stimata, avanza la posizione secondo prora o rotta e distanza corrispondente all’intervallo.",
            "I 50 esercizi inclusi utilizzano tolleranze ufficiali e la carta didattica 5/D."
          ],
          tags: ["spazio", "tempo", "velocità", "ETA", "stima", "carburante"],
          sources: ["dd10", "navico-cart4", "navico1"]
        },
        {
          id: "navigazione-corrente",
          title: "Corrente e scarroccio",
          summary: "La corrente somma un vettore di direzione e velocità al moto propulsivo; il vento produce scarroccio laterale. Il risultato determina rotta e velocità effettive sul fondo.",
          points: [
            "La direzione della corrente indica dove si muove l’acqua; il vento prende il nome da dove proviene.",
            "Triangolo vettoriale: vettore dell’unità sull’acqua + vettore della corrente = moto sul fondo.",
            "Per mantenere la rotta desiderata calcola la prora di compensazione e la velocità effettiva.",
            "Verifica il risultato con un successivo punto nave: la previsione non sostituisce l’osservazione."
          ],
          tags: ["corrente", "scarroccio", "deriva", "vettori", "rotta vera"],
          sources: ["navico3", "navico-cart5", "dispensa"]
        },
        {
          id: "navigazione-elettronica",
          title: "GPS, chartplotter e ecoscandaglio",
          summary: "L’elettronica facilita la navigazione, ma dipende da alimentazione, datum, carte e corretta interpretazione. Mantieni controllo visivo, profondità e una soluzione di riserva.",
          points: [
            "COG è la rotta sul fondo; SOG è la velocità sul fondo: non coincidono necessariamente con prora e velocità sull’acqua.",
            "Un waypoint errato o uno zoom inadeguato può nascondere pericoli fra l’unità e la destinazione.",
            "Controlla datum e aggiornamento della carta: una posizione precisa su una carta imprecisa resta pericolosa.",
            "L’ecoscandaglio misura la profondità dal trasduttore; regola l’offset rispetto a chiglia o superficie e conosci il riferimento usato."
          ],
          tags: ["GPS", "chartplotter", "COG", "SOG", "ecoscandaglio", "datum"],
          sources: ["dispensa", "scribd3"]
        }
      ]
    },
    {
      id: "normativa",
      order: 8,
      icon: "§",
      title: "Normativa diportistica e ambientale",
      italian: "Normativa diportistica e ambientale",
      examQuestions: 3,
      bankCount: 184,
      color: "#b58acf",
      description: "Abilitazione, documenti, doveri del comandante, limiti, ambiente e uso dell’unità.",
      topics: [
        {
          id: "normativa-patente",
          title: "Ambito della patente",
          summary: "Questo percorso è dedicato all’abilitazione per unità a motore entro 12 miglia dalla costa. I limiti dipendono anche dall’unità, dalla potenza e dalle condizioni previste dalla legge vigente.",
          points: [
            "La patente abilita la persona; non sostituisce documenti, equipaggiamento o idoneità dell’unità.",
            "La distanza è misurata dalla costa o dalla linea di base applicabile, secondo le regole del programma.",
            "Requisiti e termini possono cambiare: prima dell’esame o della partenza verifica sempre presso MIT e Capitaneria.",
            "I materiali del 2011 e 2019 presenti nella raccolta sono didattici; prevalgono DM 323/2021, DD 131/2022 e norme successive."
          ],
          tags: ["patente", "entro 12 miglia", "motore", "limiti", "abilitazione"],
          sources: ["mit-normativa", "dm323", "dd131"]
        },
        {
          id: "normativa-comandante",
          title: "Responsabilità del comandante",
          summary: "Il comandante valuta navigabilità, equipaggio, meteo, rotta e sicurezza, presta l’assistenza possibile e adotta misure per evitare danni a persone, ambiente e navigazione.",
          points: [
            "Pianificare non trasferisce la responsabilità al GPS, al proprietario o all’equipaggio.",
            "La velocità deve consentire controllo, rispetto delle regole locali e protezione di bagnanti e costa.",
            "Incidenti, danni, soccorso e inquinamento possono comportare obblighi di comunicazione.",
            "Alcol, stanchezza e farmaci riducono la capacità e possono avere conseguenze amministrative o penali."
          ],
          tags: ["comandante", "responsabilità", "assistenza", "velocità", "incidente"],
          sources: ["scribd2", "scribd3", "mit-normativa"]
        },
        {
          id: "normativa-documenti",
          title: "Documenti e categorie delle unità",
          summary: "Natante, imbarcazione e nave da diporto hanno regimi documentali differenti. A bordo devono trovarsi i documenti dell’unità, delle persone, della radio e l’assicurazione quando prevista.",
          points: [
            "Verifica licenza di navigazione o dichiarazione, certificato di sicurezza e assicurazione in base alla categoria.",
            "Patente e documento personale devono essere validi; per usare la radio può essere richiesto uno specifico certificato.",
            "Manuali e certificati delle apparecchiature aiutano a dimostrare conformità e validità.",
            "Non usare elenchi datati come controllo legale definitivo: verifica presso la Capitaneria e le fonti ufficiali."
          ],
          tags: ["documenti", "natante", "imbarcazione", "assicurazione", "certificato"],
          sources: ["mit-normativa", "scribd2", "scribd3"]
        },
        {
          id: "normativa-ambiente",
          title: "Tutela ambientale e aree protette",
          summary: "Scarichi, rifiuti, combustibili, pesca e accesso alle aree protette seguono regole specifiche. Carte, portolani e autorità locali definiscono zone e restrizioni.",
          points: [
            "Non gettare mai olio, carburante, plastica o rifiuti in mare; contieni e segnala ogni sversamento.",
            "Le aree marine protette hanno zone A, B e C e regole specifiche per navigazione, ancoraggio, pesca e immersioni.",
            "Evita di ancorare sulla Posidonia e sui fondali sensibili; usa i campi boe quando disponibili.",
            "Rispetta distanze, corridoi di lancio e limiti locali vicino a spiagge e bagnanti."
          ],
          tags: ["ambiente", "inquinamento", "area marina protetta", "Posidonia", "rifiuti"],
          sources: ["mit-normativa", "dd131"]
        }
      ]
    }
  ],
  sources: [
    {id:"mit-normativa",group:"Ufficiale",title:"MIT — normativa patenti nautiche",url:"https://mit.gov.it/index.php/temi/patenti-mezzi-abilitazioni/patenti-nautiche/normativa",status:"vigente",note:"Indice ufficiale di leggi, decreti e banche dati dei quesiti."},
    {id:"dm323",group:"Ufficiale",title:"DM 323/2021 — programma e modalità d’esame",url:"sources/dm-323-2021-programma-esame.pdf",external:"https://www.mit.gov.it/normativa/decreto-ministeriale-numero-323-del-10-agosto-2021",status:"vigente",note:"Definisce prova, tempi, limiti di errore, distribuzione e parte pratica."},
    {id:"dd131",group:"Ufficiale",title:"DD 131/2022 — 1.472 quiz BASE",url:"sources/quiz-ministeriali-dd-131-2022.pdf",external:"https://www.mit.gov.it/normativa/decreto-dirigenziale-numero-131-del-31052022",status:"vigente",note:"Banca dati integrale usata nell’allenatore del sito; corregge e sostituisce l’allegato del DD 106."},
    {id:"dd10",group:"Ufficiale",title:"DD 10/2022 — 50 esercizi entro 12 miglia",url:"sources/quiz-e-carteggio-dd-10-2022.pdf#page=161",external:"https://www.mit.gov.it/nfsmitgov/files/media/normativa/2022-02/ALLEGATO%20A%20DD%2010%20DEL%2025GEN2022.pdf",status:"fascicolo tecnico",note:"Pagine 161–178: 50 esercizi di spazio-tempo-velocità, consumo e coordinate con soluzioni."},
    {id:"dispensa",group:"Materiale didattico",title:"Dispensa patente nautica 12M",url:"Dispensa patente nautica 12M.pdf",status:"storico · 2011",note:"67 pagine. Struttura didattica utile; norme e dotazioni devono essere verificate su una fonte aggiornata."},
    {id:"scribd1",group:"Scribd",title:"Dispense Patente Nautica",url:"https://www.scribd.com/document/359218004/Dispense-Patente-Nautica",status:"didattico",note:"10 pagine; comunicazioni VHF e nozioni di manovra e vela."},
    {id:"scribd2",group:"Scribd",title:"Patente nautica",url:"https://www.scribd.com/doc/46101785/patente-nautica",status:"storico",note:"15 pagine; materiale datato, utile soltanto come complemento concettuale."},
    {id:"scribd3",group:"Scribd",title:"Guida al superamento della patente",url:"https://www.scribd.com/document/509583836/Guida-Al-Superamento-Della-Patente",status:"didattico · 2019",note:"90 pagine; indice ampio e organizzazione per studio e quiz."},
    {id:"navico-main",group:"Navico Online",title:"Appunti per il conseguimento della patente nautica",url:"http://www.navico-online.com/contents/en-uk/d309_APPUNTI_PER_IL_CONSEGUIMENTO_DELLA_PATENTE_NAUTICA.html",status:"didattico",note:"Indice generale dei capitoli e degli esercizi."},
    {id:"navico1",group:"Navico Online",title:"Cap. 1 — carte, coordinate, rotta, miglio e scala",url:"http://www.navico-online.com/contents/en-uk/p866.html",status:"didattico"},
    {id:"navico2",group:"Navico Online",title:"Cap. 2 — bussola, rilevamenti e punto nave",url:"http://www.navico-online.com/contents/en-uk/p867.html",status:"didattico"},
    {id:"navico3",group:"Navico Online",title:"Cap. 3 — scarroccio, deriva e nomenclatura",url:"http://www.navico-online.com/contents/en-uk/p868.html",status:"didattico"},
    {id:"navico4",group:"Navico Online",title:"Cap. 4 — avarie, emergenze e propulsione",url:"http://www.navico-online.com/contents/en-uk/p869.html",status:"didattico"},
    {id:"navico5",group:"Navico Online",title:"Cap. 5 — meteorologia I",url:"http://www.navico-online.com/contents/en-uk/p870.html",status:"didattico"},
    {id:"navico6",group:"Navico Online",title:"Cap. 6 — meteorologia II e Meteomar",url:"http://www.navico-online.com/contents/en-uk/p871.html",status:"didattico"},
    {id:"navico-cart1",group:"Navico Online",title:"Carteggio 1 — coordinate, rotta e distanza",url:"http://www.navico-online.com/contents/en-uk/p859.html",status:"esercizi"},
    {id:"navico-cart2",group:"Navico Online",title:"Carteggio 2 — conversione e correzione",url:"http://www.navico-online.com/contents/en-uk/p861.html",status:"esercizi"},
    {id:"navico-cart3",group:"Navico Online",title:"Carteggio 3 — rilevamenti polari",url:"http://www.navico-online.com/contents/en-uk/p862.html",status:"esercizi"},
    {id:"navico-cart4",group:"Navico Online",title:"Carteggio 4 — spazio, tempo, velocità",url:"http://www.navico-online.com/contents/en-uk/p863.html",status:"esercizi"},
    {id:"navico-cart5",group:"Navico Online",title:"Carteggio 5 — correnti",url:"http://www.navico-online.com/contents/en-uk/p864.html",status:"esercizi"},
    {id:"navico-cart6",group:"Navico Online",title:"Carteggio 6 — luoghi di posizione",url:"http://www.navico-online.com/contents/en-uk/p865.html",status:"esercizi"},
    {id:"navico-nodi",group:"Navico Online",title:"Nodi",url:"http://www.navico-online.com/contents/en-uk/p872.html",status:"didattico"},
    {id:"navico-rosa",group:"Navico Online",title:"Rosa dei venti",url:"http://www.navico-online.com/contents/en-uk/p873.html",status:"didattico"}
  ]
};
