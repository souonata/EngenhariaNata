"""Page-wide scene memory and object-centric OCR refinement.

The sheet is never interpreted as a collection of independent image tiles.  The topology
solver first creates physical-wire objects in page coordinates.  OCR crops are then only
zoom lenses over that persistent scene: every token is mapped back to candidate wires on the
whole page, and colour ownership is reconciled only after all newly observed evidence has
been accumulated.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from math import hypot

from .instrument import diag


def _strong(label):
    raw = str(label.get("raw", "")).upper()
    return any(ch.isdigit() for ch in raw) or "/" in label.get("code", "")


def _axis(segment):
    ys = [p[0] for p in segment["order"]]
    xs = [p[1] for p in segment["order"]]
    dy, dx = max(ys) - min(ys), max(xs) - min(xs)
    if dy >= 1.5 * max(dx, 1):
        return "v"
    if dx >= 1.5 * max(dy, 1):
        return "h"
    return None


@dataclass(frozen=True)
class WireEndpoint:
    segment: int
    end: int
    x: float
    y: float
    axis: str | None
    boundary: str


@dataclass(frozen=True)
class DiagramObject:
    """A non-wire electrical object retained in the same page-wide coordinate system."""

    object_id: str
    kind: str
    bbox: tuple[int, int, int, int]


@dataclass
class PhysicalWire:
    """One globally traced conductor between hard electrical boundaries."""

    root: int
    segments: tuple[int, ...]
    bbox: tuple[int, int, int, int]
    length: int
    endpoints: tuple[WireEndpoint, ...]
    evidence: list[tuple[dict, int]] = field(default_factory=list)

    @property
    def codes(self):
        return {label["code"] for label, _home in self.evidence if _strong(label)}


@dataclass(frozen=True)
class ZoomWindow:
    """A contextual lens over a wire object, always expressed in full-page coordinates."""

    target_root: int
    x0: int
    y0: int
    x1: int
    y1: int
    detail: tuple[int, int, int, int] | None
    reason: str


class PageScene:
    """Persistent page coordinate system shared by every overview and zoom operation."""

    def __init__(self, segments, solution, width, height):
        self.segments = segments
        self.solution = solution
        self.width = width
        self.height = height
        self.wires: dict[int, PhysicalWire] = {}
        self.objects: list[DiagramObject] = []
        self.segment_roots: dict[int, int] = {}
        self.segment_axes: dict[int, str | None] = {}
        self._spatial_cell = 96
        self._spatial: dict[tuple[int, int], set[int]] = {}
        # Different conductor representations share the same global-scene machinery.  Solid
        # skeleton wires keep the conservative defaults; sparse external/dashed conductors may
        # opt into shorter objects, a wider label offset and the lower-right power-circuit area.
        self.min_wire_length = int(solution.get("scene_min_wire_length", 300))
        self.label_distance = float(solution.get("scene_label_distance", 65.0))
        self.allow_lower_right = bool(solution.get("scene_allow_lower_right", False))
        self.require_hard_boundary = bool(solution.get("scene_require_hard_boundary", True))
        self.bare_evidence_counts = bool(solution.get("scene_bare_evidence_counts", False))
        # The sheet's own printing convention, voted by unambiguous attachments: how far and on
        # which side a legend is printed from its conductor.  This is what makes a dense bundle
        # of parallel wires readable to a human, and it is measured, never assumed.
        self.label_offset = dict(solution.get("label_side_offset", {}) or {})
        self.boundary_bounded_roots = set(
            solution.get("scene_boundary_bounded_roots", ()))
        self._build_objects()
        self._build_wires()
        self._build_spatial_index()
        self.refresh_evidence(solution.get("seeds", ()))

    def _build_objects(self):
        for i, (x, y, w, h) in enumerate(self.solution.get("housings", ())):
            self.objects.append(DiagramObject(
                f"component-{i}", "component-or-connector", (x, y, x + w, y + h)))
        for i, (x, y) in enumerate(sorted(self.solution.get("color_boundary_dots", ()))):
            self.objects.append(DiagramObject(
                f"splice-{i}", "splice", (x - 20, y - 20, x + 20, y + 20)))
        for i, (x, y) in enumerate(sorted(self.solution.get("terminal_dots", ()))):
            self.objects.append(DiagramObject(
                f"terminal-{i}", "terminal", (x - 20, y - 20, x + 20, y + 20)))
        for i, (x1, y1, x2, y2, radius) in enumerate(
                self.solution.get("inline_components", ())):
            self.objects.append(DiagramObject(
                f"inline-component-{i}", "component-or-connector",
                (min(x1, x2) - radius, min(y1, y2) - radius,
                 max(x1, x2) + radius, max(y1, y2) + radius)))

    def object_at(self, x, y, kinds=None, margin=0):
        for obj in self.objects:
            if kinds is not None and obj.kind not in kinds:
                continue
            x0, y0, x1, y1 = obj.bbox
            if x0 - margin <= x <= x1 + margin and y0 - margin <= y <= y1 + margin:
                return obj
        return None

    def _endpoint_boundary(self, x, y):
        obj = self.object_at(x, y, {"splice", "terminal"}, margin=8)
        if obj:
            return obj.kind
        obj = self.object_at(x, y, {"component-or-connector"}, margin=35)
        return obj.kind if obj else "open-or-unclassified"

    def _build_wires(self):
        nfind = self.solution["nfind"]
        grouped = {}
        for si in self.solution["live"]:
            grouped.setdefault(nfind(si), []).append(si)

        mate = self.solution.get("mate", {})
        connected_ports = self.solution.get("connected_ports", ())
        node_port_anchors = self.solution.get("node_port_anchors", {})
        for root, members in grouped.items():
            all_points = [p for si in members for p in self.segments[si]["order"]]
            ys = [p[0] for p in all_points]
            xs = [p[1] for p in all_points]
            endpoints = []
            for si in members:
                for k, (y, x) in enumerate(self.segments[si]["ends"]):
                    # An unmatched port includes genuine wire ends, component/connector ports,
                    # and splice boundaries.  Those are exactly the useful zoom-out anchors.
                    port = (si, k)
                    if port in mate:
                        continue
                    if port in connected_ports:
                        nx, ny = node_port_anchors.get(port, (x, y))
                        endpoints.append(WireEndpoint(
                            si, k, nx, ny, _axis(self.segments[si]), "splice"))
                    else:
                        endpoints.append(WireEndpoint(
                            si, k, x, y, _axis(self.segments[si]),
                            self._endpoint_boundary(x, y)))
            self.wires[root] = PhysicalWire(
                root=root,
                segments=tuple(members),
                bbox=(min(xs), min(ys), max(xs), max(ys)),
                length=sum(len(self.segments[si]["order"]) for si in members),
                endpoints=tuple(endpoints),
            )
            for si in members:
                self.segment_roots[si] = root
                self.segment_axes[si] = _axis(self.segments[si])

    def _build_spatial_index(self):
        """Index the global scene; this accelerates lookup without narrowing its meaning."""
        cell = self._spatial_cell
        for si in self.segment_roots:
            for y, x in self.segments[si]["order"][::5]:
                self._spatial.setdefault((int(x) // cell, int(y) // cell), set()).add(si)

    def refresh_evidence(self, seeds):
        for wire in self.wires.values():
            wire.evidence.clear()
        nfind = self.solution["nfind"]
        for label, home in seeds:
            root = nfind(home)
            if root in self.wires:
                self.wires[root].evidence.append((label, home))

    def rank_roots(self, x, y, vertical, max_distance=65.0, conductor_only=False):
        """Return globally ranked wire candidates for a token seen through any zoom lens.

        ``conductor_only`` is used when another representation competes for an OCR token.  Its
        tiny skeleton objects can include strokes from the token's own glyph; only a root which
        passes that scene's normal length and electrical-context gates is allowed to veto the
        target scene.
        """
        wanted = "v" if vertical else "h"
        best = {}
        cell = self._spatial_cell
        cx, cy = int(x) // cell, int(y) // cell
        radius = max(1, int(max_distance) // cell + 1)
        nearby = set()
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                nearby.update(self._spatial.get((cx + dx, cy + dy), ()))
        for si in nearby:
            if self.segment_axes[si] != wanted:
                continue
            segment = self.segments[si]
            d2 = min((px - x) ** 2 + (py - y) ** 2
                     for py, px in segment["order"][::5])
            root = self.segment_roots[si]
            if conductor_only:
                wire = self.wires[root]
                final_codes = {
                    tuple(self.solution.get("claims", {}).get(member, (None, ()))[1])
                    for member in wire.segments
                    if self.solution.get("claims", {}).get(member, (None, ()))[1]
                }
                if root in self.solution.get("unresolved_roots", ()) \
                        or wire.length < self.min_wire_length \
                        or not self.is_conductor_candidate(wire) \
                        or len(final_codes) != 1:
                    continue
            if d2 <= max_distance ** 2 and (root not in best or d2 < best[root][0]):
                best[root] = (d2, si)
        return sorted((d2, root, si) for root, (d2, si) in best.items())

    def signed_offset(self, si, lx, ly):
        """Signed distance from a legend to one candidate conductor, across the wire's axis."""
        axis = self.segment_axes.get(si)
        if axis not in {"h", "v"}:
            return None
        order = self.segments[si]["order"]
        if axis == "v":
            line = sum(point[1] for point in order) / len(order)
            return line - lx
        line = sum(point[0] for point in order) / len(order)
        return line - ly

    def offset_prior(self, si):
        """The sheet's voted legend offset for this conductor's orientation, if it has one."""
        axis = self.segment_axes.get(si)
        if axis == "v":
            voted = self.label_offset.get("vertical")
            votes = self.label_offset.get("vertical_votes", 0)
        elif axis == "h":
            voted = self.label_offset.get("horizontal")
            votes = self.label_offset.get("horizontal_votes", 0)
        else:
            return None
        if not voted or abs(voted) < 8 or votes < 3:
            return None
        return voted

    def best_by_printing_convention(self, plausible, lx, ly, margin=1.6):
        """Pick the owner of a legend among parallel candidates using the sheet's own convention.

        Round 16 measured this as the single largest source of unpainted wire on pub 2503: 139
        observations were discarded as ``ambiguous-roots-no-corroboration`` -- more than were
        accepted -- because in a dense harness a legend is always within reach of several parallel
        conductors.  Requiring one of them to be corroborated ALREADY deadlocks a bundle where
        none is labelled yet: no legend can attach, so no wire gets evidence, so no legend can
        attach.  The drawing resolves it the way a reader does: legends are printed at a
        consistent side and distance from their own conductor, so the candidate matching that
        measured offset wins -- and only when it is decisively better than the runner-up.
        """
        scored = []
        for distance2, root, si in plausible:
            voted = self.offset_prior(si)
            offset = self.signed_offset(si, lx, ly)
            if voted is None or offset is None:
                continue
            if (offset > 0) != (voted > 0):        # printed on the wrong side entirely
                continue
            scored.append((abs(abs(offset) - abs(voted)), root, si))
        if not scored:
            return None
        scored.sort()
        if len(scored) > 1:
            best, runner_up = scored[0][0], scored[1][0]
            if best * margin > runner_up and scored[0][1] != scored[1][1]:
                return None                        # genuinely ambiguous: leave the wire black
        return scored[0]

    def is_conductor_candidate(self, wire):
        """Use electrical context to distinguish an unlabelled wire from drawing furniture."""
        if wire.codes or (self.bare_evidence_counts and wire.evidence):
            return True
        hard = {"splice", "terminal", "component-or-connector"}
        if self.require_hard_boundary and not any(
                endpoint.boundary in hard for endpoint in wire.endpoints):
            return False
        # Sheet frames and zone rulers can be very long and occasionally terminate beside a
        # detected box.  A real conductor does not spend almost all of its path in the A0 margin.
        sampled = [point for si in wire.segments
                   for point in self.segments[si]["order"][::20]]
        if sampled:
            edge = sum(min(x, y, self.width - 1 - x, self.height - 1 - y) < 120
                       for y, x in sampled)
            if edge / len(sampled) >= 0.85:
                return False
        x0, y0, _x1, _y1 = wire.bbox
        if not self.allow_lower_right and x0 > 0.62 * self.width and y0 > 0.70 * self.height:
            return False
        return True

    def _window(self, root, x, y, axis, reason):
        if axis == "v":
            context = (x - 200, y - 720, x + 200, y + 720)
            detail = (x - 110, y - 390, x + 110, y + 390)
        elif axis == "h":
            context = (x - 720, y - 200, x + 720, y + 200)
            detail = (x - 390, y - 110, x + 390, y + 110)
        else:
            context = (x - 460, y - 460, x + 460, y + 460)
            detail = (x - 260, y - 260, x + 260, y + 260)

        def clip(box):
            x0, y0, x1, y1 = box
            return (max(0, int(x0)), max(0, int(y0)),
                    min(self.width, int(x1)), min(self.height, int(y1)))

        c = clip(context)
        d = clip(detail)
        return ZoomWindow(root, *c, d if d != c else None, reason)

    def zoom_plan(self, detail_level=0):
        """Plan contextual zooms for every uncertain wire, with no page-wide crop quota.

        The overview is the existing full-sheet OCR plus the global topology.  A wire with one
        strong label is checked at every remote hard boundary; an unlabelled or conflicting wire
        is followed throughout its geometry.  Overlap is deduplicated, but no wire is dropped to
        satisfy an arbitrary performance cap.
        """
        windows = []
        seen = set()
        for root, wire in sorted(self.wires.items(), key=lambda item: -item[1].length):
            minimum_length = 18 if root in self.boundary_bounded_roots \
                else self.min_wire_length
            if wire.length < minimum_length:
                continue
            if not self.is_conductor_candidate(wire):
                continue
            evidence_points = [(label["cy"], label["cx"])
                               for label, _home in wire.evidence if _strong(label)]
            codes = wire.codes
            anchors = []
            if len(codes) == 1 and detail_level == 0:
                for endpoint in wire.endpoints:
                    distance = min((hypot(endpoint.y - ey, endpoint.x - ex)
                                    for ey, ex in evidence_points), default=float("inf"))
                    if distance >= 420:
                        anchors.append((endpoint.x, endpoint.y, endpoint.axis, "remote-end"))
            else:
                # With no trustworthy label, or with disagreement, examine the whole traced
                # object rather than a square containing only an arbitrary fragment of it.  The
                # first zoom level checks electrically meaningful ends; only an inconclusive wire
                # advances to full route-following at the next level.
                reason = "unlabelled" if not codes else (
                    "conflict" if len(codes) > 1 else "route-audit")
                if detail_level == 0:
                    anchors.extend((endpoint.x, endpoint.y, endpoint.axis, reason)
                                   for endpoint in wire.endpoints)
                    if not wire.endpoints:
                        x0, y0, x1, y1 = wire.bbox
                        anchors.append(((x0 + x1) / 2, (y0 + y1) / 2, None, reason))
                else:
                    for si in wire.segments:
                        segment = self.segments[si]
                        order = segment["order"]
                        # Context lenses span 1,440 px along an axis.  Sampling every 1,000 px and
                        # deduplicating on a 600 px page grid follows the complete object with overlap
                        # without repeatedly OCRing the same junction from each constituent arc.
                        stride = 1000
                        indices = {0, len(order) - 1}
                        indices.update(range(stride, len(order), stride))
                        for idx in sorted(indices):
                            y, x = order[idx]
                            anchors.append((x, y, _axis(segment), reason))

            for x, y, axis, reason in anchors:
                # This only removes heavily overlapping lenses over the same global object.
                grid = 600 if reason in {"unlabelled", "conflict", "route-audit"} else 260
                key = (root, round(x / grid), round(y / grid), axis, reason)
                if key in seen:
                    continue
                seen.add(key)
                windows.append(self._window(root, x, y, axis, reason))
        return windows


