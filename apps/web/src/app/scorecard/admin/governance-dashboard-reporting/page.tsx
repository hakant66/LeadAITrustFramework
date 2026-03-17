import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Header from "@/app/(components)/Header";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { resolveNavMode } from "@/lib/navMode";

type UserEntity = { entity_id: string; role: string; name: string; slug: string; status: string | null };

/**
 * Global governance dashboard URL (no entity in path).
 * Fetches user's first entity and redirects to entity-scoped URL so the slug appears in the URL.
 */
export default async function GovernanceDashboardReportingRedirectPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard");
  }

  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const cookieStore = await cookies();
  const headers = { cache: "no-store" as const, headers: { Cookie: cookieStore.toString() } };

  const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers);
  if (!res.ok) {
    if (res.status === 401) {
      redirect("/register?callbackUrl=" + encodeURIComponent("/scorecard/admin/governance-dashboard-reporting"));
    }
    const t = await getTranslations("GovernanceDashboard");
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
        <Header title={t("title")} subtitle={t("subtitle")} />
        <div className="mx-auto max-w-2xl px-6 py-12">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="font-medium text-amber-900 dark:text-amber-200">Unable to load dashboard</p>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
              Could not load your entities. Please try again.
            </p>
            <Link
              href="/scorecard/admin/governance-dashboard-reporting"
              className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Retry
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const entities = (await res.json()) as UserEntity[];
  const first = entities.length > 0 ? entities[0] : null;
  if (!first) {
    const t = await getTranslations("GovernanceDashboard");
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
        <Header title={t("title")} subtitle={t("subtitle")} />
        <div className="mx-auto max-w-2xl px-6 py-12">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="font-medium text-amber-900 dark:text-amber-200">Entity access required</p>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
              You don&apos;t have access to any entity. Ask your administrator to grant you access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  redirect(`/${encodeURIComponent(first.slug)}/scorecard/admin/governance-dashboard-reporting`);
}
