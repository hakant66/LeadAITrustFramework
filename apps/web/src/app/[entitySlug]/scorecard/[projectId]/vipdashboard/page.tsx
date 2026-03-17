// apps/web/src/app/[entitySlug]/scorecard/[projectId]/vipdashboard/page.tsx
import VipDashboard from "@/app/scorecard/[projectId]/vipdashboard/page";

export const dynamic = "force-dynamic";
export { metadata } from "@/app/scorecard/[projectId]/vipdashboard/page";

export default async function EntityVipDashboard(props: {
  params: Promise<{ entitySlug: string; projectId: string }>;
  searchParams?: { tab?: string };
}) {
  const { projectId } = await props.params;
  return VipDashboard({
    params: Promise.resolve({ projectId }),
    searchParams: props.searchParams,
  });
}
