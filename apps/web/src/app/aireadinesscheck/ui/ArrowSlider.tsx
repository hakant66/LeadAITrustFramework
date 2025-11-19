"use client";

const STOPS = [0, 1, 2, 3, 4] as const;
const LABELS = [
  "Always true",
  "Sometimes true",
  "Neutral",
  "Sometimes true",
  "Always true",
];

export default function ArrowSlider({
  value,
  onChange,
  ariaLabel,
}: {
  value: number; // one of 0, 1, 2, 3, 4
  onChange: (v: number) => void;
  ariaLabel?: string;
}) {
  // map current value to index 0..4, default to Neutral (index 2)
  const idx = STOPS.indexOf(value as (typeof STOPS)[number]);
  const currentIndex = idx === -1 ? 2 : idx;

  return (
    <div className="w-full">
      {/* labels */}
      <div className="grid grid-cols-5 text-[11px] text-slate-500 dark:text-slate-300">
        {LABELS.map((lab, i) => (
          <div
            key={lab + i}
            className={`px-1 text-center ${
              i === currentIndex ? "font-semibold text-emerald-700 dark:text-emerald-300" : ""
            }`}
          >
            {lab}
          </div>
        ))}
      </div>

      {/* track + arrow thumb
          Track is 80% wide starting at 10%, so it runs from the
          centre of the first "Always true" to the centre of the last. */}
      <div className="relative mt-2 h-8">
        <input
          type="range"
          min={0}
          max={4}
          step={1}
          value={currentIndex}
          onChange={(e) =>
            onChange(STOPS[parseInt(e.target.value, 10)] as number)
          }
          aria-label={ariaLabel}
          className="arrowRange absolute left-[10%] top-1/2 w-[80%] -translate-y-1/2"
        />
      </div>

      <style jsx>{`
        :global(:root) {
          --slider-track: rgba(148, 163, 184, 0.35);
          --slider-thumb: #047857;
          --slider-focus: rgba(16, 185, 129, 0.25);
        }

        :global(.dark) {
          --slider-track: rgba(148, 163, 184, 0.5);
          --slider-thumb: #22c55e;
          --slider-focus: rgba(34, 197, 94, 0.3);
        }

        .arrowRange {
          -webkit-appearance: none;
          appearance: none;
          /* NOTE: no width here - Tailwind w-[80%] controls it */
          height: 6px;
          background: var(--slider-track);
          border-radius: 9999px;
          outline: none;
        }

        .arrowRange:focus {
          box-shadow: 0 0 0 3px var(--slider-focus);
        }

        /* WEBKIT thumb - upward triangle */
        .arrowRange::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-bottom: 18px solid var(--slider-thumb);
          margin-top: -12px;
          cursor: pointer;
        }

        /* FIREFOX track */
        .arrowRange::-moz-range-track {
          height: 6px;
          background: var(--slider-track);
          border-radius: 9999px;
        }

        /* FIREFOX thumb - triangle via clip-path */
        .arrowRange::-moz-range-thumb {
          width: 22px;
          height: 18px;
          background: var(--slider-thumb);
          clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
