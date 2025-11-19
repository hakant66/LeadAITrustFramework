export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <div className="h-7 w-72 rounded bg-gray-200 dark:bg-slate-700 animate-pulse" />

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
