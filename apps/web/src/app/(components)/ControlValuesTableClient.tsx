// apps/web/src/app/(components)/ControlValuesTableClient.tsx
"use client";

import { FilterablePaginatedTable } from "@/app/(components)/FilterablePaginatedTable";

export type ControlValueRow = {
  control_name: string;
  owner?: string | null;            // ← will be owner_role
  target?: string | number | null;  // ← target_text (fallback numeric if needed)
  current_value?: string | number | null; // ← current_value
  as_of?: string | null;            // ← date-only (DD/MM/YYYY) in render
};

function formatAsOf(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  // DD/MM/YYYY
  return d.toLocaleDateString("en-GB");
}

export default function ControlValuesTableClient({
  rows,
}: {
  rows: ControlValueRow[];
}) {
  return (
    <FilterablePaginatedTable
      rows={rows}
      columns={[
        { key: "control_name", header: "Control", render: (r) => r.control_name },
        // KPI column removed
        { key: "owner", header: "Owner", render: (r) => r.owner ?? "" },
        { key: "target", header: "Target", render: (r) => String(r.target ?? "") },
        {
          key: "current_value",
          header: "Current Value",
          render: (r) => String(r.current_value ?? ""),
        },
        { key: "as_of", header: "As of", render: (r) => formatAsOf(r.as_of) },
      ]}
      pageSize={25}
    />
  );
}
