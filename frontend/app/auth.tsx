// Google sign-in screen using Emergent-managed Google Auth.
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, SPACING, RADIUS, SHADOW } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { api } from "@/src/api";
import { BeslenceLogo } from "@/src/components/BeslenceLogo";
import { PrimaryButton } from "@/src/components/PrimaryButton";

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const { setSessionToken, hasProfile, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const goNext = useCallback(() => {
    if (hasProfile) router.replace("/(tabs)");
    else router.replace("/onboarding/goal");
  }, [hasProfile, router]);

  useEffect(() => {
    if (user) goNext();
  }, [user, goNext]);

  const processSessionId = useCallback(async (sessionId: string) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.googleSession(sessionId);
      await setSessionToken(res.session_token);
      goNext();
    } catch (e: any) {
      setErr(e?.message || "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  }, [setSessionToken, goNext]);

  // Handle deep link return on mobile
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      const id = extractSessionId(url);
      if (id) processSessionId(id);
    });
    (async () => {
      const init = await Linking.getInitialURL();
      if (init) {
        const id = extractSessionId(init);
        if (id) processSessionId(id);
      }
    })();
    // Web: check current URL for fragment session_id
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
      // Origin-only redirect — the root Splash screen processes the returned
      // session_id fragment. Works across preview/production/custom domains.
      redirectUrl = typeof window !== "undefined" ? window.location.origin : "";
    } else {
      redirectUrl = Linking.createURL("auth");
    }
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        const id = extractSessionId(result.url);
        if (id) await processSessionId(id);
      }
    } catch (e: any) {
      setErr(e?.message || "Giriş başarısız");
    }
  }, [processSessionId]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity testID="auth-back-button" style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textMain} />
        </TouchableOpacity>

        <View style={styles.hero}>
          <BeslenceLogo size={96} showWordmark={false} animate />
          <Text style={styles.title}>Hoş geldin</Text>
          <Text style={styles.sub}>
            BESLENCE AI hesabınla devam et. Verilerin güvende, sadece sana özel takip için kullanılır.
          </Text>
        </View>

        <View style={styles.card}>
          <PrimaryButton
            title={busy ? "Bağlanılıyor..." : "Google ile devam et"}
            onPress={startGoogle}
            loading={busy}
            testID="google-signin-button"
            icon={<Ionicons name="logo-google" size={18} color="#fff" />}
          />
          {err && <Text style={styles.err} testID="auth-error">{err}</Text>}
        </View>

        <View style={styles.legal}>
          <Text style={styles.legalText}>
            {`Devam ederek Kullanım Koşulları ve KVKK Aydınlatma Metni'ni kabul etmiş olursun.`}
          </Text>
        </View>
      </ScrollView>
      {busy && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      )}
    </SafeAreaView>
  );
}

function extractSessionId(url: string): string | null {
  if (!url) return null;
  // Try hash and query
  const hashMatch = url.match(/[#&?]session_id=([^&]+)/);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  scroll: { padding: SPACING.lg, flexGrow: 1 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  hero: { alignItems: "center", marginTop: 32, marginBottom: 24 },
  title: { marginTop: 24, fontSize: 26, fontWeight: "800", color: COLORS.textMain },
  sub: { marginTop: 8, textAlign: "center", fontSize: 14, color: COLORS.textMuted, lineHeight: 22, maxWidth: 320 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    ...SHADOW.card,
  },
  err: { color: COLORS.danger, marginTop: 12, textAlign: "center" },
  legal: { marginTop: 24, alignItems: "center" },
  legalText: { fontSize: 12, color: COLORS.textMuted, textAlign: "center", lineHeight: 18 },
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(11,38,32,0.08)" },
});
