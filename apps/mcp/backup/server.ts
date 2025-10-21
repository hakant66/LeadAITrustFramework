// apps/mcp/src/server.ts
// ----------------------------------------------------------------------------
// LeadAI MCP + Express server
// - Registers MCP tools via FastMCP v3 (TypeScript API)
// - Uses zod to define/validate tool parameters
// - Exposes HTTP endpoints (/tools/*) for your Next.js proxy
// - Exposes /resources/* for clickable citation links in the UI
// ----------------------------------------------------------------------------

import { FastMCP } from "fastmcp";   // FastMCP v3 entrypoint
import { z } from "zod";             // Schema validation for tool parameters
import express from "express";
import cors from "cors";
import { QdrantClient } from "@qdrant/js-client-rest";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// ---- Config (env or defaults) ------------------------------------------------
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const COLLECTION = process.env.QDRANT_COLLECTION ?? "leadai_docs";
const EMB_MODEL = process.env.EMB_MODEL ?? "nomic-embed-text"; // embeddings model in Ollama
const CHAT_MODEL = process.env.CHAT_MODEL ?? "llama3.1:8b";    // chat/generation model in Ollama
const ENABLE_MCP = (process.env.ENABLE_MCP ?? "1") !== "0";    // allow disabling stdio MCP

// ---- Clients & utilities -----------------------------------------------------
const qdrant = new QdrantClient({ url: QDRANT_URL });
function sha256(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// ---- Embeddings (robust, single-prompt per request) --------------------------
// On your Ollama build, /api/embeddings works reliably with {prompt:"..."} and
// a single string (batched arrays returned empty vectors).
async function embed(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (const t of texts) {
    const r = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: EMB_MODEL, prompt: t }),
    });
    if (!r.ok) throw new Error(`Embeddings failed (${r.status}): ${await r.text()}`);
    const j: any = await r.json();
    const vec =
      (Array.isArray(j?.embedding) && j.embedding) ||
      (Array.isArray(j?.data) && Array.isArray(j.data[0]?.embedding) && j.data[0].embedding) ||
      (Array.isArray(j?.vector) && j.vector) ||
      null;
    if (!vec || !Array.isArray(vec) || vec.length === 0) {
      throw new Error(`Embeddings response had no vector. Raw: ${JSON.stringify(j).slice(0, 500)}`);
    }
    vectors.push(vec);
  }
  return vectors;
}

// Detect the embedding dimension once and cache
let CACHED_EMBED_DIM: number | null = null;
async function detectEmbedDim(): Promise<number> {
  if (CACHED_EMBED_DIM) return CACHED_EMBED_DIM;
  const [v] = await embed(["probe"]);
  if (!v?.length) throw new Error("Could not detect embedding dimension.");
  CACHED_EMBED_DIM = v.length;
  return CACHED_EMBED_DIM;
}

// ---- Chat (non-streaming) ----------------------------------------------------
async function chat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  stream = false
) {
  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: CHAT_MODEL, messages, stream }),
  });
  if (stream) return r;
  const j: any = await r.json();
  return j.message?.content ?? "";
}

// ---- Parsers -----------------------------------------------------------------
import mammoth from "mammoth";
import * as XLSX from "xlsx";

// Dynamically load pdfjs-dist from a few possible paths (varies by version)
async function loadPdfJs() {
  try {
    return await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch {
    try {
      return await import("pdfjs-dist/build/pdf.mjs");
    } catch {
      return await import("pdfjs-dist");
    }
  }
}

async function parsePdf(
  buf: Buffer
): Promise<{ text: string; meta: Record<string, unknown> }> {
  const pdfjsLib: any = await loadPdfJs();
  // Buffer extends Uint8Array; force a clean view:
  const data = Buffer.isBuffer(buf)
    ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    : (buf as unknown as Uint8Array);

  const loadingTask = pdfjsLib.getDocument({
    data,
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;

  let text = "";
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    for (const item of content.items as any[]) {
      if (item && typeof item.str === "string") text += item.str + " ";
    }
    text += "\n\n";
  }
  return { text, meta: {} };
}

async function parseDocx(buf: Buffer) {
  const res = await mammoth.extractRawText({ buffer: buf });
  return { text: res.value, meta: {} };
}

async function parseXlsx(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const parts: string[] = [];
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(ws);
    parts.push(`# Sheet: ${name}\n${csv}`);
  });
  return { text: parts.join("\n\n"), meta: {} };
}

