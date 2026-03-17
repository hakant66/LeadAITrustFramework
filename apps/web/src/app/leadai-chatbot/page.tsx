// apps/web/src/app/leadai-chatbot/page.tsx
import React from "react";

export const dynamic = "force-dynamic";

function buildIframeSrc(origin: string, path: string): string {
  const trimmedPath = path.trim();
  if (trimmedPath.startsWith("http://") || trimmedPath.startsWith("https://")) {
    return trimmedPath.replace(/\/+$/, "");
  }
  const base = origin.replace(/\/+$/, "");
  const withLeadingSlash = trimmedPath.startsWith("/")
    ? trimmedPath
    : `/${trimmedPath}`;
  return `${base}${withLeadingSlash}`.replace(/\/+$/, "");
}

export default function LeadAIChatbotPage() {
  const origin = process.env.DIFY_WEBAPP_ORIGIN ?? "";
  const path = process.env.DIFY_WEBAPP_PATH ?? "/apps";

  if (!origin) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
            Dify Web App Origin Not Configured
          </h1>
          <p style={{ margin: 0 }}>
            Set <code>DIFY_WEBAPP_ORIGIN</code> in the LeadAI web container
            environment to the Dify base URL (for example,
            <code> http://host.docker.internal:8080</code>).
          </p>
        </div>
      </main>
    );
  }

  const src = buildIframeSrc(origin, path);

  return (
    <main
      style={{
        height: "100vh",
        width: "100vw",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        background: "#0b0f1a",
      }}
    >
      <iframe
        title="LeadAI Chatbot"
        src={src}
        style={{
          border: "none",
          height: "100%",
          width: "100%",
        }}
        allow="clipboard-read; clipboard-write"
      />
    </main>
  );
}
