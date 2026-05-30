from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from database import SessionLocal, AccountDB, ChurnSignalDB, ExpansionSignalDB, Base, engine
from scoring import score_all, compute_health_score
from signals import detect_churn_signals, detect_expansion_signals
from ai import generate_churn_brief, generate_qbr_brief, generate_expansion_outreach, build_qbr_prompt
from slack import send_churn_alert
from openai import OpenAI
import json
import os
from dotenv import load_dotenv

load_dotenv()
app = FastAPI(title="PulseGTM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Accounts ──────────────────────────────────────────────────────────────────

@app.get("/accounts")
def get_accounts():
    db = SessionLocal()
    accounts = db.query(AccountDB).all()
    db.close()
    result = []
    for a in accounts:
        d = a.__dict__.copy()
        d.pop("_sa_instance_state", None)
        if d.get("score_breakdown"):
            d["score_breakdown"] = json.loads(d["score_breakdown"])
        result.append(d)
    return result

@app.get("/accounts/{account_id}")
def get_account(account_id: str):
    db = SessionLocal()
    account = db.query(AccountDB).filter(AccountDB.id == account_id).first()
    db.close()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    d = account.__dict__.copy()
    d.pop("_sa_instance_state", None)
    if d.get("score_breakdown"):
        d["score_breakdown"] = json.loads(d["score_breakdown"])
    return d

# ── Health summary ─────────────────────────────────────────────────────────────

@app.get("/health/summary")
def get_health_summary():
    db = SessionLocal()
    accounts = db.query(AccountDB).all()
    db.close()
    bands = {"green": 0, "amber": 0, "red": 0}
    for a in accounts:
        bands[a.health_band] = bands.get(a.health_band, 0) + 1
    at_risk_arr = sum(a.contract_value for a in accounts if a.health_band == "red")
    total_arr = sum(a.contract_value for a in accounts)
    return {
        "total_accounts": len(accounts),
        "bands": bands,
        "at_risk_arr": round(at_risk_arr),
        "total_arr": round(total_arr),
    }

# ── Churn signals ──────────────────────────────────────────────────────────────

@app.get("/signals/churn")
def get_churn_signals():
    db = SessionLocal()
    signals = db.query(ChurnSignalDB).all()
    db.close()
    result = []
    for s in signals:
        d = s.__dict__.copy()
        d.pop("_sa_instance_state", None)
        if d.get("ai_actions"):
            d["ai_actions"] = json.loads(d["ai_actions"])
        result.append(d)
    return result

@app.post("/signals/churn/run")
def run_churn_detection():
    db = SessionLocal()
    accounts = db.query(AccountDB).filter(AccountDB.health_band == "red").all()
    fired = 0
    for account in accounts:
        account_dict = account.__dict__.copy()
        account_dict.pop("_sa_instance_state", None)
        if account_dict.get("score_breakdown"):
            account_dict["score_breakdown"] = json.loads(account_dict["score_breakdown"])
        signals = detect_churn_signals(account_dict)
        if not signals:
            continue
        ai_brief = generate_churn_brief(account_dict, signals)
        for signal in signals:
            db_signal = ChurnSignalDB(
                account_id=signal["account_id"],
                signal_type=signal["signal_type"],
                description=signal["description"],
                fired_at=signal["fired_at"],
                ai_summary=ai_brief.get("risk_summary"),
                ai_actions=json.dumps(ai_brief.get("next_actions", [])),
            )
            db.add(db_signal)
        send_churn_alert(account_dict, signals, ai_brief)
        fired += 1
    db.commit()
    db.close()
    return {"accounts_processed": len(accounts), "alerts_fired": fired}

# ── QBR Brief — non-streaming ──────────────────────────────────────────────────

@app.post("/qbr/{account_id}")
def generate_qbr(account_id: str):
    db = SessionLocal()
    account = db.query(AccountDB).filter(AccountDB.id == account_id).first()
    db.close()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    account_dict = account.__dict__.copy()
    account_dict.pop("_sa_instance_state", None)
    if account_dict.get("score_breakdown"):
        account_dict["score_breakdown"] = json.loads(account_dict["score_breakdown"])
    brief = generate_qbr_brief(account_dict)
    return {"account_id": account_id, "brief": brief}

# ── QBR Brief — streaming ← NEW ───────────────────────────────────────────────

@app.post("/qbr/{account_id}/stream")
def generate_qbr_streaming(account_id: str):
    """Streaming version — sends tokens as they arrive from OpenAI"""
    db = SessionLocal()
    account = db.query(AccountDB).filter(AccountDB.id == account_id).first()
    db.close()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    account_dict = account.__dict__.copy()
    account_dict.pop("_sa_instance_state", None)
    if account_dict.get("score_breakdown"):
        account_dict["score_breakdown"] = json.loads(account_dict["score_breakdown"])

    def stream_generator():
        oai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        prompt = build_qbr_prompt(account_dict)
        with oai_client.chat.completions.stream(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
        ) as stream:
            for text in stream.text_stream:
                yield text

    return StreamingResponse(stream_generator(), media_type="text/plain")

# ── Expansion signals ──────────────────────────────────────────────────────────

@app.get("/signals/expansion")
def get_expansion_signals():
    db = SessionLocal()
    signals = db.query(ExpansionSignalDB).all()
    db.close()
    result = []
    for s in signals:
        d = s.__dict__.copy()
        d.pop("_sa_instance_state", None)
        result.append(d)
    return result

@app.post("/signals/expansion/run")
def run_expansion_detection():
    db = SessionLocal()
    accounts = db.query(AccountDB).all()
    saved = 0
    for account in accounts:
        account_dict = account.__dict__.copy()
        account_dict.pop("_sa_instance_state", None)
        signals = detect_expansion_signals(account_dict)
        for signal in signals:
            outreach = generate_expansion_outreach(account_dict, signal)
            db_signal = ExpansionSignalDB(
                account_id=signal["account_id"],
                signal_type=signal["signal_type"],
                description=signal["description"],
                ai_outreach_draft=outreach,
            )
            db.add(db_signal)
            saved += 1
    db.commit()
    db.close()
    return {"expansion_signals_saved": saved}

# ── Clay webhook ───────────────────────────────────────────────────────────────

@app.post("/webhooks/clay")
def receive_clay_data(payload: dict):
    db = SessionLocal()
    account_data = payload.get("data", {})
    scored = compute_health_score(account_data)
    existing = db.query(AccountDB).filter(AccountDB.id == scored["id"]).first()
    if existing:
        for k, v in scored.items():
            if k == "score_breakdown":
                setattr(existing, k, json.dumps(v))
            elif hasattr(existing, k):
                setattr(existing, k, v)
    else:
        db_account = AccountDB(
            **{k: json.dumps(v) if k == "score_breakdown" else v
               for k, v in scored.items() if hasattr(AccountDB, k)}
        )
        db.add(db_account)
    db.commit()
    db.close()
    return {"status": "ok", "account_id": scored["id"]}

# ── Dev seed ───────────────────────────────────────────────────────────────────

@app.post("/dev/seed")
def seed_database():
    from seed_data import generate_accounts
    from scoring import score_all
    accounts = generate_accounts(50)
    scored = score_all(accounts)
    db = SessionLocal()
    db.query(AccountDB).delete()
    for a in scored:
        db_account = AccountDB(
            **{k: json.dumps(v) if k == "score_breakdown" else v
               for k, v in a.items() if hasattr(AccountDB, k)}
        )
        db.add(db_account)
    db.commit()
    db.close()
    return {"seeded": len(scored)}