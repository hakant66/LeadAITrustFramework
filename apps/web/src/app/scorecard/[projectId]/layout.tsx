export default function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="px-6 py-6 max-w-7xl mx-auto text-gray-900 dark:text-slate-100">
        {/* Optional: lightweight breadcrumb / context using projectId */}
        <div className="mb-4 text-xs text-gray-500 dark:text-slate-400">
          <span className="font-semibold">Project:</span>{" "}
          <span className="font-mono">{params.projectId}</span>
        </div>

        {children}
      </div>
    </main>
  );
}
