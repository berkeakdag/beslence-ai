// Step 2: Name (Sana nasıl hitap edelim?)
import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingScaffold } from "@/src/components/OnboardingScaffold";
import { useOnboarding } from "@/src/onboarding-context";
import { COLORS, RADIUS } from "@/src/theme";

export default function NameStep() {
  const router = useRouter();
  const { draft, update } = useOnboarding();
  const [name, setName] = useState(draft.name || "");

  const next = () => {
    update({ name: name.trim() });
    router.push("/onboarding/age");
  };
  return (
    <OnboardingScaffold
      step={2}
      total={10}
      title="Sana nasıl hitap edelim?"
      subtitle="Adınla seslenmek istersek diye soruyoruz."
      onNext={next}
      nextDisabled={!name.trim()}
    >
      <View style={{ marginTop: 8 }}>
        <Text style={styles.label}>Adın</Text>
        <TextInput
          testID="name-input"
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Adın"
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
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 18,
    color: COLORS.textMain, borderWidth: 1, borderColor: COLORS.border,
  },
});
