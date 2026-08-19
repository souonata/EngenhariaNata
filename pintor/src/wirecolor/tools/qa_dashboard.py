"""Build the review surfaces: the console (all sheets, all rounds) and per-sheet inspectors.

    python -m wirecolor.tools.qa_dashboard --root workspaces/wirecolor_qa
    python -m wirecolor.tools.qa_dashboard --root workspaces/wirecolor_qa --inspect pub34_p148

Both are single self-contained HTML files with their images inlined, because they are published as
artifacts and nothing may be fetched from another host.

The console is for deciding WHERE to look: totals, the trend across rounds, every sheet ranked, and
the open defect ledger. The inspector is for looking: one sheet at review resolution, scroll to
zoom, drag to pan, pick a defect class, click to pin. Pins export as JSON that goes straight back
into the ledger via ``qa_cases --add-pins``.
"""
from __future__ import annotations

import argparse
import base64
import json
import os

# Review classes. Defects come first in severity order; the two positive controls make validation
# protect behaviour that is already correct instead of learning only from failures.
CLASSES = [
    ("wrong-colour", "Wrong colour", "Wrong", "#c0392b",
     "painted, but not the colour printed beside it"),
    ("non-wire", "Colour on a non-wire", "Non-wire", "#d1651a",
     "housing, symbol, table or frame got painted"),
    ("stops-mid", "Colour stops mid-cable", "Stops", "#b8860b",
     "the same cable turns black partway along"),
    ("missing", "Missing colour", "Missing", "#0069c0",
     "a legend is right there and the wire is black"),
    ("stripe", "One stripe covers the other", "Stripe", "#7048b6",
     "two-colour cable reads as one colour"),
    ("dashed", "Dashed painted solid", "Dashed", "#00796b",
     "dashed = not in the main harness; solid loses that"),
    ("bleed", "Colour bleeding", "Bleed", "#8a6d3b",
     "a colour carried across a splice it should not cross"),
    ("correct-wire", "Correctly painted wire", "OK wire", "#2e7d32",
     "positive control: this real conductor is painted correctly"),
    ("correct-black", "Correctly black object", "OK black", "#00695c",
     "negative control: this furniture, symbol or unpainted item is correctly black"),
]

# Review resolution for the inspector. High enough to read a printed `0.75 GN/SB` at full zoom.
#
# A small sheet's longest side is rendered to at least INSPECT_PX (≈400 DPI on A4), which is plenty.
# A BIG sheet (an A0 foldout is ~3370 pt wide) hit only ~100 DPI under the fixed-width rule and read
# as mush -- the user flagged pub2542 for exactly this. So a big sheet is instead rendered at
# INSPECT_TARGET_DPI, capped by a pixel budget so the inline-base64 preview stays a sane size (an A0
# at 200 DPI is ~62 M px, which fits the budget).
INSPECT_PX = 4800
INSPECT_TARGET_DPI = 200
INSPECT_PX_BUDGET = 64_000_000
INSPECT_QUALITY = 75


# A sheet is judged on evidence, not on its paint rate alone. "100% painted" is a lie when the
# geometry stage found 3 conductors on a page carrying 185 wire codes -- that page is a raster
# foldout the vector path cannot see, and reporting it as perfect is worse than reporting it as
# broken, because it hides a whole tier of the corpus behind a green bar.
VERDICTS = {
    "declined": ("Declined", "not painted: a raster foldout, or a sheet the user marked do-not-paint"),
    "no-geometry": ("No conductors found", "the vector path sees almost no strokes -- raster sheet"),
    "weak": ("Weak", "most printed colour codes never reached a wire"),
    "partial": ("Partial", "most printed colours reached a wire; some codes are still black"),
    "good": ("Good", "nearly every printed colour reached a wire"),
}
VERDICT_ORDER = ["declined", "no-geometry", "weak", "partial", "good"]

# Grade by legend realization once a sheet has this many gauged legends; below it, realization is
# too noisy (one missed code out of five reads as 80%) and paint rate is the safer fallback.
REALIZATION_MIN_LEGENDS = 12
REALIZATION_GOOD = 0.90       # nearly every printed colour reached a wire
REALIZATION_PARTIAL = 0.75    # most did; a handful of codes are still black


def verdict_for(sheet):
    """Rank a sheet by what the evidence supports, not by the paint rate in isolation.

    Paint rate alone lies on furniture-dense sheets. A gasoline or sterndrive diagram can be a mass
    of component, connector, rail and relay outlines with SB=black as a common insulation colour;
    its paint rate then sits near a third even though every printed colour was applied faithfully
    (measured: pub47 37% paint rate / 83% legends realized, pub93 33% / 100%). So when a sheet has
    enough legends to trust it, grade on LEGEND REALIZATION -- did each printed colour code reach a
    wire -- and fall back to paint rate only when there are too few legends for that to be stable.
    """
    if sheet.get("declined"):
        return "declined"
    if sheet.get("crashed"):
        return "no-geometry"
    runs, legends = sheet["runs"], sheet["legends"]
    if runs < 8 or (legends >= 20 and runs < legends / 4):
        return "no-geometry"
    realized = sheet.get("signals", {}).get("legend_realization")
    if realized is not None and legends >= REALIZATION_MIN_LEGENDS:
        if realized >= REALIZATION_GOOD:
            return "good"
        if realized >= REALIZATION_PARTIAL:
            return "partial"
        return "weak"
    # Fallback (few legends, or an old record without the realization signal): paint rate.
    if sheet["paint_rate"] < 0.5:
        return "weak"
    if sheet["paint_rate"] < 0.85 or sheet["signals"]["unpainted_with_nearby_legend"] > 8:
        return "partial"
    return "good"