// Simple character-based chunker
function chunkText(text: string, size = 900, overlap = 120) {
  const chunks: { id: string; text: string; meta: any }[] = [];
  let i = 0, id = 0;
  while (i < text.length) {
    const slice = text.slice(i, i + size);
    chunks.push({ id: `${id++}`, text: slice, meta: {} });
    i += Math.max(1, size - overlap); // prevent infinite loop
  }
  return chunks;
}

// ---- Core logic --------------------------------------------------------------
async function ensureCollection(vectorSize: number) {
  // If collection exists, keep it; otherwise create with the correct size
  try {
    await qdrant.collections.get(COLLECTION);
    return;
  } catch {
    // not found -> create below
  }
  await qdrant.collections.createOrUpdate({
    collection_name: COLLECTION,
    vectors: { size: vectorSize, distance: "Cosine" },
  });
}

async function ingestUpsertImpl({
  paths,
  chunkSize = 900,
  overlap = 120,
}: {
  paths: string[];
  chunkSize?: number;
  overlap?: number;
}) {
  // Detect dimension from the embedding model and ensure collection matches
  const dim = await detectEmbedDim();
  await ensureCollection(dim);

  let docs = 0;
  let chunksTotal = 0;

  for (const p of paths) {
    const abs = path.resolve(p);
    const buf = await fs.readFile(abs);
    const docHash = sha256(buf);
    const ext = path.extname(abs).toLowerCase();

    let parsed: { text: string; meta: Record<string, unknown> };
    if (ext === ".pdf") parsed = await parsePdf(buf);
    else if (ext === ".docx") parsed = await parseDocx(buf);
    else if (ext === ".xlsx") parsed = await parseXlsx(buf);
    else continue; // skip unsupported

    const chunks = chunkText(parsed.text, chunkSize, overlap).map((c) => ({
      ...c,
      meta: { ...parsed.meta, source_path: abs },
    }));

    const vectors = await embed(chunks.map((c) => c.text));

    // ✅ Use points.upsert (stable across client versions)
    try {
      await qdrant.points.upsert({
        collection_name: COLLECTION,
        wait: true,
        points: chunks.map((c, i) => ({
          id: `${docHash}:${c.id}`,
          vector: vectors[i],
          payload: {
            text: c.text,
            source_path: abs,
            doc_hash: docHash,
            chunk_id: c.id,
          },
        })),
      });
    } catch (e: any) {
      throw new Error(
        `Qdrant upsert failed: ${String(e?.message ?? e)} (vecDim=${vectors?.[0]?.length}, collection=${COLLECTION})`
      );
    }

    docs += 1;
    chunksTotal += chunks.length;
  }

  return { indexed: docs, chunks: chunksTotal };
}

async function retrieverSearchImpl({ query, k = 8 }: { query: string; k?: number }) {
  const [qvec] = await embed([query]);

  // ✅ Use points.search
  const res = await qdrant.points.search({
    collection_name: COLLECTION,
    vector: qvec,
    limit: k,
    with_payload: true,
  });

  const items = (res?.points ?? []).map((p: any) => ({
    id: String(p.id),
    score: p.score,
    payload: {
      doc_path: p.payload?.source_path ?? "",
      doc_hash: p.payload?.doc_hash ?? "",
      chunk_id: String(p.payload?.chunk_id ?? ""),
      content: p.payload?.text ?? "",
      title: p.payload?.title ?? "",
    },
    raw: p.payload,
  }));
  return { items };
}

