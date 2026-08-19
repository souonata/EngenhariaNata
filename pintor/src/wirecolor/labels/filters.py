"""Post-OCR label filtering -- extracted verbatim from colorize_wiring_prototype.py
(module-level lines 178-199): glyph-size floor + OCR fragment guard.

Round-7 addition (user pink markup, pub 2550): margin-zone-letter rejection.
"""
from __future__ import annotations

MARGIN_BAND = 120   # working px (~15 mm on A0 @200 DPI): the zone-reference strip outside the frame


def filter_margin_labels(labels: list, W: int, H: int, margin: int = MARGIN_BAND) -> list:
    """Drop labels whose centre lies in the page-edge margin band. The strip between the sheet
    frame and the paper edge carries GRID ZONE LETTERS (A..Q); several are valid colour codes
    (P=pink, R=red, T=tan) and a zone 'P' seeded the frame line pink on pub 2550 (round-7 user
    markup). No cable label ever sits outside the drawing frame, so the band is safe to blank."""
    return [L for L in labels
            if min(L["cx"], L["cy"], W - L["cx"], H - L["cy"]) >= margin]


def filter_labels(labels: list) -> list:
    """OCR fragment guard: the same printed text often yields BOTH the full code and a piece of it
    as separate tokens ('BL/W' + a lone 'W'). A label whose colour parts are a strict subset of a
    label whose BOX it sits inside is that text's fragment, never a second wire's code -- and as a
    seed it would poison the whole net with the wrong colour. (Centre-inside-box, not proximity:
    adjacent pins' real labels sit close together but never inside each other's text box.)"""
    _keep = []
    for _i, _Li in enumerate(labels):
        if min(_Li["w"], _Li["h"]) < 16:   # a code glyph is ~30 px at 200 DPI; a 7 px-thin "letter"
            continue                       # is a piece of line art (housing edge) misread as text
        _pi = set(_Li["code"].split("/"))
        _frag = False
        for _j, _Lj in enumerate(labels):
            if _i == _j or not _pi < set(_Lj["code"].split("/")):
                continue
            _xs = [p[0] for p in _Lj["box"]]; _ys = [p[1] for p in _Lj["box"]]
            if min(_xs) - 6 <= _Li["cx"] <= max(_xs) + 6 and min(_ys) - 6 <= _Li["cy"] <= max(_ys) + 6:
                _frag = True
                break
        if not _frag:
            _keep.append(_Li)
    return _keep
