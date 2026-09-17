// Animated water-glass indicator. Fills from the bottom based on currentMl / targetMl.
// Uses react-native-reanimated for a smooth 400ms fill animation on value change.
// When target is reached, the glass glows.
import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  currentMl: number;
  targetMl: number;
  accent: string;
  surface: string;
  border: string;
  textMuted: string;
  size?: number;
}

const WIDTH = 72;
const HEIGHT = 100;

export const WaterGlass: React.FC<Props> = ({
  currentMl, targetMl, accent, border, textMuted, size = HEIGHT,
}) => {
  const ratio = Math.max(0, Math.min(1, targetMl > 0 ? currentMl / targetMl : 0));
  const height = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    height.value = withTiming(ratio, { duration: 420, easing: Easing.out(Easing.cubic) });
    glow.value = withTiming(ratio >= 1 ? 1 : 0, { duration: 300 });
  }, [ratio, height, glow]);

  const fillStyle = useAnimatedStyle(() => ({
    height: `${height.value * 100}%`,
  }));
  const outerStyle = useAnimatedStyle(() => ({
    shadowOpacity: glow.value * 0.9,
    shadowRadius: 4 + glow.value * 12,
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.glass,
          {
            width: WIDTH * (size / HEIGHT),
            height: size,
            borderColor: border,
            backgroundColor: "transparent",
            shadowColor: accent,
          },
          outerStyle,
        ]}
        testID="water-glass"
      >
        {/* Water fill (absolute-positioned from bottom) */}
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: accent },
            fillStyle,
          ]}
        />
        {/* Wave overlay (simple decorative arc) */}
        <View pointerEvents="none" style={styles.rim} />
        {/* Icon in center (subtle) */}
        {ratio >= 1 && (
          <View style={styles.checkOverlay}>
            <Ionicons name="checkmark" size={20} color="#0A0F0D" />
          </View>
        )}
      </Animated.View>
      <Text style={[styles.pctText, { color: textMuted }]}>%{Math.round(ratio * 100)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 4 },
  glass: {
    borderWidth: 2,
    borderRadius: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
    // Slight taper on the top — use marginTop instead of clip-path (not available in RN)
  },
  fill: {
    width: "100%",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    opacity: 0.9,
  },
  rim: {
    position: "absolute",
    top: -1,
    left: -1,
    right: -1,
    height: 6,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  checkOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  pctText: { fontSize: 11, fontWeight: "800" },
});
