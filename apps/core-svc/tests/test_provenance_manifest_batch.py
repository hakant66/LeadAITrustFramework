"""
Provenance Manifest Batch Tests

Tests for the batch service that builds provenance manifests for one or all projects.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock, Mock

from app.services.provenance_manifest_batch import (
    _fetch_project_slugs,
    build_manifest_for_project,
    batch_build_manifests,
)


# --- FIXTURES ---

@pytest.fixture
def mock_conn():
    """Mock asyncpg connection"""
    return AsyncMock()


@pytest.fixture
def mock_pool(mock_conn):
    """Mock asyncpg pool with async context manager"""
    pool = AsyncMock()
    acquire_cm = AsyncMock()
    acquire_cm.__aenter__.return_value = mock_conn
    acquire_cm.__aexit__.return_value = None
    pool.acquire = Mock(return_value=acquire_cm)
    return pool


# --- _fetch_project_slugs ---

@pytest.mark.asyncio
async def test_fetch_project_slugs_returns_ordered_slugs(mock_conn):
    """Test _fetch_project_slugs returns slugs from conn.fetch"""
    mock_conn.fetch = AsyncMock(
        return_value=[
            {"slug": "project-a"},
            {"slug": "project-b"},
            {"slug": "project-c"},
        ]
    )
    result = await _fetch_project_slugs(mock_conn)
    assert result == ["project-a", "project-b", "project-c"]
    mock_conn.fetch.assert_called_once()
    call_args = mock_conn.fetch.call_args[0]
    assert "SELECT slug FROM projects" in call_args[0]
    assert "ORDER BY slug" in call_args[0]


@pytest.mark.asyncio
async def test_fetch_project_slugs_empty(mock_conn):
    """Test _fetch_project_slugs with no projects"""
    mock_conn.fetch = AsyncMock(return_value=[])
    result = await _fetch_project_slugs(mock_conn)
    assert result == []


# --- build_manifest_for_project ---

@pytest.mark.asyncio
async def test_build_manifest_for_project_returns_score_and_level(mock_conn):
    """Test build_manifest_for_project returns project_slug, overall_score_pct, overall_level"""
    facts = {"source": {"system_name": "Test"}}
    eval_result = MagicMock()
    eval_result.overall_score_pct = 66.0
    eval_result.overall_level = "P2"

    with patch(
        "app.services.provenance_manifest_batch.build_manifest_facts_for_project",
        new_callable=AsyncMock,
        return_value=facts,
    ):
        with patch(
            "app.services.provenance_manifest_batch.upsert_manifest_facts",
            new_callable=AsyncMock,
        ):
            with patch(
                "app.services.provenance_manifest_batch.evaluate_project_provenance",
                new_callable=AsyncMock,
                return_value=eval_result,
            ):
                result = await build_manifest_for_project(
                    mock_conn, "test-project", force_recompute=True
                )

    assert result["project_slug"] == "test-project"
    assert result["overall_score_pct"] == 66.0
    assert result["overall_level"] == "P2"


@pytest.mark.asyncio
async def test_build_manifest_for_project_calls_builder_upsert_eval(mock_conn):
    """Test build_manifest_for_project calls builder, upsert, and evaluate in order"""
    facts = {"source": {}}
    eval_result = MagicMock()
    eval_result.overall_score_pct = 0.0
    eval_result.overall_level = "P0"

    build_mock = AsyncMock(return_value=facts)
    upsert_mock = AsyncMock()
    eval_mock = AsyncMock(return_value=eval_result)

    with patch(
        "app.services.provenance_manifest_batch.build_manifest_facts_for_project",
        build_mock,
    ):
        with patch(
            "app.services.provenance_manifest_batch.upsert_manifest_facts",
            upsert_mock,
        ):
            with patch(
                "app.services.provenance_manifest_batch.evaluate_project_provenance",
                eval_mock,
            ):
                await build_manifest_for_project(
                    mock_conn, "my-project", force_recompute=False
                )

    build_mock.assert_called_once_with(mock_conn, "my-project")
    upsert_mock.assert_called_once_with(mock_conn, "my-project", facts)
    eval_mock.assert_called_once()
    call_kwargs = eval_mock.call_args[1]
    assert call_kwargs["manifest_facts"] == facts
    assert call_kwargs["force_recompute"] is False


# --- batch_build_manifests ---

@pytest.mark.asyncio
async def test_batch_build_manifests_with_explicit_slugs(mock_pool):
    """Test batch_build_manifests with project_slugs provided (PARTIAL scope)"""
    async def fake_get_pool():
        return mock_pool

    build_result = {
        "project_slug": "test-project",
        "overall_score_pct": 75.0,
        "overall_level": "P2",
    }

    with patch("app.services.provenance_manifest_batch.get_pool", side_effect=fake_get_pool):
        with patch(
            "app.services.provenance_manifest_batch.build_manifest_for_project",
            new_callable=AsyncMock,
            return_value=build_result,
        ):
            result = await batch_build_manifests(
                project_slugs=["test-project"],
                force_recompute=True,
            )

    assert result["scope"] == "PARTIAL"
    assert result["total_processed"] == 1
    assert result["success_count"] == 1
    assert result["error_count"] == 0
    assert result["results"] == [build_result]
    assert result["errors"] == []


@pytest.mark.asyncio
async def test_batch_build_manifests_fetches_slugs_when_none(mock_pool, mock_conn):
    """Test batch_build_manifests fetches slugs from DB when project_slugs is None"""
    mock_conn.fetch = AsyncMock(return_value=[{"slug": "a"}, {"slug": "b"}])
    build_result = {"project_slug": "a", "overall_score_pct": 50.0, "overall_level": "P1"}

    async def fake_get_pool():
        return mock_pool

    with patch("app.services.provenance_manifest_batch.get_pool", side_effect=fake_get_pool):
        with patch(
            "app.services.provenance_manifest_batch.build_manifest_for_project",
            new_callable=AsyncMock,
            return_value=build_result,
        ):
            result = await batch_build_manifests(
                project_slugs=None,
                force_recompute=True,
            )

    assert result["scope"] == "ALL"
    assert result["total_processed"] == 2
    assert result["success_count"] == 2
    assert result["error_count"] == 0
    assert len(result["results"]) == 2


@pytest.mark.asyncio
async def test_batch_build_manifests_collects_errors(mock_pool):
    """Test batch_build_manifests collects per-project errors"""
    async def fake_get_pool():
        return mock_pool

    call_count = 0

    async def build_side_effect(conn, slug, force_recompute=True):
        nonlocal call_count
        call_count += 1
        if slug == "fail-project":
            raise ValueError("Simulated failure")
        return {"project_slug": slug, "overall_score_pct": 0.0, "overall_level": "P0"}

    with patch("app.services.provenance_manifest_batch.get_pool", side_effect=fake_get_pool):
        with patch(
            "app.services.provenance_manifest_batch.build_manifest_for_project",
            side_effect=build_side_effect,
        ):
            result = await batch_build_manifests(
                project_slugs=["ok-project", "fail-project", "ok2"],
                force_recompute=True,
            )

    assert result["scope"] == "PARTIAL"
    assert result["total_processed"] == 3
    assert result["success_count"] == 2
    assert result["error_count"] == 1
    assert len(result["results"]) == 2
    assert len(result["errors"]) == 1
    assert result["errors"][0]["project_slug"] == "fail-project"
    assert "Simulated failure" in result["errors"][0]["error"]
