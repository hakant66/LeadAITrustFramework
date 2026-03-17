import Header from "@/app/(components)/Header";
import GovernanceJourneyCard from "@/app/(components)/GovernanceJourneyCard";
import GovernanceSetupFinalisedNotice from "@/app/(components)/GovernanceSetupFinalisedNotice";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import { getTranslations } from "next-intl/server";

export default async function EntityGovernanceSetupLandingPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const t = await getTranslations("GovernanceSetupLanding");
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops");
  }

  const prefix = `/${encodeURIComponent(entitySlug)}`;
  const menuItems = [
    {
      label: "Entity Setup",
      href: `${prefix}/scorecard/admin/governance-setup/entity-setup`,
    },
    {
      label: "Scope",
      href: `${prefix}/scorecard/admin/governance-setup/aims-scope`,
    },
    {
      label: "AI System Register",
      href: `${prefix}/scorecard/admin/governance-setup/ai-system-register`,
    },
    {
      label: "AI KPI Register",
      href: `${prefix}/scorecard/admin/governance-setup/ai-requirements-register`,
    },
    {
      label: "AI Control Register",
      href: `${prefix}/scorecard/admin/governance-setup/control-register`,
    },
    {
      label: "AI Policy Register",
      href: `${prefix}/scorecard/admin/governance-setup/ai-policy-register`,
    },
    {
      label: "AI Project Register",
      href: `${prefix}/scorecard/admin/governance-setup/ai-project-register`,
    },
  ];

  return (
    <div className="space-y-6">
      <Header title={t("title")} subtitle={t("subtitle")}>
        <div className="flex gap-3">
          <Link
            href="/"
            className="mt-2 inline-flex items-center px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-600 text-sm font-medium shadow-sm transition hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t("signOut")}
          </Link>
        </div>
      </Header>
      <section>
        <GovernanceJourneyCard entitySlug={entitySlug} />
      </section>
      <div className="flex justify-end">
        <GovernanceSetupFinalisedNotice entitySlug={entitySlug} />
      </div>
    </div>
  );
}
