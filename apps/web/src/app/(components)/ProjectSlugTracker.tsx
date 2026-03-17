"use client";

import { useEffect } from "react";

export default function ProjectSlugTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;
    try {
      window.localStorage.setItem("leadai.nav.project", slug);
    } catch {
      // ignore storage errors
    }
  }, [slug]);

  return null;
}
