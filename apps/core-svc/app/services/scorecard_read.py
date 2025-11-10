# apps/core-svc/app/services/scorecard_read.py
from sqlalchemy import text
from sqlalchemy.engine import Connection

def fetch_project_pillars(db: Connection, project_slug: str):
    """
    Returns pillars with score_pct, weight (0..1), and pillar_weight_pct (0..100).
    score_pct is:
      - pillar_overrides.score_pct if present
      - else avg(latest control_values.normalized_pct) per pillar for this project_slug
    """
    q = text("""
        with latest as (
          select
            cv.control_id,
            cv.project_slug,
            cv.normalized_pct,
            row_number() over (
              partition by cv.control_id, cv.project_slug
              order by coalesce(cv.observed_at, cv.updated_at) desc, cv.updated_at desc
            ) as rn
          from public.control_values cv
          where cv.project_slug = :project_slug
        ),
        pillar_calc as (
          select
            c.pillar_key,
            avg(l.normalized_pct) as calc_score_pct   -- normalized_pct is already 0..100
          from public.controls c
          join latest l on l.control_id = c.id and l.rn = 1
          where c.project_id is null or c.project_id in (
            select id from public.projects where slug = :project_slug
          )
          group by c.pillar_key
        )
        select
          po.id                                         as pillar_id,
          p.key                                         as key,
          p.name                                        as name,
          coalesce(po.score_pct, pc.calc_score_pct, 0)  as score_pct,
          po.maturity                                   as maturity,
          coalesce(po.weight, p.weight)                 as weight,              -- 0..1 (stored)
          round(coalesce(po.weight, p.weight) * 100.0, 2) as pillar_weight_pct, -- 0..100 (display)
          po.updated_at                                 as updated_at
        from public.pillars p
        left join public.projects pr on pr.slug = :project_slug
        left join public.pillar_overrides po
          on po.pillar_key = p.key and po.project_id = pr.id
        left join pillar_calc pc
          on pc.pillar_key = p.key
        order by p.key
    """)
    rows = db.execute(q, {"project_slug": project_slug}).mappings().all()
    return [dict(r) for r in rows]
