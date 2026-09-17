"""
BESLENCE AI backend regression tests (iteration 8):
1) Health-question filter (no persistence, Turkish reply)
2) Food/drink still persists (regression)
3) Sugar warning wording + 25g threshold
4) BMH regression (Mifflin-St Jeor × 1.20)
5) PATCH /entries/{id}/time and /amount regression

Auth: Bearer demo_session_grid_001, user_id=user_demo_grid01.
"""

import os
import re
import asyncio
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

# Base URL — from frontend/.env (EXPO_PUBLIC_BACKEND_URL). No default.
BASE_URL = "https://ai-food-logger-2.preview.emergentagent.com"
AUTH_HEADERS = {
    "Authorization": "Bearer demo_session_grid_001",
    "Content-Type": "application/json",
}
USER_ID = "user_demo_grid01"

# Read MONGO_URL/DB_NAME from backend/.env
def _read_env(key: str) -> str:
    with open("/app/backend/.env", "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith(key + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError(f"{key} missing in backend/.env")

MONGO_URL = _read_env("MONGO_URL")
DB_NAME = _read_env("DB_NAME")


async def _count_entries():
    c = AsyncIOMotorClient(MONGO_URL)
    try:
        db = c[DB_NAME]
        return await db.entries.count_documents({"user_id": USER_ID})
    finally:
        c.close()


def count_entries() -> int:
    return asyncio.get_event_loop().run_until_complete(_count_entries()) if False else asyncio.run(_count_entries())


# ---------- 1) Health-question filter ----------
class TestHealthQuestionFilter:
    HEALTH_MESSAGES = [
        "insülin direncim var ne yapmalıyım?",
        "kalp hastasıyım hangi diyet uygun",
        "hangi vitamini almalıyım",
    ]

    @pytest.mark.parametrize("msg", HEALTH_MESSAGES)
    def test_health_question_no_persistence(self, msg):
        before = count_entries()
        r = requests.post(
            f"{BASE_URL}/api/ai/chatbot",
            json={"message": msg, "user_local_time": "2026-07-01T15:00:00+03:00"},
            headers=AUTH_HEADERS,
            timeout=60,
        )
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("ok") is True, f"ok != True; body={data}"
        assert data.get("is_health_question") is True, f"is_health_question missing/false for msg={msg!r}; body={data}"
        reply = (data.get("reply") or "").lower()
        assert ("diyetisyen" in reply) or ("kayıt" in reply), (
            f"Reply must mention 'diyetisyen' or 'kayıt' — got: {data.get('reply')!r}"
        )
        after = count_entries()
        assert before == after, (
            f"Health question MUST NOT persist entries. before={before}, after={after}, msg={msg!r}"
        )


# ---------- 2) Food/drink still persists ----------
class TestFoodDrinkPersists:
    entry_id_holder = {}

    def test_water_add_persists(self):
        before = count_entries()
        r = requests.post(
            f"{BASE_URL}/api/ai/chatbot",
            json={"message": "1 bardak su ekle", "user_local_time": "2026-07-01T15:00:00+03:00"},
            headers=AUTH_HEADERS,
            timeout=60,
        )
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("ok") is True, f"ok != True; body={data}"
        assert data.get("needs_clarification") in (False, None), f"unexpected clarification; body={data}"
        assert data.get("is_health_question") in (False, None), f"is_health_question should be false; body={data}"
        entry = data.get("entry")
        assert isinstance(entry, dict) and entry, f"missing entry; body={data}"
        assert entry.get("time") == "15:00", f"expected time '15:00', got {entry.get('time')!r}"
        assert entry.get("date") == "2026-07-01", f"expected date '2026-07-01', got {entry.get('date')!r}"
        after = count_entries()
        assert after == before + 1, f"expected +1 entry (before={before}, after={after})"
        TestFoodDrinkPersists.entry_id_holder["water_id"] = entry.get("id")
        assert TestFoodDrinkPersists.entry_id_holder["water_id"], "entry.id missing"


# ---------- 3) Sugar warning wording + 25g threshold ----------
class TestSugarWarning:
    def test_report_daily_sugar_wording(self):
        r = requests.get(
            f"{BASE_URL}/api/report/daily?date=2026-06-30",
            headers=AUTH_HEADERS,
            timeout=30,
        )
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:400]}"
        data = r.json()
        warnings = data.get("warnings") or []
        assert isinstance(warnings, list), f"warnings not list; got {type(warnings)}"
        sugar = next((w for w in warnings if w.get("id") == "sugar"), None)
        if sugar is None:
            # Acceptable: day estimate <=25g (no warning). Just verify no
            # legacy 50g string appears anywhere in warnings.
            for w in warnings:
                assert "50 g" not in (w.get("text") or ""), (
                    f"Legacy 50 g string leaked into a non-sugar warning: {w}"
                )
            pytest.skip("No sugar warning present (est. <=25g). Accepted per spec.")
        text = sugar.get("text") or ""
        assert "Bugün yiyeceklerdeki doğal ve eklenen şeker toplamın" in text, (
            f"Missing required prefix in sugar warning text: {text!r}"
        )
        assert "günde 25 g altını önerir" in text, (
            f"Missing required '25 g' phrasing in sugar warning text: {text!r}"
        )
        # No legacy 50g
        assert "50 g" not in text, f"Legacy 50 g threshold present: {text!r}"


