"""Add automatic price tracking

Revision ID: a4c9e1f2b7d3
Revises: 18c81d2a00b6
Create Date: 2026-09-03 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic_postgresql_enum import TableReference

# revision identifiers, used by Alembic.
revision = 'a4c9e1f2b7d3'
down_revision = '18c81d2a00b6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'pricepoint',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('item_id', sa.Uuid(), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('price_cents', sa.Integer(), nullable=False),
        sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(length=8), nullable=True),
        sa.Column(
            'source',
            sa.Enum('INITIAL', 'SCHEDULED', 'MANUAL', name='pricepointsource'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(['item_id'], ['wishlistitem.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_pricepoint_item_recorded', 'pricepoint', ['item_id', 'recorded_at'], unique=False
    )

    op.add_column(
        'wishlistitem',
        sa.Column('price_tracking_enabled', sa.Boolean(), server_default='false', nullable=False),
    )
    op.add_column('wishlistitem', sa.Column('price_verified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('wishlistitem', sa.Column('price_checked_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        'wishlistitem',
        sa.Column('price_check_failures', sa.Integer(), server_default='0', nullable=False),
    )
    op.add_column(
        'wishlistitem',
        sa.Column('price_check_error', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
    )
    op.add_column('wishlistitem', sa.Column('price_tracking_paused_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('wishlistitem', sa.Column('original_price_cents', sa.Integer(), nullable=True))
    op.add_column('wishlistitem', sa.Column('lowest_price_cents', sa.Integer(), nullable=True))
    op.add_column('wishlistitem', sa.Column('previous_price_cents', sa.Integer(), nullable=True))
    op.add_column('wishlistitem', sa.Column('price_changed_at', sa.DateTime(timezone=True), nullable=True))

    op.sync_enum_values(
        enum_schema='public',
        enum_name='notificationtype',
        new_values=[
            'GIFT_RECEIVED', 'THANK_YOU', 'FREEZE_EXPIRING', 'BUDGET_MILESTONE',
            'DELIVERY_INFO_RECEIVED', 'DELIVERY_IN_TRANSIT', 'DELIVERY_OUT_FOR_DELIVERY',
            'DELIVERY_DELIVERED', 'DELIVERY_EXCEPTION', 'DELIVERY_EXPIRED',
            'PRICE_DROP', 'PRICE_INCREASE', 'PRICE_TRACKING_PAUSED',
        ],
        affected_columns=[TableReference(table_schema='public', table_name='notification', column_name='notification_type')],
        enum_values_to_rename=[],
    )


def downgrade():
    op.sync_enum_values(
        enum_schema='public',
        enum_name='notificationtype',
        new_values=[
            'GIFT_RECEIVED', 'THANK_YOU', 'FREEZE_EXPIRING', 'BUDGET_MILESTONE',
            'DELIVERY_INFO_RECEIVED', 'DELIVERY_IN_TRANSIT', 'DELIVERY_OUT_FOR_DELIVERY',
            'DELIVERY_DELIVERED', 'DELIVERY_EXCEPTION', 'DELIVERY_EXPIRED',
        ],
        affected_columns=[TableReference(table_schema='public', table_name='notification', column_name='notification_type')],
        enum_values_to_rename=[],
    )

    op.drop_column('wishlistitem', 'price_changed_at')
    op.drop_column('wishlistitem', 'previous_price_cents')
    op.drop_column('wishlistitem', 'lowest_price_cents')
    op.drop_column('wishlistitem', 'original_price_cents')
    op.drop_column('wishlistitem', 'price_tracking_paused_at')
    op.drop_column('wishlistitem', 'price_check_error')
    op.drop_column('wishlistitem', 'price_check_failures')
    op.drop_column('wishlistitem', 'price_checked_at')
    op.drop_column('wishlistitem', 'price_verified_at')
    op.drop_column('wishlistitem', 'price_tracking_enabled')

    op.drop_index('ix_pricepoint_item_recorded', table_name='pricepoint')
    op.drop_table('pricepoint')
    sa.Enum(name='pricepointsource').drop(op.get_bind(), checkfirst=True)
