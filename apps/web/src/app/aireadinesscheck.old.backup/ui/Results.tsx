// apps/web/src/app/aireadinesscheck/ui/Results.tsx
"use client";

import jsPDF from "jspdf"; // ← pure jsPDF export

type TotalsRow = { name: string; sum: number; readiness: number; status: string };

export default function Results({
  enablers,
  getTotals,
  getAvg,
  mode = "local",
  onRestart,
}: {
  enablers: { name: string }[];
  getTotals: () => TotalsRow[];
  getAvg: (totals: TotalsRow[]) => number;
  mode?: "local" | "shared";
  onRestart: () => void;
}) {
  const totals = getTotals();
  const avg = getAvg(totals);
  const statusText = (v: number) =>
    v < 25 ? "Critical" : v < 50 ? "At Risk" : v < 75 ? "Established" : "Leading";

  // ⬇️ jsPDF export (independent from Tailwind / dark mode)
  const handleDownload = () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const W = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();

    // Header
    pdf.setFillColor(0, 86, 255);
    pdf.rect(0, 0, W, 22, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("LeadAI — AI Readiness Report", 10, 14);

    // Summary block
    const overallColor =
      avg < 25
        ? [232, 30, 30]
        : avg < 50
        ? [255, 192, 0]
        : avg < 75
        ? [0, 176, 80]
        : [0, 86, 255];

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    pdf.text("Overall AI Readiness", 10, 32);
    pdf.setTextColor(...(overallColor as [number, number, number]));
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.text(`${avg}% (${statusText(avg)})`, 10, 42);

    // Table header
    let y = 54;
    const colX = { enabler: 10, total: 120, readiness: 150, status: 175 };
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("Enabler", colX.enabler, y);
    pdf.text("Total", colX.total, y);
    pdf.text("Readiness %", colX.readiness, y);
    pdf.text("Status", colX.status, y);
    pdf.setLineWidth(0.3);
    pdf.line(10, y + 2, W - 10, y + 2);
    y += 8;

    // Table rows with pagination
    pdf.setFont("helvetica", "normal");
    const lineHeight = 7;
    const bottom = H - 18;

    totals.forEach((t) => {
      // new page if needed
      if (y > bottom) {
        pdf.addPage();
        y = 20;
      }

      // wrap enabler name if long
      const maxWidth = colX.total - colX.enabler - 2;
      const lines = pdf.splitTextToSize(t.name, maxWidth);

      lines.forEach((ln, i) => {
        if (i === 0) {
          pdf.text(String(ln), colX.enabler, y);
          pdf.text(String(t.sum), colX.total, y, { align: "left" });
          pdf.text(`${t.readiness}%`, colX.readiness, y, { align: "left" });

          const rc =
            t.readiness < 25
              ? [232, 30, 30]
              : t.readiness < 50
              ? [255, 192, 0]
              : t.readiness < 75
              ? [0, 176, 80]
              : [0, 86, 255];

          pdf.setTextColor(...(rc as [number, number, number]));
          pdf.text(t.status, colX.status, y, { align: "left" });

          // reset text color for next row cells
          pdf.setTextColor(0, 0, 0);
        } else {
          // continuation line only for the name column
          pdf.text(String(ln), colX.enabler, y);
        }
        y += lineHeight;
      });
    });

    // Footer
    pdf.setFontSize(9);
    pdf.setTextColor(120);
    pdf.text(
      "© LeadAI™ | ISO 42001 & EU AI Act aligned readiness diagnostic",
      10,
      H - 8
    );

    pdf.save("LeadAI_Readiness_Report.pdf");
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
          Your AI Readiness Results
        </h2>
        <p className="text-slate-700 dark:text-slate-300">
          Overall AI Readiness:{" "}
          <span className="font-semibold">{avg}%</span> ({statusText(avg)})
        </p>
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-slate-800">
              <th className="p-3 text-slate-900 dark:text-slate-50">Enabler</th>
              <th className="p-3 text-slate-900 dark:text-slate-50">Total</th>
              <th className="p-3 text-slate-900 dark:text-slate-50">Readiness %</th>
              <th className="p-3 text-slate-900 dark:text-slate-50">Status</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((t, i) => (
              <tr
                key={i}
                className="border-t border-slate-200 dark:border-slate-700 even:bg-slate-50 dark:even:bg-slate-900/50"
              >
                <td className="p-3">{t.name}</td>
                <td className="p-3">{t.sum}</td>
                <td className="p-3">{t.readiness}%</td>
                <td className="p-3">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="p-4 text-center text-lg font-semibold border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50">
          Overall AI Readiness: {avg}% ({statusText(avg)})
        </div>
      </div>

      <div className="flex justify-center gap-3 mt-8">
        {mode === "local" && (
          <>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              Download PDF
            </button>
            <button
              onClick={async () => {
                const data = btoa(JSON.stringify({ totals, avg }));
                await navigator.clipboard.writeText(
                  `${window.location.origin}/aireadinesscheck?results=${data}`
                );
                alert("Share link copied to clipboard.");
              }}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Copy Shareable Link
            </button>
          </>
        )}
        <button
          onClick={onRestart}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {mode === "shared" ? "Start New Assessment" : "Retake Assessment"}
        </button>
      </div>
    </div>
  );
}
