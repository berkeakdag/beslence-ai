// Step 3: Age
import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingScaffold } from "@/src/components/OnboardingScaffold";
import { useOnboarding } from "@/src/onboarding-context";
import { COLORS, RADIUS } from "@/src/theme";

export default function AgeStep() {
  const router = useRouter();
  const { draft, update } = useOnboarding();
  const [age, setAge] = useState(draft.age?.toString() || "");

  const valid = !!age && parseInt(age) >= 10 && parseInt(age) <= 100;

  return (
    <OnboardingScaffold
      step={3}
      total={10}
      title="Yaşın kaç?"
      subtitle="Kalori hesabı için yaş bilgine ihtiyacımız var."
      nextDisabled={!valid}
      onNext={() => {
        update({ age: parseInt(age) });
        router.push("/onboarding/sex");
      }}
    >
      <View style={{ marginTop: 8 }}>
        <Text style={styles.label}>Yaşın</Text>
        <TextInput
          testID="age-input"
          style={styles.input}
          value={age}
          onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          placeholder="30"
          placeholderTextColor={COLORS.textMuted}
          autoFocus
        />
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: COLORS.textMuted, fontWeight: "700", marginBottom: 6, letterSpacing: 0.5 },
  input: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 22,
    fontWeight: "700", color: COLORS.textMain, borderWidth: 1, borderColor: COLORS.border,
  },
});
