import pytest
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_conn():
    return AsyncMock()


@pytest.fixture
def mock_pool(mock_conn):
    pool = AsyncMock()
    acquire_cm = AsyncMock()
    acquire_cm.__aenter__.return_value = mock_conn
    acquire_cm.__aexit__.return_value = None
    pool.acquire = Mock(return_value=acquire_cm)
    return pool


@pytest.mark.asyncio
async def test_list_model_cards_returns_items(client, mock_pool, mock_conn):
    entity_id = uuid4()
    card_id = uuid4()
    mock_conn.fetchval = AsyncMock(return_value=1)
    mock_conn.fetch = AsyncMock(
        side_effect=[
            [
                {
                    "system_id": "sys-1",
                    "name": "System One",
                    "project_slug": "proj-1",
                    "model_provider": "OpenAI",
                    "model_type": "LLM",
                    "model_version": "v1",
                    "owner": "Owner",
                    "system_owner_email": "owner@example.com",
                    "risk_tier": "high",
                    "status": "active",
                    "intended_use": "Assist",
                    "intended_users": "Employees",
                    "system_boundary": None,
                    "training_data_sources": None,
                    "personal_data_flag": False,
                    "sensitive_attributes_flag": False,
                    "lifecycle_stage": "production",
                    "deployment_environment": "cloud",
                    "langfuse_project_id": None,
                    "langfuse_base_url": None,
                    "entity_id": entity_id,
                    "entity_slug": "test-entity",
                    "created_at": None,
                    "updated_at": None,
                    "card_id": card_id,
                    "version": 1,
                    "card_status": "draft",
                    "summary_md": "Summary",
                    "limitations": None,
                    "out_of_scope": None,
                    "review_cadence": None,
                    "approved_by": None,
                    "approved_at": None,
                    "card_created_at": None,
                    "card_updated_at": None,
                }
            ],
            [
                {
                    "model_card_id": card_id,
                    "source": "langfuse",
                    "metric_key": "latency_p95",
                    "metric_value": {"value": 120},
                    "last_seen_at": None,
                }
            ],
        ]
    )

    async def fake_get_pool():
        return mock_pool

    with patch("app.routers.admin.get_pool", side_effect=fake_get_pool):
        resp = client.get(f"/admin/model-cards?entity_id={entity_id}")

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["total"] == 1
    assert len(payload["items"]) == 1
    item = payload["items"][0]
    assert item["system"]["id"] == "sys-1"
    assert item["model_card"]["id"] == str(card_id)
    assert item["evidence"][0]["metric_key"] == "latency_p95"


@pytest.mark.asyncio
async def test_sync_model_card_requires_project_id(client, mock_pool, mock_conn):
    mock_conn.fetchrow = AsyncMock(
        return_value={
            "id": "sys-1",
            "langfuse_project_id": None,
            "langfuse_base_url": None,
        }
    )

    async def fake_get_pool():
        return mock_pool

    with patch("app.routers.admin.get_pool", side_effect=fake_get_pool):
        resp = client.post("/admin/model-cards/sys-1/sync-langfuse")

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is False
    assert "project id" in payload["message"].lower()


@pytest.mark.asyncio
async def test_upsert_model_card_inserts_new(client, mock_pool, mock_conn):
    card_id = uuid4()
    mock_conn.fetchrow = AsyncMock(side_effect=[{"id": "sys-1"}, None])
    mock_conn.fetchval = AsyncMock(return_value=card_id)

    async def fake_get_pool():
        return mock_pool

    with patch("app.routers.admin.get_pool", side_effect=fake_get_pool):
        resp = client.post(
            "/admin/model-cards/sys-1",
            json={"status": "draft", "summary_md": "Draft summary"},
        )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert payload["id"] == str(card_id)
    assert payload["version"] == 1
