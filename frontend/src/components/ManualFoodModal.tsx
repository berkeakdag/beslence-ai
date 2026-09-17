// Manual food entry modal — name + protein/carb/fat grams; calories auto (4/4/9), time selectable.
// Shared by the Assistant screen (Pro) and the manual Add screen (free tier).
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable } from "react-native";
import { api } from "@/src/api";
import { istanbulTodayStr, istanbulHHMM } from "@/src/utils/time";

export const ManualFoodModal: React.FC<{
  visible: boolean;
  theme: any;
  onClose: () => void;
  onSaved: (entry: any) => void;
}> = ({ visible, theme: th, onClose, onSaved }) => {
  const [name, setName] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [hh, setHh] = useState("12");
  const [mm, setMm] = useState("00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      const now = istanbulHHMM();
      setHh(now.slice(0, 2));
      setMm(now.slice(3, 5));
      setName(""); setP(""); setC(""); setF("");
    }
  }, [visible]);

  const num = (v: string) => Math.max(0, parseFloat((v || "").replace(",", ".")) || 0);
  const kcal = Math.round(num(p) * 4 + num(c) * 4 + num(f) * 9);
  const hNum = parseInt(hh, 10);
  const mNum = parseInt(mm, 10);
  const timeValid = !Number.isNaN(hNum) && hNum >= 0 && hNum <= 23 && !Number.isNaN(mNum) && mNum >= 0 && mNum <= 59;
  const canSave = name.trim().length > 0 && kcal > 0 && timeValid && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const pv = num(p), cv = num(c), fv = num(f);
      const time = `${String(hNum).padStart(2, "0")}:${String(mNum).padStart(2, "0")}`;
      const entry = await api.createEntry({
        date: istanbulTodayStr(),
        time,
        entry_type: "food",
        status: "past_logged",
        source: "manual",
        raw_user_input: `manuel: ${name.trim()}`,
        title: name.trim(),
        calories_min: kcal, calories_max: kcal,
        protein_g_min: pv, protein_g_max: pv,
        carbohydrate_g_min: cv, carbohydrate_g_max: cv,
        fat_g_min: fv, fat_g_max: fv,
        system_summary: `Manuel kayıt: ${name.trim()} — ${pv} g protein, ${cv} g karbonhidrat, ${fv} g yağ (${kcal} kcal).`,
      });
      onSaved(entry);
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
          testID="manual-food-modal"
        >
          <Text style={{ fontSize: 17, fontWeight: "800", color: th.textMain }}>Manuel Gir</Text>
          <Text style={{ fontSize: 12, color: th.textMuted, marginTop: 2 }}>Gramları yaz, kaloriyi ben hesaplayayım.</Text>

          <View style={{ marginTop: 14 }}>
            <Text style={labelStyle}>Yemek adı</Text>
            <TextInput
              testID="manual-food-name"
              style={inputStyle}
              value={name}
              onChangeText={setName}
              placeholder="örn. Izgara tavuk + pilav"
              placeholderTextColor={th.textMuted}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Protein (g)</Text>
              <TextInput testID="manual-food-protein" style={inputStyle} value={p} onChangeText={setP} keyboardType="numeric" placeholder="0" placeholderTextColor={th.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Karb (g)</Text>
              <TextInput testID="manual-food-carb" style={inputStyle} value={c} onChangeText={setC} keyboardType="numeric" placeholder="0" placeholderTextColor={th.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Yağ (g)</Text>
              <TextInput testID="manual-food-fat" style={inputStyle} value={f} onChangeText={setF} keyboardType="numeric" placeholder="0" placeholderTextColor={th.textMuted} />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12, alignItems: "flex-end" }}>
            <View style={{ width: 70 }}>
              <Text style={labelStyle}>Saat</Text>
              <TextInput testID="manual-food-hour" style={[inputStyle, { textAlign: "center" }]} value={hh} onChangeText={setHh} keyboardType="numeric" maxLength={2} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "800", color: th.textMain, paddingBottom: 8 }}>:</Text>
            <View style={{ width: 70 }}>
              <Text style={labelStyle}>Dakika</Text>
              <TextInput testID="manual-food-minute" style={[inputStyle, { textAlign: "center" }]} value={mm} onChangeText={setMm} keyboardType="numeric" maxLength={2} />
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={labelStyle}>Kalori (otomatik)</Text>
              <Text testID="manual-food-kcal" style={{ fontSize: 24, fontWeight: "900", color: th.accentBrand, letterSpacing: -0.5 }}>
                {kcal}<Text style={{ fontSize: 12, color: th.textMuted, fontWeight: "700" }}> kcal</Text>
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <TouchableOpacity
              testID="manual-food-cancel"
              style={{ flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: "center", backgroundColor: th.surfaceAlt, borderWidth: 1, borderColor: th.border }}
              onPress={onClose}
            >
              <Text style={{ fontWeight: "800", fontSize: 13, color: th.textMain }}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="manual-food-save"
              style={{ flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: "center", backgroundColor: th.accentBrand, opacity: canSave ? 1 : 0.5 }}
              onPress={save}
              disabled={!canSave}
            >
              <Text style={{ fontWeight: "800", fontSize: 13, color: th.textInverse }}>{saving ? "Kaydediliyor…" : "Kaydet"}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
