// apps/web/src/app/ai_legal_standing/page.tsx
"use client";

import { FormEvent, useState, useEffect, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ThemeProvider } from "../theme-provider";

type AssessmentPayload = {
  provider: boolean;
  deployer: boolean;
  importer: boolean;
  distributor: boolean;
  authorized_representative: boolean;
  substantial_modifier: boolean;
  product_manufacturer: boolean;
  non_eu_rep_appointed: boolean;
  distributor_access: boolean;
  importer_non_original: boolean;
  provide_as_is: boolean;
  in_scope_ai: boolean;
  prohibited_practices: boolean;
  safety_component: boolean;
  annex_iii_sensitive: boolean;
  narrow_procedural: boolean;
  profiling: boolean;
};

type AssessmentSelection = {
  [K in keyof AssessmentPayload]: boolean | null;
};

type AssessmentResult = {
  primary_role: string;
  roles: string[];
  risk_classification: string;
  obligations: string[];
  warnings: string[];
  responsibilities_by_role: Record<string, string[]>;
  responsibilities_summary: { role: string; key_focus: string; responsibility_level: string }[];
  decision_trace: { decision: string; citation: string }[];
};

type UserInfo = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
};

type FastApiErrorItem = {
  loc?: unknown;
  msg?: unknown;
  type?: unknown;
};

function formatFastApiDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return null;
  const parts = detail
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const typed = item as FastApiErrorItem;
      const loc = Array.isArray(typed.loc)
        ? typed.loc.map((segment) => String(segment)).join(".")
        : "";
      const msg = typeof typed.msg === "string" ? typed.msg : "";
      if (loc && msg) return `${loc}: ${msg}`;
      return msg || loc || null;
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join("; ") : null;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ignore and fall back
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function serializeErrorDetails(payload: {
  status: number;
  errorBody: unknown;
}): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}


function normalizeResult(
  result: AssessmentResult | null
): AssessmentResult | null {
  if (!result) return null;
  return {
    ...result,
    roles: Array.isArray(result.roles) ? result.roles : [],
    obligations: Array.isArray(result.obligations) ? result.obligations : [],
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    responsibilities_by_role: result.responsibilities_by_role ?? {},
    responsibilities_summary: Array.isArray(result.responsibilities_summary)
      ? result.responsibilities_summary
      : [],
    decision_trace: Array.isArray(result.decision_trace)
      ? result.decision_trace
      : [],
  };
}

function LegalStandingHeader() {
  const t = useTranslations("AiLegalStanding");
  return (
    <header
      className="
        rounded-3xl border border-slate-200/80
        bg-gradient-to-r from-indigo-600 to-blue-500
        p-4 text-white shadow-lg sm:p-6
        dark:border-slate-700/70
        dark:from-slate-900 dark:via-slate-900 dark:to-slate-950
      "
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="https://www.theleadai.co.uk/"
          className="flex items-center gap-3"
          aria-label={t("header.aria.home")}
        >
          <Image
            src="/LeadAI.webp"
            alt={t("header.logoAlt")}
            width={60}
            height={60}
            className="rounded-lg ring-1 ring-white/40 dark:ring-slate-700"
          />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/80 dark:text-slate-300">
              {t("header.subtitle")}
            </div>
            <div className="text-xl font-semibold text-white dark:text-slate-50 sm:text-2xl">
              {t("header.title")}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="https://www.theleadai.co.uk/"
            className="rounded-xl bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-white dark:border dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-700"
            title={t("header.returnTitle")}
          >
            {t("header.returnHome")}
          </Link>
        </div>
      </div>

      <p className="mt-3 max-w-2xl text-sm text-white/80 dark:text-slate-300">
        {t("header.description")}
      </p>
    </header>
  );
}

function pageShell(content: ReactNode, widthClass: string) {
  return (
    <ThemeProvider>
      <main className="min-h-screen bg-[var(--background)] px-6 py-12 text-slate-900 transition dark:text-slate-100">
        <div className={`mx-auto w-full ${widthClass} space-y-8`}>
          <LegalStandingHeader />
          {content}
        </div>
      </main>
    </ThemeProvider>
  );
}

