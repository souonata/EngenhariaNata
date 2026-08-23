# Pintor

Pintor is a standalone, review-first wiring-diagram colourizer. It reads a source PDF, identifies
real conductor geometry, assigns colours from nearby wire-code legends, and adds a removable PDF
overlay without modifying the source drawing.

It is deliberately independent from the Volvo Penta Assistant. The current corpus and colour
convention originated in Volvo wiring diagrams, but Pintor does not import the Assistant, use its
database, or write into its application directories.

## Web beta capability

The Engenharia NATA beta has two page-analysis modes:

- accepted: born-digital vector pages with extractable legends, plus image-only/rasterized pages
  whose printed colour codes are legible to the bundled OCR engine;
- conventions: IEC two-letter and Volvo classic, with explicit confirmation when auto-detection is
  uncertain;
- scope: any number of pages per job, using page numbers and ascending ranges such as
  `40, 42, 44-46`; the released PDF still contains the complete manual and every unselected page
  remains unchanged;
- discovery: leaving the page field empty sweeps the whole document and paints every page that
  carries readable wire colour codes, wherever those pages sit. One strong positioned code is enough
  when a sufficiently long vector stroke runs beside it, so a two-wire sensor or relay is not lost
  merely because it is not a full-page schematic. Lower-case word collisions, bare one-letter
  component marks, connector pin tables, cable-colour reference sheets and colour-key rows are
  rejected. A diagnostic or instructional prose page with only an incidental mini-circuit is not a
  wiring-diagram page. Wiring whose conductor paths are already chromatic is also ignored; isolated
  coloured logos, warnings and short component marks do not hide an otherwise black-and-white
  schematic. A near-full-page image on a large sheet inside a document independently known to be
  about wiring remains an OCR candidate;
- connector schedules: when a pictorial installation page shows colour codes beside connector pins
  but does not draw the conductors, those codes never enter wire ownership. Pintor instead places a
  clearance-bounded disc inside the corresponding pin; a two-colour code uses two equal semicircles.
  The connector housing, component outline, and implied-but-absent wire stay black;
- outlined pictorial cables: when the real conductors are hollow raster tubes and separate thin
  vector leaders point from exact colour codes to those tubes, Pintor follows the closed cable
  interior instead of the leader. At least two independent one-to-one callouts must resolve on the
  page; otherwise this special path abstains. Two-colour cables use equal longitudinal bands while
  the original black tube borders, callout lines, text and instrument drawing stay untouched;
- engineering semantics: every vector, raster, batch, web and diagnostic path passes through the
  same role-first gate before rendering. It classifies the page grammar, distinguishes physical
  conductors and connector pins from leaders, terminals, junctions, component boundaries and
  unresolved geometry, then requires an exact printed colour source for every approved object.
  Electrical connectivity may reject an impossible association but never supplies a missing colour.
  The result and the administrator report show the grammar, approved roles, excluded annotations and
  evidence count;
- queue: one file is painted at a time. Extra files, from the same owner or from other testers, wait
  in arrival order and report their position. Uploads survive a page close and a service restart;
- declined: password-protected files, unknown notation, illegible/unsupported colour codes,
  uncertain conductor ownership, documents with no readable colour codes at all, or any result that
  fails a preservation gate;
- limits: 200 MB per file, 20 simultaneously active jobs and 2 GB of live storage per account in the
  production Compose profile. There is no cap on document length or on how many pages one job may
  paint; the page ceiling of 100,000 exists only so a mistyped range cannot exhaust memory before
  the PDF is read. A single page still has to fit the per-page analysis budget, and during a sweep a
  page that does not is skipped instead of sinking the job;
- storage: the service is not an archive. An upload is held for 24 hours so its owner can download
  the result, then erased from the server automatically. The single exception is a manual whose
  owner marked errors on it and agreed to share the report: that contribution is what the beta
  keeps, and deleting the job still withdraws it. Cleanup runs at startup, before new uploads and
  every five minutes while the API is idle. Queued and processing jobs are never removed; their
  24-hour download window begins when processing reaches a terminal state.

