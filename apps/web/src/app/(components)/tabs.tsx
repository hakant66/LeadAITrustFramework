// apps/web/src/app/(components)/tabs.tsx
"use client";

import * as React from "react";
import clsx from "clsx";

type TabsContextValue = { value: string; setValue: (v: string) => void };
const TabsCtx = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  defaultValue,
  value: controlled,
  onValueChange,
  className,
  children,
}: {
  defaultValue: string;
  value?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const isControlled = controlled !== undefined;
  const value = isControlled ? (controlled as string) : uncontrolled;
  const setValue = (v: string) => {
    if (!isControlled) setUncontrolled(v);
    onValueChange?.(v);
  };

  return (
    <TabsCtx.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tablist"
      className={clsx(
        "inline-flex items-center gap-1 rounded-2xl border border-gray-300 bg-white p-1.5 shadow-sm",
        "dark:border-slate-700 dark:bg-slate-900/70",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  asChild,
  className,
  children,
}: {
  value: string;
  asChild?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(TabsCtx);
  if (!ctx) throw new Error("TabsTrigger must be used within <Tabs>");

  const selected = ctx.value === value;

  const base =
    "px-3.5 h-9 inline-flex items-center justify-center rounded-xl text-sm font-medium transition";
  const styles = selected
    ? "bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white"
    : "text-gray-800 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800";

  if (asChild) {
    return (
      <span
        role="tab"
        aria-selected={selected}
        onClick={(e) => {
          e.stopPropagation();
          ctx.setValue(value);
        }}
        className={clsx(base, styles, className)}
      >
        {children}
      </span>
    );
  }

  return (
    <button
      role="tab"
      type="button"
      aria-selected={selected}
      onClick={() => ctx.setValue(value)}
      className={clsx(base, styles, className)}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(TabsCtx);
  if (!ctx) throw new Error("TabsContent must be used within <Tabs>");

  const selected = ctx.value === value;

  return (
    <div
      role="tabpanel"
      hidden={!selected}
      className={clsx(selected ? "mt-5" : "hidden", className)}
    >
      {children}
    </div>
  );
}
