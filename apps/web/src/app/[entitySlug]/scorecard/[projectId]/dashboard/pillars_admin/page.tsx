import { redirect } from "next/navigation";

export default async function EntityPillarsAdminPage({
  params,
}: {
  params: Promise<{ entitySlug: string; projectId: string }>;
}) {
  const { entitySlug } = await params;
  redirect(`/${encodeURIComponent(entitySlug)}/scorecard/dashboard/pillars_admin`);
}
