// apps/web/src/app/entity/page.tsx
"use client";

import { FormEvent, useState, useEffect, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ThemeProvider } from "../theme-provider";

type EntityProfile = {
  // Core Entity Identifiers
  capturedBy: string;
  fullLegalName: string;
  legalForm: string;
  companyRegistrationNumber: string;
  headquartersCountry: string;
  website: string;
  
  // Operational Scope & Footprint
  regionsOfOperation: string[];
  regionsOther: string;
  sectors: string[];
  sectorOther: string;
  
  // Company Size & Classification
  employeeCount: string;
  annualTurnover: string;
  marketRole: string;
  
  // Key Compliance Personnel
  authorizedRepresentativeName: string;
  authorizedRepresentativeEmail: string;
  authorizedRepresentativePhone: string;
  aiComplianceOfficerName: string;
  aiComplianceOfficerEmail: string;
  executiveSponsorName: string;
  executiveSponsorEmail: string;
};

const EU_COUNTRIES = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
  "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
  "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands",
  "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden"
];

const MIDDLE_EAST_COUNTRIES = [
  "Saudi Arabia",
  "United Arab Emirates",
  "Qatar",
  "Egypt",
  "Bahrain",
  "Israel",
  "Kuwait",
];

const OTHER_REGION_COUNTRIES = ["Turkey", "Switzerland", "Norway"];

// Combined list of all regions/countries, sorted alphabetically with "Global" first (excluding "Other")
const ALL_REGIONS = [
  "Global",
  "EU",
  ...[
    ...EU_COUNTRIES,
    ...MIDDLE_EAST_COUNTRIES,
    ...OTHER_REGION_COUNTRIES,
    "United States",
    "United Kingdom",
    "Canada",
    "Australia",
    "Japan",
    "China",
  ].sort((a, b) => a.localeCompare(b)),
];

// Function to find closest match for country name (for spelling suggestions)
const findClosestCountry = (input: string): string | null => {
  if (!input || !input.trim()) return null;
  const normalized = input.trim().toLowerCase();
  
  // Exact match (case-insensitive)
  for (const country of ALL_REGIONS) {
    if (country.toLowerCase() === normalized) {
      return country;
    }
  }
  
  // Fuzzy match - check if input is contained in any country name or vice versa
  for (const country of ALL_REGIONS) {
    const countryLower = country.toLowerCase();
    if (countryLower.includes(normalized) || normalized.includes(countryLower)) {
      return country;
    }
  }
  
  // Levenshtein distance check for close matches (within 2 characters)
  let closest: string | null = null;
  let minDistance = Infinity;
  for (const country of ALL_REGIONS) {
    const distance = levenshteinDistance(normalized, country.toLowerCase());
    if (distance <= 2 && distance < minDistance) {
      minDistance = distance;
      closest = country;
    }
  }
  
  return closest;
};

// Simple Levenshtein distance calculation
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
};

const SECTOR_OPTIONS = [
  "Automotive",
  "Biometrics",
  "Consumer Services",
  "Critical Infrastructure",
  "Cybersecurity",
  "Education",
  "Energy",
  "Finance",
  "Government & Public Service",
  "Healthcare",
  "Hiring",
  "Insurance",
  "Justice",
  "Law Enforcement",
  "Manufacturing",
  "Migration & Border Control",
  "Retail",
  "Software",
  "Technology",
  "Transport",
  "Other",
];

const SECTOR_MESSAGE_KEYS: Record<string, string> = {
  "Automotive": "automotive",
  "Biometrics": "biometrics",
  "Consumer Services": "consumerServices",
  "Critical Infrastructure": "criticalInfrastructure",
  "Cybersecurity": "cybersecurity",
  "Education": "education",
  "Energy": "energy",
  "Finance": "finance",
  "Government & Public Service": "governmentPublicService",
  "Healthcare": "healthcare",
  "Hiring": "hiring",
  "Insurance": "insurance",
  "Justice": "justice",
  "Law Enforcement": "lawEnforcement",
  "Manufacturing": "manufacturing",
  "Migration & Border Control": "migrationBorderControl",
  "Retail": "retail",
  "Software": "software",
  "Technology": "technology",
  "Transport": "transport",
  "Other": "other",
};

