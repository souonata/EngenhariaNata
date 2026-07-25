migrate(
  (app) => {
    const accountsWithoutEmail = app.findRecordsByFilter(
      "users",
      'email = ""',
      "",
      1,
      0,
    );
    if (accountsWithoutEmail.length) {
      throw new Error(
        "Email-only login migration blocked: assign an email to every existing account first.",
      );
    }

    const users = app.findCollectionByNameOrId("users");
    users.fields.getByName("email").required = true;
    users.fields.getByName("password").min = 1;
    users.fields.getByName("password").max = 0;
    users.fields.getByName("password").pattern = "";
    // PocketBase ignores hidden fields in public record creation. Keep this
    // internal random identifier writable, but remove it from auth identities.
    users.fields.getByName("username").hidden = false;
    users.passwordAuth = {
      enabled: true,
      identityFields: ["email"],
    };
    app.save(users);

    const exerciseProgress = new Collection({
      type: "base",
      name: "study_exercises",
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule:
        '@request.auth.id != "" && user = @request.auth.id && exercise >= 1 && exercise <= 50',
      updateRule:
        '@request.auth.id != "" && user = @request.auth.id && @request.body.user:changed = false && @request.body.exercise:changed = false',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
      fields: [
        {
          type: "relation",
          name: "user",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: true,
        },
        {
          type: "number",
          name: "exercise",
          required: true,
          min: 1,
          max: 50,
          onlyInt: true,
        },
        {
          type: "number",
          name: "views",
          required: true,
          min: 1,
          onlyInt: true,
        },
        {
          type: "number",
          name: "solutionViews",
          required: false,
          min: 0,
          onlyInt: true,
        },
        {
          type: "bool",
          name: "completed",
          required: false,
        },
        {
          type: "date",
          name: "lastViewed",
          required: true,
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_exercises_user_exercise ON study_exercises (user, exercise)",
        "CREATE INDEX idx_exercises_user_viewed ON study_exercises (user, lastViewed)",
      ],
    });
    app.save(exerciseProgress);

    const quizAttempts = new Collection({
      type: "base",
      name: "quiz_attempts",
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule:
        '@request.auth.id != "" && user = @request.auth.id && total >= 1 && total <= 1472 && correct >= 0 && correct <= total',
      updateRule: null,
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
      fields: [
        {
          type: "relation",
          name: "user",
          required: true,
          maxSelect: 1,
          collectionId: users.id,
          cascadeDelete: true,
        },
        {
          type: "text",
          name: "clientId",
          required: true,
          min: 8,
          max: 80,
          pattern: "^[a-zA-Z0-9._-]+$",
        },
        {
          type: "select",
          name: "mode",
          required: true,
          maxSelect: 1,
          values: ["official", "training"],
        },
        {
          type: "number",
          name: "total",
          required: true,
          min: 1,
          max: 1472,
          onlyInt: true,
        },
        {
          type: "number",
          name: "correct",
          required: true,
          min: 0,
          max: 1472,
          onlyInt: true,
        },
        {
          type: "bool",
          name: "passed",
          required: true,
        },
        {
          type: "json",
          name: "questionIds",
          required: true,
          maxSize: 65536,
        },
        {
          type: "date",
          name: "completedAt",
          required: true,
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_attempts_user_client ON quiz_attempts (user, clientId)",
        "CREATE INDEX idx_attempts_user_completed ON quiz_attempts (user, completedAt)",
      ],
    });
    app.save(quizAttempts);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("quiz_attempts"));
    app.delete(app.findCollectionByNameOrId("study_exercises"));

    const users = app.findCollectionByNameOrId("users");
    users.fields.getByName("email").required = false;
    users.fields.getByName("password").min = 8;
    users.fields.getByName("username").hidden = false;
    users.passwordAuth = {
      enabled: true,
      identityFields: ["username", "email"],
    };
    app.save(users);
  },
);
