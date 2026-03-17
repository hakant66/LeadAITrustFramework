import asyncio
import hashlib
import uuid
import io
import json
import os
from typing import List, Optional

import httpx
import pandas as pd
from docx import Document
from pypdf import PdfReader

from app.db_async import get_pool
from app.services.s3_client import get_object

QDRANT_URL = os.getenv("QDRANT_URL", "http://qdrant:6333")
QDRANT_COLLECTION = os.getenv("KNOWLEDGE_VAULT_COLLECTION", "knowledge_vault")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")


def _chunk_text(text: str, size: int = 900, overlap: int = 120) -> List[str]:
    chunks: List[str] = []
    if not text:
        return chunks
    start = 0
    length = len(text)
    while start < length:
        end = min(length, start + size)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= length:
            break
        start = max(0, end - overlap)
    return chunks


def _extract_text_from_pdf(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    texts = []
    for page in reader.pages:
        try:
            texts.append(page.extract_text() or "")
        except Exception:
            continue
    return "\n".join(texts).strip()


def _extract_text_from_docx(data: bytes) -> str:
    doc = Document(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs if p.text).strip()


def _extract_text_from_xlsx(data: bytes) -> str:
    out: List[str] = []
    with pd.ExcelFile(io.BytesIO(data)) as xls:
        for sheet in xls.sheet_names:
            df = xls.parse(sheet)
            out.append(f"Sheet: {sheet}")
            out.append(df.to_csv(index=False))
    return "\n".join(out).strip()


def _extract_text_from_csv(data: bytes) -> str:
    df = pd.read_csv(io.BytesIO(data))
    return df.to_csv(index=False).strip()


def _extract_text(file_name: str, data: bytes) -> str:
    ext = os.path.splitext(file_name)[1].lower()
    try:
        if ext in {".txt", ".md"}:
            return data.decode("utf-8", errors="ignore").strip()
        if ext == ".csv":
            return _extract_text_from_csv(data)
        if ext in {".xlsx", ".xls"}:
            return _extract_text_from_xlsx(data)
        if ext == ".pdf":
            return _extract_text_from_pdf(data)
        if ext == ".docx":
            return _extract_text_from_docx(data)
    except Exception:
        return ""
    return data.decode("utf-8", errors="ignore").strip()


async def _embed_texts(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []
    vectors: List[List[float]] = []
    async with httpx.AsyncClient(timeout=60) as client:
        for text in texts:
            resp = await client.post(
                f"{OLLAMA_URL}/api/embeddings",
                json={"model": OLLAMA_EMBED_MODEL, "prompt": text},
            )
            resp.raise_for_status()
            data = resp.json()
            vec = data.get("embedding") or (
                data.get("data", [{}])[0].get("embedding") if isinstance(data.get("data"), list) else None
            )
            if not vec:
                raise RuntimeError("Embedding response missing vector")
            vectors.append(vec)
    return vectors


async def _ensure_collection(vector_size: int) -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}")
        if resp.status_code == 200:
            return
        if resp.status_code != 404:
            resp.raise_for_status()
        create = await client.put(
            f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}",
            json={"vectors": {"size": vector_size, "distance": "Cosine"}},
        )
        create.raise_for_status()


async def _upsert_chunks(points: List[dict]) -> None:
    if not points:
        return
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.put(
            f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}/points",
            params={"wait": "true"},
            json={"points": points},
        )
        if not resp.is_success:
            raise RuntimeError(f"Qdrant upsert failed: {resp.status_code} {resp.text}")


async def _fetch_object_bytes(object_key: str) -> bytes:
    def _read() -> bytes:
        obj = get_object(object_key)
        body = obj.get("Body")
        data = body.read() if body else b""
        if body:
            body.close()
        return data

    return await asyncio.to_thread(_read)


async def ingest_report_source(source_id: str) -> dict:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, entity_id, project_slug, title, source_type,
                   object_key, file_name, file_mime, metadata, content
            FROM report_sources
            WHERE id = $1
            """,
            source_id,
        )
        if not row:
            return {"ok": False, "error": "source not found"}
        object_key = row["object_key"]
        file_name = row["file_name"] or row["object_key"] or "source.bin"
        content_text = row["content"] or ""
        meta = row["metadata"] if isinstance(row["metadata"], dict) else {}

    try:
        if object_key:
            data = await _fetch_object_bytes(object_key)
            text = _extract_text(file_name, data)
            doc_hash = hashlib.sha256(data).hexdigest() if data else ""
        else:
            text = content_text
            doc_hash = hashlib.sha256(text.encode("utf-8")).hexdigest() if text else ""

        if not text:
            raise RuntimeError("No text available to index.")

        chunks = _chunk_text(text)
        vectors = await _embed_texts(chunks)
        if vectors:
            await _ensure_collection(len(vectors[0]))
        points = []
        for idx, vec in enumerate(vectors):
            payload = {
                "source_id": source_id,
                "entity_id": str(row["entity_id"]),
                "project_slug": row["project_slug"],
                "title": row["title"],
                "file_name": file_name,
                "object_key": object_key,
                "chunk_index": idx,
                "text": chunks[idx],
                "doc_hash": doc_hash,
            }
            point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{source_id}:{idx}"))
            points.append({"id": point_id, "vector": vec, "payload": payload})

        await _upsert_chunks(points)

        meta["ingest"] = {
            "status": "ok",
            "chunks": len(chunks),
            "embedding_model": OLLAMA_EMBED_MODEL,
            "collection": QDRANT_COLLECTION,
        }
        preview = (text or "")[:4000] if text else None

        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE report_sources
                SET metadata = $1::jsonb,
                    content = COALESCE(NULLIF(content, ''), $2),
                    updated_at = NOW()
                WHERE id = $3
                """,
                json.dumps(meta),
                preview,
                source_id,
            )
        return {"ok": True, "chunks": len(chunks)}
    except Exception as exc:
        meta["ingest"] = {
            "status": "error",
            "error": str(exc),
        }
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE report_sources
                SET metadata = $1::jsonb,
                    updated_at = NOW()
                WHERE id = $2
                """,
                json.dumps(meta),
                source_id,
            )
        return {"ok": False, "error": str(exc)}


async def search_knowledge_vault(
    *, entity_id: Optional[str], query: str, limit: int = 6
) -> dict:
    if not query.strip():
        return {"ok": True, "results": []}
    vectors = await _embed_texts([query.strip()])
    if not vectors:
        return {"ok": True, "results": []}
    qvec = vectors[0]
    async with httpx.AsyncClient(timeout=30) as client:
        payload = {
            "vector": qvec,
            "limit": limit,
            "with_payload": True,
        }
        if entity_id:
            payload["filter"] = {
                "must": [
                    {"key": "entity_id", "match": {"value": entity_id}},
                ]
            }
        resp = await client.post(
            f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}/points/search",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
    out = []
    for hit in data.get("result", []) or []:
        payload = hit.get("payload") or {}
        out.append(
            {
                "score": hit.get("score"),
                "source_id": payload.get("source_id"),
                "title": payload.get("title"),
                "file_name": payload.get("file_name"),
                "project_slug": payload.get("project_slug"),
                "chunk_index": payload.get("chunk_index"),
                "text": payload.get("text"),
            }
        )
    return {"ok": True, "results": out}
