// apps/web/src/app/api/kpis/route.ts
import { NextRequest, NextResponse } from "next/server";

// Optional: seed known KPI descriptions here if you have them.
// Anything not in the map will return { description: null } and the UI still works.
const KPI_DESC: Record<string, string> = {
  // e.g. "findings_sla_days": "Average days to close Sev1/Sev2 findings.",
  // "phase_gate_ontime": "Percentage of changes approved on time.",
};

export async function GET(req: NextRequest) {
  const keys = (req.nextUrl.searchParams.get("keys") || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  // Build a minimal payload the UI expects. No calls to the core service.
  const data = keys.map((key) => ({
    key,
    description: KPI_DESC[key] ?? null,
  }));

  return NextResponse.json(data, { status: 200 });
}
