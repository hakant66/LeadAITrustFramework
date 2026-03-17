// apps/web/src/app/scorecard/[projectId]/controls/[kpiKey]/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ArchivedProjectNotice from "@/app/(components)/ArchivedProjectNotice";

export const dynamic = "force-dynamic";

type UserEntity = { entity_id: string; slug: string };

type ScorecardResponse = {
  project?: { slug?: string; name?: string };
  project_slug?: string;
};

async function resolveEntityForProject(
  appBase: string,
  cookieHeader: string,
  projectId: string,
): Promise<UserEntity | null | "archived"> {
  const entitiesRes = await fetch(`${appBase}/api/core/user/entities`, {
    cache: "no-store",
    headers: { Cookie: cookieHeader },
  });
  if (!entitiesRes.ok) return null;
  const entities = (await entitiesRes.json()) as UserEntity[];
  for (const entity of entities) {
    const candidate = await fetch(
      `${appBase}/api/core/scorecard/${encodeURIComponent(projectId)}?entity_id=${encodeURIComponent(entity.entity_id)}`,
      { cache: "no-store", headers: { Cookie: cookieHeader } },
    );
    if (candidate.status === 410) return "archived";
    if (candidate.ok) return entity;
  }
  return null;
}

export default async function GlobalControlEvidencePage({
  params,
}: {
  params: Promise<{ projectId: string; kpiKey: string }>;
}) {
  const { projectId, kpiKey } = await params;

  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const appBase = appUrl.replace(/\/+$/, "");
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const resolved = await resolveEntityForProject(appBase, cookieHeader, projectId);
  if (resolved === "archived") {
    return (
      <ArchivedProjectNotice
        projectId={projectId}
        subtitle="LeadAI · Control Evidence"
      />
    );
  }
  if (resolved?.slug) {
    redirect(
      `/${encodeURIComponent(resolved.slug)}/scorecard/${encodeURIComponent(projectId)}/controls/${encodeURIComponent(kpiKey)}`,
    );
  }

  // Fallback: show archived notice / missing access
  return (
    <ArchivedProjectNotice
      projectId={projectId}
      subtitle="LeadAI · Control Evidence"
    />
  );
}
