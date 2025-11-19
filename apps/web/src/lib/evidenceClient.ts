// apps/web/src/lib/evidenceClient.ts
export type InitEvidenceResp = {
  evidence_id: string | number;
  method?: string;                    // defaults to PUT
  upload_url?: string;                // preferred (absolute or /relative)
  put_url?: string;                   // legacy alias (absolute or /relative)
  headers?: Record<string, string>;   // preferred
  upload_headers?: Record<string, string>; // legacy alias
  storage_url?: string;               // preferred
  uri?: string;                       // legacy alias
  status?: string;                    // e.g., "pending"
};

const apiBase =
  process.env.NEXT_PUBLIC_CORE_SVC_URL ??
  process.env.CORE_SVC_URL ??
  "http://localhost:8001";

// ---------- small utils ----------
function resolveUploadTarget(url?: string): string {
  if (!url) return "";
  try {
    // Absolute? leave as-is
    const u = new URL(url);
    return u.toString();
  } catch {
    // Not absolute — if it starts with '/', prefix with apiBase
    if (url.startsWith("/")) {
      const base = apiBase.replace(/\/+$/, "");
      return `${base}${url}`;
    }
    // Any other relative (e.g. "admin/..."): still prefix apiBase + '/'
    const base = apiBase.replace(/\/+$/, "");
    return `${base}/${url}`;
  }
}

