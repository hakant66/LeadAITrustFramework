"""
FastAPI router for the KPI List report.

This module exposes a single endpoint under the ``/admin/reports`` prefix
that returns a hierarchical view of all projects, their associated pillars
and the KPIs that live under each pillar.  The data is sourced from the
database view ``public.v_project_pillars_kpis`` which contains one row per
combination of project, pillar and KPI.

Each entry in the response has the following structure::

    {
      "project_name": "<project name>",
      "pillars": [
        {
          "pillar_name": "<pillar name>",
          "kpis": [
            {
              "kpi_name": "<kpi name>",
              "kpi_description": "<optional kpi description>"
            },
            ...
          ]
        },
        ...
      ]
    }

The ``public.v_project_pillars_kpis`` view is expected to expose the
columns ``project_name``, ``pillar_name``, ``kpi_name`` and
``kpi_description``.  If the schema changes or additional columns are
present, they are ignored by this endpoint.
"""

# app/routers/reports.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

import asyncpg
from fastapi import APIRouter, HTTPException, Query

from app.scorecard import get_pool, ensure_schema

router = APIRouter(
    prefix="/admin/reports",
    tags=["reports"],
)


async def _fetch_project_pillar_kpi_rows(
    project_slug: Optional[str] = None,
) -> List[asyncpg.Record]:
    """
    Fetch flat rows of (project_name, pillar_name, kpi_name, kpi_description,
    kpi_evidence_source, kpi_example) from the v_project_pillars_kpis view.

    If project_slug is provided, we restrict the result set to the project
    that has that slug via a join on projects.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await ensure_schema(conn)

        if project_slug:
            sql = """
                SELECT
                    v.project_name,
                    v.pillar_name,
                    v.kpi_name,
                    v.kpi_description,
                    v.kpi_evidence_source,
                    v.kpi_example
                FROM v_project_pillars_kpis AS v
                JOIN projects p
                  ON p.name = v.project_name
                WHERE p.slug = $1
                ORDER BY
                    v.project_name,
                    v.pillar_name,
                    v.kpi_name;
            """
            rows = await conn.fetch(sql, project_slug)
        else:
            sql = """
                SELECT
                    project_name,
                    pillar_name,
                    kpi_name,
                    kpi_description,
                    kpi_evidence_source,
                    kpi_example
                FROM v_project_pillars_kpis
                ORDER BY
                    project_name,
                    pillar_name,
                    kpi_name;
            """
            rows = await conn.fetch(sql)

    return rows


def _build_hierarchical_report(
    rows: List[asyncpg.Record],
) -> List[Dict[str, Any]]:
    """
    Turn the flat row set into a nested structure:

    [
      {
        "project_name": "...",
        "pillars": [
          {
            "pillar_name": "...",
            "kpis": [
              {
                "kpi_name": "...",
                "kpi_description": "...",
                "kpi_evidence_source": "...",
                "kpi_example": "..."
              },
              ...
            ]
          },
          ...
        ]
      },
      ...
    ]
    """
    projects: Dict[str, Dict[str, Any]] = {}

    for row in rows:
        project_name = row["project_name"]
        pillar_name = row["pillar_name"]
        kpi_name = row["kpi_name"]
        kpi_description = row["kpi_description"]
        kpi_evidence_source = row["kpi_evidence_source"]
        kpi_example = row["kpi_example"]

        proj = projects.setdefault(
            project_name,
            {
                "project_name": project_name,
                "pillars": {},
            },
        )
        pillars = proj["pillars"]

        pillar = pillars.setdefault(
            pillar_name,
            {
                "pillar_name": pillar_name,
                "kpis": [],
            },
        )

        pillar["kpis"].append(
            {
                "kpi_name": kpi_name,
                "kpi_description": kpi_description,
                "kpi_evidence_source": kpi_evidence_source,
                "kpi_example": kpi_example,
            }
        )

    # Convert inner pillar dicts to lists
    hierarchical: List[Dict[str, Any]] = []
    for proj in projects.values():
        pillar_list = list(proj["pillars"].values())
        hierarchical.append(
            {
                "project_name": proj["project_name"],
                "pillars": pillar_list,
            }
        )

    return hierarchical


@router.get("/projects-pillars-kpis")
async def get_projects_pillars_kpis_report(
    project_slug: Optional[str] = Query(
        default=None,
        description="Optional: restrict report to a single project by slug "
        "(e.g. 'ai-document-processing').",
    )
) -> List[Dict[str, Any]]:
    """
    Hierarchical report of projects, pillars and KPIs.

    - If project_slug is omitted: returns all projects.
    - If project_slug is provided: returns only that project's KPIs.
    """
    try:
        rows = await _fetch_project_pillar_kpi_rows(project_slug=project_slug)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return _build_hierarchical_report(rows)
