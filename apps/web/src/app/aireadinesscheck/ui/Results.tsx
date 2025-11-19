// app/aireadinesscheck/ui/Results.tsx
"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import NextImage from "next/image";

type TotalsRow = {
  name: string;
  sum: number;
  readiness: number;
  status: string;
};

type UserInfo = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
};

type AnswerSummary = {
  enablerName: string;
  questions: {
    title: string;
    left: string;
    right: string;
    selectionLabel: string;
    selectionText: string;
  }[];
};

type ResultsProps = {
  enablers: { name: string; description?: string }[];
  getTotals: () => TotalsRow[];
  getAvg: () => number;
  onRestart: () => void;
  mode?: "shared";
  userInfo?: UserInfo;
  completedAt?: Date;
  answers?: AnswerSummary[];
  /** Short slug from the server, used for /aireadinesscheck/r/[slug] */
  shareSlug?: string;
};

function readinessColor(readiness: number): string {
  if (readiness < 25) return "bg-rose-500";
  if (readiness < 50) return "bg-amber-500";
  if (readiness < 75) return "bg-sky-500";
  return "bg-emerald-500";
}

function statusBadgeColor(status: string): string {
  switch (status) {
    case "Critical":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-500/15 dark:text-rose-100 dark:ring-rose-500/40";
    case "At Risk":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/40";
    case "Established":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-100 dark:bg-sky-500/15 dark:text-sky-100 dark:ring-sky-500/40";
    case "Leading":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/40";
    default:
      return "bg-slate-50 text-slate-700 ring-1 ring-slate-100 dark:bg-slate-700/50 dark:text-slate-100 dark:ring-slate-600";
  }
}

const statusText = (v: number) =>
  v < 25
    ? "Critical"
    : v < 50
    ? "At Risk"
    : v < 75
    ? "Established"
    : "Leading";

