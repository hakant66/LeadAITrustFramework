"""
Jira Integration End-to-End Tests

Integration tests for the complete Jira sync workflow including
database operations, error handling, and edge cases.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from uuid import uuid4

from app.services.jira_client import JiraClient, JiraConfig, JiraAuthError, JiraAPIError
from app.services.jira_mapper import JiraMapper, JiraIssueMapping
from app.routers.jira import (
    sync_jira_issues,
    _upsert_requirement,
    _upsert_risk,
    _create_evidence,
    _store_sync_metadata,
)


# --- FIXTURES ---

@pytest.fixture
def mock_conn():
    """Mock asyncpg connection"""
    conn = AsyncMock()
    return conn


@pytest.fixture
def sample_jira_issue():
    """Sample Jira issue"""
    return {
        "key": "AI-123",
        "id": "10001",
        "fields": {
            "summary": "Test Requirement",
            "description": "Test description",
            "issuetype": {"name": "Requirement"},
            "status": {"name": "In Progress"},
            "priority": {"name": "High"},
            "assignee": {"displayName": "John Doe", "emailAddress": "john@example.com"},
            "reporter": {"displayName": "Jane Smith"},
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-15T14:30:00.000+0000",
            "labels": ["eu-ai-act"],
            "components": [{"name": "Governance"}],
            "attachment": [
                {
                    "id": "10000",
                    "filename": "evidence.pdf",
                    "size": 1024,
                    "mimeType": "application/pdf",
                    "created": "2026-01-10T10:00:00.000+0000",
                    "author": {"displayName": "John Doe"},
                    "content": "https://jira.example.com/attachment/10000",
                }
            ],
            "customfield_AI_SYSTEM_ID": "system-001",
            "customfield_AI_CONTROL_ID": ["CTRL-001"],
        },
    }


@pytest.fixture
def sample_mapping(sample_jira_issue):
    """Sample JiraIssueMapping"""
    mapper = JiraMapper()
    return mapper.map_issue(sample_jira_issue, "test-project")


# --- DATABASE OPERATION TESTS ---

@pytest.mark.asyncio
async def test_upsert_requirement_insert(mock_conn):
    """Test inserting new requirement"""
    req_data = {
        "id": str(uuid4()),
        "project_slug": "test-project",
        "uc_id": "system-001",
        "framework": "EU_AI_ACT",
        "requirement_code": "AI-123",
        "title": "Test Requirement",
        "description": "Test",
        "applicability": [],
        "owner_role": "Data Protection Officer",
        "status": "in_progress",
        "evidence_ids": [],
        "mapped_controls": [],
        "notes": "Imported from Jira",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    mock_conn.execute = AsyncMock()
    
    await _upsert_requirement(mock_conn, req_data)
    
    mock_conn.execute.assert_called_once()
    call_args = mock_conn.execute.call_args[0]
    assert "INSERT INTO ai_requirement_register" in call_args[0]
    assert call_args[1] == req_data["id"]


@pytest.mark.asyncio
async def test_upsert_requirement_update(mock_conn):
    """Test updating existing requirement"""
    req_data = {
        "id": str(uuid4()),
        "project_slug": "test-project",
        "uc_id": "system-001",
        "framework": "EU_AI_ACT",
        "requirement_code": "AI-123",
        "title": "Updated Requirement",
        "description": "Updated",
        "applicability": [],
        "owner_role": "Data Protection Officer",
        "status": "completed",
        "evidence_ids": [],
        "mapped_controls": [],
        "notes": "Updated from Jira",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    mock_conn.execute = AsyncMock()
    
    await _upsert_requirement(mock_conn, req_data)
    
    mock_conn.execute.assert_called_once()
    call_sql = mock_conn.execute.call_args[0][0]
    assert "ON CONFLICT" in call_sql
    assert "DO UPDATE SET" in call_sql


@pytest.mark.asyncio
async def test_upsert_risk_insert(mock_conn):
    """Test inserting new risk"""
    risk_data = {
        "jira_key": "RISK-456",
        "jira_id": "10002",
        "project_slug": "test-project",
        "title": "Test Risk",
        "description": "Risk description",
        "risk_level": "High",
        "severity": "High",
        "status": "Open",
        "owner": "Risk Manager",
        "due_date": None,
        "mitigations": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    mock_conn.execute = AsyncMock()
    
    await _upsert_risk(mock_conn, risk_data)
    
    mock_conn.execute.assert_called_once()
    call_args = mock_conn.execute.call_args[0]
    assert "INSERT INTO jira_risk_register" in call_args[0]


@pytest.mark.asyncio
async def test_create_evidence(mock_conn):
    """Test creating evidence entry"""
    ev_data = {
        "project_slug": "test-project",
        "control_id": "CTRL-001",
        "name": "evidence.pdf",
        "uri": "https://jira.example.com/attachment/10000",
        "status": "pending",
        "mime": "application/pdf",
        "size_bytes": 1024,
        "created_by": "John Doe",
        "source_key": "AI-123",
        "source_attachment_id": "10000",
    }
    
    mock_conn.fetchval = AsyncMock(return_value=12345)
    
    evidence_id = await _create_evidence(mock_conn, ev_data, "CTRL-001")
    
    assert evidence_id == 12345
    mock_conn.fetchval.assert_called_once()
    call_args = mock_conn.fetchval.call_args[0]
    assert "INSERT INTO evidence" in call_args[0]


@pytest.mark.asyncio
async def test_store_sync_metadata(mock_conn, sample_mapping):
    """Test storing sync metadata"""
    import json
    
    mock_conn.execute = AsyncMock()
    
    await _store_sync_metadata(mock_conn, sample_mapping)
    
    mock_conn.execute.assert_called_once()
    call_args = mock_conn.execute.call_args[0]
    assert "INSERT INTO jira_sync_metadata" in call_args[0]
    assert call_args[2] == sample_mapping.project_slug
    assert call_args[3] == sample_mapping.jira_key


# --- SYNC WORKFLOW TESTS ---

@pytest.mark.asyncio
async def test_sync_workflow_with_attachments(mock_conn, sample_jira_issue):
    """Test complete sync workflow with attachments"""
    from app.routers.jira import JiraSyncRequest
    
    mock_jira_client = MagicMock(spec=JiraClient)
    mock_jira_client.search_issues = AsyncMock(return_value={
        "total": 1,
        "issues": [sample_jira_issue],
    })
    
    mock_pool = MagicMock()
    mock_pool.acquire = MagicMock(return_value=AsyncMock(
        __aenter__=AsyncMock(return_value=mock_conn),
        __aexit__=AsyncMock(return_value=None),
    ))
    
    mock_conn.execute = AsyncMock()
    mock_conn.fetchval = AsyncMock(return_value=12345)
    
    mapper = JiraMapper()
    mapping = mapper.map_issue(sample_jira_issue, "test-project")
    
    request = JiraSyncRequest(
        project_slug="test-project",
        jira_project_keys=["AI"],
        sync_attachments=True,
        framework="EU_AI_ACT",
    )
    
    # Mock all dependencies
    with patch("app.routers.jira.get_pool", return_value=mock_pool):
        with patch("app.routers.jira.JiraMapper", return_value=mapper):
            with patch("app.routers.jira.append_audit_event", new_callable=AsyncMock):
                result = await sync_jira_issues(request, mock_jira_client)
    
    assert result.success is True
    assert result.issues_synced == 1
    assert result.requirements_created == 1
    assert result.evidence_created == 1


@pytest.mark.asyncio
async def test_sync_workflow_error_handling(mock_conn):
    """Test error handling during sync"""
    from app.routers.jira import JiraSyncRequest
    
    mock_jira_client = MagicMock(spec=JiraClient)
    mock_jira_client.search_issues = AsyncMock(return_value={
        "total": 1,
        "issues": [{"key": "AI-123", "id": "10001", "fields": {}}],
    })
    
    mock_pool = MagicMock()
    mock_pool.acquire = MagicMock(return_value=AsyncMock(
        __aenter__=AsyncMock(return_value=mock_conn),
        __aexit__=AsyncMock(return_value=None),
    ))
    
    mapper = MagicMock()
    mapper.map_issue.side_effect = Exception("Mapping failed")
    
    request = JiraSyncRequest(
        project_slug="test-project",
        jira_project_keys=["AI"],
        framework="EU_AI_ACT",
    )
    
    with patch("app.routers.jira.get_pool", return_value=mock_pool):
        with patch("app.routers.jira.JiraMapper", return_value=mapper):
            with patch("app.routers.jira.append_audit_event", new_callable=AsyncMock):
                result = await sync_jira_issues(request, mock_jira_client)
    
    assert result.success is False
    assert len(result.errors) > 0
    assert "Mapping failed" in result.errors[0]


@pytest.mark.asyncio
async def test_sync_workflow_pagination(mock_conn):
    """Test sync with pagination"""
    from app.routers.jira import JiraSyncRequest
    
    # Create 150 issues (2 pages)
    issues_page1 = [
        {
            "key": f"AI-{i}",
            "id": str(i),
            "fields": {
                "summary": f"Issue {i}",
                "issuetype": {"name": "Requirement"},
                "status": {"name": "Open"},
                "created": "2026-01-01T10:00:00.000+0000",
                "updated": "2026-01-01T10:00:00.000+0000",
            },
        }
        for i in range(100)
    ]
    
    issues_page2 = [
        {
            "key": f"AI-{i}",
            "id": str(i),
            "fields": {
                "summary": f"Issue {i}",
                "issuetype": {"name": "Requirement"},
                "status": {"name": "Open"},
                "created": "2026-01-01T10:00:00.000+0000",
                "updated": "2026-01-01T10:00:00.000+0000",
            },
        }
        for i in range(100, 150)
    ]
    
    mock_jira_client = MagicMock(spec=JiraClient)
    mock_jira_client.search_issues = AsyncMock(side_effect=[
        {"total": 150, "issues": issues_page1},
        {"total": 150, "issues": issues_page2},
    ])
    
    mock_pool = MagicMock()
    mock_pool.acquire = MagicMock(return_value=AsyncMock(
        __aenter__=AsyncMock(return_value=mock_conn),
        __aexit__=AsyncMock(return_value=None),
    ))
    
    mock_conn.execute = AsyncMock()
    
    mapper = JiraMapper()
    
    request = JiraSyncRequest(
        project_slug="test-project",
        jira_project_keys=["AI"],
        framework="EU_AI_ACT",
    )
    
    with patch("app.routers.jira.get_pool", return_value=mock_pool):
        with patch("app.routers.jira.JiraMapper", return_value=mapper):
            with patch("app.routers.jira.append_audit_event", new_callable=AsyncMock):
                result = await sync_jira_issues(request, mock_jira_client)
    
    assert result.issues_synced == 150
    assert mock_jira_client.search_issues.call_count == 2


# --- EDGE CASE TESTS ---

@pytest.mark.asyncio
async def test_sync_empty_result(mock_conn):
    """Test sync with no issues found"""
    from app.routers.jira import JiraSyncRequest
    
    mock_jira_client = MagicMock(spec=JiraClient)
    mock_jira_client.search_issues = AsyncMock(return_value={
        "total": 0,
        "issues": [],
    })
    
    mock_pool = MagicMock()
    mock_pool.acquire = MagicMock(return_value=AsyncMock(
        __aenter__=AsyncMock(return_value=mock_conn),
        __aexit__=AsyncMock(return_value=None),
    ))
    
    request = JiraSyncRequest(
        project_slug="test-project",
        jira_project_keys=["AI"],
        framework="EU_AI_ACT",
    )
    
    with patch("app.routers.jira.get_pool", return_value=mock_pool):
        with patch("app.routers.jira.append_audit_event", new_callable=AsyncMock):
            result = await sync_jira_issues(request, mock_jira_client)
    
    assert result.issues_synced == 0
    assert result.requirements_created == 0
    assert result.success is True


@pytest.mark.asyncio
async def test_sync_with_jql_filter(mock_conn):
    """Test sync with JQL filter"""
    from app.routers.jira import JiraSyncRequest
    
    mock_jira_client = MagicMock(spec=JiraClient)
    mock_jira_client.search_issues = AsyncMock(return_value={
        "total": 1,
        "issues": [{
            "key": "AI-123",
            "id": "10001",
            "fields": {
                "summary": "Test",
                "issuetype": {"name": "Requirement"},
                "status": {"name": "In Progress"},
                "created": "2026-01-01T10:00:00.000+0000",
                "updated": "2026-01-01T10:00:00.000+0000",
            },
        }],
    })
    
    mock_pool = MagicMock()
    mock_pool.acquire = MagicMock(return_value=AsyncMock(
        __aenter__=AsyncMock(return_value=mock_conn),
        __aexit__=AsyncMock(return_value=None),
    ))
    
    mock_conn.execute = AsyncMock()
    
    mapper = JiraMapper()
    
    request = JiraSyncRequest(
        project_slug="test-project",
        jira_project_keys=["AI"],
        jql="status = 'In Progress'",
        framework="EU_AI_ACT",
    )
    
    with patch("app.routers.jira.get_pool", return_value=mock_pool):
        with patch("app.routers.jira.JiraMapper", return_value=mapper):
            with patch("app.routers.jira.append_audit_event", new_callable=AsyncMock):
                result = await sync_jira_issues(request, mock_jira_client)
    
    # Verify JQL was included in search
    call_kwargs = mock_jira_client.search_issues.call_args[1]
    assert "status = 'In Progress'" in call_kwargs["jql"]
    assert result.issues_synced == 1
