// apps/web/src/app/[entitySlug]/scorecard/[projectId]/dashboard/page.tsx
import ScorecardDashboard from "@/app/scorecard/[projectId]/dashboard/page";

export const dynamic = "force-dynamic";
export { metadata } from "@/app/scorecard/[projectId]/dashboard/page";

function normalizeProjectId(rawProjectId: string): string {
  let value = rawProjectId;
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }
  return value;
}

export default async function EntityScorecardDashboard(props: {
  params: Promise<{ entitySlug: string; projectId: string }>;
  searchParams?: { tab?: string };
}) {
  const { projectId } = await props.params;
  const normalizedProjectId = normalizeProjectId(projectId);
  return ScorecardDashboard({
    params: Promise.resolve({ projectId: normalizedProjectId }),
    searchParams: props.searchParams,
  });
}
