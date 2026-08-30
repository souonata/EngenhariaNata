"""Page pipeline -- the v1 stage sequence (colorize_wiring_prototype.py), orchestrated over the
extracted modules. P0 scope: raster page image in, legacy full-page repaint out, behaviour-frozen
so the golden harness can prove equivalence against the frozen v1 script.
"""
from __future__ import annotations

import json
import os

import cv2
import numpy as np

from .detect.dashes import filter_terminal_holes, find_unlabelled_frame_roots, solve_dashes
from .detect.components import (
    cut_inline_component_zones,
    extend_boundary_with_inline_components,
    find_inline_component_zones,
)
from .detect.dots import detect_dots, make_dot_near
from .detect.housings import detect_housings, find_dense_pin_border_arcs, make_in_housing
from .detect.skeleton import build_segments, build_wire_mask, find_twist, is_twist_mark
from .detect.solver import solve
from .instrument import diag, ocr_memo
from .labels.filters import filter_labels, filter_margin_labels
from .multiscale import collect_multiscale_evidence
from .paint.legacy import paint_legacy


_ENGINE = None


def _get_engine():
    global _ENGINE
    if _ENGINE is None:
        from .labels.ocr import build_engine
        _ENGINE = build_engine()
    return _ENGINE


def _reocr_region(img, x0, y0, x1, y1, convention, known_labels, allow_bare=False):
    """Local second-chance OCR: 2x upscale, read as-is AND rotated 90 CW (short vertical
    labels only read rotated). Returns STRONG parses (gauge digits or slash, score >= 0.8)
    at page coordinates with orientation and score, excluding tokens the tiled pass already
    read (they belong to the wire they attached to)."""
    from .labels.ocr import merge_ocr_fragments
    from .labels.parse import parse_code, parse_wire_id
    engine = _get_engine()
    crop = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2RGB)
    up = cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    ch = crop.shape[0]
    found = []
    for rotated in (False, True):
        im = cv2.rotate(up, cv2.ROTATE_90_CLOCKWISE) if rotated else up
        tokens = []
        # Memoised when WIRECOLOR_OCR_CACHE is set: the raw engine read is the only expensive
        # step, so replaying it keeps every later decision re-runnable in seconds.
        for box, txt, score in ocr_memo().read(engine, im, (x0, y0, x1, y1, rotated)):
            if score < 0.8:
                continue
            pts0 = [[float(p[0]), float(p[1])] for p in box]
            xs0 = [p[0] for p in pts0]; ys0 = [p[1] for p in pts0]
            tokens.append({
                "raw": str(txt), "score": float(score),
                "cx": sum(xs0) / len(xs0), "cy": sum(ys0) / len(ys0),
                "w": max(xs0) - min(xs0), "h": max(ys0) - min(ys0),
                "box": pts0,
            })
        for token in merge_ocr_fragments(tokens, convention):
            raw = str(token["raw"])
            if not allow_bare and not (any(c.isdigit() for c in raw) or "/" in raw):
                continue
            code = parse_code(raw, convention)
            if not code:
                continue
            box = token["box"]
            if rotated:                      # cw rotation: (xr, yr) -> (x=yr, y=ch-xr)
                pts = [(float(p[1]) / 2, ch - float(p[0]) / 2) for p in box]
            else:
                pts = [(float(p[0]) / 2, float(p[1]) / 2) for p in box]
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            bx, by = sum(xs) / len(xs), sum(ys) / len(ys)
            lx, ly = x0 + bx, y0 + by
            # A weak one-glyph overview token (for example a vertical ``R`` split away from
            # ``25``) must not suppress a complete local read at the same position.  Only an
            # already-strong legend is a duplicate of strong rescue evidence.
            wire_id = parse_wire_id(raw)
            if any(_strong_label(L) and L["code"] == code
                   and abs(L["cx"] - lx) < 18 and abs(L["cy"] - ly) < 18
                   and not (wire_id and parse_wire_id(str(L.get("raw", "")))
                            and wire_id != parse_wire_id(str(L.get("raw", ""))))
                   for L in known_labels):
                continue
            page_box = [[x0 + px, y0 + py] for px, py in pts]
            found.append((code, raw, lx, ly,
                          (max(ys) - min(ys)) > (max(xs) - min(xs)),
                          float(token["score"]), page_box))
    return found


def _strong_label(label):
    raw = str(label.get("raw", "")).upper()
    return (any(ch.isdigit() for ch in raw) or "/" in label.get("code", "")
            or label.get("evidence_source") in {
                "page-code-table", "parallel-bare-bundle",
            })


