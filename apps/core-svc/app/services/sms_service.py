from __future__ import annotations

import os
from typing import Optional

import httpx


class SMSConfigError(Exception):
    pass


def _get_sms_provider() -> str:
    return (os.getenv("SMS_PROVIDER") or "").strip().lower()


def _get_twilio_config() -> tuple[str, str, str]:
    account_sid = (os.getenv("SMS_TWILIO_ACCOUNT_SID") or "").strip()
    auth_token = (os.getenv("SMS_TWILIO_AUTH_TOKEN") or "").strip()
    from_number = (os.getenv("SMS_TWILIO_FROM") or "").strip()
    if not account_sid or not auth_token or not from_number:
        raise SMSConfigError("SMS_TWILIO_ACCOUNT_SID, SMS_TWILIO_AUTH_TOKEN, SMS_TWILIO_FROM are required")
    return account_sid, auth_token, from_number


def send_sms(to_number: str, body: str) -> None:
    provider = _get_sms_provider()
    if not provider:
        raise SMSConfigError("SMS_PROVIDER is not configured")
    if provider != "twilio":
        raise SMSConfigError(f"Unsupported SMS_PROVIDER: {provider}")

    account_sid, auth_token, from_number = _get_twilio_config()
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    payload = {"From": from_number, "To": to_number, "Body": body}

    with httpx.Client(timeout=15.0) as client:
        response = client.post(url, data=payload, auth=(account_sid, auth_token))
        if response.status_code >= 400:
            raise SMSConfigError(f"Twilio SMS failed: {response.status_code}")


def send_policy_review_sms(
    to_number: str,
    *,
    policy_title: str,
    entity_name: Optional[str],
    due_at: Optional[str],
    policy_url: Optional[str] = None,
) -> None:
    subject_line = f"Policy review due: {policy_title}"
    lines = [subject_line]
    if entity_name:
        lines.append(f"Entity: {entity_name}")
    if due_at:
        lines.append(f"Due: {due_at}")
    if policy_url:
        lines.append(f"Link: {policy_url}")
    body = " | ".join(lines)
    send_sms(to_number, body)
