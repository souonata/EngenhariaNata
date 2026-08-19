"""Choose the evaluation set: one sheet from each of N publications, stratified by code density.

    python -m wirecolor.tools.corpus_eval_set --root workspaces/wirecolor_qa [--want 20]

Reads ``state/corpus_all.json`` (from ``corpus_scan``) and writes ``state/eval_set.json``, the
input to every round.

Two rules earn their place here:

* The sheets the user has already reviewed by eye are PINNED in, so their numbers stay comparable
  round to round and a fix cannot quietly trade a reviewed sheet for an unreviewed one.
* The rest are sampled ACROSS the code-density ranking, not off the top. A corpus made only of the
  richest sheets hides exactly the failures that matter -- the first version of this set scored a
  median of 57%, and every sheet under 50% came from the bottom two thirds of the ranking.
"""
from __future__ import annotations

import argparse
import json
import os

# Sheets the user has reviewed by eye, as 0-BASED page indexes (already converted).
PINNED = {34: 148, 191: 132, 3750: 46, 2543: 0, 2542: 0, 77: 110}


def build(root, want=20):
    state_dir = os.path.join(os.path.abspath(root), "state")
    everything = json.load(open(os.path.join(state_dir, "corpus_all.json")))
    publications = everything["publications"]
    by_id = {p["pub"]: p for p in publications}

    chosen, seen = [], set()
    for pub, page in PINNED.items():
        record = by_id.get(pub)
        if not record:
            continue
        codes = next((p["codes"] for p in record["pages"] if p["page"] - 1 == page),
                     record["pages"][0]["codes"])
        chosen.append({"pub": pub, "page": page, "title": record["title"],
                       "path": record["path"], "codes": codes, "pinned": True})
        seen.add(pub)

    remaining = [p for p in publications if p["pub"] not in seen]
    step = max(1, len(remaining) // max(1, want - len(chosen)))
    for record in remaining[::step][: want - len(chosen)]:
        best = record["pages"][0]
        # `pdf_pages.page_number` is 1-BASED; every wirecolor tool takes a 0-based page index.
        # Measured: on pub 3804 the 8 wire codes the index recorded for "page 58" are on document
        # index 57, and index 58 has none. The pinned sheets above are already indexes.
        chosen.append({"pub": record["pub"], "page": best["page"] - 1, "title": record["title"],
                       "path": record["path"], "codes": best["codes"], "pinned": False})

    for entry in chosen:
        entry["tag"] = f"pub{entry['pub']}_p{entry['page']}"
        entry["pdf"] = f"pdfs/pub{entry['pub']}.pdf"

    out = os.path.join(state_dir, "eval_set.json")
    json.dump({"sheets": chosen}, open(out, "w"), indent=1)
    return chosen, out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--want", type=int, default=20)
    args = parser.parse_args()

    chosen, out = build(args.root, args.want)
    for entry in chosen:
        print(f"{'*' if entry['pinned'] else ' '} {entry['tag']:>14} "
              f"codes={entry['codes']:>4}  {entry['title'][:55]}")
    print(f"{len(chosen)} sheets -> {out}")


if __name__ == "__main__":
    main()
