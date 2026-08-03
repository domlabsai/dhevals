import csv
import json
import tempfile
import unittest
from pathlib import Path

from dhevals_core.calibration import summarize_calibration
from dhevals_core.calibration_sheet import (
    ADJUDICATION_FIELDS,
    BLIND_SHEET_FIELDS,
    SHEET_FIELDS,
    import_adjudication_sheet,
    import_blind_review_sheets,
    import_review_sheet,
    write_adjudication_sheet,
    write_blind_review_sheets,
    write_review_sheet,
)


ROOT = Path(__file__).resolve().parents[3]
RUBRIC_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.2" / "anchor-rubric.json"
EXAMPLES_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.2" / "anchor-examples.json"
V03_RUBRIC_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.3" / "anchor-rubric.json"
V03_EXAMPLES_PATH = ROOT / "benchmarks" / "calibration" / "heavy-user-ptbr" / "v0.3" / "anchor-examples.json"


class CalibrationSheetTests(unittest.TestCase):
    def test_export_writes_one_row_per_anchor_group(self):
        with tempfile.TemporaryDirectory() as directory:
            sheet_path = Path(directory) / "review.csv"
            summary = write_review_sheet(RUBRIC_PATH, EXAMPLES_PATH, sheet_path)
            self.assertEqual(summary["rows"], 150)
            with sheet_path.open(newline="", encoding="utf-8") as handle:
                reader = csv.DictReader(handle)
                rows = list(reader)
            self.assertEqual(reader.fieldnames, SHEET_FIELDS)
            self.assertEqual(len(rows), 150)
            self.assertEqual(rows[0]["anchor_level"], "0")
            self.assertTrue(rows[0]["example_output"])
            self.assertTrue(rows[0]["dimension_guidance"])
            self.assertEqual(rows[0]["reviewer_a_score"], "")

    def test_import_preserves_two_reviewers_and_adjudication(self):
        with tempfile.TemporaryDirectory() as directory:
            sheet_path = Path(directory) / "review.csv"
            output_path = Path(directory) / "responses.json"
            write_review_sheet(RUBRIC_PATH, EXAMPLES_PATH, sheet_path)
            rows = []
            with sheet_path.open(newline="", encoding="utf-8") as handle:
                reader = csv.DictReader(handle)
                rows = list(reader)
                fieldnames = reader.fieldnames
            rows[0]["reviewer_a_score"] = "3"
            rows[0]["reviewer_a_notes"] = "rastreável"
            rows[0]["reviewer_b_score"] = "2.5"
            rows[0]["adjudicated_score"] = "3"
            rows[0]["adjudication_notes"] = "evidência adicional"
            with sheet_path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)

            summary = import_review_sheet(sheet_path, output_path, RUBRIC_PATH)
            payload = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(summary["responses"], 2)
            self.assertEqual(summary["adjudications"], 1)
            self.assertEqual({item["reviewer_id"] for item in payload["responses"]}, {"reviewer-a", "reviewer-b"})
            self.assertEqual(payload["responses"][0]["notes"], "rastreável")
            self.assertEqual(payload["adjudications"][0]["score"], 3)

    def test_blind_export_and_import_keep_reviewer_files_independent(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            sheets_dir = directory / "blind"
            output_path = directory / "responses.json"
            summary = write_blind_review_sheets(RUBRIC_PATH, EXAMPLES_PATH, sheets_dir)
            self.assertEqual(summary["rows_per_reviewer"], 150)
            self.assertEqual(set(Path(path).name for path in summary["paths"]), {"reviewer-a.csv", "reviewer-b.csv"})
            for path in summary["paths"]:
                with Path(path).open(newline="", encoding="utf-8") as handle:
                    reader = csv.DictReader(handle)
                    self.assertEqual(reader.fieldnames, BLIND_SHEET_FIELDS)
                    rows = list(reader)
                rows[0]["score"] = "3" if Path(path).stem == "reviewer-a" else "2"
                rows[0]["notes"] = "nota cega"
                with Path(path).open("w", newline="", encoding="utf-8") as handle:
                    writer = csv.DictWriter(handle, fieldnames=BLIND_SHEET_FIELDS)
                    writer.writeheader()
                    writer.writerows(rows)
            imported = import_blind_review_sheets(sorted(sheets_dir.glob("*.csv")), output_path, RUBRIC_PATH)
            payload = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(imported["responses"], 2)
            self.assertEqual({item["reviewer_id"] for item in payload["responses"]}, {"reviewer-a", "reviewer-b"})

    def test_calibration_pack_binds_immutable_anchor_content_but_allows_scores(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            sheets_dir = directory / "blind"
            pack_path = directory / "pack.json"
            output_path = directory / "responses.json"
            summary = write_blind_review_sheets(RUBRIC_PATH, EXAMPLES_PATH, sheets_dir, manifest_output=pack_path)
            self.assertEqual(summary["rows_per_reviewer"], 150)
            self.assertEqual(summary["manifest"], str(pack_path))
            pack = json.loads(pack_path.read_text(encoding="utf-8"))
            self.assertEqual(pack["required_groups"], 150)
            self.assertEqual(len(pack["anchor_fingerprint"]), 64)

            for path in sorted(sheets_dir.glob("*.csv")):
                with path.open(newline="", encoding="utf-8") as handle:
                    reader = csv.DictReader(handle)
                    rows = list(reader)
                rows[0]["score"] = "3"
                rows[0]["notes"] = "nota independente"
                with path.open("w", newline="", encoding="utf-8") as handle:
                    writer = csv.DictWriter(handle, fieldnames=BLIND_SHEET_FIELDS)
                    writer.writeheader()
                    writer.writerows(rows)

            imported = import_blind_review_sheets(sorted(sheets_dir.glob("*.csv")), output_path, RUBRIC_PATH, pack_path)
            self.assertEqual(imported["responses"], 2)
            payload = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["pack"]["id"], pack["pack_id"])

    def test_calibration_pack_rejects_changed_anchor_text(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            sheets_dir = directory / "blind"
            pack_path = directory / "pack.json"
            output_path = directory / "responses.json"
            write_blind_review_sheets(RUBRIC_PATH, EXAMPLES_PATH, sheets_dir, manifest_output=pack_path)
            path = sheets_dir / "reviewer-a.csv"
            with path.open(newline="", encoding="utf-8") as handle:
                reader = csv.DictReader(handle)
                rows = list(reader)
            rows[0]["example_output"] = "conteúdo alterado depois da distribuição"
            with path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=BLIND_SHEET_FIELDS)
                writer.writeheader()
                writer.writerows(rows)
            with self.assertRaisesRegex(ValueError, "anchor fingerprint"):
                import_blind_review_sheets(sorted(sheets_dir.glob("*.csv")), output_path, RUBRIC_PATH, pack_path)

    def test_v03_blind_pack_round_trips_all_300_groups(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            sheets_dir = directory / "blind"
            pack_path = directory / "pack.json"
            output_path = directory / "responses.json"
            summary = write_blind_review_sheets(V03_RUBRIC_PATH, V03_EXAMPLES_PATH, sheets_dir, manifest_output=pack_path)
            self.assertEqual(summary["rows_per_reviewer"], 300)
            for path in sorted(sheets_dir.glob("*.csv")):
                with path.open(newline="", encoding="utf-8") as handle:
                    reader = csv.DictReader(handle)
                    rows = list(reader)
                for row in rows:
                    row["score"] = "3" if path.stem == "reviewer-a" else "2"
                with path.open("w", newline="", encoding="utf-8") as handle:
                    writer = csv.DictWriter(handle, fieldnames=BLIND_SHEET_FIELDS)
                    writer.writeheader()
                    writer.writerows(rows)
            imported = import_blind_review_sheets(sorted(sheets_dir.glob("*.csv")), output_path, V03_RUBRIC_PATH, pack_path)
            payload = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(imported["responses"], 600)
            self.assertEqual(len(payload["responses"]), 600)
            self.assertEqual(payload["pack"]["id"], json.loads(pack_path.read_text(encoding="utf-8"))["pack_id"])

    def test_adjudication_sheet_round_trip_resolves_disagreement(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            sheets_dir = directory / "blind"
            responses_path = directory / "responses.json"
            adjudication_path = directory / "adjudication.csv"
            adjudications_json = directory / "adjudications.json"
            write_blind_review_sheets(RUBRIC_PATH, EXAMPLES_PATH, sheets_dir)
            for path in sorted(sheets_dir.glob("*.csv")):
                with path.open(newline="", encoding="utf-8") as handle:
                    reader = csv.DictReader(handle)
                    rows = list(reader)
                for row in rows:
                    row["score"] = "3" if path.stem == "reviewer-a" else "2"
                if path.stem == "reviewer-b":
                    rows[0]["score"] = "0"
                with path.open("w", newline="", encoding="utf-8") as handle:
                    writer = csv.DictWriter(handle, fieldnames=BLIND_SHEET_FIELDS)
                    writer.writeheader()
                    writer.writerows(rows)
            import_blind_review_sheets(sorted(sheets_dir.glob("*.csv")), responses_path, RUBRIC_PATH)
            export_summary = write_adjudication_sheet(RUBRIC_PATH, EXAMPLES_PATH, responses_path, adjudication_path)
            self.assertEqual(export_summary["disagreement_groups"], 1)
            with adjudication_path.open(newline="", encoding="utf-8") as handle:
                reader = csv.DictReader(handle)
                self.assertEqual(reader.fieldnames, ADJUDICATION_FIELDS)
                rows = list(reader)
            self.assertEqual(len(rows), 1)
            rows[0]["adjudicated_score"] = "2"
            rows[0]["adjudication_notes"] = "revisão conjunta"
            with adjudication_path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=ADJUDICATION_FIELDS)
                writer.writeheader()
                writer.writerows(rows)
            imported = import_adjudication_sheet(adjudication_path, adjudications_json, RUBRIC_PATH)
            self.assertEqual(imported["adjudications"], 1)
            payload = json.loads(responses_path.read_text(encoding="utf-8"))
            payload["adjudications"] = json.loads(adjudications_json.read_text(encoding="utf-8"))["adjudications"]
            rubric = json.loads(RUBRIC_PATH.read_text(encoding="utf-8"))
            summary = summarize_calibration(rubric, payload["responses"], adjudications=payload["adjudications"])
            self.assertEqual(summary["status"], "ready")
            self.assertEqual(summary["adjudicated_groups"], [[rows[0]["task_id"], rows[0]["dimension_id"], 0]])


if __name__ == "__main__":
    unittest.main()
