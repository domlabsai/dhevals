"""Validation and provenance helpers for versioned model manifests.

The run artifact is the unit of comparison.  A model manifest makes the
training and serving context explicit without putting credentials in that
artifact.  The validator is intentionally conservative: unknown fields are
allowed for forward compatibility, while secret-looking fields and URLs with
embedded credentials are rejected.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Union
from urllib.parse import urlparse

from .models import ValidationError, sha256_json


MANIFEST_SCHEMA_VERSION = "0.1.0"
_ALLOWED_STATUSES = {"draft", "ready", "retired"}
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
_SECRET_KEY_RE = re.compile(
    r"(?:api[_-]?key|access[_-]?token|authorization|bearer|password|private[_-]?key|secret)",
    re.IGNORECASE,
)
_REDACTED_VALUES = {"", "<redacted>", "redacted", "${env}", "env"}


def load_model_manifest(path: Union[str, Path], *, require_ready: bool = False) -> Dict[str, Any]:
    """Load and validate a model manifest from JSON."""

    manifest_path = Path(path)
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValidationError(f"model manifest not found: {manifest_path}") from exc
    except json.JSONDecodeError as exc:
        raise ValidationError(f"model manifest is not valid JSON: {manifest_path}: {exc}") from exc
    return validate_model_manifest(payload, require_ready=require_ready)


def validate_model_manifest(payload: Any, *, require_ready: bool = False) -> Dict[str, Any]:
    """Validate and return a JSON-safe model manifest.

    ``draft`` manifests are valid for offline development, but callers that
    are about to publish a real run can opt into ``require_ready``.
    """

    errors = []
    if not isinstance(payload, Mapping):
        raise ValidationError("model manifest must be an object")

    _require_string(payload, "schema_version", errors)
    if payload.get("schema_version") != MANIFEST_SCHEMA_VERSION:
        errors.append(f"schema_version must be {MANIFEST_SCHEMA_VERSION}")
    _require_string(payload, "id", errors)
    _require_string(payload, "version", errors)
    status = _require_string(payload, "status", errors)
    if status and status not in _ALLOWED_STATUSES:
        errors.append(f"status must be one of {sorted(_ALLOWED_STATUSES)}")
    if require_ready and status != "ready":
        errors.append("status must be ready for a publishable model manifest")

    base_model = _require_object(payload, "base_model", errors)
    _require_string(base_model, "id", errors, prefix="base_model")
    _require_string(base_model, "license", errors, prefix="base_model")

    checkpoint = _require_object(payload, "checkpoint", errors)
    _require_string(checkpoint, "id", errors, prefix="checkpoint")
    _optional_string_or_null(checkpoint, "revision", errors, prefix="checkpoint")
    _optional_hash(checkpoint, "sha256", errors, prefix="checkpoint")

    post_training = _require_object(payload, "post_training", errors)
    _require_string(post_training, "tool", errors, prefix="post_training")
    _require_string(post_training, "method", errors, prefix="post_training")
    _require_string(post_training, "quantization", errors, prefix="post_training")
    dataset = _require_object(post_training, "dataset", errors)
    _require_string(dataset, "id", errors, prefix="post_training.dataset")
    _require_string(dataset, "version", errors, prefix="post_training.dataset")
    _optional_hash(dataset, "sha256", errors, prefix="post_training.dataset")
    _optional_string_or_null(post_training, "training_commit", errors, prefix="post_training")
    config = post_training.get("config")
    if config is not None and not isinstance(config, Mapping):
        errors.append("post_training.config must be an object when provided")

    training_runtime = _require_object(payload, "training_runtime", errors)
    _require_string(training_runtime, "provider", errors, prefix="training_runtime")
    _require_string(training_runtime, "hardware", errors, prefix="training_runtime")
    _optional_string_or_null(training_runtime, "image", errors, prefix="training_runtime")

    inference_runtime = _require_object(payload, "inference_runtime", errors)
    _require_string(inference_runtime, "engine", errors, prefix="inference_runtime")
    _require_string(inference_runtime, "api_contract", errors, prefix="inference_runtime")
    _require_string(inference_runtime, "endpoint_env", errors, prefix="inference_runtime")

    generation = _require_object(payload, "generation", errors)
    temperature = generation.get("temperature")
    if isinstance(temperature, bool) or not isinstance(temperature, (int, float)) or not 0 <= float(temperature) <= 2:
        errors.append("generation.temperature must be a number between 0 and 2")
    max_tokens = generation.get("max_tokens")
    if isinstance(max_tokens, bool) or not isinstance(max_tokens, int) or max_tokens <= 0:
        errors.append("generation.max_tokens must be a positive integer")
    seed = generation.get("seed")
    if isinstance(seed, bool) or not isinstance(seed, int):
        errors.append("generation.seed must be an integer")

    provenance = _require_object(payload, "provenance", errors)
    _require_string(provenance, "legal_entity", errors, prefix="provenance")
    _require_string(provenance, "product", errors, prefix="provenance")
    _require_string(provenance, "owner", errors, prefix="provenance")

    _scan_for_secrets(payload, "manifest", errors)
    if require_ready:
        _validate_publishable_provenance(
            base_model=base_model,
            checkpoint=checkpoint,
            post_training=post_training,
            dataset=dataset,
            training_runtime=training_runtime,
            inference_runtime=inference_runtime,
            provenance=provenance,
            errors=errors,
        )
    if errors:
        raise ValidationError("invalid model manifest: " + "; ".join(errors))
    return json.loads(json.dumps(payload, ensure_ascii=False))


def model_manifest_hash(payload: Mapping[str, Any]) -> str:
    """Return the canonical SHA-256 used in run provenance."""

    return sha256_json(payload)


def _require_object(payload: Mapping[str, Any], key: str, errors: list[str]) -> Mapping[str, Any]:
    value = payload.get(key)
    if not isinstance(value, Mapping):
        errors.append(f"{key} must be an object")
        return {}
    return value


def _require_string(
    payload: Mapping[str, Any],
    key: str,
    errors: list[str],
    *,
    prefix: Optional[str] = None,
) -> str:
    value = payload.get(key)
    context = f"{prefix}.{key}" if prefix else key
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{context} must be a non-empty string")
        return ""
    return value.strip()


def _optional_string_or_null(
    payload: Mapping[str, Any],
    key: str,
    errors: list[str],
    *,
    prefix: Optional[str] = None,
) -> None:
    value = payload.get(key)
    context = f"{prefix}.{key}" if prefix else key
    if value is not None and (not isinstance(value, str) or not value.strip()):
        errors.append(f"{context} must be a non-empty string or null")


def _optional_hash(
    payload: Mapping[str, Any],
    key: str,
    errors: list[str],
    *,
    prefix: Optional[str] = None,
) -> None:
    value = payload.get(key)
    context = f"{prefix}.{key}" if prefix else key
    if value is not None and (not isinstance(value, str) or not _SHA256_RE.fullmatch(value)):
        errors.append(f"{context} must be null or a lowercase SHA-256 hash")


def _scan_for_secrets(value: Any, path: str, errors: list[str]) -> None:
    if isinstance(value, Mapping):
        for key, nested in value.items():
            key_text = str(key)
            child_path = f"{path}.{key_text}"
            if _SECRET_KEY_RE.search(key_text) and not _is_redacted(nested):
                errors.append(f"{child_path} looks like a credential; store only an environment variable name")
            _scan_for_secrets(nested, child_path, errors)
        return
    if isinstance(value, list):
        for index, nested in enumerate(value):
            _scan_for_secrets(nested, f"{path}[{index}]", errors)
        return
    if isinstance(value, str):
        parsed = urlparse(value)
        if parsed.username or parsed.password:
            errors.append(f"{path} contains a URL with embedded credentials")


def _is_redacted(value: Any) -> bool:
    return value is None or (isinstance(value, str) and value.strip().lower() in _REDACTED_VALUES)


def _validate_publishable_provenance(
    *,
    base_model: Mapping[str, Any],
    checkpoint: Mapping[str, Any],
    post_training: Mapping[str, Any],
    dataset: Mapping[str, Any],
    training_runtime: Mapping[str, Any],
    inference_runtime: Mapping[str, Any],
    provenance: Mapping[str, Any],
    errors: list[str],
) -> None:
    """Require concrete, reproducible provenance for publication.

    Draft manifests intentionally allow placeholders.  A ready manifest is a
    different contract: a reviewer must be able to identify the exact base
    model, checkpoint, dataset, training revision and serving image that
    produced a leaderboard entry.
    """

    sections = {
        "base_model": base_model,
        "checkpoint": checkpoint,
        "post_training": post_training,
        "training_runtime": training_runtime,
        "inference_runtime": inference_runtime,
        "provenance": provenance,
    }
    for section, key in (
        ("base_model", "id"),
        ("base_model", "license"),
        ("checkpoint", "id"),
        ("checkpoint", "revision"),
        ("post_training", "method"),
        ("post_training", "quantization"),
        ("post_training", "training_commit"),
        ("training_runtime", "provider"),
        ("training_runtime", "hardware"),
        ("training_runtime", "image"),
        ("inference_runtime", "engine"),
        ("inference_runtime", "api_contract"),
        ("inference_runtime", "endpoint_env"),
        ("provenance", "legal_entity"),
        ("provenance", "product"),
        ("provenance", "owner"),
    ):
        value = sections[section].get(key)
        if not isinstance(value, str) or not value.strip() or _is_placeholder(value):
            errors.append(f"{section}.{key} must contain a concrete value for a ready model manifest")

    for key in ("sha256",):
        value = checkpoint.get(key)
        if not isinstance(value, str) or not _SHA256_RE.fullmatch(value):
            errors.append(f"checkpoint.{key} must contain a SHA-256 hash for a ready model manifest")
        value = dataset.get(key)
        if not isinstance(value, str) or not _SHA256_RE.fullmatch(value):
            errors.append(f"post_training.dataset.{key} must contain a SHA-256 hash for a ready model manifest")

    _require_string(dataset, "id", errors, prefix="post_training.dataset")
    _require_string(dataset, "version", errors, prefix="post_training.dataset")
    dataset_license = dataset.get("license")
    if not isinstance(dataset_license, str) or not dataset_license.strip() or _is_placeholder(dataset_license):
        errors.append("post_training.dataset.license must contain a concrete value for a ready model manifest")

    config = post_training.get("config")
    if not isinstance(config, Mapping):
        errors.append("post_training.config must be a concrete object for a ready model manifest")
    else:
        lora = config.get("lora")
        if not isinstance(lora, str) or not lora.strip() or _is_placeholder(lora):
            errors.append("post_training.config.lora must contain a concrete value for a ready model manifest")
        sequence_length = config.get("sequence_length")
        if isinstance(sequence_length, bool) or not isinstance(sequence_length, int) or sequence_length <= 0:
            errors.append("post_training.config.sequence_length must be a positive integer for a ready model manifest")
        if not isinstance(config.get("packing"), bool):
            errors.append("post_training.config.packing must be boolean for a ready model manifest")


def _is_placeholder(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    normalized = value.strip().lower()
    return normalized in {"pending", "todo", "tbd", "null", "none"} or normalized.startswith("pending-")


__all__ = ["MANIFEST_SCHEMA_VERSION", "load_model_manifest", "model_manifest_hash", "validate_model_manifest"]
