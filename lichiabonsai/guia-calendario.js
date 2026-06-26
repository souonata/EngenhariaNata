/**
 * guia-calendario.js — CALENDÁRIO ANUAL + PRAGAS + MATERIAIS (data-driven, bilíngue).
 * Calendário mês a mês para a lichia em Turate/Lombardia (hemisfério norte, inverno
 * com geada), as 5 pragas/problemas mais prováveis e os materiais por etapa do projeto.
 * Tudo em objetos { pt, it } nativos. Edite aqui para ajustar o guia; sem fetch em runtime.
 */

// CALENDÁRIO ANUAL — um item por mês (mes = índice 0–11; 0 = janeiro).
// Coerência sazonal Lombardia: dez–fev inverno, mar–mai primavera, jun–ago verão, set–nov outono.
export const CALENDARIO = [
  {
    mes: 0, // Janeiro
    estacao: 'inverno',
    foco: { pt: 'Repouso protegido', it: 'Riposo protetto' },
    tarefas: [
      { pt: 'Mantenha dentro de casa, em luz forte (janela clara ou LED). Sem luz, ela enfraquece.', it: 'Tienila in casa, in luce forte (finestra chiara o LED). Senza luce si indebolisce.' },
      { pt: 'Regue pouco: só quando a superfície secar. No frio a planta bebe menos.', it: 'Annaffia poco: solo quando la superficie asciuga. Al freddo la pianta beve meno.' },
      { pt: 'Nada de adubo. Olhe a face de baixo das folhas: é mês de cochonilha no abrigo.', it: 'Niente concime. Controlla il rovescio delle foglie: è mese di cocciniglia al riparo.' },
    ],
  },
  {
    mes: 1, // Fevereiro
    estacao: 'inverno',
    foco: { pt: 'Fim do inverno', it: 'Fine inverno' },
    tarefas: [
      { pt: 'Continue dentro: fora ainda há geada. A lichia jovem morre perto de 0 °C.', it: 'Resta in casa: fuori c’è ancora gelo. Il litchi giovane muore vicino a 0 °C.' },
      { pt: 'O ar do aquecimento resseca: eleve a umidade do ambiente (bandeja com água/pedras) e afaste de correntes quentes.', it: 'L’aria del riscaldamento secca: alza l’umidità dell’ambiente (sottovaso con acqua/pietre) e allontana dalle correnti calde.' },
      { pt: 'Inspeção semanal de pragas — ar seco favorece ácaros, que são minúsculos.', it: 'Ispezione settimanale dei parassiti — l’aria secca favorisce gli acari, minuscoli.' },
    ],
  },
  {
    mes: 2, // Março
    estacao: 'primavera',
    foco: { pt: 'Acordar devagar', it: 'Risveglio lento' },
    tarefas: [
      { pt: 'Aumente a luz aos poucos: mais horas perto da janela mais clara da casa.', it: 'Aumenta la luce poco a poco: più ore vicino alla finestra più chiara.' },
      { pt: 'Volte a regar um pouco mais, acompanhando a planta. Ainda sem adubo.', it: 'Torna ad annaffiare un po’ di più, seguendo la pianta. Ancora niente concime.' },
      { pt: 'NÃO ponha fora ainda: março ainda gela à noite na Lombardia.', it: 'NON metterla fuori ancora: a marzo gela ancora di notte in Lombardia.' },
    ],
  },
  {
    mes: 3, // Abril
    estacao: 'primavera',
    foco: { pt: 'Primeiro broto', it: 'Primo germoglio' },
    tarefas: [
      { pt: 'Ao surgir o primeiro broto novo, comece a adubar leve (dose fraca) — sinal de vigor.', it: 'Al primo germoglio nuovo, inizia a concimare leggero (dose debole) — segno di vigore.' },
      { pt: 'Aclimate à luz forte: leve fora poucas horas em dias amenos, depois recolha.', it: 'Acclimata alla luce forte: portala fuori poche ore nei giorni miti, poi ritirala.' },
      { pt: 'Atenção à geada tardia: previsão de noite fria, traga para dentro.', it: 'Occhio alla gelata tardiva: se è prevista notte fredda, rientrala.' },
    ],
  },
  {
    mes: 4, // Maio
    estacao: 'primavera',
    foco: { pt: 'Melhor mês p/ transplante', it: 'Mese migliore per il trapianto' },
    tarefas: [
      { pt: 'Passado o risco de geada, é a MELHOR janela para transplante/poda de raiz (anos futuros).', it: 'Passato il rischio gelo, è la MIGLIORE finestra per trapianto/potatura radice (anni futuri).' },
      { pt: 'Faça uma agressão de cada vez: transplante OU poda, nunca as duas juntas.', it: 'Una sola aggressione per volta: trapianto O potatura, mai entrambe insieme.' },
      { pt: 'Mude para fora em definitivo só com as noites já estáveis e quentes.', it: 'Spostala fuori in modo stabile solo a notti ormai stabili e calde.' },
    ],
  },
  {
    mes: 5, // Junho
    estacao: 'verao',
    foco: { pt: 'Crescimento livre', it: 'Crescita libera' },
    tarefas: [
      { pt: 'Sol da manhã pleno; deixe crescer livre para engrossar o tronco. Não pode agora.', it: 'Sole pieno del mattino; lascia crescere libera per ispessire il tronco. Non potare ora.' },
      { pt: 'Sombreie a garrafa transparente (não as folhas): a raiz não gosta de luz nem calor.', it: 'Ombreggia la bottiglia trasparente (non le foglie): la radice non ama luce né calore.' },
      { pt: 'Adube na fase de crescimento. Regue de manhã; cheque o substrato todo dia.', it: 'Concima in fase di crescita. Annaffia al mattino; controlla il substrato ogni giorno.' },
    ],
  },
  {
    mes: 6, // Julho
    estacao: 'verao',
    foco: { pt: 'Pico de calor', it: 'Picco di caldo' },
    tarefas: [
      { pt: 'Em onda de calor, regue 1–2× ao dia — úmido, nunca encharcado.', it: 'In ondata di calore, annaffia 1–2 volte al giorno — umido, mai zuppo.' },
      { pt: 'Proteja do sol forte do meio-dia; mantenha o ar úmido ao redor (sem molhar as folhas o tempo todo).', it: 'Riparala dal sole forte di mezzogiorno; mantieni umida l’aria intorno (senza bagnare le foglie di continuo).' },
      { pt: 'Vigie ácaros na face de baixo das folhas — o calor seco os multiplica.', it: 'Sorveglia gli acari sotto le foglie — il caldo secco li moltiplica.' },
    ],
  },
  {
    mes: 7, // Agosto
    estacao: 'verao',
    foco: { pt: 'Maturar os ramos', it: 'Maturare i rami' },
    tarefas: [
      { pt: 'Comece a reduzir o nitrogênio: broto mole no fim do verão não amadurece a tempo.', it: 'Inizia a ridurre l’azoto: germoglio molle a fine estate non matura in tempo.' },
      { pt: 'Não pode todas as pontas — é onde a lichia futura forma flor.', it: 'Non potare tutte le punte — è dove il futuro litchi forma il fiore.' },
      { pt: 'Mantenha a rega regular; a planta ainda está em pleno crescimento.', it: 'Mantieni l’irrigazione regolare; la pianta è ancora in piena crescita.' },
    ],
  },
  {
    mes: 8, // Setembro
    estacao: 'outono',
    foco: { pt: 'Desacelerar', it: 'Rallentare' },
    tarefas: [
      { pt: 'O crescimento diminui: reduza o adubo aos poucos. Pare o nitrogênio.', it: 'La crescita cala: riduci il concime a poco a poco. Ferma l’azoto.' },
      { pt: 'Aproveite os últimos dias quentes ao sol, com boa luz.', it: 'Sfrutta le ultime giornate calde al sole, con buona luce.' },
      { pt: 'Reduza a rega acompanhando o ritmo mais lento da planta.', it: 'Riduci l’irrigazione seguendo il ritmo più lento della pianta.' },
    ],
  },
  {
    mes: 9, // Outubro
    estacao: 'outono',
    foco: { pt: 'Preparar o abrigo', it: 'Preparare il riparo' },
    tarefas: [
      { pt: 'A 1ª geada pode chegar: prepare o lugar dentro de casa (janela clara ou LED).', it: 'La prima gelata può arrivare: prepara il posto in casa (finestra chiara o LED).' },
      { pt: 'Traga para dentro antes da primeira noite de geada — não arrisque.', it: 'Portala dentro prima della prima notte di gelo — non rischiare.' },
      { pt: 'Inspecione bem antes de entrar: não leve pragas para o abrigo de inverno.', it: 'Ispeziona bene prima di entrare: non portare parassiti nel riparo invernale.' },
    ],
  },
  {
    mes: 10, // Novembro
    estacao: 'outono',
    foco: { pt: 'Já dentro de casa', it: 'Ormai in casa' },
    tarefas: [
      { pt: 'Se ainda estava fora, recolha agora: as geadas se firmam na Lombardia.', it: 'Se era ancora fuori, ritirala ora: le gelate si stabilizzano in Lombardia.' },
      { pt: 'Coloque na luz mais forte da casa; sem luz, a lichia definha no inverno.', it: 'Mettila nella luce più forte di casa; senza luce il litchi deperisce d’inverno.' },
      { pt: 'Comece a reduzir a rega; suspenda o adubo de vez.', it: 'Inizia a ridurre l’irrigazione; sospendi del tutto il concime.' },
    ],
  },
  {
    mes: 11, // Dezembro
    estacao: 'inverno',
    foco: { pt: 'Inverno em casa', it: 'Inverno in casa' },
    tarefas: [
      { pt: 'Fresco, claro e sem geada é o ideal — não uma sala quente e escura.', it: 'Fresco, luminoso e senza gelo è l’ideale — non una stanza calda e buia.' },
      { pt: 'Regue pouco, sem deixar secar de todo. Sem adubo no repouso.', it: 'Annaffia poco, senza far seccare del tutto. Niente concime nel riposo.' },
      { pt: 'Afaste de radiadores e portas frias; combata o ar seco com umidade no ambiente (bandeja com água).', it: 'Allontana da termosifoni e porte fredde; contrasta l’aria secca con umidità nell’ambiente (sottovaso con acqua).' },
    ],
  },
];

