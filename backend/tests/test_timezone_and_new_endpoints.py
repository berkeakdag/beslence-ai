"""BESLENCE AI backend tests — P0 timezone fix + PATCH endpoints + /report/daily.

Auth: fixed session `demo_session_grid_001` (user_demo_grid01) pre-seeded in Mongo.
"""
import os
import time
import pytest
import requests
from pathlib import Path
from dotenv import dotenv_values


def _base_url() -> str:
    env = dotenv_values(Path("/app/frontend/.env"))
    url = env.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    assert url, "EXPO_PUBLIC_BACKEND_URL missing from /app/frontend/.env"
    return url.rstrip("/")


BASE_URL = _base_url()
TOKEN = "demo_session_grid_001"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def _post_chatbot(api, body, retries=1):
    """POST /ai/chatbot with 1 retry on bad-JSON (ok:false)."""
    for _ in range(retries + 1):
        r = api.post(f"{BASE_URL}/api/ai/chatbot", json=body, timeout=60)
        assert r.status_code == 200, f"chatbot HTTP {r.status_code}: {r.text[:200]}"
        data = r.json()
        if data.get("ok") is False and "raw" in data:
            time.sleep(1)
            continue
        return data
    return data


# ---------------------------------------------------------------------------
# 1) P0 TIMEZONE FIX
# ---------------------------------------------------------------------------
class TestTimezoneFix:
    def test_1a_istanbul_offset_preserved(self, api):
        """+03:00 input → time preserved as 19:15, date as 2026-07-01."""
        data = _post_chatbot(api, {
            "message": "1 bardak su ekle",
            "user_local_time": "2026-07-01T19:15:00+03:00",
        })
        assert data.get("ok") is True, f"unexpected: {data}"
        assert data.get("needs_clarification") is False, f"unexpected clarification: {data}"
        entry = data.get("entry") or {}
        assert entry.get("time") == "19:15", f"time={entry.get('time')} (want 19:15)"
        assert entry.get("date") == "2026-07-01", f"date={entry.get('date')} (want 2026-07-01)"

    def test_1b_utc_converted_to_istanbul(self, api):
        """UTC Z input → converted to +03:00 → 19:15."""
        data = _post_chatbot(api, {
            "message": "1 bardak su ekle",
            "user_local_time": "2026-07-01T16:15:00Z",
        })
        assert data.get("ok") is True, f"unexpected: {data}"
        assert data.get("needs_clarification") is False, f"unexpected clarification: {data}"
        entry = data.get("entry") or {}
        assert entry.get("time") == "19:15", f"time={entry.get('time')} (want 19:15 after UTC->TR conversion)"
        assert entry.get("date") == "2026-07-01", f"date={entry.get('date')}"

    def test_1c_assistant_does_not_use_message_time(self, api):
        """'yarın 20:00 pizza yedim' + user_local_time=14:30 → entry.time == 14:30 (current), date == today."""
        data = _post_chatbot(api, {
            "message": "yarın 20:00 pizza yedim",
            "user_local_time": "2026-07-01T14:30:00+03:00",
        })
        # This message may trigger clarification (portion) — retry with portion hint if so.
        if data.get("needs_clarification") is True:
            draft = data.get("draft") or {}
            questions = data.get("questions") or []
            answers = [{"id": q.get("id", f"q{i+1}"), "answer": (q.get("options") or ["orta"])[0]}
                       for i, q in enumerate(questions)]
            data = _post_chatbot(api, {
                "message": "yarın 20:00 pizza yedim",
                "user_local_time": "2026-07-01T14:30:00+03:00",
                "draft": draft,
                "clarification_answers": answers,
            })
        assert data.get("ok") is True, f"unexpected: {data}"
        entry = data.get("entry") or {}
        assert entry.get("time") == "14:30", (
            f"time={entry.get('time')} — assistant must stamp CURRENT Istanbul time, not '20:00' from message"
        )
        assert entry.get("date") == "2026-07-01", (
            f"date={entry.get('date')} — must be today (2026-07-01), not tomorrow"
        )


