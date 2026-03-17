"""add auth schema for nextauth

Revision ID: d9c7b5a3f1e2
Revises: f1c2d3e4a5b6
Create Date: 2026-02-09
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "d9c7b5a3f1e2"
down_revision = "f1c2d3e4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS auth")

    op.create_table(
        "User",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("email", sa.Text(), nullable=True, unique=True),
        sa.Column("emailVerified", sa.DateTime(timezone=True), nullable=True),
        sa.Column("image", sa.Text(), nullable=True),
        schema="auth",
    )

    op.create_table(
        "Account",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("userId", sa.Text(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("providerAccountId", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.Integer(), nullable=True),
        sa.Column("token_type", sa.Text(), nullable=True),
        sa.Column("scope", sa.Text(), nullable=True),
        sa.Column("id_token", sa.Text(), nullable=True),
        sa.Column("session_state", sa.Text(), nullable=True),
        sa.UniqueConstraint("provider", "providerAccountId", name="Account_provider_providerAccountId_key"),
        schema="auth",
    )

    op.create_table(
        "Session",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("sessionToken", sa.Text(), nullable=False, unique=True),
        sa.Column("userId", sa.Text(), nullable=False),
        sa.Column("expires", sa.DateTime(timezone=True), nullable=False),
        schema="auth",
    )

    op.create_table(
        "VerificationToken",
        sa.Column("identifier", sa.Text(), nullable=False),
        sa.Column("token", sa.Text(), nullable=False, unique=True),
        sa.Column("expires", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("identifier", "token", name="VerificationToken_identifier_token_key"),
        schema="auth",
    )

    op.create_foreign_key(
        "Account_userId_fkey",
        "Account",
        "User",
        ["userId"],
        ["id"],
        source_schema="auth",
        referent_schema="auth",
        ondelete="CASCADE",
    )

    op.create_foreign_key(
        "Session_userId_fkey",
        "Session",
        "User",
        ["userId"],
        ["id"],
        source_schema="auth",
        referent_schema="auth",
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("Session_userId_fkey", "Session", schema="auth", type_="foreignkey")
    op.drop_constraint("Account_userId_fkey", "Account", schema="auth", type_="foreignkey")

    op.drop_table("VerificationToken", schema="auth")
    op.drop_table("Session", schema="auth")
    op.drop_table("Account", schema="auth")
    op.drop_table("User", schema="auth")
