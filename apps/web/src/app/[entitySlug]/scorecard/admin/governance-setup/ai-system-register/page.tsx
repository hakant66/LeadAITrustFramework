"use client";

import Header from "@/app/(components)/Header";
import DataManagerModal from "@/app/(components)/DataManagerModal";
import { resolveNavMode } from "@/lib/navMode";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ProjectRow = {
  slug: string;
  name?: string | null;
};

type AiSystemRow = {
  id: string;
  uc_id?: string | null;
  project_slug?: string | null;
  model_provider?: string | null;
};

export default function AISystemRegisterPage() {
  const params = useParams();
  const router = useRouter();
  const entitySlug = params?.entitySlug as string | undefined;
  const navMode = resolveNavMode();
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [aiSystems, setAiSystems] = useState<AiSystemRow[]>([]);

  // Redirect to legacy URL if in legacy mode
  if (navMode === "legacy") {
    router.replace("/scorecard/admin/trustops/registry");
    return null;
  }

  const subtitle = "Governance Setup";
  const title = "AI System Register";

  useEffect(() => {
    if (!entitySlug) return;
    let cancelled = false;
    const loadEntity = async () => {
      try {
        const res = await fetch(`/api/core/entity/by-slug/${encodeURIComponent(entitySlug)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Failed to load entity (${res.status})`);
        }
        const data = (await res.json()) as { id?: string };
        if (!cancelled) {
          setEntityId(data.id ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setEntityError(err instanceof Error ? err.message : "Failed to load entity");
        }
      }
    };
    loadEntity();
    return () => {
      cancelled = true;
    };
  }, [entitySlug]);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    const loadMatrixData = async () => {
      setMatrixLoading(true);
      setMatrixError(null);
      try {
        const projectsUrl = `/api/core/projects?entity_id=${encodeURIComponent(entityId)}`;
        const systemsUrl = `/api/core/admin/ai-systems?entity_id=${encodeURIComponent(entityId)}&limit=500`;
        const [projectsRes, systemsRes] = await Promise.all([
          fetch(projectsUrl, { cache: "no-store" }),
          fetch(systemsUrl, { cache: "no-store" }),
        ]);
        if (!projectsRes.ok) {
          throw new Error(`Failed to load projects (${projectsRes.status})`);
        }
        if (!systemsRes.ok) {
          throw new Error(`Failed to load AI systems (${systemsRes.status})`);
        }

        const projectsData = (await projectsRes.json()) as ProjectRow[];
        const systemsData = (await systemsRes.json()) as { items?: AiSystemRow[] };
        if (cancelled) return;

        setProjects(Array.isArray(projectsData) ? projectsData : []);
        setAiSystems(Array.isArray(systemsData?.items) ? systemsData.items : []);
      } catch (err) {
        if (!cancelled) {
          setMatrixError(
            err instanceof Error ? err.message : "Failed to load AI systems and projects matrix"
          );
        }
      } finally {
        if (!cancelled) {
          setMatrixLoading(false);
        }
      }
    };
    void loadMatrixData();
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  const matrixSystems = useMemo(() => {
    return aiSystems
      .filter((row) => Boolean(row.uc_id))
      .sort((a, b) =>
        String(a.uc_id ?? "").localeCompare(String(b.uc_id ?? ""), undefined, {
          sensitivity: "base",
        })
      );
  }, [aiSystems]);

  return (
    <div className="space-y-6">
      <Header title={title} subtitle={subtitle} titleNote="Step 4 of 6" />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {entityError ? (
          <div className="p-6 text-sm text-red-600 dark:text-red-400">
            {entityError}
          </div>
        ) : !entityId ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
            Loading entity context…
          </div>
        ) : (
          <DataManagerModal
            open={true}
            embedded={true}
            showHeader={false}
            showTabs={false}
            initialTab="registry"
            allowedTabs={["registry"]}
            entityId={entityId}
            entitySlug={entitySlug}
          />
        )}
        <div className="flex justify-end border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              const target = entitySlug
                ? `/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup/ai-requirements-register`
                : "/scorecard/admin/governance-setup/ai-requirements-register";
              router.push(target);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            Next Step: Requirements Register
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            AI Systems and Projects
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Matrix matching projects (rows) to AI systems by Use Case Reference (columns). Each
            matched cell shows the model provider.
          </p>
        </div>

        {matrixLoading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Loading matrix…</div>
        ) : matrixError ? (
          <div className="text-sm text-red-600 dark:text-red-400">{matrixError}</div>
        ) : projects.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            No projects found for this entity.
          </div>
        ) : matrixSystems.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            No AI systems found for this entity.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Projects
                  </th>
                  {matrixSystems.map((system) => (
                    <th
                      key={system.id}
                      className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      title={system.uc_id ?? ""}
                    >
                      {system.uc_id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.slug}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                      {project.name || project.slug}
                    </td>
                    {matrixSystems.map((system) => {
                      const isMatch = (system.project_slug ?? "") === project.slug;
                      const provider = system.model_provider?.trim() || "—";
                      return (
                        <td
                          key={`${project.slug}-${system.id}`}
                          className="border-b border-slate-200 px-3 py-2 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                        >
                          {isMatch ? provider : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
