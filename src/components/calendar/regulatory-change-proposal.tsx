"use client";

import { Bell } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface RegulatoryProposal {
  id: string;
  description: string;
  addedCount: number;
  entityCount: number;
  changelogUrl: string;
}

interface RegulatoryChangeProposalProps {
  proposals: RegulatoryProposal[];
  onAccept: (proposalId: string) => void;
  onViewChangelog: (proposalId: string) => void;
}

export function RegulatoryChangeProposal({ proposals, onAccept, onViewChangelog }: RegulatoryChangeProposalProps) {
  if (proposals.length === 0) return null;

  return (
    <div className="space-y-2">
      {proposals.map((p) => (
        <Alert key={p.id} className="border-info/25 bg-info-soft dark:border-info/30 dark:bg-info-soft">
          <Bell className="h-4 w-4 text-info-soft-foreground" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-info-soft-foreground dark:text-info-soft-foreground">{p.description}</span>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs border-info/25 text-info-soft-foreground"
                onClick={() => onViewChangelog(p.id)}>
                View changelog
              </Button>
              <Button size="sm" className="h-7 text-xs"
                onClick={() => onAccept(p.id)}>
                Accept
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
