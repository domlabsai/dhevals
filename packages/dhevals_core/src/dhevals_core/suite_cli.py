"""Authoring and versioning commands for DHEvals suite manifests."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Optional, Sequence

from .models import load_suite


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Author and validate a versioned DHEvals suite.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    for command in ("validate", "hash"):
        command_parser = subparsers.add_parser(command, help=f"{command} a suite manifest")
        command_parser.add_argument("--suite", required=True, help="Path to suite JSON")

    scaffold = subparsers.add_parser("scaffold", help="Create a minimal editable suite manifest")
    scaffold.add_argument("--output", required=True, help="Path for the new suite JSON")
    scaffold.add_argument("--id", required=True, dest="suite_id", help="Suite id")
    scaffold.add_argument("--version", required=True, help="Initial semantic version")
    scaffold.add_argument("--locale", default="pt-BR", help="Suite locale")
    scaffold.add_argument("--category", default="Research", help="Category for the first task")

    bump = subparsers.add_parser("bump", help="Write a new version without mutating the source manifest")
    bump.add_argument("--suite", required=True, help="Source suite JSON")
    bump.add_argument("--version", required=True, help="New semantic version")
    bump.add_argument("--output", required=True, help="Destination suite JSON")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command in {"validate", "hash"}:
        suite = load_suite(args.suite)
        payload: Dict[str, Any] = {
            "suite": str(args.suite),
            "id": suite.id,
            "version": suite.version,
            "locale": suite.locale,
            "task_count": len(suite.tasks),
            "content_hash": suite.content_hash,
        }
        if args.command == "hash":
            print(suite.content_hash)
        else:
            print(json.dumps(payload, ensure_ascii=False))
        return 0

    if args.command == "scaffold":
        payload = _scaffold_payload(args.suite_id, args.version, args.locale, args.category)
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        suite = load_suite(output_path)
        print(json.dumps({"output": str(output_path), "content_hash": suite.content_hash}, ensure_ascii=False))
        return 0

    source_path = Path(args.suite)
    source_payload = json.loads(source_path.read_text(encoding="utf-8"))
    if not isinstance(source_payload, dict):
        raise ValueError("suite manifest must be an object")
    previous_version = source_payload.get("version")
    source_payload["version"] = args.version
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(source_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    suite = load_suite(output_path)
    print(json.dumps({"source": str(source_path), "output": str(output_path), "previous_version": previous_version, "version": suite.version, "content_hash": suite.content_hash}, ensure_ascii=False))
    return 0


def _scaffold_payload(suite_id: str, version: str, locale: str, category: str) -> Dict[str, Any]:
    return {
        "id": suite_id,
        "version": version,
        "locale": locale,
        "description": "Editable DHEvals suite scaffold.",
        "license": "TBD",
        "provenance": {"owner": "DomHubs / Dom Labs", "publication": "draft"},
        "tasks": [{
            "id": "first-task",
            "title": "First task",
            "category": category,
            "prompt": "Replace this prompt with a reproducible heavy-user task.",
            "checks": [{"id": "minimum-output", "type": "min_length", "characters": 1}],
            "rubric": [],
            "metadata": {"publication": "draft"},
        }],
    }


if __name__ == "__main__":
    raise SystemExit(main())
