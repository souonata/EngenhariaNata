"""The noding/net density cap: a grid cell packed with a hatched decoration is skipped.

Noding and net-building compare every endpoint against all strokes in its 3x3 cell neighbourhood --
O(k^2) when k strokes pile into one spot. A conductor junction is a handful of wires; only a hatched
title-block logo packs thousands (a foreign A0 sheet's "VOLVO PENTA" logo put 5597 strokes in one
neighbourhood and noding ran for an hour). Above MAX_NODE_NEIGHBOURHOOD the endpoint work is skipped:
the region is a decoration that yields no conductor, so no painted result changes.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

from wirecolor.eval.vector_truth import MAX_NODE_NEIGHBOURHOOD, build_nets, node_segments


def _bus_and_tap():
    bus = ((0.0, 50.0), (100.0, 50.0))          # a horizontal bus
    tap = ((50.0, 50.0), (50.0, 20.0))          # a wire ending on its interior at (50,50)
    return bus, tap


class NodingDensityCap(unittest.TestCase):
    def test_normal_T_junction_is_still_noded(self):
        bus, tap = _bus_and_tap()
        out = node_segments([bus, tap])
        self.assertNotIn(bus, out, "a sparse T-junction must still split the bus")
        self.assertEqual(len(out), 3)           # bus -> two halves, tap unchanged

    def test_dense_cluster_is_skipped_not_noded(self):
        # the same junction buried in a hatched cluster that overflows the neighbourhood cap: the
        # endpoints there are skipped, so the bus is left whole rather than split thousands of times
        bus, tap = _bus_and_tap()
        decoys = [((50.0 + 0.001 * i, 50.0), (50.0 + 0.001 * i, 49.0))
                  for i in range(MAX_NODE_NEIGHBOURHOOD + 50)]
        out = node_segments([bus, tap, *decoys])
        self.assertIn(bus, out, "a bus inside a dense hatched cell must be left un-noded")

    def test_dense_cluster_does_not_get_union_bonded(self):
        # net-building has the same cap: a hatched cluster must not union-bond into one giant net
        decoys = [((50.0 + 0.001 * i, 50.0), (50.0 + 0.001 * i, 49.0))
                  for i in range(MAX_NODE_NEIGHBOURHOOD + 50)]
        nets = build_nets([*decoys])
        # with the cap the endpoints are not compared, so the strokes stay as separate nets
        self.assertGreater(len(nets), MAX_NODE_NEIGHBOURHOOD)


if __name__ == "__main__":
    unittest.main()
