from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Query


app = FastAPI(title="Mock Jira Server", version="1.0.0")


def _ts(days_ago: int = 0) -> str:
    dt = datetime.now(timezone.utc).replace(microsecond=0)
    return (dt).isoformat().replace("+00:00", "+0000")


PROJECTS = [
    {
        "id": "10000",
        "key": "AI",
        "name": "AI Governance Program",
        "projectTypeKey": "software",
    },
    {
        "id": "10001",
        "key": "GOV",
        "name": "Governance Operations",
        "projectTypeKey": "service_desk",
    },
]


FIELDS = [
    {"id": "summary", "name": "Summary"},
    {"id": "description", "name": "Description"},
    {"id": "issuetype", "name": "Issue Type"},
    {"id": "status", "name": "Status"},
    {"id": "priority", "name": "Priority"},
    {"id": "assignee", "name": "Assignee"},
    {"id": "reporter", "name": "Reporter"},
    {"id": "customfield_AI_SYSTEM_ID", "name": "AI System ID"},
    {"id": "customfield_AI_RISK_LEVEL", "name": "AI Risk Level"},
    {"id": "customfield_AI_STATUS", "name": "AI Status"},
    {"id": "customfield_AI_OWNER_ROLE", "name": "AI Owner Role"},
    {"id": "customfield_AI_DATA_SOURCES", "name": "AI Data Sources"},
    {"id": "customfield_AI_HUMAN_OVERSIGHT", "name": "AI Human Oversight"},
    {"id": "customfield_AI_COMPLIANCE_TAGS", "name": "AI Compliance Tags"},
    {"id": "customfield_AI_CONTROL_ID", "name": "AI Control ID"},
    {"id": "customfield_AI_TEST_RESULT", "name": "AI Test Result"},
    {"id": "customfield_AI_MODEL_VERSION", "name": "AI Model Version"},
]


