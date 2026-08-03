"""Versioned suite and task models.

The model layer intentionally uses the standard library only. A benchmark
manifest should be readable and portable before it is tied to a database or
web service.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Union


class ValidationError(ValueError):
    """Raised when a suite manifest cannot be executed safely."""


SUPPORTED_CHECK_TYPES = {
    "contains_all",
    "contains_any",
    "not_contains",
    "exact",
    "regex",
    "json_object",
    "json_array",
    "min_length",
}


@dataclass(frozen=True)
class TaskSpec:
    id: str
    title: str
    category: str
    prompt: str
    checks: List[Dict[str, Any]]
    rubric: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    context: str = ""

    def effective_prompt(self) -> str:
        """Return the exact self-contained prompt sent to an adapter.

        Keeping the instruction and supplied evidence separate in the
        manifest makes it possible to audit whether a task was actually
        answerable.  Adapters use this rendered value rather than reaching
        into the workspace for missing documents or data.
        """
        if not self.context.strip():
            return self.prompt
        return (
            f"{self.prompt}\n\n"
            "CONTEXTO SINTÉTICO DA TAREFA (use somente este material; não "
            "consulte arquivos, ferramentas ou fontes externas):\n"
            f"{self.context.strip()}"
        )

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "id": self.id,
            "title": self.title,
            "category": self.category,
            "prompt": self.prompt,
            "checks": self.checks,
            "rubric": self.rubric,
            "metadata": self.metadata,
        }
        # Omit the optional field when empty so historical v0.2/v0.3 suite
        # hashes remain stable while context-bearing tasks are auditable.
        if self.context.strip():
            payload["context"] = self.context
        return payload


@dataclass(frozen=True)
class SuiteSpec:
    id: str
    version: str
    locale: str
    tasks: List[TaskSpec]
    description: str = ""
    license: str = ""
    provenance: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "version": self.version,
            "locale": self.locale,
            "description": self.description,
            "license": self.license,
            "provenance": self.provenance,
            "tasks": [task.to_dict() for task in self.tasks],
        }

    @property
    def content_hash(self) -> str:
        return sha256_json(self.to_dict())


def _require_string(payload: Mapping[str, Any], key: str, context: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{context}.{key} must be a non-empty string")
    return value.strip()


def _validate_checks(checks: Any, context: str) -> List[Dict[str, Any]]:
    if not isinstance(checks, list) or not checks:
        raise ValidationError(f"{context}.checks must contain at least one check")

    normalized: List[Dict[str, Any]] = []
    check_ids = set()
    for index, check in enumerate(checks):
        check_context = f"{context}.checks[{index}]"
        if not isinstance(check, dict):
            raise ValidationError(f"{check_context} must be an object")
        check_id = _require_string(check, "id", check_context)
        check_type = _require_string(check, "type", check_context)
        if check_id in check_ids:
            raise ValidationError(f"{context} contains duplicate check id {check_id!r}")
        if check_type not in SUPPORTED_CHECK_TYPES:
            allowed = ", ".join(sorted(SUPPORTED_CHECK_TYPES))
            raise ValidationError(f"{check_context}.type {check_type!r} is unsupported; use {allowed}")
        check_ids.add(check_id)
        normalized.append(dict(check))
    return normalized


def _validate_rubric(rubric: Any, context: str) -> List[Dict[str, Any]]:
    if not isinstance(rubric, list):
        raise ValidationError(f"{context}.rubric must be a list")
    if not rubric:
        return []

    normalized: List[Dict[str, Any]] = []
    rubric_ids = set()
    total_weight = 0.0
    for index, dimension in enumerate(rubric):
        dimension_context = f"{context}.rubric[{index}]"
        if not isinstance(dimension, dict):
            raise ValidationError(f"{dimension_context} must be an object")
        dimension_id = _require_string(dimension, "id", dimension_context)
        _require_string(dimension, "label", dimension_context)
        if dimension_id in rubric_ids:
            raise ValidationError(f"{context} contains duplicate rubric id {dimension_id!r}")
        weight = dimension.get("weight")
        if isinstance(weight, bool) or not isinstance(weight, (int, float)) or not 0 < float(weight) <= 1:
            raise ValidationError(f"{dimension_context}.weight must be a number between 0 and 1")
        anchors = dimension.get("anchors")
        if anchors is not None and not isinstance(anchors, dict):
            raise ValidationError(f"{dimension_context}.anchors must be an object")
        rubric_ids.add(dimension_id)
        total_weight += float(weight)
        normalized.append(dict(dimension))

    if abs(total_weight - 1.0) > 0.001:
        raise ValidationError(f"{context}.rubric weights must sum to 1.0 (got {total_weight:.4f})")
    return normalized


def _task_from_dict(payload: Any, index: int) -> TaskSpec:
    context = f"tasks[{index}]"
    if not isinstance(payload, dict):
        raise ValidationError(f"{context} must be an object")
    task_id = _require_string(payload, "id", context)
    title = _require_string(payload, "title", context)
    category = _require_string(payload, "category", context)
    prompt = _require_string(payload, "prompt", context)
    checks = _validate_checks(payload.get("checks"), context)
    rubric = _validate_rubric(payload.get("rubric", []), context)
    metadata = payload.get("metadata", {})
    if not isinstance(metadata, dict):
        raise ValidationError(f"{context}.metadata must be an object")
    task_context = payload.get("context", "")
    if not isinstance(task_context, str):
        raise ValidationError(f"{context}.context must be a string")
    return TaskSpec(
        id=task_id,
        title=title,
        category=category,
        prompt=prompt,
        checks=checks,
        rubric=rubric,
        metadata=dict(metadata),
        context=task_context,
    )


def suite_from_dict(payload: Any) -> SuiteSpec:
    if not isinstance(payload, dict):
        raise ValidationError("suite manifest must be an object")
    suite_id = _require_string(payload, "id", "suite")
    version = _require_string(payload, "version", "suite")
    locale = _require_string(payload, "locale", "suite")
    raw_tasks = payload.get("tasks")
    if not isinstance(raw_tasks, list) or not raw_tasks:
        raise ValidationError("suite.tasks must contain at least one task")
    tasks = [_task_from_dict(task, index) for index, task in enumerate(raw_tasks)]
    task_ids = [task.id for task in tasks]
    duplicates = sorted({task_id for task_id in task_ids if task_ids.count(task_id) > 1})
    if duplicates:
        raise ValidationError(f"suite contains duplicate task ids: {', '.join(duplicates)}")

    description = payload.get("description", "")
    license_name = payload.get("license", "")
    provenance = payload.get("provenance", {})
    if not isinstance(description, str) or not isinstance(license_name, str):
        raise ValidationError("suite.description and suite.license must be strings")
    if not isinstance(provenance, dict):
        raise ValidationError("suite.provenance must be an object")
    return SuiteSpec(
        id=suite_id,
        version=version,
        locale=locale,
        description=description,
        license=license_name,
        provenance=dict(provenance),
        tasks=tasks,
    )


def load_suite(path: Union[str, Path]) -> SuiteSpec:
    manifest_path = Path(path)
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValidationError(f"suite manifest not found: {manifest_path}") from exc
    except json.JSONDecodeError as exc:
        raise ValidationError(f"suite manifest is not valid JSON: {manifest_path}: {exc}") from exc
    return suite_from_dict(payload)


def canonical_json(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_json(payload: Any) -> str:
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()