export default function Results({
  enablers,
  getTotals,
  getAvg,
  onRestart,
  mode,
  userInfo,
  completedAt,
  answers,
  shareSlug,
}: ResultsProps) {
  const totals = getTotals();
  const avg = getAvg();
  const [copied, setCopied] = useState(false);

  // Short URL for stored PDF: /aireadinesscheck/r/[slug]
  // Only build it when we actually have a slug; otherwise keep it empty
  const shortUrl =
    typeof window !== "undefined" && shareSlug
      ? `${window.location.origin}/aireadinesscheck/r/${shareSlug}`
      : "";

  const handleDownload = async () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 15;
    const topContentStart = 60;
    const bottomMargin = 30;

    const drawSummaryAndTable = () => {
      pdf.setTextColor(0, 0, 0);

      // Assessment details
      let y = topContentStart + 15;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("Assessment details", marginX, y);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      y += 10;

      if (userInfo?.company) {
        pdf.text(`Company: ${userInfo.company}`, marginX, y);
        y += 6;
      }
      if (userInfo?.firstName || userInfo?.lastName) {
        const fullName = `${userInfo?.firstName ?? ""} ${
          userInfo?.lastName ?? ""
        }`.trim();
        if (fullName) {
          pdf.text(`Name: ${fullName}`, marginX, y);
          y += 6;
        }
      }
      if (userInfo?.email) {
        pdf.text(`Email: ${userInfo.email}`, marginX, y);
        y += 6;
      }
      if (completedAt) {
        const dateLine = `${completedAt.toLocaleDateString()} ${completedAt.toLocaleTimeString(
          [],
          { hour: "2-digit", minute: "2-digit" }
        )}`;
        pdf.text(`Date & time: ${dateLine}`, marginX, y);
        y += 10;
      }

      // Overall readiness
      const overallColor =
        avg < 25
          ? [232, 30, 30]
          : avg < 50
          ? [255, 192, 0]
          : avg < 75
          ? [0, 176, 80]
          : [0, 86, 255];

      y += 6;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Overall AI Readiness", marginX, y);

      y += 14;
      pdf.setFontSize(24);
      pdf.setTextColor(...(overallColor as [number, number, number]));
      pdf.text(`${avg}%`, marginX, y);

      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`(${statusText(avg)})`, marginX + 35, y);

      y += 8;
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        "0–24% Critical / 25–49% At Risk / 50–74% Established / 75–100% Leading",
        marginX,
        y
      );

      // Category table
      y += 16;
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);

      const colX = {
        enabler: marginX,
        total: marginX + 105,
        readiness: marginX + 135,
        status: marginX + 165,
      };

      pdf.text("Enabler", colX.enabler, y);
      pdf.text("Total", colX.total, y);
      pdf.text("Readiness %", colX.readiness, y);
      pdf.text("Status", colX.status, y);

      pdf.setLineWidth(0.3);
      pdf.line(marginX, y + 2, pageWidth - marginX, y + 2);
      y += 7;

      pdf.setFont("helvetica", "normal");
      const lineHeight = 6;
      const bottomLimit = pageHeight - bottomMargin;

      totals.forEach((t) => {
        if (y > bottomLimit) {
          pdf.addPage();
          y = topContentStart;
        }

        const maxWidth = colX.total - colX.enabler - 2;
        const lines = pdf.splitTextToSize(t.name, maxWidth) as string[];

        lines.forEach((ln: string, i: number) => {
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
            pdf.setTextColor(0, 0, 0);
          } else {
            pdf.text(String(ln), colX.enabler, y);
          }
          y += lineHeight;
        });
      });

      // Footer
      const footerY = pageHeight - 18;
      pdf.setLineWidth(0.2);
      pdf.setDrawColor(226, 232, 240);
      pdf.line(marginX, footerY - 6, pageWidth - marginX, footerY - 6);
      pdf.setTextColor(100, 116, 139);
      pdf.setFontSize(9);
      pdf.text(
        "LeadAI | ISO 42001 and EU AI Act aligned readiness diagnostic",
        marginX,
        footerY
      );
      pdf.text("LeadAI © 2025", marginX, footerY + 6);
    };

    const drawSelectedAnswers = () => {
      if (!answers || answers.length === 0) return;

      pdf.addPage();
      let y = 32;
      const bottomLimit = pageHeight - bottomMargin;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Selected answers", 15, y);
      y += 8;

      answers.forEach((block) => {
        if (y > bottomLimit - 20) {
          pdf.addPage();
          y = 32;
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text(block.enablerName, 15, y);
        y += 4;
        pdf.setLineWidth(0.2);
        pdf.setDrawColor(226, 232, 240);
        pdf.line(15, y, pageWidth - 15, y);
        y += 6;

        block.questions.forEach((q) => {
          if (y > bottomLimit) {
            pdf.addPage();
            y = 32;
          }

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.text(`• ${q.title}`, 15, y);
          y += 5;

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          const textWidth = pageWidth - 30;

          const leftLines = pdf.splitTextToSize(
            `Left statement: ${q.left}`,
            textWidth
          ) as string[];
          const selLabelLines = pdf.splitTextToSize(
            `Your selection: ${q.selectionLabel}`,
            textWidth
          ) as string[];
          const selTextLines = pdf.splitTextToSize(
            q.selectionText,
            textWidth
          ) as string[];
          const rightLines = pdf.splitTextToSize(
            `Right statement: ${q.right}`,
            textWidth
          ) as string[];

          const blocks = [
            leftLines,
            selLabelLines,
            selTextLines,
            rightLines,
          ];

          blocks.forEach((lines) => {
            lines.forEach((line) => {
              if (y > bottomLimit) {
                pdf.addPage();
                y = 32;
              }
              pdf.text(line, 18, y);
              y += 4;
            });
            y += 2;
          });

          y += 3;
        });

        y += 4;
      });
    };

    // Blue header with logo (no distortion)
    pdf.setFillColor(0, 86, 255);
    pdf.rect(0, 0, pageWidth, 50, "F");

    const logo = new window.Image();
    logo.src = "/LeadAI.webp";

    const drawHeaderAndContent = (withLogo: boolean) => {
      const marginXHeader = 15;

      if (withLogo) {
        try {
          const maxLogoWidth = 45;
          const maxLogoHeight = 35;
          const imgW = logo.naturalWidth || logo.width;
          const imgH = logo.naturalHeight || logo.height;
          let drawW = maxLogoWidth;
          let drawH = maxLogoHeight;

          if (imgW && imgH) {
            const ratio = imgW / imgH;
            if (ratio >= 1) {
              drawW = maxLogoWidth;
              drawH = maxLogoWidth / ratio;
            } else {
              drawH = maxLogoHeight;
              drawW = maxLogoHeight * ratio;
            }
          }

          pdf.addImage(
            logo,
            "PNG" as any,
            marginXHeader,
            8,
            drawW,
            drawH
          );
        } catch {
          // ignore logo drawing errors
        }
      }

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      const headerX = withLogo ? marginXHeader + 55 : marginXHeader;
      pdf.text("LeadAI – AI Readiness Check", headerX, 22);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(
        "ISO 42001 and EU AI Act aligned readiness diagnostic",
        headerX,
        34
      );

      drawSummaryAndTable();
      drawSelectedAnswers();
      pdf.save("leadai-ai-readiness.pdf");
    };

    logo.onload = () => {
      drawHeaderAndContent(true);
    };

    logo.onerror = () => {
      drawHeaderAndContent(false);
    };
  };

  const handleShare = async () => {
    if (!shortUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          url: shortUrl,
          title: "LeadAI – AI Readiness report",
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shortUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore copy errors
    }
  };

  const handleEmail = () => {
    if (!shortUrl) return;

    const to =
      userInfo?.email && userInfo.email.trim().length > 0
        ? userInfo.email.trim()
        : "hakan@theleadai.com"; // fallback

    const subject = encodeURIComponent("LeadAI – AI Readiness report");
    const bodyLines = [
      "Here is your LeadAI – AI Readiness Check report.",
      "",
      "You can download the PDF here:",
      shortUrl,
    ];
    const body = encodeURIComponent(bodyLines.join("\n"));

    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const shareDisabled = !shortUrl;

  return (
    <div className="space-y-8 text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">AI Readiness Summary</h1>
          <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300">
            This overview shows how your organisation scores across key AI
            readiness categories, based on your responses to each slider.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {mode === "shared" && (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Shared view
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {mode !== "shared" && (
              <>
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={shareDisabled}
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {copied
                    ? "Link copied"
                    : shareDisabled
                    ? "Generating link..."
                    : "Copy shareable link"}
                </button>
                <button
                  type="button"
                  onClick={handleEmail}
                  disabled={shareDisabled}
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Email to me
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-500"
                >
                  Download PDF
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onRestart}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Start again
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-6 py-5 text-slate-50 dark:bg-slate-800">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-300">
            Overall readiness
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-semibold">{avg}%</div>
            <div className="rounded-full bg-white/15 px-2 py-1 text-xs font-medium text-white">
              {statusText(avg)}
            </div>
          </div>
          <p className="mt-1 max-w-md text-xs text-slate-300">
            0-24% Critical / 25-49% At Risk / 50-74% Established / 75-100%
            Leading.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {totals.map((row) => {
          const enablerMeta = enablers.find((e) => e.name === row.name);
          const color = readinessColor(row.readiness);
          const badgeColor = statusBadgeColor(row.status);
          return (
            <div
              key={row.name}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">{row.name}</h2>
                  {enablerMeta?.description && (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {enablerMeta.description}
                    </p>
                  )}
                </div>
                <div
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium ${badgeColor}`}
                >
                  {row.status}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
                <span>Readiness score</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {row.readiness}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${row.readiness}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <footer className="mt-8 flex flex-col items-center justify-center gap-2 border-t border-slate-200 pt-4 text-slate-600 dark:border-slate-700 dark:text-slate-300">
        <span className="text-xs">
          LeadAI | ISO 42001 and EU AI Act aligned readiness diagnostic
        </span>
        <div className="flex items-center gap-2">
          <a
            href="https://www.theleadai.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:opacity-80"
          >
            <NextImage
              src="/LeadAI.webp"
              alt="LeadAI logo"
              width={80}
              height={22}
            />
          </a>
          <span className="text-xs">LeadAI © 2025</span>
        </div>
      </footer>
    </div>
  );
}
