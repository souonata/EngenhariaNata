# Pintor handoff

Last updated: 2026-08-20

## Product boundary

Pintor has been extracted from the Volvo Penta Assistant into this directory. The package must
remain independently installable and runnable. The Volvo material is a corpus/convention, not a
runtime dependency.

The Engenharia NATA beta is a private-job web app supporting up to 50 selected vector or
rasterized pages per job inside manuals of up to 2,000 pages. Exact text/strokes are preferred;
image-only pages use the bundled OCR and conservative pixel-topology pipeline. A
supported/confirmed colour convention remains mandatory, and uncertain segments stay black.

The product name is localized in the interface: **Pintor** in Portuguese, **Pittore** in Italian,
**Målaren** in Swedish, and **Painter** in the native English fallback. Technical identifiers,
paths, package names, and the public route remain `pintor` and `/pintor/`.

## 2026-08-20 non-fatal resource errors (0.4.3, published)

- Corrected the shared JavaScript safety overlay so failed images, previews, iframes, blocked
  third-party analytics, and empty browser/extension error events do not claim that the page is
  frozen. HTTP `401` session probes and handled `409` duplicate-account responses may still appear
  in browser developer tools, as expected, but no longer produce the page-level fatal banner.
- Same-origin script/stylesheet failures, real runtime exceptions, unhandled promise rejections,
  and explicit fatal initialization reports still display the safety banner.
- Added four JSDOM regression tests and cache-busted the classic overlay script on the Pintor page.

## 2026-08-20 compact product header (0.4.2, published)

- Removed the decorative private-beta badge from the product header; beta access and account/API
  protections remain unchanged.
- Moved the three-wire mark immediately beside the localized product name and centred the subtitle
  beneath the combined lockup. The compact row scales down without stacking at mobile widths.
- Removed the now-unused trilingual badge keys and bumped the frontend asset version.

## 2026-08-20 localized product name (0.4.1, published)

- Localized every visible product-name reference in the Italian and Swedish UI, including the
  document title, access flow, review copy, unavailable-state messages, image alternative text,
  and footer.
- Localized the hidden Engenharia NATA catalogue label to **Pittore beta** and **Målaren beta**.
- Updated the unlocalized HTML fallback to **Painter** while preserving **Pintor** in Portuguese.
- No route, API hostname, package, class, or storage identifier was renamed.

## Current architecture

The current generation-3 path is graph + constraints + calibrated lightweight classifier +
abstention. Atomic conductor pieces are classified after topology extraction, with hard safety
constraints retaining final authority. Bayesian/evolutionary search is limited to tunable policy
parameters. Evaluation splits are grouped by publication.

Primary web entry points: `src/wirecolor/tools/paint_vector.py` and
`src/wirecolor/tools/paint_raster.py`.

## 2026-08-20 external tester accounts and expert inbox (0.4.0, published)

- Added beta-code-gated registration and login. Usernames contain 1–64 visible characters and are
  unique under NFKC + case-folding. Passwords contain 4–128 characters with no composition rule;
  they are stored only as independently salted scrypt hashes.
- Added SQLite persistence in the existing private `/data` volume. Browser sessions are random
  256-bit tokens whose database representation is only a SHA-256 digest. Cookies remain
  `HttpOnly`, `Secure`, `SameSite=Strict`, and scoped to `/api`.
- Job ownership now derives from the authenticated account, so the same account can reach retained
  work from another device while other accounts receive the same not-found response as an unknown
  job. Production enables `PINTOR_ACCOUNTS_REQUIRED=1`; legacy anonymous mode exists only for local
  compatibility tests.
- Added an administrator-only review console and API. It lists beta reports, shows original and
  painted previews with normalized point/segment overlays, and records accepted, rejected, or
  needs-clarification decisions plus an expert note.
- A consented report archives its source, result, selected previews, sanitized job metadata, and
  typed feedback in the private training inbox. Non-consented reports exist only with the live job
  and expire/delete with it. Expert acceptance never trains or promotes a model: `trainable`
  remains false and only consented + accepted evidence becomes `eligible_for_dataset`.
- The administrator is created at API startup from an environment username and a precomputed
  scrypt hash. No administrator plaintext credential is present in source, Compose, documentation,
  frontend assets, API responses, or the SQLite database. `pintor-hash-password` and the root-only
  deployment bootstrap provide interactive secret entry.
- This account and expert-review boundary is active in the protected `0.4.0` API image. Publication
  evidence is recorded in the protected API section below.

## 2026-08-20 selected-page manuals (published in 0.4.0)

