import { inicializarTema } from "../src/core/theme.js";
import { accountService } from "./account-service.js";
import "./data/content.js";
import "./data/quiz-base.js";
import "./data/carteggio.js";
import contentPt from "./data/content-pt.json";
import quizPt from "./data/quiz-pt.json";
import exercisesPt from "./data/carteggio-pt.json";
import glossary from "./data/glossary.json";
import chartData from "./data/chart-points.json";
import authoritativeSources from "./data/authoritative-sources.json";
import questionAuthority from "./data/question-authority.json";
import { placeRouteLabels, projectChartPoint } from "./chart-layout.js";
import {
  buildExerciseAnswers,
  splitExercisePrompt,
} from "./exercise-answers-calc.js";
import dm323PdfUrl from "./sources/dm-323-2021-programma-esame.pdf?url";
import quizPdfUrl from "./sources/quiz-ministeriali-dd-131-2022.pdf?url";
import chartPdfUrl from "./sources/quiz-e-carteggio-dd-10-2022.pdf?url";
import chart5dUrl from "./carta nautica 5D con bordo.jpg?url";
import chart5dEnhancedPdfUrl from "./Carta 5D 340dpi migliorata.pdf?url";

const content = window.PATENTE_CONTENT;
const quiz = window.PATENTE_QUIZ;
const exercises = window.PATENTE_CARTEGGIO;
const figureModules = import.meta.glob("./assets/quiz-images/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});
const authoritySourceModules = import.meta.glob(
  "./sources/authoritative/*.{pdf,html}",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value = "") =>
  String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
const norm = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const shuffle = (array) => {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
};

const MODE_KEY = "rotta12-language-mode";
const PROFILE_KEY = "rotta12-study-profile-v1";
const VALID_MODES = new Set(["it", "pt", "both"]);
const quizPtMap = new Map(quizPt.map((item) => [item.id, item]));
const exercisePtMap = new Map(exercisesPt.map((item) => [item.id, item]));
const chapterPtMap = new Map(
  contentPt.chapters.map((chapter) => [chapter.id, chapter]),
);
const chartPointMap = new Map(
  chartData.points.map((point) => [point.id, point]),
);
const exerciseRouteMap = new Map(
  chartData.exercises.map((route) => [route.id, route]),
);
const questionAuthorityMap = new Map(
  questionAuthority.references.map((reference) => [reference.id, reference]),
);
const authoritySourceMap = new Map(
  authoritativeSources.sources.map((source) => [source.id, source]),
);
const authorityLocalUrls = {
  "dm-323-2021-programma-esame.pdf": dm323PdfUrl,
  "quiz-ministeriali-dd-131-2022.pdf": quizPdfUrl,
  ...Object.fromEntries(
    Object.entries(authoritySourceModules).map(([path, url]) => [
      path.replace("./sources/", ""),
      url,
    ]),
  ),
};
const localPdfUrls = {
  dm323: dm323PdfUrl,
  dd131: quizPdfUrl,
  dd10: `${chartPdfUrl}#page=161`,
};

const UI = {
  skipContent: ["Vai al contenuto", "Ir para o conteúdo"],
  brandSubtitle: ["patente nautica · motore", "habilitação náutica · motor"],
  navDashboard: ["Panoramica", "Visão geral"],
  navQuiz: ["Quiz ministeriali", "Questões ministeriais"],
  navCarteggio: ["50 esercizi", "50 exercícios"],
  navSources: ["Fonti", "Fontes"],
  officialPrevailsShort: [
    "La traduzione aiuta lo studio. All'esame prevale l'italiano ufficiale.",
    "A tradução auxilia o estudo. No exame prevalece o italiano oficial.",
  ],
  globalSearchPlaceholder: [
    "Cerca in italiano o portoghese…",
    "Busque em italiano ou português…",
  ],
  languageModeLabel: ["Modalità lingua", "Modo de idioma"],
  backPortfolio: ["Torna a Engenharia NATA", "Voltar à Engenharia NATA"],
  translationAidTitle: ["Traduzione di supporto", "Tradução de apoio"],
  translationAidText: [
    "Il testo italiano è la fonte ufficiale e prevale sempre durante l'esame.",
    "O texto italiano é a fonte oficial e sempre prevalece durante o exame.",
  ],
  studyDeck: ["PLANCIA DI STUDIO", "PAINEL DE ESTUDO"],
  heroTitle: [
    "La rotta più chiara verso la tua<br><em>patente nautica.</em>",
    "A rota mais clara para sua<br><em>habilitação náutica.</em>",
  ],
  heroLead: [
    "Programma ordinato, <strong>1.472 quesiti ufficiali</strong> e 50 esercizi di carteggio, ricercabili anche in portoghese.",
    "Programa organizado, <strong>1.472 questões oficiais</strong> e 50 exercícios de carta, pesquisáveis também em italiano.",
  ],
  openChartTraining: ["Apri carta ed esercizi", "Abrir carta e exercícios"],
  startSimulation: ["Avvia simulazione", "Iniciar simulado"],
  fromCoast: ["dalla costa", "da costa"],
  officialBank: ["Banca dati BASE", "Banco oficial BASE"],
  officialQuestions: ["quesiti ufficiali", "questões oficiais"],
  baseQuiz: ["Quiz base", "Prova base"],
  basePass: ["almeno 16 risposte esatte", "pelo menos 16 respostas corretas"],
  chartwork: ["Carteggio", "Carta náutica"],
  chartPass: ["almeno 4 risposte esatte", "pelo menos 4 respostas corretas"],
  exercises: ["Esercizi", "Exercícios"],
  solutionsTolerance: [
    "con soluzione e tolleranza",
    "com solução e tolerância",
  ],
  officialComposition: ["COMPOSIZIONE UFFICIALE", "COMPOSIÇÃO OFICIAL"],
  eightSubjects: [
    "Le 8 materie della prova base",
    "As 8 matérias da prova base",
  ],
  trainSubjects: ["Allenati per materia", "Treinar por matéria"],
  recommendedRoute: ["ROTTA CONSIGLIATA", "ROTA RECOMENDADA"],
  fourStages: ["Piano in quattro tappe", "Plano em quatro etapas"],
  documentBase: ["BASE DOCUMENTALE", "BASE DOCUMENTAL"],
  whatOfficial: ["Che cosa è ufficiale?", "O que é oficial?"],
  officialDocs: [
    "Formato e programma: <strong>DM 323/2021</strong>. Quesiti BASE: <strong>DD 131/2022</strong>. Carteggio: <strong>DD 10/2022</strong>.",
    "Formato e programa: <strong>DM 323/2021</strong>. Questões BASE: <strong>DD 131/2022</strong>. Carta: <strong>DD 10/2022</strong>.",
  ],
  verifySources: ["Verifica le fonti", "Verificar fontes"],
  officialDatabase: ["BANCA DATI UFFICIALE", "BANCO DE DADOS OFICIAL"],
  ministerialQuiz: ["Quiz ministeriali", "Questões ministeriais"],
  quizDescription: [
    "Tutti i 1.472 quesiti BASE del DD 131/2022 con 103 figure ufficiali.",
    "Todas as 1.472 questões BASE do DD 131/2022 com 103 figuras oficiais.",
  ],
  officialSimulation: ["SIMULAZIONE UFFICIALE", "SIMULADO OFICIAL"],
  completeBaseTest: ["Prova base completa", "Prova base completa"],
  simulationDescription: [
    "20 quesiti nelle 8 materie, 30 minuti e almeno 16 risposte esatte.",
    "20 questões nas 8 matérias, 30 minutos e pelo menos 16 respostas corretas.",
  ],
  targetTraining: ["ALLENAMENTO MIRATO", "TREINO DIRECIONADO"],
  trainingByTopic: ["Allenamento per argomento", "Treino por assunto"],
  subject: ["Materia", "Matéria"],
  topic: ["Argomento", "Assunto"],
  trainTen: ["Allenati con 10 quesiti", "Treinar com 10 questões"],
  browseDatabase: ["ESPLORA LA BANCA DATI", "EXPLORAR O BANCO"],
  searchQuestions: ["Cerca nei 1.472 quesiti", "Buscar nas 1.472 questões"],
  bankSearchPlaceholder: [
    "Es.: fanali, ancora, bussola…",
    "Ex.: luzes, âncora, bússola…",
  ],
  showMoreQuestions: ["Mostra altri quesiti", "Mostrar mais questões"],
  allQuestionsVisible: [
    "Tutti i quesiti filtrati sono visibili",
    "Todas as questões filtradas estão visíveis",
  ],
  filterProgress: ["Stato di studio", "Progresso"],
  progressAll: ["Tutti gli stati", "Todos os status"],
  progressUnseen: ["Non ancora visti", "Ainda não vistas"],
  progressAnswered: ["Già risposti", "Já respondidas"],
  progressCorrect: ["Ultima risposta esatta", "Último acerto"],
  progressReview: ["Da ripassare", "Para revisar"],
  clearFilters: ["Azzera filtri", "Limpar filtros"],
  selectedQuestions: ["selezionati", "selecionadas"],
  randomCount: ["Numero di quesiti", "Número de questões"],
  randomFiltered: [
    "Quiz casuale dai risultati",
    "Quiz aleatório dos resultados",
  ],
  startSelected: ["Allenati sui selezionati", "Treinar as selecionadas"],
  selectQuestion: ["Seleziona il quesito", "Selecionar a questão"],
  noSelectedQuestions: [
    "Seleziona almeno un quesito dalla banca dati.",
    "Selecione pelo menos uma questão no banco.",
  ],
  studyProfile: ["Profilo di studio", "Perfil de estudo"],
  accountProfile: ["ACCOUNT ROTTA 12", "CONTA ROTTA 12"],
  cloudProfile: ["PROGRESSI SINCRONIZZATI", "PROGRESSO SINCRONIZADO"],
  accountLead: [
    "Accedi da qualsiasi dispositivo e ritrova i quesiti già svolti.",
    "Entre de qualquer dispositivo e encontre as questões já respondidas.",
  ],
  accountOfflineLead: [
    "Il server non è raggiungibile: puoi continuare offline su questo dispositivo.",
    "O servidor está indisponível: você pode continuar offline neste dispositivo.",
  ],
  signIn: ["Accedi", "Entrar"],
  createAccount: ["Crea account", "Criar conta"],
  manageAccount: ["Il mio account", "Minha conta"],
  useLocalProfile: [
    "Usa solo questo dispositivo",
    "Usar somente este aparelho",
  ],
  usernameOrEmail: ["Nome utente o email", "Usuário ou e-mail"],
  usernameOrEmailHint: [
    "Scegli un nome utente oppure usa direttamente la tua email.",
    "Escolha um usuário ou use diretamente seu e-mail.",
  ],
  displayName: ["Nome visualizzato (facoltativo)", "Nome exibido (opcional)"],
  password: ["Password", "Senha"],
  currentPassword: ["Password attuale", "Senha atual"],
  newPassword: ["Nuova password", "Nova senha"],
  confirmPassword: ["Conferma password", "Confirmar senha"],
  passwordRule: ["Almeno 8 caratteri.", "No mínimo 8 caracteres."],
  forgotPassword: ["Password dimenticata?", "Esqueceu a senha?"],
  sendReset: ["Invia link di recupero", "Enviar link de recuperação"],
  resetSent: [
    "Se l'account ha un'email valida, riceverai un link di recupero.",
    "Se a conta tiver um e-mail válido, você receberá um link de recuperação.",
  ],
  accountCreated: ["Account creato e collegato.", "Conta criada e conectada."],
  accountConnected: ["Account collegato.", "Conta conectada."],
  accountError: [
    "Operazione non riuscita. Controlla i dati e riprova.",
    "Não foi possível concluir. Verifique os dados e tente novamente.",
  ],
  passwordsMismatch: [
    "Le password non coincidono.",
    "As senhas não coincidem.",
  ],
  invalidPassword: [
    "La password deve contenere almeno 8 caratteri.",
    "A senha deve ter pelo menos 8 caracteres.",
  ],
  syncedNow: ["Sincronizzato ora", "Sincronizado agora"],
  syncPending: ["Sincronizzazione in attesa", "Sincronização pendente"],
  offlineSaved: ["Salvato offline", "Salvo offline"],
  logout: ["Esci dall'account", "Sair da conta"],
  emailAddress: ["Indirizzo email", "Endereço de e-mail"],
  noEmail: ["Nessuna email associata", "Nenhum e-mail associado"],
  addOrChangeEmail: ["Aggiungi o cambia email", "Adicionar ou alterar e-mail"],
  sendEmailConfirmation: ["Invia conferma", "Enviar confirmação"],
  emailConfirmationSent: [
    "Controlla la nuova casella email per confermare.",
    "Verifique a nova caixa de e-mail para confirmar.",
  ],
  emailSaved: [
    "Email salvata. Potrai usarla subito per accedere.",
    "E-mail salvo. Você já pode usá-lo para entrar.",
  ],
  changePassword: ["Cambia password", "Alterar senha"],
  passwordChanged: ["Password aggiornata.", "Senha atualizada."],
  deleteAccount: ["Elimina account", "Excluir conta"],
  deleteAccountWarning: [
    "L'eliminazione è definitiva e cancella tutti i progressi sincronizzati. Inserisci la password per confermare.",
    "A exclusão é definitiva e apaga todo o progresso sincronizado. Informe a senha para confirmar.",
  ],
  accountDeleted: ["Account eliminato.", "Conta excluída."],
  localMode: ["PROFILO OFFLINE", "PERFIL OFFLINE"],
  backToLogin: ["Torna all'accesso", "Voltar ao login"],
  saveLocally: ["Salva localmente", "Salvar localmente"],
  chooseNewPassword: ["Scegli una nuova password", "Escolha uma nova senha"],
  confirmNewEmail: ["Conferma il nuovo indirizzo", "Confirme o novo endereço"],
  emailVerified: ["Email verificata.", "E-mail confirmado."],
  invalidOrExpiredLink: [
    "Il link non è valido o è scaduto.",
    "O link é inválido ou expirou.",
  ],
  localProfile: ["PROGRESSI LOCALI", "PROGRESSO LOCAL"],
  localProfileLead: [
    "Salva le risposte su questo dispositivo. Esporta il profilo per trasferirlo altrove.",
    "Salve as respostas neste dispositivo. Exporte o perfil para transferi-lo a outro aparelho.",
  ],
  createProfile: ["Crea profilo", "Criar perfil"],
  manageProfile: ["Gestisci profilo", "Gerenciar perfil"],
  profileName: ["Nome del profilo", "Nome do perfil"],
  profileNamePlaceholder: ["Es.: Andrea", "Ex.: André"],
  saveProfile: ["Salva profilo", "Salvar perfil"],
  exportProfile: ["Esporta JSON", "Exportar JSON"],
  importProfile: ["Importa JSON", "Importar JSON"],
  closeProfile: ["Chiudi il profilo", "Fechar perfil"],
  profilePrivacy: [
    "Nessuna password e nessun cloud: nome e progressi restano solo nel browser.",
    "Sem senha e sem nuvem: nome e progresso ficam somente no navegador.",
  ],
  profileSaved: ["Profilo salvato.", "Perfil salvo."],
  profileNameRequired: [
    "Inserisci un nome per il profilo.",
    "Informe um nome para o perfil.",
  ],
  profileImported: ["Profilo importato.", "Perfil importado."],
  invalidProfile: [
    "Il file non contiene un profilo Rotta 12 valido.",
    "O arquivo não contém um perfil Rotta 12 válido.",
  ],
  answeredQuestions: ["Risposti", "Respondidas"],
  unseenQuestions: ["Non visti", "Não vistas"],
  reviewQuestions: ["Da ripassare", "Para revisar"],
  accuracy: ["Precisione", "Aproveitamento"],
  startUnseenSimulation: [
    "Simulazione solo con non visti",
    "Simulado somente com não vistas",
  ],
  notEnoughUnseen: [
    "Servono almeno 20 quesiti non visti; ne restano {count}.",
    "São necessárias ao menos 20 questões não vistas; restam {count}.",
  ],
  progressSavedFor: [
    "I progressi saranno salvati per {name}.",
    "O progresso será salvo para {name}.",
  ],
  createProfileToTrack: [
    "Crea un profilo locale per distinguere quesiti visti, corretti e da ripassare.",
    "Crie um perfil local para distinguir questões vistas, corretas e para revisar.",
  ],
  withinTwelve: ["ESERCIZI ENTRO 12 MIGLIA", "EXERCÍCIOS ATÉ 12 MILHAS"],
  fiftyChartExercises: [
    "50 esercizi di carteggio",
    "50 exercícios de carta náutica",
  ],
  chartDescription: [
    "Spazio, tempo, velocità, consumo e coordinate sulla carta 5/D.",
    "Distância, tempo, velocidade, consumo e coordenadas na carta 5/D.",
  ],
  chart5dEyebrow: ["CARTA INTERATTIVA", "CARTA INTERATIVA"],
  chart5dTitle: ["Carta nautica didattica 5/D", "Carta náutica didática 5/D"],
  chart5dLead: [
    "Seleziona un esercizio per localizzare partenza, arrivo e rotta sulla griglia geografica.",
    "Selecione um exercício para localizar partida, chegada e rota na quadrícula geográfica.",
  ],
  chartControls: ["Comandi della carta", "Controles da carta"],
  chartViewportLabel: [
    "Carta 5/D interattiva con rotta evidenziata: trascina per spostarti e usa la rotellina o il gesto di pizzico per ingrandire",
    "Carta 5/D interativa com rota destacada: arraste para mover e use a roda do mouse ou o gesto de pinça para ampliar",
  ],
  chartGestureHint: [
    "Trascina per spostarti · rotellina o pizzico per lo zoom",
    "Arraste para mover · roda do mouse ou pinça para zoom",
  ],
  chartImageAlt: [
    "Carta nautica didattica 5/D dal Canale di Piombino al Promontorio Argentario",
    "Carta náutica didática 5/D do Canal de Piombino ao Promontório Argentario",
  ],
  zoomOut: ["Riduci", "Reduzir"],
  zoomIn: ["Ingrandisci", "Ampliar"],
  fitChart: ["Adatta", "Ajustar"],
  openFullChart: ["Apri PDF 340 DPI", "Abrir PDF em 340 DPI"],
  chartAccuracyNote: [
    "I punti usano il centro degli intervalli di tolleranza del fascicolo; dove l'intervallo non è stampato, la posizione è letta sulla carta 5/D. Verifica sempre il rilevamento sulla carta ufficiale.",
    "Os pontos usam o centro dos intervalos de tolerância do caderno; quando o intervalo não está impresso, a posição é lida na carta 5/D. Confira sempre a marcação na carta oficial.",
  ],
  departure: ["PARTENZA", "PARTIDA"],
  arrival: ["ARRIVO", "CHEGADA"],
  coordinates: ["Coordinate", "Coordenadas"],
  coordinateBasisDd10: [
    "Centro della tolleranza DD 10/2022",
    "Centro da tolerância DD 10/2022",
  ],
  coordinateBasisChart: [
    "Posizione letta sulla carta 5/D",
    "Posição lida na carta 5/D",
  ],
  showOnChart: ["Mostra sulla carta", "Mostrar na carta"],
  selectedExercise: ["Esercizio selezionato", "Exercício selecionado"],
  distance: ["Spazio", "Distância"],
  speed: ["Velocità", "Velocidade"],
  time: ["Tempo", "Tempo"],
  fuel: ["Carburante", "Combustível"],
  training: ["ALLENAMENTO", "TREINO"],
  chooseSector: [
    "Scegli un settore o estrai a sorte",
    "Escolha um setor ou sorteie",
  ],
  randomExercise: ["Estrai un esercizio", "Sortear exercício"],
  openPdf: ["Apri il fascicolo PDF", "Abrir o caderno PDF"],
  completeList: ["ELENCO COMPLETO", "LISTA COMPLETA"],
  allExercises: ["Tutti i 50 esercizi", "Todos os 50 exercícios"],
  traceability: ["TRACCIABILITÀ", "RASTREABILIDADE"],
  sourcesCriteria: ["Fonti e criteri", "Fontes e critérios"],
  sourcesDescription: [
    "Banca ministeriale, norme vigenti e riscontri tecnici istituzionali.",
    "Banco ministerial, normas vigentes e verificações técnicas institucionais.",
  ],
  officialRule: [
    "Regola semplice: la fonte ufficiale prevale.",
    "Regra simples: a fonte oficial prevalece.",
  ],
  officialRuleText: [
    "Il testo italiano della banca MIT determina la risposta d’esame. Per uso reale, norme, limiti, sanzioni e dotazioni vanno sempre controllati nella versione vigente collegata.",
    "O texto italiano do banco MIT determina a resposta do exame. Na prática, normas, limites, sanções e equipamentos devem ser conferidos na versão vigente indicada.",
  ],
  methodology: ["METODOLOGIA", "METODOLOGIA"],
  howBuilt: [
    "Come è stata costruita la raccolta",
    "Como a coleção foi construída",
  ],
  glossary: ["Glossario", "Glossário"],
  nauticalGlossary: ["Glossario nautico", "Glossário náutico"],
  closeGlossary: ["Chiudi il glossario", "Fechar glossário"],
  glossaryLead: [
    "Cerca termini italiani, equivalenti portoghesi e sinonimi d'uso.",
    "Busque termos italianos, equivalentes em português e sinônimos úteis.",
  ],
  glossarySearchPlaceholder: [
    "Es.: dritta, scarroccio, fanale…",
    "Ex.: boreste, abatimento, luz…",
  ],
  allSubjects: ["Tutte le materie", "Todas as matérias"],
  allTopics: ["Tutti gli argomenti", "Todos os assuntos"],
  allSectors: ["Tutti i settori", "Todos os setores"],
  questionsSingular: ["quesito", "questão"],
  questionsPlural: ["quesiti", "questões"],
  inDatabase: ["nella banca dati", "no banco de dados"],
  noQuestionFilter: [
    "Nessun quesito trovato per questo filtro.",
    "Nenhuma questão encontrada para o filtro.",
  ],
  officialTest: ["Simulazione ufficiale", "Simulado oficial"],
  practice: ["Allenamento", "Treino"],
  exercise: ["ESERCIZIO", "EXERCÍCIO"],
  officialFigure: ["Figura ufficiale", "Figura oficial"],
  correctAnswer: ["Risposta esatta.", "Resposta correta."],
  correctAnswerLetter: [
    "Risposta esatta: {letter}.",
    "Resposta correta: {letter}.",
  ],
  quit: ["Termina", "Encerrar"],
  viewResult: ["Vedi il risultato", "Ver resultado"],
  nextQuestion: ["Quesito successivo", "Próxima questão"],
  simulationResult: ["RISULTATO DELLA SIMULAZIONE", "RESULTADO DO SIMULADO"],
  trainingResult: ["RISULTATO DELL'ALLENAMENTO", "RESULTADO DO TREINO"],
  passedTitle: [
    "Rotta corretta: prova superata.",
    "Rota correta: prova aprovada.",
  ],
  failedTitle: [
    "Non ancora: ripassa e riprova.",
    "Ainda não: revise e tente novamente.",
  ],
  passedText: [
    "Hai raggiunto la soglia minima di {required} risposte esatte.",
    "Você atingiu o mínimo de {required} respostas corretas.",
  ],
  failedText: [
    "Hai totalizzato {correct} risposte esatte; l’obiettivo era {required}.",
    "Você acertou {correct}; o objetivo era {required}.",
  ],
  newTest: ["Nuova prova", "Nova prova"],
  answerReview: ["Risposte ufficiali", "Respostas oficiais"],
  answerReviewLead: [
    "Rivedi il testo italiano canonico, la traduzione di supporto e la risposta esatta.",
    "Revise o texto italiano canônico, a tradução de apoio e a resposta correta.",
  ],
  officialAnswer: ["Risposta ufficiale", "Resposta oficial"],
  noQuestions: ["Nessun quesito trovato.", "Nenhuma questão encontrada."],
  practiceAction: ["Esercitati", "Praticar"],
  studyInHandbook: ["Perché + fonti ufficiali", "Por quê + fontes oficiais"],
  handbookReference: ["RISPOSTA VERIFICATA", "RESPOSTA VERIFICADA"],
  handbookTitle: [
    "Risposta spiegata e fonti ufficiali",
    "Resposta explicada e fontes oficiais",
  ],
  handbookVerified: [
    "Quesito ministeriale verificato",
    "Questão ministerial verificada",
  ],
  handbookOfficialAnswer: [
    "Risposta ministeriale corretta",
    "Resposta ministerial correta",
  ],
  handbookWhy: ["Perché", "Por quê"],
  handbookSources: ["Fonti e riscontri", "Fontes e verificações"],
  handbookOfficialPage: [
    "Quesito {code} · pagina {page} di 338",
    "Questão {code} · página {page} de 338",
  ],
  handbookNotice: [
    "Il gabarito proviene dalla banca MIT 2022. Le spiegazioni sono originali di Rotta 12 e citano solo atti o fonti istituzionali. Per norme, sanzioni e dotazioni prevale sempre il testo vigente collegato.",
    "O gabarito vem do banco MIT 2022. As explicações são originais do Rotta 12 e citam apenas atos ou fontes institucionais. Para normas, sanções e equipamentos, prevalece sempre o texto vigente indicado.",
  ],
  openHandbookPage: [
    "Apri la fonte selezionata",
    "Abrir a fonte selecionada",
  ],
  closeHandbook: ["Chiudi la spiegazione", "Fechar a explicação"],
  handbookFrameTitle: [
    "Fonte ufficiale collegata al quesito",
    "Fonte oficial vinculada à questão",
  ],
  localCopy: ["Copia locale", "Cópia local"],
  officialOnline: ["Fonte ufficiale", "Fonte oficial"],
  previewSource: ["Consulta", "Consultar"],
  regulatoryCheck: [
    "Verifica normativa vigente",
    "Verifique a norma vigente",
  ],
  stableConcept: ["Concetto stabile", "Conceito estável"],
  noLocalCopy: [
    "Questa fonte resta sul sito istituzionale per evitare duplicazioni non necessarie.",
    "Esta fonte permanece no site institucional para evitar duplicações desnecessárias.",
  ],
  figure: ["figura", "figura"],
  solveChart: ["Risolvi sulla carta 5/D", "Resolva na carta 5/D"],
  showOfficialSolution: ["Mostra le risposte", "Mostrar respostas"],
  hideOfficialSolution: ["Nascondi le risposte", "Ocultar respostas"],
  showSolution: ["Mostra le risposte", "Mostrar respostas"],
  hideSolution: ["Nascondi le risposte", "Ocultar respostas"],
  acceptedRange: ["Intervallo accettato", "Intervalo aceito"],
  exactAnswer: ["Valore esatto", "Valor exato"],
  chartAnswerGuide: [
    "Quando sono indicati due estremi, è corretta qualsiasi risposta compresa nell’intervallo. Per le coordinate è mostrata la tolleranza di lettura sulla carta 5/D.",
    "Quando são indicados dois limites, qualquer resposta dentro do intervalo está correta. Para as coordenadas, é mostrada a tolerância de leitura na carta 5/D.",
  ],
  sourceSolutionTranscript: [
    "Trascrizione della soluzione di fonte",
    "Transcrição da solução da fonte",
  ],
  page: ["p.", "p."],
  openSource: ["Apri la fonte", "Abrir fonte"],
  officialQuiz: ["Quiz ufficiale", "Questão oficial"],
  noResultsFor: [
    "Nessun risultato per “{query}”.",
    "Nenhum resultado para “{query}”.",
  ],
  glossaryNoResults: ["Nessun termine trovato.", "Nenhum termo encontrado."],
  definition: ["Definizione", "Definição"],
  aliases: ["Sinonimi utili", "Sinônimos úteis"],
  closeMenu: ["Chiudi menu", "Fechar menu"],
  openMenu: ["Apri menu", "Abrir menu"],
};

const ROUTE_STAGES = [
  [
    ["Fondamenti dell’unità", "Fundamentos da embarcação"],
    ["Scafo, motori e sicurezza", "Casco, motores e segurança"],
  ],
  [
    ["Condotta consapevole", "Condução consciente"],
    ["Manovra, COLREG e segnalamento", "Manobra, COLREG e sinalização"],
  ],
  [
    ["Leggi il mare e la carta", "Leia o mar e a carta"],
    ["Meteo, rotta, bussola e stima", "Meteorologia, rota, bússola e estima"],
  ],
  [
    ["Consolida con la banca ufficiale", "Consolide com o banco oficial"],
    ["Allenamento e simulazioni complete", "Treino e simulados completos"],
  ],
];

const METHODS = [
  [
    "Ogni risposta è letta dal PDF ministeriale e collegata alla sua pagina esatta.",
    "Cada resposta é lida do PDF ministerial e ligada à sua página exata.",
  ],
  [
    "Le spiegazioni sono originali e non riproducono manuali o piattaforme didattiche private.",
    "As explicações são originais e não reproduzem manuais ou plataformas didáticas privadas.",
  ],
  [
    "Norme e riscontri provengono solo da Gazzetta, Normattiva e siti istituzionali.",
    "Normas e verificações vêm apenas da Gazzetta, Normattiva e sites institucionais.",
  ],
  [
    "Un controllo automatico impedisce quesiti senza fonte, pagine mancanti o gabariti duplicati.",
    "Uma verificação automática impede questões sem fonte, páginas ausentes ou gabaritos duplicados.",
  ],
];

let mode = VALID_MODES.has(localStorage.getItem(MODE_KEY))
  ? localStorage.getItem(MODE_KEY)
  : "it";
let quizState = null;
let studyProfile = loadStudyProfile();
const bankSelection = new Set();
let timerHandle = null;
let featuredExercise = exercises[0];
let toastHandle = null;
let chartZoom = 1;
const chartPointers = new Map();
let chartDrag = null;
let chartPinch = null;
let manualQuestionId = null;
let manualReturnFocus = null;
let manualSources = [];
let accountOnline = false;
let accountModalView = "login";
let syncState = "offline";
let syncHandle = null;
const pendingProgressSync = new Set();
let accountActionToken = "";

function pairValue(italian, portuguese) {
  if (mode === "pt") return portuguese || italian;
  if (mode === "both") return `${italian} · ${portuguese || italian}`;
  return italian;
}

function pairHtml(italian, portuguese, options = {}) {
  const italianText = italian || "";
  const portugueseText = portuguese || italianText;
  if (mode === "it") return esc(italianText);
  if (mode === "pt") return esc(portugueseText);
  const className = options.compact ? "lang-pair compact" : "lang-pair";
  return `<span class="${className}"><span class="lang-it" lang="it">${esc(italianText)}</span><span class="lang-pt" lang="pt-BR">${esc(portugueseText)}</span></span>`;
}

function ui(key, values = {}) {
  const entry = UI[key] || [key, key];
  let text = pairValue(entry[0], entry[1]);
  for (const [name, value] of Object.entries(values)) {
    text = text.replaceAll(`{${name}}`, value);
  }
  return text;
}

function uiHtml(key) {
  const entry = UI[key] || [key, key];
  if (mode === "it") return entry[0];
  if (mode === "pt") return entry[1];
  return `<span class="lang-pair"><span class="lang-it" lang="it">${entry[0]}</span><span class="lang-pt" lang="pt-BR">${entry[1]}</span></span>`;
}

function translatedChapter(chapter) {
  return chapterPtMap.get(chapter.id);
}

function validStudyProfile(value) {
  return Boolean(
    value &&
    value.version === 1 &&
    typeof value.name === "string" &&
    value.name.trim() &&
    value.progress &&
    typeof value.progress === "object" &&
    !Array.isArray(value.progress),
  );
}

function cleanStudyProfile(value) {
  if (!validStudyProfile(value)) return null;
  const validIds = new Set(quiz.map((item) => String(item.id)));
  const progress = {};
  for (const [questionId, record] of Object.entries(value.progress)) {
    if (!validIds.has(questionId) || !record || typeof record !== "object")
      continue;
    const attempts = Math.max(0, Number(record.attempts) || 0);
    const correct = Math.min(
      attempts,
      Math.max(0, Number(record.correct) || 0),
    );
    progress[questionId] = {
      attempts,
      correct,
      wrong: Math.max(0, attempts - correct),
      lastCorrect: Boolean(record.lastCorrect),
      lastAnswered:
        typeof record.lastAnswered === "string"
          ? record.lastAnswered
          : new Date(0).toISOString(),
      _remoteId:
        typeof record._remoteId === "string" ? record._remoteId : undefined,
    };
  }
  return {
    version: 1,
    id:
      typeof value.id === "string"
        ? value.id
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: value.name.trim().slice(0, 80),
    accountId:
      typeof value.accountId === "string" ? value.accountId : undefined,
    createdAt:
      typeof value.createdAt === "string"
        ? value.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date().toISOString(),
    progress,
  };
}

function loadStudyProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
    return cleanStudyProfile(stored);
  } catch {
    return null;
  }
}

