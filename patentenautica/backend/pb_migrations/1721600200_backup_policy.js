migrate(
  (app) => {
    const settings = app.settings();
    settings.backups.cron = "30 1 * * *";
    settings.backups.cronMaxKeep = 7;
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.backups.cron = "";
    settings.backups.cronMaxKeep = 3;
    app.save(settings);
  },
);
