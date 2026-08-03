import json
import tempfile
import unittest
from pathlib import Path

from dhevals_core.cli import main


ROOT = Path(__file__).resolve().parents[3]
SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.1" / "suite.json"
FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.1" / "fixtures" / "sacilm-fixture.json"
MANIFEST_PATH = ROOT / "benchmarks" / "models" / "sacilm" / "v0.1" / "model.json"


class CliTests(unittest.TestCase):
    def test_fixture_cli_writes_run_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "run.json"
            exit_code = main([
                "--suite", str(SUITE_PATH),
                "--fixture", str(FIXTURE_PATH),
                "--checkpoint", "sacilm-fixture-v0.1",
                "--runtime", "offline-fixture",
                "--training-commit", "abc1234",
                "--run-id", "cli-run-001",
                "--output", str(output),
            ])
            payload = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(exit_code, 0)
        self.assertEqual(payload["run"]["id"], "cli-run-001")
        self.assertEqual(payload["summary"]["overall_score"], 1.0)
        self.assertEqual(payload["run"]["model"]["extra"], {
            "checkpoint": "sacilm-fixture-v0.1",
            "runtime": "offline-fixture",
            "training_commit": "abc1234",
        })

    def test_model_manifest_is_embedded_with_canonical_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "run.json"
            exit_code = main([
                "--suite", str(SUITE_PATH),
                "--fixture", str(FIXTURE_PATH),
                "--model-manifest", str(MANIFEST_PATH),
                "--run-id", "cli-manifest-001",
                "--output", str(output),
            ])
            payload = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(exit_code, 0)
        extra = payload["run"]["model"]["extra"]
        self.assertEqual(extra["model_manifest"]["id"], "sacilm")
        self.assertEqual(len(extra["model_manifest_hash"]), 64)


if __name__ == "__main__":
    unittest.main()
