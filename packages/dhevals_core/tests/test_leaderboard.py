import copy
import unittest
from pathlib import Path

from dhevals_core.adapters import FixtureAdapter
from dhevals_core.leaderboard import build_leaderboard
from dhevals_core.models import load_suite
from dhevals_core.reporting import build_report
from dhevals_core.runner import ModelConfig, run_suite


ROOT = Path(__file__).resolve().parents[3]
SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.1" / "suite.json"
FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.1" / "fixtures" / "sacilm-fixture.json"


class LeaderboardTests(unittest.TestCase):
    def setUp(self):
        suite = load_suite(SUITE_PATH)
        adapter = FixtureAdapter.from_file(str(FIXTURE_PATH))
        fixture_run = run_suite(suite, adapter, ModelConfig(model_id="sacilm", provider="fixture"), run_id="fixture-board-001")
        self.fixture_report = build_report(fixture_run.to_dict())

    def test_fixture_entry_is_locked(self):
        board = build_leaderboard([self.fixture_report])
        entry = board["entries"][0]
        self.assertEqual(board["status"], "draft_locked")
        self.assertEqual(entry["publication_status"], "locked")
        self.assertIsNone(entry["score"])
        self.assertIn("fixture", entry["lock_reason"])

    def test_full_non_fixture_run_can_rank(self):
        candidate = copy.deepcopy(self.fixture_report)
        candidate["run"]["id"] = "candidate-board-001"
        candidate["run"]["model"]["provider"] = "runpod-openai-compatible"
        board = build_leaderboard([self.fixture_report, candidate])
        candidate_entry = next(item for item in board["entries"] if item["run_id"] == "candidate-board-001")
        self.assertEqual(candidate_entry["publication_status"], "eligible")
        self.assertEqual(candidate_entry["rank"], 1)
        self.assertEqual(candidate_entry["score"], 1.0)

    def test_real_run_stays_locked_until_human_calibration_is_ready(self):
        candidate = copy.deepcopy(self.fixture_report)
        candidate["run"]["id"] = "candidate-board-pending-calibration"
        candidate["run"]["model"]["provider"] = "runpod-openai-compatible"
        board = build_leaderboard([candidate], calibration={"status": "pending"})
        entry = board["entries"][0]
        self.assertEqual(entry["publication_status"], "locked")
        self.assertIsNone(entry["score"])
        self.assertEqual(entry["lock_reason"], "human calibration is not ready")


if __name__ == "__main__":
    unittest.main()
