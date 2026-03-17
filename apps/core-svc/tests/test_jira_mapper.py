"""
Jira Mapper Tests

Tests for mapping Jira issues to LeadAI governance structures including
requirements, risks, controls, and evidence.
"""

import pytest
from datetime import datetime
from uuid import UUID

from app.services.jira_mapper import (
    JiraMapper,
    JiraIssueMapping,
    ISSUE_TYPE_MAPPING,
)


# --- FIXTURES ---

@pytest.fixture
def sample_jira_issue():
    """Sample Jira issue JSON"""
    return {
        "key": "AI-123",
        "id": "10001",
        "fields": {
            "summary": "Test Requirement",
            "description": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "This is a test requirement"}],
                    }
                ],
            },
            "issuetype": {"name": "Requirement"},
            "status": {"name": "In Progress"},
            "priority": {"name": "High"},
            "assignee": {"displayName": "John Doe", "emailAddress": "john@example.com"},
            "reporter": {"displayName": "Jane Smith", "emailAddress": "jane@example.com"},
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-15T14:30:00.000+0000",
            "duedate": "2026-02-01",
            "resolution": {"name": "Fixed"},
            "resolutiondate": "2026-01-20T12:00:00.000+0000",
            "labels": ["eu-ai-act", "high-risk"],
            "components": [{"name": "Governance"}, {"name": "Compliance"}],
            "issuelinks": [
                {
                    "type": {"name": "relates"},
                    "outwardIssue": {"key": "AI-124"},
                },
                {
                    "type": {"name": "mitigates"},
                    "inwardIssue": {"key": "AI-125"},
                },
            ],
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
            "customfield_AI_RISK_LEVEL": "High",
            "customfield_AI_OWNER_ROLE": "Data Protection Officer",
            "customfield_AI_COMPLIANCE_TAGS": ["EU_AI_ACT", "ISO_42001"],
            "customfield_AI_CONTROL_ID": ["CTRL-001", "CTRL-002"],
        },
    }


@pytest.fixture
def sample_jira_issue_risk():
    """Sample Jira issue for Risk type"""
    return {
        "key": "RISK-456",
        "id": "10002",
        "fields": {
            "summary": "Data Privacy Risk",
            "description": "Risk of data leakage",
            "issuetype": {"name": "Risk"},
            "status": {"name": "Open"},
            "priority": {"name": "Critical"},
            "assignee": {"displayName": "Risk Manager"},
            "reporter": {"displayName": "Security Team"},
            "created": "2026-01-05T09:00:00.000+0000",
            "updated": "2026-01-10T10:00:00.000+0000",
            "labels": ["privacy", "data-protection"],
            "components": [],
            "issuelinks": [],
            "attachment": [],
            "customfield_AI_RISK_LEVEL": "Critical",
        },
    }


@pytest.fixture
def mapper():
    """JiraMapper instance"""
    return JiraMapper()


@pytest.fixture
def mapper_with_custom_fields():
    """JiraMapper with custom field mapping"""
    return JiraMapper(
        custom_field_mapping={"customfield_99999": "custom_field"}
    )


# --- ISSUE MAPPING TESTS ---

def test_map_issue_basic(mapper, sample_jira_issue):
    """Test basic issue mapping"""
    mapping = mapper.map_issue(sample_jira_issue, "test-project")
    
    assert mapping.jira_key == "AI-123"
    assert mapping.jira_id == "10001"
    assert mapping.governance_type == "governance.requirement"
    assert mapping.project_slug == "test-project"
    assert mapping.title == "Test Requirement"
    assert mapping.status == "In Progress"
    assert mapping.priority == "High"
    assert mapping.assignee == "john@example.com"
    assert mapping.reporter == "jane@example.com"
    assert isinstance(mapping.created_at, datetime)
    assert isinstance(mapping.updated_at, datetime)
    assert len(mapping.labels) == 2
    assert len(mapping.components) == 2


def test_map_issue_governance_type_mapping(mapper, sample_jira_issue_risk):
    """Test governance type mapping based on issue type"""
    mapping = mapper.map_issue(sample_jira_issue_risk, "test-project")
    
    assert mapping.governance_type == "governance.risk"


def test_map_issue_unknown_type(mapper):
    """Test mapping of unknown issue type"""
    issue = {
        "key": "TEST-1",
        "id": "10000",
        "fields": {
            "summary": "Test",
            "issuetype": {"name": "UnknownType"},
            "status": {"name": "Open"},
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-01T10:00:00.000+0000",
        },
    }
    
    mapping = mapper.map_issue(issue, "test-project")
    
    assert mapping.governance_type == "governance.other"


