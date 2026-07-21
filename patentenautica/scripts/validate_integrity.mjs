import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

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
const questionReferences = JSON.parse(
  fs.readFileSync(path.join(root, "data/question-references.json"), "utf8"),
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

if (
  questionReferences.source.pages !== 67 ||
  questionReferences.references.length !== quiz.length
) {
  fail("O índice da Dispensa deve cobrir as 1.472 questões e 67 páginas.");
}
const referenceIds = new Set();
const referenceMatches = { direct: 0, topic: 0, related: 0 };
questionReferences.references.forEach((reference) => {
  if (referenceIds.has(reference.id))
    fail(`Referência PDF duplicada para a questão ${reference.id}.`);
  referenceIds.add(reference.id);
  if (
    !Number.isInteger(reference.page) ||
    reference.page < 1 ||
    reference.page > 67
  )
    fail(`Página inválida na referência da questão ${reference.id}.`);
  if (!questionReferences.sections[reference.section])
    fail(`Seção desconhecida na referência da questão ${reference.id}.`);
  if (!(reference.match in referenceMatches))
    fail(`Tipo de correspondência inválido na questão ${reference.id}.`);
  if ("correct" in reference || "answer" in reference)
    fail(
      `A referência da questão ${reference.id} não pode duplicar o gabarito.`,
    );
  referenceMatches[reference.match] += 1;
});
quiz.forEach((question) => {
  if (!referenceIds.has(question.id))
    fail(`Questão ${question.id} sem referência na Dispensa.`);
});
for (const [match, count] of Object.entries(referenceMatches)) {
  if (questionReferences.summary[match] !== count)
    fail(`Resumo divergente para referências PDF do tipo ${match}.`);
}

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

const chartPointIds = new Set(chartData.points.map((point) => point.id));
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

const calibration = chartData.chart.calibration;
const projectPoint = (point) => {
  const longitudeMinutes = (point.lon - calibration.longitudeOrigin) * 60;
  const latitudeMinutes = (point.lat - 42) * 60;
  const longitudeAxis =
    calibration.meridianX +
    calibration.pixelsPerLongitudeMinute * longitudeMinutes;
  const latitudeAxis =
    calibration.parallelY +
    calibration.pixelsPerLatitudeMinute *
      (calibration.referenceLatitudeMinutes - latitudeMinutes);
  const divisor = 1 + calibration.meridianSlope * calibration.parallelSlope;
  const y =
    (latitudeAxis + calibration.parallelSlope * longitudeAxis) / divisor;
  const x = longitudeAxis - calibration.meridianSlope * y;
  return { x, y };
};
chartData.points.forEach((point) => {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon))
    fail(`Coordenada inválida no ponto ${point.id}.`);
  if (!point.name || !point.context || !point.contextPt)
    fail(`Ponto ${point.id} sem rótulo bilíngue completo.`);
  const pixel = projectPoint(point);
  if (
    pixel.x < 0 ||
    pixel.x > chartData.chart.width ||
    pixel.y < 0 ||
    pixel.y > chartData.chart.height
  ) {
    fail(`O ponto ${point.id} ficou fora da imagem da carta 5/D.`);
  }
});

const chartPath = path.join(root, "carta nautica 5D.gif");
const gifHeader = fs.readFileSync(chartPath).subarray(0, 10);
if (gifHeader.subarray(0, 3).toString("ascii") !== "GIF")
  fail("O arquivo da carta 5/D não é um GIF válido.");
const gifWidth = gifHeader.readUInt16LE(6);
const gifHeight = gifHeader.readUInt16LE(8);
if (
  gifWidth !== chartData.chart.width ||
  gifHeight !== chartData.chart.height
) {
  fail(
    `Dimensões da carta divergentes: ${gifWidth}x${gifHeight}, esperado ${chartData.chart.width}x${chartData.chart.height}.`,
  );
}

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
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
if (!/data-open-handbook/.test(appSource) || !/handbookModal/.test(indexHtml))
  fail("A interface não expõe as referências da Dispensa para o quiz.");
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
  chartDimensions: `${gifWidth}x${gifHeight}`,
  figures: imageCount,
  pdfQuestionReferences: questionReferences.references.length,
  pdfReferenceMatches: referenceMatches,
  bankRendersAllFilteredQuestions: true,
  localStudyProfile: true,
  cloudAccountSync: true,
  accountBackendSchema: true,
  unseenQuestionSimulation: true,
  answerKeyOnlyInItalianCanonicalLayer: true,
};

console.log(JSON.stringify(summary, null, 2));
