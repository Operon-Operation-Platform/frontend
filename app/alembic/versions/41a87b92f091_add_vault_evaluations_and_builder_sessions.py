"""Add vault, evaluations, and builder sessions

Revision ID: 41a87b92f091
Revises: 306222f3747f
Create Date: 2026-10-20 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '41a87b92f091'
down_revision: Union[str, Sequence[str], None] = '306222f3747f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add columns to agents table if not already present
    try:
        op.add_column('agents', sa.Column('eval_status', sa.String(), nullable=False, server_default='pending'))
    except Exception:
        pass
    try:
        op.add_column('agents', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='0'))
    except Exception:
        pass

    # 2. Create credential_vault table
    try:
        op.create_table(
            'credential_vault',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('provider_key', sa.String(), nullable=False),
            sa.Column('connection_id', sa.String(), nullable=True),
            sa.Column('encrypted_payload', sa.String(), nullable=False),
            sa.Column('key_version', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_credential_vault_org', 'credential_vault', ['organization_id'])
        op.create_index('ix_credential_vault_provider', 'credential_vault', ['provider_key'])
    except Exception:
        pass

    # 3. Create evaluation_scenarios table
    try:
        op.create_table(
            'evaluation_scenarios',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('agent_id', sa.String(), sa.ForeignKey('agents.id', ondelete='CASCADE'), nullable=True),
            sa.Column('template_key', sa.String(), nullable=True),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('input_payload', sa.JSON(), nullable=False),
            sa.Column('expected_tools', sa.JSON(), nullable=True),
            sa.Column('prohibited_tools', sa.JSON(), nullable=True),
            sa.Column('deterministic_rules', sa.JSON(), nullable=True),
            sa.Column('rubric', sa.String(), nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_eval_scenarios_org', 'evaluation_scenarios', ['organization_id'])
        op.create_index('ix_eval_scenarios_agent', 'evaluation_scenarios', ['agent_id'])
    except Exception:
        pass

    # 4. Create evaluation_results table
    try:
        op.create_table(
            'evaluation_results',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('agent_id', sa.String(), sa.ForeignKey('agents.id', ondelete='CASCADE'), nullable=False),
            sa.Column('scenario_id', sa.String(), sa.ForeignKey('evaluation_scenarios.id', ondelete='CASCADE'), nullable=False),
            sa.Column('run_id', sa.String(), sa.ForeignKey('agent_runs.id', ondelete='SET NULL'), nullable=True),
            sa.Column('status', sa.String(), nullable=False),
            sa.Column('deterministic_checks', sa.JSON(), nullable=True),
            sa.Column('llm_judge_score', sa.Float(), nullable=True),
            sa.Column('llm_judge_reasoning', sa.String(), nullable=True),
            sa.Column('judge_model', sa.String(), nullable=True),
            sa.Column('evidence', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_eval_results_org', 'evaluation_results', ['organization_id'])
        op.create_index('ix_eval_results_agent', 'evaluation_results', ['agent_id'])
    except Exception:
        pass

    # 5. Create agent_builder_sessions table
    try:
        op.create_table(
            'agent_builder_sessions',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('user_id', sa.String(), sa.ForeignKey('platform_users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('thread_id', sa.String(), unique=True, nullable=False),
            sa.Column('status', sa.String(), nullable=False, server_default='in_progress'),
            sa.Column('current_step', sa.String(), nullable=False, server_default='understanding'),
            sa.Column('plan_steps', sa.JSON(), nullable=True),
            sa.Column('agent_draft_spec', sa.JSON(), nullable=True),
            sa.Column('pending_interruption', sa.JSON(), nullable=True),
            sa.Column('chat_history', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_builder_sessions_org', 'agent_builder_sessions', ['organization_id'])
        op.create_index('ix_builder_sessions_thread', 'agent_builder_sessions', ['thread_id'])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_table('agent_builder_sessions')
        op.drop_table('evaluation_results')
        op.drop_table('evaluation_scenarios')
        op.drop_table('credential_vault')
    except Exception:
        pass
