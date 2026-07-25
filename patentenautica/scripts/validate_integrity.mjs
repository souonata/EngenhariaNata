import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  chartAlignment,
  placeRouteLabels,
  projectChartGuides,
  projectChartTolerance,
  rectsOverlap,
  segmentIntersectsRect,
  toponymHighlightBounds,
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
    if (
      !localPath.startsWith(`${sourceRoot}${path.sep}`) ||
      !fs.existsSync(localPath)
    )
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

const borderCalibration = chartData.chart.borderCalibration;
if (
  borderCalibration?.method !== "measured-graduated-border" ||
  borderCalibration.sourceWidth !== chartData.chart.source.displayImageWidth ||
  borderCalibration.sourceHeight !== chartData.chart.source.displayImageHeight
) {
  fail("A calibração não corresponde às bordas graduadas da carta original.");
}
const horizontalBorderScale =
  chartData.chart.width / borderCalibration.sourceWidth;
const verticalBorderScale =
  chartData.chart.height / borderCalibration.sourceHeight;
let borderTickMaximumErrorPixels = 0;
borderCalibration.longitude.ticks.forEach((tick) => {
  const projection = projectChartGuides(chartData.chart, {
    lat: 42.5,
    lon: borderCalibration.longitude.originDegrees + tick.minutes / 60,
  });
  const [top, bottom] = [...projection.longitude.line].sort(
    (left, right) => left.y - right.y,
  );
  const errors = [
    Math.abs(top.x / horizontalBorderScale - tick.topX),
    Math.abs(bottom.x / horizontalBorderScale - tick.bottomX),
  ];
  borderTickMaximumErrorPixels = Math.max(
    borderTickMaximumErrorPixels,
    ...errors,
  );
});
borderCalibration.latitude.ticks.forEach((tick) => {
  const projection = projectChartGuides(chartData.chart, {
    lat: borderCalibration.latitude.originDegrees + tick.minutes / 60,
    lon: 10.5,
  });
  const [left, right] = [...projection.latitude.line].sort(
    (first, second) => first.x - second.x,
  );
  const errors = [
    Math.abs(left.y / verticalBorderScale - tick.leftY),
    Math.abs(right.y / verticalBorderScale - tick.rightY),
  ];
  borderTickMaximumErrorPixels = Math.max(
    borderTickMaximumErrorPixels,
    ...errors,
  );
});
if (borderTickMaximumErrorPixels > 0.001)
  fail("As guias não passam pelas graduações medidas nas quatro bordas.");

const bottomLongitudeX = (minutes) => {
  const projection = projectChartGuides(chartData.chart, {
    lat: 42.36,
    lon: 11 + minutes / 60,
  });
  return [...projection.longitude.line].sort(
    (left, right) => left.y - right.y,
  )[1].x;
};
const minuteNineX = bottomLongitudeX(9);
const minuteTenX = bottomLongitudeX(10);
const minuteNinePointTwoFraction =
  (bottomLongitudeX(9.2) - minuteNineX) / (minuteTenX - minuteNineX);
if (Math.abs(minuteNinePointTwoFraction - 0.2) > 0.000001)
  fail("11° 9,2′ E não ficou 20% após a graduação de 9′.");

function pointToLineDistance(point, line) {
  const [start, end] = line;
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  return (
    Math.abs(
      deltaY * point.x - deltaX * point.y + end.x * start.y - end.y * start.x,
    ) / Math.hypot(deltaX, deltaY)
  );
}

function isOnChartBorder(point) {
  const epsilon = 0.01;
  return (
    Math.abs(point.x) < epsilon ||
    Math.abs(point.x - chartData.chart.width) < epsilon ||
    Math.abs(point.y) < epsilon ||
    Math.abs(point.y - chartData.chart.height) < epsilon
  );
}

