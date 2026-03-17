import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import ProjectRegisterPage from "@/app/(components)/ProjectRegisterPage";
import { findEntityBySlug } from "@/lib/entityValidation";

type UserEntity = {
  entity_id: string;
  role: string;
  name: string;
  slug: string;
  status: string | null;
};

/**
 * Entity-scoped AI Project Management: /{entitySlug}/scorecard/admin/governance-execution/ai-project-management
 * Validates user has access to the entity and renders the project management page without capture card.
 */
export default async function EntityGovernanceProjectManagementPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin");
  }

  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const cookieStore = await cookies();
  const headers = { cache: "no-store" as const, headers: { Cookie: cookieStore.toString() } };

  const entity = await findEntityBySlug(entitySlug);
  if (!entity) {
    const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers);
    if (res.ok) {
      const entities = (await res.json()) as Array<{ slug: string }>;
      const first = entities[0];
      if (first) {
        redirect(`/${encodeURIComponent(first.slug)}/scorecard/admin/governance-execution/ai-project-management`);
      }
    }
    if (!res.ok && res.status === 401) {
      redirect(
        "/register?callbackUrl=" + encodeURIComponent(`/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-execution/ai-project-management`)
      );
    }
    redirect("/scorecard/admin/governance-execution/ai-project-management");
  }

  // Render ProjectRegisterPage without the capture card
  return (
    <ProjectRegisterPage
      navMode={navMode}
      showProjectList={true}
      hideCaptureCard={true}
      title="AI Project Management"
      subtitle="LeadAI · AI Governance Execution"
      entityId={entity.entity_id}
    />
  );
}
