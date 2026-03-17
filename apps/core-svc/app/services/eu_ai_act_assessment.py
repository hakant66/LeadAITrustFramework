"""EU AI Act (Regulation (EU) 2024/1689) decision-tree assessment.

This module implements a minimal, traceable decision tree for:
1) Operator role identification (Provider/Deployer/Importer/Distributor/etc.)
2) Risk classification (High-Risk vs Non-High-Risk)

Each decision point includes a citation comment for traceability.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class EUAIAssessmentInput:
    # Operator role questions
    provider: bool
    deployer: bool
    importer: bool
    distributor: bool
    authorized_representative: bool
    substantial_modifier: bool
    product_manufacturer: bool
    non_eu_rep_appointed: bool
    distributor_access: bool
    importer_non_original: bool
    provide_as_is: bool

    # Risk classification questions
    in_scope_ai: bool
    prohibited_practices: bool
    safety_component: bool
    annex_iii_sensitive: bool
    narrow_procedural: bool
    profiling: bool


@dataclass
class EUAIAssessmentResult:
    primary_role: str
    roles: List[str]
    risk_classification: str
    obligations: List[str]
    warnings: List[str]
    responsibilities_by_role: Dict[str, List[str]]
    responsibilities_summary: List[Dict[str, str]]
    decision_trace: List[Dict[str, str]] = field(default_factory=list)


class EUAIAssessment:
    """EU AI Act assessment decision tree.

    All decisions are annotated in comments with the relevant citation.
    """

    def __init__(self, inputs: EUAIAssessmentInput):
        self.inputs = inputs
        self.trace: List[Dict[str, str]] = []

    def _trace(self, decision: str, citation: str) -> None:
        self.trace.append({"decision": decision, "citation": citation})

    def evaluate(self) -> EUAIAssessmentResult:
        roles: List[str] = []
        warnings: List[str] = []

        # Role: Provider if developing/branding AI.
        # Article 3(3)
        if self.inputs.provider:
            roles.append("Provider")
            self._trace("Provider role selected (develop/brand AI)", "Art. 3(3)")

        # Role: Deployer if professional use under authority.
        # Article 3(4)
        if self.inputs.deployer:
            roles.append("Deployer")
            self._trace("Deployer role selected (professional use)", "Art. 3(4)")

        # Role: Importer if EU entity placing non-EU AI on Union market.
        # Article 3(6) (definition context)
        if self.inputs.importer:
            roles.append("Importer")
            self._trace("Importer role selected (EU placing non-EU AI)", "Art. 3(6)")

        # Role: Distributor if making available in supply chain.
        # Article 3(7) (definition context)
        if self.inputs.distributor:
            roles.append("Distributor")
            self._trace("Distributor role selected (supply chain)", "Art. 3(7)")

        # Role: Authorised Representative with written mandate.
        # Article 3(8) (definition context)
        if self.inputs.authorized_representative:
            roles.append("Authorised Representative")
            self._trace("Authorised Representative role selected", "Art. 3(8)")

        # Product Manufacturer placing a product with embedded AI.
        # Article 25(3)
        if self.inputs.product_manufacturer:
            roles.append("Product Manufacturer")
            self._trace(
                "Product Manufacturer role selected (embedded AI product)",
                "Art. 25(3)",
            )

        # Non-EU provider appoints EU representative.
        # Article 22
        if self.inputs.non_eu_rep_appointed:
            if "Authorised Representative" not in roles:
                roles.append("Authorised Representative")
            self._trace(
                "EU representative appointed by non-EU provider",
                "Art. 22",
            )

        # Distributor access question (buy/sell/provide access in EU).
        # Article 3(7) (definition context)
        if self.inputs.distributor_access:
            if "Distributor" not in roles:
                roles.append("Distributor")
            self._trace(
                "Distributor role selected (buy/sell/provide access in EU)",
                "Art. 3(7)",
            )

        # Importer clarification question (not original developer or first importer).
        # Article 3(6) (definition context)
        if self.inputs.importer_non_original:
            if "Importer" not in roles:
                roles.append("Importer")
            self._trace(
                "Importer role selected (not original developer/first importer)",
                "Art. 3(6)",
            )

        # Role shift if system is not provided "as-is".
        # Article 25 / Recital 84 — applies only to actors in the supply chain (Importer, Distributor,
        # Product Manufacturer) who supply the system. A pure Deployer does not "provide" the system
        # to users; they use it. So "No" to provide_as_is from a Deployer-only means N/A, not Provider.
        supplying_roles = {"Provider", "Importer", "Distributor", "Product Manufacturer"}
        if not self.inputs.provide_as_is and supplying_roles.intersection(roles):
            if "Provider" not in roles:
                roles.append("Provider")
            warnings.append(
                "Role shift: changes to software/settings/intended purpose make you a Provider."
            )
            self._trace(
                "Role shift to Provider (not provided as-is)",
                "Art. 25 / Recital 84",
            )

        # Substantial Modifier: significant change to high-risk system -> Provider.
        # Article 25 / Recital 84
        if self.inputs.substantial_modifier:
            if "Provider" not in roles:
                roles.append("Provider")
            roles.append("Substantial Modifier")
            self._trace(
                "Substantial modification triggers Provider role",
                "Art. 25 / Recital 84",
            )

        if self.inputs.deployer and self.inputs.substantial_modifier:
            warnings.append(
                "Multiple Role: Deployer + Substantial Modifier (treated as Provider)."
            )

        # Primary role preference order
        primary_role = (
            "Provider"
            if "Provider" in roles
            else "Product Manufacturer"
            if "Product Manufacturer" in roles
            else "Importer"
            if "Importer" in roles
            else "Distributor"
            if "Distributor" in roles
            else "Authorised Representative"
            if "Authorised Representative" in roles
            else "Deployer"
            if "Deployer" in roles
            else "Unknown"
        )

        # Risk classification
        risk_classification = "Non-High-Risk"

        # AI system scope check.
        # Article 3(1)
        if not self.inputs.in_scope_ai:
            risk_classification = "Out of scope (Not an AI system)"
            self._trace(
                "Not in scope (no autonomy/adaptiveness)",
                "Art. 3(1)",
            )
        else:
            self._trace("AI system in scope", "Art. 3(1)")

        # Prohibited practices override all risk classes.
        # Article 5
        if self.inputs.in_scope_ai and self.inputs.prohibited_practices:
            risk_classification = "Prohibited AI"
            self._trace(
                "Prohibited practices detected",
                "Art. 5",
            )

        # High-Risk if safety component requiring third-party assessment.
        # Article 6(1), Annex I
        if self.inputs.in_scope_ai and self.inputs.safety_component:
            risk_classification = "High-Risk"
            self._trace("Safety component => High-Risk", "Art. 6(1) / Annex I")

        # High-Risk if used in Annex III sensitive areas.
        # Article 6(2), Annex III
        if self.inputs.in_scope_ai and self.inputs.annex_iii_sensitive:
            risk_classification = "High-Risk"
            self._trace("Annex III use => High-Risk", "Art. 6(2) / Annex III")

        # Exemption for narrow procedural tasks unless profiling.
        # Article 6(3)
        if (
            self.inputs.in_scope_ai
            and self.inputs.narrow_procedural
            and not self.inputs.profiling
        ):
            risk_classification = "Non-High-Risk"
            self._trace(
                "Narrow procedural task => Exempt (Non-High-Risk)",
                "Art. 6(3)",
            )

        # Profiling overrides exemption and forces High-Risk.
        # Article 6(3)
        if self.inputs.in_scope_ai and self.inputs.profiling:
            risk_classification = "High-Risk"
            self._trace("Profiling => High-Risk (overrides exemption)", "Art. 6(3)")

        obligations: List[str] = []
        if risk_classification == "Prohibited AI":
            obligations.append("Article 5 (Prohibited AI practices)")
        elif risk_classification == "High-Risk":
            obligations.append("Articles 8–15 (High-Risk requirements)")
            if "Provider" in roles:
                obligations.append("Article 49 (EU database registration)")
        elif risk_classification == "Out of scope (Not an AI system)":
            obligations.append("Article 3(1) (Not in scope)")
        else:
            obligations.append("Article 50 (Transparency requirements)")

        responsibilities_by_role: Dict[str, List[str]] = {}
        if "Provider" in roles:
            responsibilities_by_role["Provider"] = [
                "Risk Management: Establish a system to identify and mitigate risks throughout the AI's life.",
            ]
        if "Deployer" in roles:
            responsibilities_by_role["Deployer"] = [
                "Safe Usage: Follow the Provider’s Instructions for Use strictly.",
                "Human Oversight: Assign competent people to monitor and override the AI if needed.",
                "Monitoring: Keep an eye on incidents and inform the Provider if issues arise.",
                "Log Retention: Keep automatically generated logs for at least six months.",
                "Worker Notification: Inform employees/representatives they are subject to a high-risk AI system.",
            ]
        if "Importer" in roles:
            responsibilities_by_role["Importer"] = [
                "Compliance Verification: Confirm the foreign Provider completed conformity assessment and documentation.",
                "Labeling: Ensure your name and contact details are on the product or packaging.",
                "Storage/Transport: Ensure the AI is not damaged or altered while stored or transported.",
                "Withdrawal: Stop market entry if you suspect the AI is dangerous.",
            ]
        if "Distributor" in roles:
            responsibilities_by_role["Distributor"] = [
                'Ensure the AI has the "CE" mark and correct documentation.',
            ]
        if "Authorised Representative" in roles:
            responsibilities_by_role["Authorised Representative"] = [
                "Document Custodian: Keep technical documentation and certificates for 10 years.",
                "Liaison: Act as primary point of contact for EU national authorities.",
                "Verification: Ensure the foreign Provider fulfills legal obligations.",
            ]
        if "Substantial Modifier" in roles:
            responsibilities_by_role["Substantial Modifier"] = [
                "Full Provider Duties: You inherit all Provider responsibilities.",
                "New Assessment: Perform a brand-new conformity assessment.",
            ]

        responsibilities_summary = [
            {
                "role": "Provider",
                "key_focus": "Safety, Data, & Testing",
                "responsibility_level": "⭐⭐⭐⭐⭐",
            },
            {
                "role": "Modifier",
                "key_focus": "Re-certification",
                "responsibility_level": "⭐⭐⭐⭐⭐",
            },
            {
                "role": "Importer",
                "key_focus": "Border Control & Verification",
                "responsibility_level": "⭐⭐⭐",
            },
            {
                "role": "Deployer",
                "key_focus": "Usage & Monitoring",
                "responsibility_level": "⭐⭐⭐",
            },
            {
                "role": "Distributor",
                "key_focus": "Logistics & Labeling",
                "responsibility_level": "⭐",
            },
        ]

        return EUAIAssessmentResult(
            primary_role=primary_role,
            roles=roles or ["Unknown"],
            risk_classification=risk_classification,
            obligations=obligations,
            warnings=warnings,
            responsibilities_by_role=responsibilities_by_role,
            responsibilities_summary=responsibilities_summary,
            decision_trace=self.trace,
        )