chartData.points.forEach((point) => {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon))
    fail(`Coordenada inválida no ponto ${point.id}.`);
  if (!point.name || !point.context || !point.contextPt)
    fail(`Ponto ${point.id} sem rótulo bilíngue completo.`);
  const projection = projectChartTolerance(chartData.chart, point);
  const pixel = projection.point;
  if (
    pixel.x < 0 ||
    pixel.x > chartData.chart.width ||
    pixel.y < 0 ||
    pixel.y > chartData.chart.height
  ) {
    fail(`O ponto ${point.id} ficou fora da imagem da carta 5/D.`);
  }
  [projection.longitude, projection.latitude].forEach((guide) => {
    if (guide.line.length !== 2 || !isOnChartBorder(guide.borderAnchor))
      fail(`A guia geográfica de ${point.id} não alcança a borda da carta.`);
    if (pointToLineDistance(pixel, guide.line) > 0.01)
      fail(`A guia geográfica de ${point.id} não cruza o centro do ponto.`);
    if (
      guide.segment.length !== 2 ||
      !isOnChartBorder(guide.segment[0]) ||
      Math.hypot(guide.segment[1].x - pixel.x, guide.segment[1].y - pixel.y) >
        0.01
    )
      fail(`O segmento visível de ${point.id} não liga a borda ao centro.`);
  });
  const tolerance = projection.tolerance;
  if (
    chartData.chart.answerToleranceMinutes !== 0.3 ||
    tolerance.minutes !== 0.3 ||
    tolerance.polygon.length !== 4
  )
    fail(`A área de tolerância de ${point.id} não usa ±0,3 minuto.`);
  tolerance.polygon.forEach((corner) => {
    if (
      corner.x < 0 ||
      corner.x > chartData.chart.width ||
      corner.y < 0 ||
      corner.y > chartData.chart.height
    )
      fail(`A área de tolerância de ${point.id} saiu da carta.`);
  });
  if (
    tolerance.bounds.width <= 0 ||
    tolerance.bounds.height <= 0 ||
    pixel.x < tolerance.bounds.left ||
    pixel.x > tolerance.bounds.left + tolerance.bounds.width ||
    pixel.y < tolerance.bounds.top ||
    pixel.y > tolerance.bounds.top + tolerance.bounds.height
  )
    fail(`O centro de ${point.id} não está dentro dos limites aceitos.`);
  if (!Array.isArray(point.toponymHighlight) || !point.toponymHighlight.length)
    fail(`Ponto ${point.id} sem realce do topônimo impresso.`);
  point.toponymHighlight.forEach((stroke) => {
    if (
      !["x1", "y1", "x2", "y2", "width"].every((key) =>
        Number.isFinite(stroke[key]),
      ) ||
      stroke.width <= 0
    )
      fail(`Realce inválido no topônimo ${point.id}.`);
  });
  const highlight = toponymHighlightBounds(point);
  if (
    highlight.left < 0 ||
    highlight.top < 0 ||
    highlight.left + highlight.width > chartData.chart.width ||
    highlight.top + highlight.height > chartData.chart.height
  )
    fail(`O realce do topônimo ${point.id} ficou fora da carta.`);
});

chartData.exercises.forEach((route) => {
  const from = chartPointMap.get(route.from);
  const to = chartPointMap.get(route.to);
  const startProjection = projectChartTolerance(chartData.chart, from);
  const endProjection = projectChartTolerance(chartData.chart, to);
  const start = startProjection.point;
  const end = endProjection.point;
  const obstacles = [from, to]
    .map((point) => toponymHighlightBounds(point, 8))
    .concat([startProjection.tolerance.bounds, endProjection.tolerance.bounds]);
  const layouts = placeRouteLabels({
    start,
    end,
    labels: [{ width: 110 }, { width: 84 }],
    bounds: chartData.chart,
    height: 32,
    obstacles,
    edge: 12,
    gap: 30,
    markerClearance: 18,
    routePadding: 8,
  });
  if (layouts.some((layout) => !layout))
    fail(`Não há espaço seguro para Partenza e Arrivo na rota ${route.id}.`);
  layouts.forEach((layout) => {
    if (segmentIntersectsRect(start, end, layout, 8))
      fail(`Um rótulo cobre a rota do exercício ${route.id}.`);
    if (obstacles.some((obstacle) => rectsOverlap(layout, obstacle, 6)))
      fail(`Um rótulo cobre o topônimo impresso da rota ${route.id}.`);
  });
  if (rectsOverlap(layouts[0], layouts[1], 18))
    fail(`Os rótulos se sobrepõem no exercício ${route.id}.`);
});

