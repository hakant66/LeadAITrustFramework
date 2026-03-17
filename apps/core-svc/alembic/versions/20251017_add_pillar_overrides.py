"""migrate/align pillar_overrides to id/project_id schema (or create fresh)

Revision ID: 20251017_add_pillar_overrides
Revises: 8ce721d9c4ca
Create Date: 2025-10-17
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20251017_add_pillar_overrides"
down_revision = "8ce721d9c4ca"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if insp.has_table("pillar_overrides"):
        # Legacy table exists – inspect columns
        cols = {c["name"] for c in insp.get_columns("pillar_overrides")}

        if {"project_slug", "pillar"}.issubset(cols):
            # ---- Transform legacy shape to new shape ----
            op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

            # 1) Add new columns nullable for now
            op.add_column("pillar_overrides", sa.Column("id", sa.String(), nullable=True))
            op.add_column("pillar_overrides", sa.Column("project_id", sa.String(), nullable=True))
            op.add_column("pillar_overrides", sa.Column("pillar_key", sa.String(length=60), nullable=True))

            # 2) Backfill id / pillar_key
            op.execute("UPDATE pillar_overrides SET id = gen_random_uuid()")
            op.execute("UPDATE pillar_overrides SET pillar_key = pillar")

            # 3) Backfill project_id via projects.slug -> projects.id
            op.execute(
                """
                UPDATE pillar_overrides po
                SET project_id = p.id
                FROM projects p
                WHERE p.slug = po.project_slug
                """
            )

            # 4) score_pct: widen to float and relax NOT NULL
            op.execute("ALTER TABLE pillar_overrides ALTER COLUMN score_pct TYPE double precision")
            op.execute("ALTER TABLE pillar_overrides ALTER COLUMN score_pct DROP NOT NULL")

            # 5) Drop old PK (project_slug, pillar) and add new PK(id)
            #    NOTE: your PK name is 'pillar_overrides_pkey'
            op.execute("ALTER TABLE pillar_overrides DROP CONSTRAINT IF EXISTS pillar_overrides_pkey")
            op.execute("ALTER TABLE pillar_overrides ADD CONSTRAINT pillar_overrides_pkey PRIMARY KEY (id)")

            # 6) Add unique(project_id, pillar_key) if missing
            exists_unique = bind.execute(sa.text("""
                SELECT 1
                FROM   pg_constraint
                WHERE  conrelid = 'pillar_overrides'::regclass
                AND    conname  = 'uq_pillar_overrides_project_pillar'
            """)).scalar()
            if not exists_unique:
                op.create_unique_constraint(
                    "uq_pillar_overrides_project_pillar",
                    "pillar_overrides",
                    ["project_id", "pillar_key"],
                )

            # 7) Add FK to projects(id) and index(project_id)
            #    First drop any old FK named similarly (defensive)
            op.execute("ALTER TABLE pillar_overrides DROP CONSTRAINT IF EXISTS fk_pillar_overrides_project")
            op.execute("""
                ALTER TABLE pillar_overrides
                ADD CONSTRAINT fk_pillar_overrides_project
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            """)
            op.execute("""
                CREATE INDEX IF NOT EXISTS ix_pillar_overrides_project_id
                ON pillar_overrides (project_id)
            """)

            # 8) Now enforce NOT NULL on new cols
            op.alter_column("pillar_overrides", "id", nullable=False)
            op.alter_column("pillar_overrides", "project_id", nullable=False)
            op.alter_column("pillar_overrides", "pillar_key", nullable=False)

            # 9) Drop legacy columns
            op.drop_column("pillar_overrides", "project_slug")
            op.drop_column("pillar_overrides", "pillar")

            # Keep updated_at as timestamptz (works fine with SQLAlchemy DateTime(timezone=True))
            # If your model uses naive DateTime, consider switching to timezone=True for accuracy.

        else:
            # Table exists but is already in the new shape (or another custom shape) – ensure constraints
            op.execute("""
                CREATE INDEX IF NOT EXISTS ix_pillar_overrides_project_id
                ON pillar_overrides (project_id)
            """)
            exists_unique = bind.execute(sa.text("""
                SELECT 1
                FROM   pg_constraint
                WHERE  conrelid = 'pillar_overrides'::regclass
                AND    conname  = 'uq_pillar_overrides_project_pillar'
            """)).scalar()
            if not exists_unique:
                op.create_unique_constraint(
                    "uq_pillar_overrides_project_pillar",
                    "pillar_overrides",
                    ["project_id", "pillar_key"],
                )
    else:
        # ---- Fresh create (no table yet) ----
        op.create_table(
            "pillar_overrides",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column(
                "project_id",
                sa.String(),
                sa.ForeignKey("projects.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("pillar_key", sa.String(length=60), nullable=False),
            sa.Column("score_pct", sa.Float(), nullable=True),
            sa.Column("maturity", sa.Integer(), nullable=True),
            # Using timestamptz is fine; keep consistent with your DB conventions
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
        op.create_index(
            "ix_pillar_overrides_project_id",
            "pillar_overrides",
            ["project_id"],
            unique=False,
        )
        op.create_unique_constraint(
            "uq_pillar_overrides_project_pillar",
            "pillar_overrides",
            ["project_id", "pillar_key"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if insp.has_table("pillar_overrides"):
        # safest is to drop the table; reversing the in-place transform exactly is not needed
        op.drop_constraint("uq_pillar_overrides_project_pillar", "pillar_overrides", type_="unique")
        op.drop_index("ix_pillar_overrides_project_id", table_name="pillar_overrides")
        op.drop_table("pillar_overrides")