// apps/web/src/app/aireadinesscheck/ui/Enabler.tsx
"use client";

import ArrowSlider from "./ArrowSlider";
import type { Enabler as EnablerT } from "../seed/enablers";

export type ThemePair = { blue: number; orange: number };

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
  values: ThemePair[];
  onChange: (i: number, v: ThemePair) => void;
  onPrev: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const allScored = values.every((v) => Number.isFinite(v.blue) && Number.isFinite(v.orange));

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">{enabler.name}</h2>

      {enabler.themes.map((t, i) => {
        const pair = values[i] ?? { blue: 0, orange: 0 };

        // ❗ Independent sliders: do not alter the other side
        const setBlue = (nv: number) => onChange(i, { blue: nv, orange: pair.orange });
        const setOrange = (nv: number) => onChange(i, { blue: pair.blue, orange: nv });

        return (
          <div key={i} className="mb-6 border rounded-2xl p-4">
            <div className="font-medium">{t.title}</div>

            {/* Equal-height columns + aligned sliders */}
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
              {/* Blue */}
              <div className="rounded-xl bg-blue-50 p-3 flex flex-col h-full">
                <p className="text-slate-900/90 leading-relaxed min-h-[72px]">{t.blue}</p>
                <div className="mt-3">
                  <ArrowSlider
                    side="blue"
                    value={pair.blue}      // +2 | +1 | 0
                    onChange={setBlue}
                    ariaLabel={`${t.title} (blue statement)`}
                  />
                </div>
              </div>

              {/* Orange */}
              <div className="rounded-xl bg-orange-50 p-3 flex flex-col h-full">
                <p className="text-slate-900/90 leading-relaxed min-h-[72px]">{t.orange}</p>
                <div className="mt-3">
                  <ArrowSlider
                    side="orange"
                    value={pair.orange}    // 0 | -1 | -2
                    onChange={setOrange}
                    ariaLabel={`${t.title} (orange statement)`}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex justify-between mt-8">
        <button onClick={onPrev} disabled={isFirst} className="px-4 py-2 rounded-xl border disabled:opacity-50">
          Previous
        </button>
        <button onClick={onNext} disabled={!allScored} className="px-4 py-2 rounded-2xl bg-blue-600 text-white disabled:opacity-50">
          {isLast ? "See Results" : "Next"}
        </button>
      </div>
    </div>
  );
}
