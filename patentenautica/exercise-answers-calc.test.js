import { describe, expect, it } from "vitest";
import {
  buildExerciseAnswers,
  formatCoordinateRange,
  parseExerciseSolution,
  splitExercisePrompt,
} from "./exercise-answers-calc.js";

const exercise14Prompt = `Partenza da Capo di Fonza alle ore 10:00.
determinare:
quesito 1: distanza
quesito 2 : ora di arrivo
quesito 3 : carburante da imbarcare
quesito 4 : coordinate punto di partenza
quesito 5 : coordinate punto di arrivo`;

describe("risposte strutturate del carteggio", () => {
  it("separa il testo introduttivo dai cinque quesiti", () => {
    const parsed = splitExercisePrompt(exercise14Prompt);
    expect(parsed.introduction).toContain("Capo di Fonza");
    expect(parsed.questions).toHaveLength(5);
    expect(parsed.questions[1]).toEqual({
      number: 2,
      label: "ora di arrivo",
    });
  });

  it("normalizza intervalli, orari e unità dell'esercizio 14", () => {
    expect(
      parseExerciseSolution(
        "distanza 3.2÷3.8 M\nETA 10:27÷10:33 - consumo 11.9÷14.1 lt.",
      ),
    ).toEqual({
      distance: "3,2–3,8 M",
      arrivalTime: "10:27–10:33",
      speed: "",
      fuel: "11,9–14,1 L",
    });
  });

  it("mostra la tolleranza di lettura per entrambe le coordinate", () => {
    expect(formatCoordinateRange({ lat: 42.735, lon: 10.286667 })).toBe(
      "42° 43,8′–44,4′ N · 010° 16,9′–17,5′ E",
    );
  });

  it("associa ogni risposta al quesito corrispondente", () => {
    const result = buildExerciseAnswers({
      prompt: exercise14Prompt,
      solution: "distanza 3.2÷3.8 M\nETA 10:27÷10:33 - consumo 11.9÷14.1 lt.",
      from: { lat: 42.735, lon: 10.286667 },
      to: { lat: 42.713333, lon: 10.361667 },
    });
    expect(result.questions.map(({ answer }) => answer)).toEqual([
      "3,2–3,8 M",
      "10:27–10:33",
      "11,9–14,1 L",
      "42° 43,8′–44,4′ N · 010° 16,9′–17,5′ E",
      "42° 42,5′–43,1′ N · 010° 21,4′–22,0′ E",
    ]);
    expect(result.questions.every(({ isInterval }) => isInterval)).toBe(true);
  });
});
