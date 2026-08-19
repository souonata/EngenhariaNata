"""P0 runner with the exact v1 CLI shape, for golden-equivalence testing:

    python -m wirecolor.tools.p0_run page.png [labels.json] [out.png]
           [--probe x y] [--who x y] [--netends x y] [--deadends]
           [--convention volvo_classic]
"""
from __future__ import annotations

import sys

from ..labels.conventions import load_convention
from ..pipeline import paint_page_legacy, run_page


def main(argv):
    src = argv[1] if len(argv) > 1 else "wiring_2476.png"
    lbl = argv[2] if len(argv) > 2 else "labels_2476.json"
    out = argv[3] if len(argv) > 3 else "wiring_2476_v3.png"

    def xy_flag(name):
        if name in argv:
            i = argv.index(name)
            return (float(argv[i + 1]), float(argv[i + 2]))
        return None

    conv_name = "volvo_classic"
    if "--convention" in argv:
        conv_name = argv[argv.index("--convention") + 1]
    convention = load_convention(conv_name)

    solution = run_page(src, lbl, convention,
                        probe=xy_flag("--probe"), who=xy_flag("--who"),
                        netends=xy_flag("--netends"), deadends="--deadends" in argv)
    paint_page_legacy(solution, out)


if __name__ == "__main__":
    main(sys.argv)
