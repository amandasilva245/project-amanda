"""ingressos: premium, check-in e cancelamento

Só adiciona colunas e índice; nenhum dado existente é alterado. O contador
tickets_sold dos lotes antigos é preservado como está.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-17 22:00:48.947334

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tickets', sa.Column('is_premium', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('tickets', sa.Column('checked_in_by_id', sa.String(length=36), nullable=True))
    op.add_column('tickets', sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_tickets_status'), 'tickets', ['status'], unique=False)
    op.create_foreign_key('fk_tickets_checked_in_by', 'tickets', 'users', ['checked_in_by_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_tickets_checked_in_by', 'tickets', type_='foreignkey')
    op.drop_index(op.f('ix_tickets_status'), table_name='tickets')
    op.drop_column('tickets', 'cancelled_at')
    op.drop_column('tickets', 'checked_in_by_id')
    op.drop_column('tickets', 'is_premium')
