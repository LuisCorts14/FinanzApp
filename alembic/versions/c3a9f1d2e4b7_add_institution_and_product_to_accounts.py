"""add institution and product to accounts

Revision ID: c3a9f1d2e4b7
Revises: bfe7d3a1b763
Create Date: 2026-10-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3a9f1d2e4b7'
down_revision: Union[str, None] = 'bfe7d3a1b763'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('accounts', sa.Column('institution_id', sa.String(length=50), nullable=True))
    op.add_column('accounts', sa.Column('product_id', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('accounts', 'product_id')
    op.drop_column('accounts', 'institution_id')
