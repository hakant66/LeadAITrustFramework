import Header from "@/app/(components)/Header";
import EntitySwitcher from "@/app/scorecard/admin/governance-dashboard-reporting/EntitySwitcher";
import BoardLevelDeckClient from "@/app/scorecard/admin/governance-dashboard-reporting/BoardLevelDeckClient";
import BackButton from "@/app/scorecard/admin/governance-dashboard-reporting/BackButton";
import { cookies } from "next/headers";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

type BoardLevelDeckResp = {
  entity_id: string;
  entity_name: string;
  deck: {
    title?: string;
    subtitle?: string;
    slides?: Array<{
      title?: string;
      subtitle?: string;
      bullets?: string[];
      metrics?: Array<{ label: string; value: string }>;
      table?: { columns?: string[]; rows?: string[][] };
      callouts?: string[];
      notes?: string;
    }>;
  };
  provider?: string;
  model?: string;
  latency_ms?: number;
  generated_at?: string;
  cache_hit?: boolean;
};

type UserEntity = { entity_id: string; role: string; name: string; slug: string; status: string | null };

export default async function PresentationDeckPage({
  entitySlug,
  entityId,
  entities,
}: {
  entitySlug: string;
  entityId: string;
  entities: UserEntity[];
}) {
  const session = await auth();
  const userLabel = session?.user?.name ?? session?.user?.email ?? "";
  const currentEntity = entities.find((e) => e.slug === entitySlug) ?? entities[0];
  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const cookieStore = await cookies();
  const headers = { cache: "no-store" as const, headers: { Cookie: cookieStore.toString() } };

  const deckRes = await fetch(
    `${appUrl.replace(/\/+$/, "")}/api/core/admin/ai-reports/board-level-deck?entity_id=${encodeURIComponent(entityId)}`,
    headers
  );
  if (!deckRes.ok) {
    const status = deckRes.status;
    const text = await deckRes.text();
    return (
      <div className="space-y-6">
        <Header title="Presentation Deck" subtitle="Executive Reporting">
          <BackButton />
        </Header>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Unable to load presentation deck ({status}).
          <div className="mt-2 text-xs text-amber-800">{text}</div>
        </div>
      </div>
    );
  }

  const deck = (await deckRes.json()) as BoardLevelDeckResp;

  return (
    <div className="space-y-6">
      <Header title="Presentation Deck" subtitle="Executive Reporting">
        <div className="flex w-full flex-wrap items-start gap-3">
          <BackButton />
          <div className="ml-auto flex flex-col items-end self-start">
            {entities.length > 1 ? (
              <EntitySwitcher
                entities={entities}
                currentSlug={entitySlug}
                basePath="/scorecard/admin/governance-dashboard-reporting/presentation-deck"
              />
            ) : currentEntity ? (
              <span
                className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white shadow-sm dark:border-white/20 dark:bg-white/5"
                title={currentEntity.slug}
              >
                {currentEntity.name}
              </span>
            ) : null}
            {userLabel ? (
              <span className="mt-1 text-xs text-white/80">{userLabel}</span>
            ) : null}
          </div>
        </div>
      </Header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Entity
            </div>
            <div className="text-lg font-semibold text-slate-900">
              {deck.entity_name}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-3 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-700">Provider:</span>{" "}
              {deck.provider ?? "—"}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Model:</span>{" "}
              {deck.model ?? "—"}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Generated:</span>{" "}
              {deck.generated_at ?? "—"}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Cache:</span>{" "}
              {deck.cache_hit ? "Hit" : "Fresh"}
            </div>
          </div>
        </div>
      </section>

      <BoardLevelDeckClient deck={deck.deck ?? null} />
    </div>
  );
}
