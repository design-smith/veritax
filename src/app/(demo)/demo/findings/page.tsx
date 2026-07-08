"use client";

import { useRouter } from "next/navigation";
import { FindingsWorkspace } from "@/components/findings/findings-workspace";
import { mockEntities, mockFindings, mockFlows, mockUsers } from "@/lib/mock";

export default function DemoFindingsPage() {
  const router = useRouter();

  return (
    <FindingsWorkspace
      initialFindings={mockFindings}
      flows={mockFlows}
      entities={mockEntities}
      users={mockUsers}
      onOpenFinding={(finding) => router.push(`/demo/findings/${finding.id}`)}
    />
  );
}
