"""seed iso_42001 and eu_ai_act clauses for kpi_definition

Revision ID: 4782379f39f7
Revises: 1188b39e61fc
Create Date: 2025-12-09 21:29:12.384362

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4782379f39f7'
down_revision: Union[str, Sequence[str], None] = '1188b39e61fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        WITH mapping (kpi_key, iso_42001_clause, eu_ai_act_clause) AS (
            VALUES
                ('phase_gate_ontime',       'ISO42001:8.2.2', 'Art. 17 QMS — Lifecycle Controls'),
                ('factsheet_completion',    'ISO42001:7.5',   'Art. 11 Technical Documentation'),
                ('audit_log_integrity',     'ISO42001:8.5',   'Art. 12 Record-keeping & Logging'),
                ('fallback_success',        'ISO42001:8.4',   'Art. 15 Robustness, Accuracy, Cybersecurity'),
                ('findings_sla_days',       'ISO42001:10.2',  'Art. 17 QMS — Corrective Actions'),
                ('hitl_coverage',           'ISO42001:8.4',   'Art. 14 Human Oversight'),
                ('provenance_coverage',     'ISO42001:8.5',   'Art. 10 Data Governance & Management'),
                ('pcl_assignment_rate',     'ISO42001:5.3',   'Art. 17 QMS — Roles & Responsibilities'),
                ('xai_validation_rate',     'ISO42001:8.2.4', 'Art. 15 Robustness & Transparency'),
                ('policy_exceptions',       'ISO42001:10.1',  'Art. 17 QMS — Compliance Controls'),
                ('explanation_latency_ms',  'ISO42001:8.2.5', 'Art. 13 Transparency & Information for Users'),
                ('dsr_sla_days',            'ISO42001:7.4',   'GDPR-linked — Acts referenced by Art. 10'),
                ('post_incident_mttr',      'ISO42001:10.1',  'Art. 17 — Incident Response'),
                ('drift_mtta_hours',        'ISO42001:9.1',   'Art. 15 Monitoring & Risk Management'),
                ('decision_traceability',   'ISO42001:8.5',   'Art. 12 Logging & Traceability'),
                ('trust_backlog_coverage',  'ISO42001:10.2',  'Art. 17 QMS Continuous Improvement'),
                ('cert_lead_time_days',     'ISO42001:8.6',   'Art. 43 Conformity Assessment'),
                ('data_quality_index',      'ISO42001:8.2.2', 'Art. 10 Training & Test Data Quality'),
                ('xai_ui_coverage',         'ISO42001:8.4',   'Art. 13 Transparency Obligations'),
                ('compliance_scorecard',    'ISO42001:9.2',   'Art. 17 Internal Controls'),
                ('appeal_time_hours',       'ISO42001:8.4',   'Art. 14 Human Oversight (User Redress)'),
                ('horizon_scan_days',       'ISO42001:4.2',   'Art. 17 QMS — Regulatory Updates'),
                ('preaudit_nc_closure',     'ISO42001:10.2',  'Art. 17 QMS — Non-conformities'),
                ('control_ux_csat',         'ISO42001:7.3',   'Art. 13 & Art. 14 User Experience & Clarity'),
                ('pii_minimisation',        'ISO42001:8.2.2', 'GDPR Art.5 + referenced in EU AI Act Art. 10'),
                ('revalidation_coverage',   'ISO42001:8.2.4', 'Art. 15 Continuous Validation'),
                ('vta_coverage',            'ISO42001:8.2.2', 'Art. 10 Data Suitability'),
                ('ip_cleanliness',          'ISO42001:8.2.2', 'Art. 10 Data Legality & Licensing'),
                ('reg_delta_rate',          'ISO42001:6.3',   'Art. 17 QMS — Updating Procedures'),
                ('drift_monitor_coverage',  'ISO42001:9.1',   'Art. 15 Performance Monitoring')
        )
        UPDATE kpi_definition AS kd
        SET
            iso_42001_clause = m.iso_42001_clause,
            eu_ai_act_clause = m.eu_ai_act_clause
        FROM mapping AS m
        WHERE kd.kpi_key = m.kpi_key;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE kpi_definition
        SET
            iso_42001_clause = NULL,
            eu_ai_act_clause = NULL
        WHERE kpi_key IN (
            'phase_gate_ontime',
            'factsheet_completion',
            'audit_log_integrity',
            'fallback_success',
            'findings_sla_days',
            'hitl_coverage',
            'provenance_coverage',
            'pcl_assignment_rate',
            'xai_validation_rate',
            'policy_exceptions',
            'explanation_latency_ms',
            'dsr_sla_days',
            'post_incident_mttr',
            'drift_mtta_hours',
            'decision_traceability',
            'trust_backlog_coverage',
            'cert_lead_time_days',
            'data_quality_index',
            'xai_ui_coverage',
            'compliance_scorecard',
            'appeal_time_hours',
            'horizon_scan_days',
            'preaudit_nc_closure',
            'control_ux_csat',
            'pii_minimisation',
            'revalidation_coverage',
            'vta_coverage',
            'ip_cleanliness',
            'reg_delta_rate',
            'drift_monitor_coverage'
        );
        """
    )