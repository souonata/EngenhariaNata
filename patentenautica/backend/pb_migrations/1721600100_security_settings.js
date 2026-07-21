migrate(
  (app) => {
    const settings = app.settings();
    settings.meta.appName = "Rotta 12 · Engenharia NATA";
    settings.meta.appURL = "https://accounts.engnata.eu";
    settings.meta.senderName = "Rotta 12";
    settings.meta.senderAddress = "noreply@engnata.eu";
    settings.meta.hideControls = true;
    settings.rateLimits.enabled = true;
    settings.rateLimits.rules = [
      {
        label: "*:auth",
        audience: "",
        duration: 60,
        maxRequests: 10,
      },
      {
        label: "users:create",
        audience: "@guest",
        duration: 60,
        maxRequests: 5,
      },
      {
        label: "*:create",
        audience: "",
        duration: 60,
        maxRequests: 40,
      },
      {
        label: "/api/",
        audience: "",
        duration: 60,
        maxRequests: 300,
      },
    ];
    settings.trustedProxy.headers = ["CF-Connecting-IP"];
    settings.trustedProxy.useLeftmostIP = false;
    settings.logs.maxDays = 30;
    settings.logs.logIP = true;
    settings.logs.logAuthId = true;
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.rateLimits.enabled = false;
    settings.trustedProxy.headers = [];
    settings.logs.maxDays = 7;
    settings.logs.logAuthId = false;
    app.save(settings);
  },
);
