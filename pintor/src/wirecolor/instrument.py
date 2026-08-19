"""Run instrumentation: OCR memoisation and evidence/ownership diagnostics.

Both facilities are opt-in through environment variables and are complete no-ops otherwise, so a
production run keeps exactly the behaviour and the cost of an uninstrumented run.

    WIRECOLOR_OCR_CACHE=<file.json>   memoise the OCR engine per contextual crop window
    WIRECOLOR_DIAG_DIR=<directory>    dump per-pass evidence, ownership and route JSON

Why the OCR memo exists: a full multiscale page examines ~1,000 contextual lenses and OCR
dominates the runtime (about two hours for pub 2503).  Every stage AFTER the engine read --
fragment merging, parsing, global root mapping, acceptance gates, ownership reconciliation and
painting -- is milliseconds.  Memoising the *raw engine output* per (window, rotation) therefore
lets the whole reasoning chain be re-run in a couple of minutes while keeping the recognised text
byte-identical to the recorded run.  The memo deliberately stores the engine's raw tokens, not
parsed labels, so parser and acceptance changes remain fully replayable.
"""
from __future__ import annotations

import hashlib
import json
import os


class OCRMemo:
    """Disk-backed memo of raw OCR engine reads, keyed by crop window and rotation."""

    CHECKPOINT_EVERY = 200

    def __init__(self, path=None):
        self.path = path
        self.enabled = bool(path)
        self.image_key = None
        self.hits = 0
        self.misses = 0
        self._store = {}
        self._dirty = False
        if self.enabled and os.path.exists(path):
            try:
                with open(path, encoding="utf-8") as handle:
                    blob = json.load(handle)
            except (OSError, ValueError):
                blob = {}
            self.image_key = blob.get("image_key")
            self._store = blob.get("reads", {})

    def bind(self, image_path):
        """Tie the memo to one page render; a different page starts from an empty memo."""
        if not self.enabled:
            return
        try:
            with open(image_path, "rb") as fh:
                key = hashlib.sha1(fh.read()).hexdigest()
        except OSError:
            return
        if self.image_key and self.image_key != key:
            print(f"ocr_memo: page changed, discarding {len(self._store)} cached reads")
            self._store = {}
        self.image_key = key
        self._dirty = True

    def read(self, engine, image, key):
        """Return engine tokens for ``key``, running the engine only on a miss."""
        if not self.enabled:
            return engine(image)
        slot = ",".join(str(int(part)) for part in key)
        cached = self._store.get(slot)
        if cached is not None:
            self.hits += 1
            return [(token[0], token[1], token[2]) for token in cached]
        self.misses += 1
        result = list(engine(image))
        self._store[slot] = [
            [[[float(p[0]), float(p[1])] for p in box], str(txt), float(score)]
            for box, txt, score in result
        ]
        self._dirty = True
        # A full multiscale page costs hours of OCR; checkpoint it so a crash, a kill or an
        # out-of-memory event never throws that work away.  Writes are atomic (tmp + replace).
        if self.misses % self.CHECKPOINT_EVERY == 0:
            self.save(verbose=False)
        return result

    def save(self, verbose=True):
        if not (self.enabled and self._dirty):
            return
        os.makedirs(os.path.dirname(os.path.abspath(self.path)) or ".", exist_ok=True)
        tmp = f"{self.path}.tmp"
        with open(tmp, "w") as fh:
            json.dump({"image_key": self.image_key, "reads": self._store}, fh)
        os.replace(tmp, self.path)
        self._dirty = False
        if verbose:
            print(f"ocr_memo: {self.hits} cached reads reused, {self.misses} new "
                  f"({len(self._store)} windows in {self.path})")


class DiagLog:
    """Append-only diagnostic channels dumped as JSON at the end of a run."""

    def __init__(self, directory=None):
        self.directory = directory
        self.enabled = bool(directory)
        self._channels = {}

    def record(self, stream, **payload):
        # ``stream`` deliberately avoids common payload names such as "channel": every other
        # keyword belongs to the caller's record.
        if not self.enabled:
            return
        self._channels.setdefault(stream, []).append(payload)

    def dump(self):
        if not self.enabled:
            return
        os.makedirs(self.directory, exist_ok=True)
        for channel, rows in self._channels.items():
            path = os.path.join(self.directory, f"{channel}.json")
            with open(path, "w") as fh:
                json.dump(rows, fh)
            print(f"diag: {len(rows)} rows -> {path}")


_MEMO = None
_DIAG = None


def ocr_memo():
    global _MEMO
    if _MEMO is None:
        _MEMO = OCRMemo(os.environ.get("WIRECOLOR_OCR_CACHE"))
    return _MEMO


def diag():
    global _DIAG
    if _DIAG is None:
        _DIAG = DiagLog(os.environ.get("WIRECOLOR_DIAG_DIR"))
    return _DIAG


def reset_for_tests(ocr_cache=None, diag_dir=None):
    """Rebind both facilities; used by the unit tests, never by the pipeline."""
    global _MEMO, _DIAG
    _MEMO = OCRMemo(ocr_cache)
    _DIAG = DiagLog(diag_dir)
    return _MEMO, _DIAG
