import asyncio

from fastapi.testclient import TestClient

from app.main import app
from app.scorecard import ProjectOut, ScorecardOut, PillarOut, KPIOut
from app.services.provenance_integration import (
    ProvenanceEvaluation,
    evaluate_project_provenance,
)


class DummyConn:
    async def fetchrow(self, _query, *_args):
        return None

    async def execute(self, _query, *_args):
        return None


class DummyScorecardConn(DummyConn):
    async def fetchrow(self, query, *_args):
        if "FROM controls" in query:
            return {"id": "c-1", "norm_min": 0, "norm_max": 100, "higher_is_better": True}
        return None


class DummyAcquire:
    async def __aenter__(self):
        return DummyScorecardConn()

    async def __aexit__(self, exc_type, exc, tb):
        return False


class DummyPool:
    def acquire(self):
        return DummyAcquire()


def test_evaluate_project_provenance_hard_gate():
    manifest = {
        "personal_data": {"present": True},
        "evidence": {"status": {"DPIA": "missing"}, "integrity": {"any_hash_mismatch": False}},
    }
    result = asyncio.run(
        evaluate_project_provenance(
            DummyConn(),
            "demo",
            manifest_facts=manifest,
            force_recompute=True,
        )
    )
    assert result.overall_level == "P0"
    gate_ids = {gate.get("gate_id") for gate in result.gates}
    assert "missing_dpia_when_personal_data" in gate_ids


def test_scorecard_post_includes_provenance(monkeypatch):
    import app.scorecard as scorecard

    async def fake_get_pool():
        return DummyPool()

    async def fake_get_project_out_or_none(_conn, slug):
        return ProjectOut(
            slug=slug,
            name=slug,
            target_threshold=0.8,
        )

    async def fake_upsert_manifest_facts(_conn, _slug, _facts):
        return "hash"

    dummy_eval = ProvenanceEvaluation(
        overall_level="P0",
        overall_score=0,
        overall_score_pct=0.0,
        fields=[],
        gates=[{"gate_id": "missing_dpia_when_personal_data", "forced_level": "P0"}],
        evaluated_at="2026-01-27T00:00:00",
        rules_version="1",
        rules_hash="hash",
        manifest_hash="hash",
        snapshot_id="snap",
    )

    async def fake_eval(*_args, **_kwargs):
        return dummy_eval

    monkeypatch.setattr(scorecard, "get_pool", fake_get_pool)
    monkeypatch.setattr(scorecard, "get_project_out_or_none", fake_get_project_out_or_none)
    monkeypatch.setattr(scorecard, "upsert_manifest_facts", fake_upsert_manifest_facts)
    monkeypatch.setattr(scorecard, "evaluate_project_provenance", fake_eval)

    client = TestClient(app)
    resp = client.post(
        "/scorecard/demo",
        json={
            "scores": [{"key": "k1", "value": 10}],
            "manifest_facts": {"personal_data": {"present": True}},
        },
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["provenance"]["overall_level"] == "P0"


def test_scorecard_get_includes_provenance(monkeypatch):
    import app.scorecard as scorecard

    async def fake_get_pool():
        return DummyPool()

    async def fake_get_project_out_or_none(_conn, slug):
        return ProjectOut(
            slug=slug,
            name=slug,
            target_threshold=0.8,
        )

    dummy_eval = ProvenanceEvaluation(
        overall_level="P2",
        overall_score=2,
        overall_score_pct=66.0,
        fields=[],
        gates=[],
        evaluated_at="2026-01-27T00:00:00",
        rules_version="1",
        rules_hash="hash",
        manifest_hash="hash",
        snapshot_id="snap",
    )

    async def fake_eval(*_args, **_kwargs):
        return dummy_eval

    async def fake_load_scorecard(_conn, slug, project=None, provenance_eval=None):
        return ScorecardOut(
            project=project,
            overall_pct=75.0,
            pillars=[PillarOut(key="GOV", name="Governance", score_pct=75.0, maturity=4)],
            kpis=[KPIOut(pillar="Governance", key="k1", name="KPI", normalized_pct=75.0)],
            provenance=scorecard._provenance_eval_to_out(provenance_eval),
            provenance_score_pct=provenance_eval.overall_score_pct,
        )

    monkeypatch.setattr(scorecard, "get_pool", fake_get_pool)
    monkeypatch.setattr(scorecard, "get_project_out_or_none", fake_get_project_out_or_none)
    monkeypatch.setattr(scorecard, "evaluate_project_provenance", fake_eval)
    monkeypatch.setattr(scorecard, "load_scorecard", fake_load_scorecard)

    client = TestClient(app)
    resp = client.get("/scorecard/demo")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["provenance"]["overall_level"] == "P2"
