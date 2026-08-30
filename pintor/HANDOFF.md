# Pintor handoff

Last updated: 2026-08-30

## Product boundary

Pintor has been extracted from the Volvo Penta Assistant into this directory. The package must
remain independently installable and runnable. The Volvo material is a corpus/convention, not a
runtime dependency.

The Engenharia NATA beta is a private-job web app that paints any number of vector or rasterized
pages inside a manual of any length, either from an explicit page selection or from a sweep that
finds the wiring diagrams itself. Files are accepted up to 200 MB and processed one page at a time.
Nothing is archived: an upload is erased 24 hours after it is done, unless its owner marked errors
on it and chose to share that report. Exact text/strokes are preferred;
image-only pages use the bundled OCR and conservative pixel-topology pipeline. A
supported/confirmed colour convention remains mandatory, and uncertain segments stay black.

The product name is localized in the interface: **Pintor** in Portuguese, **Pittore** in Italian,
**Målaren** in Swedish, and **Painter** in the native English fallback. Technical identifiers,
paths, package names, and the public route remain `pintor` and `/pintor/`.

## 2026-08-30 Round 2 feedback: page-local code tables and fresh OCR (3.1.5, working tree)

The 60-page Round 2 export returned **45 paintable** and **15 do not paint** decisions. Four gaps
that review exposed are now closed, all of them refusing to widen the global vocabulary:

- **Page-local code tables.** Vintage scans print their own legend, where `B` is black and `Gr` is
  green while the modern vocabulary spells those `SB` and reserves `GR` for grey. Accepting those
  spellings globally would be unsafe, so the aliases activate only for the page that proves them: a
  bilingual `Wire Colour` / `Kod/Code` heading plus at least six independent colour names. Labels
  read that way are tagged `page-code-table` instead of being laundered into ordinary OCR evidence.
- **Short diagnostic harnesses.** A break-out drawing may print `GN`, `GR` and `SB` straight onto
  short parallel conductors with no gauge. A lone bare token stays weak; three distinct codes at
  OCR confidence >= 0.95, aligned as one compact bundle and independently bounded by ink on both
  axial sides, are promoted as `parallel-bare-bundle`. Tables and connector schedules fail the
  two-sided ink test. Both new sources count as strong evidence in the four ownership resolvers.
- **Stale saved OCR.** The strict verifier reused whatever the inventory had recorded. It now
  re-reads the page whenever the ledger's `scanner_version` is behind the current scanner, so an
  improved reader is actually applied instead of being masked by an old ledger. The scanner is at
  `wiring-page-inventory-v15`.
- **Hybrid raster foldouts.** A page whose PDF text is exact but whose conductors live in a large
  embedded scan was answered by the vector pre-flight rejection. That `raster foldout:` verdict now
  routes to fresh OCR plus the production raster topology instead of ending the page.

`CAN H` and `CAN L` remain signal names, never colour codes; a regression pins that.

Measured over all 60 reviewed pages, one verifier run per page: the 45 paintable pages produced
**44 verified** (17 exact vector topology, 27 raster/OCR topology, every one of those 27 through a
refreshed read) and one rejection. Together they carry **3148 physical conductors**, 2 to 244 per
page, across **73 distinct colour codes**. The 15 do-not-paint pages produced **zero verified** (3
rejected, 12 review), so the round added no false positive. The single conservative false negative
is manual `140` page 51, where the OCR labels owned no production-approved conductor; it stays out
rather than being released on weaker evidence.

Suite: **467 Python tests** and the full repository validation with **362 Vitest tests**, lint,
formatting, style, i18n parity, asset checks, nautical integrity and the Pintor build-privacy gate.
The exported feedback JSON is derived from the private library and is ignored, not committed.

## 2026-08-30 feedback-calibrated detection and Round 2 (3.1.4, working tree)

The first exported review was validated against all 560 source fingerprints: **142 decisions** by
Alexandre, comprising **92 paintable** and **50 do not paint**. Negative reasons were 23 service
flowcharts, 11 connector/pin tables, 10 pages without physical coded wires, 4 connector-pin-only
layouts and 2 non-electrical illustrations. The positive set contained 89 raster wiring pages, 2
outlined harness pages and one special tape-ring harness. Skipped pages were intentionally left
unlabelled; no label was inferred from an adjacent or visually similar page.

That feedback exposed that production topology alone was insufficient page grammar: the old strict
verifier approved all 39 vector negatives in the labelled set. Version 2 now fails closed before
ownership when the exact PDF layer is control-heavy substituted-font gibberish, when a dense
Symptoms/ECM pin-function schedule is present, when a Multilink connector installation or
sensor-location/component illustration is named, or when connector pin markers outnumber remaining
conductor labels by more than 2:1. Corrupt exact text is marked for OCR rather than interpreted as
colour evidence; inventory v14 explicitly invokes OCR for that state. Diagnostic prose is no
longer a blanket exclusion because the reviewed corpus contains real one- and four-wire circuits on
troubleshooting pages.

