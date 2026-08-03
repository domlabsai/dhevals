"""Core contracts for the DHEvals benchmark runner."""

from .models import SuiteSpec, TaskSpec, ValidationError, load_suite
from .adapters import AdapterError, CommandLineAdapter, FixtureAdapter, OpenAICompatibleAdapter
from .runner import ModelConfig, RunResult, run_suite
from .reporting import build_html_report, build_report, build_results_csv, build_youtube_pack
from .leaderboard import build_leaderboard
from .calibration import required_anchor_groups, summarize_calibration
from .calibration_sheet import (
    import_adjudication_sheet,
    import_blind_review_sheets,
    import_review_sheet,
    write_adjudication_sheet,
    write_blind_review_sheets,
    write_review_sheet,
)
from .audit import audit_benchmark_bundle
from .release import evaluate_release_gate
from .model_manifest import load_model_manifest, model_manifest_hash, validate_model_manifest
from .scorecard import build_scorecard
from .judge import summarize_judge, validate_judge_artifact
from .judge_runner import run_judge
from .safety import build_safety_artifact, evaluate_safety_case, validate_safety_artifact
from .agent import build_agent_artifact, evaluate_trace, validate_agent_artifact

__all__ = [
    "ModelConfig",
    "AdapterError",
    "CommandLineAdapter",
    "FixtureAdapter",
    "OpenAICompatibleAdapter",
    "RunResult",
    "SuiteSpec",
    "TaskSpec",
    "ValidationError",
    "load_suite",
    "run_suite",
    "build_report",
    "build_html_report",
    "build_results_csv",
    "build_youtube_pack",
    "build_leaderboard",
    "required_anchor_groups",
    "summarize_calibration",
    "write_review_sheet",
    "import_review_sheet",
    "write_blind_review_sheets",
    "import_blind_review_sheets",
    "write_adjudication_sheet",
    "import_adjudication_sheet",
    "audit_benchmark_bundle",
    "evaluate_release_gate",
    "load_model_manifest",
    "model_manifest_hash",
    "validate_model_manifest",
    "build_scorecard",
    "summarize_judge",
    "validate_judge_artifact",
    "run_judge",
    "build_safety_artifact",
    "evaluate_safety_case",
    "validate_safety_artifact",
    "build_agent_artifact",
    "evaluate_trace",
    "validate_agent_artifact",
]
