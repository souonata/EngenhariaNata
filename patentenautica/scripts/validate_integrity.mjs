import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  chartAlignment,
  placeRouteLabels,
  projectChartPoint,
  rectsOverlap,
  segmentIntersectsRect,
} from "../chart-layout.js";
import {
  buildExerciseAnswers,
  splitExercisePrompt,
} from "../exercise-answers-calc.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadWindowData(relativePath, variable) {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, relativePath), "utf8"),
    context,
  );
  return JSON.parse(JSON.stringify(context.window[variable]));
}

const quiz = loadWindowData("data/quiz-base.js", "PATENTE_QUIZ");
const content = loadWindowData("data/content.js", "PATENTE_CONTENT");
const exercises = loadWindowData("data/carteggio.js", "PATENTE_CARTEGGIO");
const quizPt = JSON.parse(
  fs.readFileSync(path.join(root, "data/quiz-pt.json"), "utf8"),
);
const contentPt = JSON.parse(
  fs.readFileSync(path.join(root, "data/content-pt.json"), "utf8"),
);
const exercisesPt = JSON.parse(
  fs.readFileSync(path.join(root, "data/carteggio-pt.json"), "utf8"),
);
const chartData = JSON.parse(
  fs.readFileSync(path.join(root, "data/chart-points.json"), "utf8"),
);
const authoritativeSources = JSON.parse(
  fs.readFileSync(path.join(root, "data/authoritative-sources.json"), "utf8"),
);
const questionAuthority = JSON.parse(
  fs.readFileSync(path.join(root, "data/question-authority.json"), "utf8"),
);

const fail = (message) => {
  throw new Error(message);
};

if (quiz.length !== 1472 || quizPt.length !== 1472)
  fail("A banca deve conter 1.472 questões em cada camada.");
if (new Set(quiz.map((item) => item.id)).size !== 1472)
  fail("IDs italianos duplicados.");

quiz.forEach((official, index) => {
  const translated = quizPt[index];
  if (translated.id !== official.id) fail(`ID divergente no índice ${index}.`);
  if (translated.answers.length !== official.answers.length)
    fail(`Alternativas divergentes na questão ${official.id}.`);
  if (
    "correct" in translated ||
    "code" in translated ||
    "figure" in translated
  ) {
    fail(
      `A tradução da questão ${official.id} duplicou identidade ou gabarito oficial.`,
    );
  }
  if (
    !Number.isInteger(official.correct) ||
    official.correct < 0 ||
    official.correct > 2
  ) {
    fail(`Índice correct inválido na questão ${official.id}.`);
  }
});

if (questionAuthority.references.length !== quiz.length)
  fail("As referências oficiais devem cobrir as 1.472 questões.");
if (authoritativeSources.sources.length < 15)
  fail("O catálogo deve manter uma base ampla de fontes oficiais.");

