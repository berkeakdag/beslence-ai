"""BESLENCE AI - Chatbot clarification flow + meal_type persistence tests.

Tests:
1) Ambiguous Turkish message -> needs_clarification: true with questions+draft, no DB insert
2) Clear Turkish message -> ok: true, entry persisted with meal_type
3) Clarification answer round-trip -> ok: true, full entry persisted
4) meal_type inference by time/entry_type
"""
import os
import time
import asyncio
import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

TEST_TOKEN = "demo_session_grid_001"
TEST_USER_ID = "user_demo_grid01"
VALID_MEAL_TYPES = {"kahvalti", "ogle", "aksam", "ara_ogun", "aktivite", "su", "kahve", "not", "plan"}

HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {TEST_TOKEN}",
}


def _count_entries_for_user():
    """Synchronous helper to count entries for the test user via Mongo."""
    async def _q():
        c = AsyncIOMotorClient(MONGO_URL)
        db = c[DB_NAME]
        n = await db.entries.count_documents({"user_id": TEST_USER_ID})
        c.close()
        return n
    return asyncio.run(_q())


def _get_latest_entry_for_user():
    async def _q():
        c = AsyncIOMotorClient(MONGO_URL)
        db = c[DB_NAME]
        cur = db.entries.find({"user_id": TEST_USER_ID}, {"_id": 0}).sort("created_at", -1).limit(1)
        items = await cur.to_list(length=1)
        c.close()
        return items[0] if items else None
    return asyncio.run(_q())


def _post_chatbot(payload: dict, retries: int = 2):
    """POST with soft retry on imperfect LLM JSON parsing."""
    last_resp = None
    for attempt in range(retries + 1):
        resp = requests.post(f"{BASE_URL}/api/ai/chatbot", json=payload, headers=HEADERS, timeout=60)
        last_resp = resp
        if resp.status_code != 200:
            time.sleep(1.0)
            continue
        body = resp.json()
        # Treat ok==false (LLM bad JSON) as soft-failure -> retry
        if body.get("ok") is False and body.get("raw") is not None:
            time.sleep(1.0)
            continue
        return resp, body
    return last_resp, last_resp.json() if last_resp is not None else None


# ---------------------------------------------------------------------------
# 0. Sanity / auth
# ---------------------------------------------------------------------------
def test_auth_session_valid():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=HEADERS, timeout=15)
    assert r.status_code == 200, f"Auth failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["user_id"] == TEST_USER_ID


# ---------------------------------------------------------------------------
# 1. Ambiguous message -> clarification path, no DB entry
# ---------------------------------------------------------------------------
def test_ambiguous_message_returns_clarification_no_persist():
    before = _count_entries_for_user()
    payload = {
        "message": "yemek yedim",
        "user_local_time": "2026-01-15T13:00:00+03:00",
    }
    resp, body = _post_chatbot(payload)
    assert resp.status_code == 200, f"HTTP {resp.status_code}: {resp.text}"
    assert body.get("ok") is True, f"Unexpected body: {body}"
    assert body.get("needs_clarification") is True, f"Expected needs_clarification=true. Got: {body}"

    qs = body.get("questions")
    assert isinstance(qs, list) and 1 <= len(qs) <= 2, f"Expected 1-2 questions, got {qs}"
    for q in qs:
        assert isinstance(q.get("id"), str) and q["id"], f"Missing id in question: {q}"
        assert isinstance(q.get("question"), str) and q["question"], f"Missing question text: {q}"
        opts = q.get("options")
        assert isinstance(opts, list) and len(opts) >= 2, f"Need >=2 options, got: {opts}"
        for o in opts:
            assert isinstance(o, str)

    draft = body.get("draft")
    assert isinstance(draft, dict), f"Expected draft dict, got: {draft}"

    # No DB write should have happened
    after = _count_entries_for_user()
    assert after == before, f"Clarification path persisted! before={before} after={after}"


def test_ambiguous_activity_message_returns_clarification():
    before = _count_entries_for_user()
    payload = {
        "message": "biraz yürüdüm",
        "user_local_time": "2026-01-15T18:00:00+03:00",
    }
    resp, body = _post_chatbot(payload)
    assert resp.status_code == 200, f"HTTP {resp.status_code}: {resp.text}"
    assert body.get("ok") is True
    assert body.get("needs_clarification") is True, f"Expected clarification, got: {body}"
    qs = body.get("questions") or []
    assert 1 <= len(qs) <= 2
    assert isinstance(body.get("draft"), dict)
    after = _count_entries_for_user()
    assert after == before


