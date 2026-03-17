"use client";

import { useMemo } from "react";

type DeckSlide = {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  metrics?: Array<{ label: string; value: string }>;
  table?: { columns?: string[]; rows?: string[][] };
  callouts?: string[];
  notes?: string;
};

type Deck = {
  title?: string;
  subtitle?: string;
  slides?: DeckSlide[];
};

export default function BoardLevelDeckClient({
  deck,
}: {
  deck: Deck | null;
}) {
  const slides = useMemo(() => deck?.slides ?? [], [deck]);

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    window.print();
  };

  if (!deck || slides.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        No presentation deck available yet.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body * {
            visibility: hidden;
          }
          #board-level-deck,
          #board-level-deck * {
            visibility: visible;
          }
          #board-level-deck {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .deck-slide {
            break-after: page;
            page-break-after: always;
          }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <div>
          <div className="text-sm font-semibold text-slate-800">
            Presentation Deck
          </div>
          <div className="text-xs text-slate-500">
            Structured HTML slides generated from the board-level report data.
          </div>
        </div>
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          onClick={handlePrint}
        >
          Export to PDF
        </button>
      </div>

      <div id="board-level-deck" className="space-y-6">
        {slides.map((slide, index) => (
          <div
            key={`${slide.title ?? "slide"}-${index}`}
            className="deck-slide overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {deck?.title ?? "Board-Level Deck"}
              </div>
              <div className="text-xs text-slate-400">
                Slide {index + 1} of {slides.length}
              </div>
            </div>

            <div className="grid gap-6 px-8 py-6 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {slide.title ?? "Untitled Slide"}
                  </div>
                  {slide.subtitle ? (
                    <div className="mt-1 text-sm text-slate-500">
                      {slide.subtitle}
                    </div>
                  ) : null}
                </div>

                {Array.isArray(slide.bullets) && slide.bullets.length > 0 ? (
                  <ul className="space-y-2 text-sm text-slate-700">
                    {slide.bullets.map((bullet, idx) => (
                      <li key={`${bullet}-${idx}`} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {Array.isArray(slide.callouts) && slide.callouts.length > 0 ? (
                  <div className="space-y-2">
                    {slide.callouts.map((callout, idx) => (
                      <div
                        key={`${callout}-${idx}`}
                        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900"
                      >
                        {callout}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                {Array.isArray(slide.metrics) && slide.metrics.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {slide.metrics.map((metric, idx) => (
                      <div
                        key={`${metric.label}-${idx}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="text-xs uppercase text-slate-500">
                          {metric.label}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">
                          {metric.value}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {slide.table?.columns?.length ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          {slide.table.columns?.map((col) => (
                            <th key={col} className="px-3 py-2 text-left font-semibold">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {slide.table.rows?.map((row, rowIdx) => (
                          <tr key={`row-${rowIdx}`}>
                            {row.map((cell, cellIdx) => (
                              <td key={`cell-${rowIdx}-${cellIdx}`} className="px-3 py-2 text-slate-700">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {slide.notes ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                    <span className="font-semibold text-slate-600">Speaker notes:</span>{" "}
                    {slide.notes}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
