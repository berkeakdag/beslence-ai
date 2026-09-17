// API client for BESLENCE AI backend
import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const API = `${BASE}/api`;

const SESSION_KEY = "beslence_session_token";

export const session = {
  async get() {
    return (await storage.secureGet(SESSION_KEY, "")) || "";
  },
  async set(token: string) {
    await storage.secureSet(SESSION_KEY, token);
  },
  async clear() {
    await storage.secureRemove(SESSION_KEY);
  },
};

async function request(path: string, opts: RequestInit = {}, withAuth = true) {
  const token = withAuth ? await session.get() : "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      errMsg = j.detail || JSON.stringify(j);
    } catch {}
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  // auth
  googleSession: (session_id: string) =>
    request("/auth/google-session", { method: "POST", body: JSON.stringify({ session_id }) }, false),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),

  // profile
  saveProfile: (profile: any) => request("/profile", { method: "POST", body: JSON.stringify(profile) }),
  getProfile: () => request("/profile"),
  setTheme: (selected_theme: "sakin" | "sportif") =>
    request("/profile/theme", { method: "PATCH", body: JSON.stringify({ selected_theme }) }),
  setNotificationsPref: (enabled: boolean) =>
    request("/profile/notifications", { method: "PATCH", body: JSON.stringify({ enabled }) }),

  // entries
  createEntry: (entry: any) => request("/entries", { method: "POST", body: JSON.stringify(entry) }),
  listEntries: (date?: string) => request(`/entries${date ? `?date=${date}` : ""}`),
  updateEntryStatus: (id: string, status: string) =>
    request(`/entries/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  updateEntryTime: (id: string, time: string) =>
    request(`/entries/${id}/time`, { method: "PATCH", body: JSON.stringify({ time }) }),
  updateEntryAmount: (id: string, amount: number, unit: string) =>
    request(`/entries/${id}/amount`, { method: "PATCH", body: JSON.stringify({ amount, unit }) }),
  updateEntryMacros: (id: string, payload: { title?: string; protein_g: number; carbohydrate_g: number; fat_g: number }) =>
    request(`/entries/${id}/macros`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteEntry: (id: string) => request(`/entries/${id}`, { method: "DELETE" }),

  // push + subscription + account
  registerPush: (user_id: string, platform: string, device_token: string) =>
    request("/register-push", { method: "POST", body: JSON.stringify({ user_id, platform, device_token }) }, false),
  subscriptionMe: () => request("/subscription/me"),
  subscriptionSync: (is_pro: boolean, expires_at?: string, store?: string) =>
    request("/subscription/sync", { method: "POST", body: JSON.stringify({ is_pro, expires_at, store }) }),
  deleteAccount: () => request("/auth/account", { method: "DELETE" }),

  // weight tracking
  addWeight: (date: string, weight_kg: number) =>
    request("/weights", { method: "POST", body: JSON.stringify({ date, weight_kg }) }),
  listWeights: (limit = 60) => request(`/weights?limit=${limit}`),

  // report
  dailyReport: (date: string) => request(`/report/daily?date=${date}`),

  // ai
  chatbot: (
    message: string,
    user_local_time?: string,
    draft?: any,
    clarification_answers?: { id: string; answer: string }[]
  ) =>
    request("/ai/chatbot", {
      method: "POST",
      body: JSON.stringify({ message, user_local_time, draft, clarification_answers }),
    }),

  photoAnalyze: async (image_base64: string, mime_type = "image/jpeg") => {
    const token = await session.get();
    const form = new FormData();
    form.append("image_base64", image_base64);
    form.append("mime_type", mime_type);
    const res = await fetch(`${API}/ai/photo-analyze`, {
      method: "POST",
      body: form as any,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "Photo analyze failed");
    }
    return res.json();
  },

  voiceTranscribe: async (uri: string, fileName: string, mimeType: string) => {
    const token = await session.get();
    const form = new FormData();
    // @ts-ignore react-native FormData file
    form.append("audio", { uri, name: fileName, type: mimeType });
    const res = await fetch(`${API}/ai/voice`, {
      method: "POST",
      body: form as any,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "Voice transcribe failed");
    }
    return res.json();
  },

  foodLookup: (query: string) => request("/foods/lookup", { method: "POST", body: JSON.stringify({ query }) }),

  dailySummary: (date: string) => request(`/summary/daily?date=${date}`),
  weeklySummary: (end_date: string) => request(`/summary/weekly?end_date=${end_date}`),
};
