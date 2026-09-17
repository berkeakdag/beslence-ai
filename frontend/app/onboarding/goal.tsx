// Step 1: Goal selection
import React from "react";
import { useRouter } from "expo-router";
import { OnboardingScaffold, OptionCard } from "@/src/components/OnboardingScaffold";
import { useOnboarding } from "@/src/onboarding-context";

const GOALS = [
  { id: "kilo_vermek", label: "Kilo vermek", desc: "Sürdürülebilir bir açık ile" },
  { id: "yag_yakmak", label: "Yağ yakmak", desc: "Kas korumayı önceleyerek" },
  { id: "kas_kazanmak", label: "Kas kazanmak", desc: "Pozitif kalori dengesi" },
  { id: "kilo_korumak", label: "Kilo korumak", desc: "Bakım kalorisinde kalmak" },
  { id: "performans", label: "Spor performansımı artırmak", desc: "Antrenmanına göre" },
  { id: "saglikli_beslenmek", label: "Daha sağlıklı beslenmek", desc: "Düzenli kayıt + denge" },
  { id: "takip", label: "Sadece ne yediğimi takip etmek", desc: "Günlük çizelge + özet" },
];

export default function GoalStep() {
  const router = useRouter();
  const { draft, update } = useOnboarding();
  return (
    <OnboardingScaffold
      step={1}
      total={10}
      title="Hedefin ne?"
      subtitle="Kalori ve makro hedeflerini oluşturabilmemiz için ana hedefini seç."
      nextDisabled={!draft.goal_primary}
      onNext={() => router.push("/onboarding/name")}
    >
      {GOALS.map((g) => (
        <OptionCard
          key={g.id}
          testID={`goal-option-${g.id}`}
          title={g.label}
          description={g.desc}
          selected={draft.goal_primary === g.id}
          onPress={() => update({ goal_primary: g.id })}
        />
      ))}
    </OnboardingScaffold>
  );
}
