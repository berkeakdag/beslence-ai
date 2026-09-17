// Auth + profile/theme + subscription context
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, session } from "@/src/api";
import { ThemeMode } from "@/src/theme";
import { registerForPush } from "@/src/push";
import { configureRC, checkProEntitlement } from "@/src/revenuecat";

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
}

interface Profile {
  name?: string;
  age?: number;
  sex?: string;
  height_cm?: number;
  weight_kg?: number;
  target_weight_kg?: number;
  goal_primary?: string;
  daily_activity_level?: string;
  sports_frequency?: string;
  sports_types?: string[];
  selected_theme?: ThemeMode;
  [k: string]: any;
}

interface Plan {
  bmr_kcal?: number;
  maintenance_calories?: number;
  goal_calories_min?: number;
  goal_calories_max?: number;
  protein_g_min?: number;
  protein_g_max?: number;
  carbohydrate_g_min?: number;
  carbohydrate_g_max?: number;
  fat_g_min?: number;
  fat_g_max?: number;
  fiber_g_target_min?: number;
  fiber_g_target_max?: number;
  water_liter_min?: number;
  water_liter_max?: number;
}

interface AuthState {
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  plan: Plan | null;
  hasProfile: boolean;
  theme: ThemeMode;
  isPro: boolean;
  subLoading: boolean;
  refreshSubscription: () => Promise<void>;
  setSessionToken: (t: string) => Promise<void>;
  refresh: () => Promise<void>;
  setProfile: (p: Profile) => Promise<void>;
  setTheme: (t: ThemeMode) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [theme, setThemeState] = useState<ThemeMode>("sakin");
  const [isPro, setIsPro] = useState(false);
  const [subLoading, setSubLoading] = useState(true);

  const refreshSubscription = useCallback(async () => {
    try {
      const s = await api.subscriptionMe();
      let pro = !!s.is_pro;
      // Cross-check with RevenueCat entitlement on native builds.
      const ent = await checkProEntitlement();
      if (ent !== null && ent !== pro) {
        try { await api.subscriptionSync(ent); } catch {}
        pro = ent;
      }
      setIsPro(pro);
    } catch {}
    setSubLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const tok = await session.get();
      if (!tok) {
        setUser(null);
        setProfileState(null);
        setPlan(null);
        setIsPro(false);
        setSubLoading(false);
        return;
      }
      const data = await api.me();
      setUser(data.user);
      setProfileState(data.profile);
      setPlan(data.plan);
      if (data.profile?.selected_theme) setThemeState(data.profile.selected_theme);
      // Side effects: push registration + RevenueCat config (both no-op on web/Expo Go)
      const uid = data.user?.user_id;
      if (uid) {
        registerForPush(uid).catch(() => {});
        configureRC(uid).catch(() => {});
      }
      await refreshSubscription();
    } catch (e: any) {
      // Only clear the token on an explicit auth rejection — transient network
      // errors/aborts must NOT log the user out.
      const msg = String(e?.message || "");
      if (msg.includes("401") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("invalid session")) {
        await session.clear();
        setUser(null);
      }
      setSubLoading(false);
    }
  }, [refreshSubscription]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const setSessionToken = useCallback(async (t: string) => {
    await session.set(t);
    await refresh();
  }, [refresh]);

  const setProfile = useCallback(async (p: Profile) => {
    const res = await api.saveProfile(p);
    setProfileState(res.profile);
    setPlan(res.plan);
    if (res.profile?.selected_theme) setThemeState(res.profile.selected_theme);
  }, []);

  const setTheme = useCallback(async (t: ThemeMode) => {
    setThemeState(t);
    try {
      await api.setTheme(t);
    } catch {}
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {}
    await session.clear();
    setUser(null);
    setProfileState(null);
    setPlan(null);
    setIsPro(false);
  }, []);

  const value: AuthState = {
    loading,
    user,
    profile,
    plan,
    hasProfile: !!profile,
    theme,
    isPro,
    subLoading,
    refreshSubscription,
    setSessionToken,
    refresh,
    setProfile,
    setTheme,
    logout,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
};
