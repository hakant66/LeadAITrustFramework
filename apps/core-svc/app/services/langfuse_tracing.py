from __future__ import annotations

from typing import Any

from app.services.langfuse_client import get_langfuse_client


def log_llm_generation(
    *,
    trace_name: str,
    model: str,
    provider: str,
    prompt: str,
    output: str,
    usage: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Best-effort Langfuse logging for a single LLM generation."""
    client = get_langfuse_client()
    if not client:
        return

    trace_meta = metadata or {}
    try:
        trace = client.trace(name=trace_name, metadata=trace_meta)
    except Exception:
        return

    generation_meta = {
        "provider": provider,
        **(metadata or {}),
    }

    try:
        trace.generation(
            name=trace_name,
            model=model,
            input=prompt,
            output=output,
            metadata=generation_meta or None,
            usage=usage or None,
        )
    except Exception:
        # Avoid crashing app on Langfuse failures
        return
