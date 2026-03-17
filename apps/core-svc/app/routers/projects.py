# C:\Apps\_TheLeadAI\apps\core-svc\app\routers\projects.py
# app/routers/projects.py
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.orm import Session
from uuid import UUID

from app.db import engine
from app.models import Project, ProjectTranslation
from app.dependencies import (
    get_entity_id_with_auth,
    get_entity_id_with_auth_viewer,
    get_entity_id_with_auth_editor,
    get_entity_id_with_auth_admin,
    get_entity_id_or_first_for_viewer,
)

router = APIRouter(prefix="", tags=["projects"])

class ProjectTranslationIn(BaseModel):
    name: str | None = None
    risk_level: str | None = None
    priority: str | None = None
    sponsor: str | None = None
    owner: str | None = None
    status: str | None = None
    company_registration_number: str | None = None
    headquarters_country: str | None = None
    regions_of_operation: str | None = None
    sectors: str | None = None


class ProjectTranslationOut(ProjectTranslationIn):
    locale: str


def _normalize_locale(locale: str | None) -> str | None:
    if not locale:
        return None
    normalized = locale.strip().lower()
    if not normalized:
        return None
    return normalized.split(",")[0].split("-")[0]


@router.get("/projects")
def list_projects(
    locale: str | None = None,
    entity_id: UUID = Depends(get_entity_id_or_first_for_viewer),
):
    """
    List all projects for the authenticated entity.
    If entity_id is not in query/header, uses the user's first entity from user_entity_access.
    Requires viewer role or higher.
    """
    normalized_locale = _normalize_locale(locale)
    with Session(engine) as s:
        if normalized_locale:
            stmt = (
                select(Project, ProjectTranslation)
                .where(
                    Project.entity_id == entity_id,
                    Project.is_archived.is_(False),
                )
                .outerjoin(
                    ProjectTranslation,
                    and_(
                        ProjectTranslation.project_id == Project.id,
                        ProjectTranslation.locale == normalized_locale,
                    ),
                )
                .order_by(Project.name.asc())
            )
            rows = s.execute(stmt).all()
        else:
            projs = s.scalars(
                select(Project)
                .where(
                    Project.entity_id == entity_id,
                    Project.is_archived.is_(False),
                )
                .order_by(Project.name.asc())
            ).all()
            rows = [(p, None) for p in projs]
        result = []
        for p, tr in rows:
            translated_name = tr.name if tr and tr.name else p.name
            translated_risk = tr.risk_level if tr and tr.risk_level else p.risk_level
            translated_priority = tr.priority if tr and tr.priority else p.priority
            translated_sponsor = tr.sponsor if tr and tr.sponsor else p.sponsor
            translated_owner = tr.owner if tr and tr.owner else p.owner
            translated_status = tr.status if tr and tr.status else p.status
            result.append(
                {
                    "id": str(p.id),
                    "slug": p.slug,
                    "name": translated_name,
                    "risk_level": translated_risk,
                    "target_threshold": p.target_threshold,
                    "priority": translated_priority or translated_risk,
                    "sponsor": translated_sponsor,
                    "owner": translated_owner,
                    "status": translated_status,
                    "creation_date": p.creation_date.isoformat() if p.creation_date else None,
                    "update_date": p.update_date.isoformat() if p.update_date else None,
                }
            )
        return result


@router.get("/projects/{slug}/translations", response_model=list[ProjectTranslationOut])
def list_project_translations(
    slug: str,
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
):
    """
    List translations for a project.
    Requires viewer role or higher.
    """
    with Session(engine) as s:
        query = select(Project).where(
            Project.slug == slug,
            Project.entity_id == entity_id,
            Project.is_archived.is_(False),
        )
        proj = s.scalar(query)
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        rows = s.scalars(
            select(ProjectTranslation)
            .where(ProjectTranslation.project_id == proj.id)
            .order_by(ProjectTranslation.locale.asc())
        ).all()
        return [
            ProjectTranslationOut(
                locale=row.locale,
                name=row.name,
                risk_level=row.risk_level,
                priority=row.priority,
                sponsor=row.sponsor,
                owner=row.owner,
                status=row.status,
                company_registration_number=row.company_registration_number,
                headquarters_country=row.headquarters_country,
                regions_of_operation=row.regions_of_operation,
                sectors=row.sectors,
            )
            for row in rows
        ]


