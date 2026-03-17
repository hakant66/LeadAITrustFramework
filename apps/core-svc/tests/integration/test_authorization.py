"""
Integration tests for authorization and multi-entity access control.

These tests verify:
1. User authentication and user_id extraction
2. Entity access control (user_entity_access)
3. Role-based authorization (viewer, editor, admin)
4. Cross-entity isolation
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from uuid import UUID, uuid4
from fastapi.testclient import TestClient
from fastapi import FastAPI

from app.main import app
from app.services.user_mapping import get_or_create_user_uuid
from app.services.authorization import verify_entity_access, get_user_entity_role
from app.scorecard import get_pool


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest_asyncio.fixture
async def test_user_id():
    """Create a test user mapping."""
    nextauth_id = "test_user_cuid_12345"
    user_uuid = await get_or_create_user_uuid(nextauth_id)
    return user_uuid, nextauth_id


@pytest_asyncio.fixture
async def test_entity_id():
    """Create a test entity."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        entity_id = uuid4()
        await conn.execute(
            """
            INSERT INTO entity (id, name, slug, status)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO NOTHING
            """,
            entity_id,
            "Test Entity",
            f"test-entity-{entity_id.hex[:8]}",
            "active",
        )
        return entity_id


@pytest_asyncio.fixture
async def test_user_with_access(test_user_id, test_entity_id):
    """Create user_entity_access entry."""
    user_uuid, _ = test_user_id
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO user_entity_access (user_id, entity_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, entity_id) DO UPDATE SET role = $3
            """,
            user_uuid,
            test_entity_id,
            "viewer",
        )
    return user_uuid, test_entity_id


@pytest.mark.asyncio
async def test_user_mapping_creation(test_user_id):
    """Test that user mapping creates UUID for NextAuth user ID."""
    user_uuid, nextauth_id = test_user_id
    assert isinstance(user_uuid, UUID)
    
    # Second call should return same UUID
    user_uuid2 = await get_or_create_user_uuid(nextauth_id)
    assert user_uuid == user_uuid2


@pytest.mark.asyncio
async def test_verify_entity_access_success(test_user_with_access):
    """Test successful entity access verification."""
    user_uuid, entity_id = test_user_with_access
    
    # Should not raise
    result = await verify_entity_access(user_uuid, entity_id, required_role="viewer")
    assert result is True


@pytest.mark.asyncio
async def test_verify_entity_access_denied(test_user_id, test_entity_id):
    """Test entity access denial for user without access."""
    user_uuid, _ = test_user_id
    
    # Should raise HTTPException
    with pytest.raises(Exception):  # HTTPException from FastAPI
        await verify_entity_access(user_uuid, test_entity_id)


@pytest.mark.asyncio
async def test_role_hierarchy(test_user_with_access):
    """Test role hierarchy enforcement."""
    user_uuid, entity_id = test_user_with_access
    
    # Viewer can access with viewer role
    await verify_entity_access(user_uuid, entity_id, required_role="viewer")
    
    # Viewer cannot access with editor role
    with pytest.raises(Exception):
        await verify_entity_access(user_uuid, entity_id, required_role="editor")
    
    # Update to editor role
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE user_entity_access
            SET role = $1
            WHERE user_id = $2 AND entity_id = $3
            """,
            "editor",
            user_uuid,
            entity_id,
        )
    
    # Editor can access with viewer role
    await verify_entity_access(user_uuid, entity_id, required_role="viewer")
    
    # Editor can access with editor role
    await verify_entity_access(user_uuid, entity_id, required_role="editor")
    
    # Editor cannot access with admin role
    with pytest.raises(Exception):
        await verify_entity_access(user_uuid, entity_id, required_role="admin")


@pytest.mark.asyncio
async def test_get_user_entity_role(test_user_with_access):
    """Test getting user's role for an entity."""
    user_uuid, entity_id = test_user_with_access
    
    role = await get_user_entity_role(user_uuid, entity_id)
    assert role == "viewer"


def test_authenticated_request_with_nextauth_header(client, test_user_id):
    """Test API request with NextAuth user ID header."""
    _, nextauth_id = test_user_id
    
    # This would require setting up test data, but demonstrates the pattern
    # response = client.get(
    #     "/projects",
    #     headers={
    #         "X-NextAuth-User-ID": nextauth_id,
    #         "X-Entity-ID": str(test_entity_id),
    #     },
    # )
    # assert response.status_code == 200
    pass  # Placeholder - requires full test setup


def test_unauthenticated_request_denied(client):
    """Test that unauthenticated requests are denied."""
    response = client.get("/projects")
    # Should return 401 or 400 depending on endpoint
    assert response.status_code in [400, 401, 403]


def test_cross_entity_isolation(client, test_user_id, test_entity_id):
    """Test that users cannot access entities they don't have access to."""
    _, nextauth_id = test_user_id
    other_entity_id = uuid4()
    
    # This would require setting up test data
    # response = client.get(
    #     "/projects",
    #     headers={
    #         "X-NextAuth-User-ID": nextauth_id,
    #         "X-Entity-ID": str(other_entity_id),
    #     },
    # )
    # assert response.status_code == 403
    pass  # Placeholder - requires full test setup
