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
- scope: one selected page per job; all other PDF pages remain unchanged;
- declined: password-protected files, unknown notation, illegible/unsupported colour codes,
  uncertain conductor ownership, or any result that fails a preservation gate;
- limits: 25 MB, 50 pages, 24-hour retention by default.

The static frontend lives in `index.html`, `pintor-script.js`, and `pintor-styles.css`. It is built
by the main Engenharia NATA Vite pipeline. The Python API is a separate service; GitHub Pages does
not execute it. The app remains outside the sitemap and catalog until its secret Easter egg is
unlocked.

See `docs/ELECTRICAL_SAFETY_RULES.md` for the non-tunable electrical and drawing invariants.

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
- protected `GET /api/capabilities`;
- `POST /api/jobs`, then `GET /api/jobs/{id}`;
- authenticated original/painted previews and result download;
- `POST /api/jobs/{id}/feedback` for typed point/segment annotations;
- `DELETE /api/jobs/{id}` for immediate job and pending-consent-copy deletion.

Production also requires a SHA-256 beta-code digest and a separate HMAC secret. Successful access
sets a 30-day `HttpOnly`, `Secure`, `SameSite=Strict` cookie; the plaintext code is never shipped in
the frontend or container environment. Access attempts, all requests, and job creation have
independent sliding-window limits. Every job belongs to an opaque, secure session cookie. Random job
IDs are not authorization. The source, previews, output, and feedback stay outside the public web
root and are removed after the retention window. Learning consent is separate and optional.
Submitted feedback is always `trainable: false` until expert adjudication; the API has no training
or model-promotion endpoint.

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
