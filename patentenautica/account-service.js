import PocketBase, { LocalAuthStore } from "pocketbase";

const isLocalHost = ["127.0.0.1", "localhost"].includes(location.hostname);
export const ACCOUNT_API_URL =
  import.meta.env.VITE_PATENTE_API_URL ||
  (isLocalHost ? "http://127.0.0.1:8090" : "https://accounts.engnata.eu");

const pb = new PocketBase(
  ACCOUNT_API_URL,
  new LocalAuthStore("rotta12-account-auth"),
);
pb.autoCancellation(false);

function internalMailUsername() {
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  return `mail_${random}`;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function upsertProgress(question, progress) {
  const data = {
    user: pb.authStore.record.id,
    question: Number(question),
    attempts: Number(progress.attempts || 0),
    correct: Number(progress.correct || 0),
    wrong: Number(progress.wrong || 0),
    lastCorrect: Boolean(progress.lastCorrect),
    lastAnswered: progress.lastAnswered,
  };

  if (progress._remoteId) {
    return pb.collection("study_progress").update(progress._remoteId, data);
  }

  try {
    return await pb.collection("study_progress").create(data);
  } catch (error) {
    if (error?.status !== 400) throw error;
    const existing = await pb
      .collection("study_progress")
      .getFirstListItem(pb.filter("question = {:question}", { question }));
    return pb.collection("study_progress").update(existing.id, data);
  }
}

async function upsertExercise(exercise, progress) {
  const data = {
    user: pb.authStore.record.id,
    exercise: Number(exercise),
    views: Math.max(1, Number(progress.views || 1)),
    solutionViews: Math.max(0, Number(progress.solutionViews || 0)),
    completed: Boolean(progress.completed),
    lastViewed: progress.lastViewed,
  };

  if (progress._remoteId) {
    return pb.collection("study_exercises").update(progress._remoteId, data);
  }

  try {
    return await pb.collection("study_exercises").create(data);
  } catch (error) {
    if (error?.status !== 400) throw error;
    const existing = await pb
      .collection("study_exercises")
      .getFirstListItem(pb.filter("exercise = {:exercise}", { exercise }));
    return pb.collection("study_exercises").update(existing.id, data);
  }
}

export const accountService = {
  get current() {
    return pb.authStore.record;
  },

  get isAuthenticated() {
    return pb.authStore.isValid && Boolean(pb.authStore.record);
  },

  async initialize() {
    await pb.health.check();
    if (!pb.authStore.isValid) return null;
    try {
      const result = await pb.collection("users").authRefresh();
      return result.record;
    } catch {
      pb.authStore.clear();
      return null;
    }
  },

  async register(email, password, displayName = "") {
    const cleanEmail = email.trim().toLowerCase();
    if (!isEmail(cleanEmail)) throw new Error("invalid_email");
    if (!password) throw new Error("empty_password");

    await pb.collection("users").create({
      username: internalMailUsername(),
      email: cleanEmail,
      displayName: displayName.trim().slice(0, 80),
      password,
      passwordConfirm: password,
    });
    const result = await pb
      .collection("users")
      .authWithPassword(cleanEmail, password);
    pb.collection("users")
      .requestVerification(cleanEmail)
      .catch(() => {});
    return result.record;
  },

  async login(email, password) {
    const cleanEmail = email.trim().toLowerCase();
    if (!isEmail(cleanEmail)) throw new Error("invalid_email");
    const result = await pb
      .collection("users")
      .authWithPassword(cleanEmail, password);
    return result.record;
  },

  logout() {
    pb.authStore.clear();
  },

  async loadProgress() {
    return pb.collection("study_progress").getFullList({
      sort: "question",
      fields:
        "id,question,attempts,correct,wrong,lastCorrect,lastAnswered,updated",
    });
  },

  upsertProgress,

  async loadExerciseProgress() {
    return pb.collection("study_exercises").getFullList({
      sort: "exercise",
      fields: "id,exercise,views,solutionViews,completed,lastViewed,updated",
    });
  },

  upsertExercise,

  async loadQuizAttempts() {
    return pb.collection("quiz_attempts").getFullList({
      sort: "-completedAt",
      fields:
        "id,clientId,mode,total,correct,passed,questionIds,completedAt,created",
    });
  },

  async createQuizAttempt(attempt) {
    const data = {
      user: pb.authStore.record.id,
      clientId: attempt.id,
      mode: attempt.mode,
      total: Number(attempt.total),
      correct: Number(attempt.correct),
      passed: Boolean(attempt.passed),
      questionIds: attempt.questionIds,
      completedAt: attempt.completedAt,
    };
    try {
      return await pb.collection("quiz_attempts").create(data);
    } catch (error) {
      if (error?.status !== 400) throw error;
      return pb
        .collection("quiz_attempts")
        .getFirstListItem(
          pb.filter("clientId = {:clientId}", { clientId: attempt.id }),
        );
    }
  },

  async resetProgress(scope, id = "") {
    return pb.send("/api/rotta12/progress/reset", {
      method: "POST",
      body: { scope, id: String(id) },
    });
  },

  async changePassword(oldPassword, password) {
    const record = pb.authStore.record;
    const identity = record.email;
    await pb.collection("users").update(record.id, {
      oldPassword,
      password,
      passwordConfirm: password,
    });
    const result = await pb
      .collection("users")
      .authWithPassword(identity, password);
    return result.record;
  },

  async requestPasswordReset(identity) {
    return pb
      .collection("users")
      .requestPasswordReset(identity.trim().toLowerCase());
  },

  async confirmPasswordReset(token, password) {
    return pb
      .collection("users")
      .confirmPasswordReset(token, password, password);
  },

  async requestEmailChange(email) {
    return pb
      .collection("users")
      .requestEmailChange(email.trim().toLowerCase());
  },

  async changeEmail(email, password) {
    const record = pb.authStore.record;
    const nextEmail = email.trim().toLowerCase();
    await pb.send("/api/rotta12/account/email", {
      method: "POST",
      body: { email: nextEmail, password },
    });
    pb.authStore.clear();
    const result = await pb
      .collection("users")
      .authWithPassword(nextEmail, password);
    pb.collection("users")
      .requestVerification(nextEmail)
      .catch(() => {});
    return result.record;
  },

  async confirmEmailChange(token, password) {
    return pb.collection("users").confirmEmailChange(token, password);
  },

  async confirmVerification(token) {
    return pb.collection("users").confirmVerification(token);
  },

  async deleteAccount(password) {
    const record = pb.authStore.record;
    const identity = record.email;
    await pb.collection("users").authWithPassword(identity, password);
    await pb.collection("users").delete(record.id);
    pb.authStore.clear();
  },
};
