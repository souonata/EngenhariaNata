# Pintor handoff

Last updated: 2026-08-19

## Product boundary

Pintor has been extracted from the Volvo Penta Assistant into this directory. The package must
remain independently installable and runnable. The Volvo material is a corpus/convention, not a
runtime dependency.

The Engenharia NATA beta is now a private-job web app, but its honest capability boundary is
vector PDF plus extractable text, one selected page per job, and a supported/confirmed colour
convention. Raster/OCR and generic-manufacturer claims remain out of scope.

## Current architecture

The current generation-3 path is graph + constraints + calibrated lightweight classifier +
abstention. Atomic conductor pieces are classified after topology extraction, with hard safety
constraints retaining final authority. Bayesian/evolutionary search is limited to tunable policy
parameters. Evaluation splits are grouped by publication.

Primary entry point: `src/wirecolor/tools/paint_vector.py`.

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
- Added the FastAPI private-job boundary in `src/wirecolor/web_service.py`: 25 MB/50-page limits,
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

- `327` standalone Python tests pass, including the web boundary, tenant isolation, encrypted PDF,
  invalid page, typed feedback, hard branch/bridge rules, V2/V7 quarantine, and immediate deletion.
- The complete Engenharia NATA validation passes: `340` JavaScript tests, lint, format, style,
  trilingual parity across 20 i18n files, asset references, and Rotta 12 integrity.
- The production Vite build emits `/pintor/index.html` and its hashed JS/CSS bundles.
- The first production build exposed private Pintor workspace HTML as accidental Vite entries. The
  recursive input discovery now excludes all private/generated Pintor directories, and `postbuild`
  fails if any such path returns. The rebuilt output passed across 202 emitted files.
- A synthetic born-digital IEC PDF completed the real processing path with status `ready`, original
  preview, painted PDF, and all release gates. Docker was not available on this workstation, so
  the container image itself still needs its CI/host smoke test.

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
- Intentionally did not place VM 206 in the seven-day VM backup rotation: job PDFs have a 24-hour
  retention contract, and snapshot backups would silently extend retention. Code is reproducible
  from Git; a lost beta secret is rotated instead of restored with stale user documents.

## Next work

1. Add operational alerts and an expert-only review console without granting the public API access
   to training or promotion data.
2. Create a new legally usable, multi-manufacturer publication corpus. Revalidate each convention,
   the changed topology rules, and any mounted model against a new one-shot lockbox.
3. Implement a single-save multipage overlay API before offering whole-document painting. The
   current job intentionally paints only one selected page.
4. Add expert adjudication tooling and immutable dataset manifests. Never auto-promote public
   feedback or reduce renderer/topology errors to a binary wire classifier label.
5. Add raster/OCR only after it has protected-region and preservation gates equivalent to the
   vector path.