ISSUES: List[Dict[str, Any]] = [
    {
        "id": "20001",
        "key": "AI-101",
        "fields": {
            "summary": "EU AI Act: Human Oversight Plan",
            "description": "Define human oversight procedures for AI decision-making.",
            "issuetype": {"name": "Requirement"},
            "status": {"name": "In Progress"},
            "priority": {"name": "High"},
            "assignee": {"displayName": "Ayla Deniz", "emailAddress": "ayla@leadai.co.uk"},
            "reporter": {"displayName": "Hakan Taskin", "emailAddress": "hakan@leadai.co.uk"},
            "created": _ts(20),
            "updated": _ts(1),
            "duedate": _ts(10),
            "resolution": None,
            "resolutiondate": None,
            "labels": ["eu-ai-act", "oversight"],
            "components": [{"name": "Governance"}],
            "issuelinks": [
                {
                    "type": {"name": "relates"},
                    "outwardIssue": {"key": "AI-102"},
                }
            ],
            "attachment": [
                {
                    "id": "90001",
                    "filename": "oversight-plan.pdf",
                    "size": 48211,
                    "mimeType": "application/pdf",
                    "created": _ts(5),
                    "author": {"displayName": "Ayla Deniz"},
                    "content": "http://mock-jira:8080/attachments/90001",
                }
            ],
            "customfield_AI_SYSTEM_ID": "ai-doc-processor",
            "customfield_AI_RISK_LEVEL": {"value": "high"},
            "customfield_AI_STATUS": {"value": "active"},
            "customfield_AI_OWNER_ROLE": {"value": "Product Manager"},
            "customfield_AI_DATA_SOURCES": ["customer-contracts", "ocr-corpus"],
            "customfield_AI_HUMAN_OVERSIGHT": "approval_workflow_v2",
            "customfield_AI_COMPLIANCE_TAGS": ["EU_AI_ACT", "ISO42001"],
            "customfield_AI_CONTROL_ID": "HCR-01",
            "customfield_AI_TEST_RESULT": "pending",
            "customfield_AI_MODEL_VERSION": "v2.3.1",
        },
    },
    {
        "id": "20002",
        "key": "AI-102",
        "fields": {
            "summary": "Risk: Monitoring gaps for model drift",
            "description": "Model drift monitoring is insufficient for production workload.",
            "issuetype": {"name": "Risk"},
            "status": {"name": "Open"},
            "priority": {"name": "Critical"},
            "assignee": {"displayName": "Ece Kaya", "emailAddress": "ece@leadai.co.uk"},
            "reporter": {"displayName": "Hakan Taskin", "emailAddress": "hakan@leadai.co.uk"},
            "created": _ts(15),
            "updated": _ts(2),
            "duedate": _ts(7),
            "resolution": None,
            "resolutiondate": None,
            "labels": ["risk", "monitoring"],
            "components": [{"name": "Monitoring"}],
            "issuelinks": [
                {
                    "type": {"name": "relates"},
                    "inwardIssue": {"key": "AI-101"},
                }
            ],
            "attachment": [],
            "customfield_AI_SYSTEM_ID": "ai-doc-processor",
            "customfield_AI_RISK_LEVEL": {"value": "critical"},
            "customfield_AI_STATUS": {"value": "active"},
            "customfield_AI_OWNER_ROLE": {"value": "Engineering Lead"},
            "customfield_AI_DATA_SOURCES": ["kpi-telemetry"],
            "customfield_AI_HUMAN_OVERSIGHT": "incident-response",
            "customfield_AI_COMPLIANCE_TAGS": ["NIST_AI_RMF"],
            "customfield_AI_CONTROL_ID": "MON-02",
            "customfield_AI_TEST_RESULT": "fail",
            "customfield_AI_MODEL_VERSION": "v2.3.1",
        },
    },
    {
        "id": "20003",
        "key": "GOV-201",
        "fields": {
            "summary": "Control: KPI evidence capture workflow",
            "description": "Ensure evidence capture process for governance KPIs is documented.",
            "issuetype": {"name": "Control"},
            "status": {"name": "Done"},
            "priority": {"name": "Medium"},
            "assignee": {"displayName": "Deniz Aksoy", "emailAddress": "deniz@leadai.co.uk"},
            "reporter": {"displayName": "Hakan Taskin", "emailAddress": "hakan@leadai.co.uk"},
            "created": _ts(40),
            "updated": _ts(4),
            "duedate": _ts(20),
            "resolution": {"name": "Done"},
            "resolutiondate": _ts(3),
            "labels": ["control", "evidence"],
            "components": [{"name": "Evidence Vault"}],
            "issuelinks": [],
            "attachment": [
                {
                    "id": "90002",
                    "filename": "evidence-workflow.png",
                    "size": 24510,
                    "mimeType": "image/png",
                    "created": _ts(18),
                    "author": {"displayName": "Deniz Aksoy"},
                    "content": "http://mock-jira:8080/attachments/90002",
                }
            ],
            "customfield_AI_SYSTEM_ID": "ai-doc-processor",
            "customfield_AI_RISK_LEVEL": {"value": "medium"},
            "customfield_AI_STATUS": {"value": "active"},
            "customfield_AI_OWNER_ROLE": {"value": "Compliance Lead"},
            "customfield_AI_DATA_SOURCES": ["kpi-register"],
            "customfield_AI_HUMAN_OVERSIGHT": "quarterly-review",
            "customfield_AI_COMPLIANCE_TAGS": ["ISO42001"],
            "customfield_AI_CONTROL_ID": "EVID-01",
            "customfield_AI_TEST_RESULT": "pass",
            "customfield_AI_MODEL_VERSION": "v2.3.1",
        },
    },
    {
        "id": "20004",
        "key": "AI-103",
        "fields": {
            "summary": "Test: Bias evaluation run",
            "description": "Execute fairness evaluation on document processing pipeline.",
            "issuetype": {"name": "Test"},
            "status": {"name": "In Review"},
            "priority": {"name": "High"},
            "assignee": {"displayName": "Selin Arslan", "emailAddress": "selin@leadai.co.uk"},
            "reporter": {"displayName": "Ayla Deniz", "emailAddress": "ayla@leadai.co.uk"},
            "created": _ts(12),
            "updated": _ts(1),
            "duedate": _ts(5),
            "resolution": None,
            "resolutiondate": None,
            "labels": ["test", "fairness"],
            "components": [{"name": "Validation"}],
            "issuelinks": [],
            "attachment": [],
            "customfield_AI_SYSTEM_ID": "ai-doc-processor",
            "customfield_AI_RISK_LEVEL": {"value": "medium"},
            "customfield_AI_STATUS": {"value": "active"},
            "customfield_AI_OWNER_ROLE": {"value": "QA Lead"},
            "customfield_AI_DATA_SOURCES": ["bias-test-suite"],
            "customfield_AI_HUMAN_OVERSIGHT": "qa-review",
            "customfield_AI_COMPLIANCE_TAGS": ["EU_AI_ACT"],
            "customfield_AI_CONTROL_ID": "VAL-04",
            "customfield_AI_TEST_RESULT": "pending",
            "customfield_AI_MODEL_VERSION": "v2.3.1",
        },
    },
]