const normalizeWebsiteUrl = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
};

const isValidWebsiteUrl = (input: string): boolean => {
  const candidate = normalizeWebsiteUrl(input);
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

const CAPTURED_BY_EMAIL_STORAGE_KEY = "ai_legal_standing_captured_by_email";

function EntityHeader() {
  const t = useTranslations("EntityProfile");
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
          <EntityHeader />
          {content}
        </div>
      </main>
    </ThemeProvider>
  );
}

export default function EntityPage() {
  const t = useTranslations("EntityProfile");
  const router = useRouter();
  const [profile, setProfile] = useState<EntityProfile>({
    capturedBy: "",
    fullLegalName: "",
    legalForm: "",
    companyRegistrationNumber: "",
    headquartersCountry: "",
    website: "",
    regionsOfOperation: [],
    regionsOther: "",
    sectors: [],
    sectorOther: "",
    employeeCount: "",
    annualTurnover: "",
    marketRole: "",
    authorizedRepresentativeName: "",
    authorizedRepresentativeEmail: "",
    authorizedRepresentativePhone: "",
    aiComplianceOfficerName: "",
    aiComplianceOfficerEmail: "",
    executiveSponsorName: "",
    executiveSponsorEmail: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [llmHealthOk, setLlmHealthOk] = useState<boolean | null>(null); // null = checking, true = ok, false = issues
  const [searchResults, setSearchResults] = useState<Record<string, unknown> | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [discoveredLogoUrl, setDiscoveredLogoUrl] = useState<string | null>(null);

  // Check LLM API health on mount
  useEffect(() => {
    const checkLlmHealth = async () => {
      try {
        const res = await fetch("/api/core/entity/llm-health", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        setLlmHealthOk(data.ok === true);
      } catch {
        setLlmHealthOk(false);
      }
    };
    void checkLlmHealth();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const capturedByEmail =
      sessionStorage.getItem(CAPTURED_BY_EMAIL_STORAGE_KEY) || "";
    if (!capturedByEmail) return;
    setProfile((prev) =>
      prev.capturedBy
        ? prev
        : { ...prev, capturedBy: capturedByEmail }
    );
  }, []);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const validateField = (
    field: keyof EntityProfile,
    value: EntityProfile[keyof EntityProfile]
  ): string => {
    const textValue = typeof value === "string" ? value : "";
    if (field === "fullLegalName" && !textValue.trim()) {
      return t("validation.required");
    }
    if (field === "headquartersCountry" && !textValue.trim()) {
      return t("validation.required");
    }
    if (field === "regionsOfOperation" && (!Array.isArray(value) || value.length === 0)) {
      return t("validation.required");
    }
    if (field === "regionsOther" && textValue.trim()) {
      const otherCountry = textValue.trim();
      // Check if it's already in the selected regions
      if (profile.regionsOfOperation.includes(otherCountry)) {
        return `"${otherCountry}" is already selected in the list above. Please remove it from the list or use a different country name.`;
      }
      // Check if it matches a valid country (case-insensitive)
      const exactMatch = ALL_REGIONS.find(
        (r) => r.toLowerCase() === otherCountry.toLowerCase()
      );
      if (exactMatch) {
        return `"${otherCountry}" matches "${exactMatch}" which is already available in the list above. Please select "${exactMatch}" from the list instead.`;
      }
      // Check for close matches (spelling suggestions)
      const closest = findClosestCountry(otherCountry);
      if (closest) {
        return `Did you mean "${closest}"? Please check the spelling or select it from the list above.`;
      }
      // If no close match found, accept it (might be a valid country not in our list)
    }
    if (field === "sectors" && (!Array.isArray(value) || value.length === 0)) {
      return t("validation.required");
    }
    if (field === "employeeCount" && !textValue.trim()) {
      return t("validation.required");
    }
    if (field === "website" && !textValue.trim()) {
      return t("validation.required");
    }
    if (field === "website" && textValue && !isValidWebsiteUrl(textValue)) {
      return t("validation.invalidUrl");
    }
    if ((field === "authorizedRepresentativeEmail" || field === "aiComplianceOfficerEmail" || field === "executiveSponsorEmail") && textValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(textValue)) {
      return t("validation.invalidEmail");
    }
    return "";
  };

  const handleChange = (
    field: keyof EntityProfile,
    value: EntityProfile[keyof EntityProfile]
  ) => {
    const nextValue =
      field === "website" && typeof value === "string"
        ? normalizeWebsiteUrl(value)
        : value;
    setProfile((prev) => ({ ...prev, [field]: nextValue }));
    const error = validateField(field, nextValue);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleRegionToggle = (region: string) => {
    setProfile((prev) => {
      const regions = prev.regionsOfOperation.includes(region)
        ? prev.regionsOfOperation.filter((r) => r !== region)
        : [...prev.regionsOfOperation, region];
      return { ...prev, regionsOfOperation: regions };
    });
    setErrors((prev) => ({ ...prev, regionsOfOperation: "" }));
  };

  const hasEUPresence = () => {
    return (
      EU_COUNTRIES.includes(profile.headquartersCountry) ||
      profile.regionsOfOperation.some((r) => EU_COUNTRIES.includes(r))
    );
  };

  const isFormValid = () => {
    if (!profile.fullLegalName.trim() || !profile.headquartersCountry.trim()) return false;
    if (!isValidWebsiteUrl(profile.website)) return false;
    if (!Array.isArray(profile.regionsOfOperation) || profile.regionsOfOperation.length === 0) return false;
    if (!Array.isArray(profile.sectors) || profile.sectors.length === 0) return false;
    if (!profile.employeeCount.trim()) return false;
    return true;
  };

  const handleSearch = async () => {
    const url = normalizeWebsiteUrl(profile.website || "");
    if (!isValidWebsiteUrl(url)) return;
    setIsSearching(true);
    setSearchError(null);
    setProfile((prev) => ({ ...prev, website: url }));
    try {
      const res = await fetch("/api/core/entity/profile-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data.detail === "string" ? data.detail : data.detail?.msg || `Request failed (${res.status})`;
        throw new Error(msg);
      }
      if (data._error) throw new Error(data._error);
      
      // Store search results for modal display
      setSearchResults(data);
      if (typeof data.logoUrl === "string" && data.logoUrl.trim()) {
        setDiscoveredLogoUrl(data.logoUrl);
        setLogoFile(null);
        setLogoPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return data.logoUrl;
        });
      }
      
      // Update profile with search results
      setProfile((prev) => {
        const next = { ...prev };
        if (data.fullLegalName != null) next.fullLegalName = data.fullLegalName;
        if (data.legalForm != null) next.legalForm = data.legalForm;
        if (data.companyRegistrationNumber != null) next.companyRegistrationNumber = data.companyRegistrationNumber;
        if (data.headquartersCountry != null) next.headquartersCountry = data.headquartersCountry;
        if (data.website != null) next.website = data.website;
        if (data.employeeCount != null) next.employeeCount = data.employeeCount;
        if (data.annualTurnover != null) next.annualTurnover = data.annualTurnover;
        if (data.marketRole != null) next.marketRole = data.marketRole;
        if (Array.isArray(data.sectors) && data.sectors.length) {
          next.sectors = [...new Set([...prev.sectors, ...data.sectors])];
        }
        if (Array.isArray(data.regionsOfOperation) && data.regionsOfOperation.length) {
          const added = data.regionsOfOperation.filter((r: string) => !prev.regionsOfOperation.includes(r));
          next.regionsOfOperation = [...prev.regionsOfOperation, ...added];
        }
        if (data.authorizedRepresentativeName != null) next.authorizedRepresentativeName = data.authorizedRepresentativeName;
        if (data.authorizedRepresentativeEmail != null) next.authorizedRepresentativeEmail = data.authorizedRepresentativeEmail;
        if (data.authorizedRepresentativePhone != null) next.authorizedRepresentativePhone = data.authorizedRepresentativePhone;
        if (data.aiComplianceOfficerName != null) next.aiComplianceOfficerName = data.aiComplianceOfficerName;
        if (data.aiComplianceOfficerEmail != null) next.aiComplianceOfficerEmail = data.aiComplianceOfficerEmail;
        if (data.executiveSponsorName != null) next.executiveSponsorName = data.executiveSponsorName;
        if (data.executiveSponsorEmail != null) next.executiveSponsorEmail = data.executiveSponsorEmail;
        return next;
      });
      
      // Show modal with search results
      setShowSearchModal(true);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSectorToggle = (sector: string) => {
    setProfile((prev) => {
      const next = prev.sectors.includes(sector)
        ? prev.sectors.filter((s) => s !== sector)
        : [...prev.sectors, sector];
      return { ...prev, sectors: next };
    });
    setErrors((prev) => ({ ...prev, sectors: "" }));
  };

  const uploadLogo = async (entityId: string) => {
    let res: Response;
    if (logoFile) {
      const body = new FormData();
      body.append("file", logoFile);
      res = await fetch(`/api/core/entity/${entityId}/logo`, {
        method: "POST",
        body,
      });
    } else if (discoveredLogoUrl) {
      res = await fetch(`/api/core/entity/${entityId}/logo-from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: discoveredLogoUrl }),
      });
    } else {
      return null;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const detail = typeof data.detail === "string" ? data.detail : "Failed to upload logo.";
      throw new Error(detail);
    }
    return res.json();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    // Validate all fields
    const newErrors: Record<string, string> = {};
    Object.keys(profile).forEach((key) => {
      const error = validateField(key as keyof EntityProfile, profile[key as keyof EntityProfile]);
      if (error) newErrors[key] = error;
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0 || !isFormValid()) {
      setSubmitError("Please complete the required fields before saving the entity profile.");
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          document
            .querySelector(".text-red-600, .text-red-400")
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 0);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/core/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullLegalName: profile.fullLegalName,
          legalForm: profile.legalForm || null,
          companyRegistrationNumber: profile.companyRegistrationNumber || null,
          headquartersCountry: profile.headquartersCountry,
          website: normalizeWebsiteUrl(profile.website) || null,
          regionsOfOperation: profile.regionsOfOperation,
          regionsOther: profile.regionsOther || null,
          sectors: profile.sectors,
          sectorOther: profile.sectorOther || null,
          employeeCount: profile.employeeCount || null,
          annualTurnover: profile.annualTurnover || null,
          marketRole: profile.marketRole || null,
          authorizedRepresentativeName: profile.authorizedRepresentativeName || null,
          authorizedRepresentativeEmail: profile.authorizedRepresentativeEmail || null,
          authorizedRepresentativePhone: profile.authorizedRepresentativePhone || null,
          aiComplianceOfficerName: profile.aiComplianceOfficerName || null,
          aiComplianceOfficerEmail: profile.aiComplianceOfficerEmail || null,
          executiveSponsorName: profile.executiveSponsorName || null,
          executiveSponsorEmail: profile.executiveSponsorEmail || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail = data.detail;
        const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((x: { msg?: string }) => x.msg).filter(Boolean).join(" ") : `Request failed (${res.status})`;
        throw new Error(msg || `Request failed (${res.status})`);
      }
      const data = await res.json();
      const logoData = data?.id ? await uploadLogo(data.id) : null;
      sessionStorage.setItem("entityProfile", JSON.stringify(profile));
      if (data?.id) sessionStorage.setItem("entityId", data.id);
      if (data?.slug) {
        sessionStorage.setItem("entitySlug", data.slug);
      } else {
        sessionStorage.removeItem("entitySlug");
      }
      if (logoData?.logoUrl) {
        sessionStorage.setItem("entityLogoUrl", logoData.logoUrl);
      }
      router.push("/ai_legal_standing?skipIntro=true");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save entity profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return pageShell(
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Core Entity Identifiers */}
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t("sections.coreIdentifiers.title")}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t("sections.coreIdentifiers.description")}
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("sections.coreIdentifiers.website")} <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="url"
                placeholder="https://example.com"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
                value={profile.website}
                onChange={(e) => {
                  handleChange("website", e.target.value);
                  setSearchError(null);
                }}
              />
              <button
                type="button"
                disabled={!isValidWebsiteUrl(profile.website) || isSearching || llmHealthOk === false}
                onClick={handleSearch}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  llmHealthOk === true
                    ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                    : llmHealthOk === null
                    ? "bg-slate-500 hover:bg-slate-600 dark:bg-slate-500 dark:hover:bg-slate-600"
                    : "bg-slate-700 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500"
                }`}
                title={
                  llmHealthOk === false
                    ? "AI Search unavailable: LLM API key missing or not working"
                    : llmHealthOk === null
                    ? "Checking AI Search availability..."
                    : "AI Search ready"
                }
              >
                {isSearching
                  ? t("buttons.searching")
                  : llmHealthOk === null
                  ? "Checking..."
                  : "AI Search"}
              </button>
            </div>
            {searchError && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{searchError}</p>
            )}
            {errors.website && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.website}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("sections.coreIdentifiers.capturedBy")}
            </label>
            <input
              type="email"
              readOnly
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 shadow-sm outline-none ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              value={profile.capturedBy}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("sections.coreIdentifiers.fullLegalName")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
              value={profile.fullLegalName}
              onChange={(e) => handleChange("fullLegalName", e.target.value)}
            />
            {errors.fullLegalName && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.fullLegalName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Company Logo
            </label>
            <div className="mt-1 flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                {logoPreviewUrl ? (
                  <img
                    src={logoPreviewUrl}
                    alt="Company logo preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="px-2 text-center text-xs text-slate-500 dark:text-slate-400">
                    No logo selected
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setLogoFile(file);
                    setDiscoveredLogoUrl(null);
                    setLogoPreviewUrl((prev) => {
                      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                      return file ? URL.createObjectURL(file) : null;
                    });
                  }}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500 dark:text-slate-300"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Upload a PNG, JPG, WEBP, or SVG, or use the AI-discovered logo preview. The displayed logo will be stored when you save the entity profile.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("sections.coreIdentifiers.legalForm")}
            </label>
            <input
              type="text"
              placeholder={t("sections.coreIdentifiers.legalFormPlaceholder")}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
              value={profile.legalForm}
              onChange={(e) => handleChange("legalForm", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("sections.coreIdentifiers.companyRegistrationNumber")}
            </label>
            <input
              type="text"
              placeholder={t("sections.coreIdentifiers.companyRegistrationNumberPlaceholder")}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
              value={profile.companyRegistrationNumber}
              onChange={(e) => handleChange("companyRegistrationNumber", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("sections.coreIdentifiers.headquartersCountry")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              list="countries"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
              value={profile.headquartersCountry}
              onChange={(e) => handleChange("headquartersCountry", e.target.value)}
            />
            <datalist id="countries">
              {ALL_REGIONS.map((region) => (
                <option key={region} value={region} />
              ))}
            </datalist>
            {errors.headquartersCountry && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.headquartersCountry}</p>
            )}
          </div>
        </div>
      </section>

      {/* Operational Scope & Footprint */}
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t("sections.operationalScope.title")}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t("sections.operationalScope.description")}
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("sections.operationalScope.regionsOfOperation")} <span className="text-red-500">*</span>
            </label>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t("sections.operationalScope.regionsOfOperationHint")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_REGIONS.map((region) => (
                <label
                  key={region}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    profile.regionsOfOperation.includes(region)
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/20 dark:text-indigo-300"
                      : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={profile.regionsOfOperation.includes(region)}
                    onChange={() => handleRegionToggle(region)}
                    className="h-3.5 w-3.5"
                  />
                  {region}
                </label>
              ))}
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("sections.operationalScope.otherRegionsLabel")}
              </label>
              <input
                type="text"
                placeholder={t("sections.operationalScope.otherRegionsPlaceholder")}
                className={`mt-1 w-full max-w-md rounded-xl border px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:ring-2 focus:ring-indigo-500/40 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-400/40 ${
                  errors.regionsOther
                    ? "border-red-500 bg-red-50 focus:border-red-500 dark:border-red-400 dark:bg-red-500/10"
                    : "border-slate-300 bg-white focus:border-indigo-500 dark:border-slate-700"
                }`}
                value={profile.regionsOther}
                onChange={(e) => handleChange("regionsOther", e.target.value)}
              />
              {errors.regionsOther && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.regionsOther}</p>
              )}
            </div>
            {errors.regionsOfOperation && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.regionsOfOperation}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("sections.operationalScope.sector")} <span className="text-red-500">*</span>
            </label>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t("sections.operationalScope.sectorHint")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SECTOR_OPTIONS.map((sector) => (
                <label
                  key={sector}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    profile.sectors.includes(sector)
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/20 dark:text-indigo-300"
                      : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={profile.sectors.includes(sector)}
                    onChange={() => handleSectorToggle(sector)}
                    className="h-3.5 w-3.5"
                  />
                  {t("sections.operationalScope.sectors." + (SECTOR_MESSAGE_KEYS[sector] ?? "other"))}
                </label>
              ))}
            </div>
            {profile.sectors.includes("Other") && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t("sections.operationalScope.otherSectorLabel")}
                </label>
                <input
                  type="text"
                  placeholder={t("sections.operationalScope.otherSectorPlaceholder")}
                  className="mt-1 w-full max-w-md rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
                  value={profile.sectorOther}
                  onChange={(e) => handleChange("sectorOther", e.target.value)}
                />
              </div>
            )}
            {errors.sectors && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.sectors}</p>
            )}
          </div>
        </div>
      </section>

      {/* Company Size & Classification */}
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t("sections.companySize.title")}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t("sections.companySize.description")}
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("sections.companySize.employeeCount")} <span className="text-red-500">*</span>
            </label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
              value={profile.employeeCount}
              onChange={(e) => handleChange("employeeCount", e.target.value)}
            >
              <option value="">{t("sections.companySize.selectEmployeeCount")}</option>
              <option value="1-9">{t("sections.companySize.ranges.micro")}</option>
              <option value="10-49">{t("sections.companySize.ranges.small")}</option>
              <option value="50-249">{t("sections.companySize.ranges.medium")}</option>
              <option value="250-999">{t("sections.companySize.ranges.large")}</option>
              <option value="1000+">{t("sections.companySize.ranges.enterprise")}</option>
            </select>
            {errors.employeeCount && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.employeeCount}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("sections.companySize.annualTurnover")}
            </label>
            <input
              type="text"
              placeholder={t("sections.companySize.annualTurnoverPlaceholder")}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
              value={profile.annualTurnover}
              onChange={(e) => handleChange("annualTurnover", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Key Compliance Personnel */}
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t("sections.compliancePersonnel.title")}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t("sections.compliancePersonnel.description")}
        </p>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              {t("sections.compliancePersonnel.authorizedRepresentative.title")}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t("sections.compliancePersonnel.authorizedRepresentative.description")}
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t("sections.compliancePersonnel.name")}
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
                  value={profile.authorizedRepresentativeName}
                  onChange={(e) => handleChange("authorizedRepresentativeName", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t("sections.compliancePersonnel.email")}
                </label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
                  value={profile.authorizedRepresentativeEmail}
                  onChange={(e) => handleChange("authorizedRepresentativeEmail", e.target.value)}
                />
                {errors.authorizedRepresentativeEmail && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.authorizedRepresentativeEmail}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t("sections.compliancePersonnel.phone")}
                </label>
                <input
                  type="tel"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
                  value={profile.authorizedRepresentativePhone}
                  onChange={(e) => handleChange("authorizedRepresentativePhone", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              {t("sections.compliancePersonnel.aiComplianceOfficer.title")}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t("sections.compliancePersonnel.aiComplianceOfficer.description")}
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t("sections.compliancePersonnel.name")}
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
                  value={profile.aiComplianceOfficerName}
                  onChange={(e) => handleChange("aiComplianceOfficerName", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t("sections.compliancePersonnel.email")}
                </label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
                  value={profile.aiComplianceOfficerEmail}
                  onChange={(e) => handleChange("aiComplianceOfficerEmail", e.target.value)}
                />
                {errors.aiComplianceOfficerEmail && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.aiComplianceOfficerEmail}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              {t("sections.compliancePersonnel.executiveSponsor.title")}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t("sections.compliancePersonnel.executiveSponsor.description")}
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t("sections.compliancePersonnel.name")}
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
                  value={profile.executiveSponsorName}
                  onChange={(e) => handleChange("executiveSponsorName", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t("sections.compliancePersonnel.email")}
                </label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/40"
                  value={profile.executiveSponsorEmail}
                  onChange={(e) => handleChange("executiveSponsorEmail", e.target.value)}
                />
                {errors.executiveSponsorEmail && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.executiveSponsorEmail}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">
          {submitError}
        </div>
      )}

      {/* AI Search Results Modal */}
      {showSearchModal && searchResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSearchModal(false)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">AI Search Results Summary</h3>
              <button
                onClick={() => setShowSearchModal(false)}
                className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                {/* Core Information */}
                {(searchResults.fullLegalName || searchResults.legalForm || searchResults.companyRegistrationNumber || searchResults.headquartersCountry) && (
                  <div>
                    <h4 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Core Information</h4>
                    <div className="space-y-2 text-sm">
                      {searchResults.fullLegalName && (
                        <div className="flex">
                          <span className="w-48 font-medium text-slate-600 dark:text-slate-400">Full Legal Name:</span>
                          <span className="text-slate-900 dark:text-slate-100">{searchResults.fullLegalName}</span>
                        </div>
                      )}
                      {searchResults.legalForm && (
                        <div className="flex">
                          <span className="w-48 font-medium text-slate-600 dark:text-slate-400">Legal Form:</span>
                          <span className="text-slate-900 dark:text-slate-100">{searchResults.legalForm}</span>
                        </div>
                      )}
                      {searchResults.companyRegistrationNumber && (
                        <div className="flex">
                          <span className="w-48 font-medium text-slate-600 dark:text-slate-400">Registration Number:</span>
                          <span className="text-slate-900 dark:text-slate-100">{searchResults.companyRegistrationNumber}</span>
                        </div>
                      )}
                      {searchResults.headquartersCountry && (
                        <div className="flex">
                          <span className="w-48 font-medium text-slate-600 dark:text-slate-400">Headquarters Country:</span>
                          <span className="text-slate-900 dark:text-slate-100">{searchResults.headquartersCountry}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Company Size & Classification */}
                {(searchResults.employeeCount || searchResults.annualTurnover || searchResults.marketRole) && (
                  <div>
                    <h4 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Company Size & Classification</h4>
                    <div className="space-y-2 text-sm">
                      {searchResults.employeeCount && (
                        <div className="flex">
                          <span className="w-48 font-medium text-slate-600 dark:text-slate-400">Employee Count:</span>
                          <span className="text-slate-900 dark:text-slate-100">{searchResults.employeeCount}</span>
                        </div>
                      )}
                      {searchResults.annualTurnover && (
                        <div className="flex">
                          <span className="w-48 font-medium text-slate-600 dark:text-slate-400">Annual Turnover:</span>
                          <span className="text-slate-900 dark:text-slate-100">{searchResults.annualTurnover}</span>
                        </div>
                      )}
                      {searchResults.marketRole && (
                        <div className="flex">
                          <span className="w-48 font-medium text-slate-600 dark:text-slate-400">Market Role:</span>
                          <span className="text-slate-900 dark:text-slate-100">{searchResults.marketRole}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Operational Scope */}
                {(searchResults.sectors?.length > 0 || searchResults.regionsOfOperation?.length > 0) && (
                  <div>
                    <h4 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Operational Scope</h4>
                    <div className="space-y-2 text-sm">
                      {searchResults.sectors?.length > 0 && (
                        <div>
                          <span className="font-medium text-slate-600 dark:text-slate-400">Sectors:</span>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {searchResults.sectors.map((sector: string, idx: number) => (
                              <span key={idx} className="rounded-lg bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                                {sector}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {searchResults.regionsOfOperation?.length > 0 && (
                        <div>
                          <span className="font-medium text-slate-600 dark:text-slate-400">Regions of Operation:</span>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {searchResults.regionsOfOperation.map((region: string, idx: number) => (
                              <span key={idx} className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                                {region}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Compliance Personnel */}
                {(searchResults.authorizedRepresentativeName || searchResults.authorizedRepresentativeEmail || searchResults.authorizedRepresentativePhone ||
                  searchResults.aiComplianceOfficerName || searchResults.aiComplianceOfficerEmail ||
                  searchResults.executiveSponsorName || searchResults.executiveSponsorEmail) && (
                  <div>
                    <h4 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Compliance Personnel</h4>
                    <div className="space-y-3 text-sm">
                      {(searchResults.authorizedRepresentativeName || searchResults.authorizedRepresentativeEmail || searchResults.authorizedRepresentativePhone) && (
                        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                          <div className="font-medium text-slate-700 dark:text-slate-300">Authorized Representative</div>
                          {searchResults.authorizedRepresentativeName && (
                            <div className="mt-1 text-slate-600 dark:text-slate-400">Name: {searchResults.authorizedRepresentativeName}</div>
                          )}
                          {searchResults.authorizedRepresentativeEmail && (
                            <div className="text-slate-600 dark:text-slate-400">Email: {searchResults.authorizedRepresentativeEmail}</div>
                          )}
                          {searchResults.authorizedRepresentativePhone && (
                            <div className="text-slate-600 dark:text-slate-400">Phone: {searchResults.authorizedRepresentativePhone}</div>
                          )}
                        </div>
                      )}
                      {(searchResults.aiComplianceOfficerName || searchResults.aiComplianceOfficerEmail) && (
                        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                          <div className="font-medium text-slate-700 dark:text-slate-300">AI Compliance Officer</div>
                          {searchResults.aiComplianceOfficerName && (
                            <div className="mt-1 text-slate-600 dark:text-slate-400">Name: {searchResults.aiComplianceOfficerName}</div>
                          )}
                          {searchResults.aiComplianceOfficerEmail && (
                            <div className="text-slate-600 dark:text-slate-400">Email: {searchResults.aiComplianceOfficerEmail}</div>
                          )}
                        </div>
                      )}
                      {(searchResults.executiveSponsorName || searchResults.executiveSponsorEmail) && (
                        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                          <div className="font-medium text-slate-700 dark:text-slate-300">Executive Sponsor</div>
                          {searchResults.executiveSponsorName && (
                            <div className="mt-1 text-slate-600 dark:text-slate-400">Name: {searchResults.executiveSponsorName}</div>
                          )}
                          {searchResults.executiveSponsorEmail && (
                            <div className="text-slate-600 dark:text-slate-400">Email: {searchResults.executiveSponsorEmail}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowSearchModal(false)}
                  className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        {hasEUPresence() ? (
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? t("buttons.saving") : t("buttons.nextToLegalStanding")}
          </button>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? t("buttons.saving") : t("buttons.save")}
          </button>
        )}
      </div>
    </form>,
    "max-w-5xl"
  );
}
