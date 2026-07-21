migrate(
  (app) => {
    // PocketBase 0.39 initializes this auth collection on first boot.
    const users = app.findCollectionByNameOrId("users");
    users.listRule = '@request.auth.id != "" && id = @request.auth.id';
    users.viewRule = '@request.auth.id != "" && id = @request.auth.id';
    users.createRule = "";
    users.updateRule =
      '@request.auth.id != "" && id = @request.auth.id && @request.body.username:changed = false';
    users.deleteRule = '@request.auth.id != "" && id = @request.auth.id';
    users.fields.add(
      new TextField({
        name: "username",
        required: true,
        min: 3,
        max: 40,
        pattern: "^[a-z0-9][a-z0-9._-]{2,39}$",
      }),
    );
    users.fields.add(
      new TextField({
        name: "displayName",
        required: false,
        max: 80,
      }),
    );
    users.fields.getByName("email").required = false;
    users.passwordAuth = {
      enabled: true,
      identityFields: ["username", "email"],
    };
    users.addIndex("idx_users_username", true, "username", "");
    app.save(users);

    const progress = new Collection({
      type: "base",
      name: "study_progress",
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule:
        '@request.auth.id != "" && user = @request.auth.id && question >= 1 && question <= 1472',
      updateRule:
        '@request.auth.id != "" && user = @request.auth.id && @request.body.user:changed = false && @request.body.question:changed = false',
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
          name: "question",
          required: true,
          min: 1,
          max: 1472,
          onlyInt: true,
        },
        {
          type: "number",
          name: "attempts",
          required: true,
          min: 1,
          onlyInt: true,
        },
        {
          type: "number",
          name: "correct",
          required: false,
          min: 0,
          onlyInt: true,
        },
        {
          type: "number",
          name: "wrong",
          required: false,
          min: 0,
          onlyInt: true,
        },
        {
          type: "bool",
          name: "lastCorrect",
          required: false,
        },
        {
          type: "date",
          name: "lastAnswered",
          required: true,
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_progress_user_question ON study_progress (user, question)",
        "CREATE INDEX idx_progress_user_answered ON study_progress (user, lastAnswered)",
      ],
    });
    app.save(progress);
  },
  (app) => {
    const progress = app.findCollectionByNameOrId("study_progress");
    app.delete(progress);
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("username");
    users.fields.removeByName("displayName");
    users.fields.getByName("email").required = true;
    users.passwordAuth = { enabled: true, identityFields: ["email"] };
    users.removeIndex("idx_users_username");
    app.save(users);
  },
);
