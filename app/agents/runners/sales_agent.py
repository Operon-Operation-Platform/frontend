"""
Operon Sales Agent Runner
Handles inbound lead qualification, account enrichment, CRM updates,
and personalized sales follow-up drafts with human approval for deal changes.
"""

import logging
import time
import uuid
from typing import Any, Dict
from agents.context import TenantContext
from database.postgres.database import get_db_ctx
from database.postgres.models import AgentRun, ExecutionStep, Approval, AgentTask
from services.llm_provider import DEFAULT_MODEL, generate_chat_response
from services.tool_registry import tool_registry

logger = logging.getLogger("operon.sales_agent")


class OperonSalesAgentRunner:
    @classmethod
    async def execute(cls, context: TenantContext, payload: Dict[str, Any]) -> Dict[str, Any]:
        start_time = time.time()
        run_id = context.run_id
        org_id = context.organization_id
        agent_id = context.agent_id

        lead_name = payload.get("lead_name", "").strip()
        company = payload.get("company", "").strip()
        budget = payload.get("budget", "").strip()
        inquiry = payload.get("inquiry", "")

        with get_db_ctx() as db:
            run = AgentRun(
                id=run_id,
                organization_id=org_id,
                agent_id=agent_id,
                version_id=context.version_id,
                status="running",
                trigger_type="manual",
                input_payload=payload,
            )
            db.add(run)
            db.commit()

        # Step 1: Lead Qualification
        step_started = time.perf_counter()
        score = 88 if "enterprise" in company.lower() or "$50k" in budget else 65
        qualification = "HIGH_VALUE_PROSPECT" if score >= 80 else "STANDARD_PROSPECT"
        cls._record_step(run_id, "Lead Qualification", "completed", (time.perf_counter() - step_started) * 1000)

        # Step 2: Knowledge & Playbook Match
        step_started = time.perf_counter()
        playbook_res = await tool_registry.execute_tool(
            context, "search_knowledge", {"query": f"Sales pitch {company} {inquiry}", "top_k": 2}
        )
        cls._record_step(run_id, "Playbook Retrieval", "completed", (time.perf_counter() - step_started) * 1000)

        # Step 3: Draft Follow-up
        step_started = time.perf_counter()
        try:
            draft_email = await generate_chat_response(
                [
                    {
                        "role": "system",
                        "content": (
                            "You are the configured sales agent. Follow these operating instructions:\n"
                            f"{context.instructions or 'Respond accurately and do not invent prospect details.'}\n"
                            "Draft a concise, personalized follow-up based only on the supplied prospect information "
                            "and inquiry. Do not invent commitments, product capabilities, or meeting availability."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Lead: {lead_name or 'Not provided'}\nCompany: {company or 'Not provided'}\n"
                            f"Budget: {budget or 'Not provided'}\nInquiry: {inquiry or 'Not provided'}\n"
                            f"Relevant playbook results: {playbook_res.get('result', {})}"
                        ),
                    },
                ],
                model=(context.model_config_settings or {}).get("model") or DEFAULT_MODEL,
            )
        except Exception:
            cls._record_step(run_id, "Draft Follow-up", "failed", (time.perf_counter() - step_started) * 1000)
            with get_db_ctx() as db:
                run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
                if run:
                    run.status = "failed"
                    run.error_message = "Configured model could not generate the follow-up draft."
                    db.commit()
            raise RuntimeError("The configured model could not generate the sales follow-up.") from None
        cls._record_step(run_id, "Draft Follow-up", "completed", (time.perf_counter() - step_started) * 1000)

        # Step 4: Deal Stage Approval if deal stage modification requested
        if payload.get("auto_advance_crm_deal"):
            appr_id = f"appr-{uuid.uuid4().hex[:12]}"
            with get_db_ctx() as db:
                appr = Approval(
                    id=appr_id,
                    organization_id=org_id,
                    run_id=run_id,
                    action_type="modify_deal_stage",
                    description=f"Advance CRM deal for {company} to Qualified Opportunity",
                    status="pending",
                    payload={"company": company, "stage": "Proposal/Review", "lead_score": score},
                )
                db.add(appr)
                run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
                if run:
                    run.status = "waiting_for_approval"
                db.commit()
            return {"run_id": run_id, "status": "waiting_for_approval", "approval_id": appr_id}

        latency = (time.time() - start_time) * 1000
        with get_db_ctx() as db:
            run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
            if run:
                run.status = "succeeded"
                run.latency_ms = latency
                run.token_count = 380
                run.output_payload = {
                    "lead_score": score,
                    "qualification": qualification,
                    "draft_email": draft_email,
                }
            task = AgentTask(
                organization_id=org_id,
                run_id=run_id,
                title=f"Sales Follow-up: {lead_name or 'Unspecified lead'}",
                status="completed",
                priority="high",
                outcome="Generated a follow-up draft from the supplied lead information.",
            )
            db.add(task)
            db.commit()

        return {
            "run_id": run_id,
            "status": "succeeded",
            "lead_score": score,
            "qualification": qualification,
            "draft_email": draft_email,
            "latency_ms": latency,
        }

    @classmethod
    def _record_step(cls, run_id: str, name: str, status: str, duration_ms: float):
        try:
            with get_db_ctx() as db:
                step = ExecutionStep(run_id=run_id, step_name=name, status=status, duration_ms=duration_ms)
                db.add(step)
                db.commit()
        except Exception:
            pass
