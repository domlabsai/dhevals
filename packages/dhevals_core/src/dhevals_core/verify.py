"""Reproducibility verification for DHEvals run and report artifacts."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Sequence

from .models import SuiteSpec


ALLOWED_STATUSES = {"pass", "partial", "fail", "error", "not_applicable"}
COMPLETED_STATUSES = {"pass", "partial", "fail"}


def verify_run(
    artifact: Mapping[str, Any],
    suite: SuiteSpec,
    report: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Verify that a run (and optional derived report) matches its suite.

    Verification is intentionally strict about identity and aggregation, but it
    does not judge the quality of an output. Quality remains the responsibility
    of deterministic checks and the human calibration gate.
    """

    errors: list[str] = []
    warnings: list[str] = []
    run = artifact.get("run") if isinstance(artifact.get("run"), Mapping) else {}
    summary = artifact.get("summary") if isinstance(artifact.get("summary"), Mapping) else {}
    raw_results = artifact.get("results")
    results = raw_results if isinstance(raw_results, list) else []
    if not isinstance(raw_results, list):
        errors.append("artifact.results must be an array")

    _check_identity(run, suite, errors, "run")
    model = run.get("model") if isinstance(run.get("model"), Mapping) else {}
    if not isinstance(run.get("model"), Mapping):
        errors.append("run.model must be an object")
    else:
        for field in ("model_id", "provider"):
            if not isinstance(model.get(field), str) or not model[field].strip():
                errors.append(f"run.model.{field} must be a non-empty string")

    task_map = {task.id: task for task in suite.tasks}
    seen_task_ids: set[str] = set()
    valid_results = []
    for index, result in enumerate(results):
        context = f"results[{index}]"
        if not isinstance(result, Mapping):
            errors.append(f"{context} must be an object")
            continue
        task_id = result.get("task_id")
        if not isinstance(task_id, str) or not task_id.strip():
            errors.append(f"{context}.task_id must be a non-empty string")
            continue
        if task_id in seen_task_ids:
            errors.append(f"duplicate result for task {task_id!r}")
        seen_task_ids.add(task_id)
        task = task_map.get(task_id)
        if task is None:
            errors.append(f"{context}.task_id {task_id!r} is not in the suite")
            continue
        for field, expected in (("title", task.title), ("category", task.category), ("prompt", task.effective_prompt())):
            if result.get(field) != expected:
                errors.append(f"{context}.{field} does not match suite task {task_id!r}")
        status = result.get("status")
        if status not in ALLOWED_STATUSES:
            errors.append(f"{context}.status must be one of {sorted(ALLOWED_STATUSES)}")
        score = result.get("score")
        if status == "error" and score is not None:
            errors.append(f"{context}.score must be null for an infrastructure error")
        elif score is not None and (isinstance(score, bool) or not isinstance(score, (int, float)) or not 0 <= float(score) <= 1):
            errors.append(f"{context}.score must be null or a number between 0 and 1")
        if not isinstance(result.get("checks"), list):
            errors.append(f"{context}.checks must be an array")
        if not isinstance(result.get("metrics"), Mapping):
            errors.append(f"{context}.metrics must be an object")
        valid_results.append(result)

    missing_tasks = sorted(set(task_map) - seen_task_ids)
    if missing_tasks:
        errors.append("missing results for tasks: " + ", ".join(missing_tasks))
    if len(results) != len(suite.tasks):
        errors.append(f"artifact has {len(results)} results but suite has {len(suite.tasks)} tasks")

    expected_completed = sum(result.get("status") in COMPLETED_STATUSES for result in valid_results)
    expected_coverage = _ratio(expected_completed, len(suite.tasks))
    score_values = [float(result["score"]) for result in valid_results if isinstance(result.get("score"), (int, float)) and not isinstance(result.get("score"), bool)]
    expected_score = round(sum(score_values) / len(score_values), 4) if score_values else None
    if summary.get("task_count") != len(suite.tasks):
        errors.append("summary.task_count does not match suite task count")
    if summary.get("completed_count") != expected_completed:
        errors.append("summary.completed_count does not match result statuses")
    if not _same_number(summary.get("coverage"), expected_coverage):
        errors.append("summary.coverage does not match result statuses")
    if not _same_optional_number(summary.get("overall_score"), expected_score):
        errors.append("summary.overall_score does not match result scores")

    if report is not None:
        _verify_report(report, artifact, errors, warnings)

    return {
        "kind": "dhevals_verification",
        "status": "valid" if not errors else "invalid",
        "run_id": run.get("id"),
        "suite_id": suite.id,
        "suite_version": suite.version,
        "suite_hash": suite.content_hash,
        "checked": {
            "task_count": len(suite.tasks),
            "result_count": len(results),
            "report": report is not None,
        },
        "errors": errors,
        "warnings": warnings,
        "verified_at": _utc_now(),
    }


