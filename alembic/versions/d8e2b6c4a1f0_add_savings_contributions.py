"""add savings contributions

Reemplaza savings_goals.manual_current_amount por un historial de abonos. El monto
manual que ya tenía cada meta se conserva como un primer abono "Saldo inicial".

Revision ID: d8e2b6c4a1f0
Revises: c3a9f1d2e4b7
Create Date: 2026-10-24 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8e2b6c4a1f0'
down_revision: Union[str, None] = 'c3a9f1d2e4b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'savings_contributions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('goal_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('note', sa.String(length=200), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['goal_id'], ['savings_goals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.execute(
        """
        INSERT INTO savings_contributions (goal_id, amount, date, note)
        SELECT id, manual_current_amount, created_at::date, 'Saldo inicial'
        FROM savings_goals
        WHERE account_id IS NULL AND manual_current_amount <> 0
        """
    )
    op.drop_column('savings_goals', 'manual_current_amount')


def downgrade() -> None:
    op.add_column(
        'savings_goals',
        sa.Column('manual_current_amount', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0'),
    )
    op.execute(
        """
        UPDATE savings_goals g
        SET manual_current_amount = COALESCE(
            (SELECT SUM(c.amount) FROM savings_contributions c WHERE c.goal_id = g.id), 0
        )
        """
    )
    op.drop_table('savings_contributions')
