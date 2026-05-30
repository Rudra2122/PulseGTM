from pydantic import BaseModel
from typing import Optional

class Account(BaseModel):
    id: str
    name: str
    csm_name: str
    plan: str                    # starter / growth / enterprise
    contract_value: float
    days_to_renewal: int
    login_frequency_score: float  # 0-100
    feature_adoption_pct: float
    open_tickets: int
    nps_score: Optional[float]    # -100 to 100
    last_login_days_ago: int
    health_score: Optional[float]
    health_band: Optional[str]    # green / amber / red
    top_risk_factor: Optional[str]
    linkedin_headcount_growth_pct: Optional[float]
    at_usage_ceiling: bool

class ChurnSignal(BaseModel):
    account_id: str
    signal_type: str
    description: str
    fired_at: str
    ai_summary: Optional[str]
    ai_actions: Optional[list[str]]

class ExpansionSignal(BaseModel):
    account_id: str
    signal_type: str
    description: str
    ai_outreach_draft: Optional[str]