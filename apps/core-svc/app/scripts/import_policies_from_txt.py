#!/usr/bin/env python3
import argparse
import os
from pathlib import Path
from uuid import uuid4

import psycopg


def db_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url.replace("+psycopg", "")
    return (
        f"postgresql://{os.getenv('PGUSER','leadai')}:{os.getenv('PGPASSWORD','leadai')}@"
        f"{os.getenv('PGHOST','localhost')}:{os.getenv('PGPORT','5432')}/{os.getenv('PGDATABASE','leadai')}"
    )


def normalize_title(filename: str) -> str:
    title = filename
    if title.endswith(".txt"):
        title = title[:-4]
    if title.endswith(".odt"):
        title = title[:-4]
    if title.endswith(".docx"):
        title = title[:-5]
    return title.replace("_", " ").strip()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import AI policy .txt files into policies + policy_versions"
    )
    parser.add_argument(
        "--dir",
        default=os.getenv("POLICY_IMPORT_DIR", "/app/policy-import"),
        help="Directory containing .txt policy files",
    )
    parser.add_argument("--owner", default="CAIO", help="Owner role for policies")
    parser.add_argument("--status", default="draft", help="Default policy status")
    parser.add_argument(
        "--version-label", default="v1", help="Version label for inserted policy versions"
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--update-existing",
        action="store_true",
        help="If policy exists, update owner/status and insert a new version",
    )
    args = parser.parse_args()

    policy_dir = Path(args.dir)
    if not policy_dir.exists() or not policy_dir.is_dir():
        raise SystemExit(f"Policy directory not found: {policy_dir}")

    files = sorted(policy_dir.glob("*.txt"))
    if not files:
        raise SystemExit(f"No .txt files found in {policy_dir}")

    inserted = 0
    skipped = 0
    updated = 0

    with psycopg.connect(db_url()) as conn:
        with conn.cursor() as cur:
            for path in files:
                title = normalize_title(path.name)
                content = path.read_text(encoding="utf-8", errors="replace").strip()
                if not content:
                    print(f"skip: empty file {path.name}")
                    skipped += 1
                    continue

                cur.execute("SELECT id FROM policies WHERE title=%s", (title,))
                row = cur.fetchone()
                if row:
                    policy_id = row[0]
                    if not args.update_existing:
                        print(f"skip: policy exists {title}")
                        skipped += 1
                        continue
                    if args.dry_run:
                        print(f"would update policy {title} and add version")
                        updated += 1
                        continue

                    cur.execute(
                        """
                        UPDATE policies
                        SET owner_role=%s, status=%s, updated_at=NOW()
                        WHERE id=%s
                        """,
                        (args.owner, args.status, policy_id),
                    )
                    version_id = str(uuid4())
                    cur.execute(
                        """
                        INSERT INTO policy_versions (
                          id, policy_id, version_label, content, status, created_at
                        )
                        VALUES (%s,%s,%s,%s,'draft',NOW())
                        """,
                        (version_id, policy_id, args.version_label, content),
                    )
                    updated += 1
                    print(f"updated: {title}")
                    continue

                if args.dry_run:
                    print(f"would insert policy {title}")
                    inserted += 1
                    continue

                policy_id = str(uuid4())
                version_id = str(uuid4())
                cur.execute(
                    """
                    INSERT INTO policies (id, title, owner_role, status, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,NOW(),NOW())
                    """,
                    (policy_id, title, args.owner, args.status),
                )
                cur.execute(
                    """
                    INSERT INTO policy_versions (
                      id, policy_id, version_label, content, status, created_at
                    )
                    VALUES (%s,%s,%s,%s,'draft',NOW())
                    """,
                    (version_id, policy_id, args.version_label, content),
                )
                inserted += 1
                print(f"inserted: {title}")

        if not args.dry_run:
            conn.commit()

    print(f"Done. inserted={inserted} updated={updated} skipped={skipped}")


if __name__ == "__main__":
    main()
