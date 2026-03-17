#!/usr/bin/env python3
"""Sync Langfuse orgs/projects from LeadAI entities/projects.

Idempotent:
- Creates organization if missing (name = entity.slug).
- Creates project if missing (name = project.slug).
- Writes CSV mapping {entity_slug, project_slug, langfuse_project_id}.

Env vars:
- DATABASE_URL (Postgres)
- LANGFUSE_BASE_URL (default: http://localhost:4000)
- OUTPUT_CSV (optional, default: ./langfuse_project_map.csv)

Admin API mode:
- LANGFUSE_ADMIN_TOKEN (Bearer token for /api/admin/*)

Org API key mode (self-hosted OSS, no admin API):
- LANGFUSE_ORG_PUBLIC_KEY
- LANGFUSE_ORG_SECRET_KEY
- LANGFUSE_ORG_NAME (optional; if set, only sync matching entity slug)

Project API key mode (OSS UI provides project-level keys only):
- LANGFUSE_PROJECT_KEYS_FILE (CSV with columns:
  project_slug,public_key,secret_key[,entity_slug])

Optional:
- DRY_RUN=1 to skip create calls.
- WRITE_IDS=1 to update ai_system_registry.langfuse_project_id
"""
from __future__ import annotations

import csv
import os
import sys
from dataclasses import dataclass
from typing import Any

import httpx
import psycopg


def normalize_pg_dsn(dsn: str) -> str:
    if dsn.startswith("postgresql+psycopg://"):
        return dsn.replace("postgresql+psycopg://", "postgresql://", 1)
    return dsn


