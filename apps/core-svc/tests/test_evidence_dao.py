"""
Evidence DAO Tests

Tests for evidence database access object functions including entity_id support.
"""

import pytest
from unittest.mock import MagicMock, Mock
from uuid import uuid4, UUID
from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.db.evidence_dao import (
    insert_evidence,
    update_evidence_uploaded,
    get_evidence,
    list_evidence,
    insert_audit,
    list_audit,
)


# --- FIXTURES ---

@pytest.fixture
def mock_conn():
    """Mock SQLAlchemy Connection"""
    conn = MagicMock(spec=Connection)
    return conn


@pytest.fixture
def sample_entity_id():
    """Sample entity UUID"""
    return uuid4()


@pytest.fixture
def sample_control_id():
    """Sample control UUID"""
    return uuid4()


# --- insert_evidence ---

def test_insert_evidence_returns_id(mock_conn, sample_entity_id, sample_control_id):
    """insert_evidence executes INSERT and returns evidence id."""
    mock_row = Mock()
    mock_row.__getitem__ = Mock(return_value=42)
    mock_result = MagicMock()
    mock_result.first.return_value = mock_row
    mock_conn.execute.return_value = mock_result
    
    evidence_id = insert_evidence(
        conn=mock_conn,
        project_slug="test-project",
        control_id=sample_control_id,
        name="test.pdf",
        mime="application/pdf",
        size_bytes=1024,
        uri="s3://bucket/test.pdf",
        created_by="user@example.com",
        entity_id=sample_entity_id,
    )
    
    assert evidence_id == 42
    mock_conn.execute.assert_called_once()
    call_args = mock_conn.execute.call_args
    assert ":entity_id" in str(call_args.args[0])


def test_insert_evidence_with_none_fields(mock_conn, sample_entity_id, sample_control_id):
    """insert_evidence handles None for optional fields."""
    mock_row = Mock()
    mock_row.__getitem__ = Mock(return_value=1)
    mock_result = MagicMock()
    mock_result.first.return_value = mock_row
    mock_conn.execute.return_value = mock_result
    
    evidence_id = insert_evidence(
        conn=mock_conn,
        project_slug="test",
        control_id=sample_control_id,
        name="test.pdf",
        mime=None,
        size_bytes=None,
        uri="s3://bucket/test.pdf",
        created_by=None,
        entity_id=sample_entity_id,
    )
    
    assert evidence_id == 1
    # Verify entity_id is in params
    call_args = mock_conn.execute.call_args
    assert len(call_args[0]) >= 2
    params = call_args[0][1]
    assert params["entity_id"] == str(sample_entity_id)


# --- update_evidence_uploaded ---

def test_update_evidence_uploaded_sets_fields(mock_conn):
    """update_evidence_uploaded updates sha256, size_bytes, mime, status."""
    update_evidence_uploaded(
        conn=mock_conn,
        evidence_id=123,
        sha256="abc123",
        size_bytes=2048,
        mime="application/pdf",
    )
    
    mock_conn.execute.assert_called_once()
    call_args = mock_conn.execute.call_args
    assert "UPDATE evidence" in str(call_args.args[0]).upper()
    assert len(call_args.args) >= 2
    params = call_args.args[1]
    assert params["sha256"] == "abc123"
    assert params["size_bytes"] == 2048
    assert params["mime"] == "application/pdf"
    assert params["id"] == 123


def test_update_evidence_uploaded_with_none_mime(mock_conn):
    """update_evidence_uploaded handles None mime (uses COALESCE)."""
    update_evidence_uploaded(
        conn=mock_conn,
        evidence_id=123,
        sha256="abc123",
        size_bytes=2048,
        mime=None,
    )
    
    call_args = mock_conn.execute.call_args
    assert len(call_args.args) >= 2
    params = call_args.args[1]
    assert params["mime"] is None


# --- get_evidence ---

def test_get_evidence_with_entity_id(mock_conn, sample_entity_id):
    """get_evidence filters by entity_id when provided."""
    mock_row = MagicMock()
    mock_row.__dict__ = {"id": 1, "name": "test.pdf", "entity_id": str(sample_entity_id)}
    # Properly mock the mappings() chain
    mock_mappings = MagicMock()
    mock_mappings.first.return_value = mock_row
    mock_result = MagicMock()
    mock_result.mappings.return_value = mock_mappings
    mock_conn.execute.return_value = mock_result
    
    result = get_evidence(mock_conn, evidence_id=1, entity_id=sample_entity_id)
    
    assert result is not None
    assert result["id"] == 1
    mock_conn.execute.assert_called_once()
    call_args = mock_conn.execute.call_args
    assert "entity_id" in str(call_args.args[0]).lower()
    assert len(call_args.args) >= 2
    params = call_args.args[1]
    assert params["entity_id"] == str(sample_entity_id)


def test_get_evidence_without_entity_id(mock_conn):
    """get_evidence doesn't filter by entity_id when None."""
    mock_row = MagicMock()
    mock_row.__dict__ = {"id": 1, "name": "test.pdf"}
    # Properly mock the mappings() chain
    mock_mappings = MagicMock()
    mock_mappings.first.return_value = mock_row
    mock_result = MagicMock()
    mock_result.mappings.return_value = mock_mappings
    mock_conn.execute.return_value = mock_result
    
    result = get_evidence(mock_conn, evidence_id=1, entity_id=None)
    
    assert result is not None
    assert result["id"] == 1
    call_args = mock_conn.execute.call_args
    sql_str = str(call_args.args[0]).lower()
    assert "entity_id" not in sql_str or "where id" in sql_str


