// apps/mcp/src/server.ts
// ----------------------------------------------------------------------------
// LeadAI MCP + Express server
// ----------------------------------------------------------------------------

import { FastMCP } from "fastmcp";
import { z } from "zod";
import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { globby } from "globby";

// ---- Config -----------------------------------------------------------------
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const COLLECTION = process.env.QDRANT_COLLECTION ?? "leadai_docs";
const EMB_MODEL = process.env.EMB_MODEL ?? "nomic-embed-text";
const CHAT_MODEL = process.env.CHAT_MODEL ?? "llama3.1:8b";
const ENABLE_MCP = (process.env.ENABLE_MCP ?? "1") !== "0";
const TRUST_CORE_URL = process.env.TRUST_CORE_URL ?? "";
const ALLOW_DIRS = (process.env.ALLOW_DIRS ?? "C:/data; /data")
  .split(/[;,]/)
  .map((s) => s.trim())
  .filter(Boolean);

// ---- Utils ------------------------------------------------------------------
function sha256(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// Deterministic UUID from an arbitrary string (v5-ish; good enough for ids)
function uuidFromString(s: string): string {
  // hash to 16 bytes
  const h = crypto.createHash("sha1").update(s).digest(); // 20 bytes
  const b = Buffer.from(h.subarray(0, 16)); // 16 bytes
  // set version (5) and variant
  b[6] = (b[6] & 0x0f) | 0x50; // version 5 (0101xxxx)
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xxxxxx
  const hex = b.toString("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// ---- Embeddings (single prompt per call; robust to shape) -------------------
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
    if (!vec || !Array.isArray(vec) || !vec.length) {
      throw new Error(`Embeddings response had no vector. Raw: ${JSON.stringify(j).slice(0, 500)}`);
    }
    vectors.push(vec);
  }
  return vectors;
}

let CACHED_EMBED_DIM: number | null = null;
async function detectEmbedDim(): Promise<number> {
  if (CACHED_EMBED_DIM) return CACHED_EMBED_DIM;
  const [v] = await embed(["probe"]);
  CACHED_EMBED_DIM = v.length;
  return CACHED_EMBED_DIM;
}

// ---- Chat (non-streaming) ---------------------------------------------------
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

// ---- Parsers ----------------------------------------------------------------
import mammoth from "mammoth";
import * as XLSX from "xlsx";

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

async function parsePdf(buf: Buffer) {
  const pdfjsLib: any = await loadPdfJs();
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
    for (const item of content.items as any[]) if (item?.str) text += item.str + " ";
    text += "\n\n";
  }
  return { text, meta: {} as Record<string, unknown> };
}

async function parseDocx(buf: Buffer) {
  const res = await mammoth.extractRawText({ buffer: buf });
  return { text: res.value, meta: {} as Record<string, unknown> };
}

async function parseXlsx(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    parts.push(`# Sheet: ${name}\n${XLSX.utils.sheet_to_csv(ws)}`);
  }
  return { text: parts.join("\n\n"), meta: {} as Record<string, unknown> };
}

function chunkText(text: string, size = 900, overlap = 120) {
  const chunks: { id: string; text: string; meta: any }[] = [];
  let i = 0,
    id = 0;
  while (i < text.length) {
    const slice = text.slice(i, i + size);
    chunks.push({ id: `${id++}`, text: slice, meta: {} });
    i += Math.max(1, size - overlap);
  }
  return chunks;
}

function isAllowedPath(absPath: string): boolean {
  const norm = absPath.replace(/\\/g, "/").toLowerCase();
  return ALLOW_DIRS.some((dir) =>
    norm.startsWith(dir.replace(/\\/g, "/").toLowerCase())
  );
}

