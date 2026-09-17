// Step 4: Sex
import React from "react";
import { useRouter } from "expo-router";
import { OnboardingScaffold, OptionCard } from "@/src/components/OnboardingScaffold";
import { useOnboarding } from "@/src/onboarding-context";

const OPTIONS = [
  { id: "kadin", label: "Kadın" },
  { id: "erkek", label: "Erkek" },
  { id: "belirtmek_istemiyorum", label: "Belirtmek istemiyorum" },
];

export default function SexStep() {
  const router = useRouter();
  const { draft, update } = useOnboarding();
  return (
    <OnboardingScaffold
      step={4}
      total={10}
      title="Cinsiyetini seç"
      subtitle="BMR formülü cinsiyete göre küçük bir farklılık gösterir."
      nextDisabled={!draft.sex}
      onNext={() => router.push("/onboarding/height")}
    >
      {OPTIONS.map((o) => (
        <OptionCard
          key={o.id}
          testID={`sex-${o.id}`}
          title={o.label}
          selected={draft.sex === o.id}
          onPress={() => update({ sex: o.id as any })}
        />
      ))}
    </OnboardingScaffold>
  );
}
