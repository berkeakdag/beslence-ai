// Step 8: Waist (optional)
import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingScaffold } from "@/src/components/OnboardingScaffold";
import { useOnboarding } from "@/src/onboarding-context";
import { COLORS, RADIUS } from "@/src/theme";

export default function WaistStep() {
  const router = useRouter();
  const { draft, update } = useOnboarding();
  const [v, setV] = useState(draft.waist_cm?.toString() || "");

  const save = () => {
    update({ waist_cm: v ? parseFloat(v) : undefined });
    router.push("/onboarding/theme");
  };
  return (
    <OnboardingScaffold
      step={8}
      total={10}
      title="Bel çevreni eklemek ister misin?"
      subtitle="Vücut gelişimini daha iyi takip etmene yardımcı olabilir. Opsiyonel."
      onNext={save}
      secondary={{ label: "Şimdilik atla", onPress: () => router.push("/onboarding/theme") }}
    >
      <View style={{ marginTop: 8 }}>
        <Text style={styles.label}>Bel çevresi</Text>
        <View style={styles.row}>
          <TextInput
            testID="waist-input"
            style={styles.input}
            value={v}
            onChangeText={(t) => setV(t.replace(/[^0-9.]/g, ""))}
            keyboardType="numeric"
            placeholder="80"
            placeholderTextColor={COLORS.textMuted}
            autoFocus
          />
          <Text style={styles.unit}>cm</Text>
        </View>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: COLORS.textMuted, fontWeight: "700", marginBottom: 6, letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 22,
    fontWeight: "700", color: COLORS.textMain, borderWidth: 1, borderColor: COLORS.border,
  },
  unit: { fontSize: 16, color: COLORS.textMuted, fontWeight: "700" },
});