// ---- Qdrant (via REST) ------------------------------------------------------
async function ensureCollection(vectorSize: number) {
  const get = await fetch(`${QDRANT_URL}/collections/${encodeURIComponent(COLLECTION)}`);
  if (get.ok) return; // exists

  const put = await fetch(`${QDRANT_URL}/collections/${encodeURIComponent(COLLECTION)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      vectors: { size: vectorSize, distance: "Cosine" },
      on_disk_payload: true,
    }),
  });
  if (!put.ok) {
    throw new Error(`Failed to create collection: ${put.status} ${await put.text()}`);
  }
}

// ---- Core logic --------------------------------------------------------------
async function ingestUpsertImpl({
  paths,
  chunkSize = 900,
  overlap = 120,
}: {
  paths: string[];
  chunkSize?: number;
  overlap?: number;
}) {
  const dim = await detectEmbedDim();
  await ensureCollection(dim);

  let docs = 0,
    chunksTotal = 0;

  for (const p of paths) {
    const abs = path.resolve(p);
    const buf = await fs.readFile(abs);
    const docHash = sha256(buf);
    const ext = path.extname(abs).toLowerCase();

    let parsed;
    if (ext === ".pdf") parsed = await parsePdf(buf);
    else if (ext === ".docx") parsed = await parseDocx(buf);
    else if (ext === ".xlsx") parsed = await parseXlsx(buf);
    else continue;

    const chunks = chunkText(parsed.text, chunkSize, overlap).map((c) => ({
      ...c,
      meta: { ...parsed.meta, source_path: abs },
    }));

    const vectors = await embed(chunks.map((c) => c.text));

    // --- Qdrant REST upsert (UUID ids) ---
    const upsertResp = await fetch(
      `${QDRANT_URL}/collections/${encodeURIComponent(COLLECTION)}/points?wait=true`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          points: chunks.map((c, i) => ({
            id: uuidFromString(`${docHash}:${c.id}`), // << valid UUID
            vector: vectors[i],
            payload: {
              text: c.text,
              source_path: abs,
              doc_hash: docHash,
              chunk_id: c.id,
            },
          })),
        }),
      }
    );
    if (!upsertResp.ok) {
      throw new Error(`Qdrant upsert failed: ${upsertResp.status} ${await upsertResp.text()}`);
    }

    docs += 1;
    chunksTotal += chunks.length;
  }

  return { indexed: docs, chunks: chunksTotal };
}

async function ingestScanImpl({ globs }: { globs: string[] }) {
  const files = await globby(globs, { onlyFiles: true, absolute: true });
  const allowedExt = new Set([".pdf", ".docx", ".xlsx"]);
  const filtered = files.filter((f) => {
    if (!allowedExt.has(path.extname(f).toLowerCase())) return false;
    return isAllowedPath(f);
  });
  return { files: filtered };
}

async function retrieverSearchImpl({ query, k = 8 }: { query: string; k?: number }) {
  const [qvec] = await embed([query]);

  // --- Qdrant REST search ---
  const searchResp = await fetch(
    `${QDRANT_URL}/collections/${encodeURIComponent(COLLECTION)}/points/search`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vector: qvec,
        limit: k,
        with_payload: true,
      }),
    }
  );
  if (!searchResp.ok) {
    throw new Error(`Qdrant search failed: ${searchResp.status} ${await searchResp.text()}`);
  }
  const searchJson: any = await searchResp.json();

  const items = (searchJson?.result ?? []).map((p: any) => ({
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
  maxTokens = 512,
}: {
  query: string;
  k?: number;
  keep?: number;
  maxTokens?: number;
}) {
  const { items } = await retrieverSearchImpl({ query, k });
  const top = items.slice(0, keep);

  const context = top
    .map((it: any, i: number) => `[#${i + 1}] ${it.payload.doc_path}\n${it.payload.content}`)
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

  const citations = top.map((it: any, i: number) => ({
    reference: String(i + 1),
    resource: `resource:chunk/${it.payload.doc_hash}#${it.payload.chunk_id}`,
    docPath: it.payload.doc_path,
    snippet:
      it.payload.content.slice(0, 160).replace(/\s+/g, " ") +
      (it.payload.content.length > 160 ? "…" : ""),
  }));

  const contextForUi = items.map((it: any) => ({
    id: it.id,
    score: it.score,
    payload: it.payload,
  }));

  return { answer, citations, context: contextForUi };
}

async function adminStatusImpl() {
  let qdrantUp = false;
  try {
    const ping = await fetch(`${QDRANT_URL}`);
    qdrantUp = ping.ok;
  } catch {
    qdrantUp = false;
  }

  let collectionExists = false;
  try {
    const r = await fetch(`${QDRANT_URL}/collections/${encodeURIComponent(COLLECTION)}`);
    collectionExists = r.ok;
  } catch {
    collectionExists = false;
  }

  let ollama = false;
  try {
    const r = await fetch(`${OLLAMA_URL}/api/version`);
    ollama = r.ok;
  } catch {
    ollama = false;
  }

  return { ollama, qdrant: qdrantUp, collection: collectionExists ? COLLECTION : "" };
}

function evaluateTrustStub(manifestFacts: any, includeDebug = false) {
  const gates: any[] = [];
  const evidenceStatus = manifestFacts?.evidence?.status ?? {};
  const evidenceIntegrity = manifestFacts?.evidence?.integrity ?? {};
  const personalPresent = manifestFacts?.personal_data?.present === true;
  const dpiastatus = String(evidenceStatus?.DPIA ?? "").toLowerCase();
  const sensitiveIncluded =
    manifestFacts?.data_categories?.findings?.sensitive_included === true;

  if (evidenceIntegrity?.any_hash_mismatch === true) {
    gates.push({
      gate_id: "evidence_hash_mismatch",
      forced_level: "P0",
      reasons: [{ code: "EVIDENCE_HASH_MISMATCH", message: "Evidence hash mismatch detected." }],
    });
  }

  if (personalPresent && ["missing", "expired", "invalid"].includes(dpiastatus)) {
    gates.push({
      gate_id: "missing_dpia_when_personal_data",
      forced_level: "P0",
      reasons: [
        {
          code: "DPIA_REQUIRED",
          message: "DPIA missing/expired/invalid while personal data is present.",
        },
      ],
    });
  }

  if (sensitiveIncluded) {
    gates.push({
      gate_id: "sensitive_data_included",
      forced_level: "P0",
      reasons: [{ code: "SENSITIVE_DATA_INCLUDED", message: "Sensitive data included." }],
    });
  }

  const forced = gates.length > 0;
  const overallLevel = forced ? "P0" : "P1";
  const overallScore = forced ? 0 : 1;

  const result: any = {
    overall: {
      level: overallLevel,
      score: overallScore,
      forced,
      reasons: [
        {
          code: forced ? "GATE_OVERRIDE" : "STUB",
          message: forced
            ? "Overall level forced by gate."
            : "Stubbed evaluation (MCP test mode).",
        },
      ],
    },
    fields: [],
    gates,
  };

  if (includeDebug) {
    result.debug = { source: "mcp_stub" };
  }

  return result;
}

async function evaluateTrustViaCore(manifestFacts: any, includeDebug = false) {
  if (!TRUST_CORE_URL) return null;
  const base = TRUST_CORE_URL.endsWith("/") ? TRUST_CORE_URL : `${TRUST_CORE_URL}/`;
  const url = new URL("trust/provenance/evaluate", base);
  url.searchParams.set("source", "local");
  if (includeDebug) url.searchParams.set("debug", "true");

  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest_facts: manifestFacts }),
  });
  if (!resp.ok) {
    throw new Error(`core-svc trust evaluate failed (${resp.status})`);
  }
  return resp.json();
}

