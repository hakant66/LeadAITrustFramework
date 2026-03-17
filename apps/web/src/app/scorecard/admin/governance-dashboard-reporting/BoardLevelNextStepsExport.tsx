"use client";

import { useState } from "react";
import { FileDown, Check } from "lucide-react";

export type NextStepExportItem = {
  priority: string;
  action: string;
  owner: string;
  due_date: string;
  rationale: string;
};

export default function BoardLevelNextStepsExport({
  items,
  entityName,
}: {
  items: NextStepExportItem[];
  entityName: string;
}) {
  const [exported, setExported] = useState(false);

  if (items.length === 0) return null;

  const handleExport = () => {
    const generatedAt = new Date().toLocaleString();
    const rows = items
      .map(
        (step) => `\n          <tr>
            <td>${step.priority || "—"}</td>
            <td>${step.action || "—"}</td>
            <td>${step.owner || "TBD"}</td>
            <td>${step.due_date || "TBD"}</td>
            <td>${step.rationale || ""}</td>
          </tr>`
      )
      .join("");

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Next Steps (90 Days) - ${entityName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
            h1 { font-size: 20px; margin: 0 0 8px; }
            p { margin: 0 0 16px; color: #475569; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f8fafc; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; color: #475569; }
          </style>
        </head>
        <body>
          <h1>Next Steps (90 Days) advised by AI</h1>
          <p>Entity: ${entityName} · Generated: ${generatedAt}</p>
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Action</th>
                <th>Owner</th>
                <th>Due</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      setExported(true);
      setTimeout(() => setExported(false), 2000);
    }, 300);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {exported ? (
        <>
          <Check className="h-4 w-4 text-emerald-600" aria-hidden />
          Ready to save
        </>
      ) : (
        <>
          <FileDown className="h-4 w-4" aria-hidden />
          Export next steps (PDF)
        </>
      )}
    </button>
  );
}
