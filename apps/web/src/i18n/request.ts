import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

type OverrideRow = {
  english_text: string;
  locale: string;
  translated_text: string;
};

type FlatEntry = {
  key: string;
  value: string;
};

const CORE_BASE =
  process.env.CORE_SVC_URL ??
  process.env.NEXT_PUBLIC_CORE_SVC_URL ??
  "http://localhost:8001";

function flattenMessages(source: Record<string, unknown>, prefix = ""): FlatEntry[] {
  const entries: FlatEntry[] = [];
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      entries.push({ key: path, value });
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    entries.push(...flattenMessages(value as Record<string, unknown>, path));
  }
  return entries;
}

function setByPath(target: Record<string, any>, path: string, value: string) {
  const parts = path.split(".");
  let cursor: Record<string, any> = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const next = cursor[part];
    if (!next || typeof next !== "object") {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

async function loadOverrides(activeLocale: string): Promise<Map<string, string> | null> {
  if (!activeLocale || activeLocale === "en") return null;
  const url = `${CORE_BASE.replace(/\/+$/, "")}/ui-translations?locale=${encodeURIComponent(
    activeLocale
  )}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as OverrideRow[];
    if (!Array.isArray(data)) return null;
    return new Map(
      data
        .filter((row) => row && typeof row.english_text === "string")
        .map((row) => [row.english_text, row.translated_text ?? ""])
    );
  } catch {
    return null;
  }
}

export default getRequestConfig(async ({ locale }) => {
  const cookieStore = cookies();
  const cookieLocale =
    cookieStore.get("NEXT_LOCALE")?.value ?? cookieStore.get("locale")?.value;
  const requestedLocale = cookieLocale ?? locale;

  const activeLocale = routing.locales.includes(
    requestedLocale as (typeof routing.locales)[number]
  )
    ? requestedLocale
    : routing.defaultLocale;

  const baseMessages = (await import(`../messages/${activeLocale}.json`)).default as Record<
    string,
    unknown
  >;
  if (activeLocale === "en") {
    return {
      locale: activeLocale,
      messages: baseMessages,
    };
  }

  const [overrideMap, enMessages] = await Promise.all([
    loadOverrides(activeLocale),
    import("../messages/en.json").then((mod) => mod.default as Record<string, unknown>),
  ]);

  if (overrideMap && activeLocale === "tr") {
    // Force preferred TR wording for common UI verbs when overrides exist.
    overrideMap.set("View", "Görüntüle");
  }

  if (!overrideMap || overrideMap.size === 0) {
    return {
      locale: activeLocale,
      messages: baseMessages,
    };
  }

  const merged = JSON.parse(JSON.stringify(baseMessages)) as Record<string, unknown>;
  const enEntries = flattenMessages(enMessages);
  for (const entry of enEntries) {
    const override = overrideMap.get(entry.value);
    if (override !== undefined) {
      setByPath(merged, entry.key, override);
    }
  }

  return {
    locale: activeLocale,
    messages: merged,
  };
});
