import os
import hashlib
from typing import Dict, Tuple, AsyncIterable, Optional, List
from urllib.parse import urlparse, urlunparse
import boto3

_BUCKET = os.getenv("AWS_S3_BUCKET") or os.getenv("S3_BUCKET", "evidence")
_ENDPOINT = os.getenv("AWS_S3_ENDPOINT_URL") or os.getenv("S3_ENDPOINT")
_REGION = os.getenv("AWS_S3_REGION") or os.getenv("S3_REGION", "us-east-1")
_PUBLIC_ENDPOINT = os.getenv("AWS_S3_PUBLIC_ENDPOINT_URL") or os.getenv("S3_PUBLIC_ENDPOINT")

_session = boto3.session.Session(
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("S3_ACCESS_KEY"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY") or os.getenv("S3_SECRET_KEY"),
    region_name=_REGION,
)

_config = boto3.session.Config(
    signature_version="s3v4",
    s3={"addressing_style": "path"},
)

_s3 = _session.client(
    "s3",
    endpoint_url=_ENDPOINT,
    config=_config,
)

_s3_public = None
if _PUBLIC_ENDPOINT:
    _s3_public = _session.client(
        "s3",
        endpoint_url=_PUBLIC_ENDPOINT,
        config=_config,
    )

def _rewrite_public(url: str) -> str:
    if not _PUBLIC_ENDPOINT:
        return url
    try:
        public = urlparse(_PUBLIC_ENDPOINT)
        if not public.scheme or not public.netloc:
            return url
        parsed = urlparse(url)
        pub_path = public.path.rstrip("/")
        path = parsed.path
        if pub_path:
            path = f"{pub_path}{parsed.path}"
        return urlunparse(
            (
                public.scheme,
                public.netloc,
                path,
                parsed.params,
                parsed.query,
                parsed.fragment,
            )
        )
    except Exception:
        return url

def _presign_client():
    return _s3_public or _s3


def presign_put(object_key: str, content_type: str, expires_seconds: int = 900) -> Tuple[str, Dict[str, str]]:
    url = _presign_client().generate_presigned_url(
        "put_object",
        Params={"Bucket": _BUCKET, "Key": object_key, "ContentType": content_type},
        ExpiresIn=expires_seconds,
        HttpMethod="PUT",
    )
    headers = {"Content-Type": content_type}
    return url, headers

def presign_get(object_key: str, expires_seconds: int = 300) -> str:
    url = _presign_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": _BUCKET, "Key": object_key},
        ExpiresIn=expires_seconds,
        HttpMethod="GET",
    )
    return url


def delete_object(object_key: str) -> None:
    _s3.delete_object(Bucket=_BUCKET, Key=object_key)

def object_uri(object_key: str) -> str:
    return f"s3://{_BUCKET}/{object_key}"

def get_object_stream(bucket: str, object_key: str):
    response = _s3.get_object(Bucket=bucket, Key=object_key)
    return response["Body"]


def get_object(object_key: str, bucket: Optional[str] = None):
    return _s3.get_object(Bucket=bucket or _BUCKET, Key=object_key)

def s3_ready() -> bool:
    try:
        _s3.head_bucket(Bucket=_BUCKET)
        return True
    except Exception:
        return False


async def upload_stream_to_s3(
    object_key: str,
    stream: AsyncIterable[bytes],
    content_type: Optional[str] = None,
    part_size: int = 5 * 1024 * 1024,
) -> Tuple[int, str]:
    """
    Stream bytes into S3 using multipart upload (no local disk).
    Returns (size_bytes, sha256_hex).
    """
    hasher = hashlib.sha256()
    size = 0
    buffer = bytearray()
    parts: List[Dict[str, object]] = []
    upload_id = None
    part_number = 1

    def _start_multipart() -> str:
        params = {"Bucket": _BUCKET, "Key": object_key}
        if content_type:
            params["ContentType"] = content_type
        resp = _s3.create_multipart_upload(**params)
        return resp["UploadId"]

    def _upload_part(body: bytes, number: int) -> str:
        resp = _s3.upload_part(
            Bucket=_BUCKET,
            Key=object_key,
            PartNumber=number,
            UploadId=upload_id,
            Body=body,
        )
        return resp["ETag"]

    async for chunk in stream:
        if not chunk:
            continue
        buffer.extend(chunk)
        hasher.update(chunk)
        size += len(chunk)

        if len(buffer) >= part_size:
            if upload_id is None:
                upload_id = _start_multipart()
            etag = _upload_part(bytes(buffer), part_number)
            parts.append({"ETag": etag, "PartNumber": part_number})
            part_number += 1
            buffer.clear()

    if upload_id is None:
        params = {"Bucket": _BUCKET, "Key": object_key, "Body": bytes(buffer)}
        if content_type:
            params["ContentType"] = content_type
        _s3.put_object(**params)
    else:
        if buffer:
            etag = _upload_part(bytes(buffer), part_number)
            parts.append({"ETag": etag, "PartNumber": part_number})
        _s3.complete_multipart_upload(
            Bucket=_BUCKET,
            Key=object_key,
            UploadId=upload_id,
            MultipartUpload={"Parts": parts},
        )

    return size, hasher.hexdigest()
