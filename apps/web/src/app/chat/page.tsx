/** @jsxImportSource react */
//C:\apps\_TheLeadAI\apps\web\src\app\chat\page.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import React from "react";

type ToolError = { error: string };

type Citation = {
  reference: string;
  resource: string;
  docPath: string;
  snippet: string;
};

type RetrievedChunk = {
  id: string;
  score: number;
  payload: {
    doc_path: string;
    doc_hash: string;
    chunk_id: string;
    content: string;
    title: string;
  };
};

type ChatResponse = {
  answer: string;
  citations: Citation[];
  context?: RetrievedChunk[];
};

type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  context?: RetrievedChunk[];
};

//const serverUrl =
//  process.env.NEXT_PUBLIC_MCP_SERVER_URL ?? "http://localhost:7443";
const serverUrl = ""; // use Next.js API proxy



async function postTool<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
//  const response = await fetch(`${serverUrl}/tools/${endpoint}`, {
const response = await fetch(`/api/tools/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let reason = `${response.status}`;
    try {
      const parsed = (await response.json()) as ToolError;
      reason = parsed.error ?? reason;
    } catch {
      reason = await response.text();
    }
    throw new Error(reason);
  }

  return (await response.json()) as T;
}

async function getStatus(): Promise<{
  ollama: boolean;
  qdrant: boolean;
  collection: string;
}> {
//  const res = await fetch(`${serverUrl}/tools/admin.status`);
const res = await fetch(`/api/tools/admin.status`);
  if (!res.ok) {
    throw new Error(`Status request failed (${res.status})`);
  }
  return res.json();
}

export default function ChatPage(): JSX.Element {
  const router = useRouter();

  const [status, setStatus] = useState<{
    ollama: boolean;
    qdrant: boolean;
    collection: string;
  } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const defaultGlob =
    typeof navigator !== "undefined" &&
    navigator.platform &&
    navigator.platform.toLowerCase().includes("win")
      ? "C:/data/leadai/**/*.{pdf,docx,xlsx}"
      : "/data/leadai/**/*.{pdf,docx,xlsx}";

  const [scanGlob, setScanGlob] = useState<string>(defaultGlob);
  const [scanResults, setScanResults] = useState<string[]>([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [ingestSelection, setIngestSelection] = useState<string[]>([]);
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await getStatus();
        setStatus(data);
      } catch (error: unknown) {
        setStatusError((error as Error).message);
      }
    })();
  }, []);

  const handleScan = useCallback(async () => {
    if (!scanGlob.trim()) return;
    setScanBusy(true);
    setIngestMessage(null);
    try {
      const globs = scanGlob.split(/\s*[,\n]\s*/).filter(Boolean);
      if (!globs.length) {
        throw new Error("Enter at least one glob pattern.");
      }
      const data = await postTool<{ files: string[] }>("ingest.scan", {
        globs,
      });
      setScanResults(data.files);
      setIngestSelection(data.files.slice(0, 25)); // preselect first batch
    } catch (error: unknown) {
      setIngestMessage((error as Error).message);
    } finally {
      setScanBusy(false);
    }
  }, [scanGlob]);

  const handleIngest = useCallback(async () => {
    if (!ingestSelection.length) {
      setIngestMessage("Select at least one file to ingest.");
      return;
    }
    setIngestBusy(true);
    setIngestMessage(null);
    try {
      const data = await postTool<{ indexed: number; chunks: number }>(
        "ingest.upsert",
        {
          paths: ingestSelection,
        },
      );
      setIngestMessage(
        `Indexed ${data.indexed} document(s) into ${data.chunks} chunk(s).`,
      );
    } catch (error: unknown) {
      setIngestMessage((error as Error).message);
    } finally {
      setIngestBusy(false);
    }
  }, [ingestSelection]);

  const handleAsk = useCallback(async () => {
    if (!prompt.trim()) return;
    setChatBusy(true);
    setChatError(null);
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    const currentPrompt = prompt;
    setPrompt("");
    try {
      const data = await postTool<ChatResponse>("chat.answer", {
        query: currentPrompt,
        k: 5,
        maxTokens: 512,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          context: data.context,
        },
      ]);
    } catch (error: unknown) {
      setChatError((error as Error).message);
      setMessages((prev) =>
        prev.filter((msg) => !(msg.role === "user" && msg.content === prompt)),
      );
      setPrompt(currentPrompt);
    } finally {
      setChatBusy(false);
    }
  }, [prompt]);

  const ingestOptions = useMemo(
    () =>
      new Set(
        ingestSelection.map((item) =>
          item.replace(/\\/g, "/").toLowerCase(),
        ),
      ),
    [ingestSelection],
  );

  return (
    <main className="min-h-screen bg-[url('/path-to-background-image.webp')] bg-cover bg-center">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center justify-between rounded-3xl border bg-white/70 p-6 shadow-sm backdrop-blur">
          <div className="flex items-center gap-4">
            <Image
              src="/LeadAI.webp"
              alt="LeadAI Logo"
              width={50}
              height={50}
              className="bg-transparent"
            />
            <h1 className="text-3xl font-semibold text-indigo-900">
              LeadAI Document Chatbot
            </h1>
          </div>
          <button
            onClick={() => router.push("/")}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            Close Chat
          </button>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Ask the AI assistant
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Responses show citations referencing the indexed documents.
            </p>

            <div className="mt-4 flex gap-3">
              <input
                type="text"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                placeholder="Ask about policies, controls, mitigations..."
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleAsk();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void handleAsk()}
                disabled={chatBusy || !prompt.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {chatBusy ? "Thinking..." : "Ask"}
              </button>
            </div>
            {chatError ? (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {chatError}
              </p>
            ) : null}

            <div className="mt-6 space-y-4">
              {messages.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Ask a question to start the conversation.
                </p>
              ) : (
                messages.map((msg, index) => (
                  <article
                    key={`${msg.role}-${index}`}
                    className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                      msg.role === "user"
                        ? "border-indigo-200 bg-indigo-50/60 text-indigo-900"
                        : "border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    <header className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {msg.role === "user" ? "You" : "Assistant"}
                    </header>
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                    {msg.citations && msg.citations.length ? (
                      <ul className="mt-3 space-y-1 text-xs text-indigo-600">
                        {msg.citations.map((citation) => {
                          const [, chunkPart] = citation.resource.split("/");
                          const [docHash, chunkId] = chunkPart
                            ? chunkPart.split("#")
                            : [undefined, undefined];
                     //     const chunkUrl =
                     //       docHash && chunkId
                     //         ? `${serverUrl}/resources/chunk/${encodeURIComponent(docHash)}/${encodeURIComponent(chunkId)}`
                     //         : undefined;
							const chunkUrl =
							  docHash && chunkId
								? `/api/resources/chunk/${encodeURIComponent(docHash)}/${encodeURIComponent(chunkId)}`
								: undefined;
                          return (
                            <li key={citation.resource}>
                              <span className="font-semibold">
                                [{citation.reference}]
                              </span>{" "}
                              {chunkUrl ? (
                                <a
                                  href={chunkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline"
                                >
                                  {citation.docPath}
                                </a>
                              ) : (
                                <span>{citation.docPath}</span>
                              )}
                              <span className="text-slate-500">
                                {" "}
                                — {citation.snippet}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Scan & ingest documents
              </h2>
              <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Glob patterns
                <textarea
                  value={scanGlob}
                  onChange={(event) => setScanGlob(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  placeholder="C:/compliance/**/*.pdf"
                  rows={3}
                />
              </label>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleScan()}
                  disabled={scanBusy}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {scanBusy ? "Scanning..." : "Scan"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleIngest()}
                  disabled={ingestBusy || !ingestSelection.length}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ingestBusy ? "Indexing..." : "Ingest"}
                </button>
              </div>

              {ingestMessage ? (
                <p className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                  {ingestMessage}
                </p>
              ) : null}

              <p className="mt-4 text-xs text-slate-500">
                Select the files you want to ingest:
              </p>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
                {scanResults.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-slate-500">
                    No files scanned yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-200 text-xs">
                    {scanResults.map((file) => {
                      const selected = ingestOptions.has(
                        file.replace(/\\/g, "/").toLowerCase(),
                      );
                      return (
                        <li key={file} className="flex items-center gap-2 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              setIngestSelection((prev) => {
                                const normalized = file
                                  .replace(/\\/g, "/")
                                  .toLowerCase();
                                if (event.target.checked) {
                                  return Array.from(
                                    new Set([...prev, file]),
                                  );
                                }
                                return prev.filter(
                                  (item) =>
                                    item.replace(/\\/g, "/").toLowerCase() !==
                                    normalized,
                                );
                              });
                            }}
                            className="h-3 w-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="truncate">{file}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-3xl border bg-slate-900/95 p-6 text-sm text-indigo-100 shadow-sm">
              <h2 className="text-lg font-semibold text-white">
                MCP server endpoint
              </h2>
              <p className="mt-2 text-indigo-200/80">
                External MCP clients can connect to the same host:
              </p>
              <code className="mt-3 block rounded-xl bg-black/40 px-3 py-2 text-xs">
                {serverUrl}
              </code>
              <p className="mt-3 text-xs text-indigo-300/70">
                Exposes tools: ingest.scan, ingest.upsert, ingest.delete,
                retriever.search, chat.answer, admin.status, watch.enable,
                watch.disable. Resources are available at
                resource:doc/&lt;abs-path&gt; and
                resource:chunk/&lt;doc_hash&gt;#&lt;chunk_id&gt;.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusPill({
  label,
  ok,
}: {
  label: string;
  ok?: boolean;
}): JSX.Element {
  if (ok === undefined) {
    return (
      <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-600">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        {label}
      </span>
    );
  }
  return (
    <span
      className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          ok ? "bg-emerald-500" : "bg-rose-500"
        }`}
      />
      {label}
    </span>
  );
}
