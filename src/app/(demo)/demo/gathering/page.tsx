"use client";

import { useRouter } from "next/navigation";
import { OnboardingJourneyContent } from "@/components/onboarding/onboarding-journey-content";

export default function DemoGatheringPage() {
  const router = useRouter();

  return (
    <OnboardingJourneyContent
      onOpenFindings={() => router.push("/demo/findings")}
    />
  );
}
