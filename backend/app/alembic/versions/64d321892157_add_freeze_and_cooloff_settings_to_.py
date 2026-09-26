"""Add freeze and cooloff settings to budget

Revision ID: 64d321892157
Revises: 803668bde680
Create Date: 2026-01-05 09:23:11.289987

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '64d321892157'
down_revision = '803668bde680'
branch_labels = None
depends_on = None


def upgrade():
    # Freeze mechanism columns
    op.add_column('budget', sa.Column('freeze_until', sa.DateTime(), nullable=True))
    op.add_column('budget', sa.Column('stashed_monthly_rate_cents', sa.Integer(), nullable=True))
    op.add_column('budget', sa.Column('freeze_penalty_days', sa.Integer(), nullable=False, server_default='7'))

    # Cool-off settings columns
    op.add_column('budget', sa.Column('cooloff_scaling_cents', sa.Integer(), nullable=True))
    op.add_column('budget', sa.Column('cooloff_scaling_days', sa.Integer(), nullable=False, server_default='3'))
    op.add_column('budget', sa.Column('cooloff_min_threshold_cents', sa.Integer(), nullable=True))
    op.add_column('budget', sa.Column('cooloff_min_threshold_days', sa.Integer(), nullable=False, server_default='7'))
    op.add_column('budget', sa.Column('cooloff_base_days', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('budget', 'cooloff_base_days')
    op.drop_column('budget', 'cooloff_min_threshold_days')
    op.drop_column('budget', 'cooloff_min_threshold_cents')
    op.drop_column('budget', 'cooloff_scaling_days')
    op.drop_column('budget', 'cooloff_scaling_cents')
    op.drop_column('budget', 'freeze_penalty_days')
    op.drop_column('budget', 'stashed_monthly_rate_cents')
    op.drop_column('budget', 'freeze_until')
