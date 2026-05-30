WEIGHTS = {
    "login_frequency": 0.25,
    "feature_adoption": 0.25,
    "support_tickets": 0.20,
    "nps": 0.20,
    "days_to_renewal": 0.10,
}

def normalize_tickets(open_tickets: int) -> float:
    return max(0, 100 - (open_tickets * 20))

def normalize_renewal(days: int) -> float:
    if days >= 180: return 100
    if days >= 90: return 70
    if days >= 30: return 40
    return 10

def normalize_nps(nps: float) -> float:
    return (nps + 100) / 2

def compute_health_score(account: dict) -> dict:
    scores = {
        "login_frequency": account["login_frequency_score"],
        "feature_adoption": account["feature_adoption_pct"],
        "support_tickets": normalize_tickets(account["open_tickets"]),
        "nps": normalize_nps(account.get("nps_score", 0)),
        "days_to_renewal": normalize_renewal(account["days_to_renewal"]),
    }

    weighted_score = sum(scores[k] * WEIGHTS[k] for k in WEIGHTS)
    health_score = round(weighted_score, 1)

    if health_score >= 70:
        band = "green"
    elif health_score >= 40:
        band = "amber"
    else:
        band = "red"

    top_risk = min(scores, key=scores.get)
    risk_labels = {
        "login_frequency": "Low login activity",
        "feature_adoption": "Poor feature adoption",
        "support_tickets": "High open ticket volume",
        "nps": "Low NPS score",
        "days_to_renewal": "Renewal coming up soon",
    }

    return {
        **account,
        "health_score": health_score,
        "health_band": band,
        "top_risk_factor": risk_labels[top_risk],
        "score_breakdown": scores,
    }

def score_all(accounts: list) -> list:
    return [compute_health_score(a) for a in accounts]