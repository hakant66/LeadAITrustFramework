"use client";

import Header from "@/app/(components)/Header";
import DataManagerModal from "@/app/(components)/DataManagerModal";
import { resolveNavMode } from "@/lib/navMode";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";

export default function AimsScopePage() {
  const params = useParams();
  const router = useRouter();
  const entitySlug = params?.entitySlug as string | undefined;
  const navMode = resolveNavMode();

  // Redirect to legacy URL if in legacy mode
  if (navMode === "legacy") {
    router.replace("/scorecard/admin/trustops/aims-scope");
    return null;
  }

  const subtitle = "LeadAI · Governance Setup";

  return (
    <div className="space-y-6">
      <Header title="Scope" subtitle={subtitle} />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <DataManagerModal
          open={true}
          embedded={true}
          showHeader={false}
          showTabs={false}
          initialTab="aims-scope"
          allowedTabs={["aims-scope"]}
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            const target = entitySlug
              ? `/${encodeURIComponent(entitySlug)}/projects/register`
              : "/projects/register";
            router.push(target);
          }}
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          Next Step : AI Project Register
        </button>
      </div>
    </div>
  );
}
