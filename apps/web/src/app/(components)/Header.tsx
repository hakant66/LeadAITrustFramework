//apps\web\src\app\(components)\Header.tsx
import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

export default function Header({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border shadow-sm bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_50%)]" />
      <div className="relative p-6 md:p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link
              href="https://www.theleadai.co.uk/"
              target="_blank"
              rel="noopener noreferrer"
              prefetch={false}
              className="shrink-0 p-2 transition hover:opacity-80"
              aria-label="Open LeadAI site"
            >
              <Image
                src="/LeadAI.webp"
                alt="LeadAI"
                width={60}
                height={60}
                className="rounded-lg"
                priority
              />
            </Link>
            <div>
              <div className="text-s uppercase tracking-wider/loose opacity-80">
                {subtitle}
              </div>
              <h1 className="mt-1 text-3xl md:text-3xl font-semibold">
                {title}
              </h1>
            </div>
          </div>
          {children && <div>{children}</div>}
        </div>
      </div>
    </div>
  );
}
