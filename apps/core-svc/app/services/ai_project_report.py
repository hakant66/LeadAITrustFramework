# app/services/ai_project_report.py
from dataclasses import dataclass
from typing import List, Dict, Optional, Any
from datetime import datetime


@dataclass
class KpiRow:
    pillar: str
    kpi_name: str
    kpi_key: str
    target: Optional[str]
    current_value: Any
    kpi_score: Optional[float]
    evidence: Optional[str]
    owner: Optional[str]
    date: str


def get_score_band(score: float) -> tuple[str, str]:
    """
    Return (band_label, icon) for a given score.
    """
    if score >= 80:
        return "Strong", "🟢"
    elif score >= 60:
        return "Moderate", "🟡"
    elif score >= 40:
        return "Weak", "🟠"
    else:
        return "Critical", "🔴"


def format_value(val: Any) -> str:
    if val is None:
        return "N/A"
    if isinstance(val, float):
        # Avoid too many decimals in tables
        return f"{val:.0f}" if val.is_integer() else f"{val:.2f}"
    return str(val)


def _shorten(text: Optional[str], max_len: int = 40) -> str:
    if not text:
        return ""
    text = text.strip()
    return text if len(text) <= max_len else text[: max_len - 1] + "…"


# Canonical pillar order for potential future use (kept for extensibility)
PILLAR_ORDER_LIST = [
    "AI-as-a-Product Governance",
    "Continuous Regulatory Alignment",
    "Pre-GTM Trust Certification",
    "Transparency & XAI-by-Design",
    "Data Value & Responsible Sourcing",
    "Human-Centered Resilience",
]
PILLAR_ORDER = {name: i for i, name in enumerate(PILLAR_ORDER_LIST)}


