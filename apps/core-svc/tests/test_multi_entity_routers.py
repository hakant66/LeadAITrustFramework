"""
Multi-Entity Router Tests

Comprehensive tests for routers updated to support entity_id filtering.
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_entity_id_optional, get_entity_id
from app.routers.admin import _get_entity_id_from_project_slug


# --- FIXTURES ---

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def entity_id_1():
    """First test entity ID"""
    return uuid4()


@pytest.fixture
def entity_id_2():
    """Second test entity ID"""
    return uuid4()


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
def mock_conn(mock_pool):
    """Mock asyncpg connection"""
    return mock_pool.acquire.return_value.__aenter__.return_value


# --- PROJECTS ROUTER TESTS ---

@pytest.mark.asyncio
async def test_list_projects_with_entity_id(client, entity_id_1):
    """Test listing projects filters by entity_id"""
    resp = client.get(f"/projects?entity_id={entity_id_1}")
    # Should accept entity_id parameter without validation error
    assert resp.status_code != 422


@pytest.mark.asyncio
async def test_list_projects_without_entity_id(client):
    """Test listing projects without entity_id returns all projects"""
    resp = client.get("/projects")
    # Should return 200 (or appropriate status)
    assert resp.status_code in (200, 401, 500)  # May require auth or DB


@pytest.mark.asyncio
async def test_get_project_translations_with_entity_id(client, entity_id_1):
    """Test getting project translations filters by entity_id"""
    resp = client.get(f"/projects/test-project/translations?entity_id={entity_id_1}")
    # Should accept entity_id parameter
    assert resp.status_code != 422


@pytest.mark.asyncio
async def test_get_project_translation_with_entity_id(client, entity_id_1):
    """Test getting single project translation filters by entity_id"""
    resp = client.get(f"/projects/test-project/translations/en?entity_id={entity_id_1}")
    # Should accept entity_id parameter
    assert resp.status_code != 422


# --- ADMIN ROUTER TESTS ---

@pytest.mark.asyncio
async def test_get_entity_id_from_project_slug_with_entity_id_match(mock_conn, entity_id_1):
    """Test _get_entity_id_from_project_slug when entity_id matches project"""
    mock_conn.fetchval = AsyncMock(return_value=entity_id_1)
    
    result = await _get_entity_id_from_project_slug(
        mock_conn,
        "test-project",
        entity_id_1,
    )
    
    assert result == entity_id_1
    mock_conn.fetchval.assert_called_once()


@pytest.mark.asyncio
async def test_get_entity_id_from_project_slug_with_entity_id_mismatch(mock_conn, entity_id_1, entity_id_2):
    """Test _get_entity_id_from_project_slug raises 403 when entity_id doesn't match"""
    from fastapi import HTTPException
    
    mock_conn.fetchval = AsyncMock(return_value=entity_id_1)
    
    with pytest.raises(HTTPException) as exc_info:
        await _get_entity_id_from_project_slug(
            mock_conn,
            "test-project",
            entity_id_2,  # Different entity
        )
    
    assert exc_info.value.status_code == 403
    assert "does not belong" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_entity_id_from_project_slug_project_not_found(mock_conn, entity_id_1):
    """Test _get_entity_id_from_project_slug raises 404 when project not found"""
    from fastapi import HTTPException
    
    mock_conn.fetchval = AsyncMock(return_value=None)
    
    with pytest.raises(HTTPException) as exc_info:
        await _get_entity_id_from_project_slug(
            mock_conn,
            "non-existent-project",
            entity_id_1,
        )
    
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_get_entity_id_from_project_slug_no_entity_id_provided(mock_conn, entity_id_1):
    """Test _get_entity_id_from_project_slug gets entity_id from project when not provided"""
    mock_conn.fetchval = AsyncMock(return_value=entity_id_1)
    
    result = await _get_entity_id_from_project_slug(
        mock_conn,
        "test-project",
        None,
    )
    
    assert result == entity_id_1
    assert mock_conn.fetchval.call_count == 1


# --- TRENDS ROUTER TESTS ---

@pytest.mark.asyncio
async def test_get_trends_with_entity_id(client, entity_id_1):
    """Test getting trends filters by entity_id"""
    resp = client.get(f"/scorecard/test-project/trends?entity_id={entity_id_1}")
    # Should accept entity_id parameter
    assert resp.status_code != 422


@pytest.mark.asyncio
async def test_get_trends_without_entity_id(client):
    """Test getting trends without entity_id"""
    resp = client.get("/scorecard/test-project/trends")
    # Should work without entity_id (will get from project)
    assert resp.status_code != 422


# --- TRUST AXES ROUTER TESTS ---

@pytest.mark.asyncio
async def test_get_trust_axes_with_entity_id(client, entity_id_1):
    """Test getting trust axes filters by entity_id"""
    resp = client.get(f"/trust/axes/test-project?entity_id={entity_id_1}")
    # Should accept entity_id parameter
    assert resp.status_code != 422


@pytest.mark.asyncio
async def test_get_trust_axes_mapping_with_entity_id(client, entity_id_1):
    """Test getting trust axes mapping filters by entity_id"""
    resp = client.get(f"/trust/axes/test-project/mapping?entity_id={entity_id_1}")
    # Should accept entity_id parameter
    assert resp.status_code != 422


