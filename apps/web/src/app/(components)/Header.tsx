"use client";

//apps\web\src\app\(components)\Header.tsx
import Link from "next/link";
import { useParams } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

export default function Header({
  title,
  subtitle,
  titleNote,
  children,
}: {
  title: string;
  subtitle: string;
  entityName?: string | null;
  titleNote?: string;
  children?: ReactNode;
}) {
  const params = useParams();
  const entitySlug = typeof params?.entitySlug === "string" ? params.entitySlug : undefined;
  const [logoSrc, setLogoSrc] = useState("/LeadAI.webp");

  useEffect(() => {
    let cancelled = false;

    const applyStoredLogo = () => {
      if (typeof window === "undefined") return "";
      const storedLogo = sessionStorage.getItem("entityLogoUrl") || "";
      if (storedLogo && !cancelled) {
        setLogoSrc(storedLogo);
      }
      return storedLogo;
    };

    const loadEntityLogo = async () => {
      const storedLogo = applyStoredLogo();
      if (!entitySlug) {
        if (!storedLogo && !cancelled) setLogoSrc("/LeadAI.webp");
        return;
      }
      try {
        const res = await fetch(`/api/core/entity/by-slug/${encodeURIComponent(entitySlug)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const nextLogo =
          typeof data.logoUrl === "string" && data.logoUrl.trim()
            ? data.logoUrl
            : "/LeadAI.webp";
        if (typeof window !== "undefined") {
          if (data.logoUrl) {
            sessionStorage.setItem("entityLogoUrl", data.logoUrl);
          } else {
            sessionStorage.removeItem("entityLogoUrl");
          }
        }
        if (!cancelled) {
          setLogoSrc(nextLogo);
        }
      } catch {
        if (!storedLogo && !cancelled) {
          setLogoSrc("/LeadAI.webp");
        }
      }
    };

    loadEntityLogo();
    return () => {
      cancelled = true;
    };
  }, [entitySlug]);

  return (
    <div className="relative overflow-hidden rounded-3xl border shadow-sm bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_50%)]" />
      <div className="relative p-6 md:p-7">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <Link
              href="https://www.theleadai.co.uk/"
              target="_blank"
              rel="noopener noreferrer"
              prefetch={false}
              className="shrink-0 transition hover:opacity-80"
              aria-label="Open LeadAI site"
            >
              <div className="flex h-[80px] w-[80px] items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-md ring-1 ring-white/25">
                <img
                  src={logoSrc}
                  alt="Header logo"
                  className="max-h-full max-w-full object-contain"
                  onError={() => setLogoSrc("/LeadAI.webp")}
                />
              </div>
            </Link>
            <div>
              <div className="text-s uppercase tracking-wider/loose opacity-80">
                {subtitle}
              </div>
              <h1 className="mt-1 text-3xl md:text-3xl font-semibold">
                {title}
              </h1>
              {titleNote ? (
                <div className="mt-1 text-sm font-medium text-white/85">
                  {titleNote}
                </div>
              ) : null}
            </div>
          </div>
          {children && <div>{children}</div>}
        </div>
      </div>
    </div>
  );
}
