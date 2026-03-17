export type NavMode = "legacy" | "v2";

export function resolveNavMode(): NavMode {
  const raw = (process.env.LEADAI_NAV_MODE ?? "").toLowerCase();
  return raw === "legacy" ? "legacy" : "v2";
}

export function isLegacyNavMode(navMode?: NavMode): boolean {
  return navMode === "legacy";
}