async function auditEventViaCore(payload: any) {
  if (!TRUST_CORE_URL) {
    throw new Error("TRUST_CORE_URL not configured");
  }
  const base = TRUST_CORE_URL.endsWith("/") ? TRUST_CORE_URL : `${TRUST_CORE_URL}/`;
  const url = new URL("audit/events", base);
  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
  if (!resp.ok) {
    throw new Error(`core-svc audit event failed (${resp.status})`);
  }
  return resp.json();
}

// ---- MCP tools ---------------------------------------------------------------
const mcp = new FastMCP({ name: "leadai-mcp", version: "0.1.0" });

mcp.addTool({
  name: "ingest.scan",
  description: "Scan file globs and return matching documents",
  parameters: z.object({
    globs: z.array(z.string()),
  }),
  execute: async (args) => (await ingestScanImpl(args)) as any,
});

mcp.addTool({
  name: "ingest.upsert",
  description: "Parse -> chunk -> embed -> upsert to Qdrant",
  parameters: z.object({
    paths: z.array(z.string()),
    chunkSize: z.number().default(900),
    overlap: z.number().default(120),
  }),
  execute: async (args) => (await ingestUpsertImpl(args)) as any,
});

mcp.addTool({
  name: "retriever.search",
  description: "Vector search over indexed chunks",
  parameters: z.object({
    query: z.string(),
    k: z.number().default(8),
  }),
  execute: async (args) => (await retrieverSearchImpl(args)) as any,
});

mcp.addTool({
  name: "chat.answer",
  description: "RAG: retrieve and answer with citations",
  parameters: z.object({
    query: z.string(),
    k: z.number().default(8),
    keep: z.number().default(4),
    maxTokens: z.number().default(512),
  }),
  execute: async (args) => (await chatAnswerImpl(args)) as any,
});

mcp.addTool({
  name: "admin.status",
  description: "Health/status of backends",
  parameters: z.object({}),
  execute: async () => (await adminStatusImpl()) as any,
});

