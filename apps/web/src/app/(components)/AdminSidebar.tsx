"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { coreApiBase } from "@/lib/coreApiBase";
import type { NavMode } from "@/lib/navMode";

type NavItem = {
  labelKey: string;
  label: string;
  href: string;
  depth?: number;
};

type NavSubSection = {
  titleKey: string;
  title: string;
  items: NavItem[];
};

type NavSection = {
  id: string;
  titleKey: string;
  title: string;
  href?: string;
  items: NavItem[];
  subsections?: NavSubSection[];
};

const legacyNavSections: NavSection[] = [
  {
    id: "trustOps",
    titleKey: "sections.trustOps",
    title: "TrustOps",
    items: [
      { labelKey: "items.trustOverview", label: "Trust Overview", href: "/scorecard/admin/trustops" },
      { labelKey: "items.aiSystemRegistry", label: "AI System Registry", href: "/scorecard/admin/trustops/registry" },
      { labelKey: "items.requirementRegister", label: "Requirement Register", href: "/scorecard/admin/trustops/requirements" },
      { labelKey: "items.scope", label: "Scope - The Boundary", href: "/scorecard/admin/trustops/aims-scope" },
      { labelKey: "items.policyManager", label: "Policy Manager", href: "/scorecard/admin/trustops/policies" },
      { labelKey: "items.trustAxes", label: "Trust Axes", href: "/scorecard/admin/trustops/axes" },
      { labelKey: "items.safety", label: "Safety", href: "/scorecard/admin/trustops/axes/safety", depth: 1 },
      {
        labelKey: "items.compliance",
        label: "Compliance",
        href: "/scorecard/admin/trustops/axes/compliance",
        depth: 1,
      },
      {
        labelKey: "items.provenance",
        label: "Provenance",
        href: "/scorecard/admin/trustops/axes/provenance",
        depth: 1,
      },
      { labelKey: "items.evidenceVault", label: "Evidence Vault", href: "/scorecard/admin/trustops/evidence" },
      {
        labelKey: "items.provenanceLineage",
        label: "Provenance & Lineage",
        href: "/scorecard/admin/trustops/provenance",
      },
      { labelKey: "items.trustMonitoring", label: "Trust Monitoring", href: "/scorecard/admin/trustops/monitoring" },
      {
        labelKey: "items.driftExpiry",
        label: "Drift & Expiry",
        href: "/scorecard/admin/trustops/monitoring/drift-expiry",
        depth: 1,
      },
      {
        labelKey: "items.scoreDecayEvents",
        label: "Score Decay Events",
        href: "/scorecard/admin/trustops/monitoring/decay-events",
        depth: 1,
      },
      {
        labelKey: "items.remediation",
        label: "Remediation",
        href: "/scorecard/admin/trustops/monitoring/remediation",
        depth: 1,
      },
      { labelKey: "items.trustSnapshots", label: "Trust Snapshots", href: "/scorecard/admin/trustops/snapshots" },
      { labelKey: "items.auditLog", label: "Audit Log", href: "/scorecard/admin/trustops/audit" },
    ],
  },
  {
    id: "dataManager",
    titleKey: "sections.dataManager",
    title: "Data Manager",
    items: [
      { labelKey: "items.dataSources", label: "Data Sources", href: "/scorecard/admin/data-manager/data-sources" },
      {
        labelKey: "items.dataClassification",
        label: "Data Classification",
        href: "/scorecard/admin/data-manager/data-classification",
      },
      {
        labelKey: "items.retentionDeletion",
        label: "Retention & Deletion",
        href: "/scorecard/admin/data-manager/retention",
      },
      { labelKey: "items.dataQuality", label: "Data Quality", href: "/scorecard/admin/data-manager/data-quality" },
    ],
  },
];

const prefixAdminHref = (href: string, entitySlug?: string | null): string => {
  if (!entitySlug) return href;
  // Prefix /scorecard/admin routes
  if (href.startsWith("/scorecard/admin")) return `/${encodeURIComponent(entitySlug)}${href}`;
  // Prefix /scorecard (main projects page)
  if (href === "/scorecard") return `/${encodeURIComponent(entitySlug)}/scorecard`;
  // Prefix /projects/register
  if (href === "/projects/register") return `/${encodeURIComponent(entitySlug)}/projects/register`;
  // Prefix /projects/view
  if (href === "/projects/view") return `/${encodeURIComponent(entitySlug)}/projects/view`;
  // Prefix /admin/* routes (reportschedule, kpischedule, provenanceschedule)
  if (href.startsWith("/admin/")) return `/${encodeURIComponent(entitySlug)}${href}`;
  return href;
};

