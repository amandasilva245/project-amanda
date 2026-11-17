"""agenda: cancelamento booleano e presenca

Conversões sem perda de dados:
* schedules.is_cancelled: texto 'S'/'N' -> booleano ('S', 'Y', '1', 'T' = verdadeiro).
* schedule_participant_details.status: nulos viram 'invited' antes do NOT NULL.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-17 21:52:03.614332

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE schedule_participant_details SET status = 'invited' WHERE status IS NULL")
    op.alter_column('schedule_participant_details', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=False)
    op.create_index(op.f('ix_schedule_participant_details_schedule_id'), 'schedule_participant_details', ['schedule_id'], unique=False)
    op.create_index(op.f('ix_schedule_participant_details_user_id'), 'schedule_participant_details', ['user_id'], unique=False)
    op.create_unique_constraint('uq_schedule_attendee', 'schedule_participant_details', ['schedule_id', 'user_id'])
    op.add_column('schedules', sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('schedules', sa.Column('cancel_reason', sa.String(length=500), nullable=True))
    op.alter_column('schedules', 'is_cancelled', server_default=None)
    op.alter_column('schedules', 'is_cancelled',
               existing_type=sa.VARCHAR(length=1),
               type_=sa.Boolean(),
               postgresql_using="COALESCE(UPPER(is_cancelled) IN ('S', 'Y', '1', 'T'), false)")
    op.execute("UPDATE schedules SET is_cancelled = false WHERE is_cancelled IS NULL")
    op.alter_column('schedules', 'is_cancelled', nullable=False, server_default=sa.false())
    op.create_index(op.f('ix_schedules_start_time'), 'schedules', ['start_time'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_schedules_start_time'), table_name='schedules')
    op.alter_column('schedules', 'is_cancelled', server_default=None, nullable=True)
    op.alter_column('schedules', 'is_cancelled',
               existing_type=sa.Boolean(),
               type_=sa.VARCHAR(length=1),
               postgresql_using="CASE WHEN is_cancelled THEN 'S' ELSE 'N' END")
    op.drop_column('schedules', 'cancel_reason')
    op.drop_column('schedules', 'cancelled_at')
    op.drop_constraint('uq_schedule_attendee', 'schedule_participant_details', type_='unique')
    op.drop_index(op.f('ix_schedule_participant_details_user_id'), table_name='schedule_participant_details')
    op.drop_index(op.f('ix_schedule_participant_details_schedule_id'), table_name='schedule_participant_details')
    op.alter_column('schedule_participant_details', 'status',
               existing_type=sa.VARCHAR(length=20),
               nullable=True)