const chartSource = chartData.chart.source;
const chartPdfPath = path.join(root, chartSource.pdf);
const chartPdfBytes = fs.readFileSync(chartPdfPath);
if (chartPdfBytes.subarray(0, 5).toString("ascii") !== "%PDF-")
  fail("A nova carta 5/D com bordo não é um PDF válido.");
const chartPdfText = chartPdfBytes.toString("latin1");
if (
  !chartPdfText.includes(`/Width ${chartSource.embeddedImageWidth}`) ||
  !chartPdfText.includes(`/Height ${chartSource.embeddedImageHeight}`)
) {
  fail("As dimensões da imagem incorporada no PDF da carta são divergentes.");
}

function readJpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8)
    fail("A carta 5/D exibida não é um JPEG válido.");
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const length = buffer.readUInt16BE(offset);
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb].includes(
        marker,
      )
    ) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }
  fail("Não foi possível ler as dimensões do JPEG da carta 5/D.");
}

const displayChartPath = path.join(root, chartSource.displayImage);
const displayChartBytes = fs.readFileSync(displayChartPath);
const displayChartDimensions = readJpegDimensions(displayChartBytes);
if (
  displayChartDimensions.width !== chartSource.displayImageWidth ||
  displayChartDimensions.height !== chartSource.displayImageHeight
) {
  fail(
    `Dimensões da carta web divergentes: ${displayChartDimensions.width}x${displayChartDimensions.height}, esperado ${chartSource.displayImageWidth}x${chartSource.displayImageHeight}.`,
  );
}
const displayAspectRatio =
  displayChartDimensions.width / displayChartDimensions.height;
const logicalAspectRatio = chartData.chart.width / chartData.chart.height;
if (
  displayChartDimensions.width < chartData.chart.width ||
  displayChartDimensions.height < chartData.chart.height ||
  Math.abs(displayAspectRatio - logicalAspectRatio) > 0.001
) {
  fail("A carta web não preserva a geometria do plano lógico calibrado.");
}
const displayChartSha256 = crypto
  .createHash("sha256")
  .update(displayChartBytes)
  .digest("hex");
if (
  chartSource.displayImageSource !== "original-pdf-embedded-image" ||
  displayChartBytes.length !== chartSource.displayImageBytes ||
  displayChartSha256 !== chartSource.displayImageSha256
) {
  fail("A carta web não corresponde ao JPEG original extraído do PDF.");
}

const enhancedPdfPath = path.join(root, chartSource.enhancedPdf);
const enhancedPdfBytes = fs.readFileSync(enhancedPdfPath);
if (enhancedPdfBytes.subarray(0, 5).toString("ascii") !== "%PDF-")
  fail("A carta 5/D melhorada não é um PDF válido.");
