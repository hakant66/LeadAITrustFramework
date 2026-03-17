from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import json
import os
import time
import urllib.error
import urllib.request


class LLMError(RuntimeError):
    pass


@dataclass
class LLMResponse:
    text: str
    model: str
    provider: str
    latency_ms: int
    raw: dict[str, Any] | None = None


def _get_env(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value is not None and value != "" else default


def _ollama_request(payload: dict[str, Any], timeout: int = 120) -> dict[str, Any]:
    base_url = _get_env("OLLAMA_URL", "http://host.docker.internal:11434").rstrip("/")
    req = urllib.request.Request(
        f"{base_url}/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.URLError as exc:
        raise LLMError(f"Ollama request failed: {exc}") from exc

    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise LLMError("Invalid response from Ollama") from exc


def _openai_compatible_request(
    base_url: str,
    api_key: str,
    endpoint: str,
    *,
    payload: dict[str, Any] | None = None,
    method: str = "POST",
    timeout: int = 60,
) -> dict[str, Any]:
    """Call an OpenAI-compatible API (OpenAI, Azure OpenAI, Google Gemini, etc.)."""
    if not api_key:
        raise LLMError("API key is not set for this provider")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    url = f"{base_url.rstrip('/')}{endpoint}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8") if exc.fp else str(exc)
        raise LLMError(f"Request failed: {detail}") from exc
    except urllib.error.URLError as exc:
        raise LLMError(f"Request failed: {exc}") from exc

    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise LLMError("Invalid JSON response") from exc


def _openai_request(
    endpoint: str,
    *,
    payload: dict[str, Any] | None = None,
    method: str = "POST",
    timeout: int = 60,
) -> dict[str, Any]:
    """OpenAI (or Azure/any OpenAI-compatible) via OPENAI_BASE_URL + OPENAI_API_KEY."""
    base_url = _get_env("OPENAI_BASE_URL", "https://api.openai.com/v1")
    api_key = _get_env("OPENAI_API_KEY", "")
    if not api_key:
        raise LLMError("OPENAI_API_KEY is not set")
    return _openai_compatible_request(
        base_url, api_key, endpoint, payload=payload, method=method, timeout=timeout
    )


def _anthropic_request(payload: dict[str, Any], timeout: int = 120) -> dict[str, Any]:
    """Anthropic Messages API (Claude)."""
    api_key = _get_env("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise LLMError("ANTHROPIC_API_KEY is not set")

    base_url = _get_env("ANTHROPIC_BASE_URL", "https://api.anthropic.com").rstrip("/")
    req = urllib.request.Request(
        f"{base_url}/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8") if exc.fp else str(exc)
        raise LLMError(f"Anthropic request failed: {detail}") from exc
    except urllib.error.URLError as exc:
        raise LLMError(f"Anthropic request failed: {exc}") from exc

    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise LLMError("Invalid response from Anthropic") from exc


def generate_text(
    prompt: str,
    *,
    system: str | None = None,
    model: str | None = None,
    provider: str | None = None,
    temperature: float = 0.2,
    top_p: float = 0.9,
    max_tokens: int | None = None,
    timeout: int = 120,
    trace_name: str | None = None,
    trace_metadata: dict[str, Any] | None = None,
    prompt_metadata: dict[str, Any] | None = None,
) -> LLMResponse:
    """
    Generate text using the configured LLM provider.
    Defaults to Ollama running on the host (Metal GPU on macOS).
    """
    provider = (provider or _get_env("LLM_PROVIDER", "ollama")).lower()

    if provider == "ollama":
        model = model or _get_env("OLLAMA_MODEL", "llama3.1:8b")
        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "top_p": top_p,
            },
        }

        if system:
            payload["system"] = system
        if max_tokens is not None:
            payload["options"]["num_predict"] = max_tokens

        try:
            start = time.time()
            data = _ollama_request(payload, timeout=timeout)
            latency_ms = int((time.time() - start) * 1000)

            text = (data.get("response") or "").strip()
            if not text:
                raise LLMError("Ollama returned empty response")

            usage = None
            try:
                usage = {
                    "input": data.get("prompt_eval_count"),
                    "output": data.get("eval_count"),
                    "total": data.get("total_duration"),
                }
            except Exception:
                usage = None

            try:
                from app.services.langfuse_tracing import log_llm_generation

                meta = {**(trace_metadata or {}), **(prompt_metadata or {})}
                log_llm_generation(
                    trace_name=trace_name or "llm.generate_text",
                    model=model,
                    provider=provider,
                    prompt=prompt,
                    output=text,
                    usage=usage,
                    metadata=meta or None,
                )
            except Exception:
                pass

            return LLMResponse(
                text=text,
                model=model,
                provider=provider,
                latency_ms=latency_ms,
                raw=data,
            )
        except LLMError as exc:
            fallback = _get_env("LLM_FALLBACK_PROVIDER", "").lower()
            if fallback == "openai":
                # Retry once with OpenAI if configured
                return generate_text(
                    prompt,
                    system=system,
                    model=_get_env("OPENAI_MODEL", "gpt-4o-mini"),
                    provider="openai",
                    temperature=temperature,
                    top_p=top_p,
                    max_tokens=max_tokens,
                    timeout=timeout,
                )
            raise exc

    if provider == "openai":
        model = model or _get_env("OPENAI_MODEL", "gpt-4o-mini")
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        start = time.time()
        data = _openai_request(
            "/chat/completions", payload=payload, method="POST", timeout=timeout
        )
        latency_ms = int((time.time() - start) * 1000)

        choices = data.get("choices") or []
        message = choices[0].get("message") if choices else None
        text = (message or {}).get("content", "").strip()
        if not text:
            raise LLMError("OpenAI returned empty response")

        usage = None
        if isinstance(data.get("usage"), dict):
            usage = {
                "input": data["usage"].get("prompt_tokens"),
                "output": data["usage"].get("completion_tokens"),
                "total": data["usage"].get("total_tokens"),
            }

        try:
            from app.services.langfuse_tracing import log_llm_generation

            meta = {**(trace_metadata or {}), **(prompt_metadata or {})}
            log_llm_generation(
                trace_name=trace_name or "llm.generate_text",
                model=model,
                provider=provider,
                prompt=prompt,
                output=text,
                usage=usage,
                metadata=meta or None,
            )
        except Exception:
            pass

        return LLMResponse(
            text=text,
            model=model,
            provider=provider,
            latency_ms=latency_ms,
            raw=data,
        )

    if provider == "anthropic":
        model = model or _get_env("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
        messages: list[dict[str, str]] = [{"role": "user", "content": prompt}]
        payload_anthropic: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens or 4096,
            "messages": messages,
            "temperature": temperature,
        }
        if system:
            payload_anthropic["system"] = system

        start = time.time()
        data = _anthropic_request(payload_anthropic, timeout=timeout)
        latency_ms = int((time.time() - start) * 1000)

        content_blocks = data.get("content") or []
        text = ""
        for block in content_blocks:
            if isinstance(block, dict) and block.get("type") == "text":
                text = (block.get("text") or "").strip()
                break
        if not text:
            raise LLMError("Anthropic returned empty response")

        usage = None
        if isinstance(data.get("usage"), dict):
            usage = {
                "input": data["usage"].get("input_tokens"),
                "output": data["usage"].get("output_tokens"),
                "total": (data["usage"].get("input_tokens") or 0)
                + (data["usage"].get("output_tokens") or 0),
            }

        try:
            from app.services.langfuse_tracing import log_llm_generation

            meta = {**(trace_metadata or {}), **(prompt_metadata or {})}
            log_llm_generation(
                trace_name=trace_name or "llm.generate_text",
                model=model,
                provider=provider,
                prompt=prompt,
                output=text,
                usage=usage,
                metadata=meta or None,
            )
        except Exception:
            pass

        return LLMResponse(
            text=text,
            model=model,
            provider=provider,
            latency_ms=latency_ms,
            raw=data,
        )

    if provider == "google":
        model = model or _get_env("GEMINI_MODEL", _get_env("GOOGLE_MODEL", "gemini-2.0-flash"))
        base_url = _get_env(
            "GOOGLE_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"
        )
        api_key = _get_env("GEMINI_API_KEY", _get_env("GOOGLE_API_KEY", ""))
        if not api_key:
            raise LLMError("GEMINI_API_KEY or GOOGLE_API_KEY is not set")

        messages_compat: list[dict[str, str]] = []
        if system:
            messages_compat.append({"role": "system", "content": system})
        messages_compat.append({"role": "user", "content": prompt})

        payload_compat: dict[str, Any] = {
            "model": model,
            "messages": messages_compat,
            "temperature": temperature,
            "top_p": top_p,
        }
        if max_tokens is not None:
            payload_compat["max_tokens"] = max_tokens

        start = time.time()
        data = _openai_compatible_request(
            base_url,
            api_key,
            "/chat/completions",
            payload=payload_compat,
            method="POST",
            timeout=timeout,
        )
        latency_ms = int((time.time() - start) * 1000)

        choices = data.get("choices") or []
        message = choices[0].get("message") if choices else None
        text = (message or {}).get("content", "").strip()
        if not text:
            raise LLMError("Google (Gemini) returned empty response")

        usage = None
        if isinstance(data.get("usage"), dict):
            usage = {
                "input": data["usage"].get("prompt_tokens"),
                "output": data["usage"].get("completion_tokens"),
                "total": data["usage"].get("total_tokens"),
            }

        try:
            from app.services.langfuse_tracing import log_llm_generation

            meta = {**(trace_metadata or {}), **(prompt_metadata or {})}
            log_llm_generation(
                trace_name=trace_name or "llm.generate_text",
                model=model,
                provider=provider,
                prompt=prompt,
                output=text,
                usage=usage,
                metadata=meta or None,
            )
        except Exception:
            pass

        return LLMResponse(
            text=text,
            model=model,
            provider=provider,
            latency_ms=latency_ms,
            raw=data,
        )

    raise LLMError(
        f"Unsupported LLM_PROVIDER='{provider}'. "
        "Supported: 'ollama', 'openai', 'anthropic', 'google'. "
        "For Azure or other OpenAI-compatible APIs use provider 'openai' with OPENAI_BASE_URL and OPENAI_API_KEY."
    )


