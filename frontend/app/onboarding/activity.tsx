import { Redirect } from "expo-router";
// Activity is no longer collected at onboarding — activities are added per day via timeline.
export default function LegacyActivityRedirect() {
  return <Redirect href="/onboarding/theme" />;
}
