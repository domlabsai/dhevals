import json
import tempfile
import unittest
from pathlib import Path

from dhevals_core.adapters import FixtureAdapter
from dhevals_core.models import load_suite
from dhevals_core.runner import ModelConfig, run_suite


ROOT = Path(__file__).resolve().parents[3]
SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.1" / "suite.json"
FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.1" / "fixtures" / "sacilm-fixture.json"
CALIBRATION_SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "suite.json"
CALIBRATION_FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "fixtures" / "sacilm-calibration-fixture.json"
NEGATIVE_FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "fixtures" / "negative-fixture.json"
V03_SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.3" / "suite.json"
V03_FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.3" / "fixtures" / "sacilm-calibration-fixture.json"
V03_NEGATIVE_FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.3" / "fixtures" / "negative-fixture.json"


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.suite = load_suite(SUITE_PATH)
        self.adapter = FixtureAdapter.from_file(str(FIXTURE_PATH))
        self.model = ModelConfig(model_id="sacilm-fixture", provider="fixture")

    def test_fixture_run_completes_all_tasks(self):
        run = run_suite(self.suite, self.adapter, self.model, run_id="fixture-run-001")
        self.assertEqual(run.run_id, "fixture-run-001")
        self.assertEqual(len(run.results), 6)
        self.assertEqual(run.coverage, 1.0)
        self.assertEqual(run.overall_score, 1.0)
        self.assertTrue(all(result.status == "pass" for result in run.results))
        self.assertTrue(all(result.metrics["latency_ms"] > 0 for result in run.results))

    def test_missing_fixture_is_an_infrastructure_error(self):
        incomplete = FixtureAdapter({"research-synthesis": {"output": "trade-offs, citações, grounding"}})
        run = run_suite(self.suite, incomplete, self.model, run_id="fixture-run-error")
        failed = [result for result in run.results if result.status == "error"]
        self.assertEqual(len(failed), 5)
        self.assertIsNone(failed[0].score)
        self.assertIn("fixture does not contain", failed[0].error)
        self.assertAlmostEqual(run.coverage, 1 / 6, places=4)

    def test_complete_calibration_matrix_fixture_passes(self):
        suite = load_suite(CALIBRATION_SUITE_PATH)
        adapter = FixtureAdapter.from_file(str(CALIBRATION_FIXTURE_PATH))
        run = run_suite(suite, adapter, ModelConfig(model_id="sacilm-calibration", provider="fixture"), run_id="calibration-run-001")
        self.assertEqual(len(run.results), 10)
        self.assertEqual(run.coverage, 1.0)
        self.assertEqual(run.overall_score, 1.0)
        self.assertTrue(all(result.status == "pass" for result in run.results))

    def test_negative_fixture_exposes_quality_failures_without_infrastructure_errors(self):
        suite = load_suite(CALIBRATION_SUITE_PATH)
        adapter = FixtureAdapter.from_file(str(NEGATIVE_FIXTURE_PATH))
        run = run_suite(suite, adapter, ModelConfig(model_id="negative-fixture", provider="fixture"), run_id="negative-run-001")
        self.assertEqual(len(run.results), 10)
        self.assertEqual(run.coverage, 1.0)
        self.assertTrue(all(result.status in {"partial", "fail"} for result in run.results))
        self.assertTrue(all(result.error is None for result in run.results))
        self.assertTrue(all(any(not check["passed"] for check in result.checks) for result in run.results))
        self.assertLess(run.overall_score, 1.0)

    def test_manifest_is_json_serializable_and_writable(self):
        run = run_suite(self.suite, self.adapter, self.model, run_id="fixture-run-json")
        with tempfile.TemporaryDirectory() as directory:
            output_path = Path(directory) / "run.json"
            run.write_json(output_path)
            payload = json.loads(output_path.read_text(encoding="utf-8"))
        self.assertEqual(payload["run"]["suite_hash"], self.suite.content_hash)
        self.assertEqual(payload["summary"]["overall_score"], 1.0)
        self.assertEqual(payload["results"][0]["prompt"], self.suite.tasks[0].effective_prompt())

    def test_optional_pricing_is_recorded_without_affecting_quality_score(self):
        run = run_suite(
            self.suite,
            self.adapter,
            ModelConfig(model_id="priced-fixture", provider="fixture", input_cost_per_1k_tokens=0.01, output_cost_per_1k_tokens=0.02),
            run_id="priced-run-001",
        )
        first = run.results[0]
        self.assertAlmostEqual(first.metrics["estimated_cost_usd"], 0.44561, places=6)
        self.assertEqual(run.overall_score, 1.0)
        self.assertEqual(run.model["pricing"], {"input_per_1k_tokens_usd": 0.01, "output_per_1k_tokens_usd": 0.02})

    def test_expanded_v03_positive_and_negative_lanes_cover_all_tasks(self):
        suite = load_suite(V03_SUITE_PATH)
        positive = run_suite(
            suite,
            FixtureAdapter.from_file(str(V03_FIXTURE_PATH)),
            ModelConfig(model_id="sacilm-v03-fixture", provider="fixture"),
            run_id="v03-positive-run",
        )
        negative = run_suite(
            suite,
            FixtureAdapter.from_file(str(V03_NEGATIVE_FIXTURE_PATH)),
            ModelConfig(model_id="v03-negative-fixture", provider="fixture"),
            run_id="v03-negative-run",
        )
        self.assertEqual(len(positive.results), 20)
        self.assertEqual(positive.coverage, 1.0)
        self.assertEqual(positive.overall_score, 1.0)
        self.assertTrue(all(result.status == "pass" for result in positive.results))
        self.assertEqual(len(negative.results), 20)
        self.assertEqual(negative.coverage, 1.0)
        self.assertTrue(all(result.status in {"partial", "fail"} for result in negative.results))
        self.assertTrue(all(result.error is None for result in negative.results))
        self.assertLess(negative.overall_score, 1.0)

    def test_replaying_the_same_v03_fixture_preserves_scored_content(self):
        suite = load_suite(V03_SUITE_PATH)
        adapter = FixtureAdapter.from_file(str(V03_FIXTURE_PATH))
        config = ModelConfig(model_id="sacilm-v03-fixture", provider="fixture", temperature=0.2, max_tokens=2048, seed=7)
        first = run_suite(suite, adapter, config, run_id="v03-replay-a")
        second = run_suite(suite, adapter, config, run_id="v03-replay-b")
        self.assertEqual(first.coverage, second.coverage)
        self.assertEqual(first.overall_score, second.overall_score)
        first_results = [{key: value for key, value in result.to_dict().items() if key not in {"started_at", "finished_at"}} for result in first.results]
        second_results = [{key: value for key, value in result.to_dict().items() if key not in {"started_at", "finished_at"}} for result in second.results]
        self.assertEqual(first_results, second_results)


if __name__ == "__main__":
    unittest.main()