function saveStudyProfile() {
  if (!studyProfile) return;
  studyProfile.updatedAt = new Date().toISOString();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(studyProfile));
}

function createStudyProfile(name) {
  const now = new Date().toISOString();
  studyProfile = {
    version: 1,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: name.trim().slice(0, 80),
    createdAt: now,
    updatedAt: now,
    progress: {},
  };
  saveStudyProfile();
}

function progressFor(questionId) {
  return studyProfile?.progress?.[String(questionId)] || null;
}

function progressStatus(questionId) {
  const progress = progressFor(questionId);
  if (!progress) return "unseen";
  return progress.lastCorrect ? "correct" : "review";
}

function profileStats() {
  const records = Object.values(studyProfile?.progress || {});
  const attempts = records.reduce(
    (total, record) => total + Number(record.attempts || 0),
    0,
  );
  const correct = records.reduce(
    (total, record) => total + Number(record.correct || 0),
    0,
  );
  return {
    answered: records.length,
    unseen: quiz.length - records.length,
    review: records.filter((record) => !record.lastCorrect).length,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
  };
}

function renderStudyProfile() {
  const panel = $("#studyProfilePanel");
  const authenticated = accountService.isAuthenticated;
  if (!studyProfile) {
    panel.innerHTML = `<div class="study-profile-copy"><span class="eyebrow">${ui("accountProfile")}</span><h2>${ui("studyProfile")}</h2><p>${accountOnline ? ui("accountLead") : ui("accountOfflineLead")}</p></div><div class="study-profile-actions"><button type="button" class="button primary" data-open-profile="login">${ui("signIn")}</button><button type="button" class="button ghost dark" data-open-profile="register">${ui("createAccount")}</button><button type="button" class="text-button" data-open-profile="local">${ui("useLocalProfile")}</button></div>`;
    return;
  }
  const stats = profileStats();
  const stateLabel =
    syncState === "synced"
      ? ui("syncedNow")
      : syncState === "pending"
        ? ui("syncPending")
        : ui("offlineSaved");
  panel.innerHTML = `<div class="study-profile-copy"><span class="eyebrow">${authenticated ? ui("cloudProfile") : ui("localProfile")}</span><h2>${esc(studyProfile.name)}</h2><p>${authenticated ? stateLabel : ui("localProfileLead")}</p></div><div class="profile-stats"><div><strong>${stats.answered}</strong><small>${ui("answeredQuestions")}</small></div><div><strong>${stats.unseen}</strong><small>${ui("unseenQuestions")}</small></div><div><strong>${stats.review}</strong><small>${ui("reviewQuestions")}</small></div><div><strong>${stats.accuracy}%</strong><small>${ui("accuracy")}</small></div></div><div class="study-profile-actions"><button type="button" class="button primary" id="startUnseenSimulation">${ui("startUnseenSimulation")}</button><button type="button" class="button ghost dark" data-open-profile="${authenticated ? "account" : "login"}">${authenticated ? ui("manageAccount") : ui("signIn")}</button>${authenticated ? "" : `<button type="button" class="text-button" data-open-profile="local">${ui("manageProfile")}</button>`}</div>`;
}