def build_ai_project_report(
    project_name: str,
    project_slug: str,
    kpis: List[KpiRow],
) -> str:
    """
    Build a professional, PDF-friendly AI project report in Markdown
    following the requested structure and formatting:

    - Centered bold title: "AI Project Report"
    - Project / Generated line
    - 1.Executive Summary (bold)
    - 2.Recommendations (Prioritised) (bold)
    - 3. Cross-Pillar Risk Summary (bold)
      - Critical Risks (red, underlined)
      - Moderate Risks (orange, underlined)
      - Low Risks (dark green, underlined)
    """

    # -------------------------------------------------------------------------
    # 1) Group KPIs by pillar and compute pillar statistics
    # -------------------------------------------------------------------------
    pillars: Dict[str, List[KpiRow]] = {}
    for row in kpis:
        p = row.pillar or "Unassigned"
        pillars.setdefault(p, []).append(row)

    pillar_stats: List[dict] = []
    total_score = 0.0
    scored_pillars = 0

    for pillar_name, rows in pillars.items():
        scores = [float(r.kpi_score) for r in rows if r.kpi_score is not None]
        avg_score = sum(scores) / len(scores) if scores else 0.0
        band, icon = get_score_band(avg_score)

        pillar_stats.append(
            {
                "name": pillar_name,
                "score": avg_score,
                "band": band,
                "icon": icon,
                "rows": rows,
            }
        )

        if scores:
            total_score += avg_score
            scored_pillars += 1

    overall_score = total_score / scored_pillars if scored_pillars else 0.0
    overall_band, overall_icon = get_score_band(overall_score)

    # Sort pillars from lowest score (highest risk) to highest
    pillar_stats.sort(key=lambda p: p["score"])

    # Keep strongest / weakest lists in case we want them later (not printed now)
    weakest_pillars = pillar_stats[:3] if pillar_stats else []
    strongest_pillars = pillar_stats[-3:] if pillar_stats else []

    # Helper: nice list formatting for pillar names with scores
    def _pillar_label(p: dict) -> str:
        return f"{p['name']} – {p['score']:.1f}%"

    # -------------------------------------------------------------------------
    # 2) Narrative helpers
    # -------------------------------------------------------------------------
    def overall_posture_text(score: float) -> str:
        if score < 40:
            return (
                "A critically weak trust and governance posture with material "
                "gaps across governance, regulatory alignment, and safeguards."
            )
        elif score < 55:
            return (
                "A moderate but not yet compliant posture for a production AI "
                "system. Several high-risk areas require remediation before "
                "the system can be considered robust."
            )
        elif score < 70:
            return (
                "A generally stable posture with some important weaknesses. "
                "Foundational controls are present, but improvements are "
                "needed to reach strong compliance readiness."
            )
        elif score < 85:
            return (
                "A strong and improving posture with good governance and "
                "operational discipline. Targeted enhancements can raise "
                "maturity to best-practice levels."
            )
        else:
            return (
                "A highly mature and well-governed AI trust posture. Focus "
                "should be on continuous improvement and preventing regression."
            )

    def pillar_status_sentence(band: str) -> str:
        if band == "Strong":
            return (
                "Controls in this pillar are generally effective. The main goal "
                "is to maintain performance and avoid regression."
            )
        if band == "Moderate":
            return (
                "The pillar is mostly effective but has noticeable gaps that "
                "should be addressed to achieve a robust, auditable state."
            )
        if band == "Weak":
            return (
                "This pillar shows weak performance, with several KPIs below "
                "target. It represents a meaningful source of operational and "
                "compliance risk."
            )
        # Critical
        return (
            "This is a critically underperforming pillar. KPI results indicate "
            "high risk and likely non-compliance with internal policy and "
            "external regulatory expectations."
        )

    def pillar_recommendations(band: str) -> List[str]:
        if band in ("Strong", "Moderate"):
            return [
                "Identify KPIs scoring below ~60% and define specific corrective actions.",
                "Tighten monitoring, SLAs, and accountability for underperforming controls.",
                "Improve documentation and evidence quality to strengthen audit readiness.",
            ]
        if band == "Weak":
            return [
                "Prioritise this pillar in remediation roadmaps and risk registers.",
                "Assign clear owners for the lowest-scoring KPIs with deadlines.",
                "Introduce interim safeguards and monitoring while long-term fixes are implemented.",
            ]
        # Critical
        return [
            "Escalate this pillar as a critical risk to governance and risk committees.",
            "Implement short-term safety controls or guardrails to reduce immediate exposure.",
            "Design and execute a structured remediation program with milestones and regular review.",
        ]

    # -------------------------------------------------------------------------
    # 3) Build Markdown in the requested format
    # -------------------------------------------------------------------------
    md: List[str] = []

    # --- Title: bigger, bold, centered --------------------------------------
    md.append(
        '<p style="text-align: center;"><strong><span style="font-size: 20pt;">AI Project Report</span></strong></p>'
    )
    md.append("")

    # --- Project line --------------------------------------------------------
    md.append(
        f"Project: {project_name} ({project_slug})    "
        f"Generated on: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )
    md.append("")
    md.append("<br/>")

    # (3) One empty line before 1.Executive Summary
    md.append("")

    # -------------------------------------------------------------------------
    # 1. Executive Summary (bold, numbered)
    # -------------------------------------------------------------------------
    md.append("**1.Executive Summary**")
    md.append("")
    md.append(
        f"Overall trust & governance posture: ~{overall_score:.0f}% "
        f"({overall_icon} {overall_band})"
    )
    md.append("")
    md.append(
        "This project demonstrates strengths in the higher-scoring pillars, "
        "but risk and compliance exposure is concentrated in the lowest-scoring "
        "areas. Remediation should be planned and executed starting from the "
        "weakest pillars upwards."
    )
    md.append("")
    md.append(overall_posture_text(overall_score))
    md.append("")
    md.append(
        "Critical and weak pillars should be treated as key risks in the AI risk "
        "register, with clear owners, timelines, and evidence of remediation. "
        "Strong pillars can act as exemplars and sources of good practice."
    )
    md.append("")
    md.append(
        "Top Immediate Fixes: Stabilise the lowest-scoring pillars, close "
        "critical KPI gaps, and strengthen monitoring and ownership for all "
        "underperforming controls."
    )
    md.append(
        "Path to Compliance: Achievable within 1–3 months for most projects, "
        "provided a structured remediation roadmap is owned and tracked "
        "through existing risk and governance forums."
    )
    md.append("")
    md.append("<br/>")

    # NOTE:
    # - Strongest/Weakest pillar summary lines REMOVED as requested.
    # - Pillar score list REMOVED from Executive Summary.

    # -------------------------------------------------------------------------
    # 2. Recommendations (Prioritised) (bold, numbered)
    # -------------------------------------------------------------------------
    # (3) One empty line before 2.Recommendations (Prioritised)
    md.append("")
    md.append("**2.Recommendations (Prioritised)**")
    md.append("")
    md.append("Immediate (0–1 months)")
    md.append("")
    md.append("• Focus on pillars scored below 60% and stabilise the weakest KPIs.")
    md.append("• Assign accountable owners and due dates for all critical and weak KPIs.")
    md.append(
        "• Improve monitoring, alerting, and documentation for underperforming controls."
    )
    md.append("")
    md.append("Near-term (1–2 months)")
    md.append("")
    md.append("• Strengthen processes, workflows, and automation supporting key controls.")
    md.append(
        "• Enhance auditability: evidence, traceability, and decision rationales."
    )
    md.append(
        "• Reduce variability in KPI performance across teams and environments."
    )
    md.append("")
    md.append("Medium-term (2–3 months)")
    md.append("")
    md.append(
        "• Institutionalise an AI trust and governance framework across projects."
    )
    md.append(
        "• Standardise controls, KPIs, and reporting across the AI product portfolio."
    )
    md.append(
        "• Regularly recompute KPIs and regenerate this report to show improvement."
    )
    md.append("")
    md.append("<br/>")
    # -------------------------------------------------------------------------
    # 3. Cross-Pillar Risk Summary (bold, numbered)
    # -------------------------------------------------------------------------
    # (3) One empty line before 3. Cross-Pillar Risk Summary
    md.append("")
    md.append("**3. Cross-Pillar Risk Summary**")
    md.append("")

    # Group pillars by risk band
    critical = [p for p in pillar_stats if p["score"] < 40]
    moderate_risk = [p for p in pillar_stats if 40 <= p["score"] < 80]
    low_risk = [p for p in pillar_stats if p["score"] >= 80]

    # Critical Risks (Red, underlined)
    md.append('<u><span style="color: red;">Critical Risks</span></u>')
    md.append("")
    if critical:
        for p in critical:
            md.append("")
            md.append(
                f"- {p['name']} – {p['score']:.1f}% – critical underperformance and high risk."
            )
            md.append("")
            md.append("Assessment")
            md.append("")
            md.append(pillar_status_sentence("Critical"))
            md.append(
                "The distribution of KPI scores in this pillar provides a clear view "
                "of where governance and operational discipline are strongest and "
                "where corrective action is required."
            )
            md.append("")
            md.append("Recommendations")
            md.append("")
            for rec in pillar_recommendations("Critical"):
                md.append(f"• {rec}")
    else:
        md.append("No pillars currently scored as critical (<40%).")
    md.append("")

    # Moderate Risks (Orange, underlined)
    md.append('<u><span style="color: orange;">Moderate Risks</span></u>')
    md.append("")
    if moderate_risk:
        for p in moderate_risk:
            if p["score"] < 60:
                summary = "weak performance; prioritise remediation."
                band_for_text = "Weak"
            else:
                summary = "broadly effective but with notable gaps."
                band_for_text = "Moderate"

            md.append("")
            md.append(
                f"- {p['name']} – {p['score']:.1f}% – {summary}"
            )
            md.append("")
            md.append("Assessment")
            md.append("")
            md.append(pillar_status_sentence(band_for_text))
            md.append(
                "The distribution of KPI scores in this pillar provides a clear view "
                "of where governance and operational discipline are strongest and "
                "where corrective action is required."
            )
            md.append("")
            md.append("Recommendations")
            md.append("")
            for rec in pillar_recommendations(band_for_text):
                md.append(f"• {rec}")
    else:
        md.append("No pillars currently in the weak or moderate bands (<80%).")
    md.append("")

    # Low Risks (Dark Green, underlined)
    md.append('<u><span style="color: darkgreen;">Low Risks</span></u>')
    md.append("")
    if low_risk:
        for p in low_risk:
            md.append("")
            md.append(
                f"- {p['name']} – {p['score']:.1f}% – strong and resilient performance."
            )
            md.append("")
            md.append("Assessment")
            md.append("")
            md.append(pillar_status_sentence("Strong"))
            md.append(
                "The distribution of KPI scores in this pillar provides a clear view "
                "of where governance and operational discipline are strongest and "
                "where corrective action can still refine best practices."
            )
            md.append("")
            md.append("Recommendations")
            md.append("")
            for rec in pillar_recommendations("Strong"):
                md.append(f"• {rec}")
    else:
        md.append("No pillars currently scored as low risk (≥80%).")

    return "\n".join(md)
