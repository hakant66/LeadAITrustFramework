import Header from "@/app/(components)/Header";
import Link from "next/link";
import { resolveNavMode } from "@/lib/navMode";

export default function DataManagerLandingPage() {
  const navMode = resolveNavMode();
  const isLegacy = navMode === "legacy";
  const title = isLegacy ? "Data Manager" : "AI Data Register";
  const subtitle = isLegacy ? "LeadAI · Admin" : "LeadAI · AI Data Register";
  const base = isLegacy
    ? "/scorecard/admin/data-manager"
    : "/scorecard/admin/data-register";
  const cards = [
    {
      title: "Data Sources",
      description: "Connect and track source systems feeding AI pipelines.",
      href: `${base}/data-sources`,
    },
    {
      title: "Data Classification",
      description: "Tag sensitivity, PII, and governance tiers.",
      href: `${base}/data-classification`,
    },
    {
      title: "Retention & Deletion",
      description: "Manage retention windows and deletion workflows.",
      href: `${base}/retention`,
    },
    {
      title: "Interfaces",
      description: "Configure and manage external integrations (Jira, etc.) for governance evidence.",
      href: `${base}/interfaces`,
    },
  ];
  return (
    <div className="space-y-6">
      <Header title={title} subtitle={subtitle} />
      <section className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {card.title}
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {card.description}
            </p>
            <div className="mt-3 text-sm text-indigo-600 dark:text-indigo-300">
              Open →
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
