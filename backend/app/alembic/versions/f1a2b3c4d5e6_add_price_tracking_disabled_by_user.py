"""Add price_tracking_disabled_by_user to wishlistitem

Revision ID: f1a2b3c4d5e6
Revises: a4c9e1f2b7d3
Create Date: 2026-09-05 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'a4c9e1f2b7d3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'wishlistitem',
        sa.Column(
            'price_tracking_disabled_by_user',
            sa.Boolean(),
            server_default='false',
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column('wishlistitem', 'price_tracking_disabled_by_user')
