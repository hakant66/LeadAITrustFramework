"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { coreApiBase } from "@/lib/coreApiBase";

type ProjectRow = {
  id: string;
  slug: string;
  name?: string | null;
};

type AxisMappingRow = {
  pillar_key: string;
  pillar_name?: string | null;
  axis_key?: string | null;
  notes?: string | null;
};

type AxisMeta = {
  key: "safety" | "compliance" | "provenance";
  label: string;
  level: string;
};

type TrustAxesResp = {
  project_slug: string;
  project_name?: string | null;
  axes: Array<{
    axis_key: string;
    score_pct: number | null;
    controls: AxisControl[];
  }>;
};

type AxisControl = {
  control_id: string;
  kpi_key?: string | null;
  control_name?: string | null;
  pillar_key?: string | null;
  pillar_name?: string | null;
  axis_key: string;
  axis_source?: string | null;
  weight: number;
  score_pct: number;
};

const axisMeta: Record<AxisMeta["key"], AxisMeta> = {
  safety: { key: "safety", label: "Safety", level: "S2" },
  compliance: { key: "compliance", label: "Compliance", level: "C2" },
  provenance: { key: "provenance", label: "Provenance", level: "P2" },
};

const axisLevel = (axisKey: AxisMeta["key"], score?: number | null) => {
  if (score == null || Number.isNaN(score)) return `${axisKey[0].toUpperCase()}0`;
  if (score >= 80) return `${axisKey[0].toUpperCase()}3`;
  if (score >= 60) return `${axisKey[0].toUpperCase()}2`;
  if (score >= 40) return `${axisKey[0].toUpperCase()}1`;
  return `${axisKey[0].toUpperCase()}0`;
};

const axisLabel = (axisKey: AxisMeta["key"], level: string) => {
  const name = axisKey === "safety"
    ? "Safety"
    : axisKey === "compliance"
    ? "Compliance"
    : "Provenance";
  const tier = level.slice(1);
  if (tier === "3") return `${name} Level 3 (Advanced)`;
  if (tier === "2") return `${name} Level 2 (Assured)`;
  if (tier === "1") return `${name} Level 1 (Controlled)`;
  return `${name} Level 0 (Baseline)`;
};