def collect_multiscale_evidence(img, segments, solution, convention, width, height,
                                reocr_region, channel="solid"):
    """Iteratively zoom uncertain global wire objects until the evidence reaches a fixpoint."""
    from .labels.parse import parse_wire_id

    scene = PageScene(segments, solution, width, height)
    for root, wire in scene.wires.items():
        diag().record(f"scene_{channel}", root=root, bbox=list(wire.bbox),
                      length=wire.length, segments=len(wire.segments),
                      conductor=scene.is_conductor_candidate(wire),
                      codes=sorted(wire.codes),
                      boundaries=sorted({e.boundary for e in wire.endpoints}))
    known = solution["all_labels"]
    recovered = []
    processed = set()
    crop_count = 0
    detail_level = 0

    while True:
        planned = []
        for window in scene.zoom_plan(detail_level):
            key = (window.target_root, window.x0, window.y0, window.x1, window.y1, window.reason)
            if key not in processed:
                processed.add(key)
                planned.append(window)
        if not planned:
            if detail_level == 0:
                detail_level = 1
                continue
            break
        conductor_count = sum(scene.is_conductor_candidate(wire)
                              for wire in scene.wires.values())
        print(f"multiscale_scene: overview retained {len(scene.wires)} topology objects, "
              f"{conductor_count} are conductor candidates; examining {len(planned)} "
              f"contextual lenses at refinement level {detail_level + 1}")

        added_this_round = 0
        for window in planned:
            contextual = reocr_region(
                img, window.x0, window.y0, window.x1, window.y1, convention, known)
            crop_count += 1
            mapped_to_target = False

            def accept(found):
                nonlocal added_this_round, mapped_to_target

                def note(obs, decision, **extra):
                    """Record why a recognised token did or did not become wire evidence."""
                    diag().record(f"evidence_{channel}", decision=decision,
                                  code=obs[0], raw=str(obs[1]),
                                  cx=round(float(obs[2]), 1), cy=round(float(obs[3]), 1),
                                  score=round(float(obs[5]), 3),
                                  window=[window.x0, window.y0, window.x1, window.y1],
                                  window_reason=window.reason,
                                  target_root=window.target_root, **extra)

                for observation in found:
                    code, raw, lx, ly, vertical, score = observation[:6]
                    observed_box = observation[6] if len(observation) > 6 else None
                    bare = not any(ch.isdigit() for ch in str(raw)) and "/" not in code
                    if bare and not solution.get("scene_allow_bare_ocr", False):
                        note(observation, "bare-not-allowed")
                        continue
                    # Component annotations, pin numbers and actuator letters are contextual
                    # evidence about a boundary, not wire-colour labels.  Keep them out of colour
                    # ownership even when OCR happens to parse one as a valid colour code.
                    if scene.object_at(lx, ly, {"component-or-connector"}, margin=5):
                        note(observation, "inside-component")
                        continue
                    ranked = scene.rank_roots(
                        lx, ly, vertical, max_distance=scene.label_distance)
                    # A one-glyph OCR box often reports a vertical orientation even when the
                    # printed code belongs to a horizontal cable.  For weak bare evidence inspect
                    # both axes, then require one uniquely supported periodic physical line.
                    if bare:
                        ranked += scene.rank_roots(
                            lx, ly, not vertical, max_distance=scene.label_distance)
                        best_by_root = {}
                        for item in ranked:
                            if item[1] not in best_by_root or item[0] < best_by_root[item[1]][0]:
                                best_by_root[item[1]] = item
                        ranked = sorted(best_by_root.values())
                    if not ranked:
                        note(observation, "no-root-in-range")
                        continue
                    # A dashed-wire audit still sees the complete page.  If the token is at least
                    # as plausible on an already-built solid scene, leave it unowned here instead
                    # of letting two independent passes claim the same printed legend.
                    competing = []
                    for other in solution.get("competing_scenes", ()):
                        competing.extend(other.rank_roots(
                            lx, ly, vertical, max_distance=other.label_distance,
                            conductor_only=True))
                        if bare:
                            competing.extend(other.rank_roots(
                                lx, ly, not vertical, max_distance=other.label_distance,
                                conductor_only=True))
                    if competing:
                        foreign_d2 = min(item[0] for item in competing)
                        own_d2 = ranked[0][0]
                        if foreign_d2 <= max(own_d2 * 1.20, own_d2 + 8.0 ** 2):
                            note(observation, "reserved-by-competing-scene",
                                 own_distance=round(own_d2 ** 0.5, 1),
                                 foreign_distance=round(foreign_d2 ** 0.5, 1))
                            continue
                    best_distance = ranked[0][0] ** 0.5
                    plausible = [(d2, root, si) for d2, root, si in ranked
                                 if d2 ** 0.5 <= min(
                                     scene.label_distance,
                                     1.8 * max(best_distance, 1.0))]
                    if not plausible:
                        note(observation, "beyond-label-distance",
                             best_distance=round(best_distance, 1))
                        continue
                    _d2, home_root, home = plausible[0]
                    owner_corroborated = False
                    if bare:
                        if len({root for _distance, root, _segment in plausible}) != 1:
                            note(observation, "bare-multiple-roots")
                            continue
                        axis = scene.segment_axes.get(home)
                        if axis not in {"h", "v"}:
                            note(observation, "bare-no-axis", root=home_root)
                            continue
                        segment = segments[home]
                        home_line = sum(
                            point[1] if axis == "v" else point[0]
                            for point in segment["order"]
                        ) / len(segment["order"])
                        positions = []
                        for si in scene.wires[home_root].segments:
                            if scene.segment_axes.get(si) != axis:
                                continue
                            order = segments[si]["order"]
                            line = sum(
                                point[1] if axis == "v" else point[0]
                                for point in order
                            ) / len(order)
                            if abs(line - home_line) > 12:
                                continue
                            positions.append(sum(
                                point[0] if axis == "v" else point[1]
                                for point in order
                            ) / len(order))
                        label_position = ly if axis == "v" else lx
                        bounded_short = home_root in scene.boundary_bounded_roots
                        if bounded_short and score < 0.95:
                            note(observation, "bare-short-route-low-score", root=home_root)
                            continue
                        minimum_support = 2 if bounded_short else 3
                        if len(positions) < minimum_support \
                                or not any(pos < label_position - 12 for pos in positions) \
                                or not any(pos > label_position + 12 for pos in positions):
                            note(observation, "bare-no-periodic-support", root=home_root,
                                 support=len(positions), required=minimum_support)
                            continue
                        vertical = axis == "v"
                    else:
                        plausible_roots = {root for _distance, root, _segment in plausible}
                        wire_id = parse_wire_id(str(raw))
                        corroborated = set()
                        for root in plausible_roots:
                            for prior, _prior_home in scene.wires[root].evidence:
                                prior_id = parse_wire_id(str(prior.get("raw", "")))
                                if _strong(prior) and (
                                        prior["code"] == code
                                        or (wire_id and prior_id == wire_id)):
                                    corroborated.add(root)
                                    break
                        if len(plausible_roots) > 1:
                            # MEASURED DEAD END (round 16): choosing the owner per-label from the
                            # sheet's voted legend offset cut this rejection from 139 to 7, but
                            # coverage FELL (52.3% -> 50.6% of ink, unresolved 1 -> 4) because at
                            # ~40 px wire spacing and a ~40 px legend offset it cannot tell wire N
                            # from wire N+1, and each wrong attachment quarantines a whole route.
                            # A bundle must be solved as a one-to-one assignment across all its
                            # legends at once -- the way detect/dashes.py already does it -- not as
                            # independent nearest-neighbour decisions. Until then, stay black.
                            if len(corroborated) != 1:
                                note(observation, "ambiguous-roots-no-corroboration",
                                     roots=sorted(plausible_roots),
                                     corroborated=sorted(corroborated))
                                continue
                            home_root = next(iter(corroborated))
                            plausible = [item for item in plausible if item[1] == home_root]
                            _d2, _root, home = plausible[0]
                        owner_corroborated = bool(corroborated)
                        if score < 0.90 and not owner_corroborated:
                            note(observation, "low-score-uncorroborated", root=home_root)
                            continue
                    candidate_roots = tuple(sorted({root for _d, root, _s in plausible}))
                    if observed_box:
                        box = [[float(x), float(y)] for x, y in observed_box]
                        box_xs = [point[0] for point in box]
                        box_ys = [point[1] for point in box]
                        label_w = max(box_xs) - min(box_xs)
                        label_h = max(box_ys) - min(box_ys)
                    else:
                        label_w = 30 if vertical else 120
                        label_h = 120 if vertical else 30
                        box = [[lx - label_w / 2, ly - label_h / 2],
                               [lx + label_w / 2, ly - label_h / 2],
                               [lx + label_w / 2, ly + label_h / 2],
                               [lx - label_w / 2, ly + label_h / 2]]
                    label = {
                        "code": code, "raw": raw, "score": round(score, 3),
                        "cx": lx, "cy": ly,
                        "w": label_w,
                        "h": label_h,
                        "box": box,
                        # Keep every globally plausible owner so later other-end
                        # corroboration can correct a nearest-neighbour attachment.
                        "_candidate_roots": list(candidate_roots),
                        "_provenance": "multiscale",
                        # Which representation's lens observed this token.  Recovered labels are
                        # appended to the shared page list, so consumers must be able to tell a
                        # foreign scene's contextual read from page-level evidence.
                        "_channel": channel,
                    }
                    if bare:
                        label["_wire_axis"] = "v" if vertical else "h"
                    wire_id = parse_wire_id(str(raw))
                    duplicate = None
                    for prior, prior_home in recovered:
                        prior_values = prior.get("_candidate_roots")
                        if prior_values is None:
                            prior_values = (scene.segment_roots.get(prior_home),)
                        prior_roots = tuple(sorted(
                            {root for root in prior_values if root is not None}))
                        if prior["code"] == code \
                                and parse_wire_id(str(prior.get("raw", ""))) == wire_id \
                                and prior_roots == candidate_roots \
                                and abs(prior["cx"] - lx) < 50 \
                                and abs(prior["cy"] - ly) < 50:
                            duplicate = prior
                            break
                    if duplicate is not None:
                        if label["score"] > duplicate.get("score", 0):
                            duplicate.update({key: value for key, value in label.items()
                                              if key not in {"_candidate_roots"}})
                        note(observation, "duplicate", root=home_root)
                        continue
                    note(observation, "accepted", root=home_root,
                         candidate_roots=list(candidate_roots), bare=bare)
                    recovered.append((label, home))
                    known.append(label)
                    added_this_round += 1
                    prior_codes = scene.wires[home_root].codes
                    conflicts_with_prior = bool(prior_codes and code not in prior_codes)
                    if not conflicts_with_prior and (
                            home_root == window.target_root
                            or window.target_root in label["_candidate_roots"]):
                        mapped_to_target = True

            accept(contextual)
            # Zoom in only when the context view did not explain the target object.  The result
            # still returns to the same global scene; it never becomes a local colour decision.
            if not mapped_to_target and window.detail:
                x0, y0, x1, y1 = window.detail
                accept(reocr_region(img, x0, y0, x1, y1, convention, known))
                crop_count += 1

        if added_this_round:
            solution["seeds"].extend(recovered[-added_this_round:])
            scene.refresh_evidence(solution["seeds"])
            detail_level = 0
        elif detail_level == 0:
            detail_level = 1
        else:
            break

    return {"recovered": recovered, "crops": crop_count, "scene": scene}
