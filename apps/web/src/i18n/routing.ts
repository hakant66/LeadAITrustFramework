export const routing = {
  locales: ["en", "tr"] as const,
  defaultLocale: "en",
};

export type Locale = (typeof routing.locales)[number];
