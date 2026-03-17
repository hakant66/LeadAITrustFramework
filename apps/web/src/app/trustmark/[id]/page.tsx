import { certApiBase } from "@/lib/certApiBase";

export const dynamic = "force-dynamic";

async function fetchTrustmark(id: string) {
  const base = certApiBase();
  const res = await fetch(`${base}/trustmark/verify/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  return res.json();
}

export default async function TrustmarkVerifyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchTrustmark(id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h1 className="text-2xl font-semibold">TrustMark Verification</h1>
          <div className="mt-2 text-sm text-slate-400">ID: {id}</div>
          <div className="mt-4">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                data.valid
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "bg-red-500/20 text-red-200"
              }`}
            >
              {data.valid ? "Valid TrustMark" : "Invalid TrustMark"}
            </span>
            {!data.valid && (
              <div className="mt-2 text-sm text-red-300">
                Reason: {data.reason}
              </div>
            )}
          </div>
        </div>

        {data.trustmark && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">Public Payload</h2>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-300">
              {JSON.stringify(data.trustmark, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
