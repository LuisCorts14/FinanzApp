"""add notification reads

Revision ID: d3f5b7c9e1a4
Revises: c1e3a5b7d9f2
Create Date: 2026-10-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3f5b7c9e1a4'
down_revision: Union[str, None] = 'c1e3a5b7d9f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notification_reads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=120), nullable=False),
        sa.Column('read_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'key', name='uq_notification_reads_user_key'),
    )
    op.create_index(op.f('ix_notification_reads_user_id'), 'notification_reads', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notification_reads_user_id'), table_name='notification_reads')
    op.drop_table('notification_reads')