- Replaced the one-page web field with a bounded page-selection grammar. Users may enter comma
  lists and ascending ranges such as `40, 42, 44-46`; duplicates are removed while input order is
  retained. The legacy single `page` form field remains accepted for old clients.
- Raised only the document-length boundary from 50 to 2,000 pages. File size remains 25 MB, and a
  job may analyse at most 50 selected pages, so a long manual does not multiply worker load
  without bound.
- Selected pages run sequentially through the existing vector/raster, convention, V2, and
  abstention paths. No client-controlled worker, DPI, or pixel-budget settings were added.
- Added a memory-bounded overlay composer: the source is copied once, one `Wire colors` OCG is
  created, and every approved page overlay is appended in its own incremental revision so only one
  decoded overlay is resident at a time. The final document retains the exact source byte prefix
  and all original pages.
- Each selected page has its own status, metrics, original/result preview, convention evidence,
  and feedback page identity. The review interface has a page selector; server-side feedback
  validation rejects annotations for pages that were not selected.
- Local proof used an 80-page synthetic manual and selected human pages 40, 42, 44, and 46. The
  released PDF reopened with all 80 pages and one OCG; exactly those four pages gained an overlay,
  all 76 unselected pages retained their original resources, and V7 passed for every selected page.
  Poppler and PyMuPDF visual renders both preserved the source text/code while colouring only the
  conductor. This verifies the generic contract, not the named private Volvo manual itself.
- The page-notation contract explicitly covers one page (`12`), lists (`1, 5, 9, 95`), inclusive
  intervals (`12-50`), and mixed notation (`1, 3-5, 9-11, 15`). A 60-page preservation test attaches
  all 39 overlays selected by `12-50`, retains exactly one OCG, and runs V7 on every selected page.
- Simplified the customer-facing landing surface at the owner's request: removed the capability
  badge, the three safety-principle cards, and the explanatory beta boundary. The private-beta
  badge remains; the unused HTML, CSS, and PT/IT/SV translation keys were removed together.
- This page-selection and simplified-interface release is active in the protected `0.4.0` API and
  the public `0.4.1` frontend.

## 2026-08-20 raster/OCR web capability

- Added a production raster wrapper around the existing page-wide OCR, skeleton, component,
  conductor-ownership, removable-overlay, V2, and V7 modules.
- Auto-detection reads the page once against the union vocabulary, requires two strong OCR labels
  and a decisive convention margin, then filters all evidence back to the selected profile.
- Vector refusal falls back to OCR only for raster geometry or a page with no extractable legends;
  it never bypasses an ordinary vector ownership abstention.
- Splice colour propagation is disabled by default and explicitly disabled in the web wrapper:
  electrical continuity never proves physical conductor colour.
- Raster canvases have a categorical 60-million-pixel ceiling, including rounding, and all output
  remains an additive optional-content layer over byte-preserved source pages.
- Added raster safety tests for splice behaviour, component/housing V2 overlap, release quarantine,
  OCR convention confidence, and exact pixel-budget enforcement.
- A real image-only synthetic PDF (no extractable text and no vector drawing commands) completed
  OCR, topology, removable overlay, V2 and V7 in 2.1 seconds on the development workstation.
  The digest-pinned Linux image subsequently built on the production host and passed its bundled
  OCR self-check. Dense A1/A0 timeout/RSS measurement remains a production-capacity gate; the
  small synthetic timing must not be extrapolated to those sheets.
- The production image pins RapidOCR 3.9.2 and ONNX Runtime 1.29.0. All OCR transitives are frozen
  in `requirements-web.lock`; RapidOCR itself is installed with `--no-deps` so its `opencv-python`
  metadata cannot install a second OpenCV beside the existing headless runtime. `rapidocr check`
  now blocks the image build if the bundled models or ONNX backend cannot initialize.
- A corpus-free synthetic PDF test embeds one full-page raster with no PDF text or vector paths,
  injects deterministic OCR evidence, runs the real pixel topology/overlay path, and requires V2,
  V7, a removable OCG, and an unchanged source hash. A separate local real-OCR smoke recognized
  the same small 1200 x 800 fixture and completed end to end in 2.0 seconds. This is not a dense or
  large-sheet performance qualification.
- A 9362 x 6623 A0 raster exposed `std::bad_alloc` inside the RapidOCR detector. The original OCR
  process stored a full BGR page plus a page-wide binary image, passed a 4000 x 4000 preprocessing
  tile at 2x, and let ONNX size native pools from the host. The local reproduction was directly
  observed with 121 process threads; the production traceback had no thread telemetry, but the
  default ONNX pool is not bounded by the container's two-CPU cgroup quota.
