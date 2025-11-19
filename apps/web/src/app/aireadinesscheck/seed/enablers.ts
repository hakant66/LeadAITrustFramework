// app/aireadinesscheck/seed/enablers.ts
export type Theme = { title: string; blue: string; orange: string };
export type Enabler = { id: number; name: string; themes: Theme[] };

export const enablers: Enabler[] = [
  {
    id: 1,
    name: "Strategic Vision & Value",
    themes: [
      { title: "Purpose & Alignment", blue: "AI initiatives are tied to defined business outcomes and approved KPIs.", orange: "AI initiatives are launched without clear purpose or success criteria." },
      { title: "Governance of Use Cases", blue: "Clear criteria exist for what should and should not be automated.", orange: "Automation decisions are made ad hoc with no risk/benefit analysis." },
      { title: "Performance Review", blue: "AI objectives are reviewed in management meetings with KPI tracking.", orange: "AI projects operate outside performance review cycles." }
    ],
  },
  {
    id: 2,
    name: "Leadership & Accountability",
    themes: [
      { title: "Roles & Ownership", blue: "Each AI system has a named owner and documented responsibility.", orange: "When AI issues arise, accountability is unclear." },
      { title: "Leadership Behaviour", blue: "Leaders fund and model responsible AI decisions.", orange: "Leadership treats AI as a tech experiment without oversight." },
      { title: "Escalation & Reporting", blue: "There is a defined path to report AI concerns or incidents.", orange: "AI incidents are handled informally or ignored." }
    ],
  },
  {
    id: 3,
    name: "Governance & Compliance (AIMS)",
    themes: [
      { title: "Policy & Integration", blue: "A documented AI Management System integrates ISO and legal requirements.", orange: "No formal AI policy exists or it is not followed." },
      { title: "Auditing & Evidence", blue: "Internal audits and evidence logs are maintained for AI systems.", orange: "There is no audit trail for AI activities." },
      { title: "Compliance Alignment", blue: "Controls map to ISO and EU AI Act articles.", orange: "Compliance activities for AI are fragmented or reactive." }
    ],
  },
  {
    id: 4,
    name: "Risk & Impact Management",
    themes: [
      { title: "Assessment Process", blue: "AI risk and impact assessments are performed before and after deployment.", orange: "Risk assessments are skipped or done once then forgotten." },
      { title: "Risk Coverage", blue: "Risks include individual, societal, and ethical impacts.", orange: "Only technical risks (like accuracy) are considered." },
      { title: "Monitoring & Review", blue: "Post-market monitoring detects model drift and harm.", orange: "There is no system to monitor AI impacts after release." }
    ],
  },
  {
    id: 5,
    name: "Data Stewardship & Quality",
    themes: [
      { title: "Provenance & Rights", blue: "Data sources, rights and provenance are documented and verifiable.", orange: "Datasets of unknown origin or licensing are used." },
      { title: "Quality & Bias", blue: "Data is tested for bias and quality throughout the lifecycle.", orange: "Bias and quality issues go undetected until failures occur." },
      { title: "Retention & Deletion", blue: "Data retention and deletion follow policy and law.", orange: "Data is kept indefinitely without control." }
    ],
  },
  {
    id: 6,
    name: "Clarity & Transparency",
    themes: [
      { title: "User Disclosure", blue: "Users are informed when interacting with AI and understand its limits.", orange: "Users are not told when AI is used or its limitations." },
      { title: "Documentation & Traceability", blue: "Technical and user documentation is complete and up-to-date.", orange: "Documentation is missing or inaccessible." },
      { title: "Logging & Explainability", blue: "Event logs support traceability and explainability.", orange: "Logs are incomplete or unavailable for investigation." }
    ],
  },
  {
    id: 7,
    name: "Human Oversight & Skills",
    themes: [
      { title: "Human-in-the-Loop", blue: "Humans review AI outputs before critical decisions.", orange: "Critical decisions are fully automated." },
      { title: "Training & Competence", blue: "Teams receive training on AI risk, ethics and oversight.", orange: "No formal training on AI oversight exists." },
      { title: "Diversity of Expertise", blue: "Cross-functional skills (data, domain, ethics) involved.", orange: "AI projects run by a single technical team without input." }
    ],
  },
  {
    id: 8,
    name: "Secure & Private by Design",
    themes: [
      { title: "Security Controls", blue: "Security testing covers AI-specific threats (poisoning, leaks).", orange: "AI systems use generic IT controls without AI threat testing." },
      { title: "Privacy Management", blue: "PII handling complies with data-protection roles and laws.", orange: "AI processes personal data without defined responsibility." },
      { title: "Incident Response", blue: "Security and privacy incidents are reported and analysed.", orange: "AI security breaches are under-reported or ignored." }
    ],
  },
  {
    id: 9,
    name: "Lifecycle Ops & Monitoring",
    themes: [
      { title: "Process Control", blue: "The AI lifecycle is documented (design \u2192 deploy \u2192 retire).", orange: "Models are released without defined lifecycle control." },
      { title: "Rollback & Change Mgmt", blue: "Tested rollback and change procedures exist.", orange: "No rollback plans; changes made directly in production." },
      { title: "Performance Tracking", blue: "KPIs and drift metrics monitored in production.", orange: "Model performance is not tracked post-launch." }
    ],
  },
  {
    id: 10,
    name: "Third-Party & Customer Alignment",
    themes: [
      { title: "Supplier Governance", blue: "Supplier AI responsibilities are defined in contracts.", orange: "Vendors provide AI without clear accountability." },
      { title: "Customer Transparency", blue: "Customers receive AI documentation and safe-use guidance.", orange: "Customers are not informed about AI functions or limits." },
      { title: "Feedback & Improvement", blue: "External feedback feeds into AI risk and improvement cycles.", orange: "Customer issues are ignored or handled off-record." }
    ],
  }
];
