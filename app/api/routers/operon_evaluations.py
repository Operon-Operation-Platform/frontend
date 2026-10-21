"""
Operon Truthful Evaluation Router
Provides endpoints for evaluation scenarios, test triggers,
detailed deterministic and judge scoring breakdowns, and agent audit trails.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.postgres.database import get_db
from database.postgres.models import (
    Agent,
    EvaluationScenario,
    EvaluationResultRecord,
)
from api.routers.operon_auth import get_current_tenant_session
from services.evaluation_service import EvaluationService
from services.llm_provider import SUPPORTED_MODELS, DEFAULT_MODEL

router = APIRouter(prefix="/api/v1/evaluations", tags=["Operon Evaluations"])


class RunEvaluationRequest(BaseModel):
    agent_id: str
    scenario_id: Optional[str] = None
    judge_model: str = DEFAULT_MODEL


class CreateScenarioRequest(BaseModel):
    agent_id: Optional[str] = None
    template_key: Optional[str] = None
    name: str
    description: Optional[str] = None
    input_payload: Dict[str, Any]
    expected_tools: Optional[List[str]] = None
    prohibited_tools: Optional[List[str]] = None
    deterministic_rules: Optional[Dict[str, Any]] = None
    rubric: Optional[str] = None


@router.get("/models")
def get_supported_eval_models():
    """Return available models for evaluation judging."""
    return [
        {"id": k, **v} for k, v in SUPPORTED_MODELS.items()
    ]


@router.get("/scenarios")
def list_scenarios(
    agent_id: Optional[str] = None,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """List evaluation scenarios for the workspace."""
    org = session["organization"]

    query = db.query(EvaluationScenario).filter(EvaluationScenario.organization_id == org.id)
    if agent_id:
        query = query.filter((EvaluationScenario.agent_id == agent_id) | (EvaluationScenario.agent_id == None))

    scenarios = query.order_by(EvaluationScenario.created_at.desc()).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "template_key": s.template_key,
            "agent_id": s.agent_id,
            "input_payload": s.input_payload,
            "expected_tools": s.expected_tools,
            "prohibited_tools": s.prohibited_tools,
            "deterministic_rules": s.deterministic_rules,
            "rubric": s.rubric,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in scenarios
    ]


@router.post("/scenarios", status_code=status.HTTP_201_CREATED)
def create_scenario(
    req: CreateScenarioRequest,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Create a new evaluation scenario."""
    org = session["organization"]
    scenario = EvaluationScenario(
        organization_id=org.id,
        agent_id=req.agent_id,
        template_key=req.template_key,
        name=req.name,
        description=req.description,
        input_payload=req.input_payload,
        expected_tools=req.expected_tools or [],
        prohibited_tools=req.prohibited_tools or [],
        deterministic_rules=req.deterministic_rules or {},
        rubric=req.rubric or "",
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return {"id": scenario.id, "name": scenario.name, "message": "Evaluation scenario created"}


@router.post("/run", status_code=status.HTTP_200_OK)
async def execute_evaluation(
    req: RunEvaluationRequest,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
):
    """Trigger a truthful evaluation test for an agent."""
    org = session["organization"]
    try:
        res = await EvaluationService.run_evaluation(
            organization_id=org.id,
            agent_id=req.agent_id,
            scenario_id=req.scenario_id,
            judge_model=req.judge_model,
        )
        return res
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/results")
def list_evaluation_results(
    agent_id: Optional[str] = None,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """List evaluation history with evidence and scores."""
    org = session["organization"]
    query = db.query(EvaluationResultRecord).filter(EvaluationResultRecord.organization_id == org.id)
    if agent_id:
        query = query.filter(EvaluationResultRecord.agent_id == agent_id)

    records = query.order_by(EvaluationResultRecord.created_at.desc()).limit(50).all()
    return [
        {
            "id": r.id,
            "agent_id": r.agent_id,
            "scenario_id": r.scenario_id,
            "run_id": r.run_id,
            "status": r.status,
            "deterministic_checks": r.deterministic_checks,
            "llm_judge_score": r.llm_judge_score,
            "llm_judge_reasoning": r.llm_judge_reasoning,
            "judge_model": r.judge_model,
            "evidence": r.evidence,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


@router.get("/summary/{agent_id}")
def get_agent_evaluation_summary(
    agent_id: str,
    session: Dict[str, Any] = Depends(get_current_tenant_session),
    db: Session = Depends(get_db),
):
    """Get summarized truthful evaluation scorecard for an agent."""
    org = session["organization"]
    records = (
        db.query(EvaluationResultRecord)
        .filter(EvaluationResultRecord.organization_id == org.id, EvaluationResultRecord.agent_id == agent_id)
        .order_by(EvaluationResultRecord.created_at.desc())
        .all()
    )

    if not records:
        return {
            "total_evaluations": 0,
            "passed": 0,
            "failed": 0,
            "inconclusive": 0,
            "pass_rate": 0.0,
            "avg_judge_score": 0.0,
            "latest_result": None,
        }

    total = len(records)
    passed = sum(1 for r in records if r.status == "passed")
    failed = sum(1 for r in records if r.status == "failed")
    inconclusive = total - (passed + failed)
    judge_scores = [r.llm_judge_score for r in records if r.llm_judge_score is not None]
    avg_judge = round(sum(judge_scores) / len(judge_scores), 2) if judge_scores else 0.0

    latest = records[0]
    return {
        "total_evaluations": total,
        "passed": passed,
        "failed": failed,
        "inconclusive": inconclusive,
        "pass_rate": round((passed / total) * 100, 1),
        "avg_judge_score": avg_judge,
        "latest_result": {
            "id": latest.id,
            "status": latest.status,
            "created_at": latest.created_at.isoformat() if latest.created_at else None,
            "deterministic_checks": latest.deterministic_checks,
            "judge_score": latest.llm_judge_score,
            "judge_reasoning": latest.llm_judge_reasoning,
        },
    }
