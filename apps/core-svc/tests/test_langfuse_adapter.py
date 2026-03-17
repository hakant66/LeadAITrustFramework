from app.services.langfuse_adapter import LangfuseAdapter


def test_langfuse_adapter_returns_empty_without_config():
    adapter = LangfuseAdapter(base_url="", public_key="", secret_key="")
    assert adapter.is_configured() is False
    assert adapter.fetch_project_metrics("proj") == []
