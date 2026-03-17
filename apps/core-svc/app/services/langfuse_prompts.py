from __future__ import annotations

import os
from typing import Any

from app.services.langfuse_client import get_langfuse_client, extract_prompt_text


def _env_name_for_key(key: str, suffix: str = "") -> str:
    safe = key.upper().replace("-", "_")
    return f"LANGFUSE_PROMPT_{safe}{suffix}"


def _apply_vars(prompt_text: str, variables: dict[str, str] | None) -> str:
    if not variables:
        return prompt_text
    text = prompt_text
    for key, value in variables.items():
        if value is None:
            continue
        text = text.replace(f"${key}", value)
        text = text.replace(f"{{{{{key}}}}}", value)
        text = text.replace(f"{{{{ {key} }}}}", value)
    return text


def get_langfuse_prompt_optional(
    key: str,
    variables: dict[str, str] | None = None,
) -> dict[str, Any] | None:
    """Fetch a Langfuse prompt by name (from env) and return a prompt dict.

    Env mapping:
      LANGFUSE_PROMPT_<KEY> = prompt name
      LANGFUSE_PROMPT_<KEY>_LABEL = label (default: production)
      LANGFUSE_PROMPT_<KEY>_VERSION = explicit version (optional)
      LANGFUSE_PROMPT_CACHE_TTL = cache ttl seconds (optional)
    """
    prompt_name = os.getenv(_env_name_for_key(key))
    if not prompt_name:
        return None

    client = get_langfuse_client()
    if not client:
        return None

    label = os.getenv(_env_name_for_key(key, "_LABEL"), "production")
    version_raw = os.getenv(_env_name_for_key(key, "_VERSION"))
    cache_ttl_raw = os.getenv("LANGFUSE_PROMPT_CACHE_TTL")

    version = int(version_raw) if version_raw and version_raw.isdigit() else None
    cache_ttl = int(cache_ttl_raw) if cache_ttl_raw and cache_ttl_raw.isdigit() else None

    try:
        prompt_obj = client.get_prompt(
            prompt_name,
            label=label or None,
            version=version,
            cache_ttl_seconds=cache_ttl,
        )
    except Exception:
        return None

    prompt_text = None
    if hasattr(prompt_obj, "compile") and variables:
        try:
            compiled = prompt_obj.compile(**variables)
            prompt_text = extract_prompt_text(compiled) or extract_prompt_text(prompt_obj)
        except Exception:
            prompt_text = extract_prompt_text(prompt_obj)
    else:
        prompt_text = extract_prompt_text(prompt_obj)

    if not prompt_text:
        return None

    prompt_text = _apply_vars(prompt_text, variables)
    prompt_version = getattr(prompt_obj, "version", None)
    prompt_language = getattr(prompt_obj, "language", None)

    return {
        "key": key,
        "name": prompt_name,
        "active_version_id": None,
        "prompt_text": prompt_text,
        "version": prompt_version,
        "language": prompt_language,
        "source": "langfuse",
        "label": label or None,
    }