def resolve_physical_wire_colors(segments, sol, include_bare=False, channel="solid"):
    """Assign one colour to each traced physical wire between hard boundaries.

    Curves do not split a wire. Crossings are already resolved by ``mate``; real splice dots,
    connectors and components are boundaries. If a wire receives conflicting strong labels, each
    label is reconsidered against nearby parallel wires. A label may move only to a candidate wire
    whose other label(s) corroborate the same code. Unresolved conflicts are left unpainted rather
    than producing a mid-wire colour change or a guess.
    """
    from .labels.parse import parse_wire_id, parse_wire_id_strict
    nfind = sol["nfind"]
    live = sol["live"]

    # Collapse tile-overlap and local-audit duplicates while retaining the best-scoring read.
    unique = {}
    for L, home in sol["seeds"]:
        if not include_bare and not _strong_label(L):
            continue
        wire_id = parse_wire_id(str(L.get("raw", "")))
        candidate_roots = tuple(sorted(set(L.get("_candidate_roots", ()))))
        owner_hint = candidate_roots or (nfind(home),)
        key = (L["code"], wire_id, owner_hint,
               round(L["cx"] / 30), round(L["cy"] / 30))
        if key not in unique or L.get("score", 0) > unique[key][0].get("score", 0):
            unique[key] = (L, home)
    seeds = list(unique.values())
    if not seeds:
        sol["seeds"] = []
        sol["unresolved_roots"] = set()
        return {"moved": 0, "unresolved": 0, "changed": 0,
                "ignored_provisional": 0, "resolved_roots": set(),
                "unresolved_roots": set()}

    if include_bare:
        # Ungauged R/SB observations are deliberately weak.  They can fill an otherwise
        # unlabelled route, but can never contradict a gauged or two-colour legend already
        # owned by the same physical wire.
        strong_codes = {}
        for label, home in seeds:
            if _strong_label(label):
                strong_codes.setdefault(nfind(home), set()).add(label["code"])
        seeds = [
            (label, home) for label, home in seeds
            if _strong_label(label)
            or not strong_codes.get(nfind(home))
            or label["code"] in strong_codes[nfind(home)]
        ]
        # Round 16 -- the round-10 rule, applied uniformly to every representation: a LONE bare
        # letter never colours a route by itself.  Dashed enclosure frames ("STARTER MOTOR") run
        # for thousands of pixels past unrelated text, so single glyphs such as 'T' or 'OR' land
        # on them; three such letters on one root make it look labelled, defeat the unlabelled-
        # frame guard, and leave a real conductor unresolved.  A bare code survives only when the
        # root also carries a strong label (the filter above already forces agreement) or when a
        # SECOND reading of the same code sits a label span away on the same root.
        bare_positions = {}
        for label, home in seeds:
            if not _strong_label(label):
                bare_positions.setdefault(
                    (nfind(home), label["code"]), []).append(label)

        def bare_corroborated(label, root):
            return any(
                other is not label
                and ((other["cx"] - label["cx"]) ** 2
                     + (other["cy"] - label["cy"]) ** 2) ** 0.5 > 60.0
                for other in bare_positions.get((root, label["code"]), ()))

        # A short lead running between two hard component boundaries -- a varistor to the engine
        # body, a junction box to the main switch -- carries no room for a gauged legend, so the
        # drawing prints the bare colour beside it and that single letter IS the label.  An
        # enclosure frame is the opposite: unbounded, and long enough to pass unrelated text.
        bounded = set(sol.get("scene_boundary_bounded_roots", ()))
        seeds = [
            (label, home) for label, home in seeds
            if _strong_label(label)
            or strong_codes.get(nfind(home))
            or nfind(home) in bounded
            or bare_corroborated(label, nfind(home))
        ]

    assigned = {i: nfind(home) for i, (_L, home) in enumerate(seeds)}
    assigned_home = {i: home for i, (_L, home) in enumerate(seeds)}

    def grouped():
        out = {}
        for i, root in assigned.items():
            out.setdefault(root, []).append(i)
        return out

    def root_codes(root):
        return {seeds[i][0]["code"] for i, r in assigned.items() if r == root}

    def root_wire_ids(root):
        return {wire_id for i, r in assigned.items() if r == root
                for wire_id in (parse_wire_id(str(seeds[i][0].get("raw", ""))),)
                if wire_id}

    def candidates(L):
        axis = L.get("_wire_axis")
        vertical = axis == "v" if axis in {"h", "v"} \
            else L.get("h", 0) > L.get("w", 0)
        maxd = max(62.0, 0.9 * max(L.get("w", 0), L.get("h", 0)))
        globally_plausible = set(L.get("_candidate_roots", ())) or None
        best = {}
        for si in live:
            root = nfind(si)
            if globally_plausible is not None and root not in globally_plausible:
                continue
            order = segments[si]["order"]
            local = None
            for idx in range(0, len(order), 4):
                y, x = order[idx]
                d2 = (x - L["cx"]) ** 2 + (y - L["cy"]) ** 2
                if d2 > maxd ** 2:
                    continue
                j0, j1 = max(0, idx - 6), min(len(order) - 1, idx + 6)
                dy = abs(order[j1][0] - order[j0][0])
                dx = abs(order[j1][1] - order[j0][1])
                if (dy >= dx) != vertical:
                    continue
                if local is None or d2 < local:
                    local = d2
            if local is None:
                continue
            if root not in best or local < best[root][0]:
                best[root] = (local, si)
        return sorted((d2, root, si) for root, (d2, si) in best.items())

    # Conflict expansion: look to the neighbouring wire and confirm the code at its other end.
    moved = 0
    for _round in range(12):
        conflicts = {root for root, ids in grouped().items()
                     if len({seeds[i][0]["code"] for i in ids}) > 1}
        if not conflicts:
            break
        options = []
        for root in conflicts:
            for i in grouped()[root]:
                L, _home = seeds[i]
                for d2, target, _si in candidates(L):
                    if target == root:
                        continue
                    codes = root_codes(target)
                    wire_id = parse_wire_id(str(L.get("raw", "")))
                    if codes == {L["code"]} or (wire_id and wire_id in root_wire_ids(target)):
                        # Normalized distance plus a tiny OCR-confidence tie-breaker.
                        span = max(62.0, 0.9 * max(L.get("w", 0), L.get("h", 0)))
                        options.append((d2 / (span * span) - 0.01 * L.get("score", 0),
                                        i, target, _si))
        if not options:
            break
        _score, i, target, target_home = min(options)
        diag().record(f"ownership_{channel}", event="moved",
                      code=seeds[i][0]["code"], raw=str(seeds[i][0].get("raw", "")),
                      cx=seeds[i][0]["cx"], cy=seeds[i][0]["cy"],
                      from_root=assigned[i], to_root=target)
        assigned[i] = target
        assigned_home[i] = target_home
        moved += 1

    by_root = grouped()

    # A close-up OCR read is provisional evidence.  It may corroborate an overview label or move
    # to a neighbouring wire whose other end agrees, but one uncorroborated crop token must not
    # erase a coherent physical wire that already owns a full-sheet label.  If independent
    # provisional reads disagree with that overview, keep the root unresolved for human-safe
    # review; otherwise quarantine the lone crop conflict instead of suppressing the conductor.
    ignored_provisional = 0
    for root, ids in list(by_root.items()):
        codes = {seeds[i][0]["code"] for i in ids}
        if len(codes) <= 1:
            continue
        overview = [i for i in ids
                    if seeds[i][0].get("_provenance") != "multiscale"]
        overview_codes = {seeds[i][0]["code"] for i in overview}
        if len(overview_codes) != 1:
            continue
        trusted_code = next(iter(overview_codes))
        # Only a COMPLETE wire id may argue that two legends name different conductors:
        # a clipped read of "(w294)" yields "W29", a different identity out of thin air.
        trusted_ids = {wire_id for i in overview
                       for wire_id in (parse_wire_id_strict(
                           str(seeds[i][0].get("raw", ""))),) if wire_id}
        provisional_conflicts = [i for i in ids
                                 if seeds[i][0].get("_provenance") == "multiscale"
                                 and seeds[i][0]["code"] != trusted_code]
        conflict_codes = {seeds[i][0]["code"] for i in provisional_conflicts}
        independent = False
        overview_points = [(seeds[i][0]["cx"], seeds[i][0]["cy"])
                           for i in overview]
        for code in conflict_codes:
            conflicting = [i for i in provisional_conflicts
                           if seeds[i][0]["code"] == code]
            conflict_ids = [parse_wire_id_strict(str(seeds[i][0].get("raw", "")))
                            for i in conflicting]
            # One unambiguous read at the remote end of a long physical wire is independent
            # evidence even when only one zoom sees it.  Silently discarding it would contradict
            # the end-to-end inspection rule; retain the conflict and leave the route unresolved
            # for further review.  Nearby isolated reads remain quarantined as crop noise.
            for i in conflicting:
                label = seeds[i][0]
                candidate_roots = set(label.get("_candidate_roots", ()))
                conflict_id = parse_wire_id_strict(str(label.get("raw", "")))
                # With an explicit different wire id, an absent candidate list is not proof of
                # ownership: it may be the neighbouring conductor's legend.  A globally unique
                # root mapping, however, is strong enough to preserve the remote contradiction.
                unique_owner = candidate_roots == {root} \
                    or (not candidate_roots and conflict_id is None)
                if unique_owner and overview_points and min(
                        (label["cx"] - ox) ** 2 + (label["cy"] - oy) ** 2
                        for ox, oy in overview_points) >= 420 ** 2:
                    independent = True
                    break
            if independent:
                break
            # A contradictory crop carrying another explicit wire id is evidence about a
            # neighbouring conductor when global geometry did not uniquely map it to this route.
            if trusted_ids and all(conflict_ids) \
                    and set(conflict_ids).isdisjoint(trusted_ids):
                continue
            pts = [(seeds[i][0]["cx"], seeds[i][0]["cy"]) for i in conflicting]
            if any((x1 - x2) ** 2 + (y1 - y2) ** 2 >= 300 ** 2
                   for n, (x1, y1) in enumerate(pts)
                   for x2, y2 in pts[n + 1:]):
                independent = True
                break
        if not independent:
            for i in provisional_conflicts:
                diag().record(f"ownership_{channel}", event="quarantined",
                              code=seeds[i][0]["code"],
                              raw=str(seeds[i][0].get("raw", "")),
                              cx=seeds[i][0]["cx"], cy=seeds[i][0]["cy"],
                              root=root, trusted_code=trusted_code)
                assigned.pop(i, None)
                assigned_home.pop(i, None)
                ignored_provisional += 1

    by_root = grouped()
    unresolved = {root for root, ids in by_root.items()
                  if len({seeds[i][0]["code"] for i in ids}) > 1}
    affected = {nfind(home) for _L, home in seeds} | set(assigned.values())

    # Remove prior closest-label partitions on every affected root, then paint a physical wire
    # uniformly only when its strong labels agree.
    changed = 0
    for si in live:
        if nfind(si) in affected and si in sol["claims"]:
            sol["claims"].pop(si)
            changed += 1
    for root, ids in by_root.items():
        codes = {seeds[i][0]["code"] for i in ids}
        if root in unresolved or len(codes) != 1:
            continue
        code = next(iter(codes)).split("/")
        label_pts = [(seeds[i][0]["cy"], seeds[i][0]["cx"]) for i in ids]
        for si in live:
            if nfind(si) != root:
                continue
            d2 = min((x - lx) ** 2 + (y - ly) ** 2
                     for ly, lx in label_pts for y, x in segments[si]["order"][::5])
            sol["claims"][si] = (d2, code)
            changed += 1

    # Persist final ownership, not the provisional nearest-root attachment.  Later scene
    # competition and cross-representation label reservation must see moved labels on their
    # corroborated root and must not see quarantined crop reads at all.
    sol["seeds"] = [(seeds[i][0], assigned_home[i]) for i in sorted(assigned)]
    sol["unresolved_roots"] = set(unresolved)

    for root, ids in by_root.items():
        diag().record(f"ownership_{channel}", event="root", root=root,
                      unresolved=root in unresolved,
                      codes=sorted({seeds[i][0]["code"] for i in ids}),
                      evidence=[{
                          "code": seeds[i][0]["code"],
                          "raw": str(seeds[i][0].get("raw", "")),
                          "cx": seeds[i][0]["cx"], "cy": seeds[i][0]["cy"],
                          "score": seeds[i][0].get("score"),
                          "provenance": seeds[i][0].get("_provenance", "overview"),
                          "candidate_roots": list(seeds[i][0].get("_candidate_roots", ())),
                      } for i in ids])

    return {"moved": moved, "unresolved": len(unresolved), "changed": changed,
            "ignored_provisional": ignored_provisional,
            "resolved_roots": set(by_root) - unresolved,
            "unresolved_roots": set(unresolved)}


