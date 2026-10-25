"""add user settings

Revision ID: c1e3a5b7d9f2
Revises: b9d4f6a8c0e2
Create Date: 2026-10-26 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1e3a5b7d9f2'
down_revision: Union[str, None] = 'b9d4f6a8c0e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('payday', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('savings_target_pct', sa.Integer(), server_default='20', nullable=False))
    op.add_column('users', sa.Column('budget_alert_pct', sa.Integer(), server_default='80', nullable=False))
    op.add_column('users', sa.Column('default_account_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'default_account_id')
    op.drop_column('users', 'budget_alert_pct')
    op.drop_column('users', 'savings_target_pct')
    op.drop_column('users', 'payday')
