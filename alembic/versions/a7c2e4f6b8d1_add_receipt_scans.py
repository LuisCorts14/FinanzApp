"""add receipt scans

Revision ID: a7c2e4f6b8d1
Revises: f1a3c5e7d9b2
Create Date: 2026-10-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c2e4f6b8d1'
down_revision: Union[str, None] = 'f1a3c5e7d9b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'receipt_scans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_receipt_scans_user_id'), 'receipt_scans', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_receipt_scans_user_id'), table_name='receipt_scans')
    op.drop_table('receipt_scans')
