"""Add server default for itemlabel created_at

Revision ID: 35b54d427a12
Revises: 230c0f087d53
Create Date: 2026-01-10 21:11:07.474919

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '35b54d427a12'
down_revision = '230c0f087d53'
branch_labels = None
depends_on = None


def upgrade():
    # Add server default for itemlabel.created_at
    op.alter_column(
        'itemlabel',
        'created_at',
        server_default=sa.func.now(),
    )


def downgrade():
    # Remove server default for itemlabel.created_at
    op.alter_column(
        'itemlabel',
        'created_at',
        server_default=None,
    )
