const frontendUrl = "https://engnata.eu/patentenautica/";

function actionUrl(parameter, token) {
  return `${frontendUrl}?${parameter}=${encodeURIComponent(token)}#quiz`;
}

function bilingualMessage(
  titleIt,
  titlePt,
  textIt,
  textPt,
  link,
  buttonIt,
  buttonPt,
) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#15303a">
      <h1 style="color:#0b3440">Rotta 12</h1>
      <h2>${titleIt}</h2>
      <p>${textIt}</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 18px;border-radius:7px;background:#0b7180;color:white;text-decoration:none">${buttonIt}</a></p>
      <hr style="border:0;border-top:1px solid #d9e3e5;margin:28px 0">
      <h2>${titlePt}</h2>
      <p>${textPt}</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 18px;border-radius:7px;background:#0b7180;color:white;text-decoration:none">${buttonPt}</a></p>
      <small>Se non hai richiesto questa operazione, ignora il messaggio. · Se você não solicitou esta operação, ignore a mensagem.</small>
    </div>`;
}

onRecordCreateRequest((event) => {
  event.record.set(
    "username",
    String(event.record.get("username") || "")
      .trim()
      .toLowerCase(),
  );
  event.record.set("emailVisibility", false);
  event.next();
}, "users");

onRecordUpdateRequest((event) => {
  const username = String(event.record.get("username") || "")
    .trim()
    .toLowerCase();
  if (username) event.record.set("username", username);
  event.record.set("emailVisibility", false);
  event.next();
}, "users");

onMailerRecordPasswordResetSend((event) => {
  const link = actionUrl("passwordResetToken", event.meta.token);
  event.message.subject = "Rotta 12 · Reimposta la password / Redefina a senha";
  event.message.html = bilingualMessage(
    "Reimposta la password",
    "Redefina sua senha",
    "Apri Rotta 12 per scegliere una nuova password.",
    "Abra o Rotta 12 para escolher uma nova senha.",
    link,
    "Scegli nuova password",
    "Escolher nova senha",
  );
  event.next();
});

onMailerRecordVerificationSend((event) => {
  const link = actionUrl("verificationToken", event.meta.token);
  event.message.subject = "Rotta 12 · Verifica email / Confirme o e-mail";
  event.message.html = bilingualMessage(
    "Verifica il tuo indirizzo email",
    "Confirme seu endereço de e-mail",
    "Conferma l'indirizzo per attivare il recupero sicuro della password.",
    "Confirme o endereço para ativar a recuperação segura da senha.",
    link,
    "Verifica email",
    "Confirmar e-mail",
  );
  event.next();
});

onMailerRecordEmailChangeSend((event) => {
  const link = actionUrl("emailChangeToken", event.meta.token);
  event.message.subject = "Rotta 12 · Conferma email / Confirme o e-mail";
  event.message.html = bilingualMessage(
    "Conferma il nuovo indirizzo",
    "Confirme o novo endereço",
    "Apri Rotta 12 e conferma il cambio inserendo la password dell'account.",
    "Abra o Rotta 12 e confirme a alteração com a senha da conta.",
    link,
    "Conferma indirizzo",
    "Confirmar endereço",
  );
  event.next();
});
