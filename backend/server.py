"""BESLENCE AI Backend - FastAPI app."""
from fastapi import FastAPI, APIRouter, HTTPException, Header, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Any, Dict
from datetime import datetime, timezone, timedelta, date as date_cls
import os
import uuid
import asyncio
import logging
import json
import re
import httpx
import base64

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from openai import AsyncOpenAI

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
# Emergent managed service base URLs (env-driven for deployment control)
EMERGENT_AUTH_URL = os.environ["EMERGENT_AUTH_URL"]
EMERGENT_INTEGRATIONS_URL = os.environ["EMERGENT_INTEGRATIONS_URL"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("beslence")

app = FastAPI(title="BESLENCE AI")


@app.get("/health")
async def health():
    """Deployment health probe — must return 200 for the build/deploy pipeline."""
    return {"status": "ok"}
api = APIRouter(prefix="/api")


# --- Temporary source export download (remove after user has downloaded) ---
_EXPORT_DIR = ROOT_DIR / "exports"


@api.get("/export/source/{token}")
async def download_source_export(token: str):
    from fastapi.responses import FileResponse
    token_file = _EXPORT_DIR / ".token"
    zip_file = _EXPORT_DIR / "beslence-ai-source.zip"
    if not token_file.exists() or not zip_file.exists() or token != token_file.read_text().strip():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(str(zip_file), media_type="application/zip", filename="beslence-ai-source.zip")


GEMINI_MODEL = "gemini-3-flash-preview"
NUTRITION_SYSTEM_PROMPT = (
    "Sen BESLENCE AI'nin kayıt asistanı 'Asistanım'sın. Yalnızca kayıt oluşturmak, "
    "saatleri algılamak ve makro/kalori tahmini yapmak için varsın.\n\n"
    "DİL VE TON KURALLARI (KESİN):\n"
    "- Türkçe, sıcak, kısa ve yargısız konuş. Motivasyon abartma; 'harikasın', 'muhteşem', 'bravo' gibi ifadeler KULLANMA. "
    "Nötr ve işlevsel ol. Emoji nadiren kullan.\n"
    "- Sağlık, hastalık, tanı, ilaç, hormon, metabolizma, kilo kaybı/kazanımı, kas gelişimi, "
    "recovery window vb. hakkında ASLA yorum yapma. Tavsiye vermezsin.\n"
    "- Kullanıcı hastalık veya sağlık durumu sorarsa şu cevabı ver: "
    "'Sağlık durumuna özel öneri için diyetisyen görüşmesi gerekir. Ben sadece kayıt ve "
    "genel hatırlatma için buradayım.'\n"
    "- 'Berke Skoru', 'sağlık puanı', klinik terim veya iddia KULLANMA.\n\n"
    "GÖREV: Kullanıcı Türkçe mesaj yazar; sen tek bir geçerli JSON döndürürsün. Başka metin yazma."
)



# =====================================================================
# MODELS
# =====================================================================
class GoogleSessionPayload(BaseModel):
    session_id: str


class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""


class ProfileIn(BaseModel):
    name: str = ""
    age: Optional[int] = None
    sex: Optional[str] = ""  # kadin | erkek | belirtmek_istemiyorum
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    target_weight_kg: Optional[float] = None
    waist_cm: Optional[float] = None
    neck_cm: Optional[float] = None
    hip_cm: Optional[float] = None
    body_fat_percent: Optional[float] = None
    goal_primary: str = ""  # kilo_vermek | yag_yakmak | kas_kazanmak | kilo_korumak | performans | saglikli_beslenmek | takip
    goal_secondary: List[str] = []
    daily_activity_level: str = "orta_aktif"  # cok_hareketsiz | hafif_aktif | orta_aktif | aktif | cok_aktif
    sports_frequency: str = "yok"
    sports_types: List[str] = []
    average_training_duration_minutes: Optional[int] = None
    average_training_intensity: str = ""
    selected_theme: Literal["sakin", "sportif"] = "sakin"
    notifications_enabled: bool = True


class EntryIn(BaseModel):
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    entry_type: str  # food, activity, water, coffee, sleep, note, photo_food
    status: str = "past_logged"  # planned, completed, current_logged, past_logged, skipped, modified
    timeline_bubble_type: str = "meal"
    source: str = "manual"
    raw_user_input: str = ""
    photo_base64: Optional[str] = None
    foods: List[Dict[str, Any]] = []
    activity: List[Dict[str, Any]] = []
    calories_min: Optional[float] = None
    calories_max: Optional[float] = None
    protein_g_min: Optional[float] = None
    protein_g_max: Optional[float] = None
    carbohydrate_g_min: Optional[float] = None
    carbohydrate_g_max: Optional[float] = None
    fat_g_min: Optional[float] = None
    fat_g_max: Optional[float] = None
    fiber_g_min: Optional[float] = None
    fiber_g_max: Optional[float] = None
    water_ml: Optional[float] = None
    duration_minutes: Optional[int] = None
    intensity: str = ""
    estimated_activity_burn_min: Optional[float] = None
    estimated_activity_burn_max: Optional[float] = None
    system_summary: str = ""
    note: str = ""
    title: str = ""
    meal_type: str = ""  # kahvalti | ogle | aksam | ara_ogun | aktivite | su | kahve | not | plan


class EntryStatusUpdate(BaseModel):
    status: str


class ClarificationAnswer(BaseModel):
    id: str
    answer: str


class ChatbotIn(BaseModel):
    message: str
    user_local_time: Optional[str] = None  # ISO local time for "now" reference
    draft: Optional[Dict[str, Any]] = None  # previous draft when answering clarification
    clarification_answers: Optional[List[ClarificationAnswer]] = None


class FoodLookupIn(BaseModel):
    query: str


# =====================================================================
# AUTH HELPERS
# =====================================================================
async def get_user_from_token(authorization: Optional[str]) -> Optional[Dict[str, Any]]:
    if not authorization:
        return None
    if not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session.get("expires_at")
    if expires_at is not None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user


async def require_user(authorization: Optional[str]) -> Dict[str, Any]:
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user


# =====================================================================
# HEALTH
# =====================================================================
@api.get("/")
async def root():
    return {"app": "BESLENCE AI", "status": "ok"}


# =====================================================================
# AUTH ROUTES (Emergent Google Auth)
# =====================================================================
@api.post("/auth/google-session")
async def google_session(payload: GoogleSessionPayload):
    """Exchange Emergent session_id for our app session token."""
    async with httpx.AsyncClient(timeout=15) as hc:
        resp = await hc.get(
            EMERGENT_AUTH_URL + "/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = resp.json()
    email = data.get("email")
    name = data.get("name", "")
    picture = data.get("picture", "")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Missing email/session_token")

    # Upsert user by email
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        uid = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": uid,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc),
            "profile": None,
        }
        await db.users.insert_one(user.copy())
    user.pop("_id", None)

    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token,
            "user_id": user["user_id"],
            "created_at": datetime.now(timezone.utc),
            "expires_at": expires,
        }},
        upsert=True,
    )
    return {
        "session_token": session_token,
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user.get("name", ""),
            "picture": user.get("picture", ""),
        },
        "has_profile": bool(user.get("profile")),
    }


@api.get("/auth/me")
async def auth_me(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    return {
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user.get("name", ""),
            "picture": user.get("picture", ""),
        },
        "has_profile": bool(user.get("profile")),
        "profile": user.get("profile"),
        "plan": user.get("plan"),
    }


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# =====================================================================
# PROFILE + PLAN CALC
# =====================================================================
ACTIVITY_FACTOR = {
    "cok_hareketsiz": 1.20,
    "hafif_aktif": 1.30,
    "orta_aktif": 1.40,
    "aktif": 1.50,
    "cok_aktif": 1.60,
}

# BESLENCE AI: at onboarding we never ask for activity; the base maintenance
# calorie always uses 1.20. Activities are added later via the timeline and
# only affect the calorie goal of the day they were logged on.
BASE_FACTOR = 1.20


