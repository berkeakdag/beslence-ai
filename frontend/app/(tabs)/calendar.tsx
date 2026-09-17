// Calendar — TWO stacked views:
//  1) Monthly mini-grid (small dot per day; filled if entries exist)
//  2) Weekly 7-day timeline preview (compact grid, 06-24 to save space)
// Tapping a day opens the dedicated /day/[date] full-screen page.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, Pressable, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/src/auth-context";
import { RADIUS, SPACING, getThemed } from "@/src/theme";
import { api } from "@/src/api";

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const DAY_NAMES = ["Pzr", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

/** Format a week range in Turkish; when it crosses months it prints both months. */
const formatWeekRange = (a: Date, b: Date): string => {
  const y = b.getFullYear();
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameMonth) {
    return `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${y}`;
  }
  return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${y}`;
};

// Return an array of Date objects for every day in the given month.
const daysOfMonth = (year: number, month0: number): Date[] => {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month0, i + 1));
};

// Return an array of Date objects for the current week starting on Monday.
const weekOfDate = (d: Date): Date[] => {
  const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return x;
  });
};

export default function CalendarScreen() {
  const router = useRouter();
  const { theme, plan, isPro } = useAuth();
  const t = getThemed(theme);
  const s = useMemo(() => makeStyles(t), [t]);
  const [reminderOpen, setReminderOpen] = useState(false);

  const [today, setToday] = useState<Date>(new Date());
  const [monthCursor, setMonthCursor] = useState<{ year: number; month: number }>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [weekStart, setWeekStart] = useState<Date>(() => weekOfDate(new Date())[0]);
  const [monthPresence, setMonthPresence] = useState<Record<string, boolean>>({});
  const [weekEntries, setWeekEntries] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { setToday(new Date()); }, []);

  const monthDays = useMemo(
    () => daysOfMonth(monthCursor.year, monthCursor.month),
    [monthCursor]
  );
  const weekDays = useMemo(() => weekOfDate(weekStart), [weekStart]);

  // Load presence dots for the visible month + fetch full entries for the visible week.
  const loadMonth = useCallback(async (): Promise<Record<string, boolean>> => {
    const map: Record<string, boolean> = {};
    const requests = monthDays.map(async (d) => {
      const ds = fmt(d);
      try {
        const res = await api.listEntries(ds);
        map[ds] = (res.entries?.length || 0) > 0;
      } catch { map[ds] = false; }
    });
    await Promise.all(requests);
    return map;
  }, [monthDays]);

  const loadWeek = useCallback(async () => {
    const week: Record<string, any[]> = {};
    await Promise.all(weekDays.map(async (d) => {
      const ds = fmt(d);
      try {
        const r = await api.listEntries(ds);
        week[ds] = r.entries || [];
      } catch { week[ds] = []; }
    }));
    return week;
  }, [weekDays]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [monthMap, weekMap] = await Promise.all([loadMonth(), loadWeek()]);
      setMonthPresence(monthMap);
      setWeekEntries(weekMap);
    } finally { setLoading(false); }
  }, [loadMonth, loadWeek]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const jumpMonth = (delta: number) => {
    setMonthCursor((c) => {
      const nd = new Date(c.year, c.month + delta, 1);
      return { year: nd.getFullYear(), month: nd.getMonth() };
    });
  };
  const jumpWeek = (delta: number) => {
    setWeekStart((ws) => {
      const nd = new Date(ws);
      nd.setDate(ws.getDate() + delta * 7);
      return nd;
    });
  };

  const todayStr = fmt(today);
  const monthTitle = `${MONTHS[monthCursor.month]} ${monthCursor.year}`;

  // Compute weekday offset for first row (Monday-first grid)
  const firstDow = (new Date(monthCursor.year, monthCursor.month, 1).getDay() + 6) % 7;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.title}>Takvim</Text>
        <TouchableOpacity
          testID="cal-jump-today-btn"
          onPress={() => {
            const d = new Date();
            setMonthCursor({ year: d.getFullYear(), month: d.getMonth() });
            setWeekStart(weekOfDate(d)[0]);
          }}
          style={s.todayBtn}
        >
          <Ionicons name="today-outline" size={16} color={t.accentBrand} />
          <Text style={[s.todayBtnText, { color: t.accentBrand }]}>Bugün</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.accentBrand} />}
      >
        {/* Aylık mini-grid */}
        <View style={s.card}>
          <View style={s.monthHead}>
            <TouchableOpacity testID="month-prev" onPress={() => jumpMonth(-1)} style={s.arrowBtn}>
              <Ionicons name="chevron-back" size={18} color={t.textMain} />
            </TouchableOpacity>
            <Text style={s.monthTitle}>{monthTitle}</Text>
            <TouchableOpacity testID="month-next" onPress={() => jumpMonth(+1)} style={s.arrowBtn}>
              <Ionicons name="chevron-forward" size={18} color={t.textMain} />
            </TouchableOpacity>
          </View>
          <View style={s.weekDaysRow}>
            {["Pzt","Sal","Çar","Per","Cum","Cmt","Pzr"].map((d) => (
              <Text key={d} style={s.weekDayText}>{d}</Text>
            ))}
          </View>
          <View style={s.monthGrid}>
            {Array.from({ length: firstDow }).map((_, i) => <View key={`e${i}`} style={s.monthCell} />)}
            {monthDays.map((d) => {
              const ds = fmt(d);
              const filled = monthPresence[ds];
              const isToday = ds === todayStr;
              return (
                <TouchableOpacity
                  key={ds}
                  testID={`month-day-${ds}`}
                  style={s.monthCell}
                  onPress={() => router.push(`/day/${ds}`)}
                  activeOpacity={0.7}
                >
                  <View style={[s.monthDayNum, isToday && s.monthDayToday]}>
                    <Text style={[s.monthDayNumText, isToday && { color: t.textInverse }]}>
                      {d.getDate()}
                    </Text>
                  </View>
                  <View style={[s.monthDot, filled ? { backgroundColor: t.accentBrand } : { backgroundColor: t.border }]} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Haftalık 7-gün önizleme */}
        <View style={[s.card, { marginTop: 14 }]}>
          <View style={s.monthHead}>
            <TouchableOpacity testID="week-prev" onPress={() => jumpWeek(-1)} style={s.arrowBtn}>
              <Ionicons name="chevron-back" size={18} color={t.textMain} />
            </TouchableOpacity>
            <Text style={s.monthTitle}>{formatWeekRange(weekDays[0], weekDays[6])}</Text>
            <TouchableOpacity testID="week-next" onPress={() => jumpWeek(+1)} style={s.arrowBtn}>
              <Ionicons name="chevron-forward" size={18} color={t.textMain} />
            </TouchableOpacity>
          </View>
          <View style={s.weekRow}>
            {weekDays.map((d) => {
              const ds = fmt(d);
              const entries = weekEntries[ds] || [];
              const isToday = ds === todayStr;
              const entriesCount = entries.length;
              const totalCal = entries.reduce((acc: number, e: any) => acc + Math.round(((e.calories_min || 0) + (e.calories_max || 0)) / 2), 0);
              return (
                <TouchableOpacity
                  key={ds}
                  testID={`week-day-${ds}`}
                  onPress={() => router.push(`/day/${ds}`)}
                  activeOpacity={0.85}
                  style={[s.weekDayCell, isToday && s.weekDayCellToday]}
                >
                  <Text style={[s.weekDayName, isToday && { color: t.textInverse }]}>{DAY_NAMES[d.getDay()]}</Text>
                  <Text style={[s.weekDayNum, isToday && { color: t.textInverse }]}>{d.getDate()}</Text>
                  {(() => {
                    // Goal-based progress: fills from the BOTTOM up to % of daily calorie target.
                    const target = Math.max(1, Math.round(((plan?.goal_calories_min || 0) + (plan?.goal_calories_max || 0)) / 2) || 2000);
                    const pct = Math.min(1, totalCal / target);
                    return (
                      <View style={[s.progressTrack, isToday && { backgroundColor: "rgba(0,0,0,0.20)" }]}>
                        <View
                          style={[
                            s.progressFill,
                            {
                              height: `${Math.round(pct * 100)}%`,
                              minHeight: totalCal > 0 ? 5 : 0,
                              backgroundColor: isToday ? "#FFFFFF" : t.accentBrand,
                            },
                          ]}
                        />
                      </View>
                    );
                  })()}
                  <Text style={[s.weekCalories, isToday && { color: t.textInverse }]}>
                    {entriesCount > 0 ? `${totalCal} kcal` : "—"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={s.hintRow}>
            <Ionicons name="hand-left-outline" size={14} color="#fff" />
            <Text style={s.hintText}>Gün detayı için dokun</Text>
          </View>
        </View>

        {/* Hatırlatıcı ekle */}
        <TouchableOpacity
          testID="cal-add-reminder"
          onPress={() => setReminderOpen(true)}
          style={s.reminderCta}
          activeOpacity={0.85}
        >
          <View style={[s.assistantCtaIcon, { backgroundColor: "#8B5CF6" }]}>
            <Ionicons name="alarm" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.assistantCtaTitle, { color: t.textMain }]}>Hatırlatıcı ekle</Text>
            <Text style={[s.assistantCtaSub, { color: t.textMuted }]}>Tarih ve saat seç — telefonuna bildirim gelsin.</Text>
          </View>
          <Ionicons name="add-circle" size={24} color="#8B5CF6" />
        </TouchableOpacity>

        {/* Assistant CTA */}
        <TouchableOpacity
          testID="cal-open-assistant"
          onPress={() => router.push(isPro ? "/(tabs)/chatbot" : "/paywall")}
          style={s.assistantCta}
          activeOpacity={0.85}
        >
          <View style={s.assistantCtaIcon}>
            <MaterialCommunityIcons name="robot" size={20} color={t.textInverse} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.assistantCtaTitle, { color: t.textInverse }]}>Kayıt eklemek için Asistan</Text>
            <Text style={[s.assistantCtaSub, { color: t.textInverse }]}>Yazı, ses veya foto — tek yer.</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={t.textInverse} />
        </TouchableOpacity>
      </ScrollView>

      <ReminderModal
        visible={reminderOpen}
        theme={t}
        defaultDate={todayStr}
        onClose={() => setReminderOpen(false)}
        onSaved={() => { setReminderOpen(false); load(); }}
      />
    </SafeAreaView>
  );
}

// Reminder creation modal — title + date + time; saved as entry_type "reminder".
// The backend push scheduler delivers the notification at the exact date+time.
const ReminderModal: React.FC<{
  visible: boolean;
  theme: any;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ visible, theme: th, defaultDate, onClose, onSaved }) => {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dateStr, setDateStr] = useState(defaultDate);
  const [hh, setHh] = useState("12");
  const [mm, setMm] = useState("00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setNote("");
      setDateStr(defaultDate);
      const now = new Date();
      setHh(String(now.getHours()).padStart(2, "0"));
      setMm(String(Math.min(55, Math.ceil(now.getMinutes() / 5) * 5)).padStart(2, "0"));
    }
  }, [visible, defaultDate]);

  const hNum = parseInt(hh, 10);
  const mNum = parseInt(mm, 10);
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  const timeValid = !Number.isNaN(hNum) && hNum >= 0 && hNum <= 23 && !Number.isNaN(mNum) && mNum >= 0 && mNum <= 59;
  const canSave = title.trim().length > 0 && dateValid && timeValid && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await api.createEntry({
        date: dateStr,
        time: `${String(hNum).padStart(2, "0")}:${String(mNum).padStart(2, "0")}`,
        entry_type: "reminder",
        status: "planned",
        source: "manual",
        meal_type: "hatirlatici",
        title: title.trim(),
        note: note.trim(),
        system_summary: `Hatırlatıcı: ${title.trim()}${note.trim() ? ` — ${note.trim()}` : ""}`,
      });
      onSaved();
    } catch {}
    setSaving(false);
  };

  const inputStyle = {
    backgroundColor: th.surfaceAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: th.border, color: th.textMain, fontSize: 14, fontWeight: "700" as const,
  };
  const labelStyle = { fontSize: 10, color: th.textMuted, fontWeight: "800" as const, letterSpacing: 0.5, textTransform: "uppercase" as const, marginBottom: 4 };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(11,38,32,0.55)", justifyContent: "center", padding: 20 }} onPress={onClose}>
        <Pressable
          style={{ backgroundColor: th.surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: th.border }}
          onPress={(e) => e.stopPropagation()}
          testID="reminder-modal"
        >
          <Text style={{ fontSize: 17, fontWeight: "800", color: th.textMain }}>Hatırlatıcı Ekle</Text>
          <Text style={{ fontSize: 12, color: th.textMuted, marginTop: 2 }}>
            Seçtiğin tarih ve saatte telefonuna bildirim gelir.
          </Text>

          <View style={{ marginTop: 14 }}>
            <Text style={labelStyle}>Başlık</Text>
            <TextInput
              testID="reminder-title"
              style={inputStyle}
              value={title}
              onChangeText={setTitle}
              placeholder="örn. Akşam yürüyüşü"
              placeholderTextColor={th.textMuted}
            />
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={labelStyle}>Not ekle (isteğe bağlı)</Text>
            <TextInput
              testID="reminder-note"
              style={[inputStyle, { minHeight: 64, textAlignVertical: "top" }]}
              value={note}
              onChangeText={setNote}
              placeholder="örn. 30 dk tempolu, park rotası"
              placeholderTextColor={th.textMuted}
              multiline
            />
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Tarih (YYYY-AA-GG)</Text>
              <TextInput testID="reminder-date" style={inputStyle} value={dateStr} onChangeText={setDateStr} keyboardType="numbers-and-punctuation" placeholder="2026-06-21" placeholderTextColor={th.textMuted} />
            </View>
            <View style={{ width: 64 }}>
              <Text style={labelStyle}>Saat</Text>
              <TextInput testID="reminder-hour" style={[inputStyle, { textAlign: "center" }]} value={hh} onChangeText={setHh} keyboardType="numeric" maxLength={2} />
            </View>
            <View style={{ width: 64 }}>
              <Text style={labelStyle}>Dakika</Text>
              <TextInput testID="reminder-minute" style={[inputStyle, { textAlign: "center" }]} value={mm} onChangeText={setMm} keyboardType="numeric" maxLength={2} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <TouchableOpacity
              testID="reminder-cancel"
              style={{ flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: "center", backgroundColor: th.surfaceAlt, borderWidth: 1, borderColor: th.border }}
              onPress={onClose}
            >
              <Text style={{ fontWeight: "800", fontSize: 13, color: th.textMain }}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="reminder-save"
              style={{ flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: "center", backgroundColor: "#8B5CF6", opacity: canSave ? 1 : 0.5 }}
              onPress={save}
              disabled={!canSave}
            >
              <Text style={{ fontWeight: "800", fontSize: 13, color: "#fff" }}>{saving ? "Kaydediliyor…" : "Kaydet"}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (t: ReturnType<typeof getThemed>) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: "800", color: t.textMain },
  todayBtn: { flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
  todayBtnText: { fontWeight: "800", fontSize: 12 },
  scroll: { padding: SPACING.lg, paddingBottom: 60 },

  card: {
    backgroundColor: t.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: t.border,
  },
  monthHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  arrowBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.border },
  monthTitle: { fontWeight: "800", fontSize: 15, color: t.textMain, textTransform: "capitalize" },

  weekDaysRow: { flexDirection: "row" },
  weekDayText: { flex: 1, textAlign: "center", fontSize: 10, color: t.textMuted, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 },

  monthGrid: { flexDirection: "row", flexWrap: "wrap" },
  monthCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  monthDayNum: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  monthDayToday: { backgroundColor: t.accentBrand },
  monthDayNumText: { color: t.textMain, fontWeight: "700", fontSize: 13 },
  monthDot: { width: 5, height: 5, borderRadius: 2.5 },

  // Weekly row
  weekRow: { flexDirection: "row", gap: 4 },
  weekDayCell: {
    flex: 1,
    padding: 6,
    borderRadius: 12,
    backgroundColor: t.surfaceAlt,
    alignItems: "center",
    borderWidth: 1,
    borderColor: t.border,
    minHeight: 96,
  },
  weekDayCellToday: { backgroundColor: t.accentBrand, borderColor: t.accentBrand },
  weekDayName: { fontSize: 9, color: t.textMuted, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  weekDayNum: { fontSize: 16, fontWeight: "800", color: t.textMain, marginTop: 2 },
  progressTrack: { width: 14, height: 48, borderRadius: 7, backgroundColor: t.isSport ? "rgba(255,255,255,0.14)" : "rgba(11,38,32,0.10)", marginTop: 8, overflow: "hidden", justifyContent: "flex-end" },
  progressFill: { width: "100%", borderRadius: 7 },
  weekCalories: { fontSize: 9, fontWeight: "700", color: t.textMuted, marginTop: 6 },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
  },
  hintText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textShadowColor: "rgba(255,255,255,0.6)",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },

  assistantCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: t.accentBrand,
    marginTop: 14,
    shadowColor: t.accentBrand,
    shadowOpacity: t.isSport ? 0.5 : 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  reminderCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    marginTop: 14,
  },
  assistantCtaIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.15)", alignItems: "center", justifyContent: "center" },
  assistantCtaTitle: { fontSize: 14, fontWeight: "900" },
  assistantCtaSub: { fontSize: 11, fontWeight: "600", opacity: 0.85, marginTop: 2 },
});
