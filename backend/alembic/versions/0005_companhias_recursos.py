"""companhias, recursos, tarefas e duração do espetáculo

Só cria as tabelas companies, production_resources e production_tasks e as colunas
productions.duration_minutes e productions.company_id (vazias nas produções
existentes). Nenhum dado existente é alterado.

Revision ID: 0005
Revises: 0004
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0005'
down_revision: Union[str, None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RESOURCE_TYPE = ('COSTUME', 'SET', 'EQUIPMENT', 'PROP', 'OTHER')
RESOURCE_STATUS = ('PLANNED', 'IN_PROGRESS', 'AVAILABLE', 'IN_USE', 'MAINTENANCE')
TASK_STATUS = ('TODO', 'IN_PROGRESS', 'DONE')
TASK_PRIORITY = ('LOW', 'MEDIUM', 'HIGH')


def upgrade() -> None:
    op.create_table(
        'companies',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('responsible_name', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=30), nullable=True),
        sa.Column('city', sa.String(length=120), nullable=True),
        sa.Column('founded_year', sa.Integer(), nullable=True),
        sa.Column('website', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.add_column('productions', sa.Column('duration_minutes', sa.Integer(), nullable=True))
    op.add_column('productions', sa.Column('company_id', sa.String(length=36), nullable=True))
    op.create_index(op.f('ix_productions_company_id'), 'productions', ['company_id'], unique=False)
    op.create_foreign_key('fk_productions_company', 'productions', 'companies', ['company_id'], ['id'], ondelete='SET NULL')

    op.create_table(
        'production_resources',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('production_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.Enum(*RESOURCE_TYPE, name='resourcetype'), nullable=False),
        sa.Column('status', sa.Enum(*RESOURCE_STATUS, name='resourcestatus'), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('supplier', sa.String(length=255), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('responsible_id', sa.String(length=36), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['production_id'], ['productions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['responsible_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_production_resources_production_id'), 'production_resources', ['production_id'], unique=False)
    op.create_index(op.f('ix_production_resources_type'), 'production_resources', ['type'], unique=False)

    op.create_table(
        'production_tasks',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('production_id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('assignee_id', sa.String(length=36), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('status', sa.Enum(*TASK_STATUS, name='taskstatus'), nullable=False),
        sa.Column('priority', sa.Enum(*TASK_PRIORITY, name='taskpriority'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['production_id'], ['productions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assignee_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_production_tasks_production_id'), 'production_tasks', ['production_id'], unique=False)
    op.create_index(op.f('ix_production_tasks_assignee_id'), 'production_tasks', ['assignee_id'], unique=False)
    op.create_index(op.f('ix_production_tasks_status'), 'production_tasks', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_production_tasks_status'), table_name='production_tasks')
    op.drop_index(op.f('ix_production_tasks_assignee_id'), table_name='production_tasks')
    op.drop_index(op.f('ix_production_tasks_production_id'), table_name='production_tasks')
    op.drop_table('production_tasks')
    sa.Enum(name='taskpriority').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='taskstatus').drop(op.get_bind(), checkfirst=True)
    op.drop_index(op.f('ix_production_resources_type'), table_name='production_resources')
    op.drop_index(op.f('ix_production_resources_production_id'), table_name='production_resources')
    op.drop_table('production_resources')
    sa.Enum(name='resourcestatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='resourcetype').drop(op.get_bind(), checkfirst=True)
    op.drop_constraint('fk_productions_company', 'productions', type_='foreignkey')
    op.drop_index(op.f('ix_productions_company_id'), table_name='productions')
    op.drop_column('productions', 'company_id')
    op.drop_column('productions', 'duration_minutes')
    op.drop_table('companies')
