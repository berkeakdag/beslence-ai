// Timeline bubble component for daily schedule
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SHADOW } from "@/src/theme";

export interface TimelineEntry {
  id: string;
  date: string;
  time: string;
  entry_type: string;
  status: string;
  timeline_bubble_type: string;
  meal_type?: string; // kahvalti | ogle | aksam | ara_ogun | aktivite | su | kahve | not | plan
  title: string;
  system_summary?: string;
  note?: string;
  calories_min?: number | null;
  calories_max?: number | null;
  protein_g_min?: number | null;
  protein_g_max?: number | null;
  carbohydrate_g_min?: number | null;
  carbohydrate_g_max?: number | null;
  fat_g_min?: number | null;
  fat_g_max?: number | null;
  water_ml?: number | null;
  duration_minutes?: number | null;
  intensity?: string;
  estimated_activity_burn_min?: number | null;
  estimated_activity_burn_max?: number | null;
}

const bubbleVisual = (entry: TimelineEntry): { color: string; icon: keyof typeof Ionicons.glyphMap } => {
  const t = entry.timeline_bubble_type || entry.entry_type;
  switch (t) {
    case "meal":
    case "food":
      return { color: COLORS.bubbleMeal, icon: "restaurant-outline" };
    case "water":
      return { color: COLORS.bubbleWater, icon: "water-outline" };
    case "coffee":
      return { color: COLORS.bubbleCoffee, icon: "cafe-outline" };
    case "activity":
      return { color: COLORS.bubbleActivity, icon: "barbell-outline" };
    case "cardio":
      return { color: COLORS.bubbleCardio, icon: "walk-outline" };
    case "sleep":
      return { color: COLORS.bubbleNote, icon: "moon-outline" };
    case "note":
      return { color: COLORS.bubbleNote, icon: "create-outline" };
    case "plan":
      return { color: COLORS.bubblePlan, icon: "calendar-outline" };
    case "past":
      return { color: COLORS.bubblePast, icon: "time-outline" };
    case "photo":
    case "photo_food":
      return { color: COLORS.bubbleMeal, icon: "camera-outline" };
    default:
      return { color: COLORS.bubbleMeal, icon: "ellipse-outline" };
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case "planned":
      return "Planlandı";
    case "completed":
      return "Tamamlandı";
    case "current_logged":
      return "Güncel kaydedildi";
    case "past_logged":
      return "Geçmiş kayıt";
    case "skipped":
      return "Atlandı";
    case "modified":
      return "Değiştirildi";
    default:
      return status;
  }
};

interface Props {
  entry: TimelineEntry;
  onPress?: () => void;
  onStatusChange?: (status: string) => void;
}

export const TimelineBubble: React.FC<Props> = ({ entry, onPress, onStatusChange }) => {
  const { color, icon } = bubbleVisual(entry);
  const showCal = entry.calories_min != null && entry.calories_max != null;
  const showMacro = entry.protein_g_min != null || entry.carbohydrate_g_min != null;
  const showWater = entry.water_ml != null;
  const showBurn = entry.estimated_activity_burn_min != null;
  const showActivity = entry.duration_minutes != null;

  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text style={styles.time} testID={`bubble-time-${entry.id}`}>{entry.time}</Text>
      </View>
      <View style={[styles.dot, { backgroundColor: color }]}>
        <Ionicons name={icon} size={14} color="#fff" />
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.bubble, { borderLeftColor: color }]}
        onPress={onPress}
        testID={`timeline-bubble-${entry.id}`}
      >
        <View style={styles.bubbleHeader}>
          <Text style={styles.title} numberOfLines={1}>{entry.title || "Kayıt"}</Text>
          <View style={[styles.statusPill, { backgroundColor: color + "22" }]}>
            <Text style={[styles.statusText, { color }]}>{statusLabel(entry.status)}</Text>
          </View>
        </View>
        {!!entry.system_summary && (
          <Text style={styles.summary} numberOfLines={2}>{entry.system_summary}</Text>
        )}
        <View style={styles.metaRow}>
          {showCal && (
            <Text style={styles.meta}>
              {entry.calories_min}-{entry.calories_max} kcal
            </Text>
          )}
          {showMacro && (
            <Text style={styles.metaMuted}>
              P {entry.protein_g_min ?? "-"}-{entry.protein_g_max ?? "-"}g · K {entry.carbohydrate_g_min ?? "-"}-{entry.carbohydrate_g_max ?? "-"}g · Y {entry.fat_g_min ?? "-"}-{entry.fat_g_max ?? "-"}g
            </Text>
          )}
          {showWater && <Text style={styles.meta}>{entry.water_ml} ml</Text>}
          {showActivity && (
            <Text style={styles.meta}>
              {entry.duration_minutes} dk{entry.intensity ? ` · ${entry.intensity}` : ""}
            </Text>
          )}
          {showBurn && (
            <Text style={styles.metaMuted}>
              ~{entry.estimated_activity_burn_min}-{entry.estimated_activity_burn_max} kcal harcama
            </Text>
          )}
        </View>
        {entry.status === "planned" && onStatusChange && (
          <View style={styles.planActions}>
            <TouchableOpacity
              testID={`mark-completed-${entry.id}`}
              style={[styles.planBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => onStatusChange("completed")}
            >
              <Text style={styles.planBtnText}>Tamamlandı</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`mark-skipped-${entry.id}`}
              style={[styles.planBtn, { backgroundColor: COLORS.border }]}
              onPress={() => onStatusChange("skipped")}
            >
              <Text style={[styles.planBtnText, { color: COLORS.textMain }]}>Atla</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  timeCol: { width: 52, paddingTop: 8 },
  time: {
    color: COLORS.textMuted,
    fontWeight: "700",
    fontSize: 13,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 4,
    borderColor: COLORS.paper,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginRight: 12,
    zIndex: 2,
  },
  bubble: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },
  bubbleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontWeight: "700",
    fontSize: 15,
    color: COLORS.textMain,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  summary: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 6,
  },
  metaRow: {
    gap: 2,
  },
  meta: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMain,
  },
  metaMuted: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  planActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  planBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  planBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
});
