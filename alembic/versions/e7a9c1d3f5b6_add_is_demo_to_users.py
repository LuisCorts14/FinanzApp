"""add is_demo to users

Revision ID: e7a9c1d3f5b6
Revises: d3f5b7c9e1a4
Create Date: 2026-10-27 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7a9c1d3f5b6'
down_revision: Union[str, None] = 'd3f5b7c9e1a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'is_demo')
