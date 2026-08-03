"""Publication gate for a DHEvals run and its derived artifacts."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Sequence

from .models import load_suite
from .model_manifest import model_manifest_hash, validate_model_manifest
from .verify import verify_run_file


def evaluate_release_gate(
    *,
    run_path: str | Path,
    suite_path: str | Path,
    report_path: str | Path,
    verification_path: str | Path,
    audit_path: str | Path,
    calibration_path: str | Path,
    leaderboard_path: str | Path,
) -> Dict[str, Any]:
    """Return a strict, publication-safe decision for the current bundle.

    The gate deliberately reconciles every canonical publication artifact. A
    valid run is not enough to publish a score: the suite audit, derived
    report, verifier, human calibration and leaderboard policy must all agree
    on identity and readiness. Independent judge/safety/agent lanes remain
    separate evidence artifacts; an absent lane stays ``not_evaluated`` in the
    scorecard instead of being replaced by a proxy. This keeps a fixture or a
    partially reviewed run out of public rankings while still allowing the
    console to display the blocked reason.
    """

    errors: list[str] = []
    checks: Dict[str, Any] = {}
    paths = {
        "run": Path(run_path),
        "suite": Path(suite_path),
        "report": Path(report_path),
        "verification": Path(verification_path),
        "audit": Path(audit_path),
        "calibration": Path(calibration_path),
        "leaderboard": Path(leaderboard_path),
    }
    payloads: Dict[str, Mapping[str, Any]] = {}
    for label, path in paths.items():
        if not path.exists():
            errors.append(f"{label} artifact not found: {path}")
            checks[label] = {"status": "missing", "path": str(path)}
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{label} artifact is not valid JSON: {path} ({exc})")
            checks[label] = {"status": "invalid", "path": str(path)}
            continue
        if not isinstance(payload, Mapping):
            errors.append(f"{label} artifact must be a JSON object: {path}")
            checks[label] = {"status": "invalid", "path": str(path)}
            continue
        payloads[label] = payload

    suite = None
    if "suite" in payloads:
        try:
            suite = load_suite(paths["suite"])
            checks["suite"] = {
                "status": "valid",
                "id": suite.id,
                "version": suite.version,
                "hash": suite.content_hash,
            }
        except Exception as exc:
            errors.append(f"suite cannot be loaded: {type(exc).__name__}: {exc}")
            checks["suite"] = {"status": "invalid", "path": str(paths["suite"])}

    if suite is not None and "run" in payloads and "report" in payloads:
        try:
            verification = verify_run_file(paths["run"], paths["suite"], paths["report"])
        except Exception as exc:
            verification = {"status": "invalid", "errors": [f"{type(exc).__name__}: {exc}"]}
        checks["run_report_identity"] = {
            "status": verification.get("status", "invalid"),
            "errors": list(verification.get("errors") or []),
        }
        if verification.get("status") != "valid":
            errors.extend(f"run/report verification: {item}" for item in verification.get("errors") or ["invalid"])

    if "verification" in payloads:
        verification = payloads["verification"]
        status = verification.get("status")
        checks["verification"] = {"status": status, "run_id": verification.get("run_id"), "suite_hash": verification.get("suite_hash")}
        if status != "valid":
            errors.append("published verification artifact is not valid")
        if "run" in payloads and verification.get("run_id") != _run_id(payloads["run"]):
            errors.append("verification run_id does not match the run artifact")
        if suite is not None and verification.get("suite_hash") != suite.content_hash:
            errors.append("verification suite_hash does not match the suite")

    if "audit" in payloads:
        audit = payloads["audit"]
        audit_hash = _audit_suite_hash(audit)
        checks["audit"] = {"status": audit.get("status"), "suite_hash": audit_hash}
        if audit.get("status") != "ready":
            errors.append("benchmark bundle audit is not ready")
        if suite is not None and audit_hash != suite.content_hash:
            errors.append("audit suite hash does not match the suite")

    calibration = payloads.get("calibration")
    if calibration is not None:
        required = _number(calibration.get("required_groups"))
        completed = _number(calibration.get("completed_groups"))
        ready = calibration.get("status") == "ready" and calibration.get("ready") is True
        checks["calibration"] = {
            "status": calibration.get("status"),
            "ready": ready,
            "completed_groups": completed,
            "required_groups": required,
        }
        if not ready:
            errors.append("human calibration is not ready")
        if required is None or completed is None or completed < required:
            errors.append("human calibration does not cover every anchor group")
        if calibration.get("disagreement_groups"):
            errors.append("human calibration still has disagreement groups")
        if calibration.get("missing_groups"):
            errors.append("human calibration still has missing groups")

    leaderboard = payloads.get("leaderboard")
    if leaderboard is not None:
        entries = leaderboard.get("entries") if isinstance(leaderboard.get("entries"), list) else []
        locked = [entry for entry in entries if isinstance(entry, Mapping) and entry.get("publication_status") != "eligible"]
        fixture_entries = [entry for entry in entries if isinstance(entry, Mapping) and entry.get("provider") == "fixture"]
        checks["leaderboard"] = {
            "status": leaderboard.get("status"),
            "entry_count": len(entries),
            "eligible_count": len(entries) - len(locked),
            "locked_count": len(locked),
            "fixture_count": len(fixture_entries),
        }
        if leaderboard.get("status") != "ready":
            errors.append("leaderboard is not ready")
        if not entries:
            errors.append("leaderboard has no entries")
        if locked:
            errors.append("leaderboard contains locked entries")
        if fixture_entries:
            errors.append("leaderboard contains fixture entries")
        if leaderboard.get("calibration", {}).get("ready") is not True:
            errors.append("leaderboard calibration gate is not ready")
        if suite is not None:
            mismatched = [entry for entry in entries if isinstance(entry, Mapping) and (entry.get("suite_id") != suite.id or entry.get("suite_version") != suite.version)]
            if mismatched:
                errors.append("leaderboard contains entries from a different suite version")

    run = payloads.get("run")
    report = payloads.get("report")
    if run is not None and report is not None:
        run_meta = run.get("run") if isinstance(run.get("run"), Mapping) else {}
        report_meta = report.get("run") if isinstance(report.get("run"), Mapping) else {}
        if run_meta.get("id") != report_meta.get("id"):
            errors.append("report run id does not match the run artifact")
        run_model = run_meta.get("model") if isinstance(run_meta.get("model"), Mapping) else {}
        report_model = report_meta.get("model") if isinstance(report_meta.get("model"), Mapping) else {}
        for field in ("model_id", "provider", "temperature", "max_tokens", "seed"):
            if run_model.get(field) != report_model.get(field):
                errors.append(f"report model.{field} does not match the run artifact")
        if run_model.get("provider") == "fixture":
            errors.append("offline fixture runs cannot be published")
            checks["model_manifest"] = {"status": "not_required_for_fixture"}
        else:
            extra = run_model.get("extra") if isinstance(run_model.get("extra"), Mapping) else {}
            embedded_manifest = extra.get("model_manifest") if isinstance(extra.get("model_manifest"), Mapping) else None
            if embedded_manifest is None:
                errors.append("non-fixture runs must embed a validated model manifest")
                checks["model_manifest"] = {"status": "missing"}
            else:
                try:
                    validated_manifest = validate_model_manifest(embedded_manifest, require_ready=True)
                    expected_manifest_hash = model_manifest_hash(validated_manifest)
                    actual_manifest_hash = extra.get("model_manifest_hash")
                    if actual_manifest_hash != expected_manifest_hash:
                        errors.append("model manifest hash does not match the embedded manifest")
                    checks["model_manifest"] = {
                        "status": "ready" if actual_manifest_hash == expected_manifest_hash else "invalid",
                        "id": validated_manifest.get("id"),
                        "version": validated_manifest.get("version"),
                        "hash": expected_manifest_hash,
                    }
                except Exception as exc:
                    errors.append(f"model manifest is not ready: {type(exc).__name__}: {exc}")
                    checks["model_manifest"] = {"status": "invalid"}
        checks["run"] = {
            "status": "valid" if not errors else "review",
            "run_id": run_meta.get("id"),
            "model_id": run_model.get("model_id"),
            "provider": run_model.get("provider"),
        }

    return {
        "kind": "dhevals_release_gate",
        "status": "ready" if not errors else "blocked",
        "publication": "public" if not errors else "blocked",
        "checks": checks,
        "errors": errors,
        "paths": {label: str(path) for label, path in paths.items()},
        "generated_at": _utc_now(),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Evaluate the DHEvals public-release gate.")
    parser.add_argument("--run", required=True, help="Canonical run artifact JSON")
    parser.add_argument("--suite", required=True, help="Versioned suite manifest JSON")
    parser.add_argument("--report", required=True, help="Canonical derived report JSON")
    parser.add_argument("--verification", required=True, help="Run verification JSON")
    parser.add_argument("--audit", required=True, help="Bundle audit JSON")
    parser.add_argument("--calibration", required=True, help="Calibration progress JSON")
    parser.add_argument("--leaderboard", required=True, help="Derived leaderboard JSON")
    parser.add_argument("--output", help="Optional release-gate JSON output")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    result = evaluate_release_gate(
        run_path=args.run,
        suite_path=args.suite,
        report_path=args.report,
        verification_path=args.verification,
        audit_path=args.audit,
        calibration_path=args.calibration,
        leaderboard_path=args.leaderboard,
    )
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["status"] == "ready" else 2


def _run_id(payload: Mapping[str, Any]) -> Any:
    run = payload.get("run")
    return run.get("id") if isinstance(run, Mapping) else None


def _audit_suite_hash(payload: Mapping[str, Any]) -> Optional[str]:
    checks = payload.get("checks")
    suite = checks.get("suite") if isinstance(checks, Mapping) else None
    value = suite.get("content_hash") if isinstance(suite, Mapping) else None
    return value if isinstance(value, str) else None


def _number(value: Any) -> Optional[float]:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