def propagate_through_splices(segments, sol, splice_dots, rounds=12):
    """Give an unlabelled conductor the colour of the wires it is spliced to.

    A splice is one electrical node: the conductors meeting there carry the same potential, and on
    these drawings they normally carry the same colour, the legend simply being printed on one of
    them.  Round 14 made splices hard colour boundaries, which is right for a wire that has its own
    legend -- but it also left every unlabelled continuation black, and that is most of the missing
    colour on a sheet.

    Propagation is agreement-only: a black root adopts a colour ONLY when EVERY coloured root
    at that splice agrees on it.  A splice joining two different colours teaches nothing and the
    wire stays black, so "black beats wrong" is preserved.  Adoption is transitive but revocable:
    if a later round shows an adopted root sitting on a splice whose colours disagree, its colour
    is withdrawn and the withdrawal cascades.
    """
    nfind = sol["nfind"]
    dot_arcs = sol.get("dot_arcs", {})
    if not dot_arcs:
        return {"adopted": 0, "revoked": 0}

    joints = []
    for dot, ports in dot_arcs.items():
        if splice_dots is not None and tuple(dot) not in splice_dots:
            continue
        roots = {nfind(si) for si, _end in ports}
        if len(roots) > 1:
            joints.append(sorted(roots))

    def root_code(root):
        codes = {tuple(sol["claims"][si][1]) for si in sol["live"]
                 if nfind(si) == root and si in sol["claims"]}
        return next(iter(codes)) if len(codes) == 1 else None

    seeded = {root: root_code(root) for joint in joints for root in joint}
    adopted, revoked = {}, 0
    for _round in range(rounds):
        changed = False
        for joint in joints:
            known = {seeded.get(root) for root in joint} - {None}
            if len(known) != 1:
                continue
            colour = next(iter(known))
            for root in joint:
                if seeded.get(root) is None:
                    seeded[root] = colour
                    adopted[root] = colour
                    changed = True
        if not changed:
            break

    # Revocation: an adopted colour that ends up contradicted at another splice is withdrawn.
    for _round in range(rounds):
        contradicted = set()
        for joint in joints:
            colours = {seeded.get(root) for root in joint} - {None}
            if len(colours) > 1:
                contradicted.update(root for root in joint if root in adopted)
        if not contradicted:
            break
        for root in contradicted:
            seeded[root] = None
            adopted.pop(root, None)
            revoked += 1

    for root, colour in adopted.items():
        label_free = [si for si in sol["live"]
                      if nfind(si) == root and si not in sol["claims"]]
        for si in label_free:
            sol["claims"][si] = (10 ** 9, list(colour))
    return {"adopted": len(adopted), "revoked": revoked}


def resolved_label_ids(sol, segments=None):
    """Return label object identities with stable, matching ownership on a painted solid root.

    The dash tracer uses this as a cross-representation ownership reservation.  A token merely
    considered by the solid solver is not enough: its final physical root must be uniformly
    resolved and painted with that same code.  This keeps genuinely unclaimed power-cable labels
    available to the dashed scene while preventing a nearby solid legend from seeding it again.

    Round 16 -- only a real conductor may confiscate a legend.  "The root's claims collapse to
    exactly this code" is satisfied automatically by a root whose ONLY evidence is that label, so
    a 13-point solid fragment -- one dash stroke the solid tracer happened to pick up -- took the
    '70 SB' legend away from the 36-stroke heavy cable it is printed on (pub 2503, starter feed).
    The dash tracer was then left with no strong seed on that line, refused to bridge the gap the
    legend's own printed text erases, and half the physical conductor stayed black.

    A reservation therefore has to be justified by something other than the label itself: either
    the owning root is long enough to be a physical wire by the scene's own definition, or a
    SECOND strong observation of the same code sits on that root at least one label span away (so
    that one printed legend read twice -- by the tiled pass and by a contextual zoom -- cannot
    corroborate itself).
    """
    nfind = sol["nfind"]
    root_codes = {}
    for si, (_d2, codes) in sol["claims"].items():
        root_codes.setdefault(nfind(si), set()).add("/".join(codes))

    minimum_length = float(sol.get("scene_min_wire_length", 300))
    root_length = {}
    if segments is not None:
        for si in sol.get("live", ()):
            root_length[nfind(si)] = root_length.get(nfind(si), 0) + len(segments[si]["order"])

    strong_by_root_code = {}
    for label, home in sol["seeds"]:
        if _strong_label(label):
            strong_by_root_code.setdefault(
                (nfind(home), label["code"]), []).append(label)

    def corroborated(label, root):
        span = max(60.0, 1.5 * max(label.get("w", 0), label.get("h", 0)))
        return any(
            other is not label
            and ((other["cx"] - label["cx"]) ** 2
                 + (other["cy"] - label["cy"]) ** 2) ** 0.5 > span
            for other in strong_by_root_code.get((root, label["code"]), ()))

    stable = set()
    for label, home in sol["seeds"]:
        if not _strong_label(label):
            continue
        root = nfind(home)
        if root_codes.get(root, set()) != {label["code"]}:
            continue
        if root_length.get(root, 0) >= minimum_length or corroborated(label, root):
            stable.add(id(label))
    return stable


