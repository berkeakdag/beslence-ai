"""BESLENCE AI backend API tests."""
import os
import base64
import pytest
import requests
from datetime import datetime, date, timedelta
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
if not BASE_URL:
    # fallback to frontend env
    fe_env = Path(__file__).parent.parent.parent / "frontend" / ".env"
    for line in fe_env.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip()

TOKEN = "test_session_token_001"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
HEADERS_NO_CT = {"Authorization": f"Bearer {TOKEN}"}


# ---------- Health ----------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_google_session_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/google-session", json={"session_id": "INVALID_xxx"}, timeout=20)
        assert r.status_code in (400, 401), f"expected 401, got {r.status_code}: {r.text}"

    def test_me_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer bad_token"}, timeout=15)
        assert r.status_code == 401

    def test_me_valid_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=HEADERS, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "user" in data
        assert data["user"]["user_id"] == "user_test01"


# ---------- Profile + plan calc ----------
class TestProfile:
    def test_save_profile_male_lose(self):
        payload = {
            "name": "Test User",
            "age": 30,
            "sex": "erkek",
            "height_cm": 180,
            "weight_kg": 80,
            "goal_primary": "kilo_vermek",
            "daily_activity_level": "orta_aktif",
            "selected_theme": "sportif",
        }
        r = requests.post(f"{BASE_URL}/api/profile", headers=HEADERS, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        plan = r.json()["plan"]
        # Mifflin: 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
        assert plan["bmr_kcal"] == 1780
        # BESLENCE: factor is always 1.20 regardless of daily_activity_level
        assert plan["daily_activity_factor"] == 1.20
        assert plan["maintenance_calories"] == round(1780 * 1.20)
        # kilo_vermek: 80-90%
        assert plan["goal_calories_min"] == round(1780 * 1.20 * 0.80)
        assert plan["goal_calories_max"] == round(1780 * 1.20 * 0.90)

    def test_profile_yag_yakmak_factor_120(self):
        # Spec: erkek/30/180/75/yag_yakmak → BMR≈1730, Maintenance≈2076, factor=1.2
        payload = {
            "name": "Test", "age": 30, "sex": "erkek",
            "height_cm": 180, "weight_kg": 75,
            "goal_primary": "yag_yakmak",
            "daily_activity_level": "orta_aktif",  # should be ignored
        }
        r = requests.post(f"{BASE_URL}/api/profile", headers=HEADERS, json=payload, timeout=15)
        assert r.status_code == 200
        plan = r.json()["plan"]
        # BMR = 10*75 + 6.25*180 - 5*30 + 5 = 750+1125-150+5 = 1730
        assert plan["bmr_kcal"] == 1730
        assert plan["daily_activity_factor"] == 1.20
        assert plan["maintenance_calories"] == 2076
        # yag_yakmak: 85-90%
        assert plan["goal_calories_min"] == round(2076 * 0.85)  # 1765
        assert plan["goal_calories_max"] == round(2076 * 0.90)  # 1868

    def test_activity_fields_do_not_affect_calc(self):
        # daily_activity_level/sports_frequency must NOT change factor (always 1.20)
        base = {"name": "X", "age": 30, "sex": "erkek", "height_cm": 180, "weight_kg": 75,
                "goal_primary": "yag_yakmak"}
        r1 = requests.post(f"{BASE_URL}/api/profile", headers=HEADERS,
                           json={**base, "daily_activity_level": "cok_hareketsiz", "sports_frequency": "yok"},
                           timeout=15)
        r2 = requests.post(f"{BASE_URL}/api/profile", headers=HEADERS,
                           json={**base, "daily_activity_level": "cok_aktif", "sports_frequency": "her_gun"},
                           timeout=15)
        p1, p2 = r1.json()["plan"], r2.json()["plan"]
        assert p1["maintenance_calories"] == p2["maintenance_calories"]
        assert p1["daily_activity_factor"] == 1.20
        assert p2["daily_activity_factor"] == 1.20

    def test_save_profile_female_muscle(self):
        payload = {
            "name": "Test User",
            "age": 25,
            "sex": "kadin",
            "height_cm": 165,
            "weight_kg": 60,
            "goal_primary": "kas_kazanmak",
            "daily_activity_level": "aktif",
            "selected_theme": "sakin",
        }
        r = requests.post(f"{BASE_URL}/api/profile", headers=HEADERS, json=payload, timeout=15)
        assert r.status_code == 200
        plan = r.json()["plan"]
        # 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
        assert plan["bmr_kcal"] == 1345
        assert plan["goal_calories_min"] >= plan["maintenance_calories"]  # surplus
        # protein for muscle: 1.6-2.2 * 60
        assert plan["protein_g_min"] == round(1.6 * 60)
        assert plan["protein_g_max"] == round(2.2 * 60)

    def test_safety_floor_female(self):
        payload = {
            "name": "Small", "age": 60, "sex": "kadin", "height_cm": 150, "weight_kg": 45,
            "goal_primary": "kilo_vermek", "daily_activity_level": "cok_hareketsiz",
        }
        r = requests.post(f"{BASE_URL}/api/profile", headers=HEADERS, json=payload, timeout=15)
        plan = r.json()["plan"]
        assert plan["goal_calories_min"] >= 1200

    def test_get_profile(self):
        r = requests.get(f"{BASE_URL}/api/profile", headers=HEADERS, timeout=15)
        assert r.status_code == 200
        assert r.json().get("profile") is not None
        assert r.json().get("plan") is not None

    def test_theme_switch(self):
        r = requests.patch(f"{BASE_URL}/api/profile/theme", headers=HEADERS, json={"selected_theme": "sportif"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["selected_theme"] == "sportif"
        r2 = requests.patch(f"{BASE_URL}/api/profile/theme", headers=HEADERS, json={"selected_theme": "sakin"}, timeout=15)
        assert r2.json()["selected_theme"] == "sakin"

    def test_theme_invalid(self):
        r = requests.patch(f"{BASE_URL}/api/profile/theme", headers=HEADERS, json={"selected_theme": "blue"}, timeout=15)
        assert r.status_code == 400


# ---------- Entries CRUD ----------
class TestEntries:
    entry_id = None

    def test_create_entry(self):
        today = date.today().isoformat()
        payload = {
            "date": today, "time": "13:00", "entry_type": "food",
            "status": "past_logged", "timeline_bubble_type": "meal",
            "source": "manual", "raw_user_input": "TEST_pilav",
            "title": "TEST Pilav", "calories_min": 400, "calories_max": 500,
            "protein_g_min": 10, "protein_g_max": 15,
        }
        r = requests.post(f"{BASE_URL}/api/entries", headers=HEADERS, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"].startswith("entry_")
        assert data["title"] == "TEST Pilav"
        TestEntries.entry_id = data["id"]

    def test_list_entries(self):
        today = date.today().isoformat()
        r = requests.get(f"{BASE_URL}/api/entries?date={today}", headers=HEADERS_NO_CT, timeout=15)
        assert r.status_code == 200
        items = r.json()["entries"]
        assert any(it["id"] == TestEntries.entry_id for it in items)
        for it in items:
            assert "photo_base64" not in it  # excluded

    def test_update_status(self):
        eid = TestEntries.entry_id
        r = requests.patch(f"{BASE_URL}/api/entries/{eid}/status", headers=HEADERS, json={"status": "completed"}, timeout=15)
        assert r.status_code == 200
        # verify persisted
        g = requests.get(f"{BASE_URL}/api/entries/{eid}", headers=HEADERS_NO_CT, timeout=15)
        assert g.json()["status"] == "completed"

    def test_delete_entry(self):
        eid = TestEntries.entry_id
        r = requests.delete(f"{BASE_URL}/api/entries/{eid}", headers=HEADERS_NO_CT, timeout=15)
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/entries/{eid}", headers=HEADERS_NO_CT, timeout=15)
        assert g.status_code == 404


# ---------- AI Chatbot ----------
class TestChatbot:
    def test_chatbot_food(self):
        r = requests.post(
            f"{BASE_URL}/api/ai/chatbot",
            headers=HEADERS,
            json={"message": "13:30 tavuklu pilav ayran", "user_local_time": datetime.now().isoformat()},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True, data
        e = data["entry"]
        assert e["time"] in ("13:30", "13:30:00") or e["time"].startswith("13:")
        assert e["entry_type"] in ("food", "meal")
        assert e["calories_min"] is not None or e["calories_max"] is not None

    def test_chatbot_water_now(self):
        r = requests.post(
            f"{BASE_URL}/api/ai/chatbot",
            headers=HEADERS,
            json={"message": "Şu an 500 ml su içtim", "user_local_time": datetime.now().isoformat()},
            timeout=60,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        e = data["entry"]
        assert e["entry_type"] in ("water",)
        assert e.get("water_ml") in (500, 500.0) or (e.get("water_ml") and 400 <= float(e["water_ml"]) <= 600)

    def test_chatbot_plan_future(self):
        r = requests.post(
            f"{BASE_URL}/api/ai/chatbot",
            headers=HEADERS,
            json={"message": "Yarın 19:00 gym planla", "user_local_time": datetime.now().isoformat()},
            timeout=60,
        )
        assert r.status_code == 200
        data = r.json()
        e = data["entry"]
        assert e["status"] in ("planned",)
        assert e["entry_type"] in ("activity",)

    def test_chatbot_past(self):
        r = requests.post(
            f"{BASE_URL}/api/ai/chatbot",
            headers=HEADERS,
            json={"message": "Dün 20:00 pizza yedim", "user_local_time": datetime.now().isoformat()},
            timeout=60,
        )
        assert r.status_code == 200
        data = r.json()
        e = data["entry"]
        assert e["status"] in ("past_logged",)
        assert e["entry_type"] in ("food",)

    def test_chatbot_no_advice(self):
        r = requests.post(
            f"{BASE_URL}/api/ai/chatbot",
            headers=HEADERS,
            json={"message": "13:30 tavuklu pilav ayran"},
            timeout=60,
        )
        data = r.json()
        summary = (data.get("summary") or "").lower()
        # Must not contain prescriptive advice
        forbidden = ["yemelisin", "içmelisin", "tavsiye ederim", "öneririm", "yapmalısın"]
        for f in forbidden:
            assert f not in summary, f"Advice detected: {summary}"


# ---------- AI Photo ----------
class TestPhoto:
    def test_photo_analyze(self):
        b64 = Path("/tmp/test_food.b64").read_text()
        r = requests.post(
            f"{BASE_URL}/api/ai/photo-analyze",
            headers={"Authorization": f"Bearer {TOKEN}"},
            data={"image_base64": b64, "mime_type": "image/jpeg"},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "detected_foods" in data
        assert "calories_min" in data or "calories_max" in data


# ---------- Foods Lookup ----------
class TestFoodLookup:
    def test_lookup(self):
        r = requests.post(
            f"{BASE_URL}/api/foods/lookup",
            headers=HEADERS,
            json={"query": "mercimek çorbası"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "results" in data
        assert isinstance(data["results"], list)
        assert len(data["results"]) >= 1


# ---------- Summaries ----------
class TestSummary:
    @classmethod
    def setup_class(cls):
        # Seed a few entries for today
        today = date.today().isoformat()
        for payload in [
            {"date": today, "time": "08:00", "entry_type": "food", "title": "TEST kahvalti", "calories_min": 300, "calories_max": 400, "protein_g_min": 10, "protein_g_max": 12},
            {"date": today, "time": "13:00", "entry_type": "food", "title": "TEST ogle", "calories_min": 600, "calories_max": 700, "protein_g_min": 25, "protein_g_max": 30},
            {"date": today, "time": "19:00", "entry_type": "activity", "title": "TEST run", "duration_minutes": 30, "estimated_activity_burn_min": 200, "estimated_activity_burn_max": 300},
            {"date": today, "time": "10:00", "entry_type": "water", "title": "TEST su", "water_ml": 500},
        ]:
            requests.post(f"{BASE_URL}/api/entries", headers=HEADERS, json=payload, timeout=15)

    def test_daily(self):
        today = date.today().isoformat()
        r = requests.get(f"{BASE_URL}/api/summary/daily?date={today}", headers=HEADERS_NO_CT, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["calories"]["min"] >= 900
        assert d["activity_minutes"] >= 30
        assert d["water_ml"] >= 500
        # activity_burn should be summed from estimated_activity_burn_min/max
        assert d["activity_burn"]["min"] >= 200
        assert d["activity_burn"]["max"] >= 300

    def test_other_date_no_burn(self):
        # Different date (10 days from today) should return 0 burn since no activity logged
        other = (date.today() + timedelta(days=10)).isoformat()
        r = requests.get(f"{BASE_URL}/api/summary/daily?date={other}", headers=HEADERS_NO_CT, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["activity_burn"]["min"] == 0
        assert d["activity_burn"]["max"] == 0
        assert d["activity_minutes"] == 0

    def test_weekly(self):
        today = date.today().isoformat()
        r = requests.get(f"{BASE_URL}/api/summary/weekly?end_date={today}", headers=HEADERS_NO_CT, timeout=15)
        assert r.status_code == 200
        w = r.json()
        assert len(w["days"]) == 7
        assert "avg_calories" in w
        assert "total_activity_minutes" in w
        assert w["total_activity_minutes"] >= 30
        assert w["most_active_day"] == today
