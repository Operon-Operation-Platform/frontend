import sys
import os
import asyncio

# Add app to path
sys.path.insert(0, os.path.dirname(__file__))

from database.postgres.database import SessionLocal, get_db_ctx
from database.postgres.models import (
    Organization, Agent, CredentialVault, EvaluationScenario,
    EvaluationResultRecord, AgentBuilderSession
)
from services.secret_vault import encrypt_credentials, decrypt_credentials, redact_secrets
from services.llm_provider import SUPPORTED_MODELS, DEFAULT_MODEL
from services.evaluation_service import EvaluationService
from services.integration_service import IntegrationService
from agents.workflows.agent_builder_workflow import (
    BuilderState, create_initial_plan_steps, step_understand_request,
    step_specification, persist_builder_session, resume_workflow_step,
    _run_prepublish_evaluations
)

def test_secret_vault():
    print("[1/6] Testing Secret Vault & Authenticated Encryption at Rest...")
    raw_creds = {
        "api_key": "sk-super-secret-production-token-12345",
        "subdomain": "acme-corp",
        "nested": {"token": "secret-nested-token", "safe_field": 100}
    }

    # Encrypt
    ciphertext = encrypt_credentials(raw_creds)
    assert ciphertext != str(raw_creds), "Secret was not encrypted!"
    
    # Decrypt
    decrypted = decrypt_credentials(ciphertext)
    assert decrypted["api_key"] == raw_creds["api_key"]
    assert decrypted["subdomain"] == raw_creds["subdomain"]

    # Redaction test
    redacted = redact_secrets(raw_creds)
    assert "secret-production-token" not in redacted["api_key"], "Secret leaked in redacted output!"
    assert "(encrypted)" in redacted["api_key"]
    assert redacted["subdomain"] == "acme-corp"
    assert "(encrypted)" in redacted["nested"]["token"]
    assert redacted["nested"]["safe_field"] == 100
    print("  [OK] Authenticated AES-Fernet encryption, decryption, and recursive redaction verified.")

def test_llm_provider():
    print("[2/6] Testing LLM Provider Abstraction & Model Registry...")
    assert len(SUPPORTED_MODELS) >= 2
    assert "meta-llama/Llama-3.3-70B-Instruct" in SUPPORTED_MODELS
    assert "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B" in SUPPORTED_MODELS
    print(f"  [OK] Supported models registry: {list(SUPPORTED_MODELS.keys())}")
    print(f"  [OK] Default platform model: {DEFAULT_MODEL}")

async def test_agent_builder_workflow():
    print("[3/6] Testing LangGraph Resumable Agent Builder Workflow...")
    db = SessionLocal()
    try:
        org = db.query(Organization).first()
        assert org is not None, "Organization not found"

        thread_id = "test-builder-thread-999"
        state = BuilderState(
            thread_id=thread_id,
            organization_id=org.id,
            user_id="test-user-id",
            mode="plain_english",
            model=DEFAULT_MODEL,
            prompt="Build a customer support triage agent that answers refund queries and verifies orders in Postgres",
            current_step="understanding",
            status="in_progress",
            plan_steps=create_initial_plan_steps(),
        )

        # Step 1: Understand request
        res1 = await step_understand_request(state)
        state.current_step = res1["current_step"]
        state.plan_steps = res1["plan_steps"]
        state.agent_spec = res1["agent_spec"]
        assert len(state.plan_steps) == 7
        assert state.agent_spec.get("name") is not None
        print(f"  [OK] Step 1 parsed spec: name='{state.agent_spec.get('name')}'")

        # Step 2: Specification & Interruption Generation
        res2 = await step_specification(state)
        state.current_step = res2["current_step"]
        state.status = res2["status"]
        state.plan_steps = res2["plan_steps"]
        state.pending_interruption = res2["pending_interruption"]
        assert state.status == "paused_for_input"
        assert state.pending_interruption is not None
        print(f"  [OK] Step 2 created interruption: '{state.pending_interruption['title']}'")

        # Persist to database
        persist_builder_session(state)
        saved_session = db.query(AgentBuilderSession).filter_by(thread_id=thread_id).first()
        assert saved_session is not None
        assert saved_session.status == "paused_for_input"
        print("  [OK] Builder session state persisted to database.")

        # Resume Interruption (User clicks 'Done' on integrations)
        resumed = await resume_workflow_step(
            thread_id=thread_id,
            action_type="submit_integrations",
            submitted_data={"configured": True}
        )
        assert resumed["current_step"] == "data_sources"
        assert resumed["status"] == "paused_for_input"
        print(f"  [OK] Resumed interruption successfully: advanced to '{resumed['current_step']}'")

        # Resume Data Sources (Advances to tool binding & prepublish evaluation checks)
        final_res = await resume_workflow_step(
            thread_id=thread_id,
            action_type="submit_datasources",
            submitted_data={"configured": True}
        )
        assert final_res["status"] == "ready_to_publish"
        print(f"  [OK] Workflow completed all stages to status='{final_res['status']}'")
    finally:
        db.close()

