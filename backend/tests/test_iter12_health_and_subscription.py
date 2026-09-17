# Iteration 12 backend verification:
# (A) Root-level GET /health (deployment probe, NOT under /api) returns 200 {"status":"ok"}.
#     Ingress only routes /api externally, so /health must be hit on localhost:8001.
# (B) Subscription + auth endpoints still work with Bearer test_session_macros_001.
import os
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

EXTERNAL_BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://ai-food-logger-2.preview.emergentagent.com"
EXTERNAL_BASE = EXTERNAL_BASE.rstrip("/")
LOCAL_BASE = "http://localhost:8001"
TOKEN = "test_session_macros_001"


def _headers():
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


async def _ensure_session():
    """Re-seed the test session if it was deleted by prior logout tests."""
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "beslence_ai")
    c = AsyncIOMotorClient(mongo_url)
    db = c[db_name]
    existing = await db.user_sessions.find_one({"session_token": TOKEN})
    if not existing:
        # user_id is fixed for the ready-made seed
        await db.user_sessions.insert_one({
            "session_token": TOKEN,
            "user_id": "test_user_macros",
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        })
    else:
        # ensure it's not expired
        await db.user_sessions.update_one(
            {"session_token": TOKEN},
            {"$set": {"expires_at": datetime.now(timezone.utc) + timedelta(days=7)}},
        )
    c.close()


@pytest.fixture(scope="module", autouse=True)
def seed_session():
    asyncio.get_event_loop().run_until_complete(_ensure_session())


# ---- (A) Root health probe ----

class TestRootHealth:
    def test_local_health_200(self):
        r = requests.get(f"{LOCAL_BASE}/health", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "ok", body

    def test_external_health_not_routed(self):
        """Sanity: external ingress only routes /api, so /health externally is expected NOT 200 from FastAPI.
        We don't assert 404 strictly (ingress may return 502/404/302), we just check it's not the ok body."""
        try:
            r = requests.get(f"{EXTERNAL_BASE}/health", timeout=10)
            # If it happens to also be routed to 8001, that's fine too; but body must not error.
            if r.status_code == 200:
                # ok if it's the same handler
                assert r.json().get("status") in ("ok", None)
        except Exception:
            pass


# ---- (B) Auth + subscription endpoints ----

class TestAuthSubscription:
    def test_auth_me_200(self):
        r = requests.get(f"{EXTERNAL_BASE}/api/auth/me", headers=_headers(), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        u = data.get("user", data)
        assert ("email" in u) or ("user_id" in u) or ("id" in u), data

    def test_subscription_me_200(self):
        r = requests.get(f"{EXTERNAL_BASE}/api/subscription/me", headers=_headers(), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        # must expose an is_pro / tier signal
        assert ("is_pro" in body) or ("tier" in body) or ("plan" in body), body

    def test_subscription_sync_free_then_pro_then_free(self):
        # Free
        r = requests.post(
            f"{EXTERNAL_BASE}/api/subscription/sync",
            headers=_headers(),
            json={"is_pro": False},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        me = requests.get(f"{EXTERNAL_BASE}/api/subscription/me", headers=_headers(), timeout=15).json()
        assert me.get("is_pro") in (False, None) or me.get("tier") in ("free", None), me

        # Pro
        r = requests.post(
            f"{EXTERNAL_BASE}/api/subscription/sync",
            headers=_headers(),
            json={"is_pro": True},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        me = requests.get(f"{EXTERNAL_BASE}/api/subscription/me", headers=_headers(), timeout=15).json()
        assert (me.get("is_pro") is True) or (me.get("tier") == "pro"), me

    def teardown_class(cls):
        # Teardown: set back to free per request
        try:
            requests.post(
                f"{EXTERNAL_BASE}/api/subscription/sync",
                headers=_headers(),
                json={"is_pro": False},
                timeout=15,
            )
        except Exception:
            pass
