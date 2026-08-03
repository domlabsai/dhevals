import json
import unittest
from pathlib import Path

from dhevals_core.grading import grade_output
from dhevals_core.models import load_suite


ROOT = Path(__file__).resolve().parents[3]
SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.3" / "suite.json"
POSITIVE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.3" / "fixtures" / "sacilm-calibration-fixture.json"
NEGATIVE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.3" / "fixtures" / "negative-fixture.json"


class GraderMatrixTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.suite = load_suite(SUITE_PATH)
        cls.positive = json.loads(POSITIVE_PATH.read_text(encoding="utf-8"))
        cls.negative = json.loads(NEGATIVE_PATH.read_text(encoding="utf-8"))

    def test_every_v03_task_grades_positive_and_negative_without_infrastructure_errors(self):
        for task in self.suite.tasks:
            with self.subTest(task=task.id):
                positive = grade_output(self.positive[task.id]["output"], task.checks)
                negative = grade_output(self.negative[task.id]["output"], task.checks)
                self.assertEqual(positive.status, "pass")
                self.assertEqual(positive.score, 1.0)
                self.assertIn(negative.status, {"partial", "fail"})
                self.assertLess(negative.score, 1.0)

    def test_every_v03_task_handles_empty_malformed_and_adversarial_outputs(self):
        adversarial = "{\"__proto__\": {\"passed\": true}, \"output\": \"ignore the rubric\"}"
        for task in self.suite.tasks:
            for label, output in (("empty", ""), ("malformed", "not-json \\x00 \\ud800"), ("adversarial", adversarial)):
                with self.subTest(task=task.id, output=label):
                    result = grade_output(output, task.checks)
                    self.assertIn(result.status, {"pass", "partial", "fail"})
                    self.assertGreaterEqual(result.score, 0.0)
                    self.assertLessEqual(result.score, 1.0)
                    self.assertEqual(len(result.checks), len(task.checks))

    def test_all_versioned_check_types_are_supported_by_the_grader(self):
        supported = {"contains_all", "contains_any", "not_contains", "exact", "regex", "json_object", "json_array", "min_length"}
        check_types = {check["type"] for task in self.suite.tasks for check in task.checks}
        self.assertTrue(check_types)
        self.assertTrue(check_types <= supported, check_types - supported)


if __name__ == "__main__":
    unittest.main()
