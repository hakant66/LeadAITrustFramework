export const SINGLE_TENANT_UI =
  (process.env.LEADAI_SINGLE_TENANT_UI ??
    process.env.NEXT_PUBLIC_LEADAI_SINGLE_TENANT_UI ??
    "true") !== "false";

export const SINGLE_TENANT_SLUG =
  process.env.LEADAI_SINGLE_TENANT_SLUG ??
  process.env.NEXT_PUBLIC_LEADAI_SINGLE_TENANT_SLUG ??
  "blueprint";
