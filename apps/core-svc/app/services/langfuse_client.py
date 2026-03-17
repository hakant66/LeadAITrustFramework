from __future__ import annotations

import os
from functools import lru_cache
from typing import Any


def _get_env(name: str) -> str:
    value = os.getenv(name)
    return value.strip() if value else ""


@lru_cache(maxsize=1)
def get_langfuse_client():
    """Return Langfuse client if configured, else None.

    Reads LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_BASE_URL (or LANGFUSE_HOST).
    """
    public_key = _get_env("LANGFUSE_PUBLIC_KEY")
    secret_key = _get_env("LANGFUSE_SECRET_KEY")
    base_url = _get_env("LANGFUSE_BASE_URL") or _get_env("LANGFUSE_HOST")

    if not public_key or not secret_key or not base_url:
        return None

    try:
        from langfuse import Langfuse
    except Exception:
        return None

    try:
        return Langfuse(public_key=public_key, secret_key=secret_key, base_url=base_url)
    except TypeError:
        # Older SDKs used `host` instead of `base_url`
        try:
            return Langfuse(public_key=public_key, secret_key=secret_key, host=base_url)
        except Exception:
            return None
    except Exception:
        return None


def extract_prompt_text(prompt_obj: Any) -> str | None:
    if prompt_obj is None:
        return None
    for attr in ("prompt", "text", "content"):
        value = getattr(prompt_obj, attr, None)
        if isinstance(value, str) and value.strip():
            return value
    if isinstance(prompt_obj, str):
        return prompt_obj
    return None