function accountDisplayName(record = accountService.current) {
  return (
    record?.displayName ||
    (record?.username?.startsWith("mail_") ? record.email : record?.username) ||
    record?.email ||
    ui("studyProfile")
  );
}

function accountTabs(active) {
  return `<div class="account-tabs"><button type="button" data-account-view="login" class="${active === "login" ? "is-active" : ""}">${ui("signIn")}</button><button type="button" data-account-view="register" class="${active === "register" ? "is-active" : ""}">${ui("createAccount")}</button></div>`;
}

function renderAccountModal() {
  const body = $("#accountModalBody");
  const current = accountService.current;
  $("#profileModalEyebrow").textContent =
    accountModalView === "local" ? ui("localMode") : ui("accountProfile");
  $("#profileModalTitle").textContent =
    accountModalView === "account" && current
      ? accountDisplayName(current)
      : ui("studyProfile");

  if (accountModalView === "account" && current) {
    body.innerHTML = `<p>${ui("accountLead")}</p><div class="account-identity"><strong>${esc(accountDisplayName(current))}</strong><small>${current.email ? esc(current.email) : ui("noEmail")}</small></div><section class="account-section"><h3>${ui("addOrChangeEmail")}</h3><form data-account-form="email"><label class="profile-name-label"><span>${ui("emailAddress")}</span><input name="email" type="email" required autocomplete="email"></label><label class="profile-name-label"><span>${ui("currentPassword")}</span><input name="password" type="password" required autocomplete="current-password"></label><button class="button ghost dark" type="submit">${ui("addOrChangeEmail")}</button></form></section><section class="account-section"><h3>${ui("changePassword")}</h3><form data-account-form="password"><label class="profile-name-label"><span>${ui("currentPassword")}</span><input name="oldPassword" type="password" required autocomplete="current-password"></label><label class="profile-name-label"><span>${ui("newPassword")}</span><input name="password" type="password" minlength="8" required autocomplete="new-password"></label><label class="profile-name-label"><span>${ui("confirmPassword")}</span><input name="passwordConfirm" type="password" minlength="8" required autocomplete="new-password"></label><button class="button ghost dark" type="submit">${ui("changePassword")}</button></form></section><div class="profile-modal-actions"><button type="button" class="button ghost dark" data-profile-export>${ui("exportProfile")}</button><label class="button ghost dark profile-import" for="profileImport">${ui("importProfile")}</label><button type="button" class="button ghost dark" data-account-logout>${ui("logout")}</button></div><details class="account-danger"><summary>${ui("deleteAccount")}</summary><p>${ui("deleteAccountWarning")}</p><form data-account-form="delete"><label class="profile-name-label"><span>${ui("password")}</span><input name="password" type="password" required autocomplete="current-password"></label><button class="button danger" type="submit">${ui("deleteAccount")}</button></form></details><p class="account-form-message" id="accountFormMessage" aria-live="polite"></p>`;
    return;
  }

  if (accountModalView === "local") {
    body.innerHTML = `<p>${ui("profilePrivacy")}</p><form data-account-form="local"><label class="profile-name-label"><span>${ui("profileName")}</span><input name="name" type="text" maxlength="80" required autocomplete="name" value="${esc(studyProfile?.name || "")}" placeholder="${esc(ui("profileNamePlaceholder"))}"></label><div class="profile-modal-actions"><button type="submit" class="button primary">${ui("saveLocally")}</button><button type="button" class="button ghost dark" data-profile-export ${studyProfile ? "" : "disabled"}>${ui("exportProfile")}</button><label class="button ghost dark profile-import" for="profileImport">${ui("importProfile")}</label>${accountOnline ? `<button type="button" class="text-button" data-account-view="login">${ui("signIn")}</button>` : ""}</div></form><p class="account-form-message" id="accountFormMessage" aria-live="polite"></p>`;
    return;
  }

  if (accountModalView === "forgot") {
    body.innerHTML = `<p>${ui("resetSent")}</p><form data-account-form="forgot"><label class="profile-name-label"><span>${ui("emailAddress")}</span><input name="identity" type="email" required autocomplete="email"></label><div class="profile-modal-actions"><button type="submit" class="button primary">${ui("sendReset")}</button><button type="button" class="text-button" data-account-view="login">${ui("backToLogin")}</button></div></form><p class="account-form-message" id="accountFormMessage" aria-live="polite"></p>`;
    return;
  }

  if (["reset", "email-change"].includes(accountModalView)) {
    const isReset = accountModalView === "reset";
    body.innerHTML = `<p>${isReset ? ui("chooseNewPassword") : ui("confirmNewEmail")}</p><form data-account-form="${accountModalView}"><label class="profile-name-label"><span>${isReset ? ui("newPassword") : ui("password")}</span><input name="password" type="password" minlength="8" required autocomplete="new-password"></label>${isReset ? `<label class="profile-name-label"><span>${ui("confirmPassword")}</span><input name="passwordConfirm" type="password" minlength="8" required autocomplete="new-password"></label>` : ""}<button type="submit" class="button primary">${isReset ? ui("changePassword") : ui("sendEmailConfirmation")}</button></form><p class="account-form-message" id="accountFormMessage" aria-live="polite"></p>`;
    return;
  }

  const isRegister = accountModalView === "register";
  body.innerHTML = `${accountTabs(accountModalView)}<p>${isRegister ? ui("usernameOrEmailHint") : ui("accountLead")}</p><form data-account-form="${isRegister ? "register" : "login"}">${isRegister ? `<label class="profile-name-label"><span>${ui("displayName")}</span><input name="displayName" type="text" maxlength="80" autocomplete="name"></label>` : ""}<label class="profile-name-label"><span>${ui("usernameOrEmail")}</span><input name="identity" type="text" minlength="3" maxlength="254" required autocomplete="username"></label><label class="profile-name-label"><span>${ui("password")}</span><input name="password" type="password" minlength="8" required autocomplete="${isRegister ? "new-password" : "current-password"}"></label>${isRegister ? `<label class="profile-name-label"><span>${ui("confirmPassword")}</span><input name="passwordConfirm" type="password" minlength="8" required autocomplete="new-password"></label><small class="form-hint">${ui("passwordRule")}</small>` : ""}<div class="profile-modal-actions"><button type="submit" class="button primary">${isRegister ? ui("createAccount") : ui("signIn")}</button>${isRegister ? "" : `<button type="button" class="text-button" data-account-view="forgot">${ui("forgotPassword")}</button>`}<button type="button" class="text-button" data-account-view="local">${ui("useLocalProfile")}</button></div></form><p class="account-form-message" id="accountFormMessage" aria-live="polite"></p>`;
}

