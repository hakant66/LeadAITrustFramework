"""
Evidence Router Tests

Tests for FastAPI evidence router endpoints including entity_id support.
"""

import pytest
from unittest.mock import MagicMock, Mock, patch, AsyncMock
from uuid import uuid4, UUID
from datetime import datetime
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.routers.evidence import (
    router,
    _normalize_path,
    _local_path_from_uri,
    _get_entity_id_from_project_slug_sync,
    EvidenceInitIn,
    EvidenceFinalizeIn,
)


# --- FIXTURES ---

@pytest.fixture
def sample_entity_id():
    """Sample entity UUID"""
    return uuid4()


@pytest.fixture
def sample_control_id():
    """Sample control UUID"""
    return uuid4()


@pytest.fixture
def sample_project_slug():
    """Sample project slug"""
    return "test-project"


@pytest.fixture
def mock_app():
    """Create FastAPI app with evidence router"""
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client(mock_app):
    """Test client"""
    return TestClient(mock_app)


# --- _normalize_path ---

def test_normalize_path_replaces_backslashes():
    """_normalize_path replaces backslashes with forward slashes."""
    assert _normalize_path("path\\to\\file") == "path/to/file"


def test_normalize_path_strips_trailing_slash():
    """_normalize_path strips trailing slashes."""
    assert _normalize_path("path/to/") == "path/to"
    assert _normalize_path("path/to//") == "path/to"


def test_normalize_path_preserves_forward_slashes():
    """_normalize_path preserves forward slashes."""
    assert _normalize_path("path/to/file") == "path/to/file"


# --- _local_path_from_uri ---

@patch("app.routers.evidence.EVIDENCE_FILE_ROOT", "/data/evidence")
@patch("app.routers.evidence.EVIDENCE_FILE_PREFIX", "")
@patch("app.routers.evidence.os.path.abspath", lambda x: x)
def test_local_path_from_uri_file_protocol():
    """_local_path_from_uri extracts local path from file:// URI."""
    uri = "file:///leadai-evidence/project/file.pdf"
    result = _local_path_from_uri(uri)
    assert result is not None
    # The function extracts path after "leadai-evidence", so result should be /data/evidence/project/file.pdf
    assert "project" in result
    assert "file.pdf" in result
    # Result should be /data/evidence/project/file.pdf (without leadai-evidence)
    assert "/data/evidence" in result


@patch("app.routers.evidence.EVIDENCE_FILE_ROOT", "")
def test_local_path_from_uri_no_root():
    """_local_path_from_uri returns None when EVIDENCE_FILE_ROOT not set."""
    uri = "file:///leadai-evidence/project/file.pdf"
    result = _local_path_from_uri(uri)
    assert result is None


def test_local_path_from_uri_not_file_protocol():
    """_local_path_from_uri returns None for non-file URIs."""
    uri = "s3://bucket/key"
    result = _local_path_from_uri(uri)
    assert result is None


@patch("app.routers.evidence.EVIDENCE_FILE_ROOT", "/data/evidence")
@patch("app.routers.evidence.EVIDENCE_FILE_PREFIX", "prefix")
def test_local_path_from_uri_with_prefix():
    """_local_path_from_uri handles EVIDENCE_FILE_PREFIX."""
    uri = "file:///prefix/project/file.pdf"
    result = _local_path_from_uri(uri)
    assert result is not None
    assert "project" in result


# --- _get_entity_id_from_project_slug_sync ---

@pytest.mark.asyncio
async def test_get_entity_id_from_project_slug_sync_with_entity_id_match(sample_entity_id):
    """_get_entity_id_from_project_slug_sync returns entity_id when it matches."""
    with patch("app.routers.evidence.asyncpg.connect") as mock_connect:
        mock_conn = AsyncMock()
        mock_conn.fetchval = AsyncMock(return_value=sample_entity_id)
        mock_conn.close = AsyncMock()
        mock_connect.return_value = mock_conn
        
        result = await _get_entity_id_from_project_slug_sync("test-project", sample_entity_id)
        
        assert result == sample_entity_id
        mock_conn.fetchval.assert_called_once()


