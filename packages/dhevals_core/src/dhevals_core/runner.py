"""Suite execution and transparent run manifests."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
from pathlib import Path
import uuid
from typing import Any, Dict, List, Optional, Union
from time import perf_counter

from .adapters import AdapterResponse, ModelAdapter
from .grading import GradeResult, grade_output
from .models import SuiteSpec, TaskSpec, sha256_json


@dataclass(frozen=True)
class ModelConfig:
    model_id: str
    provider: str = "fixture"
    temperature: float = 0.2
    max_tokens: int = 2048
    seed: Optional[int] = 7
    extra: Dict[str, Any] = field(default_factory=dict)
    input_cost_per_1k_tokens: Optional[float] = None
    output_cost_per_1k_tokens: Optional[float] = None

    def __post_init__(self) -> None:
        for field_name in ("input_cost_per_1k_tokens", "output_cost_per_1k_tokens"):
            value = getattr(self, field_name)
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0):
                raise ValueError(f"{field_name} must be a non-negative number when provided")

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "model_id": self.model_id,
            "provider": self.provider,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "seed": self.seed,
            "extra": self.extra,
        }
        pricing = {}
        if self.input_cost_per_1k_tokens is not None:
            pricing["input_per_1k_tokens_usd"] = self.input_cost_per_1k_tokens
        if self.output_cost_per_1k_tokens is not None:
            pricing["output_per_1k_tokens_usd"] = self.output_cost_per_1k_tokens
        if pricing:
            payload["pricing"] = pricing
        return payload


@dataclass(frozen=True)
class TaskResult:
    task_id: str
    title: str
    category: str
    prompt: str
    output: Optional[str]
    score: Optional[float]
    status: str
    checks: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "title": self.title,
            "category": self.category,
            "prompt": self.prompt,
            "output": self.output,
            "score": self.score,
            "status": self.status,
            "checks": self.checks,
            "metrics": self.metrics,
            "error": self.error,
        }


@dataclass(frozen=True)
class RunResult:
    run_id: str
    suite_id: str
    suite_version: str
    suite_hash: str
    model: Dict[str, Any]
    started_at: str
    finished_at: str
    results: List[TaskResult]
    runner_version: str = "0.1.0"

    @property
    def completed_count(self) -> int:
        return sum(result.status in {"pass", "partial", "fail"} for result in self.results)

    @property
    def coverage(self) -> float:
        return round(self.completed_count / len(self.results), 4) if self.results else 0.0

    @property
    def overall_score(self) -> Optional[float]:
        scores = [result.score for result in self.results if result.score is not None]
        return round(sum(scores) / len(scores), 4) if scores else None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run": {
                "id": self.run_id,
                "suite_id": self.suite_id,
                "suite_version": self.suite_version,
                "suite_hash": self.suite_hash,
                "model": self.model,
                "runner_version": self.runner_version,
                "started_at": self.started_at,
                "finished_at": self.finished_at,
            },
            "summary": {
                "task_count": len(self.results),
                "completed_count": self.completed_count,
                "coverage": self.coverage,
                "overall_score": self.overall_score,
            },
            "results": [result.to_dict() for result in self.results],
        }

    def write_json(self, path: Union[str, Path]) -> None:
        output_path = Path(path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(self.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_suite(suite: SuiteSpec, adapter: ModelAdapter, model: ModelConfig, run_id: Optional[str] = None) -> RunResult:
    started_at = _utc_now()
    resolved_run_id = run_id or f"run-{uuid.uuid4().hex[:12]}"
    results: List[TaskResult] = []
    for task in suite.tasks:
        results.append(_run_task(task, adapter, model))
    finished_at = _utc_now()
    return RunResult(
        run_id=resolved_run_id,
        suite_id=suite.id,
        suite_version=suite.version,
        suite_hash=suite.content_hash,
        model=model.to_dict(),
        started_at=started_at,
        finished_at=finished_at,
        results=results,
    )


def _run_task(task: TaskSpec, adapter: ModelAdapter, model: ModelConfig) -> TaskResult:
    started = perf_counter()
    try:
        response: AdapterResponse = adapter.complete(task, model)
        grade: GradeResult = grade_output(response.output, task.checks)
        latency_ms = response.latency_ms or round((perf_counter() - started) * 1000, 2)
        metrics = {
            "latency_ms": latency_ms,
            "input_tokens": response.input_tokens,
            "output_tokens": response.output_tokens,
            "total_tokens": _total_tokens(response.input_tokens, response.output_tokens),
            "estimated_cost_usd": _estimate_cost_usd(response.input_tokens, response.output_tokens, model),
            "finish_reason": response.finish_reason,
            "provider_metadata": response.provider_metadata or {},
        }
        return TaskResult(
            task_id=task.id,
            title=task.title,
            category=task.category,
            prompt=task.effective_prompt(),
            output=response.output,
            score=grade.score,
            status=grade.status,
            checks=[check.to_dict() for check in grade.checks],
            metrics=metrics,
        )
    except Exception as exc:  # errors remain explicit; they are not silently scored as quality failures
        return TaskResult(
            task_id=task.id,
            title=task.title,
            category=task.category,
            prompt=task.effective_prompt(),
            output=None,
            score=None,
            status="error",
            checks=[],
            metrics={"latency_ms": round((perf_counter() - started) * 1000, 2)},
            error=f"{type(exc).__name__}: {exc}",
        )


def _total_tokens(input_tokens: Optional[int], output_tokens: Optional[int]) -> Optional[int]:
    if input_tokens is None and output_tokens is None:
        return None
    return (input_tokens or 0) + (output_tokens or 0)


def _estimate_cost_usd(input_tokens: Optional[int], output_tokens: Optional[int], model: ModelConfig) -> Optional[float]:
    if model.input_cost_per_1k_tokens is None and model.output_cost_per_1k_tokens is None:
        return None
    total = 0.0
    if model.input_cost_per_1k_tokens is not None and input_tokens is not None:
        total += input_tokens / 1000 * model.input_cost_per_1k_tokens
    if model.output_cost_per_1k_tokens is not None and output_tokens is not None:
        total += output_tokens / 1000 * model.output_cost_per_1k_tokens
    return round(total, 8)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
