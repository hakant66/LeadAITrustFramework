"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

type NavItem = {
  label: string;
  href: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const STORAGE_KEY = "leadai.sidebar.landing";

export default function LandingSidebar() {
  const t = useTranslations("Home");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    if (stored === "collapsed") {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      collapsed ? "collapsed" : "expanded"
    );
  }, [collapsed]);

  const width = useMemo(() => (collapsed ? "72px" : "260px"), [collapsed]);

  const groups: NavGroup[] = [
    {
      title: t("sidebar.mainTitle"),
      items: [
        { label: t("sidebar.main.overview"), href: "/" },
        {
          label: t("sidebar.main.aiGovernance"),
          href: "/scorecard/admin/governance-dashboard-reporting",
        },
        { label: t("sidebar.main.about"), href: "https://www.theleadai.co.uk/" },
      ],
    },
    {
      title: t("sidebar.accountTitle"),
      items: [
        { label: t("sidebar.account.create"), href: "/register" },
        { label: t("sidebar.account.signIn"), href: "/register" },
      ],
    },
  ];

  return (
    <aside
      className="relative flex min-h-screen flex-col border-r border-slate-200 bg-white/95 px-4 py-6 text-slate-800 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-100"
      style={{ width }}
    >
      <div className="mb-6 flex items-center justify-between">
        {!collapsed && (
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
            LeadAI
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-slate-50"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      <nav className={`${collapsed ? "hidden" : "block"} space-y-6`}>
        {groups.map((group) => (
          <div key={group.title} className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              {group.title}
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={`${group.title}-${item.label}`}>
                  <Link
                    href={item.href}
                    className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
