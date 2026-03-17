"""
Provenance Admin Router Tests

Tests for the provenance admin endpoints including manifest building and listing.
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.services.provenance_manifest_batch import batch_build_manifests


# --- FIXTURES ---

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_pool():
    """Mock asyncpg pool"""
    pool = AsyncMock()
    conn = AsyncMock()

    acquire_cm = AsyncMock()
    acquire_cm.__aenter__.return_value = conn
    acquire_cm.__aexit__.return_value = None
    pool.acquire = Mock(return_value=acquire_cm)
    return pool


@pytest.fixture
def sample_manifest_facts():
    """Sample manifest facts"""
    return {
        "source": {"system_name": "Test System"},
        "purpose": {"intended_use": "Testing"},
        "data_categories": {
            "included": ["dataset1"],
            "excluded": [],
            "findings": {"sensitive_included": False},
        },
        "personal_data": {"present": False, "treatment": ""},
        "legal_basis": {"basis": []},
        "geography": {"regions": ["EU"]},
        "retention": {"period_months": None},
        "evidence": {
            "present": ["evidence1"],
            "status": {"DPIA": "valid"},
            "integrity": {"any_hash_mismatch": False, "all_linked_valid": True},
        },
        "versioning": {"manifest_hash": "abc123"},
        "signals": {"evidence_integrity_checks_within_days": 0, "continuous_ok": False},
    }


@pytest.fixture
def sample_project_rows():
    """Sample project rows from database"""
    return [
        {
            "project_slug": "test-project",
            "project_name": "Test Project",
            "manifest_json": '{"source": {"system_name": "Test"}}',
            "manifest_hash": "hash123",
            "updated_at": datetime.now(timezone.utc),
            "overall_score_pct": 75.5,
            "overall_level": "P2",
            "evaluated_at": datetime.now(timezone.utc),
        },
        {
            "project_slug": "another-project",
            "project_name": "Another Project",
            "manifest_json": None,
            "manifest_hash": None,
            "updated_at": None,
            "overall_score_pct": None,
            "overall_level": None,
            "evaluated_at": None,
        },
    ]


# --- BUILD MANIFEST TESTS ---

@pytest.mark.asyncio
async def test_build_provenance_manifests_all_projects(client, mock_pool):
    """Test building manifests for all projects"""
    async def fake_get_pool():
        return mock_pool
    
    mock_result = {
        "scope": "ALL",
        "total_processed": 2,
        "success_count": 2,
        "error_count": 0,
        "results": [
            {"project_slug": "test-project", "overall_score_pct": 75.5, "overall_level": "P2"},
            {"project_slug": "another-project", "overall_score_pct": 50.0, "overall_level": "P1"},
        ],
        "errors": [],
    }
    
    with patch("app.routers.provenance_admin.get_pool", side_effect=fake_get_pool):
        with patch("app.routers.provenance_admin.batch_build_manifests", return_value=mock_result):
            resp = client.post("/admin/provenance-manifests/build")
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["scope"] == "ALL"
    assert data["total_processed"] == 2
    assert data["success_count"] == 2


@pytest.mark.asyncio
async def test_build_provenance_manifests_specific_project(client, mock_pool):
    """Test building manifest for specific project"""
    async def fake_get_pool():
        return mock_pool
    
    mock_result = {
        "scope": "PARTIAL",
        "total_processed": 1,
        "success_count": 1,
        "error_count": 0,
        "results": [{"project_slug": "test-project", "overall_score_pct": 75.5, "overall_level": "P2"}],
        "errors": [],
    }
    
    with patch("app.routers.provenance_admin.get_pool", side_effect=fake_get_pool):
        with patch("app.routers.provenance_admin.batch_build_manifests", return_value=mock_result):
            resp = client.post("/admin/provenance-manifests/build?project_slug=test-project")
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["scope"] == "PARTIAL"
    assert data["total_processed"] == 1


@pytest.mark.asyncio
async def test_build_provenance_manifests_force_recompute(client, mock_pool):
    """Test building manifests with force_recompute flag"""
    async def fake_get_pool():
        return mock_pool
    
    mock_result = {
        "scope": "ALL",
        "total_processed": 1,
        "success_count": 1,
        "error_count": 0,
        "results": [{"project_slug": "test-project", "overall_score_pct": 75.5, "overall_level": "P2"}],
        "errors": [],
    }
    
    with patch("app.routers.provenance_admin.get_pool", side_effect=fake_get_pool):
        with patch("app.routers.provenance_admin.batch_build_manifests", return_value=mock_result) as mock_build:
            resp = client.post("/admin/provenance-manifests/build?force_recompute=false")
    
    assert resp.status_code == 200
    # Verify force_recompute parameter was passed
    mock_build.assert_called_once()
    call_kwargs = mock_build.call_args[1]
    assert call_kwargs["force_recompute"] is False


@pytest.mark.asyncio
async def test_build_provenance_manifests_error_handling(client, mock_pool):
    """Test error handling when build fails"""
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.routers.provenance_admin.get_pool", side_effect=fake_get_pool):
        with patch("app.routers.provenance_admin.batch_build_manifests", side_effect=Exception("Build failed")):
            resp = client.post("/admin/provenance-manifests/build")
    
    assert resp.status_code == 500
    assert "Build failed" in resp.json()["detail"]


# --- LIST MANIFESTS TESTS ---

@pytest.mark.asyncio
async def test_list_provenance_manifests_success(client, mock_pool, sample_project_rows):
    """Test listing provenance manifests"""
    async def fake_get_pool():
        return mock_pool
    
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.fetch = AsyncMock(return_value=sample_project_rows)
    
    with patch("app.routers.provenance_admin.get_pool", side_effect=fake_get_pool):
        resp = client.get("/admin/provenance-manifests")
    
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["project_slug"] == "test-project"
    assert data[0]["project_name"] == "Test Project"
    assert data[0]["manifest_hash"] == "hash123"
    assert data[0]["overall_score_pct"] == 75.5
    assert data[0]["overall_level"] == "P2"
    
    # Test second project with None values
    assert data[1]["project_slug"] == "another-project"
    assert data[1]["manifest_json"] is None
    assert data[1]["overall_score_pct"] is None


@pytest.mark.asyncio
async def test_list_provenance_manifests_json_parsing(client, mock_pool):
    """Test JSON parsing of manifest_json"""
    async def fake_get_pool():
        return mock_pool
    
    rows = [
        {
            "project_slug": "test-project",
            "project_name": "Test",
            "manifest_json": '{"key": "value"}',  # String JSON
            "manifest_hash": "hash123",
            "updated_at": datetime.now(timezone.utc),
            "overall_score_pct": 75.5,
            "overall_level": "P2",
            "evaluated_at": datetime.now(timezone.utc),
        },
    ]
    
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.fetch = AsyncMock(return_value=rows)
    
    with patch("app.routers.provenance_admin.get_pool", side_effect=fake_get_pool):
        resp = client.get("/admin/provenance-manifests")
    
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data[0]["manifest_json"], dict)
    assert data[0]["manifest_json"]["key"] == "value"


@pytest.mark.asyncio
async def test_list_provenance_manifests_invalid_json(client, mock_pool):
    """Test handling of invalid JSON in manifest_json"""
    async def fake_get_pool():
        return mock_pool
    
    rows = [
        {
            "project_slug": "test-project",
            "project_name": "Test",
            "manifest_json": "{invalid json}",  # Invalid JSON
            "manifest_hash": "hash123",
            "updated_at": datetime.now(timezone.utc),
            "overall_score_pct": 75.5,
            "overall_level": "P2",
            "evaluated_at": datetime.now(timezone.utc),
        },
    ]
    
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.fetch = AsyncMock(return_value=rows)
    
    with patch("app.routers.provenance_admin.get_pool", side_effect=fake_get_pool):
        resp = client.get("/admin/provenance-manifests")
    
    assert resp.status_code == 200
    data = resp.json()
    # Invalid JSON should result in None
    assert data[0]["manifest_json"] is None


@pytest.mark.asyncio
async def test_list_provenance_manifests_empty_result(client, mock_pool):
    """Test listing when no projects exist"""
    async def fake_get_pool():
        return mock_pool
    
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.fetch = AsyncMock(return_value=[])
    
    with patch("app.routers.provenance_admin.get_pool", side_effect=fake_get_pool):
        resp = client.get("/admin/provenance-manifests")
    
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 0


@pytest.mark.asyncio
async def test_list_provenance_manifests_datetime_formatting(client, mock_pool):
    """Test datetime ISO formatting"""
    async def fake_get_pool():
        return mock_pool
    
    test_time = datetime(2026, 2, 11, 10, 30, 0, tzinfo=timezone.utc)
    rows = [
        {
            "project_slug": "test-project",
            "project_name": "Test",
            "manifest_json": None,
            "manifest_hash": "hash123",
            "updated_at": test_time,
            "overall_score_pct": 75.5,
            "overall_level": "P2",
            "evaluated_at": test_time,
        },
    ]
    
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.fetch = AsyncMock(return_value=rows)
    
    with patch("app.routers.provenance_admin.get_pool", side_effect=fake_get_pool):
        resp = client.get("/admin/provenance-manifests")
    
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["updated_at"] == test_time.isoformat()
    assert data[0]["evaluated_at"] == test_time.isoformat()


@pytest.mark.asyncio
async def test_list_provenance_manifests_none_datetime(client, mock_pool):
    """Test handling of None datetime values"""
    async def fake_get_pool():
        return mock_pool
    
    rows = [
        {
            "project_slug": "test-project",
            "project_name": "Test",
            "manifest_json": None,
            "manifest_hash": None,
            "updated_at": None,
            "overall_score_pct": None,
            "overall_level": None,
            "evaluated_at": None,
        },
    ]
    
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.fetch = AsyncMock(return_value=rows)
    
    with patch("app.routers.provenance_admin.get_pool", side_effect=fake_get_pool):
        resp = client.get("/admin/provenance-manifests")
    
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["updated_at"] is None
    assert data[0]["evaluated_at"] is None
    assert data[0]["overall_score_pct"] is None
    assert data[0]["overall_level"] is None