@pytest.mark.asyncio
async def test_get_entity_id_from_project_slug_sync_with_entity_id_mismatch(sample_entity_id):
    """_get_entity_id_from_project_slug_sync raises 403 when entity_id doesn't match."""
    other_entity_id = uuid4()
    with patch("app.routers.evidence.asyncpg.connect") as mock_connect:
        mock_conn = AsyncMock()
        mock_conn.fetchval = AsyncMock(return_value=other_entity_id)
        mock_conn.close = AsyncMock()
        mock_connect.return_value = mock_conn
        
        with pytest.raises(HTTPException) as exc_info:
            await _get_entity_id_from_project_slug_sync("test-project", sample_entity_id)
        
        assert exc_info.value.status_code == 403
        assert "does not belong" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_entity_id_from_project_slug_sync_without_entity_id():
    """_get_entity_id_from_project_slug_sync returns project's entity_id when not provided."""
    entity_id = uuid4()
    with patch("app.routers.evidence.asyncpg.connect") as mock_connect:
        mock_conn = AsyncMock()
        mock_conn.fetchval = AsyncMock(return_value=entity_id)
        mock_conn.close = AsyncMock()
        mock_connect.return_value = mock_conn
        
        result = await _get_entity_id_from_project_slug_sync("test-project", None)
        
        assert result == entity_id


@pytest.mark.asyncio
async def test_get_entity_id_from_project_slug_sync_project_not_found():
    """_get_entity_id_from_project_slug_sync raises 404 when project not found."""
    with patch("app.routers.evidence.asyncpg.connect") as mock_connect:
        mock_conn = AsyncMock()
        mock_conn.fetchval = AsyncMock(return_value=None)
        mock_conn.close = AsyncMock()
        mock_connect.return_value = mock_conn
        
        with pytest.raises(HTTPException) as exc_info:
            await _get_entity_id_from_project_slug_sync("nonexistent", None)
        
        assert exc_info.value.status_code == 404
        assert "not found" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_get_entity_id_from_project_slug_sync_no_database_url():
    """_get_entity_id_from_project_slug_sync raises 500 when DATABASE_URL not configured."""
    with patch("app.routers.evidence.os.getenv", return_value=""):
        with pytest.raises(HTTPException) as exc_info:
            await _get_entity_id_from_project_slug_sync("test-project", None)
        
        assert exc_info.value.status_code == 500
        assert "DATABASE_URL" in exc_info.value.detail


# --- evidence_init endpoint ---

