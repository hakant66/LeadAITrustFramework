// apps/web/src/app/aireadinesscheck/ui/Score.tsx
"use client";

export default function Score({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const marks = [
    { v: -2, label: "Never" },
    { v: -1, label: "Rarely" },
    { v: 0, label: "Mixed" },
    { v: 1, label: "Often" },
    { v: 2, label: "Always" },
  ];

  const safeValue = value ?? 0;
  const thumbLeft = ((safeValue + 2) / 4) * 100;

  return (
    <div className="w-full">
      <input
        type="range"
        min={-2}
        max={2}
        step={1}
        value={safeValue}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full appearance-none bg-transparent"
        aria-label="Theme score from -2 to +2"
      />

      {/* track */}
      <div className="relative mt-1 h-1.5 rounded-full bg-slate-300/60 dark:bg-slate-700">
        {/* tick marks */}
        <div className="absolute inset-0 flex justify-between">
          {marks.map((m) => (
            <span
              key={m.v}
              className="h-1.5 w-1 rounded-full translate-y-[-2px] bg-slate-500/70 dark:bg-slate-300/80"
            />
          ))}
        </div>

        {/* active thumb indicator */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-400 transition-all"
          style={{ left: `${thumbLeft}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>

      {/* labels */}
      <div className="mt-2 flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
        {marks.map((m) => (
          <span
            key={m.v}
            className={
              safeValue === m.v
                ? "font-semibold text-emerald-500 dark:text-emerald-300"
                : ""
            }
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* numeric helper */}
      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        Selected: <span className="font-semibold">{safeValue}</span>
      </div>
    </div>
  );
}
