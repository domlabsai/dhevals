"""Publication-safe leaderboard derived from canonical DHEvals reports."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .reporting import REPORT_VERSION


def build_leaderboard(
    reports: Iterable[Mapping[str, Any]],
    calibration: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    entries: List[Dict[str, Any]] = []
    calibration_status = calibration.get("status") if isinstance(calibration, Mapping) else None
    calibration_ready = calibration_status == "ready"
    for report in reports:
        run = report.get("run") if isinstance(report.get("run"), dict) else {}
        summary = report.get("summary") if isinstance(report.get("summary"), dict) else {}
        model = run.get("model") if isinstance(run.get("model"), dict) else {}
        provider = model.get("provider") or "unknown"
        coverage = _number(summary.get("coverage")) or 0.0
        errors = int(summary.get("error_count") or 0)
        score = _number(summary.get("overall_score"))
        eligible = (
            provider != "fixture"
            and coverage >= 1.0
            and errors == 0
            and score is not None
            and (calibration is None or calibration_ready)
        )
        lock_reason = None
        if provider == "fixture":
            lock_reason = "offline fixture is not a public model run"
        elif coverage < 1.0:
            lock_reason = "run coverage is incomplete"
        elif errors:
            lock_reason = "run contains infrastructure errors"
        elif score is None:
            lock_reason = "run has no quality score"
        elif calibration is not None and not calibration_ready:
            lock_reason = "human calibration is not ready"
        entries.append({
            "run_id": run.get("id"),
            "model_id": model.get("model_id"),
            "provider": provider,
            "suite_id": run.get("suite_id"),
            "suite_version": run.get("suite_version"),
            "coverage": coverage,
            "score": score if eligible else None,
            "publication_status": "eligible" if eligible else "locked",
            "lock_reason": lock_reason,
            "calibration_status": calibration_status,
        })
    entries.sort(key=lambda entry: (entry["publication_status"] != "eligible", -(entry["score"] or 0), entry.get("model_id") or ""))
    for rank, entry in enumerate((item for item in entries if item["publication_status"] == "eligible"), start=1):
        entry["rank"] = rank
    return {
        "schema_version": REPORT_VERSION,
        "kind": "dhevals_leaderboard",
        "generated_at": _utc_now(),
        "status": "ready" if entries and all(item["publication_status"] == "eligible" for item in entries) else "draft_locked",
        "methodology": {
            "ranking_field": "score",
            "requires_full_coverage": True,
            "fixture_scores_are_never_published": True,
            "human_calibration_required": calibration is not None,
        },
        "calibration": {
            "status": calibration_status,
            "ready": calibration_ready if calibration is not None else None,
        },
        "entries": entries,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build a publication-safe DHEvals leaderboard.")
    parser.add_argument("--input", action="append", required=True, help="Canonical report JSON; repeat for multiple runs")
    parser.add_argument("--output", required=True, help="Leaderboard JSON output path")
    parser.add_argument("--calibration-summary", help="Optional calibration summary JSON; real runs stay locked until it is ready")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    reports = []
    for input_path in args.input:
        payload = json.loads(Path(input_path).read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError(f"report must be an object: {input_path}")
        reports.append(payload)
    calibration = None
    if args.calibration_summary:
        calibration = json.loads(Path(args.calibration_summary).read_text(encoding="utf-8"))
        if not isinstance(calibration, dict):
            raise ValueError("calibration summary must be an object")
    leaderboard = build_leaderboard(reports, calibration=calibration)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(leaderboard, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": args.output, "entries": len(leaderboard["entries"]), "status": leaderboard["status"]}, ensure_ascii=False))
    return 0


def _number(value: Any) -> Optional[float]:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
