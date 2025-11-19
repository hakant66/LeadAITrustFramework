// apps/web/src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Providers from "./providers";

export const metadata: Metadata = {
  title: {
    default: "LeadAI · AI Project Governance",
    template: "LeadAI · %s",
  },
  // optional:
  // icons: { icon: "/leadai.webp" },
  description: "Trust & governance scorecards for AI projects.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
