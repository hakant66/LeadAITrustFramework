"use client";

import Header from "@/app/(components)/Header";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type EntityProfile = {
  id: string;
  slug?: string | null;
  fullLegalName: string;
  legalForm?: string | null;
  companyRegistrationNumber?: string | null;
  headquartersCountry?: string | null;
  website?: string | null;
  regionsOfOperation: string[];
  regionsOther?: string | null;
  sectors: string[];
  sectorOther?: string | null;
  employeeCount?: string | null;
  annualTurnover?: string | null;
  primaryRole?: string | null;
  riskClassification?: string | null;
  decisionTrace?: string | null;
  authorizedRepresentativeName?: string | null;
  authorizedRepresentativeEmail?: string | null;
  authorizedRepresentativePhone?: string | null;
  aiComplianceOfficerName?: string | null;
  aiComplianceOfficerEmail?: string | null;
  executiveSponsorName?: string | null;
  executiveSponsorEmail?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const EU_COUNTRIES = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
  "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
  "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands",
  "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden",
];
const OTHER_COUNTRIES = ["United States", "United Kingdom", "Turkey", "Switzerland", "Norway", "Saudi Arabia", "United Arab Emirates", "Qatar", "Egypt", "Bahrain", "Israel", "Kuwait"];

// Combined list of all regions/countries, sorted alphabetically with "Global" first
const ALL_REGIONS = [
  "Global",
  "EU",
  ...[...EU_COUNTRIES, ...OTHER_COUNTRIES].sort((a, b) => a.localeCompare(b)),
  "Other",
];
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

