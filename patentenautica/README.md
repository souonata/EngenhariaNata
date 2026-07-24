# Rotta 12 — Patente Nautica

Banco di studio offline e bilingue per la patente nautica italiana **entro 12 miglia, a motore**, integrato nel portfolio Engenharia NATA all'indirizzo `/patentenautica/`.

## Esperienza di studio

- Modalità persistenti **IT originale**, **PT traduzione** e **IT + PT** senza ricaricare la pagina.
- 1.472 quesiti BASE del DD 131/2022 e 103 figure ufficiali.
- Banca completa senza paginazione artificiale, filtrabile per testo IT/PT, materia, argomento e stato di studio.
- Quiz casuali dai risultati filtrati, allenamenti sui quesiti selezionati e simulazioni composte soltanto da quesiti non ancora visti.
- Account facoltativo con nome utente o e-mail e sincronizzazione dei tentativi, dell'ultimo esito e della precisione tra dispositivi; il profilo locale resta disponibile offline con esportazione/importazione JSON.
- Per ogni quesito: risposta ministeriale, spiegazione originale, pagina esatta nel PDF MIT e riscontri in norme o fonti tecniche istituzionali.
- Simulazione di 20 quesiti, 30 minuti e superamento con almeno 16 risposte esatte.
- Carta nautica didattica 5/D ad alta risoluzione, con zoom centrato sul cursore tramite rotellina, pizzico a due dita, trascinamento con mouse o un dito, comandi da tastiera e rotta evidenziata. Partenza e arrivo hanno un bersaglio preciso con croce magenta da 1 px e anello giallo.
- Nei 50 esercizi, ogni risposta compare accanto al quesito corrispondente; distanza, orario, velocità, carburante e coordinate hanno unità uniformi e gli intervalli ammessi sono segnalati esplicitamente.
- Tutti i 50 esercizi di carteggio collegano partenza e arrivo a 28 punti georeferenziati, mostrando le coordinate prima della soluzione.
- Ricerca unica in italiano e portoghese, anche quando è visibile una sola lingua.
- Glossario nautico IT → PT-BR sempre accessibile.
- Tema chiaro/scuro e modalità linguistica salvati nel browser.

Senza accesso, i dati restano nel `localStorage` del browser. Con un account, il progresso viene sincronizzato sul backend Engenharia NATA autogestito; ogni utente può leggere e modificare esclusivamente il proprio storico. Dalla pagina account è possibile aggiungere o cambiare l'e-mail confermando la password corrente, cambiare password ed eliminare definitivamente account e progresso. L'italiano ufficiale e il funzionamento offline non dipendono dal backend.

La traduzione è un supporto didattico. Il testo ministeriale italiano rimane canonico e prevale sempre durante l'esame. La struttura portoghese non contiene `correct`, `code` o `figure`, quindi non può modificare silenziosamente il gabarito ufficiale.

## Avvio locale

Il progetto usa moduli ESM e deve essere aperto via HTTP:

```bash
cd ../local
npm run dev
```

Aprire quindi `http://localhost:5173/patentenautica/`.

Il backend account è documentato in `backend/README.md`. In produzione l'API è disponibile su `https://accounts.engnata.eu`; in locale il client usa `http://127.0.0.1:8090` oppure `VITE_PATENTE_API_URL`.

## Dati e fonti

- `data/quiz-base.js`: italiano ministeriale canonico.
- `data/quiz-pt.json`: testo portoghese parallelo, indicizzato per lo stesso `id`.
- `data/content.js` / `data/content-pt.json`: metadati delle materie e programma IT/PT.
- `data/carteggio.js` / `data/carteggio-pt.json`: esercizi e soluzioni IT/PT.
- `data/chart-points.json`: calibrazione della carta 5/D, 28 punti e itinerari dei 50 esercizi.
- `data/question-authority.json`: indice statico dei 1.472 quesiti → pagina MIT, regola esplicativa e fonti pertinenti; non contiene il gabarito.
- `data/authoritative-sources.json`: catalogo verificabile di atti e fonti istituzionali, con URL ufficiali, hash e dimensioni delle copie locali.
- `data/glossary.json`: terminologia nautica italiana e portoghese brasiliana.
- `carta nautica 5D.gif`: scansione sorgente 4454 × 3045 conservata senza modifiche.
- `carta nautica 5D allineata.webp`: copia lossless 4612 × 3281 ruotata di 3,0738° per rendere paralleli e meridiani orizzontali/verticali; è l'asset mostrato dal visualizzatore.
- `sources/`: DM 323/2021, DD 131/2022, DD 10/2022 e atti della Gazzetta Ufficiale usati come riferimenti locali.

La pagina **Fonti** usa soltanto la banca ministeriale, atti pubblici e siti istituzionali. Le spiegazioni sono testi originali di Rotta 12; manuali e piattaforme didattiche private non vengono riprodotti.

## Rigenerazione e qualità

`scripts/build_data.py` ricostruisce banca italiana, carteggio e figure dai PDF ufficiali. Richiede Python, `pdfplumber`, Poppler e Tesseract.

`scripts/build_translations.py` ricostruisce i JSON portoghesi usando il cache statico versionato. Se compaiono testi nuovi, usa durante il build il modello locale `Helsinki-NLP/opus-mt-tc-big-itc-itc` alla revisione fissata nello script; nessun modello o API è usato nel browser. Dipendenze in `scripts/requirements-translation.txt`.

`scripts/build_authoritative_references.py` localizza ciascun quesito nelle 338 pagine del PDF MIT, verifica hash e dimensioni degli atti locali e rigenera catalogo e indice ufficiale. Usa `pypdf`, fissato in `scripts/requirements-pdf.txt`.

`scripts/align_chart_image.ps1` rigenera con ImageMagick la carta WebP allineata a partire dal GIF sorgente. La calibrazione applica la stessa trasformazione geometrica ai 28 punti; il layout dei nomi scarta automaticamente qualsiasi posizione che intersechi la rotta.

```bash
python scripts/build_translations.py
python scripts/build_authoritative_references.py
node scripts/validate_integrity.mjs
```

Il generatore blocca perdita di numeri, negazioni non preservate, falsi amici proibiti e violazioni terminologiche contestuali. La validazione Node conferma 1.472 quesiti e riferimenti ufficiali, 50 esercizi localizzati sulla carta, 28 punti, 103 figure, dimensioni della Carta 5/D, hash delle copie locali, assenza dell'indice di risposta corretta nelle traduzioni e nei riferimenti, oltre al contratto statico tra client account e schema backend.

Nota d'integrità: nel quesito BASE n. 226 il PDF ufficiale riporta due alternative marcate come vere. La base canonica mantiene come corretta la definizione della trasmissione S-drive/Sail Drive e mostra una nota esplicativa.
