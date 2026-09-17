// Reusable primary / secondary button
import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { COLORS, RADIUS, SHADOW } from "@/src/theme";

interface Props {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "dark";
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  /** Optional overrides for themed screens (e.g. sport dark mode). */
  textColor?: string;
  borderColor?: string;
}

export const PrimaryButton: React.FC<Props> = ({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  testID,
  icon,
  fullWidth = true,
  textColor,
  borderColor,
}) => {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const isGhost = variant === "ghost";
  const isDark = variant === "dark";

  const bg = isPrimary ? COLORS.primary : isSecondary ? COLORS.mint : isDark ? COLORS.dark : "transparent";
  const fg = textColor || (isPrimary || isDark ? COLORS.white : isSecondary ? COLORS.secondary : COLORS.textMain);
  const border = borderColor || (isGhost ? COLORS.border : "transparent");

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: isGhost ? 1 : 0,
          opacity: disabled ? 0.45 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
        },
        isPrimary ? SHADOW.cta : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon}
          <Text style={[styles.txt, { color: fg }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  txt: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
