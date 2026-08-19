"""Wire legends read from the PDF's own text layer.

On the measured corpus, 213 of the 350 evidenced pages are born-digital: the wire codes are real
text objects with exact positions. Reading them costs a millisecond and is exactly right, which
makes the entire OCR stack -- tiled reads, the second-chance rotated re-read, the memo cache, the
~2 h cold pass, and every misread it can produce -- unnecessary on the majority of the corpus.

The grammar is the Convention's, so a new manufacturer needs a new data file and no code. The
geometry uses the same page-to-pixel transform as the vector reader, so labels and conductors land
in one coordinate system and ownership can compare them directly.
"""
from __future__ import annotations

from dataclasses import dataclass

from .parse import parse_code, parse_wire_id

# A page's own "Cable color" key prints each code as "BL = Blue", "GN = Green"... The reader parses
# the CODE column exactly like a wire label, so a page that carries its key ships a dozen phantom
# legends that name no conductor -- they depress legend-realization and, worse, one sitting near a
# wire can mis-colour it. The tell is unambiguous: a code with an "=" immediately to its right. No
# wire label is ever followed by "=", so dropping those drops the glossary and nothing else. The
# "=" left edge must fall within this many multiples of the code's height past its right edge.
GLOSSARY_EQUALS_GAP = 4.0


@dataclass(frozen=True)
class Legend:
    """One printed wire code, in working pixels."""
    raw: str
    code: str                 # canonical colour token, e.g. "R/W"
    x: float                  # anchor: centre of the printed text
    y: float
    axis: str                 # "h" or "v" -- the direction the text runs
    wire_id: str | None       # the drawing's own wire number, when printed


def _equals_boxes(page):
    """Bounding boxes (page points) of every standalone "=" glyph -- the key-table marker."""
    boxes = []
    for block in page.get_text("dict").get("blocks", ()):
        for line in block.get("lines", ()):
            for span in line.get("spans", ()):
                if (span.get("text") or "").strip() == "=":
                    boxes.append(span["bbox"])
    return boxes


def _is_glossary_entry(bbox, equals_boxes):
    """True if a code span has an "=" immediately to its right, i.e. it is a "CODE = name" key row."""
    x0, y0, x1, y1 = bbox
    height = max(y1 - y0, 1.0)
    for ex0, ey0, ex1, ey1 in equals_boxes:
        if ex0 >= x1 - height * 0.5 and ex0 <= x1 + height * GLOSSARY_EQUALS_GAP \
                and ey1 > y0 and ey0 < y1:            # to the right, vertically overlapping
            return True
    return False


def read_legends(page, dpi, convention):
    """Every parseable wire code on the page, positioned in working pixels.

    Text direction is kept because a legend is printed ALONGSIDE the conductor it names, so its
    orientation is evidence about which run it belongs to -- a vertical legend beside a bundle of
    horizontal wires is almost certainly naming the one vertical wire crossing them.
    """
    from ..eval.vector_truth import _matrix

    matrix = _matrix(page, dpi)
    equals_boxes = _equals_boxes(page)
    legends = []
    for block in page.get_text("dict").get("blocks", ()):
        for line in block.get("lines", ()):
            direction = line.get("dir", (1, 0))
            axis = "h" if abs(direction[0]) >= abs(direction[1]) else "v"
            for span in line.get("spans", ()):
                raw = (span.get("text") or "").strip()
                if not raw:
                    continue
                # allow_pin: this is the only reader that sees exact printed text, so a
                # whitespace-separated connector pin ("3 PU") or an English lightness word
                # ("DK GN") can be trusted here in a way an OCR read never could.
                code = parse_code(raw, convention, allow_pin=True)
                if not code:
                    continue
                # ...but a code that reads "BL = Blue" is the page's own colour key, not a wire.
                if _is_glossary_entry(span["bbox"], equals_boxes):
                    continue
                x0, y0, x1, y1 = span["bbox"]
                import fitz
                centre = fitz.Point((x0 + x1) / 2.0, (y0 + y1) / 2.0) * matrix
                legends.append(Legend(raw=raw, code=code, x=centre.x, y=centre.y,
                                      axis=axis, wire_id=parse_wire_id(raw)))
    return legends


