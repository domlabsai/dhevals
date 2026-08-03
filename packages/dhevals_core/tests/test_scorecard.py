import json
import tempfile
import unittest
from pathlib import Path

from dhevals_core.reporting import build_report
from dhevals_core.scorecard import build_scorecard, main as scorecard_main
from dhevals_core.adapters import FixtureAdapter
from dhevals_core.models import load_suite
from dhevals_core.runner import ModelConfig, run_suite


ROOT = Path(__file__).resolve().parents[3]
SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "suite.json"
FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "fixtures" / "sacilm-calibration-fixture.json"


class ScorecardTests(unittest.TestCase):
    def setUp(self):
        suite = load_suite(SUITE_PATH)
        run = run_suite(suite, FixtureAdapter.from_file(FIXTURE_PATH), ModelConfig(model_id="sacilm", provider="fixture"), run_id="scorecard-fixture")
        self.report = build_report(run.to_dict())

    def test_scorecard_does_not_invent_unmeasured_dimensions(self):
        scorecard = build_scorecard(self.report, calibration={"status": "pending", "completed_groups": 0, "required_groups": 150})
        self.assertEqual(scorecard["dimensions"]["quality"]["score"], 1.0)
        self.assertEqual(scorecard["dimensions"]["safety"]["status"], "not_evaluated")
        self.assertIsNone(scorecard["dimensions"]["safety"]["score"])
        self.assertEqual(scorecard["publication"]["status"], "blocked")
        self.assertTrue(scorecard["publication"]["fixture_locked"])
        self.assertEqual(scorecard["operational"]["task_count"], 10)

    def test_scorecard_accepts_independent_artifacts_without_overwriting_quality(self):
        scorecard = build_scorecard(
            self.report,
            calibration={"status": "ready", "completed_groups": 150, "required_groups": 150},
            safety={"status": "evaluated", "score": 0.9},
            agent={"status": "evaluated", "score": 0.8},
            judge={"status": "evaluated", "score": 0.7},
        )
        self.assertEqual(scorecard["dimensions"]["safety"]["score"], 0.9)
        self.assertEqual(scorecard["dimensions"]["agentic"]["score"], 0.8)
        self.assertEqual(scorecard["dimensions"]["judge_quality"]["score"], 0.7)
        self.assertEqual(scorecard["dimensions"]["quality"]["score"], 1.0)
        self.assertEqual(scorecard["publication"]["status"], "blocked")

    def test_cli_writes_scorecard_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            report_path = Path(directory) / "report.json"
            output_path = Path(directory) / "scorecard.json"
            report_path.write_text(json.dumps(self.report), encoding="utf-8")
            self.assertEqual(scorecard_main(["--report", str(report_path), "--output", str(output_path)]), 0)
            payload = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["kind"], "dhevals_scorecard")
            self.assertEqual(payload["model"]["run_id"], "scorecard-fixture")


if __name__ == "__main__":
    unittest.main()
