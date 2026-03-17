#!/usr/bin/env python3
import argparse
import hashlib
import os
from pathlib import Path
from urllib.parse import urlparse

import boto3
import psycopg


def db_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url.replace("+psycopg", "")
    return f"postgresql://{os.getenv('PGUSER','leadai')}:{os.getenv('PGPASSWORD','leadai')}@{os.getenv('PGHOST','localhost')}:{os.getenv('PGPORT','5432')}/{os.getenv('PGDATABASE','leadai')}"


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("AWS_S3_ENDPOINT_URL") or os.getenv("S3_ENDPOINT"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("S3_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY") or os.getenv("S3_SECRET_KEY"),
        region_name=os.getenv("AWS_S3_REGION") or os.getenv("S3_REGION", "us-east-1"),
    )


def file_uri_to_path(uri: str) -> Path:
    parsed = urlparse(uri)
    if parsed.scheme != "file":
        raise ValueError("Not a file:// URI")
    # urlparse gives path with leading slash
    return Path(parsed.path)


def build_key(project_slug: str, control_id: str, filename: str) -> str:
    return f"evidence/{project_slug}/{control_id}/{filename}"


def sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migrate file:// evidence records to s3:// (MinIO)"
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--delete-local", action="store_true")
    parser.add_argument(
        "--delete-missing",
        action="store_true",
        help="Delete evidence records whose file:// path is missing",
    )
    args = parser.parse_args()

    bucket = os.getenv("AWS_S3_BUCKET") or os.getenv("S3_BUCKET", "evidence")
    if not bucket:
        raise SystemExit("S3 bucket not configured")

    client = s3_client()

    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, project_slug, control_id::text, name, uri, sha256, size_bytes, mime
                FROM evidence
                WHERE uri LIKE 'file://%'
                ORDER BY id
                """
            )
            rows = cur.fetchall()

    total = 0
    migrated = 0
    for row in rows:
        total += 1
        evidence_id, project_slug, control_id, name, uri, sha_existing, size_existing, mime = row
        try:
            path = file_uri_to_path(uri)
        except Exception:
            print(f"[{evidence_id}] skip: invalid uri {uri}")
            continue
        if not path.exists():
            print(f"[{evidence_id}] skip: missing file {path}")
            if args.delete_missing and not args.dry_run:
                with psycopg.connect(db_url()) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "DELETE FROM evidence_audit WHERE evidence_id=%s",
                            (evidence_id,),
                        )
                        cur.execute(
                            "DELETE FROM evidence WHERE id=%s",
                            (evidence_id,),
                        )
                        conn.commit()
                print(f"[{evidence_id}] deleted missing evidence record")
            continue

        filename = path.name
        key = build_key(project_slug, control_id, filename)
        s3_uri = f"s3://{bucket}/{key}"
        size_bytes = path.stat().st_size
        sha_hex = sha256_file(path)

        if args.dry_run:
            print(f"[{evidence_id}] would upload {path} -> {s3_uri}")
            continue

        print(f"[{evidence_id}] uploading {path} -> {s3_uri}")
        client.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": mime or "application/octet-stream"})

        with psycopg.connect(db_url()) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE evidence
                    SET uri=%s, sha256=%s, size_bytes=%s, status='uploaded', updated_at=NOW()
                    WHERE id=%s
                    """,
                    (s3_uri, sha_hex, size_bytes, evidence_id),
                )
                conn.commit()

        migrated += 1

        if args.delete_local:
            try:
                path.unlink(missing_ok=True)
            except Exception as exc:
                print(f"[{evidence_id}] warn: failed to delete {path}: {exc}")

        if args.limit and migrated >= args.limit:
            break

    print(f"Done. {migrated}/{total} migrated")


if __name__ == "__main__":
    main()