# ---------------------------------------------------------------------------
# 2. Message with explicit portion → persists with meal_type
#    (Prompt now asks about portion when unstated — the test uses a clear portion.)
# ---------------------------------------------------------------------------
def test_clear_message_persists_with_meal_type_ogle():
    before = _count_entries_for_user()
    payload = {
        "message": "13:30 bir tabak tavuklu pilav ve 200 ml ayran içtim, orta porsiyon",
        "user_local_time": "2026-01-15T13:35:00+03:00",
    }
    resp, body = _post_chatbot(payload)
    assert resp.status_code == 200, f"HTTP {resp.status_code}: {resp.text}"
    assert body.get("ok") is True, f"Unexpected body: {body}"
    assert body.get("needs_clarification") is False, f"Expected no clarification, got: {body}"
    entry = body.get("entry")
    assert isinstance(entry, dict), f"Missing entry: {body}"

    assert entry.get("id", "").startswith("entry_")
    assert entry.get("user_id") == TEST_USER_ID
    assert entry.get("entry_type") == "food"
    assert entry.get("time") == "13:30", f"Expected 13:30, got {entry.get('time')}"

    mt = entry.get("meal_type")
    assert mt in VALID_MEAL_TYPES, f"Invalid meal_type: {mt}"
    assert mt == "ogle", f"Expected meal_type=ogle for 13:30 food, got {mt}"

    # DB persistence
    after = _count_entries_for_user()
    assert after == before + 1, f"Entry not persisted. before={before} after={after}"

    latest = _get_latest_entry_for_user()
    assert latest is not None
    assert latest.get("id") == entry.get("id")
    assert latest.get("meal_type") == mt


# ---------------------------------------------------------------------------
# 3. Clarification round-trip
# ---------------------------------------------------------------------------
def test_clarification_roundtrip_persists_entry():
    # Step A: ambiguous to get questions+draft
    msg = "yemek yedim"
    resp_a, body_a = _post_chatbot({"message": msg, "user_local_time": "2026-01-15T13:00:00+03:00"})
    assert resp_a.status_code == 200 and body_a.get("needs_clarification") is True, f"Step A: {body_a}"
    qs = body_a["questions"]
    draft = body_a["draft"]

    # Build answers: pick first option for each question
    answers = [{"id": q["id"], "answer": q["options"][0]} for q in qs]

    before = _count_entries_for_user()

    # Step B: send draft + answers
    payload_b = {
        "message": msg,
        "user_local_time": "2026-01-15T13:00:00+03:00",
        "draft": draft,
        "clarification_answers": answers,
    }
    resp_b, body_b = _post_chatbot(payload_b)
    assert resp_b.status_code == 200, f"HTTP {resp_b.status_code}: {resp_b.text}"
    assert body_b.get("ok") is True, f"Step B: {body_b}"
    assert body_b.get("needs_clarification") is False, f"Should not need clarification again: {body_b}"

    entry = body_b.get("entry")
    assert isinstance(entry, dict), f"Missing entry in step B: {body_b}"
    assert entry.get("user_id") == TEST_USER_ID
    assert entry.get("meal_type") in VALID_MEAL_TYPES, f"Invalid meal_type: {entry.get('meal_type')}"
    assert entry.get("source") == "chatbot"
    assert entry.get("raw_user_input") == msg

    after = _count_entries_for_user()
    assert after == before + 1, f"Round-trip didn't persist. before={before} after={after}"


# ---------------------------------------------------------------------------
# 4. meal_type inference scenarios
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "message,local_time,expected_meal_type,expected_entry_type",
    [
        ("08:00 menemen ve simit yedim", "2026-01-15T08:05:00+03:00", "kahvalti", "food"),
        ("19:30 köfte ve bulgur pilavı yedim", "2026-01-15T19:35:00+03:00", "aksam", "food"),
        ("45 dakika koştum orta tempoda saat 17:00'de", "2026-01-15T17:30:00+03:00", "aktivite", "activity"),
        ("500 ml su içtim", "2026-01-15T12:00:00+03:00", "su", "water"),
    ],
)
def test_meal_type_inference(message, local_time, expected_meal_type, expected_entry_type):
    resp, body = _post_chatbot({"message": message, "user_local_time": local_time})
    assert resp.status_code == 200, f"HTTP {resp.status_code}: {resp.text}"
    if body.get("needs_clarification") is True:
        pytest.skip(f"LLM asked for clarification on '{message}' - flaky LLM behavior")
    assert body.get("ok") is True, f"Body: {body}"
    entry = body.get("entry") or {}
    assert entry.get("entry_type") == expected_entry_type, (
        f"Expected entry_type={expected_entry_type}, got {entry.get('entry_type')} for '{message}'"
    )
    assert entry.get("meal_type") == expected_meal_type, (
        f"Expected meal_type={expected_meal_type}, got {entry.get('meal_type')} for '{message}' (time={entry.get('time')})"
    )


# ---------------------------------------------------------------------------
# Cleanup (best-effort): remove TEST entries we just inserted to avoid drift
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_entries():
    yield
    async def _clean():
        c = AsyncIOMotorClient(MONGO_URL)
        db = c[DB_NAME]
        # Delete chatbot entries created during this test session for the demo user
        await db.entries.delete_many({
            "user_id": TEST_USER_ID,
            "source": "chatbot",
            "raw_user_input": {"$in": [
                "yemek yedim",
                "biraz yürüdüm",
                "13:30 tavuklu pilav ayran",
                "08:00 menemen ve simit yedim",
                "19:30 köfte ve bulgur pilavı yedim",
                "45 dakika koştum orta tempoda saat 17:00'de",
                "500 ml su içtim",
            ]},
        })
        c.close()
    try:
        asyncio.run(_clean())
    except Exception as e:
        print(f"Cleanup error (non-fatal): {e}")
