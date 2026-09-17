// BESLENCE AI brand colors and theme tokens.
// Two themes: "sakin" (calm light) and "sportif" (neon dark).
export const COLORS = {
  primary: "#1D9E75",
  secondary: "#0F6E56",
  dark: "#0B2620",
  mint: "#E0F5EE",
  paper: "#F9FAF9",
  white: "#FFFFFF",
  textMain: "#0B2620",
  textMuted: "#5B7A72",
  border: "#E6EEEB",
  warn: "#E89A2C",
  danger: "#E5484D",
  // bubble colors (legacy)
  bubbleMeal: "#1D9E75",
  bubbleWater: "#3AB0FF",
  bubbleCoffee: "#8D6E63",
  bubbleActivity: "#FF7043",
  bubbleCardio: "#F06292",
  bubblePlan: "#94A3B8",
  bubblePast: "#7C8B85",
  bubbleNote: "#A78BFA",
  // meal-type premium pastel palette (calm theme)
  mealKahvalti: "#F09E55",
  mealOgle:     "#3FA889",
  mealAksam:    "#6F7EB3",
  mealAraOgun:  "#E18AB0",
  mealAktivite: "#FF7A45",
  mealSu:       "#4FB3E8",
  mealKahve:    "#A07555",
  mealNot:      "#9AA6B2",
  mealPlan:     "#7C8DB5",
  nowLine:      "#E5484D",
};

// Sport-mode dark palette: only 4 accent colors on a near-black surface.
// Every accent color has ONE meaning to keep the palette clean.
export const SPORT = {
  bg:            "#0A0F0D",   // near-black with slight green tint (canvas)
  surface:       "#12191A",   // primary card surface
  surfaceAlt:    "#182220",   // secondary surface
  border:        "#21302D",   // subtle border
  textMain:      "#E8F5F0",   // main text
  textMuted:     "#7A9088",   // muted / captions
  textInverse:   "#0A0F0D",   // text drawn on neon fills

  // Only 4 accents — each with a fixed meaning
  neonGreen:  "#00E676",  // brand / "now" / active state / success
  sportOrange:"#FF6D3A",  // workouts, carbohydrate
  bloodRed:   "#FF3D3D",  // warnings, calorie-heavy alerts
  iceBlue:    "#66E0FF",  // water only
};

export const RADIUS = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };
export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const SHADOW = {
  card: { shadowColor: "#0B2620", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 3 },
  cta:  { shadowColor: "#1D9E75", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 6 },
};

export type ThemeMode = "sakin" | "sportif";

export interface ThemedTokens {
  // Surfaces
  bg: string;         // page background
  surface: string;    // primary card
  surfaceAlt: string; // secondary card / raised state
  border: string;

  // Text
  textMain: string;
  textMuted: string;
  textInverse: string;

  // Accents (semantic meanings — same 4 across themes)
  accentBrand:   string; // primary CTA / active
  accentWorkout: string; // workouts, carbs, orange energy
  accentAlert:   string; // warnings, calorie-heavy
  accentWater:   string; // water only

  // Legacy shortcuts (kept for backwards compatibility with existing code)
  cardRadius: number;
  accent: string;
  accentSoft: string;
  textOnAccent: string;

  // Meal-type card colors (kept identical but darker bg in sportif; drawn as pill outlines)
  mealBgFor: (key: string) => { color: string; bg: string };
  mode: ThemeMode;
  isSport: boolean;
}

export const getThemed = (mode: ThemeMode): ThemedTokens => {
  if (mode === "sportif") {
    return {
      bg: SPORT.bg,
      surface: SPORT.surface,
      surfaceAlt: SPORT.surfaceAlt,
      border: SPORT.border,
      textMain: SPORT.textMain,
      textMuted: SPORT.textMuted,
      textInverse: SPORT.textInverse,

      accentBrand:   SPORT.neonGreen,
      accentWorkout: SPORT.sportOrange,
      accentAlert:   SPORT.bloodRed,
      accentWater:   SPORT.iceBlue,

      // Legacy
      cardRadius: RADIUS.lg,
      accent: SPORT.neonGreen,
      accentSoft: "#0F3A2A",
      textOnAccent: SPORT.textInverse,

      mode: "sportif",
      isSport: true,
      mealBgFor: (key) => {
        // In sport mode we use only 4 accent colors semantically:
        //  workouts → orange, water → ice-blue, carbs-heavy → orange,
        //  calorie-alert → red, everything else → neon-green outline.
        switch (key) {
          case "aktivite": return { color: SPORT.sportOrange, bg: "#2A1409" };
          case "su":       return { color: SPORT.iceBlue,     bg: "#0A1D26" };
          case "kahvalti":
          case "ara_ogun": return { color: SPORT.neonGreen,   bg: "#0F2117" };
          case "ogle":
          case "aksam":    return { color: SPORT.sportOrange, bg: "#241108" };
          case "kahve":    return { color: SPORT.sportOrange, bg: "#1F1109" };
          default:         return { color: SPORT.neonGreen,   bg: "#0F2117" };
        }
      },
    };
  }
  return {
    bg: COLORS.paper,
    surface: COLORS.white,
    surfaceAlt: COLORS.paper,
    border: COLORS.border,
    textMain: COLORS.textMain,
    textMuted: COLORS.textMuted,
    textInverse: COLORS.white,

    accentBrand:   COLORS.primary,
    accentWorkout: COLORS.mealAktivite,
    accentAlert:   COLORS.danger,
    accentWater:   COLORS.mealSu,

    cardRadius: RADIUS.xl,
    accent: COLORS.primary,
    accentSoft: COLORS.mint,
    textOnAccent: COLORS.white,

    mode: "sakin",
    isSport: false,
    mealBgFor: (key) => {
      switch (key) {
        case "kahvalti":  return { color: COLORS.mealKahvalti, bg: "#FFEFDF" };
        case "ogle":      return { color: COLORS.mealOgle,     bg: "#E1F1EA" };
        case "aksam":     return { color: COLORS.mealAksam,    bg: "#E5E7F5" };
        case "ara_ogun":  return { color: COLORS.mealAraOgun,  bg: "#FBE3EE" };
        case "aktivite":  return { color: COLORS.mealAktivite, bg: "#FFE0D2" };
        case "su":        return { color: COLORS.mealSu,       bg: "#DEF1FB" };
        case "kahve":     return { color: COLORS.mealKahve,    bg: "#EBE0DA" };
        case "not":       return { color: COLORS.mealNot,      bg: "#ECEEF1" };
        case "plan":      return { color: COLORS.mealPlan,     bg: "#E6EAF3" };
        default:          return { color: COLORS.mealAraOgun,  bg: "#FBE3EE" };
      }
    },
  };
};
