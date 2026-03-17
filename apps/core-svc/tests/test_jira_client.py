"""
Jira Client Tests

Tests for the Jira REST API client including authentication, API methods,
and error handling.
"""

import pytest
import base64
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from app.services.jira_client import (
    JiraClient,
    JiraConfig,
    JiraAuthError,
    JiraAPIError,
    create_jira_client_from_env,
)


# --- FIXTURES ---

@pytest.fixture
def api_token_config():
    """Jira config with API token auth"""
    return JiraConfig(
        base_url="https://test.atlassian.net",
        auth_type="api_token",
        email="test@example.com",
        api_token="test_token_123",
        timeout=30,
    )


@pytest.fixture
def basic_auth_config():
    """Jira config with basic auth"""
    return JiraConfig(
        base_url="https://jira.example.com",
        auth_type="basic",
        username="testuser",
        password="testpass",
        timeout=30,
    )


@pytest.fixture
def oauth_config():
    """Jira config with OAuth2"""
    return JiraConfig(
        base_url="https://test.atlassian.net",
        auth_type="oauth2",
        oauth_token="bearer_token_123",
        timeout=30,
    )


@pytest.fixture
def mock_httpx_response():
    """Mock httpx response"""
    response = MagicMock()
    response.status_code = 200
    response.content = b'{"key": "TEST-1"}'
    response.json.return_value = {"key": "TEST-1"}
    response.raise_for_status = MagicMock()
    return response


# --- AUTHENTICATION TESTS ---

def test_jira_client_api_token_auth(api_token_config):
    """Test JiraClient initialization with API token auth"""
    client = JiraClient(api_token_config)
    assert client.base_url == "https://test.atlassian.net"
    assert client.config.auth_type == "api_token"
    
    headers = client._get_auth_headers()
    assert "Authorization" in headers
    assert headers["Authorization"].startswith("Basic ")
    
    # Verify base64 encoding
    auth_value = headers["Authorization"].replace("Basic ", "")
    decoded = base64.b64decode(auth_value).decode()
    assert decoded == "test@example.com:test_token_123"


def test_jira_client_basic_auth(basic_auth_config):
    """Test JiraClient initialization with basic auth"""
    client = JiraClient(basic_auth_config)
    headers = client._get_auth_headers()
    assert "Authorization" in headers
    assert headers["Authorization"].startswith("Basic ")
    
    auth_value = headers["Authorization"].replace("Basic ", "")
    decoded = base64.b64decode(auth_value).decode()
    assert decoded == "testuser:testpass"


def test_jira_client_oauth_auth(oauth_config):
    """Test JiraClient initialization with OAuth2"""
    client = JiraClient(oauth_config)
    headers = client._get_auth_headers()
    assert headers["Authorization"] == "Bearer bearer_token_123"


def test_jira_client_missing_api_token_credentials():
    """Test JiraClient raises error when API token credentials are missing"""
    config = JiraConfig(
        base_url="https://test.atlassian.net",
        auth_type="api_token",
        email=None,
        api_token=None,
    )
    with pytest.raises(JiraAuthError, match="API token auth requires"):
        JiraClient(config)


def test_jira_client_missing_basic_credentials():
    """Test JiraClient raises error when basic auth credentials are missing"""
    config = JiraConfig(
        base_url="https://test.atlassian.net",
        auth_type="basic",
        username=None,
        password=None,
    )
    with pytest.raises(JiraAuthError, match="Basic auth requires"):
        JiraClient(config)


def test_jira_client_missing_oauth_token():
    """Test JiraClient raises error when OAuth token is missing"""
    config = JiraConfig(
        base_url="https://test.atlassian.net",
        auth_type="oauth2",
        oauth_token=None,
    )
    with pytest.raises(JiraAuthError, match="OAuth2 auth requires"):
        JiraClient(config)


def test_jira_client_unsupported_auth_type():
    """Test JiraClient raises error for unsupported auth type"""
    config = JiraConfig(
        base_url="https://test.atlassian.net",
        auth_type="unsupported",
    )
    with pytest.raises(JiraAuthError, match="Unsupported auth_type"):
        JiraClient(config)


# --- API METHOD TESTS ---

@pytest.mark.asyncio
async def test_get_projects(api_token_config, mock_httpx_response):
    """Test get_projects API call"""
    client = JiraClient(api_token_config)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.request.return_value = mock_httpx_response
        
        result = await client.get_projects()
        
        assert result == {"key": "TEST-1"}
        mock_client.request.assert_called_once()
        call_args = mock_client.request.call_args
        # Check method (first positional arg or kwargs)
        if call_args[0]:
            assert call_args[0][0] == "GET"
        else:
            assert call_args.kwargs.get("method") == "GET"
        # Check URL (in kwargs)
        assert "/rest/api/3/project" in (call_args.kwargs.get("url") or call_args[1].get("url", ""))