const buildQuestions = (t: (key: string) => string) => [
  {
    key: "provider",
    section: "role",
    label: t("questions.provider.label"),
    description: t("questions.provider.description"),
    purpose: t("questions.provider.purpose"),
    explanation: t("questions.provider.explanation"),
  },
  {
    key: "deployer",
    section: "role",
    label: t("questions.deployer.label"),
    description: t("questions.deployer.description"),
    purpose: t("questions.deployer.purpose"),
    explanation: t("questions.deployer.explanation"),
  },
  {
    key: "importer",
    section: "role",
    label: t("questions.importer.label"),
    description: t("questions.importer.description"),
    purpose: t("questions.importer.purpose"),
    explanation: t("questions.importer.explanation"),
  },
  {
    key: "distributor",
    section: "role",
    label: t("questions.distributor.label"),
    description: t("questions.distributor.description"),
    purpose: t("questions.distributor.purpose"),
    explanation: t("questions.distributor.explanation"),
  },
  {
    key: "authorized_representative",
    section: "role",
    label: t("questions.authorized_representative.label"),
    description: t("questions.authorized_representative.description"),
    purpose: t("questions.authorized_representative.purpose"),
    explanation: t("questions.authorized_representative.explanation"),
  },
  {
    key: "product_manufacturer",
    section: "role",
    label: t("questions.product_manufacturer.label"),
    description: t("questions.product_manufacturer.description"),
    purpose: t("questions.product_manufacturer.purpose"),
    explanation: t("questions.product_manufacturer.explanation"),
  },
  {
    key: "non_eu_rep_appointed",
    section: "role",
    label: t("questions.non_eu_rep_appointed.label"),
    description: t("questions.non_eu_rep_appointed.description"),
    purpose: t("questions.non_eu_rep_appointed.purpose"),
    explanation: t("questions.non_eu_rep_appointed.explanation"),
  },
  {
    key: "distributor_access",
    section: "role",
    label: t("questions.distributor_access.label"),
    description: t("questions.distributor_access.description"),
    purpose: t("questions.distributor_access.purpose"),
    explanation: t("questions.distributor_access.explanation"),
  },
  {
    key: "importer_non_original",
    section: "role",
    label: t("questions.importer_non_original.label"),
    description: t("questions.importer_non_original.description"),
    purpose: t("questions.importer_non_original.purpose"),
    explanation: t("questions.importer_non_original.explanation"),
  },
  {
    key: "provide_as_is",
    section: "role",
    label: t("questions.provide_as_is.label"),
    description: t("questions.provide_as_is.description"),
    purpose: t("questions.provide_as_is.purpose"),
    explanation: t("questions.provide_as_is.explanation"),
  },
  {
    key: "substantial_modifier",
    section: "role",
    label: t("questions.substantial_modifier.label"),
    description: t("questions.substantial_modifier.description"),
    purpose: t("questions.substantial_modifier.purpose"),
    explanation: t("questions.substantial_modifier.explanation"),
  },
  {
    key: "in_scope_ai",
    section: "risk",
    label: t("questions.in_scope_ai.label"),
    description: t("questions.in_scope_ai.description"),
    purpose: t("questions.in_scope_ai.purpose"),
    explanation: t("questions.in_scope_ai.explanation"),
  },
  {
    key: "prohibited_practices",
    section: "risk",
    label: t("questions.prohibited_practices.label"),
    description: t("questions.prohibited_practices.description"),
    purpose: t("questions.prohibited_practices.purpose"),
    explanation: t("questions.prohibited_practices.explanation"),
  },
  {
    key: "safety_component",
    section: "risk",
    label: t("questions.safety_component.label"),
    description: t("questions.safety_component.description"),
    purpose: t("questions.safety_component.purpose"),
    explanation: t("questions.safety_component.explanation"),
  },
  {
    key: "annex_iii_sensitive",
    section: "risk",
    label: t("questions.annex_iii_sensitive.label"),
    description: t("questions.annex_iii_sensitive.description"),
    purpose: t("questions.annex_iii_sensitive.purpose"),
    explanation: t("questions.annex_iii_sensitive.explanation"),
  },
  {
    key: "narrow_procedural",
    section: "risk",
    label: t("questions.narrow_procedural.label"),
    description: t("questions.narrow_procedural.description"),
    purpose: t("questions.narrow_procedural.purpose"),
    explanation: t("questions.narrow_procedural.explanation"),
  },
  {
    key: "profiling",
    section: "risk",
    label: t("questions.profiling.label"),
    description: t("questions.profiling.description"),
    purpose: t("questions.profiling.purpose"),
    explanation: t("questions.profiling.explanation"),
  },
] as const;


