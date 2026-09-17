// Daily Report — informational-only summary of what was eaten.
// Backend: /api/report/daily?date=YYYY-MM-DD returns totals + warning array.
// This screen shows today's report by default and allows browsing prior days.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/src/auth-context";
import { RADIUS, SPACING, getThemed } from "@/src/theme";
import { api } from "@/src/api";
import { istanbulTodayStr } from "@/src/utils/time";
import { MacroRing } from "@/src/components/MacroRing";
import { WeightCard } from "@/src/components/WeightCard";
import { scoreColor, scoreColorInverse } from "@/src/utils/score";

const DAY_LABEL_TR = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"];
  const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
};

// Build the last 7 days list (today first, leftmost) using Istanbul-anchored today.
// NOTE: no toISOString() here — it converts to UTC and can shift the date by a day.
const last7Days = (todayStr: string) => {
  const [y, m, d] = todayStr.split("-").map((x) => parseInt(x, 10));
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(y, (m || 1) - 1, (d || 1) - i);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  });
};

export default function ReportScreen() {
  const { theme, plan, profile, isPro, subLoading } = useAuth();
  const router = useRouter();
  const t = getThemed(theme);
  const s = useMemo(() => makeStyles(t), [t]);

  // Report is a Pro feature.
  useEffect(() => {
    if (!subLoading && !isPro) {
      router.replace("/paywall");
    }
  }, [isPro, subLoading, router]);

  const [dateStr, setDateStr] = useState<string>(istanbulTodayStr());
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.dailyReport(dateStr);
      setReport(r);
    } catch { setReport(null); }
    setLoading(false);
  }, [dateStr]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const days = last7Days(istanbulTodayStr());

  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={["top"]}>
      <View style={s.header}>
        <Image source={require("@/assets/images/beslence-b-logo-v2.png")} style={s.headerLogo} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Günlük Rapor</Text>
          <Text style={s.subtitle}>Sadece bilgilendirme — tavsiye değildir.</Text>
        </View>
      </View>

      {/* Day strip (last 7 days) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
        {days.map((d) => {
          const sel = d === dateStr;
          return (
            <TouchableOpacity
              key={d}
              testID={`report-day-${d}`}
              onPress={() => setDateStr(d)}
              style={[s.dayChip, sel && { backgroundColor: t.accentBrand, borderColor: t.accentBrand }]}
            >
              <Text style={[s.dayChipText, sel && { color: t.textInverse }]}>
                {DAY_LABEL_TR(d)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.accentBrand} />}
      >
        {!report && !loading && (
          <Text style={s.empty}>Bu güne ait veri yok.</Text>
        )}
        {report && (
          <>
            {/* 4 macro rings — each in its brand color */}
            <View style={s.ringsRow}>
              <MacroRing
                value={report.totals.calories}
                target={mid(plan?.goal_calories_min || 0, plan?.goal_calories_max || 0)}
                color="#00E676"
                label="Kalori"
                unit="kcal"
                textColor={t.textMain}
                mutedColor={t.textMuted}
                trackColor={t.isSport ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
              />
              <MacroRing
                value={report.totals.protein_g}
                target={mid(plan?.protein_g_min || 0, plan?.protein_g_max || 0) + (report.totals.macro_bonus?.protein_g || 0)}
                color="#66E0FF"
                label="Protein"
                unit="g"
                textColor={t.textMain}
                mutedColor={t.textMuted}
                trackColor={t.isSport ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
              />
            </View>
            <View style={s.ringsRow}>
              <MacroRing
                value={report.totals.carbohydrate_g}
                target={mid(plan?.carbohydrate_g_min || 0, plan?.carbohydrate_g_max || 0) + (report.totals.macro_bonus?.carbohydrate_g || 0)}
                color="#FF6D3A"
                label="Karbonhidrat"
                unit="g"
                textColor={t.textMain}
                mutedColor={t.textMuted}
                trackColor={t.isSport ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
              />
              <MacroRing
                value={report.totals.fat_g}
                target={mid(plan?.fat_g_min || 0, plan?.fat_g_max || 0) + (report.totals.macro_bonus?.fat_g || 0)}
                color="#F2E94E"
                label="Yağ"
                unit="g"
                textColor={t.textMain}
                mutedColor={t.textMuted}
                trackColor={t.isSport ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
              />
            </View>

            {(report.totals.macro_bonus?.protein_g > 0 || report.totals.macro_bonus?.carbohydrate_g > 0 || report.totals.macro_bonus?.fat_g > 0) && (
              <Text style={s.bonusNote} testID="macro-bonus-note">
                Aktiviteyle yakılan enerji makro hedeflerine eklendi: +{report.totals.macro_bonus?.protein_g || 0} g P · +{report.totals.macro_bonus?.carbohydrate_g || 0} g K · +{report.totals.macro_bonus?.fat_g || 0} g Y
              </Text>
            )}

            {/* Secondary totals with 5-tier score coloring */}
            <View style={s.totalsCard}>
              <Total theme={t} label="Su" value={`${(report.totals.water_ml / 1000).toFixed(1)}`} unit="L" color={scoreColor(report.totals.water_ml, report.totals.water_target_ml)} />
              <Total theme={t} label="Aktivite" value={`${report.totals.activity_minutes}`} unit="dk" color={t.accentWorkout} />
              <Total theme={t} label="Şeker" value={`${report.totals.sugar_g ?? 0}`} unit="g" color={scoreColorInverse(report.totals.sugar_g ?? 0, 25)} />
              <Total theme={t} label="Lif" value={`${report.totals.fiber_g}`} unit="g" color={scoreColor(report.totals.fiber_g, mid(plan?.fiber_g_target_min || 0, plan?.fiber_g_target_max || 0))} />
            </View>

            {/* Weight tracking */}
            <WeightCard theme={t} date={dateStr} targetWeight={profile?.target_weight_kg} />

            {/* Meal list — color-coded */}
            {report.meals?.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Ne yedin</Text>
                {report.meals.map((m: any) => {
                  const color =
                    m.entry_type === "water" ? t.accentWater :
                    m.entry_type === "activity" ? t.accentWorkout :
                    t.accentBrand;
                  return (
                    <View key={m.id} style={s.mealRow}>
                      <Text style={[s.mealTime, { color }]}>{m.time}</Text>
                      <Text style={[s.mealTitle, { color: t.textMain }]} numberOfLines={1}>{m.title}</Text>
                      {m.calories > 0 && (
                        <Text style={[s.mealMetric, { color }]}>{m.calories} kcal</Text>
                      )}
                      {m.water_ml != null && (
                        <Text style={[s.mealMetric, { color }]}>{m.water_ml} ml</Text>
                      )}
                      {m.duration_minutes != null && m.entry_type === "activity" && (
                        <Text style={[s.mealMetric, { color }]}>{m.duration_minutes} dk</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Disclaimer */}
            <Text style={s.disclaimer}>{report.disclaimer}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const mid = (a: number, b: number) => Math.round((a + b) / 2);

const Total: React.FC<{ theme: any; label: string; value: string; unit: string; delta?: string; color?: string }> = ({ theme, label, value, unit, delta, color }) => (
  <View style={{ flex: 1, minWidth: "30%", paddingVertical: 6 }}>
    <Text style={{ fontSize: 9, color: theme.textMuted, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</Text>
    <Text style={{ fontSize: 20, color: color || theme.textMain, fontWeight: "900", marginTop: 3, letterSpacing: -0.5 }}>
      {value}<Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: "700" }}>{unit ? ` ${unit}` : ""}</Text>
    </Text>
    {!!delta && <Text style={{ fontSize: 9, color: theme.textMuted }}>{delta}</Text>}
  </View>
);

const makeStyles = (t: ReturnType<typeof getThemed>) => StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingTop: 8, paddingBottom: 6, flexDirection: "row", alignItems: "center", gap: 12 },
  headerLogo: { width: 40, height: 40 },
  title: { fontSize: 22, fontWeight: "800", color: t.textMain },
  subtitle: { color: t.textMuted, marginTop: 2, fontSize: 12 },
  strip: { paddingHorizontal: SPACING.lg, paddingVertical: 10, gap: 8, alignItems: "center" },
  dayChip: { height: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, flexShrink: 0, alignItems: "center", justifyContent: "center" },
  dayChipText: { color: t.textMain, fontSize: 15, lineHeight: 20, fontWeight: "800", includeFontPadding: false, textAlignVertical: "center" },
  scroll: { padding: SPACING.lg, paddingTop: 4, paddingBottom: 60 },
  empty: { textAlign: "center", color: t.textMuted, marginTop: 40 },
  bonusNote: { fontSize: 11, color: t.textMuted, fontWeight: "700", lineHeight: 16, marginBottom: 10, paddingHorizontal: 4 },

  totalsCard: { flexDirection: "row", flexWrap: "wrap", gap: 8, backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: t.border, marginBottom: 14 },

  ringsRow: { flexDirection: "row", justifyContent: "space-around", gap: 12, backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: t.border, marginBottom: 10 },

  section: { marginTop: 6, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: t.textMain, marginBottom: 8 },

  mealRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border },
  mealTime: { fontSize: 11, fontWeight: "800", width: 42 },
  mealTitle: { flex: 1, fontSize: 13, fontWeight: "700" },
  mealMetric: { fontSize: 11, fontWeight: "800" },

  disclaimer: { fontSize: 11, color: t.textMuted, lineHeight: 18, marginTop: 14, padding: 12, backgroundColor: t.surfaceAlt, borderRadius: RADIUS.md, borderLeftWidth: 3, borderLeftColor: t.accentBrand },
});
