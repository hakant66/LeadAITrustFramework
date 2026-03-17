// apps/web/src/app/page.tsx
"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import LandingSidebar from "./(components)/LandingSidebar";
import {
  Boxes,
  LineChart,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const highlights = [
  { key: "proactiveCompliance", icon: ShieldCheck },
  { key: "liveRiskScorecards", icon: LineChart },
  { key: "aiInformedWorkflows", icon: Sparkles },
  { key: "centralizedGovernance", icon: Boxes },
];

export default function Home() {
  const t = useTranslations("Home");

  return (
    <div className="flex min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <LandingSidebar />
      <main className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_55%)]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-16 lg:flex-row lg:items-center lg:gap-16 lg:px-12">
          <section className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              href="https://www.theleadai.co.uk/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("hero.aria.openLeadAi")}
            >
              <Image
                src="/LeadAI.webp"
                alt={t("hero.logoAlt")}
                width={128}
                height={32}
                className="h-8 w-auto transition hover:opacity-80"
                priority
              />
            </a>
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mt-6 max-w-xl text-base text-slate-600 dark:text-slate-300 sm:text-lg">
            {t("hero.description")}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/ai_legal_standing"
              className="inline-flex items-center rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-200"
            >
              {t("buttons.aiLegalStanding")}
            </a>
            <a
              href="/aireadinesscheck"
              className="inline-flex items-center rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-200"
            >
              {t("buttons.aiReadinessCheck")}
            </a>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {highlights.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {t(`highlights.${key}.title`)}
                  </h3>
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                  {t(`highlights.${key}.description`)}
                </p>
              </div>
            ))}
          </div>
          </section>

        </div>
      </main>
    </div>
  );
}
