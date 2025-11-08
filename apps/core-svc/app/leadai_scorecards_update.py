# apps/coresvc/app/leadai_scorecards_update.py.
import os
from typing import Optional, Tuple
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

# ===================== Config =====================
load_dotenv()
DB_URL = os.getenv("DATABASE_URL", "postgresql://leadai:leadai@localhost:5432/leadai")

# Limit to a single project; set to None to process all projects
PROJECT_FILTER: Optional[str] = None

# Safety: clamp all percentages/scores 0..100
CLAMP_MIN, CLAMP_MAX = 0.0, 100.0
# ==================================================


def clamp_0_100(x: float) -> float:
    return max(CLAMP_MIN, min(CLAMP_MAX, x))


def compute_normalized_pct(
    raw_value: Optional[float],
    hib: bool,
    norm_min: Optional[float],
    norm_max: Optional[float],
) -> float:
    """
    normalized_pct = (raw - norm_min) / (norm_max - norm_min) * 100
    if not higher_is_better: normalized_pct = 100 - normalized_pct
    clamp to [0, 100]
    If norm_min/max are unusable -> return 0
    """
    try:
        if raw_value is None or norm_min is None or norm_max is None:
            return 0.0
        a, b = float(norm_min), float(norm_max)
        if not (b > a):
            return 0.0
        v = float(raw_value)
        pct = 100.0 * (v - a) / (b - a)
        if not hib:
            pct = 100.0 - pct
        return clamp_0_100(pct)
    except Exception:
        return 0.0


def compute_kpi_score(
    unit: Optional[str],
    hib: bool,
    raw_value: Optional[float],
    target_numeric: Optional[float],
) -> Optional[int]:
    """
    Target-attainment score (independent of normalized_pct):
      - unit="percent":
          HIB True  -> score = clamp(raw, 0..100)
          HIB False -> score = clamp(100 * target / raw)
      - time-like units {"days","hours","seconds","millis","milliseconds","ms","s"}:
          HIB True  -> clamp(100 * raw / target)
          HIB False -> clamp(100 * target / raw)
      - else (generic):
          HIB True  -> clamp(100 * raw / target)
          HIB False -> clamp(100 * target / raw)
    Returns integer 0..100, or None if insufficient data.
    """
    if raw_value is None or target_numeric is None:
        return None
    try:
        v = float(raw_value)
        t = float(target_numeric)
    except Exception:
        return None

    u = (unit or "").strip().lower()
    # guard division by zero in branches using t or v in denominator
    if t == 0 and (hib or u in {"days","hours","seconds","millis","milliseconds","ms","s"} or u == ""):
        return None
    if v == 0 and (not hib):
        return None

    if u == "percent":
        s = v if hib else (100.0 * t / v)
        return int(round(clamp_0_100(s)))

    time_units = {"days", "hours", "seconds", "millis", "milliseconds", "ms", "s"}
    if u in time_units:
        s = (100.0 * v / t) if hib else (100.0 * t / v)
        return int(round(clamp_0_100(s)))

    # generic ratio
    s = (100.0 * v / t) if hib else (100.0 * t / v)
    return int(round(clamp_0_100(s)))


def fetch_rows(conn, project_slug: Optional[str] = None):
    clause = "AND cv.project_slug = %s" if project_slug else ""
    sql = f"""
    SELECT
      cv.project_slug,
      cv.control_id,
      cv.kpi_key,
      cv.raw_value,
      COALESCE(cv.target_numeric, c.target_numeric) AS target_numeric, -- prefer per-row target, else control default
      cv.kpi_score,
      cv.normalized_pct,
      c.unit,
      c.higher_is_better,
      c.norm_min,
      c.norm_max
    FROM public.control_values AS cv
    JOIN public.controls       AS c
      ON c.id = cv.control_id
    WHERE cv.raw_value IS NOT NULL
      {clause}
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, (project_slug,) if project_slug else None)
        return cur.fetchall()


def update_row(conn, project_slug: str, control_id: str, normalized_pct: float, kpi_score: Optional[int]):
    """
    Persist normalized_pct first; include kpi_score if we have it.
    """
    if kpi_score is not None:
        sql = """
          UPDATE public.control_values
          SET normalized_pct = %s,
              kpi_score = %s,
              updated_at = now()
          WHERE project_slug = %s AND control_id = %s
        """
        params = (float(normalized_pct), int(kpi_score), project_slug, control_id)
    else:
        sql = """
          UPDATE public.control_values
          SET normalized_pct = %s,
              updated_at = now()
          WHERE project_slug = %s AND control_id = %s
        """
        params = (float(normalized_pct), project_slug, control_id)

    with conn.cursor() as cur:
        cur.execute(sql, params)


def main() -> Tuple[int, int]:
    updated, skipped = 0, 0
    with psycopg.connect(DB_URL, autocommit=False) as conn:
        rows = fetch_rows(conn, PROJECT_FILTER)
        for r in rows:
            hib = bool(r.get("higher_is_better"))

            # 1) normalized_pct (for scaling/visuals)
            new_norm = compute_normalized_pct(
                raw_value=r.get("raw_value"),
                hib=hib,
                norm_min=r.get("norm_min"),
                norm_max=r.get("norm_max"),
            )

            # 2) kpi_score (target attainment)
            new_score = compute_kpi_score(
                unit=r.get("unit"),
                hib=hib,
                raw_value=r.get("raw_value"),
                target_numeric=r.get("target_numeric"),
            )

            # Compare with current values; avoid noisy writes
            prev_norm = r.get("normalized_pct")
            prev_score = r.get("kpi_score")

            needs_norm = (prev_norm is None) or (abs(float(prev_norm) - float(new_norm)) > 1e-6)
            needs_score = (new_score is not None) and ((prev_score is None) or (int(prev_score) != int(new_score)))

            if needs_norm or needs_score:
                update_row(conn, r["project_slug"], r["control_id"], new_norm, new_score)
                updated += 1
            else:
                skipped += 1

        conn.commit()
    return updated, skipped


if __name__ == "__main__":
    up, sk = main()
    print(f"Updated rows: {up} | Skipped: {sk}")