# ---------------------------------------------------------------------------
# 2) PATCH /api/entries/{id}/time
# ---------------------------------------------------------------------------
class TestPatchTime:
    def test_patch_time_valid_and_persisted(self, api):
        data = _post_chatbot(api, {
            "message": "1 bardak su ekle",
            "user_local_time": "2026-07-01T19:15:00+03:00",
        })
        assert data.get("ok") is True
        entry = data["entry"]
        eid = entry["id"]
        date_str = entry["date"]

        r = api.patch(f"{BASE_URL}/api/entries/{eid}/time", json={"time": "08:30"})
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text}"
        assert r.json() == {"ok": True}

        # Verify via GET /entries?date=
        g = api.get(f"{BASE_URL}/api/entries", params={"date": date_str})
        assert g.status_code == 200
        found = [e for e in g.json().get("entries", []) if e.get("id") == eid]
        assert found, f"entry {eid} missing on {date_str}"
        assert found[0]["time"] == "08:30", f"time not persisted: {found[0]['time']}"

    def test_patch_time_invalid_format_returns_400(self, api):
        data = _post_chatbot(api, {
            "message": "1 bardak su ekle",
            "user_local_time": "2026-07-01T19:15:00+03:00",
        })
        eid = data["entry"]["id"]
        r = api.patch(f"{BASE_URL}/api/entries/{eid}/time", json={"time": "25:99"})
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"


# ---------------------------------------------------------------------------
# 3) PATCH /api/entries/{id}/amount
# ---------------------------------------------------------------------------
class TestPatchAmount:
    def test_scale_food_portion(self, api):
        # Create a food entry (may need clarification)
        payload = {
            "message": "1 tabak tavuklu pilav, orta porsiyon",
            "user_local_time": "2026-07-01T13:30:00+03:00",
        }
        data = _post_chatbot(api, payload)
        if data.get("needs_clarification"):
            draft = data.get("draft") or {}
            answers = [{"id": q.get("id", f"q{i+1}"), "answer": (q.get("options") or ["orta"])[0]}
                       for i, q in enumerate(data.get("questions") or [])]
            data = _post_chatbot(api, {**payload, "draft": draft, "clarification_answers": answers})
        assert data.get("ok") is True, f"could not create food entry: {data}"
        entry = data["entry"]
        eid = entry["id"]
        cal_min0 = entry.get("calories_min") or 0
        cal_max0 = entry.get("calories_max") or 0

        # PATCH amount=2 porsiyon → expect calories roughly ~2x
        r = api.patch(f"{BASE_URL}/api/entries/{eid}/amount",
                      json={"amount": 2, "unit": "porsiyon"})
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("ok") is True
        updates = body.get("updates") or {}
        # Verify approx 2x scaling
        if cal_min0 > 0:
            new_min = updates.get("calories_min", 0)
            ratio = new_min / cal_min0
            assert 1.8 <= ratio <= 2.2, f"calories_min scale off: {cal_min0}->{new_min} ratio={ratio}"
        if cal_max0 > 0:
            new_max = updates.get("calories_max", 0)
            ratio = new_max / cal_max0
            assert 1.8 <= ratio <= 2.2, f"calories_max scale off: {cal_max0}->{new_max} ratio={ratio}"

    def test_scale_water_ml(self, api):
        data = _post_chatbot(api, {
            "message": "1 bardak su ekle",
            "user_local_time": "2026-07-01T10:00:00+03:00",
        })
        assert data.get("ok") is True and data["entry"]["entry_type"] == "water"
        eid = data["entry"]["id"]
        r = api.patch(f"{BASE_URL}/api/entries/{eid}/amount",
                      json={"amount": 330, "unit": "ml"})
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text}"
        # Verify persistence
        g = api.get(f"{BASE_URL}/api/entries/{eid}")
        assert g.status_code == 200
        assert g.json().get("water_ml") == 330, f"water_ml not updated: {g.json().get('water_ml')}"

    def test_patch_amount_nonexistent_id_returns_404(self, api):
        r = api.patch(f"{BASE_URL}/api/entries/entry_doesnotexist999/amount",
                      json={"amount": 2, "unit": "porsiyon"})
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"


