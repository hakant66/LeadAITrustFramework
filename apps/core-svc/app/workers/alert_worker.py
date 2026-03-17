from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone

from app.services.control_reminders import run_control_reminders
from app.services.data_governance import compute_data_governance_warnings
from app.services.policy_alerts import compute_policy_alerts
from app.services.trend_alerts import compute_trend_alerts


def _enabled(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


async def _run_once() -> None:
    refresh = _enabled(os.getenv("ALERT_WORKER_REFRESH_GOVERNANCE", "true"), True)
    if refresh:
        await compute_data_governance_warnings()
    await compute_policy_alerts()
    if _enabled(os.getenv("ALERT_WORKER_TREND_ALERTS", "true"), True):
        try:
            trend_results = await compute_trend_alerts()
            if trend_results:
                print(
                    f"[alert_worker] trend alerts: {len(trend_results)} evaluated",
                    file=sys.stdout,
                )
        except Exception as exc:
            print(f"[alert_worker] trend alerts failed: {exc}", file=sys.stderr)
    if _enabled(os.getenv("ALERT_WORKER_CONTROL_REMINDERS", "true"), True):
        try:
            result = await run_control_reminders()
            skipped = result.get("skipped")
            if skipped:
                print(f"[alert_worker] control reminders: skipped ({skipped})", file=sys.stdout)
            elif result.get("sent") or result.get("errors"):
                print(
                    f"[alert_worker] control reminders: sent={result.get('sent', 0)}, errors={result.get('errors', 0)}",
                    file=sys.stdout,
                )
        except Exception as exc:
            print(f"[alert_worker] control reminders failed: {exc}", file=sys.stderr)


async def _loop(interval_seconds: int) -> None:
    while True:
        try:
            await _run_once()
            now = datetime.now(timezone.utc).isoformat()
            print(f"[alert_worker] {now} heartbeat", file=sys.stdout)
        except Exception as exc:
            now = datetime.now(timezone.utc).isoformat()
            print(f"[alert_worker] {now} failed: {exc}", file=sys.stderr)
        await asyncio.sleep(interval_seconds)


def main() -> None:
    interval = int(os.getenv("ALERT_WORKER_INTERVAL_SECONDS", "300"))
    interval = max(30, interval)
    run_once = _enabled(os.getenv("ALERT_WORKER_ONCE"), False)
    if run_once:
        asyncio.run(_run_once())
    else:
        asyncio.run(_loop(interval))


if __name__ == "__main__":
    main()