def _data_uri(path):
    with open(path, "rb") as handle:
        return "data:image/jpeg;base64," + base64.b64encode(handle.read()).decode("ascii")


def _render_sheet(root, sheet, min_width_px=INSPECT_PX, target_dpi=INSPECT_TARGET_DPI,
                  budget=INSPECT_PX_BUDGET, quality=INSPECT_QUALITY):
    """Rasterise a painted sheet for review, and report the px-per-point scale the pins need."""
    import fitz

    document = fitz.open(sheet["out_pdf"])
    page = document[sheet["page"]]
    longest = max(page.rect.width, page.rect.height)
    # whichever gives MORE detail: the fixed-width floor (small sheets already exceed the DPI target)
    # or the DPI target (a big foldout would otherwise fall to ~100 DPI)
    zoom = max(min_width_px / longest, target_dpi / 72.0)
    area = (page.rect.width * zoom) * (page.rect.height * zoom)
    if area > budget:                              # keep the inline-base64 preview a sane size
        zoom *= (budget / area) ** 0.5
    pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    out = os.path.join(root, "previews", f"{sheet['tag']}_review.jpg")
    pixmap.pil_save(out, format="JPEG", quality=quality)
    document.close()
    return out, zoom, [pixmap.width, pixmap.height]


CSS = """
:root{
  --paper:#eceef1; --card:#f7f8fa; --ink:#12151a; --muted:#5d6570; --line:#d3d8de;
  --accent:#006ed2; --accent-soft:#dceafa;
  --pass:#0e7a45; --warn:#a8760a; --fail:#bb3326; --idle:#8b939d;
  --grid:#e3e7ec;
}
@media (prefers-color-scheme: dark){
  :root{ --paper:#0f1216; --card:#171b21; --ink:#e6e9ee; --muted:#98a2ae; --line:#2a313a;
         --accent:#4da3ff; --accent-soft:#12293f;
         --pass:#3fbd7c; --warn:#d7a53c; --fail:#ef6a5c; --idle:#6d7681; --grid:#222932; }
}
:root[data-theme="dark"]{ --paper:#0f1216; --card:#171b21; --ink:#e6e9ee; --muted:#98a2ae;
  --line:#2a313a; --accent:#4da3ff; --accent-soft:#12293f; --pass:#3fbd7c; --warn:#d7a53c;
  --fail:#ef6a5c; --idle:#6d7681; --grid:#222932; }
:root[data-theme="light"]{ --paper:#eceef1; --card:#f7f8fa; --ink:#12151a; --muted:#5d6570;
  --line:#d3d8de; --accent:#006ed2; --accent-soft:#dceafa; --pass:#0e7a45; --warn:#a8760a;
  --fail:#bb3326; --idle:#8b939d; --grid:#e3e7ec; }

*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
  font:15px/1.5 ui-sans-serif,"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;
  font-variant-numeric:tabular-nums;}
.mono{font-family:ui-monospace,"Cascadia Mono",Consolas,"DejaVu Sans Mono",monospace}
.wrap{max-width:1240px;margin:0 auto;padding:32px 24px 80px;display:flex;flex-direction:column;gap:28px}
.eyebrow{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:11px;
  letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
h1{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:26px;font-weight:600;
  letter-spacing:-.01em;margin:6px 0 0;text-wrap:balance}
h2{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:15px;font-weight:600;
  letter-spacing:.02em;margin:0}
.sub{color:var(--muted);font-size:13.5px;margin:8px 0 0;max-width:70ch}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:1px;
  background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.stat{background:var(--card);padding:14px 16px}
.stat .k{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--muted)}
.stat .v{font-family:ui-monospace,Consolas,monospace;font-size:24px;font-weight:600;margin-top:4px}
.stat .d{font-size:12px;color:var(--muted);margin-top:2px}
.up{color:var(--pass)} .down{color:var(--fail)}
.panel{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.phead{display:flex;align-items:baseline;justify-content:space-between;gap:12px;
  padding:13px 16px;border-bottom:1px solid var(--line)}
.phead .hint{font-size:12px;color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--muted);text-align:left;font-weight:500;
  padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:9px 10px;border-bottom:1px solid var(--grid);vertical-align:middle}
tbody tr:last-child td{border-bottom:none}
tbody tr{cursor:pointer}
tbody tr:hover{background:var(--accent-soft)}
th.n,td.n{text-align:right}
.thumb{width:64px;height:44px;object-fit:cover;border:1px solid var(--line);border-radius:3px;
  background:#fff;display:block}
.tag{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;font-weight:600}
.title{color:var(--muted);font-size:12px;max-width:30ch;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.bar{position:relative;width:104px;height:7px;border-radius:4px;background:var(--grid);overflow:hidden}
.bar i{position:absolute;inset:0 auto 0 0;border-radius:4px;background:var(--accent)}
.chip{display:inline-block;font-family:ui-monospace,Consolas,monospace;font-size:10.5px;
  letter-spacing:.06em;padding:2px 7px;border-radius:20px;border:1px solid var(--line);
  color:var(--muted);white-space:nowrap}
.chip.pass{color:var(--pass);border-color:color-mix(in srgb,var(--pass) 40%,transparent)}
.chip.fail{color:var(--fail);border-color:color-mix(in srgb,var(--fail) 45%,transparent);
  background:color-mix(in srgb,var(--fail) 10%,transparent)}
.chip.warn{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,transparent)}
.legend{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px}
.legend span{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block}
.empty{padding:22px 16px;color:var(--muted);font-size:13px}
.scroll{overflow-x:auto}
footer{color:var(--muted);font-size:12px;border-top:1px solid var(--line);padding-top:16px}
code{font-family:ui-monospace,Consolas,monospace;font-size:12px;background:var(--grid);
  padding:1px 5px;border-radius:3px}
"""


