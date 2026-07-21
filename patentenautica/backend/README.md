# Backend account Rotta 12

Backend PocketBase dedicato agli account e alla sincronizzazione dei progressi. La versione è fissata a **0.39.8** e il frontend usa l'SDK JavaScript **0.27.0**.

## Funzioni

- registrazione pubblica con nome utente oppure email;
- accesso con nome utente o email;
- email opzionale e non pubblica;
- aggiunta o cambio dell'email con sessione valida e password attuale;
- cambio password con conferma della password attuale;
- recupero password solo quando è presente un'email verificata;
- cancellazione autonoma dell'account e cancellazione a cascata dei progressi;
- un record privato per ogni quesito già affrontato;
- regole API che consentono a ogni utente di leggere e modificare soltanto i propri dati.

Le password non entrano mai nel repository né nel database in chiaro: vengono gestite dal modulo auth di PocketBase. Il client richiede almeno 8 caratteri; non imponiamo composizioni arbitrarie con maiuscole o simboli.

## Avvio locale

Scaricare il binario PocketBase 0.39.8 nella cartella ignorata `.runtime/`, quindi:

```powershell
.\.runtime\pocketbase.exe migrate up
.\.runtime\pocketbase.exe serve --http=127.0.0.1:8090 --origins=http://127.0.0.1:5173,http://localhost:5173
```

Le migrazioni in `pb_migrations/` creano `users` e `study_progress`. `pb_data/` contiene database, chiavi e impostazioni e non deve essere versionato.

## Produzione Engenharia NATA

- VM Proxmox: `engnata-backend`, VMID `205`, IP `192.168.1.13`;
- servizio: `/opt/engnata-accounts`, container `rotta12-accounts`;
- API pubblica: `https://accounts.engnata.eu` via Cloudflare Tunnel;
- il pannello `/_/` è bloccato dal tunnel e la porta 8090 accetta soltanto il connettore Cloudflare (`192.168.1.10`) e la VM stessa;
- rate limiting, log, URL pubblica e backup interni sono configurati dalle migrazioni;
- backup VM Proxmox: ogni giorno alle 04:30 su `wd5tb2`, con 7 giornalieri e 4 settimanali.

Deploy manuale dalla VM:

```bash
cd /opt/engnata-accounts
docker compose up -d --build
sudo systemctl restart engnata-backend-firewall.service
docker compose ps
```

Le credenziali iniziali del superuser sono salvate soltanto in `/root/engnata-accounts-admin.txt` con permessi `0600`; recuperarle via SSH con `sudo` e spostarle subito in un password manager. Non copiarle in Git o nei log.

SMTP non è necessario per creare l'account, aggiungere/cambiare email, cambiare password o eliminare l'account. È invece necessario per verifica email e recupero password. Le relative credenziali devono restare soltanto sul server.

PocketBase è adatto a questo servizio educativo a basso rischio operativo, ma è ancora pre-1.0. Prima di ogni upgrade bisogna leggere il changelog, provare la migrazione su una copia di `pb_data/` e conservare un backup ripristinabile.