The legacy scanned drawings also gained conservative bilingual word labels. A decimal wire gauge
is mandatory, so `Grön 1,5 - Green 1.5`, `Blå 0,75`, `Svart`, `Röd`, `Gul` and their English pairs
map to Volvo codes while prose such as `Green - Power` remains invalid. Re-running OCR on the
reviewed vintage page `308:107` changed one low-confidence `Gy` observation into nine associated
word labels; strict production topology then verified 20 physical conductors with `BL`, `GN`, `SB`
and `Y`.

Measured after the changes, the 39 vector negatives produced **0 verified**, 16 rejected and 23
OCR-review decisions; the old result was 39 verified. Thirteen of 18 vector positives still verify;
five small diagnostic connector-tail drawings remain conservative false negatives. All 11 labelled
raster negatives stayed outside verification (2 rejected, 9 review). A diverse 16-page raster
positive sample produced 8 verified and 8 review; no unsafe page was promoted. The tape-ring-only
harness remains review-only until Pintor has geometry that paints just the tape bands.

`pintor-review-inventory` now supports repeat rounds with `--exclude-reviewed`,
`--apply-current-prefilter`, `--max-pages`, `--max-per-manual` and `--max-per-signature`. Selection
is deterministic, interleaves evidence lanes and never copies prior decisions onto unreviewed
pages. Round 2 is at `D:/volvo-library/inv/shard_00/round_02/review.html`: **60 pages from 42
manuals**, exactly 20 vector-confirmed, 20 raster-probable and 20 OCR-review pages, at most two per
manual, zero overlap with the 142 prior decisions and zero render errors. From 560 source
candidates it removed the 142 reviewed pages and 91 matches from the new cheap prefilter, leaving
327 eligible before diversity sampling.

Browser QA against a loopback server found 60 cards, loaded real high-resolution imagery, changed
the zoom transform, enabled reason selection, preserved a decision after reload and reported no
console warnings/errors. Validation passed **459 Python tests**, **362 Vitest tests** and the full
repository lint, formatting, style, i18n, asset, nautical-integrity and Pintor checks.

## 2026-08-30 offline human inventory review (3.1.3, working tree)

`pintor-review-inventory` now turns one broad inventory, several shards or a root of shard ledgers
into a movable local review package. `review.html` embeds the candidate facts so it works directly
under `file://`; the only companion files are relative page images. The grid exposes the detector's
status, vector/OCR mode, confidence, colour codes, signal count and reason. Search and automatic or
human-decision filters make large reviews manageable. The full-screen inspector loads a 2800 px
page image on demand and supports wheel/button zoom, cursor-centred scaling, drag pan, fit and
keyboard `Y`/`N`/`U` decisions. Grid thumbnails are copied locally and loaded through an explicit
intersection observer, so opening 560 candidates loads six nearby thumbnails instead of all 560
review images.

The human labels are deliberately paint-oriented: `paintable_wiring`, `do_not_paint` and `unsure`,
each with a controlled reason and optional note. Browser storage preserves progress across reloads;
JSON export/import is the durable handoff. The `pintor-wiring-page-feedback-v1` validator binds a
label to the manual key, SHA-256, one-based page and exact detector-evidence fingerprint. Unknown
IDs, unsupported decisions, duplicate IDs and changed source fingerprints fail closed. Feedback is
never promoted or trained automatically; it becomes reviewed ground truth for later regressions and
rule changes.

The requested private dashboard is at `D:/volvo-library/inv/shard_00/review.html`: **560 candidates
from 105 manuals**, 560 high-resolution images (2800 px, 203.9 MB), 560 lazy grid thumbnails (66.4
MB) and **zero render errors**. Browser QA exercised real images, search DOM, a paintable decision,
reason/note, reload autosave, full-resolution loading, button zoom and pointer pan; the image
transform changed for both operations and the console stayed clean. The in-app test browser blocks
`file://`, so QA used the identical files through a temporary loopback-only HTTP server, removed
after testing. Validation passed **452 Python tests** and the complete repository validation with
**362 Vitest tests**, lint, formatting, style, i18n parity, asset checks and nautical integrity.

## 2026-08-30 strict automatic wiring-diagram verification (3.1.2, working tree)

The exhaustive inventory now has an explicit precision stage instead of presenting every broad
candidate as a wiring diagram. `pintor-verify-inventory` consumes one merged ledger, individual
shards or an inventory root, deduplicates resumed records and writes an append-only, resumable
`verification.jsonl`. Its visible `wiring_diagrams.csv` and `report.html` contain **only** pages for
which the same production topology and engineering-semantics gate used before painting approves at
least one physical colour-coded conductor. Rejected, ambiguous and failed pages remain audit-only.

