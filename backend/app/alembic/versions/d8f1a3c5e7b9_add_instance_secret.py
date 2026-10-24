"""Add instance_secret

Keys a self-hosted install generates for itself on first start (the session
signing key, the Web Push key pair), so an install from an app store needs no
setup. An environment value always wins and is never written here.

Revision ID: d8f1a3c5e7b9
Revises: c3e5a7b9d1f2
Create Date: 2026-10-24 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d8f1a3c5e7b9"
down_revision = "c3e5a7b9d1f2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "instance_secret",
        sa.Column("key", sa.String(), primary_key=True),
        sa.Column("value", sa.String(), nullable=False),
    )


def downgrade():
    op.drop_table("instance_secret")
