import { Redirect } from "expo-router";
// Legacy combined measurements screen — replaced by /onboarding/waist
export default function LegacyMeasurementsRedirect() {
  return <Redirect href="/onboarding/waist" />;
}
