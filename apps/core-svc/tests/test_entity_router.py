"""
Entity Router Tests

Tests for the entity profile API: health, create entity, profile-from-url.
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app


# --- FIXTURES ---

@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_conn():
    """Mock asyncpg connection. Configure .fetchrow and .execute in tests."""
    return AsyncMock()


@pytest.fixture
def mock_pool(mock_conn):
    """Mock asyncpg pool for entity router. Uses mock_conn from fixture."""
    pool = AsyncMock()
    acquire_cm = AsyncMock()
    acquire_cm.__aenter__.return_value = mock_conn
    acquire_cm.__aexit__.return_value = None
    pool.acquire = Mock(return_value=acquire_cm)
    return pool


@pytest.fixture
def sample_entity_profile():
    """Minimal valid EntityProfileCreate payload."""
    return {
        "fullLegalName": "Test Corp Ltd",
        "headquartersCountry": "Germany",
        "regionsOfOperation": [],
        "sectors": [],
    }


# --- HEALTH ---

def test_entity_health(client):
    """GET /entity/health returns ok."""
    resp = client.get("/entity/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# --- CREATE ENTITY ---

@pytest.mark.asyncio
async def test_create_entity_success(client, mock_pool, mock_conn, sample_entity_profile):
    """POST /entity persists profile and returns id and full_legal_name."""
    conn = mock_conn
    country_id = uuid4()
    entity_id = uuid4()
    conn.fetchrow = AsyncMock(
        side_effect=[
            None,  # country lookup
            {"id": country_id},  # country insert
            {"id": entity_id, "full_legal_name": "Test Corp Ltd", "created_at": None},  # entity insert
        ]
    )
    conn.fetchval = AsyncMock(return_value=None)
    conn.execute = AsyncMock()

    async def fake_get_pool():
        return mock_pool

    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        resp = client.post("/entity", json=sample_entity_profile)

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(entity_id)
    assert data["full_legal_name"] == "Test Corp Ltd"


@pytest.mark.asyncio
async def test_create_entity_missing_headquarters(client):
    """POST /entity with empty headquartersCountry is rejected (422 validation or 400)."""
    # Empty string fails Pydantic min_length=1 → 422
    resp = client.post(
        "/entity",
        json={
            "fullLegalName": "Test Corp",
            "headquartersCountry": "",
            "regionsOfOperation": [],
            "sectors": [],
        },
    )
    assert resp.status_code in (400, 422)
    body = resp.json()
    detail = body.get("detail", "")
    if isinstance(detail, list):
        detail = str(detail)
    assert "headquartersCountry" in detail or "headquarters" in detail.lower()


@pytest.mark.asyncio
async def test_create_entity_with_regions_and_sectors(client, mock_pool, mock_conn):
    """POST /entity with regions and sectors creates country/sector and junction rows."""
    country_de = uuid4()
    country_fr = uuid4()
    market_id = uuid4()
    sector_id = uuid4()
    entity_id = uuid4()

    conn = mock_conn
    # Order: HQ country (select, insert), market (select, insert), region country (select, insert), sector (select, insert), entity insert
    conn.fetchrow = AsyncMock(
        side_effect=[
            None, {"id": country_de},   # HQ Germany
            None, {"id": market_id},     # market Role
            None, {"id": country_fr},   # region France
            None, {"id": sector_id},    # sector Technology
            {"id": entity_id, "full_legal_name": "Acme GmbH", "created_at": None},
        ]
    )
    conn.fetchval = AsyncMock(return_value=None)
    conn.execute = AsyncMock()

    async def fake_get_pool():
        return mock_pool

    payload = {
        "fullLegalName": "Acme GmbH",
        "headquartersCountry": "Germany",
        "regionsOfOperation": ["France"],
        "sectors": ["Technology"],
        "marketRole": "Provider",
    }

    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        resp = client.post("/entity", json=payload)

    assert resp.status_code == 200
    assert resp.json()["full_legal_name"] == "Acme GmbH"
    assert conn.execute.call_count >= 2  # entity_region and entity_sector


# --- PROFILE-FROM-URL ---

def test_profile_from_url_not_implemented_when_optional_deps_missing(client):
    """POST /entity/profile-from-url returns 501 when profile_company_from_url is None."""
    with patch("app.routers.entity.profile_company_from_url", None):
        # Re-import so the router sees None
        resp = client.post("/entity/profile-from-url", json={"url": "https://example.com"})

    assert resp.status_code == 501
    assert "not available" in resp.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_profile_from_url_returns_422_on_error_result(client):
    """POST /entity/profile-from-url returns 422 when service returns _error."""
    error_result = {"_error": "Invalid URL"}

    with patch("app.routers.entity.profile_company_from_url", return_value=error_result):
        with patch("app.routers.entity.asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock(return_value=error_result)
            resp = client.post("/entity/profile-from-url", json={"url": "https://example.com"})

    assert resp.status_code == 422
    assert resp.json().get("detail") == "Invalid URL"


@pytest.mark.asyncio
async def test_profile_from_url_success(client):
    """POST /entity/profile-from-url returns 200 and camelCase profile when service succeeds."""
    result = {
        "fullLegalName": "Example GmbH",
        "legalForm": "GmbH",
        "headquartersCountry": "Germany",
        "sectors": ["Technology"],
        "regionsOfOperation": ["EU"],
        "logoUrl": "https://example.com/logo.png",
    }

    with patch("app.routers.entity.profile_company_from_url", return_value=result):
        with patch("app.routers.entity.asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock(return_value=result)
            resp = client.post("/entity/profile-from-url", json={"url": "https://example.com"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["fullLegalName"] == "Example GmbH"
    assert data["headquartersCountry"] == "Germany"
    assert data["logoUrl"] == "https://example.com/logo.png"