@pytest.mark.asyncio
@patch("app.routers.evidence._get_entity_id_from_project_slug_sync")
@patch("app.routers.evidence.insert_evidence")
@patch("app.routers.evidence.insert_audit")
@patch("app.routers.evidence.presign_put")
@patch("app.routers.evidence.object_uri")
@patch("app.routers.evidence.engine")
async def test_evidence_init_success(
    mock_engine,
    mock_object_uri,
    mock_presign_put,
    mock_insert_audit,
    mock_insert_evidence,
    mock_get_entity_id,
    sample_entity_id,
    sample_control_id,
    sample_project_slug,
    client,
):
    """evidence_init creates evidence and returns upload URL."""
    mock_get_entity_id.return_value = sample_entity_id
    mock_insert_evidence.return_value = 123
    mock_object_uri.return_value = "s3://bucket/key"
    mock_presign_put.return_value = ("https://presigned.url", {"header": "value"})
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None
    
    response = client.post(
        f"/admin/projects/{sample_project_slug}/controls/{sample_control_id}/evidence:init",
        json={
            "name": "test.pdf",
            "mime": "application/pdf",
            "size_bytes": 1024,
        },
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["evidence_id"] == 123
    assert "upload_url" in data
    assert "upload_headers" in data
    assert data["status"] == "pending"
    mock_insert_evidence.assert_called_once()
    mock_insert_audit.assert_called_once()


@pytest.mark.asyncio
@patch("app.routers.evidence._get_entity_id_from_project_slug_sync")
async def test_evidence_init_project_not_found(
    mock_get_entity_id,
    sample_control_id,
    sample_project_slug,
    client,
):
    """evidence_init returns 404 when project not found."""
    mock_get_entity_id.side_effect = HTTPException(status_code=404, detail="Project not found")
    
    response = client.post(
        f"/admin/projects/{sample_project_slug}/controls/{sample_control_id}/evidence:init",
        json={"name": "test.pdf"},
    )
    
    assert response.status_code == 404


# --- evidence_finalize endpoint ---

@patch("app.routers.evidence.get_evidence")
@patch("app.routers.evidence.update_evidence_uploaded")
@patch("app.routers.evidence.insert_audit")
@patch("app.routers.evidence.engine")
def test_evidence_finalize_success(
    mock_engine,
    mock_insert_audit,
    mock_update_evidence,
    mock_get_evidence,
    sample_entity_id,
    client,
):
    """evidence_finalize updates evidence and returns final evidence."""
    evidence_data = {
        "id": 123,
        "project_slug": "test-project",
        "control_id": str(uuid4()),
        "name": "test.pdf",
        "mime": "application/pdf",
        "size_bytes": 1024,
        "sha256": "a" * 64,
        "uri": "s3://bucket/key",
        "status": "uploaded",
        "created_by": "user@example.com",
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    }
    mock_get_evidence.side_effect = [evidence_data.copy(), evidence_data.copy()]
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None
    
    response = client.post(
        "/admin/evidence/123:finalize",
        json={
            "sha256": "a" * 64,
            "size_bytes": 1024,
            "mime": "application/pdf",
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 123
    assert data["status"] == "uploaded"
    mock_update_evidence.assert_called_once()
    mock_insert_audit.assert_called_once()


@patch("app.routers.evidence.get_evidence")
@patch("app.routers.evidence.engine")
def test_evidence_finalize_not_found(
    mock_engine,
    mock_get_evidence,
    client,
):
    """evidence_finalize returns 404 when evidence not found."""
    mock_get_evidence.return_value = None
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None
    
    response = client.post(
        "/admin/evidence/999:finalize",
        json={
            "sha256": "a" * 64,
            "size_bytes": 1024,
        },
    )
    
    assert response.status_code == 404


# --- evidence_list_route endpoint ---

@pytest.mark.asyncio
@patch("app.routers.evidence._get_entity_id_from_project_slug_sync")
@patch("app.routers.evidence.list_evidence")
@patch("app.routers.evidence.engine")
async def test_evidence_list_route_success(
    mock_engine,
    mock_list_evidence,
    mock_get_entity_id,
    sample_entity_id,
    sample_control_id,
    sample_project_slug,
    client,
):
    """evidence_list_route returns list of evidence items."""
    mock_get_entity_id.return_value = sample_entity_id
    mock_list_evidence.return_value = [
        {"id": 1, "name": "evidence1.pdf"},
        {"id": 2, "name": "evidence2.pdf"},
    ]
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None
    
    response = client.get(
        f"/admin/projects/{sample_project_slug}/controls/{sample_control_id}/evidence",
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) == 2


# --- evidence_audit_route endpoint ---

@patch("app.routers.evidence.list_audit")
@patch("app.routers.evidence.engine")
def test_evidence_audit_route_success(
    mock_engine,
    mock_list_audit,
    client,
):
    """evidence_audit_route returns audit trail."""
    mock_list_audit.return_value = [
        {"id": 1, "action": "created", "actor": "user@example.com"},
        {"id": 2, "action": "uploaded", "actor": "user@example.com"},
    ]
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None
    
    response = client.get("/admin/evidence/123/audit")
    
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) == 2


# --- evidence_download_url endpoint ---

@patch("app.routers.evidence.get_evidence")
@patch("app.routers.evidence.insert_audit")
@patch("app.routers.evidence.presign_get")
@patch("app.routers.evidence.engine")
def test_evidence_download_url_s3(
    mock_engine,
    mock_presign_get,
    mock_insert_audit,
    mock_get_evidence,
    client,
):
    """evidence_download_url returns presigned S3 URL."""
    mock_get_evidence.return_value = {
        "id": 123,
        "uri": "s3://bucket/evidence/key",
    }
    mock_presign_get.return_value = "https://presigned.s3.url"
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None
    
    response = client.post("/admin/evidence/123:download-url")
    
    assert response.status_code == 200
    data = response.json()
    assert "url" in data
    assert data["expires_in"] == 300
    mock_presign_get.assert_called_once()


@patch("app.routers.evidence.get_evidence")
@patch("app.routers.evidence._local_path_from_uri")
@patch("app.routers.evidence.os.path.exists")
@patch("app.routers.evidence.insert_audit")
@patch("app.routers.evidence.engine")
def test_evidence_download_url_file(
    mock_engine,
    mock_insert_audit,
    mock_exists,
    mock_local_path,
    mock_get_evidence,
    client,
):
    """evidence_download_url returns file URL for file:// URIs."""
    mock_get_evidence.return_value = {
        "id": 123,
        "uri": "file:///path/to/file.pdf",
    }
    mock_local_path.return_value = "/local/path/to/file.pdf"
    mock_exists.return_value = True
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None
    
    response = client.post("/admin/evidence/123:download-url")
    
    assert response.status_code == 200
    data = response.json()
    assert "/admin/evidence/123:download" in data["url"]


@patch("app.routers.evidence.get_evidence")
@patch("app.routers.evidence.engine")
def test_evidence_download_url_not_found(
    mock_engine,
    mock_get_evidence,
    client,
):
    """evidence_download_url returns 404 when evidence not found."""
    mock_get_evidence.return_value = None
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None
    
    response = client.post("/admin/evidence/999:download-url")
    
    assert response.status_code == 404


# --- resolve_control_id endpoint ---

@pytest.mark.asyncio
@patch("app.routers.evidence._get_entity_id_from_project_slug_sync")
@patch("app.routers.evidence.engine")
async def test_resolve_control_id_modern_schema(
    mock_engine,
    mock_get_entity_id,
    sample_project_slug,
    client,
):
    """resolve_control_id returns control_id from modern schema."""
    control_id = uuid4()
    mock_conn = MagicMock()
    mock_row = Mock()
    mock_row.__getitem__ = Mock(return_value=control_id)
    mock_result = MagicMock()
    mock_result.first.return_value = mock_row
    mock_conn.execute.return_value = mock_result
    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None
    
    response = client.get(f"/admin/projects/{sample_project_slug}/kpis/test_kpi/control-id")
    
    assert response.status_code == 200
    data = response.json()
    assert "control_id" in data
    assert str(control_id) == data["control_id"]


@pytest.mark.asyncio
@patch("app.routers.evidence._get_entity_id_from_project_slug_sync")
@patch("app.routers.evidence.engine")
async def test_resolve_control_id_not_found(
    mock_engine,
    mock_get_entity_id,
    sample_project_slug,
    client,
):
    """resolve_control_id returns 404 when control_id not found."""
    mock_conn = MagicMock()
    # First two queries fail (no modern/legacy schema)
    mock_result = MagicMock()
    mock_result.first.side_effect = [None, None, None]  # All queries return None
    mock_conn.execute.return_value = mock_result
    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None
    
    response = client.get(f"/admin/projects/{sample_project_slug}/kpis/nonexistent/control-id")
    
    assert response.status_code == 404
