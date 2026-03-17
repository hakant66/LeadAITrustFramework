# Jira Integration for LeadAI Governance Evidence

This document describes the Jira integration that enables automatic ingestion of governance evidence from Jira for EU AI Act and ISO/IEC 42001 compliance.

## Overview

The Jira integration allows LeadAI to:
- Pull issues from Jira projects as governance evidence
- Map Jira issue types to governance structures (requirements, risks, controls, tests, incidents)
- Sync attachments as evidence
- Maintain traceability between Jira and LeadAI

## Architecture

### Components

1. **JiraClient** (`app/services/jira_client.py`)
   - REST API client for Jira Cloud/Server
   - Supports multiple authentication methods
   - Handles pagination and error handling

2. **JiraMapper** (`app/services/jira_mapper.py`)
   - Maps Jira issues to LeadAI governance structures
   - Extracts custom fields
   - Handles issue relationships and attachments

3. **Jira Router** (`app/routers/jira.py`)
   - REST endpoints for configuration, search, and sync
   - Integrates with LeadAI database

## Configuration

### Environment Variables

```bash
# Required
JIRA_BASE_URL=https://yourcompany.atlassian.net

# Authentication (choose one)
JIRA_AUTH_TYPE=api_token  # or "basic" or "oauth2"

# For API Token (Jira Cloud)
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_api_token

# For Basic Auth (Jira Server/Data Center)
JIRA_USERNAME=your_username
JIRA_PASSWORD=your_password

# For OAuth 2.0
JIRA_OAUTH_TOKEN=your_oauth_token

# Optional
JIRA_TIMEOUT=30  # Request timeout in seconds
```

### Getting Jira API Token (Jira Cloud)

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Copy the token and set `JIRA_API_TOKEN`

## API Endpoints

### Configuration

#### GET `/admin/jira/config`
Get current Jira configuration (credentials masked)

#### POST `/admin/jira/config/test`
Test Jira connection with provided config or environment config

**Request:**
```json
{
  "base_url": "https://yourcompany.atlassian.net",
  "auth_type": "api_token",
  "email": "user@company.com",
  "api_token": "your_token"
}
```

### Projects & Fields

#### GET `/admin/jira/projects`
List available Jira projects

#### GET `/admin/jira/fields`
List all Jira fields (including custom fields)

### Search

#### POST `/admin/jira/search`
Search Jira issues using JQL

**Request:**
```json
{
  "jql": "project = AI AND issuetype = Risk",
  "start_at": 0,
  "max_results": 50
}
```

**Response:**
```json
{
  "total": 25,
  "start_at": 0,
  "max_results": 50,
  "issues": [
    {
      "key": "AI-123",
      "id": "10001",
      "summary": "High-risk AI system identified",
      "status": "In Progress",
      "issue_type": "Risk",
      "priority": "High",
      "assignee": "John Doe",
      "created": "2026-02-01T10:00:00.000+0000",
      "updated": "2026-02-11T09:15:00.000+0000"
    }
  ]
}
```

### Sync

#### POST `/admin/jira/sync`
Sync Jira issues to LeadAI governance structures

**Request:**
```json
{
  "project_slug": "my-ai-project",
  "jira_project_keys": ["AI", "GOV"],
  "jql": "status != Closed",
  "issue_types": ["Risk", "Requirement", "Control"],
  "sync_attachments": true,
  "sync_comments": false,
  "sync_changelog": false,
  "framework": "EU_AI_ACT"
}
```

**Response:**
```json
{
  "success": true,
  "issues_synced": 42,
  "requirements_created": 15,
  "risks_created": 8,
  "evidence_created": 23,
  "errors": [],
  "warnings": []
}
```

#### GET `/admin/jira/sync/status/{project_slug}`
Get sync status for a project

**Response:**
```json
{
  "project_slug": "my-ai-project",
  "last_sync": "2026-02-11T10:00:00.000+0000",
  "issues_synced": 42,
  "governance_types_count": 3,
  "status": "synced"
}
```

## Issue Type Mapping

Jira issue types are mapped to LeadAI governance types:

| Jira Issue Type | LeadAI Governance Type | Database Table |
|----------------|----------------------|----------------|
| Risk | governance.risk | `jira_risk_register` |
| Requirement | governance.requirement | `ai_requirement_register` |
| Control | governance.control | (via controls table) |
| Test | validation.test | (via evidence) |
| Incident | monitoring.incident | (via evidence) |
| Change | change.management | (via sync metadata) |
| Approval | oversight.approval | (via sync metadata) |
| Policy | policy.document | (via evidence) |

## Custom Fields

The integration supports standard custom fields from the Jira export schema:

