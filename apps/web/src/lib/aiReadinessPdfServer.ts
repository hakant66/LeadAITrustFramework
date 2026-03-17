// src/lib/aiReadinessPdfServer.ts
import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFFont,
} from "pdf-lib";

export type TotalsRowServer = {
  name: string;
  sum: number;
  readiness: number;
  status: string;
};

export type UserInfoServer = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
};

export type AnswerSummaryServer = {
  enablerName: string;
  questions: {
    title: string;
    left: string;
    right: string;
    selectionLabel: string;
    selectionText: string;
  }[];
};

// Make all text safe for WinAnsi-encoded fonts like Helvetica, etc.
function toWinAnsiSafe(text: string): string {
  return text
    // replace long dashes with simple dash
    .replace(/\u2013|\u2014/g, "-")
    // replace arrow with ASCII representation
    .replace(/\u2192/g, "->")
    // strip any other non-WinAnsi characters just in case
    .replace(/[^\x00-\xFF]/g, "");
}

// Generic word-wrap that also sanitises text
function wrapTextWinAnsiSafe(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const safe = toWinAnsiSafe(text);
  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  words.forEach((w) => {
    const testLine = current ? current + " " + w : w;
    const wWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (wWidth > maxWidth) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = testLine;
    }
  });

  if (current) lines.push(current);
  return lines;
}

function statusText(v: number): string {
  if (v < 25) return "Critical";
  if (v < 50) return "At Risk";
  if (v < 75) return "Established";
  return "Leading";
}

/**
 * Build the MinIO/storage PDF bytes (server-side) using pdf-lib.
 * Independent from the client jsPDF implementation.
 */
