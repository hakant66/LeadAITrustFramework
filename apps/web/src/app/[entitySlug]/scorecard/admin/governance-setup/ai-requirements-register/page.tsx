import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import RequirementRegisterPage from "@/app/scorecard/admin/trustops/requirements/page";
import { findEntityBySlug } from "@/lib/entityValidation";

export default async function EntityGovernanceRequirementsRegisterPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/requirements");
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
        redirect(`/${encodeURIComponent(first.slug)}/scorecard/admin/governance-setup/ai-requirements-register`);
      }
    }
    if (!res.ok && res.status === 401) {
      redirect(
        "/register?callbackUrl=" + encodeURIComponent(`/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup/ai-requirements-register`)
      );
    }
    redirect("/scorecard/admin/governance-setup/ai-requirements-register");
  }

  let assessment = null as
    | {
        primaryRole?: string | null;
        riskClassification?: string | null;
        decisionTrace?: string | null;
      }
    | null;
  try {
    const entityRes = await fetch(
      `${appUrl.replace(/\/+$/, "")}/api/core/entity/by-slug/${encodeURIComponent(entitySlug)}`,
      headers
    );
    if (entityRes.ok) {
      const data = await entityRes.json();
      assessment = {
        primaryRole: data.primaryRole ?? null,
        riskClassification: data.riskClassification ?? null,
        decisionTrace: data.decisionTrace ?? null,
      };
    }
  } catch {
    assessment = null;
  }

  return <RequirementRegisterPage assessment={assessment} entityId={entity.entity_id} />;
}