@router.get("/projects/{slug}/translations/{locale}", response_model=ProjectTranslationOut)
def get_project_translation(
    slug: str,
    locale: str,
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
):
    """
    Get a specific translation for a project.
    Requires viewer role or higher.
    """
    normalized_locale = _normalize_locale(locale)
    if not normalized_locale:
        raise HTTPException(status_code=400, detail="Locale is required")
    with Session(engine) as s:
        query = select(Project).where(
            Project.slug == slug,
            Project.entity_id == entity_id,
            Project.is_archived.is_(False),
        )
        proj = s.scalar(query)
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        row = s.scalar(
            select(ProjectTranslation).where(
                ProjectTranslation.project_id == proj.id,
                ProjectTranslation.locale == normalized_locale,
            )
        )
        if not row:
            raise HTTPException(status_code=404, detail="Translation not found")
        return ProjectTranslationOut(
            locale=row.locale,
            name=row.name,
            risk_level=row.risk_level,
            priority=row.priority,
            sponsor=row.sponsor,
            owner=row.owner,
            status=row.status,
            company_registration_number=row.company_registration_number,
            headquarters_country=row.headquarters_country,
            regions_of_operation=row.regions_of_operation,
            sectors=row.sectors,
        )


@router.put("/projects/{slug}/translations/{locale}", response_model=ProjectTranslationOut)
def upsert_project_translation(
    slug: str,
    locale: str,
    payload: ProjectTranslationIn,
    entity_id: UUID = Depends(get_entity_id_with_auth_editor),
):
    """
    Create or update a translation for a project.
    Requires editor role or higher.
    """
    normalized_locale = _normalize_locale(locale)
    if not normalized_locale:
        raise HTTPException(status_code=400, detail="Locale is required")
    with Session(engine) as s:
        query = select(Project).where(
            Project.slug == slug,
            Project.entity_id == entity_id,
            Project.is_archived.is_(False),
        )
        proj = s.scalar(query)
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        
        effective_entity_id = entity_id
        
        row = s.scalar(
            select(ProjectTranslation).where(
                ProjectTranslation.project_id == proj.id,
                ProjectTranslation.locale == normalized_locale,
            )
        )
        if row:
            row.name = payload.name
            row.risk_level = payload.risk_level
            row.priority = payload.priority
            row.sponsor = payload.sponsor
            row.owner = payload.owner
            row.status = payload.status
            row.company_registration_number = payload.company_registration_number
            row.headquarters_country = payload.headquarters_country
            row.regions_of_operation = payload.regions_of_operation
            row.sectors = payload.sectors
            row.entity_id = effective_entity_id
        else:
            row = ProjectTranslation(
                project_id=proj.id,
                entity_id=effective_entity_id,
                locale=normalized_locale,
                name=payload.name,
                risk_level=payload.risk_level,
                priority=payload.priority,
                sponsor=payload.sponsor,
                owner=payload.owner,
                status=payload.status,
                company_registration_number=payload.company_registration_number,
                headquarters_country=payload.headquarters_country,
                regions_of_operation=payload.regions_of_operation,
                sectors=payload.sectors,
            )
            s.add(row)
        s.commit()
        return ProjectTranslationOut(
            locale=row.locale,
            name=row.name,
            risk_level=row.risk_level,
            priority=row.priority,
            sponsor=row.sponsor,
            owner=row.owner,
            status=row.status,
            company_registration_number=row.company_registration_number,
            headquarters_country=row.headquarters_country,
            regions_of_operation=row.regions_of_operation,
            sectors=row.sectors,
        )


@router.delete("/projects/{slug}/translations/{locale}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_translation(
    slug: str,
    locale: str,
    entity_id: UUID = Depends(get_entity_id_with_auth_editor),
):
    """
    Delete a translation for a project.
    Requires editor role or higher.
    """
    normalized_locale = _normalize_locale(locale)
    if not normalized_locale:
        raise HTTPException(status_code=400, detail="Locale is required")
    with Session(engine) as s:
        query = select(Project).where(
            Project.slug == slug,
            Project.entity_id == entity_id,
            Project.is_archived.is_(False),
        )
        proj = s.scalar(query)
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        row = s.scalar(
            select(ProjectTranslation).where(
                ProjectTranslation.project_id == proj.id,
                ProjectTranslation.locale == normalized_locale,
            )
        )
        if not row:
            raise HTTPException(status_code=404, detail="Translation not found")
        s.delete(row)
        s.commit()
    return

@router.delete("/projects/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    slug: str,
    entity_id: UUID = Depends(get_entity_id_with_auth_admin),
):
    """
    Archive a project by slug (non-destructive).
    Requires admin role.
    """
    with Session(engine) as s:
        query = select(Project).where(
            Project.slug == slug,
            Project.entity_id == entity_id
        )
        proj = s.scalar(query)
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        if proj.is_archived:
            return

        proj.is_archived = True
        proj.archived_at = datetime.now(timezone.utc)
        proj.status = "Archived"
        proj.update_date = datetime.now(timezone.utc)
        s.commit()
    return
