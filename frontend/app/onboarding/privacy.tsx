// Step 7: Privacy + KVKK consent
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { OnboardingScaffold } from "@/src/components/OnboardingScaffold";
import { useOnboarding } from "@/src/onboarding-context";
import { useAuth } from "@/src/auth-context";
import { COLORS, RADIUS } from "@/src/theme";

const ITEMS = [
  { id: "terms", label: "Kullanım Koşulları'nı okudum ve kabul ediyorum.", required: true },
  { id: "privacy", label: "Gizlilik Politikası'nı okudum ve kabul ediyorum.", required: true },
  { id: "kvkk", label: "KVKK Aydınlatma Metni'ni kabul ediyorum.", required: true },
  { id: "notif", label: "Bildirim göndermenize izin veriyorum (opsiyonel).", required: false },
];

export default function PrivacyStep() {
  const router = useRouter();
  const { draft, reset } = useOnboarding();
  const { setProfile, setTheme } = useAuth();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const allRequired = ITEMS.filter((i) => i.required).every((i) => checked[i.id]);

  const submit = async () => {
    if (!allRequired) return;
    setBusy(true);
    try {
      await setProfile({
        name: draft.name || "",
        age: draft.age,
        sex: draft.sex,
        height_cm: draft.height_cm,
        weight_kg: draft.weight_kg,
        target_weight_kg: draft.target_weight_kg,
        waist_cm: draft.waist_cm,
        goal_primary: draft.goal_primary || "takip",
        goal_secondary: draft.goal_secondary || [],
        // Activity not collected at onboarding; calorie base uses fixed 1.20.
        daily_activity_level: "",
        sports_frequency: "yok",
        sports_types: [],
        selected_theme: draft.selected_theme || "sakin",
      });
      if (draft.selected_theme) await setTheme(draft.selected_theme);
      reset();
      router.replace("/onboarding/plan-result");
    } catch (e) {
      setBusy(false);
    }
  };

  return (
    <OnboardingScaffold
      step={10}
      total={10}
      title="Verilerin güvende"
      subtitle="Beslenme, aktivite ve uygulama kullanım verilerin yalnızca takip deneyimini oluşturmak için kullanılır."
      onNext={submit}
      nextLabel="Planımı oluştur"
      nextDisabled={!allRequired}
      nextLoading={busy}
    >
      {ITEMS.map((i) => {
        const on = !!checked[i.id];
        return (
          <TouchableOpacity
            key={i.id}
            testID={`privacy-${i.id}`}
            activeOpacity={0.85}
            onPress={() => setChecked((c) => ({ ...c, [i.id]: !c[i.id] }))}
            style={[styles.row, on && styles.rowOn]}
          >
            <View style={[styles.box, on && styles.boxOn]}>
              {on && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Text style={styles.text}>
              {i.label}
              {i.required && <Text style={{ color: COLORS.danger }}> *</Text>}
            </Text>
          </TouchableOpacity>
        );
      })}
      <Text style={styles.notice}>
        BESLENCE AI tavsiye, tanı veya tedavi sunmaz. Veriler şifreli olarak saklanır. Hesabını dilediğin zaman silebilirsin.
      </Text>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.white, padding: 14, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 10,
  },
  rowOn: { borderColor: COLORS.primary, backgroundColor: COLORS.mint },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  text: { flex: 1, color: COLORS.textMain, fontSize: 13, lineHeight: 20 },
  notice: { fontSize: 11, color: COLORS.textMuted, textAlign: "center", marginTop: 12, lineHeight: 18 },
});
