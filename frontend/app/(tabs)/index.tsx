// Dashboard — theme-aware (Sakin light vs Sportif dark).
// Shows today's exact-value plan progress + water glass + timeline preview.
// All entry actions route to the AI Assistant (chatbot).
import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/src/auth-context";
import { RADIUS, SHADOW, SPACING, getThemed } from "@/src/theme";
import { api } from "@/src/api";
import { TimelineEntry } from "@/src/components/TimelineBubble";
import { TimelineGrid } from "@/src/components/TimelineGrid";
import { WaterGlass } from "@/src/components/WaterGlass";
import { scoreColor } from "@/src/utils/score";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const mid = (a: number, b: number) => Math.round((a + b) / 2);

export default function Dashboard() {
  const router = useRouter();
  const { profile, plan, theme, isPro } = useAuth();
  const t = getThemed(theme);
  const s = useMemo(() => makeStyles(t), [t]);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const date = todayStr();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, sum] = await Promise.all([api.listEntries(date), api.dailySummary(date)]);
      setEntries(e.entries || []);
      setSummary(sum);
    } catch {}
    setLoading(false);
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const consumedMid = summary ? mid(summary.calories.min, summary.calories.max) : 0;
  const consumedDelta = summary ? Math.round((summary.calories.max - summary.calories.min) / 2) : 0;
  const baseMin = plan?.goal_calories_min || 0;
  const baseMax = plan?.goal_calories_max || 0;
  const burnMin = summary?.activity_burn?.min || 0;
  const burnMax = summary?.activity_burn?.max || 0;
  const adjMin = baseMin + burnMin;
  const adjMax = baseMax + burnMax;
  const targetMid = mid(adjMin, adjMax);
  const targetDelta = Math.round((adjMax - adjMin) / 2);
  const remaining = Math.max(0, targetMid - consumedMid);
  const pct = targetMid ? Math.min(1, consumedMid / targetMid) : 0;
  const hasBurn = burnMin > 0 || burnMax > 0;

  const openAssistant = useCallback((seed?: string) => {
    if (!isPro) {
      router.push("/paywall");
      return;
    }
    router.push(seed
      ? { pathname: "/(tabs)/chatbot", params: { seed } }
      : "/(tabs)/chatbot");
  }, [router, isPro]);

  const scrollRef = useRef<ScrollView | null>(null);
  const gridYRef = useRef<number>(0);
  const jumpToNow = useCallback(() => {
    const d = new Date();
    const nowMin = d.getHours() * 60 + d.getMinutes();
    const HOUR_H = 64;
    const y = gridYRef.current + (nowMin / 60) * HOUR_H - 260;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
  }, []);

  // Water totals for the glass
  const waterMl = summary?.water_ml || 0;
  const waterTargetMl = Math.round(((plan?.water_liter_max || plan?.water_liter_min || 2.5) as number) * 1000);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.accentBrand} />}
      >
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.greet}>Merhaba{profile?.name ? `, ${profile.name}` : ""}</Text>
            <Text style={s.dateText}>{prettyDate(date)}</Text>
          </View>
          <TouchableOpacity testID="open-profile-button" style={s.avatarBtn} onPress={() => router.push("/(tabs)/profile")}>
            <Ionicons name="person-circle-outline" size={36} color={t.accentBrand} />
          </TouchableOpacity>
        </View>

        {/* Hero: kalori (tek kesin sayı) */}
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>Bugünkü kalori hedefin</Text>
          <View style={s.heroValueRow}>
            <Text style={s.heroValue}>{plan ? targetMid : "—"}</Text>
            <Text style={s.heroUnit}> kcal</Text>
          </View>
          {plan && targetDelta > 0 && (
            <Text style={s.heroDelta}>± {targetDelta}</Text>
          )}
          {hasBurn && (
            <Text style={s.burnNote} testID="burn-note">
              Baz {mid(baseMin, baseMax)} + aktivite {mid(burnMin, burnMax)} kcal
            </Text>
          )}
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${pct * 100}%` }]} />
          </View>
          <View style={s.heroStatsRow}>
            <StatItem theme={t} label="Alınan" value={`${consumedMid}`} unit="kcal" delta={consumedDelta ? `± ${consumedDelta}` : ""} />
            <StatItem theme={t} label="Kalan" value={`${remaining}`} unit="kcal" />
            <StatItem theme={t} label="Kayıt" value={`${summary?.entry_count || 0}`} unit="" />
          </View>
        </View>

        {/* Su bardağı */}
        <View style={s.waterCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.waterLabel}>Bugünkü su</Text>
            <View style={s.waterValueRow}>
              <Text style={s.waterValue}>{(waterMl / 1000).toFixed(1)}</Text>
              <Text style={s.waterUnit}> L</Text>
            </View>
            <Text style={s.waterTarget}>hedef {(waterTargetMl / 1000).toFixed(1)} L</Text>
            <TouchableOpacity
              testID="dash-add-water"
              onPress={() => openAssistant("1 bardak su ekle")}
              style={s.waterAddBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color={t.textInverse} />
              <Text style={[s.waterAddText, { color: t.textInverse }]}>Bardak ekle</Text>
            </TouchableOpacity>
          </View>
          <WaterGlass
            currentMl={waterMl}
            targetMl={waterTargetMl}
            accent={t.accentWater}
            surface={t.surface}
            border={t.border}
            textMuted={t.textMuted}
          />
        </View>

        {/* Makrolar — kesin değerler + % ilerleme */}
        <View style={s.macrosRow}>
          <MacroPill theme={t} color={t.accentWorkout} label="Protein" value={mid(summary?.protein_g?.min || 0, summary?.protein_g?.max || 0)} target={mid(plan?.protein_g_min || 0, plan?.protein_g_max || 0) + (summary?.macro_bonus?.protein_g || 0)} unit="g" />
          <MacroPill theme={t} color={t.accentWorkout} label="Karb" value={mid(summary?.carbohydrate_g?.min || 0, summary?.carbohydrate_g?.max || 0)} target={mid(plan?.carbohydrate_g_min || 0, plan?.carbohydrate_g_max || 0) + (summary?.macro_bonus?.carbohydrate_g || 0)} unit="g" />
          <MacroPill theme={t} color={t.accentAlert}   label="Yağ" value={mid(summary?.fat_g?.min || 0, summary?.fat_g?.max || 0)} target={mid(plan?.fat_g_min || 0, plan?.fat_g_max || 0) + (summary?.macro_bonus?.fat_g || 0)} unit="g" />
        </View>
        <View style={s.macrosRow}>
          <MacroPill theme={t} color={t.accentBrand} label="Lif" value={mid(summary?.fiber_g?.min || 0, summary?.fiber_g?.max || 0)} target={mid(plan?.fiber_g_target_min || 0, plan?.fiber_g_target_max || 0)} unit="g" />
          <MacroPill theme={t} color={t.accentWorkout} label="Aktivite" value={summary?.activity_minutes || 0} target={0} unit="dk" />
          <MacroPill theme={t} color={t.accentBrand} label="Kayıt" value={summary?.entry_count || 0} target={0} unit="" />
        </View>

        {/* Hızlı chip'ler asistan sohbetine taşındı — burada gösterilmez. */}

        {/* Asistan info kartı */}
        <TouchableOpacity
          testID="dash-open-assistant"
          onPress={() => openAssistant()}
          style={s.assistantCta}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={[s.assistantCtaTitle, { color: t.textInverse }]}>Kayıt eklemek için asistan</Text>
            <Text style={[s.assistantCtaSub, { color: t.textInverse }]}>Besin, aktivite, içtiğin su / yaz veya fotoğraf çek!</Text>
          </View>
          <View style={s.assistantCtaPlus}>
            <MaterialCommunityIcons name="robot" size={26} color={t.textInverse} />
          </View>
        </TouchableOpacity>

        {/* Timeline */}
        <View style={s.timelineHeader}>
          <Text style={s.sectionTitle}>Bugünkü çizelgen</Text>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TouchableOpacity testID="dash-jump-now" onPress={jumpToNow} style={s.jumpNowBtn} activeOpacity={0.8}>
              <View style={s.jumpNowDot} />
              <Text style={s.jumpNowText}>Şimdi</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="see-all-timeline" onPress={() => router.push("/(tabs)/calendar")}>
              <Text style={s.seeAll}>Tümünü gör</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.timelineWrap}>
          {entries.length === 0 ? (
            <View style={s.emptyBox} testID="timeline-empty">
              <Ionicons name="leaf-outline" size={36} color={t.accentBrand} />
              <Text style={s.emptyTitle}>Henüz kayıt yok</Text>
              <Text style={s.emptySub}>Kayıt eklemek için Asistanı aç.</Text>
              <TouchableOpacity testID="empty-add-btn" style={[s.emptyCta, { backgroundColor: t.accentBrand }]} onPress={() => openAssistant()}>
                <MaterialCommunityIcons name="robot" size={18} color={t.textInverse} />
                <Text style={[s.emptyCtaText, { color: t.textInverse }]}>Asistanı aç</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={s.gridWrap}
              testID="dashboard-grid-wrap"
              onLayout={(ev) => { gridYRef.current = ev.nativeEvent.layout.y; }}
            >
              <TimelineGrid
                entries={entries}
                dateStr={date}
                sport={t.isSport}
                onDelete={async (e) => {
                  try { await api.deleteEntry(e.id); } catch {}
                  load();
                }}
                onEdited={() => load()}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const StatItem: React.FC<{ theme: any; label: string; value: string; unit: string; delta?: string }> = ({ theme, label, value, unit, delta }) => (
  <View style={{ flex: 1 }}>
    <Text style={{ fontSize: 10, color: theme.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</Text>
    <Text style={{ fontSize: 15, color: theme.textMain, fontWeight: "800", marginTop: 4 }}>
      {value}<Text style={{ fontSize: 11, fontWeight: "600", color: theme.textMuted }}>{unit ? ` ${unit}` : ""}</Text>
    </Text>
    {!!delta && <Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>{delta}</Text>}
  </View>
);

const MacroPill: React.FC<{ theme: any; color: string; label: string; value: number; target: number; unit: string }> = ({ theme, color, label, value, target, unit }) => {
  const pct = target > 0 ? Math.min(999, Math.round((value / target) * 100)) : 0;
  const complete = target > 0 && pct >= 100;
  const showPct = target > 0;
  const NEON = "#00E676";
  const pctBg = complete ? NEON : NEON + "40"; // #00E67640 ≈ soluk neon
  const pctText = complete ? "#0B2620" : theme.textMain;
  return (
    <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.border }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: target > 0 ? scoreColor(value, target) : color, shadowColor: target > 0 ? scoreColor(value, target) : color, shadowOpacity: 0.6, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
        <View style={{ flex: 1 }} />
        {showPct && (
          <View style={{ backgroundColor: pctBg, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
            <Text style={{ fontSize: 9, color: pctText, fontWeight: "900" }}>%{pct}</Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: "700", marginTop: 6 }}>{label}</Text>
      <Text style={{ fontSize: 16, color: theme.textMain, fontWeight: "900", marginTop: 1, letterSpacing: -0.3 }}>
        {value}<Text style={{ fontSize: 10, fontWeight: "600", color: theme.textMuted }}>{unit ? ` ${unit}` : ""}</Text>
      </Text>
      {target > 0 && <Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>hedef {target} {unit}</Text>}
    </View>
  );
};

const prettyDate = (s: string) => {
  const d = new Date(s + "T00:00:00");
  const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const days = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
};

const makeStyles = (t: ReturnType<typeof getThemed>) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  greet: { fontSize: 22, fontWeight: "800", color: t.textMain },
  dateText: { fontSize: 13, color: t.textMuted, marginTop: 2 },
  avatarBtn: { padding: 4 },

  heroCard: {
    borderRadius: RADIUS.xl,
    padding: 22,
    marginBottom: 12,
    backgroundColor: t.surface,
    borderWidth: t.isSport ? 1 : 0,
    borderColor: t.border,
    ...(!t.isSport ? SHADOW.card : {}),
  },
  heroLabel: { fontSize: 11, color: t.textMuted, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  heroValueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
  heroValue: { fontSize: 40, fontWeight: "900", color: t.textMain, letterSpacing: -0.5 },
  heroUnit: { fontSize: 18, fontWeight: "600", color: t.textMuted },
  heroDelta: { fontSize: 11, color: t.textMuted, marginTop: -2, fontWeight: "600" },
  burnNote: { fontSize: 11, color: t.textMuted, marginTop: 6, fontWeight: "600" },
  progressTrack: { height: 8, backgroundColor: t.border, borderRadius: 8, marginTop: 14, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: t.accentBrand, borderRadius: 8 },
  heroStatsRow: { flexDirection: "row", marginTop: 14 },

  // Water card
  waterCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.surface,
    borderRadius: RADIUS.xl,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: t.border,
    gap: 14,
  },
  waterLabel: { fontSize: 11, color: t.textMuted, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  waterValueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4 },
  waterValue: { fontSize: 32, fontWeight: "900", color: t.textMain, letterSpacing: -0.5 },
  waterUnit: { fontSize: 16, fontWeight: "600", color: t.textMuted },
  waterTarget: { fontSize: 11, color: t.textMuted, marginTop: -2, fontWeight: "600" },
  waterAddBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: t.accentWater, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, marginTop: 10 },
  waterAddText: { fontSize: 12, fontWeight: "800" },

  macrosRow: { flexDirection: "row", gap: 8, marginBottom: 8 },

  // Quick chips row (Su/Besin/Yüzme/Kahve)
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, marginBottom: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, backgroundColor: t.surface },
  chipText: { fontSize: 12, fontWeight: "800" },

  assistantCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: t.accentBrand,
    marginTop: 6,
    marginBottom: 20,
    shadowColor: t.accentBrand,
    shadowOpacity: t.isSport ? 0.5 : 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  assistantCtaIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.15)", alignItems: "center", justifyContent: "center" },
  assistantCtaTitle: { fontSize: 14, fontWeight: "900" },
  assistantCtaSub: { fontSize: 11, fontWeight: "600", opacity: 0.85, marginTop: 2 },
  assistantCtaPlus: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.2)", alignItems: "center", justifyContent: "center" },

  timelineHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: t.textMain },
  seeAll: { color: t.accentBrand, fontWeight: "700", fontSize: 13 },
  timelineWrap: { },

  emptyBox: { backgroundColor: t.surface, padding: 24, borderRadius: RADIUS.lg, alignItems: "center", borderWidth: 1, borderColor: t.border },
  emptyTitle: { marginTop: 10, fontWeight: "800", color: t.textMain, fontSize: 16 },
  emptySub: { color: t.textMuted, textAlign: "center", marginTop: 6, fontSize: 13, lineHeight: 20, maxWidth: 280 },
  emptyCta: { flexDirection: "row", gap: 6, marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  emptyCtaText: { fontWeight: "800" },

  gridWrap: {
    backgroundColor: t.surface,
    borderRadius: RADIUS.lg,
    padding: 8,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: t.border,
  },
  jumpNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: t.accentBrand,
  },
  jumpNowDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: t.textInverse },
  jumpNowText: { color: t.textInverse, fontWeight: "800", fontSize: 11 },
});
