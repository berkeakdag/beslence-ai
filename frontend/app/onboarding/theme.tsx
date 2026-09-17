// Step 6: Theme selection - Sakin Mod / Sportif Mod
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { OnboardingScaffold } from "@/src/components/OnboardingScaffold";
import { useOnboarding } from "@/src/onboarding-context";
import { COLORS, RADIUS, SHADOW } from "@/src/theme";

export default function ThemeStep() {
  const router = useRouter();
  const { draft, update } = useOnboarding();
  const selected = draft.selected_theme || "sakin";
  return (
    <OnboardingScaffold
      step={9}
      total={10}
      title="Uygulama tarzını seç"
      subtitle="BESLENCE AI deneyimini sana en uygun modda kullanabilirsin."
      onNext={() => router.push("/onboarding/privacy")}
    >
      <TouchableOpacity
        testID="theme-sakin"
        activeOpacity={0.9}
        onPress={() => update({ selected_theme: "sakin" })}
        style={[styles.card, selected === "sakin" && styles.cardSelected]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.modeIcon, { backgroundColor: COLORS.mint }]}>
            <Ionicons name="leaf-outline" size={24} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Sakin Mod</Text>
            <Text style={styles.cardBadge}>Önerilen</Text>
          </View>
          {selected === "sakin" && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
        </View>
        <Text style={styles.cardDesc}>
          Günlük akış, öğün düzeni ve sade takip deneyimini öne çıkaran mod.
        </Text>
        <View style={styles.tagRow}>
          <Tag label="Kalori dengesi" />
          <Tag label="Su" />
          <Tag label="Lif" />
          <Tag label="Öğün çizelgesi" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        testID="theme-sportif"
        activeOpacity={0.9}
        onPress={() => update({ selected_theme: "sportif" })}
        style={[styles.card, styles.cardSport, selected === "sportif" && styles.cardSportSelected]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.modeIcon, { backgroundColor: "#16443A" }]}>
            <Ionicons name="barbell-outline" size={24} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: "#fff" }]}>Sportif Mod</Text>
            <Text style={[styles.cardBadge, { color: COLORS.mint }]}>Yüksek tempo</Text>
          </View>
          {selected === "sportif" && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
        </View>
        <Text style={[styles.cardDesc, { color: "#cfe9df" }]}>
          Antrenman, performans ve aktivite takibini daha öne çıkaran dinamik deneyim.
        </Text>
        <View style={styles.tagRow}>
          <Tag dark label="Antrenman" />
          <Tag dark label="Protein" />
          <Tag dark label="Aktivite kalorisi" />
          <Tag dark label="Planlanan sporlar" />
        </View>
      </TouchableOpacity>
    </OnboardingScaffold>
  );
}

const Tag: React.FC<{ label: string; dark?: boolean }> = ({ label, dark }) => (
  <View style={[styles.tag, dark && { backgroundColor: "#16443A", borderColor: "#16443A" }]}>
    <Text style={[styles.tagText, dark && { color: COLORS.mint }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: 14,
    ...SHADOW.card,
  },
  cardSelected: { borderColor: COLORS.primary, backgroundColor: "#F1FBF6" },
  cardSport: { backgroundColor: COLORS.dark, borderColor: COLORS.dark },
  cardSportSelected: { borderColor: COLORS.primary },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  modeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 18, fontWeight: "800", color: COLORS.textMain },
  cardBadge: { fontSize: 11, fontWeight: "700", color: COLORS.secondary, letterSpacing: 1, textTransform: "uppercase", marginTop: 2 },
  cardDesc: { fontSize: 13, color: COLORS.textMuted, lineHeight: 20, marginBottom: 12 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.paper },
  tagText: { fontSize: 11, fontWeight: "600", color: COLORS.textMain },
});
