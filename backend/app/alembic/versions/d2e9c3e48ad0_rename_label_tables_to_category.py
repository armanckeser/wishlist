"""Rename label tables to category

Revision ID: d2e9c3e48ad0
Revises: cf09385e454f
Create Date: 2026-01-14 22:51:42.403651

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'd2e9c3e48ad0'
down_revision = 'cf09385e454f'
branch_labels = None
depends_on = None


def upgrade():
    # Rename tables (preserves data)
    op.rename_table('label', 'category')
    op.rename_table('itemlabel', 'itemcategory')

    # Rename the foreign key column in itemcategory
    op.alter_column('itemcategory', 'label_id', new_column_name='category_id')

    # Update foreign key constraints to use new names
    # Drop old constraints
    op.drop_constraint('itemlabel_label_id_fkey', 'itemcategory', type_='foreignkey')
    op.drop_constraint('itemlabel_item_id_fkey', 'itemcategory', type_='foreignkey')
    op.drop_constraint('label_parent_id_fkey', 'category', type_='foreignkey')

    # Create new constraints with correct references
    op.create_foreign_key(
        'itemcategory_category_id_fkey',
        'itemcategory', 'category',
        ['category_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'itemcategory_item_id_fkey',
        'itemcategory', 'wishlistitem',
        ['item_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'category_parent_id_fkey',
        'category', 'category',
        ['parent_id'], ['id']
    )


def downgrade():
    # Drop new constraints
    op.drop_constraint('category_parent_id_fkey', 'category', type_='foreignkey')
    op.drop_constraint('itemcategory_item_id_fkey', 'itemcategory', type_='foreignkey')
    op.drop_constraint('itemcategory_category_id_fkey', 'itemcategory', type_='foreignkey')

    # Rename column back
    op.alter_column('itemcategory', 'category_id', new_column_name='label_id')

    # Rename tables back
    op.rename_table('itemcategory', 'itemlabel')
    op.rename_table('category', 'label')

    # Recreate old constraints
    op.create_foreign_key(
        'label_parent_id_fkey',
        'label', 'label',
        ['parent_id'], ['id']
    )
    op.create_foreign_key(
        'itemlabel_item_id_fkey',
        'itemlabel', 'wishlistitem',
        ['item_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'itemlabel_label_id_fkey',
        'itemlabel', 'label',
        ['label_id'], ['id'],
        ondelete='CASCADE'
    )
