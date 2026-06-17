"use client";

import Link from "next/link";
import { ExternalLink, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/contexts/permissions-context";

interface BoardPackActionProps {
  onRequestPlan: () => void;
  isGenerating?: boolean;
  runRef?: string;
}

export function BoardPackAction({ onRequestPlan, isGenerating = false, runRef }: BoardPackActionProps) {
  const permission = usePermission("promote_gates");

  // Board pack is gated to VP and Manager (those who can promote/gate)
  if (permission === "hidden") return null;

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={onRequestPlan}
        disabled={isGenerating}
        className="gap-2"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Package className="h-4 w-4" />
            <span className="hidden min-[480px]:inline">Generate board pack</span>
            <span className="min-[480px]:hidden">Generate</span>
          </>
        )}
      </Button>
      {isGenerating && runRef && (
        <Link
          href={runRef}
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
          aria-label="View run"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View run
        </Link>
      )}
    </div>
  );
}
