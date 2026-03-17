"""
Guardrails Engine Tests

Tests for guardrails engine that applies caps to pillar scores based on facts and rules.
"""

import pytest
from unittest.mock import MagicMock, Mock, patch
import psycopg
from psycopg.rows import dict_row

from app.guardrails_engine import (
    GuardrailRule,
    _table_exists,
    load_fact_sources,
    load_guardrail_rules,
    _kpi_score_for_project,
    _project_attr,
    compute_project_facts,
    _cmp,
    _eval_clause,
    _eval_when,
    apply_guardrails_for_project,
    compute_raw_pillars_for_project,
    diagnose_guardrails_for_project,
    DEFAULT_FACT_SOURCES,
    DEFAULT_RULES,
)


# --- FIXTURES ---

@pytest.fixture
def mock_conn():
    """Mock psycopg Connection"""
    conn = MagicMock(spec=psycopg.Connection)
    return conn


@pytest.fixture
def mock_cursor():
    """Mock psycopg Cursor"""
    cursor = MagicMock()
    return cursor


# --- _table_exists ---

def test_table_exists_returns_true(mock_conn, mock_cursor):
    """_table_exists returns True when table exists."""
    mock_cursor.fetchone.return_value = (1,)
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    result = _table_exists(mock_conn, "public.guardrail_fact_sources")
    
    assert result is True
    mock_cursor.execute.assert_called_once()


def test_table_exists_returns_false(mock_conn, mock_cursor):
    """_table_exists returns False when table doesn't exist."""
    mock_cursor.fetchone.return_value = None
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    result = _table_exists(mock_conn, "public.nonexistent")
    
    assert result is False


def test_table_exists_with_schema(mock_conn, mock_cursor):
    """_table_exists handles schema.table format."""
    mock_cursor.fetchone.return_value = (1,)
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    _table_exists(mock_conn, "custom_schema.table_name")
    
    # Verify the execute was called with schema and table as separate args
    call_args = mock_cursor.execute.call_args
    # The SQL uses %s placeholders, so args are passed as tuple in call_args.args[1]
    assert len(call_args.args) >= 2
    args = call_args.args[1]
    assert args[0] == "custom_schema"  # schema
    assert args[1] == "table_name"  # table


# --- load_fact_sources ---

def test_load_fact_sources_uses_defaults_when_table_missing(mock_conn):
    """load_fact_sources returns DEFAULT_FACT_SOURCES when table doesn't exist."""
    with patch("app.guardrails_engine._table_exists", return_value=False):
        result = load_fact_sources(mock_conn)
    
    assert result == DEFAULT_FACT_SOURCES


def test_load_fact_sources_loads_from_db(mock_conn, mock_cursor):
    """load_fact_sources loads fact sources from database."""
    mock_cursor.fetchall.return_value = [
        {
            "fact_key": "has_pcl",
            "source": "kpi",
            "kpi_key": "pcl_assigned",
            "attr_key": None,
            "present_threshold": 100.0,
        },
        {
            "fact_key": "custom_fact",
            "source": "project_attr",
            "kpi_key": None,
            "attr_key": "custom_field",
            "present_threshold": None,
        },
    ]
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    with patch("app.guardrails_engine._table_exists", return_value=True):
        result = load_fact_sources(mock_conn)
    
    assert "has_pcl" in result
    assert result["has_pcl"]["source"] == "kpi"
    assert result["has_pcl"]["kpi_key"] == "pcl_assigned"
    assert result["has_pcl"]["present_threshold"] == 100.0
    assert "custom_fact" in result
    assert result["custom_fact"]["source"] == "project_attr"
    assert result["custom_fact"]["attr_key"] == "custom_field"


