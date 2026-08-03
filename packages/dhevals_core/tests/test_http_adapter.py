import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading
import unittest
from pathlib import Path

from dhevals_core.adapters import OpenAICompatibleAdapter
from dhevals_core.models import TaskSpec, load_suite
from dhevals_core.runner import ModelConfig, run_suite


ROOT = Path(__file__).resolve().parents[3]
SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.1" / "suite.json"
FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.1" / "fixtures" / "sacilm-fixture.json"
V02_SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "suite.json"
V02_FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.2" / "fixtures" / "sacilm-calibration-fixture.json"
V03_SUITE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.3" / "suite.json"
V03_FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.3" / "fixtures" / "sacilm-calibration-fixture.json"
V03_NEGATIVE_FIXTURE_PATH = ROOT / "benchmarks" / "suites" / "heavy-user-ptbr" / "v0.3" / "fixtures" / "negative-fixture.json"


class _Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        self.server.seen_payload = payload
        body = {"choices": [{"message": {"content": "resposta do servidor"}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 4, "completion_tokens": 3}}
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_args):
        return


class _SuiteHandler(BaseHTTPRequestHandler):
    """OpenAI-compatible fake provider that replays the versioned fixture."""

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        self.server.seen_payloads.append(payload)
        prompt = payload["messages"][0]["content"]
        if "RAG" in prompt:
            task_id = "research-synthesis"
        elif "brief operacional" in prompt:
            task_id = "document-qa"
        elif "plano de lançamento" in prompt:
            task_id = "plan-outline"
        elif "tabela sintética" in prompt:
            task_id = "data-analysis"
        elif "worker TypeScript" in prompt:
            task_id = "code-generation"
        else:
            task_id = "email-draft"
        output = self.server.fixture_outputs[task_id]["output"]
        body = {
            "choices": [{"message": {"content": output}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 12, "completion_tokens": 24},
        }
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_args):
        return


class _VersionedFixtureHandler(BaseHTTPRequestHandler):
    """Replay any versioned fixture by matching the exact task prompt."""

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        self.server.seen_payloads.append(payload)
        task_id = self.server.prompt_to_task[payload["messages"][0]["content"]]
        output = self.server.fixture_outputs[task_id]["output"]
        body = {
            "choices": [{"message": {"content": output}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 12, "completion_tokens": 24},
        }
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_args):
        return


class HttpAdapterTests(unittest.TestCase):
    def test_openai_compatible_contract(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            adapter = OpenAICompatibleAdapter(f"http://127.0.0.1:{server.server_port}/v1")
            task = TaskSpec(id="demo", title="Demo", category="Test", prompt="Olá", checks=[{"id": "c", "type": "min_length", "characters": 1}])
            response = adapter.complete(task, ModelConfig(model_id="sacilm"))
            self.assertEqual(response.output, "resposta do servidor")
            self.assertEqual(response.input_tokens, 4)
            self.assertEqual(server.seen_payload["model"], "sacilm")
            self.assertEqual(server.seen_payload["messages"][0]["content"], "Olá")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_http_adapter_runs_the_entire_versioned_suite(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), _SuiteHandler)
        server.seen_payloads = []
        server.fixture_outputs = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            suite = load_suite(SUITE_PATH)
            adapter = OpenAICompatibleAdapter(f"http://127.0.0.1:{server.server_port}/v1")
            run = run_suite(suite, adapter, ModelConfig(model_id="sacilm-http", provider="fake-http"), run_id="http-suite-001")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.assertEqual(run.run_id, "http-suite-001")
        self.assertEqual(run.coverage, 1.0)
        self.assertEqual(run.overall_score, 1.0)
        self.assertEqual(len(server.seen_payloads), len(suite.tasks))
        self.assertTrue(all(payload["model"] == "sacilm-http" for payload in server.seen_payloads))

    def test_http_adapter_runs_the_complete_v02_matrix_without_manifest_changes(self):
        suite = load_suite(V02_SUITE_PATH)
        server = ThreadingHTTPServer(("127.0.0.1", 0), _VersionedFixtureHandler)
        server.seen_payloads = []
        server.fixture_outputs = json.loads(V02_FIXTURE_PATH.read_text(encoding="utf-8"))
        server.prompt_to_task = {task.effective_prompt(): task.id for task in suite.tasks}
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            adapter = OpenAICompatibleAdapter(f"http://127.0.0.1:{server.server_port}/v1")
            run = run_suite(suite, adapter, ModelConfig(model_id="sacilm-http", provider="runpod-openai-compatible"), run_id="http-v02-001")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.assertEqual(run.coverage, 1.0)
        self.assertEqual(run.overall_score, 1.0)
        self.assertEqual(len(run.results), 10)
        self.assertEqual(len(server.seen_payloads), 10)

    def test_http_adapter_runs_the_expanded_v03_matrix_without_manifest_changes(self):
        suite = load_suite(V03_SUITE_PATH)
        server = ThreadingHTTPServer(("127.0.0.1", 0), _VersionedFixtureHandler)
        server.seen_payloads = []
        server.fixture_outputs = json.loads(V03_FIXTURE_PATH.read_text(encoding="utf-8"))
        server.prompt_to_task = {task.effective_prompt(): task.id for task in suite.tasks}
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            adapter = OpenAICompatibleAdapter(f"http://127.0.0.1:{server.server_port}/v1")
            run = run_suite(suite, adapter, ModelConfig(model_id="sacilm-http", provider="runpod-openai-compatible"), run_id="http-v03-001")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.assertEqual(run.coverage, 1.0)
        self.assertEqual(run.overall_score, 1.0)
        self.assertEqual(len(run.results), 20)
        self.assertEqual(len(server.seen_payloads), 20)

    def test_http_adapter_preserves_expanded_v03_negative_quality_failures(self):
        suite = load_suite(V03_SUITE_PATH)
        server = ThreadingHTTPServer(("127.0.0.1", 0), _VersionedFixtureHandler)
        server.seen_payloads = []
        server.fixture_outputs = json.loads(V03_NEGATIVE_FIXTURE_PATH.read_text(encoding="utf-8"))
        server.prompt_to_task = {task.effective_prompt(): task.id for task in suite.tasks}
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            adapter = OpenAICompatibleAdapter(f"http://127.0.0.1:{server.server_port}/v1")
            run = run_suite(suite, adapter, ModelConfig(model_id="sacilm-http-negative", provider="runpod-openai-compatible"), run_id="http-v03-negative-001")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.assertEqual(run.coverage, 1.0)
        self.assertLess(run.overall_score, 1.0)
        self.assertEqual(len(run.results), 20)
        self.assertEqual(len(server.seen_payloads), 20)
        self.assertTrue(all(result.status in {"partial", "fail"} for result in run.results))
        self.assertTrue(all(result.error is None for result in run.results))


if __name__ == "__main__":
    unittest.main()
