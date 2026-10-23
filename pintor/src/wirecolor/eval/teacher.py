"""Factory-coloured wiring pages as ground truth for the painter.

Volvo Penta has printed colour wiring diagrams for years, mostly for its gasoline engines, and since
2026 a dedicated "Colored Wiring Diagram" series. Each such page already answers the question this
product asks: which colour is every conductor. This module turns that answer into a measurement.

* **harvest** finds the painted conductors on a vector page. Every factory style measured so far
  draws a conductor as one wide stroke in its base colour, optionally a black rail 0.25 pt wider
  under it (2026 series), and optionally a thin centred tracer in its second colour.
* **atlas** learns the publication's own palette -- which RGB means which colour token -- from
  the printed codes next to the conductors, by vote. Nothing is assumed about the factory RGB.
* **twin** rebuilds the page in monochrome: every conductor becomes one thin black line on its
  centreline, every other drawing keeps its geometry in grey, and the text layer is reinserted so
  the printed codes are still exact text.
* **score** judges a painted overlay of the twin conductor by conductor against the factory colour.

The factory colours are used for evaluation and style only. Nothing here is consulted at painting
time: the painter must colour a page it has never seen.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from math import hypot

# A stroke whose RGB channels spread by more than this is coloured; below it, it is black, grey or
# white. The factory's darkest drafting grey (0.12, 0.12, 0.12) spreads by 0.
CHROMA_SPREAD = 0.08
DARK_MAX = 0.25
WHITE_MIN = 0.94

# Conductors are drawn heavier than the drafting pen in every factory style measured: 3.96 pt
# against 0.58-1.08 pt on the classic gasoline pages, 1.5-5.0 pt cores against 0.5-1.0 pt on the
# 2026 series. A tracer is at most this fraction of its conductor's width (measured 0.27-0.36).
CONDUCTOR_PEN_FACTOR = 1.45
TRACER_WIDTH_FACTOR = 0.6
MIN_CONDUCTOR_PT = 6.0

# The 2026 rail is the core width + 0.25 pt; accept a little rounding either side.
RAIL_EXTRA_PT = (0.12, 0.45)
# A lighter stroke at least this share of a black one with the same geometry is a core inside an
# outline (classic white wires: 2.5 pt over 4.0 pt), not a tracer.
OUTLINE_CORE_SHARE = 0.5

# A printed code names the conductor its leader or its baseline sits beside.
LEGEND_REACH_PT = 24.0
CONFLICT_REACH_PT = 6.0


def colour_class(rgb) -> str:
    if rgb is None:
        return "none"
    if max(rgb) - min(rgb) > CHROMA_SPREAD:
        return "chromatic"
    if min(rgb) >= WHITE_MIN:
        return "white"
    if max(rgb) <= DARK_MAX:
        return "dark"
    return "grey"


def rgb_key(rgb) -> tuple:
    return tuple(round(float(value), 2) for value in rgb)


@dataclass
class Stroke:
    index: int
    width: float
    rgb: tuple
    segments: list
    closed: bool
    curved: bool

    @property
    def length(self) -> float:
        return sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in self.segments)


def _flatten(item) -> list:
    """Points of one drawing item; a curve is flattened to its control polygon."""
    op = item[0]
    if op == "l":
        points = [item[1], item[2]]
    elif op == "c":
        points = [item[1], item[2], item[3], item[4]]
    elif op == "re":
        rect = item[1]
        points = [(rect.x0, rect.y0), (rect.x1, rect.y0), (rect.x1, rect.y1),
                  (rect.x0, rect.y1), (rect.x0, rect.y0)]
    elif op == "qu":
        quad = item[1]
        points = [quad.ul, quad.ur, quad.lr, quad.ll, quad.ul]
    else:
        return []
    return [(float(point[0]), float(point[1])) for point in points]


def page_strokes(drawings) -> list[Stroke]:
    strokes = []
    for index, drawing in enumerate(drawings):
        colour = drawing.get("color")
        width = float(drawing.get("width") or 0.0)
        if colour is None or width <= 0 or "s" not in str(drawing.get("type", "")):
            continue
        segments, curved, shapes = [], False, False
        for item in drawing.get("items", ()):
            curved |= item[0] == "c"
            shapes |= item[0] in ("re", "qu")
            points = _flatten(item)
            segments += [(a, b) for a, b in zip(points, points[1:])
                         if hypot(b[0] - a[0], b[1] - a[1]) > 0]
        if segments:
            strokes.append(Stroke(index=index, width=width, rgb=tuple(colour), segments=segments,
                                  closed=bool(drawing.get("closePath")) or shapes, curved=curved))
    return strokes


def drafting_width(strokes) -> float:
    """The most common width among the uncoloured strokes: the pen the sheet is drawn with.

    Counted by stroke, not by length: on the 2026 series the long black rails under every wire
    outweigh the drafting pen by length (1.75 pt against 0.5 pt on the main engine harness).
    """
    counts = Counter(round(stroke.width, 2) for stroke in strokes
                     if colour_class(stroke.rgb) in ("dark", "grey"))
    return counts.most_common(1)[0][0] if counts else 0.5


def _open_line(stroke) -> bool:
    return not stroke.closed and not stroke.curved and stroke.length >= MIN_CONDUCTOR_PT


def wire_widths(strokes, pen) -> tuple[list, list]:
    """Core widths and rail widths this sheet draws its conductors with.

    A core width is one that carries a real share of the coloured line length and is heavier than
    the drafting pen. A rail width is a dark stroke 0.12-0.45 pt wider than a coloured or white
    stroke with exactly the same geometry -- the 2026 series' black edge.
    """
    chroma = Counter()
    for stroke in strokes:
        if _open_line(stroke) and colour_class(stroke.rgb) == "chromatic" \
                and stroke.width >= CONDUCTOR_PEN_FACTOR * pen:
            chroma[round(stroke.width, 2)] += stroke.length
    total = sum(chroma.values()) or 1.0
    # A tracer runs the whole length of its conductor, so its width carries as much coloured
    # length as a core's. It is told apart by being much thinner than the sheet's dominant core.
    dominant = chroma.most_common(1)[0][0] if chroma else 0.0
    cores = sorted(width for width, length in chroma.items()
                   if length >= 0.05 * total and width >= TRACER_WIDTH_FACTOR * dominant)

    by_geometry = defaultdict(list)
    for stroke in strokes:
        if _open_line(stroke):
            by_geometry[_geometry_key(stroke)].append(stroke)
    rails = set()
    for members in by_geometry.values():
        for rail in members:
            if colour_class(rail.rgb) != "dark":
                continue
            for core in members:
                if colour_class(core.rgb) in ("chromatic", "white") and \
                        RAIL_EXTRA_PT[0] <= rail.width - core.width <= RAIL_EXTRA_PT[1]:
                    rails.add(round(rail.width, 2))
                    cores.append(round(core.width, 2))
    return sorted(set(cores)), sorted(rails)


def _near_any(width, widths, tolerance=0.08) -> bool:
    return any(abs(width - other) <= tolerance * other for other in widths)


@dataclass
class Conductor:
    segments: list
    width: float
    base_rgb: tuple
    tracer_rgb: tuple | None = None
    members: set = field(default_factory=set)
    base_token: str | None = None
    tracer_token: str | None = None

    @property
    def length(self) -> float:
        return sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in self.segments)

    @property
    def code(self) -> str | None:
        if not self.base_token:
            return None
        if self.tracer_rgb is not None:
            return f"{self.base_token}/{self.tracer_token}" if self.tracer_token else None
        return self.base_token


def _geometry_key(stroke) -> tuple:
    return tuple(round(value, 1) for segment in stroke.segments for point in segment
                 for value in point)


def _point_segment_distance(point, a, b) -> float:
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return hypot(point[0] - ax, point[1] - ay)
    t = max(0.0, min(1.0, ((point[0] - ax) * dx + (point[1] - ay) * dy) / length_sq))
    return hypot(point[0] - (ax + t * dx), point[1] - (ay + t * dy))


class _SegmentGrid:
    """Coarse spatial index of conductor segments, so containment tests stay local."""

    def __init__(self, cell=24.0):
        self.cell = cell
        self.cells = defaultdict(list)

    def add(self, owner, a, b):
        x0, x1 = sorted((a[0], b[0]))
        y0, y1 = sorted((a[1], b[1]))
        for cx in range(int(x0 // self.cell), int(x1 // self.cell) + 1):
            for cy in range(int(y0 // self.cell), int(y1 // self.cell) + 1):
                self.cells[(cx, cy)].append((owner, a, b))

    def near(self, point):
        cx, cy = int(point[0] // self.cell), int(point[1] // self.cell)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                yield from self.cells.get((cx + dx, cy + dy), ())


def _parallel(a, b, c, d, tolerance=0.08) -> bool:
    ux, uy = b[0] - a[0], b[1] - a[1]
    vx, vy = d[0] - c[0], d[1] - c[1]
    nu, nv = hypot(ux, uy), hypot(vx, vy)
    if nu == 0 or nv == 0:
        return False
    return abs(ux * vy - uy * vx) / (nu * nv) <= tolerance


@dataclass
class PageHarvest:
    conductors: list
    pen: float
    members: set
    rail_pairs: int
    tracers: int


def _is_candidate(stroke, pen, cores, rails) -> bool:
    if not _open_line(stroke):
        return False
    kind = colour_class(stroke.rgb)
    if kind in ("chromatic", "white"):
        return stroke.width >= CONDUCTOR_PEN_FACTOR * pen
    # An uncoloured stroke is a conductor only at a conductor's own weight: a black wire on the
    # classic pages is as wide as the coloured ones, and on the 2026 series it is a bare rail.
    if rails:
        return _near_any(stroke.width, rails)
    return _near_any(stroke.width, cores)


# The classic sheets break the wire underneath a crossing with a short white stroke. Measured on
# pub 91 p433: 9-34 pt long, crossed by the wire on top.
KNOCKOUT_MAX_PT = 40.0


def _segments_cross(a, b, c, d) -> bool:
    def side(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

    return (side(a, b, c) * side(a, b, d) < 0) and (side(c, d, a) * side(c, d, b) < 0)


def _without_crossing_knockouts(conductors):
    """Drop short white strokes that another conductor crosses: crossing gaps, not wires."""
    kept = []
    for conductor in conductors:
        if colour_class(conductor.base_rgb) == "white" and conductor.length <= KNOCKOUT_MAX_PT:
            crossed = any(_segments_cross(a, b, c, d)
                          for other in conductors if other is not conductor
                          for c, d in other.segments for a, b in conductor.segments)
            if crossed:
                continue
        kept.append(conductor)
    return kept


def harvest_strokes(strokes) -> PageHarvest:
    pen = drafting_width(strokes)
    cores, rails = wire_widths(strokes, pen)
    groups = defaultdict(list)
    for stroke in strokes:
        if _is_candidate(stroke, pen, cores, rails):
            groups[_geometry_key(stroke)].append(stroke)

    conductors, rail_pairs = [], 0
    for members in groups.values():
        members.sort(key=lambda stroke: -stroke.width)
        core = members[0]
        if len(members) > 1 and colour_class(members[0].rgb) == "dark":
            extra = members[0].width - members[1].width
            lighter = colour_class(members[1].rgb) in ("chromatic", "white")
            if RAIL_EXTRA_PT[0] <= extra <= RAIL_EXTRA_PT[1]:
                core = members[1]
                rail_pairs += 1
            elif lighter and members[1].width >= OUTLINE_CORE_SHARE * members[0].width:
                # The classic sheets draw a white wire as a 2.5 pt white core over a 4.0 pt
                # black outline: the outline is ink, the core is the colour.
                core = members[1]
        conductor = Conductor(segments=list(core.segments), width=core.width, base_rgb=core.rgb,
                              members={stroke.index for stroke in members})
        # A tracer drawn with exactly the core's geometry lands in the same group (pub 36 draws
        # R/PU as a 4.0 pt red and a 1.5 pt purple over the same four segments).
        conductor.inline_tracers = [stroke for stroke in members
                                    if stroke.width <= TRACER_WIDTH_FACTOR * core.width]
        conductors.append(conductor)
    conductors = _without_crossing_knockouts(conductors)
    # Widest first: a narrower candidate lying inside a wider conductor is its tracer, not a
    # conductor of its own.
    conductors.sort(key=lambda conductor: -conductor.width)

    grid = _SegmentGrid()
    for number, conductor in enumerate(conductors):
        for a, b in conductor.segments:
            grid.add(number, a, b)

    def containers(segments, width, length, exclude=None):
        """Wider conductors holding these segments along their centre, by length held.

        A tracer may be drawn as one polyline over several pieces of its conductor (pub 91 draws
        the grey of a Y/GR as one path along three yellow ones), so it is shared out by segment.
        Empty unless at least 80 % of its length lies inside some conductor.
        """
        matched = Counter()
        for a, b in segments:
            midpoint = ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)
            for number, c, d in grid.near(midpoint):
                host = conductors[number]
                if number == exclude or width > TRACER_WIDTH_FACTOR * host.width:
                    continue
                if not _parallel(a, b, c, d):
                    continue
                reach = host.width / 2.0 + 0.25
                if all(_point_segment_distance(point, c, d) <= reach
                       for point in (a, b, midpoint)):
                    matched[number] += hypot(b[0] - a[0], b[1] - a[1])
                    break
        if sum(matched.values()) >= 0.8 * length:
            return matched
        return Counter()

    tracer_votes = defaultdict(Counter)
    tracers = 0

    def absorb(host, rgb, width, length, indexes):
        nonlocal tracers
        conductors[host].members |= set(indexes)
        # The 2026 colourist left the original drawn line, at the drafting pen, on top of many
        # cores. It is part of the conductor's ink but not a colour of it. Only on a sheet in
        # that style (black rails): on the classic sheets a black tracer is drawn at the drafting
        # pen too (0.85 pt over a 2.5 pt white core is W/SB on pub 91).
        if rail_pairs and colour_class(rgb) == "dark" and abs(width - pen) <= 0.05:
            return
        tracer_votes[host][rgb_key(rgb)] += length
        tracers += 1

    for number, conductor in enumerate(conductors):
        for stroke in getattr(conductor, "inline_tracers", ()):
            absorb(number, stroke.rgb, stroke.width, stroke.length, {stroke.index})

    absorbed = set()
    for number, conductor in enumerate(conductors):
        hosts = containers(conductor.segments, conductor.width, conductor.length, exclude=number)
        hosts = {host: held for host, held in hosts.items() if host not in absorbed}
        if hosts and sum(hosts.values()) >= 0.8 * conductor.length:
            for host, held in hosts.items():
                absorb(host, conductor.base_rgb, conductor.width, held, conductor.members)
            absorbed.add(number)
    taken = {index for conductor in conductors for index in conductor.members}
    for stroke in strokes:
        if stroke.index in taken or stroke.closed:
            continue
        hosts = containers(stroke.segments, stroke.width, stroke.length)
        hosts = {host: held for host, held in hosts.items() if host not in absorbed}
        if hosts and sum(hosts.values()) >= 0.8 * stroke.length:
            for host, held in hosts.items():
                absorb(host, stroke.rgb, stroke.width, held, {stroke.index})

    kept = []
    for number, conductor in enumerate(conductors):
        if number in absorbed:
            continue
        votes = tracer_votes.get(number)
        if votes:
            tracer = votes.most_common(1)[0][0]
            same = tracer == rgb_key(conductor.base_rgb) or \
                colour_class(tracer) == colour_class(conductor.base_rgb) == "dark"
            conductor.tracer_rgb = None if same else tracer
        kept.append(conductor)

    members = {index for conductor in conductors for index in conductor.members}
    return PageHarvest(conductors=kept, pen=pen, members=members, rail_pairs=rail_pairs,
                       tracers=tracers)


def harvest_page(page) -> PageHarvest:
    return harvest_strokes(page_strokes(page.get_drawings()))


# --- atlas ------------------------------------------------------------------------------------


def nearest_conductors(conductors, legends) -> list:
    """(legend, conductor number) for every printed code within reach of a conductor."""
    grid = _SegmentGrid(cell=LEGEND_REACH_PT)
    for number, conductor in enumerate(conductors):
        for a, b in conductor.segments:
            grid.add(number, a, b)
    pairs = []
    for legend in legends:
        point = (legend.x, legend.y)
        best, best_distance = None, LEGEND_REACH_PT
        for number, a, b in grid.near(point):
            distance = _point_segment_distance(point, a, b)
            if distance < best_distance:
                best, best_distance = number, distance
        if best is not None:
            pairs.append((legend, best))
    return pairs


def mark_printed_conflicts(conductors, legends, convention) -> int:
    """Flag conductors whose printed code disagrees with the colour the factory painted.

    On the 2026 SCU sheet the factory printed ``RED 16`` beside pin 2 of C2 and painted that wire
    black, and ``BLACK 16`` beside pin 1 and painted it red. A painter that follows the print is
    doing what the rules require, so such a conductor proves nothing either way: it is reported as
    a factory conflict and kept out of the precision. Returns how many were flagged.
    """
    def colours(code):
        return tuple(convention.colors_bgr.get(part) for part in str(code).split("/"))

    # Only a code printed right on the conductor can contradict it. A code at the end of a leader
    # (6-20 pt away on the classic pages) is too often nearest to a neighbour in the bundle:
    # measured on pubs 91, 2531 and 36, 49 of the 55 disagreements were at 6 pt or more.
    printed = defaultdict(set)
    for legend, number in nearest_conductors(conductors, legends):
        distance = min(_point_segment_distance((legend.x, legend.y), a, b)
                       for a, b in conductors[number].segments)
        if distance < CONFLICT_REACH_PT:
            printed[number].add(legend.code)
    flagged = 0
    for number, conductor in enumerate(conductors):
        conductor.printed_codes = sorted(printed.get(number, ()))
        conductor.factory_conflict = bool(
            conductor.code and printed.get(number)
            and all(colours(code) != colours(conductor.code) for code in printed[number]))
        flagged += conductor.factory_conflict
    return flagged


def legend_votes(conductors, legends) -> Counter:
    """(rgb, role, token) votes from every printed code to the conductor nearest it."""
    votes = Counter()
    for legend, best in nearest_conductors(conductors, legends):
        conductor = conductors[best]
        parts = legend.code.split("/")
        votes[(rgb_key(conductor.base_rgb), "base", parts[0])] += 1
        if len(parts) == 2 and conductor.tracer_rgb is not None:
            votes[(rgb_key(conductor.tracer_rgb), "tracer", parts[1])] += 1
    return votes


def build_atlas(votes: Counter, min_support: int = 2, min_purity: float = 0.6) -> dict:
    """rgb -> token where the printed codes agree; uncoloured fallbacks for black and white."""
    by_colour = defaultdict(Counter)
    for (rgb, _role, token), count in votes.items():
        by_colour[rgb][token] += count
    atlas = {}
    for rgb, tokens in by_colour.items():
        token, count = tokens.most_common(1)[0]
        total = sum(tokens.values())
        if count >= min_support and count / total >= min_purity:
            atlas[rgb] = {"token": token, "support": count, "purity": round(count / total, 3),
                          "votes": dict(tokens)}
    return atlas


def resolve_tokens(conductors, atlas, convention) -> None:
    """Name every conductor's colours from the atlas; black and white need no vote."""
    def token_for(rgb):
        if rgb is None:
            return None
        entry = atlas.get(rgb_key(rgb))
        if entry:
            return entry["token"]
        kind = colour_class(rgb)
        if kind == "dark":
            return _token_named(convention, "SB")
        if kind == "white":
            return convention.white_token
        return None

    for conductor in conductors:
        conductor.base_token = token_for(conductor.base_rgb)
        conductor.tracer_token = token_for(conductor.tracer_rgb)