const sourceIds = new Set();
const sourceMap = new Map();
authoritativeSources.sources.forEach((source) => {
  if (sourceIds.has(source.id)) fail(`Fonte oficial duplicada: ${source.id}.`);
  sourceIds.add(source.id);
  sourceMap.set(source.id, source);
  if (!/^https:\/\//.test(source.officialUrl))
    fail(`Fonte ${source.id} sem URL oficial HTTPS.`);
  if (source.localFile) {
    const localPath = path.resolve(root, "sources", source.localFile);
    const sourceRoot = path.resolve(root, "sources");
    if (!localPath.startsWith(`${sourceRoot}${path.sep}`) || !fs.existsSync(localPath))
      fail(`Cópia local ausente ou fora de sources/: ${source.id}.`);
    const bytes = fs.statSync(localPath).size;
    const digest = crypto
      .createHash("sha256")
      .update(fs.readFileSync(localPath))
      .digest("hex");
    if (source.bytes !== bytes || source.sha256 !== digest)
      fail(`Hash/tamanho divergente na fonte local ${source.id}.`);
  }
});

const referenceIds = new Set();
const ruleCounts = Object.fromEntries(
  Object.keys(questionAuthority.rules).map((rule) => [rule, 0]),
);
questionAuthority.references.forEach((reference) => {
  if (referenceIds.has(reference.id))
    fail(`Referência oficial duplicada para a questão ${reference.id}.`);
  referenceIds.add(reference.id);
  if (
    !Number.isInteger(reference.officialPage) ||
    reference.officialPage < 1 ||
    reference.officialPage > 338
  )
    fail(`Página MIT inválida na referência da questão ${reference.id}.`);
  if (!questionAuthority.rules[reference.rule])
    fail(`Regra didática desconhecida na questão ${reference.id}.`);
  if ("correct" in reference || "answer" in reference)
    fail(
      `A referência da questão ${reference.id} não pode duplicar o gabarito.`,
    );
  ruleCounts[reference.rule] += 1;
  for (const sourceReference of reference.sourceRefs || []) {
    if (!sourceIds.has(sourceReference.source))
      fail(`Fonte desconhecida na questão ${reference.id}.`);
  }
});
quiz.forEach((question) => {
  if (!referenceIds.has(question.id))
    fail(`Questão ${question.id} sem referência oficial.`);
});
for (const [ruleId, rule] of Object.entries(questionAuthority.rules)) {
  if (!ruleCounts[ruleId]) fail(`Regra sem questões: ${ruleId}.`);
  if (!rule.principleIt || !rule.principlePt)
    fail(`Regra sem explicação bilíngue: ${ruleId}.`);
  for (const sourceReference of rule.sources || []) {
    if (!sourceIds.has(sourceReference.source))
      fail(`Fonte desconhecida na regra ${ruleId}.`);
  }
}
if (
  questionAuthority.summary.questions !== quiz.length ||
  questionAuthority.summary.officialPageCoverage !== quiz.length
)
  fail("Resumo de cobertura oficial divergente.");
const oilReference = questionAuthority.references.find(
  (reference) => reference.id === 1464,
);
if (
  oilReference?.primarySource !== "ispra-oli-usati" ||
  !oilReference?.specificIt?.includes("5.000 m²")
)
  fail("A questão 1464 deve explicar os 5.000 m² com fonte ISPRA.");

if (content.chapters.length !== 8 || contentPt.chapters.length !== 8)
  fail("São esperados oito capítulos.");
const topicCount = content.chapters.reduce(
  (sum, chapter) => sum + chapter.topics.length,
  0,
);
const topicPtCount = contentPt.chapters.reduce(
  (sum, chapter) => sum + chapter.topics.length,
  0,
);
if (topicCount !== 34 || topicPtCount !== 34)
  fail("São esperados 34 assuntos didáticos.");

if (exercises.length !== 50 || exercisesPt.length !== 50)
  fail("São esperados 50 exercícios de carteggio.");

if (chartData.points.length < 2)
  fail("A carta 5/D deve conter pontos georreferenciados.");
if (chartData.exercises.length !== exercises.length)
  fail("Todos os 50 exercícios devem possuir partida e chegada na carta 5/D.");

const chartPointMap = new Map(
  chartData.points.map((point) => [point.id, point]),
);
const chartPointIds = new Set(chartPointMap.keys());
if (chartPointIds.size !== chartData.points.length)
  fail("Há identificadores de pontos duplicados na carta 5/D.");

const routeIds = new Set();
chartData.exercises.forEach((route) => {
  if (routeIds.has(route.id)) fail(`Rota duplicada no exercício ${route.id}.`);
  routeIds.add(route.id);
  if (!chartPointIds.has(route.from) || !chartPointIds.has(route.to))
    fail(`Exercício ${route.id} referencia ponto inexistente.`);
});
exercises.forEach((exercise) => {
  if (!routeIds.has(exercise.id))
    fail(`Exercício ${exercise.id} não está localizado na carta 5/D.`);
});
const routeMap = new Map(chartData.exercises.map((route) => [route.id, route]));
const translatedExerciseMap = new Map(
  exercisesPt.map((exercise) => [exercise.id, exercise]),
);
let structuredExerciseAnswerCount = 0;
exercises.forEach((exercise) => {
  const route = routeMap.get(exercise.id);
  const answerSet = buildExerciseAnswers({
    prompt: exercise.prompt,
    solution: exercise.solution,
    from: chartPointMap.get(route.from),
    to: chartPointMap.get(route.to),
  });
  if (
    answerSet.questions.length !== 5 ||
    answerSet.questions.some(
      (question) => question.kind === "unknown" || !question.answer,
    )
  ) {
    fail(
      `O exercício ${exercise.id} não apresenta cinco respostas estruturadas.`,
    );
  }
  const translatedQuestions = splitExercisePrompt(
    translatedExerciseMap.get(exercise.id)?.prompt,
  ).questions;
  if (translatedQuestions.length !== 5)
    fail(`O exercício ${exercise.id} não apresenta cinco perguntas em PT.`);
  structuredExerciseAnswerCount += answerSet.questions.length;
});

const calibration = chartData.chart.calibration;
const alignment = chartAlignment(chartData.chart);
const idealRotationRadians =
  -(
    Math.atan(calibration.meridianSlope) + Math.atan(calibration.parallelSlope)
  ) / 2;
if (
  Math.abs(alignment.rotationRadians - idealRotationRadians) >
  Number.EPSILON * 10
) {
  fail("A rotação da carta não corresponde à inclinação calibrada da grade.");
}
const meridianResidualDegrees =
  ((Math.atan(calibration.meridianSlope) + alignment.rotationRadians) * 180) /
  Math.PI;
const parallelResidualDegrees =
  ((Math.atan(calibration.parallelSlope) + alignment.rotationRadians) * 180) /
  Math.PI;
if (
  Math.max(
    Math.abs(meridianResidualDegrees),
    Math.abs(parallelResidualDegrees),
  ) > 0.1
) {
  fail("Meridianos e paralelos não ficaram ortogonais após o alinhamento.");
}
chartData.points.forEach((point) => {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon))
    fail(`Coordenada inválida no ponto ${point.id}.`);
  if (!point.name || !point.context || !point.contextPt)
    fail(`Ponto ${point.id} sem rótulo bilíngue completo.`);
  const pixel = projectChartPoint(chartData.chart, point);
  if (
    pixel.x < 0 ||
    pixel.x > chartData.chart.width ||
    pixel.y < 0 ||
    pixel.y > chartData.chart.height
  ) {
    fail(`O ponto ${point.id} ficou fora da imagem da carta 5/D.`);
  }
});

