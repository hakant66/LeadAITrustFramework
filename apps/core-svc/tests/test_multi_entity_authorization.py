"""
Multi-Entity Authorization Tests

Comprehensive tests for authorization service and entity access control.
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4
from fastapi import HTTPException

from app.services.authorization import (
    verify_entity_access,
    get_user_entity_role,
    get_user_entities,
    can_user_access_entity,
)
from app.dependencies import (
    get_entity_id_with_auth,
    get_entity_id_from_path_with_auth,
    get_current_user_id,
)


# --- FIXTURES ---

@pytest.fixture
def user_id_1():
    """First test user ID"""
    return uuid4()


@pytest.fixture
def user_id_2():
    """Second test user ID"""
    return uuid4()


@pytest.fixture
def entity_id_1():
    """First test entity ID"""
    return uuid4()


@pytest.fixture
def entity_id_2():
    """Second test entity ID"""
    return uuid4()


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


# --- VERIFY ENTITY ACCESS TESTS ---

@pytest.mark.asyncio
async def test_verify_entity_access_success(mock_conn, user_id_1, entity_id_1):
    """Test verify_entity_access succeeds when user has access"""
    mock_conn.fetchrow = AsyncMock(return_value={"role": "viewer"})
    
    result = await verify_entity_access(user_id_1, entity_id_1, conn=mock_conn)
    
    assert result is True
    mock_conn.fetchrow.assert_called_once()


@pytest.mark.asyncio
async def test_verify_entity_access_no_access(mock_conn, user_id_1, entity_id_1):
    """Test verify_entity_access raises 403 when user has no access"""
    mock_conn.fetchrow = AsyncMock(return_value=None)
    
    with pytest.raises(HTTPException) as exc_info:
        await verify_entity_access(user_id_1, entity_id_1, conn=mock_conn)
    
    assert exc_info.value.status_code == 403
    assert "does not have access" in exc_info.value.detail


@pytest.mark.asyncio
async def test_verify_entity_access_role_sufficient(mock_conn, user_id_1, entity_id_1):
    """Test verify_entity_access succeeds when user role meets requirement"""
    mock_conn.fetchrow = AsyncMock(return_value={"role": "admin"})
    
    result = await verify_entity_access(
        user_id_1, entity_id_1, required_role="viewer", conn=mock_conn
    )
    
    assert result is True


@pytest.mark.asyncio
async def test_verify_entity_access_role_insufficient(mock_conn, user_id_1, entity_id_1):
    """Test verify_entity_access raises 403 when user role insufficient"""
    mock_conn.fetchrow = AsyncMock(return_value={"role": "viewer"})
    
    with pytest.raises(HTTPException) as exc_info:
        await verify_entity_access(
            user_id_1, entity_id_1, required_role="admin", conn=mock_conn
        )
    
    assert exc_info.value.status_code == 403
    assert "does not meet required role" in exc_info.value.detail


@pytest.mark.asyncio
async def test_verify_entity_access_role_hierarchy(mock_conn, user_id_1, entity_id_1):
    """Test role hierarchy: admin > editor > viewer"""
    # Admin can access with editor requirement
    mock_conn.fetchrow = AsyncMock(return_value={"role": "admin"})
    result = await verify_entity_access(
        user_id_1, entity_id_1, required_role="editor", conn=mock_conn
    )
    assert result is True
    
    # Editor can access with viewer requirement
    mock_conn.fetchrow = AsyncMock(return_value={"role": "editor"})
    result = await verify_entity_access(
        user_id_1, entity_id_1, required_role="viewer", conn=mock_conn
    )
    assert result is True
    
    # Viewer cannot access with editor requirement
    mock_conn.fetchrow = AsyncMock(return_value={"role": "viewer"})
    with pytest.raises(HTTPException) as exc_info:
        await verify_entity_access(
            user_id_1, entity_id_1, required_role="editor", conn=mock_conn
        )
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_verify_entity_access_no_role_required(mock_conn, user_id_1, entity_id_1):
    """Test verify_entity_access succeeds with any role when no role required"""
    mock_conn.fetchrow = AsyncMock(return_value={"role": "viewer"})
    
    result = await verify_entity_access(
        user_id_1, entity_id_1, required_role=None, conn=mock_conn
    )
    
    assert result is True


@pytest.mark.asyncio
async def test_verify_entity_access_creates_connection(mock_pool, user_id_1, entity_id_1):
    """Test verify_entity_access creates connection if not provided"""
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.fetchrow = AsyncMock(return_value={"role": "viewer"})
    
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.services.authorization.get_pool", side_effect=fake_get_pool):
        result = await verify_entity_access(user_id_1, entity_id_1)
    
    assert result is True
    mock_conn.fetchrow.assert_called_once()


# --- GET USER ENTITY ROLE TESTS ---

@pytest.mark.asyncio
async def test_get_user_entity_role_exists(mock_conn, user_id_1, entity_id_1):
    """Test get_user_entity_role returns role when user has access"""
    mock_conn.fetchrow = AsyncMock(return_value={"role": "admin"})
    
    role = await get_user_entity_role(user_id_1, entity_id_1, conn=mock_conn)
    
    assert role == "admin"


@pytest.mark.asyncio
async def test_get_user_entity_role_not_exists(mock_conn, user_id_1, entity_id_1):
    """Test get_user_entity_role returns None when user has no access"""
    mock_conn.fetchrow = AsyncMock(return_value=None)
    
    role = await get_user_entity_role(user_id_1, entity_id_1, conn=mock_conn)
    
    assert role is None


# --- GET USER ENTITIES TESTS ---

@pytest.mark.asyncio
async def test_get_user_entities_multiple(mock_conn, user_id_1, entity_id_1, entity_id_2):
    """Test get_user_entities returns all entities user has access to"""
    mock_conn.fetch = AsyncMock(return_value=[
        {
            "entity_id": entity_id_1,
            "role": "admin",
            "name": "Entity 1",
            "slug": "entity-1",
            "status": "active",
        },
        {
            "entity_id": entity_id_2,
            "role": "viewer",
            "name": "Entity 2",
            "slug": "entity-2",
            "status": "active",
        },
    ])
    
    entities = await get_user_entities(user_id_1, conn=mock_conn)
    
    assert len(entities) == 2
    assert entities[0]["entity_id"] == str(entity_id_1)
    assert entities[0]["role"] == "admin"
    assert entities[1]["entity_id"] == str(entity_id_2)
    assert entities[1]["role"] == "viewer"


@pytest.mark.asyncio
async def test_get_user_entities_empty(mock_conn, user_id_1):
    """Test get_user_entities returns empty list when user has no access"""
    mock_conn.fetch = AsyncMock(return_value=[])
    
    entities = await get_user_entities(user_id_1, conn=mock_conn)
    
    assert len(entities) == 0


# --- CAN USER ACCESS ENTITY TESTS ---

@pytest.mark.asyncio
async def test_can_user_access_entity_true(mock_conn, user_id_1, entity_id_1):
    """Test can_user_access_entity returns True when user has access"""
    mock_conn.fetchrow = AsyncMock(return_value={"role": "viewer"})
    
    result = await can_user_access_entity(user_id_1, entity_id_1, conn=mock_conn)
    
    assert result is True


@pytest.mark.asyncio
async def test_can_user_access_entity_false(mock_conn, user_id_1, entity_id_1):
    """Test can_user_access_entity returns False when user has no access"""
    mock_conn.fetchrow = AsyncMock(return_value=None)
    
    result = await can_user_access_entity(user_id_1, entity_id_1, conn=mock_conn)
    
    assert result is False


# --- DEPENDENCY INJECTION TESTS ---

@pytest.mark.asyncio
async def test_get_entity_id_with_auth_success(mock_pool, user_id_1, entity_id_1):
    """Test get_entity_id_with_auth succeeds when user has access"""
    from fastapi import Request
    from unittest.mock import MagicMock
    
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"X-User-ID": str(user_id_1)}
    mock_request.query_params = {}
    
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.fetchrow = AsyncMock(return_value={"role": "viewer"})
    
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.services.authorization.get_pool", side_effect=fake_get_pool):
        result = await get_entity_id_with_auth(
            entity_id=entity_id_1,
            user_id=user_id_1,
            required_role=None,
        )
    
    assert result == entity_id_1


@pytest.mark.asyncio
async def test_get_entity_id_with_auth_no_access(mock_pool, user_id_1, entity_id_1):
    """Test get_entity_id_with_auth raises 403 when user has no access"""
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.fetchrow = AsyncMock(return_value=None)
    
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.services.authorization.get_pool", side_effect=fake_get_pool):
        with pytest.raises(HTTPException) as exc_info:
            await get_entity_id_with_auth(
                entity_id=entity_id_1,
                user_id=user_id_1,
                required_role=None,
            )
    
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_get_entity_id_with_auth_missing_entity_id(mock_pool, user_id_1):
    """Test get_entity_id_with_auth raises 400 when entity_id not provided"""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id_with_auth(
            entity_id=None,
            user_id=user_id_1,
            required_role=None,
        )
    
    assert exc_info.value.status_code == 400
    assert "Entity ID is required" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_entity_id_from_path_with_auth_success(mock_pool, user_id_1, entity_id_1):
    """Test get_entity_id_from_path_with_auth succeeds when user has access"""
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.fetchrow = AsyncMock(return_value={"role": "viewer"})
    
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.services.authorization.get_pool", side_effect=fake_get_pool):
        result = await get_entity_id_from_path_with_auth(
            entityId=str(entity_id_1),
            user_id=user_id_1,
            required_role=None,
        )
    
    assert result == entity_id_1


@pytest.mark.asyncio
async def test_get_entity_id_from_path_with_auth_invalid_uuid(mock_pool, user_id_1):
    """Test get_entity_id_from_path_with_auth raises 400 for invalid UUID"""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id_from_path_with_auth(
            entityId="invalid-uuid",
            user_id=user_id_1,
            required_role=None,
        )
    
    assert exc_info.value.status_code == 400
    assert "Invalid entity ID format" in exc_info.value.detail


# --- GET CURRENT USER ID TESTS ---

@pytest.mark.asyncio
async def test_get_current_user_id_from_header():
    """Test get_current_user_id extracts from header"""
    from fastapi import Request
    from unittest.mock import MagicMock
    
    user_id = uuid4()
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"X-User-ID": str(user_id)}
    mock_request.query_params = {}
    
    result = await get_current_user_id(mock_request)
    
    assert result == user_id


@pytest.mark.asyncio
async def test_get_current_user_id_from_query():
    """Test get_current_user_id extracts from query parameter"""
    from fastapi import Request
    from unittest.mock import MagicMock
    
    user_id = uuid4()
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {}
    mock_request.query_params = {"user_id": str(user_id)}
    
    result = await get_current_user_id(mock_request)
    
    assert result == user_id


@pytest.mark.asyncio
async def test_get_current_user_id_header_precedence():
    """Test get_current_user_id prefers header over query"""
    from fastapi import Request
    from unittest.mock import MagicMock
    
    header_user_id = uuid4()
    query_user_id = uuid4()
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"X-User-ID": str(header_user_id)}
    mock_request.query_params = {"user_id": str(query_user_id)}
    
    result = await get_current_user_id(mock_request)
    
    assert result == header_user_id  # Header takes precedence


@pytest.mark.asyncio
async def test_get_current_user_id_missing():
    """Test get_current_user_id raises 401 when user_id not provided"""
    from fastapi import Request
    from unittest.mock import MagicMock
    
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {}
    mock_request.query_params = {}
    
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user_id(mock_request)
    
    assert exc_info.value.status_code == 401
    assert "User ID is required" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_id_invalid_format():
    """Test get_current_user_id raises 400 for invalid UUID"""
    from fastapi import Request
    from unittest.mock import MagicMock
    
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"X-User-ID": "invalid-uuid"}
    mock_request.query_params = {}
    
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user_id(mock_request)
    
    assert exc_info.value.status_code == 400
    assert "Invalid user ID format" in exc_info.value.detail


# --- INTEGRATION SCENARIOS ---

@pytest.mark.asyncio
async def test_authorization_prevents_cross_entity_access(mock_pool, user_id_1, entity_id_1, entity_id_2):
    """Test that authorization prevents user from accessing entity they don't have access to"""
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    
    # User has access to entity_1 but not entity_2
    def fetchrow_side_effect(*args):
        if args[1] == entity_id_1:
            return {"role": "viewer"}
        return None
    
    mock_conn.fetchrow = AsyncMock(side_effect=fetchrow_side_effect)
    
    async def fake_get_pool():
        return mock_pool
    
    with patch("app.services.authorization.get_pool", side_effect=fake_get_pool):
        # Should succeed for entity_1
        result1 = await verify_entity_access(user_id_1, entity_id_1, conn=mock_conn)
        assert result1 is True
        
        # Should fail for entity_2
        with pytest.raises(HTTPException) as exc_info:
            await verify_entity_access(user_id_1, entity_id_2, conn=mock_conn)
        assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_role_based_access_control(mock_conn, user_id_1, entity_id_1):
    """Test role-based access control works correctly"""
    # Admin can do everything
    mock_conn.fetchrow = AsyncMock(return_value={"role": "admin"})
    assert await verify_entity_access(user_id_1, entity_id_1, required_role="admin", conn=mock_conn)
    assert await verify_entity_access(user_id_1, entity_id_1, required_role="editor", conn=mock_conn)
    assert await verify_entity_access(user_id_1, entity_id_1, required_role="viewer", conn=mock_conn)
    
    # Editor can edit and view
    mock_conn.fetchrow = AsyncMock(return_value={"role": "editor"})
    assert await verify_entity_access(user_id_1, entity_id_1, required_role="editor", conn=mock_conn)
    assert await verify_entity_access(user_id_1, entity_id_1, required_role="viewer", conn=mock_conn)
    
    with pytest.raises(HTTPException):
        await verify_entity_access(user_id_1, entity_id_1, required_role="admin", conn=mock_conn)
    
    # Viewer can only view
    mock_conn.fetchrow = AsyncMock(return_value={"role": "viewer"})
    assert await verify_entity_access(user_id_1, entity_id_1, required_role="viewer", conn=mock_conn)
    
    with pytest.raises(HTTPException):
        await verify_entity_access(user_id_1, entity_id_1, required_role="editor", conn=mock_conn)
    
    with pytest.raises(HTTPException):
        await verify_entity_access(user_id_1, entity_id_1, required_role="admin", conn=mock_conn)
