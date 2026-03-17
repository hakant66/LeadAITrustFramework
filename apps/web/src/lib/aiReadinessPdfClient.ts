// src/lib/aiReadinessPdfClient.ts
"use client";

import jsPDF from "jspdf";

export type TotalsRow = {
  name: string;
  sum: number;
  readiness: number;
  status: string;
};

export type UserInfo = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
};

export type AnswerSummary = {
  enablerName: string;
  questions: {
    title: string;
    left: string;
    right: string;
    selectionLabel: string; // e.g. "Closer to the right-hand statement — Always true"
    selectionText: string;  // chosen text or neutral explanation
  }[];
};

function statusText(v: number) {
  if (v < 25) return "Critical";
  if (v < 50) return "At Risk";
  if (v < 75) return "Established";
  return "Leading";
}

/**
 * Build the user-facing PDF bytes (client-side) using jsPDF.
 * This is independent from the server-side PDF.
 */
export async function buildAiReadinessPdfBytes(
  totals: TotalsRow[],
  avg: number,
  userInfo?: UserInfo,
  completedAt?: Date,
  answers?: AnswerSummary[]
): Promise<Uint8Array> {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // HEADER BACKGROUND
  pdf.setFillColor(0, 86, 255);
  pdf.rect(0, 0, pageWidth, 26, "F");

  // Logo (optional, best-effort)
  try {
    const img = new Image();
    img.src = "/LeadAI.webp";
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
    pdf.addImage(img, "PNG", 10, 4, 20, 18); // Keep aspect ratio; don't distort
  } catch {
    // ignore logo load error
  }

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("LeadAI – AI Readiness Check", 36, 12);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    "ISO 42001 and EU AI Act aligned readiness diagnostic",
    36,
    18
  );

  let y = 32;

  // ASSESSMENT DETAILS
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Assessment details", 10, y);
  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  const details: string[] = [];
  if (userInfo?.company) details.push(`Company: ${userInfo.company}`);
  const fullName = userInfo
    ? `${userInfo.firstName ?? ""} ${userInfo.lastName ?? ""}`.trim()
    : "";
  if (fullName) details.push(`Name: ${fullName}`);
  if (userInfo?.email) details.push(`Email: ${userInfo.email}`);
  if (completedAt) {
    const dt = `${completedAt.toLocaleDateString()} ${completedAt.toLocaleTimeString(
      [],
      { hour: "2-digit", minute: "2-digit" }
    )}`;
    details.push(`Completed: ${dt}`);
  }

  details.forEach((line) => {
    pdf.text(line, 10, y);
    y += 5;
  });

  // OVERALL READINESS
  y += 6;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Overall AI Readiness", 10, y);
  y += 10;

  const overallColor =
    avg < 25
      ? [232, 30, 30]
      : avg < 50
      ? [255, 192, 0]
      : avg < 75
      ? [0, 176, 80]
      : [0, 86, 255];

  pdf.setFontSize(24);
  pdf.setTextColor(...(overallColor as [number, number, number]));
  pdf.text(`${avg}%`, 10, y);
  pdf.setFontSize(12);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`(${statusText(avg)})`, 10 + 40, y - 1);

  y += 8;
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    "0–24% Critical / 25–49% At Risk / 50–74% Established / 75–100% Leading",
    10,
    y
  );

  // CATEGORY TABLE
  y += 10;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  const colX = { enabler: 10, total: 110, readiness: 140, status: 170 };

  pdf.text("Enabler", colX.enabler, y);
  pdf.text("Total", colX.total, y);
  pdf.text("Readiness %", colX.readiness, y);
  pdf.text("Status", colX.status, y);
  y += 2;
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(10, y, pageWidth - 10, y);
  y += 6;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);

  const bottomMargin = 20;
  const lineHeight = 5;

  totals.forEach((row) => {
    const neededHeight = lineHeight * 2; // approx
    if (y + neededHeight > pageHeight - bottomMargin) {
      pdf.addPage();
      y = 20;
    }

    const nameLines = pdf.splitTextToSize(row.name, colX.total - colX.enabler - 2) as string[];
    nameLines.forEach((ln, i) => {
      pdf.text(ln, colX.enabler, y);
      if (i === 0) {
        pdf.text(String(row.sum), colX.total, y);
        pdf.text(`${row.readiness}%`, colX.readiness, y);
        pdf.text(row.status, colX.status, y);
      }
      y += lineHeight;
    });
  });

  // ANSWERS SECTION
  if (answers && answers.length > 0) {
    if (y + 20 > pageHeight - bottomMargin) {
      pdf.addPage();
      y = 20;
    } else {
      y += 6;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Response details", 10, y);
    y += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    answers.forEach((group) => {
      if (y + 10 > pageHeight - bottomMargin) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFont("helvetica", "bold");
      pdf.text(group.enablerName, 10, y);
      y += 5;
      pdf.setFont("helvetica", "normal");

      group.questions.forEach((q) => {
        const blockLines: string[] = [];

        blockLines.push(`Question: ${q.title}`);
        blockLines.push(`Left: ${q.left}`);
        blockLines.push(`Right: ${q.right}`);
        blockLines.push(`Your selection: ${q.selectionLabel}`);
        blockLines.push(`Explanation: ${q.selectionText}`);

        blockLines.forEach((text) => {
          const wrapped = pdf.splitTextToSize(text, pageWidth - 20) as string[];
          wrapped.forEach((wLine) => {
            if (y + lineHeight > pageHeight - bottomMargin) {
              pdf.addPage();
              y = 20;
            }
            pdf.text(wLine, 10, y);
            y += lineHeight;
          });
        });

        y += 3;
        if (y + lineHeight > pageHeight - bottomMargin) {
          pdf.addPage();
          y = 20;
        }
      });

      y += 4;
    });
  }

  // FOOTER
  if (y + 12 > pageHeight - 10) {
    pdf.addPage();
    y = pageHeight - 20;
  } else {
    y = pageHeight - 20;
  }
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(10, y - 6, pageWidth - 10, y - 6);
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    "LeadAI | ISO 42001 and EU AI Act aligned readiness diagnostic",
    10,
    y
  );
  pdf.text("LeadAI © 2025", 10, y + 6);

  const arr = pdf.output("arraybuffer");
  return new Uint8Array(arr as ArrayBuffer);
}