def calc_plan(p: dict) -> dict:
    sex = p.get("sex") or "kadin"
    age = p.get("age") or 30
    height = p.get("height_cm") or 170
    weight = p.get("weight_kg") or 70
    goal = p.get("goal_primary") or "takip"
    factor = BASE_FACTOR

    if sex == "erkek":
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age - 161

    maintenance = bmr * factor

    if goal == "kilo_vermek":
        cal_min = maintenance * 0.80
        cal_max = maintenance * 0.90
    elif goal == "yag_yakmak":
        cal_min = maintenance * 0.85
        cal_max = maintenance * 0.90
    elif goal == "kas_kazanmak":
        cal_min = maintenance * 1.05
        cal_max = maintenance * 1.15
    elif goal == "performans":
        cal_min = maintenance * 1.00
        cal_max = maintenance * 1.10
    elif goal == "kilo_korumak":
        cal_min = maintenance * 0.97
        cal_max = maintenance * 1.03
    else:
        cal_min = maintenance * 0.95
        cal_max = maintenance * 1.05

    # safety floor
    floor = 1500 if sex == "erkek" else 1200
    if cal_min < floor:
        cal_min = floor
        cal_max = max(cal_max, floor + 100)

    # protein
    if goal in ("kas_kazanmak",):
        protein_min = 1.6 * weight
        protein_max = 2.2 * weight
    elif goal in ("kilo_vermek", "yag_yakmak"):
        protein_min = 1.4 * weight
        protein_max = 1.8 * weight
    elif goal in ("performans",):
        protein_min = 1.4 * weight
        protein_max = 2.0 * weight
    else:
        protein_min = 0.9 * weight
        protein_max = 1.4 * weight

    # fat (25-30% of midpoint calories)
    mid_cal = (cal_min + cal_max) / 2
    fat_min = mid_cal * 0.22 / 9
    fat_max = mid_cal * 0.32 / 9

    # carbs = remainder
    protein_mid = (protein_min + protein_max) / 2
    fat_mid = (fat_min + fat_max) / 2
    carb_min = max(50, (cal_min - protein_mid * 4 - fat_max * 9) / 4)
    carb_max = max(80, (cal_max - protein_mid * 4 - fat_min * 9) / 4)

    fiber_min = 25
    fiber_max = 30

    water_min = (30 * weight) / 1000
    water_max = (35 * weight) / 1000

    return {
        "bmr_kcal": round(bmr),
        "maintenance_calories": round(maintenance),
        "goal_calories_min": round(cal_min),
        "goal_calories_max": round(cal_max),
        "protein_g_min": round(protein_min),
        "protein_g_max": round(protein_max),
        "carbohydrate_g_min": round(carb_min),
        "carbohydrate_g_max": round(carb_max),
        "fat_g_min": round(fat_min),
        "fat_g_max": round(fat_max),
        "fiber_g_target_min": fiber_min,
        "fiber_g_target_max": fiber_max,
        "water_liter_min": round(water_min, 1),
        "water_liter_max": round(water_max, 1),
        "daily_activity_factor": factor,
    }


@api.post("/profile")
async def save_profile(payload: ProfileIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    profile = payload.model_dump()
    plan = calc_plan(profile)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"profile": profile, "plan": plan, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"profile": profile, "plan": plan}


@api.get("/profile")
async def get_profile(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    return {"profile": user.get("profile"), "plan": user.get("plan")}


@api.patch("/profile/theme")
async def update_theme(payload: Dict[str, str], authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    theme = payload.get("selected_theme", "sakin")
    if theme not in ("sakin", "sportif"):
        raise HTTPException(status_code=400, detail="Invalid theme")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"profile.selected_theme": theme}},
    )
    return {"selected_theme": theme}


@api.patch("/profile/notifications")
async def update_notifications_pref(payload: Dict[str, bool], authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    enabled = bool(payload.get("enabled", True))
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"profile.notifications_enabled": enabled}},
    )
    return {"notifications_enabled": enabled}


