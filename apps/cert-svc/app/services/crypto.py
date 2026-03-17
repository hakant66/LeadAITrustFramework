from __future__ import annotations

import base64
import json
from typing import Dict

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature, decode_dss_signature
from cryptography.exceptions import InvalidSignature

from app.settings import settings


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value + padding)


def canonical_json(payload: Dict) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def load_private_key() -> ec.EllipticCurvePrivateKey:
    if not settings.trustmark_private_key:
        raise RuntimeError("TRUSTMARK_PRIVATE_KEY is not set")
    key = serialization.load_pem_private_key(
        settings.trustmark_private_key.encode("utf-8"),
        password=None,
    )
    if not isinstance(key, ec.EllipticCurvePrivateKey):
        raise RuntimeError("TRUSTMARK_PRIVATE_KEY is not an EC private key")
    return key


def load_public_key() -> ec.EllipticCurvePublicKey:
    if not settings.trustmark_public_key:
        raise RuntimeError("TRUSTMARK_PUBLIC_KEY is not set")
    key = serialization.load_pem_public_key(settings.trustmark_public_key.encode("utf-8"))
    if not isinstance(key, ec.EllipticCurvePublicKey):
        raise RuntimeError("TRUSTMARK_PUBLIC_KEY is not an EC public key")
    return key


def sign_payload(payload: Dict) -> str:
    key = load_private_key()
    data = canonical_json(payload)
    signature = key.sign(data, ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(signature)
    raw = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    return _b64url(raw)


def verify_signature(payload: Dict, signature_b64: str, public_key_pem: str | None = None) -> bool:
    try:
        data = canonical_json(payload)
        raw = _b64url_decode(signature_b64)
        if len(raw) != 64:
            return False
        r = int.from_bytes(raw[:32], "big")
        s = int.from_bytes(raw[32:], "big")
        der = encode_dss_signature(r, s)
        key = load_public_key() if not public_key_pem else serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
        if not isinstance(key, ec.EllipticCurvePublicKey):
            return False
        key.verify(der, data, ec.ECDSA(hashes.SHA256()))
        return True
    except (InvalidSignature, ValueError, TypeError):
        return False
