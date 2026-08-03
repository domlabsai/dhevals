import json
import tempfile
import unittest
from pathlib import Path

from dhevals_core.release import evaluate_release_gate
from dhevals_core.model_manifest import model_manifest_hash


ROOT = Path(__file__).resolve().parents[3]
RUN_PATH = ROOT / "public" / "data" / "latest-run.json"
SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "suite.json"
REPORT_PATH = ROOT / "public" / "data" / "latest-report.json"
VERIFICATION_PATH = ROOT / "public" / "data" / "latest-verification.json"
AUDIT_PATH = ROOT / "public" / "data" / "latest-audit.json"
CALIBRATION_PATH = ROOT / "public" / "data" / "latest-calibration.json"
LEADERBOARD_PATH = ROOT / "public" / "data" / "leaderboard.json"


class ReleaseGateTests(unittest.TestCase):
    def test_current_fixture_bundle_is_blocked_for_publication(self):
        result = evaluate_release_gate(
            run_path=RUN_PATH,
            suite_path=SUITE_PATH,
            report_path=REPORT_PATH,
            verification_path=VERIFICATION_PATH,
            audit_path=AUDIT_PATH,
            calibration_path=CALIBRATION_PATH,
            leaderboard_path=LEADERBOARD_PATH,
        )
        self.assertEqual(result["status"], "blocked")
        self.assertIn("human calibration is not ready", result["errors"])
        self.assertIn("offline fixture runs cannot be published", result["errors"])

    def test_complete_public_bundle_can_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            copies = {
                "run": RUN_PATH,
                "suite": SUITE_PATH,
                "report": REPORT_PATH,
                "verification": VERIFICATION_PATH,
                "audit": AUDIT_PATH,
                "calibration": CALIBRATION_PATH,
                "leaderboard": LEADERBOARD_PATH,
            }
            for label, source in copies.items():
                (root / f"{label}.json").write_text(source.read_text(encoding="utf-8"), encoding="utf-8")

            run = json.loads((root / "run.json").read_text(encoding="utf-8"))
            report = json.loads((root / "report.json").read_text(encoding="utf-8"))
            verification = json.loads((root / "verification.json").read_text(encoding="utf-8"))
            audit = json.loads((root / "audit.json").read_text(encoding="utf-8"))
            calibration = json.loads((root / "calibration.json").read_text(encoding="utf-8"))
            leaderboard = json.loads((root / "leaderboard.json").read_text(encoding="utf-8"))
            model_manifest = json.loads((ROOT / "benchmarks" / "models" / "sacilm" / "v0.1" / "model.json").read_text(encoding="utf-8"))
            model_manifest.update({"status": "ready"})
            model_manifest["base_model"].update({"id": "base-model-v1", "license": "apache-2.0"})
            model_manifest["checkpoint"].update({"id": "sacilm-v1", "revision": "git:abc123", "sha256": "a" * 64})
            model_manifest["post_training"].update({"quantization": "4bit-nf4", "training_commit": "git:def456"})
            model_manifest["post_training"]["dataset"].update({"sha256": "b" * 64, "license": "internal-reviewed"})
            model_manifest["post_training"]["config"].update({"lora": "r=16-alpha=32", "sequence_length": 4096, "packing": True})
            model_manifest["training_runtime"].update({"hardware": "A100-80GB", "image": "ghcr.io/example/unsloth@sha256:" + "c" * 64})

            run["run"]["model"]["provider"] = "runpod-openai-compatible"
            run["run"]["model"].setdefault("extra", {})["model_manifest"] = model_manifest
            run["run"]["model"]["extra"]["model_manifest_hash"] = model_manifest_hash(model_manifest)
            report["run"]["model"]["provider"] = "runpod-openai-compatible"
            report["run"]["model"]["extra"] = run["run"]["model"]["extra"]
            verification["status"] = "valid"
            calibration.update({
                "status": "ready",
                "ready": True,
                "completed_groups": calibration["required_groups"],
                "missing_groups": [],
                "disagreement_groups": [],
            })
            leaderboard["status"] = "ready"
            leaderboard["calibration"] = {"status": "ready", "ready": True}
            for entry in leaderboard["entries"]:
                entry["provider"] = "runpod-openai-compatible"
                entry["publication_status"] = "eligible"
                entry["lock_reason"] = None
                entry["score"] = 0.8
                entry["suite_id"] = "dhevals-heavy-user-ptbr"
                entry["suite_version"] = "0.2.0"
            for path, payload in (
                (root / "run.json", run),
                (root / "report.json", report),
                (root / "verification.json", verification),
                (root / "audit.json", audit),
                (root / "calibration.json", calibration),
                (root / "leaderboard.json", leaderboard),
            ):
                path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

            result = evaluate_release_gate(
                run_path=root / "run.json",
                suite_path=SUITE_PATH,
                report_path=root / "report.json",
                verification_path=root / "verification.json",
                audit_path=root / "audit.json",
                calibration_path=root / "calibration.json",
                leaderboard_path=root / "leaderboard.json",
            )
            self.assertEqual(result["status"], "ready", result["errors"])
            self.assertEqual(result["publication"], "public")


if __name__ == "__main__":
    unittest.main()
