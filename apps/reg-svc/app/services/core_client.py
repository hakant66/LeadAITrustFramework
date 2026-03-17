from __future__ import annotations

from typing import Dict, Optional

import httpx

from app.settings import settings


def fetch_axis_scores(project_slug: str) -> Dict[str, Optional[float]]:
    base = settings.core_svc_url.rstrip("/")
    url = f"{base}/trust/axes/{project_slug}"
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(url)
    if resp.status_code != 200:
        raise RuntimeError(f"core-svc trust axes failed ({resp.status_code})")
    payload = resp.json()
    axis_scores: Dict[str, Optional[float]] = {}
    for axis in payload.get("axes", []):
        axis_scores[axis.get("axis_key")] = axis.get("score_pct")
    return axis_scores


def emit_audit_event(
    event_type: str,
    actor: str,
    source_service: str,
    object_type: Optional[str] = None,
    object_id: Optional[str] = None,
    project_slug: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    base = settings.core_svc_url.rstrip("/")
    url = f"{base}/audit/events"
    payload = {
        "event_type": event_type,
        "actor": actor,
        "source_service": source_service,
        "object_type": object_type,
        "object_id": object_id,
        "project_slug": project_slug,
        "details": details,
    }
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(url, json=payload)
    except Exception:
        pass
