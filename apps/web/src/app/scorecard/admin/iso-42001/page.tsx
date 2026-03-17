import Link from "next/link";
import Header from "@/app/(components)/Header";

export default function Iso42001LandingPage() {
  const items = [
    {
      label: "Scope - The Boundary",
      href: "/scorecard/admin/governance-setup/aims-scope",
    },
    {
      label: "Pillar Admin",
      href: "/scorecard",
    },
    {
      label: "Manage KPIs and Controls",
      href: "/admin/manage-kpis-controls",
    },
    {
      label: "Policy - The Mandate",
      href: "/scorecard/admin/governance-setup/ai-policy-register",
    },
    {
      label: "Policy Execution",
      href: "/scorecard/admin/governance-execution/policy-execution",
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="w-full space-y-6">
        <Header
          title="ISO 42001"
          subtitle="LeadAI · AI Governance Setup"
          titleNote="Access ISO 42001 governance tasks and execution."
        />

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.label}
              </div>
              <div className="mt-2 text-xs text-slate-500 break-all">{item.href}</div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
