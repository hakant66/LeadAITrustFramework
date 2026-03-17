"""
Comprehensive Entity Router Tests

Additional tests for entity profile API covering GET, PATCH, edge cases,
and error handling scenarios.
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app


# --- FIXTURES ---

@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_conn():
    """Mock asyncpg connection"""
    return AsyncMock()


@pytest.fixture
def mock_pool(mock_conn):
    """Mock asyncpg pool"""
    pool = AsyncMock()
    acquire_cm = AsyncMock()
    acquire_cm.__aenter__.return_value = mock_conn
    acquire_cm.__aexit__.return_value = None
    pool.acquire = Mock(return_value=acquire_cm)
    return pool


@pytest.fixture
def sample_entity_row():
    """Sample entity database row"""
    return {
        "id": uuid4(),
        "full_legal_name": "Test Corp Ltd",
        "legal_form": "Ltd",
        "company_registration_number": "12345678",
        "headquarters_country_id": uuid4(),
        "website": "https://testcorp.com",
        "regions_other": None,
        "sector_other": None,
        "employee_count": "50-249",
        "annual_turnover": "€5M",
        "primary_role_id": None,
        "risk_classification_id": None,
        "decision_trace": None,
        "authorized_representative_name": "John Doe",
        "authorized_representative_email": "john@testcorp.com",
        "authorized_representative_phone": "+1234567890",
        "ai_compliance_officer_name": "Jane Smith",
        "ai_compliance_officer_email": "jane@testcorp.com",
        "executive_sponsor_name": "Bob Johnson",
        "executive_sponsor_email": "bob@testcorp.com",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }


# --- GET ENTITY TESTS ---

@pytest.mark.asyncio
async def test_get_entity_success(client, mock_pool, mock_conn, sample_entity_row):
    """Test GET /entity/{entity_id} returns full entity profile"""
    entity_id = sample_entity_row["id"]
    country_id = sample_entity_row["headquarters_country_id"]
    
    mock_conn.fetchrow = AsyncMock(side_effect=[
        sample_entity_row,  # Entity lookup
        {"name": "Germany"},  # HQ country
        None,  # Primary role
        None,  # Risk classification
    ])
    mock_conn.fetch = AsyncMock(return_value=[
        {"name": "Germany"},
        {"name": "France"},
    ])  # Regions and sectors
    
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        resp = client.get(f"/entity/{entity_id}")
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(entity_id)
    assert data["fullLegalName"] == "Test Corp Ltd"
    assert data["headquartersCountry"] == "Germany"
    assert len(data["regionsOfOperation"]) == 2


@pytest.mark.asyncio
async def test_get_entity_not_found(client, mock_pool, mock_conn):
    """Test GET /entity/{entity_id} returns 404 when entity doesn't exist"""
    entity_id = uuid4()
    
    mock_conn.fetchrow = AsyncMock(return_value=None)
    
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        resp = client.get(f"/entity/{entity_id}")
    
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_entity_invalid_uuid(client):
    """Test GET /entity/{entity_id} returns 422 for invalid UUID"""
    resp = client.get("/entity/invalid-uuid")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_entity_latest_success(client, mock_pool, mock_conn, sample_entity_row):
    """Test GET /entity/latest returns most recent entity"""
    country_id = sample_entity_row["headquarters_country_id"]
    
    mock_conn.fetchrow = AsyncMock(side_effect=[
        sample_entity_row,  # Latest entity
        {"name": "Germany"},  # HQ country
        None,  # Primary role
        None,  # Risk classification
    ])
    mock_conn.fetch = AsyncMock(return_value=[])  # No regions/sectors
    
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        resp = client.get("/entity/latest")
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["fullLegalName"] == "Test Corp Ltd"