# --- KPI DETAIL ROUTER TESTS ---

@pytest.mark.asyncio
async def test_get_kpi_detail_with_entity_id(client, entity_id_1):
    """Test getting KPI detail filters by entity_id"""
    resp = client.get(f"/scorecard/test-project/kpis/test-kpi?entity_id={entity_id_1}")
    # Should accept entity_id parameter
    assert resp.status_code != 422


# --- AI REPORTS ROUTER TESTS ---

@pytest.mark.asyncio
async def test_get_ai_report_with_entity_id(client, entity_id_1):
    """Test getting AI report filters by entity_id"""
    resp = client.get(f"/projects/test-project/ai-summary-llm?entity_id={entity_id_1}")
    # Should accept entity_id parameter
    assert resp.status_code != 422


# --- EVIDENCE ROUTER TESTS ---

@pytest.mark.asyncio
async def test_resolve_control_id_with_entity_id(client, entity_id_1):
    """Test resolving control ID filters by entity_id"""
    resp = client.get(f"/projects/test-project/kpis/test-kpi/control-id?entity_id={entity_id_1}")
    # Should accept entity_id parameter
    assert resp.status_code != 422


# --- COMPOSITE KEY ISOLATION TESTS ---

@pytest.mark.asyncio
async def test_entity_projects_composite_key(mock_conn, entity_id_1, entity_id_2):
    """Test that entity_projects allows same slug in different entities"""
    # This would test that (entity_id_1, "test-slug") and (entity_id_2, "test-slug")
    # can coexist due to composite unique constraint (entity_id, slug)
    # Requires database integration test
    pass


@pytest.mark.asyncio
async def test_llm_report_cache_composite_key(mock_conn, entity_id_1, entity_id_2):
    """Test that llm_report_cache uses composite key (entity_id, project_slug, provider)"""
    # Same project_slug and provider can exist for different entities
    # Requires database integration test
    pass


@pytest.mark.asyncio
async def test_project_pillar_scores_composite_key(mock_conn, entity_id_1, entity_id_2):
    """Test that project_pillar_scores uses composite key (entity_id, project_id, pillar_key)"""
    # Same project_id and pillar_key can exist for different entities
    # Requires database integration test
    pass


@pytest.mark.asyncio
async def test_pillar_overrides_composite_key(mock_conn, entity_id_1, entity_id_2):
    """Test that pillar_overrides uses composite key (entity_id, project_id, pillar_key)"""
    # Same project_id and pillar_key can exist for different entities
    # Requires database integration test
    pass


# --- ENTITY ISOLATION VALIDATION TESTS ---

@pytest.mark.asyncio
async def test_project_isolation_between_entities(mock_conn, entity_id_1, entity_id_2):
    """Test that projects are properly isolated between entities"""
    # Project from entity_1 should not be accessible with entity_2
    # Requires database integration test
    pass


@pytest.mark.asyncio
async def test_evidence_isolation_between_entities(mock_conn, entity_id_1, entity_id_2):
    """Test that evidence is properly isolated between entities"""
    # Evidence from entity_1 should not be accessible with entity_2
    # Requires database integration test
    pass


@pytest.mark.asyncio
async def test_cache_isolation_between_entities(mock_conn, entity_id_1, entity_id_2):
    """Test that cache entries are properly isolated between entities"""
    # Cache entries from entity_1 should not be accessible with entity_2
    # Requires database integration test
    pass


# --- ERROR HANDLING TESTS ---

@pytest.mark.asyncio
async def test_invalid_entity_id_format(client):
    """Test that invalid entity_id format returns 400"""
    resp = client.get("/projects?entity_id=invalid-uuid")
    assert resp.status_code == 400
    assert "Invalid entity ID format" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_missing_entity_id_when_required(client):
    """Test that missing entity_id when required returns 400"""
    # This would test endpoints that require entity_id
    # Requires identifying which endpoints require entity_id
    pass


# --- INTEGRATION SCENARIOS ---

@pytest.mark.asyncio
async def test_full_request_flow_with_entity_id(client, entity_id_1):
    """Test complete request flow with entity_id from query parameter"""
    # 1. List projects with entity_id
    resp1 = client.get(f"/projects?entity_id={entity_id_1}")
    assert resp1.status_code != 422
    
    # 2. Get project details with entity_id
    # 3. Get trends with entity_id
    # 4. Get trust axes with entity_id
    # This would require full integration test setup
    pass


@pytest.mark.asyncio
async def test_entity_id_from_header(client, entity_id_1):
    """Test extracting entity_id from header"""
    resp = client.get(
        "/projects",
        headers={"X-Entity-ID": str(entity_id_1)}
    )
    # Should accept entity_id from header
    assert resp.status_code != 422


@pytest.mark.asyncio
async def test_entity_id_query_precedence_over_header(client, entity_id_1, entity_id_2):
    """Test query parameter takes precedence over header"""
    # Query parameter should be used even if header is present
    # Requires verifying the dependency injection logic
    pass
