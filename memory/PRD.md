# BESLENCE AI - Product Requirements Document

## Overview
BESLENCE AI is a Turkish-language nutrition and activity tracking mobile app (Expo + FastAPI + MongoDB). Tagline: "Yediklerini, aktivitelerini ve günlük akışını tek yerden takip et."

## Core Principles
- **NO advice**: The chatbot and AI never give nutrition/health recommendations. It only logs, calculates, classifies, and writes to the calendar.
- Turkish UI only.
- Calorie/macro values are always given as **min-max ranges**.

## Stack
- **Frontend**: Expo SDK 54, expo-router, React Native, Reanimated, Safe Area, expo-image-picker, expo-audio, expo-web-browser, expo-secure-store
- **Backend**: FastAPI + Motor (MongoDB) + emergentintegrations + OpenAI SDK
- **Auth**: Emergent-managed Google Auth (https://auth.emergentagent.com)
- **AI Models**:
  - Gemini 3 Flash (`gemini-3-flash-preview`) for chatbot text parsing + photo food analysis
  - OpenAI Whisper-1 for Turkish voice transcription
- **API Key**: EMERGENT_LLM_KEY (universal key)

## Brand
- Name: **BESLENCE AI**
- Logo: "B" body with sprouting leaf on top + signature leaf-filling animation
- Colors: Beslence Yeşili `#1D9E75`, Derin Yaprak `#0F6E56`, Gece Yeşili `#0B2620`, Mint `#E0F5EE`, Paper `#F9FAF9`
- Themes: **Sakin Mod** (default, calm) and **Sportif Mod** (training-focused)

## Screens
1. **Splash/Welcome** (`/app/index.tsx`) — Logo + CTA buttons
2. **Auth** (`/app/auth.tsx`) — Google sign-in
3. **Onboarding** (7 steps): goal → info → measurements → activity → sport → theme → privacy → plan-result
4. **Tabs** (`/app/(tabs)`):
   - Home (dashboard) — theme-aware, daily progress, macros, timeline preview, quick actions
   - Calendar — day strip, day type pill (today/future/past), timeline bubbles
   - Add — FAB-driven multi-tab (food/activity/current/plan/past)
   - Chatbot — record-only assistant with voice + text + suggestions
   - Profile — user, theme switch, plan, weekly summary, logout

## Backend Endpoints (all under `/api`)
- `POST /auth/google-session` — exchange Emergent session_id for app token
- `GET /auth/me` — returns user, profile, plan
- `POST /auth/logout`
- `POST/GET /profile`, `PATCH /profile/theme`
- `POST/GET /entries`, `PATCH /entries/{id}/status`, `DELETE /entries/{id}`
- `POST /ai/chatbot` — parses user text → creates entry, returns summary (Gemini)
- `POST /ai/photo-analyze` — multipart form `image_base64` + `mime_type` (Gemini vision)
- `POST /ai/voice` — multipart file `audio` (Whisper-1, Turkish)
- `POST /foods/lookup` — AI-powered Turkish food lookup (Gemini)
- `GET /summary/daily?date=`, `GET /summary/weekly?end_date=`

## Calorie Engine
Mifflin-St Jeor BMR × activity factor → goal calories with safety floors (1500 M / 1200 F). Macros computed per goal (protein g/kg, fat 22–32%, remainder carbs). Water = 30–35 ml/kg. Fiber = 25–30 g.

## Timeline / Bubbles
Each entry has `timeline_bubble_type` (meal/water/coffee/activity/cardio/note/plan/past) and `status` (planned/completed/current_logged/past_logged/skipped/modified). Bubble color and icon are derived from type. Planned entries can be marked completed/skipped from the bubble.

## Day-type rules
- **Today** → all actions (food/activity/current/plan)
- **Future day** → plan only
- **Past day** → past_logged only

## Environment
- `MONGO_URL`, `DB_NAME=beslence_ai`, `EMERGENT_LLM_KEY` in `/app/backend/.env`
- `EXPO_PUBLIC_BACKEND_URL` in `/app/frontend/.env`

## Session Update (2026-06 — manual entry & edit batch)
- Assistant buttons now use MaterialCommunityIcons "robot" (tab FAB, dashboard CTA, calendar CTA).
- Chatbot quick chips (Su/Besin/Futbol/Kahve) REMOVED → single "Manuel Gir" button opens a modal:
  food name + protein/carb/fat grams + selectable time; calories auto-computed (4/4/9). Saves via POST /entries.
- New endpoint: `PATCH /entries/{id}/macros` {title?, protein_g, carbohydrate_g, fat_g} → sets min=max, kcal=4P+4C+9F.
- TimelineGrid: new "Makroları düzenle" action (detail modal + long-press sheet) for food/photo_food entries.
- TimelineGrid: new `sport` prop — hour/half/quarter labels render white in sportif theme.
- Report: 7-day strip fixed (no toISOString UTC shift, no row-reverse; today leftmost). "Kayıt" count removed.
- Profile: "En aktif gün" / "En çok kayıt" stats removed.

## Session Update (2026-06 — Pro subscription + push + reminders batch)
- Push (Emergent-managed): POST /api/register-push; backend asyncio scheduler → 19:00 daily report push,
  water reminders 10:00/13:00/16:00 (daytime only), user reminders at exact date+time (Europe/Istanbul).
  EMERGENT_PUSH_KEY=placeholder (auto-set at deployment). google-services.json NOT yet provided by user.
  Push only works after Publish → native builds (Expo Go/preview cannot receive push).
- Subscription: RevenueCat (react-native-purchases 10.4.4), entitlement "Beslence AI Pro",
  EXPO_PUBLIC_RC_API_KEY (test key) in frontend/.env. Endpoints: GET /subscription/me,
  POST /subscription/sync, POST /webhooks/revenuecat. 299 TL/ay + 3 gün deneme (store intro offer —
  must be configured in App Store Connect / Play Console as product, e.g. pro_monthly).
- Gating: free tier = manual entry only. Chatbot & Report redirect free → /paywall; "Ekle" tab shows
  manual add screen (add.tsx) for free, chatbot for pro. Paywall: /app/frontend/app/paywall.tsx.
- Reminders: Calendar tab "Hatırlatıcı ekle" modal → POST /entries entry_type="reminder",
  meal_type="hatirlatici"; scheduler sends push and sets notified=true.
- Calendar weekly cells: vertical bottom-up progress bar (totalCal / goal calorie target).
- Profile: fully theme-aware (sportif dark), Abonelik card, DELETE /api/auth/account + "Hesabı sil".
- Report date chips enlarged (fontSize 15).
- Auth fix: token only cleared on explicit 401 (network aborts no longer log out).

## Session Update (2026-06 — report/calendar polish)
- Report: "Uyarılar" section REMOVED per user request (backend still returns warnings array, UI ignores).
- Report totals now include Şeker (sugar_g, backend estimate ~25% of carbs) with inverse score coloring; "Kayıt" stays removed.
- Report date chips: fixed vertical clipping (height 44, centered, lineHeight 20).
- Report header + paywall hero + profile subscription card now use the brand logo (assets/images/beslence-b-logo-v2.png).
- Calendar weekly progress bars: root cause fixed (progressTrack/progressFill styles were missing) — bars now fill bottom-up vs calorie goal; today's fill is white.
- Cleanup: removed unused REF/MacroBar in TimelineGrid, unused warning styles.

## Session Update (2026-06 — store readiness)
- ReminderModal: added optional "Not ekle" field (EntryIn.note in backend); timeline detail shows note; "Miktar" edit hidden for reminder entries.
- app.json: android permissions now CAMERA/RECORD_AUDIO/POST_NOTIFICATIONS (removed legacy storage perms).
- New in-app legal pages: /legal/terms & /legal/privacy (Turkish; subscription terms per Apple/Google rules), linked from paywall + profile.
- STORE CHECKLIST pending on USER: RevenueCat PRODUCTION keys (current key is test store), store product pro_monthly 299TL + 3d trial in App Store Connect & Play Console, google-services.json (FCM), hosted privacy policy URL for store listing, screenshots/marketing, data safety & age rating forms.

## Session Update (2026-06 — deployment readiness)
- Deployment health check: PASS ✅ (after 2 blocker fixes)
  1. Supervisor expo command now includes --tunnel (installed @expo/ngrok 4.1.3 devDependency; tunnel connected).
  2. Web auth redirect now uses window.location.origin only; root Splash (app/index.tsx) processes #session_id and exchanges via /api/auth/google-session (falls back to /auth on failure). auth.tsx keeps its own handler for backward compat.

## Session Update (2026-06/09 — Expo SDK 57 upgrade)
- Upgraded Expo SDK 54 → 57 (react-native 0.86.3, react 19.2.3, reanimated 4.5.1, gesture-handler 2.32, expo-router ~57.0.19, expo-notifications ~57.0.17) via `yarn expo install expo@^57.0.0` + `--fix`.
- app.json: removed now-invalid `newArchEnabled` and `android.edgeToEdgeEnabled`; added expo-asset (peer of expo-audio). expo-doctor 21/21 PASS.
- Regression tested (iteration_10.json): all flows pass, no new warnings. Expo Go (latest) can now open the app.
- NOTE: sandbox clock jumps can TTL-expire test sessions; re-seed user_sessions with datetime expires_at if 401s appear.

## Session Update (2026-09 — weight tracking + trial paywall + store compliance)
- Welcome screen: FAKE "Apple ile Kaydol" and "E-posta ile Kaydol" buttons REMOVED (App Review rejection risk / guideline 4.8). Only real Google login remains.
- Post-onboarding trial paywall: plan-result "Ana ekrana geç" → replace /(tabs) then push /paywall once (only if !isPro).
- Weight tracking: new `weights` collection (unique user_id+date), POST/GET /api/weights (upsert per day, syncs profile.weight_kg). Report tab shows WeightCard (src/components/WeightCard.tsx): current / 7-day change / target summary + 8-point bar chart + add modal (saves to the selected report day).

## Session Update (2026-09 — final build readiness)
- Chatbot: highlighted yellow banner "Aktiviteni eklemeyi unutma!" above input area (testID chat-activity-banner).
- Deployment health check final status: WARN (NO blockers). Fixed along the way:
  * requirements.txt: httpx + openai added (pip freeze).
  * Env-only config: MONGO_URL, DB_NAME, EMERGENT_AUTH_URL, EMERGENT_INTEGRATIONS_URL (values in backend/.env; no source fallbacks).
  * frontend/.env METRO_CACHE_ROOT quoted.
  * TypeScript now compiles clean (tsc --noEmit = 0): AuthState got isPro/subLoading/refreshSubscription; absoluteFillObject replaced; typed-route pushes use object form.
  * IMPORTANT: react-native-purchases must NOT be added to expo.plugins (no app.plugin.js; breaks prebuild — empirically verified; deployer accepted as false positive).
- Remaining store-side (USER): google-services.json (+ app.json googleServicesFile refs) for push, public HTTPS privacy-policy URL, reviewer/demo notes, RevenueCat prod keys + pro_monthly product.

## Session Update (2026-09 — logout/delete redirect bugfix)
- FIXED: "Hesabı sil" & "Çıkış yap" now call context logout() (clears session + user/profile/plan/isPro) and router.replace("/welcome"). Verified by testing_agent (iteration_11.json): both redirect to welcome with no bounce-back; account really deleted (401 after).
- NOTE: any logout deletes test session — re-seed user_sessions before regression tests.

## Session Update (2026-09 — /health fix + RevenueCat completion)
- FIXED "building package failed": deploy health probe expects GET /health (root, non-/api) — added @app.get("/health") 200. Verified by testing_agent (iteration_12).
- RevenueCat integration completed & verified end-to-end: configure(appUserID) on login, entitlement "Beslence AI Pro", purchase/restore on paywall, backend sync/webhook, NEW manageSubscription() (native showManageSubscriptions → store URL fallback) wired to Profile subscription card for Pro users.
- Deployer's recurring "add react-native-purchases to expo.plugins" finding remains a FALSE POSITIVE (package ships no config plugin; adding it breaks prebuild — empirically proven).

## Session Update (2026-06 — activity → macro target bonus)
- FIXED (user bug): "aktivite girdikçe kalori yükseliyor ama makro gramajları artmıyor". Activity burn was added to the calorie goal only; protein/carb/fat targets stayed static.
- Backend server.py: new `_activity_macro_split(entry)` classifies each activity by dominant energy system via keyword+intensity matching:
  * Resistance/hypertrophy (ağırlık, gym, squat, bench, kas...) → 45% P / 40% K / 15% Y
  * High-intensity/glycogen (hiit, futbol, basketbol, koşu, yüksek intensity...) → 20% P / 70% K / 10% Y
  * LISS/fat-oxidation (yürüyüş, yoga, pilates, hafif intensity...) & default → 20% P / 50% K / 30% Y
  * `_activity_macro_bonus(items)` converts burn kcal→grams (P/K 4, Y 9) and aggregates. Returned as `macro_bonus` in GET /api/summary/daily and inside totals of GET /api/report/daily.
- Frontend: Home (index.tsx) MacroPill targets and Report (report.tsx) MacroRing targets now add `macro_bonus` on top of the base plan target; Report shows an info note listing +g P/K/Y. Calorie logic untouched.
- Verified via curl with 268 kcal resistance activity → +30 P / +27 K / +4 Y (matches user's reference exactly). All 3 energy-system splits unit-tested.

## Session Update (2026-06 — smart push notification algorithm)
- Rewrote push_scheduler (backend server.py) from dumb broadcast → personalized, behavior-aware (Europe/Istanbul, quiet hours 22:00–08:00). All messages are FACTUAL reminders only (no dietary/health advice — respects core constraint).
  * Meal nudges (engaged users, 3-day active): 10:30 kahvaltı / 14:30 öğle / 20:30 akşam — sent only if no food logged in that window.
  * Behavior-aware water: 12:00(40%) / 16:00(65%) / 19:30(85%) — sent only if intake < expected fraction of water_liter_min target.
  * 19:00 personalized daily report: only users with ≥1 entry today, teaser shows ~kcal, action_url /(tabs)/report.
  * 20:00 re-engagement: users active in last 14 days but NO entry today ("bugün seni özledik").
  * Activity → macro-update notice (~45 min after logging, once per entry via macro_notified flag): "+Xg P/K/Y hedefine eklendi" — ties into the activity-macro-bonus feature; factual.
  * Kept user-created reminders (entry_type=="reminder").
- New helpers: _push_user_once (per-user+date dedup via push_log), _notifs_on, _has_food_between, _water_target_ml, _load_engaged, _activity_macro_pushes.
- Opt-out: ProfileIn.notifications_enabled (default True) + PATCH /api/profile/notifications {enabled}. Profile screen "Bildirimler" section with Switch (testID notif-toggle) persists pref; scheduler skips users with notifications_enabled==False.
- Infra unchanged & playbook-compliant (register-push, send_push, _layout.tsx handlers, expo-notifications plugin, POST_NOTIFICATIONS). EMERGENT_PUSH_KEY still placeholder (set at deploy).
- BLOCKED for live delivery: user must (1) provide google-services.json for Android, (2) Publish/Deploy then generate iOS+Android builds. Does NOT work in Expo Go.
