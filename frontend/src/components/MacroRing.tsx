// Circular progress ring with a big centered value.
// Used on the Report screen for the 4 primary macros.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface Props {
  value: number;      // current value
  target: number;     // goal value (rings stop at 100% visually but shows "+%X" when exceeded)
  color: string;      // fill color
  label: string;      // "Kalori", "Protein", etc.
  unit: string;       // "kcal" or "g"
  textColor: string;
  mutedColor: string;
  trackColor?: string;
  size?: number;      // diameter in px
}

export const MacroRing: React.FC<Props> = ({
  value, target, color, label, unit, textColor, mutedColor,
  trackColor = "rgba(255,255,255,0.08)", size = 108,
}) => {
  const strokeW = 10;
  const r = (size - strokeW) / 2;
  const c = 2 * Math.PI * r;
  const ratio = target > 0 ? Math.min(1, value / target) : 0;
  const pct = target > 0 ? Math.round((value / target) * 100) : 0;
  const extra = pct > 100 ? pct - 100 : 0;

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        {/* track */}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeW} fill="none" />
        {/* fill */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * ratio} ${c}`}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
        <Text style={[styles.value, { color: textColor }]}>{value}</Text>
        <Text style={[styles.unit, { color: mutedColor }]}>{unit}</Text>
        {target > 0 && <Text style={[styles.pct, { color: mutedColor }]}>%{pct}</Text>}
      </View>
      {extra > 0 && (
        <View style={[styles.overBadge, { backgroundColor: color }]}>
          <Text style={styles.overText}>+%{extra}</Text>
        </View>
      )}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: "center", position: "relative" },
  center: { position: "absolute", top: 0, left: 0, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  unit: { fontSize: 10, fontWeight: "700", marginTop: -1 },
  pct: { fontSize: 10, fontWeight: "800", marginTop: 2 },
  overBadge: { position: "absolute", top: -6, right: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  overText: { fontSize: 9, fontWeight: "900", color: "#0A0F0D" },
  label: { fontSize: 12, fontWeight: "800", marginTop: 6 },
});