# =====================================================================
# ENTRIES (Timeline)
# =====================================================================
@api.post("/entries")
async def create_entry(payload: EntryIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    entry = payload.model_dump()
    entry["id"] = f"entry_{uuid.uuid4().hex[:12]}"
    entry["user_id"] = user["user_id"]
    entry["created_at"] = datetime.now(timezone.utc).isoformat()
    # photo_base64 may be large - we still store for MVP
    await db.entries.insert_one(entry.copy())
    entry.pop("_id", None)
    return entry


@api.get("/entries")
async def list_entries(
    date: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    user = await require_user(authorization)
    query: Dict[str, Any] = {"user_id": user["user_id"]}
    if date:
        query["date"] = date
    elif start and end:
        query["date"] = {"$gte": start, "$lte": end}
    cursor = db.entries.find(query, {"_id": 0, "photo_base64": 0}).sort("time", 1)
    items = await cursor.to_list(length=500)
    return {"entries": items}


@api.get("/entries/{entry_id}")
async def get_entry(entry_id: str, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    entry = await db.entries.find_one({"id": entry_id, "user_id": user["user_id"]}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    return entry


@api.patch("/entries/{entry_id}/status")
async def update_entry_status(entry_id: str, payload: EntryStatusUpdate, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await db.entries.update_one(
        {"id": entry_id, "user_id": user["user_id"]},
        {"$set": {"status": payload.status}},
    )
    return {"ok": True}


@api.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await db.entries.delete_one({"id": entry_id, "user_id": user["user_id"]})
    return {"ok": True}


class EntryTimeUpdate(BaseModel):
    time: str  # "HH:MM"


class EntryAmountUpdate(BaseModel):
    # Numeric amount + unit; the frontend sends the "primary" amount.
    amount: float
    unit: str = "porsiyon"  # ml | g | adet | porsiyon | dk


@api.patch("/entries/{entry_id}/time")
async def update_entry_time(entry_id: str, payload: EntryTimeUpdate, authorization: Optional[str] = Header(default=None)):
    """Manual time-only update from the timeline detail card."""
    user = await require_user(authorization)
    hh_mm = re.match(r"^([01]?\d|2[0-3]):([0-5]\d)$", payload.time or "")
    if not hh_mm:
        raise HTTPException(status_code=400, detail="Invalid time; expected HH:MM")
    await db.entries.update_one(
        {"id": entry_id, "user_id": user["user_id"]},
        {"$set": {"time": payload.time}},
    )
    return {"ok": True}


@api.patch("/entries/{entry_id}/amount")
async def update_entry_amount(entry_id: str, payload: EntryAmountUpdate, authorization: Optional[str] = Header(default=None)):
    """Manual amount update — scales the entry's calories/macros/water/duration by ratio."""
    user = await require_user(authorization)
    entry = await db.entries.find_one({"id": entry_id, "user_id": user["user_id"]})
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    unit = (payload.unit or "").lower()
    amount = float(payload.amount or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be > 0")

    updates: Dict[str, Any] = {"manual_amount": amount, "manual_unit": unit}

    if unit == "ml" and entry.get("entry_type") in ("water", "coffee"):
        updates["water_ml"] = int(amount)
    elif unit == "dk" and entry.get("entry_type") == "activity":
        prev_dur = entry.get("duration_minutes") or 30
        ratio = amount / prev_dur if prev_dur > 0 else 1.0
        updates["duration_minutes"] = int(amount)
        for k in ("estimated_activity_burn_min", "estimated_activity_burn_max"):
            if entry.get(k):
                updates[k] = int(entry[k] * ratio)
    else:
        # For food/generic: scale by fraction relative to a "1 orta porsiyon" baseline.
        # We use amount itself as the multiplier (1 = orta, 0.5 = küçük, 1.5 = büyük)
        # when unit is "porsiyon"; for grams/adet we approximate to 100g / 1 adet baseline.
        baseline = {"porsiyon": 1.0, "g": 100.0, "adet": 1.0}.get(unit, 1.0)
        ratio = amount / baseline if baseline > 0 else 1.0
        for k in ("calories_min", "calories_max",
                  "protein_g_min", "protein_g_max",
                  "carbohydrate_g_min", "carbohydrate_g_max",
                  "fat_g_min", "fat_g_max",
                  "fiber_g_min", "fiber_g_max"):
            v = entry.get(k)
            if isinstance(v, (int, float)):
                updates[k] = round(v * ratio, 1)

    await db.entries.update_one({"id": entry_id, "user_id": user["user_id"]}, {"$set": updates})
    return {"ok": True, "updates": {k: v for k, v in updates.items() if not k.startswith("_")}}


class EntryMacrosUpdate(BaseModel):
    title: Optional[str] = None
    protein_g: float = 0
    carbohydrate_g: float = 0
    fat_g: float = 0


@api.patch("/entries/{entry_id}/macros")
async def update_entry_macros(entry_id: str, payload: EntryMacrosUpdate, authorization: Optional[str] = Header(default=None)):
    """Manual macro edit — sets exact protein/carb/fat grams and auto-computes calories (4/4/9)."""
    user = await require_user(authorization)
    entry = await db.entries.find_one({"id": entry_id, "user_id": user["user_id"]})
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    p = max(0.0, float(payload.protein_g or 0))
    c = max(0.0, float(payload.carbohydrate_g or 0))
    f = max(0.0, float(payload.fat_g or 0))
    kcal = round(p * 4 + c * 4 + f * 9)
    updates: Dict[str, Any] = {
        "protein_g_min": p, "protein_g_max": p,
        "carbohydrate_g_min": c, "carbohydrate_g_max": c,
        "fat_g_min": f, "fat_g_max": f,
        "calories_min": kcal, "calories_max": kcal,
    }
    if payload.title and payload.title.strip():
        updates["title"] = payload.title.strip()
    await db.entries.update_one({"id": entry_id, "user_id": user["user_id"]}, {"$set": updates})
    return {"ok": True, "calories": kcal, "updates": updates}


# =====================================================================
# PUSH NOTIFICATIONS (Emergent managed relay) + SCHEDULER
# =====================================================================
PUSH_BASE_URL = EMERGENT_INTEGRATIONS_URL
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
_push_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)

IST_TZ = timezone(timedelta(hours=3))


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str  # "android" | "ios"
    device_token: str


@api.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    resp = await _push_client.post("/api/v1/push/users/register", json=body.model_dump())
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()
    return {"status": "registered"}


async def send_push(recipients: List[str], data: Dict[str, Any], idempotency_key: Optional[str] = None) -> None:
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per /trigger call; chunk before sending")
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: Dict[str, Any] = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _push_client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


async def _push_broadcast_once(key: str, title: str, message: str):
    """Send to all users at most once per key (dedupe via push_log unique index)."""
    if await db.push_log.find_one({"key": key}):
        return
    try:
        await db.push_log.insert_one({"key": key, "at": datetime.now(timezone.utc)})
    except Exception:
        return  # duplicate insert race — already handled
    uids = [u for u in await db.users.distinct("user_id") if u]
    for i in range(0, len(uids), 100):
        try:
            await send_push(uids[i:i + 100], {"title": title, "message": message}, idempotency_key=f"{key}_{i}")
        except Exception as e:
            logger.warning(f"broadcast push failed (non-blocking): {e}")


async def _push_user_once(key: str, uid: str, title: str, message: str, action_url: Optional[str] = None):
    """Send one personalized push to a single user, at most once per key (per-user+type+date)."""
    if await db.push_log.find_one({"key": key}):
        return
    try:
        await db.push_log.insert_one({"key": key, "at": datetime.now(timezone.utc)})
    except Exception:
        return
    data: Dict[str, Any] = {"title": title, "message": message}
    if action_url:
        data["action_url"] = action_url
    try:
        await send_push([uid], data, idempotency_key=key)
    except Exception as e:
        logger.warning(f"user push failed (non-blocking): {e}")


def _notifs_on(user: Dict[str, Any]) -> bool:
    """Respect an explicit opt-out; default ON when unset."""
    prof = user.get("profile") or {}
    return prof.get("notifications_enabled", True) is not False


def _has_food_between(entries: List[Dict[str, Any]], start_h: int, end_h: int) -> bool:
    """True if the user logged any food/photo_food in the [start_h, end_h) local-hour window."""
    for e in entries:
        if e.get("entry_type") not in ("food", "photo_food"):
            continue
        t = e.get("time") or "00:00"
        try:
            h, m = int(t.split(":")[0]), int(t.split(":")[1])
        except Exception:
            continue
        if start_h * 60 <= (h * 60 + m) < end_h * 60:
            return True
    return False


def _water_target_ml(user: Dict[str, Any]) -> int:
    plan = user.get("plan") or {}
    return int((plan.get("water_liter_min") or 2.5) * 1000)


async def _load_engaged(today: str, day_offset: int):
    """Return (users_by_id, entries_by_user) for users who completed onboarding and
    logged at least once in the last `day_offset` days (engaged audience)."""
    now = datetime.now(IST_TZ)
    recent = [(now.date() - timedelta(days=i)).isoformat() for i in range(0, day_offset + 1)]
    engaged = set(await db.entries.distinct("user_id", {"date": {"$in": recent}}))
    if not engaged:
        return {}, {}
    users = await db.users.find(
        {"user_id": {"$in": list(engaged)}, "plan": {"$exists": True}},
        {"_id": 0},
    ).to_list(length=5000)
    umap = {u["user_id"]: u for u in users if u.get("user_id") and _notifs_on(u)}
    ents = await db.entries.find(
        {"user_id": {"$in": list(umap.keys())}, "date": today},
        {"_id": 0, "photo_base64": 0},
    ).to_list(length=20000)
    by_user: Dict[str, List[Dict[str, Any]]] = {}
    for e in ents:
        by_user.setdefault(e.get("user_id"), []).append(e)
    return umap, by_user


async def _activity_macro_pushes(today: str):
    """~45 min after an activity is logged, tell the user their macro targets were
    updated (factual — no dietary advice). Marked once per entry."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=45)).isoformat()
    acts = await db.entries.find({
        "entry_type": "activity",
        "date": today,
        "macro_notified": {"$ne": True},
        "created_at": {"$lte": cutoff},
    }, {"_id": 0, "photo_base64": 0}).to_list(length=500)
    for a in acts:
        await db.entries.update_one({"id": a["id"]}, {"$set": {"macro_notified": True}})
        uid = a.get("user_id")
        if not uid:
            continue
        user = await db.users.find_one({"user_id": uid}, {"_id": 0})
        if not user or not _notifs_on(user):
            continue
        bonus = _activity_macro_bonus([a])
        if bonus["protein_g"] <= 0 and bonus["carbohydrate_g"] <= 0 and bonus["fat_g"] <= 0:
            continue
        title = "💪 Makro hedefin güncellendi"
        msg = (
            f"{a.get('title') or 'Aktiviten'} kaydedildi. "
            f"Bugünkü hedefine +{bonus['protein_g']} g P · "
            f"+{bonus['carbohydrate_g']} g K · +{bonus['fat_g']} g Y eklendi."
        )
        await _push_user_once(f"actmacro_{a['id']}", uid, title, msg, action_url="/(tabs)/report")


async def push_scheduler():
    """Smart, personalized scheduler (Europe/Istanbul). Quiet hours 22:00–08:00.
      • Meal nudges — remind engaged users who haven't logged a meal in its window.
      • Behavior-aware water reminders — only when behind the expected fraction.
      • 19:00 daily report — personalized teaser; lapsed users get a re-engagement nudge.
      • Activity → macro-update notice (factual).
      • User-created reminders at their exact date+time.
    All messages are factual reminders only — no dietary/health advice.
    """
    while True:
        try:
            now = datetime.now(IST_TZ)
            hhmm = now.strftime("%H:%M")
            today = now.strftime("%Y-%m-%d")
            quiet = now.hour >= 22 or now.hour < 8

            # ---- Activity → macro-update notice (runs every tick, narrow query) ----
            if not quiet:
                await _activity_macro_pushes(today)

            # ---- Meal-logging nudges (engaged users only) ----
            MEAL_TRIGGERS = {
                "10:30": ("breakfast", 6, 10, "🍳 Günaydın!", "Kahvaltını eklemeyi unutma."),
                "14:30": ("lunch", 11, 15, "🍽️ Öğle vakti", "Öğle öğününü eklemeyi unutma."),
                "20:30": ("dinner", 18, 21, "🍽️ Akşam oldu", "Akşam yemeğini eklemeyi unutma."),
            }
            if hhmm in MEAL_TRIGGERS and not quiet:
                tag, sh, eh, title, msg = MEAL_TRIGGERS[hhmm]
                umap, by_user = await _load_engaged(today, 3)
                for uid, user in umap.items():
                    if _has_food_between(by_user.get(uid, []), sh, eh):
                        continue
                    await _push_user_once(f"{tag}_{uid}_{today}", uid, title, msg, action_url="/(tabs)")

            # ---- Behavior-aware water reminders ----
            WATER_TRIGGERS = {"12:00": 0.40, "16:00": 0.65, "19:30": 0.85}
            if hhmm in WATER_TRIGGERS and not quiet:
                frac = WATER_TRIGGERS[hhmm]
                umap, by_user = await _load_engaged(today, 3)
                for uid, user in umap.items():
                    target = _water_target_ml(user)
                    if target <= 0:
                        continue
                    drank = int(sum((e.get("water_ml") or 0) for e in by_user.get(uid, [])))
                    if drank >= target * frac:
                        continue
                    await _push_user_once(
                        f"water_{uid}_{today}_{hhmm}", uid,
                        "💧 Su hatırlatıcısı",
                        f"Bugün {drank}/{target} ml su içtin. Bir bardak daha eklemeye ne dersin?",
                        action_url="/(tabs)",
                    )

            # ---- 19:00 personalized daily report ----
            if hhmm == "19:00":
                umap, by_user = await _load_engaged(today, 3)
                for uid, user in umap.items():
                    ents = by_user.get(uid, [])
                    if not ents:
                        continue
                    cal_mid = round(sum(
                        ((e.get("calories_min") or 0) + (e.get("calories_max") or 0)) / 2
                        for e in ents
                    ))
                    await _push_user_once(
                        f"daily_report_{uid}_{today}", uid,
                        "📊 Günlük raporun hazır",
                        f"Bugün ~{cal_mid} kcal aldın. Detaylı raporu görmek için dokun.",
                        action_url="/(tabs)/report",
                    )

            # ---- 20:00 re-engagement (lapsed but not dead; no entry today) ----
            if hhmm == "20:00" and not quiet:
                last14 = [(now.date() - timedelta(days=i)).isoformat() for i in range(0, 15)]
                active14 = set(await db.entries.distinct("user_id", {"date": {"$in": last14}}))
                today_active = set(await db.entries.distinct("user_id", {"date": today}))
                lapsed = [u for u in (active14 - today_active) if u]
                if lapsed:
                    users = await db.users.find(
                        {"user_id": {"$in": lapsed}, "plan": {"$exists": True}}, {"_id": 0},
                    ).to_list(length=5000)
                    for user in users:
                        if not _notifs_on(user):
                            continue
                        await _push_user_once(
                            f"reengage_{user['user_id']}_{today}", user["user_id"],
                            "👋 Bugün seni özledik",
                            "Bugün henüz kayıt yok. Gününü kaydetmek için bir dokunuş yeter.",
                            action_url="/(tabs)",
                        )

            # ---- User reminders due (entry_type == "reminder") ----
            due = await db.entries.find({
                "entry_type": "reminder",
                "date": today,
                "time": {"$lte": hhmm},
                "notified": {"$ne": True},
            }).to_list(length=200)
            for r in due:
                try:
                    await send_push(
                        [r["user_id"]],
                        {"title": "⏰ Hatırlatıcı", "message": r.get("title") or "Planladığın hatırlatıcının zamanı geldi."},
                        idempotency_key=f"rem_{r['id']}",
                    )
                except Exception as e:
                    logger.warning(f"reminder push failed (non-blocking): {e}")
                await db.entries.update_one({"id": r["id"]}, {"$set": {"notified": True}})
        except Exception as e:
            logger.warning(f"push scheduler tick failed: {e}")
        await asyncio.sleep(30)


# =====================================================================
# SUBSCRIPTION (RevenueCat — entitlement "Beslence AI Pro")
# =====================================================================
PRO_ENTITLEMENT_ID = "Beslence AI Pro"


class SubscriptionSync(BaseModel):
    is_pro: bool
    expires_at: Optional[str] = None
    store: Optional[str] = None


@api.get("/subscription/me")
async def subscription_me(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "subscription": 1})
    sub = (doc or {}).get("subscription") or {}
    tier = sub.get("tier", "free")
    return {"tier": tier, "is_pro": tier == "pro", "expires_at": sub.get("expires_at"), "store": sub.get("store")}


@api.post("/subscription/sync")
async def subscription_sync(payload: SubscriptionSync, authorization: Optional[str] = Header(default=None)):
    """Client-side entitlement sync from RevenueCat CustomerInfo."""
    user = await require_user(authorization)
    sub = {
        "tier": "pro" if payload.is_pro else "free",
        "expires_at": payload.expires_at,
        "store": payload.store,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "client_sync",
    }
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"subscription": sub}})
    return {"ok": True, **sub}


@api.post("/webhooks/revenuecat")
async def revenuecat_webhook(request: Request):
    """RevenueCat webhook — updates subscription tier server-side."""
    expected = os.environ.get("REVENUECAT_WEBHOOK_AUTH")
    if expected and request.headers.get("Authorization") != expected:
        raise HTTPException(status_code=401, detail="unauthorized")
    body = await request.json()
    event = (body or {}).get("event") or {}
    app_user_id = event.get("app_user_id") or ""
    etype = (event.get("type") or "").upper()
    pro_events = {"INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE"}
    if etype in pro_events:
        tier = "pro"
    elif etype == "EXPIRATION":
        tier = "free"
    else:
        return {"received": True}
    if app_user_id:
        await db.users.update_one(
            {"user_id": app_user_id},
            {"$set": {"subscription": {
                "tier": tier,
                "store": event.get("store"),
                "expires_at": event.get("expiration_at_ms"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "source": "webhook",
            }}},
        )
    return {"received": True}


@api.delete("/auth/account")
async def delete_account(authorization: Optional[str] = Header(default=None)):
    """Permanently deletes the user's account and all data (store review requirement)."""
    user = await require_user(authorization)
    uid = user["user_id"]
    await db.entries.delete_many({"user_id": uid})
    await db.user_sessions.delete_many({"user_id": uid})
    await db.users.delete_one({"user_id": uid})
    return {"ok": True, "deleted": True}


# =====================================================================
# WEIGHT TRACKING
# =====================================================================
class WeightIn(BaseModel):
    date: str  # YYYY-MM-DD
    weight_kg: float


@api.post("/weights")
async def add_weight(payload: WeightIn, authorization: Optional[str] = Header(default=None)):
    """Upsert one weight measurement per day; also keeps profile.weight_kg fresh."""
    user = await require_user(authorization)
    uid = user["user_id"]
    w = round(max(20.0, min(400.0, float(payload.weight_kg))), 1)
    await db.weights.update_one(
        {"user_id": uid, "date": payload.date},
        {
            "$set": {"weight_kg": w, "updated_at": datetime.now(timezone.utc).isoformat()},
            "$setOnInsert": {"id": f"w_{uuid.uuid4().hex[:12]}", "user_id": uid, "date": payload.date},
        },
        upsert=True,
    )
    await db.users.update_one({"user_id": uid}, {"$set": {"profile.weight_kg": w}})
    return {"ok": True, "date": payload.date, "weight_kg": w}


@api.get("/weights")
async def list_weights(limit: int = 60, authorization: Optional[str] = Header(default=None)):
    """Latest N measurements, returned in ascending date order for charting."""
    user = await require_user(authorization)
    items = await db.weights.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(length=min(limit, 365))
    items.reverse()
    return {"items": items}


# =====================================================================
# AI - CHATBOT (text parsing)
# =====================================================================
def _extract_json(text: str) -> Optional[dict]:
    """Pull first valid JSON object from text."""
    if not text:
        return None
    # Remove code fences
    text = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    # Try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass
    # Find first { ... } block
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            return None
    return None


CHATBOT_INSTRUCTIONS = """
Görevin: kullanıcının Türkçe mesajını analiz et ve TEK BİR JSON döndür.
Başka hiçbir metin yazma.

SAĞLIK / HASTALIK SORUSU FİLTRESİ (KESİN):
- Eğer mesaj bir SORU ise ve şu konulardan biriyse: hastalık, tanı, ilaç, hormon, insülin,
  metabolizma, vitamin/mineral takviyesi, kilo verme/kazanma stratejisi, kas kazanma,
  diyet önerisi, semptom, alerji, medikal test, "ne yemeliyim / ne yapmalıyım" tarzı öneri:
  KAYIT OLUŞTURMA. Şu formatı döndür:
{
  "needs_clarification": false,
  "is_health_question": true,
  "reply": "Sağlık durumuna özel öneri için diyetisyen görüşmesi gerekir. Ben yemek, aktivite ve su kaydı için buradayım."
}
- KAYIT tetikleyicisi yalnızca yemek/içecek/su/aktivite girdisidir. Sağlık soruları takvime düşmez.

BELİRSİZLİK — SORU SOR (needs_clarification=true) DURUMLARI:
(a) Yemek adı/tanımı belli, ama miktarı belirsiz → gramaj/kaşık/porsiyon sor.
    Örn "pilav yedim": q="Kaç kaşık pilav yedin?", options=["1-2 kaşık","3-4 kaşık","5+ kaşık","Manuel gir"]
(b) İçecek adı belli, miktar belirsiz → ml/bardak sor.
    Örn "kahve içtim": q="Nasıl bir kahve?", options=["Küçük 200 ml","Orta 300 ml","Büyük 400 ml","Manuel gir"]
(c) Yemek/aktivite adı HİÇ belli değilse ("bişey yedim", "biraz spor yaptım") → adı/tipi sor.
(d) Aktivite süresi belirsizse → süre sor.
    Örn "yürüyüş yaptım": q="Kaç dk yürüdün?", options=["15-30 dk","30-45 dk","45-60 dk","Manuel gir"]

SAAT KURALI (KESİN):
- ASLA "Saat kaçtaydı?" veya benzer bir zaman sorusu SORMA.
- ASLA kayda kendin saat/date atama; bu alanları backend zorlar. Sadece miktar/porsiyon/adı netleştir.
- system_summary'de "şimdiki saate" ekledim gibi bir ifade kullan.

ÖNEMLİ KURALLAR:
- Her netleştirme sorusunun SON seçeneği daima "Manuel gir" OLMALI.
- "Manuel gir" seçildiğinde bir sonraki mesajda kullanıcı serbest metin yazarak sayı verecek.
- Kullanıcı bir soruyu atlarsa "orta porsiyon" varsayımıyla devam et; system_summary'de belirt.
- Emin olmadığında yalnızca miktar/süre belirsizse sor; başka her şey için tahmin et.
- KIYAS ile sor: "kaşık" (pilav/salata), "gram" (et/ekmek), "ml" (içecek), "adet" (yumurta/meyve), "dilim" (pizza/ekmek), "porsiyon" (genel).

SORU FORMATI (needs_clarification=true):
{
  "needs_clarification": true,
  "system_summary": "Kısa açıklama (örn: 'Doğru kayıt için miktarını sormam lazım.')",
  "questions": [
    {"id":"q1","question":"Kaç kaşık pilav yedin?","options":["1-2 kaşık","3-4 kaşık","5+ kaşık","Manuel gir"]},
    {"id":"q2","question":"Yağda mı ızgara mı?","options":["Sade","Yağda kızartılmış","Izgara","Manuel gir"]}
  ],
  "draft": { ...tahmin ettiğin alanlar (date,time,entry_type,title,meal_type vb.)... }
}

NORMAL KAYIT FORMATI (yeterli bilgi varsa):
{
  "needs_clarification": false,
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "entry_type": "food|activity|water|coffee|sleep|note",
  "status": "planned|current_logged|past_logged",
  "timeline_bubble_type": "meal|water|coffee|activity|cardio|sleep|note|plan|past",
  "meal_type": "kahvalti|ogle|aksam|ara_ogun|aktivite|su|kahve|not|plan",
  "title": "Kısa başlık",
  "foods": [{"name":"...", "portion":"kucuk|orta|buyuk", "grams": null}],
  "activity": [{"name":"...","duration_minutes":null,"intensity":"hafif|orta|yuksek"}],
  "calories_min": null, "calories_max": null,
  "protein_g_min": null, "protein_g_max": null,
  "carbohydrate_g_min": null, "carbohydrate_g_max": null,
  "fat_g_min": null, "fat_g_max": null,
  "fiber_g_min": null, "fiber_g_max": null,
  "water_ml": null,
  "duration_minutes": null,
  "intensity": "",
  "estimated_activity_burn_min": null,
  "estimated_activity_burn_max": null,
  "system_summary": "Kısa Türkçe kayıt cümlesi (tavsiyesiz).",
  "confidence": "low|medium|high"
}

SU KISAYOLLARI:
- "1 bardak su" → water_ml=250
- "yarım bardak" → water_ml=125
- "büyük bardak" → water_ml=330
- "şişe" → water_ml=500

MEAL_TYPE KURALI:
- 06:00-10:30 yemek → kahvalti
- 11:30-14:30 yemek → ogle
- 18:00-22:30 yemek → aksam
- Diğer yemek → ara_ogun
- Spor → aktivite; Su → su; Kahve/çay → kahve; Uyku/not → not; Gelecek plan → plan

GENEL KURALLAR:
- Kalori/makro değerlerini TAHMİNİ aralık olarak ver (min-max).
- 'şimdi', 'şu an' → time="now".
- 'yarın', 'dün', 'perşembe' gibi ifadeleri çöz.
- system_summary tavsiyesiz, sade kayıt cümlesi olsun.
"""



@api.post("/ai/chatbot")
async def chatbot(payload: ChatbotIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    profile = user.get("profile") or {}
    # Default to Turkey local time (UTC+3) when client doesn't supply one.
    TR_TZ = timezone(timedelta(hours=3))
    now_iso = payload.user_local_time or datetime.now(TR_TZ).isoformat()

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"chatbot_{user['user_id']}_{uuid.uuid4().hex[:6]}",
        system_message=NUTRITION_SYSTEM_PROMPT + "\n\n" + CHATBOT_INSTRUCTIONS,
    ).with_model("gemini", GEMINI_MODEL)

    # Build prompt — if user is answering a clarification, include the draft + answers
    if payload.draft and payload.clarification_answers:
        answers_block = "\n".join(
            f"- {a.id}: {a.answer}" for a in payload.clarification_answers
        )
        prompt = (
            f"Bugünün tarihi/saati (Türkiye yerel saati): {now_iso}\n"
            f"Kullanıcı hedefi: {profile.get('goal_primary','')}\n"
            f"ÖNCEKİ TASLAK (JSON): {json.dumps(payload.draft, ensure_ascii=False)}\n"
            f"KULLANICININ YANITLARI:\n{answers_block}\n"
            f"Orijinal mesaj: {payload.message}\n\n"
            "Artık yeterli bilgi var. needs_clarification=false döndür ve kaydı tamamla."
        )
    else:
        prompt = (
            f"Bugünün tarihi/saati (Türkiye yerel saati): {now_iso}\n"
            f"Kullanıcı hedefi: {profile.get('goal_primary','')}\n"
            f"Kullanıcı mesajı:\n{payload.message}\n\n"
            "Yukarıdaki şemaya uygun TEK BİR JSON döndür. "
            "Eğer mesaj belirsizse needs_clarification=true ile EN FAZLA 2 çoktan seçmeli soru sor."
        )
    try:
        response_text = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.exception("chatbot LLM error")
        raise HTTPException(status_code=500, detail=f"AI error: {e}")

    parsed = _extract_json(response_text)
    if not parsed:
        return {
            "ok": False,
            "raw": response_text,
            "system_summary": "Mesajını anlayamadım, biraz daha açar mısın?",
        }

    # Health question path — do NOT persist anything.
    if parsed.get("is_health_question") is True:
        return {
            "ok": True,
            "is_health_question": True,
            "reply": parsed.get("reply") or "Sağlık durumuna özel öneri için diyetisyen görüşmesi gerekir. Ben yemek, aktivite ve su kaydı için buradayım.",
        }

    # Clarification path — return questions; do NOT persist anything yet.
    if parsed.get("needs_clarification") is True:
        questions = parsed.get("questions", []) or []
        # Sanitize questions; cap at 2 with up to 4 options
        clean_q = []
        for q in questions[:2]:
            opts = q.get("options") or []
            clean_q.append({
                "id": str(q.get("id") or f"q{len(clean_q)+1}"),
                "question": str(q.get("question") or ""),
                "options": [str(o) for o in opts[:4]],
            })
        return {
            "ok": True,
            "needs_clarification": True,
            "questions": clean_q,
            "draft": parsed.get("draft") or {},
            "system_summary": parsed.get("system_summary") or "Daha iyi kayıt için birkaç şey sormam lazım.",
        }

    # ---------------------------------------------------------------
    # TIMEZONE FIX (P0): resolve "now" reliably in Europe/Istanbul.
    # If the client passed an ISO with a "Z" or "+00:00" offset we
    # MUST convert to +03:00 before extracting HH:MM — otherwise we
    # write UTC hours to the DB and cards land 3 hours earlier.
    # Assistant is NOT allowed to set/modify time — every entry is
    # stamped with the CURRENT Istanbul local time.
    # ---------------------------------------------------------------
    local_now = datetime.now(TR_TZ)
    try:
        if payload.user_local_time:
            parsed_dt = datetime.fromisoformat(payload.user_local_time.replace("Z", "+00:00"))
            if parsed_dt.tzinfo is None:
                parsed_dt = parsed_dt.replace(tzinfo=TR_TZ)
            local_now = parsed_dt.astimezone(TR_TZ)
    except Exception:
        pass

    # Force time/date to CURRENT Istanbul local — ignore any value the LLM produced.
    parsed["time"] = local_now.strftime("%H:%M")
    parsed["date"] = local_now.strftime("%Y-%m-%d")
    parsed["status"] = "current_logged"

    parsed["raw_user_input"] = payload.message
    parsed["source"] = "chatbot"
    parsed.setdefault("entry_type", "food")
    parsed.setdefault("timeline_bubble_type", "meal")

    # Infer meal_type from time if not provided
    def _infer_meal_type(parsed_obj: dict) -> str:
        et = parsed_obj.get("entry_type") or "food"
        if et == "activity":
            return "aktivite"
        if et == "water":
            return "su"
        if et == "coffee":
            return "kahve"
        if et == "sleep" or et == "note":
            return "not"
        if parsed_obj.get("status") == "planned":
            return "plan"
        # Food: bucket by hour
        try:
            hour = int((parsed_obj.get("time") or "12:00").split(":")[0])
        except Exception:
            hour = 12
        if 6 <= hour <= 10:
            return "kahvalti"
        if 11 <= hour <= 14:
            return "ogle"
        if 18 <= hour <= 22:
            return "aksam"
        return "ara_ogun"

    parsed.setdefault("meal_type", _infer_meal_type(parsed))

    # Persist entry
    entry = {
        "id": f"entry_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "date": parsed.get("date"),
        "time": parsed.get("time"),
        "entry_type": parsed.get("entry_type", "food"),
        "status": parsed.get("status", "past_logged"),
        "timeline_bubble_type": parsed.get("timeline_bubble_type", "meal"),
        "meal_type": parsed.get("meal_type") or "ara_ogun",
        "source": "chatbot",
        "raw_user_input": payload.message,
        "title": parsed.get("title", payload.message[:60]),
        "foods": parsed.get("foods", []),
        "activity": parsed.get("activity", []),
        "calories_min": parsed.get("calories_min"),
        "calories_max": parsed.get("calories_max"),
        "protein_g_min": parsed.get("protein_g_min"),
        "protein_g_max": parsed.get("protein_g_max"),
        "carbohydrate_g_min": parsed.get("carbohydrate_g_min"),
        "carbohydrate_g_max": parsed.get("carbohydrate_g_max"),
        "fat_g_min": parsed.get("fat_g_min"),
        "fat_g_max": parsed.get("fat_g_max"),
        "fiber_g_min": parsed.get("fiber_g_min"),
        "fiber_g_max": parsed.get("fiber_g_max"),
        "water_ml": parsed.get("water_ml"),
        "duration_minutes": parsed.get("duration_minutes"),
        "intensity": parsed.get("intensity", ""),
        "estimated_activity_burn_min": parsed.get("estimated_activity_burn_min"),
        "estimated_activity_burn_max": parsed.get("estimated_activity_burn_max"),
        "system_summary": parsed.get("system_summary", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.entries.insert_one(entry.copy())
    entry.pop("_id", None)
    return {"ok": True, "needs_clarification": False, "entry": entry, "summary": parsed.get("system_summary", "")}


# =====================================================================
# AI - PHOTO FOOD ANALYSIS
# =====================================================================
PHOTO_INSTRUCTIONS = """
Aşağıdaki yemek fotoğrafını analiz et. Türk yemeklerini özellikle dikkate al.
Sadece JSON döndür (başka metin yok):

{
  "title": "Algılanan öğün başlığı",
  "detected_foods": [{"food_name":"...","portion_estimate":"kucuk|orta|buyuk","confidence":"low|medium|high"}],
  "calories_min": 0, "calories_max": 0,
  "protein_g_min": 0, "protein_g_max": 0,
  "carbohydrate_g_min": 0, "carbohydrate_g_max": 0,
  "fat_g_min": 0, "fat_g_max": 0,
  "fiber_g_min": 0, "fiber_g_max": 0,
  "confidence": "low|medium|high",
  "system_summary": "Türkçe kısa özet."
}
Tavsiye/yorum YOK.
"""


@api.post("/ai/photo-analyze")
async def photo_analyze(
    image_base64: str = Form(...),
    mime_type: str = Form("image/jpeg"),
    authorization: Optional[str] = Header(default=None),
):
    user = await require_user(authorization)
    # strip data URL prefix if present
    if image_base64.startswith("data:"):
        image_base64 = image_base64.split(",", 1)[-1]

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"photo_{user['user_id']}_{uuid.uuid4().hex[:6]}",
        system_message=NUTRITION_SYSTEM_PROMPT,
    ).with_model("gemini", GEMINI_MODEL)

    image = ImageContent(image_base64=image_base64)
    try:
        response_text = await chat.send_message(
            UserMessage(text=PHOTO_INSTRUCTIONS, file_contents=[image])
        )
    except Exception as e:
        logger.exception("photo analyze error")
        raise HTTPException(status_code=500, detail=f"AI error: {e}")

    parsed = _extract_json(response_text) or {}
    parsed.setdefault("title", "Öğün")
    parsed.setdefault("detected_foods", [])
    parsed.setdefault("confidence", "medium")
    parsed.setdefault("system_summary", "Fotoğraf analiz edildi.")
    return parsed


# =====================================================================
# AI - VOICE (Whisper-1)
# =====================================================================
@api.post("/ai/voice")
async def voice_transcribe(
    audio: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    user = await require_user(authorization)
    openai_client = AsyncOpenAI(
        api_key=EMERGENT_LLM_KEY,
        base_url=EMERGENT_INTEGRATIONS_URL + "/llm/openai/v1",
    )
    try:
        contents = await audio.read()
        # Re-wrap as a file-like for OpenAI SDK
        from io import BytesIO
        bio = BytesIO(contents)
        bio.name = audio.filename or "audio.m4a"
        resp = await openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=(bio.name, bio, audio.content_type or "audio/m4a"),
            language="tr",
        )
        return {"text": resp.text}
    except Exception as e:
        logger.exception("voice transcribe error")
        raise HTTPException(status_code=500, detail=f"Voice error: {e}")


# =====================================================================
# Turkish Food Lookup (AI-driven)
# =====================================================================
FOOD_LOOKUP_INSTRUCTIONS = """
Bana Türk mutfağı/market besinleri konusunda yardımcı ol. Verilen sorguya göre besin bilgisi döndür.
Sadece JSON döndür (başka metin yok):

{
  "results": [
    {
      "name": "Besin adı",
      "category": "kahvaltilik|corba|et_yemegi|sebze|pilav_makarna|hamur_isi|tatli|icecek|atıştırmalık|paketli",
      "default_portion": "1 porsiyon (~ X g)",
      "calories_min": 0, "calories_max": 0,
      "protein_g_min": 0, "protein_g_max": 0,
      "carbohydrate_g_min": 0, "carbohydrate_g_max": 0,
      "fat_g_min": 0, "fat_g_max": 0,
      "fiber_g_min": 0, "fiber_g_max": 0,
      "is_turkish": true
    }
  ]
}
En fazla 5 sonuç döndür. Tavsiye verme.
"""


@api.post("/foods/lookup")
async def foods_lookup(payload: FoodLookupIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"food_lookup_{user['user_id']}",
        system_message=NUTRITION_SYSTEM_PROMPT,
    ).with_model("gemini", GEMINI_MODEL)
    try:
        text = await chat.send_message(
            UserMessage(text=f"Sorgu: {payload.query}\n\n{FOOD_LOOKUP_INSTRUCTIONS}")
        )
    except Exception as e:
        logger.exception("food lookup error")
        raise HTTPException(status_code=500, detail=str(e))
    parsed = _extract_json(text) or {"results": []}
    return parsed


# =====================================================================
# SUMMARY
# =====================================================================
def _sum_field(items, key_min, key_max):
    s_min = 0.0
    s_max = 0.0
    for it in items:
        v_min = it.get(key_min)
        v_max = it.get(key_max)
        if v_min is not None:
            s_min += float(v_min)
        if v_max is not None:
            s_max += float(v_max)
        elif v_min is not None:
            s_max += float(v_min)
    return round(s_min), round(s_max)


# ---------------------------------------------------------------------
# Activity → extra macro target distribution.
# Burned energy is converted into extra macro *targets* (grams) based on the
# activity's dominant energy system. Protein 4 kcal/g, Carb 4 kcal/g, Fat 9 kcal/g.
#   • Resistance / hypertrophy       → 45% P, 40% C, 15% F
#   • High-intensity / glycogen      → 20% P, 70% C, 10% F
#   • Low-intensity walking / LISS   → 20% P, 50% C, 30% F  (fat oxidation)
# ---------------------------------------------------------------------
_RESISTANCE_KW = [
    "ağırlık", "agirlik", "direnç", "direnc", "fitness", "gym", "halter",
    "dumbbell", "squat", "deadlift", "bench", "kas", "vücut geliştirme",
    "vucut gelistirme", "crossfit", "body pump", "bodypump", "şınav", "sinav",
    "mekik", "barfiks", "plank", "kettlebell",
]
_GLYCOGEN_KW = [
    "hiit", "futbol", "basketbol", "sprint", "spinning", "tenis", "maç", "mac",
    "voleybol", "kardiyo", "cardio", "koşu", "kosu", "bisiklet", "yüzme", "yuzme",
    "kickbox", "boks", "box", "zumba", "hentbol", "squash", "ipatlama", "ip atlama",
]
_LISS_KW = [
    "yürüyüş", "yuruyus", "tempolu", "liss", "yoga", "pilates", "esneme",
    "gezinti", "yavaş", "yavas",
]


def _activity_macro_split(entry: Dict[str, Any]) -> tuple:
    """Return (protein_ratio, carb_ratio, fat_ratio) for one activity entry."""
    names = " ".join(
        (a.get("name", "") if isinstance(a, dict) else str(a))
        for a in (entry.get("activity") or [])
    )
    blob = (
        (entry.get("title") or "") + " "
        + (entry.get("raw_user_input") or "") + " "
        + names
    ).lower()
    intensity = (entry.get("intensity") or "").lower()

    if any(k in blob for k in _RESISTANCE_KW):
        return (0.45, 0.40, 0.15)
    if any(k in blob for k in _GLYCOGEN_KW) or intensity in ("yuksek", "yüksek"):
        return (0.20, 0.70, 0.10)
    if any(k in blob for k in _LISS_KW) or intensity in ("hafif", "dusuk", "düşük"):
        return (0.20, 0.50, 0.30)
    # Default (moderate / unclassified) → balanced LISS-like split.
    return (0.20, 0.50, 0.30)


def _activity_macro_bonus(items: List[Dict[str, Any]]) -> Dict[str, float]:
    """Aggregate extra macro targets (grams) contributed by the day's activities."""
    bp = bc = bf = 0.0
    for it in items:
        if it.get("entry_type") != "activity":
            continue
        b_min = it.get("estimated_activity_burn_min")
        b_max = it.get("estimated_activity_burn_max")
        if b_min is None and b_max is None:
            continue
        burn = ((b_min if b_min is not None else b_max) + (b_max if b_max is not None else b_min)) / 2
        if burn <= 0:
            continue
        pr, cr, fr = _activity_macro_split(it)
        bp += burn * pr / 4.0
        bc += burn * cr / 4.0
        bf += burn * fr / 9.0
    return {
        "protein_g": round(bp),
        "carbohydrate_g": round(bc),
        "fat_g": round(bf),
    }


@api.get("/summary/daily")
async def daily_summary(date: str, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    items = await db.entries.find(
        {"user_id": user["user_id"], "date": date},
        {"_id": 0, "photo_base64": 0},
    ).to_list(length=500)

    cal_min, cal_max = _sum_field(items, "calories_min", "calories_max")
    p_min, p_max = _sum_field(items, "protein_g_min", "protein_g_max")
    c_min, c_max = _sum_field(items, "carbohydrate_g_min", "carbohydrate_g_max")
    f_min, f_max = _sum_field(items, "fat_g_min", "fat_g_max")
    fi_min, fi_max = _sum_field(items, "fiber_g_min", "fiber_g_max")
    water_ml = sum((it.get("water_ml") or 0) for it in items)
    activity_minutes = sum((it.get("duration_minutes") or 0) for it in items if it.get("entry_type") == "activity")
    burn_min, burn_max = _sum_field(items, "estimated_activity_burn_min", "estimated_activity_burn_max")
    macro_bonus = _activity_macro_bonus(items)

    return {
        "date": date,
        "entry_count": len(items),
        "calories": {"min": cal_min, "max": cal_max},
        "protein_g": {"min": p_min, "max": p_max},
        "carbohydrate_g": {"min": c_min, "max": c_max},
        "fat_g": {"min": f_min, "max": f_max},
        "fiber_g": {"min": fi_min, "max": fi_max},
        "water_ml": water_ml,
        "activity_minutes": activity_minutes,
        "activity_burn": {"min": burn_min, "max": burn_max},
        "macro_bonus": macro_bonus,
    }


@api.get("/summary/weekly")
async def weekly_summary(end_date: str, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    end_d = datetime.strptime(end_date, "%Y-%m-%d").date()
    start_d = end_d - timedelta(days=6)
    items = await db.entries.find(
        {
            "user_id": user["user_id"],
            "date": {"$gte": start_d.isoformat(), "$lte": end_d.isoformat()},
        },
        {"_id": 0, "photo_base64": 0},
    ).to_list(length=2000)

    # Group by date
    by_date: Dict[str, List[Dict[str, Any]]] = {}
    for it in items:
        by_date.setdefault(it["date"], []).append(it)

    days = []
    total_activity_minutes = 0
    cal_sum_min = 0
    cal_sum_max = 0
    days_with_data = 0
    most_active_day = None
    most_active_minutes = 0
    most_entries_day = None
    most_entries = 0

    cur = start_d
    while cur <= end_d:
        date_str = cur.isoformat()
        day_items = by_date.get(date_str, [])
        cm, cmx = _sum_field(day_items, "calories_min", "calories_max")
        act_min = sum((it.get("duration_minutes") or 0) for it in day_items if it.get("entry_type") == "activity")
        total_activity_minutes += act_min
        if cm > 0 or cmx > 0:
            days_with_data += 1
            cal_sum_min += cm
            cal_sum_max += cmx
        if act_min > most_active_minutes:
            most_active_minutes = act_min
            most_active_day = date_str
        if len(day_items) > most_entries:
            most_entries = len(day_items)
            most_entries_day = date_str
        days.append({"date": date_str, "calories_min": cm, "calories_max": cmx, "entry_count": len(day_items), "activity_minutes": act_min})
        cur += timedelta(days=1)

    avg_min = round(cal_sum_min / days_with_data) if days_with_data else 0
    avg_max = round(cal_sum_max / days_with_data) if days_with_data else 0

    return {
        "start_date": start_d.isoformat(),
        "end_date": end_d.isoformat(),
        "days": days,
        "avg_calories": {"min": avg_min, "max": avg_max},
        "total_activity_minutes": total_activity_minutes,
        "most_active_day": most_active_day,
        "most_entries_day": most_entries_day,
    }


# Mount router (moved after report endpoint below)


# =====================================================================
# DAILY REPORT — informational only, no medical advice.
# =====================================================================
DAILY_REPORT_DISCLAIMER = (
    "Bu rapor yenilen yiyeceklere göre otomatik oluşturulmuş genel bir "
    "bilgilendirmedir. Tanı, tedavi veya kişisel diyet tavsiyesi içermez. "
    "Kişisel öneriler için diyetisyen desteği gerekir."
)

# Very rough Turkish-food heuristic keyword sets used to classify a "food group"
# for the diversity warning. Not exhaustive — just enough to catch clear cases.
GROUP_KEYWORDS = {
    "sebze_meyve": [
        "salata", "domates", "salatalık", "biber", "elma", "muz", "portakal",
        "çilek", "havuç", "brokoli", "ıspanak", "roka", "meyve", "sebze",
    ],
    "tam_tahil": [
        "tam tahıllı", "yulaf", "esmer pirinç", "esmer ekmek", "bulgur",
        "kepekli", "quinoa", "çavdar",
    ],
    "protein": [
        "tavuk", "et", "somon", "hindi", "yumurta", "peynir", "yoğurt",
        "mercimek", "nohut", "fasulye", "balık", "tofu",
    ],
    "sut": [
        "süt", "yoğurt", "peynir", "kefir", "ayran", "labne",
    ],
    "yag": [
        "avokado", "zeytin", "zeytinyağı", "badem", "ceviz", "fındık", "cashew",
        "kabak çekirdeği", "chia", "keten tohumu",
    ],
}

def _detect_food_groups(entries: List[Dict[str, Any]]) -> List[str]:
    text_blob = " ".join(
        (e.get("title", "") + " " + (e.get("raw_user_input", "") or "")).lower()
        for e in entries if e.get("entry_type") == "food"
    )
    hits: List[str] = []
    for group, kws in GROUP_KEYWORDS.items():
        if any(kw in text_blob for kw in kws):
            hits.append(group)
    return hits


@api.get("/report/daily")
async def daily_report(date: str, authorization: Optional[str] = Header(default=None)):
    """
    Compose the day's report:
      • Total kcal / macros / water / activity.
      • Warning strings (fixed templates — no medical advice) when thresholds trip.
      • Meal-by-meal list.
    """
    user = await require_user(authorization)
    profile = user.get("profile") or {}
    plan = user.get("plan") or {}

    items = await db.entries.find(
        {"user_id": user["user_id"], "date": date},
        {"_id": 0, "photo_base64": 0},
    ).to_list(length=1000)

    items = sorted(items, key=lambda e: e.get("time") or "00:00")

    cal_min, cal_max = _sum_field(items, "calories_min", "calories_max")
    prot_min, prot_max = _sum_field(items, "protein_g_min", "protein_g_max")
    carb_min, carb_max = _sum_field(items, "carbohydrate_g_min", "carbohydrate_g_max")
    fat_min, fat_max = _sum_field(items, "fat_g_min", "fat_g_max")
    fiber_min, fiber_max = _sum_field(items, "fiber_g_min", "fiber_g_max")
    water_ml = int(sum((it.get("water_ml") or 0) for it in items))
    activity_minutes = int(sum((it.get("duration_minutes") or 0) for it in items if it.get("entry_type") == "activity"))
    macro_bonus = _activity_macro_bonus(items)

    # Approximate added-sugar and saturated-fat exposure from a coarse macro
    # ratio (no explicit fields yet). This is intentionally conservative — the
    # thresholds are only raised when the day is clearly high.
    added_sugar_g = round(((carb_min + carb_max) / 2) * 0.25, 1)  # ~25% of carbs as added sugar (rough upper bound)
    saturated_fat_g = round(((fat_min + fat_max) / 2) * 0.30, 1)  # ~30% of fat as saturated (rough upper bound)
    sodium_mg = 0  # not tracked; leave as 0 to avoid false warning
    for e in items:
        # Best-effort: if the LLM ever tagged an explicit sodium value, sum it.
        s = e.get("sodium_mg") or e.get("salt_mg") or 0
        if isinstance(s, (int, float)):
            sodium_mg += int(s)

    # ----- Warnings (fixed templates, no medical advice) -----
    # Thresholds: WHO strictest references
    warnings: List[Dict[str, str]] = []
    if added_sugar_g > 25:
        warnings.append({
            "id": "sugar",
            "title": "Şeker uyarısı",
            "text": f"Bugün yiyeceklerdeki doğal ve eklenen şeker toplamın {added_sugar_g} g'ı aştı. Genel rehberler günde 25 g altını önerir. Bu yalnızca bilgilendirmedir.",
        })
    if saturated_fat_g > 22:
        warnings.append({
            "id": "sat_fat",
            "title": "Doymuş yağ uyarısı",
            "text": f"Bugün doymuş yağ alımın yaklaşık {saturated_fat_g} g. Genel rehberler günlük enerjinin %10'undan azını (~22 g) önerir. Bu yalnızca bilgilendirmedir.",
        })
    if sodium_mg > 2000:
        warnings.append({
            "id": "sodium",
            "title": "Tuz/sodyum uyarısı",
            "text": "Bugün sodyum alımın 2 g'ı aştı. WHO günde 2 g altını önerir. Bu yalnızca bir bilgilendirmedir.",
        })
    # Diversity
    groups = _detect_food_groups(items)
    if len(groups) < 3 and any(it.get("entry_type") == "food" for it in items):
        warnings.append({
            "id": "diversity",
            "title": "Çeşitlilik uyarısı",
            "text": f"Bugün besin çeşitliliğin sınırlı kaldı ({len(groups)} besin grubundan tükettin). Farklı gruplardan besinler eklemek genel çeşitlilik için önerilir.",
        })
    # Water
    water_target_ml = int(((plan.get("water_liter_min") or 2.5)) * 1000)
    if water_target_ml > 0 and water_ml < water_target_ml * 0.60:
        warnings.append({
            "id": "water",
            "title": "Su uyarısı",
            "text": f"Bugün su alımın hedefinin altında kaldı ({water_ml}/{water_target_ml} ml).",
        })
    # Meal-skipping (5+ hour gap between logs)
    times = sorted([e.get("time") or "00:00" for e in items if e.get("entry_type") in ("food", "coffee", "water")])
    for a, b in zip(times, times[1:]):
        ah, am = [int(x) for x in a.split(":")]
        bh, bm = [int(x) for x in b.split(":")]
        gap = (bh * 60 + bm) - (ah * 60 + am)
        if gap >= 5 * 60:
            warnings.append({
                "id": "gap",
                "title": "Öğün atlama uyarısı",
                "text": f"Bugün {a} ile {b} arasında kayıt yok. Uzun öğün araları için bilgilendirme amaçlıdır.",
            })
            break

    # Meal list (color-coded on the frontend)
    meal_list = []
    for it in items:
        cal_e = round(((it.get("calories_min") or 0) + (it.get("calories_max") or 0)) / 2)
        meal_list.append({
            "id": it.get("id"),
            "time": it.get("time"),
            "title": it.get("title") or "",
            "entry_type": it.get("entry_type"),
            "meal_type": it.get("meal_type"),
            "calories": cal_e,
            "water_ml": it.get("water_ml"),
            "duration_minutes": it.get("duration_minutes"),
        })

    return {
        "date": date,
        "generated_at": datetime.now(timezone(timedelta(hours=3))).isoformat(),
        "totals": {
            "calories": round((cal_min + cal_max) / 2),
            "calories_delta": round((cal_max - cal_min) / 2),
            "protein_g": round((prot_min + prot_max) / 2, 1),
            "carbohydrate_g": round((carb_min + carb_max) / 2, 1),
            "fat_g": round((fat_min + fat_max) / 2, 1),
            "fiber_g": round((fiber_min + fiber_max) / 2, 1),
            "water_ml": water_ml,
            "water_target_ml": water_target_ml,
            "activity_minutes": activity_minutes,
            "sugar_g": added_sugar_g,
            "entry_count": len(items),
            "macro_bonus": macro_bonus,
        },
        "warnings": warnings,
        "meals": meal_list,
        "food_groups_hit": groups,
        "disclaimer": DAILY_REPORT_DISCLAIMER,
    }


# Mount router — must come AFTER all @api.* endpoints are defined.
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.entries.create_index([("user_id", 1), ("date", 1), ("time", 1)])
    await db.push_log.create_index("key", unique=True)
    await db.weights.create_index([("user_id", 1), ("date", 1)], unique=True)
    asyncio.create_task(push_scheduler())


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
