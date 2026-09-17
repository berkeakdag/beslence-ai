"""Iteration 9 backend tests — subscription, reminders, register-push, account delete, macros regression."""
import os
import time
import uuid
import asyncio
import pytest
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Resolve base URL from frontend/.env (EXPO_PUBLIC_BACKEND_URL)
BASE_URL = None
fe_env = Path(__file__).parent.parent.parent / "frontend" / ".env"
for line in fe_env.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip()
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL missing"
BASE_URL = BASE_URL.rstrip("/")

TOKEN = "test_session_macros_001"
H_JSON = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
H = {"Authorization": f"Bearer {TOKEN}"}

IST = timezone(timedelta(hours=3))


# ---------- Health / Auth sanity ----------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200

    def test_auth_me(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=H, timeout=15)
        assert r.status_code == 200, r.text
        u = r.json().get("user") or {}
        assert u.get("user_id") == "test_user_macros"


# ---------- Subscription (GET / SYNC / WEBHOOK) ----------
class TestSubscription:
    def test_a_reset_free_via_sync(self):
        r = requests.post(f"{BASE_URL}/api/subscription/sync", headers=H_JSON, json={"is_pro": False}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("tier") == "free"

    def test_b_get_me_returns_free(self):
        r = requests.get(f"{BASE_URL}/api/subscription/me", headers=H, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("tier") == "free"
        assert d.get("is_pro") is False

    def test_c_sync_flip_to_pro(self):
        r = requests.post(f"{BASE_URL}/api/subscription/sync", headers=H_JSON,
                          json={"is_pro": True, "expires_at": "2099-01-01T00:00:00Z", "store": "app_store"}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("tier") == "pro"

        r2 = requests.get(f"{BASE_URL}/api/subscription/me", headers=H, timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("is_pro") is True

    def test_d_webhook_expiration_flips_back_to_free(self):
        r = requests.post(f"{BASE_URL}/api/webhooks/revenuecat",
                          json={"event": {"type": "EXPIRATION", "app_user_id": "test_user_macros"}}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("received") is True

        r2 = requests.get(f"{BASE_URL}/api/subscription/me", headers=H, timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("tier") == "free"

    def test_e_webhook_initial_purchase_flips_pro(self):
        r = requests.post(f"{BASE_URL}/api/webhooks/revenuecat",
                          json={"event": {"type": "INITIAL_PURCHASE", "app_user_id": "test_user_macros",
                                          "store": "play_store", "expiration_at_ms": 9999999999999}}, timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/subscription/me", headers=H, timeout=15)
        assert r2.json().get("is_pro") is True

    def test_f_cleanup_reset_free(self):
        # leave macros user in free state after suite
        r = requests.post(f"{BASE_URL}/api/subscription/sync", headers=H_JSON, json={"is_pro": False}, timeout=15)
        assert r.status_code == 200


# ---------- Register push (placeholder key => 500) ----------
class TestRegisterPush:
    def test_register_push_returns_500_placeholder(self):
        r = requests.post(f"{BASE_URL}/api/register-push",
                          json={"user_id": "test_user_macros", "platform": "ios", "device_token": "fake_token_xyz"},
                          timeout=20)
        assert r.status_code == 500, r.text
        detail = (r.json() or {}).get("detail", "")
        assert "EMERGENT_PUSH_KEY" in detail or "missing" in detail.lower() or "invalid" in detail.lower()


# ---------- Reminder entry + scheduler ----------
class TestReminderEntry:
    entry_id = None
    reminder_date = None

    @classmethod
    def setup_class(cls):
        now = datetime.now(IST)
        # Reminder scheduled 20 seconds ago -> should be picked by scheduler within ~30s.
        past = now - timedelta(seconds=20)
        cls.reminder_date = past.strftime("%Y-%m-%d")
        cls.reminder_hhmm = past.strftime("%H:%M")

    def test_a_create_reminder_entry(self):
        payload = {
            "date": self.reminder_date,
            "time": self.reminder_hhmm,
            "entry_type": "reminder",
            "meal_type": "hatirlatici",
            "title": "TEST hatirlatici iter9",
            "status": "planned",
            "source": "manual",
            "raw_user_input": "test hatirlatici",
        }
        r = requests.post(f"{BASE_URL}/api/entries", headers=H_JSON, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("entry_type") == "reminder"
        assert d.get("meal_type") == "hatirlatici"
        assert d.get("time") in (self.reminder_hhmm, f"{self.reminder_hhmm}:00")
        TestReminderEntry.entry_id = d["id"]

    def test_b_reminder_appears_in_list(self):
        r = requests.get(f"{BASE_URL}/api/entries?date={self.reminder_date}", headers=H, timeout=15)
        assert r.status_code == 200
        items = r.json()["entries"]
        assert any(it["id"] == TestReminderEntry.entry_id and it["entry_type"] == "reminder" for it in items)

    def test_c_scheduler_marks_notified(self):
        # scheduler runs every 30s — wait up to 75s
        eid = TestReminderEntry.entry_id
        found_notified = False
        for _ in range(15):
            time.sleep(5)
            r = requests.get(f"{BASE_URL}/api/entries?date={self.reminder_date}", headers=H, timeout=15)
            if r.status_code != 200:
                continue
            for it in r.json().get("entries", []):
                if it["id"] == eid and it.get("notified") is True:
                    found_notified = True
                    break
            if found_notified:
                break
        assert found_notified, "Scheduler did not mark reminder as notified within 75s (placeholder push should still set notified=True)"

    @classmethod
    def teardown_class(cls):
        if cls.entry_id:
            requests.delete(f"{BASE_URL}/api/entries/{cls.entry_id}", headers=H, timeout=10)


# ---------- Delete account (disposable seeded user) ----------
class TestDeleteAccount:
    disposable_token = None
    disposable_uid = None

    @classmethod
    def setup_class(cls):
        # Seed disposable user + session directly in Mongo
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "beslence_ai")

        cls.disposable_uid = f"test_disposable_{uuid.uuid4().hex[:8]}"
        cls.disposable_token = f"test_session_disposable_{uuid.uuid4().hex[:8]}"

        async def _seed():
            c = AsyncIOMotorClient(mongo_url)
            db = c[db_name]
            await db.users.insert_one({
                "user_id": cls.disposable_uid,
                "email": f"{cls.disposable_uid}@example.com",
                "name": "Disposable",
                "picture": "",
                "created_at": datetime.now(timezone.utc),
            })
            # expires_at MUST be datetime, not string
            await db.user_sessions.insert_one({
                "session_token": cls.disposable_token,
                "user_id": cls.disposable_uid,
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
            })
            # seed one entry to verify cascade deletion
            await db.entries.insert_one({
                "id": f"entry_{uuid.uuid4().hex[:12]}",
                "user_id": cls.disposable_uid,
                "date": datetime.now(IST).strftime("%Y-%m-%d"),
                "time": "12:00",
                "entry_type": "food",
                "title": "TEST_disposable_entry",
            })
            c.close()

        asyncio.get_event_loop().run_until_complete(_seed()) if not asyncio.get_event_loop().is_running() else asyncio.run(_seed())

    def test_a_auth_me_works(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {self.disposable_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["user_id"] == self.disposable_uid

    def test_b_delete_account_removes_all(self):
        r = requests.delete(f"{BASE_URL}/api/auth/account",
                            headers={"Authorization": f"Bearer {self.disposable_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("deleted") is True

    def test_c_token_now_invalid(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {self.disposable_token}"}, timeout=15)
        assert r.status_code == 401

    def test_d_user_and_entries_gone_in_mongo(self):
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "beslence_ai")

        async def _check():
            c = AsyncIOMotorClient(mongo_url)
            db = c[db_name]
            u = await db.users.find_one({"user_id": self.disposable_uid})
            s = await db.user_sessions.find_one({"session_token": self.disposable_token})
            e_count = await db.entries.count_documents({"user_id": self.disposable_uid})
            c.close()
            return u, s, e_count

        u, s, e_count = asyncio.run(_check())
        assert u is None, "user doc still exists"
        assert s is None, "session doc still exists"
        assert e_count == 0, f"entries still present: {e_count}"


# ---------- Macros PATCH regression + summary/report ----------
class TestMacrosAndReports:
    entry_id = None
    today = datetime.now(IST).strftime("%Y-%m-%d")

    def test_a_create_food_entry(self):
        payload = {
            "date": self.today, "time": "12:30", "entry_type": "food",
            "title": "TEST macros iter9", "status": "past_logged",
            "source": "manual", "raw_user_input": "TEST macros",
        }
        r = requests.post(f"{BASE_URL}/api/entries", headers=H_JSON, json=payload, timeout=15)
        assert r.status_code == 200
        TestMacrosAndReports.entry_id = r.json()["id"]

    def test_b_patch_macros_computes_kcal(self):
        # 30P, 40C, 10F -> 4*30 + 4*40 + 9*10 = 120+160+90 = 370
        r = requests.patch(f"{BASE_URL}/api/entries/{self.entry_id}/macros",
                           headers=H_JSON,
                           json={"protein_g": 30, "carbohydrate_g": 40, "fat_g": 10}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("calories") == 370, d
        # verify persisted
        g = requests.get(f"{BASE_URL}/api/entries/{self.entry_id}", headers=H, timeout=15)
        assert g.status_code == 200
        e = g.json()
        assert e["calories_min"] == 370 and e["calories_max"] == 370
        assert e["protein_g_min"] == 30 and e["protein_g_max"] == 30

    def test_c_summary_daily_200(self):
        r = requests.get(f"{BASE_URL}/api/summary/daily?date={self.today}", headers=H, timeout=20)
        assert r.status_code == 200

    def test_d_report_daily_200(self):
        r = requests.get(f"{BASE_URL}/api/report/daily?date={self.today}", headers=H, timeout=30)
        assert r.status_code == 200

    @classmethod
    def teardown_class(cls):
        if cls.entry_id:
            requests.delete(f"{BASE_URL}/api/entries/{cls.entry_id}", headers=H, timeout=10)
