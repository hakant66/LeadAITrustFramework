from __future__ import annotations

import json
import hashlib
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List

import httpx

try:
    from openai import OpenAI
except Exception:
    OpenAI = None

MCP_URL = os.getenv("MCP_URL", "http://mcp:8787").strip()
DOC_ROOT = Path(os.getenv("PII_WORKER_DOC_ROOT", "/data/leadai")).resolve()
FILE_EXTS = {
    ext.strip().lower()
    for ext in os.getenv("PII_WORKER_FILE_EXTS", ".txt,.md,.csv").split(",")
    if ext.strip()
}
MAX_FILE_BYTES = int(os.getenv("PII_WORKER_MAX_FILE_BYTES", "300000"))
MAX_CHUNK_CHARS = int(os.getenv("PII_WORKER_MAX_CHARS", "1200"))
MAX_FILES_PER_RUN = int(os.getenv("PII_WORKER_MAX_FILES_PER_RUN", "50"))
INTERVAL_SECONDS = int(os.getenv("PII_WORKER_INTERVAL_SECONDS", "300"))
EVENT_TYPE = os.getenv("PII_WORKER_EVENT_TYPE", "pii.detected").strip()
PROJECT_SLUG = os.getenv("PII_WORKER_PROJECT_SLUG", "leadai").strip()
SOURCE_SERVICE = os.getenv("PII_WORKER_SOURCE_SERVICE", "pii-regex-worker").strip()