def strong_legends(legends):
    """Legends carrying real colour information.

    A gauge or a stripe separator always makes a legend trustworthy. A bare token is judged by its
    LENGTH:

    * two or more letters (``SB``, ``BL``, ``GN``, ``VO``) are accepted. Nothing else on these
      sheets is spelled that way, and discarding them left the heavy battery and main-switch cables
      unpainted -- they are labelled ``SB`` and ``R`` with no cross-section at all.
    * a single letter is still discarded, because it is genuinely ambiguous with symbol lettering.
      Measured on pub 2542: eight bare ``P`` labels, none of them a Pink wire -- every one is the
      letter inside a PRESSURE-sensor symbol. Accepting those would paint sensors pink. Single
      letters used as page GRID REFERENCES were also the false positive that inflated an earlier
      corpus measurement more than twofold.

    The cost is that a conductor labelled with a bare single letter stays black. That is the right
    side to err on, and it is visible in the diagnostic pass rather than silently wrong.
    """
    out = []
    for legend in legends:
        gauged = any(ch.isdigit() for ch in legend.raw)
        striped = "/" in legend.code
        if gauged or striped or len(legend.code) >= 2:
            out.append(legend)
    return out


# How far a corroborating gauged legend may sit from a bare single letter. Measured on the dev set:
# 120 px rescues the real bare-R/W conductors (a bare 'R' printed among the 2.5 R / 35 R cables of the
# same circuit) while promoting ZERO pressure-sensor 'P' -- every one is inside its sensor zone or has
# no gauged 'P' anywhere near it, so both gates fail independently.
BARE_LETTER_CORR_PX = 120.0


def _inside_zone(x, y, zones, margin=4.0):
    return any(x0 - margin <= x <= x1 + margin and y0 - margin <= y <= y1 + margin
               for x0, y0, x1, y1 in zones)


def promote_bare_letters(all_legends, strong, zones, convention, corr_px=BARE_LETTER_CORR_PX):
    """Rescue a bare single-letter legend the strong filter discarded, but ONLY when it is clearly a
    live wire code and not a symbol's internal letter.

    A bare single letter is genuinely ambiguous -- ``P`` is usually the letter inside a PRESSURE
    sensor, not Pink -- which is why ``strong_legends`` drops it. But a conductor really is sometimes
    labelled with just ``R`` (the heavy battery/starter reds on pub 34 carry a bare ``R`` beside the
    gauged ``2.5 R`` / ``35 R`` of the same circuit), and leaving it black is a miss the user asked to
    recover. Two INDEPENDENT conditions must both hold, so the sensor ``P`` can never slip through:

      * the letter is NOT inside a component symbol zone -- a sensor's ``P`` is; a cable's ``R``
        printed alongside the wire is not; and
      * a gauged/strong legend of the SAME solid colour sits within ``corr_px`` -- corroborating that
        this letter is a real conductor code on THIS sheet, not stray lettering.

    Returns the extra legends to add to ``strong``. Adds paint only where corroborated, never changes
    an existing colour, and the ownership pass still refuses a promoted legend that fits no run.
    """
    from math import hypot

    solid = {code for code in convention.colors_bgr if len(code) == 1}
    strong_ids = {id(legend) for legend in strong}
    peers_by_code = {}
    for legend in strong:
        if legend.code in solid:
            peers_by_code.setdefault(legend.code, []).append(legend)

    promoted = []
    for legend in all_legends:
        if id(legend) in strong_ids or len(legend.code) != 1 or legend.code not in solid:
            continue
        if _inside_zone(legend.x, legend.y, zones):
            continue
        peers = peers_by_code.get(legend.code, ())
        if any(hypot(peer.x - legend.x, peer.y - legend.y) <= corr_px for peer in peers):
            promoted.append(legend)
    return promoted
