import sys
import tempfile
import unittest
from pathlib import Path

from dhevals_core.adapters import AdapterError, CommandLineAdapter
from dhevals_core.models import TaskSpec
from dhevals_core.runner import ModelConfig


class CommandLineAdapterTests(unittest.TestCase):
    def setUp(self):
        self.task = TaskSpec(
            id="cli-demo",
            title="CLI demo",
            category="Infrastructure",
            prompt="linha 1\nlinha '2'",
            checks=[{"id": "length", "type": "min_length", "characters": 1}],
            context="contexto controlado",
        )
        self.config = ModelConfig(model_id="qwen-local", temperature=0.3, max_tokens=321)

    def test_stdin_mode_preserves_prompt_without_shell(self):
        command = [
            sys.executable,
            "-c",
            "import sys; print(sys.stdin.read().replace('linha', 'ok'))",
        ]
        response = CommandLineAdapter(command).complete(self.task, self.config)
        self.assertIn("ok 1", response.output)
        self.assertIn("contexto controlado", response.output)
        self.assertEqual(response.provider_metadata["adapter"], "command-line")
        self.assertTrue(response.provider_metadata["command"].startswith("python"))
        self.assertEqual(response.provider_metadata["prompt_mode"], "stdin")

    def test_arg_mode_renders_model_and_prompt_placeholder(self):
        command = [
            sys.executable,
            "-c",
            "import sys; print(sys.argv[1] + '|' + sys.argv[2] + '|' + sys.argv[3])",
            "{model}",
            "{temperature}",
            "{prompt}",
        ]
        response = CommandLineAdapter(command, prompt_mode="arg").complete(self.task, self.config)
        self.assertTrue(response.output.startswith("qwen-local|0.3|linha 1\nlinha '2'"))
        self.assertIn("contexto controlado", response.output)

    def test_non_zero_exit_is_an_infrastructure_error(self):
        command = [sys.executable, "-c", "import sys; print('boom', file=sys.stderr); sys.exit(3)"]
        with self.assertRaisesRegex(AdapterError, "status 3"):
            CommandLineAdapter(command).complete(self.task, self.config)

    def test_stdin_mode_rejects_prompt_placeholder(self):
        command = [sys.executable, "-c", "print({prompt})"]
        with self.assertRaisesRegex(AdapterError, "stdin prompt mode"):
            CommandLineAdapter(command).complete(self.task, self.config)

    def test_timeout_retries_with_escalating_budget(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "attempt"
            command = [
                sys.executable,
                "-c",
                "import pathlib,sys,time; p=pathlib.Path(sys.argv[1]); first=not p.exists(); p.touch(); time.sleep(0.2) if first else None; print('ok')",
                str(marker),
            ]
            response = CommandLineAdapter(
                command,
                timeout_seconds=0.05,
                timeout_retries=1,
                timeout_backoff=6,
            ).complete(self.task, self.config)

        self.assertEqual(response.output, "ok")
        self.assertEqual(response.provider_metadata["attempt"], 2)
        self.assertEqual(response.provider_metadata["timeout_retries"], 1)
        self.assertAlmostEqual(response.provider_metadata["timeout_seconds"], 0.3)

    def test_exhausted_timeout_is_explicit_infrastructure_error(self):
        command = [sys.executable, "-c", "import time; time.sleep(0.2)"]
        with self.assertRaisesRegex(AdapterError, r"timed out.*attempt 1/1"):
            CommandLineAdapter(command, timeout_seconds=0.05).complete(self.task, self.config)


if __name__ == "__main__":
    unittest.main()