The verifier routes exact vector pages through the complete vector graph, pictorial hollow-wire
pages through the exact-callout/outlined-conductor detector, and raster pages through the saved OCR
observations plus the production pixel topology. It does not repeat OCR. Automatic raster selection
still requires a decisive colour convention; a single ambiguous label stays in review. Connector
pin markers do not qualify because this report is specifically for pages containing real wires.
Exact PDF case is now evidence too: lower-case `r/p` (return permission), `25w04` (week code) and
`25 gr` (grams) can no longer become electrical `R/P`, `W` or `GR`; lower-case parenthesised wire
IDs such as `0.75 WH (w14)` remain valid.

Real-corpus smoke on the completed small shard 01 processed 19 candidates: **8 verified**, **8
rejected**, **3 review**, **0 errors**. The three previously confirmed administrative flowcharts
were rejected with zero physical conductors; two service illustrations and one one-label page stayed
in review; eight raster wiring pages in one multi-page manual passed with 4-118 approved physical
conductors. Independent controls kept a born-digital wiring page at 11 conductors and the outlined
`pub3763:20` page at 8 conductors, while the `r/p` flowchart stayed at zero. Focused discovery tests:
34 passed; the complete Python suite passed **449 tests**. Repository validation passed 362 Vitest
tests plus lint, formatting, style, i18n parity, asset checks and nautical integrity after formatting
the README.

## 2026-08-23 a rejected report is spent too (0.6.2, working branch)

The 0.6.1 rule only released an **accepted** report, which left every rejected one locked in the
queue forever: a rejection is final, so such a report can never enter an improvement round and
could never satisfy the condition. Worse, `shared_job_ids()` protected a job from the retention
sweep on consent alone, without looking at the verdict, so a consented report that an expert had
already rejected held its drawing on disk indefinitely, against the 24-hour retention contract.
Four reports in the production queue exposed both.

Removal now follows whether the report is spent, not which way the verdict went. Rejected is spent
in the other direction and is removable at once. Accepted keeps the 0.6.1 condition: the round that
carried it into the code must be closed, unless the reporter never consented to learning and it
could not have joined one. Only two states stay locked, and both are genuinely live: a report with
no verdict yet, and one sent back to its author for clarification. The blocked reasons the API
returns are now `not-adjudicated` and `awaiting-clarification` instead of the single
`not-accepted`.

`shared_job_ids()` skips rejected reports, so the drawing rejoins the ordinary sweep. The evidence
is not lost with it: a consented report keeps its own copy of the source, result and previews in
the training inbox, which the sweep never touches and `feedback_artifact()` already prefers as a
fallback.

Local validation: **439 Python tests** (one new, covering the whole life of a rejected report: the
lock before the verdict, the release after it, the freed sweep, the surviving inbox and the
removal), `npm run validate`, `npm run checkup`, and i18n parity across pt-BR, it-IT and sv-SE.

## 2026-08-23 administrative removal of spent beta reports (0.6.1, published)

A report is the only thing a reporter deliberately leaves behind, so it outlives the 24-hour
retention window and protects the drawing it points at. The console had no way to clear one even
after the improvement work that justified keeping it was finished, so the queue and the disk grew
without a floor. Removal is now allowed exactly when the report is spent: an expert accepted it
**and** the improvement round that carried it into the code was closed. A report whose reporter
never consented to learning cannot join a round at all, so an accepted one is already spent and is
removable at once. Everything else answers `409` with a reason, and the list and detail payloads
carry `deletable` and `delete_blocked_reason` so the console explains the lock instead of hiding
the control.

Deleting erases the live record and the archived inbox with its source, painted PDF and previews,
then hands the reporter back a plain `ready` job. The drawing stops being protected and rejoins the
ordinary retention sweep, which is the point: it was only held because a report referenced it. The
closed round's manifest is untouched and the item is reported as `missing` from then on, reusing
the path that already existed for reports deleted by their authors. `DELETE
/api/admin/feedback/{id}` is administrator-only and never touches an open round.

Local validation: **438 Python tests** (three new: the blocked and allowed removal paths, the
freed retention sweep, and the no-consent case), `npm run validate`, `npm run checkup`, and i18n
parity across pt-BR, it-IT and sv-SE.

Published API-first through PR #29. Source commit `f9c8f0e` built image `engnata/pintor-api:0.6.1`
in host release `/opt/pintor-api-releases/f9c8f0e`; the container became healthy on the existing
protected VM and the live `pintor-api_pintor-data` volume was reused rather than replaced. The
external smoke passed end to end: `external_auth=ok account=ok unauthenticated=401 job=ready
result=pdf delete=204`. PR #29 merged as `f309190` and the GitHub Pages deployment completed; the
public config reports Pintor 0.6.1. Image 0.6.0 and release `b73d286` remain available for
rollback.

Two operational notes from this deployment. The deploy scripts were tracked mode `100644` because
the repository is developed on Windows with `core.filemode=false`, so a fresh clone could not
execute `smoke-production.sh`; the four `.sh` files under `deploy/` are now tracked `100755`. And
the Compose project name is `pintor-api` while the release directory is named `pintor`, so every
invocation must pass `-p pintor-api --env-file /opt/pintor-api/.env` explicitly — the `.env` lives
outside the release directories on purpose, and defaulting the project name would bind a new empty
volume instead of the live one.

