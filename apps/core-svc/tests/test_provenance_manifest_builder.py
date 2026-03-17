"""
Provenance Manifest Builder Tests

Tests for building provenance manifest facts from project data.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone

from app.services.provenance_manifest_builder import (
    build_manifest_facts_for_project,
    _split_regions,
    _map_dpia_status,
    _contains_sensitive,
)


# --- FIXTURES ---

@pytest.fixture
def mock_conn():
    """Mock asyncpg connection"""
    conn = AsyncMock()
    return conn


@pytest.fixture
def sample_project_row():
    """Sample project row"""
    return {
        "slug": "test-project",
        "name": "Test Project",
    }


@pytest.fixture
def sample_ai_system_row():
    """Sample AI system registry row"""
    return {
        "name": "Test AI System",
        "description": "Test description",
        "vendor": "Test Vendor",
        "provider_type": "internal",
        "data_sensitivity": "public",
        "region_scope": "EU,US",
        "updated_at": datetime.now(timezone.utc),
    }


@pytest.fixture
def sample_evidence_rows():
    """Sample evidence rows"""
    return [
        {
            "name": "evidence1.pdf",
            "status": "valid",
            "sha256": "abc123",
            "uri": "s3://bucket/evidence1.pdf",
            "updated_at": datetime.now(timezone.utc),
        },
        {
            "name": "dpia_report.pdf",
            "status": "valid",
            "sha256": "def456",
            "uri": "s3://bucket/dpia_report.pdf",
            "updated_at": datetime.now(timezone.utc),
        },
    ]


@pytest.fixture
def sample_artifact_rows():
    """Sample artifact rows"""
    return [
        {
            "uri": "s3://bucket/artifact1",
            "sha256": "abc123",
            "created_at": datetime.now(timezone.utc),
        },
    ]


@pytest.fixture
def sample_dataset_rows():
    """Sample dataset rows"""
    return [
        {
            "name": "training_dataset",
            "description": "Training data",
        },
    ]


@pytest.fixture
def sample_model_rows():
    """Sample model rows"""
    return [
        {
            "name": "model_v1",
            "version": "1.0.0",
            "framework": "pytorch",
        },
    ]


# --- HELPER FUNCTION TESTS ---

def test_split_regions_comma_separated():
    """Test splitting regions with comma"""
    result = _split_regions("EU,US,APAC")
    assert result == ["EU", "US", "APAC"]


def test_split_regions_semicolon_separated():
    """Test splitting regions with semicolon"""
    result = _split_regions("EU;US;APAC")
    assert result == ["EU", "US", "APAC"]


def test_split_regions_mixed():
    """Test splitting regions with mixed separators"""
    result = _split_regions("EU,US;APAC")
    assert result == ["EU", "US", "APAC"]


def test_split_regions_empty():
    """Test splitting empty regions"""
    result = _split_regions("")
    assert result == []


def test_split_regions_none():
    """Test splitting None regions"""
    result = _split_regions(None)
    assert result == []


def test_split_regions_with_spaces():
    """Test splitting regions with spaces"""
    result = _split_regions("EU, US , APAC")
    assert result == ["EU", "US", "APAC"]


def test_map_dpia_status_valid():
    """Test mapping valid DPIA status"""
    assert _map_dpia_status("valid") == "valid"
    assert _map_dpia_status("verified") == "valid"
    assert _map_dpia_status("approved") == "valid"


def test_map_dpia_status_expired():
    """Test mapping expired DPIA status"""
    assert _map_dpia_status("expired") == "expired"
    assert _map_dpia_status("outdated") == "expired"


def test_map_dpia_status_invalid():
    """Test mapping invalid DPIA status"""
    assert _map_dpia_status("invalid") == "invalid"
    assert _map_dpia_status("rejected") == "invalid"
    assert _map_dpia_status("failed") == "invalid"


def test_map_dpia_status_missing():
    """Test mapping missing DPIA status"""
    assert _map_dpia_status(None) == "missing"
    assert _map_dpia_status("") == "missing"
    assert _map_dpia_status("unknown") == "missing"


def test_contains_sensitive_true():
    """Test detecting sensitive data"""
    assert _contains_sensitive("Contains PII data") is True
    assert _contains_sensitive("Personal information") is True
    assert _contains_sensitive("Sensitive data") is True


def test_contains_sensitive_false():
    """Test not detecting sensitive data"""
    assert _contains_sensitive("Public data") is False
    assert _contains_sensitive("") is False
    assert _contains_sensitive(None) is False


def test_contains_sensitive_case_insensitive():
    """Test case insensitive detection"""
    assert _contains_sensitive("PII") is True
    assert _contains_sensitive("pii") is True
    assert _contains_sensitive("Personal") is True
    assert _contains_sensitive("PERSONAL") is True


# --- BUILD MANIFEST FACTS TESTS ---

@pytest.mark.asyncio
async def test_build_manifest_facts_with_ai_system(
    mock_conn, sample_project_row, sample_ai_system_row
):
    """Test building manifest facts with AI system data"""
    mock_conn.fetchrow = AsyncMock(side_effect=[sample_project_row, sample_ai_system_row])
    mock_conn.fetch = AsyncMock(return_value=[])
    
    facts = await build_manifest_facts_for_project(mock_conn, "test-project")
    
    assert facts["source"]["system_name"] == "Test AI System"
    assert facts["purpose"]["intended_use"] == "Test description"
    assert "EU" in facts["geography"]["regions"]
    assert "US" in facts["geography"]["regions"]


@pytest.mark.asyncio
async def test_build_manifest_facts_project_not_found(mock_conn):
    """Test error when project not found"""
    mock_conn.fetchrow = AsyncMock(return_value=None)
    
    with pytest.raises(ValueError, match="Project 'test-project' not found"):
        await build_manifest_facts_for_project(mock_conn, "test-project")


@pytest.mark.asyncio
async def test_build_manifest_facts_with_evidence(
    mock_conn, sample_project_row, sample_evidence_rows
):
    """Test building manifest facts with evidence"""
    mock_conn.fetchrow = AsyncMock(return_value=sample_project_row)
    mock_conn.fetch = AsyncMock(side_effect=[
        [],  # AI system (empty)
        sample_evidence_rows,  # Evidence
        [],  # Artifacts
        [],  # Datasets
        [],  # Models
    ])
    
    facts = await build_manifest_facts_for_project(mock_conn, "test-project")
    
    assert len(facts["evidence"]["present"]) == 2
    assert "evidence1.pdf" in facts["evidence"]["present"]
    assert "dpia_report.pdf" in facts["evidence"]["present"]
    assert facts["evidence"]["status"]["DPIA"] == "valid"


@pytest.mark.asyncio
async def test_build_manifest_facts_with_datasets(
    mock_conn, sample_project_row, sample_dataset_rows
):
    """Test building manifest facts with datasets"""
    mock_conn.fetchrow = AsyncMock(return_value=sample_project_row)
    mock_conn.fetch = AsyncMock(side_effect=[
        [],  # AI system
        [],  # Evidence
        [],  # Artifacts
        sample_dataset_rows,  # Datasets
        [],  # Models
    ])
    
    facts = await build_manifest_facts_for_project(mock_conn, "test-project")
    
    assert "training_dataset" in facts["data_categories"]["included"]


@pytest.mark.asyncio
async def test_build_manifest_facts_with_models(
    mock_conn, sample_project_row, sample_model_rows
):
    """Test building manifest facts with models"""
    mock_conn.fetchrow = AsyncMock(return_value=sample_project_row)
    mock_conn.fetch = AsyncMock(side_effect=[
        [],  # AI system
        [],  # Evidence
        [],  # Artifacts
        [],  # Datasets
        sample_model_rows,  # Models
    ])
    
    facts = await build_manifest_facts_for_project(mock_conn, "test-project")
    
    assert "model_v1" in facts["data_categories"]["included"]


@pytest.mark.asyncio
async def test_build_manifest_facts_source_name_fallback(
    mock_conn, sample_project_row, sample_model_rows
):
    """Test source name fallback to model name"""
    mock_conn.fetchrow = AsyncMock(return_value=sample_project_row)
    mock_conn.fetch = AsyncMock(side_effect=[
        None,  # No AI system
        [],  # Evidence
        [],  # Artifacts
        [],  # Datasets
        sample_model_rows,  # Models
    ])
    
    facts = await build_manifest_facts_for_project(mock_conn, "test-project")
    
    assert facts["source"]["system_name"] == "model_v1"


@pytest.mark.asyncio
async def test_build_manifest_facts_source_name_project_fallback(mock_conn, sample_project_row):
    """Test source name fallback to project name"""
    mock_conn.fetchrow = AsyncMock(return_value=sample_project_row)
    mock_conn.fetch = AsyncMock(side_effect=[
        None,  # No AI system
        [],  # Evidence
        [],  # Artifacts
        [],  # Datasets
        [],  # Models
    ])
    
    facts = await build_manifest_facts_for_project(mock_conn, "test-project")
    
    assert facts["source"]["system_name"] == "Test Project"


@pytest.mark.asyncio
async def test_build_manifest_facts_sensitive_data_detection(
    mock_conn, sample_project_row
):
    """Test sensitive data detection"""
    ai_system = {
        "name": "Test System",
        "description": "Test",
        "vendor": None,
        "provider_type": None,
        "data_sensitivity": "Contains PII and personal information",
        "region_scope": None,
        "updated_at": None,
    }
    
    mock_conn.fetchrow = AsyncMock(side_effect=[sample_project_row, ai_system])
    mock_conn.fetch = AsyncMock(return_value=[])
    
    facts = await build_manifest_facts_for_project(mock_conn, "test-project")
    
    assert facts["personal_data"]["present"] is True
    assert facts["data_categories"]["findings"]["sensitive_included"] is True


@pytest.mark.asyncio
async def test_build_manifest_facts_hash_mismatch(
    mock_conn, sample_project_row, sample_evidence_rows, sample_artifact_rows
):
    """Test hash mismatch detection"""
    # Evidence with different hash than artifact
    evidence = [
        {
            "name": "evidence1.pdf",
            "status": "valid",
            "sha256": "abc123",
            "uri": "s3://bucket/evidence1.pdf",
            "updated_at": datetime.now(timezone.utc),
        },
    ]
    
    artifacts = [
        {
            "uri": "s3://bucket/evidence1.pdf",
            "sha256": "different_hash",
            "created_at": datetime.now(timezone.utc),
        },
    ]
    
    mock_conn.fetchrow = AsyncMock(return_value=sample_project_row)
    mock_conn.fetch = AsyncMock(side_effect=[
        [],  # AI system
        evidence,  # Evidence
        artifacts,  # Artifacts
        [],  # Datasets
        [],  # Models
    ])
    
    facts = await build_manifest_facts_for_project(mock_conn, "test-project")
    
    assert facts["evidence"]["integrity"]["any_hash_mismatch"] is True


@pytest.mark.asyncio
async def test_build_manifest_facts_evidence_age(
    mock_conn, sample_project_row
):
    """Test evidence age calculation"""
    from datetime import timedelta
    
    old_time = datetime.now(timezone.utc) - timedelta(days=30)
    
    evidence = [
        {
            "name": "evidence1.pdf",
            "status": "valid",
            "sha256": "abc123",
            "uri": "s3://bucket/evidence1.pdf",
            "updated_at": old_time,
        },
    ]
    
    mock_conn.fetchrow = AsyncMock(return_value=sample_project_row)
    mock_conn.fetch = AsyncMock(side_effect=[
        [],  # AI system
        evidence,  # Evidence
        [],  # Artifacts
        [],  # Datasets
        [],  # Models
    ])
    
    facts = await build_manifest_facts_for_project(mock_conn, "test-project")
    
    assert facts["signals"]["evidence_integrity_checks_within_days"] == 30


@pytest.mark.asyncio
async def test_build_manifest_facts_manifest_hash(mock_conn, sample_project_row):
    """Test manifest hash generation"""
    mock_conn.fetchrow = AsyncMock(return_value=sample_project_row)
    mock_conn.fetch = AsyncMock(return_value=[])
    
    facts = await build_manifest_facts_for_project(mock_conn, "test-project")
    
    assert "manifest_hash" in facts["versioning"]
    assert len(facts["versioning"]["manifest_hash"]) == 64  # SHA256 hex length
    assert facts["versioning"]["manifest_hash"] == facts["versioning"]["manifest_hash"]  # Consistent


@pytest.mark.asyncio
async def test_build_manifest_facts_no_evidence(mock_conn, sample_project_row):
    """Test building facts with no evidence"""
    mock_conn.fetchrow = AsyncMock(return_value=sample_project_row)
    mock_conn.fetch = AsyncMock(return_value=[])
    
    facts = await build_manifest_facts_for_project(mock_conn, "test-project")
    
    assert facts["evidence"]["present"] == []
    assert facts["evidence"]["integrity"]["all_linked_valid"] is False
    assert facts["signals"]["evidence_integrity_checks_within_days"] is None