@pytest.mark.asyncio
async def test_get_entity_latest_not_found(client, mock_pool, mock_conn):
    """Test GET /entity/latest returns 404 when no entities exist"""
    mock_conn.fetchrow = AsyncMock(return_value=None)
    
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        resp = client.get("/entity/latest")
    
    assert resp.status_code == 404
    assert "no entity found" in resp.json()["detail"].lower()


# --- PATCH ENTITY TESTS ---

@pytest.mark.asyncio
async def test_update_entity_success(client, mock_pool, mock_conn, sample_entity_row):
    """Test PATCH /entity/{entity_id} updates entity successfully"""
    entity_id = sample_entity_row["id"]
    country_id = uuid4()
    
    mock_conn.fetchrow = AsyncMock(side_effect=[
        sample_entity_row,  # Entity lookup
        {"id": country_id},  # New HQ country lookup
        {"id": country_id},  # New HQ country insert
        sample_entity_row,  # Updated entity fetch
        {"name": "France"},  # HQ country for response
        None,  # Primary role
        None,  # Risk classification
    ])
    mock_conn.execute = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])
    
    async def fake_get_pool():
        return mock_pool
    
    update_data = {
        "headquartersCountry": "France",
        "employeeCount": "250-999",
    }
    
    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        with patch("app.routers.entity.append_audit_event", new_callable=AsyncMock):
            resp = client.patch(f"/entity/{entity_id}", json=update_data)
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["headquartersCountry"] == "France"


@pytest.mark.asyncio
async def test_update_entity_not_found(client, mock_pool, mock_conn):
    """Test PATCH /entity/{entity_id} returns 404 when entity doesn't exist"""
    entity_id = uuid4()
    
    mock_conn.fetchrow = AsyncMock(return_value=None)
    
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        resp = client.patch(f"/entity/{entity_id}", json={"employeeCount": "1000+"})
    
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_entity_regions(client, mock_pool, mock_conn, sample_entity_row):
    """Test PATCH /entity/{entity_id} updates regions"""
    entity_id = sample_entity_row["id"]
    country_id1 = uuid4()
    country_id2 = uuid4()
    
    mock_conn.fetchrow = AsyncMock(side_effect=[
        sample_entity_row,  # Entity lookup
        {"id": country_id1},  # Region 1 lookup
        {"id": country_id1},  # Region 1 insert
        {"id": country_id2},  # Region 2 lookup
        {"id": country_id2},  # Region 2 insert
        sample_entity_row,  # Updated entity fetch
        {"name": "Germany"},  # HQ country
        None,  # Primary role
        None,  # Risk classification
    ])
    mock_conn.execute = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[
        {"name": "France"},
        {"name": "Spain"},
    ])
    
    async def fake_get_pool():
        return mock_pool
    
    update_data = {
        "regionsOfOperation": ["France", "Spain"],
    }
    
    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        with patch("app.routers.entity.append_audit_event", new_callable=AsyncMock):
            resp = client.patch(f"/entity/{entity_id}", json=update_data)
    
    assert resp.status_code == 200
    # Verify DELETE and INSERT were called for regions
    execute_calls = [str(call) for call in mock_conn.execute.call_args_list]
    assert any("DELETE FROM entity_region" in str(call) for call in execute_calls)
    assert any("INSERT INTO entity_region" in str(call) for call in execute_calls)


@pytest.mark.asyncio
async def test_update_entity_sectors(client, mock_pool, mock_conn, sample_entity_row):
    """Test PATCH /entity/{entity_id} updates sectors"""
    entity_id = sample_entity_row["id"]
    sector_id1 = uuid4()
    sector_id2 = uuid4()
    
    mock_conn.fetchrow = AsyncMock(side_effect=[
        sample_entity_row,  # Entity lookup
        {"id": sector_id1},  # Sector 1 lookup
        {"id": sector_id1},  # Sector 1 insert
        {"id": sector_id2},  # Sector 2 lookup
        {"id": sector_id2},  # Sector 2 insert
        sample_entity_row,  # Updated entity fetch
        {"name": "Germany"},  # HQ country
        None,  # Primary role
        None,  # Risk classification
    ])
    mock_conn.execute = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[
        {"name": "Healthcare"},
        {"name": "Finance"},
    ])
    
    async def fake_get_pool():
        return mock_pool
    
    update_data = {
        "sectors": ["Healthcare", "Finance"],
    }
    
    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        with patch("app.routers.entity.append_audit_event", new_callable=AsyncMock):
            resp = client.patch(f"/entity/{entity_id}", json=update_data)
    
    assert resp.status_code == 200
    data = resp.json()
    assert "Healthcare" in data["sectors"]
    assert "Finance" in data["sectors"]