## 2026-08-23 role-first engineering semantics (0.6.0, published)

Every production route now shares one fail-closed electrical/electronic semantic gate: vector,
raster/OCR, outlined pictorial harness, connector pins, batch, P1 diagnostics, legacy pipeline and
the web worker. The mandatory order is page grammar, object roles, physical conductors between
hard boundaries, authoritative printed colour evidence, conflict/unknown rejection, then render.
Only a physical conductor or a clearance-bounded connector pin can receive colour. Annotation
leaders, component/connector outlines, terminals, junctions and unresolved geometry stay black.
Electrical context may reject an association but never invents a colour from voltage, polarity,
net name or expected function.

The renderer itself repeats the critical checks so a direct caller cannot bypass the semantic
layer. Raster overlays erase globally detected callout leaders from the final mask even when a
generic OCR path proposed pixels below them. Job results expose a bounded explanation—page
grammar, approved roles, excluded annotations, colour/geometry evidence and abstentions—and the
same explanation follows consented error feedback into the administrator detail without copying
private per-object geometry into the UI record. Focused regressions cover missing colour sources,
unbranched continuation, invented raster codes, annotation exclusion and renderer bypass.

Two real pages were reprocessed through the common gate. `pub81:334` was classified as a
pictorial connector schedule: **27 connector pins, zero physical conductors, 37 unresolved drawing
strokes**, V2/V7 passed. `pub3763:20` was classified as a pictorial outlined harness: **8/8 physical
conductors and 8 annotation leaders excluded**, V2/V7 passed in 2.1 seconds. The private PDFs,
previews, full semantic reports and compact `review.html` are under
`output/pdf/random_validation_20260823/semantic_0_6_0` and are not committed. The complete Python
suite passed **435 tests**; repository validation passed **362 Vitest tests** plus lint, format,
style, i18n, asset, nautical and Pintor guards; the production build and privacy gate passed.
The production Compose image tag is advanced to `engnata/pintor-api:0.6.0`; deploy the protected
API before exposing the 0.6.0 frontend because the new UI expects semantic summaries in job and
administrator report payloads.

Published API-first through PR #27. Exact source commit `b73d286` built image
`engnata/pintor-api:0.6.0` (`sha256:9b3818a0e8258f03b6c2b28581224918be82604d1971df27c4762b320beb1230`)
in immutable host release `/opt/pintor-api-releases/b73d286`; RapidOCR and the semantic/inventory
imports passed before the existing private volume was mounted. The container became healthy and
the external smoke passed beta/account authentication, a real PDF job to `ready`, valid download
and deletion. PR #27 merged as `4612f0e`; GitHub Pages run `32649281134` and post-merge tests run
`32649281216` passed. The public config reports Pintor 0.6.0 and the deployed bundle
`pintor-index-UEbpjLIY.js` contains both job and administrator semantic summaries. Image 0.5.0 and
release `656aa9a` remain available for rollback.

## 2026-08-23 outlined pictorial conductors (0.5.6, working branch)

The second deterministic real-manual sample (`pub3763`, PDF page 20, **Installation EMS 2 —
temperature instruments**) draws each real conductor as a hollow raster tube: two thick black
edges with a white centre. Its thin vector strokes from `Y`, `R/SB`, `SB`, `R/BL` and `LBN` are
only callout leaders. The old flattened raster route confused those representations and painted
just one of 1,046 candidates after 189.2 seconds.

The new hybrid route reads exact vector legends and pairs them one-to-one with straight vector
leaders, but uses each leader only to locate a narrow closed white component in the bitonal raster
illustration. It skeletonizes that cable interior and paints its measured width; the leader, text,
instrument outline, terminals and original black cable borders never become paint geometry. A page
needs at least two independently resolved callouts and complete pair coverage before this route is
exclusive. Nominally bitonal PNGs with only antialiasing fringes are accepted, while shaded images
are rejected before thresholding.

The repaired sample resolves **8/8 outlined wires** across the oil- and coolant-temperature
figures: top `Y`, `R/SB`, `SB`, `R/BL`; bottom `LBN`, `R/SB`, `SB`, `R/BL`. Two-colour codes use
equal longitudinal bands. The exact route skips OCR, completes in **2.2 seconds**, and passes V2/V7
with zero protected pixels touched. Focused regressions prove centreline recovery, the OCR bypass,
and that every thin vector leader remains absent from the overlay. The private PDF, preview, report
and review index live only under `output/pdf/random_validation_20260823` and are not committed.
The complete suite passed **428 Python tests**; repository `npm run validate` passed **362 Vitest
tests** plus lint, format, style, i18n, asset, nautical and Pintor guards; the production build and
privacy gate also passed.

## 2026-08-23 connector-pin markers (0.5.5, working branch)

