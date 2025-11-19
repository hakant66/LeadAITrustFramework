// app/aireadinesscheck/ui/Score.tsx
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

  const clamped = Math.max(-2, Math.min(2, value ?? 0));
  const percent = ((clamped + 2) / 4) * 100;

  return (
    <div className="w-full">
      {/* invisible native range for keyboard/mouse interaction */}
      <div className="relative h-6">
        <input
          type="range"
          min={-2}
          max={2}
          step={1}
          value={clamped}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="absolute inset-0 h-6 w-full cursor-pointer opacity-0"
          aria-label="Theme score from -2 (Never) to +2 (Always)"
        />

        {/* custom track + tick marks + indicator */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2">
          <div className="relative h-1.5 rounded-full bg-slate-300/40">
            {/* tick marks */}
            <div className="absolute inset-0 flex justify-between">
              {marks.map((m) => (
                <span
                  key={m.v}
                  className="h-1.5 w-[2px] -translate-y-[1px] bg-slate-500/60"
                />
              ))}
            </div>
            {/* active indicator */}
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 transition-all"
              style={{
                left: `${percent}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
        </div>
      </div>

      {/* labels */}
      <div className="mt-2 flex justify-between text-[11px] text-slate-500">
        {marks.map((m) => (
          <span
            key={m.v}
            className={clamped === m.v ? "font-semibold text-emerald-600" : ""}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* numeric helper */}
      <div className="mt-1 text-[11px] text-slate-400">
        Selected: <span className="font-semibold">{clamped}</span>
      </div>
    </div>
  );
}
