"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 space-y-4 text-gray-900 dark:text-slate-100">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-gray-700 dark:text-slate-300">
          {error.message || "An unexpected error occurred."}
        </p>

        <button
          onClick={reset}
          className="rounded-xl px-4 py-2 text-sm font-semibold border border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