The static frontend lives in `index.html`, `pintor-script.js`, and `pintor-styles.css`. It is built
by the main Engenharia NATA Vite pipeline. The Python API is a separate service; GitHub Pages does
not execute it. The app remains outside the sitemap and catalog until its secret Easter egg is
unlocked.

External testers first enter the shared beta access code, then register a private account. A
username contains 1–64 visible characters and is unique after Unicode normalization and
case-folding. A password contains 4–128 characters; there are no digit, symbol, or case rules.
Passwords use a unique salt and `scrypt`, account session tokens are stored only by SHA-256 digest,
and jobs use stable per-account ownership without exposing account identifiers as authorization.

See `docs/ELECTRICAL_SAFETY_RULES.md` for the non-tunable electrical and drawing invariants.

## Working page by page

Manual length must not drive memory or disk, so nothing about a job is held whole:

- **the upload** is streamed to disk in 1 MB chunks and hashed on the way past. A 188 MB upload
  measured 13 MB of growth in the API process, not 188 MB;
- **the sweep** reopens the document every 50 pages. MuPDF keeps the parsed content, fonts and
  decoded images of every page it has touched in a per-document store, so one open document walked
  from page 1 to page 1,200 grows for the entire walk; closing it hands all of that back;
- **painting** attaches each overlay to the output PDF as soon as it is produced, verifies gate V7
  on that page immediately, and deletes the staged PNG. Overlays are never all on disk at once, and
  a preservation failure surfaces on the page that caused it rather than hours later;
- **previews** are rendered eagerly only for the first `PINTOR_EAGER_PREVIEWS` pages (12 by
  default); the rest are rendered the first time somebody opens them, and cached from then on;
- **supervision** watches progress rather than the clock. A job is killed when it stops moving
  (`PINTOR_JOB_STALL_SECONDS`, 15 min) or when it passes an absolute ceiling
  (`PINTOR_JOB_MAX_SECONDS`, 6 h) -- never merely for being long.

Measured on this pipeline with synthetic manuals, 50 wiring pages each:

| manual      | wiring pages | time    | peak RSS | peak workspace |
| ----------- | ------------ | ------- | -------- | -------------- |
| 400 pages   | 50 painted   | 144.5 s | 1,174 MB | 17.7 MB        |
| 1,200 pages | 50 painted   | 144.6 s | 1,176 MB | 27.2 MB        |

Tripling the manual left peak memory unchanged: what costs memory is painting one page, not the
length of the document around it. Both runs stayed well under the 2,560 MB worker ceiling.

## Exhaustive manual inventory

`pintor-inventory` scans every page of every PDF in a directory or private library manifest. It
never changes the PDFs. Each page records the exact code text, adjacent vector or raster-line
evidence, whether conductor strokes are already coloured, confidence, old-manifest membership and
source page number. Only black-and-white wiring candidates enter the CSV and HTML report. The run
appends one JSONL record after every page and resumes from that ledger after an interruption. It
also rebuilds a summary JSON, candidate CSV, thumbnail-backed HTML report and the count of newly
discovered pages.

The default `--ocr-mode missing` first takes the fast exact vector pass, then renders and OCRs every
undecided page that contains raster content or almost no extractable text. A one-per-cent page image
is enough to include a small inset. This avoids rereading text-only prose through OCR. Use
`--ocr-mode all` only when a deliberately redundant OCR pass over text-only pages is wanted. Use
`--ocr-mode off` for an immediate vector census and resume the same output directory later with the
default mode for the exhaustive raster pass.

```powershell
pintor-inventory --library-manifest C:\private-library\manifest.json `
  --out workspaces\wiring_inventory --ocr-mode off

pintor-inventory --library-manifest C:\private-library\manifest.json `
  --out workspaces\wiring_inventory
```

For an ordinary folder, replace `--library-manifest` with `--pdf-root C:\manuals`. Source paths and
reports belong in ignored private workspaces; no source manual or inventory result is committed.

## Accounts and the administration console

Each account owns its jobs. From **My drawings** an owner sees everything they uploaded — queued,
being painted, and finished — reopens or downloads a result, deletes a single drawing, and closes
the account entirely. Every card states what happens next: a countdown to the moment the upload
leaves the server, or, for a manual shared with marked errors, that it is being kept. Closing an
account asks for the password again and erases the credentials, the sessions, every stored job, and
any feedback copy still waiting for adjudication.