def build_console(root, out_path):
    root = os.path.abspath(root)
    state_dir = os.path.join(root, "state")
    history = json.load(open(os.path.join(state_dir, "rounds.json")))["rounds"]
    latest = history[-1]
    cases_path = os.path.join(state_dir, "cases.json")
    ledger = json.load(open(cases_path)) if os.path.exists(cases_path) else {"cases": []}
    # Inspectors are published as their own artifacts (one sheet at review resolution is far too
    # much image to inline twenty times over), so the console links out to whichever exist.
    urls_path = os.path.join(state_dir, "inspector_urls.json")
    urls = json.load(open(urls_path)) if os.path.exists(urls_path) else {}

    sheets = []
    for sheet in latest["sheets"]:
        record = dict(sheet)
        record["verdict"] = verdict_for(sheet)
        record["inspector"] = urls.get(sheet["tag"], "")
        preview = sheet.get("preview")
        record["thumb"] = _data_uri(preview) if preview and os.path.exists(preview) else ""
        record.pop("worst_unpainted", None)
        record.pop("worst_colour_changes", None)
        sheets.append(record)
    sheets.sort(key=lambda s: (VERDICT_ORDER.index(s["verdict"]), s.get("paint_rate", 0)))

    payload = {
        "round": latest["round"],
        "at": latest["at"],
        "note": latest["note"],
        "totals": latest["totals"],
        "regressions": latest["regressions"],
        "sheets": sheets,
        "history": [{"round": r["round"], "at": r["at"], "note": r["note"], **r["totals"]}
                    for r in history],
        "cases": ledger["cases"],
        "classes": [{"key": k, "label": l, "short": s_, "colour": c, "hint": h}
                    for k, l, s_, c, h in CLASSES],
        "verdicts": {k: {"label": l, "hint": h} for k, (l, h) in VERDICTS.items()},
        "verdict_counts": {k: sum(1 for s in sheets if s["verdict"] == k) for k in VERDICT_ORDER},
    }

    html = CONSOLE_HTML.replace("__CSS__", CSS).replace(
        "__DATA__", json.dumps(payload).replace("</", "<\\/"))
    with open(out_path, "w", encoding="utf-8") as handle:
        handle.write(html)
    return out_path, len(html)


def build_inspector(root, tag, out_path):
    root = os.path.abspath(root)
    state_dir = os.path.join(root, "state")
    latest = json.load(open(os.path.join(state_dir, "latest.json")))
    sheet = next((s for s in latest["sheets"] if s["tag"] == tag), None)
    if sheet is None:
        raise SystemExit(f"{tag} is not in the latest round")

    image_path, zoom, size_px = _render_sheet(root, sheet)
    cases_path = os.path.join(state_dir, "cases.json")
    ledger = json.load(open(cases_path)) if os.path.exists(cases_path) else {"cases": []}

    payload = {
        "tag": tag,
        "title": sheet["title"],
        "round": latest["round"],
        "page": sheet["page"],
        "size_class": sheet["size_class"],
        "page_pt": sheet["page_pt"],
        "image_px": size_px,
        # analysis pixels per rendered pixel: pins are recorded in the 200 DPI analysis space the
        # ledger and the engine both speak, never in screen or image pixels
        "analysis_per_image_px": round((200.0 / 72.0) / zoom, 6),
        "metrics": {k: sheet[k] for k in ("runs", "painted", "paint_rate", "legends", "paint_dpi",
                                          "band_mm", "corroboration_rate", "v7_passed")},
        "signals": sheet["signals"],
        "worst_unpainted": sheet.get("worst_unpainted", []),
        "worst_colour_changes": sheet.get("worst_colour_changes", []),
        "codes": sheet.get("codes", []),
        "cases": [c for c in ledger["cases"] if c["tag"] == tag],
        "classes": [{"key": k, "label": l, "short": s_, "colour": c, "hint": h}
                    for k, l, s_, c, h in CLASSES],
        "image": _data_uri(image_path),
    }
    html = (INSPECT_HTML.replace("__CSS__", CSS)
            .replace("__TAG__", f"{tag} · {sheet['title'][:48]}")
            .replace("__DATA__", json.dumps(payload).replace("</", "<\\/")))
    with open(out_path, "w", encoding="utf-8") as handle:
        handle.write(html)
    return out_path, len(html)


