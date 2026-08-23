import unittest
from math import hypot

import fitz
import numpy as np

from wirecolor.detect.vector_pins import PIN_RADIUS_FRACTION, PinMarker, connector_pin_markers
from wirecolor.labels.conventions import load_convention
from wirecolor.labels.text_layer import Legend
from wirecolor.paint.vector_overlay import paint_pin_markers


class ConnectorPinDetectionTests(unittest.TestCase):
    def setUp(self):
        self.document = fitz.open()
        self.page = self.document.new_page(width=240, height=200)
        self.page.draw_rect(fitz.Rect(90, 50, 130, 150), color=(0, 0, 0), fill=(1, 1, 1),
                            width=1)
        self.centres = [(100, 70), (120, 70), (100, 100), (120, 100),
                        (100, 130), (120, 130)]
        for x, y in self.centres:
            self.page.draw_circle(fitz.Point(x, y), 4, color=(0, 0, 0), width=1)

    def tearDown(self):
        self.document.close()

    @staticmethod
    def _legend(raw, code, x, y):
        return Legend(raw=raw, code=code, x=x, y=y, axis="h", wire_id=None)

    def test_exact_schedule_maps_to_safe_markers_inside_all_six_pins(self):
        scale = 200 / 72
        legends = []
        codes = ("BL/W", "BN/SB", "BL/GN", "W/GN", "W/R", "W/SB")
        for row, y in enumerate((70, 100, 130)):
            legends.append(self._legend(codes[row], codes[row], 80 * scale, y * scale))
            legends.append(self._legend(codes[row + 3], codes[row + 3], 140 * scale, y * scale))

        markers, accepted = connector_pin_markers(self.page, 200, legends)

        self.assertEqual(len(markers), 6)
        self.assertEqual(accepted, set(range(6)))
        self.assertEqual({marker.code for marker in markers}, set(codes))
        for marker in markers:
            self.assertLessEqual(marker.radius, marker.outer_radius * PIN_RADIUS_FRACTION + 1e-6)
            x0, y0, x1, y1 = marker.connector_bbox
            self.assertGreater(marker.x - marker.radius, x0)
            self.assertLess(marker.x + marker.radius, x1)
            self.assertGreater(marker.y - marker.radius, y0)
            self.assertLess(marker.y + marker.radius, y1)
            nearest = min(hypot(marker.x - x * scale, marker.y - y * scale)
                          for x, y in self.centres
                          if hypot(marker.x - x * scale, marker.y - y * scale) > 0.1)
            self.assertLess(marker.radius * 2, nearest)

    def test_one_nearby_colour_word_is_not_enough_to_declare_a_schedule(self):
        scale = 200 / 72
        legends = [self._legend("BL/W", "BL/W", 80 * scale, 70 * scale)]

        markers, accepted = connector_pin_markers(self.page, 200, legends)

        self.assertEqual(markers, [])
        self.assertEqual(accepted, set())

    def test_two_unaligned_component_circles_do_not_become_connector_pins(self):
        document = fitz.open()
        page = document.new_page(width=200, height=160)
        page.draw_rect(fitz.Rect(70, 40, 130, 120), color=(0, 0, 0), width=1)
        page.draw_circle(fitz.Point(85, 60), 4, color=(0, 0, 0), width=1)
        page.draw_circle(fitz.Point(115, 100), 4, color=(0, 0, 0), width=1)
        scale = 200 / 72
        legends = [
            self._legend("BL", "BL", 55 * scale, 60 * scale),
            self._legend("GN", "GN", 145 * scale, 100 * scale),
        ]

        markers, accepted = connector_pin_markers(page, 200, legends)
        document.close()

        self.assertEqual(markers, [])
        self.assertEqual(accepted, set())


class ConnectorPinRenderingTests(unittest.TestCase):
    def test_two_colour_marker_is_split_and_never_exceeds_reserved_radius(self):
        convention = load_convention("volvo_classic")
        canvas = np.zeros((61, 61, 4), np.uint8)
        marker = PinMarker(
            x=30,
            y=30,
            radius=10,
            outer_radius=14,
            code="BL/GN",
            legend_raw="BL/GN",
            connector_bbox=(10, 10, 50, 50),
        )

        self.assertEqual(paint_pin_markers(canvas, [marker], convention), 1)

        blue = np.all(canvas[:, :, :3] == convention.colors_bgr["BL"], axis=2)
        green = np.all(canvas[:, :, :3] == convention.colors_bgr["GN"], axis=2)
        self.assertGreater(np.count_nonzero(blue), 20)
        self.assertGreater(np.count_nonzero(green), 20)
        yy, xx = np.nonzero(canvas[:, :, 3])
        self.assertTrue(np.all((xx - marker.x) ** 2 + (yy - marker.y) ** 2
                               <= marker.radius ** 2 + 1e-6))

    def test_white_half_stays_visible_inside_black_outline(self):
        convention = load_convention("volvo_classic")
        canvas = np.zeros((41, 41, 4), np.uint8)
        marker = PinMarker(20, 20, 8, 12, "BL/W", "BL/W", (5, 5, 35, 35))

        paint_pin_markers(canvas, [marker], convention)

        white = np.all(canvas[:, :, :3] == (255, 255, 255), axis=2) & (canvas[:, :, 3] == 255)
        black = np.all(canvas[:, :, :3] == (0, 0, 0), axis=2) & (canvas[:, :, 3] == 255)
        self.assertGreater(np.count_nonzero(white), 10)
        self.assertGreater(np.count_nonzero(black), 10)


if __name__ == "__main__":
    unittest.main()
