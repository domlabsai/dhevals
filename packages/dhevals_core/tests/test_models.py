import json
import tempfile
import unittest
from pathlib import Path

from dhevals_core.models import ValidationError, load_suite, suite_from_dict
from dhevals_core.suite_cli import main as suite_cli_main


ROOT = Path(__file__).resolve().parents[3]
SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.1" / "suite.json"
CALIBRATION_SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "suite.json"
CALIBRATION_RUBRIC_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.2" / "anchor-rubric.json"
EXPANDED_SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.3" / "suite.json"
EXPANDED_RUBRIC_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.3" / "anchor-rubric.json"


class SuiteModelTests(unittest.TestCase):
    def test_loads_versioned_heavy_user_suite(self):
        suite = load_suite(SUITE_PATH)
        self.assertEqual(suite.id, "dhevals-heavy-user-ptbr")
        self.assertEqual(suite.version, "0.1.0")
        self.assertEqual(suite.locale, "pt-BR")
        self.assertEqual(len(suite.tasks), 6)
        self.assertEqual(len(suite.content_hash), 64)
        self.assertTrue(all(task.context.strip() for task in suite.tasks))

    def test_context_is_rendered_separately_from_instruction(self):
        payload = {
            "id": "demo",
            "version": "0.1.0",
            "locale": "pt-BR",
            "tasks": [{
                "id": "task",
                "title": "Task",
                "category": "Test",
                "prompt": "Responda",
                "context": "Dado sintético",
                "checks": [{"id": "c", "type": "min_length", "characters": 1}],
            }],
        }
        task = suite_from_dict(payload).tasks[0]
        self.assertIn("Responda", task.effective_prompt())
        self.assertIn("Dado sintético", task.effective_prompt())
        self.assertEqual(task.to_dict()["context"], "Dado sintético")

    def test_loads_complete_calibration_matrix(self):
        suite = load_suite(CALIBRATION_SUITE_PATH)
        self.assertEqual(suite.version, "0.2.0")
        self.assertEqual(len(suite.tasks), 10)
        self.assertEqual({task.category for task in suite.tasks}, {
            "Research", "Documents", "Planning", "Data", "Code",
            "Communication", "Long context", "Structured output",
            "Safe automation", "Critical review",
        })

    def test_loads_expanded_v03_matrix(self):
        suite = load_suite(EXPANDED_SUITE_PATH)
        self.assertEqual(suite.version, "0.3.0")
        self.assertEqual(len(suite.tasks), 20)
        rubric = json.loads(EXPANDED_RUBRIC_PATH.read_text(encoding="utf-8"))
        self.assertEqual(len(rubric["tasks"]), 20)
        self.assertEqual(sum(len(task["dimensions"]) for task in rubric["tasks"].values()), 60)

    def test_rubric_weights_must_sum_to_one(self):
        payload = {
            "id": "demo",
            "version": "0.1.0",
            "locale": "pt-BR",
            "tasks": [{
                "id": "task",
                "title": "Task",
                "category": "Test",
                "prompt": "Do it",
                "checks": [{"id": "c", "type": "min_length", "characters": 1}],
                "rubric": [
                    {"id": "quality", "label": "Quality", "weight": 0.7},
                    {"id": "safety", "label": "Safety", "weight": 0.2},
                ],
            }],
        }
        with self.assertRaisesRegex(ValidationError, "weights must sum"):
            suite_from_dict(payload)

    def test_calibration_register_covers_every_task(self):
        suite = load_suite(CALIBRATION_SUITE_PATH)
        calibration = json.loads(CALIBRATION_RUBRIC_PATH.read_text(encoding="utf-8"))
        self.assertEqual(set(calibration["tasks"]), {task.id for task in suite.tasks})
        for task in suite.tasks:
            dimensions = calibration["tasks"][task.id]["dimensions"]
            self.assertAlmostEqual(sum(item["weight"] for item in dimensions), 1.0)
            self.assertEqual(len(dimensions), len(task.rubric))

    def test_suite_cli_scaffold_validate_hash_and_bump(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "suite.json"
            bumped = Path(directory) / "suite-v0.2.0.json"
            self.assertEqual(suite_cli_main([
                "scaffold", "--output", str(source), "--id", "demo-suite", "--version", "0.1.0",
            ]), 0)
            self.assertEqual(suite_cli_main(["validate", "--suite", str(source)]), 0)
            original_hash = load_suite(source).content_hash
            self.assertEqual(suite_cli_main(["hash", "--suite", str(source)]), 0)
            self.assertEqual(suite_cli_main([
                "bump", "--suite", str(source), "--version", "0.2.0", "--output", str(bumped),
            ]), 0)
            self.assertEqual(load_suite(bumped).version, "0.2.0")
            self.assertNotEqual(load_suite(bumped).content_hash, original_hash)

    def test_duplicate_task_ids_are_rejected(self):
        payload = {
            "id": "demo",
            "version": "0.1.0",
            "locale": "pt-BR",
            "tasks": [
                {"id": "same", "title": "One", "category": "A", "prompt": "Do one", "checks": [{"id": "c", "type": "min_length", "characters": 1}]},
                {"id": "same", "title": "Two", "category": "B", "prompt": "Do two", "checks": [{"id": "c", "type": "min_length", "characters": 1}]},
            ],
        }
        with self.assertRaises(ValidationError):
            suite_from_dict(payload)

    def test_invalid_json_file_has_actionable_error(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "broken.json"
            path.write_text("{broken", encoding="utf-8")
            with self.assertRaisesRegex(ValidationError, "not valid JSON"):
                load_suite(path)


if __name__ == "__main__":
    unittest.main()
