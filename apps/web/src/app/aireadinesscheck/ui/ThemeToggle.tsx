"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/app/theme-provider";

const pills = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 p-1 text-xs text-slate-700 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
      {pills.map(({ value, label, Icon }) => {
        const active =
          value === theme || (value === "system" && theme === "system");
        const aria =
          value === "system"
            ? `${label} (currently ${resolvedTheme})`
            : label;
        return (
          <button
            key={value}
            type="button"
            aria-label={aria}
            onClick={() => setTheme(value)}
            className={`flex items-center gap-1 rounded-full px-2 py-1 transition-colors ${
              active
                ? "bg-blue-600 text-white"
                : "hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