async function chatAnswerImpl({
  query,
  k = 8,
  keep = 4,
  maxTokens = 512, // reserved
}: {
  query: string;
  k?: number;
  keep?: number;
  maxTokens?: number;
}) {
  const { items } = await retrieverSearchImpl({ query, k });
  const top = items.slice(0, keep);

  const context = top
    .map((it, i) => `[#${i + 1}] ${it.payload.doc_path}\n${it.payload.content}`)
    .join("\n\n");

  const messages = [
    {
      role: "system" as const,
      content:
        "Answer ONLY from the provided context. If not found, say you don't know. Cite as [#n]. Keep answers concise.",
    },
    { role: "user" as const, content: `Context:\n${context}\n\nQ: ${query}\nA:` },
  ];

  const answer = await chat(messages);

  const citations = top.map((it, i) => ({
    reference: String(i + 1),
    resource: `resource:chunk/${it.payload.doc_hash}#${it.payload.chunk_id}`,
    docPath: it.payload.doc_path,
    snippet:
      it.payload.content.slice(0, 160).replace(/\s+/g, " ") +
      (it.payload.content.length > 160 ? "…" : ""),
  }));

  const contextForUi = items.map((it) => ({
    id: it.id,
    score: it.score,
    payload: it.payload,
  }));

  return { answer, citations, context: contextForUi };
}

async function adminStatusImpl() {
  // Qdrant reachable?
  let qdrantUp = false;
  try {
    const ping = await fetch(`${QDRANT_URL}`);
    qdrantUp = ping.ok;
  } catch {
    qdrantUp = false;
  }

  // Collection exists?
  let collectionExists = false;
  try {
    await qdrant.collections.get(COLLECTION);
    collectionExists = true;
  } catch {
    collectionExists = false;
  }

  // Ollama reachable?
  let ollama = false;
  try {
    const r = await fetch(`${OLLAMA_URL}/api/version`);
    ollama = r.ok;
  } catch {
    ollama = false;
  }

  return {
    ollama,
    qdrant: qdrantUp,
    collection: collectionExists ? COLLECTION : "",
  };
}

// ---- MCP server (FastMCP v3) ------------------------------------------------
const mcp = new FastMCP({ name: "leadai-mcp", version: "0.1.0" });

// Tool: ingest.upsert
mcp.addTool({
  name: "ingest.upsert",
  description: "Parse -> chunk -> embed -> upsert to Qdrant",
  parameters: z.object({
    paths: z.array(z.string()),
    chunkSize: z.number().default(900),
    overlap: z.number().default(120),
  }),
  execute: async (args) => ingestUpsertImpl(args),
});

// Tool: retriever.search
mcp.addTool({
  name: "retriever.search",
  description: "Vector search over indexed chunks",
  parameters: z.object({
    query: z.string(),
    k: z.number().default(8),
  }),
  execute: async (args) => retrieverSearchImpl(args),
});

// Tool: chat.answer
mcp.addTool({
  name: "chat.answer",
  description: "RAG: retrieve and answer with citations",
  parameters: z.object({
    query: z.string(),
    k: z.number().default(8),
    keep: z.number().default(4),
    maxTokens: z.number().default(512),
  }),
  execute: async (args) => chatAnswerImpl(args),
});

// Tool: admin.status
mcp.addTool({
  name: "admin.status",
  description: "Health/status of backends",
  parameters: z.object({}),
  execute: async () => adminStatusImpl(),
});

// Start stdio MCP if enabled
if (ENABLE_MCP) {
  mcp.start({ transportType: "stdio" });
}

// ---- Express HTTP layer (for Next.js browser calls) --------------------------
const app = express();
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], credentials: true })); // dev CORS
app.use(express.json({ limit: "2mb" }));

app.get("/health", async (_req, res) => res.json({ ok: true }));

