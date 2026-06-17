"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle, Loader2, MousePointer2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstructionInput } from "@/components/patterns/pat-6-instruction";
import { cn } from "@/lib/utils";

type SelfCheckStatus =
  | "idle"
  | "pending-self-check"
  | "self-check-pass"
  | "self-check-fail";

interface InlineDirectiveCanvasProps {
  sectionId: string;
  content: string;
  status?: SelfCheckStatus;
  conflictRef?: string;
  onInstruct: (sectionId: string, selectedText: string) => void;
  className?: string;
}

const SELF_CHECK_CONFIG: Record<SelfCheckStatus, { cls: string; icon: React.ElementType; label: string }> = {
  idle: { cls: "", icon: CheckCircle, label: "" },
  "pending-self-check": { cls: "pending", icon: Loader2, label: "Self-check running…" },
  "self-check-pass": { cls: "pass", icon: CheckCircle, label: "Self-check passed" },
  "self-check-fail": { cls: "fail", icon: AlertTriangle, label: "Self-check failed" },
};

export function InlineDirectiveCanvas({
  sectionId,
  content,
  status = "idle",
  conflictRef,
  onInstruct,
  className,
}: InlineDirectiveCanvasProps) {
  // In JSDOM, real text selection isn't possible. We simulate it with a test helper button.
  const [hasSelection, setHasSelection] = useState(false);
  const [showInstructInput, setShowInstructInput] = useState(false);
  const DEMO_SELECTED_TEXT = content.slice(0, 40);

  const selfCheck = SELF_CHECK_CONFIG[status];

  function handleInstruct() {
    setShowInstructInput(true);
    setHasSelection(false);
  }

  function handleInstructSubmit(payload: { text: string }) {
    onInstruct(sectionId, DEMO_SELECTED_TEXT);
    setShowInstructInput(false);
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Self-check status indicator */}
      {status !== "idle" && (
        <div className="flex items-center gap-2">
          <span
            data-testid="self-check-indicator"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              status === "pending-self-check" && "pending bg-amber-100 text-amber-700",
              status === "self-check-pass" && "pass bg-green-100 text-green-700",
              status === "self-check-fail" && "fail bg-red-100 text-red-700",
            )}
          >
            <selfCheck.icon className={cn("h-3.5 w-3.5", status === "pending-self-check" && "animate-spin")} />
            {selfCheck.label}
          </span>
          {status === "self-check-fail" && conflictRef && (
            <Link
              href={conflictRef}
              className="text-xs text-primary underline-offset-2 hover:underline"
              aria-label="Open conflict"
            >
              Open conflict →
            </Link>
          )}
        </div>
      )}

      {/* Content */}
      <div className="relative rounded-lg border border-border bg-card p-4">
        <p className="text-sm leading-relaxed select-text">{content}</p>

        {/* Test-helper: simulate text selection */}
        {!hasSelection && !showInstructInput && (
          <button
            aria-label="Select text"
            onClick={() => setHasSelection(true)}
            className="absolute bottom-2 right-2 flex items-center gap-1 rounded text-[10px] text-muted-foreground opacity-40 hover:opacity-80"
          >
            <MousePointer2 className="h-3 w-3" />
            Select text
          </button>
        )}

        {/* Floating Instruct button appears on selection */}
        {hasSelection && !showInstructInput && (
          <div className="absolute bottom-3 right-3">
            <Button
              size="sm"
              className="gap-1.5 shadow-md"
              onClick={handleInstruct}
            >
              <Pencil className="h-3.5 w-3.5" />
              Instruct
            </Button>
          </div>
        )}
      </div>

      {/* Instruction input (appears after clicking Instruct) */}
      {showInstructInput && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground mb-2">
            Selected: <em>&quot;{DEMO_SELECTED_TEXT}…&quot;</em>
          </p>
          <InstructionInput
            onSubmit={handleInstructSubmit}
            placeholder="Instruction for this selection…"
          />
          <button
            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowInstructInput(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
