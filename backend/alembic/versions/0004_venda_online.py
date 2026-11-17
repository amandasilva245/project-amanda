"""venda online: pedidos e vínculo do ingresso com o pedido

Só cria a tabela ticket_orders, o tipo orderstatus e a coluna tickets.order_id
(vazia nas vendas existentes). Nenhum dado existente é alterado.

Revision ID: 0004
Revises: 0003
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ORDER_STATUS = ('PENDING', 'PAID', 'EXPIRED', 'FAILED', 'REFUNDED', 'NEEDS_REFUND')


def upgrade() -> None:
    op.create_table(
        'ticket_orders',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('public_token', sa.String(length=64), nullable=False),
        sa.Column('batch_id', sa.String(length=36), nullable=False),
        sa.Column('buyer_name', sa.String(length=255), nullable=False),
        sa.Column('buyer_email', sa.String(length=255), nullable=False),
        sa.Column('buyer_phone', sa.String(length=30), nullable=True),
        sa.Column('accepted_terms_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('is_premium', sa.Boolean(), nullable=False),
        sa.Column('unit_price', sa.Numeric(8, 2), nullable=False),
        sa.Column('total_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('status', sa.Enum(*ORDER_STATUS, name='orderstatus'), nullable=False),
        sa.Column('provider', sa.String(length=30), nullable=False),
        sa.Column('provider_preference_id', sa.String(length=100), nullable=True),
        sa.Column('provider_payment_id', sa.String(length=100), nullable=True),
        sa.Column('provider_status', sa.String(length=40), nullable=True),
        sa.Column('checkout_url', sa.String(length=500), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['batch_id'], ['ticket_batches.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('public_token'),
    )
    op.create_index(op.f('ix_ticket_orders_batch_id'), 'ticket_orders', ['batch_id'], unique=False)
    op.create_index(op.f('ix_ticket_orders_status'), 'ticket_orders', ['status'], unique=False)
    op.create_index(op.f('ix_ticket_orders_provider_payment_id'), 'ticket_orders', ['provider_payment_id'], unique=False)

    op.add_column('tickets', sa.Column('order_id', sa.String(length=36), nullable=True))
    op.create_index(op.f('ix_tickets_order_id'), 'tickets', ['order_id'], unique=False)
    op.create_foreign_key('fk_tickets_order', 'tickets', 'ticket_orders', ['order_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_tickets_order', 'tickets', type_='foreignkey')
    op.drop_index(op.f('ix_tickets_order_id'), table_name='tickets')
    op.drop_column('tickets', 'order_id')
    op.drop_index(op.f('ix_ticket_orders_provider_payment_id'), table_name='ticket_orders')
    op.drop_index(op.f('ix_ticket_orders_status'), table_name='ticket_orders')
    op.drop_index(op.f('ix_ticket_orders_batch_id'), table_name='ticket_orders')
    op.drop_table('ticket_orders')
    sa.Enum(name='orderstatus').drop(op.get_bind(), checkfirst=True)