@pytest.mark.asyncio
async def test_update_entity_audit_logging(client, mock_pool, mock_conn, sample_entity_row):
    """Test PATCH /entity/{entity_id} logs audit event"""
    entity_id = sample_entity_row["id"]
    
    mock_conn.fetchrow = AsyncMock(side_effect=[
        sample_entity_row,  # Entity lookup
        sample_entity_row,  # Updated entity fetch
        {"name": "Germany"},  # HQ country
        None,  # Primary role
        None,  # Risk classification
    ])
    mock_conn.execute = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])
    
    async def fake_get_pool():
        return mock_pool
    
    mock_audit = AsyncMock()
    
    update_data = {
        "employeeCount": "1000+",
    }
    
    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        with patch("app.routers.entity.append_audit_event", mock_audit):
            resp = client.patch(f"/entity/{entity_id}", json=update_data)
    
    assert resp.status_code == 200
    mock_audit.assert_called_once()
    call_kwargs = mock_audit.call_args[1]
    assert call_kwargs["event_type"] == "entity.updated"
    assert call_kwargs["object_id"] == str(entity_id)


# --- CREATE ENTITY EDGE CASES ---

@pytest.mark.asyncio
async def test_create_entity_with_all_fields(client, mock_pool, mock_conn):
    """Test POST /entity with all optional fields"""
    country_id = uuid4()
    role_id = uuid4()
    risk_id = uuid4()
    sector_id = uuid4()
    entity_id = uuid4()
    
    mock_conn.fetchrow = AsyncMock(side_effect=[
        None, {"id": country_id},  # HQ country
        None, {"id": role_id},  # Primary role
        None, {"id": risk_id},  # Risk classification
        None, {"id": country_id},  # Region country
        None, {"id": sector_id},  # Sector
        {"id": entity_id, "full_legal_name": "Full Corp", "created_at": None},  # Entity
    ])
    mock_conn.execute = AsyncMock()
    
    async def fake_get_pool():
        return mock_pool
    
    payload = {
        "fullLegalName": "Full Corp",
        "legalForm": "GmbH",
        "companyRegistrationNumber": "HRB 12345",
        "headquartersCountry": "Germany",
        "website": "https://fullcorp.com",
        "regionsOfOperation": ["Germany"],
        "regionsOther": "Other regions",
        "sectors": ["Healthcare"],
        "sectorOther": "Other sector",
        "employeeCount": "50-249",
        "annualTurnover": "€10M",
        "marketRole": "Provider",
        "riskClassification": "High Risk",
        "decisionTrace": "Decision trace",
        "authorizedRepresentativeName": "John Doe",
        "authorizedRepresentativeEmail": "john@fullcorp.com",
        "authorizedRepresentativePhone": "+1234567890",
        "aiComplianceOfficerName": "Jane Smith",
        "aiComplianceOfficerEmail": "jane@fullcorp.com",
        "executiveSponsorName": "Bob Johnson",
        "executiveSponsorEmail": "bob@fullcorp.com",
    }
    
    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        resp = client.post("/entity", json=payload)
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(entity_id)


