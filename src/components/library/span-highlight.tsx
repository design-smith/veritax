"use client";

import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReverseCitation {
  findingId: string;
  findingTitle: string;
}

interface SpanHighlightProps {
  spanId: string;
  text: string;
  isActive: boolean;
  reverseCitations: ReverseCitation[];
  onCitationClick?: (findingId: string) => void;
  className?: string;
}

export function SpanHighlight({
  spanId,
  text,
  isActive,
  reverseCitations,
  onCitationClick,
  className,
}: SpanHighlightProps) {
  const hasReverseCitations = reverseCitations.length > 0;

  const inner = (
    <mark
      data-testid={`span-${spanId}`}
      className={cn(
        "cursor-default rounded-sm px-0.5 transition-colors",
        isActive
          ? "highlighted bg-warning-soft text-warning-soft-foreground dark:bg-warning-soft dark:text-warning-soft-foreground"
          : "bg-transparent",
        hasReverseCitations && "underline decoration-dotted decoration-muted-foreground cursor-pointer",
        className,
      )}
    >
      {text}
    </mark>
  );

  if (!hasReverseCitations) return inner;

  return (
    <HoverCardPrimitive.Root openDelay={150} closeDelay={100}>
      <HoverCardPrimitive.Trigger asChild>{inner}</HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          side="top"
          align="start"
          className="z-50 w-72 rounded-md border bg-popover p-3 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        >
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Cited by {reverseCitations.length} finding{reverseCitations.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-1">
            {reverseCitations.map((rc) => (
              <button
                key={rc.findingId}
                onClick={() => onCitationClick?.(rc.findingId)}
                className="flex w-full items-start gap-1.5 rounded p-1 text-left text-xs hover:bg-muted"
              >
                <FileText className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                <span>{rc.findingTitle}</span>
              </button>
            ))}
          </div>
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}