# ---------------------------------------------------------------------------
# 4) GET /api/report/daily
# ---------------------------------------------------------------------------
class TestDailyReport:
    def test_report_structure_for_seed_day(self, api):
        r = api.get(f"{BASE_URL}/api/report/daily", params={"date": "2026-06-30"})
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
        d = r.json()

        totals = d.get("totals")
        assert isinstance(totals, dict), "totals missing"
        for k in ("calories", "calories_delta", "protein_g", "carbohydrate_g", "fat_g",
                  "fiber_g", "water_ml", "water_target_ml", "activity_minutes", "entry_count"):
            assert k in totals, f"totals missing key: {k}"
            assert isinstance(totals[k], (int, float)), f"totals[{k}] not numeric: {type(totals[k])}"

        warnings = d.get("warnings")
        assert isinstance(warnings, list), "warnings not a list"
        for w in warnings:
            assert set(w.keys()) >= {"id", "title", "text"}, f"warning shape invalid: {w}"

        # Likely trips water (seed has ~800/2400) and/or diversity
        warning_ids = {w["id"] for w in warnings}
        # sanity: at least one of these should trip on the seed
        assert warning_ids & {"water", "diversity"}, f"expected water or diversity warning; got {warning_ids}"

        meals = d.get("meals")
        assert isinstance(meals, list), "meals not a list"
        # Seed has ~10 entries
        assert len(meals) >= 1, f"meals empty: {meals}"
        for m in meals:
            for k in ("id", "time", "title", "entry_type", "meal_type",
                      "calories", "water_ml", "duration_minutes"):
                assert k in m, f"meal missing key {k}: {m}"

        disc = d.get("disclaimer") or ""
        assert disc.endswith("Kişisel öneriler için diyetisyen desteği gerekir."), \
            f"disclaimer tail wrong: {disc[-80:]}"

        groups = d.get("food_groups_hit")
        assert isinstance(groups, list), "food_groups_hit not a list"
        assert all(isinstance(g, str) for g in groups), "food_groups_hit contains non-string"


# ---------------------------------------------------------------------------
# 5) REGRESSION — clarification round-trip
# ---------------------------------------------------------------------------
class TestClarificationRoundtrip:
    def test_ambiguous_then_answer(self, api):
        first = _post_chatbot(api, {
            "message": "yemek yedim",
            "user_local_time": "2026-07-01T13:30:00+03:00",
        })
        assert first.get("ok") is True
        assert first.get("needs_clarification") is True, f"expected clarification: {first}"
        questions = first.get("questions") or []
        assert isinstance(questions, list) and len(questions) >= 1, f"no questions: {first}"
        for q in questions:
            assert set(q.keys()) >= {"id", "question", "options"}, f"question shape: {q}"
            assert isinstance(q["options"], list) and len(q["options"]) >= 2
        draft = first.get("draft")
        assert isinstance(draft, dict), "draft missing"

        # Answer with first option of each question
        answers = [{"id": q["id"], "answer": q["options"][0]} for q in questions]
        second = _post_chatbot(api, {
            "message": "yemek yedim",
            "user_local_time": "2026-07-01T13:30:00+03:00",
            "draft": draft,
            "clarification_answers": answers,
        })
        assert second.get("ok") is True, f"round-trip failed: {second}"
        assert second.get("needs_clarification") is False, f"still asking: {second}"
        entry = second.get("entry") or {}
        assert entry.get("id"), "no entry id"
        valid_meal_types = {"kahvalti", "ogle", "aksam", "ara_ogun", "aktivite",
                            "su", "kahve", "not", "plan"}
        assert entry.get("meal_type") in valid_meal_types, f"invalid meal_type: {entry.get('meal_type')}"
