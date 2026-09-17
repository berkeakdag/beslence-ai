// Weight tracking card — shown on the Report tab.
// Bar chart of recent measurements + current / 7-day change / goal summary,
// with an "Ekle" modal (one measurement per day, upserted).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { RADIUS, getThemed } from "@/src/theme";

type WeightItem = { date: string; weight_kg: number };

const dayLabel = (d: string) => {
  const [, m, day] = d.split("-");
  return `${parseInt(day, 10)}/${parseInt(m, 10)}`;
};

export const WeightCard: React.FC<{
  theme: ReturnType<typeof getThemed>;
  date: string; // selected report day (measurement is saved to this day)
  targetWeight?: number | null;
}> = ({ theme: t, date, targetWeight }) => {
  const s = useMemo(() => makeStyles(t), [t]);
  const [items, setItems] = useState<WeightItem[]>([]);
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.listWeights(60);
      setItems(res.items || []);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const latest = items.length ? items[items.length - 1] : null;

  // 7-day change: latest vs closest measurement at least 6 days older.
  const weekChange = useMemo(() => {
    if (!latest || items.length < 2) return null;
    const latestTime = new Date(latest.date + "T00:00:00").getTime();
    const older = [...items].reverse().find(
      (w) => latestTime - new Date(w.date + "T00:00:00").getTime() >= 6 * 86400000
    );
    if (!older) return null;
    return Math.round((latest.weight_kg - older.weight_kg) * 10) / 10;
  }, [items, latest]);

  const chartData = items.slice(-8);
  const minW = Math.min(...chartData.map((w) => w.weight_kg));
  const maxW = Math.max(...chartData.map((w) => w.weight_kg));
  const span = Math.max(1, maxW - minW);

  const save = async () => {
    const v = parseFloat((kg || "").replace(",", "."));
    if (!v || v < 20 || v > 400 || saving) return;
    setSaving(true);
    try {
      await api.addWeight(date, v);
      setOpen(false);
      await load();
    } catch {}
    setSaving(false);
  };

  return (
    <View style={s.card} testID="weight-card">
      <View style={s.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="scale-outline" size={18} color={t.accentBrand} />
          <Text style={s.title}>Kilo Takibi</Text>
        </View>
        <TouchableOpacity
          testID="weight-add-btn"
          style={s.addBtn}
          onPress={() => { setKg(latest ? String(latest.weight_kg) : ""); setOpen(true); }}
        >
          <Ionicons name="add" size={16} color={t.textInverse} />
          <Text style={s.addBtnText}>Ekle</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <Text style={s.empty}>Henüz kilo kaydın yok. İlk ölçümünü ekle, haftalık değişimini burada takip et.</Text>
      ) : (
        <>
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Güncel</Text>
              <Text style={s.summaryValue} testID="weight-current">{latest!.weight_kg} kg</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>7 Günlük</Text>
              <Text
                style={[s.summaryValue, weekChange !== null && { color: weekChange <= 0 ? t.accentBrand : "#E5484D" }]}
                testID="weight-week-change"
              >
                {weekChange === null ? "—" : `${weekChange > 0 ? "+" : ""}${weekChange} kg`}
              </Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Hedef</Text>
              <Text style={s.summaryValue}>{targetWeight ? `${targetWeight} kg` : "—"}</Text>
            </View>
          </View>

          <View style={s.chartRow}>
            {chartData.map((w) => {
              const h = 22 + ((w.weight_kg - minW) / span) * 48; // 22..70 px
              return (
                <View key={w.date} style={s.chartCol}>
                  <Text style={s.chartValue}>{w.weight_kg}</Text>
                  <View style={[s.chartBar, { height: h, backgroundColor: t.accentBrand }]} />
                  <Text style={s.chartLabel}>{dayLabel(w.date)}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()} testID="weight-modal">
            <Text style={s.modalTitle}>Kilo Ekle</Text>
            <Text style={s.modalSub}>{date} tarihine kaydedilir (aynı güne yeni değer girersen üzerine yazılır).</Text>
            <TextInput
              testID="weight-input"
              style={s.input}
              value={kg}
              onChangeText={setKg}
              keyboardType="numeric"
              placeholder="örn. 78.4"
              placeholderTextColor={t.textMuted}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.border }]} onPress={() => setOpen(false)}>
                <Text style={[s.modalBtnText, { color: t.textMain }]}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="weight-save"
                style={[s.modalBtn, { backgroundColor: t.accentBrand, opacity: saving ? 0.6 : 1 }]}
                onPress={save}
                disabled={saving}
              >
                <Text style={[s.modalBtnText, { color: t.textInverse }]}>{saving ? "Kaydediliyor…" : "Kaydet"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const makeStyles = (t: ReturnType<typeof getThemed>) => StyleSheet.create({
  card: { backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: t.border, marginBottom: 14 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 15, fontWeight: "800", color: t.textMain },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: t.accentBrand, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  addBtnText: { color: t.textInverse, fontSize: 12, fontWeight: "800" },
  empty: { fontSize: 12, color: t.textMuted, lineHeight: 18 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryItem: { flex: 1, backgroundColor: t.surfaceAlt, borderRadius: RADIUS.md, paddingVertical: 8, alignItems: "center" },
  summaryLabel: { fontSize: 9, color: t.textMuted, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  summaryValue: { fontSize: 15, fontWeight: "900", color: t.textMain, marginTop: 2 },
  chartRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingTop: 4 },
  chartCol: { alignItems: "center", gap: 3 },
  chartValue: { fontSize: 9, fontWeight: "800", color: t.textMuted },
  chartBar: { width: 16, borderRadius: 5 },
  chartLabel: { fontSize: 9, color: t.textMuted, fontWeight: "700" },
  backdrop: { flex: 1, backgroundColor: "rgba(11,38,32,0.55)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: t.surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: t.border },
  modalTitle: { fontSize: 17, fontWeight: "800", color: t.textMain },
  modalSub: { fontSize: 11, color: t.textMuted, marginTop: 2, marginBottom: 12 },
  input: { backgroundColor: t.surfaceAlt, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: t.border, color: t.textMain, fontSize: 20, fontWeight: "900", textAlign: "center" },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: "center" },
  modalBtnText: { fontWeight: "800", fontSize: 13 },
});
