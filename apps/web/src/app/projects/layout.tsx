import type React from "react";
import AdminSidebar from "@/app/(components)/AdminSidebar";
import { resolveNavMode } from "@/lib/navMode";

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navMode = resolveNavMode();
  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        <div
          className="grid grid-cols-1 gap-6 md:grid-cols-[var(--sidebar-width,260px)_1fr]"
        >
          <AdminSidebar navMode={navMode} />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </main>
  );
}
