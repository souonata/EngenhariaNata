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

function normalizeUsername(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 40);
}

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

  async register(identity, password, displayName = "") {
    const cleanIdentity = identity.trim().toLowerCase();
    const mailIdentity = isEmail(cleanIdentity);
    const username = mailIdentity
      ? internalMailUsername()
      : normalizeUsername(cleanIdentity);
    if (username.length < 3) throw new Error("invalid_username");

    await pb.collection("users").create({
      username,
      email: mailIdentity ? cleanIdentity : "",
      displayName: displayName.trim().slice(0, 80),
      password,
      passwordConfirm: password,
    });
    const result = await pb
      .collection("users")
      .authWithPassword(cleanIdentity, password);
    if (mailIdentity) {
      pb.collection("users")
        .requestVerification(cleanIdentity)
        .catch(() => {});
    }
    return result.record;
  },

  async login(identity, password) {
    const result = await pb
      .collection("users")
      .authWithPassword(identity.trim().toLowerCase(), password);
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

  async changePassword(oldPassword, password) {
    const record = pb.authStore.record;
    const identity = record.email || record.username;
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
    const identity = record.email || record.username;
    await pb.collection("users").authWithPassword(identity, password);
    await pb.collection("users").delete(record.id);
    pb.authStore.clear();
  },
};
