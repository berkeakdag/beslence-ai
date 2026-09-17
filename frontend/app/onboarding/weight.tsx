// Step 6: Weight
import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingScaffold } from "@/src/components/OnboardingScaffold";
import { useOnboarding } from "@/src/onboarding-context";
import { COLORS, RADIUS } from "@/src/theme";

export default function WeightStep() {
  const router = useRouter();
  const { draft, update } = useOnboarding();
  const [v, setV] = useState(draft.weight_kg?.toString() || "");
  const num = parseFloat(v);
  const valid = !!v && num >= 30 && num <= 300;

  return (
    <OnboardingScaffold
      step={6}
      total={10}
      title="Kilon kaç kg?"
      subtitle="Şu anki kilonu kg cinsinden gir."
      nextDisabled={!valid}
      onNext={() => {
        update({ weight_kg: num });
        router.push("/onboarding/target-weight");
      }}
    >
      <View style={{ marginTop: 8 }}>
        <Text style={styles.label}>Kilo</Text>
        <View style={styles.row}>
          <TextInput
            testID="weight-input"
            style={styles.input}
            value={v}
            onChangeText={(t) => setV(t.replace(/[^0-9.]/g, ""))}
            keyboardType="numeric"
            placeholder="70"
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
