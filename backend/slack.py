import requests
import os
import json

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")

def send_churn_alert(account: dict, signals: list, ai_brief: dict):
    urgency_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}
    emoji = urgency_emoji.get(ai_brief.get("urgency", "medium"), "🟡")
    actions_text = "\n".join([f"• {a}" for a in ai_brief.get("next_actions", [])])

    payload = {
        "blocks": [
            {"type": "header", "text": {"type": "plain_text", "text": f"{emoji} Churn Alert — {account['name']}"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Health Score:* {account['health_score']}/100"},
                {"type": "mrkdwn", "text": f"*CSM:* {account['csm_name']}"},
                {"type": "mrkdwn", "text": f"*Plan:* {account['plan']} (${account['contract_value']:,.0f})"},
                {"type": "mrkdwn", "text": f"*Renewal in:* {account['days_to_renewal']} days"},
            ]},
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*Risk Summary:*\n{ai_brief.get('risk_summary', '')}"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*Suggested Next Actions:*\n{actions_text}"}},
            {"type": "divider"},
        ]
    }

    response = requests.post(SLACK_WEBHOOK_URL, data=json.dumps(payload), headers={"Content-Type": "application/json"})
    return response.status_code == 200