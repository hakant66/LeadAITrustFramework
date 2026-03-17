"use client";

import { Settings, ShieldCheck, Edit3 } from "lucide-react";

export default function DashboardShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <button className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </div>
      <div className="mt-6 grid gap-6">{children}</div>
      <div className="mt-10 flex items-center gap-2 text-xs text-gray-500">
        <ShieldCheck className="h-4 w-4" />
        <span>LeadAI Trust Platform · MVP Dashboard</span>
      </div>
    </div>
  );
}
