// Bottom tab navigation. The centre "+" tab is a shortcut that always opens the
// AI Assistant chat. All entry (food/water/activity/plan) MUST go through the
// chatbot — the old manual "add" form is intentionally removed.
import React from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, getThemed } from "@/src/theme";
import { useAuth } from "@/src/auth-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme, isPro } = useAuth();
  const themed = getThemed(theme);
  const barBg = themed.isSport ? themed.surface : "#fff";
  const active = themed.isSport ? themed.accentBrand : COLORS.primary;
  const inactive = themed.isSport ? themed.textMuted : COLORS.textMuted;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          backgroundColor: barBg,
          borderTopColor: themed.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          tabBarButtonTestID: "tab-home",
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Takvim",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
          tabBarButtonTestID: "tab-calendar",
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Ekle",
          tabBarIcon: () => (
            <View style={[styles.addFab, { backgroundColor: active, shadowColor: active }]}>
              <MaterialCommunityIcons name="robot" size={28} color={themed.isSport ? "#0A0F0D" : "#fff"} />
            </View>
          ),
          tabBarLabel: () => null,
          tabBarButtonTestID: "tab-add",
        }}
        listeners={{
          // Pro → assistant; free → default (manual add screen).
          tabPress: (e) => {
            if (isPro) {
              e.preventDefault();
              router.push("/(tabs)/chatbot");
            }
          },
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          // Hide from tab bar — still accessible as a screen via push().
          href: null,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: "Rapor",
          tabBarIcon: ({ color, size }) => <Ionicons name="analytics-outline" size={size} color={color} />,
          tabBarButtonTestID: "tab-report",
        }}
        listeners={{
          // Report is a Pro feature — free users see the paywall.
          tabPress: (e) => {
            if (!isPro) {
              e.preventDefault();
              router.push("/paywall");
            }
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          tabBarButtonTestID: "tab-profile",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addFab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -10,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
