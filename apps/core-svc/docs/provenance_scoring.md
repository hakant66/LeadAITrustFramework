# Provenance Scoring (MVP3)

This document describes the provenance rule evaluation integrated into the
LeadAI scorecard flow.

## Overview
- Provenance is scored from P0 to P3 based on manifest facts and evidence
  integrity.
- Rules are YAML-driven (`config/provenance_rules.yaml`) and evaluated in a
  deterministic order: hard gates -> field rules -> rollup -> gate override.
- Results are included in `GET /scorecard/{project_slug}` as an additive
  `provenance` object.

## Manifest Facts Contract
These fields are expected in `manifest_facts` (JSON):
- `source.system_name` (string)
- `purpose.intended_use` (string)
- `data_categories.included` (list[string])
- `data_categories.excluded` (list[string])
- `data_categories.findings.sensitive_included` (bool)
- `personal_data.present` (bool)
- `personal_data.treatment` (string)
- `legal_basis.basis` (list[string])
- `geography.regions` (list[string])
- `retention.period_months` (number)
- `versioning.manifest_hash` (string)

Evidence summary:
- `evidence.present` (list[string])
- `evidence.status.DPIA` ("valid"|"missing"|"expired"|"invalid")
- `evidence.integrity.any_hash_mismatch` (bool)
- `evidence.integrity.all_linked_valid` (bool)
- `evidence.integrity.<TYPE>` ("valid"|"invalid")

Signals (optional, for higher levels):
- `signals.schema_drift_detected` (bool)
- `signals.dataset_usage_outside_purpose_detected` (bool)
- `signals.retention_violations_detected` (bool)
- `signals.manifest_hash_verified` (bool)
- `signals.manifest_change_requires_approval` (bool)
- `signals.evidence_integrity_checks_within_days` (number)
- `signals.attestation.*_within_days` (numbers)
- `signals.pseudonymisation_control_verified` (bool)
- `signals.continuous_ok` (bool)

## Hard Gates (non-negotiable)
- Missing/expired/invalid DPIA when `personal_data.present=true` => P0
- Evidence hash mismatch => P0
- Sensitive data included => P0

## Rollup Rules
Rollup mode: `gated_floor`
- P2 requires all mandatory fields at P2 or higher
- P3 requires all mandatory fields at P2+, plus a fraction of fields at P3 and
  `signals.continuous_ok=true`
- P1 requires a minimum fraction of fields at P1+

## Ingestion Path (Option 2)
Manifest facts are stored as JSON per project in `provenance_manifest_facts`.
You can supply facts by adding `manifest_facts` to the existing scorecard update:

```
POST /scorecard/{project_slug}
{
  "scores": [{ "key": "kpi_key", "value": 42 }],
  "manifest_facts": { ... }
}
```

The API remains backward compatible; `manifest_facts` is optional.

## Output Fields
`GET /scorecard/{project_slug}` includes:
```
provenance: {
  overall_level: "P0|P1|P2|P3",
  overall_score_pct: 0|33|66|100,
  fields: [{ field, level, reasons }],
  gates:  [{ gate_id, forced_level, reasons }],
  evaluated_at,
  rules_version,
  rules_hash
}
```

## Evidence Types
Evidence type keys are free-form but should match the keys in
`evidence.status.<TYPE>` and `evidence.integrity.<TYPE>`.

