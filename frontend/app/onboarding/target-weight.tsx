// Step 7: Target weight (optional)
import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingScaffold } from "@/src/components/OnboardingScaffold";
import { useOnboarding } from "@/src/onboarding-context";
import { COLORS, RADIUS } from "@/src/theme";

export default function TargetWeightStep() {
  const router = useRouter();
  const { draft, update } = useOnboarding();
  const [v, setV] = useState(draft.target_weight_kg?.toString() || "");

  const save = () => {
    update({ target_weight_kg: v ? parseFloat(v) : undefined });
    router.push("/onboarding/waist");
  };

  return (
    <OnboardingScaffold
      step={7}
      total={10}
      title="Hedef kilon var mı?"
      subtitle="Opsiyonel — şimdilik atlayabilirsin."
      onNext={save}
      secondary={{ label: "Şimdilik atla", onPress: () => router.push("/onboarding/waist") }}
    >
      <View style={{ marginTop: 8 }}>
        <Text style={styles.label}>Hedef kilo</Text>
        <View style={styles.row}>
          <TextInput
            testID="target-weight-input"
            style={styles.input}
            value={v}
            onChangeText={(t) => setV(t.replace(/[^0-9.]/g, ""))}
            keyboardType="numeric"
            placeholder="65"
            placeholderTextColor={COLORS.textMuted}
            autoFocus
          />
          <Text style={styles.unit}>kg</Text>
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