def test_map_issue_all_governance_types(mapper):
    """Test all issue type mappings"""
    for issue_type, expected_governance_type in ISSUE_TYPE_MAPPING.items():
        issue = {
            "key": "TEST-1",
            "id": "10000",
            "fields": {
                "summary": "Test",
                "issuetype": {"name": issue_type},
                "status": {"name": "Open"},
                "created": "2026-01-01T10:00:00.000+0000",
                "updated": "2026-01-01T10:00:00.000+0000",
            },
        }
        
        mapping = mapper.map_issue(issue, "test-project")
        assert mapping.governance_type == expected_governance_type


def test_map_issue_description_adf(mapper, sample_jira_issue):
    """Test ADF description extraction"""
    mapping = mapper.map_issue(sample_jira_issue, "test-project")
    
    assert "test requirement" in mapping.description.lower()


def test_map_issue_description_string(mapper):
    """Test string description extraction"""
    issue = {
        "key": "TEST-1",
        "id": "10000",
        "fields": {
            "summary": "Test",
            "description": "Plain text description",
            "issuetype": {"name": "Requirement"},
            "status": {"name": "Open"},
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-01T10:00:00.000+0000",
        },
    }
    
    mapping = mapper.map_issue(issue, "test-project")
    
    assert mapping.description == "Plain text description"


def test_map_issue_no_description(mapper):
    """Test issue with no description"""
    issue = {
        "key": "TEST-1",
        "id": "10000",
        "fields": {
            "summary": "Test",
            "issuetype": {"name": "Requirement"},
            "status": {"name": "Open"},
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-01T10:00:00.000+0000",
        },
    }
    
    mapping = mapper.map_issue(issue, "test-project")
    
    assert mapping.description is None


def test_map_issue_datetime_parsing(mapper, sample_jira_issue):
    """Test datetime parsing from Jira format"""
    mapping = mapper.map_issue(sample_jira_issue, "test-project")
    
    assert mapping.created_at.year == 2026
    assert mapping.created_at.month == 1
    assert mapping.created_at.day == 1
    assert mapping.due_date.year == 2026
    assert mapping.due_date.month == 2
    assert mapping.due_date.day == 1


def test_map_issue_datetime_invalid(mapper):
    """Test handling of invalid datetime"""
    issue = {
        "key": "TEST-1",
        "id": "10000",
        "fields": {
            "summary": "Test",
            "issuetype": {"name": "Requirement"},
            "status": {"name": "Open"},
            "created": "invalid-date",
            "updated": "invalid-date",
        },
    }
    
    mapping = mapper.map_issue(issue, "test-project")
    
    # Should fall back to current datetime
    assert isinstance(mapping.created_at, datetime)
    assert isinstance(mapping.updated_at, datetime)


def test_map_issue_links_extraction(mapper, sample_jira_issue):
    """Test issue links extraction"""
    mapping = mapper.map_issue(sample_jira_issue, "test-project")
    
    assert len(mapping.links) == 2
    assert any(link["key"] == "AI-124" for link in mapping.links)
    assert any(link["key"] == "AI-125" for link in mapping.links)


def test_map_issue_attachments_extraction(mapper, sample_jira_issue):
    """Test attachments extraction"""
    mapping = mapper.map_issue(sample_jira_issue, "test-project")
    
    assert len(mapping.attachments) == 1
    assert mapping.attachments[0]["filename"] == "evidence.pdf"
    assert mapping.attachments[0]["id"] == "10000"
    assert mapping.attachments[0]["size"] == 1024
    assert mapping.attachments[0]["mime_type"] == "application/pdf"


def test_map_issue_no_assignee(mapper):
    """Test issue with no assignee"""
    issue = {
        "key": "TEST-1",
        "id": "10000",
        "fields": {
            "summary": "Test",
            "issuetype": {"name": "Requirement"},
            "status": {"name": "Open"},
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-01T10:00:00.000+0000",
        },
    }
    
    mapping = mapper.map_issue(issue, "test-project")
    
    assert mapping.assignee is None


def test_map_issue_assignee_display_name_fallback(mapper):
    """Test assignee fallback to displayName"""
    issue = {
        "key": "TEST-1",
        "id": "10000",
        "fields": {
            "summary": "Test",
            "issuetype": {"name": "Requirement"},
            "status": {"name": "Open"},
            "assignee": {"displayName": "John Doe"},
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-01T10:00:00.000+0000",
        },
    }
    
    mapping = mapper.map_issue(issue, "test-project")
    
    assert mapping.assignee == "John Doe"


# --- CUSTOM FIELD EXTRACTION TESTS ---