def _token_named(convention, preferred):
    if preferred in convention.codes:
        return preferred
    black = min(convention.colors_bgr, key=lambda code: sum(convention.colors_bgr[code]))
    return black


# --- twin -------------------------------------------------------------------------------------


def _grey(rgb):
    if rgb is None:
        return None
    luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
    return (luminance, luminance, luminance)


def _int_rgb(value):
    return ((value >> 16) & 255) / 255.0, ((value >> 8) & 255) / 255.0, (value & 255) / 255.0


def build_twin(page, harvest: PageHarvest, document):
    """Append a monochrome twin of ``page`` to ``document`` and return the new page.

    Conductors become one black line on their centreline at the sheet's own drafting pen, the
    weight a monochrome manual draws them with. Every other drawing keeps its geometry with its
    colours turned to grey, and the text is reinserted as text so the printed codes stay exact.
    """
    import fitz

    # Drawings and text are reported in the UNROTATED page space, so the twin is drawn there and
    # given the source's rotation at the end; it then renders exactly like the source. That space
    # is the CROP box, not the media box: the 2026 SCU sheet crops 1608 x 1652 pt out of a
    # 2384 x 1684 pt media box, and a twin of the media box's size threw every overlay off scale.
    cropbox = page.cropbox
    twin = document.new_page(width=cropbox.width, height=cropbox.height)
    shape = twin.new_shape()
    for index, drawing in enumerate(page.get_drawings()):
        if index in harvest.members:
            continue
        drew = False
        for item in drawing.get("items", ()):
            op = item[0]
            if op == "l":
                shape.draw_line(item[1], item[2])
            elif op == "c":
                shape.draw_bezier(item[1], item[2], item[3], item[4])
            elif op == "re":
                shape.draw_rect(item[1])
            elif op == "qu":
                shape.draw_quad(item[1])
            else:
                continue
            drew = True
        if not drew:
            continue
        kind = str(drawing.get("type", ""))
        shape.finish(
            color=_grey(drawing.get("color")) if "s" in kind else None,
            fill=_grey(drawing.get("fill")) if "f" in kind else None,
            width=float(drawing.get("width") or 0.0) or 1.0,
            dashes=drawing.get("dashes") or None,
            closePath=bool(drawing.get("closePath")),
            even_odd=bool(drawing.get("even_odd")),
            lineCap=max(drawing.get("lineCap") or (0,)),
            lineJoin=int(drawing.get("lineJoin") or 0),
        )
    for conductor in harvest.conductors:
        for a, b in conductor.segments:
            shape.draw_line(fitz.Point(*a), fitz.Point(*b))
        # closePath defaults to True in PyMuPDF and would join each polyline's end to its start.
        shape.finish(color=(0, 0, 0), width=harvest.pen, lineCap=1, closePath=False)
    shape.commit()

    for block in page.get_text("dict").get("blocks", ()):
        for line in block.get("lines", ()):
            dx, dy = line.get("dir", (1, 0))
            rotate = 0 if abs(dx) >= abs(dy) and dx > 0 else 180 if abs(dx) >= abs(dy) \
                else 90 if dy < 0 else 270
            for span in line.get("spans", ()):
                text = span.get("text") or ""
                if not text.strip():
                    continue
                twin.insert_text(fitz.Point(*span["origin"]), text,
                                 fontsize=float(span.get("size") or 6.0), fontname="helv",
                                 rotate=rotate, color=_grey(_int_rgb(int(span.get("color", 0)))))
    if page.rotation:
        twin.set_rotation(page.rotation)
    return twin


