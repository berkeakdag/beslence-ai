// 5-tier color scoring for goal proximity.
// Same rules used across Dashboard macro dots + Report values + Weekly bars.
export const SCORE_COLORS = {
  darkGreen: "#0F6E56", // on target 90-110%
  neonGreen: "#00E676", // close 75-89% or 111-125%
  yellow:    "#F2E94E", // medium deviation 50-74% or 126-150%
  orange:    "#FF6D3A", // high deviation 30-49% or 151-180%
  red:       "#FF3D3D", // extreme deviation <30% or >180%
};

/**
 * Standard rule: hitting the target is best; both under and over are penalized.
 * Values ratio = actual / target.
 */
export function scoreColor(actual: number, target: number): string {
  if (!(target > 0)) return SCORE_COLORS.neonGreen;
  const pct = (actual / target) * 100;
  if (pct >= 90 && pct <= 110) return SCORE_COLORS.darkGreen;
  if ((pct >= 75 && pct < 90) || (pct > 110 && pct <= 125)) return SCORE_COLORS.neonGreen;
  if ((pct >= 50 && pct < 75) || (pct > 125 && pct <= 150)) return SCORE_COLORS.yellow;
  if ((pct >= 30 && pct < 50) || (pct > 150 && pct <= 180)) return SCORE_COLORS.orange;
  return SCORE_COLORS.red;
}

/**
 * Inverse rule for "less is better" metrics like sodium / added sugar / saturated fat.
 * Ratio = actual / limit.
 */
export function scoreColorInverse(actual: number, limit: number): string {
  if (!(limit > 0)) return SCORE_COLORS.darkGreen;
  const pct = (actual / limit) * 100;
  if (pct <= 70)  return SCORE_COLORS.darkGreen;
  if (pct <= 100) return SCORE_COLORS.neonGreen;
  if (pct <= 130) return SCORE_COLORS.yellow;
  if (pct <= 160) return SCORE_COLORS.orange;
  return SCORE_COLORS.red;
}
