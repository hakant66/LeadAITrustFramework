"""
Multi-Entity Dependencies Tests

Tests for entity_id extraction from path, query, and header.
"""

import pytest
from unittest.mock import MagicMock
from uuid import uuid4
from fastapi import HTTPException

from app.dependencies import (
    get_entity_id_from_path,
    get_entity_id_optional,
    get_entity_id,
)


# --- FIXTURES ---

@pytest.fixture
def sample_entity_id():
    """Sample valid entity UUID"""
    return uuid4()


# --- GET ENTITY ID FROM PATH TESTS ---

@pytest.mark.asyncio
async def test_get_entity_id_from_path_valid_uuid(sample_entity_id):
    """Test extracting entity_id from valid UUID path parameter"""
    result = await get_entity_id_from_path(str(sample_entity_id))
    assert result == sample_entity_id


@pytest.mark.asyncio
async def test_get_entity_id_from_path_invalid_uuid():
    """Test extracting entity_id from invalid UUID raises HTTPException"""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id_from_path("invalid-uuid")
    
    assert exc_info.value.status_code == 400
    assert "Invalid entity ID format" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_entity_id_from_path_empty_string():
    """Test extracting entity_id from empty string raises HTTPException"""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id_from_path("")
    
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_get_entity_id_from_path_malformed():
    """Test extracting entity_id from malformed UUID"""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id_from_path("12345")
    
    assert exc_info.value.status_code == 400


# --- GET ENTITY ID OPTIONAL TESTS ---

@pytest.mark.asyncio
async def test_get_entity_id_optional_from_query(sample_entity_id):
    """Test extracting entity_id from query parameter"""
    result = await get_entity_id_optional(
        entity_id_query=str(sample_entity_id),
        entity_id_header=None,
    )
    assert result == sample_entity_id


@pytest.mark.asyncio
async def test_get_entity_id_optional_from_header(sample_entity_id):
    """Test extracting entity_id from header"""
    result = await get_entity_id_optional(
        entity_id_query=None,
        entity_id_header=str(sample_entity_id),
    )
    assert result == sample_entity_id


@pytest.mark.asyncio
async def test_get_entity_id_optional_query_precedence(sample_entity_id):
    """Test query parameter takes precedence over header"""
    different_id = uuid4()
    result = await get_entity_id_optional(
        entity_id_query=str(sample_entity_id),
        entity_id_header=str(different_id),
    )
    assert result == sample_entity_id  # Query takes precedence


@pytest.mark.asyncio
async def test_get_entity_id_optional_none():
    """Test returning None when no entity_id provided"""
    result = await get_entity_id_optional(
        entity_id_query=None,
        entity_id_header=None,
    )
    assert result is None


@pytest.mark.asyncio
async def test_get_entity_id_optional_invalid_query():
    """Test invalid UUID in query parameter raises HTTPException"""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id_optional(
            entity_id_query="invalid",
            entity_id_header=None,
        )
    
    assert exc_info.value.status_code == 400
    assert "Invalid entity ID format" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_entity_id_optional_invalid_header():
    """Test invalid UUID in header raises HTTPException"""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id_optional(
            entity_id_query=None,
            entity_id_header="invalid",
        )
    
    assert exc_info.value.status_code == 400


# --- GET ENTITY ID REQUIRED TESTS ---

@pytest.mark.asyncio
async def test_get_entity_id_from_query(sample_entity_id):
    """Test extracting required entity_id from query parameter"""
    result = await get_entity_id(
        entity_id_query=str(sample_entity_id),
        entity_id_header=None,
    )
    assert result == sample_entity_id


@pytest.mark.asyncio
async def test_get_entity_id_from_header(sample_entity_id):
    """Test extracting required entity_id from header"""
    result = await get_entity_id(
        entity_id_query=None,
        entity_id_header=str(sample_entity_id),
    )
    assert result == sample_entity_id


@pytest.mark.asyncio
async def test_get_entity_id_missing():
    """Test missing entity_id raises HTTPException"""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id(
            entity_id_query=None,
            entity_id_header=None,
        )
    
    assert exc_info.value.status_code == 400
    assert "Entity ID is required" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_entity_id_invalid_format():
    """Test invalid UUID format raises HTTPException"""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id(
            entity_id_query="not-a-uuid",
            entity_id_header=None,
        )
    
    assert exc_info.value.status_code == 400
    assert "Invalid entity ID format" in exc_info.value.detail
