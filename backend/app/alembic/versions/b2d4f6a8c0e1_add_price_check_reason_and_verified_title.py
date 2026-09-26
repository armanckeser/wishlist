"""Add price_check_reason and price_verified_title to wishlistitem

Revision ID: b2d4f6a8c0e1
Revises: f1a2b3c4d5e6
Create Date: 2026-09-06 00:00:00.000000

"""
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = 'b2d4f6a8c0e1'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'wishlistitem',
        sa.Column(
            'price_check_reason',
            sqlmodel.sql.sqltypes.AutoString(length=32),
            nullable=True,
        ),
    )
    op.add_column(
        'wishlistitem',
        sa.Column(
            'price_verified_title',
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column('wishlistitem', 'price_verified_title')
    op.drop_column('wishlistitem', 'price_check_reason')
