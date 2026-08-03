"""Human calibration worksheet validation for rubric-backed benchmark suites."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple


ANCHOR_LEVELS = (0, 1, 2, 3, 4)


def required_anchor_groups(rubric: Mapping[str, Any]) -> List[Tuple[str, str, int]]:
    groups: List[Tuple[str, str, int]] = []
    tasks = rubric.get("tasks") if isinstance(rubric.get("tasks"), dict) else {}
    for task_id, task in tasks.items():
        dimensions = task.get("dimensions") if isinstance(task, dict) else []
        for dimension in dimensions if isinstance(dimensions, list) else []:
            if isinstance(dimension, dict) and isinstance(dimension.get("id"), str):
                groups.extend((task_id, dimension["id"], level) for level in ANCHOR_LEVELS)
    return groups


def summarize_calibration(
    rubric: Mapping[str, Any],
    responses: Iterable[Mapping[str, Any]],
    min_reviewers: int = 2,
    max_allowed_range: int = 1,
    adjudications: Optional[Iterable[Mapping[str, Any]]] = None,
) -> Dict[str, Any]:
    required = required_anchor_groups(rubric)
    grouped: Dict[Tuple[str, str, int], List[Mapping[str, Any]]] = {group: [] for group in required}
    validation_errors: List[str] = []
    seen = set()
    for index, response in enumerate(responses):
        if not isinstance(response, Mapping):
            validation_errors.append(f"responses[{index}] must be an object")
            continue
        task_id = response.get("task_id")
        dimension_id = response.get("dimension_id")
        anchor_level = response.get("anchor_level")
        reviewer_id = response.get("reviewer_id")
        score = response.get("score")
        if not isinstance(task_id, str) or not isinstance(dimension_id, str):
            validation_errors.append(f"responses[{index}] requires task_id and dimension_id")
            continue
        if anchor_level not in ANCHOR_LEVELS:
            validation_errors.append(f"responses[{index}].anchor_level must be one of 0..4")
            continue
        if not isinstance(reviewer_id, str) or not reviewer_id.strip():
            validation_errors.append(f"responses[{index}].reviewer_id must be non-empty")
            continue
        if isinstance(score, bool) or not isinstance(score, (int, float)) or not 0 <= score <= 4:
            validation_errors.append(f"responses[{index}].score must be a number between 0 and 4")
            continue
        key = (task_id, dimension_id, int(anchor_level), reviewer_id)
        if key in seen:
            validation_errors.append(f"duplicate response for {key}")
            continue
        seen.add(key)
        group = key[:3]
        if group not in grouped:
            validation_errors.append(f"response points to unknown anchor group {group}")
            continue
        grouped[group].append(response)

    adjudication_map: Dict[Tuple[str, str, int], Mapping[str, Any]] = {}
    for index, adjudication in enumerate(adjudications or []):
        if not isinstance(adjudication, Mapping):
            validation_errors.append(f"adjudications[{index}] must be an object")
            continue
        task_id = adjudication.get("task_id")
        dimension_id = adjudication.get("dimension_id")
        anchor_level = adjudication.get("anchor_level")
        score = adjudication.get("score")
        if not isinstance(task_id, str) or not isinstance(dimension_id, str):
            validation_errors.append(f"adjudications[{index}] requires task_id and dimension_id")
            continue
        if anchor_level not in ANCHOR_LEVELS:
            validation_errors.append(f"adjudications[{index}].anchor_level must be one of 0..4")
            continue
        if isinstance(score, bool) or not isinstance(score, (int, float)) or not 0 <= score <= 4:
            validation_errors.append(f"adjudications[{index}].score must be a number between 0 and 4")
            continue
        group = (task_id, dimension_id, int(anchor_level))
        if group not in grouped:
            validation_errors.append(f"adjudication points to unknown anchor group {group}")
            continue
        if group in adjudication_map:
            validation_errors.append(f"duplicate adjudication for {group}")
            continue
        adjudication_map[group] = adjudication

    group_summaries: List[Dict[str, Any]] = []
    missing_groups = []
    disagreement_groups = []
    adjudicated_groups = []
    for task_id, dimension_id, anchor_level in required:
        group_responses = grouped[(task_id, dimension_id, anchor_level)]
        scores = [float(response["score"]) for response in group_responses]
        response_summary = {
            "task_id": task_id,
            "dimension_id": dimension_id,
            "anchor_level": anchor_level,
            "reviewer_count": len(scores),
            "mean_score": round(sum(scores) / len(scores), 3) if scores else None,
            "range": round(max(scores) - min(scores), 3) if scores else None,
            "status": "pending",
        }
        if len(scores) < min_reviewers:
            missing_groups.append((task_id, dimension_id, anchor_level))
        elif response_summary["range"] > max_allowed_range:
            adjudication = adjudication_map.get((task_id, dimension_id, anchor_level))
            if adjudication is None:
                response_summary["status"] = "adjudication_required"
                disagreement_groups.append((task_id, dimension_id, anchor_level))
            else:
                response_summary["status"] = "calibrated"
                response_summary["adjudicated_score"] = float(adjudication["score"])
                if adjudication.get("notes"):
                    response_summary["adjudication_notes"] = adjudication["notes"]
                adjudicated_groups.append((task_id, dimension_id, anchor_level))
        else:
            response_summary["status"] = "calibrated"
        group_summaries.append(response_summary)

    if validation_errors:
        status = "invalid"
    elif disagreement_groups:
        status = "adjudication_required"
    elif missing_groups:
        status = "pending"
    else:
        status = "ready"
    return {
        "suite_id": rubric.get("suite_id"),
        "suite_version": rubric.get("suite_version"),
        "status": status,
        "reviewers_required": min_reviewers,
        "max_allowed_range": max_allowed_range,
        "required_groups": len(required),
        "completed_groups": len(required) - len(missing_groups) - len(disagreement_groups),
        "missing_groups": [list(group) for group in missing_groups],
        "disagreement_groups": [list(group) for group in disagreement_groups],
        "adjudicated_groups": [list(group) for group in adjudicated_groups],
        "validation_errors": validation_errors,
        "groups": group_summaries,
        "generated_at": _utc_now(),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate DHEvals human calibration responses.")
    parser.add_argument("--rubric", required=True, help="Anchor rubric JSON")
    parser.add_argument("--responses", required=True, help="Calibration responses JSON")
    parser.add_argument("--output", required=True, help="Calibration summary JSON")
    parser.add_argument("--min-reviewers", type=int, default=2)
    parser.add_argument("--max-range", type=int, default=1)
    parser.add_argument(
        "--freeze-rubric",
        help="Optional output path for a non-mutating calibrated rubric snapshot; only written when status is ready",
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    rubric = json.loads(Path(args.rubric).read_text(encoding="utf-8"))
    payload = json.loads(Path(args.responses).read_text(encoding="utf-8"))
    responses = payload.get("responses") if isinstance(payload, dict) else None
    if not isinstance(responses, list):
        raise ValueError("responses file must contain a responses array")
    adjudications = payload.get("adjudications", []) if isinstance(payload, dict) else []
    if not isinstance(adjudications, list):
        raise ValueError("responses file adjudications must be an array when present")
    summary = summarize_calibration(
        rubric,
        responses,
        min_reviewers=args.min_reviewers,
        max_allowed_range=args.max_range,
        adjudications=adjudications,
    )
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    frozen_path = None
    if args.freeze_rubric and summary["status"] == "ready":
        frozen = dict(rubric)
        frozen["status"] = "calibrated"
        frozen["calibration"] = {
            "status": summary["status"],
            "required_groups": summary["required_groups"],
            "completed_groups": summary["completed_groups"],
            "reviewers_required": summary["reviewers_required"],
            "max_allowed_range": summary["max_allowed_range"],
            "summary_output": str(output_path),
        }
        frozen_path = Path(args.freeze_rubric)
        frozen_path.parent.mkdir(parents=True, exist_ok=True)
        frozen_path.write_text(json.dumps(frozen, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": args.output, "status": summary["status"], "completed_groups": summary["completed_groups"], "required_groups": summary["required_groups"], "frozen_rubric": str(frozen_path) if frozen_path else None}, ensure_ascii=False))
    return 0 if summary["status"] == "ready" else 2


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
