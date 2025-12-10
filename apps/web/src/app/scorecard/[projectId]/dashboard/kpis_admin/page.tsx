// apps/web/src/app/scorecard/[projectId]/dashboard/kpis_admin/page.tsx

import Header from "@/app/(components)/Header";
import EditKpis from "@/app/(components)/EditKpis";
import ControlValuesTableClient, {
  ControlValueRow,
} from "@/app/(components)/ControlValuesTableClient";
import { ControlValuesIO } from "@/app/(components)/AdminDataIO";

const apiBase =
  process.env.NEXT_PUBLIC_CORE_SVC_URL ??
  process.env.CORE_SVC_URL ??
  "http://localhost:8001";

type ScorecardResponse = {
  kpis: any[];
  project?: { slug?: string; name?: string };
  project_slug?: string;
  project_name?: string;
};

/**
 * Make control/KPI names more human-readable.
 *
 * Example:
 *   "Pillar: AI-as-a-Product Governance · compliance_scorecard · Unit: %"
 *   -> "AI-as-a-Product Governance — Compliance scorecard (%)"
 */
function prettifyControlName(raw: any): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";

  const lower = s.toLowerCase();

  // Only special-case strings that look like the Pillar pattern
  if (lower.startsWith("pillar:")) {
    const parts = s.split("·").map((p) => p.trim());

    let pillarName = "";
    let metricName = "";
    let unit = "";

    for (const part of parts) {
      const pl = part.toLowerCase();
      if (pl.startsWith("pillar:")) {
        pillarName = part.slice("Pillar:".length).trim();
      } else if (pl.startsWith("unit:")) {
        unit = part.slice("Unit:".length).trim();
      } else if (!metricName) {
        metricName = part;
      }
    }

    // Make the metric more friendly: snake_case -> title-ish
    if (metricName) {
      metricName = metricName
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (metricName.length > 0) {
        metricName =
          metricName.charAt(0).toUpperCase() + metricName.slice(1);
      }
    }

    let labelParts: string[] = [];
    if (pillarName) labelParts.push(pillarName);
    if (metricName) labelParts.push(metricName);

    let label = labelParts.join(" — ");

    if (unit) {
      // If the unit is just "%", keep it compact.
      label = unit === "%"
        ? `${label} (${unit})`
        : `${label} (Unit: ${unit})`;
    }

    return label || s;
  }

  // Fallback: return as-is
  return s;
}

function normalizeControlValueRow(item: any): ControlValueRow {
  const rawControlName =
    item.control_name ??
    item.control ??
    item.control_key ??
    item.control_id ??
    "";

  const owner =
    item.owner_role ??
    item.owner ??
    item.owner_name ??
    item.owner_email ??
    null;

  const target =
    item.target_text != null && item.target_text !== ""
      ? item.target_text
      : typeof item.target_numeric === "number"
      ? item.target_numeric
      : null;

  const current_value =
    typeof item.current_value === "number" ||
    typeof item.current_value === "string"
      ? item.current_value
      : typeof item.raw_value === "number" ||
        typeof item.raw_value === "string"
      ? item.raw_value
      : typeof item.normalized_pct === "number"
      ? item.normalized_pct
      : null;

  const as_of =
    item.as_of ??
    item.updated_at ??
    item.observed_at ??
    item.last_updated ??
    null;

  return {
    control_name: prettifyControlName(rawControlName),
    owner: owner == null ? null : String(owner),
    target,
    current_value,
    as_of: as_of == null ? null : String(as_of),
  };
}

function kpisToControlValues(kpis: any[]): ControlValueRow[] {
  return (kpis ?? []).map((k) => {
    const current_value =
      typeof k.current_value === "number" || typeof k.current_value === "string"
        ? k.current_value
        : typeof k.raw_value === "number" || typeof k.raw_value === "string"
        ? k.raw_value
        : typeof k.normalized_pct === "number"
        ? k.normalized_pct
        : null;

    const target =
      k.target_text != null && k.target_text !== ""
        ? k.target_text
        : typeof k.target_numeric === "number"
        ? k.target_numeric
        : null;

    const as_of = k.as_of ?? k.updated_at ?? null;

    const rawControlName = k.name ?? k.key ?? k.kpi_key ?? "";

    return {
      control_name: prettifyControlName(rawControlName),
      owner:
        (k.owner_role ??
          k.owner ??
          k.owner_name ??
          k.owner_email ??
          null) ?? null,
      target,
      current_value,
      as_of: as_of ? String(as_of) : null,
    };
  });
}

async function fetchJsonOk(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

async function fetchControlValues(slug: string): Promise<ControlValueRow[]> {
  const base = apiBase.replace(/\/+$/, "");

  // Primary endpoint: explicit controls API
  try {
    const raw = await fetchJsonOk(
      `${base}/scorecard/${encodeURIComponent(slug)}/controls`,
      { cache: "no-store" },
    );
    const list: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.rows)
      ? raw.rows
      : [];
    if (list.length) return list.map(normalizeControlValueRow);
  } catch {
    // fall through to embedded scorecard
  }

  // Fallback: embedded in scorecard
  try {
    const sc = await fetchJsonOk(
      `${base}/scorecard/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    const embedded: any[] = Array.isArray(sc?.control_values)
      ? sc.control_values
      : Array.isArray(sc?.controls)
      ? sc.controls
      : Array.isArray(sc?.values)
      ? sc.values
      : [];
    if (embedded.length) return embedded.map(normalizeControlValueRow);
  } catch {
    // ignore, return empty below
  }

  return [];
}

export default async function KpisAdminPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  // 👇 critical change: await params
  const { projectId: slug } = await params;

  // Scorecard for project label + KPI list
  const res = await fetch(
    `${apiBase.replace(/\/+$/, "")}/scorecard/${encodeURIComponent(slug)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(
      `Failed to load scorecard for ${slug}: ${res.status}`,
    );
  }

  const data = (await res.json()) as ScorecardResponse;
  const kpis = Array.isArray(data.kpis) ? data.kpis : [];

  // Control values (for table)
  let controlValues: ControlValueRow[] = await fetchControlValues(slug);
  if (!controlValues.length) {
    controlValues = kpisToControlValues(kpis);
  }

  const projectLabel = data.project?.name ?? data.project_name ?? slug;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
        <Header title="KPIs Admin" subtitle={`Project: ${projectLabel}`}>
          <div className="flex items-center gap-2">
            {/* 1) KPI List (first) */}
            <a
              href={`/scorecard/${encodeURIComponent(
                slug,
              )}/dashboard/kpis_admin/kpi_list`}
              className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              KPI List
            </a>

            {/* 2) Pillars Admin (middle) */}
            <a
              href={`/scorecard/${encodeURIComponent(
                slug,
              )}/dashboard/pillars_admin`}
              className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Pillars Admin
            </a>

            {/* 3) Back to Dashboard (last) */}
            <a
              href={`/scorecard/${encodeURIComponent(slug)}/dashboard`}
              className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Back to Dashboard
            </a>
          </div>
        </Header>

        {/* 1) AI Project Performance Management */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-2">
            AI Project Performance Management
          </div>
          <EditKpis projectId={slug} kpis={kpis as any[]} />
        </div>

        {/* 2) Control Values (.xlsx) */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
          <ControlValuesIO slug={slug} />
        </div>

        {/* 3) Control Values (table) */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-3">
            Control Values
          </div>
          {controlValues.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-slate-400">
              No control values found for this project.
            </div>
          ) : (
            <ControlValuesTableClient rows={controlValues} />
          )}
        </div>
      </div>
    </main>
  );
}
