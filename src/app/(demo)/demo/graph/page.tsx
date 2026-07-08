import { GraphWorkspace, DEFAULT_OWNERSHIP, PREVIOUS_OWNERSHIP } from "@/components/graph/graph-workspace";
import { mockEntities, mockFlows } from "@/lib/mock";

export default function DemoGraphPage() {
  return (
    <GraphWorkspace
      entities={mockEntities}
      flows={mockFlows}
      ownership={DEFAULT_OWNERSHIP}
      previousOwnership={PREVIOUS_OWNERSHIP}
    />
  );
}
