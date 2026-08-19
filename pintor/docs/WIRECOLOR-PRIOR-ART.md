# Wirecolor — prior art, reference implementations and benchmarks

Survey date: 2026-07-20. Purpose: find open-source work comparable to `src/wirecolor/`
so we can (a) borrow algorithms, (b) borrow evaluation methodology, (c) know where we actually stand.

## Bottom line

**Nobody publishes a tool that does our task.** Our task is:

> take an existing, already-drawn raster wiring sheet, read the wire-code labels that are
> *printed on the sheet* (`1.5 R/W`), trace each physical conductor across the whole page
> (through junctions, dashes, hops, inline components, spliced continuations), and repaint
> that conductor in its real insulation colour.

Every neighbour in the literature solves a **different** task — *diagram → graph/netlist*
digitization. They throw the drawing away and emit a data structure. We must keep the drawing
pixel-identical and only change conductor colour. That means their symbol-detection half is
mostly irrelevant to us, but their **line/wire-tracing half is directly comparable** and is
where we should benchmark.

Notably, the commercial benchmark is *not* automated either: ALLDATA's 300k+ "interactive color
wiring diagrams" are **redrawn by hand** by Bosch/Valley Forge from the OE mono originals. So the
automated version of this problem appears genuinely unsolved in public.

---

## Tier A — comparable pipelines (algorithms worth stealing)