def list_models(timeout: int = 10) -> list[dict[str, Any]]:
    """
    List available models from the configured provider. Useful for smoke tests.
    """
    provider = _get_env("LLM_PROVIDER", "ollama").lower()

    if provider == "openai":
        data = _openai_request("/models", method="GET", timeout=timeout)
        models = data.get("data")
        if isinstance(models, list):
            return models
        return []

    if provider == "google":
        base_url = _get_env(
            "GOOGLE_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"
        )
        api_key = _get_env("GEMINI_API_KEY", _get_env("GOOGLE_API_KEY", ""))
        if not api_key:
            return []
        data = _openai_compatible_request(
            base_url, api_key, "/models", method="GET", timeout=timeout
        )
        models = data.get("data")
        if isinstance(models, list):
            return models
        return []

    if provider == "anthropic":
        # Anthropic does not expose a public /models list; return empty for health.
        return []

    base_url = _get_env("OLLAMA_URL", "http://host.docker.internal:11434").rstrip("/")
    req = urllib.request.Request(
        f"{base_url}/api/tags",
        headers={"Content-Type": "application/json"},
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.URLError as exc:
        raise LLMError(f"Ollama tags request failed: {exc}") from exc

    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise LLMError("Invalid response from Ollama tags") from exc

    models = data.get("models")
    if isinstance(models, list):
        return models
    return []
