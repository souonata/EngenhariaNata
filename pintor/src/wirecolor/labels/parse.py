"""Label-text parsing.

v1 (colorize_wiring_prototype.py lines 70-92) used a permissive regex: any `\\d(\\.\\d+)?`
gauge + letters. Round-8 user markup exposed two failure classes on pub 2550:
  - '0.75 0R/SB' silently parsed as R/SB (the bogus 3-decimal "gauge" 0.750 absorbed the
    O-scanned-as-0 of OR) -- a WRONG COLOUR, the worst failure mode;
  - '1 GR/0R' failed to parse at all (0 inside the code token), so the wire's only seed was
    a nearby 'T' pin designator and the whole net painted tan.

v2 grammar: a gauge must be a REAL wire cross-section (closed vocabulary, mm2), and inside
the isolated code token every '0' may fold to 'O' (codes contain no digits, so the fold is
unambiguous there). Both label orders still parse: code-first ("SB 1,5", "R/BL", "W 1.0")
and gauge-first ("1 Y (w3)", "1.5 BL/R (w6)", "0.75 GR/OR").
"""
from __future__ import annotations

import re
import unicodedata

# Standard conductor cross-sections seen in the library (mm2). A closed set: '0.750' or '7'
# can never be gauges, which is what stops a stray 0/7 from being eaten as one.
GAUGES = {0.35, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 4.0, 5.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0}

_GAUGE_RE = re.compile(r"\d{1,2}(\.\d{1,2})?")
_CODE_RE = re.compile(r"[A-Z0]{1,3}(?:/[A-Z0]{1,3})?")
_WIRE_ID_SUFFIX_RE = re.compile(r"\(W[0-9IL|]+\)?$")
_WIRE_ID_CAPTURE_RE = re.compile(r"\(W([0-9IL|]+)\)?$")
_WIRE_ID_CLOSED_RE = re.compile(r"\(W([0-9IL|]+)\)$")

# A connector PIN number printed beside the colour, e.g. "3 PU" or "PU 3". On pictorial harness
# sheets (installation instructions, EVC posters) the number after a colour is the terminal it
# lands on, not a cross-section -- and requiring it to be a valid gauge silently deleted every wire
# on pins 3, 7, 8, 9, 11, 12 (the ones that are not also legal mm2 values). Measured: 21 of 87
# codes on pub 5568 and 16 of 83 on pub 4872 were lost to exactly this.
#
# The number must be WHITESPACE-separated in the PRINTED text. That is the whole safety argument:
# "0.750R/SB" -- the round-8 misread that produced a wrong colour by eating an O-as-0 -- has no
# space and is never touched, while "3 PU" plainly does. So pin stripping runs on the RAW text,
# before the grammar collapses the spaces.
_PIN_LEAD_RE = re.compile(r"^\s*[1-9]\d?\s+(?=[A-Za-z])")
_PIN_TAIL_RE = re.compile(r"(?<=[A-Za-z])\s+[1-9]\d?\s*$")

# The lightness qualifier spelled in English: "DK GN" is the conductor the convention abbreviates
# DGN, "LT BL" is LBL. Also whitespace-gated and exact-text only.
_LIGHTNESS_RE = re.compile(r"^(DK|LT)\s+(?=[A-Za-z])", re.IGNORECASE)
_LIGHTNESS = {"DK": "D", "LT": "L"}
_WORD_GAUGE_RE = re.compile(r"(?<!\d)\d{1,2}[.,]\d{1,2}(?!\d)")


def _wire_digits(match):
    if not match:
        return None
    digits = match.group(1).replace("I", "1").replace("L", "1").replace("|", "1")
    return f"W{digits}" if digits.isdigit() else None


def parse_wire_id(text: str) -> str | None:
    """Return a normalized drawing wire id such as ``W192`` when one is present.

    Vertical OCR commonly substitutes ``I``, ``L`` or ``|`` for the digit ``1``.  The suffix
    grammar is deliberately as narrow as the colour parser's discard rule, so component text or
    ordinary numbers cannot become conductor identity evidence.

    The closing parenthesis is optional here because a crop can clip it, which keeps this form
    usable for de-duplicating two reads of one printed legend.  It must NOT be used to decide that
    two labels name DIFFERENT wires -- see ``parse_wire_id_strict``.
    """
    return _wire_digits(_WIRE_ID_CAPTURE_RE.search(text.strip().upper().replace(" ", "")))


def parse_wire_id_strict(text: str) -> str | None:
    """Wire id only when the identifier is provably complete (closing parenthesis present).

    Round 16: a clipped read of ``(w294)`` yields ``(w29`` and the tolerant form returns ``W29`` --
    a DIFFERENT identity from ``W294``.  Measured on pub 2503, 21% of recovered ids were truncated
    prefixes, and nine physical wires were credited with "two different wire ids" purely from that
    truncation.  Identity disagreement quarantines a whole route, so only a complete id may be used
    as evidence that two legends belong to different conductors.
    """
    return _wire_digits(_WIRE_ID_CLOSED_RE.search(text.strip().upper().replace(" ", "")))


