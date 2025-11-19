// apps/web/src/app/(components)/EditKpis.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  initEvidence,
  finalizeEvidence,
  listEvidence,
  resolveControlId,          // direct lookup endpoint: /admin/projects/{slug}/kpis/{key}/control-id
  uploadEvidenceFile,        // high-level helper: init -> PUT -> finalize
} from "@/lib/evidenceClient";
import { sha256Hex } from "@/lib/hash";

type Kpi = {
  key: string;
  name: string;
  pillar?: string | null;
  unit?: string | null;
  raw_value?: number | null;
  normalized_pct?: number | null;
  control_id?: string | null; // may be absent until first update
};

export default function EditKpis({
  projectId,
  kpis,
}: {
  projectId: string;
  kpis: Kpi[];
}) {
  const apiBase =
    process.env.NEXT_PUBLIC_CORE_SVC_URL ??
    process.env.CORE_SVC_URL ??
    "http://localhost:8001";

  const router = useRouter();

  // Prefer rows with raw_value, else normalized_pct
  const [list, setList] = useState<Kpi[]>(() => {
    const withRaw = kpis.filter((k) => k.raw_value != null);
    return withRaw.length ? withRaw : kpis.filter((k) => k.normalized_pct != null);
  });

  // Keep client list in sync when props change
  useEffect(() => {
    const withRaw = kpis.filter((k) => k.raw_value != null);
    setList(withRaw.length ? withRaw : kpis.filter((k) => k.normalized_pct != null));
  }, [kpis]);

  // Editable values
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const seeded: Record<string, string> = {};
    for (const k of list) {
      const v =
        typeof k.raw_value === "number"
          ? k.raw_value
          : typeof k.normalized_pct === "number"
          ? k.normalized_pct
          : 0;
      seeded[k.key] = String(v ?? 0);
    }
    setValues(seeded);
  }, [list]);

  const [busyKey, setBusyKey] = useState<string | null>(null);

  const handleChange = (k: string, v: string) =>
    setValues((s) => ({ ...s, [k]: v }));

  // Utility: detect “404 …” text from our jsonOk errors
  function isNotFoundError(err: unknown) {
    const msg = (err as any)?.message ?? String(err ?? "");
    return /\b404\b/.test(msg);
  }

  // ---------- Update Raw Value (creates/updates control_values.raw_value) ----------
  // This POST will (on the backend) create a control_values row for the project+KPI if missing.
  async function postWithFallbacks(url: string, bodies: any[]) {
    let lastErr: string | null = null;
    for (const body of bodies) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
      });
      if (res.ok) return res;
      lastErr = `${res.status} ${await res.text().catch(() => "")}`.trim();
    }
    throw new Error(lastErr || "Request failed");
  }

  const handleUpdate = async (k: string) => {
    if (busyKey === k) return;
    setBusyKey(k);
    try {
      const numeric = Number(values[k] ?? 0);
      const value = isNaN(numeric) ? 0 : numeric;

      const url = `${apiBase}/scorecard/${encodeURIComponent(projectId)}`;
      const bodies = [
        { scores: [{ key: k, value }], options: { recompute: true } },
        { scores: [{ key: k, raw_value: value }], options: { recompute: true } },
        { updates: [{ kpi_key: k, raw_value: value }], options: { recompute: true } },
      ];

      await postWithFallbacks(url, bodies);

      // Hint the cache for quicker evidence uploads later:
      try {
        const cid = await resolveControlId(projectId, k);
        if (cid) controlIdCache.current[k] = cid;
      } catch {
        /* linkage might finalize async; the fallback in safeResolveControlId will still cover us */
      }

      router.refresh();
    } catch (e: any) {
      alert(`Update failed: ${e?.message ?? String(e)}`);
      console.error(e);
    } finally {
      setBusyKey(null);
    }
  };

  // ---------- Evidence upload (init -> PUT -> finalize) ----------
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const controlIdCache = useRef<Record<string, string>>({}); // kpi_key -> control_id

  // --- Fallback #2: fetch controls list and match locally ---
  async function fetchControlsList(
    projectSlug: string,
  ): Promise<
    Array<{
      control_id?: string | null;
      kpi_key?: string | null;
      kpi_name?: string | null;
      control_name?: string | null;
    }>
  > {
    const res = await fetch(
      `${apiBase}/scorecard/${encodeURIComponent(projectSlug)}/controls`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const raw = await res.json().catch(() => null);
    const list: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.rows)
      ? raw.rows
      : [];
    return list.map((r) => ({
      control_id: r.control_id ?? r.id ?? null,
      kpi_key: r.kpi_key ?? r.key ?? null,
      kpi_name: r.kpi_name ?? null,
      control_name: r.control_name ?? null,
    }));
  }

  // Try to resolve control_id without throwing on 404
  async function safeResolveControlId(kpiKey: string): Promise<string | null> {
    // 1) If caller passed control_id in KPI props
    const inProp = list.find((x) => x.key === kpiKey)?.control_id;
    if (inProp) return inProp;

    // 2) Cached?
    if (controlIdCache.current[kpiKey]) return controlIdCache.current[kpiKey];

    // 3) Ask backend; treat 404 as "not yet created"
    try {
      const cid = await resolveControlId(projectId, kpiKey);
      if (cid) {
        controlIdCache.current[kpiKey] = cid;
        return cid;
      }
    } catch (err) {
      if (!isNotFoundError(err)) throw err; // surface non-404 problems
      // continue to fallback on 404
    }

    // 4) Fallback: list controls and match by kpi_key (preferred), then by name
    try {
      const controls = await fetchControlsList(projectId);
      const keyLc = kpiKey.trim().toLowerCase();

      // match by kpi_key
      const byKey = controls.find(
        (c) => (c.kpi_key ?? "").toString().trim().toLowerCase() === keyLc,
      );
      if (byKey?.control_id) {
        controlIdCache.current[kpiKey] = byKey.control_id;
        return byKey.control_id;
      }

      // last resort: match by name (kpi_name/control_name) if your data is consistent
      const kpiName = list.find((x) => x.key === kpiKey)?.name ?? "";
      const nameLc = kpiName.trim().toLowerCase();
      const byName = controls.find((c) => {
        const n1 = (c.kpi_name ?? "").toString().trim().toLowerCase();
        const n2 = (c.control_name ?? "").toString().trim().toLowerCase();
        return n1 === nameLc || n2 === nameLc;
      });
      if (byName?.control_id) {
        controlIdCache.current[kpiKey] = byName.control_id;
        return byName.control_id;
      }
    } catch {
      /* ignore; we'll show the friendly prompt below */
    }

    return null;
  }

  // Evidence badge dropdown
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [evidenceList, setEvidenceList] = useState<Record<string, any[]>>({});
  const [loadingListKey, setLoadingListKey] = useState<string | null>(null);

  async function loadEvidence(kpiKey: string) {
    setLoadingListKey(kpiKey);
    try {
      const cid = await safeResolveControlId(kpiKey);
      if (!cid) {
        setEvidenceList((s) => ({ ...s, [kpiKey]: [] }));
        return;
      }
      const res = await listEvidence(projectId, cid); // normalized to { items: [...] }
      setEvidenceList((s) => ({ ...s, [kpiKey]: res.items || [] }));
    } catch (e: any) {
      alert(e?.message ?? "Could not load evidence");
    } finally {
      setLoadingListKey(null);
    }
  }

  async function handleFileSelected(k: Kpi, inputEl: HTMLInputElement) {
    const file = inputEl.files?.[0];
    if (!file) return;
    setBusyKey(k.key);
    try {
      const cid = await safeResolveControlId(k.key);
      if (!cid) {
        // Friendly message if a control still cannot be found
        alert(
          "This KPI does not yet have a control for this project.\n" +
            "Enter a value and click Update first. That will create the control link; then retry the upload.",
        );
        inputEl.value = "";
        return;
      }

      // --- IMPORT EVIDENCE ---
      const sha = await sha256Hex(file);

      await uploadEvidenceFile(projectId, cid, file, sha);

      inputEl.value = "";
      alert("Evidence uploaded & finalized.");
      if (openKey === k.key) await loadEvidence(k.key);
      router.refresh();
    } catch (err: any) {
      alert(err?.message ?? "Evidence upload failed.");
      console.error(err);
    } finally {
      setBusyKey(null);
    }
  }

  // ---------- UI helpers ----------
  function formatBytes(n?: number | null) {
    if (!n || n <= 0) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(n) / Math.log(1024));
    const val = n / Math.pow(1024, i);
    return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  }
  function formatDate(s?: string | null) {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(+d)) return s;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (list.length === 0) {
    return (
      <div className="text-sm text-gray-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4 bg-white dark:bg-slate-900">
        No KPI values found for this project yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((k, idx) => {
        const v = values[k.key] ?? "0";
        const items = evidenceList[k.key] || [];
        const lastUpdated =
          items.length ? items[0]?.updated_at || items[0]?.created_at : null;

        const hasControlProp = Boolean(k.control_id);

        return (
          <div
            key={k.key}
            className="flex flex-wrap items-center gap-3 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 bg-white dark:bg-slate-900 shadow-sm"
          >
            {/* Left: title/meta */}
            <div className="flex-1 min-w-[280px]">
              <div className="text-sm font-semibold leading-5 break-words text-slate-900 dark:text-slate-50">
                {k.name}
              </div>
              <div className="text-[11px] leading-4 text-gray-600 dark:text-slate-400 break-words">
                Pillar: {k.pillar || "-"} ·{" "}
                <span className="font-mono">{k.key}</span>
                {k.unit ? <> · Unit: {k.unit}</> : null}
              </div>

              {/* Evidence badge & dropdown */}
              <div className="mt-1">
                <button
                  className="text-[11px] px-2 py-[2px] rounded-full border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
                  onClick={async () => {
                    if (openKey === k.key) {
                      setOpenKey(null);
                    } else {
                      await loadEvidence(k.key);
                      setOpenKey(k.key);
                    }
                  }}
                  disabled={loadingListKey === k.key}
                  title={
                    lastUpdated
                      ? `Last updated: ${formatDate(lastUpdated)}`
                      : "Evidence"
                  }
                >
                  Evidence {loadingListKey === k.key ? "…" : `(${items.length})`}
                </button>

                {openKey === k.key ? (
                  <div className="mt-2 p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 shadow-sm max-w-[520px]">
                    {items.length === 0 ? (
                      <div className="text-[12px] text-gray-500 dark:text-slate-400">
                        No evidence yet
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {items.map((it: any) => (
                          <li
                            key={it.id ?? it.evidence_id ?? it.uid}
                            className="flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-[12px] truncate text-slate-900 dark:text-slate-50">
                                {it.name ?? it.filename ?? "file"}{" "}
                                <span className="text-gray-500 dark:text-slate-400">
                                  ({it.status ?? "uploaded"}
                                  {it.size_bytes
                                    ? ` · ${formatBytes(it.size_bytes)}`
                                    : ""}
                                  )
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-slate-400">
                                {formatDate(it.updated_at || it.created_at)}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Raw Value input */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600 dark:text-slate-300">
                Raw Value
              </label>
              <input
                className="w-28 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1 text-right bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                value={v}
                onChange={(e) => handleChange(k.key, e.target.value)}
                inputMode="decimal"
                title="Stored as control_values.raw_value"
              />
            </div>

            {/* Hidden file input */}
            <input
              ref={(el) => (fileRefs.current[idx] = el)}
              type="file"
              className="hidden"
              onChange={async (e) => {
                const inputEl = e.currentTarget as HTMLInputElement;
                await handleFileSelected(k, inputEl);
              }}
            />

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                className="rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
                onClick={() => fileRefs.current[idx]?.click()}
                disabled={busyKey === k.key}
                title={
                  hasControlProp
                    ? "Attach evidence file"
                    : "No control link yet. Enter a value and click Update once, then retry."
                }
              >
                Import Evidence
              </button>

              <button
                className="rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
                onClick={() => handleUpdate(k.key)}
                disabled={busyKey === k.key}
                title="Persist Raw Value (control_values.raw_value)"
              >
                Update
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
