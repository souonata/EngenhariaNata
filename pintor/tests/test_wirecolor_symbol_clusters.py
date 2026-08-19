"""A component box outline must lose its colour; a real cable and a splice branch must keep it.

The box outline is what the user marked again and again: a wire's colour spread around the injector
or relay case it terminates in. The signature is short + propagation-coloured + packed into a
component-sized cluster. These tests pin that the three gates together spare conductors and splice
branches, which fail at least one gate.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

from wirecolor.detect.vector_loops import strip_symbol_clusters  # noqa: E402


class Run:
    def __init__(self, points, code, propagated=True):
        self.points = points
        self.code = code
        self.propagated = propagated


DIAG = 3000.0
FLOOR = 50.0        # short_limit = 2.5 * 50 = 125 px


def box(x0, y0, x1, y1, code, propagated=True):
    """Four short edge runs forming a small rectangle outline."""
    return [Run([(x0, y0), (x1, y0)], code, propagated),
            Run([(x1, y0), (x1, y1)], code, propagated),
            Run([(x1, y1), (x0, y1)], code, propagated),
            Run([(x0, y1), (x0, y0)], code, propagated)]


class StripSymbolClusters(unittest.TestCase):
    def test_a_small_propagated_box_is_cleared(self):
        runs = box(400, 300, 480, 340, "R")           # 80 x 40 -- injector-box scale
        self.assertEqual(strip_symbol_clusters(runs, DIAG, FLOOR), 4)
        self.assertTrue(all(r.code is None for r in runs))

    def test_a_directly_owned_run_is_never_cleared(self):
        # a wire owns its legend (propagated=False); even short, it is a conductor, not an outline
        runs = box(400, 300, 480, 340, "R", propagated=False)
        self.assertEqual(strip_symbol_clusters(runs, DIAG, FLOOR), 0)

    def test_a_long_run_is_not_a_box_edge(self):
        # two long propagated runs meeting in a corner -- a routed cable, not a small outline
        runs = [Run([(0, 300), (900, 300)], "R"), Run([(900, 300), (900, 900)], "R")]
        self.assertEqual(strip_symbol_clusters(runs, DIAG, FLOOR), 0)

    def test_a_lone_short_branch_survives(self):
        # one short propagated stub is a splice branch, not a cluster of outline edges
        runs = [Run([(400, 300), (440, 300)], "R")]
        self.assertEqual(strip_symbol_clusters(runs, DIAG, FLOOR), 0)

    def test_a_splice_with_routed_branches_is_safe(self):
        # a splice's branches route away -- each is a long run, so none is a short outline edge
        node = (700, 700)
        runs = [Run([node, (700, 300)], "R"), Run([node, (700, 1100)], "R"),
                Run([node, (300, 700)], "R"), Run([node, (1100, 700)], "R")]
        self.assertEqual(strip_symbol_clusters(runs, DIAG, FLOOR), 0)

    def test_the_wire_that_attaches_to_the_box_keeps_its_colour(self):
        runs = box(400, 300, 480, 340, "GN")
        wire = Run([(480, 340), (480, 1200)], "GN")   # long tail leaving the box
        runs.append(wire)
        strip_symbol_clusters(runs, DIAG, FLOOR)
        self.assertEqual(wire.code, "GN")             # long -> not part of the cluster


if __name__ == "__main__":
    unittest.main()