# ---------- 4) BMH regression ----------
class TestBMHRegression:
    BODY_MALE = {
        "name": "Test",
        "age": 30,
        "sex": "erkek",
        "height_cm": 180,
        "weight_kg": 80,
        "target_weight_kg": 75,
        "goal_primary": "yag_yakmak",
        "daily_activity_level": "orta_aktif",
        "sports_frequency": "haftada_3",
        "sports_types": ["futbol"],
        "selected_theme": "sportif",
    }

    def _post_profile(self, body):
        r = requests.post(
            f"{BASE_URL}/api/profile",
            json=body,
            headers=AUTH_HEADERS,
            timeout=30,
        )
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:400]}"
        return r.json()

    def test_male_bmr_and_maintenance(self):
        data = self._post_profile(self.BODY_MALE)
        plan = data.get("plan") or data
        assert plan.get("bmr_kcal") == 1780, f"male bmr_kcal expected 1780, got {plan.get('bmr_kcal')} ; full={data}"
        assert plan.get("maintenance_calories") == 2136, (
            f"male maintenance_calories expected 2136 (=round(1780×1.20)), got {plan.get('maintenance_calories')}"
        )

    def test_female_bmr(self):
        body = dict(self.BODY_MALE)
        body["sex"] = "kadın"
        data = self._post_profile(body)
        plan = data.get("plan") or data
        assert plan.get("bmr_kcal") == 1614, f"female bmr_kcal expected 1614, got {plan.get('bmr_kcal')} ; full={data}"


# ---------- 5) PATCH endpoints regression ----------
class TestPatchRegression:
    def test_patch_time_valid(self):
        wid = TestFoodDrinkPersists.entry_id_holder.get("water_id")
        assert wid, "no water entry id from step 2; run TestFoodDrinkPersists first"
        r = requests.patch(
            f"{BASE_URL}/api/entries/{wid}/time",
            json={"time": "10:30"},
            headers=AUTH_HEADERS,
            timeout=15,
        )
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:400]}"
        assert r.json().get("ok") is True, r.text

        # Verify via daily report / list
        rr = requests.get(
            f"{BASE_URL}/api/entries?date=2026-07-01",
            headers=AUTH_HEADERS, timeout=15,
        )
        if rr.status_code == 200:
            entries = rr.json() if isinstance(rr.json(), list) else rr.json().get("entries", [])
            match = next((e for e in entries if e.get("id") == wid), None)
            if match:
                assert match.get("time") == "10:30", f"time not persisted, got {match.get('time')!r}"

    def test_patch_amount_water_ml(self):
        wid = TestFoodDrinkPersists.entry_id_holder.get("water_id")
        assert wid, "no water entry id from step 2; run TestFoodDrinkPersists first"
        r = requests.patch(
            f"{BASE_URL}/api/entries/{wid}/amount",
            json={"amount": 500, "unit": "ml"},
            headers=AUTH_HEADERS,
            timeout=15,
        )
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:400]}"

        # Verify via GET
        rr = requests.get(
            f"{BASE_URL}/api/entries?date=2026-07-01",
            headers=AUTH_HEADERS, timeout=15,
        )
        assert rr.status_code == 200, rr.text
        entries = rr.json() if isinstance(rr.json(), list) else rr.json().get("entries", [])
        match = next((e for e in entries if e.get("id") == wid), None)
        assert match, f"water entry {wid} not found in GET; entries={entries!r}"
        assert match.get("water_ml") == 500, f"water_ml expected 500, got {match.get('water_ml')!r}"


# ---------- Cleanup: remove chatbot-created entries for 2026-07-01 ----------
@pytest.fixture(scope="session", autouse=True)
def _cleanup_after_all():
    yield
    async def _clean():
        c = AsyncIOMotorClient(MONGO_URL)
        try:
            db = c[DB_NAME]
            await db.entries.delete_many({"user_id": USER_ID, "date": "2026-07-01"})
        finally:
            c.close()
    try:
        asyncio.run(_clean())
    except Exception as e:
        print(f"cleanup warning: {e}")
