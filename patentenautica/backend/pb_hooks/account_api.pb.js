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
