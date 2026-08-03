import json
import unittest
from pathlib import Path

from dhevals_core.models import sha256_json


ROOT = Path(__file__).resolve().parents[3]
SCORECARD_DIMENSIONS = {
    "quality", "factuality", "hallucination", "safety", "alignment", "robustness", "reasoning",
    "programming", "tool_use", "agentic", "business_logic", "memory", "instruction_following",
    "operational_reliability",
}


class TestMatrixTests(unittest.TestCase):
    def test_v02_and_v03_matrices_cover_the_versioned_sources(self):
        for version_directory, expected_tasks, expected_groups in (("v0.2", 10, 150), ("v0.3", 20, 300)):
            matrix = _read(ROOT / "benchmarks" / "tests" / "heavy-user-ptbr" / version_directory / "test-matrix.json")
            suite = _read(ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / version_directory / "suite.json")
            rubric = _read(ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / version_directory / "anchor-rubric.json")
            registry = _read(ROOT / "benchmarks" / "comparisons" / version_directory / "models.json")

            self.assertEqual(matrix["kind"], "dhevals_test_matrix")
            self.assertEqual(matrix["coverage"]["task_count"], expected_tasks)
            self.assertEqual(matrix["coverage"]["scenario_count"], expected_tasks * 2)
            self.assertEqual(matrix["coverage"]["anchor_group_count"], expected_groups)
            self.assertEqual(matrix["coverage"]["scorecard_dimension_count"], len(SCORECARD_DIMENSIONS))
            self.assertEqual({entry["dimension"] for entry in matrix["scorecard_coverage"]}, SCORECARD_DIMENSIONS)
            self.assertTrue(all(entry["evidence"] and entry["status"] for entry in matrix["scorecard_coverage"]))
            self.assertEqual(matrix["sources"]["hashes"]["suite"], sha256_json(suite))
            self.assertEqual(matrix["sources"]["hashes"]["rubric"], sha256_json(rubric))
            self.assertEqual(matrix["sources"]["hashes"]["comparison_registry"], sha256_json(registry))

            suite_by_id = {task["id"]: task for task in suite["tasks"]}
            registry_ids = [model["id"] for model in registry["models"]]
            self.assertEqual(set(matrix["tasks"] and [task["task_id"] for task in matrix["tasks"]]), set(suite_by_id))
            for matrix_task in matrix["tasks"]:
                suite_task = suite_by_id[matrix_task["task_id"]]
                self.assertEqual(matrix_task["model_ids"], registry_ids)
                self.assertEqual(matrix_task["task_contract"]["locale"], suite["locale"])
                self.assertEqual(matrix_task["task_contract"]["allowed_tools"], [])
                self.assertFalse(matrix_task["task_contract"]["pii_allowed"])
                self.assertEqual(matrix_task["task_contract"]["temporal_knowledge"], "frozen-fixture")
                self.assertEqual(
                    {check["id"] for check in matrix_task["deterministic_checks"]},
                    {check["id"] for check in suite_task["checks"]},
                )
                rubric_dimensions = rubric["tasks"][matrix_task["task_id"]]["dimensions"]
                self.assertEqual(
                    {dimension["id"] for dimension in matrix_task["rubric_dimensions"]},
                    {dimension["id"] for dimension in rubric_dimensions},
                )
                self.assertEqual([scenario["id"] for scenario in matrix_task["scenarios"]], ["positive-fixture", "negative-fixture"])
                self.assertEqual(matrix_task["scenarios"][0]["expected_status"], "pass")
                self.assertEqual(matrix_task["scenarios"][1]["expected_statuses"], ["partial", "fail"])
                self.assertEqual(matrix_task["calibration"]["anchor_levels"], [0, 1, 2, 3, 4])

    def test_catalog_exposes_both_matrix_versions(self):
        catalog = _read(ROOT / "public" / "data" / "test-matrix-catalog.json")
        self.assertEqual(catalog["kind"], "dhevals_test_matrix_catalog")
        self.assertEqual({entry["version"] for entry in catalog["versions"]}, {"0.2.0", "0.3.0"})
        self.assertEqual({entry["scenario_count"] for entry in catalog["versions"]}, {20, 40})
        for entry in catalog["versions"]:
            self.assertEqual(entry["scorecard_dimension_count"], len(SCORECARD_DIMENSIONS))
            self.assertEqual({item["dimension"] for item in entry["scorecard_dimensions"]}, SCORECARD_DIMENSIONS)
            self.assertTrue(all(item["mode"] and item["status"] for item in entry["scorecard_dimensions"]))


def _read(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


if __name__ == "__main__":
    unittest.main()