chartData.exercises.forEach((route) => {
  const from = chartPointMap.get(route.from);
  const to = chartPointMap.get(route.to);
  const start = projectChartPoint(chartData.chart, from);
  const end = projectChartPoint(chartData.chart, to);
  const layouts = placeRouteLabels({
    start,
    end,
    labels: [from, to].map((point) => ({
      width: Math.min(650, point.name.length * 22 + 48),
    })),
    bounds: chartData.chart,
  });
  if (layouts.some((layout) => !layout))
    fail(`Não há espaço seguro para os dois rótulos da rota ${route.id}.`);
  layouts.forEach((layout) => {
    if (segmentIntersectsRect(start, end, layout, 20))
      fail(`Um rótulo cobre a rota do exercício ${route.id}.`);
  });
  if (rectsOverlap(layouts[0], layouts[1], 18))
    fail(`Os rótulos se sobrepõem no exercício ${route.id}.`);
});

const chartPath = path.join(root, "carta nautica 5D.gif");
const gifHeader = fs.readFileSync(chartPath).subarray(0, 10);
if (gifHeader.subarray(0, 3).toString("ascii") !== "GIF")
  fail("O arquivo da carta 5/D não é um GIF válido.");
const gifWidth = gifHeader.readUInt16LE(6);
const gifHeight = gifHeader.readUInt16LE(8);
if (
  gifWidth !== alignment.sourceWidth ||
  gifHeight !== alignment.sourceHeight
) {
  fail(
    `Dimensões da carta-fonte divergentes: ${gifWidth}x${gifHeight}, esperado ${alignment.sourceWidth}x${alignment.sourceHeight}.`,
  );
}

