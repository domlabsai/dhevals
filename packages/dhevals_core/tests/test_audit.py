import json
import tempfile
import unittest
from pathlib import Path

from dhevals_core.audit import audit_benchmark_bundle


ROOT = Path(__file__).resolve().parents[3]
SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "suite.json"
FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "fixtures" / "sacilm-calibration-fixture.json"
NEGATIVE_FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "fixtures" / "negative-fixture.json"
RUBRIC_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.2" / "anchor-rubric.json"
EXAMPLES_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.2" / "anchor-examples.json"
REGISTRY_PATH = ROOT / "benchmarks" / "comparisons" / "v0.2" / "models.json"
V03_SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.3" / "suite.json"
V03_FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.3" / "fixtures" / "sacilm-calibration-fixture.json"
V03_NEGATIVE_FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.3" / "fixtures" / "negative-fixture.json"
V03_RUBRIC_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.3" / "anchor-rubric.json"
V03_EXAMPLES_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.3" / "anchor-examples.json"
V03_REGISTRY_PATH = ROOT / "benchmarks" / "comparisons" / "v0.3" / "models.json"


class AuditTests(unittest.TestCase):
    def test_complete_v02_bundle_is_ready(self):
        audit = audit_benchmark_bundle(
            SUITE_PATH,
            fixture_path=FIXTURE_PATH,
            negative_fixture_path=NEGATIVE_FIXTURE_PATH,
            rubric_path=RUBRIC_PATH,
            examples_path=EXAMPLES_PATH,
            comparison_registry_path=REGISTRY_PATH,
        )
        self.assertEqual(audit["status"], "ready")
        self.assertEqual(audit["checks"]["suite"]["task_count"], 10)
        self.assertEqual(audit["checks"]["rubric"]["required_anchor_groups"], 150)
        self.assertEqual(audit["checks"]["fixture"]["coverage"], 1.0)
        self.assertEqual(audit["checks"]["negative_fixture"]["statuses"], ["fail"])

    def test_expanded_v03_bundle_is_ready(self):
        audit = audit_benchmark_bundle(
            V03_SUITE_PATH,
            fixture_path=V03_FIXTURE_PATH,
            negative_fixture_path=V03_NEGATIVE_FIXTURE_PATH,
            rubric_path=V03_RUBRIC_PATH,
            examples_path=V03_EXAMPLES_PATH,
            comparison_registry_path=V03_REGISTRY_PATH,
        )
        self.assertEqual(audit["status"], "ready")
        self.assertEqual(audit["checks"]["suite"]["task_count"], 20)
        self.assertEqual(audit["checks"]["rubric"]["dimension_count"], 60)
        self.assertEqual(audit["checks"]["rubric"]["required_anchor_groups"], 300)
        self.assertEqual(audit["checks"]["fixture"]["coverage"], 1.0)
        self.assertNotIn("pass", audit["checks"]["negative_fixture"]["statuses"])
        self.assertNotIn("error", audit["checks"]["negative_fixture"]["statuses"])

    def test_unknown_fixture_task_invalidates_bundle(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture_path = Path(directory) / "fixture.json"
            payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
            payload["unknown-task"] = {"output": "unexpected"}
            fixture_path.write_text(json.dumps(payload), encoding="utf-8")
            audit = audit_benchmark_bundle(SUITE_PATH, fixture_path=fixture_path)
        self.assertEqual(audit["status"], "invalid")
        self.assertTrue(any("unknown tasks" in error for error in audit["errors"]))

    def test_registry_identity_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            registry_path = Path(directory) / "models.json"
            registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
            registry["suite_version"] = "9.9.9"
            registry_path.write_text(json.dumps(registry), encoding="utf-8")
            audit = audit_benchmark_bundle(SUITE_PATH, comparison_registry_path=registry_path)
        self.assertEqual(audit["status"], "invalid")
        self.assertIn("comparison registry suite identity does not match manifest", audit["errors"])


if __name__ == "__main__":
    unittest.main()