// Debug endpoint (now uses prompt for embeddings)
app.get("/tools/admin.debug", async (_req, res) => {
  const out: any = {
    env: { OLLAMA_URL, QDRANT_URL, COLLECTION, EMB_MODEL, CHAT_MODEL },
    checks: {},
  };
  try {
    const r = await fetch(`${QDRANT_URL}`);
    out.checks.qdrant_root = { status: r.status, ok: r.ok, body: await r.text() };
  } catch (e: any) {
    out.checks.qdrant_root = { error: String(e?.message ?? e) };
  }
  try {
    const r = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`);
    out.checks.qdrant_collection = { status: r.status, ok: r.ok, body: await r.text() };
  } catch (e: any) {
    out.checks.qdrant_collection = { error: String(e?.message ?? e) };
  }
  try {
    const r = await fetch(`${OLLAMA_URL}/api/version`);
    out.checks.ollama_version = { status: r.status, ok: r.ok, body: await r.text() };
  } catch (e: any) {
    out.checks.ollama_version = { error: String(e?.message ?? e) };
  }
  try {
    const r = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: EMB_MODEL, prompt: "hello" }),
    });
    out.checks.ollama_embeddings = { status: r.status, ok: r.ok, body: await r.text() };
  } catch (e: any) {
    out.checks.ollama_embeddings = { error: String(e?.message ?? e) };
  }
  res.json(out);
});

// Tiny diagnostics
app.get("/tools/admin.embedlen", async (req, res) => {
  const text = (req.query.q as string) || "hello";
  try {
    const [v] = await embed([text]);
    res.json({ length: v.length });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

app.get("/tools/admin.qdrant.testupsert", async (_req, res) => {
  try {
    const dim = await detectEmbedDim();
    await ensureCollection(dim);
    const vec = Array.from({ length: dim }, () => 0);
    await qdrant.points.upsert({
      collection_name: COLLECTION,
      wait: true,
      points: [{ id: "diag:0", vector: vec, payload: { text: "diag", source_path: "diag" } }],
    });
    res.json({ ok: true, dim });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

// Tool endpoints
app.get("/tools/admin.status", async (_req, res) => {
  try {
    const out = await adminStatusImpl();
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "status failed" });
  }
});

app.post("/tools/ingest.upsert", async (req, res) => {
  try {
    const out = await ingestUpsertImpl(req.body ?? {});
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "ingest failed" });
  }
});

app.post("/tools/retriever.search", async (req, res) => {
  try {
    const out = await retrieverSearchImpl(req.body ?? {});
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "search failed" });
  }
});

app.post("/tools/chat.answer", async (req, res) => {
  try {
    const out = await chatAnswerImpl(req.body ?? {});
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "chat failed" });
  }
});

// Resource endpoints (for citation links)
app.get("/resources/chunk/:docHash/:chunkId", async (req, res) => {
  const { docHash, chunkId } = req.params;
  try {
    const id = `${docHash}:${chunkId}`;
    const result = await qdrant.points.get({
      collection_name: COLLECTION,
      ids: [id],
      with_payload: true,
    });
    const item = result?.result?.[0];
    if (!item?.payload) return res.status(404).send("Chunk not found");

    const p: any = item.payload;
    res.json({
      docPath: p.source_path,
      chunkId: p.chunk_id,
      text: p.text,
      page: p.page ?? null,
      sheet: p.sheet ?? null,
      title: p.title ?? null,
    });
  } catch (e: any) {
    res.status(500).send(e?.message ?? "Error reading chunk");
  }
});

app.get("/resources/doc/:encodedPath", async (req, res) => {
  const absPath = decodeURIComponent(req.params.encodedPath);

  const ALLOW = (process.env.ALLOW_DIRS ?? "C:/data; /data")
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const norm = absPath.replace(/\\/g, "/").toLowerCase();
  const isAllowed = ALLOW.some((dir) =>
    norm.startsWith(dir.replace(/\\/g, "/").toLowerCase())
  );
  if (!isAllowed) return res.status(403).send("Access denied");

  try {
    const buf = await fs.readFile(absPath);
    const ext = path.extname(absPath).toLowerCase();
    const type =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : ext === ".xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/octet-stream";

    res.setHeader("content-type", type);
    res.send(buf);
  } catch {
    res.status(404).send("File not found");
  }
});

// ---- Start HTTP (+ graceful shutdown) ---------------------------------------
const PORT = Number(process.env.PORT ?? 8787);
const server = app.listen(PORT, () => {
  console.log(`HTTP ready on http://localhost:${PORT}`);
});

function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down...`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