def test_load_fact_sources_merges_defaults(mock_conn, mock_cursor):
    """load_fact_sources merges defaults for missing critical facts."""
    mock_cursor.fetchall.return_value = [
        {
            "fact_key": "custom_fact",
            "source": "kpi",
            "kpi_key": "custom_kpi",
            "attr_key": None,
            "present_threshold": None,
        },
    ]
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    with patch("app.guardrails_engine._table_exists", return_value=True):
        result = load_fact_sources(mock_conn)
    
    # Should have custom_fact plus all defaults
    assert "custom_fact" in result
    for key in DEFAULT_FACT_SOURCES:
        assert key in result


# --- load_guardrail_rules ---

def test_load_guardrail_rules_uses_defaults_when_table_missing(mock_conn):
    """load_guardrail_rules returns DEFAULT_RULES when table doesn't exist."""
    with patch("app.guardrails_engine._table_exists", return_value=False):
        result = load_guardrail_rules(mock_conn)
    
    assert len(result) == len(DEFAULT_RULES)
    assert all(isinstance(r, GuardrailRule) for r in result)


def test_load_guardrail_rules_loads_from_db(mock_conn, mock_cursor):
    """load_guardrail_rules loads rules from database."""
    mock_cursor.fetchall.return_value = [
        {
            "pillar_key": "gov",
            "cap": 40.0,
            "rule": {"all_of": [{"fact": "has_pcl", "op": "==", "value": 0}]},
        },
    ]
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    with patch("app.guardrails_engine._table_exists", return_value=True):
        result = load_guardrail_rules(mock_conn)
    
    assert len(result) == 1
    assert result[0].pillar_key == "gov"
    assert result[0].cap == 40.0
    assert result[0].when == {"all_of": [{"fact": "has_pcl", "op": "==", "value": 0}]}


def test_load_guardrail_rules_falls_back_to_defaults_when_empty(mock_conn, mock_cursor):
    """load_guardrail_rules falls back to defaults when DB returns empty."""
    mock_cursor.fetchall.return_value = []
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    with patch("app.guardrails_engine._table_exists", return_value=True):
        result = load_guardrail_rules(mock_conn)
    
    assert len(result) == len(DEFAULT_RULES)


# --- _kpi_score_for_project ---

def test_kpi_score_for_project_returns_score(mock_conn, mock_cursor):
    """_kpi_score_for_project returns KPI score when found."""
    mock_cursor.fetchone.return_value = (85.5,)
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    result = _kpi_score_for_project(mock_conn, "project-123", "pcl_assigned")
    
    assert result == 85.5
    mock_cursor.execute.assert_called_once()


def test_kpi_score_for_project_returns_none_when_not_found(mock_conn, mock_cursor):
    """_kpi_score_for_project returns None when KPI not found."""
    mock_cursor.fetchone.return_value = None
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    result = _kpi_score_for_project(mock_conn, "project-123", "nonexistent")
    
    assert result is None


def test_kpi_score_for_project_handles_none_score(mock_conn, mock_cursor):
    """_kpi_score_for_project returns None when score is NULL."""
    mock_cursor.fetchone.return_value = (None,)
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    result = _kpi_score_for_project(mock_conn, "project-123", "kpi_key")
    
    assert result is None


# --- _project_attr ---

def test_project_attr_returns_value(mock_conn, mock_cursor):
    """_project_attr returns attribute value when found."""
    mock_cursor.fetchone.return_value = ("value123",)
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    result = _project_attr(mock_conn, "project-123", "custom_field")
    
    assert result == "value123"


def test_project_attr_returns_none_when_not_found(mock_conn, mock_cursor):
    """_project_attr returns None when attribute not found."""
    mock_cursor.fetchone.return_value = None
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    result = _project_attr(mock_conn, "project-123", "nonexistent")
    
    assert result is None


def test_project_attr_handles_exception(mock_conn, mock_cursor):
    """_project_attr handles exceptions and rolls back transaction."""
    mock_cursor.execute.side_effect = Exception("SQL error")
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    result = _project_attr(mock_conn, "project-123", "invalid_field")
    
    assert result is None
    mock_conn.rollback.assert_called_once()