def ensure_labels(image_path: str, labels_path: str, convention) -> None:
    if not os.path.exists(labels_path):
        from .labels.ocr import ocr_labels
        with open(labels_path, "w", encoding="utf-8") as handle:
            json.dump(ocr_labels(image_path, convention), handle)
        print(f"OCR labels written to {labels_path}")


def ensure_harvest(image_path: str, harvest_path: str, convention) -> list:
    """One page-wide multi-scale text read, cached beside the tiled pass.

    The tiled pass is kept exactly as it is -- sixteen rounds of user review validated it -- and
    the harvest only ADDS the magnifications it does not cover.  Together they are the drawing's
    complete printed text, read once, so the contextual zooms become queries instead of ~2,100
    further OCR calls.
    """
    if not os.path.exists(harvest_path):
        from .labels.harvest import harvest_labels
        with open(harvest_path, "w", encoding="utf-8") as handle:
            json.dump(harvest_labels(image_path, convention), handle)
    with open(harvest_path, encoding="utf-8") as handle:
        return json.load(handle)["labels"]


def _unseen(harvested, known, reach=22.0):
    """Harvested legends that the page pass did not already report at the same spot."""
    fresh = []
    for label in harvested:
        if any(other["code"] == label["code"]
               and abs(other["cx"] - label["cx"]) < reach
               and abs(other["cy"] - label["cy"]) < reach
               for other in known):
            continue
        fresh.append(label)
    return fresh


