import { Redirect } from "expo-router";
// Legacy combined screen — replaced by individual steps (name → age → sex → height → weight → target-weight)
export default function LegacyInfoRedirect() {
  return <Redirect href="/onboarding/name" />;
}
