routerAdd(
  "POST",
  "/api/rotta12/account/email",
  (event) => {
    const data = new DynamicModel({
      email: "",
      password: "",
    });
    event.bindBody(data);

    const email = String(data.email || "")
      .trim()
      .toLowerCase();
    const password = String(data.password || "");
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !event.auth.validatePassword(password)
    ) {
      throw new BadRequestError("Invalid credentials or email address.");
    }

    if (event.auth.email() === email) {
      return event.json(200, { email, verified: event.auth.verified() });
    }

    event.auth.setEmail(email);
    event.auth.setVerified(false);
    try {
      event.app.save(event.auth);
    } catch {
      throw new BadRequestError("The email address is not available.");
    }

    return event.json(200, { email, verified: false });
  },
  $apis.requireAuth("users"),
);

routerAdd(
  "POST",
  "/api/rotta12/progress/reset",
  (event) => {
    const data = new DynamicModel({
      scope: "",
      id: "",
    });
    event.bindBody(data);

    const scope = String(data.scope || "");
    const id = String(data.id || "");
    const user = event.auth.id;
    const targets = [];

    if (scope === "question") {
      const question = Number(id);
      if (!Number.isInteger(question) || question < 1 || question > 1472) {
        throw new BadRequestError("Invalid question.");
      }
      targets.push({
        collection: "study_progress",
        filter: "user = {:user} && question = {:id}",
        params: { user, id: question },
      });
    } else if (scope === "questions") {
      targets.push({
        collection: "study_progress",
        filter: "user = {:user}",
        params: { user },
      });
    } else if (scope === "exercise") {
      const exercise = Number(id);
      if (!Number.isInteger(exercise) || exercise < 1 || exercise > 50) {
        throw new BadRequestError("Invalid exercise.");
      }
      targets.push({
        collection: "study_exercises",
        filter: "user = {:user} && exercise = {:id}",
        params: { user, id: exercise },
      });
    } else if (scope === "exercises") {
      targets.push({
        collection: "study_exercises",
        filter: "user = {:user}",
        params: { user },
      });
    } else if (scope === "attempt") {
      if (!/^[a-zA-Z0-9._-]{8,80}$/.test(id)) {
        throw new BadRequestError("Invalid attempt.");
      }
      targets.push({
        collection: "quiz_attempts",
        filter: "user = {:user} && clientId = {:id}",
        params: { user, id },
      });
    } else if (scope === "history") {
      targets.push({
        collection: "quiz_attempts",
        filter: "user = {:user}",
        params: { user },
      });
    } else if (scope === "all") {
      targets.push(
        {
          collection: "study_progress",
          filter: "user = {:user}",
          params: { user },
        },
        {
          collection: "study_exercises",
          filter: "user = {:user}",
          params: { user },
        },
        {
          collection: "quiz_attempts",
          filter: "user = {:user}",
          params: { user },
        },
      );
    } else {
      throw new BadRequestError("Invalid reset scope.");
    }

    let deleted = 0;
    for (const target of targets) {
      const records = event.app.findRecordsByFilter(
        target.collection,
        target.filter,
        "",
        0,
        0,
        target.params,
      );
      for (const record of records) {
        event.app.delete(record);
        deleted += 1;
      }
    }

    return event.json(200, { deleted });
  },
  $apis.requireAuth("users"),
);