The first deterministic real-manual sample (`pub81`, PDF page 334, **D3 Aquamatic, twin
installation**) is a pictorial connector schedule, not a drawing of the conductors themselves. Its
colour text used to claim the nearest closed vector furniture, painting connector housings, relay
cases, and component outlines as if they were wires. Exact vector pin circles are now grouped under
their smallest enclosing connector housing and matched to same-row/column legends. A connector is
accepted only after at least two independent legend-to-pin matches; its accepted legends are then
withheld from normal wire ownership.

Each accepted pin receives a colour disc centered inside its original circle. The marker radius is
the minimum of 72% of the pin radius, 32% of the nearest-pin distance, and 55% of the housing-edge
clearance. On the measured page this gives a diameter of approximately **0.62 mm**, leaving the pin
rim and surrounding drawing visible. Two-colour codes are rendered as equal left/right
semicircles, with the outline and divider inside that same reserved radius. The repaired sample has
**27 pin markers, 0/37 vector runs painted**, and passes V2/V7. A separate dense wiring sample kept
its previous 99/150 assignments and produced zero pin markers, confirming that the new semantic
path does not take codes away from ordinary conductors.

Five focused regressions cover six-pin matching, the two-match ambiguity gate, grid alignment, radius clearance,
two-colour splitting, and white visibility. The private review PDF and preview under
`output/pdf/random_validation_20260823` were regenerated; no manual or generated review artifact
is committed. The vector-context cache version was advanced so cached pre-marker decisions are
rebuilt instead of being replayed. The complete suite passed **425 Python tests**, repository
`npm run validate` passed **362 Vitest tests** plus all guards, and the production build completed.

## 2026-08-23 administrator drawing viewport and real-manual validation (0.5.4, working branch)

The administrator already manages the complete consent boundary: only a drawing whose owner
submitted marked errors and explicitly shared it appears in **Reports**. Unshared uploads remain
private and disappear under the normal 24-hour retention rule. The reviewer can open the original
or painted preview, inspect typed point/segment annotations, and decide `accepted`, `rejected`, or
`needs-clarification`. Accepted + consented evidence joins the open improvement round, but remains
`trainable: false`; closing a round freezes an offline curation manifest and never changes a model
from the web service.

The report detail now uses the same transform discipline as the owner's viewer: fit, zoom-out and
zoom-in controls, cursor-focused wheel zoom, drag pan, resize refit, and a transform shared by the
preview image and annotation layer. Switching between original and painted preserves scale and pan.
Pure viewport math lives in `pintor-viewport.js`, with regression tests for fit/centering, zoom
focus invariance and scale limits. A local live-API browser fixture verified 33% fit, 50% zoom, pan,
two aligned annotations, and an unchanged transform after switching to the original preview.

The repeatable real-manual probe uses deterministic seed `20260823`: four confirmed plus two
probable black-and-white candidates, all from different manuals. The six one-page extracts,
painted outputs, per-page reports and comparison index belong only in the ignored private output
workspace `output/pdf/random_validation_20260823`; no source manual or generated review artifact is
committed. The final accounting is intentionally gate-aware: four painted results passed V2/V7,
one raster page was left byte-identical because no conductor could be owned safely, and the dense
vector `pub80:163` draft was retained only for expert diagnosis after V2 blocked 20,184 painted
pixels in protected component zones. It must not be treated as a releasable result. Image-bearing
pages used the production raster/OCR fallback. This run also exposed and fixed a Windows-only
best-effort memory-release failure: `ctypes.CDLL(None)` raises `TypeError` there, so the glibc
`malloc_trim` optimization is now safely skipped on that platform and covered by a regression test.

## 2026-08-22 exhaustive wiring-page inventory robot (working branch)

`pintor-inventory` now enumerates every page in every PDF supplied through a private library
manifest or recursive `--pdf-root`. It never edits a source manual. The old discovery threshold
required eight colour codes on one page and therefore missed the exact class requested here:
small sensor, relay and diagnostic figures with only one or two coded wires.

**Evidence rule.** Exact PDF text is read against every installed convention. One strong legend is
enough when a sufficiently long vector stroke is within the measured discovery reach. Lower-case
word collisions (`or` versus Volvo `OR`), bare single letters inside symbols, colour-key rows and
compact one-letter designators (`P1`, `T1`, `R1`) are excluded. Small curved relay leads are kept:
the library example `85 SB` sits 175 px beyond its final Bezier chord, so inventory uses a 220 px
reach while paint ownership remains at its stricter 150 px. Discovery inclusion is not permission
to colour: the normal production topology, ownership, abstention and preservation gates still run
before painting. A page is excluded as already coloured only when a conductor-scale chromatic
stroke sits beside an actual wire-colour legend. Page-wide colour is deliberately insufficient:
logos, warnings, component marks and coloured mechanical illustrations do not hide a separate
black-and-white circuit. The web whole-document sweep uses the same rule before its old eight-code
evidence rule without reviving the old raw eight-code threshold.

