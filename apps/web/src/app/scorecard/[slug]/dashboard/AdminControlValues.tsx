// apps/web/src/app/scorecard/[slug]/dashboard/AdminControlValues.tsx
// SERVER COMPONENT
import ControlValuesTableClient, {
  ControlValueRow,
} from "@/app/(components)/ControlValuesTableClient";

type ControlApiItem = {
  // what your /scorecard/{slug}/controls endpoint returns
  control_name?: string;            // optional if you also send it
  kpi_key: string;                  // always present
  owner_role?: string | null;
  target_text?: string | null;
  target_numeric?: number | null;
  raw_value?: number | string | null;
  updated_at?: string | null;
};

function toRows(items: ControlApiItem[]): ControlValueRow[] {
  return items.map((i) => ({
    control_name: i.control_name ?? i.kpi_key,
    owner: i.owner_role ?? null,
    target:
      i.target_text && i.target_text.trim() !== ""
        ? i.target_text
        : typeof i.target_numeric === "number"
        ? i.target_numeric
        : null,
    current_value: i.raw_value ?? null,
    as_of: i.updated_at ?? null,
  }));
}

async function fetchControls(slug: string): Promise<ControlApiItem[]> {
  const base =
    process.env.CORE_SVC_URL ||
    process.env.NEXT_PUBLIC_CORE_SVC_URL ||
    "http://localhost:8001";

  const res = await fetch(
    `${base.replace(/\/+$/, "")}/scorecard/${encodeURIComponent(
      slug
    )}/controls`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    // Be resilient: return an empty list on failure so the page still renders.
    // You can also surface an error banner here if you prefer.
    return [];
  }

  const payload = await res.json();
  // Accept a few common server shapes: {items:[]}, {data:[]}, [] …
  const list: any[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.rows)
    ? payload.rows
    : [];

  // Narrow to the fields we actually use
  return list.map((it) => ({
    control_name: it.control_name ?? it.name ?? undefined,
    kpi_key: String(it.kpi_key ?? it.key ?? ""),
    owner_role: it.owner_role ?? null,
    target_text: it.target_text ?? null,
    target_numeric:
      typeof it.target_numeric === "number" ? it.target_numeric : null,
    raw_value:
      typeof it.raw_value === "number" || typeof it.raw_value === "string"
        ? it.raw_value
        : null,
    updated_at: it.updated_at ?? it.observed_at ?? null,
  })) as ControlApiItem[];
}

export default async function AdminControlValues({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params.slug;
  const items = await fetchControls(slug);
  const rows = toRows(items);

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
        Control Values
      </h3>
      <ControlValuesTableClient rows={rows} />
    </section>
  );
}
