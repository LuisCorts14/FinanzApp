"""add rate limit hits

Revision ID: f9b1d3e5a7c8
Revises: e7a9c1d3f5b6
Create Date: 2026-10-27 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9b1d3e5a7c8'
down_revision: Union[str, None] = 'e7a9c1d3f5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'rate_limit_hits',
        sa.Column('key', sa.String(length=200), nullable=False),
        sa.Column('window_start', sa.DateTime(), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('key', 'window_start'),
    )


def downgrade() -> None:
    op.drop_table('rate_limit_hits')
