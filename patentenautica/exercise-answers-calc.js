const QUESTION_PATTERN =
  /^[\s\d.]*(?:quesito|domanda|pergunta|quest[aã]o)\s*(\d+)\s*:\s*(.+)$/i;

function cleanInterval(value) {
  return value
    .trim()
    .replace(/\s*÷\s*/g, "–")
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "");
}

function decimalCommas(value) {
  return value.replace(/(\d)\.(\d)/g, "$1,$2");
}

function normalizeMeasurement(value, unit, discardedUnit = null) {
  let normalized = cleanInterval(value);
  if (discardedUnit) normalized = normalized.replace(discardedUnit, "").trim();
  normalized = decimalCommas(normalized);
  return `${normalized} ${unit}`;
}

function normalizeTime(value) {
  return cleanInterval(value).replace(/(\d{2})\.(\d{2})/g, "$1:$2");
}

function extractBeforeConsumption(solution, label) {
  const match = solution.match(
    new RegExp(`${label}\\s+(.+?)(?=\\s*[–-]\\s*consumo|\\r?\\n|$)`, "i"),
  );
  return match?.[1] || "";
}

function coordinateEndpoint(totalMinutes, degreeDigits) {
  const degrees = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes - degrees * 60;
  return {
    degrees: String(degrees).padStart(degreeDigits, "0"),
    minutes: minutes.toFixed(1).replace(".", ","),
  };
}

function formatAxisRange(value, hemisphere, degreeDigits) {
  const centerMinutes = Math.abs(value) * 60;
  const lower = coordinateEndpoint(centerMinutes - 0.3, degreeDigits);
  const upper = coordinateEndpoint(centerMinutes + 0.3, degreeDigits);
  if (lower.degrees === upper.degrees) {
    return `${lower.degrees}° ${lower.minutes}′–${upper.minutes}′ ${hemisphere}`;
  }
  return `${lower.degrees}° ${lower.minutes}′–${upper.degrees}° ${upper.minutes}′ ${hemisphere}`;
}

function normalizedQuestionKind(label) {
  const normalized = label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (normalized.includes("distanza")) return "distance";
  if (normalized.includes("ora di arrivo")) return "arrivalTime";
  if (normalized.includes("velocita")) return "speed";
  if (normalized.includes("carburante")) return "fuel";
  if (
    normalized.includes("coordinate") &&
    normalized.includes("punto di partenza")
  )
    return "departureCoordinates";
  if (
    normalized.includes("coordinate") &&
    normalized.includes("punto di arrivo")
  )
    return "arrivalCoordinates";
  return "unknown";
}

export function splitExercisePrompt(prompt) {
  const questions = [];
  const introduction = [];
  String(prompt)
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(QUESTION_PATTERN);
      if (match) {
        questions.push({
          number: Number(match[1]),
          label: match[2].trim(),
        });
      } else if (!/^\s*(?:\d+\.)?\s*$/.test(line)) {
        introduction.push(line);
      }
    });
  return {
    introduction: introduction.join("\n").trim(),
    questions: questions.sort((left, right) => left.number - right.number),
  };
}

export function parseExerciseSolution(solution) {
  const distance = solution.match(/distanza[.:]?\s*([^\r\n]+)/i)?.[1] || "";
  const arrivalTime = extractBeforeConsumption(solution, "ETA");
  const speed = extractBeforeConsumption(solution, "Velocità");
  const fuel = solution.match(/consumo\s+([^\r\n]+)/i)?.[1] || "";
  return {
    distance: distance ? normalizeMeasurement(distance, "M", /\s*M\.?$/i) : "",
    arrivalTime: arrivalTime ? normalizeTime(arrivalTime) : "",
    speed: speed ? normalizeMeasurement(speed, "kn", /\s*n\.?$/i) : "",
    fuel: fuel ? normalizeMeasurement(fuel, "L", /\s*lt\.?$/i) : "",
  };
}

export function formatCoordinateRange(point) {
  return `${formatAxisRange(point.lat, "N", 2)} · ${formatAxisRange(
    point.lon,
    "E",
    3,
  )}`;
}

export function buildExerciseAnswers({ prompt, solution, from, to }) {
  const parsedPrompt = splitExercisePrompt(prompt);
  const parsedSolution = parseExerciseSolution(solution);
  const values = {
    ...parsedSolution,
    departureCoordinates: formatCoordinateRange(from),
    arrivalCoordinates: formatCoordinateRange(to),
  };
  return {
    introduction: parsedPrompt.introduction,
    questions: parsedPrompt.questions.map((question) => {
      const kind = normalizedQuestionKind(question.label);
      const answer = values[kind] || "";
      return {
        ...question,
        kind,
        answer,
        isInterval: answer.includes("–"),
      };
    }),
  };
}
