// apps/web/src/app/(components)/PillarBarLink.tsx
"use client";

import { useRouter } from "next/navigation";
import PillarBar from "./PillarBar";

type Pillar = { key?: string; pillar: string; score: number; weight?: number; maturity?: number };

export default function PillarBarLink({
  projectSlug,
  pillars,
  threshold = 75,
  labelField = "key",
}: {
  projectSlug: string;
  pillars: Pillar[];
  threshold?: number;
  labelField?: "pillar" | "key";
}) {
  const router = useRouter();

  return (
    <PillarBar
      pillars={pillars}
      threshold={threshold}
      labelField={labelField}
      onBarClick={(d) => {
        const id = encodeURIComponent(d.id);
        router.push(`/scorecard/${encodeURIComponent(projectSlug)}/pillars/${id}`);
      }}
    />
  );
}
