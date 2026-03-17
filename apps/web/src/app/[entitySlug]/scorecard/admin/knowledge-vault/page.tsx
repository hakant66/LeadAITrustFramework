import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import KnowledgeVaultClient from "@/app/(components)/KnowledgeVaultClient";

type UserEntity = {
  entity_id: string;
  role: string;
  name: string;
  slug: string;
  status: string | null;
};

export default async function EntityKnowledgeVaultPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
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
  const headers = {
    cache: "no-store" as const,
    headers: { Cookie: cookieStore.toString() },
  };

  const masterAdminRes = await fetch(
    `${appUrl.replace(/\/+$/, "")}/api/core/user/is-master-admin`,
    headers
  );
  const isMasterAdmin = masterAdminRes.ok && (await masterAdminRes.json()) === true;

  const res = await fetch(
    `${appUrl.replace(/\/+$/, "")}/api/core/user/entities`,
    headers
  );
  if (!res.ok) {
    if (res.status === 401) {
      redirect(
        "/register?callbackUrl=" +
          encodeURIComponent(
            `/${encodeURIComponent(entitySlug)}/scorecard/admin/knowledge-vault`
          )
      );
    }
    redirect("/scorecard/admin/knowledge-vault");
  }

  const entities = (await res.json()) as UserEntity[];
  let entity = entities.find((e) => e.slug === entitySlug);

  if (!entity && isMasterAdmin) {
    const entityBySlugRes = await fetch(
      `${appUrl.replace(/\/+$/, "")}/api/core/entity/by-slug/${encodeURIComponent(
        entitySlug
      )}`,
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
    const first = entities[0];
    if (first) {
      redirect(
        `/${encodeURIComponent(first.slug)}/scorecard/admin/knowledge-vault`
      );
    }
    redirect("/scorecard/admin/knowledge-vault");
  }

  return (
    <KnowledgeVaultClient entityId={entity.entity_id} entitySlug={entitySlug} />
  );
}