const alignedChartPath = path.join(root, "carta nautica 5D allineata.webp");
const webpHeader = fs.readFileSync(alignedChartPath).subarray(0, 25);
if (
  webpHeader.subarray(0, 4).toString("ascii") !== "RIFF" ||
  webpHeader.subarray(8, 12).toString("ascii") !== "WEBP" ||
  webpHeader.subarray(12, 16).toString("ascii") !== "VP8L" ||
  webpHeader[20] !== 0x2f
) {
  fail("A carta 5/D alinhada não é um WebP lossless válido.");
}
const webpDimensions = webpHeader.readUInt32LE(21);
const alignedWidth = (webpDimensions & 0x3fff) + 1;
const alignedHeight = ((webpDimensions >>> 14) & 0x3fff) + 1;
if (
  alignedWidth !== chartData.chart.width ||
  alignedHeight !== chartData.chart.height
) {
  fail(
    `Dimensões da carta alinhada divergentes: ${alignedWidth}x${alignedHeight}, esperado ${chartData.chart.width}x${chartData.chart.height}.`,
  );
}

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const accountSource = fs.readFileSync(
  path.join(root, "account-service.js"),
  "utf8",
);
const accountMigration = fs.readFileSync(
  path.join(root, "backend", "pb_migrations", "1721600000_init_rotta12.js"),
  "utf8",
);
const accountApiHook = fs.readFileSync(
  path.join(root, "backend", "pb_hooks", "account_api.pb.js"),
  "utf8",
);
if (
  /view-guide|Guida per capitoli|data-open-theory/.test(indexHtml + appSource)
)
  fail(
    "O guia por capítulos ou seus antigos vínculos ainda está presente na interface.",
  );
if (
  !/data-open-handbook/.test(appSource) ||
  !/handbookModal/.test(indexHtml) ||
  !/handbookOfficialAnswerText/.test(indexHtml) ||
  !/handbookSourceCards/.test(indexHtml)
)
  fail("A interface não expõe resposta, explicação e fontes oficiais.");
const publicReferencePayload =
  indexHtml +
  appSource +
  fs.readFileSync(path.join(root, "data", "content.js"), "utf8") +
  fs.readFileSync(path.join(root, "data", "content-pt.json"), "utf8");
if (/scribd|navico-online|spiegazione nella dispensa/i.test(publicReferencePayload))
  fail("A interface pública ainda contém referências privadas/Scribd/Navico.");
if (
  !appSource.includes('context.strokeStyle = "#ffd600"') ||
  !appSource.includes('context.strokeStyle = "#ec008c"') ||
  !appSource.includes("context.lineWidth = 1")
)
  fail("Os pontos da carta não usam aro amarelo e cruz magenta de 1 px.");
const chartInteractionContracts = [
  ['addEventListener("wheel", handleChartWheel, { passive: false })', "zoom"],
  ['addEventListener("pointerdown", handleChartPointerDown)', "arraste"],
  ['addEventListener("pointermove", handleChartPointerMove)', "movimento"],
  ['addEventListener("pointercancel", finishChartPointer)', "cancelamento"],
  ['addEventListener("keydown", handleChartKeydown)', "teclado"],
];
chartInteractionContracts.forEach(([contract, interaction]) => {
  if (!appSource.includes(contract))
    fail(`A carta não contém o contrato de interação por ${interaction}.`);
});
if (
  !stylesSource.includes("touch-action: none") ||
  !stylesSource.includes(".chart-viewport.is-panning") ||
  !indexHtml.includes('draggable="false"') ||
  !indexHtml.includes('data-ui="chartGestureHint"')
) {
  fail("A carta não contém toda a configuração visual e touch para zoom/pan.");
}
const studyFeatureIds = [
  "bankSearch",
  "bankTheme",
  "bankTopic",
  "bankStatus",
  "startRandomFiltered",
  "startSelectedQuiz",
  "studyProfilePanel",
  "profileModal",
  "accountModalBody",
];
studyFeatureIds.forEach((id) => {
  if (!indexHtml.includes(`id="${id}"`))
    fail(`A interface de estudo não contém #${id}.`);
});
if (/bankLimit|id="bankMore"/.test(indexHtml + appSource))
  fail("A banca ainda limita artificialmente a lista de questões.");