async function jsonOk<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const where = `${res.url || "<no-url>"} -> ${res.status}`;
    throw new Error(`${where} ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

// Returns null on 404, throws otherwise
async function jsonOkOrNull<T>(res: Response): Promise<T | null> {
  if (res.status === 404) return null;
  return jsonOk<T>(res);
}

function headersFromInit(resp: InitEvidenceResp): Record<string, string> {
  return resp.headers ?? resp.upload_headers ?? {};
}

function storageFromInit(resp: InitEvidenceResp): string | undefined {
  return resp.storage_url ?? resp.uri;
}

function pickUploadUrl(resp: InitEvidenceResp): string {
  return resp.upload_url || resp.put_url || "";
}

/**
 * POST /admin/projects/{slug}/controls/{controlId}/evidence:init
 * Falls back to /evidence/init if ':' is filtered by a proxy.
 * Sends both legacy and new body keys for compatibility.
 */
export async function initEvidence(
  projectSlug: string,
  controlId: string,
  filename: string,
  contentType: string,
  sizeBytes: number
): Promise<InitEvidenceResp> {
  const body = JSON.stringify({
    // new keys
    filename,
    contentType,
    sizeBytes,
    // legacy keys
    name: filename,
    mime: contentType,
    size_bytes: sizeBytes,
  });

  const urlA = `${apiBase}/admin/projects/${encodeURIComponent(
    projectSlug
  )}/controls/${encodeURIComponent(controlId)}/evidence:init`;

  const urlB = `${apiBase}/admin/projects/${encodeURIComponent(
    projectSlug
  )}/controls/${encodeURIComponent(controlId)}/evidence/init`;

  console.debug(
    "[initEvidence] POST %s (fallback %s), body: %o",
    urlA,
    urlB,
    { filename, contentType, sizeBytes }
  );

  let res = await fetch(urlA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (res.status === 404 || res.status === 405) {
    console.warn("[initEvidence] %s -> %d, retrying %s", urlA, res.status, urlB);
    res = await fetch(urlB, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  }

  const data = await jsonOk<InitEvidenceResp>(res);
  console.debug("[initEvidence] resp: %o", data);
  return data;
}

/**
 * PUT file bytes to presigned URL.
 * Treat all 2xx as success (some services return 200/201; others 204).
 */
export async function putEvidenceBytes(
  uploadUrl: string,
  file: Blob,
  extraHeaders?: Record<string, string>
): Promise<void> {
  const target = resolveUploadTarget(uploadUrl);
  if (!target) {
    throw new Error("upload failed: missing upload URL (upload_url/put_url)");
  }

  const headers: Record<string, string> = { ...(extraHeaders || {}) };

  // Ensure Content-Type if backend expects it and caller didn't override
  if (!headers["Content-Type"] && !headers["content-type"]) {
    // Using Blob.type (may be empty)
    if (file.type) headers["Content-Type"] = file.type;
    else headers["Content-Type"] = "application/octet-stream";
  }

  // If filename available, pass it along (our backend consumes this)
  // Note: Only set if not already provided by extraHeaders
  if (!headers["X-Original-Filename"] && !headers["x-original-filename"]) {
    const name = (file as File).name || "upload.bin";
    headers["X-Original-Filename"] = name;
  }

  console.debug(
    "[putEvidenceBytes] PUT -> %s, size=%d, headers=%o",
    target,
    file.size,
    headers
  );

  const res = await fetch(target, {
    method: "PUT",
    headers,
    body: file,
  });

  if (!(res.status >= 200 && res.status < 300)) {
    const text = await res.text().catch(() => "");
    console.error(
      "[putEvidenceBytes] failed: %s -> %d %s",
      target,
      res.status,
      text || res.statusText
    );
    throw new Error(`upload failed: ${res.status} ${text || res.statusText}`);
  }

  console.debug("[putEvidenceBytes] uploaded %d bytes to %s", file.size, target);
}

/**
 * POST finalize (optional). Two route styles supported:
 * :finalize and /finalize/
 *
 * NOTE: Payload stays `{ sha256_hex }`. Adjust if your backend differs.
 */
export async function finalizeEvidence(
  projectSlug: string,
  controlId: string,
  evidenceId: string | number,
  sha256Hex?: string
): Promise<{ ok: boolean; evidence_id?: string | number }> {
  const body = JSON.stringify({ sha256_hex: sha256Hex });

  const urlA = `${apiBase}/admin/projects/${encodeURIComponent(
    projectSlug
  )}/controls/${encodeURIComponent(
    controlId
  )}/evidence:finalize/${encodeURIComponent(String(evidenceId))}`;

  const urlB = `${apiBase}/admin/projects/${encodeURIComponent(
    projectSlug
  )}/controls/${encodeURIComponent(
    controlId
  )}/evidence/finalize/${encodeURIComponent(String(evidenceId))}`;

  console.debug("[finalizeEvidence] POST %s (fallback %s) body=%o", urlA, urlB, { sha256Hex });

  let res = await fetch(urlA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (res.status === 404 || res.status === 405) {
    console.warn("[finalizeEvidence] %s -> %d, retrying %s", urlA, res.status, urlB);
    res = await fetch(urlB, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  }

  const data = await jsonOk<{ ok: boolean; evidence_id?: string | number }>(res);
  console.debug("[finalizeEvidence] resp: %o", data);
  return data;
}

/**
 * GET list evidence for a given control.
 *
 * Normalizes the response so the caller always receives:
 *   { items: [...] }
 *
 * Backends may return either:
 *   - { items: [...] }  (preferred)
 *   - [ ... ]           (bare array)
 */
export async function listEvidence(
  projectSlug: string,
  controlId: string
): Promise<{ items: any[] }> {
  const url = `${apiBase}/admin/projects/${encodeURIComponent(
    projectSlug
  )}/controls/${encodeURIComponent(controlId)}/evidence`;

  console.debug("[listEvidence] GET %s", url);

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }

  const data = await res.json().catch(() => null);

  // Normalize into { items: [...] }
  if (Array.isArray(data)) {
    return { items: data };
  }
  if (data && Array.isArray(data.items)) {
    return { items: data.items };
  }
  if (data && Array.isArray(data.attachments)) {
    // our admin API returns { ..., attachments: [...] }
    return { items: data.attachments };
  }
  // Unknown/empty shape -> return empty list to keep UI stable
  return { items: [] };
}

/**
 * OPTIONAL helper if you don’t have control_id in KPI rows.
 * Returns null on 404 (instead of throwing).
 */
export async function resolveControlId(
  projectSlug: string,
  kpiKey: string
): Promise<string | null> {
  const url = `${apiBase}/admin/projects/${encodeURIComponent(
    projectSlug
  )}/kpis/${encodeURIComponent(kpiKey)}/control-id`;

  console.debug("[resolveControlId] GET %s", url);

  const res = await fetch(url, { cache: "no-store" });
  const data = await jsonOkOrNull<{ control_id: string }>(res);
  const cid = data?.control_id ?? null;
  console.debug("[resolveControlId] -> %s", cid);
  return cid;
}

/**
 * POST /admin/evidence/{id}:download-url -> { url }
 */
export async function getDownloadUrl(evidenceId: number | string): Promise<string> {
  const url = `${apiBase}/admin/evidence/${evidenceId}:download-url`;
  console.debug("[getDownloadUrl] POST %s", url);
  const res = await fetch(url, { method: "POST" });
  const data = await jsonOk<{ url: string }>(res);
  return data.url;
}

/**
 * High-level helper: init -> PUT -> finalize (optional).
 * This creates/updates the evidence record on the backend and uploads file bytes
 * to the storage provider via a presigned URL (or direct backend PUT).
 */
export async function uploadEvidenceFile(
  projectSlug: string,
  controlId: string,
  file: File,
  sha256Hex?: string
) {
  console.debug(
    "[uploadEvidenceFile] start project=%s control=%s file=%s(%d bytes) mime=%s",
    projectSlug,
    controlId,
    file.name,
    file.size,
    file.type
  );

  const init = await initEvidence(
    projectSlug,
    controlId,
    file.name,
    file.type || "application/octet-stream",
    file.size
  );

  const rawTarget = pickUploadUrl(init);
  const target = resolveUploadTarget(rawTarget);

  if (!target) {
    console.error("[uploadEvidenceFile] init returned no upload_url/put_url: %o", init);
    throw new Error("upload failed: backend did not return upload_url");
  }

  const headers = { ...headersFromInit(init) };

  // Ensure Content-Type is present if backend expects it
  if (file.type && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = file.type;
  }
  if (!headers["X-Original-Filename"] && !headers["x-original-filename"]) {
    headers["X-Original-Filename"] = file.name || "upload.bin";
  }

  // PUT the file to storage/backend
  await putEvidenceBytes(target, file, headers);

  // finalize (best-effort; some backends treat PUT as authoritative)
  try {
    const fin = await finalizeEvidence(projectSlug, controlId, init.evidence_id, sha256Hex);
    console.debug("[uploadEvidenceFile] finalize -> %o", fin);
  } catch (e) {
    console.warn("[uploadEvidenceFile] finalize failed (ignored): %o", e);
  }

  return {
    evidenceId: init.evidence_id,
    storageUrl: storageFromInit(init),
  };
}
