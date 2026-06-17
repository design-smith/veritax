import { use } from "react";
import { notFound } from "next/navigation";
import { EntityPageContent } from "@/components/graph/entity-page-content";
import { mockEntities, mockFlows, mockFindings, mockDocuments } from "@/lib/mock";

export default function EntityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const entity = mockEntities.find((e) => e.id === id);
  if (!entity) notFound();

  const relatedFlows = mockFlows.filter(
    (f) => f.fromEntityId === entity.id || f.toEntityId === entity.id
  );
  const relatedFlowIds = new Set(relatedFlows.map((f) => f.id));
  const relatedFindings = mockFindings.filter((f) => relatedFlowIds.has(f.flowId));
  const relatedDocuments = mockDocuments.filter((d) => d.entityIds.includes(entity.id));

  return (
    <EntityPageContent
      entity={entity}
      relatedFlows={relatedFlows}
      relatedFindings={relatedFindings}
      relatedDocuments={relatedDocuments}
    />
  );
}
