// Google Calendar-style timeline grid for BESLENCE AI — v2.
// Features:
//   • Full 24-hour ruler (00:00 → 24:00) with auto-scroll prep.
//   • Pinch-to-zoom: live re-layout, 15- / 30-min sub-lines appear at higher zoom.
//   • Non-overlapping cards (Google-Calendar-style column packing).
//   • Real-time neon "Şimdi" line with current HH:MM badge.
//   • Card colors by meal_type; tap → details; ✕ for quick delete.
import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Alert, Platform, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { COLORS, RADIUS } from "@/src/theme";
import type { TimelineEntry } from "./TimelineBubble";

const HOUR_START = 0;
const HOUR_END = 24;
const TOTAL_HOURS = HOUR_END - HOUR_START;

// Zoom bounds
const MIN_HOUR_H = 36;
const MAX_HOUR_H = 200;
const DEFAULT_HOUR_H = 64;

const LEFT_COL = 56;

export type MealType =
  | "kahvalti" | "ogle" | "aksam" | "ara_ogun"
  | "aktivite" | "su" | "kahve" | "not" | "plan" | "hatirlatici";

const inferMealType = (e: TimelineEntry): MealType => {
  if (e.entry_type === "reminder") return "hatirlatici";
  if (e.meal_type && e.meal_type in MEAL_META_KEYS) return e.meal_type as MealType;
  const t = e.entry_type;
  if (t === "activity") return "aktivite";
  if (t === "water") return "su";
  if (t === "coffee") return "kahve";
  if (t === "sleep" || t === "note") return "not";
  if (e.status === "planned") return "plan";
  const hour = parseInt((e.time || "12:00").split(":")[0], 10) || 12;
  if (hour >= 6 && hour <= 10) return "kahvalti";
  if (hour >= 11 && hour <= 14) return "ogle";
  if (hour >= 18 && hour <= 22) return "aksam";
  return "ara_ogun";
};

const MEAL_META: Record<
  MealType,
  { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  kahvalti:  { color: COLORS.mealKahvalti, bg: "#FFEFDF", icon: "sunny-outline",      label: "Kahvaltı" },
  ogle:      { color: COLORS.mealOgle,     bg: "#E1F1EA", icon: "restaurant-outline", label: "Öğle"     },
  aksam:     { color: COLORS.mealAksam,    bg: "#E5E7F5", icon: "moon-outline",       label: "Akşam"    },
  ara_ogun:  { color: COLORS.mealAraOgun,  bg: "#FBE3EE", icon: "cafe-outline",       label: "Ara Öğün" },
  aktivite:  { color: COLORS.mealAktivite, bg: "#FFE0D2", icon: "barbell-outline",    label: "Aktivite" },
  su:        { color: COLORS.mealSu,       bg: "#DEF1FB", icon: "water-outline",      label: "Su"       },
  kahve:     { color: COLORS.mealKahve,    bg: "#EBE0DA", icon: "cafe-outline",       label: "Kahve"    },
  not:       { color: COLORS.mealNot,      bg: "#ECEEF1", icon: "create-outline",     label: "Not"      },
  plan:      { color: COLORS.mealPlan,     bg: "#E6EAF3", icon: "calendar-outline",   label: "Planlı"   },
  hatirlatici: { color: "#8B5CF6",         bg: "#EDE9FE", icon: "alarm-outline",      label: "Hatırlatıcı" },
};
const MEAL_META_KEYS = {
  kahvalti: 1, ogle: 1, aksam: 1, ara_ogun: 1, aktivite: 1, su: 1, kahve: 1, not: 1, plan: 1, hatirlatici: 1,
};

const MACRO_META = {
  cal:     { color: "#E5484D", icon: "flame-outline"   as const, label: "Kalori"        },
  protein: { color: "#FF7043", icon: "fitness-outline" as const, label: "Protein"       },
  carb:    { color: "#FFB300", icon: "leaf-outline"    as const, label: "Karbonhidrat"  },
  fat:     { color: "#FFA000", icon: "ellipse-outline" as const, label: "Yağ"           },
};

const statusLabel = (s: string) => {
  switch (s) {
    case "planned": return "Planlandı";
    case "completed": return "Tamamlandı";
    case "current_logged": return "Güncel";
    case "past_logged": return "Geçmiş";
    case "skipped": return "Atlandı";
    case "modified": return "Değişti";
    default: return s;
  }
};

const parseHHMM = (t: string): number => {
  const [h, m] = (t || "00:00").split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
};
const mid = (a?: number | null, b?: number | null) =>
  Math.round(((a ?? 0) + (b ?? a ?? 0)) / 2);

// Estimated visual duration (in minutes) of each entry — used for card height + lane packing.
function estimatedDuration(e: TimelineEntry): number {
  if (typeof e.duration_minutes === "number" && e.duration_minutes > 0) return e.duration_minutes;
  if (e.entry_type === "activity") return 30;
  if (e.entry_type === "water" || e.entry_type === "coffee") return 15;
  if (e.entry_type === "note" || e.entry_type === "sleep") return 20;
  const calM = mid(e.calories_min, e.calories_max);
  if (calM >= 600) return 45;
  if (calM >= 300) return 35;
  return 25;
}

