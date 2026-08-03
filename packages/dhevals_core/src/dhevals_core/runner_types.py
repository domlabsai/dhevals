"""Small protocol module to avoid a runtime import cycle between adapters and runner."""

from __future__ import annotations

from typing import Optional, Protocol


class ModelConfigLike(Protocol):
    model_id: str
    temperature: float
    max_tokens: int
    seed: Optional[int]

