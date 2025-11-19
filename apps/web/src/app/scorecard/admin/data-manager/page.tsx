// apps/web/src/app/scorecard/admin/data-manager/page.tsx
"use client";

import { useRouter } from "next/navigation";
import DataManagerModal from "@/app/(components)/DataManagerModal";

export default function DataManagerPage() {
  const router = useRouter();

  const handleClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/scorecard/admin");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <DataManagerModal open={true} onClose={handleClose} />
    </main>
  );
}
