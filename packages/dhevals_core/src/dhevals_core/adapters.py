"""Model adapters for fixture, HTTP and command-line inference."""

from __future__ import annotations

from dataclasses import dataclass
import json
import os
import shlex
import signal
import subprocess
from time import perf_counter
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Protocol, Sequence
from urllib import error as url_error
from urllib import request as url_request

from .models import TaskSpec
from .runner_types import ModelConfigLike


class AdapterError(RuntimeError):
    """An inference adapter could not return a model response."""


@dataclass(frozen=True)
class AdapterResponse:
    output: str
    latency_ms: float
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    finish_reason: Optional[str] = None
    provider_metadata: Optional[Dict[str, Any]] = None


class ModelAdapter(Protocol):
    def complete(self, task: TaskSpec, config: ModelConfigLike) -> AdapterResponse:
        ...


class FixtureAdapter:
    """Offline adapter used by tests and UI development."""

    def __init__(self, outputs: Mapping[str, Any]):
        self.outputs = dict(outputs)

    @classmethod
    def from_file(cls, path: str) -> "FixtureAdapter":
        with open(path, "r", encoding="utf-8") as fixture_file:
            payload = json.load(fixture_file)
        if not isinstance(payload, dict):
            raise ValueError("fixture must be an object keyed by task id")
        return cls(payload)

    def complete(self, task: TaskSpec, config: ModelConfigLike) -> AdapterResponse:
        if task.id not in self.outputs:
            raise AdapterError(f"fixture does not contain task {task.id!r}")
        entry = self.outputs[task.id]
        if isinstance(entry, str):
            entry = {"output": entry}
        if not isinstance(entry, dict) or not isinstance(entry.get("output"), str):
            raise AdapterError(f"fixture entry {task.id!r} must contain a string output")
        output = entry["output"]
        return AdapterResponse(
            output=output,
            latency_ms=float(entry.get("latency_ms", 0.0)),
            input_tokens=_optional_int(entry.get("input_tokens")),
            output_tokens=_optional_int(entry.get("output_tokens")),
            finish_reason=entry.get("finish_reason", "stop"),
            provider_metadata={"adapter": "fixture"},
        )


