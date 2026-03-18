// apps/web/src/app/(components)/DataManagerModal.tsx
"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { coreApiBase } from "@/lib/coreApiBase";
import { regApiBase } from "@/lib/regApiBase";
import { certApiBase } from "@/lib/certApiBase";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

type ControlRow = {
  id?: string | null; // new: used for row key fallback
  control_id: string;
  kpi_key: string;
  name?: string | null;
  pillar?: string | null;
  unit?: string | null;
  norm_min?: number | null;
  norm_max?: number | null;
  higher_is_better?: boolean | null;
  weight?: number | null;
  axis_key?: string | null;
  target_text?: string | null;
  target_numeric?: number | null;
  evidence_source?: string | null;
  owner_role?: string | null;
  frequency?: number | null;
  failure_action?: number | null;
  maturity_anchor_l3?: number | null;
  current_value?: number | null;
  as_of?: number | null;
  kpi_score?: number | null;
  description?: string | null;
  example?: string | null;
  notes?: string | null;
};

type KpiRow = {
  kpi_id: string; // kept in type for backend payloads, but not rendered
  key: string;
  name: string;
  unit?: string | null;
  pillar?: string | null;
  pillar_name?: string | null; // display-friendly pillar name
  pillar_key?: string | null;  // display-friendly pillar key
  description?: string | null;
  weight?: number | null;
  min_ideal?: number | null;
  max_ideal?: number | null;
  invert?: boolean | null;
  example?: string | null;
};

type EvidenceRow = {
  id: number;
  project_slug: string;
  control_id: string;
  name?: string | null;
  mime?: string | null;
  size_bytes?: number | null;
  sha256?: string | null;
  uri?: string | null;
  status?: string | null;
  evidence_source?: string | null;
  owner_role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  approval_status?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  last_comment?: string | null;
  last_action?: string | null;
  attachment_name?: string | null;
  attachment_uri?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  attachment_sha256?: string | null;
  attachment_download_url?: string | null;
  updated_by?: string | null;
  last_update?: string | null;
  download_url?: string | null;
};

type AiSystemRow = {
  id: string;
  uc_id: string;
  project_slug?: string | null;
  name: string;
  description?: string | null;
  owner?: string | null;
  system_owner_email?: string | null;
  business_unit?: string | null;
  risk_owner_role?: string | null;
  decision_authority?: string | null;
  model_provider?: string | null;
  provider_type?: string | null;
  intended_use?: string | null;
  intended_users?: string | null;
  system_boundary?: string | null;
  model_type?: string | null;
  model_version?: string | null;
  deployment_environment?: string | null;
  lifecycle_stage?: string | null;
  training_data_sources?: string | null;
  personal_data_flag?: boolean | null;
  sensitive_attributes_flag?: boolean | null;
  risk_tier?: string | null;
  status?: string | null;
  region_scope?: string | null;
  data_sensitivity?: string | null;
  model_name?: string | null;
  technical_lead?: string | null;
  target_users?: string | null;
  intended_purpose?: string | null;
  out_of_scope_uses?: string | null;
  deployment_method?: string | null;
  data_residency?: string | null;
  base_model_type?: string | null;
  input_output_modality?: string | null;
  fine_tuning_data?: string | null;
  data_minimization?: string | null;
  human_oversight_mechanism?: string | null;
  impact_assessment_reference?: string | null;
  known_limitations?: string | null;
  langfuse_project_id?: string | null;
  langfuse_base_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  entity_id?: string | null;
  entity_slug?: string | null;
};