def run_page(image_path: str, labels_path: str, convention,
             probe=None, who=None, netends=None, deadends=False,
             harvest_path=None, allow_splice_propagation=False) -> dict:
    """Run detection + solve + dash pass on one raster page. Returns the PageSolution dict
    (segments, claims, dash groups/claims, housings, dots, labels, solver state) -- everything
    the painters and the later verification stack consume."""
    ensure_labels(image_path, labels_path, convention)
    ocr_memo().bind(image_path)

    # The contextual zooms are queries against the page's already-harvested text unless a harvest
    # is unavailable, in which case the original per-window re-OCR is used.  Labels are static
    # page features: re-reading one per interested wire cost ~2,100 OCR calls and ninety minutes.
    harvested = ensure_harvest(image_path, harvest_path, convention) if harvest_path else None
    if harvested is None:
        reocr = _reocr_region
    else:
        from .labels.harvest import labels_in_window

        def reocr(_img, x0, y0, x1, y1, _convention, _known_labels, allow_bare=False):
            # The pool is computed ONCE against the page pass; re-deriving it per lens made this
            # O(pool x known) on every one of ~2,000 calls.  Repeat sightings of the same legend
            # are collapsed by the caller's own duplicate rule, which is where that belongs.
            found = labels_in_window(_lens_pool, x0, y0, x1, y1)
            return found if allow_bare else [
                item for item in found
                if any(ch.isdigit() for ch in str(item[1])) or "/" in item[0]]

    img = cv2.imread(image_path)
    H, W = img.shape[:2]

    with open(labels_path, encoding="utf-8") as handle:
        data = json.load(handle)
    labels = filter_labels(data["labels"])
    # round 7: grid zone letters (P/R/T...) in the page-edge margin are not cable labels
    labels = filter_margin_labels(labels, W, H)
    # The lens pool is what the zoom queries may still discover: harvested text the page pass did
    # not already report, subject to the same margin/designator filters as any other label.
    _lens_pool = _unseen(filter_margin_labels(filter_labels(harvested), W, H), labels) \
        if harvested else []
    if harvested:
        print(f"harvest: {len(_lens_pool)} legends beyond the page pass available to the zooms")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # <210 (not <128): many sheets draw the long harness runs in LIGHT GRAY ink -- a strict
    # threshold erases them from the wire mask entirely, making whole loops untraceable.
    binary = (gray < 210).astype(np.uint8) * 255

    housings = detect_housings(binary, labels, W, H)
    dots = detect_dots(binary, W, H)

    # round 12: a star-shaped splice can yield SEVERAL small distance-transform cores; the
    # fragments split the dot's arc membership, so the ">= 2 painted arcs" joint test saw a
    # terminal and trimmed paint before a REAL splice (splice 8). Cluster overlapping dots.
    _clusters = []
    for (dx, dy, dr) in sorted(dots, key=lambda t: (t[0], t[1])):
        for c in _clusters:
            if abs(c["x"] / c["n"] - dx) <= 15 and abs(c["y"] / c["n"] - dy) <= 15:
                c["x"] += dx; c["y"] += dy; c["n"] += 1
                c["r"] = max(c["r"], dr + 8)      # widened reach covers the merged extent
                break
        else:
            _clusters.append({"x": dx, "y": dy, "n": 1, "r": dr})
    dots = [(round(c["x"] / c["n"]), round(c["y"] / c["n"]), c["r"]) for c in _clusters]
    dot_near = make_dot_near(dots)

    # round 9d: solid connector TICK marks pass the dot detector's size gates but are not
    # electrical joints. Discriminator (measured, cleanly bimodal on pub 2550): the ink blob
    # at a real splice dot has a fat round core (min bbox dimension 24-41 px) while a tick is
    # a thin bar (9-10 px). Terminal dots keep their net-merging role in the solver (the tick
    # belongs to the same wire) but the painter treats them as WIRE ENDS: trim + never paint.
    terminal_dots = set()
    for dx, dy, _r in dots:
        x0, x1 = max(0, dx - 20), min(W, dx + 21)
        y0, y1 = max(0, dy - 20), min(H, dy + 21)
        sub = (binary[y0:y1, x0:x1] > 0).astype(np.uint8)
        n_, lbl_, st_, _ = cv2.connectedComponentsWithStats(sub, 8)
        li = lbl_[dy - y0, dx - x0]
        if li == 0:
            ys_, xs_ = np.nonzero(sub)
            if not len(ys_):
                continue
            d2 = (ys_ - (dy - y0)) ** 2 + (xs_ - (dx - x0)) ** 2
            li = lbl_[ys_[d2.argmin()], xs_[d2.argmin()]]
        if min(st_[li, 2], st_[li, 3]) < 16:
            terminal_dots.add((dx, dy))

    # round 11c: CONNECTOR BLOCK housings from terminal-tick ROWS. Multi-row connectors
    # (POWER CONN style) draw a row of terminal ticks per side with pin symbols and thin
    # pass-through bits between -- no rectangle exists, so nothing protected the interior.
    # Structure, fully generic: >= 3 terminal dots aligned form a row; two rows with
    # overlapping column spans 50-420 px apart enclose a connector block, synthesized as a
    # housing so the wire mask, knockout and TERM_GAP all apply to its interior.
    def _dot_rows(pts, row_axis):           # row_axis 0: cluster by cy (horizontal rows)
        rows = []
        for pt in sorted(pts, key=lambda t: t[1 - row_axis]):
            c_row, c_pos = (pt[1], pt[0]) if row_axis == 0 else (pt[0], pt[1])
            for row in rows:
                if abs(row["c"] - c_row) <= 8 and min(abs(c_pos - p) for p in row["pos"]) <= 220:
                    row["pos"].append(c_pos)
                    row["c"] = (row["c"] * (len(row["pos"]) - 1) + c_row) / len(row["pos"])
                    break
            else:
                rows.append({"c": c_row, "pos": [c_pos]})
        return [r for r in rows if len(r["pos"]) >= 2]

    def _pair_rows(rows, vertical_wires):
        for i, r1 in enumerate(rows):
            for r2 in rows[i + 1:]:
                gap = abs(r1["c"] - r2["c"])
                if not (50 <= gap <= 420):
                    continue
                if min(len(r1["pos"]), len(r2["pos"])) == 2:
                    # 2-pin connectors (round 11d): demand a strict per-column match so two
                    # unrelated aligned wire ends can never synthesize a block.
                    if len(r1["pos"]) != len(r2["pos"]):
                        continue
                    if not all(min(abs(p - q) for q in r2["pos"]) <= 15 for p in r1["pos"]):
                        continue
                lo1, hi1 = min(r1["pos"]), max(r1["pos"])
                lo2, hi2 = min(r2["pos"]), max(r2["pos"])
                inter = min(hi1, hi2) - max(lo1, lo2)
                if inter <= 0 or inter < 0.6 * min(hi1 - lo1, hi2 - lo2):
                    continue
                lo, hi = min(lo1, lo2) - 12, max(hi1, hi2) + 12
                c0, c1 = min(r1["c"], r2["c"]) - 6, max(r1["c"], r2["c"]) + 6
                if vertical_wires:
                    housings.append((int(lo), int(c0), int(hi - lo), int(c1 - c0)))
                else:
                    housings.append((int(c0), int(lo), int(c1 - c0), int(hi - lo)))

    _pair_rows(_dot_rows(terminal_dots, 0), vertical_wires=True)
    _pair_rows(_dot_rows(terminal_dots, 1), vertical_wires=False)
    in_housing = make_in_housing(housings)

    # Small enclosed background regions are used throughout terminal/component reasoning.  Build
    # them once from the unmodified page raster; later semantic filtering decides which are real
    # electrical holes and which are merely counters inside printed colour-code glyphs.
    _inv = (binary == 0).astype(np.uint8)
    _nh, _, _sh, _ch = cv2.connectedComponentsWithStats(_inv, 8)
    holes = [(float(_ch[i][0]), float(_ch[i][1]), int(max(_sh[i, 2], _sh[i, 3])))
             for i in range(1, _nh)
             if 8 <= _sh[i, 4] <= 250 and _sh[i, 2] <= 22 and _sh[i, 3] <= 22]
    del _inv

    wire = build_wire_mask(binary, labels, housings, W, H)

    def prepare_topology(mask):
        """Build arc topology and apply geometry-only exclusions to a page wire mask."""
        prepared_segments = build_segments(mask)
        prepared_twist = find_twist(prepared_segments, labels)
        prepared_bridge_twist = {
            si for si in prepared_twist if is_twist_mark(prepared_segments[si])}

        # Connector borders must be removed from the TOPOLOGY before solving, not merely
        # unpainted afterwards.  Otherwise adjacent pins become a false path through the rim.
        prepared_pin_furniture = find_dense_pin_border_arcs(
            prepared_segments, {si: None for si in range(len(prepared_segments))})
        prepared_twist.update(prepared_pin_furniture)
        if prepared_pin_furniture:
            print("pin_topology_guard: "
                  f"{len(prepared_pin_furniture)} connector arcs excluded before solve")

        # Filled terminal bars, arrows and blobs are several times thicker than cable strokes.
        # Never paint or trace through them and never let a label attach to them.
        distance_to_background = cv2.distanceTransform(binary, cv2.DIST_L2, 3)
        for si, segment in enumerate(prepared_segments):
            if si in prepared_twist:
                continue
            sample = segment["order"][::5] or segment["order"]
            if float(np.median(
                    [distance_to_background[y, x] for y, x in sample])) > 6.0:
                prepared_twist.add(si)
        del distance_to_background
        return (prepared_segments, prepared_twist, prepared_bridge_twist,
                prepared_pin_furniture)

    segments, twist, bridge_twist, pin_furniture_pre = prepare_topology(wire)

    splice_dots = {(dx, dy) for dx, dy, _r in dots if (dx, dy) not in terminal_dots}
    sol = solve(segments, twist, labels, in_housing, dot_near, wire, W, H,
                probe=probe, who=who, netends=netends, deadends=deadends,
                color_boundary_dots=splice_dots | set(terminal_dots))

    # Open contacts and similar small inline components may sit over a faint continuous CAD line.
    # Detect them from a preliminary page-wide topology, cut their complete symbol capsules out of
    # the wire mask, then rebuild and solve.  The cut -- not only a painter knockout -- makes the
    # two component leads distinct physical-wire objects for all later ownership decisions.
    preliminary_members = {}
    for si in sol["live"]:
        preliminary_members.setdefault(sol["nfind"](si), []).append(si)
    conductor_roots = set()
    for root, members in preliminary_members.items():
        points = [point for si in members for point in segments[si]["order"]]
        if not points:
            continue
        ys = [point[0] for point in points]
        xs = [point[1] for point in points]
        span = max(max(xs) - min(xs), max(ys) - min(ys))
        length = sum(len(segments[si]["order"]) for si in members)
        already_coloured = any(si in sol["claims"] for si in members)
        # The detector starts from circular holes, so isolated OCR glyphs are its main false
        # positive.  Require a real route-scale root unless colour ownership already established
        # the object as a conductor.  A 160 px span still admits compact switch/contact leads.
        if already_coloured or (span >= 160 and length >= 160):
            conductor_roots.add(root)
    topology_claims = {
        si: (0, (f"root-{sol['nfind'](si)}",)) for si in sol["live"]
        if sol["nfind"](si) in conductor_roots}
    inline_components = find_inline_component_zones(
        gray, segments, topology_claims, holes)
    if inline_components:
        print(f"inline_component_guard: {len(inline_components)} "
              "contact/component gaps protected and split")
        in_housing = extend_boundary_with_inline_components(
            in_housing, inline_components)
        wire = cut_inline_component_zones(wire, inline_components)
        segments, twist, bridge_twist, pin_furniture_pre = prepare_topology(wire)
        sol = solve(segments, twist, labels, in_housing, dot_near, wire, W, H,
                    probe=probe, who=who, netends=netends, deadends=deadends,
                    color_boundary_dots=splice_dots | set(terminal_dots))

    # Persist the global electrical context for every later zoom.  These objects are not crop-local:
    # a component box, connector or terminal identified in the overview remains a hard semantic
    # boundary when a close-up is inspected.
    sol["housings"] = tuple(housings)
    sol["terminal_dots"] = frozenset(terminal_dots)
    sol["inline_components"] = tuple(inline_components)

    # Multiscale scene analysis supersedes the old capped rescue pass.  A close-up never owns a
    # colour locally: it only adds label evidence to the persistent full-page topology, including
    # short vertical labels that need a rotated 2x read.  Physical-wire ownership is reconciled
    # after the scene reaches an evidence fixpoint.
    solid_scene = None
    stable_solid_labels = set()
    if labels:
        sol["all_labels"] = labels
        _zoom = collect_multiscale_evidence(
            img, segments, sol, convention, W, H, reocr)
        solid_scene = _zoom["scene"]
        if _zoom["recovered"]:
            print("multiscale_scene: "
                  f"{len(_zoom['recovered'])} strong labels added through "
                  f"{_zoom['crops']} contextual zooms")
        _resolved = resolve_physical_wire_colors(segments, sol)
        solid_scene.refresh_evidence(sol["seeds"])
        stable_solid_labels = resolved_label_ids(sol, segments)
        if (_resolved["moved"] or _resolved["unresolved"]
                or _resolved["ignored_provisional"]):
            print("physical_wire_colors: "
                  f"{_resolved['moved']} labels reassigned by other-end corroboration, "
                  f"{_resolved['ignored_provisional']} neighbouring crop reads quarantined, "
                  f"{_resolved['unresolved']} unresolved wires left unpainted")

    # round 12: no painted arc may sit INSIDE a twist zone -- tiny X-arm fragments (6-14 px)
    # get claimed by the neighbouring nets via ink-connected merges and pass the both-ends-
    # connected test, putting colour blobs on the pair-twist symbols. Removal-only.
    _twpts = {}
    for _tsi in twist:
        for (_ty, _tx) in segments[_tsi]["order"][::2]:
            _twpts.setdefault((int(_ty) // 16, int(_tx) // 16), []).append((_ty, _tx))
    if _twpts:
        for _si in list(sol["claims"]):
            o = segments[_si]["order"]
            _my, _mx = o[len(o) // 2]
            _hit = False
            for _dyc in (-1, 0, 1):
                for _dxc in (-1, 0, 1):
                    for (_ty, _tx) in _twpts.get((int(_my) // 16 + _dyc, int(_mx) // 16 + _dxc), []):
                        if abs(_ty - _my) <= 16 and abs(_tx - _mx) <= 16:
                            _hit = True
                            break
                    if _hit:
                        break
                if _hit:
                    break
            if _hit:
                sol["claims"].pop(_si, None)

    # round 7 frame guard (removal-only): an arc living ENTIRELY inside the page-edge band is
    # sheet frame / zone furniture, never a cable -- unpaint it even if a net reached it.
    EDGE_BAND = 120
    edge_excluded = set()
    for si, s in enumerate(segments):
        if all(min(px, py, W - 1 - px, H - 1 - py) < EDGE_BAND for (py, px) in s["order"][::4]):
            edge_excluded.add(si)
    for si in edge_excluded:
        sol["claims"].pop(si, None)

    dgroups, dclaims, dash_unlabelled, dash_open, dash_state = solve_dashes(
        segments, twist, labels, in_housing, terminal_dots, holes,
        frozenset(sol["claims"]), reserved_labels=stable_solid_labels,
        return_state=True)

    # round 13: unlabelled dashed OPTION/ENCLOSURE frames may touch a coloured solid wire at
    # one corner.  The continuity bridge then paints one frame edge as if it were a cable
    # (pub 2476: the bottom of the "FOR 24V SYSTEM" box became red).  Require full rectangle
    # geometry across independent dash roots and remove only those unlabelled roots from OCR
    # rescue / bridge promotion.  Already-labelled dashed cables are never considered here.
    dash_frame_roots = find_unlabelled_frame_roots(dash_unlabelled, segments)
    for _root in dash_frame_roots:
        dash_unlabelled.pop(_root, None)
        dash_open.pop(_root, None)
    if dash_frame_roots:
        print(f"dash_frame_guard: {len(dash_frame_roots)} unlabelled frame sides excluded")

    # Dashed external conductors now enter the same page-wide overview -> endpoint -> route
    # refinement model as solid wires.  This replaces the old independent ``[:40]`` rescue
    # crops: every eligible dashed physical route is retained in page coordinates, local OCR is
    # mapped back globally, and a resolved solid scene competes for ownership of each token.
    eligible_dash = dict(dash_unlabelled)
    eligible_dash.update(dgroups)
    dash_live = [si for members in eligible_dash.values() for si in members]
    dash_seeds = [(label, si) for label, si in dash_state["seeds"]
                  if dash_state["nfind"](si) in eligible_dash]
    dash_claims = {}
    for root, members in dgroups.items():
        d2, codes = dclaims[root]
        for si in members:
            dash_claims[si] = (d2, list(codes))
    dash_sol = {
        "nfind": dash_state["nfind"],
        "live": dash_live,
        "mate": dash_state["mate"],
        "connected_ports": dash_state["connected_ports"],
        "node_port_anchors": dash_state["node_port_anchors"],
        "seeds": dash_seeds,
        "claims": dash_claims,
        "all_labels": labels,
        "housings": tuple(housings),
        "terminal_dots": frozenset(terminal_dots),
        "color_boundary_dots": frozenset(splice_dots),
        "scene_min_wire_length": 60,
        "scene_label_distance": 140.0,
        "scene_allow_lower_right": True,
        "scene_require_hard_boundary": False,
        "scene_bare_evidence_counts": True,
        "scene_allow_bare_ocr": True,
        "scene_boundary_bounded_roots": dash_state["boundary_bounded_short"],
        "inline_components": tuple(inline_components),
        "competing_scenes": [solid_scene] if solid_scene is not None else [],
    }
    dash_unresolved_roots = set()
    if labels and dash_live:
        def _dash_reocr(img_, x0, y0, x1, y1, convention_, known_):
            return reocr(img_, x0, y0, x1, y1, convention_, known_, allow_bare=True)

        _dash_zoom = collect_multiscale_evidence(
            img, segments, dash_sol, convention, W, H, _dash_reocr, channel="dash")
        _dash_resolved = resolve_physical_wire_colors(
            segments, dash_sol, include_bare=True, channel="dash")
        dash_unresolved_roots = set(_dash_resolved["unresolved_roots"])
        if _dash_zoom["recovered"] or _dash_resolved["moved"] \
                or _dash_resolved["unresolved"] \
                or _dash_resolved["ignored_provisional"]:
            print("dash_multiscale_scene: "
                  f"{len(_dash_zoom['recovered'])} labels added, "
                  f"{_dash_resolved['moved']} reassigned, "
                  f"{_dash_resolved['ignored_provisional']} quarantined, "
                  f"{_dash_resolved['unresolved']} routes unresolved")

        # Rebuild the painter contract from uniform route ownership.  Conflicting or still-
        # unlabelled physical routes remain black; one winner can never hide another label.
        root_claims = {}
        for si, (d2, codes) in dash_sol["claims"].items():
            root = dash_state["nfind"](si)
            root_claims.setdefault(root, []).append((d2, tuple(codes)))
        dgroups, dclaims, dash_unlabelled = {}, {}, {}
        for root, members in eligible_dash.items():
            claims = root_claims.get(root, ())
            codes = {code for _d2, code in claims}
            if len(codes) == 1:
                chosen = next(iter(codes))
                dgroups[root] = members
                dclaims[root] = (min(d2 for d2, code in claims if code == chosen),
                                 list(chosen))
            else:
                dash_unlabelled[root] = members

    # Local OCR can add label boxes after the initial dash topology pass.  Recompute the shared
    # terminal-hole set now so glyph counters cannot block solid/dash bridging or punch holes in
    # the final paint.  Keep all raw holes separately for diagnostics and component recognition.
    terminal_holes = filter_terminal_holes(
        holes, labels, in_housing, terminal_dots=terminal_dots,
        inline_components=inline_components)

    # round 11f: DASH <-> SOLID continuity bridge. A cable run often alternates between
    # dashed strokes and thin CONTINUOUS routing lines (staircase jogs, long feeders) --
    # two systems that never shared nets, so half the run stayed black. Link a dash net's
    # open chain end to a collinear free SOLID arc end, then FLOOD colour over the links:
    # an uncoloured node adopts a colour only when ALL its coloured neighbours agree
    # (conflict = stays black). Repeats to a fixpoint so colour crosses several
    # dash/solid alternations.
    from .detect.skeleton import deep_tang as _dtang
    _mate_s = sol["mate"]; _atdot_s = sol["at_dot"]; _nfind = sol["nfind"]
    _boundary_points = [(float(x), float(y)) for x, y in terminal_dots]
    _boundary_points += [(float(x), float(y)) for x, y, _size in terminal_holes]
    _boundary_index = {}
    for _bx, _by in _boundary_points:
        _boundary_index.setdefault((int(_bx) // 64, int(_by) // 64), []).append((_bx, _by))

    def _inside_inline_component(x, y):
        for x1, y1, x2, y2, radius in inline_components:
            dx, dy = x2 - x1, y2 - y1
            denom = dx * dx + dy * dy or 1.0
            t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / denom))
            px, py = x1 + t * dx, y1 + t * dy
            if (x - px) ** 2 + (y - py) ** 2 <= radius * radius:
                return True
        return False

    def _bridge_point_blocked(x, y):
        if in_housing(x, y, 12) or _inside_inline_component(x, y):
            return True
        cx, cy = int(x) // 64, int(y) // 64
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for px, py in _boundary_index.get((cx + dx, cy + dy), ()):
                    if abs(px - x) <= 40 and abs(py - y) <= 40:
                        return True
        return False

    def _bridge_corridor_blocked(a, b):
        ay, ax = a
        by, bx = b
        distance = ((by - ay) ** 2 + (bx - ax) ** 2) ** 0.5
        steps = max(1, int(distance // 10))
        return any(_bridge_point_blocked(
            ax + (bx - ax) * step / steps,
            ay + (by - ay) * step / steps,
        ) for step in range(steps + 1))

    _sfree = []                     # (solid root, arc, port, end(y,x), outward dir)
    for si in sol["live"]:
        for k in (0, 1):
            if (si, k) in _mate_s or (si, k) in _atdot_s:
                continue
            endpoint = segments[si]["ends"][k]
            if _bridge_point_blocked(endpoint[1], endpoint[0]):
                continue
            _sfree.append((_nfind(si), si, (si, k), endpoint,
                           _dtang(segments, si, k, 12)))
    _sidx = {}
    for i, (_r, _si, _port, (ey, ex), _t) in enumerate(_sfree):
        _sidx.setdefault((int(ey) // 96, int(ex) // 96), []).append(i)

    _bridge_candidates = []         # (distance, dash root, dash port, solid root, solid port)
    for _droot, _ports in dash_open.items():
        for (_si, _k, (ey, ex), (ty, tx)) in _ports:
            if _bridge_point_blocked(ex, ey):
                continue
            for _dyc in (-2, -1, 0, 1, 2):
                for _dxc in (-2, -1, 0, 1, 2):
                    for _i in _sidx.get((int(ey) // 96 + _dyc, int(ex) // 96 + _dxc), []):
                        _sroot, _ssi, _sport, (sy, sx), (sty, stx) = _sfree[_i]
                        vy, vx = sy - ey, sx - ex
                        d = (vy * vy + vx * vx) ** 0.5
                        if d < 1 or d > 120:
                            continue
                        uy, ux = vy / d, vx / d
                        if ty * uy + tx * ux <= 0.85 or sty * uy + stx * ux >= -0.85:
                            continue
                        if abs(vy * tx - vx * ty) > 10:
                            continue
                        if _bridge_corridor_blocked((ey, ex), (sy, sx)):
                            continue
                        _bridge_candidates.append(
                            (d, _droot, (_si, _k), _sroot, _sport))

    # One physical endpoint may own at most one representation transition.  Requiring a
    # reciprocal, unambiguous nearest choice prevents a dash end near parallel solid wires from
    # offering its colour to both of them.
    _by_dash, _by_solid = {}, {}
    for candidate in _bridge_candidates:
        _distance, _dr, _dp, _sr, _sp = candidate
        _by_dash.setdefault(_dp, []).append(candidate)
        _by_solid.setdefault(_sp, []).append(candidate)

    def _unique_bridge(candidates):
        ranked = sorted(candidates, key=lambda item: item[0])
        if not ranked:
            return None
        if len(ranked) > 1 and ranked[1][0] - ranked[0][0] < 12:
            return None
        return ranked[0]

    _dash_choices = {port: _unique_bridge(candidates)
                     for port, candidates in _by_dash.items()}
    _solid_choices = {port: _unique_bridge(candidates)
                      for port, candidates in _by_solid.items()}
    _edges = set()
    for candidate in _bridge_candidates:
        _distance, _dr, _dp, _sr, _sp = candidate
        if _dash_choices.get(_dp) is candidate and _solid_choices.get(_sp) is candidate:
            _edges.add((_dr, _sr))

    if _edges:
        _sclaims = sol["claims"]
        _snet_codes = {}
        for _si2, (_d2, _codes2) in _sclaims.items():
            _snet_codes.setdefault(_nfind(_si2), tuple(_codes2))
        _snet_arcs = {}
        for _si2 in sol["live"]:
            _snet_arcs.setdefault(_nfind(_si2), []).append(_si2)
        _blocked_solid = set(sol.get("unresolved_roots", ()))
        _blocked_dash = set(dash_unresolved_roots)
        _bridged_d = _bridged_s = 0
        for _round in range(8):
            _changed = False
            # colours offered to each uncoloured node by its coloured neighbours
            _offers_d, _offers_s = {}, {}
            for (_dr2, _sr2) in _edges:
                dcol = tuple(dclaims[_dr2][1]) if _dr2 in dclaims else None
                scol = _snet_codes.get(_sr2)
                if dcol and not scol and _sr2 not in _blocked_solid:
                    _offers_s.setdefault(_sr2, set()).add(dcol)
                if scol and not dcol and _dr2 in dash_unlabelled \
                        and _dr2 not in _blocked_dash:
                    _offers_d.setdefault(_dr2, set()).add(scol)
            for _sr2, _cols in _offers_s.items():
                if len(_cols) == 1:
                    _codes3 = list(next(iter(_cols)))
                    _snet_codes[_sr2] = tuple(_codes3)
                    for _si3 in _snet_arcs.get(_sr2, ()):
                        if _si3 not in _sclaims:
                            _sclaims[_si3] = (10 ** 8, _codes3)
                    _bridged_s += 1
                    _changed = True
            for _dr2, _cols in _offers_d.items():
                if len(_cols) == 1:
                    _codes3 = list(next(iter(_cols)))
                    dclaims[_dr2] = (10 ** 8, _codes3)
                    dgroups[_dr2] = dash_unlabelled.pop(_dr2)
                    _bridged_d += 1
                    _changed = True
            if not _changed:
                break

        # revocation (black over wrong): an adopted node whose coloured neighbours end up
        # DISAGREEING -- possible when the flood coloured it before the conflicting side
        # got its own colour -- is uncoloured again, cascading until stable.
        _adopted_s = {r for r in _snet_codes
                      if any(_sclaims.get(a, (0, None))[0] == 10 ** 8 for a in _snet_arcs.get(r, ()))}
        _adopted_d = {r for r in dclaims if dclaims[r][0] == 10 ** 8}
        for _round in range(8):
            _revoked = False
            for (_dr2, _sr2) in list(_edges):
                dcol = tuple(dclaims[_dr2][1]) if _dr2 in dclaims else None
                scol = _snet_codes.get(_sr2)
                if not dcol or not scol or dcol == scol:
                    continue
                if _sr2 in _adopted_s:
                    for _si3 in _snet_arcs.get(_sr2, ()):
                        if _sclaims.get(_si3, (0, None))[0] == 10 ** 8:
                            _sclaims.pop(_si3, None)
                    _snet_codes.pop(_sr2, None)
                    _adopted_s.discard(_sr2)
                    _bridged_s -= 1
                    _revoked = True
                elif _dr2 in _adopted_d:
                    dash_unlabelled[_dr2] = dgroups.pop(_dr2)
                    dclaims.pop(_dr2, None)
                    _adopted_d.discard(_dr2)
                    _bridged_d -= 1
                    _revoked = True
            if not _revoked:
                break
        if _bridged_d or _bridged_s:
            print(f"bridge: {_bridged_s} solid nets + {_bridged_d} dashed nets coloured via continuity")

    # round 13b: a large control-unit outline may be interrupted by a dense row of pin
    # circles and therefore fail the closed-rectangle housing detector.  Its horizontal or
    # vertical pieces then inherit the adjacent conductor colours.  Remove only outline arcs
    # backed by >= 4 uniformly gapped perpendicular terminal ends; sparse bus bars remain.
    # An unlabelled conductor spliced to coloured ones takes their colour when they all agree.
    # Runs after the dash pass so it cannot disturb dash candidacy, and before the pin-border
    # guard so any colour it puts on connector furniture is cleaned up again.
    # A splice proves electrical continuity, not the physical colour of every conductor entering
    # it.  This unsafe legacy inference is disabled by default; a controlled replay may opt in
    # explicitly for before/after measurement, but no production caller does so.
    _spliced = propagate_through_splices(segments, sol, splice_dots) \
        if allow_splice_propagation else {"adopted": 0, "revoked": 0}
    if _spliced["adopted"] or _spliced["revoked"]:
        print(f"splice_continuity: {_spliced['adopted']} unlabelled conductors coloured by "
              f"agreeing splices, {_spliced['revoked']} revoked on disagreement")

    pin_border_arcs = pin_furniture_pre | find_dense_pin_border_arcs(segments, sol["claims"])
    for _si in pin_border_arcs:
        sol["claims"].pop(_si, None)
    if pin_border_arcs:
        print(f"pin_border_guard: {len(pin_border_arcs)} connector-border/pin arcs excluded")

    # Final per-arc geometry and paint state.  A route question ("why is this physical wire black
    # at x,y?") is answered from this dump alone: it maps any page coordinate to the arc, its
    # physical root in both representations, and the colour that root ended up owning.
    if diag().enabled:
        _dash_root_of = {si: root for root, members in
                         list(dgroups.items()) + list(dash_unlabelled.items())
                         for si in members}
        for si, segment in enumerate(segments):
            order = segment["order"]
            claim = sol["claims"].get(si)
            droot = _dash_root_of.get(si)
            dclaim = dclaims.get(droot) if droot is not None else None
            diag().record("arcs", si=si,
                          root=sol["nfind"](si) if si in sol["live"] else None,
                          dash_root=droot,
                          points=[[int(p[1]), int(p[0])] for p in order[::10]] or
                                 [[int(order[0][1]), int(order[0][0])]],
                          code="/".join(claim[1]) if claim else None,
                          dash_code="/".join(dclaim[1]) if dclaim else None,
                          excluded=("edge" if si in edge_excluded else
                                    "pin-border" if si in pin_border_arcs else
                                    "twist" if si in twist else None))
        diag().dump()
    ocr_memo().save()

    return dict(img=img, W=W, H=H, labels=labels, housings=housings, dots=dots,
                holes=terminal_holes, all_holes=holes,
                terminal_dots=terminal_dots, segments=segments, twist=twist, solver=sol,
                bridge_twist=bridge_twist,
                inline_components=inline_components,
                edge_excluded=edge_excluded, dgroups=dgroups, dclaims=dclaims,
                dash_frame_roots=dash_frame_roots,
                pin_border_arcs=pin_border_arcs,
                convention=convention)


def paint_page_legacy(solution: dict, out_path: str) -> dict:
    """v1-equivalent full-page repaint + the v1 summary line (P0 golden comparison target)."""
    from .engine.semantics import enforce_raster_semantics

    solution, engineering_semantics = enforce_raster_semantics(
        solution, solution["convention"])
    out, dash_painted = paint_legacy(
        solution["img"], solution["segments"], solution["solver"]["claims"],
        solution["dgroups"], solution["dclaims"], solution["housings"], solution["convention"])
    cv2.imwrite(out_path, out)
    print(f"labels={len(solution['labels'])} painted={solution['solver']['painted']} | "
          f"housings={len(solution['housings'])} dots={len(solution['dots'])} "
          f"segments={len(solution['segments'])} dash_cables={dash_painted} -> {out_path}")
    return dict(dash_painted=dash_painted, engineering_semantics=engineering_semantics)
