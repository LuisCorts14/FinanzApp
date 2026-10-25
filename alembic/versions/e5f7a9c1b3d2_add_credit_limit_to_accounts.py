"""add credit limit to accounts

Revision ID: e5f7a9c1b3d2
Revises: d8e2b6c4a1f0
Create Date: 2026-10-25 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f7a9c1b3d2'
down_revision: Union[str, None] = 'd8e2b6c4a1f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('accounts', sa.Column('credit_limit', sa.Numeric(precision=12, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column('accounts', 'credit_limit')