const DEFAULT_PAYLOAD: AssessmentPayload = {
  provider: false,
  deployer: false,
  importer: false,
  distributor: false,
  authorized_representative: false,
  substantial_modifier: false,
  product_manufacturer: false,
  non_eu_rep_appointed: false,
  distributor_access: false,
  importer_non_original: false,
  provide_as_is: true,
  in_scope_ai: false,
  prohibited_practices: false,
  safety_component: false,
  annex_iii_sensitive: false,
  narrow_procedural: false,
  profiling: false,
};

const ASSESSMENT_RESULT_STORAGE_KEY = "ai_legal_standing_assessment_result";
const CAPTURED_BY_EMAIL_STORAGE_KEY = "ai_legal_standing_captured_by_email";
const ASSESSMENT_SUBMISSION_ID_STORAGE_KEY =
  "ai_legal_standing_submission_id";

export default function AiLegalStandingPage() {
  const t = useTranslations("AiLegalStanding");
  const searchParams = useSearchParams();
  const questions = buildQuestions(t);
  const skipIntro = searchParams.get("skipIntro") === "true";
  const entityIdParam = searchParams.get("entityId");
  const entitySlugParam = searchParams.get("entitySlug");
  const [hasStarted, setHasStarted] = useState(false);
  const [resolvedEntityId, setResolvedEntityId] = useState<string | null>(null);
  const [resolvedEntitySlug, setResolvedEntitySlug] = useState<string | null>(
    null
  );

  useEffect(() => {
    // If coming from Entity page, skip intro and load entity profile data
    if (skipIntro) {
      const entityProfile = sessionStorage.getItem("entityProfile");
      if (entityProfile) {
        try {
          const profile = JSON.parse(entityProfile);
          // Pre-fill user info from entity profile if available
          if (profile.fullLegalName) {
            const fallbackEmail =
              profile.authorizedRepresentativeEmail ||
              profile.aiComplianceOfficerEmail ||
              profile.executiveSponsorEmail ||
              "";
            const nameParts = profile.fullLegalName.split(" ");
            setUserInfo({
              firstName: nameParts[0] || "",
              lastName: nameParts.slice(1).join(" ") || "",
              email: fallbackEmail,
              company: profile.fullLegalName,
            });
            if (fallbackEmail && typeof window !== "undefined") {
              sessionStorage.setItem(CAPTURED_BY_EMAIL_STORAGE_KEY, fallbackEmail);
            }
          }
        } catch (e) {
          console.error("Failed to parse entity profile", e);
        }
      }
      setHasStarted(true);
    }
  }, [skipIntro]);

  useEffect(() => {
    const storedId =
      typeof window !== "undefined" ? sessionStorage.getItem("entityId") : null;
    const storedSlug =
      typeof window !== "undefined" ? sessionStorage.getItem("entitySlug") : null;
    if (entityIdParam) {
      setResolvedEntityId(entityIdParam);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("entityId", entityIdParam);
      }
    } else if (storedId) {
      setResolvedEntityId(storedId);
    }
    if (entitySlugParam) {
      setResolvedEntitySlug(entitySlugParam);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("entitySlug", entitySlugParam);
      }
    } else if (storedSlug) {
      setResolvedEntitySlug(storedSlug);
    }
  }, [entityIdParam, entitySlugParam]);
  const [introCopied, setIntroCopied] = useState(false);
  const [payload, setPayload] =
    useState<AssessmentSelection>({
      provider: null,
      deployer: null,
      importer: null,
      distributor: null,
      authorized_representative: null,
      substantial_modifier: null,
      product_manufacturer: null,
      non_eu_rep_appointed: null,
      distributor_access: null,
      importer_non_original: null,
      provide_as_is: null,
      in_scope_ai: null,
      prohibited_practices: null,
      safety_component: null,
      annex_iii_sensitive: null,
      narrow_procedural: null,
      profiling: null,
    });
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [errorDetailsCopied, setErrorDetailsCopied] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string | null>(
    null
  );
  const [missingQuestions, setMissingQuestions] = useState<string[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
  });
  const [saveEntityLoading, setSaveEntityLoading] = useState(false);
  const [saveEntityError, setSaveEntityError] = useState<string | null>(null);

  const handleSelect = (key: keyof AssessmentPayload, value: boolean) => {
    setPayload((prev) => ({ ...prev, [key]: value }));
  };

  const handleIntroShare = async () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/ai_legal_standing`;

    try {
      if (navigator.share) {
        await navigator.share({
          url,
          title: t("share.title"),
          text: t("share.text"),
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setIntroCopied(true);
        setTimeout(() => setIntroCopied(false), 2500);
      } else {
        const subject = encodeURIComponent(t("share.title"));
        const body = encodeURIComponent(t("share.emailBody", { url }));
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      }
    } catch {
      // ignore
    }
  };

  const handleIntroEmailShare = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/ai_legal_standing`;
    const subject = encodeURIComponent(t("share.title"));
    const body = encodeURIComponent(t("share.emailBody", { url }));
    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
    const popup = window.open(gmailComposeUrl, "_blank", "noopener,noreferrer");
    if (!popup) {
      // Fallback when popup is blocked by browser policy.
      window.location.href = gmailComposeUrl;
    }
  };

  const handleStart = (event: FormEvent) => {
    event.preventDefault();
    if (typeof window !== "undefined" && userInfo.email.trim()) {
      sessionStorage.setItem(
        CAPTURED_BY_EMAIL_STORAGE_KEY,
        userInfo.email.trim()
      );
    }
    setHasStarted(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setValidationWarning(null);
    setMissingQuestions([]);
    setErrorDetails(null);
    setErrorDetailsCopied(false);

    const unanswered = Object.entries(payload).filter(([key, value]) => {
      if (value !== null) return false;
      if (key === "in_scope_ai") return true;
      if (
        payload.in_scope_ai === false &&
        questions.find((q) => q.key === key)?.section === "risk"
      ) {
        return false;
      }
      return true;
    });
    if (unanswered.length > 0) {
      setValidationWarning(
        t("validation.warning")
      );
      const missingLabels = questions.filter((q) =>
        unanswered.some(([key]) => key === q.key)
      ).map((q) => q.label);
      setMissingQuestions(missingLabels);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const normalizedPayload = Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [key, Boolean(value)])
      ) as AssessmentPayload;

      if (process.env.NODE_ENV !== "production") {
        console.info("AI legal standing payload", normalizedPayload);
      }

      const response = await fetch("/api/core/ai-legal-standing/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedPayload),
      });

      if (!response.ok) {
        const errorBody = await readResponseBody(response);
        const detail =
          errorBody && typeof errorBody === "object" && "detail" in errorBody
            ? (errorBody as { detail?: unknown }).detail
            : null;
        const detailMessage = formatFastApiDetail(detail);
        console.error("AI legal standing assess failed", {
          status: response.status,
          errorBody,
          payload: normalizedPayload,
        });
        setErrorDetails(
          serializeErrorDetails({
            status: response.status,
            errorBody,
          })
        );
        const message = detailMessage
          ? t("errors.assessmentFailedDetail", {
              status: response.status,
              detail: detailMessage,
            })
          : t("errors.assessmentFailed", { status: response.status });
        throw new Error(message);
      }

      const data = normalizeResult((await response.json()) as AssessmentResult);
      setResult(data);
      
      if (data) {
        const entityContext = await resolveEntityContext();
        if (!entityContext.id && typeof window !== "undefined") {
          const submissionRes = await fetch("/api/core/ai-legal-standing/submissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              firstName: userInfo.firstName.trim(),
              lastName: userInfo.lastName.trim(),
              email: userInfo.email.trim(),
              company: userInfo.company.trim() || null,
              answers: normalizedPayload,
              result: data,
              entityId: null,
            }),
          });
          if (!submissionRes.ok) {
            const errorBody = await readResponseBody(submissionRes);
            const detail =
              errorBody && typeof errorBody === "object" && "detail" in errorBody
                ? (errorBody as { detail?: unknown }).detail
                : null;
            const detailMessage = formatFastApiDetail(detail);
            throw new Error(
              detailMessage || `Failed to store legal standing submission (${submissionRes.status})`
            );
          }
          const submissionData = (await submissionRes.json().catch(() => ({}))) as {
            id?: string;
          };
          if (submissionData.id) {
            sessionStorage.setItem(
              ASSESSMENT_SUBMISSION_ID_STORAGE_KEY,
              submissionData.id
            );
          }
          sessionStorage.setItem(
            ASSESSMENT_RESULT_STORAGE_KEY,
            JSON.stringify(data)
          );
          window.location.href = "/ai_legal_standing_assessment";
          return;
        }
        await persistAssessment(data, { redirect: false });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("errors.assessmentFailedFallback")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolveEntityContext = async () => {
    const storedId =
      typeof window !== "undefined" ? sessionStorage.getItem("entityId") : null;
    if (storedId) {
      return {
        id: storedId,
        slug:
          (typeof window !== "undefined" &&
            sessionStorage.getItem("entitySlug")) ||
          entitySlugParam ||
          null,
      };
    }
    if (resolvedEntityId) {
      return { id: resolvedEntityId, slug: resolvedEntitySlug || entitySlugParam || null };
    }
    const slug = resolvedEntitySlug || entitySlugParam;
    if (!slug) return { id: null, slug: null };
    try {
      const res = await fetch(
        `/api/core/entity/by-slug/${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return { id: null, slug };
      const data = (await res.json()) as { id?: string };
      if (data?.id && typeof window !== "undefined") {
        sessionStorage.setItem("entityId", data.id);
        sessionStorage.setItem("entitySlug", slug);
      }
      setResolvedEntityId(data?.id ?? null);
      setResolvedEntitySlug(slug);
      return { id: data?.id ?? null, slug };
    } catch {
      return { id: null, slug };
    }
  };

  const persistAssessment = async (
    assessmentResult: AssessmentResult,
    opts?: { redirect?: boolean }
  ) => {
    setSaveEntityError(null);
    setSaveEntityLoading(true);
    const decisionTraceText = assessmentResult.decision_trace
      .map((item) => `${item.decision} (${item.citation})`)
      .join("\n");
    try {
      const { id: entityId, slug: entitySlug } = await resolveEntityContext();
      const entityProfileRaw = typeof window !== "undefined" ? sessionStorage.getItem("entityProfile") : null;
      const entityProfile = entityProfileRaw ? JSON.parse(entityProfileRaw) : null;

      if (entityId) {
        const res = await fetch(`/api/core/entity/${entityId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            primaryRole: assessmentResult.primary_role,
            riskClassification: assessmentResult.risk_classification,
            decisionTrace: decisionTraceText,
            legalStandingResult: assessmentResult,
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const msg = typeof errBody.detail === "string" ? errBody.detail : "Failed to update entity";
          throw new Error(msg);
        }
      } else if (entityProfile && entityProfile.fullLegalName && entityProfile.headquartersCountry) {
        const res = await fetch("/api/core/entity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullLegalName: entityProfile.fullLegalName,
            legalForm: entityProfile.legalForm || null,
            companyRegistrationNumber: entityProfile.companyRegistrationNumber || null,
            headquartersCountry: entityProfile.headquartersCountry,
            website: entityProfile.website || null,
            regionsOfOperation: entityProfile.regionsOfOperation || [],
            regionsOther: entityProfile.regionsOther || null,
            sectors: entityProfile.sectors || [],
            sectorOther: entityProfile.sectorOther || null,
            employeeCount: entityProfile.employeeCount || null,
            annualTurnover: entityProfile.annualTurnover || null,
            authorizedRepresentativeName: entityProfile.authorizedRepresentativeName || null,
            authorizedRepresentativeEmail: entityProfile.authorizedRepresentativeEmail || null,
            authorizedRepresentativePhone: entityProfile.authorizedRepresentativePhone || null,
            aiComplianceOfficerName: entityProfile.aiComplianceOfficerName || null,
            aiComplianceOfficerEmail: entityProfile.aiComplianceOfficerEmail || null,
            executiveSponsorName: entityProfile.executiveSponsorName || null,
            executiveSponsorEmail: entityProfile.executiveSponsorEmail || null,
            primaryRole: assessmentResult.primary_role,
            riskClassification: assessmentResult.risk_classification,
            decisionTrace: decisionTraceText,
            legalStandingResult: assessmentResult,
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const msg = typeof errBody.detail === "string" ? errBody.detail : "Failed to save entity";
          throw new Error(msg);
        }
        const data = await res.json();
        if (data?.id && typeof window !== "undefined") sessionStorage.setItem("entityId", data.id);
      } else {
        setSaveEntityError("Complete the Entity form first, then return here.");
        setSaveEntityLoading(false);
        return;
      }
      if (opts?.redirect && typeof window !== "undefined") {
        const targetSlug =
          entitySlug || resolvedEntitySlug || entitySlugParam || null;
        window.location.href = targetSlug
          ? `/${encodeURIComponent(targetSlug)}/scorecard/admin/governance-setup/entity-setup`
          : "/scorecard/admin/governance-setup/entity-setup";
      }
    } catch (err) {
      setSaveEntityError(err instanceof Error ? err.message : "Failed to save entity information.");
    } finally {
      setSaveEntityLoading(false);
    }
  };

  const handleSaveEntityInformation = async () => {
    if (!result) return;
    await persistAssessment(result, { redirect: true });
  };

  const formatDecisionLabel = (item: { decision: string; citation?: string }) =>
    item.citation ? `${item.decision} (${item.citation})` : item.decision;

  const renderSummaryDetails = () => {
    if (!result) {
      return (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          {t("summary.empty")}
        </p>
      );
    }

    const responsibilitiesByRole =
      result.responsibilities_by_role ?? {};
    const obligations = Array.isArray(result.obligations)
      ? result.obligations
      : [];
    const responsibilitiesSummary = Array.isArray(result.responsibilities_summary)
      ? result.responsibilities_summary
      : [];
    const warnings = Array.isArray(result.warnings) ? result.warnings : [];
    const decisionTrace = Array.isArray(result.decision_trace)
      ? result.decision_trace
      : [];

    return (
      <div className="mt-4 space-y-4 text-sm text-slate-700 dark:text-slate-200">
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
            {t("summary.primaryRole")}
          </p>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {result.primary_role}
          </p>
          {result.roles?.length ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("summary.roles", { roles: result.roles.join(", ") })}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
            {t("summary.riskClassification")}
          </p>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {result.risk_classification}
          </p>
        </div>
        {Object.keys(responsibilitiesByRole).length > 0 && (
          <div>
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
              {t("summary.keyResponsibilities")}
            </p>
            <div className="mt-2 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              {Object.entries(responsibilitiesByRole).map(([role, items]) => (
                <div key={role}>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {role}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {(items ?? []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        {obligations.length > 0 && (
          <div>
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
              {t("summary.obligations")}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {obligations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {responsibilitiesSummary.length > 0 && (
          <div>
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
              {t("summary.responsibilitySummary")}
            </p>
            <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              {responsibilitiesSummary.map((row) => (
                <div
                  key={row.role}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {row.role}: {row.key_focus}
                  </p>
                  <p>{row.responsibility_level}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
            {warnings.join(" ")}
          </div>
        )}
        {decisionTrace.length > 0 && (
          <div>
            <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
              {t("summary.decisionTrace")}
            </p>
            <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              {decisionTrace.map((item, idx) => (
                <li key={`${item.decision}-${idx}`}>
                  {formatDecisionLabel(item)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const isIntroValid =
    userInfo.firstName.trim() &&
    userInfo.lastName.trim() &&
    userInfo.email.trim();

  if (!hasStarted) {
    return pageShell(
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg dark:border-slate-700/70 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {t("intro.title")}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {t("intro.subtitle")}
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleIntroShare}
              className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {introCopied ? t("share.linkCopied") : t("share.label")}
            </button>
            <button
              type="button"
              onClick={handleIntroEmailShare}
              className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              E-posta ile paylaş
            </button>
          </div>
        </div>

        <form onSubmit={handleStart} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("form.name")}
              </label>
              <input
                type="text"
                autoComplete="given-name"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
                value={userInfo.firstName}
                onChange={(e) =>
                  setUserInfo((prev) => ({
                    ...prev,
                    firstName: e.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("form.surname")}
              </label>
              <input
                type="text"
                autoComplete="family-name"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
                value={userInfo.lastName}
                onChange={(e) =>
                  setUserInfo((prev) => ({
                    ...prev,
                    lastName: e.target.value,
                  }))
                }
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("form.email")}
              </label>
              <input
                type="email"
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
                value={userInfo.email}
                onChange={(e) =>
                  setUserInfo((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("form.company")}
              </label>
              <input
                type="text"
                autoComplete="organization"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
                value={userInfo.company}
                onChange={(e) =>
                  setUserInfo((prev) => ({
                    ...prev,
                    company: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("form.disclaimer")}
            </p>
            <button
              type="submit"
              disabled={!isIntroValid}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("form.start")}
            </button>
          </div>
        </form>
      </div>,
      "max-w-5xl"
    );
  }

  return pageShell(
    <div className="flex w-full flex-col gap-10 lg:flex-row">
      <section className="flex-1 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {t("survey.title")}
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {t("survey.description")}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              {t("survey.sections.role")}
            </h2>
            <div className="mt-4 space-y-4">
                {questions.filter((q) => q.section === "role").map((q) => (
                <div
                  key={q.key}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/70 dark:bg-slate-900/60"
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {q.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {q.description}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-semibold">{q.purpose}</p>
                    <p>{q.explanation}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      <input
                        type="radio"
                        name={q.key}
                        checked={payload[q.key] === true}
                        onChange={() => handleSelect(q.key, true)}
                        className="h-3.5 w-3.5"
                      />
                      {t("labels.yes")}
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      <input
                        type="radio"
                        name={q.key}
                        checked={payload[q.key] === false}
                        onChange={() => handleSelect(q.key, false)}
                        className="h-3.5 w-3.5"
                      />
                      {t("labels.no")}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              {t("survey.sections.risk")}
            </h2>
            <div className="mt-4 space-y-4">
                {questions.filter((q) => q.section === "risk").map((q) => (
                <div
                  key={q.key}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/70 dark:bg-slate-900/60"
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {q.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {q.description}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-semibold">{q.purpose}</p>
                    <p>{q.explanation}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      <input
                        type="radio"
                        name={q.key}
                        checked={payload[q.key] === true}
                        onChange={() => handleSelect(q.key, true)}
                        className="h-3.5 w-3.5"
                      />
                      {t("labels.yes")}
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      <input
                        type="radio"
                        name={q.key}
                        checked={payload[q.key] === false}
                        onChange={() => handleSelect(q.key, false)}
                        className="h-3.5 w-3.5"
                      />
                      {t("labels.no")}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {validationWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
              <p>{validationWarning}</p>
              {missingQuestions.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-900 dark:text-amber-200">
                  {missingQuestions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">
              <p>{error}</p>
              {errorDetails && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyToClipboard(errorDetails);
                    setErrorDetailsCopied(ok);
                    setTimeout(() => setErrorDetailsCopied(false), 2500);
                  }}
                  className="inline-flex items-center rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 dark:border-red-400/40 dark:bg-slate-900 dark:text-red-200 dark:hover:bg-slate-800"
                >
                  {errorDetailsCopied
                    ? t("errors.detailsCopied")
                    : t("errors.copyDetails")}
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={(e) => handleSubmit(e)}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? t("buttons.assessing") : t("buttons.generateAndSave")}
            </button>
          </div>
        </form>
      </section>

      <aside className="w-full lg:w-[360px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t("summary.title")}
          </h2>
          {renderSummaryDetails()}
          {result && (
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              {saveEntityError && (
                <p className="mb-3 text-xs text-red-600 dark:text-red-400">
                  {saveEntityError}
                </p>
              )}
              <button
                type="button"
                onClick={handleSaveEntityInformation}
                disabled={saveEntityLoading}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saveEntityLoading ? t("buttons.assessing") : t("buttons.goNextStep")}
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>,
    "max-w-6xl"
  );
}
