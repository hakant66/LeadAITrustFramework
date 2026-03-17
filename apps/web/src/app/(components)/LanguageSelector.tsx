"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Check, Globe } from "lucide-react";

const LOCALES = ["en", "tr"] as const;

export default function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const setLocale = (nextLocale: (typeof LOCALES)[number]) => {
    if (nextLocale === locale) {
      setOpen(false);
      return;
    }
    document.cookie = `locale=${nextLocale};path=/;max-age=31536000;SameSite=Lax`;
    document.cookie = `NEXT_LOCALE=${nextLocale};path=/;max-age=31536000;SameSite=Lax`;
    setOpen(false);
    router.refresh();
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const localeLabel = (value: (typeof LOCALES)[number]) =>
    value === "tr" ? "🇹🇷 tr" : "🇬🇧 en";
  const label = localeLabel(locale === "tr" ? "tr" : "en");

  if (!mounted) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Globe className="h-4 w-4" aria-hidden />
        <span>{label}</span>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
          {LOCALES.map((value) => {
            const active = value === locale;
            const itemLabel = localeLabel(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => setLocale(value)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-sm transition ${
                  active
                    ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
                }`}
                role="menuitem"
              >
                <span className="truncate">{itemLabel}</span>
                {active ? (
                  <Check className="h-4 w-4 text-emerald-500" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
