from faker import Faker
import random
import json

fake = Faker()

def generate_accounts(n=50):
    accounts = []
    plans = ["starter", "growth", "enterprise"]
    csms = ["Sarah Chen", "Marcus Webb", "Priya Nair", "Jake Torres"]

    for i in range(n):
        plan = random.choice(plans)
        contract = {
    "starter": random.randint(8000, 15000),
    "growth": random.randint(40000, 120000),
    "enterprise": random.randint(150000, 500000)
}[plan]

        health_profile = random.choices(
            ["at_risk", "warning", "healthy"],
            weights=[0.3, 0.3, 0.4]
        )[0]

        if health_profile == "at_risk":
            login_freq = random.uniform(5, 25)
            feature_adoption = random.uniform(10, 35)
            open_tickets = random.randint(3, 10)
            nps = random.uniform(-50, 0)
            last_login = random.randint(15, 45)
        elif health_profile == "warning":
            login_freq = random.uniform(30, 55)
            feature_adoption = random.uniform(35, 60)
            open_tickets = random.randint(1, 4)
            nps = random.uniform(0, 30)
            last_login = random.randint(5, 15)
        else:
            login_freq = random.uniform(60, 95)
            feature_adoption = random.uniform(60, 95)
            open_tickets = random.randint(0, 2)
            nps = random.uniform(30, 80)
            last_login = random.randint(0, 7)

        accounts.append({
            "id": f"acc_{i+1:03d}",
            "name": fake.company(),
            "csm_name": random.choice(csms),
            "plan": plan,
            "contract_value": contract,
            "days_to_renewal": random.randint(7, 365),
            "login_frequency_score": round(login_freq, 1),
            "feature_adoption_pct": round(feature_adoption, 1),
            "open_tickets": open_tickets,
            "nps_score": round(nps, 1),
            "last_login_days_ago": last_login,
            "at_usage_ceiling": random.random() < 0.15,
            "linkedin_headcount_growth_pct": round(random.uniform(-5, 40), 1)
        })

    return accounts

if __name__ == "__main__":
    accounts = generate_accounts()
    with open("seed_accounts.json", "w") as f:
        json.dump(accounts, f, indent=2)
    print(f"Generated {len(accounts)} accounts")
