// BESLENCE AI leaf-filling logo component
import React, { useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  withSequence,
} from "react-native-reanimated";
import { COLORS } from "@/src/theme";

interface Props {
  size?: number;
  showWordmark?: boolean;
  animate?: boolean;
  tint?: string;
}

export const BeslenceLogo: React.FC<Props> = ({
  size = 92,
  showWordmark = true,
  animate = true,
  tint = COLORS.primary,
}) => {
  const fill = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      fill.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }),
          withTiming(0.15, { duration: 1400, easing: Easing.in(Easing.cubic) })
        ),
        -1,
        false
      );
    } else {
      fill.value = withTiming(1, { duration: 900 });
    }
  }, [animate, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    height: `${15 + fill.value * 85}%`,
  }));

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.logoBox,
          {
            width: size,
            height: size,
            borderRadius: size * 0.28,
            borderColor: COLORS.mint,
          },
        ]}
      >
        {/* leaf-shape mask: rounded outer box, animated fill */}
        <View style={[styles.fillContainer, { borderRadius: size * 0.24 }]}>
          <Animated.View
            style={[
              styles.fill,
              fillStyle,
              { backgroundColor: tint, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
            ]}
          />
        </View>
        {/* B letter */}
        <Text
          style={[
            styles.bLetter,
            { fontSize: size * 0.6, color: COLORS.white },
          ]}
        >
          B
        </Text>
        {/* leaf sprout on top */}
        <View
          style={[
            styles.leaf,
            {
              top: -size * 0.18,
              right: size * 0.12,
              width: size * 0.32,
              height: size * 0.32,
              backgroundColor: tint,
              borderTopLeftRadius: size * 0.32,
              borderTopRightRadius: size * 0.08,
              borderBottomRightRadius: size * 0.32,
              borderBottomLeftRadius: size * 0.08,
              transform: [{ rotate: "-25deg" }],
            },
          ]}
        />
      </View>
      {showWordmark && (
        <View style={{ marginTop: 16, alignItems: "center" }}>
          <Text style={styles.wordmark} testID="logo-wordmark">BESLENCE AI</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  logoBox: {
    backgroundColor: COLORS.dark,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 4,
    position: "relative",
  },
  fillContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  fill: {
    width: "100%",
    opacity: 0.85,
  },
  bLetter: {
    fontWeight: "800",
    letterSpacing: -2,
  },
  leaf: {
    position: "absolute",
    opacity: 0.95,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 4,
    color: COLORS.dark,
  },
});
