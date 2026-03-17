"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle, X } from "lucide-react";

function buildDifySrc(origin: string, path: string): string {
  const trimmedPath = path.trim();
  if (trimmedPath.startsWith("http://") || trimmedPath.startsWith("https://")) {
    return trimmedPath.replace(/\/+$/, "");
  }
  const base = origin.replace(/\/+$/, "");
  const withLeadingSlash = trimmedPath.startsWith("/")
    ? trimmedPath
    : `/${trimmedPath}`;
  return `${base}${withLeadingSlash}`.replace(/\/+$/, "");
}

export default function ChatbotWidget() {
  const t = useTranslations("Home");
  const difyOrigin = process.env.NEXT_PUBLIC_DIFY_WEBAPP_ORIGIN ?? "";
  const difyPath = process.env.NEXT_PUBLIC_DIFY_WEBAPP_PATH ?? "/apps";
  const difySrc = difyOrigin ? buildDifySrc(difyOrigin, difyPath) : "";
  const difyHeaderOffset = 56;
  const [mounted, setMounted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render if Dify is not configured
  if (!mounted || (!difyOrigin && !difySrc)) {
    return null;
  }

  return (
    <>
      {/* Chatbot Panel - Fixed bottom right */}
      {chatOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:w-[440px]">
          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                {t("chat.title")}
              </h3>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                {t("chat.status")}
              </span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label={t("chat.toggleClose")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {difySrc ? (
            <div className="overflow-hidden rounded-b-2xl">
              <iframe
                title={t("chat.iframeTitle")}
                src={difySrc}
                className="w-full"
                style={{
                  border: "none",
                  height: `calc(520px + ${difyHeaderOffset}px)`,
                  marginTop: `-${difyHeaderOffset}px`,
                }}
                allow="clipboard-read; clipboard-write"
              />
            </div>
          ) : (
            <div className="rounded-b-2xl border-t border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              {t("chat.missingConfig", {
                origin: "DIFY_WEBAPP_ORIGIN",
                path: "DIFY_WEBAPP_PATH",
              })}
            </div>
          )}
        </div>
      )}

      {/* Toggle Button - Fixed bottom right */}
      <button
        type="button"
        onClick={() => setChatOpen((prev) => !prev)}
        aria-expanded={chatOpen}
        aria-label={chatOpen ? t("chat.toggleClose") : t("chat.toggleOpen")}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-400"
      >
        {chatOpen ? (
          <>
            <X className="h-4 w-4" />
            {t("chat.toggleClose")}
          </>
        ) : (
          <>
            <MessageCircle className="h-4 w-4" />
            {t("chat.toggleOpen")}
          </>
        )}
      </button>
    </>
  );
}
