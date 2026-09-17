// Splash entry — dark background that matches the logo's black backdrop.
// Smooth, calm transitions: logo gently fades + scales in, slogan fades in,
// then the whole screen fades out before navigating to /welcome.
import React, { useEffect, useState } from "react";
import { View, Image, StyleSheet, Text, Platform } from "react-native";
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth-context";
import { api } from "@/src/api";

const BG = "#FFFFFF";

export default function Splash() {
  const router = useRouter();
  const { loading, user, hasProfile, setSessionToken } = useAuth();
  const [routed, setRouted] = useState(false);

  // Web auth callback: Emergent Google Auth redirects back to the ORIGIN with
  // #session_id=... — exchange it for a session token here.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const src = (window.location.hash || "") + (window.location.search || "");
    const m = src.match(/[#&?]session_id=([^&]+)/);
    if (!m) return;
    const sessionId = decodeURIComponent(m[1]);
    window.history.replaceState(null, "", window.location.pathname);
    setRouted(true); // block the splash timer from navigating mid-exchange
    (async () => {
      try {
        const res = await api.googleSession(sessionId);
        await setSessionToken(res.session_token);
        const me = await api.me();
        router.replace(me.has_profile ? "/(tabs)" : "/onboarding/goal");
      } catch {
        router.replace("/auth");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.92);
  const brandOpacity = useSharedValue(0);
  const brandY = useSharedValue(8);
  const sloganOpacity = useSharedValue(0);
  const sloganY = useSharedValue(8);
  const screenOpacity = useSharedValue(1);

  // Intro: logo first (faster), THEN brand text (later), THEN slogan.
  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    brandOpacity.value = withDelay(1400, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    brandY.value = withDelay(1400, withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }));
    sloganOpacity.value = withDelay(2200, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    sloganY.value = withDelay(2200, withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [logoOpacity, logoScale, brandOpacity, brandY, sloganOpacity, sloganY]);

  // Outro + navigate: hold, then fade the whole screen out smoothly.
  const goNext = () => {
    if (routed) return;
    setRouted(true);
    if (user) {
      if (hasProfile) router.replace("/(tabs)");
      else router.replace("/onboarding/goal");
    } else {
      router.replace("/welcome");
    }
  };

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      screenOpacity.value = withTiming(
        0,
        { duration: 550, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(goNext)();
        }
      );
    }, 3400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, hasProfile]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandY.value }],
  }));
  const sloganStyle = useAnimatedStyle(() => ({
    opacity: sloganOpacity.value,
    transform: [{ translateY: sloganY.value }],
  }));

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Animated.View style={[styles.fill, screenStyle]}>
        <View style={styles.content}>
          <Animated.View style={logoStyle} testID="splash-logo-image">
            <Image
              source={require("../assets/images/beslence-b-logo-v2.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
          <Animated.View style={brandStyle}>
            <Text style={styles.brand} testID="splash-brand">
              BESLENCE <Text style={styles.brandAi}>AI</Text>
            </Text>
          </Animated.View>
          <Animated.Text style={[styles.slogan, sloganStyle]} testID="splash-slogan">
            {`"Yediklerini, aktivitelerini ve günlük akışını tek yerden takip et."`}
          </Animated.Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  fill: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  logo: { width: 260, height: 260 },
  brand: {
    fontSize: 26,
    fontWeight: "900",
    color: "#000000",
    textAlign: "center",
    marginTop: -10,
    letterSpacing: 3,
  },
  brandAi: { color: "#0F6E56" },
  slogan: {
    fontSize: 14,
    color: "#000000",
    textAlign: "center",
    marginTop: 26,
    lineHeight: 22,
    fontWeight: "500",
    fontStyle: "italic",
    letterSpacing: 0.1,
  },
});
