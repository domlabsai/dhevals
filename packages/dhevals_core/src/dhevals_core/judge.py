"""Contracts for an auditable LLM-as-a-Judge artifact.

The judge is an independent measurement lane. It never silently replaces the
deterministic quality score: a missing or incomplete judge artifact remains
``not_evaluated`` in the scorecard.
"""

from __future__ import annotations

from datetime import datetime, timezone
import argparse
import json
from pathlib import Path
from statistics import mean
from typing import Any, Dict, List, Mapping, Optional, Sequence


JUDGE_SCHEMA_VERSION = "0.1.0"
_STATUSES = {"not_evaluated", "draft", "evaluated", "ready", "invalid"}


class JudgeValidationError(ValueError):
    """Raised when a judge artifact is unsafe or incomplete."""


def validate_judge_artifact(payload: Mapping[str, Any], *, require_ready: bool = False) -> Dict[str, Any]:
    if not isinstance(payload, Mapping):
        raise JudgeValidationError("judge artifact must be an object")
    if payload.get("kind") != "dhevals_judge_artifact":
        raise JudgeValidationError("unsupported judge artifact kind")
    if payload.get("schema_version") != JUDGE_SCHEMA_VERSION:
        raise JudgeValidationError("unsupported judge artifact schema_version")
    status = payload.get("status")
    if status not in _STATUSES:
        raise JudgeValidationError("judge status is invalid")
    judge_model = payload.get("judge_model")
    if not isinstance(judge_model, Mapping) or not _string(judge_model.get("id")):
        raise JudgeValidationError("judge_model.id is required")
    rubric_hash = payload.get("rubric_hash")
    if not _string(rubric_hash):
        raise JudgeValidationError("rubric_hash is required")
    evaluations = payload.get("evaluations", [])
    if not isinstance(evaluations, list):
        raise JudgeValidationError("evaluations must be a list")
    seen = set()
    normalized: List[Dict[str, Any]] = []
    for index, evaluation in enumerate(evaluations):
        context = f"evaluations[{index}]"
        if not isinstance(evaluation, Mapping):
            raise JudgeValidationError(f"{context} must be an object")
        task_id = _string(evaluation.get("task_id"))
        dimension_id = _string(evaluation.get("dimension_id"))
        if not task_id or not dimension_id:
            raise JudgeValidationError(f"{context} requires task_id and dimension_id")
        key = (task_id, dimension_id)
        if key in seen:
            raise JudgeValidationError(f"duplicate judge evaluation: {task_id}/{dimension_id}")
        seen.add(key)
        score = evaluation.get("score")
        if isinstance(score, bool) or not isinstance(score, (int, float)) or not 0 <= float(score) <= 1:
            raise JudgeValidationError(f"{context}.score must be between 0 and 1")
        evidence = _string(evaluation.get("evidence"))
        if status in {"evaluated", "ready"} and not evidence:
            raise JudgeValidationError(f"{context}.evidence is required for evaluated artifacts")
        normalized.append({**dict(evaluation), "task_id": task_id, "dimension_id": dimension_id, "score": float(score), "evidence": evidence or None})

    score = _number(payload.get("score"))
    if status in {"evaluated", "ready"}:
        if not normalized:
            raise JudgeValidationError("evaluated judge artifact requires evaluations")
        expected_score = round(mean(item["score"] for item in normalized), 4)
        if score is None or abs(score - expected_score) > 0.001:
            raise JudgeValidationError("judge score must equal the mean of evaluations")
    elif score is not None:
        raise JudgeValidationError("non-evaluated judge artifacts cannot contain a score")
    if require_ready and status != "ready":
        raise JudgeValidationError("judge artifact is not ready")
    return {**dict(payload), "evaluations": normalized, "score": score}


def summarize_judge(
    evaluations: Sequence[Mapping[str, Any]],
    *,
    judge_model_id: str,
    rubric_hash: str,
    status: str = "evaluated",
    metadata: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a canonical judge artifact after independent review."""

    rows = [dict(item) for item in evaluations]
    score = round(mean(float(item["score"]) for item in rows), 4) if rows else None
    artifact = {
        "schema_version": JUDGE_SCHEMA_VERSION,
        "kind": "dhevals_judge_artifact",
        "status": status,
        "generated_at": _utc_now(),
        "judge_model": {"id": judge_model_id},
        "rubric_hash": rubric_hash,
        "evaluations": rows,
        "score": score,
        "metadata": dict(metadata or {}),
    }
    return validate_judge_artifact(artifact)


def _string(value: Any) -> Optional[str]:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _number(value: Any) -> Optional[float]:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Validate an auditable DHEvals LLM-as-a-Judge artifact.")
    parser.add_argument("--input", required=True, help="Judge artifact JSON")
    parser.add_argument("--output", required=True, help="Validated artifact output JSON")
    parser.add_argument("--require-ready", action="store_true")
    args = parser.parse_args(argv)
    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    validated = validate_judge_artifact(payload, require_ready=args.require_ready)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(validated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "status": validated["status"], "evaluations": len(validated["evaluations"])}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