CONSOLE_HTML = """<title>Wirecolor QA console</title>
<style>__CSS__</style>
<div class="wrap">
  <header>
    <div class="eyebrow" id="eyebrow"></div>
    <h1>Wiring colouriser &mdash; quality console</h1>
    <p class="sub" id="note"></p>
  </header>
  <section class="stats" id="stats"></section>
  <section class="panel">
    <div class="phead"><h2>Sheets</h2><span class="hint">weakest first &middot; click a row for its detail</span></div>
    <div class="scroll"><table id="sheets">
      <thead><tr>
        <th></th><th>Sheet</th><th>Size</th><th>Verdict</th><th class="n">Codes</th>
        <th class="n">Conductors</th><th class="n">Painted</th>
        <th>Rate</th><th class="n">Realized</th><th class="n">&Delta;</th><th class="n">Labelled&nbsp;black</th>
        <th class="n">Colour&nbsp;breaks</th><th>Preserved</th>
      </tr></thead>
      <tbody></tbody>
    </table></div>
  </section>
  <section class="panel">
    <div class="phead"><h2>Defect ledger</h2><span class="hint">every confirmed defect is re-checked each round</span></div>
    <div id="ledger"></div>
    <div class="legend" id="classlegend"></div>
  </section>
  <section class="panel">
    <div class="phead"><h2>Rounds</h2><span class="hint">the delta is the point, not the absolute</span></div>
    <div class="scroll"><table id="rounds">
      <thead><tr><th class="n">#</th><th>When</th><th>Change</th><th class="n">Median sheet</th>
      <th class="n">Painted</th><th class="n">Labelled black</th><th class="n">V7 fails</th></tr></thead>
      <tbody></tbody>
    </table></div>
  </section>
  <footer>
    Painted from each page's own strokes and text layer &mdash; no OCR. The original PDF is never
    modified: colour is a separate, toggleable layer, and every sheet is verified byte-for-byte
    against its source. Regenerate with <code>qa_sweep</code>, rebuild this page with
    <code>qa_dashboard</code>.
  </footer>
</div>
<script>
const D = __DATA__;
const pct = v => (v*100).toFixed(0) + '%';
const el = (t, c, txt) => { const n = document.createElement(t); if(c) n.className = c;
  if(txt !== undefined) n.textContent = txt; return n; };

document.getElementById('eyebrow').textContent =
  `Round ${D.round} \\u00b7 ${D.at.replace('T',' ').replace('+00:00',' UTC')}`;
document.getElementById('note').textContent = D.note || '';

const prev = D.history.length > 1 ? D.history[D.history.length-2] : null;
const dtxt = (now, before, fmt, better) => {
  if(before === null || before === undefined) return '';
  const d = now - before;
  if(Math.abs(d) < 1e-9) return 'no change';
  const good = better === 'up' ? d > 0 : d < 0;
  return `<span class="${good?'up':'down'}">${d>0?'+':''}${fmt(d)}</span> since round ${prev.round}`;
};
const T = D.totals;
const VC = D.verdict_counts;
const stats = [
  ['Sheets good', `${VC.good}/${T.sheets}`, `${VC.partial} partial \\u00b7 ${VC.weak} weak \\u00b7 ${VC.declined} declined (raster)`],
  ['Median sheet', pct(T.median_paint_rate), prev ? dtxt(T.median_paint_rate, prev.median_paint_rate, v=>pct(v).replace('%',' pts'), 'up') : ''],
  ['Conductors painted', `${T.painted}/${T.runs}`, prev ? dtxt(T.painted, prev.painted, v=>v, 'up') : ''],
  ['Labelled but black', T.labelled_but_black, prev ? dtxt(T.labelled_but_black, prev.labelled_but_black, v=>v, 'down') : ''],
  ['Originals preserved', `${T.sheets - T.v7_failures}/${T.sheets}`, T.v7_failures ? 'a sheet failed V7' : 'every sheet byte-verified'],
  ['Open defects', D.cases.filter(c=>c.status==='open'||c.status==='reopened').length, `${D.cases.length} in the ledger`],
];
const statbox = document.getElementById('stats');
for(const [k,v,d] of stats){
  const s = el('div','stat'); s.append(el('div','k',k), el('div','v',String(v)));
  const dd = el('div','d'); dd.innerHTML = d; s.append(dd); statbox.append(s);
}

const tb = document.querySelector('#sheets tbody');
for(const s of D.sheets){
  const tr = el('tr');
  if(s.crashed){
    tr.innerHTML = `<td colspan="13"><span class="tag">${s.tag}</span> <span class="chip fail">crashed</span></td>`;
    tb.append(tr); continue;
  }
  const d = s.delta || {};
  const reg = (d.regression||[]).length;
  const arrow = d.paint_rate === undefined ? '' :
    (Math.abs(d.paint_rate) < 0.001 ? '&mdash;' :
     `<span class="${d.paint_rate>0?'up':'down'}">${d.paint_rate>0?'+':''}${(d.paint_rate*100).toFixed(1)}</span>`);
  const vstate = {'declined':'','no-geometry':'fail','weak':'fail','partial':'warn','good':'pass'}[s.verdict];
  tr.innerHTML = `
    <td><img class="thumb" src="${s.thumb}" alt=""></td>
    <td><div class="tag">${s.tag}${s.inspector ? ` <a href="${s.inspector}" target="_blank" rel="noopener" title="open the sheet inspector">&#8599;</a>` : ''}</div>
        <div class="title" title="${s.title.replace(/"/g,'&quot;')}">${s.title}</div></td>
    <td><span class="chip">${s.size_class} \\u00b7 ${s.paint_dpi}dpi</span></td>
    <td><span class="chip ${vstate}" title="${(s.decline_reason||D.verdicts[s.verdict].hint).replace(/"/g,'&quot;')}">${D.verdicts[s.verdict].label}${s.user_declined?' \\u00b7 user':''}</span></td>
    <td class="n">${s.legends}</td>
    <td class="n">${s.runs}</td>
    <td class="n">${s.painted}</td>
    <td><div class="bar"><i style="width:${(s.paint_rate*100).toFixed(1)}%"></i></div>
        <span class="mono" style="font-size:11px">${pct(s.paint_rate)}</span></td>
    <td class="n mono" title="printed colour codes realized on a wire &mdash; the verdict driver">${s.signals.legend_realization===undefined?'&mdash;':(s.signals.legend_realization*100).toFixed(0)+'%'}</td>
    <td class="n mono">${arrow}</td>
    <td class="n">${s.signals.unpainted_with_nearby_legend}</td>
    <td class="n">${s.signals.colour_change_junctions}</td>
    <td>${s.v7_passed ? '<span class="chip pass">byte-exact</span>' : '<span class="chip fail">V7 FAIL</span>'}
        ${reg ? `<span class="chip fail">${reg} regression${reg>1?'s':''}</span>` : ''}</td>`;
  tr.onclick = () => {
    const open = tr.nextElementSibling && tr.nextElementSibling.dataset.detail === s.tag;
    document.querySelectorAll('tr[data-detail]').forEach(n=>n.remove());
    if(open) return;
    const row = el('tr'); row.dataset.detail = s.tag; row.style.cursor='default';
    const codes = s.codes.length ? s.codes.join(' \\u00b7 ') : 'none';
    row.innerHTML = `<td colspan="13" style="background:var(--paper)">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;font-size:12.5px">
        <div><div class="k eyebrow">Legends read</div>${s.legends}</div>
        <div><div class="k eyebrow">Legends realized</div>${s.signals.legends_realized===undefined?'&mdash;':`${s.signals.legends_realized}/${s.legends} (${(s.signals.legend_realization*100).toFixed(0)}%)`}</div>
        <div><div class="k eyebrow">By legend / inherited</div>${s.by_legend} / ${s.by_continuation}</div>
        <div><div class="k eyebrow">Corroboration</div>${pct(s.corroboration_rate)}</div>
        <div><div class="k eyebrow">Band</div>${s.band_mm} mm (${s.band_px}px)</div>
        <div><div class="k eyebrow">Symbols stripped</div>${s.symbol_strokes_removed} strokes / ${s.symbol_zones} zones</div>
        <div><div class="k eyebrow">Bare codes refused</div>${s.signals.bare_codes_refused}</div>
      </div>
      <div style="margin-top:12px;font-size:12.5px"><span class="eyebrow">Colours on this sheet</span><br><span class="mono">${codes}</span></div>
      ${(d.regression||[]).length ? `<div style="margin-top:10px;color:var(--fail);font-size:12.5px">Regression: ${d.regression.join('; ')}</div>` : ''}
    </td>`;
    tr.after(row);
  };
  tb.append(tr);
}

const ledger = document.getElementById('ledger');
const byClass = Object.fromEntries(D.classes.map(c=>[c.key,c]));
if(!D.cases.length){
  ledger.innerHTML = `<div class="empty">Nothing in the ledger yet. Open a sheet inspector, pin a
    defect, and it becomes a permanent check that runs on every round from then on.</div>`;
} else {
  const t = el('table');
  t.innerHTML = '<thead><tr><th>Case</th><th>Sheet</th><th>Defect</th><th>Expected</th><th>Found</th><th>Status</th></tr></thead>';
  const body = el('tbody');
  for(const c of D.cases){
    const cls = byClass[c.class] || {label:c.class, colour:'var(--muted)'};
    const r = c.result || {};
    const state = c.status === 'open' ? 'warn' : c.status === 'reopened' ? 'fail'
                : c.status === 'fixed' ? 'pass' : '';
    const tr = el('tr'); tr.style.cursor='default';
    tr.innerHTML = `<td class="mono">${c.id}</td><td class="mono">${c.tag}</td>
      <td><span class="dot" style="background:${cls.colour}"></span> ${cls.label}
          ${c.printed_code?`<span class="mono" style="color:var(--muted)"> ${c.printed_code}</span>`:''}</td>
      <td class="mono">${c.expect}</td>
      <td class="mono">${r.found === undefined ? '&mdash;' : (r.found === null ? 'black' : r.found)}</td>
      <td><span class="chip ${state}">${c.status}</span></td>`;
    body.append(tr);
  }
  t.append(body); ledger.append(t);
}
const cl = document.getElementById('classlegend');
for(const c of D.classes){
  const s = el('span'); s.innerHTML = `<span class="dot" style="background:${c.colour}"></span> ${c.label}`;
  s.title = c.hint; cl.append(s);
}

const rb = document.querySelector('#rounds tbody');
for(const r of [...D.history].reverse()){
  const tr = el('tr'); tr.style.cursor='default';
  tr.innerHTML = `<td class="n mono">${r.round}</td>
    <td class="mono" style="font-size:12px">${r.at.replace('T',' ').replace('+00:00','')}</td>
    <td style="max-width:34ch">${r.note||''}</td>
    <td class="n">${pct(r.median_paint_rate)}</td>
    <td class="n">${r.painted}/${r.runs}</td>
    <td class="n">${r.labelled_but_black}</td>
    <td class="n">${r.v7_failures}</td>`;
  rb.append(tr);
}
</script>
"""


