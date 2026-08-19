"""Paint conductor runs into the overlay canvas.

Takes runs that already carry a colour code and strokes them onto an RGBA canvas, which is then
handed to the existing ``attach_overlay``. Reusing that path is deliberate: it is the code the V7
preservation validator was written against, so a new painter inherits the byte-prefix, image-hash
and layer-off guarantees instead of having to re-earn them.

A two-colour cable is drawn as **two bands running parallel down the whole length of the wire**,
because that is what the physical cable is: a base colour with a stripe running alongside it end to
end. It is not a dashed alternation -- an earlier version drew it that way and it was simply wrong
about the object. The band geometry comes from ``paint.legacy._perp_offsets``, which the v1 painter
already used for exactly this, so both painters describe the same physical cable.

White gets a black rail under a white core: a white wire drawn plainly on white paper is invisible.
"""
from __future__ import annotations

import cv2
import numpy as np

from math import hypot

from .legacy import _perp_offsets

# Painted band width, as a multiple of the DRAWING'S OWN pen width.
#
# Not millimetres of page, which was the previous rule and was wrong in a way only visible on real
# sheets: the drawn pen varies more than 6x across the corpus (0.22 pt on A4, 0.57 pt on A3,
# 1.42 pt on A0), so a 1.3 mm band that reads well on an A0 foldout is 16.8x the drawn line on an
# A4 chapter figure and makes the diagram illegible. Tying the band to the pen makes it look the
# same relative to the artwork on every sheet size.
BAND_PEN_MULTIPLE = 2.8

# Global thinning factor, exposed on the command line as --band-scale. Sheet density is not
# something the pen width can predict: two drawings with the same pen can have wires 60 px apart or
# 18 px apart, and on the tight one any band that reads well on the loose one crowds the artwork.
# Rather than guess a density metric, this is the one knob a human can turn after looking.
# Multiplies the sheet-size target above. 1.0 means "use the table"; --band-scale overrides.
BAND_SCALE = 1.0

# The band still has to be visible on screen and in print even where the drawing uses hairlines,
# and must not become a slab on a heavy-pen sheet.
# A two-colour cable is two stripes of band/2 sitting side by side, so the band must be an even
# number of pixels wide and at least 4: at 3 px the stripes overlapped by half their width and the
# second colour buried the first, which is how a GR/Y cable came to read as plain yellow.
# Band thickness is set by SHEET SIZE, in millimetres of page: 0.5 mm on A4 rising to 1.0 mm on A0.
#
# Sheet size is the right anchor because it is what decides how the drawing is looked at. An A4
# chapter figure is read at roughly life size, so half a millimetre is a clear line; an A0 foldout
# is printed large and read at arm's length or zoomed out, where half a millimetre disappears.
#
# The A series steps by sqrt(2) in diagonal, so the interpolation is linear in log2 of the diagonal
# and lands on even quarter-millimetre steps across the range: A4 0.50, A3 0.62, A2 0.75, A1 0.88,
# A0 1.00 mm. Sizes outside A4..A0 are clamped to the ends.
BAND_MM_SMALL = 0.50            # at A4
BAND_MM_LARGE = 1.00            # at A0
A4_DIAGONAL_MM = 364.0          # 210 x 297
A0_DIAGONAL_MM = 1456.0         # 841 x 1189

# ...but a band still has to be a few pixels wide to exist at all, whatever the page says.
BAND_MIN_PX = 3

# A two-colour cable must fit INSIDE the same band as a single-colour one. An earlier version gave
# it a wider minimum so both halves stayed legible, and the result was that two-colour cables were
# ~75% fatter than their neighbours (7 rows against 4 on A4) -- which is what makes a dense sheet
# feel crowded, since most cables on these diagrams are two-colour.


def _colours(code, convention):
    """The one or two colour tokens of a code, in printed order."""
    parts = [part for part in code.split(convention.two_color_sep) if part]
    return [part for part in parts if part in convention.colors_bgr]


