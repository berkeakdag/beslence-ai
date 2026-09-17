// Step 5: Height
import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingScaffold } from "@/src/components/OnboardingScaffold";
import { useOnboarding } from "@/src/onboarding-context";
import { COLORS, RADIUS } from "@/src/theme";

export default function HeightStep() {
  const router = useRouter();
  const { draft, update } = useOnboarding();
  const [v, setV] = useState(draft.height_cm?.toString() || "");
  const num = parseFloat(v);
  const valid = !!v && num >= 100 && num <= 230;

  return (
    <OnboardingScaffold
      step={5}
      total={10}
      title="Boyun kaç cm?"
      subtitle="cm cinsinden gir."
      nextDisabled={!valid}
      onNext={() => {
        update({ height_cm: num });
        router.push("/onboarding/weight");
      }}
    >
      <View style={{ marginTop: 8 }}>
        <Text style={styles.label}>Boy</Text>
        <View style={styles.row}>
          <TextInput
            testID="height-input"
            style={styles.input}
            value={v}
            onChangeText={(t) => setV(t.replace(/[^0-9.]/g, ""))}
            keyboardType="numeric"
            placeholder="170"
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