function openProfileModal(view) {
  accountModalView =
    view || (accountService.isAuthenticated ? "account" : "login");
  renderAccountModal();
  $("#profileBackdrop").hidden = false;
  $("#profileModal").hidden = false;
  document.body.classList.add("profile-open");
  $("#accountModalBody input")?.focus();
}

function closeProfileModal() {
  $("#profileBackdrop").hidden = true;
  $("#profileModal").hidden = true;
  document.body.classList.remove("profile-open");
}

function exportStudyProfile() {
  if (!studyProfile) return;
  const blob = new Blob([JSON.stringify(studyProfile, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = `rotta12-${studyProfile.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "profilo"}.json`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

async function importStudyProfile(file) {
  try {
    const imported = JSON.parse(await file.text());
    const cleaned = cleanStudyProfile(imported);
    if (!cleaned) throw new Error("invalid profile");
    if (accountService.isAuthenticated) {
      cleaned.accountId = accountService.current.id;
      for (const [questionId, record] of Object.entries(cleaned.progress)) {
        delete record._remoteId;
        pendingProgressSync.add(questionId);
      }
    }
    studyProfile = cleaned;
    saveStudyProfile();
    renderStudyProfile();
    renderBank();
    closeProfileModal();
    showToast(ui("profileImported"));
    if (accountService.isAuthenticated) scheduleProgressSync();
  } catch {
    showToast(ui("invalidProfile"));
  }
}

function remoteProgressRecord(record) {
  return {
    attempts: Number(record.attempts || 0),
    correct: Number(record.correct || 0),
    wrong: Number(record.wrong || 0),
    lastCorrect: Boolean(record.lastCorrect),
    lastAnswered: record.lastAnswered,
    _remoteId: record.id,
  };
}

async function connectStudyAccount(record) {
  const remoteRecords = await accountService.loadProgress();
  const displayName = accountDisplayName(record);
  if (
    !studyProfile ||
    (studyProfile.accountId && studyProfile.accountId !== record.id)
  ) {
    createStudyProfile(displayName);
  }
  studyProfile.accountId = record.id;
  if (!studyProfile.name || studyProfile.name === ui("studyProfile")) {
    studyProfile.name = displayName;
  }

  const remoteByQuestion = new Map(
    remoteRecords.map((item) => [String(item.question), item]),
  );
  for (const [questionId, remote] of remoteByQuestion) {
    const local = studyProfile.progress[questionId];
    if (
      !local ||
      new Date(remote.lastAnswered).getTime() >
        new Date(local.lastAnswered).getTime()
    ) {
      studyProfile.progress[questionId] = remoteProgressRecord(remote);
    } else {
      local._remoteId = remote.id;
      if (
        new Date(local.lastAnswered).getTime() >
        new Date(remote.lastAnswered).getTime()
      ) {
        pendingProgressSync.add(questionId);
      }
    }
  }
  for (const questionId of Object.keys(studyProfile.progress)) {
    if (!remoteByQuestion.has(questionId)) pendingProgressSync.add(questionId);
  }
  saveStudyProfile();
  syncState = pendingProgressSync.size ? "pending" : "synced";
  renderStudyProfile();
  renderBank();
  if (pendingProgressSync.size) scheduleProgressSync();
}

function scheduleProgressSync(questionId) {
  if (questionId) pendingProgressSync.add(String(questionId));
  if (!accountService.isAuthenticated) return;
  syncState = "pending";
  renderStudyProfile();
  clearTimeout(syncHandle);
  syncHandle = setTimeout(flushProgressSync, 250);
}

async function flushProgressSync() {
  if (!accountService.isAuthenticated || !studyProfile) return;
  const questions = [...pendingProgressSync];
  for (const questionId of questions) {
    try {
      const local = studyProfile.progress[questionId];
      if (!local) continue;
      const remote = await accountService.upsertProgress(questionId, local);
      local._remoteId = remote.id;
      pendingProgressSync.delete(questionId);
      accountOnline = true;
    } catch {
      accountOnline = false;
      syncState = "offline";
      saveStudyProfile();
      renderStudyProfile();
      return;
    }
  }
  syncState = pendingProgressSync.size ? "pending" : "synced";
  saveStudyProfile();
  renderStudyProfile();
}

function accountMessage(message, isError = false) {
  const element = $("#accountFormMessage");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function validatePasswords(password, confirmation = password) {
  if (password.length < 8) {
    accountMessage(ui("invalidPassword"), true);
    return false;
  }
  if (password !== confirmation) {
    accountMessage(ui("passwordsMismatch"), true);
    return false;
  }
  return true;
}

function clearAccountActionToken() {
  accountActionToken = "";
  const url = new URL(location.href);
  url.searchParams.delete("passwordResetToken");
  url.searchParams.delete("emailChangeToken");
  url.searchParams.delete("verificationToken");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

async function handleAccountSubmit(event) {
  const form = event.target.closest("[data-account-form]");
  if (!form) return;
  event.preventDefault();
  const submit = $("button[type='submit']", form);
  const data = Object.fromEntries(new FormData(form));
  if (submit) submit.disabled = true;
  accountMessage("");
  try {
    switch (form.dataset.accountForm) {
      case "login": {
        const record = await accountService.login(data.identity, data.password);
        accountOnline = true;
        await connectStudyAccount(record);
        closeProfileModal();
        showToast(ui("accountConnected"));
        break;
      }
      case "register": {
        if (!validatePasswords(data.password, data.passwordConfirm)) return;
        const record = await accountService.register(
          data.identity,
          data.password,
          data.displayName,
        );
        accountOnline = true;
        await connectStudyAccount(record);
        closeProfileModal();
        showToast(ui("accountCreated"));
        break;
      }
      case "local": {
        const name = data.name.trim();
        if (!name) {
          accountMessage(ui("profileNameRequired"), true);
          return;
        }
        if (studyProfile) {
          studyProfile.name = name.slice(0, 80);
          saveStudyProfile();
        } else createStudyProfile(name);
        renderStudyProfile();
        renderBank();
        closeProfileModal();
        showToast(ui("profileSaved"));
        break;
      }
      case "forgot":
        await accountService.requestPasswordReset(data.identity);
        accountMessage(ui("resetSent"));
        break;
      case "email":
        await accountService.changeEmail(data.email, data.password);
        accountMessage(ui("emailSaved"));
        form.reset();
        renderStudyProfile();
        break;
      case "password":
        if (!validatePasswords(data.password, data.passwordConfirm)) return;
        await accountService.changePassword(data.oldPassword, data.password);
        accountMessage(ui("passwordChanged"));
        form.reset();
        break;
      case "delete": {
        const accountId = accountService.current.id;
        await accountService.deleteAccount(data.password);
        if (studyProfile?.accountId === accountId) {
          studyProfile = null;
          localStorage.removeItem(PROFILE_KEY);
        }
        pendingProgressSync.clear();
        syncState = "offline";
        renderStudyProfile();
        renderBank();
        closeProfileModal();
        showToast(ui("accountDeleted"));
        break;
      }
      case "reset":
        if (!validatePasswords(data.password, data.passwordConfirm)) return;
        await accountService.confirmPasswordReset(
          accountActionToken,
          data.password,
        );
        clearAccountActionToken();
        accountModalView = "login";
        renderAccountModal();
        accountMessage(ui("passwordChanged"));
        break;
      case "email-change":
        await accountService.confirmEmailChange(
          accountActionToken,
          data.password,
        );
        clearAccountActionToken();
        accountModalView = accountService.isAuthenticated ? "account" : "login";
        renderAccountModal();
        accountMessage(ui("emailConfirmationSent"));
        break;
      default:
        break;
    }
  } catch {
    accountMessage(ui("accountError"), true);
  } finally {
    if (submit?.isConnected) submit.disabled = false;
  }
}

function logoutStudyAccount() {
  const accountId = accountService.current?.id;
  accountService.logout();
  if (studyProfile?.accountId === accountId) {
    studyProfile = null;
    localStorage.removeItem(PROFILE_KEY);
  }
  pendingProgressSync.clear();
  syncState = "offline";
  closeProfileModal();
  renderStudyProfile();
  renderBank();
}

async function initializeStudyAccount() {
  const url = new URL(location.href);
  try {
    const record = await accountService.initialize();
    accountOnline = true;
    if (record) await connectStudyAccount(record);
    const verificationToken = url.searchParams.get("verificationToken");
    if (verificationToken) {
      await accountService.confirmVerification(verificationToken);
      clearAccountActionToken();
      showToast(ui("emailVerified"));
    }
  } catch {
    accountOnline = false;
    syncState = "offline";
  }

  const resetToken = url.searchParams.get("passwordResetToken");
  const emailToken = url.searchParams.get("emailChangeToken");
  if (resetToken || emailToken) {
    accountActionToken = resetToken || emailToken;
    openProfileModal(resetToken ? "reset" : "email-change");
  }
  renderStudyProfile();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastHandle);
  toastHandle = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function figurePath(number) {
  const key = `./assets/quiz-images/figura-${String(number).padStart(3, "0")}.png`;
  return figureModules[key];
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function handbookMatchLabel(reference) {
  const rule = reference ? questionAuthority.rules[reference.rule] : null;
  return rule?.currency === "current-check"
    ? ui("regulatoryCheck")
    : ui("stableConcept");
}

function withPdfPage(url, page) {
  if (!url || !page) return url;
  return `${url.split("#")[0]}#page=${page}&zoom=120`;
}

function authorityLocalUrl(source, sourceReference) {
  const url = source.localFile
    ? authorityLocalUrls[source.localFile]
    : undefined;
  return withPdfPage(url, sourceReference.page);
}

function authorityOfficialUrl(source, sourceReference) {
  return withPdfPage(source.officialUrl, sourceReference.page);
}

function authorityBundle(question) {
  const reference = questionAuthorityMap.get(question.id);
  const rule = reference ? questionAuthority.rules[reference.rule] : null;
  if (!reference || !rule) return null;
  const officialReference = {
    source: "mit-quiz-2022",
    page: reference.officialPage,
    locatorIt: UI.handbookOfficialPage[0]
      .replace("{code}", question.code)
      .replace("{page}", reference.officialPage),
    locatorPt: UI.handbookOfficialPage[1]
      .replace("{code}", question.code)
      .replace("{page}", reference.officialPage),
  };
  const combined = [
    officialReference,
    ...rule.sources,
    ...(reference.sourceRefs || []),
  ];
  const seen = new Set();
  const sources = combined
    .filter((sourceReference) => {
      const key = `${sourceReference.source}|${sourceReference.page || ""}|${sourceReference.locatorIt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return authoritySourceMap.has(sourceReference.source);
    })
    .map((sourceReference) => ({
      ...sourceReference,
      sourceData: authoritySourceMap.get(sourceReference.source),
    }));
  const primarySource = reference.primarySource || rule.primarySource;
  sources.sort((left, right) => {
    if (left.source === primarySource) return -1;
    if (right.source === primarySource) return 1;
    if (left.source === "mit-quiz-2022") return -1;
    if (right.source === "mit-quiz-2022") return 1;
    return 0;
  });
  return { reference, rule, sources };
}

function authoritySourceCards(sources) {
  return sources
    .map(({ sourceData: source, ...sourceReference }, index) => {
      const localUrl = authorityLocalUrl(source, sourceReference);
      const locator = pairHtml(
        sourceReference.locatorIt,
        sourceReference.locatorPt,
        { compact: true },
      );
      return `<article class="authority-source-card">
        <span>${pairHtml(source.status, source.statusPt, { compact: true })}</span>
        <h3>${pairHtml(source.title, source.titlePt)}</h3>
        <p>${locator}</p>
        <div>
          <button type="button" data-authority-preview="${index}">${ui("previewSource")}</button>
          ${
            localUrl
              ? `<a href="${esc(localUrl)}" target="_blank" rel="noopener">${ui("localCopy")} ↗</a>`
              : ""
          }
          <a href="${esc(authorityOfficialUrl(source, sourceReference))}" target="_blank" rel="noopener">${ui("officialOnline")} ↗</a>
        </div>
      </article>`;
    })
    .join("");
}

function selectAuthoritySource(index) {
  const selected = manualSources[index];
  if (!selected) return;
  const { sourceData: source, ...sourceReference } = selected;
  const localUrl = authorityLocalUrl(source, sourceReference);
  const officialUrl = authorityOfficialUrl(source, sourceReference);
  const frame = $("#handbookFrame");
  frame.title = ui("handbookFrameTitle");
  $$(".authority-source-card").forEach((card, cardIndex) => {
    card.classList.toggle("is-selected", cardIndex === index);
  });
  if (localUrl) {
    frame.removeAttribute("srcdoc");
    frame.src = localUrl;
    $("#handbookNewTab").href = localUrl;
  } else {
    frame.src = "about:blank";
    frame.srcdoc = `<!doctype html><html lang="${mode === "pt" ? "pt-BR" : "it"}"><meta charset="utf-8"><style>body{margin:0;padding:36px;font:16px/1.6 system-ui;color:#16323a;background:#f7f6f1}main{max-width:760px;margin:auto}h1{font:700 28px Georgia,serif}p{color:#52676d}a{display:inline-block;margin-top:16px;padding:12px 16px;border-radius:8px;color:white;background:#0c7180;text-decoration:none;font-weight:700}</style><main><small>${esc(pairValue(source.authority, source.authority))}</small><h1>${esc(pairValue(source.title, source.titlePt))}</h1><p>${esc(pairValue(source.noteIt, source.notePt))}</p><p>${esc(ui("noLocalCopy"))}</p><a href="${esc(officialUrl)}" target="_blank" rel="noopener">${esc(ui("officialOnline"))} ↗</a></main></html>`;
    $("#handbookNewTab").href = officialUrl;
  }
  $("#handbookSelectedSource").innerHTML = pairHtml(
    source.title,
    source.titlePt,
    { compact: true },
  );
}

function handbookButton(question, compact = false) {
  const reference = questionAuthorityMap.get(question.id);
  if (!reference) return "";
  return `<button type="button" class="handbook-button${compact ? " compact" : ""}" data-open-handbook="${question.id}"><span>${esc(question.code)}</span><strong>${ui("studyInHandbook")}</strong></button>`;
}

function openHandbook(questionId, returnFocus = true) {
  const question = quiz.find((item) => item.id === Number(questionId));
  const bundle = question ? authorityBundle(question) : null;
  if (!question || !bundle) return;
  const { reference, rule, sources } = bundle;
  if (returnFocus) manualReturnFocus = document.activeElement;
  manualQuestionId = question.id;
  manualSources = sources;
  const translated = quizPtMap.get(question.id);
  $("#handbookReferenceCode").textContent = question.code;
  $("#handbookReferenceQuestion").innerHTML = pairHtml(
    question.question,
    translated.question,
  );
  $("#handbookReferenceSection").innerHTML = pairHtml(
    rule.titleIt,
    rule.titlePt,
    { compact: true },
  );
  $("#handbookReferenceMatch").textContent = handbookMatchLabel(reference);
  $("#handbookReferenceMatch").className =
    `handbook-match ${rule.currency === "current-check" ? "related" : "direct"}`;
  $("#handbookOfficialAnswerText").innerHTML = pairHtml(
    question.answers[question.correct],
    translated.answers[question.correct],
  );
  $("#handbookWhyText").innerHTML = pairHtml(
    reference.specificIt || rule.principleIt,
    reference.specificPt || rule.principlePt,
  );
  $("#handbookSourceCards").innerHTML = authoritySourceCards(sources);
  $("#handbookBackdrop").hidden = false;
  $("#handbookModal").hidden = false;
  document.body.classList.add("handbook-open");
  selectAuthoritySource(0);
  $("#handbookClose").focus();
}

function closeHandbook() {
  if ($("#handbookModal").hidden) return;
  $("#handbookBackdrop").hidden = true;
  $("#handbookModal").hidden = true;
  $("#handbookFrame").src = "about:blank";
  $("#handbookFrame").removeAttribute("srcdoc");
  document.body.classList.remove("handbook-open");
  manualQuestionId = null;
  manualSources = [];
  manualReturnFocus?.focus?.();
  manualReturnFocus = null;
}

function updateStaticUi() {
  document.documentElement.lang = mode === "pt" ? "pt-BR" : "it";
  document.documentElement.dataset.studyMode = mode;
  document.title =
    mode === "pt"
      ? "Rotta 12 — Habilitação náutica a motor"
      : "Rotta 12 — Patente nautica a motore";
  $$("[data-ui]").forEach((element) => {
    element.textContent = ui(element.dataset.ui);
  });
  $$("[data-ui-html]").forEach((element) => {
    element.innerHTML = uiHtml(element.dataset.uiHtml);
  });
  $$("[data-ui-placeholder]").forEach((element) => {
    element.placeholder = ui(element.dataset.uiPlaceholder);
  });
  $$("[data-ui-title]").forEach((element) => {
    element.title = ui(element.dataset.uiTitle);
  });
  $$("[data-ui-aria]").forEach((element) => {
    element.setAttribute("aria-label", ui(element.dataset.uiAria));
  });
  $$(".mode-btn").forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const themeButton = $("#themeToggleGlobal");
  if (themeButton) {
    const dark = document.documentElement.dataset.theme === "dark";
    themeButton.setAttribute(
      "aria-label",
      mode === "it"
        ? dark
          ? "Attiva tema chiaro"
          : "Attiva tema scuro"
        : dark
          ? "Ativar tema claro"
          : "Ativar tema escuro",
    );
  }
}

function setMode(nextMode) {
  if (!VALID_MODES.has(nextMode)) return;
  mode = nextMode;
  localStorage.setItem(MODE_KEY, mode);
  sessionStorage.setItem("engnata_idioma", mode === "pt" ? "pt-BR" : "it-IT");
  updateStaticUi();
  renderDashboard();
  populateQuizFilters();
  renderStudyProfile();
  renderBank();
  renderExercises();
  renderSources();
  renderGlossary();
  if (!$("#profileModal").hidden) renderAccountModal();
  if (quizState?.finished) renderQuizResult();
  else if (quizState) renderQuestion();
  if (manualQuestionId) openHandbook(manualQuestionId, false);
}

function switchView(viewName, push = true) {
  $$(".view").forEach((view) =>
    view.classList.toggle("is-visible", view.id === `view-${viewName}`),
  );
  $$(".nav-item").forEach((item) =>
    item.classList.toggle("is-active", item.dataset.view === viewName),
  );
  if (push) history.replaceState(null, "", `#${viewName}`);
  document.body.classList.remove("menu-open");
  $("#menuToggle").setAttribute("aria-expanded", "false");
  $("#menuToggle").setAttribute("aria-label", ui("openMenu"));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (viewName === "carteggio") {
    setTimeout(() => focusChartRoute(true), 80);
  }
}

function renderDashboard() {
  $("#dashboardCategories").innerHTML = content.chapters
    .map((chapter) => {
      const chapterPt = translatedChapter(chapter);
      const questionLabel =
        chapter.examQuestions === 1
          ? ui("questionsSingular")
          : ui("questionsPlural");
      return `<article class="category-card" style="--cat:${chapter.color}" data-filter-theme="${esc(chapter.italian.toUpperCase())}" tabindex="0" role="button">
                <div class="cat-top"><span class="cat-icon">${chapter.icon}</span><span class="cat-weight">${chapter.examQuestions} ${questionLabel}</span></div>
                <h3>${pairHtml(chapter.title, chapterPt.title)}</h3><small>${chapter.bankCount} ${ui("questionsPlural")} ${ui("inDatabase")}</small>
            </article>`;
    })
    .join("");
  $("#studyRoute").innerHTML = ROUTE_STAGES.map(
    (stage, index) =>
      `<li><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${pairHtml(stage[0][0], stage[0][1], { compact: true })}</strong><small>${pairHtml(stage[1][0], stage[1][1], { compact: true })}</small></div></li>`,
  ).join("");
}

function sourceUrl(source) {
  if (authoritySourceMap.has(source.id)) {
    return (
      (source.localFile && authorityLocalUrls[source.localFile]) ||
      source.officialUrl
    );
  }
  return localPdfUrls[source.id] || source.url;
}

function populateQuizFilters() {
  const previousTheme = $("#trainingTheme").value;
  const previousBankTheme = $("#bankTheme").value;
  const themeOptions = content.chapters
    .map((chapter) => {
      const translated = translatedChapter(chapter);
      return `<option value="${esc(chapter.italian.toUpperCase())}">${esc(pairValue(chapter.title, translated.title))} · ${chapter.bankCount}</option>`;
    })
    .join("");
  $("#trainingTheme").innerHTML = themeOptions;
  $("#bankTheme").innerHTML =
    `<option value="">${ui("allSubjects")}</option>${themeOptions}`;
  if (
    [...$("#trainingTheme").options].some(
      (option) => option.value === previousTheme,
    )
  )
    $("#trainingTheme").value = previousTheme;
  if (
    [...$("#bankTheme").options].some(
      (option) => option.value === previousBankTheme,
    )
  )
    $("#bankTheme").value = previousBankTheme;
  updateTrainingTopics();
  updateBankTopics();
}

function updateTrainingTopics() {
  const theme = $("#trainingTheme").value;
  const previous = $("#trainingTopic").value;
  const topics = [
    ...new Set(
      quiz.filter((item) => item.theme === theme).map((item) => item.topic),
    ),
  ].sort((left, right) => left.localeCompare(right, "it"));
  $("#trainingTopic").innerHTML =
    `<option value="">${ui("allTopics")}</option>${topics
      .map((topic) => {
        const match = quiz.find(
          (item) => item.theme === theme && item.topic === topic,
        );
        const portuguese = match ? quizPtMap.get(match.id)?.topic : topic;
        return `<option value="${esc(topic)}">${esc(pairValue(topic, portuguese))}</option>`;
      })
      .join("")}`;
  if (topics.includes(previous)) $("#trainingTopic").value = previous;
}

function updateBankTopics() {
  const theme = $("#bankTheme").value;
  const previous = $("#bankTopic").value;
  const pool = quiz.filter((item) => !theme || item.theme === theme);
  const topics = [...new Set(pool.map((item) => item.topic))].sort(
    (left, right) => left.localeCompare(right, "it"),
  );
  $("#bankTopic").innerHTML =
    `<option value="">${ui("allTopics")}</option>${topics
      .map((topic) => {
        const match = pool.find((item) => item.topic === topic);
        const portuguese = match ? quizPtMap.get(match.id)?.topic : topic;
        return `<option value="${esc(topic)}">${esc(pairValue(topic, portuguese))}</option>`;
      })
      .join("")}`;
  if (topics.includes(previous)) $("#bankTopic").value = previous;
}

function officialSelection(pool = quiz) {
  const distribution = Object.fromEntries(
    content.chapters.map((chapter) => [
      chapter.italian.toUpperCase(),
      chapter.examQuestions,
    ]),
  );
  const targetCount = Object.values(distribution).reduce(
    (total, count) => total + count,
    0,
  );
  const selected = Object.entries(distribution).flatMap(([theme, count]) =>
    shuffle(pool.filter((item) => item.theme === theme)).slice(0, count),
  );
  const selectedIds = new Set(selected.map((item) => item.id));
  const fill = shuffle(pool.filter((item) => !selectedIds.has(item.id))).slice(
    0,
    Math.max(0, targetCount - selected.length),
  );
  return shuffle([...selected, ...fill]);
}

function startQuiz(quizMode, forcedQuestions = null) {
  clearInterval(timerHandle);
  const selected =
    forcedQuestions ||
    (quizMode === "official"
      ? officialSelection()
      : shuffle(
          quiz.filter(
            (item) =>
              item.theme === $("#trainingTheme").value &&
              (!$("#trainingTopic").value ||
                item.topic === $("#trainingTopic").value),
          ),
        ).slice(0, 10));
  if (!selected.length) {
    showToast(ui("noQuestionFilter"));
    return;
  }
  quizState = {
    mode: quizMode,
    questions: selected,
    index: 0,
    answers: Array(selected.length).fill(null),
    recorded: Array(selected.length).fill(false),
    seconds: quizMode === "official" ? content.exam.baseMinutes * 60 : null,
    finished: false,
  };
  $("#quizSetup").hidden = true;
  $("#quizResult").hidden = true;
  $("#quizRunner").hidden = false;
  if (quizState.seconds !== null) {
    timerHandle = setInterval(() => {
      quizState.seconds -= 1;
      const timer = $("#quizTimer");
      if (timer) {
        timer.textContent = formatTime(quizState.seconds);
        timer.classList.toggle("is-low", quizState.seconds <= 300);
      }
      if (quizState.seconds <= 0) finishQuiz();
    }, 1000);
  }
  renderQuestion();
  $("#quizRunner").scrollIntoView({ behavior: "smooth", block: "start" });
}

function recordQuizAnswer(index) {
  if (
    !studyProfile ||
    !quizState ||
    quizState.recorded[index] ||
    quizState.answers[index] === null
  )
    return false;
  const question = quizState.questions[index];
  const correct = quizState.answers[index] === question.correct;
  const key = String(question.id);
  const current = studyProfile.progress[key] || {
    attempts: 0,
    correct: 0,
    wrong: 0,
  };
  current.attempts += 1;
  current.correct += correct ? 1 : 0;
  current.wrong += correct ? 0 : 1;
  current.lastCorrect = correct;
  current.lastAnswered = new Date().toISOString();
  studyProfile.progress[key] = current;
  quizState.recorded[index] = true;
  scheduleProgressSync(question.id);
  return true;
}

function saveQuizProgress() {
  if (!studyProfile) return;
  saveStudyProfile();
  renderStudyProfile();
}

function renderQuestion() {
  if (!quizState || quizState.finished) return;
  const question = quizState.questions[quizState.index];
  const translated = quizPtMap.get(question.id);
  const answered = quizState.answers[quizState.index];
  const reveal = quizState.mode === "training" && answered !== null;
  $("#quizRunner").innerHTML = `<div class="quiz-runner-head">
        <div><div class="quiz-progress-text"><span>${quizState.mode === "official" ? ui("officialTest") : ui("practice")}</span><strong>${quizState.index + 1} / ${quizState.questions.length}</strong></div><div class="quiz-progress"><i style="width:${((quizState.index + 1) / quizState.questions.length) * 100}%"></i></div></div>
        <div class="quiz-timer" id="quizTimer">${quizState.seconds === null ? ui("exercise") : formatTime(quizState.seconds)}</div>
    </div>
    <div class="question-meta"><span>${esc(question.code)}</span><span>${pairHtml(question.theme, translated.theme, { compact: true })}</span><span>${pairHtml(question.topic, translated.topic, { compact: true })}</span></div>
    <h2 class="quiz-question">${pairHtml(question.question, translated.question)}</h2>
    ${question.figure ? `<img class="question-figure" src="${figurePath(question.figure)}" alt="${esc(ui("officialFigure"))} ${question.figure}">` : ""}
    <div class="answer-list">${question.answers
      .map((answer, index) => {
        const selected = answered === index;
        const stateClass = reveal
          ? index === question.correct
            ? "is-correct"
            : selected
              ? "is-wrong"
              : ""
          : selected
            ? "is-selected"
            : "";
        return `<button class="answer ${stateClass}" data-answer="${index}" ${reveal ? "disabled" : ""}><b>${String.fromCharCode(65 + index)}</b><span>${pairHtml(answer, translated.answers[index])}</span></button>`;
      })
      .join("")}</div>
    ${
      reveal
        ? `<div class="quiz-feedback ${answered === question.correct ? "ok" : "bad"}">${
            answered === question.correct
              ? ui("correctAnswer")
              : ui("correctAnswerLetter", {
                  letter: String.fromCharCode(65 + question.correct),
                })
          }${question.note ? ` ${pairHtml(question.note, translated.note || "")}` : ""}</div>`
        : ""
    }
    ${reveal ? `<div class="question-study-reference">${handbookButton(question)}</div>` : ""}
    <div class="quiz-actions"><button class="button ghost dark" id="quitQuiz">${ui("quit")}</button><button class="button primary" id="nextQuestion" ${answered === null ? "disabled" : ""}>${quizState.index === quizState.questions.length - 1 ? ui("viewResult") : `${ui("nextQuestion")} →`}</button></div>`;
}

function selectAnswer(index) {
  if (!quizState || quizState.finished) return;
  quizState.answers[quizState.index] = index;
  if (quizState.mode === "training" && recordQuizAnswer(quizState.index))
    saveQuizProgress();
  renderQuestion();
}

function nextQuestion() {
  if (!quizState || quizState.answers[quizState.index] === null) return;
  if (recordQuizAnswer(quizState.index)) saveQuizProgress();
  if (quizState.index === quizState.questions.length - 1) {
    finishQuiz();
    return;
  }
  quizState.index += 1;
  renderQuestion();
  $("#quizRunner").scrollIntoView({ behavior: "smooth", block: "start" });
}

function quizScore() {
  const correct = quizState.questions.reduce(
    (sum, question, index) =>
      sum + (quizState.answers[index] === question.correct ? 1 : 0),
    0,
  );
  const required =
    quizState.mode === "official"
      ? content.exam.basePass
      : Math.ceil(quizState.questions.length * 0.8);
  return { correct, required, passed: correct >= required };
}

function answerReviewHtml() {
  return `<section class="result-question-review-section">
    <div class="result-review-heading"><h3>${ui("answerReview")}</h3><p>${ui("answerReviewLead")}</p></div>
    <div class="result-question-list">${quizState.questions
      .map((question, index) => {
        const translated = quizPtMap.get(question.id);
        const isCorrect = quizState.answers[index] === question.correct;
        const letter = String.fromCharCode(65 + question.correct);
        return `<article class="result-question-review ${isCorrect ? "is-correct" : "is-wrong"}" id="result-question-${question.id}">
          <header><span>${esc(question.code)}</span><strong>${isCorrect ? "✓" : "→"} ${isCorrect ? ui("correctAnswer") : ui("correctAnswerLetter", { letter })}</strong></header>
          <p>${pairHtml(question.question, translated.question)}</p>
          <div class="result-official-answer"><b>${letter}</b><div><small>${ui("officialAnswer")}</small><span>${pairHtml(question.answers[question.correct], translated.answers[question.correct])}</span></div></div>
          <footer><small>${handbookMatchLabel(questionAuthorityMap.get(question.id))}</small>${handbookButton(question, true)}</footer>
        </article>`;
      })
      .join("")}</div>
  </section>`;
}

function renderQuizResult() {
  const { correct, required, passed } = quizScore();
  const breakdown = content.chapters
    .map((chapter) => {
      const indexes = quizState.questions
        .map((question, index) => ({ question, index }))
        .filter(
          ({ question }) => question.theme === chapter.italian.toUpperCase(),
        );
      if (!indexes.length) return null;
      return {
        chapter,
        total: indexes.length,
        right: indexes.filter(
          ({ question, index }) =>
            quizState.answers[index] === question.correct,
        ).length,
      };
    })
    .filter(Boolean);
  $("#quizRunner").hidden = true;
  const result = $("#quizResult");
  result.hidden = false;
  result.innerHTML = `<div class="result-ring" style="--score:${(correct / quizState.questions.length) * 100}%"><strong>${correct}/${quizState.questions.length}</strong></div>
        <span class="eyebrow">${quizState.mode === "official" ? ui("simulationResult") : ui("trainingResult")}</span>
        <h2>${passed ? ui("passedTitle") : ui("failedTitle")}</h2>
        <p>${passed ? ui("passedText", { required }) : ui("failedText", { correct, required })}</p>
        <div class="result-breakdown">${breakdown
          .map(
            ({ chapter, total, right }) =>
              `<div><strong>${right}/${total}</strong><small>${pairHtml(chapter.title, translatedChapter(chapter).title, { compact: true })}</small></div>`,
          )
          .join("")}</div>
        ${answerReviewHtml()}
        <div class="hero-actions result-actions"><button class="button primary" id="repeatQuiz">${ui("newTest")}</button><button class="button ghost dark" data-go="quiz">${ui("browseDatabase")}</button></div>`;
}

function finishQuiz() {
  if (!quizState) return;
  clearInterval(timerHandle);
  let progressChanged = false;
  quizState.questions.forEach((_question, index) => {
    progressChanged = recordQuizAnswer(index) || progressChanged;
  });
  if (progressChanged) saveQuizProgress();
  quizState.finished = true;
  const { correct } = quizScore();
  localStorage.setItem(
    "rotta12-last-score",
    JSON.stringify({
      date: Date.now(),
      correct,
      total: quizState.questions.length,
      mode: quizState.mode,
    }),
  );
  renderQuizResult();
  renderBank();
  $("#quizResult").scrollIntoView({ behavior: "smooth", block: "start" });
}

function stopQuiz() {
  clearInterval(timerHandle);
  if (quizState && recordQuizAnswer(quizState.index)) saveQuizProgress();
  quizState = null;
  $("#quizRunner").hidden = true;
  $("#quizResult").hidden = true;
  $("#quizSetup").hidden = false;
  renderBank();
}

function searchableQuestion(item) {
  const translated = quizPtMap.get(item.id);
  return norm(
    `${item.question} ${item.answers.join(" ")} ${item.topic} ${item.code} ${translated.question} ${translated.answers.join(" ")} ${translated.topic}`,
  );
}

function filteredBank() {
  const query = norm($("#bankSearch").value);
  const theme = $("#bankTheme").value;
  const topic = $("#bankTopic").value;
  const status = $("#bankStatus").value;
  return quiz.filter((item) => {
    const itemStatus = progressStatus(item.id);
    const statusMatch =
      !status ||
      status === "all" ||
      itemStatus === status ||
      (status === "answered" && itemStatus !== "unseen");
    return (
      (!theme || item.theme === theme) &&
      (!topic || item.topic === topic) &&
      statusMatch &&
      (!query || searchableQuestion(item).includes(query))
    );
  });
}

function bankStatusLabel(status) {
  if (status === "correct") return ui("progressCorrect");
  if (status === "review") return ui("progressReview");
  return ui("progressUnseen");
}

function renderBank() {
  const results = filteredBank();
  $("#bankResultCount").textContent = results.length.toLocaleString(
    mode === "it" ? "it-IT" : "pt-BR",
  );
  $("#bankResults").innerHTML =
    results
      .map((item) => {
        const translated = quizPtMap.get(item.id);
        const status = progressStatus(item.id);
        return `<article class="bank-row ${bankSelection.has(item.id) ? "is-selected" : ""}"><label class="bank-select"><input type="checkbox" data-select-question="${item.id}" ${bankSelection.has(item.id) ? "checked" : ""} aria-label="${esc(ui("selectQuestion"))} ${item.id}"><span></span></label><strong>#${item.id}</strong><div class="bank-question-copy"><p>${pairHtml(item.question, translated.question)}</p><small>${pairHtml(item.topic, translated.topic, { compact: true })}${item.figure ? ` · ${ui("figure")} ${item.figure}` : ""}</small><span class="progress-chip ${status}">${bankStatusLabel(status)}</span></div><div class="bank-row-actions">${handbookButton(item, true)}<button data-practice-question="${item.id}">${ui("practiceAction")} →</button></div></article>`;
      })
      .join("") || `<p class="search-empty">${ui("noQuestions")}</p>`;
  $("#bankSelectedCount").textContent = bankSelection.size.toLocaleString(
    mode === "it" ? "it-IT" : "pt-BR",
  );
  $("#startSelectedQuiz").disabled = bankSelection.size === 0;
  $("#startRandomFiltered").disabled = results.length === 0;
}

function startRandomFilteredQuiz() {
  const pool = filteredBank();
  const count = Number($("#randomQuizCount").value);
  startQuiz("training", shuffle(pool).slice(0, Math.min(count, pool.length)));
}

function startSelectedQuiz() {
  const selected = quiz.filter((item) => bankSelection.has(item.id));
  if (!selected.length) {
    showToast(ui("noSelectedQuestions"));
    return;
  }
  startQuiz("training", shuffle(selected));
}

function startUnseenSimulation() {
  const unseen = quiz.filter((item) => progressStatus(item.id) === "unseen");
  if (unseen.length < 20) {
    showToast(ui("notEnoughUnseen", { count: unseen.length }));
    return;
  }
  startQuiz("official", officialSelection(unseen));
}

function clearBankFilters() {
  $("#bankSearch").value = "";
  $("#bankTheme").value = "";
  updateBankTopics();
  $("#bankTopic").value = "";
  $("#bankStatus").value = "all";
  renderBank();
}

function routeForExercise(item = featuredExercise) {
  const route = exerciseRouteMap.get(item.id);
  return {
    route,
    from: chartPointMap.get(route.from),
    to: chartPointMap.get(route.to),
  };
}

function coordinateLabel(point) {
  const format = (value, hemisphere) => {
    const degrees = Math.floor(Math.abs(value));
    const minutes = (Math.abs(value) - degrees) * 60;
    return `${String(degrees).padStart(2, "0")}° ${minutes
      .toFixed(1)
      .replace(".", ",")}′ ${hemisphere}`;
  };
  return `${format(point.lat, "N")} · ${format(point.lon, "E")}`;
}

function coordinateCard(point, role, marker) {
  const basis =
    point.basis === "dd10"
      ? ui("coordinateBasisDd10")
      : ui("coordinateBasisChart");
  return `<article class="chart-coordinate-card ${role}">
    <span class="chart-marker-token">${marker}</span>
    <div><small>${ui(role === "departure" ? "departure" : "arrival")}</small><strong>${esc(point.name)}</strong><span>${pairHtml(point.context, point.contextPt, { compact: true })}</span></div>
    <div class="coordinate-value"><small>${ui("coordinates")}</small><strong>${esc(coordinateLabel(point))}</strong><span>${esc(basis)}</span></div>
  </article>`;
}

function drawChartRoute() {
  const canvas = $("#chartOverlay");
  const context = canvas.getContext("2d");
  const { from, to } = routeForExercise();
  const start = projectChartPoint(chartData.chart, from);
  const end = projectChartPoint(chartData.chart, to);
  const routeLineWidth = 13;
  const markerRadius = 15;
  const markerLineWidth = 5;
  const routeLength = Math.hypot(end.x - start.x, end.y - start.y);
  const markerEndpointInset =
    markerRadius + markerLineWidth / 2 + routeLineWidth / 2 + 3;
  const routeUnitX = routeLength ? (end.x - start.x) / routeLength : 0;
  const routeUnitY = routeLength ? (end.y - start.y) / routeLength : 0;
  const visibleRouteStart = {
    x: start.x + routeUnitX * markerEndpointInset,
    y: start.y + routeUnitY * markerEndpointInset,
  };
  const visibleRouteEnd = {
    x: end.x - routeUnitX * markerEndpointInset,
    y: end.y - routeUnitY * markerEndpointInset,
  };
  if (
    canvas.width !== chartData.chart.width ||
    canvas.height !== chartData.chart.height
  ) {
    canvas.width = chartData.chart.width;
    canvas.height = chartData.chart.height;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = "rgba(2, 19, 27, 0.35)";
  context.shadowBlur = 18;
  context.strokeStyle = "#ef6a4a";
  context.lineWidth = routeLineWidth;
  context.setLineDash([34, 22]);
  if (routeLength > markerEndpointInset * 2) {
    context.beginPath();
    context.moveTo(visibleRouteStart.x, visibleRouteStart.y);
    context.lineTo(visibleRouteEnd.x, visibleRouteEnd.y);
    context.stroke();
  }
  context.setLineDash([]);

  const markers = [
    { point: start, label: from.name },
    { point: end, label: to.name },
  ];
  context.font = "700 35px Arial";
  const labelLayouts = placeRouteLabels({
    start,
    end,
    labels: markers.map(({ label }) => ({
      width: Math.min(650, context.measureText(label).width + 48),
    })),
    bounds: chartData.chart,
  });

  markers.forEach(({ label }, index) => {
    const layout = labelLayouts[index];
    if (!layout) return;
    context.shadowBlur = 0;
    context.fillStyle = "rgba(7, 28, 38, 0.91)";
    context.beginPath();
    context.roundRect(layout.left, layout.top, layout.width, layout.height, 13);
    context.fill();
    context.fillStyle = "#fff";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(
      label,
      layout.left + 22,
      layout.top + layout.height / 2 + 1,
    );
  });

  markers.forEach(({ point }) => {
    context.shadowColor = "rgba(0, 0, 0, 0.52)";
    context.shadowBlur = 7;
    context.strokeStyle = "#ffd600";
    context.lineWidth = markerLineWidth;
    context.beginPath();
    context.arc(point.x, point.y, markerRadius, 0, Math.PI * 2);
    context.stroke();
    context.shadowBlur = 0;
    context.strokeStyle = "#ec008c";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(point.x - 11, point.y);
    context.lineTo(point.x + 11, point.y);
    context.moveTo(point.x, point.y - 11);
    context.lineTo(point.x, point.y + 11);
    context.stroke();
  });
  context.restore();
}

function applyChartZoom() {
  const stage = $("#chartStage");
  stage.style.width = `${chartData.chart.width * chartZoom}px`;
  stage.style.height = `${chartData.chart.height * chartZoom}px`;
  $("#chartZoomLabel").textContent = `${Math.round(chartZoom * 100)}%`;
}

function minimumChartZoom(viewport) {
  if (!viewport.clientWidth) return 0.05;
  return Math.max(
    0.05,
    Math.min(1, (viewport.clientWidth - 4) / chartData.chart.width),
  );
}

function clampChartZoom(viewport, zoom) {
  return Math.max(minimumChartZoom(viewport), Math.min(2.5, zoom));
}

function setChartZoom(
  nextZoom,
  clientX = null,
  clientY = null,
  behavior = "auto",
) {
  const viewport = $("#chartViewport");
  if (!viewport.clientWidth) return;
  const bounds = viewport.getBoundingClientRect();
  const localX =
    clientX === null ? viewport.clientWidth / 2 : clientX - bounds.left;
  const localY =
    clientY === null ? viewport.clientHeight / 2 : clientY - bounds.top;
  const chartX = (viewport.scrollLeft + localX) / chartZoom;
  const chartY = (viewport.scrollTop + localY) / chartZoom;
  chartZoom = clampChartZoom(viewport, nextZoom);
  applyChartZoom();
  viewport.scrollTo({
    left: chartX * chartZoom - localX,
    top: chartY * chartZoom - localY,
    behavior,
  });
}

function changeChartZoom(multiplier) {
  setChartZoom(chartZoom * multiplier, null, null, "smooth");
}

function fitChart() {
  const viewport = $("#chartViewport");
  if (!viewport.clientWidth) return;
  chartZoom = Math.min(1, (viewport.clientWidth - 4) / chartData.chart.width);
  applyChartZoom();
  viewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
}

function handleChartWheel(event) {
  event.preventDefault();
  const deltaScale =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 0.045
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? 0.25
        : 0.0018;
  const multiplier = Math.max(
    0.72,
    Math.min(1.38, Math.exp(-event.deltaY * deltaScale)),
  );
  setChartZoom(chartZoom * multiplier, event.clientX, event.clientY, "auto");
}

function chartPointer(event) {
  return {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  };
}

function beginChartDrag(pointer) {
  const viewport = $("#chartViewport");
  chartDrag = {
    id: pointer.id,
    x: pointer.x,
    y: pointer.y,
    scrollLeft: viewport.scrollLeft,
    scrollTop: viewport.scrollTop,
  };
  chartPinch = null;
}

function beginChartPinch() {
  const viewport = $("#chartViewport");
  const [first, second] = [...chartPointers.values()];
  if (!first || !second) return;
  const bounds = viewport.getBoundingClientRect();
  const midpointX = (first.x + second.x) / 2;
  const midpointY = (first.y + second.y) / 2;
  chartPinch = {
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
    zoom: chartZoom,
    chartX: (viewport.scrollLeft + midpointX - bounds.left) / chartZoom,
    chartY: (viewport.scrollTop + midpointY - bounds.top) / chartZoom,
  };
  chartDrag = null;
}

function handleChartPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const viewport = $("#chartViewport");
  event.preventDefault();
  viewport.focus({ preventScroll: true });
  viewport.setPointerCapture(event.pointerId);
  const pointer = chartPointer(event);
  chartPointers.set(event.pointerId, pointer);
  viewport.classList.add("is-panning");
  if (chartPointers.size === 1) beginChartDrag(pointer);
  else beginChartPinch();
}

function handleChartPointerMove(event) {
  if (!chartPointers.has(event.pointerId)) return;
  event.preventDefault();
  const viewport = $("#chartViewport");
  const pointer = chartPointer(event);
  chartPointers.set(event.pointerId, pointer);

  if (chartPointers.size >= 2) {
    if (!chartPinch) beginChartPinch();
    const [first, second] = [...chartPointers.values()];
    const bounds = viewport.getBoundingClientRect();
    const midpointX = (first.x + second.x) / 2;
    const midpointY = (first.y + second.y) / 2;
    const distance = Math.max(
      1,
      Math.hypot(second.x - first.x, second.y - first.y),
    );
    chartZoom = clampChartZoom(
      viewport,
      chartPinch.zoom * (distance / chartPinch.distance),
    );
    applyChartZoom();
    viewport.scrollLeft =
      chartPinch.chartX * chartZoom - (midpointX - bounds.left);
    viewport.scrollTop =
      chartPinch.chartY * chartZoom - (midpointY - bounds.top);
    return;
  }

  if (chartDrag?.id === event.pointerId) {
    viewport.scrollLeft = chartDrag.scrollLeft - (pointer.x - chartDrag.x);
    viewport.scrollTop = chartDrag.scrollTop - (pointer.y - chartDrag.y);
  }
}

function finishChartPointer(event) {
  if (!chartPointers.has(event.pointerId)) return;
  const viewport = $("#chartViewport");
  chartPointers.delete(event.pointerId);
  if (viewport.hasPointerCapture(event.pointerId)) {
    viewport.releasePointerCapture(event.pointerId);
  }

  if (chartPointers.size >= 2) {
    beginChartPinch();
  } else if (chartPointers.size === 1) {
    beginChartDrag([...chartPointers.values()][0]);
  } else {
    chartDrag = null;
    chartPinch = null;
    viewport.classList.remove("is-panning");
  }
}

function handleChartKeydown(event) {
  const viewport = $("#chartViewport");
  const panStep = Math.max(48, Math.min(120, viewport.clientWidth * 0.12));
  const movements = {
    ArrowLeft: [-panStep, 0],
    ArrowRight: [panStep, 0],
    ArrowUp: [0, -panStep],
    ArrowDown: [0, panStep],
  };
  if (movements[event.key]) {
    event.preventDefault();
    viewport.scrollBy({
      left: movements[event.key][0],
      top: movements[event.key][1],
      behavior: "smooth",
    });
  } else if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    changeChartZoom(1.2);
  } else if (event.key === "-") {
    event.preventDefault();
    changeChartZoom(1 / 1.2);
  } else if (event.key === "0") {
    event.preventDefault();
    fitChart();
  }
}

function focusChartRoute(adjustZoom = true) {
  const viewport = $("#chartViewport");
  if (!viewport.clientWidth) return;
  const { from, to } = routeForExercise();
  const start = projectChartPoint(chartData.chart, from);
  const end = projectChartPoint(chartData.chart, to);
  const routeWidth = Math.abs(end.x - start.x) + 520;
  const routeHeight = Math.abs(end.y - start.y) + 420;
  const fitZoom = (viewport.clientWidth - 4) / chartData.chart.width;
  if (adjustZoom) {
    chartZoom = Math.max(
      fitZoom,
      Math.min(
        0.9,
        (viewport.clientWidth - 70) / routeWidth,
        (viewport.clientHeight - 70) / routeHeight,
      ),
    );
    applyChartZoom();
  }
  const centerX = ((start.x + end.x) / 2) * chartZoom;
  const centerY = ((start.y + end.y) / 2) * chartZoom;
  viewport.scrollTo({
    left: Math.max(0, centerX - viewport.clientWidth / 2),
    top: Math.max(0, centerY - viewport.clientHeight / 2),
    behavior: "smooth",
  });
}

function renderChartRoute() {
  const { from, to } = routeForExercise();
  $("#chartCoordinateCards").innerHTML =
    coordinateCard(from, "departure", "A") + coordinateCard(to, "arrival", "B");
  drawChartRoute();
}

function sentenceCase(value) {
  if (!value) return "";
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function exerciseAnswerSet(item) {
  const { from, to } = routeForExercise(item);
  return buildExerciseAnswers({
    prompt: item.prompt,
    solution: item.solution,
    from,
    to,
  });
}

function renderExercisePrompt(item, translated) {
  const answers = exerciseAnswerSet(item);
  const translatedPrompt = splitExercisePrompt(translated.prompt);
  const translatedQuestions = new Map(
    translatedPrompt.questions.map((question) => [
      question.number,
      question.label,
    ]),
  );
  const rows = answers.questions
    .map((question) => {
      const translatedLabel =
        translatedQuestions.get(question.number) || question.label;
      const answerType = question.isInterval ? "acceptedRange" : "exactAnswer";
      return `<li class="exercise-question-row">
        <span class="exercise-question-number">${question.number}</span>
        <span class="exercise-question-label">${pairHtml(
          sentenceCase(question.label),
          sentenceCase(translatedLabel),
          { compact: true },
        )}</span>
        <span class="exercise-answer" hidden>
          <strong>${esc(question.answer)}</strong>
          <small class="${question.isInterval ? "is-range" : "is-exact"}">${uiHtml(answerType)}</small>
        </span>
      </li>`;
    })
    .join("");
  return `<div class="exercise-introduction">${pairHtml(
    answers.introduction,
    translatedPrompt.introduction,
  )}</div>
    <ol class="exercise-question-list">${rows}</ol>`;
}

function renderExerciseSolution(item, translated) {
  return `<div class="exercise-solution" hidden>
    <p>${uiHtml("chartAnswerGuide")}</p>
    <details class="source-solution-transcript">
      <summary>${uiHtml("sourceSolutionTranscript")}</summary>
      <div>${pairHtml(item.solution, translated.solution)}</div>
    </details>
  </div>`;
}

function revealExerciseAnswers(container, reveal) {
  container
    .querySelectorAll(".exercise-answer")
    .forEach((answer) => (answer.hidden = !reveal));
}

function selectFeaturedExercise(item, focus = true) {
  featuredExercise = item;
  renderExerciseFeatured();
  renderExerciseList();
  renderChartRoute();
  if (focus) {
    $("#chart5dTitle").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => focusChartRoute(true), 80);
  }
}

function renderExerciseFeatured() {
  const item = featuredExercise;
  const translated = exercisePtMap.get(item.id);
  $("#exerciseFeatured").innerHTML =
    `<article class="featured-exercise panel"><div class="exercise-kicker"><span>${ui("selectedExercise")} · ${ui("exercise")} ${item.id} · ${pairHtml(item.sector, translated.sector, { compact: true })}</span><span>${ui("page")} ${item.sourcePage}</span></div><h2>${ui("solveChart")}</h2><div class="exercise-prompt">${renderExercisePrompt(item, translated)}</div><button class="button ghost dark" data-show-featured-solution>${ui("showOfficialSolution")}</button>${renderExerciseSolution(item, translated)}</article>`;
}

function renderExercises() {
  const previousSector = $("#exerciseSector").value;
  const sectors = [...new Set(exercises.map((item) => item.sector))];
  $("#exerciseSector").innerHTML =
    `<option value="">${ui("allSectors")}</option>${sectors
      .map((sector) => {
        const item = exercises.find((exercise) => exercise.sector === sector);
        return `<option value="${esc(sector)}">${esc(pairValue(sector, exercisePtMap.get(item.id).sector))}</option>`;
      })
      .join("")}`;
  if (sectors.includes(previousSector))
    $("#exerciseSector").value = previousSector;
  renderExerciseList();
  renderExerciseFeatured();
  renderChartRoute();
}

function renderExerciseList() {
  const sector = $("#exerciseSector").value;
  const selected = exercises.filter(
    (item) => !sector || item.sector === sector,
  );
  $("#exerciseCount").textContent = selected.length;
  $("#exerciseList").innerHTML = selected
    .map((item) => {
      const translated = exercisePtMap.get(item.id);
      const active = item.id === featuredExercise.id ? " is-selected" : "";
      return `<details class="exercise-item${active}"><summary><strong>${String(item.id).padStart(2, "0")}</strong><span>${pairHtml(item.prompt.split("\n")[0], translated.prompt.split("\n")[0], { compact: true })}</span></summary><div class="exercise-item-body"><div class="exercise-prompt">${renderExercisePrompt(item, translated)}</div><div class="exercise-item-actions"><button class="button primary" data-show-on-chart="${item.id}">${ui("showOnChart")}</button><button class="button ghost dark" data-toggle-inline-solution>${ui("showSolution")}</button></div>${renderExerciseSolution(item, translated)}</div></details>`;
    })
    .join("");
}

function renderSources() {
  const sourceGroups = [
    {
      title: ["Banca e programma d’esame", "Banco e programa de exame"],
      filter: (source) =>
        source.id === "mit-quiz-2022" || source.id === "mit-programma-2021",
    },
    {
      title: ["Normativa ufficiale", "Normas oficiais"],
      filter: (source) =>
        ["norma", "convenzione ratificata"].includes(source.kind),
    },
    {
      title: ["Fonti tecniche istituzionali", "Fontes técnicas institucionais"],
      filter: (source) =>
        source.id !== "mit-quiz-2022" &&
        source.id !== "mit-programma-2021" &&
        !["norma", "convenzione ratificata"].includes(source.kind),
    },
  ];
  $("#sourceGroups").innerHTML = sourceGroups
    .map((group) => {
      return `<section class="source-group"><h2>${pairHtml(group.title[0], group.title[1])}</h2><div class="source-grid">${authoritativeSources.sources
        .filter(group.filter)
        .map((source) => {
          return `<a class="source-card" href="${esc(sourceUrl(source))}" target="_blank" rel="noopener"><span class="status">${pairHtml(source.status, source.statusPt, { compact: true })}</span><h3>${pairHtml(source.title, source.titlePt)}</h3><small>${esc(source.authority)}</small>${source.noteIt ? `<p>${pairHtml(source.noteIt, source.notePt)}</p>` : ""}<span class="source-link">${ui("openSource")} ↗</span></a>`;
        })
        .join("")}</div></section>`;
    })
    .join("");
  $("#methodGrid").innerHTML = METHODS.map(
    (method, index) =>
      `<div><strong>${String(index + 1).padStart(2, "0")}</strong><p>${pairHtml(method[0], method[1])}</p></div>`,
  ).join("");
}

function runGlobalSearch() {
  const value = $("#globalSearch").value.trim();
  const overlay = $("#searchOverlay");
  if (value.length < 2) {
    overlay.hidden = true;
    return;
  }
  const query = norm(value);
  const quizMatches = quiz
    .filter((item) => searchableQuestion(item).includes(query))
    .slice(0, 9);
  const glossaryMatches = glossary
    .filter((item) =>
      norm(
        `${item.it} ${item.pt} ${item.aliases.join(" ")} ${item.definitionIt} ${item.definitionPt}`,
      ).includes(query),
    )
    .slice(0, 4);
  overlay.hidden = false;
  overlay.innerHTML = `${
    quizMatches.length
      ? `<div class="search-title">${ui("officialQuiz")}</div>${quizMatches
          .map((item) => {
            const translated = quizPtMap.get(item.id);
            return `<button class="search-result" data-search-question="${item.id}"><span>Quiz #${item.id}</span><div><strong>${pairHtml(item.question, translated.question, { compact: true })}</strong><small>${pairHtml(item.topic, translated.topic, { compact: true })}</small></div></button>`;
          })
          .join("")}`
      : ""
  }${
    glossaryMatches.length
      ? `<div class="search-title">${ui("glossary")}</div>${glossaryMatches
          .map(
            (item) =>
              `<button class="search-result glossary-search-result" data-glossary-query="${esc(item.it)}"><span>IT ⇄ PT</span><div><strong>${esc(item.it)} → ${esc(item.pt)}</strong><small>${esc(pairValue(item.definitionIt, item.definitionPt))}</small></div></button>`,
          )
          .join("")}`
      : ""
  }${!quizMatches.length && !glossaryMatches.length ? `<div class="search-empty">${esc(ui("noResultsFor", { query: value }))}</div>` : ""}`;
}

function openGlossary(query = "") {
  $("#glossaryDrawer").hidden = false;
  $("#glossaryBackdrop").hidden = false;
  document.body.classList.add("glossary-open");
  $("#glossarySearch").value = query;
  renderGlossary();
  setTimeout(() => $("#glossarySearch").focus(), 0);
}

function closeGlossary() {
  $("#glossaryDrawer").hidden = true;
  $("#glossaryBackdrop").hidden = true;
  document.body.classList.remove("glossary-open");
}

function renderGlossary() {
  const query = norm($("#glossarySearch").value);
  const results = glossary.filter((item) =>
    norm(
      `${item.it} ${item.pt} ${item.aliases.join(" ")} ${item.definitionIt} ${item.definitionPt}`,
    ).includes(query),
  );
  $("#glossaryResults").innerHTML =
    results
      .map(
        (item) =>
          `<article class="glossary-entry"><div class="glossary-term"><span lang="it">${esc(item.it)}</span><b>→</b><span lang="pt-BR">${esc(item.pt)}</span></div><p>${pairHtml(item.definitionIt, item.definitionPt)}</p><small><strong>${ui("aliases")}:</strong> ${esc(item.aliases.join(" · "))}</small></article>`,
      )
      .join("") || `<p class="search-empty">${ui("glossaryNoResults")}</p>`;
}

document.addEventListener("click", (event) => {
  const profileTrigger = event.target.closest("[data-open-profile]");
  if (profileTrigger) {
    openProfileModal(profileTrigger.dataset.openProfile);
    return;
  }
  const accountView = event.target.closest("[data-account-view]");
  if (accountView) {
    accountModalView = accountView.dataset.accountView;
    renderAccountModal();
    $("#accountModalBody input")?.focus();
    return;
  }
  if (event.target.closest("[data-account-logout]")) {
    logoutStudyAccount();
    return;
  }
  if (event.target.closest("[data-profile-export]")) {
    exportStudyProfile();
    return;
  }
  if (event.target.closest("#startUnseenSimulation")) {
    startUnseenSimulation();
    return;
  }
  const modeButton = event.target.closest("[data-mode]");
  if (modeButton) {
    setMode(modeButton.dataset.mode);
    return;
  }
  const go = event.target.closest("[data-go]");
  if (go) {
    switchView(go.dataset.go);
    return;
  }
  const nav = event.target.closest("[data-view]");
  if (nav) {
    switchView(nav.dataset.view);
    return;
  }
  const viewLink = event.target.closest("[data-view-link]");
  if (viewLink) {
    event.preventDefault();
    switchView(viewLink.dataset.viewLink);
    return;
  }
  const category = event.target.closest("[data-filter-theme]");
  if (category) {
    switchView("quiz");
    $("#trainingTheme").value = category.dataset.filterTheme;
    updateTrainingTopics();
    $("#quizSetup").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const answer = event.target.closest("[data-answer]");
  if (answer) {
    selectAnswer(Number(answer.dataset.answer));
    return;
  }
  const authorityPreview = event.target.closest("[data-authority-preview]");
  if (authorityPreview) {
    selectAuthoritySource(Number(authorityPreview.dataset.authorityPreview));
    return;
  }
  const handbookTrigger = event.target.closest("[data-open-handbook]");
  if (handbookTrigger) {
    openHandbook(Number(handbookTrigger.dataset.openHandbook));
    return;
  }
  if (event.target.closest("#nextQuestion")) {
    nextQuestion();
    return;
  }
  if (
    event.target.closest("#quitQuiz") ||
    event.target.closest("#repeatQuiz")
  ) {
    stopQuiz();
    return;
  }
  const practice = event.target.closest("[data-practice-question]");
  if (practice) {
    switchView("quiz");
    startQuiz("training", [
      quiz.find(
        (item) => item.id === Number(practice.dataset.practiceQuestion),
      ),
    ]);
    return;
  }
  const featuredSolution = event.target.closest(
    "[data-show-featured-solution]",
  );
  if (featuredSolution) {
    const solution = featuredSolution.nextElementSibling;
    const reveal = solution.hidden;
    solution.hidden = !reveal;
    revealExerciseAnswers(featuredSolution.closest("article"), reveal);
    featuredSolution.textContent = reveal
      ? ui("hideOfficialSolution")
      : ui("showOfficialSolution");
    return;
  }
  const inlineSolution = event.target.closest("[data-toggle-inline-solution]");
  if (inlineSolution) {
    const exerciseBody = inlineSolution.closest(".exercise-item-body");
    const solution = exerciseBody.querySelector(".exercise-solution");
    const reveal = solution.hidden;
    solution.hidden = !reveal;
    revealExerciseAnswers(exerciseBody, reveal);
    inlineSolution.textContent = reveal
      ? ui("hideSolution")
      : ui("showSolution");
    return;
  }
  const showOnChart = event.target.closest("[data-show-on-chart]");
  if (showOnChart) {
    const item = exercises.find(
      (exercise) => exercise.id === Number(showOnChart.dataset.showOnChart),
    );
    selectFeaturedExercise(item);
    return;
  }
  const searchQuestion = event.target.closest("[data-search-question]");
  if (searchQuestion) {
    const question = quiz.find(
      (item) => item.id === Number(searchQuestion.dataset.searchQuestion),
    );
    $("#searchOverlay").hidden = true;
    $("#globalSearch").value = "";
    switchView("quiz");
    startQuiz("training", [question]);
    return;
  }
  const glossaryTrigger = event.target.closest("[data-glossary-query]");
  if (glossaryTrigger) {
    $("#searchOverlay").hidden = true;
    openGlossary(glossaryTrigger.dataset.glossaryQuery);
    return;
  }
  if (
    !event.target.closest(".global-search") &&
    !event.target.closest("#searchOverlay")
  )
    $("#searchOverlay").hidden = true;
});

document.addEventListener("change", (event) => {
  const selection = event.target.closest?.("[data-select-question]");
  if (!selection) return;
  const questionId = Number(selection.dataset.selectQuestion);
  if (selection.checked) bankSelection.add(questionId);
  else bankSelection.delete(questionId);
  selection
    .closest(".bank-row")
    ?.classList.toggle("is-selected", selection.checked);
  $("#bankSelectedCount").textContent = bankSelection.size.toLocaleString(
    mode === "it" ? "it-IT" : "pt-BR",
  );
  $("#startSelectedQuiz").disabled = bankSelection.size === 0;
});

$("#menuToggle").addEventListener("click", () => {
  const open = document.body.classList.toggle("menu-open");
  $("#menuToggle").setAttribute("aria-expanded", String(open));
  $("#menuToggle").setAttribute(
    "aria-label",
    open ? ui("closeMenu") : ui("openMenu"),
  );
});
$("#globalSearch").addEventListener("input", runGlobalSearch);
$("#globalSearch").addEventListener("focus", runGlobalSearch);
$("#trainingTheme").addEventListener("change", updateTrainingTopics);
$("#startOfficial").addEventListener("click", () => startQuiz("official"));
$("#startTraining").addEventListener("click", () => startQuiz("training"));
$("#bankSearch").addEventListener("input", renderBank);
$("#bankTheme").addEventListener("change", () => {
  updateBankTopics();
  renderBank();
});
$("#bankTopic").addEventListener("change", renderBank);
$("#bankStatus").addEventListener("change", renderBank);
$("#startRandomFiltered").addEventListener("click", startRandomFilteredQuiz);
$("#startSelectedQuiz").addEventListener("click", startSelectedQuiz);
$("#clearBankFilters").addEventListener("click", clearBankFilters);
$("#exerciseSector").addEventListener("change", renderExerciseList);
$("#randomExercise").addEventListener("click", () => {
  const sector = $("#exerciseSector").value;
  const pool = exercises.filter((item) => !sector || item.sector === sector);
  selectFeaturedExercise(pool[Math.floor(Math.random() * pool.length)]);
});
$("#chartZoomOut").addEventListener("click", () => changeChartZoom(0.75));
$("#chartZoomIn").addEventListener("click", () => changeChartZoom(1.333));
$("#chartFit").addEventListener("click", fitChart);
const chartViewport = $("#chartViewport");
chartViewport.addEventListener("wheel", handleChartWheel, { passive: false });
chartViewport.addEventListener("pointerdown", handleChartPointerDown);
chartViewport.addEventListener("pointermove", handleChartPointerMove);
chartViewport.addEventListener("pointerup", finishChartPointer);
chartViewport.addEventListener("pointercancel", finishChartPointer);
chartViewport.addEventListener("keydown", handleChartKeydown);
$("#glossaryOpen").addEventListener("click", () => openGlossary());
$("#glossaryClose").addEventListener("click", closeGlossary);
$("#glossaryBackdrop").addEventListener("click", closeGlossary);
$("#handbookClose").addEventListener("click", closeHandbook);
$("#handbookBackdrop").addEventListener("click", closeHandbook);
$("#profileClose").addEventListener("click", closeProfileModal);
$("#profileBackdrop").addEventListener("click", closeProfileModal);
$("#profileModal").addEventListener("submit", handleAccountSubmit);
$("#profileImport").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importStudyProfile(file);
  event.target.value = "";
});
$("#glossarySearch").addEventListener("input", renderGlossary);
document.addEventListener("keydown", (event) => {
  const category = event.target.closest?.("[data-filter-theme]");
  if (category && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    category.click();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("#globalSearch").focus();
  }
  if (event.key === "Escape") {
    if (!$("#profileModal").hidden) closeProfileModal();
    else if (!$("#handbookModal").hidden) closeHandbook();
    else if (!$("#glossaryDrawer").hidden) closeGlossary();
    else {
      $("#searchOverlay").hidden = true;
      document.body.classList.remove("menu-open");
      $("#menuToggle").setAttribute("aria-expanded", "false");
      $("#menuToggle").setAttribute("aria-label", ui("openMenu"));
    }
  }
});

inicializarTema();
$("#chartPdfLink").href = `${chartPdfUrl}#page=161`;
$("#chartImage").src = chart5dUrl;
$("#chartFullLink").href = chart5dEnhancedPdfUrl;
applyChartZoom();
updateStaticUi();
renderDashboard();
populateQuizFilters();
renderStudyProfile();
renderBank();
renderExercises();
renderSources();
renderGlossary();
initializeStudyAccount();
window.addEventListener("online", () => {
  if (accountService.isAuthenticated && pendingProgressSync.size) {
    scheduleProgressSync();
  }
});
const initialView = location.hash.replace("#", "");
if (["dashboard", "quiz", "carteggio", "sources"].includes(initialView))
  switchView(initialView, false);