const buildV2NavSections = (
  projectSlug?: string | null,
  entitySlug?: string | null,
): NavSection[] => {
  const encodedSlug = projectSlug ? encodeURIComponent(projectSlug) : "";
  const entityPrefix = entitySlug ? `/${encodeURIComponent(entitySlug)}` : "";
  const legalStandingHref = entitySlug
    ? `/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup/entity-legal-standing`
    : "/ai_legal_standing";
  const projectBase = encodedSlug ? `${entityPrefix}/scorecard/${encodedSlug}` : `${entityPrefix}/scorecard`;
  const projectDashboard = encodedSlug ? `${projectBase}/dashboard` : `${entityPrefix}/scorecard`;
  const projectTab = (tab: string) =>
    encodedSlug ? `${projectBase}/dashboard?tab=${tab}` : `${entityPrefix}/scorecard`;
  const projectReport = encodedSlug ? `${projectBase}/report` : `${entityPrefix}/scorecard`;
  const pillarAdmin = entitySlug
    ? `${entityPrefix}/scorecard/dashboard/pillars_admin`
    : encodedSlug
    ? `${projectBase}/dashboard/pillars_admin`
    : `${entityPrefix}/scorecard`;
  const hasProject = Boolean(encodedSlug);
  const p = (href: string) => prefixAdminHref(href, entitySlug);

  return [
    {
      id: "governanceSetup",
      titleKey: "sections.governanceSetup",
      title: "AI Governance Setup",
      href: p("/scorecard/admin/governance-setup"),
      items: [
        { labelKey: "items.entityLegalStanding", label: "1. Entity - Legal Standing", href: legalStandingHref },
        { labelKey: "items.entitySetup", label: "2. Entity - Onboarding", href: p("/scorecard/admin/governance-setup/entity-setup") },
        {
          labelKey: "items.aiProjectRegister",
          label: "3. Project - The Portfolio",
          href: p("/scorecard/admin/governance-setup/ai-project-register"),
        },
        {
          labelKey: "items.aiSystemRegister",
          label: "4. AI System - The Inventory",
          href: p("/scorecard/admin/governance-setup/ai-system-register"),
        },
        {
          labelKey: "items.aiRequirementsRegister",
          label: "5. KPI - The Metric",
          href: p("/scorecard/admin/governance-setup/ai-requirements-register"),
        },
        {
          labelKey: "items.aiKpiRegister",
          label: "6. Control - The Action",
          href: p("/scorecard/admin/governance-setup/control-register"),
        },
      ],
    },
    {
      id: "governanceExecution",
      titleKey: "sections.governanceExecution",
      title: "AI Governance Execution",
      href: p("/scorecard/admin/governance-execution"),
      items: hasProject
        ? [
            { labelKey: "items.aiProjectManagement", label: "Projects - The Work", href: p("/projects/view") },
            { labelKey: "items.actionAssignment", label: "Assignment - The Action", href: p("/scorecard/admin/governance-execution/action-assignment") },
            { labelKey: "items.evidenceCapture", label: "Evidence - The Proof", href: p("/scorecard/admin/governance-execution/evidence-capture") },
          ]
        : [
            { labelKey: "items.aiProjectManagement", label: "Projects - The Work", href: p("/projects/view") },
            { labelKey: "items.actionAssignment", label: "Assignment - The Action", href: p("/scorecard/admin/governance-execution/action-assignment") },
            { labelKey: "items.evidenceCapture", label: "Evidence - The Proof", href: p("/scorecard/admin/governance-execution/evidence-capture") },
          ],
    },
    {
      id: "controlAudit",
      titleKey: "sections.controlAudit",
      title: "AI Control & Audit",
      href: p("/scorecard/admin/control-audit"),
      items: [
        { labelKey: "items.evidenceVault", label: "Evidence Vault", href: p("/scorecard/admin/control-audit/evidence") },
        { labelKey: "items.auditLog", label: "Audit Log", href: p("/scorecard/admin/control-audit/audit") },
      ],
    },
    {
      id: "governanceDashboard",
      titleKey: "sections.governanceDashboard",
      title: "Executive Reporting",
      href: p("/scorecard/admin/governance-dashboard-reporting"),
      items: [
        { labelKey: "items.boardLevelReport", label: "High-Level Report", href: p("/scorecard/admin/governance-dashboard-reporting/high-level-report") },
        { labelKey: "items.portfolioSummary", label: "Project Portfolio Summary", href: p("/scorecard/PortfolioSummary") },
        { labelKey: "items.aiReadinessScorecards", label: "AI Readiness Scorecards", href: p("/scorecard") },
        { labelKey: "items.presentationDeck", label: "Presentation Deck", href: p("/scorecard/admin/governance-dashboard-reporting/presentation-deck") },
      ],
    },
    {
      id: "dataRegister",
      titleKey: "sections.dataRegister",
      title: "AI Data Register",
      href: p("/scorecard/admin/data-register"),
      items: [
        { labelKey: "items.dataSources", label: "Data Sources", href: p("/scorecard/admin/data-register/data-sources") },
        {
          labelKey: "items.dataClassification",
          label: "Data Classification",
          href: p("/scorecard/admin/data-register/data-classification"),
        },
        {
          labelKey: "items.retentionDeletion",
          label: "Retention & Deletion",
          href: p("/scorecard/admin/data-register/retention"),
        },
        {
          labelKey: "items.interfaces",
          label: "Interfaces",
          href: p("/scorecard/admin/data-register/interfaces"),
        },
      ],
    },
    {
      id: "knowledgeBase",
      titleKey: "sections.knowledgeBase",
      title: "AI Knowledge Base",
      items: [
        { labelKey: "items.knowhow", label: "Knowhow", href: "/scorecard/admin/knowledgebase" }, // No entity prefix - global
        {
          labelKey: "items.knowledgeVault",
          label: "Knowledge Vault",
          href: "/scorecard/admin/knowledge-vault",
        },
      ],
    },
    {
      id: "trustScore",
      titleKey: "sections.trustScore",
      title: "TRUST & SCORE",
      items: [
        { labelKey: "items.intelligentAlerts", label: "Intelligent Alerts & Trends", href: p("/scorecard/admin/alerts") },
        { labelKey: "items.trustOverview", label: "Trust Overview", href: p("/scorecard/admin/control-audit") },
        { labelKey: "items.trustAxes", label: "Trust Axes", href: p("/scorecard/admin/control-audit/axes") },
        {
          labelKey: "items.provenanceLineage",
          label: "Provenance & Lineage",
          href: p("/scorecard/admin/control-audit/provenance"),
        },
        { labelKey: "items.trustMonitoring", label: "Trust Monitoring", href: p("/scorecard/admin/control-audit/monitoring") },
        { labelKey: "items.trustSnapshots", label: "Trust Snapshots", href: p("/scorecard/admin/control-audit/snapshots") },
        {
          labelKey: "items.provenanceSchedule",
          label: "Provenance Schedule",
          href: p("/admin/provenanceschedule"),
        },
      ],
    },
    {
      id: "iso42001",
      titleKey: "sections.iso42001",
      title: "ISO 42001",
      href: p("/scorecard/admin/iso-42001"),
      items: [
        { labelKey: "items.scope", label: "Scope - The Boundary", href: p("/scorecard/admin/governance-setup/aims-scope") },
        { labelKey: "items.pillarAdmin", label: "Pillar Admin", href: pillarAdmin },
        {
          labelKey: "items.manageKpisControls",
          label: "Manage KPIs and Controls",
          href: "/admin/manage-kpis-controls",
        },
        {
          labelKey: "items.aiPolicyRegister",
          label: "Policy - The Mandate",
          href: p("/scorecard/admin/governance-setup/ai-policy-register"),
        },
        {
          labelKey: "items.policyExecution",
          label: "Policy Execution",
          href: p("/scorecard/admin/governance-execution/policy-execution"),
        },
      ],
    },
    {
      id: "reportAdmin",
      titleKey: "sections.reportAdmin",
      title: "REPORT ADMIN",
      items: [
        { labelKey: "items.reportSetup", label: "Report Setup", href: "/admin/reportschedule" },
        {
          labelKey: "items.govReqPrompt",
          label: "Gov. Req. Report Prompt",
          href: "/admin/gov-req-report-prompt",
        },
        {
          labelKey: "items.executiveReportPrompt",
          label: "Executive Report Prompt",
          href: "/admin/ai-summary-llm-prompt",
        },
        {
          labelKey: "items.boardLevelReportPrompt",
          label: "Board-Level Report Prompt",
          href: "/admin/board-level-report-prompt",
        },
        {
          labelKey: "items.boardLevelDeckPrompt",
          label: "Board-Level Deck Prompt",
          href: "/admin/board-level-deck-prompt",
        },
        { labelKey: "items.kpiSchedule", label: "KPI Schedule", href: "/admin/kpischedule" },
      ],
    },
    {
      id: "masterAdmin",
      titleKey: "sections.masterAdmin",
      title: "System Admin",
      href: "/admin/entities",
      items: [
        { labelKey: "items.allEntities", label: "Choose Entity", href: "/admin/entities" },
        { labelKey: "items.manageAccess", label: "Manage Access", href: "/admin/manage-access" },
        { labelKey: "items.emailSettings", label: "Email Settings", href: "/admin/email-settings" },
        {
          labelKey: "items.masterTranslation",
          label: "Master Translation",
          href: "/admin/master-translation",
        },
        {
          labelKey: "items.modelProviders",
          label: "Model Providers",
          href: "/admin/model-providers",
        },
        { labelKey: "items.systemHealth", label: "System Health", href: "/health" },
        { labelKey: "items.modelCards", label: "Model Cards", href: p("/scorecard/admin/governance-execution/model-cards") },
      ],
    },
  ];
};

