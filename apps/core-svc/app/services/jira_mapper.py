"""
Jira to LeadAI Governance Data Mapper

Maps Jira issues to LeadAI governance structures:
- Requirements (EU AI Act, ISO 42001)
- Controls
- Risks
- Tests
- Incidents
- Evidence
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4


# Issue type to LeadAI governance type mapping
ISSUE_TYPE_MAPPING = {
    "Risk": "governance.risk",
    "Requirement": "governance.requirement",
    "Control": "governance.control",
    "Test": "validation.test",
    "Incident": "monitoring.incident",
    "Change": "change.management",
    "Approval": "oversight.approval",
    "Policy": "policy.document",
}


@dataclass
class JiraIssueMapping:
    """Mapped Jira issue data for LeadAI ingestion"""
    jira_key: str
    jira_id: str
    governance_type: str  # governance.risk, governance.requirement, etc.
    project_slug: str
    title: str
    description: Optional[str]
    status: str
    priority: Optional[str]
    assignee: Optional[str]
    reporter: Optional[str]
    created_at: datetime
    updated_at: datetime
    due_date: Optional[datetime]
    resolution: Optional[str]
    resolution_date: Optional[datetime]
    labels: List[str]
    components: List[str]
    custom_fields: Dict[str, Any]
    links: List[Dict[str, str]]  # [{"type": "relates", "key": "AI-123"}]
    attachments: List[Dict[str, Any]]
    comments: List[Dict[str, Any]]
    changelog: Optional[Dict[str, Any]]
    raw_data: Dict[str, Any]  # Full Jira issue JSON


class JiraMapper:
    """Maps Jira issues to LeadAI governance structures"""
    
    def __init__(self, custom_field_mapping: Optional[Dict[str, str]] = None):
        """
        Args:
            custom_field_mapping: Map Jira custom field IDs to LeadAI field names
                e.g., {"customfield_10001": "ai_system_id"}
        """
        self.custom_field_mapping = custom_field_mapping or {}
        self._reverse_field_mapping = {v: k for k, v in self.custom_field_mapping.items()}
    
    def map_issue(self, issue: Dict[str, Any], project_slug: str) -> JiraIssueMapping:
        """Map a Jira issue to LeadAI governance structure"""
        fields = issue.get("fields", {})
        key = issue.get("key", "")
        issue_id = issue.get("id", "")
        
        # Determine governance type from issue type
        issue_type = fields.get("issuetype", {}).get("name", "")
        governance_type = ISSUE_TYPE_MAPPING.get(issue_type, "governance.other")
        
        # Extract custom fields
        custom_fields = self._extract_custom_fields(fields)
        
        # Extract timestamps
        created_at = self._parse_datetime(fields.get("created"))
        updated_at = self._parse_datetime(fields.get("updated"))
        due_date = self._parse_datetime(fields.get("duedate"))
        resolution_date = self._parse_datetime(fields.get("resolutiondate"))
        
        # Extract assignee and reporter
        assignee = fields.get("assignee", {}).get("emailAddress") or fields.get("assignee", {}).get("displayName")
        reporter = fields.get("reporter", {}).get("emailAddress") or fields.get("reporter", {}).get("displayName")
        
        # Extract links
        links = self._extract_links(issue.get("fields", {}).get("issuelinks", []))
        
        # Extract attachments
        attachments = self._extract_attachments(fields.get("attachment", []))
        
        return JiraIssueMapping(
            jira_key=key,
            jira_id=issue_id,
            governance_type=governance_type,
            project_slug=project_slug,
            title=fields.get("summary", ""),
            description=self._extract_description(fields),
            status=fields.get("status", {}).get("name", ""),
            priority=fields.get("priority", {}).get("name") if fields.get("priority") else None,
            assignee=assignee,
            reporter=reporter,
            created_at=created_at or datetime.now(),
            updated_at=updated_at or datetime.now(),
            due_date=due_date,
            resolution=fields.get("resolution", {}).get("name") if fields.get("resolution") else None,
            resolution_date=resolution_date,
            labels=fields.get("labels", []),
            components=[c.get("name", "") for c in fields.get("components", [])],
            custom_fields=custom_fields,
            links=links,
            attachments=attachments,
            comments=[],  # Will be populated separately if needed
            changelog=None,  # Will be populated separately if needed
            raw_data=issue,
        )
    
    def _extract_custom_fields(self, fields: Dict[str, Any]) -> Dict[str, Any]:
        """Extract custom fields and map to LeadAI field names"""
        custom_fields = {}
        
        # Standard custom field names from schema
        standard_mappings = {
            "customfield_AI_SYSTEM_ID": "ai_system_id",
            "customfield_AI_RISK_LEVEL": "ai_risk_level",
            "customfield_AI_STATUS": "ai_status",
            "customfield_AI_OWNER_ROLE": "ai_owner_role",
            "customfield_AI_DATA_SOURCES": "ai_data_sources",
            "customfield_AI_HUMAN_OVERSIGHT": "ai_human_oversight",
            "customfield_AI_COMPLIANCE_TAGS": "ai_compliance_tags",
            "customfield_AI_CONTROL_ID": "ai_control_id",
            "customfield_AI_TEST_RESULT": "ai_test_result",
            "customfield_AI_MODEL_VERSION": "ai_model_version",
        }
        
        for jira_field_id, leadai_field_name in standard_mappings.items():
            if jira_field_id in fields:
                value = fields[jira_field_id]
                # Handle different value types
                if isinstance(value, dict):
                    custom_fields[leadai_field_name] = value.get("value") or value.get("name") or str(value)
                elif isinstance(value, list):
                    custom_fields[leadai_field_name] = [v.get("value") or v.get("name") or str(v) if isinstance(v, dict) else v for v in value]
                else:
                    custom_fields[leadai_field_name] = value
        
        # Also check reverse mapping for any configured custom fields
        for leadai_field, jira_field_id in self._reverse_field_mapping.items():
            if jira_field_id in fields and leadai_field not in custom_fields:
                value = fields[jira_field_id]
                if isinstance(value, dict):
                    custom_fields[leadai_field] = value.get("value") or value.get("name") or str(value)
                else:
                    custom_fields[leadai_field] = value
        
        return custom_fields
    
    def _extract_description(self, fields: Dict[str, Any]) -> Optional[str]:
        """Extract description, preferring rendered if available"""
        # Try renderedFields first (if expanded)
        rendered = fields.get("renderedFields", {}).get("description")
        if rendered:
            return rendered
        
        # Fall back to plain description
        description = fields.get("description")
        if isinstance(description, dict):
            # ADF (Atlassian Document Format)
            return self._extract_text_from_adf(description)
        elif isinstance(description, str):
            return description
        
        return None
    
    def _extract_text_from_adf(self, adf: Dict[str, Any]) -> str:
        """Extract plain text from Atlassian Document Format"""
        # Simple ADF text extraction (can be enhanced)
        text_parts = []
        
        def extract_node(node: Dict[str, Any]):
            if node.get("type") == "text":
                text_parts.append(node.get("text", ""))
            if "content" in node:
                for child in node["content"]:
                    extract_node(child)
        
        if "content" in adf:
            for node in adf["content"]:
                extract_node(node)
        
        return "\n".join(text_parts)
    
    def _extract_links(self, issuelinks: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """Extract issue links"""
        links = []
        for link in issuelinks:
            link_type = link.get("type", {}).get("name", "relates")
            inward_issue = link.get("inwardIssue", {}).get("key")
            outward_issue = link.get("outwardIssue", {}).get("key")
            
            if inward_issue:
                links.append({"type": link_type, "direction": "inward", "key": inward_issue})
            if outward_issue:
                links.append({"type": link_type, "direction": "outward", "key": outward_issue})
        
        return links
    
    def _extract_attachments(self, attachments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract attachment metadata"""
        return [
            {
                "id": att.get("id"),
                "filename": att.get("filename"),
                "size": att.get("size"),
                "mime_type": att.get("mimeType"),
                "created": att.get("created"),
                "author": att.get("author", {}).get("displayName"),
                "content_url": att.get("content"),
            }
            for att in attachments
        ]
    
    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        """Parse Jira datetime string"""
        if not value:
            return None
        
        if isinstance(value, datetime):
            return value
        
        if isinstance(value, str):
            # Jira format: "2026-02-11T09:15:00.000+0000"
            try:
                # Try ISO format first
                return datetime.fromisoformat(value.replace("+0000", "+00:00"))
            except ValueError:
                try:
                    # Try without timezone
                    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%f")
                except ValueError:
                    try:
                        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S")
                    except ValueError:
                        return None
        
        return None
    
    def map_to_requirement(self, mapping: JiraIssueMapping, framework: str = "EU_AI_ACT") -> Dict[str, Any]:
        """Map Jira issue to AI requirement register entry"""
        return {
            "id": str(uuid4()),
            "project_slug": mapping.project_slug,
            "uc_id": mapping.custom_fields.get("ai_system_id"),
            "framework": framework,
            "requirement_code": mapping.jira_key,
            "title": mapping.title,
            "description": mapping.description,
            "applicability": mapping.custom_fields.get("ai_compliance_tags", []),
            "owner_role": mapping.custom_fields.get("ai_owner_role") or mapping.assignee,
            "status": self._map_status(mapping.status),
            "evidence_ids": [],  # Will be populated from attachments
            "mapped_controls": mapping.custom_fields.get("ai_control_id", []),
            "notes": f"Imported from Jira: {mapping.jira_key}",
            "created_at": mapping.created_at,
            "updated_at": mapping.updated_at,
        }
    
    def map_to_risk(self, mapping: JiraIssueMapping) -> Dict[str, Any]:
        """Map Jira issue to risk register entry"""
        return {
            "jira_key": mapping.jira_key,
            "jira_id": mapping.jira_id,
            "project_slug": mapping.project_slug,
            "title": mapping.title,
            "description": mapping.description,
            "risk_level": mapping.custom_fields.get("ai_risk_level") or mapping.priority,
            "severity": mapping.priority,
            "status": mapping.status,
            "owner": mapping.assignee,
            "due_date": mapping.due_date,
            "mitigations": [link["key"] for link in mapping.links if link["type"] == "mitigates"],
            "created_at": mapping.created_at,
            "updated_at": mapping.updated_at,
        }
    
    def map_to_evidence(self, mapping: JiraIssueMapping, control_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Map Jira attachments to evidence entries"""
        evidence_list = []
        
        for att in mapping.attachments:
            evidence_list.append({
                "project_slug": mapping.project_slug,
                "control_id": control_id,
                "name": att["filename"],
                "uri": att["content_url"],
                "status": "pending",
                "mime": att["mime_type"],
                "size_bytes": att["size"],
                "created_by": att["author"],
                "source": "jira",
                "source_key": mapping.jira_key,
                "source_attachment_id": att["id"],
            })
        
        return evidence_list
    
    def _map_status(self, jira_status: str) -> str:
        """Map Jira status to LeadAI requirement status"""
        status_mapping = {
            "To Do": "not_started",
            "In Progress": "in_progress",
            "Done": "completed",
            "Closed": "completed",
            "Resolved": "completed",
        }
        return status_mapping.get(jira_status, "not_started")
