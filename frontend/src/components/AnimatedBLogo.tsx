// Animated B logo: a geometric B drawn with SVG Paths (no font dependency)
// so it renders identically on iOS, Android Expo Go, and Web. Food emojis
// pop in inside the B body, avoiding the two counter holes and the stroke.
import React, { useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

interface Props {
  size?: number;
  onComplete?: () => void;
  // background color shown through the counter holes — should match the
  // splash background so the counters look "empty".
  bgColor?: string;
}

// (x, y) center in [0..1]; `s` is a per-emoji size multiplier.
type Food = { e: string; x: number; y: number; s?: number };

// Tuned to fit the path-based B silhouette below.
const FOODS: Food[] = [
  // Top arch (above the top counter) — y ~ 0.16-0.18
  { e: "🍏", x: 0.28, y: 0.17, s: 1.3 },
  { e: "🥦", x: 0.43, y: 0.15, s: 1.2 },
  { e: "🥪", x: 0.58, y: 0.15, s: 1.4 },
  { e: "🍌", x: 0.73, y: 0.18, s: 1.2 },

  // Left bar (between top arch and middle)
  { e: "🥕", x: 0.22, y: 0.31, s: 1.0 },
  { e: "🍇", x: 0.22, y: 0.43, s: 0.95 },

  // Right curve of top bump
  { e: "🌶️", x: 0.74, y: 0.32, s: 1.0 },

  // Middle horizontal connector (y ~ 0.52)
  { e: "🐟", x: 0.30, y: 0.52, s: 1.15 },
  { e: "🍞", x: 0.46, y: 0.52, s: 1.25 },
  { e: "🍗", x: 0.60, y: 0.52, s: 1.0 },
  { e: "🥑", x: 0.76, y: 0.50, s: 1.1 },

  // Left bar / right curve around the bottom counter
  { e: "🌰", x: 0.22, y: 0.66, s: 0.85 },
  { e: "🥬", x: 0.78, y: 0.66, s: 1.0 },

  // Bottom arch (below the bottom counter) — y ~ 0.84
  { e: "🥛", x: 0.27, y: 0.84, s: 1.0 },
  { e: "🍋", x: 0.40, y: 0.84, s: 0.9 },
  { e: "🍅", x: 0.52, y: 0.84, s: 1.05 },
  { e: "🍳", x: 0.65, y: 0.84, s: 1.0 },
  { e: "🫑", x: 0.77, y: 0.83, s: 1.0 },
];

// Geometric B in a 260x260 viewBox. Outer hull + two counter cut-outs are
// drawn as separate paths so the strokes show on both outer and inner edges.
const STROKE_NAVY = "#1B2A55";

export const AnimatedBLogo: React.FC<Props> = ({
  size = 260,
  onComplete,
  bgColor = "#F4F4F4",
}) => {
  const baseEmoji = size * 0.072;

  return (
    <View style={[styles.wrap, { width: size, height: size }]} testID="splash-b-logo">
      <Svg width={size} height={size} viewBox="0 0 260 260">
        {/* B outer body (white fill, navy stroke) */}
        <Path
          d="M 40 30
             L 150 30
             C 200 30 200 130 150 130
             L 145 130
             C 215 130 215 230 150 230
             L 40 230
             Z"
          fill="#FFFFFF"
          stroke={STROKE_NAVY}
          strokeWidth={11}
          strokeLinejoin="round"
        />
        {/* Top counter hole (background-colored fill + navy stroke) */}
        <Path
          d="M 82 60
             L 132 60
             C 162 60 162 100 132 100
             L 82 100
             Z"
          fill={bgColor}
          stroke={STROKE_NAVY}
          strokeWidth={8}
          strokeLinejoin="round"
        />
        {/* Bottom counter hole */}
        <Path
          d="M 82 160
             L 142 160
             C 175 160 175 200 142 200
             L 82 200
             Z"
          fill={bgColor}
          stroke={STROKE_NAVY}
          strokeWidth={8}
          strokeLinejoin="round"
        />
      </Svg>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {FOODS.map((f, i) => (
          <FoodDot
            key={i}
            emoji={f.e}
            emojiSize={Math.round(baseEmoji * (f.s ?? 1))}
            cx={f.x * size}
            cy={f.y * size}
            delay={120 + i * 55}
            isLast={i === FOODS.length - 1}
            onComplete={onComplete}
          />
        ))}
      </View>
    </View>
  );
};

const FoodDot: React.FC<{
  emoji: string;
  emojiSize: number;
  cx: number;
  cy: number;
  delay: number;
  isLast?: boolean;
  onComplete?: () => void;
}> = ({ emoji, emojiSize, cx, cy, delay, isLast, onComplete }) => {
  const sv = useSharedValue(0);
  useEffect(() => {
    sv.value = withDelay(
      delay,
      withTiming(1, { duration: 280, easing: Easing.out(Easing.back(1.4)) }, (finished) => {
        if (finished && isLast && onComplete) {
          // @ts-ignore
          if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(() => onComplete());
        }
      })
    );
  }, [sv, delay, isLast, onComplete]);

  const box = emojiSize * 1.15;
  const style = useAnimatedStyle(() => ({
    opacity: sv.value,
    transform: [{ scale: 0.25 + sv.value * 0.75 }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { left: cx - box / 2, top: cy - box / 2, width: box, height: box },
        style,
      ]}
    >
      <Text style={{ fontSize: emojiSize, lineHeight: emojiSize * 1.1 }}>{emoji}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", position: "relative" },
  dot: { position: "absolute", alignItems: "center", justifyContent: "center" },
});