def _filter_issues_by_project_keys(jql: Optional[str]) -> List[Dict[str, Any]]:
    if not jql:
        return ISSUES
    jql = jql.strip()
    project_keys: List[str] = []
    match = re.search(r"project\\s+in\\s*\\(([^)]*)\\)", jql, re.IGNORECASE)
    if match:
        project_keys = [k.strip() for k in match.group(1).split(",") if k.strip()]
    else:
        match = re.search(r"project\\s*=\\s*([A-Za-z0-9_-]+)", jql, re.IGNORECASE)
        if match:
            project_keys = [match.group(1)]

    if not project_keys:
        return ISSUES

    prefixes = tuple(f"{k}-" for k in project_keys)
    return [issue for issue in ISSUES if issue.get("key", "").startswith(prefixes)]


@app.get("/rest/api/3/project")
def list_projects() -> List[Dict[str, Any]]:
    return PROJECTS


@app.get("/rest/api/3/project/{project_key}")
def get_project(project_key: str) -> Dict[str, Any]:
    for proj in PROJECTS:
        if proj["key"].lower() == project_key.lower():
            return proj
    return {"id": "0", "key": project_key, "name": f"{project_key} Project", "projectTypeKey": "software"}


@app.get("/rest/api/3/field")
def list_fields() -> List[Dict[str, Any]]:
    return FIELDS


@app.get("/rest/api/3/search")
def search_issues(
    jql: Optional[str] = None,
    startAt: int = Query(0, ge=0),
    maxResults: int = Query(50, ge=1, le=100),
) -> Dict[str, Any]:
    filtered = _filter_issues_by_project_keys(jql)
    total = len(filtered)
    issues = filtered[startAt : startAt + maxResults]
    return {
        "startAt": startAt,
        "maxResults": maxResults,
        "total": total,
        "issues": issues,
    }


@app.get("/rest/api/3/issue/{issue_key}")
def get_issue(issue_key: str) -> Dict[str, Any]:
    for issue in ISSUES:
        if issue["key"].lower() == issue_key.lower():
            return issue
    return {"id": "0", "key": issue_key, "fields": {"summary": "Unknown issue", "issuetype": {"name": "Task"}}}


@app.get("/rest/api/3/issue/{issue_key}/changelog")
def get_issue_changelog(issue_key: str) -> Dict[str, Any]:
    return {
        "startAt": 0,
        "maxResults": 2,
        "total": 2,
        "values": [
            {
                "id": "1",
                "created": _ts(5),
                "author": {"displayName": "System"},
                "items": [{"field": "status", "fromString": "Open", "toString": "In Progress"}],
            },
            {
                "id": "2",
                "created": _ts(2),
                "author": {"displayName": "Reviewer"},
                "items": [{"field": "priority", "fromString": "Medium", "toString": "High"}],
            },
        ],
    }


@app.get("/rest/api/3/issue/{issue_key}/comment")
def get_issue_comments(issue_key: str) -> Dict[str, Any]:
    return {
        "startAt": 0,
        "maxResults": 2,
        "total": 2,
        "comments": [
            {
                "id": "5001",
                "author": {"displayName": "Hakan Taskin"},
                "body": "Please ensure evidence is attached before closure.",
                "created": _ts(3),
            },
            {
                "id": "5002",
                "author": {"displayName": "Ayla Deniz"},
                "body": "Evidence uploaded to the vault.",
                "created": _ts(1),
            },
        ],
    }


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "service": "mock-jira"}
