import os
from typing import Dict, Tuple
import boto3

_BUCKET = os.getenv("AWS_S3_BUCKET", "evidence")
_ENDPOINT = os.getenv("AWS_S3_ENDPOINT_URL")
_REGION = os.getenv("AWS_S3_REGION", "us-east-1")

_session = boto3.session.Session(
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=_REGION,
)

_s3 = _session.client(
    "s3",
    endpoint_url=_ENDPOINT,
    config=boto3.session.Config(signature_version="s3v4"),
)

def presign_put(object_key: str, content_type: str, expires_seconds: int = 900) -> Tuple[str, Dict[str, str]]:
    url = _s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": _BUCKET, "Key": object_key, "ContentType": content_type},
        ExpiresIn=expires_seconds,
        HttpMethod="PUT",
    )
    headers = {"Content-Type": content_type}
    return url, headers

def presign_get(object_key: str, expires_seconds: int = 300) -> str:
    return _s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": _BUCKET, "Key": object_key},
        ExpiresIn=expires_seconds,
        HttpMethod="GET",
    )

def object_uri(object_key: str) -> str:
    return f"s3://{_BUCKET}/{object_key}"
