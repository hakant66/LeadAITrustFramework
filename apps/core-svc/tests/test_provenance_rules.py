from app.services.provenance_rules import evaluate_provenance, load_rules_config


def _base_facts():
    return {
        "source": {"system_name": "CRM"},
        "purpose": {"intended_use": "Document processing"},
        "data_categories": {
            "included": ["contracts", "emails"],
            "excluded": ["biometric"],
            "findings": {"sensitive_included": False},
        },
        "personal_data": {"present": True, "treatment": "pseudonymized"},
        "legal_basis": {"basis": ["contract"]},
        "geography": {"regions": ["EU"]},
        "retention": {"period_months": 24},
        "versioning": {"manifest_hash": "abc123"},
        "evidence": {
            "present": ["DPIA", "DPA"],
            "status": {"DPIA": "valid"},
            "integrity": {
                "any_hash_mismatch": False,
                "all_linked_valid": True,
                "DPIA": "valid",
            },
        },
        "signals": {
            "schema_drift_detected": False,
            "dataset_usage_outside_purpose_detected": False,
            "retention_violations_detected": False,
            "manifest_hash_verified": True,
            "manifest_change_requires_approval": True,
            "evidence_integrity_checks_within_days": 10,
            "attestation": {
                "source_system_within_days": 30,
                "data_categories_within_days": 30,
                "legal_basis_within_days": 30,
                "purpose_within_days": 30,
                "geography_within_days": 30,
                "retention_within_days": 30,
            },
            "pseudonymisation_control_verified": True,
            "continuous_ok": True,
        },
    }


def test_rules_config_loads():
    config = load_rules_config()
    assert config["version"] >= 1
    assert "hard_gates" in config
    assert "fields" in config


def test_baseline_good_facts_reaches_p2_or_higher():
    result = evaluate_provenance(_base_facts(), include_debug=False)
    assert result["overall"]["level"] in ("P2", "P3")


def test_missing_dpia_for_personal_data_forces_p0():
    facts = _base_facts()
    facts["evidence"]["status"]["DPIA"] = "missing"
    result = evaluate_provenance(facts, include_debug=False)
    assert result["overall"]["level"] == "P0"
    gate_ids = {gate["gate_id"] for gate in result["gates"]}
    assert "missing_dpia_when_personal_data" in gate_ids


def test_evidence_hash_mismatch_forces_p0():
    facts = _base_facts()
    facts["evidence"]["integrity"]["any_hash_mismatch"] = True
    result = evaluate_provenance(facts, include_debug=False)
    assert result["overall"]["level"] == "P0"
    gate_ids = {gate["gate_id"] for gate in result["gates"]}
    assert "evidence_hash_mismatch" in gate_ids


def test_sensitive_data_included_forces_p0():
    facts = _base_facts()
    facts["data_categories"]["findings"]["sensitive_included"] = True
    result = evaluate_provenance(facts, include_debug=False)
    assert result["overall"]["level"] == "P0"
    gate_ids = {gate["gate_id"] for gate in result["gates"]}
    assert "sensitive_data_included" in gate_ids


def test_missing_manifest_hash_downgrades_manifest_integrity():
    facts = _base_facts()
    facts["versioning"]["manifest_hash"] = ""
    result = evaluate_provenance(facts, include_debug=False)
    manifest_field = next(
        field for field in result["fields"] if field["field"] == "manifest_integrity"
    )
    assert manifest_field["level"] == "P0"
    assert result["overall"]["level"] in ("P0", "P1")