// PRAGAS E PROBLEMAS mais prováveis (5). Cada campo é uma frase prática.
export const PRAGAS = [
  {
    nome: { pt: 'Cochonilhas e escamas', it: 'Cocciniglie a scudetto' },
    sinal: { pt: 'Pontinhos marrons ou algodão branco grudados no caule e na face de baixo das folhas; folhas pegajosas.', it: 'Puntini marroni o cotone bianco attaccati al fusto e sotto le foglie; foglie appiccicose.' },
    causa: { pt: 'Típicas do abrigo de inverno: ar parado, quente e seco, sem predadores naturais.', it: 'Tipiche del riparo invernale: aria ferma, calda e secca, senza predatori naturali.' },
    acao: { pt: 'Remova à mão com cotonete e álcool; isole a planta e repita semanalmente até sumir.', it: 'Rimuovile a mano con cotton fioc e alcol; isola la pianta e ripeti ogni settimana.' },
  },
  {
    nome: { pt: 'Ácaros (aranha-vermelha)', it: 'Acari (ragnetto rosso)' },
    sinal: { pt: 'Folhas com pontilhado claro, depois amareladas; teia finíssima nas pontas dos brotos.', it: 'Foglie con puntinatura chiara, poi ingiallite; ragnatela finissima sulle punte.' },
    causa: { pt: 'Ar seco e quente (verão e aquecimento de inverno) — eles se multiplicam rápido.', it: 'Aria secca e calda (estate e riscaldamento invernale) — si moltiplicano in fretta.' },
    acao: { pt: 'Eleve a umidade do ambiente (bandeja com pedras e água, agrupe as plantas); lave a face de baixo com água; revise toda semana.', it: 'Alza l’umidità dell’ambiente (sottovaso con argilla/pietre e acqua, raggruppa le piante); lava il rovescio con acqua; controlla ogni settimana.' },
  },
  {
    nome: { pt: 'Clorose férrica', it: 'Clorosi ferrica' },
    sinal: { pt: 'Folhas NOVAS amarelas com as nervuras ainda verdes — falta de ferro disponível.', it: 'Foglie NUOVE gialle con le nervature ancora verdi — carenza di ferro disponibile.' },
    causa: { pt: 'Água ou substrato alcalino (calcário) trava o ferro; comum onde a água é "dura".', it: 'Acqua o substrato alcalino (calcareo) blocca il ferro; comune dove l’acqua è "dura".' },
    acao: { pt: 'Use água da chuva e aplique quelato de ferro Fe-EDDHA na rega — age mais que borrifar.', it: 'Usa acqua piovana e applica chelato di ferro Fe-EDDHA nell’acqua — agisce meglio della nebulizzazione fogliare.' },
  },
  {
    nome: { pt: 'Podridão de raiz', it: 'Marciume radicale' },
    sinal: { pt: 'Planta murcha mesmo com substrato úmido; caule mole na base; cheiro de mofo.', it: 'Pianta appassita pur con substrato umido; fusto molle alla base; odore di muffa.' },
    causa: { pt: 'Substrato encharcado, sem furos de drenagem ou pratinho com água parada.', it: 'Substrato fradicio, senza fori di drenaggio o sottovaso con acqua ferma.' },
    acao: { pt: 'Regue só quando secar; garanta muitos furos no fundo; nunca deixe água no pratinho.', it: 'Annaffia solo quando asciuga; assicura tanti fori sul fondo; mai acqua nel sottovaso.' },
  },
  {
    nome: { pt: 'Antracnose', it: 'Antracnosi' },
    sinal: { pt: 'Manchas escuras nas folhas e pontas dos brotos, que secam e morrem aos poucos.', it: 'Macchie scure su foglie e punte dei germogli, che seccano e muoiono a poco a poco.' },
    causa: { pt: 'Fungo favorecido por clima úmido e ar parado, sobretudo em folhas sempre molhadas.', it: 'Fungo favorito da clima umido e aria ferma, soprattutto su foglie sempre bagnate.' },
    acao: { pt: 'Melhore a ventilação; regue o substrato, não as folhas; corte e descarte as partes doentes.', it: 'Migliora la ventilazione; annaffia il substrato, non le foglie; taglia e butta le parti malate.' },
  },
];

