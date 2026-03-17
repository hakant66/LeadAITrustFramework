// apps/web/src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import Providers from "./providers";
import LanguageSelector from "./(components)/LanguageSelector";
import ChatbotWidget from "./(components)/ChatbotWidget";

export const metadata: Metadata = {
  title: {
    default: "LeadAI · AI Project Governance",
    template: "LeadAI · %s",
  },
  // optional:
  // icons: { icon: "/leadai.webp" },
  description: "Trust & governance scorecards for AI projects.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
              <LanguageSelector />
            </div>
            {children}
            <ChatbotWidget />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