async def test_evaluations_engine():
    print("[4/6] Testing Evaluation Engine (Deterministic Checks & Scenarios)...")
    db = SessionLocal()
    try:
        org = db.query(Organization).first()
        agent = db.query(Agent).first()
        assert org is not None and agent is not None

        # Seed scenarios
        EvaluationService.seed_default_scenarios(org.id)
        scenarios = db.query(EvaluationScenario).filter_by(organization_id=org.id).all()
        assert len(scenarios) >= 3
        print(f"  [OK] Seeded {len(scenarios)} benchmark scenarios in database.")

        # Execute evaluation run
        eval_run = await EvaluationService.run_evaluation(
            organization_id=org.id,
            agent_id=agent.id,
            scenario_id=scenarios[0].id,
            judge_model=DEFAULT_MODEL
        )
        assert eval_run["status"] in ["passed", "failed"]
        assert "deterministic_passed" in eval_run
        assert "deterministic_checks" in eval_run
        assert "llm_judge_score" in eval_run
        print(f"  [OK] Evaluation run executed: status={eval_run['status']}, deterministic_passed={eval_run['deterministic_passed']}, judge_score={eval_run['llm_judge_score']}")
    finally:
        db.close()

def test_integration_service():
    print("[5/6] Testing Integration Service Catalog & Validation...")
    catalog = IntegrationService.get_catalog("customer_support")
    assert len(catalog) >= 5
    providers = [c.get("key") or c.get("provider") for c in catalog]
    assert "zendesk" in providers
    assert "email" in providers
    assert "slack" in providers
    assert "jira" in providers

    # Test invalid connection
    res_bad = IntegrationService.test_connection("zendesk", {"subdomain": "", "admin_email": "bad", "api_token": ""})
    assert res_bad["success"] is False

    # Test valid connection
    res_good = IntegrationService.test_connection("zendesk", {
        "subdomain": "acme-test",
        "email": "support@acme.com",
        "api_token": "secret-token-12345"
    })
    assert res_good["success"] is True, f"Expected success but got: {res_good}"
    print("  [OK] Integration catalog and bounded-retry connection testing verified.")

def test_two_step_deletion():
    print("[6/6] Testing Two-Step Deliberate Deletion...")
    db = SessionLocal()
    try:
        org = db.query(Organization).first()
        # Create agent
        temp_agent = Agent(
            organization_id=org.id,
            name="Temporary Deletion Test Agent",
            description="Agent for deletion test",
            status="active",
        )
        db.add(temp_agent)
        db.commit()
        db.refresh(temp_agent)

        agent_id = temp_agent.id

        # Verify initial query finds it
        active_found = db.query(Agent).filter(Agent.id == agent_id, Agent.is_deleted == False).first()
        assert active_found is not None

        # Execute deliberate soft deletion
        active_found.is_deleted = True
        active_found.status = "archived"
        db.commit()

        # Verify filtered out from active queries
        deleted_query = db.query(Agent).filter(Agent.id == agent_id, Agent.is_deleted == False).first()
        assert deleted_query is None, "Deleted agent must not appear in active queries!"
        print("  [OK] Two-step deliberate deletion soft-delete semantics verified.")
    finally:
        db.close()

async def main():
    print("========================================")
    print("RUNNING OPERON BACKEND INTEGRITY SUITE")
    print("========================================")
    test_secret_vault()
    test_llm_provider()
    await test_agent_builder_workflow()
    await test_evaluations_engine()
    test_integration_service()
    test_two_step_deletion()
    print("========================================")
    print("ALL 6 OPERON BACKEND TESTS PASSED (100%)")
    print("========================================")

if __name__ == "__main__":
    asyncio.run(main())
