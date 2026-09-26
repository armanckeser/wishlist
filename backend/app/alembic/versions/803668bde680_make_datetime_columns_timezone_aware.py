"""make datetime columns timezone aware

Revision ID: 803668bde680
Revises: b56f482929b3
Create Date: 2025-12-28 14:13:20.169425

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '803668bde680'
down_revision = 'b56f482929b3'
branch_labels = None
depends_on = None


def upgrade():
    # Change datetime columns to timezone-aware (TIMESTAMP WITH TIME ZONE)
    op.alter_column(
        "budget",
        "last_updated_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=False,
    )
    op.alter_column(
        "wishlistitem",
        "added_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=False,
    )
    op.alter_column(
        "wishlistitem",
        "purchased_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=True,
    )


def downgrade():
    # Revert to naive datetime (TIMESTAMP WITHOUT TIME ZONE)
    op.alter_column(
        "budget",
        "last_updated_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
    )
    op.alter_column(
        "wishlistitem",
        "added_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
    )
    op.alter_column(
        "wishlistitem",
        "purchased_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=True,
    )
