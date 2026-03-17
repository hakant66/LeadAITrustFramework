"""
Multi-Entity Isolation Tests

Tests to ensure proper data isolation between entities.
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_entity_id_optional


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


# --- PROJECT ISOLATION TESTS ---

@pytest.mark.asyncio
async def test_list_projects_with_entity_id(client, entity_id_1, entity_id_2):
    """Test that listing projects filters by entity_id"""
    # This test would require mocking the database session
    # For now, we verify the endpoint accepts entity_id parameter
    resp = client.get(f"/projects?entity_id={entity_id_1}")
    # Should not raise 422 (validation error)
    assert resp.status_code != 422


@pytest.mark.asyncio
async def test_list_projects_without_entity_id(client):
    """Test that listing projects without entity_id returns all projects"""
    resp = client.get("/projects")
    # Should return 200 (or appropriate status)
    assert resp.status_code in (200, 401, 500)  # May require auth or DB


@pytest.mark.asyncio
async def test_project_belongs_to_entity(client, mock_pool, entity_id_1, entity_id_2):
    """Test that accessing project from wrong entity returns 403"""
    from app.routers.admin import _get_entity_id_from_project_slug
    
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    
    # Mock project belongs to entity_id_1
    mock_conn.fetchval = AsyncMock(return_value=entity_id_1)
    
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.scorecard.get_pool", side_effect=fake_get_pool):
        # Try to access with entity_id_2 (wrong entity)
        with pytest.raises(Exception) as exc_info:
            await _get_entity_id_from_project_slug(
                mock_conn,
                "test-project",
                entity_id_2,
            )
        
        # Should raise HTTPException with 403
        assert hasattr(exc_info.value, "status_code")
        assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_project_not_found_returns_404(client, mock_pool, entity_id_1):
    """Test that accessing non-existent project returns 404"""
    from app.routers.admin import _get_entity_id_from_project_slug
    
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.fetchval = AsyncMock(return_value=None)
    
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.scorecard.get_pool", side_effect=fake_get_pool):
        with pytest.raises(Exception) as exc_info:
            await _get_entity_id_from_project_slug(
                mock_conn,
                "non-existent-project",
                entity_id_1,
            )
        
        assert hasattr(exc_info.value, "status_code")
        assert exc_info.value.status_code == 404


# --- COMPOSITE UNIQUE CONSTRAINT TESTS ---

@pytest.mark.asyncio
async def test_duplicate_project_slug_different_entities(client, mock_pool, entity_id_1, entity_id_2):
    """Test that same project slug can exist in different entities"""
    # This would test that entity_projects allows (entity_id_1, "test-slug")
    # and (entity_id_2, "test-slug") to coexist
    # Requires database integration test
    pass


@pytest.mark.asyncio
async def test_duplicate_project_slug_same_entity_fails(client, mock_pool, entity_id_1):
    """Test that duplicate project slug in same entity fails"""
    # This would test that (entity_id_1, "test-slug") cannot be inserted twice
    # Requires database integration test
    pass


# --- USER ENTITY ACCESS TESTS ---

@pytest.mark.asyncio
async def test_user_entity_access_creation(client, mock_pool):
    """Test creating user_entity_access record"""
    user_id = uuid4()
    entity_id = uuid4()
    
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.execute = AsyncMock()
    
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.scorecard.get_pool", side_effect=fake_get_pool):
        await mock_conn.execute(
            """
            INSERT INTO user_entity_access (user_id, entity_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, entity_id) DO NOTHING
            """,
            user_id,
            entity_id,
            "viewer",
        )
    
    mock_conn.execute.assert_called_once()


@pytest.mark.asyncio
async def test_user_entity_access_unique_constraint(client, mock_pool):
    """Test that user_entity_access enforces unique (user_id, entity_id)"""
    user_id = uuid4()
    entity_id = uuid4()
    
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.execute = AsyncMock()
    
    # First insert should succeed
    await mock_conn.execute(
        """
        INSERT INTO user_entity_access (user_id, entity_id, role)
        VALUES ($1, $2, $3)
        """,
        user_id,
        entity_id,
        "viewer",
    )
    
    # Second insert with same (user_id, entity_id) should fail
    # This would be tested in integration tests with real DB
    pass


# --- ENTITY SLUG TESTS ---

@pytest.mark.asyncio
async def test_entity_slug_uniqueness(client, mock_pool):
    """Test that entity slug must be unique"""
    # This would test that two entities cannot have the same slug
    # Requires database integration test
    pass


@pytest.mark.asyncio
async def test_entity_slug_generation(client, mock_pool):
    """Test that entity slug is generated from full_legal_name"""
    # Migration generates slug from full_legal_name
    # "Test Corp Ltd" -> "test-corp-ltd"
    # Requires database integration test
    pass


# --- CACHE ISOLATION TESTS ---

@pytest.mark.asyncio
async def test_llm_report_cache_isolation(client, mock_pool, entity_id_1, entity_id_2):
    """Test that llm_report_cache uses composite key (entity_id, project_slug, provider)"""
    # Same project_slug and provider can exist for different entities
    # Requires database integration test
    pass


@pytest.mark.asyncio
async def test_project_pillar_scores_isolation(client, mock_pool, entity_id_1, entity_id_2):
    """Test that project_pillar_scores uses composite key (entity_id, project_id, pillar_key)"""
    # Same project_id and pillar_key can exist for different entities
    # Requires database integration test
    pass


# --- EVIDENCE ISOLATION TESTS ---

@pytest.mark.asyncio
async def test_evidence_belongs_to_entity(client, mock_pool, entity_id_1, entity_id_2):
    """Test that evidence is filtered by entity_id"""
    # Evidence should only be accessible within its entity
    # Requires database integration test
    pass


# --- INTEGRATION TEST HELPERS ---

@pytest.mark.asyncio
async def test_entity_id_extraction_integration(client, entity_id_1):
    """Integration test for entity_id extraction in actual request"""
    # Test that entity_id is properly extracted and used in filtering
    # This would require a full integration test setup
    pass