mcp.addTool({
  name: "trust.evaluate",
  description: "Provenance evaluation via core-svc rules (fallback to stub)",
  parameters: z.object({
    manifest_facts: z.record(z.any()),
    debug: z.boolean().optional(),
  }),
  execute: async (args) => {
    const includeDebug = !!args.debug;
    const manifestFacts = args.manifest_facts ?? {};
    try {
      const result = await evaluateTrustViaCore(manifestFacts, includeDebug);
      if (result) return result as any;
    } catch (err) {
      console.warn("trust.evaluate core-svc fallback:", err);
    }
    return evaluateTrustStub(manifestFacts, includeDebug) as any;
  },
});

mcp.addTool({
  name: "audit.event",
  description: "Write audit event to core-svc",
  parameters: z.object({
    event_type: z.string(),
    actor: z.string().optional(),
    actor_type: z.string().optional(),
    source_service: z.string().optional(),
    object_type: z.string().optional(),
    object_id: z.string().optional(),
    project_slug: z.string().optional(),
    details: z.record(z.any()).optional(),
  }),
  execute: async (args) => (await auditEventViaCore(args)) as any,
});

if (ENABLE_MCP) {
  mcp.start({ transportType: "stdio" });
}

// ---- Express (Next.js proxy) -------------------------------------------------
const app = express();
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Debug
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
    const r = await fetch(`${QDRANT_URL}/collections/${encodeURIComponent(COLLECTION)}`);
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

// Extra diagnostics
app.get("/tools/admin.embedlen", async (req, res) => {
  const text = (req.query.q as string) || "hello";
  try {
    const [v] = await embed([text]);
    res.json({ length: v.length });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

// Pure REST test upsert (UUID id)
app.get("/tools/admin.qdrant.testupsert", async (_req, res) => {
  try {
    const dim = await detectEmbedDim();
    await ensureCollection(dim);
    const vec = Array.from({ length: dim }, () => 0);

    const r = await fetch(
      `${QDRANT_URL}/collections/${encodeURIComponent(COLLECTION)}/points?wait=true`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          points: [
            {
              id: crypto.randomUUID(), // << valid UUID
              vector: vec,
              payload: { text: "diag", source_path: "diag" },
            },
          ],
        }),
      }
    );
    if (!r.ok) {
      return res
        .status(500)
        .json({ error: `test upsert failed: ${r.status} ${await r.text()}` });
    }
    res.json({ ok: true, dim });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

// Tool endpoints
app.get("/tools/admin.status", async (_req, res) => {
  try {
    res.json(await adminStatusImpl());
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "status failed" });
  }
});

app.post("/tools/ingest.upsert", async (req, res) => {
  try {
    res.json(await ingestUpsertImpl(req.body ?? {}));
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "ingest failed" });
  }
});

app.post("/tools/ingest.scan", async (req, res) => {
  try {
    res.json(await ingestScanImpl(req.body ?? {}));
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "scan failed" });
  }
});

app.post("/tools/retriever.search", async (req, res) => {
  try {
    res.json(await retrieverSearchImpl(req.body ?? {}));
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "search failed" });
  }
});

app.post("/tools/chat.answer", async (req, res) => {
  try {
    res.json(await chatAnswerImpl(req.body ?? {}));
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "chat failed" });
  }
});

app.post("/tools/trust.evaluate", async (req, res) => {
  try {
    const manifestFacts = req.body?.manifest_facts ?? {};
    const includeDebug = req.body?.debug === true;
    try {
      const result = await evaluateTrustViaCore(manifestFacts, includeDebug);
      if (result) return res.json(result);
    } catch (err: any) {
      console.warn("trust.evaluate core-svc fallback:", err);
    }
    res.json(evaluateTrustStub(manifestFacts, includeDebug));
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "trust evaluate failed" });
  }
});

app.post("/tools/audit.event", async (req, res) => {
  try {
    res.json(await auditEventViaCore(req.body ?? {}));
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "audit event failed" });
  }
});

// Resource endpoints
// NOTE: we can't use the composite id anymore. We look up by payload filter.
app.get("/resources/chunk/:docHash/:chunkId", async (req, res) => {
  const { docHash, chunkId } = req.params;
  try {
    const scrollResp = await fetch(
      `${QDRANT_URL}/collections/${encodeURIComponent(COLLECTION)}/points/scroll`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filter: {
            must: [
              { key: "doc_hash", match: { value: docHash } },
              { key: "chunk_id", match: { value: chunkId } },
            ],
          },
          with_payload: true,
          limit: 1,
        }),
      }
    );
    if (!scrollResp.ok) {
      return res
        .status(500)
        .send(`Qdrant scroll failed: ${scrollResp.status} ${await scrollResp.text()}`);
    }
    const scrollJson: any = await scrollResp.json();
    const item = scrollJson?.result?.points?.[0];
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
  if (!isAllowedPath(absPath)) return res.status(403).send("Access denied");

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