- The bounded OCR path now retains the page in grayscale, creates threshold/RGB buffers per tile,
  caps every engine input at 1600 x 1600 (below the 2000-square Linux failure), maps upright and
  rotated overlap reads back to global
  coordinates, uses ONNX 2/1 intra/inter-op threads with its CPU arena disabled, and fixes OpenCV
  preprocessing to one thread. At the OCR/topology boundary it destroys the native OCR sessions,
  releases the page raster, collects Python objects, and asks glibc to trim free arenas before the
  full-page connected-component arrays are allocated.
- Pages above 60 million working pixels intentionally omit the 2x recovery pass. This is a
  fail-closed capacity policy: small legends may be missed, but a conductor without a trustworthy
  ownership seed remains black. The A0 schedule is 35 upright calls and at most 35 rotated calls.
- A real A0 native-scale prototype at the earlier 2000-pixel cap completed locally without
  `bad_alloc` in 122.3 seconds and 47 calls. It returned 86 labels, 80 at score >= 0.80, and
  selected `volvo_classic` with high
  confidence (score 248 versus 0 for the runner-up). Observed peaks were 1.15 GB working set and
  1.89 GB paged memory; 33 process threads were observed. A two-scale trial was stopped after
  278 seconds wall/552 CPU seconds, confirming that the conservative scale policy is necessary.
  The protected Linux host remains the authoritative full-pipeline capacity benchmark because the
  local smoke used a different OS and ONNX Runtime build.
- The protected Linux full-pipeline benchmark is now complete. A 4.7 MB, 44-page source with a
  9362 x 6623 image-only A0 wiring page finished through the public protected API in 279.3 seconds:
  35 upright plus 33 rotated OCR calls found 80 labels, selected `volvo_classic` at high confidence,
  analysed 3,107 candidate runs, painted 464, passed V2/V7/source preservation, and released a
  re-openable 44-page PDF. Visual review at full page and detailed crops found the overlay on wire
  geometry while labels, symbols, and uncertain conductors stayed black.
- The measured pre-fix Linux worker reached about 2.27 GB virtual space before a 248 MB OpenCV
  topology allocation failed despite only about 820 MB resident. With bounded allocator/thread
  settings, the successful run was observed around 1.45 GB virtual/826 MB resident during OCR and
  fell to about 1.06 GB virtual/533 MB resident after native release. The isolated worker ceiling is
  therefore 2.8 GB address space, 720 CPU seconds, and 900 wall seconds; the container retains its
  separate hard 3 GB resident-memory cap, two CPUs, one-job semaphore, no egress, and fail-closed
  release gates.

## Previous model measurement (not a current promotion)

Grouped out-of-fold evaluation:

- 315 cases, 20 sheets, 13 publications.
- weighted loss improved from 0.47861887 to 0.42844083.
- false paints improved from 136 to 112.
- wrong-colour cases improved from 11 to 10.
- missed paint changed from 48 to 49.
- unresolved cases stayed at 36.
- protected-region regressions: zero.

Publication-held lockbox:

- 48 cases across 2 publications.
- weighted loss improved from 0.56578947 to 0.49682396.
- false paints improved from 30 to 26.
- all other measured counts unchanged.
- protected-region regressions: zero.

The former acceptance gate rejected 57 unsafe candidates and accepted generation 3. That model was
measured before the standalone electrical hard-rule changes below, and its old lockbox was examined
more than once. It must be revalidated against a new untouched publication-grouped lockbox before
it may be mounted in the web service. The API therefore loads no ignored workspace model by
default.

## 2026-08-19 standalone beta implementation

- Added the trilingual Engenharia NATA page at `/pintor/`, hidden behind the generic nine-tap
  Easter egg, marked `noindex`, and intentionally absent from the sitemap/public About catalog.
- Added the FastAPI private-job boundary in `src/wirecolor/web_service.py`: original 25 MB/50-page
  limits (document length was raised to 2,000 in 0.3.0),
  opaque owner sessions, exact CORS allowlist, 24-hour retention, private previews/downloads,
  deletion, and typed feedback.
- Untrusted PDF parsing now happens only inside the killable child worker. The parent API checks
  only byte count and PDF signature. Linux workers apply CPU and address-space ceilings; the web
  path also caps analysis and paint overlays at 60 million pixels by default.