def _stroke(canvas, polyline, token, thickness, convention):
    """One band. White is drawn as a black rail with a white core so it reads on white paper.

    The rail is proportional to the band. A flat -2 for the core left 1 px of white inside a 4 px
    rail on fine sheets, i.e. a wire that reads as black.
    """
    points = polyline.astype(np.int32)
    if token == convention.white_token:
        rail = max(1, thickness // 4)
        cv2.polylines(canvas, [points], False, (0, 0, 0, 255), thickness + rail, cv2.LINE_AA)
        cv2.polylines(canvas, [points], False, (255, 255, 255, 255),
                      max(1, thickness - rail), cv2.LINE_AA)
        return
    blue, green, red = convention.colors_bgr[token]
    cv2.polylines(canvas, [points], False, (blue, green, red, 255), thickness, cv2.LINE_AA)


def _coverage(thickness):
    """Rows a horizontal cv2 stroke of this thickness actually covers.

    Measured, not assumed: cv2 always paints an ODD, centre-symmetric number of rows, so
    thickness 5 covers 7 and thickness 4 covers 5. Reasoning about the nominal thickness is what
    left the two halves of a cable unequal.
    """
    return 1 if thickness <= 1 else 2 * ((thickness + 1) // 2) + 1


def _stripe_thickness(offset):
    """Widest stripe whose footprint still clears the centre line at +/-offset.

    Two stripes must not share a pixel row: whichever is drawn second claims the shared row, and
    that one row is the whole difference between "two colours" and "one colour with a hint of
    another" on a fine sheet.
    """
    for thickness in range(12, 0, -1):
        if _coverage(thickness) <= 2 * offset - 1:
            return thickness
    return 1


def _plain(canvas, polyline, token, thickness, convention):
    """One stripe of a two-colour cable.

    Drawn WITHOUT antialiasing, deliberately. Two antialiased strokes laid side by side do not
    share the boundary fairly: the second one's soft edge is written over the first, and the alpha
    threshold at the end keeps whichever won. Measured, that made the second colour 7 px against
    5 px on an A0 sheet and 3 px against 1 px on A4 -- the first colour all but disappeared, which
    is exactly the "second colour covers the first" defect reported on both drawings.

    Hard edges make each stripe exactly ``thickness`` wide whichever order they are drawn in. The
    cost is a slightly jagged diagonal, which costs nothing here: these diagrams are almost
    entirely orthogonal, and the alpha threshold was already discarding the antialiased pixels.
    """
    colour = ((255, 255, 255) if token == convention.white_token
              else convention.colors_bgr[token])
    cv2.polylines(canvas, [polyline.astype(np.int32)], False,
                  (colour[0], colour[1], colour[2], 255), max(1, thickness), cv2.LINE_8)


def dash_spans(points, on_px, off_px):
    """Split a polyline into the ON pieces of a dash pattern, walking by arc length.

    Painting a dashed cable solid would say the opposite of what the drawing says -- several of
    these sheets state in the title block that dashed wires are NOT part of the main harness. The
    pitch comes from the page's own dash array, so the painted dashes land on the drawn ones
    instead of beating against them.
    """
    period = max(1.0, on_px + off_px)
    spans, current = [], []
    travelled = 0.0
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        length = hypot(bx - ax, by - ay)
        if length <= 0:
            continue
        step = 0.0
        while step < length:
            phase = (travelled + step) % period
            inside = phase < on_px
            # distance to the next on/off transition, clamped to what is left of this segment
            remaining = (on_px - phase) if inside else (period - phase)
            take = min(max(remaining, 0.25), length - step)
            t0, t1 = step / length, (step + take) / length
            first = (ax + t0 * (bx - ax), ay + t0 * (by - ay))
            second = (ax + t1 * (bx - ax), ay + t1 * (by - ay))
            if inside:
                if current and hypot(current[-1][0] - first[0], current[-1][1] - first[1]) < 0.5:
                    current.append(second)
                else:
                    if len(current) >= 2:
                        spans.append(current)
                    current = [first, second]
            elif len(current) >= 2:
                spans.append(current)
                current = []
            step += take
        travelled += length
    if len(current) >= 2:
        spans.append(current)
    return spans


def band_mm_for(width_pt, height_pt):
    """Target band thickness for a page of this size, in millimetres."""
    from math import log2
    diagonal_mm = hypot(width_pt, height_pt) * 25.4 / 72.0
    span = log2(A0_DIAGONAL_MM / A4_DIAGONAL_MM)
    t = min(1.0, max(0.0, log2(max(diagonal_mm, 1.0) / A4_DIAGONAL_MM) / span))
    return BAND_MM_SMALL + (BAND_MM_LARGE - BAND_MM_SMALL) * t


def band_px(pen_px, scale=None, dpi=200, page_pt=None):
    """Painted band width for a sheet whose drawn conductor pen is ``pen_px`` wide.

    Odd widths are allowed. Forcing an even width was left over from the stripe scheme that split
    the band in half arithmetically; the stripes now derive their offset and thickness from
    measured coverage instead, and the rounding-up silently cancelled --band-scale on fine sheets
    (0.7 x 4 rounded straight back to 4).
    """
    if page_pt is None:                       # no page given: fall back to the small-sheet target
        millimetres = BAND_MM_SMALL
    else:
        millimetres = band_mm_for(*page_pt)
    millimetres *= (BAND_SCALE if scale is None else scale)
    return int(round(max(BAND_MIN_PX, millimetres * dpi / 25.4)))


# Diagnostic colour for runs that no legend claimed. Loud and unlike any wire colour in the
# convention, because its only job is to answer "is the engine skipping real conductors, or is it
# correctly ignoring symbol outlines and table borders?" -- a question that cannot be settled from
# counts alone.
UNPAINTED_BGR = (255, 0, 255)


def build_rgba(owned_runs, canvas_hw, convention, dpi, pen_px=None, diagnose=False, scale=None,
               page_pt=None, dash_pitch=None):
    """RGBA overlay painting every run that carries a code.

    Runs without a code are left untouched -- an unpainted conductor is a miss, a wrongly painted
    one misleads a technician who trusts the colour, and the metric prices them that way too.

    With ``diagnose`` set, those unclaimed runs are stroked in ``UNPAINTED_BGR`` instead of being
    skipped, which turns the invisible half of the result into something a human can review.
    """
    height, width = canvas_hw
    canvas = np.zeros((height, width, 4), np.uint8)
    band = band_px(pen_px if pen_px else dpi / 72.0, scale, dpi, page_pt)
    painted = 0

    for run in owned_runs:
        if not run.code:
            if diagnose and len(run.points) >= 2:
                cv2.polylines(canvas, [np.array(run.points, np.int32)], False,
                              (*UNPAINTED_BGR, 255), band, cv2.LINE_AA)
            continue
        tokens = _colours(run.code, convention)
        if not tokens:
            continue
        if len(run.points) < 2:
            continue
        # A dashed conductor is painted in the ON pieces of the drawing's own dash pattern. Each
        # piece is stroked exactly as a whole cable would be, so a two-colour dashed wire still
        # shows both colours running parallel inside every dash.
        pieces = ([run.points] if not (dash_pitch and getattr(run, "dashed", False))
                  else dash_spans(run.points, *dash_pitch))
        for piece in pieces:
            _paint_piece(canvas, np.array(piece, np.float32), tokens, band, convention)
        painted += 1

    # Anti-aliased strokes leave a halo of partly-transparent pixels; keep only solidly painted
    # ones so the overlay cannot fog the artwork it sits on.
    canvas[canvas[:, :, 3] < 128] = 0
    return canvas, painted


def _paint_piece(canvas, points, tokens, band, convention):
    """Stroke one continuous piece of cable in its one or two colours."""
    if len(points) < 2:
        return
    if len(tokens) == 1:
        _stroke(canvas, points, tokens[0], band, convention)
    elif convention.white_token in tokens:
        # WHITE two-colour cable (e.g. GN/W, Y/W, W/SB). The two colours TOUCH -- no black line
        # between them -- because the only reason white needs a dark edge is to separate it from the
        # white PAPER, not from its partner colour. So each colour fills its half of the band and
        # they meet at the centre, and a thin black rail is added ONLY on the OUTER edge of the
        # white half, on the side that abuts the paper. The other colour reads against the paper on
        # its own. (A SINGLE white wire is railed on BOTH sides instead -- see _stroke.)
        half = max(1, int(round(band / 2.0)))
        offset = max(1, int(round(band / 4.0)))
        left, right = _perp_offsets(points, float(offset))   # tokens[0] on +perp, tokens[1] on -perp
        rail = max(1, int(round(half / 3.0)))
        # Both colours first, meeting at the centre with no line between them.
        _plain(canvas, left, tokens[0], half, convention)
        _plain(canvas, right, tokens[1], half, convention)
        # A thin black rail LAST, sitting just OUTSIDE the white half on the paper side only, so it
        # can never be buried by the white core (it was, at band >= ~16, leaving the white half
        # invisible on paper) and never lands on the other colour's side. The rail centre is one
        # rail-width beyond the white's outer edge (offset + half/2).
        rail_dist = float(offset) + half / 2.0 + rail / 2.0
        outer_plus, outer_minus = _perp_offsets(points, rail_dist)
        rail_line = outer_plus if tokens[0] == convention.white_token else outer_minus
        cv2.polylines(canvas, [rail_line.astype(np.int32)], False, (0, 0, 0, 255), rail, cv2.LINE_8)
    else:
        # Two NON-white colours side by side, running the full length.
        #
        # The stripes are drawn one pixel THINNER than half the band and centred at +/-band/4, so
        # they cannot share the centre pixel. Sharing it is what left the two colours unequal --
        # whichever was drawn second claimed the shared row, giving 7 px against 6. The uncovered
        # centre pixel is the conductor's own drawn line showing through, which reads as the
        # natural boundary between the two colours.
        offset = max(1, int(round(band / 4.0)))
        stripe = _stripe_thickness(offset)
        left, right = _perp_offsets(points, float(offset))
        _plain(canvas, left, tokens[0], stripe, convention)
        _plain(canvas, right, tokens[1], stripe, convention)
