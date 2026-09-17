// Dedicated full-screen page for a single day's timeline.
// Route: /day/[date]  (e.g. /day/2026-06-30)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/src/auth-context";
import { RADIUS, SPACING, getThemed } from "@/src/theme";
import { api } from "@/src/api";
import { TimelineGrid } from "@/src/components/TimelineGrid";
import type { TimelineEntry } from "@/src/components/TimelineBubble";

const DAYS = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
const MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

const mid = (a: number | null | undefined, b: number | null | undefined) =>
  Math.round(((a ?? 0) + (b ?? a ?? 0)) / 2);

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function DayScreen() {
  const params = useLocalSearchParams<{ date: string; highlight?: string; t?: string }>();
  const dateStr = (params.date as string) || todayStr();
  const highlightId = (params.highlight as string) || "";
  const highlightTime = (params.t as string) || "";
  const router = useRouter();
  const { theme } = useAuth();
  const t = getThemed(theme);
  const s = useMemo(() => makeStyles(t), [t]);

  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, sum] = await Promise.all([api.listEntries(dateStr), api.dailySummary(dateStr)]);
      setEntries(e.entries || []);
      setSummary(sum);
    } catch {}
    setLoading(false);
  }, [dateStr]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // When a "highlight" (entry id) is passed, auto-scroll to that entry's time
  // and (via TimelineGrid glow prop) briefly pulse the card.
  useEffect(() => {
    if (!highlightTime || entries.length === 0) return;
    const [hh, mm] = highlightTime.split(":").map((x) => parseInt(x, 10));
    if (Number.isNaN(hh)) return;
    const minsFromStart = (hh || 0) * 60 + (mm || 0);
    const HOUR_H = 64;
    const y = gridYRef.current + (minsFromStart / 60) * HOUR_H - 260;
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true }), 250);
  }, [highlightTime, entries.length]);

  const openAssistant = useCallback((seed?: string) => {
    router.push(seed
      ? { pathname: "/(tabs)/chatbot", params: { seed } }
      : "/(tabs)/chatbot");
  }, [router]);

  const scrollRef = useRef<ScrollView | null>(null);
  const gridYRef = useRef<number>(0);
  const jumpToNow = useCallback(() => {
    const d = new Date();
    const nowMin = d.getHours() * 60 + d.getMinutes();
    const HOUR_H = 64;
    const y = gridYRef.current + (nowMin / 60) * HOUR_H - 240;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
  }, []);

  // Header pretty date
  const [year, month, day] = dateStr.split("-").map((x) => parseInt(x, 10));
  const dObj = new Date(year, (month || 1) - 1, day || 1);
  const dayLabel = `${DAYS[dObj.getDay()]}, ${dObj.getDate()} ${MONTHS[dObj.getMonth()]} ${dObj.getFullYear()}`;
  const isToday = dateStr === todayStr();

  const totalCal = summary ? mid(summary.calories.min, summary.calories.max) : 0;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity testID="day-back" onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={t.textMain} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{dayLabel}</Text>
          {isToday && <Text style={[s.badge, { color: t.accentBrand }]}>Bugün</Text>}
        </View>
        {isToday && (
          <TouchableOpacity testID="day-jump-now" onPress={jumpToNow} style={s.jumpNowBtn}>
            <View style={s.jumpNowDot} />
            <Text style={s.jumpNowText}>Şimdi</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.accentBrand} />}
      >
        {/* Day stats */}
        <View style={s.statsCard}>
          <Stat theme={t} label="Kalori" value={`${totalCal}`} unit="kcal" />
          <Stat theme={t} label="Kayıt" value={`${summary?.entry_count || 0}`} unit="" />
          <Stat theme={t} label="Aktivite" value={`${summary?.activity_minutes || 0}`} unit="dk" />
          <Stat theme={t} label="Su" value={`${((summary?.water_ml || 0) / 1000).toFixed(1)}`} unit="L" />
        </View>

        {/* Timeline */}
        {entries.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="leaf-outline" size={32} color={t.accentBrand} />
            <Text style={s.emptyTitle}>Bu güne kayıt yok</Text>
            <TouchableOpacity
              testID="day-empty-assistant"
              onPress={() => openAssistant(`${dateStr} için kayıt ekle`)}
              style={[s.assistantSmall, { backgroundColor: t.accentBrand }]}
            >
              <Ionicons name="chatbubbles" size={16} color={t.textInverse} />
              <Text style={[s.assistantSmallText, { color: t.textInverse }]}>Asistanla ekle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={s.gridWrap}
            onLayout={(ev) => { gridYRef.current = ev.nativeEvent.layout.y; }}
          >
            <TimelineGrid
              entries={entries}
              dateStr={dateStr}
              sport={t.isSport}
              highlightId={highlightId}
              onDelete={async (e) => {
                try { await api.deleteEntry(e.id); } catch {}
                load();
              }}
              onEdited={() => load()}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Stat: React.FC<{ theme: any; label: string; value: string; unit: string }> = ({ theme, label, value, unit }) => (
  <View style={{ flex: 1 }}>
    <Text style={{ fontSize: 9, color: theme.textMuted, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</Text>
    <Text style={{ fontSize: 16, color: theme.textMain, fontWeight: "900", marginTop: 3 }}>
      {value}<Text style={{ fontSize: 10, color: theme.textMuted, fontWeight: "700" }}>{unit ? ` ${unit}` : ""}</Text>
    </Text>
  </View>
);

const makeStyles = (t: ReturnType<typeof getThemed>) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: SPACING.lg, paddingTop: 4, paddingBottom: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: t.surface, borderWidth: 1, borderColor: t.border },
  title: { fontSize: 16, fontWeight: "800", color: t.textMain },
  badge: { fontSize: 11, fontWeight: "800", marginTop: 2 },
  jumpNowBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: t.accentBrand },
  jumpNowDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: t.textInverse },
  jumpNowText: { color: t.textInverse, fontWeight: "800", fontSize: 11 },
  scroll: { padding: SPACING.lg, paddingBottom: 60 },
  statsCard: { flexDirection: "row", gap: 8, backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: t.border, marginBottom: 12 },

  emptyBox: { backgroundColor: t.surface, padding: 24, borderRadius: RADIUS.lg, alignItems: "center", borderWidth: 1, borderColor: t.border },
  emptyTitle: { marginTop: 10, fontWeight: "800", color: t.textMain, fontSize: 15 },
  assistantSmall: { flexDirection: "row", gap: 6, marginTop: 12, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, alignItems: "center" },
  assistantSmallText: { fontWeight: "800", fontSize: 12 },

  gridWrap: { backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 8, paddingRight: 12, borderWidth: 1, borderColor: t.border },
});