if (
  !appSource.includes('const PROFILE_KEY = "rotta12-study-profile-v1"') ||
  !appSource.includes("recordQuizAnswer") ||
  !appSource.includes("startUnseenSimulation")
)
  fail("O perfil local ou o simulado de questões inéditas está incompleto.");
if (
  !appSource.includes(
    'import { accountService } from "./account-service.js"',
  ) ||
  !appSource.includes("initializeStudyAccount") ||
  !appSource.includes("scheduleProgressSync")
) {
  fail("A interface não inicializa a conta ou a sincronização de progresso.");
}
if (
  !accountSource.includes("https://accounts.engnata.eu") ||
  !accountSource.includes("LocalAuthStore") ||
  !accountSource.includes("/api/rotta12/account/email") ||
  !accountSource.includes('collection("study_progress")')
) {
  fail("O cliente de conta não contém o endpoint e o progresso esperados.");
}
if (
  !accountMigration.includes("cascadeDelete: true") ||
  !accountMigration.includes("user = @request.auth.id") ||
  !accountMigration.includes("idx_progress_user_question")
) {
  fail(
    "O schema do backend não garante posse, unicidade e exclusão em cascata.",
  );
}
if (
  !accountApiHook.includes('$apis.requireAuth("users")') ||
  !accountApiHook.includes("validatePassword(password)")
) {
  fail("A troca direta de e-mail não exige autenticação e senha atual.");
}

const imageCount = fs
  .readdirSync(path.join(root, "assets", "quiz-images"))
  .filter((file) => file.endsWith(".png")).length;
if (imageCount !== 103) fail("São esperadas 103 figuras ministeriais.");

const snapshot = quiz.map(({ id, code, correct, figure }) => ({
  id,
  code,
  correct,
  figure,
}));
const summary = {
  questions: quiz.length,
  translatedQuestions: quizPt.length,
  identitySnapshotRecords: snapshot.length,
  topics: topicCount,
  exercises: exercises.length,
  chartedExercises: chartData.exercises.length,
  chartPoints: chartData.points.length,
  chartSourceDimensions: `${gifWidth}x${gifHeight}`,
  chartDimensions: `${alignedWidth}x${alignedHeight}`,
  chartRotationDegrees: alignment.rotationDegrees,
  chartGridResidualDegrees: Math.max(
    Math.abs(meridianResidualDegrees),
    Math.abs(parallelResidualDegrees),
  ),
  chartLabelsClearEveryRoute: true,
  chartWheelPinchAndPan: true,
  chartKeyboardNavigation: true,
  structuredExerciseAnswers: structuredExerciseAnswerCount,
  exerciseAnswerRangesLabeled: true,
  figures: imageCount,
  officialQuestionReferences: questionAuthority.references.length,
  officialReferenceRules: Object.keys(questionAuthority.rules).length,
  officialSources: authoritativeSources.sources.length,
  officialLocalCopies: authoritativeSources.sources.filter(
    (source) => source.localFile,
  ).length,
  privateStudySourcesRemoved: true,
  chartPointTarget: "yellow-ring-magenta-cross-1px",
  bankRendersAllFilteredQuestions: true,
  localStudyProfile: true,
  cloudAccountSync: true,
  accountBackendSchema: true,
  unseenQuestionSimulation: true,
  answerKeyOnlyInItalianCanonicalLayer: true,
};

console.log(JSON.stringify(summary, null, 2));
