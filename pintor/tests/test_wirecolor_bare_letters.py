"""Corroborated bare single-letter recovery, and the gates that keep it safe.

A conductor is sometimes labelled with just ``R`` (the heavy starter reds on pub 34). ``strong_legends``
drops every bare single letter because a lone ``P`` is usually the letter inside a Pressure sensor, not
Pink. ``promote_bare_letters`` rescues one ONLY when it is outside every symbol zone AND corroborated by
a gauged same-colour legend nearby; ``assign_weak_to_leftovers`` then lets it claim only a leftover,
long, non-folded run -- so it never displaces a gauged legend nor paints a connector pin-strip.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

from wirecolor.engine.ownership import OwnedRun, assign_weak_to_leftovers
from wirecolor.labels.conventions import load_convention
from wirecolor.labels.text_layer import Legend, promote_bare_letters

CONV = load_convention("volvo_classic")


def legend(raw, code, x, y, axis="h"):
    return Legend(raw=raw, code=code, x=x, y=y, axis=axis, wire_id=None)


def run(points, code=None):
    return OwnedRun(index=0, points=list(points), code=code, legend_raw=None, distance=None)


class PromoteBareLetters(unittest.TestCase):
    def test_corroborated_bare_R_outside_a_zone_is_promoted(self):
        bare = legend("R", "R", 100, 100)
        gauged = legend("2.5 R", "R", 150, 100)          # a real red cable nearby
        promoted = promote_bare_letters([bare, gauged], [gauged], zones=[], convention=CONV)
        self.assertEqual([p.raw for p in promoted], ["R"])

    def test_bare_P_inside_a_symbol_zone_is_never_promoted(self):
        bare = legend("P", "P", 100, 100)                 # the letter inside a pressure sensor
        gauged = legend("1 P", "P", 150, 100)             # even with a gauged P right next to it
        promoted = promote_bare_letters([bare, gauged], [gauged], zones=[(90, 90, 130, 130)], convention=CONV)
        self.assertEqual(promoted, [])

    def test_uncorroborated_bare_letter_stays_refused(self):
        bare = legend("R", "R", 100, 100)                 # no gauged R anywhere
        self.assertEqual(promote_bare_letters([bare], [], zones=[], convention=CONV), [])

    def test_far_corroboration_does_not_reach(self):
        bare = legend("R", "R", 100, 100)
        gauged = legend("2.5 R", "R", 400, 100)           # 300 px away, beyond the corroboration radius
        self.assertEqual(promote_bare_letters([bare, gauged], [gauged], zones=[], convention=CONV), [])


class AssignWeakToLeftovers(unittest.TestCase):
    def test_claims_a_long_straight_leftover(self):
        r = run([(0, 100), (300, 100)])                   # a 300 px straight free run
        n = assign_weak_to_leftovers([r], [legend("R", "R", 150, 95)], min_run_px=100)
        self.assertEqual((n, r.code), (1, "R"))

    def test_never_displaces_an_owned_run(self):
        owned = run([(0, 100), (300, 100)], code="BL")    # already blue
        assign_weak_to_leftovers([owned], [legend("R", "R", 150, 95)], min_run_px=100)
        self.assertEqual(owned.code, "BL")

    def test_skips_a_short_stub(self):
        r = run([(0, 100), (50, 100)])                    # below min_run_px
        assign_weak_to_leftovers([r], [legend("R", "R", 25, 95)], min_run_px=100)
        self.assertIsNone(r.code)

    def test_skips_a_folded_connector_run(self):
        # ~400 px of length folded into a ~100x2 box: a connector pin-strip zig-zag, not a cable
        zig = run([(0, 100), (100, 100), (0, 101), (100, 101), (0, 102), (100, 102)])
        assign_weak_to_leftovers([zig], [legend("R", "R", 50, 100)], min_run_px=100)
        self.assertIsNone(zig.code)


if __name__ == "__main__":
    unittest.main()