export default function AdminSidebar({ navMode }: { navMode?: NavMode }) {
  const pathname = usePathname();
  const t = useTranslations("AdminSidebar");
  const mode = navMode ?? "v2";
  const legacy = mode === "legacy";
  const [projectSlug, setProjectSlug] = useState<string | null>(null);
  const [storedEntitySlug, setStoredEntitySlug] = useState<string | null>(null);
  const coreBase = coreApiBase();
  const storageKey = legacy ? "leadai.sidebar.legacy" : "leadai.sidebar.v2";

  const entitySlugFromPath = (() => {
    if (typeof pathname !== "string") return null;
    // Match entity slug from paths like:
    // /{slug}/scorecard/admin/...
    // /{slug}/admin/...
    // /{slug}/projects/...
    // /{slug}/scorecard (without /admin)
    const m = pathname.match(/^\/([^/]+)\/(?:scorecard\/admin|admin|projects|scorecard(?:\/|$))/);
    return m ? m[1] : null;
  })();
  const effectiveEntitySlug = entitySlugFromPath || storedEntitySlug;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("leadai.nav.entity");
    if (stored) setStoredEntitySlug(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (entitySlugFromPath) {
      window.localStorage.setItem("leadai.nav.entity", entitySlugFromPath);
      setStoredEntitySlug(entitySlugFromPath);
    }
  }, [entitySlugFromPath]);

  useEffect(() => {
    if (legacy) return;
    let mounted = true;
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("leadai.nav.project")
        : null;
    if (stored) {
      setProjectSlug(stored);
    }
    const load = async () => {
      try {
        const res = await fetch(`${coreBase}/projects`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;
        const fallback = data[0]?.slug ? String(data[0].slug) : "";
        const resolved =
          stored && data.some((p: any) => p?.slug === stored) ? stored : fallback;
        if (!mounted || !resolved) return;
        setProjectSlug(resolved);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("leadai.nav.project", resolved);
        }
      } catch {
        // ignore loading errors; fall back to default links
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [coreBase, legacy]);

  const isActive = (href: string) => {
    const normalized = href.split("?")[0]?.split("#")[0] ?? href;
    const cleanPath = pathname?.split("?")[0]?.split("#")[0] ?? pathname;
    if (normalized.endsWith("/scorecard/PortfolioSummary")) return cleanPath === normalized;
    if (normalized === "/scorecard") return cleanPath === "/scorecard";
    if (normalized.endsWith("/scorecard") && !normalized.includes("/scorecard/admin")) {
      return cleanPath === normalized;
    }
    if (normalized === "/projects/register") return cleanPath === normalized;
    if (normalized === "/scorecard/admin/trustops") return cleanPath === normalized;
    if (normalized === "/scorecard/admin/data-manager") return cleanPath === normalized;
    if (normalized === "/scorecard/admin/control-audit") return cleanPath === normalized;
    if (normalized === "/scorecard/admin/governance-setup")
      return cleanPath === normalized;
    if (normalized === "/scorecard/admin/data-register") return cleanPath === normalized;
    if (normalized === "/admin/entities") return cleanPath === normalized;
    if (normalized === "/admin/manage-access") return cleanPath === normalized;
    if (normalized === "/scorecard/admin/governance-execution/ai-project-management") {
      return cleanPath === normalized || cleanPath.startsWith(`${normalized}/`);
    }
    if (normalized.endsWith("/projects/view")) {
      return cleanPath === normalized || cleanPath.startsWith(`${normalized}/`);
    }
    return cleanPath === normalized || cleanPath.startsWith(`${normalized}/`);
  };

  const navSections = useMemo(
    () =>
      legacy
        ? legacyNavSections
        : buildV2NavSections(projectSlug, effectiveEntitySlug),
    [legacy, projectSlug, effectiveEntitySlug],
  );

  const initialOpen = useMemo(() => {
    const activeSection = navSections.find((section) =>
      section.items.some((item) => isActive(item.href))
    );
    return activeSection?.id ?? navSections[0]?.id ?? "";
  }, [navSections, pathname]);

  const [openSections, setOpenSections] = useState<string[]>(
    initialOpen ? [initialOpen] : []
  );
  const [collapsed, setCollapsed] = useState(false);
  const openSectionsKey = `${storageKey}.openSections`;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty(
        "--sidebar-width",
        collapsed ? "56px" : "260px"
      );
    }
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "collapsed") {
      setCollapsed(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(openSectionsKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setOpenSections((prev) => {
          const merged = new Set([...(prev ?? []), ...parsed]);
          return Array.from(merged);
        });
      }
    } catch {
      // ignore corrupted storage
    }
  }, [openSectionsKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      storageKey,
      collapsed ? "collapsed" : "expanded"
    );
  }, [collapsed, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(openSectionsKey, JSON.stringify(openSections));
  }, [openSections, openSectionsKey]);

  useEffect(() => {
    if (!initialOpen) return;
    setOpenSections((prev) =>
      prev.includes(initialOpen) ? prev : [...prev, initialOpen]
    );
  }, [initialOpen]);

  const translate = (key: string, fallback: string) => {
    try {
      const translated = t(key);
      if (translated === key || translated === `AdminSidebar.${key}`) {
        return fallback;
      }
      return translated;
    } catch {
      return fallback;
    }
  };

  return (
    <aside
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 transition-all duration-200 ${
        collapsed ? "p-2" : "p-4"
      }`}
    >
      <div
        className={`flex items-center border-b border-slate-200 pb-3 dark:border-slate-800 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!collapsed && (
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {translate("title", "AI GOVERNANCE")}
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label={
            collapsed
              ? translate("aria.expand", "Expand sidebar")
              : translate("aria.collapse", "Collapse sidebar")
          }
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
      {collapsed ? (
        <div className="mt-6 flex flex-col items-center gap-3 text-slate-300 dark:text-slate-600">
          {navSections.map((section) => (
            <div
              key={section.id}
              className="h-2 w-2 rounded-full bg-slate-300/70 dark:bg-slate-700"
              aria-hidden
            />
          ))}
        </div>
      ) : (
        <nav className="mt-4 space-y-4">
          {navSections.map((section) => (
            <div key={section.id}>
              <div className="flex items-center justify-between">
                {section.href ? (
                  <Link
                    href={section.href}
                    className="text-[13px] uppercase tracking-wide transition font-normal text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    {translate(section.titleKey, section.title)}
                  </Link>
                ) : (
                  <div
                    className="text-[13px] uppercase tracking-wide font-normal text-slate-500 dark:text-slate-400"
                  >
                    {translate(section.titleKey, section.title)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setOpenSections((prev) =>
                      prev.includes(section.id)
                        ? prev.filter((id) => id !== section.id)
                        : [...prev, section.id]
                    )
                  }
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={`Toggle ${translate(section.titleKey, section.title)}`}
                >
                  {openSections.includes(section.id) ? "▾" : "▸"}
                </button>
              </div>
              {openSections.includes(section.id) && (
                <ul className="mt-2 space-y-1">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <li key={`${section.title}-${item.href}-${item.label}`}>
                        <Link
                          href={item.href}
                          className={`flex items-center rounded-lg px-3 py-2 text-sm transition ${
                            active
                              ? "bg-slate-100 text-slate-900 font-semibold dark:bg-slate-900 dark:text-white"
                              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
                          } ${item.depth ? "ml-3" : ""}`}
                        >
                          <span
                            className={`${
                              item.depth ? "text-[11px] uppercase tracking-wide" : ""
                            }`}
                          >
                            {translate(item.labelKey, item.label)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                  {section.subsections?.map((sub) => {
                    return (
                    <li key={`${section.id}-${sub.titleKey}`} className="mt-3">
                      <div
                        className="mb-1 px-3 py-1 text-[11px] uppercase tracking-wide font-normal text-slate-500 dark:text-slate-400"
                      >
                        {translate(sub.titleKey, sub.title)}
                      </div>
                      <ul className="space-y-1">
                        {sub.items.map((item) => {
                          const active = isActive(item.href);
                          return (
                            <li key={`${sub.titleKey}-${item.href}-${item.label}`}>
                              <Link
                                href={item.href}
                                className={`flex items-center rounded-lg px-3 py-2 text-sm transition ${
                                  active
                                    ? "bg-slate-100 text-slate-900 font-semibold dark:bg-slate-900 dark:text-white"
                                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
                                }`}
                              >
                                <span>{translate(item.labelKey, item.label)}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </nav>
      )}
    </aside>
  );
}
