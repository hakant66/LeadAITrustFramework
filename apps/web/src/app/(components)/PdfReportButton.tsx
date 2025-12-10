"use client";

import React from "react";

export function PdfReportButton() {
  const handleClick = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <button
      onClick={handleClick}
      className="
        inline-flex items-center px-3 py-1 rounded-xl text-sm font-medium
        border border-gray-200 bg-white/70 hover:bg-white
        shadow-sm
        dark:border-slate-600 dark:bg-slate-900/70 dark:hover:bg-slate-900
      "
    >
      Get PDF report
    </button>
  );
}
