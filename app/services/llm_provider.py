"""
Operon LLM Provider Abstraction
Provides server-side access to Hugging Face models:
- meta-llama/Llama-3.3-70B-Instruct
- deepseek-ai/DeepSeek-R1-Distill-Qwen-32B
Ensures secrets remain strictly server-side and allows hot-swappable model selection.
"""

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

try:
    from huggingface_hub import InferenceClient
except ImportError:
    class InferenceClient:
        def __init__(self, *args, **kwargs): pass
        def chat_completion(self, *args, **kwargs): return None

from database.postgres.config import settings

logger = logging.getLogger("operon.llm_provider")

SUPPORTED_MODELS = {
    "meta-llama/Llama-3.3-70B-Instruct": {
        "display_name": "Llama 3.3 70B Instruct",
        "provider": "huggingface",
        "description": "High-capability reasoning and instruction-following for enterprise agents.",
    },
    "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B": {
        "display_name": "DeepSeek R1 Distill Qwen 32B",
        "provider": "huggingface",
        "description": "Optimized mathematical, logical, and structured-agent planning.",
    },
}

DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct"

def get_hf_api_key() -> str:
    """Read Hugging Face API key safely from environment or config."""
    key = os.getenv("HUGGING_FACE_API_KEY") or os.getenv("HF_TOKEN") or getattr(settings, "HF_TOKEN", "")
    if key and key.startswith("hf_"):
        return key
    return ""

def get_inference_client(model: str = DEFAULT_MODEL) -> InferenceClient:
    api_key = get_hf_api_key()
    return InferenceClient(
        model=model,
        token=api_key if api_key else None,
        timeout=60.0,
    )