def get_env(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None or value == "":
        raise RuntimeError(f"Missing required env: {name}")
    return value


def load_entity_project_pairs(conn: psycopg.Connection) -> list[tuple[str, str]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT e.slug AS entity_slug, p.slug AS project_slug
            FROM entity e
            JOIN entity_projects p ON p.entity_id = e.id
            ORDER BY e.slug, p.slug
            """
        )
        return [(row[0], row[1]) for row in cur.fetchall()]


@dataclass
class OrgKey:
    public_key: str
    secret_key: str


@dataclass
class ProjectKey:
    public_key: str
    secret_key: str


def parse_list_payload(payload: Any) -> list[dict]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        if "data" in payload and isinstance(payload["data"], list):
            return payload["data"]
        if "items" in payload and isinstance(payload["items"], list):
            return payload["items"]
    return []


def parse_project_payload(payload: Any) -> dict:
    if isinstance(payload, dict):
        data = payload.get("data")
        if isinstance(data, list) and data:
            if isinstance(data[0], dict):
                return data[0]
        if isinstance(payload.get("project"), dict):
            return payload["project"]
        return payload
    if isinstance(payload, list) and payload:
        if isinstance(payload[0], dict):
            return payload[0]
    return {}


def get_project_id(payload: dict) -> str:
    for key in ("id", "projectId", "project_id"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def load_project_keys(path: str) -> tuple[dict[tuple[str, str], ProjectKey], dict[str, ProjectKey]]:
    keys_by_entity_project: dict[tuple[str, str], ProjectKey] = {}
    keys_by_project: dict[str, ProjectKey] = {}
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            project_slug = (row.get("project_slug") or "").strip()
            public_key = (row.get("public_key") or "").strip()
            secret_key = (row.get("secret_key") or "").strip()
            entity_slug = (row.get("entity_slug") or "").strip()
            if not project_slug or not public_key or not secret_key:
                raise RuntimeError(
                    "LANGFUSE_PROJECT_KEYS_FILE rows require project_slug, public_key, secret_key."
                )
            key = ProjectKey(public_key=public_key, secret_key=secret_key)
            if entity_slug:
                keys_by_entity_project[(entity_slug, project_slug)] = key
            else:
                keys_by_project[project_slug] = key
    return keys_by_entity_project, keys_by_project


def main() -> int:
    base_url = os.getenv("LANGFUSE_BASE_URL", "http://localhost:4000").rstrip("/")
    admin_token = os.getenv("LANGFUSE_ADMIN_TOKEN", "").strip()
    org_public_key = os.getenv("LANGFUSE_ORG_PUBLIC_KEY", "").strip()
    org_secret_key = os.getenv("LANGFUSE_ORG_SECRET_KEY", "").strip()
    org_name_filter = os.getenv("LANGFUSE_ORG_NAME", "").strip()
    project_keys_file = os.getenv("LANGFUSE_PROJECT_KEYS_FILE", "").strip()
    db_url = normalize_pg_dsn(get_env("DATABASE_URL"))
    output_csv = os.getenv("OUTPUT_CSV", "langfuse_project_map.csv")
    dry_run = os.getenv("DRY_RUN") == "1"
    write_ids = os.getenv("WRITE_IDS") == "1"

    with psycopg.connect(db_url) as conn:
        pairs = load_entity_project_pairs(conn)

    if not pairs:
        print("No entity/projects found.")
        return 0

    if not admin_token and not (org_public_key and org_secret_key) and not project_keys_file:
        raise RuntimeError(
            "Missing Langfuse credentials. Provide LANGFUSE_ADMIN_TOKEN or "
            "LANGFUSE_ORG_PUBLIC_KEY + LANGFUSE_ORG_SECRET_KEY, or LANGFUSE_PROJECT_KEYS_FILE."
        )

    org_names = sorted({entity_slug for entity_slug, _ in pairs})
    project_map: list[tuple[str, str, str]] = []

    if project_keys_file:
        if org_name_filter:
            pairs = [p for p in pairs if p[0] == org_name_filter]
            if not pairs:
                print(f"No entity/projects found for org name '{org_name_filter}'.")
                return 0

        print("Using project API key mode (project-level keys).")
        keys_by_entity_project, keys_by_project = load_project_keys(project_keys_file)

        for entity_slug, project_slug in pairs:
            key = keys_by_entity_project.get((entity_slug, project_slug)) or keys_by_project.get(
                project_slug
            )
            if not key:
                print(f"Missing project key for {entity_slug}/{project_slug}; skipping.")
                continue
            auth = httpx.BasicAuth(key.public_key, key.secret_key)
            with httpx.Client(base_url=base_url, auth=auth, timeout=30.0) as project_client:
                project_resp = project_client.get("/api/public/projects")
                project_resp.raise_for_status()
                project = parse_project_payload(project_resp.json())
                project_id = get_project_id(project)
                if not project_id:
                    print(f"Langfuse project id missing for {entity_slug}/{project_slug}; skipping.")
                    continue
                if project.get("name") and project.get("name") != project_slug:
                    print(
                        f"Warning: project key name '{project.get('name')}' does not match "
                        f"slug '{project_slug}'."
                    )
                project_map.append((entity_slug, project_slug, project_id))
    elif admin_token:
        headers = {"Authorization": f"Bearer {admin_token}"}
        with httpx.Client(base_url=base_url, headers=headers, timeout=30.0) as client:
            orgs_resp = client.get("/api/admin/organizations")
            orgs_resp.raise_for_status()
            orgs = parse_list_payload(orgs_resp.json())
            org_by_name = {str(o.get("name")): o for o in orgs if o.get("name")}

            org_key_cache: dict[str, OrgKey] = {}

            for entity_slug in org_names:
                org = org_by_name.get(entity_slug)
                if not org:
                    if dry_run:
                        print(f"[DRY RUN] Would create org: {entity_slug}")
                        continue
                    create_resp = client.post(
                        "/api/admin/organizations", json={"name": entity_slug}
                    )
                    create_resp.raise_for_status()
                    org = create_resp.json()
                    org_by_name[entity_slug] = org

                org_id = org.get("id")
                if not org_id:
                    print(f"Skip org without id: {entity_slug}")
                    continue

                if entity_slug not in org_key_cache:
                    keys_resp = client.get(f"/api/admin/organizations/{org_id}/apiKeys")
                    keys_resp.raise_for_status()
                    keys = parse_list_payload(keys_resp.json())
                    key = None
                    for k in keys:
                        if k.get("publicKey") and k.get("secretKey"):
                            key = k
                            break
                    if not key:
                        if dry_run:
                            print(f"[DRY RUN] Would create org API key for {entity_slug}")
                            continue
                        create_key = client.post(
                            f"/api/admin/organizations/{org_id}/apiKeys"
                        )
                        create_key.raise_for_status()
                        key = create_key.json()
                    if not key.get("publicKey") or not key.get("secretKey"):
                        raise RuntimeError(
                            f"Could not obtain org API key for {entity_slug}."
                        )
                    org_key_cache[entity_slug] = OrgKey(
                        public_key=key["publicKey"], secret_key=key["secretKey"]
                    )

                org_key = org_key_cache.get(entity_slug)
                if not org_key:
                    continue

                auth = httpx.BasicAuth(org_key.public_key, org_key.secret_key)
                with httpx.Client(base_url=base_url, auth=auth, timeout=30.0) as org_client:
                    projects_resp = org_client.get("/api/public/organizations/projects")
                    projects_resp.raise_for_status()
                    projects = parse_list_payload(projects_resp.json())
                    project_by_name = {
                        str(p.get("name")): p for p in projects if p.get("name")
                    }

                    for _, project_slug in [p for p in pairs if p[0] == entity_slug]:
                        project = project_by_name.get(project_slug)
                        if not project:
                            if dry_run:
                                print(
                                    f"[DRY RUN] Would create project: {entity_slug}/{project_slug}"
                                )
                                continue
                            create_project = org_client.post(
                                "/api/public/projects",
                                json={"name": project_slug, "retention": 0},
                            )
                            create_project.raise_for_status()
                            project = create_project.json()
                            project_by_name[project_slug] = project

                        project_id = project.get("id") or ""
                        if project_id:
                            project_map.append((entity_slug, project_slug, project_id))
    else:
        if org_name_filter:
            pairs = [p for p in pairs if p[0] == org_name_filter]
            if not pairs:
                print(f"No entity/projects found for org name '{org_name_filter}'.")
                return 0

        print("Using org API key mode (no admin API).")
        auth = httpx.BasicAuth(org_public_key, org_secret_key)
        with httpx.Client(base_url=base_url, auth=auth, timeout=30.0) as org_client:
            projects_resp = org_client.get("/api/public/organizations/projects")
            projects_resp.raise_for_status()
            projects = parse_list_payload(projects_resp.json())
            project_by_name = {str(p.get("name")): p for p in projects if p.get("name")}

            for entity_slug, project_slug in pairs:
                project = project_by_name.get(project_slug)
                if not project:
                    if dry_run:
                        print(f"[DRY RUN] Would create project: {entity_slug}/{project_slug}")
                        continue
                    create_project = org_client.post(
                        "/api/public/projects",
                        json={"name": project_slug, "retention": 0},
                    )
                    create_project.raise_for_status()
                    project = create_project.json()
                    project_by_name[project_slug] = project

                project_id = project.get("id") or ""
                if project_id:
                    project_map.append((entity_slug, project_slug, project_id))

    if dry_run:
        print("[DRY RUN] Skipping CSV output.")
        return 0

    with open(output_csv, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["entity_slug", "project_slug", "langfuse_project_id"])
        writer.writerows(project_map)

    print(f"Saved mapping CSV to {output_csv}")

    if write_ids:
        mapping_by_slug: dict[str, str] = {
            project_slug: project_id for _, project_slug, project_id in project_map
        }
        if mapping_by_slug:
            with psycopg.connect(db_url) as conn:
                with conn.cursor() as cur:
                    for project_slug, project_id in mapping_by_slug.items():
                        cur.execute(
                            """
                            UPDATE ai_system_registry
                            SET langfuse_project_id = %s,
                                langfuse_base_url = %s
                            WHERE project_slug = %s
                            """,
                            (project_id, base_url, project_slug),
                        )
                conn.commit()
            print("Updated ai_system_registry.langfuse_project_id for matching project slugs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
