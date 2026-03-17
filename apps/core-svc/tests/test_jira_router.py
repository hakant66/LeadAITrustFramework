"""
Jira Router Tests

Tests for FastAPI router endpoints including configuration, search, sync,
and error handling.
"""

import pytest
import os
from unittest.mock import AsyncMock, patch, MagicMock, Mock
from fastapi.testclient import TestClient

from app.main import app
from app.services.jira_client import JiraClient, JiraConfig, JiraAuthError, JiraAPIError
from app.services.jira_mapper import JiraIssueMapping


# --- FIXTURES ---

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_jira_client():
    """Mock JiraClient instance"""
    client = MagicMock(spec=JiraClient)
    client.base_url = "https://test.atlassian.net"
    client.config = MagicMock()
    return client


@pytest.fixture
def mock_pool():
    """Mock asyncpg pool"""
    pool = AsyncMock()
    conn = AsyncMock()
    # Set up connection methods
    conn.fetchrow = AsyncMock(return_value=None)
    conn.execute = AsyncMock()
    acquire_cm = AsyncMock()
    acquire_cm.__aenter__.return_value = conn
    acquire_cm.__aexit__.return_value = None
    pool.acquire = Mock(return_value=acquire_cm)
    return pool


@pytest.fixture
def sample_jira_projects():
    """Sample Jira projects response"""
    return [
        {"key": "AI", "name": "AI Project", "projectTypeKey": "software", "id": "10000"},
        {"key": "GOV", "name": "Governance", "projectTypeKey": "software", "id": "10001"},
    ]


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
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-15T14:30:00.000+0000",
        },
    }


@pytest.fixture
def sample_search_result(sample_jira_issue):
    """Sample Jira search result"""
    return {
        "total": 1,
        "startAt": 0,
        "maxResults": 50,
        "issues": [sample_jira_issue],
    }


# --- CONFIGURATION ENDPOINT TESTS ---

def test_get_jira_config_not_configured(client, monkeypatch):
    """Test getting Jira config when not configured"""
    monkeypatch.delenv("JIRA_BASE_URL", raising=False)
    
    resp = client.get("/admin/jira/config")
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["configured"] is False
    assert data["base_url"] == ""