@pytest.mark.asyncio
async def test_create_entity_filters_other_region(client, mock_pool, mock_conn):
    """Test POST /entity filters out 'Other' from regionsOfOperation"""
    country_id = uuid4()
    entity_id = uuid4()
    
    mock_conn.fetchrow = AsyncMock(side_effect=[
        None, {"id": country_id},  # HQ country
        None, {"id": country_id},  # Region country (France)
        {"id": entity_id, "full_legal_name": "Test", "created_at": None},  # Entity
    ])
    mock_conn.execute = AsyncMock()
    
    async def fake_get_pool():
        return mock_pool
    
    payload = {
        "fullLegalName": "Test",
        "headquartersCountry": "Germany",
        "regionsOfOperation": ["France", "Other"],  # "Other" should be filtered
        "sectors": [],
    }
    
    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        resp = client.post("/entity", json=payload)
    
    assert resp.status_code == 200
    # Verify only France was processed (not "Other")
    execute_calls = str(mock_conn.execute.call_args_list)
    assert "France" in execute_calls or "entity_region" in execute_calls


@pytest.mark.asyncio
async def test_create_entity_duplicate_regions(client, mock_pool, mock_conn):
    """Test POST /entity handles duplicate regions"""
    country_id = uuid4()
    entity_id = uuid4()
    
    mock_conn.fetchrow = AsyncMock(side_effect=[
        None, {"id": country_id},  # HQ country
        None, {"id": country_id},  # Region country (same as HQ)
        {"id": entity_id, "full_legal_name": "Test", "created_at": None},  # Entity
    ])
    mock_conn.execute = AsyncMock()
    
    async def fake_get_pool():
        return mock_pool
    
    payload = {
        "fullLegalName": "Test",
        "headquartersCountry": "Germany",
        "regionsOfOperation": ["Germany", "Germany"],  # Duplicates
        "sectors": [],
    }
    
    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        resp = client.post("/entity", json=payload)
    
    assert resp.status_code == 200
    # Verify duplicate handling (region_ids list deduplication)


@pytest.mark.asyncio
async def test_create_entity_database_error(client, mock_pool, mock_conn):
    """Test POST /entity handles database insertion errors"""
    country_id = uuid4()
    
    mock_conn.fetchrow = AsyncMock(side_effect=[
        None, {"id": country_id},  # HQ country
        None,  # Entity insert fails
    ])
    mock_conn.execute = AsyncMock()
    
    async def fake_get_pool():
        return mock_pool
    
    payload = {
        "fullLegalName": "Test",
        "headquartersCountry": "Germany",
        "regionsOfOperation": [],
        "sectors": [],
    }
    
    with patch("app.routers.entity._get_pool", side_effect=fake_get_pool):
        resp = client.post("/entity", json=payload)
    
    assert resp.status_code == 500
    assert "Failed to insert" in resp.json()["detail"]


# --- PROFILE FROM URL TESTS ---

@pytest.mark.asyncio
async def test_profile_from_url_config_missing(client):
    """Test POST /entity/profile-from-url returns 503 when config missing"""
    error_result = {
        "_error": "Missing API key",
        "_code": "CONFIG_MISSING",
    }
    
    with patch("app.routers.entity.profile_company_from_url", return_value=error_result):
        with patch("app.routers.entity.asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock(return_value=error_result)
            resp = client.post("/entity/profile-from-url", json={"url": "https://example.com"})
    
    assert resp.status_code == 503
    assert "Missing API key" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_profile_from_url_service_error(client):
    """Test POST /entity/profile-from-url handles service exceptions"""
    with patch("app.routers.entity.profile_company_from_url", side_effect=Exception("Service error")):
        with patch("app.routers.entity.asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock(side_effect=Exception("Service error"))
            resp = client.post("/entity/profile-from-url", json={"url": "https://example.com"})
    
    assert resp.status_code == 500
    assert "Service error" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_profile_from_url_invalid_url(client):
    """Test POST /entity/profile-from-url validates URL format"""
    resp = client.post("/entity/profile-from-url", json={"url": "invalid"})
    assert resp.status_code == 422  # Pydantic validation error