def verify_run_file(
    artifact_path: str | Path,
    suite_path: str | Path,
    report_path: str | Path | None = None,
) -> Dict[str, Any]:
    suite = _load_json(Path(suite_path), "suite")
    artifact = _load_json(Path(artifact_path), "run artifact")
    report = _load_json(Path(report_path), "report") if report_path else None
    from .models import suite_from_dict

    return verify_run(artifact, suite_from_dict(suite), report=report)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Verify a DHEvals run artifact against its suite manifest.")
    parser.add_argument("--artifact", required=True, help="Run artifact JSON")
    parser.add_argument("--suite", required=True, help="Suite manifest JSON")
    parser.add_argument("--report", help="Optional derived report JSON")
    parser.add_argument("--output", help="Optional verification JSON output")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    verification = verify_run_file(args.artifact, args.suite, args.report)
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(verification, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(verification, ensure_ascii=False))
    return 0 if verification["status"] == "valid" else 2


def _check_identity(run: Mapping[str, Any], suite: SuiteSpec, errors: list[str], context: str) -> None:
    expected = {
        "suite_id": suite.id,
        "suite_version": suite.version,
        "suite_hash": suite.content_hash,
    }
    for field, value in expected.items():
        if run.get(field) != value:
            errors.append(f"{context}.{field} does not match suite")


def _verify_report(report: Mapping[str, Any], artifact: Mapping[str, Any], errors: list[str], warnings: list[str]) -> None:
    if report.get("kind") != "dhevals_report":
        errors.append("report.kind must be dhevals_report")
    report_run = report.get("run") if isinstance(report.get("run"), Mapping) else {}
    artifact_run = artifact.get("run") if isinstance(artifact.get("run"), Mapping) else {}
    for field in ("id", "suite_id", "suite_version", "suite_hash"):
        if report_run.get(field) != artifact_run.get(field):
            errors.append(f"report.run.{field} does not match run artifact")
    report_results = report.get("results")
    artifact_results = artifact.get("results")
    if not isinstance(report_results, list):
        errors.append("report.results must be an array")
    elif isinstance(artifact_results, list) and len(report_results) != len(artifact_results):
        errors.append("report.results count does not match run artifact")
    elif isinstance(artifact_results, list):
        for index, (report_result, artifact_result) in enumerate(zip(report_results, artifact_results)):
            if not isinstance(report_result, Mapping) or not isinstance(artifact_result, Mapping):
                errors.append(f"report.results[{index}] must mirror an object result")
                continue
            for field in ("task_id", "status", "score", "prompt"):
                if report_result.get(field) != artifact_result.get(field):
                    errors.append(f"report.results[{index}].{field} does not match run artifact")
    report_summary = report.get("summary") if isinstance(report.get("summary"), Mapping) else {}
    artifact_summary = artifact.get("summary") if isinstance(artifact.get("summary"), Mapping) else {}
    for field in ("task_count", "completed_count", "coverage", "overall_score"):
        if field in report_summary and not _same_optional_number(report_summary.get(field), artifact_summary.get(field)):
            errors.append(f"report.summary.{field} does not match run artifact")
    if report.get("generated_at") is None:
        warnings.append("report.generated_at is missing")


def _load_json(path: Path, label: str) -> Mapping[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"{label} not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label} is not valid JSON: {path}") from exc
    if not isinstance(payload, Mapping):
        raise ValueError(f"{label} must be a JSON object: {path}")
    return payload


def _ratio(numerator: int, denominator: int) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


def _same_number(value: Any, expected: float) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isclose(float(value), expected, abs_tol=0.0001)


def _same_optional_number(value: Any, expected: Optional[float]) -> bool:
    if expected is None:
        return value is None
    return _same_number(value, expected)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