# --- compute_project_facts ---

def test_compute_project_facts_from_kpi_with_threshold(mock_conn):
    """compute_project_facts computes fact from KPI with threshold."""
    fact_sources = {
        "has_pcl": {"source": "kpi", "kpi_key": "pcl_assigned", "present_threshold": 100},
    }
    
    with patch("app.guardrails_engine._kpi_score_for_project", return_value=100.0):
        result = compute_project_facts(mock_conn, "project-123", fact_sources)
    
    assert result["has_pcl"] == 1
    assert result["has_pcl__score"] == 100.0


def test_compute_project_facts_from_kpi_below_threshold(mock_conn):
    """compute_project_facts sets fact to 0 when KPI below threshold."""
    fact_sources = {
        "has_pcl": {"source": "kpi", "kpi_key": "pcl_assigned", "present_threshold": 100},
    }
    
    with patch("app.guardrails_engine._kpi_score_for_project", return_value=50.0):
        result = compute_project_facts(mock_conn, "project-123", fact_sources)
    
    assert result["has_pcl"] == 0


def test_compute_project_facts_from_kpi_no_threshold(mock_conn):
    """compute_project_facts uses > 0 check when no threshold."""
    fact_sources = {
        "has_pcl": {"source": "kpi", "kpi_key": "pcl_assigned", "present_threshold": None},
    }
    
    with patch("app.guardrails_engine._kpi_score_for_project", return_value=1.0):
        result = compute_project_facts(mock_conn, "project-123", fact_sources)
    
    assert result["has_pcl"] == 1


def test_compute_project_facts_from_project_attr(mock_conn):
    """compute_project_facts computes fact from project attribute."""
    fact_sources = {
        "custom_fact": {"source": "project_attr", "attr_key": "custom_field"},
    }
    
    with patch("app.guardrails_engine._project_attr", return_value="value123"):
        result = compute_project_facts(mock_conn, "project-123", fact_sources)
    
    assert result["custom_fact"] == "value123"


def test_compute_project_facts_unknown_source(mock_conn):
    """compute_project_facts sets fact to None for unknown source."""
    fact_sources = {
        "unknown": {"source": "invalid"},
    }
    
    result = compute_project_facts(mock_conn, "project-123", fact_sources)
    
    assert result["unknown"] is None


# --- _cmp ---

def test_cmp_equals():
    """_cmp handles == operator."""
    assert _cmp(5, "==", 5) is True
    assert _cmp(5, "==", 3) is False


def test_cmp_not_equals():
    """_cmp handles != operator."""
    assert _cmp(5, "!=", 3) is True
    assert _cmp(5, "!=", 5) is False


def test_cmp_greater_than():
    """_cmp handles > operator."""
    assert _cmp(5, ">", 3) is True
    assert _cmp(3, ">", 5) is False


def test_cmp_greater_equal():
    """_cmp handles >= operator."""
    assert _cmp(5, ">=", 5) is True
    assert _cmp(5, ">=", 3) is True
    assert _cmp(3, ">=", 5) is False


def test_cmp_less_than():
    """_cmp handles < operator."""
    assert _cmp(3, "<", 5) is True
    assert _cmp(5, "<", 3) is False


def test_cmp_less_equal():
    """_cmp handles <= operator."""
    assert _cmp(5, "<=", 5) is True
    assert _cmp(3, "<=", 5) is True
    assert _cmp(5, "<=", 3) is False


def test_cmp_invalid_operator():
    """_cmp returns False for invalid operator."""
    assert _cmp(5, "invalid", 3) is False


def test_cmp_handles_type_error():
    """_cmp handles type errors gracefully."""
    assert _cmp("not_a_number", ">", 3) is False


# --- _eval_clause ---

def test_eval_clause_simple_fact():
    """_eval_clause evaluates simple fact clause."""
    facts = {"has_pcl": 0}
    clause = {"fact": "has_pcl", "op": "==", "value": 0}
    
    assert _eval_clause(facts, clause) is True


