"""CLI for validating and hashing DHEvals model manifests."""

from __future__ import annotations

import argparse
import json
from typing import Optional, Sequence

from .model_manifest import load_model_manifest, model_manifest_hash


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate a versioned DHEvals model manifest.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("validate", "hash"):
        command_parser = subparsers.add_parser(command, help=f"{command} a model manifest")
        command_parser.add_argument("--manifest", required=True, help="Path to model manifest JSON")
        command_parser.add_argument("--require-ready", action="store_true", help="Reject draft manifests")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    manifest = load_model_manifest(args.manifest, require_ready=args.require_ready)
    digest = model_manifest_hash(manifest)
    if args.command == "hash":
        print(digest)
    else:
        print(json.dumps({
            "manifest": str(args.manifest),
            "id": manifest["id"],
            "version": manifest["version"],
            "status": manifest["status"],
            "content_hash": digest,
        }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
