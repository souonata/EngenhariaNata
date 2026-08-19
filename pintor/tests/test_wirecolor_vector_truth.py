"""Tests for ground truth derived from vector geometry.

The property that makes this whole approach worth anything is the junction/crossing distinction:

    two cables that CROSS must stay two conductors;
    a stroke that ENDS on another must join it.

Raster tracing has to guess that, and the guess is where this project loses routes. If the vector
reader got it wrong, the "ground truth" would be a fiction and every score built on it would be
worse than no score at all. So it is tested first and hardest.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

import fitz

from wirecolor.eval.cerl import Observation, score_sheet
from wirecolor.eval.vector_truth import build_nets, build_truth, extract_segments, longest_path

DPI = 200
SCALE = DPI / 72.0


def page_with(draw, width=400, height=300, rotation=0):
    doc = fitz.open()
    page = doc.new_page(width=width, height=height)
    draw(page)
    if rotation:
        page.set_rotation(rotation)
    return doc, page


def line(page, x0, y0, x1, y1, width=1.0):
    page.draw_line(fitz.Point(x0, y0), fitz.Point(x1, y1), width=width)


def _distance_to_polyline(x, y, points):
    from math import hypot
    best = float("inf")
    for a, b in zip(points, points[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        length_sq = dx * dx + dy * dy
        if length_sq == 0:
            best = min(best, hypot(x - a[0], y - a[1]))
            continue
        t = max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / length_sq))
        best = min(best, hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)))
    return best


def _nearest_polyline_observer(truth, tolerance=6.0):
    """A fake tracer that reproduces the source topology exactly.

    Nearest POLYLINE, not nearest bounding box: at a crossing the two routes' boxes overlap, so a
    box-based fake would hand both routes the same conductor id and the scorer would correctly
    report a merge -- of the fixture's making, not the engine's. The observer used to validate the
    scorer has to be at least as precise as the thing it is standing in for.
    """
    def observe(x, y):
        best_id, best_distance = None, tolerance
        for route in truth["routes"]:
            distance = _distance_to_polyline(x, y, route["points"])
            if distance < best_distance:
                best_id, best_distance = route["id"], distance
        return Observation(best_id) if best_id else None
    return observe


class JunctionVersusCrossingTests(unittest.TestCase):
    def test_two_crossing_cables_stay_two_conductors(self):
        """An X with no endpoint at the intersection is two unrelated cables passing over."""
        def draw(page):
            line(page, 20, 150, 380, 150)        # horizontal
            line(page, 200, 20, 200, 280)        # vertical, crossing mid-span
        doc, page = page_with(draw)
        truth = build_truth(page, DPI)
        doc.close()
        self.assertEqual(truth["stats"]["routes"], 2)
        self.assertEqual(len(truth["distinct"]), 1)      # the pair is declared distinct

    def test_a_tee_is_one_net_but_three_physical_runs(self):
        """The vertical ENDS on the horizontal, so all three arms are electrically one net -- but
        they are three separate cables, and a cable is what gets painted. The bus must be split at
        the tap even though the drawing gives it no vertex there."""
        def draw(page):
            line(page, 20, 150, 380, 150)
            line(page, 200, 150, 200, 280)       # starts ON the horizontal
        doc, page = page_with(draw)
        truth = build_truth(page, DPI)
        doc.close()
        self.assertEqual(truth["stats"]["nets"], 1)
        self.assertEqual(truth["stats"]["routes"], 3)
        # all three meet at the junction, so none is declared distinct from another: which arm
        # continues through the tee is the judgement under test, not something to assert
        self.assertEqual(truth["distinct"], [])

    def test_corner_joins(self):
        def draw(page):
            line(page, 20, 20, 200, 20)
            line(page, 200, 20, 200, 200)        # shares an endpoint
        doc, page = page_with(draw)
        truth = build_truth(page, DPI)
        doc.close()
        self.assertEqual(truth["stats"]["routes"], 1)

    def test_a_near_miss_does_not_join(self):
        """Strokes that stop short of each other are separate; the snap tolerance must not bridge
        a real gap, or dashed and truly-disconnected runs would silently fuse."""
        def draw(page):
            line(page, 20, 150, 180, 150)
            line(page, 200, 150, 380, 150)       # 20 pt gap == ~55 px at 200 DPI
        doc, page = page_with(draw)
        truth = build_truth(page, DPI)
        doc.close()
        self.assertEqual(truth["stats"]["routes"], 2)


class GeometryTests(unittest.TestCase):
    def test_coordinates_land_on_the_rendered_ink(self):
        """The transform is verified against a real render, not assumed. If this drifts, every
        ground-truth polyline slides off its conductor and the scores become quietly meaningless."""
        import numpy as np

        def draw(page):
            line(page, 50, 100, 350, 100, width=2.0)
        doc, page = page_with(draw)
        truth = build_truth(page, DPI)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE))
        image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
            pixmap.height, pixmap.width, pixmap.n)
        doc.close()

        self.assertEqual(truth["stats"]["routes"], 1)
        for x, y in truth["routes"][0]["points"]:
            # sample a small window: the stroke has width, and we only care that we are on it
            window = image[max(0, int(y) - 3):int(y) + 4, max(0, int(x) - 3):int(x) + 4]
            self.assertLess(window.min(), 128, f"no ink at ground-truth point ({x}, {y})")

    def test_short_marks_are_not_conductors(self):
        """Ticks, arrowheads and glyph strokes must never enter ground truth."""
        def draw(page):
            line(page, 20, 20, 380, 20)          # a real run
            line(page, 100, 200, 105, 200)       # 5 pt tick
        doc, page = page_with(draw)
        truth = build_truth(page, DPI)
        doc.close()
        self.assertEqual(truth["stats"]["routes"], 1)

    def test_longest_path_traverses_the_long_run_of_a_branching_net(self):
        segments = [(((0.0, 0.0)), (100.0, 0.0)),
                    ((100.0, 0.0), (300.0, 0.0)),      # the long run
                    ((100.0, 0.0), (100.0, 40.0))]     # a short stub off the middle
        nets = build_nets(segments)
        self.assertEqual(len(nets), 1)
        path = longest_path(segments, nets[0])
        span = max(p[0] for p in path) - min(p[0] for p in path)
        self.assertAlmostEqual(span, 300.0, places=3)

    def test_a_net_containing_a_loop_terminates(self):
        """A ring main, a rectangular bus, any cable returning to a shared rail forms a cycle.
        Relaxing on the LONGER path here does not terminate -- you can always go round once more --
        so path extraction must use shortest-path relaxation. This test hangs forever if that
        regresses, which is the point."""
        segments = [((0.0, 0.0), (200.0, 0.0)),
                    ((200.0, 0.0), (200.0, 200.0)),
                    ((200.0, 200.0), (0.0, 200.0)),
                    ((0.0, 200.0), (0.0, 0.0)),        # closes the ring
                    ((200.0, 100.0), (400.0, 100.0))]  # a tail off the ring
        nets = build_nets(segments)
        self.assertEqual(len(nets), 1)
        path = longest_path(segments, nets[0])
        self.assertGreater(len(path), 2)

    def test_rotated_pages_are_handled(self):
        def draw(page):
            line(page, 50, 100, 350, 100, width=2.0)
        doc, page = page_with(draw, rotation=90)
        truth = build_truth(page, DPI)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE))
        doc.close()
        self.assertEqual(truth["stats"]["routes"], 1)
        for x, y in truth["routes"][0]["points"]:
            self.assertTrue(0 <= x <= pixmap.width and 0 <= y <= pixmap.height,
                            f"ground-truth point ({x}, {y}) outside the {pixmap.width}"
                            f"x{pixmap.height} render")


class EndToEndScoringTests(unittest.TestCase):
    """The payoff: derived truth feeds the scorer and catches a merge with no human annotation."""

    def _crossing_page(self):
        def draw(page):
            line(page, 20, 150, 380, 150)
            line(page, 200, 20, 200, 280)
        return page_with(draw)

    def test_a_perfect_tracer_scores_one(self):
        doc, page = self._crossing_page()
        truth = build_truth(page, DPI)
        doc.close()
        report = score_sheet(truth, _nearest_polyline_observer(truth))
        self.assertEqual(report["merge_events"], 0)
        self.assertEqual(report["cerl"], 1.0)

    def test_an_engine_that_fuses_the_crossing_is_caught_as_a_merge(self):
        """This is the failure the release gate exists for, and until now it was unmeasurable."""
        doc, page = self._crossing_page()
        truth = build_truth(page, DPI)
        doc.close()
        report = score_sheet(truth, lambda x, y: Observation("fused"))
        self.assertEqual(report["merge_events"], 1)
        self.assertEqual(report["cerl"], 0.0)


if __name__ == "__main__":
    unittest.main()