def test_eval_clause_not():
    """_eval_clause handles not operator."""
    facts = {"has_pcl": 1}
    clause = {"not": {"fact": "has_pcl", "op": "==", "value": 0}}
    
    assert _eval_clause(facts, clause) is True  # not (1 == 0) = True


def test_eval_clause_missing_fact():
    """_eval_clause handles missing fact."""
    facts = {}
    clause = {"fact": "has_pcl", "op": "==", "value": 0}
    
    assert _eval_clause(facts, clause) is False


# --- _eval_when ---

def test_eval_when_all_of():
    """_eval_when evaluates all_of condition."""
    facts = {"has_pcl": 0, "has_annex": 1}
    when = {"all_of": [
        {"fact": "has_pcl", "op": "==", "value": 0},
        {"fact": "has_annex", "op": "==", "value": 1},
    ]}
    
    assert _eval_when(facts, when) is True


def test_eval_when_all_of_fails():
    """_eval_when returns False when all_of condition fails."""
    facts = {"has_pcl": 1, "has_annex": 1}
    when = {"all_of": [
        {"fact": "has_pcl", "op": "==", "value": 0},
        {"fact": "has_annex", "op": "==", "value": 1},
    ]}
    
    assert _eval_when(facts, when) is False


def test_eval_when_any_of():
    """_eval_when evaluates any_of condition."""
    facts = {"has_pcl": 1, "has_annex": 0}
    when = {"any_of": [
        {"fact": "has_pcl", "op": "==", "value": 0},
        {"fact": "has_annex", "op": "==", "value": 0},
    ]}
    
    assert _eval_when(facts, when) is True


def test_eval_when_empty():
    """_eval_when returns True for empty condition."""
    facts = {}
    when = {}
    
    assert _eval_when(facts, when) is True


def test_eval_when_unknown_structure():
    """_eval_when returns False for unknown structure."""
    facts = {}
    when = {"unknown": []}
    
    assert _eval_when(facts, when) is False


# --- apply_guardrails_for_project ---

def test_apply_guardrails_for_project_applies_cap(mock_conn):
    """apply_guardrails_for_project applies cap when rule triggers."""
    pillar_raw = {"gov": 80.0, "tct": 60.0}
    fact_sources = {"has_pcl": {"source": "kpi", "kpi_key": "pcl_assigned", "present_threshold": 100}}
    rules = [GuardrailRule(pillar_key="gov", cap=40.0, when={"all_of": [{"fact": "has_pcl", "op": "==", "value": 0}]})]
    
    with patch("app.guardrails_engine.load_fact_sources", return_value=fact_sources):
        with patch("app.guardrails_engine.load_guardrail_rules", return_value=rules):
            with patch("app.guardrails_engine.compute_project_facts", return_value={"has_pcl": 0}):
                result = apply_guardrails_for_project(mock_conn, "project-123", pillar_raw)
    
    assert result["gov"] == 40.0  # Capped
    assert result["tct"] == 60.0  # Not capped


def test_apply_guardrails_for_project_no_cap_when_not_triggered(mock_conn):
    """apply_guardrails_for_project doesn't apply cap when rule doesn't trigger."""
    pillar_raw = {"gov": 80.0}
    fact_sources = {"has_pcl": {"source": "kpi", "kpi_key": "pcl_assigned", "present_threshold": 100}}
    rules = [GuardrailRule(pillar_key="gov", cap=40.0, when={"all_of": [{"fact": "has_pcl", "op": "==", "value": 0}]})]
    
    with patch("app.guardrails_engine.load_fact_sources", return_value=fact_sources):
        with patch("app.guardrails_engine.load_guardrail_rules", return_value=rules):
            with patch("app.guardrails_engine.compute_project_facts", return_value={"has_pcl": 1}):
                result = apply_guardrails_for_project(mock_conn, "project-123", pillar_raw)
    
    assert result["gov"] == 80.0  # Not capped


