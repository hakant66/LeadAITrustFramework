// apps/web/src/lib/scorecard.ts

export type ControlMeta = {
  kpi_key?: string;
  key?: string;                          // fallback if API returns `key`
  kpi_score?: number | null;
  owner_role?: string | null;
  evidence_source?: string | null;
  target_numeric?: number | null;
  unit?: string | null;
  raw_value?: number | null;
  normalized_pct?: number | null;
  updated_at?: string | null;
};

export async function fetchJsonOk<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/**
 * Pull project-scoped control metadata (owner_role, evidence_source, target_numeric, kpi_score, etc.)
 * from GET /scorecard/{projectId}/controls (your backend endpoint).
 *
 * Accepts several response shapes:
 * - array
 * - { items: [...] }
 * - { data: [...] }
 * - { rows: [...] }
 */
export async function fetchControlMetaMap(
  base: string,
  projectId: string
): Promise<Record<string, ControlMeta>> {
  const url = `${base}/scorecard/${encodeURIComponent(projectId)}/controls`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const raw = await res.json();

  const items: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items) ? raw.items
    : Array.isArray(raw?.data)  ? raw.data
    : Array.isArray(raw?.rows)  ? raw.rows
    : [];

  const map: Record<string, ControlMeta> = {};
  for (const it of items) {
    const k = String(it.kpi_key ?? it.key ?? "");
    if (!k) continue;
    map[k] = {
      kpi_key: k,
      owner_role: it.owner_role ?? null,
      evidence_source: it.evidence_source ?? null,
      target_numeric: typeof it.target_numeric === "number" ? it.target_numeric : null,
      unit: it.unit ?? null,
      raw_value: typeof it.raw_value === "number" ? it.raw_value : null,
      normalized_pct: typeof it.normalized_pct === "number" ? it.normalized_pct : null,
      updated_at: it.updated_at ?? null,
      kpi_score: typeof it.kpi_score === "number" ? it.kpi_score : null,
    };
  }
  return map;
}
