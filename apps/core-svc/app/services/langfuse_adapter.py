"""Langfuse adapter (stub).

This module provides a minimal integration point for pulling telemetry from Langfuse.
It is intentionally conservative: if credentials are not configured, it returns no data.
"""
from __future__ import annotations

import json
import os
import urllib.request
import urllib.error
from dataclasses import dataclass
from typing import Any

from langfuse import Langfuse


def _usage_to_dict(value: Any) -> dict:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        try:
            return value.model_dump()
        except Exception:
            return {}
    if hasattr(value, "dict"):
        try:
            return value.dict()
        except Exception:
            return {}
    return {}


def _extract_tokens(usage: dict) -> tuple[int, int, int]:
    total = usage.get("total_tokens")
    if total is None:
        total = usage.get("total") or usage.get("tokens")
    prompt = usage.get("prompt_tokens")
    if prompt is None:
        prompt = usage.get("input") or usage.get("input_tokens")
    completion = usage.get("completion_tokens")
    if completion is None:
        completion = usage.get("output") or usage.get("output_tokens")
    if total is None and prompt is not None and completion is not None:
        total = prompt + completion
    return int(total or 0), int(prompt or 0), int(completion or 0)


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    values_sorted = sorted(values)
    if percentile <= 0:
        return values_sorted[0]
    if percentile >= 100:
        return values_sorted[-1]
    k = (len(values_sorted) - 1) * (percentile / 100)
    f = int(k)
    c = min(f + 1, len(values_sorted) - 1)
    if f == c:
        return values_sorted[f]
    return values_sorted[f] + (values_sorted[c] - values_sorted[f]) * (k - f)


@dataclass
class LangfuseMetric:
    metric_key: str
    metric_value: Any
    source: str = "langfuse"


class LangfuseAdapter:
    def __init__(
        self,
        base_url: str | None = None,
        public_key: str | None = None,
        secret_key: str | None = None,
    ) -> None:
        self.base_url = (base_url or os.getenv("LANGFUSE_BASE_URL", "")).rstrip("/")
        self.public_key = public_key or os.getenv("LANGFUSE_PUBLIC_KEY", "")
        self.secret_key = secret_key or os.getenv("LANGFUSE_SECRET_KEY", "")

    def is_configured(self) -> bool:
        return bool(self.base_url and self.public_key and self.secret_key)

    def check_connection(self) -> tuple[bool, str]:
        if not self.base_url:
            return False, "Langfuse base URL not set"
        try:
            with urllib.request.urlopen(self.base_url, timeout=5) as resp:
                return True, f"HTTP {resp.status}"
        except urllib.error.HTTPError as exc:
            # Any HTTP response means the service is reachable.
            return True, f"HTTP {exc.code}"
        except Exception as exc:
            return False, str(exc)

    def fetch_project_metrics(self, project_id: str) -> list[LangfuseMetric]:
        """Fetch basic metrics from Langfuse (latency + token usage)."""
        if not project_id or not self.is_configured():
            return []
        try:
            client = Langfuse(
                public_key=self.public_key,
                secret_key=self.secret_key,
                base_url=self.base_url,
            )
            observations = client.api.observations.get_many(
                type="generation",
                limit=200,
            )
            rows = observations.data if observations else []
            if not rows:
                return []

            latencies: list[float] = []
            total_tokens = 0
            input_tokens = 0
            output_tokens = 0
            for obs in rows:
                if obs.start_time and obs.end_time:
                    delta = obs.end_time - obs.start_time
                    latencies.append(delta.total_seconds() * 1000)
                usage_dict = _usage_to_dict(getattr(obs, "usage", None))
                total, prompt, completion = _extract_tokens(usage_dict)
                total_tokens += total
                input_tokens += prompt
                output_tokens += completion

            metrics: list[LangfuseMetric] = []
            if latencies:
                avg_latency = sum(latencies) / len(latencies)
                p95_latency = _percentile(latencies, 95)
                metrics.append(LangfuseMetric("latency_avg_ms", round(avg_latency, 2)))
                metrics.append(LangfuseMetric("latency_p95_ms", round(p95_latency, 2)))
            metrics.append(LangfuseMetric("requests_count", len(rows)))
            metrics.append(LangfuseMetric("tokens_total", total_tokens))
            metrics.append(LangfuseMetric("tokens_input", input_tokens))
            metrics.append(LangfuseMetric("tokens_output", output_tokens))
            return metrics
        except Exception:
            return []

    def fetch_project_metadata(self, project_id: str) -> dict[str, Any]:
        """Extract model provider/version from trace metadata if present."""
        if not project_id or not self.is_configured():
            return {}
        try:
            client = Langfuse(
                public_key=self.public_key,
                secret_key=self.secret_key,
                base_url=self.base_url,
            )
            observations = client.api.observations.get_many(
                type="generation",
                limit=200,
            )
            rows = observations.data if observations else []
            for obs in rows:
                metadata = getattr(obs, "metadata", None)
                provider = None
                version = None
                if isinstance(metadata, dict):
                    provider = metadata.get("model_provider") or metadata.get("provider")
                    version = metadata.get("model_version") or metadata.get("version")
                if (not provider or not version) and hasattr(obs, "trace_id"):
                    trace_id = getattr(obs, "trace_id", None)
                    if trace_id and hasattr(client.api, "traces") and hasattr(client.api.traces, "get"):
                        try:
                            trace = client.api.traces.get(trace_id)
                            trace_meta = getattr(trace, "metadata", None)
                            if isinstance(trace_meta, dict):
                                provider = provider or trace_meta.get("model_provider")
                                version = version or trace_meta.get("model_version")
                        except Exception:
                            pass
                if provider or version:
                    return {"model_provider": provider, "model_version": version}
            return {}
        except Exception:
            return {}

    def fetch_prompt_versions(self, prompt_name: str, limit: int = 5) -> dict[str, Any] | None:
        if not prompt_name or not self.is_configured():
            return None

        try:
            client = Langfuse(
                public_key=self.public_key,
                secret_key=self.secret_key,
                base_url=self.base_url,
            )
            meta_response = client.api.prompts.list(name=prompt_name, limit=1)
            prompt_meta = meta_response.data[0] if meta_response and meta_response.data else None
            if not prompt_meta:
                return None

            versions = list(prompt_meta.versions or [])
            versions_sorted = sorted(versions, reverse=True)[: max(1, limit)]
            version_items: list[dict[str, Any]] = []
            for version in versions_sorted:
                try:
                    prompt_obj = client.api.prompts.get(prompt_name, version=version)
                    prompt_value = prompt_obj.prompt
                    if not isinstance(prompt_value, str):
                        prompt_value = json.dumps(prompt_value)
                    version_items.append(
                        {
                            "version": prompt_obj.version,
                            "labels": prompt_obj.labels,
                            "commit_message": prompt_obj.commit_message,
                            "type": prompt_obj.type,
                            "prompt": prompt_value,
                        }
                    )
                except Exception:
                    version_items.append({"version": version})

            return {
                "name": prompt_meta.name,
                "type": prompt_meta.type,
                "labels": prompt_meta.labels,
                "tags": prompt_meta.tags,
                "last_updated_at": prompt_meta.last_updated_at.isoformat()
                if prompt_meta.last_updated_at
                else None,
                "versions": version_items,
            }
        except Exception:
            return None