type RequirementRow = {
  id: string;
  project_slug?: string | null;
  uc_id?: string | null;
  framework: string;
  requirement_code: string;
  title?: string | null;
  description?: string | null;
  applicability?: string | null;
  owner_role?: string | null;
  status?: string | null;
  evidence_ids?: any;
  mapped_controls?: any;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RequirementKpiRow = {
  framework: string;
  requirement_code?: string | null;
  kpi_key: string;
  kpi_name: string;
  clause?: string | null;
};

type RequirementKpiSummary = {
  framework: string;
  requirement_code?: string | null;
  count: number;
  note?: string | null;
};

type KpiKnowledgeRow = {
  kpi_key: string;
  kpi_name: string;
  description?: string | null;
  definition?: string | null;
  example?: string | null;
};

type RequirementDraftKey = "eu_ai_act" | "iso_42001" | "nist_ai_rmf" | "company_specific";

type PendingRequirementEntry = {
  id: string;
  project_slug: string;
  framework: RequirementDraftKey;
  requirement_code: string;
  uc_id?: string | null;
  status: string;
};

type ProvenanceArtifactRow = {
  id: string;
  project_slug: string;
  name: string;
  uri: string;
  sha256: string;
  size_bytes?: number | null;
  mime?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  usage_rights?: string | null;
  created_at?: string | null;
};

type EntityProviderArtifactRow = {
  id: string;
  entity_id: string;
  provider_key: string;
  name: string;
  uri: string;
  sha256?: string | null;
  type?: string | null;
  status?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  updated_at?: string | null;
};

type ProvenanceDatasetRow = {
  id: string;
  project_slug: string;
  name: string;
  description?: string | null;
  artifact_id?: string | null;
  created_at?: string | null;
};

type ProvenanceModelRow = {
  id: string;
  project_slug: string;
  name: string;
  version?: string | null;
  framework?: string | null;
  description?: string | null;
  artifact_id?: string | null;
  created_at?: string | null;
};

type ProvenanceEvidenceRow = {
  id: string;
  project_slug: string;
  name: string;
  description?: string | null;
  artifact_id?: string | null;
  created_at?: string | null;
};

type ProvenanceLineageRow = {
  id: number;
  project_slug: string;
  parent_type: string;
  parent_id: string;
  child_type: string;
  child_id: string;
  relationship?: string | null;
  created_at?: string | null;
};

type ProvenanceAuditRow = {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  actor?: string | null;
  at?: string | null;
  details_json?: Record<string, unknown> | null;
};

type ProvenanceEvalResult = {
  overall: {
    level: string;
    score: number;
    forced: boolean;
    reasons?: Array<{ code?: string; message?: string }>;
    debug?: Record<string, unknown>;
  };
  fields: Array<{
    field: string;
    level: string;
    score: number;
    matched_rule?: string | null;
    reasons?: Array<{ code?: string; message?: string }>;
    debug?: Record<string, unknown>;
  }>;
  gates: Array<{
    gate_id: string;
    forced_level: string;
    reasons?: Array<{ code?: string; message?: string }>;
    debug?: Record<string, unknown>;
  }>;
  debug?: Record<string, unknown>;
};

type AxisMappingRow = {
  pillar_key: string;
  pillar_name?: string | null;
  axis_key?: string | null;
  notes?: string | null;
};

type ProjectRow = {
  slug: string;
  name?: string | null;
};

type TrustSignalRow = {
  id: string;
  project_slug: string;
  signal_type: string;
  axis_key?: string | null;
  status: string;
  details_json?: Record<string, unknown> | null;
  source?: string | null;
  created_at?: string | null;
  processed_at?: string | null;
  resolved_at?: string | null;
};

type TrustDecayRow = {
  id: string;
  signal_id: string;
  project_slug: string;
  axis_key: string;
  rule_key: string;
  previous_score?: number | null;
  new_score?: number | null;
  decay_delta?: number | null;
  applied_at?: string | null;
  details_json?: Record<string, unknown> | null;
};

type PolicyAlertRow = {
  id: string;
  policy_id: string;
  policy_title: string;
  project_slug?: string | null;
  alert_type: string;
  severity: string;
  message: string;
  status: string;
  created_at?: string | null;
  details_json?: Record<string, unknown> | null;
};

type TrustmarkRow = {
  id: string;
  project_id: string;
  project_slug: string;
  tol_level: string;
  axis_levels?: Record<string, string> | null;
  axis_scores?: Record<string, number> | null;
  issued_at?: string | null;
  expires_at?: string | null;
  status: string;
  revoked_at?: string | null;
  revoked_reason?: string | null;
};

type AimsScopeRow = {
  id?: string | null;
  scope_name?: string | null;
  scope_statement?: string | null;
  context_internal?: string | null;
  context_external?: string | null;
  interested_parties?: string[] | null;
  scope_boundaries?: string | null;
  lifecycle_coverage?: string[] | null;
  cloud_platforms?: string[] | null;
  regulatory_requirements?: string[] | null;
  isms_pms_integration?: string | null;
  exclusions?: string | null;
  owner?: string | null;
  status?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PolicyRow = {
  id: string;
  title: string;
  owner_role?: string | null;
  status?: string | null;
  iso42001_requirement?: string | null;
  iso42001_status?: string | null;
  euaiact_requirements?: string | null;
  nistairmf_requirements?: string | null;
  comment?: string | null;
  action?: string | null;
  template?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  latest_version?: {
    id: string;
    version_label?: string | null;
    status?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    created_at?: string | null;
  } | null;
};

type PolicyVersionRow = {
  id: string;
  policy_id: string;
  version_label: string;
  content?: string | null;
  status?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
};

const CORE = coreApiBase();
const REG = regApiBase();
const CERT = certApiBase();
const AXIS_OPTIONS = [
  { value: "", label: "None" },
  { value: "safety", label: "Safety" },
  { value: "compliance", label: "Compliance" },
  { value: "provenance", label: "Provenance" },
];
const PROVENANCE_TYPES = [
  { value: "dataset", label: "Dataset" },
  { value: "model", label: "Model" },
  { value: "artifact", label: "Artifact" },
  { value: "evidence", label: "Evidence" },
];

type DataManagerTabId =
  | "kpis"
  | "controls"
  | "evidences"
  | "trust-axes"
  | "trust-monitoring"
  | "trustmarks"
  | "provenance"
  | "registry"
  | "requirements"
  | "aims-scope"
  | "policies";

type DataManagerTab = {
  id: DataManagerTabId;
  label: string;
};

const ALL_TABS: DataManagerTab[] = [
  { id: "kpis", label: "KPIs" },
  { id: "controls", label: "Controls" },
  { id: "evidences", label: "Evidences" },
  { id: "trust-axes", label: "Trust Axes" },
  { id: "trust-monitoring", label: "Trust Monitoring" },
  { id: "trustmarks", label: "TrustMarks" },
  { id: "provenance", label: "Provenance" },
  { id: "registry", label: "AI System Registry" },
  { id: "requirements", label: "Requirement Register" },
  { id: "aims-scope", label: "AIMS Scope" },
  { id: "policies", label: "Policy Manager" },
];

export default function DataManagerModal({
  open,
  onClose,
  title = "Data Manager",
  initialTab,
  allowedTabs,
  embedded = false,
  showHeader = true,
  showTabs = true,
  requirementsAssessment,
  entityId,
  entitySlug,
}: {
  open: boolean;
  onClose?: () => void;
  title?: string;
  initialTab?: DataManagerTabId;
  allowedTabs?: DataManagerTabId[];
  embedded?: boolean;
  showHeader?: boolean;
  showTabs?: boolean;
  requirementsAssessment?: {
    primaryRole?: string | null;
    riskClassification?: string | null;
  } | null;
  entityId?: string;
  entitySlug?: string;
}) {
  const t = useTranslations("GovernanceJourneyCard");
  const tDm = useTranslations("DataManagerModal");
  const resolvedTabs = allowedTabs?.length
    ? ALL_TABS.filter((tab) => allowedTabs.includes(tab.id))
    : ALL_TABS;
  const resolvedInitial =
    initialTab && resolvedTabs.some((tab) => tab.id === initialTab)
      ? initialTab
      : resolvedTabs[0]?.id ?? "kpis";
  const [tab, setTab] = useState<DataManagerTabId>(resolvedInitial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kpiRows, setKpiRows] = useState<KpiRow[]>([]);
  const [controls, setControls] = useState<ControlRow[]>([]);
  const [evidences, setEvidences] = useState<EvidenceRow[]>([]);
  const [axisMappings, setAxisMappings] = useState<AxisMappingRow[]>([]);
  const [provArtifacts, setProvArtifacts] = useState<ProvenanceArtifactRow[]>([]);
  const [provDatasets, setProvDatasets] = useState<ProvenanceDatasetRow[]>([]);
  const [provModels, setProvModels] = useState<ProvenanceModelRow[]>([]);
  const [provEvidence, setProvEvidence] = useState<ProvenanceEvidenceRow[]>([]);
  const [provLineage, setProvLineage] = useState<ProvenanceLineageRow[]>([]);
  const [provAudit, setProvAudit] = useState<ProvenanceAuditRow[]>([]);
  const [entityProviderArtifacts, setEntityProviderArtifacts] = useState<
    EntityProviderArtifactRow[]
  >([]);
  const [entityProviderArtifactsLoading, setEntityProviderArtifactsLoading] =
    useState(false);
  const [entityProviderArtifactsError, setEntityProviderArtifactsError] = useState<
    string | null
  >(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [provEvalInput, setProvEvalInput] = useState("");
  const [provEvalDebug, setProvEvalDebug] = useState(false);
  const [provEvalResult, setProvEvalResult] = useState<ProvenanceEvalResult | null>(
    null
  );
  const [provEvalError, setProvEvalError] = useState<string | null>(null);
  const [effectiveEntityId, setEffectiveEntityId] = useState<string>(entityId ?? "");
  const [policyEntityName, setPolicyEntityName] = useState<string>("");
  const policyEntityLabel = policyEntityName || entitySlug || "";

  const [aiSystems, setAiSystems] = useState<AiSystemRow[]>([]);
  const [aiSystemQuery, setAiSystemQuery] = useState("");
  const [aiSystemProject, setAiSystemProject] = useState("");
  const [aiSystemModalOpen, setAiSystemModalOpen] = useState(false);
  const [aiSystemModalMode, setAiSystemModalMode] = useState<"create" | "edit">(
    "edit"
  );
  const [aiSystemModalDraft, setAiSystemModalDraft] = useState<
    Partial<AiSystemRow> | null
  >(null);
  const [aiSystemModalError, setAiSystemModalError] = useState<string | null>(null);
  const [aiSystemModalNotice, setAiSystemModalNotice] = useState<string | null>(null);
  const [aiSystemModalSaving, setAiSystemModalSaving] = useState(false);
  const [langfuseKeyPublic, setLangfuseKeyPublic] = useState("");
  const [langfuseKeySecret, setLangfuseKeySecret] = useState("");
  const [langfuseKeyNotice, setLangfuseKeyNotice] = useState<string | null>(null);
  const [langfuseKeyError, setLangfuseKeyError] = useState<string | null>(null);
  const [langfuseKeyBusy, setLangfuseKeyBusy] = useState(false);
  const [aiSystemHelper, setAiSystemHelper] = useState<
    Array<{ field_name: string; description: string; helper_values: string[] }>
  >([]);
  const aiSystemHelperMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    aiSystemHelper.forEach((h) => {
      m[h.field_name] = h.helper_values ?? [];
    });
    return m;
  }, [aiSystemHelper]);
  const aiSystemHelperDescriptionMap = useMemo(() => {
    const m: Record<string, string> = {};
    aiSystemHelper.forEach((h) => {
      m[h.field_name] = h.description ?? "";
    });
    return m;
  }, [aiSystemHelper]);
  /** Tooltips from ai_system_registry_helper.helper_values (allowed options list) */
  const aiSystemHelperTooltipMap = useMemo(() => {
    const m: Record<string, string> = {};
    aiSystemHelper.forEach((h) => {
      const vals = h.helper_values ?? [];
      m[h.field_name] = Array.isArray(vals) ? vals.join(", ") : String(vals ?? "");
    });
    return m;
  }, [aiSystemHelper]);
  const getAiSystemTooltip = useCallback(
    (key: string) => {
      const raw = aiSystemHelperTooltipMap[key];
      const cleaned = typeof raw === "string" ? raw.trim() : "";
      if (cleaned) return cleaned;
      const desc = (aiSystemHelperDescriptionMap[key] ?? "").trim();
      if (desc) return desc;
      return aiSystemHelper.length === 0 ? "Loading…" : "";
    },
    [aiSystemHelperTooltipMap, aiSystemHelperDescriptionMap, aiSystemHelper.length]
  );

  const toProviderKey = useCallback((value?: string | null) => {
    const raw = (value ?? "").trim().toLowerCase();
    if (!raw) return null;
    if (raw.includes("openai")) return "openai";
    if (raw.includes("anthropic") || raw.includes("claude")) return "anthropic";
    if (raw.includes("google") || raw.includes("gemini") || raw.includes("gcp")) {
      return "google";
    }
    if (raw.includes("meta") || raw.includes("llama")) return "meta";
    return raw;
  }, []);

  useEffect(() => {
    if (entityId) {
      setEffectiveEntityId(entityId);
      return;
    }
    if (entitySlug) {
      return;
    }
    // Fallback: resolve first accessible entity for evidence listing
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${CORE}/user/entities`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        const firstId = data[0]?.entity_id ? String(data[0].entity_id) : "";
        if (firstId) {
          setEffectiveEntityId(firstId);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [CORE, entityId, entitySlug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const resolvedUser = [
          data?.user?.name,
          data?.user?.email,
          data?.user?.id,
        ]
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .find((value) => value.length > 0);
        if (!cancelled && resolvedUser) {
          setEvidenceActionUser(resolvedUser);
        }
      } catch {
        // keep "ui" fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!entitySlug) {
      setPolicyEntityName("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${CORE}/entity/by-slug/${encodeURIComponent(entitySlug)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const name =
          data?.fullLegalName ||
          data?.name ||
          data?.displayName ||
          data?.slug ||
          entitySlug;
        if (name) setPolicyEntityName(String(name));
        if (!entityId && !effectiveEntityId && data?.id) {
          setEffectiveEntityId(String(data.id));
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [CORE, entitySlug, entityId, effectiveEntityId]);

  useEffect(() => {
    setProjects([]);
    setAiSystems([]);
    setAiSystemProject("");
    setEntityProviderArtifacts([]);
  }, [effectiveEntityId]);

  const loadAiSystemHelper = useCallback(async () => {
    try {
      const res = await fetch(`${CORE}/admin/ai-systems/helper`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setAiSystemHelper(Array.isArray(data?.items) ? data.items : []);
    } catch {
      // ignore
    }
  }, [CORE]);

  const loadEntityProviderArtifacts = useCallback(async () => {
    if (!effectiveEntityId) return;
    setEntityProviderArtifactsLoading(true);
    setEntityProviderArtifactsError(null);
    try {
      const params = new URLSearchParams({ entity_id: effectiveEntityId });
      const res = await fetch(
        `${CORE}/admin/entity-provider-artifacts?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to load provider artifacts (${res.status})`);
      }
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setEntityProviderArtifacts(items);
    } catch (e: any) {
      setEntityProviderArtifactsError(e.message ?? String(e));
    } finally {
      setEntityProviderArtifactsLoading(false);
    }
  }, [CORE, effectiveEntityId]);

  useEffect(() => {
    if (!allowedTabs?.includes("registry")) return;
    loadAiSystemHelper();
  }, [allowedTabs, loadAiSystemHelper]);

  // Load helper when opening the AI system modal so tooltips are available even if tab wasn't active yet
  useEffect(() => {
    if (aiSystemModalOpen && aiSystemHelper.length === 0) {
      loadAiSystemHelper();
    }
  }, [aiSystemModalOpen, aiSystemHelper.length, loadAiSystemHelper]);

  useEffect(() => {
    if (aiSystemModalOpen) {
      loadEntityProviderArtifacts();
    }
  }, [aiSystemModalOpen, loadEntityProviderArtifacts]);

  const activeProviderKey = toProviderKey(aiSystemModalDraft?.model_provider);
  const providerArtifactsForSystem = useMemo(() => {
    if (!activeProviderKey) return [];
    return entityProviderArtifacts.filter(
      (row) => row.provider_key === activeProviderKey
    );
  }, [activeProviderKey, entityProviderArtifacts]);

  const [aiSystemRisk, setAiSystemRisk] = useState("");
  const [aiSystemStatus, setAiSystemStatus] = useState("");
  const [newAiSystem, setNewAiSystem] = useState<Partial<AiSystemRow>>({
    name: "",
  });
  const [editingAiSystemId, setEditingAiSystemId] = useState<string | null>(null);
  const [editingAiSystem, setEditingAiSystem] = useState<Partial<AiSystemRow> | null>(
    null
  );
  const resetAiSystemModalState = () => {
    setAiSystemModalOpen(false);
    setAiSystemModalDraft(null);
    setAiSystemModalError(null);
    setAiSystemModalNotice(null);
    setAiSystemModalSaving(false);
  };

  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [requirementQuery, setRequirementQuery] = useState("");
  const [requirementProject, setRequirementProject] = useState("");
  const [requirementUcId, setRequirementUcId] = useState("");
  const [requirementFramework, setRequirementFramework] = useState("");
  const [requirementStatus, setRequirementStatus] = useState("");
  const [newRequirement, setNewRequirement] = useState<Partial<RequirementRow>>({
    project_slug: "",
  });
  const [requirementView, setRequirementView] = useState<"list" | "matrix">(
    "list"
  );
  const [editingRequirementId, setEditingRequirementId] = useState<string | null>(
    null
  );
  const [editingControls, setEditingControls] = useState("");
  const [editingEvidence, setEditingEvidence] = useState("");
  const [requiredKpis, setRequiredKpis] = useState<RequirementKpiRow[]>([]);
  const [requiredKpiSummary, setRequiredKpiSummary] = useState<
    RequirementKpiSummary[]
  >([]);
  const [requiredKpiLoading, setRequiredKpiLoading] = useState(false);
  const [requiredKpiError, setRequiredKpiError] = useState<string | null>(null);
  const [requiredKpiSaved, setRequiredKpiSaved] = useState(false);
  const [requiredKpiSaveComplete, setRequiredKpiSaveComplete] = useState(false);
  const [requiredKpiApplyComplete, setRequiredKpiApplyComplete] = useState(false);
  const [requiredKpiSaveNotice, setRequiredKpiSaveNotice] = useState<string | null>(
    null
  );
  const [requiredKpiSaving, setRequiredKpiSaving] = useState(false);
  const [requiredKpiDiff, setRequiredKpiDiff] = useState<{
    existing: number;
    newCount: number;
    removed: number;
    existingKeys: string[];
    newKeys: string[];
    removedKeys: string[];
    requiredKeys: string[];
  } | null>(null);
  const [requiredKpiDiffOpen, setRequiredKpiDiffOpen] = useState(false);
  const [applyKpiChangesBusy, setApplyKpiChangesBusy] = useState(false);
  const [applyKpiChangesNotice, setApplyKpiChangesNotice] = useState<string | null>(
    null
  );
  const [requiredKpiView, setRequiredKpiView] = useState<"list" | "matrix">(
    "list"
  );
  const [govReportOpen, setGovReportOpen] = useState(false);
  const [govReportLoading, setGovReportLoading] = useState(false);
  const [govReportError, setGovReportError] = useState<string | null>(null);
  const [govReport, setGovReport] = useState<string>("");
  const [govReportMeta, setGovReportMeta] = useState<Record<string, any> | null>(
    null
  );
  const [govReportSources, setGovReportSources] = useState<
    Array<{ title?: string; source_type?: string; file_name?: string }>
  >([]);
  const handleGovReportPrint = () => {
    if (typeof window === "undefined") return;
    window.print();
  };

  const requirementProjectSet = useMemo(
    () =>
      new Set(
        requirements
          .map((row) => String(row.project_slug ?? "").trim())
          .filter((slug) => slug.length > 0)
      ),
    [requirements]
  );

  const requirementMissingProjects = useMemo(() => {
    return projects
      .filter((p) => {
        const slug = String(p.slug ?? "").trim();
        if (!slug) return false;
        return !requirementProjectSet.has(slug);
      })
      .map((p) => String(p.name ?? p.slug ?? "").trim())
      .filter((name) => name.length > 0);
  }, [projects, requirementProjectSet]);

  const requirementsCoverageStatus = useMemo(() => {
    const projectSlugs = projects.map((p) => String(p.slug ?? "")).filter(Boolean);
    if (projectSlugs.length === 0) return "none";
    const covered = projectSlugs.filter((slug) => requirementProjectSet.has(slug))
      .length;
    if (covered === 0) return "none";
    if (covered === projectSlugs.length) return "complete";
    return "partial";
  }, [projects, requirementProjectSet]);

  const requirementsMissingMessage = requirementMissingProjects.length
    ? t("requirementsMissingProjects", {
        projects: requirementMissingProjects.join(", "),
      })
    : t("controlLockedNoRequirements");
  const [kpiDetailOpen, setKpiDetailOpen] = useState(false);
  const [kpiDetailLoading, setKpiDetailLoading] = useState(false);
  const [kpiDetailError, setKpiDetailError] = useState<string | null>(null);
  const [kpiDetail, setKpiDetail] = useState<KpiKnowledgeRow | null>(null);
  const [pendingRequirementEntries, setPendingRequirementEntries] = useState<
    PendingRequirementEntry[]
  >([]);

  const formatAssessmentLabel = (value?: string | null) => {
    if (!value) return "";
    const words = value
      .replace(/[_\s-]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
    return words
      .map((word) => {
        const lower = word.toLowerCase();
        if (lower === "ai") return "AI";
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(" ");
  };

  const euAiActObligation = (() => {
    const primary = formatAssessmentLabel(requirementsAssessment?.primaryRole);
    let risk = formatAssessmentLabel(requirementsAssessment?.riskClassification);
    if (risk && !/risk$/i.test(risk)) {
      risk = `${risk} Risk`;
    }
    if (!primary && !risk) return "";
    if (primary && risk) return `${primary} - ${risk}`;
    return primary || risk;
  })();

  const selectedRequirementProject =
    requirementProject || newRequirement.project_slug || "";
  const handleRequirementProjectSelection = (projectSlug: string) => {
    setNewRequirement((prev) => ({
      ...prev,
      project_slug: projectSlug,
    }));
    setRequirementProject(projectSlug);
  };

  const formatFrameworkLabel = (value?: string | null) => {
    switch (value) {
      case "eu_ai_act":
        return "EU AI ACT";
      case "iso_42001":
        return "ISO 42001";
      case "nist_ai_rmf":
        return "NIST AI RMF";
      case "company_specific":
        return "ISO 27001";
      default:
        return value ?? "—";
    }
  };

  const useCaseOptions = Array.from(
    new Map(
      aiSystems
        .filter((row) => row.uc_id)
        .map((row) => [row.uc_id, row])
    ).values()
  );

  const [requirementDrafts, setRequirementDrafts] = useState(() => ({
    eu_ai_act: {
      enabled: false,
      requirement_code: "",
      uc_id: "",
      status: "not_started",
    },
    iso_42001: {
      enabled: false,
      requirement_code: "",
      uc_id: "",
      status: "not_started",
    },
    nist_ai_rmf: {
      enabled: false,
      requirement_code: "",
      uc_id: "",
      status: "not_started",
    },
    company_specific: {
      enabled: false,
      requirement_code: "",
      uc_id: "",
      status: "not_started",
    },
  }));

  const updateRequirementDraft = (
    key: keyof typeof requirementDrafts,
    patch: Partial<(typeof requirementDrafts)[keyof typeof requirementDrafts]>
  ) => {
    setRequirementDrafts((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  useEffect(() => {
    if (!euAiActObligation) return;
    setRequirementDrafts((prev) => ({
      ...prev,
      eu_ai_act: {
        ...prev.eu_ai_act,
        requirement_code: euAiActObligation,
      },
    }));
  }, [euAiActObligation]);

  const [aimsScope, setAimsScope] = useState<AimsScopeRow | null>(null);
  const [aimsScopeForm, setAimsScopeForm] = useState({
    scope_name: "",
    scope_statement: "",
    context_internal: "",
    context_external: "",
    interested_parties: "",
    scope_boundaries: "",
    lifecycle_coverage: "",
    cloud_platforms: "",
    regulatory_requirements: "",
    isms_pms_integration: "",
    exclusions: "",
    owner: "",
    status: "draft",
    updated_by: "",
  });

  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [policyQuery, setPolicyQuery] = useState("");
  const [policyStatus, setPolicyStatus] = useState("");
  const [policySelectedId, setPolicySelectedId] = useState<string | null>(null);
  const [policyVersions, setPolicyVersions] = useState<PolicyVersionRow[]>([]);
  const [policyContentModal, setPolicyContentModal] =
    useState<PolicyVersionRow | null>(null);
  const [latestPolicyContent, setLatestPolicyContent] = useState("");
  const latestPolicyVersion = policyVersions[0] ?? null;
  const policyUpdateCardRef = useRef<HTMLDivElement | null>(null);
  const policyOriginalRef = useRef<string | null>(null);
  const [policyOriginal, setPolicyOriginal] = useState<{
    title: string;
    owner_role: string;
    status: string;
    iso42001_requirement: string;
    iso42001_status: string;
    euaiact_requirements: string;
    nistairmf_requirements: string;
    comment: string;
    action: string;
    template: string;
    content: string;
  } | null>(null);
  const [policyUpdateNotice, setPolicyUpdateNotice] = useState<string | null>(null);
  const [policyApproveNotice, setPolicyApproveNotice] = useState<string | null>(null);
  const [policyReviewNotice, setPolicyReviewNotice] = useState<string | null>(null);
  const [policyRetireNotice, setPolicyRetireNotice] = useState<string | null>(null);
  const [policyApproveAllNotice, setPolicyApproveAllNotice] = useState<string | null>(
    null
  );
  const [newPolicy, setNewPolicy] = useState({
    title: "",
    owner_role: "",
    status: "draft",
    iso42001_requirement: "",
    iso42001_status: "",
    euaiact_requirements: "",
    nistairmf_requirements: "",
    comment: "",
    action: "",
    template: "",
    version_label: "v1",
    content: "",
  });
  const [policyDetailsForm, setPolicyDetailsForm] = useState({
    title: "",
    owner_role: "",
    status: "",
    iso42001_requirement: "",
    iso42001_status: "",
    euaiact_requirements: "",
    nistairmf_requirements: "",
    comment: "",
    action: "",
    template: "",
  });

  const [monitorProjectFilter, setMonitorProjectFilter] = useState("");
  const [monitorStatusFilter, setMonitorStatusFilter] = useState("");
  const [monitorLimit, setMonitorLimit] = useState(50);
  const [monitorSignals, setMonitorSignals] = useState<TrustSignalRow[]>([]);
  const [monitorDecays, setMonitorDecays] = useState<TrustDecayRow[]>([]);
  const [policyAlerts, setPolicyAlerts] = useState<PolicyAlertRow[]>([]);

  const [trustmarkProjectFilter, setTrustmarkProjectFilter] = useState("");
  const [trustmarkStatusFilter, setTrustmarkStatusFilter] = useState("");
  const [trustmarkQuery, setTrustmarkQuery] = useState("");
  const [trustmarkLimit, setTrustmarkLimit] = useState(20);
  const [trustmarkOffset, setTrustmarkOffset] = useState(0);
  const [trustmarks, setTrustmarks] = useState<TrustmarkRow[]>([]);
  const [trustmarksTotal, setTrustmarksTotal] = useState(0);
  const [issueProjectSlug, setIssueProjectSlug] = useState("");
  const [issueExpiresDays, setIssueExpiresDays] = useState(30);

  const [evidenceProjectFilter, setEvidenceProjectFilter] = useState("");
  const [evidenceStatusFilter, setEvidenceStatusFilter] = useState("");
  const [evidenceApprovalStatusFilter, setEvidenceApprovalStatusFilter] = useState("");
  const [evidenceTypeFilter, setEvidenceTypeFilter] = useState("");
  const [evidenceSearch, setEvidenceSearch] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRow | null>(
    null
  );
  const [evidenceActionUser, setEvidenceActionUser] = useState("ui");
  const [evidenceComment, setEvidenceComment] = useState("");
  const [evidenceAttachment, setEvidenceAttachment] = useState<File | null>(null);

  const [provProjectFilter, setProvProjectFilter] = useState("");
  const [provSearch, setProvSearch] = useState("");
  const [provPageSize, setProvPageSize] = useState(20);
  const [provArtifactsTotal, setProvArtifactsTotal] = useState(0);
  const [provDatasetsTotal, setProvDatasetsTotal] = useState(0);
  const [provModelsTotal, setProvModelsTotal] = useState(0);
  const [provEvidenceTotal, setProvEvidenceTotal] = useState(0);
  const [provLineageTotal, setProvLineageTotal] = useState(0);
  const [artifactPage, setArtifactPage] = useState(1);
  const [datasetPage, setDatasetPage] = useState(1);
  const [modelPage, setModelPage] = useState(1);
  const [evidencePage, setEvidencePage] = useState(1);
  const [lineagePage, setLineagePage] = useState(1);
  const [artifactForm, setArtifactForm] = useState({
    project_slug: "",
    name: "",
    uri: "",
    size_bytes: "",
    mime: "",
    license_name: "",
    license_url: "",
    usage_rights: "",
  });
  const [datasetForm, setDatasetForm] = useState({
    project_slug: "",
    name: "",
    description: "",
    artifact_id: "",
  });
  const [modelForm, setModelForm] = useState({
    project_slug: "",
    name: "",
    version: "",
    framework: "",
    description: "",
    artifact_id: "",
  });
  const [provEvidenceForm, setProvEvidenceForm] = useState({
    project_slug: "",
    name: "",
    description: "",
    artifact_id: "",
  });
  const [lineageForm, setLineageForm] = useState({
    project_slug: "",
    parent_type: "dataset",
    parent_id: "",
    child_type: "artifact",
    child_id: "",
    relationship: "",
  });
  const [auditForm, setAuditForm] = useState({
    entity_type: "artifact",
    entity_id: "",
  });

  const artifactTotalPages = Math.max(
    1,
    Math.ceil(provArtifactsTotal / provPageSize)
  );
  const datasetTotalPages = Math.max(
    1,
    Math.ceil(provDatasetsTotal / provPageSize)
  );
  const modelTotalPages = Math.max(
    1,
    Math.ceil(provModelsTotal / provPageSize)
  );
  const evidenceTotalPages = Math.max(
    1,
    Math.ceil(provEvidenceTotal / provPageSize)
  );
  const lineageTotalPages = Math.max(
    1,
    Math.ceil(provLineageTotal / provPageSize)
  );

  // ----------------- helpers -----------------
  const evidenceTypeOf = (row: EvidenceRow): string => {
    const name = row.name ?? "";
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex > -1 && dotIndex < name.length - 1) {
      return name.slice(dotIndex + 1).toLowerCase();
    }
    if (row.mime) {
      const parts = row.mime.split("/");
      return parts[1]?.toLowerCase() ?? row.mime.toLowerCase();
    }
    return "";
  };

  const normalize = (value?: string | null) =>
    (value ?? "").trim().toLowerCase();

  const isS3Uri = (value?: string | null) =>
    typeof value === "string" && value.startsWith("s3://");

  const projectNameFor = (slug?: string | null) => {
    if (!slug) return "Unknown project";
    const match = projects.find((p) => p.slug === slug);
    return match?.name ?? "Unknown project";
  };
  const aiSystemProjectLabel = (slug?: string | null) => {
    const normalized = normalize(slug);
    if (!slug || normalized === "unknown project" || normalized === "unknown") {
      return "General";
    }
    const match = projects.find((p) => p.slug === slug);
    return match?.name ?? slug;
  };

  const download = async (url: string, filename: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const openUrl = (url?: string | null) => {
    if (!url) return;
    const popup = window.open(url, "_blank");
    if (popup) popup.opener = null;
  };

  const formatBytes = (n?: number | null) => {
    if (!n || n <= 0) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(n) / Math.log(1024));
    const val = n / Math.pow(1024, i);
    return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const formatDate = (s?: string | null) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(+d)) return s;
    return d.toLocaleString();
  };

  const normalizeText = (value?: string) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };
  const normalizeComparable = (value?: string | null) =>
    (value ?? "").trim();

  const formatDateTime = (s?: string | null) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(+d)) return s || "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = String(d.getFullYear()).slice(-2);
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const formatJson = (value?: Record<string, unknown> | null) => {
    if (!value) return "";
    try {
      const text = JSON.stringify(value);
      return text.length > 160 ? `${text.slice(0, 160)}…` : text;
    } catch {
      return "";
    }
  };

  const listFromValue = (value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((v) => String(v));
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.map((v) => String(v));
          }
        } catch {
          // fall through
        }
      }
      return trimmed
        .split(/[\n,]/)
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return [];
  };

  const listToString = (value: any): string =>
    listFromValue(value).join(", ");

  const riskTierGuidance =
    "High risk if the system influences legal/financial/health/safety outcomes for people, or is used in regulated domains (employment, credit, insurance, healthcare, law enforcement, critical infrastructure).\n" +
    "Medium risk if the system influences material business decisions but has human-in-the-loop approval, limited population impact, or strong guardrails.\n" +
    "Low risk if the system is informational/assistive, has no autonomous decisioning, and can't materially harm individuals or public safety.";
  const useCaseRefMaxLen = 64;
  const buildUseCaseReferencePreview = (
    projectSlug?: string | null,
    name?: string | null
  ) => {
    if (!name) return "";
    const slugSeed =
      projectSlug && projectSlug.trim().length > 0 ? projectSlug : "general";
    const raw = `${slugSeed}-${name}`.toLowerCase();
    const slug = raw
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "use-case";
    const truncated = slug.slice(0, useCaseRefMaxLen).replace(/-+$/g, "");
    return truncated || "use-case";
  };
  const aiSystemFieldGuidance: Record<string, string> = {
    name: "Human-readable name for the AI system or use case.",
    project: "Optional project to link this AI system to.",
    owner: "Accountable owner or role for this AI system.",
    model_provider: "Entity that developed the model.",
    status: "Lifecycle status for this AI system.",
  };

  const buildTrustmarkUrl = (path: string) => {
    const params = new URLSearchParams();
    if (trustmarkProjectFilter) {
      params.set("project_slug", trustmarkProjectFilter);
    }
    if (trustmarkStatusFilter) {
      params.set("status", trustmarkStatusFilter);
    }
    if (trustmarkQuery) {
      params.set("q", trustmarkQuery);
    }
    params.set("limit", String(trustmarkLimit));
    params.set("offset", String(trustmarkOffset));
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };

  const parseListResponse = (data: any) => {
    if (Array.isArray(data)) {
      return { items: data, total: data.length };
    }
    if (data && Array.isArray(data.items)) {
      return {
        items: data.items,
        total: Number.isFinite(data.total) ? Number(data.total) : data.items.length,
      };
    }
    return { items: [], total: 0 };
  };

  const buildProvUrl = (path: string, page: number) => {
    const params = new URLSearchParams();
    if (provProjectFilter) {
      params.set("project_slug", provProjectFilter);
    }
    if (provSearch) {
      params.set("q", provSearch);
    }
    params.set("limit", String(provPageSize));
    params.set("offset", String(Math.max(0, (page - 1) * provPageSize)));
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };

  const buildMonitorUrl = (path: string, extras?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (monitorProjectFilter) {
      params.set("project_slug", monitorProjectFilter);
    }
    if (monitorStatusFilter) {
      params.set("status", monitorStatusFilter);
    }
    params.set("limit", String(monitorLimit));
    if (extras) {
      Object.entries(extras).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
    }
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };

  const loadProjects = async () => {
    try {
      const params = new URLSearchParams();
      if (effectiveEntityId) {
        params.set("entity_id", effectiveEntityId);
      }
      const url = params.toString()
        ? `${CORE}/projects?${params.toString()}`
        : `${CORE}/projects`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const items = Array.isArray(data) ? data : [];
      setProjects(items);
      if (items.length > 0) {
        const defaultSlug = items[0]?.slug ?? "";
        setArtifactForm((prev) => ({
          ...prev,
          project_slug: prev.project_slug || defaultSlug,
        }));
        setDatasetForm((prev) => ({
          ...prev,
          project_slug: prev.project_slug || defaultSlug,
        }));
        setModelForm((prev) => ({
          ...prev,
          project_slug: prev.project_slug || defaultSlug,
        }));
        setProvEvidenceForm((prev) => ({
          ...prev,
          project_slug: prev.project_slug || defaultSlug,
        }));
        setLineageForm((prev) => ({
          ...prev,
          project_slug: prev.project_slug || defaultSlug,
        }));
        setIssueProjectSlug((prev) => prev || defaultSlug);
      }
    } catch {
      // ignore project load errors for now
    }
  };

  // ----------------- KPIs -----------------
  const loadKpis = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/kpis`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load KPIs (${res.status})`);
      const data = await res.json();
      setKpiRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const exportKpis = () => download(`${CORE}/admin/kpis.xlsx`, `kpis.xlsx`);

  const importKpis = async (file: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${CORE}/admin/kpis`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(`Import failed (${res.status})`);
      await loadKpis();
      alert("KPI import completed.");
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  // ----------------- Controls -----------------
  const loadControls = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/controls`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load controls (${res.status})`);
      const data = await res.json();
      const normalized = (Array.isArray(data) ? data : []).map((r: any) => ({
        ...r,
        control_id: r.control_id ?? r.id ?? r.controlId ?? r.ID, // fallback safety
      }));
      setControls(normalized);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const exportControls = () =>
    download(`${CORE}/admin/controls.xlsx`, `controls.xlsx`);

  const importControls = async (file: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // bulk import
      const res = await fetch(`${CORE}/admin/controls`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(`Import failed (${res.status})`);
      await loadControls();
      alert("Controls import completed.");
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveControl = async (row: ControlRow) => {
    if (!row.control_id || !row.name) {
      setError("Control id and name are required to update.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        control_id: row.control_id,
        name: row.name,
        pillar: row.pillar ?? null,
        unit: row.unit ?? null,
        norm_min: row.norm_min ?? null,
        norm_max: row.norm_max ?? null,
        higher_is_better: row.higher_is_better ?? true,
        weight: row.weight ?? 1,
        axis_key: row.axis_key ?? null,
        target_text: row.target_text ?? null,
        target_numeric: row.target_numeric ?? null,
        evidence_source: row.evidence_source ?? null,
        owner_role: row.owner_role ?? null,
        frequency: row.frequency ?? null,
        failure_action: row.failure_action ?? null,
        maturity_anchor_l3: row.maturity_anchor_l3 ?? null,
        current_value: row.current_value ?? null,
        as_of: row.as_of ?? null,
        notes: row.notes ?? null,
        kpi_score: row.kpi_score ?? null,
        description: row.description ?? null,
        example: row.example ?? null,
      };
      const res = await fetch(
        `${CORE}/admin/controls/${encodeURIComponent(row.control_id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      const updated = await res.json();
      setControls((prev) =>
        prev.map((c) =>
          c.control_id === row.control_id
            ? { ...c, axis_key: updated.axis_key ?? row.axis_key }
            : c
        )
      );
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  // ----------------- Trust Axis Mapping -----------------
  const loadAxisMapping = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/trust-axis-mapping`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to load axis mapping (${res.status})`);
      }
      const data = await res.json();
      setAxisMappings(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveAxisMapping = async (row: AxisMappingRow) => {
    if (!row.pillar_key) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${CORE}/admin/trust-axis-mapping/${encodeURIComponent(
          row.pillar_key
        )}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            axis_key: row.axis_key || null,
            notes: row.notes ?? null,
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      const updated = await res.json();
      setAxisMappings((prev) =>
        prev.map((m) =>
          m.pillar_key === row.pillar_key ? { ...m, ...updated } : m
        )
      );
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  // ----------------- Provenance -----------------
  const loadProvenance = async () => {
    setBusy(true);
    setError(null);
    try {
      const [
        artifactsRes,
        datasetsRes,
        modelsRes,
        evidenceRes,
        lineageRes,
      ] = await Promise.all([
        fetch(buildProvUrl(`${CORE}/admin/provenance/artifacts`, artifactPage), {
          cache: "no-store",
        }),
        fetch(buildProvUrl(`${CORE}/admin/provenance/datasets`, datasetPage), {
          cache: "no-store",
        }),
        fetch(buildProvUrl(`${CORE}/admin/provenance/models`, modelPage), {
          cache: "no-store",
        }),
        fetch(buildProvUrl(`${CORE}/admin/provenance/evidence`, evidencePage), {
          cache: "no-store",
        }),
        fetch(buildProvUrl(`${CORE}/admin/provenance/lineage`, lineagePage), {
          cache: "no-store",
        }),
      ]);

      if (!artifactsRes.ok) {
        throw new Error(`Artifacts load failed (${artifactsRes.status})`);
      }
      if (!datasetsRes.ok) {
        throw new Error(`Datasets load failed (${datasetsRes.status})`);
      }
      if (!modelsRes.ok) {
        throw new Error(`Models load failed (${modelsRes.status})`);
      }
      if (!evidenceRes.ok) {
        throw new Error(`Evidence load failed (${evidenceRes.status})`);
      }
      if (!lineageRes.ok) {
        throw new Error(`Lineage load failed (${lineageRes.status})`);
      }

      const artifactsData = parseListResponse(await artifactsRes.json());
      const datasetsData = parseListResponse(await datasetsRes.json());
      const modelsData = parseListResponse(await modelsRes.json());
      const evidenceData = parseListResponse(await evidenceRes.json());
      const lineageData = parseListResponse(await lineageRes.json());

      setProvArtifacts(artifactsData.items);
      setProvArtifactsTotal(artifactsData.total);
      setProvDatasets(datasetsData.items);
      setProvDatasetsTotal(datasetsData.total);
      setProvModels(modelsData.items);
      setProvModelsTotal(modelsData.total);
      setProvEvidence(evidenceData.items);
      setProvEvidenceTotal(evidenceData.total);
      setProvLineage(lineageData.items);
      setProvLineageTotal(lineageData.total);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const evaluateProvenance = async () => {
    setBusy(true);
    setProvEvalError(null);
    setProvEvalResult(null);
    try {
      const trimmed = provEvalInput.trim();
      if (!trimmed) {
        throw new Error("Provide manifest facts JSON to evaluate.");
      }
      const manifest = JSON.parse(trimmed);
      const res = await fetch(
        `${CORE}/trust/provenance/evaluate${provEvalDebug ? "?debug=true" : ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manifest_facts: manifest }),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Evaluation failed (${res.status})`);
      }
      setProvEvalResult(await res.json());
    } catch (e: any) {
      setProvEvalError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const createArtifact = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        project_slug: artifactForm.project_slug.trim(),
        name: artifactForm.name.trim(),
        uri: artifactForm.uri.trim(),
        size_bytes: artifactForm.size_bytes
          ? Number(artifactForm.size_bytes)
          : null,
        mime: artifactForm.mime.trim() || null,
        license_name: artifactForm.license_name.trim() || null,
        license_url: artifactForm.license_url.trim() || null,
        usage_rights: artifactForm.usage_rights.trim() || null,
      };
      const res = await fetch(`${CORE}/admin/provenance/artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Create failed (${res.status})`);
      }
      setArtifactForm({
        project_slug: "",
        name: "",
        uri: "",
        size_bytes: "",
        mime: "",
        license_name: "",
        license_url: "",
        usage_rights: "",
      });
      await loadProvenance();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const validateArtifact = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${CORE}/admin/provenance/artifacts/${encodeURIComponent(id)}:validate`,
        { method: "POST" }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Validation failed (${res.status})`);
      }
      const data = await res.json();
      alert(
        data.match
          ? "Integrity OK."
          : `Integrity mismatch. Computed: ${data.computed_sha256}`
      );
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const loadAudit = async () => {
    if (!auditForm.entity_id.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const url = `${CORE}/admin/provenance/audit?entity_type=${encodeURIComponent(
        auditForm.entity_type
      )}&entity_id=${encodeURIComponent(auditForm.entity_id.trim())}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Audit load failed (${res.status})`);
      }
      setProvAudit(await res.json());
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const createDataset = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/provenance/datasets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_slug: datasetForm.project_slug.trim(),
          name: datasetForm.name.trim(),
          description: datasetForm.description.trim() || null,
          artifact_id: datasetForm.artifact_id.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Create failed (${res.status})`);
      }
      setDatasetForm({
        project_slug: "",
        name: "",
        description: "",
        artifact_id: "",
      });
      await loadProvenance();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const createModel = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/provenance/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_slug: modelForm.project_slug.trim(),
          name: modelForm.name.trim(),
          version: modelForm.version.trim() || null,
          framework: modelForm.framework.trim() || null,
          description: modelForm.description.trim() || null,
          artifact_id: modelForm.artifact_id.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Create failed (${res.status})`);
      }
      setModelForm({
        project_slug: "",
        name: "",
        version: "",
        framework: "",
        description: "",
        artifact_id: "",
      });
      await loadProvenance();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const createProvEvidence = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/provenance/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_slug: provEvidenceForm.project_slug.trim(),
          name: provEvidenceForm.name.trim(),
          description: provEvidenceForm.description.trim() || null,
          artifact_id: provEvidenceForm.artifact_id.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Create failed (${res.status})`);
      }
      setProvEvidenceForm({
        project_slug: "",
        name: "",
        description: "",
        artifact_id: "",
      });
      await loadProvenance();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const createLineage = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/provenance/lineage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_slug: lineageForm.project_slug.trim(),
          parent_type: lineageForm.parent_type,
          parent_id: lineageForm.parent_id.trim(),
          child_type: lineageForm.child_type,
          child_id: lineageForm.child_id.trim(),
          relationship: lineageForm.relationship.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Lineage create failed (${res.status})`);
      }
      setLineageForm((prev) => ({
        ...prev,
        parent_id: "",
        child_id: "",
        relationship: "",
      }));
      await loadProvenance();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateDataset = async (row: ProvenanceDatasetRow) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${CORE}/admin/provenance/datasets/${encodeURIComponent(row.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_slug: row.project_slug,
            name: row.name,
            description: row.description ?? null,
            artifact_id: row.artifact_id ?? null,
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      await loadProvenance();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteDataset = async (id: string) => {
    if (!confirm("Delete this dataset?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/provenance/datasets/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Delete failed (${res.status})`);
      }
      await loadProvenance();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateModel = async (row: ProvenanceModelRow) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${CORE}/admin/provenance/models/${encodeURIComponent(row.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_slug: row.project_slug,
            name: row.name,
            version: row.version ?? null,
            framework: row.framework ?? null,
            description: row.description ?? null,
            artifact_id: row.artifact_id ?? null,
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      await loadProvenance();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteModel = async (id: string) => {
    if (!confirm("Delete this model?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/provenance/models/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Delete failed (${res.status})`);
      }
      await loadProvenance();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateProvEvidence = async (row: ProvenanceEvidenceRow) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${CORE}/admin/provenance/evidence/${encodeURIComponent(row.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_slug: row.project_slug,
            name: row.name,
            description: row.description ?? null,
            artifact_id: row.artifact_id ?? null,
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      await loadProvenance();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteProvEvidence = async (id: string) => {
    if (!confirm("Delete this provenance evidence?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/provenance/evidence/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Delete failed (${res.status})`);
      }
      await loadProvenance();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateLineage = async (row: ProvenanceLineageRow) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${CORE}/admin/provenance/lineage/${row.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_slug: row.project_slug,
            parent_type: row.parent_type,
            parent_id: row.parent_id,
            child_type: row.child_type,
            child_id: row.child_id,
            relationship: row.relationship ?? null,
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      await loadProvenance();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteLineage = async (id: number) => {
    if (!confirm("Delete this lineage link?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/provenance/lineage/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Delete failed (${res.status})`);
      }
      await loadProvenance();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  // ----------------- Evidences -----------------
  const loadEvidences = async () => {
    if (!effectiveEntityId) return;
    setBusy(true);
    setError(null);
    try {
      const query = `?entity_id=${encodeURIComponent(effectiveEntityId)}`;
      const res = await fetch(`${CORE}/admin/evidences${query}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load evidences (${res.status})`);
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setEvidences(items);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteEvidence = async (id: number) => {
    if (!confirm("Delete this evidence and its data? This cannot be undone.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/evidences/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      await loadEvidences();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateEvidenceStatus = async (
    id: number,
    status: string,
    action?: string
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/evidences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          action: action ?? status,
          updated_by: evidenceActionUser,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      setSelectedEvidence((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              status,
              last_action: action ?? status,
              updated_by: evidenceActionUser,
            }
          : prev
      );
      await loadEvidences();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const recordEvidenceAction = async (id: number, action: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/evidences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, updated_by: evidenceActionUser }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      await loadEvidences();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateEvidenceApproval = async (
    id: number,
    approval_status: "approved" | "pending" | "rejected"
  ) => {
    setBusy(true);
    setError(null);
    try {
      const action =
        approval_status === "approved"
          ? "approved"
          : approval_status === "rejected"
          ? "rejected"
          : "approval_revoked";
      const res = await fetch(`${CORE}/admin/evidences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_status,
          approved_by: evidenceActionUser,
          updated_by: evidenceActionUser,
          action,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      const data = await res.json().catch(() => null);
      setSelectedEvidence((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              approval_status:
                data?.approval_status ?? approval_status ?? prev.approval_status,
              approved_by: data?.approved_by ?? evidenceActionUser,
            }
          : prev
      );
      await loadEvidences();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveEvidenceNote = async (evidence: EvidenceRow) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      if (evidenceComment) {
        form.append("comment", evidenceComment);
      }
      form.append("updated_by", evidenceActionUser);
      form.append("action", "note_updated");
      if (evidenceAttachment) {
        form.append("attachment", evidenceAttachment);
      }
      const res = await fetch(
        `${CORE}/admin/evidences/${evidence.id}/note`,
        {
          method: "POST",
          body: form,
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Save failed (${res.status})`);
      }
      const data = await res.json().catch(() => null);
      setSelectedEvidence((prev) =>
        prev && prev.id === evidence.id
          ? {
              ...prev,
              last_comment: data?.last_comment ?? evidenceComment,
              last_action: data?.last_action ?? "note_updated",
              updated_by: data?.updated_by ?? evidenceActionUser,
              last_update: data?.last_update ?? prev.last_update,
              attachment_name: data?.attachment_name ?? prev.attachment_name,
              attachment_uri: data?.attachment_uri ?? prev.attachment_uri,
              attachment_mime: data?.attachment_mime ?? prev.attachment_mime,
              attachment_size: data?.attachment_size ?? prev.attachment_size,
              attachment_sha256:
                data?.attachment_sha256 ?? prev.attachment_sha256,
              attachment_download_url:
                data?.attachment_download_url ?? prev.attachment_download_url,
            }
          : prev
      );
      setEvidenceAttachment(null);
      await loadEvidences();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const createArtifactFromEvidence = async (id: number) => {
    setBusy(true);
    setError(null);
    try {
      const row = evidences.find((e) => e.id === id);
      if (!isS3Uri(row?.uri)) {
        throw new Error(
          "Evidence must be stored in S3. Re-upload the file using the Import Evidence flow to move it to MinIO/S3 storage."
        );
      }
      const res = await fetch(
        `${CORE}/admin/provenance/artifacts/from-evidence/${id}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await res.json().catch(() => null);
          const detail = json?.detail;
          throw new Error(detail || `Create failed (${res.status})`);
        }
        const text = await res.text().catch(() => "");
        throw new Error(text || `Create failed (${res.status})`);
      }
      await res.json().catch(() => null);
      await fetch(`${CORE}/admin/evidences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "artifact_created",
          updated_by: evidenceActionUser,
        }),
      }).catch(() => null);
      alert("Artifact created from evidence.");
      if (tab === "provenance") {
        await loadProvenance();
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  // ----------------- AI System Registry -----------------
  const loadAiSystems = async () => {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (effectiveEntityId) params.set("entity_id", effectiveEntityId);
      if (aiSystemQuery) params.set("q", aiSystemQuery);
      if (aiSystemProject) params.set("project_slug", aiSystemProject);
      if (aiSystemRisk) params.set("risk_tier", aiSystemRisk);
      if (aiSystemStatus) params.set("status", aiSystemStatus);
      const url = params.toString()
        ? `${CORE}/admin/ai-systems?${params.toString()}`
        : `${CORE}/admin/ai-systems`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load AI systems (${res.status})`);
      const data = await res.json();
      setAiSystems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const createAiSystem = async () => {
    const missingRequired = validateRequiredAiSystemFields(newAiSystem);
    if (missingRequired.length > 0) {
      setError(`Required fields missing: ${missingRequired.join(", ")}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { uc_id, id, created_at, updated_at, entity_id, entity_slug, ...payload } =
        newAiSystem;
      const buildPayload = {
        project_slug: normalizeAiSystemValue(payload.project_slug),
        name: normalizeAiSystemValue(payload.name),
        description: normalizeAiSystemValue(payload.description),
        owner: normalizeAiSystemValue(payload.owner),
        system_owner_email: normalizeAiSystemValue(payload.system_owner_email),
        business_unit: normalizeAiSystemValue(payload.business_unit),
        risk_owner_role: normalizeAiSystemValue(payload.risk_owner_role),
        decision_authority: normalizeAiSystemValue(payload.decision_authority),
        model_provider: normalizeAiSystemValue(payload.model_provider),
        provider_type: normalizeAiSystemValue(payload.provider_type),
        intended_use: normalizeAiSystemValue(payload.intended_use),
        intended_users: normalizeAiSystemValue(payload.intended_users),
        system_boundary: normalizeAiSystemValue(payload.system_boundary),
        model_type: normalizeAiSystemValue(payload.model_type),
        model_version: normalizeAiSystemValue(payload.model_version),
        deployment_environment: normalizeAiSystemValue(payload.deployment_environment),
        lifecycle_stage: normalizeAiSystemValue(payload.lifecycle_stage),
        training_data_sources: normalizeAiSystemValue(payload.training_data_sources),
        personal_data_flag: payload.personal_data_flag ?? null,
        sensitive_attributes_flag: payload.sensitive_attributes_flag ?? null,
        risk_tier: normalizeAiSystemValue(payload.risk_tier),
        status: normalizeAiSystemValue(payload.status),
        region_scope: normalizeAiSystemValue(payload.region_scope),
        data_sensitivity: normalizeAiSystemValue(payload.data_sensitivity),
        model_name: normalizeAiSystemValue(payload.model_name),
        technical_lead: normalizeAiSystemValue(payload.technical_lead),
        target_users: normalizeAiSystemValue(payload.target_users),
        intended_purpose: normalizeAiSystemValue(payload.intended_purpose),
        out_of_scope_uses: normalizeAiSystemValue(payload.out_of_scope_uses),
        deployment_method: normalizeAiSystemValue(payload.deployment_method),
        data_residency: normalizeAiSystemValue(payload.data_residency),
        base_model_type: normalizeAiSystemValue(payload.base_model_type),
        input_output_modality: normalizeAiSystemValue(payload.input_output_modality),
        fine_tuning_data: normalizeAiSystemValue(payload.fine_tuning_data),
        data_minimization: normalizeAiSystemValue(payload.data_minimization),
        human_oversight_mechanism: normalizeAiSystemValue(payload.human_oversight_mechanism),
        impact_assessment_reference: normalizeAiSystemValue(payload.impact_assessment_reference),
        known_limitations: normalizeAiSystemValue(payload.known_limitations),
        langfuse_project_id: normalizeAiSystemValue(payload.langfuse_project_id),
        langfuse_base_url: normalizeAiSystemValue(payload.langfuse_base_url),
      };
      const res = await fetch(`${CORE}/admin/ai-systems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Create failed (${res.status})`);
      }
      setNewAiSystem({ name: "" });
      await loadAiSystems();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const startEditAiSystem = (row: AiSystemRow) => {
    setEditingAiSystemId(row.id);
    setEditingAiSystem({ ...row });
  };

  const cancelEditAiSystem = () => {
    setEditingAiSystemId(null);
    setEditingAiSystem(null);
  };

  const normalizeAiSystemValue = (value?: string | null) =>
    value === "" ? null : value ?? null;
  const normalizeAiSystemBool = (value?: boolean | null) =>
    value === undefined ? null : value;
  const aiSystemBoolToSelect = (value?: boolean | null) =>
    value === true ? "true" : value === false ? "false" : "";
  const aiSystemSelectToBool = (value: string): boolean | null => {
    if (!value) return null;
    return value === "true";
  };

  const updateAiSystem = async () => {
    if (!editingAiSystemId || !editingAiSystem) return;
    const missingRequired = validateRequiredAiSystemFields(editingAiSystem);
    if (missingRequired.length > 0) {
      setError(`Required fields missing: ${missingRequired.join(", ")}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        project_slug: normalizeAiSystemValue(editingAiSystem.project_slug),
        name: normalizeAiSystemValue(editingAiSystem.name),
        description: normalizeAiSystemValue(editingAiSystem.description),
        owner: normalizeAiSystemValue(editingAiSystem.owner),
        system_owner_email: normalizeAiSystemValue(editingAiSystem.system_owner_email),
        business_unit: normalizeAiSystemValue(editingAiSystem.business_unit),
        risk_owner_role: normalizeAiSystemValue(editingAiSystem.risk_owner_role),
        decision_authority: normalizeAiSystemValue(editingAiSystem.decision_authority),
        model_provider: normalizeAiSystemValue(editingAiSystem.model_provider),
        provider_type: normalizeAiSystemValue(editingAiSystem.provider_type),
        intended_use: normalizeAiSystemValue(editingAiSystem.intended_use),
        intended_users: normalizeAiSystemValue(editingAiSystem.intended_users),
        system_boundary: normalizeAiSystemValue(editingAiSystem.system_boundary),
        model_type: normalizeAiSystemValue(editingAiSystem.model_type),
        model_version: normalizeAiSystemValue(editingAiSystem.model_version),
        deployment_environment: normalizeAiSystemValue(
          editingAiSystem.deployment_environment
        ),
        lifecycle_stage: normalizeAiSystemValue(editingAiSystem.lifecycle_stage),
        training_data_sources: normalizeAiSystemValue(
          editingAiSystem.training_data_sources
        ),
        personal_data_flag: normalizeAiSystemBool(editingAiSystem.personal_data_flag),
        sensitive_attributes_flag: normalizeAiSystemBool(
          editingAiSystem.sensitive_attributes_flag
        ),
        risk_tier: normalizeAiSystemValue(editingAiSystem.risk_tier),
        status: normalizeAiSystemValue(editingAiSystem.status),
        region_scope: normalizeAiSystemValue(editingAiSystem.region_scope),
        data_sensitivity: normalizeAiSystemValue(editingAiSystem.data_sensitivity),
        model_name: normalizeAiSystemValue(editingAiSystem.model_name),
        technical_lead: normalizeAiSystemValue(editingAiSystem.technical_lead),
        target_users: normalizeAiSystemValue(editingAiSystem.target_users),
        intended_purpose: normalizeAiSystemValue(editingAiSystem.intended_purpose),
        out_of_scope_uses: normalizeAiSystemValue(editingAiSystem.out_of_scope_uses),
        deployment_method: normalizeAiSystemValue(editingAiSystem.deployment_method),
        data_residency: normalizeAiSystemValue(editingAiSystem.data_residency),
        base_model_type: normalizeAiSystemValue(editingAiSystem.base_model_type),
        input_output_modality: normalizeAiSystemValue(editingAiSystem.input_output_modality),
        fine_tuning_data: normalizeAiSystemValue(editingAiSystem.fine_tuning_data),
        data_minimization: normalizeAiSystemValue(editingAiSystem.data_minimization),
        human_oversight_mechanism: normalizeAiSystemValue(editingAiSystem.human_oversight_mechanism),
        impact_assessment_reference: normalizeAiSystemValue(editingAiSystem.impact_assessment_reference),
        known_limitations: normalizeAiSystemValue(editingAiSystem.known_limitations),
        langfuse_project_id: normalizeAiSystemValue(editingAiSystem.langfuse_project_id),
        langfuse_base_url: normalizeAiSystemValue(editingAiSystem.langfuse_base_url),
      };
      const res = await fetch(`${CORE}/admin/ai-systems/${editingAiSystemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      await autoSyncLangfuse(
        editingAiSystemId,
        editingAiSystem.langfuse_project_id
      );
      await loadAiSystems();
      cancelEditAiSystem();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateAiSystemDraft = (patch: Partial<AiSystemRow>) => {
    setAiSystemModalDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const validateRequiredAiSystemFields = (draft: Partial<AiSystemRow>) => {
    const missing: string[] = [];
    if (!String(draft.name ?? "").trim()) missing.push("Name");
    if (!String(draft.owner ?? "").trim()) missing.push("Owner");
    if (!String(draft.model_provider ?? "").trim()) missing.push("Model Provider");
    if (!String(draft.model_type ?? "").trim()) missing.push("Model Type");
    if (!String(draft.system_boundary ?? "").trim()) missing.push("System Boundary");
    return missing;
  };

  const resetLangfuseKeyDraft = () => {
    setLangfuseKeyPublic("");
    setLangfuseKeySecret("");
    setLangfuseKeyNotice(null);
    setLangfuseKeyError(null);
    setLangfuseKeyBusy(false);
  };

  const openAiSystemModal = (row: AiSystemRow) => {
    setAiSystemModalMode("edit");
    setAiSystemModalDraft({ ...row });
    setAiSystemModalError(null);
    setAiSystemModalNotice(null);
    setAiSystemModalSaving(false);
    resetLangfuseKeyDraft();
    setAiSystemModalOpen(true);
  };

  const openNewAiSystemModal = () => {
    setAiSystemModalMode("create");
    setAiSystemModalDraft({
      name: "",
      status: "active",
      risk_tier: "",
      project_slug: "",
    });
    setAiSystemModalError(null);
    setAiSystemModalNotice(null);
    setAiSystemModalSaving(false);
    resetLangfuseKeyDraft();
    setAiSystemModalOpen(true);
  };

  const fetchLangfuseProjectId = async () => {
    if (!langfuseKeyPublic || !langfuseKeySecret) {
      setLangfuseKeyError("Langfuse public and secret keys are required.");
      return;
    }
    setLangfuseKeyBusy(true);
    setLangfuseKeyError(null);
    setLangfuseKeyNotice(null);
    try {
      const payload = {
        public_key: langfuseKeyPublic,
        secret_key: langfuseKeySecret,
        base_url: aiSystemModalDraft?.langfuse_base_url || undefined,
      };
      const res = await fetch(`${CORE}/admin/langfuse/project-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Langfuse lookup failed (${res.status})`);
      }
      const data = await res.json();
      if (data?.project_id) {
        updateAiSystemDraft({
          langfuse_project_id: data.project_id,
          langfuse_base_url:
            aiSystemModalDraft?.langfuse_base_url || data.base_url || null,
        });
        setLangfuseKeyNotice("Langfuse project ID populated.");
      } else {
        throw new Error("Langfuse project id missing in response.");
      }
    } catch (e: any) {
      setLangfuseKeyError(e.message ?? String(e));
    } finally {
      setLangfuseKeyBusy(false);
    }
  };

  const autoSyncLangfuse = async (
    systemId?: string | null,
    projectId?: string | null
  ) => {
    if (!systemId || !projectId) {
      return { ok: true, skipped: true, message: "Langfuse sync skipped." };
    }
    try {
      const res = await fetch(
        `${CORE}/admin/model-cards/${encodeURIComponent(systemId)}/sync-langfuse`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        return {
          ok: false,
          skipped: false,
          message: data?.message || `Langfuse sync failed (${res.status})`,
        };
      }
      return { ok: true, skipped: false, message: "Langfuse synced." };
    } catch (e: any) {
      return {
        ok: false,
        skipped: false,
        message: e?.message ?? String(e),
      };
    }
  };

  const saveAiSystemModal = async (options?: { keepOpen?: boolean }) => {
    if (!aiSystemModalDraft) return;
    const missingRequired = validateRequiredAiSystemFields(aiSystemModalDraft);
    if (missingRequired.length > 0) {
      setAiSystemModalError(
        `Required fields missing: ${missingRequired.join(", ")}`
      );
      return;
    }
    setAiSystemModalSaving(true);
    setAiSystemModalError(null);
    try {
      const payload = {
        project_slug: normalizeAiSystemValue(aiSystemModalDraft.project_slug),
        name: normalizeAiSystemValue(aiSystemModalDraft.name),
        description: normalizeAiSystemValue(aiSystemModalDraft.description),
        owner: normalizeAiSystemValue(aiSystemModalDraft.owner),
        system_owner_email: normalizeAiSystemValue(
          aiSystemModalDraft.system_owner_email
        ),
        business_unit: normalizeAiSystemValue(aiSystemModalDraft.business_unit),
        risk_owner_role: normalizeAiSystemValue(aiSystemModalDraft.risk_owner_role),
        decision_authority: normalizeAiSystemValue(
          aiSystemModalDraft.decision_authority
        ),
        model_provider: normalizeAiSystemValue(aiSystemModalDraft.model_provider),
        provider_type: normalizeAiSystemValue(aiSystemModalDraft.provider_type),
        intended_use: normalizeAiSystemValue(aiSystemModalDraft.intended_use),
        intended_users: normalizeAiSystemValue(aiSystemModalDraft.intended_users),
        system_boundary: normalizeAiSystemValue(aiSystemModalDraft.system_boundary),
        model_type: normalizeAiSystemValue(aiSystemModalDraft.model_type),
        model_version: normalizeAiSystemValue(aiSystemModalDraft.model_version),
        deployment_environment: normalizeAiSystemValue(
          aiSystemModalDraft.deployment_environment
        ),
        lifecycle_stage: normalizeAiSystemValue(aiSystemModalDraft.lifecycle_stage),
        training_data_sources: normalizeAiSystemValue(
          aiSystemModalDraft.training_data_sources
        ),
        personal_data_flag: normalizeAiSystemBool(
          aiSystemModalDraft.personal_data_flag
        ),
        sensitive_attributes_flag: normalizeAiSystemBool(
          aiSystemModalDraft.sensitive_attributes_flag
        ),
        risk_tier: normalizeAiSystemValue(aiSystemModalDraft.risk_tier),
        status: normalizeAiSystemValue(aiSystemModalDraft.status),
        region_scope: normalizeAiSystemValue(aiSystemModalDraft.region_scope),
        data_sensitivity: normalizeAiSystemValue(aiSystemModalDraft.data_sensitivity),
        model_name: normalizeAiSystemValue(aiSystemModalDraft.model_name),
        technical_lead: normalizeAiSystemValue(aiSystemModalDraft.technical_lead),
        target_users: normalizeAiSystemValue(aiSystemModalDraft.target_users),
        intended_purpose: normalizeAiSystemValue(aiSystemModalDraft.intended_purpose),
        out_of_scope_uses: normalizeAiSystemValue(aiSystemModalDraft.out_of_scope_uses),
        deployment_method: normalizeAiSystemValue(aiSystemModalDraft.deployment_method),
        data_residency: normalizeAiSystemValue(aiSystemModalDraft.data_residency),
        base_model_type: normalizeAiSystemValue(aiSystemModalDraft.base_model_type),
        input_output_modality: normalizeAiSystemValue(aiSystemModalDraft.input_output_modality),
        fine_tuning_data: normalizeAiSystemValue(aiSystemModalDraft.fine_tuning_data),
        data_minimization: normalizeAiSystemValue(aiSystemModalDraft.data_minimization),
        human_oversight_mechanism: normalizeAiSystemValue(aiSystemModalDraft.human_oversight_mechanism),
        impact_assessment_reference: normalizeAiSystemValue(aiSystemModalDraft.impact_assessment_reference),
        known_limitations: normalizeAiSystemValue(aiSystemModalDraft.known_limitations),
        langfuse_project_id: normalizeAiSystemValue(aiSystemModalDraft.langfuse_project_id),
        langfuse_base_url: normalizeAiSystemValue(aiSystemModalDraft.langfuse_base_url),
      };
      const isCreate = aiSystemModalMode === "create";
      const url = isCreate
        ? `${CORE}/admin/ai-systems`
        : `${CORE}/admin/ai-systems/${aiSystemModalDraft.id}`;
      const res = await fetch(url, {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `${isCreate ? "Create" : "Update"} failed (${res.status})`);
      }
      const data = await res.json().catch(() => ({}));
      const systemId = data?.id || aiSystemModalDraft.id;
      const syncResult = await autoSyncLangfuse(
        systemId,
        aiSystemModalDraft.langfuse_project_id
      );
      await loadAiSystems();
      if (!isCreate) {
        if (syncResult?.skipped) {
          setAiSystemModalNotice("AI system updated.");
        } else if (syncResult?.ok) {
          setAiSystemModalNotice("AI system updated. Langfuse synced.");
        } else {
          setAiSystemModalNotice(
            `AI system updated. ${syncResult?.message || "Langfuse sync failed."}`
          );
        }
      }
      if (isCreate) {
        if (options?.keepOpen) {
          const nextDraft = {
            ...aiSystemModalDraft,
            ...data,
            id: data?.id || aiSystemModalDraft.id,
          };
          setAiSystemModalMode("edit");
          setAiSystemModalDraft(nextDraft);
          if (syncResult?.skipped) {
            setAiSystemModalNotice("AI system created.");
          } else if (syncResult?.ok) {
            setAiSystemModalNotice("AI system created. Langfuse synced.");
          } else {
            setAiSystemModalNotice(
              `AI system created. ${syncResult?.message || "Langfuse sync failed."}`
            );
          }
        } else {
          resetAiSystemModalState();
        }
      }
    } catch (e: any) {
      setAiSystemModalError(e.message ?? String(e));
    } finally {
      setAiSystemModalSaving(false);
    }
  };

  const retireAiSystemFromModal = async () => {
    if (!aiSystemModalDraft?.id || !aiSystemModalDraft?.name) return;
    if (!confirm(`Retire \"${aiSystemModalDraft.name}\"?`)) return;
    setAiSystemModalSaving(true);
    setAiSystemModalError(null);
    try {
      const res = await fetch(
        `${CORE}/admin/ai-systems/${aiSystemModalDraft.id}/retire`,
        { method: "POST" }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Retire failed (${res.status})`);
      }
      await loadAiSystems();
      resetAiSystemModalState();
    } catch (e: any) {
      setAiSystemModalError(e.message ?? String(e));
    } finally {
      setAiSystemModalSaving(false);
    }
  };

  const retireAiSystem = async (row: AiSystemRow) => {
    if (!confirm(`Retire "${row.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/ai-systems/${row.id}/retire`, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Retire failed (${res.status})`);
      }
      await loadAiSystems();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  // ----------------- Requirement Register -----------------
  const loadRequirements = async () => {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (effectiveEntityId) params.set("entity_id", effectiveEntityId);
      if (requirementQuery) params.set("q", requirementQuery);
      if (requirementProject) params.set("project_slug", requirementProject);
      if (requirementUcId) params.set("uc_id", requirementUcId);
      if (requirementFramework) params.set("framework", requirementFramework);
      if (requirementStatus) params.set("status", requirementStatus);
      const url = params.toString()
        ? `${CORE}/admin/requirements?${params.toString()}`
        : `${CORE}/admin/requirements`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load requirements (${res.status})`);
      const data = await res.json();
      setRequirements(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const loadRequirementKpis = async (projectSlug: string) => {
    if (!projectSlug) {
      setRequiredKpis([]);
      setRequiredKpiSummary([]);
      return { items: [], summary: [] as RequirementKpiSummary[] };
    }
    setRequiredKpiLoading(true);
    setRequiredKpiError(null);
    try {
      const params = new URLSearchParams({
        project_slug: projectSlug,
      });
      const res = await fetch(
        `${CORE}/admin/requirements/project-kpis?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        throw new Error(`Failed to load required KPIs (${res.status})`);
      }
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const summary = Array.isArray(data?.summary) ? data.summary : [];
      setRequiredKpis(items);
      setRequiredKpiSummary(summary);
      return { items, summary };
    } catch (e: any) {
      setRequiredKpiError(e.message ?? String(e));
      return { items: [], summary: [] as RequirementKpiSummary[] };
    } finally {
      setRequiredKpiLoading(false);
    }
  };

  const openKpiDetail = async (kpiKey: string) => {
    setKpiDetailOpen(true);
    setKpiDetailLoading(true);
    setKpiDetailError(null);
    setKpiDetail(null);
    try {
      const res = await fetch(
        `${CORE}/admin/knowledgebase/kpis/${encodeURIComponent(kpiKey)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        throw new Error(`Failed to load KPI details (${res.status})`);
      }
      const data = await res.json();
      setKpiDetail(data ?? null);
    } catch (e: any) {
      setKpiDetailError(e.message ?? String(e));
    } finally {
      setKpiDetailLoading(false);
    }
  };

  const launchGovernanceReport = async () => {
    const projectSlug =
      newRequirement.project_slug || selectedRequirementProject || "";
    if (!projectSlug) {
      setGovReportError("Select a project first.");
      return;
    }
    setGovReportLoading(true);
    setGovReportError(null);
    try {
      const params = new URLSearchParams({ provider: "ollama" });
      const res = await fetch(
        `${CORE}/admin/ai-reports/projects/${encodeURIComponent(
          projectSlug
        )}/governance-requirements-report?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to generate report (${res.status})`);
      }
      const data = await res.json();
      setGovReport(data?.report_md || "");
      setGovReportMeta(data || null);
      setGovReportSources(Array.isArray(data?.sources_used) ? data.sources_used : []);
      setGovReportOpen(true);
    } catch (e: any) {
      setGovReportError(e.message ?? String(e));
    } finally {
      setGovReportLoading(false);
    }
  };

  const closeKpiDetail = () => {
    setKpiDetailOpen(false);
    setKpiDetail(null);
    setKpiDetailError(null);
  };

  const deleteRequirementKpi = async (row: RequirementKpiRow) => {
    if (!selectedRequirementProject) return;
    if (!row.requirement_code) {
      setRequiredKpiError("No requirement code found for this KPI.");
      return;
    }
    const projectName = projectNameFor(selectedRequirementProject);
    if (!confirm(`Do you want to delete this KPI from Project ${projectName}?`)) {
      return;
    }
    setRequiredKpiLoading(true);
    setRequiredKpiError(null);
    try {
      const params = new URLSearchParams({
        project_slug: selectedRequirementProject,
        framework: row.framework,
        requirement_code: row.requirement_code,
      });
      const res = await fetch(`${CORE}/admin/requirements?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to locate requirement (${res.status})`);
      }
      const data = await res.json();
      const items: RequirementRow[] = Array.isArray(data?.items) ? data.items : [];
      if (!items.length) {
        setRequiredKpiError("No matching requirement entry found to delete.");
        return;
      }
      for (const item of items) {
        const delRes = await fetch(`${CORE}/admin/requirements/${item.id}`, {
          method: "DELETE",
        });
        if (!delRes.ok) {
          const text = await delRes.text().catch(() => "");
          throw new Error(text || `Delete failed (${delRes.status})`);
        }
      }
      await loadRequirementKpis(selectedRequirementProject);
    } catch (e: any) {
      setRequiredKpiError(e.message ?? String(e));
    } finally {
      setRequiredKpiLoading(false);
    }
  };

  const addRequirementEntry = (framework: RequirementDraftKey) => {
    if (!newRequirement.project_slug) {
      setError("Select a project first");
      return;
    }
    const draft = requirementDrafts[framework];
    if (!draft.enabled) {
      setError("Select the framework before adding an entry");
      return;
    }
    if (!draft.requirement_code) {
      setError("Complete all selected framework details");
      return;
    }
    const entry: PendingRequirementEntry = {
      id:
        (typeof crypto !== "undefined" && crypto.randomUUID?.()) ||
        `${framework}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      project_slug: newRequirement.project_slug,
      framework,
      requirement_code: draft.requirement_code,
      uc_id: draft.uc_id || null,
      status: draft.status || "not_started",
    };
    setPendingRequirementEntries((prev) => {
      const exists = prev.some(
        (item) =>
          item.project_slug === entry.project_slug &&
          item.framework === entry.framework &&
          item.requirement_code === entry.requirement_code &&
          (item.uc_id || "") === (entry.uc_id || "") &&
          item.status === entry.status
      );
      if (exists) {
        setError("This entry already exists in the list");
        return prev;
      }
      setError(null);
      return [...prev, entry];
    });
  };

  const removePendingRequirementEntry = (entryId: string) => {
    setPendingRequirementEntries((prev) =>
      prev.filter((item) => item.id !== entryId)
    );
  };

  const removeLastEntryForFramework = (framework: RequirementDraftKey) => {
    setPendingRequirementEntries((prev) => {
      const idx = [...prev].map((item) => item.framework).lastIndexOf(framework);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  };

  const createRequirement = async () => {
    if (!pendingRequirementEntries.length) {
      setError("Add at least one entry before creating KPIs");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const entry of pendingRequirementEntries) {
        const payload = {
          project_slug: entry.project_slug,
          framework: entry.framework,
          requirement_code: entry.requirement_code,
          uc_id: entry.uc_id || null,
          status: entry.status || "not_started",
        };
        const res = await fetch(`${CORE}/admin/requirements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Create failed (${res.status})`);
        }
      }
      setPendingRequirementEntries([]);
      setRequirementDrafts((prev) => ({
        eu_ai_act: {
          ...prev.eu_ai_act,
          enabled: false,
          uc_id: "",
          status: "not_started",
        },
        iso_42001: {
          ...prev.iso_42001,
          enabled: false,
          requirement_code: "",
          uc_id: "",
          status: "not_started",
        },
        nist_ai_rmf: {
          ...prev.nist_ai_rmf,
          enabled: false,
          requirement_code: "",
          uc_id: "",
          status: "not_started",
        },
        company_specific: {
          ...prev.company_specific,
          enabled: false,
          requirement_code: "",
          uc_id: "",
          status: "not_started",
        },
      }));
      await loadRequirements();
      if (selectedRequirementProject) {
        await loadRequirementKpis(selectedRequirementProject);
        setRequiredKpiSaved(true);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveRequiredKpis = async (resetApply = true) => {
    if (!selectedRequirementProject) return;
    setRequiredKpiSaving(true);
    setRequiredKpiSaveNotice(null);
    setRequiredKpiDiff(null);
    setApplyKpiChangesNotice(null);
    if (resetApply) {
      setRequiredKpiApplyComplete(false);
    }
    try {
      const { items } = await loadRequirementKpis(selectedRequirementProject);
      const requiredKeys = new Set(
        (items ?? [])
          .map((row) => row.kpi_key)
          .filter((key): key is string => Boolean(key))
      );

      const res = await fetch(
        `${CORE}/admin/projects/${encodeURIComponent(
          selectedRequirementProject
        )}/control-values/kpis`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to load existing KPIs (${res.status})`);
      }
      const data = await res.json();
      const existingItems = Array.isArray(data?.items) ? data.items : [];
      const existingKeys = new Set(
        existingItems.filter((key: any) => typeof key === "string" && key.length)
      );

      const requiredList = Array.from(requiredKeys).sort();
      const existingList = Array.from(existingKeys).sort();
      const newKeys = requiredList.filter((key) => !existingKeys.has(key));
      const removedKeys = existingList.filter((key) => !requiredKeys.has(key));
      const existingMatch = requiredList.filter((key) => existingKeys.has(key));

      setRequiredKpiDiff({
        existing: existingMatch.length,
        newCount: newKeys.length,
        removed: removedKeys.length,
        existingKeys: existingMatch,
        newKeys,
        removedKeys,
        requiredKeys: requiredList,
      });
      setRequiredKpiSaveComplete(true);
      setRequiredKpiSaveNotice("Saved.");

      if (newKeys.length || removedKeys.length) {
        const syncRes = await fetch(
          `${CORE}/admin/projects/${encodeURIComponent(
            selectedRequirementProject
          )}/control-values/sync`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kpi_keys: requiredList }),
          }
        );
        if (!syncRes.ok) {
          const text = await syncRes.text().catch(() => "");
          throw new Error(text || `Failed to sync controls (${syncRes.status})`);
        }
        const data = await syncRes.json().catch(() => ({}));
        setApplyKpiChangesNotice(
          `Applied. Added ${data?.added ?? 0}, removed ${data?.removed ?? 0}.`
        );
        setRequiredKpiApplyComplete(true);
        setRequiredKpiDiff(null);
      } else {
        setRequiredKpiApplyComplete(true);
      }
    } catch (e: any) {
      setRequiredKpiSaveComplete(false);
      setRequiredKpiSaveNotice(e.message ?? "Save failed.");
    } finally {
      setRequiredKpiSaving(false);
    }
  };

  const goToControlsRegister = () => {
    if (typeof window === "undefined") return;
    const parts = window.location.pathname.split("/").filter(Boolean);
    const slug = parts.length >= 2 && parts[1] === "scorecard" ? parts[0] : "";
    const target = slug
      ? `/${encodeURIComponent(slug)}/scorecard/admin/governance-setup/control-register`
      : "/scorecard/admin/governance-setup/control-register";
    window.location.href = target;
  };

  const applyRequiredKpiChanges = async () => {
    if (!selectedRequirementProject || !requiredKpiDiff) return;
    setApplyKpiChangesBusy(true);
    setApplyKpiChangesNotice(null);
    try {
      const res = await fetch(
        `${CORE}/admin/projects/${encodeURIComponent(
          selectedRequirementProject
        )}/control-values/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kpi_keys: requiredKpiDiff.requiredKeys }),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Apply failed (${res.status})`);
      }
      const data = await res.json().catch(() => ({}));
      setApplyKpiChangesNotice(
        `Applied. Added ${data?.added ?? 0}, removed ${data?.removed ?? 0}.`
      );
      setRequiredKpiApplyComplete(true);
      await saveRequiredKpis(false);
    } catch (e: any) {
      setRequiredKpiApplyComplete(false);
      setApplyKpiChangesNotice(e.message ?? "Apply failed.");
    } finally {
      setApplyKpiChangesBusy(false);
    }
  };

  const updateRequirementLinks = async (req: RequirementRow) => {
    setBusy(true);
    setError(null);
    try {
      const mapped_controls = listFromValue(editingControls);
      const evidence_ids = listFromValue(editingEvidence).map((v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
      });
      const res = await fetch(`${CORE}/admin/requirements/${req.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapped_controls,
          evidence_ids,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      setEditingRequirementId(null);
      setEditingControls("");
      setEditingEvidence("");
      await loadRequirements();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteRequirement = async (req: RequirementRow) => {
    if (
      !confirm(
        `Delete requirement ${req.requirement_code}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/requirements/${req.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Delete failed (${res.status})`);
      }
      await loadRequirements();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  // ----------------- AIMS Scope (ISO 42001 Clause 4) -----------------
  const hydrateAimsScopeForm = (item: AimsScopeRow | null) => {
    setAimsScopeForm({
      scope_name: item?.scope_name ?? "",
      scope_statement: item?.scope_statement ?? "",
      context_internal: item?.context_internal ?? "",
      context_external: item?.context_external ?? "",
      interested_parties: listToString(item?.interested_parties ?? ""),
      scope_boundaries: item?.scope_boundaries ?? "",
      lifecycle_coverage: listToString(item?.lifecycle_coverage ?? ""),
      cloud_platforms: listToString(item?.cloud_platforms ?? ""),
      regulatory_requirements: listToString(item?.regulatory_requirements ?? ""),
      isms_pms_integration: item?.isms_pms_integration ?? "",
      exclusions: item?.exclusions ?? "",
      owner: item?.owner ?? "",
      status: item?.status ?? "draft",
      updated_by: item?.updated_by ?? "",
    });
  };

  const loadAimsScope = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/aims-scope`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load AIMS scope (${res.status})`);
      const data = await res.json();
      const item = (data?.item ?? null) as AimsScopeRow | null;
      setAimsScope(item);
      hydrateAimsScopeForm(item);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveAimsScope = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        scope_name: aimsScopeForm.scope_name || null,
        scope_statement: aimsScopeForm.scope_statement || null,
        context_internal: aimsScopeForm.context_internal || null,
        context_external: aimsScopeForm.context_external || null,
        interested_parties: listFromValue(aimsScopeForm.interested_parties),
        scope_boundaries: aimsScopeForm.scope_boundaries || null,
        lifecycle_coverage: listFromValue(aimsScopeForm.lifecycle_coverage),
        cloud_platforms: listFromValue(aimsScopeForm.cloud_platforms),
        regulatory_requirements: listFromValue(aimsScopeForm.regulatory_requirements),
        isms_pms_integration: aimsScopeForm.isms_pms_integration || null,
        exclusions: aimsScopeForm.exclusions || null,
        owner: aimsScopeForm.owner || null,
        status: aimsScopeForm.status || null,
        updated_by: aimsScopeForm.updated_by || null,
      };
      const res = await fetch(`${CORE}/admin/aims-scope`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Save failed (${res.status})`);
      }
      await loadAimsScope();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  // ----------------- Policy Manager -----------------
  const loadPolicies = async () => {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (policyQuery) params.set("q", policyQuery);
      if (policyStatus) params.set("status", policyStatus);
      if (entityId) params.set("entity_id", entityId);
      const url = params.toString()
        ? `${CORE}/admin/policies?${params.toString()}`
        : `${CORE}/admin/policies`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load policies (${res.status})`);
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setPolicies(items);
      if (policySelectedId && !items.some((p) => p.id === policySelectedId)) {
        setPolicySelectedId(null);
        setPolicyVersions([]);
        setLatestPolicyContent("");
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!policySelectedId) {
      setPolicyDetailsForm({
        title: "",
        owner_role: "",
        status: "",
        iso42001_requirement: "",
        iso42001_status: "",
        euaiact_requirements: "",
        nistairmf_requirements: "",
        comment: "",
        action: "",
        template: "",
      });
      setPolicyOriginal(null);
      policyOriginalRef.current = null;
      return;
    }
    const selected = policies.find((item) => item.id === policySelectedId);
    if (!selected) return;
      setPolicyDetailsForm({
        title: selected.title ?? "",
        owner_role: selected.owner_role ?? "",
        status: selected.status ?? "",
        iso42001_requirement: selected.iso42001_requirement ?? "",
        iso42001_status: selected.iso42001_status ?? "",
        euaiact_requirements: selected.euaiact_requirements ?? "",
        nistairmf_requirements: selected.nistairmf_requirements ?? "",
        comment: selected.comment ?? "",
        action: selected.action ?? "",
        template: selected.template ?? "",
      });
  }, [policySelectedId, policies]);

  useEffect(() => {
    setPolicyUpdateNotice(null);
    setPolicyApproveNotice(null);
    setPolicyReviewNotice(null);
    setPolicyRetireNotice(null);
    if (!policySelectedId) {
      setPolicyOriginal(null);
      policyOriginalRef.current = null;
      return;
    }
    if (policyOriginalRef.current && policyOriginalRef.current !== policySelectedId) {
      policyOriginalRef.current = null;
      setPolicyOriginal(null);
    }
  }, [policySelectedId]);

  useEffect(() => {
    const latest = policyVersions[0];
    setLatestPolicyContent(latest?.content ?? "");
  }, [policySelectedId, policyVersions]);


  const loadPolicyVersions = async (policyId: string) => {
    if (!policyId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/policies/${policyId}/versions`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to load policy versions (${res.status})`);
      }
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setPolicyVersions(items);
      setPolicySelectedId(policyId);
      setPolicyContentModal(null);
      const selected = policies.find((item) => item.id === policyId);
      if (selected) {
        const snapshot = {
          title: selected.title ?? "",
          owner_role: selected.owner_role ?? "",
          status: selected.status ?? "",
          iso42001_requirement: selected.iso42001_requirement ?? "",
          iso42001_status: selected.iso42001_status ?? "",
          euaiact_requirements: selected.euaiact_requirements ?? "",
          nistairmf_requirements: selected.nistairmf_requirements ?? "",
          comment: selected.comment ?? "",
          action: selected.action ?? "",
          template: selected.template ?? "",
          content: items[0]?.content ?? "",
        };
        setPolicyOriginal(snapshot);
        policyOriginalRef.current = policyId;
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const createPolicy = async () => {
    if (!newPolicy.title.trim()) {
      setError("Policy title is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title: newPolicy.title.trim(),
        owner_role: normalizeText(newPolicy.owner_role),
        status: normalizeText(newPolicy.status) ?? "draft",
        iso42001_requirement: normalizeText(newPolicy.iso42001_requirement),
        iso42001_status: normalizeText(newPolicy.iso42001_status),
        euaiact_requirements: normalizeText(newPolicy.euaiact_requirements),
        nistairmf_requirements: normalizeText(newPolicy.nistairmf_requirements),
        comment: normalizeText(newPolicy.comment),
        action: normalizeText(newPolicy.action),
        template: normalizeText(newPolicy.template),
        version_label: normalizeText(newPolicy.version_label),
        content: normalizeText(newPolicy.content),
      };
      const res = await fetch(`${CORE}/admin/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Create failed (${res.status})`);
      }
      setNewPolicy({
        title: "",
        owner_role: "",
        status: "draft",
        iso42001_requirement: "",
        iso42001_status: "",
        euaiact_requirements: "",
        nistairmf_requirements: "",
        comment: "",
        action: "",
        template: "",
        version_label: "v1",
        content: "",
      });
      await loadPolicies();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const updatePolicyVersionStatus = async (
    versionId: string,
    status: string
  ): Promise<boolean> => {
    if (!versionId) return false;
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { status };
      if (status === "approved") {
        payload.approved_by = "ui";
      }
      const res = await fetch(`${CORE}/admin/policy-versions/${versionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      if (policySelectedId) {
        await loadPolicyVersions(policySelectedId);
      }
      await loadPolicies();
      return true;
    } catch (e: any) {
      setError(e.message ?? String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const updatePolicyStatus = async (
    policyId: string,
    status: string
  ): Promise<boolean> => {
    if (!policyId) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/policies/${policyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      await loadPolicies();
      return true;
    } catch (e: any) {
      setError(e.message ?? String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const approveAllPolicies = async () => {
    setBusy(true);
    setError(null);
    setPolicyApproveAllNotice(null);
    try {
      const targets = policies.filter(
        (policy) =>
          policy.latest_version?.id &&
          policy.latest_version.status !== "approved"
      );
      for (const policy of targets) {
        const res = await fetch(
          `${CORE}/admin/policy-versions/${policy.latest_version?.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "approved", approved_by: "ui" }),
          }
        );
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Approve failed (${res.status})`);
        }
      }
      await loadPolicies();
      if (policySelectedId) {
        await loadPolicyVersions(policySelectedId);
      }
      setPolicyApproveAllNotice(
        "Policies approved, click on 'Next Step: Save & Finalise AI Governance Setup' button to proceed"
      );
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleApprovePolicy = async () => {
    if (!latestPolicyVersion) return;
    const ok = await updatePolicyVersionStatus(latestPolicyVersion.id, "approved");
    if (ok) {
      setPolicyApproveNotice("Policy is approved");
      setPolicyReviewNotice(null);
      setPolicyRetireNotice(null);
      setPolicyUpdateNotice(null);
    }
  };

  const handleReviewPolicy = async () => {
    if (!latestPolicyVersion) return;
    const ok = await updatePolicyVersionStatus(latestPolicyVersion.id, "review");
    if (ok) {
      setPolicyReviewNotice("Policy set to review");
      setPolicyApproveNotice(null);
      setPolicyRetireNotice(null);
      setPolicyUpdateNotice(null);
    }
  };

  const handleRetirePolicy = async () => {
    if (!policySelectedId) return;
    const ok = await updatePolicyStatus(policySelectedId, "retired");
    if (ok) {
      setPolicyRetireNotice("Policy is Retired");
      setPolicyApproveNotice(null);
      setPolicyReviewNotice(null);
      setPolicyUpdateNotice(null);
    }
  };

  const updateSelectedPolicy = async () => {
    if (!policySelectedId) {
      setError("Select a policy first.");
      return;
    }
    const currentSnapshot = {
      title: normalizeComparable(policyDetailsForm.title),
      owner_role: normalizeComparable(policyDetailsForm.owner_role),
      status: normalizeComparable(policyDetailsForm.status),
      iso42001_requirement: normalizeComparable(policyDetailsForm.iso42001_requirement),
      iso42001_status: normalizeComparable(policyDetailsForm.iso42001_status),
      euaiact_requirements: normalizeComparable(
        policyDetailsForm.euaiact_requirements
      ),
      nistairmf_requirements: normalizeComparable(
        policyDetailsForm.nistairmf_requirements
      ),
      comment: normalizeComparable(policyDetailsForm.comment),
      action: normalizeComparable(policyDetailsForm.action),
      template: normalizeComparable(policyDetailsForm.template),
      content: normalizeComparable(latestPolicyContent),
    };
    const originalSnapshot = policyOriginal
      ? {
          title: normalizeComparable(policyOriginal.title),
          owner_role: normalizeComparable(policyOriginal.owner_role),
          status: normalizeComparable(policyOriginal.status),
          iso42001_requirement: normalizeComparable(
            policyOriginal.iso42001_requirement
          ),
          iso42001_status: normalizeComparable(policyOriginal.iso42001_status),
          euaiact_requirements: normalizeComparable(
            policyOriginal.euaiact_requirements
          ),
          nistairmf_requirements: normalizeComparable(
            policyOriginal.nistairmf_requirements
          ),
          comment: normalizeComparable(policyOriginal.comment),
          action: normalizeComparable(policyOriginal.action),
          template: normalizeComparable(policyOriginal.template),
          content: normalizeComparable(policyOriginal.content),
        }
      : null;
    const hasChanges = !originalSnapshot
      ? true
      : Object.keys(currentSnapshot).some(
          (key) =>
            currentSnapshot[key as keyof typeof currentSnapshot] !==
            originalSnapshot[key as keyof typeof originalSnapshot]
        );
    if (!hasChanges) {
      return;
    }
    setBusy(true);
    setError(null);
    setPolicyUpdateNotice(null);
    try {
      const payload = {
        title: normalizeText(policyDetailsForm.title),
        owner_role: normalizeText(policyDetailsForm.owner_role),
        status: normalizeText(policyDetailsForm.status),
        iso42001_requirement: normalizeText(policyDetailsForm.iso42001_requirement),
        iso42001_status: normalizeText(policyDetailsForm.iso42001_status),
        euaiact_requirements: normalizeText(policyDetailsForm.euaiact_requirements),
        nistairmf_requirements: normalizeText(
          policyDetailsForm.nistairmf_requirements
        ),
        comment: normalizeText(policyDetailsForm.comment),
        action: normalizeText(policyDetailsForm.action),
        template: normalizeText(policyDetailsForm.template),
      };
      const res = await fetch(`${CORE}/admin/policies/${policySelectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      const latestVersion = policyVersions[0];
      if (latestVersion?.id) {
        const contentPayload = {
          status: "review",
          content: normalizeText(latestPolicyContent),
        };
        const resVersion = await fetch(
          `${CORE}/admin/policy-versions/${latestVersion.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(contentPayload),
          }
        );
        if (!resVersion.ok) {
          const text = await resVersion.text().catch(() => "");
          throw new Error(text || `Version update failed (${resVersion.status})`);
        }
      }
      await loadPolicyVersions(policySelectedId);
      await loadPolicies();
      setPolicyUpdateNotice("Policy updated, needs approval");
      setPolicyReviewNotice(null);
      setPolicyApproveNotice(null);
      setPolicyRetireNotice(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const policyTitleFor = (policyId?: string | null) => {
    if (!policyId) return "Policy content";
    const policy = policies.find((item) => item.id === policyId);
    return policy?.title ?? "Policy content";
  };

  // ----------------- TrustMarks -----------------
  const loadTrustmarks = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(buildTrustmarkUrl(`${CERT}/trustmark/list`), {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Trustmarks load failed (${res.status})`);
      }
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setTrustmarks(items);
      setTrustmarksTotal(
        Number.isFinite(data?.total) ? Number(data.total) : items.length
      );
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const issueTrustmark = async () => {
    if (!issueProjectSlug.trim()) {
      setError("Select a project to issue a TrustMark.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${CERT}/trustmark/issue/${encodeURIComponent(issueProjectSlug)}?expires_days=${encodeURIComponent(
          String(issueExpiresDays)
        )}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Issue failed (${res.status})`);
      }
      await res.json().catch(() => null);
      await loadTrustmarks();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const trustmarkTotalPages = Math.max(
    1,
    Math.ceil(trustmarksTotal / trustmarkLimit)
  );

  // ----------------- Trust Monitoring -----------------
  const loadTrustMonitoring = async () => {
    setBusy(true);
    setError(null);
    try {
      const alertsParams = new URLSearchParams();
      if (monitorProjectFilter) {
        alertsParams.set("project_slug", monitorProjectFilter);
      }
      alertsParams.set("status", "open");
      alertsParams.set("include_global", "true");

      const [signalsRes, decaysRes, alertsRes] = await Promise.all([
        fetch(buildMonitorUrl(`${REG}/trust/signals`), { cache: "no-store" }),
        fetch(buildMonitorUrl(`${REG}/trust/decays`), { cache: "no-store" }),
        fetch(`${CORE}/admin/policy-alerts?${alertsParams.toString()}`, {
          cache: "no-store",
        }),
      ]);

      if (!signalsRes.ok) {
        throw new Error(`Signals load failed (${signalsRes.status})`);
      }
      if (!decaysRes.ok) {
        throw new Error(`Decays load failed (${decaysRes.status})`);
      }
      if (!alertsRes.ok) {
        throw new Error(`Policy alerts load failed (${alertsRes.status})`);
      }

      const signalsData = await signalsRes.json();
      const decaysData = await decaysRes.json();
      const alertsData = await alertsRes.json();
      setMonitorSignals(Array.isArray(signalsData) ? signalsData : []);
      setMonitorDecays(Array.isArray(decaysData) ? decaysData : []);
      setPolicyAlerts(
        Array.isArray(alertsData?.items) ? alertsData.items : alertsData ?? []
      );
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const generatePolicyAlertsNow = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/policy-alerts:compute`, {
        method: "POST",
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Policy alert compute failed (${res.status})`);
      }
      await loadTrustMonitoring();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const resolveSignal = async (id: string) => {
    if (!confirm("Resolve this signal and recompute decay?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${REG}/trust/signals/${encodeURIComponent(id)}/resolve`,
        { method: "POST" }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Resolve failed (${res.status})`);
      }
      await loadTrustMonitoring();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!resolvedTabs.some((item) => item.id === tab)) {
      setTab(resolvedInitial);
    }
  }, [resolvedInitial, resolvedTabs, tab]);

  // auto-load when opening / switching tabs
  useEffect(() => {
    if (!open) return;
    if (tab === "kpis") void loadKpis();
    if (tab === "controls") void loadControls();
    if (tab === "evidences") void loadEvidences();
    if (tab === "trust-axes") void loadAxisMapping();
    if (tab === "trust-monitoring") void loadTrustMonitoring();
    if (tab === "trustmarks") void loadTrustmarks();
    if (tab === "provenance") void loadProvenance();
    if (tab === "registry") void loadAiSystems();
    if (tab === "requirements" && !aiSystems.length) void loadAiSystems();
    if (tab === "requirements") void loadRequirements();
    if (tab === "aims-scope") void loadAimsScope();
    if (tab === "policies") void loadPolicies();
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    tab,
    provProjectFilter,
    provSearch,
    provPageSize,
    artifactPage,
    datasetPage,
    modelPage,
    evidencePage,
    lineagePage,
    monitorProjectFilter,
    monitorStatusFilter,
    effectiveEntityId,
    monitorLimit,
    trustmarkProjectFilter,
    trustmarkStatusFilter,
    trustmarkQuery,
    trustmarkLimit,
    trustmarkOffset,
    projects.length,
    aiSystems.length,
    aiSystemQuery,
    aiSystemProject,
    aiSystemRisk,
    aiSystemStatus,
    requirementQuery,
    requirementProject,
    requirementUcId,
    requirementFramework,
    requirementStatus,
    policyQuery,
    policyStatus,
  ]);

  useEffect(() => {
    if (!open || tab !== "requirements") return;
    if (!selectedRequirementProject) {
      setRequiredKpis([]);
      setRequiredKpiSummary([]);
      setRequiredKpiError(null);
      setRequiredKpiDiff(null);
      setRequiredKpiSaveNotice(null);
      setRequiredKpiDiffOpen(false);
      setRequiredKpiSaveComplete(false);
      setRequiredKpiApplyComplete(false);
      return;
    }
    void loadRequirementKpis(selectedRequirementProject);
  }, [open, tab, selectedRequirementProject, requirements.length]);

  useEffect(() => {
    setRequiredKpiSaved(requiredKpis.length > 0);
  }, [requiredKpis.length]);

  const backToPrevious = () => {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    const parts = window.location.pathname.split("/").filter(Boolean);
    const slug = parts.length >= 2 && parts[1] === "scorecard" ? parts[0] : "";
    const fallback = slug
      ? `/${encodeURIComponent(slug)}/scorecard/admin/governance-setup/ai-system-register`
      : "/scorecard/admin/governance-setup/ai-system-register";
    window.location.href = fallback;
  };

  if (!open) return null;

  const content = (
    <div
      className={
        embedded
          ? "w-full"
          : "w-[min(1100px,95vw)] max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
      }
    >
      {showHeader && (
        <div className="flex items-center justify-between border-b border-slate-200 bg-gray-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/80">
          <div className="text-base font-semibold text-slate-900 dark:text-slate-50">
            {title}
          </div>
          {onClose && (
            <button
              className="text-sm rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      )}

      {showTabs && resolvedTabs.length > 1 && (
        <div className="px-5 pt-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-gray-50 p-1 dark:border-slate-700 dark:bg-slate-900/60">
            {resolvedTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`min-w-[120px] rounded-lg px-4 py-2 text-sm ${
                  tab === t.id
                    ? "border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50"
                    : "text-gray-600 dark:text-slate-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={embedded ? "p-5" : "max-h-[65vh] overflow-auto p-5"}>
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-900/40 dark:text-red-100">
              {error}
            </div>
          )}


              {aiSystemModalOpen && aiSystemModalDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                  <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          AI System Registry
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                          {aiSystemModalMode === "create"
                            ? "New AI system"
                            : aiSystemModalDraft.uc_id || "AI system detail"}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Edit governance, use-case, lifecycle, and data attributes. All changes are
                          audit logged.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={resetAiSystemModalState}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Close
                      </button>
                    </div>

                    <div className="max-h-[72vh] overflow-y-auto px-6 py-5">
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="space-y-4">
                          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Identity & Ownership
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                              <label className="text-xs text-slate-500">
                                Name <span className="text-[11px] text-rose-600">*</span>
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.name ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({ name: e.target.value })
                                  }
                                  placeholder="System name"
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                Project
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.project_slug ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({
                                      project_slug: e.target.value || null,
                                    })
                                  }
                                >
                                  <option value="">General</option>
                                  {projects.map((p) => (
                                    <option key={p.slug} value={p.slug}>
                                      {p.name ?? p.slug}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs text-slate-500">
                                Owner <span className="text-[11px] text-rose-600">*</span>
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.owner ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({ owner: e.target.value })
                                  }
                                  placeholder="Primary owner"
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                Designated Owner Email
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.system_owner_email ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({
                                      system_owner_email: e.target.value,
                                    })
                                  }
                                  placeholder="owner@company.com"
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                Business Unit
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.business_unit ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({
                                      business_unit: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                Decision Authority
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.decision_authority ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({
                                      decision_authority: e.target.value,
                                    })
                                  }
                                  placeholder="Accountable exec"
                                />
                              </label>
                            </div>
                            <label className="mt-3 block text-xs text-slate-500">
                              Description
                              <textarea
                                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                rows={4}
                                placeholder="Long-form description of the AI system"
                                value={aiSystemModalDraft.description ?? ""}
                                onChange={(e) =>
                                  updateAiSystemDraft({ description: e.target.value })
                                }
                              />
                            </label>
                          </div>

                          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Use-case & Boundaries
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-3">
                              <label className="text-xs text-slate-500">
                                Intended Use
                                <textarea
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  rows={4}
                                  placeholder="Primary business purpose and use cases"
                                  value={aiSystemModalDraft.intended_use ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({ intended_use: e.target.value })
                                  }
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                Intended Users
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.intended_users ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({ intended_users: e.target.value })
                                  }
                                  placeholder="Internal staff, external users"
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                System Boundary{" "}
                                <span className="text-[11px] text-rose-600">*</span>
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.system_boundary ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({
                                      system_boundary: e.target.value || null,
                                    })
                                  }
                                >
                                  <option value="">Select boundary</option>
                                  <option value="cloud">Cloud</option>
                                  <option value="on_prem">On-prem</option>
                                  <option value="hybrid">Hybrid</option>
                                </select>
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Model & Lifecycle
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                              <label className="text-xs text-slate-500">
                                <span className="group relative inline-flex items-center gap-1">
                                  Model Provider
                                  <span className="text-[11px] text-rose-600">*</span>
                                  {getAiSystemTooltip("model_provider") && (
                                    <>
                                      <span
                                        tabIndex={0}
                                        aria-label="Model Provider"
                                        title={getAiSystemTooltip("model_provider")}
                                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                      >
                                        i
                                      </span>
                                      <span className="pointer-events-none absolute left-0 top-6 z-20 w-56 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-600 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                        {getAiSystemTooltip("model_provider")}
                                      </span>
                                    </>
                                  )}
                                </span>
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.model_provider ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({ model_provider: e.target.value || null })
                                  }
                                >
                                  <option value="">Select Model Provider</option>
                                  {(aiSystemHelperMap.model_provider ?? []).map((opt: string) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs text-slate-500">
                                <span className="group relative inline-flex items-center gap-1">
                                  Model Type
                                  <span className="text-[11px] text-rose-600">*</span>
                                  {getAiSystemTooltip("model_type") && (
                                    <>
                                      <span
                                        tabIndex={0}
                                        aria-label="Model Type"
                                        title={getAiSystemTooltip("model_type")}
                                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                      >
                                        i
                                      </span>
                                      <span className="pointer-events-none absolute left-0 top-6 z-20 w-56 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-600 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                        {getAiSystemTooltip("model_type")}
                                      </span>
                                    </>
                                  )}
                                </span>
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.model_type ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({ model_type: e.target.value })
                                  }
                                  placeholder="LLM, classifier, scorer"
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                <span className="group relative inline-flex items-center gap-1">
                                  Model Version
                                  {getAiSystemTooltip("model_version") && (
                                    <>
                                      <span
                                        tabIndex={0}
                                        aria-label="Model Version"
                                        title={getAiSystemTooltip("model_version")}
                                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                      >
                                        i
                                      </span>
                                      <span className="pointer-events-none absolute left-0 top-6 z-20 w-56 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-600 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                        {getAiSystemTooltip("model_version")}
                                      </span>
                                    </>
                                  )}
                                </span>
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.model_version ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({ model_version: e.target.value })
                                  }
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                <span className="group relative inline-flex items-center gap-1">
                                  Deployment Environment
                                  {getAiSystemTooltip("deployment_environment") && (
                                    <>
                                      <span
                                        tabIndex={0}
                                        aria-label="Deployment Environment"
                                        title={getAiSystemTooltip("deployment_environment")}
                                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                      >
                                        i
                                      </span>
                                      <span className="pointer-events-none absolute left-0 top-6 z-20 w-56 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-600 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                        {getAiSystemTooltip("deployment_environment")}
                                      </span>
                                    </>
                                  )}
                                </span>
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.deployment_environment ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({
                                      deployment_environment: e.target.value || null,
                                    })
                                  }
                                >
                                  <option value="">Select</option>
                                  <option value="prod">Prod</option>
                                  <option value="staging">Staging</option>
                                  <option value="sandbox">Sandbox</option>
                                </select>
                              </label>
                              <label className="text-xs text-slate-500">
                                <span className="group relative inline-flex items-center gap-1">
                                  Lifecycle Stage
                                  {getAiSystemTooltip("lifecycle_stage") && (
                                    <>
                                      <span
                                        tabIndex={0}
                                        aria-label="Lifecycle Stage"
                                        title={getAiSystemTooltip("lifecycle_stage")}
                                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                      >
                                        i
                                      </span>
                                      <span className="pointer-events-none absolute left-0 top-6 z-20 w-56 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-600 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                        {getAiSystemTooltip("lifecycle_stage")}
                                      </span>
                                    </>
                                  )}
                                </span>
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.lifecycle_stage ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({
                                      lifecycle_stage: e.target.value || null,
                                    })
                                  }
                                >
                                  <option value="">Select</option>
                                  <option value="design">Design</option>
                                  <option value="train">Train</option>
                                  <option value="validate">Validate</option>
                                  <option value="deploy">Deploy</option>
                                  <option value="retire">Retire</option>
                                </select>
                              </label>
                              {activeProviderKey && (
                                <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                  <p className="text-[11px] font-semibold uppercase text-slate-500">
                                    Provider Artifacts
                                  </p>
                                  {entityProviderArtifactsLoading ? (
                                    <p className="mt-2 text-xs text-slate-500">Loading…</p>
                                  ) : entityProviderArtifactsError ? (
                                    <p className="mt-2 text-xs text-rose-600">
                                      {entityProviderArtifactsError}
                                    </p>
                                  ) : providerArtifactsForSystem.length === 0 ? (
                                    <p className="mt-2 text-xs text-slate-500">
                                      No artifacts found for {activeProviderKey}.
                                    </p>
                                  ) : (
                                    <div className="mt-2 space-y-2">
                                      {providerArtifactsForSystem.map((artifact) => (
                                        <div
                                          key={artifact.id}
                                          className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600"
                                        >
                                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <span className="font-semibold text-slate-800">
                                              {artifact.name}
                                            </span>
                                            {artifact.type && (
                                              <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] uppercase text-slate-500">
                                                {artifact.type}
                                              </span>
                                            )}
                                            {artifact.status && (
                                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] uppercase text-emerald-600">
                                                {artifact.status}
                                              </span>
                                            )}
                                          </div>
                                          <div className="mt-1 break-words">
                                            <a
                                              href={artifact.uri}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-indigo-600 hover:underline"
                                            >
                                              {artifact.uri}
                                            </a>
                                          </div>
                                          {(artifact.valid_from || artifact.valid_to) && (
                                            <div className="mt-1 text-[11px] text-slate-500">
                                              Valid{" "}
                                              {artifact.valid_from
                                                ? `from ${artifact.valid_from}`
                                                : "from —"}{" "}
                                              {artifact.valid_to
                                                ? `to ${artifact.valid_to}`
                                                : "to —"}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="text-[11px] font-semibold uppercase text-slate-500">
                                  LLM Observability
                                </div>
                                <p className="text-[11px] text-slate-500">
                                  Use Langfuse project keys to auto-fill the Project ID. Keys are
                                  not stored.
                                </p>
                                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
                                  <label className="text-xs text-slate-500">
                                    Langfuse Public Key
                                    <input
                                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                      value={langfuseKeyPublic}
                                      onChange={(e) => setLangfuseKeyPublic(e.target.value)}
                                      autoComplete="off"
                                      name="langfuse-public-key"
                                      placeholder="pk-lf-..."
                                    />
                                  </label>
                                  <label className="text-xs text-slate-500">
                                    Langfuse Secret Key
                                    <input
                                      type="password"
                                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                      value={langfuseKeySecret}
                                      onChange={(e) => setLangfuseKeySecret(e.target.value)}
                                      autoComplete="new-password"
                                      name="langfuse-secret-key"
                                      placeholder="sk-lf-..."
                                    />
                                  </label>
                                  <div className="flex items-end">
                                    <button
                                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                      type="button"
                                      onClick={fetchLangfuseProjectId}
                                      disabled={langfuseKeyBusy}
                                    >
                                      {langfuseKeyBusy
                                        ? "Fetching..."
                                        : "Auto-fill Project ID"}
                                    </button>
                                  </div>
                                </div>
                                {langfuseKeyError && (
                                  <p className="mt-2 text-xs text-rose-600">
                                    {langfuseKeyError}
                                  </p>
                                )}
                                {langfuseKeyNotice && (
                                  <p className="mt-2 text-xs text-emerald-600">
                                    {langfuseKeyNotice}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Data & Privacy
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-3">
                              <label className="text-xs text-slate-500">
                                Training Data Sources
                                <textarea
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  rows={4}
                                  placeholder="Sources and types of data used for training"
                                  value={aiSystemModalDraft.training_data_sources ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({
                                      training_data_sources: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <label className="text-xs text-slate-500">
                                  Personal Data
                                  <select
                                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                    value={aiSystemBoolToSelect(
                                      aiSystemModalDraft.personal_data_flag
                                    )}
                                    onChange={(e) =>
                                      updateAiSystemDraft({
                                        personal_data_flag: aiSystemSelectToBool(
                                          e.target.value
                                        ),
                                      })
                                    }
                                  >
                                    <option value="">Unknown</option>
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                  </select>
                                </label>
                                <label className="text-xs text-slate-500">
                                  Sensitive Attributes
                                  <select
                                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                    value={aiSystemBoolToSelect(
                                      aiSystemModalDraft.sensitive_attributes_flag
                                    )}
                                    onChange={(e) =>
                                      updateAiSystemDraft({
                                        sensitive_attributes_flag:
                                          aiSystemSelectToBool(e.target.value),
                                      })
                                    }
                                  >
                                    <option value="">Unknown</option>
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                  </select>
                                </label>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Governance Status
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                              <label className="text-xs text-slate-500">
                                Risk Tier
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.risk_tier ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({
                                      risk_tier: e.target.value || null,
                                    })
                                  }
                                >
                                  <option value="">Select</option>
                                  <option value="High risk">High risk</option>
                                  <option value="Medium risk">Medium risk</option>
                                  <option value="Low risk">Low risk</option>
                                </select>
                              </label>
                              <label className="text-xs text-slate-500">
                                Status
                                <select
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.status ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({
                                      status: e.target.value || null,
                                    })
                                  }
                                >
                                  <option value="">Select</option>
                                  <option value="experimental">Experimental</option>
                                  <option value="planned">Planned</option>
                                  <option value="in_review">In review</option>
                                  <option value="active">Active</option>
                                  <option value="retired">Retired</option>
                                </select>
                              </label>
                              <label className="text-xs text-slate-500">
                                Region Scope
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.region_scope ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({
                                      region_scope: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                Data Sensitivity
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.data_sensitivity ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({
                                      data_sensitivity: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                Risk Owner Role
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  value={aiSystemModalDraft.risk_owner_role ?? ""}
                                  onChange={(e) =>
                                    updateAiSystemDraft({
                                      risk_owner_role: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              {[
                                ["technical_lead", "Technical Lead"],
                                ["target_users", "Target Users"],
                                ["intended_purpose", "Intended Purpose"],
                                ["out_of_scope_uses", "Out-of-Scope Uses"],
                                ["deployment_method", "Deployment Method"],
                                ["data_residency", "Data Residency"],
                                ["base_model_type", "Base Model Type"],
                                ["input_output_modality", "Input/Output Modality"],
                                ["fine_tuning_data", "Fine-tuning Data"],
                                ["data_minimization", "Data Minimization"],
                                ["human_oversight_mechanism", "Human Oversight"],
                                ["impact_assessment_reference", "Impact Assessment Reference"],
                                ["known_limitations", "Known Limitations"],
                              ].map(([key, label]) => {
                                const tooltip = getAiSystemTooltip(key);
                                return (
                                  <label key={key} className="text-xs text-slate-500">
                                    <span className="group relative inline-flex items-center gap-1">
                                      {label}
                                      {(tooltip || aiSystemHelper.length === 0) && (
                                        <>
                                          <span
                                            tabIndex={0}
                                            aria-label={label}
                                            title={tooltip}
                                            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                          >
                                            i
                                          </span>
                                          <span className="pointer-events-none absolute left-0 top-6 z-20 w-56 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-600 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                            {tooltip}
                                          </span>
                                        </>
                                      )}
                                    </span>
                                    <select
                                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                      value={(aiSystemModalDraft as Record<string, unknown>)[key] ?? ""}
                                      onChange={(e) =>
                                        updateAiSystemDraft({ [key]: e.target.value || null } as Partial<AiSystemRow>)
                                      }
                                    >
                                      <option value="">Select...</option>
                                      {(aiSystemHelperMap[key] ?? []).map((opt: string) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Metadata (Read-only)
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                              <label className="text-xs text-slate-500">
                                Use Case Reference
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                                  value={aiSystemModalDraft.uc_id ?? ""}
                                  readOnly
                                  disabled
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                System ID
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                                  value={aiSystemModalDraft.id ?? ""}
                                  readOnly
                                  disabled
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                Entity ID
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                                  value={aiSystemModalDraft.entity_id ?? ""}
                                  readOnly
                                  disabled
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                Entity Slug
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                                  value={aiSystemModalDraft.entity_slug ?? ""}
                                  readOnly
                                  disabled
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                Created At
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                                  value={aiSystemModalDraft.created_at ?? ""}
                                  readOnly
                                  disabled
                                />
                              </label>
                              <label className="text-xs text-slate-500">
                                Updated At
                                <input
                                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                                  value={aiSystemModalDraft.updated_at ?? ""}
                                  readOnly
                                  disabled
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {aiSystemModalError && (
                          <span className="text-rose-600">{aiSystemModalError}</span>
                        )}
                        {aiSystemModalNotice && (
                          <span className="text-emerald-600">{aiSystemModalNotice}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {aiSystemModalMode === "edit" && aiSystemModalDraft.id && (
                          <button
                            type="button"
                            onClick={retireAiSystemFromModal}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            disabled={aiSystemModalSaving}
                          >
                            {tDm("retireSystem")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={resetAiSystemModalState}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        {aiSystemModalMode === "create" && (
                          <button
                            type="button"
                            onClick={() => saveAiSystemModal({ keepOpen: true })}
                            disabled={aiSystemModalSaving}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {aiSystemModalSaving ? "Saving..." : "Save"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={saveAiSystemModal}
                          disabled={aiSystemModalSaving}
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                          {aiSystemModalSaving
                            ? "Saving..."
                            : aiSystemModalMode === "create"
                            ? "Create system"
                            : "Save changes"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}


          {tab === "kpis" && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={busy}
                  onClick={exportKpis}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Export KPIs (.xlsx)
                </button>
                <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  Import KPIs (.xlsx)
                  <input
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && importKpis(e.target.files[0])
                    }
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={loadKpis}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>

              {/* KPI table (hide `key` column, keep data) */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    <tr>
                      {/* removed: <th className="text-left p-2">key</th> */}
                      <th className="p-2 text-left">pillar</th>
                      <th className="p-2 text-left">name</th>
                      <th className="p-2 text-left">unit</th>
                      <th className="p-2 text-left">description</th>
                      <th className="p-2 text-left">example</th>
                      <th className="p-2 text-left">weight</th>
                      <th className="p-2 text-left">min_ideal</th>
                      <th className="p-2 text-left">max_ideal</th>
                      <th className="p-2 text-left">invert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiRows.map((r) => (
                      // keep key in React key (fallback to r.key if kpi_id missing),
                      // but don't render the column
                      <tr
                        key={r.kpi_id || r.key}
                        className="border-b border-slate-100 dark:border-slate-700/70"
                      >
                        {/* removed: <td className="p-2">{r.key}</td> */}
                        <td className="p-2">
                          {r.pillar_name ?? r.pillar_key ?? r.pillar ?? ""}
                        </td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2">{r.unit ?? ""}</td>
                        <td className="p-2">{r.description ?? ""}</td>
                        <td className="p-2">{r.example ?? ""}</td>
                        <td className="p-2">{r.weight ?? ""}</td>
                        <td className="p-2">{r.min_ideal ?? ""}</td>
                        <td className="p-2">{r.max_ideal ?? ""}</td>
                        <td className="p-2">
                          {r.invert === true
                            ? "true"
                            : r.invert === false
                            ? "false"
                            : ""}
                        </td>
                      </tr>
                    ))}
                    {kpiRows.length === 0 && (
                      <tr>
                        <td
                          className="p-3 text-sm text-gray-500 dark:text-slate-400"
                          colSpan={9}
                        >
                          No KPIs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "controls" && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={busy}
                  onClick={exportControls}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Export Controls (.xlsx)
                </button>
                <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  Import Controls (.xlsx)
                  <input
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && importControls(e.target.files[0])
                    }
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={loadControls}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    <tr>
                      {/* id / kpi_key intentionally hidden in UI */}
                      <th className="p-2 text-left">pillar</th>
                      <th className="p-2 text-left">name</th>
                      <th className="p-2 text-left">axis_key</th>
                      <th className="p-2 text-left">unit</th>
                      <th className="p-2 text-left">higher_is_better</th>
                      <th className="p-2 text-left">norm_min</th>
                      <th className="p-2 text-left">norm_max</th>
                      <th className="p-2 text-left">weight</th>
                      <th className="p-2 text-left">target_text</th>
                      <th className="p-2 text-left">target_numeric</th>
                      <th className="p-2 text-left">evidence_source</th>
                      <th className="p-2 text-left">owner_role</th>
                      <th className="p-2 text-left">frequency</th>
                      <th className="p-2 text-left">failure_action</th>
                      <th className="p-2 text-left">maturity_anchor_l3</th>
                      <th className="p-2 text-left">current_value</th>
                      <th className="p-2 text-left">as_of</th>
                      <th className="p-2 text-left">kpi_score</th>
                      <th className="p-2 text-left">description</th>
                      <th className="p-2 text-left">example</th>
                      <th className="p-2 text-left">notes</th>
                      <th className="p-2 text-left">actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {controls.map((c) => (
                      <tr
                        key={c.id ?? c.control_id}
                        className="border-b border-slate-100 dark:border-slate-700/70"
                      >
                        <td className="p-2">{c.pillar ?? ""}</td>
                        <td className="p-2">{c.name ?? ""}</td>
                        <td className="p-2">
                          <select
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            value={c.axis_key ?? ""}
                            onChange={(e) => {
                              const next = e.target.value || null;
                              setControls((prev) =>
                                prev.map((row) =>
                                  row.control_id === c.control_id
                                    ? { ...row, axis_key: next }
                                    : row
                                )
                              );
                            }}
                          >
                            {AXIS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">{c.unit ?? ""}</td>
                        <td className="p-2">
                          {c.higher_is_better === true
                            ? "true"
                            : c.higher_is_better === false
                            ? "false"
                            : ""}
                        </td>
                        <td className="p-2">{c.norm_min ?? ""}</td>
                        <td className="p-2">{c.norm_max ?? ""}</td>
                        <td className="p-2">{c.weight ?? ""}</td>
                        <td className="p-2">{c.target_text ?? ""}</td>
                        <td className="p-2">{c.target_numeric ?? ""}</td>
                        <td className="p-2">{c.evidence_source ?? ""}</td>
                        <td className="p-2">{c.owner_role ?? ""}</td>
                        <td className="p-2">{c.frequency ?? ""}</td>
                        <td className="p-2">{c.failure_action ?? ""}</td>
                        <td className="p-2">{c.maturity_anchor_l3 ?? ""}</td>
                        <td className="p-2">{c.current_value ?? ""}</td>
                        <td className="p-2">{c.as_of ?? ""}</td>
                        <td className="p-2">{c.kpi_score ?? ""}</td>
                        <td className="p-2">{c.description ?? ""}</td>
                        <td className="p-2">{c.example ?? ""}</td>
                        <td className="p-2">{c.notes ?? ""}</td>
                        <td className="p-2">
                          <button
                            disabled={busy}
                            onClick={() => saveControl(c)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                    {controls.length === 0 && (
                      <tr>
                        <td
                          className="p-2 text-sm text-gray-500 dark:text-slate-400"
                          colSpan={22}
                        >
                          No controls yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "trust-axes" && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={busy}
                  onClick={loadAxisMapping}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    <tr>
                      <th className="p-2 text-left">pillar_key</th>
                      <th className="p-2 text-left">pillar_name</th>
                      <th className="p-2 text-left">axis_key</th>
                      <th className="p-2 text-left">notes</th>
                      <th className="p-2 text-left">actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {axisMappings.map((row) => (
                      <tr
                        key={row.pillar_key}
                        className="border-b border-slate-100 dark:border-slate-700/70"
                      >
                        <td className="p-2">{row.pillar_key}</td>
                        <td className="p-2">{row.pillar_name ?? ""}</td>
                        <td className="p-2">
                          <select
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            value={row.axis_key ?? ""}
                            onChange={(e) => {
                              const next = e.target.value || null;
                              setAxisMappings((prev) =>
                                prev.map((m) =>
                                  m.pillar_key === row.pillar_key
                                    ? { ...m, axis_key: next }
                                    : m
                                )
                              );
                            }}
                          >
                            {AXIS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            className="w-full min-w-[220px] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            value={row.notes ?? ""}
                            onChange={(e) => {
                              const next = e.target.value;
                              setAxisMappings((prev) =>
                                prev.map((m) =>
                                  m.pillar_key === row.pillar_key
                                    ? { ...m, notes: next }
                                    : m
                                )
                              );
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <button
                            disabled={busy}
                            onClick={() => saveAxisMapping(row)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                    {axisMappings.length === 0 && (
                      <tr>
                        <td
                          className="p-2 text-sm text-gray-500 dark:text-slate-400"
                          colSpan={5}
                        >
                          No pillars found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "trust-monitoring" && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={monitorProjectFilter}
                  onChange={(e) => setMonitorProjectFilter(e.target.value)}
                >
                  <option value="">All projects</option>
                  {projects.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name ? `${p.name} (${p.slug})` : p.slug}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={monitorStatusFilter}
                  onChange={(e) => setMonitorStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="pending">pending</option>
                  <option value="processed">processed</option>
                  <option value="resolved">resolved</option>
                </select>
                <input
                  className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  type="number"
                  min={5}
                  max={500}
                  value={monitorLimit}
                  onChange={(e) => {
                    const next = Number(e.target.value) || 50;
                    setMonitorLimit(next);
                  }}
                />
                <button
                  disabled={busy}
                  onClick={loadTrustMonitoring}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
                <button
                  disabled={busy}
                  onClick={generatePolicyAlertsNow}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/70 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
                >
                  Generate alerts now
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Policy Alerts
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                      <tr>
                        <th className="p-2 text-left">created</th>
                        <th className="p-2 text-left">policy</th>
                        <th className="p-2 text-left">severity</th>
                        <th className="p-2 text-left">project</th>
                        <th className="p-2 text-left">alert</th>
                        <th className="p-2 text-left">message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {policyAlerts.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 dark:border-slate-700/70"
                        >
                          <td className="p-2">{formatDate(row.created_at)}</td>
                          <td className="p-2">{row.policy_title}</td>
                          <td className="p-2">
                            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-700">
                              {row.severity}
                            </span>
                          </td>
                          <td className="p-2">
                            {row.project_slug ?? "global"}
                          </td>
                          <td className="p-2">{row.alert_type}</td>
                          <td className="p-2 text-xs text-slate-600 dark:text-slate-300">
                            {row.message}
                          </td>
                        </tr>
                      ))}
                      {policyAlerts.length === 0 && (
                        <tr>
                          <td
                            className="p-2 text-sm text-gray-500 dark:text-slate-400"
                            colSpan={6}
                          >
                            No policy alerts.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Signals
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                      <tr>
                        <th className="p-2 text-left">created</th>
                        <th className="p-2 text-left">project</th>
                        <th className="p-2 text-left">signal</th>
                        <th className="p-2 text-left">axis</th>
                        <th className="p-2 text-left">status</th>
                        <th className="p-2 text-left">source</th>
                        <th className="p-2 text-left">details</th>
                        <th className="p-2 text-left">actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitorSignals.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 dark:border-slate-700/70"
                        >
                          <td className="p-2">{formatDate(row.created_at)}</td>
                          <td className="p-2">{row.project_slug}</td>
                          <td className="p-2">{row.signal_type}</td>
                          <td className="p-2">{row.axis_key ?? ""}</td>
                          <td className="p-2">{row.status}</td>
                          <td className="p-2">{row.source ?? ""}</td>
                          <td className="p-2 text-xs text-slate-600 dark:text-slate-300">
                            {formatJson(row.details_json)}
                          </td>
                          <td className="p-2">
                            <button
                              disabled={busy || row.status === "resolved"}
                              onClick={() => resolveSignal(row.id)}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                            >
                              Resolve
                            </button>
                          </td>
                        </tr>
                      ))}
                      {monitorSignals.length === 0 && (
                        <tr>
                          <td
                            className="p-2 text-sm text-gray-500 dark:text-slate-400"
                            colSpan={8}
                          >
                            No signals yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Decay Events
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                      <tr>
                        <th className="p-2 text-left">applied</th>
                        <th className="p-2 text-left">project</th>
                        <th className="p-2 text-left">axis</th>
                        <th className="p-2 text-left">rule</th>
                        <th className="p-2 text-left">prev</th>
                        <th className="p-2 text-left">new</th>
                        <th className="p-2 text-left">delta</th>
                        <th className="p-2 text-left">signal_id</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitorDecays.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 dark:border-slate-700/70"
                        >
                          <td className="p-2">{formatDate(row.applied_at)}</td>
                          <td className="p-2">{row.project_slug}</td>
                          <td className="p-2">{row.axis_key}</td>
                          <td className="p-2">{row.rule_key}</td>
                          <td className="p-2">{row.previous_score ?? ""}</td>
                          <td className="p-2">{row.new_score ?? ""}</td>
                          <td className="p-2">{row.decay_delta ?? ""}</td>
                          <td className="p-2 text-xs">{row.signal_id}</td>
                        </tr>
                      ))}
                      {monitorDecays.length === 0 && (
                        <tr>
                          <td
                            className="p-2 text-sm text-gray-500 dark:text-slate-400"
                            colSpan={8}
                          >
                            No decay events yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {tab === "trustmarks" && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={trustmarkProjectFilter}
                  onChange={(e) => {
                    setTrustmarkProjectFilter(e.target.value);
                    setTrustmarkOffset(0);
                  }}
                >
                  <option value="">All projects</option>
                  {projects.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name ? `${p.name} (${p.slug})` : p.slug}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={trustmarkStatusFilter}
                  onChange={(e) => {
                    setTrustmarkStatusFilter(e.target.value);
                    setTrustmarkOffset(0);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="active">active</option>
                  <option value="revoked">revoked</option>
                </select>
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Search id or project"
                  value={trustmarkQuery}
                  onChange={(e) => {
                    setTrustmarkQuery(e.target.value);
                    setTrustmarkOffset(0);
                  }}
                />
                <input
                  className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  type="number"
                  min={5}
                  max={200}
                  value={trustmarkLimit}
                  onChange={(e) => {
                    const next = Number(e.target.value) || 20;
                    setTrustmarkLimit(next);
                    setTrustmarkOffset(0);
                  }}
                />
                <button
                  disabled={busy}
                  onClick={loadTrustmarks}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <select
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={issueProjectSlug}
                  onChange={(e) => setIssueProjectSlug(e.target.value)}
                >
                  <option value="">Select project to issue TrustMark</option>
                  {projects.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name ? `${p.name} (${p.slug})` : p.slug}
                    </option>
                  ))}
                </select>
                <input
                  className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  type="number"
                  min={1}
                  max={365}
                  value={issueExpiresDays}
                  onChange={(e) => setIssueExpiresDays(Number(e.target.value) || 30)}
                />
                <button
                  disabled={busy}
                  onClick={issueTrustmark}
                  className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500/60 dark:bg-emerald-900/20 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                >
                  Issue TrustMark
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    <tr>
                      <th className="p-2 text-left">issued</th>
                      <th className="p-2 text-left">project</th>
                      <th className="p-2 text-left">tol</th>
                      <th className="p-2 text-left">axis</th>
                      <th className="p-2 text-left">status</th>
                      <th className="p-2 text-left">expires</th>
                      <th className="p-2 text-left">id</th>
                      <th className="p-2 text-left">public</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trustmarks.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 dark:border-slate-700/70"
                      >
                        <td className="p-2">{formatDate(row.issued_at)}</td>
                        <td className="p-2">{row.project_slug}</td>
                        <td className="p-2">{row.tol_level}</td>
                        <td className="p-2 text-xs text-slate-600 dark:text-slate-300">
                          {row.axis_levels
                            ? `${row.axis_levels.safety ?? ""} ${
                                row.axis_levels.compliance ?? ""
                              } ${row.axis_levels.provenance ?? ""}`.trim()
                            : ""}
                        </td>
                        <td className="p-2">{row.status}</td>
                        <td className="p-2">{formatDate(row.expires_at)}</td>
                        <td className="p-2 text-xs">{row.id}</td>
                        <td className="p-2">
                          <button
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-800 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                            onClick={() => openUrl(`/trustmark/${row.id}`)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {trustmarks.length === 0 && (
                      <tr>
                        <td
                          className="p-2 text-sm text-gray-500 dark:text-slate-400"
                          colSpan={8}
                        >
                          No TrustMarks yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <button
                  className="rounded-lg border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-slate-600"
                  onClick={() =>
                    setTrustmarkOffset((prev) => Math.max(0, prev - trustmarkLimit))
                  }
                  disabled={trustmarkOffset === 0}
                >
                  Prev
                </button>
                <span>
                  Page {Math.floor(trustmarkOffset / trustmarkLimit) + 1} of{" "}
                  {trustmarkTotalPages} • {trustmarksTotal} total
                </span>
                <button
                  className="rounded-lg border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-slate-600"
                  onClick={() =>
                    setTrustmarkOffset((prev) =>
                      prev + trustmarkLimit < trustmarksTotal
                        ? prev + trustmarkLimit
                        : prev
                    )
                  }
                  disabled={trustmarkOffset + trustmarkLimit >= trustmarksTotal}
                >
                  Next
                </button>
              </div>
            </section>
          )}

          {tab === "provenance" && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={provProjectFilter}
                  onChange={(e) => {
                    setProvProjectFilter(e.target.value);
                    setArtifactPage(1);
                    setDatasetPage(1);
                    setModelPage(1);
                    setEvidencePage(1);
                    setLineagePage(1);
                  }}
                >
                  <option value="">All projects</option>
                  {projects.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name ? `${p.name} (${p.slug})` : p.slug}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Search"
                  value={provSearch}
                  onChange={(e) => {
                    setProvSearch(e.target.value);
                    setArtifactPage(1);
                    setDatasetPage(1);
                    setModelPage(1);
                    setEvidencePage(1);
                    setLineagePage(1);
                  }}
                />
                <input
                  className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  type="number"
                  min={5}
                  max={200}
                  value={provPageSize}
                  onChange={(e) => {
                    const next = Number(e.target.value) || 20;
                    setProvPageSize(next);
                    setArtifactPage(1);
                    setDatasetPage(1);
                    setModelPage(1);
                    setEvidencePage(1);
                    setLineagePage(1);
                  }}
                />
                <button
                  disabled={busy}
                  onClick={loadProvenance}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>

              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Provenance Evaluation
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Paste manifest facts JSON (do not wrap with manifest_facts).
                </div>
                <textarea
                  className="min-h-[140px] w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  placeholder='{"source":{"system_name":"CRM"}}'
                  value={provEvalInput}
                  onChange={(e) => setProvEvalInput(e.target.value)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={provEvalDebug}
                      onChange={(e) => setProvEvalDebug(e.target.checked)}
                    />
                    Include debug
                  </label>
                  <button
                    disabled={busy}
                    onClick={evaluateProvenance}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Evaluate
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setProvEvalInput("");
                      setProvEvalResult(null);
                      setProvEvalError(null);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Clear
                  </button>
                </div>
                {provEvalError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700/60 dark:bg-red-900/30 dark:text-red-200">
                    {provEvalError}
                  </div>
                )}
                {provEvalResult && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
                          Overall
                        </div>
                        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {provEvalResult.overall.level}
                        </div>
                        <div className="text-xs">
                          Score {provEvalResult.overall.score}{" "}
                          {provEvalResult.overall.forced ? "(forced)" : "(rollup)"}
                        </div>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
                          Gates
                        </div>
                        {provEvalResult.gates.length === 0 ? (
                          <div className="text-xs">None</div>
                        ) : (
                          <ul className="space-y-1 text-xs">
                            {provEvalResult.gates.map((gate) => (
                              <li key={gate.gate_id}>
                                {gate.gate_id} {"->"} {gate.forced_level}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
                          Fields
                        </div>
                        <div className="text-xs">
                          {provEvalResult.fields.length} fields evaluated
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                          <tr>
                            <th className="p-2 text-left">field</th>
                            <th className="p-2 text-left">level</th>
                            <th className="p-2 text-left">score</th>
                            <th className="p-2 text-left">matched_rule</th>
                            <th className="p-2 text-left">reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {provEvalResult.fields.map((field) => (
                            <tr
                              key={field.field}
                              className="border-b border-slate-100 dark:border-slate-700/70"
                            >
                              <td className="p-2">{field.field}</td>
                              <td className="p-2">{field.level}</td>
                              <td className="p-2">{field.score}</td>
                              <td className="p-2 text-xs">
                                {field.matched_rule ?? ""}
                              </td>
                              <td className="p-2 text-xs">
                                {(field.reasons || [])
                                  .map((r) =>
                                    [r.code, r.message].filter(Boolean).join(": ")
                                  )
                                  .join("; ")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {provEvalDebug && provEvalResult.debug && (
                      <details className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <summary className="cursor-pointer text-xs font-semibold">
                          Debug Trace
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap">
                          {JSON.stringify(provEvalResult.debug, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Artifacts
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    value={artifactForm.project_slug}
                    onChange={(e) =>
                      setArtifactForm((prev) => ({
                        ...prev,
                        project_slug: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select project</option>
                    {projects.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name ? `${p.name} (${p.slug})` : p.slug}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="name"
                    value={artifactForm.name}
                    onChange={(e) =>
                      setArtifactForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="s3://bucket/key"
                    value={artifactForm.uri}
                    onChange={(e) =>
                      setArtifactForm((prev) => ({
                        ...prev,
                        uri: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="size_bytes"
                    value={artifactForm.size_bytes}
                    onChange={(e) =>
                      setArtifactForm((prev) => ({
                        ...prev,
                        size_bytes: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="mime"
                    value={artifactForm.mime}
                    onChange={(e) =>
                      setArtifactForm((prev) => ({
                        ...prev,
                        mime: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="license_name"
                    value={artifactForm.license_name}
                    onChange={(e) =>
                      setArtifactForm((prev) => ({
                        ...prev,
                        license_name: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="license_url"
                    value={artifactForm.license_url}
                    onChange={(e) =>
                      setArtifactForm((prev) => ({
                        ...prev,
                        license_url: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="usage_rights"
                    value={artifactForm.usage_rights}
                    onChange={(e) =>
                      setArtifactForm((prev) => ({
                        ...prev,
                        usage_rights: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <button
                    disabled={busy}
                    onClick={createArtifact}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Create Artifact
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <button
                    disabled={busy || artifactPage <= 1}
                    onClick={() => setArtifactPage((p) => Math.max(1, p - 1))}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                  >
                    Prev
                  </button>
                  <span>
                    Page {artifactPage} of {artifactTotalPages} • {provArtifactsTotal} total
                  </span>
                  <button
                    disabled={busy || artifactPage >= artifactTotalPages}
                    onClick={() =>
                      setArtifactPage((p) =>
                        Math.min(artifactTotalPages, p + 1)
                      )
                    }
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                  >
                    Next
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                      <tr>
                        <th className="p-2 text-left">id</th>
                        <th className="p-2 text-left">project</th>
                        <th className="p-2 text-left">name</th>
                        <th className="p-2 text-left">sha256</th>
                        <th className="p-2 text-left">license</th>
                        <th className="p-2 text-left">uri</th>
                        <th className="p-2 text-left">created</th>
                        <th className="p-2 text-left">actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provArtifacts.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 dark:border-slate-700/70"
                        >
                          <td className="p-2">{row.id}</td>
                          <td className="p-2">{row.project_slug}</td>
                          <td className="p-2">{row.name}</td>
                          <td className="p-2 text-xs">{row.sha256}</td>
                          <td className="p-2">{row.license_name ?? ""}</td>
                          <td className="p-2 text-xs">{row.uri}</td>
                          <td className="p-2">{formatDate(row.created_at)}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <button
                                disabled={busy}
                                onClick={() => validateArtifact(row.id)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Validate
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => {
                                  setAuditForm({
                                    entity_type: "artifact",
                                    entity_id: row.id,
                                  });
                                  void loadAudit();
                                }}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                Audit
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {provArtifacts.length === 0 && (
                        <tr>
                          <td
                            className="p-2 text-sm text-gray-500 dark:text-slate-400"
                            colSpan={8}
                          >
                            No artifacts found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Datasets
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    value={datasetForm.project_slug}
                    onChange={(e) =>
                      setDatasetForm((prev) => ({
                        ...prev,
                        project_slug: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select project</option>
                    {projects.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name ? `${p.name} (${p.slug})` : p.slug}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="name"
                    value={datasetForm.name}
                    onChange={(e) =>
                      setDatasetForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="description"
                    value={datasetForm.description}
                    onChange={(e) =>
                      setDatasetForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="artifact_id"
                    value={datasetForm.artifact_id}
                    onChange={(e) =>
                      setDatasetForm((prev) => ({
                        ...prev,
                        artifact_id: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <button
                    disabled={busy}
                    onClick={createDataset}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Create Dataset
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <button
                    disabled={busy || datasetPage <= 1}
                    onClick={() => setDatasetPage((p) => Math.max(1, p - 1))}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                  >
                    Prev
                  </button>
                  <span>
                    Page {datasetPage} of {datasetTotalPages} • {provDatasetsTotal} total
                  </span>
                  <button
                    disabled={busy || datasetPage >= datasetTotalPages}
                    onClick={() =>
                      setDatasetPage((p) =>
                        Math.min(datasetTotalPages, p + 1)
                      )
                    }
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                  >
                    Next
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                      <tr>
                        <th className="p-2 text-left">id</th>
                        <th className="p-2 text-left">project</th>
                        <th className="p-2 text-left">name</th>
                        <th className="p-2 text-left">description</th>
                        <th className="p-2 text-left">artifact_id</th>
                        <th className="p-2 text-left">created</th>
                        <th className="p-2 text-left">actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provDatasets.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 dark:border-slate-700/70"
                        >
                          <td className="p-2">{row.id}</td>
                          <td className="p-2">{row.project_slug}</td>
                          <td className="p-2">
                            <input
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                              value={row.name}
                              onChange={(e) => {
                                const next = e.target.value;
                                setProvDatasets((prev) =>
                                  prev.map((d) =>
                                    d.id === row.id ? { ...d, name: next } : d
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                              value={row.description ?? ""}
                              onChange={(e) => {
                                const next = e.target.value;
                                setProvDatasets((prev) =>
                                  prev.map((d) =>
                                    d.id === row.id
                                      ? { ...d, description: next }
                                      : d
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                              value={row.artifact_id ?? ""}
                              onChange={(e) => {
                                const next = e.target.value;
                                setProvDatasets((prev) =>
                                  prev.map((d) =>
                                    d.id === row.id
                                      ? { ...d, artifact_id: next }
                                      : d
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2">{formatDate(row.created_at)}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <button
                                disabled={busy}
                                onClick={() => updateDataset(row)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                              >
                                Save
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => deleteDataset(row.id)}
                                className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50 dark:border-red-500/60 dark:text-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {provDatasets.length === 0 && (
                        <tr>
                          <td
                            className="p-2 text-sm text-gray-500 dark:text-slate-400"
                            colSpan={7}
                          >
                            No datasets found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Models
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    value={modelForm.project_slug}
                    onChange={(e) =>
                      setModelForm((prev) => ({
                        ...prev,
                        project_slug: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select project</option>
                    {projects.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name ? `${p.name} (${p.slug})` : p.slug}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="name"
                    value={modelForm.name}
                    onChange={(e) =>
                      setModelForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="version"
                    value={modelForm.version}
                    onChange={(e) =>
                      setModelForm((prev) => ({
                        ...prev,
                        version: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="framework"
                    value={modelForm.framework}
                    onChange={(e) =>
                      setModelForm((prev) => ({
                        ...prev,
                        framework: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="artifact_id"
                    value={modelForm.artifact_id}
                    onChange={(e) =>
                      setModelForm((prev) => ({
                        ...prev,
                        artifact_id: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="md:col-span-5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="description"
                    value={modelForm.description}
                    onChange={(e) =>
                      setModelForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <button
                    disabled={busy}
                    onClick={createModel}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Create Model
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <button
                    disabled={busy || modelPage <= 1}
                    onClick={() => setModelPage((p) => Math.max(1, p - 1))}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                  >
                    Prev
                  </button>
                  <span>
                    Page {modelPage} of {modelTotalPages} • {provModelsTotal} total
                  </span>
                  <button
                    disabled={busy || modelPage >= modelTotalPages}
                    onClick={() =>
                      setModelPage((p) =>
                        Math.min(modelTotalPages, p + 1)
                      )
                    }
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                  >
                    Next
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                      <tr>
                        <th className="p-2 text-left">id</th>
                        <th className="p-2 text-left">project</th>
                        <th className="p-2 text-left">name</th>
                        <th className="p-2 text-left">version</th>
                        <th className="p-2 text-left">framework</th>
                        <th className="p-2 text-left">artifact_id</th>
                        <th className="p-2 text-left">description</th>
                        <th className="p-2 text-left">created</th>
                        <th className="p-2 text-left">actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provModels.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 dark:border-slate-700/70"
                        >
                          <td className="p-2">{row.id}</td>
                          <td className="p-2">{row.project_slug}</td>
                          <td className="p-2">
                            <input
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                              value={row.name}
                              onChange={(e) => {
                                const next = e.target.value;
                                setProvModels((prev) =>
                                  prev.map((m) =>
                                    m.id === row.id ? { ...m, name: next } : m
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                              value={row.version ?? ""}
                              onChange={(e) => {
                                const next = e.target.value;
                                setProvModels((prev) =>
                                  prev.map((m) =>
                                    m.id === row.id
                                      ? { ...m, version: next }
                                      : m
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                              value={row.framework ?? ""}
                              onChange={(e) => {
                                const next = e.target.value;
                                setProvModels((prev) =>
                                  prev.map((m) =>
                                    m.id === row.id
                                      ? { ...m, framework: next }
                                      : m
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                              value={row.artifact_id ?? ""}
                              onChange={(e) => {
                                const next = e.target.value;
                                setProvModels((prev) =>
                                  prev.map((m) =>
                                    m.id === row.id
                                      ? { ...m, artifact_id: next }
                                      : m
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                              value={row.description ?? ""}
                              onChange={(e) => {
                                const next = e.target.value;
                                setProvModels((prev) =>
                                  prev.map((m) =>
                                    m.id === row.id
                                      ? { ...m, description: next }
                                      : m
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2">{formatDate(row.created_at)}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <button
                                disabled={busy}
                                onClick={() => updateModel(row)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                              >
                                Save
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => deleteModel(row.id)}
                                className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50 dark:border-red-500/60 dark:text-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {provModels.length === 0 && (
                        <tr>
                          <td
                            className="p-2 text-sm text-gray-500 dark:text-slate-400"
                            colSpan={8}
                          >
                            No models found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Evidence
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    value={provEvidenceForm.project_slug}
                    onChange={(e) =>
                      setProvEvidenceForm((prev) => ({
                        ...prev,
                        project_slug: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select project</option>
                    {projects.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name ? `${p.name} (${p.slug})` : p.slug}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="name"
                    value={provEvidenceForm.name}
                    onChange={(e) =>
                      setProvEvidenceForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="description"
                    value={provEvidenceForm.description}
                    onChange={(e) =>
                      setProvEvidenceForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="artifact_id"
                    value={provEvidenceForm.artifact_id}
                    onChange={(e) =>
                      setProvEvidenceForm((prev) => ({
                        ...prev,
                        artifact_id: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <button
                    disabled={busy}
                    onClick={createProvEvidence}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Create Evidence
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <button
                    disabled={busy || evidencePage <= 1}
                    onClick={() => setEvidencePage((p) => Math.max(1, p - 1))}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                  >
                    Prev
                  </button>
                  <span>
                    Page {evidencePage} of {evidenceTotalPages} • {provEvidenceTotal} total
                  </span>
                  <button
                    disabled={busy || evidencePage >= evidenceTotalPages}
                    onClick={() =>
                      setEvidencePage((p) =>
                        Math.min(evidenceTotalPages, p + 1)
                      )
                    }
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                  >
                    Next
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                      <tr>
                        <th className="p-2 text-left">id</th>
                        <th className="p-2 text-left">project</th>
                        <th className="p-2 text-left">name</th>
                        <th className="p-2 text-left">description</th>
                        <th className="p-2 text-left">artifact_id</th>
                        <th className="p-2 text-left">created</th>
                        <th className="p-2 text-left">actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provEvidence.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 dark:border-slate-700/70"
                        >
                          <td className="p-2">{row.id}</td>
                          <td className="p-2">{row.project_slug}</td>
                          <td className="p-2">
                            <input
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                              value={row.name}
                              onChange={(e) => {
                                const next = e.target.value;
                                setProvEvidence((prev) =>
                                  prev.map((ev) =>
                                    ev.id === row.id ? { ...ev, name: next } : ev
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                              value={row.description ?? ""}
                              onChange={(e) => {
                                const next = e.target.value;
                                setProvEvidence((prev) =>
                                  prev.map((ev) =>
                                    ev.id === row.id
                                      ? { ...ev, description: next }
                                      : ev
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                              value={row.artifact_id ?? ""}
                              onChange={(e) => {
                                const next = e.target.value;
                                setProvEvidence((prev) =>
                                  prev.map((ev) =>
                                    ev.id === row.id
                                      ? { ...ev, artifact_id: next }
                                      : ev
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2">{formatDate(row.created_at)}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <button
                                disabled={busy}
                                onClick={() => updateProvEvidence(row)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                              >
                                Save
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => deleteProvEvidence(row.id)}
                                className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50 dark:border-red-500/60 dark:text-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {provEvidence.length === 0 && (
                        <tr>
                          <td
                            className="p-2 text-sm text-gray-500 dark:text-slate-400"
                            colSpan={7}
                          >
                            No evidence found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Lineage
                </div>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    value={lineageForm.project_slug}
                    onChange={(e) =>
                      setLineageForm((prev) => ({
                        ...prev,
                        project_slug: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select project</option>
                    {projects.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name ? `${p.name} (${p.slug})` : p.slug}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    value={lineageForm.parent_type}
                    onChange={(e) =>
                      setLineageForm((prev) => ({
                        ...prev,
                        parent_type: e.target.value,
                      }))
                    }
                  >
                    {PROVENANCE_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="parent_id"
                    value={lineageForm.parent_id}
                    onChange={(e) =>
                      setLineageForm((prev) => ({
                        ...prev,
                        parent_id: e.target.value,
                      }))
                    }
                  />
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    value={lineageForm.child_type}
                    onChange={(e) =>
                      setLineageForm((prev) => ({
                        ...prev,
                        child_type: e.target.value,
                      }))
                    }
                  >
                    {PROVENANCE_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="child_id"
                    value={lineageForm.child_id}
                    onChange={(e) =>
                      setLineageForm((prev) => ({
                        ...prev,
                        child_id: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="relationship"
                    value={lineageForm.relationship}
                    onChange={(e) =>
                      setLineageForm((prev) => ({
                        ...prev,
                        relationship: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <button
                    disabled={busy}
                    onClick={createLineage}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Link Lineage
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <button
                    disabled={busy || lineagePage <= 1}
                    onClick={() => setLineagePage((p) => Math.max(1, p - 1))}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                  >
                    Prev
                  </button>
                  <span>
                    Page {lineagePage} of {lineageTotalPages} • {provLineageTotal} total
                  </span>
                  <button
                    disabled={busy || lineagePage >= lineageTotalPages}
                    onClick={() =>
                      setLineagePage((p) =>
                        Math.min(lineageTotalPages, p + 1)
                      )
                    }
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                  >
                    Next
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                      <tr>
                        <th className="p-2 text-left">project</th>
                        <th className="p-2 text-left">parent</th>
                        <th className="p-2 text-left">child</th>
                        <th className="p-2 text-left">relationship</th>
                        <th className="p-2 text-left">created</th>
                        <th className="p-2 text-left">actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provLineage.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 dark:border-slate-700/70"
                        >
                          <td className="p-2">{row.project_slug}</td>
                          <td className="p-2">
                            {row.parent_type}:{row.parent_id}
                          </td>
                          <td className="p-2">
                            {row.child_type}:{row.child_id}
                          </td>
                          <td className="p-2">
                            <input
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                              value={row.relationship ?? ""}
                              onChange={(e) => {
                                const next = e.target.value;
                                setProvLineage((prev) =>
                                  prev.map((ln) =>
                                    ln.id === row.id
                                      ? { ...ln, relationship: next }
                                      : ln
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2">{formatDate(row.created_at)}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <button
                                disabled={busy}
                                onClick={() => updateLineage(row)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"
                              >
                                Save
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => deleteLineage(row.id)}
                                className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50 dark:border-red-500/60 dark:text-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {provLineage.length === 0 && (
                        <tr>
                          <td
                            className="p-2 text-sm text-gray-500 dark:text-slate-400"
                            colSpan={6}
                          >
                            No lineage found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Audit
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    value={auditForm.entity_type}
                    onChange={(e) =>
                      setAuditForm((prev) => ({
                        ...prev,
                        entity_type: e.target.value,
                      }))
                    }
                  >
                    {PROVENANCE_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                    placeholder="entity_id"
                    value={auditForm.entity_id}
                    onChange={(e) =>
                      setAuditForm((prev) => ({
                        ...prev,
                        entity_id: e.target.value,
                      }))
                    }
                  />
                  <button
                    disabled={busy}
                    onClick={loadAudit}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Load Audit
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                      <tr>
                        <th className="p-2 text-left">action</th>
                        <th className="p-2 text-left">actor</th>
                        <th className="p-2 text-left">time</th>
                        <th className="p-2 text-left">details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provAudit.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 dark:border-slate-700/70"
                        >
                          <td className="p-2">{row.action}</td>
                          <td className="p-2">{row.actor ?? ""}</td>
                          <td className="p-2">{formatDate(row.at)}</td>
                          <td className="p-2 text-xs">
                            {row.details_json
                              ? JSON.stringify(row.details_json)
                              : ""}
                          </td>
                        </tr>
                      ))}
                      {provAudit.length === 0 && (
                        <tr>
                          <td
                            className="p-2 text-sm text-gray-500 dark:text-slate-400"
                            colSpan={4}
                          >
                            No audit entries.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {tab === "evidences" && (
            <section className="space-y-3">
              {(() => {
                const filtered = evidences.filter((row) => {
                  if (
                    evidenceProjectFilter &&
                    row.project_slug !== evidenceProjectFilter
                  ) {
                    return false;
                  }
                  if (
                    evidenceApprovalStatusFilter &&
                    normalize(row.approval_status) !==
                      normalize(evidenceApprovalStatusFilter)
                  ) {
                    return false;
                  }
                  if (
                    evidenceStatusFilter &&
                    normalize(row.status) !== normalize(evidenceStatusFilter)
                  ) {
                    return false;
                  }
                  if (
                    evidenceTypeFilter &&
                    evidenceTypeOf(row) !== evidenceTypeFilter
                  ) {
                    return false;
                  }
                  if (evidenceSearch) {
                    const q = normalize(evidenceSearch);
                    const haystack = [
                      row.name,
                      row.control_id,
                      row.project_slug,
                      row.sha256,
                    ]
                      .map((v) => normalize(v))
                      .join(" ");
                    if (!haystack.includes(q)) return false;
                  }
                  return true;
                });
                const types = Array.from(
                  new Set(
                    evidences
                      .map((row) => evidenceTypeOf(row))
                      .filter((value) => value)
                  )
                ).sort();
                const statusOptions = Array.from(
                  new Set(
                    evidences
                      .map((row) => normalize(row.status))
                      .filter((value) => value)
                  )
                ).sort();
                const approvalOptions = Array.from(
                  new Set(
                    evidences
                      .map((row) => normalize(row.approval_status))
                      .filter((value) => value)
                  )
                ).sort();

                return (
                  <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={busy}
                  onClick={loadEvidences}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {filtered.length} item{filtered.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Project
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    value={evidenceProjectFilter}
                    onChange={(e) => setEvidenceProjectFilter(e.target.value)}
                  >
                    <option value="">All projects</option>
                    {projects.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name ?? p.slug}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Approval Status
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    value={evidenceApprovalStatusFilter}
                    onChange={(e) =>
                      setEvidenceApprovalStatusFilter(e.target.value)
                    }
                  >
                    <option value="">All approval statuses</option>
                    {approvalOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Evidence Status
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    value={evidenceStatusFilter}
                    onChange={(e) => setEvidenceStatusFilter(e.target.value)}
                  >
                    <option value="">All evidence statuses</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Evidence type
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    value={evidenceTypeFilter}
                    onChange={(e) => setEvidenceTypeFilter(e.target.value)}
                  >
                    <option value="">All types</option>
                    {types.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Search
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    value={evidenceSearch}
                    onChange={(e) => setEvidenceSearch(e.target.value)}
                    placeholder="Name, control, hash..."
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Axis
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/60"
                    disabled
                  >
                    {AXIS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Linked system/model
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/60"
                    disabled
                  >
                    <option>All systems</option>
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Expiry window
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/60"
                    disabled
                  >
                    <option>All</option>
                    <option>Next 30 days</option>
                    <option>Next 90 days</option>
                  </select>
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    <tr>
                      <th className="p-2 text-left" title="Evidence file name and type">
                        evidence
                      </th>
                      <th
                        className="p-2 text-left"
                        title="Project name linked to this evidence"
                      >
                        Project Name
                      </th>
                      <th className="p-2 text-left" title="Evidence lifecycle status">
                        Evidence Status
                      </th>
                      <th className="p-2 text-left" title="Evidence source">
                        evidence source
                      </th>
                      <th className="p-2 text-left" title="Owner role">
                        owner role
                      </th>
                      <th
                        className="p-2 text-left"
                        title="Last integrity or presence check timestamp"
                      >
                        last verified
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-slate-100 dark:border-slate-700/70"
                      >
                        <td className="p-2">
                          <button
                            type="button"
                            className="rounded-md bg-emerald-50 px-2 py-1 text-left text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                            onClick={() => {
                              setSelectedEvidence(e);
                              setEvidenceComment(e.last_comment ?? "");
                              setEvidenceAttachment(null);
                            }}
                            title="Open evidence details"
                          >
                            {e.name ?? `Evidence ${e.id}`}
                          </button>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {(e.mime ?? evidenceTypeOf(e)) || "unknown"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Approval Status: {e.approval_status ?? "pending"} · Approved By:{" "}
                            {e.approved_by ?? "—"} · Approved At:{" "}
                            {formatDateTime(e.approved_at)}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-sm">{projectNameFor(e.project_slug)}</div>
                        </td>
                        <td className="p-2">{e.status ?? ""}</td>
                        <td className="p-2">{e.evidence_source ?? "—"}</td>
                        <td className="p-2">{e.owner_role ?? "—"}</td>
                        <td className="p-2">{formatDate(e.updated_at)}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td
                          className="p-2 text-sm text-gray-500 dark:text-slate-400"
                          colSpan={6}
                        >
                          No evidences found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
                  </>
                );
              })()}
            </section>
          )}

          {tab === "registry" && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={busy}
                  onClick={loadAiSystems}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={openNewAiSystemModal}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                  disabled={busy}
                >
                  New AI system
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {aiSystems.length} item{aiSystems.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Project
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    value={aiSystemProject}
                    onChange={(e) => setAiSystemProject(e.target.value)}
                  >
                    <option value="">All projects</option>
                    {projects.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name ?? p.slug}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-2">
                    <span>Risk tier</span>
                    <span className="group relative inline-flex">
                      <span
                        tabIndex={0}
                        aria-label="Risk tier guidance"
                        title={riskTierGuidance}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500"
                      >
                        i
                      </span>
                      <span className="pointer-events-none absolute left-1/2 top-6 z-20 w-72 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-600 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 whitespace-pre-line">
                        {riskTierGuidance}
                      </span>
                    </span>
                  </span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    value={aiSystemRisk}
                    onChange={(e) => setAiSystemRisk(e.target.value)}
                  >
                    <option value="">All tiers</option>
                    <option value="High risk">High risk</option>
                    <option value="Medium risk">Medium risk</option>
                    <option value="Low risk">Low risk</option>
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Status
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    value={aiSystemStatus}
                    onChange={(e) => setAiSystemStatus(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option value="experimental">Experimental</option>
                    <option value="planned">Planned</option>
                    <option value="in_review">In_review</option>
                    <option value="active">Active</option>
                    <option value="retired">Retired</option>
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Search
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    value={aiSystemQuery}
                    onChange={(e) => setAiSystemQuery(e.target.value)}
                    placeholder="Use Case Reference, name, model provider..."
                  />
                </label>
              </div>



              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    <tr>
                      <th className="p-2 text-left">Project</th>
                      <th className="p-2 text-left">AI Use Case</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Risk</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Owner</th>
                      <th className="p-2 text-left">Model Provider</th>
                      <th className="p-2 text-left">Updated</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiSystems.map((row) => {
                      const isEditing = editingAiSystemId === row.id;
                      const draft = isEditing ? editingAiSystem : null;
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 dark:border-slate-700/70"
                        >
                          <td className="p-2">
                            {isEditing ? (
                              <select
                                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                                value={draft?.project_slug ?? ""}
                                onChange={(e) =>
                                  setEditingAiSystem((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          project_slug: e.target.value || null,
                                        }
                                      : prev
                                  )
                                }
                              >
                                <option value="">General</option>
                                {projects.map((p) => (
                                  <option key={p.slug} value={p.slug}>
                                    {p.name ?? p.slug}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              aiSystemProjectLabel(row.project_slug)
                            )}
                          </td>
                          <td className="p-2 font-medium text-slate-900 dark:text-slate-100">
                            <button
                              type="button"
                              onClick={() => openAiSystemModal(row)}
                              className="text-left underline decoration-transparent transition hover:decoration-current"
                              title="Open AI system details"
                            >
                              {row.uc_id}
                            </button>
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <input
                                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                                value={draft?.name ?? ""}
                                onChange={(e) =>
                                  setEditingAiSystem((prev) =>
                                    prev ? { ...prev, name: e.target.value } : prev
                                  )
                                }
                              />
                            ) : (
                              row.name
                            )}
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <select
                                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                                value={draft?.risk_tier ?? ""}
                                onChange={(e) =>
                                  setEditingAiSystem((prev) =>
                                    prev ? { ...prev, risk_tier: e.target.value } : prev
                                  )
                                }
                              >
                                <option value="">Risk tier</option>
                                <option value="High risk">High risk</option>
                                <option value="Medium risk">Medium risk</option>
                                <option value="Low risk">Low risk</option>
                              </select>
                            ) : (
                              row.risk_tier ?? "—"
                            )}
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <select
                                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                                value={draft?.status ?? ""}
                                onChange={(e) =>
                                  setEditingAiSystem((prev) =>
                                    prev ? { ...prev, status: e.target.value } : prev
                                  )
                                }
                              >
                                <option value="">Status</option>
                                <option value="experimental">Experimental</option>
                                <option value="planned">Planned</option>
                                <option value="in_review">In_review</option>
                                <option value="active">Active</option>
                                <option value="retired">Retired</option>
                              </select>
                            ) : (
                              row.status ?? "—"
                            )}
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <input
                                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                                value={draft?.owner ?? ""}
                                onChange={(e) =>
                                  setEditingAiSystem((prev) =>
                                    prev ? { ...prev, owner: e.target.value } : prev
                                  )
                                }
                              />
                            ) : (
                              row.owner ?? "—"
                            )}
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <input
                                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                                value={draft?.model_provider ?? ""}
                                    onChange={(e) =>
                                      setEditingAiSystem((prev) =>
                                        prev ? { ...prev, model_provider: e.target.value } : prev
                                      )
                                    }
                              />
                            ) : (
                              row.model_provider ?? "—"
                            )}
                          </td>
                          <td className="p-2">{formatDate(row.updated_at)}</td>
                          <td className="p-2">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <button
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50"
                                  onClick={updateAiSystem}
                                  disabled={busy}
                                >
                                  Save
                                </button>
                                <button
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50"
                                  onClick={cancelEditAiSystem}
                                  disabled={busy}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50"
                                  onClick={() => openAiSystemModal(row)}
                                  disabled={busy}
                                >
                                  Edit
                                </button>
                                <button
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50"
                                  onClick={() => retireAiSystem(row)}
                                  disabled={busy || row.status === "retired"}
                                >
                                  Retire
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {aiSystems.length === 0 && (
                      <tr>
                        <td
                          className="p-2 text-sm text-gray-500 dark:text-slate-400"
                          colSpan={11}
                        >
                          No AI systems yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "requirements" && (
            <section className="space-y-4">
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  requirementsCoverageStatus === "complete"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : requirementsCoverageStatus === "partial"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-rose-200 bg-rose-50 text-rose-900"
                }`}
              >
                <div className="font-semibold">
                  {requirementsCoverageStatus === "complete"
                    ? t("requirementsStatus.complete")
                    : requirementsCoverageStatus === "partial"
                    ? t("requirementsStatus.partial")
                    : t("requirementsStatus.none")}
                </div>
                {requirementsCoverageStatus !== "complete" && (
                  <div className="mt-1 text-xs text-slate-600">
                    {requirementsMissingMessage}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="mb-3 text-xs font-semibold uppercase text-slate-500">
                  Add governance to project
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <label className="text-xs text-slate-500">
                    Project{" "}
                    <span className="text-xs font-semibold text-red-500">*</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      value={newRequirement.project_slug ?? ""}
                      onChange={(e) => handleRequirementProjectSelection(e.target.value)}
                    >
                      <option value="">Select project</option>
                      {projects.map((p) => (
                        <option key={p.slug} value={p.slug}>
                          {p.name ?? p.slug}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_0.9fr_auto]">
                      <label
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                          requirementDrafts.eu_ai_act.enabled
                            ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={requirementDrafts.eu_ai_act.enabled}
                          onChange={(e) =>
                            updateRequirementDraft("eu_ai_act", {
                              enabled: e.target.checked,
                            })
                          }
                        />
                        EU AI ACT
                        <span className="text-[10px] font-semibold text-red-500">*</span>
                      </label>
                      <input
                        className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        value={requirementDrafts.eu_ai_act.requirement_code || euAiActObligation || ""}
                        readOnly
                      />
                      <select
                        className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        value={requirementDrafts.eu_ai_act.uc_id}
                        onChange={(e) =>
                          updateRequirementDraft("eu_ai_act", {
                            uc_id: e.target.value,
                          })
                        }
                      >
                        <option value="">Use Case</option>
                        {useCaseOptions.map((row) => (
                          <option key={row.uc_id} value={row.uc_id}>
                            {row.uc_id}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <select
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          value={requirementDrafts.eu_ai_act.status}
                          onChange={(e) =>
                            updateRequirementDraft("eu_ai_act", {
                              status: e.target.value,
                            })
                          }
                        >
                          <option value="not_started">Not started</option>
                          <option value="in_progress">In progress</option>
                          <option value="complete">Complete</option>
                          <option value="retired">Retired</option>
                        </select>
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50"
                          onClick={() => addRequirementEntry("eu_ai_act")}
                          disabled={busy}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50"
                          onClick={() => removeLastEntryForFramework("eu_ai_act")}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_0.9fr_auto]">
                      <label
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                          requirementDrafts.iso_42001.enabled
                            ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={requirementDrafts.iso_42001.enabled}
                          onChange={(e) =>
                            updateRequirementDraft("iso_42001", {
                              enabled: e.target.checked,
                            })
                          }
                        />
                        ISO 42001
                        <span className="text-[10px] font-semibold text-red-500">*</span>
                      </label>
                      <select
                        className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        value={requirementDrafts.iso_42001.requirement_code}
                        onChange={(e) =>
                          updateRequirementDraft("iso_42001", {
                            requirement_code: e.target.value,
                          })
                        }
                      >
                        <option value="">Select maturity level *</option>
                        <option value="Level 1: Initial">Level 1: Initial</option>
                        <option value="Level 2: Managed">Level 2: Managed</option>
                        <option value="Level 3: Defined">Level 3: Defined</option>
                        <option value="Level 4: Quantitatively Managed">
                          Level 4: Quantitatively Managed
                        </option>
                        <option value="Level 5: Optimizing">Level 5: Optimizing</option>
                      </select>
                      <select
                        className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        value={requirementDrafts.iso_42001.uc_id}
                        onChange={(e) =>
                          updateRequirementDraft("iso_42001", {
                            uc_id: e.target.value,
                          })
                        }
                      >
                        <option value="">Use Case</option>
                        {useCaseOptions.map((row) => (
                          <option key={row.uc_id} value={row.uc_id}>
                            {row.uc_id}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <select
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          value={requirementDrafts.iso_42001.status}
                          onChange={(e) =>
                            updateRequirementDraft("iso_42001", {
                              status: e.target.value,
                            })
                          }
                        >
                          <option value="not_started">Not started</option>
                          <option value="in_progress">In progress</option>
                          <option value="complete">Complete</option>
                          <option value="retired">Retired</option>
                        </select>
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50"
                          onClick={() => addRequirementEntry("iso_42001")}
                          disabled={busy}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50"
                          onClick={() => removeLastEntryForFramework("iso_42001")}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_0.9fr_auto]">
                      <label
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                          requirementDrafts.nist_ai_rmf.enabled
                            ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={requirementDrafts.nist_ai_rmf.enabled}
                          onChange={(e) =>
                            updateRequirementDraft("nist_ai_rmf", {
                              enabled: e.target.checked,
                            })
                          }
                        />
                        NIST AI RMF
                        <span className="text-[10px] font-semibold text-red-500">*</span>
                      </label>
                      <select
                        className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        value={requirementDrafts.nist_ai_rmf.requirement_code}
                        onChange={(e) =>
                          updateRequirementDraft("nist_ai_rmf", {
                            requirement_code: e.target.value,
                          })
                        }
                      >
                        <option value="">Select function *</option>
                        <option value="Govern">Govern</option>
                        <option value="Map">Map</option>
                        <option value="Measure">Measure</option>
                        <option value="Manage">Manage</option>
                      </select>
                      <select
                        className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        value={requirementDrafts.nist_ai_rmf.uc_id}
                        onChange={(e) =>
                          updateRequirementDraft("nist_ai_rmf", {
                            uc_id: e.target.value,
                          })
                        }
                      >
                        <option value="">Use Case</option>
                        {useCaseOptions.map((row) => (
                          <option key={row.uc_id} value={row.uc_id}>
                            {row.uc_id}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <select
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          value={requirementDrafts.nist_ai_rmf.status}
                          onChange={(e) =>
                            updateRequirementDraft("nist_ai_rmf", {
                              status: e.target.value,
                            })
                          }
                        >
                          <option value="not_started">Not started</option>
                          <option value="in_progress">In progress</option>
                          <option value="complete">Complete</option>
                          <option value="retired">Retired</option>
                        </select>
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50"
                          onClick={() => addRequirementEntry("nist_ai_rmf")}
                          disabled={busy}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50"
                          onClick={() => removeLastEntryForFramework("nist_ai_rmf")}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_0.9fr_auto]">
                      <label
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                          requirementDrafts.company_specific.enabled
                            ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={requirementDrafts.company_specific.enabled}
                          onChange={(e) =>
                            updateRequirementDraft("company_specific", {
                              enabled: e.target.checked,
                            })
                          }
                        />
                        ISO 27001
                        <span className="text-[10px] font-semibold text-red-500">*</span>
                      </label>
                      <input
                        className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        placeholder="Customize *"
                        value={requirementDrafts.company_specific.requirement_code}
                        onChange={(e) =>
                          updateRequirementDraft("company_specific", {
                            requirement_code: e.target.value,
                          })
                        }
                      />
                      <select
                        className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        value={requirementDrafts.company_specific.uc_id}
                        onChange={(e) =>
                          updateRequirementDraft("company_specific", {
                            uc_id: e.target.value,
                          })
                        }
                      >
                        <option value="">Use Case</option>
                        {useCaseOptions.map((row) => (
                          <option key={row.uc_id} value={row.uc_id}>
                            {row.uc_id}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <select
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          value={requirementDrafts.company_specific.status}
                          onChange={(e) =>
                            updateRequirementDraft("company_specific", {
                              status: e.target.value,
                            })
                          }
                        >
                          <option value="not_started">Not started</option>
                          <option value="in_progress">In progress</option>
                          <option value="complete">Complete</option>
                          <option value="retired">Retired</option>
                        </select>
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50"
                          onClick={() => addRequirementEntry("company_specific")}
                          disabled={busy}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50"
                          onClick={() => removeLastEntryForFramework("company_specific")}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {pendingRequirementEntries.length ? (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase text-slate-400">
                          Pending entries
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead className="text-left text-slate-500">
                              <tr>
                                <th className="p-2">Framework</th>
                                <th className="p-2">Requirement</th>
                                <th className="p-2">Use Case</th>
                                <th className="p-2">Status</th>
                                <th className="p-2">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendingRequirementEntries.map((entry) => (
                                <tr
                                  key={entry.id}
                                  className="border-t border-slate-100 dark:border-slate-800"
                                >
                                  <td className="p-2">
                                    {formatFrameworkLabel(entry.framework)}
                                  </td>
                                  <td className="p-2">{entry.requirement_code}</td>
                                  <td className="p-2">{entry.uc_id || "—"}</td>
                                  <td className="p-2">{entry.status}</td>
                                  <td className="p-2">
                                    <button
                                      type="button"
                                      className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                      onClick={() =>
                                        removePendingRequirementEntry(entry.id)
                                      }
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">
                        No pending entries yet. Use the Add button to queue entries.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-50"
                      onClick={launchGovernanceReport}
                      disabled={busy || govReportLoading}
                    >
                      {govReportLoading
                        ? "Generating Report…"
                        : "Launch Governance Requirements Report"}
                    </button>
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-gray-50"
                      onClick={createRequirement}
                      disabled={busy}
                    >
                      Create KPIs (The Metric)
                    </button>
                  </div>
                </div>
              </div>
              <div className="text-xs font-semibold uppercase text-slate-500">
                Existing Governance For Projects
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={busy}
                  onClick={loadRequirements}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {requirements.length} item{requirements.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Project
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    value={requirementProject}
                    onChange={(e) => setRequirementProject(e.target.value)}
                  >
                    <option value="">All projects</option>
                    {projects.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name ?? p.slug}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Use Case Reference
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={requirementUcId}
                    onChange={(e) => setRequirementUcId(e.target.value)}
                    placeholder="Use Case Reference"
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Framework
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={requirementFramework}
                    onChange={(e) => setRequirementFramework(e.target.value)}
                  >
                    <option value="">All frameworks</option>
                    <option value="eu_ai_act">EU AI Act</option>
                    <option value="iso_42001">ISO 42001</option>
                    <option value="nist_ai_rmf">NIST AI RMF</option>
                    <option value="company_specific">ISO 27001</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Status
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={requirementStatus}
                    onChange={(e) => setRequirementStatus(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="complete">Complete</option>
                    <option value="retired">Retired</option>
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Search
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={requirementQuery}
                    onChange={(e) => setRequirementQuery(e.target.value)}
                    placeholder="Code, title..."
                  />
                </label>
              </div>

              {requirementView === "list" && (
                <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    <tr>
                      <th className="p-2 text-left">Framework</th>
                      <th className="p-2 text-left">Code</th>
                      <th className="p-2 text-left">Title</th>
                      <th className="p-2 text-left">Project</th>
                      <th className="p-2 text-left">Use Case Reference</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Owner role</th>
                      <th className="p-2 text-left">Controls</th>
                      <th className="p-2 text-left">Evidence</th>
                      <th className="p-2 text-left">Updated</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requirements.map((row) => (
                      <Fragment key={row.id}>
                        <tr className="border-b border-slate-100 dark:border-slate-700/70">
                          <td className="p-2">{row.framework}</td>
                          <td className="p-2">{row.requirement_code}</td>
                          <td className="p-2">{row.title ?? "—"}</td>
                          <td className="p-2">{projectNameFor(row.project_slug)}</td>
                          <td className="p-2">{row.uc_id ?? "—"}</td>
                          <td className="p-2">{row.status ?? "—"}</td>
                          <td className="p-2">{row.owner_role ?? "—"}</td>
                          <td className="p-2">
                            {listToString(row.mapped_controls) || "—"}
                          </td>
                          <td className="p-2">
                            {listToString(row.evidence_ids) || "—"}
                          </td>
                          <td className="p-2">{formatDate(row.updated_at)}</td>
                          <td className="p-2">
                            <button
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50"
                              onClick={() => {
                                setEditingRequirementId(row.id);
                                setEditingControls(listToString(row.mapped_controls));
                                setEditingEvidence(listToString(row.evidence_ids));
                              }}
                            >
                              Edit links
                            </button>
                            <button
                              className="ml-2 rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                              onClick={() => deleteRequirement(row)}
                              disabled={busy}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                        {editingRequirementId === row.id && (
                          <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-700/70 dark:bg-slate-800/40">
                            <td colSpan={11} className="p-3">
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <label className="text-xs text-slate-500 dark:text-slate-400">
                                  Linked controls (control_id or kpi_key)
                                  <input
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                    value={editingControls}
                                    onChange={(e) =>
                                      setEditingControls(e.target.value)
                                    }
                                    placeholder="ctrl-uuid-1, ctrl-uuid-2"
                                  />
                                </label>
                                <label className="text-xs text-slate-500 dark:text-slate-400">
                                  Linked evidence IDs
                                  <input
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                    value={editingEvidence}
                                    onChange={(e) =>
                                      setEditingEvidence(e.target.value)
                                    }
                                    placeholder="12, 15, 32"
                                  />
                                </label>
                                <div className="flex items-end gap-2">
                                  <button
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-gray-50"
                                    onClick={() => updateRequirementLinks(row)}
                                    disabled={busy}
                                  >
                                    Save links
                                  </button>
                                  <button
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-gray-50"
                                    onClick={() => {
                                      setEditingRequirementId(null);
                                      setEditingControls("");
                                      setEditingEvidence("");
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {requirements.length === 0 && (
                      <tr>
                        <td
                          className="p-2 text-sm text-gray-500 dark:text-slate-400"
                          colSpan={11}
                        >
                          No requirements yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              )}

              {requirementView === "matrix" && (
                <div className="overflow-x-auto">
                  {(() => {
                    const matrixControls = Array.from(
                      new Set(
                        requirements.flatMap((row) => listFromValue(row.mapped_controls))
                      )
                    ).sort();
                    const matrixEvidence = Array.from(
                      new Set(
                        requirements.flatMap((row) => listFromValue(row.evidence_ids))
                      )
                    ).sort((a, b) => {
                      const an = Number(a);
                      const bn = Number(b);
                      if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
                      return a.localeCompare(b);
                    });
                    if (matrixControls.length === 0 && matrixEvidence.length === 0) {
                      return (
                        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          No linked controls or evidence to render a matrix. Add links
                          on requirements first.
                        </div>
                      );
                    }
                    return (
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                          <tr>
                            <th className="p-2 text-left">Requirement</th>
                            {matrixControls.map((ctrl) => (
                              <th key={`c-${ctrl}`} className="p-2 text-center">
                                C:{ctrl}
                              </th>
                            ))}
                            {matrixEvidence.map((ev) => (
                              <th key={`e-${ev}`} className="p-2 text-center">
                                E:{ev}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {requirements.map((row) => {
                            const controlSet = new Set(
                              listFromValue(row.mapped_controls)
                            );
                            const evidenceSet = new Set(
                              listFromValue(row.evidence_ids)
                            );
                            return (
                              <tr
                                key={`matrix-${row.id}`}
                                className="border-b border-slate-100 dark:border-slate-700/70"
                              >
                                <td className="p-2 text-left">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {row.requirement_code}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {row.title ?? "—"}
                                  </div>
                                </td>
                                {matrixControls.map((ctrl) => (
                                  <td
                                    key={`mc-${row.id}-${ctrl}`}
                                    className="p-2 text-center"
                                  >
                                    {controlSet.has(ctrl) ? "✓" : ""}
                                  </td>
                                ))}
                                {matrixEvidence.map((ev) => (
                                  <td
                                    key={`me-${row.id}-${ev}`}
                                    className="p-2 text-center"
                                  >
                                    {evidenceSet.has(ev) ? "✓" : ""}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Required KPIs for Project Governance - The Metric
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {selectedRequirementProject
                        ? `Project: ${projectNameFor(selectedRequirementProject)}`
                        : "Select a project to see the KPI obligations"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50"
                      onClick={() =>
                        setRequiredKpiView((prev) =>
                          prev === "list" ? "matrix" : "list"
                        )
                      }
                      disabled={!selectedRequirementProject || requiredKpiLoading}
                    >
                      {requiredKpiView === "list" ? "Matrix View" : "List View"}
                    </button>
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => loadRequirementKpis(selectedRequirementProject)}
                      disabled={!selectedRequirementProject || requiredKpiLoading}
                    >
                      Refresh
                    </button>
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50"
                      onClick={saveRequiredKpis}
                      disabled={!selectedRequirementProject || requiredKpiSaving}
                    >
                      {requiredKpiSaving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>

                {requiredKpiSummary.length > 0 && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {requiredKpiSummary.map((summaryItem, idx) => (
                      <div
                        key={`${summaryItem.framework}-${summaryItem.requirement_code}-${idx}`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            {formatFrameworkLabel(summaryItem.framework)}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {summaryItem.count} KPI
                            {summaryItem.count === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {summaryItem.requirement_code ?? "—"}
                        </div>
                        {summaryItem.note && (
                          <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-300">
                            {summaryItem.note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedRequirementProject ? (
                  requiredKpiLoading ? (
                    <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                      Loading required KPIs…
                    </div>
                  ) : requiredKpiError ? (
                    <div className="mt-4 text-sm text-red-600">{requiredKpiError}</div>
                  ) : requiredKpis.length ? (
                    requiredKpiView === "matrix" ? (
                      <div className="mt-4 overflow-x-auto">
                        {(() => {
                          const rows = Array.from(
                            requiredKpis.reduce((acc, row) => {
                              const key = row.kpi_key || row.kpi_name;
                              if (!key) return acc;
                              const entry =
                                acc.get(key) || {
                                  kpi_key: row.kpi_key,
                                  kpi_name: row.kpi_name,
                                  frameworks: new Set<string>(),
                                  clauses: new Set<string>(),
                                };
                              if (row.framework) entry.frameworks.add(row.framework);
                              if (row.clause) entry.clauses.add(row.clause);
                              acc.set(key, entry);
                              return acc;
                            }, new Map<string, any>())
                              .values()
                          ).sort((a, b) => {
                            const aName = a.kpi_name || a.kpi_key || "";
                            const bName = b.kpi_name || b.kpi_key || "";
                            return aName.localeCompare(bName);
                          });

                          return (
                            <table className="min-w-full text-sm">
                              <thead className="bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                <tr>
                                  <th className="p-2 text-left">KPI</th>
                                  <th className="p-2 text-center">EU AI ACT</th>
                                  <th className="p-2 text-center">ISO 42001</th>
                                  <th className="p-2 text-center">NIST AI RMF</th>
                                  <th className="p-2 text-left">Clause</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((row) => (
                                  <tr
                                    key={`matrix-${row.kpi_key}`}
                                    className="border-b border-slate-200/60 text-slate-700 dark:border-slate-700/70 dark:text-slate-200"
                                  >
                                    <td className="p-2">
                                      <div className="font-medium">{row.kpi_name}</div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {row.kpi_key}
                                      </div>
                                    </td>
                                  <td className="p-2 text-center text-xs">
                                      {(row.frameworks ?? new Set()).has("eu_ai_act") ? "yes" : "no"}
                                    </td>
                                    <td className="p-2 text-center text-xs">
                                      {(row.frameworks ?? new Set()).has("iso_42001") ? "yes" : "no"}
                                    </td>
                                    <td className="p-2 text-center text-xs">
                                      {(row.frameworks ?? new Set()).has("nist_ai_rmf") ? "yes" : "no"}
                                    </td>
                                    <td className="p-2 text-xs text-slate-500 dark:text-slate-400">
                                      {[...(row.clauses ?? new Set())].join("; ") || "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                            <tr>
                              <th className="p-2 text-left">Framework</th>
                              <th className="p-2 text-left">Requirement</th>
                              <th className="p-2 text-left">KPI</th>
                              <th className="p-2 text-left">Clause</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...requiredKpis]
                              .sort((a, b) => {
                                const f = a.framework.localeCompare(b.framework);
                                if (f !== 0) return f;
                                return a.kpi_name.localeCompare(b.kpi_name);
                              })
                              .map((row) => (
                                <tr
                                  key={`${row.framework}-${row.kpi_key}-${row.requirement_code}`}
                                  className="border-b border-slate-200/60 text-slate-700 dark:border-slate-700/70 dark:text-slate-200"
                                >
                                  <td className="p-2">{formatFrameworkLabel(row.framework)}</td>
                                  <td className="p-2">{row.requirement_code ?? "—"}</td>
                                  <td className="p-2">
                                    <div className="font-medium">{row.kpi_name}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      {row.kpi_key}
                                    </div>
                                  </td>
                                  <td className="p-2 text-xs text-slate-500 dark:text-slate-400">
                                    <div className="space-y-1">
                                      <div>{row.clause ?? "—"}</div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <button
                                          type="button"
                                          className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-gray-50"
                                          onClick={() => openKpiDetail(row.kpi_key)}
                                        >
                                          Details
                                        </button>
                                        <button
                                          type="button"
                                          className="rounded-md border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                                          onClick={() => deleteRequirementKpi(row)}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : (
                    <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                      No KPI mappings found yet for the selected project.
                    </div>
                  )
                ) : (
                  <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                    Choose a project filter above to view required KPIs.
                  </div>
                )}
                {selectedRequirementProject && (
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Save changes applies control sync and removes control values for removed KPIs.
                    </span>
                    {requiredKpiSaveNotice && (
                      <span className="text-xs text-emerald-600">
                        {requiredKpiSaveNotice}
                      </span>
                    )}
                    {applyKpiChangesNotice && (
                      <span className="text-xs text-indigo-600">
                        {applyKpiChangesNotice}
                      </span>
                    )}
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-50"
                      onClick={backToPrevious}
                    >
                      Back
                    </button>
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-50"
                      onClick={saveRequiredKpis}
                      disabled={requiredKpiSaving}
                    >
                      {requiredKpiSaving ? "Saving…" : "Save changes"}
                    </button>
                    {requiredKpiDiff && (
                      <>
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-gray-50"
                          onClick={() => setRequiredKpiDiffOpen(true)}
                        >
                          Show KPI keys
                        </button>
                        <button
                          className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                          onClick={applyRequiredKpiChanges}
                          disabled={applyKpiChangesBusy}
                        >
                          {applyKpiChangesBusy
                            ? "Applying…"
                            : "Proceed to apply changes"}
                        </button>
                      </>
                    )}
                    {requiredKpiSaved && (
                      <button
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={goToControlsRegister}
                        disabled={
                          !requiredKpiSaveComplete ||
                          (requiredKpiDiff ? !requiredKpiApplyComplete : false)
                        }
                      >
                        Next Step: Controls Register
                      </button>
                    )}
                  </div>
                )}
                {requiredKpiDiff && (
                  <div className="mt-2 flex flex-wrap justify-end gap-3 text-xs text-slate-600 dark:text-slate-300">
                    <span>
                      Existing KPIs:{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {requiredKpiDiff.existing}
                      </span>
                    </span>
                    <span>
                      New KPIs to be added:{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {requiredKpiDiff.newCount}
                      </span>
                    </span>
                    <span>
                      To be removed KPIs:{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {requiredKpiDiff.removed}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {tab === "aims-scope" && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={busy}
                  onClick={loadAimsScope}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Last updated: {formatDate(aimsScope?.updated_at) || "—"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Scope name
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={aimsScopeForm.scope_name}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({
                        ...prev,
                        scope_name: e.target.value,
                      }))
                    }
                    placeholder="AIMS Scope (e.g. AI products in EMEA)"
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Status
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={aimsScopeForm.status}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="in_review">In review</option>
                    <option value="approved">Approved</option>
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Owner
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={aimsScopeForm.owner}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({ ...prev, owner: e.target.value }))
                    }
                    placeholder="AIMS owner"
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Updated by
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={aimsScopeForm.updated_by}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({
                        ...prev,
                        updated_by: e.target.value,
                      }))
                    }
                    placeholder="Your name"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Scope statement
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    rows={3}
                    value={aimsScopeForm.scope_statement}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({
                        ...prev,
                        scope_statement: e.target.value,
                      }))
                    }
                    placeholder="High-level scope statement for the AIMS."
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Scope boundaries
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    rows={3}
                    value={aimsScopeForm.scope_boundaries}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({
                        ...prev,
                        scope_boundaries: e.target.value,
                      }))
                    }
                    placeholder="In-scope org units, products, and exclusions."
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Internal context
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    rows={3}
                    value={aimsScopeForm.context_internal}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({
                        ...prev,
                        context_internal: e.target.value,
                      }))
                    }
                    placeholder="Business strategy, risk appetite, internal constraints."
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  External context
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    rows={3}
                    value={aimsScopeForm.context_external}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({
                        ...prev,
                        context_external: e.target.value,
                      }))
                    }
                    placeholder="Regulatory, stakeholder, and market factors."
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Interested parties (comma/new line)
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    rows={3}
                    value={aimsScopeForm.interested_parties}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({
                        ...prev,
                        interested_parties: e.target.value,
                      }))
                    }
                    placeholder="Regulators, customers, partners"
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Lifecycle coverage (comma/new line)
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    rows={3}
                    value={aimsScopeForm.lifecycle_coverage}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({
                        ...prev,
                        lifecycle_coverage: e.target.value,
                      }))
                    }
                    placeholder="Design, development, deployment, monitoring"
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Cloud platforms (comma/new line)
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    rows={3}
                    value={aimsScopeForm.cloud_platforms}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({
                        ...prev,
                        cloud_platforms: e.target.value,
                      }))
                    }
                    placeholder="AWS, Azure, GCP, on-prem"
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Regulatory requirements (comma/new line)
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    rows={3}
                    value={aimsScopeForm.regulatory_requirements}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({
                        ...prev,
                        regulatory_requirements: e.target.value,
                      }))
                    }
                    placeholder="EU AI Act, ISO 42001, ISO 27001"
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  ISMS / PMS integration
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    rows={3}
                    value={aimsScopeForm.isms_pms_integration}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({
                        ...prev,
                        isms_pms_integration: e.target.value,
                      }))
                    }
                    placeholder="Describe integration points with ISO 27001/27701."
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Exclusions
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    rows={3}
                    value={aimsScopeForm.exclusions}
                    onChange={(e) =>
                      setAimsScopeForm((prev) => ({
                        ...prev,
                        exclusions: e.target.value,
                      }))
                    }
                    placeholder="Out-of-scope AI systems or regions."
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-gray-50"
                  onClick={saveAimsScope}
                  disabled={busy}
                >
                  Save scope
                </button>
              </div>
            </section>
          )}

          {tab === "policies" && (
            <section className="space-y-4">
              {policyEntityLabel && (
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  All Policies for {policyEntityLabel}{" "}
                  <span className="text-xs italic text-slate-500 dark:text-slate-400">
                    - policies are entity level
                  </span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={busy}
                  onClick={loadPolicies}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {policies.length} item{policies.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Search
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={policyQuery}
                    onChange={(e) => setPolicyQuery(e.target.value)}
                    placeholder="Policy title..."
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  Status
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={policyStatus}
                    onChange={(e) => setPolicyStatus(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="retired">Retired</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr,1fr]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                      <tr>
                        <th className="p-2 text-left">Title</th>
                        <th className="p-2 text-left">Owner role</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">ISO 42001</th>
                        <th className="p-2 text-left">ISO 42001 Status</th>
                        <th className="p-2 text-left">Version status</th>
                        <th className="p-2 text-left">Updated</th>
                        <th className="p-2 text-left">Manage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {policies.map((row) => (
                        <tr
                          key={row.id}
                          className={`cursor-pointer border-b border-slate-100 dark:border-slate-700/70 ${
                            policySelectedId === row.id ? "bg-indigo-50/40" : ""
                          }`}
                          onClick={() => loadPolicyVersions(row.id)}
                        >
                          <td className="p-2 font-medium text-slate-900 dark:text-slate-100">
                            {row.title}
                          </td>
                          <td className="p-2">{row.owner_role ?? "—"}</td>
                          <td className="p-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{row.status ?? "—"}</span>
                              {row.status === "active" &&
                                row.latest_version?.status &&
                                row.latest_version.status !== "approved" && (
                                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                    Needs Approved Version
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className="p-2">{row.iso42001_requirement ?? "—"}</td>
                          <td className="p-2">{row.iso42001_status ?? "—"}</td>
                          <td className="p-2">
                            {row.latest_version?.status ?? "—"}
                          </td>
                          <td className="p-2">{formatDate(row.updated_at)}</td>
                          <td className="p-2">
                            <button
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-gray-50"
                              onClick={() => {
                                loadPolicyVersions(row.id);
                                setTimeout(() => {
                                  policyUpdateCardRef.current?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                  });
                                }, 0);
                              }}
                            >
                              Manage Policy
                            </button>
                          </td>
                        </tr>
                      ))}
                      {policies.length === 0 && (
                        <tr>
                          <td
                            className="p-2 text-sm text-gray-500 dark:text-slate-400"
                            colSpan={8}
                          >
                            No policies yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3">
                  <button
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    onClick={approveAllPolicies}
                    disabled={busy || policies.length === 0}
                  >
                    Approve all policies
                  </button>
                  {policyApproveAllNotice && (
                    <div className="mt-2 text-xs font-semibold text-emerald-700">
                      {policyApproveAllNotice}
                    </div>
                  )}
                </div>

                <div
                  ref={policyUpdateCardRef}
                  className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-3 text-xs font-semibold uppercase text-slate-500">
                    MANAGE POLICY
                  </div>
                  {policySelectedId ? (
                    <>
                      <div className="mb-4 rounded-lg border border-slate-200 p-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
                          Policy details
                        </div>
                        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                          <input
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                            placeholder="Version label"
                            value={latestPolicyVersion?.version_label ?? ""}
                            readOnly
                          />
                          <input
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                            placeholder="Version status"
                            value={latestPolicyVersion?.status ?? ""}
                            readOnly
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <label className="text-[11px] font-semibold uppercase text-slate-500">
                            Title
                            <input
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                              title="Title"
                              value={policyDetailsForm.title}
                              onChange={(e) =>
                                setPolicyDetailsForm((prev) => ({
                                  ...prev,
                                  title: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="text-[11px] font-semibold uppercase text-slate-500">
                            Owner role
                            <input
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                              title="Owner role"
                              value={policyDetailsForm.owner_role}
                              onChange={(e) =>
                                setPolicyDetailsForm((prev) => ({
                                  ...prev,
                                  owner_role: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="text-[11px] font-semibold uppercase text-slate-500">
                            Status
                            <select
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                              title="Status"
                              value={policyDetailsForm.status}
                              onChange={(e) =>
                                setPolicyDetailsForm((prev) => ({
                                  ...prev,
                                  status: e.target.value,
                                }))
                              }
                            >
                              <option value="draft">Draft</option>
                              <option value="active">Active</option>
                              <option value="retired">Retired</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </label>
                          <label className="text-[11px] font-semibold uppercase text-slate-500">
                            ISO 42001 requirement
                            <input
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                              title="ISO 42001 requirement"
                              value={policyDetailsForm.iso42001_requirement}
                              onChange={(e) =>
                                setPolicyDetailsForm((prev) => ({
                                  ...prev,
                                  iso42001_requirement: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="text-[11px] font-semibold uppercase text-slate-500">
                            ISO 42001 status
                            <select
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                              title="ISO 42001 status"
                              value={policyDetailsForm.iso42001_status}
                              onChange={(e) =>
                                setPolicyDetailsForm((prev) => ({
                                  ...prev,
                                  iso42001_status: e.target.value,
                                }))
                              }
                            >
                              <option value="Mandatory">Mandatory</option>
                              <option value="Expected">Expected</option>
                              <option value="Considered">Considered</option>
                            </select>
                          </label>
                          <label className="text-[11px] font-semibold uppercase text-slate-500">
                            EU AI Act requirements
                            <input
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                              title="EU AI Act requirements"
                              value={policyDetailsForm.euaiact_requirements}
                              onChange={(e) =>
                                setPolicyDetailsForm((prev) => ({
                                  ...prev,
                                  euaiact_requirements: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="text-[11px] font-semibold uppercase text-slate-500">
                            NIST AI RMF requirements
                            <input
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                              title="NIST AI RMF requirements"
                              value={policyDetailsForm.nistairmf_requirements}
                              onChange={(e) =>
                                setPolicyDetailsForm((prev) => ({
                                  ...prev,
                                  nistairmf_requirements: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="text-[11px] font-semibold uppercase text-slate-500">
                            Action
                            <input
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                              title="Action"
                              value={policyDetailsForm.action}
                              onChange={(e) =>
                                setPolicyDetailsForm((prev) => ({
                                  ...prev,
                                  action: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="text-[11px] font-semibold uppercase text-slate-500">
                            Comment
                            <textarea
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                              rows={2}
                              title="Comment"
                              value={policyDetailsForm.comment}
                              onChange={(e) =>
                                setPolicyDetailsForm((prev) => ({
                                  ...prev,
                                  comment: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="text-[11px] font-semibold uppercase text-slate-500">
                            Content
                            <textarea
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                              rows={4}
                              title="Content"
                              value={latestPolicyContent}
                              onChange={(e) => setLatestPolicyContent(e.target.value)}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-start justify-end gap-3">
                        <div className="flex flex-col items-end gap-1">
                          <button
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-gray-50 disabled:opacity-50"
                            onClick={updateSelectedPolicy}
                            disabled={busy}
                          >
                            Update
                          </button>
                          {policyUpdateNotice && (
                            <div className="text-xs font-semibold text-amber-700">
                              {policyUpdateNotice}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <button
                            className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={handleApprovePolicy}
                            disabled={
                              busy ||
                              !latestPolicyVersion ||
                              latestPolicyVersion.status === "approved"
                            }
                          >
                            Approve
                          </button>
                          {policyApproveNotice && (
                            <div className="text-xs font-semibold text-emerald-700">
                              {policyApproveNotice}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <button
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={handleReviewPolicy}
                            disabled={
                              busy ||
                              !latestPolicyVersion ||
                              latestPolicyVersion.status === "review"
                            }
                          >
                            Review
                          </button>
                          {policyReviewNotice && (
                            <div className="text-xs font-semibold text-slate-600">
                              {policyReviewNotice}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <button
                            className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={handleRetirePolicy}
                            disabled={busy || policyDetailsForm.status === "retired"}
                          >
                            Retire
                          </button>
                          {policyRetireNotice && (
                            <div className="text-xs font-semibold text-amber-700">
                              {policyRetireNotice}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-500">
                      Select a policy to update.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="mb-3 text-xs font-semibold uppercase text-slate-500">
                  Add New Policy
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="Policy title"
                    value={newPolicy.title}
                    onChange={(e) =>
                      setNewPolicy((prev) => ({ ...prev, title: e.target.value }))
                    }
                  />
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="Owner role"
                    value={newPolicy.owner_role}
                    onChange={(e) =>
                      setNewPolicy((prev) => ({ ...prev, owner_role: e.target.value }))
                    }
                  />
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={newPolicy.status}
                    onChange={(e) =>
                      setNewPolicy((prev) => ({ ...prev, status: e.target.value }))
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="retired">Retired</option>
                  </select>
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="ISO 42001 requirement"
                    value={newPolicy.iso42001_requirement}
                    onChange={(e) =>
                      setNewPolicy((prev) => ({
                        ...prev,
                        iso42001_requirement: e.target.value,
                      }))
                    }
                  />
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={newPolicy.iso42001_status}
                    onChange={(e) =>
                      setNewPolicy((prev) => ({
                        ...prev,
                        iso42001_status: e.target.value,
                      }))
                    }
                  >
                    <option value="">ISO 42001 status</option>
                    <option value="Mandatory">Mandatory</option>
                    <option value="Expected">Expected</option>
                    <option value="Considered">Considered</option>
                  </select>
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="Version label (v1)"
                    value={newPolicy.version_label}
                    onChange={(e) =>
                      setNewPolicy((prev) => ({
                        ...prev,
                        version_label: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="Action"
                    value={newPolicy.action}
                    onChange={(e) =>
                      setNewPolicy((prev) => ({ ...prev, action: e.target.value }))
                    }
                  />
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="Template UUID"
                    value={newPolicy.template}
                    onChange={(e) =>
                      setNewPolicy((prev) => ({ ...prev, template: e.target.value }))
                    }
                  />
                  <textarea
                    className="md:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    rows={2}
                    placeholder="Policy content (optional)"
                    value={newPolicy.content}
                    onChange={(e) =>
                      setNewPolicy((prev) => ({ ...prev, content: e.target.value }))
                    }
                  />
                  <textarea
                    className="md:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    rows={2}
                    placeholder="Comment"
                    value={newPolicy.comment}
                    onChange={(e) =>
                      setNewPolicy((prev) => ({ ...prev, comment: e.target.value }))
                    }
                  />
                  <button
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-gray-50"
                    onClick={createPolicy}
                    disabled={busy}
                  >
                    Create
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

      {!embedded && onClose && (
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-gray-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/80">
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      )}

      {selectedEvidence &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {selectedEvidence.name ?? `Evidence ${selectedEvidence.id}`}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedEvidence.mime ?? evidenceTypeOf(selectedEvidence)}
                  </p>
                </div>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                  onClick={() => setSelectedEvidence(null)}
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div>
                  <span className="text-xs uppercase text-slate-500">Project Name</span>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {projectNameFor(selectedEvidence.project_slug)}
                  </div>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-500">Status</span>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {selectedEvidence.status ?? "—"}
                  </div>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-500">Approval Status</span>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {selectedEvidence.approval_status ?? "pending"}
                  </div>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-500">Evidence Source</span>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {selectedEvidence.evidence_source ?? "—"}
                  </div>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-500">Owner Role</span>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {selectedEvidence.owner_role ?? "—"}
                  </div>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-500">Approved By</span>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {selectedEvidence.approved_by ?? "—"}
                  </div>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-500">Last Verified</span>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {formatDate(selectedEvidence.updated_at)}
                  </div>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-500">Approved At</span>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {formatDateTime(selectedEvidence.approved_at)}
                  </div>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-500">Updated By</span>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {selectedEvidence.updated_by ?? "—"}
                  </div>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-500">Last Update</span>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {formatDateTime(selectedEvidence.last_update)}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-3 text-xs font-semibold uppercase text-slate-500">
                  Action
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-emerald-300 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/60 dark:text-emerald-200 dark:hover:bg-emerald-900/30"
                    onClick={() => updateEvidenceApproval(selectedEvidence.id, "approved")}
                    disabled={selectedEvidence.approval_status === "approved"}
                  >
                    Approve
                  </button>
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={() => updateEvidenceApproval(selectedEvidence.id, "pending")}
                    disabled={
                      !selectedEvidence.approval_status ||
                      selectedEvidence.approval_status === "pending"
                    }
                  >
                    Revoke Approval
                  </button>
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-800 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={() => {
                      void recordEvidenceAction(selectedEvidence.id, "opened");
                      openUrl(selectedEvidence.download_url);
                    }}
                    disabled={!selectedEvidence.download_url}
                  >
                    Open
                  </button>
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-800 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={() => {
                      void recordEvidenceAction(selectedEvidence.id, "closed");
                      setSelectedEvidence(null);
                    }}
                  >
                    Close
                  </button>
                  <button
                    className="rounded-lg border border-amber-300 px-3 py-1 text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-200 dark:hover:bg-amber-900/30"
                    onClick={() => updateEvidenceStatus(selectedEvidence.id, "flagged")}
                  >
                    Flag
                  </button>
                  <button
                    className="rounded-lg border border-rose-300 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-500/60 dark:text-rose-200 dark:hover:bg-rose-900/30"
                    onClick={() => updateEvidenceApproval(selectedEvidence.id, "rejected")}
                  >
                    Reject
                  </button>
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={() => createArtifactFromEvidence(selectedEvidence.id)}
                    disabled={busy || !isS3Uri(selectedEvidence.uri)}
                    title={
                      isS3Uri(selectedEvidence.uri)
                        ? "Create provenance artifact from this evidence"
                        : "Evidence must be stored in S3 to create an artifact"
                    }
                  >
                    Create Artifact
                  </button>
                  <button
                    className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-500/60 dark:text-red-100 dark:hover:bg-red-900/60"
                    onClick={() => {
                      deleteEvidence(selectedEvidence.id);
                      setSelectedEvidence(null);
                    }}
                  >
                    Archive
                  </button>
                </div>
              </div>

              <div className="mt-5 w-full rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Capture comments and attached document
                </div>
                <textarea
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  rows={3}
                  placeholder="Add comments for this evidence..."
                  value={evidenceComment}
                  onChange={(e) => setEvidenceComment(e.target.value)}
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    className="text-xs text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-400 dark:file:bg-slate-800 dark:file:text-slate-100"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setEvidenceAttachment(file);
                    }}
                  />
                  {evidenceAttachment && (
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      Attached: {evidenceAttachment.name}
                    </span>
                  )}
                  {selectedEvidence.attachment_name && (
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                      onClick={() =>
                        selectedEvidence.attachment_download_url &&
                        download(
                          selectedEvidence.attachment_download_url,
                          selectedEvidence.attachment_name
                        )
                      }
                      disabled={!selectedEvidence.attachment_download_url}
                      title="Download last attached document"
                    >
                      Download last attachment
                    </button>
                  )}
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                    disabled={busy || (!evidenceComment && !evidenceAttachment)}
                    onClick={() => saveEvidenceNote(selectedEvidence)}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {kpiDetailOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
                <div>
                  <div className="text-xs uppercase text-slate-500">
                    Knowledge Base KPI
                  </div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {kpiDetail?.kpi_name ?? "KPI Details"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {kpiDetail?.kpi_key?.toUpperCase?.() ?? ""}
                  </div>
                </div>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                  onClick={closeKpiDetail}
                >
                  Close
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                {kpiDetailLoading ? (
                  <div>Loading KPI details…</div>
                ) : kpiDetailError ? (
                  <div className="text-red-600">{kpiDetailError}</div>
                ) : kpiDetail ? (
                  <>
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-500">
                        Description
                      </div>
                      <div className="whitespace-pre-line">
                        {kpiDetail.description || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-500">
                        Definition
                      </div>
                      <div className="whitespace-pre-line">
                        {kpiDetail.definition || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-500">
                        Example
                      </div>
                      <div className="whitespace-pre-line">
                        {kpiDetail.example || "—"}
                      </div>
                    </div>
                  </>
                ) : (
                  <div>No KPI data available.</div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {requiredKpiDiffOpen &&
        requiredKpiDiff &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 dark:border-slate-700">
                <div>
                  <div className="text-xs uppercase text-slate-500">
                    KPI Keys Summary
                  </div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Required KPI Keys
                  </div>
                  <div className="text-xs text-slate-500">
                    Existing: {requiredKpiDiff.existing} · New:{" "}
                    {requiredKpiDiff.newCount} · To remove:{" "}
                    {requiredKpiDiff.removed}
                  </div>
                </div>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                  onClick={() => setRequiredKpiDiffOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-slate-700 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-slate-200">
                  <div className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-200">
                    Existing KPIs
                  </div>
                  {requiredKpiDiff.existingKeys.length ? (
                    <ul className="mt-2 space-y-1 text-xs">
                      {requiredKpiDiff.existingKeys.map((key) => (
                        <li key={`existing-${key}`} className="break-all">
                          {key}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-xs text-slate-500">None</div>
                  )}
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-sm text-slate-700 dark:border-indigo-500/30 dark:bg-indigo-900/20 dark:text-slate-200">
                  <div className="text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-200">
                    New KPIs to Add
                  </div>
                  {requiredKpiDiff.newKeys.length ? (
                    <ul className="mt-2 space-y-1 text-xs">
                      {requiredKpiDiff.newKeys.map((key) => (
                        <li key={`new-${key}`} className="break-all">
                          {key}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-xs text-slate-500">None</div>
                  )}
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-slate-700 dark:border-rose-500/30 dark:bg-rose-900/20 dark:text-slate-200">
                  <div className="text-xs font-semibold uppercase text-rose-700 dark:text-rose-200">
                    KPIs to Remove
                  </div>
                  {requiredKpiDiff.removedKeys.length ? (
                    <ul className="mt-2 space-y-1 text-xs">
                      {requiredKpiDiff.removedKeys.map((key) => (
                        <li key={`removed-${key}`} className="break-all">
                          {key}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-xs text-slate-500">None</div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {govReportOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
            <div id="gov-req-report" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900">
              <style jsx global>{`
                @media print {
                  .no-print {
                    display: none !important;
                  }
                  body * {
                    visibility: hidden;
                  }
                  #gov-req-report,
                  #gov-req-report * {
                    visibility: visible;
                  }
                  #gov-req-report {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    max-height: none !important;
                  }
                }
              `}</style>
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                <div>
                  <div className="text-xs uppercase text-slate-500">
                    Governance Requirements Report
                  </div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {govReportMeta?.project_name ?? "Project Report"}
                  </div>
                  {govReportMeta && (
                    <div className="text-xs text-slate-500">
                      Provider: {govReportMeta.provider} · Model: {govReportMeta.model} ·
                      Generated: {govReportMeta.generated_at}
                    </div>
                  )}
                </div>
                <div className="no-print flex items-center gap-2">
                  <button
                    className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                    onClick={handleGovReportPrint}
                  >
                    Export to PDF
                  </button>
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                    onClick={() => setGovReportOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto px-6 py-4">
                {govReportError ? (
                  <div className="text-sm text-rose-600">{govReportError}</div>
                ) : govReport ? (
                  <div className="space-y-6">
                    <div className="prose max-w-none text-sm dark:prose-invert">
                      <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                        {govReport}
                      </ReactMarkdown>
                    </div>
                    {govReportSources.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <div className="text-xs font-semibold uppercase text-slate-500">
                          Sources Used
                        </div>
                        <ul className="mt-2 space-y-1 text-xs">
                          {govReportSources.map((src, idx) => {
                            const label =
                              src?.title || src?.file_name || "Untitled source";
                            const metaParts = [
                              src?.source_type ? `type: ${src.source_type}` : null,
                              src?.file_name && src?.title ? `file: ${src.file_name}` : null,
                            ].filter(Boolean);
                            return (
                              <li key={`gov-src-${idx}`} className="flex flex-col">
                                <span className="font-medium text-slate-800 dark:text-slate-100">
                                  {label}
                                </span>
                                {metaParts.length > 0 && (
                                  <span className="text-slate-500">
                                    {metaParts.join(" · ")}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No report content.</div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {policyContentModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[60] bg-black/60">
            <div className="flex h-full w-full flex-col bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                <div>
                  <div className="text-sm uppercase text-slate-500">
                    {policyTitleFor(policySelectedId)}
                  </div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {policyContentModal.version_label} ·{" "}
                    {policyContentModal.status ?? "draft"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDate(policyContentModal.created_at)}
                  </div>
                </div>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                  onClick={() => setPolicyContentModal(null)}
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <div className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
                  {policyContentModal.content || "No policy content available."}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );

  return embedded ? (
    content
  ) : (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      {content}
    </div>
  );
}