INSPECT_HTML = """<title>__TAG__ &mdash; sheet inspector</title>
<style>__CSS__
  body{overflow:hidden}
  #stage{position:fixed;inset:0;background:var(--paper);overflow:hidden;cursor:crosshair}
  /* left/top/max-width pinned explicitly so the artifact host's CSS reset (img{max-width:100%})
     cannot shrink the sheet out of step with the pin layer -- the two MUST share one pixel space */
  #sheet{position:absolute;left:0;top:0;transform-origin:0 0;image-rendering:auto;user-select:none;
    max-width:none;max-height:none;box-shadow:0 2px 24px rgba(0,0,0,.18);background:#fff}
  #pins{position:absolute;left:0;top:0;pointer-events:none;transform-origin:0 0}
  .pin{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;
    border:2px solid #fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.5);display:grid;place-items:center;
    color:#fff;font:600 11px ui-monospace,Consolas,monospace}
  #bar{position:fixed;left:16px;right:16px;top:14px;display:flex;flex-direction:column;gap:8px;
    background:color-mix(in srgb,var(--card) 92%,transparent);
    border:1px solid var(--line);border-radius:10px;padding:10px 12px;backdrop-filter:blur(8px)}
  #bar .line{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  #bar .title{max-width:none;color:var(--ink);font-weight:600}
  #classbtns{display:flex;gap:6px;flex-wrap:wrap}
  #classbtns .btn{padding:4px 9px;font-size:11px}
  .btn{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;letter-spacing:.04em;
    padding:5px 10px;border-radius:7px;border:1px solid var(--line);background:transparent;
    color:var(--ink);cursor:pointer;display:flex;align-items:center;gap:6px}
  .btn:hover{border-color:var(--accent)}
  .btn[aria-pressed="true"]{background:var(--accent-soft);border-color:var(--accent)}
  .btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  #side{position:fixed;right:16px;top:var(--bartop,104px);width:290px;
    max-height:calc(100vh - var(--bartop,104px) - 32px);
    overflow:auto;background:color-mix(in srgb,var(--card) 94%,transparent);
    border:1px solid var(--line);border-radius:10px;padding:14px;backdrop-filter:blur(8px);
    font-size:12.5px;display:flex;flex-direction:column;gap:12px}
  #side.hidden{display:none}
  .row{display:flex;justify-content:space-between;gap:10px}
  .row span:last-child{font-family:ui-monospace,Consolas,monospace}
  #pinlist{display:flex;flex-direction:column;gap:6px}
  .pinrow{display:flex;gap:8px;align-items:flex-start;font-size:12px;border-bottom:1px solid var(--grid);padding-bottom:6px}
  .pinrow button{margin-left:auto;background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px}
  textarea{width:100%;font:12px ui-monospace,Consolas,monospace;background:var(--paper);
    color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:6px;resize:vertical}
  #hint{position:fixed;left:16px;bottom:14px;font-size:11.5px;color:var(--muted);
    font-family:ui-monospace,Consolas,monospace;background:color-mix(in srgb,var(--card) 88%,transparent);
    border:1px solid var(--line);border-radius:7px;padding:6px 10px}
</style>
<div id="stage"><img id="sheet" alt=""><div id="pins"></div></div>
<div id="bar">
  <div class="line">
    <span class="tag" id="tag"></span>
    <span class="title" id="ttl"></span>
    <span style="flex:1"></span>
    <button class="btn" id="fit">Fit</button>
    <button class="btn" id="toggle">Details</button>
    <button class="btn" id="theme">Theme</button>
  </div>
  <div class="line"><span class="eyebrow">Mark</span><span id="classbtns"></span></div>
</div>
<aside id="side"></aside>
<div id="hint">scroll to zoom &middot; drag to pan &middot; pick a review class then click the exact stroke &middot; 1-9 select class &middot; Esc clears</div>
<script>
const D = __DATA__;
const stage = document.getElementById('stage'), img = document.getElementById('sheet'),
      pinLayer = document.getElementById('pins');
// Force the sheet to its true pixel size and give the pin layer the SAME box, so a pin placed at
// image-pixel (ix,iy) lands on that pixel of the sheet whatever the host's CSS reset tries to do.
img.style.width = D.image_px[0] + 'px';
img.style.height = D.image_px[1] + 'px';
img.style.setProperty('max-width', 'none', 'important');   // beat an !important host reset
img.style.setProperty('max-height', 'none', 'important');
pinLayer.style.width = D.image_px[0] + 'px';
pinLayer.style.height = D.image_px[1] + 'px';
img.src = D.image;
document.getElementById('tag').textContent = D.tag;
document.getElementById('ttl').textContent = D.title + '  \\u00b7  round ' + D.round;

let scale = 1, ox = 0, oy = 0, active = null;
const pins = [];

function apply(){
  img.style.transform = `translate(${ox}px,${oy}px) scale(${scale})`;
  pinLayer.style.transform = `translate(${ox}px,${oy}px) scale(${scale})`;
  for(const p of pins) p.node.style.transform = `scale(${1/scale})`;
}
function fit(){
  const w = D.image_px[0], h = D.image_px[1];
  scale = Math.min((innerWidth-40)/w, (innerHeight-120)/h);
  ox = (innerWidth - w*scale)/2; oy = (innerHeight - h*scale)/2 + 20;
  apply();
}
img.onload = fit;
if (img.complete && img.naturalWidth) fit();          // data URI may already be decoded
document.getElementById('fit').onclick = fit;
// The toolbar wraps to two or three lines depending on window width, so the side panel is placed
// from its MEASURED height rather than a guessed constant -- otherwise the last defect-class
// button ends up underneath the panel at exactly the widths a laptop actually uses.
function layout(){
  const h = document.getElementById('bar').getBoundingClientRect().height;
  document.documentElement.style.setProperty('--bartop', (h + 22) + 'px');
  fit();
}
addEventListener('resize', layout);
requestAnimationFrame(layout);

stage.addEventListener('wheel', e => {
  e.preventDefault();
  const k = Math.exp(-e.deltaY * 0.0016), next = Math.min(60, Math.max(0.05, scale * k));
  ox = e.clientX - (e.clientX - ox) * (next/scale);
  oy = e.clientY - (e.clientY - oy) * (next/scale);
  scale = next; apply();
}, {passive:false});

let dragging = null;
stage.addEventListener('pointerdown', e => {
  if(e.button !== 0) return;
  dragging = {x:e.clientX, y:e.clientY, ox, oy, moved:false};
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', e => {
  if(!dragging) return;
  const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
  if(Math.abs(dx) + Math.abs(dy) > 4) dragging.moved = true;
  ox = dragging.ox + dx; oy = dragging.oy + dy; apply();
});
stage.addEventListener('pointerup', e => {
  const was = dragging; dragging = null;
  if(!was || was.moved || !active) return;
  addPin((e.clientX - ox)/scale, (e.clientY - oy)/scale);
});

function addPin(ix, iy, seed){
  const cls = seed ? D.classes.find(c=>c.key===seed.class) : active;
  const node = document.createElement('div');
  node.className = 'pin';
  node.style.background = cls.colour;
  node.style.left = ix + 'px'; node.style.top = iy + 'px';
  node.textContent = pins.length + 1;
  pinLayer.append(node);
  const at = [ +(ix * D.analysis_per_image_px).toFixed(1), +(iy * D.analysis_per_image_px).toFixed(1) ];
  let expect = seed ? seed.expect : defaultExpect(cls.key);
  if(!seed && cls.key === 'wrong-colour'){
    const entered = prompt('Correct printed colour code (for example GN/W or R):', '');
    const code = (entered || '').trim().toUpperCase().replace(/\\s+/g, '');
    expect = code ? 'painted:' + code : 'unknown-colour';
  }
  pins.push({node, class: cls.key, at, expect, note: ''});
  apply(); renderSide();
}
// What the ledger should assert at this point, chosen from the class so the reviewer does not
// have to think about it. Error and control classes share the same permanent expected outcomes.
function defaultExpect(key){
  if(key === 'wrong-colour') return 'unknown-colour';
  return (key === 'non-wire' || key === 'dashed' || key === 'bleed' || key === 'correct-black')
    ? 'black' : 'painted';
}

const btns = document.getElementById('classbtns');
D.classes.forEach((c, i) => {
  const b = document.createElement('button');
  b.className = 'btn'; b.title = c.hint; b.setAttribute('aria-pressed','false');
  b.innerHTML = `<span class="dot" style="background:${c.colour}"></span>${i+1}&nbsp;${c.short}`;
  b.onclick = () => {
    active = active === c ? null : c;
    [...btns.children].forEach((n,j)=>n.setAttribute('aria-pressed', String(D.classes[j] === active)));
    stage.style.cursor = active ? 'crosshair' : 'grab';
  };
  btns.append(b);
});
addEventListener('keydown', e => {
  if(e.key === 'Escape'){ active = null; [...btns.children].forEach(n=>n.setAttribute('aria-pressed','false')); return; }
  const i = parseInt(e.key, 10);
  if(i >= 1 && i <= D.classes.length) btns.children[i-1].click();
});

const side = document.getElementById('side');
document.getElementById('toggle').onclick = () => side.classList.toggle('hidden');
document.getElementById('theme').onclick = () => {
  const now = document.documentElement.dataset.theme
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = now === 'dark' ? 'light' : 'dark';
};

function renderSide(){
  const m = D.metrics, s = D.signals;
  const rows = [
    ['Conductors', `${m.painted}/${m.runs}`],
    ['Paint rate', (m.paint_rate*100).toFixed(0)+'%'],
    ['Legends realized', s.legend_realization===undefined?'\\u2014':`${s.legends_realized}/${m.legends} (${(s.legend_realization*100).toFixed(0)}%)`],
    ['Legends read', m.legends],
    ['Paint DPI', m.paint_dpi],
    ['Band', m.band_mm + ' mm'],
    ['Corroboration', (m.corroboration_rate*100).toFixed(0)+'%'],
    ['Original preserved', m.v7_passed ? 'byte-exact' : 'FAILED'],
    ['Labelled but black', s.unpainted_with_nearby_legend],
    ['Colour breaks', s.colour_change_junctions],
    ['Bare codes refused', s.bare_codes_refused],
  ];
  side.innerHTML = `<div><div class="eyebrow">${D.size_class} \\u00b7 page ${D.page}</div>
    <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
    ${rows.map(([k,v])=>`<div class="row"><span style="color:var(--muted)">${k}</span><span>${v}</span></div>`).join('')}
    </div></div>`;
  const box = document.createElement('div');
  box.innerHTML = `<div class="eyebrow">Pins (${pins.length})</div>`;
  const list = document.createElement('div'); list.id = 'pinlist';
  pins.forEach((p, i) => {
    const cls = D.classes.find(c=>c.key===p.class);
    const row = document.createElement('div'); row.className = 'pinrow';
    row.innerHTML = `<span class="dot" style="background:${cls.colour};margin-top:4px"></span>
      <span><b>${i+1}</b> ${cls.label}<br>
      <span class="mono" style="color:var(--muted);font-size:11px">${p.at[0]}, ${p.at[1]} \\u00b7 expect ${p.expect}</span></span>`;
    const x = document.createElement('button'); x.textContent = '\\u00d7'; x.title = 'remove';
    x.onclick = () => { p.node.remove(); pins.splice(i,1); pins.forEach((q,j)=>q.node.textContent=j+1); renderSide(); };
    row.append(x); list.append(row);
  });
  box.append(list);
  if(pins.length){
    const out = document.createElement('textarea');
    out.rows = 7; out.readOnly = true;
    out.value = JSON.stringify({tag: D.tag, pins: pins.map(p =>
      ({tag: D.tag, class: p.class, at: p.at, expect: p.expect, source: 'user'}))}, null, 1);
    const copy = document.createElement('button');
    copy.className = 'btn'; copy.textContent = 'Copy pins JSON';
    copy.onclick = () => { out.select(); navigator.clipboard.writeText(out.value);
      copy.textContent = 'Copied \\u2713'; setTimeout(()=>copy.textContent='Copy pins JSON', 1400); };
    box.append(out, copy);
  }
  side.append(box);
  if(D.worst_unpainted.length){
    const w = document.createElement('div');
    w.innerHTML = `<div class="eyebrow">Machine-flagged: labelled but black</div>` +
      D.worst_unpainted.slice(0,8).map(u =>
        `<div class="mono" style="font-size:11px;color:var(--muted)">${u.at[0]},${u.at[1]} \\u00b7 ${u.length_px}px \\u00b7 ${u.nearest_legend} @${u.distance_px}px</div>`).join('');
    side.append(w);
  }
}
renderSide();
for(const c of D.cases) if(c.at) addPin(c.at[0]/D.analysis_per_image_px, c.at[1]/D.analysis_per_image_px, c);
</script>
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--inspect", nargs="*", help="also build inspectors for these tags")
    args = parser.parse_args()

    console = os.path.join(os.path.abspath(args.root), "console.html")
    path, size = build_console(args.root, console)
    print(f"console  {path}  {size/1e6:.2f} MB")
    for tag in args.inspect or []:
        out = os.path.join(os.path.abspath(args.root), f"inspect_{tag}.html")
        path, size = build_inspector(args.root, tag, out)
        print(f"inspect  {path}  {size/1e6:.2f} MB")


if __name__ == "__main__":
    main()
