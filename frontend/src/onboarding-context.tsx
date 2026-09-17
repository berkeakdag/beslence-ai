// Shared state for the multi-step onboarding flow (kept in memory + secure storage).
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { storage } from "@/src/utils/storage";

export interface OnboardingDraft {
  // step 1: goal
  goal_primary?: string;
  goal_secondary?: string[];
  // step 2: basic info
  name?: string;
  age?: number;
  sex?: "kadin" | "erkek" | "belirtmek_istemiyorum";
  height_cm?: number;
  weight_kg?: number;
  target_weight_kg?: number;
  // step 3: measurements (optional)
  waist_cm?: number;
  neck_cm?: number;
  hip_cm?: number;
  body_fat_percent?: number;
  // step 4: activity
  daily_activity_level?: "cok_hareketsiz" | "hafif_aktif" | "orta_aktif" | "aktif" | "cok_aktif";
  // step 5: sport
  sports_frequency?: "yok" | "1_2" | "3_4" | "5_plus" | "profesyonel";
  sports_types?: string[];
  average_training_duration_minutes?: number;
  average_training_intensity?: "hafif" | "orta" | "yuksek";
  // step 6: theme
  selected_theme?: "sakin" | "sportif";
}

interface Ctx {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  reset: () => void;
}

const C = createContext<Ctx | null>(null);
const KEY = "beslence_onboarding_draft";

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [draft, setDraft] = useState<OnboardingDraft>({ selected_theme: "sakin", goal_secondary: [], sports_types: [] });

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem(KEY, "");
      if (raw && typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          setDraft((d) => ({ ...d, ...parsed }));
        } catch {}
      }
    })();
  }, []);

  const persist = useCallback(async (next: OnboardingDraft) => {
    await storage.setItem(KEY, JSON.stringify(next));
  }, []);

  const update = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((d) => {
      const next = { ...d, ...patch };
      void persist(next);
      return next;
    });
  }, [persist]);

  const reset = useCallback(() => {
    setDraft({ selected_theme: "sakin", goal_secondary: [], sports_types: [] });
    void storage.removeItem(KEY);
  }, []);

  return <C.Provider value={{ draft, update, reset }}>{children}</C.Provider>;
};

export const useOnboarding = () => {
  const ctx = useContext(C);
  if (!ctx) throw new Error("OnboardingProvider missing");
  return ctx;
};