def test_get_evidence_not_found(mock_conn, sample_entity_id):
    """get_evidence returns None when evidence not found."""
    mock_result = MagicMock()
    mock_result.mappings.return_value.first.return_value = None
    mock_conn.execute.return_value = mock_result
    
    result = get_evidence(mock_conn, evidence_id=999, entity_id=sample_entity_id)
    
    assert result is None


# --- list_evidence ---

def test_list_evidence_filters_by_entity_id(mock_conn, sample_entity_id, sample_control_id):
    """list_evidence filters by project_slug, control_id, and entity_id."""
    mock_row1 = MagicMock()
    mock_row1.__dict__ = {"id": 1, "name": "evidence1.pdf"}
    mock_row2 = MagicMock()
    mock_row2.__dict__ = {"id": 2, "name": "evidence2.pdf"}
    # Properly mock the mappings() chain
    mock_mappings = MagicMock()
    mock_mappings.all.return_value = [mock_row1, mock_row2]
    mock_result = MagicMock()
    mock_result.mappings.return_value = mock_mappings
    mock_conn.execute.return_value = mock_result
    
    results = list_evidence(
        conn=mock_conn,
        project_slug="test-project",
        control_id=sample_control_id,
        entity_id=sample_entity_id,
    )
    
    assert len(results) == 2
    assert results[0]["id"] == 1
    assert results[1]["id"] == 2
    call_args = mock_conn.execute.call_args
    sql_str = str(call_args.args[0]).lower()
    assert "entity_id" in sql_str
    assert len(call_args.args) >= 2
    params = call_args.args[1]
    assert params["entity_id"] == str(sample_entity_id)
    assert params["project_slug"] == "test-project"
    assert params["control_id"] == str(sample_control_id)


def test_list_evidence_empty(mock_conn, sample_entity_id, sample_control_id):
    """list_evidence returns empty list when no evidence found."""
    mock_result = MagicMock()
    mock_result.mappings.return_value.all.return_value = []
    mock_conn.execute.return_value = mock_result
    
    results = list_evidence(
        conn=mock_conn,
        project_slug="test-project",
        control_id=sample_control_id,
        entity_id=sample_entity_id,
    )
    
    assert results == []


# --- insert_audit ---

def test_insert_audit_stores_details_as_jsonb(mock_conn):
    """insert_audit stores audit entry with details as JSONB."""
    details = {"action": "upload", "file_size": 1024}
    
    insert_audit(
        conn=mock_conn,
        evidence_id=123,
        action="upload",
        actor="user@example.com",
        details=details,
    )
    
    mock_conn.execute.assert_called_once()
    call_args = mock_conn.execute.call_args
    assert len(call_args.args) >= 2
    params = call_args.args[1]
    assert params["evidence_id"] == 123
    assert params["action"] == "upload"
    assert params["actor"] == "user@example.com"
    assert params["details"] == details


def test_insert_audit_with_none_details(mock_conn):
    """insert_audit handles None details (stores empty dict)."""
    insert_audit(
        conn=mock_conn,
        evidence_id=123,
        action="view",
        actor=None,
        details=None,
    )
    
    call_args = mock_conn.execute.call_args
    assert len(call_args.args) >= 2
    params = call_args.args[1]
    assert params["details"] == {}


# --- list_audit ---

def test_list_audit_with_entity_id(mock_conn, sample_entity_id):
    """list_audit filters by entity_id when provided."""
    mock_row = MagicMock()
    mock_row.__dict__ = {"id": 1, "action": "upload", "actor": "user@example.com"}
    # Properly mock the mappings() chain
    mock_mappings = MagicMock()
    mock_mappings.all.return_value = [mock_row]
    mock_result = MagicMock()
    mock_result.mappings.return_value = mock_mappings
    mock_conn.execute.return_value = mock_result
    
    results = list_audit(mock_conn, evidence_id=123, entity_id=sample_entity_id)
    
    assert len(results) == 1
    assert results[0]["action"] == "upload"
    call_args = mock_conn.execute.call_args
    sql_str = str(call_args.args[0]).lower()
    assert "entity_id" in sql_str
    assert "join evidence" in sql_str.lower()
    assert len(call_args.args) >= 2
    params = call_args.args[1]
    assert params["entity_id"] == str(sample_entity_id)


def test_list_audit_without_entity_id(mock_conn):
    """list_audit doesn't filter by entity_id when None."""
    mock_row = MagicMock()
    mock_row.__dict__ = {"id": 1, "action": "upload"}
    # Properly mock the mappings() chain
    mock_mappings = MagicMock()
    mock_mappings.all.return_value = [mock_row]
    mock_result = MagicMock()
    mock_result.mappings.return_value = mock_mappings
    mock_conn.execute.return_value = mock_result
    
    results = list_audit(mock_conn, evidence_id=123, entity_id=None)
    
    assert len(results) == 1
    call_args = mock_conn.execute.call_args
    sql_str = str(call_args.args[0]).lower()
    # Should not have JOIN when entity_id is None
    assert "join" not in sql_str.lower() or "where evidence_id" in sql_str.lower()