| Project | Task | Relevance |
|---|---|---|
| [C-R-Kelly/CircuitSchematicImageInterpreter](https://github.com/C-R-Kelly/CircuitSchematicImageInterpreter) | printed schematic image → components + junctions + wires → network graph | **Closest single repo.** Same shape as ours: binarize → skeletonize → wire detect → junction classify → OCR → graph. Python, v1.0.0 (Dec 2023), ~28 stars. |
| [Digitize-PID (arXiv 2109.03794)](https://arxiv.org/abs/2109.03794) | P&ID → pipes + symbols + text, then association | **Best methodological match.** Kernel-based line detection instead of Hough; explicit line↔text↔symbol *association* stage — which is exactly our label-ownership problem. Ships a 500-sheet synthetic dataset. |
| [SINA (arXiv 2607.01609)](https://arxiv.org/pdf/2607.01609) | schematic image → netlist | Has an explicit **crossing-wires detection** stage — our dash/hop/continuation problem. EasyOCR + morphological wire-network extraction. Code behind an anonymized 4open.science link. |
| [DFKI modular graph extraction (arXiv 2402.11093)](https://arxiv.org/pdf/2402.11093) | handwritten circuits → graph | Post-processing does "resolution of wire hops and rectification of uneven edge lines" — detect hops as objects, *remove them*, then extract edges. Cheap idea we can test. |
| [s39674/Image2schematic](https://github.com/s39674/Image2schematic) | PCB photo → schematic | Weakest of the four. Explicitly admits it "cannot detect connections involving 3+ components" — i.e. it never solved multi-way junctions. No metrics. |
| [LingDong-/skeleton-tracing](https://github.com/LingDong-/skeleton-tracing) | binary image → polylines | Alternative to our `detect/skeleton.py`. Returns topological polylines directly instead of pixel skeletons. Worth an A/B on a hard sheet. |

## Tier B — datasets / benchmarks

| Dataset | Contents | Usable for us? |
|---|---|---|
| [DFKI/cghd](https://github.com/DFKI/cghd) | 3,173 images, 245,962 bboxes, 84,431 text strings, CC0 | Hand-drawn, so wrong domain — but the **annotation schema is the useful part**: it annotates *junctions and crossovers (wire hops)* as first-class classes. Ours doesn't. No eval scripts ship with it. |
| Dataset-P&ID (from Digitize-PID) | 500 synthetic sheets, noise + complex symbols, bbox for every text and symbol | Synthetic-with-injected-noise is a technique we could copy to grow a corpus without more Volvo sheets. Mirrors on HF: `hamzas/digitize-pid-yolo`, `hamzas/digitize-pid-symbols`. |
| [Azure-Samples/digitization-of-piping-and-instrument-diagrams](https://github.com/Azure-Samples/digitization-of-piping-and-instrument-diagrams) | full reference architecture | Engineering reference, not data. |
| [AWS P&ID digitization guidance](https://github.com/aws-solutions-library-samples/guidance-for-piping-and-instrumentation-diagrams-digitization-on-aws) | Bedrock text extraction + SageMaker detection | Same. |

### Where the field's metrics actually are — and why we're not behind

The DFKI baseline reports **per-stage** numbers only: U-Net binary segmentation 98.16% val
accuracy, Faster R-CNN symbol detection **18% mAP**, handwritten text recognition ~83% (paper
labels it CER; direction ambiguous). For the **end-to-end graph** they publish *no quantitative
metric at all* — just one qualitative sample image. Digitize-PID evaluates on synthetic data plus
12 private real sheets.

That is the headline benchmark finding: **the published field mostly does not measure the thing we
measure.** Our whole-sheet paint-coverage metric (commit `e60aa1b`) and ground-truth import from
manual markup (`c590346`) are, methodologically, ahead of these baselines. We should keep that and
not be tempted to adopt a per-stage-only scorecard.

## Tier C — the inverse problem (not our task, but the vocabulary is right)

- [wireviz/WireViz](https://github.com/wireviz/WireViz) — YAML → coloured harness diagram via
  GraphViz. Generation, not interpretation. **But** its colour model is worth copying: IEC-style
  two-letter codes with striped/banded wires expressed as concatenation (`GNYE` = green/yellow).
  Compare against `wirecolor/conventions/` — if our convention tables and WireViz's disagree on a
  code, one of us is wrong, and that is a free correctness check.

---

## Concrete things to try, ranked

1. **Check whether the portal originals are vector.** We rasterize at 200 DPI
   (`wirecolor/prep.py:22`, `Matrix(200/72)`) and do all CV on pixels. If the source PDFs carry
   real vector paths, `page.get_drawings()` (PyMuPDF) hands us exact polylines, stroke widths and
   dash patterns — every hard problem in `detect/skeleton.py`, `detect/dashes.py` and the spliced-
   continuation work becomes a graph problem on exact geometry instead of an inference problem on
   pixels. `cluster_drawings()` even does proximity grouping. **This is by far the highest-value
   check in this document** and it is one command against a portal original. (Local `backend/manuals`
   is empty on this machine — must be run against the VM corpus.)
2. **Annotate hops/crossovers as first-class objects**, CGHD-style: detect them, *delete* them,
   then let connectivity fall out (DFKI approach). Cheaper than reasoning about them in the solver.
3. **A/B `skeleton-tracing` against our own skeletonizer** on the sheets that lose routes.
4. **Cross-check `conventions/` against WireViz's colour tables** for code disagreements.
5. **Read Digitize-PID's association stage in full** — its line↔text association is our
   label-ownership problem (`multiscale.py`, `test_wirecolor_ownership.py`) under another name.
   Only the abstract was readable in this pass; the PDF has the method.

---

# Part 2 — Alternative framings (deliberately *not* our current approach)

The Part 1 survey stayed inside our own paradigm: raster CV → skeleton → OCR → hand-tuned solver.
This part looks for fields that solve a *structurally identical* problem under a different name,
and for product framings that dissolve the problem instead of solving it.

## Alt-1. Wire tracing is road-network extraction (strongest technical alternative)

Tracing a thin, branching, self-crossing linear network across a huge image, where the hard part is
**deciding what continues into what at a junction**, is a mature field — it's just called road
extraction and neuron reconstruction there.

- [Sat2Graph](https://github.com/songtaohe/Sat2Graph) (ECCV 2020) — graph-tensor encoding; unifies
  pixel-segmentation and iterative-graph approaches, the two families we've been oscillating between.
- **RoadTracer** (CVPR 2018) — a CNN decides, step by step, where the line continues from the
  current position. Replaces our hand-tuned junction rules with a learned local decision.
- **[Flood-Filling Networks](https://www.nature.com/articles/s41592-018-0049-4)** (Google, Nature
  Methods 2018) — the closest thing to our exact failure mode. Segments **one object at a time**,
  recurrently, carrying past decisions forward so the network integrates evidence far beyond its
  receptive field, specifically to disambiguate crossings in densely interwoven structures. Result:
  1.1 mm mean error-free path length, an order of magnitude over prior work.

**The metric to steal: expected/error-free run length (ERL).** Connectomics scores a tracer by *how
far it traces before the first mistake*, and it penalises merges (two conductors joined) far more
harshly than splits (one conductor broken). That is exactly the right shape for us — "four lost
routes on pub 2503" is an ERL statement, and a wrongly-merged conductor is a much worse failure
for a technician than an unpainted one. Whole-sheet paint coverage cannot express that asymmetry.
**This is probably the single most valuable idea in the whole survey.**

## Alt-2. Skip the solver: mask components, then connected-component label

[AMSnet 2.0](https://arxiv.org/pdf/2505.09155) (2025) does net detection with almost no cleverness:
mask out detected components by bbox → run connected-component labeling on what's left → each
component is a net. For crossings: **mask a small disc around each intersection to split the
component, then merge the opposite (collinear) stubs.** That's it.

This is a *baseline we have never run*. It is a few dozen lines. If it recovers most conductors on
pub 2503, our skeleton solver is overengineered and the real problem is elsewhere (OCR/ownership).
If it collapses, we get a clean quantified justification for the solver's complexity. Either
outcome is worth more than another tuning round.

## Alt-3. Vectorize first, then it's pure geometry

[Deep-Vectorization-of-Technical-Drawings](https://github.com/Vahe1994/Deep-Vectorization-of-Technical-Drawings)
(ECCV 2020, PyTorch): clean → transformer estimates vector primitives → optimize → merge.
Purpose-built for exactly our input class (floor plans, 2D CAD, technical line drawings), and
**trained on synthetic renders of vector drawings**, which we can generate for free.

This is the fallback if the portal originals turn out to be raster-only: rather than inferring
topology from pixels, *reconstruct* the vector primitives, then solve topology on exact geometry.
Combines well with the Part-1 open question about `get_drawings()`.

## Alt-4. One-shot image-to-graph instead of a modular pipeline

[Relationformer for P&IDs](https://arxiv.org/pdf/2411.13929) detects objects **and their
relationships simultaneously** rather than detecting parts and then joining them. Reported: 83.63%
AP node detection, 75.46% edge mAP, and on real-world data it **beats the modular pipeline on edge
detection by more than 25%**.

That is direct published evidence that modular pipelines — ours is one — lose most on precisely the
*connection* step, which is our weak point. Worth knowing before we invest another round in
hand-tuned association rules.

## Alt-5. Region-based colouring from the anime/line-art world

[hepesu/LineFiller](https://github.com/hepesu/LineFiller) (MIT) and
[Fast Leak-Resistant Segmentation for Anime Line Art](https://dl.acm.org/doi/10.1145/3681758.3698003)
(SIGGRAPH Asia 2024) implement **trapped-ball filling**: roll balls of successively smaller radii
inside the line art so fills don't leak through gaps in strokes, then merge regions heuristically.

This is the *dual* of our problem — they prevent leaking across gaps, we need to bridge gaps — so
don't adopt it wholesale. But it is a mature, production-tested body of work on "colour a line
drawing without destroying it", which is our literal job description, and the multi-radius
gap-reasoning is directly transferable to dashes and text-broken conductors. LineFiller itself is
immature (only the trapped-ball stage is finished).

## Alt-6. Product reframe — highlight one wire on click, don't paint everything

Worth taking seriously because it may make the hard problem optional.

ALLDATA's actual selling feature isn't "everything is coloured" — it's **"highlight a specific wire
and track it across all pages, with everything else ghosted out."** Open-source shape of this
exists: [rpelorosso/pcb-tracer](https://github.com/rpelorosso/pcb-tracer) and
[pcbtracer.com](https://pcbtracer.com/) (trace signal paths, node IDs, overlays).

Why this changes the economics:
- Global correctness is not required. **One** conductor at a time, from a user click.
- The click is a free seed point — the hardest part of unsupervised tracing disappears.
- The user sees the trace live and can correct it; errors become recoverable instead of shipped.
- It degrades gracefully. Our current design fails a sheet; this design fails one wire, visibly.

A technician asking "where does this wire go?" is arguably better served by this than by a fully
pre-coloured sheet. Recommend prototyping it as a second output mode, not as a replacement.

## Alt-7. Cheaper swaps worth an afternoon

- **OCR engine**: our OCR memo cache (`WIRECOLOR_OCR_CACHE`) makes A/B nearly free. PaddleOCR
  PP-OCRv5 is the strongest on dense/rotated/non-flat text; Surya does layout+OCR in one pass.
  Our rotated-short-label re-OCR hack in `pipeline.py:_reocr_region` exists because the current
  engine is weak there — that may be an engine problem, not an algorithm problem.
- **Synthetic corpus**: Digitize-PID built 500 synthetic sheets with injected noise. We can go
  further — **WireViz generates coloured harness diagrams from YAML**, i.e. free, perfectly
  labelled ground-truth pairs (mono input ↔ known correct colour output) in unlimited quantity.
- **VLM as verifier, not engine**: no published benchmark shows VLMs reading wiring diagrams
  reliably, so don't put one in the critical path. But as a cheap checker over crops — "is the wire
  labelled 1.5 R/W the one entering this connector?" — it needs no training data and directly
  attacks ownership errors.
- **GNN link prediction** to reconnect fragments: build a complete graph over segment endpoints,
  classify edges as merge/no-merge from geometric + text features. Learned replacement for the
  hand-written continuation rules, and it fits our spliced-continuation work.

## Ranking, if we only do three things

1. **Adopt ERL / error-free-path-length scoring, with merges penalised above splits** (Alt-1).
   Cheap, changes what we optimise, and exposes whether recent rounds actually improved anything.
2. **Run the AMSnet 2.0 mask-and-CCL baseline** (Alt-2). A day's work; tells us whether the solver
   is earning its complexity.
3. **Prototype click-to-trace highlighting** (Alt-6). Different risk profile, plausibly more useful
   to an actual technician, and it does not depend on solving global correctness first.

---

---

# Part 3 — MEASURED: the corpus is not one problem, it is four

Part 1 listed "are the originals vector?" as the highest-value open question. **It has now been
measured**, read-only, across the whole library on the homelab VM (109 wiring publications; probe
scripts in the session scratchpad, nothing written to the VM).

> **CORRECTED 2026-07-20 after adversarial re-probing.** The first pass below over-counted the
> text-layer tier (single letters `A`/`B`/`C` are page GRID REFERENCES, not wire codes, and some
> sheets carry their codes on a different page from the geometry). The vector-geometry count is
> unaffected. Honest figures and the full correction are in `WIRECOLOR-V4-DECISION.md` §A2.

| Class | Sheets | % | Geometry available | Labels available |
|---|---:|---:|---|---|
| vector + positioned text | **6** | 6% | **exact vector polylines** | **exact PDF text** |
| vector + OCR | **17** | 16% | **exact vector polylines** | OCR needed |
| raster + OCR | 86 | 79% | raster CV needed | OCR needed |

Vector pages carry up to **85,478 stroke primitives** — that is the real conductor geometry, not
page furniture. Text-layer extraction returns exactly our label grammar, verbatim:
`1.5 R/W`, `0.75 GN/W`, `0.75 BN/SB`, `R/PU`, `DBL/W`, `P/DGN`.

Producers explain the split: 64 sheets via `iText 5.3.1` (the portal's wrapper, contents often
preserved), **17 via `Trix Rastermodule`** (a scanning system — these are the true scans), the rest
Adobe/Corel/Distiller.

## Three consequences that override most of Part 1 and Part 2

**1. 23 sheets need almost no computer vision at all.** For `VEC+TXT`, conductor topology is a graph
built from exact stroke endpoints and the labels are already strings. No skeletonization, no OCR, no
solver, no tuned constants. That is 13% of the library solvable to near-certainty with code we have
not written, while we have spent rounds R7–R15 hand-tuning.

**2. We have been optimising against the worst class in the corpus.** Publication 2503 — the sheet
behind the four lost routes and nine correction rounds — measures `ras+ocr`, `img_coverage 1.0`,
**2 vector primitives, 0 text codes**. It is the hardest sheet in the library, and every generic
rule we derived from it was derived from the most degraded evidence available.

**3. The vector sheets are a free, exact ground-truth generator.** Rasterize a `VEC+TXT` sheet at
200 DPI, feed it to the raster pipeline, and compare the result against the exact answer computed
from its own vector geometry. That yields **automatic, pixel-accurate, per-conductor ground truth
on 23 sheets** — no human markup, no synthetic domain gap, unlimited re-runs.

This dissolves the data problem that made the learned-tracer option look expensive, *and* supplies
the evaluation set that ERL scoring needs. It is the highest-leverage asset in the project and it
already exists in the library.

### Therefore: the architecture must be capability-tiered

A sheet-capability detector routes each sheet to the cheapest sufficient evidence path, and the
tiers share one topology/paint core:

- **Tier A — vector geometry + text labels** → exact solve. Near-zero error. 14 sheets.
- **Tier B — vector geometry + OCR labels** → exact topology, only labels inferred. 9 sheets.
- **Tier C — raster geometry + text labels** → labels free, only topology inferred. 1 sheet.
- **Tier D — raster + OCR** → today's full pipeline, now the *fallback*, not the default. 85 sheets.

Tiers A–C are also the calibration harness for Tier D: every constant Tier D infers, Tiers A–C
already know exactly.

Sheet ids for immediate work — `VEC+TXT`: 36, 83, 140, 321, 1095, 2481, 2482, 2483, 2505, 2515,
2531, 2532, 2542, 2543. `VEC+ocr`: 42, 78, 79, 90, 189, 215, 746, 2469, 2471.

---

## Open questions this survey did not settle

- Digitize-PID's actual kernel-based line-detection formulation and its numbers (abstract only).
- SINA's crossing-vs-junction discriminator and its accuracy (PDF fetched but results tables not
  parsed; local copy exists under the session tool-results dir).
- Whether any of these handle *dashed* conductors at all — none of them said so explicitly, and
  dashes are a first-class problem for us (`detect/dashes.py`).
