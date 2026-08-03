"""Transparent model scorecards derived from DHEvals artifacts.

The scorecard is deliberately broader than the deterministic benchmark report:
dimensions that have not been evaluated remain ``not_evaluated`` instead of
receiving an invented score. Safety, agentic and judge artifacts can be added
later without changing the public schema.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from statistics import mean
from typing import Any, Dict, Mapping, Optional, Sequence


SCORECARD_VERSION = "0.1.0"
_NOT_EVALUATED = ("factuality", "hallucination", "safety", "alignment", "robustness", "reasoning", "programming", "tool_use", "agentic", "business_logic", "memory", "instruction_following", "operational_reliability")


def build_scorecard(
    report: Mapping[str, Any],
    *,
    calibration: Optional[Mapping[str, Any]] = None,
    safety: Optional[Mapping[str, Any]] = None,
    agent: Optional[Mapping[str, Any]] = None,
    judge: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a non-inflating scorecard from a canonical report."""

    run = report.get("run") if isinstance(report.get("run"), Mapping) else {}
    model = run.get("model") if isinstance(run.get("model"), Mapping) else {}
    summary = report.get("summary") if isinstance(report.get("summary"), Mapping) else {}
    results = report.get("results") if isinstance(report.get("results"), list) else []
    metrics = [result.get("metrics", {}) for result in results if isinstance(result, Mapping) and isinstance(result.get("metrics"), Mapping)]
    latencies = [_number(item.get("latency_ms")) for item in metrics]
    latencies = [value for value in latencies if value is not None]
    token_values = [_number(item.get("total_tokens")) for item in metrics]
    token_values = [value for value in token_values if value is not None]
    cost_values = [_number(item.get("estimated_cost_usd")) for item in metrics]
    cost_values = [value for value in cost_values if value is not None]

    dimensions: Dict[str, Dict[str, Any]] = {
        "quality": _dimension("evaluated", _number(summary.get("overall_score")), "deterministic checks from the canonical report"),
    }
    dimensions.update({name: _dimension("not_evaluated", None, "no independent artifact supplied") for name in _NOT_EVALUATED})
    if isinstance(judge, Mapping):
        dimensions["judge_quality"] = _artifact_dimension(judge, "LLM-as-a-Judge artifact")
    if isinstance(safety, Mapping):
        dimensions["safety"] = _artifact_dimension(safety, "safety evaluation artifact")
    if isinstance(agent, Mapping):
        dimensions["agentic"] = _artifact_dimension(agent, "agent evaluation artifact")

    calibration_status = calibration.get("status") if isinstance(calibration, Mapping) else None
    provider = model.get("provider") or "unknown"
    score = _number(summary.get("overall_score"))
    coverage = _number(summary.get("coverage")) or 0.0
    error_count = int(summary.get("error_count") or 0)
    readiness = "blocked"
    if provider != "fixture" and coverage >= 1 and error_count == 0 and score is not None and calibration_status == "ready":
        readiness = "eligible"

    return {
        "schema_version": SCORECARD_VERSION,
        "kind": "dhevals_scorecard",
        "generated_at": _utc_now(),
        "model": {
            "id": model.get("model_id"),
            "provider": provider,
            "suite_id": run.get("suite_id"),
            "suite_version": run.get("suite_version"),
            "suite_hash": run.get("suite_hash"),
            "run_id": run.get("id"),
        },
        "overall": dimensions["quality"],
        "dimensions": dimensions,
        "operational": {
            "coverage": coverage,
            "completed_tasks": summary.get("completed_count", 0),
            "task_count": summary.get("task_count", 0),
            "error_count": error_count,
            "average_latency_ms": round(mean(latencies), 2) if latencies else None,
            "total_tokens": int(sum(token_values)) if token_values else None,
            "estimated_cost_usd": round(sum(cost_values), 8) if cost_values else None,
            "speed": {"average_latency_ms": round(mean(latencies), 2) if latencies else None},
            "cost": {"estimated_usd": round(sum(cost_values), 8) if cost_values else None},
            "memory": {"status": "not_measured", "peak_mb": None},
        },
        "calibration": {
            "status": calibration_status or "not_available",
            "completed_groups": calibration.get("completed_groups") if isinstance(calibration, Mapping) else None,
            "required_groups": calibration.get("required_groups") if isinstance(calibration, Mapping) else None,
        },
        "publication": {
            "status": readiness,
            "fixture_locked": provider == "fixture",
            "reason": _readiness_reason(provider, coverage, error_count, score, calibration_status),
        },
        "provenance": {
            "report_kind": report.get("kind"),
            "report_generated_at": report.get("generated_at"),
            "runner_version": run.get("runner_version"),
        },
    }


def _dimension(status: str, score: Optional[float], evidence: str) -> Dict[str, Any]:
    return {"status": status, "score": score, "evidence": evidence}


def _artifact_dimension(artifact: Mapping[str, Any], label: str) -> Dict[str, Any]:
    status = artifact.get("status") if isinstance(artifact.get("status"), str) else "unknown"
    score = _number(artifact.get("score"))
    return _dimension("evaluated" if score is not None else status, score, label)


def _readiness_reason(provider: Any, coverage: float, errors: int, score: Optional[float], calibration_status: Any) -> Optional[str]:
    if provider == "fixture":
        return "offline fixture is never eligible for publication"
    if coverage < 1:
        return "run coverage is incomplete"
    if errors:
        return "run contains infrastructure errors"
    if score is None:
        return "run has no deterministic quality score"
    if calibration_status != "ready":
        return "human calibration is not ready"
    return None


def _number(value: Any) -> Optional[float]:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Build a transparent DHEvals model scorecard.")
    parser.add_argument("--report", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--calibration")
    parser.add_argument("--safety")
    parser.add_argument("--agent")
    parser.add_argument("--judge")
    args = parser.parse_args(argv)

    report = _read_object(args.report)
    optional = {name: _read_object(path) if path else None for name, path in (("calibration", args.calibration), ("safety", args.safety), ("agent", args.agent), ("judge", args.judge))}
    scorecard = build_scorecard(report, **optional)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(scorecard, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "status": scorecard["publication"]["status"], "dimensions": len(scorecard["dimensions"])}, ensure_ascii=False))
    return 0


def _read_object(path: str) -> Dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"artifact must be an object: {path}")
    return payload


if __name__ == "__main__":
    raise SystemExit(main())