def test_extract_custom_fields_standard(mapper, sample_jira_issue):
    """Test extraction of standard custom fields"""
    mapping = mapper.map_issue(sample_jira_issue, "test-project")
    
    assert mapping.custom_fields["ai_system_id"] == "system-001"
    assert mapping.custom_fields["ai_risk_level"] == "High"
    assert mapping.custom_fields["ai_owner_role"] == "Data Protection Officer"
    assert mapping.custom_fields["ai_compliance_tags"] == ["EU_AI_ACT", "ISO_42001"]
    assert mapping.custom_fields["ai_control_id"] == ["CTRL-001", "CTRL-002"]


def test_extract_custom_fields_dict_value(mapper):
    """Test custom field with dict value"""
    issue = {
        "key": "TEST-1",
        "id": "10000",
        "fields": {
            "summary": "Test",
            "issuetype": {"name": "Requirement"},
            "status": {"name": "Open"},
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-01T10:00:00.000+0000",
            "customfield_AI_SYSTEM_ID": {"value": "system-002"},
        },
    }
    
    mapping = mapper.map_issue(issue, "test-project")
    
    assert mapping.custom_fields["ai_system_id"] == "system-002"


def test_extract_custom_fields_custom_mapping(mapper_with_custom_fields):
    """Test custom field mapping"""
    issue = {
        "key": "TEST-1",
        "id": "10000",
        "fields": {
            "summary": "Test",
            "issuetype": {"name": "Requirement"},
            "status": {"name": "Open"},
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-01T10:00:00.000+0000",
            "customfield_99999": "custom_value",
        },
    }
    
    mapping = mapper_with_custom_fields.map_issue(issue, "test-project")
    
    assert mapping.custom_fields["custom_field"] == "custom_value"


# --- REQUIREMENT MAPPING TESTS ---

def test_map_to_requirement(mapper, sample_jira_issue):
    """Test mapping to requirement"""
    mapping = mapper.map_issue(sample_jira_issue, "test-project")
    req_data = mapper.map_to_requirement(mapping, "EU_AI_ACT")
    
    assert req_data["project_slug"] == "test-project"
    assert req_data["framework"] == "EU_AI_ACT"
    assert req_data["requirement_code"] == "AI-123"
    assert req_data["title"] == "Test Requirement"
    assert req_data["uc_id"] == "system-001"
    assert req_data["owner_role"] == "Data Protection Officer"
    assert req_data["applicability"] == ["EU_AI_ACT", "ISO_42001"]
    assert req_data["mapped_controls"] == ["CTRL-001", "CTRL-002"]
    assert "Imported from Jira" in req_data["notes"]
    assert isinstance(UUID(req_data["id"]), UUID)


def test_map_to_requirement_iso_framework(mapper, sample_jira_issue):
    """Test mapping to requirement with ISO framework"""
    mapping = mapper.map_issue(sample_jira_issue, "test-project")
    req_data = mapper.map_to_requirement(mapping, "ISO_42001")
    
    assert req_data["framework"] == "ISO_42001"


def test_map_to_requirement_status_mapping(mapper):
    """Test status mapping for requirements"""
    status_tests = [
        ("To Do", "not_started"),
        ("In Progress", "in_progress"),
        ("Done", "completed"),
        ("Closed", "completed"),
        ("Resolved", "completed"),
        ("Unknown Status", "not_started"),
    ]
    
    for jira_status, expected_status in status_tests:
        issue = {
            "key": "TEST-1",
            "id": "10000",
            "fields": {
                "summary": "Test",
                "issuetype": {"name": "Requirement"},
                "status": {"name": jira_status},
                "created": "2026-01-01T10:00:00.000+0000",
                "updated": "2026-01-01T10:00:00.000+0000",
            },
        }
        
        mapping = mapper.map_issue(issue, "test-project")
        req_data = mapper.map_to_requirement(mapping)
        
        assert req_data["status"] == expected_status


def test_map_to_requirement_owner_fallback(mapper):
    """Test owner_role fallback to assignee"""
    issue = {
        "key": "TEST-1",
        "id": "10000",
        "fields": {
            "summary": "Test",
            "issuetype": {"name": "Requirement"},
            "status": {"name": "Open"},
            "assignee": {"displayName": "John Doe"},
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-01T10:00:00.000+0000",
        },
    }
    
    mapping = mapper.map_issue(issue, "test-project")
    req_data = mapper.map_to_requirement(mapping)
    
    assert req_data["owner_role"] == "John Doe"


# --- RISK MAPPING TESTS ---

def test_map_to_risk(mapper, sample_jira_issue_risk):
    """Test mapping to risk"""
    mapping = mapper.map_issue(sample_jira_issue_risk, "test-project")
    risk_data = mapper.map_to_risk(mapping)
    
    assert risk_data["jira_key"] == "RISK-456"
    assert risk_data["project_slug"] == "test-project"
    assert risk_data["title"] == "Data Privacy Risk"
    assert risk_data["risk_level"] == "Critical"
    assert risk_data["severity"] == "Critical"
    assert risk_data["status"] == "Open"
    assert risk_data["owner"] == "Risk Manager"


