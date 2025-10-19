# C:\Apps\_TheLeadAI\apps\core-svc\app\projects.py
# app/projects.py
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from .db import engine
from .models import Project, Pillar, KPI, KPIValue, PillarOverride  # adjust names if different

router = APIRouter(prefix="", tags=["projects"])

@router.get("/projects")
def list_projects():
    with Session(engine) as s:
        rows = s.scalars(select(Project).order_by(Project.name.asc())).all()
        return [
            {
                "id": str(p.id),
                "slug": p.slug,
                "name": p.name,
                "risk_level": p.risk_level,
                "target_threshold": p.target_threshold,
            } for p in rows
        ]

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

        # If you have FK cascades, this single delete is enough:
        # s.delete(proj)

        # If you DON'T have cascades, explicitly delete children first:
        # Adjust table list to your schema.
        s.execute(delete(PillarOverride).where(PillarOverride.project_id == proj.id))
        s.execute(delete(KPIValue).where(KPIValue.project_id == proj.id))
        s.execute(delete(KPI).where(KPI.project_id == proj.id))
        s.execute(delete(Pillar).where(Pillar.project_id == proj.id))

        s.delete(proj)
        s.commit()
    return

