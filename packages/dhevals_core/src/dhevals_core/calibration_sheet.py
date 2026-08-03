"""CSV worksheet export/import for the DHEvals human calibration gate.

The worksheet is intentionally a flat, review-friendly representation of the
rubric's task/dimension/anchor matrix.  Examples are repeated for each rubric
dimension so reviewers can score one dimension at a time without having to
switch between files.  Importing a partially completed sheet is supported: the
calibration gate will report the remaining groups as ``pending``.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from .calibration import required_anchor_groups, summarize_calibration
from .models import sha256_json


SHEET_FIELDS = [
    "task_id",
    "dimension_id",
    "dimension_guidance",
    "anchor_level",
    "example_output",
    "example_target",
    "reviewer_a_score",
    "reviewer_a_notes",
    "reviewer_b_score",
    "reviewer_b_notes",
    "adjudicated_score",
    "adjudication_notes",
]

BLIND_SHEET_FIELDS = [
    "task_id",
    "dimension_id",
    "dimension_guidance",
    "anchor_level",
    "example_output",
    "example_target",
    "score",
    "notes",
]

ADJUDICATION_FIELDS = [
    "task_id",
    "dimension_id",
    "dimension_guidance",
    "anchor_level",
    "example_output",
    "example_target",
    "adjudicated_score",
    "adjudication_notes",
]

PACK_SCHEMA_VERSION = "0.1.0"
PACK_KIND = "dhevals_calibration_pack"
ANCHOR_FIELDS = (
    "task_id",
    "dimension_id",
    "dimension_guidance",
    "anchor_level",
    "example_output",
    "example_target",
)

REVIEWER_COLUMNS = (
    ("reviewer_a_score", "reviewer_a_notes", "reviewer-a"),
    ("reviewer_b_score", "reviewer_b_notes", "reviewer-b"),
)


def write_review_sheet(
    rubric_path: str | Path,
    examples_path: str | Path,
    output_path: str | Path,
) -> Dict[str, Any]:
    """Write a deterministic CSV worksheet for every required anchor group."""

    rubric = _read_json(rubric_path, "rubric")
    examples = _read_json(examples_path, "anchor examples")
    rows = _build_anchor_rows(rubric, examples)

    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=SHEET_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    return {
        "output": str(destination),
        "suite_id": rubric.get("suite_id"),
        "suite_version": rubric.get("suite_version"),
        "rows": len(rows),
        "fields": SHEET_FIELDS,
    }


def write_blind_review_sheets(
    rubric_path: str | Path,
    examples_path: str | Path,
    output_dir: str | Path,
    reviewer_ids: Sequence[str] = ("reviewer-a", "reviewer-b"),
    manifest_output: str | Path | None = None,
) -> Dict[str, Any]:
    """Write one independent worksheet per reviewer without exposing peer scores."""

    rubric = _read_json(rubric_path, "rubric")
    examples = _read_json(examples_path, "anchor examples")
    normalized_reviewers = [_normalize_reviewer_id(reviewer_id) for reviewer_id in reviewer_ids]
    if len(normalized_reviewers) < 2 or len(set(normalized_reviewers)) != len(normalized_reviewers):
        raise ValueError("blind export requires at least two unique reviewer ids")
    rows = _build_anchor_rows(rubric, examples)
    anchor_fingerprint = _anchor_fingerprint(rows)
    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)
    paths = []
    for reviewer_id in normalized_reviewers:
        path = destination / f"{reviewer_id}.csv"
        blind_rows = [
            {
                "task_id": row["task_id"],
                "dimension_id": row["dimension_id"],
                "dimension_guidance": row["dimension_guidance"],
                "anchor_level": row["anchor_level"],
                "example_output": row["example_output"],
                "example_target": row["example_target"],
                "score": "",
                "notes": "",
            }
            for row in rows
        ]
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=BLIND_SHEET_FIELDS, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(blind_rows)
        paths.append(str(path))
    result = {
        "output_dir": str(destination),
        "suite_id": rubric.get("suite_id"),
        "suite_version": rubric.get("suite_version"),
        "reviewers": normalized_reviewers,
        "rows_per_reviewer": len(rows),
        "paths": paths,
    }
    if manifest_output:
        manifest = _build_pack_manifest(
            rubric=rubric,
            examples=examples,
            rows=rows,
            reviewer_ids=normalized_reviewers,
            paths=paths,
            output_dir=destination,
        )
        manifest_path = Path(manifest_output)
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result["manifest"] = str(manifest_path)
        result["anchor_fingerprint"] = anchor_fingerprint
    return result


def import_review_sheet(
    sheet_path: str | Path,
    output_path: str | Path,
    rubric_path: str | Path | None = None,
) -> Dict[str, Any]:
    """Convert reviewer columns in a CSV worksheet into calibration JSON."""

    source = Path(sheet_path)
    with source.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        missing_fields = [field for field in SHEET_FIELDS if field not in fieldnames]
        if missing_fields:
            raise ValueError("worksheet is missing columns: " + ", ".join(missing_fields))
        rows = list(reader)

    required_groups = None
    suite_id = None
    suite_version = None
    if rubric_path is not None:
        rubric = _read_json(rubric_path, "rubric")
        required_groups = set(required_anchor_groups(rubric))
        suite_id = rubric.get("suite_id")
        suite_version = rubric.get("suite_version")

    responses: List[Dict[str, Any]] = []
    adjudications: List[Dict[str, Any]] = []
    seen: set[Tuple[str, str, int, str]] = set()
    imported_rows = 0
    for row_number, row in enumerate(rows, start=2):
        task_id = _required_text(row.get("task_id"), "task_id", row_number)
        dimension_id = _required_text(row.get("dimension_id"), "dimension_id", row_number)
        anchor_level = _parse_anchor_level(row.get("anchor_level"), row_number)
        group = (task_id, dimension_id, anchor_level)
        if required_groups is not None and group not in required_groups:
            raise ValueError(f"row {row_number} points to unknown anchor group {group}")
        imported_rows += 1

        for score_column, notes_column, reviewer_id in REVIEWER_COLUMNS:
            raw_score = row.get(score_column, "")
            if raw_score is None or not str(raw_score).strip():
                continue
            score = _parse_score(raw_score, score_column, row_number)
            key = (*group, reviewer_id)
            if key in seen:
                raise ValueError(f"duplicate {reviewer_id} response for {group} (row {row_number})")
            seen.add(key)
            response: Dict[str, Any] = {
                "task_id": task_id,
                "dimension_id": dimension_id,
                "anchor_level": anchor_level,
                "reviewer_id": reviewer_id,
                "score": score,
            }
            notes = str(row.get(notes_column, "") or "").strip()
            if notes:
                response["notes"] = notes
            responses.append(response)

        raw_adjudicated = row.get("adjudicated_score", "")
        if raw_adjudicated is not None and str(raw_adjudicated).strip():
            adjudication: Dict[str, Any] = {
                "task_id": task_id,
                "dimension_id": dimension_id,
                "anchor_level": anchor_level,
                "score": _parse_score(raw_adjudicated, "adjudicated_score", row_number),
            }
            notes = str(row.get("adjudication_notes", "") or "").strip()
            if notes:
                adjudication["notes"] = notes
            adjudications.append(adjudication)

    payload: Dict[str, Any] = {
        "suite_id": suite_id,
        "suite_version": suite_version,
        "source_sheet": str(source),
        "responses": responses,
        "adjudications": adjudications,
    }
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {
        "output": str(destination),
        "suite_id": suite_id,
        "suite_version": suite_version,
        "rows": imported_rows,
        "responses": len(responses),
        "adjudications": len(adjudications),
    }


def import_blind_review_sheets(
    sheet_paths: Iterable[str | Path],
    output_path: str | Path,
    rubric_path: str | Path | None = None,
    pack_path: str | Path | None = None,
) -> Dict[str, Any]:
    """Merge independent reviewer worksheets into the calibration response JSON."""

    sheet_paths = list(sheet_paths)
    pack = _load_pack(pack_path) if pack_path else None
    if pack is not None:
        _validate_pack_inputs(pack, sheet_paths, rubric_path)
    required_groups = None
    suite_id = None
    suite_version = None
    if rubric_path is not None:
        rubric = _read_json(rubric_path, "rubric")
        required_groups = set(required_anchor_groups(rubric))
        suite_id = rubric.get("suite_id")
        suite_version = rubric.get("suite_version")

    responses: List[Dict[str, Any]] = []
    seen: set[Tuple[str, str, int, str]] = set()
    rows_by_file: Dict[str, int] = {}
    for sheet_path in sheet_paths:
        source = Path(sheet_path)
        reviewer_id = _normalize_reviewer_id(source.stem)
        with source.open("r", newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            fieldnames = reader.fieldnames or []
            missing_fields = [field for field in BLIND_SHEET_FIELDS if field not in fieldnames]
            if missing_fields:
                raise ValueError(f"blind worksheet {source} is missing columns: {', '.join(missing_fields)}")
            rows = list(reader)
        rows_by_file[str(source)] = len(rows)
        if pack is not None:
            expected_rows = pack.get("required_groups")
            if len(rows) != expected_rows:
                raise ValueError(f"blind worksheet {source} has {len(rows)} rows; pack requires {expected_rows}")
            fingerprint = _anchor_fingerprint(rows)
            if fingerprint != pack.get("anchor_fingerprint"):
                raise ValueError(f"blind worksheet {source} anchor fingerprint does not match calibration pack")
        for row_number, row in enumerate(rows, start=2):
            task_id = _required_text(row.get("task_id"), "task_id", row_number)
            dimension_id = _required_text(row.get("dimension_id"), "dimension_id", row_number)
            anchor_level = _parse_anchor_level(row.get("anchor_level"), row_number)
            group = (task_id, dimension_id, anchor_level)
            if required_groups is not None and group not in required_groups:
                raise ValueError(f"worksheet {source} row {row_number} points to unknown anchor group {group}")
            raw_score = row.get("score", "")
            if raw_score is None or not str(raw_score).strip():
                continue
            key = (*group, reviewer_id)
            if key in seen:
                raise ValueError(f"duplicate {reviewer_id} response for {group}")
            seen.add(key)
            response: Dict[str, Any] = {
                "task_id": task_id,
                "dimension_id": dimension_id,
                "anchor_level": anchor_level,
                "reviewer_id": reviewer_id,
                "score": _parse_score(raw_score, "score", row_number),
            }
            notes = str(row.get("notes", "") or "").strip()
            if notes:
                response["notes"] = notes
            responses.append(response)

    payload: Dict[str, Any] = {
        "suite_id": suite_id,
        "suite_version": suite_version,
        "source_sheets": [str(path) for path in sheet_paths],
        "responses": responses,
        "adjudications": [],
    }
    if pack is not None:
        payload["pack"] = {
            "path": str(pack_path),
            "id": pack.get("pack_id"),
            "anchor_fingerprint": pack.get("anchor_fingerprint"),
            "rubric_sha256": pack.get("rubric_sha256"),
            "examples_sha256": pack.get("examples_sha256"),
        }
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {
        "output": str(destination),
        "suite_id": suite_id,
        "suite_version": suite_version,
        "files": rows_by_file,
        "responses": len(responses),
    }


def write_adjudication_sheet(
    rubric_path: str | Path,
    examples_path: str | Path,
    responses_path: str | Path,
    output_path: str | Path,
) -> Dict[str, Any]:
    """Write only the anchor groups that still require adjudication."""

    rubric = _read_json(rubric_path, "rubric")
    examples = _read_json(examples_path, "anchor examples")
    responses_payload = _read_json(responses_path, "calibration responses")
    responses = responses_payload.get("responses") if isinstance(responses_payload.get("responses"), list) else []
    adjudications = responses_payload.get("adjudications", []) if isinstance(responses_payload.get("adjudications"), list) else []
    summary = summarize_calibration(rubric, responses, adjudications=adjudications)
    disagreement_groups = {tuple(group) for group in summary.get("disagreement_groups", [])}
    rows = [
        {
            "task_id": row["task_id"],
            "dimension_id": row["dimension_id"],
            "dimension_guidance": row["dimension_guidance"],
            "anchor_level": row["anchor_level"],
            "example_output": row["example_output"],
            "example_target": row["example_target"],
            "adjudicated_score": "",
            "adjudication_notes": "",
        }
        for row in _build_anchor_rows(rubric, examples)
        if (row["task_id"], row["dimension_id"], row["anchor_level"]) in disagreement_groups
    ]
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=ADJUDICATION_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    return {
        "output": str(destination),
        "suite_id": rubric.get("suite_id"),
        "suite_version": rubric.get("suite_version"),
        "rows": len(rows),
        "disagreement_groups": len(disagreement_groups),
        "fields": ADJUDICATION_FIELDS,
    }


def import_adjudication_sheet(
    sheet_path: str | Path,
    output_path: str | Path,
    rubric_path: str | Path | None = None,
) -> Dict[str, Any]:
    """Validate adjudicator scores and write an adjudications payload."""

    source = Path(sheet_path)
    with source.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        missing_fields = [field for field in ADJUDICATION_FIELDS if field not in fieldnames]
        if missing_fields:
            raise ValueError("adjudication worksheet is missing columns: " + ", ".join(missing_fields))
        rows = list(reader)

    required_groups = None
    suite_id = None
    suite_version = None
    if rubric_path is not None:
        rubric = _read_json(rubric_path, "rubric")
        required_groups = set(required_anchor_groups(rubric))
        suite_id = rubric.get("suite_id")
        suite_version = rubric.get("suite_version")

    adjudications: List[Dict[str, Any]] = []
    seen: set[Tuple[str, str, int]] = set()
    for row_number, row in enumerate(rows, start=2):
        task_id = _required_text(row.get("task_id"), "task_id", row_number)
        dimension_id = _required_text(row.get("dimension_id"), "dimension_id", row_number)
        anchor_level = _parse_anchor_level(row.get("anchor_level"), row_number)
        group = (task_id, dimension_id, anchor_level)
        if required_groups is not None and group not in required_groups:
            raise ValueError(f"row {row_number} points to unknown anchor group {group}")
        if group in seen:
            raise ValueError(f"duplicate adjudication for {group} (row {row_number})")
        seen.add(group)
        adjudication: Dict[str, Any] = {
            "task_id": task_id,
            "dimension_id": dimension_id,
            "anchor_level": anchor_level,
            "score": _parse_score(row.get("adjudicated_score"), "adjudicated_score", row_number),
        }
        notes = str(row.get("adjudication_notes", "") or "").strip()
        if notes:
            adjudication["notes"] = notes
        adjudications.append(adjudication)

    payload = {
        "suite_id": suite_id,
        "suite_version": suite_version,
        "source_sheet": str(source),
        "adjudications": adjudications,
    }
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {
        "output": str(destination),
        "suite_id": suite_id,
        "suite_version": suite_version,
        "rows": len(rows),
        "adjudications": len(adjudications),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export/import the DHEvals human calibration worksheet.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    export_parser = subparsers.add_parser("export", help="write a reviewer-ready CSV worksheet")
    export_parser.add_argument("--rubric", required=True, help="Anchor rubric JSON")
    export_parser.add_argument("--examples", required=True, help="Anchor examples JSON")
    export_parser.add_argument("--output", required=True, help="Output CSV path")

    blind_export_parser = subparsers.add_parser("export-blind", help="write independent reviewer CSV worksheets")
    blind_export_parser.add_argument("--rubric", required=True, help="Anchor rubric JSON")
    blind_export_parser.add_argument("--examples", required=True, help="Anchor examples JSON")
    blind_export_parser.add_argument("--output-dir", required=True, help="Directory for reviewer CSVs")
    blind_export_parser.add_argument("--reviewer-id", action="append", dest="reviewer_ids", help="Reviewer id; repeat at least twice (defaults to reviewer-a/reviewer-b)")
    blind_export_parser.add_argument("--manifest-output", help="Optional JSON manifest binding the blind sheets to rubric/examples hashes")

    import_parser = subparsers.add_parser("import", help="convert reviewer scores from CSV to JSON")
    import_parser.add_argument("--sheet", required=True, help="Completed or partially completed CSV worksheet")
    import_parser.add_argument("--output", required=True, help="Output responses JSON path")
    import_parser.add_argument("--rubric", help="Optional rubric JSON used to reject unknown anchor groups")

    blind_import_parser = subparsers.add_parser("import-blind", help="merge independent reviewer CSV worksheets")
    blind_import_parser.add_argument("--sheet", action="append", required=True, help="Reviewer CSV; repeat once per reviewer")
    blind_import_parser.add_argument("--output", required=True, help="Output responses JSON path")
    blind_import_parser.add_argument("--rubric", help="Optional rubric JSON used to reject unknown anchor groups")
    blind_import_parser.add_argument("--pack", help="Optional calibration pack manifest used to verify immutable anchor content")

    adjudication_export_parser = subparsers.add_parser("export-adjudication", help="write a worksheet for disagreement groups")
    adjudication_export_parser.add_argument("--rubric", required=True, help="Anchor rubric JSON")
    adjudication_export_parser.add_argument("--examples", required=True, help="Anchor examples JSON")
    adjudication_export_parser.add_argument("--responses", required=True, help="Imported reviewer responses JSON")
    adjudication_export_parser.add_argument("--output", required=True, help="Adjudication CSV output path")

    adjudication_import_parser = subparsers.add_parser("import-adjudication", help="validate adjudicator scores from CSV")
    adjudication_import_parser.add_argument("--sheet", required=True, help="Completed adjudication CSV")
    adjudication_import_parser.add_argument("--output", required=True, help="Adjudications JSON output path")
    adjudication_import_parser.add_argument("--rubric", help="Optional rubric JSON used to reject unknown anchor groups")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "export":
        summary = write_review_sheet(args.rubric, args.examples, args.output)
    elif args.command == "export-blind":
        summary = write_blind_review_sheets(args.rubric, args.examples, args.output_dir, args.reviewer_ids or ("reviewer-a", "reviewer-b"), args.manifest_output)
    elif args.command == "import-blind":
        summary = import_blind_review_sheets(args.sheet, args.output, args.rubric, args.pack)
    elif args.command == "export-adjudication":
        summary = write_adjudication_sheet(args.rubric, args.examples, args.responses, args.output)
    elif args.command == "import-adjudication":
        summary = import_adjudication_sheet(args.sheet, args.output, args.rubric)
    else:
        summary = import_review_sheet(args.sheet, args.output, args.rubric)
    print(json.dumps(summary, ensure_ascii=False))
    return 0


def _read_json(path: str | Path, label: str) -> Mapping[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, Mapping):
        raise ValueError(f"{label} file must contain a JSON object")
    return payload


def _build_anchor_rows(rubric: Mapping[str, Any], examples: Mapping[str, Any]) -> List[Dict[str, Any]]:
    example_tasks = examples.get("tasks") if isinstance(examples, Mapping) else None
    if not isinstance(example_tasks, Mapping):
        raise ValueError("anchor examples file must contain a tasks object")
    rows: List[Dict[str, Any]] = []
    for task_id, dimension_id, anchor_level in required_anchor_groups(rubric):
        task_examples = example_tasks.get(task_id)
        if not isinstance(task_examples, list):
            raise ValueError(f"anchor examples missing task {task_id}")
        example = next(
            (item for item in task_examples if isinstance(item, Mapping) and item.get("level") == anchor_level),
            None,
        )
        if not isinstance(example, Mapping):
            raise ValueError(f"anchor examples missing {task_id} level {anchor_level}")
        if not isinstance(example.get("output"), str) or not isinstance(example.get("target"), str):
            raise ValueError(f"anchor example {task_id} level {anchor_level} needs output and target text")
        rows.append({
            "task_id": task_id,
            "dimension_id": dimension_id,
            "dimension_guidance": _dimension_guidance(rubric, task_id, dimension_id),
            "anchor_level": anchor_level,
            "example_output": example["output"],
            "example_target": example["target"],
            "reviewer_a_score": "",
            "reviewer_a_notes": "",
            "reviewer_b_score": "",
            "reviewer_b_notes": "",
            "adjudicated_score": "",
            "adjudication_notes": "",
        })
    return rows


def _anchor_fingerprint(rows: Iterable[Mapping[str, Any]]) -> str:
    immutable_rows = []
    for row in rows:
        immutable = {field: row.get(field) for field in ANCHOR_FIELDS}
        try:
            immutable["anchor_level"] = int(str(immutable["anchor_level"]).strip())
        except (TypeError, ValueError):
            pass
        immutable_rows.append(immutable)
    return sha256_json(immutable_rows)


def _build_pack_manifest(
    *,
    rubric: Mapping[str, Any],
    examples: Mapping[str, Any],
    rows: List[Mapping[str, Any]],
    reviewer_ids: Sequence[str],
    paths: Sequence[str],
    output_dir: Path,
) -> Dict[str, Any]:
    anchor_fingerprint = _anchor_fingerprint(rows)
    manifest: Dict[str, Any] = {
        "schema_version": PACK_SCHEMA_VERSION,
        "kind": PACK_KIND,
        "suite_id": rubric.get("suite_id"),
        "suite_version": rubric.get("suite_version"),
        "rubric_sha256": sha256_json(rubric),
        "examples_sha256": sha256_json(examples),
        "required_groups": len(rows),
        "anchor_fingerprint": anchor_fingerprint,
        "score_scale": {"min": 0, "max": 4, "step": 1},
        "blind": True,
        "reviewers": [
            {"id": reviewer_id, "file": Path(path).name, "rows": len(rows), "anchor_fingerprint": anchor_fingerprint}
            for reviewer_id, path in zip(reviewer_ids, paths)
        ],
        "source_directory": str(output_dir),
        "generated_at": _utc_now(),
    }
    manifest["pack_id"] = sha256_json({key: value for key, value in manifest.items() if key != "generated_at"})
    return manifest


def _load_pack(path: str | Path) -> Mapping[str, Any]:
    payload = _read_json(path, "calibration pack")
    if payload.get("schema_version") != PACK_SCHEMA_VERSION or payload.get("kind") != PACK_KIND:
        raise ValueError("calibration pack has an unsupported schema or kind")
    for field in ("pack_id", "suite_id", "suite_version", "rubric_sha256", "examples_sha256", "anchor_fingerprint"):
        if not isinstance(payload.get(field), str) or not payload[field].strip():
            raise ValueError(f"calibration pack.{field} must be a non-empty string")
    if not isinstance(payload.get("required_groups"), int) or payload["required_groups"] <= 0:
        raise ValueError("calibration pack.required_groups must be a positive integer")
    if not isinstance(payload.get("reviewers"), list) or len(payload["reviewers"]) < 2:
        raise ValueError("calibration pack must declare at least two reviewers")
    expected_pack_id = sha256_json({key: value for key, value in payload.items() if key != "generated_at" and key != "pack_id"})
    if payload.get("pack_id") != expected_pack_id:
        raise ValueError("calibration pack id does not match its contents")
    return payload


def _validate_pack_inputs(pack: Mapping[str, Any], sheet_paths: Sequence[str | Path], rubric_path: str | Path | None) -> None:
    reviewers = pack.get("reviewers") if isinstance(pack.get("reviewers"), list) else []
    expected_files = {item.get("file") for item in reviewers if isinstance(item, Mapping)}
    if None in expected_files or len(expected_files) != len(reviewers):
        raise ValueError("calibration pack reviewers must declare unique file names")
    actual_files = {Path(path).name for path in sheet_paths}
    if actual_files != expected_files:
        raise ValueError(f"calibration pack expects files {sorted(expected_files)}, received {sorted(actual_files)}")
    if rubric_path is not None:
        rubric = _read_json(rubric_path, "rubric")
        if rubric.get("suite_id") != pack.get("suite_id") or rubric.get("suite_version") != pack.get("suite_version"):
            raise ValueError("rubric identity does not match calibration pack")
        if sha256_json(rubric) != pack.get("rubric_sha256"):
            raise ValueError("rubric hash does not match calibration pack")


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _normalize_reviewer_id(value: Any) -> str:
    reviewer_id = str(value or "").strip()
    if not reviewer_id or any(character in reviewer_id for character in "/\\\n\r\t"):
        raise ValueError("reviewer id must be a non-empty path-safe string")
    return reviewer_id


def _dimension_guidance(rubric: Mapping[str, Any], task_id: str, dimension_id: str) -> str:
    tasks = rubric.get("tasks") if isinstance(rubric.get("tasks"), Mapping) else {}
    task = tasks.get(task_id) if isinstance(tasks, Mapping) else None
    dimensions = task.get("dimensions") if isinstance(task, Mapping) else []
    for dimension in dimensions if isinstance(dimensions, list) else []:
        if not isinstance(dimension, Mapping) or dimension.get("id") != dimension_id:
            continue
        guidance = dimension.get("what_to_look_for") or dimension.get("label") or ""
        if isinstance(guidance, str) and guidance.strip():
            return guidance.strip()
    raise ValueError(f"rubric missing guidance for {task_id}/{dimension_id}")


def _required_text(value: Any, field: str, row_number: int) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"row {row_number} requires {field}")
    return text


def _parse_anchor_level(value: Any, row_number: int) -> int:
    text = str(value or "").strip()
    try:
        parsed = int(text)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"row {row_number} anchor_level must be one of 0..4") from exc
    if text not in {str(level) for level in range(5)}:
        raise ValueError(f"row {row_number} anchor_level must be one of 0..4")
    return parsed


def _parse_score(value: Any, field: str, row_number: int) -> int | float:
    text = str(value or "").strip()
    try:
        parsed = float(text)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"row {row_number} {field} must be a number between 0 and 4") from exc
    if not 0 <= parsed <= 4:
        raise ValueError(f"row {row_number} {field} must be a number between 0 and 4")
    return int(parsed) if parsed.is_integer() else parsed


if __name__ == "__main__":
    raise SystemExit(main())