export default function TrustAxisView({
  axisKey,
  basePath,
}: {
  axisKey: AxisMeta["key"];
  basePath?: string;
}) {
  const [rows, setRows] = useState<AxisMappingRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [axisScore, setAxisScore] = useState<number | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [axisControls, setAxisControls] = useState<AxisControl[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = coreApiBase();
  const meta = axisMeta[axisKey];
  const resolvedBase = basePath ?? "/scorecard/admin/control-audit";

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [mappingRes, projectsRes] = await Promise.all([
          fetch(`${base}/admin/trust-axis-mapping`, { cache: "no-store" }),
          fetch(`${base}/projects`, { cache: "no-store" }),
        ]);
        if (!mappingRes.ok) {
          throw new Error(`Failed to load axis mapping (${mappingRes.status})`);
        }
        const mappingData = (await mappingRes.json()) as AxisMappingRow[];
        if (!projectsRes.ok) {
          throw new Error(`Failed to load projects (${projectsRes.status})`);
        }
        const projectsData = (await projectsRes.json()) as ProjectRow[];
        if (!mounted) return;
        setRows(mappingData.filter((row) => row.axis_key === axisKey));
        setProjects(projectsData);
        const last =
          typeof window !== "undefined"
            ? window.localStorage.getItem("trustops.axis.project")
            : null;
        const fallbackSlug = projectsData?.[0]?.slug ?? "";
        const resolved =
          last && projectsData.some((p) => p.slug === last) ? last : fallbackSlug;
        setSelectedSlug(resolved);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? String(e));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [axisKey, base]);

  useEffect(() => {
    if (!selectedSlug) return;
    let mounted = true;
    const loadAxis = async () => {
      try {
        const res = await fetch(
          `${base}/trust/axes/${encodeURIComponent(selectedSlug)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Failed to load trust axes (${res.status})`);
        const data = (await res.json()) as TrustAxesResp;
        if (!mounted) return;
        const found = data.axes.find((axis) => axis.axis_key === axisKey);
        setAxisScore(found?.score_pct ?? null);
        setAxisControls(found?.controls ?? []);
        setProjectName(data.project_name ?? selectedSlug);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("trustops.axis.project", selectedSlug);
        }
      } catch (e: any) {
        if (!mounted) return;
        setAxisScore(null);
        setAxisControls([]);
        setProjectName(selectedSlug);
        setError(e?.message ?? String(e));
      }
    };
    void loadAxis();
    return () => {
      mounted = false;
    };
  }, [axisKey, base, selectedSlug]);

  const blockers = useMemo(() => {
    if (!rows.length) return "No blockers detected";
    const note = rows.find((row) => row.notes)?.notes;
    return note ?? "Review contributing controls";
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {Object.values(axisMeta).map((axis) => (
            <Link
              key={axis.key}
              href={`${resolvedBase}/axes/${axis.key}`}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                axis.key === axisKey
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500/60 dark:bg-indigo-500/10 dark:text-indigo-200"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {axis.label}
            </Link>
          ))}
        </div>
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Project
          <select
            className="mt-1 w-full min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            disabled={!projects.length}
          >
            {projects.length === 0 ? (
              <option value="">No projects</option>
            ) : (
              projects.map((project) => (
                <option key={project.slug} value={project.slug}>
                  {project.name ?? project.slug}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Current level
          </div>
          {(() => {
            const level = axisLevel(axisKey, axisScore);
            return (
              <>
                <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-50">
                  {level}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {axisLabel(axisKey, level)}
                </div>
              </>
            );
          })()}
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {projectName ? `${projectName} (${selectedSlug})` : selectedSlug}
          </div>
          <div className="mt-4 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Axis level rules
          </div>
          <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>Level 3 (Advanced): score ≥ 80</li>
            <li>Level 2 (Assured): score ≥ 60</li>
            <li>Level 1 (Controlled): score ≥ 40</li>
            <li>Level 0 (Baseline): score &lt; 40</li>
          </ul>
          <div className="mt-4 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Top blocker
          </div>
          <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            {blockers}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold">Contributing Controls</div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Controls contributing to this axis for the selected project.
              </p>
            </div>
            {loading && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Loading…
              </span>
            )}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-200">
                <tr>
                  <th className="p-2 text-left">Control</th>
                  <th className="p-2 text-left">Pillar</th>
                  <th className="p-2 text-left">Weight</th>
                  <th className="p-2 text-left">Score</th>
                  <th className="p-2 text-left">Source</th>
                </tr>
              </thead>
              <tbody>
                {axisControls.map((row) => (
                  <tr
                    key={`${row.control_id}-${row.kpi_key ?? ""}`}
                    className="border-b border-slate-100 dark:border-slate-700/70"
                  >
                    <td className="p-2">
                      <div className="text-sm font-medium">
                        {row.control_name ?? row.kpi_key ?? row.control_id}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {row.control_id}
                      </div>
                    </td>
                    <td className="p-2">{row.pillar_name ?? row.pillar_key ?? "—"}</td>
                    <td className="p-2">{row.weight.toFixed(2)}</td>
                    <td className="p-2">{row.score_pct.toFixed(2)}</td>
                    <td className="p-2 text-xs text-slate-500 dark:text-slate-400">
                      {row.axis_source ?? "—"}
                    </td>
                  </tr>
                ))}
                {!axisControls.length && !loading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-3 text-sm text-slate-500 dark:text-slate-400"
                    >
                      No contributing controls found for this axis.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="text-base font-semibold">Required Actions</div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            What to fix before the next level.
          </p>
          <ul className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li>Confirm latest review cadence</li>
            <li>Refresh evidence hashes</li>
            <li>Verify regulatory checklist</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