def test_map_to_risk_priority_fallback(mapper):
    """Test risk_level fallback to priority"""
    issue = {
        "key": "RISK-1",
        "id": "10000",
        "fields": {
            "summary": "Test Risk",
            "description": "Risk description",
            "issuetype": {"name": "Risk"},
            "status": {"name": "Open"},
            "priority": {"name": "High"},
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-01T10:00:00.000+0000",
        },
    }
    
    mapping = mapper.map_issue(issue, "test-project")
    risk_data = mapper.map_to_risk(mapping)
    
    assert risk_data["risk_level"] == "High"


def test_map_to_risk_mitigations(mapper):
    """Test risk mitigations from links"""
    issue = {
        "key": "RISK-1",
        "id": "10000",
        "fields": {
            "summary": "Test Risk",
            "description": "Risk description",
            "issuetype": {"name": "Risk"},
            "status": {"name": "Open"},
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-01T10:00:00.000+0000",
            "issuelinks": [
                {
                    "type": {"name": "mitigates"},
                    "outwardIssue": {"key": "CTRL-001"},
                },
                {
                    "type": {"name": "relates"},
                    "outwardIssue": {"key": "CTRL-002"},
                },
            ],
        },
    }
    
    mapping = mapper.map_issue(issue, "test-project")
    risk_data = mapper.map_to_risk(mapping)
    
    assert "CTRL-001" in risk_data["mitigations"]
    assert "CTRL-002" not in risk_data["mitigations"]


# --- EVIDENCE MAPPING TESTS ---

def test_map_to_evidence(mapper, sample_jira_issue):
    """Test mapping attachments to evidence"""
    mapping = mapper.map_issue(sample_jira_issue, "test-project")
    evidence_list = mapper.map_to_evidence(mapping, control_id="CTRL-001")
    
    assert len(evidence_list) == 1
    assert evidence_list[0]["project_slug"] == "test-project"
    assert evidence_list[0]["control_id"] == "CTRL-001"
    assert evidence_list[0]["name"] == "evidence.pdf"
    assert evidence_list[0]["uri"] == "https://jira.example.com/attachment/10000"
    assert evidence_list[0]["status"] == "pending"
    assert evidence_list[0]["mime"] == "application/pdf"
    assert evidence_list[0]["size_bytes"] == 1024
    assert evidence_list[0]["source"] == "jira"
    assert evidence_list[0]["source_key"] == "AI-123"
    assert evidence_list[0]["source_attachment_id"] == "10000"


def test_map_to_evidence_no_attachments(mapper):
    """Test evidence mapping with no attachments"""
    issue = {
        "key": "TEST-1",
        "id": "10000",
        "fields": {
            "summary": "Test",
            "issuetype": {"name": "Requirement"},
            "status": {"name": "Open"},
            "created": "2026-01-01T10:00:00.000+0000",
            "updated": "2026-01-01T10:00:00.000+0000",
        },
    }
    
    mapping = mapper.map_issue(issue, "test-project")
    evidence_list = mapper.map_to_evidence(mapping)
    
    assert len(evidence_list) == 0


def test_map_to_evidence_no_control_id(mapper, sample_jira_issue):
    """Test evidence mapping without control_id"""
    mapping = mapper.map_issue(sample_jira_issue, "test-project")
    evidence_list = mapper.map_to_evidence(mapping)
    
    assert evidence_list[0]["control_id"] is None


# --- ADF TEXT EXTRACTION TESTS ---

def test_extract_text_from_adf_simple(mapper):
    """Test simple ADF text extraction"""
    adf = {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {"type": "text", "text": "First paragraph"},
                    {"type": "text", "text": " continues"},
                ],
            },
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Second paragraph"}],
            },
        ],
    }
    
    text = mapper._extract_text_from_adf(adf)
    
    assert "First paragraph" in text
    assert "continues" in text
    assert "Second paragraph" in text


def test_extract_text_from_adf_nested(mapper):
    """Test nested ADF structure extraction"""
    adf = {
        "type": "doc",
        "content": [
            {
                "type": "panel",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "Nested text"}],
                    }
                ],
            }
        ],
    }
    
    text = mapper._extract_text_from_adf(adf)
    
    assert "Nested text" in text


def test_extract_text_from_adf_empty(mapper):
    """Test empty ADF structure"""
    adf = {"type": "doc", "content": []}
    
    text = mapper._extract_text_from_adf(adf)
    
    assert text == ""
