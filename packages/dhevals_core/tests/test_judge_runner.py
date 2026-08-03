import unittest
from unittest.mock import patch

from dhevals_core.judge_runner import (
    JudgeRunnerError,
    _normalize_evaluations,
    _parse_response_content,
    run_judge,
)


class JudgeRunnerTests(unittest.TestCase):
    def setUp(self):
        self.run_payload = {
            "run": {
                "id": "run-001",
                "suite_id": "suite",
                "suite_version": "0.1.0",
                "suite_hash": "suite-hash",
            },
            "results": [{"task_id": "task-1", "prompt": "pedido", "output": "resposta"}],
        }
        self.rubric = {
            "suite_id": "suite",
            "suite_version": "0.1.0",
            "scale": {"0": "falha", "4": "excelente"},
            "tasks": {"task-1": {"dimensions": [{"id": "grounding", "weight": 1, "what_to_look_for": "fonte"}]}},
        }

    def test_runner_normalizes_public_four_point_scale_and_keeps_quality_independent(self):
        with patch(
            "dhevals_core.judge_runner._request_judge",
            return_value={"choices": [{"message": {"content": '{"evaluations":[{"dimension_id":"grounding","score":3,"evidence":"cita a fonte"}]}'}}]},
        ) as request:
            artifact = run_judge(self.run_payload, self.rubric, base_url="http://judge/v1", judge_model_id="judge-local")
        self.assertEqual(request.call_count, 1)
        self.assertEqual(artifact["status"], "evaluated")
        self.assertEqual(artifact["score"], 0.75)
        self.assertEqual(artifact["evaluations"][0]["raw_score"], 3.0)
        self.assertTrue(artifact["metadata"]["independent_from_quality"])

    def test_runner_marks_partial_or_malformed_judgement_invalid_without_zero_fallback(self):
        with patch(
            "dhevals_core.judge_runner._request_judge",
            return_value={"choices": [{"message": {"content": '{"evaluations":[]}'}}]},
        ):
            artifact = run_judge(self.run_payload, self.rubric, base_url="http://judge/v1", judge_model_id="judge-local")
        self.assertEqual(artifact["status"], "invalid")
        self.assertIsNone(artifact["score"])
        self.assertTrue(artifact["metadata"]["errors"])

    def test_parser_accepts_json_fences_and_dimension_contract_rejects_missing(self):
        self.assertEqual(_parse_response_content({"choices": [{"message": {"content": "```json\n{\"evaluations\": []}\n```"}}]})["evaluations"], [])
        with self.assertRaises(JudgeRunnerError):
            _normalize_evaluations("task-1", {"evaluations": []}, [{"id": "grounding", "guidance": "fonte"}])


if __name__ == "__main__":
    unittest.main()
