// Welcome — single registration entry. All sign-up buttons trigger Google
// OAuth inline (no intermediate /auth page). After auth, user lands on
// /onboarding/goal directly (or /(tabs) if they already have a profile).
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { SPACING, RADIUS } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { api } from "@/src/api";

const BG = "#F6F7F4";
const NAVY = "#1B2A55";
const DEEP_GREEN = "#0F6E56";

function extractSessionId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/[#&?]session_id=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function WelcomeScreen() {
  const router = useRouter();
  const { setSessionToken, user, hasProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Animations
  const screenOpacity = useSharedValue(0);
  const logoY = useSharedValue(12);
  const brandOpacity = useSharedValue(0);
  const brandY = useSharedValue(8);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(14);
  const descOpacity = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);
  const ctaY = useSharedValue(20);

  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    logoY.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) });
    // BESLENCE AI brand text delayed by 2500ms (separate from logo)
    brandOpacity.value = withDelay(2500, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    brandY.value = withDelay(2500, withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }));
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    titleY.value = withDelay(200, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
    descOpacity.value = withDelay(450, withTiming(1, { duration: 600 }));
    ctaOpacity.value = withDelay(700, withTiming(1, { duration: 600 }));
    ctaY.value = withDelay(700, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [screenOpacity, logoY, brandOpacity, brandY, titleOpacity, titleY, descOpacity, ctaOpacity, ctaY]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ translateY: logoY.value }] }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandY.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value, transform: [{ translateY: titleY.value }] }));
  const descStyle = useAnimatedStyle(() => ({ opacity: descOpacity.value }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value, transform: [{ translateY: ctaY.value }] }));

  // Inline Google OAuth — bypasses the /auth intermediate screen entirely.
  const processSessionId = useCallback(async (sessionId: string) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.googleSession(sessionId);
      await setSessionToken(res.session_token);
      if (res.has_profile) router.replace("/(tabs)");
      else router.replace("/onboarding/goal");
    } catch (e: any) {
      setErr(e?.message || "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  }, [router, setSessionToken]);

  // If already authed, skip welcome.
  useEffect(() => {
    if (user) {
      if (hasProfile) router.replace("/(tabs)");
      else router.replace("/onboarding/goal");
    }
  }, [user, hasProfile, router]);

  // Handle web/mobile deep link return with session_id
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      const id = extractSessionId(url);
      if (id) processSessionId(id);
    });
    if (Platform.OS === "web") {
      const h = (typeof window !== "undefined" && window.location.hash) || "";
      const q = (typeof window !== "undefined" && window.location.search) || "";
      const id = extractSessionId(h) || extractSessionId(q);
      if (id) {
        processSessionId(id);
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    }
    return () => sub.remove();
  }, [processSessionId]);

  const startGoogle = useCallback(async () => {
    setErr(null);
    let redirectUrl: string;
    if (Platform.OS === "web") {
      redirectUrl = typeof window !== "undefined" ? window.location.origin + "/welcome" : "";
    } else {
      redirectUrl = Linking.createURL("welcome");
    }
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    try {
      setBusy(true);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        const id = extractSessionId(result.url);
        if (id) await processSessionId(id);
      }
    } catch (e: any) {
      setErr(e?.message || "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  }, [processSessionId]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Animated.View style={[styles.fill, screenStyle]}>
        <Animated.View style={[styles.top, logoStyle]}>
          <Image
            source={require("../assets/images/beslence-b-logo-v2.png")}
            style={styles.logo}
            resizeMode="contain"
            testID="welcome-logo"
          />
        </Animated.View>
        <Animated.View style={[styles.brandWrap, brandStyle]}>
          <Text style={styles.brand} testID="welcome-brand">
            BESLENCE <Text style={styles.brandAi}>AI</Text>
          </Text>
        </Animated.View>

        <View style={styles.body}>
          <Animated.View style={titleStyle}>
            <Text style={styles.subtitle} testID="welcome-subtitle">
              YAPAY ZEKA DESTEKLİ BESLENME AJANDASI
            </Text>
          </Animated.View>

          {/* NEW: short app description (same box style) */}
          <Animated.View style={[styles.infoBox, descStyle]}>
            <Text style={styles.infoText} testID="welcome-info">
              BESLENCE AI; yediklerini, içtiklerini ve aktivitelerini saatine göre günlük çizelgene işleyen AI destekli kişisel beslenme ajandasıdır.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.descBox, descStyle]}>
            <Text style={styles.desc}>
              Birkaç kısa bilgiyle başlangıç hedeflerini oluşturalım. Aktivite ve öğünlerini daha sonra günlük çizelgene ekleyebileceksin.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.cta, ctaStyle]}>
          <SignupBtn
            icon={<Ionicons name="logo-google" size={18} color="#fff" />}
            label="Google ile Kaydol"
            onPress={startGoogle}
            testID="welcome-signup-google"
            bg={DEEP_GREEN}
            fg="#FFFFFF"
            disabled={busy}
          />

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity
            onPress={startGoogle}
            activeOpacity={0.85}
            style={styles.existingBtn}
            testID="welcome-existing-button"
            disabled={busy}
          >
            <Text style={styles.existingText}>Zaten hesabım var</Text>
          </TouchableOpacity>

          {err && <Text style={styles.errText} testID="welcome-error">{err}</Text>}

          <Text style={styles.disclaimer} testID="welcome-disclaimer">
            BESLENCE AI tanı, tedavi veya sağlık tavsiyesi sunmaz. Beslenme ve aktivite takibi için geliştirilmiş dijital bir asistandır.
          </Text>
        </Animated.View>
      </Animated.View>

      {busy && (
        <View style={styles.overlay} pointerEvents="none" testID="welcome-busy">
          <ActivityIndicator color={DEEP_GREEN} size="large" />
        </View>
      )}
    </SafeAreaView>
  );
}

const SignupBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  testID: string;
  bg: string;
  fg: string;
  outlined?: boolean;
  disabled?: boolean;
}> = ({ icon, label, onPress, testID, bg, fg, outlined, disabled }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    testID={testID}
    disabled={disabled}
    style={[
      styles.signBtn,
      {
        backgroundColor: bg,
        borderColor: outlined ? "#D6DCE9" : bg,
        opacity: disabled ? 0.6 : 1,
      },
    ]}
  >
    {icon}
    <Text style={[styles.signBtnText, { color: fg }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  fill: { flex: 1 },
  top: { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  logo: { width: 130, height: 130 },
  brand: { fontSize: 22, fontWeight: "900", color: "#000", letterSpacing: 2.5, textAlign: "center" },
  brandWrap: { alignItems: "center", marginTop: -4, paddingBottom: 4 },
  brandAi: { color: DEEP_GREEN },
  body: { flex: 1, paddingHorizontal: SPACING.lg, justifyContent: "center" },
  subtitle: {
    fontSize: 17,
    color: NAVY,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  infoBox: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: RADIUS.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E4E8F2",
  },
  infoText: { fontSize: 13, color: NAVY, textAlign: "center", lineHeight: 20, fontWeight: "600" },
  descBox: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: RADIUS.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E4E8F2",
  },
  desc: { fontSize: 13, color: "#5B6A8A", textAlign: "center", lineHeight: 20 },
  cta: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: 10 },
  signBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  signBtnText: { fontSize: 15, fontWeight: "700", letterSpacing: 0.2 },
  divider: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 4, gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: "#D6DCE9" },
  dividerText: { fontSize: 11, color: "#7D8AA3", fontWeight: "700", letterSpacing: 1 },
  existingBtn: { alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  existingText: { color: DEEP_GREEN, fontWeight: "800", fontSize: 14, letterSpacing: 0.3 },
  errText: { color: "#E5484D", textAlign: "center", fontSize: 12, marginTop: 4 },
  disclaimer: {
    color: "#7D8AA3",
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 15,
    paddingHorizontal: 8,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,38,32,0.06)",
  },
});
