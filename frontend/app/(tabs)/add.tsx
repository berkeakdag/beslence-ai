// "Ekle" tab — free users get the manual entry screen (their only entry path);
// Pro users are redirected straight to the AI Assistant.
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth-context";
import { RADIUS, SPACING, getThemed } from "@/src/theme";
import { ManualFoodModal } from "@/src/components/ManualFoodModal";

export default function AddScreen() {
  const router = useRouter();
  const { theme, isPro, subLoading } = useAuth();
  const t = getThemed(theme);
  const s = useMemo(() => makeStyles(t), [t]);
  const [manualOpen, setManualOpen] = useState(false);
  const [savedEntry, setSavedEntry] = useState<any>(null);

  // Pro users never see this screen — assistant is their entry path.
  useEffect(() => {
    if (!subLoading && isPro) {
      router.replace("/(tabs)/chatbot");
    }
  }, [isPro, subLoading, router]);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Kayıt Ekle</Text>
        <Text style={s.subtitle}>Yemek adı ve makro gramlarını gir, kalori otomatik hesaplansın.</Text>

        <TouchableOpacity
          testID="add-manual-btn"
          style={[s.manualCard, { borderColor: t.accentBrand }]}
          onPress={() => setManualOpen(true)}
          activeOpacity={0.85}
        >
          <View style={[s.manualIcon, { backgroundColor: t.accentBrand }]}>
            <Ionicons name="create-outline" size={24} color={t.textInverse} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.manualTitle}>Manuel Gir</Text>
            <Text style={s.manualDesc}>Protein / karbonhidrat / yağ gramı → otomatik kalori</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={t.accentBrand} />
        </TouchableOpacity>

        {savedEntry && (
          <View style={s.savedCard} testID="add-saved-card">
            <Ionicons name="checkmark-circle" size={20} color={t.accentBrand} />
            <View style={{ flex: 1 }}>
              <Text style={s.savedTitle}>{savedEntry.title} kaydedildi</Text>
              <Text style={s.savedMeta}>{savedEntry.date} • {savedEntry.time} • {savedEntry.calories_min} kcal</Text>
            </View>
            <TouchableOpacity
              testID="add-saved-goto"
              onPress={() => router.push({ pathname: "/day/[date]", params: { date: savedEntry.date, highlight: savedEntry.id, t: savedEntry.time } })}
            >
              <Text style={{ color: t.accentBrand, fontWeight: "800", fontSize: 12 }}>Takvime git</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pro upsell */}
        <TouchableOpacity
          testID="add-pro-upsell"
          style={s.proCard}
          onPress={() => router.push("/paywall")}
          activeOpacity={0.85}
        >
          <View style={[s.manualIcon, { backgroundColor: "rgba(0,0,0,0.2)" }]}>
            <MaterialCommunityIcons name="robot" size={24} color={t.textInverse} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.manualTitle, { color: t.textInverse }]}>AI Asistan ile ekle — Pro</Text>
            <Text style={[s.manualDesc, { color: t.textInverse, opacity: 0.85 }]}>
              Yaz veya fotoğraf çek, gerisini yapay zekâ halletsin. 3 gün ücretsiz dene!
            </Text>
          </View>
          <Ionicons name="lock-closed" size={18} color={t.textInverse} />
        </TouchableOpacity>
      </ScrollView>

      <ManualFoodModal
        visible={manualOpen}
        theme={t}
        onClose={() => setManualOpen(false)}
        onSaved={(entry) => {
          setManualOpen(false);
          setSavedEntry(entry);
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (t: ReturnType<typeof getThemed>) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.lg },
  title: { fontSize: 22, fontWeight: "800", color: t.textMain },
  subtitle: { color: t.textMuted, marginTop: 4, fontSize: 13, marginBottom: 18 },
  manualCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 16, borderWidth: 1.5, marginBottom: 12 },
  manualIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  manualTitle: { fontSize: 15, fontWeight: "800", color: t.textMain },
  manualDesc: { fontSize: 11, color: t.textMuted, marginTop: 2, lineHeight: 16 },
  savedCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.accentBrand + "18", borderRadius: RADIUS.md, padding: 12, marginBottom: 12 },
  savedTitle: { fontSize: 13, fontWeight: "800", color: t.textMain },
  savedMeta: { fontSize: 11, color: t.textMuted, marginTop: 1 },
  proCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.accentBrand, borderRadius: RADIUS.lg, padding: 16, marginTop: 6 },
});