def displayed_conductors(conductors, page) -> list:
    """Copies of ``conductors`` in the page's displayed (rotated) space, where overlays live."""
    import copy

    import fitz

    if not page.rotation:
        return conductors
    matrix = page.rotation_matrix
    shown = []
    for conductor in conductors:
        clone = copy.copy(conductor)
        clone.segments = [(tuple(fitz.Point(*a) * matrix), tuple(fitz.Point(*b) * matrix))
                          for a, b in conductor.segments]
        shown.append(clone)
    return shown


# --- score ------------------------------------------------------------------------------------


@dataclass
class ConductorScore:
    code: str | None
    length_pt: float
    samples: int
    right: int
    wrong: int
    colours_seen: dict
    verdict: str


def score_overlay(overlay_rgba, page_rect, conductors, convention, probe_pt: float = 1.5,
                  step_px: float = 3.0):
    """Judge a painted overlay of the twin against the factory colour of every conductor.

    Each conductor is sampled along its centreline; at each sample a short probe across it reads
    the exact palette colours painted there. A sample within the probe of another conductor --
    a crossing, a junction, a neighbour in a tight bundle -- is skipped: it cannot say whose paint
    it saw. A conductor is *right* when at least half its samples carry only its own colours and
    every colour of a two-colour code appears; *wrong* when a fifth or more carry a colour it does
    not have, or a two-colour code was painted in one colour; otherwise *missed*.
    """
    import numpy as np

    height, width = overlay_rgba.shape[:2]
    scale = width / float(page_rect.width)
    reach = max(2, int(round(probe_pt * scale)))
    rgb_to_token = defaultdict(set)
    for token, bgr in convention.colors_bgr.items():
        rgb_to_token[(int(bgr[2]), int(bgr[1]), int(bgr[0]))].add(token)

    def same_colour(token_a, token_b):
        return convention.colors_bgr.get(token_a) == convention.colors_bgr.get(token_b)

    grid = _SegmentGrid(cell=max(probe_pt * 4, 8.0))
    for number, conductor in enumerate(conductors):
        for a, b in conductor.segments:
            grid.add(number, a, b)

    alpha = overlay_rgba[:, :, 3]
    results = []
    for number, conductor in enumerate(conductors):
        expected = [conductor.base_token] + (
            [conductor.tracer_token] if conductor.tracer_rgb is not None else [])
        if not all(expected):
            results.append(ConductorScore(code=None, length_pt=conductor.length, samples=0,
                                          right=0, wrong=0, colours_seen={}, verdict="unknown"))
            continue
        if getattr(conductor, "factory_conflict", False):
            results.append(ConductorScore(code="/".join(expected), length_pt=conductor.length,
                                          samples=0, right=0, wrong=0, colours_seen={},
                                          verdict="conflict"))
            continue
        samples = right = wrong = 0
        seen = Counter()
        for a, b in conductor.segments:
            length_px = hypot(b[0] - a[0], b[1] - a[1]) * scale
            steps = max(1, int(length_px // step_px))
            ux, uy = (b[0] - a[0]), (b[1] - a[1])
            norm = hypot(ux, uy) or 1.0
            nx, ny = -uy / norm, ux / norm
            for step in range(steps + 1):
                t = step / steps
                point = (a[0] + ux * t, a[1] + uy * t)
                crowded = any(other != number and _point_segment_distance(point, c, d)
                              <= 2.0 * probe_pt for other, c, d in grid.near(point))
                if crowded:
                    continue
                samples += 1
                found = set()
                for offset in range(-reach, reach + 1):
                    column = int(round((point[0] + nx * offset / scale) * scale))
                    row = int(round((point[1] + ny * offset / scale) * scale))
                    if 0 <= row < height and 0 <= column < width and alpha[row, column] > 0:
                        pixel = tuple(int(v) for v in overlay_rgba[row, column, :3])
                        found |= rgb_to_token.get(pixel, set())
                if not found:
                    continue
                named = {token for token in found
                         if any(same_colour(token, part) for part in expected)}
                stray = found - named
                for token in found:
                    seen[token] += 1
                if stray:
                    wrong += 1
                else:
                    right += 1
        missing_part = len(expected) == 2 and right and not all(
            any(same_colour(token, part) and seen[token] for token in seen) for part in expected)
        if samples and (wrong >= 0.2 * samples or missing_part):
            verdict = "wrong"
        elif samples and right >= 0.5 * samples:
            verdict = "right"
        elif samples:
            verdict = "missed"
        else:
            verdict = "crowded"
        results.append(ConductorScore(code="/".join(expected), length_pt=conductor.length,
                                      samples=samples, right=right, wrong=wrong,
                                      colours_seen=dict(seen), verdict=verdict))

    import cv2

    truth = np.zeros((height, width), dtype=np.uint8)
    for conductor in conductors:
        for a, b in conductor.segments:
            cv2.line(truth, (int(a[0] * scale), int(a[1] * scale)),
                     (int(b[0] * scale), int(b[1] * scale)), 255, 2 * reach + 1)
    painted = alpha > 0
    stray_paint = int((painted & (truth == 0)).sum())
    return results, {"painted_px": int(painted.sum()), "stray_paint_px": stray_paint}


def summarise_scores(results, paint) -> dict:
    counted = [result for result in results if result.verdict in ("right", "wrong", "missed")]
    by_verdict = Counter(result.verdict for result in results)
    length = Counter()
    for result in counted:
        length[result.verdict] += result.length_pt
    total_length = sum(length.values()) or 1.0
    right, wrong = by_verdict["right"], by_verdict["wrong"]
    return {
        "conductors": len(results),
        "scored": len(counted),
        "by_verdict": dict(by_verdict),
        "coverage": round(right / len(counted), 4) if counted else 0.0,
        "coverage_by_length": round(length["right"] / total_length, 4),
        "exact_colour_precision": round(right / (right + wrong), 4) if right + wrong else None,
        "wrong_by_length": round(length["wrong"] / total_length, 4),
        "stray_paint_fraction": round(paint["stray_paint_px"] / paint["painted_px"], 4)
        if paint["painted_px"] else 0.0,
    }
