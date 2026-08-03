import unittest

from dhevals_core.grading import grade_output


class GradingTests(unittest.TestCase):
    def test_contains_and_length_checks_pass(self):
        result = grade_output(
            "Uma resposta com trade-offs, grounding e citações suficientes para o caso.",
            [
                {"id": "terms", "type": "contains_all", "values": ["trade-offs", "GROUNDING", "citações"]},
                {"id": "size", "type": "min_length", "characters": 20},
            ],
        )
        self.assertEqual(result.status, "pass")
        self.assertEqual(result.score, 1.0)

    def test_json_check_exposes_missing_keys(self):
        result = grade_output(
            '{"decisoes": []}',
            [{"id": "shape", "type": "json_object", "required_keys": ["decisoes", "riscos"]}],
        )
        self.assertEqual(result.status, "fail")
        self.assertIn("riscos", result.checks[0].details)

    def test_partial_score_is_not_silently_converted_to_pass(self):
        result = grade_output(
            "assunto e prazo",
            [
                {"id": "one", "type": "contains_all", "values": ["assunto"]},
                {"id": "two", "type": "contains_all", "values": ["próximos passos"]},
            ],
        )
        self.assertEqual(result.status, "partial")
        self.assertEqual(result.score, 0.5)

    def test_regex_can_be_case_insensitive(self):
        result = grade_output("Dia 3: revisão com responsável definido", [{"id": "schedule", "type": "regex", "pattern": "respons[aá]vel"}])
        self.assertEqual(result.status, "pass")


if __name__ == "__main__":
    unittest.main()