// Column-packing for Google-Calendar style non-overlapping layout.
type PackItem = {
  e: TimelineEntry;
  start: number;
  end: number;
  lane: number;
  totalLanes: number;
};
function packEntries(entries: TimelineEntry[]): PackItem[] {
  const items: PackItem[] = entries
    .map((e) => {
      const start = parseHHMM(e.time);
      return { e, start, end: start + Math.max(15, estimatedDuration(e)), lane: 0, totalLanes: 1 };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const result: PackItem[] = [];
  let cluster: PackItem[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    for (const it of cluster) {
      let placed = -1;
      for (let i = 0; i < colEnds.length; i++) {
        if (colEnds[i] <= it.start) { colEnds[i] = it.end; placed = i; break; }
      }
      if (placed < 0) { colEnds.push(it.end); placed = colEnds.length - 1; }
      it.lane = placed;
    }
    const total = colEnds.length;
    for (const it of cluster) { it.totalLanes = total; result.push(it); }
    cluster = [];
    clusterEnd = -1;
  };

  for (const it of items) {
    if (cluster.length === 0 || it.start < clusterEnd) {
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.end);
    } else {
      flush();
      cluster.push(it);
      clusterEnd = it.end;
    }
  }
  flush();
  return result;
}

interface Props {
  entries: TimelineEntry[];
  /** YYYY-MM-DD; "now" line only renders when this matches the device-local today. */
  dateStr?: string;
  onDelete?: (entry: TimelineEntry) => void | Promise<void>;
  /** Called after backend PATCH; parent should reload. */
  onEdited?: () => void;
  /** When set, that card briefly glows for ~1.5s (used after "Takvime git" jump). */
  highlightId?: string;
  /** Sport (dark) theme — hour/sub labels render white for visibility. */
  sport?: boolean;
}

export const TimelineGrid: React.FC<Props> = ({ entries, dateStr, onDelete, onEdited, highlightId, sport }) => {
  const [hourH, setHourH] = useState<number>(DEFAULT_HOUR_H);
  const hourHShared = useSharedValue<number>(DEFAULT_HOUR_H);
  const baseH = useSharedValue<number>(DEFAULT_HOUR_H);
  const [selected, setSelected] = useState<TimelineEntry | null>(null);

  // Manual editing state
  const [timeEditor, setTimeEditor] = useState<TimelineEntry | null>(null);
  const [amountEditor, setAmountEditor] = useState<TimelineEntry | null>(null);
  const [macroEditor, setMacroEditor] = useState<TimelineEntry | null>(null);

  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  const [nowLabel, setNowLabel] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
      setNowLabel(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Pinch gesture — created ONCE so the gesture session isn't lost mid-pinch.
  // Live re-render via runOnJS(setHourH); throttled by reanimated's frame cadence.
  const pinch = useMemo(() => {
    return Gesture.Pinch()
      .onBegin(() => {
        "worklet";
        baseH.value = hourHShared.value;
      })
      .onUpdate((evt) => {
        "worklet";
        const next = Math.max(MIN_HOUR_H, Math.min(MAX_HOUR_H, baseH.value * evt.scale));
        hourHShared.value = next;
        runOnJS(setHourH)(next);
      });
    // Intentionally no dependencies — sharedValues are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gridHeight = TOTAL_HOURS * hourH;

  // Today check (device-local)
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const isToday = !dateStr || dateStr === todayStr;
  const showNow = isToday && nowMinutes >= HOUR_START * 60 && nowMinutes < HOUR_END * 60;
  const nowTop = ((nowMinutes - HOUR_START * 60) / 60) * hourH;

  // Layout entries
  const packed = useMemo(() => packEntries(entries), [entries]);

  const handleDelete = (entry: TimelineEntry) => {
    if (Platform.OS === "web") {
      // RN Web's Alert is intrusive; do a window.confirm instead.
      const ok = typeof window !== "undefined" && window.confirm(`"${entry.title || "Kayıt"}" silinsin mi?`);
      if (ok && onDelete) Promise.resolve(onDelete(entry)).catch(() => {});
      return;
    }
    Alert.alert("Kaydı sil", `"${entry.title || "Kayıt"}" çizelgeden silinsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: async () => { try { await onDelete?.(entry); } catch {} } },
    ]);
  };

  // Long-press menu (Sil / Saati değiştir / Miktarı düzenle)
  const [longPressEntry, setLongPressEntry] = useState<TimelineEntry | null>(null);
  const handleLongPress = (entry: TimelineEntry) => setLongPressEntry(entry);

  // Highlight glow — clears itself after 1.5s
  const [activeGlow, setActiveGlow] = useState<string>("");
  useEffect(() => {
    if (!highlightId) return;
    setActiveGlow(highlightId);
    const t = setTimeout(() => setActiveGlow(""), 1500);
    return () => clearTimeout(t);
  }, [highlightId]);

  // Decide which sub-divisions to show based on hourH
  // hourH >= 110 → show 15-min lines (4 per hour, all labelled)
  // hourH >= 75  → show 30-min lines (2 per hour, labelled)
  // else hourly only
  const showQuarter = hourH >= 110;
  const showHalf = hourH >= 75 && !showQuarter;

  return (
    <GestureDetector gesture={pinch}>
      <View style={[styles.wrap, { height: gridHeight }]} testID="timeline-grid-root">
        {/* Zoom controls (also usable on web/desktop where pinch isn't trivial) */}
        <View style={styles.zoomControls} pointerEvents="box-none">
          <TouchableOpacity
            testID="grid-zoom-out"
            onPress={() => {
              const next = Math.max(MIN_HOUR_H, hourH - 24);
              hourHShared.value = next; setHourH(next);
            }}
            style={styles.zoomBtn}
          >
            <Ionicons name="remove" size={16} color={COLORS.textMain} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="grid-zoom-in"
            onPress={() => {
              const next = Math.min(MAX_HOUR_H, hourH + 24);
              hourHShared.value = next; setHourH(next);
            }}
            style={styles.zoomBtn}
          >
            <Ionicons name="add" size={16} color={COLORS.textMain} />
          </TouchableOpacity>
        </View>

        {/* Hour lines (solid horizontals) — start after LEFT_COL so they don't cross labels */}
        {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => (
          <View
            key={`hline-${i}`}
            pointerEvents="none"
            style={[styles.hourLineSolid, { top: i * hourH }]}
          />
        ))}

        {/* Sub-lines (30 or 15 min) */}
        {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
          const topPx = i * hourH;
          return (
            <React.Fragment key={`sub-${i}`}>
              {showQuarter && [15, 30, 45].map((m) => (
                <View
                  key={`ql-${i}-${m}`}
                  pointerEvents="none"
                  style={[
                    styles.subLine,
                    m === 30 ? styles.subLineHalf : styles.subLineQuarter,
                    { top: topPx + (m / 60) * hourH },
                  ]}
                />
              ))}
              {showHalf && (
                <View
                  pointerEvents="none"
                  style={[styles.subLine, styles.subLineHalf, { top: topPx + 0.5 * hourH }]}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Hour labels (dedicated absolute column, guaranteed visible on iOS/Android/Web) */}
        {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => {
          const hour = HOUR_START + i;
          const topPx = i * hourH - 8; // center on line
          return (
            <View
              key={`hlab-${i}`}
              pointerEvents="none"
              style={[styles.labelBox, { top: topPx }]}
            >
              <Text style={[styles.hourLabel, sport && styles.hourLabelSport]}>{`${String(hour).padStart(2, "0")}:00`}</Text>
            </View>
          );
        })}

        {/* 30-min labels (only when zoomed to :30 mode) */}
        {showHalf && Array.from({ length: TOTAL_HOURS }).map((_, i) => {
          const hour = HOUR_START + i;
          const topPx = i * hourH + 0.5 * hourH - 7;
          return (
            <View
              key={`hlab30-${i}`}
              pointerEvents="none"
              style={[styles.labelBox, { top: topPx }]}
            >
              <Text style={[styles.subLabel, styles.subLabelStrong, sport && styles.hourLabelSport]}>
                {`${String(hour).padStart(2, "0")}:30`}
              </Text>
            </View>
          );
        })}

        {/* 15-min labels (when very zoomed) */}
        {showQuarter && Array.from({ length: TOTAL_HOURS }).map((_, i) => {
          const hour = HOUR_START + i;
          return [15, 30, 45].map((m) => {
            const topPx = i * hourH + (m / 60) * hourH - 7;
            return (
              <View
                key={`hlab-${i}-${m}`}
                pointerEvents="none"
                style={[styles.labelBox, { top: topPx }]}
              >
                <Text style={[styles.subLabel, m === 30 && styles.subLabelStrong, sport && (m === 30 ? styles.hourLabelSport : styles.subLabelSport)]}>
                  {`${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`}
                </Text>
              </View>
            );
          });
        })}

        {/* Cards layer */}
        <View
          style={[styles.cardsLayer, { left: LEFT_COL, height: gridHeight }]}
          pointerEvents="box-none"
        >
          {packed.map((it) => {
            const e = it.e;
            const top = ((it.start - HOUR_START * 60) / 60) * hourH;
            // Card height proportional to its packed duration
            const durMin = Math.max(15, it.end - it.start);
            const naturalH = (durMin / 60) * hourH;
            const cardH = Math.max(54, Math.min(naturalH, hourH * 4));
            const widthPct = 100 / it.totalLanes;
            const leftPct = widthPct * it.lane;
            const meta = MEAL_META[inferMealType(e)] || MEAL_META.ara_ogun;
            return (
              <CompactCard
                key={e.id}
                entry={e}
                topPx={top + 2}
                heightPx={cardH - 4}
                leftPct={leftPct}
                widthPct={widthPct}
                meta={meta}
                glow={activeGlow === e.id}
                onPress={() => setSelected(e)}
                onLongPress={() => handleLongPress(e)}
                onDelete={() => handleDelete(e)}
              />
            );
          })}

          {/* Şimdi line */}
          {showNow && (
            <View pointerEvents="none" style={[styles.nowRow, { top: nowTop - 10 }]}>
              <View style={styles.nowBadge}>
                <Ionicons name="time" size={11} color="#0B2620" />
                <Text style={styles.nowBadgeText}>Şimdi {nowLabel}</Text>
              </View>
              <View style={styles.nowDot} />
              <View style={styles.nowLine} />
            </View>
          )}
        </View>

        <DetailModal
          entry={selected}
          onClose={() => setSelected(null)}
          onDelete={(e) => { setSelected(null); handleDelete(e); }}
          onEditAmount={(e) => { setSelected(null); setAmountEditor(e); }}
          onChangeTime={(e) => { setSelected(null); setTimeEditor(e); }}
          onEditMacros={(e) => { setSelected(null); setMacroEditor(e); }}
        />

        {/* Long-press action menu */}
        <ActionSheet
          entry={longPressEntry}
          onClose={() => setLongPressEntry(null)}
          onDelete={(e) => { setLongPressEntry(null); handleDelete(e); }}
          onEditAmount={(e) => { setLongPressEntry(null); setAmountEditor(e); }}
          onChangeTime={(e) => { setLongPressEntry(null); setTimeEditor(e); }}
          onEditMacros={(e) => { setLongPressEntry(null); setMacroEditor(e); }}
        />

        {/* Time editor modal */}
        <TimeEditorModal
          entry={timeEditor}
          onClose={() => setTimeEditor(null)}
          onSaved={() => { setTimeEditor(null); onEdited?.(); }}
        />

        {/* Amount editor modal */}
        <AmountEditorModal
          entry={amountEditor}
          onClose={() => setAmountEditor(null)}
          onSaved={() => { setAmountEditor(null); onEdited?.(); }}
        />

        {/* Macro editor modal (food entries) */}
        <MacroEditorModal
          entry={macroEditor}
          onClose={() => setMacroEditor(null)}
          onSaved={() => { setMacroEditor(null); onEdited?.(); }}
        />
      </View>
    </GestureDetector>
  );
};

// ---------- Cards ----------

const CompactCard: React.FC<{
  entry: TimelineEntry;
  topPx: number;
  heightPx: number;
  leftPct: number;
  widthPct: number;
  meta: typeof MEAL_META[MealType];
  glow?: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
}> = ({ entry, topPx, heightPx, leftPct, widthPct, meta, glow, onPress, onLongPress, onDelete }) => {
  const calExact = mid(entry.calories_min, entry.calories_max);
  const calDelta = Math.round((Math.max(entry.calories_max || 0, entry.calories_min || 0) - Math.min(entry.calories_max || 0, entry.calories_min || 0)) / 2);
  const isCompact = heightPx < 76;
  // Pill-style: thinner, taller, with a single primary metric.
  return (
    <View
      style={[
        styles.cardOuter,
        {
          top: topPx,
          height: heightPx,
          left: `${leftPct}%`,
          width: `${widthPct}%`,
        },
      ]}
    >
      <TouchableOpacity
        testID={`grid-card-${entry.id}`}
        activeOpacity={0.85}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={[
          styles.card,
          { borderLeftColor: meta.color, backgroundColor: meta.bg },
          glow && {
            borderWidth: 2,
            borderColor: "#00E676",
            shadowColor: "#00E676",
            shadowOpacity: 0.9,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.icon} size={10} color="#fff" />
          </View>
          <Text style={styles.cardTime}>{entry.time}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={isCompact ? 1 : 2}>
          {entry.title || "Kayıt"}
        </Text>
        {/* Single exact metric (kcal or duration) */}
        {calExact > 0 && (
          <View style={styles.exactRow}>
            <Text style={[styles.exactValue, { color: meta.color }]}>{calExact}</Text>
            <Text style={[styles.exactUnit,  { color: meta.color }]}> kcal</Text>
            {!isCompact && calDelta > 0 && (
              <Text style={styles.exactDelta}>±{calDelta}</Text>
            )}
          </View>
        )}
        {entry.duration_minutes != null && calExact === 0 && (
          <View style={styles.exactRow}>
            <Text style={[styles.exactValue, { color: meta.color }]}>{entry.duration_minutes}</Text>
            <Text style={[styles.exactUnit,  { color: meta.color }]}> dk</Text>
          </View>
        )}
        {entry.water_ml != null && (
          <View style={styles.exactRow}>
            <Text style={[styles.exactValue, { color: meta.color }]}>{entry.water_ml}</Text>
            <Text style={[styles.exactUnit,  { color: meta.color }]}> ml</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        testID={`grid-card-delete-${entry.id}`}
        onPress={onDelete}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.closeBtn}
      >
        <Ionicons name="close" size={10} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

// ---------- Detail Modal ----------

const isFoodEntry = (e: TimelineEntry) =>
  e.entry_type === "food" || e.entry_type === "photo_food";

const DetailModal: React.FC<{
  entry: TimelineEntry | null;
  onClose: () => void;
  onDelete: (e: TimelineEntry) => void;
  onEditAmount?: (e: TimelineEntry) => void;
  onChangeTime?: (e: TimelineEntry) => void;
  onEditMacros?: (e: TimelineEntry) => void;
}> = ({ entry, onClose, onDelete, onEditAmount, onChangeTime, onEditMacros }) => {
  if (!entry) return null;
  const meta = MEAL_META[inferMealType(entry)] || MEAL_META.ara_ogun;
  const calMid = mid(entry.calories_min, entry.calories_max);
  const pMid = mid(entry.protein_g_min, entry.protein_g_max);
  const cMid = mid(entry.carbohydrate_g_min, entry.carbohydrate_g_max);
  const fMid = mid(entry.fat_g_min, entry.fat_g_max);

  return (
    <Modal visible={!!entry} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { borderTopColor: meta.color }]}
          onPress={(e) => e.stopPropagation()}
          testID="grid-detail-modal"
        >
          <View style={styles.modalHeader}>
            <View style={[styles.modalIcon, { backgroundColor: meta.color }]}>
              <Ionicons name={meta.icon} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle} numberOfLines={2}>{entry.title || "Kayıt"}</Text>
              <Text style={styles.modalSub}>
                {entry.date} • {entry.time} • {meta.label} • {statusLabel(entry.status)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="grid-detail-close">
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {!!entry.system_summary && (
            <Text style={styles.modalSummary}>{entry.system_summary}</Text>
          )}
          {!!entry.note && (
            <Text style={styles.modalSummary}>📝 {entry.note}</Text>
          )}

          <View style={styles.modalMetricsGrid}>
            {calMid > 0 && <DetailMetric icon={MACRO_META.cal.icon}     color={MACRO_META.cal.color}     label="Kalori" value={`${calMid}`} unit="kcal"       range={fmtRange(entry.calories_min, entry.calories_max, "kcal")} />}
            {pMid   > 0 && <DetailMetric icon={MACRO_META.protein.icon} color={MACRO_META.protein.color} label="Protein" value={`${pMid}`} unit="g"            range={fmtRange(entry.protein_g_min, entry.protein_g_max, "g")} />}
            {cMid   > 0 && <DetailMetric icon={MACRO_META.carb.icon}    color={MACRO_META.carb.color}    label="Karb" value={`${cMid}`} unit="g"                range={fmtRange(entry.carbohydrate_g_min, entry.carbohydrate_g_max, "g")} />}
            {fMid   > 0 && <DetailMetric icon={MACRO_META.fat.icon}     color={MACRO_META.fat.color}     label="Yağ" value={`${fMid}`} unit="g"                  range={fmtRange(entry.fat_g_min, entry.fat_g_max, "g")} />}
            {entry.water_ml != null && <DetailMetric icon="water-outline" color={COLORS.mealSu} label="Su" value={`${entry.water_ml}`} unit="ml" range="" />}
            {entry.duration_minutes != null && <DetailMetric icon="time-outline" color={meta.color} label="Süre" value={`${entry.duration_minutes}`} unit="dk" range={entry.intensity || ""} />}
            {entry.estimated_activity_burn_min != null && (
              <DetailMetric
                icon="flame-outline" color="#E5484D" label="Yakım"
                value={`${mid(entry.estimated_activity_burn_min, entry.estimated_activity_burn_max)}`} unit="kcal"
                range={fmtRange(entry.estimated_activity_burn_min, entry.estimated_activity_burn_max, "kcal")}
              />
            )}
          </View>

          <View style={styles.modalActionRow}>
            {onChangeTime && (
              <TouchableOpacity testID="grid-detail-time" style={[styles.modalActionBtn, { backgroundColor: COLORS.mealPlan }]} onPress={() => onChangeTime(entry)}>
                <Ionicons name="time-outline" size={16} color="#fff" />
                <Text style={styles.modalActionText}>Saati</Text>
              </TouchableOpacity>
            )}
            {onEditMacros && isFoodEntry(entry) && (
              <TouchableOpacity testID="grid-detail-macros" style={[styles.modalActionBtn, { backgroundColor: MACRO_META.protein.color }]} onPress={() => onEditMacros(entry)}>
                <Ionicons name="nutrition-outline" size={16} color="#fff" />
                <Text style={styles.modalActionText}>Makro</Text>
              </TouchableOpacity>
            )}
            {onEditAmount && entry.entry_type !== "reminder" && (
              <TouchableOpacity testID="grid-detail-amount" style={[styles.modalActionBtn, { backgroundColor: meta.color }]} onPress={() => onEditAmount(entry)}>
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={styles.modalActionText}>Miktar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity testID="grid-detail-delete" style={[styles.modalActionBtn, { backgroundColor: "#E5484D" }]} onPress={() => onDelete(entry)}>
              <Ionicons name="trash-outline" size={16} color="#fff" />
              <Text style={styles.modalActionText}>Sil</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ---------- Long-press action sheet ----------
const ActionSheet: React.FC<{
  entry: TimelineEntry | null;
  onClose: () => void;
  onDelete: (e: TimelineEntry) => void;
  onEditAmount?: (e: TimelineEntry) => void;
  onChangeTime?: (e: TimelineEntry) => void;
  onEditMacros?: (e: TimelineEntry) => void;
}> = ({ entry, onClose, onDelete, onEditAmount, onChangeTime, onEditMacros }) => {
  if (!entry) return null;
  const meta = MEAL_META[inferMealType(entry)] || MEAL_META.ara_ogun;
  return (
    <Modal visible={!!entry} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()} testID="grid-action-sheet">
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { backgroundColor: meta.color }]}>
              <Ionicons name={meta.icon} size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle} numberOfLines={1}>{entry.title || "Kayıt"}</Text>
              <Text style={styles.sheetSub}>{entry.date} • {entry.time}</Text>
            </View>
          </View>
          {onChangeTime && (
            <TouchableOpacity testID="action-change-time" onPress={() => onChangeTime(entry)} style={styles.sheetRow}>
              <Ionicons name="time-outline" size={20} color={COLORS.textMain} />
              <Text style={styles.sheetRowText}>Saati değiştir</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} style={{ marginLeft: "auto" }} />
            </TouchableOpacity>
          )}
          {onEditAmount && entry.entry_type !== "reminder" && (
            <TouchableOpacity testID="action-edit-amount" onPress={() => onEditAmount(entry)} style={styles.sheetRow}>
              <Ionicons name="create-outline" size={20} color={COLORS.textMain} />
              <Text style={styles.sheetRowText}>Miktarı düzenle</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} style={{ marginLeft: "auto" }} />
            </TouchableOpacity>
          )}
          {onEditMacros && isFoodEntry(entry) && (
            <TouchableOpacity testID="action-edit-macros" onPress={() => onEditMacros(entry)} style={styles.sheetRow}>
              <Ionicons name="nutrition-outline" size={20} color={COLORS.textMain} />
              <Text style={styles.sheetRowText}>Makroları düzenle</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} style={{ marginLeft: "auto" }} />
            </TouchableOpacity>
          )}
          <TouchableOpacity testID="action-delete" onPress={() => onDelete(entry)} style={styles.sheetRow}>
            <Ionicons name="trash-outline" size={20} color="#E5484D" />
            <Text style={[styles.sheetRowText, { color: "#E5484D" }]}>Sil</Text>
            <Ionicons name="chevron-forward" size={18} color="#E5484D" style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
          <TouchableOpacity testID="action-cancel" onPress={onClose} style={[styles.sheetRow, { justifyContent: "center" }]}>
            <Text style={[styles.sheetRowText, { color: COLORS.textMuted, marginLeft: 0 }]}>Vazgeç</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const fmtRange = (a?: number | null, b?: number | null, unit = "") => {
  if (a == null && b == null) return "";
  if (a != null && b != null && a !== b) return `${a}-${b} ${unit}`.trim();
  return `${a ?? b} ${unit}`.trim();
};

const DetailMetric: React.FC<{ icon: keyof typeof Ionicons.glyphMap; color: string; label: string; value: string; unit?: string; range?: string }> = ({ icon, color, label, value, unit, range }) => (
  <View style={styles.detailMetric}>
    <View style={[styles.detailMetricIcon, { backgroundColor: color + "22" }]}>
      <Ionicons name={icon} size={14} color={color} />
    </View>
    <Text style={styles.detailMetricLabel}>{label}</Text>
    <Text style={styles.detailMetricValue}>
      {value}<Text style={styles.detailMetricUnit}>{unit ? ` ${unit}` : ""}</Text>
    </Text>
    {!!range && <Text style={styles.detailMetricRange}>{range}</Text>}
  </View>
);

// ---------- Manual editors ----------

const TimeEditorModal: React.FC<{
  entry: TimelineEntry | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ entry, onClose, onSaved }) => {
  const [h, setH] = useState<number>(0);
  const [m, setM] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (entry) {
      const [hh, mm] = (entry.time || "00:00").split(":").map((x) => parseInt(x, 10));
      setH(hh || 0);
      setM(mm || 0);
    }
  }, [entry]);
  if (!entry) return null;
  const clampH = (v: number) => Math.max(0, Math.min(23, v));
  const clampM = (v: number) => Math.max(0, Math.min(59, v));
  const save = async () => {
    setSaving(true);
    try {
      const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { api } = require("@/src/api");
      await api.updateEntryTime(entry.id, timeStr);
      onSaved();
    } catch {}
    setSaving(false);
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()} testID="grid-time-editor">
          <Text style={styles.modalTitle}>Saati değiştir</Text>
          <Text style={styles.modalSub}>{entry.title || "Kayıt"}</Text>
          <View style={styles.pickerRow}>
            <Stepper label="Saat" value={h} min={0} max={23} onChange={(v) => setH(clampH(v))} testID="time-h" />
            <Text style={styles.pickerColon}>:</Text>
            <Stepper label="Dakika" value={m} min={0} max={59} step={5} onChange={(v) => setM(clampM(v))} testID="time-m" />
          </View>
          <View style={styles.modalActionRow}>
            <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: COLORS.mealPlan }]} onPress={onClose} testID="time-editor-cancel">
              <Text style={styles.modalActionText}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: COLORS.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={save}
              disabled={saving}
              testID="time-editor-save"
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.modalActionText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const AmountEditorModal: React.FC<{
  entry: TimelineEntry | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ entry, onClose, onSaved }) => {
  const [amount, setAmount] = useState<string>("");
  const [unit, setUnit] = useState<string>("porsiyon");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (entry) {
      if (entry.entry_type === "water" || entry.entry_type === "coffee") {
        setUnit("ml");
        setAmount(String(entry.water_ml ?? 250));
      } else if (entry.entry_type === "activity") {
        setUnit("dk");
        setAmount(String(entry.duration_minutes ?? 30));
      } else {
        setUnit("porsiyon");
        setAmount("1");
      }
    }
  }, [entry]);
  if (!entry) return null;
  const units = entry.entry_type === "water" || entry.entry_type === "coffee" ? ["ml"]
    : entry.entry_type === "activity" ? ["dk"]
    : ["porsiyon", "g", "adet"];
  const save = async () => {
    const num = parseFloat(amount);
    if (!(num > 0)) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { api } = require("@/src/api");
      await api.updateEntryAmount(entry.id, num, unit);
      onSaved();
    } catch {}
    setSaving(false);
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()} testID="grid-amount-editor">
          <Text style={styles.modalTitle}>Miktarı düzenle</Text>
          <Text style={styles.modalSub}>{entry.title || "Kayıt"}</Text>
          <View style={styles.amountRow}>
            <TextInput
              testID="amount-input"
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="Miktar"
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.unitRow}>
              {units.map((u) => (
                <TouchableOpacity
                  key={u}
                  onPress={() => setUnit(u)}
                  testID={`amount-unit-${u}`}
                  style={[styles.unitBtn, unit === u && styles.unitBtnSel]}
                >
                  <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextSel]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.modalActionRow}>
            <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: COLORS.mealPlan }]} onPress={onClose} testID="amount-editor-cancel">
              <Text style={styles.modalActionText}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: COLORS.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={save}
              disabled={saving}
              testID="amount-editor-save"
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.modalActionText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const MacroEditorModal: React.FC<{
  entry: TimelineEntry | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ entry, onClose, onSaved }) => {
  const [title, setTitle] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (entry) {
      setTitle(entry.title || "");
      setP(String(mid(entry.protein_g_min, entry.protein_g_max) || ""));
      setC(String(mid(entry.carbohydrate_g_min, entry.carbohydrate_g_max) || ""));
      setF(String(mid(entry.fat_g_min, entry.fat_g_max) || ""));
    }
  }, [entry]);
  if (!entry) return null;
  const num = (v: string) => Math.max(0, parseFloat((v || "").replace(",", ".")) || 0);
  const kcal = Math.round(num(p) * 4 + num(c) * 4 + num(f) * 9);
  const save = async () => {
    if (kcal <= 0 || saving) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { api } = require("@/src/api");
      await api.updateEntryMacros(entry.id, {
        title: title.trim() || undefined,
        protein_g: num(p),
        carbohydrate_g: num(c),
        fat_g: num(f),
      });
      onSaved();
    } catch {}
    setSaving(false);
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()} testID="grid-macro-editor">
          <Text style={styles.modalTitle}>Makroları düzenle</Text>
          <Text style={styles.modalSub}>Gramları değiştir — kalori otomatik hesaplanır.</Text>
          <View style={{ marginTop: 14 }}>
            <Text style={styles.macroFieldLabel}>Yemek adı</Text>
            <TextInput
              testID="macro-title-input"
              style={styles.macroInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Yemek adı"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.macroFieldLabel}>Protein (g)</Text>
              <TextInput testID="macro-protein-input" style={[styles.macroInput, { textAlign: "center" }]} value={p} onChangeText={setP} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.macroFieldLabel}>Karb (g)</Text>
              <TextInput testID="macro-carb-input" style={[styles.macroInput, { textAlign: "center" }]} value={c} onChangeText={setC} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.macroFieldLabel}>Yağ (g)</Text>
              <TextInput testID="macro-fat-input" style={[styles.macroInput, { textAlign: "center" }]} value={f} onChangeText={setF} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textMuted} />
            </View>
          </View>
          <View style={{ alignItems: "center", marginVertical: 14 }}>
            <Text style={styles.macroFieldLabel}>Kalori (otomatik)</Text>
            <Text testID="macro-kcal-preview" style={{ fontSize: 26, fontWeight: "900", color: COLORS.primary, letterSpacing: -0.5 }}>
              {kcal}<Text style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: "700" }}> kcal</Text>
            </Text>
          </View>
          <View style={styles.modalActionRow}>
            <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: COLORS.mealPlan }]} onPress={onClose} testID="macro-editor-cancel">
              <Text style={styles.modalActionText}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, { backgroundColor: COLORS.primary, opacity: saving || kcal <= 0 ? 0.6 : 1 }]}
              onPress={save}
              disabled={saving || kcal <= 0}
              testID="macro-editor-save"
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.modalActionText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};


const Stepper: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; testID: string }> = ({ label, value, min, max, step = 1, onChange, testID }) => (
  <View style={styles.stepper}>
    <Text style={styles.stepperLabel}>{label}</Text>
    <View style={styles.stepperRow}>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))} style={styles.stepperBtn} testID={`${testID}-minus`}>
        <Ionicons name="remove" size={16} color={COLORS.textMain} />
      </TouchableOpacity>
      <Text style={styles.stepperVal}>{String(value).padStart(2, "0")}</Text>
      <TouchableOpacity onPress={() => onChange(Math.min(max, value + step))} style={styles.stepperBtn} testID={`${testID}-plus`}>
        <Ionicons name="add" size={16} color={COLORS.textMain} />
      </TouchableOpacity>
    </View>
  </View>
);

// ---------- Styles ----------

const styles = StyleSheet.create({
  wrap: { position: "relative", overflow: "visible" },

  // Hour label — dedicated absolute box on the left column, always visible.
  labelBox: {
    position: "absolute",
    left: 0,
    width: LEFT_COL,
    height: 16,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 8,
  },

  // Horizontal hour line (starts after left column so it visually separates labels)
  hourLineSolid: {
    position: "absolute",
    left: LEFT_COL,
    right: 0,
    height: 1,
    backgroundColor: COLORS.border,
  },
  subLine: {
    position: "absolute",
    left: LEFT_COL,
    right: 0,
    height: 1,
  },
  subLineQuarter: { backgroundColor: "rgba(11,38,32,0.06)" },
  subLineHalf:    { backgroundColor: "rgba(11,38,32,0.10)" },

  hourLabel: { fontSize: 11, color: COLORS.textMain, fontWeight: "800" },
  hourLabelSport: { color: "#FFFFFF" },
  subLabel:  { fontSize: 10, color: COLORS.textMuted, fontWeight: "600" },
  subLabelSport: { color: "rgba(255,255,255,0.78)" },
  subLabelStrong: { color: COLORS.textMain, fontWeight: "700" },

  // Cards — narrower "pill" style: tighter padding, smaller font
  cardsLayer: { position: "absolute", top: 0, right: 8 },
  cardOuter: { position: "absolute", paddingHorizontal: 2 },
  card: {
    flex: 1,
    borderLeftWidth: 3,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    paddingRight: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    overflow: "hidden",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  cardIcon: { width: 15, height: 15, borderRadius: 7.5, alignItems: "center", justifyContent: "center" },
  cardTime: { fontSize: 10, color: COLORS.textMain, fontWeight: "800" },
  cardTitle: { fontSize: 11, fontWeight: "800", color: COLORS.textMain, marginBottom: 2 },

  // Exact value row (single primary metric)
  exactRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" },
  exactValue: { fontSize: 14, fontWeight: "900", letterSpacing: -0.3 },
  exactUnit:  { fontSize: 10, fontWeight: "700" },
  exactDelta: { fontSize: 9, color: "#7C8B85", marginLeft: 4, fontWeight: "600" },

  // Macro bars
  barsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4, alignItems: "center" },
  barItem: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 50, flexShrink: 1 },
  barTrack: { flex: 1, height: 5, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.06)", overflow: "hidden", minWidth: 28 },
  barFill: { height: "100%", borderRadius: 999 },
  metricInline: { flexDirection: "row", alignItems: "center", gap: 4 },
  metricInlineText: { fontSize: 11, fontWeight: "800" },

  closeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "rgba(11,38,32,0.55)",
    alignItems: "center", justifyContent: "center",
    zIndex: 5,
  },

  // "Şimdi" line — neon green
  nowRow: {
    position: "absolute",
    left: -10, right: -8,
    height: 20,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  nowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#00E676",
    shadowColor: "#00E676",
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  nowBadgeText: { fontSize: 10, fontWeight: "900", color: "#0B2620", letterSpacing: 0.3 },
  nowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#00E676", marginLeft: 4, shadowColor: "#00E676", shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  nowLine: { flex: 1, height: 2, backgroundColor: "#00E676", borderRadius: 1 },

  // Detail modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(11,38,32,0.45)", justifyContent: "center", paddingHorizontal: 18 },

  // Zoom controls
  zoomControls: {
    position: "absolute",
    right: 4,
    top: 4,
    flexDirection: "column",
    gap: 4,
    zIndex: 20,
  },
  zoomBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: RADIUS.xl, padding: 20, borderTopWidth: 4 },
  modalHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 10 },
  modalIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 17, fontWeight: "800", color: COLORS.textMain },
  modalSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, fontWeight: "600" },
  modalSummary: { color: COLORS.textMain, fontSize: 13, lineHeight: 20, marginBottom: 10 },
  modalMetricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  detailMetric: { flexGrow: 1, minWidth: "30%", padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border },
  detailMetricIcon: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  detailMetricLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  detailMetricValue: { fontSize: 18, color: COLORS.textMain, fontWeight: "900", marginTop: 2, letterSpacing: -0.3 },
  detailMetricUnit: { fontSize: 10, color: COLORS.textMuted, fontWeight: "700" },
  detailMetricRange: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },

  // New multi-action row (replaces single "Kaydı sil" button)
  modalActionRow: { flexDirection: "row", gap: 8 },
  modalActionBtn: { flex: 1, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: RADIUS.pill },
  modalActionText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  modalDeleteBtn: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: "#E5484D" },
  modalDeleteText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  // Long-press action sheet
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(11,38,32,0.55)", justifyContent: "flex-end" },
  sheetCard: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 14, paddingBottom: 26 },
  sheetHeader: { flexDirection: "row", gap: 10, alignItems: "center", paddingHorizontal: 6, paddingVertical: 8, marginBottom: 4 },
  sheetIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sheetTitle: { fontSize: 14, fontWeight: "800", color: COLORS.textMain },
  sheetSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  sheetRowText: { fontSize: 14, fontWeight: "700", color: COLORS.textMain },

  // Time / Amount editor styles
  pickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginVertical: 20 },
  pickerColon: { fontSize: 30, color: COLORS.textMain, fontWeight: "800", marginHorizontal: 2 },
  stepper: { alignItems: "center", minWidth: 90 },
  stepperLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepperBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  stepperVal: { fontSize: 28, fontWeight: "900", color: COLORS.textMain, minWidth: 42, textAlign: "center" },

  amountRow: { marginVertical: 16, gap: 10 },
  amountInput: { backgroundColor: COLORS.paper, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 20, fontWeight: "900", color: COLORS.textMain, borderWidth: 1, borderColor: COLORS.border, textAlign: "center" },
  macroFieldLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  macroInput: { backgroundColor: COLORS.paper, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: "700", color: COLORS.textMain, borderWidth: 1, borderColor: COLORS.border },
  unitRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  unitBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border },
  unitBtnSel: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  unitBtnText: { fontSize: 12, fontWeight: "800", color: COLORS.textMain },
  unitBtnTextSel: { color: "#fff" },
});
