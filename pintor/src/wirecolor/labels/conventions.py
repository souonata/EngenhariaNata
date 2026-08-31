"""Colour-code convention registry loader.

A convention is a JSON data file under wirecolor/conventions/. Adding a new abbreviation
scheme = adding a new JSON file; no code change. Colours are stored as human-readable RGB
in the JSON and converted to OpenCV BGR here.

P0 exposes only loading (the v1 core takes a Convention instead of the old hardcoded
CODES/COLORS globals). Census scoring, doc/page verdicts and legend mining arrive in P2.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

CONVENTIONS_DIR = Path(__file__).resolve().parent.parent / "conventions"


@dataclass(frozen=True)
class Convention:
    name: str
    codes: frozenset            # valid colour abbreviations, e.g. {"R", "SB", ...}
    colors_bgr: dict            # code -> (B, G, R) tuple for OpenCV painting
    white_token: str            # the code rendered as white-core-with-black-rails
    all_white_token: str        # token whose dominance marks an "all-white cabinet" sheet
    distinctive: frozenset = field(default_factory=frozenset)
    excluded_from_evidence: frozenset = field(default_factory=frozenset)
    shared: frozenset = field(default_factory=frozenset)
    grammars: tuple = ("code_first", "gauge_first")
    two_color_sep: str = "/"
    word_aliases: dict = field(default_factory=dict)
    table_aliases: dict = field(default_factory=dict)


def load_convention(name: str) -> Convention:
    if name not in list_conventions():
        raise ValueError(f"unknown colour-code convention: {name!r}")
    path = CONVENTIONS_DIR / f"{name}.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    tokens = raw["tokens"]
    return Convention(
        name=raw["name"],
        codes=frozenset(tokens),
        colors_bgr={code: (rgb[2], rgb[1], rgb[0]) for code, rgb in tokens.items()},
        white_token=raw["white_token"],
        all_white_token=raw["all_white_token"],
        distinctive=frozenset(raw.get("distinctive", ())),
        excluded_from_evidence=frozenset(raw.get("excluded_from_evidence", ())),
        shared=frozenset(raw.get("shared", ())),
        grammars=tuple(raw.get("grammars", ("code_first", "gauge_first"))),
        two_color_sep=raw.get("two_color_sep", "/"),
        word_aliases={str(alias).upper(): str(code)
                      for alias, code in raw.get("word_aliases", {}).items()},
        table_aliases={str(alias).upper(): str(code)
                       for alias, code in raw.get("table_aliases", {}).items()},
    )


def list_conventions() -> list:
    return sorted(p.stem for p in CONVENTIONS_DIR.glob("*.json"))


def validate_disjointness() -> None:
    """Distinctive token sets must be pairwise disjoint across registries, or convention
    scoring (P2) could count the same token as evidence for two conventions."""
    loaded = [load_convention(n) for n in list_conventions()]
    for i, a in enumerate(loaded):
        for b in loaded[i + 1:]:
            overlap = a.distinctive & b.distinctive
            if overlap:
                raise ValueError(
                    f"conventions {a.name} and {b.name} share distinctive tokens: {sorted(overlap)}")


# The library this beta serves is Volvo Penta, so when the observed codes are equally explained by
# more than one vocabulary the house one is the honest default rather than an alphabetical accident.
HOUSE_CONVENTION = "volvo_classic"


def colour_conflicts(names, codes) -> set:
    """Codes among ``codes`` that these conventions would paint in *different* colours.

    Choosing a vocabulary only matters when the choice changes what ends up on the page. Today
    ``volvo_classic`` and ``iec_two_letter`` overlap on ``BN`` and ``GN`` alone and agree on both,
    so no observed code is actually ambiguous -- which is why asking a reviewer to break the tie
    could never have improved a single painted pixel. This computes that fact instead of assuming
    it, so adding a genuinely conflicting registry later starts abstaining on its own.
    """
    loaded = [load_convention(name) for name in names]
    conflicting = set()
    for code in codes:
        painted = set()
        for convention in loaded:
            parts = str(code).split("/")
            if not all(part in convention.codes for part in parts):
                continue
            painted.add(tuple(convention.colors_bgr.get(part) for part in parts))
        if len(painted) > 1:
            conflicting.add(code)
    return conflicting
