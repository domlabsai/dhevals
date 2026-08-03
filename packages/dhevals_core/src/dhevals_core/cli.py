"""Command-line entry point for fixture, HTTP and local CLI runs."""

from __future__ import annotations

import argparse
import json
from typing import Optional, Sequence

from .adapters import FixtureAdapter, adapter_from_environment, cli_adapter_from_environment
from .model_manifest import load_model_manifest, model_manifest_hash
from .models import load_suite
from .runner import ModelConfig, run_suite


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a versioned DHEvals suite.")
    parser.add_argument("--suite", required=True, help="Path to a suite JSON manifest")
    parser.add_argument("--fixture", help="Path to offline task outputs")
    parser.add_argument("--base-url", help="OpenAI-compatible base URL, e.g. http://localhost:8000/v1")
    parser.add_argument("--api-key-env", help="Environment variable containing the provider API key")
    parser.add_argument(
        "--cli-command",
        help="Local model CLI argv template; executed without a shell (supports {model}, {prompt}, {temperature}, {max_tokens})",
    )
    parser.add_argument(
        "--cli-prompt-mode",
        choices=("stdin", "arg"),
        default="stdin",
        help="Send each task prompt over stdin (default) or as a CLI argument",
    )
    parser.add_argument("--cli-timeout-seconds", type=float, default=120.0, help="Timeout for each local CLI call")
    parser.add_argument("--cli-cwd", help="Working directory for each local CLI call")
    parser.add_argument("--model-id", default="sacilm", help="Model identifier sent to the adapter")
    parser.add_argument("--provider", default=None, help="Provider label stored in the manifest")
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--max-tokens", type=int, default=2048)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--input-cost-per-1k", type=float, help="Optional USD price per 1,000 input tokens")
    parser.add_argument("--output-cost-per-1k", type=float, help="Optional USD price per 1,000 output tokens")
    parser.add_argument("--checkpoint", help="Checkpoint or model revision recorded in the run manifest")
    parser.add_argument("--runtime", help="Inference runtime recorded in the run manifest")
    parser.add_argument("--training-commit", help="Post-training/fine-tuning commit recorded in the run manifest")
    parser.add_argument("--model-manifest", help="Versioned model provenance manifest recorded in the run artifact")
    parser.add_argument("--run-id", help="Stable run identifier, useful for tests and reruns")
    parser.add_argument("--output", required=True, help="Path for the JSON run artifact")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    suite = load_suite(args.suite)
    if args.fixture:
        adapter = FixtureAdapter.from_file(args.fixture)
        provider = args.provider or "fixture"
    elif args.base_url:
        adapter = adapter_from_environment(args.base_url, args.api_key_env)
        provider = args.provider or "openai-compatible"
    elif args.cli_command:
        adapter = cli_adapter_from_environment(
            args.cli_command,
            prompt_mode=args.cli_prompt_mode,
            timeout_seconds=args.cli_timeout_seconds,
            cwd=args.cli_cwd,
        )
        provider = args.provider or "command-line"
    else:
        raise SystemExit("provide either --fixture, --base-url or --cli-command")
    model_manifest = load_model_manifest(args.model_manifest) if args.model_manifest else None
    manifest_checkpoint = _manifest_value(model_manifest, "checkpoint", "revision") or _manifest_value(model_manifest, "checkpoint", "id")
    manifest_runtime = _manifest_value(model_manifest, "inference_runtime", "engine")
    manifest_training_commit = _manifest_value(model_manifest, "post_training", "training_commit")
    provenance = {
        key: value
        for key, value in {
            "checkpoint": args.checkpoint or manifest_checkpoint,
            "runtime": args.runtime or manifest_runtime,
            "training_commit": args.training_commit or manifest_training_commit,
        }.items()
        if value
    }
    if model_manifest is not None:
        provenance["model_manifest"] = model_manifest
        provenance["model_manifest_hash"] = model_manifest_hash(model_manifest)
    model = ModelConfig(
        model_id=args.model_id,
        provider=provider,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
        seed=args.seed,
        extra=provenance,
        input_cost_per_1k_tokens=args.input_cost_per_1k,
        output_cost_per_1k_tokens=args.output_cost_per_1k,
    )
    run = run_suite(suite, adapter, model, run_id=args.run_id)
    run.write_json(args.output)
    print(json.dumps({"run_id": run.run_id, "overall_score": run.overall_score, "coverage": run.coverage}, ensure_ascii=False))
    return 0 if all(result.status != "error" for result in run.results) else 2


def _manifest_value(manifest, section, key):
    if not isinstance(manifest, dict):
        return None
    value = manifest.get(section)
    if not isinstance(value, dict):
        return None
    candidate = value.get(key)
    return candidate if isinstance(candidate, str) and candidate.strip() else None


if __name__ == "__main__":
    raise SystemExit(main())
