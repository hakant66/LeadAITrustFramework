"use client";

// src/app/(components)/AdminDataIO.tsx
import React, { useRef, useState } from "react";

const API_BASE = "http://127.0.0.1:8001";

type Props = { slug: string };

function useXlsxUpload() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (url: string, file: File) => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(url, { method: "POST", body: fd });
      const text = await res.text();
      if (!res.ok) throw new Error(text || res.statusText);
      const data = JSON.parse(text);
      setMessage(`Done. Upserts: ${data?.upserts ?? "?"}`);
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return { busy, message, error, upload, setMessage, setError };
}

function DownloadButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
      download
    >
      {children}
    </a>
  );
}

function UploadButton({
  onPick,
  busy,
  label,
}: {
  onPick: (file: File) => void;
  busy?: boolean;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="px-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? "Uploading…" : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.currentTarget.value = ""; // allow picking same file again
        }}
      />
    </>
  );
}

export function PillarOverridesIO({ slug }: Props) {
  const { busy, message, error, upload, setMessage, setError } = useXlsxUpload();
  const exportUrl = `${API_BASE}/admin/projects/${encodeURIComponent(
    slug,
  )}/pillar_overrides.xlsx`;
  const importUrl = `${API_BASE}/admin/projects/${encodeURIComponent(
    slug,
  )}/pillar_overrides`;

  return (
    <section className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
        Pillar Overrides (.xlsx)
      </h3>
      <div className="flex items-center gap-3">
        <DownloadButton href={exportUrl}>Export</DownloadButton>
        <UploadButton
          label="Import"
          busy={busy}
          onPick={(file) => upload(importUrl, file)}
        />
      </div>

      {message && (
        <div
          className="text-sm text-green-700 bg-green-50 border border-green-200 dark:text-emerald-100 dark:bg-emerald-900/40 dark:border-emerald-500/60 rounded-md p-2 cursor-pointer"
          onClick={() => setMessage(null)}
          title="Dismiss"
        >
          {message}
        </div>
      )}
      {error && (
        <div
          className="text-sm text-red-700 bg-red-50 border border-red-200 dark:text-red-100 dark:bg-red-900/40 dark:border-red-500/60 rounded-md p-2 cursor-pointer"
          onClick={() => setError(null)}
          title="Dismiss"
        >
          {error}
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-slate-400">
        Expected columns on import: <code>pillar</code>, optional{" "}
        <code>score_pct</code>, <code>maturity</code>.
      </p>
    </section>
  );
}

export function ControlValuesIO({ slug }: Props) {
  const { busy, message, error, upload, setMessage, setError } = useXlsxUpload();
  const exportUrl = `${API_BASE}/admin/projects/${encodeURIComponent(
    slug,
  )}/control_values.xlsx`;
  const importUrl = `${API_BASE}/admin/projects/${encodeURIComponent(
    slug,
  )}/control_values`;

  return (
    <section className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
        Control Values (.xlsx)
      </h3>
      <div className="flex items-center gap-3">
        <DownloadButton href={exportUrl}>Export</DownloadButton>
        <UploadButton
          label="Import"
          busy={busy}
          onPick={(file) => upload(importUrl, file)}
        />
      </div>

      {message && (
        <div
          className="text-sm text-green-700 bg-green-50 border border-green-200 dark:text-emerald-100 dark:bg-emerald-900/40 dark:border-emerald-500/60 rounded-md p-2 cursor-pointer"
          onClick={() => setMessage(null)}
          title="Dismiss"
        >
          {message}
        </div>
      )}
      {error && (
        <div
          className="text-sm text-red-700 bg-red-50 border border-red-200 dark:text-red-100 dark:bg-red-900/40 dark:border-red-500/60 rounded-md p-2 cursor-pointer"
          onClick={() => setError(null)}
          title="Dismiss"
        >
          {error}
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-slate-400">
        Expected columns on import: <code>control_id</code>,{" "}
        <code>raw_value</code>. Any <code>normalized_pct</code> provided will be
        recalculated.
      </p>
    </section>
  );
}
