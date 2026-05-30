from sqlalchemy import create_engine, Column, String, Float, Integer, Boolean, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./pulsegtm.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AccountDB(Base):
    __tablename__ = "accounts"
    id = Column(String, primary_key=True)
    name = Column(String)
    csm_name = Column(String)
    plan = Column(String)
    contract_value = Column(Float)
    days_to_renewal = Column(Integer)
    login_frequency_score = Column(Float)
    feature_adoption_pct = Column(Float)
    open_tickets = Column(Integer)
    nps_score = Column(Float)
    last_login_days_ago = Column(Integer)
    health_score = Column(Float)
    health_band = Column(String)
    top_risk_factor = Column(String)
    score_breakdown = Column(Text)
    at_usage_ceiling = Column(Boolean)
    linkedin_headcount_growth_pct = Column(Float)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)

class ChurnSignalDB(Base):
    __tablename__ = "churn_signals"
    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(String)
    signal_type = Column(String)
    description = Column(String)
    fired_at = Column(String)
    ai_summary = Column(Text)
    ai_actions = Column(Text)

class ExpansionSignalDB(Base):
    __tablename__ = "expansion_signals"
    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(String)
    signal_type = Column(String)
    description = Column(String)
    ai_outreach_draft = Column(Text)

Base.metadata.create_all(bind=engine)

