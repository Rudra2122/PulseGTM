from openai import OpenAI
import json
import os
import re

# ── Switch here: Ollama (free) vs OpenAI ($2) ─────────────────
USE_OLLAMA = os.getenv("USE_OLLAMA", "true").lower() == "true"

if USE_OLLAMA:
    client = OpenAI(
        base_url="http://localhost:11434/v1",
        api_key="ollama",          # Ollama doesn't need a real key
    )
    MODEL = "llama3.1"
else:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    MODEL = "gpt-4o"


# ── JSON parser with fallback ─────────────────────────────────
# Ollama sometimes wraps JSON in ```json ... ``` or adds extra text
# This handles all cases safely

def safe_json_parse(text: str) -> dict:
    text = text.strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown code fences if present
    # e.g. ```json { ... } ```
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence_match:
        try:
            return json.loads(fence_match.group(1))
        except json.JSONDecodeError:
            pass

    # Find first { ... } block in the text
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group())
        except json.JSONDecodeError:
            pass

    # Last resort: return a safe default so the app doesn't crash
    return {
        "risk_summary": "Unable to parse AI response. Please retry.",
        "next_actions": ["Review account manually", "Check usage data", "Contact CSM"],
        "urgency": "medium",
        "executive_summary": text[:500],  # Return raw text as summary
        "key_achievements": [],
        "risks": [],
        "expansion_angles": [],
        "talking_points": [],
        "recommended_next_step": "Review account data manually."
    }


# ── Shared prompt builder ─────────────────────────────────────

def build_qbr_prompt(account: dict) -> str:
    return f"""You are a Customer Success analyst. Generate a QBR brief.

Account: {account['name']}
Plan: {account['plan']} (${account['contract_value']:,.0f}/yr)
Health Score: {account['health_score']}/100 ({account['health_band']})
Days to Renewal: {account['days_to_renewal']}
Feature Adoption: {account['feature_adoption_pct']}%
NPS: {account['nps_score']}
Open Tickets: {account['open_tickets']}
Top Risk Factor: {account['top_risk_factor']}
LinkedIn Headcount Growth: {account.get('linkedin_headcount_growth_pct', 0)}%
CSM: {account['csm_name']}

Respond ONLY with a JSON object. No explanation, no markdown, no extra text.
Start your response with {{ and end with }}.

{{
  "executive_summary": "3-4 sentence account overview",
  "key_achievements": ["Achievement 1", "Achievement 2", "Achievement 3"],
  "risks": [
    {{"risk": "Risk description", "severity": "high", "mitigation": "What to do"}},
    {{"risk": "Risk 2", "severity": "medium", "mitigation": "Action"}},
    {{"risk": "Risk 3", "severity": "low", "mitigation": "Action"}}
  ],
  "expansion_angles": ["Opportunity 1", "Opportunity 2", "Opportunity 3"],
  "talking_points": ["Opening point", "Mid-call point", "Closing point"],
  "recommended_next_step": "Single most important next action"
}}"""


# ── AI functions ──────────────────────────────────────────────

def generate_churn_brief(account: dict, signals: list) -> dict:
    signal_text = "\n".join([s["description"] for s in signals])

    prompt = f"""You are a Customer Success analyst.

Account: {account['name']}
Plan: {account['plan']} (${account['contract_value']:,.0f}/yr)
Health Score: {account['health_score']}/100
Days to Renewal: {account['days_to_renewal']}
CSM: {account['csm_name']}

Churn signals:
{signal_text}

Respond ONLY with a JSON object. Start with {{ end with }}.

{{
  "risk_summary": "2 sentence explanation of why this account is at risk",
  "next_actions": ["Action 1 for CSM", "Action 2", "Action 3"],
  "urgency": "high"
}}"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
        temperature=0.3,
    )
    return safe_json_parse(response.choices[0].message.content)


def generate_qbr_brief(account: dict) -> dict:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": build_qbr_prompt(account)}],
        max_tokens=800,
        temperature=0.3,
    )
    return safe_json_parse(response.choices[0].message.content)


def generate_expansion_outreach(account: dict, signal: dict) -> str:
    prompt = f"""You are a Growth Strategy Manager at a SaaS company.

Account: {account['name']}
Current Plan: {account['plan']} (${account['contract_value']:,.0f}/yr)
Expansion Signal: {signal['description']}
CSM: {account['csm_name']}

Write a 3-sentence warm outreach message the CSM can send.
Tone: consultative, not salesy. Return only the message text, nothing else."""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
        temperature=0.5,
    )
    return response.choices[0].message.content.strip()