// app/aireadinesscheck/ui/Enabler.tsx
"use client";

import ArrowSlider from "./ArrowSlider";
import type { Enabler as EnablerT } from "../seed/enablers";

/**
 * Single 5-point score per theme (0..4):
 *  4  = strongly left statement is true
 *  3  = somewhat left statement
 *  2  = neutral / don't know
 *  1  = somewhat right statement
 *  0  = strongly right statement
 */
export type StageScore = 0 | 1 | 2 | 3 | 4;

export default function Enabler({
  enabler,
  values,
  onChange,
  onPrev,
  onNext,
  isFirst,
  isLast,
}: {
  enabler: EnablerT;
  values: StageScore[];
  onChange: (i: number, v: StageScore) => void;
  onPrev: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const allScored = enabler.themes.every((_, i) =>
    Number.isFinite(values?.[i] as number)
  );

  return (
    <div className="text-slate-900 dark:text-slate-100">
      <h2 className="mb-6 text-2xl font-semibold">{enabler.name}</h2>

      {enabler.themes.map((t, i) => {
        const v = (values && values[i] !== undefined ? values[i] : 2) as StageScore;

        return (
          <div
            key={i}
            className="mb-6 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
          >
            {/* Theme title (e.g. "Purpose & Alignment") */}
            <div className="font-medium">{t.title}</div>

            {/* Two statements under the one title */}
            <div className="mt-2 grid grid-cols-1 items-start gap-3 md:grid-cols-2">
              <p className="min-h-[72px] leading-relaxed text-slate-900/90 dark:text-slate-200">
                {t.blue}
              </p>
              <p className="min-h-[72px] leading-relaxed text-slate-900/90 md:text-right dark:text-slate-200">
                {t.orange}
              </p>
            </div>

            {/* Single 5-point arrow slider between the two statements */}
            <div className="mt-3">
              <ArrowSlider
                value={v}
                onChange={(nv) => onChange(i, nv as StageScore)}
                ariaLabel={`${t.title} alignment slider`}
              />
            </div>
          </div>
        );
      })}

      <div className="mt-8 flex justify-between">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className="rounded-xl border border-slate-300 px-4 py-2 text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={!allScored}
          className="rounded-2xl bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLast ? "See Results" : "Next"}
        </button>
      </div>
    </div>
  );
}
