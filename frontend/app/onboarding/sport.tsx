import { Redirect } from "expo-router";
// Sport details are no longer collected at onboarding.
export default function LegacySportRedirect() {
  return <Redirect href="/onboarding/theme" />;
}