async def generate_chat_response(
    messages: List[Dict[str, str]],
    model: str = DEFAULT_MODEL,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> str:
    """Generate completion using configured Hugging Face model with fallback to resilient reasoning."""
    target_model = model if model in SUPPORTED_MODELS else DEFAULT_MODEL
    api_key = get_hf_api_key()

    if not api_key:
        raise RuntimeError("AI generation is unavailable because no Hugging Face API key is configured.")

    try:
        client = get_inference_client(target_model)
        response = client.chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        content = response.choices[0].message.content
        if content and content.strip():
            return content.strip()
        raise RuntimeError("The configured model returned an empty response.")
    except Exception as exc:
        logger.warning(f"HF inference failed for model {target_model}: {exc}")
        raise RuntimeError(f"AI generation failed for model {target_model}.") from exc

async def parse_plain_english_spec(
    prompt: str,
    business_objective: str = "",
    instructions: str = "",
    model: str = DEFAULT_MODEL,
) -> Dict[str, Any]:
    """Parse natural language agent description into a canonical Operon Agent Specification."""
    system_prompt = (
        "You are Operon's Principal AI Architect. Parse the customer's request into a valid JSON agent specification.\n"
        "Return ONLY a valid JSON object with the following structure:\n"
        "{\n"
        '  "name": "...",\n'
        '  "description": "...",\n'
        '  "instructions": "...",\n'
        '  "business_objective": "...",\n'
        '  "rules": ["..."],\n'
        '  "success_criteria": ["..."],\n'
        '  "required_integrations": ["zendesk" | "salesforce" | "slack" | "email" | "jira" | "hubspot"],\n'
        '  "required_data_sources": ["postgres" | "vector" | "hybrid"],\n'
        '  "required_tools": ["search_knowledge" | "query_approved_database" | "jira_escalate_incident" | "request_refund" | "slack_post_message"],\n'
        '  "approval_policy": {"require_human_approval_for": ["refunds", "sensitive_reply", "production_changes"]}\n'
        "}"
    )

    user_content = f"Agent Description: {prompt}\nObjective: {business_objective}\nRules & Instructions: {instructions}"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    raw_response = await generate_chat_response(messages, model=model)
    try:
        # Extract json block if present
        json_match = re.search(r"\{.*\}", raw_response, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group(0))
            return _normalize_agent_spec(parsed, prompt)
    except Exception:
        pass

    # Deterministic rule-based extraction if parsing was malformed
    return _deterministic_extract_spec(prompt, business_objective, instructions)

def _normalize_agent_spec(data: Dict[str, Any], raw_prompt: str) -> Dict[str, Any]:
    name = data.get("name") or raw_prompt.strip().splitlines()[0][:80]
    desc = data.get("description") or raw_prompt[:120]
    instructions = data.get("instructions") or raw_prompt
    rules = data.get("rules") if isinstance(data.get("rules"), list) else []
    success_criteria = data.get("success_criteria") if isinstance(data.get("success_criteria"), list) else []
    
    # Identify integrations based on prompt & parsed
    prompt_lower = (raw_prompt + " " + json.dumps(data)).lower()
    integrations = set(data.get("required_integrations", []))
    if any(k in prompt_lower for k in ["zendesk", "support ticket", "help desk"]):
        integrations.add("zendesk")
    if any(k in prompt_lower for k in ["slack", "channel", "alert"]):
        integrations.add("slack")
    if any(k in prompt_lower for k in ["jira", "issue", "bug", "escalate"]):
        integrations.add("jira")
    if any(k in prompt_lower for k in ["email", "mail", "inbox"]):
        integrations.add("email")
    if any(k in prompt_lower for k in ["salesforce", "crm", "lead"]):
        integrations.add("salesforce")

    tools = set(data.get("required_tools", []))
    tools.add("search_knowledge")
    if any(k in prompt_lower for k in ["database", "order", "sql", "customer data"]):
        tools.add("query_approved_database")
    if any(k in prompt_lower for k in ["refund", "billing", "payment"]):
        tools.add("request_refund")
    if any(k in prompt_lower for k in ["jira", "bug", "escalate"]):
        tools.add("jira_escalate_incident")
    if any(k in prompt_lower for k in ["slack", "notify", "message"]):
        tools.add("slack_post_message")

    return {
        "name": name,
        "description": desc,
        "instructions": instructions,
        "business_objective": data.get("business_objective") or "",
        "rules": rules,
        "success_criteria": success_criteria,
        "required_integrations": list(integrations),
        "required_data_sources": data.get("required_data_sources", []),
        "required_tools": list(tools),
        "approval_policy": data.get("approval_policy", {
            "require_human_approval_for": ["High-value financial actions", "Production system modifications", "Sensitive communications"]
        }),
    }

def _deterministic_extract_spec(prompt: str, objective: str, instructions: str) -> Dict[str, Any]:
    prompt_lower = prompt.lower()
    
    if any(k in prompt_lower for k in ["sales", "lead", "deal", "outreach", "prospect"]):
        template_name = "Enterprise Sales & Outreach Agent"
        template_desc = "Qualifies incoming enterprise leads, researches prospects, and prepares personalized communication."
        integrations = ["salesforce", "email", "slack"]
        tools = ["search_knowledge", "summarize_records", "query_approved_database"]
    elif any(k in prompt_lower for k in ["incident", "ops", "sre", "outage", "monitor", "alert"]):
        template_name = "Cloud Incident & SRE Response Agent"
        template_desc = "Monitors system events, correlates infrastructure alerts with runbooks, and escalates to engineers."
        integrations = ["slack", "jira", "datadog"]
        tools = ["search_knowledge", "jira_escalate_incident", "slack_post_message"]
    else:
        template_name = "Customer Support & Triage Agent"
        template_desc = "Answers customer inquiries, references enterprise knowledge bases, and drafts resolutions with SLA tracking."
        integrations = ["zendesk", "email", "slack"]
        tools = ["search_knowledge", "check_order", "query_approved_database", "request_refund"]

    return {
        "name": template_name,
        "description": prompt if len(prompt) > 10 else template_desc,
        "instructions": instructions or "Always adhere to established enterprise policies and verify data in connected sources.",
        "business_objective": objective or "Rapid, accurate response and issue resolution.",
        "rules": [
            "Never expose sensitive customer data or credentials",
            "Escalate ambiguous cases to a human supervisor",
            "Follow company refund and SLA compliance guidelines",
        ],
        "success_criteria": [
            "First contact resolution > 80%",
            "0 Hallucinations on verified knowledge docs",
            "Adherence to human approval policies",
        ],
        "required_integrations": integrations,
        "required_data_sources": ["postgres", "hybrid"],
        "required_tools": tools,
        "approval_policy": {
            "require_human_approval_for": ["Refunds over $50", "Outbound broadcast emails", "Production system interventions"]
        },
    }
