/**
 * guia-tecnicas.js — BIBLIOTECA DE TÉCNICAS ILUSTRADAS (como fazer, passo a passo)
 *
 * Conteúdo data-driven para a seção "Técnicas" do diário do Bonsai Lichia.
 * Cada técnica é bilíngue { pt, it }, escrita para quem nunca cuidou de bonsai:
 * o que é, os passos, por que importa, quando fazer e o erro clássico a evitar.
 * O campo `diagrama` aponta para o desenho correspondente (ou null se não houver).
 */

export const TECNICAS = [
  {
    chave: 'pet',
    titulo: { pt: 'Preparar a garrafa PET (berçário)', it: 'Preparare la bottiglia PET (vivaio)' },
    resumo: {
      pt: 'Uma garrafa de 2 L vira o primeiro lar da muda: funda, escura e bem drenada.',
      it: 'Una bottiglia da 2 L diventa la prima casa della piantina: profonda, scura e ben drenata.',
    },
    passos: [
      {
        pt: 'Corte a parte de cima da garrafa para abrir a boca larga e poder encher de substrato.',
        it: 'Taglia la parte alta della bottiglia per aprire un\'imboccatura larga e poterla riempire di substrato.',
      },
      {
        pt: 'Faça muitos furos no fundo e nas laterais de baixo — a água tem de escorrer livre.',
        it: 'Fai molti fori sul fondo e sui lati bassi — l\'acqua deve scolare libera.',
      },
      {
        pt: 'Deixe a garrafa opaca por fora (fita, papel ou tinta): raiz no escuro, sem algas nem calor.',
        it: 'Rendi la bottiglia opaca all\'esterno (nastro, carta o vernice): radice al buio, senza alghe né calore.',
      },
      {
        pt: 'Use a garrafa em pé e cheia: a altura deixa a raiz pivotante crescer reta para baixo.',
        it: 'Usa la bottiglia in piedi e piena: l\'altezza fa crescere il fittone dritto verso il basso.',
      },
      {
        pt: 'Trate como temporário: planeje o vaso de treino quando a raiz começar a circular nas paredes.',
        it: 'Trattala come temporanea: pianifica il vaso di allenamento quando la radice inizia a girare lungo le pareti.',
      },
    ],
    porque: {
      pt: 'A profundidade protege a raiz pivotante, que vai engrossar o futuro tronco.',
      it: 'La profondità protegge il fittone, che ispessirà il futuro tronco.',
    },
    quando: {
      pt: 'Logo após germinar; a muda fica na PET cerca de 6 a 18 meses, conforme o vigor.',
      it: 'Subito dopo la germinazione; la piantina resta nella PET circa 6-18 mesi, secondo il vigore.',
    },
    erro: {
      pt: 'Deixar a garrafa transparente — luz e calor na raiz criam algas e estresse.',
      it: 'Lasciare la bottiglia trasparente — luce e calore sulla radice creano alghe e stress.',
    },
    diagrama: 'pet',
  },
  {
    chave: 'substrato',
    titulo: { pt: 'A receita do substrato', it: 'La ricetta del substrato' },
    resumo: {
      pt: 'Uma mistura granular que drena rápido e respira — nada de terra de jardim.',
      it: 'Una miscela granulare che drena in fretta e respira — niente terra da giardino.',
    },
    passos: [
      {
        pt: 'Comece pelos minerais que arejam: pumice ou perlita formam a base da mistura.',
        it: 'Parti dalla parte minerale che ossigena: pomice o perlite sono la base della miscela.',
      },
      {
        pt: 'Junte algo que segure umidade na medida certa: casca de pinus ou fibra de coco.',
        it: 'Aggiungi qualcosa che trattenga l\'umidità al punto giusto: corteccia di pino o fibra di cocco.',
      },
      {
        pt: 'Acrescente akadama ou cerâmica porosa, que guarda água e nutrientes sem encharcar.',
        it: 'Aggiungi akadama o ceramica porosa, che trattiene acqua e nutrienti senza ristagnare.',
      },
      {
        pt: 'Complete com lava ou pedrisco NÃO calcário, para drenagem e estrutura.',
        it: 'Completa con lava o ghiaino NON calcareo, per drenaggio e struttura.',
      },
      {
        pt: 'Peneire tudo e descarte o pó: pó fino vira lama e sufoca as raízes.',
        it: 'Setaccia tutto e scarta la polvere: la polvere fine diventa fango e soffoca le radici.',
      },
    ],
    porque: {
      pt: 'A lichia odeia raiz encharcada; o pH levemente ácido (5,8–6,5) evita folha amarela.',
      it: 'Il litchi odia la radice fradicia; il pH leggermente acido (5,8-6,5) evita le foglie gialle.',
    },
    quando: {
      pt: 'Prepare antes de cada transplante; ajuste a mistura à fase (mais mineral quando madura).',
      it: 'Preparalo prima di ogni trapianto; adatta la miscela alla fase (più minerale da adulta).',
    },
    erro: {
      pt: 'Usar terra comum ou substrato fino — compacta, encharca e apodrece a raiz.',
      it: 'Usare terra comune o substrato fine — compatta, ristagna e fa marcire la radice.',
    },
    diagrama: 'substrato',
  },
  {
    chave: 'rega',
    titulo: { pt: 'Regar certo', it: 'Annaffiare nel modo giusto' },
    resumo: {
      pt: 'Regar pela observação, não pelo calendário: molhar bem quando começa a secar.',
      it: 'Annaffiare osservando, non a calendario: bagnare bene quando inizia ad asciugare.',
    },
    passos: [
      {
        pt: 'Faça o teste do dedo: enfie cerca de 1 cm no substrato e sinta a umidade.',
        it: 'Fai la prova del dito: infilalo circa 1 cm nel substrato e senti l\'umidità.',
      },
      {
        pt: 'Se a superfície já está secando, regue; se ainda está úmida, espere.',
        it: 'Se la superficie sta asciugando, annaffia; se è ancora umida, aspetta.',
      },
      {
        pt: 'Molhe devagar até a água sair pelos furos de drenagem — ela atravessou todo o vaso.',
        it: 'Bagna piano finché l\'acqua esce dai fori di drenaggio — ha attraversato tutto il vaso.',
      },
      {
        pt: 'No verão, cheque todo dia: pode precisar de 1 a 2 regas; no inverno, bem menos.',
        it: 'In estate, controlla ogni giorno: può servire 1-2 volte; in inverno, molto meno.',
      },
      {
        pt: 'Nunca deixe pratinho com água parada; use água da chuva quando puder.',
        it: 'Mai sottovaso con acqua ferma; usa acqua piovana quando puoi.',
      },
    ],
    porque: {
      pt: 'O vaso tem pouca reserva: alternar água e ar mantém a raiz viva e sadia.',
      it: 'Il vaso ha poca riserva: alternare acqua e aria mantiene la radice viva e sana.',
    },
    quando: {
      pt: 'O ano todo, sempre que o teste do dedo indicar que começou a secar.',
      it: 'Tutto l\'anno, ogni volta che la prova del dito segnala che inizia ad asciugare.',
    },
    erro: {
      pt: 'Regar por horário fixo — encharca no inverno e seca a planta no verão.',
      it: 'Annaffiare a orario fisso — fradicia d\'inverno e secca la pianta d\'estate.',
    },
    diagrama: 'rega',
  },
  {
    chave: 'fluxos',
    titulo: { pt: 'Entender os fluxos de brotação', it: 'Capire i flussi di germogliazione' },
    resumo: {
      pt: 'A lichia cresce em ondas; cada onda só pode ser podada depois de endurecer.',
      it: 'Il litchi cresce a ondate; ogni ondata si pota solo dopo che si è indurita.',
    },
    passos: [
      {
        pt: 'Observe a folha nova: nasce mole, bronze ou avermelhada, pendendo para baixo.',
        it: 'Osserva la foglia nuova: nasce molle, bronzo o rossastra, pendente verso il basso.',
      },
      {
        pt: 'Espere ela firmar e virar verde escuro — só então o tecido está maduro.',
        it: 'Aspetta che si rassodi e diventi verde scuro — solo allora il tessuto è maturo.',
      },
      {
        pt: 'Com a folha endurecida, você pode podar ou aramar aquele lançamento com segurança.',
        it: 'Con la foglia indurita, puoi potare o legare quel germoglio in sicurezza.',
      },
      {
        pt: 'Anote a data de cada fluxo: o intervalo costuma ser de cerca de seis semanas.',
        it: 'Annota la data di ogni flusso: l\'intervallo è in genere di circa sei settimane.',
      },
    ],
    porque: {
      pt: 'Cortar folha mole gasta a planta à toa; folha madura significa reservas prontas.',
      it: 'Tagliare foglia molle spreca la pianta; foglia matura significa riserve pronte.',
    },
    quando: {
      pt: 'A cada onda, quando o bronze/vermelho vira verde firme — esse é o sinal.',
      it: 'A ogni ondata, quando il bronzo/rosso diventa verde sodo — quello è il segnale.',
    },
    erro: {
      pt: 'Podar a brotação ainda mole — você enfraquece a planta e perde o lançamento.',
      it: 'Potare il germoglio ancora molle — indebolisci la pianta e perdi il getto.',
    },
    diagrama: 'fluxos',
  },
  {
    chave: 'sacrificio',
    titulo: { pt: 'Galho de sacrifício (engrossar o tronco)', it: 'Ramo di sacrificio (ispessire il tronco)' },
    resumo: {
      pt: 'Um galho deixado crescer livre engorda o tronco; depois ele é removido.',
      it: 'Un ramo lasciato crescere libero ingrossa il tronco; poi viene rimosso.',
    },
    passos: [
      {
        pt: 'Escolha um galho (ou o ápice) abaixo do ponto que você quer engrossar.',
        it: 'Scegli un ramo (o l\'apice) sotto il punto che vuoi ispessire.',
      },
      {
        pt: 'Deixe-o crescer livre, sem podar: muitas folhas engordam o tronco logo abaixo dele.',
        it: 'Lascialo crescere libero, senza potare: molte foglie ingrossano il tronco appena sotto.',
      },
      {
        pt: 'Vigie a base do galho para não criar um inchaço feio nem cicatriz larga.',
        it: 'Sorveglia la base del ramo per non creare un rigonfiamento brutto né una cicatrice larga.',
      },
      {
        pt: 'Quando o tronco atingir a grossura desejada, corte o galho rente e trate o corte.',
        it: 'Quando il tronco raggiunge lo spessore voluto, taglia il ramo a filo e cura il taglio.',
      },
    ],
    porque: {
      pt: 'Tronco grosso não nasce em vaso raso; é o crescimento livre que dá calibre.',
      it: 'Il tronco grosso non nasce in vaso basso; è la crescita libera a dare calibro.',
    },
    quando: {
      pt: 'Na fase de desenvolvimento (anos 3–7), enquanto o objetivo é massa, não forma.',
      it: 'In fase di sviluppo (anni 3-7), finché l\'obiettivo è massa, non forma.',
    },
    erro: {
      pt: 'Esquecer o sacrifício crescendo demais — vira cicatriz e nó difíceis de esconder.',
      it: 'Dimenticare il sacrificio che cresce troppo — diventa cicatrice e nodo difficili da nascondere.',
    },
    diagrama: 'sacrificio',
  },
  {
    chave: 'clipgrow',
    titulo: { pt: 'Clip and grow (cresce-corta)', it: 'Clip and grow (cresci-taglia)' },
    resumo: {
      pt: 'Deixar crescer e cortar para um novo líder, repetindo, cria movimento e afinamento.',
      it: 'Lasciar crescere e tagliare verso un nuovo apice, ripetendo, crea movimento e rastremazione.',
    },
    passos: [
      {
        pt: 'Deixe o tronco ou ramo alongar bem antes de qualquer corte.',
        it: 'Lascia allungare bene il tronco o il ramo prima di qualsiasi taglio.',
      },
      {
        pt: 'Corte logo acima de uma gema virada para a direção que você quer dar à árvore.',
        it: 'Taglia subito sopra una gemma rivolta nella direzione che vuoi dare all\'albero.',
      },
      {
        pt: 'Essa gema vira o novo líder; deixe-o crescer e repita o ciclo.',
        it: 'Quella gemma diventa il nuovo apice; lascialo crescere e ripeti il ciclo.',
      },
      {
        pt: 'A cada corte, a parte de cima nasce mais fina — é assim que surge a conicidade.',
        it: 'A ogni taglio, la parte sopra nasce più sottile — così nasce la rastremazione.',
      },
    ],
    porque: {
      pt: 'Aramação pesada racha ramo velho; o cresce-corta dá curvas e afinamento naturais.',
      it: 'La legatura pesante spacca il ramo vecchio; il cresci-taglia dà curve e rastremazione naturali.',
    },
    quando: {
      pt: 'Da formação ao refinamento, sempre com a folha já madura (ver fluxos).',
      it: 'Dalla formazione al raffinamento, sempre con la foglia già matura (vedi flussi).',
    },
    erro: {
      pt: 'Cortar acima de uma gema mal posicionada — o novo líder cresce para o lado errado.',
      it: 'Tagliare sopra una gemma mal posizionata — il nuovo apice cresce dal lato sbagliato.',
    },
    diagrama: 'clipgrow',
  },
  {
    chave: 'nebari',
    titulo: { pt: 'Formar o nebari (raízes na base)', it: 'Formare il nebari (radici alla base)' },
    resumo: {
      pt: 'O nebari são as raízes que abrem em leque na superfície e dão idade à árvore.',
      it: 'Il nebari sono le radici che si aprono a raggiera in superficie e danno età all\'albero.',
    },
    passos: [
      {
        pt: 'No transplante, exponha a base e veja como as raízes saem do tronco.',
        it: 'Al trapianto, scopri la base e guarda come le radici escono dal tronco.',
      },
      {
        pt: 'Espalhe as raízes em leque, todas para os lados, como raios de uma roda.',
        it: 'Disponi le radici a raggiera, tutte verso i lati, come raggi di una ruota.',
      },
      {
        pt: 'Remova raiz que cruza outra, mergulha para baixo ou cresce por cima das demais.',
        it: 'Rimuovi le radici che si incrociano, scendono in basso o passano sopra le altre.',
      },
      {
        pt: 'Acomode-as quase na superfície e fixe a árvore para não desfazer o arranjo.',
        it: 'Sistemale quasi in superficie e fissa l\'albero per non disfare la disposizione.',
      },
    ],
    porque: {
      pt: 'Uma base radial faz a árvore parecer agarrar o solo — é metade da beleza do bonsai.',
      it: 'Una base radiale fa sembrare che l\'albero afferri il terreno — è metà della bellezza del bonsai.',
    },
    quando: {
      pt: 'A cada transplante de primavera, corrigindo um pouco de cada vez.',
      it: 'A ogni trapianto di primavera, correggendo un po\' alla volta.',
    },
    erro: {
      pt: 'Deixar uma raiz grossa cruzando ou mergulhando — ela estraga a base por décadas.',
      it: 'Lasciare una radice grossa che si incrocia o scende — rovina la base per decenni.',
    },
    diagrama: 'nebari',
  },
  {
    chave: 'conicidade',
    titulo: { pt: 'Conicidade do tronco', it: 'Rastremazione del tronco' },
    resumo: {
      pt: 'Um bom tronco é grosso na base e vai afinando até o topo, como uma árvore real.',
      it: 'Un buon tronco è grosso alla base e si assottiglia verso la cima, come un albero vero.',
    },
    passos: [
      {
        pt: 'Pense no tronco como um cone: a base é a parte mais larga de tudo.',
        it: 'Pensa al tronco come a un cono: la base è la parte più larga di tutte.',
      },
      {
        pt: 'Deixe os lançamentos de baixo engrossarem mais do que os de cima.',
        it: 'Lascia ingrossare i getti bassi più di quelli alti.',
      },
      {
        pt: 'Controle o topo: pode e contenha o ápice para ele nunca passar a base.',
        it: 'Controlla la cima: pota e contieni l\'apice perché non superi mai la base.',
      },
      {
        pt: 'Combine com o cresce-corta: cada novo líder nasce mais fino que o anterior.',
        it: 'Combina con il cresci-taglia: ogni nuovo apice nasce più sottile del precedente.',
      },
    ],
    porque: {
      pt: 'Tronco reto e cilíndrico parece um poste; a conicidade dá idade e naturalidade.',
      it: 'Un tronco dritto e cilindrico sembra un palo; la rastremazione dà età e naturalezza.',
    },
    quando: {
      pt: 'Desde cedo e por toda a formação — corrigir depois é muito mais difícil.',
      it: 'Fin da subito e per tutta la formazione — correggere dopo è molto più difficile.',
    },
    erro: {
      pt: 'Deixar o topo crescer forte demais — ele engrossa e inverte a conicidade.',
      it: 'Lasciare la cima crescere troppo forte — si ispessisce e inverte la rastremazione.',
    },
    diagrama: 'conicidade',
  },
  {
    chave: 'aramacao',
    titulo: { pt: 'Aramação', it: 'Legatura (filatura)' },
    resumo: {
      pt: 'O arame guia tronco e galhos para a posição desejada enquanto ainda são jovens.',
      it: 'Il filo guida tronco e rami nella posizione voluta finché sono ancora giovani.',
    },
    passos: [
      {
        pt: 'Use arame de alumínio anodizado, mais macio que aço e gentil com a casca.',
        it: 'Usa filo di alluminio anodizzato, più morbido dell\'acciaio e gentile con la corteccia.',
      },
      {
        pt: 'Enrole em espiral a cerca de 45 graus, firme mas sem apertar contra a casca.',
        it: 'Avvolgi a spirale a circa 45 gradi, saldo ma senza stringere sulla corteccia.',
      },
      {
        pt: 'Em curvas fortes, proteja o ramo com ráfia ou fita para não rachar.',
        it: 'Nelle curve forti, proteggi il ramo con rafia o nastro per non spaccarlo.',
      },
      {
        pt: 'Dobre devagar até a posição; deixe o arame trabalhar por algumas semanas.',
        it: 'Piega piano fino alla posizione; lascia lavorare il filo per qualche settimana.',
      },
      {
        pt: 'Revise a cada 2–3 semanas no calor e retire antes de o arame marcar.',
        it: 'Controlla ogni 2-3 settimane col caldo e togli prima che il filo segni.',
      },
    ],
    porque: {
      pt: 'Galho jovem dobra; galho velho racha. Aramar cedo é a janela mais segura.',
      it: 'Il ramo giovane si piega; quello vecchio si spacca. Legare presto è la finestra più sicura.',
    },
    quando: {
      pt: 'Nos primeiros anos, com a folha madura; depois prefira a poda direcional.',
      it: 'Nei primi anni, con la foglia matura; poi preferisci la potatura direzionale.',
    },
    erro: {
      pt: 'Esquecer o arame na planta em crescimento — ele entra na casca e marca para sempre.',
      it: 'Dimenticare il filo sulla pianta in crescita — entra nella corteccia e segna per sempre.',
    },
    diagrama: 'aramacao',
  },
  {
    chave: 'podaRaiz',
    titulo: { pt: 'Poda de raiz e transplante', it: 'Potatura delle radici e trapianto' },
    resumo: {
      pt: 'Trocar de vaso e podar a raiz renova o substrato e estimula raízes finas.',
      it: 'Cambiare vaso e potare la radice rinnova il substrato e stimola radici fini.',
    },
    passos: [
      {
        pt: 'Faça na primavera ou fim de primavera, com a planta já em crescimento ativo.',
        it: 'Falla in primavera o tarda primavera, con la pianta già in crescita attiva.',
      },
      {
        pt: 'Tire a árvore do vaso e solte com cuidado o substrato velho da raiz.',
        it: 'Estrai l\'albero dal vaso e libera con cura il substrato vecchio dalla radice.',
      },
      {
        pt: 'Corte no máximo 10–20% das raízes; nunca passe de 30% mesmo numa planta forte.',
        it: 'Taglia al massimo il 10-20% delle radici; mai oltre il 30% anche in una pianta forte.',
      },
      {
        pt: 'Replante em substrato fresco e prenda a árvore ao vaso para não balançar.',
        it: 'Rinvasa in substrato fresco e fissa l\'albero al vaso perché non oscilli.',
      },
      {
        pt: 'Deixe na sombra clara, sem vento, e sem adubo forte por 4 a 6 semanas.',
        it: 'Tienila in ombra luminosa, senza vento, e senza concime forte per 4-6 settimane.',
      },
    ],
    porque: {
      pt: 'Raízes finas absorvem melhor; árvore solta no vaso rompe as raízes novas ao vento.',
      it: 'Le radici fini assorbono meglio; un albero lasco nel vaso rompe le radici nuove al vento.',
    },
    quando: {
      pt: 'A cada 2–3 anos na fase de treino; quando a água demora a penetrar e a drenagem piora.',
      it: 'Ogni 2-3 anni in fase di allenamento; quando l\'acqua penetra a fatica e il drenaggio peggiora.',
    },
    erro: {
      pt: 'Podar muita raiz e podar a copa no mesmo dia — duas agressões juntas matam a planta.',
      it: 'Potare molta radice e la chioma lo stesso giorno — due aggressioni insieme uccidono la pianta.',
    },
    diagrama: 'podaRaiz',
  },
  {
    chave: 'adubacao',
    titulo: { pt: 'Adubação', it: 'Concimazione' },
    resumo: {
      pt: 'Alimentar na estação certa, com força certa, sem nunca forçar uma planta fraca.',
      it: 'Nutrire nella stagione giusta, con la forza giusta, senza mai forzare una pianta debole.',
    },
    passos: [
      {
        pt: 'Na primavera e no verão, use adubo equilibrado em dose fraca e regular.',
        it: 'In primavera ed estate, usa un concime equilibrato in dose debole e regolare.',
      },
      {
        pt: 'Depois de agosto, reduza o nitrogênio para não atrapalhar uma futura floração.',
        it: 'Dopo agosto, riduci l\'azoto per non ostacolare una futura fioritura.',
      },
      {
        pt: 'No outono e no inverno, suspenda o adubo: a planta está descansando.',
        it: 'In autunno e inverno, sospendi il concime: la pianta sta riposando.',
      },
      {
        pt: 'Nunca adube planta fraca, doente ou recém-transplantada — espere ela voltar a crescer.',
        it: 'Mai concimare una pianta debole, malata o appena trapiantata — aspetta che riprenda a crescere.',
      },
    ],
    porque: {
      pt: 'O vaso esgota nutrientes rápido; mas adubo não substitui sol — só cria broto mole.',
      it: 'Il vaso esaurisce in fretta i nutrienti; ma il concime non sostituisce il sole — fa solo getti molli.',
    },
    quando: {
      pt: 'Na estação de crescimento (primavera–verão); pare ao chegar o frio.',
      it: 'Nella stagione di crescita (primavera-estate); fermati all\'arrivo del freddo.',
    },
    erro: {
      pt: 'Tentar compensar pouca luz com mais adubo — só gera crescimento mole e doente.',
      it: 'Compensare la poca luce con più concime — genera solo crescita molle e malata.',
    },
    diagrama: null,
  },
  {
    chave: 'inverno',
    titulo: { pt: 'Passar o inverno em Lombardia', it: 'Superare l\'inverno in Lombardia' },
    resumo: {
      pt: 'A lichia é subtropical: o inverno com geada de Turate é abrigado dentro de casa.',
      it: 'Il litchi è subtropicale: l\'inverno con gelo di Turate si supera al riparo, in casa.',
    },
    passos: [
      {
        pt: 'Antes da primeira geada (out/nov), traga a árvore para dentro de casa.',
        it: 'Prima della prima gelata (ott/nov), porta l\'albero in casa.',
      },
      {
        pt: 'Coloque numa janela muito iluminada ou sob LED full-spectrum, 12–14 h por dia.',
        it: 'Mettilo a una finestra molto luminosa o sotto LED full-spectrum, 12-14 h al giorno.',
      },
      {
        pt: 'Mantenha longe de correntes de ar frio e de radiadores que ressecam o ar.',
        it: 'Tienilo lontano da correnti d\'aria fredda e da termosifoni che seccano l\'aria.',
      },
      {
        pt: 'Reduza a rega (sem deixar secar de todo) e não adube: é fase de descanso.',
        it: 'Riduci l\'irrigazione (senza far seccare del tutto) e non concimare: è fase di riposo.',
      },
      {
        pt: 'Inspecione toda semana a face de baixo das folhas: ar seco atrai cochonilhas e ácaros.',
        it: 'Ispeziona ogni settimana il lato inferiore delle foglie: l\'aria secca attira cocciniglie e ragnetti.',
      },
    ],
    porque: {
      pt: 'Geada queima a lichia jovem; ela precisa de calor e luz para atravessar o inverno.',
      it: 'Il gelo brucia il litchi giovane; gli servono calore e luce per attraversare l\'inverno.',
    },
    quando: {
      pt: 'Do fim do outono ao começo da primavera, enquanto houver risco de geada.',
      it: 'Dalla fine dell\'autunno all\'inizio della primavera, finché c\'è rischio di gelo.',
    },
    erro: {
      pt: 'Deixar numa sala quente e escura por meses — pouca luz e ar seco enfraquecem a planta.',
      it: 'Lasciarlo in una stanza calda e buia per mesi — poca luce e aria secca indeboliscono la pianta.',
    },
    diagrama: 'inverno',
  },
];