- Added fail-closed V2 protected-region and V7 source-preservation release gates plus reopen and
  page-count verification. Failed output is quarantined and its internal exception is not exposed.
- Corrected physical continuation: a degree-three-or-greater splice/fork never propagates one
  colour to every connected branch. Only a degree-two unbranched continuation may inherit colour.
- Short collinear bridge inference is blocked by component/symbol protected zones.
- Feedback geometry is normalized and task-routed: points for non-wire/missing/wrong-colour;
  segments for bleed/stops-mid/dash-style/stripe-style. Renderer defects never become binary
  wire-classifier labels. All public evidence remains pending and non-trainable.
- Added a non-root read-only container/Compose baseline and a separate Python CI job. The existing
  GitHub Pages deployment still serves only the Vite frontend; the API requires its own protected
  host/tunnel.
- Added `docs/ELECTRICAL_SAFETY_RULES.md` as the canonical hard-versus-learnable rule matrix.

## Preserved local artefacts

- `workspaces/wirecolor_qa/models/run_classifier_cv_v3.json`
- `workspaces/wirecolor_qa/models/decision_policy_cv_v3.json`
- `workspaces/wirecolor_qa/` — main QA/training evidence.
- `workspaces/wirecolor_holdout/` — holdout evidence.
- `workspaces/wirecolor_foreign/` — publication-held lockbox/foreign-format evidence.
- `library/manuals/` — one private source-PDF copy for every manifest publication containing
  code-bearing wiring pages; `library/manifest.json` records selection evidence and SHA-256.
- `original_wiring_diagram/` — flat, descriptive-name convenience copy of those 78 verified
  server-origin PDFs (433,932,385 bytes); every file matches the source-library manifest SHA-256.
- `markups/` — original manual markup PDFs and exported annotations.

These directories are intentionally ignored by Git.

## Verified standalone baseline

- 312 standalone tests passed immediately after extraction (2026-08-19); the web and new safety
  tests are recorded in the validation section of the final session handoff.
- Package compilation, the `python -m wirecolor` entry point, model loading, and the review CLI
  smoke test pass from `Pintor/src` without an Assistant import.
- All 242 persisted JSON/HTML path references were rebased from `output/wirecolor_*` to
  `Pintor/workspaces/wirecolor_*`.
- A hidden filename/content sweep found no colourizer artefact remaining outside `Pintor`; the root
  Assistant handoff contains only the project-boundary pointer to this file.
- The 78 copied source PDFs open successfully: 9,027 total document pages and 350 wiring-page
  evidence records, with zero SHA-256, byte-count, or page-range errors.
- Final pub80 render reached 84% painted vector-length coverage.
- Generation-3 grouped CV and lockbox gates passed with zero protected regressions.

## Session validation

- `366` standalone Python tests pass, including the web boundary, tenant isolation, encrypted PDF,
  invalid page, typed feedback, hard branch/bridge rules, V2/V7 quarantine, and immediate deletion.
- The complete Engenharia NATA validation passes: `354` JavaScript tests, lint, format, style,
  trilingual parity across 20 i18n files, asset references, and Rotta 12 integrity.
- The production Vite build emits `/pintor/index.html` and its hashed JS/CSS bundles.
- The first production build exposed private Pintor workspace HTML as accidental Vite entries. The
  recursive input discovery now excludes all private/generated Pintor directories, and `postbuild`
  fails if any such path returns. The rebuilt output passed across 202 emitted files.
- A synthetic born-digital IEC PDF completed the real processing path with status `ready`, original
  preview, painted PDF, and all release gates. The Linux image was then built on the production
  host; `rapidocr check` initialized ONNX Runtime and verified all three bundled models without a
  runtime download.

## 2026-08-19 protected API publication

- Provisioned dedicated Proxmox VM `206` (`pintor-api`, `192.168.1.14`, 2 vCPU, 4 GB RAM, 20 GB),
  with Docker, automatic boot, QEMU guest agent, and the host CPU profile required by current NumPy.
- Published `https://pintor-api.engnata.eu` through the existing Cloudflare tunnel. The origin port
  accepts only the connector at `192.168.1.10`; other LAN clients are dropped and the container has
  no outbound network access.
- Added a server-side beta-code gate, non-reversible key digest, independent HMAC cookie secret,
  exact production CORS, `HttpOnly`/`Secure`/`SameSite=Strict` cookies, security headers, brute-force
  limits, request limits, job quota, one concurrent worker, and an 8 GB service storage ceiling.
- Pinned the Python base image by digest and froze the deployed dependency graph in
  `requirements-web.lock`. Secrets remain mode `0600` on the VM and never enter Git or the image.
