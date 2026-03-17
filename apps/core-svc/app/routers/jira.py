"""
Jira Integration Router for LeadAI Governance Evidence

Endpoints for syncing Jira issues as governance evidence for EU AI Act and ISO 42001.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4, UUID

import asyncpg
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

from app.db_async import get_pool
from app.services.jira_client import JiraClient, create_jira_client_from_env, JiraAuthError, JiraAPIError
from app.services.jira_mapper import JiraMapper, JiraIssueMapping
from app.services.audit_log import append_audit_event
from app.dependencies import (
    get_entity_id_with_auth_viewer,
    get_entity_id_with_auth_editor,
)


router = APIRouter(prefix="/admin/jira", tags=["jira-integration"])


# Pydantic models for request/response
class JiraConfigRequest(BaseModel):
    """Jira configuration for manual setup"""
    base_url: str = Field(..., description="Jira base URL (e.g., https://yourcompany.atlassian.net)")
    auth_type: str = Field("api_token", description="Authentication type: api_token, basic, oauth2")
    email: Optional[str] = Field(None, description="Email for API token auth")
    api_token: Optional[str] = Field(None, description="API token for Jira Cloud")
    username: Optional[str] = Field(None, description="Username for basic auth")
    password: Optional[str] = Field(None, description="Password for basic auth")
    oauth_token: Optional[str] = Field(None, description="OAuth2 bearer token")
    timeout: int = Field(30, description="Request timeout in seconds")


class JiraSyncRequest(BaseModel):
    """Request to sync Jira issues"""
    project_slug: str = Field(..., description="LeadAI project slug")
    jira_project_keys: List[str] = Field(..., description="Jira project keys to sync (e.g., ['AI', 'GOV'])")
    jql: Optional[str] = Field(None, description="Optional JQL query to filter issues")
    issue_types: Optional[List[str]] = Field(None, description="Filter by issue types (Risk, Requirement, Control, etc.)")
    sync_attachments: bool = Field(True, description="Whether to sync attachments as evidence")
    sync_comments: bool = Field(False, description="Whether to sync comments")
    sync_changelog: bool = Field(False, description="Whether to sync changelog/history")
    framework: str = Field("EU_AI_ACT", description="Framework for requirements (EU_AI_ACT or ISO_42001)")


class JiraSearchRequest(BaseModel):
    """Request to search Jira issues"""
    jql: str = Field(..., description="JQL query string")
    start_at: int = Field(0, description="Starting index for pagination")
    max_results: int = Field(50, ge=1, le=100, description="Maximum results (1-100)")


class JiraSyncResponse(BaseModel):
    """Response from sync operation"""
    success: bool
    issues_synced: int
    requirements_created: int
    risks_created: int
    evidence_created: int
    errors: List[str]
    warnings: List[str]


async def get_jira_client() -> JiraClient:
    """Dependency to get Jira client from env or raise error"""
    try:
        return create_jira_client_from_env()
    except (ValueError, JiraAuthError) as e:
        raise HTTPException(status_code=400, detail=f"Jira configuration error: {str(e)}")


@router.get("/config")
async def get_jira_config() -> Dict[str, Any]:
    """Get current Jira configuration (masked)"""
    base_url = os.getenv("JIRA_BASE_URL", "")
    auth_type = os.getenv("JIRA_AUTH_TYPE", "api_token")
    
    config = {
        "base_url": base_url,
        "auth_type": auth_type,
        "configured": bool(base_url),
    }
    
    # Don't expose sensitive credentials
    if auth_type == "api_token":
        config["email"] = os.getenv("JIRA_EMAIL", "").split("@")[0] + "@***" if os.getenv("JIRA_EMAIL") else None
        config["api_token_configured"] = bool(os.getenv("JIRA_API_TOKEN"))
    elif auth_type == "basic":
        config["username"] = os.getenv("JIRA_USERNAME", "").split("@")[0] + "***" if os.getenv("JIRA_USERNAME") else None
        config["password_configured"] = bool(os.getenv("JIRA_PASSWORD"))
    elif auth_type == "oauth2":
        config["oauth_token_configured"] = bool(os.getenv("JIRA_OAUTH_TOKEN"))
    
    return config


@router.post("/config/test")
async def test_jira_connection(config: Optional[JiraConfigRequest] = None) -> Dict[str, Any]:
    """Test Jira connection with provided config or environment config"""
    try:
        if config:
            from app.services.jira_client import JiraConfig
            jira_config = JiraConfig(
                base_url=config.base_url,
                auth_type=config.auth_type,
                email=config.email,
                api_token=config.api_token,
                username=config.username,
                password=config.password,
                oauth_token=config.oauth_token,
                timeout=config.timeout,
            )
            client = JiraClient(jira_config)
        else:
            client = create_jira_client_from_env()
        
        # Test connection by fetching projects
        projects = await client.get_projects()
        
        return {
            "success": True,
            "message": "Connection successful",
            "projects_count": len(projects) if isinstance(projects, list) else 0,
            "projects": [
                {"key": p.get("key"), "name": p.get("name")}
                for p in (projects[:5] if isinstance(projects, list) else [])
            ],
        }
    except JiraAuthError as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
    except JiraAPIError as e:
        raise HTTPException(status_code=502, detail=f"Jira API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection test failed: {str(e)}")


@router.get("/projects")
async def list_jira_projects(client: JiraClient = Depends(get_jira_client)) -> List[Dict[str, Any]]:
    """List available Jira projects"""
    try:
        projects = await client.get_projects()
        return [
            {
                "key": p.get("key"),
                "name": p.get("name"),
                "project_type": p.get("projectTypeKey"),
                "id": p.get("id"),
            }
            for p in (projects if isinstance(projects, list) else [])
        ]
    except JiraAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/fields")
async def list_jira_fields(client: JiraClient = Depends(get_jira_client)) -> List[Dict[str, Any]]:
    """List all Jira fields (including custom fields)"""
    try:
        fields = await client.get_fields()
        return [
            {
                "id": f.get("id"),
                "name": f.get("name"),
                "custom": f.get("custom", False),
                "type": f.get("schema", {}).get("type") if f.get("schema") else None,
            }
            for f in (fields if isinstance(fields, list) else [])
        ]
    except JiraAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/search")
async def search_jira_issues(
    request: JiraSearchRequest,
    client: JiraClient = Depends(get_jira_client),
) -> Dict[str, Any]:
    """Search Jira issues using JQL"""
    try:
        result = await client.search_issues(
            jql=request.jql,
            start_at=request.start_at,
            max_results=request.max_results,
            expand=["changelog", "renderedFields"],
        )
        
        return {
            "total": result.get("total", 0),
            "start_at": result.get("startAt", 0),
            "max_results": result.get("maxResults", 0),
            "issues": [
                {
                    "key": issue.get("key"),
                    "id": issue.get("id"),
                    "summary": issue.get("fields", {}).get("summary"),
                    "status": issue.get("fields", {}).get("status", {}).get("name"),
                    "issue_type": issue.get("fields", {}).get("issuetype", {}).get("name"),
                    "priority": issue.get("fields", {}).get("priority", {}).get("name") if issue.get("fields", {}).get("priority") else None,
                    "assignee": issue.get("fields", {}).get("assignee", {}).get("displayName") if issue.get("fields", {}).get("assignee") else None,
                    "created": issue.get("fields", {}).get("created"),
                    "updated": issue.get("fields", {}).get("updated"),
                }
                for issue in result.get("issues", [])
            ],
        }
    except JiraAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/sync")
async def sync_jira_issues(
    request: JiraSyncRequest,
    client: JiraClient = Depends(get_jira_client),
    entity_id: UUID = Depends(get_entity_id_with_auth_editor),
) -> JiraSyncResponse:
    """
    Sync Jira issues to LeadAI governance structures
    
    This endpoint:
    1. Fetches issues from Jira based on project keys and optional JQL
    2. Maps issues to governance types (requirements, risks, controls, tests)
    3. Creates/updates records in LeadAI database
    4. Links attachments as evidence
    """
    pool = await get_pool()
    mapper = JiraMapper()
    
    errors = []
    warnings = []
    issues_synced = 0
    requirements_created = 0
    risks_created = 0
    evidence_created = 0
    
    try:
        # Build JQL query
        jql_parts = []
        if request.jira_project_keys:
            jql_parts.append(f"project in ({','.join(request.jira_project_keys)})")
        
        if request.issue_types:
            type_filter = " OR ".join([f'issuetype = "{t}"' for t in request.issue_types])
            jql_parts.append(f"({type_filter})")
        
        if request.jql:
            jql_parts.append(f"({request.jql})")
        
        jql = " AND ".join(jql_parts)
        
        # Fetch issues
        expand_fields = ["renderedFields"]
        if request.sync_changelog:
            expand_fields.append("changelog")
        
        all_issues = []
        start_at = 0
        max_results = 100
        
        while True:
            result = await client.search_issues(
                jql=jql,
                start_at=start_at,
                max_results=max_results,
                expand=expand_fields,
            )
            
            issues = result.get("issues", [])
            if not issues:
                break
            
            all_issues.extend(issues)
            
            if len(issues) < max_results:
                break
            
            start_at += max_results
        
        # Process each issue
        async with pool.acquire() as conn:
            # Verify project belongs to entity (entity_id is already validated by authorization)
            proj_check = await conn.fetchrow(
                "SELECT id FROM entity_projects WHERE slug = $1 AND entity_id = $2",
                request.project_slug, entity_id
            )
            if not proj_check:
                raise HTTPException(
                    status_code=403,
                    detail=f"Project '{request.project_slug}' does not belong to entity {entity_id}"
                )
            
            for issue in all_issues:
                try:
                    mapping = mapper.map_issue(issue, request.project_slug)
                    issues_synced += 1
                    
                    # Map based on governance type
                    if mapping.governance_type == "governance.requirement":
                        req_data = mapper.map_to_requirement(mapping, request.framework)
                        await _upsert_requirement(conn, req_data, entity_id)
                        requirements_created += 1
                        
                        # Get control_id from custom fields if available
                        control_id = mapping.custom_fields.get("ai_control_id")
                        if isinstance(control_id, list) and control_id:
                            control_id = control_id[0]
                        
                        # Sync attachments as evidence if requested
                        if request.sync_attachments and mapping.attachments:
                            evidence_list = mapper.map_to_evidence(mapping, control_id)
                            for ev in evidence_list:
                                await _create_evidence(conn, ev, control_id, entity_id)
                                evidence_created += 1
                    
                    elif mapping.governance_type == "governance.risk":
                        risk_data = mapper.map_to_risk(mapping)
                        await _upsert_risk(conn, risk_data, entity_id)
                        risks_created += 1
                    
                    # Store sync metadata
                    await _store_sync_metadata(conn, mapping, entity_id)
                    
                except Exception as e:
                    error_msg = f"Error processing issue {issue.get('key', 'unknown')}: {str(e)}"
                    errors.append(error_msg)
                    warnings.append(error_msg)
            
            # Log audit event
            await append_audit_event(
                event_type="jira_sync_completed",
                actor="system",
                source_service="core-svc",
                object_type="jira_sync",
                project_slug=request.project_slug,
                details={
                    "jira_projects": request.jira_project_keys,
                    "issues_synced": issues_synced,
                    "requirements_created": requirements_created,
                    "risks_created": risks_created,
                    "evidence_created": evidence_created,
                },
            )
        
        return JiraSyncResponse(
            success=len(errors) == 0,
            issues_synced=issues_synced,
            requirements_created=requirements_created,
            risks_created=risks_created,
            evidence_created=evidence_created,
            errors=errors,
            warnings=warnings,
        )
    
    except JiraAPIError as e:
        raise HTTPException(status_code=502, detail=f"Jira API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


async def _upsert_requirement(conn: asyncpg.Connection, req_data: Dict[str, Any], entity_id: UUID) -> None:
    """Upsert requirement in AI requirement register"""
    await conn.execute(
        """
        INSERT INTO ai_requirement_register (
            id, entity_id, project_slug, uc_id, framework, requirement_code, title,
            description, applicability, owner_role, status, evidence_ids,
            mapped_controls, notes, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16)
        ON CONFLICT (entity_id, requirement_code, project_slug) 
        DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            owner_role = EXCLUDED.owner_role,
            updated_at = EXCLUDED.updated_at,
            notes = EXCLUDED.notes
        """,
        req_data["id"],
        entity_id,
        req_data["project_slug"],
        req_data["uc_id"],
        req_data["framework"],
        req_data["requirement_code"],
        req_data["title"],
        req_data["description"],
        req_data["applicability"],
        req_data["owner_role"],
        req_data["status"],
        req_data["evidence_ids"],
        req_data["mapped_controls"],
        req_data["notes"],
        req_data["created_at"],
        req_data["updated_at"],
    )


async def _upsert_risk(conn: asyncpg.Connection, risk_data: Dict[str, Any], entity_id: UUID) -> None:
    """Upsert risk in Jira risk register"""
    await conn.execute(
        """
        INSERT INTO jira_risk_register (
            id, entity_id, project_slug, jira_key, jira_id, title, description,
            risk_level, severity, status, owner, due_date, mitigations,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (entity_id, jira_key) 
        DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            risk_level = EXCLUDED.risk_level,
            severity = EXCLUDED.severity,
            status = EXCLUDED.status,
            owner = EXCLUDED.owner,
            due_date = EXCLUDED.due_date,
            mitigations = EXCLUDED.mitigations,
            updated_at = EXCLUDED.updated_at
        """,
        str(uuid4()),
        entity_id,
        risk_data["project_slug"],
        risk_data["jira_key"],
        risk_data["jira_id"],
        risk_data["title"],
        risk_data["description"],
        risk_data["risk_level"],
        risk_data["severity"],
        risk_data["status"],
        risk_data["owner"],
        risk_data["due_date"],
        risk_data["mitigations"],
        risk_data["created_at"],
        risk_data["updated_at"],
    )


async def _create_evidence(conn: asyncpg.Connection, ev_data: Dict[str, Any], control_id: Optional[str], entity_id: UUID) -> int:
    """Create evidence entry from Jira attachment"""
    evidence_id = await conn.fetchval(
        """
        INSERT INTO evidence (
            entity_id, project_slug, control_id, name, uri, status, mime, size_bytes,
            created_by, jira_key, jira_attachment_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        """,
        entity_id,
        ev_data["project_slug"],
        control_id,
        ev_data["name"],
        ev_data["uri"],
        ev_data.get("status", "pending"),
        ev_data.get("mime"),
        ev_data.get("size_bytes"),
        ev_data.get("created_by"),
        ev_data.get("source_key"),
        ev_data.get("source_attachment_id"),
    )
    return evidence_id


async def _store_sync_metadata(conn: asyncpg.Connection, mapping: JiraIssueMapping, entity_id: UUID) -> None:
    """Store Jira sync metadata for traceability"""
    import json
    
    await conn.execute(
        """
        INSERT INTO jira_sync_metadata (
            id, entity_id, project_slug, jira_key, jira_id, governance_type, issue_type,
            status, sync_count, raw_data, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, $11)
        ON CONFLICT (entity_id, jira_key) 
        DO UPDATE SET
            status = EXCLUDED.status,
            sync_count = jira_sync_metadata.sync_count + 1,
            last_synced_at = EXCLUDED.updated_at,
            updated_at = EXCLUDED.updated_at,
            raw_data = EXCLUDED.raw_data
        """,
        str(uuid4()),
        entity_id,
        mapping.project_slug,
        mapping.jira_key,
        mapping.jira_id,
        mapping.governance_type,
        mapping.raw_data.get("fields", {}).get("issuetype", {}).get("name"),
        mapping.status,
        json.dumps(mapping.raw_data),
        mapping.created_at,
        mapping.updated_at,
    )


@router.get("/sync/status/{project_slug}")
async def get_sync_status(
    project_slug: str,
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
) -> Dict[str, Any]:
    """Get sync status for a project. Requires viewer role or higher."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Verify project belongs to entity
        proj_check = await conn.fetchrow(
            "SELECT id FROM entity_projects WHERE slug = $1 AND entity_id = $2",
            project_slug, entity_id
        )
        if not proj_check:
            raise HTTPException(
                status_code=404,
                detail=f"Project '{project_slug}' not found or does not belong to entity"
            )
        
        # Get latest sync info
        latest_sync = await conn.fetchrow(
            """
            SELECT 
                MAX(last_synced_at) as last_sync,
                COUNT(*) as issues_synced,
                COUNT(DISTINCT governance_type) as governance_types_count
            FROM jira_sync_metadata
            WHERE project_slug = $1 AND entity_id = $2
            """,
            project_slug, entity_id,
        )
        
        if latest_sync and latest_sync["last_sync"]:
            return {
                "project_slug": project_slug,
                "last_sync": latest_sync["last_sync"].isoformat() if latest_sync["last_sync"] else None,
                "issues_synced": latest_sync["issues_synced"] or 0,
                "governance_types_count": latest_sync["governance_types_count"] or 0,
                "status": "synced",
            }
        else:
            return {
                "project_slug": project_slug,
                "last_sync": None,
                "issues_synced": 0,
                "governance_types_count": 0,
                "status": "not_synced",
            }
