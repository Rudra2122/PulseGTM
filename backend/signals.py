import datetime

CHURN_THRESHOLDS = {
    "login_gap_days": 14,
    "min_health_for_alert": 45,
    "nps_detractor_threshold": 0,
    "ticket_spike_threshold": 4,
}

EXPANSION_THRESHOLDS = {
    "headcount_growth_pct": 20,
}

def detect_churn_signals(account: dict) -> list:
    signals = []
    now = datetime.datetime.utcnow().isoformat()

    if account.get("last_login_days_ago", 0) >= CHURN_THRESHOLDS["login_gap_days"]:
        signals.append({
            "account_id": account["id"],
            "signal_type": "login_gap",
            "description": f"No login for {account['last_login_days_ago']} days",
            "fired_at": now,
        })

    if account.get("health_score", 100) < CHURN_THRESHOLDS["min_health_for_alert"]:
        signals.append({
            "account_id": account["id"],
            "signal_type": "low_health_score",
            "description": f"Health score dropped to {account['health_score']}",
            "fired_at": now,
        })

    if account.get("nps_score", 100) < CHURN_THRESHOLDS["nps_detractor_threshold"]:
        signals.append({
            "account_id": account["id"],
            "signal_type": "nps_detractor",
            "description": f"NPS score is {account['nps_score']} — account is a detractor",
            "fired_at": now,
        })

    if account.get("open_tickets", 0) >= CHURN_THRESHOLDS["ticket_spike_threshold"]:
        signals.append({
            "account_id": account["id"],
            "signal_type": "ticket_spike",
            "description": f"{account['open_tickets']} open support tickets",
            "fired_at": now,
        })

    return signals

def detect_expansion_signals(account: dict) -> list:
    signals = []

    if account.get("linkedin_headcount_growth_pct", 0) >= EXPANSION_THRESHOLDS["headcount_growth_pct"]:
        signals.append({
            "account_id": account["id"],
            "signal_type": "headcount_growth",
            "description": f"GTM/Ops team grew {account['linkedin_headcount_growth_pct']}% — likely need more seats",
        })

    if account.get("at_usage_ceiling"):
        signals.append({
            "account_id": account["id"],
            "signal_type": "usage_ceiling",
            "description": "Account hitting usage limits on current plan",
        })

    return signals