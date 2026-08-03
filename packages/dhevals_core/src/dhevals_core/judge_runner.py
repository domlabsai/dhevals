"""Executable OpenAI-compatible LLM-as-a-Judge runner.

The runner is deliberately separate from :mod:`dhevals_core.judge`: that
module validates the immutable artifact contract, while this module performs
the network calls needed to create one.  Judge scores are normalized from the
public 0--4 rubric to 0--1 and never replace deterministic quality scores.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple
from urllib import error as url_error
from urllib import request as url_request

from .judge import JUDGE_SCHEMA_VERSION, validate_judge_artifact
from .models import sha256_json


class JudgeRunnerError(RuntimeError):
    """Raised when a judge request or response cannot be trusted."""


def run_judge(
    run_payload: Mapping[str, Any],
    rubric_payload: Mapping[str, Any],
    *,
    base_url: str,
    judge_model_id: str,
    api_key: Optional[str] = None,
    provider: str = "openai-compatible",
    temperature: float = 0.0,
    max_tokens: int = 1024,
    seed: Optional[int] = 7,
    timeout_seconds: float = 90.0,
) -> Dict[str, Any]:
    """Judge every rubric dimension for every result in a completed run.

    A single request is made per task and must return one JSON evaluation for
    every dimension in that task's rubric.  Any missing, duplicate, malformed,
    or failed response makes the resulting artifact ``invalid``; no zero score
    is fabricated for an unavailable judge.
    """

    source_run = _require_mapping(run_payload.get("run"), "run artifact.run")
    results = run_payload.get("results")
    if not isinstance(results, list) or not results:
        raise JudgeRunnerError("run artifact.results must be a non-empty list")
    rubric_tasks = _require_mapping(rubric_payload.get("tasks"), "rubric.tasks")
    suite_id = _required_text(rubric_payload.get("suite_id"), "rubric.suite_id")
    suite_version = _required_text(rubric_payload.get("suite_version"), "rubric.suite_version")
    if source_run.get("suite_id") != suite_id or source_run.get("suite_version") != suite_version:
        raise JudgeRunnerError("run and rubric suite identity/version do not match")

    endpoint = _completion_endpoint(base_url)
    rubric_hash = sha256_json(rubric_payload)
    evaluations: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    started = perf_counter()
    request_count = 0

    for index, result in enumerate(results):
        try:
            task_id = _required_text(result.get("task_id"), f"run.results[{index}].task_id")
            task_rubric = _require_mapping(rubric_tasks.get(task_id), f"rubric.tasks[{task_id}]")
            dimensions = task_rubric.get("dimensions")
            if not isinstance(dimensions, list) or not dimensions:
                raise JudgeRunnerError(f"rubric task {task_id} has no dimensions")
            normalized_dimensions = [_normalize_dimension(item, task_id, dimension_index) for dimension_index, item in enumerate(dimensions)]
            judge_input = {
                "task_id": task_id,
                "task_title": result.get("title"),
                "task_prompt": result.get("prompt"),
                "candidate_output": result.get("output"),
                "rubric": normalized_dimensions,
                "score_scale": {
                    "min": 0,
                    "max": 4,
                    "meaning": rubric_payload.get("scale", {}),
                },
            }
            response_payload = _request_judge(
                endpoint,
                judge_input,
                judge_model_id=judge_model_id,
                api_key=api_key,
                temperature=temperature,
                max_tokens=max_tokens,
                seed=seed,
                timeout_seconds=timeout_seconds,
            )
            request_count += 1
            parsed = _parse_response_content(response_payload)
            evaluations.extend(_normalize_evaluations(task_id, parsed, normalized_dimensions))
        except Exception as error:  # keep every failure in the artifact, never silently score it
            errors.append({"task_id": result.get("task_id"), "index": index, "error": _redact(str(error))})

    metadata = {
        "source_run_id": source_run.get("id"),
        "suite_id": suite_id,
        "suite_version": suite_version,
        "suite_hash": source_run.get("suite_hash"),
        "rubric_hash": rubric_hash,
        "provider": provider,
        "adapter": "openai-compatible",
        "endpoint": _safe_endpoint(endpoint),
        "request_count": request_count,
        "task_count": len(results),
        "generation": {"temperature": temperature, "max_tokens": max_tokens, "seed": seed},
        "latency_ms": round((perf_counter() - started) * 1000, 2),
        "errors": errors,
        "independent_from_quality": True,
    }
    if errors:
        artifact = {
            "schema_version": JUDGE_SCHEMA_VERSION,
            "kind": "dhevals_judge_artifact",
            "status": "invalid",
            "generated_at": _utc_now(),
            "judge_model": {"id": judge_model_id, "provider": provider},
            "rubric_hash": rubric_hash,
            "evaluations": evaluations,
            "score": None,
            "metadata": metadata,
        }
        return validate_judge_artifact(artifact)

    score = round(sum(float(item["score"]) for item in evaluations) / len(evaluations), 4) if evaluations else None
    artifact = {
        "schema_version": JUDGE_SCHEMA_VERSION,
        "kind": "dhevals_judge_artifact",
        "status": "evaluated",
        "generated_at": _utc_now(),
        "judge_model": {"id": judge_model_id, "provider": provider},
        "rubric_hash": rubric_hash,
        "evaluations": evaluations,
        "score": score,
        "metadata": metadata,
    }
    return validate_judge_artifact(artifact)


def _request_judge(
    endpoint: str,
    judge_input: Mapping[str, Any],
    *,
    judge_model_id: str,
    api_key: Optional[str],
    temperature: float,
    max_tokens: int,
    seed: Optional[int],
    timeout_seconds: float,
) -> Mapping[str, Any]:
    system = (
        "Você é um juiz independente do DHEvals. Avalie somente o output fornecido "
        "contra cada dimensão da rubrica. Não invente fatos, não atribua nota por "
        "estilo fora da rubrica e não revele raciocínio privado. Responda somente "
        "JSON no formato {\"evaluations\":[{\"dimension_id\":\"...\","
        "\"score\":0,\"evidence\":\"observação verificável\"}]}. "
        "score deve ser um inteiro de 0 a 4. evidence deve apontar sinais observáveis."
    )
    body: Dict[str, Any] = {
        "model": judge_model_id,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(judge_input, ensure_ascii=False, sort_keys=True)},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if seed is not None:
        body["seed"] = seed
    encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = url_request.Request(endpoint, data=encoded, headers=headers, method="POST")
    try:
        with url_request.urlopen(request, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except url_error.HTTPError as exc:
        body_text = _redact(exc.read().decode("utf-8", errors="replace")[:500])
        raise JudgeRunnerError(f"judge provider returned HTTP {exc.code}: {body_text}") from exc
    except (url_error.URLError, TimeoutError) as exc:
        raise JudgeRunnerError(f"judge provider request failed: {_redact(str(exc))}") from exc
    except json.JSONDecodeError as exc:
        raise JudgeRunnerError("judge provider returned invalid JSON") from exc
    if not isinstance(payload, Mapping):
        raise JudgeRunnerError("judge provider response must be an object")
    return payload


def _parse_response_content(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise JudgeRunnerError("judge response has no choices[0].message.content") from exc
    if not isinstance(content, str) or not content.strip():
        raise JudgeRunnerError("judge response content is empty")
    text = content.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.IGNORECASE | re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise JudgeRunnerError("judge response content is not valid JSON") from exc
    if not isinstance(parsed, Mapping):
        raise JudgeRunnerError("judge response JSON must be an object")
    return parsed


def _normalize_evaluations(task_id: str, payload: Mapping[str, Any], dimensions: Sequence[Mapping[str, Any]]) -> List[Dict[str, Any]]:
    raw_evaluations = payload.get("evaluations")
    if not isinstance(raw_evaluations, list):
        raise JudgeRunnerError(f"judge response for {task_id} must contain evaluations[]")
    expected = [item["id"] for item in dimensions]
    seen = set()
    normalized = []
    for index, item in enumerate(raw_evaluations):
        if not isinstance(item, Mapping):
            raise JudgeRunnerError(f"judge evaluation {task_id}[{index}] must be an object")
        dimension_id = _required_text(item.get("dimension_id"), f"judge evaluation {task_id}[{index}].dimension_id")
        if dimension_id in seen:
            raise JudgeRunnerError(f"duplicate judge dimension {task_id}/{dimension_id}")
        if dimension_id not in expected:
            raise JudgeRunnerError(f"unknown judge dimension {task_id}/{dimension_id}")
        seen.add(dimension_id)
        raw_score = item.get("score")
        if isinstance(raw_score, bool) or not isinstance(raw_score, (int, float)) or not 0 <= float(raw_score) <= 4:
            raise JudgeRunnerError(f"judge score for {task_id}/{dimension_id} must be between 0 and 4")
        evidence = _required_text(item.get("evidence"), f"judge evidence {task_id}/{dimension_id}")
        normalized.append({
            "task_id": task_id,
            "dimension_id": dimension_id,
            "score": round(float(raw_score) / 4.0, 4),
            "raw_score": float(raw_score),
            "evidence": evidence,
        })
    if set(expected) != seen:
        missing = sorted(set(expected) - seen)
        raise JudgeRunnerError(f"judge response for {task_id} is missing dimensions: {', '.join(missing)}")
    return normalized


def _normalize_dimension(item: Any, task_id: str, index: int) -> Dict[str, Any]:
    if not isinstance(item, Mapping):
        raise JudgeRunnerError(f"rubric dimension {task_id}[{index}] must be an object")
    dimension_id = _required_text(item.get("id"), f"rubric dimension {task_id}[{index}].id")
    guidance = item.get("what_to_look_for") or item.get("guidance") or item.get("label")
    return {
        "id": dimension_id,
        "label": item.get("label"),
        "weight": item.get("weight"),
        "guidance": _required_text(guidance, f"rubric dimension {task_id}/{dimension_id}.guidance"),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run an OpenAI-compatible DHEvals LLM-as-a-Judge evaluation.")
    parser.add_argument("--run", required=True, help="Completed DHEvals run artifact JSON")
    parser.add_argument("--rubric", required=True, help="Rubric JSON whose task dimensions will be judged")
    parser.add_argument("--base-url", required=True, help="OpenAI-compatible base URL")
    parser.add_argument("--api-key-env", help="Environment variable containing the judge API key")
    parser.add_argument("--model-id", default="judge", help="Judge model identifier")
    parser.add_argument("--provider", default="openai-compatible", help="Provider label stored in the artifact")
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--max-tokens", type=int, default=1024)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--timeout", type=float, default=90.0, help="Per-request timeout in seconds")
    parser.add_argument("--output", required=True, help="Output judge artifact JSON")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    run_payload = _read_json(args.run, "run artifact")
    rubric_payload = _read_json(args.rubric, "rubric")
    api_key = os.environ.get(args.api_key_env) if args.api_key_env else None
    artifact = run_judge(
        run_payload,
        rubric_payload,
        base_url=args.base_url,
        judge_model_id=args.model_id,
        api_key=api_key,
        provider=args.provider,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
        seed=args.seed,
        timeout_seconds=args.timeout,
    )
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "status": artifact["status"], "evaluations": len(artifact["evaluations"]), "score": artifact.get("score")}, ensure_ascii=False))
    return 0 if artifact["status"] in {"evaluated", "ready"} else 2


def _read_json(path: str, label: str) -> Mapping[str, Any]:
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"unable to read {label}: {exc}") from exc
    if not isinstance(payload, Mapping):
        raise SystemExit(f"{label} must be a JSON object")
    return payload


def _require_mapping(value: Any, context: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise JudgeRunnerError(f"{context} must be an object")
    return value


def _required_text(value: Any, context: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise JudgeRunnerError(f"{context} must be a non-empty string")
    return value.strip()


def _completion_endpoint(value: str) -> str:
    normalized = value.rstrip("/")
    return normalized if normalized.endswith("/chat/completions") else f"{normalized}/chat/completions"


def _safe_endpoint(value: str) -> str:
    try:
        from urllib.parse import urlsplit, urlunsplit

        parsed = urlsplit(value)
        return urlunsplit((parsed.scheme, parsed.netloc.split("@")[-1], parsed.path, "", ""))
    except Exception:
        return _redact(value)


def _redact(value: str) -> str:
    return re.sub(r"((?:api[_-]?key|token|authorization|password|secret)[=:])[^\s,}]+", r"\1[redacted]", value, flags=re.IGNORECASE)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