@pytest.mark.asyncio
async def test_get_project(api_token_config, mock_httpx_response):
    """Test get_project API call"""
    client = JiraClient(api_token_config)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.request.return_value = mock_httpx_response
        
        result = await client.get_project("TEST")
        
        assert result == {"key": "TEST-1"}
        mock_client.request.assert_called_once()
        call_args = mock_client.request.call_args
        # Check URL (in kwargs)
        assert "/rest/api/3/project/TEST" in (call_args.kwargs.get("url") or "")


@pytest.mark.asyncio
async def test_get_fields(api_token_config, mock_httpx_response):
    """Test get_fields API call"""
    mock_httpx_response.json.return_value = [
        {"id": "summary", "name": "Summary"},
        {"id": "customfield_10001", "name": "Custom Field"},
    ]
    
    client = JiraClient(api_token_config)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.request.return_value = mock_httpx_response
        
        result = await client.get_fields()
        
        assert isinstance(result, list)
        assert len(result) == 2


@pytest.mark.asyncio
async def test_search_issues(api_token_config):
    """Test search_issues API call"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "total": 1,
        "issues": [{"key": "TEST-1", "fields": {"summary": "Test Issue"}}],
    }
    mock_response.raise_for_status = MagicMock()
    
    client = JiraClient(api_token_config)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.request.return_value = mock_response
        
        result = await client.search_issues(
            jql="project = TEST",
            start_at=0,
            max_results=50,
            expand=["changelog"],
        )
        
        assert result["total"] == 1
        assert len(result["issues"]) == 1
        
        call_args = mock_client.request.call_args
        params = call_args[1]["params"]
        assert params["jql"] == "project = TEST"
        assert params["startAt"] == 0
        assert params["maxResults"] == 50
        assert "changelog" in params["expand"]


@pytest.mark.asyncio
async def test_search_issues_max_results_capped(api_token_config):
    """Test that max_results is capped at 100"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"total": 0, "issues": []}
    mock_response.raise_for_status = MagicMock()
    
    client = JiraClient(api_token_config)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.request.return_value = mock_response
        
        await client.search_issues(jql="project = TEST", max_results=200)
        
        call_args = mock_client.request.call_args
        params = call_args[1]["params"]
        assert params["maxResults"] == 100  # Should be capped


@pytest.mark.asyncio
async def test_get_issue(api_token_config):
    """Test get_issue API call"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "key": "TEST-1",
        "fields": {"summary": "Test Issue"},
    }
    mock_response.raise_for_status = MagicMock()
    
    client = JiraClient(api_token_config)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.request.return_value = mock_response
        
        result = await client.get_issue("TEST-1", expand=["changelog"])
        
        assert result["key"] == "TEST-1"
        call_args = mock_client.request.call_args
        assert "/rest/api/3/issue/TEST-1" in call_args[1]["url"]
        assert call_args[1]["params"]["expand"] == "changelog"


@pytest.mark.asyncio
async def test_get_issue_changelog(api_token_config):
    """Test get_issue_changelog API call"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"histories": []}
    mock_response.raise_for_status = MagicMock()
    
    client = JiraClient(api_token_config)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.request.return_value = mock_response
        
        result = await client.get_issue_changelog("TEST-1")
        
        assert "histories" in result


@pytest.mark.asyncio
async def test_get_issue_comments(api_token_config):
    """Test get_issue_comments API call"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"comments": []}
    mock_response.raise_for_status = MagicMock()
    
    client = JiraClient(api_token_config)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.request.return_value = mock_response
        
        result = await client.get_issue_comments("TEST-1")
        
        assert "comments" in result


@pytest.mark.asyncio
async def test_get_issue_attachments(api_token_config):
    """Test get_issue_attachments API call"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "fields": {
            "attachment": [
                {"id": "10000", "filename": "test.pdf", "size": 1024},
            ],
        },
    }
    mock_response.raise_for_status = MagicMock()
    
    client = JiraClient(api_token_config)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.request.return_value = mock_response
        
        result = await client.get_issue_attachments("TEST-1")
        
        assert len(result) == 1
        assert result[0]["filename"] == "test.pdf"


# --- ERROR HANDLING TESTS ---

@pytest.mark.asyncio
async def test_request_authentication_error(api_token_config):
    """Test that 401 errors raise JiraAuthError"""
    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_response.text = "Unauthorized"
    
    error = MagicMock()
    error.response = mock_response
    error.response.status_code = 401
    
    client = JiraClient(api_token_config)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        from httpx import HTTPStatusError
        mock_client.request.side_effect = HTTPStatusError(
            "Unauthorized", request=MagicMock(), response=mock_response
        )
        
        with pytest.raises(JiraAuthError, match="Authentication failed"):
            await client.get_projects()


