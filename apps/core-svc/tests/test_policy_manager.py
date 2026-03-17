"""
Policy Manager API tests

Focused coverage for policy fields and template linkage payloads.
"""

from datetime import datetime, timezone
from uuid import uuid4
from unittest.mock import AsyncMock, Mock, patch

import pytest
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
async def test_list_policies_includes_new_fields(client, mock_pool, mock_conn):
    template_id = uuid4()
    now = datetime.now(timezone.utc)
    mock_conn.fetchval = AsyncMock(return_value=1)
    mock_conn.fetch = AsyncMock(
        return_value=[
            {
                "id": "policy-1",
                "title": "AI Governance Policy",
                "owner_role": "CAIO",
                "status": "active",
                "iso42001_requirement": "A.2.3",
                "iso42001_status": "Mandatory",
                "euaiact_requirements": "Art 9 Risk management",
                "nistairmf_requirements": "GOV 1.1",
                "comment": "Quarterly review",
                "action": "Approve rollout",
                "template": template_id,
                "created_at": now,
                "updated_at": now,
                "version_id": "ver-1",
                "version_label": "v1",
                "version_status": "draft",
                "approved_by": None,
                "approved_at": None,
                "version_created_at": now,
            }
        ]
    )

    async def fake_get_pool():
        return mock_pool

    with patch("app.routers.admin.get_pool", side_effect=fake_get_pool):
        resp = client.get("/admin/policies")

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item["iso42001_requirement"] == "A.2.3"
    assert item["iso42001_status"] == "Mandatory"
    assert item["euaiact_requirements"] == "Art 9 Risk management"
    assert item["nistairmf_requirements"] == "GOV 1.1"
    assert item["comment"] == "Quarterly review"
    assert item["action"] == "Approve rollout"
    assert item["template"] == str(template_id)


@pytest.mark.asyncio
async def test_list_policies_entity_register_path(client, mock_pool, mock_conn):
    entity_id = uuid4()
    template_id = uuid4()
    now = datetime.now(timezone.utc)
    mock_conn.fetchval = AsyncMock(return_value=1)
    mock_conn.fetch = AsyncMock(
        return_value=[
            {
                "id": "policy-entity-1",
                "title": "AI Governance Policy",
                "owner_role": "CAIO",
                "status": "active",
                "iso42001_requirement": "Clause 5.2",
                "iso42001_status": "Mandatory",
                "euaiact_requirements": "Art 11 Technical documentation",
                "nistairmf_requirements": "MAP 2.1",
                "comment": "Entity scoped",
                "action": "Publish",
                "template": template_id,
                "created_at": now,
                "updated_at": now,
                "version_id": "ver-1",
                "version_label": "v1",
                "version_status": "draft",
                "approved_by": None,
                "approved_at": None,
                "version_created_at": None,
            }
        ]
    )

    async def fake_get_pool():
        return mock_pool

    with patch("app.routers.admin.get_pool", side_effect=fake_get_pool):
        resp = client.get(f"/admin/policies?entity_id={entity_id}")

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item["id"] == "policy-entity-1"
    assert item["title"] == "AI Governance Policy"
    assert item["status"] == "active"
    assert item["iso42001_requirement"] == "Clause 5.2"
    assert item["iso42001_status"] == "Mandatory"
    assert item["euaiact_requirements"] == "Art 11 Technical documentation"
    assert item["nistairmf_requirements"] == "MAP 2.1"
    assert item["comment"] == "Entity scoped"
    assert item["action"] == "Publish"
    assert item["template"] == str(template_id)
    assert item["latest_version"]["version_label"] == "v1"
    assert item["latest_version"]["status"] == "draft"


@pytest.mark.asyncio
async def test_create_policy_accepts_new_fields(client, mock_pool, mock_conn):
    payload = {
        "title": "AI Transparency Policy",
        "owner_role": "CAIO",
        "status": "draft",
        "iso42001_requirement": "A.2.4",
        "iso42001_status": "Mandatory",
        "euaiact_requirements": "Art 13 Transparency",
        "nistairmf_requirements": "MEASURE 2.3",
        "comment": "New policy",
        "action": "Draft",
        "template": str(uuid4()),
    }
    mock_conn.execute = AsyncMock()

    async def fake_get_pool():
        return mock_pool

    with patch("app.routers.admin.get_pool", side_effect=fake_get_pool), patch(
        "app.routers.admin.append_audit_event", new_callable=AsyncMock
    ):
        resp = client.post("/admin/policies", json=payload)

    assert resp.status_code == 200
    args = mock_conn.execute.call_args.args
    assert args[2] == payload["title"]
    assert args[3] == payload["owner_role"]
    assert args[4] == payload["status"]
    assert args[5] == payload["iso42001_requirement"]
    assert args[6] == payload["iso42001_status"]
    assert args[7] == payload["euaiact_requirements"]
    assert args[8] == payload["nistairmf_requirements"]
    assert args[9] == payload["comment"]
    assert args[10] == payload["action"]
    assert args[11] == payload["template"]


@pytest.mark.asyncio
async def test_update_policy_updates_new_fields(client, mock_pool, mock_conn):
    policy_id = "policy-123"
    payload = {
        "title": "Updated Policy",
        "owner_role": "CTO",
        "status": "active",
        "iso42001_requirement": "A.3.1",
        "iso42001_status": "Expected",
        "euaiact_requirements": "Art 10 Data governance",
        "nistairmf_requirements": "GOV 2.2",
        "comment": "Reviewed",
        "action": "Activate",
        "template": str(uuid4()),
    }
    mock_conn.execute = AsyncMock(return_value="UPDATE 1")

    async def fake_get_pool():
        return mock_pool

    with patch("app.routers.admin.get_pool", side_effect=fake_get_pool), patch(
        "app.routers.admin.append_audit_event", new_callable=AsyncMock
    ):
        resp = client.put(f"/admin/policies/{policy_id}", json=payload)

    assert resp.status_code == 200
    args = mock_conn.execute.call_args.args
    assert args[1] == payload["title"]
    assert args[2] == payload["owner_role"]
    assert args[3] == payload["status"]
    assert args[4] == payload["iso42001_requirement"]
    assert args[5] == payload["iso42001_status"]
    assert args[6] == payload["euaiact_requirements"]
    assert args[7] == payload["nistairmf_requirements"]
    assert args[8] == payload["comment"]
    assert args[9] == payload["action"]
    assert args[10] == payload["template"]
    assert args[11] == policy_id