def test_apply_guardrails_for_project_min_cap(mock_conn):
    """apply_guardrails_for_project uses min of current score and cap."""
    pillar_raw = {"gov": 30.0}
    fact_sources = {"has_pcl": {"source": "kpi", "kpi_key": "pcl_assigned", "present_threshold": 100}}
    rules = [GuardrailRule(pillar_key="gov", cap=40.0, when={"all_of": [{"fact": "has_pcl", "op": "==", "value": 0}]})]
    
    with patch("app.guardrails_engine.load_fact_sources", return_value=fact_sources):
        with patch("app.guardrails_engine.load_guardrail_rules", return_value=rules):
            with patch("app.guardrails_engine.compute_project_facts", return_value={"has_pcl": 0}):
                result = apply_guardrails_for_project(mock_conn, "project-123", pillar_raw)
    
    assert result["gov"] == 30.0  # Already below cap, so no change


# --- compute_raw_pillars_for_project ---

def test_compute_raw_pillars_for_project(mock_conn, mock_cursor):
    """compute_raw_pillars_for_project computes raw pillar scores."""
    mock_cursor.fetchall.return_value = [
        {"pillar_key": "gov", "raw_score_pct": 75.5},
        {"pillar_key": "tct", "raw_score_pct": 60.0},
    ]
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    result = compute_raw_pillars_for_project(mock_conn, "project-123")
    
    assert result["gov"] == 75.5
    assert result["tct"] == 60.0
    mock_cursor.execute.assert_called_once()


def test_compute_raw_pillars_for_project_empty(mock_conn, mock_cursor):
    """compute_raw_pillars_for_project returns empty dict when no pillars."""
    mock_cursor.fetchall.return_value = []
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    result = compute_raw_pillars_for_project(mock_conn, "project-123")
    
    assert result == {}


# --- diagnose_guardrails_for_project ---

@patch("app.guardrails_engine.psycopg.connect")
def test_diagnose_guardrails_for_project(mock_connect, mock_conn, mock_cursor):
    """diagnose_guardrails_for_project returns full diagnostic payload."""
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_connect.return_value.__exit__.return_value = None
    
    # Mock project lookup
    mock_cursor.fetchone.return_value = ("project-123",)
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    fact_sources = {"has_pcl": {"source": "kpi", "kpi_key": "pcl_assigned", "present_threshold": 100}}
    rules = [GuardrailRule(pillar_key="gov", cap=40.0, when={"all_of": [{"fact": "has_pcl", "op": "==", "value": 0}]})]
    
    with patch("app.guardrails_engine.load_fact_sources", return_value=fact_sources):
        with patch("app.guardrails_engine.load_guardrail_rules", return_value=rules):
            with patch("app.guardrails_engine.compute_project_facts", return_value={"has_pcl": 0}):
                with patch("app.guardrails_engine.compute_raw_pillars_for_project", return_value={"gov": 80.0}):
                    result = diagnose_guardrails_for_project("test-project")
    
    assert "project" in result
    assert "facts" in result
    assert "rules" in result
    assert "pillar_raw" in result
    assert "pillar_final" in result
    assert "triggers" in result
    assert len(result["triggers"]) > 0


@patch("app.guardrails_engine.psycopg.connect")
def test_diagnose_guardrails_for_project_unknown_slug(mock_connect, mock_conn, mock_cursor):
    """diagnose_guardrails_for_project raises ValueError for unknown project slug."""
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_connect.return_value.__exit__.return_value = None
    
    mock_cursor.fetchone.return_value = None
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    mock_conn.cursor.return_value.__exit__.return_value = None
    
    with pytest.raises(ValueError) as exc_info:
        diagnose_guardrails_for_project("unknown-project")
    
    assert "Unknown project slug" in str(exc_info.value)