@pytest.mark.asyncio
async def test_request_api_error(api_token_config):
    """Test that non-401 HTTP errors raise JiraAPIError"""
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    
    error = MagicMock()
    error.response = mock_response
    
    client = JiraClient(api_token_config)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        from httpx import HTTPStatusError
        mock_client.request.side_effect = HTTPStatusError(
            "Server Error", request=MagicMock(), response=mock_response
        )
        
        with pytest.raises(JiraAPIError, match="Jira API error"):
            await client.get_projects()


@pytest.mark.asyncio
async def test_request_network_error(api_token_config):
    """Test that network errors raise JiraAPIError"""
    client = JiraClient(api_token_config)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        
        from httpx import RequestError
        mock_client.request.side_effect = RequestError("Connection failed")
        
        with pytest.raises(JiraAPIError, match="Request failed"):
            await client.get_projects()


@pytest.mark.asyncio
async def test_request_empty_response(api_token_config):
    """Test handling of empty response"""
    mock_response = MagicMock()
    mock_response.status_code = 204
    mock_response.content = b""
    mock_response.raise_for_status = MagicMock()
    
    client = JiraClient(api_token_config)
    
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.request.return_value = mock_response
        
        result = await client.get_projects()
        
        assert result == {}


# --- ENVIRONMENT CONFIGURATION TESTS ---

def test_create_jira_client_from_env_api_token(monkeypatch):
    """Test creating client from environment with API token"""
    monkeypatch.setenv("JIRA_BASE_URL", "https://test.atlassian.net")
    monkeypatch.setenv("JIRA_AUTH_TYPE", "api_token")
    monkeypatch.setenv("JIRA_EMAIL", "test@example.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "token123")
    
    client = create_jira_client_from_env()
    
    assert client.base_url == "https://test.atlassian.net"
    assert client.config.auth_type == "api_token"
    assert client.config.email == "test@example.com"
    assert client.config.api_token == "token123"


def test_create_jira_client_from_env_basic(monkeypatch):
    """Test creating client from environment with basic auth"""
    monkeypatch.setenv("JIRA_BASE_URL", "https://jira.example.com")
    monkeypatch.setenv("JIRA_AUTH_TYPE", "basic")
    monkeypatch.setenv("JIRA_USERNAME", "user")
    monkeypatch.setenv("JIRA_PASSWORD", "pass")
    
    client = create_jira_client_from_env()
    
    assert client.config.auth_type == "basic"
    assert client.config.username == "user"
    assert client.config.password == "pass"


def test_create_jira_client_from_env_oauth(monkeypatch):
    """Test creating client from environment with OAuth2"""
    monkeypatch.setenv("JIRA_BASE_URL", "https://test.atlassian.net")
    monkeypatch.setenv("JIRA_AUTH_TYPE", "oauth2")
    monkeypatch.setenv("JIRA_OAUTH_TOKEN", "bearer_token")
    
    client = create_jira_client_from_env()
    
    assert client.config.auth_type == "oauth2"
    assert client.config.oauth_token == "bearer_token"


def test_create_jira_client_from_env_missing_base_url(monkeypatch):
    """Test error when JIRA_BASE_URL is missing"""
    monkeypatch.delenv("JIRA_BASE_URL", raising=False)
    
    with pytest.raises(ValueError, match="JIRA_BASE_URL"):
        create_jira_client_from_env()


def test_create_jira_client_from_env_missing_api_token_creds(monkeypatch):
    """Test error when API token credentials are missing"""
    monkeypatch.setenv("JIRA_BASE_URL", "https://test.atlassian.net")
    monkeypatch.setenv("JIRA_AUTH_TYPE", "api_token")
    monkeypatch.delenv("JIRA_EMAIL", raising=False)
    monkeypatch.delenv("JIRA_API_TOKEN", raising=False)
    
    with pytest.raises(ValueError, match="JIRA_EMAIL and JIRA_API_TOKEN"):
        create_jira_client_from_env()


def test_create_jira_client_from_env_custom_timeout(monkeypatch):
    """Test custom timeout from environment"""
    monkeypatch.setenv("JIRA_BASE_URL", "https://test.atlassian.net")
    monkeypatch.setenv("JIRA_AUTH_TYPE", "api_token")
    monkeypatch.setenv("JIRA_EMAIL", "test@example.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "token")
    monkeypatch.setenv("JIRA_TIMEOUT", "60")
    
    client = create_jira_client_from_env()
    
    assert client.timeout == 60


def test_create_jira_client_from_env_default_timeout(monkeypatch):
    """Test default timeout when not specified"""
    monkeypatch.setenv("JIRA_BASE_URL", "https://test.atlassian.net")
    monkeypatch.setenv("JIRA_AUTH_TYPE", "api_token")
    monkeypatch.setenv("JIRA_EMAIL", "test@example.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "token")
    monkeypatch.delenv("JIRA_TIMEOUT", raising=False)
    
    client = create_jira_client_from_env()
    
    assert client.timeout == 30  # Default