The administrator account, bootstrapped only from a username plus a scrypt hash in the environment,
has a three-tab console:

- **Reports** — only drawings whose owners explicitly marked errors and chose to share them enter
  this expert queue; ordinary private uploads are never listed. Compare the original and painted
  previews, zoom with the buttons or wheel, drag to pan while the point/segment marks remain
  aligned, then accept, reject, or ask for clarification.
- **Accounts** — every registered tester with role, status, job count, and report counts. An
  administrator can suspend and reactivate an account (which drops its live sessions without
  deleting anything), promote or demote it, or delete it together with all of its data. The console
  refuses to act on the signed-in administrator's own account and refuses to leave the beta without
  an active administrator; the configured administrator is also reactivated on boot, so suspension
  can never lock everyone out.
- **Rounds** — an improvement round is a curated batch of expert-accepted reports. One round is open
  at a time and every acceptance with learning consent joins it automatically; reversing the
  decision takes the report back out. Closing the round freezes the list and writes
  `improvement_rounds/<id>-manifest.json` for offline curation. Closing a round still trains nothing
  and promotes nothing: the web service never touches a model.

Page selection accepts each of these forms:

- one page: `1`, `12`, or `92`;
- comma-separated pages: `1, 5, 9, 95`;
- an inclusive ascending interval: `1-5`, `2-7`, or `12-50`;
- any mix of them: `1, 3-5, 9-11, 15`.

## Design

The shipping decision paths combine:

- exact vector topology when available, otherwise a 200-DPI OCR/skeleton page analysis;
- electrical and drawing constraints;
- a calibrated lightweight classifier over atomic conductor pieces;
- explicit abstention whenever the evidence is not strong enough;
- grouped cross-validation and Bayesian/genetic-style parameter search only for policy parameters.

Precision is preferred over recall: an uncertain wire stays black for human review.

## Layout

- `src/wirecolor/` — the standalone Python package and command-line tools.
- `tests/` — unit and regression tests.
- `docs/` — architecture decisions and prior-art research.
- `legacy/` — frozen prototype and optional historical integration helpers.
- `library/` — private source-manual copies selected by wiring evidence; local and ignored.
- `workspaces/` — generated PDFs, review pages, metrics, and trained models; local and ignored.
- `markups/` — manual annotations used as learning/evaluation evidence; local and ignored.
- `assets/` — private reference material; local and ignored.

## Install

From this directory:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[learning,ocr]"
```

For vector-only CLI work, OCR is usually unnecessary. The production web image always includes the
OCR runtime because raster pages are part of its supported input boundary.

Install the private-job web boundary locally with:

```powershell
python -m pip install -e ".[web]"
$env:PINTOR_COOKIE_SECURE = "0"
pintor-web
```

The local API listens on `http://127.0.0.1:8765` by default. Vite automatically selects that URL
when the frontend runs on localhost.

## Web API and privacy

The minimal beta API is:

- public `GET /api/health` plus beta-code `POST /api/access`;
- beta-protected registration/login/logout and `GET /api/account`;
- `GET /api/account/jobs` for the signed-in user's retained jobs;
- protected `GET /api/capabilities`;
- `POST /api/jobs`, then `GET /api/jobs/{id}`;
- authenticated original/painted previews and result download;
- `POST /api/jobs/{id}/feedback` for typed point/segment annotations;
- `DELETE /api/jobs/{id}` for immediate job and pending-consent-copy deletion.
- administrator-only feedback list/detail/preview/document/decision routes under `/api/admin/`.

Production also requires a SHA-256 beta-code digest and a separate HMAC secret. Successful access
sets a 30-day `HttpOnly`, `Secure`, `SameSite=Strict` cookie; the plaintext code is never shipped in
the frontend or container environment. Access attempts, all requests, and job creation have
independent sliding-window limits. Every job belongs to an authenticated account and an opaque,
secure session cookie. Random job IDs are not authorization. The source, previews, output, and
feedback stay outside the public web root and are removed after the retention window. Learning
consent is separate and optional. Submitted feedback is always `trainable: false` until expert
adjudication; the API has no training or model-promotion endpoint.

