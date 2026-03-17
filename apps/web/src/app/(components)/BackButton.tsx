"use client";

import { useRouter } from "next/navigation";

export default function BackButton({
  label = "Back",
  className,
  fallbackHref = "/scorecard",
}: {
  label?: string;
  className?: string;
  fallbackHref?: string;
}) {
  const router = useRouter();

  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  };

  return (
    <button type="button" className={className} onClick={handleClick}>
      {label}
    </button>
  );
}
