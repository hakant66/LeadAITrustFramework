"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { SINGLE_TENANT_UI } from "@/lib/singleTenant";

type UserEntity = { entity_id: string; role: string; name: string; slug: string; status: string | null };

export default function EntitySwitcher({
  entities,
  currentSlug,
  basePath = "/scorecard/admin/governance-dashboard-reporting",
  className = "",
}: {
  entities: UserEntity[];
  currentSlug: string;
  basePath?: string;
  className?: string;
}) {
  const t = useTranslations("GovernanceDashboard");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (SINGLE_TENANT_UI || entities.length <= 1) return null;

  const current = entities.find((e) => e.slug === currentSlug) ?? entities[0];

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-white/20 dark:border-white/20 dark:bg-white/5 dark:hover:bg-white/10"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("switchEntity")}
      >
        {current.name}
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul
          className="absolute right-0 top-full z-50 mt-1 min-w-[12rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          role="listbox"
        >
          {entities.map((e) => (
            <li key={e.entity_id} role="option" aria-selected={e.slug === currentSlug}>
              <Link
                href={`/${encodeURIComponent(e.slug)}${basePath}`}
                className={`block px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  e.slug === currentSlug ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200" : "text-slate-700 dark:text-slate-200"
                }`}
                onClick={() => setOpen(false)}
              >
                {e.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
