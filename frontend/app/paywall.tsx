// BESLENCE AI Pro paywall — App Store / Google Play compliant.
// Price: 299 TL / ay, 3 gün ücretsiz deneme (intro offer, store-enforced).
// Purchases run through RevenueCat (native builds only). On web/Expo Go the
// button explains that purchasing requires the store build.
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth-context";
import { RADIUS, SPACING, getThemed } from "@/src/theme";
import { api } from "@/src/api";
import { purchasePro, restorePro } from "@/src/revenuecat";

const FEATURES = [
  { icon: "robot" as const, mci: true, title: "AI Asistan", desc: "Yaz veya fotoğraf çek — yemeklerini otomatik kaydeder" },
  { icon: "analytics" as const, mci: false, title: "Günlük Rapor", desc: "4 makro halkası, WHO eşiklerine göre uyarılar" },
  { icon: "camera" as const, mci: false, title: "Fotoğrafla Kayıt", desc: "Yemeğin fotoğrafından kalori tahmini" },
  { icon: "notifications" as const, mci: false, title: "Akıllı Bildirimler", desc: "19:00 rapor bildirimi + su hatırlatıcıları" },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { theme, refreshSubscription } = useAuth();
  const t = getThemed(theme);
  const s = useMemo(() => makeStyles(t), [t]);
  const [busy, setBusy] = useState(false);

  const notAvailableAlert = () => {
    const msg = "Satın alma yalnızca App Store / Google Play üzerinden indirilen uygulamada çalışır. Önizleme ve Expo Go'da abonelik başlatılamaz.";
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.alert(msg);
    } else {
      Alert.alert("Bilgi", msg);
    }
  };

  const buy = async () => {
    setBusy(true);
    const res = await purchasePro();
    if (res.ok) {
      try { await api.subscriptionSync(true, undefined, Platform.OS); } catch {}
      await refreshSubscription();
      router.back();
    } else if (res.error === "native_unavailable") {
      notAvailableAlert();
    } else if (!res.cancelled) {
      const msg = "Satın alma tamamlanamadı: " + (res.error || "bilinmeyen hata");
      if (Platform.OS === "web") { if (typeof window !== "undefined") window.alert(msg); }
      else Alert.alert("Hata", msg);
    }
    setBusy(false);
  };

  const restore = async () => {
    setBusy(true);
    const active = await restorePro();
    if (active === null) {
      notAvailableAlert();
    } else if (active) {
      try { await api.subscriptionSync(true, undefined, Platform.OS); } catch {}
      await refreshSubscription();
      router.back();
    } else {
      const msg = "Geri yüklenecek aktif abonelik bulunamadı.";
      if (Platform.OS === "web") { if (typeof window !== "undefined") window.alert(msg); }
      else Alert.alert("Bilgi", msg);
    }
    setBusy(false);
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <TouchableOpacity testID="paywall-close" onPress={() => router.back()} style={s.closeBtn}>
          <Ionicons name="close" size={22} color={t.textMain} />
        </TouchableOpacity>

        <View style={s.hero}>
          <Image source={require("@/assets/images/beslence-b-logo-v2.png")} style={s.heroLogo} resizeMode="contain" />
          <Text style={s.heroTitle}>BESLENCE AI <Text style={{ color: t.accentBrand }}>Pro</Text></Text>
          <Text style={s.heroSub}>Yapay zekâ destekli beslenme takibinin tamamını aç</Text>
        </View>

        {FEATURES.map((f) => (
          <View key={f.title} style={s.featureRow}>
            <View style={[s.featureIcon, { backgroundColor: t.accentBrand + "22" }]}>
              {f.mci
                ? <MaterialCommunityIcons name={f.icon as any} size={20} color={t.accentBrand} />
                : <Ionicons name={f.icon as any} size={20} color={t.accentBrand} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.featureTitle}>{f.title}</Text>
              <Text style={s.featureDesc}>{f.desc}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={t.accentBrand} />
          </View>
        ))}

        <View style={s.priceCard}>
          <View style={[s.trialBadge, { backgroundColor: t.accentBrand }]}>
            <Text style={[s.trialBadgeText, { color: t.textInverse }]}>3 GÜN ÜCRETSİZ DENE</Text>
          </View>
          <Text style={s.priceValue}>₺299<Text style={s.priceUnit}> / ay</Text></Text>
          <Text style={s.priceNote}>Deneme süresi sonunda aylık ₺299 olarak otomatik yenilenir.</Text>
        </View>

        <TouchableOpacity
          testID="paywall-subscribe"
          style={[s.cta, { backgroundColor: t.accentBrand, opacity: busy ? 0.6 : 1 }]}
          onPress={buy}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color={t.textInverse} /> : (
            <Text style={[s.ctaText, { color: t.textInverse }]}>3 Günlük Ücretsiz Denemeyi Başlat</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity testID="paywall-restore" style={s.restoreBtn} onPress={restore} disabled={busy}>
          <Text style={[s.restoreText, { color: t.accentBrand }]}>Satın alımları geri yükle</Text>
        </TouchableOpacity>

        <Text style={s.legal}>
          Abonelik, deneme süresi bitmeden en az 24 saat önce iptal edilmediği sürece otomatik olarak yenilenir ve
          ödemesi App Store / Google Play hesabın üzerinden tahsil edilir. İstediğin zaman App Store veya Google Play
          abonelik ayarlarından iptal edebilirsin; iptal, mevcut fatura döneminin sonunda geçerli olur. Ücretsiz sürümde
          manuel kayıt eklemeye devam edebilirsin.
        </Text>

        <View style={s.legalLinks}>
          <TouchableOpacity testID="paywall-terms" onPress={() => router.push("/legal/terms")}>
            <Text style={[s.legalLinkText, { color: t.accentBrand }]}>Kullanım Şartları</Text>
          </TouchableOpacity>
          <Text style={{ color: t.textMuted }}>·</Text>
          <TouchableOpacity testID="paywall-privacy" onPress={() => router.push("/legal/privacy")}>
            <Text style={[s.legalLinkText, { color: t.accentBrand }]}>Gizlilik Politikası</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ReturnType<typeof getThemed>) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  closeBtn: { alignSelf: "flex-end", width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: t.surface, borderWidth: 1, borderColor: t.border },
  hero: { alignItems: "center", marginTop: 4, marginBottom: 20 },
  heroLogo: { width: 84, height: 84, marginBottom: 10 },
  heroTitle: { fontSize: 24, fontWeight: "900", color: t.textMain, letterSpacing: 0.5 },
  heroSub: { fontSize: 13, color: t.textMuted, marginTop: 6, textAlign: "center", maxWidth: 280, lineHeight: 19 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.surface, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: t.border, marginBottom: 8 },
  featureIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontSize: 14, fontWeight: "800", color: t.textMain },
  featureDesc: { fontSize: 11, color: t.textMuted, marginTop: 1, lineHeight: 16 },
  priceCard: { alignItems: "center", backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 18, borderWidth: 1.5, borderColor: t.accentBrand, marginTop: 14 },
  trialBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 8 },
  trialBadgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  priceValue: { fontSize: 36, fontWeight: "900", color: t.textMain, letterSpacing: -1 },
  priceUnit: { fontSize: 15, fontWeight: "700", color: t.textMuted },
  priceNote: { fontSize: 11, color: t.textMuted, marginTop: 6, textAlign: "center" },
  cta: { marginTop: 16, paddingVertical: 16, borderRadius: 999, alignItems: "center" },
  ctaText: { fontSize: 15, fontWeight: "900" },
  restoreBtn: { alignItems: "center", paddingVertical: 14 },
  restoreText: { fontSize: 13, fontWeight: "800" },
  legal: { fontSize: 10, color: t.textMuted, lineHeight: 15, textAlign: "center", marginTop: 6 },
  legalLinks: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 12 },
  legalLinkText: { fontSize: 12, fontWeight: "800" },
});