**Incremental and reviewable.** `pages.jsonl` is flushed after each page and a resumed run skips
completed work. Each record carries manual SHA/path, 1-based PDF page, exact legends/codes, adjacent
line evidence, confidence, image coverage, text size, legacy-manifest membership and thumbnail.
`summary.json`, `candidates.csv` and a thumbnail-backed `report.html` are rebuilt from the latest
record per page. `--start-manual` plus `--limit-manuals` creates disjoint parallel shards;
`--merge-ledgers` safely merges them, keeps the newest record for each page and copies only the
referenced thumbnails. The legacy eight-code list is retained only as comparison metadata; it no
longer overrides semantic or geometric evidence.

**Measured current private library.** The completed vector + RapidOCR pass covered all **78 manuals /
9,027 pages**: **233 confirmed**, **182 probable**, **2 review**, **56 already-coloured pages
ignored**, **4,238 excluded as non-wiring**, **4,316 with no evidence**, zero pending OCR, zero
errors and zero duplicate page keys. There are **417 black-and-white candidate pages total**, of
which **251 were absent from the old eight-code scan**. CSV rows and referenced thumbnails both
reconcile exactly to 417. The remaining two review pages (`pub3714`, PDF pages 37 and 41) were
visually confirmed as rotated electrical schematics with printed conductor codes; they remain
labelled review so the report preserves the robot's confidence instead of rewriting it by hand.

The final audit explicitly excludes product bulletins, mechanical dimensions/shimming, connector
pin tables, cable-colour reference layouts, hydraulic/fuel-flow diagrams, service decision trees,
component-location/diagnostic prose and pages where `R1`/`P1`/`T1` are component designators rather
than colour labels. This covers every false positive supplied by the user, including `pub865:3`,
`pub91:73/114/228/229`, `pub140:60/61`, `pub141:80/81` and `pub158:86`. Small black-and-white
sensor/installation drawings remain candidates when an actual wire and colour code are present.

Private generated report (ignored, never commit):
`workspaces/wiring_inventory_bw_ocr_final/{summary.json,candidates.csv,report.html,pages.jsonl,thumbnails/}`.
Rebuild the complete pass with:

```powershell
pintor-inventory --library-manifest C:\path\library\manifest.json `
  --out workspaces\wiring_inventory
