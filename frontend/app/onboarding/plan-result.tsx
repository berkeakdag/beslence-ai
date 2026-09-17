// Final result: shows initial plan from backend then routes to dashboard
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth-context";
import { COLORS, RADIUS, SHADOW, SPACING } from "@/src/theme";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { BeslenceLogo } from "@/src/components/BeslenceLogo";

export default function PlanResult() {
  const router = useRouter();
  const { plan, profile, isPro } = useAuth();
  if (!plan) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <BeslenceLogo size={100} animate showWordmark={false} />
        <Text style={styles.loading}>Planın hazırlanıyor...</Text>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        <View style={styles.heroBox}>
          <BeslenceLogo size={68} animate={false} showWordmark={false} />
          <Text style={styles.title}>İlk planın hazır</Text>
          <Text style={styles.sub}>
            Profiline göre hesaplanan başlangıç hedefleri aşağıda. İstediğin zaman profilden güncelleyebilirsin.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Günlük kalori hedefin</Text>
          <Text style={styles.heroValue}>
            {plan.goal_calories_min}–{plan.goal_calories_max}
            <Text style={styles.heroUnit}> kcal</Text>
          </Text>
          <View style={styles.subRow}>
            <SubItem label="BMR" value={`${plan.bmr_kcal} kcal`} />
            <SubItem label="Bakım" value={`${plan.maintenance_calories} kcal`} />
          </View>
        </View>

        <View style={styles.macroGrid}>
          <MacroCard color="#FF7043" label="Protein" value={`${plan.protein_g_min}-${plan.protein_g_max} g`} icon="fitness-outline" />
          <MacroCard color="#FFC107" label="Karbonhidrat" value={`${plan.carbohydrate_g_min}-${plan.carbohydrate_g_max} g`} icon="leaf-outline" />
          <MacroCard color="#FFA000" label="Yağ" value={`${plan.fat_g_min}-${plan.fat_g_max} g`} icon="water-outline" />
          <MacroCard color="#1D9E75" label="Lif" value={`${plan.fiber_g_target_min}-${plan.fiber_g_target_max} g`} icon="leaf-outline" />
          <MacroCard color="#3AB0FF" label="Su" value={`${plan.water_liter_min}-${plan.water_liter_max} L`} icon="water-outline" />
          <MacroCard color="#8D6E63" label="Tema" value={(profile?.selected_theme || "sakin").toUpperCase()} icon="color-palette-outline" />
        </View>

        <View style={{ marginTop: 8 }}>
          <PrimaryButton
            title="Ana ekrana geç"
            onPress={() => {
              router.replace("/(tabs)");
              // Trial-first paywall: right after onboarding, offer the 3-day trial once.
              if (!isPro) {
                setTimeout(() => router.push("/paywall"), 400);
              }
            }}
            testID="plan-go-dashboard"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const SubItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View>
    <Text style={styles.subItemLabel}>{label}</Text>
    <Text style={styles.subItemValue}>{value}</Text>
  </View>
);

const MacroCard: React.FC<{ color: string; label: string; value: string; icon: any }> = ({ color, label, value, icon }) => (
  <View style={[styles.macroCard, { borderTopColor: color }]}>
    <View style={[styles.macroIcon, { backgroundColor: color + "22" }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={styles.macroLabel}>{label}</Text>
    <Text style={styles.macroValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  loading: { marginTop: 24, color: COLORS.textMuted },
  heroBox: { alignItems: "center", marginTop: 16, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.textMain, marginTop: 12 },
  sub: { textAlign: "center", color: COLORS.textMuted, lineHeight: 22, fontSize: 14, marginTop: 8, maxWidth: 320 },
  heroCard: {
    backgroundColor: COLORS.dark,
    borderRadius: RADIUS.xl,
    padding: 24,
    marginTop: 8,
    ...SHADOW.card,
  },
  heroLabel: { color: COLORS.mint, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "700" },
  heroValue: { color: "#fff", fontSize: 34, fontWeight: "800", marginTop: 6 },
  heroUnit: { fontSize: 18, fontWeight: "500", color: COLORS.mint },
  subRow: { flexDirection: "row", marginTop: 14, gap: 28 },
  subItemLabel: { color: "#cfe9df", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  subItemValue: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 4 },
  macroGrid: {
    marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  macroCard: {
    width: "48%",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderTopWidth: 4,
    ...SHADOW.card,
  },
  macroIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  macroLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: "700" },
  macroValue: { fontSize: 16, color: COLORS.textMain, fontWeight: "800", marginTop: 2 },
});
