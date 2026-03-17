"""
Jira REST API Client for LeadAI Governance Evidence Integration

This module provides a client for interacting with Jira Cloud/Server APIs
to pull governance evidence (requirements, controls, risks, tests, incidents)
for EU AI Act and ISO/IEC 42001 compliance.
"""

from __future__ import annotations

import base64
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import httpx


class JiraAuthError(Exception):
    """Raised when Jira authentication fails"""
    pass


class JiraAPIError(Exception):
    """Raised when Jira API calls fail"""
    pass


@dataclass
class JiraConfig:
    """Jira connection configuration"""
    base_url: str
    auth_type: str  # "api_token", "basic", "oauth2"
    email: Optional[str] = None
    api_token: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    oauth_token: Optional[str] = None
    timeout: int = 30


class JiraClient:
    """Client for Jira REST API v3"""
    
    def __init__(self, config: JiraConfig):
        self.config = config
        self.base_url = config.base_url.rstrip("/")
        self.timeout = config.timeout
        
        # Validate auth configuration
        if config.auth_type == "api_token":
            if not config.email or not config.api_token:
                raise JiraAuthError("API token auth requires email and api_token")
        elif config.auth_type == "basic":
            if not config.username or not config.password:
                raise JiraAuthError("Basic auth requires username and password")
        elif config.auth_type == "oauth2":
            if not config.oauth_token:
                raise JiraAuthError("OAuth2 auth requires oauth_token")
        else:
            raise JiraAuthError(f"Unsupported auth_type: {config.auth_type}")
    
    def _get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers based on auth type"""
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        
        if self.config.auth_type == "api_token":
            # Jira Cloud API Token auth
            credentials = f"{self.config.email}:{self.config.api_token}"
            encoded = base64.b64encode(credentials.encode()).decode()
            headers["Authorization"] = f"Basic {encoded}"
        
        elif self.config.auth_type == "basic":
            # Basic auth for Jira Server/Data Center
            credentials = f"{self.config.username}:{self.config.password}"
            encoded = base64.b64encode(credentials.encode()).decode()
            headers["Authorization"] = f"Basic {encoded}"
        
        elif self.config.auth_type == "oauth2":
            # OAuth 2.0 Bearer token
            headers["Authorization"] = f"Bearer {self.config.oauth_token}"
        
        return headers
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make HTTP request to Jira API"""
        url = urljoin(self.base_url, endpoint)
        headers = self._get_auth_headers()
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json_data,
                )
                response.raise_for_status()
                return response.json() if response.content else {}
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    raise JiraAuthError(f"Authentication failed: {e.response.text}")
                raise JiraAPIError(
                    f"Jira API error ({e.response.status_code}): {e.response.text}"
                )
            except httpx.RequestError as e:
                raise JiraAPIError(f"Request failed: {str(e)}")
    
    async def get_projects(self) -> List[Dict[str, Any]]:
        """Get list of projects"""
        endpoint = "/rest/api/3/project"
        return await self._request("GET", endpoint)
    
    async def get_project(self, project_key: str) -> Dict[str, Any]:
        """Get project details"""
        endpoint = f"/rest/api/3/project/{project_key}"
        return await self._request("GET", endpoint)
    
    async def get_fields(self) -> List[Dict[str, Any]]:
        """Get all Jira fields (including custom fields)"""
        endpoint = "/rest/api/3/field"
        return await self._request("GET", endpoint)
    
    async def search_issues(
        self,
        jql: str,
        start_at: int = 0,
        max_results: int = 100,
        expand: Optional[List[str]] = None,
        fields: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Search issues using JQL
        
        Args:
            jql: JQL query string
            start_at: Starting index for pagination
            max_results: Maximum number of results (max 100)
            expand: Fields to expand (e.g., ["changelog", "renderedFields"])
            fields: Specific fields to return
        """
        endpoint = "/rest/api/3/search"
        params = {
            "jql": jql,
            "startAt": start_at,
            "maxResults": min(max_results, 100),
        }
        
        if expand:
            params["expand"] = ",".join(expand)
        
        if fields:
            params["fields"] = ",".join(fields)
        
        return await self._request("GET", endpoint, params=params)
    
    async def get_issue(
        self,
        issue_key: str,
        expand: Optional[List[str]] = None,
        fields: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Get issue details"""
        endpoint = f"/rest/api/3/issue/{issue_key}"
        params = {}
        
        if expand:
            params["expand"] = ",".join(expand)
        
        if fields:
            params["fields"] = ",".join(fields)
        
        return await self._request("GET", endpoint, params=params if params else None)
    
    async def get_issue_changelog(self, issue_key: str) -> Dict[str, Any]:
        """Get issue changelog/history"""
        endpoint = f"/rest/api/3/issue/{issue_key}/changelog"
        return await self._request("GET", endpoint)
    
    async def get_issue_comments(self, issue_key: str) -> Dict[str, Any]:
        """Get issue comments"""
        endpoint = f"/rest/api/3/issue/{issue_key}/comment"
        return await self._request("GET", endpoint)
    
    async def get_issue_attachments(self, issue_key: str) -> List[Dict[str, Any]]:
        """Get issue attachments"""
        issue = await self.get_issue(issue_key, fields=["attachment"])
        return issue.get("fields", {}).get("attachment", [])


def create_jira_client_from_env() -> JiraClient:
    """Create JiraClient from environment variables"""
    base_url = os.getenv("JIRA_BASE_URL", "")
    if not base_url:
        raise ValueError("JIRA_BASE_URL environment variable is required")
    
    auth_type = os.getenv("JIRA_AUTH_TYPE", "api_token").lower()
    
    if auth_type == "api_token":
        email = os.getenv("JIRA_EMAIL")
        api_token = os.getenv("JIRA_API_TOKEN")
        if not email or not api_token:
            raise ValueError("JIRA_EMAIL and JIRA_API_TOKEN required for api_token auth")
        config = JiraConfig(
            base_url=base_url,
            auth_type="api_token",
            email=email,
            api_token=api_token,
        )
    elif auth_type == "basic":
        username = os.getenv("JIRA_USERNAME")
        password = os.getenv("JIRA_PASSWORD")
        if not username or not password:
            raise ValueError("JIRA_USERNAME and JIRA_PASSWORD required for basic auth")
        config = JiraConfig(
            base_url=base_url,
            auth_type="basic",
            username=username,
            password=password,
        )
    elif auth_type == "oauth2":
        oauth_token = os.getenv("JIRA_OAUTH_TOKEN")
        if not oauth_token:
            raise ValueError("JIRA_OAUTH_TOKEN required for oauth2 auth")
        config = JiraConfig(
            base_url=base_url,
            auth_type="oauth2",
            oauth_token=oauth_token,
        )
    else:
        raise ValueError(f"Unsupported JIRA_AUTH_TYPE: {auth_type}")
    
    timeout = int(os.getenv("JIRA_TIMEOUT", "30"))
    config.timeout = timeout
    
    return JiraClient(config)
