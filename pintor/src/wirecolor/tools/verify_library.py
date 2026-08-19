"""Verify Pintor's private source-PDF library against its manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify(manifest_path: Path) -> dict:
    import fitz

    manifest_path = manifest_path.resolve()
    library_root = manifest_path.parent
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    errors: list[str] = []
    total_pages = 0
    evidence_pages = 0

    for record in manifest.get("publications", []):
        publication_id = record.get("publication_id")
        pdf_path = (library_root / record["copy_path"]).resolve()
        if library_root not in pdf_path.parents:
            errors.append(f"pub{publication_id}: copy_path escapes the library root")
            continue
        if not pdf_path.is_file():
            errors.append(f"pub{publication_id}: missing {pdf_path}")
            continue
        if pdf_path.stat().st_size != record.get("bytes"):
            errors.append(f"pub{publication_id}: byte count differs from manifest")
        if file_sha256(pdf_path) != record.get("sha256"):
            errors.append(f"pub{publication_id}: SHA-256 differs from manifest")

        try:
            document = fitz.open(pdf_path)
            page_count = len(document)
            total_pages += page_count
            evidence = record.get("wiring_pages_1_based", [])
            evidence_pages += len(evidence)
            if page_count < 1:
                errors.append(f"pub{publication_id}: PDF has no pages")
            invalid = [page for page in evidence if page < 1 or page > page_count]
            if invalid:
                errors.append(f"pub{publication_id}: invalid evidence pages {invalid}")
            document.close()
        except Exception as error:
            errors.append(f"pub{publication_id}: {type(error).__name__}: {error}")

    expected = manifest.get("publication_count")
    actual = len(manifest.get("publications", []))
    if expected != actual:
        errors.append(f"manifest publication_count={expected}, records={actual}")

    return {
        "publications": actual,
        "pdf_pages_opened": total_pages,
        "wiring_page_evidence": evidence_pages,
        "errors": errors,
        "passed": not errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", default="library/manifest.json")
    args = parser.parse_args()
    result = verify(Path(args.manifest))
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