export async function buildAiReadinessPdfServerBytes(
  totals: TotalsRowServer[],
  avg: number,
  userInfo?: UserInfoServer,
  createdAt?: Date,
  answers?: AnswerSummaryServer[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // A4 in points
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const pageSize: [number, number] = [pageWidth, pageHeight];

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let currentPage = pdfDoc.addPage(pageSize);
  let y = pageHeight - 120;

  const addHeader = () => {
    currentPage.drawRectangle({
      x: 0,
      y: pageHeight - 80,
      width: pageWidth,
      height: 80,
      color: rgb(0, 0.34, 1),
    });

    currentPage.drawText(toWinAnsiSafe("LeadAI - AI Readiness Check"), {
      x: 40,
      y: pageHeight - 40,
      size: 18,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    currentPage.drawText(
      toWinAnsiSafe(
        "ISO 42001 and EU AI Act aligned readiness diagnostic"
      ),
      {
        x: 40,
        y: pageHeight - 58,
        size: 9,
        font: fontRegular,
        color: rgb(1, 1, 1),
      }
    );
  };

  const addFooter = () => {
    currentPage.drawLine({
      start: { x: 40, y: 60 },
      end: { x: pageWidth - 40, y: 60 },
      thickness: 0.5,
      color: rgb(0.85, 0.9, 0.95),
    });
    currentPage.drawText(
      toWinAnsiSafe(
        "LeadAI | ISO 42001 and EU AI Act aligned readiness diagnostic"
      ),
      {
        x: 40,
        y: 48,
        size: 8,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.55),
      }
    );
    currentPage.drawText(toWinAnsiSafe("LeadAI (c) 2025"), {
      x: 40,
      y: 36,
      size: 8,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.55),
    });
  };

  const newPage = () => {
    currentPage = pdfDoc.addPage(pageSize);
    addHeader();
    y = pageHeight - 120;
  };

  // First page header
  addHeader();
  y = pageHeight - 120;

  // ASSESSMENT DETAILS
  currentPage.drawText(toWinAnsiSafe("Assessment details"), {
    x: 40,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 14;

  const details: string[] = [];
  if (userInfo?.company) details.push(`Company: ${userInfo.company}`);
  const fullName = userInfo
    ? `${userInfo.firstName ?? ""} ${userInfo.lastName ?? ""}`.trim()
    : "";
  if (fullName) details.push(`Name: ${fullName}`);
  if (userInfo?.email) details.push(`Email: ${userInfo.email}`);
  if (createdAt) {
    const dt = `${createdAt.toLocaleDateString()} ${createdAt.toLocaleTimeString(
      [],
      { hour: "2-digit", minute: "2-digit" }
    )}`;
    details.push(`Date & time: ${dt}`);
  }

  details.forEach((line) => {
    currentPage.drawText(toWinAnsiSafe(line), {
      x: 40,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });
    y -= 12;
  });

  // OVERALL READINESS
  y -= 8;
  currentPage.drawText(toWinAnsiSafe("Overall AI Readiness"), {
    x: 40,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 20;

  const overallColor =
    avg < 25
      ? rgb(0.91, 0.12, 0.12)
      : avg < 50
      ? rgb(1, 0.75, 0)
      : avg < 75
      ? rgb(0, 0.69, 0.31)
      : rgb(0, 0.34, 1);

  currentPage.drawText(toWinAnsiSafe(`${avg}%`), {
    x: 40,
    y,
    size: 24,
    font: fontBold,
    color: overallColor,
  });
  currentPage.drawText(toWinAnsiSafe(`(${statusText(avg)})`), {
    x: 40 + 80,
    y: y + 4,
    size: 12,
    font: fontRegular,
    color: rgb(0, 0, 0),
  });
  y -= 18;
  currentPage.drawText(
    toWinAnsiSafe(
      "0-24% Critical / 25-49% At Risk / 50-74% Established / 75-100% Leading"
    ),
    {
      x: 40,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.55),
    }
  );
  y -= 22;

  // CATEGORY TABLE
  currentPage.drawText(toWinAnsiSafe("Enabler"), {
    x: 40,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  currentPage.drawText(toWinAnsiSafe("Total"), {
    x: 260,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  currentPage.drawText(toWinAnsiSafe("Readiness %"), {
    x: 320,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  currentPage.drawText(toWinAnsiSafe("Status"), {
    x: 420,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 8;
  currentPage.drawLine({
    start: { x: 40, y },
    end: { x: pageWidth - 40, y },
    thickness: 0.5,
    color: rgb(0.85, 0.9, 0.95),
  });
  y -= 12;

  totals.forEach((row) => {
    if (y < 90) {
      addFooter();
      newPage();
    }
    currentPage.drawText(toWinAnsiSafe(row.name), {
      x: 40,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });
    currentPage.drawText(toWinAnsiSafe(String(row.sum)), {
      x: 260,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });
    currentPage.drawText(toWinAnsiSafe(`${row.readiness}%`), {
      x: 320,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });
    currentPage.drawText(toWinAnsiSafe(row.status), {
      x: 420,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });
    y -= 14;
  });

  // RESPONSE DETAILS ON FOLLOWING PAGES
  if (answers && answers.length > 0) {
    const bottomMargin = 80;
    const lineHeight = 12;

    if (y < 120) {
      addFooter();
      newPage();
    } else {
      y -= 10;
    }

    currentPage.drawText(toWinAnsiSafe("Response details"), {
      x: 40,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    y -= 16;

    answers.forEach((group) => {
      if (y < bottomMargin) {
        addFooter();
        newPage();
      }

      currentPage.drawText(toWinAnsiSafe(group.enablerName), {
        x: 40,
        y,
        size: 11,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      y -= lineHeight;

      group.questions.forEach((q) => {
        const blockLines: string[] = [];
        blockLines.push(`Question: ${q.title}`);
        blockLines.push(`Left: ${q.left}`);
        blockLines.push(`Right: ${q.right}`);
        blockLines.push(`Your selection: ${q.selectionLabel}`);
        blockLines.push(`Explanation: ${q.selectionText}`);

        blockLines.forEach((text) => {
          const maxWidth = pageWidth - 80;
          const lines = wrapTextWinAnsiSafe(
            text,
            fontRegular,
            9,
            maxWidth
          );

          lines.forEach((ln) => {
            if (y < bottomMargin) {
              addFooter();
              newPage();
            }
            currentPage.drawText(toWinAnsiSafe(ln), {
              x: 40,
              y,
              size: 9,
              font: fontRegular,
              color: rgb(0, 0, 0),
            });
            y -= lineHeight;
          });

          y -= 2;
        });

        y -= 4;
        if (y < bottomMargin) {
          addFooter();
          newPage();
        }
      });

      y -= 6;
    });
  }

  addFooter();
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
