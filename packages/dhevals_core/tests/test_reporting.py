import json
import tempfile
import unittest
from pathlib import Path

from dhevals_core.adapters import FixtureAdapter
from dhevals_core.models import load_suite
from dhevals_core.reporting import build_html_report, build_report, build_results_csv, build_youtube_pack, write_reports
from dhevals_core.runner import ModelConfig, run_suite


ROOT = Path(__file__).resolve().parents[3]
SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.1" / "suite.json"
FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.1" / "fixtures" / "sacilm-fixture.json"


class ReportingTests(unittest.TestCase):
    def setUp(self):
        suite = load_suite(SUITE_PATH)
        adapter = FixtureAdapter.from_file(str(FIXTURE_PATH))
        self.run = run_suite(
            suite,
            adapter,
            ModelConfig(model_id="sacilm", provider="fixture", input_cost_per_1k_tokens=0.01, output_cost_per_1k_tokens=0.02),
            run_id="report-run-001",
        )
        self.artifact = self.run.to_dict()

    def test_report_reaggregates_categories_and_quality_summary(self):
        report = build_report(self.artifact)

        self.assertEqual(report["kind"], "dhevals_report")
        self.assertEqual(report["run"]["id"], "report-run-001")
        self.assertEqual(report["summary"]["task_count"], 6)
        self.assertEqual(report["summary"]["completed_count"], 6)
        self.assertEqual(report["summary"]["overall_score"], 1.0)
        self.assertGreater(report["summary"]["estimated_cost_usd_total"], 0)
        self.assertEqual({item["category"] for item in report["categories"]}, {
            "Research", "Documents", "Planning", "Data", "Code", "Communication",
        })

    def test_youtube_pack_contains_facts_and_fixture_limitation(self):
        pack = build_youtube_pack(build_report(self.artifact))

        self.assertEqual(pack["kind"], "dhevals_youtube_pack")
        self.assertEqual(pack["run_id"], "report-run-001")
        self.assertIn("100.0/100", pack["hook"])
        self.assertTrue(any("fixture offline" in limitation for limitation in pack["limitations"]))
        self.assertEqual(len(pack["category_breakdown"]), 6)

    def test_write_reports_persists_both_public_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            input_path = Path(directory) / "run.json"
            report_path = Path(directory) / "public" / "latest-report.json"
            youtube_path = Path(directory) / "public" / "latest-youtube-pack.json"
            html_path = Path(directory) / "public" / "latest-report.html"
            csv_path = Path(directory) / "public" / "latest-results.csv"
            input_path.write_text(json.dumps(self.artifact), encoding="utf-8")
            write_reports(input_path, report_path, youtube_path, html_path, csv_path)

            report = json.loads(report_path.read_text(encoding="utf-8"))
            youtube = json.loads(youtube_path.read_text(encoding="utf-8"))
            html = html_path.read_text(encoding="utf-8")
            csv = csv_path.read_text(encoding="utf-8")
        self.assertEqual(report["run"]["id"], "report-run-001")
        self.assertEqual(youtube["run_id"], "report-run-001")
        self.assertIn("DHEvals", html)
        self.assertIn("research-synthesis", csv)
        self.assertIn("estimated_cost_usd", csv.splitlines()[0])

    def test_html_and_csv_builders_escape_outputs_and_keep_task_rows(self):
        report = build_report(self.artifact)
        html = build_html_report(report)
        csv = build_results_csv(report)
        self.assertIn("Task results", html)
        self.assertIn("&lt;", build_html_report({**report, "results": [{"task_id": "x", "output": "<unsafe>", "status": "pass"}]}))
        self.assertEqual(csv.splitlines()[0].split(",")[0], "run_id")
        self.assertEqual(csv.count("research-synthesis"), 1)


if __name__ == "__main__":
    unittest.main()
