// RevenueCat wrapper — entitlement: "Beslence AI Pro".
// All calls degrade gracefully on web / Expo Go (native module unavailable):
// they return null/false so the caller falls back to the backend tier.
import { Platform } from "react-native";

const RC_API_KEY = process.env.EXPO_PUBLIC_RC_API_KEY || "";
export const PRO_ENTITLEMENT_ID = "Beslence AI Pro";

let purchasesModule: any = null;
let configured = false;

function getPurchases(): any | null {
  if (Platform.OS === "web") return null;
  if (purchasesModule) return purchasesModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    purchasesModule = require("react-native-purchases").default;
  } catch {
    purchasesModule = null;
  }
  return purchasesModule;
}

export async function configureRC(appUserID?: string): Promise<boolean> {
  const P = getPurchases();
  if (!P || !RC_API_KEY) return false;
  try {
    if (!configured) {
      P.configure({ apiKey: RC_API_KEY, appUserID });
      configured = true;
    }
    return true;
  } catch {
    return false;
  }
}

/** true/false when RC is reachable, null when unavailable (web/Expo Go). */
export async function checkProEntitlement(): Promise<boolean | null> {
  const P = getPurchases();
  if (!P || !configured) return null;
  try {
    const info = await P.getCustomerInfo();
    return typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== "undefined";
  } catch {
    return null;
  }
}

export async function purchasePro(): Promise<{ ok: boolean; cancelled?: boolean; error?: string }> {
  const P = getPurchases();
  if (!P || !configured) return { ok: false, error: "native_unavailable" };
  try {
    const offerings = await P.getOfferings();
    const pkg = offerings.current?.availablePackages?.[0];
    if (!pkg) return { ok: false, error: "no_offering" };
    const { customerInfo } = await P.purchasePackage(pkg);
    const active = typeof customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== "undefined";
    return { ok: active };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: e?.message || "purchase_failed" };
  }
}

export async function restorePro(): Promise<boolean | null> {
  const P = getPurchases();
  if (!P || !configured) return null;
  try {
    const info = await P.restorePurchases();
    return typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== "undefined";
  } catch {
    return null;
  }
}

/** Opens the native subscription management UI (RevenueCat/StoreKit/Play).
 *  Falls back to the platform store subscriptions page URL. Returns true if handled. */
export async function manageSubscription(): Promise<boolean> {
  const P = getPurchases();
  if (P && configured) {
    try {
      await P.showManageSubscriptions();
      return true;
    } catch {}
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Linking } = require("react-native");
    const url = Platform.OS === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions";
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
