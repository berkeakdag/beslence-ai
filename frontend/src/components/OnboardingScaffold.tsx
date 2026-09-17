// Shared onboarding scaffold (header, progress, next/back buttons)
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { PrimaryButton } from "@/src/components/PrimaryButton";

interface Props {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  secondary?: { label: string; onPress: () => void };
  showBack?: boolean;
}

export const OnboardingScaffold: React.FC<Props> = ({
  step, total, title, subtitle, children, onNext, nextLabel = "Devam Et", nextDisabled, nextLoading, secondary, showBack = true,
}) => {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
        <View style={styles.header}>
          <TouchableOpacity
            testID="onboard-back-button"
            disabled={!showBack}
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            {showBack && <Ionicons name="chevron-back" size={24} color={COLORS.textMain} />}
          </TouchableOpacity>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(step / total) * 100}%` }]} />
          </View>
          <Text style={styles.stepText}>{step}/{total}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title} testID="onboard-title">{title}</Text>
          {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
          <View style={{ marginTop: 20 }}>{children}</View>
        </ScrollView>
        <View style={styles.footer}>
          {secondary && (
            <TouchableOpacity testID="onboard-secondary-btn" onPress={secondary.onPress} style={styles.skip}>
              <Text style={styles.skipText}>{secondary.label}</Text>
            </TouchableOpacity>
          )}
          <PrimaryButton
            title={nextLabel}
            onPress={onNext}
            disabled={nextDisabled}
            loading={nextLoading}
            testID="onboard-next-btn"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

interface OptionCardProps {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  icon?: React.ReactNode;
}

export const OptionCard: React.FC<OptionCardProps> = ({ title, description, selected, onPress, testID, icon }) => {
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        cardStyles.card,
        selected && cardStyles.cardSelected,
      ]}
    >
      {icon && <View style={cardStyles.iconWrap}>{icon}</View>}
      <View style={{ flex: 1 }}>
        <Text style={[cardStyles.title, selected && { color: COLORS.secondary }]}>{title}</Text>
        {!!description && <Text style={cardStyles.desc}>{description}</Text>}
      </View>
      <View style={[cardStyles.check, selected && cardStyles.checkOn]}>
        {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
};

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.mint,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.mint, alignItems: "center", justifyContent: "center",
  },
  title: { fontWeight: "700", fontSize: 15, color: COLORS.textMain },
  desc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  check: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: COLORS.border, alignItems: "center", justifyContent: "center",
  },
  checkOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.md, paddingTop: 8, paddingBottom: 8, gap: 12,
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  progressTrack: { flex: 1, height: 6, backgroundColor: COLORS.mint, borderRadius: 6, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: COLORS.primary, borderRadius: 6 },
  stepText: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted, width: 38, textAlign: "right" },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.md, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.textMain, letterSpacing: -0.5 },
  sub: { marginTop: 8, fontSize: 14, color: COLORS.textMuted, lineHeight: 22 },
  footer: { padding: SPACING.lg, paddingTop: 8, gap: 8, backgroundColor: COLORS.paper },
  skip: { alignItems: "center", padding: 8 },
  skipText: { color: COLORS.textMuted, fontWeight: "600", fontSize: 14 },
});
