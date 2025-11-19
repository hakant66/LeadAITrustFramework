// apps/web/src/app/aireadinesscheck/ui/ArrowSlider.tsx
"use client";

type Side = "blue" | "orange";

/**
 * 3-stop range slider with an upward-pointing arrow thumb.
 * Blue:   +2 / +1 / 0
 * Orange:  0 / -1 / -2
 * The track visually spans only between the centers of the three labels.
 */
export default function ArrowSlider({
  side,
  value,
  onChange,
  ariaLabel,
}: {
  side: Side;
  value: number;            // {2,1,0} for blue, {0,-1,-2} for orange
  onChange: (v: number) => void;
  ariaLabel?: string;
}) {
  const isBlue = side === "blue";
  const stops = isBlue ? [2, 1, 0] : [0, -1, -2];
  const labels = isBlue
    ? ["Always true", "Sometimes true", "Neutral"]
    : ["Neutral", "Sometimes not true", "Never true"];

  // internal 0..2 index for the input
  const index = Math.max(0, stops.indexOf(value));

  return (
    <div className="w-full">
      {/* Label row (sets the visual anchors) */}
      <div className="grid grid-cols-3 text-[11px] text-slate-500">
        {labels.map((lab, i) => (
          <div
            key={lab}
            className={`text-center px-1 ${i === index ? (isBlue ? "text-blue-600 font-semibold" : "text-orange-600 font-semibold") : ""}`}
          >
            {lab}
          </div>
        ))}
      </div>

      {/* Track + arrow thumb.
         We position the input so it starts at 16.66% and ends at 83.33%,
         i.e., from the center of col 1 to the center of col 3. */}
      <div className="relative h-8 mt-1">
        <input
          type="range"
          min={0}
          max={2}
          step={1}
          value={index}
          onChange={(e) => onChange(stops[parseInt(e.target.value, 10)])}
          aria-label={ariaLabel}
          className={`arrowRange absolute left-[16.6667%] w-[66.6667%] top-1/2 -translate-y-1/2 ${isBlue ? "arrow-blue" : "arrow-orange"}`}
        />
      </div>

      <style jsx>{`
        .arrowRange {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          background: rgba(148, 163, 184, 0.35); /* track */
          border-radius: 9999px;
          outline: none;
          /* three tick marks at 0%, 50%, 100% of the shortened track */
          background-image: linear-gradient(
            to right,
            transparent 0%,
            transparent calc(0% + 0px),
            rgba(100, 116, 139, 0.7) 0,
            rgba(100, 116, 139, 0.7) 2px,
            transparent 2px,
            transparent calc(50% - 1px),
            rgba(100, 116, 139, 0.7) calc(50% - 1px),
            rgba(100, 116, 139, 0.7) calc(50% + 1px),
            transparent calc(50% + 1px),
            transparent calc(100% - 2px),
            rgba(100, 116, 139, 0.7) calc(100% - 2px),
            rgba(100, 116, 139, 0.7) 100%
          );
          background-repeat: no-repeat;
        }
        .arrowRange:focus { box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25); }

        /* WEBKIT thumb → upward triangle */
        .arrowRange::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-bottom: 18px solid #2563eb; /* blue-600 */
          margin-top: -12px;
          cursor: pointer;
        }
        .arrow-orange::-webkit-slider-thumb { border-bottom-color: #f97316; } /* orange-500 */

        /* FIREFOX track */
        .arrowRange::-moz-range-track {
          height: 6px;
          background: rgba(148, 163, 184, 0.35);
          border-radius: 9999px;
        }
        /* FIREFOX thumb (triangle using clip-path) */
        .arrowRange::-moz-range-thumb {
          width: 22px;
          height: 18px;
          background: #2563eb;
          clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
          border: none;
          cursor: pointer;
        }
        .arrow-orange::-moz-range-thumb { background: #f97316; }
      `}</style>
    </div>
  );
}