- `customfield_AI_SYSTEM_ID` → `ai_system_id`
- `customfield_AI_RISK_LEVEL` → `ai_risk_level`
- `customfield_AI_STATUS` → `ai_status`
- `customfield_AI_OWNER_ROLE` → `ai_owner_role`
- `customfield_AI_DATA_SOURCES` → `ai_data_sources`
- `customfield_AI_HUMAN_OVERSIGHT` → `ai_human_oversight`
- `customfield_AI_COMPLIANCE_TAGS` → `ai_compliance_tags`
- `customfield_AI_CONTROL_ID` → `ai_control_id`
- `customfield_AI_TEST_RESULT` → `ai_test_result`
- `customfield_AI_MODEL_VERSION` → `ai_model_version`

## Usage Examples

### Example 1: Sync All Risks from AI Project

```bash
curl -X POST http://localhost:8001/admin/jira/sync \
  -H "Content-Type: application/json" \
  -d '{
    "project_slug": "my-ai-project",
    "jira_project_keys": ["AI"],
    "issue_types": ["Risk"],
    "sync_attachments": true,
    "framework": "EU_AI_ACT"
  }'
```

### Example 2: Sync Requirements with Custom JQL

```bash
curl -X POST http://localhost:8001/admin/jira/sync \
  -H "Content-Type: application/json" \
  -d '{
    "project_slug": "my-ai-project",
    "jira_project_keys": ["AI", "GOV"],
    "jql": "issuetype = Requirement AND status != Closed",
    "sync_attachments": true,
    "framework": "ISO_42001"
  }'
```

### Example 3: Search for High-Risk Issues

```bash
curl -X POST http://localhost:8001/admin/jira/search \
  -H "Content-Type: application/json" \
  -d '{
    "jql": "project = AI AND priority = High AND status != Closed",
    "max_results": 100
  }'
```

## Database Schema

### jira_sync_metadata

Stores sync metadata for traceability:

- `id` (Text, PK)
- `project_slug` (Text)
- `jira_key` (Text, Unique)
- `jira_id` (Text)
- `governance_type` (Text)
- `issue_type` (Text)
- `status` (Text)
- `last_synced_at` (Timestamp)
- `sync_count` (Integer)
- `raw_data` (JSONB) - Full Jira issue JSON
- `created_at`, `updated_at` (Timestamp)

### jira_risk_register

Stores risk issues from Jira:

- `id` (Text, PK)
- `project_slug` (Text)
- `jira_key` (Text, Unique)
- `jira_id` (Text)
- `title`, `description` (Text)
- `risk_level`, `severity`, `status` (Text)
- `owner` (Text)
- `due_date` (Timestamp)
- `mitigations` (Array[Text]) - Array of related Jira keys
- `created_at`, `updated_at` (Timestamp)

### Evidence Table Extensions

The `evidence` table has been extended with:
- `jira_key` (Text) - Reference to Jira issue
- `jira_attachment_id` (Text) - Reference to Jira attachment

## Audit Trail

All sync operations are logged to the audit log with:
- Event type: `jira_sync_completed`
- Details include: jira_projects, issues_synced, requirements_created, risks_created, evidence_created

## Best Practices

1. **Regular Syncs**: Set up scheduled syncs (e.g., daily) to keep governance evidence up-to-date
2. **JQL Filters**: Use specific JQL queries to sync only relevant issues
3. **Issue Types**: Filter by issue types to sync only governance-relevant issues
4. **Attachments**: Enable `sync_attachments` to automatically create evidence from Jira attachments
5. **Custom Fields**: Configure custom fields in Jira to match LeadAI's governance structure
6. **Traceability**: Use issue links in Jira to establish relationships (e.g., Risk → Mitigation)

## Troubleshooting

### Authentication Errors

- **401 Unauthorized**: Check API token/credentials
- **403 Forbidden**: Verify user has access to Jira projects
- **404 Not Found**: Verify Jira base URL is correct

### Sync Issues

- **No issues found**: Check JQL query and project keys
- **Partial sync**: Check error messages in response
- **Missing custom fields**: Verify custom field IDs match your Jira instance

### Database Errors

- **Table not found**: Run migrations: `alembic upgrade head`
- **Constraint violations**: Check for duplicate Jira keys

## Migration

Run the migration to create Jira integration tables:

```bash
docker compose exec core-svc alembic upgrade head
```

Or locally:

```bash
cd apps/core-svc
alembic upgrade head
```

## Security Considerations

1. **API Tokens**: Store securely, never commit to version control
2. **OAuth 2.0**: Preferred for enterprise deployments
3. **Network**: Use HTTPS for Jira base URL
4. **Access Control**: Ensure Jira user has minimal required permissions
5. **Audit Logging**: All sync operations are logged for compliance

## Future Enhancements

- Webhook support for real-time sync
- Bidirectional sync (LeadAI → Jira)
- Advanced relationship mapping
- Custom field mapping UI
- Scheduled sync jobs
- Conflict resolution strategies
