// Profile screen — user info, theme switch, subscription, weekly summary, logout, delete account.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Platform, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth-context";
import { RADIUS, SPACING, getThemed } from "@/src/theme";
import { api } from "@/src/api";
import { manageSubscription } from "@/src/revenuecat";
import { PrimaryButton } from "@/src/components/PrimaryButton";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, plan, theme, setTheme, logout, isPro } = useAuth();
  const t = getThemed(theme);
  const styles = useMemo(() => makeStyles(t), [t]);
  const [weekly, setWeekly] = useState<any>(null);
  const [notifOn, setNotifOn] = useState<boolean>(profile?.notifications_enabled !== false);

  useEffect(() => { setNotifOn(profile?.notifications_enabled !== false); }, [profile?.notifications_enabled]);

  const toggleNotif = useCallback(async (v: boolean) => {
    setNotifOn(v);
    try { await api.setNotificationsPref(v); } catch { setNotifOn(!v); }
  }, []);

  const loadWeekly = useCallback(async () => {
    try {
      const w = await api.weeklySummary(todayStr());
      setWeekly(w);
    } catch {}
  }, []);
  useEffect(() => { loadWeekly(); }, [loadWeekly]);

  const confirmDeleteAccount = () => {
    const doDelete = async () => {
      try { await api.deleteAccount(); } catch {}
      await logout(); // clears session + in-memory auth state (user/profile/plan/isPro)
      router.replace("/welcome");
    };
    const msg = "Hesabın ve tüm verilerin (kayıtlar, plan, profil) kalıcı olarak silinecek. Bu işlem geri alınamaz. Emin misin?";
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(msg)) doDelete();
      return;
    }
    Alert.alert("Hesabı sil", msg, [
      { text: "Vazgeç", style: "cancel" },
      { text: "Hesabımı Sil", style: "destructive", onPress: doDelete },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* User header */}
        <View style={styles.userCard}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="person" size={28} color={t.accentBrand} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name || profile?.name || "Kullanıcı"}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.goal}>{labelGoal(profile?.goal_primary)}</Text>
          </View>
        </View>

        {/* Subscription */}
        <Text style={styles.sectionTitle}>Abonelik</Text>
        <TouchableOpacity
          testID="profile-subscription"
          style={[styles.subCard, isPro && { borderColor: t.accentBrand }]}
          onPress={() => { if (isPro) { manageSubscription(); } else { router.push("/paywall"); } }}
          activeOpacity={0.85}
        >
          <View style={[styles.subIcon, { backgroundColor: isPro ? t.accentSoft : t.surfaceAlt }]}>
            <Image source={require("@/assets/images/beslence-b-logo-v2.png")} style={{ width: 30, height: 30 }} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.subTitle}>{isPro ? "BESLENCE AI Pro" : "Ücretsiz Sürüm"}</Text>
            <Text style={styles.subDesc}>
              {isPro
                ? "Tüm özellikler açık. Aboneliği yönetmek için dokun."
                : "Sadece manuel kayıt. Asistan ve Rapor için Pro'ya geç — 3 gün ücretsiz!"}
            </Text>
          </View>
          {!isPro && <Ionicons name="chevron-forward" size={18} color={t.accentBrand} />}
          {isPro && <Ionicons name="checkmark-circle" size={22} color={t.accentBrand} />}
        </TouchableOpacity>

        {/* Theme switch */}
        <Text style={styles.sectionTitle}>Tema</Text>
        <View style={styles.themeRow}>
          <TouchableOpacity
            testID="theme-switch-sakin"
            onPress={() => setTheme("sakin")}
            style={[styles.themeCard, theme === "sakin" && styles.themeCardOn]}
          >
            <Ionicons name="leaf-outline" size={22} color={theme === "sakin" ? t.textInverse : t.accentBrand} />
            <Text style={[styles.themeName, theme === "sakin" && { color: t.textInverse }]}>Sakin Mod</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="theme-switch-sportif"
            onPress={() => setTheme("sportif")}
            style={[styles.themeCard, theme === "sportif" && styles.themeCardOn]}
          >
            <Ionicons name="barbell-outline" size={22} color={theme === "sportif" ? t.textInverse : t.accentBrand} />
            <Text style={[styles.themeName, theme === "sportif" && { color: t.textInverse }]}>Sportif Mod</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <Text style={styles.sectionTitle}>Bildirimler</Text>
        <View style={styles.notifCard}>
          <View style={[styles.subIcon, { backgroundColor: notifOn ? t.accentSoft : t.surfaceAlt }]}>
            <Ionicons name="notifications-outline" size={22} color={notifOn ? t.accentBrand : t.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.subTitle}>Akıllı bildirimler</Text>
            <Text style={styles.subDesc}>Öğün & su hatırlatmaları, günlük rapor ve aktivite güncellemeleri.</Text>
          </View>
          <Switch
            testID="notif-toggle"
            value={notifOn}
            onValueChange={toggleNotif}
            trackColor={{ false: t.border, true: t.accentBrand }}
            thumbColor={t.textInverse}
          />
        </View>

        {/* Plan summary */}
        <Text style={styles.sectionTitle}>Plan</Text>
        <View style={styles.planCard}>
          <PlanRow styles={styles} label="Bazal metabolizma" value={`${plan?.bmr_kcal ?? "-"} kcal`} />
          <PlanRow styles={styles} label="Bakım kalorisi" value={`${plan?.maintenance_calories ?? "-"} kcal`} />
          <PlanRow styles={styles} label="Günlük hedef" value={`${plan?.goal_calories_min ?? "-"}–${plan?.goal_calories_max ?? "-"} kcal`} />
          <PlanRow styles={styles} label="Protein" value={`${plan?.protein_g_min ?? "-"}-${plan?.protein_g_max ?? "-"} g`} />
          <PlanRow styles={styles} label="Karbonhidrat" value={`${plan?.carbohydrate_g_min ?? "-"}-${plan?.carbohydrate_g_max ?? "-"} g`} />
          <PlanRow styles={styles} label="Yağ" value={`${plan?.fat_g_min ?? "-"}-${plan?.fat_g_max ?? "-"} g`} />
          <PlanRow styles={styles} label="Lif" value={`${plan?.fiber_g_target_min ?? "-"}-${plan?.fiber_g_target_max ?? "-"} g`} />
          <PlanRow styles={styles} label="Su" value={`${plan?.water_liter_min ?? "-"}-${plan?.water_liter_max ?? "-"} L`} />
        </View>

        {/* Weekly summary */}
        <Text style={styles.sectionTitle}>Haftalık Özet</Text>
        {weekly && (
          <View style={styles.weekCard}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekHeaderText}>{weekly.start_date} → {weekly.end_date}</Text>
            </View>
            <View style={styles.weekStats}>
              <Stat styles={styles} label="Ort. Kalori" value={`${weekly.avg_calories.min}-${weekly.avg_calories.max}`} />
              <Stat styles={styles} label="Aktivite" value={`${weekly.total_activity_minutes} dk`} />
            </View>
            <View style={styles.barRow}>
              {weekly.days?.map((d: any) => {
                const cal = (d.calories_min + d.calories_max) / 2;
                const max = Math.max(1, ...weekly.days.map((x: any) => (x.calories_min + x.calories_max) / 2));
                const h = Math.max(4, (cal / max) * 60);
                return (
                  <View key={d.date} style={styles.barCol}>
                    <View style={[styles.bar, { height: h, backgroundColor: t.accentBrand }]} />
                    <Text style={styles.barLabel}>{d.date.slice(-2)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.actionsArea}>
          <PrimaryButton title="Profili güncelle" variant="secondary" onPress={() => router.push("/onboarding/goal")} testID="edit-profile-btn" />
          <View style={{ height: 12 }} />
          <PrimaryButton
            title="Çıkış yap"
            variant="ghost"
            textColor={t.textMain}
            borderColor={t.border}
            onPress={async () => { await logout(); router.replace("/welcome"); }}
            testID="logout-btn"
          />
          <TouchableOpacity testID="delete-account-btn" style={styles.deleteBtn} onPress={confirmDeleteAccount}>
            <Ionicons name="trash-outline" size={16} color="#E5484D" />
            <Text style={styles.deleteBtnText}>Hesabı sil</Text>
          </TouchableOpacity>
          <View style={styles.legalLinks}>
            <TouchableOpacity testID="profile-terms" onPress={() => router.push("/legal/terms")}>
              <Text style={[styles.legalLinkText, { color: t.accentBrand }]}>Kullanım Şartları</Text>
            </TouchableOpacity>
            <Text style={{ color: t.textMuted }}>·</Text>
            <TouchableOpacity testID="profile-privacy" onPress={() => router.push("/legal/privacy")}>
              <Text style={[styles.legalLinkText, { color: t.accentBrand }]}>Gizlilik Politikası</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Stat: React.FC<{ styles: any; label: string; value: string }> = ({ styles, label, value }) => (
  <View style={styles.stat}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);
const PlanRow: React.FC<{ styles: any; label: string; value: string }> = ({ styles, label, value }) => (
  <View style={styles.planRow}>
    <Text style={styles.planLabel}>{label}</Text>
    <Text style={styles.planValue}>{value}</Text>
  </View>
);

const labelGoal = (g?: string) => {
  switch (g) {
    case "kilo_vermek": return "Hedef: Kilo vermek";
    case "yag_yakmak": return "Hedef: Yağ yakmak";
    case "kas_kazanmak": return "Hedef: Kas kazanmak";
    case "kilo_korumak": return "Hedef: Kilo korumak";
    case "performans": return "Hedef: Performans";
    case "saglikli_beslenmek": return "Hedef: Sağlıklı beslenmek";
    default: return "Hedef: Takip";
  }
};
const makeStyles = (t: ReturnType<typeof getThemed>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  scroll: { padding: SPACING.lg, paddingBottom: 60 },
  userCard: { flexDirection: "row", gap: 16, alignItems: "center", backgroundColor: t.surface, padding: 16, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: t.border, marginBottom: 18 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  name: { fontSize: 18, fontWeight: "800", color: t.textMain },
  email: { fontSize: 12, color: t.textMuted, marginTop: 2 },
  goal: { marginTop: 4, fontSize: 12, color: t.accentBrand, fontWeight: "700" },
  sectionTitle: { fontSize: 13, color: t.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginTop: 6 },
  subCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: t.border, marginBottom: 18 },
  subIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  subTitle: { fontSize: 14, fontWeight: "800", color: t.textMain },
  subDesc: { fontSize: 11, color: t.textMuted, marginTop: 2, lineHeight: 16 },
  notifCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: t.border, marginBottom: 18 },
  themeRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  themeCard: { flex: 1, padding: 16, borderRadius: RADIUS.lg, backgroundColor: t.surface, alignItems: "center", borderWidth: 1, borderColor: t.border, gap: 8 },
  themeCardOn: { backgroundColor: t.accentBrand, borderColor: t.accentBrand },
  themeName: { fontWeight: "700", color: t.textMain },
  planCard: { backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: t.border },
  planRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border },
  planLabel: { color: t.textMuted, fontSize: 13 },
  planValue: { color: t.textMain, fontWeight: "700", fontSize: 13 },
  weekCard: { backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: t.border },
  weekHeader: { marginBottom: 10 },
  weekHeaderText: { color: t.textMuted, fontSize: 12, fontWeight: "700" },
  weekStats: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 16, gap: 12 },
  stat: { },
  statLabel: { fontSize: 10, color: t.textMuted, fontWeight: "700", textTransform: "uppercase" },
  statValue: { fontSize: 14, fontWeight: "800", color: t.textMain, marginTop: 4 },
  barRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 80, paddingBottom: 4 },
  barCol: { alignItems: "center", flex: 1 },
  bar: { width: 12, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel: { fontSize: 10, color: t.textMuted, marginTop: 4 },
  actionsArea: { marginTop: 16 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: "#E5484D55" },
  deleteBtnText: { color: "#E5484D", fontWeight: "800", fontSize: 13 },
  legalLinks: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 16 },
  legalLinkText: { fontSize: 12, fontWeight: "800" },
});
