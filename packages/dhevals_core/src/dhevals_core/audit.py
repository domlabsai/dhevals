"""Integrity audit for a versioned DHEvals benchmark bundle."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Optional, Sequence

from .adapters import FixtureAdapter
from .calibration import required_anchor_groups
from .models import SuiteSpec, load_suite
from .runner import ModelConfig, run_suite


PUBLICATION_VALUES = {"public", "calibration", "calibration-only", "private", "draft"}


def audit_benchmark_bundle(
    suite_path: str | Path,
    fixture_path: str | Path | None = None,
    negative_fixture_path: str | Path | None = None,
    rubric_path: str | Path | None = None,
    examples_path: str | Path | None = None,
    comparison_registry_path: str | Path | None = None,
) -> Dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    checks: Dict[str, Any] = {}
    suite: Optional[SuiteSpec] = None
    suite_source = str(suite_path)
    try:
        suite = load_suite(suite_path)
        checks["suite"] = {
            "status": "valid",
            "id": suite.id,
            "version": suite.version,
            "locale": suite.locale,
            "task_count": len(suite.tasks),
            "content_hash": suite.content_hash,
        }
    except Exception as exc:
        errors.append(f"suite: {type(exc).__name__}: {exc}")
        checks["suite"] = {"status": "invalid"}

    if suite is not None:
        _audit_suite_metadata(suite, errors, warnings)
        if fixture_path:
            checks["fixture"] = _audit_fixture(suite, fixture_path, errors, expected="positive")
        if negative_fixture_path:
            checks["negative_fixture"] = _audit_fixture(suite, negative_fixture_path, errors, expected="negative")
        if rubric_path:
            checks["rubric"] = _audit_rubric(suite, rubric_path, errors)
        if examples_path:
            checks["examples"] = _audit_examples(suite, examples_path, errors)
        if rubric_path and examples_path:
            _audit_anchor_matrix(suite, rubric_path, examples_path, errors)
        if comparison_registry_path:
            checks["comparison_registry"] = _audit_comparison_registry(suite, comparison_registry_path, errors)

    if not fixture_path:
        warnings.append("positive fixture was not supplied")
    if not negative_fixture_path:
        warnings.append("negative fixture was not supplied")
    if not rubric_path:
        warnings.append("calibration rubric was not supplied")
    if not examples_path:
        warnings.append("anchor examples were not supplied")
    status = "ready" if not errors else "invalid"
    return {
        "kind": "dhevals_bundle_audit",
        "status": status,
        "suite": suite_source,
        "suite_id": suite.id if suite else None,
        "suite_version": suite.version if suite else None,
        "checks": checks,
        "errors": errors,
        "warnings": warnings,
        "generated_at": _utc_now(),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Audit a DHEvals suite, fixtures, calibration and comparison registry.")
    parser.add_argument("--suite", required=True, help="Versioned suite manifest JSON")
    parser.add_argument("--fixture", help="Positive fixture JSON")
    parser.add_argument("--negative-fixture", help="Negative fixture JSON")
    parser.add_argument("--rubric", help="Human calibration rubric JSON")
    parser.add_argument("--examples", help="Anchor examples JSON")
    parser.add_argument("--comparison-registry", help="Model comparison registry JSON")
    parser.add_argument("--output", help="Optional audit JSON output")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    audit = audit_benchmark_bundle(
        suite_path=args.suite,
        fixture_path=args.fixture,
        negative_fixture_path=args.negative_fixture,
        rubric_path=args.rubric,
        examples_path=args.examples,
        comparison_registry_path=args.comparison_registry,
    )
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False))
    return 0 if audit["status"] == "ready" else 2


def _audit_suite_metadata(suite: SuiteSpec, errors: list[str], warnings: list[str]) -> None:
    if not suite.license.strip():
        errors.append("suite.license must describe redistribution/provenance")
    provenance = suite.provenance
    for field in ("owner", "purpose", "publication"):
        if not isinstance(provenance.get(field), str) or not provenance[field].strip():
            errors.append(f"suite.provenance.{field} must be a non-empty string")
    publication = provenance.get("publication")
    if publication not in PUBLICATION_VALUES:
        errors.append(f"suite.provenance.publication must be one of {sorted(PUBLICATION_VALUES)}")
    for task in suite.tasks:
        metadata = task.metadata
        for field in ("expected_artifact", "input_ref", "publication"):
            if not isinstance(metadata.get(field), str) or not metadata[field].strip():
                errors.append(f"task {task.id}: metadata.{field} must be a non-empty string")
        if metadata.get("publication") not in PUBLICATION_VALUES:
            errors.append(f"task {task.id}: metadata.publication is not an allowed publication value")
        input_ref = metadata.get("input_ref")
        if isinstance(input_ref, str) and not (input_ref.startswith("synthetic/") or input_ref.startswith("licensed/")):
            errors.append(f"task {task.id}: metadata.input_ref must identify synthetic/ or licensed/ provenance")
    if suite.locale != "pt-BR":
        warnings.append(f"suite locale is {suite.locale!r}; the v0.2 heavy-user policy expects pt-BR")


def _audit_fixture(suite: SuiteSpec, path: str | Path, errors: list[str], expected: str) -> Dict[str, Any]:
    source = str(path)
    try:
        payload = _read_object(path, f"{expected} fixture")
    except ValueError as exc:
        errors.append(str(exc))
        return {"status": "invalid", "path": source}
    task_ids = {task.id for task in suite.tasks}
    fixture_ids = set(payload)
    missing = sorted(task_ids - fixture_ids)
    extra = sorted(fixture_ids - task_ids)
    if missing:
        errors.append(f"{expected} fixture is missing tasks: {', '.join(missing)}")
    if extra:
        errors.append(f"{expected} fixture has unknown tasks: {', '.join(extra)}")
    for task_id, entry in payload.items():
        if task_id not in task_ids:
            continue
        if isinstance(entry, str):
            output = entry
        elif isinstance(entry, Mapping):
            output = entry.get("output")
            for field in ("input_tokens", "output_tokens", "latency_ms"):
                if field in entry and (isinstance(entry[field], bool) or not isinstance(entry[field], (int, float)) or entry[field] < 0):
                    errors.append(f"{expected} fixture task {task_id}: {field} must be non-negative")
        else:
            output = None
        if not isinstance(output, str):
            errors.append(f"{expected} fixture task {task_id}: output must be a string")
    result: Dict[str, Any] = {"status": "valid", "path": source, "task_count": len(payload)}
    if missing or extra:
        result["status"] = "invalid"
        return result
    try:
        run = run_suite(suite, FixtureAdapter(payload), ModelConfig(model_id=f"audit-{expected}-fixture", provider="fixture"), run_id=f"audit-{expected}")
    except Exception as exc:
        errors.append(f"{expected} fixture execution failed: {type(exc).__name__}: {exc}")
        result["status"] = "invalid"
        return result
    result.update({"coverage": run.coverage, "overall_score": run.overall_score, "statuses": sorted({item.status for item in run.results})})
    if any(item.status == "error" for item in run.results):
        errors.append(f"{expected} fixture produced infrastructure errors")
        result["status"] = "invalid"
    if expected == "positive" and not all(item.status == "pass" for item in run.results):
        errors.append("positive fixture must pass every deterministic check")
        result["status"] = "invalid"
    if expected == "negative" and not all(item.status in {"partial", "fail"} for item in run.results):
        errors.append("negative fixture must expose quality failures without infrastructure errors")
        result["status"] = "invalid"
    return result


def _audit_rubric(suite: SuiteSpec, path: str | Path, errors: list[str]) -> Dict[str, Any]:
    source = str(path)
    try:
        rubric = _read_object(path, "calibration rubric")
    except ValueError as exc:
        errors.append(str(exc))
        return {"status": "invalid", "path": source}
    if rubric.get("suite_id") != suite.id or rubric.get("suite_version") != suite.version:
        errors.append("calibration rubric suite identity does not match manifest")
    tasks = rubric.get("tasks")
    if not isinstance(tasks, Mapping):
        errors.append("calibration rubric.tasks must be an object")
        return {"status": "invalid", "path": source}
    missing = sorted({task.id for task in suite.tasks} - set(tasks))
    extra = sorted(set(tasks) - {task.id for task in suite.tasks})
    if missing:
        errors.append("calibration rubric is missing tasks: " + ", ".join(missing))
    if extra:
        errors.append("calibration rubric has unknown tasks: " + ", ".join(extra))
    dimensions = 0
    for task_id, task in tasks.items():
        if not isinstance(task, Mapping) or not isinstance(task.get("dimensions"), list) or not task["dimensions"]:
            errors.append(f"calibration rubric task {task_id} needs dimensions")
            continue
        seen = set()
        weight_total = 0.0
        for dimension in task["dimensions"]:
            if not isinstance(dimension, Mapping) or not isinstance(dimension.get("id"), str):
                errors.append(f"calibration rubric task {task_id} has an invalid dimension")
                continue
            dimension_id = dimension["id"]
            if dimension_id in seen:
                errors.append(f"calibration rubric task {task_id} duplicates dimension {dimension_id}")
            seen.add(dimension_id)
            weight = dimension.get("weight")
            if isinstance(weight, bool) or not isinstance(weight, (int, float)) or not 0 < float(weight) <= 1:
                errors.append(f"calibration rubric dimension {task_id}/{dimension_id} has invalid weight")
            else:
                weight_total += float(weight)
            if not isinstance(dimension.get("what_to_look_for"), str) or not dimension["what_to_look_for"].strip():
                errors.append(f"calibration rubric dimension {task_id}/{dimension_id} needs what_to_look_for")
            dimensions += 1
        if abs(weight_total - 1.0) > 0.001:
            errors.append(f"calibration rubric task {task_id} weights must sum to 1.0")
    return {"status": "valid", "path": source, "task_count": len(tasks), "dimension_count": dimensions, "required_anchor_groups": len(required_anchor_groups(rubric))}


def _audit_examples(suite: SuiteSpec, path: str | Path, errors: list[str]) -> Dict[str, Any]:
    source = str(path)
    try:
        examples = _read_object(path, "anchor examples")
    except ValueError as exc:
        errors.append(str(exc))
        return {"status": "invalid", "path": source}
    tasks = examples.get("tasks")
    if not isinstance(tasks, Mapping):
        errors.append("anchor examples.tasks must be an object")
        return {"status": "invalid", "path": source}
    suite_ids = {task.id for task in suite.tasks}
    missing = sorted(suite_ids - set(tasks))
    extra = sorted(set(tasks) - suite_ids)
    if missing:
        errors.append("anchor examples are missing tasks: " + ", ".join(missing))
    if extra:
        errors.append("anchor examples have unknown tasks: " + ", ".join(extra))
    for task_id, levels in tasks.items():
        if not isinstance(levels, list):
            errors.append(f"anchor examples task {task_id} must be an array")
            continue
        seen = set()
        for example in levels:
            if not isinstance(example, Mapping) or example.get("level") not in {0, 1, 2, 3, 4}:
                errors.append(f"anchor examples task {task_id} has an invalid level")
                continue
            level = example["level"]
            if level in seen:
                errors.append(f"anchor examples task {task_id} duplicates level {level}")
            seen.add(level)
            if not isinstance(example.get("output"), str):
                errors.append(f"anchor examples task {task_id} level {level} needs output text")
            elif not example["output"].strip() and level != 0:
                errors.append(f"anchor examples task {task_id} level {level} needs non-empty output")
            if not isinstance(example.get("target"), str) or not example["target"].strip():
                errors.append(f"anchor examples task {task_id} level {level} needs target")
        if seen != {0, 1, 2, 3, 4}:
            errors.append(f"anchor examples task {task_id} must contain exactly levels 0..4")
    return {"status": "valid", "path": source, "task_count": len(tasks), "levels_per_task": 5}


def _audit_anchor_matrix(suite: SuiteSpec, rubric_path: str | Path, examples_path: str | Path, errors: list[str]) -> None:
    try:
        rubric = _read_object(rubric_path, "calibration rubric")
        examples = _read_object(examples_path, "anchor examples")
        groups = required_anchor_groups(rubric)
        example_tasks = examples.get("tasks") if isinstance(examples.get("tasks"), Mapping) else {}
        if not groups:
            errors.append("calibration rubric has no anchor groups")
            return
        for task_id, _dimension_id, level in groups:
            levels = example_tasks.get(task_id) if isinstance(example_tasks, Mapping) else None
            if not isinstance(levels, list) or not any(isinstance(item, Mapping) and item.get("level") == level for item in levels):
                errors.append(f"anchor example missing for {task_id} level {level}")
    except ValueError:
        return


def _audit_comparison_registry(suite: SuiteSpec, path: str | Path, errors: list[str]) -> Dict[str, Any]:
    source = str(path)
    try:
        registry = _read_object(path, "comparison registry")
    except ValueError as exc:
        errors.append(str(exc))
        return {"status": "invalid", "path": source}
    if registry.get("suite_id") != suite.id or registry.get("suite_version") != suite.version:
        errors.append("comparison registry suite identity does not match manifest")
    generation = registry.get("generation")
    if not isinstance(generation, Mapping):
        errors.append("comparison registry.generation must be an object")
    else:
        for field in ("temperature", "max_tokens", "seed"):
            if field not in generation:
                errors.append(f"comparison registry.generation.{field} is required")
    policy = registry.get("policy")
    if not isinstance(policy, Mapping):
        errors.append("comparison registry.policy must be an object")
    else:
        for field in ("same_suite_hash_required", "same_generation_config_required", "human_calibration_required"):
            if policy.get(field) is not True:
                errors.append(f"comparison registry.policy.{field} must be true")
        if policy.get("fixture_scores_public") is not False:
            errors.append("comparison registry.policy.fixture_scores_public must be false")
    models = registry.get("models")
    if not isinstance(models, list) or not models:
        errors.append("comparison registry.models must be a non-empty array")
        return {"status": "invalid", "path": source}
    ids = set()
    for model in models:
        if not isinstance(model, Mapping) or not isinstance(model.get("id"), str) or not model["id"].strip():
            errors.append("comparison registry model needs a stable id")
            continue
        if model["id"] in ids:
            errors.append(f"comparison registry duplicates model {model['id']}")
        ids.add(model["id"])
        for field in ("provider", "base_url_env", "api_key_env", "publication"):
            if not isinstance(model.get(field), str) or not model[field].strip():
                errors.append(f"comparison registry model {model['id']} needs {field}")
    return {"status": "valid", "path": source, "model_count": len(models), "model_ids": sorted(ids)}


def _read_object(path: str | Path, label: str) -> Mapping[str, Any]:
    source = Path(path)
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"{label} not found: {source}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label} is not valid JSON: {source}") from exc
    if not isinstance(payload, Mapping):
        raise ValueError(f"{label} must be a JSON object: {source}")
    return payload


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
