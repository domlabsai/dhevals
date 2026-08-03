import copy
import tempfile
import unittest
from pathlib import Path

from dhevals_core.calibration import main, required_anchor_groups, summarize_calibration
import json


ROOT = Path(__file__).resolve().parents[3]
RUBRIC_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.2" / "anchor-rubric.json"
EXAMPLES_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.2" / "anchor-examples.json"
V03_RUBRIC_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.3" / "anchor-rubric.json"
V03_EXAMPLES_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.3" / "anchor-examples.json"


class CalibrationTests(unittest.TestCase):
    def setUp(self):
        self.rubric = json.loads(RUBRIC_PATH.read_text(encoding="utf-8"))

    def test_empty_template_is_pending_and_covers_all_anchor_groups(self):
        summary = summarize_calibration(self.rubric, [])
        self.assertEqual(summary["status"], "pending")
        self.assertEqual(summary["required_groups"], 150)
        self.assertEqual(summary["completed_groups"], 0)

    def test_anchor_examples_cover_five_levels_for_every_task(self):
        examples = json.loads(EXAMPLES_PATH.read_text(encoding="utf-8"))
        self.assertEqual(set(examples["tasks"]), set(self.rubric["tasks"]))
        for task_id, task_examples in examples["tasks"].items():
            self.assertEqual([item["level"] for item in task_examples], [0, 1, 2, 3, 4], task_id)
            self.assertTrue(all(isinstance(item["output"], str) for item in task_examples))

    def test_two_consistent_reviewers_make_a_complete_fixture_ready(self):
        responses = []
        for task_id, dimension_id, anchor_level in required_anchor_groups(self.rubric):
            for reviewer_id in ("reviewer-a", "reviewer-b"):
                responses.append({
                    "task_id": task_id,
                    "dimension_id": dimension_id,
                    "anchor_level": anchor_level,
                    "reviewer_id": reviewer_id,
                    "score": anchor_level,
                })
        summary = summarize_calibration(self.rubric, responses)
        self.assertEqual(summary["status"], "ready")
        self.assertEqual(summary["completed_groups"], 150)

    def test_disagreement_requires_adjudication(self):
        task_id, dimension_id, anchor_level = required_anchor_groups(self.rubric)[0]
        responses = [
            {"task_id": task_id, "dimension_id": dimension_id, "anchor_level": anchor_level, "reviewer_id": "a", "score": 0},
            {"task_id": task_id, "dimension_id": dimension_id, "anchor_level": anchor_level, "reviewer_id": "b", "score": 4},
        ]
        summary = summarize_calibration(self.rubric, responses)
        self.assertEqual(summary["status"], "adjudication_required")
        self.assertEqual(summary["completed_groups"], 0)
        self.assertEqual(len(summary["disagreement_groups"]), 1)

    def test_adjudication_resolves_a_disagreement(self):
        task_id, dimension_id, anchor_level = required_anchor_groups(self.rubric)[0]
        responses = [
            {"task_id": task_id, "dimension_id": dimension_id, "anchor_level": anchor_level, "reviewer_id": "a", "score": 0},
            {"task_id": task_id, "dimension_id": dimension_id, "anchor_level": anchor_level, "reviewer_id": "b", "score": 4},
        ]
        summary = summarize_calibration(
            self.rubric,
            responses,
            adjudications=[
                {
                    "task_id": task_id,
                    "dimension_id": dimension_id,
                    "anchor_level": anchor_level,
                    "score": 2,
                    "notes": "decisão do adjudicador",
                }
            ],
        )
        self.assertEqual(summary["status"], "pending")
        self.assertEqual(summary["completed_groups"], 1)
        self.assertEqual(summary["adjudicated_groups"], [[task_id, dimension_id, anchor_level]])
        self.assertEqual(summary["disagreement_groups"], [])

    def test_ready_calibration_can_freeze_a_non_mutating_rubric_snapshot(self):
        responses = []
        for task_id, dimension_id, anchor_level in required_anchor_groups(self.rubric):
            for reviewer_id in ("reviewer-a", "reviewer-b"):
                responses.append({
                    "task_id": task_id,
                    "dimension_id": dimension_id,
                    "anchor_level": anchor_level,
                    "reviewer_id": reviewer_id,
                    "score": anchor_level,
                })
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            responses_path = directory / "responses.json"
            summary_path = directory / "summary.json"
            frozen_path = directory / "anchor-rubric-calibrated.json"
            responses_path.write_text(json.dumps({"responses": responses}), encoding="utf-8")
            exit_code = main([
                "--rubric", str(RUBRIC_PATH),
                "--responses", str(responses_path),
                "--output", str(summary_path),
                "--freeze-rubric", str(frozen_path),
            ])
            frozen = json.loads(frozen_path.read_text(encoding="utf-8"))
        self.assertEqual(exit_code, 0)
        self.assertEqual(frozen["status"], "calibrated")
        self.assertEqual(frozen["calibration"]["completed_groups"], 150)

    def test_expanded_v03_examples_and_two_reviewer_gate_cover_300_groups(self):
        rubric = json.loads(V03_RUBRIC_PATH.read_text(encoding="utf-8"))
        examples = json.loads(V03_EXAMPLES_PATH.read_text(encoding="utf-8"))
        self.assertEqual(len(required_anchor_groups(rubric)), 300)
        self.assertEqual(set(examples["tasks"]), set(rubric["tasks"]))
        self.assertTrue(all([item["level"] for item in examples["tasks"][task_id]] == [0, 1, 2, 3, 4] for task_id in rubric["tasks"]))

        responses = []
        for task_id, dimension_id, anchor_level in required_anchor_groups(rubric):
            for reviewer_id in ("reviewer-a", "reviewer-b"):
                responses.append({
                    "task_id": task_id,
                    "dimension_id": dimension_id,
                    "anchor_level": anchor_level,
                    "reviewer_id": reviewer_id,
                    "score": anchor_level,
                })
        summary = summarize_calibration(rubric, responses)
        self.assertEqual(summary["status"], "ready")
        self.assertEqual(summary["required_groups"], 300)
        self.assertEqual(summary["completed_groups"], 300)


if __name__ == "__main__":
    unittest.main()
