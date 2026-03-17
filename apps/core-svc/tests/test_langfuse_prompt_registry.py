import os

from app.services.langfuse_prompts import get_langfuse_prompt_optional


def test_langfuse_prompt_registry_returns_none_when_unconfigured(monkeypatch):
    monkeypatch.delenv("LANGFUSE_PROMPT_AI_SUMMARY_LLM", raising=False)
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_BASE_URL", raising=False)
    assert get_langfuse_prompt_optional("ai_summary_llm") is None
