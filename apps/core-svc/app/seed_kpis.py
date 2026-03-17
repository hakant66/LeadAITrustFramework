from sqlalchemy.orm import Session
from .db import engine
from .models import Pillar, KPI

PILLARS = [
  ("governance", "AI-as-a-Product Governance", 0.20),
  ("pre_gtm", "Pre-Go-to-Market Trust Certification", 0.20),
  ("data", "Data Value & Responsible Sourcing", 0.20),
  ("transparency", "Auditable Transparency & XAI", 0.15),
  ("human", "Human-Centered Resilience & Control", 0.15),
  ("cra_drift", "Continuous Reg Alignment & Drift", 0.10),
]

# key, name, unit, invert, (min_ideal, max_ideal), description
GOVERNANCE = [
  ("pcl_assignment_rate", "PCL assignment rate", "%", False, None, "0 or 100 per project"),
  ("compliance_scorecard", "Compliance Scorecard", "%", False, None, "latest gate score vs threshold"),
  ("findings_sla_days", "Findings SLA (days)", "days", True, (0, 30), "median days to close findings"),
  ("trust_backlog_coverage", "Trust-in-backlog coverage", "%", False, None, "stories with trust criteria / relevant stories"),
  ("phase_gate_ontime", "Phase-gate on-time", "%", False, None, "gates passed on planned date"),
  ("policy_exceptions", "Policy exceptions (#/release)", "count", True, (0, 10), "open exceptions at release"),
]

PRE_GTM = [
  ("iso42001_readiness", "ISO/IEC 42001 readiness", "%", False, None, "coverage met ÷ in-scope controls"),
  ("factsheet_completion", "External Trust Factsheet completion", "%", False, None, ""),
  ("preaudit_nc_closure", "Pre-audit nonconformities (closure rate)", "%", False, None, "normalised 0–100 by closure"),
  ("vta_coverage", "Vendor Trust Assessment coverage", "%", False, None, "third-party with VTA / total TP in BOM"),
  ("cert_lead_time_days", "Certification lead time", "days", True, (0, 60), "start → pre-GTM sign-off"),
]

DATA = [
  ("provenance_coverage", "Provenance & licensing coverage", "%", False, None, ""),
  ("ip_cleanliness", "IP/Copyright cleanliness", "%", False, None, ""),
  ("pii_minimisation", "PII minimisation", "%", False, None, ""),
  ("data_quality_index", "Data quality index", "%", False, None, ""),
  ("dsr_sla_days", "DSR/erasure SLA (days)", "days", True, (0, 30), ""),
]

TRANS = [
  ("xai_ui_coverage", "UI XAI coverage", "%", False, None, ""),
  ("decision_traceability", "Logged decision traceability", "%", False, None, ""),
  ("xai_validation_rate", "XAI validation pass rate", "%", False, None, ""),
  ("audit_log_integrity", "Audit log integrity", "%", False, None, ""),
  ("explanation_latency_ms", "Explanation latency (p95)", "ms", True, (0, 1000), ""),
]

HUMAN = [
  ("hitl_coverage", "Human-in-the-loop coverage", "%", False, None, ""),
  ("appeal_time_hours", "Appeal/override time", "hours", True, (0, 48), ""),
  ("fallback_success", "Safe fallback success rate", "%", False, None, ""),
  ("control_ux_csat", "Control UX satisfaction (0–10→%)", "%", False, None, ""),
  ("post_incident_mttr", "Post-incident MTTR", "hours", True, (0, 24), ""),
]

CRA = [
  ("reg_delta_rate", "Reg-delta implementation rate", "%", False, None, ""),
  ("horizon_scan_days", "Horizon-scan cadence (days)", "days", True, (0, 30), ""),
  ("drift_monitor_coverage", "Drift monitor coverage", "%", False, None, ""),
  ("drift_mtta_hours", "Drift response MTTA (hours)", "hours", True, (0, 8), ""),
  ("revalidation_coverage", "Re-validation coverage", "%", False, None, ""),
]

def run():
    with Session(engine) as s:
        key_to_pillar = {}
        for key, name, weight in PILLARS:
            p = s.query(Pillar).filter_by(key=key).first()
            if not p:
                p = Pillar(key=key, name=name, weight=weight)
                s.add(p); s.flush()
            key_to_pillar[key] = p

        def add_batch(pillar_key, items):
            p = key_to_pillar[pillar_key]
            for key, name, unit, invert, rng, desc in items:
                if not s.query(KPI).filter_by(key=key).first():
                    min_ideal = rng[0] if rng else None
                    max_ideal = rng[1] if rng else None
                    s.add(KPI(key=key, name=name, pillar_id=p.id, unit=unit, invert=invert,
                              min_ideal=min_ideal, max_ideal=max_ideal, description=desc))

        add_batch("governance", GOVERNANCE)
        add_batch("pre_gtm", PRE_GTM)
        add_batch("data", DATA)
        add_batch("transparency", TRANS)
        add_batch("human", HUMAN)
        add_batch("cra_drift", CRA)
        s.commit()

if __name__ == "__main__":
    run()