- The external production smoke passed end to end: unauthenticated capabilities returned `401`,
  beta authentication succeeded, a synthetic vector IEC PDF reached `ready`, the released result
  reopened as PDF, and authenticated deletion returned `204`.
- On 2026-08-20 image `engnata/pintor-api:0.2.0` replaced `0.1.0` and became healthy on the same
  protected host. A second external smoke used an actual image-only PDF with zero PDF text/vector
  commands: OCR recognized `RD`, the raster pipeline painted 1 of 7 candidate runs, V2/V7 allowed
  release with the source preserved, the downloaded one-page PDF reopened, and deletion returned
  `204`. The measured processing time was 6.8 seconds for the small 1200 x 800 fixture.
- Image `engnata/pintor-api:0.2.1` then fixed A0 OCR memory pressure and terminal-worker cleanup.
  The exact protected A0 reproduction that previously failed reached `ready` in 279.3 seconds,
  returned a valid 44-page PDF, rejected unauthenticated access with `401`, and deleted the private
  job with `204`. The source and downloaded diagnostic copies were removed after verification.
- On 2026-08-20 the API origin stayed healthy while all four Cloudflare edge connections dropped;
  the public hostname returned `530 / 1033`, so browsers surfaced the native English `Failed to
  fetch` before beta-code validation. Restarting the connector restored four HTTP/2 connections and
  external health/CORS immediately. Version `0.2.2` maps browser transport exceptions to the
  existing PT/IT/SV unavailable message. The connector now has a systemd timer that probes the
  uncached public health endpoint every minute and restarts only `cloudflared` after three
  consecutive failures. Its real success path and a mock failure/restart path passed; the timer is
  enabled on the connector host. A fresh external smoke then passed beta authentication, `401`
  rejection without credentials, PDF processing/release, download, and authenticated deletion.
- Later on 2026-08-20 the owner-requested beta credential rotation was applied directly to the
  protected VM. Only the SHA-256 digest is injected into the container; the plaintext recovery file
  and `.env` remain root-owned mode `0600`, and no credential value entered Git. The HMAC session
  secret was rotated at the same time so previously issued cookies became invalid. External checks
  confirmed the former credential returns `401`, the replacement returns `200`, an authenticated
  session reaches capabilities with `200`, anonymous capabilities remain `401`, and the cookie keeps
  `HttpOnly`, `Secure`, and `SameSite=Strict`.
- PR #21 was merged to `main` as `a09c7b7`. The GitHub Pages deployment and all four PR checks
  completed successfully. Public browser verification loaded the localized **Pintor**, **Pittore**,
  and **Målaren** interfaces without console errors.
- The protected host built and deployed `engnata/pintor-api:0.4.0`; its bundled `rapidocr check`
  passed, the container became healthy, and the existing 3 GB/two-CPU/read-only/non-root/no-egress
  controls remained active. Production requires accounts and bootstraps administrator `popov` from
  a root-only environment username plus scrypt hash; no plaintext administrator password is stored
  in Git, the image, the SQLite database, or this documentation.
- The updated external smoke created an ephemeral beta account, authenticated it, confirmed
  anonymous access returns `401`, processed and downloaded a synthetic IEC PDF, and deleted the job
  with `204`. Its cleanup path removed the ephemeral account. The pre-deployment image remains
  available and `/opt/pintor-api-backups/pintor-api-0.2.1-before-a09c7b7.tar.gz` preserves the
  previous code without `.env`; the live private data volume was reused rather than replaced.
- Intentionally did not place VM 206 in the seven-day VM backup rotation: job PDFs have a 24-hour
  retention contract, and snapshot backups would silently extend retention. Code is reproducible
  from Git; a lost beta secret is rotated instead of restored with stale user documents.

## Next work

1. Add operational alerts for API health, queue latency, job failures, storage pressure, and
   account abuse; keep the public API isolated from training and promotion data.
2. Create a new legally usable, multi-manufacturer publication corpus. Revalidate each convention,
   the changed topology rules, and any mounted model against a new one-shot lockbox.
3. Export expert-accepted evidence into immutable, publication-grouped dataset manifests through
   an offline process. Never auto-promote public feedback or reduce renderer/topology errors to a
   binary wire-classifier label.
4. Expand the legally usable dense A1/A0 benchmark beyond the one qualified Volvo sheet and track
   recall under the conservative native-scale-only policy. Do not infer universal manufacturer or
   page-layout support from this successful capacity reproduction.
