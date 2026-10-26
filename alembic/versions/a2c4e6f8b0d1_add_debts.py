"""add debts and debt plan fields

Revision ID: a2c4e6f8b0d1
Revises: f9b1d3e5a7c8
Create Date: 2026-10-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2c4e6f8b0d1'
down_revision: Union[str, None] = 'f9b1d3e5a7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'debts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('kind', sa.String(length=30), nullable=False),
        sa.Column('balance', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('interest_rate', sa.Numeric(precision=6, scale=3), nullable=False),
        sa.Column('minimum_payment', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.add_column('accounts', sa.Column('interest_rate', sa.Numeric(precision=6, scale=3), nullable=True))
    op.add_column('accounts', sa.Column('minimum_payment', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column('users', sa.Column('debt_monthly_budget', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column(
        'users', sa.Column('debt_strategy', sa.String(length=20), server_default='avalanche', nullable=False)
    )


def downgrade() -> None:
    op.drop_column('users', 'debt_strategy')
    op.drop_column('users', 'debt_monthly_budget')
    op.drop_column('accounts', 'minimum_payment')
    op.drop_column('accounts', 'interest_rate')
    op.drop_table('debts')
