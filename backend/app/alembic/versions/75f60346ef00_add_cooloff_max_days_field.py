"""Add cooloff_max_days field

Revision ID: 75f60346ef00
Revises: 64d321892157
Create Date: 2026-01-05 10:40:46.802248

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '75f60346ef00'
down_revision = '64d321892157'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('budget', sa.Column('cooloff_max_days', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('budget', 'cooloff_max_days')