class OpenAICompatibleAdapter:
    """Small standard-library client for chat-completions compatible servers."""

    def __init__(self, base_url: str, api_key: Optional[str] = None, timeout_seconds: float = 90.0):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    def complete(self, task: TaskSpec, config: ModelConfigLike) -> AdapterResponse:
        endpoint = self.base_url
        if not endpoint.endswith("/chat/completions"):
            endpoint = endpoint + "/chat/completions"
        body: Dict[str, Any] = {
            "model": config.model_id,
            "messages": [{"role": "user", "content": task.effective_prompt()}],
            "temperature": config.temperature,
            "max_tokens": config.max_tokens,
        }
        if config.seed is not None:
            body["seed"] = config.seed
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        started = perf_counter()
        request = url_request.Request(endpoint, data=encoded, headers=headers, method="POST")
        try:
            with url_request.urlopen(request, timeout=self.timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except url_error.HTTPError as exc:
            body_text = exc.read().decode("utf-8", errors="replace")[:500]
            raise AdapterError(f"provider returned HTTP {exc.code}: {body_text}") from exc
        except (url_error.URLError, TimeoutError) as exc:
            raise AdapterError(f"provider request failed: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise AdapterError("provider returned invalid JSON") from exc

        try:
            message = payload["choices"][0]["message"]
            output = message["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AdapterError("provider response has no choices[0].message.content") from exc
        if not isinstance(output, str):
            raise AdapterError("provider response content is not a string")
        usage = payload.get("usage") if isinstance(payload, dict) else {}
        usage = usage if isinstance(usage, dict) else {}
        return AdapterResponse(
            output=output,
            latency_ms=round((perf_counter() - started) * 1000, 2),
            input_tokens=_optional_int(usage.get("prompt_tokens")),
            output_tokens=_optional_int(usage.get("completion_tokens")),
            finish_reason=payload.get("choices", [{}])[0].get("finish_reason"),
            provider_metadata={"adapter": "openai-compatible", "endpoint": endpoint},
        )


class CommandLineAdapter:
    """Run a local model CLI without invoking a shell.

    The command is an argv template, not a shell script.  It may contain the
    placeholders ``{model}``, ``{temperature}``, ``{max_tokens}`` and
    ``{prompt}``.  By default the task prompt is sent over stdin, which keeps
    prompts containing quotes, newlines or shell metacharacters intact.  Use
    ``prompt_mode='arg'`` for CLIs that require the prompt as an argument.
    """

    def __init__(
        self,
        command: Sequence[str],
        *,
        prompt_mode: str = "stdin",
        timeout_seconds: float = 120.0,
        timeout_retries: int = 0,
        timeout_backoff: float = 2.0,
        cwd: Optional[str] = None,
        environment: Optional[Mapping[str, str]] = None,
    ):
        if not command or any(not isinstance(part, str) or not part for part in command):
            raise ValueError("command must contain a non-empty executable and arguments")
        if prompt_mode not in {"stdin", "arg"}:
            raise ValueError("prompt_mode must be 'stdin' or 'arg'")
        if isinstance(timeout_seconds, bool) or not isinstance(timeout_seconds, (int, float)) or timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be a positive number")
        if isinstance(timeout_retries, bool) or not isinstance(timeout_retries, int) or timeout_retries < 0:
            raise ValueError("timeout_retries must be a non-negative integer")
        if isinstance(timeout_backoff, bool) or not isinstance(timeout_backoff, (int, float)) or timeout_backoff < 1:
            raise ValueError("timeout_backoff must be a number greater than or equal to 1")
        self.command = tuple(command)
        self.prompt_mode = prompt_mode
        self.timeout_seconds = float(timeout_seconds)
        self.timeout_retries = timeout_retries
        self.timeout_backoff = float(timeout_backoff)
        self.cwd = str(Path(cwd).expanduser()) if cwd else None
        self.environment = dict(environment or {})

    @classmethod
    def from_string(
        cls,
        command: str,
        *,
        prompt_mode: str = "stdin",
        timeout_seconds: float = 120.0,
        timeout_retries: int = 0,
        timeout_backoff: float = 2.0,
        cwd: Optional[str] = None,
        environment: Optional[Mapping[str, str]] = None,
    ) -> "CommandLineAdapter":
        try:
            argv = shlex.split(command)
        except ValueError as exc:
            raise ValueError(f"invalid CLI command: {exc}") from exc
        return cls(
            argv,
            prompt_mode=prompt_mode,
            timeout_seconds=timeout_seconds,
            timeout_retries=timeout_retries,
            timeout_backoff=timeout_backoff,
            cwd=cwd,
            environment=environment,
        )

    def complete(self, task: TaskSpec, config: ModelConfigLike) -> AdapterResponse:
        argv = [self._render(part, task, config) for part in self.command]
        has_prompt_placeholder = any("{prompt}" in part for part in self.command)
        input_text: Optional[str]
        if self.prompt_mode == "arg":
            if not has_prompt_placeholder:
                argv.append(task.effective_prompt())
            input_text = None
        else:
            if has_prompt_placeholder:
                raise AdapterError("stdin prompt mode cannot use the {prompt} command placeholder")
            input_text = task.effective_prompt()

        environment = os.environ.copy()
        environment.update(self.environment)
        started = perf_counter()
        attempts = 0
        timeout_seconds = self.timeout_seconds
        while True:
            attempts += 1
            try:
                completed = self._run_process(argv, input_text, timeout_seconds, environment)
            except FileNotFoundError as exc:
                raise AdapterError(f"CLI executable not found: {argv[0]}") from exc
            except subprocess.TimeoutExpired as exc:
                if attempts <= self.timeout_retries:
                    timeout_seconds *= self.timeout_backoff
                    continue
                total_attempts = self.timeout_retries + 1
                raise AdapterError(
                    f"CLI timed out after {timeout_seconds:g}s (attempt {attempts}/{total_attempts})"
                ) from exc
            except OSError as exc:
                raise AdapterError(f"CLI could not be started: {exc}") from exc
            else:
                break

        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout or "").strip().replace("\n", " ")[:500]
            suffix = f": {detail}" if detail else ""
            raise AdapterError(f"CLI exited with status {completed.returncode}{suffix}")
        output = completed.stdout
        if not isinstance(output, str) or not output.strip():
            raise AdapterError("CLI returned an empty stdout response")
        return AdapterResponse(
            output=output.strip(),
            latency_ms=round((perf_counter() - started) * 1000, 2),
            finish_reason="stop",
            provider_metadata={
                "adapter": "command-line",
                "command": Path(argv[0]).name,
                "prompt_mode": self.prompt_mode,
                "attempt": attempts,
                "timeout_seconds": timeout_seconds,
                "timeout_retries": attempts - 1,
            },
        )

    def _run_process(
        self,
        argv: Sequence[str],
        input_text: Optional[str],
        timeout_seconds: float,
        environment: Mapping[str, str],
    ) -> subprocess.CompletedProcess[str]:
        """Run one CLI attempt and reap the whole process group on timeout.

        OpenCode and similar CLIs may spawn a server or provider child.  Using
        a new session and killing its process group prevents a timed-out task
        from leaving an orphan request consuming quota in the background.
        """
        process = subprocess.Popen(
            argv,
            stdin=subprocess.PIPE if input_text is not None else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=self.cwd,
            env=environment,
            start_new_session=os.name != "nt",
        )
        try:
            stdout, stderr = process.communicate(input=input_text, timeout=timeout_seconds)
        except subprocess.TimeoutExpired:
            _terminate_process_group(process)
            stdout, stderr = process.communicate()
            raise
        return subprocess.CompletedProcess(argv, process.returncode, stdout, stderr)

    @staticmethod
    def _render(part: str, task: TaskSpec, config: ModelConfigLike) -> str:
        return (
            part.replace("{model}", str(config.model_id))
            .replace("{temperature}", str(config.temperature))
            .replace("{max_tokens}", str(config.max_tokens))
            .replace("{prompt}", task.effective_prompt())
        )


def adapter_from_environment(base_url: str, api_key_env: Optional[str]) -> OpenAICompatibleAdapter:
    api_key = os.environ.get(api_key_env) if api_key_env else None
    return OpenAICompatibleAdapter(base_url=base_url, api_key=api_key)


def cli_adapter_from_environment(
    command: str,
    *,
    prompt_mode: str = "stdin",
    timeout_seconds: float = 120.0,
    timeout_retries: int = 0,
    timeout_backoff: float = 2.0,
    cwd: Optional[str] = None,
) -> CommandLineAdapter:
    """Build a command adapter from a shell-like command string.

    ``shlex`` is used only to split the configured argv; execution itself is
    always ``shell=False``.  This makes the adapter usable with OpenCode,
    Qwen, Kimi and other CLIs without granting the runner a shell injection
    path through benchmark prompts.
    """

    return CommandLineAdapter.from_string(
        command,
        prompt_mode=prompt_mode,
        timeout_seconds=timeout_seconds,
        timeout_retries=timeout_retries,
        timeout_backoff=timeout_backoff,
        cwd=cwd,
    )


def _terminate_process_group(process: subprocess.Popen) -> None:
    """Terminate a timed-out CLI and any child processes it spawned."""
    if process.poll() is not None:
        return
    try:
        if os.name == "nt":
            process.kill()
        else:
            os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        # The process exited between poll() and kill().  communicate() below
        # still reaps it and returns the captured output.
        pass


def _optional_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    return int(value)
