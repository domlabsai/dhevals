"""Deterministic graders used by the first DHEvals vertical slice."""

from __future__ import annotations

from dataclasses import dataclass
import json
import re
from typing import Any, Dict, Iterable, List, Mapping, Sequence


@dataclass(frozen=True)
class CheckResult:
    id: str
    type: str
    passed: bool
    score: float
    details: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "passed": self.passed,
            "score": self.score,
            "details": self.details,
        }


@dataclass(frozen=True)
class GradeResult:
    score: float
    status: str
    checks: List[CheckResult]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": self.score,
            "status": self.status,
            "checks": [check.to_dict() for check in self.checks],
        }


def _as_strings(value: Any) -> List[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return list(value)
    raise ValueError("expected a string or list of strings")


def _normalized(text: str) -> str:
    return text.casefold()


def _check_contains_all(output: str, check: Mapping[str, Any]) -> CheckResult:
    values = _as_strings(check.get("values"))
    missing = [value for value in values if _normalized(value) not in _normalized(output)]
    passed = not missing
    detail = "all required phrases found" if passed else "missing: " + ", ".join(missing)
    return CheckResult(check["id"], "contains_all", passed, 1.0 if passed else 0.0, detail)


def _check_contains_any(output: str, check: Mapping[str, Any]) -> CheckResult:
    values = _as_strings(check.get("values"))
    found = [value for value in values if _normalized(value) in _normalized(output)]
    passed = bool(found)
    detail = "found: " + ", ".join(found) if passed else "none of the allowed phrases found"
    return CheckResult(check["id"], "contains_any", passed, 1.0 if passed else 0.0, detail)


def _check_not_contains(output: str, check: Mapping[str, Any]) -> CheckResult:
    values = _as_strings(check.get("values"))
    found = [value for value in values if _normalized(value) in _normalized(output)]
    passed = not found
    detail = "forbidden phrases absent" if passed else "found: " + ", ".join(found)
    return CheckResult(check["id"], "not_contains", passed, 1.0 if passed else 0.0, detail)


def _check_exact(output: str, check: Mapping[str, Any]) -> CheckResult:
    expected = check.get("value")
    if not isinstance(expected, str):
        raise ValueError("exact check requires a string value")
    passed = output.strip() == expected.strip()
    detail = "exact match" if passed else "output differs from expected value"
    return CheckResult(check["id"], "exact", passed, 1.0 if passed else 0.0, detail)


def _check_regex(output: str, check: Mapping[str, Any]) -> CheckResult:
    pattern = check.get("pattern")
    if not isinstance(pattern, str):
        raise ValueError("regex check requires a string pattern")
    flags = re.IGNORECASE if check.get("case_insensitive", True) else 0
    passed = re.search(pattern, output, flags) is not None
    detail = "pattern matched" if passed else "pattern did not match"
    return CheckResult(check["id"], "regex", passed, 1.0 if passed else 0.0, detail)


def _check_json_object(output: str, check: Mapping[str, Any]) -> CheckResult:
    try:
        parsed = json.loads(output)
    except json.JSONDecodeError as exc:
        return CheckResult(check["id"], "json_object", False, 0.0, f"invalid JSON: {exc.msg}")
    if not isinstance(parsed, dict):
        return CheckResult(check["id"], "json_object", False, 0.0, "JSON value is not an object")
    required_keys = _as_strings(check.get("required_keys", []))
    missing = [key for key in required_keys if key not in parsed]
    passed = not missing
    detail = "valid object with required keys" if passed else "missing keys: " + ", ".join(missing)
    return CheckResult(check["id"], "json_object", passed, 1.0 if passed else 0.0, detail)


def _check_json_array(output: str, check: Mapping[str, Any]) -> CheckResult:
    try:
        parsed = json.loads(output)
    except json.JSONDecodeError as exc:
        return CheckResult(check["id"], "json_array", False, 0.0, f"invalid JSON: {exc.msg}")
    passed = isinstance(parsed, list) and len(parsed) >= int(check.get("min_items", 1))
    detail = "valid JSON array" if passed else "JSON value is not a long enough array"
    return CheckResult(check["id"], "json_array", passed, 1.0 if passed else 0.0, detail)


def _check_min_length(output: str, check: Mapping[str, Any]) -> CheckResult:
    minimum = int(check.get("characters", 1))
    passed = len(output.strip()) >= minimum
    detail = f"length {len(output.strip())} >= {minimum}" if passed else f"length {len(output.strip())} < {minimum}"
    return CheckResult(check["id"], "min_length", passed, 1.0 if passed else 0.0, detail)


def grade_output(output: str, checks: Sequence[Mapping[str, Any]]) -> GradeResult:
    """Run all deterministic checks and return a transparent aggregate."""

    if not isinstance(output, str):
        raise TypeError("model output must be a string")
    if not checks:
        raise ValueError("at least one deterministic check is required")

    checkers = {
        "contains_all": _check_contains_all,
        "contains_any": _check_contains_any,
        "not_contains": _check_not_contains,
        "exact": _check_exact,
        "regex": _check_regex,
        "json_object": _check_json_object,
        "json_array": _check_json_array,
        "min_length": _check_min_length,
    }
    results: List[CheckResult] = []
    for check in checks:
        check_type = check.get("type")
        if check_type not in checkers:
            raise ValueError(f"unsupported check type: {check_type}")
        results.append(checkers[check_type](output, check))
    score = round(sum(result.score for result in results) / len(results), 4)
    if score == 1.0:
        status = "pass"
    elif score > 0:
        status = "partial"
    else:
        status = "fail"
    return GradeResult(score=score, status=status, checks=results)