const enhancedPdfText = enhancedPdfBytes.toString("latin1");
if (
  !enhancedPdfText.includes(`/Width ${chartSource.enhancedImageWidth}`) ||
  !enhancedPdfText.includes(`/Height ${chartSource.enhancedImageHeight}`) ||
  !enhancedPdfText.includes("/MediaBox [ 0 0 3176 2051 ]") ||
  chartSource.enhancedPdfDpi !== 340 ||
  chartSource.contentSimilarity < 0.999
) {
  fail("O PDF melhorado não preserva página, resolução ou conteúdo esperado.");
}
if (
  !Array.isArray(chartData.chart.projectionTransform?.matrix) ||
  chartData.chart.projectionTransform.matrix.length !== 9 ||
  !chartData.chart.projectionTransform.matrix.every(Number.isFinite) ||
  chartData.chart.projectionTransform.inliers < 3000 ||
  chartData.chart.projectionTransform.medianErrorPixels > 1
) {
  fail("A transformação da carta com bordo não tem precisão suficiente.");
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
const activityMigration = fs.readFileSync(
  path.join(
    root,
    "backend",
    "pb_migrations",
    "1721600300_email_and_activity_progress.js",
  ),
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
  /data-open-handbook|handbookModal|handbookOfficialAnswerText|handbookSourceCards|questionAuthority/.test(
    indexHtml + appSource,
  )
)
  fail("A interface ainda expõe o antigo painel de fontes por questão.");
if (
  !/id="view-sources"/.test(indexHtml) ||
  !/authoritativeSources/.test(appSource)
)
  fail("A interface não mantém a seção geral de fontes oficiais.");
const publicReferencePayload =
  indexHtml +
  appSource +
  fs.readFileSync(path.join(root, "data", "content.js"), "utf8") +
  fs.readFileSync(path.join(root, "data", "content-pt.json"), "utf8");
if (
  /scribd|navico-online|spiegazione nella dispensa/i.test(
    publicReferencePayload,
  )
)
  fail("A interface pública ainda contém referências privadas/Scribd/Navico.");
if (
  !appSource.includes('context.strokeStyle = "#ec008c"') ||
  !appSource.includes("context.lineWidth = 1") ||
  !appSource.includes("const crossHalfSize = 8") ||
  appSource.includes('context.strokeStyle = "#ffd600"') ||
  appSource.includes("const markerRadius")
)
  fail("Os pontos da carta não usam exclusivamente a cruz magenta de 1 px.");
if (
  !appSource.includes("const overlayOpacity = 0.5") ||
  !appSource.includes("context.globalAlpha = overlayOpacity") ||
  !appSource.includes("const routeLineWidth = 5")
)
  fail("Rota e rótulos da carta não estão finos e a 50%.");
if (
  !appSource.includes("const toleranceFillOpacity = 0.18") ||
  !appSource.includes("const guideOpacity = 0.62") ||
  !appSource.includes("projection.tolerance.polygon") ||
  !appSource.includes("guide.segment[0].x") ||
  appSource.includes("const toleranceStrokeOpacity") ||
  appSource.includes("guide.borderAnchor.x") ||
  (appSource.match(
    /traceChartPolygon\(context, projection\.tolerance\.polygon\);/g,
  ) || []).length !== 1 ||
  !indexHtml.includes('class="chart-reading-legend"')
)
  fail(
    "A carta não mostra somente o sombreado sem contorno e as guias desde as escalas graduadas.",
  );
if (
  !appSource.includes("./carta nautica 5D originale.jpg?url") ||
  !appSource.includes("./Carta 5D 340dpi migliorata.pdf?url") ||
  !appSource.includes("function ensureChartImageLoaded()") ||
  !appSource.includes("image.src = chart5dUrl") ||
  !appSource.includes("ensureChartImageLoaded();") ||
  !appSource.includes('chartFullLink").href = chart5dEnhancedPdfUrl') ||
  appSource.includes("./carta nautica 5D allineata.webp?url") ||
  appSource.includes("./carta nautica 5D con bordo.jpg?url")
)
  fail(
    "O visualizador não usa sob demanda a carta original e o PDF opcional em 340 DPI.",
  );
if (
  !appSource.includes("const markerEndpointInset =") ||
  !appSource.includes(
    "context.moveTo(visibleRouteStart.x, visibleRouteStart.y)",
  ) ||
  !appSource.includes("context.lineTo(visibleRouteEnd.x, visibleRouteEnd.y)")
)
  fail("A rota laranja não preserva o centro exato dos pontos da carta.");
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
  "view-account",
  "accountPageContent",
];
studyFeatureIds.forEach((id) => {
  if (!indexHtml.includes(`id="${id}"`))
    fail(`A interface de estudo não contém #${id}.`);
});
if (
  !appSource.includes("const BANK_BATCH_SIZE = 40") ||
  !appSource.includes("data-bank-more") ||
  !appSource.includes("data-bank-all") ||
  !appSource.includes("results.slice(0, bankVisibleCount)")
) {
  fail(
    "A banca não preserva o carregamento progressivo com acesso a todos os resultados.",
  );
}
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
  !appSource.includes("scheduleProgressSync") ||
  !appSource.includes("scheduleExerciseSync") ||
  !appSource.includes("scheduleAttemptSync") ||
  !appSource.includes("renderAccountPage") ||
  !appSource.includes("resetStudyData")
) {
  fail("A interface não sincroniza todos os progressos ou a página da conta.");
}
if (
  !accountSource.includes("https://accounts.engnata.eu") ||
  !accountSource.includes("LocalAuthStore") ||
  !accountSource.includes("/api/rotta12/account/email") ||
  !accountSource.includes("/api/rotta12/progress/reset") ||
  !accountSource.includes('collection("study_progress")') ||
  !accountSource.includes('collection("study_exercises")') ||
  !accountSource.includes('collection("quiz_attempts")')
) {
  fail("O cliente de conta não contém todos os dados e endpoints esperados.");
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
  !activityMigration.includes('identityFields: ["email"]') ||
  !activityMigration.includes('getByName("password").min = 1') ||
  !activityMigration.includes("remove it from auth identities") ||
  !activityMigration.includes("Email-only login migration blocked") ||
  !activityMigration.includes('name: "study_exercises"') ||
  !activityMigration.includes('name: "quiz_attempts"') ||
  !activityMigration.includes("idx_exercises_user_exercise") ||
  !activityMigration.includes("idx_attempts_user_client")
) {
  fail(
    "A migração não garante email-only, senha não vazia e histórico privado.",
  );
}
if (
  !accountApiHook.includes('$apis.requireAuth("users")') ||
  !accountApiHook.includes("validatePassword(password)") ||
  !accountApiHook.includes("/api/rotta12/progress/reset") ||
  !accountApiHook.includes('scope === "all"')
) {
  fail("Os endpoints de conta e reset não estão protegidos como esperado.");
}
if (
  /minlength=["']8["']/.test(indexHtml + appSource) ||
  /password\.length\s*<\s*8/.test(appSource) ||
  !appSource.includes('type="email" maxlength="254" required')
) {
  fail("A interface ainda restringe a senha ou aceita login sem email.");
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
  chartSourceDimensions: `${chartSource.embeddedImageWidth}x${chartSource.embeddedImageHeight}`,
  chartDimensions: `${chartData.chart.width}x${chartData.chart.height}`,
  chartWebPixelDimensions: `${displayChartDimensions.width}x${displayChartDimensions.height}`,
  chartWebBytes: displayChartBytes.length,
  chartWebSource: chartSource.displayImageSource,
  chartDeferredLoading: true,
  chartHasGraduatedBorder: true,
  chartEnhancedPdfDpi: chartSource.enhancedPdfDpi,
  chartEnhancedPdfDimensions: `${chartSource.enhancedImageWidth}x${chartSource.enhancedImageHeight}`,
  chartContentSimilarity: chartSource.contentSimilarity,
  chartProjectionMedianErrorPixels:
    chartData.chart.projectionTransform.medianErrorPixels,
  chartRotationDegrees: alignment.rotationDegrees,
  chartGridResidualDegrees: Math.max(
    Math.abs(meridianResidualDegrees),
    Math.abs(parallelResidualDegrees),
  ),
  chartBorderCalibration: borderCalibration.method,
  chartBorderMeasuredTicks:
    borderCalibration.longitude.ticks.length * 2 +
    borderCalibration.latitude.ticks.length * 2,
  chartBorderTickMaximumErrorPixels: borderTickMaximumErrorPixels,
  chartLongitude11Degrees9Point2Fraction: minuteNinePointTwoFraction,
  chartCoordinateGuides: "visible-mean-from-nearest-border",
  chartToleranceAreas: chartData.points.length,
  chartToleranceMinutes: chartData.chart.answerToleranceMinutes,
  chartToponymHighlights: chartData.points.length,
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
  questionSourceModalRemoved: true,
  privateStudySourcesRemoved: true,
  chartPointTarget: "magenta-cross-1px",
  chartToleranceOutline: false,
  chartGuideBorderDots: false,
  chartRouteClearsPointTargets: true,
  chartOverlayOpacity: 0.5,
  chartRouteLineWidth: 5,
  chartCrossHalfSize: 8,
  bankProgressiveBatchSize: 40,
  bankCanShowAllFilteredQuestions: true,
  localStudyProfile: true,
  cloudAccountSync: true,
  accountBackendSchema: true,
  activityHistorySchema: true,
  unseenQuestionSimulation: true,
  answerKeyOnlyInItalianCanonicalLayer: true,
};

console.log(JSON.stringify(summary, null, 2));