```

**OCR is installed and complete.** The editable `.[ocr]` extra installed RapidOCR **3.9.2** and
ONNX Runtime **1.29.0**; `rapidocr check` initialized the detector, classifier and recognizer models.
The default `--ocr-mode missing` reused one bounded-thread engine across the inventory and OCRed
undecided raster-bearing or nearly textless pages. Ordinary pages use one OCR pass and oversized
pages are tiled. Image-only evidence remains conservative (`probable`/`review` until line proximity
is measured), and raster conductor colour filtering is applied before a page can enter the report.

**Verified.** Twenty-three inventory regressions cover a one-wire sensor, bare sensor `P`, lower-case
`or`, hydraulic `P1`/`T1`, colour-like prose without a wire, vector and raster already-coloured
wires, short decorative colour, a separate coloured illustration, raster OCR line proximity,
semantic non-wiring exclusions, whole-manual selection and ledger resume/merge/report
reconciliation. The complete Python discovery/painting suite passed **419 tests**, and repository
`npm run validate` passed **359 Vitest tests** plus lint, formatting, style, i18n parity, asset
checks, nautical integrity and the Pintor frontend guards.

## 2026-08-22 large manuals, 24-hour retention, page-by-page work (0.5.0, published)

Same branch, second pass. The first pass removed the page caps; this one makes a long manual
actually survivable while preserving the temporary-storage contract.

**200 MB per file, streamed.** `PINTOR_MAX_UPLOAD_MB` is 200. The endpoint no longer does
`await file.read(max_bytes + 1)` -- it streams the body to `workspace/incoming/` in 1 MB chunks,
enforces the limit while writing, and hands `store.create` a path. `create` accepts bytes or a
path, hashes the file in 1 MB chunks and moves it into the job directory. Measured against a
running API: a 188.8 MB upload grew the API process by 13.1 MB and stored `source_bytes`
188,757,233 intact.

**The service is not an archive.** `PINTOR_RETENTION_HOURS` stays at 24 and now applies to every
upload, account-owned or not: held long enough for its owner to download the result, then erased.
The one exception is a manual the owner deliberately contributed -- marked errors plus learning
consent. `shared_job_ids()` reads that from the feedback records and `cleanup_expired` skips those
jobs, so the contribution survives *and* the owner keeps a handle on it: deleting the job still
withdraws the shared copy, which is the revocation path. Consent is taken from the upload as well
as the report, so a report on a manual uploaded without consent does not silently keep it.
`/api/account/jobs` returns `expires_at` and `shared_for_improvement` per job, and the interface
shows either a countdown or "kept -- shared for improvement". Cleanup runs at startup, before a
new upload, and every five minutes while the API is idle; queued and processing jobs are excluded,
so the 24-hour download window starts only after a terminal state is available. Production caps
live storage at `PINTOR_MAX_ACCOUNT_STORAGE_MB` (2 GB) per account and
`PINTOR_MAX_STORAGE_MB` (8 GB) overall because 200 MB uploads make a day's worth substantial.
The VM had 13 GB free before publication.
Regression fixed while the permanent-storage variant was in place: the `pintor_session` cookie used
`max_age=retention_seconds`, which at retention 0 emitted `Max-Age=0` and deleted the cookie on
arrival, breaking every anonymous session. It now follows the account session or the window.

**Page by page.** The sweep reopens the document every 50 pages, because MuPDF's per-document
store keeps everything it has parsed until the document is closed. Painting attaches each overlay
the moment it exists (`append_overlays`, extracted from `attach_overlays` so a second overlay can
join a file that already carries the OCG), runs V7 on that page immediately, then deletes the
staged PNG -- overlays are never all on disk at once, and a preservation failure surfaces on the
page that caused it. Previews are eager only for the first `PINTOR_EAGER_PREVIEWS` (12) pages; the
rest render on first view and are cached. `_release_page_caches()` shrinks the MuPDF store and runs
`gc.collect()` between pages.

**Supervision follows progress, not the clock.** The old fixed `PINTOR_JOB_TIMEOUT_SECONDS=180`
would have killed every long manual. The supervisor now compares a marker of
`(updated_at, stage, current_page, completed_pages, scanned_pages)` between polls: a job is killed
when it stops moving (`PINTOR_JOB_STALL_SECONDS`, 900 s) or when it passes an absolute ceiling
(`PINTOR_JOB_MAX_SECONDS`, 21,600 s; `PINTOR_JOB_TIMEOUT_SECONDS` still overrides it if set). The
CPU rlimit defaults to the ceiling instead of 150 s. The sweep reports progress every 50 pages,
which is both the UI's progress bar and the liveness signal.

**Measured.** Synthetic manuals, 50 wiring pages each, real pipeline, no mocks:

| manual | found/painted | time | peak RSS | peak workspace | output |
| ------ | ------------- | ---- | -------- | -------------- | ------ |
| 400 pages | 50 / 50 | 144.5 s | 1,173.7 MB | 17.7 MB | 400 pages, 9.8 MB |
| 1,200 pages | 50 / 50 | 144.6 s | 1,175.6 MB | 27.2 MB | 1,200 pages, 14.6 MB |

Tripling manual length moved peak RSS by 1.9 MB (0.16%). No overlay PNGs were left staged and only
24 preview files were written instead of 100. Both runs are far under the 2,560 MB worker rlimit
and the 3 GB container.

**Verified.** 72 Python tests in the web/account/preservation modules, plus `npm run validate`
with 359 Vitest tests. New coverage:
streamed upload keeps bytes and digest and leaves nothing in staging; an oversized file is refused
without being kept; only a manual shared for improvement survives `cleanup_expired` and a report
without upload consent does not keep one; cleanup runs periodically without a restart or upload and
never removes a queued or processing job; the per-account quota refuses a manual and accepts it
again after a deletion; a skipped preview is rendered on first view; a job that keeps reporting
progress is not killed, and one that stops is killed as `ProcessingStalled`. Against a live API:
two manuals were uploaded, one was reported with a marked error and shared, both were aged past the
window, and the restart sweep erased the unshared one while keeping the contributed one plus its
training-inbox copy.

**Deployment configuration (required, not optional).** `compose.yml` pinned the old behaviour by
hand, so a new image alone would have changed nothing: it set `PINTOR_MAX_UPLOAD_MB: 25` and
`PINTOR_JOB_TIMEOUT_SECONDS: 900`, and that timeout is exactly the ceiling this pass replaced. The
file now carries `engnata/pintor-api:0.5.0`, `PINTOR_MAX_UPLOAD_MB: 200`,
`PINTOR_MAX_ACCOUNT_STORAGE_MB: 2048` (the VM has a 20 GB disk, so the 8 GB workspace ceiling
stays), `PINTOR_JOB_STALL_SECONDS: 900` with `PINTOR_JOB_MAX_SECONDS: 21600`, no
`PINTOR_JOB_TIMEOUT_SECONDS`, `PINTOR_JOB_CPU_SECONDS: 21600`, and a five-minute
`PINTOR_CLEANUP_INTERVAL_SECONDS`. It also sets `TMPDIR=/data/tmp`:
Starlette spools any upload over 1 MB to a temporary file, and on the default that lands in the
container's 256 MB RAM-backed `/tmp`, so a 200 MB manual would be held in memory inside a 3 GB cap.
`JobStore` creates that directory.

**Order of publication matters.** The 0.5.x frontend calls endpoints 0.4.0 does not have
(`/api/admin/accounts`, `/api/admin/rounds`, `DELETE /api/account`) and relies on an upload with no
page selection meaning "sweep the document" -- on 0.4.0 that same request paints page 1 instead.
Publication followed that dependency: API image `engnata/pintor-api:0.5.0` was built from exact
commit `656aa9a` and made healthy on the protected host before PR #25 was merged as `d384128`.
The image ID is `sha256:f632812ebad38f5bacee8fcb6cc7f78941556a63ca09787c7d2fe95d993cf6ce`.
The external smoke then passed beta access, temporary account creation, anonymous rejection,
real PDF processing to `ready`, valid PDF download and deletion; its temporary account and job
were removed. GitHub Pages run `32572129340` completed successfully, and the public page loaded
the new `pintor-index-maUAZSLI.js` bundle with the 0.5.x account/admin endpoints.

**Still open.** The measurements above use synthetic vector manuals; a real
scanned A0 foldout is far heavier per page, and the per-page budgets -- not manual length -- are
what bound it. Peak RSS of ~1.2 GB is a *per-page* cost that a raster A0 page can exceed on its
own, so the memory ceiling still deserves a real-corpus run before promising a specific manual.

## 2026-08-22 accounts console, sweeps, and the processing queue (0.5.0, published)

Developed on branch `feat/pintor-admin-contas`, published through PR #25 after the API-first
deployment and external smoke recorded above.

**Administration console.** The admin panel is now three tabs. *Accounts* lists every tester with
role, status, job count and report counts, and can suspend/reactivate, promote/demote, or delete an
account together with all of its jobs and pending training copies. Two rules are enforced in the
store, not only in the interface: an administrator cannot act on their own account from the
console, and the beta can never be left without an active administrator. `bootstrap_admin`
reactivates the configured administrator on boot, so a suspension cannot lock everyone out. A role
change and a suspension both revoke that account's sessions, so powers never travel on an old
cookie.

**Improvement rounds.** A round is a curated batch of expert-accepted reports, stored in
`improvement_rounds/`. One round is open at a time; every acceptance carrying learning consent
joins it automatically and leaves it if the decision is reversed. Closing a round freezes the list
and writes `<id>-manifest.json` with the full reports and the artifacts present in the training
inbox. `automatic_training` is `false` in the manifest, and the service still trains and promotes
nothing.

**Self-service.** *My drawings* shows everything an account owns — queued, painting, finished —
with the queue position, the live stage, a badge on whatever finished since the previous sign-in,
and buttons to reopen, download or delete a drawing. Closing the account re-asks for the password
and erases credentials, sessions, jobs and pending feedback copies.

**No page limits.** `MAX_DOCUMENT_PAGES` (2,000) and `MAX_SELECTED_PAGES` (50) are gone from the
API and the frontend parser. What remains is `MAX_PAGE_NUMBER = 100_000`, purely so a mistyped
range cannot expand into a list that exhausts memory before the PDF is opened, and the unchanged
per-page dimension and analysis-pixel budgets. During a sweep a page that exceeds the per-page
budget is now skipped and reported instead of failing the whole job; for an explicitly requested
page it is still a hard error.

**Whole-document sweep.** An upload with no page selection is swept by
`tools/discover_pages.scan_document`, which reuses the evidence rules already validated against the
library corpus: at least eight wire colour codes in a page's text layer means confirmed; a
near-full-page image on a large sheet with almost no text, inside a document independently known to
be about wiring, is a candidate for OCR. Stroke count alone is still not evidence. With
`convention=auto` the code tokens of every convention are unioned, because detection only has to
decide *whether* a page is a wiring diagram — `_select_convention` still decides which vocabulary
it is written in, per page. A document where nothing qualifies is declined with stage
`no-wiring-page`, not failed. `PINTOR_SCAN_MAX_PAGES` (default 0 = unlimited) lets an operator
bound a sweep.

**Queue.** `ProcessingQueue` grants the single painting slot in arrival order and can answer "how
many files are ahead of mine", which the interface shows both on the processing screen and on each
queued card. The upload form accepts several files at once and creates one job per file.
`PINTOR_MAX_ACTIVE_JOBS` (default 20) replaces the old two-active-jobs rule. On boot, jobs left
`queued` or `processing` by a restart are put back at the front of the line
(`PINTOR_RESUME_ON_START=0` disables it).

**Returning owners.** Accounts now record `previous_login_at`, so `/api/account/jobs` returns
`since` and flags each job with `finished_since_last_login`. Retention is still 24 h, so that view
only ever reaches back one day.

**Verified.** 50 Python tests in the two web/account modules (104 across the four modules run) and
`npm run validate` with 359 Vitest tests, i18n parity, ESLint, Prettier and Stylelint. Against a
live API: a six-page synthetic manual with two wiring pages was swept, both pages were found and
painted, and the released PDF still reopened with all six pages; three files uploaded together
queued in arrival order with visible positions and drained one at a time; killing the service
mid-queue and restarting it resumed both interrupted jobs to `ready`; a returning owner saw only
the conversions that finished while they were away. In the browser: account suspension, promotion,
deletion, round creation/closing, multi-file upload, live queue cards and the localized sweep
refusal were exercised in PT/IT/SV.

**Still open.** Sweeping a very long manual is bounded only by the per-page budgets and the
container's 3 GB/2 CPU ceiling — measure a real 500+ page manual before advertising it. "Finished
since your last visit" cannot outlive the 24-hour retention.

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