PII_DETECTION = os.getenv("PII_DETECTION", "").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)
PII_MODE = os.getenv("PII_MODE", "basic").strip().lower()
PII_OPENAI_MAX_CHARS = int(os.getenv("PII_OPENAI_MAX_CHARS", "800"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
openai_client = OpenAI(api_key=OPENAI_API_KEY) if (OpenAI and OPENAI_API_KEY) else None
CACHE_PATH = Path(os.getenv("PII_WORKER_CACHE_PATH", "/cache/pii_cache.json"))

PII_TYPES = {
    "email",
    "phone",
    "name",
    "address",
    "dob",
    "passport",
    "gender",
    "credit_card",
    "bank_account",
}


def _luhn_check(number: str) -> bool:
    digits = [int(d) for d in number if d.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    parity = len(digits) % 2
    for i, d in enumerate(digits):
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def detect_pii_regex(text: str) -> List[str]:
    if not text:
        return []
    types: set[str] = set()
    lowered = text.lower()

    if re.search(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", lowered):
        types.add("email")

    if re.search(
        r"\b(?:\+?\d{1,3}[\s\-]?)?(?:\(?\d{2,4}\)?[\s\-]?)?\d{3}[\s\-]?\d{4}\b",
        text,
    ):
        types.add("phone")

    if re.search(r"\b(dob|date of birth|birthdate)\b", lowered) and re.search(
        r"\b(19|20)\d{2}[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b",
        text,
    ):
        types.add("dob")
    if re.search(
        r"\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](19|20)\d{2}\b",
        text,
    ):
        types.add("dob")
    month = (
        r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
        r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|"
        r"nov(?:ember)?|dec(?:ember)?)"
    )
    if re.search(
        rf"\b(0?[1-9]|[12]\d|3[01])\s+{month}\s+(19|20)\d{{2}}\b",
        text,
        re.IGNORECASE,
    ):
        types.add("dob")
    if re.search(
        rf"\b{month}\s+(0?[1-9]|[12]\d|3[01])(?:,)?\s+(19|20)\d{{2}}\b",
        text,
        re.IGNORECASE,
    ):
        types.add("dob")

    if re.search(r"\bpassport\b", lowered) and re.search(
        r"\bpassport(?:\s*(no|number|#|id))?[:\s]*[A-Z0-9]{5,9}\b",
        text,
        re.IGNORECASE,
    ):
        types.add("passport")

    if re.search(r"\b(gender|sex)\b", lowered) and re.search(
        r"\b(male|female|non-binary|nonbinary|other|m|f)\b", lowered
    ):
        types.add("gender")

    if re.search(
        r"\b(full\s+name|name)\b", text, re.IGNORECASE
    ) and re.search(
        r"\b(full\s+name|name)\s*[:\-]?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b",
        text,
        re.IGNORECASE,
    ):
        types.add("name")

    if re.search(r"\baddress\b", lowered) and re.search(
        r"\baddress\s*[:\-]?\s*\d{1,6}\s+\w+.*\b",
        text,
    ):
        types.add("address")
    if re.search(
        r"\b\d{1,6}\s+\w+(?:\s+\w+){0,4}\s+(st|street|ave|avenue|rd|road|blvd|lane|ln|drive|dr)\b",
        lowered,
    ):
        types.add("address")

    for match in re.findall(r"(?:\d[ -]*?){13,19}", text):
        digits = re.sub(r"\D", "", match)
        if _luhn_check(digits):
            types.add("credit_card")
            break

    if re.search(r"\b(iban|account|acct)\b", lowered) and re.search(
        r"\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b", text
    ):
        types.add("bank_account")
    if re.search(
        r"\b(account|acct)\s*(number|no|#)\s*[:\-]?\s*\d{6,20}\b", lowered
    ):
        types.add("bank_account")

    return sorted(types)


def detect_pii_openai(text: str) -> List[str]:
    if not openai_client or PII_MODE != "full":
        return []
    snippet = text[:PII_OPENAI_MAX_CHARS]
    prompt = (
        "Identify which of these PII types appear in the text. "
        "Return ONLY a JSON array with zero or more of: "
        "email, phone, name, address, dob, passport, gender, credit_card, bank_account.\n"
        f"Text:\n{snippet}"
    )
    try:
        resp = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=80,
        )
        raw = (resp.choices[0].message.content or "").strip()
        data = json.loads(raw)
        if isinstance(data, list):
            return sorted({t for t in data if isinstance(t, str) and t in PII_TYPES})
    except Exception:
        return []
    return []


def detect_pii(text: str) -> List[str]:
    if not PII_DETECTION:
        return []
    regex_types = detect_pii_regex(text)
    openai_types = detect_pii_openai(text)
    return sorted({*regex_types, *openai_types})


def pii_severity(types: List[str]) -> str:
    if not types:
        return "low"
    high = {"passport", "credit_card", "bank_account", "dob"}
    medium = {"address"}
    if any(t in high for t in types):
        return "high"
    if any(t in medium for t in types):
        return "medium"
    return "low"


def read_text_file(path: Path) -> str:
    raw = path.read_bytes()
    if len(raw) > MAX_FILE_BYTES:
        raw = raw[:MAX_FILE_BYTES]
    try:
        return raw.decode("utf-8")
    except Exception:
        return raw.decode("latin-1", errors="ignore")


def iter_files() -> List[Path]:
    if not DOC_ROOT.exists():
        return []
    files: List[Path] = []
    for path in DOC_ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in FILE_EXTS:
            continue
        try:
            resolved = path.resolve()
            if DOC_ROOT not in resolved.parents and resolved != DOC_ROOT:
                continue
        except Exception:
            continue
        files.append(path)
    return files[:MAX_FILES_PER_RUN]


def load_cache() -> Dict[str, str]:
    try:
        raw = CACHE_PATH.read_text()
        data = json.loads(raw)
        if isinstance(data, dict):
            return {str(k): str(v) for k, v in data.items()}
    except Exception:
        pass
    return {}


def save_cache(cache: Dict[str, str]) -> None:
    try:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(json.dumps(cache))
    except Exception:
        return


def emit_audit_event(payload: Dict[str, Any]) -> None:
    try:
        with httpx.Client(timeout=5) as client:
            client.post(f"{MCP_URL}/tools/audit.event", json=payload)
    except Exception:
        return


def scan_once(cache: Dict[str, str]) -> None:
    for path in iter_files():
        content = read_text_file(path)[:MAX_CHUNK_CHARS]
        types = detect_pii(content)
        if not types:
            continue
        key = str(path)
        try:
            key = str(path.relative_to(DOC_ROOT))
        except Exception:
            pass
        digest = hashlib.sha256(
            (content + "|" + ",".join(types)).encode("utf-8", errors="ignore")
        ).hexdigest()
        if cache.get(key) == digest:
            continue
        rel_path = str(path)
        try:
            rel_path = str(path.relative_to(DOC_ROOT))
        except Exception:
            pass
        payload = {
            "event_type": EVENT_TYPE,
            "actor": "system",
            "actor_type": "service",
            "source_service": SOURCE_SERVICE,
            "object_type": "file",
            "object_id": rel_path,
            "project_slug": PROJECT_SLUG or None,
            "details": {
                "pii_types": types,
                "pii_severity": pii_severity(types),
                "path": rel_path,
            },
        }
        emit_audit_event(payload)
        cache[key] = digest


def main() -> None:
    cache = load_cache()
    while True:
        scan_once(cache)
        save_cache(cache)
        time.sleep(max(30, INTERVAL_SECONDS))


if __name__ == "__main__":
    main()