def test_get_jira_config_api_token(monkeypatch, client):
    """Test getting Jira config with API token auth"""
    monkeypatch.setenv("JIRA_BASE_URL", "https://test.atlassian.net")
    monkeypatch.setenv("JIRA_AUTH_TYPE", "api_token")
    monkeypatch.setenv("JIRA_EMAIL", "test@example.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "token123")
    
    resp = client.get("/admin/jira/config")
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["configured"] is True
    assert data["base_url"] == "https://test.atlassian.net"
    assert data["auth_type"] == "api_token"
    assert "@***" in data["email"]  # Masked email
    assert data["api_token_configured"] is True


def test_get_jira_config_basic_auth(monkeypatch, client):
    """Test getting Jira config with basic auth"""
    monkeypatch.setenv("JIRA_BASE_URL", "https://jira.example.com")
    monkeypatch.setenv("JIRA_AUTH_TYPE", "basic")
    monkeypatch.setenv("JIRA_USERNAME", "user")
    monkeypatch.setenv("JIRA_PASSWORD", "pass")
    
    resp = client.get("/admin/jira/config")
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["auth_type"] == "basic"
    assert "***" in data["username"]  # Masked username
    assert data["password_configured"] is True


def test_get_jira_config_oauth(monkeypatch, client):
    """Test getting Jira config with OAuth2"""
    monkeypatch.setenv("JIRA_BASE_URL", "https://test.atlassian.net")
    monkeypatch.setenv("JIRA_AUTH_TYPE", "oauth2")
    monkeypatch.setenv("JIRA_OAUTH_TOKEN", "bearer_token")
    
    resp = client.get("/admin/jira/config")
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["auth_type"] == "oauth2"
    assert data["oauth_token_configured"] is True


# --- CONNECTION TEST ENDPOINT TESTS ---

@pytest.mark.asyncio
async def test_test_jira_connection_success(client, mock_jira_client, sample_jira_projects):
    """Test successful Jira connection test"""
    mock_jira_client.get_projects = AsyncMock(return_value=sample_jira_projects)
    
    with patch("app.routers.jira.create_jira_client_from_env", return_value=mock_jira_client):
        resp = client.post("/admin/jira/config/test")
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["projects_count"] == 2
    assert len(data["projects"]) == 2


@pytest.mark.asyncio
async def test_test_jira_connection_with_config(client, mock_jira_client, sample_jira_projects):
    """Test Jira connection test with provided config"""
    mock_jira_client.get_projects = AsyncMock(return_value=sample_jira_projects)
    
    config_data = {
        "base_url": "https://test.atlassian.net",
        "auth_type": "api_token",
        "email": "test@example.com",
        "api_token": "token123",
    }
    
    with patch("app.routers.jira.JiraClient", return_value=mock_jira_client):
        resp = client.post("/admin/jira/config/test", json=config_data)
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_test_jira_connection_auth_error(client):
    """Test Jira connection test with authentication error"""
    with patch("app.routers.jira.create_jira_client_from_env", side_effect=JiraAuthError("Invalid credentials")):
        resp = client.post("/admin/jira/config/test")
    
    assert resp.status_code == 401
    assert "Authentication failed" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_test_jira_connection_api_error(client):
    """Test Jira connection test with API error"""
    with patch("app.routers.jira.create_jira_client_from_env", side_effect=JiraAPIError("API error")):
        resp = client.post("/admin/jira/config/test")
    
    assert resp.status_code == 502
    assert "Jira API error" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_test_jira_connection_missing_config(client):
    """Test Jira connection test when config is missing"""
    with patch("app.routers.jira.create_jira_client_from_env", side_effect=ValueError("JIRA_BASE_URL required")):
        resp = client.post("/admin/jira/config/test")
    
    assert resp.status_code == 400
    assert "Jira configuration error" in resp.json()["detail"]


# --- PROJECTS ENDPOINT TESTS ---

@pytest.mark.asyncio
async def test_list_jira_projects(client, mock_jira_client, sample_jira_projects):
    """Test listing Jira projects"""
    mock_jira_client.get_projects = AsyncMock(return_value=sample_jira_projects)
    
    with patch("app.routers.jira.create_jira_client_from_env", return_value=mock_jira_client):
        resp = client.get("/admin/jira/projects")
    
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["key"] == "AI"
    assert data[0]["name"] == "AI Project"


@pytest.mark.asyncio
async def test_list_jira_projects_api_error(client, mock_jira_client):
    """Test listing projects with API error"""
    mock_jira_client.get_projects = AsyncMock(side_effect=JiraAPIError("API error"))
    
    with patch("app.routers.jira.create_jira_client_from_env", return_value=mock_jira_client):
        resp = client.get("/admin/jira/projects")
    
    assert resp.status_code == 502


@pytest.mark.asyncio
async def test_list_jira_projects_missing_config(client):
    """Test listing projects when config is missing"""
    with patch("app.routers.jira.create_jira_client_from_env", side_effect=ValueError("Config required")):
        resp = client.get("/admin/jira/projects")
    
    assert resp.status_code == 400


# --- FIELDS ENDPOINT TESTS ---

@pytest.mark.asyncio
async def test_list_jira_fields(client, mock_jira_client):
    """Test listing Jira fields"""
    fields = [
        {"id": "summary", "name": "Summary", "custom": False, "schema": {"type": "string"}},
        {"id": "customfield_10001", "name": "Custom Field", "custom": True, "schema": {"type": "string"}},
    ]
    mock_jira_client.get_fields = AsyncMock(return_value=fields)
    
    with patch("app.routers.jira.create_jira_client_from_env", return_value=mock_jira_client):
        resp = client.get("/admin/jira/fields")
    
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["id"] == "summary"
    assert data[1]["custom"] is True


@pytest.mark.asyncio
async def test_list_jira_fields_api_error(client, mock_jira_client):
    """Test listing fields with API error"""
    mock_jira_client.get_fields = AsyncMock(side_effect=JiraAPIError("API error"))
    
    with patch("app.routers.jira.create_jira_client_from_env", return_value=mock_jira_client):
        resp = client.get("/admin/jira/fields")
    
    assert resp.status_code == 502


# --- SEARCH ENDPOINT TESTS ---

@pytest.mark.asyncio
async def test_search_jira_issues(client, mock_jira_client, sample_search_result):
    """Test searching Jira issues"""
    mock_jira_client.search_issues = AsyncMock(return_value=sample_search_result)
    
    with patch("app.routers.jira.create_jira_client_from_env", return_value=mock_jira_client):
        resp = client.post(
            "/admin/jira/search",
            json={"jql": "project = AI", "start_at": 0, "max_results": 50},
        )
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert len(data["issues"]) == 1
    assert data["issues"][0]["key"] == "AI-123"
    
    # Verify search_issues was called with correct parameters
    mock_jira_client.search_issues.assert_called_once()
    call_kwargs = mock_jira_client.search_issues.call_args[1]
    assert call_kwargs["jql"] == "project = AI"
    assert call_kwargs["start_at"] == 0
    assert call_kwargs["max_results"] == 50
    assert "changelog" in call_kwargs["expand"]


@pytest.mark.asyncio
async def test_search_jira_issues_pagination(client, mock_jira_client):
    """Test search with pagination"""
    result = {
        "total": 150,
        "startAt": 50,
        "maxResults": 50,
        "issues": [],
    }
    mock_jira_client.search_issues = AsyncMock(return_value=result)
    
    with patch("app.routers.jira.create_jira_client_from_env", return_value=mock_jira_client):
        resp = client.post(
            "/admin/jira/search",
            json={"jql": "project = AI", "start_at": 50, "max_results": 50},
        )
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["start_at"] == 50


@pytest.mark.asyncio
async def test_search_jira_issues_max_results_validation(client):
    """Test search max_results validation"""
    resp = client.post(
        "/admin/jira/search",
        json={"jql": "project = AI", "start_at": 0, "max_results": 200},  # Exceeds max
    )
    
    assert resp.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_search_jira_issues_api_error(client, mock_jira_client):
    """Test search with API error"""
    mock_jira_client.search_issues = AsyncMock(side_effect=JiraAPIError("API error"))
    
    with patch("app.routers.jira.create_jira_client_from_env", return_value=mock_jira_client):
        resp = client.post(
            "/admin/jira/search",
            json={"jql": "project = AI", "start_at": 0, "max_results": 50},
        )
    
    assert resp.status_code == 502


# --- SYNC ENDPOINT TESTS ---

@pytest.mark.asyncio
async def test_sync_jira_issues_success(
    client, mock_jira_client, mock_pool, sample_search_result, monkeypatch
):
    """Test successful Jira sync"""
    # Mock Jira client
    mock_jira_client.search_issues = AsyncMock(return_value=sample_search_result)
    
    # Mock database pool
    async def fake_get_pool():
        return mock_pool
    
    # Mock mapper
    mock_mapping = MagicMock(spec=JiraIssueMapping)
    mock_mapping.governance_type = "governance.requirement"
    mock_mapping.jira_key = "AI-123"
    
    mock_mapper = MagicMock()
    mock_mapper.map_issue.return_value = mock_mapping
    mock_mapper.map_to_requirement.return_value = {
        "id": "req-123",
        "project_slug": "test-project",
        "framework": "EU_AI_ACT",
        "requirement_code": "AI-123",
        "title": "Test Requirement",
        "description": "Test",
        "applicability": [],
        "owner_role": None,
        "status": "in_progress",
        "evidence_ids": [],
        "mapped_controls": [],
        "notes": "Imported from Jira: AI-123",
        "created_at": "2026-01-01T10:00:00",
        "updated_at": "2026-01-15T14:30:00",
    }
    mock_mapper.map_to_evidence.return_value = []
    
    with patch("app.routers.jira.create_jira_client_from_env", return_value=mock_jira_client):
        with patch("app.routers.jira.get_pool", side_effect=fake_get_pool):
            with patch("app.routers.jira.JiraMapper", return_value=mock_mapper):
                with patch("app.routers.jira._upsert_requirement", new_callable=AsyncMock):
                    with patch("app.routers.jira._store_sync_metadata", new_callable=AsyncMock):
                        with patch("app.routers.jira.append_audit_event", new_callable=AsyncMock):
                            resp = client.post(
                                "/admin/jira/sync",
                                json={
                                    "project_slug": "test-project",
                                    "jira_project_keys": ["AI"],
                                    "framework": "EU_AI_ACT",
                                    "sync_attachments": False,
                                },
                            )
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["issues_synced"] == 1
    assert data["requirements_created"] == 1


@pytest.mark.asyncio
async def test_sync_jira_issues_with_jql(client, mock_jira_client, mock_pool, sample_search_result):
    """Test sync with custom JQL"""
    mock_jira_client.search_issues = AsyncMock(return_value=sample_search_result)
    
    async def fake_get_pool():
        return mock_pool
    
    mock_mapping = MagicMock(spec=JiraIssueMapping)
    mock_mapping.governance_type = "governance.requirement"
    mock_mapping.jira_key = "AI-123"
    
    mock_mapper = MagicMock()
    mock_mapper.map_issue.return_value = mock_mapping
    mock_mapper.map_to_requirement.return_value = {
        "id": "req-123",
        "project_slug": "test-project",
        "framework": "EU_AI_ACT",
        "requirement_code": "AI-123",
        "title": "Test",
        "description": "Test",
        "applicability": [],
        "owner_role": None,
        "status": "in_progress",
        "evidence_ids": [],
        "mapped_controls": [],
        "notes": "Imported from Jira: AI-123",
        "created_at": "2026-01-01T10:00:00",
        "updated_at": "2026-01-15T14:30:00",
    }
    mock_mapper.map_to_evidence.return_value = []
    
    with patch("app.routers.jira.create_jira_client_from_env", return_value=mock_jira_client):
        with patch("app.routers.jira.get_pool", side_effect=fake_get_pool):
            with patch("app.routers.jira.JiraMapper", return_value=mock_mapper):
                with patch("app.routers.jira._upsert_requirement", new_callable=AsyncMock):
                    with patch("app.routers.jira._store_sync_metadata", new_callable=AsyncMock):
                        with patch("app.routers.jira.append_audit_event", new_callable=AsyncMock):
                            resp = client.post(
                                "/admin/jira/sync",
                                json={
                                    "project_slug": "test-project",
                                    "jira_project_keys": ["AI"],
                                    "jql": "status = 'In Progress'",
                                    "framework": "EU_AI_ACT",
                                },
                            )
    
    assert resp.status_code == 200
    # Verify JQL was included in search
    call_kwargs = mock_jira_client.search_issues.call_args[1]
    assert "status = 'In Progress'" in call_kwargs["jql"]


@pytest.mark.asyncio
async def test_sync_jira_issues_pagination(client, mock_jira_client, mock_pool):
    """Test sync with pagination (multiple pages)"""
    # First page
    page1 = {
        "total": 150,
        "startAt": 0,
        "maxResults": 100,
        "issues": [{"key": f"AI-{i}", "id": str(i), "fields": {"summary": f"Issue {i}", "issuetype": {"name": "Requirement"}, "status": {"name": "Open"}, "created": "2026-01-01T10:00:00.000+0000", "updated": "2026-01-01T10:00:00.000+0000"}} for i in range(100)],
    }
    # Second page
    page2 = {
        "total": 150,
        "startAt": 100,
        "maxResults": 100,
        "issues": [{"key": f"AI-{i}", "id": str(i), "fields": {"summary": f"Issue {i}", "issuetype": {"name": "Requirement"}, "status": {"name": "Open"}, "created": "2026-01-01T10:00:00.000+0000", "updated": "2026-01-01T10:00:00.000+0000"}} for i in range(100, 150)],
    }
    
    mock_jira_client.search_issues = AsyncMock(side_effect=[page1, page2])
    
    async def fake_get_pool():
        return mock_pool
    
    mock_mapping = MagicMock(spec=JiraIssueMapping)
    mock_mapping.governance_type = "governance.requirement"
    mock_mapping.jira_key = "AI-1"
    
    mock_mapper = MagicMock()
    mock_mapper.map_issue.return_value = mock_mapping
    mock_mapper.map_to_requirement.return_value = {
        "id": "req-123",
        "project_slug": "test-project",
        "framework": "EU_AI_ACT",
        "requirement_code": "AI-1",
        "title": "Test",
        "description": "Test",
        "applicability": [],
        "owner_role": None,
        "status": "in_progress",
        "evidence_ids": [],
        "mapped_controls": [],
        "notes": "Imported from Jira: AI-1",
        "created_at": "2026-01-01T10:00:00",
        "updated_at": "2026-01-01T10:00:00",
    }
    mock_mapper.map_to_evidence.return_value = []
    
    with patch("app.routers.jira.create_jira_client_from_env", return_value=mock_jira_client):
        with patch("app.routers.jira.get_pool", side_effect=fake_get_pool):
            with patch("app.routers.jira.JiraMapper", return_value=mock_mapper):
                with patch("app.routers.jira._upsert_requirement", new_callable=AsyncMock):
                    with patch("app.routers.jira._store_sync_metadata", new_callable=AsyncMock):
                        with patch("app.routers.jira.append_audit_event", new_callable=AsyncMock):
                            resp = client.post(
                                "/admin/jira/sync",
                                json={
                                    "project_slug": "test-project",
                                    "jira_project_keys": ["AI"],
                                    "framework": "EU_AI_ACT",
                                },
                            )
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["issues_synced"] == 150
    # Verify pagination occurred
    assert mock_jira_client.search_issues.call_count == 2


@pytest.mark.asyncio
async def test_sync_jira_issues_api_error(client, mock_jira_client):
    """Test sync with Jira API error"""
    mock_jira_client.search_issues = AsyncMock(side_effect=JiraAPIError("API error"))
    
    with patch("app.routers.jira.create_jira_client_from_env", return_value=mock_jira_client):
        resp = client.post(
            "/admin/jira/sync",
            json={
                "project_slug": "test-project",
                "jira_project_keys": ["AI"],
                "framework": "EU_AI_ACT",
            },
        )
    
    assert resp.status_code == 502


@pytest.mark.asyncio
async def test_sync_jira_issues_risk_type(client, mock_jira_client, mock_pool):
    """Test sync with Risk issue type"""
    result = {
        "total": 1,
        "issues": [{
            "key": "RISK-1",
            "id": "10001",
            "fields": {
                "summary": "Test Risk",
                "issuetype": {"name": "Risk"},
                "status": {"name": "Open"},
                "created": "2026-01-01T10:00:00.000+0000",
                "updated": "2026-01-01T10:00:00.000+0000",
            },
        }],
    }
    mock_jira_client.search_issues = AsyncMock(return_value=result)
    
    async def fake_get_pool():
        return mock_pool
    
    mock_mapping = MagicMock(spec=JiraIssueMapping)
    mock_mapping.governance_type = "governance.risk"
    mock_mapping.jira_key = "RISK-1"
    
    mock_mapper = MagicMock()
    mock_mapper.map_issue.return_value = mock_mapping
    mock_mapper.map_to_risk.return_value = {
        "jira_key": "RISK-1",
        "project_slug": "test-project",
        "title": "Test Risk",
    }
    
    with patch("app.routers.jira.create_jira_client_from_env", return_value=mock_jira_client):
        with patch("app.routers.jira.get_pool", side_effect=fake_get_pool):
            with patch("app.routers.jira.JiraMapper", return_value=mock_mapper):
                with patch("app.routers.jira._upsert_risk", new_callable=AsyncMock):
                    with patch("app.routers.jira._store_sync_metadata", new_callable=AsyncMock):
                        with patch("app.routers.jira.append_audit_event", new_callable=AsyncMock):
                            resp = client.post(
                                "/admin/jira/sync",
                                json={
                                    "project_slug": "test-project",
                                    "jira_project_keys": ["RISK"],
                                    "framework": "EU_AI_ACT",
                                },
                            )
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["risks_created"] == 1


# --- SYNC STATUS ENDPOINT TESTS ---

@pytest.mark.asyncio
async def test_get_sync_status(client, mock_pool):
    """Test getting sync status"""
    async def fake_get_pool():
        return mock_pool
    
    # Ensure fetchrow returns None (no sync metadata found)
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
    mock_conn.fetchrow = AsyncMock(return_value=None)
    
    with patch("app.routers.jira.get_pool", side_effect=fake_get_pool):
        resp = client.get("/admin/jira/sync/status/test-project")
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_slug"] == "test-project"
    assert data["status"] == "not_synced"
