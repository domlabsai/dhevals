import json
import tempfile
import unittest
from pathlib import Path

from dhevals_core.models import load_suite
from dhevals_core.reporting import build_report
from dhevals_core.runner import ModelConfig, run_suite
from dhevals_core.adapters import FixtureAdapter
from dhevals_core.verify import verify_run


ROOT = Path(__file__).resolve().parents[3]
SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "suite.json"
FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "fixtures" / "sacilm-calibration-fixture.json"


class VerifyTests(unittest.TestCase):
    def setUp(self):
        self.suite = load_suite(SUITE_PATH)
        self.run = run_suite(
            self.suite,
            FixtureAdapter.from_file(FIXTURE_PATH),
            ModelConfig(model_id="sacilm", provider="fixture"),
            run_id="verify-run-001",
        )
        self.artifact = self.run.to_dict()

    def test_complete_run_and_derived_report_are_valid(self):
        verification = verify_run(self.artifact, self.suite, report=build_report(self.artifact))
        self.assertEqual(verification["status"], "valid")
        self.assertEqual(verification["checked"], {"task_count": 10, "result_count": 10, "report": True})

    def test_suite_hash_mismatch_is_rejected(self):
        artifact = json.loads(json.dumps(self.artifact))
        artifact["run"]["suite_hash"] = "tampered"
        verification = verify_run(artifact, self.suite)
        self.assertEqual(verification["status"], "invalid")
        self.assertIn("run.suite_hash does not match suite", verification["errors"])

    def test_prompt_or_aggregation_mismatch_is_rejected(self):
        artifact = json.loads(json.dumps(self.artifact))
        artifact["results"][0]["prompt"] = "prompt adulterado"
        artifact["summary"]["overall_score"] = 0.42
        verification = verify_run(artifact, self.suite)
        self.assertEqual(verification["status"], "invalid")
        self.assertTrue(any("prompt does not match" in error for error in verification["errors"]))
        self.assertIn("summary.overall_score does not match result scores", verification["errors"])

    def test_cli_verification_can_write_an_audit_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact_path = Path(directory) / "run.json"
            output_path = Path(directory) / "verification.json"
            artifact_path.write_text(json.dumps(self.artifact), encoding="utf-8")
            from dhevals_core.verify import main

            exit_code = main([
                "--artifact", str(artifact_path),
                "--suite", str(SUITE_PATH),
                "--output", str(output_path),
            ])
            persisted = json.loads(output_path.read_text(encoding="utf-8"))
        self.assertEqual(exit_code, 0)
        self.assertEqual(persisted["status"], "valid")


if __name__ == "__main__":
    unittest.main()
