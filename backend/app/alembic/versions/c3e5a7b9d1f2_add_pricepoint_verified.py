"""Add verified flag to pricepoint

Readings recorded before product identity was checked can't be told apart
from readings taken off a category listing the link had rotted into, so
they are marked unverified and dropped once a trustworthy one lands.

Revision ID: c3e5a7b9d1f2
Revises: b2d4f6a8c0e1
Create Date: 2026-09-06 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'c3e5a7b9d1f2'
down_revision = 'b2d4f6a8c0e1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'pricepoint',
        sa.Column(
            'verified',
            sa.Boolean(),
            server_default='false',
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column('pricepoint', 'verified')
