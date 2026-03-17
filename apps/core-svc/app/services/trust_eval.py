from __future__ import annotations

from functools import lru_cache
import os
from typing import Any, Dict, Optional

import httpx

from app.services.provenance_rules import evaluate_provenance, load_rules_config


class TrustEvalError(RuntimeError):
    """Raised when remote trust evaluation fails or is misconfigured."""


@lru_cache
def _trust_eval_mode() -> str:
    return os.getenv("TRUST_EVAL_MODE", "local").strip().lower()


@lru_cache
def _trust_eval_fallback() -> str:
    return os.getenv("TRUST_EVAL_FALLBACK", "local").strip().lower()


@lru_cache
def _trust_mcp_url() -> Optional[str]:
    value = os.getenv("TRUST_MCP_URL", "").strip()
    return value or None


@lru_cache
def _trust_mcp_tool() -> str:
    return os.getenv("TRUST_MCP_TOOL", "trust.evaluate").strip()


@lru_cache
def _trust_mcp_timeout() -> float:
    raw = os.getenv("TRUST_MCP_TIMEOUT", "10")
    try:
        return float(raw)
    except ValueError as exc:
        raise TrustEvalError(f"Invalid TRUST_MCP_TIMEOUT value: {raw}") from exc


def _build_mcp_endpoint() -> str:
    base = _trust_mcp_url()
    if not base:
        raise TrustEvalError("TRUST_MCP_URL is not set for MCP evaluation.")
    tool = _trust_mcp_tool()
    return f"{base.rstrip('/')}/tools/{tool}"


async def _evaluate_via_mcp(
    manifest_facts: Dict[str, Any],
    include_debug: bool,
) -> Dict[str, Any]:
    endpoint = _build_mcp_endpoint()
    params = {"debug": "true"} if include_debug else None
    payload = {"manifest_facts": manifest_facts}
    try:
        async with httpx.AsyncClient(timeout=_trust_mcp_timeout()) as client:
            resp = await client.post(endpoint, params=params, json=payload)
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, dict):
                raise TrustEvalError("MCP response payload was not an object.")
            return data
    except httpx.HTTPError as exc:
        raise TrustEvalError(f"MCP trust evaluation failed: {exc}") from exc


async def evaluate_provenance_hybrid(
    manifest_facts: Dict[str, Any],
    include_debug: bool = False,
    rules: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Evaluate provenance using local rules or an MCP-backed service.

    Modes:
    - local: evaluate in-process using YAML rules (default).
    - mcp: call MCP tool endpoint and return its evaluation.
    """
    mode = _trust_eval_mode()
    if mode == "mcp":
        try:
            return await _evaluate_via_mcp(manifest_facts, include_debug)
        except TrustEvalError:
            if _trust_eval_fallback() == "local":
                return evaluate_provenance(
                    manifest_facts,
                    include_debug=include_debug,
                    rules=rules or load_rules_config(),
                )
            raise

    return evaluate_provenance(
        manifest_facts,
        include_debug=include_debug,
        rules=rules or load_rules_config(),
    )
