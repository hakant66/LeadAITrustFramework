// apps/web/src/app/scorecard/[projectId]/layout.tsx

import type React from "react";
import AdminSidebar from "@/app/(components)/AdminSidebar";
import ProjectSlugTracker from "@/app/(components)/ProjectSlugTracker";
import { resolveNavMode } from "@/lib/navMode";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const navMode = resolveNavMode();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100">
      <ProjectSlugTracker slug={projectId} />
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[var(--sidebar-width,260px)_1fr]">
          <AdminSidebar navMode={navMode} />
          <div className="min-w-0">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
