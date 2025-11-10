# C:\Apps\_TheLeadAI\apps\core-svc\app\routers\projects.py
# app/routers/projects.py
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from app.db import get_db, engine
from app.models import Assessment, PillarOverride, Project

router = APIRouter(prefix="", tags=["projects"])

@router.get("/projects")
def list_projects():
    with Session(engine) as s:
        rows = s.scalars(select(Project).order_by(Project.name.asc())).all()
        result = []
        for p in rows:
            result.append(
                {
                    "id": str(p.id),
                    "slug": p.slug,
                    "name": p.name,
                    "risk_level": p.risk_level,
                    "target_threshold": p.target_threshold,
                    "priority": p.priority or p.risk_level,
                    "sponsor": p.sponsor,
                    "owner": p.owner,
                    "creation_date": p.creation_date.isoformat() if p.creation_date else None,
                    "update_date": p.update_date.isoformat() if p.update_date else None,
                }
            )
        return result

@router.delete("/projects/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(slug: str):
    """
    Hard-delete a project and related data by slug.
    Prefer ON DELETE CASCADE in schema; otherwise fall back to explicit deletes.
    """
    with Session(engine) as s:
        proj = s.scalar(select(Project).where(Project.slug == slug))
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")

        # Clean up project-scoped data that is not covered by ORM cascades.
        s.execute(delete(PillarOverride).where(PillarOverride.project_id == proj.id))
        s.execute(delete(Assessment).where(Assessment.project_id == proj.id))
        s.execute(text("DELETE FROM control_values WHERE project_slug = :slug"), {"slug": proj.slug})

        # Finally remove the project row itself.
        s.delete(proj)
        s.commit()
    return

