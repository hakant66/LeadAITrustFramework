"""
Dependencies Tests

Tests for FastAPI dependencies that extract entity_id from path, query, or header.
"""

import pytest
from uuid import uuid4, UUID
from fastapi import HTTPException

from app.dependencies import (
    get_entity_id_from_path,
    get_entity_id_optional,
    get_entity_id,
)


# --- get_entity_id_from_path ---

@pytest.mark.asyncio
async def test_get_entity_id_from_path_valid_uuid():
    """get_entity_id_from_path returns UUID for valid UUID string."""
    entity_id = uuid4()
    result = await get_entity_id_from_path(str(entity_id))
    assert isinstance(result, UUID)
    assert result == entity_id


@pytest.mark.asyncio
async def test_get_entity_id_from_path_invalid_format():
    """get_entity_id_from_path raises 400 for invalid UUID format."""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id_from_path("not-a-uuid")
    
    assert exc_info.value.status_code == 400
    assert "Invalid entity ID format" in exc_info.value.detail
    assert "not-a-uuid" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_entity_id_from_path_empty_string():
    """get_entity_id_from_path raises 400 for empty string."""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id_from_path("")
    
    assert exc_info.value.status_code == 400
    assert "Invalid entity ID format" in exc_info.value.detail


# --- get_entity_id_optional ---

@pytest.mark.asyncio
async def test_get_entity_id_optional_from_query():
    """get_entity_id_optional returns UUID from query parameter."""
    entity_id = uuid4()
    result = await get_entity_id_optional(entity_id_query=str(entity_id), entity_id_header=None)
    assert isinstance(result, UUID)
    assert result == entity_id


@pytest.mark.asyncio
async def test_get_entity_id_optional_from_header():
    """get_entity_id_optional returns UUID from header."""
    entity_id = uuid4()
    result = await get_entity_id_optional(entity_id_query=None, entity_id_header=str(entity_id))
    assert isinstance(result, UUID)
    assert result == entity_id


@pytest.mark.asyncio
async def test_get_entity_id_optional_query_precedence():
    """get_entity_id_optional prefers query parameter over header."""
    query_id = uuid4()
    header_id = uuid4()
    result = await get_entity_id_optional(entity_id_query=str(query_id), entity_id_header=str(header_id))
    assert result == query_id  # Query takes precedence


@pytest.mark.asyncio
async def test_get_entity_id_optional_returns_none_when_missing():
    """get_entity_id_optional returns None when neither query nor header provided."""
    result = await get_entity_id_optional(entity_id_query=None, entity_id_header=None)
    assert result is None


@pytest.mark.asyncio
async def test_get_entity_id_optional_invalid_format():
    """get_entity_id_optional raises 400 for invalid UUID format."""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id_optional(entity_id_query="invalid", entity_id_header=None)
    
    assert exc_info.value.status_code == 400
    assert "Invalid entity ID format" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_entity_id_optional_empty_string():
    """get_entity_id_optional returns None for empty strings (treated as missing)."""
    result = await get_entity_id_optional(entity_id_query="", entity_id_header="")
    assert result is None


# --- get_entity_id (required) ---

@pytest.mark.asyncio
async def test_get_entity_id_from_query():
    """get_entity_id returns UUID from query parameter."""
    entity_id = uuid4()
    result = await get_entity_id(entity_id_query=str(entity_id), entity_id_header=None)
    assert isinstance(result, UUID)
    assert result == entity_id


@pytest.mark.asyncio
async def test_get_entity_id_from_header():
    """get_entity_id returns UUID from header."""
    entity_id = uuid4()
    result = await get_entity_id(entity_id_query=None, entity_id_header=str(entity_id))
    assert isinstance(result, UUID)
    assert result == entity_id


@pytest.mark.asyncio
async def test_get_entity_id_query_precedence():
    """get_entity_id prefers query parameter over header."""
    query_id = uuid4()
    header_id = uuid4()
    result = await get_entity_id(entity_id_query=str(query_id), entity_id_header=str(header_id))
    assert result == query_id


@pytest.mark.asyncio
async def test_get_entity_id_raises_when_missing():
    """get_entity_id raises 400 when neither query nor header provided."""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id(entity_id_query=None, entity_id_header=None)
    
    assert exc_info.value.status_code == 400
    assert "Entity ID is required" in exc_info.value.detail
    assert "query parameter" in exc_info.value.detail.lower() or "header" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_get_entity_id_raises_for_invalid_format():
    """get_entity_id raises 400 for invalid UUID format."""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id(entity_id_query="not-a-uuid", entity_id_header=None)
    
    assert exc_info.value.status_code == 400
    assert "Invalid entity ID format" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_entity_id_empty_strings_raises():
    """get_entity_id raises 400 when both query and header are empty strings."""
    with pytest.raises(HTTPException) as exc_info:
        await get_entity_id(entity_id_query="", entity_id_header="")
    
    assert exc_info.value.status_code == 400
    assert "Entity ID is required" in exc_info.value.detail
