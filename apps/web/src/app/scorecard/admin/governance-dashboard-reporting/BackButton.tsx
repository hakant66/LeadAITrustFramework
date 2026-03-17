"use client";

import { useRouter } from "next/navigation";

export default function BackButton({
  label = "Back",
}: {
  label?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-white/20"
      onClick={() => router.back()}
    >
      {label}
    </button>
  );
}
