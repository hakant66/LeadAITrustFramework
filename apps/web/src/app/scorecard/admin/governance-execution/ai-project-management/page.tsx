import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import ProjectRegisterPage from "@/app/(components)/ProjectRegisterPage";
import { findEntityBySlug } from "@/lib/entityValidation";

/**
 * Global AI Project Management: /scorecard/admin/governance-execution/ai-project-management
 * Fetches user's first entity and redirects to entity-scoped URL.
 */
export default async function GovernanceProjectManagementPage() {
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

  const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers);
  if (!res.ok) {
    if (res.status === 401) {
      redirect("/register?callbackUrl=" + encodeURIComponent("/scorecard/admin/governance-execution/ai-project-management"));
    }
    // Fallback: render without entity context
    return (
      <ProjectRegisterPage
        navMode={navMode}
        showProjectList={true}
        hideCaptureCard={true}
        title="AI Project Management"
        subtitle="LeadAI · AI Governance Execution"
      />
    );
  }

  const entities = (await res.json()) as Array<{ slug: string }>;
  const first = entities.length > 0 ? entities[0] : null;
  if (!first) {
    // Fallback: render without entity context
    return (
      <ProjectRegisterPage
        navMode={navMode}
        showProjectList={true}
        hideCaptureCard={true}
        title="AI Project Management"
        subtitle="LeadAI · AI Governance Execution"
      />
    );
  }

  redirect(`/${encodeURIComponent(first.slug)}/scorecard/admin/governance-execution/ai-project-management`);
}