export default function EntitySetupPage() {
  const router = useRouter();
  const [entity, setEntity] = useState<EntityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<EntityProfile>>({});

  const loadEntity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/core/entity/latest");
      if (res.status === 404) {
        setEntity(null);
        setError("No entity found. Complete the Entity form and Save Entity Information from the AI Legal Standing assessment first.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load entity");
      const data = await res.json();
      setEntity(data);
      setForm({
        companyRegistrationNumber: data.companyRegistrationNumber ?? "",
        headquartersCountry: data.headquartersCountry ?? "",
        regionsOfOperation: data.regionsOfOperation ?? [],
        regionsOther: data.regionsOther ?? "",
        sectors: data.sectors ?? [],
        sectorOther: data.sectorOther ?? "",
        employeeCount: data.employeeCount ?? "",
        annualTurnover: data.annualTurnover ?? "",
        primaryRole: data.primaryRole ?? "",
        riskClassification: data.riskClassification ?? "",
        decisionTrace: data.decisionTrace ?? "",
        authorizedRepresentativeName: data.authorizedRepresentativeName ?? "",
        authorizedRepresentativeEmail: data.authorizedRepresentativeEmail ?? "",
        authorizedRepresentativePhone: data.authorizedRepresentativePhone ?? "",
        aiComplianceOfficerName: data.aiComplianceOfficerName ?? "",
        aiComplianceOfficerEmail: data.aiComplianceOfficerEmail ?? "",
        executiveSponsorName: data.executiveSponsorName ?? "",
        executiveSponsorEmail: data.executiveSponsorEmail ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load entity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntity();
  }, [loadEntity]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entity?.id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/core/entity/${entity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyRegistrationNumber: form.companyRegistrationNumber || null,
          headquartersCountry: form.headquartersCountry || null,
          regionsOfOperation: form.regionsOfOperation ?? [],
          regionsOther: form.regionsOther || null,
          sectors: form.sectors ?? [],
          sectorOther: form.sectorOther || null,
          employeeCount: form.employeeCount || null,
          annualTurnover: form.annualTurnover || null,
          // Note: primaryRole, riskClassification, decisionTrace are read-only (from assessment)
          authorizedRepresentativeName: form.authorizedRepresentativeName || null,
          authorizedRepresentativeEmail: form.authorizedRepresentativeEmail || null,
          authorizedRepresentativePhone: form.authorizedRepresentativePhone || null,
          aiComplianceOfficerName: form.aiComplianceOfficerName || null,
          aiComplianceOfficerEmail: form.aiComplianceOfficerEmail || null,
          executiveSponsorName: form.executiveSponsorName || null,
          executiveSponsorEmail: form.executiveSponsorEmail || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === "string" ? err.detail : "Failed to update");
      }
      const updatedData = await res.json();
      await loadEntity();
      
      // Update URL to include entity_slug if available
      if (updatedData.slug) {
        router.replace(`/${updatedData.slug}/scorecard/admin/governance-setup/entity-setup`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleOnboard = async () => {
    if (!entity?.id) {
      setError("Entity ID is required for onboarding.");
      return;
    }
    setOnboarding(true);
    setError(null);
    try {
      // First, save the entity to ensure slug is set
      const res = await fetch(`/api/core/entity/${entity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyRegistrationNumber: form.companyRegistrationNumber || null,
          headquartersCountry: form.headquartersCountry || null,
          regionsOfOperation: form.regionsOfOperation ?? [],
          regionsOther: form.regionsOther || null,
          sectors: form.sectors ?? [],
          sectorOther: form.sectorOther || null,
          employeeCount: form.employeeCount || null,
          annualTurnover: form.annualTurnover || null,
          // Note: primaryRole, riskClassification, decisionTrace are read-only (from assessment)
          authorizedRepresentativeName: form.authorizedRepresentativeName || null,
          authorizedRepresentativeEmail: form.authorizedRepresentativeEmail || null,
          authorizedRepresentativePhone: form.authorizedRepresentativePhone || null,
          aiComplianceOfficerName: form.aiComplianceOfficerName || null,
          aiComplianceOfficerEmail: form.aiComplianceOfficerEmail || null,
          executiveSponsorName: form.executiveSponsorName || null,
          executiveSponsorEmail: form.executiveSponsorEmail || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === "string" ? err.detail : "Failed to save entity");
      }
      const updatedData = await res.json();
      
      // Ensure slug exists - reload entity to get slug
      await loadEntity();
      const currentEntity = entity;
      if (!currentEntity?.slug && !updatedData.slug) {
        throw new Error("Entity slug was not generated. Please try again.");
      }
      
      const entitySlug = updatedData.slug || currentEntity?.slug;
      if (!entitySlug) {
        throw new Error("Entity slug is required for onboarding.");
      }
      
      // Navigate to entity-specific URL
      router.push(`/${entitySlug}/scorecard/admin/governance-setup/entity-setup`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to onboard entity");
    } finally {
      setOnboarding(false);
    }
  };

  const toggleRegion = (name: string) => {
    const list = form.regionsOfOperation ?? [];
    const next = list.includes(name) ? list.filter((r) => r !== name) : [...list, name];
    setForm((prev) => ({ ...prev, regionsOfOperation: next }));
  };

  const toggleSector = (name: string) => {
    const list = form.sectors ?? [];
    const next = list.includes(name) ? list.filter((s) => s !== name) : [...list, name];
    setForm((prev) => ({ ...prev, sectors: next }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Entity Onboarding" subtitle="LeadAI · Governance Setup" titleNote="Step 2 of 6" />
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (error && !entity) {
    return (
      <div className="space-y-6">
        <Header title="Entity Onboarding" subtitle="LeadAI · Governance Setup" titleNote="Step 2 of 6" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {error}
        </div>
        <Link
          href="/entitycapture"
          className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Go to Entity form
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header title="Entity Onboarding" subtitle="LeadAI · Governance Setup" titleNote="Step 2 of 6">
        <Link
          href="/scorecard/admin/governance-setup"
          className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Back to Governance Setup
        </Link>
      </Header>

      <form onSubmit={handleSave} className="space-y-8">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-base font-semibold text-slate-800 dark:text-slate-100">
                Full Legal Name
              </label>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{entity?.fullLegalName ?? "—"}</p>
            </div>
            <div>
              <label className="block text-base font-semibold text-slate-800 dark:text-slate-100">
                Website
              </label>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{entity?.website ?? "—"}</p>
            </div>
            <div>
              <label className="block text-base font-semibold text-slate-800 dark:text-slate-100">
                EU AI Act Primary Role
              </label>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{entity?.primaryRole ?? "—"}</p>
            </div>
            <div>
              <label className="block text-base font-semibold text-slate-800 dark:text-slate-100">
                EU AI Act Risk Classification
              </label>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{entity?.riskClassification ?? "—"}</p>
            </div>
          </div>
          <div className="mt-4 text-xs font-normal text-slate-500 dark:text-slate-400">
            Entity Snapshot (Read-only)
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Editable fields</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Company Registration Number</label>
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={form.companyRegistrationNumber ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, companyRegistrationNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Headquarters Country</label>
              <input
                type="text"
                list="hq-countries"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={form.headquartersCountry ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, headquartersCountry: e.target.value }))}
              />
              <datalist id="hq-countries">
                {[...EU_COUNTRIES, ...OTHER_COUNTRIES].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Regions of Operation</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALL_REGIONS.map((region) => (
                  <label key={region} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <input type="checkbox" checked={(form.regionsOfOperation ?? []).includes(region)} onChange={() => toggleRegion(region)} className="h-3 w-3" />
                    {region}
                  </label>
                ))}
              </div>
              <input
                type="text"
                placeholder="Other regions"
                className="mt-2 w-full max-w-md rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={form.regionsOther ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, regionsOther: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Sectors</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SECTOR_OPTIONS.map((s) => (
                  <label key={s} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <input type="checkbox" checked={(form.sectors ?? []).includes(s)} onChange={() => toggleSector(s)} className="h-3 w-3" />
                    {s}
                  </label>
                ))}
              </div>
              <input
                type="text"
                placeholder="Other sector"
                className="mt-2 w-full max-w-md rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={form.sectorOther ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, sectorOther: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Employee Count</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={form.employeeCount ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, employeeCount: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Annual Turnover</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={form.annualTurnover ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, annualTurnover: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Authorized Representative Name</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={form.authorizedRepresentativeName ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, authorizedRepresentativeName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Authorized Representative Email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={form.authorizedRepresentativeEmail ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, authorizedRepresentativeEmail: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Authorized Representative Phone</label>
              <input
                type="text"
                className="mt-1 w-full max-w-md rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={form.authorizedRepresentativePhone ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, authorizedRepresentativePhone: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">AI Compliance Officer Name</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={form.aiComplianceOfficerName ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, aiComplianceOfficerName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">AI Compliance Officer Email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={form.aiComplianceOfficerEmail ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, aiComplianceOfficerEmail: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Executive Sponsor Name</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={form.executiveSponsorName ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, executiveSponsorName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Executive Sponsor Email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={form.executiveSponsorEmail ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, executiveSponsorEmail: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {entity?.id && (
            <button
              type="button"
              onClick={handleOnboard}
              disabled={onboarding}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-70"
            >
              {onboarding ? "Onboarding..." : "Onboard Entity"}
            </button>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">Changes are recorded in the Audit Log.</p>
        </div>
      </form>
    </div>
  );
}