The administrator is bootstrapped only from `PINTOR_ADMIN_USERNAME` and
`PINTOR_ADMIN_PASSWORD_HASH`. Generate a hash interactively with `pintor-hash-password`; never put
the plaintext password in Compose, HTML, JavaScript, shell history, or Git. On the deployment host,
`deploy/bootstrap-secrets.sh` prompts through the terminal and writes only the encoded hash to the
root-owned mode-0600 `.env`. The admin console compares original/result previews with user point or
segment annotations. Its shared transform lets the reviewer zoom and pan without losing annotation
alignment, then record `accepted`, `rejected`, or `needs-clarification`. Even accepted feedback
remains `trainable: false`; it only becomes eligible for a separately controlled offline dataset
when the user also consented to learning.

The worker runs in a killable child process with time, CPU, and memory ceilings, with one processing
slot per 3 GB container by default. The provided container runs as a non-root user with a read-only
root filesystem. `deploy/apply-firewall.sh` limits inbound traffic to the Cloudflare connector and
blocks container egress. The web path caps 200-DPI analysis at 75 million pixels (enough for A0) and
the removable overlay at 60 million pixels; browser clients cannot override those budgets:

```powershell
docker compose -f compose.yml up --build
```

TLS terminates at the Cloudflare tunnel for `https://pintor-api.engnata.eu`; the VM port is bound to
its LAN address but the `DOCKER-USER` firewall accepts only the tunnel connector. The Python base
image is digest-pinned and the production dependency graph is frozen in `requirements-web.lock`. Run
`deploy/smoke-production.sh` as root after deployment to verify external authentication, CORS, real
PDF processing, release, download, and deletion. A mounted policy or classifier is used only when
the operator explicitly sets `PINTOR_POLICY_PATH` or `PINTOR_CLASSIFIER_PATH`; otherwise the
conservative deterministic baseline runs.

The connector host also runs `deploy/pintor-tunnel-watchdog.timer`. Every minute it checks the
uncached public health endpoint. Three consecutive failures restart only the `cloudflared`
container; a single transient edge failure does not flap the tunnel. Install the tracked script and
units on the connector, verify them with `systemd-analyze verify`, then enable the timer:

```sh
install -m 0755 deploy/cloudflared-watchdog.sh /usr/local/sbin/pintor-cloudflared-watchdog.sh
install -m 0644 deploy/pintor-tunnel-watchdog.service /etc/systemd/system/
install -m 0644 deploy/pintor-tunnel-watchdog.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pintor-tunnel-watchdog.timer
```

## Paint one page

```powershell
pintor --pdf C:\path\drawing.pdf --page 0 --out-dir workspaces\manual_run
```

Use the validated generation-3 classifier and policy when the local model files are present:

```powershell
pintor --pdf C:\path\drawing.pdf --page 0 --out-dir workspaces\manual_run `
  --decision-policy workspaces\wirecolor_qa\models\decision_policy_cv_v3.json `
  --run-classifier workspaces\wirecolor_qa\models\run_classifier_cv_v3.json
```

This CLI entry point is the exact-vector route and declines raster-only pages. The web service
automatically selects the raster/OCR route; `--force` remains a vector diagnostic override and is
never accepted from the API.

## Review and mark errors

Generate/open the review dashboard for an existing evaluation workspace:

```powershell
pintor-review --root workspaces\wirecolor_qa
```

The dashboard supports the error classes used by the learning loop: `non-wire`, `bleed`,
`wrong-colour`, `stops-mid`, `missing`, `dash-style`, and `stripe-style`. Renderer/topology errors
are routed separately from wire-versus-furniture evidence. Exported evidence does not directly teach
a page-specific correction. The training tools derive general parameters from multiple publications
and keep a publication-grouped lockbox.

## Tests

```powershell
python -m unittest discover -s tests -p "test_wirecolor*.py"
```

From `../local`, validate the standalone web surface with:

```powershell
npm run validate:pintor
npm run build
```

Verify every private source-manual copy against its manifest:

```powershell
python -m wirecolor.tools.verify_library --manifest library\manifest.json
```

See `HANDOFF.md` for the latest measured model state and the exact continuation point.
