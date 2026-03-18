import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { resolveNavMode } from "@/lib/navMode";
import { SINGLE_TENANT_UI } from "@/lib/singleTenant";
import ProjectRegisterPage from "@/app/(components)/ProjectRegisterPage";

type UserEntity = {
  entity_id: string;
  role: string;
  name: string;
  slug: string;
  status: string | null;
};

/**
 * Entity-scoped projects register: /{entitySlug}/projects/register
 * Validates user has access to the entity and renders the project register page.
 */
export default async function EntityProjectsRegisterPage({
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

  // Check if user is master admin
  const masterAdminRes = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/is-master-admin`, headers);
  const isMasterAdmin = masterAdminRes.ok && (await masterAdminRes.json()) === true;

  const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers);
  if (!res.ok) {
    if (res.status === 401) {
      redirect(
        "/register?callbackUrl=" + encodeURIComponent(`/${encodeURIComponent(entitySlug)}/projects/register`)
      );
    }
    redirect("/projects/register");
  }

  const entities = (await res.json()) as UserEntity[];
  let entity = entities.find((e) => e.slug === entitySlug);

  // In single-tenant mode, trust the URL slug even if user_entity_access is stale or filtered.
  if (!entity && (isMasterAdmin || SINGLE_TENANT_UI)) {
    const entityBySlugRes = await fetch(
      `${appUrl.replace(/\/+$/, "")}/api/core/entity/by-slug/${encodeURIComponent(entitySlug)}`,
      headers
    );
    if (entityBySlugRes.ok) {
      const entityData = await entityBySlugRes.json();
      entity = {
        entity_id: entityData.id,
        role: "admin",
        name: entityData.fullLegalName,
        slug: entityData.slug ?? entitySlug,
        status: entityData.status,
      };
    }
  }

  if (!entity) {
    if (SINGLE_TENANT_UI) {
      redirect(`/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup/entity-setup`);
    }
    const first = entities[0];
    if (first) {
      redirect(`/${encodeURIComponent(first.slug)}/projects/register`);
    }
    redirect("/projects/register");
  }

  // ProjectRegisterPage is a client component that will use coreApiBase() which proxies to core-svc
  // The entity_id will be passed via query param or header when needed
  const t = await getTranslations("ProjectRegisterPage");
  return (
    <ProjectRegisterPage
      navMode={navMode}
      showProjectList
      listCaptureTop
      hideProjectAdminLinks
      entityId={entity.entity_id}
      entitySlug={entity.slug}
      title={t("title")}
      subtitle="Governance Setup"
      titleNote={t("stepNote")}
      showHeaderNextStep={false}
      showBottomNextStep={true}
      nextStepHref={`/${encodeURIComponent(entity.slug)}/scorecard/admin/governance-setup/ai-system-register`}
    />
  );
}
