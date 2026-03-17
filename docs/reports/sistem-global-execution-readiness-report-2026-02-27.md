# Ad-hoc Execution Readiness Report

- Entity: Sistem Global Danışmanlık A.Ş. (`sistem-global-dan-manl-k-a`)
- Generated at: 2026-02-27
- Scope requested: Projects ready for Governance Execution stage, with planned regulatory frameworks and required KPIs.

## Readiness Rule Used
A project is treated as **READY for Execution** when all are true:
1. Entity governance setup policy status is `finalised`.
2. Project has at least one AI System record.
3. Project has at least one Requirement record.
4. Project has at least one Control Value record (KPI/control mapped).

## Result: Ready Projects
No projects are currently READY for Execution for this entity.

## Entity Status
- Governance setup policy status: `finalised`

## Project-by-Project Snapshot
| Project Slug | Project Name | AI Systems | Requirements | Controls | Frameworks (planned) | KPI Count | Status |
|---|---|---:|---:|---:|---|---:|---|
| `ai-document-processing` | YZ ile dokuman takibi | 1 | 0 | 0 | - | 0 | NOT_READY |
| `ai-kk-kampanya` | Kredi Kartı Kampanyaları | 1 | 0 | 0 | - | 0 | NOT_READY |
| `hr-ai-chatbot` | IK Kurumsal YZ Chatbot | 0 | 2 | 35 | `eu_ai_act`, `iso_42001` | 35 | NOT_READY |
| `kontrat-analizi` | YZ ile Kontrat Kontrolü | 1 | 0 | 0 | - | 0 | NOT_READY |
| `sgd-finans-durum-analizi` | Finansal Durum Analizi | 0 | 1 | 35 | `iso_42001` | 35 | NOT_READY |
| `sgd-yz-teklif-asistanı` | YZ Teklif Asistanı | 1 | 0 | 0 | - | 0 | NOT_READY |

## Frameworks and Required KPIs for Near-Ready Projects
Because there are no fully READY projects, these are listed for projects that already have frameworks + KPI/control mappings:

### `sgd-finans-durum-analizi` (NOT_READY: missing AI System)
- Planned frameworks: `iso_42001`
- Required KPI keys (35):
`aisia_completion_rate`, `appeal_time_hours`, `audit_log_integrity`, `cert_lead_time_days`, `compliance_scorecard`, `control_ux_csat`, `critical_vulnerability_density`, `data_quality_index`, `decision_traceability`, `demographic_parity_delta`, `drift_monitor_coverage`, `drift_mtta_hours`, `dsr_sla_days`, `explanation_latency_ms`, `factsheet_completion`, `fallback_success`, `findings_sla_days`, `hitl_coverage`, `horizon_scan_days`, `ip_cleanliness`, `jailbreak_resilience_rate`, `pcl_assignment_rate`, `phase_gate_ontime`, `pii_minimisation`, `policy_exceptions`, `post_incident_mttr`, `preaudit_nc_closure`, `provenance_coverage`, `reg_delta_rate`, `revalidation_coverage`, `staff_certification_rate`, `trust_backlog_coverage`, `vta_coverage`, `xai_ui_coverage`, `xai_validation_rate`

### `hr-ai-chatbot` (NOT_READY: missing AI System)
- Planned frameworks: `eu_ai_act`, `iso_42001`
- Required KPI keys (35):
`aisia_completion_rate`, `appeal_time_hours`, `audit_log_integrity`, `cert_lead_time_days`, `compliance_scorecard`, `control_ux_csat`, `critical_vulnerability_density`, `data_quality_index`, `decision_traceability`, `demographic_parity_delta`, `drift_monitor_coverage`, `drift_mtta_hours`, `dsr_sla_days`, `explanation_latency_ms`, `factsheet_completion`, `fallback_success`, `findings_sla_days`, `hitl_coverage`, `horizon_scan_days`, `ip_cleanliness`, `jailbreak_resilience_rate`, `pcl_assignment_rate`, `phase_gate_ontime`, `pii_minimisation`, `policy_exceptions`, `post_incident_mttr`, `preaudit_nc_closure`, `provenance_coverage`, `reg_delta_rate`, `revalidation_coverage`, `staff_certification_rate`, `trust_backlog_coverage`, `vta_coverage`, `xai_ui_coverage`, `xai_validation_rate`