def _gauge_prefixes(t: str) -> list:
    """All prefixes of t that are valid gauges, longest first (so '10R' reads gauge 10 + R,
    never gauge 1 + folded OR)."""
    out = []
    m = _GAUGE_RE.match(t)
    if m:
        s = m.group(0)
        while s:
            try:
                if float(s) in GAUGES:
                    out.append(s)
            except ValueError:
                pass
            s = s[:-1]
    return out


def _gauge_suffixes(t: str) -> list:
    out = []
    for i in range(len(t)):
        s = t[i:]
        if _GAUGE_RE.fullmatch(s):
            try:
                if float(s) in GAUGES:
                    out.append(s)
            except ValueError:
                pass
    return out                       # naturally longest-first


def _code_token(tok: str, codes) -> str | None:
    """Validate an isolated code token; a '0' inside it is always a scanned 'O' (no valid
    code contains digits), so fold and retry."""
    for cand in (tok, tok.replace("0", "O")) if "0" in tok else (tok,):
        if re.fullmatch(r"[A-Z]{1,3}(?:/[A-Z]{1,3})?", cand) \
                and all(p in codes for p in cand.split("/")):
            return cand
    return None


def _pin_candidates(raw: str):
    """Raw spellings to try when a legend carries a connector pin or an English lightness word.

    Every candidate keeps the whitespace that made the strip safe; the grammar collapses it as
    usual. The original is always tried first, so a legend that parses without help is unchanged.
    """
    def lighten(text):
        return _LIGHTNESS_RE.sub(lambda m: _LIGHTNESS[m.group(1).upper()], text)

    seen = set()
    # try, in order: the original; pin stripped; lightness folded; and both together (a legend
    # like "11 DK GN/SB" needs the pin gone before the lightness word is at the front).
    pin_stripped = _PIN_TAIL_RE.sub("", _PIN_LEAD_RE.sub("", raw))
    for candidate in (raw, pin_stripped, lighten(raw), lighten(pin_stripped)):
        if candidate and candidate not in seen:
            seen.add(candidate)
            yield candidate


def parse_code(text: str, convention, allow_pin: bool = False) -> str | None:
    """Colour token for a printed legend, or ``None``.

    ``allow_pin`` enables the connector-pin and English-lightness rescues above. It is passed only
    by the exact-text reader (``text_layer``), never by the OCR path: the rescues lean on real
    whitespace in the printed string, which a raster read cannot be trusted to preserve.
    """
    if allow_pin:
        for candidate in _pin_candidates(text):
            code = _parse_code_core(candidate, convention) \
                or _parse_word_code(candidate, convention)
            if code:
                return code
        return None
    return _parse_code_core(text, convention) or _parse_word_code(text, convention)


def _parse_word_code(text: str, convention) -> str | None:
    """Parse old bilingual colour words only when accompanied by a decimal wire gauge.

    Vintage scanned Volvo drawings spell labels along the conductor (for example
    ``Grön 1,5 - Green 1.5``) instead of using modern abbreviations.  Requiring a decimal gauge
    keeps prose, indicator legends such as ``Green - Power`` and numbered component lists out.
    Multiple language spellings may occur in one OCR token; they must resolve to one colour.
    """
    aliases = getattr(convention, "word_aliases", {})
    if not aliases or not _WORD_GAUGE_RE.search(text):
        return None
    normalized = unicodedata.normalize("NFKD", text)
    normalized = "".join(character for character in normalized
                         if not unicodedata.combining(character)).upper()
    def codes_in(fragment: str) -> set[str]:
        return {
            code for alias, code in aliases.items()
            if re.search(rf"(?<![A-Z]){re.escape(alias)}(?![A-Z])", fragment)
        }

    if "/" in normalized:
        left, right = normalized.split("/", 1)
        left_codes, right_codes = codes_in(left), codes_in(right)
        if len(left_codes) == len(right_codes) == 1:
            pair = f"{next(iter(left_codes))}/{next(iter(right_codes))}"
            if all(part in convention.codes for part in pair.split("/")):
                return pair
    matched = codes_in(normalized)
    return next(iter(matched)) if len(matched) == 1 else None


def _parse_code_core(text: str, convention) -> str | None:
    t = text.strip().upper().replace(" ", "").replace(",", ".")
    # The trailing wire id is metadata, not part of the colour.  Vertical OCR commonly reads
    # ``(w192)`` as ``(WI92)``, ``(W|92)`` or loses the closing parenthesis.  Strip only this
    # tightly-scoped trailing form; accepting I/L/| here cannot invent a colour token because the
    # whole suffix is discarded before the gauge/code grammar runs.
    t = _WIRE_ID_SUFFIX_RE.sub("", t)
    codes = convention.codes
    if not t:
        return None

    for lead in _gauge_prefixes(t) + [""]:
        rest = t[len(lead):]
        if not rest:
            continue
        if not _CODE_RE.match(rest):
            continue
        c = _code_token(rest, codes)
        if c:
            return c
        for trail in _gauge_suffixes(rest):
            core = rest[:-len(trail)]
            if core:
                c = _code_token(core, codes)
                if c:
                    return c
    return None
