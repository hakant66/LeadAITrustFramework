import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ReportSchedulePage from "@/app/admin/reportschedule/page";
import { findEntityBySlug } from "@/lib/entityValidation";

export default async function EntityReportSchedulePage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;

  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const cookieStore = await cookies();
  const headers = { cache: "no-store" as const, headers: { Cookie: cookieStore.toString() } };

  const entity = await findEntityBySlug(entitySlug);
  if (!entity) {
    // Try to get first entity for redirect
    const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers);
    if (res.ok) {
      const entities = (await res.json()) as Array<{ slug: string }>;
      const first = entities[0];
      if (first) {
        redirect(`/${encodeURIComponent(first.slug)}/admin/reportschedule`);
      }
    }
    if (!res.ok && res.status === 401) {
      redirect(
        "/register?callbackUrl=" + encodeURIComponent(`/${encodeURIComponent(entitySlug)}/admin/reportschedule`)
      );
    }
    redirect("/admin/reportschedule");
  }

  return <ReportSchedulePage />;
}