// MATERIAIS por etapa do projeto (do agora ao bonsai maduro).
export const MATERIAIS = [
  {
    etapa: { pt: 'Agora', it: 'Adesso' },
    quando: { pt: 'Muda na garrafa PET — primeiro ano', it: 'Piantina nella bottiglia PET — primo anno' },
    itens: [
      { pt: 'Garrafa PET opaca por fora (ou vaso pequeno bem drenante) — luz na raiz prejudica.', it: 'Bottiglia PET opaca all’esterno (o vasetto ben drenante) — la luce sulla radice la danneggia.' },
      { pt: 'Substrato granular drenante — raiz fina precisa de ar, não de terra que compacta.', it: 'Substrato granulare drenante — la radice fine vuole aria, non terra che compatta.' },
      { pt: 'Palito de bambu — acomodar o substrato entre as raízes sem feri-las.', it: 'Bastoncino di bambù — sistemare il substrato tra le radici senza ferirle.' },
      { pt: 'Borrifador — umedecer o ambiente e limpar a face de baixo das folhas.', it: 'Nebulizzatore — inumidire l’ambiente e pulire il rovescio delle foglie.' },
      { pt: 'Tesoura fina — cortes limpos cicatrizam melhor.', it: 'Forbici sottili — tagli netti cicatrizzano meglio.' },
      { pt: 'Etiqueta — anotar data e fase, para não perder o histórico.', it: 'Etichetta — segnare data e fase, per non perdere lo storico.' },
      { pt: 'Régua — medir a altura sempre do mesmo jeito.', it: 'Righello — misurare l’altezza sempre allo stesso modo.' },
      { pt: 'Medidor de pH simples — a lichia gosta de levemente ácido (pH ~5,8–6,5).', it: 'Misuratore di pH semplice — il litchi ama leggermente acido (pH ~5,8–6,5).' },
    ],
  },
  {
    etapa: { pt: 'Ano 1–3', it: 'Anno 1–3' },
    quando: { pt: 'Dar movimento e começar a engrossar', it: 'Dare movimento e iniziare a ispessire' },
    itens: [
      { pt: 'Arame de alumínio — dar curvas ao tronco enquanto é flexível (madeira velha racha).', it: 'Filo di alluminio — dare curve al tronco finché è flessibile (il legno vecchio si spacca).' },
      { pt: 'Alicate — cortar e ajustar o arame sem ferir a casca.', it: 'Pinza — tagliare e regolare il filo senza ferire la corteccia.' },
      { pt: 'Vaso de treino maior — tronco grosso só cresce com raiz com espaço.', it: 'Vaso di allenamento più grande — il tronco grosso cresce solo con radici spaziose.' },
      { pt: 'Tela de dreno — cobre os furos: segura o substrato, deixa a água sair.', it: 'Rete da drenaggio — copre i fori: trattiene il substrato, fa uscire l’acqua.' },
      { pt: 'Pasta cicatrizante — proteger cortes grandes de fungos e secagem.', it: 'Pasta cicatrizzante — proteggere i tagli grandi da funghi e disseccamento.' },
      { pt: 'Adubo orgânico — alimentar o crescimento forte da fase de engrossamento.', it: 'Concime organico — nutrire la crescita forte della fase di ispessimento.' },
      { pt: 'Quelato de ferro (Fe-EDDHA) — corrigir folha nova amarela (clorose).', it: 'Chelato di ferro (Fe-EDDHA) — correggere la foglia nuova gialla (clorosi).' },
    ],
  },
  {
    etapa: { pt: 'Ano 3–10', it: 'Anno 3–10' },
    quando: { pt: 'Construir tronco e galhos principais', it: 'Costruire tronco e rami principali' },
    itens: [
      { pt: 'Caixa de treino ou colander (escorredor furado) — raiz arejada engrossa o tronco rápido.', it: 'Cassetta di allenamento o colander (scolapasta forato) — radice areata ispessisce il tronco in fretta.' },
      { pt: 'Ferramentas de poda robustas — cortar galhos já lenhosos.', it: 'Attrezzi di potatura robusti — tagliare rami ormai legnosi.' },
      { pt: 'Serrote pequeno — para os cortes que a tesoura não vence.', it: 'Seghetto piccolo — per i tagli che le forbici non fanno.' },
      { pt: 'Ganchos de raiz — desembaraçar e abrir as raízes no transplante.', it: 'Uncini da radice — districare e aprire le radici al trapianto.' },
      { pt: 'Câmera fixa — fotografar sempre a mesma frente, com escala, para ver a evolução.', it: 'Macchina fotografica fissa — riprendere sempre lo stesso fronte, con scala, per l’evoluzione.' },
    ],
  },
  {
    etapa: { pt: 'Ano 10+', it: 'Anno 10+' },
    quando: { pt: 'Refinar e aproximar do vaso', it: 'Rifinire e avvicinare al vaso' },
    itens: [
      { pt: 'Vasos de treino mais baixos — preparar a árvore para o vaso raso de bonsai.', it: 'Vasi di allenamento più bassi — preparare l’albero al vaso basso da bonsai.' },
      { pt: 'Vaso cerâmico provisório — testar a estética antes do vaso definitivo.', it: 'Vaso in ceramica provvisorio — provare l’estetica prima del vaso definitivo.' },
      { pt: 'Ferramentas finas de acabamento — refinar a ramificação secundária.', it: 'Attrezzi fini di finitura — rifinire la ramificazione secondaria.' },
    ],
  },
  {
    etapa: { pt: 'Ano 18+', it: 'Anno 18+' },
    quando: { pt: 'Maturidade e exposição', it: 'Maturità ed esposizione' },
    itens: [
      { pt: 'Vaso definitivo — escolhido para combinar com o tronco e a copa já prontos.', it: 'Vaso definitivo — scelto per intonarsi con tronco e chioma ormai pronti.' },
      { pt: 'Mesa ou suporte — elevar a árvore melhora ventilação, inspeção e estética.', it: 'Tavolino o supporto — sollevare l’albero migliora aria, ispezione ed estetica.' },
      { pt: 'Musgo — cobrir a superfície e valorizar o nebari (a base de raízes).', it: 'Muschio — coprire la superficie e valorizzare il nebari (la base delle radici).' },
      { pt: 'Top dressing — cobertura que protege o substrato e dá acabamento ao vaso.', it: 'Top dressing — copertura che protegge il substrato e rifinisce il vaso.' },
    ],
  },
];
