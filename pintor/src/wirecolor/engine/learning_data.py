"""Content-addressed vector contexts and leakage-safe ledger scoring."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import os

from .policy import DecisionPolicy
from .vector_page import VectorPageContext, decide_vector_context, extract_vector_context


CACHE_VERSION = 4


def _sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def context_fingerprint(pdf_path, page_index, dpi, convention_name):
    payload = f"{CACHE_VERSION}|{_sha256(pdf_path)}|{page_index}|{dpi}|{convention_name}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def load_or_build_context(root, sheet, cache_dir, dpi=200, convention_name="volvo_classic"):
    """Cache only expensive extraction; decisions remain cheap and parameterised."""
    import fitz

    from ..eval.vector_truth import geometry_is_trustworthy
    from ..labels.conventions import load_convention

    pdf_path = os.path.abspath(os.path.join(root, sheet["pdf"]))
    fingerprint = context_fingerprint(pdf_path, sheet["page"], dpi, convention_name)
    os.makedirs(cache_dir, exist_ok=True)
    cache_path = os.path.join(cache_dir, f"{sheet['tag']}-{fingerprint[:16]}.json")
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as handle:
            cached = json.load(handle)
        if cached.get("fingerprint") == fingerprint:
            if cached.get("declined"):
                return None, cached
            return VectorPageContext.from_dict(cached["context"]), cached

    document = fitz.open(pdf_path)
    page = document[sheet["page"]]
    trustworthy, reason = geometry_is_trustworthy(page, dpi)
    record = {
        "cache_version": CACHE_VERSION, "fingerprint": fingerprint,
        "tag": sheet["tag"], "pdf": pdf_path, "page": sheet["page"],
        "dpi": dpi, "convention": convention_name,
    }
    if not trustworthy:
        record.update({"declined": True, "decline_reason": reason})
        context = None
    else:
        context = extract_vector_context(page, dpi, load_convention(convention_name))
        record.update({"declined": False, "context": context.to_dict()})
    document.close()
    with open(cache_path, "w", encoding="utf-8") as handle:
        json.dump(record, handle, separators=(",", ":"))
    return context, record


@dataclass(frozen=True)
class LedgerScore:
    loss: float
    macro_accuracy: float
    cases: int
    sheets: int
    false_paint: int
    wrong_colour: int
    missed_paint: int
    unresolved: int
    baseline_regressions: int

    def to_dict(self):
        return self.__dict__.copy()


def case_loss(case, result):
    """Asymmetric safety loss: painting furniture is costlier than abstaining."""
    if result.get("verdict") == "pass":
        return 0.0, None
    expected = case.get("expect", "")
    actual = result.get("found")
    if case.get("class") == "wrong-colour" and expected in {"painted", "unknown-colour"}:
        return 1.5, "unresolved"
    if expected == "black" and actual is not None:
        return 4.0, "false_paint"
    if expected.startswith("painted:") and actual is not None:
        return 2.5, "wrong_colour"
    if expected.startswith("painted"):
        return 1.0, "missed_paint"
    return 1.5, "unresolved"


def deduplicate_cases_by_run(owned, cases):
    """Give one scoring vote to one physical run and expected outcome.

    Reviewers often pin several visible sections of a long connector rail.  Those pins are useful
    evidence and remain in the audit ledger, but counting all of them as independent optimisation
    cases lets one physical mistake dominate a sheet.  Deduplication is anchored to the immutable
    baseline geometry so a candidate cannot improve its score by merging runs.
    """
    from ..tools.qa_cases import PIN_RADIUS_PX, _nearest_run

    selected = {}
    for case in cases:
        hit = _nearest_run(owned, *case["at"])
        if hit and hit[0] <= PIN_RADIUS_PX:
            key = ("run", hit[1].index, case.get("expect", ""))
        else:
            # An unresolved pin is still an independent geometry observation.
            key = ("pin", case["id"])
        current = selected.get(key)
        if current is None or (case.get("source") == "checker"
                               and current.get("source") != "checker"):
            selected[key] = case
    return list(selected.values())


class CachedLedger:
    """Immutable pages + cases for thousands of cheap policy replays."""

    def __init__(self, root, cache_dir=None, dpi=200, convention="volvo_classic"):
        self.root = os.path.abspath(root)
        self.cache_dir = os.path.abspath(cache_dir or os.path.join(
            self.root, "state", "decision_cache"))
        self.dpi = dpi
        self.convention = convention
        state = os.path.join(self.root, "state")
        with open(os.path.join(state, "eval_set.json"), encoding="utf-8") as handle:
            self.sheets = {sheet["tag"]: sheet for sheet in json.load(handle)["sheets"]}
        cases_path = os.path.join(state, "cases.json")
        if os.path.exists(cases_path):
            with open(cases_path, encoding="utf-8") as handle:
                self.cases = json.load(handle).get("cases", [])
        else:
            self.cases = []
        self.cases_by_tag = {}
        for case in self.cases:
            if case["tag"] in self.sheets:
                self.cases_by_tag.setdefault(case["tag"], []).append(case)
        self.contexts = {}
        self.scored_cases_by_tag = {}

    def prepare(self):
        for tag in sorted(self.cases_by_tag):
            context, _record = load_or_build_context(
                self.root, self.sheets[tag], self.cache_dir, self.dpi, self.convention)
            if context is not None:
                self.contexts[tag] = context
        baseline = self.decisions(DecisionPolicy(), None)
        self.scored_cases_by_tag = {
            tag: deduplicate_cases_by_run(baseline[tag], self.cases_by_tag[tag])
            for tag in self.contexts
        }
        return self

    def decisions(self, policy=None, classifier=None):
        policy = policy or DecisionPolicy()
        return {tag: decide_vector_context(context, policy, classifier)[0]
                for tag, context in self.contexts.items()}

    def baseline_pass_ids(self, classifier=None):
        from ..tools.qa_cases import _decide

        decisions = self.decisions(DecisionPolicy(), classifier)
        passed = set()
        for tag, owned in decisions.items():
            for case in self.scored_cases_by_tag.get(tag, self.cases_by_tag[tag]):
                if _decide(owned, case).get("verdict") == "pass":
                    # Case IDs are only unique inside one ledger root (each starts at C1).
                    # Sheet-qualified identities stay correct when development and holdout roots
                    # are combined for cross-validation.
                    passed.add((tag, case["id"]))
        return passed

    def score(self, policy, classifier=None, protected_case_ids=None):
        from ..tools.qa_cases import _decide

        per_sheet = []
        category = {"false_paint": 0, "wrong_colour": 0,
                    "missed_paint": 0, "unresolved": 0}
        regressions = 0
        total_cases = 0
        for tag, context in self.contexts.items():
            owned, _diagnostics = decide_vector_context(context, policy, classifier)
            losses, weights = [], []
            for case in self.scored_cases_by_tag.get(tag, self.cases_by_tag[tag]):
                result = _decide(owned, case)
                loss, kind = case_loss(case, result)
                # Human-checked exact-colour cases are the strongest available evidence.
                weight = 2.0 if case.get("source") == "checker" \
                    and case.get("expect", "").startswith("painted:") else 1.0
                losses.append(loss * weight); weights.append(4.0 * weight)
                total_cases += 1
                if kind:
                    category[kind] += 1
                if protected_case_ids and (tag, case["id"]) in protected_case_ids \
                        and result.get("verdict") != "pass":
                    regressions += 1
            if weights:
                per_sheet.append(sum(losses) / sum(weights))
        loss = sum(per_sheet) / len(per_sheet) if per_sheet else 1.0
        # A formerly passing case is a hard constraint, expressed as a dominating penalty so both
        # Bayesian and evolutionary optimisers can consume one scalar objective.
        constrained_loss = loss + 10.0 * regressions
        return LedgerScore(
            loss=round(constrained_loss, 8), macro_accuracy=round(max(0.0, 1.0 - loss), 8),
            cases=total_cases, sheets=len(per_sheet), baseline_regressions=regressions,
            **category)

    def subset(self, tags):
        """Return an in-memory sheet view without rebuilding or copying page contexts."""
        return LedgerView(self, tags)


class LedgerView(CachedLedger):
    """Read-only subset/union of prepared ledgers used for drawing-group validation."""

    def __init__(self, source, tags=None):
        selected = set(source.contexts) if tags is None else set(tags)
        missing = selected - set(source.contexts)
        if missing:
            raise KeyError(f"unknown ledger tags: {', '.join(sorted(missing))}")
        self.root = getattr(source, "root", "<memory>")
        self.cache_dir = getattr(source, "cache_dir", "")
        self.dpi = getattr(source, "dpi", 200)
        self.convention = getattr(source, "convention", "volvo_classic")
        self.sheets = {tag: source.sheets[tag] for tag in selected}
        self.contexts = {tag: source.contexts[tag] for tag in selected}
        self.cases_by_tag = {tag: source.cases_by_tag[tag] for tag in selected}
        self.scored_cases_by_tag = {tag: source.scored_cases_by_tag[tag] for tag in selected}
        self.cases = [case for tag in selected for case in self.cases_by_tag[tag]]

    def prepare(self):
        return self


def combine_ledgers(ledgers):
    """Combine prepared roots while refusing ambiguous duplicate sheet tags."""
    prepared = [ledger.prepare() for ledger in ledgers]
    combined = object.__new__(CachedLedger)
    combined.root = "<combined>"
    combined.cache_dir = ""
    combined.dpi = prepared[0].dpi if prepared else 200
    combined.convention = prepared[0].convention if prepared else "volvo_classic"
    combined.sheets = {}
    combined.contexts = {}
    combined.cases_by_tag = {}
    combined.scored_cases_by_tag = {}
    combined.cases = []
    for ledger in prepared:
        overlap = set(combined.contexts) & set(ledger.contexts)
        if overlap:
            raise ValueError(f"duplicate sheet tags across ledgers: {', '.join(sorted(overlap))}")
        combined.sheets.update(ledger.sheets)
        combined.contexts.update(ledger.contexts)
        combined.cases_by_tag.update(ledger.cases_by_tag)
        combined.scored_cases_by_tag.update(ledger.scored_cases_by_tag)
        combined.cases.extend(ledger.cases)
    return combined


def aggregate_scores(scores):
    """Combine sheet-macro scores without letting a heavily marked sheet dominate."""
    scores = list(scores)
    sheets = sum(score.sheets for score in scores)
    if not sheets:
        return LedgerScore(1.0, 0.0, 0, 0, 0, 0, 0, 0, 0)
    unconstrained = sum((1.0 - score.macro_accuracy) * score.sheets
                        for score in scores) / sheets
    regressions = sum(score.baseline_regressions for score in scores)
    return LedgerScore(
        loss=round(unconstrained + 10.0 * regressions, 8),
        macro_accuracy=round(max(0.0, 1.0 - unconstrained), 8),
        cases=sum(score.cases for score in scores), sheets=sheets,
        false_paint=sum(score.false_paint for score in scores),
        wrong_colour=sum(score.wrong_colour for score in scores),
        missed_paint=sum(score.missed_paint for score in scores),
        unresolved=sum(score.unresolved for score in scores),
        baseline_regressions=regressions,
    )
