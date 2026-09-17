// Push registration — Emergent managed push relay.
// Safe no-op on web and in Expo Go (native token API unavailable there).
import { Platform } from "react-native";
import { api } from "@/src/api";

export async function registerForPush(userId: string) {
  if (Platform.OS === "web" || !userId) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require("expo-notifications");
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await api.registerPush(userId, Platform.OS, tokenResp.data);
  } catch (e) {
    // Expo Go / simulator without push entitlement — silently skip.
    console.log("push register skipped:", (e as any)?.message || e);
  }
}
