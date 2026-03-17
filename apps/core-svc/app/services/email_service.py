from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from typing import Optional
from urllib.parse import urlparse
from sqlalchemy import text

from app.db import engine


class EmailConfigError(Exception):
    pass


def _get_email_settings_key() -> str:
    return (os.getenv("SMTP_SETTINGS_ENCRYPTION_KEY") or "").strip()


def _get_db_email_settings() -> tuple[Optional[str], Optional[str]]:
    key = _get_email_settings_key()
    if not key:
        return None, None

    try:
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT pgp_sym_decrypt(smtp_url_enc, :key)::text AS smtp_url,
                           email_from
                    FROM system_email_settings
                    WHERE singleton = true
                    LIMIT 1
                    """
                ),
                {"key": key},
            ).fetchone()
    except Exception:
        return None, None

    if not row:
        return None, None
    return (row[0] if row[0] else None, row[1] if row[1] else None)


def _get_email_server_url() -> str:
    db_server, _ = _get_db_email_settings()
    return (db_server or os.getenv("EMAIL_SERVER") or "").strip()


def _get_email_from() -> str:
    _, db_from = _get_db_email_settings()
    return (db_from or os.getenv("EMAIL_FROM") or "LeadAI <no-reply@localhost>").strip()


def _parse_smtp_url(url: str) -> tuple[str, int, Optional[str], Optional[str], bool]:
    parsed = urlparse(url)
    if parsed.scheme not in ("smtp", "smtps"):
        raise EmailConfigError("EMAIL_SERVER must start with smtp:// or smtps://")
    host = parsed.hostname
    if not host:
        raise EmailConfigError("EMAIL_SERVER host is missing")
    port = parsed.port or (465 if parsed.scheme == "smtps" else 587)
    username = parsed.username
    password = parsed.password
    use_ssl = parsed.scheme == "smtps"
    return host, port, username, password, use_ssl


def send_email(to_email: str, subject: str, body: str) -> None:
    url = _get_email_server_url()
    if not url:
        raise EmailConfigError("EMAIL_SERVER is not configured")

    send_email_with_config(
        to_email,
        subject,
        body,
        server_url=url,
        from_address=_get_email_from(),
    )


def send_email_with_config(
    to_email: str,
    subject: str,
    body: str,
    *,
    server_url: str,
    from_address: str,
) -> None:
    if not server_url:
        raise EmailConfigError("EMAIL_SERVER is not configured")

    host, port, username, password, use_ssl = _parse_smtp_url(server_url)
    msg = EmailMessage()
    msg["From"] = from_address
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    if use_ssl:
        server = smtplib.SMTP_SSL(host, port, timeout=15)
    else:
        server = smtplib.SMTP(host, port, timeout=15)

    try:
        if not use_ssl:
            server.starttls()
        if username:
            server.login(username, password or "")
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except Exception:
            pass


def get_effective_email_config() -> dict:
    url = _get_email_server_url()
    if not url:
        raise EmailConfigError("EMAIL_SERVER is not configured")
    host, port, username, _password, use_ssl = _parse_smtp_url(url)
    from_addr = _get_email_from()
    return {
        "email_server": url,
        "email_from": from_addr,
        "smtp_host": host,
        "smtp_port": port,
        "smtp_username": username,
        "use_ssl": use_ssl,
    }


def send_control_assignment_email(
    to_email: str,
    *,
    recipient_name: str,
    designated_owner_name: str | None,
    entity_slug: str,
    project_slug: str,
    kpi_key: str,
    kpi_name: str | None,
    control_name: str | None,
    owner_role: str | None,
    target_text: str | None,
    evidence_source: str | None,
    due_date: str | None,
    comment_text: str | None = None,
    evidence_url: str,
) -> None:
    subject = f"LeadAI Task Assigned: {kpi_name or kpi_key}"
    lines = [
        f"Hello {recipient_name},",
        "",
        "You have a new control task assigned in LeadAI.",
        "",
        f"Entity: {entity_slug}",
        f"Project: {project_slug}",
        f"KPI: {kpi_name or '—'} ({kpi_key})",
        f"Control: {control_name or '—'}",
        f"Designated Owner: {designated_owner_name or '—'}",
        f"Owner Role: {owner_role or '—'}",
        f"Evidence Source: {evidence_source or '—'}",
        f"Target: {target_text or '—'}",
        f"Due Date: {due_date or '—'}",
    ]
    if comment_text:
        lines.extend(["", f"Comment: {comment_text}"])
    lines.extend(
        [
            "",
            f"Evidence capture: {evidence_url}",
            "",
            "If you have any questions, please contact your governance team.",
        ]
    )
    body = "\n".join(lines)
    send_email(to_email, subject, body)


def send_control_reminder_email(
    to_email: str,
    *,
    recipient_name: str,
    kpi_name: str | None,
    control_name: str | None,
    due_date: str,
    reminder_number: int,
    reminder_count: int,
    project_slug: str,
    entity_slug: str,
    days_until_due: int,
) -> None:
    subject = f"LeadAI Control Reminder ({reminder_number}/{reminder_count}): {kpi_name or control_name or 'Control'}"
    lines = [
        f"Hello {recipient_name},",
        "",
        f"This is reminder {reminder_number} of {reminder_count} for the following control.",
        "",
        f"Entity: {entity_slug}",
        f"Project: {project_slug}",
        f"KPI: {kpi_name or '—'}",
        f"Control: {control_name or '—'}",
        f"Due Date: {due_date}",
        f"Days until due: {days_until_due}",
        "",
        "Please submit evidence or complete the control to stop further reminders for this cycle.",
        "",
        "If you have any questions, please contact your governance team.",
    ]
    body = "\n".join(lines)
    send_email(to_email, subject, body)


def send_policy_review_email(
    to_email: str,
    *,
    policy_title: str,
    entity_name: Optional[str],
    due_at: Optional[str],
    policy_url: Optional[str] = None,
) -> None:
    subject = f"Policy review due: {policy_title}"
    lines = [
        "Hello,",
        "",
        "A policy review reminder is due in LeadAI.",
        "",
        f"Policy: {policy_title}",
        f"Entity: {entity_name or '—'}",
        f"Due: {due_at or '—'}",
    ]
    if policy_url:
        lines.extend(["", f"Manage policy execution: {policy_url}"])
    lines.extend(["", "If you have any questions, please contact your governance team."])
    body = "\n".join(lines)
    send_email(to_email, subject, body)
