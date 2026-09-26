"""add_archived_to_wishlistitemstatus_enum

Revision ID: c774c628e6aa
Revises: 011a1e4cad39
Create Date: 2026-01-19 13:05:36.710543

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = 'c774c628e6aa'
down_revision = '011a1e4cad39'
branch_labels = None
depends_on = None


def upgrade():
    # Only PostgreSQL has enum types; SQLite stores enums as strings
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE wishlistitemstatus ADD VALUE IF NOT EXISTS 'ARCHIVED'")


def downgrade():
    # PostgreSQL doesn't support removing enum values directly
    # Would require recreating the enum, which is complex
    pass
